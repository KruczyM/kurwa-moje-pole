"""Verify real video decoding, shared TV maps, cuts, playlist progression and acoustics."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        page=await browser.new_page(viewport={'width':1440,'height':900})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:5173/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('StageVideoQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.stageLiveScreens?.videoPlaylist',timeout=120000)
        loading_audio=await page.evaluate('''()=>{
          const g=window.__camp_game;
          return {state:g.state.current,volume:g.stageAcoustics.getUserVolume(),gain:g.stageAcoustics.masterGain?.gain.value};
        }''')
        assert loading_audio['state']=='loading' and loading_audio['volume']==0 and loading_audio['gain']==0,loading_audio
        await page.wait_for_function('()=>window.__camp_game?.npcs',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=60000)
        await page.evaluate('window.__camp_game.stageLiveScreens.videoPlaylist.play()')
        await page.wait_for_function('()=>window.__camp_game.stageLiveScreens.videoPlaylist.video.currentTime>0',timeout=30000)
        await page.wait_for_function('()=>window.__camp_game.stageAcoustics.masterGain.gain.value>0')
        entered_audio=await page.evaluate('window.__camp_game.stageAcoustics.getUserVolume()')
        report=await page.evaluate('''()=>{
          const g=window.__camp_game;g.networkClient.disconnect(true);g.setPause(true);document.querySelector('#pause').hidden=true;
          const feed=g.stageLiveScreens,playlist=feed.videoPlaylist;
          g.camera.position.set(180,12,22);g.camera.lookAt(215,14,22);
          const first=playlist.currentFile;
          feed.elapsed=29;feed.update(.1,g.renderer,g.camera,[]);
          const videoShared=feed.screens.every(s=>s.material.map===playlist.texture);
          feed.elapsed=30;feed.update(.2,g.renderer,g.camera,[]);
          const audienceShared=feed.screens.every(s=>s.material.map===feed.target.texture);
          const shot=feed.screens[0].userData.liveFeed.shot;
          feed.elapsed=33;feed.update(.2,g.renderer,g.camera,[]);
          const resumed=feed.screens.every(s=>s.material.map===playlist.texture);
          const near=g.stageAcoustics.update({x:220,z:22}),far=g.stageAcoustics.update({x:0,z:0});
          const sourceConnected=!!playlist.source&&!!g.stageAcoustics.masterGain;
          const playback={time:playlist.video.currentTime,width:playlist.video.videoWidth,height:playlist.video.videoHeight,error:playlist.video.error?.code??null};
          playlist.video.dispatchEvent(new Event('ended'));
          return {first,next:playlist.currentFile,videoShared,audienceShared,shot,resumed,near,far,sourceConnected,playback};
        }''')
        report['pageErrors']=errors
        report['loadingAudio']=loading_audio
        report['enteredVolume']=entered_audio
        output=Path(__file__).resolve().parents[1]/'reports/stage-video';output.mkdir(parents=True,exist_ok=True)
        (output/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report))
        assert report['videoShared'] and report['audienceShared'] and report['resumed'] and report['shot']==2,report
        assert report['first']!=report['next'] and report['playback']['width']>0 and report['sourceConnected'] and not errors,report
        await browser.close()

asyncio.run(main())
