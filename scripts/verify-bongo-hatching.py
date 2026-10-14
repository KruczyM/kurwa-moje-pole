"""Verify actual Kobra births, hatching poses and pause through the real host RAF."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/bongo-hatching'

async def run(engine,name,profile):
    browser=await engine.launch()
    try:
        page=await browser.new_page(**profile)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:2,unlocked:24,hero:'amper',muted:true}))")
        await page.goto('http://127.0.0.1:5226/bongo-rush.html?verify=1')
        await page.locator('#play').click();await page.locator('#hero-confirm').click()
        await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
        await page.locator('[data-level="7"]').click()
        await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
        await page.clock.install();await page.clock.pause_at(await page.evaluate('Date.now()+1000'))
        await page.locator('#begin').click()
        records=[]
        for tick,label in [(8,'rest'),(9,'shake'),(11,'crack'),(12,'split'),(14,'settled')]:
            for _ in range(200):
                snapshot=await page.evaluate('window.__bongoSnapshot()')
                if snapshot['steps']>=tick:break
                await page.clock.fast_forward(50)
            assert snapshot['steps']==tick,(tick,snapshot['steps'])
            births=snapshot['world'].get('bushBirths',[])
            if tick<12:assert len(births)==0
            else:assert len(births)>0 and births[0]['tick']==12
            # Half of the actual render interpolation tick shows separation rather than its starting pose.
            await page.clock.fast_forward(100)
            await page.screenshot(path=str(OUT/f'{name}-{label}.png'))
            records.append({'tick':tick,'pose':label,'births':births})
        await page.locator('#pause').click();await page.clock.fast_forward(50)
        before=await page.locator('#cave').screenshot()
        snapshot=await page.evaluate('window.__bongoSnapshot()')
        await page.clock.fast_forward(1000)
        assert before==await page.locator('#cave').screenshot()
        assert (await page.evaluate('window.__bongoSnapshot()'))['steps']==snapshot['steps']
        assert not errors,errors
        return {'browser':name,'result':'PASS','poses':records,'pause':'PASS','errors':errors}
    finally:await browser.close()

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        records=[await run(p.chromium,'desktop',{'viewport':{'width':1440,'height':960}}),
                 await run(p.webkit,'iphone',p.devices['iPhone 13'])]
    (OUT/'browser.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
    print(json.dumps(records,indent=2),flush=True)

if __name__=='__main__':asyncio.run(main())
