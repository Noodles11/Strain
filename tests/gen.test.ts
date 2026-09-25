import { describe, expect, it } from 'vitest';
import { generateWorld, reachable } from '../src/world/gen';

describe('world generation', () => {
  it('builds valid derelict maps for many seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = generateWorld(seed);
      const boss = w.mobs.find((m) => m.kind === 'boss')!;
      expect(boss).toBeTruthy();
      expect(reachable(w, w.ship, boss, (g) => g.forcible)).toBe(true);
      expect(w.pois.filter((p) => p.kind === 'vent').length).toBeGreaterThanOrEqual(2);
      expect(w.mobs.filter((m) => m.kind === 'pack').length).toBeGreaterThanOrEqual(10);
    }
  });
  it('is deterministic', () => {
    expect(JSON.stringify(generateWorld(7))).toBe(JSON.stringify(generateWorld(7)));
  });
});
