"""Live WebGL/controls/lifecycle checks. Requires npm run serve.
Uses installed Chrome and local AMD/NVIDIA graphics; no browser downloads.
Screenshots and report go to artifacts/. Every opened browser is closed.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os
BASE=os.environ.get('LIQUID_WORLDS_URL','http://127.0.0.1:8097')
ART=Path(__file__).resolve().parent.parent/'artifacts'
ART.mkdir(exist_ok=True)
results=[]
errors=[]
external=[]
def check(name,condition,detail=''):
    results.append({'name':name,'passed':bool(condition),'detail':detail})
    print(('PASS ' if condition else 'FAIL ')+name+' '+str(detail),flush=True)
def attach(page):
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
def ready(page):
    page.wait_for_function('window.LIQUID_WORLDS?.world && document.getElementById("failure").hidden')
def travel(page,scene):
    previous=page.evaluate('LIQUID_WORLDS.generation')
    page.evaluate('(s)=>LIQUID_WORLDS.travel(s)',scene)
    page.wait_for_function('(g)=>LIQUID_WORLDS.generation>g',arg=previous)
    page.wait_for_timeout(750)
def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
        ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
        page=ctx.new_page();attach(page)
        page.goto(BASE);ready(page);page.wait_for_timeout(1500)
        gpu=page.evaluate("(()=>{const g=document.getElementById('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';})()")
        check('real WebGL scene initializes',page.evaluate('LIQUID_WORLDS.world.kind')=='grotto',gpu)
        check('settings start closed',page.locator('#panel').is_hidden())
        for scene in ['grotto','foundry','forest']:
            if scene!='grotto':travel(page,scene)
            page.wait_for_timeout(1500)
            diag=page.evaluate('LIQUID_WORLDS.diagnostics()')
            check(scene+' renders a living liquid',diag['time']>1 and diag['calls']>10,diag)
            check(scene+' has a reflection target',page.evaluate('LIQUID_WORLDS.world.water.mesh.getRenderTarget().width')==768)
            page.mouse.move(720,850);page.screenshot(path=str(ART/(scene+'.png')))
        check('forest has actual refraction',page.evaluate('!!LIQUID_WORLDS.world.refraction && LIQUID_WORLDS.world.water.uniforms.uHasRefraction.value===1'))
        page.keyboard.press('Space');page.wait_for_timeout(150)
        before=page.evaluate('LIQUID_WORLDS.diagnostics()');page.wait_for_timeout(500);after=page.evaluate('LIQUID_WORLDS.diagnostics()')
        check('pause freezes time',page.evaluate('LIQUID_WORLDS.paused') and before['time']==after['time'])
        check('pause stops GPU renders',before['renders']==after['renders'])
        page.keyboard.press('o');check('O opens modal',page.locator('#panel').is_visible())
        page.locator('summary').filter(has_text='Pattern & keyboard').click()
        page.locator('#seed').fill('123456');page.locator('#seed').press('r');check('editable field keeps shortcuts native',page.evaluate('LIQUID_WORLDS.settings.seed')==2001)
        page.locator('#seed').fill('123456');page.locator('#applySeed').click();page.wait_for_timeout(1400)
        check('apply seed rebuilds paused scene',page.evaluate('LIQUID_WORLDS.settings.seed')==123456 and page.evaluate('LIQUID_WORLDS.paused'))
        page.locator('#close').focus();page.keyboard.press('Shift+Tab');check('modal traps keyboard focus',page.evaluate('document.getElementById("panel").contains(document.activeElement) && document.activeElement.id!=="close"'))
        page.keyboard.press('Escape');check('Escape closes and returns canvas focus',page.locator('#panel').is_hidden() and page.evaluate('document.activeElement.id')=='canvas')
        start=page.evaluate('LIQUID_WORLDS.world.water.ripples.cursor');page.mouse.click(650,650);check('clicking water adds ripple',page.evaluate('LIQUID_WORLDS.world.water.ripples.cursor')!=start)
        page.mouse.move(720,500);page.mouse.down();page.mouse.move(840,535);page.mouse.up();page.wait_for_timeout(100)
        check('paused camera can orbit',page.evaluate('LIQUID_WORLDS.diagnostics().renders')>after['renders'])
        page.mouse.dblclick(720,500)
        page.keyboard.press('h');check('H hides all chrome',page.evaluate('document.body.classList.contains("quiet")'))
        page.keyboard.press('Escape');check('Escape restores controls',not page.evaluate('document.body.classList.contains("quiet")'))
        with page.expect_download() as download:page.keyboard.press('s')
        dl=download.value;dl.save_as(str(ART/'snapshot.png'));check('PNG export works',(ART/'snapshot.png').stat().st_size>10000)
        page.keyboard.press('f');page.wait_for_timeout(200);check('fullscreen includes whole document',page.evaluate('document.fullscreenElement===document.documentElement'))
        page.keyboard.press('f')
        page.keyboard.press('o');page.select_option('#quality','high');page.wait_for_timeout(1500)
        check('high detail changes reflection budget',page.evaluate('LIQUID_WORLDS.world.water.mesh.getRenderTarget().width')==1280)
        page.select_option('#quality','low');page.wait_for_timeout(1500)
        check('economy changes reflection budget',page.evaluate('LIQUID_WORLDS.world.water.mesh.getRenderTarget().width')==384)
        page.keyboard.press('Escape')
        page.keyboard.press('Space')
        # Repeated replacement, including each scene's unique shadow/texture resources.
        counts=[]
        for i in range(12):
            scene=['grotto','foundry','forest'][i%3];travel(page,scene);counts.append((scene,page.evaluate('LIQUID_WORLDS.diagnostics()')))
        for scene in ['grotto','foundry','forest']:
            same=[d for k,d in counts if k==scene]
            check(scene+' resources remain bounded across replacements',max(d['textures'] for d in same)-min(d['textures'] for d in same)<=1 and max(d['geometries'] for d in same)-min(d['geometries'] for d in same)<=1,same[-1])
        page.keyboard.press('o');page.check('#cycle');page.select_option('#interval','30');page.keyboard.press('Escape')
        old=page.evaluate('LIQUID_WORLDS.generation');page.wait_for_function('(g)=>LIQUID_WORLDS.generation>g',arg=old,timeout=40000)
        check('automatic travel reaches next scene',page.evaluate('LIQUID_WORLDS.world.kind')=='grotto')
        page.keyboard.press('o');page.uncheck('#cycle');page.locator('#bloom').uncheck();page.keyboard.press('Escape')
        page.reload();ready(page);check('preferences persist without persisting pause or modal',page.evaluate('LIQUID_WORLDS.settings.seed===123456 && LIQUID_WORLDS.settings.quality==="low" && !LIQUID_WORLDS.settings.bloom && !LIQUID_WORLDS.paused && !LIQUID_WORLDS.panelOpen'))
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(800);page.keyboard.press('o');page.screenshot(path=str(ART/'mobile-settings.png'))
        check('390px settings stay inside viewport',page.locator('#panel').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight;}'))
        page.keyboard.press('Escape');page.screenshot(path=str(ART/'mobile-scene.png'))
        check('390px toolbar has no horizontal overflow',page.locator('.toolbar').evaluate('(el)=>el.getBoundingClientRect().width<=innerWidth'))
        reduced=browser.new_context(viewport={'width':800,'height':600},reduced_motion='reduce');rp=reduced.new_page();attach(rp);rp.goto(BASE+'/?quality=low');ready(rp)
        check('reduced motion starts paused with a still camera',rp.evaluate('LIQUID_WORLDS.paused && LIQUID_WORLDS.settings.camera==="fixed"'))
        reduced.close()
        failed=browser.new_context();fp=failed.new_page()
        fp.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};")
        fp.goto(BASE);fp.wait_for_timeout(200)
        check('WebGL failure shows readable recovery',fp.locator('#failure').is_visible());failed.close()
        check('no runtime network dependencies',not external,external)
        check('no shader or JavaScript errors',not errors,errors)
        browser.close()
    report={'results':results,'errors':errors,'externalRequests':external}
    (ART/'smoke-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    failed=[r for r in results if not r['passed']]
    print(f'{len(results)-len(failed)}/{len(results)} checks passed',flush=True)
    return bool(failed)
if __name__=='__main__':raise SystemExit(run())
