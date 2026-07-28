import { chromium } from 'playwright';
const PORT = process.env.PORT || '5175';
const SHOT = '/private/tmp/claude-501/-Users-andy-Build-lolly/1fb4e93c-a0f6-42d5-b4c6-e133338b06ce/scratchpad';
const b = await chromium.launch();

const VIEWS = {
  '#/d':     ['dash-hero-cta', 'dash-tab-icon', 'dash-card', 'dash-token-preview'],
  '#/lab':   ['lab-card', 'lab-step-n', 'okls-canvas', 'td-dots'],
  '#/c':     ['cat-tile', 'cat-thumb', 'cat-thumb-stub'],
  '#/valid': ['valid-score', 'valid-check-mark', 'valid-fact-ic'],
  '#/start': ['start-tab-icon', 'start-import-result', 'be-swatch-chip'],
  '#/p':     ['tile-cover', 'tile-cover--create'],
  '':        ['gcar-deck', 'gtile-hero', 'ftile-dots', 'featured-grip', 'tool-card-icon'],
};

let broken = 0, fixed = 0, total = 0;
const allErrs = [];

for (const [hash, classes] of Object.entries(VIEWS)) {
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') allErrs.push(`${hash}: ${m.text()}`); });
  page.on('pageerror', e => allErrs.push(`${hash}: ${e.message}`));
  await page.goto(`http://localhost:${PORT}/${hash}`, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2200));

  const res = await page.evaluate((cls) => {
    const targets = [];
    const walk = (list) => {
      for (const r of list) {
        if (r.cssRules) walk(r.cssRules);
        if (r.selectorText === '[hidden]' && r.style && r.style.getPropertyPriority('display') === 'important') targets.push(r);
      }
    };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin */ } }
    const probe = (c) => {
      const el = document.createElement('div');
      el.className = c; el.hidden = true; el.textContent = 'x';
      document.body.appendChild(el);
      const d = getComputedStyle(el).display;
      el.remove();
      return d;
    };
    const withFix = Object.fromEntries(cls.map(c => [c, probe(c)]));
    let withoutFix = null;
    if (targets.length) {
      for (const r of targets) r.style.removeProperty('display');
      withoutFix = Object.fromEntries(cls.map(c => [c, probe(c)]));
      for (const r of targets) r.style.setProperty('display', 'none', 'important');
    }
    return { rules: targets.length, withFix, withoutFix };
  }, classes);

  console.log(`\n${hash || '(gallery)'}  — app-wide !important [hidden] rules in CSSOM: ${res.rules}`);
  for (const c of classes) {
    const before = res.withoutFix?.[c] ?? '?';
    const after = res.withFix[c];
    total++;
    if (before !== 'none') broken++;
    if (after === 'none') fixed++;
    const mark = before === 'none' ? '·' : (after === 'none' ? '✔' : '✖');
    console.log(`  ${mark} .${c.padEnd(22)} without fix: ${String(before).padEnd(12)} with fix: ${after}`);
  }
  await page.screenshot({ path: `${SHOT}/view-${(hash || 'gallery').replace(/[#/]/g, '') || 'gallery'}.png` });
  await page.close();
}

console.log(`\ncollisions reproduced live: ${broken}/${total} probed;  hidden honoured after fix: ${fixed}/${total}`);
console.log('console/page errors:', allErrs.length, allErrs.slice(0, 8));
await b.close();
