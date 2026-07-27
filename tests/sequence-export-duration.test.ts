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

import { applyDurationOverride, parseSequenceStage, frameTimestamps } from '../shells/web/src/bridge/sequence-plan.ts';
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

// ── 4. dispatch: compositor by default, live capture as a working opt-in ───────

/**
 * Source-level, deliberately. renderSequenceStage / renderLive / captureLiveClip all
 * need a real browser (getDisplayMedia, MediaRecorder, WebCodecs, canvas, layout), so
 * there is no headless way to prove which one produced a Blob, nor what is inside it.
 * What IS pinned here is the routing decision and the wiring that makes the live route
 * produce an animation at all. The applier the live route drives is unit-tested in
 * shells/web/src/bridge/sequence-dom.test.ts; that a real "Record live" take contains
 * motion can only be confirmed by exporting from a browser.
 */
test('export.ts: the compositor is the default for a sequence, live capture the opt-in', async () => {
  const src = await readFile(join(ROOT, 'shells', 'web', 'src', 'bridge', 'export.ts'), 'utf8');

  // The compositor is deterministic, faster than realtime and higher quality, so it
  // takes every motion export of a sequence — EXCEPT when the user asked for a live
  // take, which stays available because it is the cheap route on a low-power device.
  for (const fmt of ['webm', 'mp4']) {
    assert.ok(src.includes(`if (!opts.live && isSequenceStage(node)) return await renderSequenceStage(node, '${fmt}', opts);`),
      `${fmt}: sequence → compositor unless the user opted into a live take`);
  }
  // gif/apng have no live path at all — the toggle is webm/mp4 only.
  for (const fmt of ['gif', 'apng']) {
    assert.ok(src.includes(`if (isSequenceStage(node)) return await renderSequenceStage(node, '${fmt}', opts);`),
      `${fmt}: always the compositor`);
  }

  // Precedence for every NON-sequence stage is unchanged: live first, then the
  // record/top-tail sniffs, then the generic renderer.
  for (const fmt of ['webm', 'mp4']) {
    assert.ok(src.includes(
      `return await (opts.live ? renderLive(node, opts, '${fmt}')\n` +
      `        : isRecordStage(node) ? renderRecord(node, opts, '${fmt}')\n` +
      `        : isTopTailStage(node) ? renderTopTail(node, opts, '${fmt}') : renderVideo(node, opts, '${fmt}'));`),
      `${fmt}: record / top-tail / url-shot / filter tools keep today's live-first precedence`);
  }

  // The bug that made a live take useless: nothing advances a sequence stage while the
  // recorder rolls, so renderLive has to drive the playhead itself — starting when the
  // recorder starts (not while the share picker is up) and restoring in a finally.
  const live = src.slice(src.indexOf('async function renderLive('));
  const body = live.slice(0, live.indexOf('\n}\n'));
  assert.match(body, /isSequenceStage\(node\)/, 'renderLive must recognise a sequence stage');
  assert.match(body, /driveSequenceTime\(node as HTMLElement, \{ durationMs: durationS \* 1000 \}\)/,
    'and drive the shared applier across the capture window');
  assert.match(body, /onRecordStart: \(\) => \{ audio\?\.start\(\); playhead\?\.start\(\); \}/,
    'the playhead starts with the recording, not with the screen-share prompt');
  assert.match(body, /finally \{[\s\S]*playhead\?\.stop\(\)/,
    'and is always stopped + restored, including on a cancelled share');
});

// ── 5. the user-set duration reaches the COMPOSITOR ────────────────────────────

// The hook writing opts.duration is only half the fix: the compositor derives its
// length from the artboard's data-seq-ms. These drive the real bridge modules against
// the real tool's rendered DOM, so the hook → bridge handoff is covered end to end
// without a browser (frame timestamps are pure arithmetic).

/** Mount the tool and hand back its artboard as a live jsdom element. */
async function artboardOf(boxes?: unknown[]): Promise<HTMLElement> {
  const rt = await createRuntime(tool, baseHost(), (boxes === undefined ? {} : { boxes }) as never);
  const d = new JSDOM(`<!doctype html><body><div id="stage">${rt.getHydrated() as string}</div></body>`);
  return d.window.document.getElementById('stage') as unknown as HTMLElement;
}

test('without the flag the compositor renders exactly the timeline it was given', async () => {
  const node = await artboardOf(longRow(4));
  const stage = applyDurationOverride(parseSequenceStage(node)!, { duration: 30 });
  assert.equal(stage.totalMs, 4000, 'an unflagged duration never re-lengths the stage');
  assert.equal(frameTimestamps(stage.totalMs, 30).length, 120, '4s at 30fps');
});

test('a user-set duration re-lengths the stage the compositor renders', async () => {
  const node = await artboardOf(longRow(4));
  const shorter = applyDurationOverride(parseSequenceStage(node)!, { duration: 1.5, durationUserSet: true });
  assert.equal(shorter.totalMs, 1500, 'truncated to what the user asked for');
  assert.equal(frameTimestamps(shorter.totalMs, 30).length, 45, 'and the frame grid is truncated with it');

  const longer = applyDurationOverride(parseSequenceStage(node)!, { duration: 10, durationUserSet: true });
  assert.equal(longer.totalMs, 10000, 'a longer clip runs past the last authored clip');
  assert.equal(frameTimestamps(longer.totalMs, 30).length, 300);
});

test('re-lengthing moves OPEN-ENDED boxes and leaves authored spans alone', async () => {
  // A bounded clip plus a scenery box with no dur: the scenery is the one that has to
  // follow the new end (it means "to the end of the sequence"), the clip must not.
  const node = await artboardOf([
    { id: 'bg', kind: 'text', text: 'bg', start: 0 },
    { id: 'a', kind: 'text', text: 'a', lane: 'seq', start: 0, dur: 4 },
  ]);
  const base = parseSequenceStage(node)!;
  const open = base.layers.find((l) => l.openEnded)!;
  const fixed = base.layers.find((l) => !l.openEnded)!;
  assert.equal(open.durMs, base.totalMs, 'the scenery box fills the derived sequence');

  const longer = applyDurationOverride(base, { duration: 9, durationUserSet: true });
  assert.equal(longer.layers[open.idx]!.durMs, 9000, 'and follows a user-set length');
  assert.equal(longer.layers[fixed.idx]!.durMs, fixed.durMs, 'an authored span is untouched');
  assert.equal(base.layers[open.idx]!.durMs, open.durMs, 'the input stage was not mutated');
});

test('a nonsense user-set duration leaves the derived length in place', async () => {
  const node = await artboardOf(longRow(4));
  const base = parseSequenceStage(node)!;
  for (const bad of [0, -1, Number.NaN, undefined, 'soon']) {
    assert.equal(applyDurationOverride(base, { duration: bad, durationUserSet: true }).totalMs, 4000,
      `duration ${String(bad)} is not a length`);
  }
});

test('renderSequence applies the override BEFORE the ceiling check and the frame grid', async () => {
  // Order matters: totalMs feeds the SEQ_TOO_HEAVY guard, the frame grid, every
  // open-ended layer and the audio bed. Overriding late would leave them disagreeing.
  const whole = await readFile(join(ROOT, 'shells', 'web', 'src', 'bridge', 'sequence-render.ts'), 'utf8');
  const src = whole.slice(whole.indexOf('export async function renderSequence(')); // not the module constants
  const overrideAt = src.indexOf('applyDurationOverride(parsed, opts)');
  const ceilingAt = src.indexOf('stage.totalMs > MAX_SEQUENCE_MS');
  const gridAt = src.indexOf('frameTimestamps(stage.totalMs');
  assert.ok(overrideAt > 0, 'renderSequence must apply the override');
  assert.ok(overrideAt < ceilingAt && overrideAt < gridAt,
    'the override lands before the ceiling check and before the frame grid is built');
});
