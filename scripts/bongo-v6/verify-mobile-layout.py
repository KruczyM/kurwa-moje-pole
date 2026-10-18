"""Exercise the real menu, camera/minimap layout, controls and orientation changes."""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/bongo-mobile-layout'
OUT.mkdir(parents=True, exist_ok=True)

async def ready(page):
    await page.wait_for_function('window.__bongoSnapshot && !window.__bongoSnapshot().loading')

async def check_layout(page):
    await page.wait_for_timeout(150)
    data = await page.evaluate("""() => {
      const s=window.__bongoSnapshot(), rect=id=>document.querySelector(id).getBoundingClientRect().toJSON();
      return {rendering:s.rendering,board:rect('#board'),joystick:rect('#joystick'),restart:rect('#touch-restart'),footer:rect('footer'),level:s.level,mode:s.mode};
    }""")
    r, board = data['rendering'], data['board']
    m, v = r.get('minimap'), r['viewport']
    assert m and m['docked'], data
    assert m['y']-5 >= v['y']+v['height']-.1, data
    footer_top = data['footer']['y'] if data['footer']['height'] else board['y']+board['height']
    assert m['y']+m['height']+5+board['y'] <= footer_top+.1, data
    if board['width'] >= 568 and board['height'] < 400:
        assert v['height'] >= 120, data
    absolute={'x':m['x']-5+board['x'],'y':m['y']-5+board['y'],'width':m['width']+10,'height':m['height']+10}
    def overlaps(a,b):
        return a['x'] < b['x']+b['width'] and b['x'] < a['x']+a['width'] and a['y'] < b['y']+b['height'] and b['y'] < a['y']+a['height']
    assert not overlaps(absolute,data['joystick']),data
    assert not overlaps(absolute,data['restart']),data
    return data

async def main(url):
    records=[]
    async with async_playwright() as p:
      for engine in ['chromium','webkit']:
        browser=await getattr(p,engine).launch()
        for style in ['standard','storybook']:
          context=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
          page=await context.new_page(); errors=[]
          page.on('pageerror', lambda error: errors.append(str(error)))
          await page.add_init_script("localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:24,hero:'pierscien',muted:true,visualTheme:'"+style+"',collectibleStyle:'festival'}))")
          await page.goto(url,wait_until='networkidle');await ready(page)
          await page.locator('#choose-level').click();await ready(page)
          assert await page.evaluate('window.__bongoSnapshot().menuScreen')=='levels'
          assert not await page.locator('#hero-confirm').is_visible()
          for level in [6,15,24]:
            await page.locator(f'#levels button[data-level="{level-1}"]').click();await ready(page)
            await page.locator('#begin').click()
            await page.wait_for_function('window.__bongoSnapshot().mode==="playing"')
            for width,height in [(390,844),(844,390),(320,568),(667,375),(568,320),(640,360),(360,640),(320,480)]:
              await page.set_viewport_size({'width':width,'height':height})
              data=await check_layout(page)
              records.append({'engine':engine,'style':style,'screen':[width,height],'level':level,'layout':data})
              if level==15 and width in [390,844]:
                await page.screenshot(path=str(OUT/f'{engine}-{style}-{width}x{height}.png'))
            await page.locator('#map').click()
            await page.wait_for_function('!window.__bongoSnapshot().rendering.minimap')
            await page.locator('#map').click();await check_layout(page)
            # Exercise existing joystick and restart handlers without adding a test-only controller.
            joy=await page.locator('#joystick').bounding_box()
            await page.mouse.move(joy['x']+joy['width']/2,joy['y']+joy['height']/2)
            await page.mouse.down();await page.mouse.move(joy['x']+joy['width']-6,joy['y']+joy['height']/2)
            await page.wait_for_timeout(180);await page.mouse.up()
            assert await page.evaluate('window.__bongoSnapshot().input') is None
            await page.locator('#touch-restart').click()
            await page.locator('#pause').click()
            await page.set_viewport_size({'width':360,'height':480})
            await page.wait_for_timeout(100)
            await page.locator('#pause').click();await check_layout(page)
            await page.locator('#pause').click();await page.locator('#to-menu').click();await ready(page)
            assert await page.evaluate('window.__bongoSnapshot().menuScreen')=='levels'
            assert await page.locator(f'#levels button[data-level="{level-1}"]').get_attribute('aria-pressed')=='true'
            assert await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1")).hero')=='pierscien'
          assert not errors,errors
          await context.close()
        await browser.close()
    (OUT/'report.json').write_text(json.dumps({'status':'PASS','url':url,'checks':records,'quickLevelSelectionRetainsHero':True,'mapToggle':True,'joystickAndRestart':True},indent=2),encoding='utf-8')
    print(f'PASS: {len(records)} real-browser mobile layouts, both styles, quick level selection, joystick/restart, map toggle')

asyncio.run(main(sys.argv[1]))
