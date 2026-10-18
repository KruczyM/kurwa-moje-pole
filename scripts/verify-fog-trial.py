"""Desktop browsers with touch/viewport emulation. Does not emulate physical iPhone memory limits."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/fog-trial'

async def run(engine, name, options):
    args = {'headless': True}
    if name == 'chromium':
        args['args'] = ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist']
    browser = await engine.launch(**args)
    context = await browser.new_context(**options)
    page = await context.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    await page.goto('http://127.0.0.1:5184/?server=http://127.0.0.1:3104')
    await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
    await page.locator('#player-nickname').fill('fog'+name)
    await page.locator('#play').click()
    await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=300000)
    await page.wait_for_timeout(4000)

    async def snapshot():
        return await page.evaluate('''()=>{
          const g=window.__camp_game;let proxies=0,renderableProxies=0;
          g.world.authoredRoot.traverse(o=>{if(o.userData.fogProxy){proxies++;if(o.layers.test(g.camera.layers))renderableProxies++;}});
          return {state:g.state.current,far:g.camera.far,fog:[g.scene.fog.near,g.scene.fog.far],
            calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
            sectors:g.sectorStreamer.stats,resources:g.sectorLoader.sectorResources.stats,
            cache:g.sectorLoader.cache.size,npcs:g.npcs.npcs.length,
            estimatedWorldTextureMiB:[...g.sectorLoader.sectorResources.textures.values()].reduce((n,r)=>n+(r.value.image?.width||0)*(r.value.image?.height||0)*4*4/3,0)/1048576,
            backgroundIsColor:g.scene.background?.isColor===true,
            visibleNpcs:g.npcs.npcs.filter(n=>n.root.visible).length,proxies,renderableProxies};
        }''')

    camp = await snapshot()
    assert camp['far']==15 and camp['fog']==[9,15], camp
    assert camp['renderableProxies']==0 and camp['proxies']>1000, camp
    assert camp['resources']['textures']>0 and camp['sectors']['loaded']>0, camp
    await page.screenshot(path=str(OUT / f'{name}-camp.png'))
    await page.evaluate('''()=>{
      const g=window.__camp_game;g.__oldSectors=[...g.sectorStreamer.loaded.keys()];
      const stage=g.world.mapScenery.find(s=>s.id==='Main_Stage_Deck_Plinth'||s.id==='mainStage');
      g.camera.position.set(stage.x,1.9,stage.z+12);g.camera.lookAt(stage.x,4,stage.z);
    }''')
    await page.wait_for_timeout(15000)
    stage = await snapshot()
    eviction = await page.evaluate('''()=>{
      const g=window.__camp_game;return g.__oldSectors.filter(id=>!g.sectorStreamer.loaded.has(id)).length;
    }''')
    assert eviction>0, {'camp':camp,'stage':stage}
    await page.screenshot(path=str(OUT / f'{name}-stage.png'))
    await page.locator('#mobile-menu').tap()
    await page.screenshot(path=str(OUT / f'{name}-menu.png'))
    assert not any('authored-festival.glb' in url or '/npcs/festival/' in url for url in requests)
    assert not errors, errors
    result={'engine':name,'camp':camp,'stage':stage,'evictedOldSectors':eviction,'pageErrors':errors,
      'worldRequests':[url for url in requests if '/fog-trial/' in url],
      'caveat':'Desktop touch/WebKit emulation, not physical iPhone RAM/GPU/thermal limits.'}
    (OUT / f'{name}.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='worldRequests'},indent=2))
    await browser.close()

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        if len(sys.argv)==1 or sys.argv[1]=='chromium':
            await run(p.chromium,'chromium',p.devices['iPhone 13'])
        if len(sys.argv)==1 or sys.argv[1]=='webkit':
            await run(p.webkit,'webkit',p.devices['iPhone 13'])

asyncio.run(main())
