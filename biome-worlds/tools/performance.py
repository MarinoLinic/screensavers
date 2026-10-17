from playwright.sync_api import sync_playwright
from pathlib import Path
import json
BASE='http://127.0.0.1:8103'
rows=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    try:
        page=browser.new_page(viewport={'width':1440,'height':900});page.goto(BASE+'/?mode=landscape&quality=balanced')
        page.wait_for_function('window.BIOME_WORLDS?.world')
        for biome in page.evaluate("async()=> (await import('/js/config.js')).BIOMES.map(b=>b.id)"):
            page.evaluate('(s)=>BIOME_WORLDS.selectBiome(s)',biome);page.wait_for_timeout(700)
            before=page.evaluate('BIOME_WORLDS.diagnostics()');page.wait_for_timeout(1500);after=page.evaluate('BIOME_WORLDS.diagnostics()')
            fps=(after['renders']-before['renders'])/1.5;row={'biome':biome,'fps':round(fps,1),'triangles':after['triangles'],'calls':after['calls']};rows.append(row);print(row,flush=True)
    finally:browser.close()
(Path(__file__).resolve().parent.parent/'artifacts'/'performance.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
