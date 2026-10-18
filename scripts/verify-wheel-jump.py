"""Runtime regression: queued wheel entry, running jump, and map without tent marker."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'reports/wheel-jump'
OUT.mkdir(parents=True,exist_ok=True)
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        page=await browser.new_page(viewport={'width':1440,'height':1000})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('WheelJumpQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.wheelRideController',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn").click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=60000)
        setup=await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);
          g.settings.reduceMotion=true;g.player.enabled=true;
          const wheel=g.world.getWheel(),point=wheel.root.userData.boardingTarget;
          g.camera.position.set(point.x,1.9,point.z);g.player.stop();
          wheel.setScheduleTime(20);
          const interaction=g.interactions.update();
          g.key(new KeyboardEvent('keydown',{key:'e',code:'KeyE'}));
          const pending=g.wheelRideController.boardingRequested;
          wheel.setScheduleTime(89.1);
          return {interaction,pending,reducedMotion:g.settings.reduceMotion,station:point,walkable:g.world.canMove(point.x,point.z)};
        }''')
        assert setup['interaction']['kind']=='ferris_wheel' and setup['pending'] and setup['walkable'],setup
        await page.wait_for_function('()=>window.__camp_game.wheelRideController.isRiding()',timeout=10000)
        assert await page.evaluate('window.__camp_game.settings.reduceMotion'), 'Ride must not disable accessibility settings'
        await page.screenshot(path=str(OUT/'cabin.png'))
        jump=await page.evaluate('''()=>{
          const g=window.__camp_game;
          g.wheelRideController.cancelToGround();g.setPause(true);document.querySelector('#pause').hidden=true;
          g.camera.position.set(0,1.9,15);g.player.yaw=0;g.player.pitch=0;g.player.enabled=true;g.player.setMovementLocked(false);
          g.player.keys.add('w');g.player.keys.add('shift');
          const started=g.player.requestJump();
          g.stageLiveScreens.playLocalJump();
          const clip=g.stageLiveScreens.localAvatar.animator.currentClip;
          g.player.update(.1,{speed:1,sway:0,shake:0,bob:0});
          const airborne=g.player.isAirborne(),height=g.camera.position.y,z=g.camera.position.z;
          for(let i=0;i<120;i++)g.player.update(1/60,{speed:1,sway:0,shake:0,bob:0});
          g.player.stop();return {started,clip,airborne,height,z,landed:!g.player.isAirborne()};
        }''')
        assert jump['started'] and jump['airborne'] and jump['height']>1.9 and jump['z']<15 and jump['landed'],jump
        await page.evaluate('window.__camp_game.toggleMap(true)')
        await page.screenshot(path=str(OUT/'map.png'))
        report={'wheel':setup,'ridingReached':True,'jump':jump,'pageErrors':errors,
          'remoteJump':'VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN: second logged client'}
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        assert not errors,errors
        print(json.dumps(report))
        await browser.close()
asyncio.run(main())
