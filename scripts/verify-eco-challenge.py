"""Exercise actual E interaction, private pickups and responsive Eko panel."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('EcoQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs', timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=60000)
        await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);
          g.camera.position.set(0,1.9,14);g.camera.rotation.set(0,Math.PI,0);
        }''')
        await page.keyboard.press('e')
        await page.locator('#eco-panel').wait_for(state='visible')
        await page.set_viewport_size({'width':360,'height':640})
        await page.locator('#eco-solo').click()
        await page.wait_for_function('()=>window.__camp_game.canCollector.getAllCans().length===48')
        result=await page.evaluate('''()=>{
          const g=window.__camp_game,cans=g.canCollector.getAllCans();
          return {poolSize:g.ecoSpawnPool().length,objects:cans.length,
            allWalkable:cans.every(c=>g.world.canMove(c.position[0],c.position[2],.7)),
            rushActive:g.canCollector.isRushActive(),duration:g.canCollector.getRushTimeRemaining()};
        }''')
        await page.evaluate('''()=>{
          const g=window.__camp_game,c=g.canCollector.getAvailableCans()[0];
          g.camera.position.set(c.position[0],1.9,c.position[2]);
        }''')
        await page.keyboard.press('e')
        result['inventory']=await page.evaluate('window.__camp_game.canCollector.getInventoryCount()')
        result['bonuses']=await page.evaluate('''()=>{
          const g=window.__camp_game,c=g.canCollector.getAvailableCans().find(c=>c.id==='eco_11');
          g.camera.position.set(c.position[0],1.9,c.position[2]);g.interact();
          const sprint=g.canCollector.getSpeedBoostMultiplier();
          const markers=g.canCollector.getActiveCanMarkers();
          g.canCollector.update(20);
          return {sprint,wave:g.canCollector.getEcoWaveMultiplier(),
            mapBundles:markers.filter(m=>m.kind==='bundle').length,
            visibleSpeedModel:g.world.canMeshes.get('eco_11').userData.ecoModel};
        }''')
        await page.evaluate('window.__camp_game.camera.position.set(0,1.9,14)')
        await page.keyboard.press('e')
        await page.locator('#eco-panel').wait_for(state='visible')
        result['mobilePanel']=await page.locator('#eco-panel').evaluate('(el)=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scroll:el.scrollHeight>el.clientHeight}}')
        output=Path(__file__).resolve().parents[1]/'reports/eco-challenge'
        output.mkdir(parents=True,exist_ok=True)
        await page.screenshot(path=str(output/'mobile-panel.png'))
        await page.locator('#eco-close').click()
        result['closed']=await page.locator('#eco-panel').evaluate('(el)=>el.hidden')
        result['pageErrors']=errors
        result['models']=await page.evaluate('''async()=>{
          const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
          const {terrainHeight}=await import('/src/game/world/terrainHeight.ts');
          const g=window.__camp_game;g.setPause(true);document.querySelector('#pause').hidden=true;
          g.npcs.npcs.forEach(n=>n.root.visible=false);
          const list=[];
          for(const [i,id] of ['eco_0','eco_1','eco_2','eco_8','eco_11','eco_5'].entries()) {
            const obj=g.world.canMeshes.get(id);obj.visible=true;
            obj.position.set(19+i%3,terrainHeight(19+i%3,-37+Math.floor(i/3))+.01,-37+Math.floor(i/3));
            const bounds=new Box3().setFromObject(obj);
            let meshes=0,triangles=0;
            obj.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
            list.push({id,model:obj.userData.ecoModel,size:bounds.getSize(new Vector3()).toArray(),meshes,triangles});
          }
          g.camera.position.set(20,2.7,-32.5);g.camera.lookAt(20,.3,-36.5);
          return list;
        }''')
        await page.set_viewport_size({'width':1280,'height':800})
        await page.screenshot(path=str(output/'models-in-game.png'))
        assert all(m['model'] and m['meshes']==1 for m in result['models']),result
        (output/'browser-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))
        assert result['objects']==48 and result['allWalkable'] and result['inventory']==1 and result['closed'] and not errors,result
        assert result['bonuses']['sprint']==1.35 and result['bonuses']['wave']==2,result
        await browser.close()

asyncio.run(main())
