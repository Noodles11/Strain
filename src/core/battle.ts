import { CARDS, hasKeyword, resolveCard, type CardDef, type Effect, type ResolvedCard } from './cards';
import { ENEMIES, type EnemyDef, type Intent } from './enemies';
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
}

export interface BattlePlayer {
  hp: number;
  maxHp: number;
  plate: number;
  /** Plating that survives the next turn start. */
  keep: number;
  weak: number;
  expose: number;
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
  | { k: 'status'; who: 'p' | number };

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
}

export interface BattleSetup {
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
}

const NAME = (f: Foe) => ENEMIES[f.id].name.toUpperCase();

export function effTraits(s: BattleState): Traits {
  return addTraits(s.base, s.surge);
}

export function makeFoe(id: string, tier: number, uid: number, hpMul: number): Foe {
  const def = ENEMIES[id];
  const hp = Math.round(def.hp * hpMul);
  return { uid, id, hp, maxHp: hp, plate: 0, strength: 0, weak: 0, expose: 0, tag: 0, intentIdx: 0, alive: true, phase2: false, tier };
}

export function startBattle(setup: BattleSetup, rng: Rng, tierBonus: number, hpMul: number): { s: BattleState; ev: BattleEv[] } {
  let uid = 1000;
  const foes = setup.foes.map((id) => {
    const f = makeFoe(id, tierBonus, uid++, hpMul);
    f.expose = setup.exposeStart ?? 0;
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
  };
  const ev: BattleEv[] = [];
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

export function playable(s: BattleState, c: CardInst): { ok: boolean; why?: string } {
  if (s.phase !== 'player' || s.pending) return { ok: false };
  const r = resolved(s, c);
  if (r.cost > s.energy) return { ok: false, why: 'Not enough energy' };
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
  s.energy -= r.cost;
  s.biomass -= r.bioCost;
  s.hand.splice(idx, 1);
  ev.push({ k: 'text', s: `You use ${def.name.toUpperCase()}!` });

  const emp = s.empower;
  s.empower = 0;
  const fx = r.fx.map((e) => ({ ...e }));
  for (const e of fx) {
    if (e.op === 'dmg') e.v += bonus.dmg + emp;
    if (e.op === 'plate') e.v += bonus.plate;
  }

  const pickIdx = fx.findIndex((e) => e.op === 'donor' || e.op === 'cannibal');
  if (pickIdx >= 0 && s.hand.length > 0) {
    const op = fx[pickIdx].op as 'donor' | 'cannibal';
    s.pending = { kind: op, uid: card.uid, rest: fx.slice(pickIdx + 1), card };
    runFx(s, fx.slice(0, pickIdx), card, targetUid, rng, ev);
    ev.push({ k: 'text', s: op === 'donor' ? 'Choose a card to feed.' : 'Choose a card to eat.' });
    return ev;
  }
  runFx(s, fx.filter((e) => e.op !== 'donor' && e.op !== 'cannibal'), card, targetUid, rng, ev);
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
  d = Math.max(0, d - f.plate);
  f.hp -= d;
  ev.push({ k: 'hitFoe', uid: f.uid, n: d }, { k: 'text', s: d > 0 ? `${NAME(f)} takes ${d}.` : `${NAME(f)}'s plating holds.` });
  if (f.hp <= 0) killFoe(s, f, ev);
  else checkPhase(s, f, ev);
  return d;
}

function killFoe(s: BattleState, f: Foe, ev: BattleEv[]) {
  f.hp = 0;
  f.alive = false;
  s.kills += 1;
  ev.push({ k: 'die', uid: f.uid }, { k: 'text', s: `${NAME(f)} collapses!` });
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

function startPlayerTurn(s: BattleState, rng: Rng, _ev: BattleEv[], drawPenalty = 0) {
  s.turn += 1;
  s.player.plate = s.player.keep;
  s.player.keep = 0;
  s.energy = energyPerTurn(effTraits(s));
  for (const c of s.hand) {
    if (CARDS[c.id].dyn === 'unscarred') c.bonus = s.lostHp ? 0 : (c.bonus ?? 0) + 2;
  }
  s.lostHp = false;
  drawCards(s, Math.max(0, handSize(effTraits(s)) - drawPenalty), rng);
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
  if (s.phase === 'player') startPlayerTurn(s, rng, ev);
  return ev;
}

export function currentIntent(f: Foe): Intent {
  const def = ENEMIES[f.id];
  const pat = f.phase2 && def.phase2 ? def.phase2.pattern : def.pattern;
  return pat[f.intentIdx % pat.length];
}

/** Final numbers of a foe's next move, before your plating. */
export function intentNumbers(s: BattleState, f: Foe): { attack: number; hits: number; plate: number; weak: number; expose: number; strength: number; summon?: string; label: string } {
  const def: EnemyDef = ENEMIES[f.id];
  const it = currentIntent(f);
  let attack = 0;
  if (it.attack !== undefined) {
    attack = it.attack + def.might + f.tier + f.strength;
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
  };
}

function enemyTurn(s: BattleState, rng: Rng, ev: BattleEv[]) {
  void rng;
  for (const f of aliveFoes(s)) f.plate = 0;
  if (s.firstStrike) s.firstStrike = false;
  for (const f of [...aliveFoes(s)]) {
    if (s.phase !== 'player') break;
    if (!f.alive) continue;
    const def = ENEMIES[f.id];
    const n = intentNumbers(s, f);
    const it = currentIntent(f);
    ev.push({ k: 'act', uid: f.uid }, { k: 'text', s: `${NAME(f)} uses ${n.label.toUpperCase()}!` });
    if (it.line) ev.push({ k: 'text', s: it.line });
    if (n.plate) { f.plate += n.plate; ev.push({ k: 'plate', who: f.uid }); }
    if (n.strength) { f.strength += n.strength; ev.push({ k: 'text', s: `${NAME(f)} grows stronger.` }); }
    if (n.weak) { s.player.weak += n.weak; ev.push({ k: 'status', who: 'p' }, { k: 'text', s: 'You are Weak.' }); }
    if (n.expose) { s.player.expose += n.expose; ev.push({ k: 'status', who: 'p' }, { k: 'text', s: 'You are Exposed.' }); }
    if (n.summon && aliveFoes(s).length < 3) {
      const nf = makeFoe(n.summon, f.tier, s.nextUid++, 1);
      s.foes.push(nf);
      ev.push({ k: 'summon', uid: nf.uid }, { k: 'text', s: `${NAME(nf)} crawls out!` });
    }
    if (it.attack !== undefined) {
      for (let h = 0; h < n.hits; h++) {
        const raw = n.attack;
        const d = Math.max(0, raw - s.player.plate);
        if (raw > 0 && d === 0) s.stopped += 1;
        if (d > 0) {
          s.player.hp -= d;
          s.lostHp = true;
          for (const c of s.hand) if (CARDS[c.id].dyn === 'scartissue') s.surge.mgt += 1;
        }
        ev.push({ k: 'hitPlayer', n: d }, { k: 'text', s: d > 0 ? `You take ${d}.` : 'Your plating holds.' });
        if (s.player.hp <= 0) break;
      }
    }
    f.intentIdx += 1;
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
  return Math.max(0.1, Math.min(0.95, 0.4 + 0.05 * (effTraits(s).rfx - sp)));
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
      case 'tag': v += 1; break;
      case 'donor': case 'cannibal': v += s.hand.length > 1 ? 3 : 0; break;
      case 'surge': v += 3; break;
      default: v += 1;
    }
  }
  if (def.keywords?.includes('hold') && def.dyn === 'unscarred' && !guard) v *= 0.8;
  return v / Math.max(0.6, r.cost);
}
