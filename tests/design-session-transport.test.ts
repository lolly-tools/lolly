// SPDX-License-Identifier: MPL-2.0
/**
 * The session transport of the browser tier (plan 291 W9) and the `--themes` export
 * (plan 291 M4, E24), without a browser:
 *
 * - a Design document's values become a `.lolly` whose `data:` pictures are uploads, so
 *   the address the page is sent to carries the slot and export settings only;
 * - the file route answers one GET and nothing else, and refuses a file over 64 MB;
 * - a long address in an error message is cut to its head and length;
 * - `--themes` names resolve to `_themes` choices against the design system, and each
 *   file is written to `<stem>-<theme>.<ext>`, with `--output` required.
 *
 * The page side is covered by tests/open-route.browser.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  designSessionValues, OPEN_ROUTE_MAX_BYTES, OpenSessionError, packageDesignSession, serveSessionOnce, sessionExportQuery, sessionQuery, shortenUrls,
} from '../packages/node-shell/src/open-session.ts';
import { DESKTOP_REQUEST_MAX_BYTES, PAGE_DESIGN_SYSTEM_GLOBAL, exportUrl, fitsDesktopRequest, renderDesignViaSession, seedPageDesignSystem } from '../packages/node-shell/src/webshell-render.ts';
import { AUTOMATION_DESIGN_SYSTEM_GLOBAL } from '../shells/web/src/bridge/tokens.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { themeRuns, themedOutputPath, themesPlan } from '../shells/cli/src/themes.ts';
import { designSessionRunPlan } from '../shells/cli/src/design-session.ts';

const root = resolve(import.meta.dirname, '..');
const PNG = new Uint8Array(readFileSync(join(root, 'shells/web/public/icons/icon-192.png')));
const dataUrl = (bytes: Uint8Array): string => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;

test('Design values become a session whose inline pictures are uploads it carries', async () => {
  const big = dataUrl(PNG);
  const boxes = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'a', kind: 'image', frame: 'f', x: 0, y: 0, w: 960, h: 1080, image: big },
    // A resolved ref from a host: reduced to its id.
    { id: 'b', kind: 'image', frame: 'f', x: 960, y: 0, w: 960, h: 1080, image: { source: 'remote', id: big, url: big, type: 'image', format: 'png' } },
    { id: 'c', kind: 'image', frame: 'f', x: 0, y: 0, w: 10, h: 10, image: { source: 'library', id: 'lolly/logo/primary', url: 'data:image/svg+xml;base64,AAAA' } },
    // The host could not resolve this upload; the caller's value fills it back in.
    { id: 'd', kind: 'image', frame: 'f', x: 0, y: 0, w: 10, h: 10, image: null },
  ];
  const fill = { boxes: boxes.map((row) => (row.id === 'd' ? { ...row, image: 'user/media/' + 'ab'.repeat(32) } : row)) };
  const prepared = designSessionValues({ boxes, background: '#fff' }, fill);
  const rows = prepared.values.boxes as Array<Record<string, unknown>>;
  assert.equal(prepared.assets.length, 1, 'one picture, named twice, is carried once');
  assert.equal(prepared.assets[0]!.key, big);
  assert.deepEqual(rows.map((r) => (typeof r.image === 'string' ? r.image.slice(0, 16) : r.image ?? null)), [null, big.slice(0, 16), big.slice(0, 16), 'lolly/logo/prima', 'user/media/ababa']);
  assert.equal(prepared.values.background, '#fff');

  const packed = await packageDesignSession({ boxes }, { label: 'Transport', fill });
  const read = readLollyFile(packed.bytes);
  const stored = read.session.boxes as Array<Record<string, unknown>>;
  const upload = (stored[1]!.image as { id: string }).id;
  assert.match(upload, /^user\/media\/[0-9a-f]{64}$/);
  assert.equal((stored[2]!.image as { id: string }).id, upload);
  assert.equal([...read.files.keys()].filter((k) => k.startsWith('assets/')).length, 1);
  assert.equal(read.session.__label, 'Transport');
  // The upload the caller only named has no bytes here: a reference and a note, never a refusal.
  assert.ok(packed.notes.some((n) => /written as a reference with no bytes/.test(n)), packed.notes.join(' | '));
});

test('an export of an opened session carries the slot, the theme and reserved params only', () => {
  assert.equal(sessionQuery('design:7', 'boxes=x&z=1eJ&template=t&s=2&emoji=a%401&_themes=%7B%7D&width=10&heading=Hi'),
    'slot=design%3A7&s=2&emoji=a%401&_themes=%7B%7D&width=10');
  const q = sessionExportQuery('design:7', { '': 'dark' }, 'emojifx=snap');
  assert.equal(new URLSearchParams(q).get('_themes'), '{"":"dark"}');
  const url = exportUrl('http://127.0.0.1:9', 'design', q, 'pptx', { width: 1920, height: 1080, bleed: '3mm', slide: '2', c2pa: false, imprint: false });
  const params = new URLSearchParams(url.split('?')[1]);
  assert.deepEqual(
    Object.fromEntries(params),
    { slot: 'design:7', emojifx: 'snap', _themes: '{"":"dark"}', format: 'pptx', width: '1920', height: '1080', bleed: '3mm', imprint: '0', s: '2', c2pa: 'off', export: '1' },
  );
  assert.ok(url.length < 400);
});

/** A stand-in page that records its routes, enough for serveSessionOnce. */
function fakePage() {
  const routes: Array<{ match: (u: URL) => boolean; handler: (route: unknown, request: unknown) => Promise<void> }> = [];
  return {
    routes,
    async route(match: (u: URL) => boolean, handler: (route: unknown, request: unknown) => Promise<void>) { routes.push({ match, handler }); },
    async unroute(match: unknown, handler: unknown) {
      const i = routes.findIndex((r) => r.match === match && r.handler === handler);
      if (i >= 0) routes.splice(i, 1);
    },
    async ask(url: string, method = 'GET') {
      const hit = routes.find((r) => r.match(new URL(url)));
      if (!hit) return { status: 'fell through' as const };
      let answer: { status?: number; body?: Buffer } | 'fallback' = 'fallback';
      await hit.handler(
        { fulfill: async (a: { status: number; body: Buffer }) => { answer = a; }, fallback: async () => { answer = 'fallback'; } },
        { method: () => method },
      );
      return answer === 'fallback' ? { status: 'fell through' as const } : answer;
    },
  };
}

test('the file route answers one GET, refuses other methods, and then is gone', async () => {
  const page = fakePage();
  const { requested } = await serveSessionOnce(page as never, 'http://127.0.0.1:9', '/__lolly-open/abc/x.lolly', new Uint8Array([1, 2, 3]));
  let asked = false;
  void requested.then(() => { asked = true; });
  assert.equal((await page.ask('http://127.0.0.1:9/__lolly-open/abc/other.lolly')).status, 'fell through');
  assert.equal((await page.ask('http://evil.test/__lolly-open/abc/x.lolly')).status, 'fell through');
  assert.equal((await page.ask('http://127.0.0.1:9/__lolly-open/abc/x.lolly', 'POST')).status, 405);
  await Promise.resolve();
  assert.equal(asked, false, 'a refused method is not the page asking');
  const first = await page.ask('http://127.0.0.1:9/__lolly-open/abc/x.lolly');
  assert.equal(first.status, 200);
  assert.deepEqual([...(first as unknown as { body: Buffer }).body], [1, 2, 3]);
  await requested;
  assert.equal((await page.ask('http://127.0.0.1:9/__lolly-open/abc/x.lolly')).status, 'fell through', 'one-shot');
  assert.equal(page.routes.length, 0);

  await assert.rejects(
    serveSessionOnce(fakePage() as never, 'http://127.0.0.1:9', '/p', new Uint8Array(OPEN_ROUTE_MAX_BYTES + 1)),
    (err: unknown) => err instanceof OpenSessionError && /over the 64 MB/.test(err.message),
  );
});

test('a long address in an error message is cut to its head and its length', () => {
  const long = `http://127.0.0.1:5173/#/tool/design?boxes=${'a'.repeat(3_000_000)}`;
  const message = shortenUrls(`page.goto: net::ERR_ABORTED at ${long}\nCall log: navigating to "${long}"`);
  assert.ok(message.length < 1_000, `${message.length} characters`);
  assert.match(message, /3,000,0\d\d characters/);
  assert.equal(shortenUrls('see http://127.0.0.1:9/#/open'), 'see http://127.0.0.1:9/#/open');
});

const TOKENS = { color: { $type: 'color', ink: { $value: '#000000' } }, $themes: [{ name: 'light' }, { name: 'dark' }] };
const GROUPED = { a: {}, $themes: [{ id: 'l', name: 'light', group: 'mode' }, { id: 'd', name: 'dark', group: 'mode' }, { id: 'x', name: 'dense', group: 'size' }] };

test('--themes names become _themes choices, in the order given; all is every declared theme', () => {
  assert.deepEqual(themeRuns(TOKENS, 'dark,light'), [{ theme: 'dark', selection: { '': 'dark' } }, { theme: 'light', selection: { '': 'light' } }]);
  assert.deepEqual(themeRuns(TOKENS, 'all').map((r) => r.theme), ['light', 'dark']);
  assert.deepEqual(themeRuns(TOKENS, 'dark, dark').length, 1);
  assert.deepEqual(themeRuns(GROUPED, 'dark')[0]!.selection, { mode: 'd', size: 'x' });
  assert.throws(() => themeRuns(TOKENS, 'dusk'), /does not declare: dusk\. Its themes are light, dark/);
  assert.throws(() => themeRuns({ color: {} }, 'dark'), /declares none/);
  assert.throws(() => themeRuns(TOKENS, ' , '), /at least one theme/);
});

test('each theme is written beside --output as <stem>-<theme>.<ext>, and --output is required', () => {
  assert.equal(themedOutputPath('deck.pptx', 'dark'), 'deck-dark.pptx');
  assert.equal(themedOutputPath('out/deck.v2.pdf', 'light'), join('out', 'deck.v2-light.pdf'));
  assert.equal(themedOutputPath('/tmp/x', 'mode/dark'), '/tmp/x-mode-dark');
  assert.equal(themesPlan({}, undefined), null);
  assert.equal(themesPlan({ themes: 'dark' }, 'a.png'), 'dark');
  assert.throws(() => themesPlan({ themes: 'dark' }, undefined), /needs --output/);
  assert.throws(() => themesPlan({ themes: 'dark' }, '-'), /needs --output/);
  assert.throws(() => themesPlan({ themes: 'dark', _themes: '{}' }, 'a.png'), /both choose the theme/);
  assert.deepEqual(designSessionRunPlan({ export: 'pptx', output: 'x.pptx', themes: 'light,dark' }), { format: 'pptx', themes: 'light,dark', output: 'x.pptx' });
  assert.throws(() => designSessionRunPlan({ export: 'pptx', themes: 'dark' }), /needs --output/);
});

test('lolly run refuses --themes without --output (exit 2) before anything renders', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-themes-'));
  try {
    const rows = join(dir, 'rows.json');
    writeFileSync(rows, JSON.stringify([{ id: 'f', kind: 'frame', x: 0, y: 0, w: 100, h: 100 }]));
    const env = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1', LOLLY_WEB_BASE: 'http://127.0.0.1:9' };
    const run = (args: string[]) => spawnSync(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), 'run', 'design', `--boxes-data=${rows}`, ...args], { env, encoding: 'utf8', cwd: dir });
    const noOutput = run(['--export=svg', '--themes=light,dark']);
    assert.equal(noOutput.status, 2, noOutput.stderr);
    assert.match(noOutput.stderr, /needs --output/);
    const unknown = run(['--export=svg', '--themes=dusk', `--output=${join(dir, 'x.svg')}`]);
    assert.equal(unknown.status, 2, unknown.stderr);
    assert.match(unknown.stderr, /does not declare: dusk/);
    // An SVG-native tool renders with no browser: one file per theme, named after
    // --output, each in its own theme's colours.
    const qr = spawnSync(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), 'run', 'qr-code', '--url=https://example.com', '--themes=light,dark', `--output=${join(dir, 'qr.svg')}`], { env, encoding: 'utf8', cwd: dir });
    assert.equal(qr.status, 0, qr.stderr);
    const light = readFileSync(join(dir, 'qr-light.svg'), 'utf8');
    const dark = readFileSync(join(dir, 'qr-dark.svg'), 'utf8');
    assert.match(light, /<svg/);
    assert.notEqual(light, dark);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Run `body` with these environment variables set (undefined unsets), then put them back. */
async function withEnv<T>(vars: Record<string, string | undefined>, body: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return await body(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

/** A stand-in for the desktop app's render endpoint (render_server.rs framing), answering every job with `answer`. */
async function fakeDesktop(answer: Uint8Array): Promise<{ port: number; seen: Array<Record<string, unknown>>; close: () => Promise<void> }> {
  const seen: Array<Record<string, unknown>> = [];
  const server = createServer((socket: Socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
      const all = Buffer.concat(chunks);
      if (all.length < 4 || all.length < all.readUInt32BE(0) + 4) return;
      const request = JSON.parse(all.subarray(4, 4 + all.readUInt32BE(0)).toString('utf8')) as Record<string, unknown>;
      seen.push(request);
      const body = Buffer.from(JSON.stringify(request.token === 'tok' ? { ok: true, bytes: Buffer.from(answer).toString('base64') } : { ok: false, error: 'token' }));
      const header = Buffer.alloc(4);
      header.writeUInt32BE(body.length, 0);
      socket.end(Buffer.concat([header, body]));
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', () => done()));
  const port = (server.address() as { port: number }).port;
  return { port, seen, close: () => new Promise<void>((done) => server.close(() => done())) };
}

test('a Design render keeps the desktop rung: an address that fits goes to the running app, not Chromium (E27)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-desktop-rung-'));
  const desktop = await fakeDesktop(PNG);
  try {
    const advert = join(dir, 'render.json');
    writeFileSync(advert, JSON.stringify({ port: desktop.port, token: 'tok', pid: process.pid, version: 'test' }));
    // No web shell is reachable, so a render that went to Chromium could not succeed.
    const out = await withEnv({ LOLLY_RENDER_SERVER: advert, LOLLY_RENDERER: undefined, LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_DESKTOP_BIN: join(dir, 'none') }, () =>
      renderDesignViaSession({ boxes: [] }, 'png', { width: 640, height: 360 }, { urlQuery: 'boxes=%5B%5D' }));
    assert.deepEqual([...out.bytes], [...PNG]);
    assert.equal(desktop.seen.length, 1);
    const toolUrl = String(desktop.seen[0]!.toolUrl);
    assert.match(toolUrl, /#\/tool\/design\?/);
    assert.equal(new URLSearchParams(toolUrl.split('?')[1]).get('boxes'), '[]', 'the document travels in the address the app reads');
    assert.equal(desktop.seen[0]!.format, 'png');
  } finally {
    await desktop.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lolly run design hands its Tier B render to a running desktop app when the address fits', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-desktop-cli-'));
  const pdf = new TextEncoder().encode('%PDF-1.7 from the desktop app');
  const desktop = await fakeDesktop(pdf);
  try {
    const advert = join(dir, 'render.json');
    writeFileSync(advert, JSON.stringify({ port: desktop.port, token: 'tok', pid: process.pid, version: 'test' }));
    const rows = join(dir, 'rows.json');
    writeFileSync(rows, JSON.stringify([{ id: 'f', kind: 'frame', x: 0, y: 0, w: 640, h: 360, bg: '#ffffff' }, { id: 't', kind: 'text', frame: 'f', x: 10, y: 10, w: 300, h: 60, text: 'Hello' }]));
    const env: NodeJS.ProcessEnv = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1', LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDER_SERVER: advert, LOLLY_DESKTOP_BIN: join(dir, 'none') };
    delete env.LOLLY_RENDERER;
    const out = join(dir, 'deck.pdf');
    const child = spawn(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), 'run', 'design', `--boxes-data=${rows}`, '--export=pdf', `--output=${out}`, '--no-provenance'], { env, cwd: dir });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += String(d); });
    const code = await new Promise<number | null>((done) => child.on('close', done));
    assert.equal(code, 0, stderr);
    assert.equal(desktop.seen.length, 1, stderr);
    assert.match(String(desktop.seen[0]!.toolUrl), /#\/tool\/design\?.*boxes=/);
    assert.equal(readFileSync(out, 'utf8'), '%PDF-1.7 from the desktop app');
  } finally {
    await desktop.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the desktop request cap is the 1 MiB the app reads, with room for the rest of the request', () => {
  assert.equal(DESKTOP_REQUEST_MAX_BYTES, 1 << 20);
  assert.equal(fitsDesktopRequest(`https://lolly.tools/#/tool/design?boxes=${'a'.repeat(1000)}`), true);
  assert.equal(fitsDesktopRequest('x'.repeat(DESKTOP_REQUEST_MAX_BYTES)), false);
  assert.equal(fitsDesktopRequest('x'.repeat(DESKTOP_REQUEST_MAX_BYTES - 8 * 1024)), true);
});

test('a durable Design render refuses a dist with no TrustMark encoder before any browser starts', async () => {
  const dist = mkdtempSync(join(tmpdir(), 'lolly-dist-'));
  try {
    assert.equal(existsSync(join(dist, 'models')), false);
    await withEnv({ LOLLY_WEB_DIST: dist, LOLLY_WEB_BASE: undefined, LOLLY_RENDERER: 'chromium' }, () =>
      assert.rejects(
        renderDesignViaSession({ boxes: [] }, 'png', { durable: true }),
        (err: unknown) => err instanceof Error && /TrustMark encoder model/.test(err.message) && err.message.includes(dist),
      ));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('--themes reads a stdin input once and hands it to every theme (exit 0, a file per theme)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-themes-stdin-'));
  try {
    const env = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1', LOLLY_WEB_BASE: 'http://127.0.0.1:9' };
    const run = spawnSync(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), 'run', 'strip-data', '--source=-', '--themes=light,dark', `--output=${join(dir, 's.png')}`], { env, input: PNG, cwd: dir });
    assert.equal(run.status, 0, String(run.stderr));
    assert.ok(readFileSync(join(dir, 's-light.png')).length > 0);
    assert.ok(readFileSync(join(dir, 's-dark.png')).length > 0, 'the second theme saw the same stdin');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a saved session takes --theme or --_themes for one file under the exact --output name', () => {
  assert.deepEqual(designSessionRunPlan({ export: 'pptx', output: 'light.pptx', theme: 'light' }), { format: 'pptx', theme: 'light', output: 'light.pptx' });
  assert.deepEqual(designSessionRunPlan({ export: 'pdf', _themes: '{"":"dark"}' }), { format: 'pdf', selection: { '': 'dark' } });
  assert.throws(() => designSessionRunPlan({ export: 'pptx', output: 'x.pptx', theme: 'dark', themes: 'light,dark' }), /--themes writes one file per theme; --theme picks/);
  assert.throws(() => designSessionRunPlan({ export: 'pptx', theme: 'dark', _themes: '{}' }), /both choose the theme/);
  assert.throws(() => designSessionRunPlan({ export: 'pptx', theme: 'light,dark' }), /takes one theme name/);
  assert.throws(() => designSessionRunPlan({ export: 'pptx', theme: 'all' }), /takes one theme name/);
  assert.throws(() => designSessionRunPlan({ export: 'pptx', _themes: '["dark"]' }), /JSON object of token group to theme id/);
});

test('the page is started with the design system the caller resolved, by an init script only', async () => {
  assert.equal(PAGE_DESIGN_SYSTEM_GLOBAL, AUTOMATION_DESIGN_SYSTEM_GLOBAL, 'the driver and the web token bridge name the same global');
  const scripts: Array<{ fn: (arg: { key: string; value: unknown }) => void; arg: { key: string; value: unknown } }> = [];
  const page = { addInitScript: async (fn: (arg: { key: string; value: unknown }) => void, arg: { key: string; value: unknown }) => { scripts.push({ fn, arg }); } };
  await seedPageDesignSystem(page as never, undefined);
  await seedPageDesignSystem(page as never, ['not', 'a', 'document']);
  assert.equal(scripts.length, 0, 'no document, no script: the page keeps its profile system');
  const doc = { color: { brand: { navy: { $type: 'color', $value: '#0b2545' } } } };
  await seedPageDesignSystem(page as never, doc);
  assert.equal(scripts.length, 1);
  const g = globalThis as Record<string, unknown>;
  try {
    scripts[0]!.fn(scripts[0]!.arg);
    assert.deepEqual(g[AUTOMATION_DESIGN_SYSTEM_GLOBAL], doc);
  } finally {
    delete g[AUTOMATION_DESIGN_SYSTEM_GLOBAL];
  }
});

test('lolly run design --file resolves links in that system and sends it with the render', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-run-file-'));
  const desktop = await fakeDesktop(new TextEncoder().encode('%PDF-1.7 desktop'));
  try {
    const advert = join(dir, 'render.json');
    writeFileSync(advert, JSON.stringify({ port: desktop.port, token: 'tok', pid: process.pid, version: 'test' }));
    // A frame painted with a linked colour whose cached value is stale.
    const rows = join(dir, 'rows.json');
    writeFileSync(rows, JSON.stringify([{ id: 'f', kind: 'frame', x: 0, y: 0, w: 640, h: 360, bg: '#000000', tokenLinks: JSON.stringify({ bg: { ref: '{color.brand.navy}', value: '#000000' } }) }]));
    const env: NodeJS.ProcessEnv = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1', LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_RENDER_SERVER: advert, LOLLY_DESKTOP_BIN: join(dir, 'none'), LOLLY_RENDERER: 'desktop' };
    const tokens = join(root, 'tests/fixtures/recreate/tokens.json');
    const navy = JSON.parse(readFileSync(tokens, 'utf8')).base?.color?.brand?.navy?.$value as string;
    assert.match(navy, /^#[0-9a-f]{6}$/i, 'the fixture names a navy');
    const child = spawn(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), 'run', 'design', `--boxes-data=${rows}`, `--file=${tokens}`, '--export=pdf', `--output=${join(dir, 'x.pdf')}`, '--no-provenance'], { env, cwd: dir });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += String(d); });
    const code = await new Promise<number | null>((done) => child.on('close', done));
    assert.equal(code, 0, stderr);
    // The desktop app was asked explicitly, and it renders in its own system: the note says so.
    assert.match(stderr, /in the app's own design system/);
    const sent = new URLSearchParams(String(desktop.seen[0]!.toolUrl).split('?')[1]).get('boxes') ?? '';
    // The compact wire writes a colour without its `#`.
    assert.ok(sent.toLowerCase().includes(`,${navy.slice(1).toLowerCase()},`), `the runtime resolved the link in --file's system: ${sent.slice(0, 300)}`);

    const other = spawnSync(process.execPath, [join(root, 'shells/cli/bin/lolly.ts'), 'run', 'qr-code', '--url=https://example.com', `--file=${tokens}`, `--output=${join(dir, 'q.svg')}`], { env, encoding: 'utf8', cwd: dir });
    assert.equal(other.status, 2, other.stderr);
    assert.match(other.stderr, /takes no --file/);
  } finally {
    await desktop.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
