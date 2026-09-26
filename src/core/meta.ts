import { SEQUENCE_CAP, SEQUENCE_START, sequenceCost, traits, type Trait, type Traits } from './traits';

/** Everything that survives death. Stored under its own key. */
export interface Meta {
  v: 1;
  codons: number;
  seq: Traits;
  clone: number;
  runs: number;
  wins: number;
  deaths: number;
  /** Codons earned by the last run, shown on the Printer. */
  lastEarned: number;
  lastOutcome: 'none' | 'dead' | 'won';
  totalCodons: number;
  /** Log fragments found across all runs. */
  logs: string[];
  /** Planets revealed on the star chart. */
  planets: string[];
}

export const META_KEY = 'strain.meta';
export const RUN_KEY = 'strain.run';

export function newMeta(): Meta {
  return {
    v: 1, codons: 0, seq: traits(SEQUENCE_START), clone: 1, runs: 0, wins: 0, deaths: 0,
    lastEarned: 0, lastOutcome: 'none', totalCodons: 0, logs: [], planets: ['derelict'],
  };
}

export function canRaise(m: Meta, t: Trait): boolean {
  return m.seq[t] < SEQUENCE_CAP && m.codons >= sequenceCost(m.seq[t]);
}

export function raise(m: Meta, t: Trait): boolean {
  if (!canRaise(m, t)) return false;
  m.codons -= sequenceCost(m.seq[t]);
  m.seq[t] += 1;
  return true;
}

/** Bank a finished run's Codons. */
export function settleRun(m: Meta, earned: number, outcome: 'dead' | 'won', logs: string[] = [], planets: string[] = []) {
  for (const p of planets) if (!m.planets.includes(p)) m.planets.push(p);
  for (const l of logs) if (!m.logs.includes(l)) m.logs.push(l);
  m.codons += earned;
  m.totalCodons += earned;
  m.lastEarned = earned;
  m.lastOutcome = outcome;
  m.runs += 1;
  m.clone += 1;
  if (outcome === 'won') m.wins += 1;
  else m.deaths += 1;
}

export function loadMeta(store: Storage | null): Meta {
  try {
    const raw = store?.getItem(META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Meta;
      if (m.v === 1) return { ...newMeta(), ...m };
    }
  } catch {
    // fall through to a fresh save
  }
  return newMeta();
}

export function saveMeta(store: Storage | null, m: Meta) {
  try {
    store?.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // storage full or blocked: play on without saving
  }
}
