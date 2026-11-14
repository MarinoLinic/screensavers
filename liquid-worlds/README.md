# Liquid Worlds

Three procedural liquid landscapes, inspired by Mercury Pool and Nature from the Windows XP Plus! era. A browser screensaver with a quiet camera, moving liquid surfaces, reflected scenery, and interactive splashes.

## Run

Double-click **Start.bat**, or run:

```sh
npm run serve
# http://127.0.0.1:8097/
```

Node is the only server requirement. There is no install or build step. The launcher opens your default browser and keeps a local server in its terminal; close that terminal or press Ctrl+C to stop it. If port 8097 is already occupied, use `PORT` with `node tools/serve.js`, or another static server. ES modules require HTTP; opening `index.html` through `file://` is unsupported.

Everything is local: vendored Three.js 0.175.0, generated geometry, procedural materials, and canvas textures. No external images, fonts, network services, telemetry, or audio. Preferences stay in this browser's localStorage. PNG export uses the browser's download mechanism.

This is a browser screensaver, like the sibling projects. It does not install a Windows `.scr` file or change the system's idle/sleep settings.

## The landscapes

| Scene | What moves |
|---|---|
| **Argent Grotto** | Silver waves beneath stalactites and glowing crystal clusters. Droplets break into splashes, rings spread across the pool, and a traveling swell lifts the surface. |
| **The Crucible** | Three pipe outlets pour rippling metal into a reservoir beneath catwalks and amber windows. A submerged vortex and intersecting impact rings bend the reflected structure. |
| **Verdant Reach** | A waterfall feeds clear, refractive water over a stone riverbed. Foam collects near the fall and banks, leaves drift downstream, and the canopy moves in the morning light. |

Settings start closed. The title and toolbar fade after seven seconds without interaction. Moving the pointer or using the keyboard reveals them. **H** toggles the controls; **Esc** or the **Controls** button also restores them. The scene keeps running with settings open; paused scenes still allow camera movement, scene changes, and snapshots.

## Controls

| Action | Key / gesture |
|---|---|
| Settings | **O** |
| Pause / resume | **Space** |
| Choose scene | **1**, **2**, **3** |
| Previous / next | **[** / **]** |
| Fullscreen | **F** |
| Hide / show controls | **H**; **Esc** or **Controls** also restores |
| Save scene as PNG | **S** |
| Camera drift / still | **A** |
| New seeded landscape | **R** |
| Orbit / zoom / restore view | Drag / wheel / double-click |
| Splash the water | Click or tap on the liquid |

Keyboard shortcuts respect native editing, selects, and button activation. The settings dialog traps focus and returns it to the canvas on closing. Touch dragging works without pointer lock. Reduced-motion preference starts the scene paused with a fixed camera; the user can resume it. A hidden tab stops rendering and freezes its active-time scene countdown.

Enable **Travel through all three scenes** to cycle at 30 seconds to five minutes per scene. Transitions fade out and in. Changing time speed affects liquid/camera motion; the travel timer uses active elapsed time. Seed changes rebuild the current landscape; the same seed recreates its geometry and initial effect sequence. Timing of user splashes and different frame schedules can change subsequent particle/ripple history.

## Rendering and performance

- Displaced liquid geometry and analytic surface gradients. Sixteen ripple slots form a ring buffer; waves propagate outward and decay.
- A real planar reflection camera renders the surroundings to a bounded floating-point target. Surface normals distort that image. Curved droplets use a small generated environment map for PBR highlights.
- The forest has an additional camera render with water hidden for refraction; Fresnel blending combines the submerged scenery with reflected foliage. Foam and caustic-like highlights are procedural.
- PBR solid materials, instanced rocks/trees/leaves/grass, cached directional shadows, and a two-pass soft bloom with an ACES output pass.
- Economy / Balanced / High use 384 / 768 / 1280 square reflection targets and 80 / 128 / 192 water subdivisions. Display pixel ratio is capped at 0.85 / 1.25 / 1.75 respectively. Balanced can reduce display resolution under sustained low frame rates. High enables multisampling on the main render target.
- Rendering is capped at approximately 60 fps. Paused and still frames make no GPU render calls. Static shadows are cached; canopy motion does not regenerate the shadow atlas each frame.
- Droplets, splash particles, dust, and ripples have fixed capacities. Scene replacement disposes meshes, shared geometries/materials/textures, reflection/refraction targets, instance buffers, and light shadow maps. A lifecycle test checks repeated replacements for growth.

These are stylized landscapes and an analytic liquid animation, not a Navier–Stokes solver or a physically exact mercury simulation. Refraction has no depth-based thickness reconstruction; reflections use the horizontal mean surface. Waves do not collide with boulders. The waterfall is a flowing shader sheet with particle spray; light shafts are transparent planes. The material and geometry detail is entirely procedural. WebGL 2 is required, with a readable fallback if unavailable. Actual frame rate depends on browser, GPU, resolution, and quality.

## Checks

```sh
npm test                 # pure settings, seed, clock and bounded ripple tests
py tools/smoke.py         # live Chrome/WebGL checks; server must be running
```

The smoke script uses the installed Chrome with Direct3D 11, never downloads a browser, and closes its test browsers. It verifies all scenes, reflection/refraction budgets, pause, interaction, focus, fullscreen, PNG downloads, storage, scene cycling, repeated GPU resource replacement, 390px layout, reduced motion, and WebGL failure. Screenshots and its JSON report go to `artifacts/`.

For previews, `?scene=forest&quality=high&seed=2001` selects a starting scene, quality, and seed. It does not automatically save those URL overrides. `window.LIQUID_WORLDS` exposes a small diagnostic surface with the current world/settings/time, `travel`, `splash`, and resource/render counters for browser checks.

## Files

```text
index.html, style.css          stage and accessible settings
js/app.js                     controls, lifecycle, scene transitions, adaptive resolution
js/scenes.js                  three procedural environments and resource disposal
js/water.js                   reflection surface and liquid shaders
js/effects.js                 bounded droplets, splashes, jets and waterfall
js/materials.js               procedural stone, bark, environment and instance helpers
js/camera.js                  constrained orbit, zoom and drifting camera
js/post.js                    scene target, bloom and final output
js/settings.js                validated settings, seeded RNG, ripple pool and scene clock
vendor/                       local Three.js and Reflector, MIT license
tools/serve.js, tools/smoke.py  local server and live browser verification
tests/                        Node simulation tests
```

Design reference: Microsoft's [Plus! for Windows XP announcement](https://news.microsoft.com/source/2001/09/26/microsoft-announces-microsoft-plus-for-windows-xp/) describes its 3D screensavers and Nature theme. The new scenes, geometry, and visual design are original; no Microsoft assets are included.
