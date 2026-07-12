import { chromium } from 'playwright';

const tests = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
];

const tabs = [
  { name: 'Gallery', url: 'http://localhost:5173/' },
  { name: 'Dashboard', url: 'http://localhost:5173/#/d' },
  { name: 'Catalog', url: 'http://localhost:5173/#/c' },
];

async function checkScrolling(page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  return result.scrollWidth > result.clientWidth;
}

async function testBreakpoint(page, bp, tab) {
  try {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await Promise.race([
      page.goto(tab.url, { waitUntil: 'load' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
    ]).catch(() => {});
    
    await page.waitForTimeout(500);
    const hasHScroll = await checkScrolling(page);
    return { tab: tab.name, hasHScroll };
  } catch (e) {
    return { tab: tab.name, error: e.message };
  }
}

async function run() {
  console.log('Starting responsive tests...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const bp of tests) {
    console.log(`\n${bp.name} (${bp.width}x${bp.height})`);
    for (const tab of tabs) {
      const r = await testBreakpoint(page, bp, tab);
      if (r.error) {
        console.log(`  ${r.tab}: ERROR - ${r.error}`);
      } else {
        console.log(`  ${r.tab}: ${r.hasHScroll ? '✗ Horizontal scroll detected' : '✓ OK'}`);
      }
    }
  }

  await browser.close();
  console.log('\nDone.');
}

run().catch(console.error);
