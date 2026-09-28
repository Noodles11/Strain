import { INK } from './palette';
import { noise } from './sketch';

/** How a card or an enemy attack looks. */
export type FxKind =
  | 'cut' | 'flense' | 'saw' | 'heavy' | 'harpoon' | 'hook' | 'dart' | 'pellets' | 'psychic' | 'drain' | 'shatter'
  | 'echo' | 'shield' | 'heal' | 'spark' | 'swirl' | 'claw' | 'beam' | 'bolt' | 'bite' | 'slam';

/** Card id → animation. Cards not listed fall back on what they do. */
const CARD_FX: Record<string, FxKind> = {
  scalpel: 'cut', unscarred: 'cut', sibling: 'cut', feeding: 'cut', graft: 'cut', cannibal: 'swirl',
  flense: 'flense', bonesaw: 'saw', hunger: 'heavy', siphon: 'drain',
  harpoon: 'harpoon', hook: 'hook', needle: 'dart', triage: 'dart', jack: 'dart',
  scatter: 'pellets', splitlens: 'pellets', spike: 'psychic',
  shatter: 'shatter', resonant: 'echo',
  brace: 'shield', callus: 'shield', crystalskin: 'shield', scartissue: 'shield', echo: 'shield', grief: 'shield',
  clot: 'heal', poultice: 'heal', knit: 'heal',
  adrenal: 'spark', donor: 'swirl', flask: 'swirl',
};

const ENEMY_FX: Record<string, FxKind> = {
  drone: 'bolt', prism: 'beam', choir: 'beam', geode: 'beam', refractor: 'beam',
  tick: 'bite', shardling: 'bite', bloom: 'slam', husk: 'slam', crawler: 'slam', first: 'slam',
};

export function cardFx(id: string): FxKind {
  return CARD_FX[id] ?? 'cut';
}

export function enemyFx(id: string): FxKind {
  return ENEMY_FX[id] ?? 'claw';
}

/** How long each animation holds the battle queue before the hit lands (ms). */
export function fxLead(kind: FxKind, hits = 1): number {
  switch (kind) {
    case 'harpoon': case 'hook': return 380;
    case 'pellets': case 'dart': case 'bolt': case 'beam': case 'psychic': return 330;
    case 'saw': return 260 + 120 * hits;
    case 'shield': case 'heal': case 'spark': case 'swirl': return 380;
    case 'claw': case 'bite': return 200 + 110 * hits;
    case 'slam': return 220;
    default: return 260;
  }
}

export interface Anchor {
  x: number;
  y: number;
  /** Body height in px, for scaling. */
  h: number;
}

interface Fx {
  kind: FxKind;
  t0: number;
  dur: number;
  from: Anchor;
  to: Anchor[];
  hits: number;
  seed: number;
}

const DUR: Partial<Record<FxKind, number>> = {
  harpoon: 1.05, hook: 1.05, shatter: 0.8, drain: 0.95, heal: 0.9, shield: 0.8, swirl: 0.8, beam: 0.6, psychic: 0.7,
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - (1 - v) ** 3;
const easeIn = (v: number) => v * v;

/** Short-lived attack drawings over the battle scene. */
export class FxLayer {
  private list: Fx[] = [];
  private n = 0;

  clear() {
    this.list = [];
  }

  add(kind: FxKind, t: number, from: Anchor, to: Anchor[], hits = 1) {
    const base = DUR[kind] ?? 0.5;
    const dur = kind === 'saw' || kind === 'claw' || kind === 'bite' ? base + 0.14 * (hits - 1) : base;
    this.list.push({ kind, t0: t, dur, from, to, hits, seed: ++this.n * 17.3 });
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    this.list = this.list.filter((f) => t - f.t0 < f.dur);
    for (const f of this.list) {
      const p = clamp((t - f.t0) / f.dur);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const to of f.to) this.one(ctx, f, p, to);
      ctx.restore();
    }
  }

  private one(ctx: CanvasRenderingContext2D, f: Fx, p: number, to: Anchor) {
    switch (f.kind) {
      case 'cut': slash(ctx, to, p, f.seed, 1, '#ffffff'); break;
      case 'heavy': slash(ctx, to, p, f.seed, 1.6, '#ffe7c7'); break;
      case 'flense':
        slash(ctx, to, p, f.seed, 1.1, '#ffffff');
        slash(ctx, { ...to, x: to.x + to.h * 0.08, y: to.y + to.h * 0.06 }, clamp(p * 1.1 - 0.1), f.seed, 0.9, '#f3b0a0');
        break;
      case 'saw':
        for (let i = 0; i < f.hits; i++) {
          const q = clamp((p * f.dur - i * 0.14) / 0.36);
          if (q > 0 && q < 1) zigzag(ctx, to, q, f.seed + i * 3.7, i);
        }
        break;
      case 'echo':
        slash(ctx, to, p, f.seed, 1, '#ffffff');
        slash(ctx, { ...to, x: to.x - to.h * 0.06 }, clamp(p - 0.25), f.seed, 1, 'rgba(176,111,224,0.9)');
        break;
      case 'harpoon': case 'hook': harpoon(ctx, f.from, to, p, f.kind === 'hook'); break;
      case 'dart': dart(ctx, f.from, to, p); break;
      case 'pellets': pellets(ctx, f.from, to, p, f.seed); break;
      case 'psychic': psychic(ctx, f.from, to, p); break;
      case 'drain':
        slash(ctx, to, clamp(p * 2), f.seed, 1.2, '#ffffff');
        drainFlow(ctx, to, f.from, clamp((p - 0.3) / 0.7), f.seed);
        break;
      case 'shatter': shatter(ctx, to, p, f.seed); break;
      case 'shield': shield(ctx, to, p); break;
      case 'heal': heal(ctx, to, p, f.seed); break;
      case 'spark': sparks(ctx, to, p, f.seed, INK.sodium); break;
      case 'swirl': swirl(ctx, to, p); break;
      case 'claw':
        for (let i = 0; i < f.hits; i++) {
          const q = clamp((p * f.dur - i * 0.14) / 0.3);
          if (q > 0 && q < 1) claw(ctx, to, q, i);
        }
        break;
      case 'beam': beam(ctx, f.from, to, p); break;
      case 'bite':
        for (let i = 0; i < f.hits; i++) {
          const q = clamp((p * f.dur - i * 0.14) / 0.3);
          if (q > 0 && q < 1) bite(ctx, to, q, i);
        }
        break;
      case 'slam': slam(ctx, to, p); break;
      case 'bolt': bolts(ctx, f.from, to, p, f.hits); break;
    }
  }
}

// ---- drawings ----

/** A single straight cut across the body that draws in fast and fades from its tail. */
function slash(ctx: CanvasRenderingContext2D, to: Anchor, p: number, seed: number, size: number, color: string) {
  if (p <= 0 || p >= 1) return;
  const L = to.h * 0.8 * size;
  const a = -0.75 + noise(seed) * 0.35;
  const dx = Math.cos(a) * L;
  const dy = -Math.sin(a) * L;
  const x0 = to.x - dx / 2;
  const y0 = to.y - dy / 2;
  const head = easeOut(clamp(p * 2.2));
  const tail = easeIn(clamp((p - 0.3) / 0.7));
  const hx = x0 + dx * head;
  const hy = y0 + dy * head;
  const tx = x0 + dx * tail;
  const ty = y0 + dy * tail;
  ctx.strokeStyle = 'rgba(255,240,220,0.22)';
  ctx.lineWidth = Math.max(6, to.h * 0.035 * size);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, to.h * 0.012 * size) * (1 - tail * 0.7);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  // a blood line opens behind the blade
  if (p > 0.25) {
    ctx.strokeStyle = `rgba(185,80,90,${0.8 * (1 - p)})`;
    ctx.lineWidth = Math.max(1.5, to.h * 0.01);
    ctx.beginPath();
    ctx.moveTo(x0 + dx * 0.1, y0 + dy * 0.1 + 3);
    ctx.lineTo(x0 + dx * head * 0.9, y0 + dy * head * 0.9 + 3);
    ctx.stroke();
  }
}

function zigzag(ctx: CanvasRenderingContext2D, to: Anchor, p: number, seed: number, i: number) {
  const w = to.h * 0.5;
  const y = to.y - to.h * 0.12 + i * to.h * 0.14;
  const x0 = to.x - w / 2;
  const head = easeOut(p * 1.4);
  ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
  ctx.lineWidth = Math.max(2, to.h * 0.014);
  ctx.beginPath();
  const teeth = 7;
  for (let k = 0; k <= teeth * head; k++) {
    const x = x0 + (k / teeth) * w;
    const yy = y + (k % 2 ? -1 : 1) * to.h * 0.035 + noise(seed + k) * 2;
    if (k === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number, hook: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = INK.bone;
  ctx.strokeStyle = INK.bone;
  if (hook) {
    ctx.lineWidth = s * 0.25;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, 0);
    ctx.lineTo(s * 0.5, 0);
    ctx.quadraticCurveTo(s * 0.9, 0, s * 0.8, -s * 0.5);
    ctx.lineTo(s * 0.45, -s * 0.35);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.3, -s * 0.45);
    ctx.lineTo(-s * 0.05, 0);
    ctx.lineTo(-s * 0.3, s * 0.45);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Harpoon: the head flies out trailing a slack line; it bites, the line snaps straight,
 * then the head is reeled back along the taut line.
 */
function harpoon(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number, hook: boolean) {
  const sx = from.x;
  const sy = from.y;
  const tx = to.x - to.h * 0.08;
  const ty = to.y;
  const fly = 0.34;
  const tense = 0.5;
  let hx: number;
  let hy: number;
  let sag: number;
  let wobble = 0;
  if (p < fly) {
    const q = easeOut(p / fly);
    hx = sx + (tx - sx) * q;
    hy = sy + (ty - sy) * q - Math.sin(q * Math.PI) * to.h * 0.25;
    sag = to.h * 0.35 * q;
  } else if (p < tense) {
    const q = (p - fly) / (tense - fly);
    hx = tx;
    hy = ty;
    sag = to.h * 0.35 * (1 - easeOut(q));
    wobble = Math.sin(q * Math.PI * 5) * to.h * 0.03 * (1 - q);
  } else {
    const q = easeIn((p - tense) / (1 - tense));
    hx = tx + (sx - tx) * q;
    hy = ty + (sy - ty) * q;
    sag = 0;
  }
  // the line
  const mx = (sx + hx) / 2;
  const my = (sy + hy) / 2 + sag + wobble;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(4, to.h * 0.03);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, hx, hy);
  ctx.stroke();
  ctx.strokeStyle = INK.bone;
  ctx.lineWidth = Math.max(2, to.h * 0.014);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, hx, hy);
  ctx.stroke();
  // the head points along the line; reeling back it still faces the prey
  const ang = p < tense ? Math.atan2(hy - my, hx - mx) : Math.atan2(ty - sy, tx - sx);
  arrowHead(ctx, hx, hy, ang, Math.max(12, to.h * 0.14), hook);
  if (p >= fly && p < tense + 0.08) {
    ctx.fillStyle = `rgba(185,80,90,${1 - (p - fly) / 0.24})`;
    for (let i = 0; i < 5; i++) ctx.fillRect(tx + noise(i * 3) * 10, ty + noise(i * 5) * 10, 3, 3);
  }
}

function dart(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number) {
  const fly = 0.4;
  if (p < fly) {
    const q = easeOut(p / fly);
    const x = from.x + (to.x - from.x) * q;
    const y = from.y + (to.y - from.y) * q;
    const bx = from.x + (to.x - from.x) * Math.max(0, q - 0.15);
    const by = from.y + (to.y - from.y) * Math.max(0, q - 0.15);
    ctx.strokeStyle = INK.bone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    const q = (p - fly) / (1 - fly);
    ctx.strokeStyle = `rgba(111,163,160,${1 - q})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(to.x, to.y, to.h * (0.05 + 0.2 * q), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function pellets(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number, seed: number) {
  for (let i = 0; i < 6; i++) {
    const delay = (noise(seed + i) * 0.5 + 0.5) * 0.15;
    const q = clamp((p - delay) / 0.45);
    const ox = noise(seed + i * 7) * to.h * 0.18;
    const oy = noise(seed + i * 11) * to.h * 0.22;
    if (q < 1) {
      const x = from.x + (to.x + ox - from.x) * q;
      const y = from.y + (to.y + oy - from.y) * q;
      ctx.fillStyle = INK.sodium;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    } else {
      const r = clamp((p - delay - 0.45) / 0.3);
      if (r < 1) sparks(ctx, { x: to.x + ox, y: to.y + oy, h: to.h * 0.25 }, r, seed + i, '#ffffff');
    }
  }
}

function psychic(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number) {
  const head = { x: to.x, y: to.y - to.h * 0.3 };
  const q = easeOut(clamp(p / 0.5));
  ctx.strokeStyle = `rgba(176,111,224,${1 - clamp((p - 0.5) / 0.5)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const steps = 30;
  for (let i = 0; i <= steps * q; i++) {
    const k = i / steps;
    const x = from.x + (head.x - from.x) * k;
    const y = from.y + (head.y - from.y) * k + Math.sin(k * 24 - p * 30) * 6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (p > 0.4) {
    const r = (p - 0.4) / 0.6;
    for (let i = 0; i < 3; i++) {
      const rr = clamp(r - i * 0.15);
      if (rr <= 0) continue;
      ctx.strokeStyle = `rgba(176,111,224,${1 - rr})`;
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, to.h * 0.3 * rr, to.h * 0.12 * rr, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drainFlow(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number, seed: number) {
  if (p <= 0) return;
  for (let i = 0; i < 10; i++) {
    const q = clamp(p * 1.4 - i * 0.04);
    if (q <= 0 || q >= 1) continue;
    const cx = (from.x + to.x) / 2;
    const cy = Math.min(from.y, to.y) - from.h * 0.3 + noise(seed + i) * 20;
    const x = (1 - q) ** 2 * from.x + 2 * (1 - q) * q * cx + q * q * to.x;
    const y = (1 - q) ** 2 * from.y + 2 * (1 - q) * q * cy + q * q * to.y;
    ctx.fillStyle = `rgba(185,80,90,${1 - q * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shatter(ctx: CanvasRenderingContext2D, to: Anchor, p: number, seed: number) {
  const grow = easeOut(clamp(p / 0.4));
  ctx.strokeStyle = `rgba(232,251,255,${1 - clamp((p - 0.5) / 0.5)})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + noise(seed + i) * 0.3;
    const L = to.h * 0.35 * grow * (0.6 + 0.4 * (noise(seed + i * 3) * 0.5 + 0.5));
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x + Math.cos(a) * L * 0.5 + noise(i) * 4, to.y + Math.sin(a) * L * 0.5);
    ctx.lineTo(to.x + Math.cos(a) * L, to.y + Math.sin(a) * L);
    ctx.stroke();
  }
  if (p > 0.35) {
    const q = (p - 0.35) / 0.65;
    ctx.fillStyle = `rgba(159,210,228,${1 - q})`;
    for (let i = 0; i < 12; i++) {
      const a = noise(seed + i * 13) * Math.PI;
      const d = to.h * (0.2 + 0.5 * q) * (0.5 + 0.5 * (noise(seed + i) * 0.5 + 0.5));
      const x = to.x + Math.cos(a * 2) * d;
      const y = to.y + Math.sin(a * 2) * d + q * q * to.h * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 3, y + 3);
      ctx.lineTo(x - 3, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function shield(ctx: CanvasRenderingContext2D, to: Anchor, p: number) {
  const q = easeOut(clamp(p / 0.5));
  const a = 1 - clamp((p - 0.45) / 0.55);
  const r = to.h * (0.35 + 0.1 * q);
  ctx.strokeStyle = `rgba(216,207,184,${a})`;
  ctx.fillStyle = `rgba(216,207,184,${a * 0.12})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 6 + (i / 6) * Math.PI * 2;
    const x = to.x + Math.cos(ang) * r * q;
    const y = to.y + Math.sin(ang) * r * 1.15 * q;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function heal(ctx: CanvasRenderingContext2D, to: Anchor, p: number, seed: number) {
  ctx.fillStyle = `rgba(127,212,138,${1 - p})`;
  for (let i = 0; i < 7; i++) {
    const q = clamp(p * 1.3 - i * 0.05);
    const x = to.x + noise(seed + i) * to.h * 0.3;
    const y = to.y + to.h * 0.2 - q * to.h * 0.6;
    const s = 4 + (i % 3) * 2;
    ctx.fillRect(x - s / 2, y - 1.5, s, 3);
    ctx.fillRect(x - 1.5, y - s / 2, 3, s);
  }
}

function sparks(ctx: CanvasRenderingContext2D, to: Anchor, p: number, seed: number, color: string) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 1 - p;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + noise(seed + i);
    const r0 = to.h * 0.15 * easeOut(p);
    const r1 = r0 + to.h * 0.12 * (1 - p);
    ctx.beginPath();
    ctx.moveTo(to.x + Math.cos(a) * r0, to.y + Math.sin(a) * r0);
    ctx.lineTo(to.x + Math.cos(a) * r1, to.y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function swirl(ctx: CanvasRenderingContext2D, to: Anchor, p: number) {
  ctx.strokeStyle = `rgba(176,111,224,${1 - p})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const k = i / 40;
    const a = k * Math.PI * 4 + p * 8;
    const r = to.h * 0.35 * k * (1 - p * 0.5);
    const x = to.x + Math.cos(a) * r;
    const y = to.y + Math.sin(a) * r * 0.6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Three raking scratches across the clone. */
function claw(ctx: CanvasRenderingContext2D, to: Anchor, p: number, i: number) {
  const head = easeOut(clamp(p * 1.8));
  const fade = 1 - clamp((p - 0.4) / 0.6);
  const dir = i % 2 ? -1 : 1;
  for (let k = 0; k < 3; k++) {
    const ox = (k - 1) * to.h * 0.08;
    const x0 = to.x + ox - dir * to.h * 0.18;
    const y0 = to.y - to.h * 0.22;
    const x1 = to.x + ox + dir * to.h * 0.12;
    const y1 = to.y + to.h * 0.18;
    ctx.strokeStyle = `rgba(198,90,99,${fade})`;
    ctx.lineWidth = Math.max(2.5, to.h * 0.02);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + dir * 10, (y0 + y1) / 2, x0 + (x1 - x0) * head, y0 + (y1 - y0) * head);
    ctx.stroke();
  }
}

/** Two rows of teeth snap shut on the clone. */
function bite(ctx: CanvasRenderingContext2D, to: Anchor, p: number, i: number) {
  const close = easeIn(clamp(p / 0.45));
  const fade = 1 - clamp((p - 0.5) / 0.5);
  const x = to.x + (i % 2 ? 1 : -1) * to.h * 0.08;
  const y = to.y - to.h * 0.05;
  const w = to.h * 0.35;
  const gap = to.h * 0.22 * (1 - close);
  ctx.fillStyle = `rgba(216,207,184,${fade})`;
  for (const side of [-1, 1]) {
    const jy = y + side * gap;
    for (let k = 0; k < 5; k++) {
      const tx = x - w / 2 + (k + 0.5) * (w / 5);
      ctx.beginPath();
      ctx.moveTo(tx - w / 12, jy);
      ctx.lineTo(tx + w / 12, jy);
      ctx.lineTo(tx, jy - side * to.h * 0.07);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (close >= 1) {
    ctx.fillStyle = `rgba(185,80,90,${fade})`;
    for (let k = 0; k < 4; k++) ctx.fillRect(x - w / 3 + k * (w / 5), y + 4, 3, 5 + k * 2);
  }
}

/** A heavy blow: an impact star and a ring on the floor. */
function slam(ctx: CanvasRenderingContext2D, to: Anchor, p: number) {
  const hit = clamp(p / 0.25);
  const after = clamp((p - 0.25) / 0.75);
  if (p < 0.25) {
    ctx.fillStyle = `rgba(255,236,226,${0.5 * hit})`;
    ctx.beginPath();
    ctx.arc(to.x, to.y, to.h * 0.12 * hit, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = `rgba(255,236,226,${1 - after})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r0 = to.h * (0.1 + 0.15 * after);
    const r1 = r0 + to.h * 0.12 * (1 - after);
    ctx.beginPath();
    ctx.moveTo(to.x + Math.cos(a) * r0, to.y + Math.sin(a) * r0);
    ctx.lineTo(to.x + Math.cos(a) * r1, to.y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(216,207,184,${0.6 * (1 - after)})`;
  ctx.beginPath();
  ctx.ellipse(to.x, to.y + to.h * 0.65, to.h * (0.3 + 0.5 * after), to.h * (0.05 + 0.08 * after), 0, 0, Math.PI * 2);
  ctx.stroke();
}

function beam(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number) {
  const on = easeOut(clamp(p / 0.25));
  const off = clamp((p - 0.5) / 0.5);
  const x1 = from.x + (to.x - from.x) * on;
  const y1 = from.y + (to.y - from.y) * on;
  ctx.strokeStyle = `rgba(176,111,224,${0.5 * (1 - off)})`;
  ctx.lineWidth = to.h * 0.1 * (1 - off);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${1 - off})`;
  ctx.lineWidth = Math.max(1, to.h * 0.02 * (1 - off));
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function bolts(ctx: CanvasRenderingContext2D, from: Anchor, to: Anchor, p: number, hits: number) {
  for (let i = 0; i < Math.max(1, hits); i++) {
    const q = clamp((p - i * 0.2) / 0.45);
    if (q <= 0 || q >= 1) continue;
    const x = from.x + (to.x - from.x) * q;
    const y = from.y + (to.y - from.y) * q;
    ctx.fillStyle = INK.sodium;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(227,163,59,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (to.x - from.x) * 0.08, y - (to.y - from.y) * 0.08);
    ctx.stroke();
  }
}
