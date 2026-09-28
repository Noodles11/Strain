import { describe, expect, it } from 'vitest';
import { endTurn, intentNumbers, playCard, startBattle, type CardInst } from '../src/core/battle';
import { newMeta } from '../src/core/meta';
import { Rng } from '../src/core/rng';
import { chartOptions, land, newRun } from '../src/core/run';
import { traits } from '../src/core/traits';
import { generateWorld, reachable } from '../src/world/gen';

const deckOf = (...ids: string[]): CardInst[] => ids.map((id, i) => ({ uid: i + 1, id }));
const setup = (foes: string[], deck: CardInst[], resonance = false) => startBattle({
  foes, tier: 2, deck, traits: traits(5), hp: 60, maxHp: 60, biomass: 0, consumedRun: 0, firstStrike: true,
  mods: { firstCardFree: false, thorns: 0, tagStart: 0, energyFirst: 0, drawFirst: 0, fleeBonus: 0, resonance },
}, new Rng(3), 2, 1.5);

describe('Kessra', () => {
  it('maps generate with Kessra mobs and a reachable Prism Mother', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const w = generateWorld(seed, 2, 'kessra');
      const boss = w.mobs.find((m) => m.kind === 'boss')!;
      expect(boss.foes).toEqual(['prism']);
      expect(reachable(w, w.ship, boss, (g) => g.forcible)).toBe(true);
      expect(w.w).toBe(52);
    }
  });

  it('shardlings split once into two halves', () => {
    const { s } = setup(['shardling'], deckOf('hunger', 'hunger', 'hunger', 'hunger', 'hunger'));
    const rng = new Rng(9);
    s.foes[0].hp = 3;
    playCard(s, s.hand[0].uid, undefined, rng);
    const alive = s.foes.filter((f) => f.alive);
    expect(alive.length).toBe(2);
    expect(alive.every((f) => f.split && f.maxHp === Math.ceil(s.foes[0].maxHp / 2))).toBe(true);
    // halves don't split again
    s.energy = 5;
    alive[0].hp = 1;
    playCard(s, s.hand[0].uid, alive[0].uid, rng);
    expect(s.foes.filter((f) => f.alive).length).toBe(1);
  });

  it('resonance makes every third card resolve twice', () => {
    const { s } = setup(['crawler'], deckOf('brace', 'brace', 'brace', 'brace', 'brace'), true);
    s.energy = 5;
    const rng = new Rng(2);
    for (let i = 0; i < 3; i++) playCard(s, s.hand[0].uid, undefined, rng);
    // Brace at Hide 5 plates 7; the third one twice
    expect(s.player.plate).toBe(7 * 4);
  });

  it('Refractor reflects while plated; Shatter strips plating', () => {
    const { s } = setup(['refractor'], deckOf('shatter', 'scalpel', 'scalpel', 'scalpel', 'scalpel'));
    const rng = new Rng(4);
    endTurn(s, rng); // it polishes: plating up
    const f = s.foes[0];
    expect(f.plate).toBeGreaterThan(0);
    const hp = s.player.hp;
    const sc = s.hand.find((c) => c.id === 'scalpel');
    if (sc) { playCard(s, sc.uid, undefined, rng); expect(s.player.hp).toBeLessThan(hp); }
    const sh = s.hand.find((c) => c.id === 'shatter');
    if (sh && s.energy >= 2) { playCard(s, sh.uid, undefined, rng); expect(f.plate).toBe(0); }
  });

  it('the star chart opens after the Derelict boss and landing 2 is tier 2', () => {
    const r = newRun(newMeta(), 12);
    expect(chartOptions(r).find((o) => o.id === 'kessra')!.state).toBe('unknown');
    r.bossDead = true;
    r.revealed.push('kessra');
    r.mode = 'chart';
    expect(land(r, 'kessra')).toBe(true);
    expect(r.world.tier).toBe(2);
    expect(r.planet).toBe('kessra');
    expect(chartOptions(r).find((o) => o.id === 'kessra')!.state).toBe('visited');
    expect(chartOptions(r).find((o) => o.id === 'mireth')!.state).toBe('lost');
  });
});

describe('damage events', () => {
  it('report only the HP actually lost, so a display rewound from the result never rises', () => {
    const { s } = setup(['tick'], deckOf('hunger', 'hunger', 'hunger', 'hunger', 'hunger'));
    const f = s.foes[0];
    f.hp = 3;
    const ev = playCard(s, s.hand[0].uid, f.uid, new Rng(1));
    const hits = ev.filter((e) => e.k === 'hitFoe' && e.uid === f.uid);
    const total = hits.reduce((a, e) => a + (e.k === 'hitFoe' ? e.n : 0), 0);
    expect(total).toBe(3);
    expect(f.hp).toBe(0);
  });
});

describe('summoning sickness', () => {
  it('split halves skip their first enemy turn, then attack as normal', () => {
    const { s } = setup(['shardling'], deckOf('hunger', 'hunger', 'hunger', 'hunger', 'hunger'));
    const rng = new Rng(9);
    s.foes[0].hp = 3;
    playCard(s, s.hand[0].uid, undefined, rng);
    const halves = s.foes.filter((f) => f.alive);
    expect(halves.every((f) => f.sick)).toBe(true);
    expect(intentNumbers(s, halves[0]).attack).toBe(0);
    s.player.plate = 0;
    const hp = s.player.hp;
    endTurn(s, rng);
    expect(s.player.hp).toBe(hp);
    expect(halves.every((f) => !f.sick)).toBe(true);
    s.player.plate = 0;
    s.player.keep = 0;
    const hp2 = s.player.hp;
    endTurn(s, rng);
    expect(s.player.hp).toBeLessThan(hp2);
  });

  it('a creature summoned by a boss waits a turn before acting', () => {
    const { s } = setup(['prism'], deckOf('brace', 'brace', 'brace', 'brace', 'brace'));
    const rng = new Rng(5);
    const boss = s.foes[0];
    boss.phase2 = true;
    boss.intentIdx = 0; // Shed: summons a Shardling
    endTurn(s, rng);
    const pup = s.foes.find((f) => f.id === 'shardling')!;
    expect(pup.sick).toBe(true);
    endTurn(s, rng);
    expect(pup.sick).toBe(false);
  });
});
