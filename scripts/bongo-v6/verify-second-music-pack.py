"""Check menu independence, pack selection/save/cancel and decode every supplied loop in browsers."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'reports/bongo-music-pack-2'
TRACKS = json.loads((ROOT/'src/games/bongo-rush/data/soundtrack-v2.json').read_text(encoding='utf-8'))
URL = 'http://127.0.0.1:5241/bongo-rush.html?verify'


async def ready(page):
    await page.wait_for_function('window.__bongoSnapshot && !window.__bongoSnapshot().loading')


async def main():
    OUT.mkdir(parents=True,exist_ok=True)
    report=[]
    async with async_playwright() as p:
        for engine in ['chromium','webkit']:
            browser=await getattr(p,engine).launch()
            context=await browser.new_context(viewport={'width':1280,'height':800},reduced_motion='reduce')
            await context.add_init_script("if(!localStorage.getItem('after-bongo-rush:v1'))localStorage.setItem('after-bongo-rush:v1',JSON.stringify({version:1,campaignRevision:3,unlocked:24,lastLevel:6,hero:'amper',muted:false,visualTheme:'storybook',collectibleStyle:'festival'}))")
            page=await context.new_page(); errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto(URL); await ready(page)
            await page.wait_for_selector('#menu[data-artistic="true"]')
            scene=await page.locator('#menu').get_attribute('style')
            await page.locator('#appearance-open').click()
            await page.locator('input[name="music-pack"][value="pack-2"]').check()
            assert 'Cabin' in await page.locator('#soundtrack-title').inner_text()
            await page.locator('#appearance-listen').click()
            audio=await page.evaluate('window.__bongoSnapshot().audio')
            if audio.get('contextState'):
                await page.wait_for_function('window.__bongoSnapshot().audio.track === "pack-2/cabin" && window.__bongoSnapshot().audio.state === "ready"')
                audio=await page.evaluate('window.__bongoSnapshot().audio')
                assert audio['buffers']==1
            await page.locator('#appearance-close').click()
            assert await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1")).musicPack || "pack-1"')=='pack-1'
            await page.locator('#appearance-open').click()
            await page.locator('input[name="music-pack"][value="pack-2"]').check()
            await page.locator('input[name="visual-theme"][value="standard"]').check()
            await page.locator('#appearance-apply').click(); await ready(page)
            await page.screenshot(path=str(OUT/f'{engine}-settings.png'))
            await page.locator('#appearance-close').click()
            assert await page.locator('#menu').get_attribute('data-artistic')=='true'
            assert await page.locator('#menu').get_attribute('style')==scene
            await page.reload(); await ready(page)
            await page.wait_for_selector('#menu[data-artistic="true"]')
            saved=await page.evaluate('JSON.parse(localStorage.getItem("after-bongo-rush:v1"))')
            assert saved['musicPack']=='pack-2' and saved['visualTheme']=='standard'
            assert saved['hero']=='amper' and saved['unlocked']==24
            await page.locator('#appearance-open').click()
            assert await page.locator('input[name="music-pack"][value="pack-2"]').is_checked()
            await page.locator('#appearance-close').click()
            await page.locator('#continue').click(); await ready(page)
            assert await page.evaluate('window.__bongoSnapshot().level')==6
            # Codec acceptance, complete buffers, no audio mutations through a test-only player.
            decoded=await page.evaluate('''async (tracks)=>{
              const C=window.OfflineAudioContext || window.webkitOfflineAudioContext;
              if(!C) return {unsupported:true};
              const decoder=new C(2,1,44100), results=[];
              for(const track of tracks){
                const response=await fetch('/game-assets/audio/bongo-rush/soundtrack-v2/'+track.file);
                if(!response.ok) throw Error('Audio HTTP '+response.status);
                const buffer=await decoder.decodeAudioData(await response.arrayBuffer());
                results.push({file:track.file,seconds:buffer.duration,channels:buffer.numberOfChannels});
              }
              return results;
            }''',list(TRACKS.values()))
            if isinstance(decoded,list):
                assert len(decoded)==21
                for entry in decoded:
                    expected=next(t for t in TRACKS.values() if t['file']==entry['file'])
                    assert abs(entry['seconds']-expected['seconds'])<.15
                    assert entry['channels']==2
            assert not errors,errors
            report.append({'engine':engine,'menuUnchangedForStandard':'PASS','preview':audio,'cancelWithoutSave':'PASS','savedPackAfterReload':'PASS','allTracksDecoded':decoded,'errors':errors})
            await context.close();await browser.close()
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps([{'engine':r['engine'],'menu':'PASS','settings':'PASS','decodedTracks':len(r['allTracksDecoded']) if isinstance(r['allTracksDecoded'],list) else r['allTracksDecoded']} for r in report],indent=2))


asyncio.run(main())
