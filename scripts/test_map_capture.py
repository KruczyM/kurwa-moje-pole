import asyncio
import base64
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def test_capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--enable-webgl",
                "--use-gl=angle",
                "--use-angle=d3d11",
                "--ignore-gpu-blocklist",
            ]
        )
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)
        
        nickname = page.locator("#player-nickname")
        if await nickname.is_visible():
            await nickname.fill("Tester")
            
        await page.locator("#play").click()
        await page.wait_for_selector("#hud", state="visible", timeout=30000)
        await page.wait_for_timeout(1000)
        print("HUD ready!")
        
        # 1. Map Canvas extraction via toDataURL
        print("Rendering and exporting map canvas...")
        map_data_url = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (game) game.toggleMap(true);
            const canvas = document.getElementById('festival-map-canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
        }''')
        
        if map_data_url and "base64," in map_data_url:
            raw_data = map_data_url.split("base64,")[1]
            with open(os.path.join(artifact_dir, "map_verified.png"), "wb") as f:
                f.write(base64.b64decode(raw_data))
            print("Successfully saved map_verified.png via 2D canvas toDataURL!")
            
        await browser.close()

asyncio.run(test_capture())
