"""Check existing crowd actors, navigation, line positions and throw poses in Chromium."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(os.environ.get('FLANKI_QA_URL', 'http://localhost:5173/'), wait_until='domcontentloaded')
        await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        available = page.locator('#character-select button:not([disabled])').first
        await available.click()
        await page.locator('#player-nickname').fill('FormationQA')
        await page.locator('#play').click()
        try:
            await page.wait_for_function('() => window.__camp_game?.world?.flankiGame && window.__camp_game?.npcs?.npcs.length', timeout=30000)
        except Exception:
            print(json.dumps(await page.evaluate('''() => ({state:window.__camp_game?.state.current,
                error:document.querySelector('#load-error')?.textContent,
                nicknameError:document.querySelector('#nickname-error')?.textContent})''')), flush=True)
            await browser.close()
            raise
        await page.evaluate('''() => {
            const g=window.__camp_game, f=g.world.flankiGame;
            g.networkClient.disconnect(); f.prepareOfflineLobby();
            if (g.state.current === 'paused') g.state.transition('playing');
            f.enlistNearbyNpcs(g.npcs.reserveFlankiPlayers(f.canPosition));
            g.camera.position.set(f.canPosition.x, 1.9, f.playerLineZ+2);
        }''')
        try:
            await page.wait_for_function('() => window.__camp_game.world.flankiGame.arePlayersReady()', timeout=90000)
            report = await page.evaluate('''() => {
                const g=window.__camp_game,f=g.world.flankiGame;
                f.startMatch(); f.update(.02);
                const actors=[...f.borrowedActors.entries()].map(([id,a])=>({id,existing:g.npcs.npcs.some(n=>n.root===a.root),
                    position:a.root.position.toArray(),target:a.root.userData.flankiTarget.toArray(),
                    bearingError:Math.abs(Math.atan2(Math.sin(a.root.rotation.y-Math.atan2(f.canPosition.x-a.root.position.x,f.canPosition.z-a.root.position.z)),
                        Math.cos(a.root.rotation.y-Math.atan2(f.canPosition.x-a.root.position.x,f.canPosition.z-a.root.position.z))))}));
                const id=f.roster.teamA.throwers.find(p=>!p.isHuman).id;
                f.animateThrow(id);f.update(.15);
                return {actors,throwPoseActive:f.throwPoses.get(id)?.active};
            }''')
            assert len(report['actors']) == 5, report
            assert all(a['existing'] and a['bearingError'] < .001 and a['position'] == a['target'] for a in report['actors']), report
            assert report['throwPoseActive'], report
            feet = await page.evaluate('''async () => {
                const {Box3}=await import('/node_modules/three/build/three.module.js');
                const g=window.__camp_game, remote=g.remotePlayersManager;
                remote.handleWorldSnapshot({timestamp:Date.now(),players:['Amper','Krwiak','Kobra','Chlebak'].map((character,index)=>({
                    playerId:'formation-avatar-'+index,character,nickname:character,
                    transform:{position:[-3+index*2,0,-22],yaw:0,locomotion:'Run',speed:5,timestamp:Date.now()}}))});
                const samples=[];
                for(let frame=0;frame<20;frame++) {
                    remote.update(.025,g.camera);
                    for(const entity of remote.remotePlayers.values()) {
                        const bounds=new Box3().setFromObject(entity.root,true);
                        samples.push({character:entity.characterName,hasModel:!!entity.animator,error:Math.abs(bounds.min.y-entity.root.position.y)});
                    }
                }
                g.camera.position.set(0,1.9,-29);g.player.yaw=Math.PI;g.player.pitch=-.1;
                g.camera.rotation.set(-.1,Math.PI,0,'YXZ');g.setPause(true);
                document.querySelector('#pause').hidden=true;
                return samples;
            }''')
            assert all(s['hasModel'] and s['error'] < .02 for s in feet), feet
            report['remoteAnimatedFeetGrounded'] = True
            report['maxRemoteFeetError'] = max(s['error'] for s in feet)
            out = Path(__file__).resolve().parents[1] / 'reports/flanki-overhaul'
            out.mkdir(parents=True, exist_ok=True)
            await page.screenshot(path=str(out / 'formation-world.png'))
            await page.evaluate('() => window.__camp_game.networkClient.connect("http://localhost:3001", "formation-overlay-qa")')
            await page.wait_for_function('() => window.__camp_game.networkClient.isOnline()')
            for overlay in ['guide', 'pause']:
                await page.evaluate('''overlay => {
                    const g=window.__camp_game,f=g.world.flankiGame;
                    g.setPause(false);g.toggleGuide(false);
                    f.phase='projectile_flying';f.flightSeconds=0;f.physicsAccumulator=0;
                    f.projectilePos.set(8,2,-22);f.projectileVel.set(0,0,-2);f.projectileMesh.visible=true;
                    if(overlay==='guide')g.toggleGuide(true);else g.setPause(true);
                }''', overlay)
                await page.wait_for_function('() => window.__camp_game.world.flankiGame.flightSeconds > .15', timeout=5000)
                report[overlay+'KeepsSharedSimulationRunning'] = True
            await page.evaluate('() => {const g=window.__camp_game;g.setPause(false);g.toggleGuide(false);}')
            assert not errors, errors
            result = {'status': 'passed', **report, 'errors': errors}
            (out / 'formation-world.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
            print(json.dumps(result))
        except Exception:
            print(json.dumps(await page.evaluate('''() => {const g=window.__camp_game; return {
                state:g?.state.current, actors:g?.npcs.npcs.filter(n=>n.root.userData.flankiTarget).map(n=>({name:n.name,
                    position:n.root.position.toArray(),target:n.root.userData.flankiTarget.toArray(),
                    waypoints:n.waypoints.map(p=>p.toArray()),stalled:n.root.userData.flankiStalled}))};}''')))
            raise
        finally:
            await browser.close()


asyncio.run(main())
