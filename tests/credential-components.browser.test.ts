// SPDX-License-Identifier: MPL-2.0
/**
 * Pictures placed on a page are components of the export, in every format, read back from
 * the files the web shell, the CLI and the MCP server really write.
 *
 * Two defects this holds closed. A Design page with two placed uploads that each carry a
 * credential got no credential at all: each was recorded as the export's `parentOf`, and a
 * manifest may hold one. And a PNG or PDF of a page with a `data:` picture never recorded the
 * picture, where the SVG of the same page did; a GIF or video of it recorded neither. Read
 * with verifyC2pa, and with c2patool where it is installed.
 *
 * Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { Page } from 'playwright-core';
import { CAPTURE_SOURCE_TYPE, GENERATED_SOURCE_TYPE, derToPem, embedC2pa, generateCaRoot, issueLeafCert, verifyC2pa } from '../engine/src/index.ts';
import { packPng } from '../engine/src/png.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import { closeWebShell as closeRenderShell } from '../packages/node-shell/src/webshell-render.ts';
import { closeBrowser as closeMcpBrowser } from '../services/mcp/src/render.ts';
import { callTool } from '../services/mcp/src/tools.ts';
import { closeWebShell, webShellBase } from '../services/mcp/src/webshell.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
const hasC2patool = spawnSync('which', ['c2patool'], { encoding: 'utf8' }).status === 0;
const dir = await mkdtemp(join(tmpdir(), 'lolly-credential-components-'));
after(async () => {
  await closeMcpBrowser();
  await closeBrowser();
  await closeWebShell();
  await closeRenderShell();
  await rm(dir, { recursive: true, force: true });
});

const art = (rgb: [number, number, number]): Uint8Array => {
  const px = new Uint8Array(160 * 100 * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255; }
  return packPng(px, { width: 160, height: 100, channels: 4 });
};
const signed = (title: string, digitalSourceType: string, rgb: [number, number, number]): Promise<Uint8Array> =>
  embedC2pa(art(rgb), 'png', { title, claimGenerator: 'Camera or generator', actions: [{ action: 'c2pa.created', digitalSourceType }] });
const photo = await signed('Harbour photo', CAPTURE_SOURCE_TYPE, [34, 102, 170]);
const sky = await signed('Generated sky', GENERATED_SOURCE_TYPE, [204, 85, 34]);
const dataUrl = (bytes: Uint8Array): string => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const BOTH = ['Generated sky/componentOf', 'Harbour photo/componentOf'];

let count = 0;
/** The pictures the file's own credential records, after checking it is valid everywhere it is read. */
async function placedIn(bytes: Uint8Array, ext: string, opts: { trustAnchors?: Uint8Array[] } = {}): Promise<string[]> {
  const report = await verifyC2pa(bytes, opts);
  assert.equal(report.state, 'valid', `${ext}: the credential is valid`);
  const active = report.ingredients?.at(-1)?.manifest;
  const placed = (report.ingredients ?? []).filter((i) => i.manifest === active);
  for (const i of placed) {
    const step = report.history?.find((s) => s.action === 'c2pa.placed' && s.description === `Placed ${i.title}`);
    assert.ok(step, `${ext}: ${i.title} has its placed step`);
    if (i.title === 'Generated sky') assert.equal(step!.digitalSourceType, GENERATED_SOURCE_TYPE, `${ext}: the AI source type travels`);
  }
  assert.equal(report.history?.some((s) => s.action === 'c2pa.opened'), false, `${ext}: no placed picture is recorded as the parent`);
  if (hasC2patool) {
    const file = join(dir, `read-${count++}.${ext}`);
    await writeFile(file, bytes);
    const said = spawnSync('c2patool', [file], { encoding: 'utf8' });
    const store = JSON.parse(said.stdout) as { active_manifest: string; validation_state: string; manifests: Record<string, { ingredients?: { title: string; relationship: string }[] }> };
    assert.equal(store.validation_state, 'Valid', `${ext}: c2patool reads the credential as valid`);
    assert.deepEqual((store.manifests[store.active_manifest]!.ingredients ?? []).map((i) => `${i.title}/${i.relationship}`).sort(),
      placed.map((i) => `${i.title}/${i.relationship}`).sort(), `${ext}: c2patool reads the same pictures`);
  }
  return placed.map((i) => `${i.title}/${i.relationship}`).sort();
}

function cli(args: string[], out: string): void {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args, `--output=${out}`], {
    encoding: 'utf8', env: { ...process.env, LOLLY_RENDERER: 'chromium' }, maxBuffer: 1 << 26,
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
}

async function withPage(tool: string, use: (page: Page, base: string) => Promise<void>): Promise<void> {
  const base = await webShellBase();
  const browser = await getBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript((id) => { for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1'); localStorage.setItem('lolly-guide-seen', id); }, tool);
  try { await use(await context.newPage(), base); } finally { await context.close(); }
}

test('web shell: two signed uploads dropped on a Design page are components of its PNG, SVG and PDF', { skip, timeout: 420_000 }, async () => {
  await withPage('design', async (page, base) => {
    page.setDefaultTimeout(60_000);
    const seed = [{ id: 'page', kind: 'frame', name: 'Page', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff' }];
    await page.goto(`${base}/t/design?boxes=${encodeURIComponent(JSON.stringify(seed))}&w=800&h=600`, { waitUntil: 'load' });
    await settleEditor(page, 120_000);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    // The real upload route: a drop stores each file as an upload and keeps its credential.
    await page.evaluate(async ({ a, b }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(a)], 'harbour-photo.png', { type: 'image/png' }));
      transfer.items.add(new File([new Uint8Array(b)], 'generated-sky.png', { type: 'image/png' }));
      const target = document.querySelector('[data-topbar="name"]')!;
      for (const type of ['dragenter', 'dragover']) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 10, clientY: 10 }));
    }, { a: Array.from(photo), b: Array.from(sky) });
    await page.waitForFunction(() => {
      const boxes = (document.querySelector('#tool-canvas') as CanvasCommitEl).__lollyModel?.().find((input) => input.id === 'boxes')?.value;
      return Array.isArray(boxes) && boxes.filter((box) => (box as { image?: { source?: string } }).image?.source === 'user').length === 2;
    });
    await settleEditor(page, 30_000);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    for (const format of ['png', 'svg', 'pdf']) {
      await page.locator('[data-action="format"]').selectOption(format, { force: true });
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180_000 }), page.locator('[data-action="download"]').click()]);
      assert.deepEqual(await placedIn(new Uint8Array(await readFile((await download.path())!)), format), BOTH);
    }
  });
});

test('web link: frame and work-avatar record a signed data: picture in their PNG and PDF, as their SVG does', { skip, timeout: 420_000 }, async () => {
  for (const [tool, input] of [['frame', 'image'], ['work-avatar', 'photo']] as const) {
    for (const format of ['png', 'pdf', 'svg']) {
      await withPage(tool, async (page, base) => {
        const download = page.waitForEvent('download', { timeout: 150_000 });
        await page.goto(`${base}/#/tool/${tool}?${input}=${encodeURIComponent(dataUrl(sky))}&format=${format}&export`, { waitUntil: 'commit' });
        assert.deepEqual(await placedIn(new Uint8Array(await readFile((await (await download).path())!)), format), ['Generated sky/componentOf'], `${tool} ${format}`);
      });
    }
  }
});

// D2: a GIF or a video of the same page recorded neither picture, on both motion routes:
// the DOM frame capture (an untimed page) and the sequence compositor (a timed one).
test('web link: a Design page with two signed data: pictures records both in its GIF and MP4, untimed and timed', { skip, timeout: 900_000 }, async () => {
  for (const timed of [false, true]) {
    const boxes = [
      { id: 'page', kind: 'frame', name: 'Page', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff' },
      { id: 'photo', kind: 'image', frame: 'page', x: 40, y: 40, w: 320, h: 200, image: dataUrl(photo), ...(timed ? { start: 0, dur: 2 } : {}) },
      { id: 'sky', kind: 'image', frame: 'page', x: 400, y: 300, w: 320, h: 200, image: dataUrl(sky), ...(timed ? { start: 1, dur: 2 } : {}) },
    ];
    for (const format of ['gif', 'mp4']) {
      await withPage('design', async (page, base) => {
        const download = page.waitForEvent('download', { timeout: 300_000 });
        await page.goto(`${base}/#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}&w=800&h=600${timed ? '' : '&seconds=1'}&format=${format}&export`, { waitUntil: 'commit' });
        assert.deepEqual(await placedIn(new Uint8Array(await readFile((await (await download).path())!)), format), BOTH, `${timed ? 'timed' : 'untimed'} ${format}`);
      });
    }
  }
});

test('CLI: a Design page with two signed pictures records both as components in its PNG, SVG and PDF', { skip, timeout: 420_000 }, async () => {
  const boxes = [
    { id: 'page', kind: 'frame', name: 'Page', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff' },
    { id: 'photo', kind: 'image', frame: 'page', x: 40, y: 40, w: 320, h: 200, image: dataUrl(photo) },
    { id: 'sky', kind: 'image', frame: 'page', x: 400, y: 300, w: 320, h: 200, image: dataUrl(sky) },
  ];
  for (const format of ['png', 'svg', 'pdf']) {
    const out = join(dir, `design.${format}`);
    cli(['design', `--boxes=${JSON.stringify(boxes)}`, '--w=800', '--h=600', `--export=${format}`], out);
    assert.deepEqual(await placedIn(new Uint8Array(await readFile(out)), format), BOTH);
  }
});

test('CLI with a signing identity: a frame PNG carries the picture the web shell now records', { skip, timeout: 300_000 }, async () => {
  const subtle = globalThis.crypto.subtle;
  const ca = await generateCaRoot({ commonName: 'Components Test CA', organization: 'Lolly Test' });
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const leaf = await issueLeafCert({
    caCertDer: ca.certDer, caPrivateKey: ca.pkcs8Der, spkiDer: new Uint8Array(await subtle.exportKey('spki', pair.publicKey)),
    email: 'components@example.test', organization: 'Lolly Test',
  });
  const key = join(dir, 'key.pem');
  const chain = join(dir, 'chain.pem');
  await writeFile(key, derToPem(new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey)), 'PRIVATE KEY'));
  await writeFile(chain, derToPem(leaf, 'CERTIFICATE') + derToPem(ca.certDer, 'CERTIFICATE'));
  const out = join(dir, 'frame-signed.png');
  cli(['frame', `--image=${dataUrl(sky)}`, '--export=png', `--sign-key=${key}`, `--sign-cert=${chain}`], out);
  const bytes = new Uint8Array(await readFile(out));
  assert.deepEqual(await placedIn(bytes, 'png', { trustAnchors: [ca.certDer] }), ['Generated sky/componentOf']);
  const report = await verifyC2pa(bytes, { trustAnchors: [ca.certDer] });
  assert.equal(report.signer?.identity?.email, 'components@example.test', 'signed with the identity, not the web shell\'s key');
  assert.equal((report.environment as Record<string, unknown>).surface, 'cli');
});

test('MCP with a lifetime: its own credential keeps the picture a frame PNG and PDF now record', { skip, timeout: 300_000 }, async () => {
  for (const format of ['png', 'pdf']) {
    const result = await callTool('lolly_render', { toolId: 'frame', format, link: false, c2pa: '30', inputs: { image: dataUrl(sky) } });
    assert.ok(!result.isError, JSON.stringify(result.content));
    const resource = result.content.find((part) => part.type === 'resource');
    const image = result.content.find((part) => part.type === 'image');
    const bytes = resource?.type === 'resource' && typeof resource.resource.blob === 'string'
      ? Buffer.from(resource.resource.blob, 'base64')
      : Buffer.from(image?.type === 'image' ? image.data : '', 'base64');
    assert.deepEqual(await placedIn(new Uint8Array(bytes), format), ['Generated sky/componentOf'], format);
    assert.equal(((await verifyC2pa(new Uint8Array(bytes))).environment as Record<string, unknown>).surface, 'mcp', `${format}: the server's credential`);
  }
});
