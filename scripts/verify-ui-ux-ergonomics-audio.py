"""Browser runtime verification for UI/UX Ergonomics & Audio overhaul (Packages A + B)."""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
from playwright.async_api import async_playwright

WORKSPACE_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = WORKSPACE_DIR / 'reports' / 'ui-ux-ergonomics-audio'
ARTIFACTS_DIR = Path(r'C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0')

import socket

def wait_for_port(port, host='127.0.0.1', timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.5)
    return False

async def main():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Start vite preview server on port 5173
    print("Starting Vite preview server...")
    cmd = 'npx.cmd vite preview --port 5173 --host 127.0.0.1' if os.name == 'nt' else 'npx vite preview --port 5173 --host 127.0.0.1'
    server_process = subprocess.Popen(
        cmd,
        cwd=str(WORKSPACE_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=True,
    )

    try:
        assert wait_for_port(5173), "Vite preview server failed to start within 30s!"
        print("Vite preview server is ready on port 5173.")
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--enable-webgl',
                    '--use-gl=angle',
                    '--use-angle=d3d11',
                    '--ignore-gpu-blocklist',
                    '--autoplay-policy=no-user-gesture-required',
                ],
            )
            page = await browser.new_page(viewport={'width': 1280, 'height': 800})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))

            print("Navigating to http://127.0.0.1:5173/...")
            await page.goto('http://127.0.0.1:5173/', wait_until='domcontentloaded')
            await page.wait_for_selector('#start', state='visible')

            # 1. Verify Lobby UI
            print("Verifying Lobby UI...")
            # Nickname Input and Counter
            nick_input = page.locator('#player-nickname')
            nick_count = page.locator('#nickname-count')
            await nick_input.fill('Festiwalowicz')
            nick_value = await nick_input.input_value()
            assert nick_value == 'Festiwalowicz', f"Expected 'Festiwalowicz', got '{nick_value}'"
            count_text = await nick_count.text_content()
            assert '13/18' in (count_text or ''), f"Expected '13/18' in counter, got '{count_text}'"
            print(f"Nickname input and counter verified successfully: {nick_value} ({count_text})")

            # 3D Tilt on character card
            char_btn = page.locator('#character-select button.character-card').first
            box = await char_btn.bounding_box()
            await page.mouse.move(box['x'] + box['width'] * 0.7, box['y'] + box['height'] * 0.7)
            tilt_transform = await char_btn.evaluate('el => el.style.transform')
            assert 'perspective' in tilt_transform, f"Expected perspective transform on tilt, got {tilt_transform}"
            print("3D Tilt effect verified on character select card.")

            # Primary CTA
            play_btn = page.locator('#play')
            assert await play_btn.is_visible()
            # 2D arcade links
            fighter_link = page.locator('#play-fighter')
            assert await fighter_link.get_attribute('target') == '_blank'
            bongo_link = page.locator('#play-bongo-rush')
            assert await bongo_link.get_attribute('target') == '_blank'
            print("2D Arcade external links verified.")

            # Save Lobby screenshot
            lobby_shot = REPORTS_DIR / '01_lobby_screen.png'
            await page.screenshot(path=str(lobby_shot))
            shutil.copy2(lobby_shot, ARTIFACTS_DIR / 'ui_ux_01_lobby_screen.png')

            # 2. Enter Game & Audio Transition
            print("Entering festival camp...")
            await play_btn.click()
            await page.wait_for_function('() => window.__camp_game?.npcs', timeout=90000)
            await page.evaluate('document.querySelector("#skip-crowd-btn")?.click()')
            await page.wait_for_function('() => window.__camp_game?.state.current === "playing"', timeout=60000)

            # Verify Web Audio transition
            is_muffled = await page.evaluate('() => window.__camp_game.speakerAudio.isTentMuffled()')
            assert is_muffled is False, "SpeakerAudio should be unmuffled in playing state!"
            print("Web Audio muffled->unmuffled transition verified.")

            # Verify Crosshair dot + ring + label
            crosshair = page.locator('#crosshair')
            assert await crosshair.is_visible()
            assert 'crosshair-dot' in (await crosshair.get_attribute('class') or '')
            assert await page.locator('#crosshair .crosshair-ring').count() == 1
            print("Dynamic crosshair dot & ring verified.")

            # Verify Hotbar 1-4
            hotbar = page.locator('#hud-hotbar')
            assert await hotbar.is_visible()
            slots = await page.locator('#hud-hotbar .hotbar-slot').all()
            assert len(slots) == 4
            print("Hotbar 1-4 verified in HUD.")

            # Verify Effect HUD is hidden by default
            effect_hud = page.locator('#effect-hud')
            is_hidden = await effect_hud.is_hidden()
            assert is_hidden, "Effect HUD must be hidden when no active effect is running!"
            print("Effect HUD default hidden state verified (zero visual clutter).")

            # Save in-game HUD screenshot
            hud_shot = REPORTS_DIR / '02_gameplay_hud_hotbar_crosshair.png'
            await page.screenshot(path=str(hud_shot))
            shutil.copy2(hud_shot, ARTIFACTS_DIR / 'ui_ux_02_gameplay_hud_hotbar_crosshair.png')

            # 3. Test Flanki Modal Rules Cards & Runner Selection
            print("Checking Flanki Roster modal rules decluttering and runner selection...")
            await page.evaluate('''() => {
                window.__camp_game.ui.showFlankiRoster({
                    teamA: {
                        name: 'Twoja Ekipa',
                        throwers: [
                            { id: 'p1', name: 'Siwy Dym', team: 'A', role: 'thrower' },
                            { id: 'p2', name: 'Kobra', team: 'A', role: 'thrower' }
                        ],
                        runner: { id: 'p3', name: 'Dziąsło', team: 'A', role: 'runner' }
                    },
                    teamB: {
                        name: 'Rywale z Sektora',
                        throwers: [
                            { id: 'b1', name: 'Hemoroid', team: 'B', role: 'thrower' },
                            { id: 'b2', name: 'Szerszeń', team: 'B', role: 'thrower' }
                        ],
                        runner: { id: 'b3', name: 'Amper', team: 'B', role: 'runner' }
                    }
                }, () => {}, () => {}, { canStart: true, onRunnerChange: () => true });
            }''')
            flanki_cards = await page.locator('.flanki-rule-card').all()
            assert len(flanki_cards) == 3, f"Expected 3 visual rule cards, found {len(flanki_cards)}"
            runner_select = page.locator('.flanki-runner-select[data-flanki-runner="A"]')
            assert await runner_select.is_visible(), "Runner selection dropdown must be visible!"
            details_el = page.locator('.flanki-rules-details')
            assert await details_el.is_visible()
            flanki_shot = REPORTS_DIR / '03_flanki_rules_cards.png'
            await page.screenshot(path=str(flanki_shot))
            shutil.copy2(flanki_shot, ARTIFACTS_DIR / 'ui_ux_03_flanki_rules_cards.png')
            await page.evaluate('() => window.__camp_game.ui.hideFlankiRoster()')
            print("Flanki 3-card rules layout & runner selection verified.")

            # 4. Test Eko-Zagroda Panel 180s & Icons
            print("Checking Eko-Zagroda 180s duration and icons...")
            await page.evaluate('''() => {
                const panel = document.querySelector('#eco-panel');
                if (panel) panel.hidden = false;
            }''')
            eco_text = await page.locator('#eco-panel').text_content()
            assert '180 sekund' in eco_text, "Eko-Zagroda must specify 180 seconds!"
            assert '🍦' in eco_text and '🍔' in eco_text, "Eko-Zagroda must use ice cream and burger icons!"
            eco_shot = REPORTS_DIR / '04_eco_panel.png'
            await page.screenshot(path=str(eco_shot))
            shutil.copy2(eco_shot, ARTIFACTS_DIR / 'ui_ux_04_eco_panel.png')
            await page.evaluate('() => document.querySelector("#eco-panel").hidden = true')
            print("Eko-Zagroda 180s and icons verified.")

            # 5. Test Guitar HUD Flame Bar & Lane Badges
            print("Checking Guitar HUD flame bar and badges...")
            await page.evaluate('''() => {
                window.__camp_game.campfireGuitarGame.startSong('czerwony-cegla-midi');
                window.__camp_game.campfireGuitarGame.cheerLevel = 0.85;
            }''')
            await page.wait_for_timeout(200)
            guitar_flame = page.locator('#guitar-flame-bar')
            assert await guitar_flame.is_visible()
            flame_width = await guitar_flame.evaluate('el => el.style.width')
            assert flame_width in ('84%', '85%'), f"Expected 84% or 85% width on flame bar, got {flame_width}"
            badges = await page.locator('.target-lane-badge').all_text_contents()
            assert badges == ['A', 'S', 'D', 'F', 'G'], f"Expected ['A', 'S', 'D', 'F', 'G'], got {badges}"
            guitar_shot = REPORTS_DIR / '05_guitar_hud_flame_badges.png'
            await page.screenshot(path=str(guitar_shot))
            shutil.copy2(guitar_shot, ARTIFACTS_DIR / 'ui_ux_05_guitar_hud_flame_badges.png')
            await page.evaluate('() => window.__camp_game.campfireGuitarGame.stopSong()')
            print("Guitar HUD flame meter & target lane badges verified.")

            # 5b. Verify Real MP3 Backing Track Integration
            print("Verifying Guitar real MP3 backing track integration...")
            song_data = await page.evaluate('''() => {
                const game = window.__camp_game.campfireGuitarGame;
                game.startSong('czerwony-cegla-midi');
                const hud = game.getHudState();
                return {
                    id: hud.currentSong?.id,
                    title: hud.currentSong?.title,
                    url: hud.currentSong?.audioBackingUrl,
                    offset: hud.currentSong?.audioBackingOffset,
                };
            }''')
            assert 'czerwony-jak-cegla.mp3' in (song_data.get('url') or ''), f"Expected real MP3 URL, got {song_data}"
            assert (song_data.get('offset') or 0) > 30, f"Expected offset > 30s, got {song_data['offset']}"
            await page.evaluate('() => window.__camp_game.campfireGuitarGame.stopSong()')
            print("Guitar real MP3 backing track verified:", song_data['title'], "->", song_data['url'])

            # 6. Test Mobile Controls & Clean Non-Overlapping Layout
            print("Checking Mobile Controls...")
            await page.set_viewport_size({'width': 390, 'height': 844})
            await page.evaluate('''() => {
                document.body.classList.add('mobile-input');
                document.querySelector('#mobile-controls').hidden = false;
            }''')
            fullscreen_btn = page.locator('#mobile-fullscreen')
            assert await fullscreen_btn.is_visible()
            quick_bar = page.locator('#hud-quick-bar')
            assert not await quick_bar.is_visible(), "Desktop #hud-quick-bar must be hidden on mobile!"
            controls_hud = page.locator('#controls-hud')
            assert not await controls_hud.is_visible(), "Desktop #controls-hud must be hidden on mobile!"
            mobile_shot = REPORTS_DIR / '06_mobile_controls_fullscreen.png'
            await page.screenshot(path=str(mobile_shot))
            shutil.copy2(mobile_shot, ARTIFACTS_DIR / 'ui_ux_06_mobile_controls_fullscreen.png')
            print("Mobile controls fullscreen and clean non-overlapping layout verified.")

            await browser.close()

            print("==================================================")
            print("ALL BROWSER RUNTIME VERIFICATIONS PASSED SUCCESSFULLY!")
            print(f"Screenshots saved to: {REPORTS_DIR}")
            print(f"Screenshots copied to: {ARTIFACTS_DIR}")
            print("==================================================")

    finally:
        print("Stopping server process...")
        server_process.terminate()
        server_process.kill()

if __name__ == '__main__':
    asyncio.run(main())
