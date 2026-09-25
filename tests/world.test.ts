import { describe, expect, it } from 'vitest';
import { newMeta } from '../src/core/meta';
import { actionsAt, doAction, newRun, step } from '../src/core/run';
import { traits } from '../src/core/traits';

describe('ambushes and respawns', () => {
  it('an unseen ambusher attacks first when you step next to it', () => {
    const r = newRun(newMeta(), 11);
    const m = r.world.mobs.find((q) => q.kind === 'ambush')!;
    m.stealth = 6;
    // put the clone two tiles away on open floor and walk in
    r.x = m.x - 2; r.y = m.y;
    r.world.tiles[r.y * r.world.w + r.x] = 1;
    r.world.tiles[r.y * r.world.w + r.x + 1] = 1;
    step(r, 1, 0);
    expect(r.mode).toBe('battle');
    expect(r.battle!.ambush).toBe(true);
  });

  it('high Focus spots the same ambusher instead', () => {
    const meta = newMeta();
    meta.seq = traits(12);
    const r = newRun(meta, 11);
    const m = r.world.mobs.find((q) => q.kind === 'ambush')!;
    m.stealth = 3;
    r.x = m.x - 2; r.y = m.y;
    r.world.tiles[r.y * r.world.w + r.x] = 1;
    r.world.tiles[r.y * r.world.w + r.x + 1] = 1;
    step(r, 1, 0);
    expect(m.spotted).toBe(true);
    expect(r.mode).toBe('explore');
  });

  it('resting at a vent brings back dead packs elsewhere, without rewards', () => {
    const r = newRun(newMeta(), 5);
    const vent = r.world.pois.find((p) => p.kind === 'vent')!;
    const far = r.world.mobs.find((m) => m.kind === 'pack' && m.zone !== vent.zone)!;
    far.alive = false;
    r.x = vent.x - 1; r.y = vent.y;
    r.world.tiles[r.y * r.world.w + r.x] = 1;
    expect(actionsAt(r, vent.x, vent.y).find((a) => a.id === 'rest')?.ok).toBe(true);
    doAction(r, vent.x, vent.y, 'rest');
    expect(far.alive).toBe(true);
    expect(far.reward).toBe(false);
    const elite = r.world.mobs.find((m) => m.kind === 'elite')!;
    elite.alive = false;
    vent.used = false;
    doAction(r, vent.x, vent.y, 'rest');
    expect(elite.alive).toBe(false);
  });
});
