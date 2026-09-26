# Strain

A dark sci-fi card roguelite for mobile browsers. The alternative version of *Reprint*.
You are a clone. Your **traits** grow between prints; every card reads them, so the whole deck grows with you.

- **Six traits**: Might, Hide, Reflex, Focus, Metabolism, Aberrance. Each works in battle and while exploring.
- **Two decks**: tactical (battles) and exploration (the open world). Cards never mutate.
- **Battles** in Game Boy grammar: foe upper right, clone from behind lower left, a text box, cards as moves. Up to 3 enemies.
- **Planets**: start on the Derelict, then fly to Kessra from the star chart. Each landing is a tier harder.
- **Open world**: a generated map with gates, caches, vents, nests, roaming and ambushing mobs, respawns and a storm clock.
- **Upgrade sites**: splice pods (+1 trait for the run), printer terminals (buy cards), surgery bays (cut cards).
- **Events** with trait checks, **implants** (passive run items) and **log fragments** for the codex.
- **The Printer**: spend Codons between runs to raise your sequence. Codons are always kept on death.

Design: [docs/DESIGN.md](docs/DESIGN.md). Build status: [docs/STATUS.md](docs/STATUS.md).

## Play

```bash
npm install
npm run dev        # open the printed URL on your phone (same Wi-Fi)
```

Tap a tile to walk. Tap a door, cache, vent or nest to use it. Hold any card to see its formulas.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server, reachable from your phone on the LAN |
| `npm test` | Rules tests, map generation, ambush/respawn rules, a 90-run bot sim |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run build:artifact` | One self-contained HTML file in `dist-artifact/` |

## Layout

```
src/core/     Rules. Pure TypeScript, seeded RNG, no DOM.
  traits.ts   Traits, formulas (base + trait × weight), derived stats, costs
  cards.ts    Card data as formulas, thresholds, card text
  enemies.ts  Enemy trait blocks, tiers, derelict packs
  battle.ts   Battle engine, intents, initiative, ambush, flee, autoplay bot
  run.ts      A run: movement, mobs, ambushes, respawns, storm, gates, sites, events, loot
  implants.ts Implant data and their combined effects
  events.ts   Events, log fragments, check odds
  planets.ts  Planet registry: packs, elites, bosses, cards, events, twists
  meta.ts     Codons, sequence levels, save
src/world/    gen.ts: planet map generation (zones, links, gates, POIs, validation)
src/render/   Canvas: overworld, battle scene, creatures, clone, calm print pass
src/ui/       DOM: Printer hub, HUD, hands, text box, sheets
tests/        Vitest specs
```
