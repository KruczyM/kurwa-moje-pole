import asyncio
import base64
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def test_sitting():
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
        print("Waiting for game to load...")
        for tick in range(40):
            await page.wait_for_timeout(1000)
            ready = await page.evaluate("() => document.getElementById('hud') && !document.getElementById('hud').hidden")
            if ready:
                break
        await page.wait_for_timeout(1000)
        print("HUD ready!")
        
        # Test sitting with start(pose)
        print("Calling start(pose) without invalid clip name...")
        res = await page.evaluate('''() => {
            try {
                const game = window.__camp_game;
                if (!game || !game.seatController || !game.world) return { success: false, reason: 'no game' };
                const seatInteractable = game.world.interactables.find(i => i.action === 'seat');
                if (!seatInteractable) return { success: false, reason: 'no seat' };
                const pose = seatInteractable.object.userData.interaction;
                
                game.seatController.stop();
                const started = game.seatController.start(pose);
                game.seatController.update(5.0);
                
                // 1. SeatController's official 3rd person camera
                game.renderer.render(game.scene, game.camera);
                const camImg = game.renderer.domElement.toDataURL('image/png');
                
                // 2. High front-angle view showing full chair and seated character
                const [x, y, z] = pose.position;
                const rotY = pose.rotationY;
                // Face the front of the chair (forward direction of chair)
                const fwdX = -Math.sin(rotY);
                const fwdZ = -Math.cos(rotY);
                game.camera.position.set(x + fwdX * 2.6, y + 1.4, z + fwdZ * 2.6);
                game.camera.lookAt(x, y + 0.65, z);
                game.camera.updateProjectionMatrix();
                game.renderer.render(game.scene, game.camera);
                const sideImg = game.renderer.domElement.toDataURL('image/png');
                
                return {
                    started,
                    sideImg,
                    camImg,
                    clipUsed: game.seatController.animator ? game.seatController.animator.currentClip : 'none'
                };
            } catch (err) {
                return { error: err.stack || String(err) };
            }
        }''')
        
        print("Result:", res.get("started"), "Clip:", res.get("clipUsed"))
        if res.get("sideImg"):
            with open(os.path.join(artifact_dir, "seated_fixed_side.png"), "wb") as f:
                f.write(base64.b64decode(res["sideImg"].split("base64,")[1]))
            print("Saved seated_fixed_side.png!")
            
        if res.get("camImg"):
            with open(os.path.join(artifact_dir, "seated_fixed_cam.png"), "wb") as f:
                f.write(base64.b64decode(res["camImg"].split("base64,")[1]))
            print("Saved seated_fixed_cam.png!")
            
        await browser.close()

asyncio.run(test_sitting())
