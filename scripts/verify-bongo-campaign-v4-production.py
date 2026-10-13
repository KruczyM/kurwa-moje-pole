"""Verify the compiled Pages build, actual portal input and overlay geometry without debug APIs."""
import asyncio
import hashlib
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-campaign-v4'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5227/kurwa-moje-pole/bongo-rush.html'


async def run(engine, name, profile):
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: errors.append(f'{response.status}: {response.url}') if response.status >= 400 else None)
    await page.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,unlocked:16,hero:'amper',muted:true,completed:true}))")
    await page.add_init_script("""
      window.__frameDeltas=[];
      const nativeRAF=window.requestAnimationFrame.bind(window);let previous;
      window.requestAnimationFrame=callback=>nativeRAF(time=>{if(previous!==undefined)window.__frameDeltas.push(time-previous);previous=time;callback(time);});
    """)
    records = []
    performance = None
    try:
        await page.goto(URL + '?verify=1')
        assert await page.evaluate('typeof window.__bongoSnapshot') == 'undefined'
        for level in [1, 6, 7, 10]:
            await page.locator('#play').click()
            await page.locator('#hero-confirm').click()
            await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
            await page.locator(f'[data-level="{level-1}"]').click()
            await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
            await page.locator('#begin').click()
            await page.wait_for_function('()=>document.querySelector("#touch-controls").hidden===false')
            await page.wait_for_timeout(80)
            if level == 1:
                await page.evaluate('window.__frameDeltas=[]')
                await page.wait_for_timeout(1200)
                performance = await page.evaluate('''()=>{const a=window.__frameDeltas.slice().sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*0.95)]}}''')
            if level == 6:
                await page.keyboard.down('ArrowUp')
                await page.wait_for_function('()=>document.querySelector("#level-title").textContent.includes("Wieża amaren")',timeout=5000)
                await page.keyboard.up('ArrowUp')
                assert 'Wieża amaren' in await page.locator('#level-title').inner_text(), (name,await page.locator('#level-title').inner_text())
            if profile.get('is_mobile'):
                geometry = await page.evaluate('''()=>{
                  const rect=id=>document.getElementById(id).getBoundingClientRect();
                  const board=rect('board'),canvas=rect('cave'),app=rect('bongo-app'),stick=rect('joystick'),zone=rect('joystick-zone');
                  return {mapAtBottom:Math.abs(canvas.bottom-app.bottom)<2,centered:Math.abs(stick.x+stick.width/2-board.x-board.width/2)<2,
                    zone:zone.width,stick:stick.width,restart:rect('touch-restart').width};
                }''')
                assert geometry['mapAtBottom'] and geometry['centered'], geometry
                assert geometry['zone'] > geometry['stick'] and geometry['restart'] >= 48
            await page.screenshot(path=str(OUT / f'production-{name}-{level}.png'))
            await page.locator('#pause').click()
            paused = await page.locator('#cave').screenshot()
            await page.wait_for_timeout(180)
            assert paused == await page.locator('#cave').screenshot()
            await page.locator('#help').click()
            assert await page.locator('#context-hint').inner_text()
            await page.locator('#help-close').click()
            await page.locator('#to-menu').click()
            records.append({'level':level,'result':'PASS'})
        # Published texture bytes must be actual PNGs and equal the reviewed local files.
        assets = []
        for theme in ['amarena','roots','rave','glass']:
            relative=f'game-assets/2d/bongo-rush/materials-v4/{theme}.png'
            response = await context.request.get(URL.rsplit('/',1)[0] + '/' + relative)
            data = await response.body()
            assert response.status == 200 and data.startswith(b'\x89PNG')
            assert hashlib.sha256(data).digest() == hashlib.sha256((ROOT / 'public' / relative).read_bytes()).digest()
            assets.append({'theme':theme,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        assert not errors, errors
        return {'browser':name,'records':records,'assets':assets,'errors':errors,'frameIntervals':performance,'physicalPhone':'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = [await run(p.chromium,'desktop',{'viewport':{'width':1440,'height':960}}),
            await run(p.webkit,'iphone-portrait',p.devices['iPhone 13']),
            await run(p.webkit,'iphone-landscape',{**p.devices['iPhone 13'],'viewport':{'width':844,'height':390}})]
    (OUT / 'production.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2),flush=True)


if __name__ == '__main__':
    asyncio.run(main())
