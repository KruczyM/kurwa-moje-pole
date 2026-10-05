import asyncio
import base64
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def capture():
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
        
        # 1. Map Canvas export
        print("Exporting map_verified.png...")
        map_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (game) game.toggleMap(true);
            const canvas = document.getElementById('festival-map-canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
        }''')
        if map_data and "base64," in map_data:
            with open(os.path.join(artifact_dir, "map_verified.png"), "wb") as f:
                f.write(base64.b64decode(map_data.split("base64,")[1]))
            print("Successfully saved map_verified.png!")
            
        await page.evaluate("() => { if (window.__camp_game) window.__camp_game.toggleMap(false); }")
        await page.wait_for_timeout(300)
        
        # 2. Flanki Pitch View
        print("Capturing flanki_pitch_verified.png...")
        flanki_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game) return null;
            // Place camera at player line (X=0.0, Z=-19.5) looking down pitch towards can (0, 0.1, -26) and bot (0, 1.0, -32)
            game.camera.position.set(0.0, 1.35, -19.5);
            game.camera.lookAt(0.0, 0.35, -26.0);
            game.camera.updateProjectionMatrix();
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        if flanki_data and "base64," in flanki_data:
            with open(os.path.join(artifact_dir, "flanki_pitch_verified.png"), "wb") as f:
                f.write(base64.b64decode(flanki_data.split("base64,")[1]))
            print("Successfully saved flanki_pitch_verified.png!")
            
        # 3. Chair Sitting - Side Profile & Default Cam
        print("Capturing seated_fixed_side.png and seated_fixed_cam.png...")
        seated_side_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.seatController || !game.world) return null;
            const seatInteractable = game.world.interactables.find(i => i.action === 'seat');
            if (!seatInteractable) return null;
            const pose = seatInteractable.object.userData.interaction;
            
            game.seatController.stop();
            game.seatController.start(pose, 'SittingIdle');
            game.seatController.update(5.5);
            
            // Side view looking at the chair and seated player
            const [x, y, z] = pose.position;
            const rotY = pose.rotationY;
            const sideX = x + Math.cos(rotY) * 2.2;
            const sideZ = z - Math.sin(rotY) * 2.2;
            game.camera.position.set(sideX, y + 0.9, sideZ);
            game.camera.lookAt(x, y + 0.55, z);
            game.camera.updateProjectionMatrix();
            
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        if seated_side_data and "base64," in seated_side_data:
            with open(os.path.join(artifact_dir, "seated_fixed_side.png"), "wb") as f:
                f.write(base64.b64decode(seated_side_data.split("base64,")[1]))
            print("Successfully saved seated_fixed_side.png!")
            
        # Default 3rd person camera
        seated_cam_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.seatController || !game.world) return null;
            const seatInteractable = game.world.interactables.find(i => i.action === 'seat');
            const pose = seatInteractable.object.userData.interaction;
            
            game.seatController.stop();
            game.seatController.start(pose, 'SittingIdle');
            game.seatController.update(5.5);
            
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        if seated_cam_data and "base64," in seated_cam_data:
            with open(os.path.join(artifact_dir, "seated_fixed_cam.png"), "wb") as f:
                f.write(base64.b64decode(seated_cam_data.split("base64,")[1]))
            print("Successfully saved seated_fixed_cam.png!")
            
        await browser.close()
        print("ALL VERIFICATIONS COMPLETED!")

asyncio.run(capture())
