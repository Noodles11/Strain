import type { Trait } from './traits';

/** What an event choice does. Every field is optional and they stack. */
export interface Outcome {
  text: string;
  biomass?: number;
  hp?: number;
  maxHp?: number;
  o2?: number;
  codons?: number;
  somatic?: Trait | 'random';
  card?: 'tac' | 'exp';
  implant?: string | 'random';
  loseCard?: boolean;
  log?: string;
}

export interface EventOption {
  label: string;
  /** Trait check. Certain at or above target; below it, 15% less per missing point. */
  check?: { t: Trait; at: number };
  win: Outcome;
  lose?: Outcome;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

export const LOGS: Record<string, { title: string; text: string }> = {
  'derelict-1': { title: 'Batch report 0004', text: 'Survival past the first corridor: 0.6%. Adjusting aggression markers upward. The project does not require them to be kind.' },
  'derelict-2': { title: 'Crew note, unsigned', text: 'We stopped naming them after the two-hundredth. It was easier. It was not better.' },
  'derelict-3': { title: 'Mirror protocol', text: 'Each print is shown its predecessor for three seconds. Recognition correlates with longevity. We do not know why.' },
  'derelict-4': { title: 'Coolant log', text: 'Vat temperature holding. Something in vat 9 is regulating its own temperature. Recommend we do not open vat 9.' },
  'derelict-5': { title: 'The First, annotated', text: 'Subject 0001 refused reprint. Subject 0001 is still aboard. All later prints carry a fragment of its sequence.' },
  'kessra-1': { title: 'Probe K, landing', text: 'Seed-probe down in the caves. The crystal answers our radar with our own signal, slightly changed.' },
  'kessra-2': { title: 'Lattice sample', text: 'Each facet holds a pattern. The patterns are genomes. Some of them are ours. Some are prints we never made.' },
  'kessra-3': { title: 'Resonance note', text: 'Acts repeated near the lattice repeat themselves. Blows. Words. Deaths. The cave is practising.' },
  'kessra-4': { title: 'Probe K, final', text: 'The shardlings are not animals. They are the cave, walking. It is sampling us back.' },
  'kessra-5': { title: 'The Prism Mother', text: 'She holds every print in glass. Yours is the newest. She was waiting to see how it ends.' },
};

export const LOG_CODONS = 5;

export const DERELICT_EVENTS: EventDef[] = [
  {
    id: 'vat', title: 'The humming vat',
    text: 'A growth vat, still warm. Something turns inside and taps the glass, slowly, in time with your steps.',
    options: [
      { label: 'Drain it', check: { t: 'mgt', at: 5 }, win: { text: 'The fluid pours out thick. You render what was in it.', biomass: 8 }, lose: { text: 'The valve bursts. Scalding gel.', hp: -5 } },
      { label: 'Read the label', check: { t: 'foc', at: 5 }, win: { text: 'Faded print. A batch number. A note.', log: 'derelict-4', codons: 2 }, lose: { text: 'The label is scratched out from the inside.' } },
      { label: 'Climb in', check: { t: 'abr', at: 6 }, win: { text: 'It is warm. It knows you. When you climb out you are different.', somatic: 'abr', implant: 'tumor' }, lose: { text: 'It rejects you. Violently.', hp: -8 } },
      { label: 'Leave', win: { text: 'The tapping follows you down the corridor.' } },
    ],
  },
  {
    id: 'crewman', title: 'The sealed suit',
    text: 'A crew suit slumped against the wall, still sealed. The visor is fogged from the inside.',
    options: [
      { label: 'Open the pack', win: { text: 'Tools. Old, but they work.', card: 'exp' } },
      { label: 'Read his wrist log', check: { t: 'foc', at: 4 }, win: { text: 'The screen flickers on.', log: 'derelict-2', codons: 2 }, lose: { text: 'Dead battery.' } },
      { label: 'Take his lungs', check: { t: 'abr', at: 5 }, win: { text: 'They still inflate. You make room for them.', implant: 'bladder' }, lose: { text: 'The suit was not empty of air. It was full of something else.', hp: -6 } },
      { label: 'Leave him', win: { text: 'You close the corridor behind you.' } },
    ],
  },
  {
    id: 'mirror', title: 'The mirror terminal',
    text: 'A screen shows your face, three seconds late. When you stop moving, it keeps moving.',
    options: [
      { label: 'Talk to it', check: { t: 'foc', at: 6 }, win: { text: 'It answers in your voice. You learn something about attention.', somatic: 'foc', log: 'derelict-3' }, lose: { text: 'It only repeats you. Then it stops.' } },
      { label: 'Smash it', check: { t: 'mgt', at: 4 }, win: { text: 'Glass and board. Something useful inside.', biomass: 4, card: 'tac' }, lose: { text: 'The glass is tougher than your hand.', hp: -4 } },
      { label: 'Let it copy you', check: { t: 'abr', at: 7 }, win: { text: 'It takes a piece. It gives one back.', implant: 'random' }, lose: { text: 'It takes a piece. It keeps it.', loseCard: true } },
      { label: 'Look away', win: { text: 'You feel it watching you leave.' } },
    ],
  },
  {
    id: 'coolant', title: 'Leaking coolant',
    text: 'A pipe weeps pale blue fluid. The air around it tastes of metal and mint.',
    options: [
      { label: 'Seal it', check: { t: 'hde', at: 5 }, win: { text: 'You clamp it with your forearm until it freezes shut. The air clears.', o2: 3, codons: 3 }, lose: { text: 'Frostbite. Deep.', hp: -6 } },
      { label: 'Drink it', check: { t: 'met', at: 6 }, win: { text: 'Your body knows what to do with it.', hp: 12 }, lose: { text: 'Your body does not know what to do with it.', hp: -4 } },
      { label: 'Walk on', win: { text: 'The drip follows you for a while.' } },
    ],
  },
  {
    id: 'crawlspace', title: 'Sparking crawlspace',
    text: 'A maintenance duct, torn open. Something glints at the end, past live wires.',
    options: [
      { label: 'Squeeze through', check: { t: 'rfx', at: 5 }, win: { text: 'You slip between the arcs and back.', implant: 'random' }, lose: { text: 'An arc finds you.', hp: -5 } },
      { label: 'Rip the wires out', check: { t: 'mgt', at: 6 }, win: { text: 'Sparks, then dark. You take your time.', implant: 'random', biomass: 3 }, lose: { text: 'The current throws you back.', hp: -7 } },
      { label: 'Leave it', win: { text: 'Some things stay where they are.' } },
    ],
  },
  {
    id: 'hymn', title: 'A voice in the vents',
    text: 'Singing, far off, many voices. They are all yours.',
    options: [
      { label: 'Listen', check: { t: 'foc', at: 5 }, win: { text: 'You catch words in it. A record.', log: 'derelict-1', codons: 2 }, lose: { text: 'It makes no sense. It gives you a headache.', hp: -2 } },
      { label: 'Sing back', check: { t: 'abr', at: 5 }, win: { text: 'They go quiet. Then they sing your part.', somatic: 'random' }, lose: { text: 'They notice you. Something starts moving through the vents.', hp: -3 } },
      { label: 'Block your ears', win: { text: 'The song ends. You are not sure when.' } },
    ],
  },
];

export const KESSRA_EVENTS: EventDef[] = [
  {
    id: 'geode', title: 'The humming geode',
    text: 'A geode the size of a body, split open. Inside, light moves like breath.',
    options: [
      { label: 'Crack it open', check: { t: 'mgt', at: 6 }, win: { text: 'It gives. Warm grit and something that still glows.', biomass: 8, card: 'tac' }, lose: { text: 'It rings like a bell. Your arms go numb.', hp: -6 } },
      { label: 'Listen', check: { t: 'foc', at: 5 }, win: { text: 'The hum is a recording. You hear it end.', log: 'kessra-3', codons: 3 }, lose: { text: 'It hums back at you, louder.', hp: -2 } },
      { label: 'Press your face to it', check: { t: 'abr', at: 7 }, win: { text: 'It is cold, then it isn’t. Something in you changes shape to match.', somatic: 'abr' }, lose: { text: 'The glass bites. You leave some of yourself in it.', hp: -8 } },
      { label: 'Leave', win: { text: 'The hum follows you for a long time.' } },
    ],
  },
  {
    id: 'probe', title: 'The seed-probe',
    text: 'Half-buried in crystal: a probe like the one that printed you, its hatch grown shut.',
    options: [
      { label: 'Read its core', check: { t: 'foc', at: 5 }, win: { text: 'Flight logs, still intact.', log: 'kessra-1', codons: 2 }, lose: { text: 'Corrupted. Crystal in the memory.' } },
      { label: 'Strip it for parts', check: { t: 'mgt', at: 5 }, win: { text: 'You pry loose something still humming.', implant: 'random' }, lose: { text: 'The hull edge opens your palm.', hp: -5 } },
      { label: 'Take its tools', win: { text: 'Survey kit, frosted but working.', card: 'exp' } },
    ],
  },
  {
    id: 'mirrorpool', title: 'The mirror pool',
    text: 'A pool of liquid glass. Your reflection in it is three prints older.',
    options: [
      { label: 'Reach in', check: { t: 'rfx', at: 6 }, win: { text: 'Quick in, quick out. Your hand comes back holding a sample.', log: 'kessra-2', biomass: 4 }, lose: { text: 'It closes on your wrist. You pull free, bleeding light.', hp: -6 } },
      { label: 'Drink', check: { t: 'met', at: 6 }, win: { text: 'Your body files it away somewhere useful.', somatic: 'random', hp: 6 }, lose: { text: 'Glass in the gut.', hp: -7 } },
      { label: 'Walk away', win: { text: 'The older you watches you go.' } },
    ],
  },
  {
    id: 'shardnest', title: 'Shard nursery',
    text: 'Tiny shardlings, still attached to the wall. They turn toward your warmth.',
    options: [
      { label: 'Harvest them', check: { t: 'hde', at: 5 }, win: { text: 'They cut, but not deep. Good biomass.', biomass: 10 }, lose: { text: 'They swarm your arms.', hp: -7, biomass: 3 } },
      { label: 'Let them touch you', check: { t: 'abr', at: 6 }, win: { text: 'They map you. When they let go, your skin remembers glass.', implant: 'boneplate', log: 'kessra-4' }, lose: { text: 'They decide you are food.', hp: -6 } },
      { label: 'Back away', win: { text: 'They go still again.' } },
    ],
  },
];

export function checkChance(trait: number, at: number): number {
  if (trait >= at) return 1;
  return Math.max(0.05, 1 - 0.15 * (at - trait));
}
