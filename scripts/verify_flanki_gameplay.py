import asyncio
import base64
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0"

async def verify_flanki():
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
        await page.wait_for_timeout(1500)
        
        nickname = page.locator("#player-nickname")
        if await nickname.is_visible():
            await nickname.fill("FlankiMaster")
            
        await page.locator("#play").click()
        await page.wait_for_selector("#hud", state="visible", timeout=30000)
        await page.wait_for_timeout(2000)
        print("HUD ready! Game started.")
        
        # 1. Trigger Flanki Pitch & Gather NPCs
        print("Triggering Flanki pitch setup & gathering NPCs...")
        await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.world || !game.world.flankiGame) return;
            const flanki = game.world.flankiGame;
            // Teleport player near flanki pitch sign
            if (game.camera) {
                game.camera.position.set(0, 1.6, -18);
            }
            // Trigger gather NPCs around pitch
            if (game.npcs) {
                game.npcs.gatherNpcsAtFlanki(flanki.canPosition);
            }
        }''')
        await page.wait_for_timeout(1000)

        # 2. Open Flanki Roster Modal
        print("Opening Flanki Roster Modal...")
        await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.world || !game.world.flankiGame || !game.ui) return;
            const flanki = game.world.flankiGame;
            game.ui.showFlankiRoster(flanki.roster, () => {
                flanki.startMatch();
            }, () => {});
        }''')
        await page.wait_for_timeout(1000)
        
        # Capture screenshot of Roster Modal
        roster_path = os.path.join(artifact_dir, "flanki_roster_modal.png")
        await page.screenshot(path=roster_path)
        print(f"Saved {roster_path}!")

        # 3. Start Match and show Aiming Trajectory Arc & Tennis Ball
        print("Starting match and showing aiming arc...")
        await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game || !game.world || !game.world.flankiGame || !game.ui) return;
            const flanki = game.world.flankiGame;
            game.ui.hideFlankiRoster();
            flanki.startMatch();
            // Start charging throw so power bar and arc are visible
            flanki.startCharge();
            flanki.chargeTimer = 0.55; // sweet spot!
            // Set camera behind player throwing position looking at the can
            game.camera.position.set(0, 1.6, -20);
            flanki.updateAimPreview(game.camera.position);
            game.camera.lookAt(0, 0.5, -26);
            game.camera.updateProjectionMatrix();
            game.renderer.render(game.scene, game.camera);
        }''')
        await page.wait_for_timeout(1000)
        
        # Full gameplay screen capture with UI active and aiming arc
        full_game_path = os.path.join(artifact_dir, "flanki_gameplay_active.png")
        await page.screenshot(path=full_game_path)
        print(f"Saved {full_game_path}!")

        # Direct canvas render capture for aiming
        aiming_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game) return null;
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        if aiming_data and "base64," in aiming_data:
            aim_path = os.path.join(artifact_dir, "flanki_aiming_trajectory.png")
            with open(aim_path, "wb") as f:
                f.write(base64.b64decode(aiming_data.split("base64,")[1]))
            print(f"Saved {aim_path}!")

        # 4. View of the Entire Pitch with Can, Runners, and Gathered NPCs
        print("Capturing full pitch perspective...")
        pitch_data = await page.evaluate('''() => {
            const game = window.__camp_game;
            if (!game) return null;
            // Elevated side angle showing entire pitch from Team A line to Team B line, can in center, runners
            game.camera.position.set(6.5, 3.5, -24.0);
            game.camera.lookAt(0.0, 0.5, -26.0);
            game.camera.updateProjectionMatrix();
            game.renderer.render(game.scene, game.camera);
            return game.renderer.domElement.toDataURL('image/png');
        }''')
        if pitch_data and "base64," in pitch_data:
            pitch_path = os.path.join(artifact_dir, "flanki_pitch_view.png")
            with open(pitch_path, "wb") as f:
                f.write(base64.b64decode(pitch_data.split("base64,")[1]))
            print(f"Saved {pitch_path}!")

        await browser.close()
        print("Verification completed successfully!")

if __name__ == "__main__":
    asyncio.run(verify_flanki())
