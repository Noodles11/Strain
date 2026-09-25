# Build status

Milestones from `DESIGN.md` §13.

| # | Milestone | State |
|---|---|---|
| S1 | Trait core + battle | Done. Formula cards, thresholds, enemy trait blocks, tiers, initiative, ambush, flee, bot. |
| S2 | Battle screen | Done. Foe ledge upper right, clone back view, plates with draining HP, text box, hand, targeting, long-press formulas. |
| S3 | Open world: Derelict | Done. Generated map, tap-to-path, fog, dark sections, hazards, gates (door/debris + ratings, forcing), caches (incl. hidden), vents, nests, roaming + chasing mobs, ambushes, respawns, storm, elites, The First, beacons, fast travel. |
| S4 | Meta loop | Done. Printer hub, Codons, Sequencer, death/win → bank → reprint, saves for meta and the current run. |

## Numbers in this build

- New clone: all traits 3. Sequence cost `6 + 3 × level`. Cap 12.
- Codons: 2 per first-spawn kill, 2 per new map section, 8 per elite, 20 × tier per boss, 10 × tier for launching.
- The First: 92 HP, summons Mewling Copies below half.
- Storm arrives after 600 steps, then eats one tile of the edge every 40 steps.
- Nests spawn a pack every 150 steps (max 3 packs in their section).

Bot sim (rushes the boss, fights only what blocks it, 30 seeds each):

| Sequence | Cleared | Died | Bot got stuck |
|---|---|---|---|
| all 3 | 0 | 24 | 6 |
| all 5 | 23 | 1 | 6 |
| all 7 | 24 | 0 | 6 |

The bot never explores for cards, so all-3 losses are expected; a player who explores gets a bigger deck first.

## Not in this build yet

- Splice pods, printer terminals and surgery bays (somatic boosts in-run) — S6.
- Events with trait checks, implants, log fragments — S6.
- Kessra, Mireth, Orun, star chart, tier scaling by landing — S5, S7.
- Chassis, Archive, signal strength — S8.
- Jet Pack, Lure, Core Drill, Sample Kit (need planet terrain).
