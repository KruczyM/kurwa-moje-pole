"""Exercise cosmetic choices and menu exits using real browser controls."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/bongo-ui-consistency'


async def ready(page):
    await page.wait_for_function('window.__bongoSnapshot && !window.__bongoSnapshot().loading')


async def main(url):
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    async with async_playwright() as p:
        for engine in ['chromium', 'webkit']:
            browser = await getattr(p, engine).launch()
            context = await browser.new_context(viewport={'width':1280, 'height':800}, reduced_motion='reduce')
            await context.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:10,lastLevel:6,hero:'amper',muted:true,visualTheme:'storybook',collectibleStyle:'fantasy'}))")
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.goto(url); await ready(page)
            await page.wait_for_selector('#menu[data-artistic="true"]')
            assert await page.title() == 'Bongo Rush — Walka o tasiorowe bongo'
            assert await page.locator('a[href="./after-demo.html"]').count() == 0
            assert 'AFTER' not in await page.locator('.brand').inner_text()
            for width, height in [(1280,800), (390,844), (320,568), (844,390)]:
                await page.set_viewport_size({'width':width, 'height':height})
                await page.locator('#choose-level').click(); await ready(page)
                assert await page.evaluate('window.__bongoSnapshot().menuScreen') == 'levels'
                assert 'Amper' in await page.locator('#chosen-hero').inner_text()
                assert await page.locator('#levels button').count() == 24
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                await page.screenshot(path=str(OUT / f'{engine}-{width}-levels.png'))
                await page.locator('#begin').click(); await ready(page)
                await page.wait_for_function('window.__bongoSnapshot().mode === "playing"')
                await page.screenshot(path=str(OUT / f'{engine}-{width}-game.png'))
                await page.locator('#pause').click()
                ticks = await page.evaluate('window.__bongoSnapshot().steps')
                await page.locator('#pause-title-back').scroll_into_view_if_needed()
                await page.screenshot(path=str(OUT / f'{engine}-{width}-pause.png'))
                assert await page.evaluate('window.__bongoSnapshot().steps') == ticks
                await page.locator('#pause-title-back').click()
                await page.wait_for_selector('#menu:visible')
                assert await page.evaluate('window.__bongoSnapshot().menuScreen') == 'title'
            await page.set_viewport_size({'width':1280, 'height':800})
            await page.locator('#appearance-open').click()
            labels = page.locator('.collectible-choices label:visible')
            assert [t.strip() for t in await labels.all_text_contents()] == ['Zestaw 1','Zestaw 2']
            assert await page.locator('input[value="fantasy"]').is_checked()
            await page.locator('input[name="visual-theme"][value="standard"]').check()
            assert [t.strip() for t in await labels.all_text_contents()] == ['Standardowe']
            assert await page.locator('input[value="fantasy"]').is_disabled()
            assert await page.locator('input[value="festival"]').is_checked()
            await page.locator('#appearance-apply').click(); await ready(page)
            assert await page.evaluate('window.__bongoSnapshot().presentation') == {'visualTheme':'standard','collectibleStyle':'festival'}
            await page.locator('#appearance-close').click()
            await page.locator('#appearance-open').click()
            await page.locator('input[name="visual-theme"][value="storybook"]').check()
            assert await labels.count() == 2
            await page.locator('input[value="fantasy"]').check()
            await page.locator('#appearance-apply').click(); await ready(page)
            assert await page.evaluate('window.__bongoSnapshot().presentation') == {'visualTheme':'storybook','collectibleStyle':'fantasy'}
            await page.screenshot(path=str(OUT / f'{engine}-appearance.png'))
            await page.locator('#appearance-close').click()
            assert await page.evaluate('window.__bongoSnapshot().rafActive')
            assert not errors, errors
            report.append({'engine':engine, 'viewports':4, 'pauseToTitle':'PASS', 'heroPreserved':'PASS', 'conditionalItems':'PASS', 'savedChoices':'PASS', 'pageErrors':errors})
            await context.close(); await browser.close()
    (OUT/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5241/bongo-rush.html?verify'))
