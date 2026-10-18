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
        
        # 1. Capture Flanki Pitch with Sign, Can, and Competitor
        print("Positioning camera to view Flanki pitch...")
        flanki_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game) return null;
            // Place camera near the wooden sign at X=1.8, Z=-5.0, looking at the can (0, 0.1, -12) and bot (0, 1.0, -18)
            game.camera.position.set(2.0, 1.25, -4.8);
            game.camera.lookAt(0.0, 0.5, -12.0);
            game.camera.updateProjectionMatrix();
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        
        if flanki_data and "base64," in flanki_data:
            with open(os.path.join(artifact_dir, "flanki_pitch_verified.png"), "wb") as f:
                f.write(base64.b64decode(flanki_data.split("base64,")[1]))
            print("Successfully saved flanki_pitch_verified.png!")
            
        # 2. Capture Seated Character on Camp Chair
        print("Finding camp chair and sitting character...")
        seated_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.seatController || !game.world) return null;
            const seatInteractable = game.world.interactables.find(i => i.action === 'seat');
            if (!seatInteractable) return null;
            const pose = seatInteractable.object.parent.userData.interaction;
            
            game.seatController.stop();
            game.seatController.start(pose, 'SittingIdle');
            game.seatController.update(1.0); // advance animation to stable loop
            
            // Side-angle camera looking directly at the chair and seated player
            const [x, y, z] = pose.position;
            const rotY = pose.rotationY;
            
            // Set camera to side view of the chair
            const sideX = x + Math.cos(rotY) * 2.2;
            const sideZ = z - Math.sin(rotY) * 2.2;
            game.camera.position.set(sideX, y + 0.9, sideZ);
            game.camera.lookAt(x, y + 0.55, z);
            game.camera.updateProjectionMatrix();
            
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        
        if seated_data and "base64," in seated_data:
            with open(os.path.join(artifact_dir, "seated_fixed_side.png"), "wb") as f:
                f.write(base64.b64decode(seated_data.split("base64,")[1]))
            print("Successfully saved seated_fixed_side.png!")
            
        # 3. Capture Default 3rd Person Seated Camera
        default_seated_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.seatController) return null;
            // Call seatController's own camera setup
            const seatInteractable = game.world.interactables.find(i => i.action === 'seat');
            const pose = seatInteractable.object.parent.userData.interaction;
            game.seatController.stop();
            game.seatController.start(pose, 'SittingIdle');
            game.seatController.update(1.0);
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        
        if default_seated_data and "base64," in default_seated_data:
            with open(os.path.join(artifact_dir, "seated_fixed_cam.png"), "wb") as f:
                f.write(base64.b64decode(default_seated_data.split("base64,")[1]))
            print("Successfully saved seated_fixed_cam.png!")
            
        await browser.close()

asyncio.run(test_capture())
