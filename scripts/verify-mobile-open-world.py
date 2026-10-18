"""Mobile browser regression; emulation does not establish physical phone FPS/RAM limits."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/mobile-open-world'
URL = 'http://127.0.0.1:5186/?server=http://127.0.0.1:3106'


async def run(engine, name, device):
    """Verify default mobile policy, camp approach/eviction, sky and reachable pause controls."""
    args = {'headless': True}
    if name == 'chromium':
        args['args'] = ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist']
    browser = await engine.launch(**args)
    context = await browser.new_context(**device)
    page = await context.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    try:
        await page.goto(URL)
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#player-nickname').fill('open'+name)
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=300000)
        await page.wait_for_timeout(3000)

        async def snapshot():
            """Read current stream ownership and classify loaded sectors using the production policy."""
            return await page.evaluate('''async()=>{
              const g=window.__camp_game;
              const {isDeferredCampSector,mobileWorldRanges}=await import('/src/game/world/mobileWorldStreaming.ts');
              const {sectorDistance}=await import('/src/game/world/FogSectorStreamer.ts');
              const s=g.sectorStreamer;
              return {state:g.state.current, fog:g.scene.fog===null, far:g.camera.far,
                sky:g.scene.background?.isCubeTexture===true,
                deferredLoaded:s.manifest.sectors.filter(x=>isDeferredCampSector(x)&&s.loaded.has(x.id)).length,
                residentLoaded:s.manifest.sectors.filter(x=>!isDeferredCampSector(x)&&s.loaded.has(x.id)).length,
                residentTotal:s.manifest.sectors.filter(x=>!isDeferredCampSector(x)).length,
                distantLoaded:s.manifest.sectors.filter(x=>s.loaded.has(x.id)&&sectorDistance(x,g.camera.position)>mobileWorldRanges(x).retain).length,
                sectors:s.stats,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
            }''')

        start = await snapshot()
        assert start['fog'] and start['far'] == 500 and start['sky'], start
        assert start['deferredLoaded'] == 0 and 0 < start['residentLoaded'] < start['residentTotal'], start
        assert start['distantLoaded'] == 0, start
        assert start['sectors']['failed'] == 0, start
        await page.screenshot(path=str(OUT / f'{name}-camp.png'))
        await page.evaluate('()=>{window.__camp_game.camera.position.set(0,1.9,-130)}')
        await page.wait_for_function('''async()=>{
          const {isDeferredCampSector}=await import('/src/game/world/mobileWorldStreaming.ts');
          const s=window.__camp_game.sectorStreamer;
          return s.manifest.sectors.some(x=>isDeferredCampSector(x)&&s.loaded.has(x.id));
        }''', timeout=120000)
        await page.wait_for_timeout(3000)
        approach = await snapshot()
        assert approach['deferredLoaded'] > 0, approach
        assert approach['distantLoaded'] == 0, approach
        await page.screenshot(path=str(OUT / f'{name}-north.png'))
        await page.evaluate('()=>{window.__camp_game.camera.position.set(0,1.9,0)}')
        await page.wait_for_timeout(3000)
        returned = await snapshot()
        assert returned['deferredLoaded'] == 0, returned
        assert returned['distantLoaded'] == 0, returned
        await page.locator('#mobile-menu').tap()
        await page.wait_for_function('()=>window.__camp_game.state.current==="paused"')
        assert not await page.locator('#setting-fog-control').is_visible()
        await page.screenshot(path=str(OUT / f'{name}-pause.png'))
        assert not any('/npcs/festival/' in url or '/authored-festival.glb' in url for url in requests)
        assert not errors, errors
        report = {'engine': name, 'start': start, 'approach': approach, 'returned': returned,
                  'pageErrors': errors, 'caveat': 'Desktop emulation, not physical phone FPS/RAM/thermal verification.'}
        (OUT / f'{name}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2))
    finally:
        await browser.close()


async def main():
    """Run the selected local browser engines without installing or downloading anything."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        for name in ['chromium', 'webkit']:
            if len(sys.argv) == 1 or sys.argv[1] == name:
                await run(getattr(p, name), name, p.devices['iPhone 13'])


if __name__ == '__main__':
    asyncio.run(main())
