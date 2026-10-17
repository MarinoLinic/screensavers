"""Repeatable scene/art review. Uses installed Chrome; leaves captures in artifacts/.
Run with the local server running. Opens and closes its own browser only.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import base64
import json
import os

BASE=os.environ.get('BIOMES_URL','http://127.0.0.1:8099')
ART=Path(__file__).resolve().parent.parent/'artifacts'
ART.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_function('window.BIOME?.world')
    scenes=page.evaluate("async()=>Object.keys((await import('/js/settings.js')).HABITATS)")
    labels=page.evaluate("async()=>Object.fromEntries(Object.entries((await import('/js/settings.js')).HABITATS).map(([id,scene])=>[id,scene.label]))")
    page.keyboard.press('Space')
    page.keyboard.press('h')
    shots=[]
    for h in scenes:
        page.evaluate("h=>{BIOME.selectHabitat(h);BIOME.world.simTime=12;BIOME.renderer.render(BIOME.world)}",h)
        data=page.evaluate("BIOME.renderer.canvas.toDataURL('image/png')")
        path=ART/f'review-{h}.png'
        path.write_bytes(base64.b64decode(data.split(',')[1]))
        shots.append((h,path))
    page.keyboard.press('Escape');page.keyboard.press('o')
    page.select_option('#biomeSel','mediterranean')
    page.screenshot(path=str(ART/'review-panel.png'))
    page.keyboard.press('Escape')
    page.set_viewport_size({'width':390,'height':844})
    page.keyboard.press('h')
    for h in ['reef','lagoon','jungle','forest','tundra','med-cove','med-islands','med-harbour','med-terraces','river','moon','trop-beach','trop-atoll']:
        page.evaluate("h=>{BIOME.selectHabitat(h);BIOME.world.simTime=12;BIOME.renderer.render(BIOME.world)}",h)
        page.screenshot(path=str(ART/f'review-mobile-{h}.png'))
    page.keyboard.press('Escape');page.keyboard.press('o')
    page.screenshot(path=str(ART/'review-mobile-panel.png'))
    browser.close()

def sheet(name,items,cols):
    out=Image.new('RGB',(480*cols,324*((len(items)+cols-1)//cols)),'#172b30')
    draw=ImageDraw.Draw(out)
    for i,(h,path) in enumerate(items):
        x=(i%cols)*480;y=(i//cols)*324
        img=Image.open(path).convert('RGB').resize((480,300),Image.Resampling.NEAREST)
        out.paste(img,(x,y));draw.text((x+9,y+305),labels[h],fill='#e1e3bd')
    out.save(ART/name)
sheet('review-all.png',shots,3)
sheet('review-mediterranean.png',[(h,path) for h,path in shots if h.startswith('med-')],2)
sheet('review-tropical.png',[(h,path) for h,path in shots if h.startswith('trop-')],2)
sheet('review-woodlands.png',[(h,path) for h,path in shots if h in ['jungle','forest']],2)
(ART/'review-errors.json').write_text(json.dumps(errors,indent=2))
print(f'{len(shots)} scene captures; errors: {errors}')
if errors: raise SystemExit(1)
