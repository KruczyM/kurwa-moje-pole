"""Local demo checks with real UI plus deterministic collision-grid routes; no paid services."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/after-demo'
URL = 'http://127.0.0.1:5187/after-demo.html?verify=1'


async def run(engine, name, profile):
    """Check mobile UI, keyboard/touch, dialogue, pause, finale and forbidden network requests."""
    browser = await engine.launch(headless=True)
    context = await browser.new_context(**profile)
    page = await context.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    try:
        await page.goto(URL)
        await page.locator('#begin').wait_for(state='visible')
        await page.wait_for_function('()=>!document.querySelector("#begin").disabled')
        await page.screenshot(path=str(OUT / f'{name}-start.png'))
        await page.locator('#begin').click()
        await page.wait_for_timeout(200)
        before = await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.players[0].position')
        await page.keyboard.down('d')
        await page.wait_for_timeout(300)
        await page.keyboard.up('d')
        after = await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.players[0].position')
        assert after['x'] > before['x'], (before, after)
        await page.locator('#pause').click()
        tick = await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.tick')
        await page.wait_for_timeout(150)
        assert await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.tick') == tick
        await page.locator('#resume').click()
        box = await page.locator('#joystick').bounding_box()
        await page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
        touch_before = await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.players[0].position.y')
        await page.mouse.down()
        await page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2 - 36)
        await page.wait_for_timeout(200)
        await page.mouse.up()
        touch_after = await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.players[0].position.y')
        assert touch_after < touch_before
        assert await page.evaluate('()=>window.__afterDemo.joystick.snapshot().y') == 0
        if name.startswith('chromium'):
            cdp = await context.new_cdp_session(page)
            sprint = await page.locator('#sprint').bounding_box()
            x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
            sx, sy = sprint['x'] + sprint['width']/2, sprint['y'] + sprint['height']/2
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'id': 1, 'x': x, 'y': y}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'id': 1, 'x': x+30, 'y': y-30}]})
            stamina = await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.players[0].stamina')
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'id': 1, 'x': x+30, 'y': y-30}, {'id': 2, 'x': sx, 'y': sy}]})
            await page.wait_for_timeout(250)
            assert await page.evaluate('()=>window.__afterDemo.campaign.snapshot().world.players[0].stamina') < stamina
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            assert await page.evaluate('()=>window.__afterDemo.joystick.snapshot().x') == 0

        async def travel(target):
            """Walk legal grid waypoints using the production simulation, never teleport positions."""
            await page.evaluate('''async(id)=>{
              const d=window.__afterDemo,c=d.campaign;
              const {createPilotMap}=await import('/src/games/after/data/pilotMap.ts');
              const m=createPilotMap(),t=m.interactions.find(x=>x.id===id),p=c.snapshot().world.players[0].position;
              const start=Math.floor(p.y)*m.width+Math.floor(p.x),end=Math.floor(t.position.y)*m.width+Math.floor(t.position.x);
              const parents=new Map([[start,-1]]),q=[start];
              for(let i=0;i<q.length&&!parents.has(end);i++){
                const cell=q[i],x=cell%m.width,y=Math.floor(cell/m.width);
                for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
                  const n=ny*m.width+nx;
                  if(nx<0||ny<0||nx>=m.width||ny>=m.height||m.collision[n]||parents.has(n))continue;
                  parents.set(n,cell);q.push(n);
                }
              }
              if(!parents.has(end))throw Error('No route');
              const path=[];
              for(let cell=end;cell!==start;cell=parents.get(cell))path.unshift(cell);
              path.unshift(start);
              for(const cell of path){
                const x=cell%m.width+.5,y=Math.floor(cell/m.width)+.5;
                for(let step=0;step<40;step++){
                  const pos=c.snapshot().world.players[0].position,dx=x-pos.x,dy=y-pos.y;
                  if(Math.hypot(dx,dy)<.001)break;
                  c.setInput('local',{moveX:Math.max(-1,Math.min(1,dx/.08)),moveY:Math.max(-1,Math.min(1,dy/.08)),sprint:false});
                  c.advance(1/30);
                  if(step===39)throw Error('Blocked waypoint');
                }
              }
              c.setInput('local',{moveX:0,moveY:0,sprint:false});d.refreshUI();
              if(c.prompt('local')?.id!==id)throw Error('Wrong prompt '+c.prompt('local')?.id);
            }''', target)

        await travel('witness')
        await page.locator('#interact').click()
        assert await page.locator('#dialogue').is_visible()
        assert await page.locator('#speech').inner_text()
        await page.screenshot(path=str(OUT / f'{name}-dialogue.png'))
        await page.keyboard.press('Escape')
        assert not await page.locator('#dialogue').is_visible()
        assert not await page.locator('#pause-panel').is_visible()
        for target in ['flag', 'friend', 'cable', 'power', 'camp-return']:
            await travel(target)
            await page.locator('#interact').click()
            if await page.locator('#dialogue').is_visible():
                await page.locator('#close-dialogue').click()
        assert await page.locator('#finish').is_visible()
        await page.screenshot(path=str(OUT / f'{name}-finish.png'))
        await page.locator('#restart').click()
        assert not await page.locator('#finish').is_visible()
        await page.set_viewport_size({'width': 844, 'height': 390})
        await page.wait_for_timeout(200)
        assert await page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
        await page.screenshot(path=str(OUT / f'{name}-landscape.png'))
        assert not errors, errors
        assert not any('.glb' in url or 'socket.io' in url or '.mp4' in url for url in requests), requests
        report = {'engine': name, 'profile': profile.get('user_agent', 'desktop'),
                  'keyboardMove': True, 'pointerMove': True, 'pauseFreezesTicks': True,
                  'escapeClosesDialogueOnly': True, 'threeQuestsAndFinale': True,
                  'restartAndLandscape': True, 'pageErrors': errors,
                  'glbOrMultiplayerRequests': False,
                  'nativeMultitouchSprint': name.startswith('chromium'),
                  'caveat': 'Native two-finger touch tested through Chromium CDP; physical iPhone ergonomics pending.'}
        (OUT / f'{name}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2))
    finally:
        await browser.close()


async def main():
    """Use installed Playwright engines only; no browser downloads or external API calls."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        await run(p.webkit, 'webkit-iphone13', p.devices['iPhone 13'])
        await run(p.chromium, 'chromium-desktop', {'viewport': {'width': 1280, 'height': 800}, 'has_touch': True})


if __name__ == '__main__':
    asyncio.run(main())
