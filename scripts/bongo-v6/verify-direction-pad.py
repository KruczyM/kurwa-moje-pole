"""Real-pointer acceptance for four-way touch controls and single-surface title layout."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/bongo-direction-pad'
URL = 'http://127.0.0.1:5241/bongo-rush.html?verify'


async def ready(page):
    await page.wait_for_function('window.__bongoSnapshot && !window.__bongoSnapshot().loading')


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    async with async_playwright() as p:
        for engine in ['chromium', 'webkit']:
            browser = await getattr(p, engine).launch()
            context = await browser.new_context(viewport={'width':1280,'height':800}, has_touch=True, reduced_motion='reduce')
            await context.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:10,lastLevel:1,hero:'amper',muted:true,visualTheme:'storybook',collectibleStyle:'festival'}))")
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.goto(URL); await ready(page)
            await page.wait_for_selector('#menu[data-artistic="true"]')
            for width, height in [(1280,800),(1672,941),(1024,768),(844,390),(667,375),(390,844),(320,568)]:
                await page.set_viewport_size({'width':width,'height':height})
                column = await page.locator('.title-content').evaluate('(e)=>({client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY})')
                assert column['overflow'] == 'visible', (width, height, column)
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, height)
                for selector in ['#continue','#choose-level','#appearance-open','#play','#title-help']:
                    await page.locator(selector).scroll_into_view_if_needed()
                    box = await page.locator(selector).bounding_box()
                    assert box and box['height'] >= 44, (selector, box)
                    assert box['x'] >= 0 and box['x']+box['width'] <= width+1, (selector, box)
                await page.screenshot(path=str(OUT/f'{engine}-title-{width}.png'))
            await page.set_viewport_size({'width':390,'height':844})
            await page.locator('#continue').click(); await ready(page)
            await page.wait_for_function('window.__bongoSnapshot().mode === "playing"')
            # Touch-capable context exposes controls without CSS test overrides.
            await page.locator('#joystick').wait_for(state='visible')
            arrow = page.locator('#joystick [data-direction="right"]')
            box = await arrow.bounding_box()
            assert box['width'] >= 48 and box['height'] >= 48, box
            # Deliberately touch near the upper edge, not the arrow centre.
            await page.mouse.move(box['x']+6, box['y']+6)
            await page.mouse.down()
            assert await page.evaluate('window.__bongoSnapshot().input') == 'right'
            assert await arrow.get_attribute('aria-pressed') == 'true'
            pad = await page.locator('#joystick').bounding_box()
            cx, cy = pad['x']+pad['width']/2, pad['y']+pad['height']/2
            await page.mouse.move(cx+70, cy-67)
            assert await page.evaluate('window.__bongoSnapshot().input') == 'right'
            await page.mouse.move(cx+5, cy-70)
            assert await page.evaluate('window.__bongoSnapshot().input') == 'up'
            await page.mouse.move(cx, cy)
            assert await page.evaluate('window.__bongoSnapshot().input || null') is None
            await page.mouse.up()
            assert await page.locator('#joystick button[aria-pressed="true"]').count() == 0
            # Physical mouse capture and release exercise the same pointer path as touch.
            box = await arrow.bounding_box()
            await page.mouse.move(box['x']+20,box['y']+20); await page.mouse.down()
            await page.mouse.move(389,cy)
            assert await page.evaluate('window.__bongoSnapshot().input') == 'right'
            await page.mouse.up()
            assert await page.evaluate('window.__bongoSnapshot().input || null') is None
            await page.screenshot(path=str(OUT/f'{engine}-pad-portrait.png'))
            await page.set_viewport_size({'width':844,'height':390})
            await page.screenshot(path=str(OUT/f'{engine}-pad-landscape.png'))
            await page.locator('#pause').click()
            assert await page.evaluate('window.__bongoSnapshot().input || null') is None
            assert not errors, errors
            report.append({'engine':engine,'titleViewports':7,'noNestedScroll':'PASS','offCentreArrow':'PASS','stableCorners':'PASS','slideTurn':'PASS','neutralCentre':'PASS','outsideCaptureRelease':'PASS','pauseCleanup':'PASS','errors':errors})
            await context.close(); await browser.close()
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


asyncio.run(main())
