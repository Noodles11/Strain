import { CREATURE_SIZE, drawCreature } from './creatures';
import { drawCloneTop } from './clone';
import { INK } from './palette';
import { noise } from './sketch';
import { SNOW, SNOW_SHADE, snowAt, theme } from './theme';
import { inStorm, inView, isDark, type RunState } from '../core/run';
import { gateAt, idx, T_FLOOR, T_GATE, T_HAZARD, T_WALL, type Mob, type Poi } from '../world/gen';


export const TILES_ACROSS = 11;
/** Tiles around the clone that are never fogged. */
export const CLEAR_RADIUS = 2;

/** Top-down, three-quarter view of a planet map. */
export class WorldView {
  camX = 0;
  camY = 0;
  private snapped = false;
  T = 32;
  W = 0;
  H = 0;

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.T = Math.floor(W / TILES_ACROSS);
  }

  snap() {
    this.snapped = false;
  }

  /** Screen position of a tile's top-left corner. */
  sx(x: number) { return (x - this.camX) * this.T + this.W / 2 - this.T / 2; }
  sy(y: number) { return (y - this.camY) * this.T + this.H * 0.46 - this.T / 2; }

  tileAt(px: number, py: number): [number, number] {
    const x = Math.floor((px - this.W / 2 + this.T / 2) / this.T + this.camX);
    const y = Math.floor((py - this.H * 0.46 + this.T / 2) / this.T + this.camY);
    return [x, y];
  }

  draw(ctx: CanvasRenderingContext2D, r: RunState, t: number, dt: number, px: number, py: number, walking: boolean, path: [number, number][]) {
    const w = r.world;
    const T = this.T;
    const th = theme(w.planet);
    if (!this.snapped) { this.camX = px; this.camY = py; this.snapped = true; }
    const k = 1 - Math.exp(-dt * 10);
    this.camX += (px - this.camX) * k;
    this.camY += (py - this.camY) * k;

    ctx.fillStyle = INK.void;
    ctx.fillRect(0, 0, this.W, this.H);

    const cols = Math.ceil(TILES_ACROSS / 2) + 2;
    const rows = Math.ceil(this.H / T / 2) + 3;
    const x0 = Math.floor(this.camX) - cols;
    const x1 = Math.ceil(this.camX) + cols;
    const y0 = Math.floor(this.camY) - rows;
    const y1 = Math.ceil(this.camY) + rows;
    const lift = T * 0.42;

    const mobsByRow = new Map<number, Mob[]>();
    for (const m of w.mobs) {
      if (!m.alive) continue;
      if (m.kind === 'ambush' && !m.spotted) continue;
      if (!inView(r, m.x, m.y) && m.kind !== 'boss') continue;
      if (!w.seen[idx(w, m.x, m.y)]) continue;
      const list = mobsByRow.get(m.y) ?? [];
      list.push(m);
      mobsByRow.set(m.y, list);
    }
    const poisByRow = new Map<number, Poi[]>();
    for (const p of w.pois) {
      if (p.hidden || !w.seen[idx(w, p.x, p.y)]) continue;
      const list = poisByRow.get(p.y) ?? [];
      list.push(p);
      poisByRow.set(p.y, list);
    }

    for (let y = y0; y <= y1; y++) {
      // floors
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        const i = idx(w, x, y);
        // terrain is always drawn; fog is a hatch on top
        const tile = w.tiles[i];
        if (tile === T_WALL) continue;
        const X = this.sx(x);
        const Y = this.sy(y);
        ctx.fillStyle = th.floor;
        ctx.fillRect(X, Y, T + 0.5, T + 0.5);
        if (th.solidFloor || th.snow) {
          if (th.snow && tile === T_FLOOR) {
            for (const s of snowAt(x, y)) {
              const sx = X + s.ox * T;
              const sy = Y + s.oy * T;
              ctx.fillStyle = SNOW_SHADE;
              ctx.beginPath();
              ctx.ellipse(sx, sy + s.r * T * 0.15, s.r * T, s.r * T * 0.8, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = SNOW;
              ctx.beginPath();
              ctx.ellipse(sx - s.r * T * 0.12, sy - s.r * T * 0.1, s.r * T * 0.75, s.r * T * 0.6, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        if (!th.solidFloor) {
          ctx.strokeStyle = th.floorLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(X + 1.5, Y + 1.5, T - 3, T - 3);
        }
        if (!th.solidFloor && (x * 7 + y * 13) % 5 === 0) {
          ctx.fillStyle = th.floorLine;
          ctx.fillRect(X + 4, Y + 4, 2, 2);
          ctx.fillRect(X + T - 6, Y + T - 6, 2, 2);
        }
        if (tile === T_HAZARD) {
          const g = 0.35 + 0.15 * Math.sin(t * 2 + x + y * 0.7);
          ctx.fillStyle = th.hazard;
          ctx.globalAlpha = g;
          ctx.beginPath();
          ctx.ellipse(X + T / 2 + noise(i) * T * 0.1, Y + T / 2, T * 0.46, T * 0.36, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = th.hazardFleck;
          ctx.fillRect(X + T * (0.3 + 0.2 * noise(i + 1)), Y + T * 0.45, 2, 2);
        }
        if (tile === T_GATE) this.drawGate(ctx, r, x, y, X, Y, t, th.debris);
      }
      // path dots
      for (const [qx, qy] of path) {
        if (qy !== y) continue;
        ctx.fillStyle = INK.bone;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(this.sx(qx) + T / 2 - 2, this.sy(qy) + T / 2 - 2, 4, 4);
        ctx.globalAlpha = 1;
      }
      // walls: face then raised top
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        const i = idx(w, x, y);
        if (w.tiles[i] !== T_WALL) continue;
        const X = this.sx(x);
        const Y = this.sy(y);
        const below = y + 1 < w.h ? w.tiles[idx(w, x, y + 1)] : T_WALL;
        if (below !== T_WALL) {
          ctx.fillStyle = th.wallFace;
          ctx.fillRect(X, Y + T - lift, T + 0.5, lift + 0.5);
          ctx.fillStyle = '#23262a';
          ctx.fillRect(X, Y + T - 3, T + 0.5, 3);
        }
        ctx.fillStyle = th.wallTop;
        ctx.fillRect(X, Y - lift, T + 0.5, T + 0.5);
        ctx.fillStyle = th.wallEdge;
        if (y > 0 && w.tiles[idx(w, x, y - 1)] !== T_WALL) ctx.fillRect(X, Y - lift, T + 0.5, 2);
        if (below !== T_WALL) {
          ctx.fillStyle = th.wallLip;
          ctx.fillRect(X, Y + T - lift - 2, T + 0.5, 2);
        }
        if (th.crystals && noise(i * 3.1) > 0.35) {
          // a crystal cluster growing out of the rock
          const cx0 = X + T * (0.3 + 0.4 * (noise(i) * 0.5 + 0.5));
          const base = Y - lift + T * 0.7;
          ctx.fillStyle = th.wallEdge;
          ctx.globalAlpha = 0.85;
          for (let q = 0; q < 3; q++) {
            const hx = cx0 + (q - 1) * T * 0.12;
            const hh = T * (0.35 + 0.25 * (noise(i + q * 7) * 0.5 + 0.5));
            ctx.beginPath();
            ctx.moveTo(hx - T * 0.06, base);
            ctx.lineTo(hx + noise(i + q) * T * 0.05, base - hh);
            ctx.lineTo(hx + T * 0.06, base);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      // things standing in this row
      for (const p of poisByRow.get(y) ?? []) this.drawPoi(ctx, r, p, t);
      for (const b of r.beacons) if (b.y === y) this.drawBeacon(ctx, b.x, b.y, b.used, t);
      for (const m of mobsByRow.get(y) ?? []) this.drawMob(ctx, r, m, t);
      if (Math.round(py) === y) {
        drawCloneTop(ctx, this.sx(px) + T / 2, this.sy(py) + T * 0.86, T, r.facing, t, walking);
      }
    }

    // fog of war: a hatch over the tiles, never a blackout.
    // One layer of lines for remembered or dark ground, a crossing second layer for ground never seen.
    const thin: [number, number, number][] = [];
    const thick: [number, number, number][] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        const i = idx(w, x, y);
        const wall = w.tiles[i] === T_WALL;
        const box: [number, number, number] = [this.sx(x), this.sy(y) - (wall ? lift : 0), T + (wall ? lift : 0)];
        // the clone always sees clearly within 2 tiles, dark room or not
        const near = Math.hypot(x - r.x, y - r.y) <= CLEAR_RADIUS + 0.5;
        if (near) { /* no fog */ } else if (!w.seen[i]) { thin.push(box); thick.push(box); }
        else if (!inView(r, x, y) || isDark(r, x, y)) thin.push(box);
        if (inStorm(r, x, y)) {
          ctx.fillStyle = 'rgba(122,74,179,0.28)';
          ctx.fillRect(box[0], box[1], T + 0.5, box[2] + 0.5);
          ctx.fillStyle = 'rgba(216,207,184,0.4)';
          const o = (t * 90 + x * 17 + y * 29) % T;
          ctx.fillRect(box[0] + ((x * 13) % T), box[1] + o, 1.5, T * 0.25);
        }
      }
    }
    this.hatch(ctx, thin, 1);
    this.hatch(ctx, thick, -1);
  }

  /** Diagonal lines over the given boxes, anchored to the world so they don't swim as the camera moves. */
  private hatch(ctx: CanvasRenderingContext2D, boxes: [number, number, number][], dir: 1 | -1) {
    if (!boxes.length) return;
    const T = this.T;
    const gap = Math.max(4, T * 0.2);
    ctx.save();
    ctx.beginPath();
    for (const [X, Y, h] of boxes) ctx.rect(X, Y, T + 0.5, h + 0.5);
    ctx.clip();
    ctx.strokeStyle = 'rgba(8,9,11,0.9)';
    ctx.lineWidth = Math.max(1.5, T * 0.07);
    ctx.beginPath();
    const span = this.W + this.H;
    // world phase: lines sit on x ± y = k·gap in world pixels
    const phase = ((this.camX * T + dir * this.camY * T) % gap + gap) % gap;
    for (let c = -span - phase; c < span * 2; c += gap) {
      if (dir === 1) { ctx.moveTo(c, 0); ctx.lineTo(c - this.H, this.H); }
      else { ctx.moveTo(c - this.H, 0); ctx.lineTo(c, this.H); }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawGate(ctx: CanvasRenderingContext2D, r: RunState, x: number, y: number, X: number, Y: number, t: number, debris: string) {
    const g = gateAt(r.world, x, y)!;
    const T = this.T;
    if (g.open) {
      ctx.fillStyle = '#1f2125';
      ctx.fillRect(X + 2, Y + 2, T - 4, T - 4);
      return;
    }
    if (g.kind === 'door') {
      ctx.fillStyle = '#3a3226';
      ctx.fillRect(X + 1, Y - T * 0.42, T - 2, T * 1.42 - 1);
      ctx.fillStyle = INK.sodium;
      ctx.fillRect(X + 1, Y - T * 0.42, T - 2, T * 0.12);
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? INK.void : INK.sodium;
        ctx.fillRect(X + 1 + (k * (T - 2)) / 4, Y + T * 0.72, (T - 2) / 4, T * 0.1);
      }
      ctx.strokeStyle = INK.void;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X + T / 2, Y - T * 0.3);
      ctx.lineTo(X + T / 2, Y + T * 0.7);
      ctx.stroke();
    } else {
      ctx.fillStyle = debris;
      for (let k = 0; k < 6; k++) {
        const ox = noise(g.id * 10 + k) * T * 0.3;
        const oy = noise(g.id * 10 + k + 50) * T * 0.25;
        ctx.save();
        ctx.translate(X + T / 2 + ox, Y + T * 0.45 + oy - T * 0.15);
        ctx.rotate(noise(g.id + k) * 1.2);
        ctx.fillRect(-T * 0.3, -T * 0.1, T * 0.6, T * 0.2);
        ctx.strokeStyle = INK.boneDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(-T * 0.3, -T * 0.1, T * 0.6, T * 0.2);
        ctx.restore();
      }
    }
    // rating pips
    ctx.fillStyle = g.forcible ? INK.bone : INK.flesh;
    for (let k = 0; k < g.rating; k++) ctx.fillRect(X + 3 + k * 5, Y - T * 0.36, 3, 3);
    void t;
  }

  private drawPoi(ctx: CanvasRenderingContext2D, r: RunState, p: Poi, t: number) {
    const T = this.T;
    const X = this.sx(p.x);
    const Y = this.sy(p.y);
    const cx = X + T / 2;
    const fy = Y + T * 0.85;
    ctx.lineWidth = Math.max(1, T * 0.04);
    ctx.strokeStyle = INK.bone;
    switch (p.kind) {
      case 'cache':
        ctx.fillStyle = p.used ? '#24262a' : INK.boneDim;
        ctx.fillRect(cx - T * 0.32, fy - T * 0.5, T * 0.64, T * 0.46);
        ctx.strokeRect(cx - T * 0.32, fy - T * 0.5, T * 0.64, T * 0.46);
        if (!p.used) {
          ctx.fillStyle = INK.sodium;
          ctx.fillRect(cx - T * 0.32, fy - T * 0.34, T * 0.64, T * 0.07);
        }
        break;
      case 'vent': {
        ctx.fillStyle = '#1c1e21';
        ctx.beginPath();
        ctx.ellipse(cx, fy - T * 0.2, T * 0.36, T * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(cx + k * T * 0.1, fy - T * 0.36);
          ctx.lineTo(cx + k * T * 0.1, fy - T * 0.04);
          ctx.stroke();
        }
        if (!p.used) {
          for (let k = 0; k < 3; k++) {
            const ph = (t * 0.6 + k / 3) % 1;
            ctx.fillStyle = `rgba(216,207,184,${0.35 * (1 - ph)})`;
            ctx.beginPath();
            ctx.arc(cx + Math.sin(ph * 6 + k) * T * 0.1, fy - T * 0.3 - ph * T * 0.9, T * (0.1 + ph * 0.15), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = INK.sodium;
          ctx.fillRect(cx - T * 0.05, fy - T * 0.24, T * 0.1, T * 0.06);
        }
        break;
      }
      case 'nest': {
        if (p.used) {
          ctx.fillStyle = '#2a1a1c';
          ctx.beginPath();
          ctx.ellipse(cx, fy - T * 0.12, T * 0.4, T * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        const pulse = 1 + Math.sin(t * 3) * 0.06;
        ctx.fillStyle = INK.fleshDark;
        ctx.beginPath();
        ctx.ellipse(cx, fy - T * 0.3, T * 0.42 * pulse, T * 0.32 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK.flesh;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(cx + noise(p.id + k) * T * 0.25, fy - T * 0.34 + noise(p.id + k + 9) * T * 0.12, T * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'pod': {
        // a glass tube with something suspended in it
        const spent = (p.buys ?? 0) >= 2;
        ctx.fillStyle = '#1c1e21';
        ctx.fillRect(cx - T * 0.3, fy - T * 0.12, T * 0.6, T * 0.12);
        ctx.fillStyle = spent ? '#2c3a3a' : INK.cryo;
        ctx.globalAlpha = spent ? 0.6 : 0.55 + 0.15 * Math.sin(t * 2 + p.id);
        ctx.fillRect(cx - T * 0.22, fy - T * 0.95, T * 0.44, T * 0.83);
        ctx.globalAlpha = 1;
        ctx.strokeRect(cx - T * 0.22, fy - T * 0.95, T * 0.44, T * 0.83);
        if (!spent) {
          ctx.fillStyle = INK.fleshDark;
          ctx.beginPath();
          ctx.ellipse(cx, fy - T * 0.55 + Math.sin(t * 1.3) * T * 0.04, T * 0.1, T * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = INK.bone;
          for (let k = 0; k < 3; k++) {
            const ph = (t * 0.5 + k / 3) % 1;
            ctx.fillRect(cx - T * 0.12 + k * T * 0.1, fy - T * 0.2 - ph * T * 0.65, 2, 2);
          }
        }
        ctx.fillStyle = INK.hullLit;
        ctx.fillRect(cx - T * 0.26, fy - T * 1.02, T * 0.52, T * 0.1);
        break;
      }
      case 'vat': {
        // a wide print vat, drained: cracked glass, a dark residue line, cables to the floor
        ctx.fillStyle = '#1c1e21';
        ctx.fillRect(cx - T * 0.38, fy - T * 0.14, T * 0.76, T * 0.14);
        ctx.fillStyle = '#26343a';
        ctx.fillRect(cx - T * 0.3, fy - T * 0.9, T * 0.6, T * 0.76);
        ctx.strokeStyle = INK.boneDim;
        ctx.strokeRect(cx - T * 0.3, fy - T * 0.9, T * 0.6, T * 0.76);
        ctx.fillStyle = INK.fleshDark;
        ctx.fillRect(cx - T * 0.28, fy - T * 0.24, T * 0.56, T * 0.08);
        ctx.strokeStyle = INK.bone;
        ctx.beginPath();
        ctx.moveTo(cx + T * 0.08, fy - T * 0.9);
        ctx.lineTo(cx - T * 0.02, fy - T * 0.66);
        ctx.lineTo(cx + T * 0.1, fy - T * 0.5);
        ctx.stroke();
        ctx.fillStyle = INK.sodium;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 2.5 + p.id);
        ctx.fillRect(cx - T * 0.05, fy - T * 1.0, T * 0.1, T * 0.06);
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK.hullLit;
        ctx.fillRect(cx - T * 0.34, fy - T * 0.97, T * 0.68, T * 0.08);
        break;
      }
      case 'terminal': {
        ctx.fillStyle = INK.hullLit;
        ctx.fillRect(cx - T * 0.3, fy - T * 0.75, T * 0.6, T * 0.72);
        ctx.strokeRect(cx - T * 0.3, fy - T * 0.75, T * 0.6, T * 0.72);
        const on = (p.buys ?? 0) < 2;
        ctx.fillStyle = on ? INK.toxin : '#203024';
        ctx.globalAlpha = on ? 0.6 + 0.3 * Math.sin(t * 5 + p.id) : 1;
        ctx.fillRect(cx - T * 0.22, fy - T * 0.66, T * 0.44, T * 0.28);
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK.boneDim;
        ctx.fillRect(cx - T * 0.18, fy - T * 0.28, T * 0.36, T * 0.1);
        break;
      }
      case 'surgery': {
        ctx.fillStyle = INK.boneDim;
        ctx.fillRect(cx - T * 0.38, fy - T * 0.36, T * 0.76, T * 0.18);
        ctx.strokeRect(cx - T * 0.38, fy - T * 0.36, T * 0.76, T * 0.18);
        ctx.strokeStyle = INK.boneDim;
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.3, fy - T * 0.18);
        ctx.lineTo(cx - T * 0.3, fy);
        ctx.moveTo(cx + T * 0.3, fy - T * 0.18);
        ctx.lineTo(cx + T * 0.3, fy);
        ctx.moveTo(cx, fy - T * 0.36);
        ctx.lineTo(cx, fy - T * 0.95);
        ctx.stroke();
        ctx.fillStyle = INK.sodium;
        ctx.beginPath();
        ctx.arc(cx, fy - T * 0.95, T * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'event': {
        if (p.used) {
          ctx.fillStyle = '#26282c';
          ctx.fillRect(cx - T * 0.2, fy - T * 0.2, T * 0.4, T * 0.2);
          break;
        }
        const glow = 0.5 + 0.5 * Math.sin(t * 3 + p.id);
        ctx.fillStyle = INK.signal;
        ctx.globalAlpha = 0.25 + 0.2 * glow;
        ctx.beginPath();
        ctx.ellipse(cx, fy - T * 0.4, T * 0.4, T * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK.bone;
        ctx.font = `700 ${Math.round(T * 0.6)}px "Bebas Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('?', cx, fy - T * 0.2);
        ctx.textAlign = 'left';
        break;
      }
      case 'ship': {
        const s = T * 0.9;
        ctx.fillStyle = INK.hullLit;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.8, fy);
        ctx.lineTo(cx - s * 0.5, fy - s * 0.7);
        ctx.lineTo(cx, fy - s * 1.1);
        ctx.lineTo(cx + s * 0.5, fy - s * 0.7);
        ctx.lineTo(cx + s * 0.8, fy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = r.bossDead ? INK.toxin : INK.sodium;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
        ctx.fillRect(cx - s * 0.18, fy - s * 0.75, s * 0.36, s * 0.12);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = INK.boneDim;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.6, fy);
        ctx.lineTo(cx - s * 0.9, fy + s * 0.12);
        ctx.moveTo(cx + s * 0.6, fy);
        ctx.lineTo(cx + s * 0.9, fy + s * 0.12);
        ctx.stroke();
        break;
      }
    }
  }

  private drawBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, used: boolean, t: number) {
    const T = this.T;
    const cx = this.sx(x) + T / 2;
    const fy = this.sy(y) + T * 0.85;
    ctx.strokeStyle = INK.boneDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, fy);
    ctx.lineTo(cx, fy - T * 0.7);
    ctx.stroke();
    ctx.fillStyle = used ? INK.boneDim : INK.sodium;
    ctx.globalAlpha = used ? 0.6 : 0.6 + 0.4 * Math.sin(t * 4);
    ctx.beginPath();
    ctx.arc(cx, fy - T * 0.72, T * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawMob(ctx: CanvasRenderingContext2D, r: RunState, m: Mob, t: number) {
    const T = this.T;
    const cx = this.sx(m.x) + T / 2;
    const fy = this.sy(m.y) + T * 0.88;
    const id = m.foes[0];
    const size = CREATURE_SIZE[id] ?? 1;
    const u = m.kind === 'boss' ? T * 1.1 : Math.min(T * 0.9, (T * 1.25) / size);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, fy, T * 0.34, T * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    if (m.kind === 'elite' || m.kind === 'boss') {
      ctx.strokeStyle = m.kind === 'boss' ? INK.flesh : INK.sodium;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, fy, T * 0.44, T * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const ambushed = m.kind === 'ambush';
    if (ambushed) ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 5);
    drawCreature(ctx, id, cx, fy, u, { t: t + m.id, boil: Math.floor(t * 6) * 3, flash: 0, lunge: 0, dead: 0, seed: (m.id % 97) / 97, dim: 0, state: id === 'sleeper' ? 1 : 0 });
    ctx.globalAlpha = 1;
    if (m.foes.length > 1) {
      ctx.fillStyle = INK.void;
      ctx.fillRect(cx + T * 0.18, fy - T * 0.3, T * 0.34, T * 0.26);
      ctx.fillStyle = INK.bone;
      ctx.font = `700 ${Math.round(T * 0.24)}px "Barlow Condensed", sans-serif`;
      ctx.fillText(`×${m.foes.length}`, cx + T * 0.21, fy - T * 0.1);
    }
    if (m.alerted) {
      ctx.fillStyle = INK.flesh;
      ctx.font = `700 ${Math.round(T * 0.45)}px "Bebas Neue", sans-serif`;
      ctx.fillText('!', cx - T * 0.06, fy - size * u - T * 0.1);
    }
    void r;
  }
}
