# Raycast Maze

A dependency-free, first-person raycast maze game in plain JavaScript.
Fifty themed levels, procedural textures, creature swarms, pickups,
anomalies and an autopilot; no build step, no packages, no assets.

## Run it

Serve the repo root with any static file server and open `index.html`:

```sh
python -m http.server 8080          # http://localhost:8080/
# or
npx serve .                         # any static server works
```

Opening `index.html` directly from disk also works in browsers that allow
`file://` script loading (pointer lock may be unavailable there; drag-look
still works).

## Test it

All test suites are plain Node scripts; no dependencies, no browser:

```sh
node tests/validate.js    # level data + swarm/LOS/autopilot invariants
node tests/rendering.js   # projection, resize, fog, z-buffer on a soft canvas
node tests/ui.js          # game UI against a minimal DOM stub
node tests/audio.js       # AudioContext lifecycle against a fake context
```

Each exits non-zero and prints `FAIL ...` lines on failure; a clean run ends
with `ALL VALID` / `RENDERING ALL VALID` / `UI ALL VALID` / `AUDIO ALL VALID`.

## Module map

Everything hangs off the global `window.Maze3D`. `index.html` loads scripts
in dependency order; later files may read `Maze3D.*`, never the reverse:

1. `levels/level1..50.js` - level data pushed onto the `LEVELS` array.
2. `js/config.js` - `CONFIG`, `TILES`, shared grid predicates
   (`isWallTile`, `isWallCell`, `hasLineOfSight`) and `isEditableTarget`.
3. `js/settings.js` - persisted user settings (localStorage).
4. `js/textures/*.js` - procedural texture packs:
   `core.js` builds base surfaces; `retro-pack`, `fantasy-pack`,
   `civilizations-pack`, `aesthetic-pack` extend them;
   `level-variants.js` installs `getWallVariant`.
5. `js/input.js` - keyboard/mouse/touch controller; honors modal and
   autoplay suppression.
6. `js/autopilot.js` - pathing for automatic play.
7. `js/interactions.js` - `INTERACTION_RULES` (radii/durations/scales),
   `CREATURE_EFFECTS`.
8. `js/entities.js` - `CreatureSwarm`, `CREATURE_PROFILES`.
9. `js/audio.js` - procedural WebAudio SFX, silent when unsupported.
10. `js/renderer.js` - software raycaster (walls, floor, sprites, fog).
11. `game.js` - `Game`: player physics, pickups, HUD, modals, frame loop.

## World model

- **Units**: one map cell is one world unit; positions are floats.
- **Coordinates**: +x points east (right on the map), +y points south
  (down on the map). `map[row][col]` indexes `map[y][x]`.
- **Angles**: radians, `0` faces east. Increasing the angle turns
  clockwise on the minimap: pi/2 faces south (east to south on the
  y-down grid).
- **FOV**: `CONFIG.fov` is the *horizontal* field of view. The renderer
  derives one focal length `width / (2*tan(fov/2))` and uses it for wall
  heights, floor projection and sprite scaling; square world objects stay
  square at any aspect ratio.

### Tile schema

`map` is an array of rows of integers (`Maze3D.TILES`):

| Value | Name    | Meaning                              |
|-------|---------|--------------------------------------|
| 0     | `EMPTY` | floor, walkable                      |
| 1     | `WALL`  | primary wall (theme texture/variant) |
| 2     | `EXIT`  | walkable exit tile                   |
| 3     | `MOSS`  | solid wall, moss texture             |
| 4     | `TECH`  | solid wall, tech texture             |

`isWallCell(map, x, y)` treats out-of-bounds cells as solid.

### Level file schema

Each `levels/levelN.js` pushes one object:

```js
LEVELS.push({
  name: 'Red Brick Run',
  start: { x: 1.5, y: 1.5, angle: 0 },
  theme: { wall: 'brick', floor: 'stone', ceiling: 'plaster',
           fogColor: [4, 8, 6], fogDistance: 17, particles: 'dust',
           moveScale: 1 },
  creatureTypes: ['rat', 'bat', 'spider'],   // roster, spawned in pairs
  creatureCount: 6,
  relicType: 'disk',
  relics: [{ x: 12.5, y: 9.5 }, ...],
  inversions: [{ x: 9.5, y: 3.5 }, ...],
  description: '...', creatureDescription: '...',
  powerupDescription: '...',
  map: [ [1,1,...], ... ],
});
```

## Adding content

### A level

Create `levels/levelN.js` for the next contiguous `N`, push the object
above, and add its `<script>` tag in `index.html` alongside the other
level files. The sector picker list is generated from `LEVELS` at
runtime, so no UI list needs editing. Places that hardcode the current
count of 50 and would need updating for a level 51:

- `index.html`: the intro paragraph ("Fifty themed sectors") and the
  picker kicker ("50 SECTORS ONLINE").
- `LEVELS.md`: the per-level design notes ("50 themed sectors" header).
- `tests/validate.js`: `LEVELS.length !== 50` and the `NAMES` array.
- `tests/ui.js`: the `i <= 50` level-file load loop.

### A creature species

1. Add a profile in `CREATURE_PROFILES` (`js/entities.js`): `width`,
   `height`, and for flyers `flying: true` plus a `vertical` hover anchor.
   Ground species omit `vertical`; their sprites are marked
   `floorAnchored` and the renderer puts their lowest *opaque* pixel on
   the floor plane (see `spriteFootFraction`), so transparent padding in
   the frame does not float the creature.
2. Add a contact effect in `CREATURE_EFFECTS` (`js/interactions.js`):
   `bump` | `slow` | `reverse` | `boost`.
3. Add sprite frames under `textures.creatures.<name>` in a texture pack.
   A known species with missing frames is skipped (never crashes); an
   unknown species falls back to the rat sprite.
4. Reference the species in a level's `creatureTypes`.

### A texture

Wall/floor/ceiling textures are 64x64 canvases built procedurally in
`js/textures/`. Add a maker in the appropriate pack and register it under
`textures.walls|floors|ceilings.<key>`, then reference `<key>` from a
level's `theme`. Keys used by themes are enumerated in
`tests/validate.js`.

### Wall variants

`installLevelTextureVariants` adds `textures.getWallVariant(key)`: a lazily
generated, cached accent texture built from `walls[key]` (or `brick` when
missing). The renderer places it on roughly every seventh wall cell, so a
level's walls alternate between the primary texture and its themed
variant. Every variant is a recolor + motif from the `STYLES` table,
except `brick`, which keeps level 1's original palette and mortar and only
adds sparse chips/cracks (`drawBrickWear`). Adding a theme variant means
one `STYLES` entry: `[tint, accent, motif]`; adding a motif means a branch
in `drawMotif`. The source texture is never mutated, and the cache only
fills on demand.

## Input & modes

- `Enter` starts manual play (pointer lock); `T` toggles autopilot,
  `U` the autopilot brain, `M` the minimap, `H` the HUD, `L` the level
  picker, `B` level notes, `I` interactions, `V` sound, `F` fullscreen,
  `C` captures the canvas as a `maze3d-sector-<n>-<timestamp>.png`
  download (`S` stays movement). `R` reloads the current sector;
  `G` toggles the scanline overlay and `Q` toggles low-resolution
  rendering — both footer buttons mirror the same switches.

### Render quality + scanlines

`scanlines` (`G`, footer `SCANLINES [G]: ON/OFF`) and `lowRes` (`Q`,
footer `LOW RES [Q]: ON/OFF`) are persisted settings; both default **on**
to preserve the original look, and old saved blobs without the keys keep
those defaults. Turning `lowRes` off renders at full quality: the buffer
caps at 1280x720 (same aspect-preserving fit) and every ray, floor span
and sprite column samples single pixels with canvas smoothing on. The
legacy mode renders at 0.55 scale (max 800x450, min 200x180) with
2-pixel sampling and no smoothing — the chunky look. Toggles are instant,
independent of HUD/minimap, never reset the sector, and survive reload.
- While a modal is open or autopilot drives, gameplay input is neutral:
  mouse deltas, keys and touch presses are dropped so resuming control
  never produces a deferred jump.
- Creature touch always applies its named effect (feed + timers from
  `INTERACTION_RULES`); manual play additionally takes the physical
  knockback, autoplay holds course. Completing a relic set also starts
  the overdrive timer, which is what the HUD label reports as OVERDRIVE.

See `LEVELS.md` for the level-by-level design notes.
