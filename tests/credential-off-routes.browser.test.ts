// SPDX-License-Identifier: MPL-2.0
/**
 * An explicit "no Content Credentials" on the certificate, whose inlined catalog logo brings a
 * manifest of its own, read back from the files the CLI, the TUI, a web link and the export card
 * really write: verifyC2pa, c2patool where installed, and a count of the elements. Off means none,
 * only the credential goes, and a render with no setting keeps its credential where it was.
 * Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { Page } from 'playwright-core';
import { verifyC2pa } from '../engine/src/index.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { stripSvgC2pa } from '../packages/node-shell/src/lolly-file.ts';
import { closeWebShell as closeRenderShell } from '../packages/node-shell/src/webshell-render.ts';
import { closeWebShell, webShellBase } from '../services/mcp/src/webshell.ts';
import { createTuiBridge } from '../shells/tui/src/bridge.ts';
import { exportToFile, mountTool } from '../shells/tui/src/engine-render.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
const QUERY = 'firstname=Ana&awardtopic=Container+Fundamentals';
const hasC2patool = spawnSync('which', ['c2patool'], { encoding: 'utf8' }).status === 0;
const dir = await mkdtemp(join(tmpdir(), 'lolly-credential-routes-'));
after(async () => {
  await closeBrowser();
  await closeWebShell();
  await closeRenderShell();
  await rm(dir, { recursive: true, force: true });
});

let count = 0;
async function assertNoCredential(bytes: Uint8Array, ext: string): Promise<void> {
  assert.equal((await verifyC2pa(bytes)).state, 'none', 'the verifier finds no credential');
  if (ext === 'svg') {
    const text = Buffer.from(bytes).toString('latin1');
    assert.equal(text.includes('<c2pa:manifest'), false, 'no manifest element is left');
    assert.match(text, /<rdf:|lolly:/, 'the file\'s own metadata stays');
  }
  if (hasC2patool) {
    const file = join(dir, `read-${count++}.${ext}`);
    await writeFile(file, bytes);
    const said = spawnSync('c2patool', [file], { encoding: 'utf8' });
    assert.match(`${said.stdout}${said.stderr}`, /No claim found|No C2PA/i, 'c2patool finds no claim');
  }
}

function cli(args: string[], out: string): void {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args, `--output=${out}`], {
    encoding: 'utf8', env: { ...process.env, LOLLY_RENDERER: 'chromium' },
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
}

/** Without the id prefix a render draws at random, and without its credential, an SVG is its content. */
function content(svg: string): string {
  const prefix = /id="(\w+)-namedview\d+"/.exec(svg)?.[1];
  return stripSvgC2pa(prefix ? svg.replaceAll(prefix, 'PREFIX') : svg);
}

test('CLI: --c2pa=off and --no-provenance on an SVG hold, and only the credential goes', { skip, timeout: 240_000 }, async () => {
  const off = join(dir, 'cli-off.svg');
  cli(['certificate', '--firstname=Ana', '--c2pa=off', '--export=svg'], off);
  await assertNoCredential(await readFile(off), 'svg');
  const bare = join(dir, 'cli-bare.svg');
  cli(['certificate', '--firstname=Ana', '--no-provenance', '--export=svg'], bare);
  await assertNoCredential(await readFile(bare), 'svg');
  const plain = join(dir, 'cli-plain.svg');
  cli(['certificate', '--firstname=Ana', '--export=svg'], plain);
  assert.equal((await verifyC2pa(await readFile(plain))).state, 'valid', 'no setting keeps the default credential');
  assert.equal(content(await readFile(plain, 'latin1')), content(await readFile(off, 'latin1')), 'nothing but the credential differs');
  // The default credential sits in the root's metadata, where c2patool reads one, and the
  // inlined logo keeps its own manifest in its own markup.
  const placed = await readFile(plain, 'latin1');
  assert.equal(placed.match(/<c2pa:manifest/g)?.length, 2, 'the file\'s and the logo\'s');
  assert.ok(placed.indexOf('<c2pa:manifest') < placed.indexOf('<svg', placed.indexOf('<svg') + 4), 'the file\'s comes ahead of the inlined artwork');
  if (hasC2patool) {
    const said = spawnSync('c2patool', [plain], { encoding: 'utf8' });
    assert.doesNotMatch(`${said.stdout}${said.stderr}`, /No claim found/, 'c2patool reads the claim');
  }
  const ninety = join(dir, 'cli-ninety.svg');
  cli(['certificate', '--firstname=Ana', '--c2pa=90', '--export=svg'], ninety);
  assert.equal((await verifyC2pa(await readFile(ninety))).state, 'valid', 'a lifetime is still a credential');
});

test('TUI: the C2PA row at off holds on every tier, and no setting keeps the default', { skip, timeout: 240_000 }, async () => {
  const previous = process.env.LOLLY_RENDERER;
  process.env.LOLLY_RENDERER = 'chromium';
  const { host, dom } = await createTuiBridge();
  try {
    for (const format of ['svg', 'pdf', 'png']) {
      const { runtime, manifest } = await mountTool('certificate', host, QUERY, undefined, {});
      const out = join(dir, `tui-off.${format}`);
      await exportToFile(runtime, dom, manifest, format, out, { c2paOff: true });
      await assertNoCredential(await readFile(out), format);
    }
    const { runtime, manifest } = await mountTool('certificate', host, QUERY, undefined, {});
    const plain = join(dir, 'tui-plain.svg');
    await exportToFile(runtime, dom, manifest, 'svg', plain, {});
    assert.equal((await verifyC2pa(await readFile(plain))).state, 'valid');
  } finally {
    dom.window.close();
    if (previous === undefined) delete process.env.LOLLY_RENDERER; else process.env.LOLLY_RENDERER = previous;
  }
});

async function withPage(use: (page: Page, base: string) => Promise<void>): Promise<void> {
  const base = await webShellBase();
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  await context.addInitScript(() => { for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1'); localStorage.setItem('lolly-guide-seen', 'certificate'); });
  try { await use(await context.newPage(), base); } finally { await context.close(); }
}

async function linkFile(query: string): Promise<Uint8Array> {
  let bytes = new Uint8Array();
  await withPage(async (page, base) => {
    const download = page.waitForEvent('download', { timeout: 150_000 });
    await page.goto(`${base}/#/tool/certificate?${QUERY}&${query}&export`, { waitUntil: 'commit' });
    bytes = new Uint8Array(await readFile((await (await download).path())!));
  });
  return bytes;
}

test('web link: c2pa=off holds on an SVG, and the Node drivers\' keep flag leaves the bytes as they were', { skip, timeout: 300_000 }, async () => {
  const off = await linkFile('format=svg&c2pa=off');
  await assertNoCredential(off, 'svg');
  const plain = await linkFile('format=svg');
  assert.equal((await verifyC2pa(plain)).state, 'valid', 'no setting keeps the default credential');
  assert.equal(content(Buffer.from(plain).toString('latin1')), content(Buffer.from(off).toString('latin1')), 'nothing but the credential differs');

  const kept = await linkFile('format=svg&c2pa=off&_keepinlinedc2pa=1');
  assert.equal(Buffer.from(kept).toString('latin1').match(/<c2pa:manifest/g)?.length, 1, 'an `off` that is not the caller\'s own leaves the inlined piece alone');
  assert.equal((await verifyC2pa(kept)).state, 'invalid');
});

test('web link: c2pa=off on a PDF and a PNG holds', { skip, timeout: 300_000 }, async () => {
  await assertNoCredential(await linkFile('format=pdf&c2pa=off'), 'pdf');
  await assertNoCredential(await linkFile('format=png&c2pa=off'), 'png');
});

test('export card: the C2PA box unticked holds on an SVG, and left alone it keeps the credential', { skip, timeout: 300_000 }, async () => {
  for (const untick of [false, true]) {
    await withPage(async (page, base) => {
      await page.goto(`${base}/#/tool/certificate?${QUERY}&format=svg`, { waitUntil: 'load' });
      await shellSettled(page);
      const download = page.locator('[data-action="download"]').first();
      await download.waitFor({ state: 'attached', timeout: 120_000 });
      await page.getByRole('button', { name: 'Export options' }).first().click();
      const protection = page.locator('[data-action="protection-toggle"]').first();
      if (await protection.getAttribute('aria-expanded') === 'false') await protection.click();
      const box = page.locator('[data-action="pdf-c2pa"]').first();
      assert.equal(await box.isChecked(), true, 'on by default for this tool');
      if (untick) await box.evaluate((el: HTMLInputElement) => { el.click(); });
      assert.equal(await box.isChecked(), !untick);
      const file = page.waitForEvent('download', { timeout: 120_000 });
      await download.click();
      const bytes = new Uint8Array(await readFile((await (await file).path())!));
      if (untick) await assertNoCredential(bytes, 'svg');
      else assert.equal((await verifyC2pa(bytes)).state, 'valid');
    });
  }
});
