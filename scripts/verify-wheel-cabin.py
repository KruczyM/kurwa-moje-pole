"""Verify boarding through E and a camera contained by the actual authored gondola."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        page=await browser.new_page(viewport={'width':1280,'height':800})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('WheelCabinQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.wheelRideController',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game.state.current==="playing"',timeout=60000)
        await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);g.player.stop();
          const wheel=g.world.getWheel();wheel.setScheduleTime(0);
          g.camera.position.copy(g.wheelRideController.getBoardingPoint(true));
        }''')
        await page.keyboard.press('e')
        await page.wait_for_function('()=>window.__camp_game.wheelRideController.isRiding()')
        await page.wait_for_function('()=>!window.__camp_game.world.getWheel().getScheduleSample().stopped',timeout=6000)
        report=await page.evaluate('''async()=>{
          const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
          const g=window.__camp_game,wheel=g.world.getWheel(),ride=g.wheelRideController;
          const samples=[];
          for(const time of [4,13,24,36]) {
            wheel.setScheduleTime(time);ride.update(.01);
            const box=new Box3().setFromObject(wheel.getGondola(12));
            samples.push({time,inside:box.containsPoint(g.camera.position),eyeAboveFloor:g.camera.position.y-box.min.y,
              size:box.getSize(new Vector3()).toArray(),roll:g.camera.rotation.z,phase:wheel.getScheduleSample().phase});
          }
          wheel.setScheduleTime(24);ride.update(.01);ride.setLook(Math.PI/2,0);
          return {state:ride.getState(),samples};
        }''')
        output=Path(__file__).resolve().parents[1]/'reports/wheel-cabin';output.mkdir(parents=True,exist_ok=True)
        await page.screenshot(path=str(output/'cabin-view.png'))
        report['exit']=await page.evaluate('''()=>{
          const g=window.__camp_game,wheel=g.world.getWheel(),ride=g.wheelRideController;
          wheel.setScheduleTime(46);ride.update(.3);ride.update(.3);
          return {state:ride.getState(),phase:wheel.getScheduleSample().phase,stopped:wheel.getScheduleSample().stopped};
        }''')
        report['pageErrors']=errors
        (output/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report))
        assert all(s['inside'] and abs(s['eyeAboveFloor']-1.05)<.01 and s['roll']==0 for s in report['samples']),report
        assert report['exit']['state']=='idle' and report['exit']['stopped'] and not errors,report
        await browser.close()

asyncio.run(main())
