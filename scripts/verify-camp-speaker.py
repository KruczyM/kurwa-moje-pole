"""Check actual camp table collision and decoded speaker audio in the browser."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        page = await browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('CampAudioQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.npcs', timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=60000)
        await page.evaluate('''async()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);
          const point=g.npcs.getSpeakerWorldPosition();g.camera.position.set(point.x,1.9,point.z+1);
          await g.speakerAudio.play();
        }''')
        await page.wait_for_function('()=>window.__camp_game.speakerAudio.audio.currentTime>0',timeout=15000)
        report = await page.evaluate('''()=>{
          const g=window.__camp_game,table=g.scene.getObjectByName('CampTable');
          const collider=g.world.colliders.find(c=>c.points&&c.box.containsPoint(table.getWorldPosition(g.camera.position.clone())));
          return {speaker:g.npcs.getSpeakerWorldPosition(),audioTime:g.speakerAudio.audio.currentTime,
            audioError:g.speakerAudio.audio.error?.code??null,tableFootprintPoints:collider?.points?.length??0};
        }''')
        report['pageErrors'] = errors
        output = Path(__file__).resolve().parents[1]/'reports/camp-speaker'
        output.mkdir(parents=True,exist_ok=True)
        (output/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report))
        assert report['audioTime'] > 0 and report['audioError'] is None and not errors, report
        await browser.close()

asyncio.run(main())
