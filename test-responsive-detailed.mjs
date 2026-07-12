import { chromium } from 'playwright';

const tests = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
];

const tabs = [
  { name: 'Gallery', url: 'http://localhost:5173/' },
  { name: 'Dashboard', url: 'http://localhost:5173/#/d' },
  { name: 'Catalog', url: 'http://localhost:5173/#/c' },
  { name: 'Projects', url: 'http://localhost:5173/#/p' },
];

async function analyzeLayout(page, width) {
  return await page.evaluate((w) => {
    const results = {
      hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      smallTouchTargets: [],
      gridElements: 0,
      navVisible: false,
      sidebarVisible: false,
      hamburgerPresent: false
    };

    // Check grids
    const grids = document.querySelectorAll('[class*="grid"], [class*="masonry"], [role="list"]');
    results.gridElements = grids.length;

    // Check touch targets
    const buttons = document.querySelectorAll('button, a[role="button"], [role="link"], [tabindex="0"]');
    buttons.forEach(btn => {
      if (!btn.offsetParent) return; // Skip hidden
      const rect = btn.getBoundingClientRect();
      if ((rect.width < 48 || rect.height < 48) && rect.width > 0 && rect.height > 0) {
        results.smallTouchTargets.push({
          text: (btn.textContent || btn.getAttribute('aria-label') || 'unlabeled').trim().slice(0, 20),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    });

    // Check navigation
    const nav = document.querySelector('nav, [class*="sidebar"], [class*="nav-drawer"]');
    if (nav && nav.offsetParent) {
      const rect = nav.getBoundingClientRect();
      results.sidebarVisible = rect.width > 0 && rect.height > 0;
      results.sidebarWidth = Math.round(rect.width);
    }

    // Check for hamburger
    const hamburger = document.querySelector('[aria-label*="menu"], [class*="hamburger"], button[aria-label*="toggle"]');
    results.hamburgerPresent = !!hamburger;

    return results;
  }, width);
}

async function testBreakpoint(page, bp, tab) {
  try {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    
    // Navigate with timeout
    await Promise.race([
      page.goto(tab.url, { waitUntil: 'load' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('nav timeout')), 5000))
    ]).catch(() => {});
    
    await page.waitForTimeout(700);
    
    const layout = await analyzeLayout(page, bp.width);
    return { ...layout, tab: tab.name };
  } catch (e) {
    return { tab: tab.name, error: e.message };
  }
}

async function run() {
  console.log('Lolly Responsive Behavior Test');
  console.log('='.repeat(70));
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const allResults = [];

  for (const bp of tests) {
    console.log(`\n${bp.name} (${bp.width}x${bp.height})`);
    console.log('-'.repeat(70));
    
    for (const tab of tabs) {
      const r = await testBreakpoint(page, bp, tab);
      allResults.push({ ...r, breakpoint: bp.name, width: bp.width });
      
      console.log(`\n${r.tab}:`);
      
      if (r.error) {
        console.log(`  ⚠ Error: ${r.error}`);
        continue;
      }

      // Test 1: Horizontal scroll
      if (r.hasHorizontalScroll) {
        console.log(`  ✗ Horizontal scroll: ${r.scrollWidth}px > ${r.clientWidth}px (overflow: ${r.scrollWidth - r.clientWidth}px)`);
      } else {
        console.log(`  ✓ No horizontal scroll`);
      }

      // Test 2: Grid collapse
      if (r.gridElements > 0) {
        console.log(`  ✓ Grid elements present: ${r.gridElements}`);
      }

      // Test 3: Touch targets
      if (r.smallTouchTargets.length > 0) {
        console.log(`  ⚠ Touch targets < 48px (${r.smallTouchTargets.length}):`);
        r.smallTouchTargets.slice(0, 3).forEach(t => {
          console.log(`      ${t.text}: ${t.width}×${t.height}px`);
        });
        if (r.smallTouchTargets.length > 3) console.log(`      ... and ${r.smallTouchTargets.length - 3} more`);
      } else {
        console.log(`  ✓ All touch targets ≥ 48px`);
      }

      // Test 4: Sidebar/nav access
      if (r.sidebarVisible) {
        console.log(`  ✓ Sidebar visible: ${r.sidebarWidth}px wide`);
      } else if (r.hamburgerPresent) {
        console.log(`  ✓ Navigation accessible via hamburger menu`);
      } else {
        console.log(`  ⚠ Navigation not clearly accessible`);
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const mobileResults = allResults.filter(r => r.breakpoint === 'Mobile' && !r.error);
  const tabletResults = allResults.filter(r => r.breakpoint === 'Tablet' && !r.error);

  console.log(`\nMobile (375px):`);
  const mobileScrollIssues = mobileResults.filter(r => r.hasHorizontalScroll);
  const mobileTouchIssues = mobileResults.filter(r => r.smallTouchTargets.length > 0);
  console.log(`  Horizontal scroll issues: ${mobileScrollIssues.length}/${mobileResults.length}`);
  console.log(`  Touch target issues: ${mobileTouchIssues.length}/${mobileResults.length}`);

  console.log(`\nTablet (768px):`);
  const tabletScrollIssues = tabletResults.filter(r => r.hasHorizontalScroll);
  const tabletTouchIssues = tabletResults.filter(r => r.smallTouchTargets.length > 0);
  console.log(`  Horizontal scroll issues: ${tabletScrollIssues.length}/${tabletResults.length}`);
  console.log(`  Touch target issues: ${tabletTouchIssues.length}/${tabletResults.length}`);

  console.log(`\nRecommendations:`);
  if (mobileScrollIssues.length === 0 && tabletScrollIssues.length === 0) {
    console.log(`  ✓ No horizontal scroll detected across any breakpoint`);
  }
  if (mobileTouchIssues.length > 0) {
    console.log(`  • Review touch target sizes on mobile (currently ${mobileTouchIssues.length} views affected)`);
  }

  await browser.close();
}

run().catch(console.error);
