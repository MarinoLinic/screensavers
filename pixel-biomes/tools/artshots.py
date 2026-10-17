"""Render art-review artifacts from tools/art-preview.html.
Requires the local server (npm run serve). Screenshots land in artifacts/.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64
import os

BASE = os.environ.get('BIOMES_URL', os.environ.get('TIDAL_URL', 'http://127.0.0.1:8099'))
ART = Path(__file__).resolve().parent.parent / 'artifacts'
ART.mkdir(exist_ok=True)

DESERT_LIGHTS = ['golden', 'day', 'night']

def save_png(page, expr, path):
    data = page.evaluate(f"(()=>{{const c={expr};return c.toDataURL('image/png');}})()")
    path.write_bytes(base64.b64decode(data.split(',', 1)[1]))

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome')
    page = browser.new_page(viewport={'width': 1600, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/tools/art-preview.html')
    page.wait_for_function('window.__artReady === true')
    habitats=page.evaluate("async()=> (await import('/js/settings.js')).HABITAT_ORDER.filter(h=>h!=='desert')")
    # Contact sheet: all creatures x3 frames + desert decor.
    page.locator('#sheet').screenshot(path=str(ART / 'art-contact-sheet.png'))
    for habitat in habitats:
        save_png(page, f"document.getElementById('backdrop-{habitat}')",
                 ART / f'backdrop-{habitat}.png')
    for light in DESERT_LIGHTS:
        save_png(page, f"document.getElementById('backdrop-desert-{light}')",
                 ART / f'backdrop-desert-{light}.png')
    browser.close()
    if errors: raise RuntimeError(str(errors))

names = (['art-contact-sheet.png']
         + [f'backdrop-{h}.png' for h in habitats]
         + [f'backdrop-desert-{l}.png' for l in DESERT_LIGHTS])
for name in names:
    pth = ART / name
    print('wrote', pth, pth.stat().st_size, 'bytes')
