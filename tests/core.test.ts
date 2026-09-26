import { describe, expect, it } from 'vitest';
import { CARDS, cardText, resolveCard } from '../src/core/cards';
import { botTurn, startBattle } from '../src/core/battle';
import { Rng } from '../src/core/rng';
import { traits } from '../src/core/traits';
import { newMeta } from '../src/core/meta';
import { actionsAt, bAuto, doAction, lootChoose, maxHp, newRun, rewardPick, step, type RunState } from '../src/core/run';
import { gateAt, idx, inBounds, passable, T_GATE, tileAt } from '../src/world/gen';

describe('trait formulas', () => {
  it('starter numbers match the design at all-3', () => {
    const t = traits(3);
    expect(resolveCard(CARDS.scalpel, t).fx[0]).toMatchObject({ op: 'dmg', v: 6 });
    expect(resolveCard(CARDS.brace, t).fx[0]).toMatchObject({ op: 'plate', v: 5 });
    expect(resolveCard(CARDS.flense, t).fx).toMatchObject([{ v: 8 }, { v: 2 }]);
  });
  it('raising a trait raises every card that reads it', () => {
    expect(resolveCard(CARDS.scalpel, traits(8)).fx[0]).toMatchObject({ v: 11 });
    expect(resolveCard(CARDS.bonesaw, traits(8)).fx[0]).toMatchObject({ hits: 3 });
  });
  it('thresholds show as unmet then met', () => {
    const lo = cardText(CARDS.scalpel, traits(3)).flat().find((s) => s.s.startsWith('MGT 9'));
    const hi = cardText(CARDS.scalpel, traits(9)).flat().find((s) => s.s.startsWith('MGT 9'));
    expect(lo?.why).toBe('unmet');
    expect(hi?.why).toBe('met');
  });
});

function fightWinRate(level: number, foes: string[], n = 60): number {
  let wins = 0;
  let left = 0;
  for (let i = 0; i < n; i++) {
    const rng = new Rng(i + 1);
    const t = traits(level);
    const deck = ['scalpel', 'scalpel', 'scalpel', 'scalpel', 'brace', 'brace', 'harpoon', 'flense'].map((id, k) => ({ uid: k + 1, id }));
    const { s } = startBattle({ foes, tier: 1, deck, traits: t, hp: 26 + 6 * level, maxHp: 26 + 6 * level, biomass: 0, consumedRun: 0 }, rng, 0, 1);
    for (let g = 0; g < 60 && s.phase === 'player'; g++) botTurn(s, rng);
    if (s.phase === 'won') { wins++; left += s.player.hp / s.player.maxHp; }
  }
  return wins / n + left / n / 100;
}

describe('battle', () => {
  it('a stronger sequence wins more', () => {
    const weak = fightWinRate(3, ['husk', 'drone', 'copy']);
    const strong = fightWinRate(7, ['husk', 'drone', 'copy']);
    expect(strong).toBeGreaterThan(weak);
    expect(fightWinRate(3, ['tick'])).toBeGreaterThan(0.9);
  });
});

/** Walk toward the boss, fighting and forcing gates on the way. */
export function botRun(seed: number, level: number): { r: RunState; outcome: string } {
  const meta = newMeta();
  meta.seq = traits(level);
  const r = newRun(meta, seed);
  r.world.seen.fill(1);
  for (let guard = 0; guard < 6000; guard++) {
    if (r.mode === 'dead' || r.mode === 'won') break;
    if (r.mode === 'battle') { bAuto(r); continue; }
    if (r.mode === 'loot') {
      r.loot!.forEach((_, i) => lootChoose(r, i, r.hp < maxHp(r) * 0.7 ? 'eat' : 'render'));
      continue;
    }
    if (r.mode === 'reward') { rewardPick(r, 0); continue; }
    const goal = r.bossDead ? r.world.ship : r.world.mobs.find((m) => m.kind === 'boss')!;
    if (r.bossDead && Math.abs(goal.x - r.x) + Math.abs(goal.y - r.y) <= 1) {
      if (r.x !== goal.x || r.y !== goal.y) step(r, goal.x - r.x, goal.y - r.y);
      doAction(r, goal.x, goal.y, 'launch');
      continue;
    }
    const next = botNext(r, goal.x, goal.y);
    if (!next) break;
    const [nx, ny] = next;
    if (tileAt(r.world, nx, ny) === T_GATE && !gateAt(r.world, nx, ny)!.open) {
      const acts = actionsAt(r, nx, ny).filter((a) => a.ok);
      const a = acts.find((q) => q.id.startsWith('card')) ?? acts.find((q) => q.id === 'force');
      if (!a) break;
      doAction(r, nx, ny, a.id);
      continue;
    }
    const moved = step(r, nx - r.x, ny - r.y);
    if (!moved && r.mode === 'explore') {
      const p = r.world.pois.find((q) => q.x === nx && q.y === ny);
      if (p) { const a = actionsAt(r, nx, ny).find((q) => q.ok); if (a) doAction(r, nx, ny, a.id); else break; }
    }
  }
  return { r, outcome: r.mode };
}

function botNext(r: RunState, tx: number, ty: number): [number, number] | null {
  const w = r.world;
  const prev = new Int32Array(w.w * w.h).fill(-1);
  const start = idx(w, r.x, r.y);
  prev[start] = start;
  const q = [start];
  while (q.length) {
    const c = q.shift()!;
    const cx = c % w.w;
    const cy = Math.floor(c / w.w);
    if (cx === tx && cy === ty) {
      let k = c;
      while (prev[k] !== start) k = prev[k];
      return [k % w.w, Math.floor(k / w.w)];
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(w, nx, ny)) continue;
      const ni = idx(w, nx, ny);
      if (prev[ni] >= 0) continue;
      const g = gateAt(w, nx, ny);
      const poi = w.pois.find((p) => p.x === nx && p.y === ny && p.kind !== 'ship' && !(p.kind === 'cache' && (p.used || p.hidden)) && !(p.kind === 'nest' && p.used));
      const ok = (passable(w, nx, ny) && !poi) || (g && g.forcible) || (nx === tx && ny === ty);
      if (!ok) continue;
      prev[ni] = c;
      q.push(ni);
    }
  }
  return null;
}

describe('bot runs', () => {
  it('a stronger sequence clears the derelict more often', () => {
    const rate = (lvl: number) => {
      let won = 0;
      for (let s = 1; s <= 30; s++) if (botRun(s, lvl).outcome === 'won') won++;
      return won / 30;
    };
    for (const lvl of [3, 5, 7]) {
      const o: Record<string, number> = {};
      let hp = 0;
      for (let s = 1; s <= 30; s++) { const { r, outcome } = botRun(s, lvl); o[outcome] = (o[outcome] ?? 0) + 1; hp += r.stats.fights; }
      console.log(lvl, JSON.stringify(o), 'fights avg', hp / 30);
    }
    const a = rate(3);
    const b = rate(7);
    console.log(`derelict clear rate: seq 3 → ${a}, seq 7 → ${b}`);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(b).toBeGreaterThan(0.6);
  });
});
