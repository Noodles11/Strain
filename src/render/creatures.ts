import { INK } from './palette';
import { fillPoly, noise, sketchEllipse, sketchStroke, smoothPath, type Pt } from './sketch';

export interface CreatureFx {
  t: number; // seconds, for idle motion
  boil: number; // line-boil seed offset
  flash: number; // 0..1 hit flash
  lunge: number; // 0..1 attack lunge
  dead: number; // 0 alive .. 1 swollen, about to burst
  seed: number;
  dim: number; // 0 fully lit .. 1 lost in fog
  /** Creature-specific state: 1 = Cryo Sleeper still asleep; Incinerator heat 0..1. */
  state?: number;
}

/** Relative height of each creature, in corridor units. */
export const CREATURE_SIZE: Record<string, number> = {
  tick: 0.55,
  copy: 1.0,
  hollow: 1.3,
  husk: 1.05,
  choir: 1.55,
  drone: 0.5,
  bloom: 1.1,
  first: 1.85,
  shardling: 0.5,
  crawler: 0.85,
  geode: 0.8,
  refractor: 1.15,
  prism: 1.8,
  drip: 1.05,
  subject: 0.6,
  sleeper: 1.15,
  incinerator: 1.0,
  leech: 0.4,
  croaker: 0.55,
  puffcap: 0.45,
  moth: 0.75,
  hound: 0.7,
  eel: 0.9,
  stilt: 1.4,
  knot: 1.0,
  stag: 1.35,
  queen: 1.1,
  titan: 1.9,
};

/**
 * Draw a creature standing on (x, footY). u is one corridor unit in pixels.
 */
export function drawCreature(
  ctx: CanvasRenderingContext2D, id: string, x: number, footY: number, u: number, fx: CreatureFx,
) {
  ctx.save();
  const lungeScale = 1 + fx.lunge * 0.16;
  ctx.translate(x + (fx.flash > 0 ? noise(fx.t * 90) * fx.flash * u * 0.05 : 0), footY + fx.lunge * u * 0.1);
  // dying: swell and tremble before bursting
  const swell = 1 + fx.dead * fx.dead * 0.3;
  if (fx.dead > 0) ctx.translate(noise(fx.t * 120) * fx.dead * u * 0.03, 0);
  ctx.scale(lungeScale * swell, lungeScale * swell);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, u * 0.012);
  const s = fx.seed * 1000 + fx.boil;
  const line = fx.flash > 0.5 || fx.dead > 0.4 ? '#ffffff' : INK.bone;
  ctx.strokeStyle = line;

  switch (id) {
    case 'tick': drawTick(ctx, u, fx, s); break;
    case 'copy':
    case 'hollow': drawCopy(ctx, u, fx, s); break;
    case 'husk': drawHusk(ctx, u, fx, s); break;
    case 'choir': drawChoir(ctx, u, fx, s); break;
    case 'drone': drawDrone(ctx, u, fx, s); break;
    case 'bloom': drawBloom(ctx, u, fx, s); break;
    case 'first': drawFirst(ctx, u, fx, s); break;
    case 'shardling': drawShardling(ctx, u, fx, s); break;
    case 'crawler': drawCrawler(ctx, u, fx, s); break;
    case 'geode': drawGeode(ctx, u, fx, s); break;
    case 'refractor': drawRefractor(ctx, u, fx, s); break;
    case 'prism': drawPrism(ctx, u, fx, s); break;
    case 'drip': drawDrip(ctx, u, fx, s); break;
    case 'subject': drawSubject(ctx, u, fx, s); break;
    case 'sleeper': drawSleeper(ctx, u, fx, s); break;
    case 'incinerator': drawIncinerator(ctx, u, fx, s); break;
    case 'leech': drawLeech(ctx, u, fx, s); break;
    case 'croaker': drawCroaker(ctx, u, fx, s); break;
    case 'puffcap': drawPuffcap(ctx, u, fx, s); break;
    case 'moth': drawMoth(ctx, u, fx, s); break;
    case 'hound': drawHound(ctx, u, fx, s); break;
    case 'eel': drawEel(ctx, u, fx, s); break;
    case 'stilt': drawStilt(ctx, u, fx, s); break;
    case 'knot': drawKnot(ctx, u, fx, s); break;
    case 'stag': drawStag(ctx, u, fx, s); break;
    case 'queen': drawQueen(ctx, u, fx, s); break;
    case 'titan': drawTitan(ctx, u, fx, s); break;
    default: break;
  }

  if (fx.flash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,240,230,${fx.flash * 0.7})`;
    ctx.fillRect(-u * 2, -u * 2.2, u * 4, u * 2.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (fx.dim > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(11,13,16,${fx.dim})`;
    ctx.fillRect(-u * 2, -u * 2.2, u * 4, u * 2.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, t: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.55;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (0.3 + 0.7 * Math.abs(Math.sin(t * 0.7))), 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- Hull Tick

function drawTick(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.55;
  const bob = Math.sin(fx.t * 9) * U * 0.02;
  const by = -U * 0.42 + bob;
  // legs
  ctx.lineWidth = Math.max(1, u * 0.01);
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const twitch = Math.sin(fx.t * 14 + i * 1.7) * U * 0.04;
    const hip: Pt = [side * U * (0.18 + k * 0.08), by + U * 0.05];
    const knee: Pt = [side * U * (0.45 + k * 0.12), by - U * (0.25 - k * 0.05) + twitch];
    const foot: Pt = [side * U * (0.55 + k * 0.16), 0];
    sketchStroke(ctx, [hip, knee, foot], s + i * 7, U * 0.015);
  }
  // body
  ctx.fillStyle = INK.fleshDark;
  const body = sketchEllipse(0, by, U * 0.42, U * 0.3, s);
  smoothPath(ctx, body);
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, u * 0.012);
  sketchStroke(ctx, body, s + 3, U * 0.012, true);
  // carapace plates
  for (let i = -1; i <= 1; i++) {
    sketchStroke(ctx, [[i * U * 0.14 - U * 0.1, by - U * 0.26], [i * U * 0.14 + U * 0.02, by + U * 0.05]], s + 40 + i, U * 0.01);
  }
  eye(ctx, U * 0.2, by - U * 0.02, U * 0.07, INK.sodium, fx.t + fx.seed);
}

// ------------------------------------------------------------- Mewling Copy

function drawCopy(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const sway = Math.sin(fx.t * 1.3 + fx.seed) * u * 0.03;
  const w = u * 0.012;
  // long arms to the floor
  ctx.fillStyle = INK.fleshDark;
  const shoulderY = -u * 0.62;
  for (const side of [-1, 1]) {
    const elbow: Pt = [side * u * 0.36 + sway, -u * 0.35];
    const hand: Pt = [side * u * 0.3 + sway * 0.4, -u * 0.02];
    sketchStroke(ctx, [[side * u * 0.14 + sway, shoulderY], elbow, hand], s + side * 20, w);
    // fingers
    for (let f = -1; f <= 1; f++) {
      sketchStroke(ctx, [hand, [hand[0] + side * u * 0.03 + f * u * 0.03, 0]], s + 60 + f + side * 5, w * 0.5);
    }
  }
  // hunched torso
  const torso: Pt[] = [
    [-u * 0.16 + sway, shoulderY], [u * 0.17 + sway, shoulderY - u * 0.02], [u * 0.14, -u * 0.22],
    [u * 0.2, -u * 0.02], [-u * 0.2, -u * 0.02], [-u * 0.12, -u * 0.24],
  ];
  ctx.fillStyle = '#6b5c55';
  fillPoly(ctx, torso);
  sketchStroke(ctx, torso, s + 5, w, true);
  // ribs
  for (let r = 0; r < 3; r++) {
    const y = shoulderY + u * (0.1 + r * 0.08);
    sketchStroke(ctx, [[-u * 0.1 + sway, y], [u * 0.1 + sway, y + u * 0.02]], s + 80 + r, w * 0.6);
  }
  // oversized head, tilted
  const tilt = Math.sin(fx.t * 0.9 + fx.seed) * 0.25;
  ctx.save();
  ctx.translate(sway * 1.3, shoulderY - u * 0.2);
  ctx.rotate(tilt);
  ctx.fillStyle = INK.bone;
  const head = sketchEllipse(0, 0, u * 0.2, u * 0.24, s + 9);
  smoothPath(ctx, head);
  ctx.fill();
  ctx.strokeStyle = '#3a2d2a';
  sketchStroke(ctx, head, s + 11, w, true);
  // hollow sockets and a stretched mouth
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(-u * 0.07, -u * 0.03, u * 0.04, u * 0.055, 0, 0, Math.PI * 2);
  ctx.ellipse(u * 0.07, -u * 0.03, u * 0.04, u * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  const open = 0.3 + 0.7 * Math.abs(Math.sin(fx.t * 2.1));
  ctx.beginPath();
  ctx.ellipse(0, u * 0.11, u * 0.05, u * 0.035 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------------- Custodian Husk

function drawHusk(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const hover = Math.sin(fx.t * 2) * u * 0.03;
  const top = -u * 1.0 + hover;
  const w = u * 0.012;
  // thruster glow
  const g = ctx.createRadialGradient(0, -u * 0.12 + hover, 0, 0, -u * 0.12 + hover, u * 0.35);
  g.addColorStop(0, 'rgba(111,163,160,0.3)');
  g.addColorStop(1, 'rgba(111,163,160,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.12 + hover, u * 0.3, u * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // body box
  const body: Pt[] = [
    [-u * 0.3, top + u * 0.1], [u * 0.28, top + u * 0.06], [u * 0.32, top + u * 0.72],
    [u * 0.12, top + u * 0.82], [-u * 0.14, top + u * 0.82], [-u * 0.32, top + u * 0.7],
  ];
  ctx.fillStyle = INK.hullLit;
  fillPoly(ctx, body);
  sketchStroke(ctx, body, s, w, true);
  // hazard band
  ctx.fillStyle = INK.rust;
  fillPoly(ctx, [[-u * 0.31, top + u * 0.56], [u * 0.31, top + u * 0.54], [u * 0.315, top + u * 0.62], [-u * 0.315, top + u * 0.64]]);
  // antenna with blinking light
  sketchStroke(ctx, [[u * 0.16, top + u * 0.08], [u * 0.22, top - u * 0.14]], s + 3, w);
  if (Math.sin(fx.t * 5) > 0.2) eye(ctx, u * 0.22, top - u * 0.15, u * 0.025, INK.flesh, 1.6);
  // pale human face mask, slightly crooked
  ctx.save();
  ctx.translate(-u * 0.02, top + u * 0.32);
  ctx.rotate(-0.12 + Math.sin(fx.t * 0.6) * 0.03);
  ctx.fillStyle = INK.bone;
  const face = sketchEllipse(0, 0, u * 0.13, u * 0.17, s + 5);
  smoothPath(ctx, face);
  ctx.fill();
  ctx.strokeStyle = '#3a2d2a';
  sketchStroke(ctx, face, s + 6, w * 0.8, true);
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(-u * 0.05, -u * 0.03, u * 0.025, u * 0.012, 0.1, 0, Math.PI * 2);
  ctx.ellipse(u * 0.05, -u * 0.03, u * 0.025, u * 0.012, -0.1, 0, Math.PI * 2);
  ctx.fill();
  sketchStroke(ctx, [[-u * 0.04, u * 0.08], [u * 0.04, u * 0.075]], s + 7, w * 0.6);
  // stitches holding it on
  ctx.strokeStyle = INK.flesh;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * u * 0.13;
    const py = Math.sin(a) * u * 0.17;
    sketchStroke(ctx, [[px * 0.9, py * 0.9], [px * 1.15, py * 1.12]], s + 20 + i, w * 0.4);
  }
  ctx.restore();
  ctx.strokeStyle = INK.bone;
  // claw arm
  const reach = fx.lunge * u * 0.1;
  const shoulder: Pt = [u * 0.3, top + u * 0.3];
  const elbow: Pt = [u * 0.5 + reach, top + u * 0.45];
  const wrist: Pt = [u * 0.42 + reach, top + u * 0.72];
  sketchStroke(ctx, [shoulder, elbow, wrist], s + 30, w * 1.4);
  sketchStroke(ctx, [wrist, [wrist[0] + u * 0.08, wrist[1] + u * 0.08]], s + 31, w);
  sketchStroke(ctx, [wrist, [wrist[0] - u * 0.04, wrist[1] + u * 0.1]], s + 32, w);
}

// ----------------------------------------------------------------- The Choir

function drawChoir(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.1;
  const w = u * 0.011;
  const breathe = 1 + Math.sin(fx.t * 1.1) * 0.02;
  // fleshy mound
  const mound: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    const r = U * (0.62 + noise(i + 3) * 0.06) * breathe;
    mound.push([Math.cos(a) * r, Math.sin(a) * r * 0.95]);
  }
  ctx.fillStyle = INK.fleshDark;
  fillPoly(ctx, mound);
  sketchStroke(ctx, mound, s, w, false);
  // tendrils onto the floor
  for (let i = 0; i < 7; i++) {
    const x0 = (i / 6 - 0.5) * U * 1.1;
    const sway = Math.sin(fx.t * 1.6 + i) * U * 0.05;
    sketchStroke(ctx, [[x0, -U * 0.1], [x0 + sway, -U * 0.02], [x0 + sway * 2 + U * 0.04, 0]], s + 50 + i, w);
  }
  // heads, singing out of phase
  const heads: [number, number, number][] = [
    [0, -0.78, 0.15], [-0.26, -0.62, 0.13], [0.27, -0.63, 0.13], [-0.46, -0.36, 0.12], [0.46, -0.38, 0.12],
    [-0.14, -0.4, 0.12], [0.15, -0.38, 0.12], [0, -0.16, 0.11], [-0.33, -0.12, 0.1], [0.34, -0.14, 0.1],
  ];
  heads.forEach(([hx, hy, hr], i) => {
    const x = hx * U;
    const y = hy * U * breathe;
    const r = hr * U;
    ctx.fillStyle = i % 3 === 0 ? INK.bone : '#bfb49c';
    const hd = sketchEllipse(x, y, r * 0.85, r, s + i * 17);
    smoothPath(ctx, hd);
    ctx.fill();
    ctx.strokeStyle = '#3a2d2a';
    sketchStroke(ctx, hd, s + i * 17 + 5, w * 0.7, true);
    ctx.fillStyle = INK.void;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.18, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.32, y - r * 0.18, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    const open = 0.2 + 0.8 * Math.abs(Math.sin(fx.t * 2.4 + i * 0.9));
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.38, r * 0.2, r * 0.3 * open, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = INK.bone;
}

// -------------------------------------------------------------- Sentry Drone

function drawDrone(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.5;
  const hover = -U * 0.75 + Math.sin(fx.t * 2.4 + fx.seed) * U * 0.08;
  const spin = fx.t * 2.2;
  // thruster haze beneath it
  const g = ctx.createRadialGradient(0, hover + U * 0.5, 0, 0, hover + U * 0.5, U * 0.55);
  g.addColorStop(0, 'rgba(111,163,160,0.25)');
  g.addColorStop(1, 'rgba(111,163,160,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, hover + U * 0.5, U * 0.5, U * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // thin radiating sensor fins, slowly rotating
  ctx.lineWidth = Math.max(1, u * 0.008);
  for (let i = 0; i < 6; i++) {
    const a = spin + (i / 6) * Math.PI * 2;
    const x1 = Math.cos(a) * U * 0.32;
    const y1 = hover + Math.sin(a) * U * 0.22;
    const x2 = Math.cos(a) * U * 0.62;
    const y2 = hover + Math.sin(a) * U * 0.42;
    sketchStroke(ctx, [[x1, y1], [x2, y2]], s + i * 9, U * 0.012);
  }
  // hexagonal shell
  const shell = sketchEllipse(0, hover, U * 0.34, U * 0.24, s);
  ctx.fillStyle = '#2b2f34';
  smoothPath(ctx, shell);
  ctx.fill();
  sketchStroke(ctx, shell, s + 4, U * 0.014, true);
  // seams
  sketchStroke(ctx, [[-U * 0.34, hover], [U * 0.34, hover]], s + 8, U * 0.008);
  // one large glowing lens, front and center
  eye(ctx, 0, hover + U * 0.02, U * 0.12, fx.flash > 0.4 ? '#ffffff' : INK.flesh, fx.t * 1.4 + fx.seed);
  ctx.strokeStyle = INK.bone;
}

// ----------------------------------------------------------------- Vat Bloom

function drawBloom(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.95;
  const breathe = 1 + Math.sin(fx.t * 1.4 + fx.seed) * 0.03;
  // rooted mound
  const mound: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const r = U * (0.55 + noise(i + fx.seed) * 0.05) * breathe;
    mound.push([Math.cos(a) * r, Math.sin(a) * r * 0.9]);
  }
  ctx.fillStyle = '#2d4a35';
  fillPoly(ctx, mound);
  sketchStroke(ctx, mound, s, u * 0.01, false);
  // tendrils to the floor
  for (let i = 0; i < 5; i++) {
    const x0 = (i / 4 - 0.5) * U * 0.95;
    const sway = Math.sin(fx.t * 1.8 + i * 1.3) * U * 0.06;
    sketchStroke(ctx, [[x0, -U * 0.08], [x0 + sway, -U * 0.02], [x0 + sway * 1.8, 0]], s + 40 + i, u * 0.01);
  }
  // three pulsing pods with glowing veins
  const pods: [number, number, number][] = [[-0.28, -0.62, 0.19], [0.3, -0.6, 0.19], [0, -0.86, 0.16]];
  pods.forEach(([px, py, pr], i) => {
    const x = px * U;
    const y = py * U * breathe;
    const r = pr * U;
    const pulse = 0.5 + 0.5 * Math.sin(fx.t * 2 + i * 2.1);
    ctx.fillStyle = '#3a5a40';
    const pd = sketchEllipse(x, y, r, r * 1.1, s + i * 23);
    smoothPath(ctx, pd);
    ctx.fill();
    ctx.strokeStyle = INK.toxin;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    sketchStroke(ctx, pd, s + i * 23 + 6, u * 0.006, true);
    // vein cracks glowing toxin-green
    for (let v = 0; v < 3; v++) {
      const a = (v / 3) * Math.PI * 2 + i;
      sketchStroke(ctx, [[x, y], [x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8]], s + 60 + v + i * 5, u * 0.005);
    }
    ctx.globalAlpha = 1;
    if (pulse > 0.85) eye(ctx, x, y, r * 0.3, INK.toxin, fx.t * 3 + i);
  });
  ctx.strokeStyle = INK.bone;
}

// -------------------------------------------------------------------- First

function drawFirst(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.92;
  const sway = Math.sin(fx.t * 0.7 + fx.seed) * U * 0.02;
  const shoulderY = -U * 1.42;
  const w = u * 0.012;
  // trailing robe/cloak silhouette
  const robe: Pt[] = [
    [-U * 0.34 + sway, shoulderY + U * 0.1], [U * 0.36 + sway, shoulderY + U * 0.06],
    [U * 0.5, -U * 0.05], [U * 0.3, 0], [-U * 0.3, 0], [-U * 0.5, -U * 0.05],
  ];
  ctx.fillStyle = '#241f26';
  fillPoly(ctx, robe);
  sketchStroke(ctx, robe, s, w, true);
  // glowing crack lines through the robe
  ctx.strokeStyle = INK.signal;
  for (let i = 0; i < 5; i++) {
    const x0 = (i / 4 - 0.5) * U * 0.8 + sway;
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(fx.t * 1.7 + i * 1.9));
    ctx.globalAlpha = flicker;
    sketchStroke(ctx, [[x0, shoulderY + U * 0.2], [x0 + noise(i) * U * 0.05, -U * 0.1]], s + 70 + i, w * 0.6);
  }
  ctx.globalAlpha = 1;
  // long reaching arms
  ctx.fillStyle = '#3a332f';
  for (const side of [-1, 1]) {
    const elbow: Pt = [side * U * 0.46 + sway + fx.lunge * side * U * 0.06, shoulderY + U * 0.5];
    const hand: Pt = [side * U * 0.4 + sway * 0.5, -U * 0.05];
    sketchStroke(ctx, [[side * U * 0.2 + sway, shoulderY + U * 0.15], elbow, hand], s + side * 15, w * 1.3);
  }
  // torso with fused, embedded faces — other clones, still in here
  const faces: [number, number, number][] = [[-0.16, -0.9, 0.11], [0.17, -0.86, 0.1], [0, -1.15, 0.1]];
  faces.forEach(([fxp, fyp, fr], i) => {
    const x = fxp * U;
    const y = fyp * U;
    const r = fr * U;
    ctx.fillStyle = '#a89a86';
    const hd = sketchEllipse(x, y, r * 0.82, r, s + 90 + i * 11);
    smoothPath(ctx, hd);
    ctx.fill();
    ctx.strokeStyle = '#241f26';
    sketchStroke(ctx, hd, s + 95 + i, w * 0.6, true);
    ctx.fillStyle = INK.void;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.1, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.3, y - r * 0.1, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // the main head, crowned in a cracked helm
  ctx.save();
  ctx.translate(sway, shoulderY - U * 0.32);
  ctx.fillStyle = '#c9bda6';
  const head = sketchEllipse(0, 0, U * 0.22, U * 0.27, s + 3);
  smoothPath(ctx, head);
  ctx.fill();
  ctx.strokeStyle = '#241f26';
  sketchStroke(ctx, head, s + 6, w, true);
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(-U * 0.08, -U * 0.02, U * 0.045, U * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(U * 0.08, -U * 0.02, U * 0.045, U * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, -U * 0.08, -U * 0.02, U * 0.03, INK.signal, fx.t * 2 + 1);
  eye(ctx, U * 0.08, -U * 0.02, U * 0.03, INK.signal, fx.t * 2 + 2);
  const open = 0.3 + 0.7 * Math.abs(Math.sin(fx.t * 1.5));
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(0, U * 0.11, U * 0.06, U * 0.04 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK.bone;
}

// ------------------------------------------------------------ Kessra shared

const ICE = '#9fe6f0';
const ICE_FILL = 'rgba(127,216,232,0.28)';
const ICE_DEEP = '#1e4a58';

/** A single crystal facet: base centre (x,y), pointing along angle. */
function shard(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, angle: number, s: number, fill = ICE_FILL) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const pts: Pt[] = [
    [x + px * w * 0.5, y + py * w * 0.5],
    [x + dx * len * 0.75 + px * w * 0.42, y + dy * len * 0.75 + py * w * 0.42],
    [x + dx * len, y + dy * len],
    [x + dx * len * 0.75 - px * w * 0.42, y + dy * len * 0.75 - py * w * 0.42],
    [x - px * w * 0.5, y - py * w * 0.5],
  ];
  ctx.fillStyle = fill;
  fillPoly(ctx, pts);
  sketchStroke(ctx, pts, s, w * 0.03, true);
  sketchStroke(ctx, [[x, y], [x + dx * len, y + dy * len]], s + 7, w * 0.02);
}

// --------------------------------------------------------------- Shardling

function drawShardling(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.5;
  const hop = Math.abs(Math.sin(fx.t * 6 + fx.seed)) * U * 0.08;
  const by = -U * 0.35 - hop;
  const w = Math.max(1, u * 0.01);
  ctx.lineWidth = w;
  // four needle legs
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const k = i % 2;
    const twitch = Math.sin(fx.t * 12 + i) * U * 0.04;
    sketchStroke(ctx, [[side * U * 0.12, by], [side * U * (0.35 + k * 0.15), by - U * 0.12 + twitch], [side * U * (0.42 + k * 0.2), 0]], s + i * 5, U * 0.01);
  }
  // a cluster of spikes for a body
  ctx.strokeStyle = fx.flash > 0.5 ? '#ffffff' : ICE;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.45;
    shard(ctx, 0, by, U * (0.35 + (i === 2 ? 0.15 : 0)), U * 0.18, a, s + 20 + i * 3);
  }
  ctx.fillStyle = ICE_DEEP;
  ctx.beginPath();
  ctx.ellipse(0, by, U * 0.2, U * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.bone;
  eye(ctx, 0, by, U * 0.05, ICE, fx.t * 2 + fx.seed);
}

// ---------------------------------------------------------- Lattice Crawler

function drawCrawler(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.85;
  const crawl = Math.sin(fx.t * 2.2 + fx.seed) * U * 0.03;
  const w = Math.max(1, u * 0.011);
  ctx.lineWidth = w;
  // many short legs
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * U * 0.9;
    const lift = Math.sin(fx.t * 5 + i * 1.3) * U * 0.03;
    sketchStroke(ctx, [[x, -U * 0.18], [x + U * 0.06, -U * 0.06 + lift], [x + U * 0.03, 0]], s + i * 4, U * 0.008);
  }
  // segmented, armoured body
  ctx.fillStyle = '#243a46';
  const body: Pt[] = [
    [-U * 0.52 + crawl, -U * 0.18], [-U * 0.4, -U * 0.4], [U * 0.3, -U * 0.44],
    [U * 0.55 + crawl, -U * 0.24], [U * 0.5, -U * 0.14], [-U * 0.45, -U * 0.12],
  ];
  fillPoly(ctx, body);
  sketchStroke(ctx, body, s, w * 0.9, true);
  for (let i = 1; i < 5; i++) {
    const x = -U * 0.45 + i * U * 0.2;
    sketchStroke(ctx, [[x, -U * 0.42], [x + U * 0.02, -U * 0.14]], s + 30 + i, w * 0.5);
  }
  // crystal plates along the back, growing
  ctx.strokeStyle = fx.flash > 0.5 ? '#ffffff' : ICE;
  for (let i = 0; i < 5; i++) {
    const x = -U * 0.36 + i * U * 0.18;
    const len = U * (0.18 + 0.06 * Math.sin(fx.t * 0.8 + i));
    shard(ctx, x, -U * 0.42, len, U * 0.11, -Math.PI / 2 - 0.2 + i * 0.1, s + 50 + i * 4);
  }
  ctx.strokeStyle = INK.bone;
  eye(ctx, U * 0.44, -U * 0.28, U * 0.035, ICE, fx.t + fx.seed);
  eye(ctx, U * 0.36, -U * 0.3, U * 0.025, ICE, fx.t + fx.seed + 1);
}

// ------------------------------------------------------------ Singing Geode

function drawGeode(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.8;
  const w = Math.max(1, u * 0.011);
  ctx.lineWidth = w;
  const sing = 0.5 + 0.5 * Math.sin(fx.t * 3 + fx.seed);
  // rough rock shell, split open
  ctx.fillStyle = '#2b2a2e';
  const shell: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    const r = U * (0.46 + noise(i + 5) * 0.05);
    shell.push([Math.cos(a) * r, Math.sin(a) * r * 1.15]);
  }
  fillPoly(ctx, shell);
  sketchStroke(ctx, shell, s, w, false);
  // the glowing hollow
  const cy = -U * 0.28;
  const g = ctx.createRadialGradient(0, cy, 0, 0, cy, U * 0.45);
  g.addColorStop(0, `rgba(176,111,224,${0.45 + sing * 0.3})`);
  g.addColorStop(1, 'rgba(176,111,224,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-U * 0.6, cy - U * 0.5, U * 1.2, U * 0.9);
  ctx.fillStyle = '#3a2250';
  ctx.beginPath();
  ctx.ellipse(0, cy, U * 0.3, U * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // amethyst teeth ringing the hollow
  ctx.strokeStyle = fx.flash > 0.5 ? '#ffffff' : '#d9b6f2';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = Math.cos(a) * U * 0.28;
    const y = cy + Math.sin(a) * U * 0.2;
    shard(ctx, x, y, U * (0.1 + 0.03 * sing), U * 0.06, a + Math.PI, s + 70 + i * 3, 'rgba(176,111,224,0.35)');
  }
  ctx.strokeStyle = INK.bone;
  // sound rings while it sings
  ctx.save();
  ctx.globalAlpha *= 0.4 * sing;
  ctx.strokeStyle = INK.signal;
  for (let r = 1; r <= 2; r++) {
    ctx.beginPath();
    ctx.ellipse(0, cy, U * (0.4 + r * 0.14 * sing), U * (0.3 + r * 0.1 * sing), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = INK.bone;
}

// --------------------------------------------------------------- Refractor

function drawRefractor(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u;
  const sway = Math.sin(fx.t * 0.9 + fx.seed) * U * 0.02;
  const w = Math.max(1.2, u * 0.012);
  ctx.lineWidth = w;
  // two thick stone legs
  ctx.fillStyle = '#26323a';
  for (const side of [-1, 1]) {
    const leg: Pt[] = [[side * U * 0.1, -U * 0.5], [side * U * 0.24, -U * 0.5], [side * U * 0.28, 0], [side * U * 0.08, 0]];
    fillPoly(ctx, leg);
    sketchStroke(ctx, leg, s + side * 9, w * 0.8, true);
  }
  // torso: a tall mirror slab
  const top = -U * 1.15;
  const slab: Pt[] = [
    [-U * 0.3 + sway, top + U * 0.1], [U * 0.02 + sway, top], [U * 0.32 + sway, top + U * 0.12],
    [U * 0.28, -U * 0.48], [-U * 0.26, -U * 0.48],
  ];
  const grd = ctx.createLinearGradient(-U * 0.3, top, U * 0.3, -U * 0.5);
  grd.addColorStop(0, '#dff7fb');
  grd.addColorStop(0.45, '#6fb3c2');
  grd.addColorStop(0.55, '#1f3d48');
  grd.addColorStop(1, '#9fe6f0');
  ctx.fillStyle = grd;
  ctx.globalAlpha *= 0.85;
  fillPoly(ctx, slab);
  ctx.globalAlpha /= 0.85;
  ctx.strokeStyle = fx.flash > 0.5 ? '#ffffff' : INK.bone;
  sketchStroke(ctx, slab, s, w, true);
  // a sweeping glint across the mirror
  const gx = ((fx.t * 0.5 + fx.seed) % 1.4 - 0.7) * U * 0.6;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  sketchStroke(ctx, [[gx - U * 0.08, top + U * 0.15], [gx + U * 0.08, -U * 0.55]], s + 40, w * 0.6);
  // shoulder spikes
  ctx.strokeStyle = ICE;
  shard(ctx, -U * 0.3 + sway, top + U * 0.15, U * 0.28, U * 0.12, -Math.PI * 0.8, s + 60);
  shard(ctx, U * 0.32 + sway, top + U * 0.16, U * 0.3, U * 0.12, -Math.PI * 0.2, s + 64);
  // lance arm
  const reach = fx.lunge * U * 0.15;
  sketchStroke(ctx, [[U * 0.3, top + U * 0.35], [U * 0.5 + reach, top + U * 0.55], [U * 0.62 + reach, top + U * 0.35]], s + 70, w * 1.2);
  ctx.strokeStyle = INK.bone;
  eye(ctx, sway, top + U * 0.22, U * 0.04, ICE, fx.t * 1.1);
}

// -------------------------------------------------------- The Prism Mother

function drawPrism(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.95;
  const w = Math.max(1.2, u * 0.012);
  ctx.lineWidth = w;
  const breathe = 1 + Math.sin(fx.t * 0.9) * 0.02;
  // halo of prismatic light
  const cy = -U * 0.95;
  const hues = ['255,120,140', '255,210,120', '140,240,190', '127,216,232', '176,111,224'];
  hues.forEach((h, i) => {
    const a = fx.t * 0.2 + (i / hues.length) * Math.PI * 2;
    const g = ctx.createRadialGradient(Math.cos(a) * U * 0.3, cy + Math.sin(a) * U * 0.2, 0, Math.cos(a) * U * 0.3, cy + Math.sin(a) * U * 0.2, U * 0.7);
    g.addColorStop(0, `rgba(${h},0.22)`);
    g.addColorStop(1, `rgba(${h},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-U, cy - U, U * 2, U * 2);
  });
  // a crown of huge shards fanning upward
  ctx.strokeStyle = fx.flash > 0.5 ? '#ffffff' : '#d6f6fb';
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.28;
    const len = U * (0.7 + (4 - Math.abs(i - 4)) * 0.12) * breathe;
    shard(ctx, 0, -U * 0.2, len, U * 0.2, a, s + i * 11, i % 2 ? ICE_FILL : 'rgba(176,111,224,0.22)');
  }
  // the body: a heavy crystal core on the floor
  ctx.fillStyle = ICE_DEEP;
  const core: Pt[] = [[-U * 0.45, 0], [-U * 0.35, -U * 0.4], [0, -U * 0.55], [U * 0.35, -U * 0.4], [U * 0.45, 0]];
  fillPoly(ctx, core);
  ctx.strokeStyle = INK.bone;
  sketchStroke(ctx, core, s + 200, w, true);
  // a face, calm and enormous, inside the core
  ctx.fillStyle = 'rgba(214,246,251,0.85)';
  ctx.beginPath();
  ctx.ellipse(0, -U * 0.3, U * 0.14, U * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(-U * 0.05, -U * 0.33, U * 0.025, U * 0.012, 0, 0, Math.PI * 2);
  ctx.ellipse(U * 0.05, -U * 0.33, U * 0.025, U * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, 0, -U * 0.72, U * 0.05, '#ffffff', fx.t * 0.6);
}

// ------------------------------------------------------------- Drip Stand

function drawDrip(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const w = u * 0.012;
  const sway = Math.sin(fx.t * 1.4 + fx.seed) * u * 0.03;
  // wheeled base: five little casters that twitch like feet
  ctx.lineWidth = Math.max(1, u * 0.01);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI - Math.PI;
    const fx0 = Math.cos(a) * u * 0.22;
    const lift = Math.max(0, Math.sin(fx.t * 6 + i * 1.3)) * u * 0.03;
    sketchStroke(ctx, [[0, -u * 0.12], [fx0, -lift]], s + i * 3, w);
    ctx.fillStyle = INK.void;
    ctx.beginPath();
    ctx.arc(fx0, -lift, u * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // the pole
  sketchStroke(ctx, [[0, -u * 0.12], [sway * 0.5, -u * 0.8], [sway, -u * 0.98]], s + 20, w * 1.4);
  sketchStroke(ctx, [[sway - u * 0.14, -u * 0.96], [sway + u * 0.14, -u * 0.98]], s + 21, w);
  // the bag, sloshing
  const bx = sway + u * 0.02;
  const by = -u * 0.82;
  const bag: Pt[] = [[bx - u * 0.12, by - u * 0.12], [bx + u * 0.12, by - u * 0.12], [bx + u * 0.14, by + u * 0.08], [bx, by + u * 0.16], [bx - u * 0.14, by + u * 0.08]];
  ctx.fillStyle = 'rgba(216,207,184,0.25)';
  smoothPath(ctx, bag);
  ctx.fill();
  const level = by - u * 0.02 + Math.sin(fx.t * 3) * u * 0.02;
  ctx.save();
  smoothPath(ctx, bag);
  ctx.clip();
  ctx.fillStyle = INK.flesh;
  ctx.fillRect(bx - u * 0.2, level, u * 0.4, u * 0.3);
  ctx.restore();
  sketchStroke(ctx, bag, s + 30, w, true);
  // tube curling down to a needle it holds like a finger
  const reach = fx.lunge * u * 0.12;
  ctx.strokeStyle = INK.boneDim;
  sketchStroke(ctx, [[bx, by + u * 0.16], [bx + u * 0.18, -u * 0.55], [bx + u * 0.3 + reach, -u * 0.5], [bx + u * 0.34 + reach, -u * 0.36]], s + 40, w);
  ctx.strokeStyle = INK.bone;
  sketchStroke(ctx, [[bx + u * 0.34 + reach, -u * 0.36], [bx + u * 0.36 + reach, -u * 0.26]], s + 41, w * 0.7);
  eye(ctx, bx - u * 0.03, by - u * 0.04, u * 0.02, INK.sodium, fx.t);
}

// ------------------------------------------------------------- Test Subject

function drawSubject(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.6;
  const w = u * 0.011;
  const jitter = Math.sin(fx.t * 23 + fx.seed * 9) * U * 0.02;
  const by = -U * 0.45 + jitter;
  // spindly legs, ready to bolt
  for (const side of [-1, 1]) {
    const run = Math.sin(fx.t * 12 + side) * U * 0.06;
    sketchStroke(ctx, [[side * U * 0.12, by + U * 0.18], [side * U * 0.32 + run, by + U * 0.3], [side * U * 0.26 + run, 0]], s + side * 7, w);
  }
  // hunched pale body
  const body = sketchEllipse(0, by, U * 0.34, U * 0.26, s);
  ctx.fillStyle = INK.bone;
  smoothPath(ctx, body);
  ctx.fill();
  ctx.strokeStyle = '#3a2d2a';
  sketchStroke(ctx, body, s + 2, w, true);
  // ribs showing through
  for (let i = -1; i <= 1; i++) sketchStroke(ctx, [[i * U * 0.1 - U * 0.04, by - U * 0.02], [i * U * 0.1 + U * 0.03, by + U * 0.14]], s + 10 + i, w * 0.6);
  // head, too big, with wide wet eyes
  const hx = U * 0.26;
  const hy = by - U * 0.26;
  const head = sketchEllipse(hx, hy, U * 0.2, U * 0.18, s + 20);
  ctx.fillStyle = INK.bone;
  smoothPath(ctx, head);
  ctx.fill();
  sketchStroke(ctx, head, s + 21, w, true);
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(hx - U * 0.06, hy - U * 0.02, U * 0.05, U * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(hx + U * 0.08, hy - U * 0.02, U * 0.05, U * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(hx - U * 0.07, hy - U * 0.05, U * 0.02, U * 0.02);
  ctx.fillRect(hx + U * 0.07, hy - U * 0.05, U * 0.02, U * 0.02);
  // lab collar with a blinking tag
  ctx.strokeStyle = INK.sodium;
  sketchStroke(ctx, [[hx - U * 0.16, hy + U * 0.14], [hx + U * 0.12, hy + U * 0.18]], s + 30, w * 1.6);
  if (Math.sin(fx.t * 7) > 0) eye(ctx, hx - U * 0.02, hy + U * 0.2, U * 0.025, INK.toxin, 1.6);
  ctx.strokeStyle = INK.bone;
}

// ------------------------------------------------------------- Cryo Sleeper

function drawSleeper(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const w = u * 0.012;
  const asleep = (fx.state ?? 0) > 0.5;
  const pod: Pt[] = [[-u * 0.3, 0], [-u * 0.34, -u * 0.8], [-u * 0.2, -u * 1.08], [u * 0.2, -u * 1.08], [u * 0.34, -u * 0.8], [u * 0.3, 0]];
  // the pod shell
  ctx.fillStyle = INK.hullLit;
  smoothPath(ctx, pod);
  ctx.fill();
  sketchStroke(ctx, pod, s, w, true);
  // the figure: curled and still while asleep, uncurled and reaching when awake
  const reach = fx.lunge * u * 0.12;
  ctx.fillStyle = INK.fleshDark;
  if (asleep) {
    const curl = sketchEllipse(0, -u * 0.5 + Math.sin(fx.t * 0.5) * u * 0.005, u * 0.18, u * 0.26, s + 5);
    smoothPath(ctx, curl);
    ctx.fill();
    sketchStroke(ctx, [[-u * 0.1, -u * 0.62], [u * 0.08, -u * 0.36]], s + 6, w * 0.7);
  } else {
    const body = sketchEllipse(0, -u * 0.55, u * 0.16, u * 0.34, s + 5);
    smoothPath(ctx, body);
    ctx.fill();
    const head = sketchEllipse(0, -u * 0.95, u * 0.1, u * 0.11, s + 7);
    smoothPath(ctx, head);
    ctx.fill();
    eye(ctx, -u * 0.035, -u * 0.96, u * 0.02, INK.cryo, fx.t);
    eye(ctx, u * 0.035, -u * 0.96, u * 0.02, INK.cryo, fx.t + 1);
    ctx.strokeStyle = INK.bone;
    sketchStroke(ctx, [[u * 0.14, -u * 0.72], [u * 0.42 + reach, -u * 0.6], [u * 0.5 + reach, -u * 0.44]], s + 8, w * 1.3);
    sketchStroke(ctx, [[-u * 0.14, -u * 0.72], [-u * 0.36, -u * 0.5], [-u * 0.34, -u * 0.3]], s + 9, w * 1.3);
  }
  // glass: frosted over while asleep, cracked open once awake
  ctx.save();
  smoothPath(ctx, pod);
  ctx.clip();
  if (asleep) {
    ctx.fillStyle = 'rgba(159,210,228,0.42)';
    ctx.fillRect(-u * 0.4, -u * 1.1, u * 0.8, u * 1.1);
    ctx.strokeStyle = 'rgba(232,251,255,0.7)';
    for (let i = 0; i < 7; i++) {
      const x = noise(s + i) * u * 0.25;
      const y = -u * (0.2 + 0.12 * i);
      sketchStroke(ctx, [[x, y], [x + u * 0.06, y - u * 0.05], [x + u * 0.12, y]], s + 40 + i, w * 0.6);
    }
  } else {
    ctx.strokeStyle = 'rgba(232,251,255,0.6)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      sketchStroke(ctx, [[0, -u * 0.6], [Math.cos(a) * u * 0.3, -u * 0.6 + Math.sin(a) * u * 0.4]], s + 50 + i, w * 0.6);
    }
  }
  ctx.restore();
  ctx.strokeStyle = INK.bone;
  // status light
  eye(ctx, u * 0.22, -u * 0.2, u * 0.025, asleep ? INK.cryo : INK.flesh, fx.t * 2);
}

// ------------------------------------------------------------- Incinerator Unit

function drawIncinerator(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const w = u * 0.012;
  const heat = Math.max(0, Math.min(1, fx.state ?? 0));
  const shake = heat > 0.6 ? Math.sin(fx.t * 40) * u * 0.01 * heat : 0;
  ctx.translate(shake, 0);
  // treads
  const tread: Pt[] = [[-u * 0.42, -u * 0.02], [-u * 0.46, -u * 0.12], [u * 0.46, -u * 0.12], [u * 0.42, -u * 0.02]];
  ctx.fillStyle = INK.void;
  fillPoly(ctx, tread);
  sketchStroke(ctx, tread, s, w, true);
  for (let i = 0; i < 7; i++) {
    const x = -u * 0.4 + ((i * u * 0.13 + fx.t * u * 0.05) % (u * 0.8));
    sketchStroke(ctx, [[x, -u * 0.11], [x, -u * 0.03]], s + i, w * 0.6);
  }
  // furnace body
  const body: Pt[] = [[-u * 0.36, -u * 0.12], [-u * 0.34, -u * 0.72], [u * 0.34, -u * 0.74], [u * 0.36, -u * 0.12]];
  ctx.fillStyle = INK.rust;
  fillPoly(ctx, body);
  sketchStroke(ctx, body, s + 10, w, true);
  // chimney with smoke
  const chim: Pt[] = [[u * 0.12, -u * 0.74], [u * 0.14, -u * 0.98], [u * 0.26, -u * 0.98], [u * 0.26, -u * 0.74]];
  ctx.fillStyle = INK.hullLit;
  fillPoly(ctx, chim);
  sketchStroke(ctx, chim, s + 11, w, true);
  for (let i = 0; i < 3; i++) {
    const ph = (fx.t * 0.7 + i / 3) % 1;
    ctx.fillStyle = `rgba(90,85,78,${0.5 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(u * 0.2 + Math.sin(ph * 5 + i) * u * 0.05, -u * 1.0 - ph * u * 0.5, u * (0.05 + ph * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  // the grille: glows hotter every round
  const gx = -u * 0.2;
  const gy = -u * 0.56;
  const glow = ctx.createRadialGradient(gx + u * 0.12, gy + u * 0.14, 0, gx + u * 0.12, gy + u * 0.14, u * (0.25 + 0.3 * heat));
  glow.addColorStop(0, `rgba(255,${Math.round(200 - 120 * heat)},60,${0.35 + 0.6 * heat})`);
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(gx - u * 0.3, gy - u * 0.3, u * 0.84, u * 0.84);
  ctx.fillStyle = INK.void;
  ctx.fillRect(gx, gy, u * 0.24, u * 0.28);
  ctx.fillStyle = `rgba(227,163,59,${0.4 + 0.6 * heat})`;
  for (let i = 0; i < 4; i++) ctx.fillRect(gx + u * 0.02, gy + u * (0.03 + i * 0.065), u * 0.2, u * 0.03);
  // gauge needle creeping to red
  ctx.fillStyle = INK.bone;
  ctx.beginPath();
  ctx.arc(u * 0.2, -u * 0.46, u * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.flesh;
  const a = Math.PI * (0.8 + 1.4 * heat);
  sketchStroke(ctx, [[u * 0.2, -u * 0.46], [u * 0.2 + Math.cos(a) * u * 0.06, -u * 0.46 + Math.sin(a) * u * 0.06]], s + 30, w);
  ctx.strokeStyle = INK.bone;
  // a stubby arm with a vent nozzle
  const reach = fx.lunge * u * 0.1;
  sketchStroke(ctx, [[-u * 0.36, -u * 0.4], [-u * 0.52 - reach, -u * 0.36], [-u * 0.56 - reach, -u * 0.28]], s + 40, w * 1.4);
}

// ================================================================ Mireth

const MOSS = '#4f6b3a';
const MOSS_DARK = '#2b3a22';
const LIME = '#c4d86a';
const LEECH_SKIN = '#2a1d1c';
const SPORE = '#b8c98a';

/** Wet, drooping strands of moss hanging from a line of points. */
function mossFringe(ctx: CanvasRenderingContext2D, pts: Pt[], len: number, t: number, s: number) {
  ctx.save();
  ctx.strokeStyle = MOSS;
  ctx.lineWidth = Math.max(1, len * 0.12);
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const l = len * (0.6 + 0.5 * (noise(s + i) * 0.5 + 0.5));
    const sw = Math.sin(t * 1.2 + i) * len * 0.15;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sw * 0.5, y + l * 0.5, x + sw, y + l);
  });
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------ Leech Swarm

function drawLeech(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.4;
  const w = Math.max(1, u * 0.01);
  ctx.lineWidth = w;
  // a writhing heap of fat black leeches
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + fx.t * 0.4;
    const cx = Math.cos(a) * U * 0.35;
    const cy = -U * 0.3 + Math.sin(a) * U * 0.14 - (i % 2) * U * 0.12;
    const wr = Math.sin(fx.t * 5 + i * 1.7) * 0.25;
    ctx.fillStyle = i % 2 ? LEECH_SKIN : '#3a2624';
    ctx.beginPath();
    ctx.ellipse(cx, cy, U * 0.3, U * 0.12, a + wr, 0, Math.PI * 2);
    ctx.fill();
    sketchStroke(ctx, sketchEllipse(cx, cy, U * 0.3, U * 0.12, s + i * 9, 10).map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      return [cx + dx * Math.cos(a + wr) - dy * Math.sin(a + wr), cy + dx * Math.sin(a + wr) + dy * Math.cos(a + wr)] as Pt;
    }), s + i * 9, U * 0.02, true);
  }
  // one rears up with a round sucker mouth
  const rear = Math.sin(fx.t * 2 + fx.seed) * U * 0.08;
  ctx.fillStyle = LEECH_SKIN;
  const neck: Pt[] = [[-U * 0.1, -U * 0.4], [-U * 0.05, -U * 0.85 + rear], [U * 0.12, -U * 0.9 + rear], [U * 0.12, -U * 0.4]];
  fillPoly(ctx, neck);
  sketchStroke(ctx, neck, s + 70, U * 0.02, true);
  ctx.fillStyle = INK.fleshDark;
  ctx.beginPath();
  ctx.ellipse(U * 0.04, -U * 0.9 + rear, U * 0.1, U * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.flesh;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.moveTo(U * 0.04 + Math.cos(a) * U * 0.04, -U * 0.9 + rear + Math.sin(a) * U * 0.025);
    ctx.lineTo(U * 0.04 + Math.cos(a) * U * 0.09, -U * 0.9 + rear + Math.sin(a) * U * 0.055);
  }
  ctx.stroke();
  ctx.strokeStyle = INK.bone;
}

// ------------------------------------------------------------ Bog Croaker

function drawCroaker(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.55;
  const w = Math.max(1, u * 0.011);
  ctx.lineWidth = w;
  const puff = 1 + Math.max(0, Math.sin(fx.t * 1.6 + fx.seed)) * 0.18;
  // squat legs
  ctx.fillStyle = MOSS_DARK;
  for (const side of [-1, 1]) {
    const leg: Pt[] = [[side * U * 0.3, -U * 0.25], [side * U * 0.62, -U * 0.12], [side * U * 0.7, 0], [side * U * 0.35, 0]];
    fillPoly(ctx, leg);
    sketchStroke(ctx, leg, s + side * 5, U * 0.02, true);
  }
  // warty body
  ctx.fillStyle = MOSS;
  const body = sketchEllipse(0, -U * 0.42, U * 0.52, U * 0.36, s, 16);
  smoothPath(ctx, body);
  ctx.fill();
  sketchStroke(ctx, body, s + 3, U * 0.015, true);
  ctx.fillStyle = MOSS_DARK;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(noise(s + i) * U * 0.35, -U * 0.55 + noise(s + i + 20) * U * 0.18, U * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // throat sac, swelling green
  ctx.fillStyle = 'rgba(196,216,106,0.75)';
  ctx.beginPath();
  ctx.ellipse(U * 0.05, -U * 0.22, U * 0.24 * puff, U * 0.14 * puff, 0, 0, Math.PI * 2);
  ctx.fill();
  // bulging eyes on top
  for (const side of [-1, 1]) {
    ctx.fillStyle = MOSS;
    ctx.beginPath();
    ctx.arc(side * U * 0.22, -U * 0.76, U * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    eye(ctx, side * U * 0.22, -U * 0.77, U * 0.05, LIME, fx.t + side);
  }
  // wide mouth line
  sketchStroke(ctx, [[-U * 0.4, -U * 0.4], [0, -U * 0.34], [U * 0.4, -U * 0.4]], s + 40, U * 0.01);
}

// ----------------------------------------------------------------- Puffcap

function drawPuffcap(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.45;
  const w = Math.max(1, u * 0.011);
  ctx.lineWidth = w;
  const swell = 1 + Math.sin(fx.t * 2.2 + fx.seed) * 0.05 + fx.dead * 0.3;
  // stubby root feet
  for (let i = 0; i < 4; i++) {
    const x = (i / 3 - 0.5) * U * 0.5;
    sketchStroke(ctx, [[x * 0.6, -U * 0.25], [x, -U * 0.08], [x * 1.3, 0]], s + i * 4, U * 0.02);
  }
  // pale stalk
  ctx.fillStyle = '#cfc6a6';
  const stalk: Pt[] = [[-U * 0.16, -U * 0.08], [-U * 0.12, -U * 0.55], [U * 0.12, -U * 0.55], [U * 0.18, -U * 0.08]];
  fillPoly(ctx, stalk);
  sketchStroke(ctx, stalk, s + 10, U * 0.02, true);
  // swollen cap, spotted, puffing spores
  ctx.fillStyle = '#6b4a5a';
  ctx.beginPath();
  ctx.ellipse(0, -U * 0.62, U * 0.55 * swell, U * 0.38 * swell, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = SPORE;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + ((i + 0.5) / 6) * Math.PI;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * U * 0.34 * swell, -U * 0.62 + Math.sin(a) * U * 0.22 * swell, U * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let k = 0; k < 5; k++) {
    const ph = (fx.t * 0.4 + k / 5) % 1;
    ctx.save();
    ctx.globalAlpha *= 0.6 * (1 - ph);
    ctx.beginPath();
    ctx.arc(noise(s + k) * U * 0.5, -U * 1.0 - ph * U * 0.6, U * (0.03 + ph * 0.05), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // two sleepy slit eyes under the brim
  ctx.fillStyle = INK.void;
  ctx.fillRect(-U * 0.1, -U * 0.5, U * 0.06, U * 0.02);
  ctx.fillRect(U * 0.04, -U * 0.5, U * 0.06, U * 0.02);
}

// --------------------------------------------------------------- Gravemoth

function drawMoth(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.6;
  const w = Math.max(1, u * 0.011);
  ctx.lineWidth = w;
  const hover = -U * 0.55 + Math.sin(fx.t * 3 + fx.seed) * U * 0.08;
  const flap = Math.abs(Math.sin(fx.t * 9 + fx.seed));
  // tattered paper wings
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(200,190,160,0.55)';
    const wing: Pt[] = [
      [0, hover], [side * U * (0.3 + 0.35 * flap), hover - U * (0.45 - 0.2 * flap)],
      [side * U * (0.7 + 0.1 * flap), hover - U * 0.1], [side * U * 0.55, hover + U * 0.12],
      [side * U * 0.45, hover + U * 0.05], [side * U * 0.35, hover + U * 0.22],
    ];
    fillPoly(ctx, wing);
    sketchStroke(ctx, wing, s + side * 7, U * 0.015, true);
    // eye-spots
    ctx.fillStyle = INK.fleshDark;
    ctx.beginPath();
    ctx.arc(side * U * (0.35 + 0.1 * flap), hover - U * 0.12, U * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  // fat furred body
  ctx.fillStyle = '#4a4034';
  const body = sketchEllipse(0, hover + U * 0.05, U * 0.1, U * 0.26, s + 30, 10);
  smoothPath(ctx, body);
  ctx.fill();
  sketchStroke(ctx, body, s + 31, U * 0.015, true);
  // feathered antennae
  sketchStroke(ctx, [[-U * 0.03, hover - U * 0.18], [-U * 0.12, hover - U * 0.36]], s + 40, U * 0.01);
  sketchStroke(ctx, [[U * 0.03, hover - U * 0.18], [U * 0.12, hover - U * 0.36]], s + 41, U * 0.01);
  eye(ctx, 0, hover - U * 0.14, U * 0.04, LIME, fx.t);
  // dust falling below it
  ctx.fillStyle = SPORE;
  for (let k = 0; k < 4; k++) {
    const ph = (fx.t * 0.5 + k / 4) % 1;
    ctx.fillRect(noise(s + k * 3) * U * 0.3, hover + U * 0.3 + ph * U * 0.5, 2, 2);
  }
}

// -------------------------------------------------------------- Moss Hound

function drawHound(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.7;
  const w = Math.max(1, u * 0.012);
  ctx.lineWidth = w;
  const pant = Math.sin(fx.t * 7 + fx.seed) * U * 0.015;
  // four thin legs
  for (const [x, k] of [[-0.38, 0], [-0.25, 1], [0.28, 2], [0.4, 3]] as [number, number][]) {
    const step = Math.sin(fx.t * 3 + k * 1.6) * U * 0.03;
    sketchStroke(ctx, [[x * U, -U * 0.42], [x * U + step, -U * 0.2], [x * U - U * 0.03, 0]], s + k * 5, U * 0.01);
  }
  // lean body, moss clumps where fur fell out
  ctx.fillStyle = '#3b3a30';
  const body: Pt[] = [[-U * 0.5, -U * 0.5], [-U * 0.2, -U * 0.62 + pant], [U * 0.3, -U * 0.6 + pant], [U * 0.45, -U * 0.42], [-U * 0.45, -U * 0.4]];
  fillPoly(ctx, body);
  sketchStroke(ctx, body, s + 20, U * 0.015, true);
  ctx.fillStyle = MOSS;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(-U * 0.35 + i * U * 0.17, -U * 0.58 + noise(s + i) * U * 0.03, U * 0.08, U * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // tail
  sketchStroke(ctx, [[-U * 0.5, -U * 0.5], [-U * 0.68, -U * 0.62], [-U * 0.75, -U * 0.55]], s + 30, U * 0.015);
  // long skull-like head, jaw hanging
  ctx.fillStyle = INK.bone;
  const head: Pt[] = [[U * 0.35, -U * 0.66], [U * 0.62, -U * 0.62], [U * 0.72, -U * 0.52], [U * 0.42, -U * 0.48]];
  fillPoly(ctx, head);
  sketchStroke(ctx, head, s + 40, U * 0.01, true);
  ctx.fillStyle = INK.fleshDark;
  const jaw: Pt[] = [[U * 0.42, -U * 0.48], [U * 0.68, -U * 0.45 + pant * 2], [U * 0.62, -U * 0.4 + pant * 2]];
  fillPoly(ctx, jaw);
  eye(ctx, U * 0.5, -U * 0.6, U * 0.03, LIME, fx.t + fx.seed);
  mossFringe(ctx, [[-U * 0.3, -U * 0.42], [-U * 0.1, -U * 0.41], [U * 0.1, -U * 0.41]], U * 0.12, fx.t, s + 50);
}

// ------------------------------------------------------------ Lantern Eel

function drawEel(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.8;
  const w = Math.max(1, u * 0.012);
  ctx.lineWidth = w;
  // a pool of black water it rises from
  ctx.fillStyle = 'rgba(20,40,48,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, -U * 0.02, U * 0.45, U * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // S-curved body out of the water
  const sway = Math.sin(fx.t * 1.8 + fx.seed) * U * 0.08;
  const spine: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    spine.push([Math.sin(k * 3.2 + fx.t * 1.5) * U * 0.12 * (1 - k) + sway * k, -k * U * 0.9]);
  }
  ctx.strokeStyle = '#243a3a';
  ctx.lineWidth = U * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  spine.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.strokeStyle = INK.bone;
  ctx.lineWidth = w;
  sketchStroke(ctx, spine.map(([x, y]) => [x - U * 0.08, y] as Pt), s, U * 0.01);
  sketchStroke(ctx, spine.map(([x, y]) => [x + U * 0.08, y] as Pt), s + 3, U * 0.01);
  // glowing spots down its flank
  const glow = 0.5 + 0.5 * Math.sin(fx.t * 4 + fx.seed);
  for (let i = 2; i < 10; i += 2) {
    const [x, y] = spine[i];
    ctx.fillStyle = `rgba(196,216,106,${0.4 + 0.5 * glow})`;
    ctx.beginPath();
    ctx.arc(x + U * 0.04, y, U * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // head with a lure dangling in front
  const [hx, hy] = spine[10];
  ctx.fillStyle = '#243a3a';
  ctx.beginPath();
  ctx.ellipse(hx + U * 0.06, hy, U * 0.16, U * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  sketchStroke(ctx, [[hx + U * 0.05, hy - U * 0.08], [hx + U * 0.25, hy - U * 0.22], [hx + U * 0.32, hy - U * 0.1]], s + 20, U * 0.01);
  const g = ctx.createRadialGradient(hx + U * 0.32, hy - U * 0.08, 0, hx + U * 0.32, hy - U * 0.08, U * 0.2);
  g.addColorStop(0, `rgba(230,245,160,${0.5 + 0.4 * glow})`);
  g.addColorStop(1, 'rgba(196,216,106,0)');
  ctx.fillStyle = g;
  ctx.fillRect(hx + U * 0.12, hy - U * 0.28, U * 0.4, U * 0.4);
  ctx.fillStyle = '#eef6c0';
  ctx.beginPath();
  ctx.arc(hx + U * 0.32, hy - U * 0.08, U * 0.035, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, hx + U * 0.12, hy - U * 0.02, U * 0.025, LIME, fx.t);
}

// --------------------------------------------------------------- Stiltwader

function drawStilt(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.35;
  const w = Math.max(1, u * 0.012);
  ctx.lineWidth = w;
  const bob = Math.sin(fx.t * 0.9 + fx.seed) * U * 0.01;
  // two impossibly long legs with backward knees
  for (const side of [-1, 1]) {
    const step = Math.sin(fx.t * 0.7 + side) * U * 0.015;
    sketchStroke(ctx, [[side * U * 0.05, -U * 0.62 + bob], [side * U * 0.09 + step, -U * 0.34], [side * U * 0.04, 0]], s + side * 7, U * 0.006);
    sketchStroke(ctx, [[side * U * 0.04, 0], [side * U * 0.1, 0]], s + side * 9, U * 0.004);
  }
  // body, a hunched grey-green bundle of feathers
  ctx.fillStyle = '#56604a';
  const body = sketchEllipse(0, -U * 0.7 + bob, U * 0.14, U * 0.1, s + 20, 12);
  smoothPath(ctx, body);
  ctx.fill();
  sketchStroke(ctx, body, s + 21, U * 0.008, true);
  mossFringe(ctx, [[-U * 0.1, -U * 0.64], [-U * 0.03, -U * 0.62], [U * 0.05, -U * 0.63]], U * 0.06, fx.t, s + 22);
  // S-neck up to a small head and a long spear beak
  const neck: Pt[] = [[U * 0.08, -U * 0.76 + bob], [U * 0.02, -U * 0.86], [U * 0.1, -U * 0.94], [U * 0.06, -U * 1.0]];
  ctx.lineWidth = U * 0.03;
  ctx.strokeStyle = '#56604a';
  ctx.beginPath();
  neck.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = INK.bone;
  ctx.fillStyle = '#56604a';
  ctx.beginPath();
  ctx.ellipse(U * 0.06, -U * 1.0, U * 0.035, U * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK.bone;
  fillPoly(ctx, [[U * 0.08, -U * 1.01], [U * 0.32, -U * 0.98], [U * 0.08, -U * 0.985]]);
  eye(ctx, U * 0.06, -U * 1.005, U * 0.01, LIME, fx.t);
}

// --------------------------------------------------------------- Root Knot

function drawKnot(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.1;
  const w = Math.max(1, u * 0.012);
  const creak = Math.sin(fx.t * 0.8 + fx.seed) * 0.04;
  // a tangle of thick roots, twisted into a rough body
  ctx.strokeStyle = '#4a3a28';
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a0 = (i / 9) * Math.PI * 2;
    ctx.lineWidth = U * (0.06 + 0.03 * (noise(s + i) * 0.5 + 0.5));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * U * 0.35, 0);
    ctx.bezierCurveTo(
      Math.cos(a0 + 1.5 + creak) * U * 0.4, -U * 0.3,
      Math.cos(a0 - 1.2) * U * 0.3, -U * 0.65,
      Math.cos(a0 + 0.8 + creak) * U * 0.18, -U * (0.85 + 0.1 * noise(s + i * 3)),
    );
    ctx.stroke();
  }
  ctx.lineWidth = w;
  ctx.strokeStyle = INK.bone;
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2;
    sketchStroke(ctx, [[Math.cos(a0) * U * 0.32, 0], [Math.cos(a0 + 1.5) * U * 0.3, -U * 0.4], [Math.cos(a0 + 0.8) * U * 0.16, -U * 0.85]], s + 60 + i * 5, U * 0.02);
  }
  // grasping root-fingers out to the sides
  for (const side of [-1, 1]) {
    const reach = Math.sin(fx.t * 1.1 + side) * U * 0.04;
    sketchStroke(ctx, [[side * U * 0.2, -U * 0.55], [side * U * 0.5, -U * 0.6 + reach], [side * U * 0.62, -U * 0.45], [side * U * 0.7, -U * 0.5]], s + side * 30, U * 0.015);
  }
  mossFringe(ctx, [[-U * 0.2, -U * 0.8], [-U * 0.05, -U * 0.86], [U * 0.12, -U * 0.8], [U * 0.25, -U * 0.7]], U * 0.18, fx.t, s + 90);
  // a hollow in the wood, with a light inside
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(0, -U * 0.5, U * 0.09, U * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, 0, -U * 0.5, U * 0.04, LIME, fx.t * 0.5 + fx.seed);
}

// ------------------------------------------------------------ Mossback Stag

function drawStag(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.4;
  const w = Math.max(1.2, u * 0.013);
  ctx.lineWidth = w;
  const breathe = Math.sin(fx.t * 1.1 + fx.seed) * U * 0.01;
  // legs
  for (const [x, k] of [[-0.3, 0], [-0.18, 1], [0.2, 2], [0.3, 3]] as [number, number][]) {
    sketchStroke(ctx, [[x * U, -U * 0.4], [x * U + U * 0.02, -U * 0.2], [x * U, 0]], s + k * 5, U * 0.008);
  }
  // barrel body, overgrown: moss, ferns, a small tree on its back
  ctx.fillStyle = '#3a3a2c';
  const body = sketchEllipse(0, -U * 0.48 + breathe, U * 0.36, U * 0.14, s + 10, 16);
  smoothPath(ctx, body);
  ctx.fill();
  sketchStroke(ctx, body, s + 11, U * 0.008, true);
  ctx.fillStyle = MOSS;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(-U * 0.3 + i * U * 0.1, -U * 0.6 + breathe + noise(s + i) * U * 0.02, U * 0.07, U * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  sketchStroke(ctx, [[-U * 0.08, -U * 0.62], [-U * 0.1, -U * 0.8], [-U * 0.16, -U * 0.9]], s + 20, U * 0.01);
  sketchStroke(ctx, [[-U * 0.1, -U * 0.78], [-U * 0.02, -U * 0.88]], s + 21, U * 0.008);
  mossFringe(ctx, [[-U * 0.28, -U * 0.4], [-U * 0.1, -U * 0.36], [U * 0.1, -U * 0.36], [U * 0.26, -U * 0.4]], U * 0.1, fx.t, s + 22);
  // neck and head, low and heavy
  ctx.fillStyle = '#3a3a2c';
  const head: Pt[] = [[U * 0.28, -U * 0.55], [U * 0.44, -U * 0.72], [U * 0.56, -U * 0.66], [U * 0.5, -U * 0.56], [U * 0.34, -U * 0.44]];
  fillPoly(ctx, head);
  sketchStroke(ctx, head, s + 30, U * 0.008, true);
  // antlers: branching wood with moss hanging off
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = U * 0.018;
  for (const side of [-1, 1]) {
    const bx = U * 0.46;
    const by = -U * 0.72;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + side * U * 0.12, by - U * 0.2);
    ctx.lineTo(bx + side * U * 0.22, by - U * 0.3);
    ctx.moveTo(bx + side * U * 0.08, by - U * 0.13);
    ctx.lineTo(bx + side * U * 0.2, by - U * 0.14);
    ctx.moveTo(bx + side * U * 0.15, by - U * 0.24);
    ctx.lineTo(bx + side * U * 0.12, by - U * 0.36);
    ctx.stroke();
  }
  ctx.strokeStyle = INK.bone;
  ctx.lineWidth = w;
  mossFringe(ctx, [[U * 0.36, -U * 0.86], [U * 0.62, -U * 0.84]], U * 0.1, fx.t, s + 40);
  eye(ctx, U * 0.49, -U * 0.66, U * 0.02, LIME, fx.t + fx.seed);
}

// ------------------------------------------------------------ Leech Mother

function drawQueen(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.2;
  const w = Math.max(1.2, u * 0.013);
  ctx.lineWidth = w;
  const pulse = 1 + Math.sin(fx.t * 1.3 + fx.seed) * 0.03;
  // a pale bloated body, half sunk in the mud
  ctx.fillStyle = 'rgba(20,28,22,0.9)';
  ctx.beginPath();
  ctx.ellipse(0, -U * 0.03, U * 0.55, U * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b9a79a';
  const body = sketchEllipse(0, -U * 0.4, U * 0.42 * pulse, U * 0.38 * pulse, s, 18);
  smoothPath(ctx, body);
  ctx.fill();
  sketchStroke(ctx, body, s + 1, U * 0.01, true);
  // ring segments
  for (let i = 1; i < 5; i++) {
    const y = -U * 0.72 + i * U * 0.13;
    sketchStroke(ctx, [[-U * 0.36 * Math.sin((i / 5) * Math.PI + 0.3), y], [U * 0.36 * Math.sin((i / 5) * Math.PI + 0.3), y]], s + i * 7, U * 0.008);
  }
  // dark young clinging to her
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + fx.t * 0.2;
    ctx.fillStyle = LEECH_SKIN;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * U * 0.34, -U * 0.4 + Math.sin(a) * U * 0.3, U * 0.08, U * 0.03, a + 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // a crown of sucking mouths on top
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * U * 0.16;
    const lift = Math.sin(fx.t * 2 + i) * U * 0.03;
    ctx.fillStyle = '#b9a79a';
    ctx.beginPath();
    ctx.ellipse(x, -U * 0.8 - lift, U * 0.06, U * 0.1, (i - 1) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK.fleshDark;
    ctx.beginPath();
    ctx.arc(x + (i - 1) * U * 0.02, -U * 0.88 - lift, U * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  eye(ctx, -U * 0.1, -U * 0.55, U * 0.03, INK.flesh, fx.t);
  eye(ctx, U * 0.1, -U * 0.55, U * 0.03, INK.flesh, fx.t + 1);
}

// -------------------------------------------------------- The Drowned Titan

function drawTitan(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.0;
  const w = Math.max(1.3, u * 0.014);
  ctx.lineWidth = w;
  const breathe = Math.sin(fx.t * 0.6) * U * 0.02;
  // it stands in a lake of black water
  ctx.fillStyle = 'rgba(16,30,34,0.95)';
  ctx.beginPath();
  ctx.ellipse(0, -U * 0.05, U * 0.9, U * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,176,168,0.5)';
  for (let k = 0; k < 3; k++) {
    const ph = (fx.t * 0.3 + k / 3) % 1;
    ctx.beginPath();
    ctx.ellipse(0, -U * 0.05, U * (0.5 + ph * 0.4), U * (0.08 + ph * 0.06), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = INK.bone;
  // a trunk of a body: bark, roots and the ghost of a flight suit
  ctx.fillStyle = '#2e2a20';
  const trunk: Pt[] = [
    [-U * 0.5, -U * 0.08], [-U * 0.42, -U * 0.7], [-U * 0.55, -U * 1.1 + breathe], [-U * 0.25, -U * 1.35 + breathe],
    [U * 0.25, -U * 1.35 + breathe], [U * 0.55, -U * 1.1 + breathe], [U * 0.42, -U * 0.7], [U * 0.5, -U * 0.08],
  ];
  fillPoly(ctx, trunk);
  sketchStroke(ctx, trunk, s, U * 0.01, true);
  for (let i = 0; i < 6; i++) {
    const x = -U * 0.35 + i * U * 0.14;
    sketchStroke(ctx, [[x, -U * 0.1], [x + noise(s + i) * U * 0.05, -U * 0.7], [x + noise(s + i + 5) * U * 0.08, -U * 1.2]], s + 20 + i * 3, U * 0.01);
  }
  // the old suit: a collar ring and a faded mission patch
  ctx.strokeStyle = '#8a8676';
  ctx.beginPath();
  ctx.ellipse(0, -U * 1.28 + breathe, U * 0.2, U * 0.05, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = INK.sodium;
  ctx.globalAlpha *= 0.6;
  ctx.fillRect(-U * 0.3, -U * 1.0, U * 0.1, U * 0.07);
  ctx.globalAlpha /= 0.6;
  ctx.strokeStyle = INK.bone;
  // arms: huge root-limbs trailing into the water
  for (const side of [-1, 1]) {
    const sway = Math.sin(fx.t * 0.7 + side) * U * 0.04;
    ctx.strokeStyle = '#3a3426';
    ctx.lineWidth = U * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * U * 0.48, -U * 1.1 + breathe);
    ctx.quadraticCurveTo(side * U * 0.9 + sway, -U * 0.9, side * U * 0.8 + sway, -U * 0.1);
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.strokeStyle = INK.bone;
    sketchStroke(ctx, [[side * U * 0.48, -U * 1.1], [side * U * 0.9 + sway, -U * 0.9], [side * U * 0.8 + sway, -U * 0.1]], s + side * 40, U * 0.012);
  }
  // the head: a helmet grown over with fungus, the visor still glowing
  ctx.fillStyle = '#403a2c';
  ctx.beginPath();
  ctx.ellipse(0, -U * 1.5 + breathe, U * 0.2, U * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const glow = 0.5 + 0.4 * Math.sin(fx.t * 1.3);
  ctx.fillStyle = `rgba(196,216,106,${glow})`;
  ctx.beginPath();
  ctx.ellipse(0, -U * 1.5 + breathe, U * 0.14, U * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // shelf fungus and hanging moss everywhere
  ctx.fillStyle = '#b8a07a';
  for (const [x, y, r] of [[-U * 0.4, -U * 1.0, 0.1], [U * 0.38, -U * 0.8, 0.12], [-U * 0.2, -U * 0.6, 0.08], [U * 0.18, -U * 1.62, 0.09]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(x, y + breathe, U * r, U * r * 0.35, 0, Math.PI, 0);
    ctx.fill();
  }
  mossFringe(ctx, [[-U * 0.5, -U * 1.1], [-U * 0.3, -U * 1.3], [U * 0.1, -U * 1.33], [U * 0.35, -U * 1.25], [U * 0.52, -U * 1.1]], U * 0.3, fx.t, s + 70);
  mossFringe(ctx, [[-U * 0.15, -U * 1.42], [U * 0.15, -U * 1.42]], U * 0.18, fx.t, s + 80);
}
