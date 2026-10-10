import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    artifact_dir = Path(r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0")
    artifact_dir.mkdir(parents=True, exist_ok=True)

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
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        # Clear any old stored visual settings so we test default behavior
        await page.goto('http://localhost:5173/', wait_until='domcontentloaded')
        await page.evaluate('''() => {
            localStorage.removeItem('camp-visual-settings');
        }''')
        await page.reload(wait_until='domcontentloaded')

        print("Waiting for start button...")
        await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('AspectQA')
        await page.locator('#play').click()

        print("Waiting for game to load...")
        await page.wait_for_function('() => window.__camp_game?.npcs', timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('() => window.__camp_game?.state.current === "playing"', timeout=60000)

        # Let rendering settle and position camera for a clean vista
        await page.evaluate('''() => {
            const g = window.__camp_game;
            g.networkClient.disconnect(true);
            g.player.stop();
            if (g.npcs?.npcs) {
                g.npcs.npcs.forEach(n => n.root.visible = false);
            }
            g.camera.position.set(-21, 1.8, 18);
            g.camera.lookAt(-21, 1.8, 30);
            g.camera.updateMatrixWorld(true);
        }''')
        await asyncio.sleep(1.0)

        # 1. Verify default Ultrawide (21:9)
        info_ultrawide = await page.evaluate('''() => {
            const g = window.__camp_game;
            const canvas = g.canvas;
            const rect = canvas.getBoundingClientRect();
            const select = document.querySelector("#setting-aspect-ratio");
            return {
                settingVal: g.settings.aspectRatio,
                selectVal: select ? select.value : null,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top,
                windowW: window.innerWidth,
                windowH: window.innerHeight,
                cssVarW: getComputedStyle(document.documentElement).getPropertyValue('--game-viewport-width').trim(),
                cssVarH: getComputedStyle(document.documentElement).getPropertyValue('--game-viewport-height').trim()
            };
        }''')
        print(f"Default Ultrawide Info: {json.dumps(info_ultrawide, indent=2)}")

        assert info_ultrawide["settingVal"] == "ultrawide", f"Expected default 'ultrawide', got {info_ultrawide['settingVal']}"
        assert info_ultrawide["selectVal"] == "ultrawide", f"Expected select value 'ultrawide', got {info_ultrawide['selectVal']}"
        # 1280 / (21/9) = ~548.57px -> height around 549, top around 85 or 86
        assert abs(info_ultrawide["width"] - 1280) <= 2, f"Unexpected width {info_ultrawide['width']}"
        assert abs(info_ultrawide["height"] - 549) <= 2, f"Unexpected height {info_ultrawide['height']}"
        assert abs(info_ultrawide["top"] - 85.5) <= 2, f"Unexpected top {info_ultrawide['top']}"
        assert abs(info_ultrawide["left"] - 0) <= 1, f"Unexpected left {info_ultrawide['left']}"

        shot_uw = artifact_dir / "aspect_ultrawide_21x9.png"
        await page.screenshot(path=str(shot_uw))
        print(f"Saved {shot_uw}")

        # 2. Switch to 'auto' (Fullscreen)
        await page.evaluate('''() => {
            const select = document.querySelector("#setting-aspect-ratio");
            if (select) {
                select.value = "auto";
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }''')
        await asyncio.sleep(0.5)

        info_auto = await page.evaluate('''() => {
            const g = window.__camp_game;
            const rect = g.canvas.getBoundingClientRect();
            return {
                settingVal: g.settings.aspectRatio,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            };
        }''')
        print(f"Auto Info: {json.dumps(info_auto, indent=2)}")
        assert info_auto["settingVal"] == "auto"
        assert abs(info_auto["width"] - 1280) <= 2
        assert abs(info_auto["height"] - 720) <= 2
        assert abs(info_auto["top"] - 0) <= 1
        assert abs(info_auto["left"] - 0) <= 1

        shot_auto = artifact_dir / "aspect_auto.png"
        await page.screenshot(path=str(shot_auto))
        print(f"Saved {shot_auto}")

        # 3. Switch to '4:3' (Retro Classic)
        await page.evaluate('''() => {
            const select = document.querySelector("#setting-aspect-ratio");
            if (select) {
                select.value = "4:3";
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }''')
        await asyncio.sleep(0.5)

        info_43 = await page.evaluate('''() => {
            const g = window.__camp_game;
            const rect = g.canvas.getBoundingClientRect();
            return {
                settingVal: g.settings.aspectRatio,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            };
        }''')
        print(f"4:3 Info: {json.dumps(info_43, indent=2)}")
        assert info_43["settingVal"] == "4:3"
        # 720 * (4/3) = 960 width, pillarbox left = (1280 - 960)/2 = 160
        assert abs(info_43["width"] - 960) <= 2
        assert abs(info_43["height"] - 720) <= 2
        assert abs(info_43["left"] - 160) <= 2
        assert abs(info_43["top"] - 0) <= 1

        shot_43 = artifact_dir / "aspect_retro_4x3.png"
        await page.screenshot(path=str(shot_43))
        print(f"Saved {shot_43}")

        # 4. Switch to '32:9' (Super Ultrawide)
        await page.evaluate('''() => {
            const select = document.querySelector("#setting-aspect-ratio");
            if (select) {
                select.value = "32:9";
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }''')
        await asyncio.sleep(0.5)

        info_329 = await page.evaluate('''() => {
            const g = window.__camp_game;
            const rect = g.canvas.getBoundingClientRect();
            return {
                settingVal: g.settings.aspectRatio,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            };
        }''')
        print(f"32:9 Info: {json.dumps(info_329, indent=2)}")
        assert info_329["settingVal"] == "32:9"
        # 1280 / (32/9) = 360 height, top = (720 - 360)/2 = 180
        assert abs(info_329["width"] - 1280) <= 2
        assert abs(info_329["height"] - 360) <= 2
        assert abs(info_329["top"] - 180) <= 2
        assert abs(info_329["left"] - 0) <= 1

        shot_329 = artifact_dir / "aspect_super_32x9.png"
        await page.screenshot(path=str(shot_329))
        print(f"Saved {shot_329}")

        # 5. Switch back to 'ultrawide' and check localStorage persistence
        await page.evaluate('''() => {
            const select = document.querySelector("#setting-aspect-ratio");
            if (select) {
                select.value = "ultrawide";
                select.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }''')
        await asyncio.sleep(0.5)

        stored_settings = await page.evaluate('''() => {
            return JSON.parse(localStorage.getItem('camp-visual-settings') || '{}');
        }''')
        print(f"Stored visual settings in localStorage: {stored_settings}")
        assert stored_settings.get("aspectRatio") == "ultrawide"

        shot_restored = artifact_dir / "aspect_ultrawide_restored.png"
        await page.screenshot(path=str(shot_restored))
        print(f"Saved {shot_restored}")

        # 6. Capture pause menu with aspect ratio setting
        await page.evaluate('''() => {
            const g = window.__camp_game;
            g.setPause(true);
        }''')
        await asyncio.sleep(0.4)
        shot_pause = artifact_dir / "aspect_pause_menu.png"
        await page.screenshot(path=str(shot_pause))
        print(f"Saved {shot_pause}")

        await browser.close()
        assert len(errors) == 0, f"Page errors: {errors}"
        print("ALL ASPECT RATIO TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    asyncio.run(main())

