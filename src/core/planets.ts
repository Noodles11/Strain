import { DERELICT_EVENTS, KESSRA_EVENTS, MIRETH_EVENTS, type EventDef } from './events';

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
      safe: [['tick'], ['copy'], ['tick', 'tick'], ['subject'], ['drip', 'tick']],
      wild: [['copy', 'tick'], ['husk'], ['drone'], ['bloom'], ['drone', 'tick'], ['drip', 'copy'], ['subject'], ['drip', 'husk']],
      deep: [['husk', 'drone'], ['copy', 'copy'], ['bloom', 'tick', 'tick'], ['husk', 'bloom'], ['drone', 'drone'],
        ['incinerator', 'husk'], ['incinerator', 'drone'], ['sleeper'], ['sleeper', 'drip']],
      lair: [['husk', 'drone'], ['copy', 'bloom'], ['incinerator', 'copy']],
    },
    ambush: [['tick', 'tick'], ['husk'], ['tick', 'copy'], ['sleeper']],
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
    id: 'mireth', name: 'Mireth', pitch: 'The Drowned Forest. Everything here is growing into everything else.',
    packs: {
      safe: [['leech'], ['puffcap', 'leech'], ['croaker'], ['moth']],
      wild: [['croaker', 'leech'], ['hound'], ['moth', 'puffcap'], ['eel'], ['stilt'], ['knot'], ['hound', 'leech'], ['croaker', 'puffcap']],
      deep: [['hound', 'hound'], ['knot', 'croaker'], ['stilt', 'moth'], ['eel', 'puffcap', 'puffcap'], ['knot', 'eel'], ['stilt', 'hound'], ['moth', 'moth', 'leech']],
      lair: [['knot', 'eel'], ['hound', 'hound', 'puffcap'], ['stilt', 'croaker']],
    },
    ambush: [['stilt'], ['leech', 'leech'], ['eel'], ['hound']],
    ambushText: 'Something rises out of the black water!',
    elites: [['stag'], ['queen']],
    nest: ['leech', 'leech'],
    boss: ['titan'],
    bossName: 'The Drowned Titan',
    bossLog: 'mireth-5',
    cards: ['rotneedle', 'symbiote', 'canopycut', 'sapgraft'],
    events: MIRETH_EVENTS,
    dark: 0.35,
    hazard: 0.45,
    hazardText: 'The black water drags at you.',
    twistText: 'Rot festers here: it deals its number at the start of each turn, straight through plating, then drops by 1.',
    reveals: ['orun'],
  },
  orun: {
    id: 'orun', name: 'Orun', pitch: 'The Dead Colony. Signal lost.', locked: true,
    packs: { safe: [], wild: [], deep: [], lair: [] }, ambush: [], ambushText: '', elites: [], nest: [], boss: [], bossName: '',
    cards: [], events: [], dark: 0, hazard: 0, hazardText: '', reveals: [],
  },
};

/** How many landings deep a planet sits on the reveal chain (the Derelict is 1, Kessra 2). */
export function planetDepth(id: string): number {
  let frontier = ['derelict'];
  for (let d = 1; frontier.length && d < 20; d++) {
    if (frontier.includes(id)) return d;
    frontier = frontier.flatMap((f) => PLANETS[f]?.reveals ?? []);
  }
  return 1;
}

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
