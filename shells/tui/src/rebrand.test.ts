// SPDX-License-Identifier: MPL-2.0
// The terminal Rebrand checklist over the simple fixture deck: the checklist shows
// the engine's review queue, a key applies a decision, undo restores the rows, and a
// compile writes the Design document, report, plan and .pptx to a folder. Counts are
// read from the pipeline in the test, never pinned, because the compile is still
// being tuned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { render } from 'ink-testing-library';
import { build } from 'esbuild';
import { effectiveAction, openPendingCounts, openPendingIds, pendingSuggestionIds, reviewQueue, type QueueItemV1 } from '@lolly/engine';
import { planProblems } from '@lolly-tools/node-shell/rebrand';
import { readLollyFile } from '@lolly-tools/node-shell/lolly-file';
import {
  autoMatch,
  autoMatchOffer,
  acceptAll,
  checklistOf,
  compileTo,
  decideItem,
  openRebrand,
  queueIndexAfter,
  replacementFor,
  toggleSlide,
  undoLast,
  waitingIds,
  writeGroup,
  type RebrandSession,
} from './rebrand-session.ts';
import type { ToolEntry } from './catalog.ts';

const FIXTURE = new URL('../../../tests/fixtures/rebrand/simple.pptx', import.meta.url).pathname;

function rowsOf(session: RebrandSession): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const slide of session.plan.slides) for (const row of slide.objects) out.set(row.id, row);
  return out;
}

function effective(session: RebrandSession, id: string): string | undefined {
  for (const slide of session.plan.slides) {
    const row = slide.objects.find((one) => one.id === id);
    if (row) return effectiveAction(row);
  }
  return undefined;
}

test('the checklist is the engine queue, a decision applies to the named scope, and undo restores the rows', async () => {
  const opened = await openRebrand(FIXTURE);
  const list = checklistOf(opened);
  const queue = reviewQueue(opened.plan, opened.census, opened.source);
  assert.deepEqual(list.queue.map((item) => item.id), queue.map((item) => item.id));
  assert.equal(list.slides.length, opened.source.slides.length);
  assert.ok(list.queue.length > 0, 'the fixture deck gives a queue to review');

  // A group item that is not already a removal: Remove applies to every member.
  const group = list.queue.find((item) => item.objectIds.length > 1 && item.action !== 'remove' && item.lockedIds.length === 0 && item.correctedIds.length === 0)
    ?? list.queue.find((item) => item.objectIds.length > 1);
  assert.ok(group, 'the fixture deck has a group item');
  const removed = decideItem(opened, group, 'remove', 'group');
  assert.match(removed.message, /^Removed \d+ object/);
  for (const id of group.objectIds) if (!group.lockedIds.includes(id)) assert.equal(effective(removed.session, id), 'remove');
  assert.equal(removed.session.undo.length, 1);
  assert.equal(removed.session.plan.revision, opened.plan.revision + 1);

  // "This object only" touches the exemplar and nothing else.
  const one = decideItem(opened, group, 'remove', 'one');
  assert.equal(effective(one.session, group.exemplar), 'remove');
  const others = group.objectIds.filter((id) => id !== group.exemplar);
  for (const id of others) assert.equal(effective(one.session, id), effective(opened, id));

  const undone = undoLast(removed.session);
  assert.match(undone.message, /^Undid: Removed/);
  assert.deepEqual([...rowsOf(undone.session)], [...rowsOf(opened)]);
  assert.deepEqual(undone.session.plan.decisions, opened.plan.decisions);
  assert.equal(undone.session.undo.length, 0);
  assert.equal(undoLast(undone.session).message, 'Nothing to undo.');

  // A slide leaves the deck and comes back through undo.
  const firstSlide = opened.plan.slides[0]!;
  const out = toggleSlide(opened, firstSlide.id);
  assert.equal(out.session.plan.slides[0]!.include, !firstSlide.include);
  assert.equal(undoLast(out.session).session.plan.slides[0]!.include, firstSlide.include);

  // Accept all answers every waiting row, the ones that need attention included,
  // and leaves none pending.
  const waiting = waitingIds(opened.plan);
  const before = rowsOf(opened) as Map<string, { review: string; decision?: unknown }>;
  assert.ok(waiting.some((id) => before.get(id)?.review === 'needs-attention'), 'the fixture deck has rows that need attention');
  assert.equal(checklistOf(opened).pending, waiting.length);
  const accepted = acceptAll(opened);
  const after = rowsOf(accepted.session) as Map<string, { decision?: unknown }>;
  for (const id of waiting) assert.notEqual(after.get(id)?.decision, undefined, `${id} is answered`);
  assert.equal(checklistOf(accepted.session).pending, 0);
  assert.equal(acceptAll(accepted.session).message, 'No suggestions are waiting.');
});

test('accept all and the waiting count leave out the slides that are left out', async () => {
  const opened = await openRebrand(FIXTURE);
  const first = opened.plan.slides[0]!;
  const out = toggleSlide(opened, first.id).session;
  const onFirst = new Set(first.objects.map((row) => row.id));
  assert.ok(!waitingIds(out.plan).some((id) => onFirst.has(id)), 'no row on a slide left out waits');
  assert.equal(checklistOf(out).pending, waitingIds(opened.plan).filter((id) => !onFirst.has(id)).length);
  const accepted = acceptAll(out);
  assert.deepEqual(accepted.session.plan.slides[0]!.objects, out.plan.slides[0]!.objects);
  assert.deepEqual(waitingIds(out.plan), openPendingIds(out.plan), 'the terminal reads the engine rule, not a copy of it');
  assert.equal(accepted.message, `Accepted ${openPendingIds(out.plan).length} suggestions.`, 'accept all answers exactly the rows the rule names');
});

test('a group apply includes the object on screen even when it was changed by hand', async () => {
  const opened = await openRebrand(FIXTURE);
  const group = checklistOf(opened).queue.find((item) => item.objectIds.length > 1 && item.lockedIds.length === 0);
  assert.ok(group, 'the fixture deck has a group item');
  const first: 'keep' | 'remove' = effective(opened, group.exemplar) === 'keep' ? 'remove' : 'keep';
  const second: 'keep' | 'remove' = first === 'keep' ? 'remove' : 'keep';
  const byHand = decideItem(opened, group, first, 'one').session;
  const regrouped = checklistOf(byHand).queue.find((item) => item.objectIds.includes(group.exemplar) && item.objectIds.length > 1) ?? group;
  const applied = decideItem(byHand, { ...regrouped, exemplar: group.exemplar }, second, 'group');
  assert.equal(effective(applied.session, group.exemplar), second);
});

test('replace is refused for an item that names nothing to put in', async () => {
  const opened = await openRebrand(FIXTURE);
  const bare = checklistOf(opened).queue.find((item) => !replacementFor(item, opened.plan));
  assert.ok(bare, 'the fixture deck has an item with no replacement');
  const refused = decideItem(opened, bare, 'replace', 'one');
  assert.equal(refused.session, opened);
  assert.match(refused.message, /needs a choice of what goes in/);
});

test('the queue selection follows the item, and moves on once it settles', () => {
  const item = (id: string, section: QueueItemV1['section']): QueueItemV1 => ({ id, section }) as QueueItemV1;
  const queue = [item('a', 'attention'), item('b', 'settled'), item('c', 'suggestions'), item('d', 'attention')];
  assert.equal(queueIndexAfter(queue, 'c', 0, false), 2);
  assert.equal(queueIndexAfter(queue, 'b', 0, false), 1);
  assert.equal(queueIndexAfter(queue, 'b', 0, true), 3);
  assert.equal(queueIndexAfter(queue, 'gone', 9, true), 3);
  assert.equal(queueIndexAfter([], 'a', 2, true), 0);
});

test('compile writes the Design document, report, plan and pptx to a folder and never replaces a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-rebrand-'));
  try {
    const opened = await openRebrand(FIXTURE);
    const session = acceptAll(opened).session;
    const result = await compileTo(session, dir, { pptx: true });
    const names = (await readdir(dir)).sort();
    assert.deepEqual(names, ['simple.lolly', 'simple.plan.json', 'simple.rebranded.pptx', 'simple.report.json']);
    assert.deepEqual(result.files.map((file) => file.slice(dir.length + 1)).sort(), names);
    assert.ok(result.outcome === 'ready' || result.outcome === 'needs-review');

    readLollyFile(new Uint8Array(await readFile(join(dir, 'simple.lolly'))));
    const plan = JSON.parse(await readFile(join(dir, 'simple.plan.json'), 'utf8'));
    assert.deepEqual(await planProblems(plan), []);
    assert.equal(plan.revision, session.plan.revision);
    const report = JSON.parse(await readFile(join(dir, 'simple.report.json'), 'utf8'));
    assert.ok(report && typeof report === 'object' && 'counts' in report);
    const pptx = new Uint8Array(await readFile(join(dir, 'simple.rebranded.pptx')));
    assert.deepEqual([...pptx.slice(0, 2)], [0x50, 0x4b]);

    // A second compile into the same folder refuses and leaves the first files alone.
    const before = await readFile(join(dir, 'simple.lolly'));
    await assert.rejects(compileTo(session, dir, { pptx: false }), /already exists/);
    assert.deepEqual(await readFile(join(dir, 'simple.lolly')), before);
    assert.deepEqual((await readdir(dir)).sort(), names);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the compile outcome counts the rows the engine rule names, not a left-out slide or a locked row', async () => {
  // The pipeline's own counts read every unreviewed row, left-out slides included,
  // and every row flagged for attention, locked or not; the web view, the CLI and
  // the MCP tool read openPendingCounts, and so does this one.
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-rebrand-'));
  try {
    const opened = await openRebrand(FIXTURE);
    const first = opened.plan.slides[0]!;
    const out = toggleSlide(opened, first.id).session;
    const flagged = out.plan.slides.slice(1).flatMap((slide) => slide.objects).find((row) => row.review === 'needs-attention');
    assert.ok(flagged, 'the fixture deck flags a row on an included slide');
    const locked = {
      ...out,
      plan: {
        ...out.plan,
        slides: out.plan.slides.map((slide) => ({
          ...slide,
          objects: slide.objects.map((row) => (row.id === flagged.id ? { ...row, locked: true } : row)),
        })),
      },
    };
    const session = acceptAll(locked).session;
    assert.deepEqual(openPendingIds(session.plan), []);
    assert.ok(pendingSuggestionIds(session.plan).length > 0, 'the left-out slide still holds unreviewed rows, which a count by the other rule would read');
    const result = await compileTo(session, dir, { pptx: false });
    assert.deepEqual({ pending: result.counts.pending, attention: result.counts.attention }, openPendingCounts(session.plan));
    assert.equal(result.counts.pending, 0);
    assert.equal(result.counts.attention, 0);
    const rest = result.counts.unresolvedObjects + result.counts.unresolvedColours + result.counts.tray;
    assert.equal(result.outcome, rest === 0 ? 'ready' : 'needs-review');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a refusal on the last file of the group takes back the files already placed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-rebrand-rollback-'));
  try {
    const session = acceptAll(await openRebrand(FIXTURE)).session;
    await writeFile(join(dir, 'simple.rebranded.pptx'), 'already here');
    await assert.rejects(compileTo(session, dir, { pptx: true }), /simple\.rebranded\.pptx already exists/);
    assert.deepEqual(await readdir(dir), ['simple.rebranded.pptx'], 'the .lolly, report, plan and temp files are gone');
    assert.equal(await readFile(join(dir, 'simple.rebranded.pptx'), 'utf8'), 'already here');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a compile needs a folder that exists, or a confirmed new one, and some slide included', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-rebrand-folder-'));
  try {
    const opened = await openRebrand(FIXTURE);
    const session = acceptAll(opened).session;
    const typo = join(dir, 'typo', 'deep');
    await assert.rejects(compileTo(session, typo, { pptx: false }), /does not exist/);
    assert.deepEqual(await readdir(dir), [], 'nothing was made');

    // A confirmed new folder is made; a refused compile into one takes it back.
    let none = session;
    for (const slide of session.plan.slides) none = toggleSlide(none, slide.id).session;
    await assert.rejects(compileTo(none, typo, { pptx: false, createFolder: true }), /Every slide is left out/);
    assert.deepEqual(await readdir(dir), []);
    await mkdir(join(dir, 'held'));
    await writeFile(join(dir, 'held', 'simple.plan.json'), '{}');
    // A stem that climbs two folders puts the outputs beside the file already held, so
    // the refusal comes after the two new folders were made; both go again.
    await assert.rejects(compileTo({ ...session, stem: '../../simple' }, join(dir, 'held', 'new', 'deeper'), { pptx: false, createFolder: true }), /simple\.plan\.json already exists/);
    assert.deepEqual(await readdir(join(dir, 'held')), ['simple.plan.json']);
    const made = await compileTo(session, typo, { pptx: false, createFolder: true });
    assert.ok((await stat(typo)).isDirectory());
    assert.equal(made.files.length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the writer refuses to replace the source deck', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-rebrand-source-'));
  try {
    const source = join(dir, 'deck.pptx');
    await writeFile(source, 'the source');
    await assert.rejects(writeGroup([{ path: source, data: 'new' }], source), /would replace the source deck/);
    assert.equal(await readFile(source, 'utf8'), 'the source');
    await assert.rejects(openRebrand(join(dir, 'deck.key')), /is not a \.pptx or \.pdf file/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a PDF deck opens into the same checklist, and a scanned page stays a picture', async () => {
  const editable = await openRebrand(new URL('../../../tests/fixtures/rebrand-pdf/editable.pdf', import.meta.url).pathname);
  assert.equal(editable.source.source.kind, 'pdf');
  assert.equal(editable.stem, 'editable');
  const list = checklistOf(editable);
  assert.equal(list.slides.length, editable.source.slides.length);
  assert.ok(list.slides.length > 0, 'the fixture PDF has pages to review');
  assert.deepEqual(list.queue.map((item) => item.id), reviewQueue(editable.plan, editable.census, editable.source).map((item) => item.id));

  const scanned = await openRebrand(new URL('../../../tests/fixtures/rebrand/flattened.pdf', import.meta.url).pathname);
  const pictures = scanned.source.slides.filter((slide) => slide.origin.flattened === true);
  assert.ok(pictures.length > 0, 'the fixture has a scanned page');
  for (const slide of pictures) {
    assert.equal(slide.recovery, undefined, 'no text is read here, so the page is not rebuilt');
    assert.ok(slide.objects.some((one) => one.kind === 'pic'), `${slide.id} keeps its picture`);
  }
  assert.equal(checklistOf(scanned).summary.flattened, pictures.length, 'the counts line says how many pages are pictures');
});

/**
 * Load a view without writing a file into the source tree: esbuild bundles the
 * .tsx files (Node cannot strip JSX), every other import becomes an absolute URL
 * (a package resolved from this test, a .ts file by its path), and the result is
 * imported from a data: URL.
 */
async function loadView<T>(file: string, name: string): Promise<T> {
  const out = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    logLevel: 'silent',
    plugins: [{
      name: 'bundle-tsx-only',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === 'entry-point') return undefined;
          if (args.path.startsWith('node:')) return { path: args.path, external: true };
          if (args.path.startsWith('.')) {
            const abs = resolve(args.resolveDir, args.path);
            return abs.endsWith('.tsx') ? { path: abs } : { path: pathToFileURL(abs).href, external: true };
          }
          return { path: import.meta.resolve(args.path), external: true };
        });
      },
    }],
  });
  const code = out.outputFiles[0]!.text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as Record<string, unknown>;
  return mod[name] as T;
}

const component = (): Promise<ComponentType<{ onBack: () => void }>> => loadView('./views/Rebrand.tsx', 'Rebrand');

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 25));
// A deadline, not a tick count: a cold runner's first render (esbuild, ink, jsdom,
// the first pass) can take seconds. A healthy run returns well inside it.
const WAIT_BUDGET_MS = 20_000;
async function until(check: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + WAIT_BUDGET_MS;
  while (Date.now() < deadline) {
    if (check()) return;
    await tick();
  }
  assert.fail(`${what} did not appear within ${WAIT_BUDGET_MS} ms.`);
}

test('the terminal checklist works by keyboard at 80 columns: decide, undo, compile', async () => {
  const Rebrand = await component();
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-rebrand-keys-'));
  const target = join(dir, 'out');
  const expected = checklistOf(await openRebrand(FIXTURE));
  let backs = 0;
  const ui = render(createElement(Rebrand, { onBack: () => { backs += 1; } }));
  Object.defineProperty(ui.stdout, 'columns', { value: 80, configurable: true });
  Object.defineProperty(ui.stdout, 'rows', { value: 30, configurable: true });
  ui.stdout.emit('resize');
  const frame = (): string => ui.lastFrame() ?? '';
  const fits = (where: string): void => {
    for (const line of frame().split('\n')) assert.ok(line.length <= 80, `${where}: a line is wider than 80 columns: ${line}`);
  };
  try {
    await tick();
    ui.stdin.write(FIXTURE);
    await tick();
    ui.stdin.write('\r');
    await until(() => frame().includes('[Queue'), 'The review queue');
    fits('the queue');
    // The scope starts on the object on screen, as the web view does.
    if (expected.queue[0]!.objectIds.length > 1) assert.ok(frame().includes('Apply to: this object only.'));
    // The first queue row is on screen, in words: its section, action and title.
    const first = expected.queue[0]!;
    assert.ok(frame().includes(`> ${first.section === 'attention' ? 'needs attention' : first.section === 'suggestions' ? 'suggestion' : 'settled'} · ${first.action}`));
    assert.ok(frame().includes(first.title.text.slice(0, 20)));
    assert.ok(frame().includes(`${expected.summary.slides.included} of ${expected.summary.slides.total} slides included`));

    ui.stdin.write('x');
    await until(() => /Removed \d+ object/.test(frame()), 'The removal status');
    // Esc with an edit not written asks first, and another key stays.
    ui.stdin.write('\u001b');
    await until(() => frame().includes('Leave the review?'), 'The leave question');
    assert.equal(backs, 0);
    ui.stdin.write('u');
    await until(() => frame().includes('Undid: Removed'), 'The undo status');

    // Slides: space leaves the first one out, in words; undo brings it back.
    ui.stdin.write('\t');
    await until(() => frame().includes('[Slides'), 'The slides list');
    fits('the slides');
    assert.match(frame(), /> +1 +included/);
    ui.stdin.write(' ');
    await until(() => frame().includes('Left out slide 1.'), 'The slide status');
    assert.match(frame(), /> +1 +left out/);
    ui.stdin.write('u');
    await until(() => frame().includes('Undid: Left out slide 1.'), 'The slide undo');

    // Colours and fonts are read-only rows that say where each one goes.
    ui.stdin.write('\t');
    await until(() => frame().includes('[Colours'), 'The colours list');
    fits('the colours');
    if (expected.colours.length > 0) assert.match(frame(), /> #[0-9A-F]{6} \S+ -> /);
    ui.stdin.write('\t');
    await until(() => frame().includes('[Fonts'), 'The fonts list');
    fits('the fonts');
    ui.stdin.write('\t');
    await until(() => frame().includes('[Queue'), 'The queue again');

    // Compile: c once asks when rows still wait, c again opens the folder prompt.
    ui.stdin.write('c');
    await tick();
    if (!frame().includes('Folder:')) {
      assert.ok(/wait[s]? for an answer/.test(frame()));
      ui.stdin.write('c');
      await until(() => frame().includes('Folder:'), 'The folder prompt');
    }
    // Clear the prefilled folder (the deck's own), one key per tick so each is read
    // as its own press, and check it is empty before typing the temp one: a
    // leftover prefix would send the files somewhere under the fixtures.
    for (let i = 0; i < dirname(FIXTURE).length; i++) {
      ui.stdin.write('\u007f');
      await tick();
    }
    await until(() => /^\s*Folder:\s*$/m.test(frame()), 'An empty folder field');
    fits('the folder prompt');
    // A folder that is not there yet is named and made only on a second Enter.
    ui.stdin.write(target);
    await tick();
    ui.stdin.write('\r');
    await until(() => frame().includes('does not exist yet'), 'The new folder question');
    assert.deepEqual(await readdir(dir), []);
    ui.stdin.write('\r');
    await until(() => frame().includes('Wrote '), 'The compile result');
    assert.match(frame(), /Outcome: (ready|needs review)\. Wrote \d+ files/);
    assert.ok(frame().includes('Files: simple.lolly'), frame());
    fits('the compile result');
    const names = (await readdir(target)).sort();
    assert.ok(names.includes('simple.lolly') && names.includes('simple.report.json') && names.includes('simple.plan.json'), frame());

    // Nothing is left unwritten after the compile, so Esc leaves at once.
    ui.stdin.write('\u001b');
    await until(() => backs === 1, 'Leaving the review');
  } finally {
    ui.unmount();
    ui.cleanup();
    await rm(dir, { recursive: true, force: true });
  }
});

test('the gallery header stays on one row at 100 and 120 columns with the rebrand entry', async () => {
  const Gallery = await loadView<ComponentType<Record<string, unknown>>>('./views/Gallery.tsx', 'Gallery');
  const tools: ToolEntry[] = Array.from({ length: 12 }, (_, i) => ({ id: `tool-${i}`, name: `Tool ${i}`, category: 'Design', formats: ['svg'] }));
  const noop = (): void => {};
  for (const columns of [100, 120]) {
    const ui = render(createElement(Gallery, { tools, onOpen: noop, onOpenUrl: () => null, onImportFile: async () => null, onNav: noop, onQuit: noop, onPrepare: noop, onRebrand: noop }));
    Object.defineProperty(ui.stdout, 'columns', { value: columns, configurable: true });
    Object.defineProperty(ui.stdout, 'rows', { value: 30, configurable: true });
    ui.stdout.emit('resize');
    try {
      await until(() => (ui.lastFrame() ?? '').includes('Press / to search'), `The gallery at ${columns} columns`);
      const lines = (ui.lastFrame() ?? '').split('\n');
      assert.ok(lines[0]!.includes('Tools') && lines[0]!.includes('12 tools'), `the header is one row at ${columns} columns: ${lines[0]}`);
      assert.ok(lines[1]!.includes('Press / to search'), `the search row follows the header at ${columns} columns: ${lines[1]}`);
    } finally {
      ui.unmount();
      ui.cleanup();
    }
  }
});

test('m runs Auto-match: the count is shown first, the matched slides take their layouts as one undoable step', async () => {
  const read = await openRebrand(new URL('../../../tests/fixtures/rebrand/structures.pptx', import.meta.url).pathname);
  // The first pass already set every clear read, so on a fresh plan there is nothing to change.
  assert.equal(autoMatchOffer(read).count, 0);
  assert.equal(autoMatchOffer(read).text, 'Every slide already uses its suggested layout.');
  // A plan whose layouts are all the plainest is one Auto-match has work on.
  const opened = { ...read, plan: { ...read.plan, slides: read.plan.slides.map((slide) => ({ ...slide, layout: 'content' })) } };
  const offer = autoMatchOffer(opened);
  assert.equal(offer.count, 8, 'the clear and the likely reads of the structures fixture');
  assert.equal(offer.likely, 1);
  assert.equal(offer.text, 'm matches 8 slides. 1 is a likely match.');
  assert.equal(checklistOf(opened).autoMatch.text, offer.text, 'the checklist carries the count to show before it runs');

  const done = autoMatch(opened);
  assert.equal(done.message, 'Matched 8 slides. 1 was a likely match.');
  assert.equal(done.session.plan.slides.filter((slide) => slide.layoutSource === 'auto').length, 8);
  assert.equal(autoMatchOffer(done.session).count, 0);
  assert.equal(autoMatch(done.session).message, 'Every slide already uses its suggested layout.');

  const undone = undoLast(done.session);
  assert.deepEqual(undone.session.plan.slides.map((slide) => [slide.layout, slide.layoutSource]), opened.plan.slides.map((slide) => [slide.layout, slide.layoutSource]));
});
