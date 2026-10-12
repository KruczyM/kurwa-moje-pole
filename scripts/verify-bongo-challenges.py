"""Play all four challenges with real keys and observe moving traps instead of mutating game state."""
import asyncio
import json
import runpy
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-challenges'
CHECKS = runpy.run_path(str(ROOT / 'scripts/verify-bongo-rush.py'))
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5202/bongo-rush.html') + '?verify=1'


async def play(page, directions):
    """Real DOM keyboard input; watch the visible returning square before releasing its rock support."""
    for index, direction in enumerate(directions):
        state = await CHECKS['snapshot'](page)
        assert state['mode'] == 'playing', state['world']['reason']
        player = state['world']['player']
        dx, dy = {'up': (0, -1), 'right': (1, 0), 'down': (0, 1), 'left': (-1, 0)}[direction]
        target = {'x': player['x'] + dx, 'y': player['y'] + dy}
        roof = any(o['kind'] == 'rock' and o['x'] == target['x'] and o['y'] == target['y'] - 1
                   for o in state['world']['objects'])
        squares = [e for e in state['world']['enemies'] if e['kind'] == 'sweeper' and
                   e['y'] == target['y'] + 1 and abs(e['x'] - target['x']) <= 2]
        key = CHECKS['KEYS'][direction]
        timed_release = bool(roof and squares and dx)
        if timed_release:
            await page.wait_for_function('''target=>{
              const s=window.__bongoSnapshot();
              const ready=s.world.tick%2===0 && s.world.enemies.some(e=>e.kind==='sweeper' && e.y===target.y+1 &&
                Math.abs(e.x-target.x)===1 && e.direction===(e.x>target.x?'left':'right'));
              if(ready) window.dispatchEvent(new KeyboardEvent('keydown',{code:target.key,bubbles:true}));
              return ready;
            }''', arg={**target, 'key': key}, timeout=3000)
        else:
            await page.keyboard.down(key)
        try:
            await page.wait_for_function('''target=>{
              const s=window.__bongoSnapshot();
              const reached=s.world.player.x===target.x && s.world.player.y===target.y;
              if(reached) window.dispatchEvent(new KeyboardEvent('keyup',{code:target.key,bubbles:true}));
              return reached || s.mode!=='playing';
            }''', arg={**target, 'key': key}, timeout=3000)
        except Exception:
            failure = await CHECKS['snapshot'](page)
            (OUT / 'failure-state.json').write_text(json.dumps(failure), encoding='utf-8')
            print(json.dumps({'step': index, 'target': target, 'mode': failure['mode'],
                             'player': failure['world']['player'], 'kills': failure['world']['kills'],
                             'required': [o for o in failure['world']['objects'] if o.get('required')]}), flush=True)
            await page.screenshot(path=str(OUT / 'failure.png'))
            raise
        finally:
            await page.keyboard.up(key)
        after = await CHECKS['snapshot'](page)
        assert after['mode'] != 'lost', (direction, after['world']['reason'], after['world']['player'])
        assert all(after['world']['player'][axis] == target[axis] for axis in ('x','y')), (target, after['world']['player'])


async def level(engine, number, profile):
    """Select through UI, complete every real movement and verify required enemy loot and end-of-list UI."""
    print(f'Starting level {number}', flush=True)
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    try:
        await page.add_init_script('localStorage.setItem("after-bongo-rush:v1",JSON.stringify({version:1,unlocked:16,hero:"amper",muted:true,completed:true}))')
        await page.goto(URL)
        await CHECKS['ready'](page)
        assert await page.locator('#levels button').count() == 16
        await page.locator(f'#levels button[data-level="{number-1}"]').click()
        await CHECKS['ready'](page)
        route = await page.evaluate('''async n=>{
          const {LEVELS}=await import('/src/games/bongo-rush/Levels.ts');
          return {inputs:LEVELS[n-1].solution,kills:LEVELS[n-1].requiredKills};
        }''', number)
        await page.locator('#begin').click()
        await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
        await page.screenshot(path=str(OUT / f'level-{number}-start.png'))
        await play(page, route['inputs'])
        final = await CHECKS['snapshot'](page)
        assert final['mode'] == 'won'
        assert final['world']['kills'] >= route['kills']
        assert not any(o.get('required') for o in final['world']['objects'])
        assert await page.locator('#next').is_hidden() == (number == 16)
        assert not errors and not failures, (errors, failures)
        await page.screenshot(path=str(OUT / f'level-{number}-won.png'))
        return {'level': number, 'status': 'PASS', 'real_keyboard': True,
                'observed_enemy_phase': True, 'kills': final['world']['kills'],
                'mobile': profile.get('is_mobile', False), 'javascript_errors': errors, 'http_errors': failures}
    finally:
        await context.close()
        await browser.close()


async def main():
    """Run sequentially to preserve timing fidelity on software-rendered WebKit and Chromium."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = []
        for number in ([int(value) for value in sys.argv[2].split(',')] if len(sys.argv) > 2 else [13,14,15,16]):
            profile = p.devices['iPhone 13'] if number == 14 else {'viewport': {'width': 1800, 'height': 1600}}
            result = await level(p.webkit if number == 14 else p.chromium, number, profile)
            results.append(result)
            print(json.dumps(result), flush=True)
            (OUT / 'browser-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
        (OUT / 'browser-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
