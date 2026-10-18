"""Local browser QA with a real host world and a second Socket.IO gameplay client."""
import asyncio
import json
import os
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/flanki-overhaul'


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    errors = []
    env = dict(os.environ, PORT='3901')
    server = subprocess.Popen(['node', '--import', 'tsx', 'server/roomServer.ts'], cwd=ROOT, env=env,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
            host = await browser.new_page(viewport={'width': 1440, 'height': 900})
            host.on('pageerror', lambda error: errors.append(str(error)))
            await host.goto('http://localhost:5173/?server=http://localhost:3901', wait_until='domcontentloaded')
            await host.locator('#player-nickname').fill('FlankiHost')
            await host.locator('#play').click()
            await host.wait_for_function('() => window.__camp_game?.state.current === "playing" && window.__camp_game?.world?.flankiGame && window.__camp_game.networkClient?.isOnline()', timeout=180000)
            await host.evaluate('''() => {
                const g = window.__camp_game;
                const entry = g.world.flankiGame.interactionHitbox.position;
                g.camera.position.set(entry.x, 1.9, entry.z + 1);
                g.interactions.update();
            }''')
            await host.keyboard.press('e')
            try:
                await host.wait_for_selector('#flanki-roster-modal', state='visible')
            except Exception:
                print(await host.evaluate('() => ({state:window.__camp_game.state.current, interaction:window.__camp_game.interactions.current, phase:window.__camp_game.world.flankiGame.getPhase()})'), flush=True)
                print(errors, flush=True)
                raise
            guest = await browser.new_page()
            guest.on('pageerror', lambda error: errors.append(str(error)))
            # A module document establishes the same origin without creating a second WebGL world.
            await guest.goto('http://localhost:5173/src/game/network/NetworkClient.ts')
            await guest.evaluate('''async () => {
                const { NetworkClient } = await import('/src/game/network/NetworkClient.ts');
                const { FlankiGame } = await import('/src/game/interactions/FlankiGame.ts');
                const n = window.peer = new NetworkClient({serverUrl:'http://localhost:3901'});
                const f = window.flanki = new FlankiGame({}, {onSendMultiplayerAction:(a,p)=>n.sendFlankiAction(a,p)});
                n.setNickname('FlankiGuest');
                n.onFlankiLobby(lobby => {
                    if(lobby?.players.some(p=>p.id===n.getMyPlayerId())) {
                        f.configureLobby(lobby,n.getMyPlayerId());
                        if(lobby.phase==='playing') f.startMatch({multiplayer:true,isHost:false});
                    }
                });
                n.onFlankiAction(e=>f.handleNetworkAction(e.action,e.payload,e.playerId,e.sessionId));
                n.connect();
            }''')
            await guest.wait_for_function('() => window.peer.getState()')
            await guest.evaluate("() => window.peer.reserveCharacter('Antena')")
            await guest.wait_for_function("() => window.peer.getState().slots.Antena.status === 'reserving'")
            await guest.evaluate("() => window.peer.confirmCharacter('Antena')")
            await guest.wait_for_function("() => window.peer.getState().slots.Antena.status === 'occupied'")
            await guest.evaluate("() => window.peer.requestFlankiLobby('join')")
            await host.wait_for_function('() => window.__camp_game.networkClient.getFlankiLobby()?.players.length === 2')
            host_id = await host.evaluate('() => window.__camp_game.networkClient.getMyPlayerId()')
            await host.locator('select[data-flanki-runner="A"]').select_option(host_id)
            await host.wait_for_function('() => window.__camp_game.world.flankiGame.isLocalRunner()')
            await host.locator('select[data-flanki-runner="A"]').select_option('kobra')
            await host.wait_for_function('() => !window.__camp_game.world.flankiGame.isLocalRunner()')
            try:
                await host.wait_for_function('() => window.__camp_game.world.flankiGame.arePlayersReady()', timeout=60000)
            except Exception:
                print(json.dumps(await host.evaluate('''() => {const g=window.__camp_game;return {state:g.state.current,
                  players:g.npcs.npcs.filter(n=>n.root.userData.flankiTarget).map(n=>({name:n.name,
                    position:n.root.position.toArray(),target:n.root.userData.flankiTarget.toArray(),
                    waypoints:n.waypoints.map(p=>p.toArray())}))}}'''), ensure_ascii=True), flush=True)
                raise
            await host.screenshot(path=str(OUT / 'lobby.png'))
            await host.locator('#flanki-start-btn').click()
            await host.wait_for_function("() => window.__camp_game.world.flankiGame.getPhase() === 'aiming'")
            await guest.wait_for_function("() => window.peer.getFlankiLobby()?.phase === 'playing'")
            # Pause the main world only to take deterministic pictures; no additional animation loop.
            report = await host.evaluate('''async () => {
                const THREE=await import('/node_modules/.vite/deps/three.js');
                const g=window.__camp_game, f=g.world.flankiGame;
                g.setPause(true); document.querySelector('#pause').hidden=true;
                f.startCharge(); f.update(0.6);
                f.updateThrowHand(g.camera);
                f.updateAimPreview(g.camera.position,g.camera.getWorldDirection(g.camera.position.clone()));
                g.ui.updateFlankiHud(f.getHudState()); g.renderer.render(g.scene,g.camera);
                const actors=[]; for(const [id, actor] of f.actors) { const o=actor.root;
                    const bounds=new THREE.Box3().setFromObject(o,true);
                    actors.push({name:o.name,children:o.children.length,feetY:bounds.min.y,height:bounds.max.y-bounds.min.y,
                      existingNpc:g.npcs.npcs.some(n=>n.root===o)});
                }
                return {actors,handVisible:g.camera.getObjectByName('Flanki_ThrowHand')?.visible,humans:f.roster.teamA.throwers.concat(f.roster.teamB.throwers).filter(p=>p.isHuman).length,lobby:g.networkClient.getFlankiLobby()};
            }''')
            await host.screenshot(path=str(OUT / 'aiming.png'))
            await host.evaluate('''() => {
                const g=window.__camp_game; g.world.flankiGame.updateThrowHand(g.camera);
                g.world.flankiGame.isCharging=false;
                g.world.flankiGame.aiming.hideTrajectory();
                g.camera.getObjectByName('Flanki_ThrowHand').visible=false;
                g.camera.position.set(9,5,-23);g.camera.lookAt(0,1,-26);
                g.renderer.render(g.scene,g.camera);
            }''')
            await host.screenshot(path=str(OUT / 'pitch.png'))
            # A controlled missed host throw advances to B; the real guest then sends its throw.
            await host.evaluate('''() => {
                const g=window.__camp_game, f=g.world.flankiGame;
                g.positionPlayerForFlanki();
                f.startCharge();f.update(0.5);
                f.releaseThrow(g.camera.position,g.camera.position.clone().set(1,0,0));
                for(let i=0;i<250;i++)f.update(0.02);
            }''')
            await guest.wait_for_function("() => window.flanki.getPhase() === 'aiming'", timeout=10000)
            report['guestReceivesTurn'] = True
            await guest.evaluate('''async () => {
                const THREE=await import('/node_modules/.vite/deps/three.js');
                const f=window.flanki;f.startCharge();f.update(0.5);
                f.releaseThrow(new THREE.Vector3(0,1.9,-32),new THREE.Vector3(0,-0.3,1));
            }''')
            await host.wait_for_function("() => window.__camp_game.world.flankiGame.getPhase() === 'projectile_flying'", timeout=10000)
            report['guestThrowAcceptedByHost'] = True
            await guest.evaluate('() => {window.peer.disconnect();window.flanki.dispose();}')
            await host.wait_for_function("() => window.__camp_game.world.flankiGame.getPhase() === 'idle'", timeout=10000)
            report['disconnectEndsMatch'] = True
            report['participantsReleased'] = await host.evaluate('() => window.__camp_game.npcs.npcs.every(n=>!n.root.userData.flankiTarget)')
            await host.evaluate('''() => {
                const g=window.__camp_game,f=g.world.flankiGame;
                g.networkClient.disconnect();g.setPause(false);
                f.prepareOfflineLobby();f.startMatch();g.positionPlayerForFlanki();
            }''')
            await host.keyboard.down('w')
            await host.wait_for_timeout(300)
            await host.keyboard.up('w')
            report['throwerLocked'] = await host.evaluate('() => Math.abs(window.__camp_game.camera.position.z + 20)<.01')
            await host.evaluate('''() => {const f=window.__camp_game.world.flankiGame;
                f.phase='player_drinking';f.tipOverCan();f.runnerB.reset();f.runnerB.runSpeed=.1;}''')
            await host.wait_for_timeout(150)
            report['noAutomaticDrink'] = await host.evaluate('() => window.__camp_game.world.flankiGame.getPlayerBeer()===1')
            await host.keyboard.down('e')
            await host.wait_for_timeout(250)
            await host.keyboard.up('e')
            beer = await host.evaluate('() => window.__camp_game.world.flankiGame.getPlayerBeer()')
            await host.wait_for_timeout(150)
            report['holdEDrinks'] = beer < .99
            report['releaseEStops'] = await host.evaluate('(beer) => Math.abs(window.__camp_game.world.flankiGame.getPlayerBeer()-beer)<.001', beer)
            await host.evaluate('''() => {
                const g=window.__camp_game,f=g.world.flankiGame;f.stopMatch();f.prepareOfflineLobby();
                f.startMatch();g.positionPlayerForFlanki();
                f.updateAimPreview(g.camera.position,g.camera.getWorldDirection(g.camera.position.clone()));
            }''')
            await host.keyboard.down('Space')
            await host.wait_for_function('() => {const s=window.__camp_game.world.flankiGame.getHudState();return s.isCharging && s.throwPower >= s.recommendedPower-.02}', timeout=5000)
            await host.keyboard.up('Space')
            await host.wait_for_function("() => window.__camp_game.world.flankiGame.getPhase()==='player_drinking'", timeout=4000)
            report['keyboardThrowHits'] = True
            await host.evaluate('''() => {const g=window.__camp_game,f=g.world.flankiGame;
                f.stopMatch();f.prepareOfflineLobby();f.selectRunner('A','player');f.startMatch();
                g.positionPlayerForFlanki();f.roster.advanceTurn();f.phase='bot_drinking';f.tipOverCan();f.update(.01);
            }''')
            await host.keyboard.down('a')
            await host.wait_for_function('() => window.__camp_game.camera.position.x < .3', timeout=4000)
            await host.keyboard.up('a')
            await host.keyboard.down('w')
            await host.wait_for_function('() => Math.abs(window.__camp_game.camera.position.z+26)<.9', timeout=4000)
            await host.keyboard.up('w')
            await host.keyboard.press('e')
            report['runnerPicksUp'] = await host.evaluate('() => window.__camp_game.world.flankiGame.isCanUpright()')
            await host.keyboard.down('s')
            await host.wait_for_function('() => window.__camp_game.world.flankiGame.roster.getTurnIndex()===2', timeout=4000)
            await host.keyboard.up('s')
            report['runnerReturnStops'] = await host.evaluate('() => window.__camp_game.world.flankiGame.shouldLockPlayerMovement()')
            await host.evaluate('() => window.__camp_game.world.flankiGame.stopMatch()')
            await host.evaluate('''() => {
                const g=window.__camp_game, r=g.wheelRideController;
                g.setPause(false); g.world.getWheel().setScheduleTime(0);
                g.camera.position.copy(r.getBoardingPoint(true));
                g.camera.rotation.set(0,0,0);g.player.yaw=0;g.player.pitch=0;
                g.camera.updateMatrixWorld(true);g.interactions.update();
            }''')
            await host.keyboard.press('e')
            report['wheel'] = await host.evaluate('''() => {
                const g=window.__camp_game,r=g.wheelRideController,w=g.world.getWheel();
                r.update(.3);const bottomY=g.camera.position.y;
                const boarded=!r.isIdle();w.setScheduleTime(30);r.update(.1);
                const ridingY=g.camera.position.y;r.cancelToGround();
                return {boarded,bottomY,ridingY,returned:r.isIdle(),exitX:g.camera.position.x};
            }''')
            report['pageErrors'] = errors
            assert report['handVisible'] and report['humans'] == 2
            assert all(actor['children'] > 0 for actor in report['actors'])
            assert len(report['actors']) == 4 and all(actor['existingNpc'] for actor in report['actors']), report['actors']
            assert report['participantsReleased'] and report['wheel']['boarded'] and report['wheel']['returned'], report
            assert all(report[key] for key in ['throwerLocked','noAutomaticDrink','holdEDrinks','releaseEStops','keyboardThrowHits','runnerPicksUp','runnerReturnStops']), report
            assert not errors, errors
            (OUT / 'browser-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
            print(json.dumps(report, ensure_ascii=True))
            await browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)


asyncio.run(main())
