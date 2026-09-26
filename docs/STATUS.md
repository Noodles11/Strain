# Build status

Milestones from `DESIGN.md` §13.

| # | Milestone | State |
|---|---|---|
| S1 | Trait core + battle | Done. Formula cards, thresholds, enemy trait blocks, tiers, initiative, ambush, flee, bot. |
| S2 | Battle screen | Done. Foe ledge upper right, clone back view, plates with draining HP, text box, hand, targeting, long-press formulas. |
| S3 | Open world: Derelict | Done. Generated map, tap-to-path, fog, dark sections, hazards, gates (door/debris + ratings, forcing), caches (incl. hidden), vents, nests, roaming + chasing mobs, ambushes, respawns, storm, elites, The First, beacons, fast travel. |
| S4 | Meta loop | Done. Printer hub, Codons, Sequencer, death/win → bank → reprint, saves for meta and the current run. |
| S5 | Kessra, star chart, tier by landing | Done. After a world boss the ship launches to the star chart; each landing is one tier higher. Kessra: Glass Caves theme, Resonance (every 3rd card each turn resolves twice), Shardlings split, Singing Geodes buff allies, Refractor reflects while plated, the Prism Mother sheds Shardlings below half, 4 Kessra cards (Resonant Strike, Shatter, Crystal Skin, Split Lens), 4 events, 5 logs. Mireth and Orun show as lost signals. |
| S6 | Upgrade sites, events, implants | Done. Splice pods (somatic +1, price 6 + 4 per point bought, 2 per pod), printer terminals (5 biomass a card, 2 per terminal), surgery bays (4 + 2 per cut; decks keep 5 / 3 cards), 6 derelict events with trait checks, 5 log fragments (codex on the Printer, +5 Codons the first time), 18 implants. |

## Numbers in this build

- New clone: all traits 3. Sequence cost `6 + 3 × level`. Cap 12.
- Codons: 2 per first-spawn kill, 2 per new map section, 8 per elite, 20 × tier per boss, 10 × tier for launching.
- The First: 92 HP, summons Mewling Copies below half.
- Storm arrives after 600 steps, then eats one tile of the edge every 40 steps.
- Nests spawn a pack every 150 steps (max 3 packs in their section).

Bot sim (rushes the boss, fights only what blocks it, 30 seeds each):

| Sequence | Cleared | Died |
|---|---|---|
| all 3 | 1 | 29 |
| all 5 | 29 | 1 |
| all 7 | 30 | 0 |

The bot never explores for cards, so all-3 losses are expected; a player who explores gets a bigger deck first.

## S6 details

- Every map has at least one pod, terminal and surgery bay; each ring gets different site kinds.
- 3–6 events per map, never the same one twice. Checks: certain at the target, −15% per missing point (min 5%).
- Implants come from elites (always), caches (15%) and events. Trait implants can carry a drawback.
- Logs: 4 from events, the 5th from The First.
- Map validation now treats objects on the floor as walls, so a pod can never block the only way to the boss.

## S5 details

- Run: Derelict (landing 1, tier 1) → star chart → Kessra (landing 2, tier 2). You can also go home from the chart and bank.
- The Derelict's boss reveals Kessra for this run and for good; Kessra's boss reveals Mireth and Orun (not built yet).
- Landing refuels: full oxygen, +30% integrity, exploration hand refilled. Decks, implants and somatic points carry over.
- Kessra maps are 52×52, darker (45% of sections start dark), with shard-floor hazards and crystal debris.
- Elites on Kessra offer only Kessra cards; regular rewards weigh Kessra cards double.

Bot sim, two landings (rushes each boss, 20 seeds):

| Sequence | Cleared both | Died on Kessra | Died on Derelict |
|---|---|---|---|
| all 5 | 8 | 11 | 1 |
| all 7 | 18 | 2 | 0 |
| all 9 | 20 | 0 | 0 |

## Not in this build yet

- Mireth, Orun — S7.
- Chassis, Archive, signal strength — S8.
- Jet Pack, Lure, Core Drill, Sample Kit (need planet terrain).
