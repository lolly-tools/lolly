import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  await page.goto('http://localhost:5174/#/start', { waitUntil: 'networkidle' });

  // Wait for brand studio to load
  try {
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 });
  } catch {
    console.log('Tab list not found immediately, continuing...');
  }
  await page.waitForTimeout(2000);

  // Get all tabs
  const tabs = await page.evaluate(() => {
    const tabButtons = Array.from(document.querySelectorAll('[role="tab"]'));
    return tabButtons.map((tab, idx) => ({
      index: idx,
      text: tab.textContent.trim(),
      ariaSelected: tab.getAttribute('aria-selected')
    }));
  });

  console.log('Found tabs:', tabs);

  // Screenshot each tab
  for (let i = 0; i < tabs.length; i++) {
    const tabButtons = await page.locator('[role="tab"]');
    const count = await tabButtons.count();
    if (i < count) {
      await tabButtons.nth(i).click();
      await page.waitForTimeout(800);
      const tabName = tabs[i].text.replace(/\s+/g, '-').toLowerCase();
      await page.screenshot({ path: `/Users/andy/Build/lolly/brand-studio-tab-${i}-${tabName}.png` });
      console.log(`Screenshot saved: brand-studio-tab-${i}-${tabName}.png`);
    }
  }

  await context.close();
  await browser.close();
  console.log('Done');
})();
