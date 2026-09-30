import { CREATURE_SIZE, drawCreature } from './creatures';
import { drawCloneTop } from './clone';
import { INK } from './palette';
import { noise } from './sketch';
import { SNOW, SNOW_SHADE, snowAt, theme } from './theme';
import { decalAt, floorTex, hash, wallFaceTex, wallTopTex, type DecalShape } from './texture';
import { EERIE, flicker, Lighting, type Light } from './light';
import { drawBeaconProp, drawCache, drawDebris, drawDoor, drawEvent, drawNest, drawPod, drawShip, drawSurgery, drawTerminal, drawVat, drawVent, type PropCtx } from './props';
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
  private lighting = new Lighting();
  /** Where each mob is drawn: it glides toward its tile instead of jumping, and faces where it walks. */
  private mobPos = new Map<number, { x: number; y: number; face: number; last: number }>();
  private dt = 0;

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
    this.dt = dt;
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

    const lights: Light[] = [];
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
        ctx.drawImage(floorTex(w.planet, th, T, x, y), X, Y, T + 0.5, T + 0.5);
        // hard comic shadows: light falls from the upper left, so walls throw a band onto the floor below and to their right
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        if (y > 0 && w.tiles[idx(w, x, y - 1)] === T_WALL) ctx.fillRect(X, Y, T + 0.5, T * 0.26);
        if (x > 0 && w.tiles[idx(w, x - 1, y)] === T_WALL) {
          ctx.beginPath();
          ctx.moveTo(X, Y); ctx.lineTo(X + T * 0.22, Y + T * 0.2); ctx.lineTo(X + T * 0.22, Y + T + 0.5); ctx.lineTo(X, Y + T + 0.5);
          ctx.fill();
        }
        if (tile === T_FLOOR) this.decal(ctx, decalAt(w.planet, x, y, t), X, Y);
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
        if (tile === T_HAZARD) {
          if (lights.length < 60 && hash(x, y, 3) < 0.5) lights.push({ x: X + T / 2, y: Y + T / 2, r: T * 1.2, color: th.hazard, power: 0.2 });
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
          ctx.drawImage(wallFaceTex(w.planet, th, T, lift, x, y), X, Y + T - lift, T + 0.5, lift + 0.5);
          ctx.fillStyle = '#0b0c0e';
          ctx.fillRect(X, Y + T - 3, T + 0.5, 3);
          // the odd lamp, crystal or glowing fungus on a wall that faces open floor
          if (hash(x, y, 90) < 0.14) this.wallLight(ctx, lights, w.planet, x, y, X + T / 2, Y + T - lift * 0.55, t);
        }
        ctx.drawImage(wallTopTex(w.planet, th, T, x, y), X, Y - lift, T + 0.5, T + 0.5);
        ctx.fillStyle = th.wallEdge;
        if (y > 0 && w.tiles[idx(w, x, y - 1)] !== T_WALL) ctx.fillRect(X, Y - lift, T + 0.5, 2);
        if (below !== T_WALL) {
          ctx.fillStyle = th.wallLip;
          ctx.fillRect(X, Y + T - lift - 2, T + 0.5, 2);
        }
        // ink outline where the block meets open ground
        ctx.fillStyle = '#060708';
        if (x > 0 && w.tiles[idx(w, x - 1, y)] !== T_WALL) ctx.fillRect(X - 1, Y - lift, 2, T + 0.5);
        if (x + 1 < w.w && w.tiles[idx(w, x + 1, y)] !== T_WALL) ctx.fillRect(X + T - 1, Y - lift, 2, T + 0.5);
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
        if (th.reeds && noise(i * 2.3) > 0.1) {
          // reeds on the bank and moss hanging off the lip
          const base = Y - lift + T * 0.75;
          ctx.strokeStyle = th.wallEdge;
          ctx.lineWidth = Math.max(1, T * 0.04);
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          for (let q = 0; q < 4; q++) {
            const hx = X + T * (0.2 + 0.2 * q + 0.06 * noise(i + q));
            const hh = T * (0.3 + 0.3 * (noise(i + q * 5) * 0.5 + 0.5));
            const sway = Math.sin(t * 1.3 + i + q) * T * 0.04;
            ctx.moveTo(hx, base);
            ctx.quadraticCurveTo(hx + sway * 0.5, base - hh * 0.6, hx + sway + T * 0.05, base - hh);
          }
          ctx.stroke();
          if (below !== T_WALL) {
            ctx.fillStyle = th.wallLip;
            for (let q = 0; q < 3; q++) {
              const mx = X + T * (0.15 + 0.3 * q + 0.08 * noise(i * 3 + q));
              const ml = T * (0.12 + 0.18 * (noise(i + q * 11) * 0.5 + 0.5));
              ctx.fillRect(mx, Y + T - lift - 1, T * 0.07, ml);
            }
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

    this.light(ctx, r, lights, px, py, t);

    // fog of war: a crossed hatch over ground never seen, never a blackout.
    // Once a tile has been revealed it stays clear for good.
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
        if (!near && !w.seen[i]) { thin.push(box); thick.push(box); }
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

  /** Flat decal shapes on a floor tile. */
  private decal(ctx: CanvasRenderingContext2D, shapes: DecalShape[], X: number, Y: number) {
    const T = this.T;
    for (const d of shapes) {
      ctx.beginPath();
      d.pts.forEach(([u, v], k) => (k ? ctx.lineTo(X + u * T, Y + v * T) : ctx.moveTo(X + u * T, Y + v * T)));
      if (d.closed) ctx.closePath();
      if (d.fill) { ctx.fillStyle = d.fill; ctx.fill(); }
      if (d.stroke) { ctx.strokeStyle = d.stroke; ctx.lineWidth = d.width ?? 1; ctx.stroke(); }
    }
  }

  /** A light fixture on a wall face, and the light it throws. */
  private wallLight(ctx: CanvasRenderingContext2D, lights: Light[], planet: string, x: number, y: number, cx: number, cy: number, t: number) {
    const T = this.T;
    const e = EERIE[planet] ?? EERIE.derelict;
    const seed = Math.floor(hash(x, y, 91) * 1000);
    const on = flicker(t, seed);
    const col = hash(x, y, 92) < 0.25 ? e.eerie : e.lamp;
    if (planet === 'kessra') {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.5 + 0.5 * on;
      ctx.beginPath(); ctx.moveTo(cx - T * 0.08, cy + T * 0.12); ctx.lineTo(cx, cy - T * 0.14); ctx.lineTo(cx + T * 0.08, cy + T * 0.12); ctx.fill();
    } else if (planet === 'mireth') {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.45 + 0.55 * on;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + (k - 1.5) * T * 0.09, cy + (k % 2) * T * 0.06, T * 0.035, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#0b0c0e';
      ctx.fillRect(cx - T * 0.16, cy - T * 0.06, T * 0.32, T * 0.12);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.25 + 0.75 * on;
      ctx.fillRect(cx - T * 0.13, cy - T * 0.035, T * 0.26, T * 0.07);
    }
    ctx.globalAlpha = 1;
    lights.push({ x: cx, y: cy + T * 0.5, r: T * 2.6, color: col, power: 0.75 * on });
  }

  /** Lights, comic shading and a few drifting motes over the finished map. */
  private light(ctx: CanvasRenderingContext2D, r: RunState, lights: Light[], px: number, py: number, t: number) {
    const T = this.T;
    const w = r.world;
    const e = EERIE[w.planet] ?? EERIE.derelict;
    const cx = this.sx(px) + T / 2;
    const cy = this.sy(py) + T / 2;
    const dark = isDark(r, r.x, r.y);
    // the clone carries a small pale light; in a dark section it barely reaches
    lights.push({ x: cx, y: cy, r: T * (dark ? 3.6 : 6), power: 1 });
    const on = (x: number, y: number) => Math.abs(x - px) < 9 && Math.abs(y - py) < 14 && w.seen[idx(w, x, y)];
    for (const p of w.pois) {
      if (p.hidden || !on(p.x, p.y)) continue;
      const X = this.sx(p.x) + T / 2;
      const Y = this.sy(p.y) + T / 2;
      const glow: Record<string, [string, number] | undefined> = {
        vent: p.used ? undefined : ['#d8cfb8', 1.6], event: p.used ? undefined : [INK.signal, 1.8], pod: [INK.cryo, 1.6],
        terminal: [INK.toxin, 1.5], vat: [INK.sodium, 1.8], ship: [INK.toxin, 3.2], nest: p.used ? undefined : [INK.flesh, 1.4],
        surgery: ['#d8cfb8', 1.4],
      };
      const g = glow[p.kind];
      if (g) lights.push({ x: X, y: Y, r: T * g[1] * 1.6, color: g[0], power: 0.8 });
    }
    for (const m of w.mobs) {
      if (!m.alive || m.kind !== 'boss' || !on(m.x, m.y)) continue;
      lights.push({ x: this.sx(m.x) + T / 2, y: this.sy(m.y) + T / 2, r: T * 3, color: e.eerie, power: 0.6 + 0.2 * Math.sin(t * 1.5) });
    }
    for (const b of r.beacons) if (on(b.x, b.y)) lights.push({ x: this.sx(b.x) + T / 2, y: this.sy(b.y) + T / 2, r: T * 2.2, color: INK.sodium, power: 0.7 });
    this.lighting.apply(ctx, this.W, this.H, lights, { dark: e.dark, tint: e.tint, dots: 0.32, glow: 0.5 });
    // motes drifting through the light
    ctx.fillStyle = w.planet === 'mireth' ? '#c4d86a' : w.planet === 'kessra' ? '#e6fcff' : '#d8cfb8';
    for (let i = 0; i < 26; i++) {
      const mx = ((hash(i, 1, 7) * this.W * 1.4 - this.camX * T * 0.35 + t * (6 + 8 * hash(i, 2, 7))) % (this.W * 1.4) + this.W * 1.4) % (this.W * 1.4) - this.W * 0.2;
      const my = ((hash(i, 3, 7) * this.H - this.camY * T * 0.35 + Math.sin(t * 0.7 + i) * 12) % this.H + this.H) % this.H;
      ctx.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2));
      const s = 1 + hash(i, 4, 7) * 1.5;
      ctx.fillRect(mx, my, s, s);
    }
    ctx.globalAlpha = 1;
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

  private prop(r: RunState, x: number, y: number, seed: number, t: number): PropCtx {
    const T = this.T;
    return { ctx: null as unknown as CanvasRenderingContext2D, T, cx: this.sx(x) + T / 2, fy: this.sy(y) + T * 0.85, t, planet: r.world.planet, seed };
  }

  private drawGate(ctx: CanvasRenderingContext2D, r: RunState, x: number, y: number, X: number, Y: number, t: number, _debris: string) {
    const g = gateAt(r.world, x, y)!;
    const T = this.T;
    if (g.open) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(X + 2, Y + 2, T - 4, T - 4);
      return;
    }
    const c = { ...this.prop(r, x, y, g.id, t), ctx };
    if (g.kind === 'door') drawDoor(c, T * 0.42, g.rating, g.forcible);
    else drawDebris(c, g.rating, g.forcible);
  }

  private drawPoi(ctx: CanvasRenderingContext2D, r: RunState, p: Poi, t: number) {
    const c = { ...this.prop(r, p.x, p.y, p.id, t), ctx };
    ctx.save();
    switch (p.kind) {
      case 'cache': drawCache(c, p.used); break;
      case 'vent': drawVent(c, p.used); break;
      case 'nest': drawNest(c, p.used); break;
      case 'pod': drawPod(c, (p.buys ?? 0) >= 2); break;
      case 'vat': drawVat(c); break;
      case 'terminal': drawTerminal(c, (p.buys ?? 0) < 2); break;
      case 'surgery': drawSurgery(c); break;
      case 'event': drawEvent(c, p.used); break;
      case 'ship': drawShip(c, r.bossDead); break;
    }
    ctx.restore();
  }

  private drawBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, used: boolean, t: number) {
    const T = this.T;
    drawBeaconProp({ ctx, T, cx: this.sx(x) + T / 2, fy: this.sy(y) + T * 0.85, t, planet: 'derelict', seed: x * 31 + y }, used);
  }

  private drawMob(ctx: CanvasRenderingContext2D, r: RunState, m: Mob, t: number) {
    const T = this.T;
    let pos = this.mobPos.get(m.id);
    // a mob that jumped far (respawn, a new map) snaps instead of sliding across the screen
    if (!pos || Math.abs(pos.x - m.x) + Math.abs(pos.y - m.y) > 2.5) {
      pos = { x: m.x, y: m.y, face: 1, last: t };
      this.mobPos.set(m.id, pos);
    }
    const k = 1 - Math.exp(-this.dt * 7);
    const dxm = m.x - pos.x;
    if (Math.abs(dxm) > 0.05) pos.face = dxm > 0 ? 1 : -1;
    pos.x += dxm * k;
    pos.y += (m.y - pos.y) * k;
    const moving = Math.abs(m.x - pos.x) + Math.abs(m.y - pos.y) > 0.04;
    if (moving) pos.last = t;
    const hop = t - pos.last < 0.3 || moving ? Math.abs(Math.sin(t * 12 + m.id)) * T * 0.06 : 0;
    const cx = this.sx(pos.x) + T / 2;
    const fy = this.sy(pos.y) + T * 0.88;
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
    ctx.save();
    // creatures are drawn facing right; mirror them when they walk left
    if (pos.face < 0) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    drawCreature(ctx, id, cx, fy - hop, u, { t: t + m.id, boil: Math.floor(t * 6) * 3, flash: 0, lunge: 0, dead: 0, seed: (m.id % 97) / 97, dim: 0, state: id === 'sleeper' ? 1 : 0 });
    ctx.restore();
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
