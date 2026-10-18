"""Smoke-test the actual production build without exposing or depending on debug state."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/bongo-ui-release'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5254/kurwa-moje-pole/bongo-rush.html'


async def ready(page):
    await page.wait_for_function('!document.querySelector("#begin").disabled')


async def run(engine, name, profile):
    browser = await engine.launch()
    page = await browser.new_page(**profile)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    await page.add_init_script("if(!localStorage.getItem('after-bongo-rush:v1'))localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:24,lastLevel:1,hero:'antena',muted:true,visualTheme:'storybook',collectibleStyle:'festival',musicPack:'pack-1'}))")
    try:
        await page.goto(URL + '?verify')
        await page.wait_for_selector('#menu[data-artistic="true"]')
        assert await page.evaluate('typeof window.__bongoSnapshot') == 'undefined'
        assert 'AFTER' not in await page.locator('.brand').inner_text()
        hero = await page.locator('#menu-hero-name').inner_text()
        await page.locator('#appearance-open').click()
        await page.locator('[name="music-pack"][value="pack-2"]').check()
        await page.locator('#appearance-close').click()
        assert (await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1"))'))['musicPack'] == 'pack-1'
        await page.locator('#appearance-open').click()
        await page.locator('[name="music-pack"][value="pack-2"]').check()
        await page.locator('[name="collectible-style"][value="fantasy"]').check()
        await page.locator('#touch-position').select_option('left')
        await page.locator('#touch-size').select_option('large')
        await page.locator('#touch-opacity').fill('70')
        await page.locator('#appearance-apply').click()
        await page.locator('#appearance-close').click()
        await page.reload()
        await page.wait_for_selector('#menu[data-artistic="true"]')
        saved = await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1"))')
        assert saved['musicPack'] == 'pack-2' and saved['collectibleStyle'] == 'fantasy'
        assert saved['touchControls'] == {'position': 'left', 'size': 'large', 'opacity': 70}
        assert saved['hero'] == 'antena' and saved['unlocked'] == 24
        assert await page.locator('#bongo-app').get_attribute('data-touch-position') == 'left'
        records = []
        for level in [1, 12, 18, 24]:
            await page.locator('#choose-level').click()
            await ready(page)
            assert await page.locator('#levels [data-level]').count() == 24
            assert not await page.locator('#hero-panel').is_visible()
            assert not await page.locator('#bongo-app > footer').is_visible()
            await page.locator(f'[data-level="{level-1}"]').click()
            await ready(page)
            await page.locator('#begin').click()
            await page.wait_for_function('!document.querySelector("#touch-controls").hidden')
            await page.wait_for_timeout(80)
            if profile.get('is_mobile'):
                for button in await page.locator('#joystick button[data-direction]').all():
                    rect = await button.bounding_box()
                    assert rect['width'] >= 48 and rect['height'] >= 48, rect
                await page.locator('[data-direction="right"]').tap()
                await page.wait_for_timeout(40)
                assert await page.locator('[data-direction="right"]').get_attribute('aria-pressed') == 'false'
            await page.locator('#pause').click()
            assert not await page.locator('#bongo-app > footer').is_visible()
            paused = await page.locator('#cave').screenshot()
            await page.wait_for_timeout(160)
            assert paused == await page.locator('#cave').screenshot()
            await page.locator('#resume').click()
            await page.locator('#pause').click()
            if level in [1, 18]:
                await page.locator('#pause-title-back').click()
            else:
                await page.locator('#to-menu').click()
                await page.wait_for_selector('#level-panel:visible')
                await page.locator('#level-title-back').click()
            await page.wait_for_selector('#menu:visible')
            assert await page.locator('#menu').is_visible()
            assert not await page.locator('#hero-panel').is_visible()
            assert await page.locator('#menu-hero-name').inner_text() == hero
            records.append({'level': level, 'startPauseResumeTitle': 'PASS'})
        await page.screenshot(path=str(OUT / f'{name}-title.png'))
        assert not errors, errors
        print(f'{name}: production UI PASS', flush=True)
        return {'profile': name, 'records': records, 'settings': 'PASS', 'hero': hero, 'errors': errors, 'physicalPhone': 'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        profiles = [await run(p.chromium, 'desktop', {'viewport': {'width': 1440, 'height': 900}}),
                    await run(p.webkit, 'iphone-portrait', p.devices['iPhone 13']),
                    await run(p.webkit, 'iphone-landscape', {**p.devices['iPhone 13'], 'viewport': {'width': 844, 'height': 390}}),
                    await run(p.chromium, 'small-phone', {**p.devices['iPhone 13'], 'viewport': {'width': 320, 'height': 480}})]
    (OUT / 'browser.json').write_text(json.dumps({'url': URL, 'profiles': profiles}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
