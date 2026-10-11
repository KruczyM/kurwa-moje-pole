"""Real-input vault completions and biome gallery; no world mutation or accelerated simulation."""
import asyncio
import itertools
import json
import runpy
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-puzzles'
CHECKS = runpy.run_path(str(ROOT / 'scripts/verify-bongo-rush.py'))
GALLERY = runpy.run_path(str(ROOT / 'scripts/verify-bongo-expanded.py'))
URL = 'http://127.0.0.1:5192/bongo-rush.html?verify=1'
GALLERY['gallery'].__globals__['CHECKS']['URL'] = URL
GALLERY['gallery'].__globals__['OUT'] = OUT


async def play(page, directions):
    """Hold real keys until the authored target is reached; extra real ticks remain enabled."""
    for direction, values in itertools.groupby(directions):
        count = len(list(values))
        before = await CHECKS['snapshot'](page)
        assert before['mode'] == 'playing', before
        dx, dy = {'up': (0, -1), 'right': (1, 0), 'down': (0, 1), 'left': (-1, 0)}[direction]
        target = {'x': before['world']['player']['x'] + dx * count,
                  'y': before['world']['player']['y'] + dy * count}
        await page.keyboard.down(CHECKS['KEYS'][direction])
        try:
            await page.wait_for_function('''target=>{
              const s=window.__bongoSnapshot();
              const reached=s.world.player.x===target.x && s.world.player.y===target.y;
              // Release DOM input immediately, not a slow protocol round-trip later. Physics/RAF are untouched.
              if(reached) window.dispatchEvent(new KeyboardEvent('keyup',{code:target.key,bubbles:true}));
              return reached || s.mode!=='playing';
            }''', arg={**target, 'key': CHECKS['KEYS'][direction]}, timeout=count * 300 + 3000)
        except Exception:
            state = await CHECKS['snapshot'](page)
            print(json.dumps({'failed_move': direction, 'count': count, 'target': target,
                              'mode': state['mode'], 'player': state['world']['player'],
                              'tick': state['world']['tick'], 'reason': state['world']['reason']}), flush=True)
            (OUT / 'failure.json').write_text(json.dumps(state, ensure_ascii=False), encoding='utf-8')
            raise
        finally:
            await page.keyboard.up(CHECKS['KEYS'][direction])
        after = await CHECKS['snapshot'](page)
        assert after['mode'] != 'lost'
        assert after['world']['player']['x'] == target['x'] and after['world']['player']['y'] == target['y'], (target, after['world']['player'])


async def vault(engine, number, profile):
    """Select an unlocked test fixture through UI, walk the entire cave and solve its mandatory vault."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    try:
        await page.add_init_script('localStorage.setItem("after-bongo-rush:v1",JSON.stringify({version:1,unlocked:12,hero:"amper",muted:true,completed:false}))')
        await page.goto(URL)
        await CHECKS['ready'](page)
        await page.locator(f'#levels button[data-level="{number-1}"]').click()
        await CHECKS['ready'](page)
        await page.locator('#begin').click()
        await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
        route = await page.evaluate('''async n=>{
          const {LEVELS}=await import('/src/games/bongo-rush/Levels.ts');
          const {exitPuzzleForLevel}=await import('/src/games/bongo-rush/ExitPuzzles.ts');
          const level=LEVELS[n-1], puzzle=exitPuzzleForLevel(n-1);
          return {approach:level.solution.slice(0,-puzzle.solution.length), puzzle:puzzle.solution, name:puzzle.name, quota:level.quota};
        }''', number)
        await play(page, route['approach'])
        state = await CHECKS['snapshot'](page)
        assert state['mode'] == 'playing'
        assert state['world']['collected'] >= route['quota']
        assert route['name'] in await page.locator('#hint').inner_text()
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(150)
        paused = await CHECKS['snapshot'](page)
        await page.wait_for_timeout(200)
        frozen = await CHECKS['snapshot'](page)
        assert frozen['world']['tick'] == paused['world']['tick']
        assert frozen['frames'] > paused['frames']
        await page.keyboard.press('Escape')
        await page.screenshot(path=str(OUT / f'vault-{number}.png'))
        assert await page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
        await play(page, route['puzzle'])
        assert (await CHECKS['snapshot'](page))['mode'] == ('victory' if number == 12 else 'won')
        assert not errors and not failures, (errors, failures)
        return {'status': 'PASS', 'level': number, 'vault': route['name'], 'mobile': profile.get('is_mobile', False),
                'full_route_real_keyboard': True, 'save_fixture_unlocked': True,
                'pause_raf': True, 'javascript_errors': errors, 'http_errors': failures}
    finally:
        await context.close()
        await browser.close()


async def main():
    """Check all four biome appearances plus every puzzle family and the final boss/vault sequence."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        desktop = {'viewport': {'width': 1440, 'height': 960}}
        results = [await GALLERY['gallery'](p.chromium)]
        for pair in [(1, 4), (7, 12)]:
            # At most two active gameplay browsers to limit software-rendering load on the host.
            completed = await asyncio.gather(*[
                vault(p.webkit if number == 7 else p.chromium, number,
                      p.devices['iPhone 13'] if number == 7 else desktop)
                for number in pair
            ])
            results.extend(completed)
            print(json.dumps(completed, ensure_ascii=True), flush=True)
    (OUT / 'browser-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
