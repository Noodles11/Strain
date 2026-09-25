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

/** Enemy groups per ring of the derelict. */
export const DERELICT_PACKS: Record<'safe' | 'wild' | 'deep' | 'lair', string[][]> = {
  safe: [['tick'], ['copy'], ['tick', 'tick']],
  wild: [['copy', 'tick'], ['husk'], ['drone'], ['bloom'], ['drone', 'tick']],
  deep: [['husk', 'drone'], ['copy', 'copy'], ['bloom', 'tick', 'tick'], ['husk', 'bloom'], ['drone', 'drone']],
  lair: [['husk', 'drone'], ['copy', 'bloom']],
};
export const DERELICT_AMBUSH: string[][] = [['tick', 'tick'], ['husk'], ['tick', 'copy']];
export const DERELICT_ELITES: string[][] = [['hollow'], ['choir']];
export const DERELICT_NEST: string[] = ['tick', 'tick'];
export const DERELICT_BOSS: string[] = ['first'];
