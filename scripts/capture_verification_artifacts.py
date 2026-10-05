import asyncio
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda msg: print(f"BROWSER_CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER_PAGEERROR: {err}"))
        
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)
        
        print("Filling nickname...")
        nickname = page.locator("#player-nickname")
        if await nickname.is_visible():
            await nickname.fill("Festiwalowicz")
        
        print("Clicking play...")
        await page.locator("#play").click()
        
        print("Waiting for game to load...")
        hud_ready = False
        for tick in range(40):
            await page.wait_for_timeout(1000)
            status = await page.evaluate('''() => {
                const loading = document.getElementById('loading');
                const hud = document.getElementById('hud');
                const error = document.getElementById('loading-error');
                return {
                    loadingHidden: loading ? loading.hidden : null,
                    loadingText: loading ? loading.innerText.replace(/\\s+/g, ' ').trim() : '',
                    hudHidden: hud ? hud.hidden : null,
                    error: error ? error.innerText : ''
                };
            }''')
            print(f"Tick {tick}: {status}")
            if status['hudHidden'] is False:
                hud_ready = True
                break
        
        if not hud_ready:
            print("ERROR: Game failed to load HUD within 40 seconds.")
            await page.screenshot(path=os.path.join(artifact_dir, "load_timeout.png"))
            await browser.close()
            return
            
        print("HUD visible! World loaded.")
        await page.wait_for_timeout(1000)
        
        # 1. Map Verification
        print("Opening Map...")
        await page.evaluate("() => { if (window.__camp_game) window.__camp_game.toggleMap(true); }")
        await page.wait_for_timeout(800)
        await page.screenshot(path=os.path.join(artifact_dir, "map_verified.png"))
        print("Saved map_verified.png")
        await page.evaluate("() => { if (window.__camp_game) window.__camp_game.toggleMap(false); }")
        await page.wait_for_timeout(400)
        
        # 2. Flanki Pitch Verification
        print("Viewing Flanki Pitch...")
        await page.evaluate("""() => {
            const game = window.__camp_game;
            if (!game || !game.player) return;
            // Position near the player throw line (Z ~ -4.5) facing North (Z = -11)
            game.camera.position.x = 0;
            game.camera.position.z = -4.5;
            game.player.yaw = 0;
            game.player.pitch = -0.15;
        }""")
        await page.wait_for_timeout(600)
        await page.screenshot(path=os.path.join(artifact_dir, "flanki_pitch_verified.png"))
        print("Saved flanki_pitch_verified.png")
        
        # 3. Sitting on chair
        print("Sitting on chair...")
        await page.evaluate("""() => {
            const game = window.__camp_game;
            if (!game || !game.seatController) return;
            const pose = {
                seatId: 'S01',
                position: [3.15, 0, 0],
                rotationY: Math.PI
            };
            if (game.seatController.start(pose)) {
                game.state.transition('seated');
            }
        }""")
        await page.wait_for_timeout(800)
        await page.screenshot(path=os.path.join(artifact_dir, "seated_fixed_cam.png"))
        print("Saved seated_fixed_cam.png")
        
        await browser.close()
        print("Verification script finished cleanly!")

asyncio.run(capture())
