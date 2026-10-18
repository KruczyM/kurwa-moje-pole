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
        await page.locator('#player-nickname').fill('WaterQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game.state.current==="playing"',timeout=60000)
        result=await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);g.player.stop();
          g.npcs.npcs.forEach(n=>n.root.visible=false);
          const root=g.world.interactables.find(i=>i.itemId==='water').object;
          const point=root.getWorldPosition(g.camera.position.clone());
          g.camera.position.set(point.x,1.9,point.z+.85);
          g.camera.lookAt(point.x,point.y+.15,point.z);g.camera.updateMatrixWorld(true);
          g.player.yaw=g.camera.rotation.y;g.player.pitch=g.camera.rotation.x;
          return {source:!!g.propModels.get('water')?.getObjectByName('MineralWaterBottle'),
            interaction:g.interactions.update(),before:g.inventory.quantity('Woda')};
        }''')
        print(json.dumps(result))
        await page.keyboard.press('e')
        await page.wait_for_function('()=>window.__camp_game.state.current==="inspecting"')
        output=Path(__file__).resolve().parents[1]/'reports/mineral-water';output.mkdir(parents=True,exist_ok=True)
        await page.screenshot(path=str(output/'inspection.png'))
        await page.locator('#inspect-take').click()
        await page.wait_for_function('()=>window.__camp_game.state.current==="playing"')
        result['after']=await page.evaluate('window.__camp_game.inventory.quantity("Woda")')
        result['pageErrors']=errors
        (output/'browser-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))
        assert result['source'] and result['interaction']['itemId']=='water' and result['after']==result['before']+1 and not errors,result
        await browser.close()

asyncio.run(main())
