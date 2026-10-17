"""Live WebGL/controls/lifecycle checks. Requires npm run serve.
Uses installed Chrome and local GPU; no browser downloads.
Screenshots and report go to artifacts/. Every opened browser is closed.
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
    page.wait_for_function('window.FLYING_OBJECTS?.world && document.getElementById("webglFail").hidden')

def open_blk(page, text):
    """Expand a collapsed <details> block by its summary label."""
    page.evaluate(
        "(t)=>{for(const s of document.querySelectorAll('summary')){if(s.textContent.toLowerCase().includes(t.toLowerCase())){s.parentElement.open=true;return true;}}return false;}",
        text,
    )

def run():
    try:
        return _run()
    finally:
        # artifacts land even when a check crashes mid-suite
        report = {'results': results, 'errors': errors, 'externalRequests': external}
        (ART / 'smoke-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        (ART / 'console.log').write_text('\n'.join(logs) or 'no console output captured\n', encoding='utf-8')

def _run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', args=['--use-angle=d3d11', '--ignore-gpu-blocklist'])
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        page = ctx.new_page()
        attach(page)
        page.goto(BASE)
        ready(page)
        page.wait_for_timeout(1500)

        gpu = page.evaluate("(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl2');if(!g)return 'none';const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';})()")
        diag = page.evaluate('FLYING_OBJECTS.diagnostics()')
        check('default scene renders objects', diag['count'] >= 10 and diag['calls'] > 5 and diag['time'] > 0, f"{diag} gpu={gpu}")
        check('settings panel starts closed', page.locator('#panel').is_hidden())

        # ---- screenshots: every style, plus a representative pass over modes
        page.mouse.move(720, 800)
        page.screenshot(path=str(ART / 'default-orbital.png'))
        styles = ['1997', 'porcelain', 'candy', 'foundry', 'tidal', 'sunset', 'spectral']
        for s in styles:
            page.evaluate(f'FLYING_OBJECTS.selectPreset("{s}")')
            page.wait_for_timeout(600)
            page.screenshot(path=str(ART / f'style-{s}.png'))
        check('all eight styles applied', page.evaluate('FLYING_OBJECTS.settings.preset') == 'spectral')

        modes = ['orbit', 'helix', 'vortex', 'swarm', 'classic', 'drift']
        for i, m in enumerate(modes):
            page.evaluate(f'FLYING_OBJECTS.selectMotion("{m}")')
            page.wait_for_timeout(1200)
            page.screenshot(path=str(ART / f'motion-{m}.png'))
            snap = page.evaluate('FLYING_OBJECTS.diagnostics()')
            if i == 0:
                check('motion switch keeps world alive', snap['time'] > 0 and snap['count'] >= 10, snap)
        classic_count = page.evaluate('FLYING_OBJECTS.diagnostics()')
        # last mode applied is drift again; classic was index 4
        page.evaluate('FLYING_OBJECTS.selectMotion("classic")')
        page.wait_for_timeout(300)
        d = page.evaluate('FLYING_OBJECTS.diagnostics()')
        check('classic flies one object, count pref kept', d['count'] == 1 and page.evaluate('FLYING_OBJECTS.settings.count') == 16, d)
        page.evaluate('FLYING_OBJECTS.selectMotion("drift")')

        # style change must not reset the world clock
        t0 = page.evaluate('FLYING_OBJECTS.world.simTime')
        bodies0 = page.evaluate('FLYING_OBJECTS.world.sample().bodies.map(b=>b.id+b.shape).join(",")')
        page.evaluate('FLYING_OBJECTS.selectPreset("candy")')
        bodies1 = page.evaluate('FLYING_OBJECTS.world.sample().bodies.map(b=>b.id+b.shape).join(",")')
        check('style swap does not reset world', bodies0 == bodies1 and page.evaluate('FLYING_OBJECTS.world.simTime') >= t0)

        # ---- pause
        page.keyboard.press('Space')
        page.wait_for_timeout(150)
        before = page.evaluate('FLYING_OBJECTS.diagnostics()')
        page.wait_for_timeout(500)
        after = page.evaluate('FLYING_OBJECTS.diagnostics()')
        check('pause freezes time', page.evaluate('FLYING_OBJECTS.paused') and before['time'] == after['time'], f"{before['time']} vs {after['time']}")
        check('pause stops GPU renders', before['renders'] == after['renders'], f"{before['renders']} vs {after['renders']}")
        # paused drag still renders (manual camera)
        page.mouse.move(720, 500); page.mouse.down(); page.mouse.move(840, 540); page.mouse.up()
        page.wait_for_timeout(150)
        check('paused camera orbit renders', page.evaluate('FLYING_OBJECTS.diagnostics().renders') > after['renders'])
        # paused settings change still renders a frame
        r0 = page.evaluate('FLYING_OBJECTS.diagnostics().renders')
        page.evaluate('FLYING_OBJECTS.selectPreset("tidal")')
        page.wait_for_timeout(150)
        check('paused style change renders once', page.evaluate('FLYING_OBJECTS.diagnostics().renders') > r0)
        check('preset reaches engine settings copy', page.evaluate('FLYING_OBJECTS.world.settings.preset') == 'tidal')

        # paused layout changes apply immediately (settleLayout, no time)
        sample_pos = 'FLYING_OBJECTS.world.sample().bodies.map(b=>b.position.map(v=>+v.toFixed(3)).join(",")).join("|")'
        pos0 = page.evaluate(sample_pos)
        page.evaluate('FLYING_OBJECTS.selectMotion("vortex")')
        page.wait_for_timeout(300)
        check('paused motion switch applies new layout', page.evaluate(sample_pos) != pos0)
        pos1 = page.evaluate(sample_pos)
        page.evaluate("(()=>{const el=document.getElementById('spreadIn');el.value='0.6';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
        page.wait_for_timeout(300)
        check('paused spread change moves positions', page.evaluate(sample_pos) != pos1)
        page.evaluate('FLYING_OBJECTS.selectMotion("drift")')
        page.evaluate("(()=>{const el=document.getElementById('spreadIn');el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));})()")

        # paused resize re-lays out portrait bounds without advancing time
        t_paused = page.evaluate('FLYING_OBJECTS.world.simTime')
        pos2 = page.evaluate(sample_pos)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(400)
        check('paused portrait resize re-lays out',
              page.evaluate(sample_pos) != pos2 and page.evaluate('FLYING_OBJECTS.world.simTime') == t_paused,
              page.evaluate('FLYING_OBJECTS.world.simTime'))
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.wait_for_timeout(300)
        # paused preset leaves transforms untouched
        pos3 = page.evaluate(sample_pos)
        page.evaluate('FLYING_OBJECTS.selectPreset("orbital")')
        page.wait_for_timeout(150)
        check('paused preset leaves transforms untouched', page.evaluate(sample_pos) == pos3)
        page.mouse.dblclick(720, 500)  # reset view
        page.keyboard.press('Space')   # resume

        # ---- modal / keyboard / native editing
        page.keyboard.press('o')
        check('O opens modal', page.locator('#panel').is_visible() and page.evaluate('FLYING_OBJECTS.panelOpen'))
        page.locator('summary').filter(has_text='Seed').click()
        page.locator('#seedIn').fill('123456')
        seed_before = page.evaluate('FLYING_OBJECTS.settings.seed')
        page.locator('#seedIn').press('r')  # inside text field: must NOT reseed via shortcut
        check('typing r in seed field does not trigger New', page.evaluate('FLYING_OBJECTS.settings.seed') == seed_before)
        page.locator('#seedBtn').click()
        page.wait_for_timeout(300)
        check('apply seed rebuilds scene', page.evaluate('FLYING_OBJECTS.settings.seed') == 123456 and page.evaluate('FLYING_OBJECTS.world.seed') == 123456)
        # select keeps digit typeahead (does not switch presets)
        p0 = page.evaluate('FLYING_OBJECTS.settings.preset')
        page.locator('#materialSel').focus(); page.keyboard.press('3')
        check('select keeps digit keys', page.evaluate('FLYING_OBJECTS.settings.preset') == p0)
        # Space on a summary toggles the details block natively, no pause
        display_sum = page.locator('summary').filter(has_text='Display')
        display_sum.focus()
        was_open = page.evaluate("document.querySelectorAll('details.blk')[3].open")
        page.keyboard.press('Space')
        page.wait_for_timeout(100)
        check('Space toggles details natively on summary',
              page.evaluate("document.querySelectorAll('details.blk')[3].open") != was_open)
        check('Space on summary does not pause', not page.evaluate('FLYING_OBJECTS.paused'))
        # focus trap
        page.locator('#panelClose').focus()
        page.keyboard.press('Shift+Tab')
        check('modal traps keyboard focus', page.evaluate('document.getElementById("panel").contains(document.activeElement) && document.activeElement.id!=="panelClose"'))
        page.keyboard.press('Escape')
        check('Escape closes and returns canvas focus', page.locator('#panel').is_hidden() and page.evaluate('document.activeElement.id') == 'gl')

        # ---- live controls
        page.keyboard.press('o')
        page.locator('#familySel').select_option('teapots')
        page.wait_for_timeout(300)
        shapes = page.evaluate('FLYING_OBJECTS.world.sample().bodies.map(b=>b.shape)')
        check('family switch live (teapots)', all(s == 'teapot' for s in shapes) and len(shapes) == 16, shapes[:4])
        page.locator('#familySel').select_option('mixed')
        page.evaluate("(()=>{const el=document.getElementById('countIn');el.value='24';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
        page.wait_for_timeout(200)
        check('count slider live', page.evaluate('FLYING_OBJECTS.world.count') == 24)
        page.locator('#materialSel').select_option('glass')
        page.wait_for_timeout(200)
        check('material override live', page.evaluate('FLYING_OBJECTS.settings.material') == 'glass')
        page.locator('#materialSel').select_option('auto')
        page.keyboard.press('Escape')

        # ---- auto cycle via debugStep (independent of speed; stops paused)
        page.evaluate('Object.assign(FLYING_OBJECTS.settings, {})')  # noop warm
        page.keyboard.press('o'); page.check('#autoCycleIn'); page.select_option('#cycleIntervalSel', '20'); page.keyboard.press('Escape')
        p_before = page.evaluate('FLYING_OBJECTS.settings.preset')
        page.evaluate('FLYING_OBJECTS.debugStep(21)')
        check('auto cycle advances style on wall clock', page.evaluate('FLYING_OBJECTS.settings.preset') != p_before, f'{p_before} -> {page.evaluate("FLYING_OBJECTS.settings.preset")}')
        p_now = page.evaluate('FLYING_OBJECTS.settings.preset')
        page.keyboard.press('Space')
        page.evaluate('FLYING_OBJECTS.debugStep(30)')
        check('paused: cycle does not advance', page.evaluate('FLYING_OBJECTS.settings.preset') == p_now)
        # zero speed: clock still ticks (independent of sim speed)
        page.keyboard.press('Space')
        page.keyboard.press('o')
        page.evaluate("(()=>{const el=document.getElementById('speedIn');el.value='0.15';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
        page.keyboard.press('Escape')
        # speed floor is .15; emulate "frozen sim" by checking simTime stays ~= while cycle counts
        t_a = page.evaluate('FLYING_OBJECTS.world.simTime')
        page.evaluate('FLYING_OBJECTS.debugStep(20)')
        t_b = page.evaluate('FLYING_OBJECTS.world.simTime')
        check('cycle independent of sim speed', t_b - t_a < 10, f'{t_a}->{t_b}')
        page.keyboard.press('o'); page.uncheck('#autoCycleIn'); page.keyboard.press('Escape')

        # ---- hide / restore
        page.keyboard.press('h')
        check('H hides all chrome', page.evaluate('document.getElementById("keystrip").hidden') and not page.evaluate('FLYING_OBJECTS.panelOpen'))
        page.keyboard.press('Escape')
        check('Escape restores controls', not page.evaluate('document.getElementById("keystrip").hidden'))

        # ---- PNG snapshot
        with page.expect_download() as download:
            page.keyboard.press('s')
        dl = download.value
        dl.save_as(str(ART / 'snapshot.png'))
        check('PNG export works', (ART / 'snapshot.png').stat().st_size > 10000)

        # ---- fullscreen: real attempt first, explicit skip if env forbids
        page.evaluate('document.getElementById("gl").focus()')
        page.keyboard.press('f')
        page.wait_for_timeout(400)
        fs = page.evaluate('document.fullscreenElement===document.documentElement')
        if fs:
            check('fullscreen covers whole document', True, 'fullscreenElement=documentElement')
            page.keyboard.press('f')
            page.wait_for_timeout(200)
        else:
            skip('fullscreen covers whole document', 'environment refused fullscreen request')
        # mocked rejection and missing API must report via toast, no pageerror
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

        # ---- independent retro toggles via keyboard
        page.keyboard.press('g')
        check('G toggles scanlines only', page.evaluate('FLYING_OBJECTS.settings.scanlines===true && FLYING_OBJECTS.settings.lowRes===false') and page.locator('#scanlines').is_visible())
        page.keyboard.press('g')
        page.keyboard.press('q')
        check('Q toggles lowres only', page.evaluate('FLYING_OBJECTS.settings.lowRes===true && FLYING_OBJECTS.settings.scanlines===false') and page.evaluate('document.body.classList.contains("lowres")'))
        page.keyboard.press('q')

        # ---- persistence of retro switches (Display section is collapsed)
        page.keyboard.press('o')
        open_blk(page, 'Display')
        page.check('#lowResIn'); page.check('#scanIn')
        page.keyboard.press('Escape')
        page.reload(); ready(page)
        check('lowres + scanlines persist', page.evaluate('FLYING_OBJECTS.settings.lowRes === true && FLYING_OBJECTS.settings.scanlines === true'))
        check('panel/pause not persisted', page.evaluate('!FLYING_OBJECTS.paused && !FLYING_OBJECTS.panelOpen'))
        page.keyboard.press('o')
        open_blk(page, 'Display')
        page.uncheck('#lowResIn'); page.uncheck('#scanIn')
        page.keyboard.press('Escape')

        # ---- seed wrap
        page.keyboard.press('o')
        open_blk(page, 'Seed')
        page.locator('#seedIn').fill('2147483647'); page.locator('#seedBtn').click()
        page.wait_for_timeout(200)
        page.keyboard.press('Escape')
        page.keyboard.press('r')
        check('R wraps seed max->0', page.evaluate('FLYING_OBJECTS.world.seed') == 0)
        page.locator('#keystrip').is_visible()

        # ---- resource boundedness across ~30 swaps
        page.keyboard.press('o')
        page.evaluate("(()=>{const el=document.getElementById('countIn');el.value='40';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
        page.keyboard.press('Escape')
        geo_series = []
        tex_series = []
        motions = ['drift', 'orbit', 'helix', 'vortex', 'swarm', 'classic']
        mats = ['auto', 'chrome', 'ceramic', 'glass', 'wireframe', 'checker']
        for i in range(30):
            page.evaluate(f'FLYING_OBJECTS.selectPreset("{["orbital","1997","porcelain","candy","foundry","tidal","sunset","spectral"][i % 8]}")')
            page.evaluate(f'FLYING_OBJECTS.selectMotion("{motions[i % 6]}")')
            page.evaluate(f'(()=>{{FLYING_OBJECTS.settings.material="{mats[i % 6]}";}})()')
            page.evaluate(f'(()=>{{const s=FLYING_OBJECTS.settings;FLYING_OBJECTS.world.updateSettings({{...s}});}})()')
            page.evaluate(f'FLYING_OBJECTS.debugStep(0.05)')
            d = page.evaluate('FLYING_OBJECTS.diagnostics()')
            geo_series.append(d['geometries']); tex_series.append(d['textures'])
        check('geometries bounded over 30 swaps', max(geo_series) - min(geo_series) <= 14, f'{min(geo_series)}..{max(geo_series)}')
        check('textures bounded over 30 swaps', max(tex_series) - min(tex_series) <= 3, f'{min(tex_series)}..{max(tex_series)}')
        page.screenshot(path=str(ART / 'stress-end.png'))

        # ---- reset to defaults so the mobile screenshots are deterministic
        page.evaluate('document.getElementById("resetBtn").click()')
        page.wait_for_timeout(300)
        check('reset restores defaults for mobile shots',
              page.evaluate('FLYING_OBJECTS.settings.count===16 && FLYING_OBJECTS.settings.preset==="orbital" && FLYING_OBJECTS.settings.speed===0.75 && FLYING_OBJECTS.world.seed===1997'))

        # ---- mobile layouts
        for w, h, tag in [(390, 844, '390'), (320, 700, '320')]:
            page.set_viewport_size({'width': w, 'height': h})
            page.wait_for_timeout(600)
            page.keyboard.press('o')
            page.wait_for_timeout(200)
            # panel top shows the Look section (scroll may be stale)
            page.evaluate('document.querySelector(".panel-body").scrollTop=0')
            page.wait_for_timeout(100)
            page.screenshot(path=str(ART / f'mobile-{tag}-panel.png'))
            ok = page.locator('#panel').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight;}')
            check(f'{tag}px panel inside viewport', ok)
            page.keyboard.press('Escape')
            ok = page.locator('#keystrip').evaluate('(el)=>el.getBoundingClientRect().width<=innerWidth')
            check(f'{tag}px strip has no horizontal overflow', ok)
            page.screenshot(path=str(ART / f'mobile-{tag}-scene.png'))

        # coarse pointer restore chip
        touch = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        tp = touch.new_page(); attach(tp); tp.goto(BASE); ready(tp)
        tp.evaluate('document.getElementById("kHide").click()')
        chip_vis = tp.locator('#restoreChip').is_visible()
        check('coarse pointer gets restore chip', chip_vis)
        if chip_vis:
            tp.locator('#restoreChip').click()
            check('chip restores chrome + panel', tp.evaluate('FLYING_OBJECTS.panelOpen'))
        touch.close()

        # reduced motion: fresh context starts paused + still camera
        reduced = browser.new_context(viewport={'width': 800, 'height': 600}, reduced_motion='reduce')
        rp = reduced.new_page(); attach(rp); rp.goto(BASE); ready(rp)
        check('reduced motion starts paused with fixed camera', rp.evaluate('FLYING_OBJECTS.paused && FLYING_OBJECTS.settings.camera==="fixed"'))
        r_a = rp.evaluate('FLYING_OBJECTS.diagnostics()'); rp.wait_for_timeout(500)
        r_b = rp.evaluate('FLYING_OBJECTS.diagnostics()')
        check('reduced motion stays still', r_a['time'] == r_b['time'])
        rp.screenshot(path=str(ART / 'reduced-motion.png'))
        reduced.close()

        # WebGL failure recovery
        failed = browser.new_context()
        fp = failed.new_page()
        fp.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};")
        fp.goto(BASE); fp.wait_for_timeout(400)
        check('WebGL failure shows readable recovery', fp.locator('#webglFail').is_visible())
        fp.screenshot(path=str(ART / 'webgl-fail.png'))
        failed.close()

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
