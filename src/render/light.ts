import { halftone } from './texture';

/** A light in screen space. `r` is its reach in px; `color` tints what it lights. */
export interface Light {
  x: number;
  y: number;
  r: number;
  color?: string;
  /** 0..1, how much darkness it cuts (default 1). */
  power?: number;
}

export interface LightOpts {
  /** How dark unlit areas get, 0..1. */
  dark: number;
  /** The colour of the dark: a cold blue-black reads eerier than pure black. */
  tint: string;
  /** Strength of the halftone dots in the shadows, 0..1. */
  dots: number;
  /** Strength of the coloured glow around lights, 0..1. */
  glow: number;
}

/**
 * Comic-book lighting over a finished scene. Darkness is cut away around each light in hard
 * steps (lit, half-lit, shadow) rather than a smooth falloff, like inked panels; what stays dark
 * gets a halftone screen, and each light adds a flat coloured glow on top.
 */
export class Lighting {
  private shadeCv: HTMLCanvasElement | null = null;
  private dotsCv: HTMLCanvasElement | null = null;

  apply(ctx: CanvasRenderingContext2D, W: number, H: number, lights: Light[], o: LightOpts) {
    if (typeof document === 'undefined' || W <= 0 || H <= 0) return;
    const dpr = ctx.getTransform().a || 1;
    // the dark mask at half resolution: it's soft-edged inside each band anyway
    const q = 0.5;
    const sw = Math.ceil(W * q);
    const sh = Math.ceil(H * q);
    const shadeCv = (this.shadeCv ??= document.createElement('canvas'));
    if (shadeCv.width !== sw || shadeCv.height !== sh) { shadeCv.width = sw; shadeCv.height = sh; }
    const s = shadeCv.getContext('2d')!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, sw, sh);
    s.fillStyle = o.tint;
    s.fillRect(0, 0, sw, sh);
    s.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const p = Math.max(0, Math.min(1, l.power ?? 1));
      if (p <= 0 || l.r <= 1) continue;
      const x = l.x * q;
      const y = l.y * q;
      const r = l.r * q;
      const g = s.createRadialGradient(x, y, 0, x, y, r);
      // three hard bands with a sliver of blur between them
      g.addColorStop(0, `rgba(0,0,0,${p})`);
      g.addColorStop(0.42, `rgba(0,0,0,${p})`);
      g.addColorStop(0.46, `rgba(0,0,0,${p * 0.62})`);
      g.addColorStop(0.7, `rgba(0,0,0,${p * 0.62})`);
      g.addColorStop(0.74, `rgba(0,0,0,${p * 0.28})`);
      g.addColorStop(0.94, `rgba(0,0,0,${p * 0.28})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g;
      s.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // darken
    ctx.save();
    ctx.globalAlpha = o.dark;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shadeCv, 0, 0, W, H);
    ctx.restore();

    // halftone dots, only where it's dark
    if (o.dots > 0) {
      const dw = Math.ceil(W * dpr);
      const dh = Math.ceil(H * dpr);
      const dotsCv = (this.dotsCv ??= document.createElement('canvas'));
      if (dotsCv.width !== dw || dotsCv.height !== dh) { dotsCv.width = dw; dotsCv.height = dh; }
      const d = dotsCv.getContext('2d')!;
      d.setTransform(1, 0, 0, 1, 0, 0);
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, dw, dh);
      const pat = halftone(d, Math.max(4, Math.round(5 * dpr)));
      if (pat) {
        d.fillStyle = pat;
        d.fillRect(0, 0, dw, dh);
        d.globalCompositeOperation = 'destination-in';
        d.drawImage(shadeCv, 0, 0, dw, dh);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = o.dots;
        ctx.drawImage(dotsCv, 0, 0);
        ctx.restore();
      }
    }

    // flat coloured glow in the lit band of each coloured light
    if (o.glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        if (!l.color) continue;
        const p = (l.power ?? 1) * o.glow;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.72);
        g.addColorStop(0, withAlpha(l.color, 0.32 * p));
        g.addColorStop(0.45, withAlpha(l.color, 0.18 * p));
        g.addColorStop(0.5, withAlpha(l.color, 0.08 * p));
        g.addColorStop(1, withAlpha(l.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.restore();
    }
  }
}

/** '#rrggbb' with an alpha. */
export function withAlpha(hex: string, a: number): string {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** A lamp's brightness over time: most burn steady, some stutter, a few are dying. */
export function flicker(t: number, seed: number): number {
  const kind = seed % 7;
  if (kind === 0) {
    // dying: long dark gaps with sputters
    const k = Math.sin(t * 13 + seed) * Math.sin(t * 3.7 + seed * 2);
    return k > 0.35 ? 1 : k > 0.1 ? 0.4 : 0.08;
  }
  if (kind === 1) return Math.sin(t * 31 + seed) > -0.6 ? 1 : 0.3;
  return 0.9 + 0.1 * Math.sin(t * 2 + seed);
}

/** Theme colour of the eerie light each planet leaks: emergency red, cave violet, swamp lime. */
export const EERIE: Record<string, { lamp: string; eerie: string; tint: string; dark: number }> = {
  derelict: { lamp: '#e3a33b', eerie: '#b9505a', tint: '#06080d', dark: 0.55 },
  kessra: { lamp: '#9fe6f0', eerie: '#b06fe0', tint: '#050a14', dark: 0.52 },
  mireth: { lamp: '#c4d86a', eerie: '#7fd48a', tint: '#050b07', dark: 0.55 },
};
