"""Focused browser input regression using real Game, FlankiGame and MobileControls modules.
Does not replace a full visual world walkthrough.
"""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/flanki-runner-pickup'
async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 report=[]
 async with async_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=await getattr(p,engine).launch()
   page=await browser.new_page(viewport={'width':800,'height':600},has_touch=True)
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   await page.route('**/__flanki-qa.html',lambda route:route.fulfill(content_type='text/html',body='''<body><div id="mobile-controls"><div class="mobile-movement"><div class="mobile-joystick"><div class="mobile-joystick-knob"></div></div></div><div class="mobile-look-zone"></div><button id="mobile-menu">Menu</button><button id="mobile-inventory">Inventory</button><button id="mobile-interact">USE</button></div></body>'''))
   await page.goto('http://127.0.0.1:5243/__flanki-qa.html')
   await page.evaluate('''async()=>{
    const {Game}=await import('/src/game/Game.ts');
    const {FlankiGame}=await import('/src/game/interactions/FlankiGame.ts');
    const {MobileControls}=await import('/src/game/player/MobileControls.ts');
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const g=Object.create(Game.prototype);
    g.state={current:'playing'};g.ui={isEcoPanelOpen:()=>false,isGuideOpen:()=>false,isMapOpen:()=>false,isFlankiRosterOpen:()=>false};
    g.camera=new THREE.PerspectiveCamera();
    window.setup=()=>{
      g.world?.flankiGame.dispose();
      const f=new FlankiGame({canPosition:[0,0,-26],playerLineZ:-20,botLineZ:-32});
      f.prepareOfflineLobby();f.selectRunner('A','player');f.startMatch();
      while(f.roster.getCurrentThrower().team!=='B')f.roster.advanceTurn();
      f.phase='bot_drinking';f.tipOverCan();f.update(.01);
      g.world={flankiGame:f};g.camera.position.copy(f.runnerA.currentPosition);g.camera.position.y+=1.9;
    };
    window.setup();window.g=g;
    window.addEventListener('keydown',e=>g.key(e));window.addEventListener('keyup',e=>g.keyUp(e));
    window.controls=new MobileControls(document.querySelector('#mobile-controls'),{move:()=>{},look:()=>{},interact:()=>g.interact(),menu:()=>{},inventory:()=>{},press:key=>g.key(new KeyboardEvent('keydown',{key})),release:key=>g.keyUp(new KeyboardEvent('keyup',{key}))});
    window.controls.setState('playing');
    window.approach=()=>{g.camera.position.set(0,1.9,-25.5);g.world.flankiGame.updateLocalRunnerPosition(g.camera.position);};
    window.pickupStatus=()=>({upright:g.world.flankiGame.isCanUpright(),runner:g.world.flankiGame.runnerA.getState(),held:g.world.flankiGame.isPlayerActionHeld(),drinking:g.world.flankiGame.getHudState().isChugging});
   }''')
   for mode in ['keyboard','mobile']:
    await page.evaluate('setup()')
    button=page.locator('#mobile-interact');rect=await button.bounding_box()
    if mode=='keyboard': await page.keyboard.down('e')
    else:
     await page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
     await page.mouse.down()
    far=await page.evaluate('pickupStatus()');assert not far['upright'] and far['held'],far
    await page.evaluate('approach()')
    near=await page.evaluate('pickupStatus()');assert near['upright'] and near['runner']=='running_back' and not near['drinking'],near
    if mode=='keyboard':await page.keyboard.up('e')
    else:await page.mouse.up()
    assert not (await page.evaluate('pickupStatus()'))['held']
    report.append({'engine':engine,'input':mode,'distantPickupBlocked':True,'heldPickupOnApproach':True,'releaseClears':True})
   await page.evaluate('controls.dispose();g.world.flankiGame.dispose()')
   assert not errors,errors
   await browser.close()
 (OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report))
asyncio.run(main())

