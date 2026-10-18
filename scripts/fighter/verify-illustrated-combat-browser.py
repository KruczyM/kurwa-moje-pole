"""Exercise all combat clips through the game's existing canvas renderer.

Run Vite on port 5183 first. Requires Playwright + Chromium. Pauses the actual
simulation through its UI, then injects deterministic states through its existing
__fighterSim debug hook. No alternate renderer or animation loop is created.
"""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]


async def main(url, output):
    output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width":1440,"height":900})
        errors, failed = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: failed.append({"url":response.url,"status":response.status}) if response.status >= 400 else None)
        await page.add_init_script("""(() => {
            const original = CanvasRenderingContext2D.prototype.drawImage;
            window.__combatDraws = [];
            CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
                if (image instanceof HTMLImageElement && image.src.includes('/fighter/combat')) {
                    window.__combatDraws.push({src:image.src, sx:args[0], size:args[2], facing:Math.sign(this.getTransform().a)});
                    if(window.__combatDraws.length>200) window.__combatDraws.shift();
                }
                return original.call(this, image, ...args);
            };
        })()""")
        await page.goto(url, wait_until="networkidle")
        await page.locator("#fight-mode").select_option("training")
        ids = await page.locator(".roster-card").evaluate_all("(cards)=>cards.map(c=>c.dataset.key)")
        cases = []
        for index, fighter_id in enumerate(ids):
            manifest = json.loads((ROOT/'public/game-assets/2d/fighter/combat-illustrated-v1'/fighter_id/'manifest.json').read_text(encoding='utf-8'))
            if index:
                await page.locator("#char-select-btn").click()
            await page.locator('[data-select-slot="1"]').click()
            await page.locator(f'.roster-card[data-key="{fighter_id}"]').click()
            await page.locator("#start-fight-btn").click()
            await page.keyboard.press("Escape")
            await page.evaluate("document.querySelector('#pause-modal').hidden=true")
            definition = await page.evaluate("""async id => {
                const {ROSTER} = await import('/src/games/fighter/data/fighters/roster.ts');
                const {combatMove} = await import('/src/games/fighter/simulation/combatTiming.ts');
                const moves = Object.values(ROSTER[id].definition.moves).map(combatMove);
                window.__qaMoves = Object.fromEntries(moves.map(m=>[m.id,m]));
                return moves;
            }""", fighter_id)
            for move in definition:
                clip = {"light_punch":"jab","heavy_punch":"cross","light_kick":"kick","jump_kick":"air_kick"}.get(move["id"],move["id"])
                entry = manifest['clips'][clip]
                suffix = '/'+('combat-powers-v2' if entry.get('powers') else 'combat-illustrated-v1')+'/'+fighter_id+'/'+entry['file']
                for tick, frame in [(0,0),(move["startup"]+1,2),(move["startup"]+move["active"]+move["recovery"],5)]:
                    await page.evaluate("""({id,tick}) => {
                        const s=window.__fighterSim.getState();
                        Object.assign(s.p1,{state:'attack',currentMove:window.__qaMoves[id],moveTick:tick,stateTicks:0,
                            x:-65,y:id.startsWith('jump_')?65:0,facing:1});
                        Object.assign(s.p2,{state:'idle',currentMove:null,x:85,y:0});
                        window.__combatDraws=[];
                    }""", {"id":move["id"],"tick":tick})
                    await page.wait_for_function("""({suffix,frame}) => window.__combatDraws.some(d=>
                        d.src.endsWith(suffix) && d.sx===frame*256 && d.facing===1)""",
                        arg={"suffix":suffix,"frame":frame})
                    cases.append({"fighter":fighter_id,"move":move["id"],"tick":tick,"frame":frame})
            for state, clip, height in [("block_high","block",None),("block_low","block_low",None),
                                         ("hit_stun","hit_head","high"),("hit_stun","hit_body","mid")]:
                await page.evaluate("""({state,height})=>{
                    Object.assign(window.__fighterSim.getState().p1,{state,lastHitHeight:height,
                        currentMove:null,y:0,stateTicks:state==='hit_stun'?0:120,stunTicks:30,facing:-1});
                    window.__combatDraws=[];
                }""", {"state":state,"height":height})
                await page.wait_for_function("""({id,clip})=>window.__combatDraws.some(d=>
                    d.src.endsWith('/combat-illustrated-v1/'+id+'/'+clip+'.png')&&d.sx===512&&d.facing===-1)""",
                    arg={"id":fighter_id,"clip":clip})
                cases.append({"fighter":fighter_id,"state":state,"clip":clip,"frame":2,"facing":-1})
            for tick, vy, y, frame in [(0,16,0,0),(4,12,60,1),(12,5,140,2),(18,0,170,3),(25,-6,110,4),(35,-12,15,5)]:
                await page.evaluate("""({tick,vy,y})=>{
                    Object.assign(window.__fighterSim.getState().p1,{state:'hit_stun',currentMove:null,
                        isAirJuggle:true,isGrounded:false,stateTicks:tick,vy,y,facing:1});
                    window.__combatDraws=[];
                }""", {'tick':tick,'vy':vy,'y':y})
                await page.wait_for_function("""({id,frame})=>window.__combatDraws.some(d=>
                    d.src.endsWith('/combat-powers-v2/'+id+'/launch_hit.png')&&d.sx===frame*256)""",
                    arg={'id':fighter_id,'frame':frame})
                cases.append({'fighter':fighter_id,'clip':'launch_hit','frame':frame})
            await page.evaluate("""()=>{
                const s=window.__fighterSim.getState();
                Object.assign(s.p1,{state:'attack',currentMove:window.__qaMoves.heavy_kick,
                    moveTick:window.__qaMoves.heavy_kick.startup+1,facing:1,y:0,isAirJuggle:false,isGrounded:true});
            }""")
            await page.wait_for_timeout(50)
            await page.screenshot(path=str(output/(fighter_id+".png")))
        # Verify the touch/keyboard path also still advances the real simulation.
        await page.evaluate("""()=>Object.assign(window.__fighterSim.getState().p1,
            {state:'idle',currentMove:null,moveTick:0,stateTicks:0,stunTicks:0,y:0,facing:1})""")
        await page.keyboard.press("Escape")
        await page.keyboard.down("KeyU")
        await page.wait_for_function("()=>window.__fighterSim.getState().p1.currentMove?.id==='light_punch'")
        await page.keyboard.up("KeyU")
        await page.set_viewport_size({"width":390,"height":844})
        await page.locator("#char-select-btn").click()
        await page.screenshot(path=str(output/"mobile-selection.png"))
        report = {"status":"PASS" if not errors and not failed else "FAIL", "characters":len(ids),
                  "renderChecks":len(cases),"cases":cases,"pageErrors":errors,"httpErrors":failed,
                  "inputSmoke":"keyboard jab observed","viewport":[1440,900],
                  "scope":"Actual FighterDemo canvas, deterministic phase/state injection; not a full manual playthrough."}
        (output/"browser-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
        await browser.close()
        assert not errors and not failed, {"pageErrors":errors,"httpErrors":failed}
        print(json.dumps({k:v for k,v in report.items() if k!="cases"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url",default="http://127.0.0.1:5183/fighter-demo.html")
    parser.add_argument("--out",type=Path,default=ROOT/"reports/fighter-combat-illustrated-v1")
    args = parser.parse_args()
    asyncio.run(main(args.url,args.out))
