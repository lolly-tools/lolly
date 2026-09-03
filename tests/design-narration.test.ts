// SPDX-License-Identifier: MPL-2.0
/**
 * Design - the four document-level narration settings (plans/180 M-A).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-narration.test.ts
 * (no framework - node:test). Drives the REAL tool through the engine, loaded from
 * community/ like the other design suites.
 *
 * What is pinned here, and why each one is a contract rather than a preference:
 *
 *  - the four inputs are APPENDED after `autoAdvance`, and `boxes` stays last. Top-level
 *    inputs are named in the URL rather than positional, so this is not a wire format the
 *    way `boxes.fields` is; it is still pinned, because `boxes` being the tail is what
 *    every "the deck is the last input" reader assumes, and because a narration setting
 *    belongs beside the other two presentation settings.
 *  - their DEFAULTS are the plan's timing rules T1 and T2 written down once: 400 ms
 *    lead-in, 600 ms tail, natural pace, the shell's own default voice. lib/motion-model's
 *    NARRATION_LEAD_IN_MS / NARRATION_TAIL_MS have to agree with them, or the dwell solver
 *    and the manifest would answer the same question two different ways.
 *  - NONE of them renders. They are settings for a generator, not for the picture, so a
 *    document that sets all four must produce byte-identical markup to one that sets none.
 *    That is what keeps every link shared before they existed rendering unchanged.
 *  - no BOX field was added. Narration clips reuse `kind:'audio'` under a group, which is
 *    the whole reason the compact-blocks URL wire format did not have to grow.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';
import { NARRATION_LEAD_IN_MS, NARRATION_TAIL_MS } from '../shells/web/src/lib/motion-model.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')),
  'community/design/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('design', fetchFile);
const inputs = (): Array<Record<string, any>> => tool.manifest.inputs as Array<Record<string, any>>;
const byId = (id: string): Record<string, any> | undefined => inputs().find((i) => i.id === id);

async function mount(state: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), state as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

const DECK = [
  { id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0, bg: '#ffffff', notes: 'Slide one.' },
  { id: 'f2', kind: 'frame', x: 1000, y: 0, w: 800, h: 600, order: 1, bg: '#ffffff' },
];

// ── the manifest ──────────────────────────────────────────────────────────────

test('the four narration settings are appended after autoAdvance, boxes still last', () => {
  const ids = inputs().map((i) => i.id);
  const at = ids.indexOf('autoAdvance');
  assert.ok(at > 0, 'autoAdvance is still the presentation setting they sit behind');
  assert.deepEqual(ids.slice(at + 1, at + 5),
    ['narrationVoice', 'narrationSpeed', 'narrationLeadInMs', 'narrationTailMs'],
    'the four arrive together, directly after the other presentation settings');
  assert.equal(ids[ids.length - 1], 'boxes', 'the deck is the tail input');
  assert.equal(new Set(ids).size, ids.length, 'no id is declared twice');
});

test('narrationVoice: free text, empty meaning "the shell\'s own default voice"', () => {
  const f = byId('narrationVoice')!;
  assert.equal(f.type, 'text');
  assert.equal(f.default, '', 'empty is not "no voice", it is "whichever voice the shell picks"');
  assert.equal(f.label, 'Narration voice');
  // A blend is a setting rather than a voice you pick from a list (plans/181 section 4),
  // which is exactly why this is free text and not a select over KOKORO_VOICES.
  assert.match(String(f.help), /blend/i);
});

test('narrationSpeed: 1 is the natural pace, bounded to what the model reads', () => {
  const f = byId('narrationSpeed')!;
  assert.equal(f.type, 'number');
  assert.equal(f.default, 1);
  assert.equal(f.min, 0.5);
  assert.equal(f.max, 2);
});

test('the lead-in and tail defaults agree with the dwell solver', () => {
  const lead = byId('narrationLeadInMs')!;
  const tail = byId('narrationTailMs')!;
  assert.equal(lead.type, 'number');
  assert.equal(tail.type, 'number');
  assert.equal(lead.default, 400);
  assert.equal(tail.default, 600);
  assert.equal(lead.min, 0, 'a 0 ms lead-in is a real answer, not a broken one');
  assert.equal(tail.min, 0);
  // The ONE place these numbers may disagree is nowhere: the manifest defaults and the
  // solver's constants are the same rule (plans/180 T1) written in two files.
  assert.equal(lead.default, NARRATION_LEAD_IN_MS);
  assert.equal(tail.default, NARRATION_TAIL_MS);
});

test('narration adds NO box sub-field - a clip is an ordinary audio box under a group', () => {
  const fields = (byId('boxes')!.fields as Array<{ id: string }>).map((f) => f.id);
  for (const invented of ['narration', 'narrationOf', 'notesHash', 'spoken']) {
    assert.equal(fields.includes(invented), false, `${invented} must not exist - the wire format did not have to grow`);
  }
  // The fields a narration clip DOES use were all already there.
  for (const needed of ['kind', 'group', 'lane', 'start', 'dur', 'frame', 'notes', 'build', 'duck', 'presentAudio', 'image']) {
    assert.ok(fields.includes(needed), `boxes.${needed} is what narration writes through`);
  }
});

// ── the render ────────────────────────────────────────────────────────────────

test('the generator settings change no byte of the render', async () => {
  const plain = await mount({ boxes: DECK });
  const set = await mount({
    boxes: DECK,
    narrationVoice: 'af_heart+bf_lily:0.3',
    narrationSpeed: 1.4,
    narrationLeadInMs: 0,
  });
  // Voice, speed and lead-in are read by the thing that MAKES the clips and by nothing
  // else: the lead-in reaches the picture already, as the clip's own start. So a document
  // that sets all three renders exactly what it rendered before they existed.
  assert.equal(set, plain, 'these are settings for a generator, not for the picture');
});

test('the two PRESENTER settings reach the render root, and only when they say something', async () => {
  // The other half of the same rule (plans/180 T9, section 4): present-mode reads its
  // document settings off the render root, so a setting that stops at the model is a
  // setting the podium cannot honour. This is the gap that left "Show captions when
  // presenting" dead - the presenter read `data-present-captions`, the hook never wrote it.
  const plain = await mount({ boxes: DECK });
  assert.equal(/data-present-captions|data-narration-tail/.test(plain), false,
    'an untouched document still renders byte for byte what it always did');
  assert.equal(await mount({ boxes: DECK, narrationTailMs: 600 }), plain,
    'the default tail is what the presenter already assumes, so it stays out of the markup');

  const set = await mount({ boxes: DECK, showCaptionsWhenPresenting: true, narrationTailMs: 900 });
  assert.match(set, /class="lolly-frames"[^>]*data-present-captions="1"/,
    'captions on is a request the presenter has to be told about');
  assert.match(set, /class="lolly-frames"[^>]*data-narration-tail="900"/,
    'and so is a tail the author moved off the default');
  // Clamped and integer, like every other time attribute this hook writes.
  assert.match(await mount({ boxes: DECK, narrationTailMs: 99_999 }), /data-narration-tail="5000"/);
  assert.match(await mount({ boxes: DECK, narrationTailMs: -5 }), /data-narration-tail="0"/);
});

test('a narration clip renders as the audio marker every audio box renders as', async () => {
  const html = await mount({
    boxes: [
      ...DECK,
      {
        id: 'n1', kind: 'audio', frame: 'f1', group: 'narration:f1', lane: 'seq',
        start: 0.4, dur: 2, presentAudio: true,
        image: { id: 'user/tts/1', type: 'audio', url: 'blob:narration', meta: { durationMs: 2000 } },
      },
      // A music bed on the same slide: audio for the FILM, which the podium must not play.
      {
        id: 'bed', kind: 'audio', frame: 'f1', lane: 'seq', start: 0, dur: 6,
        image: { id: 'user/bed', type: 'audio', url: 'blob:bed', meta: { durationMs: 6000 } },
      },
    ],
  });
  // The marker is what the shell compositor mixes and the presenter conducts. The url is
  // whatever the host resolved the ref to (`asset:` in this suite's stub host).
  assert.match(html, /class="lolly-box-audio" data-audio-src="[^"]+"/, 'the compositor finds the track');
  assert.match(html, /data-t-start="400" data-t-dur="2000" data-t-lane="seq"/,
    'the clip is on the scenes lane at slide start plus the lead-in');
  assert.equal(/narration:f1/.test(html), false, 'the GROUP is model state; it never reaches the markup');
  // The two marks present-mode conducts on (plans/180 M-E). Without them the presenter
  // walked nine markers and made no player at all - the deck was silent at the podium.
  assert.match(html, /data-audio-src="asset:user\/tts\/1" data-present-audio="1" data-narration="1"/,
    'a narration clip says it is one, and says it may be heard');
  assert.match(html, /data-audio-src="asset:user\/bed" aria-hidden/,
    'the bed carries neither mark, so the podium leaves it alone');
});
