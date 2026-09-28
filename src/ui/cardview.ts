import { CARDS, cardText, primaryTrait, resolveCard, type TextSeg } from '../core/cards';
import { cardEmblem } from './cardbg';
import { icon } from './icons';
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
  const body = lines.map((segs) => lineHtml(segs, !!o.big)).join('');
  const kws = (def.keywords ?? []).filter((k) => k !== 'fleeting').map((k) => k).join(' · ');
  const cls = ['card', tint ? `t-${tint}` : '', o.off ? 'off' : '', o.big ? 'big' : '', def.medic ? 'medic' : '', o.fleeting ? 'fleeting' : '', o.extraClass ?? ''].join(' ');
  // tactical costs use the same diamonds as the energy bar; exploration costs are oxygen
  const cost = def.deck === 'exp' ? `<div class="cost o2">${r.cost}</div>`
    : r.cost > 0 ? `<div class="cost pips" title="${r.cost} energy">${'<b></b>'.repeat(r.cost)}</div>` : '';
  return `<div class="${cls}">${cardEmblem(id)}${cost}<div class="name">${esc(def.name)}${o.donor ? ' ⊕' : ''}</div>${body}${kws ? `<div class="kw">${esc(kws)}</div>` : ''}</div>`;
}

/** One line of card text. On the card face, effect words become icons; the big view keeps the words too. */
/** Threshold rewards as icons: 'MGT 9: Expose 1' reads as MGT 9 › [expose]1. */
const TH_ICONS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Expose (\d+)$/, (m) => icon('expose') + m[1]],
  [/^Tag (\d+)$/, (m) => icon('tag') + m[1]],
  [/^Draw (\d+)$/, (m) => icon('draw') + m[1]],
  [/^Hits twice$/, () => icon('dmg') + '×2'],
  [/^(\d+) hits$/, (m) => icon('dmg') + '×' + m[1]],
  [/^Costs 0$/, () => icon('energy') + '0'],
  [/^Heal all of it$/, () => icon('drain') + '100%'],
  [/^Heal (\d+) per tagged enemy$/, (m) => icon('heal') + m[1] + '/' + icon('tag')],
  [/^Plating ×(\d+)$/, (m) => icon('shatter') + '×' + m[1]],
  [/^\+1 item$/, () => icon('pry') + '+1'],
  [/^Never fails$/, () => icon('surge') + '✓'],
  [/^Plating stays 1 extra turn$/, () => icon('plate') + '+1 turn'],
];

function thresholdHtml(text: string, met: boolean, words: boolean): string {
  const m = text.match(/^([A-Z]{3}) (\d+): (.*)$/);
  if (!m) return `<div class="th ${met ? 'met' : 'unmet'}">${esc(text)}</div>`;
  const [, tr, at, what] = m;
  let body = esc(what);
  if (!words) {
    for (const [re, f] of TH_ICONS) {
      const hit = what.match(re);
      if (hit) { body = f(hit); break; }
    }
  }
  return `<div class="th ${met ? 'met' : 'unmet'}"><b class="${tr.toLowerCase()}">${tr} ${at}</b> › ${body}</div>`;
}

function lineHtml(segs: TextSeg[], words: boolean): string {
  const th = segs.length === 1 && (segs[0].why === 'met' || segs[0].why === 'unmet');
  if (th) return thresholdHtml(segs[0].s, segs[0].why === 'met', words);
  const iconic = segs.some((q) => q.icon);
  const parts = segs.map((q) => {
    if (q.icon && !words && q.short?.startsWith('/')) return esc(q.short) + icon(q.icon);
    if (q.icon) return icon(q.icon) + (words ? `<span class="w">${esc(q.s)}</span>` : q.short ? esc(q.short) : '');
    if (!words && q.short !== undefined) return esc(q.short);
    if (q.trait || /^\d+$/.test(q.s)) return `<b class="${q.trait ?? ''}">${esc(q.s)}</b>`;
    return esc(q.s);
  }).join('');
  return `<div class="${iconic ? 'ln fx' : 'ln rule'}">${parts}</div>`;
}

/** Long-press detail: every number with its formula. */
export function cardDetail(id: string, t: Traits, donor = false): string {
  const def = CARDS[id];
  const lines = cardText(def, t, { donor });
  const whys = lines.flat().filter((s) => s.why && s.why !== 'met' && s.why !== 'unmet').map((s) => `<div class="why">${esc(s.s)} = ${esc(s.why!)}</div>`).join('');
  return `${cardHtml(id, t, { big: true, donor })}${whys}${def.rule && def.act ? `<p>${esc(def.rule)}</p>` : ''}<p><i>${esc(def.flavor)}</i></p>`;
}
