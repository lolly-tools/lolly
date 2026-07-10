import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 1800 } });
await page.goto('http://localhost:5173/#/d?tab=device', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200);
// Click each summary to collapse them
for (const id of ['dash-device', 'dash-sound-theme', 'dash-storage']) {
  await page.click(`#${id} summary`);
}
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close();
console.log('saved');
