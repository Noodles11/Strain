import { Rng } from '../core/rng';
import { DERELICT_AMBUSH, DERELICT_BOSS, DERELICT_ELITES, DERELICT_PACKS } from '../core/enemies';
import { DERELICT_EVENTS } from '../core/events';

export const T_WALL = 0;
export const T_FLOOR = 1;
export const T_HAZARD = 2;
export const T_GATE = 3;

export type Ring = 'safe' | 'wild' | 'deep' | 'lair';
export const RING_IDX: Record<Ring, number> = { safe: 0, wild: 1, deep: 2, lair: 3 };

export interface Zone {
  id: number;
  cx: number;
  cy: number;
  ring: Ring;
  dist: number;
  dark: boolean;
}

export interface Gate {
  id: number;
  x: number;
  y: number;
  kind: 'door' | 'debris';
  rating: number;
  /** On the path to the boss: can always be forced. */
  forcible: boolean;
  open: boolean;
  a: number;
  b: number;
}

export type PoiKind = 'ship' | 'cache' | 'vent' | 'nest' | 'pod' | 'terminal' | 'surgery' | 'event';

/** Upgrade sites: spend biomass on the body or the decks. */
export const SITE_KINDS: PoiKind[] = ['pod', 'terminal', 'surgery'];

export interface Poi {
  id: number;
  kind: PoiKind;
  x: number;
  y: number;
  zone: number;
  used: boolean;
  /** Caches found only by scanning. */
  hidden?: boolean;
  /** Nests: steps until the next spawn. */
  timer?: number;
  /** Events: which one. */
  event?: string;
  /** Splice pods: the traits on offer. Terminals: 'tac:id' / 'exp:id' cards, made on first visit. */
  offer?: string[];
  /** Purchases made here. */
  buys?: number;
}

export type MobKind = 'pack' | 'ambush' | 'elite' | 'boss' | 'spawn';

export interface Mob {
  id: number;
  kind: MobKind;
  x: number;
  y: number;
  hx: number;
  hy: number;
  zone: number;
  foes: string[];
  alive: boolean;
  /** Pays Codons and a card reward. Respawns and nest spawns don't. */
  reward: boolean;
  chaser: boolean;
  alerted: boolean;
  stealth: number;
  spotted: boolean;
  /** Nest that spawned it. */
  nest?: number;
}

export interface World {
  seed: number;
  planet: string;
  tier: number;
  w: number;
  h: number;
  tiles: number[];
  zoneOf: number[];
  zones: Zone[];
  links: [number, number][];
  gates: Gate[];
  pois: Poi[];
  mobs: Mob[];
  seen: number[];
  lit: number[];
  ship: { x: number; y: number };
  landingZone: number;
  lairZone: number;
  nextId: number;
}

export function idx(w: World, x: number, y: number): number {
  return y * w.w + x;
}

export function inBounds(w: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w.w && y < w.h;
}

export function tileAt(w: World, x: number, y: number): number {
  return inBounds(w, x, y) ? w.tiles[idx(w, x, y)] : T_WALL;
}

export function gateAt(w: World, x: number, y: number): Gate | undefined {
  return w.gates.find((g) => g.x === x && g.y === y);
}

export function zoneAt(w: World, x: number, y: number): Zone {
  return w.zones[w.zoneOf[idx(w, x, y)]];
}

/** Can a body stand here? Hazards yes, closed gates no. */
export function passable(w: World, x: number, y: number): boolean {
  const t = tileAt(w, x, y);
  if (t === T_FLOOR || t === T_HAZARD) return true;
  if (t === T_GATE) return !!gateAt(w, x, y)?.open;
  return false;
}

function hash2(x: number, y: number, s: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s);
  const b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s);
  const d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const SIZE: Record<number, number> = { 1: 44, 2: 52, 3: 60, 4: 60 };

/** Build a planet map. Deterministic for a seed; retries internally until it validates. */
export function generateWorld(seed: number, tier = 1, planet = 'derelict'): World {
  for (let attempt = 0; attempt < 40; attempt++) {
    const w = tryGenerate(seed + attempt * 7919, tier, planet);
    if (w) return w;
  }
  throw new Error('world generation failed');
}

function tryGenerate(seed: number, tier: number, planet: string): World | null {
  const rng = new Rng(seed);
  const W = SIZE[tier] ?? 44;
  const H = W;
  const zoneCount = 11 + Math.min(4, tier);

  // 1. Zone seeds, spread out (Poisson-ish).
  const centers: [number, number][] = [];
  const minD = W / Math.sqrt(zoneCount) * 0.75;
  for (let tries = 0; centers.length < zoneCount && tries < 4000; tries++) {
    const x = 4 + rng.int(W - 8);
    const y = 4 + rng.int(H - 8);
    if (centers.every(([cx, cy]) => Math.hypot(cx - x, cy - y) >= minD)) centers.push([x, y]);
  }
  if (centers.length < 8) return null;

  // 2. Warped Voronoi.
  const zoneOf = new Array<number>(W * H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wx = x + (vnoise(x / 5, y / 5, seed) - 0.5) * 5;
      const wy = y + (vnoise(x / 5 + 40, y / 5 + 40, seed) - 0.5) * 5;
      let best = 0;
      let bd = Infinity;
      centers.forEach(([cx, cy], i) => {
        const d = (cx - wx) ** 2 + (cy - wy) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      zoneOf[y * W + x] = best;
    }
  }

  // 3. Walls on zone borders and the map edge.
  const tiles = new Array<number>(W * H).fill(T_FLOOR);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = zoneOf[y * W + x];
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const border = (x + 1 < W && zoneOf[y * W + x + 1] !== z) || (y + 1 < H && zoneOf[(y + 1) * W + x] !== z)
        || (x > 0 && zoneOf[y * W + x - 1] !== z) || (y > 0 && zoneOf[(y - 1) * W + x] !== z);
      if (edge || border) tiles[y * W + x] = T_WALL;
    }
  }
  // A few pillars and wreck clusters inside rooms.
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (tiles[y * W + x] !== T_FLOOR) continue;
      if (vnoise(x / 3.2, y / 3.2, seed + 9) > 0.8 && hash2(x, y, seed) > 0.35) tiles[y * W + x] = T_WALL;
    }
  }

  // 4. Crossings between neighbouring zones: wall pairs with floor on both sides.
  type Cross = { x: number; y: number; x2: number; y2: number };
  const crossings = new Map<string, Cross[]>();
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  const floorAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && tiles[y * W + x] === T_FLOOR;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const x2 = x + dx;
        const y2 = y + dy;
        if (x2 >= W - 1 || y2 >= H - 1) continue;
        const za = zoneOf[y * W + x];
        const zb = zoneOf[y2 * W + x2];
        if (za === zb) continue;
        if (tiles[y * W + x] !== T_WALL || tiles[y2 * W + x2] !== T_WALL) continue;
        if (!floorAt(x - dx, y - dy) || !floorAt(x2 + dx, y2 + dy)) continue;
        // side tiles must be walls too, so the crossing reads as a doorway
        const k = key(za, zb);
        const list = crossings.get(k) ?? [];
        list.push({ x, y, x2, y2 });
        crossings.set(k, list);
      }
    }
  }

  // 5. Graph: minimum spanning tree plus extra loops.
  const edges = [...crossings.keys()].map((k) => {
    const [a, b] = k.split(',').map(Number);
    return { a, b, d: Math.hypot(centers[a][0] - centers[b][0], centers[a][1] - centers[b][1]) + rng.next() * 3 };
  }).sort((p, q) => p.d - q.d);
  const parent = centers.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const links: [number, number][] = [];
  const spare: { a: number; b: number }[] = [];
  for (const e of edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) { parent[ra] = rb; links.push([e.a, e.b]); } else spare.push(e);
  }
  if (new Set(centers.map((_, i) => find(i))).size > 1) return null;
  for (const e of spare) if (rng.next() < 0.25) links.push([e.a, e.b]);

  // 6. Landing near the bottom edge, lair the farthest zone by hops.
  let landing = 0;
  centers.forEach(([cx, cy], i) => {
    const [bx, by] = centers[landing];
    if (cy - Math.abs(cx - W / 2) * 0.5 > by - Math.abs(bx - W / 2) * 0.5) landing = i;
  });
  const adj = centers.map(() => [] as number[]);
  for (const [a, b] of links) { adj[a].push(b); adj[b].push(a); }
  const dist = centers.map(() => -1);
  const prev = centers.map(() => -1);
  dist[landing] = 0;
  const q = [landing];
  while (q.length) {
    const c = q.shift()!;
    for (const n of adj[c]) if (dist[n] < 0) { dist[n] = dist[c] + 1; prev[n] = c; q.push(n); }
  }
  let lair = landing;
  centers.forEach(([cx, cy], i) => {
    const far = (j: number) => dist[j] * 100 + Math.hypot(centers[j][0] - centers[landing][0], centers[j][1] - centers[landing][1]);
    if (far(i) > far(lair)) lair = i;
    void cx; void cy;
  });
  const D = dist[lair];
  if (D < 3) return null;
  const critical = new Set<string>();
  for (let c = lair; prev[c] >= 0; c = prev[c]) critical.add(key(c, prev[c]));

  const zones: Zone[] = centers.map(([cx, cy], i) => {
    const ring: Ring = i === landing ? 'safe' : i === lair ? 'lair' : dist[i] <= Math.ceil(D / 2) ? 'wild' : 'deep';
    return { id: i, cx, cy, ring, dist: dist[i], dark: (ring === 'wild' || ring === 'deep') && rng.next() < 0.25 };
  });

  // 7. Carve crossings; some become gates.
  const gates: Gate[] = [];
  let nextId = 1;
  for (const [a, b] of links) {
    const list = crossings.get(key(a, b))!;
    const mx = list.reduce((s, c) => s + c.x, 0) / list.length;
    const my = list.reduce((s, c) => s + c.y, 0) / list.length;
    const c = list.slice().sort((p, r) => Math.hypot(p.x - mx, p.y - my) - Math.hypot(r.x - mx, r.y - my))[0];
    tiles[c.y * W + c.x] = T_FLOOR;
    tiles[c.y2 * W + c.x2] = T_FLOOR;
    const isCrit = critical.has(key(a, b));
    const touchesLanding = a === landing || b === landing;
    if (!touchesLanding && rng.next() < 0.5) {
      const ring = Math.max(RING_IDX[zones[a].ring], RING_IDX[zones[b].ring]);
      // the gate sits on the tile of the farther zone
      const far = zones[a].dist > zones[b].dist ? a : b;
      const [gx, gy] = zoneOf[c.y * W + c.x] === far ? [c.x, c.y] : [c.x2, c.y2];
      tiles[gy * W + gx] = T_GATE;
      gates.push({
        id: nextId++, x: gx, y: gy, kind: rng.next() < 0.5 ? 'door' : 'debris',
        rating: Math.min(6, Math.max(1, ring + tier - 1 + (isCrit ? 0 : 1))), forcible: isCrit, open: false, a, b,
      });
    }
  }

  // 8. Hazard blobs in some rooms.
  for (const z of zones) {
    if (z.ring === 'safe' || rng.next() > 0.3) continue;
    const s2 = seed + z.id * 31;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (zoneOf[y * W + x] !== z.id || tiles[y * W + x] !== T_FLOOR) continue;
        if (vnoise(x / 3, y / 3, s2) > 0.66) tiles[y * W + x] = T_HAZARD;
      }
    }
  }

  const world: World = {
    seed, planet, tier, w: W, h: H, tiles, zoneOf, zones, links, gates, pois: [], mobs: [],
    seen: new Array(W * H).fill(0), lit: [], ship: { x: 0, y: 0 }, landingZone: landing, lairZone: lair, nextId: 100,
  };
  // keep crossings clear of hazards
  for (const [a, b] of links) {
    for (const c of crossings.get(key(a, b))!) {
      for (const [x, y] of [[c.x, c.y], [c.x2, c.y2]]) if (world.tiles[y * W + x] === T_HAZARD) world.tiles[y * W + x] = T_FLOOR;
    }
  }

  // 9. Points of interest and mobs.
  const taken: [number, number][] = gates.map((g) => [g.x, g.y]);
  const spot = (zone: number, near?: [number, number], minSep = 3): [number, number] | null => {
    const cand: [number, number][] = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (zoneOf[y * W + x] !== zone || tiles[y * W + x] !== T_FLOOR) continue;
        let open = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tiles[(y + dy) * W + x + dx] !== T_WALL) open++;
        if (open < 3) continue;
        if (taken.some(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y) < minSep)) continue;
        cand.push([x, y]);
      }
    }
    if (!cand.length) return null;
    if (near) cand.sort((p, r) => Math.hypot(p[0] - near[0], p[1] - near[1]) - Math.hypot(r[0] - near[0], r[1] - near[1]));
    const p = near ? cand[0] : rng.pick(cand);
    taken.push(p);
    return p;
  };
  const addPoi = (kind: PoiKind, zone: number, p: [number, number] | null, extra: Partial<Poi> = {}) => {
    if (!p) return;
    world.pois.push({ id: world.nextId++, kind, x: p[0], y: p[1], zone, used: false, ...extra });
  };
  const addMob = (kind: MobKind, zone: number, foes: string[], p: [number, number] | null, extra: Partial<Mob> = {}) => {
    if (!p) return;
    world.mobs.push({
      id: world.nextId++, kind, x: p[0], y: p[1], hx: p[0], hy: p[1], zone, foes, alive: true,
      reward: kind !== 'spawn', chaser: false, alerted: false, stealth: 0, spotted: kind !== 'ambush', ...extra,
    });
  };

  const shipP = spot(landing, [zones[landing].cx, zones[landing].cy], 1);
  if (!shipP) return null;
  world.ship = { x: shipP[0], y: shipP[1] };
  addPoi('ship', landing, shipP);

  const bossP = spot(lair, [zones[lair].cx, zones[lair].cy], 1);
  if (!bossP) return null;
  addMob('boss', lair, DERELICT_BOSS, bossP);

  const wilds = zones.filter((z) => z.ring === 'wild');
  const deeps = zones.filter((z) => z.ring === 'deep');
  const pack = (ring: Ring) => DERELICT_PACKS[ring];
  for (const z of zones) {
    const n = z.ring === 'safe' ? 1 : z.ring === 'lair' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      addMob('pack', z.id, rng.pick(pack(z.ring)), spot(z.id, undefined, 4), { chaser: z.ring !== 'safe' && rng.next() < 0.4 });
    }
    addPoi('cache', z.id, spot(z.id));
    if (z.ring === 'wild' && rng.next() < 0.45) addMob('ambush', z.id, rng.pick(DERELICT_AMBUSH), spot(z.id), { stealth: 1 + rng.int(2) + tier - 1 });
    if (z.ring === 'deep' && rng.next() < 0.6) addMob('ambush', z.id, rng.pick(DERELICT_AMBUSH), spot(z.id), { stealth: 2 + rng.int(2) + tier - 1 });
  }
  addPoi('cache', landing, spot(landing));
  // elites guard a cache
  const eliteZones = [rng.pick(wilds.length ? wilds : deeps), rng.pick(deeps.length ? deeps : wilds)];
  eliteZones.forEach((z, i) => {
    const p = spot(z.id);
    addMob('elite', z.id, DERELICT_ELITES[i % DERELICT_ELITES.length], p);
    if (p) addPoi('cache', z.id, spot(z.id, p, 2));
  });
  // hidden caches
  for (const z of rng.sample(deeps.length ? deeps : wilds, 2)) addPoi('cache', z.id, spot(z.id), { hidden: true });
  // vents: one wild, one deep, one at the lair
  const ventWild = wilds.length ? rng.pick(wilds) : null;
  if (ventWild) addPoi('vent', ventWild.id, spot(ventWild.id));
  if (deeps.length) { const z = rng.pick(deeps); addPoi('vent', z.id, spot(z.id)); }
  const lairEntry = gates.find((g) => g.a === lair || g.b === lair);
  addPoi('vent', lair, spot(lair, lairEntry ? [lairEntry.x, lairEntry.y] : undefined, 3));
  // nests
  if (wilds.length) { const z = rng.pick(wilds); addPoi('nest', z.id, spot(z.id), { timer: 150 }); }
  if (deeps.length) { const z = rng.pick(deeps); addPoi('nest', z.id, spot(z.id), { timer: 150 }); }

  // upgrade sites, rotating kinds so a ring gets different ones
  const siteZones = zones.filter((z) => z.ring !== 'lair');
  let k = rng.int(SITE_KINDS.length);
  for (const z of siteZones) {
    if (z.ring !== 'safe' && rng.next() > 0.5) continue;
    addPoi(SITE_KINDS[k++ % SITE_KINDS.length], z.id, spot(z.id));
  }
  for (const kind of SITE_KINDS) {
    if (world.pois.some((p) => p.kind === kind)) continue;
    const z = rng.pick(siteZones.filter((q) => q.ring !== 'safe').length ? siteZones.filter((q) => q.ring !== 'safe') : siteZones);
    addPoi(kind, z.id, spot(z.id));
  }
  for (const p of world.pois) {
    if (p.kind === 'pod') p.offer = rng.sample(['mgt', 'hde', 'rfx', 'foc', 'met', 'abr'], 2);
  }
  // events: most wild and deep sections have one, never the same twice
  const evIds = rng.shuffle(DERELICT_EVENTS.map((e) => e.id));
  let ei = 0;
  for (const z of rng.shuffle(zones.filter((q) => q.ring === 'wild' || q.ring === 'deep'))) {
    if (ei >= evIds.length || (ei >= 3 && rng.next() > 0.55)) continue;
    const p = spot(z.id);
    if (p) addPoi('event', z.id, p, { event: evIds[ei++] });
  }

  // 10. Validate: boss reachable from the ship through forcible gates.
  if (!reachable(world, world.ship, { x: bossP[0], y: bossP[1] }, (g) => g.forcible)) return null;
  return world;
}

/** Flood fill; gates count as passable when `through` says so. */
export function reachable(w: World, from: { x: number; y: number }, to: { x: number; y: number }, through: (g: Gate) => boolean): boolean {
  const seen = new Uint8Array(w.w * w.h);
  const q = [[from.x, from.y]];
  seen[idx(w, from.x, from.y)] = 1;
  while (q.length) {
    const [x, y] = q.pop()!;
    if (x === to.x && y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(w, nx, ny) || seen[idx(w, nx, ny)]) continue;
      const t = tileAt(w, nx, ny);
      // things standing on a tile block it, except the ship and the target itself
      if (!(nx === to.x && ny === to.y) && w.pois.some((p) => p.x === nx && p.y === ny && p.kind !== 'ship')) continue;
      const ok = t === T_FLOOR || t === T_HAZARD || (t === T_GATE && (gateAt(w, nx, ny)!.open || through(gateAt(w, nx, ny)!)));
      if (!ok) continue;
      seen[idx(w, nx, ny)] = 1;
      q.push([nx, ny]);
    }
  }
  return false;
}
