import { currentIntent, intentNumbers, type BattleState, type Foe } from '../core/battle';
import { ENEMIES, type Intent } from '../core/enemies';
import { IMPLANTS } from '../core/implants';
import { LORE } from '../core/lore';
import { mods, runTraits, type RunState } from '../core/run';
import { TRAIT_INFO, TRAITS } from '../core/traits';
import { icon } from './icons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One active effect: icon, name, number, and what it does right now. */
function fx(ic: string, name: string, n: number | string, text: string): string {
  return `<div class="fxrow"><span class="fxic">${ic}</span><div><b>${name} ${n}</b><br><small>${text}</small></div></div>`;
}

const turns = (n: number) => `${n} more turn${n === 1 ? '' : 's'}`;

/** A move in plain words, with the foe's own numbers where they apply. */
function moveText(s: BattleState, f: Foe, it: Intent): string {
  const def = ENEMIES[f.id];
  const will = def.will + f.tier;
  const parts: string[] = [];
  if (it.attack !== undefined) {
    const a = it.attack + def.might + f.tier + f.strength + (f.vet ?? 0);
    parts.push(`hits for ${a}${(it.hits ?? 1) > 1 ? ` ×${it.hits}` : ''}${it.pierce ? ' through plating' : ''}${it.drain ? ', healing itself for what it takes' : ''}`);
  }
  if (it.plate !== undefined) parts.push(`gains ${it.plate + def.hide + Math.floor(f.tier / 2)} plating`);
  if (it.strength) parts.push(`+${it.strength} strength`);
  if (it.weak) parts.push(`makes you Weak ${it.weak + Math.floor(will / 4)}`);
  if (it.expose) parts.push(`Exposes you ${it.expose + Math.floor(will / 4)}`);
  if (it.rot) parts.push(`Rot ${it.rot + Math.floor(will / 4)} on you`);
  if (it.summon) parts.push(`calls a ${ENEMIES[it.summon].name}`);
  if (it.allyStrength) parts.push(`the others +${it.allyStrength} strength`);
  if (it.healAlly) parts.push(`heals an ally ${it.healAlly + Math.floor(will / 2)}`);
  void s;
  return parts.join(', ') || 'waits';
}

export function foeInfo(s: BattleState, f: Foe): string {
  const def = ENEMIES[f.id];
  const rank = def.rank === 'boss' ? 'Boss' : def.rank === 'elite' ? 'Elite' : 'Creature';
  const form = f.form === 'faint' ? ' · a faint specimen, weaker than most' : f.form === 'hulking' ? ' · a hulking specimen, bigger than most' : '';
  const effects: string[] = [];
  if (f.plate) effects.push(fx(icon('plate'), 'Plating', f.plate, 'Soaks up your damage before its HP. Clears at the start of its turn.'));
  if (f.strength) effects.push(fx(icon('empower'), 'Strength', `+${f.strength}`, `Every attack it makes hits ${f.strength} harder, for the rest of the fight.`));
  if (f.vet) effects.push(fx(icon('empower'), 'Veteran', `+${f.vet}`, `Clones have killed so many of its kind that the survivors learned: +${f.vet} attack.`));
  if (f.weak) effects.push(fx(icon('weak'), 'Weak', f.weak, `Its attacks deal 25% less. Wears off after ${turns(f.weak)}.`));
  if (f.expose) effects.push(fx(icon('expose'), 'Exposed', f.expose, `Takes 50% more from your hits. Wears off after ${turns(f.expose)}.`));
  if (f.tag) effects.push(fx(icon('tag'), 'Tagged', f.tag, 'Hooked: its corpse yields double biomass, and Triage prints Clot Patches when it dies.'));
  if (f.rot) effects.push(fx(icon('rot'), 'Rot', f.rot, `Takes ${f.rot} at the start of its turn, straight through plating, then Rot drops by 1.`));
  if (f.asleep) effects.push(fx('❄', 'Asleep', '', 'Frozen behind frost plating that doesn’t clear. It wakes after a few rounds or when badly hurt.'));
  if (f.sick) effects.push(fx('…', 'Summoned', '', 'Just arrived. It spends its first turn finding its feet.'));
  if (def.countdown) effects.push(fx('♨', 'Heat', `${f.heat ?? 0}/${def.countdown.at}`, `Explodes on its ${def.countdown.at}th turn for ${def.countdown.blast + 2 * f.tier}, straight through plating.`));

  const traits: string[] = [];
  if (def.splits) traits.push('Splits into two halves the first time it dies.');
  if (def.reflect) traits.push(`While plated, ${Math.round(def.reflect * 100)}% of every hit comes back at you.`);
  if (def.regen) traits.push(`Regrows ${def.regen + Math.floor(f.tier / 2)} HP at the start of each of its turns.`);
  if (def.deathRot) traits.push(`Bursts into spores when it dies: Rot ${def.deathRot} on you.`);
  if (def.fleesAfter) traits.push(`Runs off after its ${def.fleesAfter}nd turn; catch it first.`);
  if (def.bonusCodons) traits.push(`Worth +${def.bonusCodons} Codons if you catch it.`);
  if (def.phase2) traits.push(`Below ${Math.round(def.phase2.below * 100)}% HP it changes how it fights.`);

  const n = intentNumbers(s, f);
  const next = f.alive && !f.asleep && !f.sick ? `<p><b>Next:</b> ${esc(n.label)} — ${esc(moveText(s, f, currentIntent(f, s)))}.</p>` : '';
  const pat = f.phase2 && def.phase2 ? def.phase2.pattern : def.pattern;
  const moves = pat.map((it) => `<li><b>${esc(it.label)}</b>: ${esc(moveText(s, f, it))}</li>`).join('');

  return `<h2>${esc(def.name)}</h2>
    <p class="sub">${rank}${form} · ${f.hp}/${f.maxHp} HP</p>
    <p><i>${esc(def.flavor)}</i></p>
    ${LORE[f.id] ? `<p>${esc(LORE[f.id])}</p>` : ''}
    <h3>Active effects</h3>${effects.join('') || '<p class="sub">None.</p>'}
    ${next}
    <h3>How it fights</h3><ul class="moves">${moves}</ul>
    ${traits.length ? `<ul class="moves">${traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <p class="sub">Might ${def.might} · Hide ${def.hide} · Speed ${def.speed} · Will ${def.will}${f.tier ? ` (+${f.tier} each from the planet’s tier)` : ''}</p>`;
}

export function playerInfo(r: RunState, s: BattleState, name: string): string {
  const p = s.player;
  const effects: string[] = [];
  if (p.plate) effects.push(fx(icon('plate'), 'Plating', p.plate, 'Soaks up hits before your integrity. Clears at the start of your next turn.'));
  if (p.keep) effects.push(fx(icon('plate'), 'Held plating', p.keep, 'This much plating carries over into your next turn.'));
  if (p.weak) effects.push(fx(icon('weak'), 'Weak', p.weak, `Your attacks deal 25% less. Wears off after ${turns(p.weak)}.`));
  if (p.expose) effects.push(fx(icon('expose'), 'Exposed', p.expose, `Enemy hits deal 50% more. Wears off after ${turns(p.expose)}.`));
  if (p.rot) effects.push(fx(icon('rot'), 'Rot', p.rot, `You take ${p.rot} at the start of your turn, through plating, then Rot drops by 1.`));
  if (s.empower) effects.push(fx(icon('empower'), 'Empowered', `+${s.empower}`, `Your next card deals ${s.empower} more.`));
  if (s.triage) effects.push(fx(icon('triage'), 'Triage', s.triage, `Each tagged enemy that dies prints ${s.triage} Clot Patch${s.triage > 1 ? 'es' : ''} into your hand.`));
  for (const k of TRAITS) {
    if (s.surge[k]) effects.push(fx(`<b class="${k}">${TRAIT_INFO[k].short}</b>`, TRAIT_INFO[k].name, `${s.surge[k] > 0 ? '+' : ''}${s.surge[k]}`, 'Changed for this fight only.'));
  }

  const im = mods(r).traits;
  const total = runTraits(r);
  const rows = TRAITS.map((k) => {
    const info = TRAIT_INFO[k];
    const bits = [`${r.seq[k]} sequence`];
    if (r.somatic[k]) bits.push(`${r.somatic[k] > 0 ? '+' : ''}${r.somatic[k]} spliced`);
    const iv = im[k] ?? 0;
    if (iv) bits.push(`${iv > 0 ? '+' : ''}${iv} implants`);
    if (s.surge[k]) bits.push(`${s.surge[k] > 0 ? '+' : ''}${s.surge[k]} this fight`);
    return `<tr class="t-${k}"><td>${info.glyph}</td><td><b>${info.name}</b><br><small>${esc(info.battle)} · ${esc(info.explore)}</small></td>
      <td class="num"><b>${total[k] + s.surge[k]}</b><br><small>${bits.join(' ')}</small></td></tr>`;
  }).join('');
  const implants = r.implants.map((id) => IMPLANTS[id]).filter(Boolean)
    .map((d) => `<li><b>${d.glyph} ${esc(d.name)}</b>: ${esc(d.text)}</li>`).join('');

  return `<h2>${esc(name)}</h2>
    <p class="sub">Print ${r.clone} · ${p.hp}/${p.maxHp} integrity · ${s.energy} energy · ${s.biomass} biomass</p>
    <h3>Active effects</h3>${effects.join('') || '<p class="sub">None.</p>'}
    <h3>Genome</h3>
    <p class="sub">Sequence levels come from the Printer and carry to every print. Splices and implants belong to this body only.</p>
    <table class="genome">${rows}</table>
    <h3>Implants</h3>${implants ? `<ul class="moves">${implants}</ul>` : '<p class="sub">None yet.</p>'}`;
}
