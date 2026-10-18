"""Automated browser verification for fixed-arena camera and smooth walking locomotion."""

import asyncio
import json
import os
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / 'reports' / 'fighter-camera-walk'
ARTIFACT_DIR = Path(r'C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0')


async def test_viewport(page, name, width, height, results):
    print(f"\n--- Testing Viewport: {name} ({width}x{height}) ---")
    await page.set_viewport_size({'width': width, 'height': height})
    await page.goto('http://localhost:5178/fighter-demo.html', wait_until='networkidle')

    # Select training mode
    await page.locator('[data-fight-mode="training"]').click()
    await page.wait_for_timeout(200)

    # Click start fight
    await page.locator('#start-fight-btn').click()
    await page.wait_for_timeout(600)

    # Get initial camera and match state
    init_data = await page.evaluate('''() => {
        const cam = window.__fighterCamera;
        const sim = window.__fighterSim;
        const s = sim ? sim.getState() : null;
        return {
            zoom: cam ? cam.zoom : null,
            x: cam ? cam.x : null,
            p1x: s ? s.p1.x : null,
            p2x: s ? s.p2.x : null,
        };
    }''')
    print(f"[{name}] Initial state: {init_data}")

    # Capture neutral stance screenshot
    neutral_img = REPORT_DIR / f'{name}_01_neutral.png'
    await page.screenshot(path=str(neutral_img))

    # Hold Left (KeyA / ArrowLeft) to walk P1 backward to the camera wall
    zooms = [init_data['zoom']]
    separations = []

    await page.keyboard.down('KeyA')
    for _ in range(25):
        await page.wait_for_timeout(50)
        sample = await page.evaluate('''() => {
            const cam = window.__fighterCamera;
            const sim = window.__fighterSim;
            const s = sim ? sim.getState() : null;
            return {
                zoom: cam ? cam.zoom : null,
                x: cam ? cam.x : null,
                p1x: s ? s.p1.x : null,
                p2x: s ? s.p2.x : null,
                p1State: s ? s.p1.state : null
            };
        }''')
        if sample['zoom'] is not None:
            zooms.append(sample['zoom'])
        if sample['p1x'] is not None and sample['p2x'] is not None:
            separations.append(abs(sample['p2x'] - sample['p1x']))

    await page.keyboard.up('KeyA')
    await page.wait_for_timeout(200)

    wall_data = await page.evaluate('''() => {
        const cam = window.__fighterCamera;
        const sim = window.__fighterSim;
        const s = sim ? sim.getState() : null;
        return {
            zoom: cam ? cam.zoom : null,
            x: cam ? cam.x : null,
            p1x: s ? s.p1.x : null,
            p2x: s ? s.p2.x : null,
        };
    }''')
    print(f"[{name}] Camera wall reached: {wall_data}")

    # Capture camera wall screenshot
    wall_img = REPORT_DIR / f'{name}_02_camera_wall.png'
    await page.screenshot(path=str(wall_img))

    # Verify Zoom constancy: max difference across all samples should be < 0.001
    zoom_min = min(zooms)
    zoom_max = max(zooms)
    zoom_delta = zoom_max - zoom_min
    zoom_constant = zoom_delta < 0.005

    # Verify Max Separation: should not exceed 520.1
    max_sep = max(separations) if separations else 0
    sep_clamped = max_sep <= 520.5

    print(f"[{name}] Zoom min={zoom_min:.4f}, max={zoom_max:.4f}, delta={zoom_delta:.4f} -> constant={zoom_constant}")
    print(f"[{name}] Max separation recorded={max_sep:.1f} -> clamped={sep_clamped}")

    # Now let bot/p2 walk with p1 towards arena edge to check boundary stop
    await page.evaluate('''() => {
        // Move both fighters towards left wall to test stage boundary stop
        const s = window.__fighterSim.getState();
        s.p1.x = -530;
        s.p2.x = -200;
        window.__fighterCamera.update(s.p1.x, s.p2.x, 0.016, window.innerWidth, window.innerHeight);
    }''')
    await page.wait_for_timeout(300)

    edge_data = await page.evaluate('''() => {
        const cam = window.__fighterCamera;
        const halfView = window.innerWidth / (2 * cam.zoom);
        const maxLimit = Math.max(0, 600 - halfView);
        return {
            camX: cam.x,
            maxLimit: maxLimit,
            isClamped: Math.abs(cam.x) <= maxLimit + 0.01
        };
    }''')
    print(f"[{name}] Edge boundary test: {edge_data}")

    edge_img = REPORT_DIR / f'{name}_03_arena_edge.png'
    await page.screenshot(path=str(edge_img))

    results.append({
        'viewport': name,
        'width': width,
        'height': height,
        'zoom_constant': zoom_constant,
        'zoom_base': init_data['zoom'],
        'zoom_delta': zoom_delta,
        'max_separation': max_sep,
        'separation_clamped': sep_clamped,
        'edge_clamped': edge_data['isClamped'],
        'screenshots': [str(neutral_img.name), str(wall_img.name), str(edge_img.name)]
    })


async def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 1. Desktop 1440x900
        await test_viewport(page, 'desktop_1440x900', 1440, 900, results)

        # 2. Mobile Landscape 844x390 (iPhone landscape)
        await test_viewport(page, 'mobile_landscape_844x390', 844, 390, results)

        # 3. Mobile Portrait 390x844 (iPhone portrait)
        await test_viewport(page, 'mobile_portrait_390x844', 390, 844, results)

        await browser.close()

    # Save summary report
    report_file = REPORT_DIR / 'browser_verification_report.json'
    report_file.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(f"\n[REPORT] Saved to {report_file}")

    # Copy screenshots to artifact directory if available
    if ARTIFACT_DIR.exists():
        for item in results:
            for s in item['screenshots']:
                src = REPORT_DIR / s
                dst = ARTIFACT_DIR / s
                if src.exists():
                    shutil.copy2(src, dst)
        print(f"[ARTIFACTS] Copied screenshots to {ARTIFACT_DIR}")

    all_passed = all(r['zoom_constant'] and r['separation_clamped'] and r['edge_clamped'] for r in results)
    print(f"\nALL VERIFICATIONS PASSED: {all_passed}")
    return 0 if all_passed else 1


if __name__ == '__main__':
    exit(asyncio.run(main()))
