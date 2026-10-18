import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda msg: print(f"BROWSER_CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER_PAGEERROR: {err}"))
        
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)
        
        print("Clicking play...")
        await page.locator("#play").click()
        for i in range(25):
            await page.wait_for_timeout(1000)
            app_state = await page.evaluate('''() => {
                const loading = document.getElementById('loading');
                const hud = document.getElementById('hud');
                const start = document.getElementById('start');
                return {
                    loadingHidden: loading ? loading.hidden : null,
                    loadingText: loading ? loading.innerText.replace(/\\n/g, ' ') : null,
                    hudHidden: hud ? hud.hidden : null,
                    startHidden: start ? start.hidden : null
                };
            }''')
            print(f"Tick {i}: {app_state}")
            if not app_state['hudHidden']:
                print("HUD is visible! Taking gameplay screenshot...")
                await page.wait_for_timeout(500)
                # Open Map
                await page.keyboard.press("m")
                await page.wait_for_timeout(600)
                await page.locator("#festival-map").screenshot(path=os.path.join(artifact_dir, "map_verified.png"))
                print("Map screenshot saved!")
                await page.keyboard.press("m")
                await page.wait_for_timeout(500)
                
                # Walk towards Flanki pitch
                await page.keyboard.down("w")
                await page.wait_for_timeout(2500)
                await page.keyboard.up("w")
                await page.wait_for_timeout(500)
                await page.locator("#game").screenshot(path=os.path.join(artifact_dir, "flanki_pitch_verified.png"))
                print("Flanki pitch screenshot saved!")
                break
                
        await browser.close()

asyncio.run(verify())
