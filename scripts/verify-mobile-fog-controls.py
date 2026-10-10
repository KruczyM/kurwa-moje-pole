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
    report = {'engine':name,'settings':values,'restoredFar':restored,'fpsReadout':fps,'jumpLabels':['SKOK','RZUT','SKOK'],'pageErrors':errors,'caveat':'Not a physical iPhone performance measurement'}
    (OUT/f'{name}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    await browser.close()

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        await run(p.chromium,'chromium',p.devices['iPhone 13'])
        await run(p.webkit,'webkit',p.devices['iPhone 13'])

asyncio.run(main())
