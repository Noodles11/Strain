import { INK } from './palette';
import { noise, sketchEllipse, sketchStroke, smoothPath, type Pt } from './sketch';
import type { Traits } from '../core/traits';

export interface CloneFx {
  t: number;
  flash: number;
  lunge: number;
  heal: number;
  boil: number;
}

/**
 * The clone seen from behind, like a back sprite. Its shape follows the trait sheet:
 * Might broadens the shoulders, Hide adds plates, Aberrance grows things that shouldn't be there.
 */
export function drawCloneBack(ctx: CanvasRenderingContext2D, x: number, footY: number, u: number, t: Traits, fx: CloneFx) {
  ctx.save();
  ctx.translate(x + (fx.flash > 0 ? noise(fx.t * 80) * fx.flash * u * 0.04 : 0), footY - fx.lunge * u * 0.06);
  const s = 77 + fx.boil;
  const sh = u * (0.34 + Math.min(12, t.mgt) * 0.012);
  const breathe = Math.sin(fx.t * 1.6) * u * 0.008;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, u * 0.014);
  ctx.strokeStyle = fx.flash > 0.5 ? '#ffffff' : INK.bone;

  // aberrant growths behind the body
  const growths = Math.max(0, Math.min(6, t.abr - 3));
  for (let i = 0; i < growths; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const base: Pt = [side * sh * (0.5 - k * 0.12), -u * (0.82 - k * 0.1)];
    const sway = Math.sin(fx.t * 1.1 + i) * u * 0.03;
    const tip: Pt = [side * sh * (0.95 + k * 0.1) + sway, -u * (1.12 + k * 0.08)];
    ctx.fillStyle = INK.signal;
    ctx.beginPath();
    ctx.moveTo(base[0] - u * 0.03, base[1]);
    ctx.quadraticCurveTo((base[0] + tip[0]) / 2 + side * u * 0.1, (base[1] + tip[1]) / 2, tip[0], tip[1]);
    ctx.quadraticCurveTo((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 + u * 0.05, base[0] + u * 0.03, base[1]);
    ctx.fill();
    sketchStroke(ctx, [base, tip], s + i * 9, u * 0.01);
  }

  // torso: a hooded back, shoulders set by Might
  const torso: Pt[] = [
    [-sh, -u * 0.66 + breathe], [-sh * 0.92, -u * 0.35], [-sh * 0.7, 0], [sh * 0.7, 0], [sh * 0.92, -u * 0.35], [sh, -u * 0.66 + breathe],
    [sh * 0.55, -u * 0.8 + breathe], [-sh * 0.55, -u * 0.8 + breathe],
  ];
  ctx.fillStyle = INK.hullLit;
  smoothPath(ctx, torso);
  ctx.fill();
  sketchStroke(ctx, torso, s, u * 0.01, true);
  // spine seam and print code
  sketchStroke(ctx, [[0, -u * 0.78], [noise(s) * u * 0.01, -u * 0.08]], s + 3, u * 0.006);
  ctx.fillStyle = INK.sodium;
  ctx.fillRect(-u * 0.05, -u * 0.62, u * 0.1, u * 0.025);

  // hide plates on the shoulders
  const plates = Math.max(0, Math.min(5, t.hde - 2));
  ctx.fillStyle = INK.boneDim;
  for (let i = 0; i < plates; i++) {
    for (const side of [-1, 1]) {
      const px = side * sh * (0.55 + i * 0.08);
      const py = -u * (0.7 - i * 0.07);
      const p = sketchEllipse(px, py, u * 0.07, u * 0.035, s + i * 3 + side);
      smoothPath(ctx, p);
      ctx.fill();
    }
  }

  // head from behind
  const hy = -u * 0.94 + breathe;
  const head = sketchEllipse(0, hy, u * 0.15, u * 0.17, s + 20);
  ctx.fillStyle = INK.fleshDark;
  smoothPath(ctx, head);
  ctx.fill();
  sketchStroke(ctx, head, s + 21, u * 0.01, true);
  // the socket where the cable was
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.arc(0, hy + u * 0.06, u * 0.025, 0, Math.PI * 2);
  ctx.fill();

  if (fx.heal > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(127,212,138,${fx.heal * 0.6})`;
    ctx.fillRect(-u, -u * 1.4, u * 2, u * 1.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (fx.flash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,236,226,${fx.flash * 0.7})`;
    ctx.fillRect(-u, -u * 1.4, u * 2, u * 1.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** The clone on the overworld: small, facing the way it walks. */
export function drawCloneTop(ctx: CanvasRenderingContext2D, x: number, footY: number, T: number, facing: [number, number], t: number, walking: boolean) {
  ctx.save();
  ctx.translate(x, footY);
  const bob = walking ? Math.abs(Math.sin(t * 14)) * T * 0.05 : Math.sin(t * 2) * T * 0.01;
  ctx.lineWidth = Math.max(1.2, T * 0.035);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK.bone;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 0, T * 0.26, T * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = INK.hullLit;
  ctx.beginPath();
  ctx.moveTo(-T * 0.2, -T * 0.06);
  ctx.lineTo(-T * 0.24, -T * 0.5 - bob);
  ctx.quadraticCurveTo(0, -T * 0.62 - bob, T * 0.24, -T * 0.5 - bob);
  ctx.lineTo(T * 0.2, -T * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK.sodium;
  ctx.fillRect(-T * 0.18, -T * 0.34 - bob, T * 0.36, T * 0.05);
  // head
  const hx = facing[0] * T * 0.06;
  const hy = -T * 0.72 - bob + (facing[1] < 0 ? T * 0.02 : 0);
  ctx.fillStyle = INK.fleshDark;
  ctx.beginPath();
  ctx.ellipse(hx, hy, T * 0.16, T * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (facing[1] >= 0) {
    // face: two pale eyes when it looks toward you or sideways
    ctx.fillStyle = INK.bone;
    const ex = facing[0] * T * 0.07;
    if (facing[0] === 0) {
      ctx.fillRect(hx - T * 0.07, hy - T * 0.02, T * 0.04, T * 0.04);
      ctx.fillRect(hx + T * 0.03, hy - T * 0.02, T * 0.04, T * 0.04);
    } else ctx.fillRect(hx + ex - T * 0.02, hy - T * 0.02, T * 0.04, T * 0.04);
  }
  ctx.restore();
}
