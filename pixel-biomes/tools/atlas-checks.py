"""Integration checks for the complete biome atlas and its navigation.
Requires the local server; uses installed Chrome, no downloads or dependencies.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os

BASE=os.environ.get('BIOMES_URL','http://127.0.0.1:8099')
ART=Path(__file__).resolve().parent.parent/'artifacts'
ART.mkdir(exist_ok=True)
results=[];errors=[];external=[]
def check(name,ok,detail=''):
    results.append({'name':name,'passed':bool(ok),'detail':detail})
    print(('PASS ' if ok else 'FAIL ')+name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
    page.goto(BASE);page.wait_for_function('window.BIOME?.world')
    data=page.evaluate("async()=>{const s=await import('/js/settings.js');return {scenes:s.HABITAT_ORDER,biomes:s.BIOMES}}")
    scenes=data['scenes']
    check('17 scenes in 10 families',len(scenes)==17 and len(data['biomes'])==10)
    for h in scenes:
        page.evaluate('(h)=>BIOME.selectHabitat(h)',h)
        page.keyboard.press('o')
        family=page.locator('#biomeSel').input_value()
        visible=page.locator('.hab-btn:visible').count()
        check(h+' shows only its family cards',visible==len(data['biomes'][family]['scenes']))
        if h=='moon':
            check('Moon disables atmospheric controls',page.locator('#raysIn').is_disabled() and page.locator('#vegIn').is_disabled() and page.locator('#atmosphereHint').is_visible())
        if h!='desert':check(h+' hides desert-only lighting',page.locator('#desertLightField').is_hidden())
        page.keyboard.press('Escape')
        for size in [2,3,4]:
            page.evaluate('(px)=>BIOME.setSetting("pixelSize",px)',size)
            d=page.evaluate('BIOME.diagnostics()')
            check(h+f' covers viewport at pixel size {size}',d['w']*size>=1440 and d['h']*size>=900 and page.evaluate('BIOME.renderer.ctx.imageSmoothingEnabled===false'))
    page.evaluate('BIOME.setSetting("pixelSize",3)')
    # Next and previous traverse every scene, including family boundaries.
    page.evaluate('BIOME.selectHabitat("reef")')
    visited=[]
    for _ in range(len(scenes)):
        visited.append(page.evaluate('BIOME.settings.habitat'));page.keyboard.press('n')
    check('N traverses all scenes and wraps',visited==scenes and page.evaluate('BIOME.settings.habitat')=='reef')
    page.keyboard.press('ArrowLeft')
    check('left arrow wraps to Atoll Lagoon',page.evaluate('BIOME.settings.habitat')=='trop-atoll')
    page.keyboard.press('ArrowRight')
    check('right arrow wraps to Marine',page.evaluate('BIOME.settings.habitat')=='reef')
    page.keyboard.press('p')
    check('P wraps back to Atoll Lagoon',page.evaluate('BIOME.settings.habitat')=='trop-atoll')
    page.locator('#kNext').click();page.locator('#kPrev').click()
    check('Previous button follows the same scene order',page.evaluate('BIOME.settings.habitat')=='trop-atoll')
    page.keyboard.press('0')
    check('0 selects Tropical Island',page.evaluate('BIOME.settings.habitat') in ['trop-beach','trop-atoll'])
    page.evaluate('BIOME.selectHabitat("reef")')
    page.keyboard.press('o');page.locator('#seedIn').fill('123')
    page.keyboard.press('n')
    check('N cannot change scene while typing seed',page.evaluate('BIOME.settings.habitat')=='reef')
    page.keyboard.press('p')
    check('P cannot change scene while typing seed',page.evaluate('BIOME.settings.habitat')=='reef')
    page.select_option('#biomeSel','mediterranean')
    page.locator('[data-habitat="med-harbour"]').click()
    page.select_option('#biomeSel','marine');page.select_option('#biomeSel','mediterranean')
    check('family selection remembers its chosen design',page.evaluate('BIOME.settings.habitat')=='med-harbour')
    page.keyboard.press('Escape')
    # Equal family tour rotates both four-design families on return.
    page.evaluate('BIOME.selectHabitat("reef");BIOME.setSetting("autoCycle",true);BIOME.setSetting("cycleInterval",45);BIOME.setSetting("tourScope","biomes")')
    route=[]
    for _ in range(len(data['biomes'])*4):
        page.evaluate('BIOME.debugStep(46)');route.append(page.evaluate('BIOME.settings.habitat'))
    families={h:k for k,v in data['biomes'].items() for h in v['scenes']}
    check('equal tour visits each family four times',all(sum(families[h]==k for h in route)==4 for k in data['biomes']))
    check('equal tour rotates all Marine designs',len({h for h in route if families[h]=='marine'})==4)
    check('equal tour rotates all Mediterranean designs',len({h for h in route if families[h]=='mediterranean'})==4)
    page.evaluate('BIOME.setSetting("tourScope","family");BIOME.selectHabitat("med-cove")')
    family_route=[]
    for _ in range(4):
        page.evaluate('BIOME.debugStep(46)');family_route.append(page.evaluate('BIOME.settings.habitat'))
    check('family tour stays within Mediterranean',family_route==['med-islands','med-harbour','med-terraces','med-cove'])
    page.evaluate('BIOME.setSetting("tourScope","scenes");BIOME.selectHabitat("reef")')
    scene_route=[]
    for _ in range(len(scenes)):
        scene_route.append(page.evaluate('BIOME.settings.habitat'));page.evaluate('BIOME.debugStep(46)')
    check('all-scenes tour includes every design',scene_route==scenes)
    page.evaluate('BIOME.setSetting("autoCycle",false)')
    # Rendering cap actually limits paints; animation time remains continuous.
    for fps in [30,60]:
        page.evaluate('(fps)=>BIOME.setSetting("frameRate",fps)',fps)
        page.wait_for_timeout(100)
        before=page.evaluate('BIOME.diagnostics()');page.wait_for_timeout(1100);after=page.evaluate('BIOME.diagnostics()')
        paints=after['renders']-before['renders']
        check(f'{fps} fps render budget respected',15<paints<=fps*1.3,{'paints':paints})
    # Cached paint costs at maximum logical resolution, per scene.
    timings=page.evaluate("""(scenes)=>{BIOME.setSetting('pixelSize',2);return scenes.map(h=>{
      BIOME.selectHabitat(h);BIOME.renderer.render(BIOME.world);const start=performance.now();
      for(let i=0;i<90;i++){BIOME.world.simTime+=1/30;BIOME.renderer.render(BIOME.world)}
      return {scene:h,msPerFrame:(performance.now()-start)/90};
    })}""",scenes)
    check('cached scenes fit a 30 fps CPU budget',all(t['msPerFrame']<30 for t in timings),timings)
    # Both UI and landscape are usable on a narrow portrait device.
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('BIOME.setSetting("pixelSize",3)')
    for family in data['biomes']:
        page.keyboard.press('o');page.select_option('#biomeSel',family)
        check(f'{family} portrait panel fits',page.locator('#panel').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}'))
        page.keyboard.press('Escape')
    page.keyboard.press('o');page.locator('#resetBtn').click()
    check('Defaults changes family and paints its newly visible card',page.locator('#biomeSel').input_value()=='desert' and page.locator('[data-habitat="desert"] canvas').evaluate('(c)=>c.getContext("2d").getImageData(40,40,1,1).data[3]===255'))
    page.keyboard.press('Escape')
    check('no external requests',not external,external)
    check('no page errors',not errors,errors)
    browser.close()
(ART/'atlas-checks.json').write_text(json.dumps({'results':results,'errors':errors},indent=2),encoding='utf-8')
failed=[r for r in results if not r['passed']]
print(f'{len(results)-len(failed)}/{len(results)} checks passed',flush=True)
raise SystemExit(bool(failed))
