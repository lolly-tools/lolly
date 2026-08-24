// SPDX-License-Identifier: MPL-2.0
/**
 * Auto-caption wire-ins for the recording tools (plans/147 E7).
 *
 * `render.transcribe` (engine 1.150) is a declaration, not a feature: a tool
 * names the asset input holding its clip and the text input the cues go into,
 * and the shell owns everything between. This suite loads the REAL packs and
 * pins three things per tool.
 *
 *  1. The declaration is WELL FORMED - both named ids exist, the source really
 *     is an asset input and the target really is a text one. A typo here means
 *     the shell silently mounts nothing, which is the one failure mode a user
 *     would never diagnose.
 *  2. The transcript actually drives cues. Every tool reads its SRT through the
 *     shared `cues` region (community/_shared/captions.js), so the same file
 *     must produce the same cues in every one of them, and the cue on screen at
 *     `t` must follow the engine's [start, end) rule. A sidecar is timed against
 *     the EXPORTED file, so the two bookend recorders shift their cues past the
 *     intro card their compositor plays first (INTRO_SEC below).
 *  3. The two recording tools that are deliberately NOT wired stay diagnosable.
 *     voice-recorder and screencap never write their take to an input (the
 *     recorder hands the bytes straight to a download bar), so there is no
 *     source to name. The assertions below fail the moment that changes, which
 *     is exactly when the declaration should be added.
 *
 * Run with: node --test tests/recording-captions.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { cueAt, cuesToSrt, cuesToVtt } from '../engine/src/captions.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMUNITY = join(ROOT, 'community');
const SUSE = join(ROOT, 'brands', 'suse', 'tools');

// Load from the SOURCE packs, never the gitignored tools/ profile view, so the
// suite is profile-independent. A pack that is not checked out skips; a pack
// that IS checked out but missing the tool fails loudly (a rename or a delete).
const communityFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');
const suseFile = (path: string) => readFile(join(SUSE, path), 'utf8');

const HAS_COMMUNITY = existsSync(COMMUNITY);
const HAS_SUSE = existsSync(SUSE);

interface AnyTool {
  manifest: {
    id: string;
    version: string;
    render: { formats?: string[]; transcribe?: { source: string; target: string; format?: string; auto?: string } };
    inputs?: { id: string; type: string; assetType?: string; default?: unknown }[];
  };
  textTemplates?: Record<string, string>;
}

async function load(id: string, root: string, fetchFile: (p: string) => Promise<string>): Promise<AnyTool> {
  assert.ok(existsSync(join(root, id, 'tool.json')),
    `${root}/${id}/tool.json is missing - the pack is mounted, so the tool was renamed or deleted`);
  return (await loadTool(id, fetchFile)) as unknown as AnyTool;
}

/** Two cues, deliberately with a gap between them so silence is testable. */
const SRT = [
  '1',
  '00:00:00,500 --> 00:00:02,000',
  'We started with one question.',
  '',
  '2',
  '00:00:03,000 --> 00:00:05,500',
  'What would you build if nothing had to scale?',
  '',
].join('\n');

const WANT = [
  { start: 0.5, end: 2, text: 'We started with one question.' },
  { start: 3, end: 5.5, text: 'What would you build if nothing had to scale?' },
];

/**
 * A transcript is timed against the CLIP, and the two bookend recorders composite
 * an intro card in front of it (export.ts renderTopTail / renderRecord both start
 * the body at introMs), so their sidecars carry that shift or the subtitles run
 * early against the exported file. Audiogram has no bookend, so it shifts by
 * nothing; top-tail's intro is template.html's data-intro-ms, record's is its own
 * `introMs` input.
 */
const INTRO_SEC: Record<string, number> = { audiogram: 0, 'top-tail-recorder': 1.6, record: 2.2 };
const shifted = (by: number) => WANT.map((c) => ({ ...c, start: c.start + by, end: c.end + by }));

// ── 1. the declaration ──────────────────────────────────────────────────────

const WIRED: { id: string; root: string; fetch: (p: string) => Promise<string>; mounted: boolean }[] = [
  { id: 'audiogram', root: COMMUNITY, fetch: communityFile, mounted: HAS_COMMUNITY },
  { id: 'record', root: COMMUNITY, fetch: communityFile, mounted: HAS_COMMUNITY },
  { id: 'captions', root: COMMUNITY, fetch: communityFile, mounted: HAS_COMMUNITY },
  { id: 'top-tail-recorder', root: SUSE, fetch: suseFile, mounted: HAS_SUSE },
];

for (const pack of WIRED) {
  test(`${pack.id}: render.transcribe names inputs that exist and are the right types`, {
    skip: pack.mounted ? false : 'pack not mounted (clone without submodules)',
  }, async () => {
    const tool = await load(pack.id, pack.root, pack.fetch);
    const spec = tool.manifest.render.transcribe;
    assert.ok(spec, `${pack.id} declares no render.transcribe`);
    const byId = new Map((tool.manifest.inputs ?? []).map((i) => [i.id, i]));

    const source = byId.get(spec.source);
    assert.ok(source, `render.transcribe.source "${spec.source}" is not a declared input`);
    assert.equal(source.type, 'asset', 'the source must be the asset input holding the clip');

    const target = byId.get(spec.target);
    assert.ok(target, `render.transcribe.target "${spec.target}" is not a declared input`);
    assert.ok(target.type === 'longtext' || target.type === 'text',
      `the target must take text, not ${target.type}`);

    // `auto` is optional, but a named one must be a boolean the user can turn off.
    if (spec.auto) {
      const auto = byId.get(spec.auto);
      assert.ok(auto, `render.transcribe.auto "${spec.auto}" is not a declared input`);
      assert.equal(auto.type, 'boolean');
      assert.notEqual(auto.default, true,
        'auto-caption defaults OFF: a model download is never started without asking');
    }
  });
}

test('the transcript input takes a subtitle file through the plan 87 data-source affordance', {
  skip: HAS_COMMUNITY ? false : 'community pack not mounted',
}, async () => {
  for (const id of ['audiogram', 'record', 'captions']) {
    const tool = await load(id, COMMUNITY, communityFile);
    const target = (tool.manifest.inputs ?? []).find((i) => i.id === tool.manifest.render.transcribe!.target);
    const accept = String((target as { dataSource?: { accept?: string } } | undefined)?.dataSource?.accept ?? '');
    assert.match(accept, /\.srt/, `${id}: the transcript input should accept an .srt drop`);
    assert.match(accept, /\.vtt/, `${id}: the transcript input should accept a .vtt drop`);
  }
});

// ── 2. the cues ─────────────────────────────────────────────────────────────

test('audiogram turns a transcript into the cues its caption layer draws', {
  skip: HAS_COMMUNITY ? false : 'community pack not mounted',
}, async () => {
  const tool = await load('audiogram', COMMUNITY, communityFile);
  const rt = await createRuntime(tool as never, baseHost(), { transcript: SRT } as never);
  const cues = JSON.parse(rt.getHydratedString('{{{agCues}}}') as string) as { t0: number; t1: number; text: string }[];
  assert.deepEqual(cues, WANT.map((c) => ({ t0: c.start, t1: c.end, text: c.text })));

  // One cue at a time, on the engine's [start, end) rule: at 2.0 the first cue
  // has left and the second has not arrived.
  const asCues = cues.map((c) => ({ start: c.t0, end: c.t1, text: c.text }));
  assert.equal(cueAt(asCues, 0.4), null);
  assert.equal(cueAt(asCues, 0.5)?.text, WANT[0]!.text);
  assert.equal(cueAt(asCues, 1.999)?.text, WANT[0]!.text);
  assert.equal(cueAt(asCues, 2), null, 'a cue has left at exactly its out-point');
  assert.equal(cueAt(asCues, 3.2)?.text, WANT[1]!.text);
  assert.equal(cueAt(asCues, 9), null);
});

test('audiogram shifts transcript cues onto the in-point and drops what already finished', {
  skip: HAS_COMMUNITY ? false : 'community pack not mounted',
}, async () => {
  const tool = await load('audiogram', COMMUNITY, communityFile);
  const rt = await createRuntime(tool as never, baseHost(), { transcript: SRT, start: 2.5 } as never);
  const cues = JSON.parse(rt.getHydratedString('{{{agCues}}}') as string) as { t0: number; t1: number }[];
  assert.equal(cues.length, 1, 'the first cue ended before the in-point');
  assert.equal(cues[0]!.t0, 0.5);
  assert.equal(cues[0]!.t1, 3);
});

test('audiogram leaves the captions toggle in charge', {
  skip: HAS_COMMUNITY ? false : 'community pack not mounted',
}, async () => {
  const tool = await load('audiogram', COMMUNITY, communityFile);
  const off = await createRuntime(tool as never, baseHost(), { transcript: SRT, captions: false } as never);
  assert.equal(off.getHydratedString('{{{agCues}}}'), '', 'captions off means no cues, transcript or not');
  const none = await createRuntime(tool as never, baseHost(), {} as never);
  assert.equal(none.getHydratedString('{{{agCues}}}'), '',
    'no transcript and no word timings still means no cues');
});

test('audiogram splits a cue too long for its two-line caption plate', {
  skip: HAS_COMMUNITY ? false : 'community pack not mounted',
}, async () => {
  const tool = await load('audiogram', COMMUNITY, communityFile);
  // 100+ characters: more than the two 42-character lines the layer wraps to.
  const long = [
    '1',
    '00:00:00,000 --> 00:00:10,000',
    'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen',
    '',
  ].join('\n');
  const rt = await createRuntime(tool as never, baseHost(), { transcript: long } as never);
  const cues = JSON.parse(rt.getHydratedString('{{{agCues}}}') as string) as { t0: number; t1: number; text: string }[];
  assert.ok(cues.length > 1, 'an over-long cue is split, not left to overflow the frame');
  for (const c of cues) assert.ok(c.text.length <= 84, `"${c.text}" is still wider than two lines`);
  assert.equal(cues[0]!.t0, 0, 'the split keeps the original in-point');
  assert.equal(cues[cues.length - 1]!.t1, 10, 'and the original out-point');
  // No gaps and no overlaps: each piece hands straight over to the next.
  for (let i = 1; i < cues.length; i++) assert.equal(cues[i]!.t0, cues[i - 1]!.t1);
  assert.equal(cues.map((c) => c.text).join(' ').split(' ').length, 17, 'every word survives the split');
});

test('every wired tool reads one transcript the same way', {
  skip: HAS_COMMUNITY && HAS_SUSE ? false : 'both packs are needed to compare them',
}, async () => {
  const audiogram = await load('audiogram', COMMUNITY, communityFile);
  const captions = await load('captions', COMMUNITY, communityFile);
  const topTail = await load('top-tail-recorder', SUSE, suseFile);

  // Each tool exposes the parse under its own extra names; the SRT they write
  // back is the common denominator, and it is the engine's own serialisation.
  // Only the bookend recorders move the cues, and only by their intro.
  const agRt = await createRuntime(audiogram as never, baseHost(), { transcript: SRT } as never);
  assert.equal(agRt.getHydratedString('{{{agSrt}}}'), cuesToSrt(WANT), 'audiogram');
  const capRt = await createRuntime(captions as never, baseHost(), { transcript: SRT } as never);
  assert.equal(capRt.getHydratedString('{{{srtText}}}'), cuesToSrt(WANT), 'captions');
  const ttRt = await createRuntime(topTail as never, baseHost(), { transcript: SRT } as never);
  assert.equal(ttRt.getHydratedString('{{{ttSrt}}}'), cuesToSrt(shifted(INTRO_SEC['top-tail-recorder']!)),
    'top-tail-recorder');
});

test('a bookend recorder times its sidecar against the composited video, not the raw take', {
  skip: HAS_COMMUNITY && HAS_SUSE ? false : 'both packs are needed',
}, async () => {
  // record's intro is an input, so the shift follows whatever the user set - the
  // one thing a fixed constant in the hook could never get right.
  const rec = await load('record', COMMUNITY, communityFile);
  const dflt = await createRuntime(rec as never, baseHost(), { transcript: SRT } as never);
  assert.equal(dflt.getHydratedString('{{{recSrt}}}'), cuesToSrt(shifted(INTRO_SEC['record']!)),
    'the default 2200 ms intro');
  const longer = await createRuntime(rec as never, baseHost(), { transcript: SRT, introMs: 4000 } as never);
  assert.equal(longer.getHydratedString('{{{recSrt}}}'), cuesToSrt(shifted(4)), 'a longer intro card');
  // Out of range is clamped to the same ceiling the compositor is handed.
  const silly = await createRuntime(rec as never, baseHost(), { transcript: SRT, introMs: 99999 } as never);
  assert.equal(silly.getHydratedString('{{{recSrt}}}'), cuesToSrt(shifted(8)), 'clamped to the 8 s ceiling');

  // top-tail's intro is a constant in its template, so the hook mirrors it. If
  // this fails, data-intro-ms moved and the hook's INTRO_SEC did not.
  const tpl = await suseFile('top-tail-recorder/template.html');
  assert.match(tpl, new RegExp(`data-intro-ms="${INTRO_SEC['top-tail-recorder']! * 1000}"`));
});

test('the sidecar templates hydrate the cues that are on screen', {
  skip: HAS_COMMUNITY && HAS_SUSE ? false : 'both packs are needed',
}, async () => {
  const cases: [AnyTool, string][] = [
    [await load('audiogram', COMMUNITY, communityFile), 'audiogram'],
    [await load('record', COMMUNITY, communityFile), 'record'],
    [await load('top-tail-recorder', SUSE, suseFile), 'top-tail-recorder'],
  ];
  for (const [tool, id] of cases) {
    for (const ext of ['srt', 'vtt']) {
      assert.ok(tool.manifest.render.formats?.includes(ext), `${id} does not export .${ext}`);
      assert.equal(typeof tool.textTemplates?.[ext], 'string', `${id}: template.${ext} did not load`);
    }
    const want = shifted(INTRO_SEC[id]!);
    const rt = await createRuntime(tool as never, baseHost(), { transcript: SRT } as never);
    const srt = rt.getHydratedString(tool.textTemplates!.srt!) as string;
    const vtt = rt.getHydratedString(tool.textTemplates!.vtt!) as string;
    assert.equal(srt, cuesToSrt(want), `${id} .srt`);
    assert.ok(vtt.startsWith('WEBVTT\n'), `${id} .vtt has no header`);
    assert.ok(vtt.includes(cuesToVtt(want).split('\n')[2]!), `${id} .vtt timings`);
    // An empty transcript writes an EMPTY file, never a lonely header or newline.
    const empty = await createRuntime(tool as never, baseHost(), { transcript: '' } as never);
    assert.equal(empty.getHydratedString(tool.textTemplates!.srt!), '', `${id} empty .srt`);
    assert.equal(empty.getHydratedString(tool.textTemplates!.vtt!), '', `${id} empty .vtt`);
  }
});

test('every wired tool still mounts and renders - defaults and each example', {
  skip: HAS_COMMUNITY && HAS_SUSE ? false : 'both packs are needed',
}, async () => {
  for (const pack of WIRED) {
    const tool = await load(pack.id, pack.root, pack.fetch);
    const examples = ((tool.manifest as { examples?: { label: string; values: Record<string, unknown> }[] }).examples) ?? [];
    for (const seed of [{ label: 'defaults', values: {} }, ...examples]) {
      const noisy: string[] = [];
      const host = baseHost({
        log: (level: string, msg: string) => { if (level === 'warn' || level === 'error') noisy.push(`${level}: ${msg}`); },
      });
      const rt = await createRuntime(tool as never, host, seed.values as never);
      const html = rt.getHydrated() as string;
      assert.deepEqual(noisy, [], `${pack.id} / ${seed.label} logged a hook failure`);
      assert.ok(html.trim().length > 0, `${pack.id} / ${seed.label} rendered nothing`);
    }
  }
});

// ── 3. the two that are deliberately not wired ──────────────────────────────
//
// Both record their take straight to a download bar rather than into an input
// (shells/web/src/views/record-control.ts's audio branch, and
// screen-capture-control.ts's offerClip), so render.transcribe has no source to
// name. These assertions are the reminder: when a take finally reaches an input,
// wire the declaration in the same edit.

test('voice-recorder has no asset input for its take, so it declares no transcribe', {
  skip: HAS_SUSE ? false : 'suse pack not mounted',
}, async () => {
  const tool = await load('voice-recorder', SUSE, suseFile);
  assert.equal(tool.manifest.render.transcribe, undefined);
  const assets = (tool.manifest.inputs ?? []).filter((i) => i.type === 'asset');
  assert.deepEqual(assets, [],
    'a take now reaches an input - declare render.transcribe against it (plans/147 E7)');
});

test('screencap holds a still, not the screen recording, so it declares no transcribe', {
  skip: HAS_COMMUNITY ? false : 'community pack not mounted',
}, async () => {
  const tool = await load('screencap', COMMUNITY, communityFile);
  assert.equal(tool.manifest.render.transcribe, undefined);
  const assets = (tool.manifest.inputs ?? []).filter((i) => i.type === 'asset');
  assert.deepEqual(assets.map((i) => [i.id, i.assetType]), [['shot', 'raster']],
    'the recording now reaches an input - declare render.transcribe against it (plans/147 E7)');
});
