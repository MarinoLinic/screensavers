"""PIPELINE browser smoke test — local Playwright, no downloads.

Requires the static server:  python -m http.server 8095 --bind 127.0.0.1
Writes screenshots, console log, and this output to artifacts/.
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


def skip(name, detail=""):
    emit(f"SKIP {name} {detail}")


def attach_console(page, sink=None):
    sink = console_lines if sink is None else sink

    def on_msg(msg):
        sink.append(f"[{msg.type}] {msg.text}")

    page.on("console", on_msg)
    page.on("pageerror", lambda e: sink.append(f"[pageerror] {e}"))


def console_errors():
    return [l for l in console_lines if l.startswith("[error]") or l.startswith("[pageerror]")]


def main():
    fail_console = []  # expected errors from the forced-WebGL-failure page
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ------------------------------------------------ desktop
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900}, accept_downloads=True
        )
        page = ctx.new_page()
        attach_console(page)
        page.goto(BASE + "/index.html")
        page.wait_for_function("window.PIPELINE && window.PIPELINE.world", timeout=8000)
        page.wait_for_timeout(2600)  # settle past prewarm so the scene is rich

        # ---------- chrome surface ----------
        check("default: settings panel closed",
              page.evaluate("window.PIPELINE.isPanelOpen()") is False
              and page.evaluate("document.getElementById('panel').hidden") is True)
        check("default: no title/stats on stage",
              page.evaluate(
                  "[...document.querySelectorAll('#stage h1, #stage h2, #stage .stat-grid,"
                  " #stage [id^=st]')].filter(e => !e.closest('#webglFail')).length") == 0)
        check("default: key strip visible",
              page.evaluate("!document.getElementById('keystrip').hidden"))
        n_cards = page.evaluate("document.querySelectorAll('#presets .preset-btn').length")
        check("default: ten style cards", n_cards == 10, f"cards={n_cards}")
        check("no facets UI",
              page.evaluate(
                  "document.querySelectorAll('[id*=facet],[name*=facet]').length === 0"
                  " && !document.body.textContent.toLowerCase().includes('facet')"))

        diag = page.evaluate("window.PIPELINE.renderer.diag()")
        counts = page.evaluate("window.PIPELINE.world.counts()")
        dim = page.evaluate("window.PIPELINE.world.dim")
        total = page.evaluate("window.PIPELINE.world.totalCells")
        check("desktop: dimension 21", dim == 21 and total == 9261,
              f"dim={dim} total={total}")
        check("desktop: scene populated", counts["occupied"] > 30,
              f"occupied={counts['occupied']}")
        check("desktop: instanced pieces drawn", diag["pieces"] > 30,
              f"pieces={diag['pieces']}")
        check("desktop: draw calls batched", diag["calls"] <= 6,
              f"calls={diag['calls']}")
        check("desktop: geometries bounded", diag["geometries"] <= 6,
              f"geo={diag['geometries']}")
        expected_home = page.evaluate("""() => {
          const w = window.PIPELINE.world;
          const R = Math.sqrt(3) * (w.dim / 2 + 0.2);
          const vHalf = 50 * Math.PI / 360;
          const s = document.getElementById('stage');
          const hHalf = Math.atan(Math.tan(vHalf) * (s.clientWidth / s.clientHeight));
          return R / Math.sin(Math.min(vHalf, hHalf)) * 1.02;
        }""")
        check("desktop: aspect-fit home distance",
              abs(diag["home"] - expected_home) < 0.5,
              f"home={diag['home']:.1f} expected={expected_home:.1f}")
        check("webgl fallback hidden while rendering",
              page.evaluate("document.getElementById('webglFail').hidden"))
        page.screenshot(path=os.path.join(ART, "desktop.png"))

        # ---------- panel open/close ----------
        page.keyboard.press("o")
        page.wait_for_timeout(150)
        check("O opens settings", page.evaluate("window.PIPELINE.isPanelOpen()"))
        check("panel is dialog", page.evaluate(
            "document.getElementById('panel').getAttribute('role') === 'dialog'"))
        check("panel shows cell budget", page.evaluate(
            "document.getElementById('budgetNote').textContent.includes('9261')"))
        page.screenshot(path=os.path.join(ART, "desktop-settings.png"))

        # sim keeps running while the panel is open (opening never pauses)
        tp0 = page.evaluate("window.PIPELINE.world.time")
        page.wait_for_timeout(300)
        tp1 = page.evaluate("window.PIPELINE.world.time")
        check("panel open keeps sim running", tp1 > tp0, f"{tp0:.2f} -> {tp1:.2f}")

        # editable guard: typing inside the seed field must not fire shortcuts
        # (expand the collapsed groups so their inputs are interactable)
        page.evaluate(
            "document.querySelectorAll('#panel details').forEach(d => d.open = true)")
        page.click("#seedIn")
        page.keyboard.press("o")
        page.keyboard.press("r")
        seed0 = page.evaluate("window.PIPELINE.world.seed")
        check("editable guard: typing in seed field",
              page.evaluate("window.PIPELINE.isPanelOpen()")
              and page.evaluate("window.PIPELINE.world.seed") == seed0
              and page.evaluate("window.PIPELINE.isPaused()") is False)

        # select guard: a focused <select> keeps native typeahead/digits —
        # only O still manages the panel
        page.evaluate("document.getElementById('jointsSel').focus()")
        preset0 = page.evaluate("window.PIPELINE.settings.preset")
        joints0 = page.evaluate("window.PIPELINE.settings.joints")
        for k in ("r", "j", "1", "0"):
            page.keyboard.press(k)
        check("select guard: r/j/digits are native",
              page.evaluate("window.PIPELINE.settings.joints") == joints0
              and page.evaluate("window.PIPELINE.world.seed") == seed0
              and page.evaluate("window.PIPELINE.settings.preset") == preset0)
        page.keyboard.press("o")
        check("O closes panel from a focused select",
              page.evaluate("window.PIPELINE.isPanelOpen()") is False)
        page.keyboard.press("o")  # reopen for the rest of this section

        # Space on a focused button is native activation, not pause
        page.click("#panelClose")
        # panelClose click closes the panel; reopen to test button-space
        page.keyboard.press("o")
        page.wait_for_timeout(120)
        page.evaluate("document.getElementById('panelClose').focus()")
        page.keyboard.press("Space")
        check("space on button not pause",
              page.evaluate("window.PIPELINE.isPaused()") is False)

        # repeat + modifier guards
        page.evaluate(
            "document.body.dispatchEvent(new KeyboardEvent('keydown',"
            " {code:'Space', bubbles:true, repeat:true}))")
        check("repeat guard", page.evaluate("window.PIPELINE.isPaused()") is False)
        page.keyboard.down("Control")
        page.keyboard.press("r")
        page.keyboard.up("Control")
        check("modifier guard: ctrl+r no reseed",
              page.evaluate("window.PIPELINE.world.seed") == seed0)

        # Esc closes and returns canvas focus
        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
        check("Esc closes settings",
              page.evaluate("window.PIPELINE.isPanelOpen()") is False)
        check("Esc returns canvas focus", page.evaluate(
            "document.activeElement === document.getElementById('gl')"))
        # O re-opens (toggle keeps working after panel focus)
        page.keyboard.press("o")
        check("O toggles open again", page.evaluate("window.PIPELINE.isPanelOpen()"))
        page.keyboard.press("o")
        check("O toggles closed", page.evaluate("window.PIPELINE.isPanelOpen()") is False)

        # ---------- pause ----------
        page.click("#kPause")
        check("pause: flag set", page.evaluate("window.PIPELINE.isPaused()") is True)
        t0 = page.evaluate("window.PIPELINE.world.time")
        page.wait_for_timeout(600)
        t1 = page.evaluate("window.PIPELINE.world.time")
        check("pause: sim clock frozen", abs(t1 - t0) < 1e-6, f"{t0} -> {t1}")

        # screenshot while paused must still be a real PNG (no preserveDrawingBuffer)
        with page.expect_download(timeout=5000) as dl:
            page.keyboard.press("s")
        path = dl.value.path()
        size = os.path.getsize(path)
        check("snapshot png while paused", size > 10000, f"{size} bytes")
        dl.value.save_as(os.path.join(ART, "snapshot.png"))

        page.click("#kPause")
        page.wait_for_timeout(400)
        t2 = page.evaluate("window.PIPELINE.world.time")
        check("resume: clock advances", t2 > t1, f"{t1} -> {t2}")

        # ---------- hidden tab ----------
        try:
            page.evaluate("""() => {
              Object.defineProperty(document, 'hidden', {get: () => true, configurable: true});
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            th0 = page.evaluate("window.PIPELINE.world.time")
            page.wait_for_timeout(500)
            th1 = page.evaluate("window.PIPELINE.world.time")
            page.evaluate("""() => {
              Object.defineProperty(document, 'hidden', {get: () => false, configurable: true});
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            page.wait_for_timeout(150)
            th2 = page.evaluate("window.PIPELINE.world.time")
            check("hidden: no growth while hidden", abs(th1 - th0) < 1e-6, f"{th0} -> {th1}")
            check("hidden: no return jump", th2 - th1 < 0.3, f"{th1} -> {th2}")
        except Exception as e:
            skip("hidden-tab stub", str(e))

        # ---------- live settings (panel must be open for its inputs) ----------
        page.keyboard.press("o")
        page.evaluate("document.getElementById('speedIn').value = 2.5")
        page.dispatch_event("#speedIn", "input")
        speed = page.evaluate("window.PIPELINE.settings.speed")
        check("settings: pace live", abs(speed - 2.5) < 1e-9, f"speed={speed}")
        page.evaluate("document.getElementById('speedIn').value = 1")
        page.dispatch_event("#speedIn", "input")

        for raw in ("", "1.5", "2147483648"):
            page.fill("#seedIn", raw)
            page.click("#seedBtn")
            page.wait_for_timeout(80)
        check("seed rejects blank/fraction/overflow",
              page.evaluate("window.PIPELINE.world.seed") == seed0)
        page.fill("#seedIn", "42")
        page.click("#seedBtn")
        page.wait_for_timeout(300)
        check("seed apply", page.evaluate("window.PIPELINE.world.seed") == 42)
        page.fill("#seedIn", "0")
        page.click("#seedBtn")
        page.wait_for_timeout(200)
        check("seed 0 accepted", page.evaluate("window.PIPELINE.world.seed") == 0)

        # reset defaults restores the FULL defaults — switch to a non-1995
        # style first so the renderer recolor is actually proven
        page.click("#presets .preset-btn[data-preset='graphite']")
        page.check("#lowResIn")
        page.check("#scanIn")
        page.wait_for_timeout(150)
        page.click("#resetBtn")
        page.wait_for_timeout(300)
        reset_ok = page.evaluate("""async () => {
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
          // every live record's instanceColor must be a 1995 hue at its tint
          const hues = p1995.hues.map(h => new C(h));
          let recolored = true, seen = 0;
          for (const v of r.views.values()) {
            for (const rec of v.records) {
              const a = rec.handle.batch.mesh.instanceColor.array;
              const i = rec.handle.index * 3;
              const w = hues[v.tint % hues.length];
              seen++;
              if (Math.abs(a[i]-w.r) > 1e-5 || Math.abs(a[i+1]-w.g) > 1e-5
                  || Math.abs(a[i+2]-w.b) > 1e-5) { recolored = false; break; }
            }
          }
          out.recolored = recolored;
          out.seen = seen;
          return out;
        }""")
        check("reset defaults: settings + seed",
              reset_ok["settings"], str(reset_ok.get("settings")))
        check("reset defaults: palette/material/background",
              reset_ok["palette"] and reset_ok["material"] and reset_ok["background"],
              str(reset_ok))
        check("reset defaults: live instances recolored to 1995 hues",
              reset_ok["recolored"] and reset_ok["seen"] > 0,
              f"seen={reset_ok.get('seen')}")
        page.keyboard.press("Escape")

        # candy at full resolution for visual evidence
        page.keyboard.press("4")
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(ART, "style-candy.png"))
        check("digit selects candy",
              page.evaluate("window.PIPELINE.settings.preset") == "candy")

        # low-res is global and survives preset changes
        page.keyboard.press("o")
        page.check("#lowResIn")
        page.wait_for_timeout(200)
        w = page.evaluate("document.getElementById('gl').width")
        check("lowres: internal 640", w == 640, f"canvas.width={w}")
        page.keyboard.press("Escape")  # close panel for style keys
        page.keyboard.press("2")       # foundry
        page.wait_for_timeout(150)
        check("preset switch keeps lowRes",
              page.evaluate("window.PIPELINE.settings.lowRes === true"
                            " && window.PIPELINE.settings.preset === 'foundry'"))
        page.keyboard.press("o")
        page.uncheck("#lowResIn")
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # style cycling: brackets + digits over the ten styles
        for key, shot in (("3", "style-icebox.png"), ("5", "style-porcelain.png"),
                          ("0", "style-graphite.png")):
            page.keyboard.press(key)
            page.wait_for_timeout(250)
            page.screenshot(path=os.path.join(ART, shot))
        check("digit selects style",
              page.evaluate("window.PIPELINE.settings.preset") == "graphite")
        page.keyboard.press("BracketRight")
        check("] cycles to first style",
              page.evaluate("window.PIPELINE.settings.preset") == "1995")
        # styles never touch flow/camera
        check("style switch preserves flow",
              page.evaluate("window.PIPELINE.settings.joints === 'elbows'"
                            " && window.PIPELINE.settings.mode === 'living'"))
        page.keyboard.press("2")  # foundry — warm mid palette for rest of run

        # ---------- auto colour cycle (debug clock — no wall-clock wait) ----
        seed_a = page.evaluate("window.PIPELINE.world.seed")
        occ_a = page.evaluate("window.PIPELINE.world.counts()['occupied']")
        iv0 = page.evaluate(
            "document.getElementById('cycleIntervalSel').disabled")
        check("cycle: interval select disabled until autoCycle", iv0 is True)
        page.keyboard.press("o")
        page.check("#autoCycleIn")
        page.select_option("#cycleIntervalSel", "15")
        page.wait_for_timeout(100)
        check("cycle: interval enabled with autoCycle",
              page.evaluate(
                  "document.getElementById('cycleIntervalSel').disabled") is False)
        page.keyboard.press("Escape")
        cyc = page.evaluate("""() => {
          const P = window.PIPELINE;
          const snap = () => [...P.world.paths.values()]
            .map(p => [p.id, p.growthTint,
                       p.pending, p.pending && p.pending.tint]);
          const t0 = snap();
          P.debugStep(14);            // under the 15s interval
          const held = t0.every(([id, g]) =>
            P.world.paths.get(id).growthTint === g);
          P.debugStep(1.2);           // crosses -> pulse -> queue new colours
          const t1 = snap();
          const queued = t1.filter(([id, g]) =>
            t0.find(([i0]) => i0 === id)?.[1] !== g);
          // same pending object whose tint mutated = in-flight repaint (bug)
          const tipMoved = t1.some(([id, , pend]) => {
            const old = t0.find(([i0]) => i0 === id);
            return old && old[2] && pend === old[2] && pend.tint !== old[3];
          });
          return { held, queued: queued.length, tipMoved,
                   preset: P.settings.preset,
                   stored: JSON.parse(
                     localStorage.getItem('pipes3d.settings.v1')).preset };
        }""")
        check("cycle: no colour change before interval", cyc["held"], str(cyc))
        check("cycle: pulse queues a new tint on growing heads",
              cyc["queued"] > 0, str(cyc))
        check("cycle: in-flight segments keep their tint",
              cyc["tipMoved"] is False, str(cyc))
        check("cycle: preset untouched by colour pulse",
              cyc["preset"] == "foundry" and cyc["stored"] == "foundry",
              str(cyc))
        check("cycle: world untouched by colour request",
              page.evaluate("window.PIPELINE.world.seed") == seed_a
              and page.evaluate("window.PIPELINE.world.counts()['occupied']")
              >= occ_a)
        # bands appear once queued colours commit at segment boundaries
        page.evaluate("""() => { const P = window.PIPELINE;
          for (let i = 0; i < 90; i++) P.debugStep(0.3); }""")
        check("cycle: banded growth visible on screen paths",
              page.evaluate(
                  "[...window.PIPELINE.world.paths.values()]"
                  ".some(p => new Set(p.tints).size > 1)"))
        # paused clock freezes the countdown AND the queued colours
        page.keyboard.press("Space")
        page.wait_for_timeout(120)
        frz = page.evaluate("""() => {
          const P = window.PIPELINE;
          const g = () => [...P.world.paths.values()]
            .map(p => p.growthTint).join(',');
          const e0 = P.styleCycle.elapsed, g0 = g();
          P.debugStep(30);
          return { e0, e1: P.styleCycle.elapsed, g0, g1: g(),
                   preset: P.settings.preset };
        }""")
        check("cycle: paused freezes countdown + colour queue",
              frz["e1"] == frz["e0"] and frz["g1"] == frz["g0"]
              and frz["preset"] == "foundry", str(frz))
        page.keyboard.press("Space")
        page.wait_for_timeout(120)
        # restore manual look for the rest of the run (change handler
        # resets the countdown, syncs the UI, and persists)
        page.keyboard.press("o")
        page.uncheck("#autoCycleIn")
        page.keyboard.press("Escape")

        # ---------- pixel workshop (2.5D) ----------
        page.keyboard.press("o")
        page.evaluate(
            "document.querySelectorAll('#panel details').forEach(d => d.open = true)")
        page.check("#pixelModeIn")
        page.wait_for_timeout(200)
        pix = page.evaluate("""() => {
          const r = window.PIPELINE.renderer;
          const c = document.getElementById('gl');
          return { ortho: r.pixelMode && r.camera === r.cameraOrtho,
                   fogOff: r.scene.fog === null,
                   w: c.width, h: c.height,
                   cssW: c.clientWidth, cssH: c.clientHeight,
                   uniform: r._palU.uPixelMode.value,
                   pixelCls: document.body.classList.contains('pixelmode') };
        }""")
        check("pixel: ortho camera + fog off",
              pix["ortho"] and pix["fogOff"], str(pix))
        check("pixel: coarse buffer + pixelated class",
              pix["w"] <= 480 and pix["w"] < pix["cssW"] and pix["pixelCls"],
              f"{pix['w']}x{pix['h']} of {pix['cssW']}x{pix['cssH']}")
        check("pixel: shader uniform on", pix["uniform"] == 1)
        # pixel mode + lowRes are independent, stacking caps the buffer lower
        page.check("#lowResIn")
        page.wait_for_timeout(120)
        lw = page.evaluate("document.getElementById('gl').width")
        check("pixel: lowRes stacks to <=320 buffer", lw <= 320, f"w={lw}")
        page.uncheck("#lowResIn")
        page.wait_for_timeout(120)
        page.keyboard.press("Escape")
        # wheel zoom still works through the ortho camera
        z0 = page.evaluate("window.PIPELINE.renderer.cameraOrtho.zoom")
        page.mouse.move(700, 450)
        page.mouse.wheel(0, -240)
        page.wait_for_timeout(80)
        z1 = page.evaluate("window.PIPELINE.renderer.cameraOrtho.zoom")
        check("pixel: wheel zoom via ortho.zoom", z1 > z0,
              f"{z0:.3f} -> {z1:.3f}")
        page.keyboard.press("4")  # candy — vivid palette for the pixel shot
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(ART, "pixel-candy.png"))
        # persisted across reload; panel still closed by default
        page.reload()
        page.wait_for_function(
            "window.PIPELINE && window.PIPELINE.world", timeout=8000)
        page.wait_for_timeout(600)
        check("pixel: mode + style persist reload",
              page.evaluate("window.PIPELINE.settings.pixelMode === true"
                            " && window.PIPELINE.renderer.pixelMode === true"
                            " && window.PIPELINE.settings.preset === 'candy'"
                            " && window.PIPELINE.settings.lowRes === false"))
        check("reload: pixelmode body class + crisp canvas CSS",
              page.evaluate(
                  "document.body.classList.contains('pixelmode')"
                  " && ['pixelated','crisp-edges'].includes("
                  " getComputedStyle(document.getElementById('gl'))"
                  ".imageRendering)"))
        check("reload: settings panel closed",
              page.evaluate("window.PIPELINE.isPanelOpen()") is False)
        page.keyboard.press("p")
        page.wait_for_timeout(200)
        check("pixel: toggle off restores perspective",
              page.evaluate(
                  "window.PIPELINE.renderer.pixelMode === false"
                  " && window.PIPELINE.renderer.camera ==="
                  " window.PIPELINE.renderer.cameraPersp"
                  " && window.PIPELINE.settings.pixelMode === false"))

        # ---------- hide / restore ----------
        page.keyboard.press("h")
        check("H hides key strip",
              page.evaluate("document.getElementById('keystrip').hidden"))
        page.screenshot(path=os.path.join(ART, "hidden-ui.png"))
        page.keyboard.press("Escape")
        check("Esc restores strip",
              page.evaluate("!document.getElementById('keystrip').hidden"))

        # ---------- camera ----------
        yaw0 = page.evaluate("window.PIPELINE.renderer.diag().yaw")
        page.mouse.move(700, 450)
        page.mouse.down()
        page.mouse.move(820, 450, steps=8)
        page.mouse.up()
        yaw1 = page.evaluate("window.PIPELINE.renderer.diag().yaw")
        check("right drag orbits right", yaw1 - yaw0 > 0.3,
              f"{yaw0:.3f} -> {yaw1:.3f}")

        # right-button drag must not orbit (pause so auto-rotate can't
        # contaminate the baseline; orbit drag itself doesn't need the loop)
        page.keyboard.press("Space")
        yaw1 = page.evaluate("window.PIPELINE.renderer.diag().yaw")
        page.mouse.move(700, 450)
        page.mouse.down(button="right")
        page.mouse.move(850, 450, steps=6)
        page.mouse.up(button="right")
        yaw2 = page.evaluate("window.PIPELINE.renderer.diag().yaw")
        check("non-left button never drags", abs(yaw2 - yaw1) < 0.02,
              f"yaw drifted {yaw2 - yaw1:.3f}")
        page.keyboard.press("Space")

        # A toggles auto-orbit camera
        page.keyboard.press("a")
        check("A toggles camera",
              page.evaluate("window.PIPELINE.settings.camera") == "fixed")
        page.keyboard.press("a")

        # fullscreen on the document (strip + panel remain usable)
        page.click("#kFs")
        page.wait_for_timeout(400)
        fs = page.evaluate("document.fullscreenElement === document.documentElement")
        if fs:
            check("fullscreen covers document", True)
            page.evaluate("document.exitFullscreen()")
            page.wait_for_timeout(300)
        elif page.evaluate("!document.documentElement.requestFullscreen"):
            skip("fullscreen", "requestFullscreen unsupported")
        else:
            check("fullscreen covers document", False,
                  "requestFullscreen exists but fullscreen refused")

        # ---------- joints cycle + pending-tip reveal ----------
        page.keyboard.press("j")
        page.wait_for_timeout(300)
        check("J cycles joints to ball",
              page.evaluate("window.PIPELINE.settings.joints") == "ball")
        page.keyboard.press("j")
        check("J cycles joints to mixed",
              page.evaluate("window.PIPELINE.settings.joints") == "mixed")
        page.keyboard.press("j")
        check("J cycles back to elbows",
              page.evaluate("window.PIPELINE.settings.joints") == "elbows")

        # growing-bend preview: after a commit, some path shows a partially
        # revealed elbow tip (instanceReveal < 1 on the elbow batch)
        reveal = page.evaluate("""() => {
          const w = window.PIPELINE.world;
          for (let i = 0; i < 200; i++) w.step(0.02);
          const r = window.PIPELINE.renderer;
          r.update(w);
          const attr = r.solid.elbow.revealAttr;
          let min = Infinity, count = 0;
          for (const v of r.views.values()) {
            if (v.tip.elbow) { count++; min = Math.min(min, attr.array[v.tip.elbow.index]); }
          }
          return { hasAttr: !!attr, partial: count > 0 && min < 1, count };
        }""")
        check("elbow reveal attribute on batch", reveal["hasAttr"])
        check("growing bend preview after commit", reveal["partial"],
              f"tips with elbows={reveal['count']}")

        # mode switch during classic reset must not strand the world
        page.evaluate("""() => {
          const w = window.PIPELINE.world;
          w.updateSettings({...w.settings, mode: 'classic', density: 0.1});
          for (let i = 0; i < 4000 && !w.resetting; i++) w.step(0.05);
        }""")
        was_resetting = page.evaluate("window.PIPELINE.world.resetting")
        page.keyboard.press("o")
        page.select_option("#modeSel", "living")  # app reseeds same seed
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        now_ok = page.evaluate("window.PIPELINE.world.resetting === false && window.PIPELINE.world.stats.commits > 0")
        check("mode switch unstrands world", was_resetting and now_ok,
              f"resetting={was_resetting} -> False, commits>0={now_ok}")

        # capacity growth: alloc past the 256-slot floor on a live batch —
        # doubles, geometry count untouched, buffers copied. Growth disposes
        # the old instance attributes first, so allow a frame for re-upload.
        growth = page.evaluate("""async () => {
          const b = window.PIPELINE.renderer.solid.tube;
          const before = b.capacity;
          const geo = window.PIPELINE.renderer.diag().geometries;
          const hs = [];
          for (let i = 0; i < before + 4; i++) { const h = b.alloc(); if (h) hs.push(h); }
          const grown = b.capacity;
          for (const h of hs) b.free(h);
          await new Promise(r => requestAnimationFrame(
            () => requestAnimationFrame(r)));
          const geoAfter = window.PIPELINE.renderer.diag().geometries;
          return { before, grown, geo, geoAfter };
        }""")
        check("batch growth doubles capacity in place",
              growth["grown"] >= growth["before"] * 2,
              f"{growth['before']} -> {growth['grown']}")
        check("batch growth adds no geometries",
              growth["geoAfter"] == growth["geo"],
              f"{growth['geo']} -> {growth['geoAfter']}")

        # ---------- aging: bounded dense batches ----------
        geo0 = page.evaluate("window.PIPELINE.renderer.diag().geometries")
        page.evaluate("for (let i = 0; i < 4000; i++) window.PIPELINE.world.step(0.05)")
        page.wait_for_timeout(800)
        d3 = page.evaluate("window.PIPELINE.renderer.diag()")
        c3 = page.evaluate("window.PIPELINE.world.counts()")
        max_paths = page.evaluate("window.PIPELINE.world.cfg.maxPaths")
        piece_bound = 2 * total + 3 * max_paths  # tube+joint per cell + caps/tips
        check("aging: retired pipes", c3["retired"] > 0, f"retired={c3['retired']}")
        check("aging: pieces bounded", d3["pieces"] <= piece_bound,
              f"pieces={d3['pieces']} bound={piece_bound}")
        check("aging: calls bounded", d3["calls"] <= 6, f"calls={d3['calls']}")
        check("aging: geometries stable", d3["geometries"] == geo0,
              f"{geo0} -> {d3['geometries']}")
        check("aging: scene still alive", c3["occupied"] > 10,
              f"occupied={c3['occupied']}")
        check("aging: at most one fading path", c3["fading"] <= 1,
              f"fading={c3['fading']}")
        page.screenshot(path=os.path.join(ART, "desktop-aged.png"))
        ctx.close()

        # ------------------------------------------------ webgl-fail page
        fctx = browser.new_context(viewport={"width": 1200, "height": 800})
        fpage = fctx.new_page()
        attach_console(fpage, fail_console)
        fpage.add_init_script("""(() => {
          const orig = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (t, ...a) {
            if (String(t).toLowerCase().includes('webgl')) return null;
            return orig.call(this, t, ...a);
          };
        })()""")
        fpage.goto(BASE + "/index.html")
        fpage.wait_for_timeout(1500)
        shown = fpage.evaluate("!document.getElementById('webglFail').hidden")
        check("webgl-fail: fallback visible", shown, f"shown={shown}")
        fpage.screenshot(path=os.path.join(ART, "webgl-fail.png"))
        fctx.close()

        # ------------------------------------------------ reduced motion
        rctx = browser.new_context(viewport={"width": 1200, "height": 800},
                                   reduced_motion="reduce")
        rp = rctx.new_page()
        attach_console(rp)
        rp.goto(BASE + "/index.html")
        rp.wait_for_function("window.PIPELINE && window.PIPELINE.world", timeout=8000)
        rp.wait_for_timeout(600)
        check("reduced-motion: camera starts fixed",
              rp.evaluate("window.PIPELINE.settings.camera") == "fixed"
              and rp.evaluate("window.PIPELINE.renderer.orbit.autoRotate") is False)
        ryaw0 = rp.evaluate("window.PIPELINE.renderer.diag().yaw")
        rp.mouse.move(600, 400)
        rp.mouse.down()
        rp.mouse.move(750, 400, steps=6)
        rp.mouse.up()
        ryaw1 = rp.evaluate("window.PIPELINE.renderer.diag().yaw")
        check("reduced-motion: drag still orbits", ryaw1 - ryaw0 > 0.2,
              f"{ryaw0:.3f} -> {ryaw1:.3f}")
        rctx.close()

        # ------------------------------------------------ mobile
        mctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            has_touch=True,
        )
        mp = mctx.new_page()
        attach_console(mp)
        mp.goto(BASE + "/index.html")
        mp.wait_for_function("window.PIPELINE && window.PIPELINE.world", timeout=8000)
        mp.wait_for_timeout(2200)
        mp.screenshot(path=os.path.join(ART, "mobile.png"))
        sw = mp.evaluate("document.documentElement.scrollWidth")
        iw = mp.evaluate("window.innerWidth")
        check("mobile: no horizontal overflow", sw <= iw + 1,
              f"scrollWidth={sw} inner={iw}")
        rect = mp.evaluate("document.getElementById('stage').getBoundingClientRect()")
        check("mobile: stage fills viewport", rect["bottom"] >= 800,
              f"bottom={rect['bottom']:.0f} of 844")
        check("mobile: strip wraps inside viewport",
              mp.evaluate("""() => {
                const r = document.getElementById('keystrip').getBoundingClientRect();
                return r.left >= -1 && r.right <= window.innerWidth + 1;
              }"""))
        strip = mp.evaluate(
            "document.getElementById('keystrip').getBoundingClientRect().width")
        check("mobile: strip uses available width (max-content)",
              strip > 260, f"strip width={strip:.0f}px of 390")
        mp.tap("#kSettings")
        mp.wait_for_timeout(200)
        check("mobile: settings opens via strip",
              mp.evaluate("window.PIPELINE.isPanelOpen()"))
        pr = mp.evaluate("document.getElementById('panel').getBoundingClientRect()")
        check("mobile: panel inside safe viewport",
              pr["left"] >= -1 and pr["right"] <= 391 and pr["height"] <= 844,
              f"panel={pr['left']:.0f},{pr['right']:.0f} h={pr['height']:.0f}")
        # .panel-body is the real scroll host; with all groups expanded the
        # lower sections (Camera·Seed, Diagnostics) must be reachable.
        mp.evaluate(
            "document.querySelectorAll('#panel details').forEach(d => d.open = true)")
        can_scroll = mp.evaluate(
            "document.querySelector('#panel .panel-body').scrollHeight > "
            "document.querySelector('#panel .panel-body').clientHeight + 20")
        if can_scroll:
            mp.evaluate(
                "document.querySelector('#panel .panel-body').scrollTop = 2000")
            scrolled = mp.evaluate(
                "document.querySelector('#panel .panel-body').scrollTop")
            check("mobile: panel-body scrolls", scrolled > 200,
                  f"scrollTop={scrolled}")
            reach = mp.evaluate("""() => {
              const b = document.querySelector('#panel .panel-body');
              const diag = document.getElementById('stSeed');
              const r = diag.getBoundingClientRect();
              const pr = b.getBoundingClientRect();
              return r.bottom <= pr.bottom + 2;
            }""")
            check("mobile: diagnostics reachable at bottom of scroll", reach)
            mp.screenshot(path=os.path.join(ART, "mobile-panel.png"))
        else:
            skip("mobile: panel-body scroll", "panel fits without scrolling")
            mp.screenshot(path=os.path.join(ART, "mobile-panel.png"))
        mctx.close()

        # ------------------------------------------------ small mobile
        sctx = browser.new_context(
            viewport={"width": 320, "height": 568},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            has_touch=True,
        )
        sp = sctx.new_page()
        attach_console(sp)
        sp.goto(BASE + "/index.html")
        sp.wait_for_function("window.PIPELINE && window.PIPELINE.world", timeout=8000)
        sp.wait_for_timeout(1200)
        check("320px: no horizontal overflow",
              sp.evaluate("document.documentElement.scrollWidth") <= 321)
        strip = sp.evaluate(
            "document.getElementById('keystrip').getBoundingClientRect()")
        check("320px: strip inside viewport",
              strip["left"] >= -1 and strip["right"] <= 321,
              f"strip={strip['left']:.0f}..{strip['right']:.0f}")
        sp.tap("#kSettings")
        sp.wait_for_timeout(200)
        pr = sp.evaluate("document.getElementById('panel').getBoundingClientRect()")
        check("320px: panel inside viewport",
              pr["left"] >= -1 and pr["right"] <= 321 and pr["height"] <= 568,
              f"panel={pr['left']:.0f},{pr['right']:.0f} h={pr['height']:.0f}")
        sp.evaluate(
            "document.querySelectorAll('#panel details').forEach(d => d.open = true)")
        sp.evaluate(
            "document.querySelector('#panel .panel-body').scrollTop = 3000")
        check("320px: panel-body scrolls to bottom groups",
              sp.evaluate("document.querySelector('#panel .panel-body').scrollTop") > 200)
        sctx.close()

        browser.close()

    errs = console_errors()
    with open(os.path.join(ART, "console.log"), "w") as f:
        f.write("\n".join(console_lines + ["", "# expected errors from webgl-fail page:"] + fail_console))
    check("no console errors", len(errs) == 0, "; ".join(errs[:5]))

    failed = [n for n, ok in results if not ok]
    emit(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    with open(os.path.join(ART, "smoke-output.txt"), "w") as f:
        f.write("\n".join(out_lines) + "\n")
    if failed:
        emit("FAILED:")
        for n in failed:
            emit(f"  {n}")
        sys.exit(1)


if __name__ == "__main__":
    main()
