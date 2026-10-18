"""Browser regression checks; GAME_QA_URL can point at dev or a built preview."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".ai/artifacts/fighter-review"
URL = os.environ.get("GAME_QA_URL", "http://127.0.0.1:5236/fighter-demo.html")


async def check(browser_type, name, viewport, mobile):
    browser = await browser_type.launch(headless=True)
    context = await browser.new_context(viewport=viewport, device_scale_factor=3 if mobile else 1,
                                       is_mobile=mobile, has_touch=mobile)
    page = await context.new_page()
    errors, failed, requests = [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: failed.append(response.url) if response.status >= 400 else None)
    page.on("request", lambda request: requests.append(request.url))
    await page.goto(URL, wait_until="networkidle")
    assert await page.locator(".roster-card").count() == 16
    await page.locator('[data-select-slot="2"]').click()
    await page.locator('.roster-card[data-key="korba"]').click()
    await page.locator('[data-select-slot="1"]').click()
    await page.locator('.roster-card[data-key="amper"]').click()
    await page.locator("#fight-mode").select_option("training")
    await page.locator("#start-fight-btn").click()
    await page.wait_for_function("window.__fighterSim?.getState().roundState === 'fight'")
    await page.wait_for_load_state("networkidle")
    await page.evaluate("""() => {
      const sim = window.__fighterSim; sim.restartMatch();
      const s = sim.getState(); s.p1.x = -25; s.p2.x = 25;
    }""")
    hp = await page.evaluate("window.__fighterSim.getState().p2.hp")
    await page.keyboard.down("u")
    await page.wait_for_timeout(60)
    assert await page.evaluate("window.__fighterSim.getState().p1.state") == "attack"
    assert await page.evaluate("window.__fighterSim.getState().p2.hp") == hp, "damage before anticipation"
    await page.keyboard.up("u")
    await page.wait_for_timeout(550)
    assert await page.evaluate("window.__fighterSim.getState().p2.hp") < hp
    await page.locator("#help-btn").click()
    await page.locator("#pause-modal").wait_for(state="visible")
    assert "Samo kucanie nie blokuje" in await page.locator(".pause-controls-guide").inner_text()
    tick = await page.evaluate("window.__fighterSim.getState().tick")
    await page.wait_for_timeout(100)
    assert await page.evaluate("window.__fighterSim.getState().tick") == tick
    await page.screenshot(path=str(OUT / f"{name}-help.png"))
    await page.locator("#resume-btn").click()
    await page.locator("#pause-modal").wait_for(state="hidden")
    await page.evaluate("""() => { window.__keys = []; for (const t of ['keydown','keyup']) window.addEventListener(t, e => window.__keys.push([t, e.code, e.key])); }""")
    # A second key for the same action must survive release of the first.
    await page.keyboard.down("l"); await page.keyboard.down("Space"); await page.keyboard.up("l")
    await page.wait_for_function("window.__fighterSim.getState().p1.state === 'block_high'", timeout=5000)
    guard_state = await page.evaluate("({fighter: window.__fighterSim.getState().p1, paused: !document.querySelector('#pause-modal').hidden, focus: document.activeElement?.id, keys: window.__keys, tick: window.__fighterSim.getState().tick})")
    assert guard_state["fighter"]["state"] == "block_high", (name, guard_state)
    await page.keyboard.up("Space")
    await page.wait_for_timeout(80)
    await page.screenshot(path=str(OUT / f"{name}-fight.png"))
    await page.keyboard.press("Escape")
    await page.locator("#pause-modal").wait_for(state="visible")
    await page.keyboard.press("Escape")
    await page.locator("#pause-modal").wait_for(state="hidden")
    # Selection can be reopened and changed without leftover active keys/VFX.
    await page.locator("#char-select-btn").click()
    await page.locator("#char-select-screen").wait_for(state="visible")
    await page.locator("#bot-difficulty").select_option("hard")
    await page.locator("#fight-mode").select_option("bot")
    await page.locator("#start-fight-btn").click()
    await page.wait_for_load_state("networkidle")
    await page.evaluate("""() => {
      const s = window.__fighterSim.getState(); s.p1.x = 0; s.p2.x = 50;
      s.p1.hp = s.p1.maxHp; s.p2.hp = s.p2.maxHp;
    }""")
    await page.wait_for_function("window.__fighterSim.getState().p1.hp < window.__fighterSim.getState().p1.maxHp", timeout=6000)
    await page.locator("#char-select-btn").click()
    await page.locator("#char-select-screen").wait_for(state="visible")
    assert await page.locator("#bot-difficulty").input_value() == "hard"
    await page.screenshot(path=str(OUT / f"{name}-selection.png"))
    combat = [url for url in requests if "/fighter/combat/" in url]
    assert combat and all("/amper/" in url or "/korba/" in url for url in combat)
    assert not any(".glb" in url or ".fbx" in url for url in requests)
    assert not errors, errors
    assert not failed, failed
    report = {"browser": name, "viewport": viewport, "pageErrors": errors,
              "failedResponses": failed, "combatRequests": len(combat), "status": "PASS"}
    await browser.close()
    return report


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        results = []
        for browser, name, viewport, mobile in [
            (p.chromium, "chromium-desktop", {"width": 1366, "height": 768}, False),
            (p.webkit, "webkit-landscape", {"width": 932, "height": 430}, True),
            (p.webkit, "webkit-portrait", {"width": 430, "height": 932}, True),
        ]:
            results.append(await check(browser, name, viewport, mobile))
        (OUT / "browser-report.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(results, ensure_ascii=True))


if __name__ == "__main__":
    asyncio.run(main())
