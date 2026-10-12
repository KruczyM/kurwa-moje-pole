"""Render short local listening previews and validate finite audio samples; subjective listening remains human QA."""
import asyncio
import json
import struct
import wave
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/bongo-living/music'


async def main():
    """Use the real composition and WebAudio filters in an offline context, with no paid services."""
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://127.0.0.1:5207/bongo-rush.html')
        for biome, name in enumerate(['amarena','roots','rave','glass']):
            samples = await page.evaluate('''async biome=>{
              const {musicPhrase,MUSIC_BPM}=await import('/src/games/bongo-rush/Music.ts');
              const ctx=new OfflineAudioContext(1,22050*20,22050);
              for(let beat=0;beat*60/MUSIC_BPM[biome]<17;beat++){
                const start=.025+beat*60/MUSIC_BPM[biome];
                for(const note of musicPhrase(biome,beat)){
                  const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
                  osc.type=note.wave;osc.frequency.value=note.frequency;filter.type='lowpass';filter.frequency.value=note.cutoff;
                  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(note.gain,start+.09);
                  gain.gain.exponentialRampToValueAtTime(.0001,start+note.duration);
                  osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
                  osc.start(start);osc.stop(start+note.duration+.05);
                }
              }
              return Array.from((await ctx.startRendering()).getChannelData(0));
            }''', biome)
            peak = max(abs(sample) for sample in samples)
            assert 0.005 < peak < 0.5, (name, peak)
            with wave.open(str(OUT / f'{name}.wav'), 'wb') as output:
                output.setparams((1, 2, 22050, 0, 'NONE', 'not compressed'))
                output.writeframes(struct.pack('<'+'h'*len(samples), *(round(max(-1,min(1,s))*32767) for s in samples)))
            results.append({'biome':name,'seconds':20,'peak':peak,'clipping':False,'subjective_listening':'PENDING_HUMAN'})
        await browser.close()
    (OUT / 'report.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2),flush=True)


if __name__ == '__main__':
    asyncio.run(main())
