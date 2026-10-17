"""Collection navigation, startup, and shared UI checks in one isolated Chrome.
Run the root server first. Requires the installed Python Playwright package.
Screenshots and results are kept in ignored artifacts/collection/.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import json, os, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/"artifacts"/"collection"
ART.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get("SCREENSAVERS_URL","http://127.0.0.1:8094")
PROJECTS=[
 ("biome-worlds","BIOME_WORLDS","settingsButton","pause"),
 ("flying-objects-3d","FLYING_OBJECTS","kSettings","kPause"),
 ("liquid-worlds","LIQUID_WORLDS","settingsButton","pause"),
 ("pipes-3d","PIPELINE","kSettings","kPause"),
 ("pixel-biomes","BIOME","kSettings","kPause"),
 ("raycast-maze","Maze3D.game",None,None),
]
results=[]
errors=[]
def check(name,condition,detail=""):
    results.append(dict(name=name,passed=bool(condition),detail=detail))
    print(("PASS " if condition else "FAIL ")+name+(" "+str(detail) if detail else ""),flush=True)
def style(page,selector):
    return page.locator(selector).evaluate("(e)=>{const s=getComputedStyle(e);return [s.backgroundColor,s.fontFamily,s.borderRadius,s.color]}")
with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--use-angle=d3d11","--ignore-gpu-blocklist","--mute-audio"])
    try:
        page=browser.new_page(viewport={"width":1366,"height":900})
        current=[None]
        page.on("pageerror",lambda error:errors.append((current[0],str(error))))
        page.on("console",lambda message:errors.append((current[0],message.text)) if message.type=="error" else None)
        page.on("response",lambda response:errors.append((current[0],str(response.status)+" "+response.url)) if response.status>=400 else None)
        page.on("request",lambda request:errors.append((current[0],"External request "+request.url)) if request.url.startswith("http") and not request.url.startswith(BASE) else None)
        page.goto(BASE)
        check("launcher has six links",page.locator(".experience").count()==6)
        check("launcher fits desktop",page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        page.screenshot(path=str(ART/"library-desktop.png"),full_page=True)
        page.set_viewport_size({"width":390,"height":844})
        check("launcher fits portrait",page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        page.screenshot(path=str(ART/"library-portrait.png"),full_page=True)
        panel_styles={}
        for name,api,settings,pause in PROJECTS:
            current[0]=name
            page.set_viewport_size({"width":1366,"height":900})
            page.goto(BASE)
            page.locator('a.experience[href="'+name+'/"]').click()
            page.wait_for_function("Boolean(window."+api.replace(".", "?.")+")",timeout=30000)
            if name in ("biome-worlds","liquid-worlds"):
                page.wait_for_function("Boolean(window."+api+".world)")
            page.wait_for_timeout(1000)
            check(name+" opens from library",page.url==BASE+"/"+name+"/")
            check(name+" has Library control",page.locator(".collection-home").count()==1)
            fallback=page.locator("#failure, #webglFail")
            check(name+" renders without fallback",fallback.count()==0 or not fallback.is_visible())
            if settings:
                page.locator("#"+settings).click()
                check(name+" settings open",page.locator("#panel").is_visible())
                panel_styles[name]=style(page,"#panel")
                page.screenshot(path=str(ART/(name+"-desktop.png")))
                page.keyboard.press("Escape")
                page.locator("#"+pause).click()
                paused=page.evaluate(api+".isPaused()" if name=="pipes-3d" else api+".paused")
                check(name+" pause control",paused)
                page.locator("#"+pause).click()
                page.set_viewport_size({"width":390,"height":844})
                page.locator("#"+settings).click()
                box=page.locator("#panel").bounding_box()
                check(name+" portrait panel fits",box["x"]>=0 and box["x"]+box["width"]<=391 and box["y"]+box["height"]<=845)
                bad=page.locator("#panel").evaluate("(e)=>e.scrollWidth>e.clientWidth+1 || e.querySelector('.panel-body').scrollWidth>e.querySelector('.panel-body').clientWidth+1")
                check(name+" portrait fields fit",not bad)
                page.screenshot(path=str(ART/(name+"-portrait.png")))
                page.keyboard.press("Escape")
                if name=="liquid-worlds":
                    before=page.evaluate("LIQUID_WORLDS.settings.scene")
                    page.keyboard.press("n")
                    page.wait_for_timeout(900)
                    check("liquid next shortcut",page.evaluate("LIQUID_WORLDS.settings.scene")!=before)
            else:
                check("maze keeps original dark menu",page.locator(".intro-panel").evaluate("(e)=>getComputedStyle(e).fontFamily.includes('Lucida Console')"))
                page.screenshot(path=str(ART/(name+"-desktop.png")))
                page.set_viewport_size({"width":390,"height":844})
                check("maze intro fits portrait",page.locator(".intro-panel").bounding_box()["width"]<=390)
                page.screenshot(path=str(ART/(name+"-portrait.png")))
                check("maze menu can return to library",page.locator(".collection-return").is_visible())
                page.set_viewport_size({"width":1366,"height":900})
                page.locator("#enter-button").click()
                page.wait_for_timeout(200)
                page.evaluate("document.exitPointerLock?.()")
                check("maze enter control",not page.locator("#intro").is_visible())
                page.locator("#level-select-button").click()
                check("maze level picker opens",page.locator("#level-select").is_visible())
                check("maze exposes fifty levels",page.locator("#level-list option").count()==50)
                page.locator("#level-select-close").click()
                before=page.evaluate("Maze3D.game.levelIndex")
                page.locator("#next-button").click()
                check("maze next level control",page.evaluate("Maze3D.game.levelIndex")!=before)
            page.locator(".collection-home").click()
            page.wait_for_url(BASE+"/index.html")
            check(name+" returns to library",page.locator(".experience").count()==6)
        check("all five settings panels share dark colors and fonts",len({tuple(v) for v in panel_styles.values()})==1,panel_styles)
        check("no browser, network, or shader errors",not errors,errors)
        page.goto((ROOT/"index.html").as_uri())
        check("direct HTML explains local launch",page.locator("#file-help").is_visible())
    finally:
        browser.close()

# Real route checks that catch resource paths broken by missing trailing slashes.
req=urllib.request.Request(BASE+"/biome-worlds",method="GET")
with urllib.request.urlopen(req) as response:
    check("directory URL redirects to slash",response.url.endswith("/biome-worlds/"))
for path,status in [("/.git/config",404),("/artifacts/collection/library-desktop.png",404),("/%5c.git%5cconfig",400)]:
    try:
        urllib.request.urlopen(BASE+path)
        actual=200
    except urllib.error.HTTPError as error: actual=error.code
    check("private path blocked "+path,actual==status)
with urllib.request.urlopen(urllib.request.Request(BASE+"/liquid-worlds/js/app.js",method="HEAD")) as response:
    check("module MIME type",response.headers.get_content_type()=="text/javascript")

# Compact contact sheets for visual inspection.
for suffix in ("desktop","portrait"):
    thumbs=[]
    for name,*_ in PROJECTS:
        im=Image.open(ART/(name+"-"+suffix+".png")).convert("RGB")
        im.thumbnail((540,360))
        thumbs.append((name,im.copy()))
    sheet=Image.new("RGB",(1620,790),"#10252c")
    draw=ImageDraw.Draw(sheet)
    for i,(name,im) in enumerate(thumbs):
        x=(i%3)*540;y=(i//3)*395
        draw.text((x+10,y+8),name,fill="#eec97a")
        sheet.paste(im,(x+(540-im.width)//2,y+30))
    sheet.save(ART/("contact-"+suffix+".jpg"))
(ART/"results.json").write_text(json.dumps(dict(results=results,errors=errors),indent=2),encoding="utf-8")
raise SystemExit(0 if all(r["passed"] for r in results) else 1)
