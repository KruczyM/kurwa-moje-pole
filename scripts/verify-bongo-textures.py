"""Verify generated terrain is actually baked and displayed on desktop and iPhone WebKit."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-textures'
URL = 'http://127.0.0.1:5205/bongo-rush.html?verify=1'


async def run(engine, name, profile):
    """Exercise all four biomes using normal menu controls and record source-image baking."""
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url) if '/tiles-ai/' in request.url else None)
    await page.add_init_script('''
      localStorage.setItem('after-bongo-rush:v1', JSON.stringify({
        version:1, unlocked:16, hero:'amper', muted:true, completed:true
      }));
      window.__terrainBakes=[];
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
        if(image.src?.includes('/tiles-ai/')) window.__terrainBakes.push(image.src);
        return draw.call(this,image,...args);
      };
    ''')
    try:
        await page.goto(URL)
        await page.wait_for_function('()=>window.__bongoSnapshot && !window.__bongoSnapshot().loading')
        for level in [1, 4, 7, 10, 1]:
            await page.locator(f'[data-level="{level - 1}"]').click()
            await page.wait_for_function('()=>!window.__bongoSnapshot().loading')
            await page.locator('#begin').click()
            await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
            await page.wait_for_timeout(150)
            await page.screenshot(path=str(OUT / f'{name}-level-{level}.png'))
            await page.locator('#pause').click()
            before = await page.evaluate('window.__bongoSnapshot()')
            bake_count = await page.evaluate('window.__terrainBakes.length')
            await page.wait_for_function('frames=>window.__bongoSnapshot().frames>frames+3', arg=before['frames'], timeout=5000)
            after = await page.evaluate('window.__bongoSnapshot()')
            assert before['world']['tick'] == after['world']['tick']
            assert after['frames'] > before['frames'] + 3
            assert await page.evaluate('window.__terrainBakes.length') == bake_count
            await page.locator('#resume').click()
            assert await page.evaluate('document.activeElement.id') == 'cave'
            await page.locator('#pause').click()
            await page.locator('#to-menu').click()
        assert len(requests) == len(set(requests)) == 4, requests
        sources = await page.evaluate('[...new Set(window.__terrainBakes)]')
        assert len(sources) == 4, sources
        assert not errors and not failures, (errors, failures)
        return {'browser': name, 'status': 'PASS', 'terrain_requests': requests,
                'actual_canvas_sources': sources, 'javascript_errors': errors,
                'http_errors': failures, 'pause_raf_and_focus': 'PASS',
                'physical_iphone': 'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    """Write local evidence; browser emulation does not claim physical-phone verification."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        results = []
        results.append(await run(playwright.chromium, 'desktop', {'viewport': {'width': 1440, 'height': 960}}))
        results.append(await run(playwright.webkit, 'iphone-webkit', playwright.devices['iPhone 13']))
    (OUT / 'report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
