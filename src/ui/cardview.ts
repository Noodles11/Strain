import { CARDS, cardText, primaryTrait, resolveCard } from '../core/cards';
import type { Traits } from '../core/traits';

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export interface CardOpts {
  donor?: boolean;
  dmgBonus?: number;
  plateBonus?: number;
  off?: boolean;
  big?: boolean;
  fleeting?: boolean;
  extraClass?: string;
}

/** A card face as HTML. Numbers carry the colour of the trait that drives them. */
export function cardHtml(id: string, t: Traits, o: CardOpts = {}): string {
  const def = CARDS[id];
  const r = resolveCard(def, t, o.donor);
  const tint = primaryTrait(def);
  const lines = cardText(def, t, { donor: o.donor, dmgBonus: o.dmgBonus, plateBonus: o.plateBonus });
  const body = lines.map((segs) => {
    const th = segs.length === 1 && (segs[0].why === 'met' || segs[0].why === 'unmet');
    if (th) return `<div class="th ${segs[0].why}">${esc(segs[0].s)}</div>`;
    return `<div class="ln">${segs.map((s) => (s.trait || /^\d+$/.test(s.s) ? `<b class="${s.trait ?? ''}">${esc(s.s)}</b>` : esc(s.s))).join('')}</div>`;
  }).join('');
  const kws = (def.keywords ?? []).filter((k) => k !== 'fleeting').map((k) => k).join(' · ');
  const cls = ['card', tint ? `t-${tint}` : '', o.off ? 'off' : '', o.big ? 'big' : '', def.medic ? 'medic' : '', o.fleeting ? 'fleeting' : '', o.extraClass ?? ''].join(' ');
  const cost = def.deck === 'exp' ? `<div class="cost o2">${r.cost}</div>` : `<div class="cost">${r.cost}</div>`;
  return `<div class="${cls}">${cost}<div class="glyph">${def.glyph}</div><div class="name">${esc(def.name)}${o.donor ? ' ⊕' : ''}</div>${body}${kws ? `<div class="kw">${esc(kws)}</div>` : ''}</div>`;
}

/** Long-press detail: every number with its formula. */
export function cardDetail(id: string, t: Traits, donor = false): string {
  const def = CARDS[id];
  const lines = cardText(def, t, { donor });
  const whys = lines.flat().filter((s) => s.why && s.why !== 'met' && s.why !== 'unmet').map((s) => `<div class="why">${esc(s.s)} = ${esc(s.why!)}</div>`).join('');
  return `${cardHtml(id, t, { big: true, donor })}${whys}${def.rule && def.act ? `<p>${esc(def.rule)}</p>` : ''}<p><i>${esc(def.flavor)}</i></p>`;
}
