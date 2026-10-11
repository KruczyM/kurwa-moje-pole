"""Production smoke test with iPhone profile; accepts local preview or published Pages URL."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    """Check compiled entry, touch controls and absence of heavyweight festival requests."""
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5188/kurwa-moje-pole/after-demo.html'
    out = Path(__file__).resolve().parents[1] / 'reports/after-demo'
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.webkit.launch(headless=True)
        try:
            context = await browser.new_context(**p.devices['iPhone 13'])
            page = await context.new_page()
            errors, requests, failed = [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda request: requests.append(request.url))
            page.on('response', lambda response: failed.append(response.url) if response.status >= 400 else None)
            response = await page.goto(url)
            assert response.status == 200, response.status
            await page.wait_for_function('()=>document.querySelector("#begin")?.disabled===false', timeout=60000)
            await page.locator('#begin').tap()
            await page.wait_for_timeout(500)
            assert not await page.locator('#start').is_visible()
            assert await page.locator('#controls').is_visible()
            await page.locator('#pause').tap()
            assert await page.locator('#pause-panel').is_visible()
            await page.locator('#resume').tap()
            assert not await page.locator('#pause-panel').is_visible()
            await page.screenshot(path=str(out / 'production-iphone.png'))
            assert not await page.evaluate('()=>"__afterDemo" in window')
            assert not errors and not failed, (errors, failed)
            assert not any('.glb' in u or '/src/' in u or 'socket.io' in u or '.mp4' in u for u in requests)
            report = {'url': url, 'http': 200, 'compiledEntry': True, 'touchStartPauseResume': True,
                      'pageErrors': errors, 'httpErrors': failed, 'no3dOrServerRequests': True}
            (out / 'production.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            print(json.dumps(report, indent=2))
        finally:
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
