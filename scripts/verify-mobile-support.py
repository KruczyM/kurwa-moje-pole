"""Real Chromium viewport/layout and render measurements (desktop GPU, not phone FPS)."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

SIZES = [(360, 800), (390, 844), (412, 915), (768, 1024), (844, 390), (1024, 768), (1440, 900)]
PANELS = ['start', 'loading', 'pause', 'inventory', 'dialog', 'festival-guide', 'festival-map',
          'flanki-roster-modal', 'eco-panel', 'guitar-hud', 'guitar-song-select-modal', 'use-sequence', 'effect-warning', 'inspect']

async def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else 'after'
    output = Path(__file__).resolve().parents[1] / 'reports' / 'mobile-support'
    output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=angle',
            '--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        context = await browser.new_context(viewport={'width': 390, 'height': 844},
                                            device_scale_factor=3, is_mobile=True, has_touch=True)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://127.0.0.1:5180/?server=http://127.0.0.1:3101')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.screenshot(path=str(output / f'{phase}-start.png'))
        layouts = []
        for width, height in SIZES:
            await page.set_viewport_size({'width': width, 'height': height})
            for panel in PANELS:
                layout = await page.evaluate('''(id)=>{
                  const panel=document.getElementById(id);if(!panel)return null;
                  const peers=[...document.querySelectorAll('#ui > section')];
                  const saved=peers.map(e=>[e,e.hidden]);peers.forEach(e=>e.hidden=true);
                  const parents=[];let parent=panel.parentElement;
                  while(parent&&parent.id!=='ui'){parents.push([parent,parent.hidden]);parent.hidden=false;parent=parent.parentElement;}
                  const old=panel.hidden;panel.hidden=false;
                  const r=panel.getBoundingClientRect();
                  const result={id,x:r.x,y:r.y,width:r.width,height:r.height,
                    horizontalOverflow:panel.scrollWidth-panel.clientWidth,
                    outside:r.x < -1||r.y < -1||r.right>innerWidth+1||r.bottom>innerHeight+1,
                    scrollable:getComputedStyle(panel).overflowY};
                  panel.hidden=old;parents.forEach(([e,h])=>e.hidden=h);saved.forEach(([e,h])=>e.hidden=h);return result;
                }''', panel)
                if layout:
                    layouts.append({'viewport': [width, height], **layout})
        if '--ui-only' in sys.argv:
            assert not any(x['outside'] or x['horizontalOverflow'] > 2 for x in layouts)
            desktop = await browser.new_context(viewport={'width':1440,'height':900}, has_touch=False)
            desktop_page = await desktop.new_page()
            await desktop_page.goto('http://127.0.0.1:5180/')
            await desktop_page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
            desktop_layout = await desktop_page.evaluate('''()=>{
              const p=document.querySelector('#start');return {width:p.clientWidth,overflow:p.scrollWidth-p.clientWidth,
                columns:getComputedStyle(document.querySelector('#character-select')).gridTemplateColumns};
            }''')
            assert desktop_layout['overflow'] <= 2
            await desktop_page.screenshot(path=str(output / 'desktop-start.png'))
            await page.set_viewport_size({'width':390,'height':844})
            controls = await page.evaluate('''()=>{
              document.querySelector('#start').hidden=true;document.querySelector('#hud').hidden=false;
              document.body.classList.add('mobile-input');document.querySelector('#mobile-controls').hidden=false;
              const a=document.querySelector('#mobile-interact').getBoundingClientRect(),b=document.querySelector('#mobile-jump').getBoundingClientRect();
              const overlap=Math.max(a.left,b.left)<Math.min(a.right,b.right)&&Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom);
              document.querySelector('#pause').hidden=false;
              const q=document.querySelector('#setting-mobile-quality'),r=q.getBoundingClientRect();
              const clickable=q.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
              return {overlap,pauseQualityClickable:clickable};
            }''')
            assert not controls['overlap'] and controls['pauseQualityClickable']
            await page.screenshot(path=str(output / 'layout-pause.png'))
            result={'layouts':layouts,'desktop':desktop_layout,'touchControls':controls,'pageErrors':errors}
            (output / 'layout-final.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
            print(json.dumps({'desktop':desktop_layout,'touchControls':controls,'pageErrors':errors},indent=2))
            await browser.close()
            return
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.locator('#player-nickname').fill('MobileQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs', timeout=180000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=120000)
        await page.wait_for_function('()=>window.__camp_game.npcs.npcs.length>=107', timeout=180000)
        await page.evaluate('''()=>{
            const g=window.__camp_game;g.camera.position.set(0,1.9,7);
            g.player.yaw=0;g.player.pitch=0;g.networkClient.disconnect(true);
        }''')
        async def measure():
            return await page.evaluate('''async()=>{
              const g=window.__camp_game,frames=[];let previous=performance.now();
              for(let i=0;i<40;i++){const now=await new Promise(requestAnimationFrame);
                if(i>5)frames.push(now-previous);previous=now;}
              const info=g.renderer.info;let meshes=0,casters=0;
              g.scene.traverseVisible(o=>{if(o.isMesh){meshes++;if(o.castShadow)casters++;}});
              return {frameMs:frames.reduce((a,b)=>a+b,0)/frames.length,
                calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,
                textures:info.memory.textures,visibleMeshes:meshes,shadowCasters:casters,
                dpr:g.renderer.getPixelRatio(),drawingBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],
                npcs:g.npcs.npcs.length,visibleNpcs:g.npcs.npcs.filter(n=>n.root.visible).length};
            }''')
        game_measurements = {'phone': await measure()}
        await page.screenshot(path=str(output / f'{phase}-game.png'))
        await page.set_viewport_size({'width': 844, 'height': 390})
        game_measurements['landscape'] = await measure()
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.locator('#mobile-menu').click()
        await page.screenshot(path=str(output / f'{phase}-pause.png'))
        result = {'phase': phase, 'layouts': layouts, 'measurements': game_measurements,
                  'pageErrors': errors, 'hardwareCaveat': 'Chromium on desktop GPU with emulated touch/DPR; not real phone FPS'}
        (output / f'{phase}.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps({'phase':phase, 'outsidePanels':[x for x in layouts if x['outside']],
                          'measurements':game_measurements, 'pageErrors':errors}, indent=2))
        await browser.close()

asyncio.run(main())
