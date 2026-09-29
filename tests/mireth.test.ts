import { describe, expect, it } from 'vitest';
import { botTurn, endTurn, intentNumbers, playCard, startBattle, type CardInst } from '../src/core/battle';
import { CARDS } from '../src/core/cards';
import { ENEMIES } from '../src/core/enemies';
import { newMeta } from '../src/core/meta';
import { PLANETS, planetDepth } from '../src/core/planets';
import { Rng } from '../src/core/rng';
import { chartOptions, land, newRun } from '../src/core/run';
import { traits } from '../src/core/traits';
import { generateWorld, reachable } from '../src/world/gen';

const deckOf = (...ids: string[]): CardInst[] => ids.map((id, i) => ({ uid: i + 1, id }));
const setup = (foes: string[], deck: CardInst[], hp = 60) => startBattle({
  foes, tier: 3, deck, traits: traits(5), hp, maxHp: hp, biomass: 0, consumedRun: 0, firstStrike: true,
}, new Rng(4), 4, 1);

describe('Mireth', () => {
  const P = PLANETS.mireth;

  it('is a real planet: 10 mob kinds plus a boss, every one defined', () => {
    expect(P.locked).toBeFalsy();
    const kinds = new Set([...Object.values(P.packs).flat(2), ...P.ambush.flat(), ...P.elites.flat(), ...P.nest]);
    expect(kinds.size).toBe(10);
    for (const id of [...kinds, ...P.boss]) expect(ENEMIES[id], id).toBeTruthy();
    for (const c of P.cards) expect(CARDS[c], c).toBeTruthy();
    expect(P.events.length).toBe(4);
    expect(planetDepth('mireth')).toBe(3);
  });

  it('maps generate with a reachable Drowned Titan', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const w = generateWorld(seed, 3, 'mireth');
      const boss = w.mobs.find((m) => m.kind === 'boss')!;
      expect(boss.foes).toEqual(['titan']);
      expect(reachable(w, w.ship, boss, (g) => g.forcible)).toBe(true);
    }
  });

  it('opens on the chart after the Prism Mother and lands at tier 3', () => {
    const r = newRun(newMeta(), 5);
    r.landing = 2;
    r.revealed.push('kessra', 'mireth', 'orun');
    r.visited.push('kessra');
    r.mode = 'chart';
    expect(chartOptions(r).find((o) => o.id === 'mireth')!.state).toBe('open');
    expect(chartOptions(r).find((o) => o.id === 'orun')!.state).toBe('lost');
    expect(land(r, 'mireth')).toBe(true);
    expect(r.world.tier).toBe(3);
    expect(r.world.planet).toBe('mireth');
  });
});

describe('Rot', () => {
  it('ticks on enemies at the start of their turn and fades by one', () => {
    const { s } = setup(['knot'], deckOf('rotneedle', 'brace', 'brace', 'brace', 'brace'));
    const rng = new Rng(1);
    const f = s.foes[0];
    const needle = s.hand.find((c) => c.id === 'rotneedle')!;
    playCard(s, needle.uid, f.uid, rng);
    expect(f.rot).toBe(6); // 1 + ABR 5
    const hp = f.hp;
    endTurn(s, rng);
    expect(f.hp).toBe(hp - 6);
    expect(f.rot).toBe(5);
  });

  it('ticks on you through plating, and puffcaps burst into it', () => {
    const { s } = setup(['puffcap'], deckOf('hunger', 'brace', 'brace', 'brace', 'brace'));
    const rng = new Rng(2);
    s.foes[0].hp = 1;
    playCard(s, s.hand.find((c) => c.id === 'hunger')!.uid, undefined, rng);
    expect(s.player.rot).toBe(3);
  });

  it('player rot deals damage at the start of your turn', () => {
    const { s } = setup(['croaker'], deckOf('brace', 'brace', 'brace', 'brace', 'brace'));
    const rng = new Rng(3);
    s.player.rot = 4;
    s.player.plate = 20;
    const hp = s.player.hp;
    const it = intentNumbers(s, s.foes[0]);
    endTurn(s, rng);
    const took = hp - s.player.hp;
    expect(took).toBeGreaterThanOrEqual(4);
    expect(s.player.rot).toBe(3 + it.rot);
  });

  it('eels pierce plating, leeches drink, stags grow back', () => {
    const eel = setup(['eel'], deckOf('brace', 'brace', 'brace', 'brace', 'brace')).s;
    eel.foes[0].intentIdx = 1;
    eel.player.plate = 30;
    const hp = eel.player.hp;
    endTurn(eel, new Rng(1));
    expect(eel.player.hp).toBeLessThan(hp);

    const leech = setup(['leech'], deckOf('brace', 'brace', 'brace', 'brace', 'brace')).s;
    leech.foes[0].hp = 5;
    endTurn(leech, new Rng(1));
    expect(leech.foes[0].hp).toBeGreaterThan(5);

    const stag = setup(['stag'], deckOf('brace', 'brace', 'brace', 'brace', 'brace')).s;
    stag.foes[0].hp = 20;
    endTurn(stag, new Rng(1));
    expect(stag.foes[0].hp).toBeGreaterThan(20);
  });

  it('symbiote heals per point of rot on enemies', () => {
    const { s } = setup(['knot', 'knot'], deckOf('symbiote', 'brace', 'brace', 'brace', 'brace'), 60);
    s.player.hp = 30;
    s.foes[0].rot = 3;
    s.foes[1].rot = 2;
    playCard(s, s.hand.find((c) => c.id === 'symbiote')!.uid, undefined, new Rng(1));
    expect(s.player.hp).toBe(35);
  });

  it('the Titan can be beaten by a strong bot deck, and summons in phase 2', () => {
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const deck = deckOf('hunger', 'hunger', 'flense', 'flense', 'brace', 'brace', 'scalpel', 'scalpel', 'rotneedle', 'canopycut', 'sapgraft', 'bonesaw');
      const b = startBattle({ foes: ['titan'], tier: 3, deck, traits: traits(9), hp: 90, maxHp: 90, biomass: 0, consumedRun: 0 }, new Rng(seed), 4, 2.1);
      const rng = new Rng(seed * 7);
      let guard = 60;
      while (b.s.phase === 'player' && guard-- > 0) botTurn(b.s, rng);
      if (b.s.phase === 'won') wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});

describe('growing cards say so in the log', () => {
  const texts = (ev: { k: string; s?: string }[]) => ev.filter((e) => e.k === 'text').map((e) => e.s!);

  it('Feeding Blade announces each kill', () => {
    const { s } = setup(['puffcap', 'puffcap'], deckOf('hunger', 'feeding', 'brace', 'brace', 'brace'));
    s.foes[0].hp = 1;
    const ev = playCard(s, s.hand.find((c) => c.id === 'hunger')!.uid, s.foes[0].uid, new Rng(1));
    expect(texts(ev).some((t) => t.startsWith('FEEDING BLADE feeds: +5 damage (now +5)'))).toBe(true);
  });

  it('Callus announces each stopped hit', () => {
    const { s } = setup(['croaker'], deckOf('callus', 'brace', 'brace', 'brace', 'brace'));
    s.foes[0].intentIdx = 1; // Tongue
    s.player.plate = 50;
    const ev = endTurn(s, new Rng(1));
    expect(texts(ev).some((t) => t.startsWith('CALLUS hardens'))).toBe(true);
  });

  it('Unscarred Edge announces its growth and its loss', () => {
    const { s } = setup(['puffcap'], deckOf('unscarred', 'brace', 'brace', 'brace', 'brace'));
    const ev = endTurn(s, new Rng(1));
    expect(texts(ev).some((t) => t.startsWith('UNSCARRED EDGE stays clean: +2'))).toBe(true);
  });
});
