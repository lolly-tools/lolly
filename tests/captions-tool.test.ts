// SPDX-License-Identifier: MPL-2.0
/**
 * Captions (community/captions) - parse, pick and re-serialise contract.
 *
 * The TOOL's suite. tests/captions.test.ts next door is the ENGINE's
 * (groupWordsToCues / cuesToSrt / cuesToVtt / cueAt); this one drives the
 * community pack that consumes them.
 *
 * Loads the REAL tool from the community pack (manifest + template + hooks +
 * the .srt / .vtt / .json siblings) and drives it through the engine with the
 * shared baseHost. So the assertions below check what the tool actually
 * renders and exports, not a fixture of it.
 *
 * What is pinned here:
 *  - SRT and WebVTT both parse, in every dialect the wild throws at them
 *    (CRLF, a byte-order mark, optional cue ids, comma or dot milliseconds, a
 *    missing hours field, the WEBVTT header, NOTE blocks, inline tags, cue
 *    settings after the out-point);
 *  - a file whose cues run backwards, overlap or arrive out of order is
 *    reported rather than silently rewritten;
 *  - the cue on screen at `t` follows the engine's [start, end) rule;
 *  - the re-serialised sidecars are byte-identical to the engine's own
 *    cuesToSrt / cuesToVtt, which is the whole reason the hook mirrors them;
 *  - every example, template seed and preset overlay mounts and draws;
 *  - an empty transcript gives the friendly empty state and EMPTY sidecars,
 *    never a lonely "WEBVTT" header.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/captions-tool.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { cuesToSrt, cuesToVtt } from '../engine/src/captions.ts';
import { baseHost } from './helpers/host.ts';

// Load from the SOURCE pack, not the gitignored tools/ profile view, so the
// suite is profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'captions', 'tool.json')),
    'community/captions/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('captions', fetchFile);

async function mount(state: Record<string, unknown>) {
  return createRuntime(tool, baseHost(), state as Record<string, any>);
}

async function render(state: Record<string, unknown>): Promise<string> {
  return (await mount(state)).getHydrated() as string;
}

/** The parsed cues, straight off the hook's own JSON extra. */
async function cuesOf(state: Record<string, unknown>): Promise<Array<{ start: number; end: number; text: string }>> {
  const rt = await mount(state);
  return JSON.parse(rt.getHydratedString('{{{cuesJson}}}') as string);
}

/** A sidecar exactly as the export writes it. */
async function sidecar(state: Record<string, unknown>, ext: 'srt' | 'vtt' | 'json'): Promise<string> {
  const rt = await mount(state);
  return rt.getHydratedString(tool.textTemplates[ext]) as string;
}

async function warningsOf(state: Record<string, unknown>): Promise<string[]> {
  const rt = await mount(state);
  return JSON.parse(rt.getHydratedString('{{{warningsJson}}}') as string);
}

// Three plain SubRip cues, LF, numbered, comma milliseconds.
const SRT = [
  '1',
  '00:00:00,200 --> 00:00:02,400',
  'Captions are how most people meet your work.',
  '',
  '2',
  '00:00:02,600 --> 00:00:05,000',
  'Drop in an SRT file, or transcribe on device.',
  '',
  '3',
  '00:00:05,200 --> 00:00:07,800',
  'Nothing is uploaded, and nothing is invented.',
  '',
].join('\n');

test('SRT parses into ordered cues with clean text', { skip: SKIP }, async () => {
  const cues = await cuesOf({ transcript: SRT });
  assert.equal(cues.length, 3);
  assert.deepEqual(cues[0], { start: 0.2, end: 2.4, text: 'Captions are how most people meet your work.' });
  assert.equal(cues[2]?.start, 5.2);
  assert.equal(cues[2]?.end, 7.8);
  assert.deepEqual(await warningsOf({ transcript: SRT }), [], 'a clean file warns about nothing');
});

test('every SRT and VTT dialect produces the same three cues', { skip: SKIP }, async () => {
  const want = await cuesOf({ transcript: SRT });

  // CRLF line endings and a byte-order mark - what a Windows editor writes.
  const crlf = '\uFEFF' + SRT.replace(/\n/g, '\r\n');
  assert.deepEqual(await cuesOf({ transcript: crlf }), want, 'CRLF and a BOM must not change a single cue');

  // No cue ids at all, which SubRip players tolerate and WebVTT does not need.
  const noIds = SRT.replace(/^[123]\n/gm, '');
  assert.deepEqual(await cuesOf({ transcript: noIds }), want, 'cue ids are optional');

  // WebVTT: header, a NOTE block, dot milliseconds, a cue setting after the
  // out-point, a named-voice tag and a bold tag in the payload.
  const vtt = [
    'WEBVTT',
    'Kind: captions',
    '',
    'NOTE This block is a comment and must be skipped.',
    '',
    'intro',
    '00:00:00.200 --> 00:00:02.400 line:90%',
    '<v Ana>Captions are how most people <b>meet</b> your work.',
    '',
    '00:00:02.600 --> 00:00:05.000',
    'Drop in an SRT file, or transcribe on device.',
    '',
    '00:00:05.200 --> 00:00:07.800',
    'Nothing is uploaded, and nothing is invented.',
  ].join('\n');
  assert.deepEqual(await cuesOf({ transcript: vtt }), want,
    'a WebVTT file with a header, a NOTE, tags and cue settings reads the same as its SubRip twin');

  // A two-part timestamp (no hours) and one-digit fractions, both legal WebVTT.
  const short = 'WEBVTT\n\n00:01.5 --> 00:03.25\nHalf a second in.\n';
  assert.deepEqual(await cuesOf({ transcript: short }), [{ start: 1.5, end: 3.25, text: 'Half a second in.' }]);

  // A cue split over two lines collapses to one, exactly as the shell's
  // formatter does: a blank line inside a payload would split the cue block.
  const wrapped = '1\n00:00:00,000 --> 00:00:02,000\nOne line\nand its second half\n';
  assert.deepEqual(await cuesOf({ transcript: wrapped }),
    [{ start: 0, end: 2, text: 'One line and its second half' }]);

  // Entities decode, and &amp; goes last so an escaped entity survives.
  const ents = '1\n00:00:00,000 --> 00:00:01,000\nBread &amp; butter &amp;lt;still escaped&amp;gt;\n';
  assert.equal((await cuesOf({ transcript: ents }))[0]?.text, 'Bread & butter &lt;still escaped&gt;');
});

test('a file that is out of order, overlapping or backwards is reported, not rewritten', { skip: SKIP }, async () => {
  const overlap = [
    '1', '00:00:00,000 --> 00:00:04,000', 'First',
    '', '2', '00:00:02,000 --> 00:00:06,000', 'Second starts before the first ends',
    '',
  ].join('\n');
  const w = await warningsOf({ transcript: overlap });
  assert.ok(w.some(s => s.includes('1 cue overlaps the one before it.')), `no overlap warning in ${JSON.stringify(w)}`);
  const kept = await cuesOf({ transcript: overlap });
  assert.equal(kept.length, 2, 'an overlapping cue is kept, the file belongs to its author');
  assert.equal(kept[1]?.start, 2);

  const unordered = [
    '1', '00:00:04,000 --> 00:00:06,000', 'Later',
    '', '2', '00:00:01,000 --> 00:00:02,000', 'Earlier',
    '',
  ].join('\n');
  const w2 = await warningsOf({ transcript: unordered });
  assert.ok(w2.some(s => s.includes('1 cue starts before the one before it.')), `no order warning in ${JSON.stringify(w2)}`);
  assert.deepEqual((await cuesOf({ transcript: unordered })).map(c => c.start), [4, 1],
    'source order is kept, so the author decides what to fix');

  const backwards = '1\n00:00:05,000 --> 00:00:02,000\nEnds before it starts\n';
  assert.ok((await warningsOf({ transcript: backwards })).some(s => s.includes('1 cue ends before it starts.')));

  // A timing line nobody can read is counted, and the rest of the file survives.
  const broken = [
    '1', '00:00:00,000 --> 00:00:02,000', 'Good',
    '', '2', 'not a timestamp --> nor is this', 'Bad',
    '',
  ].join('\n');
  const w3 = await warningsOf({ transcript: broken });
  assert.ok(w3.some(s => s.includes('1 block was skipped')), `no malformed warning in ${JSON.stringify(w3)}`);
  assert.equal((await cuesOf({ transcript: broken })).length, 1, 'one bad block must not lose the good ones');

  // Plain prose (a .txt dropped into the field) has no timings at all.
  const prose = await warningsOf({ transcript: 'Just some notes I typed.' });
  assert.ok(prose.some(s => s.includes('No timed cues found.')), `no empty warning in ${JSON.stringify(prose)}`);
});

test('text that cannot become a cue is counted, never dropped in silence', { skip: SKIP }, async () => {
  // A loose paragraph between two good cues has no timing line. It is words the
  // captions will never carry, so the count has to say so.
  const stray = [
    '1', '00:00:00,000 --> 00:00:02,000', 'Good',
    '', 'A paragraph somebody left in the file.',
    '', '2', '00:00:03,000 --> 00:00:04,000', 'Also good',
    '',
  ].join('\n');
  assert.equal((await cuesOf({ transcript: stray })).length, 2);
  assert.ok((await warningsOf({ transcript: stray })).some(s => s.includes('1 block was skipped')),
    'a block of text with no timing must be reported');

  // Timed, but the payload is nothing but a tag: the cue disappears, so it counts too.
  const tagOnly = '1\n00:00:00,000 --> 00:00:02,000\n<v Ana></v>\n\n2\n00:00:03,000 --> 00:00:04,000\nreal\n';
  assert.equal((await cuesOf({ transcript: tagOnly })).length, 1);
  assert.ok((await warningsOf({ transcript: tagOnly })).some(s => s.includes('1 block was skipped')),
    'a cue whose text vanishes with its tags must be reported');

  // The WebVTT file header is the one block that is SUPPOSED to have no timing,
  // including in a file that opens with blank lines.
  const vtt = 'WEBVTT\nKind: captions\nLanguage: en\n\n00:00:00.000 --> 00:00:02.000\nHello\n';
  assert.deepEqual(await warningsOf({ transcript: vtt }), [],
    'the WEBVTT header is not a skipped block');
  assert.deepEqual(await warningsOf({ transcript: '\n\n' + vtt }), [],
    'leading blank lines must not turn the header into a skipped block');
});

test('the cue on screen follows the [start, end) rule', { skip: SKIP }, async () => {
  const at = async (t: number) => (await mount({ transcript: SRT, time: t })).getHydratedString('{{currentCue}}') as string;

  assert.equal(await at(0), '', 'before the first cue there is silence');
  assert.equal(await at(0.2), 'Captions are how most people meet your work.', 'a cue is on at exactly its start');
  assert.equal(await at(2.399), 'Captions are how most people meet your work.');
  assert.equal(await at(2.4), '', 'at exactly its end the cue has left');
  assert.equal(await at(2.5), '', 'the gap between cues is silence');
  assert.equal(await at(3), 'Drop in an SRT file, or transcribe on device.');
  assert.equal(await at(7.799), 'Nothing is uploaded, and nothing is invented.');
  assert.equal(await at(9), '', 'after the last cue there is silence again');

  // Silence draws no plate at all, rather than an empty one.
  assert.ok(!(await render({ transcript: SRT, time: 2.5 })).includes('cp-plate'));
  assert.ok((await render({ transcript: SRT, time: 3 })).includes('cp-plate'));
});

test('the sidecars are byte-identical to the engine serialisers', { skip: SKIP }, async () => {
  // The hook mirrors engine/src/captions.ts because a tool cannot import it.
  // This is the pin that keeps the copy honest.
  const cues = await cuesOf({ transcript: SRT });
  assert.equal(await sidecar({ transcript: SRT }, 'srt'), cuesToSrt(cues));
  assert.equal(await sidecar({ transcript: SRT }, 'vtt'), cuesToVtt(cues));

  // Whatever dialect arrived, the sidecar is one normalised dialect out: the
  // WebVTT file below carries tags, a NOTE, a cue setting and no numbering, and
  // still writes the same SubRip bytes as its plain twin.
  const vtt = [
    'WEBVTT', '', 'NOTE hello', '',
    '00:00:00.200 --> 00:00:02.400 align:start',
    '<b>Captions are how most people meet your work.</b>', '',
    '00:00:02.600 --> 00:00:05.000', 'Drop in an SRT file, or transcribe on device.', '',
    '00:00:05.200 --> 00:00:07.800', 'Nothing is uploaded, and nothing is invented.', '',
  ].join('\n');
  assert.equal(await sidecar({ transcript: vtt }, 'srt'), await sidecar({ transcript: SRT }, 'srt'));
  assert.equal(await sidecar({ transcript: vtt }, 'vtt'), await sidecar({ transcript: SRT }, 'vtt'));

  // The numbering is regenerated, so a file numbered 7, 8, 9 comes out 1, 2, 3.
  const renumbered = await sidecar({ transcript: SRT.replace(/^1$/m, '7').replace(/^2$/m, '8').replace(/^3$/m, '9') }, 'srt');
  assert.ok(renumbered.startsWith('1\n00:00:00,200 --> 00:00:02,400\n'), renumbered.slice(0, 60));

  // The json sibling is real JSON carrying the cues, not the built-in dump.
  const json = JSON.parse(await sidecar({ transcript: SRT }, 'json'));
  assert.equal(json.cues.length, 3);
  assert.deepEqual(json.warnings, []);
});

test('the WebVTT sidecar encodes the two characters the grammar forbids', { skip: SKIP }, async () => {
  // WebVTT cue text may not carry a bare & or <: one starts an escape, the other
  // a tag, so a parser would swallow the rest of the line. SubRip has no such
  // rule and dumb players print an entity literally, so .srt keeps them as typed.
  const src = '1\n00:00:00,000 --> 00:00:02,000\nQ&amp;A: 5 &lt; 6, said Ana\n';
  assert.equal((await cuesOf({ transcript: src }))[0]?.text, 'Q&A: 5 < 6, said Ana',
    'the text the screen shows is the decoded one');

  const vtt = await sidecar({ transcript: src }, 'vtt');
  assert.ok(vtt.includes('Q&amp;A: 5 &lt; 6, said Ana'), vtt);
  for (const amp of vtt.matchAll(/&(?!amp;|lt;|gt;|nbsp;|quot;)/g)) {
    assert.fail(`a bare ampersand survived at index ${amp.index} of the WebVTT sidecar`);
  }
  assert.ok(!/<(?!\/)/.test(vtt.slice('WEBVTT'.length)), 'no bare less-than survives into a cue');

  assert.ok((await sidecar({ transcript: src }, 'srt')).includes('Q&A: 5 < 6, said Ana'),
    'SubRip keeps the characters the author wrote');

  // Re-importing our own WebVTT gives the same cue back: the encode and the
  // entity decode are exact inverses.
  assert.deepEqual(await cuesOf({ transcript: vtt }), await cuesOf({ transcript: src }));
});

test('the tool opens on finished sample captions, not an empty frame', { skip: SKIP }, async () => {
  // Andy's defaults standard: a tool's first open is its exhibition print. A
  // captioning tool whose default state shows no caption is the one thing it
  // must not do - and the gallery card, the template tiles and every preset
  // inherit this same seed, so it is the only place to fix it.
  const html = await render({});
  assert.ok(html.includes('cp-plate'), 'the default state must draw a caption');
  assert.ok(html.includes('cp-cues'), 'the default state must list its cues');
  assert.ok(!html.includes('is-empty'), 'the default state is not the empty state');
  // The default seed has to cover t = 0, or the first frame is silent anyway.
  const first = (await cuesOf({}))[0];
  assert.equal(first?.start, 0, 'the sample cue must start at the default preview time');
  assert.deepEqual(await warningsOf({}), [], 'the shipped sample warns about nothing');
});

test('an empty transcript gives the empty state and empty sidecars', { skip: SKIP }, async () => {
  for (const transcript of ['', '   \n\n  ']) {
    const state = { transcript };
    assert.equal(await sidecar(state, 'srt'), '', 'an empty SubRip sidecar is empty, not a stray newline');
    assert.equal(await sidecar(state, 'vtt'), '', 'an empty WebVTT sidecar carries no lonely WEBVTT header');

    const html = await render(state);
    assert.ok(html.includes('cp-review-head is-empty'), 'the empty state must be marked as such');
    assert.ok(html.includes('No captions yet.'), 'the empty state says what to do next');
    assert.ok(!html.includes('cp-plate'), 'nothing is burned in when there is nothing to burn');
    assert.ok(!html.includes('cp-cues'), 'no cue list without cues');
    assert.ok(html.includes('cp-blank'), 'with no clip either, the stage says it is waiting');
  }
});

test('burnIn, timecodes and position drive what reaches the frame', { skip: SKIP }, async () => {
  const on = await render({ transcript: SRT, time: 1 });
  assert.ok(on.includes('cp-plate') && on.includes('Captions are how'), 'the cue is drawn by default');

  const off = await render({ transcript: SRT, time: 1, burnIn: false });
  assert.ok(!off.includes('cp-plate'), 'burnIn off keeps the frame clean');
  assert.equal(await sidecar({ transcript: SRT, burnIn: false }, 'srt'), await sidecar({ transcript: SRT }, 'srt'),
    'burnIn never touches the sidecar - that is the point of turning it off');

  assert.ok(!on.includes('cp-tc'), 'timecodes are off by default');
  const tc = await render({ transcript: SRT, time: 1, showTimecodes: true });
  assert.ok(tc.includes('00:00:00,200') && tc.includes('00:00:02,400'), 'the cue in and out times print');

  for (const position of ['bottom', 'top', 'centre']) {
    const html = await render({ transcript: SRT, time: 1, position });
    assert.ok(html.includes(`cp-pos--${position}`), `position=${position} did not reach the root`);
  }
});

test('karaoke lights one word at a time, and only karaoke does', { skip: SKIP }, async () => {
  // One cue, four words, four seconds: a word a second.
  const cue = '1\n00:00:00,000 --> 00:00:04,000\nalpha bravo charlie delta\n';
  const words = async (t: number) =>
    ((await mount({ transcript: cue, style: 'karaoke', maxLines: 1, time: t }))
      .getHydratedString('{{#each cueRows}}{{#each words}}{{text}}:{{cls}};{{/each}}{{/each}}') as string)
      .split(';').filter(Boolean);

  assert.deepEqual(await words(0.5),
    ['alpha:cp-w is-on', 'bravo:cp-w is-next', 'charlie:cp-w is-next', 'delta:cp-w is-next']);
  assert.deepEqual(await words(2.5),
    ['alpha:cp-w is-done', 'bravo:cp-w is-done', 'charlie:cp-w is-on', 'delta:cp-w is-next']);
  assert.deepEqual(await words(3.99),
    ['alpha:cp-w is-done', 'bravo:cp-w is-done', 'charlie:cp-w is-done', 'delta:cp-w is-on']);

  const plain = await render({ transcript: cue, style: 'bar', time: 2.5 });
  assert.ok(!plain.includes('is-on') && !plain.includes('is-done'),
    'a non-karaoke style carries no per-word state');
});

test('maxLines wraps the cue and never exceeds itself', { skip: SKIP }, async () => {
  const long = '1\n00:00:00,000 --> 00:00:05,000\n' +
    'one two three four five six seven eight nine ten eleven twelve\n';
  for (const maxLines of [1, 2, 3]) {
    const rt = await mount({ transcript: long, maxLines, time: 1 });
    const rows = (rt.getHydratedString('{{#each cueRows}}{{#each words}}{{text}} {{/each}}|{{/each}}') as string)
      .split('|').filter(Boolean);
    assert.equal(rows.length, maxLines, `maxLines=${maxLines} produced ${rows.length} rows`);
    assert.equal(rows.join(' ').split(/\s+/).filter(Boolean).join(' '),
      'one two three four five six seven eight nine ten eleven twelve',
      'wrapping must not lose, reorder or duplicate a word');
  }
});

test('the clip shows as video, audio artwork or a waiting frame', { skip: SKIP }, async () => {
  const video = await render({ media: { id: 'demo/talk.mp4' }, transcript: SRT, time: 1 });
  assert.ok(video.includes('<video class="cp-media" src="asset:demo/talk.mp4"'), 'a video clip becomes a video element');
  assert.ok(!video.includes('cp-blank') && !video.includes('cp-art'));

  const audio = await render({ media: { id: 'demo/voice.mp3' }, transcript: SRT, time: 1 });
  assert.ok(audio.includes('cp-art') && audio.includes('voice.mp3'),
    'an audio clip gets the artwork panel and its own name, never a broken image');
  assert.ok(!audio.includes('<video') && !audio.includes('cp-blank'));
  assert.match(audio, /<rect [^>]*fill="/, 'the artwork bars carry explicit fills, never inherited paint');

  const still = await render({ media: { id: 'demo/frame.png' }, transcript: SRT, time: 1 });
  assert.ok(still.includes('<img class="cp-media" src="asset:demo/frame.png"'), 'a still falls back to an image');

  const none = await render({ transcript: SRT, time: 1 });
  assert.ok(none.includes('cp-blank'), 'no clip means the waiting frame');
});

test('junk values never throw out of the hook', { skip: SKIP }, async () => {
  const junk: Array<Record<string, unknown>> = [
    { style: 'interpretive-dance', position: 'sideways', maxLines: 99 },
    { fontSize: 'huge', t: 'later', maxLines: null, transcript: 12345 },
    { color: 'url(javascript:alert(1))', background: '<script>', transcript: SRT },
    { transcript: '-->\n\n-->\n\n00:00:0', media: 'not-a-ref' },
    { transcript: SRT, t: -5, fontSize: -20 },
  ];
  for (const state of junk) {
    const html = await render(state);
    assert.ok(html.includes('cp-root'), `junk state did not render: ${JSON.stringify(state)}`);
    assert.ok(!html.includes('cp-warn" role="status"'), `junk state surfaced a hook error: ${JSON.stringify(state)}`);
    assert.ok(!html.includes('javascript:') && !html.includes('<script>'),
      'a colour value must never reach the style attribute as markup or a URL');
  }

  // Out-of-range values are clamped rather than written straight into the CSS.
  const clamped = await render({ transcript: SRT, fontSize: 9000, maxLines: 12, time: 1 });
  assert.ok(clamped.includes('--cp-fs: 140px'), 'the text size is clamped to its declared ceiling');
});

test('the manifest declares transcription against real inputs', { skip: SKIP }, async () => {
  const m = tool.manifest;
  const ids = new Set((m.inputs as Array<{ id: string }>).map(i => i.id));
  const t = m.render.transcribe;
  assert.ok(t, 'the tool exists to caption a clip, so it must declare render.transcribe');
  assert.ok(ids.has(t.source), `render.transcribe.source "${t.source}" is not an input`);
  assert.ok(ids.has(t.target), `render.transcribe.target "${t.target}" is not an input`);
  // The sidecar formats need their sibling files, or the export writes nothing.
  for (const ext of ['srt', 'vtt', 'json']) {
    assert.ok(m.render.formats.includes(ext), `render.formats is missing ${ext}`);
    assert.ok(typeof tool.textTemplates?.[ext] === 'string', `template.${ext} did not load`);
  }
  // The CLI has no on-device speech, so the transcript field has to be fillable
  // without it. That is what the plan-87 attachment is for.
  const target = (m.inputs as Array<Record<string, any>>).find(i => i.id === t.target);
  assert.ok(target?.dataSource, 'the transcript input must carry the Add data affordance');
  assert.match(String(target?.dataSource.accept), /\.srt/);
  assert.match(String(target?.dataSource.accept), /\.vtt/);
});

// Every shipped starting point has to mount and draw. A seed that names a
// retired input or trips the hook would otherwise only show up in the gallery.
type Seed = { label: string; values: Record<string, unknown> };

function seeds(): Seed[] {
  const out: Seed[] = [];
  for (const ex of (tool.manifest.examples ?? []) as Array<{ label: string; values: Record<string, unknown> }>) {
    out.push({ label: `example ${ex.label}`, values: ex.values });
  }
  const dir = join(COMMUNITY, 'captions', 'templates');
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    out.push({ label: `template ${t.id}`, values: t.values });
    for (const p of t.presets ?? []) {
      out.push({ label: `template ${t.id} preset ${p.id}`, values: { ...t.values, ...p.values } });
    }
  }
  return out;
}

test('every example, template and preset seed hydrates', { skip: SKIP }, async () => {
  const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));
  const list = seeds();
  assert.ok(list.length >= 3 + 2, 'the seed sweep found nothing to check');

  for (const { label, values } of list) {
    for (const key of Object.keys(values)) {
      assert.ok(ids.has(key), `${label} seeds "${key}", which is not an input`);
    }
    const html = await render(values);
    assert.ok(html.includes('cp-root'), `${label} did not render`);
    assert.ok(!html.includes('role="status"'), `${label} surfaced a hook error`);
    const style = String(values.style ?? 'bar');
    assert.ok(html.includes(`cp-style--${style}`), `${label} did not reach style=${style}`);
    // Every seed shows cues - its own transcript or the shipped default. A seed
    // that blanks the transcript would put an empty frame on a gallery tile.
    assert.ok(html.includes('cp-cues'), `${label} listed no cues`);
    assert.ok(html.includes('cp-plate'), `${label} drew no caption`);
  }
});
