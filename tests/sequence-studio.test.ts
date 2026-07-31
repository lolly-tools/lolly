// SPDX-License-Identifier: MPL-2.0
/**
 * Sequence Studio — tool contract tests (Fable timeline, phase 2 §5 + §7).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * Loads the REAL tool from community/sequence-studio off disk and drives it through
 * the engine with a stub host, exactly like tests/timeline-model.test.ts does for
 * layout-studio. Three things are guarded here:
 *
 *  1. the manifest still loads (which enforces its engineVersion range against the
 *     running engine) and its `boxes` wire format keeps the phase-1 time slots;
 *  2. the DEFAULT composition hydrates into a real sequence — data-sequence on the
 *     artboard, data-t-* on the timed boxes, and an audio box that contributes the
 *     mix marker and nothing visible;
 *  3. DERIVED-DURATION PARITY: the panel's ruler (timeline-math.deriveDuration) and
 *     the artboard's data-seq-ms (the tool's own hooks, which is the shipped
 *     contract) agree for every configuration. These disagreeing is a real bug class
 *     — the ruler would be a different length from the thing it measures. Note this
 *     asserts against the value the ENGINE actually stamped on the artboard, not
 *     against a re-implementation of the rule.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { deriveDuration, type Box, type TimeCfg } from '../shells/web/src/views/timeline-math.ts';
import { baseHost } from './helpers/host.ts';

// community/ is a public submodule; a checkout that skipped it has no tool to test.
const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

assert.ok(existsSync(join(TOOLS_DIR, 'sequence-studio', 'tool.json')),
  'community/sequence-studio/tool.json is missing — the tool was renamed or deleted');

// loadTool validates against schemas/tool.schema.json AND enforces the manifest's
// engineVersion range against the running ENGINE_VERSION, so this line alone is the
// "manifest validates" assertion the spec asks for.
const tool: any = await loadTool('sequence-studio', fetchFile);

const boxesField = (): any => tool.manifest.inputs.find((i: any) => i.id === 'boxes');
const canvasCfg = (): any => boxesField().canvas;

/**
 * The TimeCfg the panel would build from the manifest, read FROM the manifest rather
 * than hard-coded — so a renamed sub-field can't leave this suite testing a cfg the
 * tool no longer ships.
 */
const cfg: TimeCfg = (() => {
  const c = canvasCfg();
  const need = ['idField', 'startField', 'durField', 'clipInField', 'speedField', 'enterField',
    'exitField', 'enterMsField', 'exitMsField', 'muteField', 'laneField'] as const;
  const out: any = {};
  for (const k of need) {
    assert.equal(typeof c[k], 'string', `canvas.${k} must be declared for the tool to be time-capable`);
    out[k] = c[k];
  }
  return out as TimeCfg;
})();

async function mount(boxes?: unknown[]): Promise<string> {
  // No `boxes` argument ⇒ the manifest DEFAULT composition (the runtime fills it in).
  const state = boxes === undefined ? {} : { boxes: boxes as never };
  const rt = await createRuntime(tool, baseHost(), state as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

/** The artboard's opening tag (attribute values are all quoted, so `[^>]*` is safe). */
function artboard(html: string): string {
  const m = html.match(/<div class="artboard"[^>]*>/);
  assert.ok(m, 'artboard opening tag found in rendered HTML');
  return m![0];
}

/** A box's opening tag by its data-box-id. */
function boxTag(html: string, id: string): string {
  const m = html.match(new RegExp(`<div class="lolly-box"[^>]*data-box-id="${id}"[^>]*>`));
  assert.ok(m, `box "${id}" opening tag found in rendered HTML`);
  return m![0];
}

/**
 * Everything between a box's opening tag and the next box. The template closes with a
 * text-fitting <script> that mentions `.lolly-box-text` in a selector string, so the
 * LAST box's slice has to stop there too or it swallows the script and every "does
 * this box contain X" assertion reads a false positive.
 */
function boxInner(html: string, id: string): string {
  const open = boxTag(html, id);
  const from = html.indexOf(open) + open.length;
  const stops = [html.indexOf('<div class="lolly-box"', from), html.indexOf('<script', from)]
    .filter((i) => i > 0);
  return html.slice(from, stops.length ? Math.min(...stops) : html.length);
}

/**
 * The sequence length the ARTBOARD declares. A composition with nothing timed is not a
 * sequence at all: the hook stamps neither `data-sequence` nor `data-seq-ms`, which is
 * the same statement as "zero length" — so an absent attribute reads as 0, and the
 * absence is asserted rather than assumed.
 */
const seqMsOf = (html: string): number => {
  const tag = artboard(html);
  const m = tag.match(/data-seq-ms="(-?\d+)"/);
  if (!m) {
    assert.ok(!/data-sequence/.test(tag),
      'an artboard with no data-seq-ms must not claim to be a sequence either');
    return 0;
  }
  assert.match(tag, /data-sequence/, 'a measured artboard declares itself a sequence');
  return Number(m[1]);
};

// ── 1. manifest + wire format ──────────────────────────────────────────────────
//
// Slot pins are BOUNDED slices, never a count or an exhaustive key set: `boxes` is an
// append-only positional wire format (url-mode's compact block encoding indexes fields
// by position), so appending field 50 must not fail these.

test('manifest: still-first motion editor with the orientation size driver', () => {
  assert.equal(tool.manifest.id, 'sequence-studio');
  assert.deepEqual(tool.manifest.render.formats, ['png', 'mp4', 'webm', 'gif', 'apng'],
    'phase 3 adds the four motion formats; png stays FIRST because the still is the default poster of the playhead');
  assert.equal(tool.manifest.render.layout, 'editor');
  assert.equal(tool.manifest.render.video.wait, 0, 'a sequence never waits — frame 0 is t=0');

  const ids = tool.manifest.inputs.map((i: any) => i.id);
  assert.equal(ids[0], 'orientation', 'the size driver must be the first input');
  assert.ok(ids.includes('boxes'));
});

test('boxes: the pen-tool and time slots sit where phase 1 locked them', () => {
  const f = boxesField().fields.map((x: any) => x.id);
  assert.deepEqual(f.slice(35, 39), ['path', 'stroke', 'strokeW', 'fillRule'], 'pen-tool slots 35-38');
  assert.deepEqual(f.slice(39, 49),
    ['start', 'dur', 'clipIn', 'speed', 'enter', 'exit', 'enterMs', 'exitMs', 'mute', 'lane'],
    'time-model slots 39-48, in the phase-1 wire order');
});

test('boxes: none of the ten time fields renders as a sidebar control', () => {
  const byId = new Map<string, any>(boxesField().fields.map((x: any) => [x.id, x]));
  for (const id of ['start', 'dur', 'clipIn', 'speed', 'enter', 'exit', 'enterMs', 'exitMs', 'mute', 'lane']) {
    assert.deepEqual(byId.get(id)?.showFor, [], `${id} must carry showFor: [] (panel-owned, not a sidebar field)`);
  }
});

test('boxes: the kind field admits `audio`, so the Audio addKind seed is legal', () => {
  const kind = boxesField().fields.find((x: any) => x.id === 'kind');
  const values = kind.options.map((o: any) => (typeof o === 'string' ? o : o.value));
  assert.ok(values.includes('audio'), 'kind must accept "audio"');

  const seeds = canvasCfg().addKinds ?? [];
  const audio = seeds.find((k: any) => k.id === 'audio');
  assert.ok(audio, 'an "audio" addKind exists');
  assert.ok(values.includes(audio.seed.kind), 'every addKind seeds a legal kind');
  for (const k of seeds) assert.ok(values.includes(k.seed.kind), `addKind "${k.id}" seeds a legal kind`);
});

// ── 2. the default composition hydrates into a sequence ────────────────────────

test('default: the artboard is a sequence with a sane derived duration', async () => {
  const html = await mount();
  const tag = artboard(html);
  assert.match(tag, /data-sequence/, 'the artboard declares itself a sequence');

  const ms = seqMsOf(html);
  assert.ok(Number.isInteger(ms), 'data-seq-ms is an integer count of milliseconds');
  // Sane rather than exact: the default composition is art direction and may be
  // retuned. It must be a real, bounded length — never 0 (nothing timed) and never
  // past the phase-1 ceiling.
  assert.ok(ms > 0, 'the default composition has timed content');
  assert.ok(ms <= 3600 * 1000, 'within the MAX_TIME_S ceiling');
});

test('default: every seq clip carries start + duration and its lane', async () => {
  const html = await mount();
  const seq = [...html.matchAll(/<div class="lolly-box"[^>]*data-t-lane="seq"[^>]*>/g)].map((m) => m[0]);
  assert.ok(seq.length >= 2, 'the default seeds a magnetic row, not a single clip');
  for (const tag of seq) {
    assert.match(tag, /data-t-start="\d+"/, `seq clip carries data-t-start: ${tag.slice(0, 120)}`);
    assert.match(tag, /data-t-dur="\d+"/, `seq clip carries data-t-dur: ${tag.slice(0, 120)}`);
  }

  // The row is gapless and ordered: each clip starts where the previous one ended.
  const spans = seq.map((t) => ({
    start: Number(t.match(/data-t-start="(\d+)"/)![1]),
    dur: Number(t.match(/data-t-dur="(\d+)"/)![1]),
  })).sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1]!, cur = spans[i]!;
    assert.equal(cur.start, prev.start + prev.dur, 'seq row is gapless');
  }
});

test('default: an overlay is timed without a lane', async () => {
  const html = await mount();
  const tags = [...html.matchAll(/<div class="lolly-box"[^>]*>/g)].map((m) => m[0]);

  const overlays = tags.filter((t) => /data-t-start=/.test(t) && !/data-t-lane=/.test(t));
  assert.ok(overlays.length >= 1, 'the default seeds at least one free-floating overlay');
});

// Untimed = scenery: no data-t-* at all, so the clock never hides it and it rides under
// (or over) every clip. This used to be asserted on the shipped default because that
// default happened to carry a permanent wordmark; it is a property of the TOOL, not of
// whatever demo content ships, so it mounts its own composition and the default is free
// to change. The plan-side behaviour (scenery spans the whole sequence) is covered in
// tests/sequence-plan.test.ts.
test('a box with no timing at all renders as scenery — no data-t-* attributes', async () => {
  const html = await mount([
    { id: 'clip', kind: 'box', bg: '#111', text: 'timed', start: 0, dur: 2, lane: 'seq' },
    { id: 'mark', kind: 'box', bg: 'transparent', text: 'always there' },
  ]);
  assert.ok(!/data-t-/.test(boxTag(html, 'mark')), 'an untimed box carries no timing attributes');
  assert.match(boxTag(html, 'clip'), /data-t-start=/, 'the timed clip still does');
});

test('default: the audio box contributes the mix marker and nothing visible', async () => {
  const html = await mount();

  const markers = [...html.matchAll(/<div class="lolly-box-audio"[^>]*>/g)].map((m) => m[0]);
  assert.equal(markers.length, 1, 'exactly one audio marker for the one audio box in the default');
  const marker = markers[0]!;
  assert.match(marker, /data-audio-src="[^"]+"/, 'the marker carries a resolved source for the mixer');
  assert.match(marker, /aria-hidden="true"/, 'the marker is hidden from assistive tech');

  // The box it lives in renders nothing a PNG would show: no image element, no text
  // run, and a transparent fill.
  const holder = html.match(/<div class="lolly-box"[^>]*data-box-id="([^"]+)"[^>]*>(?:(?!<div class="lolly-box")[\s\S])*?<div class="lolly-box-audio"/);
  assert.ok(holder, 'the audio marker sits inside a lolly-box');
  const id = holder![1]!;
  assert.match(boxTag(html, id), /background:transparent/, 'an audio box never paints a fill');

  const inner = boxInner(html, id);
  assert.ok(!/<img/.test(inner), 'an audio box emits no <img> — it is not a broken image');
  // The template emits the text run unconditionally, so the guarantee is that it is
  // EMPTY: a library audio ref must never leak its id (or a data: URI) as visible text.
  const text = inner.match(/<div class="lolly-box-text"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(text, 'the text run is present (the template emits it for every box)');
  assert.equal(text![1], '', 'an audio box renders no text');

  // styles.css must actually hide it in static/PNG output.
  const css = await fetchFile('sequence-studio/styles.css');
  assert.match(css, /\.lolly-box-audio\s*\{[^}]*display:\s*none/, 'styles.css hides .lolly-box-audio');
});

test('default: block asset refs are unresolved {source,id} objects, never bare strings', async () => {
  for (const row of boxesField().default as any[]) {
    if (!row.image) continue;
    assert.equal(typeof row.image, 'object', `box "${row.id}" image ref is an object`);
    assert.ok(row.image.source && row.image.id, `box "${row.id}" image ref carries source + id`);
    assert.equal(row.image._unresolved, true, `box "${row.id}" image ref is marked _unresolved`);
  }
});

// ── 3. DERIVED-DURATION PARITY ─────────────────────────────────────────────────
//
// deriveDuration (what the panel's ruler measures) vs data-seq-ms (what the tool's
// hooks stamp, and therefore what every consumer of the render sees). The hook is the
// shipped contract: if these ever disagree, timeline-math is what gets fixed.

const PARITY_CASES: Array<{ name: string; boxes: Box[] }> = [
  { name: 'nothing timed — scenery only', boxes: [{ id: 'a' }, { id: 'b', start: '' }] },
  { name: 'seq clips with durations — max(start+dur)', boxes: [
    { id: 'a', lane: 'seq', start: 0, dur: 2.5 },
    { id: 'b', lane: 'seq', start: 2.5, dur: 3 },
    { id: 'c', lane: 'seq', start: 5.5, dur: 2.5 },
  ] },
  { name: 'timed but no duration anywhere — the 5s fallback', boxes: [
    { id: 'a', lane: 'seq' },
    { id: 'b', start: 1.5 },
  ] },
  { name: 'mixed: a dur-less seq clip alongside timed clips', boxes: [
    { id: 'a', lane: 'seq', start: 0, dur: 4 },
    { id: 'b', lane: 'seq' },
    { id: 'c', start: 9, dur: 1 },
  ] },
  { name: 'overlay outlasts the seq row', boxes: [
    { id: 'a', lane: 'seq', start: 0, dur: 2 },
    { id: 'over', start: 1, dur: 30 },
  ] },
  { name: 'speed never scales the timeline length', boxes: [
    { id: 'a', lane: 'seq', start: 0, dur: 4, speed: 4 },
    { id: 'b', lane: 'seq', start: 4, dur: 2, speed: 0.25 },
  ] },
  { name: 'clamped: start and dur past MAX_TIME_S', boxes: [
    { id: 'a', lane: 'seq', start: 999999, dur: 999999 },
  ] },
  { name: 'stringy + junk values', boxes: [
    { id: 'a', lane: 'seq', start: '1.25', dur: '2.5' },
    { id: 'b', lane: 'seq', start: 'NaN', dur: 'x' },
    { id: 'c', lane: 'seq', start: null, dur: undefined },
  ] },
  { name: 'negative start floors at 0', boxes: [
    { id: 'a', lane: 'seq', start: -12, dur: 3 },
  ] },
  { name: 'a lane value inherited from Object.prototype is not "seq"', boxes: [
    { id: 'a', lane: 'constructor', start: '' },
    { id: 'b', lane: 'toString', start: '' },
  ] },
];

for (const c of PARITY_CASES) {
  test(`parity: deriveDuration === the artboard's data-seq-ms — ${c.name}`, async () => {
    const html = await mount(c.boxes);
    assert.equal(deriveDuration(c.boxes, cfg), seqMsOf(html),
      'the panel ruler and the rendered sequence must be the same length');
  });
}

test('parity: the DEFAULT composition agrees too', async () => {
  const boxes = boxesField().default as Box[];
  const html = await mount();
  assert.equal(deriveDuration(boxes, cfg), seqMsOf(html));
});

// ── the audio contract holds for EVERY route into it, not just the default ─────
//
// "An audio box leaves no mark on the frame" is the tool's own stated invariant. It is
// only true if every visual channel agrees on what audio IS — a shadow paints OUTSIDE
// a transparent box, and the `shadow` field carries no showFor restriction, so an
// audio box can carry one from the sidebar.

test('an audio box with a shadow, a clip, a fill and a label still prints nothing', async () => {
  const html = await mount([
    { id: 'mask', kind: 'box', x: 0, y: 0, w: 400, h: 400 },
    { id: 'bed', kind: 'audio', x: 0, y: 0, w: 200, h: 200, bg: '#00ff00', text: 'my track',
      shadow: 'box', shadowColor: '#ff0000', shadowX: 5, shadowY: 5, clip: 'mask',
      image: { id: 'lolly/loops/x', url: 'asset:lolly/loops/x' }, lane: 'seq', start: 0, dur: 2 },
  ]);
  const tag = boxTag(html, 'bed');
  assert.match(tag, /background:transparent/, 'no fill');
  assert.ok(!/box-shadow/.test(tag), 'no box-shadow — it would paint a rectangle where the bed sits');
  assert.ok(!/drop-shadow/.test(tag), 'no drop-shadow filter');
  assert.ok(!/clip-path/.test(tag), 'no clip-path');
  const inner = boxInner(html, 'bed');
  assert.ok(!/<img/.test(inner), 'no <img>');
  assert.match(inner, /<div class="lolly-box-audio"/, 'the mix marker is the only trace');
  assert.equal(inner.match(/<div class="lolly-box-text"[^>]*>([\s\S]*?)<\/div>/)![1], '', 'no text');
});

test("'content' shadow is suppressed on an audio box too, not just the box shadow", async () => {
  const html = await mount([
    { id: 'bed', kind: 'audio', x: 0, y: 0, w: 200, h: 200, shadow: 'content',
      image: { id: 'a/b.mp3', url: 'asset:a/b.mp3' }, start: 0, dur: 1 },
  ]);
  assert.ok(!/drop-shadow/.test(boxTag(html, 'bed')));
});

test('an audio FILE dropped on an ordinary image box gets the same treatment', async () => {
  // The picker allows any asset type, so this is a real user path — and the failure it
  // used to produce (a green rectangle with a label, next to an invisible Audio box)
  // is worse than either behaviour applied consistently.
  const html = await mount([
    { id: 'oops', kind: 'image', x: 0, y: 0, w: 200, h: 200, bg: '#00ff00', text: 'labelled',
      shadow: 'box', image: { id: 'uploads/voice.mp3', url: 'asset:uploads/voice.mp3' }, start: 0, dur: 2 },
  ]);
  const tag = boxTag(html, 'oops');
  assert.match(tag, /background:transparent/);
  assert.ok(!/box-shadow/.test(tag));
  const inner = boxInner(html, 'oops');
  assert.ok(!/<img/.test(inner), 'an audio file never renders as a broken <img>');
  assert.match(inner, /<div class="lolly-box-audio"/);
  assert.equal(inner.match(/<div class="lolly-box-text"[^>]*>([\s\S]*?)<\/div>/)![1], '');
});

test('a NON-audio box keeps its fill, shadow and text (the suppression is narrow)', async () => {
  const html = await mount([
    { id: 'card', kind: 'box', x: 0, y: 0, w: 200, h: 200, bg: '#00ff00', text: 'hello',
      shadow: 'box', shadowColor: '#ff0000', start: 0, dur: 2 },
  ]);
  const tag = boxTag(html, 'card');
  assert.match(tag, /background:#00ff00/);
  assert.match(tag, /box-shadow:/);
  assert.match(boxInner(html, 'card'), /hello/);
});

// ── audio boxes carry their source LENGTH, so a sound can be trimmed precisely ──
// A <video> can be asked for .duration; an audio box is a marker div and cannot.
// Without the length stamped here the panel has no media duration for a sound, so
// trimClip has nothing to clamp against (drag past the end and you get silence),
// "fit to media" cannot work, and promote falls back to a flat default instead of
// the track's own length.

/** Mount with a host whose assets report a duration, the way a real catalog entry
 *  (assets.ts lifts format.durationMs) and a real upload (probed at ingest) both do.
 *  baseHost() resolves every ref to a bare {id, url} with no meta, so an inline meta
 *  on the input is discarded by the resolver — the HOST is the only way in. */
async function mountWithAudioDuration(boxes: unknown[], durationMs: number | undefined): Promise<string> {
  const host = baseHost({
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id, type: 'audio', ...(durationMs === undefined ? {} : { meta: { durationMs } }) }) },
  } as never);
  const rt = await createRuntime(tool, host, { boxes: boxes as never } as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

test('an audio box stamps data-audio-dur from the asset metadata', async () => {
  const html = await mountWithAudioDuration(
    [{ id: 'bed', kind: 'audio', start: 0, dur: 4, image: { source: 'library', id: 'lolly/loops/x' } }],
    97130,
  );
  assert.match(html, /class="lolly-box-audio"[^>]*data-audio-dur="97130"/,
    'the source length must reach the DOM — it is the only way the panel can learn it');
});

test('an audio box with an unknown length omits the attribute rather than guessing', async () => {
  // A procedural bed has no fixed length by design; a 0/NaN/absent value must not
  // become a bogus clamp that silently truncates a trim.
  for (const ms of [undefined, 0, -1, Number.NaN]) {
    const html = await mountWithAudioDuration(
      [{ id: 'bed', kind: 'audio', start: 0, dur: 4, image: { source: 'library', id: 'zzfxm:1' } }],
      ms,
    );
    assert.doesNotMatch(html, /data-audio-dur=/, `durationMs ${String(ms)} must not stamp a length`);
  }
});

// ── detached audio: the manifest opt-in, and the markup the split produces ─────
//
// "Detach audio" is a REFERENCE, not a copy: the sound box carries the SAME asset ref
// as the video it came from — a video file's URL — and the source is muted. So two
// things have to hold in the hook, and neither is obvious:
//   1. a box that SAYS kind:'audio' renders the mix marker even when its asset is a
//      video, because that marker (`.lolly-box-audio[data-audio-src]`) is what
//      sequence-render's mixSequenceAudio keys off, and what the panel's waveform reads;
//   2. the muted source still stamps `data-t-mute="1"`, which is the only channel
//      sequence-clock has for "do not play this one's sound".

test('canvas: the A/V link sub-field is declared, and the field is panel-owned', () => {
  assert.equal(canvasCfg().linkField, 'linkOf', 'the manifest opts this tool into detach/re-attach');
  const f = boxesField().fields;
  const link = f.find((x: any) => x.id === 'linkOf');
  assert.ok(link, 'the declared sub-field exists');
  assert.deepEqual(link.showFor, [], 'machine-written, never a sidebar control');
  assert.equal(f[f.length - 1].id, 'linkOf',
    'APPENDED — `boxes` is a positional wire format, so a new field goes on the end');
});

test('a detached sound: kind audio + a VIDEO asset still renders the mix marker, and paints nothing', async () => {
  const html = await mount([
    { id: 'v', kind: 'clip', lane: 'seq', start: 0, dur: 4, mute: true, linkOf: 's',
      x: 0, y: 0, w: 400, h: 400, bg: '#00ff00',
      image: { id: 'uploads/take.mp4', url: 'asset:uploads/take.mp4', type: 'video' } },
    { id: 's', kind: 'audio', start: 0, dur: 4, linkOf: 'v',
      x: 0, y: 0, w: 400, h: 400, bg: '#00ff00', text: 'take.mp4',
      image: { id: 'uploads/take.mp4', url: 'asset:uploads/take.mp4', type: 'video' } },
  ]);
  const inner = boxInner(html, 's');
  assert.match(inner, /<div class="lolly-box-audio" data-audio-src="[^"]+"/,
    'the detached box is an AUDIO citizen even though its asset is a video');
  assert.ok(!/<video/.test(inner), 'and never a second copy of the picture');
  assert.ok(!/<img/.test(inner));
  assert.match(boxTag(html, 's'), /background:transparent/, 'a sound paints no fill');
  assert.equal(inner.match(/<div class="lolly-box-text"[^>]*>([\s\S]*?)<\/div>/)![1], '', 'and no label');

  // The source keeps its picture and is silenced by attribute — the clock's own language.
  assert.match(boxTag(html, 'v'), /data-t-mute="1"/, 'the muted source declares itself muted');
  assert.match(boxInner(html, 'v'), /<video/, 'the picture is untouched');
});
