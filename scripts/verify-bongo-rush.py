"""Local real-input browser checks: no paid services, teleportation or production debug backdoors."""
import asyncio
import itertools
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-rush'
URL = 'http://127.0.0.1:5190/bongo-rush.html?verify=1'
SNAPSHOT = 'window.__bongoSnapshot()'
KEYS = {'up': 'ArrowUp', 'right': 'ArrowRight', 'down': 'ArrowDown', 'left': 'ArrowLeft'}


async def ready(page):
    """Wait for the actual host to finish asynchronous asset loading."""
    await page.wait_for_function('()=>window.__bongoSnapshot && !window.__bongoSnapshot().loading')


async def snapshot(page):
    """Read detached diagnostic state without changing simulation state."""
    return await page.evaluate(f'()=>{SNAPSHOT}')


async def cave_solution(page, number):
    """Read the authored replay, then feed its directions through real keyboard events."""
    solution = await page.evaluate('''async n=>{
      const {LEVELS}=await import('/src/games/bongo-rush/Levels.ts');
      return LEVELS[n-1].solution;
    }''', number)
    for direction, values in itertools.groupby(solution):
        count = len(list(values))
        before = await snapshot(page)
        assert before['mode'] == 'playing', before
        dx, dy = {'up': (0, -1), 'right': (1, 0), 'down': (0, 1), 'left': (-1, 0)}[direction]
        target = {'x': before['world']['player']['x'] + dx * count,
                  'y': before['world']['player']['y'] + dy * count}
        await page.keyboard.down(KEYS[direction])
        try:
            await page.wait_for_function('''target=>{
              const s=window.__bongoSnapshot();
              return (s.world.player.x===target.x && s.world.player.y===target.y) || s.mode!=='playing';
            }''', arg=target, timeout=count * 250 + 3000)
        finally:
            await page.keyboard.up(KEYS[direction])
        after = await snapshot(page)
        assert after['mode'] != 'lost', (number, direction, after)
    after = await snapshot(page)
    assert after['mode'] == ('victory' if number == 12 else 'won'), after


async def run(engine, name, profile, all_levels=False):
    """Check artwork, pause/focus, all hero atlases, progression, native touch and level completion."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: requests.append(request.url))
    result = {'browser': name, 'completed_levels': []}
    try:
        response = await page.goto(URL)
        assert response.status == 200
        await ready(page)
        assert await page.locator('#hero option').count() == 15
        assert await page.locator('#levels button:disabled').count() == 11
        await page.screenshot(path=str(OUT / f'{name}-menu.png'))
        for hero in ['amper', 'antena', 'gruczol', 'klatwa', 'krwiak', 'pien', 'pierscien', 'zawor', 'ambona', 'chlebak', 'dziaslo', 'hemoroid', 'jeczmien', 'korba', 'szerszen']:
            await page.locator('#hero').select_option(hero)
            await ready(page)
            assert 'Nie wczytano' not in await page.locator('#load-status').inner_text()
        await page.locator('#hero').select_option('amper')
        await ready(page)
        await page.locator('#begin').click()
        await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
        await page.screenshot(path=str(OUT / f'{name}-gameplay.png'))
        await page.keyboard.down('ArrowRight')
        await page.wait_for_timeout(320)
        await page.keyboard.up('ArrowRight')
        assert (await snapshot(page))['world']['player']['x'] > 2
        await page.keyboard.press('Escape')
        paused = await snapshot(page)
        await page.wait_for_timeout(350)
        frozen = await snapshot(page)
        assert paused['mode'] == frozen['mode'] == 'paused'
        assert paused['world']['tick'] == frozen['world']['tick']
        assert frozen['frames'] > paused['frames'] + 3 and frozen['rafActive']
        await page.keyboard.press('Escape')
        assert (await snapshot(page))['mode'] == 'playing'
        await page.keyboard.down('ArrowRight')
        await page.wait_for_timeout(320)
        await page.keyboard.up('ArrowRight')
        assert (await snapshot(page))['world']['player']['x'] > frozen['world']['player']['x']
        if profile.get('is_mobile'):
            stick = await page.locator('#joystick').bounding_box()
            x, y = stick['x'] + stick['width']/2, stick['y'] + stick['height']/2
            before = (await snapshot(page))['world']['player']['x']
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.mouse.move(x + 33, y)
            await page.wait_for_timeout(320)
            await page.mouse.up()
            assert (await snapshot(page))['world']['player']['x'] > before
            assert (await snapshot(page)).get('input') is None
            if name.startswith('chromium'):
                cdp = await context.new_cdp_session(page)
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'id': 1, 'x': x, 'y': y}]})
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'id': 1, 'x': x+33, 'y': y}]})
                await page.wait_for_timeout(170)
                assert (await snapshot(page))['input'] == 'right'
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                assert (await snapshot(page)).get('input') is None
            await page.keyboard.press('Escape')
            await page.locator('#resume').click()
            assert (await snapshot(page)).get('input') is None
        await page.keyboard.press('r')
        assert (await snapshot(page))['world']['tick'] < 2
        await cave_solution(page, 1)
        result['completed_levels'].append(1)
        await page.screenshot(path=str(OUT / f'{name}-level-1-complete.png'))
        if all_levels:
            for number in range(2, 13):
                await page.locator('#next').click()
                await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing" && !window.__bongoSnapshot().loading')
                await cave_solution(page, number)
                result['completed_levels'].append(number)
                print(f'{name}: level {number} completed', flush=True)
                if number in [4, 7, 10, 12]:
                    await page.screenshot(path=str(OUT / f'{name}-level-{number}.png'))
            await page.wait_for_timeout(500)
            assert await page.locator('#victory').is_visible()
            await page.locator('#victory-menu').click()
            assert not await page.locator('#pause-panel').is_visible()
            assert await page.locator('#levels button:disabled').count() == 0
            await page.reload()
            await ready(page)
            assert await page.locator('#levels button:disabled').count() == 0
        if profile.get('is_mobile'):
            await page.set_viewport_size({'width': 844, 'height': 390})
            await page.wait_for_timeout(250)
            await page.screenshot(path=str(OUT / f'{name}-landscape.png'))
            assert await page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
        assert not errors, errors
        assert not failures, failures
        assert not any('.glb' in url or 'socket.io' in url for url in requests), requests
        result.update({'status': 'PASS', 'javascript_errors': errors, 'http_errors': failures, 'heavy_assets': False, 'physical_iphone': 'PENDING_HUMAN'})
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return result
    finally:
        await context.close()
        await browser.close()


async def main():
    """Run a full desktop campaign plus WebKit and native Chromium mobile smoke checks."""
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as p:
        results.append(await run(p.chromium, 'chromium-desktop', {'viewport': {'width': 1440, 'height': 960}}, True))
        results.append(await run(p.webkit, 'webkit-iphone13', p.devices['iPhone 13']))
        results.append(await run(p.chromium, 'chromium-iphone13', p.devices['iPhone 13']))
    (OUT / 'browser-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
