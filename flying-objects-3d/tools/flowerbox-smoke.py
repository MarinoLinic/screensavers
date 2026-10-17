"""Flower Box regression smoke: the solo morphing-box mode end to end.
Requires the project served at FLYING_OBJECTS_URL (default 8098).
Uses installed Chrome + local GPU; artifacts land in artifacts/.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os

BASE = os.environ.get('FLYING_OBJECTS_URL', 'http://127.0.0.1:8098')
ART = Path(__file__).resolve().parent.parent / 'artifacts'
ART.mkdir(exist_ok=True)
results = []
errors = []
external = []
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
    page.on('request', lambda r: external.append(r.url)
            if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)

def ready(page):
    page.wait_for_function('window.FLYING_OBJECTS?.world && document.getElementById("webglFail").hidden')

VERTS = "Array.from(FLYING_OBJECTS.renderer.geoCache.get('flowerbox').attributes.position.array.slice(0, 60)).map(v=>+v.toFixed(4)).join(',')"
COLORS = "(()=>{const g=FLYING_OBJECTS.renderer.geoCache.get('flowerbox');const a=g.attributes.color.array;const s=new Set();for(let i=0;i<a.length;i+=3)s.add(a[i].toFixed(3)+'|'+a[i+1].toFixed(3)+'|'+a[i+2].toFixed(3));return s.size;})()"

def run():
    try:
        return _run()
    finally:
        report = {'results': results, 'errors': errors, 'externalRequests': external}
        (ART / 'flowerbox-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        (ART / 'flowerbox-console.log').write_text('\n'.join(logs) or 'no console output captured\n', encoding='utf-8')

def _run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', args=['--use-angle=d3d11', '--ignore-gpu-blocklist'])
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        attach(page)
        page.goto(BASE)
        ready(page)
        page.wait_for_timeout(1200)

        # ---- select via the panel button (discoverable in the Motion group)
        page.keyboard.press('o')
        btn = page.locator('.key-btn[data-motion="flowerbox"]')
        check('Flower Box button exists in Motion group', btn.count() == 1)
        btn.click()
        page.wait_for_timeout(300)
        check('count output shows saved fleet count',
              '1 (saved 16)' in page.locator('#countOut').text_content())
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)

        # ---- solo centered box
        snap = page.evaluate('FLYING_OBJECTS.world.sample()')
        check('flowerbox flies one centered box',
              snap['count'] == 1 and snap['bodies'][0]['shape'] == 'flowerbox'
              and all(abs(v) < 1e-9 for v in snap['bodies'][0]['position']),
              snap['bodies'][0])
        check('six face hues from palette', page.evaluate(COLORS) == 6)
        check('quiet stage: sky off, flat background',
              page.evaluate('FLYING_OBJECTS.renderer.sky.visible === false'
                            ' && FLYING_OBJECTS.renderer.scene.background !== null'))
        check('stars/trails rendered off while prefs survive',
              page.evaluate('FLYING_OBJECTS.renderer.stars.visible === false'
                            ' && FLYING_OBJECTS.settings.stars === true'))

        # ---- morph animates with sim time
        v0 = page.evaluate(VERTS)
        page.wait_for_timeout(500)
        check('box surface morphs while running', page.evaluate(VERTS) != v0)
        page.screenshot(path=str(ART / 'flowerbox-desktop.png'))

        # ---- pause freezes time, rotation, morph and renders
        page.keyboard.press('Space')
        page.wait_for_timeout(150)
        p1 = page.evaluate('({t: FLYING_OBJECTS.world.simTime, r: FLYING_OBJECTS.diagnostics().renders})')
        v1 = page.evaluate(VERTS)
        rot1 = page.evaluate('FLYING_OBJECTS.world.sample().bodies[0].rotation.join(",")')
        page.wait_for_timeout(400)
        p2 = page.evaluate('({t: FLYING_OBJECTS.world.simTime, r: FLYING_OBJECTS.diagnostics().renders})')
        check('paused: time, rotation, morph and renders all frozen',
              p1 == p2 and page.evaluate(VERTS) == v1
              and page.evaluate('FLYING_OBJECTS.world.sample().bodies[0].rotation.join(",")') == rot1)
        page.keyboard.press('Space')  # resume

        # ---- spin 0 freezes rotation but the box keeps breathing
        page.keyboard.press('o')
        page.evaluate("(()=>{const el=document.getElementById('spinIn');el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)
        r_a = page.evaluate('FLYING_OBJECTS.world.sample().bodies[0].rotation.join(",")')
        v_a = page.evaluate(VERTS)
        page.evaluate('FLYING_OBJECTS.debugStep(0.4)')
        page.evaluate('FLYING_OBJECTS.debugStep(0.4)')
        check('spin 0: pose frozen, morph still animates',
              page.evaluate('FLYING_OBJECTS.world.sample().bodies[0].rotation.join(",")') == r_a
              and page.evaluate(VERTS) != v_a)
        page.keyboard.press('o')
        page.evaluate("(()=>{const el=document.getElementById('spinIn');el.value='0.55';el.dispatchEvent(new Event('input',{bubbles:true}));})()")

        # ---- fleet controls disabled, saved values maintained
        check('fleet/stage controls disabled in flowerbox',
              page.evaluate('document.getElementById("familySel").disabled'
                            ' && document.getElementById("countIn").disabled'
                            ' && document.getElementById("spreadIn").disabled'
                            ' && document.getElementById("cameraSel").disabled'
                            ' && document.getElementById("starsIn").disabled'
                            ' && document.getElementById("trailsIn").disabled'))
        check('saved prefs intact',
              page.evaluate('FLYING_OBJECTS.settings.count === 16'
                            ' && FLYING_OBJECTS.settings.family === "mixed"'
                            ' && FLYING_OBJECTS.settings.spread === 1'
                            ' && FLYING_OBJECTS.settings.camera === "drift"'))
        page.screenshot(path=str(ART / 'flowerbox-settings.png'))
        page.keyboard.press('Escape')

        # ---- style recolors faces without replacing the geometry
        page.evaluate('window.__geo = FLYING_OBJECTS.renderer.geoCache.get("flowerbox")')
        cols_before = page.evaluate('Array.from(FLYING_OBJECTS.renderer.geoCache.get("flowerbox").attributes.color.array.slice(0, 3)).join(",")')
        page.evaluate('FLYING_OBJECTS.selectPreset("candy")')
        page.wait_for_timeout(400)
        check('style recolors faces, same geometry object',
              page.evaluate('FLYING_OBJECTS.renderer.geoCache.get("flowerbox") === window.__geo')
              and page.evaluate('Array.from(FLYING_OBJECTS.renderer.geoCache.get("flowerbox").attributes.color.array.slice(0, 3)).join(",")') != cols_before
              and page.evaluate(COLORS) == 6)
        page.evaluate('FLYING_OBJECTS.selectPreset("orbital")')

        # ---- mobile portrait still framed + shot
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(500)
        bs = page.evaluate('FLYING_OBJECTS.world.sample().bodies[0].scale')
        check('portrait shrinks the box', 0 < bs < 2.6, bs)
        page.screenshot(path=str(ART / 'flowerbox-mobile.png'))
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.wait_for_timeout(300)

        # ---- switching back restores the fleet and the stage
        page.evaluate('FLYING_OBJECTS.selectMotion("drift")')
        page.wait_for_timeout(500)
        back = page.evaluate('FLYING_OBJECTS.world.sample()')
        check('fleet restored on exit',
              back['count'] == 16
              and page.evaluate('FLYING_OBJECTS.settings.count') == 16
              and page.evaluate('FLYING_OBJECTS.renderer.sky.visible === true')
              and page.evaluate('FLYING_OBJECTS.renderer.stars.visible === true'))

        # ---- 12 mode/style swaps: bounded resources
        geo, tex = [], []
        for i in range(12):
            page.evaluate(f'FLYING_OBJECTS.selectMotion("{"flowerbox" if i % 2 else "drift"}")')
            page.evaluate(f'FLYING_OBJECTS.selectPreset("{["orbital","candy","foundry","spectral"][i % 4]}")')
            page.evaluate('FLYING_OBJECTS.debugStep(0.05)')
            d = page.evaluate('FLYING_OBJECTS.diagnostics()')
            geo.append(d['geometries']); tex.append(d['textures'])
        check('12 mode/style swaps keep geometry/textures bounded',
              max(geo) - min(geo) <= 3 and max(tex) - min(tex) <= 3,
              f'geo {min(geo)}..{max(geo)} tex {min(tex)}..{max(tex)}')
        page.evaluate('FLYING_OBJECTS.selectMotion("flowerbox")')
        page.wait_for_timeout(300)

        # ---- persists across reload, starts unpaused without the panel
        page.reload()
        ready(page)
        page.wait_for_timeout(800)
        check('reload starts in flowerbox, running, panel closed',
              page.evaluate('FLYING_OBJECTS.world.motion === "flowerbox"'
                            ' && FLYING_OBJECTS.world.count === 1'
                            ' && !FLYING_OBJECTS.paused && !FLYING_OBJECTS.panelOpen'))
        ctx.close()

        # ---- reduced-motion context still shows the box, frozen
        rc = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        rc.add_init_script(
            "localStorage.setItem('flyingObjects3d.settings.v1',"
            " JSON.stringify({version:1, motion:'flowerbox', seed:1997}))")
        rp = rc.new_page()
        attach(rp, 'reduced')
        rp.goto(BASE)
        ready(rp)
        rp.wait_for_timeout(600)
        check('reduced motion: still box, paused',
              rp.evaluate('FLYING_OBJECTS.world.count === 1'
                          ' && FLYING_OBJECTS.world.sample().bodies[0].shape === "flowerbox"'
                          ' && FLYING_OBJECTS.paused'))
        rc.close()

        check('no runtime network dependencies', not external, external)
        check('no shader or JavaScript errors', not errors, errors[:5])
        browser.close()

    failed = [r for r in results if r['passed'] is False]
    skipped = [r for r in results if r['passed'] == 'skipped']
    print(f"{len(results) - len(failed) - len(skipped)}/{len(results)} checks passed"
          + (f", {len(skipped)} skipped" if skipped else ''), flush=True)
    return bool(failed)

if __name__ == '__main__':
    raise SystemExit(run())
