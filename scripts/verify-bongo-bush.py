"""Verify bush activation, pause, blocking and reset through real browser inputs."""
import asyncio
import json
import runpy
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/bongo-bush'
URL = 'http://127.0.0.1:5198/bongo-rush.html?verify=1'
ROOT = Path(__file__).resolve().parents[1]


async def state(page):
    """Read only detached host diagnostics; never change the simulation from the test."""
    return await page.evaluate('()=>window.__bongoSnapshot()')


async def move_right(page, x):
    """Drive one tile with actual keyboard input, waiting for logical position."""
    await page.keyboard.down('ArrowRight')
    try:
        await page.wait_for_function('x=>window.__bongoSnapshot().world.player.x===x', arg=x)
    finally:
        await page.keyboard.up('ArrowRight')


async def run(engine, name, profile):
    """Exercise the real UI and active-time growth clock in one isolated browser."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        await page.add_init_script('localStorage.setItem("after-bongo-rush:v1",JSON.stringify({version:1,unlocked:3,hero:"amper",muted:true,completed:false}))')
        await page.goto(URL)
        await page.wait_for_function('()=>window.__bongoSnapshot && !window.__bongoSnapshot().loading')
        assert await page.locator('#hero option[value="krzak"]').count() == 0
        assert await page.locator('#hero option[value="kobra"]').count() == 0
        assert await page.locator('#hero option').count() == 15
        await page.locator('#levels button[data-level="2"]').click()
        await page.wait_for_function('()=>!window.__bongoSnapshot().loading')
        await page.locator('#begin').click()
        await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
        route = await page.evaluate('''async()=>{
          const {LEVELS}=await import('/src/games/bongo-rush/Levels.ts');
          const level=LEVELS[2]; let p;
          level.rows.forEach((row,y)=>{const x=row.indexOf('P');if(x>=0)p={x,y};});
          const directions=[];
          for(const direction of level.solution){
            const [dx,dy]={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]}[direction];
            p={x:p.x+dx,y:p.y+dy}; directions.push(direction);
            if(level.rows[p.y][p.x]==='K') return {directions,root:p};
          }
          throw Error('No mandatory root on the reference route');
        }''')
        # Reuse the current real-key replay driver without adding another simulation clock.
        replay = runpy.run_path(str(ROOT / 'scripts/verify-bongo-puzzles.py'))
        replay['play'].__globals__['OUT'] = OUT
        await replay['play'](page, route['directions'])
        root_x = route['root']['x']
        activated = await state(page)
        assert len(activated['world']['bushRoots']) == 1
        assert 'Krzak rośnie' in await page.locator('#hint').inner_text()
        await move_right(page, root_x + 1)
        await page.keyboard.press('Escape')
        paused = await state(page)
        await page.wait_for_timeout(1200)
        frozen = await state(page)
        assert paused['mode'] == frozen['mode'] == 'paused'
        assert paused['world'] == frozen['world']
        assert frozen['frames'] > paused['frames']
        await page.keyboard.press('Escape')
        await page.wait_for_function('()=>window.__bongoSnapshot().world.cells.includes("bush")', timeout=8000)
        grown = await state(page)
        w = grown['world']
        root = w['bushRoots'][0]
        assert w['cells'][root['y'] * w['width'] + root['x']] == 'bush'
        await page.keyboard.down('ArrowLeft')
        await page.wait_for_timeout(400)
        await page.keyboard.up('ArrowLeft')
        assert (await state(page))['world']['player']['x'] == root_x + 1
        await page.screenshot(path=str(OUT / f'{name}-grown.png'))
        await page.keyboard.press('r')
        reset = await state(page)
        assert not reset['world']['bushRoots']
        assert 'nextBushGrowth' not in reset['world']
        assert 'bush' not in reset['world']['cells']
        assert reset['world']['cells'][root['y'] * w['width'] + root['x']] == 'buried-bush'
        assert not errors, errors
        return {'browser': name, 'status': 'PASS', 'activation': True, 'growth': True,
                'pause_freezes_world_not_raf': True, 'grown_root_blocks_player': True,
                'restart_restores_buried_root': True, 'javascript_errors': errors,
                'physical_iphone': 'PENDING_HUMAN'}
    finally:
        await context.close()
        await browser.close()


async def main():
    """Write evidence for desktop Chromium and simulated iPhone WebKit."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = await asyncio.gather(
            run(p.chromium, 'chromium-desktop', {'viewport': {'width': 1440, 'height': 960}}),
            run(p.webkit, 'webkit-iphone13', p.devices['iPhone 13']),
        )
    (OUT / 'browser-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
