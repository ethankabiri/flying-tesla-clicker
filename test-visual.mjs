import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(10000);
    page.setDefaultTimeout(10000);
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    
    // Wait for scene to render
    await new Promise(r => setTimeout(r, 3000));
    
    // Take screenshot
    await page.screenshot({ path: 'screenshot.png', fullPage: false });
    console.log('✓ Screenshot saved to screenshot.png');
    
    // Get canvas size
    const size = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return { width: canvas?.width || 0, height: canvas?.height || 0 };
    });
    console.log(`✓ Canvas size: ${size.width}x${size.height}`);
    
    // Check if game UI is visible
    const ui = await page.evaluate(() => {
      const hud = document.querySelector('#hud-top');
      const title = document.querySelector('#title');
      return {
        hudVisible: hud && getComputedStyle(hud).display !== 'none',
        titleVisible: title && getComputedStyle(title).display !== 'none'
      };
    });
    console.log(`✓ HUD visible: ${ui.hudVisible}, Title visible: ${ui.titleVisible}`);
    
  } catch (e) {
    console.error('✗ Error:', e.message);
  } finally {
    await browser.close();
  }
})();
