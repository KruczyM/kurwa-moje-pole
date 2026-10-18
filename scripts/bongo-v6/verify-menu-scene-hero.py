"""Verify painted menu scenes, confirmation, saved choice and delayed image responses."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/menu-selected-character'
HEROES = ['amper','antena','gruczol','krwiak','pierscien','pien','ambona','chlebak','dziaslo','hemoroid','jeczmien','klatwa','korba','szerszen','zawor']
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5194/bongo-rush.html?theme=storybook&verify'

async def choose(page, hero):
    await page.locator('#play').click()
    button = page.locator(f'[data-hero="{hero}"]')
    await page.wait_for_function('(hero) => !document.querySelector(`[data-hero="${hero}"]`).disabled', arg=hero)
    await button.click()
    await page.wait_for_function('!document.querySelector("#hero-confirm").disabled')
    await page.locator('#hero-confirm').click()
    await page.locator('#menu:visible').wait_for()
    assert not await page.locator('#level-panel').is_visible(), 'Confirmation opened maps instead of title'
    assert await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1")).hero') == hero

async def scene(page, hero):
    await page.wait_for_selector(f'#menu[data-artistic="true"][data-scene-hero="{hero}"]')
    background = await page.locator('#menu').evaluate('(node) => node.style.getPropertyValue("--menu-scene")')
    assert ('scene.webp' if hero == 'amper' else f'scenes/{hero}.webp') in background

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report=[]
    async with async_playwright() as p:
        for engine in ['chromium','webkit']:
            browser=await getattr(p,engine).launch()
            context=await browser.new_context(viewport={'width':1672,'height':941},reduced_motion='reduce')
            page=await context.new_page()
            errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
            await page.goto(URL)
            await scene(page,'amper')
            await page.wait_for_function('!document.querySelector("#continue").disabled')
            for hero in HEROES:
                await choose(page,hero)
                await scene(page,hero)
                await page.screenshot(path=str(OUT/f'{engine}-{hero}-desktop.png'))
            for width,height in [(390,844),(844,390),(320,568)]:
                await page.set_viewport_size({'width':width,'height':height})
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                await page.screenshot(path=str(OUT/f'{engine}-mobile-{width}.png'))
            await page.reload(); await scene(page,'zawor')
            await page.wait_for_function('!document.querySelector("#continue").disabled')
            await page.locator('#choose-level').click()
            await page.locator('#level-panel:visible').wait_for()
            await page.locator('#level-title-back').click(); await scene(page,'zawor')
            await page.locator('#continue').click()
            await page.locator('#pause:enabled').wait_for()
            await page.locator('#pause').click(); await page.locator('#to-menu').click()
            await page.locator('#level-title-back').click(); await scene(page,'zawor')
            # Revisit a previously released scene before testing a delayed response.
            await choose(page,'antena')
            await scene(page,'antena')
            # A late response for an earlier selection cannot replace the current scene.
            delayed=asyncio.Event()
            async def late(route):
                await delayed.wait(); await route.continue_()
            await page.route('**/menu-v1/scenes/ambona.webp',late)
            await choose(page,'ambona')
            await choose(page,'chlebak'); await scene(page,'chlebak')
            delayed.set(); await page.wait_for_timeout(500)
            await scene(page,'chlebak')
            assert not errors,errors
            report.append({'engine':engine,'paintedScenes':len(HEROES),'confirmationToTitle':'PASS','savedChoice':'PASS','continueAndMaps':'PASS','lateSelection':'PASS','viewports':4,'pageErrors':errors})
            await context.close(); await browser.close()
    (OUT/'report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report))
asyncio.run(main())
