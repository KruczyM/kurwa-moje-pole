import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 out=Path('reports/bongo-music-overlap');out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  page=await browser.new_page()
  await page.goto('http://127.0.0.1:5241/bongo-rush.html?verify')
  result=await page.evaluate('''async()=>{
   const {prepareSoundtrackLoop}=await import('/src/games/bongo-rush/SoundtrackLoop.ts');
   const {soundtrackUrl}=await import('/src/games/bongo-rush/Soundtrack.ts');
   const urls=new Set([soundtrackUrl('/',1,true)]);
   for(const pack of ['pack-1','pack-2'])for(let level=1;level<=24;level++)urls.add(soundtrackUrl('/',level,false,pack));
   const results=[];
   for(const url of urls){
    const context=new OfflineAudioContext(2,144000,48000);
    const buffer=await context.decodeAudioData(await(await fetch(url)).arrayBuffer());
    const frames=Math.min(Math.round(buffer.sampleRate*.8),Math.floor(buffer.length/4));
    const expected=[];
    for(let ch=0;ch<buffer.numberOfChannels;ch++)expected.push([buffer.getChannelData(ch)[frames-1],buffer.getChannelData(ch)[frames]]);
    const loopStart=prepareSoundtrackLoop(buffer);
    for(let ch=0;ch<buffer.numberOfChannels;ch++)if(Math.abs(buffer.getChannelData(ch)[buffer.length-1]-expected[ch][0])>1e-6)throw Error('Bad seam '+url);
    const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=buffer.duration;source.connect(context.destination);source.start(0,buffer.duration-1);
    const rendered=await context.startRendering();let energy=0;
    for(const value of rendered.getChannelData(0)){if(!Number.isFinite(value))throw Error('Nonfinite audio');energy+=value*value;}
    if(!energy)throw Error('Silent render '+url);
    results.push({url,seconds:buffer.duration,overlap:loopStart,seam:'PASS',renderAcrossBoundary:'PASS'});
   }
   const {ArcadeAudio}=await import('/src/games/bongo-rush/Audio.ts');
   const host=new ArcadeAudio('/');host.unlock();const profile={level:1,biome:0,theme:'storybook',musicPack:'pack-2'};
   host.updateMusic(0,true,false,profile);
   for(let i=0;i<100&&host.diagnostics().state!=='ready';i++)await new Promise(r=>setTimeout(r,50));
   host.updateMusic(0,true,false,profile);const active=host.diagnostics();host.silence(false);host.updateMusic(0,true,false,profile);const resumed=host.diagnostics();host.dispose();
   return {tracks:results,active,resumed,disposed:host.diagnostics()};
  }''')
  assert result['active']['loopOverlap']==.8 and result['active']['playing'],result['active']
  assert result['resumed']['voices']==1 and result['disposed']['voices']==0
  (out/'report.json').write_text(json.dumps(result,indent=2))
  print(json.dumps({'tracks':len(result['tracks']),'boundaryRendering':'PASS','hostLifecycle':'PASS'}))
  await browser.close()
asyncio.run(main())
