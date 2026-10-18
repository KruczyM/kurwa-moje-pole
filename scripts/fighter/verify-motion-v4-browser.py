"""Deterministic cases through the running FighterDemo's own view and RAF.

No second renderer/loop. Pause via the UI, inject simulation states using the
existing dev hooks, then observe the actual draw calls and capture gameplay.
"""
import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'reports/fighter-motion-v4/browser'


async def main(url, characters=None):
    global OUT
    if characters:
        OUT = ROOT/'reports/fighter-motion-v4/chlebak-console-browser'
    OUT.mkdir(parents=True,exist_ok=True)
    errors, failed, cases = [], [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width':1440,'height':900})
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.on('response',lambda response: failed.append({'url':response.url,'status':response.status}) if response.status >= 400 else None)
        await page.add_init_script('''(() => {
          const draw = CanvasRenderingContext2D.prototype.drawImage;
          const text = CanvasRenderingContext2D.prototype.fillText;
          window.__motionText = [];
          CanvasRenderingContext2D.prototype.fillText = function(value,...args) {
            window.__motionText.push(value);if(window.__motionText.length>200)window.__motionText.shift();
            return text.call(this,value,...args);
          };
          window.__motionDraws = [];
          CanvasRenderingContext2D.prototype.drawImage = function(image,...args) {
            if (image instanceof HTMLImageElement && image.src.includes('/fighter/')) {
              const m=this.getTransform();
              const left=args.length===8?Math.min(m.e+m.a*args[4],m.e+m.a*(args[4]+args[6])):null;
              const right=args.length===8?Math.max(m.e+m.a*args[4],m.e+m.a*(args[4]+args[6])):null;
              window.__motionDraws.push({src:image.src,frame:args.length===8?args[0]/args[2]:null,flip:Math.sign(m.a),left,right});
              if(window.__motionDraws.length>500) window.__motionDraws.shift();
            }
            return draw.call(this,image,...args);
          };
        })()''')
        await page.goto(url,wait_until='networkidle')
        await page.locator('[data-fight-mode="training"]').click()
        ids = await page.locator('.roster-card').evaluate_all('(cards)=>cards.map(c=>c.dataset.key)')
        if characters: ids = [id for id in ids if id in characters]
        motion = json.loads((ROOT/'public/game-assets/2d/fighter/motion-v4/manifest.json').read_text())
        for index, id in enumerate(ids):
            if index: await page.locator('#char-select-btn').click()
            await page.locator('[data-select-slot="1"]').click()
            await page.locator(f'.roster-card[data-key="{id}"]').click()
            await page.locator('#start-fight-btn').click()
            await page.keyboard.press('Escape')
            await page.evaluate("document.querySelector('#pause-modal').hidden=true; window.__fighterCamera.shake=()=>{}; Object.assign(window.__fighterSim.getState().p1,{state:'walk_fwd',currentMove:null,stateTicks:0})")
            await page.wait_for_function("id=>window.__motionDraws.some(d=>d.src.includes('/motion-v4/'+id+'/'))",arg=id)
            await page.evaluate('''async id => {
              const {ROSTER}=await import('/src/games/fighter/data/fighters/roster.ts');
              const {combatMove}=await import('/src/games/fighter/simulation/combatTiming.ts');
              window.__qaUltimate=combatMove(ROSTER[id].definition.moves.ultimate);
            }''',id)
            for facing in [1,-1]:
                for state, ticks in [('walk_fwd',[0,8,16,24,32,40,48,56]),('walk_back',[0,8,16,24]),('knockdown',[0,6,12,24]),('get_up',[0,9,18,36]),('defeat',[100])]:
                    for tick in ticks:
                        await page.evaluate('''({state,tick,facing})=>{
                          const s=window.__fighterSim.getState();window.__fighterView.superCinematic.reset();
                          Object.assign(s.p1,{state,stateTicks:tick,currentMove:null,moveTick:0,x:-120*facing+(state.startsWith('walk')?tick:0),y:0,facing,hitstop:0});
                          Object.assign(s.p2,{state:'idle',currentMove:null,x:180*facing,y:0});
                          s.tick+=8;s.superFreezeTicks=0;s.roundState='fight';s.stateTicks=300;window.__motionDraws=[];
                        }''',{'state':state,'tick':tick,'facing':facing})
                        expected = 'walk' if state.startswith('walk') else 'fall' if state in ['knockdown','defeat'] else 'get_up'
                        await page.wait_for_function("({id,expected})=>window.__motionDraws.some(d=>d.src.includes('/motion-v4/'+id+'/'+expected))",arg={'id':id,'expected':expected})
                        cases.append({'id':id,'state':state,'tick':tick,'facing':facing})
                        if facing == 1 and ((state == 'walk_fwd' and tick == 16) or (state == 'knockdown' and tick == 24)):
                            await page.screenshot(path=str(OUT/f'{id}-{state}.png'))
                if id not in ['amper','dziaslo']:
                    for distance, x in [('close',-65),('far',-390),('edge',-470)]:
                        for t in [35,52,64,70,76,84,94,99,103]:
                            await page.evaluate('''({id,facing,x,t})=>{
                              const s=window.__fighterSim.getState(),v=window.__fighterView,m=window.__qaUltimate;
                              const tick=t<=75?(t-35)/40*m.startup:t<=92?m.startup+1+(t-76)/16*(m.active-1):m.startup+m.active+1+(t-93)/12*(m.recovery-1);
                              Object.assign(s.p1,{state:'attack',currentMove:m,moveTick:t>=76?m.startup+1:tick,x:x*facing,y:0,facing,hasHit:t>=76,hitstop:0});
                              Object.assign(s.p2,{state:t>=76?'hit_stun':'idle',currentMove:null,x:(x+100+(x<-100?600:0))*facing,y:0,facing:-facing,isGrounded:true,lastHitHeight:'mid'});
                              s.superFreezeTicks=0;s.roundState='fight';s.stateTicks=300;
                              v.superCinematic.reset();v.superCinematic.startCinematic(s.p1,s.p2,'ultimate',m.name,id,{} ,'#ddbb77');
                              v.superCinematic.update(s,window.__fighterCamera,{playUltimateImpact:()=>{}});
                              if(t>=76){s.p1.moveTick=tick;v.superCinematic.update(s,window.__fighterCamera,{playUltimateImpact:()=>{}})}
                              window.__motionDraws=[];
                            }''',{'id':id,'facing':facing,'x':x,'t':t})
                            await page.wait_for_function("id=>window.__motionDraws.some(d=>d.src.includes('/'+id+'/')&&(d.src.endsWith('/ultimate.png')||d.src.endsWith('/ultimate_power.png')))",arg=id)
                            assert not await page.evaluate("window.__motionDraws.some(d=>d.src.endsWith('/soundwave.webp'))")
                            cases.append({'id':id,'state':'ultimate','t':t,'facing':facing,'distance':distance})
                            if facing == 1 and distance == 'far' and t in [70,84,99]:
                                await page.screenshot(path=str(OUT/f'{id}-{t}.png'))
                            if facing == -1 and distance == 'edge' and t == 84:
                                await page.set_viewport_size({'width':390,'height':844})
                                await page.evaluate('window.__motionDraws=[]')
                                await page.wait_for_function("window.__motionDraws.some(d=>d.src.endsWith('/ultimate.png')||d.src.endsWith('/ultimate_power.png'))")
                                assert await page.evaluate("window.__motionDraws.filter(d=>d.src.endsWith('/ultimate.png')||d.src.endsWith('/ultimate_power.png')).every(d=>d.left>=0&&d.right<=390)")
                                await page.screenshot(path=str(OUT/f'{id}-ultimate-mobile.png'))
                                await page.set_viewport_size({'width':1440,'height':900})
                    for outcome in ['block','miss']:
                        await page.evaluate('''outcome=>{
                          const s=window.__fighterSim.getState(),v=window.__fighterView;
                          s.p1.hasHit=outcome==='block';s.p2.state=outcome==='block'?'block_high':'idle';
                          s.p1.moveTick=s.p1.currentMove.startup+2;
                          v.superCinematic.reset();v.superCinematic.startCinematic(s.p1,s.p2,'ultimate','ulti',s.p1.id,{},'#ddbb77');
                          v.superCinematic.update(s,window.__fighterCamera,{playUltimateImpact:()=>{}});
                        }''',outcome)
                        assert not await page.evaluate('window.__fighterView.superCinematic.getActiveState().damageApplied')
                        await page.evaluate('''()=>{const s=window.__fighterSim.getState();s.p1.moveTick=s.p1.currentMove.startup+s.p1.currentMove.active+5;
                          window.__motionText=[];window.__fighterView.superCinematic.update(s,window.__fighterCamera,{playUltimateImpact:()=>{}})}''')
                        await page.wait_for_function('value=>window.__motionText.includes(value)',arg='BLOK' if outcome=='block' else 'PUDŁO')
                        cases.append({'id':id,'state':'ultimate','outcome':outcome,'facing':facing})
            await page.set_viewport_size({'width':390,'height':844})
            await page.screenshot(path=str(OUT/f'{id}-mobile.png'))
            await page.set_viewport_size({'width':1440,'height':900})
            print(f'Checked {id}: {len(cases)} render cases so far',flush=True)
        # The same training UI still accepts real keyboard inputs after state injection.
        await page.evaluate("window.__fighterSim.restartMatch();window.__fighterView.reset()")
        await page.keyboard.press('Escape')
        await page.keyboard.down('KeyU')
        await page.wait_for_function("window.__fighterSim.getState().p1.currentMove?.id==='light_punch'")
        await page.keyboard.up('KeyU')
        await page.wait_for_function("window.__fighterSim.getState().p1.state==='idle'")
        await page.evaluate("const s=window.__fighterSim.getState();s.p1.x=-300;s.p2.x=250;window.__motionDraws=[]")
        await page.evaluate('id=>window.__qaWalkId=id',ids[-1])
        await page.keyboard.down('KeyD')
        await page.wait_for_function("new Set(window.__motionDraws.filter(d=>d.src.endsWith('/motion-v4/'+window.__qaWalkId+'/walk.png')).map(d=>d.frame)).size>=4")
        assert await page.evaluate('window.__fighterSim.getState().p1.x') > -240
        await page.screenshot(path=str(OUT/'real-keyboard-walk.png'))
        await page.keyboard.up('KeyD')
        await page.wait_for_function("window.__fighterSim.getState().p1.state==='idle'")
        await page.keyboard.down('KeyA')
        await page.wait_for_function("window.__fighterSim.getState().p1.state==='walk_back'")
        await page.keyboard.up('KeyA')
        report={'status':'PASS' if not errors and not failed else 'FAIL','characters':len(ids),'renderChecks':len(cases),
                'pageErrors':errors,'httpErrors':failed,'cases':cases,'inputSmoke':'real keyboard jab and distance-driven forward/back walking observed',
                'scope':'Actual game canvas and RAF, deterministic injected states; screenshots inspected separately. Not a full human playthrough.'}
        (OUT/'browser-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        await browser.close()
        print(json.dumps({k:v for k,v in report.items() if k!='cases'}))
        assert not errors and not failed


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:5187/fighter-demo.html')
    parser.add_argument('--characters',nargs='+')
    args=parser.parse_args()
    asyncio.run(main(args.url,args.characters))
