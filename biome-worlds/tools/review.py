"""Render every world and look with installed hardware-backed Chrome.
Only opens its own browser session and always closes it.
Run npm run serve first. Requires the already-installed Playwright and Pillow.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import json
import os

BASE=os.environ.get('BIOME_WORLDS_URL','http://127.0.0.1:8103')
ART=Path(__file__).resolve().parent.parent/'artifacts'
ART.mkdir(exist_ok=True)
errors=[]
shots=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    try:
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto(BASE+'/?mode=landscape')
        page.wait_for_function('window.BIOME_WORLDS?.world')
        page.evaluate('BIOME_WORLDS.setPause(true); BIOME_WORLDS.clock.time=12; BIOME_WORLDS.render()')
        for look in ['natural','porcelain','nocturne']:
            page.evaluate('(s)=>BIOME_WORLDS.selectLook(s)',look)
            for biome in page.evaluate("async()=> (await import('/js/config.js')).BIOMES.map(b=>b.id)"):
                page.evaluate('(s)=>BIOME_WORLDS.selectBiome(s)',biome)
                page.evaluate('BIOME_WORLDS.render()')
                page.wait_for_timeout(120)
                path=ART/f'{look}-{biome}.png'
                page.screenshot(path=str(path))
                shots.append((look,biome,path))
        page.keyboard.press('o');page.screenshot(path=str(ART/'settings-desktop.png'));page.keyboard.press('Escape')
        page.evaluate("BIOME_WORLDS.selectLook('natural');BIOME_WORLDS.selectMode('diorama')")
        for biome in page.evaluate("async()=> (await import('/js/config.js')).BIOMES.map(b=>b.id)"):
            page.evaluate('(s)=>BIOME_WORLDS.selectBiome(s)',biome);page.evaluate('BIOME_WORLDS.render()');page.wait_for_timeout(100);page.screenshot(path=str(ART/f'diorama-{biome}.png'))
        page.evaluate("BIOME_WORLDS.selectMode('landscape')")
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate("BIOME_WORLDS.selectLook('natural');BIOME_WORLDS.selectBiome('mediterranean')")
        page.wait_for_timeout(150);page.screenshot(path=str(ART/'portrait.png'))
        page.keyboard.press('o');page.screenshot(path=str(ART/'settings-portrait.png'))
        page.keyboard.press('Escape')
        for biome in page.evaluate("async()=> (await import('/js/config.js')).BIOMES.map(b=>b.id)"):
            page.evaluate('(s)=>BIOME_WORLDS.selectBiome(s)',biome);page.evaluate('BIOME_WORLDS.render()');page.wait_for_timeout(100);page.screenshot(path=str(ART/f'portrait-{biome}.png'))
    finally:
        browser.close()

for look in ['natural','porcelain','nocturne']:
    items=[s for s in shots if s[0]==look]
    out=Image.new('RGB',(1440,((len(items)+2)//3)*325),'#1e3035')
    draw=ImageDraw.Draw(out)
    for i,(_,biome,path) in enumerate(items):
        x=i%3*480;y=i//3*325
        out.paste(Image.open(path).convert('RGB').resize((480,300),Image.Resampling.LANCZOS),(x,y))
        draw.text((x+12,y+306),biome.upper(),fill='#e2e6de')
    out.save(ART/f'contact-{look}.jpg',quality=92)
(ART/'review-errors.json').write_text(json.dumps(errors,indent=2),encoding='utf-8')
print(f'{len(shots)} desktop captures + settings and portrait. Errors: {errors}',flush=True)
if errors:raise SystemExit(1)
