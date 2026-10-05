import asyncio
import os
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        await page.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
        
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)
        
        # 1. Enter game & wait for HUD to be visible
        print("1. Entering game...")
        await page.locator("#play").click()
        print("Waiting for HUD to become visible...")
        await page.wait_for_selector("#hud", state="visible", timeout=25000)
        await page.wait_for_timeout(1000)
        print("World loaded and HUD visible!")
        
        # 2. Open Map in game
        print("2. Opening Map...")
        await page.keyboard.press("m")
        await page.wait_for_timeout(800)
        await page.locator("#festival-map").screenshot(path=os.path.join(artifact_dir, "map_verified.png"), timeout=5000)
        print("Saved map_verified.png")
        await page.keyboard.press("m")
        await page.wait_for_timeout(500)
        
        # 3. Flanki pitch view
        print("3. Viewing Flanki Pitch...")
        # Walk toward flanki pitch (Z = -6 to -18)
        await page.keyboard.down("w")
        await page.wait_for_timeout(2000)
        await page.keyboard.up("w")
        await page.wait_for_timeout(500)
        await page.locator("#game").screenshot(path=os.path.join(artifact_dir, "flanki_pitch_verified.png"), timeout=5000)
        print("Saved flanki_pitch_verified.png")
        
        # 4. Turn around and sit on chair
        print("4. Testing Chair Sitting...")
        # Walk back to camp center
        await page.keyboard.down("s")
        await page.wait_for_timeout(1500)
        await page.keyboard.up("s")
        await page.wait_for_timeout(400)
        # Look around / press E to interact with chair
        await page.keyboard.press("e")
        await page.wait_for_timeout(600)
        await page.locator("#game").screenshot(path=os.path.join(artifact_dir, "sitting_verified.png"), timeout=5000)
        print("Saved sitting_verified.png")
        
        await browser.close()
        print("ALL SCREENSHOTS COMPLETED SUCCESSFULLY!")

asyncio.run(verify())
