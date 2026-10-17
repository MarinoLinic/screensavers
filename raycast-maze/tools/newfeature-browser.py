"""Maze low-res/scanlines browser check — local Playwright, no downloads.

Requires the static server:  python -m http.server 8096 --bind 127.0.0.1
Covers: legacy defaults, G/Q toggles + labels, persistence across reload,
responsive footer, PNG capture. Writes screenshots + log to artifacts/.
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8096"
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
            viewport={"width": 1280, "height": 720}, accept_downloads=True)
        page = ctx.new_page()
        page.on("console", lambda m: console_lines.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: console_lines.append(f"[pageerror] {e}"))
        page.goto(BASE + "/index.html")
        page.wait_for_function("window.Maze3D && window.Maze3D.game", timeout=8000)
        page.wait_for_timeout(600)

        # ---------- legacy defaults ----------
        g = "window.Maze3D.game"
        check("legacy defaults: scanlines + lowRes on",
              page.evaluate(f"{g}.scanlines === true && {g}.lowRes === true"))
        check("defaults: scanline overlay visible",
              page.evaluate("!document.getElementById('scanlines').hidden"))
        check("defaults: body.low-res",
              page.evaluate("document.body.classList.contains('low-res')"))
        check("footer labels",
              page.evaluate(
                  "document.getElementById('scanlines-button').textContent"
                  " === 'SCANLINES [G]: ON'"
                  " && document.getElementById('low-res-button').textContent"
                  " === 'LOW RES [Q]: ON'"
                  " && document.getElementById('map-button').textContent"
                  " === 'MAP [M]: OFF'"
                  " && document.getElementById('fullscreen-button').textContent"
                  " === 'FULLSCREEN [F]'"
                  " && document.getElementById('reset-button').textContent"
                  " === 'RESET [R]'"))
        lo_w = page.evaluate(f"{g}.renderer.width")
        check("low-res buffer <= 800 wide", lo_w <= 800, f"w={lo_w}")

        # enter the maze (intro modal)
        page.click("#enter-button")
        page.wait_for_timeout(800)
        check("entered maze", page.evaluate(f"{g}.started === true"))
        page.screenshot(path=os.path.join(ART, "maze-lowres-scan.png"))

        # ---------- G: scanlines off ----------
        lvl0 = page.evaluate(f"{g}.levelIndex")
        page.keyboard.press("g")
        page.wait_for_timeout(150)
        check("G hides scanlines",
              page.evaluate("document.getElementById('scanlines').hidden"
                            " && window.Maze3D.game.scanlines === false"))
        check("G updates label",
              page.evaluate("document.getElementById('scanlines-button')"
                            ".textContent === 'SCANLINES [G]: OFF'"
                            " && document.getElementById('scanlines-button')"
                            ".getAttribute('aria-pressed') === 'false'"))
        check("G does not change level",
              page.evaluate(f"{g}.levelIndex") == lvl0)
        page.screenshot(path=os.path.join(ART, "maze-scan-off.png"))

        # ---------- Q: full res ----------
        page.keyboard.press("q")
        page.wait_for_timeout(300)
        hi_w = page.evaluate(f"{g}.renderer.width")
        hi_h = page.evaluate(f"{g}.renderer.height")
        check("Q enlarges buffer", hi_w > lo_w, f"{lo_w} -> {hi_w}")
        check("Q clears body.low-res + label",
              page.evaluate("!document.body.classList.contains('low-res')"
                            " && document.getElementById('low-res-button')"
                            ".textContent === 'LOW RES [Q]: OFF'"))
        check("full-res buffer <= 1280x720", hi_w <= 1280 and hi_h <= 720,
              f"{hi_w}x{hi_h}")
        check("Q does not change level",
              page.evaluate(f"{g}.levelIndex") == lvl0)
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(ART, "maze-fullres.png"))

        # ---------- persistence across reload ----------
        page.reload()
        page.wait_for_function("window.Maze3D && window.Maze3D.game",
                               timeout=8000)
        page.wait_for_timeout(500)
        check("reload: toggles persisted",
              page.evaluate(f"{g}.scanlines === false && {g}.lowRes === false"))
        check("reload: labels restored",
              page.evaluate("document.getElementById('scanlines-button')"
                            ".textContent === 'SCANLINES [G]: OFF'"
                            " && document.getElementById('low-res-button')"
                            ".textContent === 'LOW RES [Q]: OFF'"))
        page.click("#enter-button")
        page.wait_for_timeout(500)
        check("reload: no scanline overlay, full-res body",
              page.evaluate("document.getElementById('scanlines').hidden"
                            " && !document.body.classList.contains('low-res')"))

        # restore legacy look for the rest of the run
        page.keyboard.press("g")
        page.keyboard.press("q")
        page.wait_for_timeout(250)
        check("restore: scanlines + lowRes back on",
              page.evaluate("!document.getElementById('scanlines').hidden"
                            " && document.body.classList.contains('low-res')"))

        # ---------- responsive footer ----------
        page.set_viewport_size({"width": 700, "height": 500})
        page.wait_for_timeout(400)
        foot = page.evaluate("""() => {
          const r = document.getElementById('controls').getBoundingClientRect();
          return { left: r.left, right: r.right, bottom: r.bottom,
                   w: window.innerWidth, h: window.innerHeight };
        }""")
        check("narrow viewport: footer inside",
              foot["left"] >= -1 and foot["right"] <= foot["w"] + 1
              and foot["bottom"] <= foot["h"] + 1, str(foot))
        page.screenshot(path=os.path.join(ART, "maze-narrow-footer.png"))
        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(400)

        # ---------- PNG capture ----------
        with page.expect_download(timeout=8000) as dl:
            page.keyboard.press("c")
        d = dl.value
        fname = d.suggested_filename
        path = d.path()
        size = os.path.getsize(path)
        check("C captures PNG",
              fname.startswith("maze3d-sector-") and fname.endswith(".png")
              and size > 20000, f"{fname} {size}b")
        d.save_as(os.path.join(ART, fname))
        ctx.close()
        browser.close()

    errs = [l for l in console_lines
            if l.startswith("[error]") or l.startswith("[pageerror]")]
    check("no console errors", len(errs) == 0, "; ".join(errs[:5]))

    failed = [n for n, ok in results if not ok]
    emit(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    with open(os.path.join(ART, "newfeature-browser.txt"), "w") as f:
        f.write("\n".join(out_lines) + "\n\n# console\n" + "\n".join(console_lines) + "\n")
    if failed:
        emit("FAILED:")
        for n in failed:
            emit(f"  {n}")
        sys.exit(1)


if __name__ == "__main__":
    main()
