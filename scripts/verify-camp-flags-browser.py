"""Verify photo flags in the existing game renderer, not a separate preview."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports/festival-blender/flags'
OUT.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width':1440,'height':900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto('http://localhost:5173/',wait_until='domcontentloaded')
        await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('FlagQA')
        await page.locator('#play').click()
        await page.wait_for_function('() => window.__camp_game?.scene.getObjectByName("AuthoredFestivalWorld")',timeout=120000)
        report = await page.evaluate('''() => {
            const g=window.__camp_game;
            g.networkClient.disconnect(true);g.setPause(true);document.querySelector('#pause').hidden=true;
            const flags=[];
            g.scene.getObjectByName('AuthoredFestivalWorld').traverse(o=>{
                if(Number.isInteger(o.userData.campFlagDesign)) flags.push({name:o.name,design:o.userData.campFlagDesign,
                    camp:o.userData.campFlagCamp,textured:!!o.material?.map,doubleSided:o.material?.side===2});
            });
            g.camera.position.set(-66,18,-80);g.camera.lookAt(-60,9,-115);g.renderer.render(g.scene,g.camera);
            return {flags};
        }''')
        await page.screenshot(path=str(OUT/'camps.png'))
        assert len(report['flags']) == 40, report
        assert all(f['textured'] and f['doubleSided'] for f in report['flags']), report
        assert len({f['design'] for f in report['flags']}) == 40
        report['pageErrors'] = errors
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        assert not errors, errors
        print(json.dumps({'flags':40,'textured':True,'pageErrors':errors}))
        await browser.close()

asyncio.run(main())
