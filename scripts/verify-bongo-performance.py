"""Measure old and new game callbacks sequentially in matching browser profiles, without claiming hardware FPS."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright
from importlib.machinery import SourceFileLoader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-living'
CHECKS = SourceFileLoader('living_checks', str(ROOT / 'scripts/verify-bongo-living.py')).load_module()


async def measure(engine, profile, port, new):
    """Warm the same first cave, then sample 120 callbacks of the existing RAF."""
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    await page.add_init_script('''
      localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,unlocked:1,hero:'amper',muted:true,completed:false}));
      window.__frameSamples=[];const schedule=requestAnimationFrame.bind(window);let previous;
      window.requestAnimationFrame=callback=>schedule(time=>{
        const start=performance.now();callback(time);
        if(previous!==undefined)window.__frameSamples.push({duration:performance.now()-start,interval:time-previous});
        previous=time;
      });
    ''')
    try:
        await page.goto(f'http://127.0.0.1:{port}/bongo-rush.html')
        await CHECKS.ready(page)
        if new:
            await CHECKS.gallery(page)
        await page.locator('#begin').click()
        return await CHECKS.timings(page)
    finally:
        await browser.close()


async def main():
    """Record both browsers and both revisions under the same viewport and movement conditions."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = []
        for engine, name, profile in [(p.chromium, 'desktop', {'viewport':{'width':1440,'height':960}}),
                                     (p.webkit, 'iphone-webkit', p.devices['iPhone 13'])]:
            results.append({'browser':name,'baseline_commit':'10c584c',
                            'before':await measure(engine, profile, 5209, False),
                            'after':await measure(engine, profile, 5207, True)})
    (OUT / 'performance.json').write_text(json.dumps(results, indent=2),encoding='utf-8')
    print(json.dumps(results, indent=2),flush=True)


if __name__ == '__main__':
    asyncio.run(main())
