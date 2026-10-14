"""Measure callback work separately from emulated browser RAF scheduling; never claim hardware FPS."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
URL='http://127.0.0.1:5227/kurwa-moje-pole/bongo-rush.html'

async def probe(engine,name,profile):
    browser=await engine.launch()
    try:
        page=await browser.new_page(**profile)
        await page.add_init_script("""
          localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:2,unlocked:24,hero:'amper',muted:true}));
          window.__work=[];window.__intervals=[];
          const native=requestAnimationFrame.bind(window);let previous;
          window.requestAnimationFrame=callback=>native(time=>{
            if(previous!==undefined)window.__intervals.push(time-previous);previous=time;
            const start=performance.now();callback(time);window.__work.push(performance.now()-start);
          });
        """)
        await page.goto(URL)
        await page.locator('#play').click();await page.locator('#hero-confirm').click()
        await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
        await page.locator('#begin').click();await page.wait_for_timeout(1000)
        await page.evaluate('window.__work=[];window.__intervals=[]')
        await page.wait_for_timeout(3000)
        return {'browser':name,**await page.evaluate("""()=>{
          const stats=a=>{a=a.slice().sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*.95)]}};
          return {callbackWork:stats(window.__work),frameIntervals:stats(window.__intervals)};
        }"""),'physicalPhone':'PENDING_HUMAN'}
    finally:await browser.close()

async def main():
    async with async_playwright() as p:
        data=[await probe(p.chromium,'desktop',{'viewport':{'width':1440,'height':960}}),
              await probe(p.webkit,'iphone-portrait',p.devices['iPhone 13']),
              await probe(p.webkit,'iphone-landscape',{**p.devices['iPhone 13'],'viewport':{'width':844,'height':390}})]
    (ROOT/'reports/bongo-campaign-v5/performance.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps(data,indent=2),flush=True)

if __name__=='__main__':asyncio.run(main())
