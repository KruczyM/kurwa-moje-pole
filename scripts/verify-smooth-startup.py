"""Browser verification for startup preloading and smooth framerate without stutter."""
import asyncio
import json
import time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT_FILE = ROOT / 'reports/startup-preload-verification-report.json'
REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
ARTIFACT_DIR = Path(r"C:\Users\krucz\.gemini\antigravity\brain\0f469478-5ced-4cb0-85a6-506fc5188eb0")

async def main():
    errors = []
    progress_samples = []

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
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda msg: print(f"BROWSER: [{msg.type}] {msg.text}"))

        print("Navigating to http://localhost:5173/ ...", flush=True)
        await page.goto('http://localhost:5173/', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        await page.locator('#player-nickname').fill('PreloadTester')

        # Click play button
        print("Clicking #play...", flush=True)
        await page.locator('#play').click()

        # Monitor loading screen
        start_time = time.time()
        loading_screenshot_taken = False

        while time.time() - start_time < 90:
            try:
                is_loading = await page.evaluate("() => document.querySelector('#loading') && !document.querySelector('#loading').hidden")
                text = await page.evaluate("() => document.querySelector('#load-text')?.textContent || ''")
                bar_width = await page.evaluate("() => document.querySelector('#load-progress-bar')?.style.width || ''")
                app_state = await page.evaluate("() => window.__camp_game?.state?.current || 'unknown'")

                if is_loading:
                    progress_samples.append({'time': round(time.time() - start_time, 2), 'text': text, 'bar': bar_width})
                    if 'Wczytywanie festiwalowiczów' in text and not loading_screenshot_taken:
                        print(f"Captured progress: {text} (bar: {bar_width})", flush=True)
                        loading_screen_path = ARTIFACT_DIR / 'loading_screen_progress.png'
                        await page.screenshot(path=str(loading_screen_path))
                        loading_screenshot_taken = True
                
                if app_state == 'playing':
                    print(f"App entered playing state at {round(time.time() - start_time, 2)}s!", flush=True)
                    break
            except Exception as e:
                # transient context shift
                await asyncio.sleep(0.5)
                continue

            await asyncio.sleep(0.3)

        await page.wait_for_timeout(1000)

        # Verify in-game state
        game_stats = await page.evaluate('''() => {
            const g = window.__camp_game;
            if (!g) return null;
            return {
                state: g.state.current,
                npcCount: g.npcs?.npcs?.length ?? 0,
                playerActive: !!g.player?.enabled,
                cameraPosition: { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z },
                drawCalls: g.renderer?.info?.render?.calls ?? 0,
                triangles: g.renderer?.info?.render?.triangles ?? 0,
                textures: g.renderer?.info?.memory?.textures ?? 0,
                geometries: g.renderer?.info?.memory?.geometries ?? 0,
                programs: g.renderer?.info?.programs?.length ?? 0
            };
        }''')

        print("Game stats:", game_stats, flush=True)

        # Measure 60 frames for frame stability
        frame_metrics = await page.evaluate('''() => new Promise(resolve => {
            const deltas = [];
            let last = performance.now();
            let count = 0;
            function onFrame() {
                const now = performance.now();
                deltas.push(now - last);
                last = now;
                count++;
                if (count < 60) {
                    requestAnimationFrame(onFrame);
                } else {
                    resolve({
                        avgMs: deltas.reduce((a, b) => a + b, 0) / deltas.length,
                        maxMs: Math.max(...deltas),
                        minMs: Math.min(...deltas),
                        samples: deltas
                    });
                }
            }
            requestAnimationFrame(onFrame);
        })''')

        print("Frame pacing metrics over 60 frames:", {
            'avgMs': round(frame_metrics['avgMs'], 2),
            'maxMs': round(frame_metrics['maxMs'], 2),
            'minMs': round(frame_metrics['minMs'], 2)
        }, flush=True)

        # Capture in-game gameplay screenshot
        gameplay_screenshot_path = ARTIFACT_DIR / 'gameplay_smooth_startup.png'
        await page.screenshot(path=str(gameplay_screenshot_path))

        report_data = {
            'timestamp': time.time(),
            'errors': errors,
            'progressSampleCount': len(progress_samples),
            'lastProgressSample': progress_samples[-1] if progress_samples else None,
            'gameStats': game_stats,
            'frameMetrics': {
                'avgMs': frame_metrics['avgMs'],
                'maxMs': frame_metrics['maxMs'],
                'minMs': frame_metrics['minMs'],
                'fps': round(1000.0 / max(0.1, frame_metrics['avgMs']), 1)
            }
        }

        with open(REPORT_FILE, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)

        print(f"Report written to {REPORT_FILE}", flush=True)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
