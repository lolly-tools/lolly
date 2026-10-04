// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly run <design-session.lolly>` and the helpers that command uses (plan 291 W8), without a
 * browser: which addresses count as an opened tool slot, the file name the page fetches,
 * which `.lolly` files take the session path, and the flags that path refuses before
 * any browser starts. The export itself is covered by tests/open-route.browser.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { openedToolSlot, openLollyViaWebShell, openRouteFileName, openRouteRefusal } from '../packages/node-shell/src/webshell-render.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';
import { buildDesignLolly } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { designSessionRunPlan, isDesignSessionFile, sessionFrameChoice, sessionFramePages, sessionOutputFolderCheck } from '../shells/cli/src/design-session.ts';

const root = resolve(import.meta.dirname, '..');

async function sessionFile(boxes: Array<Record<string, unknown>> = [{ id: 'one', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' }]): Promise<Uint8Array> {
  const { bytes } = await buildDesignLolly({
    session: { values: { boxes, __toolId: 'design', __label: 'Session run', __export_width: '1920', __export_height: '1080', __export_unit: 'px' }, mediaRefs: [] },
    media: new Map(), name: 'Session run', exportedAt: '2026-10-03T00:00:00.000Z',
  });
  return bytes;
}

test('an opened tool slot is read from the hash route, the canonical path and Design\'s own path', () => {
  assert.deepEqual(openedToolSlot('http://127.0.0.1:5173/#/tool/design?slot=design%3A17'), { toolId: 'design', slot: 'design:17' });
  assert.deepEqual(openedToolSlot('http://127.0.0.1:5173/#/tool/design?format=pptx&slot=a'), { toolId: 'design', slot: 'a' });
  assert.deepEqual(openedToolSlot('http://127.0.0.1:5173/t/qr?slot=qr%3A1&x=1'), { toolId: 'qr', slot: 'qr:1' });
  assert.deepEqual(openedToolSlot('http://127.0.0.1:5173/design?_ui=x&slot=design%3A9'), { toolId: 'design', slot: 'design:9' });
  for (const href of [
    'http://127.0.0.1:5173/#/tool/design', 'http://127.0.0.1:5173/#/open', 'http://127.0.0.1:5173/#/p',
    'http://127.0.0.1:5173/other?slot=1', 'not a url',
  ]) assert.equal(openedToolSlot(href), null, href);
});

test('the fetched file name is one safe path segment ending in .lolly', () => {
  assert.equal(openRouteFileName('/tmp/My deck.lolly'), 'My-deck.lolly');
  assert.equal(openRouteFileName('C:\\decks\\a.lolly'), 'a.lolly');
  assert.equal(openRouteFileName('deck'), 'deck.lolly');
  assert.equal(openRouteFileName('../..'), 'shared.lolly');
  assert.equal(openRouteFileName(''), 'shared.lolly');
  assert.match(openRouteFileName('x'.repeat(500)), /^x{120}\.lolly$/);
});

test('a saved Design session takes the session path; its flags are settled before a browser starts', async () => {
  const contents = readLollyFile(await sessionFile(), { allowTool: true });
  assert.equal(isDesignSessionFile(contents), true);
  assert.equal(isDesignSessionFile({ ...contents, manifest: { ...contents.manifest, tool: { id: 'qr' } } }), false);
  assert.equal(isDesignSessionFile({ ...contents, manifest: { ...contents.manifest, kind: 'tool' } }), false);

  assert.deepEqual(designSessionRunPlan({ export: 'pptx', output: 'x.pptx' }), { format: 'pptx', output: 'x.pptx' });
  assert.deepEqual(designSessionRunPlan({ export: 'PDF', s: 's02' }), { format: 'pdf', frame: 's02' });
  assert.deepEqual(designSessionRunPlan({}), { format: 'png' });
  assert.throws(() => designSessionRunPlan({ export: 'mp4' }), /not a format/);
  assert.throws(() => designSessionRunPlan({ export: 'pptx', 'trust-tool': '1' }), /carries no code to trust/);
  assert.throws(() => designSessionRunPlan({ export: 'pptx', width: '800' }), /--width is not an option/);
  assert.throws(() => designSessionRunPlan({ s: '../x' }), /not a frame id/);

  // The provenance words every other render takes; an opt-out travels to the export URL.
  assert.deepEqual(designSessionRunPlan({ export: 'png', 'no-provenance': '1' }), { format: 'png', provenance: { c2pa: false, imprint: false } });
  assert.deepEqual(designSessionRunPlan({ c2pa: 'off', imprint: '1' }), { format: 'png', provenance: { c2pa: false, imprint: true } });
  assert.throws(() => designSessionRunPlan({ 'no-provenance': '1', imprint: '1' }), /--no-provenance turns every provenance mark off/);
  // --force is the flag compose and package take to replace an output; run always
  // replaces its output, so it is accepted and changes nothing.
  assert.deepEqual(designSessionRunPlan({ export: 'pptx', output: 'x.pptx', force: '1' }), { format: 'pptx', output: 'x.pptx' });
});

test('an --output in a folder that does not exist is refused before a browser starts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-session-out-'));
  try {
    const missing = join(dir, 'nope', 'deck.pptx');
    await assert.rejects(sessionOutputFolderCheck(designSessionRunPlan({ export: 'pptx', output: missing })), (error: Error & { exit?: number }) => {
      assert.match(error.message, /The folder for .*deck\.pptx does not exist; make it first\. Nothing was written\./);
      assert.equal(error.exit, 2);
      return true;
    });
    // --themes writes beside --output, so the same folder is checked.
    await assert.rejects(sessionOutputFolderCheck(designSessionRunPlan({ export: 'pptx', output: missing, themes: 'all' })), /does not exist/);
    // An --output that is itself a folder is refused too.
    await assert.rejects(sessionOutputFolderCheck({ output: dir }), /is a folder; --output takes a file/);
    await sessionOutputFolderCheck({ output: join(dir, 'deck.pptx') });
    await sessionOutputFolderCheck({});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Three frames out of array order, one hidden, and a member layer. */
const DECK = [
  { id: 'late', kind: 'frame', x: 4000, y: 0, w: 1920, h: 1080, order: 2 },
  { id: 'first', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, order: 0 },
  { id: 'gone', kind: 'frame', x: 6000, y: 0, w: 1920, h: 1080, order: 1, hidden: true },
  { id: 'mid', kind: 'frame', x: 2000, y: 0, w: 1920, h: 1080, order: '1' },
  { id: 'note', kind: 'text', frame: 'first', x: 10, y: 10, w: 100, h: 40, text: 'Hi' },
];

test('--s is resolved against the frames the session renders, in page order, before a browser starts', () => {
  assert.deepEqual(sessionFramePages({ boxes: DECK }), ['first', 'mid', 'late']);
  assert.deepEqual(sessionFramePages({ boxes: JSON.stringify(DECK) }), ['first', 'mid', 'late']);
  assert.deepEqual(sessionFramePages({}), []);

  const pages = sessionFramePages({ boxes: DECK });
  assert.deepEqual(sessionFrameChoice(pages, 'mid', 'png', 'deck.lolly'), { frame: 'mid' });
  assert.deepEqual(sessionFrameChoice(pages, '3', 'png', 'deck.lolly'), { frame: '3' });
  // A well-formed id or position that points at no rendered frame is refused, with the list.
  for (const bad of ['nope', 'gone', '4', '0']) {
    assert.throws(() => sessionFrameChoice(pages, bad, 'png', 'deck.lolly'), (error: Error & { exitCode?: number; kind?: string }) => {
      assert.match(error.message, new RegExp(`--s=${bad} names no frame in deck\\.lolly \\(it renders 3 frames: first, mid, late;`));
      assert.match(error.message, /Nothing was written\./);
      return true;
    });
  }
  assert.throws(() => sessionFrameChoice([], 'one', 'pptx', 'empty.lolly'), /it has no frames/);
  // A one-image format from several frames takes the first by position, and says so.
  const single = sessionFrameChoice(pages, undefined, 'png', 'deck.lolly');
  assert.equal(single.frame, '1');
  assert.match(single.note ?? '', /deck\.lolly has 3 frames and a png holds one, so this export is the first frame, first\. Pass --s=/);
  assert.deepEqual(sessionFrameChoice(pages, undefined, 'pptx', 'deck.lolly'), {});
  assert.deepEqual(sessionFrameChoice(['only'], undefined, 'png', 'deck.lolly'), {});
});

/** The same file with its manifest edited. */
function withManifest(bytes: Uint8Array, edit: (manifest: Record<string, unknown>) => void): Uint8Array {
  const parts = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(parts['manifest.json']!)) as Record<string, unknown>;
  edit(manifest);
  parts['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(parts);
}

test('the #/open helper refuses a file that would wait for a person, before any browser starts', async () => {
  const plain = await sessionFile();
  assert.equal(openRouteRefusal(plain), null);
  assert.match(openRouteRefusal(withManifest(plain, (m) => { m.designSystem = { label: 'House' }; })) ?? '', /carries a design system/);
  assert.match(openRouteRefusal(withManifest(plain, (m) => { m.templates = { count: 2 }; })) ?? '', /carries templates/);
  assert.match(openRouteRefusal(withManifest(plain, (m) => { m.bundledTool = { id: 'design', files: [] }; })) ?? '', /carries a tool/);
  assert.match(openRouteRefusal(withManifest(plain, (m) => { m.kind = 'project'; })) ?? '', /project folder/);
  assert.match(openRouteRefusal(withManifest(plain, (m) => { m.format = 'lolly-backup'; })) ?? '', /is not a saved session/);
  // Refused at once: no browser, no web shell (the base points at a closed port).
  const started = Date.now();
  await assert.rejects(
    openLollyViaWebShell(withManifest(plain, (m) => { m.format = 'lolly-backup'; }), { name: 'copy.lolly', base: 'http://127.0.0.1:9', timeoutMs: 5_000 }),
    /copy\.lolly is not a saved session the app opens from a link: .*Open it in the app instead\./,
  );
  assert.ok(Date.now() - started < 5_000);
});

test('lolly run refuses a bad session flag with exit 2 before any page opens', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-session-run-'));
  try {
    const file = join(dir, 'session.lolly');
    writeFileSync(file, await sessionFile());
    const env = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1', LOLLY_WEB_BASE: 'http://127.0.0.1:9' };
    for (const [args, pattern] of [
      [['--export=mp4'], /not a format/],
      [['--export=pptx', '--trust-tool'], /carries no code to trust/],
      [['--export=pptx', '--width=10'], /--width is not an option/],
      [['--export=png', '--s=nosuch'], /--s=nosuch names no frame in session\.lolly \(it renders 1 frame: one;/],
      [['--export=png', '--s=2'], /--s=2 names no frame/],
      [['--export=png', '--no-provenance', '--c2pa=on'], /--no-provenance turns every provenance mark off/],
      // A missing output folder is found before the browser, not after its export;
      // the run also passes --force, which is accepted.
      [['--export=pptx', `--output=${join(dir, 'nope', 'deck.pptx')}`, '--force'], /The folder for .*deck\.pptx does not exist; make it first/],
      [['--export=pptx', '--themes=light,dark', `--output=${join(dir, 'nope', 'deck.pptx')}`], /does not exist; make it first/],
    ] as const) {
      const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'run', file, ...args], { cwd: root, env, encoding: 'utf8', timeout: 60_000 });
      assert.equal(run.status, 2, `${args.join(' ')}: ${run.stderr}`);
      assert.match(run.stderr, pattern);
      assert.equal(run.stdout, '');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
