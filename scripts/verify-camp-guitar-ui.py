"""Real E-to-speaker plus clickable, responsive guitar menus."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        page=await browser.new_page(viewport={'width':1280,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('GuitarQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=60000)
        speaker=await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);g.player.stop();
          g.npcs.npcs.forEach(n=>n.root.visible=false);
          const point=g.npcs.getSpeakerWorldPosition();g.camera.position.set(point.x,1.9,point.z+1);
          g.camera.lookAt(point.x,.7,point.z);g.camera.updateMatrixWorld(true);
          g.speakerAudio.stopImmediate();
          const interaction=g.interactions.update();
          g.key(new KeyboardEvent('keydown',{key:'e',code:'KeyE'}));
          return {interaction,source:g.speakerAudio.audio.src};
        }''')
        assert speaker['interaction']['kind']=='speaker',speaker
        await page.wait_for_function('()=>window.__camp_game.speakerAudio.audio.currentTime>0&&!window.__camp_game.speakerAudio.audio.paused',timeout=15000)
        guitar=await page.evaluate('''()=>{
          const g=window.__camp_game;
          const trigger=g.world.interactables.find(i=>i.action==='campfire_guitar').object;
          const point=trigger.getWorldPosition(g.camera.position.clone());
          g.camera.position.set(point.x,point.y+.3,point.z+1);g.camera.lookAt(point);g.camera.updateMatrixWorld(true);
          const interaction=g.interactions.update();g.key(new KeyboardEvent('keydown',{key:'e',code:'KeyE'}));
          return interaction;
        }''')
        assert guitar['kind']=='campfire_guitar',guitar
        await page.locator('.guitar-song-option').first.wait_for(state='visible')
        output=Path(__file__).resolve().parents[1]/'reports/camp-guitar-ui';output.mkdir(parents=True,exist_ok=True)
        viewports=[]
        for width,height in [(360,640),(800,450)]:
          await page.set_viewport_size({'width':width,'height':height})
          box=await page.locator('#guitar-hud').bounding_box()
          assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,box
          await page.locator('[data-song-id="zegarmistrz-midi"]').click()
          await page.wait_for_function('()=>window.__camp_game.campfireGuitarGame.getPhase()==="playing"')
          await page.screenshot(path=str(output/f'guitar-{width}.png'))
          await page.locator('#guitar-exit-btn').click()
          await page.wait_for_function('()=>window.__camp_game.campfireGuitarGame.getPhase()==="idle"')
          viewports.append({'width':width,'height':height,'bounds':box,'selectionAndExit':True})
          await page.evaluate('window.__camp_game.campfireGuitarGame.openSongSelect()')
          await page.locator('.guitar-song-option').first.wait_for(state='visible')
        imported=[]
        for song_id in ['zegarmistrz-midi','czarny-chleb-midi','pila-tango-midi','sen-victoria-midi','czerwony-cegla-midi']:
          await page.locator(f'[data-song-id="{song_id}"]').click()
          await page.wait_for_function('()=>window.__camp_game.campfireGuitarGame.getPhase()==="playing"')
          imported.append(song_id)
          await page.locator('#guitar-exit-btn').click()
          await page.evaluate('window.__camp_game.campfireGuitarGame.openSongSelect()')
          await page.locator('.guitar-song-option').first.wait_for(state='visible')
        report={'speaker':speaker,'guitarInteraction':guitar,'viewports':viewports,'importedSongsPlayable':imported,'pageErrors':errors}
        (output/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report));assert not errors,errors
        await browser.close()

asyncio.run(main())
