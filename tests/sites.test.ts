import { describe, expect, it } from 'vitest';
import { newMeta, settleRun } from '../src/core/meta';
import { actionsAt, addImplant, doAction, excise, exciseCost, maxHp, newRun, runTraits, type RunState } from '../src/core/run';
import { startBattle, playCard, endTurn } from '../src/core/battle';
import { Rng } from '../src/core/rng';
import { traits } from '../src/core/traits';
import type { Poi } from '../src/world/gen';

function standBeside(r: RunState, p: Poi) {
  r.x = p.x - 1; r.y = p.y;
  r.world.tiles[r.y * r.world.w + r.x] = 1;
}

describe('upgrade sites', () => {
  it('every map has a pod, a terminal, a surgery bay and events', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = newRun(newMeta(), seed);
      for (const k of ['pod', 'terminal', 'surgery']) expect(r.world.pois.some((p) => p.kind === k)).toBe(true);
      expect(r.world.pois.filter((p) => p.kind === 'event').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('a splice pod raises a trait for the run, and the price climbs', () => {
    const r = newRun(newMeta(), 3);
    const pod = r.world.pois.find((p) => p.kind === 'pod')!;
    standBeside(r, pod);
    r.biomass = 40;
    const k = pod.offer![0];
    const before = runTraits(r)[k as 'mgt'];
    const a1 = actionsAt(r, pod.x, pod.y).find((a) => a.id === `splice:${k}`)!;
    expect(a1.detail).toContain('6');
    doAction(r, pod.x, pod.y, a1.id);
    expect(runTraits(r)[k as 'mgt']).toBe(before + 1);
    expect(r.biomass).toBe(34);
    expect(actionsAt(r, pod.x, pod.y).find((a) => a.id === `splice:${k}`)!.detail).toContain('10');
  });

  it('a terminal prints a card for biomass', () => {
    const r = newRun(newMeta(), 4);
    const term = r.world.pois.find((p) => p.kind === 'terminal')!;
    standBeside(r, term);
    r.biomass = 10;
    const n = r.tac.length + r.exp.length;
    doAction(r, term.x, term.y, 'buy:0');
    expect(r.tac.length + r.exp.length).toBe(n + 1);
    expect(r.biomass).toBe(5);
  });

  it('surgery cuts a card and costs more each time', () => {
    const r = newRun(newMeta(), 5);
    r.biomass = 30;
    expect(exciseCost(r)).toBe(4);
    expect(excise(r, 'tac', r.tac[0].uid)).toBe(true);
    expect(r.tac.length).toBe(7);
    expect(exciseCost(r)).toBe(6);
  });

  it('events resolve once and can bank a log', () => {
    const meta = newMeta();
    meta.seq = traits(12);
    const r = newRun(meta, 6);
    const ev = r.world.pois.find((p) => p.kind === 'event')!;
    standBeside(r, ev);
    const acts = actionsAt(r, ev.x, ev.y);
    expect(acts.length).toBeGreaterThanOrEqual(3);
    doAction(r, ev.x, ev.y, acts[0].id);
    expect(ev.used).toBe(true);
    expect(r.notice).toBeTruthy();
    r.logs.push('derelict-1');
    settleRun(meta, 0, 'dead', r.logs);
    expect(meta.logs).toContain('derelict-1');
  });
});

describe('implants', () => {
  it('trait implants change the numbers', () => {
    const r = newRun(newMeta(), 7);
    const hp = maxHp(r);
    addImplant(r, 'fat');
    expect(maxHp(r)).toBe(hp + 8);
    addImplant(r, 'grip');
    expect(runTraits(r).mgt).toBe(4);
    expect(runTraits(r).rfx).toBe(2);
  });

  it('Spinal Relay makes the first card free; Thorn Skin hits back', () => {
    const rng = new Rng(1);
    const deck = ['flense', 'flense', 'flense', 'flense', 'flense'].map((id, i) => ({ uid: i + 1, id }));
    const mods = { firstCardFree: true, thorns: 3, tagStart: 1, energyFirst: 0, drawFirst: 0, fleeBonus: 0 };
    const { s } = startBattle({ foes: ['bloom'], tier: 1, deck, traits: traits(3), hp: 40, maxHp: 40, biomass: 0, consumedRun: 0, mods, firstStrike: true }, rng, 0, 1);
    expect(s.foes[0].tag).toBe(1);
    const e0 = s.energy;
    playCard(s, s.hand[0].uid, undefined, rng);
    expect(s.energy).toBe(e0);
    playCard(s, s.hand[0].uid, undefined, rng);
    expect(s.energy).toBe(e0 - 2);
    const hpBefore = s.foes[0].hp;
    // the bloom's opening turns: plate, spores, thrash — play until it has attacked
    for (let i = 0; i < 3 && s.phase === 'player'; i++) endTurn(s, rng);
    expect(s.foes[0].hp).toBeLessThan(hpBefore);
  });
});
