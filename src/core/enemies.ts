/**
 * Enemies have a small trait block of their own. Intent numbers are base + trait,
 * and a planet's tier adds to every trait, so one scaling rule covers everything.
 */
export interface Intent {
  label: string;
  attack?: number;
  hits?: number;
  plate?: number;
  strength?: number;
  weak?: number;
  expose?: number;
  /** Enemy id to call in, if there is room. */
  summon?: string;
  /** Strength given to every other living enemy. */
  allyStrength?: number;
  line?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  biomass: number;
  might: number;
  hide: number;
  speed: number;
  will: number;
  pattern: Intent[];
  flavor: string;
  phase2?: { below: number; pattern: Intent[]; line: string };
  rank?: 'elite' | 'boss';
  /** Splits into two half-HP copies on its first death. */
  splits?: boolean;
  /** While plated, this share of every hit comes back at you, through plating. */
  reflect?: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  tick: {
    id: 'tick', name: 'Hull Tick', hp: 11, biomass: 3, might: 2, hide: 0, speed: 5, will: 0,
    flavor: 'It fed on the hull. Now it has found something softer.',
    pattern: [
      { label: 'Frenzy', attack: 2, hits: 2 },
      { label: 'Burrow', plate: 2, attack: 3 },
      { label: 'Bite', attack: 5 },
    ],
  },
  copy: {
    id: 'copy', name: 'Mewling Copy', hp: 20, biomass: 5, might: 3, hide: 0, speed: 3, will: 2,
    flavor: 'A misprint. It has your hands. It wants the rest.',
    pattern: [
      { label: 'Claw', attack: 5 },
      { label: 'Weep', weak: 2, line: '“why did they keep you”' },
      { label: 'Maul', attack: 9 },
    ],
  },
  husk: {
    id: 'husk', name: 'Custodian Husk', hp: 26, biomass: 6, might: 3, hide: 1, speed: 2, will: 2,
    flavor: 'Maintenance drone. It wears a face it found in the vats.',
    pattern: [
      { label: 'Plate & Jab', plate: 2, attack: 4 },
      { label: 'Sweep', attack: 10 },
      { label: 'Diagnose', expose: 2, line: 'SPECIMEN DEFECTIVE. RECYCLING.' },
    ],
  },
  drone: {
    id: 'drone', name: 'Sentry Drone', hp: 18, biomass: 5, might: 2, hide: 0, speed: 6, will: 2,
    flavor: 'It doesn’t see you. It doesn’t need to.',
    pattern: [
      { label: 'Lock On', expose: 1, line: 'TARGET ACQUIRED' },
      { label: 'Volley', attack: 3, hits: 2 },
      { label: 'Overcharge', strength: 2, plate: 1 },
    ],
  },
  bloom: {
    id: 'bloom', name: 'Vat Bloom', hp: 26, biomass: 6, might: 3, hide: 1, speed: 1, will: 2,
    flavor: 'It grew from what the vats couldn’t use. It is still growing.',
    pattern: [
      { label: 'Swell', plate: 2 },
      { label: 'Spores', weak: 2, line: 'the air tastes like copper' },
      { label: 'Thrash', attack: 7 },
    ],
  },
  hollow: {
    id: 'hollow', name: 'Hollow Twin', hp: 46, biomass: 12, might: 4, hide: 1, speed: 5, will: 3, rank: 'elite',
    flavor: 'Printed one batch before you. It learned your moves in the dark.',
    pattern: [
      { label: 'Your Stance', plate: 2, attack: 5 },
      { label: 'Mirror Cut', attack: 3, hits: 2 },
      { label: 'Recall', strength: 2, line: 'i was printed before you. i know your next move.' },
      { label: 'Overhand', attack: 11 },
    ],
  },
  choir: {
    id: 'choir', name: 'The Choir', hp: 64, biomass: 12, might: 3, hide: 1, speed: 3, will: 4, rank: 'elite',
    flavor: 'Every clone that died here. They learned to sing together.',
    pattern: [
      { label: 'Hymn', attack: 7, line: 'WE WERE YOU FIRST' },
      { label: 'Swell', plate: 2, strength: 2, line: 'come home come home come home' },
      { label: 'Crescendo', attack: 5, hits: 2 },
      { label: 'Dirge', weak: 1, expose: 0, line: 'you are the same meat' },
    ],
  },
  first: {
    id: 'first', name: 'The First', hp: 92, biomass: 16, might: 4, hide: 2, speed: 4, will: 4, rank: 'boss',
    flavor: 'The original. Every clone since was a rough draft of this.',
    pattern: [
      { label: 'Recognize', weak: 1, line: 'i remember being you' },
      { label: 'Backhand', attack: 10 },
      { label: 'We Are Legion', strength: 2, plate: 2, line: 'they are all still in here' },
      { label: 'Cascade', attack: 5, hits: 2 },
    ],
    phase2: {
      below: 0.5,
      line: 'THE FIRST opens the vats!',
      pattern: [
        { label: 'Reprint', summon: 'copy', plate: 2, line: 'another one. and another.' },
        { label: 'Backhand', attack: 11 },
        { label: 'Cascade', attack: 6, hits: 2 },
      ],
    },
  },

  // ---- Kessra, the Glass Caves ----
  shardling: {
    id: 'shardling', name: 'Shardling', hp: 12, biomass: 2, might: 2, hide: 0, speed: 6, will: 0, splits: true,
    flavor: 'A splinter that learned to walk. Break it and there are two.',
    pattern: [
      { label: 'Nip', attack: 2 },
      { label: 'Skitter', attack: 4 },
      { label: 'Nip', attack: 3 },
    ],
  },
  crawler: {
    id: 'crawler', name: 'Lattice Crawler', hp: 30, biomass: 6, might: 3, hide: 1, speed: 1, will: 1,
    flavor: 'It grows armour faster than you can cut it. Hit it before it finishes.',
    pattern: [
      { label: 'Harden', plate: 2 },
      { label: 'Grind', plate: 1, attack: 5 },
      { label: 'Crush', attack: 12 },
    ],
  },
  geode: {
    id: 'geode', name: 'Singing Geode', hp: 16, biomass: 5, might: 0, hide: 1, speed: 2, will: 3,
    flavor: 'It never attacks. It sings, and everything near it gets stronger.',
    pattern: [
      { label: 'Hum', allyStrength: 2, line: 'mmmmmmmmmm' },
      { label: 'Shriek', weak: 1, expose: 1 },
      { label: 'Chorus', allyStrength: 2, plate: 1 },
    ],
  },
  refractor: {
    id: 'refractor', name: 'Refractor', hp: 44, biomass: 10, might: 3, hide: 2, speed: 3, will: 2, rank: 'elite', reflect: 0.5,
    flavor: 'A walking mirror. While it is plated, half of every blow comes back to you.',
    pattern: [
      { label: 'Polish', plate: 2 },
      { label: 'Lance', attack: 9 },
      { label: 'Glare', attack: 5, plate: 1 },
    ],
  },
  prism: {
    id: 'prism', name: 'The Prism Mother', hp: 100, biomass: 18, might: 4, hide: 2, speed: 3, will: 4, rank: 'boss',
    flavor: 'The oldest thing in the caves. Every shardling is a piece she let go of.',
    pattern: [
      { label: 'Refract', attack: 5, hits: 2 },
      { label: 'Glare', weak: 1, expose: 0, line: 'I SEE EVERY COPY OF YOU' },
      { label: 'Prism Beam', attack: 13 },
      { label: 'Facet', plate: 3 },
    ],
    phase2: {
      below: 0.5,
      line: 'THEN BREAK. AND BREAK. AND BREAK.',
      pattern: [
        { label: 'Shed', summon: 'shardling', attack: 4 },
        { label: 'Spectrum', attack: 5, hits: 2 },
        { label: 'Shed', summon: 'shardling', plate: 2 },
        { label: 'Prism Beam', attack: 15 },
      ],
    },
  },
};

export interface Tier {
  bonus: number;
  hp: number;
}

export const TIERS: Record<number, Tier> = {
  1: { bonus: 0, hp: 1 },
  2: { bonus: 2, hp: 1.5 },
  3: { bonus: 4, hp: 2.1 },
  4: { bonus: 6, hp: 2.8 },
  5: { bonus: 8, hp: 3.5 },
};

export function tierOf(n: number): Tier {
  return TIERS[Math.max(1, Math.min(5, n))];
}
