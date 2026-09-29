import type { Theme } from './theme';

/**
 * Procedural surfaces: every tile texture and floor decal is made from a hash of the tile's
 * coordinates, so the same spot always looks the same, on the map and in battle.
 */

/** Stable 0..1 hash of a tile and a salt. */
export function hash(x: number, y: number, n = 0): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

const VARIANTS = 6;
const cache = new Map<string, HTMLCanvasElement>();

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Shift a #rrggbb colour lighter (+) or darker (−) by an amount 0..1. */
export function shade(hex: string, k: number): string {
  const p = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f((p >> 16) & 255)},${f((p >> 8) & 255)},${f(p & 255)})`;
}

/** Scattered specks of grit: the grain that keeps flat colour from looking digital. */
function grit(c: CanvasRenderingContext2D, S: number, seed: number, base: string, n: number, spread = 0.18) {
  for (let i = 0; i < n; i++) {
    const r = hash(seed, i, 1);
    c.fillStyle = shade(base, (r - 0.5) * 2 * spread);
    const s = 1 + Math.floor(hash(seed, i, 2) * 2);
    c.fillRect(hash(seed, i, 3) * S, hash(seed, i, 4) * S, s, s);
  }
}

/** A floor tile texture: one of a few variants per planet, picked by the tile's hash. */
export function floorTex(planet: string, th: Theme, S: number, x: number, y: number): HTMLCanvasElement {
  const v = Math.floor(hash(x, y, 9) * VARIANTS);
  const key = `f:${planet}:${S}:${v}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = canvas(S, S);
  const c = cv.getContext('2d')!;
  const seed = v * 31 + 7;
  c.fillStyle = th.floor;
  c.fillRect(0, 0, S, S);
  if (planet === 'derelict') {
    // riveted deck plate: bevelled edges, grit, scuffs, the odd oil stain or tread pattern
    grit(c, S, seed, th.floor, S * 1.2, 0.12);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, S - 2, S, 2);
    c.fillRect(S - 2, 0, 2, S);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(0, 0, S, 1);
    c.fillRect(0, 0, 1, S);
    for (const [rx, ry] of [[4, 4], [S - 5, 4], [4, S - 5], [S - 5, S - 5]]) {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath(); c.arc(rx + 0.6, ry + 0.6, 1.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(th.floor, 0.25);
      c.beginPath(); c.arc(rx, ry, 1.2, 0, Math.PI * 2); c.fill();
    }
    if (v === 1 || v === 4) {
      const g = c.createRadialGradient(S * 0.55, S * 0.6, 0, S * 0.55, S * 0.6, S * 0.4);
      g.addColorStop(0, 'rgba(10,8,6,0.45)');
      g.addColorStop(1, 'rgba(10,8,6,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    }
    if (v === 2) {
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(S * 0.2 + i * S * 0.13, S * 0.25); c.lineTo(S * 0.28 + i * S * 0.13, S * 0.4); c.stroke(); }
    }
    c.strokeStyle = 'rgba(216,207,184,0.1)';
    c.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const a = hash(seed, i, 5) * Math.PI;
      const cx = hash(seed, i, 6) * S;
      const cy = hash(seed, i, 7) * S;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * S * 0.3, cy + Math.sin(a) * S * 0.3); c.stroke();
    }
  } else if (planet === 'kessra') {
    // ice-glazed rock: soft mottling, hairline cracks catching the light, tiny glints
    for (let i = 0; i < 4; i++) {
      const g = c.createRadialGradient(hash(seed, i, 1) * S, hash(seed, i, 2) * S, 0, hash(seed, i, 1) * S, hash(seed, i, 2) * S, S * 0.45);
      g.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    }
    grit(c, S, seed, th.floor, S * 0.6, 0.1);
    c.strokeStyle = 'rgba(190,240,250,0.22)';
    c.lineWidth = 1;
    if (v % 2 === 0) {
      let px = hash(seed, 0, 8) * S;
      let py = 0;
      c.beginPath(); c.moveTo(px, py);
      for (let i = 0; i < 5; i++) { px += (hash(seed, i, 9) - 0.5) * S * 0.4; py += S * 0.22; c.lineTo(px, py); }
      c.stroke();
    }
    c.fillStyle = 'rgba(230,252,255,0.8)';
    for (let i = 0; i < 3; i++) c.fillRect(hash(seed, i, 11) * S, hash(seed, i, 12) * S, 1, 1);
  } else {
    // mud: dark mottling, pebbles, a scatter of dead leaves
    for (let i = 0; i < 5; i++) {
      const g = c.createRadialGradient(hash(seed, i, 1) * S, hash(seed, i, 2) * S, 0, hash(seed, i, 1) * S, hash(seed, i, 2) * S, S * 0.4);
      g.addColorStop(0, i % 2 ? 'rgba(90,110,60,0.12)' : 'rgba(0,0,0,0.14)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    }
    grit(c, S, seed, th.floor, S * 1.0, 0.16);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? 'rgba(120,96,52,0.55)' : 'rgba(80,98,48,0.5)';
      c.save();
      c.translate(hash(seed, i, 13) * S, hash(seed, i, 14) * S);
      c.rotate(hash(seed, i, 15) * Math.PI);
      c.beginPath(); c.ellipse(0, 0, S * 0.07, S * 0.03, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }
  cache.set(key, cv);
  return cv;
}

/** The raised top of a wall block. */
export function wallTopTex(planet: string, th: Theme, S: number, x: number, y: number): HTMLCanvasElement {
  const v = Math.floor(hash(x, y, 19) * VARIANTS);
  const key = `t:${planet}:${S}:${v}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = canvas(S, S);
  const c = cv.getContext('2d')!;
  const seed = v * 17 + 3;
  c.fillStyle = th.wallTop;
  c.fillRect(0, 0, S, S);
  if (planet === 'derelict') {
    grit(c, S, seed, th.wallTop, S * 0.8, 0.1);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 1;
    c.strokeRect(S * 0.15, S * 0.15, S * 0.7, S * 0.7);
    if (v === 3) {
      // hazard stripes on a service hatch
      c.save();
      c.beginPath(); c.rect(S * 0.2, S * 0.2, S * 0.6, S * 0.6); c.clip();
      for (let i = -4; i < 8; i++) {
        c.fillStyle = i % 2 ? 'rgba(227,163,59,0.55)' : 'rgba(20,20,20,0.5)';
        c.beginPath(); c.moveTo(i * S * 0.12, S); c.lineTo(i * S * 0.12 + S * 0.06, S); c.lineTo(i * S * 0.12 + S * 0.66, 0); c.lineTo(i * S * 0.12 + S * 0.6, 0); c.fill();
      }
      c.restore();
    }
  } else if (planet === 'kessra') {
    // faceted rock
    for (let i = 0; i < 5; i++) {
      c.fillStyle = shade(th.wallTop, (hash(seed, i, 3) - 0.5) * 0.3);
      c.beginPath();
      const cx = hash(seed, i, 1) * S;
      const cy = hash(seed, i, 2) * S;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + hash(seed, i, k + 4);
        const r = S * (0.18 + 0.12 * hash(seed, i, k + 9));
        if (k) c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    }
    grit(c, S, seed, th.wallTop, S * 0.4, 0.15);
  } else {
    // a mat of moss over soil and roots
    grit(c, S, seed, th.wallTop, S * 1.2, 0.2);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? 'rgba(120,150,70,0.45)' : 'rgba(40,52,28,0.5)';
      c.beginPath();
      c.arc(hash(seed, i, 1) * S, hash(seed, i, 2) * S, S * (0.08 + 0.1 * hash(seed, i, 3)), 0, Math.PI * 2);
      c.fill();
    }
  }
  cache.set(key, cv);
  return cv;
}

/** The visible front face of a wall block (full tile width, `h` tall). */
export function wallFaceTex(planet: string, th: Theme, S: number, h: number, x: number, y: number): HTMLCanvasElement {
  const v = Math.floor(hash(x, y, 29) * VARIANTS);
  const key = `w:${planet}:${S}:${Math.round(h)}:${v}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = canvas(S, h);
  const c = cv.getContext('2d')!;
  const seed = v * 13 + 5;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(th.wallFace, 0.12));
  g.addColorStop(1, th.wallFace);
  c.fillStyle = g;
  c.fillRect(0, 0, S, h);
  if (planet === 'derelict') {
    // ribs, a pipe, a grille or a stain running down
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (const fx of [0.33, 0.66]) c.fillRect(S * fx, 0, 1, h);
    c.fillStyle = '#2a2b2e';
    c.fillRect(0, h * 0.28, S, h * 0.16);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, h * 0.28, S, 1);
    if (v === 2) {
      c.fillStyle = '#0c0d0f';
      c.fillRect(S * 0.3, h * 0.55, S * 0.4, h * 0.3);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      for (let i = 0; i < 4; i++) c.fillRect(S * 0.32, h * (0.58 + i * 0.07), S * 0.36, 1);
    }
    if (v === 4 || v === 5) {
      const sx = hash(seed, 0, 1) * S * 0.8;
      const sg = c.createLinearGradient(0, h * 0.44, 0, h);
      sg.addColorStop(0, 'rgba(60,30,20,0.5)');
      sg.addColorStop(1, 'rgba(60,30,20,0)');
      c.fillStyle = sg;
      c.fillRect(sx, h * 0.44, S * 0.12, h * 0.56);
    }
  } else if (planet === 'kessra') {
    // strata lines in the rock
    c.strokeStyle = 'rgba(159,210,228,0.14)';
    c.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      c.beginPath();
      c.moveTo(0, h * (i / 4) + (hash(seed, i, 1) - 0.5) * 3);
      c.lineTo(S, h * (i / 4) + (hash(seed, i, 2) - 0.5) * 3);
      c.stroke();
    }
  } else {
    // bark: vertical grain, hanging roots
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const bx = hash(seed, i, 1) * S;
      c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx + (hash(seed, i, 2) - 0.5) * 4, h); c.stroke();
    }
    c.strokeStyle = 'rgba(90,70,40,0.7)';
    for (let i = 0; i < 3; i++) {
      const bx = hash(seed, i, 3) * S;
      c.beginPath(); c.moveTo(bx, 0); c.quadraticCurveTo(bx + 3, h * 0.5, bx - 1, h * (0.5 + 0.5 * hash(seed, i, 4))); c.stroke();
    }
  }
  cache.set(key, cv);
  return cv;
}

// ---- floor decals ----

/** A decal shape in tile space (0..1 across the tile), drawn flat on the floor. */
export interface DecalShape {
  pts: [number, number][];
  fill?: string;
  stroke?: string;
  width?: number;
  closed?: boolean;
}

function ring(cx: number, cy: number, rx: number, ry: number, n = 10, wob = 0, seed = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (hash(seed, i, 41) - 0.5) * wob;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

/**
 * Litter on a floor tile: cables, stains and grates on the Derelict, shards and cracks on
 * Kessra, puddles, roots and toadstools on Mireth. About one open tile in five gets one.
 */
export function decalAt(planet: string, x: number, y: number, t: number): DecalShape[] {
  if (hash(x, y, 51) > 0.2) return [];
  const kind = Math.floor(hash(x, y, 52) * 4);
  const s = x * 7 + y * 13;
  const a = hash(x, y, 53) * Math.PI * 2;
  const rot = (u: number, v: number): [number, number] => {
    const du = u - 0.5;
    const dv = v - 0.5;
    return [0.5 + du * Math.cos(a) - dv * Math.sin(a), 0.5 + du * Math.sin(a) + dv * Math.cos(a)];
  };
  if (planet === 'derelict') {
    switch (kind) {
      case 0: { // a loose cable snaking across
        const pts: [number, number][] = [];
        for (let i = 0; i <= 8; i++) pts.push(rot(i / 8, 0.5 + Math.sin(i * 1.3 + s) * 0.14));
        return [{ pts, stroke: '#101113', width: 3 }, { pts, stroke: 'rgba(216,207,184,0.25)', width: 1 }];
      }
      case 1: // a dried blood smear
        return [{ pts: [rot(0.2, 0.45), rot(0.75, 0.35), rot(0.85, 0.5), rot(0.3, 0.62)], fill: 'rgba(90,30,36,0.55)', closed: true },
          { pts: ring(0.25, 0.55, 0.08, 0.06, 8, 0.4, s), fill: 'rgba(90,30,36,0.6)', closed: true }];
      case 2: { // a floor grate
        const box = [rot(0.32, 0.32), rot(0.68, 0.32), rot(0.68, 0.68), rot(0.32, 0.68)];
        const out: DecalShape[] = [{ pts: box, fill: '#0d0e10', stroke: 'rgba(216,207,184,0.2)', width: 1, closed: true }];
        for (let i = 1; i < 4; i++) out.push({ pts: [rot(0.35, 0.32 + i * 0.09), rot(0.65, 0.32 + i * 0.09)], stroke: 'rgba(80,82,86,0.9)', width: 1 });
        return out;
      }
      default: // scattered papers and bolts
        return [0, 1, 2].map((i) => {
          const cx = 0.25 + hash(x, y, 60 + i) * 0.5;
          const cy = 0.25 + hash(x, y, 63 + i) * 0.5;
          return { pts: [[cx - 0.07, cy - 0.05], [cx + 0.07, cy - 0.06], [cx + 0.08, cy + 0.05], [cx - 0.06, cy + 0.06]], fill: i ? 'rgba(200,190,160,0.5)' : 'rgba(40,40,44,0.9)', closed: true };
        });
    }
  }
  if (planet === 'kessra') {
    switch (kind) {
      case 0: // a cluster of fallen shards
        return [0, 1, 2, 3].map((i) => {
          const cx = 0.3 + hash(x, y, 70 + i) * 0.4;
          const cy = 0.3 + hash(x, y, 74 + i) * 0.4;
          const aa = hash(x, y, 78 + i) * Math.PI;
          return { pts: [[cx + Math.cos(aa) * 0.12, cy + Math.sin(aa) * 0.12], [cx + Math.cos(aa + 2.6) * 0.04, cy + Math.sin(aa + 2.6) * 0.04], [cx + Math.cos(aa - 2.6) * 0.04, cy + Math.sin(aa - 2.6) * 0.04]], fill: 'rgba(159,230,240,0.55)', stroke: 'rgba(230,252,255,0.6)', width: 1, closed: true };
        });
      case 1: { // a star of cracks
        const out: DecalShape[] = [];
        for (let i = 0; i < 5; i++) {
          const aa = a + i * 1.25;
          out.push({ pts: [[0.5, 0.5], [0.5 + Math.cos(aa) * 0.2, 0.5 + Math.sin(aa) * 0.2], [0.5 + Math.cos(aa + 0.3) * 0.38, 0.5 + Math.sin(aa + 0.3) * 0.38]], stroke: 'rgba(200,245,255,0.35)', width: 1 });
        }
        return out;
      }
      case 2: // a frost ring
        return [{ pts: ring(0.5, 0.5, 0.32, 0.26, 14, 0.25, s), stroke: 'rgba(230,252,255,0.35)', width: 1.5, closed: true }];
      default: // a pale glowing crystal bud
        return [{ pts: ring(0.5, 0.5, 0.12, 0.09, 6, 0.5, s), fill: `rgba(159,230,240,${0.35 + 0.2 * Math.sin(t * 2 + s)})`, closed: true }];
    }
  }
  // Mireth
  switch (kind) {
    case 0: // a black puddle with a glint that moves
      return [{ pts: ring(0.5, 0.5, 0.34, 0.24, 12, 0.35, s), fill: 'rgba(12,24,28,0.85)', closed: true },
        { pts: [[0.35 + 0.05 * Math.sin(t * 0.8 + s), 0.44], [0.52 + 0.05 * Math.sin(t * 0.8 + s), 0.42]], stroke: 'rgba(143,196,188,0.55)', width: 1.5 }];
    case 1: { // roots breaking the surface
      const out: DecalShape[] = [];
      for (let i = 0; i < 3; i++) {
        const pts: [number, number][] = [];
        for (let k = 0; k <= 6; k++) pts.push(rot(k / 6, 0.3 + i * 0.2 + Math.sin(k * 1.7 + i * 3 + s) * 0.06));
        out.push({ pts, stroke: 'rgba(70,52,30,0.9)', width: 2 });
      }
      return out;
    }
    case 2: // a ring of tiny toadstools
      return [0, 1, 2, 3, 4].map((i) => {
        const aa = (i / 5) * Math.PI * 2 + a;
        return { pts: ring(0.5 + Math.cos(aa) * 0.22, 0.5 + Math.sin(aa) * 0.18, 0.05, 0.04, 6, 0, s + i), fill: i % 2 ? 'rgba(210,122,100,0.8)' : 'rgba(220,210,180,0.8)', closed: true };
      });
    default: // lily pads on wet ground
      return [0, 1].map((i) => ({
        pts: ring(0.35 + i * 0.3, 0.4 + i * 0.2, 0.13, 0.1, 10, 0.1, s + i), fill: 'rgba(90,120,55,0.75)', stroke: 'rgba(160,190,90,0.5)', width: 1, closed: true,
      }));
  }
}

let dotsCache: { pattern: CanvasPattern; key: string } | null = null;

/** A halftone screen of round dots, as a pattern. */
export function halftone(ctx: CanvasRenderingContext2D, cell: number): CanvasPattern | null {
  const key = String(cell);
  if (dotsCache && dotsCache.key === key) return dotsCache.pattern;
  const cv = canvas(cell, cell);
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(cell / 2, cell / 2, cell * 0.28, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(0, 0, cell * 0.2, 0, Math.PI * 2);
  c.arc(cell, 0, cell * 0.2, 0, Math.PI * 2);
  c.arc(0, cell, cell * 0.2, 0, Math.PI * 2);
  c.arc(cell, cell, cell * 0.2, 0, Math.PI * 2);
  c.fill();
  const pattern = ctx.createPattern(cv, 'repeat');
  if (pattern) dotsCache = { pattern, key };
  return pattern;
}
