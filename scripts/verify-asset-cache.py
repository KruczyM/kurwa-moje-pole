"""Exercise the real asset service worker in Chromium, without modifying repository assets."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto('http://127.0.0.1:5180/')
        await page.wait_for_function('()=>navigator.serviceWorker.controller', timeout=60000)
        result = await page.evaluate('''async()=>{
          const manifest=await (await fetch('/asset-cache-manifest.json',{cache:'no-store'})).json();
          const path=Object.keys(manifest.assets).find(p=>p.endsWith('.jpg')&&p.includes('textures/'));
          if(!path)throw Error('No texture fixture');
          const url='/'+path;
          const configure=(m)=>new Promise(resolve=>{
            const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();resolve()};
            navigator.serviceWorker.controller.postMessage({type:'configure-assets',manifest:m},[c.port2]);
          });
          await configure(manifest);
          const first=await fetch(url);const size=(await first.arrayBuffer()).byteLength;
          const cache=await caches.open('festival-assets-v1');
          const key=new URL(url,location.origin);key.searchParams.set('__asset_revision',manifest.assets[path]);
          const stored=!!await cache.match(key.href);
          return {path,url,size,stored,manifest,key:key.href};
        }''')
        assert result['stored'] and result['size'] > 0
        await context.set_offline(True)
        size = await page.evaluate('async url=>(await (await fetch(url)).arrayBuffer()).byteLength', result['url'])
        assert size == result['size']
        await context.set_offline(False)
        # Revision change must not serve the old cached bytes while offline.
        changed = await page.evaluate('''async({manifest,path,url})=>{
          manifest.assets[path]='test-revision';
          await new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();resolve()};
            navigator.serviceWorker.controller.postMessage({type:'configure-assets',manifest},[c.port2]);});
          const response=await fetch(url);await response.arrayBuffer();
          const key=new URL(url,location.origin);key.searchParams.set('__asset_revision','test-revision');
          return !!await (await caches.open('festival-assets-v1')).match(key.href);
        }''', result)
        assert changed
        await page.reload()
        await page.wait_for_function('()=>navigator.serviceWorker.controller')
        repeat = await page.evaluate('async url=>(await (await fetch(url)).arrayBuffer()).byteLength', result['url'])
        assert repeat == result['size']
        report = {'coldStored':True,'offlineCacheHit':True,'revisionRefresh':changed,'reloadBytes':repeat,
                  'fixture':result['path'],'note':'Browser integration; quota failure also covered by deterministic worker tests.'}
        output = Path(__file__).resolve().parents[1] / 'reports' / 'mobile-support' / 'cache.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report,indent=2))
        await browser.close()

asyncio.run(main())
