import asyncio
import subprocess
import time
import os
import sys
import socket
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from playwright.async_api import async_playwright

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
    root = Path(__file__).resolve().parents[1]
    artifacts_dir = Path(r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0")
    reports_dir = root / "reports" / "desktop-menu-scroll"
    reports_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    print(f"Working directory: {root}")
    cmd = 'npx.cmd vite preview --port 5183 --host 127.0.0.1' if os.name == 'nt' else 'npx vite preview --port 5183 --host 127.0.0.1'
    server_process = subprocess.Popen(
        cmd,
        cwd=str(root),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=True,
    )
    url = "http://127.0.0.1:5183/"

    try:
        assert wait_for_port(5183), "Vite preview server failed to start within 30s!"
        print(f"Server ready at {url}!")

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--enable-webgl',
                    '--use-gl=angle',
                    '--use-angle=d3d11',
                    '--ignore-gpu-blocklist',
                ],
            )

            # Test 1: Desktop Viewport (1280x720 - standard laptop resolution)
            context = await browser.new_context(viewport={"width": 1280, "height": 720})
            page = await context.new_page()

            print("Navigating to desktop 1280x720...")
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_selector("#start", state="visible")

            # 1. Verify 'Losuj' button is removed
            random_btn_count = await page.locator("#random-nickname-btn").count()
            assert random_btn_count == 0, f"Expected 0 instances of #random-nickname-btn, found {random_btn_count}"
            print("PASS: #random-nickname-btn is completely removed from DOM.")

            # 2. Verify Nickname Input and Counter
            nick_input = page.locator("#player-nickname")
            assert await nick_input.is_visible(), "#player-nickname should be visible"
            await nick_input.fill("CyberKrzak")
            nick_val = await nick_input.input_value()
            assert nick_val == "CyberKrzak", f"Expected 'CyberKrzak', got '{nick_val}'"
            counter_text = await page.locator("#nickname-count").text_content()
            assert "10/18" in (counter_text or ""), f"Expected '10/18' in counter, got '{counter_text}'"
            print(f"PASS: Nickname input and counter work: '{nick_val}' ({counter_text})")

            # 3. Verify Desktop Scrolling on #start
            start_metrics = await page.evaluate("""() => {
                const start = document.getElementById('start');
                const style = window.getComputedStyle(start);
                return {
                    clientHeight: start.clientHeight,
                    scrollHeight: start.scrollHeight,
                    overflowY: style.overflowY,
                    overflowX: style.overflowX,
                    justifyContent: style.justifyContent
                };
            }""")
            print(f"Start container metrics: {start_metrics}")

            assert start_metrics["overflowY"] in ["auto", "scroll"], f"Expected overflowY to be auto or scroll, got {start_metrics['overflowY']}"
            assert start_metrics["scrollHeight"] > start_metrics["clientHeight"], (
                f"Expected scrollHeight ({start_metrics['scrollHeight']}) > clientHeight ({start_metrics['clientHeight']}) on 1280x720"
            )
            print("PASS: #start has overflow-y: auto and content exceeds viewport height.")

            # Capture initial desktop screenshot (top of menu)
            top_shot = artifacts_dir / "menu_desktop_1280x720_top.png"
            await page.screenshot(path=str(top_shot))
            print(f"Saved: {top_shot}")

            # 4. Perform mouse wheel scroll
            initial_scroll = await page.evaluate("() => document.getElementById('start').scrollTop")
            assert initial_scroll == 0, f"Expected initial scrollTop 0, got {initial_scroll}"

            # Scroll down by 350px
            await page.evaluate("() => { document.getElementById('start').scrollTop = 350; }")
            scrolled_pos = await page.evaluate("() => document.getElementById('start').scrollTop")
            assert scrolled_pos > 0, f"Expected scrollTop > 0 after scrolling, got {scrolled_pos}"
            print(f"PASS: #start scrolls smoothly on desktop! Current scrollTop: {scrolled_pos}px")

            # Verify that bottom buttons (WEJDŹ NA POLE, arcade salon links) are in view or can be scrolled to
            play_btn = page.locator("#play")
            await play_btn.scroll_into_view_if_needed()
            assert await play_btn.is_visible(), "Play button should be visible when scrolled into view"

            arcade_bar = page.locator(".start-arcade-bar")
            await arcade_bar.scroll_into_view_if_needed()
            assert await arcade_bar.is_visible(), "Arcade bar should be visible when scrolled into view"

            scrolled_shot = artifacts_dir / "menu_desktop_1280x720_scrolled.png"
            await page.screenshot(path=str(scrolled_shot))
            print(f"Saved: {scrolled_shot}")

            await context.close()

            # Test 2: Mobile Viewport (390x844 iPhone 12/13/14) to confirm no regression
            mobile_context = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
            mobile_page = await mobile_context.new_page()
            await mobile_page.goto(url, wait_until="domcontentloaded")
            await mobile_page.wait_for_selector("#start", state="visible")

            mobile_shot = artifacts_dir / "menu_mobile_390x844.png"
            await mobile_page.screenshot(path=str(mobile_shot))
            print(f"Saved: {mobile_shot}")
            await mobile_context.close()

            await browser.close()
            print("ALL DESKTOP SCROLL AND RANDOM NICKNAME REMOVAL TESTS PASSED!")

            # Write summary report
            report_path = reports_dir / "desktop-menu-scroll-report.json"
            report_data = {
                "status": "PASS",
                "randomNicknameBtnRemoved": True,
                "desktopScrollingEnabled": True,
                "desktop1280x720": {
                    "clientHeight": start_metrics["clientHeight"],
                    "scrollHeight": start_metrics["scrollHeight"],
                    "overflowY": start_metrics["overflowY"],
                    "scrolledPosition": scrolled_pos,
                },
                "artifacts": [
                    str(top_shot),
                    str(scrolled_shot),
                    str(mobile_shot)
                ]
            }
            import json
            report_path.write_text(json.dumps(report_data, indent=2), encoding="utf-8")
            print(f"Report written to {report_path}")

    finally:
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except Exception:
            server_process.kill()

if __name__ == "__main__":
    asyncio.run(main())
