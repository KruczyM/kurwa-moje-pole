"""Read-only browser smoke test for the migrated world; no account/API access."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/festival-blender/runtime'
OUT.mkdir(parents=True, exist_ok=True)

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://localhost:5173/', wait_until='domcontentloaded')
        await page.locator('#player-nickname').fill('WorldTest')
        await page.locator('#play').click()
        await page.wait_for_function('() => window.__camp_game?.world && window.__camp_game?.player', timeout=180000)
        await page.wait_for_timeout(1500)
        report = await page.evaluate('''() => {
          const g = window.__camp_game;
          const authored = g.scene.getObjectByName('AuthoredFestivalWorld');
          const placements = [];
          let batches = 0;
          authored.traverse(o => { if(o.userData.runtimePlacement) placements.push(o); if(o.isInstancedMesh) batches++; });
          const gates = g.world.interactables.filter(i=>i.action==='patrol_checkpoint');
          const wheel = g.world.getWheel();
          const before = wheel?.getAngle();
          wheel?.update(20);
          const wheelMoves = wheel && wheel.getAngle() !== before;
          const gateWalkable = gates.map(i=>g.world.canMove(i.object.position.x, i.object.position.z));
          const barriers = placements.filter(o=>String(o.userData.runtimePlacement).startsWith('StageBarrier_'));
          const blockedBarriers = barriers.map(o=>{ const v=o.getWorldPosition(g.camera.position.clone()); return !g.world.canMove(v.x,v.z); });
          const spawnWalkable = g.world.canMove(g.camera.position.x,g.camera.position.z);
          const seat = g.world.interactables.find(i=>i.action==='seat');
          const seatUsable = seat ? g.seatController.start(seat.object.userData.interaction) : false;
          g.seatController.stop();
          return {placements:placements.length,batches,barriers:barriers.length,gates:gates.length,gateWalkable,barriersBlocked:blockedBarriers.every(Boolean),seats:g.world.interactables.filter(i=>i.action==='seat').length,seatUsable,doors:g.world.interactables.filter(i=>i.action==='toitoi_door').length,wheelMoves:!!wheelMoves,spawnWalkable,renderer:g.renderer.info.render};
        }''')
        await page.evaluate('''() => { const g=window.__camp_game; g.setPause(true);document.querySelector('#pause').hidden=true; g.camera.position.set(140,85,120);g.camera.lookAt(205,0,18);g.renderer.render(g.scene,g.camera); }''')
        await page.screenshot(path=str(OUT / 'stage.png'))
        await page.evaluate('''() => { const g=window.__camp_game;g.camera.position.set(-60,30,-105);g.camera.lookAt(-60,0,-120);g.renderer.render(g.scene,g.camera); }''')
        await page.screenshot(path=str(OUT / 'camp.png'))
        await page.evaluate('''() => { const g=window.__camp_game;g.camera.position.set(0,12,-18);g.camera.lookAt(0,0,-43);g.renderer.render(g.scene,g.camera); }''')
        await page.screenshot(path=str(OUT / 'passage.png'))
        report['pageErrors'] = errors
        (OUT / 'browser-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report))
        await browser.close()

asyncio.run(main())
