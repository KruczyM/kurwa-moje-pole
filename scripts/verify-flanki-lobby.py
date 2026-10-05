"""Two real browser NetworkClients and actual roster UI, without a second heavy world."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]

async def main():
    server = subprocess.Popen(['node', '--import', 'tsx', 'server/roomServer.ts'], cwd=ROOT,
        env=dict(os.environ, PORT='3903'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            errors = []
            pages = []
            for name, character in [('FlankiHost', 'Amper'), ('FlankiGuest', 'Antena')]:
                context = await browser.new_context()
                page = await context.new_page(); pages.append(page)
                page.on('pageerror', lambda error: errors.append(str(error)))
                await page.goto('http://localhost:5173/src/game/network/NetworkClient.ts')
                await page.set_content('''<link rel="stylesheet" href="/src/ui-additions.css">
                    <section id="flanki-roster-modal" class="flanki-roster-modal" hidden><div class="flanki-roster-content">
                    <div class="flanki-roster-header"></div><div class="flanki-teams"><div class="team-a"><h3></h3><ul id="flanki-team-a-players"></ul></div>
                    <div class="team-b"><h3></h3><ul id="flanki-team-b-players"></ul></div></div>
                    <button id="flanki-start-btn">START</button><button id="flanki-cancel-btn">CANCEL</button></div></section>''')
                await page.evaluate('''async ({name,character}) => {
                    const {NetworkClient}=await import('/src/game/network/NetworkClient.ts');
                    const {FlankiGame}=await import('/src/game/interactions/FlankiGame.ts');
                    const {UIManager}=await import('/src/game/ui/UIManager.ts');
                    window.peer=new NetworkClient({serverUrl:'http://localhost:3903',roomId:'browser-flanki'});
                    peer.setNickname(name);window.f=new FlankiGame();window.ui=new UIManager();window.rejections=[];
                    peer.onError(e=>rejections.push(e.message));
                    f.setCallbacks({onSendMultiplayerAction:(action,payload)=>peer.sendFlankiAction(action,payload)});
                    window.events=[];
                    peer.onFlankiAction(e=>{events.push(e.action);f.handleNetworkAction(e.action,e.payload,e.playerId,e.sessionId);});
                    peer.onFlankiLobby(lobby=>{if(!lobby||!lobby.players.some(p=>p.id===peer.getMyPlayerId()))return;
                        f.configureLobby(lobby,peer.getMyPlayerId());
                        if(lobby.phase==='waiting')ui.showFlankiRoster(f.roster,()=>{peer.requestFlankiLobby('start');return false;},()=>{},
                            {canStart:lobby.hostId===peer.getMyPlayerId(),localTeam:lobby.players.find(p=>p.id===peer.getMyPlayerId()).team,
                             onRunnerChange:(team,runnerId)=>peer.requestFlankiLobby('runner',{team,runnerId})});
                        else {f.startMatch({multiplayer:true,isHost:lobby.hostId===peer.getMyPlayerId()});ui.hideFlankiRoster();}
                    });peer.connect();window.character=character;
                }''', {'name': name, 'character': character})
                await page.wait_for_function('() => peer.getState() && peer.isOnline()')
                await page.evaluate('() => peer.reserveCharacter(character)')
                await page.wait_for_function('() => peer.getState().slots[character].status === "reserving"')
                assert await page.evaluate('() => peer.requestFlankiLobby("join")')
                await page.wait_for_selector('#flanki-roster-modal', state='visible')
            host, guest = pages
            await host.wait_for_function('() => peer.getFlankiLobby()?.players.length === 2')
            await host.locator('[data-flanki-runner="A"]').select_option('antena')
            await host.wait_for_function('() => f.roster.teamA.runner.id === "antena" && document.querySelector("#flanki-team-a-players").textContent.includes("Antena —")')
            host_id = await host.evaluate('() => peer.getMyPlayerId()')
            await host.locator('[data-flanki-runner="A"]').select_option(host_id)
            await host.wait_for_function('() => document.querySelector("#flanki-team-a-players").textContent.includes("FlankiHost — STAŁY BIEGACZ")')
            await guest.wait_for_function('() => f.roster.teamA.runner.name === "FlankiHost"')
            guest_id = await guest.evaluate('() => peer.getMyPlayerId()')
            await host.locator('[data-flanki-runner="B"]').select_option(guest_id)
            await host.wait_for_function('() => f.roster.teamB.runner.name === "FlankiGuest"')
            assert await guest.locator('[data-flanki-runner="A"]').is_disabled()
            await host.locator('#flanki-start-btn').click()
            await guest.wait_for_function('() => peer.getFlankiLobby()?.phase === "playing"')
            await host.wait_for_function('() => f.isMultiplayer && f.isHost && peer.getFlankiLobby()?.phase === "playing"')
            await host.evaluate('''() => { f.phase='player_drinking';f.tipOverCan();f.update(.15);
                window.runnerStart=f.runnerB.currentPosition.clone();f.update(.5); }''')
            try:
                await guest.wait_for_function('() => f.canLocalRunnerMove()', timeout=5000)
            except Exception:
                print(await guest.evaluate('() => ({phase:f.phase,runner:f.roster.teamB.runner,turn:f.roster.getCurrentThrower(),events,rejections})'), flush=True)
                print(await host.evaluate('() => ({phase:f.phase,host:f.isHost,multiplayer:f.isMultiplayer,runner:f.roster.teamB.runner,rejections})'), flush=True)
                raise
            assert await host.evaluate('() => f.roster.teamA.runner.isHuman && f.roster.teamB.runner.isHuman && !f.runnerA.mesh && !f.runnerB.mesh && f.runnerB.currentPosition.equals(runnerStart)')
            for page in pages:
                await page.evaluate('() => peer.sendPlayerUpdate({position:[0,0,0],yaw:0,locomotion:"Idle",speed:0,timestamp:Date.now()})')
            await host.wait_for_function('() => peer.getLatestSnapshot()?.players.length === 2')
            await guest.evaluate('() => peer.disconnect(true)')
            await host.wait_for_function('() => peer.getLatestSnapshot()?.players.length === 1 && peer.getState().slots.Antena.status === "free" && peer.getFlankiLobby() === null')
            report = {'twoBrowserClientsJoined': True, 'reservingCharacterConfirmedOnJoin': True,
                      'runnerLabelsUpdatedForBothClients': True, 'hostOnlyChanges': True,
                      'guestEnteredMatch': True, 'humanRunnersPreserved': True,
                      'humanRunnerMovesOnlyWithPlayerInput': True, 'closedClientRemovedFromWorldAndLobby': True,
                      'releasedCharacterImmediatelyAvailable': True, 'errors': errors}
            assert not errors, errors
            out = ROOT / 'reports/flanki-overhaul'; out.mkdir(parents=True, exist_ok=True)
            (out / 'lobby-regressions.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            print(json.dumps(report))
            await browser.close()
    finally:
        server.terminate(); server.wait(timeout=10)

asyncio.run(main())
