"""Live controls, graphics, accessibility, and long-running resource checks.
Uses installed Chrome/ANGLE D3D11, closes its own session, and downloads no browser.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os

BASE=os.environ.get('BIOME_WORLDS_URL','http://127.0.0.1:8103')
ART=Path(__file__).resolve().parent.parent/'artifacts'
ART.mkdir(exist_ok=True)
results=[];errors=[];external=[]

def check(name,value,detail=''):
    results.append({'name':name,'passed':bool(value),'detail':detail})
    print(('PASS ' if value else 'FAIL ')+name+' '+str(detail),flush=True)

def attach(page):
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') and not r.url.startswith('blob:') else None)

def ready(page):page.wait_for_function('window.BIOME_WORLDS?.world && document.getElementById("failure").hidden')
def diag(page):return page.evaluate('BIOME_WORLDS.diagnostics()')
def travel(page,biome):
    page.evaluate('(s)=>BIOME_WORLDS.selectBiome(s)',biome)
    page.wait_for_timeout(100)

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    try:
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
        page=context.new_page();attach(page);page.goto(BASE);ready(page)
        gpu=page.evaluate("(()=>{const g=document.getElementById('world').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';})()")
        check('hardware-backed WebGL rendering','SwiftShader' not in gpu and 'ANGLE' in gpu,gpu)
        check('landscape is the default mode',diag(page)['mode']=='landscape')
        check('initial scene and panel',diag(page)['biome']=='mediterranean' and not diag(page)['panelOpen'])
        check('UI uses biome names and plain display properties',page.locator('#panelTitle').inner_text()=='BIOME 3D — Display Properties' and 'Your little world' not in page.locator('body').inner_text())
        biomes=page.evaluate("async()=> (await import('/js/config.js')).BIOMES.map(b=>b.id)")
        for look in ['natural','porcelain','nocturne']:
            page.evaluate('(s)=>BIOME_WORLDS.selectLook(s)',look)
            for biome in biomes:
                travel(page,biome)
                d=diag(page)
                check(look+'/'+biome+' renders geometry',d['triangles']>4000 and d['calls']>5,d)
        travel(page,'moon')
        check('lunar scene has no trees or water',diag(page)['trees']==0 and diag(page)['water']==0)
        travel(page,'river')
        check('river tree trunks are all set back from water',page.evaluate("async()=>{const c=await import('/js/landscapes.js');return BIOME_WORLDS.world.treeSites.every(t=>c.channelDistance(t.x,t.z)>9);}"))
        before=diag(page);page.wait_for_timeout(1500);after=diag(page)
        check('animation clock and render cadence advance',after['time']>before['time']+.7 and after['renders']>before['renders']+20,{'fps':round((after['renders']-before['renders'])/1.5,1),'calls':after['calls']})
        page.keyboard.press('Space');page.wait_for_timeout(150);before=diag(page);page.wait_for_timeout(500);after=diag(page)
        check('pause freezes simulation and GPU renders',after['paused'] and before['time']==after['time'] and before['renders']==after['renders'])
        fixed=diag(page)['cameraMatrix']
        page.mouse.move(680,450);page.mouse.down();page.mouse.move(800,470);page.mouse.up();page.mouse.wheel(0,-200);page.wait_for_timeout(150)
        check('landscape drag and scroll never move the camera',diag(page)['cameraMatrix']==fixed and diag(page)['zoom']==1 and diag(page)['manualYaw']==0)
        check('landscape clicks create an effect',diag(page)['effects']>0)
        page.evaluate("BIOME_WORLDS.selectMode('diorama')");page.wait_for_timeout(120)
        check('diorama mode preserves the miniature scene',diag(page)['mode']=='diorama' and page.evaluate('!BIOME_WORLDS.world.mode'))
        after=diag(page)
        page.mouse.move(680,450);page.mouse.down();page.mouse.move(800,470);page.mouse.up();page.wait_for_timeout(150)
        check('paused camera can still be dragged',abs(diag(page)['manualYaw'])>.1 and diag(page)['renders']>after['renders'])
        page.mouse.wheel(0,-200);page.wait_for_timeout(150);check('wheel zoom changes framing',diag(page)['zoom']>1)
        page.keyboard.press('r');page.wait_for_timeout(100);check('R resets camera',diag(page)['zoom']==1 and diag(page)['manualYaw']==0)
        page.keyboard.press('o');check('O opens dialog',page.locator('#panel').is_visible())
        check('modal removes background controls from keyboard focus',page.locator('#world').get_attribute('inert') is not None)
        page.locator('#close').focus();page.keyboard.press('Shift+Tab');check('dialog traps backwards keyboard focus',page.evaluate('document.activeElement.id==="reset"'))
        page.locator('#reset').focus();page.keyboard.press('Tab');check('dialog traps forwards keyboard focus',page.evaluate('document.activeElement.id==="close"'))
        check('diorama camera controls are shown only in diorama mode',page.locator('#cameraRow').is_visible())
        page.select_option('#aesthetic','porcelain');check('style selector rebuilds the current scene',diag(page)['aesthetic']=='porcelain' and diag(page)['biome']=='river')
        page.select_option('#camera','still');check('camera preference changes',page.evaluate('BIOME_WORLDS.settings.camera==="still"'))
        page.select_option('#quality','low');check('economy caps pixels and disables shadows',page.evaluate('BIOME_WORLDS.renderer.getPixelRatio()<=1 && !BIOME_WORLDS.renderer.shadowMap.enabled'))
        page.select_option('#quality','high');check('high detail enables shadows',page.evaluate('BIOME_WORLDS.renderer.shadowMap.enabled'))
        page.uncheck('#atmosphere');check('atmosphere can be hidden while paused',not diag(page)['atmosphere'])
        page.select_option('#quality','balanced');page.check('#tour');page.select_option('#interval','45');page.keyboard.press('Escape')
        check('Escape closes dialog and restores focus',page.locator('#panel').is_hidden() and page.evaluate('!document.getElementById("world").hasAttribute("inert")'))
        page.keyboard.press('h');check('H hides chrome',page.evaluate('document.body.classList.contains("quiet")'))
        page.locator('#restore').click();check('restore button shows chrome',not page.evaluate('document.body.classList.contains("quiet")'))
        with page.expect_download() as download:page.keyboard.press('s')
        download.value.save_as(str(ART/'snapshot.png'));check('snapshot creates a PNG',(ART/'snapshot.png').stat().st_size>30000,download.value.suggested_filename)
        page.keyboard.press('f');page.wait_for_timeout(100);check('fullscreen covers the whole document',page.evaluate('document.fullscreenElement===document.documentElement'));page.keyboard.press('f')
        page.evaluate('BIOME_WORLDS.clock.tourTime=44.7');page.wait_for_timeout(500);check('pause also freezes tour',diag(page)['biome']=='river' and diag(page)['tourTime']==44.7)
        page.keyboard.press('Space');page.wait_for_function('BIOME_WORLDS.settings.biome==="moon"',timeout=5000);check('tour advances to the next family',diag(page)['biome']=='moon')
        page.keyboard.press('o');page.uncheck('#tour');page.keyboard.press('Escape')
        page.reload();ready(page);check('mode/settings persist and pause/dialog do not',page.evaluate('BIOME_WORLDS.settings.mode==="diorama" && BIOME_WORLDS.settings.aesthetic==="porcelain" && BIOME_WORLDS.settings.camera==="still" && !BIOME_WORLDS.settings.atmosphere && !BIOME_WORLDS.paused && !BIOME_WORLDS.diagnostics().panelOpen'))
        for biome in biomes:
            travel(page,biome);check('preserved diorama/'+biome+' renders',diag(page)['triangles']>4000)
        page.evaluate("BIOME_WORLDS.selectMode('landscape')");page.wait_for_timeout(120);page.keyboard.press('o')
        check('landscape mode hides orbit controls',page.locator('#cameraRow').is_hidden());page.keyboard.press('Escape')
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})")
        before=diag(page);page.wait_for_timeout(300);after=diag(page);check('background state stops animation and rendering',before['time']==after['time'] and before['renders']==after['renders'])
        page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
        # Three.js lazily warms shared shadow-material variants. Warm each scene
        # before measuring three complete cycles so compilation is not a leak.
        for biome in biomes:travel(page,biome)
        counts={}
        for _ in range(3):
            for biome in biomes:
                travel(page,biome);counts.setdefault(biome,[]).append(diag(page))
        check('geometries do not accumulate across 30 scene replacements',all(max(d['geometries'] for d in rows)-min(d['geometries'] for d in rows)<=1 for rows in counts.values()))
        check('textures do not accumulate across 30 scene replacements',all(max(d['textures'] for d in rows)-min(d['textures'] for d in rows)<=1 for rows in counts.values()))
        check('shader programs do not accumulate across 30 scene replacements',all(max(d['programs'] for d in rows)-min(d['programs'] for d in rows)<=1 for rows in counts.values()),{b:[d['programs'] for d in rows] for b,rows in counts.items()})
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(120);page.keyboard.press('o')
        check('portrait dialog fits the viewport',page.locator('#panel').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}'))
        check('portrait page has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.keyboard.press('Escape');check('portrait control strip fits',page.locator('#keystrip').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}'))
        page.set_viewport_size({'width':800,'height':450});page.wait_for_timeout(120);check('short landscape control strip fits',page.locator('#keystrip').evaluate('(el)=>el.getBoundingClientRect().bottom<=innerHeight'))
        reduced=browser.new_context(viewport={'width':800,'height':600},reduced_motion='reduce');rp=reduced.new_page();attach(rp);rp.goto(BASE);ready(rp)
        check('reduced motion starts paused with a still camera',rp.evaluate('BIOME_WORLDS.paused && BIOME_WORLDS.settings.camera==="still"'));reduced.close()
        corrupt=browser.new_context();cp=corrupt.new_page();attach(cp);cp.add_init_script("localStorage.setItem('biome-worlds.v1','{not json')");cp.goto(BASE);ready(cp);check('corrupt storage recovers to defaults',diag(cp)['biome']=='mediterranean');corrupt.close()
        denied=browser.new_context();dp=denied.new_page();attach(dp);dp.add_init_script("Object.defineProperty(window,'localStorage',{get:()=>{throw new Error('blocked')}})");dp.goto(BASE);ready(dp);travel(dp,'forest');check('blocked storage does not stop scene changes',diag(dp)['biome']=='forest');denied.close()
        failed=browser.new_context();fp=failed.new_page()
        fp.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}")
        fp.goto(BASE);fp.wait_for_timeout(150);check('WebGL failure has a readable recovery panel',fp.locator('#failure').is_visible());failed.close()
        check('no remote runtime requests',not external,external)
        check('no JavaScript or shader errors',not errors,errors)
    finally:browser.close()

(ART/'smoke-report.json').write_text(json.dumps({'results':results,'errors':errors,'external':external},indent=2),encoding='utf-8')
print(f'{sum(r["passed"] for r in results)}/{len(results)} checks passed',flush=True)
if not all(r['passed'] for r in results):raise SystemExit(1)
