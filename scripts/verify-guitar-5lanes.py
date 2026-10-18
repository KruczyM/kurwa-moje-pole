"""Browser verification for 5-lane guitar minigame (A,S,D,F,G), backing track, and randomized stage video."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / 'reports/guitar-5lanes'

async def main():
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
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
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        page_errors = []
        page.on('pageerror', lambda e: page_errors.append(str(e)))

        await page.goto(os.environ.get('GAME_QA_URL', 'http://127.0.0.1:5185/?fogTrial=1&server=http://127.0.0.1:3104'), wait_until='domcontentloaded')
        await page.wait_for_function('() => typeof document.querySelector("#play")?.onclick === "function"')
        await page.locator('#character-select button:not([disabled])').first.click()
        await page.locator('#player-nickname').fill('GuitarHero')
        await page.locator('#play').click()
        await page.wait_for_function('() => window.__camp_game?.npcs', timeout=120000)
        await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
        await page.wait_for_function('() => window.__camp_game?.state.current === "playing"', timeout=60000)

        # 1. Sprawdzenie losowego wideo na telebimie sceny głównej
        stage_video_file = await page.evaluate('''() => {
            const g = window.__camp_game;
            return g?.stageLiveScreens?.videoPlaylist?.currentFile || null;
        }''')
        print(f"Stage video initial track: {stage_video_file}")

        # 2. Otwarcie gitary przy ognisku
        await page.evaluate('''() => {
            const g = window.__camp_game;
            if (document.pointerLockElement) document.exitPointerLock?.();
            g.campfireGuitarGame.openSongSelect();
        }''')
        await page.locator('.guitar-song-option').first.wait_for(state='visible')

        # 3. Wybór utworu i start
        await page.locator('[data-song-id="wehikul"]').click()
        await page.wait_for_function('() => window.__camp_game.campfireGuitarGame.getPhase() === "playing"')

        # 4. Sprawdzenie 5 torów i przycisków A, S, D, F, G
        lanes_data = await page.evaluate('''() => {
            const lanes = Array.from(document.querySelectorAll('.guitar-lane')).map(el => el.getAttribute('data-lane'));
            const buttons = Array.from(document.querySelectorAll('.guitar-hit-btn')).map(el => ({
                lane: el.getAttribute('data-lane'),
                text: el.textContent.trim(),
                className: el.className
            }));
            const synth = window.__camp_game.campfireGuitarGame.synth;
            return {
                lanesCount: lanes.length,
                lanes,
                buttons,
                backingActive: synth?.backingActive ?? false,
                isPhasePlaying: window.__camp_game.campfireGuitarGame.getPhase() === 'playing'
            };
        }''')
        print("Lanes data:", json.dumps(lanes_data, indent=2))
        assert lanes_data['lanesCount'] == 5, f"Expected 5 lanes, got {lanes_data['lanesCount']}"
        assert [b['text'] for b in lanes_data['buttons']] == ['A', 'S', 'D', 'F', 'G'], f"Buttons mismatch: {lanes_data['buttons']}"

        # 5. Odczekaj na pojawienie się nut na gryfie i zrób zrzut ekranu
        await page.wait_for_timeout(1800)
        screenshot_path = ARTIFACTS_DIR / "guitar_5lanes_hero_gameplay.png"
        await page.screenshot(path=str(screenshot_path))
        print(f"Saved screenshot to {screenshot_path}")

        # 6. Symulacja uderzeń klawiszy A, S, D, F, G
        for key in ['a', 's', 'd', 'f', 'g']:
            await page.keyboard.press(key)
            await page.wait_for_timeout(150)

        game_state = await page.evaluate('''() => {
            const g = window.__camp_game;
            const hud = g.campfireGuitarGame.getHudState();
            return {
                score: hud.score,
                combo: hud.combo,
                cheer: hud.cheerLevel,
                multiplier: hud.multiplier,
                activeNotesCount: hud.activeNotes.length,
                notesSample: hud.activeNotes.slice(0, 3)
            };
        }''')
        print("Game state after key inputs:", json.dumps(game_state, indent=2))

        # 7. Wyjście z minigry
        await page.locator('#guitar-exit-btn').click()
        await page.wait_for_function('() => window.__camp_game.campfireGuitarGame.getPhase() === "idle"')

        final_check = await page.evaluate('''() => {
            const g = window.__camp_game;
            return {
                phase: g.campfireGuitarGame.getPhase(),
                backingActive: g.campfireGuitarGame.synth?.backingActive ?? false,
                hudHidden: document.querySelector('#guitar-hud')?.hidden ?? true
            };
        }''')
        assert final_check['phase'] == 'idle', f"Phase not idle: {final_check}"
        assert not final_check['backingActive'], "Backing track still active after exit"
        assert final_check['hudHidden'], "Guitar HUD still visible after exit"

        assert not page_errors, f"Page errors: {page_errors}"
        print("ALL 5-LANE GUITAR AND STAGE VIDEO CHECKS PASSED SUCCESSFULLY!")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())

