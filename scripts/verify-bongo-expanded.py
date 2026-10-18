"""Expanded cave UI/atlas/camera smoke tests plus real-input desktop and WebKit level completions."""
import asyncio
import json
import runpy
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-expanded'
CHECKS = runpy.run_path(str(ROOT / 'scripts/verify-bongo-rush.py'))


async def gallery(engine):
    """Use an explicitly unlocked save fixture to inspect each biome, without teleporting any player."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(viewport={'width': 1440, 'height': 960})
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.add_init_script('localStorage.setItem("after-bongo-rush:v1",JSON.stringify({version:1,unlocked:12,hero:"amper",muted:true,completed:false}))')
    levels = []
    try:
        await page.goto(CHECKS['URL'])
        await CHECKS['ready'](page)
        for number in range(1, 13):
            await page.locator(f'#levels button[data-level="{number - 1}"]').click()
            await CHECKS['ready'](page)
            await page.locator('#begin').click()
            await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
            state = await CHECKS['snapshot'](page)
            world = state['world']
            assert world['width'] >= 46 and world['height'] >= 34
            assert await page.locator('#map').get_attribute('aria-pressed') == 'true'
            await page.locator('#map').click()
            assert await page.locator('#map').get_attribute('aria-pressed') == 'false'
            assert await page.evaluate('()=>document.activeElement.id') == 'cave'
            await page.keyboard.press('m')
            assert await page.locator('#map').get_attribute('aria-pressed') == 'true'
            if number in [1, 4, 7, 10, 12]:
                await page.screenshot(path=str(OUT / f'cave-{number}-desktop.png'))
            levels.append({'level': number, 'width': world['width'], 'height': world['height'],
                           'objects': len(world['objects']), 'player_y': world['player']['y']})
            await page.keyboard.press('Escape')
            await page.locator('#to-menu').click()
        assert not errors, errors
        return {'status': 'PASS', 'kind': 'all_caves_gallery', 'save_fixture_unlocked': True,
                'levels': levels, 'map_button_and_key': True, 'javascript_errors': errors}
    finally:
        await context.close()
        await browser.close()


async def main():
    """Run independent contexts concurrently; game scheduling and simulation are not accelerated or replaced."""
    OUT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'reports/bongo-rush').mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = await asyncio.gather(
            gallery(p.chromium),
            CHECKS['run'](p.chromium, 'chromium-desktop', {'viewport': {'width': 1440, 'height': 960}}, False),
            CHECKS['run'](p.webkit, 'webkit-iphone13', p.devices['iPhone 13']),
        )
    (OUT / 'browser-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
