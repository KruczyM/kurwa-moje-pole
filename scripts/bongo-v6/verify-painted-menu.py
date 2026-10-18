"""Browser acceptance for the painted title menu using real saved progress and controls."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/bongo-painted-menu'
OUT.mkdir(parents=True, exist_ok=True)

async def ready(page):
    await page.wait_for_function('window.__bongoSnapshot && !window.__bongoSnapshot().loading')

async def title(page):
    await page.locator('#pause').click()
    await page.locator('#to-menu').click()
    await ready(page)
    assert await page.evaluate('window.__bongoSnapshot().menuScreen') == 'levels'
    await page.locator('#level-title-back').click()

async def context_for(browser, style='storybook', **options):
    context = await browser.new_context(reduced_motion='reduce', **options)
    await context.add_init_script("if (!localStorage.getItem('after-bongo-rush:v1')) localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:10,lastLevel:6,hero:'amper',muted:false,visualTheme:'"+style+"',collectibleStyle:'festival'}))")
    return context

async def main(url):
    report=[]
    async with async_playwright() as p:
        for engine in ['chromium', 'webkit']:
            browser=await getattr(p,engine).launch()
            for style in ['standard','storybook']:
                context=await context_for(browser,style,viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
                page=await context.new_page()
                errors=[]; requests=[]
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('request', lambda request: requests.append(request.url))
                await page.goto(url,wait_until='networkidle'); await ready(page)
                if style=='storybook':
                    await page.wait_for_selector('#menu[data-artistic="true"]')
                else:
                    assert not any('/menu-v1/' in item for item in requests), requests
                assert 'Poziom 6' in await page.locator('#continue-level').inner_text()
                assert await page.locator('.biome-card small').all_text_contents()==['Dostępne 5/6','Dostępne 5/6','Dostępne 0/6','Dostępne 0/6']
                assert await page.locator('.biome-card[data-biome="2"]').is_disabled()
                for width,height in [(320,568),(390,844),(844,390),(1280,800),(1672,941),(1912,900)]:
                    await page.set_viewport_size({'width':width,'height':height})
                    await page.wait_for_timeout(120)
                    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (engine,style,width)
                    for selector in ['#continue','#choose-level','#appearance-open','#play','.biome-card[data-biome="0"]']:
                        target=page.locator(selector)
                        await target.scroll_into_view_if_needed()
                        box=await target.bounding_box()
                        assert box and box['width']>=40 and box['height']>=40,(selector,box)
                    await page.locator('#continue').scroll_into_view_if_needed()
                    if width in [390,844,1672]:
                        await page.screenshot(path=str(OUT/f'{engine}-{style}-{width}x{height}.png'))
                await page.set_viewport_size({'width':390,'height':844})
                await page.locator('#continue').click()
                await page.wait_for_function('window.__bongoSnapshot().mode==="playing"')
                assert await page.evaluate('window.__bongoSnapshot().level')==6
                await title(page)
                await page.locator('.biome-card[data-biome="1"]').click(); await ready(page)
                assert await page.locator('#levels button').count()==6
                assert await page.locator('#levels button:disabled').count()==1
                await page.locator('#levels button[data-level="7"]').click();await ready(page)
                await page.locator('#begin').click()
                await page.wait_for_function('window.__bongoSnapshot().mode==="playing"')
                assert await page.evaluate('window.__bongoSnapshot().level')==8
                await title(page)
                assert 'Poziom 8' in await page.locator('#continue-level').inner_text()
                await page.locator('#choose-level').click();await ready(page)
                assert await page.locator('#levels button').count()==24
                await page.locator('#level-title-back').click()
                await page.reload(wait_until='networkidle');await ready(page)
                assert 'Poziom 8' in await page.locator('#continue-level').inner_text()
                assert not errors,errors
                report.append({'engine':engine,'style':style,'viewports':6,'navigation':'PASS','resume':8,'pageErrors':errors})
                await context.close()
            # All three menu rasters must settle before the artistic interface becomes visible.
            context=await context_for(browser,viewport={'width':390,'height':844})
            page=await context.new_page(); menu_requests=[]
            async def fail(route):
                menu_requests.append(route.request.url)
                await route.abort()
            await page.route('**/menu-v1/**',fail)
            await page.goto(url,wait_until='networkidle');await ready(page)
            await page.wait_for_selector('#menu-art-retry:visible')
            assert await page.locator('#menu').get_attribute('data-artistic')=='false'
            count=len(menu_requests);await page.wait_for_timeout(600)
            assert len(menu_requests)==count,(count,menu_requests)
            assert await page.evaluate("JSON.parse(localStorage.getItem('after-bongo-rush:v1')).visualTheme")=='storybook'
            await page.unroute('**/menu-v1/**',fail)
            await page.locator('#menu-art-retry').click()
            await page.wait_for_selector('#menu[data-artistic="true"]')
            assert not await page.locator('#menu-art-retry').is_visible()
            report.append({'engine':engine,'rasterFailureFallback':'PASS','explicitRetry':'PASS'})
            await context.close()
            # Late artwork must respect a newer Standard selection and host disposal.
            context=await context_for(browser,viewport={'width':390,'height':844})
            page=await context.new_page(); release=asyncio.Event(); delayed=[]
            async def delay(route):
                delayed.append(route.request.url)
                await release.wait()
                await route.continue_()
            await page.route('**/menu-v1/**',delay)
            await page.goto(url,wait_until='domcontentloaded');await ready(page)
            await page.wait_for_function("document.querySelector('#menu-art-status').textContent.length>0")
            await page.locator('#appearance-open').click()
            await page.locator('input[name="visual-theme"][value="standard"]').check()
            await page.locator('#appearance-apply').click();await ready(page)
            await page.locator('#appearance-close').click()
            release.set();await page.wait_for_load_state('networkidle')
            assert len(delayed)==3,delayed
            assert await page.locator('#menu').get_attribute('data-artistic')=='false'
            assert await page.evaluate("JSON.parse(localStorage.getItem('after-bongo-rush:v1')).visualTheme")=='standard'
            await page.locator('#appearance-open').click()
            await page.locator('input[name="visual-theme"][value="storybook"]').check()
            await page.locator('#appearance-apply').click();await ready(page)
            await page.locator('#appearance-close').click()
            await page.wait_for_selector('#menu[data-artistic="true"]')
            await page.locator('#title-help').click()
            music=await page.evaluate('window.__bongoSnapshot().audio')
            if music.get('contextState'):
                await page.wait_for_function('window.__bongoSnapshot().audio.playing')
                music=await page.evaluate('window.__bongoSnapshot().audio')
                assert 'menu-jazz' in music['track'],music
            else:
                assert engine=='webkit',music
                music['state']='Web Audio unavailable in this WebKit runtime'
            report.append({'engine':engine,'lateArtStyleChange':'PASS','menuJazz':music['state'],'musicPlaying':music['playing']})
            await context.close();await browser.close()
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5188/bongo-rush.html?verify'))


