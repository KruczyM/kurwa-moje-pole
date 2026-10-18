"""Browser acceptance: overlays, saved touch layouts and a stable UI-safe camera."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'reports/bongo-mobile-safe-camera'


async def ready(page):
    await page.wait_for_function('window.__bongoSnapshot && !window.__bongoSnapshot().loading')


def overlaps(a,b):
    return a['x']<b['x']+b['width'] and a['x']+a['width']>b['x'] and a['y']<b['y']+b['height'] and a['y']+a['height']>b['y']


async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report=[]
    async with async_playwright() as p:
        for engine in ['chromium','webkit']:
            browser=await getattr(p,engine).launch()
            context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce')
            await context.add_init_script("if(!localStorage.getItem('after-bongo-rush:v1'))localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:24,lastLevel:1,hero:'amper',muted:true,visualTheme:'storybook',collectibleStyle:'festival'}))")
            page=await context.new_page();errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            await page.goto('http://127.0.0.1:5241/bongo-rush.html?verify');await ready(page)
            await page.locator('#play').click()
            await page.wait_for_function('!document.querySelector("#hero-confirm").disabled')
            assert not await page.locator('#bongo-app > footer').is_visible()
            await page.screenshot(path=str(OUT/f'{engine}-heroes.png'))
            await page.locator('#hero-back').click()
            await page.locator('#appearance-open').click()
            await page.locator('#touch-position').select_option('left')
            await page.locator('#touch-size').select_option('large')
            await page.locator('#touch-opacity').fill('70')
            await page.locator('#appearance-apply').click();await ready(page)
            await page.locator('#appearance-close').click()
            await page.reload();await ready(page)
            assert await page.locator('#bongo-app').get_attribute('data-touch-position')=='left'
            saved=await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1"))')
            assert saved['touchControls']=={'position':'left','size':'large','opacity':70}
            viewports=[(320,480)] if '--edge-only' in sys.argv else [(390,844),(844,390),(320,480),(568,320),(1440,900)]
            for width,height in viewports:
                await page.set_viewport_size({'width':width,'height':height})
                await page.locator('#choose-level').click();await ready(page)
                assert not await page.locator('#bongo-app > footer').is_visible()
                await page.screenshot(path=str(OUT/f'{engine}-{width}-levels.png'))
                tiles=[]
                for level in [1,12,18,24]:
                    await page.locator(f'#levels button[data-level="{level-1}"]').click();await ready(page)
                    await page.locator('#begin').click();await ready(page)
                    await page.wait_for_timeout(120)
                    data=await page.evaluate('''()=>{
                      const s=window.__bongoSnapshot(),b=document.querySelector('#board').getBoundingClientRect(),h=document.querySelector('.hud').getBoundingClientRect();
                      return {rendering:s.rendering,input:s.input,level:s.level,mode:s.mode,player:{...s.rendering.player,x:s.rendering.player.x+b.x,y:s.rendering.player.y+b.y},hud:{x:h.x,y:h.y,width:h.width,height:h.height}};
                    }''')
                    assert data['mode']=='playing', data
                    tiles.append(data['rendering']['tileSize'])
                    pad=await page.locator('#joystick-zone').bounding_box()
                    restart=await page.locator('#touch-restart').bounding_box()
                    assert not overlaps(data['player'],pad),data
                    assert not overlaps(data['player'],data['hud']),data
                    assert not overlaps(pad,restart),(pad,restart)
                    for arrow in await page.locator('#joystick button').all():
                        rect=await arrow.bounding_box()
                        assert rect['width']>=48 and rect['height']>=48,rect
                    await page.locator('#map').click()
                    await page.wait_for_function('!!window.__bongoSnapshot().rendering.minimap')
                    mini=await page.evaluate('''()=>{const m=window.__bongoSnapshot().rendering.minimap,b=document.querySelector('#board').getBoundingClientRect();return {x:m.x+b.x-5,y:m.y+b.y-5,width:m.width+10,height:m.height+10}}''')
                    assert not overlaps(mini,pad),(mini,pad)
                    await page.locator('#map').click()
                    await page.screenshot(path=str(OUT/f'{engine}-{width}-level-{level}.png'))
                    await page.locator('#pause').click()
                    assert not await page.locator('#bongo-app > footer').is_visible()
                    await page.locator('#to-menu').click();await ready(page)
                    report.append({'engine':engine,'viewport':[width,height],'level':level,'tile':tiles[-1],'playerClearOfHudAndPad':True,'restartSeparate':True,'minimapSeparate':True})
                assert max(tiles)-min(tiles)<.01,tiles
                await page.locator('#level-title-back').click()
            # Side switches keep restart opposite; cancel does not save a changed layout.
            await page.locator('#appearance-open').click()
            await page.locator('#touch-position').select_option('right')
            await page.locator('#appearance-close').click()
            assert await page.locator('#bongo-app').get_attribute('data-touch-position')=='left'
            for position in ['center','right']:
                await page.locator('#appearance-open').click()
                await page.locator('#touch-position').select_option(position)
                await page.locator('#appearance-apply').click();await ready(page)
                await page.locator('#appearance-close').click()
                assert await page.locator('#bongo-app').get_attribute('data-touch-position')==position
                await page.set_viewport_size({'width':568,'height':320})
                await page.locator('#choose-level').click();await ready(page)
                await page.locator('#levels button[data-level="17"]').click();await ready(page)
                await page.locator('#begin').click();await ready(page)
                await page.wait_for_timeout(120)
                data=await page.evaluate('''()=>{const s=window.__bongoSnapshot(),b=document.querySelector('#board').getBoundingClientRect();return {player:{...s.rendering.player,x:s.rendering.player.x+b.x,y:s.rendering.player.y+b.y}}}''')
                pad=await page.locator('#joystick-zone').bounding_box()
                assert not overlaps(data['player'],pad),(position,data,pad)
                assert not overlaps(pad,await page.locator('#touch-restart').bounding_box())
                await page.locator('#map').click()
                await page.wait_for_function('!!window.__bongoSnapshot().rendering.minimap')
                mini=await page.evaluate('''()=>{const m=window.__bongoSnapshot().rendering.minimap,b=document.querySelector('#board').getBoundingClientRect();return {x:m.x+b.x-5,y:m.y+b.y-5,width:m.width+10,height:m.height+10}}''')
                assert not overlaps(mini,pad),(position,mini,pad)
                await page.screenshot(path=str(OUT/f'{engine}-568-pad-{position}.png'))
                await page.locator('#map').click()
                await page.locator('#pause').click()
                await page.locator('#to-menu').click();await ready(page)
                await page.locator('#level-title-back').click()
            await page.locator('#appearance-open').click()
            await page.locator('#touch-position').select_option('center')
            await page.locator('#appearance-apply').click();await ready(page)
            await page.locator('#appearance-close').click()
            await page.set_viewport_size({'width':320,'height':480})
            await page.locator('#continue').click();await ready(page)
            await page.wait_for_timeout(120)
            pad=await page.locator('#joystick-zone').bounding_box()
            assert not overlaps(pad,await page.locator('#touch-restart').bounding_box())
            await page.screenshot(path=str(OUT/f'{engine}-320-large-center.png'))
            assert not errors,errors
            await context.close();await browser.close()
    (OUT/('edge-report.json' if '--edge-only' in sys.argv else 'report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'PASS: {len(report)} level/viewports; Chromium/WebKit; saved layout, stable scale, clear player, no menu footer overlap')


asyncio.run(main())
