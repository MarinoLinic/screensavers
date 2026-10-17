"""Narrow final regression checks for BIOME.EXE — keyboard focus-trap
inclusion of the roadmap <summary>, plus the desert art-review captures
(three lights at two sizes, camel hero, desert settings panel).

Requires `npm run serve` on 8099 (or BIOMES_URL). Writes artifacts/ and
artifacts/final-checks.json. Closes every browser it opens.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os

BASE = os.environ.get('BIOMES_URL', os.environ.get('TIDAL_URL', 'http://127.0.0.1:8099'))
ART = Path(__file__).resolve().parent.parent / 'artifacts'
ART.mkdir(exist_ok=True)
results = []
errors = []
logs = []

def check(name, condition, detail=''):
    results.append({'name': name, 'passed': bool(condition), 'detail': str(detail)[:400]})
    print(('PASS ' if condition else 'FAIL ') + name + ' ' + str(detail)[:200], flush=True)

def attach(page, tag='page'):
    def on_console(m):
        logs.append(f'[{tag}] console.{m.type} {m.text}')
        if m.type == 'error':
            errors.append(m.text)
    def on_pageerror(e):
        logs.append(f'[{tag}] pageerror {e}')
        errors.append(str(e))
    page.on('pageerror', on_pageerror)
    page.on('console', on_console)

def ready(page):
    page.wait_for_function('window.BIOME?.world && window.BIOME?.renderer')

def _run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        attach(page)
        page.goto(BASE)
        ready(page)
        page.wait_for_timeout(600)

        # ---- roadmap <summary> is a real tab stop and Space works on it
        page.keyboard.press('o')
        check('panel opens', page.locator('#panel').is_visible())
        page.evaluate('document.getElementById("resetBtn").focus()')
        page.keyboard.press('Tab')
        check('Tab from Defaults reaches roadmap summary',
              page.evaluate('document.activeElement.matches(".roadmap > summary")'),
              page.evaluate('document.activeElement.tagName + "#" + document.activeElement.id'))
        paused0 = page.evaluate('BIOME.paused')
        page.keyboard.press('Space')
        page.wait_for_timeout(100)
        check('Space opens roadmap details without pausing',
              page.evaluate('document.querySelector(".roadmap").open === true')
              and page.evaluate('BIOME.paused') == paused0)
        page.keyboard.press('Space')
        page.wait_for_timeout(100)
        check('Space closes roadmap details without pausing',
              page.evaluate('document.querySelector(".roadmap").open === false')
              and page.evaluate('BIOME.paused') == paused0)
        page.evaluate('document.getElementById("panelClose").focus()')
        page.keyboard.press('Shift+Tab')
        check('Shift+Tab from close wraps to roadmap summary (last item)',
              page.evaluate('document.activeElement.matches(".roadmap > summary")'))
        page.keyboard.press('Tab')
        check('Tab from summary wraps back to close',
              page.evaluate('document.activeElement.id === "panelClose"'))
        page.keyboard.press('Escape')
        check('Escape still closes the panel', page.evaluate('!BIOME.panelOpen'))

        # ---- desert three-look captures, defaults, paused at t=10.035
        check('fresh context boots on desert defaults',
              page.evaluate('BIOME.settings.habitat === "desert" && BIOME.settings.population === 12 && BIOME.settings.seed === 1995 && BIOME.settings.pixelSize === 3 && BIOME.settings.community === "mixed"'))
        target = 10.035  # frozen beauty-settings.json time
        page.evaluate(f'BIOME.debugStep(({target} - BIOME.world.simTime) / BIOME.settings.speed + 0.001)')
        page.keyboard.press('Space')  # pause so the captures share one clock
        t1 = page.evaluate('BIOME.world.simTime')
        check('paused exactly at t~10.035', abs(t1 - target) < 0.15, t1)
        for light in ['golden', 'day', 'night']:
            page.evaluate(f'BIOME.setSetting("desertLight","{light}")')
            page.wait_for_timeout(250)
            page.screenshot(path=str(ART / f'final-desert-{light}.png'))
            check(f'desert {light} renders at 1440x900',
                  page.evaluate('BIOME.diagnostics().renders') > 0)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(400)
        page.evaluate('BIOME.setSetting("desertLight","golden")')
        page.wait_for_timeout(250)
        page.screenshot(path=str(ART / 'final-desert-portrait-390.png'))
        check('desert portrait renders at 390x844',
              page.evaluate('BIOME.diagnostics().renders') > 0)
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.wait_for_timeout(300)

        # desert settings panel shot (water panel was already captured)
        page.keyboard.press('o')
        page.wait_for_timeout(200)
        page.screenshot(path=str(ART / 'final-desert-settings.png'))
        check('desert panel open for shot',
              page.evaluate('document.getElementById("desertLightField").hidden === false'))
        page.keyboard.press('Escape')

        # ---- camel hero: advance to the camel's cycle at u=.25
        phase = page.evaluate('BIOME.world.visitor ? BIOME.world.visitor.phase : -1')
        camel_idx = page.evaluate('BIOME.world.visitor ? BIOME.world.visitor.pool.indexOf("camel") : -1')
        check('desert visitor exists', phase >= 0 and camel_idx >= 0, f'phase={phase} camelIdx={camel_idx}')
        if phase >= 0 and camel_idx >= 0:
            camel_t = 120 * (camel_idx + 0.25 - phase)
            page.keyboard.press('Space')  # resume so debugStep can advance
            page.evaluate(f'BIOME.debugStep(({camel_t} - BIOME.world.simTime) / BIOME.settings.speed)')
            page.keyboard.press('Space')  # pause with the camel mid-screen
            vis = page.evaluate('BIOME.world.sample().find(r => r.role === "visitor") || null')
            check('camel visitor on screen at u=0.25',
                  vis and vis['species'] == 'camel' and 0 < vis['x'] < 480,
                  vis)
            page.wait_for_timeout(200)
            page.screenshot(path=str(ART / 'final-desert-camel.png'))

        meta = {
            'settings': page.evaluate('BIOME.settings'),
            'diagnostics': page.evaluate('BIOME.diagnostics()'),
            'simTime': page.evaluate('BIOME.world.simTime'),
            'consoleErrors': errors,
        }
        (ART / 'final-checks-capture.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
        check('no console or page errors', not errors, errors[:5])
        browser.close()

    failed = [r for r in results if r['passed'] is False]
    print(f"{len(results) - len(failed)}/{len(results)} checks passed", flush=True)
    return bool(failed)

def run():
    try:
        return _run()
    finally:
        report = {'results': results, 'errors': errors}
        (ART / 'final-checks.json').write_text(json.dumps(report, indent=2), encoding='utf-8')

if __name__ == '__main__':
    raise SystemExit(run())
