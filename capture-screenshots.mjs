import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const tests = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
];

const tabs = [
  { name: 'Gallery', url: 'http://localhost:5173/' },
  { name: 'Dashboard', url: 'http://localhost:5173/#/d' },
];

async function run() {
  console.log('Capturing responsive screenshots...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const bp of tests) {
    for (const tab of tabs) {
      try {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await Promise.race([
          page.goto(tab.url, { waitUntil: 'load' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
        ]).catch(() => {});
        await page.waitForTimeout(800);

        const filename = `screenshot-${bp.name.toLowerCase()}-${tab.name.toLowerCase()}.png`;
        await page.screenshot({ path: filename });
        console.log(`✓ ${filename}`);
      } catch (e) {
        console.log(`✗ ${bp.name}/${tab.name}: ${e.message}`);
      }
    }
  }

  await browser.close();
}

run().catch(console.error);
