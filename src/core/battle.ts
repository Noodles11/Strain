import { CARDS, hasKeyword, resolveCard, type CardDef, type Effect, type ResolvedCard } from './cards';
import { ENEMIES, rollForm, veteran, type EnemyDef, type FoeForm, type Intent } from './enemies';
import type { Rng } from './rng';
import { addTraits, energyPerTurn, handSize, TRAITS, traits, type Trait, type Traits } from './traits';

export interface CardInst {
  uid: number;
  id: string;
  /** Printed mid-fight; never joins the deck. */
  fleeting?: boolean;
  /** Donor Cell: uses the highest trait for every number, this fight. */
  donor?: boolean;
  /** Unscarred Edge: damage grown by holding it. */
  bonus?: number;
}

export interface Foe {
  uid: number;
  id: string;
  hp: number;
  maxHp: number;
  plate: number;
  strength: number;
  weak: number;
  expose: number;
  tag: number;
  intentIdx: number;
  alive: boolean;
  phase2: boolean;
  tier: number;
  /** Already split once (Shardlings). */
  split?: boolean;
  /** Arrived mid-fight: skips its first enemy turn. */
  sick?: boolean;
  /** Left the fight (ran, or blew itself up): no corpse. */
  fled?: boolean;
  /** Its own turns taken (flee timer). */
  acted?: number;
  /** Cryo Sleeper: still dormant; rounds slept. */
  asleep?: boolean;
  slept?: number;
  /** Incinerator: heat so far. */
  heat?: number;
  /** Rot: this much damage at the start of its turn, then one less. */
  rot?: number;
  /** Veteran attack bonus from clones' past kills of this kind. */
  vet?: number;
  /** A faint or hulking specimen (HP rolled low or high). */
  form?: FoeForm;
}

export interface BattlePlayer {
  hp: number;
  maxHp: number;
  plate: number;
  /** Plating that survives the next turn start. */
  keep: number;
  weak: number;
  expose: number;
  /** Rot: this much damage at the start of your turn, through plating, then one less. */
  rot?: number;
}

export type BattleEv =
  | { k: 'text'; s: string }
  | { k: 'hitFoe'; uid: number; n: number }
  | { k: 'hitPlayer'; n: number }
  | { k: 'act'; uid: number }
  | { k: 'die'; uid: number }
  | { k: 'heal'; n: number }
  | { k: 'plate'; who: 'p' | number }
  | { k: 'summon'; uid: number }
  | { k: 'status'; who: 'p' | number }
  /** A card is played: the view animates its attack or effect. */
  | { k: 'card'; id: string; target?: number; hits: number }
  /** An enemy attacks: the view animates the blow. */
  | { k: 'strike'; uid: number; hits: number }
  | { k: 'healFoe'; uid: number; n: number };

export interface BattleState {
  foes: Foe[];
  draw: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  energy: number;
  turn: number;
  phase: 'player' | 'won' | 'lost' | 'fled';
  player: BattlePlayer;
  /** Sequence + somatic, fixed for the fight. */
  base: Traits;
  surge: Traits;
  empower: number;
  triage: number;
  kills: number;
  siblings: number;
  stopped: number;
  /** Cards consumed earlier in the run (Grief Engine). */
  consumedRun: number;
  /** Deck uids consumed this fight; the run removes them. */
  consumed: number[];
  ambush: boolean;
  /** Stalk or sneak: the clone acts first and the enemy has no plating. */
  firstStrike: boolean;
  exposeStart: number;
  lostHp: boolean;
  biomass: number;
  pending?: { kind: 'donor' | 'cannibal'; uid: number; rest: Effect<number>[]; card: CardInst };
  nextUid: number;
  noFlee: boolean;
  log: string[];
  mods: BattleMods;
  /** Cards played this fight. */
  played: number;
  /** Cards played this turn (Resonance). */
  turnPlays: number;
  lastAttack: boolean;
}

/** Implant effects that reach into battles. */
export interface BattleMods {
  firstCardFree: boolean;
  thorns: number;
  tagStart: number;
  energyFirst: number;
  drawFirst: number;
  fleeBonus: number;
  /** Kessra: every 3rd card each turn resolves twice. */
  resonance?: boolean;
}

export const NO_MODS: BattleMods = { firstCardFree: false, thorns: 0, tagStart: 0, energyFirst: 0, drawFirst: 0, fleeBonus: 0 };

export interface BattleSetup {
  mods?: BattleMods;
  foes: string[];
  tier: number;
  deck: CardInst[];
  traits: Traits;
  hp: number;
  maxHp: number;
  biomass: number;
  consumedRun: number;
  ambush?: boolean;
  firstStrike?: boolean;
  exposeStart?: number;
  plateStart?: number;
  /** Kills of each mob kind so far (all runs): veterans get more HP and attack. */
  slain?: Record<string, number>;
  /** Roll each regular foe's HP: faint, normal or hulking. */
  vary?: boolean;
}

const NAME = (f: Foe) => ENEMIES[f.id].name.toUpperCase();

export function effTraits(s: BattleState): Traits {
  return addTraits(s.base, s.surge);
}

export function makeFoe(id: string, tier: number, uid: number, hpMul: number): Foe {
  const def = ENEMIES[id];
  const hp = Math.round(def.hp * hpMul);
  const f: Foe = { uid, id, hp, maxHp: hp, plate: 0, strength: 0, weak: 0, expose: 0, tag: 0, intentIdx: 0, alive: true, phase2: false, tier };
  if (def.sleeps) { f.asleep = true; f.slept = 0; f.plate = def.sleeps.plate + tier; }
  if (def.countdown) f.heat = 0;
  if (def.fleesAfter) f.acted = 0;
  return f;
}

export function startBattle(setup: BattleSetup, rng: Rng, tierBonus: number, hpMul: number): { s: BattleState; ev: BattleEv[] } {
  let uid = 1000;
  const foes = setup.foes.map((id) => {
    const f = makeFoe(id, tierBonus, uid++, hpMul);
    f.expose = setup.exposeStart ?? 0;
    if (setup.slain || setup.vary) {
      const v = veteran(setup.slain?.[id] ?? 0);
      let mul = v.hp;
      if (setup.vary && ENEMIES[id].rank !== 'boss') {
        const rolled = rollForm(rng.next(), rng.next(), ENEMIES[id].rank === 'elite');
        mul *= rolled.mul;
        if (rolled.form) f.form = rolled.form;
      }
      f.maxHp = f.hp = Math.max(1, Math.round(f.hp * mul));
      if (v.atk) f.vet = v.atk;
    }
    return f;
  });
  const s: BattleState = {
    foes,
    draw: rng.shuffle(setup.deck.map((c) => ({ ...c, bonus: 0, donor: false }))),
    hand: [],
    discard: [],
    energy: 0,
    turn: 0,
    phase: 'player',
    player: { hp: setup.hp, maxHp: setup.maxHp, plate: setup.plateStart ?? 0, keep: 0, weak: 0, expose: 0 },
    base: { ...setup.traits },
    surge: traits(0),
    empower: 0,
    triage: 0,
    kills: 0,
    siblings: 0,
    stopped: 0,
    consumedRun: setup.consumedRun,
    consumed: [],
    ambush: !!setup.ambush && !setup.firstStrike,
    firstStrike: !!setup.firstStrike,
    exposeStart: setup.exposeStart ?? 0,
    lostHp: false,
    biomass: setup.biomass,
    nextUid: 5000,
    noFlee: foes.some((f) => ENEMIES[f.id].rank),
    log: [],
    mods: setup.mods ?? NO_MODS,
    played: 0,
    turnPlays: 0,
    lastAttack: false,
  };
  if (s.mods.tagStart && foes[0]) foes[0].tag += s.mods.tagStart;
  const ev: BattleEv[] = [];
  if (s.ambush) for (const f of foes) if (f.asleep) { f.asleep = false; f.plate = 0; }
  const names = foes.map(NAME);
  if (s.ambush) ev.push({ k: 'text', s: `AMBUSH! ${names.join(' and ')} ${names.length > 1 ? 'drop' : 'drops'} on you!` });
  else if (foes.some((f) => ENEMIES[f.id].rank === 'boss')) ev.push({ k: 'text', s: `${names[0]} rises to meet you.` });
  else ev.push({ k: 'text', s: `${names.join(' and ')} ${names.length > 1 ? 'block' : 'blocks'} the way!` });

  const foeSpeed = Math.max(...foes.map((f) => ENEMIES[f.id].speed + f.tier));
  const enemyFirst = s.ambush || (!s.firstStrike && foeSpeed > s.base.rfx);
  if (s.firstStrike) ev.push({ k: 'text', s: 'You strike first.' });
  if (enemyFirst) {
    if (!s.ambush) ev.push({ k: 'text', s: `${names[0]} is faster!` });
    s.noFlee = true;
    enemyTurn(s, rng, ev);
    checkEnd(s, ev);
    if (s.phase !== 'player') return { s, ev };
    s.noFlee = foes.some((f) => ENEMIES[f.id].rank) ;
  }
  startPlayerTurn(s, rng, ev, s.ambush ? 1 : 0);
  if (s.ambush) s.noFlee = true;
  return { s, ev };
}

// ---- Card maths ----

export function resolved(s: BattleState, c: CardInst): ResolvedCard {
  return resolveCard(CARDS[c.id], effTraits(s), c.donor);
}

/** Fight bonuses a card has on top of its printed numbers. */
export function cardBonus(s: BattleState, c: CardInst): { dmg: number; plate: number } {
  const def = CARDS[c.id];
  const t = effTraits(s);
  let dmg = 0;
  let plate = 0;
  switch (def.dyn) {
    case 'feeding': dmg += s.kills * t.abr; break;
    case 'sibling': dmg += 2 * s.siblings; break;
    case 'unscarred': dmg += c.bonus ?? 0; break;
    case 'callus': plate += s.stopped; break;
    case 'grief': plate += s.consumedRun; break;
    default: break;
  }
  return { dmg, plate };
}

/** Energy a card costs right now (Spinal Relay makes the first one free). */
export function costOf(s: BattleState, c: CardInst): number {
  const r = resolved(s, c);
  return s.mods.firstCardFree && s.played === 0 ? 0 : r.cost;
}

export function playable(s: BattleState, c: CardInst): { ok: boolean; why?: string } {
  if (s.phase !== 'player' || s.pending) return { ok: false };
  const r = resolved(s, c);
  if (costOf(s, c) > s.energy) return { ok: false, why: 'Not enough energy' };
  if (r.bioCost > s.biomass) return { ok: false, why: 'Not enough biomass' };
  const healOnly = r.fx.every((e) => e.op === 'heal');
  if (healOnly && s.player.hp >= s.player.maxHp) return { ok: false, why: 'Already whole' };
  return { ok: true };
}

export function aliveFoes(s: BattleState): Foe[] {
  return s.foes.filter((f) => f.alive);
}

export function playCard(s: BattleState, uid: number, targetUid: number | undefined, rng: Rng): BattleEv[] {
  const ev: BattleEv[] = [];
  const idx = s.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) return ev;
  const card = s.hand[idx];
  if (!playable(s, card).ok) return ev;
  const def = CARDS[card.id];
  const r = resolved(s, card);
  const bonus = cardBonus(s, card);
  s.energy -= costOf(s, card);
  s.biomass -= r.bioCost;
  s.played += 1;
  s.hand.splice(idx, 1);
  const aimed = aliveFoes(s).find((f) => f.uid === targetUid) ?? aliveFoes(s)[0];
  const textAt = ev.length;
  ev.push({ k: 'text', s: `You use ${def.name.toUpperCase()}!` });

  const emp = s.empower;
  s.empower = 0;
  const fx = r.fx.map((e) => ({ ...e }));
  for (const e of fx) {
    if (e.op === 'dmg') {
      e.v += bonus.dmg + emp;
      if (def.dyn === 'resonant' && s.lastAttack) e.hits = (e.hits ?? 1) * 2;
      if (def.dyn === 'splitlens' && aliveFoes(s).length >= 2) e.hits = (e.hits ?? 1) * 2;
    }
    if (e.op === 'plate') e.v += bonus.plate;
  }
  s.lastAttack = fx.some((e) => e.op === 'dmg' || e.op === 'shatter');
  const dmgFx = fx.find((e) => e.op === 'dmg');
  // the animation starts first; the text line shows while it plays
  ev.splice(textAt, 0, { k: 'card', id: card.id, target: aimed?.uid, hits: dmgFx && dmgFx.op === 'dmg' ? dmgFx.hits ?? 1 : 1 });
  s.turnPlays += 1;
  const resonates = !!s.mods.resonance && s.turnPlays % 3 === 0;

  const pickIdx = fx.findIndex((e) => e.op === 'donor' || e.op === 'cannibal');
  if (pickIdx >= 0 && s.hand.length > 0) {
    const op = fx[pickIdx].op as 'donor' | 'cannibal';
    s.pending = { kind: op, uid: card.uid, rest: fx.slice(pickIdx + 1), card };
    runFx(s, fx.slice(0, pickIdx), card, targetUid, rng, ev);
    ev.push({ k: 'text', s: op === 'donor' ? 'Choose a card to feed.' : 'Choose a card to eat.' });
    return ev;
  }
  const plain = fx.filter((e) => e.op !== 'donor' && e.op !== 'cannibal');
  runFx(s, plain, card, targetUid, rng, ev);
  if (resonates && s.phase === 'player') {
    ev.push({ k: 'text', s: 'The glass hums. It happens again.' });
    runFx(s, plain.map((e) => ({ ...e })), card, targetUid, rng, ev);
  }
  finishCard(s, card, ev);
  return ev;
}

/** Resolve a Donor or Cannibal choice. */
export function pickHand(s: BattleState, uid: number, targetUid: number | undefined, rng: Rng): BattleEv[] {
  const ev: BattleEv[] = [];
  const p = s.pending;
  if (!p) return ev;
  const target = s.hand.find((c) => c.uid === uid);
  if (!target) return ev;
  s.pending = undefined;
  if (p.kind === 'donor') {
    target.donor = true;
    ev.push({ k: 'text', s: `${CARDS[target.id].name.toUpperCase()} swells with your best.` });
  } else {
    s.hand.splice(s.hand.indexOf(target), 1);
    consume(s, target);
    const gain = CARDS[target.id].cost;
    s.energy += gain;
    ev.push({ k: 'text', s: `You eat ${CARDS[target.id].name.toUpperCase()}. +${gain} energy.` });
  }
  runFx(s, p.rest, p.card, targetUid, rng, ev);
  finishCard(s, p.card, ev);
  return ev;
}

function consume(s: BattleState, c: CardInst) {
  if (c.fleeting) return;
  s.consumed.push(c.uid);
  s.consumedRun += 1;
}

function finishCard(s: BattleState, card: CardInst, ev: BattleEv[]) {
  const def = CARDS[card.id];
  if (def.dyn === 'sibling') s.siblings += 1;
  if (hasKeyword(def, 'consume') || card.fleeting) consume(s, card);
  else s.discard.push(card);
  checkEnd(s, ev);
}

function runFx(s: BattleState, fx: Effect<number>[], card: CardInst, targetUid: number | undefined, rng: Rng, ev: BattleEv[]) {
  const t = effTraits(s);
  let dealt = 0;
  const target = () => {
    const alive = aliveFoes(s);
    return alive.find((f) => f.uid === targetUid) ?? alive[0];
  };
  for (const e of fx) {
    if (s.phase !== 'player') break;
    switch (e.op) {
      case 'dmg': {
        const hits = e.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          const victims = e.aoe ? aliveFoes(s) : [target()].filter(Boolean) as Foe[];
          for (const f of victims) dealt += hitFoe(s, f, e.v, ev);
          if (!aliveFoes(s).length) break;
        }
        break;
      }
      case 'plate':
        s.player.plate += e.v;
        if (e.keep) s.player.keep += e.v;
        ev.push({ k: 'plate', who: 'p' }, { k: 'text', s: `Plating ${s.player.plate}.` });
        break;
      case 'heal': healPlayer(s, e.v, ev); break;
      case 'draw': drawCards(s, e.v, rng); ev.push({ k: 'text', s: `You draw ${e.v}.` }); break;
      case 'energy': s.energy += e.v; ev.push({ k: 'text', s: `+${e.v} energy.` }); break;
      case 'weak': {
        const f = target();
        if (f) { f.weak += e.v; ev.push({ k: 'status', who: f.uid }, { k: 'text', s: `${NAME(f)} is Weak.` }); }
        break;
      }
      case 'expose': {
        const f = target();
        if (f) { f.expose += e.v; ev.push({ k: 'status', who: f.uid }, { k: 'text', s: `${NAME(f)} is Exposed.` }); }
        break;
      }
      case 'tag': {
        const f = target();
        if (f) { f.tag += e.v; ev.push({ k: 'status', who: f.uid }, { k: 'text', s: `${NAME(f)} is tagged.` }); }
        break;
      }
      case 'triage': s.triage += e.v; break;
      case 'shatter': {
        const f = target();
        if (f && f.plate > 0) {
          const d = f.plate * e.v;
          f.plate = 0;
          const lost = hpLost(f.hp, d);
          f.hp -= d;
          dealt += d;
          ev.push({ k: 'hitFoe', uid: f.uid, n: lost }, { k: 'text', s: `${NAME(f)}'s plating shatters! ${d} damage.` });
          if (f.hp <= 0) killFoe(s, f, ev);
          else checkPhase(s, f, ev);
        } else if (f) ev.push({ k: 'text', s: `${NAME(f)} has no plating to break.` });
        break;
      }
      case 'rot': {
        const victims = e.aoe ? aliveFoes(s) : [target()].filter(Boolean) as Foe[];
        if (e.v <= 0) break;
        for (const f of victims) { f.rot = (f.rot ?? 0) + e.v; ev.push({ k: 'status', who: f.uid }); }
        ev.push({ k: 'text', s: e.aoe ? `Rot spreads through them. +${e.v}.` : `${NAME(victims[0])} starts to rot. +${e.v}.` });
        break;
      }
      case 'healPerRot': {
        const n = aliveFoes(s).reduce((a, f) => a + (f.rot ?? 0), 0);
        if (n) healPlayer(s, e.v * n, ev);
        else ev.push({ k: 'text', s: 'Nothing is rotting. Nothing to feed on.' });
        break;
      }
      case 'empower': s.empower += e.v; ev.push({ k: 'text', s: `Next card +${e.v}.` }); break;
      case 'healPerTagged': {
        const n = aliveFoes(s).filter((f) => f.tag > 0).length;
        if (n) healPlayer(s, e.v * n, ev);
        break;
      }
      case 'drain': if (dealt > 0) healPlayer(s, Math.floor((dealt * e.v) / 100), ev); break;
      case 'surge': {
        const k = rng.pick(TRAITS) as Trait;
        const fail = resolved(s, card).power === 0 && rng.int(3) === 0;
        const n = fail ? -1 : e.v;
        s.surge[k] += n;
        ev.push({ k: 'text', s: fail ? `Defect! ${k.toUpperCase()} −1 this fight.` : `${k.toUpperCase()} +${n} this fight!` });
        break;
      }
      default: break;
    }
  }
  void t;
}

function hitFoe(s: BattleState, f: Foe, raw: number, ev: BattleEv[]): number {
  let d = raw;
  if (s.player.weak > 0) d = Math.floor(d * 0.75);
  if (f.expose > 0) d = Math.floor(d * 1.5);
  const reflect = ENEMIES[f.id].reflect && f.plate > 0 ? Math.floor(d * ENEMIES[f.id].reflect!) : 0;
  d = Math.max(0, d - f.plate);
  const lost = hpLost(f.hp, d);
  f.hp -= d;
  ev.push({ k: 'hitFoe', uid: f.uid, n: lost }, { k: 'text', s: d > 0 ? `${NAME(f)} takes ${d}.` : `${NAME(f)}'s plating holds.` });
  if (f.hp <= 0) killFoe(s, f, ev);
  else {
    checkPhase(s, f, ev);
    const sl = ENEMIES[f.id].sleeps;
    if (f.asleep && sl && f.hp <= f.maxHp * sl.wakeBelow) wake(f, ev, 'cracks out of the ice');
  }
  if (reflect > 0 && s.player.hp > 0) {
    const lost = hpLost(s.player.hp, reflect);
    s.player.hp -= reflect;
    s.lostHp = true;
    ev.push({ k: 'hitPlayer', n: lost }, { k: 'text', s: `The light bounces back. You take ${reflect}.` });
    if (s.player.hp <= 0) { s.player.hp = 0; s.phase = 'lost'; ev.push({ k: 'text', s: 'Your print fails.' }); }
  }
  return d;
}

function wake(f: Foe, ev: BattleEv[], how: string) {
  f.asleep = false;
  f.intentIdx = 0;
  ev.push({ k: 'status', who: f.uid }, { k: 'text', s: `${NAME(f)} ${how}!` });
}

/** The Incinerator's last act: a blast that ignores plating, and it's gone. */
function explode(s: BattleState, f: Foe, ev: BattleEv[]) {
  const def = ENEMIES[f.id];
  let d = def.countdown!.blast + 2 * f.tier;
  if (f.weak > 0) d = Math.floor(d * 0.75);
  if (s.player.expose > 0) d = Math.floor(d * 1.5);
  ev.push({ k: 'act', uid: f.uid }, { k: 'text', s: `${NAME(f)} goes critical!` }, { k: 'strike', uid: f.uid, hits: 1 });
  const lost = hpLost(s.player.hp, d);
  s.player.hp -= d;
  s.lostHp = true;
  ev.push({ k: 'hitPlayer', n: lost }, { k: 'text', s: `The blast goes straight through your plating. You take ${d}.` });
  f.alive = false;
  f.fled = true;
  ev.push({ k: 'die', uid: f.uid });
}

/** HP a hit actually removes: overkill past zero doesn't count, so displays never bounce back up. */
function hpLost(hp: number, d: number): number {
  return Math.max(0, Math.min(d, hp));
}

function killFoe(s: BattleState, f: Foe, ev: BattleEv[]) {
  f.hp = 0;
  f.alive = false;
  s.kills += 1;
  ev.push({ k: 'die', uid: f.uid }, { k: 'text', s: `${NAME(f)} collapses!` });
  const burst = ENEMIES[f.id].deathRot;
  if (burst) {
    s.player.rot = (s.player.rot ?? 0) + burst;
    ev.push({ k: 'status', who: 'p' }, { k: 'text', s: `It bursts in a cloud of spores. Rot +${burst}.` });
  }
  if (ENEMIES[f.id].splits && !f.split) {
    for (let i = 0; i < 2 && aliveFoes(s).length < 4; i++) {
      const nf = makeFoe(f.id, f.tier, s.nextUid++, 1);
      nf.maxHp = nf.hp = Math.max(1, Math.ceil(f.maxHp / 2));
      nf.split = true;
      nf.sick = true;
      nf.intentIdx = f.intentIdx + 1;
      s.foes.push(nf);
      ev.push({ k: 'summon', uid: nf.uid });
    }
    ev.push({ k: 'text', s: `${NAME(f)} splits in two!` });
  }
  if (f.tag > 0 && s.triage > 0) {
    for (let i = 0; i < s.triage; i++) s.hand.push({ uid: s.nextUid++, id: 'clot', fleeting: true });
    ev.push({ k: 'text', s: `Triage prints ${s.triage} Clot Patch${s.triage > 1 ? 'es' : ''}.` });
  }
}

function checkPhase(_s: BattleState, f: Foe, ev: BattleEv[]) {
  const def = ENEMIES[f.id];
  if (def.phase2 && !f.phase2 && f.hp <= f.maxHp * def.phase2.below) {
    f.phase2 = true;
    f.intentIdx = 0;
    ev.push({ k: 'text', s: def.phase2.line });
  }
}

function healPlayer(s: BattleState, n: number, ev: BattleEv[]) {
  const before = s.player.hp;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + n);
  const got = s.player.hp - before;
  ev.push({ k: 'heal', n: got }, { k: 'text', s: `You mend ${got}.` });
}

function drawCards(s: BattleState, n: number, rng: Rng) {
  for (let i = 0; i < n; i++) {
    if (s.hand.length >= 10) return;
    if (!s.draw.length) {
      if (!s.discard.length) return;
      s.draw = rng.shuffle(s.discard);
      s.discard = [];
    }
    s.hand.push(s.draw.pop()!);
  }
}

function checkEnd(s: BattleState, ev: BattleEv[]) {
  if (s.phase !== 'player') return;
  if (!aliveFoes(s).length) {
    s.phase = 'won';
    ev.push({ k: 'text', s: 'Silence. You won.' });
  } else if (s.player.hp <= 0) {
    s.phase = 'lost';
    ev.push({ k: 'text', s: 'Your print fails.' });
  }
}

// ---- Turns ----

function startPlayerTurn(s: BattleState, rng: Rng, ev: BattleEv[], drawPenalty = 0) {
  const rot = s.player.rot ?? 0;
  if (rot > 0) {
    const lost = hpLost(s.player.hp, rot);
    s.player.hp -= rot;
    s.player.rot = rot - 1;
    s.lostHp = true;
    ev.push({ k: 'hitPlayer', n: lost }, { k: 'text', s: `Rot eats at you. −${rot}.` });
    if (s.player.hp <= 0) {
      s.player.hp = 0;
      s.phase = 'lost';
      ev.push({ k: 'text', s: 'Your print fails.' });
      return;
    }
  }
  s.turn += 1;
  s.turnPlays = 0;
  s.player.plate = s.player.keep;
  s.player.keep = 0;
  s.energy = energyPerTurn(effTraits(s)) + (s.turn === 1 ? s.mods.energyFirst : 0);
  for (const c of s.hand) {
    if (CARDS[c.id].dyn === 'unscarred') c.bonus = s.lostHp ? 0 : (c.bonus ?? 0) + 2;
  }
  s.lostHp = false;
  drawCards(s, Math.max(0, handSize(effTraits(s)) - drawPenalty + (s.turn === 1 ? s.mods.drawFirst : 0)), rng);
}

export function endTurn(s: BattleState, rng: Rng): BattleEv[] {
  const ev: BattleEv[] = [];
  if (s.phase !== 'player' || s.pending) return ev;
  const keep: CardInst[] = [];
  for (const c of s.hand) {
    if (hasKeyword(CARDS[c.id], 'hold')) keep.push(c);
    else if (c.fleeting) continue;
    else s.discard.push(c);
  }
  s.hand = keep;
  if (s.player.weak > 0) s.player.weak -= 1;
  for (const f of aliveFoes(s)) if (f.expose > 0) f.expose -= 1;
  s.noFlee = s.foes.some((f) => ENEMIES[f.id].rank);
  enemyTurn(s, rng, ev);
  checkEnd(s, ev);
  if (s.phase === 'player') startPlayerTurn(s, rng, ev);
  return ev;
}

export function currentIntent(f: Foe, s?: BattleState): Intent {
  const def = ENEMIES[f.id];
  const alone = !!s && def.soloPattern && !aliveFoes(s).some((o) => o !== f);
  const pat = alone ? def.soloPattern! : f.phase2 && def.phase2 ? def.phase2.pattern : def.pattern;
  return pat[f.intentIdx % pat.length];
}

/** Final numbers of a foe's next move, before your plating. */
export function intentNumbers(s: BattleState, f: Foe): { attack: number; hits: number; plate: number; weak: number; expose: number; strength: number; summon?: string; ally: number; healAlly: number; rot: number; drain: boolean; pierce: boolean; label: string } {
  const def: EnemyDef = ENEMIES[f.id];
  if (f.sick || f.asleep) return { label: f.asleep ? 'Asleep' : 'Summoned', attack: 0, hits: 1, plate: 0, weak: 0, expose: 0, strength: 0, ally: 0, healAlly: 0, rot: 0, drain: false, pierce: false };
  const it = currentIntent(f, s);
  let attack = 0;
  if (it.attack !== undefined) {
    attack = it.attack + def.might + f.tier + f.strength + (f.vet ?? 0);
    if (f.weak > 0) attack = Math.floor(attack * 0.75);
    if (s.player.expose > 0) attack = Math.floor(attack * 1.5);
  }
  const will = def.will + f.tier;
  return {
    label: it.label,
    attack,
    hits: it.hits ?? 1,
    plate: it.plate !== undefined ? it.plate + def.hide + Math.floor(f.tier / 2) : 0,
    weak: it.weak ? it.weak + Math.floor(will / 4) : 0,
    expose: it.expose ? it.expose + Math.floor(will / 4) : 0,
    strength: it.strength ?? 0,
    summon: it.summon,
    ally: it.allyStrength ?? 0,
    healAlly: it.healAlly ? it.healAlly + Math.floor(will / 2) : 0,
    rot: it.rot ? it.rot + Math.floor(will / 4) : 0,
    drain: !!it.drain,
    pierce: !!it.pierce,
  };
}

function enemyTurn(s: BattleState, rng: Rng, ev: BattleEv[]) {
  void rng;
  for (const f of aliveFoes(s)) if (!f.asleep) f.plate = 0;
  if (s.firstStrike) s.firstStrike = false;
  for (const f of [...aliveFoes(s)]) {
    if (s.phase !== 'player') break;
    if (!f.alive) continue;
    if (f.sick) {
      // summoning sickness: a creature that arrived mid-fight spends its first turn finding its feet
      f.sick = false;
      ev.push({ k: 'text', s: `${NAME(f)} is still finding its feet.` });
      continue;
    }
    const def = ENEMIES[f.id];
    if ((f.rot ?? 0) > 0) {
      const d = f.rot!;
      const lost = hpLost(f.hp, d);
      f.hp -= d;
      f.rot = d - 1;
      ev.push({ k: 'hitFoe', uid: f.uid, n: lost }, { k: 'text', s: `${NAME(f)} rots. −${d}.` });
      if (f.hp <= 0) { killFoe(s, f, ev); if (s.player.hp <= 0) break; continue; }
    }
    if (def.regen && f.hp < f.maxHp && !f.asleep) {
      const got = Math.min(def.regen + Math.floor(f.tier / 2), f.maxHp - f.hp);
      f.hp += got;
      ev.push({ k: 'healFoe', uid: f.uid, n: got }, { k: 'text', s: `${NAME(f)} grows back. +${got}.` });
    }
    if (f.asleep && def.sleeps) {
      f.slept = (f.slept ?? 0) + 1;
      if (f.slept >= def.sleeps.wakeAfter) wake(f, ev, 'stirs awake');
      else ev.push({ k: 'text', s: `${NAME(f)} sleeps behind the frost.` });
      continue;
    }
    if (def.countdown && (f.heat ?? 0) + 1 >= def.countdown.at) {
      explode(s, f, ev);
      if (s.player.hp <= 0) {
        s.player.hp = 0;
        s.phase = 'lost';
        ev.push({ k: 'text', s: 'Your print fails.' });
        return;
      }
      continue;
    }
    const n = intentNumbers(s, f);
    const it = currentIntent(f, s);
    ev.push({ k: 'act', uid: f.uid }, { k: 'text', s: `${NAME(f)} uses ${n.label.toUpperCase()}!` });
    if (it.line) ev.push({ k: 'text', s: it.line });
    if (n.plate) { f.plate += n.plate; ev.push({ k: 'plate', who: f.uid }); }
    if (n.strength) { f.strength += n.strength; ev.push({ k: 'text', s: `${NAME(f)} grows stronger.` }); }
    if (it.allyStrength) {
      for (const o of aliveFoes(s)) if (o !== f) o.strength += it.allyStrength;
      ev.push({ k: 'text', s: 'The others grow stronger.' });
    }
    if (n.healAlly) {
      const hurt = aliveFoes(s).filter((o) => o !== f && o.hp < o.maxHp).sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))[0];
      if (hurt) {
        const got = Math.min(n.healAlly, hurt.maxHp - hurt.hp);
        hurt.hp += got;
        ev.push({ k: 'healFoe', uid: hurt.uid, n: got }, { k: 'text', s: `${NAME(hurt)} is patched up. +${got}.` });
      } else ev.push({ k: 'text', s: 'Nothing to patch up.' });
    }
    if (n.weak) { s.player.weak += n.weak; ev.push({ k: 'status', who: 'p' }, { k: 'text', s: 'You are Weak.' }); }
    if (n.expose) { s.player.expose += n.expose; ev.push({ k: 'status', who: 'p' }, { k: 'text', s: 'You are Exposed.' }); }
    if (n.rot) { s.player.rot = (s.player.rot ?? 0) + n.rot; ev.push({ k: 'status', who: 'p' }, { k: 'text', s: `Rot takes hold. +${n.rot}.` }); }
    if (n.summon && aliveFoes(s).length < 3) {
      const nf = makeFoe(n.summon, f.tier, s.nextUid++, 1);
      nf.split = true;
      nf.sick = true;
      s.foes.push(nf);
      ev.push({ k: 'summon', uid: nf.uid }, { k: 'text', s: `${NAME(nf)} crawls out!` });
    }
    if (it.attack !== undefined) {
      ev.push({ k: 'strike', uid: f.uid, hits: n.hits });
      for (let h = 0; h < n.hits; h++) {
        const raw = n.attack;
        const d = n.pierce ? raw : Math.max(0, raw - s.player.plate);
        let lostNow = 0;
        if (raw > 0 && d === 0) s.stopped += 1;
        if (d > 0) {
          lostNow = hpLost(s.player.hp, d);
          s.player.hp -= d;
          s.lostHp = true;
          for (const c of s.hand) if (CARDS[c.id].dyn === 'scartissue') s.surge.mgt += 1;
        }
        ev.push({ k: 'hitPlayer', n: lostNow }, { k: 'text', s: d > 0 ? `You take ${d}.${n.pierce && s.player.plate > 0 ? ' Straight through your plating.' : ''}` : 'Your plating holds.' });
        if (n.drain && lostNow > 0 && f.hp < f.maxHp) {
          const got = Math.min(lostNow, f.maxHp - f.hp);
          f.hp += got;
          ev.push({ k: 'healFoe', uid: f.uid, n: got }, { k: 'text', s: `${NAME(f)} drinks. +${got}.` });
        }
        if (s.player.hp <= 0) break;
        if (d > 0 && s.mods.thorns && f.alive) {
          const lost = hpLost(f.hp, s.mods.thorns);
          f.hp -= s.mods.thorns;
          ev.push({ k: 'hitFoe', uid: f.uid, n: lost }, { k: 'text', s: `Thorns: ${NAME(f)} takes ${s.mods.thorns}.` });
          if (f.hp <= 0) { killFoe(s, f, ev); break; }
        }
      }
    }
    f.intentIdx += 1;
    if (def.countdown && f.alive) {
      f.heat = (f.heat ?? 0) + 1;
      ev.push({ k: 'text', s: `${NAME(f)} heats up. ${def.countdown.at - f.heat} to go.` });
    }
    if (def.fleesAfter && f.alive) {
      f.acted = (f.acted ?? 0) + 1;
      if (f.acted >= def.fleesAfter) {
        f.alive = false;
        f.fled = true;
        ev.push({ k: 'die', uid: f.uid }, { k: 'text', s: `${NAME(f)} bolts into the vents!` });
      }
    }
    if (s.player.hp <= 0) {
      s.player.hp = 0;
      s.phase = 'lost';
      ev.push({ k: 'text', s: 'Your print fails.' });
      return;
    }
    void def;
  }
  for (const f of aliveFoes(s)) if (f.weak > 0) f.weak -= 1;
  if (s.player.expose > 0) s.player.expose -= 1;
}

export function fleeChance(s: BattleState): number {
  const sp = Math.max(...aliveFoes(s).map((f) => ENEMIES[f.id].speed + f.tier));
  return Math.max(0.1, Math.min(0.95, 0.4 + s.mods.fleeBonus + 0.05 * (effTraits(s).rfx - sp)));
}

export function canFlee(s: BattleState): boolean {
  return s.phase === 'player' && !s.noFlee && !s.pending;
}

export function flee(s: BattleState, rng: Rng): BattleEv[] {
  const ev: BattleEv[] = [];
  if (!canFlee(s)) return ev;
  if (rng.next() < fleeChance(s)) {
    s.phase = 'fled';
    ev.push({ k: 'text', s: 'You got away!' });
    return ev;
  }
  ev.push({ k: 'text', s: 'Can’t escape!' });
  for (const c of s.hand) if (!hasKeyword(CARDS[c.id], 'hold') && !c.fleeting) s.discard.push(c);
  s.hand = s.hand.filter((c) => hasKeyword(CARDS[c.id], 'hold'));
  enemyTurn(s, rng, ev);
  checkEnd(s, ev);
  if (s.phase === 'player') startPlayerTurn(s, rng, ev);
  return ev;
}

// ---- Autoplay (tests and balance sims) ----

/** A simple greedy player: guard when the hit is big, else kill the weakest. */
export function botTurn(s: BattleState, rng: Rng): void {
  let guard = 30;
  while (s.phase === 'player' && guard-- > 0) {
    if (s.pending) {
      const pick = [...s.hand].sort((a, b) => score(s, b) - score(s, a))[0];
      const choice = s.pending.kind === 'donor' ? pick : [...s.hand].sort((a, b) => score(s, a) - score(s, b))[0];
      pickHand(s, choice.uid, weakest(s)?.uid, rng);
      continue;
    }
    const incoming = aliveFoes(s).reduce((a, f) => {
      const n = intentNumbers(s, f);
      return a + Math.max(0, n.attack - s.player.plate) * n.hits;
    }, 0);
    const opts = s.hand.filter((c) => playable(s, c).ok);
    if (!opts.length) break;
    const needGuard = incoming >= 6 && s.player.hp < s.player.maxHp * 0.8;
    const lowHp = s.player.hp < s.player.maxHp * 0.45;
    const best = opts.sort((a, b) => value(s, b, needGuard, lowHp) - value(s, a, needGuard, lowHp))[0];
    if (value(s, best, needGuard, lowHp) <= 0) break;
    playCard(s, best.uid, weakest(s)?.uid, rng);
  }
  if (s.phase === 'player' && !s.pending) endTurn(s, rng);
}

function weakest(s: BattleState): Foe | undefined {
  return aliveFoes(s).sort((a, b) => a.hp - b.hp)[0];
}

function score(s: BattleState, c: CardInst): number {
  const r = resolved(s, c);
  let v = 0;
  for (const e of r.fx) {
    if (e.op === 'dmg') v += e.v * (e.hits ?? 1) * (e.aoe ? aliveFoes(s).length : 1);
    if (e.op === 'plate') v += e.v * 0.8;
  }
  return v;
}

function value(s: BattleState, c: CardInst, guard: boolean, low: boolean): number {
  const def: CardDef = CARDS[c.id];
  const r = resolved(s, c);
  const b = cardBonus(s, c);
  let v = 0;
  for (const e of r.fx) {
    switch (e.op) {
      case 'dmg': v += (e.v + b.dmg) * (e.hits ?? 1) * (e.aoe ? aliveFoes(s).length : 1); break;
      case 'plate': v += (e.v + b.plate) * (guard ? 1.4 : 0.3); break;
      case 'heal': v += low ? e.v * 1.5 : def.medic ? -1 : e.v * 0.3; break;
      case 'draw': v += e.v * 3; break;
      case 'energy': v += e.v * 4; break;
      case 'weak': case 'expose': v += e.v * 2; break;
      case 'rot': v += e.v * 1.6 * (e.aoe ? aliveFoes(s).length : 1); break;
      case 'healPerRot': v += low ? e.v * aliveFoes(s).reduce((a, f) => a + (f.rot ?? 0), 0) * 1.5 : 0; break;
      case 'tag': v += 1; break;
      case 'donor': case 'cannibal': v += s.hand.length > 1 ? 3 : 0; break;
      case 'surge': v += 3; break;
      default: v += 1;
    }
  }
  if (def.keywords?.includes('hold') && def.dyn === 'unscarred' && !guard) v *= 0.8;
  return v / Math.max(0.6, r.cost);
}
