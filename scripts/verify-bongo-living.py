"""Real-input desktop/WebKit acceptance for living biomes, including comparable local frame timings."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-living'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5207/bongo-rush.html'
PRODUCTION = '/kurwa-moje-pole/' in URL


async def ready(page):
    """Wait for actual asset loading without accessing or mutating the world."""
    await page.wait_for_function('()=>!document.querySelector("#begin").disabled')


async def gallery(page):
    """Enter the gallery and explicitly confirm the cosmetic character selection."""
    await page.locator('#play').click()
    await page.wait_for_function('()=>document.querySelectorAll("#hero-gallery button:not(:disabled)").length===15')
    await page.locator('#hero-confirm').click()
    await ready(page)


async def timings(page):
    """Measure the existing game RAF callback, excluding loading and cold caches."""
    await page.wait_for_timeout(500)
    await page.evaluate('window.__frameSamples=[]')
    await page.wait_for_function('()=>window.__frameSamples.length>=120', timeout=15000)
    return await page.evaluate('''()=>{
      const data=window.__frameSamples;
      const durations=data.map(x=>x.duration).sort((a,b)=>a-b);
      const intervals=data.map(x=>x.interval).sort((a,b)=>a-b);
      return {samples:data.length, averageRenderMs:data.reduce((a,x)=>a+x.duration,0)/data.length,
        p95RenderMs:durations[Math.floor(data.length*.95)], p95IntervalMs:intervals[Math.floor(data.length*.95)]};
    }''')


async def run(engine, name, profile, reduced=False):
    """Exercise the full menu flow, all portraits, biome art, pause, touch and reduced motion."""
    browser = await engine.launch()
    context = await browser.new_context(**profile, reduced_motion='reduce' if reduced else 'no-preference')
    page = await context.new_page()
    errors, failures, scene_requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append(response.url) if response.status >= 400 else None)
    page.on('request', lambda request: scene_requests.append(request.url) if '/living/' in request.url else None)
    await page.add_init_script('''
      localStorage.setItem('after-bongo-rush:v1', JSON.stringify({version:1,unlocked:16,hero:'amper',muted:true,completed:true}));
      window.__frameSamples=[];
      window.__terrainDraws=0;
      window.__heroDraws=[];
      window.__tileAlpha=[];const seenTiles=new WeakSet();
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
        if(this.canvas.id==='cave' && image instanceof HTMLImageElement && image.src.includes('/characters/'))
          window.__heroDraws.push(image.src);
        if(image instanceof HTMLCanvasElement && image.width===64){
          window.__terrainDraws++;
          if(!seenTiles.has(image)){
            seenTiles.add(image);const data=image.getContext('2d').getImageData(0,0,64,64).data;
            let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)transparent++;
            window.__tileAlpha.push(transparent);
          }
        }
        return draw.call(this,image,...args);
      };
      const schedule=window.requestAnimationFrame.bind(window);let previous;
      window.requestAnimationFrame=callback=>schedule(time=>{
        const start=performance.now();callback(time);
        if(previous!==undefined){window.__frameSamples.push({interval:time-previous,duration:performance.now()-start});
          if(window.__frameSamples.length>600)window.__frameSamples.shift();}
        previous=time;
      });
    ''')
    try:
        await page.goto(URL + '?verify=1')
        await ready(page)
        assert await page.locator('#menu').is_visible()
        assert not await page.locator('#level-panel').is_visible()
        assert not await page.locator('#hero-panel').is_visible()
        assert not await page.locator('#begin').is_visible()
        if PRODUCTION:
            assert await page.evaluate('typeof window.__bongoSnapshot') == 'undefined'
        await page.screenshot(path=str(OUT / f'{name}-title.png'))
        if reduced:
            image = await page.locator('#cave').screenshot()
            await page.wait_for_timeout(400)
            assert await page.locator('#cave').screenshot() == image
        await page.locator('#play').click()
        await page.wait_for_function('()=>document.querySelectorAll("#hero-gallery button:not(:disabled)").length===15')
        assert await page.locator('[data-hero="kobra"]').count() == 0
        previews = set()
        for hero in await page.locator('[data-hero]').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.hero)'):
            await page.locator(f'[data-hero="{hero}"]').click()
            assert await page.locator(f'[data-hero="{hero}"]').get_attribute('aria-pressed') == 'true'
            label = await page.locator(f'[data-hero="{hero}"] span').inner_text()
            assert await page.locator('#hero-preview-name').inner_text() == label
            previews.add(await page.locator('#hero-preview').evaluate('(canvas)=>canvas.toDataURL()'))
        assert len(previews) == 15, 'Every hero must have a distinct selectable preview'
        assert await page.locator('#hero-gallery canvas').evaluate_all('''nodes=>nodes.every(canvas=>{
          const p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          let visible=0;for(let i=3;i<p.length;i+=4)if(p[i])visible++;
          return visible>100;
        })''')
        await page.screenshot(path=str(OUT / f'{name}-gallery.png'))
        await page.keyboard.press('Escape')
        assert await page.locator('#menu').is_visible()
        await gallery(page)
        await page.keyboard.press('Escape')
        assert await page.locator('#hero-panel').is_visible()
        await page.locator('#hero-confirm').click()
        await ready(page)
        results = []
        for level in ([1] if reduced else [1, 4, 7, 10]):
            await page.locator(f'[data-level="{level-1}"]').click()
            await ready(page)
            terrain_before = await page.evaluate('window.__terrainDraws')
            selected_hero = await page.locator('[data-hero][aria-pressed="true"]').get_attribute('data-hero')
            await page.evaluate('window.__heroDraws=[]')
            await page.locator('#begin').click()
            await page.wait_for_function('()=>document.querySelector("#level-panel").hidden')
            await page.wait_for_function('count=>window.__terrainDraws>count', arg=terrain_before)
            # A resize after a mobile orientation change can clear the backing store.
            # Check the current visible canvas, not just a historical draw counter.
            await page.wait_for_timeout(500)
            await page.wait_for_function('''()=>{
              const c=document.querySelector('#cave'),ctx=c.getContext('2d');
              const p=ctx.getImageData(0,0,c.width,c.height).data, colors=new Set();
              for(let y=Math.floor(c.height*.18);y<c.height*.65;y+=10)
                for(let x=0;x<c.width;x+=10){const i=(y*c.width+x)*4;
                  colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);}
              return colors.size>100;
            }''')
            assert await page.evaluate('document.activeElement.id') == 'cave'
            assert await page.evaluate('(hero)=>window.__heroDraws.some(src=>src.includes(`/characters/${hero}/`))', selected_hero)
            await page.screenshot(path=str(OUT / f'{name}-level-{level}.png'))
            if level == 1:
                results.append(await timings(page))
                await page.keyboard.down('ArrowRight')
                await page.wait_for_timeout(350)
                await page.keyboard.up('ArrowRight')
            if profile.get('is_mobile'):
                box = await page.locator('#pause').bounding_box()
                await page.touchscreen.tap(box['x'] + box['width']/2, box['y'] + box['height']/2)
            else:
                await page.locator('#pause').click()
            await page.wait_for_timeout(100)
            before = await page.locator('#cave').screenshot()
            count = await page.evaluate('window.__frameSamples.length')
            await page.wait_for_timeout(350)
            assert await page.locator('#cave').screenshot() == before, 'Paused canvas changed'
            assert await page.evaluate('window.__frameSamples.length') > count or count == 600
            await page.keyboard.press('Escape')
            assert not await page.locator('#pause-panel').is_visible()
            assert await page.evaluate('document.activeElement.id') == 'cave'
            if profile.get('is_mobile'):
                box = await page.locator('#joystick').bounding_box()
                x, y = box['x']+box['width']/2, box['y']+box['height']/2
                await page.mouse.move(x, y)
                await page.mouse.down()
                await page.mouse.move(x+32, y)
                await page.wait_for_timeout(220)
                await page.mouse.up()
                if level == 1:
                    await page.set_viewport_size({'width':844,'height':390})
                    await page.wait_for_timeout(250)
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    await page.screenshot(path=str(OUT / f'{name}-landscape.png'))
                    await page.set_viewport_size({'width':390,'height':664})
            await page.locator('#pause').click()
            await page.locator('#to-menu').click()
            await ready(page)
            assert await page.locator('#menu').is_visible()
            assert not await page.locator('#pause-panel').is_visible()
            await gallery(page)
        assert len(scene_requests) == len(set(scene_requests)), scene_requests
        assert len(scene_requests) == (2 if reduced else 4), scene_requests
        alpha = await page.evaluate('window.__tileAlpha')
        assert 0 in alpha and any(205 <= count <= 614 for count in alpha), alpha
        assert not errors and not failures, (errors, failures)
        return {'browser': name, 'status': 'PASS', 'reduced_motion': reduced,
                'frame_timings': results, 'scene_requests': scene_requests,
                'javascript_errors': errors, 'http_errors': failures, 'physical_iphone': 'PENDING_HUMAN'}
    finally:
        await browser.close()


async def main():
    """Store reproducible local evidence without changing campaign progress on a real user profile."""
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = [await run(p.chromium, 'desktop', {'viewport': {'width': 1440, 'height': 960}}),
                   await run(p.webkit, 'iphone-webkit', p.devices['iPhone 13']),
                   await run(p.chromium, 'reduced', {'viewport': {'width': 1440, 'height': 960}}, True)]
    (OUT / ('production.json' if PRODUCTION else 'report.json')).write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
