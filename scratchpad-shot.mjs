import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173/#/d?tab=device';
const width = Number(process.argv[3] || 1400);
const height = Number(process.argv[4] || 1400);
const out = process.argv[5] || '/private/tmp/claude-501/-Users-andy-Build-lolly/2bc0618f-f861-4d02-bb98-554ff38f6167/scratchpad/shot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200); // let async device-info hydration settle
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
