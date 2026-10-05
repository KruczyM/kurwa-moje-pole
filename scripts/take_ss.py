import asyncio
from playwright.async_api import async_playwright
import os

models = ['008_grunge_flannel_rocker', '015_feather_headband_hippie', '050_blue_alien_girl', '052_muddy_sneakers_rocker', '070_vintage_denim_shorts', '072_rave_bucket_hat', '078_girl_with_guitar', '087_neon_raver', '089_peace_hippie']

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        html_path = r'file:///E:/kodowanie/gra/scripts/viewer.html'
        await page.goto(html_path)
        
        out_dir = r'C:\Users\krucz\.gemini\antigravity\brain\d81ba138-3200-4466-b868-2f212dff67d0\screenshots_3d'
        os.makedirs(out_dir, exist_ok=True)
        
        for m in models:
            url = f'file:///E:/kodowanie/gra/public/game-assets/npc_models/{m}.glb'
            await page.evaluate(f"loadModel('{url}')")
            await page.wait_for_timeout(2000)
            screenshot_path = os.path.join(out_dir, f'{m}.png')
            await page.locator('model-viewer').screenshot(path=screenshot_path)
            print(f'Screenshot saved for {m}')
            
        await browser.close()

asyncio.run(main())

