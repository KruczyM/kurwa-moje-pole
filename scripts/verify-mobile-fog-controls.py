"""Browser integration QA. Desktop WebKit/touch emulation is not physical iPhone performance."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/mobile-fog-controls'

async def run(engine, name, options):
    args = {'headless': True}
    if name == 'chromium':
        args['args'] = ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist']
    browser = await engine.launch(**args)
    context = await browser.new_context(**options)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.goto('http://127.0.0.1:5185/?fogTrial=1&server=http://127.0.0.1:3104')
    async def enter():
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#player-nickname').fill('FogControlsQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=300000)
    await enter()
    await page.wait_for_timeout(2000)
    viewport = await page.evaluate('''()=>{const g=window.__camp_game;return {
      aspect:g.camera.aspect,expected:innerWidth/innerHeight,setting:g.settings.aspectRatio};}''')
    assert viewport['setting']=='auto' and abs(viewport['aspect']-viewport['expected'])<0.001, viewport
    # Use the existing world interaction, then actual DOM controls (no forced clicks).
    interaction = await page.evaluate('''()=>{
      const g=window.__camp_game;
      const trigger=g.world.interactables.find(i=>i.action==='campfire_guitar').object;
      const point=trigger.getWorldPosition(g.camera.position.clone());
      g.camera.position.set(point.x,point.y+.3,point.z+1);
      g.camera.lookAt(point);g.camera.updateMatrixWorld(true);
      const i=g.interactions.update();
      g.key(new KeyboardEvent('keydown',{key:'e',code:'KeyE'}));return i?.kind;
    }''')
    assert interaction=='campfire_guitar', interaction
    await page.locator('[data-song-id="czarny-chleb-midi"]').tap()
    await page.wait_for_function('()=>window.__camp_game.campfireGuitarGame.getPhase()==="playing"')
    assert await page.locator('.guitar-hit-btn').count()==5
    guitar_bounds = await page.locator('#guitar-hud').bounding_box()
    screen = page.viewport_size
    assert guitar_bounds['x']>=0 and guitar_bounds['y']>=0 and guitar_bounds['x']+guitar_bounds['width']<=screen['width']+1 and guitar_bounds['y']+guitar_bounds['height']<=screen['height']+1, guitar_bounds
    # Freeze only the minigame's clock to make the input assertion independent of headless FPS.
    lane = await page.evaluate('''()=>{
      const g=window.__camp_game.campfireGuitarGame;
      g.__qaUpdate=g.update;g.update=()=>{};
      const n=g.currentSong.notes[0];g.currentTime=n.time;return n.lane;
    }''')
    await page.locator(f'.guitar-hit-btn[data-lane="{lane}"]').tap()
    await page.wait_for_function('()=>window.__camp_game.campfireGuitarGame.getHudState().score===100')
    await page.wait_for_function('()=>document.querySelector("#guitar-score-val").textContent==="100"')
    await page.screenshot(path=str(OUT/f'{name}-guitar.png'))
    await page.locator('#guitar-exit-btn').tap()
    guitar = await page.evaluate('''()=>{
      const g=window.__camp_game.campfireGuitarGame;g.update=g.__qaUpdate;delete g.__qaUpdate;
      return {phase:g.getPhase(),voices:g.synth.backingVoices.size};
    }''')
    assert guitar=={'phase':'idle','voices':0}, guitar
    assert await page.locator('#mobile-jump').inner_text()=='SKOK'
    await page.evaluate('window.__camp_game.world.flankiGame.startMatch()')
    await page.wait_for_function('()=>document.querySelector("#mobile-jump").textContent==="RZUT"')
    await page.evaluate('window.__camp_game.world.flankiGame.stopMatch()')
    await page.wait_for_function('()=>document.querySelector("#mobile-jump").textContent==="SKOK"')
    await page.locator('#mobile-menu').tap()
    await page.locator('#setting-fog-distance').wait_for(state='visible')
    async def change(value):
        await page.locator('#setting-fog-distance').evaluate('(e,v)=>{e.value=String(v);e.dispatchEvent(new Event("input",{bubbles:true}));}', value)
        return await page.evaluate('''()=>{const g=window.__camp_game;return {far:g.camera.far,near:g.scene.fog.near,graphics:g.graphics.characters,ranges:g.sectorStreamer.ranges,saved:localStorage.getItem('festival-fog-distance')};}''')
    values = []
    for value in [30,8,10]:
        result = await change(value)
        assert result['far']==value and result['near']==value*0.6 and result['graphics']==value and result['saved']==str(value), result
        assert result['ranges']['far']==value, result
        values.append(result)
    await page.screenshot(path=str(OUT/f'{name}-menu.png'))
    fps = await page.locator('#mobile-performance-readout').inner_text()
    assert 'FPS' in fps and 'ms/klatkę' in fps, fps
    await page.reload()
    await enter()
    restored = await page.evaluate('window.__camp_game.camera.far')
    assert restored==10, restored
    assert not errors, errors
    report = {'engine':name,'viewport':viewport,'guitar':guitar,'guitarBounds':guitar_bounds,'settings':values,'restoredFar':restored,'fpsReadout':fps,'jumpLabels':['SKOK','RZUT','SKOK'],'pageErrors':errors,'caveat':'Not a physical iPhone performance measurement'}
    (OUT/f'{name}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    await browser.close()

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        await run(p.chromium,'chromium',p.devices['iPhone 13'])
        await run(p.webkit,'webkit',p.devices['iPhone 13'])

asyncio.run(main())
