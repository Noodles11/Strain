import { INK } from './palette';
import { noise, sketchStroke, type Pt } from './sketch';
import type { Traits } from '../core/traits';

export interface CloneFx {
  t: number;
  flash: number;
  lunge: number;
  heal: number;
  boil: number;
}

// Vat-grown skin: pale and a little grey, inked in near-black like a comic figure.
const SKIN = '#c9b09a';
const SKIN_SHADE = '#8e7466';
const SKIN_DEEP = '#5e4a43';
const SKIN_LIGHT = '#eedcc6';
const OUTLINE = '#17110f';

/** A tapered limb from a to b, radius ra at a and rb at b, filled and outlined. */
function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, ra: number, rb: number, fill: string, line: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * ra, a[1] + ny * ra);
  ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb);
  ctx.arc(b[0], b[1], rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - nx * ra, a[1] - ny * ra);
  ctx.arc(a[0], a[1], ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

/** A smooth closed outline through points. */
function blob(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const s = mid(pts[n - 1], pts[0]);
  ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

/**
 * The clone in battle, seen from behind: a bare, hairless printed body. Might broadens the
 * shoulders, Hide grows bony plates along the spine and shoulders, Aberrance grows things
 * that shouldn't be there. It is backlit by whatever it faces, so the back sits in shade
 * and the edges catch the light.
 */
export function drawCloneBack(ctx: CanvasRenderingContext2D, x: number, footY: number, u: number, t: Traits, fx: CloneFx) {
  ctx.save();
  // an over-the-shoulder view: the figure is big and sits low, cut off at the hips by the frame
  ctx.translate(x + (fx.flash > 0 ? noise(fx.t * 80) * fx.flash * u * 0.04 : 0), footY + u * 0.3 - fx.lunge * u * 0.06);
  ctx.scale(1.35, 1.35);
  const s = 77 + fx.boil;
  const sh = u * (0.3 + Math.min(12, t.mgt) * 0.012); // half shoulder width
  const breathe = Math.sin(fx.t * 1.6) * u * 0.008;
  const line = Math.max(1.5, u * 0.012);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // aberrant growths behind the body
  const growths = Math.max(0, Math.min(6, t.abr - 3));
  for (let i = 0; i < growths; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const base: Pt = [side * sh * (0.45 - k * 0.12), -u * (0.84 - k * 0.1)];
    const sway = Math.sin(fx.t * 1.1 + i) * u * 0.03;
    const tip: Pt = [side * sh * (1.0 + k * 0.1) + sway, -u * (1.16 + k * 0.08)];
    ctx.fillStyle = INK.signal;
    ctx.beginPath();
    ctx.moveTo(base[0] - u * 0.03, base[1]);
    ctx.quadraticCurveTo((base[0] + tip[0]) / 2 + side * u * 0.1, (base[1] + tip[1]) / 2, tip[0], tip[1]);
    ctx.quadraticCurveTo((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 + u * 0.05, base[0] + u * 0.03, base[1]);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    ctx.stroke();
  }

  const shY = -u * 0.8 + breathe; // shoulder line
  const waistY = -u * 0.36;
  const hipY = -u * 0.2;
  // arms hang at the sides; the right one swings forward when the clone strikes
  const swing = Math.sin(fx.t * 1.2) * u * 0.008;
  for (const side of [-1, 1]) {
    const reach = side > 0 ? fx.lunge : 0;
    const sPt: Pt = [side * sh * 0.95, shY + u * 0.05];
    const ePt: Pt = [side * sh * (1.08 - reach * 0.3), shY + u * (0.3 - reach * 0.12) + swing];
    const hPt: Pt = [side * sh * (1.0 - reach * 0.6), shY + u * (0.56 - reach * 0.3) + swing];
    limb(ctx, sPt, ePt, u * 0.085, u * 0.058, SKIN_SHADE, line);
    limb(ctx, ePt, hPt, u * 0.058, u * 0.045, SKIN_SHADE, line);
    // a hard band of light down the outer edge of the arm
    ctx.strokeStyle = SKIN_LIGHT;
    ctx.lineWidth = u * 0.012;
    ctx.beginPath();
    ctx.moveTo(sPt[0] + side * u * 0.06, sPt[1] + u * 0.02);
    ctx.lineTo(ePt[0] + side * u * 0.048, ePt[1]);
    ctx.lineTo(hPt[0] + side * u * 0.035, hPt[1] - u * 0.02);
    ctx.stroke();
    // hand
    ctx.fillStyle = SKIN_SHADE;
    ctx.beginPath();
    ctx.ellipse(hPt[0], hPt[1] + u * 0.04, u * 0.045, u * 0.06, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    ctx.stroke();
  }

  // hips and the tops of the legs, running off the bottom of the frame
  for (const side of [-1, 1]) {
    limb(ctx, [side * sh * 0.32, hipY], [side * sh * 0.36, u * 0.2], u * 0.12, u * 0.1, SKIN_SHADE, line);
  }

  // the back: broad at the shoulders, narrowing to the waist, flaring a little at the hips
  const back: Pt[] = [
    [-sh, shY + u * 0.02], [-sh * 0.96, shY + u * 0.14], [-sh * 0.72, waistY - u * 0.08], [-sh * 0.62, waistY],
    [-sh * 0.66, hipY], [-sh * 0.58, hipY + u * 0.1], [sh * 0.58, hipY + u * 0.1], [sh * 0.66, hipY],
    [sh * 0.62, waistY], [sh * 0.72, waistY - u * 0.08], [sh * 0.96, shY + u * 0.14], [sh, shY + u * 0.02],
    [sh * 0.55, shY - u * 0.05], [sh * 0.2, shY - u * 0.09], [-sh * 0.2, shY - u * 0.09], [-sh * 0.55, shY - u * 0.05],
  ];
  blob(ctx, back);
  ctx.fillStyle = SKIN;
  ctx.fill();
  // backlit: the whole back in shade except its outer edges
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(-sh, 0, sh, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.12, 'rgba(94,74,67,0.55)');
  g.addColorStop(0.88, 'rgba(94,74,67,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-sh * 1.1, shY - u * 0.2, sh * 2.2, u * 1.2);
  // a cast shadow from the head across the shoulders
  ctx.fillStyle = 'rgba(40,28,24,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, shY + u * 0.02, u * 0.16, u * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  blob(ctx, back);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = line * 1.2;
  ctx.stroke();

  // anatomy in ink: spine groove, shoulder blades, the lats' edge, a dimple over each hip
  ctx.strokeStyle = SKIN_DEEP;
  ctx.lineWidth = Math.max(1, u * 0.008);
  sketchStroke(ctx, [[0, shY - u * 0.02], [noise(s) * u * 0.006, waistY - u * 0.1], [0, hipY + u * 0.02]], s + 3, u * 0.004);
  for (const side of [-1, 1]) {
    // shoulder blade
    sketchStroke(ctx, [[side * sh * 0.22, shY + u * 0.08], [side * sh * 0.5, shY + u * 0.05], [side * sh * 0.62, shY + u * 0.14], [side * sh * 0.34, shY + u * 0.26]], s + 10 + side, u * 0.004);
    // trapezius from neck to shoulder
    sketchStroke(ctx, [[side * u * 0.06, shY - u * 0.06], [side * sh * 0.72, shY + u * 0.02]], s + 20 + side, u * 0.004);
    // lats
    sketchStroke(ctx, [[side * sh * 0.86, shY + u * 0.2], [side * sh * 0.6, waistY - u * 0.02]], s + 30 + side, u * 0.004);
    ctx.fillStyle = SKIN_DEEP;
    ctx.beginPath();
    ctx.arc(side * sh * 0.22, hipY - u * 0.02, u * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  // print seam: the faint line where the vat mould joined, down one side
  ctx.strokeStyle = 'rgba(185,80,90,0.55)';
  ctx.setLineDash([u * 0.015, u * 0.012]);
  ctx.beginPath();
  ctx.moveTo(-sh * 0.8, shY + u * 0.1);
  ctx.quadraticCurveTo(-sh * 0.75, waistY - u * 0.1, -sh * 0.62, hipY + u * 0.05);
  ctx.stroke();
  ctx.setLineDash([]);
  // rim light down the right edge of the back
  ctx.strokeStyle = SKIN_LIGHT;
  ctx.lineWidth = u * 0.014;
  ctx.beginPath();
  ctx.moveTo(sh * 0.96, shY + u * 0.1);
  ctx.quadraticCurveTo(sh * 0.78, waistY - u * 0.1, sh * 0.6, waistY + u * 0.02);
  ctx.stroke();

  // hide: bony plates breaking through along the spine and over the shoulders
  const plates = Math.max(0, Math.min(6, t.hde - 2));
  for (let i = 0; i < plates; i++) {
    const py = shY + u * (0.1 + i * 0.075);
    ctx.fillStyle = INK.bone;
    ctx.beginPath();
    ctx.moveTo(-u * 0.035, py + u * 0.03);
    ctx.lineTo(0, py - u * 0.02);
    ctx.lineTo(u * 0.035, py + u * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, line * 0.7);
    ctx.stroke();
    if (i < 3) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * sh * (0.78 - i * 0.08), shY + u * (0.02 + i * 0.05), u * 0.05, u * 0.025, side * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = INK.boneDim;
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // neck and a bald head from behind
  limb(ctx, [0, shY + u * 0.02], [0, shY - u * 0.14], u * 0.07, u * 0.06, SKIN_SHADE, line);
  // the print code tattooed on the nape
  ctx.fillStyle = OUTLINE;
  for (let i = 0; i < 7; i++) ctx.fillRect(-u * 0.035 + i * u * 0.011, shY - u * 0.07, i % 3 ? u * 0.004 : u * 0.007, u * 0.028);
  const hy = shY - u * 0.27;
  for (const side of [-1, 1]) {
    ctx.fillStyle = SKIN_SHADE;
    ctx.beginPath();
    ctx.ellipse(side * u * 0.118, hy + u * 0.03, u * 0.022, u * 0.04, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, hy, u * 0.12, u * 0.145, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(94,74,67,0.5)';
  ctx.fillRect(-u * 0.12, hy - u * 0.13, u * 0.24, u * 0.32);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0, hy, u * 0.12, u * 0.145, 0, 0, Math.PI * 2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = line * 1.2;
  ctx.stroke();
  // rim light on the skull
  ctx.strokeStyle = SKIN_LIGHT;
  ctx.lineWidth = u * 0.012;
  ctx.beginPath();
  ctx.arc(0, hy, u * 0.11, -1.3, 0.3);
  ctx.stroke();
  // the socket where the vat cable went in
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.arc(0, hy + u * 0.07, u * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(185,80,90,0.8)';
  ctx.lineWidth = Math.max(1, u * 0.006);
  ctx.beginPath();
  ctx.arc(0, hy + u * 0.07, u * 0.032, 0, Math.PI * 2);
  ctx.stroke();

  if (fx.heal > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(127,212,138,${fx.heal * 0.6})`;
    ctx.fillRect(-u, -u * 1.4, u * 2, u * 1.7);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (fx.flash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,236,226,${fx.flash * 0.7})`;
    ctx.fillRect(-u, -u * 1.4, u * 2, u * 1.7);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ---- the overworld figure ----

type V3 = [number, number, number]; // lateral (right), up, forward

/**
 * The clone on the overworld: a small bare figure with a real walk cycle. It is posed as a
 * little 3D skeleton (legs stride, arms swing against them, the body bobs) and turned to face
 * the way it walks, so the same pose reads from the front, the side or the back.
 */
export function drawCloneTop(ctx: CanvasRenderingContext2D, x: number, footY: number, tile: number, facing: [number, number], t: number, walking: boolean) {
  const T = tile * 1.2;
  ctx.save();
  ctx.translate(x, footY);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const line = Math.max(1, T * 0.03);
  // yaw 0 = facing the viewer (down the screen), π = away, ±π/2 = sideways
  const yaw = facing[1] > 0 ? 0 : facing[1] < 0 ? Math.PI : facing[0] > 0 ? Math.PI / 2 : -Math.PI / 2;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ph = t * 11;
  const stride = walking ? 1 : 0;
  const bob = walking ? Math.abs(Math.cos(ph)) * T * 0.035 : Math.sin(t * 2) * T * 0.006;
  // world (lateral, up, forward) → screen (x, y) and depth toward the viewer
  const P = (v: V3): { x: number; y: number; d: number } => {
    const d = -v[0] * sy + v[2] * cy;
    return { x: (v[0] * cy + v[2] * sy) * T, y: (-v[1] + d * 0.28) * T - bob * (v[1] > 0.3 ? 1 : 0), d };
  };
  const pt = (v: V3): Pt => { const p = P(v); return [p.x, p.y]; };

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 0, T * 0.2, T * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  type Part = { d: number; draw: () => void };
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    // legs: opposite phases; the swinging foot lifts off the floor
    const sw = Math.sin(ph + (side > 0 ? Math.PI : 0)) * stride;
    const lift = Math.max(0, Math.cos(ph + (side > 0 ? Math.PI : 0))) * 0.06 * stride;
    const hip: V3 = [side * 0.065, 0.42, 0];
    const knee: V3 = [side * 0.07, 0.22 + lift * 0.6, 0.03 + sw * 0.1];
    const foot: V3 = [side * 0.07, 0.02 + lift, sw * 0.17];
    const legD = (P(hip).d + P(foot).d) / 2;
    const shade = side * sy > 0 ? SKIN_SHADE : SKIN;
    parts.push({ d: legD - 0.02, draw: () => {
      limb(ctx, pt(hip), pt(knee), T * 0.055, T * 0.045, shade, line);
      limb(ctx, pt(knee), pt(foot), T * 0.045, T * 0.035, shade, line);
    } });
    // arms swing against the leg on the same side
    const asw = -sw;
    const sho: V3 = [side * 0.14, 0.68, 0];
    const elb: V3 = [side * 0.17, 0.53, asw * 0.08];
    const hand: V3 = [side * 0.17, 0.4, asw * 0.16];
    const armD = (P(sho).d + P(hand).d) / 2;
    parts.push({ d: armD + (Math.abs(sy) > 0.5 ? side * -sy * 0.05 : 0.01), draw: () => {
      limb(ctx, pt(sho), pt(elb), T * 0.042, T * 0.035, shade, line);
      limb(ctx, pt(elb), pt(hand), T * 0.035, T * 0.03, shade, line);
    } });
  }
  // torso: its screen width blends shoulder width and chest depth as the body turns
  parts.push({ d: 0, draw: () => {
    const w = (lat: number, dep: number) => Math.abs(cy) * lat + Math.abs(sy) * dep;
    const y = (up: number) => -up * T - bob;
    const tor: Pt[] = [
      [-w(0.15, 0.08) * T, y(0.7)], [-w(0.12, 0.075) * T, y(0.56)], [-w(0.09, 0.065) * T, y(0.45)], [-w(0.1, 0.07) * T, y(0.38)],
      [w(0.1, 0.07) * T, y(0.38)], [w(0.09, 0.065) * T, y(0.45)], [w(0.12, 0.075) * T, y(0.56)], [w(0.15, 0.08) * T, y(0.7)],
      [w(0.06, 0.05) * T, y(0.74)], [-w(0.06, 0.05) * T, y(0.74)],
    ];
    blob(ctx, tor);
    ctx.fillStyle = SKIN;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // hard shadow on the side away from the light (upper left)
    ctx.fillStyle = 'rgba(94,74,67,0.55)';
    ctx.fillRect(T * 0.02, y(0.76), T * 0.2, T * 0.4);
    ctx.restore();
    blob(ctx, tor);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.strokeStyle = SKIN_DEEP;
    ctx.lineWidth = Math.max(1, line * 0.6);
    ctx.beginPath();
    if (yaw === Math.PI) { ctx.moveTo(0, y(0.7)); ctx.lineTo(0, y(0.42)); } // spine
    else if (yaw === 0) { ctx.moveTo(-T * 0.05, y(0.6)); ctx.quadraticCurveTo(0, y(0.56), T * 0.05, y(0.6)); ctx.moveTo(0, y(0.55)); ctx.lineTo(0, y(0.44)); } // chest, sternum
    ctx.stroke();
  } });
  parts.sort((a, b) => a.d - b.d).forEach((p) => p.draw());

  // head: bald; a blank pale face with dark eyes when it looks toward you or sideways
  const hx = sy * T * 0.015;
  const hy = -T * 0.84 - bob;
  ctx.beginPath();
  ctx.ellipse(hx, hy, T * 0.11, T * 0.125, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(94,74,67,0.5)';
  ctx.fillRect(hx + T * 0.02, hy - T * 0.14, T * 0.12, T * 0.28);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(hx, hy, T * 0.11, T * 0.125, 0, 0, Math.PI * 2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = line;
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  if (yaw === 0) {
    ctx.beginPath();
    ctx.ellipse(hx - T * 0.042, hy - T * 0.005, T * 0.022, T * 0.014, 0, 0, Math.PI * 2);
    ctx.ellipse(hx + T * 0.042, hy - T * 0.005, T * 0.022, T * 0.014, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (yaw !== Math.PI) {
    ctx.beginPath();
    ctx.ellipse(hx + sy * T * 0.06, hy - T * 0.005, T * 0.018, T * 0.013, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // the socket at the back of the skull
    ctx.beginPath();
    ctx.arc(hx, hy + T * 0.04, T * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  // the print code on the nape or the chest, in sodium
  ctx.fillStyle = INK.sodium;
  if (yaw !== 0) ctx.fillRect(-T * 0.03, -T * 0.72 - bob, T * 0.06, T * 0.015);
  ctx.restore();
}
