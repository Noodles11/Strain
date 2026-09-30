/** The six body traits. Every card number, and most derived stats, read from these. */
export type Trait = 'mgt' | 'hde' | 'rfx' | 'foc' | 'met' | 'abr';

export const TRAITS: Trait[] = ['mgt', 'hde', 'rfx', 'foc', 'met', 'abr'];

export type Traits = Record<Trait, number>;

export const TRAIT_INFO: Record<Trait, { name: string; short: string; glyph: string; domain: string; battle: string; explore: string }> = {
  mgt: { name: 'Might', short: 'MGT', glyph: '✊', domain: 'Physical', battle: 'Strike damage', explore: 'Clear debris, pry caches, burn nests' },
  hde: { name: 'Hide', short: 'HDE', glyph: '⬢', domain: 'Physical', battle: 'Plating, max integrity', explore: 'Resist hazards, less hurt forcing things' },
  rfx: { name: 'Reflex', short: 'RFX', glyph: '⚡', domain: 'Neural', battle: 'Initiative, multi-hit, hand size', explore: 'Sneak, flee, stay unseen' },
  foc: { name: 'Focus', short: 'FOC', glyph: '◎', domain: 'Neural', battle: 'Debuffs, draw, energy', explore: 'Open locks, spot caches and ambushes' },
  met: { name: 'Metabolism', short: 'MET', glyph: '✚', domain: 'Visceral', battle: 'Healing, biomass', explore: 'Mending with biomass, resting' },
  abr: { name: 'Aberrance', short: 'ABR', glyph: '⟁', domain: 'Visceral', battle: 'Drain, wrong cards', explore: 'Strange things' },
};

export const SEQUENCE_START = 3;
export const SEQUENCE_CAP = 12;
export const SOMATIC_CAP = 4;

export function traits(v = 0): Traits {
  return { mgt: v, hde: v, rfx: v, foc: v, met: v, abr: v };
}

export function addTraits(...all: Partial<Traits>[]): Traits {
  const out = traits(0);
  for (const t of all) for (const k of TRAITS) out[k] += t[k] ?? 0;
  return out;
}

/** A card or stat number: base plus weighted traits, rounded down. Weights are ½, 1 or 2. */
export interface Val {
  b: number;
  w?: Partial<Record<Trait, number>>;
}

export function v(b: number, w?: Partial<Record<Trait, number>>): Val {
  return { b, w };
}

export function evalVal(val: Val, t: Traits): number {
  let s = 0;
  for (const k of TRAITS) s += (val.w?.[k] ?? 0) * t[k];
  return val.b + Math.floor(s);
}

/** "3 + Might 3", for the tap-and-hold breakdown. */
export function explainVal(val: Val, t: Traits): string {
  const parts: string[] = [];
  if (val.b) parts.push(String(val.b));
  for (const k of TRAITS) {
    const w = val.w?.[k];
    if (!w) continue;
    const n = TRAIT_INFO[k].name;
    parts.push(w === 1 ? `${n} ${t[k]}` : w === 0.5 ? `½·${n} ${t[k]}` : `${w}·${n} ${t[k]}`);
  }
  return parts.join(' + ') || '0';
}

/** The trait a number leans on most; tints it on the card. */
export function mainTrait(val: Val): Trait | null {
  let best: Trait | null = null;
  let bw = 0;
  for (const k of TRAITS) {
    const w = val.w?.[k] ?? 0;
    if (w > bw) { bw = w; best = k; }
  }
  return best;
}

// ---- Derived stats ----

export function maxIntegrity(t: Traits): number {
  return 26 + 4 * t.hde + 2 * t.mgt;
}

export function energyPerTurn(t: Traits): number {
  return 3 + (t.foc >= 8 ? 1 : 0) + (t.foc >= 14 ? 1 : 0);
}

export function handSize(t: Traits): number {
  return 5 + (t.rfx >= 9 ? 1 : 0);
}

export function maxOxygen(t: Traits): number {
  return 5 + t.met;
}

export function exploreHandSize(t: Traits): number {
  return 4 + (t.foc >= 10 ? 1 : 0);
}

export function biomassYield(base: number, t: Traits): number {
  return Math.round(base * (1 + t.met / 10));
}

export function eatHeal(base: number, t: Traits): number {
  return base + t.met;
}

/** Integrity lost per hazard step. */
export function hazardDamage(t: Traits): number {
  return t.hde >= 8 ? 0 : t.hde >= 5 ? 1 : 2;
}

/** Codons to raise a Sequence level from `level` to `level + 1`. */
export function sequenceCost(level: number): number {
  return 6 + 3 * level;
}

/** Biomass for the next somatic point at a splice pod. */
export function somaticCost(bought: number): number {
  return 6 + 4 * bought;
}
