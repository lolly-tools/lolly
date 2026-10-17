// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's `Rights:` block, over the REAL binary in a child process (plan 253,
 * stage E2).
 *
 * What it pins:
 *   - a CC BY set prints the credit, says whether the delivered file carries it,
 *     and exits 0
 *   - a CC BY-SA set that a treatment recoloured needs a licence for the
 *     adaptation: the issue code is named, the file is still written, and the
 *     run exits non-zero so a pipeline stops and reads
 *   - `--rights=private` states the use rather than silencing the rule: the same
 *     block prints, the credit is still there, and the run exits 0
 *   - there is no spelling for "ignore this licence"
 *
 * The fixture borrows the shared Twemoji pack the catalog actually registers,
 * and builds a second pack from the OpenMoji specimen in tests/fixtures/emoji -
 * the plan's own review artifact, a CC BY-SA illustration. It skips by name when
 * the shared pack is not in the checkout.
 *
 * Run with: node --test tests/rights-cli.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, '..', 'shells', 'cli', 'bin', 'lolly.ts');

const TWEMOJI_ID = 'community/emoji/twemoji/color';
const TWEMOJI_PIN = 'twemoji/color@17.0.3';
const OPENMOJI_PIN = 'openmoji/color@17.0.0';
const PACK_ROOT = join(HERE, '..', 'community', 'emoji-packs');
const BUNDLE = join(PACK_ROOT, 'twemoji-color.json');
const PACK_INDEX = join(PACK_ROOT, 'index.json');
const STARTER_DIR = join(HERE, '..', 'brands', 'lolly-start', 'catalog', 'assets');
const TOKENS_ID = 'lolly/tokens/brand';
const TOKENS = join(STARTER_DIR, 'lolly', 'tokens', 'brand.json');
const INDEX = join(STARTER_DIR, 'index.json');

const available = existsSync(BUNDLE) && existsSync(PACK_INDEX) && existsSync(TOKENS) && existsSync(INDEX);
const SKIP = available ? false
  : `The shared Twemoji pack is not in this checkout (${BUNDLE}) - nothing to draw from.`;

/** A registered entry, verbatim, so the fixture never carries a stale copy. */
function entry(indexPath: string, id: string): Record<string, unknown> | null {
  if (!existsSync(indexPath)) return null;
  const parsed = JSON.parse(readFileSync(indexPath, 'utf8')) as { assets?: Array<Record<string, unknown>> };
  return (parsed.assets ?? []).find((a) => a.id === id) ?? null;
}

const root = await mkdtemp(join(tmpdir(), 'lolly-rights-cli-'));
after(() => rm(root, { recursive: true, force: true }));

if (available) {
  const { fixture } = await import('./helpers/emoji-fixtures.ts');
  const openmoji = await fixture('openmoji');
  const manifestText = openmoji.bytes.toString('utf8');

  await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
  await mkdir(join(root, 'catalog', 'packs', 'emoji-packs'), { recursive: true });
  await mkdir(join(root, 'catalog', 'assets', 'lolly', 'tokens'), { recursive: true });
  await copyFile(BUNDLE, join(root, 'catalog', 'packs', 'emoji-packs', 'twemoji-color.json'));
  await copyFile(TOKENS, join(root, 'catalog', 'assets', 'lolly', 'tokens', 'brand.json'));
  // The OpenMoji specimen as a bundle: the exact manifest text the pin hashes,
  // plus the one glyph's untouched source SVG, laid out the way the shared pack
  // root is so the same host code reads both.
  await writeFile(join(root, 'catalog', 'packs', 'emoji-packs', 'openmoji-color.json'), JSON.stringify({
    schemaVersion: 1,
    kind: 'emoji-pack-bundle',
    manifest: manifestText,
    artwork: { '1f600.svg': openmoji.artwork.toString('utf8') },
  }));
  await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({
    assets: [
      entry(PACK_INDEX, TWEMOJI_ID),
      entry(INDEX, TOKENS_ID),
      {
        id: openmoji.manifest.id,
        name: 'OpenMoji Color',
        description: 'The OpenMoji specimen, as a one-glyph pack.',
        type: 'data',
        version: openmoji.manifest.version,
        tier: 'on-demand',
        tags: ['emoji-pack', 'emoji'],
        license: openmoji.manifest.source.license,
        attribution: openmoji.manifest.source.attribution,
        formats: [{ format: 'json', url: '/catalog/packs/emoji-packs/openmoji-color.json' }],
        meta: {
          emoji: {
            id: openmoji.manifest.id,
            version: openmoji.manifest.version,
            checksum: openmoji.lock.pin.checksum,
            family: openmoji.manifest.family,
            style: openmoji.manifest.style,
            label: 'OpenMoji Color',
            glyphs: openmoji.manifest.glyphs.length,
            coverageComplete: false,
            license: openmoji.manifest.source.license,
            licenseUrl: openmoji.manifest.source.licenseUrl,
            attribution: openmoji.manifest.source.attribution,
          },
        },
      },
    ],
  }));
  await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({
    version: '1',
    tools: [{ id: 'emoji-card', name: 'emoji-card', status: 'community', description: 'emoji-card description', category: 'utility', formats: ['html'] }],
  }));
  await mkdir(join(root, 'tools', 'emoji-card'), { recursive: true });
  await writeFile(join(root, 'tools', 'emoji-card', 'tool.json'), JSON.stringify({
    id: 'emoji-card', name: 'emoji-card', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    description: 'A line of text on a card',
    render: { width: 480, height: 200, formats: ['html'] },
    inputs: [{ id: 'line', type: 'text', label: 'Line', default: 'hello' }],
  }));
  await writeFile(join(root, 'tools', 'emoji-card', 'template.html'),
    '<div class="card"><p class="line">{{line}}</p></div>');
}

interface Run { stdout: string; stderr: string; code: number }

function cli(args: string[]): Promise<Run> {
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

const LINE = 'Field notes \u{1f600}';

/** One render into the fixture root, with whatever flags the case needs. */
function render(name: string, flags: string[]): Promise<Run> {
  return cli(['emoji-card', `--line=${LINE}`, ...flags, '--export=html', `--output=${join(root, `${name}.html`)}`]);
}

test('a CC BY set prints its credit and exits 0', { skip: SKIP }, async () => {
  const run = await render('by', [`--emoji=${TWEMOJI_PIN}`]);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stderr, /Rights: ready/);
  assert.match(run.stderr, /grinning face/);
  // The pack asked to be credited in its own words, so the credit carries those
  // and the licence part adds the link rather than the name a second time.
  assert.match(run.stderr, /Twemoji graphics by Twitter, Inc\. and other contributors, CC BY 4\.0, https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.doesNotMatch(run.stderr, /actions-required/);
  // The block says what the FILE carries, either way, and never both.
  assert.equal(/Credits included in this file's metadata\./.test(run.stderr)
    !== /Credits are NOT in this file/.test(run.stderr), true, run.stderr);
  assert.ok(existsSync(join(root, 'by.html')), 'the file is written');
});

test('a recoloured CC BY-SA set names the decision, writes the file, and exits non-zero', { skip: SKIP }, async () => {
  const run = await render('bysa', [`--emoji=${OPENMOJI_PIN}`, '--emojifx=snap']);
  assert.match(run.stderr, /Rights: actions-required/);
  assert.match(run.stderr, /licence\.adaptation-choice - If you share this adaptation, it needs a compatible licence\./);
  assert.match(run.stderr, /CC BY-SA 4\.0/);
  // The changes the credit states are the ones the credential records for the
  // same source, word for word, rather than the operation vocabulary.
  assert.match(run.stderr, /changes: Canonicalized SVG syntax and inline presentation styles, Prefixed local SVG ids and paint references for placement, Recoloured every paint with emoji-treatment-v1 in snap mode\./);
  assert.match(run.stderr, /--rights=private/, 'the way out is named, and it is a statement about the use');
  assert.equal(run.code, 4, `a remaining action is a protective check, not a broken run: ${run.stderr}`);
  assert.ok(existsSync(join(root, 'bysa.html')), 'private work stays usable: the file is still written');
});

test('--rights=private states the use and exits 0, and still prints the credit', { skip: SKIP }, async () => {
  const run = await render('private', [`--emoji=${OPENMOJI_PIN}`, '--emojifx=snap', '--rights=private']);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stderr, /Rights: ready \(private use; no delivery claim recorded\)/);
  assert.match(run.stderr, /CC BY-SA 4\.0/, 'the credit is still owed and still printed');
  assert.doesNotMatch(run.stderr, /adaptation-choice/);
});

test('there is no flag for ignoring a licence condition', { skip: SKIP }, async () => {
  const run = await render('ignored', [`--emoji=${OPENMOJI_PIN}`, '--emojifx=snap', '--rights=ignore']);
  assert.equal(run.code, 2, run.stderr);
  assert.match(run.stderr, /--rights only takes "private"/);
  assert.match(run.stderr, /There is no flag for ignoring a licence condition\./);
  assert.equal(existsSync(join(root, 'ignored.html')), false, 'a usage error renders nothing');
});

test('a render with no recorded source prints no rights block at all', { skip: SKIP }, async () => {
  const run = await cli(['emoji-card', '--line=Plain text', '--export=html', `--output=${join(root, 'plain.html')}`]);
  assert.equal(run.code, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /Rights:/);
  assert.match(await readFile(join(root, 'plain.html'), 'utf8'), /Plain text/);
});

// The first test above accepts either answer, because whether a credential is
// written depends on the format and the settings. These two name the setting and
// read the written file, so the Rights block's claim is checked against the bytes.
test('with Content Credentials on, the Rights block says credits are included exactly when the written file carries them', { skip: SKIP }, async () => {
  const run = await render('stamped', [`--emoji=${TWEMOJI_PIN}`, '--c2pa=on']);
  assert.equal(run.code, 0, run.stderr);
  const { verifyC2pa } = await import('../engine/src/c2pa-verify.ts');
  const report = await verifyC2pa(new Uint8Array(await readFile(join(root, 'stamped.html'))));
  const carried = report.state === 'valid' && (report.ingredients ?? []).some((ingredient) => /grinning face/.test(ingredient.title ?? ''));
  assert.equal(/Credits included in this file's metadata\./.test(run.stderr), carried, run.stderr);
  assert.equal(/Credits are NOT in this file/.test(run.stderr), !carried, run.stderr);
});

test('with Content Credentials off, the same render says its credit is not in the file', { skip: SKIP }, async () => {
  const run = await render('unstamped', [`--emoji=${TWEMOJI_PIN}`, '--c2pa=off']);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stderr, /Credits are NOT in this file/);
  assert.doesNotMatch(run.stderr, /Credits included in this file's metadata/);
  assert.match(run.stderr, /CC BY 4\.0/, 'the credit is printed to deliver another way');
});
