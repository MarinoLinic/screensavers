"""Live renderer/controls/lifecycle checks for BIOME.EXE. Requires npm run serve.
Uses installed Chrome; no browser downloads.
Screenshots and report go to artifacts/. Every opened browser is closed.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64
import json
import os

BASE = os.environ.get('BIOMES_URL', os.environ.get('TIDAL_URL', 'http://127.0.0.1:8099'))
ART = Path(__file__).resolve().parent.parent / 'artifacts'
ART.mkdir(exist_ok=True)
results = []
errors = []
external = []
logs = []

def check(name, condition, detail=''):
    results.append({'name': name, 'passed': bool(condition), 'detail': str(detail)[:400]})
    print(('PASS ' if condition else 'FAIL ') + name + ' ' + str(detail)[:200], flush=True)

def skip(name, detail=''):
    results.append({'name': name, 'passed': 'skipped', 'detail': str(detail)[:400]})
    print('SKIP ' + name + ' ' + str(detail)[:200], flush=True)

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
    page.wait_for_function('window.BIOME?.world && window.BIOME?.renderer')

def _run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        page = ctx.new_page()
        attach(page)
        page.goto(BASE)
        ready(page)
        page.wait_for_timeout(1200)

        diag = page.evaluate('BIOME.diagnostics()')
        check('default desert scene renders',
              diag['count'] >= 8 and diag['renders'] > 5 and diag['time'] > 0
              and diag['habitat'] == 'desert', diag)
        check('sprite atlas covers 52 species', diag['species'] == 52, diag['species'])
        check('BIOME + TIDAL share one API object',
              page.evaluate('window.TIDAL === window.BIOME'))
        check('new branding', page.evaluate('document.title') == 'BIOME.EXE - Pixel Biomes'
              and 'BIOME.EXE' in page.locator('.brand-name').inner_text())
        check('settings panel starts closed', page.locator('#panel').is_hidden())

        # ---- screenshots: every biome; desert in all three lights
        page.mouse.move(720, 800)
        page.screenshot(path=str(ART / 'default-desert.png'))
        for light in ['golden', 'day', 'night']:
            page.evaluate(f'BIOME.setSetting("desertLight","{light}")')
            page.wait_for_timeout(500)
            page.screenshot(path=str(ART / f'desert-{light}.png'))
        page.evaluate('BIOME.setSetting("desertLight","golden")')
        for h in ['reef', 'kelp', 'lagoon', 'abyss']:
            page.evaluate(f'BIOME.selectHabitat("{h}")')
            page.wait_for_timeout(600)
            page.screenshot(path=str(ART / f'habitat-{h}.png'))
        check('all five biomes applied',
              page.evaluate('BIOME.settings.habitat') == 'abyss')
        page.evaluate('BIOME.selectHabitat("desert")')

        # biome switch keeps the world clock and other settings
        t0 = page.evaluate('BIOME.world.simTime')
        spd = page.evaluate('BIOME.settings.speed')
        page.evaluate('BIOME.selectHabitat("kelp")')
        check('biome swap preserves clock+settings',
              page.evaluate('BIOME.world.simTime') >= t0 and page.evaluate('BIOME.settings.speed') == spd)
        page.evaluate('BIOME.selectHabitat("desert")')

        # ---- pause
        page.keyboard.press('Space')
        page.wait_for_timeout(150)
        before = page.evaluate('BIOME.diagnostics()')
        page.wait_for_timeout(500)
        after = page.evaluate('BIOME.diagnostics()')
        check('pause freezes time', page.evaluate('BIOME.paused') and before['time'] == after['time'],
              f"{before['time']} vs {after['time']}")
        check('pause stops renders', before['renders'] == after['renders'],
              f"{before['renders']} vs {after['renders']}")
        # paused look change still draws exactly one frame
        r0 = page.evaluate('BIOME.diagnostics().renders')
        page.evaluate('BIOME.setSetting("desertLight","night")')
        page.wait_for_timeout(150)
        check('paused look change renders once',
              page.evaluate('BIOME.diagnostics().renders') > r0)
        page.evaluate('BIOME.setSetting("desertLight","golden")')
        # paused portrait resize re-lays out without advancing time
        t_paused = page.evaluate('BIOME.world.simTime')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(400)
        check('paused portrait resize redraws, no time',
              page.evaluate('BIOME.diagnostics().renders') > r0 + 1
              and page.evaluate('BIOME.world.simTime') == t_paused,
              page.evaluate('BIOME.world.simTime'))
        page.screenshot(path=str(ART / 'portrait-390-desert.png'))
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.wait_for_timeout(300)
        page.keyboard.press('Space')   # resume
        page.evaluate('BIOME.selectHabitat("reef")')

        # ---- modal / keyboard / native editing
        page.keyboard.press('o')
        check('O opens window', page.locator('#panel').is_visible() and page.evaluate('BIOME.panelOpen'))
        check('modal inerts all background chrome',
              page.evaluate('document.getElementById("stage").inert && document.getElementById("chrome").inert && document.getElementById("keystrip").inert && document.getElementById("restoreChip").inert'))
        check('water: community enabled, desert light hidden',
              page.evaluate('!document.getElementById("communitySel").disabled && document.getElementById("desertLightField").hidden'))
        check('water labels', page.evaluate(
            'document.getElementById("visitorsLabel").textContent.includes("turtle") && document.getElementById("bubblesLabel").textContent === "Bubbles"'))
        page.screenshot(path=str(ART / 'settings-window.png'))
        page.locator('#seedIn').fill('123456')
        seed_before = page.evaluate('BIOME.settings.seed')
        page.locator('#seedIn').press('o')  # inside number field: must NOT toggle panel
        check('typing o in seed field does not close panel',
              page.evaluate('BIOME.panelOpen') and page.evaluate('BIOME.settings.seed') == seed_before)
        page.locator('#seedBtn').click()
        page.wait_for_timeout(300)
        check('apply seed rebuilds + resets clock',
              page.evaluate('BIOME.settings.seed') == 123456 and page.evaluate('BIOME.world.seed') == 123456)
        page.wait_for_timeout(300)
        check('seed reaches renderer + backdrop key',
              page.evaluate('BIOME.renderer.settings.seed') == 123456
              and '123456' in page.evaluate('BIOME.renderer.backdropKey'))
        # select keeps digit typeahead (does not switch biome)
        h0 = page.evaluate('BIOME.settings.habitat')
        page.locator('#communitySel').focus(); page.keyboard.press('2')
        check('select keeps digit keys', page.evaluate('BIOME.settings.habitat') == h0)
        # focus trap
        page.locator('#panelClose').focus()
        page.keyboard.press('Shift+Tab')
        check('window traps keyboard focus',
              page.evaluate('document.getElementById("panel").contains(document.activeElement) && document.activeElement.id!=="panelClose"'))
        page.keyboard.press('Escape')
        check('Escape closes and returns canvas focus',
              page.locator('#panel').is_hidden() and page.evaluate('document.activeElement.id') == 'tank')
        check('close clears inert chrome',
              page.evaluate('!document.getElementById("stage").inert && !document.getElementById("keystrip").inert'))
        check('BIOME.settings is a safe copy',
              page.evaluate('(()=>{const s=BIOME.settings; s.seed=999; s.habitat="abyss"; return BIOME.settings.seed!==999 && BIOME.settings.habitat!=="abyss";})()'))

        # digit keys select biome families; brackets/N step through scenes
        page.keyboard.press('4')
        check('digit 4 selects forest', page.evaluate('BIOME.settings.habitat') == 'forest')
        page.keyboard.press('2')
        check('digit 2 selects desert', page.evaluate('BIOME.settings.habitat') == 'desert')
        page.evaluate('BIOME.selectHabitat("reef")')
        page.keyboard.press('1')
        check('digit 1 selects reef', page.evaluate('BIOME.settings.habitat') == 'reef')
        page.keyboard.press(']')
        check('] advances biome', page.evaluate('BIOME.settings.habitat') == 'kelp')
        page.keyboard.press('[')
        check('[ retreats biome', page.evaluate('BIOME.settings.habitat') == 'reef')
        # bracket tour wraps all seventeen
        page.evaluate('BIOME.selectHabitat("trop-atoll")')
        page.keyboard.press(']')
        check('tour wraps Atoll -> reef', page.evaluate('BIOME.settings.habitat') == 'reef')
        page.keyboard.press('n')
        check('N is next scene',page.evaluate('BIOME.settings.habitat')=='kelp')
        page.keyboard.press('ArrowLeft')
        check('left arrow is previous scene',page.evaluate('BIOME.settings.habitat')=='reef')
        page.keyboard.press('b')
        check('B is next biome',page.evaluate('BIOME.settings.habitat')=='desert')
        page.keyboard.press('1')

        # ---- live controls (on water)
        page.keyboard.press('o')
        page.locator('#communitySel').select_option('jellies')
        page.wait_for_timeout(300)
        check('community switch live', page.evaluate('BIOME.settings.community') == 'jellies')
        n_jelly = page.evaluate('BIOME.world.sample().filter(r=>r.species==="jelly").length')
        n_pop = page.evaluate('BIOME.world.count')
        check('jelly drift yields real jellyfish (reef)',
              n_jelly >= 0.65 * n_pop, f'{n_jelly}/{n_pop}')
        page.locator('#communitySel').select_option('reef')
        page.evaluate("(()=>{const el=document.getElementById('popIn');el.value='40';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
        page.wait_for_timeout(200)
        check('population slider live', page.evaluate('BIOME.world.count') == 40)
        page.locator('#scanIn').check()
        check('scanlines toggle live', page.evaluate('BIOME.settings.scanlines === true'))
        page.locator('#scanIn').uncheck()
        page.locator('#pixelSel').select_option('2')
        page.wait_for_timeout(200)
        dims = page.evaluate('({w:BIOME.renderer.logicalW,h:BIOME.renderer.logicalH,cw:BIOME.renderer.canvas.width,px:BIOME.settings.pixelSize})')
        check('pixelSize 2 rebuilds grid', dims['px'] == 2 and dims['cw'] == dims['w']
              and abs(dims['w'] * 2 - 1440) <= 2, dims)
        page.locator('#pixelSel').select_option('3')
        page.wait_for_timeout(200)
        page.keyboard.press('Escape')

        # ---- land-specific panel state
        page.evaluate('BIOME.selectHabitat("desert")')
        page.keyboard.press('o')
        page.wait_for_timeout(150)
        check('desert: community disabled + hint shown',
              page.evaluate('document.getElementById("communitySel").disabled && !document.getElementById("communityHint").hidden'))
        check('desert labels', page.evaluate(
            'document.getElementById("visitorsLabel").textContent.includes("camel") && document.getElementById("bubblesLabel").textContent === "Wind gusts" && document.getElementById("vegLabel").textContent.includes("Cacti")'))
        check('desert light select visible', page.evaluate('!document.getElementById("desertLightField").hidden'))
        # land ignores the saved aquatic community — only desert species
        land_ids = page.evaluate('[...new Set(BIOME.world.sample().map(r=>r.species))]')
        check('desert emits only desert species (community=reef saved)',
              all(str(s) in {'lizard', 'jerboa', 'tortoise', 'scorpion', 'scarab', 'wheatear', 'fennec', 'camel'}
                  for s in land_ids), sorted(land_ids))
        check('saved community untouched on land',
              page.evaluate('BIOME.settings.community') == 'reef')
        # Completed atlas: all nine families, Tundra once
        todo = page.locator('#todoList li').all_text_contents()
        check('atlas lists 10 completed biomes, Tundra deduped',
              len(todo) == 10 and sum('Tundra' in t for t in todo) == 1,
              [t.split('—')[0].strip() for t in todo])
        page.keyboard.press('Escape')

        # ---- auto tour via debugStep (independent of speed; stops paused)
        page.keyboard.press('o'); page.check('#autoCycleIn'); page.select_option('#cycleIntervalSel', '45'); page.keyboard.press('Escape')
        h_before = page.evaluate('BIOME.settings.habitat')
        page.evaluate('BIOME.debugStep(46)')
        check('tour advances biome on wall clock',
              page.evaluate('BIOME.settings.habitat') != h_before,
              f'{h_before} -> {page.evaluate("BIOME.settings.habitat")}')
        h_now = page.evaluate('BIOME.settings.habitat')
        page.keyboard.press('Space')
        page.evaluate('BIOME.debugStep(50)')
        check('paused: tour does not advance', page.evaluate('BIOME.settings.habitat') == h_now)
        page.keyboard.press('Space')
        page.keyboard.press('o'); page.uncheck('#autoCycleIn'); page.keyboard.press('Escape')
        page.evaluate('BIOME.selectHabitat("reef")')

        # re-applying the SAME seed while paused still reseeds (clock -> 0)
        page.keyboard.press('Space')  # pause
        page.keyboard.press('o')
        cur_seed = page.evaluate('BIOME.settings.seed')
        page.locator('#seedIn').fill(str(cur_seed))
        page.locator('#seedBtn').click()
        page.wait_for_timeout(300)
        check('same-seed Apply resets clock while paused',
              page.evaluate('BIOME.world.simTime') == 0,
              page.evaluate('BIOME.world.simTime'))
        page.keyboard.press('Escape')
        page.keyboard.press('Space')  # resume

        # ---- hide / restore
        page.keyboard.press('h')
        check('H hides all chrome',
              page.evaluate('document.getElementById("keystrip").hidden')
              and page.evaluate('document.getElementById("chrome").hidden')
              and not page.evaluate('BIOME.panelOpen'))
        check('restore chip remains', page.locator('#restoreChip').is_visible())
        page.keyboard.press('Escape')
        check('Escape restores controls', not page.evaluate('document.getElementById("keystrip").hidden'))

        # ---- chrome idle auto-fade (8s) — hold still and wait it out
        page.wait_for_timeout(8700)
        check('chrome auto-fades after 8s idle', page.evaluate('document.body.classList.contains("idle")'))
        page.mouse.move(720, 500)
        page.wait_for_timeout(100)
        check('pointer wakes chrome', not page.evaluate('document.body.classList.contains("idle")'))

        # ---- tap burst
        r_before = page.evaluate('BIOME.diagnostics().renders')
        page.mouse.click(700, 400)
        page.wait_for_timeout(200)
        check('tap injects bubble/dust burst', page.evaluate('BIOME.world.bursts.length') >= 1)

        # ---- PNG snapshot
        with page.expect_download() as download:
            page.keyboard.press('s')
        dl = download.value
        dl.save_as(str(ART / 'snapshot.png'))
        check('PNG export works', (ART / 'snapshot.png').stat().st_size > 8000,
              f"{(ART / 'snapshot.png').stat().st_size}B")
        check('snapshot named biome-*', dl.suggested_filename.startswith('biome-'), dl.suggested_filename)

        # ---- fullscreen: real attempt first, explicit skip if env forbids
        page.evaluate('document.getElementById("tank").focus()')
        page.keyboard.press('f')
        page.wait_for_timeout(400)
        fs = page.evaluate('document.fullscreenElement===document.documentElement')
        if fs:
            check('fullscreen covers whole document', True, 'fullscreenElement=documentElement')
            page.keyboard.press('f')
            page.wait_for_timeout(200)
        else:
            skip('fullscreen covers whole document', 'environment refused fullscreen request')
        errs_before = len(errors)
        page.evaluate("(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('denied by test'));})()")
        page.keyboard.press('f')
        page.wait_for_timeout(300)
        check('rejected fullscreen shows readable toast',
              page.locator('#toast').is_visible() and len(page.evaluate('document.getElementById("toast").textContent')) > 4,
              page.evaluate('document.getElementById("toast").textContent'))
        page.evaluate("(()=>{document.documentElement.requestFullscreen=undefined;})()")
        page.keyboard.press('f')
        page.wait_for_timeout(300)
        check('missing fullscreen API shows readable toast',
              page.locator('#toast').is_visible(),
              page.evaluate('document.getElementById("toast").textContent'))
        page.evaluate("(()=>{delete document.documentElement.requestFullscreen;})()")
        check('fullscreen mocks caused no page errors', len(errors) == errs_before)

        # ---- persistence across reload
        page.evaluate('BIOME.setSetting("community","jellies")')
        page.evaluate('BIOME.setSetting("pixelSize",4)')
        page.evaluate('BIOME.selectHabitat("lagoon")')
        page.reload(); ready(page)
        check('settings persist across reload',
              page.evaluate('BIOME.settings.community==="jellies" && BIOME.settings.pixelSize===4 && BIOME.settings.habitat==="lagoon"'))
        check('panel/pause not persisted', page.evaluate('!BIOME.paused && !BIOME.panelOpen'))
        page.evaluate('BIOME.setSetting("community","mixed")')
        page.evaluate('BIOME.setSetting("pixelSize",3)')

        # ---- URL ?habitat= override: in memory only, never persisted
        page.goto(BASE + '/?habitat=kelp')
        ready(page)
        check('?habitat=kelp starts on kelp', page.evaluate('BIOME.settings.habitat') == 'kelp')
        check('?habitat override not persisted',
              page.evaluate('JSON.parse(localStorage.getItem("pixel-biomes.v1")).habitat') == 'lagoon')
        page.goto(BASE + '/?habitat=mars')  # unknown id ignored
        ready(page)
        check('?habitat=mars (unknown) ignored',
              page.evaluate('BIOME.settings.habitat') == 'lagoon')
        page.goto(BASE)
        ready(page)

        # ---- legacy tidal-pixel.v1 migration in a fresh context
        mctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        mctx.add_init_script(
            "localStorage.setItem('tidal-pixel.v1', JSON.stringify({"
            "version:1, seed:4242, habitat:'abyss', community:'jellies',"
            " population:33, pixelSize:4, speed:1.5}))")
        mp = mctx.new_page(); attach(mp, 'migrated'); mp.goto(BASE); ready(mp)
        check('legacy save migrates (habitat+pop+seed survive)',
              mp.evaluate('BIOME.settings.habitat === "abyss" && BIOME.settings.population === 33 && BIOME.settings.seed === 4242'),
              mp.evaluate('({h:BIOME.settings.habitat,p:BIOME.settings.population,s:BIOME.settings.seed})'))
        check('legacy blob preserved, new key written',
              mp.evaluate('localStorage.getItem("tidal-pixel.v1") !== null && localStorage.getItem("pixel-biomes.v1") !== null'))
        mctx.close()

        # ---- mobile layout
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(600)
        page.keyboard.press('o')
        page.wait_for_timeout(200)
        page.screenshot(path=str(ART / 'mobile-390-panel.png'))
        ok = page.locator('#panel').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight;}')
        check('390px window inside viewport', ok)
        page.keyboard.press('Escape')
        ok = page.locator('#keystrip').evaluate('(el)=>el.getBoundingClientRect().width<=innerWidth')
        check('390px strip has no horizontal overflow', ok)
        page.screenshot(path=str(ART / 'mobile-390-scene.png'))
        page.set_viewport_size({'width': 1440, 'height': 900})

        # touch device: hidden chrome restores via chip
        touch = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        tp = touch.new_page(); attach(tp, 'touch'); tp.goto(BASE); ready(tp)
        tp.evaluate('document.getElementById("kHide").click()')
        chip_vis = tp.locator('#restoreChip').is_visible()
        check('touch gets restore chip', chip_vis)
        if chip_vis:
            tp.locator('#restoreChip').click()
            check('chip restores chrome', not tp.evaluate('document.getElementById("keystrip").hidden'))
        touch.close()

        # reduced motion: fresh context starts paused
        reduced = browser.new_context(viewport={'width': 800, 'height': 600}, reduced_motion='reduce')
        rp = reduced.new_page(); attach(rp, 'reduced'); rp.goto(BASE); ready(rp)
        check('reduced motion starts paused', rp.evaluate('BIOME.paused'))
        r_a = rp.evaluate('BIOME.diagnostics()'); rp.wait_for_timeout(500)
        r_b = rp.evaluate('BIOME.diagnostics()')
        check('reduced motion stays still', r_a['time'] == r_b['time'])
        rp.screenshot(path=str(ART / 'reduced-motion.png'))
        reduced.close()

        # ---- chrome-hidden beauty shots, each biome at t~10s sim time
        for h in ['reef', 'kelp', 'lagoon', 'abyss', 'desert']:
            page.evaluate(f'BIOME.selectHabitat("{h}")')
            page.evaluate('(()=>{const need=10-BIOME.world.simTime; if(need>0) BIOME.debugStep(need/BIOME.settings.speed+0.05);})()')
            page.keyboard.press('h')
            page.wait_for_timeout(150)
            page.screenshot(path=str(ART / f'beauty-{h}.png'))
            page.keyboard.press('Escape')
        page.evaluate('BIOME.selectHabitat("desert")')

        # ---- art contact sheet (desert sprites + decor on dark teal)
        ap = ctx.new_page(); attach(ap, 'art'); ap.goto(BASE + '/tools/art-preview.html')
        ap.wait_for_function('window.__artReady === true')
        ap.locator('#sheet').screenshot(path=str(ART / 'art-contact-sheet.png'))
        ap.close()

        check('no runtime network dependencies', not external, external)
        check('no console or page errors', not errors, errors[:5])
        browser.close()

    failed = [r for r in results if r['passed'] is False]
    skipped = [r for r in results if r['passed'] == 'skipped']
    print(f"{len(results) - len(failed) - len(skipped)}/{len(results)} checks passed"
          + (f", {len(skipped)} skipped" if skipped else ''), flush=True)
    return bool(failed)

def run():
    try:
        return _run()
    finally:
        # artifacts land even when a check crashes mid-suite
        report = {'results': results, 'errors': errors, 'externalRequests': external}
        (ART / 'smoke-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        (ART / 'console.log').write_text('\n'.join(logs) or 'no console output captured\n', encoding='utf-8')

if __name__ == '__main__':
    raise SystemExit(run())
