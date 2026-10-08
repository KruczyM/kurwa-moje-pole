"""Desktop-host WebKit/Chromium with iPhone viewport: not a physical iOS memory limit test."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

SIZES = [(360,800),(390,844),(412,915),(768,1024),(844,390),(1024,768)]
PANELS = ['start','loading','pause','inventory','dialog','inspect','effect-warning','festival-guide',
          'festival-map','flanki-roster-modal','eco-panel','guitar-hud','guitar-song-select-modal']

async def verify(engine, name, options):
    launch = {'headless':True}
    if name == 'chromium':
        launch['args']=['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']
    browser = await engine.launch(**launch)
    context = await browser.new_context(**options)
    page = await context.new_page()
    errors=[]; urls=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('request', lambda r:urls.append(r.url))
    output=Path(__file__).resolve().parents[1]/'reports'/'iphone-audit'
    output.mkdir(parents=True,exist_ok=True)
    await page.goto('http://127.0.0.1:5182/?server=http://127.0.0.1:3102')
    await page.wait_for_function('()=>typeof document.querySelector("#play")?.onclick==="function"')
    layouts=[]
    for width,height in SIZES:
        await page.set_viewport_size({'width':width,'height':height})
        for panel in PANELS:
            result=await page.evaluate('''id=>{
              const p=document.getElementById(id),saved=[...document.querySelectorAll('#ui > section')].map(e=>[e,e.hidden]);
              saved.forEach(([e])=>e.hidden=true);const parents=[];
              for(let e=p;e&&e.id!=='ui';e=e.parentElement){parents.push([e,e.hidden]);e.hidden=false;}
              const r=p.getBoundingClientRect(),result={id,overflow:p.scrollWidth-p.clientWidth,
                outside:r.x < -1||r.y < -1||r.right>innerWidth+1||r.bottom>innerHeight+1};
              parents.forEach(([e,h])=>e.hidden=h);saved.forEach(([e,h])=>e.hidden=h);return result;
            }''',panel)
            layouts.append({'size':[width,height],**result})
    await page.set_viewport_size({'width':390,'height':844})
    await page.locator('#player-nickname').fill('iPhone'+name)
    await page.evaluate('()=>localStorage.setItem("camp-audio-settings",JSON.stringify({speakerEnabled:true,speakerVolume:0.7,ambientVolume:0.3}))')
    await page.locator('#play').click()
    await page.wait_for_function('()=>window.__camp_game?.state.current==="playing"', timeout=240000)
    await page.wait_for_function('()=>window.__camp_game?.npcs.npcs.length===40')
    await page.wait_for_timeout(1500)
    camp=await page.evaluate('''()=>{
      const g=window.__camp_game,c=g.camera,position=c.position.clone(),rotation=c.quaternion.clone();
      const marker=g.npcs.speakerAnchor.getObjectByName('SpeakerStatusIndicator');
      const result={speakerPlaying:g.speakerAudio.isPlaying,symbol:marker.userData.symbol,items:[]};
      for(const item of g.world.interactables.filter(i=>i.action==='item')){
        const hitbox=item.object.children.find(o=>o.name.startsWith('InteractionHitbox_'));
        const target=hitbox.getWorldPosition(position.clone());let reachable=null;
        for(const radius of [0.65,1,1.4,1.8,2.2,2.6]){
          for(let angle=0;angle<32&&!reachable;angle++){
            const x=target.x+Math.cos(angle*Math.PI/16)*radius,z=target.z+Math.sin(angle*Math.PI/16)*radius;
            if(!g.world.canMove(x,z))continue;
            c.position.set(x,target.y+0.78,z);c.lookAt(target);c.updateMatrixWorld(true);
            const hit=g.interactions.update();
            if(hit?.kind==='item'&&hit.itemId===item.itemId)reachable={x,z,radius};
          }
          if(reachable)break;
        }
        result.items.push({id:item.itemId,reachable});
      }
      c.position.copy(position);c.quaternion.copy(rotation);c.updateMatrixWorld(true);g.interactions.clear();
      return result;
    }''')
    assert camp['speakerPlaying'] is False and camp['symbol']=='-', camp
    assert len(camp['items'])==8 and all(i['reachable'] for i in camp['items']), camp
    await page.evaluate('''()=>{
      const g=window.__camp_game,c=g.camera;
      g.__auditCamera={position:c.position.clone(),quaternion:c.quaternion.clone()};
      const p=g.npcs.speakerAnchor.getWorldPosition(c.position.clone());
      c.position.set(p.x,p.y+1.9,p.z+1.1);c.lookAt(p.x,p.y+0.35,p.z);c.updateMatrixWorld(true);
      g.interactions.update();
    }''')
    await page.locator('#mobile-interact').tap()
    await page.wait_for_function('()=>window.__camp_game.npcs.speakerAnchor.getObjectByName("SpeakerStatusIndicator").userData.symbol==="+"')
    await page.locator('#mobile-interact').tap()
    await page.wait_for_function('()=>!window.__camp_game.speakerAudio.isPlaying&&window.__camp_game.npcs.speakerAnchor.getObjectByName("SpeakerStatusIndicator").userData.symbol==="-"')
    await page.evaluate('''()=>{
      const g=window.__camp_game,c=g.camera;
      c.position.copy(g.__auditCamera.position);c.quaternion.copy(g.__auditCamera.quaternion);
      c.updateMatrixWorld(true);delete g.__auditCamera;
    }''')
    camp['touchToggle']='off -> on (+) -> off (-)'
    metrics=await page.evaluate('''async()=>{
      const g=window.__camp_game, frames=[];
      const gl=g.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
      let last=performance.now();
      for(let i=0;i<40;i++){const now=await new Promise(requestAnimationFrame);if(i>5)frames.push(now-last);last=now;}
      return {calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
        dpr:g.renderer.getPixelRatio(),shadow:g.renderer.shadowMap.enabled,npcs:g.npcs.npcs.length,
        visibleNpcs:g.npcs.npcs.filter(n=>n.root.visible).length,profile:g.graphics,
        frameMs:frames.reduce((a,b)=>a+b,0)/frames.length,
        graphicsBackend:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable'};
    }''')
    await page.screenshot(path=str(output/f'{name}-playing.png'))
    controls=[]
    for width,height in SIZES:
        await page.set_viewport_size({'width':width,'height':height})
        controls.extend(await page.evaluate('''()=>['mobile-jump','mobile-interact','mobile-menu'].map(id=>{
          const button=document.getElementById(id),r=button.getBoundingClientRect();
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return {id,size:[innerWidth,innerHeight],reachable:button===hit||button.contains(hit)};
        })'''))
    assert all(c['reachable'] for c in controls), controls
    await page.set_viewport_size({'width':390,'height':844})
    await page.locator('#mobile-menu').click()
    await page.screenshot(path=str(output/f'{name}-pause.png'))
    # Populate via the existing UI/controller, not empty modal shells. Do not start a network match.
    await page.evaluate('''async()=>{
      const g=window.__camp_game;
      const {FlankiRoster}=await import('/src/game/interactions/FlankiRoster.ts');
      g.ui.showFlankiRoster(new FlankiRoster(),()=>false,()=>{}, {onRunnerChange:()=>false});
      g.ui.updateEcoPanel('Wyścig ekologiczny — zbieraj odpady i aktywuj bonusy',
        Array.from({length:20},(_,i)=>({name:'Festiwalowicz numer '+i,score:100-i})),
        {close:{enabled:true,run:()=>g.ui.setEcoPanelOpen(false)}});
      g.campfireGuitarGame.openSongSelect();
      g.ui.updateGuitarHud(g.campfireGuitarGame.getHudState(),()=>{},()=>{},()=>{});
    }''')
    populated=[]
    for width,height in SIZES:
        await page.set_viewport_size({'width':width,'height':height})
        for panel in ['flanki-roster-modal','eco-panel','guitar-song-select-modal']:
            result=await page.evaluate('''id=>{
              const p=document.getElementById(id),saved=[...document.querySelectorAll('#ui > section')].map(e=>[e,e.hidden]);
              saved.forEach(([e])=>e.hidden=true);const parents=[];
              for(let e=p;e&&e.id!=='ui';e=e.parentElement){parents.push([e,e.hidden]);e.hidden=false;}
              const r=p.getBoundingClientRect(),result={id,overflow:p.scrollWidth-p.clientWidth,
                outside:r.x < -1||r.y < -1||r.right>innerWidth+1||r.bottom>innerHeight+1};
              parents.forEach(([e,h])=>e.hidden=h);saved.forEach(([e,h])=>e.hidden=h);return result;
            }''',panel)
            populated.append({'size':[width,height],**result})
    await page.set_viewport_size({'width':390,'height':844})
    await page.evaluate('''()=>{
      const g=window.__camp_game;g.campfireGuitarGame.stopSong();
      document.querySelector('#guitar-song-select-modal').hidden=true;
      document.querySelector('#pause').hidden=true;
      g.ui.setEcoPanelOpen(false);
    }''')
    await page.locator('#flanki-cancel-btn').tap()
    assert await page.locator('#flanki-roster-modal').is_hidden()
    # Browser bar/keyboard resize events must not recreate same-sized GPU buffers.
    resize=await page.evaluate('''()=>{
      const g=window.__camp_game;g.resize();let calls=0;const fn=g.renderer.setSize.bind(g.renderer);
      g.renderer.setSize=(...args)=>{calls++;fn(...args)};g.resize();g.resize();g.renderer.setSize=fn;return calls;
    }''')
    await page.evaluate('''()=>{
      window.__camp_game.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
    }''')
    state=await page.evaluate('()=>({state:window.__camp_game.state.current,text:document.querySelector("#load-error").textContent})')
    assert state['state']=='error' and 'WebGL' in state['text']
    assert not any('/npcs/festival/' in url for url in urls)
    assert any('authored-festival-mobile.glb' in url for url in urls)
    assert resize==0
    result={'engine':name,'campInteractions':camp,'layouts':layouts,'populatedLayouts':populated,'touchControls':controls,'metrics':metrics,'pageErrors':errors,
        'modelRequests':[url.split('/game-assets/')[-1] for url in urls if '.glb' in url],
        'identicalResizeAllocations':resize,'contextLoss':state,
        'hardwareCaveat':'Desktop WebKit/Chromium; physical iPhone RAM/process limits not emulated.'}
    (output/f'{name}.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    failures=[x for x in layouts+populated if x['outside']or x['overflow']>2]
    assert not failures, failures
    assert not errors, errors
    print(json.dumps({'engine':name,'metrics':metrics,'layoutFailures':failures,
        'pageErrors':errors,'contextLossState':state['state']},indent=2))
    await browser.close()

async def main():
    async with async_playwright() as p:
        if len(sys.argv)==1 or sys.argv[1]=='webkit':
            await verify(p.webkit,'webkit',p.devices['iPhone 13'])
        if len(sys.argv)==1 or sys.argv[1]=='chromium':
            await verify(p.chromium,'chromium',p.devices['iPhone 13'])

asyncio.run(main())
