import { evalVal, explainVal, mainTrait, TRAITS, v, type Trait, type Traits, type Val } from './traits';

export type DeckKind = 'tac' | 'exp';
export type Keyword = 'consume' | 'hold' | 'tool' | 'fleeting';

/** Battle-side card effects. Numbers are trait formulas until resolved. */
export type Effect<N = Val> =
  | { op: 'dmg'; v: N; hits?: N; aoe?: boolean }
  | { op: 'plate'; v: N; keep?: boolean }
  | { op: 'heal'; v: N }
  | { op: 'draw'; v: N }
  | { op: 'energy'; v: N }
  | { op: 'weak'; v: N }
  | { op: 'expose'; v: N }
  | { op: 'tag'; v: N }
  | { op: 'triage'; v: N }
  | { op: 'empower'; v: N }
  | { op: 'healPerTagged'; v: N }
  | { op: 'drain'; v: N } // percent of damage this card dealt, healed
  | { op: 'surge'; v: N } // +v to a random trait this fight; unstable
  | { op: 'shatter'; v: N } // deal target plating × v, then strip it
  | { op: 'rot'; v: N; aoe?: boolean } // Rot: v damage at the start of its turn, then v−1
  | { op: 'healPerRot'; v: N } // heal v for each point of Rot on enemies
  | { op: 'donor' }
  | { op: 'cannibal' };

/** What an exploration card does in the open world. */
export type ExploreAct = 'override' | 'cut' | 'scan' | 'pry' | 'heal' | 'flare' | 'notes' | 'beacon' | 'stalk' | 'seal';

/** Growth inside one fight, tracked by the battle. */
export type Dyn = 'feeding' | 'sibling' | 'callus' | 'unscarred' | 'grief' | 'scartissue' | 'resonant' | 'splitlens';

export interface Threshold {
  t: Trait;
  at: number;
  text: string;
  apply: (r: ResolvedCard) => void;
}

export interface CardDef {
  id: string;
  name: string;
  deck: DeckKind;
  cost: number;
  glyph: string;
  flavor: string;
  fx?: Effect[];
  act?: ExploreAct;
  /** Exploration power: gate rating it opens, scan radius, heal, steps. */
  power?: Val;
  keywords?: Keyword[];
  bioCost?: number;
  dyn?: Dyn;
  /** Extra rule text the formulas can't express. */
  rule?: string;
  th?: Threshold[];
  medic?: boolean;
}

export interface ResolvedCard {
  def: CardDef;
  cost: number;
  fx: Effect<number>[];
  power: number;
  bioCost: number;
  keywords: Keyword[];
  /** Thresholds that are met. */
  met: boolean[];
}

const tagFx = (n: number): Effect => ({ op: 'tag', v: v(n) });

export const CARDS: Record<string, CardDef> = {
  // ---- Tactical ----
  scalpel: {
    id: 'scalpel', name: 'Scalpel', deck: 'tac', cost: 1, glyph: '╱',
    fx: [{ op: 'dmg', v: v(3, { mgt: 1 }) }],
    th: [{ t: 'mgt', at: 9, text: 'Expose 1', apply: (r) => r.fx.push({ op: 'expose', v: 1 }) }],
    flavor: 'Standard issue. Still warm from the printer.',
  },
  brace: {
    id: 'brace', name: 'Brace', deck: 'tac', cost: 1, glyph: '▢',
    fx: [{ op: 'plate', v: v(2, { hde: 1 }) }],
    th: [{ t: 'hde', at: 8, text: 'Plating stays 1 extra turn', apply: (r) => { const p = r.fx.find((e) => e.op === 'plate'); if (p && p.op === 'plate') p.keep = true; } }],
    flavor: 'Lock the joints. Let the body take it.',
  },
  harpoon: {
    id: 'harpoon', name: 'Harpoon', deck: 'tac', cost: 1, glyph: '↣',
    fx: [{ op: 'dmg', v: v(1, { mgt: 1 }) }, tagFx(1)],
    th: [{ t: 'rfx', at: 7, text: 'Tag 2', apply: (r) => setNum(r, 'tag', 2) }],
    flavor: 'Hooked meat keeps. Tagged prey yields double biomass.',
  },
  flense: {
    id: 'flense', name: 'Flense', deck: 'tac', cost: 2, glyph: '≋',
    fx: [{ op: 'dmg', v: v(2, { mgt: 2 }) }, { op: 'expose', v: v(1, { foc: 0.5 }) }],
    flavor: 'Peel it open. Let the cold in.',
  },
  scatter: {
    id: 'scatter', name: 'Scatter Rounds', deck: 'tac', cost: 1, glyph: '⁂',
    fx: [{ op: 'dmg', v: v(1, { rfx: 1 }), aoe: true }],
    th: [{ t: 'rfx', at: 10, text: 'Hits twice', apply: (r) => setHits(r, 2) }],
    flavor: 'Rusted flechettes. They find everything.',
  },
  spike: {
    id: 'spike', name: 'Neural Spike', deck: 'tac', cost: 1, glyph: '⌇',
    fx: [{ op: 'dmg', v: v(0, { foc: 1 }) }, { op: 'weak', v: v(1, { foc: 0.5 }) }],
    th: [{ t: 'foc', at: 9, text: 'Costs 0', apply: (r) => { r.cost = 0; } }],
    flavor: 'It forgets how to hurt you.',
  },
  bonesaw: {
    id: 'bonesaw', name: 'Bonesaw', deck: 'tac', cost: 2, glyph: '⋀',
    fx: [{ op: 'dmg', v: v(2, { mgt: 1 }), hits: v(2) }],
    th: [{ t: 'rfx', at: 8, text: '3 hits', apply: (r) => setHits(r, 3) }],
    flavor: 'The teeth are someone else’s.',
  },
  adrenal: {
    id: 'adrenal', name: 'Adrenal Leak', deck: 'tac', cost: 0, glyph: '✚',
    fx: [{ op: 'energy', v: v(1) }, { op: 'draw', v: v(1) }],
    th: [{ t: 'met', at: 8, text: 'Draw 2', apply: (r) => setNum(r, 'draw', 2) }],
    flavor: 'A gland you weren’t printed with.',
  },
  echo: {
    id: 'echo', name: 'Cold Echo', deck: 'tac', cost: 1, glyph: '◌',
    fx: [{ op: 'draw', v: v(2) }, { op: 'plate', v: v(0, { hde: 1 }) }],
    th: [{ t: 'foc', at: 10, text: 'Draw 3', apply: (r) => setNum(r, 'draw', 3) }],
    flavor: 'Something answers from the walls. It sounds like you.',
  },
  hook: {
    id: 'hook', name: 'Salvage Hook', deck: 'tac', cost: 1, glyph: '⌐',
    fx: [{ op: 'dmg', v: v(2, { mgt: 1 }) }, tagFx(1), { op: 'plate', v: v(2) }],
    flavor: 'Pull it close. Pull it apart.',
  },
  graft: {
    id: 'graft', name: 'Graft', deck: 'tac', cost: 1, glyph: '✣',
    fx: [{ op: 'dmg', v: v(1, { mgt: 1 }) }, { op: 'heal', v: v(-1, { met: 1 }) }],
    flavor: 'Take a piece. Keep it.',
  },
  jack: {
    id: 'jack', name: 'Overclock Jack', deck: 'tac', cost: 1, glyph: '⟴',
    fx: [{ op: 'dmg', v: v(1, { rfx: 1 }) }, { op: 'empower', v: v(-1, { foc: 1 }) }],
    flavor: 'Jack in. Push the next one harder.',
  },
  siphon: {
    id: 'siphon', name: 'Siphon Blade', deck: 'tac', cost: 2, glyph: '⟠',
    fx: [{ op: 'dmg', v: v(3, { mgt: 2 }) }, { op: 'drain', v: v(50) }],
    th: [{ t: 'abr', at: 7, text: 'Heal all of it', apply: (r) => setNum(r, 'drain', 100) }],
    flavor: 'It drinks. You feel it swallow.',
  },
  triage: {
    id: 'triage', name: 'Triage Tag', deck: 'tac', cost: 1, glyph: '⌖',
    fx: [{ op: 'dmg', v: v(0, { foc: 1 }) }, tagFx(1), { op: 'triage', v: v(1) }],
    rule: 'Triage: tagged enemies that die this fight print a fleeting Clot Patch.',
    flavor: 'Mark it. Its death will mend you.',
  },
  needle: {
    id: 'needle', name: 'Harvest Needle', deck: 'tac', cost: 1, glyph: '⟟',
    fx: [{ op: 'dmg', v: v(0, { foc: 1 }) }, tagFx(1), { op: 'healPerTagged', v: v(1) }],
    th: [{ t: 'met', at: 8, text: 'Heal 2 per tagged enemy', apply: (r) => setNum(r, 'healPerTagged', 2) }],
    flavor: 'Draw from what you have marked.',
  },
  unscarred: {
    id: 'unscarred', name: 'Unscarred Edge', deck: 'tac', cost: 1, glyph: '⟋', dyn: 'unscarred',
    fx: [{ op: 'dmg', v: v(1, { rfx: 1 }) }],
    rule: '+2 damage per round held without a hit. A hit wipes it.',
    flavor: 'Clean. For now.',
  },
  scartissue: {
    id: 'scartissue', name: 'Scar Tissue', deck: 'tac', cost: 1, glyph: '≈', dyn: 'scartissue',
    fx: [{ op: 'plate', v: v(0, { hde: 1 }) }],
    rule: 'While in hand: each time you lose integrity, +1 Might this fight.',
    flavor: 'Every wound, a lesson.',
  },
  feeding: {
    id: 'feeding', name: 'Feeding Blade', deck: 'tac', cost: 1, glyph: '⟆', dyn: 'feeding',
    fx: [{ op: 'dmg', v: v(2, { mgt: 1 }) }],
    rule: 'Each kill this fight: + Aberrance damage.',
    flavor: 'It gets hungrier the more it eats.',
  },
  callus: {
    id: 'callus', name: 'Callus', deck: 'tac', cost: 1, glyph: '▣', dyn: 'callus',
    fx: [{ op: 'plate', v: v(1, { hde: 1 }) }],
    rule: 'Each hit your plating fully stops this fight: +1.',
    flavor: 'Skin remembers pressure.',
  },
  donor: {
    id: 'donor', name: 'Donor Cell', deck: 'tac', cost: 0, glyph: '⊕', keywords: ['consume'],
    fx: [{ op: 'donor' }],
    rule: 'Choose a card in hand. This fight it uses your highest trait for every number.',
    flavor: 'Give it the best of you.',
  },
  sibling: {
    id: 'sibling', name: 'Sibling Print', deck: 'tac', cost: 1, glyph: '⧉', dyn: 'sibling',
    fx: [{ op: 'dmg', v: v(1, { mgt: 1 }) }],
    rule: '+2 for each other Sibling Print played this fight.',
    flavor: 'Two of you. Three. More.',
  },
  cannibal: {
    id: 'cannibal', name: 'Cannibal Print', deck: 'tac', cost: 1, glyph: '⊘',
    fx: [{ op: 'cannibal' }, { op: 'dmg', v: v(0, { mgt: 1 }) }],
    rule: 'Consume a card in hand. Gain its cost as energy.',
    flavor: 'Eat the weaker print.',
  },
  flask: {
    id: 'flask', name: 'Mutagen Flask', deck: 'tac', cost: 1, glyph: '⚗', keywords: ['consume'],
    fx: [{ op: 'surge', v: v(2) }],
    rule: 'Unstable: +2 to a random trait this fight. One time in three, −1 instead.',
    th: [{ t: 'abr', at: 8, text: 'Never fails', apply: (r) => { r.power = 1; } }],
    flavor: 'Drink. Find out.',
  },
  hunger: {
    id: 'hunger', name: 'Hunger Clock', deck: 'tac', cost: 2, glyph: '◷',
    fx: [{ op: 'dmg', v: v(5, { mgt: 2 }) }],
    flavor: 'Tick. Tick. Feed.',
  },
  grief: {
    id: 'grief', name: 'Grief Engine', deck: 'tac', cost: 1, glyph: '⊗', dyn: 'grief',
    fx: [{ op: 'plate', v: v(0, { hde: 1 }) }, { op: 'draw', v: v(1) }],
    rule: '+1 plating for every card Consumed this run.',
    flavor: 'It runs on what you lost.',
  },
  clot: {
    id: 'clot', name: 'Clot Patch', deck: 'tac', cost: 0, glyph: '✚', keywords: ['consume'], medic: true,
    fx: [{ op: 'heal', v: v(-1, { met: 1 }) }],
    flavor: 'Press. Hold. Pray.',
  },
  poultice: {
    id: 'poultice', name: 'Biomass Poultice', deck: 'tac', cost: 0, glyph: '✚', keywords: ['consume'], medic: true, bioCost: 2,
    fx: [{ op: 'heal', v: v(1, { met: 1 }) }],
    flavor: 'Warm paste. Don’t ask what it was.',
  },
  knit: {
    id: 'knit', name: 'Marrow Knit', deck: 'tac', cost: 0, glyph: '✚', keywords: ['consume'], medic: true, bioCost: 4,
    fx: [{ op: 'heal', v: v(4, { met: 1 }) }],
    flavor: 'Bone threads into bone.',
  },

  // ---- Kessra ----
  resonant: {
    id: 'resonant', name: 'Resonant Strike', deck: 'tac', cost: 1, glyph: '≀', dyn: 'resonant',
    fx: [{ op: 'dmg', v: v(2, { mgt: 1 }) }],
    rule: 'If the last card you played was an attack, it strikes twice.',
    flavor: 'The glass remembers the last blow and repeats it.',
  },
  shatter: {
    id: 'shatter', name: 'Shatter', deck: 'tac', cost: 2, glyph: '✧',
    fx: [{ op: 'shatter', v: v(2) }, { op: 'dmg', v: v(2) }],
    th: [{ t: 'mgt', at: 8, text: 'Plating ×3', apply: (r) => setNum(r, 'shatter', 3) }],
    flavor: 'Armour is just glass that hasn’t broken yet.',
  },
  crystalskin: {
    id: 'crystalskin', name: 'Crystal Skin', deck: 'tac', cost: 1, glyph: '◇',
    fx: [{ op: 'plate', v: v(3, { hde: 1 }), keep: true }],
    rule: 'This plating doesn’t fade next turn.',
    flavor: 'It grows over you in a night.',
  },
  // ---- Mireth ----
  rotneedle: {
    id: 'rotneedle', name: 'Rot Needle', deck: 'tac', cost: 1, glyph: '⸙',
    fx: [{ op: 'rot', v: v(1, { abr: 1 }) }],
    th: [{ t: 'abr', at: 9, text: 'Weak 1', apply: (r) => r.fx.push({ op: 'weak', v: 1 }) }],
    flavor: 'A thorn off the drowned trees. What it pricks goes soft.',
  },
  symbiote: {
    id: 'symbiote', name: 'Symbiote', deck: 'tac', cost: 1, glyph: '❦',
    fx: [{ op: 'healPerRot', v: v(1) }],
    th: [{ t: 'met', at: 8, text: 'Heal 2 per Rot', apply: (r) => setNum(r, 'healPerRot', 2) }],
    flavor: 'It lives on what is dying near you. So do you, now.',
  },
  canopycut: {
    id: 'canopycut', name: 'Canopy Cut', deck: 'tac', cost: 2, glyph: '⟆',
    fx: [{ op: 'dmg', v: v(2, { mgt: 1 }), aoe: true }, { op: 'rot', v: v(0, { abr: 0.5 }), aoe: true }],
    flavor: 'A wide stroke through wet wood. Everything it touches starts to turn.',
  },
  sapgraft: {
    id: 'sapgraft', name: 'Sap Graft', deck: 'tac', cost: 0, glyph: '⚘',
    fx: [{ op: 'dmg', v: v(0, { abr: 1 }) }, { op: 'drain', v: v(100) }],
    flavor: 'Tap them like a tree.',
  },
  splitlens: {
    id: 'splitlens', name: 'Split Lens', deck: 'tac', cost: 1, glyph: '⟁', dyn: 'splitlens',
    fx: [{ op: 'dmg', v: v(0, { rfx: 1 }), aoe: true }],
    rule: 'Against 2 or more enemies, hits twice.',
    flavor: 'One beam in. Many out.',
  },

  // ---- Exploration ----
  override: {
    id: 'override', name: 'Override', deck: 'exp', cost: 1, glyph: '⌬', act: 'override', power: v(0, { foc: 0.5 }),
    rule: 'Open an adjacent sealed door up to this rating.',
    flavor: 'The ship still thinks you are crew.',
  },
  cutter: {
    id: 'cutter', name: 'Plasma Cutter', deck: 'exp', cost: 1, glyph: '⟋', act: 'cut', power: v(0, { mgt: 0.5 }), keywords: ['tool'],
    rule: 'Clear adjacent debris up to this rating. Stays in hand.',
    flavor: 'Hot enough to cut hull. Or bone.',
  },
  scan: {
    id: 'scan', name: 'Echo Scan', deck: 'exp', cost: 1, glyph: '◎', act: 'scan', power: v(2, { foc: 0.5 }),
    rule: 'Reveal the map, caches and hidden things in this radius.',
    flavor: 'Ping. Listen. Count the echoes.',
  },
  pry: {
    id: 'pry', name: 'Pry Bar', deck: 'exp', cost: 1, glyph: '⌙', act: 'pry', power: v(0),
    rule: 'Open an adjacent cache.',
    th: [{ t: 'mgt', at: 6, text: '+1 item', apply: (r) => { r.power = 1; } }],
    flavor: 'Older than the ship. Still works.',
  },
  suture: {
    id: 'suture', name: 'Suture Gel', deck: 'exp', cost: 2, glyph: '✚', act: 'heal', power: v(3, { met: 1 }),
    rule: 'Heal this much.',
    flavor: 'Seals anything. Mostly.',
  },
  flare: {
    id: 'flare', name: 'Flare', deck: 'exp', cost: 1, glyph: '✶', act: 'flare', power: v(1, { foc: 0.5 }),
    rule: 'Light this zone. Reveals ambushes. Mobs you touch here start Exposed this much.',
    flavor: 'Red light. Everything turns to look.',
  },
  notes: {
    id: 'notes', name: 'Field Notes', deck: 'exp', cost: 1, glyph: '✎', act: 'notes', power: v(3),
    rule: 'Reveal hidden things in this radius. +1 Codon for each.',
    flavor: 'Write it down. Someone will need it.',
  },
  beacon: {
    id: 'beacon', name: 'Beacon', deck: 'exp', cost: 1, glyph: '◈', act: 'beacon', power: v(0),
    rule: 'Plant a beacon here. Fast travel to it. Refills oxygen once.',
    flavor: 'A light that says: I was here.',
  },
  stalk: {
    id: 'stalk', name: 'Stalk', deck: 'exp', cost: 1, glyph: '◭', act: 'stalk', power: v(0),
    rule: 'The next mob you touch: you strike first, even an ambusher.',
    flavor: 'Low. Slow. Downwind.',
  },
  seal: {
    id: 'seal', name: 'Hazard Seal', deck: 'exp', cost: 1, glyph: '⬡', act: 'seal', power: v(6, { hde: 1 }),
    rule: 'Walk hazard tiles unharmed for this many steps.',
    flavor: 'Foam and polymer. Breathe shallow.',
  },
  dressing: {
    id: 'dressing', name: 'Field Dressing', deck: 'exp', cost: 0, glyph: '✚', act: 'heal', power: v(-1, { met: 1 }), keywords: ['consume'], medic: true,
    rule: 'Heal this much.',
    flavor: 'Clean-ish.',
  },
  knitter: {
    id: 'knitter', name: 'Flesh Knitter', deck: 'exp', cost: 0, glyph: '✚', act: 'heal', power: v(3, { met: 1 }), keywords: ['consume'], medic: true, bioCost: 3,
    rule: 'Heal this much.',
    flavor: 'It hums while it sews.',
  },
};

export const STARTER_TAC = ['scalpel', 'scalpel', 'scalpel', 'scalpel', 'brace', 'brace', 'harpoon', 'flense'];
export const STARTER_EXP = ['override', 'override', 'cutter', 'cutter', 'scan', 'pry', 'suture'];

export const REWARD_TAC = [
  'scatter', 'spike', 'bonesaw', 'adrenal', 'echo', 'hook', 'flense', 'harpoon', 'graft', 'jack', 'siphon',
  'triage', 'needle', 'unscarred', 'scartissue', 'feeding', 'callus', 'donor', 'sibling', 'cannibal', 'flask',
  'hunger', 'grief', 'clot', 'clot', 'poultice', 'knit', 'brace',
];
export const REWARD_EXP = ['flare', 'scan', 'suture', 'pry', 'override', 'cutter', 'beacon', 'notes', 'stalk', 'seal', 'dressing', 'dressing', 'knitter'];

/** The traits a card's numbers read from, most important first. */
export function cardTraits(def: CardDef): Trait[] {
  const w: Record<string, number> = {};
  const add = (val?: Val) => { for (const k of TRAITS) w[k] = (w[k] ?? 0) + (val?.w?.[k] ?? 0); };
  for (const e of def.fx ?? []) {
    if ('v' in e) add(e.v);
    if (e.op === 'dmg') add(e.hits);
  }
  add(def.power);
  for (const t of def.th ?? []) w[t.t] = (w[t.t] ?? 0) + 0.1;
  return TRAITS.filter((k) => (w[k] ?? 0) > 0).sort((a, b) => w[b] - w[a]);
}

export function primaryTrait(def: CardDef): Trait | null {
  return cardTraits(def)[0] ?? null;
}

/** Everything a card will do, with trait numbers filled in. */
export function resolveCard(def: CardDef, t: Traits, donor = false): ResolvedCard {
  const tt = donor ? highestAll(t) : t;
  const fx: Effect<number>[] = (def.fx ?? []).map((e) => {
    switch (e.op) {
      case 'donor':
      case 'cannibal':
        return { op: e.op };
      case 'dmg':
        return { op: 'dmg', v: Math.max(0, evalVal(e.v, tt)), hits: e.hits ? evalVal(e.hits, tt) : 1, aoe: e.aoe };
      case 'plate':
        return { op: 'plate', v: Math.max(0, evalVal(e.v, tt)), keep: e.keep };
      case 'rot':
        return { op: 'rot', v: Math.max(0, evalVal(e.v, tt)), aoe: e.aoe };
      default:
        return { op: e.op, v: Math.max(0, evalVal(e.v, tt)) } as Effect<number>;
    }
  });
  const r: ResolvedCard = {
    def,
    cost: def.cost,
    fx,
    power: def.power ? Math.max(0, evalVal(def.power, tt)) : 0,
    bioCost: def.bioCost ?? 0,
    keywords: [...(def.keywords ?? [])],
    met: [],
  };
  for (const th of def.th ?? []) {
    const ok = tt[th.t] >= th.at;
    r.met.push(ok);
    if (ok) th.apply(r);
  }
  return r;
}

function highestAll(t: Traits): Traits {
  const m = Math.max(...TRAITS.map((k) => t[k]));
  return { mgt: m, hde: m, rfx: m, foc: m, met: m, abr: m };
}

function setNum(r: ResolvedCard, op: string, n: number) {
  const e = r.fx.find((x) => x.op === op) as { v: number } | undefined;
  if (e) e.v = n;
}

function setHits(r: ResolvedCard, n: number) {
  const e = r.fx.find((x) => x.op === 'dmg');
  if (e && e.op === 'dmg') e.hits = n;
}

// ---- Card text ----

/** A piece of card text. Numbers carry the trait that drives them and how they were made. */
/** Icons that stand in for effect words on the card face. */
export type IconId =
  | 'dmg' | 'all' | 'plate' | 'heal' | 'draw' | 'energy' | 'weak' | 'expose' | 'tag' | 'triage' | 'empower'
  | 'drain' | 'surge' | 'shatter' | 'rot' | 'bio' | 'key' | 'cut' | 'scan' | 'flare' | 'notes' | 'seal' | 'pry' | 'beacon' | 'stalk';

/**
 * A piece of card text. Numbers carry the trait that drives them and how they were made.
 * A segment with an icon is shown as that icon on the card face (plus `short`, if any);
 * the long-press view shows the icon and the words.
 */
export interface TextSeg {
  s: string;
  trait?: Trait;
  why?: string;
  icon?: IconId;
  short?: string;
}

/** Card text lines, with final numbers. `extra` adds fight bonuses to damage or plating. */
export function cardText(def: CardDef, t: Traits, opts: { donor?: boolean; dmgBonus?: number; plateBonus?: number } = {}): TextSeg[][] {
  const tt = opts.donor ? highestAll(t) : t;
  const r = resolveCard(def, t, opts.donor);
  const lines: TextSeg[][] = [];
  const num = (n: number, val?: Val): TextSeg => ({
    s: String(n),
    trait: val ? mainTrait(val) ?? undefined : undefined,
    why: val && val.w ? explainVal(val, tt) : undefined,
  });
  const ic = (icon: IconId, s: string, short?: string): TextSeg => ({ s, icon, short });
  const src = def.fx ?? [];
  r.fx.forEach((e, i) => {
    const orig = src[i];
    const val = orig && 'v' in orig ? orig.v : undefined;
    switch (e.op) {
      case 'dmg': {
        const segs: TextSeg[] = [ic('dmg', 'Deal '), num(e.v + (opts.dmgBonus ?? 0), val)];
        if ((e.hits ?? 1) > 1) segs.push({ s: ` ×${e.hits}` });
        if (e.aoe) segs.push(ic('all', ' to ALL'));
        lines.push(segs);
        break;
      }
      case 'plate': lines.push([ic('plate', 'Plate '), num(e.v + (opts.plateBonus ?? 0), val)]); break;
      case 'heal': lines.push([ic('heal', 'Heal '), num(e.v, val)]); break;
      case 'draw': lines.push([ic('draw', 'Draw '), num(e.v, val)]); break;
      case 'energy': lines.push([ic('energy', 'Energy +', '+'), num(e.v, val)]); break;
      case 'weak': lines.push([ic('weak', 'Weak '), num(e.v, val)]); break;
      case 'expose': lines.push([ic('expose', 'Expose '), num(e.v, val)]); break;
      case 'tag': lines.push([ic('tag', 'Tag '), num(e.v, val)]); break;
      case 'triage': lines.push([ic('triage', 'Triage '), num(e.v, val)]); break;
      case 'empower': lines.push([ic('empower', 'Next card +', '+'), num(e.v, val)]); break;
      case 'healPerTagged': lines.push([ic('heal', 'Heal '), num(e.v, val), ic('tag', ' per tagged enemy', '/')]); break;
      case 'drain': lines.push([ic('drain', `Heal ${e.v}% of damage dealt`, `${e.v}%`)]); break;
      case 'surge': lines.push([ic('surge', '+2 to a random trait this fight', '+2 ?')]); break;
      case 'shatter': lines.push([ic('shatter', `Deal plating ×${e.v}, then strip it`, `×${e.v}`)]); break;
      case 'rot': {
        const segs: TextSeg[] = [ic('rot', 'Rot '), num(e.v, val)];
        if (e.aoe) segs.push(ic('all', ' to ALL'));
        lines.push(segs);
        break;
      }
      case 'healPerRot': lines.push([ic('heal', 'Heal '), num(e.v, val), ic('rot', ' per Rot on enemies', '/')]); break;
      case 'donor': break;
      case 'cannibal': break;
    }
  });
  if (def.act) {
    const p = def.power ? num(r.power, def.power) : null;
    switch (def.act) {
      case 'override': lines.push([ic('key', 'Open doors ≤ ', '≤'), p!]); break;
      case 'cut': lines.push([ic('cut', 'Cut debris ≤ ', '≤'), p!]); break;
      case 'scan': lines.push([ic('scan', 'Scan radius '), p!]); break;
      case 'heal': lines.push([ic('heal', 'Heal '), p!]); break;
      case 'flare': lines.push([ic('flare', 'Light the zone. ')], [ic('expose', 'Expose '), p!]); break;
      case 'notes': lines.push([ic('notes', 'Reveal radius '), p!]); break;
      case 'seal': lines.push([ic('seal', 'Hazard-proof for '), p!, { s: ' steps', short: '' } as TextSeg]); break;
      case 'pry': lines.push([ic('pry', r.power ? 'Open a cache, +1 item' : 'Open a cache', r.power ? '+1' : '')]); break;
      case 'beacon': lines.push([ic('beacon', 'Plant a beacon')]); break;
      case 'stalk': lines.push([ic('stalk', 'Strike first next fight')]); break;
    }
  }
  if (def.rule && !def.act) lines.push([{ s: def.rule }]);
  (def.th ?? []).forEach((th, i) => {
    lines.push([{ s: `${th.t.toUpperCase()} ${th.at}: ${th.text}`, trait: th.t, why: r.met[i] ? 'met' : 'unmet' }]);
  });
  if (r.bioCost) lines.push([ic('bio', 'Costs biomass ', '−'), { s: String(r.bioCost) }]);
  return lines;
}

export function hasKeyword(def: CardDef, k: Keyword): boolean {
  return def.keywords?.includes(k) ?? false;
}
