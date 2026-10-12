"""Smoke-test compiled Pages paths and actual input, without relying on any app debug API."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-rush'


async def run(engine, name, profile, url):
    """Check the production bundle, frozen pause view, live RAF, restored input and mobile layout."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url))
    await page.add_init_script('''
      window.__testRafFrames=0;
      const schedule=window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback=>schedule(time=>{
        window.__testRafFrames++;callback(time);
      });
    ''')
    try:
        response = await page.goto(url + '?verify=1')
        assert response.status == 200
        await page.wait_for_function('()=>document.querySelector("#begin")?.disabled===false')
        assert await page.evaluate('()=>typeof window.__bongoSnapshot') == 'undefined'
        entry = await page.locator('script[type="module"]').get_attribute('src')
        assert '/assets/bongo-' in entry and '/src/' not in entry, entry
        await page.locator('#hero').select_option('antena')
        await page.wait_for_function('()=>document.querySelector("#begin")?.disabled===false')
        await page.locator('#begin').click()
        await page.wait_for_function('()=>document.querySelector("#menu").hidden')
        await page.wait_for_timeout(200)
        before = await page.locator('#cave').screenshot()
        await page.keyboard.down('ArrowRight')
        await page.wait_for_timeout(320)
        await page.keyboard.up('ArrowRight')
        assert await page.locator('#cave').screenshot() != before
        await page.locator('#pause').click()
        assert await page.locator('#pause-panel').is_visible()
        raf = await page.evaluate('()=>window.__testRafFrames')
        paused = await page.screenshot()
        await page.wait_for_timeout(250)
        assert await page.screenshot() == paused, 'Pause view drifted'
        assert await page.evaluate('()=>window.__testRafFrames') > raf + 3
        await page.locator('#resume').click()
        assert not await page.locator('#pause-panel').is_visible()
        assert await page.evaluate('()=>document.activeElement.id') == 'cave'
        before = await page.locator('#cave').screenshot()
        await page.keyboard.down('ArrowRight')
        await page.wait_for_timeout(320)
        await page.keyboard.up('ArrowRight')
        assert await page.locator('#cave').screenshot() != before
        if profile.get('is_mobile'):
            assert await page.locator('#joystick').is_visible()
            box = await page.locator('#joystick').bounding_box()
            x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.mouse.move(x + 33, y)
            await page.wait_for_timeout(300)
            await page.mouse.up()
            await page.locator('#touch-restart').click()
        else:
            await page.keyboard.press('r')
        await page.screenshot(path=str(OUT / f'{name}-production-gameplay.png'))
        await page.locator('#pause').click()
        await page.locator('#to-menu').click()
        assert await page.locator('#menu').is_visible()
        assert not await page.locator('#pause-panel').is_visible()
        await page.locator('#begin').click()
        await page.wait_for_function('()=>document.querySelector("#menu").hidden')
        if profile.get('is_mobile'):
            await page.set_viewport_size({'width': 844, 'height': 390})
            await page.wait_for_timeout(250)
            assert await page.evaluate('''()=>{
              const c=document.querySelector('#cave'), r=c.getBoundingClientRect();
              return Math.abs(c.width/c.height-r.width/r.height)<0.02;
            }'''), 'Canvas backing store did not follow landscape resize'
            assert await page.locator('#joystick').is_visible()
            assert await page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
            await page.screenshot(path=str(OUT / f'{name}-production-landscape.png'))
        assert not errors, errors
        assert not failures, failures
        assert not any('.glb' in request or 'socket.io' in request for request in requests)
        return {'browser': name, 'status': 'PASS', 'production_entry': entry, 'javascript_errors': errors,
                'http_errors': failures, 'pause_raf_continues': True, 'pause_image_stable': True,
                'debug_api_absent': True, 'physical_iphone': 'PENDING_HUMAN'}
    finally:
        await context.close()
        await browser.close()


async def main():
    """Run desktop and WebKit/iPhone checks against a built local preview or explicit deployed URL."""
    OUT.mkdir(parents=True, exist_ok=True)
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5191/kurwa-moje-pole/bongo-rush.html'
    async with async_playwright() as p:
        results = [
            await run(p.chromium, 'chromium-desktop', {'viewport': {'width': 1440, 'height': 960}}, url),
            await run(p.webkit, 'webkit-iphone13', p.devices['iPhone 13'], url),
        ]
    (OUT / 'production-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
