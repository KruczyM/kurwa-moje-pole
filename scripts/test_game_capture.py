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
        
        # 1. Capture Flanki Pitch
        print("Positioning camera at Flanki pitch...")
        flanki_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.player) return null;
            game.camera.position.set(0, 1.4, -4.5);
            game.camera.lookAt(0, 0.4, -12);
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        
        if flanki_data and "base64," in flanki_data:
            with open(os.path.join(artifact_dir, "flanki_pitch_verified.png"), "wb") as f:
                f.write(base64.b64decode(flanki_data.split("base64,")[1]))
            print("Successfully saved flanki_pitch_verified.png via WebGL toDataURL!")
            
        # 2. Capture Seated on Chair
        print("Sitting on chair and capturing view...")
        seated_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.seatController) return null;
            const pose = {
                seatId: 'S01',
                position: [3.15, 0, 0],
                rotationY: Math.PI
            };
            game.seatController.start(pose);
            // Update seatController once to establish third-person camera
            game.seatController.update(0.016);
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        
        if seated_data and "base64," in seated_data:
            with open(os.path.join(artifact_dir, "seated_fixed_cam.png"), "wb") as f:
                f.write(base64.b64decode(seated_data.split("base64,")[1]))
            print("Successfully saved seated_fixed_cam.png via WebGL toDataURL!")
            
        await browser.close()

asyncio.run(test_capture())
