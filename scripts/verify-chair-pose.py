"""Inspect the actual selected character on an authored chair."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        page=await browser.new_page(viewport={'width':1280,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('ChairQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=60000)
        report=await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);g.setPause(true);document.querySelector('#pause').hidden=true;
          const seat=g.world.interactables.find(s=>s.action==='seat');
          const pose=seat.object.userData.interaction;
          g.seatController.start(pose);
          const controller=g.seatController,root=controller.root,visual=controller.visual;
          const heights=[];
          for(let i=0;i<60;i++){
            controller.update(i===0?0:1/60);
            let hips;visual.traverse(o=>{if(o.isBone&&/hips$/i.test(o.name))hips=o});
            heights.push(root.worldToLocal(hips.getWorldPosition(g.camera.position.clone())).y);
          }
          g.renderer.render(g.scene,g.camera);
          return {clip:controller.animator.currentClip,minimumHipY:Math.min(...heights),maximumHipY:Math.max(...heights)};
        }''')
        output=Path(__file__).resolve().parents[1]/'reports/chair-pose';output.mkdir(parents=True,exist_ok=True)
        await page.screenshot(path=str(output/'chair.png'))
        report['pageErrors']=errors
        (output/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report))
        assert abs(report['minimumHipY']-.65)<.001 and abs(report['maximumHipY']-.65)<.001 and not errors,report
        await browser.close()

asyncio.run(main())
