// SPDX-License-Identifier: MPL-2.0
/**
 * Sequence Studio — motion-export duration contract, plus the sequence/live export
 * dispatch precedence.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * Two shipped behaviours are guarded here:
 *
 *  1. DURATION (community/sequence-studio/hooks.js beforeExport). The derived
 *     sequence length is the DEFAULT and tracks the timeline automatically, but a
 *     direct edit of the export bar's duration field wins. The shell flags that edit
 *     with `opts.durationUserSet === true`, and only then. The gif/apng buffered-frame
 *     clamp applies to whichever length was chosen. Stills are never touched.
 *     Driven through the REAL tool + the REAL engine runtime with a stub host, so the
 *     hook runs exactly the way a shell runs it.
 *
 *  2. DISPATCH (shells/web/src/bridge/export.ts). A [data-sequence] stage routes to
 *     the compositor for webm/mp4 even when "Record live" is ticked — live capture
 *     can only film a DOM that nothing is animating, so it would return one frozen
 *     frame. Non-sequence stages keep `opts.live` winning. Asserted at SOURCE level:
 *     the real dispatch needs a browser (MediaRecorder/WebCodecs/canvas), so an
 *     end-to-end export is out of reach for node:test — see the note on that test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = join(ROOT, 'community');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

assert.ok(existsSync(join(TOOLS_DIR, 'sequence-studio', 'tool.json')),
  'community/sequence-studio/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('sequence-studio', fetchFile);

interface Run {
  /** The opts object the hook mutated, as the bridge received it. */
  opts: Record<string, any>;
  /** Warnings the hook logged. */
  warns: string[];
  /** The derived sequence length in seconds, read off the artboard the engine stamped. */
  derivedS: number;
}

/**
 * Mount a composition (the manifest DEFAULT when `boxes` is omitted), render its HTML
 * into a real DOM, and run one export through the engine — capturing what the host
 * bridge was handed. The DOM matters: the engine gives beforeExport { node, format,
 * opts, host } and NOT the input model, so the hook reads the derived length off the
 * artboard's data-seq-ms. The engine calls the hook with the same opts object it then
 * spreads into host.export.render, so the captured copy is what the exporter acts on.
 */
async function runExport(
  format: string,
  opts: Record<string, unknown> = {},
  boxes?: unknown[],
): Promise<Run> {
  const warns: string[] = [];
  let seen: Record<string, any> = {};
  const host = baseHost({
    log: (level: string, msg: string) => { if (level === 'warn') warns.push(msg); },
    export: {
      render: async (_node: unknown, _fmt: string, o: Record<string, unknown>) => {
        seen = { ...o };
        return { size: 0, type: 'application/octet-stream' };
      },
    },
  });
  const state = boxes === undefined ? {} : { boxes };
  const rt = await createRuntime(tool, host, state as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');

  const html = rt.getHydrated() as string;
  const dom = new JSDOM(`<!doctype html><body><div id="stage">${html}</div></body>`);
  const node = dom.window.document.getElementById('stage');
  const seqEl = node!.querySelector('[data-seq-ms]');
  const derivedS = seqEl ? Number(seqEl.getAttribute('data-seq-ms')) / 1000 : 0;

  await rt.export(node as never, format as never, { ...opts } as never);
  return { opts: seen, warns, derivedS };
}

// ── 1. duration: derived by default, user edit wins ────────────────────────────

test('motion export defaults to the derived sequence length', async () => {
  for (const format of ['mp4', 'webm']) {
    const r = await runExport(format);
    assert.ok(r.derivedS > 0, 'the default composition has a derived length');
    assert.equal(r.opts.duration, r.derivedS,
      `${format}: with no user edit the clip is exactly the derived sequence length`);
    assert.equal(r.opts.wait, 0, `${format}: a sequence never waits — frame 0 is t=0`);
  }
});

test('a duration in opts is still overridden unless the shell flags it as user-set', async () => {
  // The export bar always carries SOME duration; only durationUserSet distinguishes
  // "the field's default value rode along" from "the user typed this".
  const r = await runExport('mp4', { duration: 99 });
  assert.equal(r.opts.duration, r.derivedS,
    'an unflagged duration is the field default, so the derived length still wins');
});

test('an explicitly user-set duration is honoured verbatim', async () => {
  for (const format of ['mp4', 'webm']) {
    const r = await runExport(format, { duration: 2.5, durationUserSet: true });
    assert.notEqual(r.derivedS, 2.5, 'test is meaningful: the user value differs from the derived one');
    assert.equal(r.opts.duration, 2.5, `${format}: the user's own number is used unchanged`);
    assert.equal(r.opts.wait, 0, `${format}: wait stays 0`);
  }
});

test('a user-set duration that is missing or nonsense falls back to the derived length', async () => {
  for (const bad of [0, -3, Number.NaN, undefined]) {
    const r = await runExport('mp4', { duration: bad, durationUserSet: true });
    assert.equal(r.opts.duration, r.derivedS, `duration ${String(bad)} is not a clip length`);
  }
});

// ── 2. the gif/apng frame clamp survives both branches ─────────────────────────

// gif runs at the encoder's fixed 15fps and every frame is buffered, so the hook
// clamps the clip to floor(595 / 15) = 39s. Long compositions and long user-typed
// durations must BOTH hit it.
const GIF_CAP_S = Math.floor(595 / 15);

/** A magnetic seq row `n` seconds long — the derived length becomes `n`. */
const longRow = (seconds: number) => [
  { id: 'a', kind: 'text', text: 'a', lane: 'seq', start: 0, dur: seconds },
];

const runExportWithBoxes = (format: string, boxes: unknown[], opts: Record<string, unknown> = {}): Promise<Run> =>
  runExport(format, opts, boxes);

test('gif clamps a long DERIVED sequence to the buffered-frame ceiling, with a warning', async () => {
  const r = await runExportWithBoxes('gif', longRow(120));
  assert.equal(r.derivedS, 120, 'the composition really is 120s long');
  assert.equal(r.opts.duration, GIF_CAP_S, 'the derived length is clamped for gif');
  assert.equal(r.warns.length, 1, 'the trade is named exactly once');
  assert.match(r.warns[0]!, /gif/, 'the warning names the format');
  assert.match(r.warns[0]!, /mp4\/webm/, 'the warning names the way out');
  // The message must not contradict the bridge: it quotes frames-at-fps and says the
  // ceiling is device-dependent rather than asserting a single hard number.
  assert.match(r.warns[0]!, new RegExp(`${GIF_CAP_S * 15} frames at 15fps`));
  assert.match(r.warns[0]!, /full-memory device/);
});

test('gif clamps a USER-SET duration too, and leaves a short one alone', async () => {
  const over = await runExportWithBoxes('gif', longRow(4), { duration: 300, durationUserSet: true });
  assert.equal(over.opts.duration, GIF_CAP_S, 'a user cannot type past the frame ceiling for gif');
  assert.equal(over.warns.length, 1, 'and is told why');

  const under = await runExportWithBoxes('gif', longRow(120), { duration: 3, durationUserSet: true });
  assert.equal(under.opts.duration, 3, 'a user-set clip under the cap is untouched…');
  assert.deepEqual(under.warns, [], '…and warns about nothing');
});

test('mp4/webm are never frame-clamped — the ceiling is a gif/apng buffering limit', async () => {
  for (const format of ['mp4', 'webm']) {
    const r = await runExportWithBoxes(format, longRow(120));
    assert.equal(r.opts.duration, 120, `${format}: the full derived length is exported`);
    assert.deepEqual(r.warns, [], `${format}: nothing to warn about`);
  }
});

// ── 3. stills stay a poster of the playhead ────────────────────────────────────

test('a still export is left completely alone by beforeExport', async () => {
  const r = await runExport('png', { duration: 7, durationUserSet: true });
  assert.equal(r.opts.duration, 7, 'png: no duration rewriting');
  assert.equal(r.opts.wait, undefined, 'png: no wait override — a still is not a recording');
});

// ── 4. dispatch: the sequence compositor beats live capture ────────────────────

/**
 * Source-level, deliberately. renderSequenceStage / renderLive need a real browser
 * (MediaRecorder, WebCodecs, canvas, layout) — there is no headless way to prove which
 * one produced a Blob, so what is asserted is the routing decision itself: for webm and
 * mp4 the [data-sequence] check must be unconditional, and every other sniff must keep
 * `opts.live` in front of it.
 */
test('export.ts routes a sequence stage to the compositor even when opts.live is set', async () => {
  const src = await readFile(join(ROOT, 'shells', 'web', 'src', 'bridge', 'export.ts'), 'utf8');

  for (const fmt of ['webm', 'mp4', 'gif', 'apng']) {
    assert.ok(src.includes(`if (isSequenceStage(node)) return await renderSequenceStage(node, '${fmt}', opts);`),
      `${fmt}: a [data-sequence] stage routes to the compositor unconditionally`);
  }
  assert.ok(!/!opts\.live && isSequenceStage/.test(src),
    'no motion format may gate the sequence compositor behind !opts.live — live capture of a ' +
    'sequence films a DOM nothing is animating, so it can only ever return a frozen frame');

  // Precedence for every NON-sequence stage is unchanged: live first, then the
  // record/top-tail sniffs, then the generic renderer.
  for (const fmt of ['webm', 'mp4']) {
    assert.ok(src.includes(
      `return await (opts.live ? renderLive(node, opts, '${fmt}')\n` +
      `        : isRecordStage(node) ? renderRecord(node, opts, '${fmt}')\n` +
      `        : isTopTailStage(node) ? renderTopTail(node, opts, '${fmt}') : renderVideo(node, opts, '${fmt}'));`),
      `${fmt}: record / top-tail / url-shot / filter tools keep today's live-first precedence`);
  }
});
