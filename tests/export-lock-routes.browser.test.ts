// SPDX-License-Identifier: MPL-2.0
/**
 * A requested password on the routes a person or a pipeline uses directly: the CLI, the TUI's
 * export function, a web link and the export panel. Every file is read back, by qpdf or unzip
 * where installed and by the same reader the Node shells use, with the right password and a
 * wrong one. Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { Page } from 'playwright-core';
import { readExportLock } from '../packages/node-shell/src/export-lock.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { closeWebShell as closeRenderShell } from '../packages/node-shell/src/webshell-render.ts';
import { closeWebShell, webShellBase } from '../services/mcp/src/webshell.ts';
import { createTuiBridge } from '../shells/tui/src/bridge.ts';
import { exportToFile, mountTool } from '../shells/tui/src/engine-render.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
const SECRET = 'Zq7-right-password';
const WRONG = 'not-the-password';
const QR = 'url=https%3A%2F%2Fexample.com';
const hasQpdf = spawnSync('which', ['qpdf'], { encoding: 'utf8' }).status === 0;
const hasUnzip = spawnSync('which', ['unzip'], { encoding: 'utf8' }).status === 0;
const dir = await mkdtemp(join(tmpdir(), 'lolly-password-routes-'));
after(async () => {
  await closeBrowser();
  await closeWebShell();
  await closeRenderShell();
  await rm(dir, { recursive: true, force: true });
});

async function assertLockedPdf(bytes: Uint8Array, scheme: string, password = SECRET): Promise<void> {
  assert.deepEqual(await readExportLock(bytes, password), { locked: true, opens: true, scheme });
  assert.equal((await readExportLock(bytes, WRONG)).opens, false);
  if (!hasQpdf) return;
  const file = join(dir, `${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(file, bytes);
  assert.equal(spawnSync('qpdf', ['--is-encrypted', file]).status, 0, 'qpdf says encrypted');
  const right = spawnSync('qpdf', [`--password=${password}`, '--check', file], { encoding: 'utf8' });
  assert.ok(right.status === 0 || right.status === 3, `the right password opens the file: ${right.stderr}`);
  const wrong = spawnSync('qpdf', [`--password=${WRONG}`, '--check', file], { encoding: 'utf8' });
  assert.equal(wrong.status, 2, 'a wrong password is refused');
}

async function assertLockedZip(bytes: Uint8Array): Promise<void> {
  assert.equal((await readExportLock(bytes, SECRET)).locked, true);
  if (!hasUnzip) return;
  const file = join(dir, `${Math.random().toString(36).slice(2)}.zip`);
  await writeFile(file, bytes);
  assert.equal(spawnSync('unzip', ['-t', '-P', SECRET, file]).status, 0, 'the right password opens the ZIP');
  assert.notEqual(spawnSync('unzip', ['-t', '-P', WRONG, file]).status, 0, 'a wrong password does not');
}

function cli(args: string[], input = ''): { status: number | null; said: string } {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
    encoding: 'utf8', input, env: { ...process.env, LOLLY_RENDERER: 'chromium' },
  });
  return { status: run.status, said: `${run.stdout}\n${run.stderr}` };
}

test('CLI: --password and --password-stdin both give a PDF only that password opens', { skip, timeout: 240_000 }, async () => {
  const out = join(dir, 'cli.pdf');
  const flag = cli(['qr-code', `--url=https://example.com`, `--password=${SECRET}`, '--export=pdf', `--output=${out}`]);
  assert.equal(flag.status, 0, flag.said);
  assert.ok(!flag.said.includes(SECRET), 'nothing printed repeats it');
  await assertLockedPdf(await readFile(out), '40-bit RC4');

  const piped = join(dir, 'cli-stdin.pdf');
  const stdin = cli(['qr-code', `--url=https://example.com`, '--password-stdin', '--export=pdf', `--output=${piped}`], SECRET);
  assert.equal(stdin.status, 0, stdin.said);
  await assertLockedPdf(await readFile(piped), '40-bit RC4');
});

test('CLI: refusals exit 4 with no file', { skip, timeout: 120_000 }, async () => {
  for (const [args, expected] of [
    [['agenda', `--password=${SECRET}`, '--export=pdf-cmyk'], /cannot lock a "pdf-cmyk"/],
    [['agenda', `--password=${SECRET}`, '--bleed=3mm', '--export=pdf'], /bleed or print marks/],
    [['agenda', '--password=пароль123', '--export=pdf'], /plain ASCII/],
  ] as Array<[string[], RegExp]>) {
    const out = join(dir, `refused-${Math.random().toString(36).slice(2)}.pdf`);
    const run = cli([...args, `--output=${out}`]);
    assert.equal(run.status, 4, run.said);
    assert.match(run.said, expected);
    assert.equal(existsSync(out), false);
    assert.ok(!run.said.includes(SECRET) && !run.said.includes('пароль123'));
  }
});

test('TUI: the export function locks a PDF, and the file reads back', { skip, timeout: 240_000 }, async () => {
  const previous = process.env.LOLLY_RENDERER;
  process.env.LOLLY_RENDERER = 'chromium';
  const { host, dom } = await createTuiBridge();
  try {
    const { runtime, manifest } = await mountTool('qr-code', host, QR, undefined, {});
    const out = join(dir, 'tui.pdf');
    await exportToFile(runtime, dom, manifest, 'pdf', out, { password: SECRET });
    await assertLockedPdf(await readFile(out), '40-bit RC4');
  } finally {
    dom.window.close();
    if (previous === undefined) delete process.env.LOLLY_RENDERER; else process.env.LOLLY_RENDERER = previous;
  }
});

async function withPage<T>(use: (page: Page, base: string, requests: string[], logged: string[]) => Promise<T>): Promise<T> {
  const base = await webShellBase();
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  await context.addInitScript(() => { for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1'); });
  const page = await context.newPage();
  const requests: string[] = [];
  const logged: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => logged.push(message.text()));
  try { return await use(page, base, requests, logged); } finally { await context.close(); }
}

test('web link: ?password= locks the file, leaves the address at once, and a reload writes nothing unlocked', { skip, timeout: 240_000 }, async () => {
  await withPage(async (page, base, requests, logged) => {
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await page.goto(`${base}/#/tool/qr-code?${QR}&format=pdf&password=${SECRET}&export`, { waitUntil: 'commit' });
    const file = await download;
    await assertLockedPdf(await readFile((await file.path())!), '40-bit RC4');
    assert.ok(!page.url().includes(SECRET), `the address no longer holds it: ${page.url().replace(SECRET, '<password>')}`);
    assert.doesNotMatch(page.url(), /[?&]export\b/, 'and no longer asks for a file');
    assert.ok(!requests.some(url => url.includes(SECRET)), 'no request carried it');
    assert.ok(!logged.some(line => line.includes(SECRET)), 'no console line carried it');
    assert.ok(!(await page.evaluate(() => JSON.stringify(history.state))).includes(SECRET));

    let second = false;
    page.on('download', () => { second = true; });
    await page.reload({ waitUntil: 'load' });
    await shellSettled(page);
    await page.waitForTimeout(1500);
    assert.equal(second, false, 'the reload is an open, not a second, unlocked export');
  });
});

test('web link: a ZIP takes the password too', { skip, timeout: 240_000 }, async () => {
  await withPage(async (page, base) => {
    const download = page.waitForEvent('download', { timeout: 150_000 });
    await page.goto(`${base}/#/tool/agenda?format=zip&password=${SECRET}&export`, { waitUntil: 'commit' });
    await assertLockedZip(await readFile((await (await download).path())!));
    assert.ok(!page.url().includes(SECRET));
  });
});

for (const [name, tool, query, expected] of [
  ['a png', 'qr-code', `${QR}&format=png`, /"png" file cannot carry a password/],
  ['a Print PDF', 'agenda', 'format=pdf-cmyk', /cannot lock a "pdf-cmyk"/],
  ['a PDF with bleed', 'agenda', 'format=pdf&bleed=3mm', /bleed or print marks/],
] as Array<[string, string, string, RegExp]>) {
  test(`web link: ${name} is refused, on screen, with no file`, { skip, timeout: 180_000 }, async () => {
    await withPage(async (page, base, _requests, logged) => {
      let downloaded = false;
      page.on('download', () => { downloaded = true; });
      await page.goto(`${base}/#/tool/${tool}?${query}&password=${SECRET}&export`, { waitUntil: 'commit' });
      const dialog = page.locator('dialog.modal').filter({ hasText: 'This file was not written' });
      await dialog.waitFor({ state: 'visible', timeout: 120_000 });
      assert.match(await dialog.innerText(), expected);
      assert.equal(downloaded, false);
      assert.ok(logged.some(line => /Auto-export did not start/.test(line)), 'the Node drivers read this line to stop waiting');
      assert.ok(!logged.some(line => line.includes(SECRET)) && !(await dialog.innerText()).includes(SECRET) && !page.url().includes(SECRET));
    });
  });
}

async function openPanelPassword(page: Page, base: string, query: string): Promise<void> {
  await page.goto(`${base}/#/tool/qr-code?${query}`, { waitUntil: 'load' });
  await shellSettled(page);
  await page.locator('[data-action="download"]').first().waitFor({ state: 'attached', timeout: 60_000 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export options' }).first().click();
  const protection = page.locator('[data-action="protection-toggle"]').first();
  if (await protection.getAttribute('aria-expanded') === 'false') await protection.click();
  await page.locator('[data-action="pdfpass-toggle"]').first().click();
}

test('export panel: the weak tier locks the file and the password never reaches the address', { skip, timeout: 240_000 }, async () => {
  await withPage(async (page, base, requests, logged) => {
    await openPanelPassword(page, base, `${QR}&format=pdf`);
    await page.locator('[data-action="pdf-password"]').first().fill(SECRET);
    assert.equal(await page.locator('[data-action="pdf-lock-tier"]').first().inputValue(), 'standard');
    await page.waitForTimeout(600);
    assert.ok(!page.url().includes(SECRET), 'typing writes nothing to the address');
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await page.locator('[data-action="download"]').first().click();
    await assertLockedPdf(await readFile((await (await download).path())!), '40-bit RC4');
    await page.waitForTimeout(400);
    assert.ok(!page.url().includes(SECRET), 'nor does exporting');
    assert.ok(!requests.some(url => url.includes(SECRET)) && !logged.some(line => line.includes(SECRET)));
    const kept = await page.evaluate(() => {
      const parts: string[] = [JSON.stringify(history.state)];
      for (let i = 0; i < localStorage.length; i++) parts.push(localStorage.getItem(localStorage.key(i)!) ?? '');
      for (let i = 0; i < sessionStorage.length; i++) parts.push(sessionStorage.getItem(sessionStorage.key(i)!) ?? '');
      return parts.join('\n');
    });
    assert.ok(!kept.includes(SECRET), 'nothing in page storage holds it');
  });
});

test('export panel: a password beyond plain ASCII goes to the strong tier, and it opens the file', { skip, timeout: 240_000 }, async () => {
  await withPage(async (page, base) => {
    await openPanelPassword(page, base, `${QR}&format=pdf`);
    await page.locator('[data-action="pdf-password"]').first().fill('пароль123');
    assert.equal(await page.locator('[data-action="pdf-lock-tier"]').first().inputValue(), 'strong');
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await page.locator('[data-action="download"]').first().click();
    await assertLockedPdf(await readFile((await (await download).path())!), 'AES-256', 'пароль123');
  });
});
