"""Verify the actual cached model on the camp table and in the existing inspection UI."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/sunglasses'

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://127.0.0.1:5184/?fogTrial=1&server=http://127.0.0.1:3104')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#player-nickname').fill('GlassesQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=300000)
        report = await page.evaluate('''()=>{
          const g=window.__camp_game, item=g.world.interactables.find(i=>i.itemId==='sunglasses');
          const meshes=[];item.object.children[0].traverse(o=>{if(o.isMesh)meshes.push({name:o.name,vertices:o.geometry.attributes.position.count});});
          const position=item.object.getWorldPosition(g.camera.position.clone());
          g.toggleFreeCamera(true);g.camera.position.copy(position).add({x:0,y:0.35,z:0.35});g.camera.lookAt(position);
          g.player.pitch=g.camera.rotation.x;g.player.yaw=g.camera.rotation.y;
          return {cachedModel:g.propModels.has('sunglasses'),tableMeshes:meshes,position:position.toArray()};
        }''')
        assert report['cachedModel'] and sum(m['vertices'] for m in report['tableMeshes'])==968, report
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(OUT/'table.png'))
        await page.evaluate('window.__camp_game.inspect("sunglasses")')
        await page.evaluate('''()=>{const c=window.__camp_game.inspectController.controls;c.yaw=-0.35;c.pitch=0.12;c.pointerId=-1;}''')
        await page.wait_for_timeout(1500)
        await page.locator('#inspect-canvas').screenshot(path=str(OUT/'inspection.png'))
        assert await page.evaluate('window.__camp_game.inspectController.activeItemId')=='sunglasses'
        report['pageErrors']=errors
        assert not errors, errors
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report,indent=2))
        await browser.close()

asyncio.run(main())
