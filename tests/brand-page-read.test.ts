// SPDX-License-Identifier: MPL-2.0
/**
 * Reading a brand page somebody published (plan 351 B4). A page is data from a stranger:
 * the digest decides what is believed, fetches stay on the page's own origin, sizes are
 * bounded, and nothing the page says reaches a terminal as a control sequence.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { brandPageDigest, buildBrandPage, type BrandPageInputV1 } from '../engine/src/brand-page.ts';
import { sha256Hex } from '../engine/src/bytes.ts';
import { readBrandPage, readBrandPageLogo } from '../packages/node-shell/src/brand-page-read.ts';
import { terminalSafe } from '../shells/cli/src/block-files.ts';

const BIN = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
const SVG = (fill: string): Uint8Array => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${fill}"/></svg>`);

/** The publisher's words carry an escape sequence, as a hostile page's would. */
const STATEMENT = 'Ask before you change the mark.\u001b]0;pwned\u0007\u001b[2J';

const TOKENS = {
  $metadata: { tokenSetOrder: ['base'] },
  base: {
    color: { $type: 'color', brand: { ink: { $value: '#111111' }, paper: { $value: '#ffffff' } }, semantic: { primary: { $value: '{color.brand.ink}' }, surface: { $value: '{color.brand.paper}' }, text: { $value: '{color.brand.ink}' } } },
    font: { $type: 'fontFamily', brand: { $value: 'Acme Sans' } },
  },
};

function pageInput(): BrandPageInputV1 {
  return {
    tokens: TOKENS, name: 'Acme', id: 'acme', usage: { statement: STATEMENT, contact: 'brand@example.com' },
    catalog: {
      assets: [
        { id: 'acme/logo/alternate', name: 'Alternate', type: 'vector', tags: ['logo', 'on-light'] },
        { id: 'acme/logo/mono', name: 'Mono', type: 'vector', tags: ['logo', 'on-light', 'mono'] },
        { id: 'acme/logo/on-light', name: 'For light', type: 'vector', tags: ['logo', 'on-light'] },
        { id: 'acme/logo/on-dark', name: 'For dark', type: 'vector', tags: ['logo', 'on-dark'] },
      ],
      logos: { onLight: 'acme/logo/on-light', onDark: 'acme/logo/on-dark' },
    },
    logos: [
      { id: 'acme/logo/alternate', name: 'Alternate', format: 'svg', bytes: SVG('#222222'), license: 'CC0-1.0', tags: ['logo', 'on-light'] },
      { id: 'acme/logo/mono', name: 'Mono', format: 'svg', bytes: SVG('#000000'), license: 'CC0-1.0', tags: ['logo', 'on-light', 'mono'] },
      { id: 'acme/logo/on-light', name: 'For light', format: 'svg', bytes: SVG('#111111'), license: 'CC0-1.0', tags: ['logo', 'on-light'] },
      { id: 'acme/logo/on-dark', name: 'For dark', format: 'svg', bytes: SVG('#eeeeee'), license: 'CC0-1.0', tags: ['logo', 'on-dark'] },
    ],
  } as BrandPageInputV1;
}

let root = '';
let good = '';

/** Write a copy of the page, after `change` has edited its files, into a new folder. */
function pageCopy(name: string, files: Map<string, Uint8Array>, change?: (files: Map<string, Uint8Array>) => void): string {
  const dir = join(root, name);
  const copy = new Map(files);
  change?.(copy);
  for (const [path, bytes] of copy) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  }
  return dir;
}

let builtFiles = new Map<string, Uint8Array>();

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'lolly-brand-page-read-'));
  const built = await buildBrandPage(pageInput());
  builtFiles = new Map(built.files.map(f => [f.path, f.bytes]));
  good = pageCopy('good', builtFiles);
});
after(() => { rmSync(root, { recursive: true, force: true }); });

const enc = new TextEncoder();
const manifestOf = (files: Map<string, Uint8Array>): Record<string, unknown> & { files: Array<{ path: string; sha256: string; size: number }> } => JSON.parse(new TextDecoder().decode(files.get('brand.json')!));
/** A manifest that hashes correctly after an edit: the digest alone cannot catch this forger. */
async function reSealed(files: Map<string, Uint8Array>, edit: (m: ReturnType<typeof manifestOf>) => void): Promise<void> {
  const manifest = manifestOf(files);
  edit(manifest);
  manifest.digest = await brandPageDigest(manifest as never);
  files.set('brand.json', enc.encode(JSON.stringify(manifest)));
}

test('a folder reads, with the logo for each surface', async () => {
  const page = await readBrandPage(good);
  assert.equal(page.manifest.id, 'acme');
  const logos = page.manifest.logos ?? [];
  assert.equal(logos.length, 4, 'the manifest lists its logos');
  for (const logo of logos) assert.ok(page.manifest.files.some(f => f.path === logo.path), `${logo.path} is a listed file`);
  assert.equal(new TextDecoder().decode(await readBrandPageLogo(page, page.logo('light')!)).includes('<svg'), true);
});

test('the logo a brand leads with on a surface wins, ahead of another name or a mono, and an old page has none', async () => {
  const page = await readBrandPage(good);
  assert.equal(page.logo('light')!.id, 'acme/logo/on-light');
  assert.equal(page.logo('dark')!.id, 'acme/logo/on-dark');
  assert.equal(page.manifest.logos!.find(l => l.id === 'acme/logo/alternate')!.primary, undefined);
  const old = pageCopy('old', builtFiles);
  const files = new Map(builtFiles);
  await reSealed(files, m => { delete m.logos; });
  writeFileSync(join(old, 'brand.json'), files.get('brand.json')!);
  assert.equal((await readBrandPage(old)).logo('light'), null);
});

test('a file that does not match its digest is refused, and so is an altered manifest', async () => {
  const altered = pageCopy('altered-file', builtFiles, files => { files.set('logos/acme/logo/on-light.svg', SVG('#ff0000')); });
  const page = await readBrandPage(altered);
  await assert.rejects(page.file('logos/acme/logo/on-light.svg'), { code: 'BRAND_PAGE_DIGEST' });
  const forged = pageCopy('altered-manifest', builtFiles, files => {
    const manifest = manifestOf(files);
    manifest.name = 'Somebody else';
    files.set('brand.json', enc.encode(JSON.stringify(manifest)));
  });
  await assert.rejects(readBrandPage(forged), { code: 'BRAND_PAGE_DIGEST' });
});

test('a manifest cannot point a read outside the page, even when it hashes correctly', async () => {
  for (const path of ['../secret.svg', '/etc/passwd', 'logos/../../secret.svg', 'https://evil.example/x.svg', '//evil.example/x.svg', 'a\\b.svg']) {
    const files = new Map(builtFiles);
    await reSealed(files, m => { m.files[0]!.path = path; });
    const dir = pageCopy(`escape-${Buffer.from(path).toString('hex')}`, files);
    await assert.rejects(readBrandPage(dir), { code: 'BRAND_PAGE_INVALID' }, path);
  }
  const page = await readBrandPage(good);
  await assert.rejects(page.file('not/listed.svg'), { code: 'BRAND_PAGE_INVALID' });
});

test('a symlink in a folder is not followed out of the page', async () => {
  const dir = pageCopy('symlinked', builtFiles);
  const outside = join(root, 'outside.svg');
  writeFileSync(outside, SVG('#000000'));
  const target = join(dir, 'logos/acme/logo/on-light.svg');
  rmSync(target);
  symlinkSync(outside, target);
  const page = await readBrandPage(dir);
  await assert.rejects(page.file('logos/acme/logo/on-light.svg'), { code: 'BRAND_PAGE_FETCH' });
});

test('an SVG that is not inert is refused even when its digest is right', async () => {
  const bad = enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const files = new Map(builtFiles);
  files.set('logos/acme/logo/on-light.svg', bad);
  const hash = await sha256Hex(bad);
  await reSealed(files, m => {
    const row = m.files.find(f => f.path === 'logos/acme/logo/on-light.svg')!;
    row.sha256 = hash;
    row.size = bad.byteLength;
  });
  const page = await readBrandPage(pageCopy('script', files));
  const logo = page.manifest.logos!.find(l => l.path === 'logos/acme/logo/on-light.svg')!;
  await assert.rejects(readBrandPageLogo(page, logo), { code: 'BRAND_PAGE_INVALID' });
});

async function serve(handler: Parameters<typeof createServer>[1]): Promise<{ origin: string; server: Server }> {
  const server = createServer(handler);
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

test('an address reads over the network, follows a redirect on its own origin and refuses one to another', async () => {
  const other = await serve((_req, res) => { res.writeHead(200); res.end(readFileSync(join(good, 'brand.json'))); });
  const main = await serve((req, res) => {
    const path = decodeURI((req.url ?? '').split('?')[0]!);
    if (path === '/moved/brand.json') { res.writeHead(302, { location: '/page/brand.json' }); res.end(); return; }
    if (path === '/away/brand.json') { res.writeHead(302, { location: `${other.origin}/page/brand.json` }); res.end(); return; }
    if (path.startsWith('/page/')) {
      const bytes = builtFiles.get(path.slice('/page/'.length));
      if (bytes) { res.writeHead(200); res.end(bytes); return; }
    }
    res.writeHead(404);
    res.end();
  });
  try {
    const page = await readBrandPage(`${main.origin}/page/`, { allowInsecureLoopback: true });
    assert.equal(page.manifest.id, 'acme');
    assert.ok((await page.file('logos/acme/logo/on-dark.svg')).byteLength > 0);
    assert.equal((await readBrandPage(`${main.origin}/moved`, { allowInsecureLoopback: true })).manifest.id, 'acme');
    await assert.rejects(readBrandPage(`${main.origin}/away`, { allowInsecureLoopback: true }), { code: 'BRAND_PAGE_REDIRECT' });
    await assert.rejects(readBrandPage(`${main.origin}/nowhere`, { allowInsecureLoopback: true }), { code: 'BRAND_PAGE_FETCH' });
  } finally {
    main.server.close();
    other.server.close();
  }
});

test('an address must be https, and carries no name or password', async () => {
  await assert.rejects(readBrandPage('http://example.com/brand/'), { code: 'BRAND_PAGE_ADDRESS' });
  await assert.rejects(readBrandPage('http://127.0.0.1:1/brand/'), { code: 'BRAND_PAGE_ADDRESS' }, 'plain http needs the test option even on this machine');
  await assert.rejects(readBrandPage('ftp://example.com/brand/'), { code: 'BRAND_PAGE_ADDRESS' });
  await assert.rejects(readBrandPage('https://me:secret@example.com/brand/'), { code: 'BRAND_PAGE_ADDRESS' });
});

test('an oversized answer is cut off, whatever length it declares', async () => {
  const huge = new Uint8Array(1024 * 1024).fill(32);
  const fetchImpl = (async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(huge); },
  }))) as unknown as typeof fetch;
  await assert.rejects(readBrandPage('https://example.com/brand/', { fetchImpl }), { code: 'BRAND_PAGE_TOO_LARGE' });
  const declared = (async () => new Response('{}', { headers: { 'content-length': String(1024 * 1024 * 1024) } })) as unknown as typeof fetch;
  await assert.rejects(readBrandPage('https://example.com/brand/', { fetchImpl: declared }), /larger|64|disallowed|limit/i);
});

test('a fetch never leaves the page\'s origin, whatever the manifest lists', async () => {
  const asked: string[] = [];
  const fetchImpl = (async (url: string) => {
    asked.push(String(url));
    const path = new URL(String(url)).pathname.replace(/^\/brand\//, '');
    const bytes = builtFiles.get(path);
    return bytes ? new Response(bytes as unknown as BodyInit) : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const page = await readBrandPage('https://example.com/brand', { fetchImpl });
  await page.file('logos/acme/logo/on-dark.svg');
  assert.ok(asked.length >= 2);
  for (const url of asked) assert.ok(url.startsWith('https://example.com/brand/'), url);
});

test('terminalSafe drops control characters and direction overrides, and keeps ordinary text', () => {
  assert.equal(terminalSafe(STATEMENT), 'Ask before you change the mark.]0;pwned[2J');
  assert.equal(terminalSafe('a‮b⁦c'), 'abc');
  assert.equal(terminalSafe('line one\nline two, café'), 'line one\nline two, café');
  assert.equal(terminalSafe('x'.repeat(50), 10).length, 10);
});

interface Run { code: number; stdout: Buffer; stderr: string }
function lolly(args: string[], env: NodeJS.ProcessEnv = {}): Promise<Run> {
  return new Promise(done => {
    execFile(process.execPath, [BIN, ...args], { env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(root, 'state'), ...env }, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ code: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout: stdout as Buffer, stderr: (stderr as Buffer).toString() });
    });
  });
}

test('logo-wall takes the logo for the surface and reports the page\'s own words', async () => {
  const out = join(root, 'wall.svg');
  const run = await lolly(['run', 'logo-wall', `--logos-from=${good}`, '--logos-surface=dark', '--knockout=false', `--output=${out}`]);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stderr, /Added acme\/logo\/on-dark from Acme's brand page/);
  assert.match(run.stderr, /for a dark surface/);
  assert.match(run.stderr, /Acme says about use: Ask before you change the mark\./);
  assert.match(run.stderr, /Contact: brand@example\.com/);
  assert.ok(!run.stderr.includes('\u001b'), 'no escape sequence from the page reaches the terminal');
  assert.match(readFileSync(out, 'utf8'), /<svg/);
});

test('a page\'s failure stops the run and says why', async () => {
  const altered = pageCopy('cli-altered', builtFiles, files => { files.set('logos/acme/logo/on-light.svg', SVG('#ff0000')); });
  const out = join(root, 'not-written.svg');
  const run = await lolly(['run', 'logo-wall', `--logos-from=${altered}`, `--output=${out}`]);
  assert.notEqual(run.code, 0);
  assert.match(run.stderr, /does not match its digest/);
  assert.match(run.stderr, /Nothing was rendered/);
});

test('a bad surface is refused, and a link cannot name a page', async () => {
  const wrong = await lolly(['run', 'logo-wall', `--logos-from=${good}`, '--logos-surface=blue', `--output=${join(root, 'x.svg')}`]);
  assert.notEqual(wrong.code, 0);
  assert.match(wrong.stderr, /takes light or dark/);
  const link = await lolly([`https://lolly.tools/t/logo-wall?logos-from=${encodeURIComponent(good)}`, `--output=${join(root, 'y.svg')}`]);
  assert.notEqual(link.code, 0);
  assert.match(link.stderr, /a link cannot/i);
});
