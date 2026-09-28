import { describe, expect, it } from 'vitest';
import { intentNumbers, startBattle, type CardInst } from '../src/core/battle';
import { rollForm, veteran } from '../src/core/enemies';
import { newMeta, settleRun } from '../src/core/meta';
import { Rng } from '../src/core/rng';
import { actionsAt, doAction, newRun } from '../src/core/run';
import { traits } from '../src/core/traits';

const deck: CardInst[] = [{ uid: 1, id: 'scalpel' }];
const setup = (slain?: Record<string, number>, vary = false) => ({
  foes: ['husk'], tier: 1, deck, traits: traits(5), hp: 60, maxHp: 60, biomass: 0, consumedRun: 0, firstStrike: true, slain, vary,
});

describe('veteran mobs', () => {
  it('scale slowly with kills and level off', () => {
    expect(veteran(0)).toEqual({ hp: 1, atk: 0 });
    expect(veteran(20).hp).toBeCloseTo(1.15, 2);
    expect(veteran(40).atk).toBe(1);
    expect(veteran(160).atk).toBe(2);
    expect(veteran(100000).hp).toBeLessThan(1.6);
  });

  it('get more HP and hit harder in battle', () => {
    const fresh = startBattle(setup(), new Rng(1), 0, 1).s.foes[0];
    const vet = startBattle(setup({ husk: 160 }), new Rng(1), 0, 1).s;
    const f = vet.foes[0];
    expect(f.maxHp).toBeGreaterThan(fresh.maxHp * 1.3);
    expect(f.vet).toBe(2);
    const base = startBattle(setup(), new Rng(1), 0, 1).s;
    const it0 = intentNumbers(base, base.foes[0]);
    if (it0.attack) expect(intentNumbers(vet, f).attack).toBe(it0.attack + 2);
  });

  it('vary: some faint, some hulking, most near the norm', () => {
    expect(rollForm(0.05, 0.5, false).form).toBe('faint');
    expect(rollForm(0.95, 0.5, false).form).toBe('hulking');
    expect(rollForm(0.5, 0.5, false).form).toBeUndefined();
    expect(rollForm(0.05, 0.5, true).form).toBeUndefined();
    const hps = new Set<number>();
    const forms = new Set<string>();
    for (let s = 1; s < 80; s++) {
      const f = startBattle(setup(undefined, true), new Rng(s), 0, 1).s.foes[0];
      hps.add(f.maxHp);
      if (f.form) forms.add(f.form);
    }
    expect(hps.size).toBeGreaterThan(5);
    expect(forms).toEqual(new Set(['faint', 'hulking']));
  });

  it('kills bank into the meta tally', () => {
    const m = newMeta();
    settleRun(m, 0, 'dead', [], [], [], { tick: 3 });
    settleRun(m, 0, 'dead', [], [], [], { tick: 2, husk: 1 });
    expect(m.slain).toEqual({ tick: 5, husk: 1 });
    expect(newRun(m, 3).slainBefore.tick).toBe(5);
  });
});

describe('empty vats', () => {
  it('every map has one, and it sells permanent sequence levels', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = newRun(newMeta(), seed);
      expect(r.world.pois.some((p) => p.kind === 'vat')).toBe(true);
    }
    const meta = newMeta();
    meta.codons = 20;
    const r = newRun(meta, 2);
    r.codons = 4;
    const vat = r.world.pois.find((p) => p.kind === 'vat')!;
    r.x = vat.x;
    r.y = vat.y + (r.world.tiles[vat.x + (vat.y + 1) * r.world.w] ? 1 : -1);
    const acts = actionsAt(r, vat.x, vat.y);
    const a = acts.find((q) => q.id === 'seq:mgt')!;
    expect(a.detail).toBe('15 Codons');
    const hp0 = r.hp;
    expect(doAction(r, vat.x, vat.y, 'seq:hde')).toBe(true);
    expect(r.seq.hde).toBe(4);
    expect(r.codons).toBe(0);
    expect(r.bank).toBe(9);
    expect(r.bankSpent).toBe(11);
    expect(r.hp).toBeGreaterThan(hp0);
  });
});
