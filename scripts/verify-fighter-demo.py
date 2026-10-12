import asyncio
import http.server
import threading
from pathlib import Path
from playwright.async_api import async_playwright

root_dir = Path(__file__).resolve().parents[1]
dist_dir = root_dir / 'dist'

class KurwaMojePoleHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(dist_dir), **kwargs)

    def translate_path(self, path):
        if path.startswith('/kurwa-moje-pole'):
            path = path[len('/kurwa-moje-pole'):]
            if not path or path == '/':
                path = '/fighter-demo.html'
        return super().translate_path(path)

    def log_message(self, format, *args):
        pass

async def main():
    artifact_dir = Path('C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0')
    select_screenshot = artifact_dir / 'fighter_2d_character_select.png'
    gameplay_screenshot = artifact_dir / 'fighter_2d_gameplay.png'
    super_screenshot = artifact_dir / 'fighter_2d_super_move.png'
    grzybek_screenshot = artifact_dir / 'fighter_2d_stage_grzybek.png'
    sunset_screenshot = artifact_dir / 'fighter_2d_stage_sunset_camp.png'

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 5195), KurwaMojePoleHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required']
            )
            context = await browser.new_context(
                viewport={'width': 932, 'height': 430},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True
            )
            page = await context.new_page()

            console_errors = []
            page.on('pageerror', lambda e: console_errors.append(str(e)))
            page.on('console', lambda msg: print(f"Browser console [{msg.type}]: {msg.text}") if msg.type in ['error', 'warning'] else None)

            url = 'http://127.0.0.1:5195/kurwa-moje-pole/fighter-demo.html'
            print(f"Navigating to {url}...")
            await page.goto(url, wait_until='networkidle')

            # 1. Capture Character Select Screen with Stage Select Bar
            await page.wait_for_timeout(1000)
            amper_card = page.locator('.roster-card[data-key="amper"]')
            if await amper_card.count() > 0:
                print("Clicking Amper card in roster...")
                await amper_card.click()
                await page.wait_for_timeout(300)

            print(f"Capturing Character Select screenshot to {select_screenshot}...")
            await page.screenshot(path=str(select_screenshot))

            # 2. Test Main Stage Fight
            bot_toggle = page.locator('#fight-mode')
            if await bot_toggle.count() > 0:
                await bot_toggle.select_option("training")

            start_btn = page.locator('#start-fight-btn')
            if await start_btn.count() > 0:
                print("Starting fight on Main Stage...")
                await start_btn.click()
                await page.wait_for_timeout(1800)

            # Walk close and launch
            right_btn = page.locator('[data-input="8"]')
            await right_btn.dispatch_event('pointerdown')
            await page.wait_for_timeout(1100)
            await right_btn.dispatch_event('pointerup')
            await page.wait_for_timeout(80)

            down_btn = page.locator('[data-input="2"]')
            rp_btn = page.locator('[data-input="32"]')
            await down_btn.dispatch_event('pointerdown')
            await page.wait_for_timeout(70)
            await rp_btn.dispatch_event('pointerdown')
            await page.wait_for_timeout(60)
            await rp_btn.dispatch_event('pointerup')
            await down_btn.dispatch_event('pointerup')
            await page.wait_for_timeout(250)

            print(f"Capturing Main Stage screenshot to {gameplay_screenshot}...")
            await page.screenshot(path=str(gameplay_screenshot))

            # Trigger Super Move (SP button: data-input="256")
            # Wait for launch recovery back to neutral stance
            await page.wait_for_timeout(800)
            # Charge P1 meter to 100% so Super Move is enabled
            await page.evaluate("() => { if (window.__fighterSim) window.__fighterSim.state.p1.meter = 100; }")
            sp_btn = page.locator('[data-input="256"]')
            if await sp_btn.count() > 0:
                print("Triggering Amper Super Move (Lusterko Eleganta with 100% meter)...")
                await sp_btn.dispatch_event('pointerdown')
                await page.wait_for_timeout(100)
                await sp_btn.dispatch_event('pointerup')
                await page.wait_for_timeout(320)
                print(f"Capturing Super Move cinematic screenshot to {super_screenshot}...")
                await page.screenshot(path=str(super_screenshot))
                await page.wait_for_timeout(1600)

            # 3. Test Grzybek Stage
            print("Switching to Grzybek stage...")
            char_select_btn = page.locator('#char-select-btn')
            await char_select_btn.click()
            await page.wait_for_timeout(400)

            grzybek_chip = page.locator('.stage-chip[data-stage="grzybek"]')
            if await grzybek_chip.count() > 0:
                await grzybek_chip.click()
                await page.wait_for_timeout(300)

            await start_btn.click()
            await page.wait_for_timeout(1200)

            print(f"Capturing Grzybek Stage screenshot to {grzybek_screenshot}...")
            await page.screenshot(path=str(grzybek_screenshot))

            # 4. Test Sunset Camp Stage
            print("Switching to Sunset Camp stage...")
            await char_select_btn.click()
            await page.wait_for_timeout(400)

            sunset_chip = page.locator('.stage-chip[data-stage="sunset_camp"]')
            if await sunset_chip.count() > 0:
                await sunset_chip.click()
                await page.wait_for_timeout(300)

            await start_btn.click()
            await page.wait_for_timeout(1200)

            print(f"Capturing Sunset Camp Stage screenshot to {sunset_screenshot}...")
            await page.screenshot(path=str(sunset_screenshot))

            # 5. Test Krishna Village Stage
            krishna_screenshot = artifact_dir / 'fighter_2d_stage_krishna_village.png'
            print("Switching to Krishna Village stage...")
            await char_select_btn.click()
            await page.wait_for_timeout(400)

            krishna_chip = page.locator('.stage-chip[data-stage="krishna_village"]')
            if await krishna_chip.count() > 0:
                await krishna_chip.click()
                await page.wait_for_timeout(300)

            await start_btn.click()
            await page.wait_for_timeout(1200)

            print(f"Capturing Krishna Village Stage screenshot to {krishna_screenshot}...")
            await page.screenshot(path=str(krishna_screenshot))

            if console_errors:
                print(f"Console errors detected: {console_errors}")
            else:
                print("Clean run with 0 console errors!")

            await browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    asyncio.run(main())
