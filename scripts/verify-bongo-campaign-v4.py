"""Replay authored campaign wins through real browser keyboard events and the existing RAF."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-campaign-v4'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5226/bongo-rush.html'
KEYS = {'up': 'ArrowUp', 'right': 'ArrowRight', 'down': 'ArrowDown', 'left': 'ArrowLeft'}


async def run(engine, name, profile):
    """Clock advancement schedules the one real RAF; input uses actual keyboard and captured pointer events."""
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: errors.append(f'HTTP {response.status}: {response.url}') if response.status >= 400 else None)
    await page.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,unlocked:16,hero:'amper',muted:true,completed:true}))")
    results = []
    try:
        await page.goto(URL + '?verify=1')
        await page.locator('#play').click()
        await page.locator('#hero-confirm').click()
        await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
        routes = json.loads((OUT / 'browser-routes.json').read_text(encoding='utf-8'))
        styles = await page.locator('[data-level]').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.style)')
        assert styles == [route['style'] for route in routes]
        await page.clock.install()
        await page.clock.pause_at(await page.evaluate('Date.now() + 1000'))
        # Both types in every biome, including the finale. Bonus wins are tested in Simulation.
        for level_id in range(1,17):
            route = routes[level_id - 1]
            await page.locator(f'[data-level="{level_id-1}"]').click()
            await page.wait_for_function('()=>!window.__bongoSnapshot().loading')
            await page.locator('#begin').click()
            assert await page.evaluate('document.activeElement.id') == 'cave'
            await page.clock.run_for(16)
            await page.screenshot(path=str(OUT / f'{name}-level-{level_id}.png'))
            if profile.get('is_mobile') and level_id == 1:
                stick = await page.locator('#joystick').bounding_box()
                board = await page.locator('#board').bounding_box()
                zone = await page.locator('#joystick-zone').bounding_box()
                assert abs(stick['x']+stick['width']/2 - (board['x']+board['width']/2)) < 2
                assert zone['width'] > stick['width']
                x,y=zone['x']+zone['width']/2,zone['y']+zone['height']/2
                await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+250,y)
                assert await page.evaluate('window.__bongoSnapshot().input')=='right'
                await page.mouse.up()
                assert await page.evaluate('window.__bongoSnapshot().input') is None
            # Pause is a real button on touch devices; RAF stays alive and ticks remain stopped.
            await page.locator('#pause').click()
            before = await page.evaluate('window.__bongoSnapshot()')
            await page.clock.run_for(400)
            after = await page.evaluate('window.__bongoSnapshot()')
            assert after['steps'] == before['steps']
            assert after['frames'] > before['frames']
            await page.keyboard.press('Escape')
            assert await page.evaluate('window.__bongoSnapshot().mode') == 'playing'
            for move, direction in enumerate(route['solution']):
                before = await page.evaluate('window.__bongoSnapshot().steps')
                if direction: await page.keyboard.down(KEYS[direction])
                # Fast-forward fires normal RAF callbacks. Four 50ms frames advance one
                # unchanged 200ms physics tick; no real-time sleeps or injected game state.
                for _ in range(5):
                    if await page.evaluate('window.__bongoSnapshot().steps') > before:
                        break
                    await page.clock.fast_forward(50)
                if direction: await page.keyboard.up(KEYS[direction])
                state = await page.evaluate('''()=>{const s=window.__bongoSnapshot();return {tick:s.steps,mode:s.mode,status:s.world.status,reason:s.world.reason}}''')
                assert state['tick'] == before + 1, (name, level_id, move, state)
                assert state['status'] != 'lost', (name, level_id, move, state['reason'])
            snapshot = await page.evaluate('window.__bongoSnapshot()')
            assert snapshot['rendering']['cachedTiles'] <= 256
            assert snapshot['world']['status'] == 'won', (name, level_id, snapshot)
            results.append({'level': level_id, 'style': route['style'], 'moves': len(route['solution']), 'result': 'won'})
            print(f'{name} level {level_id}: won', flush=True)
            await page.screenshot(path=str(OUT / f'{name}-won-{level_id}.png'))
            # Finish overlay returns to the normal title/gallery/level flow.
            await page.locator('#victory-menu' if level_id == 12 else '#result-menu').click()
            await page.locator('#play').click()
            await page.locator('#hero-confirm').click()
            await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
        assert not errors, errors
        return {'browser': name, 'results': results, 'errors': errors, 'physical_iphone': 'PENDING_HUMAN', 'fun_assessment': 'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    """Run desktop and WebKit iPhone profiles against a development server with read-only diagnostics."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = await asyncio.gather(run(p.chromium, 'desktop', {'viewport': {'width': 1440, 'height': 960}}),
                                       run(p.webkit, 'iphone-webkit', p.devices['iPhone 13']))
    (OUT / 'browser.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
