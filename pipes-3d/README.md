# PIPELINE — a generative screensaver

An upgraded take on the Windows 95 "3D Pipes" screensaver: smooth tubes, real
quarter-elbow bends that grow on screen, ten studio-lit palettes — wrapped in a
compact phosphor-terminal settings overlay and, crucially, a **living mode**
that never has to hard-reset.

No build step. Native ES modules + a vendored Three.js 0.175. No network, no
fonts, no images.

## Run

```sh
python -m http.server 8095 --bind 127.0.0.1     # or: npm run serve
# open http://localhost:8095/
```

Any static file server works; modules require http(s), not `file://`.

## Test

```sh
npm test            # node --test: engine + geometry + settings + batch + orbit
                    #   + style-cycle + renderer stubs
python tools/smoke.py   # Playwright browser smoke (server must be running)
```

The smoke test writes screenshots and a console log into `artifacts/`.

## The smart bit: living mode

The original screensaver fills the cube, blanks the screen, and starts over.
PIPELINE's default **living loop** instead treats occupancy as a budget:

- Cells live on an integer 21³ lattice (9261 cells); every occupied cell is
  owned by exactly one pipe.
- A growing head reserves its target cell **and** one lookahead cell, so the
  next bend is known before it is reached — elbows grow smoothly into place
  instead of popping in.
- When the density budget is reached — or a pipe outlives its age limit, or
  head slots are exhausted — the single oldest finished/aged pipe fades out
  (~4.5 s), releases its cells, and a fresh head reclaims the space.
- Retirement is strictly one-at-a-time: at most one pipe is ever in the
  retire pipeline, so pressure can't cascade into a mass extinction.
  Occupancy may transiently overshoot the soft budget while a fade runs —
  the lattice (9261 cells), `maxPaths` (64) and `maxPathCells` (128) are the
  hard bounds; nothing is ever unbounded.
- Honest caveat: under sustained extreme settings (a small lattice at minimal
  density with many fast heads) the loop is bursty — heads can briefly sit at
  zero for about a fade duration while a slot frees, then growth resumes.

**Classic mode** is still available: fill to the budget, fade the whole scene,
reseed — the authentic behavior.

### Boundedness & performance

- Occupancy ≤ 21³ = 9261 cells; total live path objects ≤ `maxPaths` (64),
  counting the single in-flight fade — a fading path's slot frees only when it
  fully releases. Each pipe is capped at `maxPathCells` (128) cells, so a
  retirement never removes a massive share of the scene.
- The whole scene renders through **six shared dense instance batches**
  ({tube, elbow, ball} × {opaque, fading}) — ≤ 6 draw calls and ≤ 6 allocated
  geometries regardless of path or cell count. Slots are packed; removal is
  O(1) swap-delete; capacity grows by power-of-two buffer replacement up to a
  lattice-derived hard cap.
- The growing tip is the only per-frame geometry write: a trimmed tube, a
  partially revealed elbow (`instanceReveal` discards fragments past the
  growth front), and the travelling cap ball that covers the cut.
- `preserveDrawingBuffer` stays off, devicePixelRatio is capped at 1.5, and a
  dirty-flag loop skips sync/render entirely while paused and still.
- Verified bounded by a 100k-step engine stress test (`tests/engine.test.js`)
  and an in-browser aging run that re-checks draw calls, piece counts and
  geometry stability (`tools/smoke.py`).

## Controls

| Action | Control |
|---|---|
| Settings overlay | `O` (toggle) or the `[O]` strip button |
| Close settings / restore strip | `Esc` (returns canvas focus) |
| Pause / resume | `Space` or strip button |
| New pattern | `R` — advances the seed deterministically |
| Snapshot PNG | `S` or `C` |
| Fullscreen (whole document) | `F` |
| Hide key strip (clean view) | `H`; `Esc` restores |
| Auto-orbit / fixed camera | `A` |
| Cycle joints (elbows → ball → mixed) | `J` |
| Pixel workshop (2.5D) | `P` |
| Previous / next style | `[` / `]` |
| Direct style select | `1`–`9`, `0` (ten styles) |
| Orbit / zoom / reset view | left-drag · wheel · double-click |

Keyboard shortcuts ignore repeats and modifier chords. Text inputs, textareas
and contenteditable keep every key native — including `O` (typing an "o" in
the seed field never toggles settings); `Esc` still closes the overlay. A
focused `<select>` keeps its native typeahead/arrow/digit keys too — only `O`
and `Esc` still manage the panel. `Space` on a focused button keeps its
native click behavior.

The settings overlay is a phosphor-terminal panel — dark translucent surface,
green beveled controls, Lucida Console/Courier stack — and it is
runtime-only: it starts closed on every load, never
reframes the scene, keeps the simulation running, and traps focus while open.
Seed, counters and the cell budget live inside it — nothing is painted on the
stage. Settings groups: **Look** (ten style cards, joints, auto colour
cycling) and **Motion** (flow recipes, mode, pace, pipes, bends, cell
budget) open by default; **Display**, **Camera · Seed** and **Diagnostics**
collapse. Style changes swap only palette/material/background — never joints,
seed, flow or camera. `lowRes` and `scanlines` are independent global
switches that persist across style changes. Everything persists to
`localStorage` (obsolete `facets` data is dropped on load) and is
re-validated on every read. Running/paused/panel state and the auto-cycle
countdown are never persisted. Seeds are integers in [0, 2147483647]; "New
pattern" advances with wraparound. Switching flow mode intentionally restarts
the current seed.

### Automatic colour cycling

**Look → Random colours while growing** runs a wall-clock countdown
(15/30/60/90/120 s) that fires while the world keeps growing — no reseed, no
rebuild, no geometry churn. Each pulse calls `world.requestColorChange()`:
every growing head privately queues a *new random tint from the current
palette*, guaranteed different from the one it is currently drawing with. The
queued colour takes effect at the **next segment boundary** — the segment
already in flight finishes in its old colour — so a long-lived pipe ends up
striped with bands, while every committed section keeps the colour it was
born with. Colour history lives in the engine (`path.tints`, one entry per
committed segment), and each instance keeps a frozen `instanceTint` slot +
RGB, so nothing is ever repainted mid-frame and finished pipes cost zero
buffer writes.

The countdown only runs in **Living** mode, pauses with the scene (pause or
hidden tab), and resets on a manual style pick, mode switch, interval change,
reseed or new pattern. It never touches the selected style, materials,
background or any persisted setting. In **Classic** mode colours refresh only
when the whole scene reseeds — a path stays one colour for the entire fill.
Colour picks come from a dedicated RNG stream (`seed ^ 0x85ebca6b`), so
geometry replays identically whether or not colour cycling is on — and the
same seed + same pulse schedule reproduces the same bands. `P` toggles pixel
mode and is documented inside the panel, not on the key strip.

### Pixel workshop (2.5D)

**Display → Pixel workshop** is a distinct presentation mode, independent of
the retro low-res switch: the perspective camera is parked and an
**orthographic camera** at the classic isometric angle takes over (drag and
wheel zoom still work; double-click returns to the isometric home; leaving
the mode restores your exact perspective view). The render buffer drops to
coarse integer-scaled pixels (≤480×360, or ≤320×240 combined with low-res),
fog is flattened, pending growth is quantized to 12 visible steps, and the
shader posterizes colours to 16 levels with a 4×4 Bayer dither — all after
tonemapping, in the same draw calls. It changes how the scene is *seen*, not
how it is simulated: engine, seeds and determinism are untouched.

## Determinism

`PipeWorld` is a pure simulation (no DOM/Three): same seed + same settings +
same dt sequence ⇒ identical pipe geometry, verified by replay tests. The
replay fingerprint (state serialization) includes the lookahead reservation,
so pending growth decisions replay identically. Entering the same seed always
reproduces the same pattern.

## Layout

```
index.html  style.css
js/
  engine.js     PipeWorld: lattice, growth, reservations, living/classic
  geometry.js   shared tube/elbow/ball geometry, elbow tangent + plan math
  batch.js      dense instanced batches: packed slots, growth, transfer,
                custom instance attributes (tint + reveal)
  renderer.js   Three.js scene; six shared batches, tip/fade updates,
                per-instance band colours, perspective + ortho cameras,
                pixel mode
  orbit.js      small orbit camera (drag/wheel/double-click/auto)
  style-cycle.js  pure colour-pulse countdown (Living mode only)
  settings.js   defaults, ten styles, recipes, validation, persistence
  rng.js        seeded mulberry32
  app.js        UI wiring + main loop
vendor/         three.module.min.js + three.core.min.js (0.175.0, see VENDOR.md)
tests/          node --test suites
tools/smoke.py  Playwright end-to-end smoke
artifacts/      screenshots + console log from the last smoke run
```

## Known limitations / honest notes

- Bends are true quarter-torus elbows tangent to both axes (all 24 turn
  orientations verified by unit tests), but the elbow bulge (radius 0.42 +
  tube 0.18) can poke fractionally into neighboring cells — visible only on
  close inspection, and it never affects simulation correctness.
- In **Ball** joint mode the inside edge of a turn can show a small notch
  between the sphere and tube walls — inherited from the original look;
  Elbows or Mixed avoid it.
- A forced finish (shrinking the head count, emergency stall) re-plans the
  last joint — the provisional elbow is swapped for a rounded end cap, no
  dangling elbow. A graceful living retirement keeps its final formed bend
  and caps at the outgoing tangent.
- WebGL context failure shows a readable fallback panel instead of a blank
  page; there is no software-canvas fallback.
- `window.PIPELINE` exposes `{world, renderer, settings, styleCycle,
  isPaused, isPanelOpen, debugStep}` for diagnostics/testing —
  intentionally small; `debugStep(dt)` advances the frame pipeline
  deterministically for browser tests.
