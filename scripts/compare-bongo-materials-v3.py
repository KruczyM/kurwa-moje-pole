"""Sequential matched baseline/new measurements; do not interpret desktop WebKit as iPhone FPS."""
import asyncio
import importlib.util
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-materials-v3'
spec = importlib.util.spec_from_file_location('checks', ROOT/'scripts/verify-bongo-living.py')
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


async def measure(engine, profile, port, level):
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    await page.add_init_script('''
      localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,unlocked:16,hero:'amper',muted:true,completed:true}));
      window.__frameSamples=[];const schedule=requestAnimationFrame.bind(window);let previous;
      window.requestAnimationFrame=callback=>schedule(time=>{
        const start=performance.now();callback(time);
        if(previous!==undefined)window.__frameSamples.push({duration:performance.now()-start,interval:time-previous});
        previous=time;
      });
    ''')
    try:
        await page.goto(f'http://127.0.0.1:{port}/bongo-rush.html')
        await checks.gallery(page)
        await page.locator(f'[data-level="{level-1}"]').click()
        await checks.ready(page)
        await page.locator('#begin').click()
        return await checks.timings(page)
    finally:
        await browser.close()


async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        records=[]
        for engine,name,profile in [(p.chromium,'desktop',{'viewport':{'width':1440,'height':960}}),
                                    (p.webkit,'iphone-webkit',p.devices['iPhone 13'])]:
            for level in [2,7]:
                records.append({'browser':name,'level':level,'baseline':'5b794a1 (same Bongo code as 2ca6387)',
                                'before':await measure(engine,profile,5210,level),
                                'after':await measure(engine,profile,5212,level)})
    (OUT/'performance.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
    print(json.dumps(records,indent=2),flush=True)


if __name__=='__main__':
    asyncio.run(main())
