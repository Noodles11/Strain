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
- **Direct flights:** once any clone has landed on a planet (dying there still counts), every later print can fly straight to it from the Printer. It lands at that planet's depth on the chain (Kessra: landing 2, tier 2) with starter decks and no Derelict loot.
- The Derelict's boss reveals Kessra for this run and for good; Kessra's boss reveals Mireth and Orun (not built yet).
- Landing refuels: full oxygen, +30% integrity, exploration hand refilled. Decks, implants and somatic points carry over.
- Kessra floor is one solid teal surface (no tile grid) with decorative snow drifts on about one tile in five, on the map and in battle.
- Kessra maps are 52×52, darker (45% of sections start dark), with shard-floor hazards and crystal debris.
- Elites on Kessra offer only Kessra cards; regular rewards weigh Kessra cards double.

Bot sim, two landings (rushes each boss, 20 seeds):

| Sequence | Cleared both | Died on Kessra | Died on Derelict |
|---|---|---|---|
| all 5 | 8 | 11 | 1 |
| all 7 | 18 | 2 | 0 |
| all 9 | 20 | 0 | 0 |

## Real-time mobs

- Mobs no longer wait for your steps: every 0.8 s on the map (while no menu is open and you aren't walking a path) the world
  ticks. Wanderers stroll around their home, mostly keeping their heading and sometimes turning, never more than 4 tiles
  from home; chasers that have spotted you keep closing in, and one that reaches you starts the fight (from behind if you
  face away). Your steps still move them too, as before.
- On screen they glide between tiles with a small hop, and turn to face the way they walk.

## Battle controls and feedback

- **Drag to attack:** drag a card up out of the hand and drop it on an enemy (its plate at the top or its body in the scene)
  to play it at that enemy. While you hover, the enemy's plate lights up amber and a pulsing ring appears under it; the card
  follows your finger and gets an amber border when it is over a target. Dropping it anywhere else over the scene plays it at
  the current target; dropping it back on the hand cancels. Tapping still plays, swiping down still discards.
- **Pop-up lettering** (comic, ink-outlined, rising and fading in about a second) replaces the battle log box, which is hidden:
  damage taken or dealt (`-6`, or `BLOCKED` when plating soaks it all), healing (`+5`), plating gained (`+5 PLATE`),
  statuses as they land (`EXPOSED 1`, `WEAK 1`, `TAGGED`, `ROT +2`, `AWAKE`), enemy moves by name as they act
  (`SWEEP`, `CRITICAL`), `STRENGTH +2`, growing cards (`FEEDING BLADE ↑`, `MIGHT +1`), `FIRST STRIKE`, `AMBUSH!`, and why a card
  can't be played (`NOT ENOUGH ENERGY`). The box only comes back to ask you to pick a card for Donor Cell or Cannibal Print.

## Hand, discard and loot (rules change)

- **Hands carry over:** cards you don't play stay in hand. At the start of each turn the hand is topped back up to hand
  size (5 at base; Reflex raises it). Fleeting cards (Clot Patches) still fade at the end of the turn. The old Hold keyword is gone,
  since every card holds now (Unscarred Edge still grows while it sits in hand).
- **Discard:** swipe a card down in battle to throw it on the discard pile, free, any number of times before ending the turn.
- **No more eating corpses:** every corpse is rendered into biomass automatically (tagged ones double). Healing moved to
  **empty vats**: *Mend 10* or *Mend fully* for biomass, at 2 integrity per biomass +1 per 3 Metabolism.
  Second Stomach now adds +2 biomass per corpse.
- **After-fight summary:** a popup with the Codons gained (growth: sequence at the Printer or a vat), the biomass gained
  (currency: splices, printed cards, mending), each corpse and what it rendered into, and, when the fight offers one, a pick of
  three cards (or leave them).
- The balance bot mends at a vat whenever it drops below 70% after a fight, standing in for a player who detours to one.

## Battle scene

- Clone and enemies stand on one floor in perspective: enemies further back (higher, smaller), the clone close up.
  No platforms; each figure casts a soft contact shadow. Back-row enemies stand further back still.
- Every card has an attack animation (`src/render/attackfx.ts`), played before its hit lands:

| Look | Cards |
|---|---|
| Straight cut | Scalpel, Unscarred Edge, Sibling Print, Feeding Blade, Graft |
| Double peel | Flense |
| Saw teeth, one row per hit | Bonesaw |
| Heavy cut | Hunger Clock |
| Harpoon: head flies out on a slack line, bites, line snaps taut, head reels back | Harpoon, Salvage Hook (hook head) |
| Dart and ripple | Harvest Needle, Triage Tag, Overclock Jack |
| Pellet spread to every enemy | Scatter Rounds, Split Lens |
| Psychic wave to the head | Neural Spike |
| Cut, then blood flows back to you | Siphon Blade |
| Cracks and flying shards | Shatter |
| Cut with a violet echo | Resonant Strike |
| Hex shield | Brace, Callus, Crystal Skin, Scar Tissue, Cold Echo, Grief Engine |
| Rising crosses | medic cards |
| Sparks / swirl | Adrenal Leak / Donor Cell, Cannibal Print, Mutagen Flask |

- Enemy attacks: claws (Copy, Hollow Twin), bites (Hull Tick, Shardling), slams with a floor ring (Husk, Vat Bloom,
  Lattice Crawler, The First), bolts (Sentry Drone), beams (Choir, Geode, Refractor, Prism Mother).
- Hit flashes are drawn on each figure's own layer, so only the figure lights up.
- **Details popups:** tap an enemy's plate (it also becomes the target) for its description, active effects with what each does,
  its next move and its whole move cycle in plain words, special rules (splits, regrowth, spores…) and stats. Tap your own plate
  for your active effects, your genome (each trait: sequence + splices + implants + this fight, and what it drives) and your implants.
  Tapping a creature on the battlefield still just targets it.
- **Growing cards speak up:** when Feeding Blade, Sibling Print, Unscarred Edge, Callus, Grief Engine or Scar Tissue grows, the battle log says by how much and the new total (e.g. `FEEDING BLADE feeds: +5 damage (now +10).`). Unscarred Edge also says when a hit wipes its bonus.
- **Summoning sickness:** anything that arrives mid-fight (a boss's summons, split Shardlings) skips its first enemy turn. Its plate reads SUMMONED until then.

## Battle backdrop

- The fight happens where it started: `src/render/placeview.ts` rebuilds the real map tiles around the fight in 3D
  (walls, closed doors, a plain ceiling; crystals on Kessra walls), seen from behind the clone. No floor objects,
  debris or lamps: only the clone and the enemies stand in the corridor.
- Enemies are drawn to scale with each other: a Hull Tick is about half as tall as a person-sized Copy.
- Entering a fight, the camera swings from the top-down map down to eye level behind the clone (1.1 s);
  the clone and enemies fade in, then the fight begins. Shown HP holds at the pre-fight values meanwhile.
- The camera sits 3 tiles behind the clone when the corridor allows; otherwise it swings round to either side
  (up to ~57°) or moves in closer, until it has room and a clear line to the fighters.
- Only walls standing between the camera and the fighters fade out; walls beside the clone or the enemies stay solid.
  Tiles and walls cut by the camera's near plane are clipped, not dropped, so there are no holes.
- Back-row enemies stand only on open floor; walls are never removed to make room for them.
- Far tiles sink into fog.
- Dark sections darken the room; the storm tints it and adds rain.

## New lab mobs

| Mob | Where | Rule |
|---|---|---|
| Drip Stand (easy) | outer lab, always with a partner | Heals the most hurt ally (5 + Will/2); pokes for 3+ when alone |
| Test Subject (easy) | outer lab | Very fast, weak bite; flees after its 2nd turn (no corpse, no loot). Caught: 8 biomass, +2 bonus Codons. Backs away from you on the map |
| Cryo Sleeper (medium) | inner lab, also as an ambusher | Starts asleep behind plating (3 + tier) that doesn't clear; wakes after 3 rounds or below 50% HP, then Thaw (+plating, +2 strength) and Crush. Ambushing, it starts awake |
| Incinerator Unit (medium) | inner lab and the lair | Heats up each turn; on its 4th turn it explodes for 20 + 2·tier straight through plating and is gone (no loot). Weak shrinks the blast |

Plates read ASLEEP, FLEES IN n, BLOWS IN n and, on the last turn, the blast damage.

## Card faces

- Effects are icons, not words: blade = damage, crowd = all enemies, hex = plating, cross = heal, cards = draw,
  diamond = energy, arrow down = weak, target = expose, hook = tag, ringed cross = triage, chevrons = next card,
  fangs = drain, helix = random trait, broken hex = shatter, drop = biomass; exploration: key, flame, radar arcs,
  sun, pen, sealed hex, crowbar, beacon, eye.
- Thresholds read as `MGT 9 › [icon]1`. Holding a card shows the icons with their words and every formula.
- Printed-stock texture (dot screen, fibres, vignette); the card's plate emblem sits large and faint behind the text
  in its trait colour, replacing the corner glyph.

## Look: textures, decorations, comic lighting

Everything below is generated from tile hashes (`src/render/texture.ts`, `src/render/light.ts`), so a spot always looks the same.

- **Textures:** each planet has 6 floor, wall-top and wall-face variants, baked once per tile size: riveted deck plates, oil
  stains, hazard hatches, pipes and grilles on the Derelict; mottled ice rock, hairline cracks and faceted walls on Kessra;
  mud, leaves, moss mats, bark and hanging roots on Mireth.
- **Floor decals** (about 1 open tile in 5), the same on the map and in battle: cables, blood smears, grates, papers; shard
  clusters, crack stars, frost rings, glowing buds; black puddles with a moving glint, roots, toadstool rings, lily pads.
- **Walls in battle** carry conduits, rust runs, grilles and lamps (Derelict), glowing veins (Kessra), moss and glowing fungus (Mireth).
- **Comic lighting:** the dark is cut away around each light in three hard bands (lit, half-lit, shadow) instead of a smooth
  falloff; what stays dark gets a halftone dot screen, in a cold blue-black tint. Lights: the clone's own glow (smaller in dark
  sections), wall lamps (some stutter, some are dying), vents, events, pods, terminals, vats, the ship, beacons, hazard pools,
  and a pulsing eerie glow around the boss. On the map, walls throw hard shadow bands to the lower right and get ink outlines.
- **Battle:** a spot on the enemies, the clone's glow, the wall lamps, and a flickering eerie light far down the corridor
  (emergency red, cave violet, swamp green); sprites get an ink halo and a thin rim of that eerie colour; mist rolls along the floor.
- Motes drift through the light on the map.
- **Map props** (`src/render/props.ts`) share the look: solid three-quarter shapes with a lit top, a shaded front, a hard
  shadow band, an ink outline and a contact shadow. Caches are strapped lockers with a blinking latch (wooden crates on Mireth,
  frost-rimmed on Kessra) that sit open and dark once looted; vents are grilled collars with an ember glow and steam; nests are
  heaps of flesh lobes with veins, burrows and glistening sacs, a charred ring once burnt; splice pods are glass tubes with a
  half-grown body and rising bubbles; empty vats are cracked drained tanks still wired to the sequencer; terminals are consoles
  with a scrolling green screen; surgery bays are stained tables under a lamp arm; events are leaning black monoliths with a
  glowing violet glyph; the ship is a squat lander on legs with a cockpit, a lit ramp, nav lights and engine shimmer when ready.
  Doors are framed blast doors with hazard chevrons and a lock lamp; debris is a heap of beams (crystal slabs on Kessra, fallen
  trunks on Mireth); beacons stand on tripods.
- **The clone** is a bare, hairless printed humanoid in pale vat skin, inked in near-black (`src/render/clone.ts`).
  On the map it is a small 3D-posed figure with a walk cycle (legs stride, arms swing against them, the body bobs), turned to
  face its way: front (blank face, dark eyes), side (profile) or back (spine and skull socket). In battle it is seen over the
  shoulder, backlit: bald head with the cable socket and the print code on the nape, shoulder blades, spine, the vat seam,
  rim light on the edges. Might widens the shoulders, Hide pushes bony plates through the spine and shoulders, Aberrance grows
  violet limbs; the right arm swings out when it strikes.
- **Mob depth in battle:** each creature casts a solid shadow laid across the floor toward the camera, has a darker contact
  shadow at its feet, and gets hard cel shading (a lit top band, a sharp step into shadow on its lower half, the far side
  falling off). Back-row creatures sink into a haze of the corridor dark. Glows that used to spill as a bright patch under
  some creatures (the Husk's thruster, the Drone's hover, glowing eyes) are now small round glows.

## Veterans and variation

- The meta keeps a tally of every mob killed, by kind, across all clones (`Meta.slain`); a run adds its own kills as it goes.
- Veterans: a kind's HP scales by `1 + 0.6·n/(n+60)` and its attack by `floor(3·n/(n+80))`, where n is that kind's tally.
  +15% HP after 20 kills, +30% after 60, never past +60%; +1 attack from 40 kills, +2 from 160. Plates show `+n` for the attack bonus.
- Variation: each regular mob rolls its HP when a fight starts: 15% FAINT (×0.60–0.75), 15% HULKING (×1.25–1.45),
  the rest ×0.9–1.1. Elites vary only ±10%; bosses don't vary. The plate labels faint and hulking ones.

## Empty vats

- One per map in a wild or deep section, sometimes a second deeper in. Shown in cryo blue on the minimap.
- Spend Codons on sequence levels, same price as the Printer (`6 + 3 × level`): carried Codons go first, then banked ones.
- The level is permanent (written to the Printer at once) and applies to this clone right away (new max integrity is filled in).

## Mireth, the Drowned Forest (S7, part 1)

Revealed by the Prism Mother; landing 3, tier 3. Moss-green solid floor, black-water hazard ("the black water drags at you"),
reeds and hanging moss on the walls, 35% of wild/deep sections dark. Its boss reveals Orun (still a lost signal).

**Rot** (new status, both sides): deals its number at the start of the owner's turn, straight through plating, then drops by 1.
Shown as a mushroom icon on plates and intents.

| Mob | Rank | Rule |
|---|---|---|
| Leech Swarm | easy | Two quick bites; heals itself for what it takes (drain) |
| Bog Croaker | easy | Spits Rot 2, tongue lash, bloats (plating + Rot) |
| Puffcap | easy | Weak attacks; **bursts for Rot 3 on you when killed** |
| Gravemoth | easy | Dust (Weak + Rot), then a 3-hit flutter |
| Moss Hound | medium | Pairs; bites that add Rot, howls for +2 strength |
| Lantern Eel | medium | Glows (plating, strength), then a Shock that **pierces plating** |
| Stiltwader | medium | Wades (plating), then an 11-damage Spear; also ambushes from the water |
| Root Knot | medium | Tank: Entangle (Weak + Expose), Grow (plating 4), Lash |
| Mossback Stag | elite | **Regrows 4 + tier÷2 HP each turn**; Gore 13, Trample 6×2, Bellow |
| Leech Mother | elite | Broods Leech Swarms, Engorge (drain), Bloodrain (hits + Rot) |
| The Drowned Titan | boss | 120 HP, regrows; Surge, Silt (Rot 3), Undertow 16, Rootbed. Below half: seeds Puffcaps, Drown (+Rot), Grasp (drain), Bloom (Rot 3, allies +2) |

Mireth cards (drop only here, weighted double): **Rot Needle** (Rot 1 + ABR; ABR 9: Weak 1), **Symbiote** (heal 1 per Rot on
enemies; MET 8: 2 per Rot), **Canopy Cut** (2 + MGT to ALL, Rot ABR÷2 to ALL), **Sap Graft** (0 cost: deal ABR, heal all of it).
4 events (sunken probe, pale fruit, whispering roots, sinking clone), 5 logs (4 from events, 1 from the Titan).

Bot sim, three landings (rushes each boss, 20 seeds):

| Sequence | Cleared all three | Died on Mireth | Died earlier |
|---|---|---|---|
| all 7 | 1 | 18 | 1 |
| all 9 | 15 | 5 | 0 |
| all 11 | 20 | 0 | 0 |

## Not in this build yet

- Orun — S7.
- Chassis, Archive, signal strength — S8.
- Jet Pack, Lure, Core Drill, Sample Kit (need planet terrain).
