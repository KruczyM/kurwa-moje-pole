import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--enable-webgl',
                '--use-gl=angle',
                '--use-angle=d3d11',
                '--ignore-gpu-blocklist',
                '--autoplay-policy=no-user-gesture-required'
            ]
        )
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        await page.goto(os.environ.get('GAME_QA_URL', 'http://127.0.0.1:5185/?fogTrial=1&server=http://127.0.0.1:3104'), wait_until='domcontentloaded')
        await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('FramingQA')
        await page.locator('#play').click()
        await page.wait_for_function('() => window.__camp_game?.npcs', timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('() => window.__camp_game?.state.current === "playing"', timeout=60000)

        # Move to open area
        await page.evaluate('''() => {
            const g = window.__camp_game;
            g.networkClient.disconnect(true);
            g.player.stop();
            if (g.npcs?.npcs) {
                g.npcs.npcs.forEach(n => n.root.visible = false);
            }
            g.camera.position.set(-21, 1.8, 18);
            g.camera.lookAt(-21, 1.8, 25);
            g.camera.updateMatrixWorld(true);
        }''')

        artifact_dir = Path(__file__).resolve().parents[1] / 'reports/motion-camera'
        artifact_dir.mkdir(parents=True, exist_ok=True)

        # Test 1: Standard 16:9 viewport (1280x720) - Cheering
        await page.evaluate('''() => {
            const g = window.__camp_game;
            g.state.transition('paused');
            g.performMotion('Cheering');
        }''')
        await asyncio.sleep(0.5)
        shot1 = artifact_dir / "motion_framing_cheering_16x9.png"
        await page.screenshot(path=str(shot1))
        print(f"Captured {shot1}")

        # Test 2: Standard 16:9 viewport - Dancing
        await page.evaluate('''() => {
            const g = window.__camp_game;
            g.seatController.stop();
            g.state.transition('playing');
            g.state.transition('paused');
            g.performMotion('Dancing');
        }''')
        await asyncio.sleep(0.5)
        shot2 = artifact_dir / "motion_framing_dancing_16x9.png"
        await page.screenshot(path=str(shot2))
        print(f"Captured {shot2}")

        # Test 3: Ultrawide aspect ratio (1024x467) matching user's screen
        await page.set_viewport_size({'width': 1024, 'height': 467})
        await page.evaluate('''() => {
            const g = window.__camp_game;
            g.seatController.stop();
            g.state.transition('playing');
            g.state.transition('paused');
            g.performMotion('Cheering');
        }''')
        await asyncio.sleep(0.5)
        shot3 = artifact_dir / "motion_framing_cheering_ultrawide.png"
        await page.screenshot(path=str(shot3))
        print(f"Captured {shot3}")

        # Test 4: Verify exit animation back to playing via Esc or stop
        exit_result = await page.evaluate('''() => {
            const g = window.__camp_game;
            // Press E or Esc to leave seat
            g.key(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' }));
            const finishedNow = g.seatController.finished || !g.seatController.active;
            return {
                finishedNow,
                state: g.state.current
            };
        }''')
        print(f"Exit animation result: {exit_result}")
        await page.wait_for_function('()=>window.__camp_game.state.current==="playing"')

        await browser.close()
        assert len(errors) == 0, f"Errors: {errors}"
        print("All motion framing verification tests PASSED!")

if __name__ == '__main__':
    asyncio.run(main())

