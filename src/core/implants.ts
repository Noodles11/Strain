import type { Traits } from './traits';

/** Passive run items. They fill the role genes and mutations used to play in Reprint. */
export interface ImplantDef {
  id: string;
  name: string;
  glyph: string;
  text: string;
  flavor: string;
  traits?: Partial<Traits>;
  maxHp?: number;
  o2?: number;
  // battle
  plateHde?: boolean;
  firstCardFree?: boolean;
  thorns?: number;
  tagStart?: number;
  energyFirst?: number;
  drawFirst?: number;
  fleeBonus?: number;
  // exploration
  eatBio?: number;
  renderBio?: number;
  winO2?: number;
  wetEye?: boolean;
}

export const IMPLANTS: Record<string, ImplantDef> = {
  riblattice: { id: 'riblattice', name: 'Rib Lattice', glyph: '⌸', plateHde: true, text: 'Start every battle with plating equal to Hide.', flavor: 'A cage around the cage.' },
  stomach: { id: 'stomach', name: 'Second Stomach', glyph: '◒', eatBio: 2, text: 'Every corpse renders 2 extra biomass.', flavor: 'Nothing goes to waste.' },
  spinal: { id: 'spinal', name: 'Spinal Relay', glyph: '┇', firstCardFree: true, text: 'The first card each battle costs 0.', flavor: 'The body moves before you decide.' },
  weteye: { id: 'weteye', name: 'Wet Eye', glyph: '◉', wetEye: true, text: 'See ambushers within 2 tiles, whatever their stealth.', flavor: 'It never closes.' },
  tumor: { id: 'tumor', name: 'Tumor Engine', glyph: '⟁', traits: { abr: 1 }, maxHp: -4, text: '+1 Aberrance. −4 max integrity.', flavor: 'It grows. So do you.' },
  adrenalsac: { id: 'adrenalsac', name: 'Adrenal Sac', glyph: '⚡', winO2: 1, text: 'Winning a battle above half integrity: +1 oxygen.', flavor: 'Victory tastes like air.' },
  grip: { id: 'grip', name: 'Grip Tendons', glyph: '✊', traits: { mgt: 1, rfx: -1 }, text: '+1 Might. −1 Reflex.', flavor: 'Thick cords, slow hands.' },
  boneplate: { id: 'boneplate', name: 'Bone Plating', glyph: '⬢', traits: { hde: 1, rfx: -1 }, text: '+1 Hide. −1 Reflex.', flavor: 'Heavier. Harder.' },
  myelin: { id: 'myelin', name: 'Myelin Sheath', glyph: '≋', traits: { rfx: 1 }, text: '+1 Reflex.', flavor: 'Signals travel clean.' },
  lace: { id: 'lace', name: 'Neural Lace', glyph: '◎', traits: { foc: 1 }, maxHp: -3, text: '+1 Focus. −3 max integrity.', flavor: 'Fine wire under the scalp.' },
  fat: { id: 'fat', name: 'Fat Reserve', glyph: '◯', maxHp: 8, text: '+8 max integrity.', flavor: 'For the lean years.' },
  bladder: { id: 'bladder', name: 'Oxygen Bladder', glyph: '○', o2: 2, text: '+2 max oxygen.', flavor: 'A second lung, folded small.' },
  scavenger: { id: 'scavenger', name: 'Scavenger Gland', glyph: '◆', renderBio: 1, text: 'Rendering a corpse gives +1 biomass.', flavor: 'It knows where the good parts are.' },
  thorn: { id: 'thorn', name: 'Thorn Skin', glyph: '✳', thorns: 2, text: 'Enemies that hit you take 2.', flavor: 'Touch costs.' },
  nose: { id: 'nose', name: 'Hunter’s Nose', glyph: '⌖', tagStart: 1, text: 'The first enemy of every battle starts tagged.', flavor: 'You smell it before you see it.' },
  coldblood: { id: 'coldblood', name: 'Cold Blood', glyph: '❄', energyFirst: 1, text: '+1 energy on the first turn of every battle.', flavor: 'No hurry. No fear.' },
  fold: { id: 'fold', name: 'Lucky Fold', glyph: '⌇', fleeBonus: 0.2, text: '+20% chance to flee.', flavor: 'A crease in the print. It helps you slip.' },
  hook: { id: 'hook', name: 'Nerve Hook', glyph: '⟆', drawFirst: 1, text: 'Draw 1 extra card on the first turn of every battle.', flavor: 'Hooked into the readiness reflex.' },
};

export const IMPLANT_POOL = Object.keys(IMPLANTS);

export interface ImplantMods {
  traits: Partial<Traits>;
  maxHp: number;
  o2: number;
  plateHde: boolean;
  firstCardFree: boolean;
  thorns: number;
  tagStart: number;
  energyFirst: number;
  drawFirst: number;
  fleeBonus: number;
  eatBio: number;
  renderBio: number;
  winO2: number;
  wetEye: boolean;
}

export function implantMods(ids: string[]): ImplantMods {
  const m: ImplantMods = {
    traits: {}, maxHp: 0, o2: 0, plateHde: false, firstCardFree: false, thorns: 0, tagStart: 0, energyFirst: 0,
    drawFirst: 0, fleeBonus: 0, eatBio: 0, renderBio: 0, winO2: 0, wetEye: false,
  };
  for (const id of ids) {
    const d = IMPLANTS[id];
    if (!d) continue;
    for (const [k, n] of Object.entries(d.traits ?? {})) m.traits[k as keyof Traits] = (m.traits[k as keyof Traits] ?? 0) + (n ?? 0);
    m.maxHp += d.maxHp ?? 0;
    m.o2 += d.o2 ?? 0;
    m.plateHde ||= !!d.plateHde;
    m.firstCardFree ||= !!d.firstCardFree;
    m.thorns += d.thorns ?? 0;
    m.tagStart += d.tagStart ?? 0;
    m.energyFirst += d.energyFirst ?? 0;
    m.drawFirst += d.drawFirst ?? 0;
    m.fleeBonus += d.fleeBonus ?? 0;
    m.eatBio += d.eatBio ?? 0;
    m.renderBio += d.renderBio ?? 0;
    m.winO2 += d.winO2 ?? 0;
    m.wetEye ||= !!d.wetEye;
  }
  return m;
}
