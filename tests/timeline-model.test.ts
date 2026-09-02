// SPDX-License-Identifier: MPL-2.0
/**
 * Design - timeline time-model contract tests (Fable timeline, phase 1).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Spec: plans/52-fable-timeline-phase-1.md section 5. Phase 1 is inert data only - nothing
 * reads `data-t-*`/`data-sequence` yet (that's the phase-2 panel) - so these tests
 * only guard: the compact-blocks wire format stays positionally stable, the hook's
 * derived attributes/duration math is correct, and hostile input can never reach a
 * rendered HTML attribute unescaped.
 *
 * Loads the REAL tool from disk (community/ - public, always present
 * in a public checkout; brands/suse is a private submodule CI skips) and drives it
 * through the engine with a stub host, exactly like design-fit-circle.test.ts.
 */

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { KF_CHARSET_RE, parseKf, serialiseKf } from '../engine/src/keyframes.ts';
import { baseHost } from './helpers/host.ts';

// Public community pack - present in every checkout (brands/suse is private + CI-skipped).
const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);

const boxesField = () => tool.manifest.inputs.find((i: any) => i.id === 'boxes');
const boxSubFields = () => boxesField().fields as any[];

async function mount(boxes: unknown[]) {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

// Pull the opening tag for a given data-box-id out of rendered HTML (non-greedy up
// to the first '>' - every attribute value in this template is quoted, so a '>'
// can't appear mid-tag unless something broke out of an attribute, which is
// exactly what the sanitisation test below checks for).
function boxTag(html: string, id: string): string {
  const m = html.match(new RegExp(`<div class="lolly-box" data-canvas-input="boxes:\\d+" data-box-id="${id}"[^>]*>`));
  assert.ok(m, `box "${id}" opening tag found in rendered HTML`);
  return m![0];
}

// ── 1. wire order ──────────────────────────────────────────────────────────────────
//
// The compact tilde-delimited block URL format (engine/src/url-mode.ts
// decodeBlocksCompact/splitToFields) is POSITIONAL: field i's value lives in comma
// slot i, keyed off the manifest's `fields[]` array order. If anyone ever inserts a
// field mid-array instead of appending, every previously-shared link silently
// decodes into the wrong columns. This test builds one compact row with a distinct
// sentinel value per field (by index) and asserts every field - the 39 pre-existing
// ones (id..fillRule) AND the 10 new time fields (start..lane) - decodes back into
// its own id, unshifted.

test('wire order: compact-blocks encode/decode round-trips every field (id..fillRule, start..lane) to its own slot', () => {
  const fields = boxSubFields();
  // Deliberately NOT asserting fields.length, and NOT asserting that the time fields
  // are LAST. `fields[]` is append-only: appending is the one safe edit, so a test that
  // pins the total count or the tail forbids exactly what it is meant to protect, and
  // fails on a correct change made by whoever appends next. Pin SLOTS instead - a
  // stable prefix, plus the time fields at their own fixed indices.
  assert.ok(fields.length >= 49, 'boxes has at least the 39 pre-existing + 10 time sub-fields');

  // Sanity-check the two spans this test is actually about, so a future INSERTION
  // (as opposed to an append) fails loudly here rather than just shifting silently.
  const ids = fields.map((f: any) => f.id);
  assert.deepEqual(
    ids.slice(0, 39),
    ['id', 'kind', 'x', 'y', 'w', 'h', 'rot', 'shape', 'radius', 'bg', 'opacity', 'image', 'fit', 'blend',
     'text', 'fg', 'fontSize', 'align', 'valign', 'weight', 'font', 'lineHeight', 'tracking', 'ligatures',
     'alternates', 'group', 'clip', 'pad', 'shadow', 'shadowColor', 'shadowX', 'shadowY', 'shadowBlur',
     'imgpos', 'fitText', 'path', 'stroke', 'strokeW', 'fillRule'],
    'pre-existing 39 fields unshifted',
  );
  assert.deepEqual(
    ids.slice(39, 49),
    ['start', 'dur', 'clipIn', 'speed', 'enter', 'exit', 'enterMs', 'exitMs', 'mute', 'lane'],
    'the 10 time fields occupy slots 39..48, immediately after fillRule (a bounded slice, '
      + 'so appending a 50th field stays legal)',
  );
  // plan 104 section 5.1/section 5.3: the depth + keyframe fields append at 69/70. Same rule, same
  // reason - a bounded slice, so a 72nd field stays legal, but an INSERT in front of
  // these two (which is what silently re-columns every shared link) fails right here.
  assert.deepEqual(ids.slice(69, 71), ['z', 'kf'], 'z/kf appended at slots 69/70');
  // plan 104 P2.1: the per-box perspective tilt pair appends at 88/89, after holdRate.
  // Same bounded-slice rule - a 91st field stays legal, an INSERT in front of these fails.
  assert.deepEqual(ids.slice(88, 90), ['rx', 'ry'], 'rx/ry appended at slots 88/89');
  for (const id of ['z', 'kf', 'rx', 'ry']) {
    assert.deepEqual(fields.find((f: any) => f.id === id).showFor, [], `${id} is machine-managed`);
  }
  // The tilt fields default to '' and NOT to 0, and that is a wire decision rather than a
  // taste one: encodeBlocksCompact materialises each field's declared default and then
  // trims only TRAILING EMPTY cells, so a `0` default would permanently add ",0,0" to
  // every row of every design link ever shared, while '' is trimmed back to nothing.
  for (const id of ['rx', 'ry']) {
    assert.equal(fields.find((f: any) => f.id === id).default, '',
      `${id} must default to '' - a 0 default grows every existing share link by two cells`);
  }
  assert.equal(new Set(ids).size, ids.length, 'no duplicate sub-field ids');

  // One sentinel value per field, keyed by its position (not its id) - this is what
  // catches a positional shift: if field N's declared slot moved, its decoded value
  // will be some OTHER field's sentinel, not 'f<N>'.
  const row = fields.map((_f: any, i: number) => encodeURIComponent(`f${i}`)).join(',');

  const manifest = { inputs: [{ id: 'boxes', type: 'blocks', fields }] };
  const { values } = parseUrlState(`boxes=${row}`, manifest as any);
  const decoded = (values as any).boxes as any[];
  assert.equal(decoded.length, 1, 'one row decoded');
  const obj = decoded[0];

  fields.forEach((f: any, i: number) => {
    const raw = `f${i}`;
    let expected: unknown = raw;
    // A colour field gets its '#' restored ONLY when the body is a bare hex (the codec is
    // hex-aware now - a CSS var()/keyword colour is left verbatim). The sentinel `f${i}` is
    // bare hex for i≥100 or 3-char values like f15/f29, but not the 2-char f9 (bg) - so the
    // expectation is conditional. This still pins POSITIONAL order (field i → slot i).
    if (f.type === 'color' && /^[0-9a-fA-F]{3,8}$/.test(raw)) expected = `#${raw}`;
    if (f.type === 'asset') expected = { source: 'library', id: raw, _unresolved: true };
    assert.deepEqual(obj[f.id], expected, `field ${i} ("${f.id}") landed in slot ${i}, not shifted`);
  });
});

// `boxes` is ONE positional wire, and it USED to be shared by two independently
// edited brand copies of design, so a wire-order parity test lived here. The
// copies were consolidated into the single community/design (2026-08-16), which
// retires the test the strong way: with one manifest there is no second copy to
// drift, so cross-profile share links agree by construction.

// The case that actually carries the regression risk: a link SHARED BEFORE the time
// fields existed carries only the first 39 comma slots, and is now decoded against a
// 49-field manifest. splitToFields' `parts.length <= count` branch must leave those 39
// untouched and leave the 10 new slots empty (which reads back as scenery - no
// data-t-*), rather than redistributing values across columns. A full 49-value row
// (the test above) cannot catch a mis-handled SHORT row.
test('wire order: a SHORT pre-change row (39 values) still decodes every old field into its own slot, new fields empty', () => {
  const fields = boxSubFields();
  const oldCount = 39; // id..fillRule - every field that existed before the time model
  const row = Array.from({ length: oldCount }, (_v, i) => encodeURIComponent(`f${i}`)).join(',');

  const manifest = { inputs: [{ id: 'boxes', type: 'blocks', fields }] };
  const { values } = parseUrlState(`boxes=${row}`, manifest as any);
  const obj = ((values as any).boxes as any[])[0];

  fields.slice(0, oldCount).forEach((f: any, i: number) => {
    const raw = `f${i}`;
    let expected: unknown = raw;
    // Hex-aware '#' restore (see the note in the full-row test above).
    if (f.type === 'color' && /^[0-9a-fA-F]{3,8}$/.test(raw)) expected = `#${raw}`;
    if (f.type === 'asset') expected = { source: 'library', id: raw, _unresolved: true };
    assert.deepEqual(obj[f.id], expected, `pre-change field ${i} ("${f.id}") decoded unshifted from a short row`);
  });
  fields.slice(oldCount).forEach((f: any) => {
    assert.equal(obj[f.id] ?? '', '', `new time field "${f.id}" decodes empty from a pre-change row`);
  });
});

test('wire order: a pre-change row renders with no time attributes at all (old links are untouched by the time model)', async () => {
  const fields = boxSubFields();
  const manifest = { inputs: [{ id: 'boxes', type: 'blocks', fields }] };
  // A plausible old row: id/kind/x/y/w/h, everything else default-empty.
  const { values } = parseUrlState('boxes=old,box,0,0,300,200', manifest as any);
  const html = await mount((values as any).boxes as unknown[]);
  assert.ok(!html.includes('data-sequence'), 'a pre-change link never gains a data-sequence');
  assert.ok(!html.includes('data-t-'), 'a pre-change link never gains a data-t-* attribute');
});

// ── 2. hydrate end-to-end ───────────────────────────────────────────────────────────

test('hydrate: a seq clip + a scenery box → data-sequence with correct seq-ms, seq box carries its own data-t-*, scenery carries none', async () => {
  const html = await mount([
    { id: 'clip', kind: 'text', x: 0, y: 0, w: 200, h: 100, text: 'hi', lane: 'seq', start: 1, dur: 3 },
    { id: 'scenery', kind: 'box', x: 0, y: 200, w: 200, h: 100, bg: '#112233' },
  ]);

  // seqMs: one timed box with a dur → max(start+dur) = (1+3)*1000 = 4000ms.
  assert.match(html, /<div class="artboard"[^>]*data-sequence data-seq-ms="4000"[^>]*>/, 'artboard carries data-sequence with the derived length');

  const clipTag = boxTag(html, 'clip');
  assert.match(clipTag, /data-t-start="1000"/, 'seq box start in ms');
  assert.match(clipTag, /data-t-dur="3000"/, 'seq box dur in ms');
  assert.match(clipTag, /data-t-lane="seq"/, 'seq box carries its lane marker');

  const sceneryTag = boxTag(html, 'scenery');
  assert.ok(!/data-t-/.test(sceneryTag), 'scenery box carries NO data-t-* attributes: ' + sceneryTag);
});

// ── 3. no-regression golden ─────────────────────────────────────────────────────────

test('no-regression: an untimed model renders no data-sequence and no data-t- anywhere (byte-for-byte inert)', async () => {
  const html = await mount([
    { id: 'a', kind: 'box', x: 0, y: 0, w: 300, h: 200, bg: '#ff0000' },
    { id: 'b', kind: 'text', x: 0, y: 250, w: 300, h: 100, text: 'untimed' },
  ]);
  assert.ok(!html.includes('data-sequence'), 'no data-sequence anywhere in an untimed render');
  assert.ok(!html.includes('data-t-'), 'no data-t-* anywhere in an untimed render');

  // A second render of the same untimed input is identical - the time-model code
  // path is a pure no-op for documents that don't use it (structural equality,
  // not a stored golden blob - this repo has no snapshot-file convention, see
  // tests/README.md / design-fit-circle.test.ts).
  const html2 = await mount([
    { id: 'a', kind: 'box', x: 0, y: 0, w: 300, h: 200, bg: '#ff0000' },
    { id: 'b', kind: 'text', x: 0, y: 250, w: 300, h: 100, text: 'untimed' },
  ]);
  assert.equal(html, html2, 'identical untimed input renders byte-identical output');
});

// ── 4. derived duration ─────────────────────────────────────────────────────────────

function seqMsOf(html: string): number {
  const m = html.match(/data-seq-ms="(\d+)"/);
  return m ? Number(m[1]) : 0;
}

test('derived duration: timed boxes but no dur anywhere → 5s default (DEFAULT_SEQ_S)', async () => {
  const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', lane: 'seq' }]);
  assert.equal(seqMsOf(html), 5000, 'no authored dur anywhere → 5000ms default');
});

test('derived duration: an open-ended box (no dur) does not affect the max - only dur-bearing boxes set the length', async () => {
  const html = await mount([
    { id: 'timed', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, dur: 2 },
    { id: 'open', kind: 'text', x: 0, y: 150, w: 100, h: 100, text: 'y', start: 0 }, // open-ended, extends to seqMs
  ]);
  assert.equal(seqMsOf(html), 2000, 'seqMs = the one dur-bearing box (2s); the open-ended box does not extend it further');
  assert.ok(!/data-t-dur=/.test(boxTag(html, 'open')), 'the open-ended box itself carries no data-t-dur');
});

test('derived duration: the maximum of (start+dur) across all timed boxes wins', async () => {
  const html = await mount([
    { id: 'first', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 1, dur: 1 },   // ends at 2s
    { id: 'second', kind: 'text', x: 0, y: 150, w: 100, h: 100, text: 'y', start: 0, dur: 3 }, // ends at 3s
  ]);
  assert.equal(seqMsOf(html), 3000, 'the later end (3s) wins over the earlier one (2s)');
});

test('derived duration: no timed boxes at all → 0 / absent (no data-sequence)', async () => {
  const html = await mount([{ id: 'scenery', kind: 'box', x: 0, y: 0, w: 100, h: 100, bg: '#000' }]);
  assert.ok(!html.includes('data-sequence'), 'purely untimed content never gets a data-sequence attribute');
});

// ── 5. sanitisation ─────────────────────────────────────────────────────────────────

test('sanitisation: a hostile, non-whitelisted enter value is dropped, never reaches the attribute (no breakout)', async () => {
  const html = await mount([
    { id: 'hostile', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, enter: '"onmouseover=alert(1)' },
  ]);
  const tag = boxTag(html, 'hostile');
  assert.ok(!tag.includes('onmouseover'), 'the hostile enum string never made it into the rendered tag: ' + tag);
  assert.ok(!/data-t-enter=/.test(tag), 'not in TRANSITIONS whitelist → the attribute is omitted entirely, not just escaped');
  // Well-formed: exactly the number of '"' we expect (a multiple of 2, one open/close
  // per attribute) - a breakout would leave an odd count or inject a bare '='.
  const quoteCount = (tag.match(/"/g) || []).length;
  assert.equal(quoteCount % 2, 0, 'attribute quoting stays balanced - no breakout: ' + tag);
});

test('sanitisation: NaN / non-numeric dur is dropped (never emits a broken/NaN attribute)', async () => {
  const htmlNaN = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, dur: Number.NaN }]);
  assert.ok(!/data-t-dur=/.test(boxTag(htmlNaN, 'a')), 'NaN dur → attribute omitted');

  const htmlAbc = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, dur: 'abc' }]);
  assert.ok(!/data-t-dur=/.test(boxTag(htmlAbc, 'a')), '"abc" dur → attribute omitted');
});

test('sanitisation: dur is clamped to [0.1, 3600] seconds - negative and absurdly large values never ride through raw', async () => {
  const htmlNeg = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, dur: -5 }]);
  assert.match(boxTag(htmlNeg, 'a'), /data-t-dur="100"/, '-5s clamps up to the 0.1s floor (100ms)');

  const htmlHuge = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, dur: 1e9 }]);
  assert.match(boxTag(htmlHuge, 'a'), /data-t-dur="3600000"/, '1e9s clamps down to the 3600s ceiling (3600000ms)');
});

test('sanitisation: speed is clamped to [0.25, 4] (an absurd multiplier never rides through raw)', async () => {
  const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, speed: 99 }]);
  assert.match(boxTag(html, 'a'), /data-t-speed="4"/, '99x clamps down to the 4x ceiling');
});

test('sanitisation: speed is rounded to 2dp - accumulated float noise never leaks into the attribute', async () => {
  const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, speed: 0.1 + 0.2 }]);
  assert.match(boxTag(html, 'a'), /data-t-speed="0\.3"/, '0.30000000000000004 emits as 0.3');

  // A speed that rounds back to exactly 1 is a no-op and must stay absent, not emit
  // data-t-speed="1" (the attribute's presence is what phase 2 keys off).
  const htmlOne = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, speed: 1.001 }]);
  assert.ok(!/data-t-speed=/.test(boxTag(htmlOne, 'a')), '1.001 rounds to 1 → attribute omitted');
});

// start had only a `>= 0` floor at first, which let 1e308 * 1000 reach the attribute as
// "Infinity" and anything from 1e21 up as exponential notation ("1e+24") - both of which
// a phase-2 parseInt reads as NaN / 1. It is clamped to the same [0, 3600] range as dur.
test('sanitisation: start is clamped to [0, 3600] - Infinity and exponential notation can never reach the attribute', async () => {
  const htmlNeg = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: -3 }]);
  assert.match(boxTag(htmlNeg, 'a'), /data-t-start="0"/, '-3s clamps to 0');

  for (const start of [1e308, 1e21, 1e9]) {
    const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start, dur: 5 }]);
    assert.match(boxTag(html, 'a'), /data-t-start="3600000"/, `start=${start} clamps to the 3600s ceiling`);
    // The derived sequence length uses the SAME clamped start, so it stays an integer too.
    assert.match(html, /data-seq-ms="3605000"/, `start=${start} → seq length stays a plain integer`);
  }
});

// TRANSITIONS is an object literal, so a bare `TRANSITIONS[v]` truthiness test would
// accept every key inherited from Object.prototype. None of those contain a quote, so
// this was never an attribute breakout - but it hands phase 2's preset lookup a
// garbage keyword (and a truthy Object method), which the whitelist exists to prevent.
test('sanitisation: Object.prototype keys are NOT transitions (constructor / __proto__ / toString / valueOf)', async () => {
  for (const key of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
    const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, enter: key, exit: key }]);
    const tag = boxTag(html, 'a');
    assert.ok(!/data-t-enter=/.test(tag), `enter="${key}" is not whitelisted → attribute omitted: ${tag}`);
    assert.ok(!/data-t-exit=/.test(tag), `exit="${key}" is not whitelisted → attribute omitted: ${tag}`);
  }
});

// ?boxes= accepts raw JSON (url-mode.ts), so a sub-field value can be an array or an
// object. An object with a poisoned toString used to throw on property-key coercion
// inside the whitelist lookup, which aborted the WHOLE compute() - every box then
// rendered with no geometry, text or media. The typeof guard keeps it a no-op.
test('sanitisation: a non-string enter/exit (array, object) is ignored and never aborts compute()', async () => {
  const html = await mount([
    { id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, enter: ['constructor'], exit: { toString: 'x' } },
    { id: 'b', kind: 'box', x: 0, y: 150, w: 100, h: 100, bg: '#112233' },
  ]);
  const tag = boxTag(html, 'a');
  assert.ok(!/data-t-enter=/.test(tag), 'array enter → attribute omitted');
  assert.ok(!/data-t-exit=/.test(tag), 'object exit → attribute omitted');
  // compute() survived: the sibling box still got its geometry/background.
  assert.match(boxTag(html, 'b'), /style="[^"]*#112233/, 'the rest of the document still computed');
});

test('mute accepts the platform-wide boolean spellings ("1"/"on"/"yes"), not just true/"true"', async () => {
  for (const mute of [true, 'true', '1', 'on', 'yes']) {
    const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, mute }]);
    assert.match(boxTag(html, 'a'), /data-t-mute="1"/, `mute=${JSON.stringify(mute)} sets the flag`);
  }
  for (const mute of [false, 'false', '0', 'off', '', undefined]) {
    const html = await mount([{ id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, mute }]);
    assert.ok(!/data-t-mute=/.test(boxTag(html, 'a')), `mute=${JSON.stringify(mute)} leaves the flag absent`);
  }
});

// ── 6. lottie duration math ─────────────────────────────────────────────────────────
//
// The (op - ip) / fr * 1000 computation lives inline in shells/web/src/views/
// picker.ts's storeUserUpload (~line 2483), NOT as an exported/importable function
// - and picker.ts itself imports DOMPurify, a CSS chunk, and other browser-only
// modules at module scope, so it cannot be loaded under plain node:test either.
// Per the task brief, that's reported rather than contorted into an import: this
// unit-tests the exact formula (transcribed verbatim, including its guards) as a
// pure function, so the math itself is verified here; the actual <video> DOM probe
// and this formula's wiring into storeUserUpload remain a browser-only, phase-2
// verification concern (see tests/README.md's "gated tests" note for the existing
// precedent of browser-only paths being out of scope for node:test).

function lottieDurationMs(op: unknown, ip: unknown, fr: unknown): { durationMs?: number; fps?: number } {
  if (typeof op === 'number' && typeof ip === 'number' && typeof fr === 'number'
      && Number.isFinite(op) && Number.isFinite(ip) && Number.isFinite(fr) && fr > 0) {
    const ms = Math.round((op - ip) / fr * 1000);
    if (ms > 0) return { durationMs: ms, fps: fr };
  }
  return {};
}

test('lottie duration math: (op - ip) / fr * 1000, the common case', () => {
  // 120 frames at 30fps starting at frame 0 → 4000ms.
  assert.deepEqual(lottieDurationMs(120, 0, 30), { durationMs: 4000, fps: 30 });
});

test('lottie duration math: fr = 0 is guarded (would otherwise divide by zero)', () => {
  assert.deepEqual(lottieDurationMs(120, 0, 0), {}, 'fr=0 → no durationMs, no Infinity/NaN leak');
});

test('lottie duration math: missing/non-finite fields never produce a durationMs', () => {
  assert.deepEqual(lottieDurationMs(undefined, 0, 30), {}, 'missing op → no durationMs');
  assert.deepEqual(lottieDurationMs(120, undefined, 30), {}, 'missing ip → no durationMs');
  assert.deepEqual(lottieDurationMs(120, 0, undefined), {}, 'missing fr → no durationMs');
  assert.deepEqual(lottieDurationMs(Number.NaN, 0, 30), {}, 'NaN op → no durationMs');
  assert.deepEqual(lottieDurationMs(Number.POSITIVE_INFINITY, 0, 30), {}, 'Infinity op → no durationMs');
});

test('lottie duration math: op === ip (zero-length) never produces a durationMs (guarded by ms > 0)', () => {
  assert.deepEqual(lottieDurationMs(10, 10, 30), {}, 'zero-length clip → no durationMs stored (never 0)');
});

// ── 6. authored easing ──────────────────────────────────────────────────────────────
//
// `enterEase`/`exitEase` are the one time sub-field that is neither a number nor a
// closed enum - a cubic-bezier is user-typed text that has to reach an HTML attribute.
// So the hook never emits the author's string: it emits a whitelisted preset name, or
// a bezier rebuilt from its own parsed numbers. Everything else is dropped entirely,
// which the readers treat as "the preset keeps its built-in curve".

const timed = (over: Record<string, unknown>) => ({
  id: 'a', kind: 'text', x: 0, y: 0, w: 100, h: 100, text: 'x', start: 0, dur: 2, ...over,
});

test('easing: a whitelisted preset rides through, on the phase that declared it', async () => {
  const html = await mount([timed({ enter: 'rise', enterEase: 'overshoot', exit: 'fade', exitEase: 'ease-in' })]);
  const tag = boxTag(html, 'a');
  assert.match(tag, /data-t-enter-ease="overshoot"/);
  assert.match(tag, /data-t-exit-ease="ease-in"/);
});

test('easing: a cubic-bezier is re-emitted from its PARSED numbers, not from the typed string', async () => {
  const html = await mount([timed({ enter: 'rise', enterEase: '  cubic-bezier( 0.2 , 1.4000004 , 0.6 , 1 )  ' })]);
  assert.match(boxTag(html, 'a'), /data-t-enter-ease="cubic-bezier\(0\.2,1\.4,0\.6,1\)"/,
    'whitespace and float noise are normalised away - the attribute is the hook\'s own text');
});

test('easing: an unauthored curve emits no attribute at all', async () => {
  for (const ease of [undefined, '', '   ']) {
    const tag = boxTag(await mount([timed({ enter: 'rise', enterEase: ease })]), 'a');
    assert.ok(!/data-t-enter-ease=/.test(tag), `${JSON.stringify(ease)} → attribute omitted`);
  }
  // And never without a kind to ease: the attribute lives inside the enter/exit guard.
  const noKind = boxTag(await mount([timed({ enterEase: 'linear', exitEase: 'linear' })]), 'a');
  assert.ok(!/-ease=/.test(noKind), 'no transition → no curve for it to govern');
});

test('easing: hostile and malformed curves are dropped, never escaped-and-emitted', async () => {
  const hostile = [
    '"onmouseover=alert(1)',
    'cubic-bezier(0,0,1,1)"><script>alert(1)</script>',
    'cubic-bezier(0,0,1)',            // three controls
    'cubic-bezier(0,0,1,1,1)',        // five
    'cubic-bezier(2,0,1,1)',          // x outside 0..1: not a function of progress
    'cubic-bezier(-0.1,0,1,1)',
    'cubic-bezier(a,b,c,d)',
    'cubic-bezier(0,0,1,Infinity)',
    'constructor', '__proto__', 'toString', 'valueOf',
    'linear;background:url(x)',
  ];
  for (const enterEase of hostile) {
    const tag = boxTag(await mount([timed({ enter: 'rise', enterEase })]), 'a');
    assert.ok(!/data-t-enter-ease=/.test(tag), `${enterEase} → attribute omitted: ${tag}`);
    assert.ok(!tag.includes('onmouseover') && !tag.includes('<script'), `nothing leaked: ${tag}`);
    assert.equal((tag.match(/"/g) || []).length % 2, 0, `quoting stays balanced: ${tag}`);
  }
});

test('easing: a non-string curve is ignored and never aborts compute()', async () => {
  const html = await mount([
    timed({ enter: 'rise', enterEase: ['overshoot'], exit: 'fade', exitEase: { toString: 'x' } }),
    { id: 'b', kind: 'box', x: 0, y: 150, w: 100, h: 100, bg: '#112233' },
  ]);
  assert.ok(!/-ease=/.test(boxTag(html, 'a')), 'array / object curves → attributes omitted');
  assert.match(boxTag(html, 'b'), /style="[^"]*#112233/, 'the rest of the document still computed');
});

// ── 7. depth + keyframes (plan 104 section 5.1/section 5.3) ──────────────────────────────────────
//
// `z` is an ordinary clamped number, so it needs no more than the usual guards. `kf` is
// the harder one: it is the second free-text sub-field (after the easings above) and it
// carries a whole animation, so the hook parses it and RE-SERIALISES its own text rather
// than passing the author's through. The engine owns the canonical grammar
// (engine/src/keyframes.ts); the hook cannot import it, so the two implementations are
// pinned to each other here - anything else is a divergence waiting for a share link.

test('depth: an authored z rides through as a clamped integer, and 0 emits nothing', async () => {
  const on = boxTag(await mount([timed({ z: 140 })]), 'a');
  assert.match(on, /data-t-z="140"/, 'the authored depth reaches the attribute');

  for (const z of [0, undefined, '', 'abc', Number.NaN]) {
    const tag = boxTag(await mount([timed({ z })]), 'a');
    assert.ok(!/data-t-z=/.test(tag), `z=${JSON.stringify(z)} → attribute absent (the on-surface default)`);
  }
});

test('depth: z is clamped to [-300, 900] - the field range, not whatever a URL says', async () => {
  assert.match(boxTag(await mount([timed({ z: 1e9 })]), 'a'), /data-t-z="900"/, 'clamps to the ceiling');
  assert.match(boxTag(await mount([timed({ z: -1e9 })]), 'a'), /data-t-z="-300"/, 'clamps to the floor');
  assert.match(boxTag(await mount([timed({ z: 1e308 })]), 'a'), /data-t-z="900"/, 'no Infinity, no exponent notation');
});

// ── 7b. per-box perspective tilt (plan 104 P2.1) ────────────────────────────────────
//
// `rx`/`ry` are the box's OWN pitch and yaw, and they have two consumers with one
// number between them: the inline transform boxCss bakes (which is the whole static
// pose - it renders with no timeline, headless in the CLI, and in every export) and
// the data-t-rx/-ry attributes the sequence readers fold into the camera homography.
// Both go through the hook's single `tiltDeg`, so these tests pin the same clamp twice
// on purpose: a drift between them is a board that looks different once it is timed.

test('tilt: an authored rx/ry rides through as clamped attributes, and 0 emits nothing', async () => {
  const on = boxTag(await mount([timed({ rx: -12, ry: 30 })]), 'a');
  assert.match(on, /data-t-rx="-12"/, 'the authored pitch reaches the attribute');
  assert.match(on, /data-t-ry="30"/, 'and the yaw');

  for (const v of [0, undefined, '', 'abc', Number.NaN]) {
    const tag = boxTag(await mount([timed({ rx: v, ry: v })]), 'a');
    assert.ok(!/data-t-rx=|data-t-ry=/.test(tag), `${JSON.stringify(v)} → both absent (flat is the default)`);
  }
});

test('tilt: rx/ry clamp to the FIELD range [-75, 75] and round to 2dp', async () => {
  assert.match(boxTag(await mount([timed({ rx: 1e9 })]), 'a'), /data-t-rx="75"/, 'clamps to the ceiling');
  assert.match(boxTag(await mount([timed({ ry: -1e9 })]), 'a'), /data-t-ry="-75"/, 'clamps to the floor');
  assert.match(boxTag(await mount([timed({ rx: 1e308 })]), 'a'), /data-t-rx="75"/, 'no Infinity, no exponent notation');
  // The kf WIRE clamp is ±180 and always has been; the base FIELD is tighter, exactly as
  // z's field range (−300…900) is tighter than its ±12000 wire. Do not conflate them.
  assert.match(boxTag(await mount([timed({ ry: 120 })]), 'a'), /data-t-ry="75"/, 'the wire range is not the field range');
  assert.match(boxTag(await mount([timed({ rx: 12.3456 })]), 'a'), /data-t-rx="12.35"/, '2dp, so no float noise leaks');
});

// The static pose. This is the half that needs no timeline at all: the transform is
// inline, so it renders in the editor, in the CLI, and in every raster export - and the
// perspective() FUNCTION is what routes SVG/PDF to the per-box raster tier instead of
// emitting the box unsquashed on the bounding-box path (engine/src/css-box.ts).
test('tilt: boxCss bakes perspective + yaw + pitch INSIDE everything the box does in its own plane', async () => {
  const tag = boxTag(await mount([timed({ rx: -12, ry: 30, rot: 15, flipH: true })]), 'a');
  assert.match(tag, /transform:perspective\(1200px\) rotateY\(30deg\) rotateX\(-12deg\) rotate\(15deg\) scale\(-1,1\);/,
    'yaw before pitch (R = Ry*Rx), and both prepended so the rotate/flip happen first: ' + tag);
  // Only the authored angles appear - a zero half contributes no function at all.
  const yawOnly = boxTag(await mount([timed({ ry: 30 })]), 'a');
  assert.match(yawOnly, /transform:perspective\(1200px\) rotateY\(30deg\);/, yawOnly);
  assert.ok(!/rotateX/.test(yawOnly), 'no rotateX(0deg) padding: ' + yawOnly);
});

test('tilt: a flat box emits no transform at all - the byte-identity floor', async () => {
  for (const over of [{}, { rx: 0, ry: 0 }, { rx: '', ry: '' }]) {
    const tag = boxTag(await mount([timed(over)]), 'a');
    assert.ok(!/transform:/.test(tag), `${JSON.stringify(over)} → no transform: ${tag}`);
    assert.ok(!/perspective/.test(tag), `and no stray perspective: ${tag}`);
  }
});

// Same exclusion, same reason as z/kf: frameGroupsFor stamps timeAttrsFor's string onto
// the [data-pdf-page] div, so a frame must not carry a tilt it cannot render (its
// pageStyle is built by hand and never goes through boxCss).
test('tilt: a FRAME page carries neither data-t-rx nor data-t-ry', async () => {
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300, rx: -20, ry: 20, lane: 'seq', start: 0, dur: 3 },
    { id: 'a', kind: 'box', frame: 'f', x: 10, y: 10, w: 50, h: 50, rx: -20, ry: 20 },
  ]);
  const page = html.match(/<div[^>]*data-pdf-page[^>]*>/);
  assert.ok(page, 'the frame renders a page div');
  assert.ok(!/data-t-rx=|data-t-ry=/.test(page[0]), `no tilt on a page: ${page[0]}`);
  // A child box on that page is unaffected: the exclusion is the frame's, not the page's.
  assert.match(boxTag(html, 'a'), /data-t-rx="-20"/);
  assert.match(boxTag(html, 'a'), /data-t-ry="20"/);
});

// Depth and keyframes are NOT timing: a scenery box on a sequence stage is visible
// throughout and can still be lifted or animated (an always-on camera is exactly that
// box). So these two attributes escape the scenery guard - and nothing else does.
test('depth: a scenery box carries z/kf but still no timing attributes', async () => {
  const tag = boxTag(await mount([{ id: 'a', kind: 'box', x: 0, y: 0, w: 100, h: 100, z: 40, kf: 't0_x0*t500_x20' }]), 'a');
  assert.match(tag, /data-t-z="40"/);
  assert.match(tag, /data-t-kf="t0_x0\*t500_x20"/);
  assert.ok(!/data-t-start=/.test(tag), 'scenery gains no start');
  assert.ok(!/data-t-dur=|data-t-lane=/.test(tag), 'and no other timing attribute: ' + tag);
});

test('keyframes: the emitted track is the ENGINE\'s canonical serialisation, byte for byte', async () => {
  // The hook has its own transcription of the grammar (a tool hook cannot import the
  // engine). This is what stops the two drifting: for every input, the attribute the
  // hook writes must equal serialiseKf(parseKf(input)) exactly.
  const corpus = [
    't0_z0_b4*t1500_eo_z140_b0*t4000_eh_z140_x-60',   // the plan's own example
    't0_rx-8_ry20_r15',                                // longest-channel-match
    't0_eb(0.32)(0)(0.67)(1)_x10',                     // a custom bezier
    't0_eb(2)(0)(0.67)(1)_x10',                        // x out of range → clamped, not dropped
    't0_eb(0.4)(0)(0.6)(1)_x1',                        // a bezier that IS a preset
    't0_el_ei_eo_eio_ev_ea_es_ek_eh',                  // every named curve, last wins
    't500_x1*t100_y2*t500_z3',                         // out of order, duplicate time
    't-500_x1', 't12.5_x1', 't.5_x1',                  // the time token's full number form
    '_t0_x1', 't0__x1___y2', '*_*_*',                  // empty tokens and segments
    't0_zzz_x1.2345678', 't0_constructor_x1',          // junk and prototype keys
    't99999999_x1', 't0_x1e21', 't0_z-9999*t10_z99999', // caps and clamps
    't0_x1.0049999', 't0_s1.0005_o0.12345',            // quantisation
    't0_p1200_f800_a0.4',                              // camera channels
    't0_z-5000*t2000_z-600',                           // a camera DOLLY, past the z field's range
    // A keyed SIZE (section 5.2) and a keyed VOLUME (plans/165) - the two channels the hook's
    // transcription has silently dropped in the past. Absent from this corpus, a missing
    // table entry reads as "hook emits less than the engine" only on a user's board.
    't0_w320_h180*t1000_eo_w640_h360_v0.5',
    't0_w99999_h-5*t5_v9',                             // size/volume clamps
    Array.from({ length: 400 }, (_v, i) => `t${i}_x${i}`).join('*'),  // the 256 cap
    't0_x1*'.repeat(3000),                             // the char cap
    // ~42.6 KB: BETWEEN the hook's old hand-derived cap (40 960) and the engine's
    // measured one (49 152). While they disagreed, the two sides truncated this
    // track at different points and read different keyframes off the same string.
    't1_x2*'.repeat(7100),
    // Full density: 256 full poses, the shape section 8's UI writes. This is what the char cap
    // has to be derived from - at 8 KB the two sides truncated at different points.
    Array.from({ length: 256 }, (_v, i) => `t${i * 100}_x${i}.5_y-${i}.25_z${i}_s1.${i}_o0.${i}_b${i % 300}`).join('*'),
  ];
  for (const kf of corpus) {
    const tag = boxTag(await mount([timed({ kf })]), 'a');
    const m = tag.match(/data-t-kf="([^"]*)"/);
    const emitted = m ? m[1]! : '';
    assert.equal(emitted, serialiseKf(parseKf(kf)),
      `hook emission == engine canonical form for ${JSON.stringify(kf.slice(0, 60))}`);
    if (emitted) {
      assert.match(emitted, KF_CHARSET_RE, 'and it stays inside the locked charset');
    }
  }
});

// The reason strict emission exists at all. `kf` is settable from a hand-edited share
// URL and lands in an attribute through {{{ }}}: a value carrying a quote or an angle
// bracket must produce NO attribute, not an escaped one.
test('keyframes: hostile tracks never reach the attribute', async () => {
  const hostile = [
    '"><img src=x onerror=alert(1)>',
    't0_x1"><img src=x onerror=alert(1)>',
    't0_x"><script>alert(1)</script>',
    'javascript:alert(1)',
    'constructor', '__proto__', 'toString', 'valueOf',
    't0_x1;background:url(x)',
    't0_x1,y2',        // a comma is a blocks delimiter and is banned from the charset
    't0_x1~y2',        // as is a tilde
    't0_x1!y2',        // '!' was dropped at grammar lock (shell history expansion)
  ];
  for (const kf of hostile) {
    const tag = boxTag(await mount([timed({ kf })]), 'a');
    assert.ok(!tag.includes('onerror') && !tag.includes('<img') && !tag.includes('<script'),
      `nothing leaked for ${JSON.stringify(kf)}: ${tag}`);
    assert.equal((tag.match(/"/g) || []).length % 2, 0, `quoting stays balanced: ${tag}`);
    const m = tag.match(/data-t-kf="([^"]*)"/);
    if (m) {
      assert.match(m[1]!, KF_CHARSET_RE, `whatever survived is charset-clean: ${m[1]}`);
      assert.ok(!/[",;<>~!]/.test(m[1]!), `and carries none of the dangerous bytes: ${m[1]}`);
    }
  }
});

// section 5.4 scopes v1 to boxes on a [data-sequence] stage: "frame pages are excluded from
// projection and cannot carry kf". frameGroupsFor stamps timeAttrsFor's string onto the
// [data-pdf-page] div, so the exclusion has to live in the emitter - otherwise it becomes
// a rule every future reader of data-t-kf must remember, which is not a rule.
test('depth/keyframes: a FRAME page carries neither data-t-z nor data-t-kf', async () => {
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300, z: 120, kf: 't0_x0*t900_x50', lane: 'seq', start: 0, dur: 3 },
    { id: 'a', kind: 'box', frame: 'f', x: 10, y: 10, w: 50, h: 50, z: 40, kf: 't0_x0*t900_x50' },
  ]);
  const page = html.match(/<div[^>]*data-pdf-page[^>]*>/);
  assert.ok(page, 'the frame renders a page div');
  assert.ok(!/data-t-z=/.test(page[0]), `no depth on a page: ${page[0]}`);
  assert.ok(!/data-t-kf=/.test(page[0]), `no keyframes on a page: ${page[0]}`);
  assert.match(page[0], /data-t-start=/, 'but the page keeps its timing - frames-as-scenes still works');
  // A child box on that page is unaffected: the exclusion is the frame's, not the page's.
  assert.match(boxTag(html, 'a'), /data-t-z="40"/);
  assert.match(boxTag(html, 'a'), /data-t-kf="t0_x0\*t900_x50"/);
});

test('keyframes: a non-string / unparseable track emits no attribute and never aborts compute()', async () => {
  const html = await mount([
    timed({ kf: ['t0_x1'] as unknown as string }),
    { id: 'b', kind: 'box', x: 0, y: 150, w: 100, h: 100, bg: '#112233' },
  ]);
  assert.ok(!/data-t-kf=/.test(boxTag(html, 'a')), 'an array track → attribute omitted');
  assert.match(boxTag(html, 'b'), /style="[^"]*#112233/, 'the rest of the document still computed');

  for (const kf of [undefined, '', '   ', 'nonsense', '*', '_']) {
    const tag = boxTag(await mount([timed({ kf })]), 'a');
    assert.ok(!/data-t-kf=/.test(tag), `${JSON.stringify(kf)} → attribute omitted`);
  }
});

// ── 8. the camera kind (plan 104 section 5.4) ─────────────────────────────────────────────
//
// A camera is a timeline citizen with no artboard footprint: it holds the scene's pose
// and paints nothing. The audio box is the precedent, and the contract is the same one - 
// a still export can never show a mark where it lands.

test('camera: a camera box renders a bare marker and paints nothing', async () => {
  const html = await mount([
    { id: 'cam', kind: 'camera', x: 100, y: 100, w: 300, h: 200, bg: '#ff0000', text: 'nope',
      shadow: 'box', blur: 8, start: 0, dur: 4, kf: 't0_z0*t2000_z300' },
  ]);
  const tag = boxTag(html, 'cam');
  assert.match(html, /<div class="lolly-box-cam" data-cam="1" data-export-hide aria-hidden="true"><\/div>/,
    'the marker is what a camera renders');
  assert.match(tag, /background:transparent/, 'no fill');
  assert.ok(!/box-shadow|drop-shadow|blur\(/.test(tag), 'no shadow and no blur: ' + tag);
  assert.ok(!html.includes('nope'), 'and no text');
  assert.match(tag, /data-t-kf="t0_z0\*t2000_z300"/, 'but it does carry the pose');
});

test('camera: the depth shadow is derived from z, and never from the manual offsets', async () => {
  // (0, z·0.15px, (10 + z·0.2)px, #00000055) - straight overhead, section 5.3.
  const tag = boxTag(await mount([timed({ shadow: 'depth', z: 140, shadowColor: '#ff0000', shadowX: 99, shadowY: 99 })]), 'a');
  assert.match(tag, /filter:drop-shadow\(0px 21px 38px #00000055\)/, 'derived from z alone: ' + tag);
  assert.ok(!tag.includes('#ff0000') && !tag.includes('99px'), 'the manual override tier is not consulted');

  // A sunken box drives the blur term negative; it floors at 0 rather than emitting an
  // illegal CSS length.
  const sunk = boxTag(await mount([timed({ shadow: 'depth', z: -300 })]), 'a');
  assert.match(sunk, /filter:drop-shadow\(0px -45px 0px #00000055\)/, 'blur floors at 0: ' + sunk);
});

test('shadow: the target whitelist is an own-property test (a prototype key is not a shadow)', async () => {
  for (const shadow of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    const tag = boxTag(await mount([timed({ shadow })]), 'a');
    assert.ok(!/box-shadow|drop-shadow|text-shadow/.test(tag), `shadow="${shadow}" paints nothing: ${tag}`);
  }
});

test('the manifest\'s tilt range is the field clamp, not a sixth opinion', () => {
  const manifest = JSON.parse(readFileSync(new URL('../community/design/tool.json', import.meta.url), 'utf8'));
  const boxes = manifest.inputs.find((i: { id: string }) => i.id === 'boxes');
  for (const id of ['rx', 'ry']) {
    const f = boxes.fields.find((x: { id: string }) => x.id === id);
    assert.equal(f.min, -75, `${id}.min`);
    assert.equal(f.max, 75, `${id}.max`);
  }
});
