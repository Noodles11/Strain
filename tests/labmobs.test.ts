import { describe, expect, it } from 'vitest';
import { endTurn, intentNumbers, playCard, startBattle, type CardInst } from '../src/core/battle';
import { Rng } from '../src/core/rng';
import { traits } from '../src/core/traits';

const deckOf = (...ids: string[]): CardInst[] => ids.map((id, i) => ({ uid: i + 1, id }));
const fight = (foes: string[], deck = deckOf('brace', 'brace', 'brace', 'brace', 'brace'), ambush = false) => startBattle({
  foes, tier: 1, deck, traits: traits(3), hp: 60, maxHp: 60, biomass: 0, consumedRun: 0, firstStrike: !ambush, ambush,
}, new Rng(2), 0, 1).s;

describe('new lab mobs', () => {
  it('Drip Stand heals the most hurt ally, and pokes when alone', () => {
    const s = fight(['drip', 'husk']);
    const husk = s.foes[1];
    husk.hp -= 10;
    endTurn(s, new Rng(1));
    expect(husk.hp).toBeGreaterThan(husk.maxHp - 10);
    husk.alive = false;
    expect(intentNumbers(s, s.foes[0]).attack).toBeGreaterThan(0);
  });

  it('Test Subject flees after two turns and leaves no corpse', () => {
    const s = fight(['subject']);
    const rng = new Rng(3);
    endTurn(s, rng);
    expect(s.foes[0].alive).toBe(true);
    endTurn(s, rng);
    expect(s.foes[0].fled).toBe(true);
    expect(s.phase).toBe('won');
  });

  it('Cryo Sleeper sleeps behind plating, then wakes after three rounds', () => {
    const s = fight(['sleeper']);
    const rng = new Rng(4);
    const f = s.foes[0];
    expect(f.asleep).toBe(true);
    expect(f.plate).toBeGreaterThan(0);
    const hp = s.player.hp;
    endTurn(s, rng); endTurn(s, rng);
    expect(f.asleep).toBe(true);
    expect(s.player.hp).toBe(hp);
    endTurn(s, rng);
    expect(f.asleep).toBe(false);
  });

  it('Cryo Sleeper wakes early when cut below half', () => {
    const s = fight(['sleeper'], deckOf('hunger', 'hunger', 'hunger', 'hunger', 'hunger'));
    const f = s.foes[0];
    f.hp = Math.ceil(f.maxHp / 2) + 2;
    playCard(s, s.hand[0].uid, f.uid, new Rng(5));
    expect(f.asleep).toBe(false);
  });

  it('an ambushing Sleeper is awake from the start', () => {
    const s = fight(['sleeper'], undefined, true);
    expect(s.foes[0].asleep).toBe(false);
  });

  it('Incinerator explodes on its fourth turn, through plating, and is gone', () => {
    const s = fight(['incinerator']);
    const rng = new Rng(6);
    for (let i = 0; i < 3; i++) endTurn(s, rng);
    expect(s.foes[0].alive).toBe(true);
    s.player.plate = 50;
    s.player.keep = 50;
    const hp = s.player.hp;
    endTurn(s, rng);
    expect(s.foes[0].fled).toBe(true);
    expect(s.player.hp).toBe(hp - 20); // tier 0 in this harness: blast 20 + 2·tier
  });
});
