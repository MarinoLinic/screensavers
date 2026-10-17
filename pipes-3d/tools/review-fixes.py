"""Focused browser regression checks for the review-fixes round.

Requires the static server:  python -m http.server 8095 --bind 127.0.0.1
Covers:
  - reset-defaults recolors the renderer (palette/material/background +
    every live instanceColor) back to the 1995 style, not just settings
  - R then S dispatched in the SAME task while paused renders the new
    world before toBlob runs (no stale frame), real PNG download named
    for the new seed
  - snapshot async-callback failure paths: null blob, createObjectURL
    throw, anchor.click throw -> 'snapshot failed', URL revoked when
    minted, nothing escaping to the console
Writes evidence to artifacts/review-fixes-browser.txt (+ screenshots).
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8095"
HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "artifacts")
os.makedirs(ART, exist_ok=True)

results = []
out_lines = []
page_errors = []


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
            viewport={"width": 1440, "height": 900}, accept_downloads=True
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda m: (
            page_errors.append(m.text) if m.type == "error" else None))
        page.goto(BASE + "/index.html")
        page.wait_for_function("window.PIPELINE && window.PIPELINE.world", timeout=8000)
        page.wait_for_timeout(2200)

        # ------------------------------------------------ reset recolor
        page.keyboard.press("o")
        page.wait_for_timeout(150)
        page.evaluate(
            "document.querySelectorAll('#panel details').forEach(d => d.open = true)")
        page.click("#presets .preset-btn[data-preset='graphite']")
        page.check("#lowResIn")
        page.check("#scanIn")
        page.wait_for_timeout(150)
        check("setup: graphite + retro on", page.evaluate(
            "window.PIPELINE.settings.preset === 'graphite'"
            " && window.PIPELINE.settings.lowRes && window.PIPELINE.settings.scanlines"))
        page.click("#resetBtn")
        page.wait_for_timeout(300)
        res = page.evaluate("""async () => {
          const P = window.PIPELINE;
          const { PRESETS } = await import('./js/settings.js');
          const p1995 = PRESETS['1995'];
          const r = P.renderer;
          const C = r.scene.background.constructor;
          const out = {};
          out.settings =
            P.settings.preset === '1995' && P.settings.lowRes === false &&
            P.settings.scanlines === false && P.world.seed === 1337;
          out.palette = r.palette.hues.join() === p1995.hues.join()
            && r.palette.bg === p1995.bg;
          out.background =
            r.scene.background.getHexString() === new C(p1995.bg).getHexString();
          out.material = [r.matSolid, r.matFade, r.matElbowSolid, r.matElbowFade]
            .every(m => m.shininess === p1995.shininess
              && m.specular.getHexString() === new C(p1995.specular).getHexString());
          const hues = p1995.hues.map(h => new C(h));
          let recolored = true, seen = 0, bad = -1;
          for (const v of r.views.values()) {
            for (const rec of v.records) {
              const a = rec.handle.batch.mesh.instanceColor.array;
              const i = rec.handle.index * 3;
              const w = hues[rec.tint % hues.length];
              seen++;
              if (Math.abs(a[i]-w.r) > 1e-5 || Math.abs(a[i+1]-w.g) > 1e-5
                  || Math.abs(a[i+2]-w.b) > 1e-5) { recolored = false; bad = i; break; }
            }
          }
          out.recolored = recolored; out.seen = seen; out.bad = bad;
          return out;
        }""")
        check("reset: settings -> 1995/retro-off/seed 1337", res["settings"])
        check("reset: palette + material + background to 1995",
              res["palette"] and res["material"] and res["background"], str(res))
        check("reset: every live instance recolored to 1995 hues",
              res["recolored"] and res["seen"] > 0,
              f"seen={res['seen']} bad={res['bad']}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(ART, "review-reset-1995.png"))

        # ---------------------------------- paused same-task R then S
        page.evaluate(
            "document.body.dispatchEvent("
            "new KeyboardEvent('keydown', {code:'Space', bubbles:true}))")
        check("paused for same-task R+S",
              page.evaluate("window.PIPELINE.isPaused()") is True)
        old_seed = page.evaluate("window.PIPELINE.world.seed")
        old_views = page.evaluate("window.PIPELINE.renderer.views.size")
        # spy toBlob: capture whether the renderer views already reflect the
        # NEW world at the moment the blob is produced, then pass through to
        # the real toBlob so a genuine download still happens
        page.evaluate("""() => {
          const c = document.getElementById('gl');
          window.__origToBlob = c.toBlob.bind(c);
          c.toBlob = (cb, mime) => {
            const P = window.PIPELINE;
            window.__cap = {
              seed: P.world.seed,
              views: P.renderer.views.size,
              paths: P.world.paths.size,
              committed: [...P.renderer.views.values()]
                .reduce((s, v) => s + v.committed, 0),
              dirs: [...P.world.paths.values()]
                .reduce((s, p) => s + p.dirs.length, 0),
              pieces: P.renderer.diag().pieces,
            };
            window.__origToBlob(cb, mime);
          };
        }""")
        with page.expect_download(timeout=5000) as dl:
            page.evaluate("""() => {
              for (const code of ['KeyR', 'KeyS']) {
                document.body.dispatchEvent(
                  new KeyboardEvent('keydown', {code, bubbles: true}));
              }
            }""")
        cap = page.evaluate("window.__cap")
        new_seed = page.evaluate("window.PIPELINE.world.seed")
        check("R then S same task: new seed", new_seed != old_seed,
              f"{old_seed} -> {new_seed}")
        check("R then S: renderer synced new world before toBlob",
              cap["views"] == cap["paths"] and cap["committed"] == cap["dirs"]
              and cap["pieces"] > 0,
              f"views {old_views}->{cap['views']} paths={cap['paths']} "
              f"committed={cap['committed']} dirs={cap['dirs']} pieces={cap['pieces']}")
        path = dl.value.path()
        size = os.path.getsize(path)
        name = dl.value.suggested_filename
        check("R then S: real PNG download named for NEW seed",
              name.startswith(f"pipeline-{new_seed}-") and name.endswith(".png")
              and size > 10000, f"{name} {size}b")

        # ---------------------------------- async failure paths
        def status():
            return page.evaluate(
                "document.getElementById('headStatus').textContent")

        # null blob
        page.evaluate("() => { document.getElementById('gl').toBlob = cb => cb(null); }")
        page.evaluate(
            "document.body.dispatchEvent("
            "new KeyboardEvent('keydown', {code:'KeyS', bubbles:true}))")
        check("null blob -> snapshot failed", status() == "snapshot failed",
              status())

        # createObjectURL throws inside the async callback
        page.evaluate("""() => {
          const c = document.getElementById('gl');
          c.toBlob = window.__origToBlob;
          window.__revoked = [];
          window.__urls = 0;
          URL.createObjectURL = () => { window.__urls++; throw new Error('refused'); };
          URL.revokeObjectURL = u => window.__revoked.push(u);
        }""")
        page.evaluate(
            "document.body.dispatchEvent("
            "new KeyboardEvent('keydown', {code:'KeyS', bubbles:true}))")
        page.wait_for_timeout(200)
        check("createObjectURL throw -> snapshot failed",
              status() == "snapshot failed", status())
        check("createObjectURL throw: url attempted, none dangling",
              page.evaluate("window.__urls === 1 && window.__revoked.length === 0"))

        # anchor.click throws: minted URL must still be revoked
        page.evaluate("""() => {
          URL.createObjectURL = () => 'blob:spy-1';
          const oc = document.createElement.bind(document);
          document.createElement = t => {
            const el = oc(t);
            if (t === 'a') el.click = () => { throw new Error('click refused'); };
            return el;
          };
        }""")
        page.evaluate(
            "document.body.dispatchEvent("
            "new KeyboardEvent('keydown', {code:'KeyS', bubbles:true}))")
        page.wait_for_timeout(1200)  # revoke is deferred (setTimeout)
        check("anchor click throw -> snapshot failed",
              status() == "snapshot failed", status())
        check("anchor click throw: URL revoked anyway",
              page.evaluate("window.__revoked.includes('blob:spy-1')"))
        page.evaluate("delete window.__cap")  # leave page tidy
        page.screenshot(path=os.path.join(ART, "review-snapshot-fail.png"))

        browser.close()

    check("no page/console errors", len(page_errors) == 0,
          "; ".join(page_errors[:5]))
    failed = [n for n, ok in results if not ok]
    emit(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    with open(os.path.join(ART, "review-fixes-browser.txt"), "w") as f:
        f.write("\n".join(out_lines) + "\n")
    if failed:
        emit("FAILED:")
        for n in failed:
            emit(f"  {n}")
        sys.exit(1)


if __name__ == "__main__":
    main()
