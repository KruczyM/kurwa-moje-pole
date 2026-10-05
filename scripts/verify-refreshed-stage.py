"""Inspect the authored stage and delay towers in the actual game renderer."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/festival-blender/refreshed-stage'
OUT.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width':1440,'height':900})
        errors = []
        page.on('pageerror',lambda error:errors.append(str(error)))
        await page.goto('http://localhost:5173/',wait_until='domcontentloaded')
        await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('StageQA')
        await page.locator('#play').click()
        await page.wait_for_function('() => window.__camp_game?.scene.getObjectByName("AuthoredFestivalWorld")',timeout=120000)
        report = await page.evaluate('''async () => {
            const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
            const g=window.__camp_game;
            g.networkClient.disconnect(true);g.setPause(true);document.querySelector('#pause').hidden=true;
            const world=g.scene.getObjectByName('AuthoredFestivalWorld'), nodes=[], facadeTextures=[];
            world.traverse(o=>{
                for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
                    if (material?.name.includes('Stage_Facade_Graphics') && material.map?.image) {
                        const img=material.map.image;
                        if (!facadeTextures.some(t=>t.material===material.name))
                            facadeTextures.push({material:material.name,width:img.width,height:img.height});
                    }
                }
                if(o.userData.runtimePlacement && /Main_Stage_Deck|Facade_Stage|delay|tower/i.test(o.userData.runtimePlacement)) {
                    const box=new Box3().setFromObject(o);
                    nodes.push({id:o.userData.runtimePlacement,category:o.userData.runtimeCategory,
                        min:box.min.toArray(),max:box.max.toArray(),empty:box.isEmpty()});
                }
            });
            const deck=nodes.find(n=>/Main_Stage_Deck/.test(n.id));
            const center=deck ? new Vector3().fromArray(deck.min).add(new Vector3().fromArray(deck.max)).multiplyScalar(.5) : new Vector3(205,0,18);
            g.camera.position.copy(center).add(new Vector3(-55,28,80));g.camera.lookAt(center.x,12,center.z);g.renderer.render(g.scene,g.camera);
            const a=g.festivalMap.worldToCanvas(0,0,800,600),b=g.festivalMap.worldToCanvas(50,0,800,600),c=g.festivalMap.worldToCanvas(0,50,800,600);
            return {nodes,facadeTextures,drawCalls:g.renderer.info.render.calls,grassDetached:g.world.grass===null,
                effectsDetached:g.world.getStageEffects()===null,
                tentBodyColliders:g.world.colliders.filter(c=>c.points?.length).length,
                metresToPixelsX:(b.x-a.x)/50,metresToPixelsZ:(c.y-a.y)/50};
        }''')
        await page.screenshot(path=str(OUT/'stage.png'))
        await page.evaluate('''() => {
            const g=window.__camp_game;
            g.camera.position.set(135,14,21.5);
            g.camera.lookAt(203,12,21.5);
            g.renderer.render(g.scene,g.camera);
        }''')
        await page.screenshot(path=str(OUT/'stage-front.png'))
        await page.evaluate('window.__camp_game.toggleMap(true)')
        await page.screenshot(path=str(OUT/'map.png'))
        assert report['grassDetached'] and report['effectsDetached'],report
        assert report['tentBodyColliders'] > 50,report
        assert abs(report['metresToPixelsX']-report['metresToPixelsZ']) < .000001,report
        report['pageErrors']=errors
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        assert any('Main_Stage_Deck' in n['id'] and not n['empty'] for n in report['nodes']), report
        assert not errors, errors
        print(json.dumps({'checkedNodes':len(report['nodes']), 'drawCalls':report['drawCalls'], 'pageErrors':errors}))
        await browser.close()

asyncio.run(main())
