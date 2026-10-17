# Biome Worlds

Ten animated 3D biomes. Landscape is the default: a scene fills the screen,
with a fixed camera, moving water and wildlife, and click effects. The original
miniatures remain available in Settings > Display > Mode > Diorama.
There is one authored scene per biome in each mode, with no random scene selector.
The interface follows Pixel Biomes: a small keyboard control strip and a plain
Display Properties panel. Scenes use their biome names.

## Open

Double-click **Start.bat**, or run `npm run serve`. The launcher opens
<http://127.0.0.1:8103/> in your default browser. Keep the server window open;
close it or press Ctrl+C to stop. An existing instance is reused. The launcher
never kills another process. Node.js is required; no npm install or internet
connection is needed. Use a browser with WebGL and hardware acceleration.

This is a browser screensaver. It does not install a Windows .scr file or change
system screensaver settings. The existing pixel-biomes project is unchanged.

## Biomes

The numeric keys match Pixel Biomes.

| Key | Biome | Landscape |
| --- | --- | --- |
| 1 | Marine | Reef, branching and table coral, kelp, striped fish, jellyfish, light shafts, plankton |
| 2 | Desert | Layered sandstone mesas, arch, dunes, cacti, camels, circling birds |
| 3 | Jungle | Canopy ravine, buttress roots, vines, palms, ferns, waterfall, pool, butterflies |
| 4 | Temperate forest | Woodland clearing, pond, path, ferns, flowers, mossy logs, deer and hares |
| 5 | Tundra | Treeless snowy mountains, lake, ice floes, caribou figures, hare and snow |
| 6 | Mediterranean | Hillside village, tiled roofs, shutters, balconies, tower, terraces, quay and boats |
| 7 | Steppe | Rolling grassland, flowers, trail, saiga figures, outcrop and birds |
| 8 | River | Winding channel, dry banks, willows, reeds, ducks and timber bridge |
| 9 | Moon | Craters, lander, ladder, solar panels, rover, astronaut, footprints and Earth |
| 0 | Tropical island | Palm-lined beach, headland, shelter, jetty, boats, crabs and gulls |

Natural uses warm daylight and landscape colours. Porcelain uses lighter,
faceted forms. Nocturne uses night lighting, stars, glowing village windows,
and aurora over the tundra. The Moon has a space backdrop and direct sunlight.
These aesthetics restyle the same scene. Wildlife and habitats are stylized.

## Controls

- **O**: settings. **Esc**: close settings or restore controls.
- **Space**: pause/resume. Settings and clicking remain available while paused.
- **P / N**, or **left / right arrows**: previous/next biome.
- **1-9**, then **0**: select the biomes in the table order.
- **S**: save a PNG without interface controls. **F**: fullscreen.
- **H**: hide/show controls. The small **...** button also restores them.
- Landscape: click/tap for ripples, particles or dust. Dragging and scrolling
  leave the camera fixed.
- Diorama: drag to orbit, scroll/pinch to zoom, double-click or **R** to reset.
  Choose Drift, Orbit or Still in settings.

Controls fade after eight idle seconds. Moving the pointer wakes them. H hides
controls until explicitly restored. The settings dialog traps keyboard focus
and removes the background controls from focus. Phone layouts retain the same
scene, with a wider vertical field of view and a wrapping control strip.

Settings include motion speed (0.2x to 2x), atmosphere, automatic touring, and
45/90/180 seconds per biome. Pausing and hidden tabs stop simulation and tour
clocks. Tour timing uses visible wall time independently of motion speed and
render rate. Editing settings resets the current tour interval.

| Detail | Pixel ratio cap | Shadows | Water reflection | Target rate |
| --- | --- | --- | --- | --- |
| Economy | 0.9 | Off | 384px | 30 fps |
| Balanced | 1.15 | 1536px | 640px | 30 fps |
| High | 1.6 | 2048px | 1024px | 60 fps |

Actual frame rate depends on the machine. Reduced-motion preference starts the
app paused and selects a still diorama camera.

Preferences persist in this browser under `biome-worlds.v1`. Older preferences
without a mode migrate to Landscape. Pause, dialog visibility and manual camera
positions do not persist. Corrupt or blocked storage does not prevent use.
Startup URL parameters override saved choices, for example:
`?mode=landscape&biome=river&aesthetic=nocturne&quality=balanced`.

## Architecture and maintenance

- `js/config.js`: biome records, validation, deterministic randomness and clocks.
- `js/world.js`: shared primitives, batching, wildlife and preserved dioramas.
- `js/landscape.js`: landscape terrain, plants, camera composition, reflections,
  weather, click effects and resource ownership.
- `js/landscapes.js`: one authored landscape builder per biome.
- `js/app.js`: rendering, mode selection, lifecycle, camera and UI.

Three.js r175 and Reflector are vendored under MIT. Textures are small procedural
DataTextures, generated locally; there are no remote assets, fonts or analytics.
Static objects share geometry and are instanced. Particle and wildlife counts
are fixed; click effects are bounded to six bursts and eight ripples. Replacing
scenes disposes geometry, materials, textures and reflection targets, releases
render lists, and cancels the previous transition. Paused scenes render only
on changes; hidden tabs do not render. GPU quality settings are capped.

Keep one authored builder per biome in each mode. Landscape tree trunks must
stay on dry terrain; river trunks have a 9-unit setback from the channel centre.
The preserved miniature river uses its original 3.2-unit setback. Land animals
must stay above the water surface, including while moving. Tundra is treeless;
Moon has no vegetation, water, air particles or flying wildlife. Track every
material, geometry, texture and render target for disposal. Inspect actual
screenshots after changing composition, including at phone widths; geometry
validation alone cannot show an obscured feature or a poor shoreline.

## Verification

- `npm test`: preference migration, clocks, deterministic placement, finite
  geometry, dry trunks/animals, fixed views and resource disposal in both modes.
- `npm run smoke`: installed hardware-backed Chrome/ANGLE D3D11; all 30
  landscape/look combinations, all ten dioramas, fixed camera, clicks, controls,
  storage, accessibility, fallback, responsive layout and resource stability.
- `npm run review`: 30 landscape/look images, ten diorama images, ten portrait
  landscapes, settings captures and contact sheets under `artifacts/`.
- `npm run performance`: frame-rate and geometry measurements for all ten
  landscapes in Balanced mode.
- `git diff --check`: whitespace check from the parent projects-js repository.

Browser checks use the already installed Python Playwright, Pillow and Chrome.
They close only their own browser sessions and never download a browser. Start
this app's local server first. `BIOME_WORLDS_URL` overrides the test address.
Captures are ignored by git. Shared shadow shader variants are warmed before
measuring three complete replacement cycles.

Delivered validation: 29 unit/geometry tests and 87 browser checks passed.
Balanced mode measured about 30 fps on the laptop's AMD Radeon 660M/D3D11.
All three looks and both modes were reviewed. No remote runtime requests,
JavaScript errors or shader errors were observed; resource counts stabilized
through repeated scene replacement.
