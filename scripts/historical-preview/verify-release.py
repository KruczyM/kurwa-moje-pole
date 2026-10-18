"""Verify the packaged historical Bongo using actual UI input and read-only snapshots."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/bongo-v6-release'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5242/kurwa-moje-pole/bongo-rush.html'
KEYS = {'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight'}


async def ready(page):
    await page.wait_for_function('()=>!document.querySelector("#begin").disabled')


async def run(engine, name, profile):
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: errors.append(f'{response.status} {response.url}') if response.status >= 400 else None)
    try:
        # A limited save verifies navigation does not unlock additional levels.
        await page.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:3,hero:'amper',muted:true,completed:false}))")
        await page.goto(URL)
        assert await page.evaluate('typeof window.__bongoSnapshot') == 'undefined'
        await page.locator('#choose-level').click()
        await ready(page)
        assert await page.locator('[data-level]').count() == 24
        assert await page.locator('[data-level]:disabled').count() == 21
        assert await page.locator('#hero-panel').is_hidden()
        await page.locator('[data-level="1"]').click()
        await ready(page)
        await page.locator('#begin').click()
        await page.locator('#pause').click()
        await page.locator('#to-menu').click()
        await ready(page)
        assert await page.locator('#hero-panel').is_hidden()
        assert await page.locator('[data-level]:disabled').count() == 21
        await page.locator('#level-back').click()
        assert await page.locator('#hero-panel').is_visible()
        await page.locator('#hero-confirm').click()
        await ready(page)
        # Start a separate context with all levels unlocked for result and finale navigation.
        await context.close()
        context = await browser.new_context(**profile)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: errors.append(f'{response.status} {response.url}') if response.status >= 400 else None)
        await page.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:24,hero:'amper',muted:true,completed:false}))")
        await page.goto(URL + '?verify=1')
        await page.locator('#choose-level').click()
        await ready(page)
        await page.clock.install()
        await page.clock.pause_at(await page.evaluate('Date.now()+1000'))
        routes = json.loads((ROOT / 'docs/historical-preview/campaign-v6-proofs.json').read_text(encoding='utf-8'))
        results = []
        for level in [2, 18, 20]:
            await page.locator(f'[data-level="{level-1}"]').click()
            await ready(page)
            await page.locator('#begin').click()
            await page.clock.run_for(16)
            await page.locator('#pause').click()
            before = await page.evaluate('window.__bongoSnapshot()')
            await page.clock.run_for(400)
            after = await page.evaluate('window.__bongoSnapshot()')
            assert before['steps'] == after['steps'] and before['world'] == after['world']
            # Snapshot mutations must affect only copies, never the live simulation.
            await page.evaluate('()=>{const s=window.__bongoSnapshot();s.world.player.x=-1000;s.world.objects.length=0}')
            assert (await page.evaluate('window.__bongoSnapshot()'))['world'] == after['world']
            await page.locator('#resume').click()
            chambers = set()
            for direction in routes[str(level)]['inputs']:
                if (await page.evaluate('window.__bongoSnapshot().world.status')) == 'won':
                    break
                tick = await page.evaluate('window.__bongoSnapshot().steps')
                if direction:
                    await page.keyboard.down(KEYS[direction])
                for _ in range(6):
                    if await page.evaluate('window.__bongoSnapshot().steps') > tick:
                        break
                    await page.clock.fast_forward(50)
                if direction:
                    await page.keyboard.up(KEYS[direction])
                state = await page.evaluate('window.__bongoSnapshot()')
                assert state['steps'] == tick + 1, (level, tick, state['steps'])
                assert state['world']['status'] != 'lost', (level, state['world']['reason'])
                chambers.add(state['chamber'])
            state = await page.evaluate('window.__bongoSnapshot()')
            assert state['world']['status'] == 'won', (level, state)
            assert state['rendering']['cachedTiles'] <= 256
            assert all('/bongo-v6/game-assets/' in asset for asset in state['assets']['urls'])
            if level == 18:
                assert {'main', 'vault-1', 'vault-2'} <= chambers
            await page.screenshot(path=str(OUT / f'{name}-{level}-won.png'))
            await page.locator('#victory-menu' if level == 20 else '#result-menu').click()
            await ready(page)
            state = await page.evaluate('window.__bongoSnapshot()')
            assert state['menuScreen'] == 'levels' and state['heroConfirmed']
            assert await page.locator('#hero-panel').is_hidden()
            # A fresh run keeps the selected level and hero without opening the gallery.
            await page.locator('#begin').click()
            await page.clock.run_for(16)
            fresh = await page.evaluate('window.__bongoSnapshot()')
            assert fresh['level'] == level and fresh['world']['collected'] == 0
            await page.locator('#pause').click()
            await page.locator('#to-menu').click()
            await ready(page)
            results.append({'level': level, 'status': 'WON', 'chambers': sorted(chambers), 'returnAndRestart': 'PASS'})
            print(f'{name} level {level} PASS', flush=True)
        assert not errors, errors
        return {'browser': name, 'results': results, 'errors': errors, 'lockedLevels': 21, 'diagnostics': 'readonly, opt-in', 'physicalPhone': 'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = [await run(p.chromium, 'desktop', {'viewport': {'width': 1280, 'height': 800}}),
                   await run(p.webkit, 'iphone-portrait', p.devices['iPhone 13']),
                   await run(p.webkit, 'iphone-landscape', {**p.devices['iPhone 13'], 'viewport': {'width': 844, 'height': 390}})]
    (OUT / 'browser.json').write_text(json.dumps({'url': URL, 'profiles': results}, indent=2), encoding='utf-8')
    print('Bongo v6 release browser verification PASS', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
