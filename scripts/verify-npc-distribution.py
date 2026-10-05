"""Read-only browser smoke test for streamed festival crowd placement."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('CrowdQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs', timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.npcs?.npcs.filter(n=>!n.isCampMember).length===91', timeout=180000)
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=60000)
        report = await page.evaluate('''()=>{
            const g=window.__camp_game;g.networkClient.disconnect(true);
            g.npcs.update(1/60, performance.now()/1000, g.camera.position);
            const crowd=g.npcs.npcs.filter(n=>!n.isCampMember);
            return {dancers:crowd.filter(n=>n.festivalRole==='stage_dancer').length,
              lower:crowd.filter(n=>n.passageWalker&&n.passageLane==='lower').length,
              upper:crowd.filter(n=>n.passageWalker&&n.passageLane==='upper').length,
              dancing:crowd.filter(n=>n.festivalRole==='stage_dancer'&&n.animator?.activityActive).length,
              unwalkable:crowd.filter(n=>!g.world.canMove(n.root.position.x,n.root.position.z)).map(n=>n.name)};
        }''')
        report['pageErrors'] = errors
        output = Path(__file__).resolve().parents[1] / 'reports/npc-distribution'
        output.mkdir(parents=True, exist_ok=True)
        (output / 'browser-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report))
        assert report['dancers'] == 20 and report['lower'] == 20 and report['upper'] == 51, report
        assert report['dancing'] == 20 and not errors, report
        await browser.close()

asyncio.run(main())
