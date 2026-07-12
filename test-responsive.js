const { chromium } = require('playwright');

const tests = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];

const tabs = [
  { name: 'Gallery', url: 'http://localhost:5173/' },
  { name: 'Projects', url: 'http://localhost:5173/#/p' },
  { name: 'Catalog', url: 'http://localhost:5173/#/c' },
  { name: 'Dashboard', url: 'http://localhost:5173/#/d' },
];

async function checkScrolling(page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  if (scrollWidth > clientWidth) {
    return { hasHorizontalScroll: true, scrollWidth, clientWidth };
  }
  return { hasHorizontalScroll: false };
}

async function checkTouchTargets(page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]')).slice(0, 30);
    const smallTargets = [];
    
    buttons.forEach(button => {
      const rect = button.getBoundingClientRect();
      if (rect.width < 48 || rect.height < 48) {
        smallTargets.push({
          element: (button.textContent || 'unnamed').trim().substring(0, 30),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    });
    return smallTargets;
  });
  return result;
}

async function checkSidebarAccess(page, width) {
  return await page.evaluate((w) => {
    const sidebar = document.querySelector('[class*="sidebar"], nav, [class*="nav"]');
    const hamburger = document.querySelector('button[aria-label*="menu"], [class*="hamburger"]');
    
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { visible: true, width: Math.round(rect.width) };
      }
    }
    if (hamburger) {
      return { accessible: 'via hamburger' };
    }
    return { accessible: 'not clearly accessible' };
  }, width);
}

async function testBreakpoint(page, breakpoint, tabInfo) {
  const results = {
    breakpoint: breakpoint.name,
    size: `${breakpoint.width}x${breakpoint.height}`,
    tab: tabInfo.name,
    url: tabInfo.url,
    issues: []
  };

  try {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.goto(tabInfo.url, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    // Test 1: Horizontal scroll
    const scrollResult = await checkScrolling(page);
    if (scrollResult.hasHorizontalScroll) {
      results.issues.push(`Horizontal scroll (${scrollResult.scrollWidth}px > ${scrollResult.clientWidth}px)`);
    }

    // Test 2: Touch targets (only on mobile)
    if (breakpoint.width <= 375) {
      const smallTargets = await checkTouchTargets(page);
      if (smallTargets.length > 0) {
        results.smallTouchTargets = smallTargets.slice(0, 5);
        results.issueCount = smallTargets.length;
        results.issues.push(`${smallTargets.length} touch targets < 48px`);
      }
    }

    // Test 3: Sidebar accessibility (tablet/mobile)
    if (breakpoint.width <= 768) {
      const sidebarCheck = await checkSidebarAccess(page, breakpoint.width);
      results.sidebarStatus = sidebarCheck;
    }

  } catch (e) {
    results.error = e.message;
  }

  return results;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const allResults = [];

  for (const breakpoint of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`);
    console.log('='.repeat(60));
    
    for (const tab of tabs) {
      const result = await testBreakpoint(page, breakpoint, tab);
      allResults.push(result);
      
      console.log(`\n${result.tab}`);
      if (result.error) {
        console.log(`  ⚠ Error: ${result.error}`);
      } else if (result.issues.length === 0) {
        console.log('  ✓ No responsive issues detected');
      } else {
        result.issues.forEach(issue => console.log(`  ✗ ${issue}`));
      }
      
      if (result.smallTouchTargets) {
        console.log(`  Touch targets (${result.issueCount} total):`);
        result.smallTouchTargets.forEach(t => {
          console.log(`    • ${t.element}: ${t.width}×${t.height}px`);
        });
      }
      
      if (result.sidebarStatus) {
        if (result.sidebarStatus.visible) {
          console.log(`  Sidebar: visible (${result.sidebarStatus.width}px)`);
        } else {
          console.log(`  Sidebar: ${result.sidebarStatus.accessible}`);
        }
      }
    }
  }

  await browser.close();
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const mobileResults = allResults.filter(r => r.breakpoint === 'Mobile');
  const tabletResults = allResults.filter(r => r.breakpoint === 'Tablet');
  
  const mobileIssues = mobileResults.filter(r => r.issues.length > 0);
  const tabletIssues = tabletResults.filter(r => r.issues.length > 0);
  
  console.log(`Mobile (375px): ${mobileResults.length} tests, ${mobileIssues.length} with issues`);
  console.log(`Tablet (768px): ${tabletResults.length} tests, ${tabletIssues.length} with issues`);
  
  process.exit(mobileIssues.length > 0 || tabletIssues.length > 0 ? 1 : 0);
}

run().catch(console.error);
