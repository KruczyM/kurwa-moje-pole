"""Browser QA of the map, scrollbars and existing animated crowd."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1]/'reports/map-npc-refresh'
OUT.mkdir(parents=True,exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width':1440,'height':900})
        # Vite's preview uses '/', while the production build targets GitHub Pages.
        if '5175' in os.environ.get('GAME_QA_URL',''):
            async def local_pages_prefix(route):
                await route.continue_(url=route.request.url.replace('/kurwa-moje-pole/','/',1))
            await page.route('**/kurwa-moje-pole/**',local_pages_prefix)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        await page.goto(os.environ.get('GAME_QA_URL','http://localhost:5173/'),wait_until='domcontentloaded')
        try:
            await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        except Exception:
            print(json.dumps({'startupErrors':errors,'url':page.url}))
            raise
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('MapCrowdQA')
        await page.locator('#play').click()
        try:
            await page.wait_for_function('() => window.__camp_game?.npcs?.npcs.length > 20',timeout=120000)
        except Exception:
            print(json.dumps(await page.evaluate('''() => ({state:window.__camp_game?.state.current,
                count:window.__camp_game?.npcs?.npcs.length,error:document.querySelector('#load-error')?.textContent,
                nicknameError:document.querySelector('#nickname-error')?.textContent})''')))
            raise
        catalog=json.loads((Path(__file__).resolve().parents[1]/'src/game/assets/assetCatalog.json').read_text(encoding='utf-8'))
        expected=len(catalog['festivalNpcs'])+len(catalog['characters'])
        await page.wait_for_function('(expected) => window.__camp_game?.npcs?.npcs.length >= expected',arg=expected,timeout=180000)
        report=await page.evaluate('''() => {
            const g=window.__camp_game;g.networkClient.disconnect(true);
            const checks=g.npcs.npcs.filter(n=>n.visual).map(n=>({name:n.name,
                widthRatio:n.visual.scale.x/n.visual.scale.y,depthRatio:n.visual.scale.z/n.visual.scale.y}));
            g.toggleMap(true);
            const scrollbars=[...document.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY))
                .map(e=>({id:e.id,scrollbar:getComputedStyle(e).scrollbarColor}));
            return {npcCount:g.npcs.npcs.length,checks,mapFeatures:g.world.mapScenery.length,
                mapBounds:g.festivalMap.getViewBounds(),legend:document.querySelector('.festival-map-legend').textContent,scrollbars};
        }''')
        await page.screenshot(path=str(OUT/'map.png'))
        await page.locator('#map-zoom-in').click()
        zoom=await page.evaluate('window.__camp_game.festivalMap.getZoom()')
        assert zoom > 1
        await page.locator('#map-close').click()
        assert await page.locator('#festival-map').is_hidden()
        await page.evaluate('''() => {
            const g=window.__camp_game;g.setPause(true);document.querySelector('#pause').hidden=true;
            const n=g.npcs.npcs.find(n=>n.passageWalker && n.visual && !n.isSitting);
            g.camera.position.copy(n.root.position).add({x:Math.sin(n.root.rotation.y)*4,y:1.5,z:Math.cos(n.root.rotation.y)*4});
            g.camera.lookAt(n.root.position.x,n.root.position.y+1.3,n.root.position.z);
            g.renderer.render(g.scene,g.camera);
        }''')
        await page.screenshot(path=str(OUT/'npc.png'))
        assert report['mapFeatures'] > 100
        assert report['mapBounds']['minZ'] <= -160
        assert 'Grzybek' not in report['legend']
        assert all(abs(n['widthRatio']-.86)<.001 and abs(n['depthRatio']-.94)<.001 for n in report['checks'])
        assert all(n['scrollbar']!='auto' for n in report['scrollbars'])
        report['pageErrors']=errors
        report['zoomAndClosePassed']=True
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        assert not errors,errors
        print(json.dumps({'npcCount':report['npcCount'],'mapFeatures':report['mapFeatures'],'pageErrors':errors}))
        await browser.close()

asyncio.run(main())
