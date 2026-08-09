// SPDX-License-Identifier: MPL-2.0
/**
 * `--designv=` on the CLI — the design-system resolution ladder of plans/97 §6a,
 * pinned against the REAL binary (spawned like tests/cli-machine-contract.test.ts)
 * over a fixture catalog that actually ships a published version.
 *
 * Why the real binary: the ladder is only correct if the version reaches the token
 * set the tool's hooks read, and that path runs through argv → parseUrlState →
 * createCliBridge → createTokenSet. An in-process call to the bridge would pin the
 * last hop and miss the two that broke first (the flag being swallowed as an
 * unknown input, and the bridge being built before the query was parsed).
 *
 * What each rung is worth here:
 *   - no flag, `active: null`      → the edit head, exactly as before versions existed
 *   - `--designv=<slug>`           → that version's tokens AND its pinned asset bytes
 *   - `--designv=latest`           → the head, even when a pin or an active version says otherwise
 *   - a manifest `designVersion`   → that version, with no flag at all
 *   - `active: <slug>` in the ledger → that version, with no flag and no pin
 *   - an unknown slug              → the next rung down, and a warning on stderr
 *                                    naming what was rendered instead, rather
 *                                    than a silently different design system
 *
 * Run with: node --test tests/cli-design-version.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { TOKEN_EXT } from '../engine/src/tokens.ts';
import type { VersionEntry } from '../engine/src/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, '..', 'shells', 'cli', 'bin', 'lolly.ts');
const root = await mkdtemp(join(tmpdir(), 'lolly-designv-'));
after(() => rm(root, { recursive: true, force: true }));

const HEAD_ID = 'acme/tokens/brand';
const LOGO_ID = 'acme/logo/mark';
/** A frozen id is content-keyed: `<ns>/frozen/<first 12 hex>` (frozenAssetId). */
const FROZEN_ID = 'acme/frozen/aabbccddeeff';

/** A design system with one semantic colour and one asset token. */
const doc = (primary: string): Record<string, unknown> => ({
  color: { $type: 'color', semantic: { primary: { $value: primary } } },
  asset: { logo: { primary: { $type: 'asset', $value: LOGO_ID } } },
});

const V2_ENTRY: VersionEntry = {
  slug: 'v2',
  label: 'v2',
  date: '2026-08-01T00:00:00.000Z',
  checksum: 'not-checked-by-the-cli',
  // The logo's bytes were replaced after v2 published, so the pin carries the
  // frozen copy. Resolving under v2 must reach THAT id, not the live one.
  assets: [{ id: LOGO_ID, version: '1.0.0', sha256: 'a'.repeat(64), frozenId: FROZEN_ID }],
};

/** Rewrite the head document, optionally with a ledger. */
async function writeHead(primary: string, ledger: { list: VersionEntry[]; active: string | null } | null): Promise<void> {
  const head = doc(primary) as Record<string, unknown>;
  if (ledger) head.$extensions = { [TOKEN_EXT]: { versions: ledger } };
  await writeFile(join(root, 'catalog/assets/acme/tokens/brand.json'), JSON.stringify(head, null, 2));
}

// The readout rides in a data attribute, not a <desc>: the export path injects its
// own provenance <desc> right after the opening tag, so a <desc> here is not the
// first one out.
const TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect width="120" height="80" fill="#eeeeee" data-tokens="{{swatch}}|{{logo}}"/></svg>';

// The hook is the observation point on purpose: `host.tokens.resolve` is what a
// real tool reads, and it is the surface the version has to reach.
const HOOKS =
  'async function onInit() {\n' +
  "  const swatch = await host.tokens.resolve('{color.semantic.primary}');\n" +
  "  const logo = await host.tokens.resolve('{asset.logo.primary}');\n" +
  '  return { swatch: String(swatch), logo: String(logo) };\n' +
  '}\n';

function manifest(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    description: `${id} description`,
    render: { width: 120, height: 80, formats: ['svg'] },
    inputs: [],
    hooks: { onInit: true },
    ...extra,
  });
}

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets', 'acme', 'tokens', 'brand'), { recursive: true });
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({
  version: '1',
  assets: [
    // The HEAD design system, and one published version as its child id. Ordered
    // head-first here; the descendant-exclusion rule (pickHeadAssetId) is what
    // stops the version being picked as "the design system" either way.
    { id: HEAD_ID, type: 'tokens', version: '1.0.0', tier: 'core', formats: [{ format: 'json', url: `/catalog/assets/${HEAD_ID}.json` }] },
    { id: `${HEAD_ID}/v2`, type: 'tokens', version: '1.0.0', tier: 'core', formats: [{ format: 'json', url: `/catalog/assets/${HEAD_ID}/v2.json` }] },
  ],
}));
await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({
  version: '1',
  tools: [
    { id: 'tok-tool', name: 'tok-tool', status: 'community', description: 'tok-tool description', category: 'utility', formats: ['svg'] },
    { id: 'pin-tool', name: 'pin-tool', status: 'community', description: 'pin-tool description', category: 'utility', formats: ['svg'] },
  ],
}));
for (const [id, extra] of [['tok-tool', {}], ['pin-tool', { designVersion: 'v2' }]] as const) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), manifest(id, extra));
  await writeFile(join(root, 'tools', id, 'template.html'), TEMPLATE);
  await writeFile(join(root, 'tools', id, 'hooks.js'), HOOKS);
}
await writeFile(join(root, 'catalog/assets/acme/tokens/brand/v2.json'), JSON.stringify(doc('#222222'), null, 2));
await writeHead('#111111', { list: [V2_ENTRY], active: null });

function cli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: root,
      env: { ...process.env, LOLLY_ROOT: root, LOLLY_WEB_DIST: join(root, 'no-such-dist'), NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout!.on('data', (c: Buffer) => { out += c.toString('utf8'); });
    child.stderr!.on('data', (c: Buffer) => { err += c.toString('utf8'); });
    child.on('close', (code) => done({ stdout: out, stderr: err, code: code ?? -1 }));
  });
}

/** The `data-tokens="swatch|logo"` readout out of the rendered SVG. */
async function rendered(args: string[]): Promise<{ swatch: string; logo: string; stderr: string }> {
  const r = await cli(args);
  assert.equal(r.code, 0, `render failed (${r.code}):\n${r.stdout}\n${r.stderr}`);
  const m = /data-tokens="([^"]*)"/.exec(r.stdout);
  assert.ok(m, `no data-tokens readout in the render:\n${r.stdout}`);
  const [swatch = '', logo = ''] = m[1]!.split('|');
  return { swatch, logo, stderr: r.stderr };
}

const RUN = ['run', 'tok-tool', '--export=svg', '--no-provenance'];

test('no flag, nothing active: the edit head, and the live asset id', async () => {
  const { swatch, logo, stderr } = await rendered(RUN);
  assert.equal(swatch, '#111111');
  assert.equal(logo, LOGO_ID, 'an unresolved version pins nothing');
  assert.doesNotMatch(stderr, /design/i, 'a published version nobody asked for is not news');
});

test('--designv=<slug> renders that version, through its pinned asset', async () => {
  const { swatch, logo } = await rendered([...RUN, '--designv=v2']);
  assert.equal(swatch, '#222222');
  // The whole point of the asset manifest: v2's `{asset.logo.primary}` reaches the
  // bytes it published with, not whatever now answers to the head id.
  assert.equal(logo, FROZEN_ID);
});

test('--designv=latest renders the edit head', async () => {
  const { swatch, logo } = await rendered([...RUN, '--designv=latest']);
  assert.equal(swatch, '#111111');
  assert.equal(logo, LOGO_ID);
});

test('an unknown slug falls through to the head and says so', async () => {
  const { swatch, stderr } = await rendered([...RUN, '--designv=no-such-version']);
  assert.equal(swatch, '#111111', 'a render always draws — the ladder falls through, it does not fail');
  assert.match(stderr, /--designv=no-such-version names no design-system version/);
});

test('a bare --designv is a usage error, never the version literally named "1"', async () => {
  const r = await cli(['run', 'tok-tool', '--designv', '--export=svg']);
  assert.equal(r.code, 2, `expected USAGE, got ${r.code}:\n${r.stdout}\n${r.stderr}`);
});

test('a manifest designVersion pin renders that version with no flag', async () => {
  const r = await rendered(['run', 'pin-tool', '--export=svg', '--no-provenance']);
  assert.equal(r.swatch, '#222222');
  assert.equal(r.logo, FROZEN_ID);
});

test('a typo’d override is reported even when a manifest pin catches the fall', async () => {
  // The warning used to live inside the "fell all the way to the head" branch, so
  // a pinned tool swallowed it: the author typed one version, silently got
  // another, and nothing on stderr said the flag had been ignored.
  const r = await rendered(['run', 'pin-tool', '--export=svg', '--no-provenance', '--designv=v3']);
  assert.equal(r.swatch, '#222222', 'the ladder still falls through to the pin — a render always draws');
  assert.match(r.stderr, /--designv=v3 names no design-system version/);
  assert.match(r.stderr, /rendering against "v2" instead/, 'and names what it rendered instead');
});

test('--designv=latest beats a manifest pin (the author’s testing lever)', async () => {
  const r = await rendered(['run', 'pin-tool', '--export=svg', '--no-provenance', '--designv=latest']);
  assert.equal(r.swatch, '#111111');
  assert.equal(r.logo, LOGO_ID);
});

test('an active version renders with no flag and no pin', async () => {
  await writeHead('#111111', { list: [V2_ENTRY], active: 'v2' });
  try {
    const active = await rendered(RUN);
    assert.equal(active.swatch, '#222222');
    // …and the override still wins over it.
    const head = await rendered([...RUN, '--designv=latest']);
    assert.equal(head.swatch, '#111111');
  } finally {
    await writeHead('#111111', { list: [V2_ENTRY], active: null });
  }
});

test('byte identity: a catalog with no ledger renders exactly what an inactive ledger renders', async () => {
  const withLedger = await cli(RUN);
  await writeHead('#111111', null);
  try {
    const without = await cli(RUN);
    assert.equal(without.code, 0, without.stderr);
    // A design system that never published must be untouched by the machinery:
    // same bytes, and nothing extra on stderr.
    assert.equal(without.stdout, withLedger.stdout);
    assert.doesNotMatch(without.stderr, /design-system version/);
  } finally {
    await writeHead('#111111', { list: [V2_ENTRY], active: null });
  }
});
