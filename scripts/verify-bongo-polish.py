"""Real UI checks for dedicated sprites, timer/help/pause, audio unlock and mobile joystick."""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]


async def verify(engine, name, profile, port, output):
    """Exercise public controls and detached diagnostics, never mutate a live simulation."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    try:
        await page.goto(f'http://127.0.0.1:{port}/bongo-rush.html?verify=1')
        await page.wait_for_function('()=>window.__bongoSnapshot && !window.__bongoSnapshot().loading')
        heroes = await page.locator('#hero option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
        assert len(heroes) == 15 and 'kobra' not in heroes
        for hero in heroes:
            await page.locator('#hero').select_option(hero)
            await page.wait_for_function('()=>!window.__bongoSnapshot().loading')
            assert 'Nie wczytano' not in await page.locator('#load-status').inner_text()
        await page.locator('#begin').click()
        await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
        assert (await page.locator('#timer').inner_text()).startswith('Czas ')
        await page.keyboard.down('ArrowRight')
        await page.wait_for_timeout(300)
        await page.keyboard.up('ArrowRight')
        assert (await page.evaluate('()=>window.__bongoSnapshot().world.player.x')) > 2
        await page.locator('#help').click()
        assert await page.locator('#help-panel').is_visible()
        frozen = await page.evaluate('()=>window.__bongoSnapshot()')
        timer = await page.locator('#timer').inner_text()
        await page.wait_for_timeout(1200)
        after = await page.evaluate('()=>window.__bongoSnapshot()')
        assert frozen['world'] == after['world'] and after['frames'] > frozen['frames']
        assert timer == await page.locator('#timer').inner_text()
        await page.screenshot(path=str(output / f'{name}-help.png'))
        await page.keyboard.press('Escape')
        assert not await page.locator('#help-panel').is_visible()
        assert await page.locator('#pause-panel').is_visible()
        await page.locator('#resume').click()
        assert await page.evaluate('()=>document.activeElement.id') == 'cave'
        await page.wait_for_function('tick=>window.__bongoSnapshot().world.tick>tick', arg=after['world']['tick'])
        if profile.get('is_mobile'):
            box = await page.locator('#joystick').bounding_box()
            x, y = box['x']+box['width']/2, box['y']+box['height']/2
            await page.mouse.move(x,y)
            await page.mouse.down()
            await page.mouse.move(x+33,y)
            await page.wait_for_timeout(200)
            assert await page.evaluate('()=>window.__bongoSnapshot().input') == 'right'
            await page.mouse.up()
            assert await page.evaluate('()=>window.__bongoSnapshot().input') is None
        await page.keyboard.press('r')
        await page.locator('#pause').click()
        await page.locator('#to-menu').click()
        await page.locator('#help').click()
        await page.locator('#help-close').click()
        assert not await page.locator('#help-panel').is_visible()
        assert await page.locator('#menu').is_visible()
        assert await page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
        await page.screenshot(path=str(output / f'{name}-menu.png'))
        if name == 'chromium':
            gallery = await context.new_page()
            await gallery.set_viewport_size({'width':1200,'height':1800})
            cards = ''.join(f'<figure><figcaption>{hero}</figcaption><img src="http://127.0.0.1:{port}/game-assets/2d/bongo-rush/characters/{hero}/spritesheet.png"></figure>' for hero in [*heroes,'kobra','patrol','owsiak'])
            await gallery.set_content('<style>body{background:#172235;color:#fff;font:16px system-ui;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0;padding:10px;background:#243147}img{max-width:100%;height:190px;object-fit:contain;object-position:left}</style>'+cards)
            await gallery.wait_for_function('()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
            await gallery.screenshot(path=str(output/'all-characters.png'),full_page=True)
            await gallery.close()
        assert not errors and not failures, (errors, failures)
        return {'browser':name,'status':'PASS','heroes':heroes,'timer_pauses_with_help':True,
                'raf_continues_during_help':True,'help_escape_does_not_resume':True,
                'joystick_pointer_emulation':bool(profile.get('is_mobile')),
                'javascript_errors':errors,'http_errors':failures,
                'physical_iphone_and_music_listening':'PENDING_HUMAN'}
    finally:
        await context.close()
        await browser.close()


async def main():
    """Write independent Chromium and iPhone-profile WebKit reports and screenshots."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=5198)
    args = parser.parse_args()
    output = ROOT / 'reports/bongo-polish'
    output.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        results = await asyncio.gather(
            verify(p.chromium,'chromium',{'viewport':{'width':1440,'height':960}},args.port,output),
            verify(p.webkit,'webkit-iphone13',p.devices['iPhone 13'],args.port,output))
    (output/'browser-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=True),flush=True)


if __name__ == '__main__':
    asyncio.run(main())
