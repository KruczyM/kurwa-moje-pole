"""Production-build telebim QA with mobile Chromium and WebKit; not physical iPhone QA."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/mobile-stage-video'
STATE = """()=>{const g=window.__camp_game,f=g.stageLiveScreens,p=f.videoPlaylist,v=p.video;return {screens:f.screens.length,liveCameraEnabled:f.liveCameraEnabled,muted:v.muted,paused:v.paused,ready:v.readyState,time:v.currentTime,width:v.videoWidth,height:v.videoHeight,error:v.error?.message,context:p.context?.state,audioAvailable:typeof AudioContext!=="undefined",texture:f.screens[0].material.map.name,shared:f.screens[0].material.map===f.screens[1].material.map,screenLayers:f.screens.map(s=>s.layers.isEnabled(0)),activeArea:g.sectorStreamer.activeArea,position:g.camera.position.toArray(),residents:f.screens.map(s=>({area:g.world.mobileResidentMeshes.find(e=>e.mesh===s)?.area,position:s.getWorldPosition(g.camera.position.clone()).toArray()})),src:v.currentSrc};}"""

async def run(engine):
    args={'headless':True}
    if engine.name=='chromium': args['args']=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist','--autoplay-policy=document-user-activation-required']
    browser=await engine.launch(**args)
    page=await browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        await page.goto('http://127.0.0.1:5174/kurwa-moje-pole/')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        await page.locator('#player-nickname').fill('StageVideoQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=180000)
        print(engine.name+' entered world',flush=True)
        await page.evaluate("""async()=>{
            const g=window.__camp_game;g.networkClient.disconnect(true);g.player.stop();
            await g.sectorStreamer.enterArea('main-stage');g.world.setMobileArea('main-stage');
            g.camera.position.set(175,1.9,-18);g.player.yaw=-Math.PI/2;g.player.pitch=0.42;
        }""")
        await page.wait_for_function('()=>{const v=window.__camp_game.stageLiveScreens.videoPlaylist.video;return v.readyState>=2 && v.currentTime>0}',timeout=45000)
        before=await page.evaluate(STATE)
        await page.locator('#game').tap(position={'x':195,'y':350},force=True)
        await page.wait_for_function('()=>!window.__camp_game.stageLiveScreens.videoPlaylist.video.paused',timeout=15000)
        if before['audioAvailable']:
            await page.wait_for_function('()=>window.__camp_game.stageLiveScreens.videoPlaylist.context?.state==="running"',timeout=15000)
        start=await page.evaluate('window.__camp_game.stageLiveScreens.videoPlaylist.video.currentTime')
        await page.wait_for_function('(time)=>window.__camp_game.stageLiveScreens.videoPlaylist.video.currentTime>time+.3',arg=start,timeout=15000)
        after=await page.evaluate(STATE)
        assert after['shared'] and after['texture']=='StageConcertVideo' and after['screenLayers']==[True,True],after
        assert after['width']>0 and after['height']>0 and not after['liveCameraEnabled'],after
        await page.screenshot(path=str(OUT/f'{engine.name}-stage.png'))
        # Sample an actual decoded frame independently of the model UVs.
        frame=await page.evaluate("""()=>{
            const v=window.__camp_game.stageLiveScreens.videoPlaylist.video,c=document.createElement('canvas');
            c.width=64;c.height=36;const ctx=c.getContext('2d');ctx.drawImage(v,0,0,64,36);
            const data=ctx.getImageData(0,0,64,36).data;let min=255,max=0;
            for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}
            return {min,max};
        }""")
        assert frame['max']>frame['min'],frame
        assert not errors,errors
        report={'engine':engine.name,'beforeGesture':before,'afterGesture':after,'decodedFrame':frame,'pageErrors':errors,'physicalPhone':'VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN'}
        (OUT/f'{engine.name}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report),flush=True)
        return report
    except Exception:
        try:
            print(engine.name+' failure state '+json.dumps(await page.evaluate(STATE)),flush=True)
            await page.screenshot(path=str(OUT/f'{engine.name}-failure.png'))
        finally: raise
    finally: await browser.close()

async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        results=[]
        for engine in [p.chromium,p.webkit]: results.append(await run(engine))
        (OUT/'browser-report.json').write_text(json.dumps(results,indent=2),encoding='utf-8')

asyncio.run(main())
