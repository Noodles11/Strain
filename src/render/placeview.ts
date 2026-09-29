import { INK } from './palette';
import { noise } from './sketch';
import { SNOW, SNOW_SHADE, snowAt, type Theme } from './theme';
import { isDark, inStorm, type RunState } from '../core/run';
import { gateAt, idx, T_FLOOR, T_GATE, T_HAZARD, T_WALL, type World } from '../world/gen';

/** Where a fight happens: the clone's tile and the direction it faces (toward the foe). */
export interface FightAt {
  x: number;
  y: number;
  fx: number;
  fy: number;
}

export interface Ground {
  x: number;
  y: number;
  /** Pixels per tile at this point. */
  px: number;
  depth: number;
}

/** Final battle camera, in tiles. */
const BACK = 3;
const EYE = 0.6;
const NEAR = 0.25;
const FAR = 11;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/**
 * The fight's real surroundings in simple 3D: the map tiles around the clone as a floor,
 * walls raised into boxes, doors, debris and objects as props. `k` runs the entry
 * transition: 0 is the overworld's top-down view, 1 the battle view behind the clone.
 */
export class PlaceView {
  private cx = 0;
  private cy = 0;
  private camX = 0;
  private camY = 0;
  private hc = EYE;
  private F = 1;
  private fx = 0;
  private fy = -1;
  private rx = 1;
  private ry = 0;
  private cosP = 1;
  private sinP = 0;
  private e = 0;
  /** Horizontal distance from the final camera to the clone. */
  private reach = BACK;
  private shotKey = '';
  private shot = { off: 0, back: BACK };
  /** Sideways shift of the final view (px), so every fighter fits on screen. */
  pan = 0;

  /**
   * Where the battle camera sits: straight behind the clone if the corridor allows,
   * else swung round to one side (or pulled in) until nothing solid stands between
   * the lens and the fighters.
   */
  private pickShot(w: World, at: FightAt) {
    const key = `${w.seed}:${at.x},${at.y},${at.fx},${at.fy}`;
    if (key === this.shotKey) return;
    this.shotKey = key;
    const px = at.x + 0.5;
    const py = at.y + 0.5;
    const a1 = Math.atan2(at.fy, at.fx);
    const clear = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i <= 12; i++) {
        const x = Math.floor(lerp(x0, x1, i / 12));
        const y = Math.floor(lerp(y0, y1, i / 12));
        if (!openAt(w, x, y)) return false;
      }
      return true;
    };
    // the camera also needs a little room around itself, or a wall face fills the lens
    const roomy = (x: number, y: number) => [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([dx, dy]) => openAt(w, Math.floor(x + dx), Math.floor(y + dy)));
    for (const backs of [[3, 2.5], [2, 1.6]]) {
      for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.0, -1.0]) {
        for (const back of backs) {
          const cx = px - Math.cos(a1 + off) * back;
          const cy = py - Math.sin(a1 + off) * back;
          if (!roomy(cx, cy)) continue;
          if (!clear(cx, cy, px, py) || !clear(cx, cy, px + at.fx, py + at.fy)) continue;
          this.shot = { off, back };
          return;
        }
      }
    }
    this.shot = { off: 0, back: 1.6 };
  }

  /** Back-row spots (tiles ahead, tiles to the right) that stand on open floor, not in a wall. */
  backSlots(w: World, at: FightAt): [number, number][] {
    const cands: [number, number][] = [[2, -0.8], [2, 0.8], [1.3, -0.95], [1.3, 0.95], [2.7, -0.6], [2.7, 0.6], [1.9, -0.45], [1.9, 0.45], [2, 0], [3, 0], [3.5, 0]];
    const out: [number, number][] = [];
    const used: [number, number][] = [[1, 0], [0, 0]];
    for (const [a, s] of cands) {
      const x = Math.floor(at.x + 0.5 + at.fx * a - at.fy * s);
      const y = Math.floor(at.y + 0.5 + at.fy * a + at.fx * s);
      if (!openAt(w, x, y)) continue;
      if (used.some(([ua, us]) => Math.hypot(ua - a, us - s) < 0.85)) continue;
      out.push([a, s]);
      used.push([a, s]);
      if (out.length === 2) break;
    }
    while (out.length < 2) out.push(out.length ? [2, 0.4] : [2, -0.4]);
    return out;
  }

  /** Set up the camera for transition progress k (0..1). */
  setCamera(at: FightAt, W: number, H: number, k: number, w?: World) {
    if (w) this.pickShot(w, at);
    const e = ease(clamp(k));
    this.e = e;
    const T = W / 11;
    this.F = W * 0.9;
    const px = at.x + 0.5;
    const py = at.y + 0.5;
    const { off, back } = this.shot;
    // yaw: from map-north toward the foe, the short way round; a swung camera looks partly back across
    const a0 = Math.atan2(-1, 0);
    let a1 = Math.atan2(at.fy, at.fx) + off * 0.55;
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
    while (a1 - a0 < -Math.PI) a1 += Math.PI * 2;
    const a = lerp(a0, a1, e);
    this.fx = Math.cos(a);
    this.fy = Math.sin(a);
    this.rx = -this.fy;
    this.ry = this.fx;
    const pitch = lerp(Math.PI / 2, 0, e);
    this.cosP = Math.cos(pitch);
    this.sinP = Math.sin(pitch);
    this.hc = lerp(this.F / T, EYE, e);
    const ca = Math.atan2(at.fy, at.fx) + off;
    this.camX = px - Math.cos(ca) * back * e;
    this.camY = py - Math.sin(ca) * back * e;
    this.reach = back;
    this.cx = lerp(W / 2, W * 0.7 + this.pan, e);
    this.cy = lerp(H / 2, H * 0.52, e);
  }

  /** Camera space: right, up, depth. */
  private toCam(wx: number, wy: number, z: number) {
    const dx = wx - this.camX;
    const dy = wy - this.camY;
    const side = dx * this.rx + dy * this.ry;
    const fwd = dx * this.fx + dy * this.fy;
    const zz = z - this.hc;
    return { s: side, u: fwd * this.sinP + zz * this.cosP, d: fwd * this.cosP - zz * this.sinP };
  }

  private toScreen(c: { s: number; u: number; d: number }) {
    return { x: this.cx + (c.s * this.F) / c.d, y: this.cy - (c.u * this.F) / c.d, d: c.d };
  }

  /** Camera-space depth and screen position of a world point (tiles; z up). */
  project(wx: number, wy: number, z: number): { x: number; y: number; d: number } | null {
    const c = this.toCam(wx, wy, z);
    return c.d < NEAR ? null : this.toScreen(c);
  }

  /**
   * A world polygon on screen, cut at the near plane rather than dropped, so tiles and
   * walls right beside the camera still get drawn instead of leaving holes.
   */
  private projPoly(pts: [number, number, number][]): { x: number; y: number; d: number }[] | null {
    const cam = pts.map(([x, y, z]) => this.toCam(x, y, z));
    const out: { s: number; u: number; d: number }[] = [];
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i];
      const b = cam[(i + 1) % cam.length];
      const ain = a.d >= NEAR;
      const bin = b.d >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const k = (NEAR - a.d) / (b.d - a.d);
        out.push({ s: lerp(a.s, b.s, k), u: lerp(a.u, b.u, k), d: NEAR });
      }
    }
    return out.length >= 3 ? out.map((c) => this.toScreen(c)) : null;
  }

  /** A floor point `ahead` tiles in front of the clone and `side` tiles to its right. */
  ground(at: FightAt, ahead: number, side: number): Ground | null {
    const wx = at.x + 0.5 + at.fx * ahead - at.fy * side;
    const wy = at.y + 0.5 + at.fy * ahead + at.fx * side;
    const p = this.project(wx, wy, 0);
    if (!p) return null;
    return { x: p.x, y: p.y, px: this.F / p.d, depth: p.d };
  }

  draw(ctx: CanvasRenderingContext2D, r: RunState, at: FightAt, W: number, H: number, t: number, th: Theme, k: number) {
    const w = r.world;
    this.setCamera(at, W, H, k, w);
    const e = ease(clamp(k));
    const wallH = th.crystals ? 2.1 : 1.7;

    // the clone's and the front foe's tiles always read as open floor (the back row is placed on open tiles)
    const keep = new Set<number>();
    const mark = (ahead: number, side: number) => {
      const x = Math.floor(at.x + 0.5 + at.fx * ahead - at.fy * side);
      const y = Math.floor(at.y + 0.5 + at.fy * ahead + at.fx * side);
      if (x >= 0 && y >= 0 && x < w.w && y < w.h) keep.add(idx(w, x, y));
    };
    mark(0, 0);
    mark(1, 0);

    type Item = { d: number; draw: () => void };
    const floors: Item[] = [];
    const solids: Item[] = [];
    const reach = Math.ceil(FAR);
    for (let y = at.y - reach; y <= at.y + reach; y++) {
      for (let x = at.x - reach; x <= at.x + reach; x++) {
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        const i = idx(w, x, y);
        // tiles straddling the camera still count: their near part gets clipped, not dropped
        const c = this.toCam(x + 0.5, y + 0.5, 0);
        if (c.d < -1 || c.d > FAR + 2) continue;
        let tile = w.tiles[i];
        if (keep.has(i)) tile = tile === T_WALL ? 1 : tile;
        if (tile === T_WALL) {
          solids.push({ d: c.d, draw: () => this.box(ctx, w, x, y, wallH, th.wallFace, th.wallTop, th.wallEdge, th, true) });
          continue;
        }
        floors.push({ d: c.d, draw: () => this.floor(ctx, x, y, tile === T_HAZARD ? th.hazard : null, th, t) });
        if (th.snow && tile === T_FLOOR && !keep.has(i)) {
          for (const s of snowAt(x, y)) {
            const sd = this.toCam(x + s.ox, y + s.oy, 0).d;
            solids.push({ d: sd, draw: () => this.drift(ctx, x + s.ox, y + s.oy, s.r, th) });
          }
        }
        if (this.hc < wallH) floors.push({ d: c.d, draw: () => this.ceiling(ctx, x, y, wallH, th) });
        if (tile === T_GATE) {
          const g = gateAt(w, x, y)!;
          // closed doors are part of the corridor; debris and floor objects stay out of the fight
          if (g.kind === 'door' && !g.open) solids.push({ d: c.d, draw: () => this.box(ctx, w, x, y, wallH, '#3a3226', '#5a4a33', INK.sodium, th, false) });
        }
      }
    }
    floors.sort((a, b) => b.d - a.d).forEach((q) => q.draw());
    solids.sort((a, b) => b.d - a.d).forEach((q) => q.draw());

    // the room's mood: darkness around the clone, storm over everything
    if (e > 0.5 && isDark(r, at.x, at.y)) {
      const g = ctx.createRadialGradient(W * 0.3, H * 0.9, W * 0.15, W * 0.45, H * 0.7, W * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.7 * (e - 0.5) * 2})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (inStorm(r, at.x, at.y)) {
      ctx.fillStyle = 'rgba(122,74,179,0.2)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(216,207,184,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const x = (i * 97.3 + t * 40) % W;
        const y = (i * 53.1 + t * 520) % H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 16);
      }
      ctx.stroke();
    }
  }

  /**
   * Walls that stand between the lens and the fighters fade to a ghost; walls beside
   * the clone or the enemies stay solid.
   */
  private occluderFade(x: number, y: number): number {
    const c = this.toCam(x + 0.5, y + 0.5, this.hc);
    const fwd = c.d;
    const blocks = fwd < this.reach + 0.2 && Math.abs(c.s) < 0.55 + 0.25 * clamp(fwd / this.reach);
    return blocks ? lerp(1, 0.15, this.e) : 1;
  }

  /** Distance along the ground from the camera, so the top-down view isn't fogged. */
  private far(x: number, y: number): number {
    return Math.hypot(x - this.camX, y - this.camY);
  }

  private fogOver(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], dist: number, th: Theme) {
    const fog = clamp((dist - 5) / (FAR - 5)) * 0.85;
    if (fog <= 0.02) return;
    ctx.save();
    ctx.globalAlpha *= fog;
    ctx.fillStyle = th.skyTop;
    poly(ctx, pts);
    ctx.fill();
    ctx.restore();
  }

  private floor(ctx: CanvasRenderingContext2D, x: number, y: number, hazard: string | null, th: Theme, t: number) {
    const q = this.projPoly([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]);
    if (!q) return;
    const d = this.far(x + 0.5, y + 0.5);
    ctx.fillStyle = th.floor;
    poly(ctx, q);
    ctx.fill();
    // a solid floor strokes in its own colour, which also hides the seams between tiles
    ctx.strokeStyle = th.solidFloor ? th.floor : th.floorLine;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (hazard) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.12 * Math.sin(t * 2 + x + y * 0.7);
      ctx.fillStyle = hazard;
      poly(ctx, q);
      ctx.fill();
      ctx.restore();
    }
    this.fogOver(ctx, q, d, th);
  }

  /** A low snow drift: stacked rings, each smaller and brighter, so it reads as a mound. */
  private drift(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, th: Theme) {
    const layers: [number, number, string][] = [[0, 1, SNOW_SHADE], [0.35, 0.75, SNOW], [0.6, 0.45, SNOW]];
    for (const [hz, rr, col] of layers) {
      const ring: [number, number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const wob = 1 + 0.12 * Math.sin(a * 3 + cx * 5 + cy * 3);
        ring.push([cx + Math.cos(a) * r * rr * wob, cy + Math.sin(a) * r * rr * wob, hz * r * 0.8]);
      }
      const q = this.projPoly(ring);
      if (!q) return;
      ctx.fillStyle = col;
      poly(ctx, q);
      ctx.fill();
      this.fogOver(ctx, q, this.far(cx, cy), th);
    }
  }

  /** The ceiling over open ground: plain dark panels. */
  private ceiling(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, th: Theme) {
    const q = this.projPoly([[x, y, h], [x + 1, y, h], [x + 1, y + 1, h], [x, y + 1, h]]);
    if (!q) return;
    ctx.fillStyle = th.wallFace;
    poly(ctx, q);
    ctx.fill();
    ctx.strokeStyle = th.floor;
    ctx.lineWidth = 1;
    ctx.stroke();
    this.fogOver(ctx, q, this.far(x + 0.5, y + 0.5), th);
  }

  /** A raised tile: side faces toward the camera (and the top when seen from above). */
  private box(ctx: CanvasRenderingContext2D, w: World, x: number, y: number, h: number, face: string, top: string, edge: string, th: Theme, isWall: boolean) {
    const alpha = this.occluderFade(x, y);
    ctx.save();
    ctx.globalAlpha = alpha;
    const sides: [number, number, number, number, number, number][] = [
      // x0, y0, x1, y1, normal x, normal y
      [x, y, x + 1, y, 0, -1],
      [x + 1, y, x + 1, y + 1, 1, 0],
      [x + 1, y + 1, x, y + 1, 0, 1],
      [x, y + 1, x, y, -1, 0],
    ];
    for (const [x0, y0, x1, y1, nx, ny] of sides) {
      // skip faces buried against another wall
      const ax = x + nx;
      const ay = y + ny;
      if (isWall && ax >= 0 && ay >= 0 && ax < w.w && ay < w.h && w.tiles[idx(w, ax, ay)] === T_WALL) continue;
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      if ((this.camX - mx) * nx + (this.camY - my) * ny <= 0) continue;
      const q = this.projPoly([[x0, y0, 0], [x1, y1, 0], [x1, y1, h], [x0, y0, h]]);
      if (!q) continue;
      const full = q.length === 4 && q.every((p) => p.d > NEAR);
      // walls take the map's wall-top tone, shaded by which way they face
      const shade = 0.45 + (ny > 0 ? 0.3 : ny < 0 ? 0 : 0.15) + (nx > 0 ? 0.1 : 0);
      ctx.fillStyle = face;
      poly(ctx, q);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= shade;
      ctx.fillStyle = top;
      ctx.fill();
      ctx.restore();
      if (isWall) {
        // panel seams and a darker skirting line
        ctx.strokeStyle = face;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const f of [1 / 3, 2 / 3]) {
          const a = this.project(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0);
          const b2 = this.project(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, h);
          if (a && b2) { ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); }
        }
        const s0 = this.project(x0, y0, h * 0.12);
        const s1 = this.project(x1, y1, h * 0.12);
        if (s0 && s1) { ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); }
        ctx.stroke();
      }
      if (full) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(q[2].x, q[2].y);
        ctx.lineTo(q[3].x, q[3].y);
        ctx.stroke();
      }
      if (!isWall && edge === INK.sodium) {
        // a door's hazard band
        const a = this.project(x0, y0, h * 0.8);
        const b = this.project(x1, y1, h * 0.8);
        const a2 = this.project(x1, y1, h * 0.7);
        const b2 = this.project(x0, y0, h * 0.7);
        if (a && b && a2 && b2) {
          ctx.fillStyle = INK.sodium;
          poly(ctx, [a, b, a2, b2]);
          ctx.fill();
        }
      }
      this.fogOver(ctx, q, this.far(mx, my), th);
    }
    if (this.hc > h) {
      const q = this.projPoly([[x, y, h], [x + 1, y, h], [x + 1, y + 1, h], [x, y + 1, h]]);
      if (q) {
        ctx.fillStyle = top;
        poly(ctx, q);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.stroke();
        this.fogOver(ctx, q, this.far(x + 0.5, y + 0.5), th);
      }
    }
    if (isWall && th.reeds) {
      // hanging moss along the top of the wall faces toward the camera
      const base = this.project(x + 0.5, y + 0.5, h);
      if (base) {
        const s = this.F / base.d;
        ctx.strokeStyle = th.wallEdge;
        ctx.globalAlpha = alpha * 0.6;
        ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ox = (i - 2) * s * 0.18 + noise(x * 3 + y + i) * s * 0.05;
          const len = s * (0.15 + 0.25 * (noise(x + y * 5 + i * 7) * 0.5 + 0.5));
          ctx.moveTo(base.x + ox, base.y);
          ctx.lineTo(base.x + ox + noise(i + x) * s * 0.03, base.y + len);
        }
        ctx.stroke();
      }
    }
    if (isWall && th.crystals && noise(x * 7.1 + y * 3.3) > 0.3) {
      // crystals growing from the rock
      const base = this.project(x + 0.5, y + 0.5, h);
      if (base) {
        const s = this.F / base.d;
        ctx.fillStyle = th.wallEdge;
        ctx.globalAlpha = alpha * 0.85;
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * s * 0.15;
          const hh = s * (0.3 + 0.25 * (noise(x + i * 5 + y) * 0.5 + 0.5));
          ctx.beginPath();
          ctx.moveTo(base.x + ox - s * 0.06, base.y);
          ctx.lineTo(base.x + ox, base.y - hh);
          ctx.lineTo(base.x + ox + s * 0.06, base.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

/** Floor a camera or a fighter can stand on: not rock, not a shut gate, not off the map. */
function openAt(w: World, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
  const t = w.tiles[idx(w, x, y)];
  if (t === T_WALL) return false;
  if (t === T_GATE) return !!gateAt(w, x, y)?.open;
  return true;
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
