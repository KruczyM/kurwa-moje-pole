"""Local Chromium touch integration QA; not physical phone performance measurements."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/mobile-sector-boundaries'

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        context = await browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True, service_workers='block')
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5297/kurwa-moje-pole/?server=http://127.0.0.1:3107')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#player-nickname').fill('SectorQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=240000)
        print('Entered mobile world', flush=True)
        await page.evaluate('''()=>{const g=window.__camp_game;g.networkClient.disconnect(true);g.player.stop();g.camera.position.set(-65,1.8,60);g.player.yaw=Math.PI;g.player.pitch=-0.3;}''')
        await page.wait_for_function('()=>document.querySelector("#mobile-sector-hint")?.textContent.includes("ASP")')
        await page.screenshot(path=str(OUT/'portrait-boundary.png'))
        await page.evaluate('window.__camp_game.camera.position.z=63.8')
        await page.wait_for_timeout(200)
        await page.evaluate('window.__camp_game.camera.position.z=64.2')
        await page.locator('.sector-transition[open]').wait_for()
        assert 'ASP' in await page.locator('.sector-transition').inner_text()
        await page.get_by_role('button', name='Zostań tutaj').click()
        await page.wait_for_function('()=>!window.__camp_game.sectorTransitioning')
        await page.evaluate('window.__camp_game.camera.position.z=64.2')
        await page.wait_for_timeout(500)
        assert await page.locator('.sector-transition[open]').count()==0
        assert await page.evaluate('window.__camp_game.sectorStreamer.activeArea')=='camp'
        await page.evaluate('window.__camp_game.camera.position.z=60')
        await page.wait_for_timeout(200)
        await page.evaluate('window.__camp_game.camera.position.z=64.2')
        await page.get_by_role('button', name='Tak, przejdź').click()
        await page.wait_for_function('()=>window.__camp_game.sectorStreamer.activeArea==="south-passage" && !window.__camp_game.sectorTransitioning', timeout=120000)
        asp = await page.evaluate('''()=>{
            const g=window.__camp_game; const meshes=[];
            g.scene.traverse(o=>{if(o.userData.runtimeNode==='ASP_Tent_Canopy' || o.userData.runtimePlacement==='smallStage') meshes.push({name:o.name,visible:o.visible,layer:o.layers.isEnabled(0)});});
            g.camera.position.set(-98,1.8,97);g.player.yaw=-Math.PI/2;g.player.pitch=0;
            return {active:g.sectorStreamer.activeArea,landmark:g.festivalMap.getLandmarks().find(l=>l.id==='asp'),meshes};
        }''')
        assert asp['landmark']['label']=='Namiot ASP', asp
        assert asp['meshes'], asp
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT/'portrait-asp.png'))
        print('ASP loaded; cancellation and crossing passed', flush=True)
        await page.evaluate('window.__camp_game.toggleMap(true)')
        await page.wait_for_timeout(300)
        await page.screenshot(path=str(OUT/'portrait-map.png'))
        await page.set_viewport_size({'width':844,'height':390})
        await page.wait_for_timeout(300)
        await page.screenshot(path=str(OUT/'landscape-map.png'))
        await page.evaluate('window.__camp_game.toggleMap(false)')
        await page.screenshot(path=str(OUT/'landscape-asp.png'))
        # Return across the southern edge, fail one real camp download, then retry.
        await page.evaluate('window.__camp_game.camera.position.set(-65,1.8,68)')
        await page.wait_for_timeout(200)
        await page.evaluate('window.__camp_game.camera.position.z=63.8')
        await page.locator('.sector-transition[open]').wait_for()
        failed = False
        async def fail_once(route):
            nonlocal failed
            if not failed:
                failed=True
                await route.abort()
            else: await route.continue_()
        await page.route('**/mobile-camp-*.glb*', fail_once)
        await page.get_by_role('button', name='Tak, przejdź').click()
        print('Waiting for intentional download error',flush=True)
        await page.get_by_role('button', name='Spróbuj ponownie').wait_for(timeout=30000)
        await page.get_by_role('button', name='Spróbuj ponownie').click()
        await page.wait_for_function('()=>window.__camp_game.sectorStreamer.activeArea==="camp" && !window.__camp_game.sectorTransitioning', timeout=120000)
        assert failed
        assert not errors, errors
        report={'engine':'Chromium touch emulation','viewports':[[390,844],[844,390]],'asp':asp,'cancelReentry':'PASS','retryAfterDownloadFailure':'PASS','returnToCamp':'PASS','pageErrors':errors,'physicalPhone':'VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN'}
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        print(json.dumps(report,indent=2,ensure_ascii=True),flush=True)
        await browser.close()

asyncio.run(main())
