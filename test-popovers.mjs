import { chromium } from 'playwright';

const tests = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
];

async function run() {
  console.log('Testing Popover & Modal Behavior');
  console.log('='.repeat(70));
  
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const bp of tests) {
    console.log(`\n${bp.name} (${bp.width}x${bp.height})`);
    console.log('-'.repeat(70));
    
    try {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await Promise.race([
        page.goto('http://localhost:5173/', { waitUntil: 'load' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
      ]).catch(() => {});
      await page.waitForTimeout(800);

      // Check for popover/modal elements
      const modals = await page.evaluate(() => {
        const elements = document.querySelectorAll('[role="dialog"], dialog, [class*="modal"], [class*="popover"], [class*="overlay"]');
        const result = [];
        elements.forEach(el => {
          if (el.offsetParent) {
            const rect = el.getBoundingClientRect();
            result.push({
              tag: el.tagName,
              role: el.getAttribute('role'),
              className: el.className.substring(0, 30),
              visible: rect.width > 0 && rect.height > 0,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              top: Math.round(rect.top),
              left: Math.round(rect.left)
            });
          }
        });
        return result;
      });

      if (modals.length > 0) {
        console.log(`Found ${modals.length} modal/popover elements:`);
        modals.slice(0, 5).forEach(m => {
          console.log(`  ${m.tag} (${m.role}): ${m.width}×${m.height}px at (${m.left}, ${m.top})`);
          if (m.width > bp.width * 0.9) {
            console.log(`    ⚠ Modal nearly fills viewport (${m.width}px vs ${bp.width}px width)`);
          }
          if (m.width < 200 && m.width > 0) {
            console.log(`    ✓ Modal properly sized for small screen`);
          }
        });
      } else {
        console.log('No modals/popovers currently visible');
      }

      // Try clicking a button that might open a modal
      const buttons = await page.locator('button').all();
      console.log(`\nInteractive elements found:`);
      console.log(`  Buttons: ${buttons.length}`);

      // Check sidebar accessibility
      const sidebar = await page.locator('nav, [class*="sidebar"]').first();
      if (await sidebar.isVisible()) {
        const box = await sidebar.boundingBox();
        console.log(`  Sidebar: visible, ${Math.round(box.width)}px wide`);
      } else {
        const hamburger = await page.locator('button[aria-label*="menu"]').first();
        if (await hamburger.isVisible()) {
          console.log(`  Sidebar: accessible via hamburger menu`);
        } else {
          console.log(`  Sidebar: not clearly accessible`);
        }
      }

    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  await browser.close();
}

run().catch(console.error);
