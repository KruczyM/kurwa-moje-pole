"""Real UI acceptance for material placement, all detailed NPC types, pause, retry and cache bounds."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-materials-v3'
URL = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5212/bongo-rush.html'


async def open_levels(page):
    await page.locator('#play').click()
    await page.wait_for_function('()=>document.querySelectorAll("#hero-gallery button:not(:disabled)").length===15')
    await page.locator('#hero-confirm').click()
    await page.wait_for_function('()=>!window.__bongoSnapshot().loading')


async def run(engine, name, profile):
    browser = await engine.launch()
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, failures, requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status>=400 else None)
    page.on('request', lambda request: requests.append(request.url) if '/materials-v3/' in request.url else None)
    await page.add_init_script(r'''
      localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,unlocked:16,hero:'amper',muted:true,completed:true}));
      window.__npcFrames={};const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
        if(this.canvas.id==='cave' && image.src && /characters\/(patrol-red-v3|patrol-blue-v3|undercover-v3)\//.test(image.src)){
          const name=image.src.split('/').slice(-2)[0];
          window.__npcFrames[name]??={};window.__npcFrames[name][`${args[0]},${args[1]}`]=true;
        }
        return draw.call(this,image,...args);
      };
    ''')
    try:
        await page.goto(URL+'?verify=1')
        await page.wait_for_function('()=>window.__bongoSnapshot && !window.__bongoSnapshot().loading')
        await open_levels(page)
        records = []
        for level in [2,4,8,10,7]:
            await page.locator(f'[data-level="{level-1}"]').click()
            await page.wait_for_function('()=>!window.__bongoSnapshot().loading')
            await page.locator('#begin').click()
            await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
            await page.wait_for_timeout(2200)
            before = await page.evaluate('window.__bongoSnapshot()')
            assert before['world']['status']=='playing'
            stats = before['rendering']
            assert 0 < stats['cachedTiles'] <= 256
            assert stats['decorations']['directional'] > 0
            await page.screenshot(path=str(OUT/f'{name}-level-{level}.png'))
            await page.locator('#pause').click()
            await page.wait_for_timeout(100)
            paused = await page.locator('#cave').screenshot()
            tick = await page.evaluate('window.__bongoSnapshot().world.tick')
            frames = await page.evaluate('window.__bongoSnapshot().frames')
            await page.wait_for_timeout(350)
            assert await page.locator('#cave').screenshot()==paused
            assert await page.evaluate('window.__bongoSnapshot().world.tick')==tick
            assert await page.evaluate('window.__bongoSnapshot().frames')>frames
            await page.keyboard.press('Escape')
            assert await page.evaluate('document.activeElement.id')=='cave'
            if profile.get('is_mobile'):
                box = await page.locator('#joystick').bounding_box()
                x,y=box['x']+box['width']/2,box['y']+box['height']/2
                await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-30)
                await page.wait_for_timeout(220);await page.mouse.up()
            await page.locator('#pause').click()
            await page.locator('#to-menu').click()
            await open_levels(page)
            records.append({'level':level,'rendering':stats,'result':'PASS'})
        frames = await page.evaluate('window.__npcFrames')
        for npc in ['patrol-red-v3','patrol-blue-v3','undercover-v3']:
            columns = {int(float(key.split(',')[0]))//128 for key in frames.get(npc,{})}
            assert set(range(2,10)).issubset(columns), (name,npc,columns)
        assert len(set(requests))==len(requests)==4, requests
        assert not errors and not failures, (errors,failures)
        # Failed required enemy art must remain in menu, report the error, and support a real retry.
        await page.route('**/undercover-v3/spritesheet.png*', lambda route:route.abort())
        await page.reload()
        await page.wait_for_function('()=>window.__bongoSnapshot && !window.__bongoSnapshot().loading')
        assert await page.evaluate('window.__bongoSnapshot().mode')=='menu'
        await open_levels(page)
        await page.locator('#begin').click()
        await page.wait_for_function('()=>!window.__bongoSnapshot().loading')
        assert await page.evaluate('window.__bongoSnapshot().mode')=='menu'
        await page.unroute('**/undercover-v3/spritesheet.png*')
        await page.locator('#begin').click()
        await page.wait_for_function('()=>window.__bongoSnapshot().mode==="playing"')
        return {'browser':name,'records':records,'enemyFrames':{key:len(value) for key,value in frames.items()},
                'javascriptErrors':errors,'httpErrors':failures,'retry':'PASS','physicalIphone':'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        results=[await run(p.chromium,'desktop',{'viewport':{'width':1440,'height':960}}),
                 await run(p.webkit,'iphone-webkit',p.devices['iPhone 13'])]
    (OUT/'browser.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2),flush=True)


if __name__=='__main__':
    asyncio.run(main())
