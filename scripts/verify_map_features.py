import asyncio
import base64
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def run_verification():
    print("Starting Playwright verification for Festival Map features...")
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
        
        # Navigate to dev server
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)
        
        # 1. Start Screen Map Preview Test
        print("1. Testing Map preview on start screen...")
        start_map_btn = page.locator("#start-map-btn")
        if await start_map_btn.is_visible():
            await start_map_btn.click()
            await page.wait_for_timeout(500)
            map_visible = await page.locator("#festival-map").is_visible()
            print(f"Map opened from start screen: {map_visible}")
            
            # Click close
            await page.locator("#map-close").click()
            await page.wait_for_timeout(300)
            map_closed = not await page.locator("#festival-map").is_visible()
            print(f"Map closed cleanly: {map_closed}")
        
        # 2. Enter Game
        print("2. Entering game...")
        nickname = page.locator("#player-nickname")
        if await nickname.is_visible():
            await nickname.fill("OdkrywcaMapy")
            
        await page.locator("#play").click()
        await page.wait_for_selector("#hud", state="visible", timeout=30000)
        await page.wait_for_timeout(1500)
        print("HUD ready!")
        
        # 3. Orient player looking towards Duża Scena (East: +X)
        print("3. Orienting camera towards Duża Scena (East)...")
        look_east_result = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game) return { error: "No __camp_game" };
            
            // Set camera facing towards positive X (East / Duża Scena)
            if (game.camera) {
                // In Three.js: yaw = -Math.PI / 2 points camera along +X
                game.camera.rotation.set(0, -Math.PI / 2, 0, 'YXZ');
            }
            if (game.player && game.player.setYaw) {
                game.player.setYaw(-Math.PI / 2);
            }
            return {
                camDir: game.camera ? {
                    x: Math.round(game.camera.getWorldDirection(new (game.camera.position.constructor)()).x * 100) / 100,
                    z: Math.round(game.camera.getWorldDirection(new (game.camera.position.constructor)()).z * 100) / 100,
                } : null
            };
        }''')
        print(f"Player oriented East: {look_east_result}")
        
        # 4. Open Map via [M] key and verify Pause menu does NOT show
        print("4. Pressing [M] to open map...")
        await page.keyboard.press("KeyM")
        await page.wait_for_timeout(500)
        
        map_visible = await page.locator("#festival-map").is_visible()
        pause_hidden = not await page.locator("#pause").is_visible()
        print(f"Map modal visible: {map_visible}, Pause menu hidden: {pause_hidden}")
        assert map_visible, "Festival map should be visible after pressing M"
        assert pause_hidden, "Pause menu MUST NOT be visible when map is opened"
        
        # 5. Extract East orientation screenshot
        print("5. Capturing East orientation map view...")
        east_data_url = await page.evaluate('''() => {
            const canvas = document.getElementById('festival-map-canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
        }''')
        if east_data_url and "base64," in east_data_url:
            raw_data = east_data_url.split("base64,")[1]
            out_path = os.path.join(artifact_dir, "map_east_orientation.png")
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(raw_data))
            print(f"Saved: {out_path}")
            
        # 6. Test Zooming in via wheel on canvas
        print("6. Testing wheel zoom on map canvas...")
        canvas_box = await page.locator("#festival-map-canvas").bounding_box()
        if canvas_box:
            cx = canvas_box["x"] + canvas_box["width"] / 2
            cy = canvas_box["y"] + canvas_box["height"] / 2
            
            # Hover over canvas center and dispatch wheel events to zoom in
            await page.mouse.move(cx, cy)
            for _ in range(5):
                await page.mouse.wheel(0, -120)
                await page.wait_for_timeout(50)
                
            zoom_level = await page.evaluate('''() => {
                const game = window.__camp_game;
                return game && game.festivalMap ? game.festivalMap.getZoom() : null;
            }''')
            print(f"Map zoom level after scroll wheel: {zoom_level}")
            assert zoom_level and zoom_level > 1.2, f"Expected zoom > 1.2, got {zoom_level}"
            
            # Test drag panning
            print("Testing drag pan on map canvas...")
            await page.mouse.down()
            await page.mouse.move(cx - 80, cy - 60, steps=5)
            await page.mouse.up()
            await page.wait_for_timeout(200)
            
            pan_offset = await page.evaluate('''() => {
                const game = window.__camp_game;
                return game && game.festivalMap ? game.festivalMap.getPanOffset() : null;
            }''')
            print(f"Map pan offset after drag: {pan_offset}")
            
        # Capture zoomed map view
        zoomed_data_url = await page.evaluate('''() => {
            const canvas = document.getElementById('festival-map-canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
        }''')
        if zoomed_data_url and "base64," in zoomed_data_url:
            raw_data = zoomed_data_url.split("base64,")[1]
            out_path = os.path.join(artifact_dir, "map_zoomed_view.png")
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(raw_data))
            print(f"Saved: {out_path}")
            
        # 7. Add simulated remote players and capture
        print("7. Adding simulated remote players to map...")
        await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.festivalMap) return;
            
            if (game.remotePlayersManager) {
                game.remotePlayersManager.remotePlayers.set('p1', {
                    playerId: 'p1',
                    nickname: 'Woodstockowicz_Adam',
                    characterName: '006_rasta_dreadlocks',
                    currentPosition: new (game.camera.position.constructor)(100, 0, 10),
                    targetPosition: new (game.camera.position.constructor)(100, 0, 10),
                    currentYaw: 0,
                    targetYaw: 0,
                    isSpeaking: true,
                });
                game.remotePlayersManager.remotePlayers.set('p2', {
                    playerId: 'p2',
                    nickname: 'Festiwalowa_Ania',
                    characterName: '003_summer_curly_hair_girl',
                    currentPosition: new (game.camera.position.constructor)(-30, 0, 60),
                    targetPosition: new (game.camera.position.constructor)(-30, 0, 60),
                    currentYaw: -1.5,
                    targetYaw: -1.5,
                    isSpeaking: false,
                });
            }
            const forwardDir = new (game.camera.position.constructor)();
            game.camera.getWorldDirection(forwardDir);
            game.festivalMap.render(
                {
                    x: game.player.camera.position.x,
                    z: game.player.camera.position.z,
                    yaw: game.player.yaw,
                    dirX: forwardDir.x,
                    dirZ: forwardDir.z,
                },
                game.remotePlayersManager ? game.remotePlayersManager.getPlayerMarkers() : [],
                performance.now(),
                game.canCollector ? game.canCollector.getActiveCanMarkers() : []
            );
        }''')
        await page.wait_for_timeout(300)
        
        # Reset view so whole festival is seen with remote players
        await page.locator("#map-zoom-reset").click()
        await page.wait_for_timeout(300)
        
        remote_data_url = await page.evaluate('''() => {
            const canvas = document.getElementById('festival-map-canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
        }''')
        if remote_data_url and "base64," in remote_data_url:
            raw_data = remote_data_url.split("base64,")[1]
            out_path = os.path.join(artifact_dir, "map_remote_players.png")
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(raw_data))
            print(f"Saved: {out_path}")
            
        # 8. Test clicking map UI buttons (Zoom In, Zoom Out, Center Me)
        print("8. Testing clicking map buttons...")
        await page.locator("#map-zoom-in").click()
        await page.wait_for_timeout(100)
        z1 = await page.evaluate('() => window.__camp_game.festivalMap.getZoom()')
        
        await page.locator("#map-zoom-in").click()
        await page.wait_for_timeout(100)
        z2 = await page.evaluate('() => window.__camp_game.festivalMap.getZoom()')
        assert z2 > z1, f"Expected zoom to increase: z1={z1}, z2={z2}"
        print(f"Zoom In button works: {z1} -> {z2}")
        
        await page.locator("#map-center-me").click()
        await page.wait_for_timeout(100)
        print("Center Me button clicked successfully")
        
        # 9. Close map and verify game state is clean (no stuck pause menu)
        print("9. Closing map via close button...")
        await page.locator("#map-close").click()
        await page.wait_for_timeout(300)
        
        map_visible_after = await page.locator("#festival-map").is_visible()
        pause_visible_after = await page.locator("#pause").is_visible()
        print(f"Map after close: {map_visible_after}, Pause after close: {pause_visible_after}")
        assert not map_visible_after, "Map should be hidden after clicking close"
        assert not pause_visible_after, "Pause menu should NOT be visible after closing map"
        
        # Full page screenshot of clean gameplay state
        page_ss = os.path.join(artifact_dir, "gameplay_after_map_closed.png")
        await page.screenshot(path=page_ss)
        print(f"Saved gameplay screenshot: {page_ss}")
        
        await browser.close()
        print("ALL MAP VERIFICATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_verification())
