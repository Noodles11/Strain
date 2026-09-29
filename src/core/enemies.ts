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
  /** Heal the most hurt other enemy by this much (plus Will). */
  healAlly?: number;
  /** Rot put on you (plus Will ÷ 4). */
  rot?: number;
  /** Heals itself for the HP its blows take. */
  drain?: boolean;
  /** Straight through plating. */
  pierce?: boolean;
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
  /** Pattern used when it is the last one standing. */
  soloPattern?: Intent[];
  /** Leaves the fight after this many of its own turns: no corpse, no loot. */
  fleesAfter?: number;
  /** Starts asleep behind plating; wakes below a share of HP or after some rounds. */
  sleeps?: { plate: number; wakeBelow: number; wakeAfter: number };
  /** Heats up each of its turns; at `at` it explodes for `blast`, ignoring plating, and is gone. */
  countdown?: { at: number; blast: number };
  /** Extra Codons for killing it. */
  bonusCodons?: number;
  /** Bursts when it dies: this much Rot on you. */
  deathRot?: number;
  /** Heals this much at the start of each of its turns. */
  regen?: number;
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

  // ---- Lab additions ----
  drip: {
    id: 'drip', name: 'Drip Stand', hp: 12, biomass: 3, might: 1, hide: 0, speed: 2, will: 1,
    flavor: 'An IV stand that learned to walk on its own tubing. It keeps the others topped up.',
    pattern: [
      { label: 'Transfuse', healAlly: 5 },
      { label: 'Needle', attack: 3 },
      { label: 'Transfuse', healAlly: 5 },
    ],
    soloPattern: [{ label: 'Needle', attack: 3 }],
  },
  subject: {
    id: 'subject', name: 'Test Subject', hp: 10, biomass: 8, might: 1, hide: 0, speed: 8, will: 0, fleesAfter: 2, bonusCodons: 2,
    flavor: 'Half-printed, still wearing its collar. It does not want to be here either.',
    pattern: [
      { label: 'Snap', attack: 2 },
      { label: 'Scramble', attack: 2 },
    ],
  },
  sleeper: {
    id: 'sleeper', name: 'Cryo Sleeper', hp: 34, biomass: 8, might: 4, hide: 1, speed: 2, will: 2,
    sleeps: { plate: 3, wakeBelow: 0.5, wakeAfter: 3 },
    flavor: 'Frozen mid-print. Whatever is inside has been dreaming about you.',
    pattern: [
      { label: 'Thaw', plate: 3, strength: 2, line: 'the ice runs off it in sheets' },
      { label: 'Crush', attack: 12 },
    ],
  },
  incinerator: {
    id: 'incinerator', name: 'Incinerator Unit', hp: 28, biomass: 6, might: 4, hide: 1, speed: 3, will: 1,
    countdown: { at: 4, blast: 20 },
    flavor: 'Waste disposal on treads. It is disposing of itself, and you are in the way.',
    pattern: [
      { label: 'Vent', attack: 2 },
      { label: 'Stoke', plate: 1 },
    ],
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

  // ---- Mireth, the Drowned Forest ----
  leech: {
    id: 'leech', name: 'Leech Swarm', hp: 10, biomass: 4, might: 1, hide: 0, speed: 6, will: 0,
    flavor: 'A knot of black leeches that moves as one. Every bite makes it fatter.',
    pattern: [
      { label: 'Latch', attack: 2, hits: 2, drain: true },
      { label: 'Swell', attack: 3, drain: true },
    ],
  },
  croaker: {
    id: 'croaker', name: 'Bog Croaker', hp: 16, biomass: 5, might: 2, hide: 0, speed: 3, will: 2,
    flavor: 'A toad the size of a dog, full of something green. It spits it.',
    pattern: [
      { label: 'Spit', rot: 2 },
      { label: 'Tongue', attack: 5 },
      { label: 'Bloat', plate: 2, rot: 1 },
    ],
  },
  puffcap: {
    id: 'puffcap', name: 'Puffcap', hp: 8, biomass: 3, might: 0, hide: 0, speed: 1, will: 2, deathRot: 3,
    flavor: 'A walking mushroom, swollen with spores. Killing it is the dangerous part.',
    pattern: [
      { label: 'Swell', plate: 1 },
      { label: 'Spore', rot: 1, weak: 1 },
    ],
  },
  moth: {
    id: 'moth', name: 'Gravemoth', hp: 14, biomass: 4, might: 2, hide: 0, speed: 7, will: 3,
    flavor: 'Wings like wet paper. Its dust makes wounds go bad.',
    pattern: [
      { label: 'Dust', weak: 1, rot: 1 },
      { label: 'Flutter', attack: 3, hits: 3 },
    ],
  },
  hound: {
    id: 'hound', name: 'Moss Hound', hp: 22, biomass: 6, might: 3, hide: 0, speed: 5, will: 1,
    flavor: 'Moss grows where its fur fell out. It hunts in pairs and it does not tire.',
    pattern: [
      { label: 'Snap', attack: 5 },
      { label: 'Worry', attack: 3, hits: 2, rot: 1 },
      { label: 'Howl', strength: 2, line: 'something answers it, far off' },
    ],
  },
  eel: {
    id: 'eel', name: 'Lantern Eel', hp: 20, biomass: 6, might: 3, hide: 0, speed: 6, will: 3,
    flavor: 'It rises out of the black water glowing. Its shock goes straight through armour.',
    pattern: [
      { label: 'Glow', plate: 1, strength: 1 },
      { label: 'Shock', attack: 6, pierce: true },
    ],
  },
  stilt: {
    id: 'stilt', name: 'Stiltwader', hp: 30, biomass: 8, might: 4, hide: 0, speed: 5, will: 1,
    flavor: 'Three metres of leg and beak, standing so still in the water you walk right up to it.',
    pattern: [
      { label: 'Wade', plate: 2 },
      { label: 'Spear', attack: 11 },
      { label: 'Peck', attack: 4, hits: 2 },
    ],
  },
  knot: {
    id: 'knot', name: 'Root Knot', hp: 36, biomass: 7, might: 2, hide: 2, speed: 1, will: 2,
    flavor: 'A tangle of mangrove roots that decided to move. It holds you while it thinks.',
    pattern: [
      { label: 'Entangle', weak: 1, expose: 1 },
      { label: 'Grow', plate: 4 },
      { label: 'Lash', attack: 8 },
    ],
  },
  stag: {
    id: 'stag', name: 'Mossback Stag', hp: 60, biomass: 14, might: 4, hide: 2, speed: 4, will: 3, rank: 'elite', regen: 4,
    flavor: 'A forest on four legs. Whatever you cut off it grows back by morning.',
    pattern: [
      { label: 'Graze', plate: 3 },
      { label: 'Gore', attack: 13 },
      { label: 'Trample', attack: 6, hits: 2 },
      { label: 'Bellow', weak: 1, strength: 2, line: 'the trees shake with it' },
    ],
  },
  queen: {
    id: 'queen', name: 'Leech Mother', hp: 52, biomass: 14, might: 3, hide: 1, speed: 3, will: 4, rank: 'elite',
    flavor: 'Bloated, patient, pale. Everything that bites you in the water came out of her.',
    pattern: [
      { label: 'Brood', summon: 'leech', plate: 2 },
      { label: 'Engorge', attack: 8, drain: true },
      { label: 'Bloodrain', attack: 4, hits: 2, rot: 1 },
    ],
  },
  titan: {
    id: 'titan', name: 'The Drowned Titan', hp: 120, biomass: 22, might: 5, hide: 2, speed: 2, will: 4, rank: 'boss', regen: 3,
    flavor: 'A seed-probe crew member, grown into the forest for a hundred years. The forest grew into it too.',
    pattern: [
      { label: 'Surge', attack: 7, hits: 2 },
      { label: 'Silt', rot: 3, weak: 1, line: 'THE WATER REMEMBERS YOU' },
      { label: 'Undertow', attack: 16 },
      { label: 'Rootbed', plate: 5 },
    ],
    phase2: {
      below: 0.5,
      line: 'STAY. STAY WITH US. GROW.',
      pattern: [
        { label: 'Seed', summon: 'puffcap', plate: 3 },
        { label: 'Drown', attack: 12, rot: 2 },
        { label: 'Grasp', attack: 7, hits: 2, drain: true },
        { label: 'Bloom', rot: 3, allyStrength: 2 },
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

/**
 * Veterans: every kind of mob toughens as clones kill more of it, over all runs.
 * The curve is slow and levels off: +15% HP after 20 kills, +30% after 60, never past +60%;
 * +1 attack from 40 kills, +2 from 160.
 */
export function veteran(slain: number): { hp: number; atk: number } {
  const n = Math.max(0, slain);
  return { hp: 1 + (0.6 * n) / (n + 60), atk: Math.floor((3 * n) / (n + 80) + 1e-9) };
}

/** Individual variation: most mobs are near the norm, some are faint, some hulking. */
export type FoeForm = 'faint' | 'hulking';

export function rollForm(roll: number, spread: number, elite: boolean): { mul: number; form?: FoeForm } {
  if (elite) return { mul: 0.9 + spread * 0.2 };
  if (roll < 0.15) return { mul: 0.6 + spread * 0.15, form: 'faint' };
  if (roll > 0.85) return { mul: 1.25 + spread * 0.2, form: 'hulking' };
  return { mul: 0.9 + spread * 0.2 };
}

export function tierOf(n: number): Tier {
  return TIERS[Math.max(1, Math.min(5, n))];
}
