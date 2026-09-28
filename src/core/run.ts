import {
  CARDS, hasKeyword, primaryTrait, resolveCard, REWARD_EXP, REWARD_TAC, STARTER_EXP, STARTER_TAC, type DeckKind,
} from './cards';
import {
  botTurn, endTurn, flee, pickHand, playCard, startBattle, type BattleEv, type BattleState, type CardInst,
} from './battle';
import { ENEMIES, tierOf } from './enemies';
import { findEvent, planet, PLANETS, type PlanetDef } from './planets';
import { checkChance, LOG_CODONS, LOGS, type Outcome } from './events';
import { IMPLANT_POOL, IMPLANTS, implantMods, type ImplantMods } from './implants';
import type { Meta } from './meta';
import { Rng } from './rng';
import {
  addTraits, biomassYield, eatHeal, exploreHandSize, hazardDamage, maxIntegrity, maxOxygen, SOMATIC_CAP, somaticCost, TRAIT_INFO, TRAITS, traits,
  type Trait, type Traits,
} from './traits';
import {
  gateAt, generateWorld, idx, inBounds, passable, T_GATE, T_HAZARD, T_WALL, tileAt, zoneAt,
  type Mob, type Poi, type World,
} from '../world/gen';

export const STORM_START = 600;
export const STORM_EVERY = 40;
export const NEST_EVERY = 150;
export const ZONE_CODONS = 2;
export const TERMINAL_PRICE = 5;
export const SITE_BUYS = 2;
export const KILL_CODONS = 2;

export type Mode = 'explore' | 'battle' | 'loot' | 'reward' | 'chart' | 'dead' | 'won';

export interface Corpse {
  id: string;
  tagged: boolean;
  mult: number;
  done?: 'eat' | 'render';
}

export interface Reward {
  title: string;
  options: string[];
  deck: DeckKind;
  biomass: number;
  codons: number;
}

export interface FightCtx {
  mobId: number;
  tier: number;
  kind: Mob['kind'] | 'nest';
  reward: boolean;
  ambush: boolean;
  nestId?: number;
}

export interface RunState {
  v: 1;
  seed: number;
  rng: number;
  clone: number;
  seq: Traits;
  somatic: Traits;
  hp: number;
  oxygen: number;
  biomass: number;
  codons: number;
  tac: CardInst[];
  exp: CardInst[];
  expDraw: number[];
  expHand: number[];
  expDiscard: number[];
  consumedRun: number;
  nextUid: number;
  world: World;
  x: number;
  y: number;
  facing: [number, number];
  steps: number;
  storm: number;
  stormedZones: number[];
  zonesVisited: number[];
  sealSteps: number;
  stalk: boolean;
  flarePower: number;
  beacons: { x: number; y: number; used: boolean }[];
  mode: Mode;
  battle?: BattleState;
  fight?: FightCtx;
  loot?: Corpse[];
  reward?: Reward;
  bossDead: boolean;
  landing: number;
  /** The planet under your feet. */
  planet: string;
  /** Planets landed on this run, in order. */
  visited: string[];
  /** Planets revealed by bosses this run; banked at the end. */
  revealed: string[];
  /** Planets the Printer already knows about. */
  knownPlanets: string[];
  stats: { kills: number; fights: number; ambushed: number; steps: number };
  msgs: string[];
  implants: string[];
  /** Somatic points bought this run (sets the pod price). */
  somaticBought: number;
  excised: number;
  /** Logs found this run; banked at the end. */
  logs: string[];
  /** Logs the Printer already holds; they pay no Codons again. */
  knownLogs: string[];
  /** A result to show once (events). */
  notice?: { title: string; text: string };
}

// ---- Setup ----

export function newRun(meta: Meta, seed: number): RunState {
  const world = generateWorld(seed, 1, 'derelict');
  return setupRun(meta, seed, world);
}

function setupRun(meta: Meta, seed: number, world: World): RunState {
  let uid = 1;
  const tac = STARTER_TAC.map((id) => ({ uid: uid++, id }));
  const exp = STARTER_EXP.map((id) => ({ uid: uid++, id }));
  const r: RunState = {
    v: 1, seed, rng: seed ^ 0x5eed, clone: meta.clone,
    seq: { ...meta.seq }, somatic: traits(0),
    hp: 0, oxygen: 0, biomass: 0, codons: 0,
    tac, exp, expDraw: [], expHand: [], expDiscard: [],
    consumedRun: 0, nextUid: uid,
    world, x: world.ship.x, y: world.ship.y, facing: [0, -1], steps: 0, storm: 0, stormedZones: [], zonesVisited: [world.landingZone],
    sealSteps: 0, stalk: false, flarePower: 0, beacons: [],
    mode: 'explore', bossDead: false, landing: 1, planet: world.planet, visited: [world.planet], revealed: [],
    knownPlanets: [...(meta.planets ?? ['derelict'])],
    stats: { kills: 0, fights: 0, ambushed: 0, steps: 0 }, msgs: [],
    implants: [], somaticBought: 0, excised: 0, logs: [], knownLogs: [...(meta.logs ?? [])],
  };
  const t = runTraits(r);
  r.hp = maxHp(r);
  r.oxygen = maxO2(r);
  withRng(r, (rng) => { r.expDraw = rng.shuffle(exp.map((c) => c.uid)); });
  drawExp(r, exploreHandSize(t));
  reveal(r);
  say(r, `CLONE-${String(r.clone).padStart(4, '0')} wakes on the derelict.`);
  return r;
}

/** Fill fields that older saves don't have. */
export function migrateRun(r: RunState): RunState {
  r.implants ??= [];
  r.somaticBought ??= 0;
  r.excised ??= 0;
  r.logs ??= [];
  r.knownLogs ??= [];
  r.zonesVisited ??= [r.world.landingZone];
  r.planet ??= r.world.planet;
  r.visited ??= [r.planet];
  r.revealed ??= [];
  r.knownPlanets ??= ['derelict'];
  r.stats.steps ??= r.steps;
  return r;
}

export function here(r: RunState): PlanetDef {
  return planet(r.planet);
}

export function mods(r: RunState): ImplantMods {
  return implantMods(r.implants);
}

export function runTraits(r: RunState): Traits {
  const t = addTraits(r.seq, r.somatic, mods(r).traits);
  for (const k of TRAITS) t[k] = Math.max(0, t[k]);
  return t;
}

export function maxHp(r: RunState): number {
  return Math.max(10, maxIntegrity(runTraits(r)) + mods(r).maxHp);
}

export function maxO2(r: RunState): number {
  return maxOxygen(runTraits(r)) + mods(r).o2;
}

function withRng<T>(r: RunState, fn: (rng: Rng) => T): T {
  const rng = new Rng(0);
  rng.importState(r.rng);
  const out = fn(rng);
  r.rng = rng.exportState();
  return out;
}

function say(r: RunState, s: string) {
  r.msgs.push(s);
  if (r.msgs.length > 40) r.msgs.shift();
}

// ---- Exploration deck ----

export function expCard(r: RunState, uid: number): CardInst | undefined {
  return r.exp.find((c) => c.uid === uid);
}

function drawExp(r: RunState, upTo: number) {
  withRng(r, (rng) => {
    while (r.expHand.length < upTo) {
      if (!r.expDraw.length) {
        if (!r.expDiscard.length) return;
        r.expDraw = rng.shuffle(r.expDiscard);
        r.expDiscard = [];
      }
      r.expHand.push(r.expDraw.pop()!);
    }
  });
}

function spendExp(r: RunState, uid: number) {
  const c = expCard(r, uid)!;
  const res = resolveCard(CARDS[c.id], runTraits(r));
  r.oxygen -= res.cost;
  r.biomass -= res.bioCost;
  if (hasKeyword(CARDS[c.id], 'tool')) return;
  r.expHand = r.expHand.filter((u) => u !== uid);
  if (hasKeyword(CARDS[c.id], 'consume')) {
    r.exp = r.exp.filter((x) => x.uid !== uid);
    r.consumedRun += 1;
  } else r.expDiscard.push(uid);
}

export function expUsable(r: RunState, uid: number): { ok: boolean; why?: string } {
  const c = expCard(r, uid);
  if (!c || r.mode !== 'explore') return { ok: false };
  const res = resolveCard(CARDS[c.id], runTraits(r));
  if (res.cost > r.oxygen) return { ok: false, why: 'Not enough oxygen' };
  if (res.bioCost > r.biomass) return { ok: false, why: 'Not enough biomass' };
  return { ok: true };
}

/** Cards that act on the clone or the area, not on an adjacent object. */
export function isSelfCard(id: string): boolean {
  const a = CARDS[id].act;
  return a !== 'override' && a !== 'cut' && a !== 'pry';
}

export function playExp(r: RunState, uid: number): boolean {
  const c = expCard(r, uid);
  if (!c || !isSelfCard(c.id) || !expUsable(r, uid).ok) return false;
  const res = resolveCard(CARDS[c.id], runTraits(r));
  const mh = maxHp(r);
  switch (CARDS[c.id].act) {
    case 'heal':
      if (r.hp >= mh) { say(r, 'Already whole.'); return false; }
      r.hp = Math.min(mh, r.hp + res.power);
      say(r, `You mend ${res.power}.`);
      break;
    case 'scan': {
      const n = revealAround(r, res.power, false);
      say(r, n ? `The scan pings ${n} hidden thing${n > 1 ? 's' : ''}.` : 'The scan finds nothing hidden.');
      break;
    }
    case 'notes': {
      const n = revealAround(r, res.power, true);
      r.codons += n;
      say(r, n ? `Field notes: ${n} finds. +${n} Codons.` : 'Nothing new to write down.');
      break;
    }
    case 'flare': {
      const z = zoneAt(r.world, r.x, r.y).id;
      if (!r.world.lit.includes(z)) r.world.lit.push(z);
      r.flarePower = Math.max(r.flarePower, res.power);
      for (const m of r.world.mobs) if (m.alive && m.zone === z && m.kind === 'ambush') m.spotted = true;
      reveal(r);
      say(r, 'Red light floods the room.');
      break;
    }
    case 'beacon':
      if (r.beacons.some((b) => b.x === r.x && b.y === r.y) || (r.x === r.world.ship.x && r.y === r.world.ship.y)) return false;
      r.beacons.push({ x: r.x, y: r.y, used: true });
      say(r, 'Beacon planted.');
      break;
    case 'stalk':
      r.stalk = true;
      say(r, 'You move low and slow.');
      break;
    case 'seal':
      r.sealSteps += res.power;
      say(r, `Sealed for ${res.power} hazard steps.`);
      break;
    default:
      return false;
  }
  spendExp(r, uid);
  return true;
}

function revealAround(r: RunState, radius: number, notes: boolean): number {
  const w = r.world;
  let found = 0;
  for (let y = r.y - radius; y <= r.y + radius; y++) {
    for (let x = r.x - radius; x <= r.x + radius; x++) {
      if (!inBounds(w, x, y) || Math.hypot(x - r.x, y - r.y) > radius + 0.5) continue;
      w.seen[idx(w, x, y)] = 1;
    }
  }
  for (const p of w.pois) {
    if (p.hidden && Math.hypot(p.x - r.x, p.y - r.y) <= radius + 0.5) { p.hidden = false; found++; }
  }
  for (const m of w.mobs) {
    if (m.alive && m.kind === 'ambush' && !m.spotted && Math.hypot(m.x - r.x, m.y - r.y) <= radius + 0.5) { m.spotted = true; found++; }
  }
  void notes;
  return found;
}

// ---- Vision ----

export function isDark(r: RunState, x: number, y: number): boolean {
  const z = zoneAt(r.world, x, y);
  return z.dark && !r.world.lit.includes(z.id);
}

export function viewRadius(r: RunState): number {
  return isDark(r, r.x, r.y) ? 2 : 5;
}

function reveal(r: RunState) {
  const w = r.world;
  const rad = viewRadius(r);
  for (let y = r.y - rad; y <= r.y + rad; y++) {
    for (let x = r.x - rad; x <= r.x + rad; x++) {
      if (inBounds(w, x, y) && Math.hypot(x - r.x, y - r.y) <= rad + 0.5) w.seen[idx(w, x, y)] = 1;
    }
  }
}

export function inView(r: RunState, x: number, y: number): boolean {
  return Math.hypot(x - r.x, y - r.y) <= viewRadius(r) + 0.5;
}

export function inStorm(r: RunState, x: number, y: number): boolean {
  const w = r.world;
  return r.storm > 0 && Math.min(x, y, w.w - 1 - x, w.h - 1 - y) < r.storm;
}

/** Steps left before the storm front arrives. */
export function stormIn(r: RunState): number {
  return Math.max(0, STORM_START - r.steps);
}

// ---- Movement ----

export function mobAt(r: RunState, x: number, y: number): Mob | undefined {
  return r.world.mobs.find((m) => m.alive && m.x === x && m.y === y);
}

export function poiAt(r: RunState, x: number, y: number): Poi | undefined {
  return r.world.pois.find((p) => p.x === x && p.y === y && !(p.kind === 'nest' && p.used));
}

/** Tiles you can't walk onto but can use from next to them. */
export function isInteractable(r: RunState, x: number, y: number): boolean {
  const p = poiAt(r, x, y);
  if (p) {
    if (p.kind === 'cache') return !p.used && !p.hidden;
    return true;
  }
  return tileAt(r.world, x, y) === T_GATE && !gateAt(r.world, x, y)!.open;
}

function walkable(r: RunState, x: number, y: number): boolean {
  if (!passable(r.world, x, y)) return false;
  const p = poiAt(r, x, y);
  if (p && p.kind !== 'ship' && !(p.kind === 'cache' && (p.used || p.hidden))) return false;
  return true;
}

/** Shortest walk to (tx, ty), or to a tile next to it when it's a thing you use. */
export function pathTo(r: RunState, tx: number, ty: number): [number, number][] {
  const w = r.world;
  if (!inBounds(w, tx, ty) || !w.seen[idx(w, tx, ty)]) return [];
  const goalAdj = !walkable(r, tx, ty);
  const prev = new Int32Array(w.w * w.h).fill(-1);
  const start = idx(w, r.x, r.y);
  prev[start] = start;
  const q = [start];
  let end = -1;
  while (q.length) {
    const c = q.shift()!;
    const cx = c % w.w;
    const cy = (c - cx) / w.w;
    if (goalAdj ? Math.abs(cx - tx) + Math.abs(cy - ty) === 1 : cx === tx && cy === ty) { end = c; break; }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(w, nx, ny)) continue;
      const ni = idx(w, nx, ny);
      if (prev[ni] >= 0 || !w.seen[ni]) continue;
      if (!walkable(r, nx, ny)) continue;
      prev[ni] = c;
      q.push(ni);
    }
  }
  if (end < 0) return [];
  const out: [number, number][] = [];
  for (let c = end; c !== start; c = prev[c]) out.push([c % w.w, Math.floor(c / w.w)]);
  return out.reverse();
}

/** One step. Returns false if blocked. May start a battle or end the run. */
export function step(r: RunState, dx: number, dy: number): boolean {
  if (r.mode !== 'explore') return false;
  r.facing = [dx, dy];
  const nx = r.x + dx;
  const ny = r.y + dy;
  const mob = mobAt(r, nx, ny);
  if (mob) {
    beginFight(r, mob, 'player');
    return false;
  }
  if (!walkable(r, nx, ny)) return false;
  r.x = nx;
  r.y = ny;
  r.steps += 1;
  r.stats.steps += 1;
  const t = runTraits(r);

  if (tileAt(r.world, nx, ny) === T_HAZARD) {
    if (r.sealSteps > 0) r.sealSteps -= 1;
    else {
      const d = hazardDamage(t);
      if (d) { r.hp -= d; say(r, `${here(r).hazardText} −${d}.`); }
    }
  }
  if (inStorm(r, nx, ny)) {
    if (r.oxygen > 0) r.oxygen -= 1;
    else { r.hp -= 2; say(r, 'The storm chokes you. −2.'); }
  }
  if (r.hp <= 0) { die(r, 'You fall and do not get up.'); return true; }

  if (nx === r.world.ship.x && ny === r.world.ship.y) {
    r.oxygen = maxO2(r);
    drawExp(r, exploreHandSize(t));
  }
  const b = r.beacons.find((q) => q.x === nx && q.y === ny && !q.used);
  if (b) { b.used = true; r.oxygen = maxO2(r); say(r, 'Beacon: oxygen refilled.'); }

  reveal(r);
  const zone = zoneAt(r.world, nx, ny).id;
  if (!r.zonesVisited.includes(zone)) {
    r.zonesVisited.push(zone);
    r.codons += ZONE_CODONS;
    say(r, `New section mapped. +${ZONE_CODONS} Codons.`);
  }
  tickWorld(r);
  if (r.mode !== 'explore') return true;
  moveMobs(r);
  if (r.mode !== 'explore') return true;
  checkAmbush(r);
  return true;
}

function tickWorld(r: RunState) {
  if (r.steps >= STORM_START && (r.steps - STORM_START) % STORM_EVERY === 0) {
    r.storm += 1;
    if (r.storm === 1) say(r, 'The storm front rolls in from the edges.');
    for (const z of r.world.zones) {
      if (r.stormedZones.includes(z.id) || !inStorm(r, z.cx, z.cy)) continue;
      r.stormedZones.push(z.id);
      respawnZone(r, z.id);
    }
  }
  for (const p of r.world.pois) {
    if (p.kind !== 'nest' || p.used) continue;
    p.timer = (p.timer ?? NEST_EVERY) - 1;
    if (p.timer > 0) continue;
    p.timer = NEST_EVERY;
    const inZone = r.world.mobs.filter((m) => m.alive && m.zone === p.zone && (m.kind === 'pack' || m.kind === 'spawn')).length;
    if (inZone >= 3) continue;
    withRng(r, (rng) => {
      const spots: [number, number][] = [];
      const w = r.world;
      for (let y = 1; y < w.h - 1; y++) {
        for (let x = 1; x < w.w - 1; x++) {
          if (w.zoneOf[idx(w, x, y)] !== p.zone || !walkable(r, x, y) || mobAt(r, x, y)) continue;
          if (Math.abs(x - r.x) + Math.abs(y - r.y) < 5) continue;
          spots.push([x, y]);
        }
      }
      if (!spots.length) return;
      const [x, y] = rng.pick(spots);
      const ring = r.world.zones[p.zone].ring;
      w.mobs.push({
        id: w.nextId++, kind: 'spawn', x, y, hx: x, hy: y, zone: p.zone, foes: rng.pick(here(r).packs[ring]),
        alive: true, reward: false, chaser: rng.next() < 0.5, alerted: false, stealth: 0, spotted: true, nest: p.id,
      });
    });
  }
}

function respawnZone(r: RunState, zone: number) {
  withRng(r, (rng) => {
    for (const m of r.world.mobs) {
      if (m.alive || m.zone !== zone || (m.kind !== 'pack' && m.kind !== 'ambush')) continue;
      m.alive = true;
      m.x = m.hx;
      m.y = m.hy;
      m.reward = false;
      m.alerted = false;
      m.foes = m.kind === 'ambush' ? rng.pick(here(r).ambush) : rng.pick(here(r).packs[r.world.zones[zone].ring]);
      if (m.kind === 'ambush') m.spotted = false;
    }
  });
}

function mobVision(r: RunState): number {
  return Math.max(1, 5 - Math.floor(runTraits(r).rfx / 3));
}

function moveMobs(r: RunState) {
  const w = r.world;
  let contact: { m: Mob; how: 'mob' | 'behind' } | null = null;
  withRng(r, (rng) => {
    for (const m of w.mobs) {
      if (contact) return;
      if (!m.alive || (m.kind !== 'pack' && m.kind !== 'spawn')) continue;
      const dist = Math.abs(m.x - r.x) + Math.abs(m.y - r.y);
      const vis = mobVision(r) - (isDark(r, m.x, m.y) ? 2 : 0);
      const runner = m.foes.length === 1 && ENEMIES[m.foes[0]].fleesAfter !== undefined;
      if (runner && dist <= Math.max(2, vis + 1)) {
        // skittish: it backs away from the clone instead of closing in
        let best: [number, number] | null = null;
        let bestD = dist;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as [number, number][]) {
          const nx = m.x + dx;
          const ny = m.y + dy;
          const nd = Math.abs(nx - r.x) + Math.abs(ny - r.y);
          if (nd > bestD && walkable(r, nx, ny) && !mobAt(r, nx, ny) && Math.abs(nx - m.hx) + Math.abs(ny - m.hy) <= 6) { bestD = nd; best = [dx, dy]; }
        }
        if (best && rng.next() < 0.7) { m.x += best[0]; m.y += best[1]; }
        continue;
      }
      if (m.chaser && !m.alerted && dist <= Math.max(1, vis)) m.alerted = true;
      if (m.alerted && Math.abs(m.x - m.hx) + Math.abs(m.y - m.hy) > 14) m.alerted = false;
      let dir: [number, number] | null = null;
      if (m.alerted) {
        const opts: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        let best = dist;
        for (const [dx, dy] of opts) {
          const nx = m.x + dx;
          const ny = m.y + dy;
          const nd = Math.abs(nx - r.x) + Math.abs(ny - r.y);
          if (nd >= best) continue;
          if (!(nx === r.x && ny === r.y) && (!walkable(r, nx, ny) || mobAt(r, nx, ny))) continue;
          best = nd;
          dir = [dx, dy];
        }
      } else if (rng.next() < 0.35) {
        const [dx, dy] = rng.pick([[0, -1], [1, 0], [0, 1], [-1, 0]] as [number, number][]);
        const nx = m.x + dx;
        const ny = m.y + dy;
        if (Math.abs(nx - m.hx) + Math.abs(ny - m.hy) <= 3 && walkable(r, nx, ny) && !mobAt(r, nx, ny) && !(nx === r.x && ny === r.y)) dir = [dx, dy];
      }
      if (!dir) continue;
      const fromBehind = r.facing[0] === dir[0] && r.facing[1] === dir[1];
      m.x += dir[0];
      m.y += dir[1];
      if (m.x === r.x && m.y === r.y) {
        m.x -= dir[0];
        m.y -= dir[1];
        contact = { m, how: fromBehind ? 'behind' : 'mob' };
      }
    }
  });
  const c = contact as { m: Mob; how: 'mob' | 'behind' } | null;
  if (c) beginFight(r, c.m, c.how);
}

function checkAmbush(r: RunState) {
  const foc = runTraits(r).foc;
  for (const m of r.world.mobs) {
    if (!m.alive || m.kind !== 'ambush' || m.spotted) continue;
    const cheb = Math.max(Math.abs(m.x - r.x), Math.abs(m.y - r.y));
    if (cheb > 2) continue;
    const stealth = m.stealth + (isDark(r, m.x, m.y) ? 1 : 0) + (inStorm(r, m.x, m.y) ? 1 : 0);
    if (Math.floor(foc / 2) >= stealth || mods(r).wetEye) {
      m.spotted = true;
      say(r, 'Something shifts inside the wall. You see it first.');
      continue;
    }
    if (cheb <= 1 && Math.abs(m.x - r.x) + Math.abs(m.y - r.y) <= 2) {
      beginFight(r, m, 'ambush');
      return;
    }
  }
}

// ---- Fights ----

function beginFight(r: RunState, m: Mob, how: 'player' | 'mob' | 'behind' | 'ambush') {
  const ambush = !r.stalk && (how === 'ambush' || how === 'behind');
  const firstStrike = r.stalk || (how === 'player' && !m.alerted && m.kind !== 'elite' && m.kind !== 'boss' && m.kind !== 'ambush');
  const tier = r.world.tier + (inStorm(r, m.x, m.y) ? 1 : 0);
  const lit = r.world.lit.includes(m.zone);
  r.stalk = false;
  if (ambush) r.stats.ambushed += 1;
  startFight(r, m.foes, tier, { mobId: m.id, tier, kind: m.kind, reward: m.reward, ambush }, ambush, firstStrike, lit ? r.flarePower : 0);
}

function startFight(r: RunState, foes: string[], tier: number, ctx: FightCtx, ambush: boolean, firstStrike: boolean, expose: number) {
  const t = runTraits(r);
  const tr = tierOf(tier);
  const m = mods(r);
  const out = withRng(r, (rng) => startBattle({
    foes, tier, deck: r.tac, traits: t, hp: r.hp, maxHp: maxHp(r), biomass: r.biomass,
    consumedRun: r.consumedRun, ambush, firstStrike, exposeStart: expose, plateStart: m.plateHde ? t.hde : 0,
    mods: { firstCardFree: m.firstCardFree, thorns: m.thorns, tagStart: m.tagStart, energyFirst: m.energyFirst, drawFirst: m.drawFirst, fleeBonus: m.fleeBonus, resonance: here(r).twist === 'resonance' },
  }, rng, tr.bonus, tr.hp));
  r.battle = out.s;
  r.fight = ctx;
  r.mode = 'battle';
  r.stats.fights += 1;
  pendingEv = out.ev;
  afterBattleOp(r);
}

/** Events from the latest battle call that the UI hasn't played yet. */
let pendingEv: BattleEv[] = [];

export function takeEvents(): BattleEv[] {
  const e = pendingEv;
  pendingEv = [];
  return e;
}

export function bPlay(r: RunState, uid: number, target?: number): BattleEv[] {
  if (!r.battle) return [];
  const ev = withRng(r, (rng) => playCard(r.battle!, uid, target, rng));
  afterBattleOp(r);
  return ev;
}

export function bPick(r: RunState, uid: number, target?: number): BattleEv[] {
  if (!r.battle) return [];
  const ev = withRng(r, (rng) => pickHand(r.battle!, uid, target, rng));
  afterBattleOp(r);
  return ev;
}

export function bEnd(r: RunState): BattleEv[] {
  if (!r.battle) return [];
  const ev = withRng(r, (rng) => endTurn(r.battle!, rng));
  afterBattleOp(r);
  return ev;
}

export function bFlee(r: RunState): BattleEv[] {
  if (!r.battle || r.oxygen < 2) return [];
  r.oxygen -= 2;
  const ev = withRng(r, (rng) => flee(r.battle!, rng));
  afterBattleOp(r);
  return ev;
}

function afterBattleOp(r: RunState) {
  const b = r.battle;
  if (!b) return;
  r.hp = b.player.hp;
  r.biomass = b.biomass;
  if (b.phase === 'player') return;
  const ctx = r.fight!;
  // cards consumed in the fight leave the deck
  if (b.consumed.length) {
    r.tac = r.tac.filter((c) => !b.consumed.includes(c.uid));
  }
  r.consumedRun = b.consumedRun;
  const mob = r.world.mobs.find((m) => m.id === ctx.mobId);
  if (b.phase === 'lost') {
    die(r, 'Your print fails.');
    return;
  }
  if (b.phase === 'fled') {
    r.mode = 'explore';
    r.battle = undefined;
    if (mob) mob.alerted = false;
    // step back the way you came
    const [fx, fy] = r.facing;
    if (walkable(r, r.x - fx, r.y - fy) && !mobAt(r, r.x - fx, r.y - fy)) { r.x -= fx; r.y -= fy; }
    say(r, 'You slip away.');
    return;
  }
  // won
  r.oxygen = Math.min(maxO2(r), r.oxygen + 2 + (r.hp > maxHp(r) / 2 ? mods(r).winO2 : 0));
  // runners that got away and units that blew themselves up leave nothing behind
  const killed = b.foes.filter((f) => !f.fled);
  const kills = killed.length;
  r.stats.kills += kills;
  let mult = ctx.reward ? 1 : 0.5;
  if (ctx.ambush) mult *= 1.5;
  r.loot = killed.map((f) => ({ id: f.id, tagged: f.tag > 0, mult }));
  const bonus = killed.reduce((a, f) => a + (ENEMIES[f.id].bonusCodons ?? 0), 0);
  let codons = 0;
  let options: string[] = [];
  let biomass = 0;
  let title = '';
  if (ctx.kind === 'nest') {
    const nest = r.world.pois.find((p) => p.id === ctx.nestId);
    if (nest) nest.used = true;
    codons = 2;
    title = 'Nest burned out';
  } else if (mob) {
    mob.alive = false;
    if (ctx.kind === 'boss') {
      const P = here(r);
      codons = 20 * r.world.tier;
      r.bossDead = true;
      title = `${P.bossName} is dead`;
      if (P.bossLog) findLog(r, P.bossLog);
      for (const id of P.reveals) if (!r.revealed.includes(id) && !r.knownPlanets.includes(id)) r.revealed.push(id);
      say(r, `${P.bossName} is dead. Return to the ship to launch.`);
    } else if (ctx.kind === 'elite') {
      codons = 8;
      biomass = 6;
      options = here(r).cards.length ? offerCards(r, 'tac', here(r).cards) : offerCards(r, 'tac');
      title = 'Elite remains';
      const got = addImplant(r, 'random');
      if (got) title = `Elite remains · ${IMPLANTS[got].name} implanted`;
    } else if (ctx.reward) {
      codons = kills * KILL_CODONS + bonus;
      options = offerCards(r, 'tac');
      title = 'Something useful';
    }
  }
  r.codons += codons;
  r.biomass += biomass;
  r.reward = options.length || codons || biomass ? { title, options, deck: 'tac', biomass, codons } : undefined;
  if (kills === 0 && ctx.kind !== 'boss') {
    // nothing to eat or render: it all got away
    say(r, 'Nothing left to take.');
    r.loot = [];
    r.mode = 'loot';
    lootDone(r);
    return;
  }
  r.mode = 'loot';
}

export function eatValue(r: RunState, c: Corpse): number {
  const base = eatHeal(ENEMIES[c.id].biomass, runTraits(r));
  return c.tagged ? base * 2 : base;
}

export function renderValue(r: RunState, c: Corpse): number {
  const base = biomassYield(ENEMIES[c.id].biomass, runTraits(r)) * (c.tagged ? 2 : 1);
  return Math.max(1, Math.round(base * c.mult));
}

export function lootChoose(r: RunState, i: number, how: 'eat' | 'render') {
  const c = r.loot?.[i];
  if (!c || c.done || r.mode !== 'loot') return;
  c.done = how;
  if (how === 'eat') { r.hp = Math.min(maxHp(r), r.hp + eatValue(r, c)); r.biomass += mods(r).eatBio; }
  else r.biomass += renderValue(r, c) + mods(r).renderBio;
  if (r.loot!.every((x) => x.done)) lootDone(r);
}

export function lootDone(r: RunState) {
  if (r.mode !== 'loot') return;
  r.loot = undefined;
  r.battle = undefined;
  r.mode = r.reward && r.reward.options.length ? 'reward' : 'explore';
  if (r.mode === 'explore') r.reward = undefined;
}

export function rewardPick(r: RunState, i: number) {
  const rw = r.reward;
  if (!rw || r.mode !== 'reward') return;
  const id = rw.options[i];
  if (id) {
    const inst = { uid: r.nextUid++, id };
    if (rw.deck === 'tac') r.tac.push(inst);
    else { r.exp.push(inst); r.expDiscard.push(inst.uid); }
    say(r, `${CARDS[id].name} joins your ${rw.deck === 'tac' ? 'tactical' : 'exploration'} deck.`);
  }
  r.reward = undefined;
  r.mode = 'explore';
}

function topTraits(r: RunState): Trait[] {
  const t = runTraits(r);
  return [...TRAITS].sort((a, b) => t[b] - t[a]).slice(0, 2);
}

/** Three distinct cards; half the slots lean toward your two best traits. Planet cards join the tactical pool. */
export function offerCards(r: RunState, deck: DeckKind, only?: string[]): string[] {
  const local = here(r).cards;
  const pool = only ?? (deck === 'tac' ? [...REWARD_TAC, ...local, ...local] : REWARD_EXP);
  const top = topTraits(r);
  const fav = pool.filter((id) => { const p = primaryTrait(CARDS[id]); return p && top.includes(p); });
  const all = [...new Set(pool)].length;
  return withRng(r, (rng) => {
    const out: string[] = [];
    let guard = 60;
    while (out.length < Math.min(3, all) && guard-- > 0) {
      const src = fav.length && rng.next() < 0.5 ? fav : pool;
      const id = rng.pick(src);
      if (!out.includes(id)) out.push(id);
    }
    return out;
  });
}

// ---- Things you use ----

export interface Action {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
  /** A card this action prints, shown as a card face. */
  card?: string;
}

function adjacent(r: RunState, x: number, y: number): boolean {
  return Math.abs(x - r.x) + Math.abs(y - r.y) === 1;
}

export function forceGateCost(r: RunState, rating: number): number {
  return Math.max(1, 3 * rating - runTraits(r).hde);
}

export function forceCacheCost(r: RunState): number {
  return Math.max(1, 4 - Math.floor(runTraits(r).mgt / 3));
}

export function describeAt(r: RunState, x: number, y: number): { title: string; text: string } | null {
  const g = gateAt(r.world, x, y);
  if (g && !g.open) {
    return g.kind === 'door'
      ? { title: `Sealed door · rating ${g.rating}`, text: `Override opens it at Focus ${g.rating * 2}+.${g.forcible ? '' : ' Too heavy to force.'}` }
      : { title: `Debris · rating ${g.rating}`, text: `Plasma Cutter clears it at Might ${g.rating * 2}+.${g.forcible ? '' : ' Too dense to force.'}` };
  }
  const p = poiAt(r, x, y);
  if (!p) return null;
  switch (p.kind) {
    case 'cache': return { title: 'Cache', text: 'A sealed locker. Pry it open.' };
    case 'vent': return { title: p.used ? 'Cold vent (spent)' : 'Warm vent', text: 'Rest: heal, refill oxygen and your exploration hand. Everything you killed elsewhere comes back.' };
    case 'nest': return { title: 'Nest', text: 'It breathes. Every so often something crawls out.' };
    case 'ship': return { title: 'Your ship', text: r.bossDead ? 'Ready to launch.' : 'Oxygen and exploration hand refill here.' };
    case 'pod': return { title: 'Splice pod', text: `Pour biomass in to push this body past its sequence. +1 to a trait for this run (max +${SOMATIC_CAP} each). ${SITE_BUYS - (p.buys ?? 0)} splice${SITE_BUYS - (p.buys ?? 0) === 1 ? '' : 's'} left in it.` };
    case 'terminal': return { title: 'Printer terminal', text: `It still prints techniques. ${TERMINAL_PRICE} biomass each, ${SITE_BUYS - (p.buys ?? 0)} left.` };
    case 'surgery': return { title: 'Surgery bay', text: `Cut a card out of a deck for good. ${exciseCost(r)} biomass.` };
    case 'event': {
      const ev = findEvent(p.event)!;
      return p.used ? { title: ev.title, text: 'Nothing more here.' } : { title: ev.title, text: ev.text };
    }
  }
}

export function actionsAt(r: RunState, x: number, y: number): Action[] {
  if (r.mode !== 'explore') return [];
  const out: Action[] = [];
  const t = runTraits(r);
  const near = adjacent(r, x, y) || (x === r.x && y === r.y);
  const hand = r.expHand.map((u) => expCard(r, u)!).filter(Boolean);
  const cardAction = (act: string, label: (p: number) => string, need: number) => {
    for (const c of hand) {
      if (CARDS[c.id].act !== act) continue;
      const res = resolveCard(CARDS[c.id], t);
      const use = expUsable(r, c.uid);
      out.push({
        id: `card:${c.uid}`, label: `${CARDS[c.id].name}`, detail: `${label(res.power)} · ${res.cost} O₂`,
        ok: near && use.ok && res.power >= need,
      });
      return;
    }
  };
  const g = gateAt(r.world, x, y);
  if (g && !g.open) {
    cardAction(g.kind === 'door' ? 'override' : 'cut', (p) => `power ${p} vs ${g.rating}`, g.rating);
    if (g.forcible) {
      const c = forceGateCost(r, g.rating);
      out.push({ id: 'force', label: 'Force it', detail: `−${c} integrity`, ok: near && r.hp > c });
    }
    return out;
  }
  const p = poiAt(r, x, y);
  if (!p) return out;
  if (p.kind === 'cache' && !p.used) {
    cardAction('pry', () => 'open', 0);
    const c = forceCacheCost(r);
    out.push({ id: 'force', label: 'Rip it open', detail: `−${c} integrity`, ok: near && r.hp > c });
  }
  if (p.kind === 'vent') out.push({ id: 'rest', label: 'Rest', detail: 'Heal, refill. Enemies return.', ok: near && !p.used });
  if (p.kind === 'nest') {
    cardAction('cut', (pw) => `burn it (needs 3, have ${pw})`, 3);
    out.push({ id: 'attack', label: 'Attack the nest', detail: `${here(r).nest.length} guardians`, ok: near });
  }
  if (p.kind === 'pod') {
    const cost = somaticCost(r.somaticBought);
    for (const k of (p.offer ?? []) as Trait[]) {
      const capped = r.somatic[k] >= SOMATIC_CAP;
      out.push({ id: `splice:${k}`, label: `Splice +1 ${TRAIT_INFO[k].name}`, detail: capped ? 'at its limit' : `${cost} biomass`, ok: near && !capped && (p.buys ?? 0) < SITE_BUYS && r.biomass >= cost });
    }
  }
  if (p.kind === 'terminal') {
    if (!p.offer) p.offer = [...offerCards(r, 'tac').map((id) => `tac:${id}`), ...offerCards(r, 'exp').slice(0, 1).map((id) => `exp:${id}`)];
    p.offer.forEach((o, i) => {
      const [deck, id] = o.split(':');
      out.push({ id: `buy:${i}`, label: CARDS[id].name, detail: `${deck === 'tac' ? 'tactical' : 'exploration'} · ${TERMINAL_PRICE} biomass`, ok: near && (p.buys ?? 0) < SITE_BUYS && r.biomass >= TERMINAL_PRICE, card: id });
    });
  }
  if (p.kind === 'surgery') {
    out.push({ id: 'surgery', label: 'Lie down', detail: `${exciseCost(r)} biomass per cut`, ok: near && r.biomass >= exciseCost(r) });
  }
  if (p.kind === 'event' && !p.used) {
    const ev = findEvent(p.event)!;
    ev.options.forEach((o, i) => {
      const detail = o.check ? `${TRAIT_INFO[o.check.t].name} ${o.check.at} · ${Math.round(checkChance(t[o.check.t], o.check.at) * 100)}%` : '';
      out.push({ id: `ev:${i}`, label: o.label, detail, ok: near });
    });
  }
  if (p.kind === 'ship') {
    out.push({ id: 'launch', label: 'Launch', detail: r.bossDead ? `Leave ${here(r).name}` : `Kill ${here(r).bossName} first`, ok: near && r.bossDead });
  }
  return out;
}

export function doAction(r: RunState, x: number, y: number, id: string): boolean {
  const a = actionsAt(r, x, y).find((q) => q.id === id);
  if (!a || !a.ok) return false;
  const g = gateAt(r.world, x, y);
  const p = poiAt(r, x, y);
  if (id.startsWith('card:')) {
    const uid = Number(id.slice(5));
    spendExp(r, uid);
    if (g) { g.open = true; say(r, g.kind === 'door' ? 'The door grinds open.' : 'The debris falls away.'); }
    else if (p?.kind === 'cache') openCache(r, p, resolveCard(CARDS[expCard(r, uid)?.id ?? 'pry'], runTraits(r)).power > 0);
    else if (p?.kind === 'nest') { p.used = true; r.codons += 2; say(r, 'The nest burns. +2 Codons.'); }
    reveal(r);
    return true;
  }
  if (p && id.startsWith('splice:')) { splice(r, p, id.slice(7) as Trait); return true; }
  if (p && id.startsWith('buy:')) { terminalBuy(r, p, Number(id.slice(4))); return true; }
  if (p && id.startsWith('ev:')) { eventChoose(r, p, Number(id.slice(3))); return true; }
  switch (id) {
    case 'force':
      if (g) { r.hp -= forceGateCost(r, g.rating); g.open = true; say(r, 'You force it. Something tears.'); }
      else if (p) { r.hp -= forceCacheCost(r); openCache(r, p, false); }
      return true;
    case 'rest': rest(r, p!); return true;
    case 'attack':
      startFight(r, here(r).nest, r.world.tier, { mobId: -1, tier: r.world.tier, kind: 'nest', reward: false, ambush: false, nestId: p!.id }, false, false, 0);
      return true;
    case 'launch': launch(r); return true;
  }
  return false;
}

function openCache(r: RunState, p: Poi, extra: boolean) {
  p.used = true;
  const roll = withRng(r, (rng) => {
    const implant = rng.next() < 0.15;
    const card = extra || rng.next() < 0.6;
    return { implant, card, bio: extra ? 4 : card ? 2 : 5 + rng.int(5), deck: (rng.next() < 0.7 ? 'tac' : 'exp') as DeckKind };
  });
  r.biomass += roll.bio;
  if (roll.implant) {
    const got = addImplant(r, 'random');
    if (got) { r.notice = { title: 'Cache · implant', text: `${IMPLANTS[got].name}: ${IMPLANTS[got].text} +${roll.bio} biomass.` }; return; }
  }
  if (roll.card) {
    r.reward = { title: 'Cache', options: offerCards(r, roll.deck), deck: roll.deck, biomass: roll.bio, codons: 0 };
    r.mode = 'reward';
  } else say(r, `Cache: +${roll.bio} biomass.`);
}

// ---- Upgrade sites ----

function splice(r: RunState, p: Poi, k: Trait) {
  const before = maxHp(r);
  r.biomass -= somaticCost(r.somaticBought);
  r.somaticBought += 1;
  r.somatic[k] += 1;
  p.buys = (p.buys ?? 0) + 1;
  r.hp += Math.max(0, maxHp(r) - before);
  const o2 = maxO2(r);
  if (r.oxygen > o2) r.oxygen = o2;
  say(r, `The pod floods you. ${TRAIT_INFO[k].name} +1 for this print.`);
}

function terminalBuy(r: RunState, p: Poi, i: number) {
  const o = p.offer?.[i];
  if (!o) return;
  const [deck, id] = o.split(':');
  r.biomass -= TERMINAL_PRICE;
  p.buys = (p.buys ?? 0) + 1;
  p.offer = p.offer!.filter((_, k) => k !== i);
  const inst = { uid: r.nextUid++, id };
  if (deck === 'tac') r.tac.push(inst);
  else { r.exp.push(inst); r.expDiscard.push(inst.uid); }
  say(r, `The terminal prints ${CARDS[id].name}.`);
}

export function exciseCost(r: RunState): number {
  return 4 + 2 * r.excised;
}

/** Can this card be cut? Decks keep a minimum size. */
export function canExcise(r: RunState, deck: DeckKind, uid: number): boolean {
  const list = deck === 'tac' ? r.tac : r.exp;
  const min = deck === 'tac' ? 5 : 3;
  return list.length > min && list.some((c) => c.uid === uid) && r.biomass >= exciseCost(r);
}

export function excise(r: RunState, deck: DeckKind, uid: number): boolean {
  if (!canExcise(r, deck, uid)) return false;
  r.biomass -= exciseCost(r);
  r.excised += 1;
  if (deck === 'tac') r.tac = r.tac.filter((c) => c.uid !== uid);
  else {
    const name = CARDS[r.exp.find((c) => c.uid === uid)!.id].name;
    r.exp = r.exp.filter((c) => c.uid !== uid);
    r.expHand = r.expHand.filter((u) => u !== uid);
    r.expDraw = r.expDraw.filter((u) => u !== uid);
    r.expDiscard = r.expDiscard.filter((u) => u !== uid);
    say(r, `${name} is cut out.`);
    return true;
  }
  say(r, 'The bay hums. One less technique to carry.');
  return true;
}

// ---- Implants, logs, events ----

/** Adds an implant (or a random one you lack). Returns its id, or null if you have them all. */
export function addImplant(r: RunState, id: string): string | null {
  let pick = id;
  if (id === 'random' || r.implants.includes(id)) {
    const free = IMPLANT_POOL.filter((q) => !r.implants.includes(q));
    if (!free.length) return null;
    pick = withRng(r, (rng) => rng.pick(free));
  }
  const before = maxHp(r);
  r.implants.push(pick);
  const after = maxHp(r);
  if (after > before) r.hp += after - before;
  r.hp = Math.min(r.hp, after);
  r.oxygen = Math.min(r.oxygen, maxO2(r));
  return pick;
}

function findLog(r: RunState, id: string): boolean {
  if (r.logs.includes(id)) return false;
  r.logs.push(id);
  if (!r.knownLogs.includes(id)) { r.codons += LOG_CODONS; return true; }
  return false;
}

function eventChoose(r: RunState, p: Poi, i: number) {
  const ev = findEvent(p.event)!;
  const o = ev.options[i];
  if (!o || p.used) return;
  p.used = true;
  const t = runTraits(r);
  const ok = !o.check || withRng(r, (rng) => rng.next() < checkChance(t[o.check!.t], o.check!.at));
  const out: Outcome = ok ? o.win : o.lose ?? { text: 'Nothing happens.' };
  const lines = [out.text];
  const mh = () => maxHp(r);
  if (out.biomass) { r.biomass += out.biomass; lines.push(`+${out.biomass} biomass.`); }
  if (out.o2) { r.oxygen = Math.min(maxO2(r), r.oxygen + out.o2); lines.push(`+${out.o2} oxygen.`); }
  if (out.codons) { r.codons += out.codons; lines.push(`+${out.codons} Codons.`); }
  if (out.somatic) {
    const k = out.somatic === 'random' ? withRng(r, (rng) => rng.pick(TRAITS.filter((q) => r.somatic[q] < SOMATIC_CAP))) : out.somatic;
    if (k && r.somatic[k] < SOMATIC_CAP) {
      const before = mh();
      r.somatic[k] += 1;
      r.hp += Math.max(0, mh() - before);
      lines.push(`${TRAIT_INFO[k].name} +1 for this print.`);
    }
  }
  if (out.implant) {
    const got = addImplant(r, out.implant);
    if (got) lines.push(`Implant: ${IMPLANTS[got].name}. ${IMPLANTS[got].text}`);
  }
  if (out.hp) {
    r.hp = Math.min(mh(), r.hp + out.hp);
    lines.push(out.hp > 0 ? `You mend ${out.hp}.` : `−${-out.hp} integrity.`);
  }
  if (out.loseCard && r.tac.length > 5) {
    const lost = withRng(r, (rng) => rng.pick(r.tac));
    r.tac = r.tac.filter((c) => c !== lost);
    lines.push(`${CARDS[lost.id].name} is gone from your deck.`);
  }
  if (out.log) {
    const fresh = findLog(r, out.log);
    lines.push(`Log found: “${LOGS[out.log].title}”${fresh ? ` (+${LOG_CODONS} Codons)` : ''}. ${LOGS[out.log].text}`);
  }
  r.notice = { title: `${ev.title} · ${ok ? (o.check ? 'success' : o.label) : 'failed'}`, text: lines.join(' ') };
  if (r.hp <= 0) { die(r, `${here(r).name} keeps you.`); return; }
  if (out.card) {
    r.reward = { title: ev.title, options: offerCards(r, out.card), deck: out.card, biomass: 0, codons: 0 };
    r.mode = 'reward';
  }
}

function rest(r: RunState, p: Poi) {
  const t = runTraits(r);
  const mh = maxHp(r);
  p.used = true;
  const heal = Math.floor(mh * 0.25) + t.met;
  r.hp = Math.min(mh, r.hp + heal);
  r.oxygen = maxO2(r);
  drawExp(r, exploreHandSize(t));
  for (const z of r.world.zones) if (z.id !== p.zone) respawnZone(r, z.id);
  say(r, `You rest. +${heal} integrity. Somewhere, things stir again.`);
}

function launch(r: RunState) {
  r.codons += 10 * r.world.tier;
  say(r, `The ship lifts off ${here(r).name}.`);
  r.mode = chartOptions(r).some((o) => o.state === 'open') ? 'chart' : 'won';
}

// ---- The star chart ----

export interface ChartEntry {
  id: string;
  name: string;
  pitch: string;
  state: 'open' | 'visited' | 'lost' | 'unknown';
}

/** Where the ship can go next. Tier comes from the landing number, not the planet. */
export function chartOptions(r: RunState): ChartEntry[] {
  const known = new Set([...r.knownPlanets, ...r.revealed]);
  return Object.values(PLANETS).filter((p) => p.id !== 'derelict').map((p) => ({
    id: p.id,
    name: p.name,
    pitch: p.pitch,
    state: r.visited.includes(p.id) ? 'visited' : p.locked ? 'lost' : known.has(p.id) ? 'open' : 'unknown',
  }));
}

/** Land on the next planet: a new map one tier higher, same body, same decks. */
export function land(r: RunState, id: string): boolean {
  if (r.mode !== 'chart' || !chartOptions(r).some((o) => o.id === id && o.state === 'open')) return false;
  r.landing += 1;
  r.planet = id;
  r.visited.push(id);
  const w = generateWorld((r.seed + r.landing * 1013) >>> 0, r.landing, id);
  r.world = w;
  r.x = w.ship.x;
  r.y = w.ship.y;
  r.facing = [0, -1];
  r.steps = 0;
  r.storm = 0;
  r.stormedZones = [];
  r.zonesVisited = [w.landingZone];
  r.sealSteps = 0;
  r.stalk = false;
  r.flarePower = 0;
  r.beacons = [];
  r.bossDead = false;
  const mh = maxHp(r);
  r.hp = Math.min(mh, r.hp + Math.floor(mh * 0.3));
  r.oxygen = maxO2(r);
  drawExp(r, exploreHandSize(runTraits(r)));
  r.mode = 'explore';
  reveal(r);
  const P = planet(id);
  say(r, `The ship comes down on ${P.name}. Landing ${r.landing}, tier ${r.landing}.${P.twistText ? ` ${P.twistText}` : ''}`);
  return true;
}

/** Stop here and go home with what you have. */
export function goHome(r: RunState) {
  if (r.mode === 'chart') r.mode = 'won';
}

function die(r: RunState, s: string) {
  r.hp = 0;
  r.mode = 'dead';
  say(r, s);
}

// ---- Fast travel ----

export function travelPoints(r: RunState): { x: number; y: number; label: string }[] {
  return [{ x: r.world.ship.x, y: r.world.ship.y, label: 'Ship' }, ...r.beacons.map((b, i) => ({ x: b.x, y: b.y, label: `Beacon ${i + 1}` }))];
}

export function travel(r: RunState, x: number, y: number): boolean {
  if (r.mode !== 'explore' || !travelPoints(r).some((p) => p.x === x && p.y === y)) return false;
  if (r.world.mobs.some((m) => m.alive && m.alerted)) { say(r, 'Something is hunting you. You can’t travel now.'); return false; }
  r.x = x;
  r.y = y;
  if (x === r.world.ship.x && y === r.world.ship.y) {
    const t = runTraits(r);
    r.oxygen = maxO2(r);
    drawExp(r, exploreHandSize(t));
  }
  reveal(r);
  return true;
}

export function isWall(r: RunState, x: number, y: number): boolean {
  return tileAt(r.world, x, y) === T_WALL;
}

/** Autoplay one battle turn (tests, balance sims). */
export function bAuto(r: RunState): void {
  if (!r.battle) return;
  withRng(r, (rng) => botTurn(r.battle!, rng));
  afterBattleOp(r);
}
