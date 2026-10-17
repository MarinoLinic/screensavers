# BIOME.EXE — Pixel Biomes

A pixel-art biome screensaver — a Win95-era daydream of living worlds,
formerly **TIDAL.EXE / Underwater Pixel** (same engine, renamed for the
multi-biome roadmap). True Canvas2D pixel rendering: every frame is a
small logical canvas upscaled by integer pixels, no smoothing, no WebGL,
no libraries, fonts, images or network.

## Run

- `npm run serve` — static server on <http://127.0.0.1:8099> (or double-click
  `Start.bat`, which opens the browser too). No dependencies, no network.
- `npm test` — `node --test` regression suite (settings, engine, tour
  clock, art assets via a fake Canvas2D).
- `npm run smoke` — Playwright/Chrome checks + screenshots into
  `artifacts/` (ignored by git).
- `npm run check:atlas` — all 17 scenes, family navigation, tour routes,
  frame-rate budgets and portrait controls in installed Chrome.
- `npm run review:art` — deterministic desktop/portrait captures and four
  contact sheets in `artifacts/` for visual review.
- `py tools/artshots.py` — refreshes the 52-species pose sheet + backdrop
  previews in `artifacts/` from `tools/art-preview.html`.

## Biomes

Ten biome families contain **17 designs**. A family can have one scene
or several; its number of designs does not imply greater tour time.

| Biome | Designs |
| --- | --- |
| Marine | Coral Garden, Kelp Cathedral, Moonlit Lagoon (a merchant shipwreck), Midnight Trench |
| Desert | Sandstone Arches — golden hour, daylight or moonlit |
| Jungle | Emerald Canopy — hanging vines, buttress roots, a waterfall, frogs and blue morphos |
| Temperate forest | Mosswood Clearing — open oak woodland, bluebells, a winding path, squirrels, brown hares, robins, deer and fox |
| Tundra | Silver Tundra — snow peaks, lichens, hares, ptarmigans, Arctic fox and caribou |
| Mediterranean | Limestone Cove, Adriatic Beach, Adriatic Harbour, Olive Terraces |
| Steppe | Feathergrass Sea — flowering grasses, ground squirrels, bustards, cranes and saiga |
| River | Willow River — a bank-to-riverbed cutaway, trout, perch, mallards, kingfishers and otters |
| Moon | Earthrise Station — craters, a gold-foil lander, solar cells, rovers and an astronaut |
| Tropical Island | Caribbean Palm Beach, Atoll Lagoon |

The four Mediterranean designs use separate palettes and compositions:
**Limestone Cove** has connected karst cliffs and a recessed tidal cave;
**Adriatic Beach** has a crescent of pale pebbles and an Aleppo pine
backshore; **Adriatic Harbour** layers a terracotta town, bell tower,
lamplit quay and fishing boats beneath a crescent moon; **Olive Terraces**
looks across dry-stone groves and a herb-lined footpath to the sea.
Wildlife is smaller in the distant terrace view. Fish stay clear of the
solid shore, with different waterlines and swim regions for each scene.

**Emerald Canopy** is a closed tropical ravine with buttress roots,
epiphytes, lianas and a moving three-stage cascade. **Mosswood Clearing**
is an open morning woodland with spreading oaks, mist, a winding path,
bluebells and fallen timber. These scenes have independent painters.

The tropical designs contrast a mountainous Caribbean beach framed by
curved coconut palms with a low Maldives-style atoll: wide shallow lagoon,
coral patches, a sandy islet and thatched villas on a timber jetty.

Marine residents now use their native size, with smaller cached sprites
in narrow portrait views. Moonlit Lagoon features a broken merchant ship:
fractured masts, torn sails, rigging, exposed hull ribs, portholes, anchor
and encrusting coral.

## Controls

`N` / `→` next scene · `P` / `←` previous scene · `B` next biome ·
`1`–`9` the original biome families · `0` Tropical Island · `[` / `]` previous/next scene ·
`O` settings · `Space` pause · `S` PNG snapshot · `F` fullscreen ·
`H` hide chrome (tiny restore button stays) · `Esc` close/restore ·
tap for a bubble burst underwater or particles elsewhere. Chrome
auto-fades after 8 s idle and wakes on any pointer or key.

## Settings

Choose a family, then its design. Cards render the real backdrop and
foreground plants; the Desert card follows its lighting choice. Each
family remembers its last selected design during the session.

Life: population 8–48 (default 12), Marine community (`mixed`, `reef fish`,
`jelly drift`), visitors and motion speed. Other biomes use their own cast
while keeping your Marine preference. Visitors appear one at a time on a
120-second cadence and do not count toward the population. A scene without
visitors disables that control.

Atmosphere labels follow the scene: light shafts, glare, ripples, gusts,
pollen, snow or plankton; foreground plants; scanlines; pixel size 2/3/4;
and 30/60 fps (default 30). Desert lighting applies only to Desert. The
Moon has no ambient air effects or vegetation; those controls are disabled
without discarding their saved preferences.

Tour: 45/90/180 seconds of visible, unpaused wall-clock time per stop.
**Each biome equally** visits all ten families and rotates Marine,
Mediterranean and Tropical Island designs on subsequent visits. **All scenes**
visits all 17 designs in order. **Scenes in this biome** stays within the
current family.

Arrangement seed: 0–2147483647. Preferences are stored under
`pixel-biomes.v1` — legacy `tidal-pixel.v1` saves migrate on first load —
and runtime flags never persist. `?habitat=<id>` picks a startup biome
without persisting.

## Art

Creature colour clusters and pose rows live in `js/sprites.js`,
`js/desert-sprites.js` and `js/biome-sprites.js`. The atlas contains 52
species with three frames each; related species share anatomy and use
distinct palettes. Landscapes live in `js/art.js`, `js/desert-art.js` and
`js/biome-art.js`, `js/woodland-art.js`, `js/mediterranean-art.js`,
`js/tropical-art.js` and `js/marine-details.js`. `js/landscape-details.js`
shares natural pixel drawing tools, while each landscape has its own
composition. `js/pixels.js` provides integer rectangles, scanline
polygons, raster lines and stepped colour ramps. No generated bitmaps or
external assets are used.

Ground walkers pause, advance and hop along the shared `js/terrain.js`
contours. Freshwater and coastal scenes independently place swimmers,
surface birds, seabed life and flyers. Resident layouts spread their
starting positions across the scene and limit large bird populations.
Backdrops, distant sprite variants and thumbnail paintings are cached;
the swaying foreground repaints at 8 Hz; empty Moon vegetation does no
painting. The render cap
does not change the simulation clock or the tour clock.

## Notes

- Simulation is deterministic and seedable; creature positions are
  closed-form functions of accumulated sim time (frame-rate independent,
  partition-stable).
- Paused costs no renders unless something changed; reduced-motion
  preference starts paused (in memory only).
- A seed Apply is a reseed and restarts the world clock; habitat,
  population and look changes keep it.

## Maintenance

When adding a design, register it in `BIOMES`/`HABITATS`, give every species
an explicit supported-scene list, and keep feet/water bounds in the shared
terrain module. A mixed coastal scene must not inherit Marine community
selection or ambient aquarium layers. Keep texture strokes inside their
stone, soil and roof silhouettes, and keep cave proportions stable in
portrait views. Keep the Moon free of air effects.

Run `npm test`, `npm run smoke`, `npm run check:atlas`, and
`git diff --check`. Then refresh `npm run review:art` and inspect the
actual desktop and portrait images; fake-canvas tests cannot assess art.
Include 720×450 logical pixels in painter checks: fractional waterlines
must not index before the first colour in a ramp. Browser test tools close
their own Chrome sessions and leave the existing local server alone.
