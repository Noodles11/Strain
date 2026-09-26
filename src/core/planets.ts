import { DERELICT_EVENTS, KESSRA_EVENTS, type EventDef } from './events';

export type RingPacks = Record<'safe' | 'wild' | 'deep' | 'lair', string[][]>;

/** Everything a planet brings: its mobs, its loot, its twist. */
export interface PlanetDef {
  id: string;
  name: string;
  pitch: string;
  packs: RingPacks;
  ambush: string[][];
  ambushText: string;
  elites: string[][];
  nest: string[];
  boss: string[];
  bossName: string;
  bossLog?: string;
  /** Tactical cards that only drop here. */
  cards: string[];
  events: EventDef[];
  /** Share of wild/deep sections that start dark. */
  dark: number;
  /** Share of sections with hazard patches. */
  hazard: number;
  hazardText: string;
  twist?: 'resonance';
  twistText?: string;
  /** Planets this one's boss reveals on the star chart. */
  reveals: string[];
  /** Not built yet: shown on the chart as a lost signal. */
  locked?: boolean;
}

export const PLANETS: Record<string, PlanetDef> = {
  derelict: {
    id: 'derelict', name: 'The Derelict', pitch: 'The lab ship. Where every print begins.',
    packs: {
      safe: [['tick'], ['copy'], ['tick', 'tick']],
      wild: [['copy', 'tick'], ['husk'], ['drone'], ['bloom'], ['drone', 'tick']],
      deep: [['husk', 'drone'], ['copy', 'copy'], ['bloom', 'tick', 'tick'], ['husk', 'bloom'], ['drone', 'drone']],
      lair: [['husk', 'drone'], ['copy', 'bloom']],
    },
    ambush: [['tick', 'tick'], ['husk'], ['tick', 'copy']],
    ambushText: 'Something drops out of a vent!',
    elites: [['hollow'], ['choir']],
    nest: ['tick', 'tick'],
    boss: ['first'],
    bossName: 'The First',
    bossLog: 'derelict-5',
    cards: [],
    events: DERELICT_EVENTS,
    dark: 0.25,
    hazard: 0.3,
    hazardText: 'The leak burns.',
    reveals: ['kessra'],
  },
  kessra: {
    id: 'kessra', name: 'Kessra', pitch: 'The Glass Caves. A lattice that remembers everything that happens in it.',
    packs: {
      safe: [['shardling'], ['shardling', 'shardling']],
      wild: [['crawler'], ['shardling', 'geode'], ['shardling', 'shardling'], ['crawler', 'shardling']],
      deep: [['crawler', 'geode'], ['shardling', 'shardling', 'geode'], ['crawler', 'crawler'], ['crawler', 'shardling', 'shardling']],
      lair: [['crawler', 'geode'], ['shardling', 'shardling', 'shardling']],
    },
    ambush: [['shardling', 'shardling'], ['crawler'], ['shardling', 'crawler']],
    ambushText: 'The crystal wall breaks open!',
    elites: [['refractor'], ['refractor', 'geode']],
    nest: ['shardling', 'shardling'],
    boss: ['prism'],
    bossName: 'The Prism Mother',
    bossLog: 'kessra-5',
    cards: ['resonant', 'shatter', 'crystalskin', 'splitlens'],
    events: KESSRA_EVENTS,
    dark: 0.45,
    hazard: 0.35,
    hazardText: 'Shard floor cuts.',
    twist: 'resonance',
    twistText: 'Resonance: every third card you play each turn resolves twice.',
    reveals: ['mireth', 'orun'],
  },
  mireth: {
    id: 'mireth', name: 'Mireth', pitch: 'The Drowned Forest. Signal lost.', locked: true,
    packs: { safe: [], wild: [], deep: [], lair: [] }, ambush: [], ambushText: '', elites: [], nest: [], boss: [], bossName: '',
    cards: [], events: [], dark: 0, hazard: 0, hazardText: '', reveals: [],
  },
  orun: {
    id: 'orun', name: 'Orun', pitch: 'The Dead Colony. Signal lost.', locked: true,
    packs: { safe: [], wild: [], deep: [], lair: [] }, ambush: [], ambushText: '', elites: [], nest: [], boss: [], bossName: '',
    cards: [], events: [], dark: 0, hazard: 0, hazardText: '', reveals: [],
  },
};

export function planet(id: string): PlanetDef {
  return PLANETS[id] ?? PLANETS.derelict;
}

export function findEvent(id: string | undefined): EventDef | undefined {
  for (const p of Object.values(PLANETS)) {
    const e = p.events.find((q) => q.id === id);
    if (e) return e;
  }
  return undefined;
}
