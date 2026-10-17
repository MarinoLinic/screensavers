# 3D FLYING OBJECTS

A zero-g kinetic-sculpture screensaver — a love letter to the old "Flying
Objects" / "Flying Through Space" savers, rebuilt as a real 3D stage:
sixteen polished pieces (teapot, torus knot, linked rings, satellites,
polyhedra, capsules) tumbling through a dark atmospheric studio with real
reflections, six choreographies, eight looks, and a phosphor-terminal
settings panel in the same family as PIPELINE.

## Run

- `npm run serve` — static server on <http://127.0.0.1:8098> (or double-click
  `Start.bat`, which opens the browser too). No dependencies, no network.
- `npm test` — `node --test` regression suite (settings, engine, cycle).
- `npm run smoke` — Playwright/Chrome browser checks + screenshots into
  `artifacts/` (ignored by git).

## Choreographies

Six fleet choreographies plus the simple Flower Box option — pick them in
`O` → Motion.

| Mode       | What it does |
| ---------- | ------------ |
| Drift      | free tumble, reflect-bounce inside the view volume |
| Orbit      | tilted elliptical lanes at varying depth |
| Helix      | rising corkscrew conveyor, seam fades at the wrap |
| Vortex     | funnel streaming out of the deep toward the viewer |
| Swarm      | coherent Lissajous ribbon the whole set follows |
| Classic    | one large slow bouncer — count kept but ignored |
| Flower Box | one softly morphing, rotating six-colour box on a clean stage |

Flower Box is the calm alternative to the fleet: family, count, spread,
camera and star/trail preferences are kept untouched and restored when you
switch back.

## Looks

Eight styles — Orbital (default chrome), 1997 candy metal, Porcelain,
Candy lacquer, Foundry, Tidal pearl, Sunset, Spectral holo — each a
palette + default material + backdrop bundle. Material overrides (chrome,
ceramic, glass, wireframe, checker) apply on top. `auto` defers to the
style. `[`/`]` or keys `1`-`8` switch; the panel's auto-cycler rotates
them every 20/45/90/180 s on wall-clock time.

## Controls

`O` settings · `Space` pause · `R` new seed (wraps 2147483647 -> 0) ·
`S`/`C` PNG snapshot · `F` fullscreen · `H` hide chrome · `A` camera ·
`G` scanlines · `Q` low-res · `[`/`]` styles · `1`-`8` direct style ·
drag orbit · wheel zoom · double-click reset view.

## Notes

- Simulation is deterministic and seedable; positions are closed-form
  functions of accumulated sim time (frame-rate independent).
- Paused still-scene costs no GPU renders; camera stays live for drags.
- Reduced-motion preference starts paused with a fixed camera (in memory
  only — nothing is persisted unless you touch the control).
- vendored Three.js 0.175 (`vendor/`, see `vendor/VENDOR.md`); no CDN,
  fonts, images, or network use at runtime.
