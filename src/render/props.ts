import { INK } from './palette';
import { hash, shade } from './texture';

/**
 * Map props in the same comic three-quarter style as the textured floor and walls: every object
 * is a solid with a lit top, a shaded front, an ink outline and a contact shadow, dressed for the
 * planet it stands on (bare metal on the Derelict, frost on Kessra, moss and wood on Mireth).
 */

const INKLINE = '#0b0c0e';

export interface PropCtx {
  ctx: CanvasRenderingContext2D;
  T: number;
  /** Centre of the tile on screen, and the y of its floor line (where things stand). */
  cx: number;
  fy: number;
  t: number;
  planet: string;
  seed: number;
}

function outline(ctx: CanvasRenderingContext2D, w: number) {
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function contact(c: PropCtx, rx: number, ry = 0.3) {
  const { ctx, cx, fy, T } = c;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx + T * 0.04, fy + T * 0.02, rx * T, rx * T * ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A box in three-quarter view: a front face `h` tall and `w` wide standing on the floor line,
 * with its top face `d` deep seen from above. Returns the corners for dressing.
 */
function box(c: PropCtx, w: number, d: number, h: number, top: string, front: string, oy = 0) {
  const { ctx, cx, fy, T } = c;
  const x0 = cx - (w * T) / 2;
  const x1 = cx + (w * T) / 2;
  const yb = fy - oy * T;
  const yf = yb - h * T;
  const yt = yf - d * T * 0.55;
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.rect(x0, yf, x1 - x0, yb - yf);
  ctx.fill();
  // a hard shadow band down the right of the front face (light from the upper left)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x0 + (x1 - x0) * 0.72, yf, (x1 - x0) * 0.28, yb - yf);
  ctx.beginPath();
  ctx.rect(x0, yf, x1 - x0, yb - yf);
  outline(ctx, Math.max(1, T * 0.035));
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.rect(x0, yt, x1 - x0, yf - yt);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x0 + 1, yt + 1, x1 - x0 - 2, Math.max(1, T * 0.03));
  ctx.beginPath();
  ctx.rect(x0, yt, x1 - x0, yf - yt);
  outline(ctx, Math.max(1, T * 0.035));
  return { x0, x1, yb, yf, yt };
}

/** An upright cylinder: body, elliptical top, ink edges, a hard highlight streak. */
function cylinder(c: PropCtx, rx: number, h: number, body: string, top: string, oy = 0, glass = false) {
  const { ctx, cx, fy, T } = c;
  const r = rx * T;
  const ry = r * 0.36;
  const yb = fy - oy * T;
  const yt = yb - h * T;
  ctx.beginPath();
  ctx.moveTo(cx - r, yt);
  ctx.lineTo(cx - r, yb);
  ctx.ellipse(cx, yb, r, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r, yt);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx + r * 0.35, yt - ry, r, h * T + ry * 2);
  ctx.fillStyle = glass ? 'rgba(235,250,255,0.35)' : 'rgba(255,255,255,0.14)';
  ctx.fillRect(cx - r * 0.62, yt, r * 0.16, h * T);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - r, yt);
  ctx.lineTo(cx - r, yb);
  ctx.ellipse(cx, yb, r, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r, yt);
  outline(ctx, Math.max(1, T * 0.035));
  ctx.beginPath();
  ctx.ellipse(cx, yt, r, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = top;
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.035));
  return { r, ry, yb, yt };
}

/** Planet dressing on a flat top: moss on Mireth, a frost rim on Kessra, grime on the Derelict. */
function dress(c: PropCtx, x0: number, x1: number, y: number) {
  const { ctx, T, planet, seed } = c;
  if (planet === 'mireth') {
    ctx.fillStyle = 'rgba(110,145,65,0.85)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x0 + (x1 - x0) * (0.15 + 0.23 * i + 0.05 * hash(seed, i, 1)), y + T * 0.02, T * 0.07, T * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(110,145,65,0.8)';
    ctx.lineWidth = Math.max(1, T * 0.025);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const mx = x0 + (x1 - x0) * (0.2 + 0.3 * i);
      ctx.moveTo(mx, y + T * 0.04);
      ctx.lineTo(mx + T * 0.01, y + T * (0.12 + 0.08 * hash(seed, i, 2)));
    }
    ctx.stroke();
  } else if (planet === 'kessra') {
    ctx.fillStyle = 'rgba(230,248,252,0.85)';
    ctx.beginPath();
    ctx.moveTo(x0, y);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x0 + ((x1 - x0) * i) / 6, y - T * 0.02 + (i % 2) * T * 0.035);
    ctx.lineTo(x1, y - T * 0.03);
    ctx.lineTo(x0, y - T * 0.03);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- the props

export function drawCache(c: PropCtx, used: boolean) {
  const { ctx, cx, T, t } = c;
  contact(c, 0.36);
  const wood = c.planet === 'mireth';
  const body = wood ? '#5a4630' : c.planet === 'kessra' ? '#465a64' : '#55524a';
  const lid = wood ? '#6e573b' : c.planet === 'kessra' ? '#5c7480' : '#6d695e';
  const b = box(c, 0.66, 0.44, 0.36, used ? shade(lid, -0.45) : lid, used ? shade(body, -0.4) : body);
  if (used) {
    // lid flung back, the inside dark
    ctx.fillStyle = '#121315';
    ctx.fillRect(b.x0 + T * 0.05, b.yt + T * 0.04, b.x1 - b.x0 - T * 0.1, b.yf - b.yt - T * 0.06);
    ctx.fillStyle = shade(lid, -0.2);
    ctx.beginPath();
    ctx.moveTo(b.x0, b.yt);
    ctx.lineTo(b.x1, b.yt);
    ctx.lineTo(b.x1 - T * 0.04, b.yt - T * 0.22);
    ctx.lineTo(b.x0 + T * 0.04, b.yt - T * 0.22);
    ctx.closePath();
    ctx.fill();
    outline(ctx, Math.max(1, T * 0.03));
    return;
  }
  // straps and a hazard band, a latch, rivets
  ctx.fillStyle = wood ? '#3a2c1c' : INK.sodium;
  ctx.fillRect(b.x0, b.yf + (b.yb - b.yf) * 0.35, b.x1 - b.x0, (b.yb - b.yf) * 0.2);
  if (!wood) {
    ctx.fillStyle = INKLINE;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      const sx = b.x0 + ((b.x1 - b.x0) * k) / 5;
      ctx.moveTo(sx, b.yf + (b.yb - b.yf) * 0.55);
      ctx.lineTo(sx + T * 0.06, b.yf + (b.yb - b.yf) * 0.35);
      ctx.lineTo(sx + T * 0.1, b.yf + (b.yb - b.yf) * 0.35);
      ctx.lineTo(sx + T * 0.04, b.yf + (b.yb - b.yf) * 0.55);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#1a1b1e';
  ctx.fillRect(cx - T * 0.05, b.yf + T * 0.03, T * 0.1, T * 0.1);
  ctx.fillStyle = 0.5 + 0.5 * Math.sin(t * 3 + c.seed) > 0.5 ? INK.toxin : '#2f4a33';
  ctx.fillRect(cx - T * 0.02, b.yf + T * 0.06, T * 0.04, T * 0.03);
  dress(c, b.x0, b.x1, b.yt);
}

export function drawVent(c: PropCtx, used: boolean) {
  const { ctx, cx, fy, T, t } = c;
  const yc = fy - T * 0.22;
  // a raised collar around a floor grille
  ctx.fillStyle = '#26282c';
  ctx.beginPath();
  ctx.ellipse(cx, yc + T * 0.06, T * 0.4, T * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.035));
  ctx.fillStyle = '#3d3f44';
  ctx.beginPath();
  ctx.ellipse(cx, yc, T * 0.4, T * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.035));
  ctx.fillStyle = '#0c0d0f';
  ctx.beginPath();
  ctx.ellipse(cx, yc, T * 0.3, T * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // an ember glow down in the shaft while it's still warm
  if (!used) {
    const g = ctx.createRadialGradient(cx, yc, 0, cx, yc, T * 0.3);
    g.addColorStop(0, `rgba(227,130,59,${0.55 + 0.2 * Math.sin(t * 2 + c.seed)})`);
    g.addColorStop(1, 'rgba(227,130,59,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, yc, T * 0.3, T * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#55575c';
  ctx.lineWidth = Math.max(1, T * 0.03);
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    const hw = Math.sqrt(1 - (k / 3) ** 2) * T * 0.13;
    ctx.moveTo(cx + k * T * 0.1, yc - hw);
    ctx.lineTo(cx + k * T * 0.1, yc + hw);
  }
  ctx.stroke();
  if (!used) {
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.5 + k / 4) % 1;
      ctx.fillStyle = `rgba(216,207,184,${0.32 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(ph * 5 + k) * T * 0.12, yc - T * 0.1 - ph * T * 1.0, T * (0.08 + ph * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawNest(c: PropCtx, used: boolean) {
  const { ctx, cx, fy, T, t, seed } = c;
  contact(c, 0.46);
  if (used) {
    // burnt out: a black crusted ring, a few embers
    ctx.fillStyle = '#1a1414';
    ctx.beginPath();
    ctx.ellipse(cx, fy - T * 0.12, T * 0.42, T * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, Math.max(1, T * 0.035));
    ctx.fillStyle = '#0a0808';
    ctx.beginPath();
    ctx.ellipse(cx, fy - T * 0.14, T * 0.24, T * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(227,120,59,${0.4 + 0.4 * Math.sin(t * 4 + k * 2)})`;
      ctx.fillRect(cx + (hash(seed, k, 1) - 0.5) * T * 0.6, fy - T * (0.1 + 0.1 * hash(seed, k, 2)), 2, 2);
    }
    return;
  }
  const pulse = 1 + Math.sin(t * 2.4) * 0.05;
  // a heap of flesh lobes, lit on top, dark underneath
  const lobes: [number, number, number][] = [[-0.22, -0.22, 0.24], [0.2, -0.2, 0.22], [0, -0.36, 0.28], [-0.1, -0.52, 0.18], [0.14, -0.48, 0.16]];
  for (const [ox, oy, r] of lobes) {
    const x = cx + ox * T;
    const y = fy + oy * T;
    const rr = r * T * pulse;
    ctx.fillStyle = INK.fleshDark;
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, Math.max(1, T * 0.035));
    ctx.fillStyle = 'rgba(185,80,90,0.75)';
    ctx.beginPath();
    ctx.ellipse(x - rr * 0.2, y - rr * 0.3, rr * 0.55, rr * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // veins and burrow mouths
  ctx.strokeStyle = 'rgba(40,10,16,0.8)';
  ctx.lineWidth = Math.max(1, T * 0.02);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = hash(seed, k, 3) * Math.PI * 2;
    ctx.moveTo(cx, fy - T * 0.36);
    ctx.quadraticCurveTo(cx + Math.cos(a) * T * 0.15, fy - T * 0.36 + Math.sin(a) * T * 0.1, cx + Math.cos(a) * T * 0.3, fy - T * 0.3 + Math.sin(a) * T * 0.12);
  }
  ctx.stroke();
  for (const [ox, oy] of [[-0.18, -0.2], [0.16, -0.28]]) {
    ctx.fillStyle = '#0a0506';
    ctx.beginPath();
    ctx.ellipse(cx + ox * T, fy + oy * T, T * 0.07, T * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // glistening sacs
  for (let k = 0; k < 3; k++) {
    const x = cx + (hash(seed, k, 5) - 0.5) * T * 0.5;
    const y = fy - T * (0.3 + 0.2 * hash(seed, k, 6));
    ctx.fillStyle = `rgba(230,190,120,${0.55 + 0.25 * Math.sin(t * 3 + k)})`;
    ctx.beginPath();
    ctx.arc(x, y, T * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x - T * 0.015, y - T * 0.02, 2, 2);
  }
}

export function drawPod(c: PropCtx, spent: boolean) {
  const { ctx, cx, fy, T, t } = c;
  contact(c, 0.32);
  // base, glass tube, cap
  cylinder(c, 0.3, 0.12, '#2b2d31', '#3d3f44');
  const glass = spent ? 'rgba(44,58,58,0.9)' : `rgba(111,163,160,${0.62 + 0.12 * Math.sin(t * 2 + c.seed)})`;
  const g = cylinder(c, 0.22, 0.78, glass, 'rgba(160,210,205,0.5)', 0.12, true);
  if (!spent) {
    // a curled half-grown body in the fluid, and bubbles
    ctx.fillStyle = INK.fleshDark;
    const by = g.yt + (g.yb - g.yt) * 0.5 + Math.sin(t * 1.3) * T * 0.03;
    ctx.beginPath();
    ctx.ellipse(cx, by, T * 0.09, T * 0.17, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - T * 0.02, by - T * 0.18, T * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,250,248,0.8)';
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.45 + k / 4) % 1;
      ctx.beginPath();
      ctx.arc(cx - T * 0.1 + k * T * 0.07, g.yb - T * 0.05 - ph * (g.yb - g.yt - T * 0.1), T * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  cylinder(c, 0.26, 0.08, '#3a3c41', '#55575c', 0.9);
  ctx.fillStyle = spent ? '#403030' : INK.toxin;
  ctx.fillRect(cx - T * 0.03, fy - T * 0.08, T * 0.06, T * 0.04);
}

export function drawVat(c: PropCtx) {
  const { ctx, cx, fy, T, t } = c;
  contact(c, 0.44);
  cylinder(c, 0.4, 0.14, '#26282c', '#3a3c41');
  const g = cylinder(c, 0.34, 0.64, 'rgba(38,52,58,0.92)', 'rgba(20,26,30,0.95)', 0.14, true);
  // dried residue at the bottom, a crack running up the glass
  ctx.fillStyle = 'rgba(90,37,48,0.8)';
  ctx.fillRect(cx - T * 0.32, g.yb - T * 0.12, T * 0.64, T * 0.08);
  ctx.strokeStyle = 'rgba(230,240,240,0.7)';
  ctx.lineWidth = Math.max(1, T * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx + T * 0.1, g.yt + T * 0.02);
  ctx.lineTo(cx + T * 0.02, g.yt + T * 0.2);
  ctx.lineTo(cx + T * 0.12, g.yt + T * 0.34);
  ctx.moveTo(cx + T * 0.02, g.yt + T * 0.2);
  ctx.lineTo(cx - T * 0.06, g.yt + T * 0.26);
  ctx.stroke();
  // the sequencer still wired in: a lamp on the rim
  cylinder(c, 0.38, 0.06, '#3a3c41', '#55575c', 0.78);
  ctx.fillStyle = INK.sodium;
  ctx.globalAlpha = 0.5 + 0.45 * Math.sin(t * 2.5 + c.seed);
  ctx.fillRect(cx - T * 0.05, fy - T * 0.9, T * 0.1, T * 0.05);
  ctx.globalAlpha = 1;
  // cables snaking off to the floor
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = Math.max(1, T * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx + T * 0.36, fy - T * 0.7);
  ctx.quadraticCurveTo(cx + T * 0.55, fy - T * 0.4, cx + T * 0.48, fy);
  ctx.stroke();
}

export function drawTerminal(c: PropCtx, on: boolean) {
  const { ctx, T, t } = c;
  contact(c, 0.36);
  const b = box(c, 0.58, 0.3, 0.52, '#45474c', '#35373b');
  // the screen, tilted back on the top face
  const sx0 = b.x0 + T * 0.06;
  const sx1 = b.x1 - T * 0.06;
  const sy0 = b.yf - T * 0.34;
  ctx.fillStyle = '#1a1b1e';
  ctx.beginPath();
  ctx.moveTo(sx0, b.yf - T * 0.02);
  ctx.lineTo(sx1, b.yf - T * 0.02);
  ctx.lineTo(sx1 - T * 0.03, sy0);
  ctx.lineTo(sx0 + T * 0.03, sy0);
  ctx.closePath();
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.03));
  ctx.fillStyle = on ? `rgba(127,212,138,${0.6 + 0.25 * Math.sin(t * 5 + c.seed)})` : '#203024';
  ctx.fillRect(sx0 + T * 0.06, sy0 + T * 0.04, sx1 - sx0 - T * 0.12, b.yf - sy0 - T * 0.1);
  if (on) {
    ctx.fillStyle = 'rgba(10,30,14,0.7)';
    for (let k = 0; k < 4; k++) ctx.fillRect(sx0 + T * 0.08, sy0 + T * (0.07 + k * 0.05), (sx1 - sx0 - T * 0.2) * (0.4 + 0.6 * hash(c.seed, k + Math.floor(t * 2), 7)), 1);
  }
  // keys on the front
  ctx.fillStyle = '#6d695e';
  for (let k = 0; k < 4; k++) ctx.fillRect(b.x0 + T * 0.07 + k * T * 0.11, b.yf + T * 0.08, T * 0.07, T * 0.05);
  dress(c, b.x0, b.x1, b.yt);
}

export function drawSurgery(c: PropCtx) {
  const { ctx, cx, fy, T, t } = c;
  contact(c, 0.44, 0.35);
  // table legs, then the slab
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = Math.max(1, T * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - T * 0.3, fy);
  ctx.lineTo(cx - T * 0.3, fy - T * 0.22);
  ctx.moveTo(cx + T * 0.3, fy);
  ctx.lineTo(cx + T * 0.3, fy - T * 0.22);
  ctx.stroke();
  const b = box(c, 0.8, 0.46, 0.1, '#8c8574', '#55524a', 0.22);
  // a stain and straps
  ctx.fillStyle = 'rgba(90,30,36,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx + T * 0.05, b.yt + (b.yf - b.yt) * 0.5, T * 0.14, T * 0.05, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2b2e';
  ctx.fillRect(cx - T * 0.22, b.yt, T * 0.05, b.yb - b.yt);
  ctx.fillRect(cx + T * 0.18, b.yt, T * 0.05, b.yb - b.yt);
  // the lamp arm over it
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = Math.max(1, T * 0.04);
  ctx.beginPath();
  ctx.moveTo(b.x1 - T * 0.04, b.yt);
  ctx.lineTo(b.x1 - T * 0.02, fy - T * 1.0);
  ctx.lineTo(cx + T * 0.02, fy - T * 1.0);
  ctx.stroke();
  ctx.fillStyle = '#3a3c41';
  ctx.beginPath();
  ctx.moveTo(cx - T * 0.1, fy - T * 0.92);
  ctx.lineTo(cx + T * 0.14, fy - T * 0.92);
  ctx.lineTo(cx + T * 0.08, fy - T * 1.04);
  ctx.lineTo(cx - T * 0.04, fy - T * 1.04);
  ctx.closePath();
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.03));
  ctx.fillStyle = `rgba(255,236,190,${0.75 + 0.2 * Math.sin(t * 7 + c.seed)})`;
  ctx.fillRect(cx - T * 0.08, fy - T * 0.93, T * 0.2, T * 0.03);
}

export function drawEvent(c: PropCtx, used: boolean) {
  const { ctx, cx, fy, T, t } = c;
  contact(c, 0.26);
  // a leaning black monolith with a glyph cut into it
  const lean = 0.08;
  const h = T * 0.8;
  const w = T * 0.2;
  ctx.fillStyle = used ? '#1c1d20' : '#141418';
  ctx.beginPath();
  ctx.moveTo(cx - w, fy);
  ctx.lineTo(cx - w * 0.8 + h * lean, fy - h);
  ctx.lineTo(cx + w * 0.8 + h * lean, fy - h - T * 0.04);
  ctx.lineTo(cx + w, fy);
  ctx.closePath();
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.035));
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(cx - w, fy);
  ctx.lineTo(cx - w * 0.8 + h * lean, fy - h);
  ctx.lineTo(cx - w * 0.5 + h * lean, fy - h);
  ctx.lineTo(cx - w * 0.6, fy);
  ctx.fill();
  if (used) return;
  const glow = 0.5 + 0.5 * Math.sin(t * 2.6 + c.seed);
  ctx.strokeStyle = `rgba(176,111,224,${0.6 + 0.4 * glow})`;
  ctx.lineWidth = Math.max(1, T * 0.035);
  const gx = cx + h * lean * 0.5;
  const gy = fy - h * 0.55;
  ctx.beginPath();
  ctx.arc(gx, gy - T * 0.06, T * 0.07, Math.PI, Math.PI * 2.4);
  ctx.lineTo(gx, gy + T * 0.06);
  ctx.moveTo(gx, gy + T * 0.12);
  ctx.lineTo(gx, gy + T * 0.13);
  ctx.stroke();
  // violet motes rising off it
  ctx.fillStyle = INK.signal;
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.4 + k / 3) % 1;
    ctx.globalAlpha = 0.7 * (1 - ph);
    ctx.fillRect(gx + Math.sin(ph * 6 + k) * T * 0.15, fy - h - ph * T * 0.5, 2, 2);
  }
  ctx.globalAlpha = 1;
}

export function drawShip(c: PropCtx, ready: boolean) {
  const { ctx, cx, fy, T, t } = c;
  const s = T;
  contact(c, 0.9, 0.28);
  // landing legs
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = Math.max(1.5, T * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.45, fy - s * 0.35);
  ctx.lineTo(cx - s * 0.8, fy + s * 0.04);
  ctx.moveTo(cx + s * 0.45, fy - s * 0.35);
  ctx.lineTo(cx + s * 0.8, fy + s * 0.04);
  ctx.stroke();
  ctx.fillStyle = '#3a3c41';
  ctx.fillRect(cx - s * 0.88, fy, s * 0.16, s * 0.05);
  ctx.fillRect(cx + s * 0.72, fy, s * 0.16, s * 0.05);
  // the hull: a squat lander, lit from the upper left
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, fy - s * 0.25);
  ctx.quadraticCurveTo(cx - s * 0.62, fy - s * 0.95, cx, fy - s * 1.2);
  ctx.quadraticCurveTo(cx + s * 0.62, fy - s * 0.95, cx + s * 0.6, fy - s * 0.25);
  ctx.quadraticCurveTo(cx, fy - s * 0.1, cx - s * 0.6, fy - s * 0.25);
  ctx.closePath();
  ctx.fillStyle = '#5e5a50';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(cx + s * 0.12, fy - s * 1.3, s, s * 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(cx - s * 0.5, fy - s * 1.1, s * 0.12, s * 0.8);
  // panel seams and a scorched lower hull
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.6, fy - s * (0.25 + k * 0.22));
    ctx.quadraticCurveTo(cx, fy - s * (0.1 + k * 0.22), cx + s * 0.6, fy - s * (0.25 + k * 0.22));
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, fy - s * 0.45, 0, fy - s * 0.1);
  g.addColorStop(0, 'rgba(20,14,10,0)');
  g.addColorStop(1, 'rgba(20,14,10,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - s, fy - s * 0.5, s * 2, s * 0.5);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, fy - s * 0.25);
  ctx.quadraticCurveTo(cx - s * 0.62, fy - s * 0.95, cx, fy - s * 1.2);
  ctx.quadraticCurveTo(cx + s * 0.62, fy - s * 0.95, cx + s * 0.6, fy - s * 0.25);
  ctx.quadraticCurveTo(cx, fy - s * 0.1, cx - s * 0.6, fy - s * 0.25);
  outline(ctx, Math.max(1.5, T * 0.045));
  // cockpit glass
  ctx.fillStyle = '#1d2a30';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.05, fy - s * 0.82, s * 0.22, s * 0.12, -0.1, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.035));
  ctx.fillStyle = 'rgba(200,235,240,0.55)';
  ctx.fillRect(cx - s * 0.18, fy - s * 0.88, s * 0.1, s * 0.03);
  // the ramp and its lit doorway
  ctx.fillStyle = ready ? `rgba(127,212,138,${0.7 + 0.3 * Math.sin(t * 3)})` : `rgba(227,163,59,${0.6 + 0.3 * Math.sin(t * 3)})`;
  ctx.fillRect(cx - s * 0.1, fy - s * 0.42, s * 0.2, s * 0.22);
  ctx.fillStyle = '#3a3c41';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, fy - s * 0.2);
  ctx.lineTo(cx + s * 0.12, fy - s * 0.2);
  ctx.lineTo(cx + s * 0.18, fy + s * 0.02);
  ctx.lineTo(cx - s * 0.18, fy + s * 0.02);
  ctx.closePath();
  ctx.fill();
  outline(ctx, Math.max(1, T * 0.03));
  // blinking nav lights
  const blink = Math.sin(t * 4) > 0.3;
  ctx.fillStyle = blink ? '#ff6a5a' : '#4a2020';
  ctx.fillRect(cx - s * 0.58, fy - s * 0.5, s * 0.05, s * 0.05);
  ctx.fillStyle = !blink ? '#7fd48a' : '#1f3a24';
  ctx.fillRect(cx + s * 0.53, fy - s * 0.5, s * 0.05, s * 0.05);
  // a heat shimmer under the engines when it is ready to lift
  if (ready) {
    ctx.fillStyle = `rgba(227,163,59,${0.25 + 0.15 * Math.sin(t * 9)})`;
    ctx.beginPath();
    ctx.ellipse(cx, fy - s * 0.1, s * 0.4, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBeaconProp(c: PropCtx, used: boolean) {
  const { ctx, cx, fy, T, t } = c;
  contact(c, 0.18);
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = Math.max(1, T * 0.04);
  ctx.beginPath();
  // tripod
  ctx.moveTo(cx - T * 0.14, fy);
  ctx.lineTo(cx, fy - T * 0.5);
  ctx.lineTo(cx + T * 0.14, fy);
  ctx.moveTo(cx, fy - T * 0.5);
  ctx.lineTo(cx + T * 0.03, fy + T * 0.02);
  ctx.moveTo(cx, fy - T * 0.5);
  ctx.lineTo(cx, fy - T * 0.72);
  ctx.stroke();
  ctx.fillStyle = used ? INK.boneDim : INK.sodium;
  ctx.globalAlpha = used ? 0.6 : 0.6 + 0.4 * Math.sin(t * 4);
  ctx.beginPath();
  ctx.arc(cx, fy - T * 0.76, T * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  outline(ctx, Math.max(1, T * 0.03));
}

/** A closed blast door filling the tile, or a heap of debris. */
export function drawDoor(c: PropCtx, lift: number, rating: number, forcible: boolean) {
  const { ctx, cx, fy, T, t } = c;
  const x0 = cx - T / 2;
  const yb = fy + T * 0.15;
  const yt = yb - T - lift;
  // frame pillars
  ctx.fillStyle = '#2a2b2e';
  ctx.fillRect(x0, yt, T * 0.14, yb - yt);
  ctx.fillRect(x0 + T * 0.86, yt, T * 0.14, yb - yt);
  // the two leaves with hazard chevrons where they meet
  ctx.fillStyle = '#4a4438';
  ctx.fillRect(x0 + T * 0.14, yt + T * 0.08, T * 0.72, yb - yt - T * 0.08);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x0 + T * 0.5, yt + T * 0.08, T * 0.36, yb - yt - T * 0.08);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + T * 0.14, yb - T * 0.34, T * 0.72, T * 0.16);
  ctx.clip();
  for (let k = -3; k < 8; k++) {
    ctx.fillStyle = k % 2 ? INK.sodium : '#141414';
    ctx.beginPath();
    ctx.moveTo(x0 + k * T * 0.12, yb - T * 0.18);
    ctx.lineTo(x0 + k * T * 0.12 + T * 0.12, yb - T * 0.18);
    ctx.lineTo(x0 + k * T * 0.12 + T * 0.28, yb - T * 0.34);
    ctx.lineTo(x0 + k * T * 0.12 + T * 0.16, yb - T * 0.34);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = INKLINE;
  ctx.lineWidth = Math.max(1, T * 0.035);
  ctx.strokeRect(x0, yt, T, yb - yt);
  ctx.beginPath();
  ctx.moveTo(cx, yt + T * 0.08);
  ctx.lineTo(cx, yb);
  ctx.stroke();
  // lock lamp: red, or amber if it can be forced
  ctx.fillStyle = forcible ? INK.sodium : '#d0504a';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + c.seed);
  ctx.fillRect(cx - T * 0.05, yt + T * 0.14, T * 0.1, T * 0.05);
  ctx.globalAlpha = 1;
  // rating pips on the lintel
  ctx.fillStyle = forcible ? INK.bone : INK.flesh;
  for (let k = 0; k < rating; k++) ctx.fillRect(x0 + T * 0.18 + k * T * 0.12, yt + T * 0.02, T * 0.07, T * 0.04);
}

export function drawDebris(c: PropCtx, rating: number, forcible: boolean) {
  const { ctx, cx, fy, T, planet, seed } = c;
  contact(c, 0.48);
  const col = planet === 'kessra' ? '#6fa3c0' : planet === 'mireth' ? '#4a3b28' : '#5a4a3a';
  // a heap of beams, slabs or fallen trunks, back to front
  for (let k = 0; k < 6; k++) {
    const ox = (hash(seed, k, 1) - 0.5) * T * 0.6;
    const oy = -T * (0.12 + 0.35 * (k / 6)) + (hash(seed, k, 2) - 0.5) * T * 0.08;
    const len = T * (0.4 + 0.3 * hash(seed, k, 3));
    const th = T * (0.1 + 0.06 * hash(seed, k, 4));
    ctx.save();
    ctx.translate(cx + ox, fy + oy);
    ctx.rotate((hash(seed, k, 5) - 0.5) * 1.4);
    if (planet === 'kessra') {
      ctx.beginPath();
      ctx.moveTo(-len / 2, th / 2);
      ctx.lineTo(0, -th * 1.4);
      ctx.lineTo(len / 2, th / 2);
      ctx.closePath();
      ctx.fillStyle = k % 2 ? col : shade(col, 0.2);
      ctx.fill();
      outline(ctx, Math.max(1, T * 0.03));
    } else {
      ctx.fillStyle = k % 2 ? col : shade(col, -0.2);
      ctx.fillRect(-len / 2, -th / 2, len, th);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-len / 2, -th / 2, len, Math.max(1, th * 0.25));
      ctx.strokeStyle = INKLINE;
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.strokeRect(-len / 2, -th / 2, len, th);
      if (planet === 'mireth') {
        ctx.fillStyle = 'rgba(110,145,65,0.85)';
        ctx.fillRect(-len * 0.3, -th / 2 - 1, len * 0.3, 2);
      }
    }
    ctx.restore();
  }
  ctx.fillStyle = forcible ? INK.bone : INK.flesh;
  for (let k = 0; k < rating; k++) ctx.fillRect(cx - T * 0.4 + k * T * 0.12, fy - T * 0.9, T * 0.07, T * 0.04);
}
