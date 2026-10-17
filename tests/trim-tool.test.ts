// SPDX-License-Identifier: MPL-2.0
/**
 * Trim (community/trim) - prepare a clip: cut, turn, shrink, poster frame, contact
 * sheet, and the plain-English report of what was done and checked.
 *
 * Run with: node --test tests/trim-tool.test.ts
 *
 * Drives the SHIPPED hooks.js the way the engine's in-realm executor does, against a
 * fake host.media.trim that records its options and answers with a canned result:
 *   - each setting reaches the host as the documented MediaTrimOpts field,
 *   - the report becomes readable notes: copied or re-encoded tracks with the reason,
 *     where the clip starts against the key frames, sync, orientation, colour and the
 *     size limit, with failed checks marked as warnings,
 *   - an app whose host predates the report refuses a poster or contact sheet rather
 *     than hand back a clip in its place,
 *   - downloads are named for what they hold,
 *   - the template shows the controls each mode needs and renders the notes,
 *   - every control in the template is a manifest input, and no input id collides with
 *     a reserved URL parameter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RESERVED } from '../engine/src/url-mode.ts';
import { hydrate } from '../engine/src/template.ts';
import type { MediaTrimOpts, MediaTrimReport, MediaTrimResult } from '../packages/core/src/host-v1.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'trim');
const hooksSource = readFileSync(join(DIR, 'hooks.js'), 'utf8');
const templateSource = readFileSync(join(DIR, 'template.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8')) as { inputs: Array<{ id: string; default?: unknown }> };

interface Note { label: string; text: string; warn?: boolean }
interface Patch { error: string; done: boolean; methodText: string; notes: Note[]; sizeText: string; downloadLabel: string; isPoster: boolean }
interface Hooks {
  onInput: (ctx: unknown) => Promise<Patch>;
  exportFile: (ctx: unknown) => Promise<{ bytes: Uint8Array; mime: string; filename: string }>;
}

function loadHooks(): Hooks {
  const factory = new Function('host', `${hooksSource}; return { onInput, exportFile };`);
  return factory({ log: () => {} }) as Hooks;
}

function model(values: Record<string, unknown>): Array<{ id: string; value: unknown }> {
  const base: Record<string, unknown> = Object.fromEntries(manifest.inputs.map((i) => [i.id, i.default]));
  base.source = { name: 'holiday.mp4', mime: 'video/mp4', size: 4, url: 'blob:x', bytes: new Uint8Array(4) };
  return Object.entries({ ...base, ...values }).map(([id, value]) => ({ id, value }));
}

function fakeHost(answer: (opts: MediaTrimOpts) => MediaTrimResult) {
  const calls: MediaTrimOpts[] = [];
  return { calls, host: { media: { trim: async (_bytes: Uint8Array, opts: MediaTrimOpts) => { calls.push(opts); return answer(opts); } } } };
}

function clip(report?: Partial<MediaTrimReport>, over: Partial<MediaTrimResult> = {}): MediaTrimResult {
  return {
    bytes: new Uint8Array(2048), mime: 'video/mp4', container: 'mp4', durationBefore: 10, durationAfter: 4, lossless: true,
    report: report ? { method: 'copy', requestedStart: 2, actualStart: 2, keyFrameGap: 0, tracks: [], ...report } : undefined,
    ...over,
  };
}

async function run(values: Record<string, unknown>, answer: (opts: MediaTrimOpts) => MediaTrimResult) {
  const { calls, host } = fakeHost(answer);
  const patch = await loadHooks().onInput({ model: model(values), host });
  return { patch, opts: calls[0]! };
}

test('each setting reaches host.media.trim as its MediaTrimOpts field', async () => {
  const shared = { start: 2, end: 6, rotate: '90' };
  const a = await run({ ...shared, cut: 'keyframe', shareSize: '720', maxMB: 8 }, () => clip({}));
  assert.equal(a.opts.cut, 'keyframe');
  assert.equal(a.opts.maxShortEdge, 720);
  assert.equal(a.opts.targetBytes, 8 * 1048576);
  assert.equal(a.opts.rotate, 90);
  assert.equal(a.opts.output, undefined, 'a clip is the default output');

  const poster = await run({ ...shared, make: 'poster', imageFormat: 'png' }, () => clip({ method: 'frames' }, { mime: 'image/png', container: 'png' }));
  assert.deepEqual([poster.opts.output, poster.opts.image, poster.opts.cut, poster.opts.maxShortEdge], ['poster', 'png', undefined, undefined]);
  assert.equal(poster.opts.end, undefined, 'a poster has no end point to clash with its start');

  const sheet = await run({ ...shared, make: 'sheet', frames: '16' }, () => clip({ method: 'frames' }, { mime: 'image/jpeg', container: 'jpg', frameCount: 16 }));
  assert.deepEqual([sheet.opts.output, sheet.opts.sheetFrames, sheet.opts.image], ['contact-sheet', 16, 'jpeg']);
  assert.equal(sheet.patch.downloadLabel, 'Download contact sheet');
});

test('a copy report reads as a fast copy with each track and check in plain words', async () => {
  const { patch } = await run({ start: 2, end: 6 }, () => clip({
    tracks: [
      { kind: 'video', codec: 'avc', outputCodec: 'avc', action: 'copy', reasons: [] },
      { kind: 'audio', codec: 'aac', outputCodec: 'aac', action: 'copy', reasons: [] },
      { kind: 'other', codec: null, outputCodec: null, action: 'drop', reasons: ['not-primary'] },
    ],
    sync: { startSkew: 0, expectedStartSkew: 0, endSkew: 0.01, expectedEndSkew: 0, tolerance: 0.034, method: 'packets', ok: true },
    orientation: { requested: 0, sourceRotation: 90, outputRotation: 90, method: 'none', width: 1080, height: 1920, expectedWidth: 1080, expectedHeight: 1920, ok: true },
    color: { source: 'bt709', output: 'bt709', kept: true },
    size: { width: 1080, height: 1920 },
  }));
  assert.equal(patch.error, '');
  assert.equal(patch.methodText, 'Fast copy: no re-encode, no quality lost');
  assert.equal(patch.sizeText, '1080 × 1920');
  const text = Object.fromEntries(patch.notes.map((n) => [n.label + (n.warn ? '!' : ''), n.text]));
  assert.equal(patch.notes[0]!.text, 'H.264 copied, packets unchanged');
  assert.match(patch.notes[2]!.text, /left out: only the main picture and sound are kept/);
  assert.match(text.Sync!, /packet for packet/);
  assert.equal(text.Orientation, 'Kept the source orientation (90°).');
  assert.equal(text.Colour, 'Colour information kept (bt709).');
  assert.ok(!patch.notes.some((n) => n.warn), 'nothing failed, so nothing is a warning');
});

test('re-encodes say why, and an exact cut between key frames offers the fast cut', async () => {
  const { patch } = await run({ start: 2.53, end: 6, container: 'webm', rotate: '90' }, () => clip({
    method: 'mixed', requestedStart: 2.53, actualStart: 2.53, keyFrameGap: 0.53,
    tracks: [
      { kind: 'video', codec: 'avc', outputCodec: 'vp9', action: 're-encode', reasons: ['cut-between-key-frames', 'codec-not-in-container', 'rotation-needs-pixels'] },
      { kind: 'audio', codec: 'opus', outputCodec: 'opus', action: 'copy', reasons: [] },
    ],
    orientation: { requested: 90, sourceRotation: 0, outputRotation: 0, method: 'pixels', width: 720, height: 1280, expectedWidth: 720, expectedHeight: 1280, ok: true },
  }, { container: 'webm', lossless: false }));
  assert.equal(patch.methodText, 'Partly re-encoded');
  assert.equal(patch.notes[0]!.text, 'H.264 re-encoded to VP9 because the start falls 0.53s after the nearest key frame; WebM cannot carry H.264; WebM has no orientation setting, so the turn is drawn into the picture');
  assert.ok(patch.notes.some((n) => n.label === 'Start' && /A fast cut would start 0.53s earlier/.test(n.text)));
  assert.ok(patch.notes.some((n) => n.label === 'Orientation' && /by drawing the turn into the picture/.test(n.text)));
});

test('a fast cut says where the clip really starts', async () => {
  const { patch } = await run({ start: 2.6, end: 6, cut: 'keyframe' }, () => clip({ requestedStart: 2.6, actualStart: 2, keyFrameGap: 0.6 }));
  assert.ok(patch.notes.some((n) => n.label === 'Start' && n.text === 'Starts at 2.00s, the key frame 0.60s before your start point.'));
});

test('failed checks are warnings with the measured numbers', async () => {
  const { patch } = await run({ start: 0, end: 6, maxMB: 1 }, () => clip({
    method: 're-encode',
    sync: { startSkew: 0.12, expectedStartSkew: 0, endSkew: 0, expectedEndSkew: 0, tolerance: 0.034, method: 'ranges', ok: false },
    orientation: { requested: 0, sourceRotation: 0, outputRotation: 0, method: 'none', width: 1080, height: 1920, expectedWidth: 1920, expectedHeight: 1080, ok: false },
    color: { source: 'bt2020 pq bt2020-ncl', output: 'bt709', kept: false },
    target: { bytes: 1048576, met: false, attempts: 2 },
  }));
  const warnings = patch.notes.filter((n) => n.warn).map((n) => n.label);
  assert.deepEqual(warnings, ['Check sync', 'Check orientation', 'Colour', 'Size limit']);
  assert.match(patch.notes.find((n) => n.label === 'Check sync')!.text, /starts 120 ms after the picture \(source: with the picture\)/);
  assert.match(patch.notes.find((n) => n.label === 'Size limit')!.text, /Still over the 1.0 MB limit after 2 attempts/);
});

test('a host without the report refuses a poster instead of returning a clip', async () => {
  const old = await run({ make: 'poster' }, () => clip(undefined));
  assert.match(old.patch.error, /cannot make poster frames or contact sheets yet/);
  const plain = await run({ start: 1 }, () => clip(undefined));
  assert.equal(plain.patch.error, '');
  assert.match(plain.patch.notes[0]!.text, /does not report how the clip was made/);
});

test('host errors lose their internal prefix', async () => {
  const { host } = fakeHost(() => { throw new Error('media trim: the opus sound would be left out because this browser cannot decode it.'); });
  const patch = await loadHooks().onInput({ model: model({}), host });
  assert.equal(patch.error, 'The opus sound would be left out because this browser cannot decode it.');
});

test('downloads are named for what they hold', async () => {
  const name = async (values: Record<string, unknown>, result: MediaTrimResult) => {
    const { host } = fakeHost(() => result);
    return (await loadHooks().exportFile({ model: model(values), host })).filename;
  };
  assert.equal(await name({}, clip({})), 'holiday-trimmed.mp4');
  assert.equal(await name({ make: 'poster' }, clip({ method: 'frames' }, { container: 'jpg', mime: 'image/jpeg' })), 'holiday-poster.jpg');
  assert.equal(await name({ make: 'sheet', imageFormat: 'png' }, clip({ method: 'frames' }, { container: 'png', mime: 'image/png' })), 'holiday-contact-sheet.png');
});

test('every template control is a manifest input and no input id is a reserved URL parameter', () => {
  const ids = new Set(manifest.inputs.map((i) => i.id));
  const markup = templateSource.slice(0, templateSource.indexOf('<script>'));
  const controls = [...markup.matchAll(/data-input-id="([^"]+)"/g)].map((m) => m[1]!);
  for (const id of controls) assert.ok(ids.has(id), `template control ${id} has no manifest input`);
  for (const id of ids) assert.ok(!RESERVED.has(id), `input ${id} collides with a reserved URL parameter`);
  for (const id of ['make', 'cut', 'rotate', 'shareSize', 'maxMB', 'frames', 'imageFormat']) assert.ok(controls.includes(id), `${id} has a control`);
});

test('the template shows the controls each mode needs and renders the report', async () => {
  const render = async (values: Record<string, unknown>, answer: (opts: MediaTrimOpts) => MediaTrimResult) => {
    const { patch } = await run(values, answer);
    const inputs = Object.fromEntries(model(values).map(({ id, value }) => [id, value]));
    return hydrate(templateSource.slice(0, templateSource.indexOf('<script>')), { ...inputs, ...patch });
  };
  const controls = (html: string) => [...html.matchAll(/data-input-id="([^"]+)"/g)].map((m) => m[1]);
  const copy = clip({
    tracks: [{ kind: 'video', codec: 'avc', outputCodec: 'avc', action: 'copy', reasons: [] }],
    sync: { startSkew: 0.2, expectedStartSkew: 0, endSkew: 0, expectedEndSkew: 0, tolerance: 0.034, method: 'ranges', ok: false },
  });
  const clipHtml = await render({ start: 1 }, () => copy);
  assert.deepEqual(controls(clipHtml), ['make', 'start', 'end', 'container', 'audioOnly', 'cut', 'shareSize', 'maxMB', 'rotate', 'mute']);
  assert.match(clipHtml, /<dt>Picture<\/dt><dd>H.264 copied, packets unchanged<\/dd>/);
  assert.match(clipHtml, /<div class="warn"><dt>Check sync<\/dt>/);
  assert.match(clipHtml, />Download clip</);

  const posterHtml = await render({ make: 'poster', start: 3 }, () => clip({ method: 'frames' }, { container: 'jpg', mime: 'image/jpeg' }));
  assert.deepEqual(controls(posterHtml), ['make', 'start', 'rotate', 'imageFormat']);
  assert.match(posterHtml, /Poster frame at \(seconds\)/);
  assert.ok(!posterHtml.includes('data-play-range'), 'a single frame has no range to play');

  const sheetHtml = await render({ make: 'sheet' }, () => clip({ method: 'frames' }, { container: 'jpg', mime: 'image/jpeg', frameCount: 12 }));
  assert.deepEqual(controls(sheetHtml), ['make', 'start', 'end', 'rotate', 'frames', 'imageFormat']);

  const gifHtml = await render({ container: 'gif' }, () => clip({ method: 'frames' }, { container: 'gif', mime: 'image/gif' }));
  assert.ok(!controls(gifHtml).includes('cut') && controls(gifHtml).includes('rotate'), 'a GIF can turn but has no key frames to cut on');
});
