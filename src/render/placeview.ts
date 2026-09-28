import { INK } from './palette';
import { noise } from './sketch';
import type { Theme } from './theme';
import { isDark, inStorm, type RunState } from '../core/run';
import { gateAt, idx, T_GATE, T_HAZARD, T_WALL, type Poi, type World } from '../world/gen';

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

  /** Set up the camera for transition progress k (0..1). */
  setCamera(at: FightAt, W: number, H: number, k: number) {
    const e = ease(clamp(k));
    const T = W / 11;
    this.F = W * 0.9;
    const px = at.x + 0.5;
    const py = at.y + 0.5;
    // yaw: from map-north toward the foe, the short way round
    const a0 = Math.atan2(-1, 0);
    let a1 = Math.atan2(at.fy, at.fx);
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
    this.camX = px - at.fx * BACK * e;
    this.camY = py - at.fy * BACK * e;
    this.cx = lerp(W / 2, W * 0.7, e);
    this.cy = lerp(H / 2, H * 0.52, e);
  }

  /** Camera-space depth and screen position of a world point (tiles; z up). */
  project(wx: number, wy: number, z: number): { x: number; y: number; d: number } | null {
    const dx = wx - this.camX;
    const dy = wy - this.camY;
    const side = dx * this.rx + dy * this.ry;
    const fwd = dx * this.fx + dy * this.fy;
    const zz = z - this.hc;
    const d = fwd * this.cosP - zz * this.sinP;
    if (d < NEAR) return null;
    const up = fwd * this.sinP + zz * this.cosP;
    return { x: this.cx + (side * this.F) / d, y: this.cy - (up * this.F) / d, d };
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
    this.setCamera(at, W, H, k);
    const e = ease(clamp(k));
    const wallH = th.crystals ? 2.1 : 1.7;

    // tiles the fighters stand on always read as open floor
    const keep = new Set<number>();
    const mark = (ahead: number, side: number) => {
      const x = Math.floor(at.x + 0.5 + at.fx * ahead - at.fy * side);
      const y = Math.floor(at.y + 0.5 + at.fy * ahead + at.fx * side);
      if (x >= 0 && y >= 0 && x < w.w && y < w.h) keep.add(idx(w, x, y));
    };
    mark(0, 0);
    mark(1, 0);
    mark(2, -0.8);
    mark(2, 0.8);

    type Item = { d: number; draw: () => void };
    const floors: Item[] = [];
    const solids: Item[] = [];
    const reach = Math.ceil(FAR);
    for (let y = at.y - reach; y <= at.y + reach; y++) {
      for (let x = at.x - reach; x <= at.x + reach; x++) {
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        const i = idx(w, x, y);
        const c = this.project(x + 0.5, y + 0.5, 0);
        if (!c || c.d > FAR + 2) continue;
        let tile = w.tiles[i];
        if (keep.has(i)) tile = tile === T_WALL ? 1 : tile;
        if (tile === T_WALL) {
          solids.push({ d: c.d, draw: () => this.box(ctx, w, x, y, wallH, th.wallFace, th.wallTop, th.wallEdge, th, true) });
          continue;
        }
        floors.push({ d: c.d, draw: () => this.floor(ctx, x, y, tile === T_HAZARD ? th.hazard : null, th, t) });
        if (this.hc < wallH) floors.push({ d: c.d, draw: () => this.ceiling(ctx, x, y, wallH, th, t) });
        if (tile === T_GATE) {
          const g = gateAt(w, x, y)!;
          if (!g.open) {
            if (g.kind === 'door') solids.push({ d: c.d, draw: () => this.box(ctx, w, x, y, wallH, '#3a3226', '#5a4a33', INK.sodium, th, false) });
            else solids.push({ d: c.d, draw: () => this.box(ctx, w, x, y, 0.45, th.debris, th.debris, INK.boneDim, th, false) });
          }
        }
      }
    }
    for (const p of w.pois) {
      if (p.hidden || (p.kind === 'nest' && p.used)) continue;
      if (Math.abs(p.x - at.x) > reach || Math.abs(p.y - at.y) > reach) continue;
      const c = this.project(p.x + 0.5, p.y + 0.5, 0);
      if (!c) continue;
      solids.push({ d: c.d - 0.01, draw: () => this.prop(ctx, p, t, th) });
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

  /** Near things fade so they never hide the fight; far things sink into the dark. */
  private nearFade(d: number): number {
    return clamp((d - 1.2) / 1.8);
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
    const pts = [this.project(x, y, 0), this.project(x + 1, y, 0), this.project(x + 1, y + 1, 0), this.project(x, y + 1, 0)];
    if (pts.some((p) => !p)) return;
    const q = pts as { x: number; y: number; d: number }[];
    const d = this.far(x + 0.5, y + 0.5);
    ctx.fillStyle = th.floor;
    poly(ctx, q);
    ctx.fill();
    ctx.strokeStyle = th.floorLine;
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

  /** The ceiling over open ground: dark panels, the odd lamp (a lab) or hanging crystal (a cave). */
  private ceiling(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, th: Theme, t: number) {
    const pts = [this.project(x, y, h), this.project(x + 1, y, h), this.project(x + 1, y + 1, h), this.project(x, y + 1, h)];
    if (pts.some((p) => !p)) return;
    const q = pts as { x: number; y: number; d: number }[];
    ctx.fillStyle = th.wallFace;
    poly(ctx, q);
    ctx.fill();
    ctx.strokeStyle = th.floor;
    ctx.lineWidth = 1;
    ctx.stroke();
    const c = this.project(x + 0.5, y + 0.5, h);
    if (c && (x * 7 + y * 13) % 9 === 0) {
      const s = this.F / c.d;
      if (th.crystals) {
        ctx.fillStyle = th.wallEdge;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(c.x - s * 0.08, c.y);
        ctx.lineTo(c.x, c.y + s * 0.5);
        ctx.lineTo(c.x + s * 0.08, c.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = th.accent;
        ctx.globalAlpha = 0.6 + 0.35 * Math.max(0, Math.sin(t * 1.7 + x * 3 + y));
        ctx.fillRect(c.x - s * 0.18, c.y - s * 0.03, s * 0.36, s * 0.06);
        ctx.globalAlpha = 1;
      }
    }
    this.fogOver(ctx, q, this.far(x + 0.5, y + 0.5), th);
  }

  /** A raised tile: side faces toward the camera (and the top when seen from above). */
  private box(ctx: CanvasRenderingContext2D, w: World, x: number, y: number, h: number, face: string, top: string, edge: string, th: Theme, isWall: boolean) {
    const c = this.project(x + 0.5, y + 0.5, h / 2);
    if (!c) return;
    const alpha = this.nearFade(c.d);
    if (alpha <= 0.02) return;
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
      const pts = [this.project(x0, y0, 0), this.project(x1, y1, 0), this.project(x1, y1, h), this.project(x0, y0, h)];
      if (pts.some((p) => !p)) continue;
      const q = pts as { x: number; y: number; d: number }[];
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
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(q[2].x, q[2].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.stroke();
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
      const pts = [this.project(x, y, h), this.project(x + 1, y, h), this.project(x + 1, y + 1, h), this.project(x, y + 1, h)];
      if (!pts.some((p) => !p)) {
        const q = pts as { x: number; y: number; d: number }[];
        ctx.fillStyle = top;
        poly(ctx, q);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.stroke();
        this.fogOver(ctx, q, this.far(x + 0.5, y + 0.5), th);
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

  /** Objects on the floor, drawn as upright props facing the camera. */
  private prop(ctx: CanvasRenderingContext2D, p: Poi, t: number, th: Theme) {
    const g = this.project(p.x + 0.5, p.y + 0.5, 0);
    if (!g) return;
    const s = this.F / g.d;
    const alpha = this.nearFade(g.d);
    if (alpha <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(g.x, g.y);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeStyle = INK.bone;
    switch (p.kind) {
      case 'vent': {
        ctx.fillStyle = '#1c1e21';
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.05, s * 0.36, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (!p.used) {
          for (let k = 0; k < 3; k++) {
            const ph = (t * 0.6 + k / 3) % 1;
            ctx.fillStyle = `rgba(216,207,184,${0.35 * (1 - ph)})`;
            ctx.beginPath();
            ctx.arc(Math.sin(ph * 6 + k) * s * 0.1, -s * 0.15 - ph * s * 0.9, s * (0.1 + ph * 0.15), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'cache':
        ctx.fillStyle = p.used ? '#24262a' : INK.boneDim;
        ctx.fillRect(-s * 0.3, -s * 0.45, s * 0.6, s * 0.45);
        ctx.strokeRect(-s * 0.3, -s * 0.45, s * 0.6, s * 0.45);
        if (!p.used) {
          ctx.fillStyle = INK.sodium;
          ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.06);
        }
        break;
      case 'pod':
        ctx.fillStyle = INK.cryo;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillRect(-s * 0.2, -s * 1.0, s * 0.4, s * 0.95);
        ctx.globalAlpha = alpha;
        ctx.strokeRect(-s * 0.2, -s * 1.0, s * 0.4, s * 0.95);
        ctx.fillStyle = INK.fleshDark;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.55, s * 0.09, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'terminal':
        ctx.fillStyle = INK.hullLit;
        ctx.fillRect(-s * 0.28, -s * 0.75, s * 0.56, s * 0.75);
        ctx.strokeRect(-s * 0.28, -s * 0.75, s * 0.56, s * 0.75);
        ctx.fillStyle = INK.toxin;
        ctx.globalAlpha = alpha * (0.6 + 0.3 * Math.sin(t * 5));
        ctx.fillRect(-s * 0.2, -s * 0.66, s * 0.4, s * 0.28);
        break;
      case 'surgery':
        ctx.fillStyle = INK.boneDim;
        ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.1);
        ctx.beginPath();
        ctx.moveTo(-s * 0.32, -s * 0.3);
        ctx.lineTo(-s * 0.32, 0);
        ctx.moveTo(s * 0.32, -s * 0.3);
        ctx.lineTo(s * 0.32, 0);
        ctx.moveTo(0, -s * 0.4);
        ctx.lineTo(0, -s * 1.0);
        ctx.stroke();
        ctx.fillStyle = INK.sodium;
        ctx.beginPath();
        ctx.arc(0, -s * 1.0, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'nest':
        ctx.fillStyle = INK.fleshDark;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.28, s * 0.42 * (1 + Math.sin(t * 3) * 0.05), s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'event':
        if (!p.used) {
          ctx.fillStyle = INK.signal;
          ctx.globalAlpha = alpha * (0.3 + 0.2 * Math.sin(t * 3));
          ctx.beginPath();
          ctx.ellipse(0, -s * 0.45, s * 0.35, s * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'ship': {
        ctx.fillStyle = INK.hullLit;
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, 0);
        ctx.lineTo(-s * 0.5, -s * 0.7);
        ctx.lineTo(0, -s * 1.1);
        ctx.lineTo(s * 0.5, -s * 0.7);
        ctx.lineTo(s * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
    void th;
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
