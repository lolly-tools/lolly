import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:5174';
const SCRATCH = '/private/tmp/claude-501/-Users-andy-Build-lolly/1bccc00b-d84a-4a36-b748-7e9fddfc6e81/scratchpad';
const browser = await chromium.launch();

async function exportPng(imprint) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const q = `url=https%3A%2F%2Flolly.tools&format=png${imprint ? '&imprint=1' : ''}&export`;
  const dlPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.goto(`${BASE}/#/tool/qr-code?${q}`, { waitUntil: 'networkidle' });
  const dl = await dlPromise;
  const out = path.join(SCRATCH, imprint ? 'wm-imprinted.png' : 'wm-plain.png');
  await dl.saveAs(out);
  await page.close();
  return out;
}

async function verify(file) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${BASE}/#/verify`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.valid-drop input[type=file]', { state: 'attached', timeout: 10000 });
  await page.locator('.valid-drop input[type=file]').setInputFiles(file);
  await page.waitForSelector('.valid-result', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const wm = await page.locator('.valid-wm').count();
  const wmText = wm ? (await page.locator('.valid-wm-text strong').first().textContent()) : null;
  await page.screenshot({ path: file.replace('.png', '-verify.png'), fullPage: true });
  await page.close();
  return { wmPresent: wm > 0, wmText };
}

try {
  const imprinted = await exportPng(true);
  const plain = await exportPng(false);
  console.log('exported:', imprinted, plain);
  const rImp = await verify(imprinted);
  const rPlain = await verify(plain);
  console.log('imprinted → watermark note:', rImp);
  console.log('plain     → watermark note:', rPlain);
  console.log(rImp.wmPresent && !rPlain.wmPresent ? 'PASS: detected on imprinted, absent on plain' : 'CHECK: unexpected result');
} finally {
  await browser.close();
}
