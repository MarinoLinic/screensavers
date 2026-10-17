"""Focused review regression — pixel-mode reload class, seed-draft sync,
colour-band pulses, and pause/hidden freeze of the colour countdown.

Local Playwright, no downloads.
Requires the static server:  python -m http.server 8095 --bind 127.0.0.1
Writes screenshots + this output to artifacts/.
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8095"
HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "artifacts")
os.makedirs(ART, exist_ok=True)

results = []
console_lines = []
out_lines = []


def emit(line=""):
    print(line)
    out_lines.append(line)


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    emit(("PASS" if cond else "FAIL") + f" {name} {detail}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = ctx.new_page()
        page.on("console",
                lambda m: console_lines.append(f"[{m.type}] {m.text}"))
        page.on("pageerror",
                lambda e: console_lines.append(f"[pageerror] {e}"))
        page.goto(BASE + "/index.html")
        page.wait_for_function(
            "window.PIPELINE && window.PIPELINE.world", timeout=8000)
        page.wait_for_timeout(1800)

        # ============ 1. pixel-mode reload: crisp CSS must survive ============
        page.keyboard.press("4")  # candy — persisted
        page.keyboard.press("o")
        page.evaluate(
            "document.querySelectorAll('#panel details')"
            ".forEach(d => d.open = true)")
        page.check("#pixelModeIn")
        page.wait_for_timeout(200)
        page.keyboard.press("Escape")
        check("setup: pixel on, candy, lowRes off",
              page.evaluate(
                  "window.PIPELINE.settings.pixelMode === true"
                  " && window.PIPELINE.settings.preset === 'candy'"
                  " && window.PIPELINE.settings.lowRes === false"))
        page.reload()
        page.wait_for_function(
            "window.PIPELINE && window.PIPELINE.world", timeout=8000)
        page.wait_for_timeout(800)
        rel = page.evaluate("""() => {
          const P = window.PIPELINE;
          const c = document.getElementById('gl');
          return {
            flag: P.settings.pixelMode === true && P.renderer.pixelMode === true,
            cls: document.body.classList.contains('pixelmode'),
            css: getComputedStyle(c).imageRendering,
            ortho: P.renderer.camera === P.renderer.cameraOrtho,
            w: c.width, cssW: c.clientWidth,
            panel: P.isPanelOpen(),
          };
        }""")
        check("reload: pixelMode flag + ortho + panel closed",
              rel["flag"] and rel["ortho"] and rel["panel"] is False,
              str(rel))
        check("reload: pixelmode class + crisp imageRendering",
              rel["cls"] and rel["css"] in ("pixelated", "crisp-edges"),
              f"cls={rel['cls']} css={rel['css']}")
        check("reload: coarse buffer", rel["w"] <= 480,
              f"{rel['w']}px of {rel['cssW']}")
        page.screenshot(path=os.path.join(ART, "pixel-candy.png"))
        page.keyboard.press("3")  # icebox — second palette for evidence
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(ART, "pixel-icebox.png"))

        # P off: class removed, perspective + full resolution restored
        page.keyboard.press("p")
        page.wait_for_timeout(300)
        off = page.evaluate("""() => {
          const P = window.PIPELINE;
          const c = document.getElementById('gl');
          return { flag: P.settings.pixelMode === false
                          && P.renderer.pixelMode === false,
                   cls: document.body.classList.contains('pixelmode'),
                   persp: P.renderer.camera === P.renderer.cameraPersp,
                   w: c.width };
        }""")
        check("P off: class removed, perspective + resolution restored",
              off["flag"] and off["cls"] is False and off["persp"]
              and off["w"] > 480, str(off))
        png = page.evaluate("""() => new Promise(res =>
          document.getElementById('gl').toBlob(
            b => res(b ? b.size : -1), 'image/png'))""")
        check("PNG capture nonempty after P off", png > 10000,
              f"{png} bytes")

        # ============ 2. colour pulse: bands, not theme switches =============
        page.keyboard.press("o")
        page.evaluate(
            "document.querySelectorAll('#panel details')"
            ".forEach(d => d.open = true)")
        page.check("#autoCycleIn")
        page.select_option("#cycleIntervalSel", "15")
        seed_before = page.evaluate("window.PIPELINE.world.seed")
        page.click("#seedIn")
        page.fill("#seedIn", "42")  # typed draft — Apply NOT clicked
        cyc = page.evaluate("""() => {
          const P = window.PIPELINE;
          const p0 = P.settings.preset;
          const g0 = [...P.world.paths.values()]
            .map(p => [p.id, p.growthTint]);
          P.styleCycle.elapsed = 14.9;
          P.debugStep(0.2);   // crosses the 15s interval -> colour pulse
          const queued = [...P.world.paths.values()].filter(p => {
            const o = g0.find(([id]) => id === p.id);
            return o && o[1] !== p.growthTint; });
          return { p0, p1: P.settings.preset, queued: queued.length,
                   seedBox: document.getElementById('seedIn').value,
                   seed: P.world.seed };
        }""")
        check("timed pulse queues new colours on growing heads",
              cyc["queued"] > 0, str(cyc))
        check("timed pulse does NOT change the preset",
              cyc["p0"] == cyc["p1"], f"{cyc['p0']} -> {cyc['p1']}")
        check("timed pulse keeps seed draft in the box",
              cyc["seedBox"] == "42", f"seedIn={cyc['seedBox']!r}")
        check("timed pulse leaves world seed alone",
              cyc["seed"] == seed_before, f"{seed_before} -> {cyc['seed']}")
        persisted = page.evaluate(
            "JSON.parse(localStorage.getItem('pipes3d.settings.v1'))")
        check("timed pulse persists nothing — preset + flags intact",
              persisted.get("preset") == cyc["p1"]
              and persisted.get("pixelMode") is False
              and persisted.get("autoCycle") is True)
        # queued colours become visible bands at segment boundaries
        page.evaluate("""() => { const P = window.PIPELINE;
          for (let i = 0; i < 90; i++) P.debugStep(0.3); }""")
        check("banded growth visible on living paths",
              page.evaluate(
                  "[...window.PIPELINE.world.paths.values()]"
                  ".some(p => new Set(p.tints).size > 1)"))
        page.screenshot(path=os.path.join(ART, "growth-colour-banded.png"))
        # manual seed apply still works normally
        page.click("#seedBtn")
        page.wait_for_timeout(200)
        check("manual seed apply unaffected",
              page.evaluate("window.PIPELINE.world.seed") == 42)
        # fresh scene after reseed starts single-tint again
        check("reseed clears bands on the fresh scene",
              page.evaluate(
                  "[...window.PIPELINE.world.paths.values()]"
                  ".every(p => new Set(p.tints).size <= 1)"))
        # arm a colour queue for the freeze test — growthTint only moves on a
        # pulse (heads that commit in the same frame already consumed theirs)
        armed = page.evaluate("""() => {
          const P = window.PIPELINE;
          for (let i = 0; i < 40; i++) P.debugStep(0.3);  // grow heads
          const g0 = [...P.world.paths.values()]
            .map(p => [p.id, p.growthTint]);
          P.styleCycle.elapsed = 14.9;
          P.debugStep(0.2);
          return { elapsed: P.styleCycle.elapsed,
                   queued: [...P.world.paths.values()].filter(p => {
                     const o = g0.find(([id]) => id === p.id);
                     return o && o[1] !== p.growthTint; }).length };
        }""")
        check("colour queue armed (pulse changed growthTint)",
              armed["queued"] > 0, str(armed))

        # ============ 3. pause / hidden freeze the colour countdown ==========
        page.evaluate("document.getElementById('gl').focus()")
        page.keyboard.press("Space")  # native pause path
        page.wait_for_timeout(120)
        paused_state = page.evaluate("""() => {
          const P = window.PIPELINE;
          return {
            paused: P.isPaused(),
            elapsed: P.styleCycle.elapsed,
            sig: [...P.world.paths.values()].map(p =>
              `${p.id}:${p.growthTint}:${p.tints.join(',')}` +
              (p.pending ? `/${p.pending.tint}` : '')).join(';'),
            time: P.world.time,
          };
        }""")
        check("pause: flag set with colours queued",
              paused_state["paused"] is True)
        page.wait_for_timeout(300)
        frozen = page.evaluate("""() => {
          const P = window.PIPELINE;
          P.debugStep(1);  // must no-op while paused
          return { elapsed: P.styleCycle.elapsed,
                   sig: [...P.world.paths.values()].map(p =>
                     `${p.id}:${p.growthTint}:${p.tints.join(',')}` +
                     (p.pending ? `/${p.pending.tint}` : '')).join(';'),
                   time: P.world.time };
        }""")
        check("pause: countdown + colour queue + world frozen",
              frozen["elapsed"] == paused_state["elapsed"]
              and frozen["sig"] == paused_state["sig"]
              and frozen["time"] == paused_state["time"],
              f"{paused_state} -> {frozen}")
        page.keyboard.press("Space")  # resume
        page.wait_for_timeout(120)
        moved = page.evaluate("""() => {
          const P = window.PIPELINE;
          P.debugStep(0.5);
          return { elapsed: P.styleCycle.elapsed,
                   time: P.world.time };
        }""")
        check("resume: world + countdown advance again",
              moved["time"] > paused_state["time"],
              f"{paused_state['time']} -> {moved}")

        # hidden tab: same freeze through the document.hidden guard
        page.evaluate("""() => {
          Object.defineProperty(document, 'hidden',
            {get: () => true, configurable: true});
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        hid0 = page.evaluate("""() => {
          const P = window.PIPELINE;
          return { elapsed: P.styleCycle.elapsed,
                   sig: [...P.world.paths.values()].map(p =>
                     `${p.id}:${p.growthTint}:${p.tints.join(',')}` +
                     (p.pending ? `/${p.pending.tint}` : '')).join(';'),
                   time: P.world.time };
        }""")
        page.wait_for_timeout(300)
        hid1 = page.evaluate("""() => {
          const P = window.PIPELINE;
          P.debugStep(5);  // must no-op while hidden
          return { elapsed: P.styleCycle.elapsed,
                   sig: [...P.world.paths.values()].map(p =>
                     `${p.id}:${p.growthTint}:${p.tints.join(',')}` +
                     (p.pending ? `/${p.pending.tint}` : '')).join(';'),
                   time: P.world.time };
        }""")
        check("hidden: countdown + colour queue + world frozen",
              hid0 == hid1, f"{hid0} -> {hid1}")
        page.evaluate("""() => {
          Object.defineProperty(document, 'hidden',
            {get: () => false, configurable: true});
          document.dispatchEvent(new Event('visibilitychange'));
        }""")
        page.wait_for_timeout(150)
        unhid = page.evaluate("""() => {
          const P = window.PIPELINE;
          P.debugStep(0.3);
          return { elapsed: P.styleCycle.elapsed,
                   time: P.world.time };
        }""")
        check("visible again: world resumes",
              unhid["time"] > hid1["time"], f"{hid1} -> {unhid}")

        # ============ 4. classic mode: no colour pulses, no bands ==========
        page.select_option("#modeSel", "classic")
        page.wait_for_timeout(150)
        check("classic: interval select disabled",
              page.evaluate(
                  "document.getElementById('cycleIntervalSel').disabled"
                  " === true"))
        cl = page.evaluate("""() => {
          const P = window.PIPELINE;
          const g0 = [...P.world.paths.values()]
            .map(p => p.growthTint).join(',');
          P.styleCycle.elapsed = 14.9;
          P.debugStep(0.2);            // classic -> pulse must be a no-op
          const guard = P.world.requestColorChange(); // engine guard itself
          const g1 = [...P.world.paths.values()]
            .map(p => p.growthTint).join(',');
          P.debugStep(15);             // a whole interval worth of time
          const g2 = [...P.world.paths.values()]
            .map(p => p.growthTint).join(',');
          const bands = [...P.world.paths.values()]
            .some(p => new Set(p.tints).size > 1);
          return { g0, g1, g2, guard, bands,
                   elapsed: P.styleCycle.elapsed };
        }""")
        check("classic: requestColorChange guarded + zero tints moved",
              cl["guard"] == 0 and cl["g0"] == cl["g1"] == cl["g2"],
              str({k: v for k, v in cl.items() if k not in ('g0','g1','g2')}))
        check("classic: no bands + countdown stays cleared",
              cl["bands"] is False and cl["elapsed"] == 0, str(cl))
        page.select_option("#modeSel", "living")
        page.wait_for_timeout(150)

        # ============ 5. locals roundtrip: interval 90 + flags + theme ======
        page.evaluate("""() => {
          const P = window.PIPELINE;
          document.getElementById('cycleIntervalSel').value = '90';
          document.getElementById('cycleIntervalSel')
            .dispatchEvent(new Event('change'));
        }""")
        page.keyboard.press("7")  # vignette theme
        page.wait_for_timeout(150)
        page.reload()
        page.wait_for_function(
            "window.PIPELINE && window.PIPELINE.world", timeout=8000)
        page.wait_for_timeout(600)
        rt = page.evaluate("""() => {
          const s = window.PIPELINE.settings;
          return { auto: s.autoCycle, iv: s.cycleInterval,
                   pixel: s.pixelMode, preset: s.preset };
        }""")
        check("locals roundtrip: autoCycle/90/pixel/theme restored",
              rt == {"auto": True, "iv": 90,
                     "pixel": False, "preset": "nocturne"}, str(rt))

        # leave storage tidy: autoCycle off again
        page.evaluate(
            "document.getElementById('autoCycleIn').checked"
            " && document.getElementById('autoCycleIn').click()")
        page.keyboard.press("Escape")
        ctx.close()
        browser.close()

    errs = [l for l in console_lines
            if l.startswith("[error]") or l.startswith("[pageerror]")]
    check("no console errors", len(errs) == 0, "; ".join(errs[:5]))

    failed = [n for n, ok in results if not ok]
    emit(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    with open(os.path.join(ART, "growth-colour-review-browser.txt"),
              "w") as f:
        f.write("\n".join(out_lines) + "\n\n# console\n"
                + "\n".join(console_lines) + "\n")
    if failed:
        emit("FAILED:")
        for n in failed:
            emit(f"  {n}")
        sys.exit(1)


if __name__ == "__main__":
    main()
