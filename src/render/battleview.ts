import { CREATURE_SIZE, drawCreature } from './creatures';
import { drawCloneBack } from './clone';
import { INK } from './palette';
import type { BattleState } from '../core/battle';
import type { Traits } from '../core/traits';

export interface FoeAnim {
  flash: number;
  lunge: number;
  dead: number;
  gone: boolean;
}

/** Game Boy battle grammar: foe upper right on a ledge, clone lower left seen from behind. */
export class BattleView {
  foes = new Map<number, FoeAnim>();
  player = { flash: 0, lunge: 0, heal: 0 };
  shake = 0;
  intro = 0;
  target = -1;
  hit: { uid: number; x: number; y: number; w: number; h: number }[] = [];

  reset() {
    this.foes.clear();
    this.player = { flash: 0, lunge: 0, heal: 0 };
    this.shake = 0;
    this.intro = 0;
    this.target = -1;
  }

  anim(uid: number): FoeAnim {
    let a = this.foes.get(uid);
    if (!a) { a = { flash: 0, lunge: 0, dead: 0, gone: false }; this.foes.set(uid, a); }
    return a;
  }

  update(dt: number) {
    this.intro = Math.min(1, this.intro + dt * 1.6);
    for (const a of this.foes.values()) {
      a.flash = Math.max(0, a.flash - dt * 2.5);
      a.lunge = Math.max(0, a.lunge - dt * 3);
      if (a.dead > 0 && !a.gone) { a.dead = Math.min(1, a.dead + dt * 1.8); if (a.dead >= 1) a.gone = true; }
    }
    this.player.flash = Math.max(0, this.player.flash - dt * 2.5);
    this.player.lunge = Math.max(0, this.player.lunge - dt * 3);
    this.player.heal = Math.max(0, this.player.heal - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  draw(ctx: CanvasRenderingContext2D, b: BattleState, traits: Traits, W: number, H: number, t: number) {
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(t * 90) * this.shake * 8, Math.cos(t * 70) * this.shake * 4);
    this.drawBackdrop(ctx, W, H, t);

    const ease = (x: number) => 1 - (1 - x) ** 3;
    const k = ease(this.intro);

    // foe ledge
    const ex = W * 0.7 + (1 - k) * W * 0.6;
    const ey = H * 0.46;
    this.ledge(ctx, ex, ey, W * 0.3, H * 0.055);
    // clone ledge
    const px = W * 0.27 - (1 - k) * W * 0.6;
    const py = H * 0.95;
    this.ledge(ctx, px, py, W * 0.3, H * 0.06);

    const shown = b.foes.filter((f) => f.alive || !this.anim(f.uid).gone);
    const alive = b.foes.filter((f) => f.alive);
    const front = alive.find((f) => f.uid === this.target) ?? alive[0] ?? shown[0];
    const back = shown.filter((f) => f !== front);
    const slots: [number, number, number][] = [[-0.2, -0.06, 0.7], [0.17, -0.1, 0.7]];
    this.hit = [];
    const drawFoe = (f: (typeof shown)[number], dx: number, dy: number, sc: number) => {
      const a = this.anim(f.uid);
      const size = CREATURE_SIZE[f.id] ?? 1;
      const u = H * 0.34 * sc * (size < 0.8 ? 1.5 : size > 1.5 ? 0.85 : 1);
      const x = ex + dx * W;
      const y = ey + dy * H;
      const blink = a.flash > 0 && Math.floor(a.flash * 12) % 2 === 0;
      if (a.dead > 0) ctx.globalAlpha = 1 - a.dead;
      if (!blink) {
        drawCreature(ctx, f.id, x - a.lunge * W * 0.06, y + a.lunge * H * 0.03, u, {
          t: t + f.uid, boil: Math.floor(t * 8) * 3, flash: a.flash, lunge: a.lunge, dead: a.dead, seed: (f.uid % 97) / 97, dim: sc < 1 ? 0.25 : 0,
        });
      }
      ctx.globalAlpha = 1;
      const h = size * u;
      if (f.alive) this.hit.push({ uid: f.uid, x: x - u * 0.6, y: y - h, w: u * 1.2, h });
      if (f.alive && f === front && alive.length > 1) {
        ctx.fillStyle = INK.sodium;
        ctx.beginPath();
        ctx.moveTo(x, y - h - H * 0.02);
        ctx.lineTo(x - 7, y - h - H * 0.02 - 10);
        ctx.lineTo(x + 7, y - h - H * 0.02 - 10);
        ctx.closePath();
        ctx.fill();
      }
    };
    back.forEach((f, i) => drawFoe(f, slots[i % 2][0], slots[i % 2][1], slots[i % 2][2]));
    if (front) drawFoe(front, 0, 0, 1);

    drawCloneBack(ctx, px + this.player.lunge * W * 0.05, py + H * 0.03, H * 0.4, traits, {
      t, flash: this.player.flash, lunge: this.player.lunge, heal: this.player.heal, boil: Math.floor(t * 8) * 3,
    });
    ctx.restore();
  }

  private ledge(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    ctx.fillStyle = '#3d3a33';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57534a';
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 0.18, rx * 0.94, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK.boneDim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 0.18, rx * 0.94, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    const hz = H * 0.52;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#121417');
    sky.addColorStop(1, '#2a2c30');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, hz + 20);
    // bulkhead ribs
    ctx.strokeStyle = '#3a3c41';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const x = (i + 0.5) * (W / 7);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (x - W / 2) * 0.08, hz);
      ctx.stroke();
    }
    // one warning lamp
    ctx.fillStyle = INK.sodium;
    ctx.globalAlpha = 0.5 + 0.5 * Math.max(0, Math.sin(t * 2.2));
    ctx.fillRect(W * 0.12, H * 0.1, W * 0.05, H * 0.02);
    ctx.globalAlpha = 1;
    // floor
    const fl = ctx.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, '#34363a');
    fl.addColorStop(1, '#1b1d20');
    ctx.fillStyle = fl;
    ctx.fillRect(-20, hz, W + 40, H - hz + 20);
    ctx.strokeStyle = '#43464b';
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * W * 0.06, hz);
      ctx.lineTo(W / 2 + i * W * 0.3, H);
      ctx.stroke();
    }
    for (let j = 1; j < 6; j++) {
      const y = hz + (H - hz) * (j / 6) ** 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = INK.boneDim;
    ctx.fillRect(0, hz - 1, W, 2);
  }
}
