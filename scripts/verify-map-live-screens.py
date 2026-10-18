"""Browser QA of the real menu map and both stage live-feed meshes."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OUT=Path(__file__).resolve().parents[1]/'reports/festival-blender/map-live-screens'
OUT.mkdir(parents=True,exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'])
        page=await browser.new_page(viewport={'width':1440,'height':1000})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:5173/',wait_until='domcontentloaded')
        await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
        async with page.expect_response(lambda r:'map-top.png' in r.url and r.status==200):
            await page.locator('#start-map-btn').click()
        await page.wait_for_timeout(1200)
        before=await page.evaluate('localStorage.getItem("festival_my_tent_marker")')
        await page.locator('#festival-map-canvas').click(position={'x':100,'y':100})
        after=await page.evaluate('localStorage.getItem("festival_my_tent_marker")')
        assert before==after,'Map click moved the persisted tent marker'
        await page.screenshot(path=str(OUT/'menu-map.png'))
        await page.locator('#map-close').click()
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('LiveFeedQA')
        await page.locator('#play').click()
        await page.wait_for_function('()=>window.__camp_game?.scene.getObjectByName("AuthoredFestivalWorld")',timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn").click()')
        await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"',timeout=60000)
        report=await page.evaluate('''() => {
            const g=window.__camp_game;
            g.networkClient.disconnect(true);g.setPause(true);document.querySelector('#pause').hidden=true;
            const feed=g.stageLiveScreens;
            g.camera.position.set(100,17,21.5);g.camera.lookAt(203,12,21.5);
            return {screens:feed.screens.map(s=>({name:s.userData.runtimeNode??s.userData.runtimePlacement,visible:s.visible,
                dynamic:s.userData.authoredDynamic,texture:s.material.map.name})),
                sameTexture:feed.screens[0].material.map===feed.screens[1].material.map,
                mapBounds:g.festivalMap.topViewBounds,imageWidth:g.festivalMap.topView?.naturalWidth,
                mapLabels:g.festivalMap.getLandmarks().map(l=>({id:l.id,label:l.label,x:l.x,z:l.z}))};
        }''')
        assert len(report['screens'])==2 and report['sameTexture'],report
        assert all(s['visible'] and s['dynamic'] for s in report['screens']),report
        assert report['imageWidth']==1600,report
        assert {'siema_shop','food_south','food_pomorze'}.issubset({l['id'] for l in report['mapLabels']}),report
        report['mapClickDoesNotMoveTent']=True
        report['shots']=[]
        for shot in range(5):
            data=await page.evaluate('''shot=>{
                const g=window.__camp_game,feed=g.stageLiveScreens;
                feed.elapsed=shot*30+1;feed.shot=-1;
                feed.update(.2,g.renderer,g.camera,[]);
                const bytes=new Uint8Array(512*288*4);
                g.renderer.readRenderTargetPixels(feed.target,0,0,512,288,bytes);
                let min=255,max=0,sum=0;
                for(let i=0;i<bytes.length;i+=4){min=Math.min(min,bytes[i]);max=Math.max(max,bytes[i]);sum+=bytes[i];}
                g.renderer.render(g.scene,g.camera);
                return {shot:feed.screens[0].userData.liveFeed,camera:feed.camera.position.toArray(),min,max,sum};
            }''',shot)
            assert data['max']>data['min'],data
            report['shots'].append(data)
            await page.screenshot(path=str(OUT/f'stage-shot-{shot}.png'))
        followed=await page.evaluate('''()=>{
            const g=window.__camp_game,feed=g.stageLiveScreens;
            feed.elapsed=121;feed.shot=-1;
            feed.update(.2,g.renderer,g.camera,[{id:'qa-player',name:'Camera target QA',x:7,z:11}]);
            return feed.camera.position.toArray();
        }''')
        assert followed==[7,18,11],followed
        report['syntheticMarkerFollow']=followed
        local=await page.evaluate('''()=>{
            const g=window.__camp_game,feed=g.stageLiveScreens;
            feed.elapsed=121;feed.shot=-1;
            feed.update(.2,g.renderer,g.camera,[],{id:'qa-local',name:'Local QA',x:7,z:11,yaw:0});
            return {camera:feed.camera.position.toArray(),hiddenAfterCapture:!g.scene.getObjectByName('StageLiveLocalAvatar').visible};
        }''')
        assert local['camera']==[7,18,11] and local['hiddenAfterCapture'],local
        report['localAvatarCapture']=local
        report['multiplayerHumanVerification']='VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN: two actual logged clients'
        await page.evaluate('window.__camp_game.toggleMap(true)')
        await page.screenshot(path=str(OUT/'game-map.png'))
        report['pageErrors']=errors
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        assert not errors,errors
        print(json.dumps({'screens':len(report['screens']),'shots':len(report['shots']),'pageErrors':errors}))
        await browser.close()

asyncio.run(main())
