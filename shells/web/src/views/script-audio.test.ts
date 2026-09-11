// SPDX-License-Identifier: MPL-2.0
/**
 * markdownToSpokenText is the dialog's one pure piece - the rest is element
 * wiring over host.speech, verified in a real browser. What matters here is the
 * speech contract: structure goes, words stay, and nothing unspeakable (code,
 * image URLs, table plumbing) leaks into the synthesized clip.
 *
 * The module imports its stylesheet (a Vite-only construct), so the run relies
 * on the stylesheet-import stub the `test` script registers (tests/css-stub.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToSpokenText, SOFT_CHAR_CAP } from './script-audio.ts';

test('plain text passes through unchanged', () => {
  assert.equal(markdownToSpokenText('Hello there. Two sentences.'), 'Hello there. Two sentences.');
});

test('empty and whitespace-only input come back empty', () => {
  assert.equal(markdownToSpokenText(''), '');
  assert.equal(markdownToSpokenText('   \n\t\n  '), '');
});

test('fenced code blocks drop entirely, including an unterminated one', () => {
  assert.equal(
    markdownToSpokenText('Before.\n```js\nconst x = 1;\n```\nAfter.'),
    'Before.\nAfter.',
  );
  assert.equal(markdownToSpokenText('Before.\n```\nnever closed'), 'Before.');
});

test('images drop, links keep their text', () => {
  assert.equal(
    markdownToSpokenText('See ![a chart](chart.png) and [the docs](https://example.com/docs).'),
    'See and the docs.',
  );
});

test('the pronunciation mark survives the link rule (plans/181 section 3)', () => {
  // `[word](/ipa/)` is link-shaped but it is script grammar: the engine reads
  // it and speaks the phonemes instead of asking eSpeak. Stripping it to the
  // bare word here would silently delete the one technique that fixes accuracy.
  assert.equal(
    markdownToSpokenText('[SUSE](/ˈsuːsə/) ships today.'),
    '[SUSE](/ˈsuːsə/) ships today.',
  );
  // …and an ordinary link sitting next to one still loses its URL.
  assert.equal(
    markdownToSpokenText('[Rancher](/ɹˈantʃɚ/) and [the docs](https://example.com).'),
    '[Rancher](/ɹˈantʃɚ/) and the docs.',
  );
  // A target that is not one slash-wrapped run is a link, however slashy.
  assert.equal(markdownToSpokenText('[docs](/a/b/)'), 'docs');
});

test('bracket marks are not markdown and pass through untouched', () => {
  assert.equal(markdownToSpokenText('Ready. [pause 1.2] Go.'), 'Ready. [pause 1.2] Go.');
  assert.equal(markdownToSpokenText('[slow] Read this carefully.'), '[slow] Read this carefully.');
});

test('inline code keeps its content, loses the ticks', () => {
  assert.equal(markdownToSpokenText('Run `pnpm install` first.'), 'Run pnpm install first.');
});

test('headings keep their text', () => {
  assert.equal(markdownToSpokenText('## Welcome\n\nBody text.'), 'Welcome\n\nBody text.');
});

test('quote and list markers strip, the words stay', () => {
  assert.equal(
    markdownToSpokenText('> A quote.\n- First\n- Second\n1. Third\n2) Fourth'),
    'A quote.\nFirst\nSecond\nThird\nFourth',
  );
});

test('emphasis markers strip pairwise', () => {
  assert.equal(
    markdownToSpokenText('This is **bold**, *italic*, __also bold__ and ~~gone~~.'),
    'This is bold, italic, also bold and gone.',
  );
});

test('a lone underscore inside a word survives', () => {
  assert.equal(markdownToSpokenText('The snake_case name stays.'), 'The snake_case name stays.');
});

test('horizontal rules drop and are not read as list items', () => {
  assert.equal(markdownToSpokenText('Above.\n\n---\n\nBelow.'), 'Above.\n\nBelow.');
  assert.equal(markdownToSpokenText('Above.\n- - -\nBelow.'), 'Above.\nBelow.');
});

test('table separator rows drop and cell pipes become spaces', () => {
  assert.equal(
    markdownToSpokenText('| Name | Role |\n| --- | --- |\n| Ada | Engineer |'),
    'Name Role\nAda Engineer',
  );
});

test('runs of blank lines collapse to one', () => {
  assert.equal(markdownToSpokenText('One.\n\n\n\nTwo.'), 'One.\n\nTwo.');
});

test('the soft cap is exported and sane', () => {
  assert.equal(typeof SOFT_CHAR_CAP, 'number');
  assert.ok(SOFT_CHAR_CAP >= 1000);
});

// ── Record-side Content Credential (EU AI Act Article 50) ───────────────────
// saveTtsClip signs a sidecar-style store onto the record so the runtime's
// ingredient sweep chains the AI origin into composed exports. The chain
// itself is pinned engine-side (tests/tts-provenance-chain.test.ts); here the
// save path: the store lands on the record with the recipe in the created
// action's parameters, and a signing failure never loses the clip.
import { saveTtsClip, buildTtsCredential, type TtsClip, type ScriptAudioHost } from './script-audio.ts';

const clipFixture = (over: Partial<TtsClip> = {}): TtsClip => ({
  result: { duration: 1.2, words: [], granularity: 'word' } as any,
  wavBlob: new Blob([new TextEncoder().encode('RIFF....WAVEfmt fake')], { type: 'audio/wav' }),
  spokenText: 'Hello from Lolly, this voice is synthetic.',
  voice: 'af_heart',
  speed: 1,
  ...over,
});

function fakeHost(uploads: any[]): ScriptAudioHost {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      _uploadUserAsset: async (record: any) => { uploads.push(record); },
      get: async (id: string) => ({ source: 'user', id, type: 'audio', format: 'wav', url: 'blob:x' }),
    },
  } as any;
}

test('saveTtsClip persists a signed credential store carrying the script recipe', async () => {
  const uploads: any[] = [];
  const ref = await saveTtsClip(fakeHost(uploads), clipFixture());
  assert.ok(ref, 'the saved ref resolves');
  assert.equal(uploads.length, 1);
  const rec = uploads[0];
  assert.ok(rec.credential instanceof Uint8Array && rec.credential.length > 0, 'a credential store rides the record');
  assert.equal(rec.credentialFormat, 'wav');
  // The store reads back: AI source type on the created step, the exact
  // script + voice/model/lang in its parameters - the machine-readable mark.
  const { prepareC2paIngredientFromStore, GENERATED_SOURCE_TYPE } = await import('@lolly/engine');
  const ing = prepareC2paIngredientFromStore(rec.credential, rec.credentialFormat);
  assert.equal(ing?.digitalSourceType, GENERATED_SOURCE_TYPE);
  const { collectActionChain } = await import('../../../../engine/src/c2pa-extract.ts');
  const created = collectActionChain(rec.credential).find((s: any) => s.action === 'c2pa.created');
  const params = created?.parameters as Map<string, unknown>;
  assert.equal(params.get('script'), 'Hello from Lolly, this voice is synthetic.');
  assert.equal(params.get('voice'), 'af_heart');
  assert.equal(params.get('model'), 'kokoro-82m-q8');
  assert.equal(params.get('lang'), 'en');
});

test('a signing failure logs and still saves the clip uncredentialed (never-throws posture)', async () => {
  const uploads: any[] = [];
  const clip = clipFixture();
  // Booby-trap the bytes read so buildTtsCredential's try/catch has to absorb it.
  (clip.wavBlob as any).arrayBuffer = async () => { throw new Error('quota'); };
  const ref = await saveTtsClip(fakeHost(uploads), clip);
  assert.ok(ref, 'the clip still saves');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].credential, undefined, 'no credential fields on a failed signing');
  assert.equal(uploads[0].credentialFormat, undefined);
  assert.equal(uploads[0].aiGenerated, 'full', 'the Gen AI disclosure never depends on signing');
});

test('buildTtsCredential alone returns null on failure, a store on success', async () => {
  const uploads: any[] = [];
  const host = fakeHost(uploads);
  const good = await buildTtsCredential(host, clipFixture());
  assert.ok(good && good.store.length > 0 && good.format === 'wav');
  const bad = clipFixture();
  (bad.wavBlob as any).arrayBuffer = async () => { throw new Error('gone'); };
  assert.equal(await buildTtsCredential(host, bad), null);
});

// ── What a clip remembers, and rewriting it in place (plans/181 section 5) ───
import { buildTtsRecord, ttsScriptOf, ttsSegmentsFor, rewriteTtsClip } from './script-audio.ts';

const RATE = 24000;
/** Two sentences with a 0.6 s gap between them - what the pipeline synthesizes. */
const twoSentenceResult = (): any => ({
  sampleRate: RATE,
  duration: 3,
  granularity: 'word',
  words: [
    { text: 'Hello', start: 0, end: 0.4 },
    { text: 'there.', start: 0.4, end: 0.9 },
    { text: 'Second', start: 1.5, end: 1.9 },
    { text: 'one.', start: 1.9, end: 2.4 },
  ],
});

test('ttsScriptOf is the model-facing form: normalized, one sentence per line', () => {
  assert.equal(ttsScriptOf('Hello there. Second one.'), 'Hello there.\nSecond one.');
  // A mark keeps its place on the line it belongs to.
  assert.equal(ttsScriptOf('Ready. [pause 2] Go.'), 'Ready.\n[pause 2] Go.');
});

test('buildTtsRecord stores the script and the per-line sample tiling', () => {
  const clip = clipFixture({ result: twoSentenceResult(), spokenText: 'Hello there. Second one.' });
  const tts = buildTtsRecord(clip).meta!.tts as any;
  assert.equal(tts.script, 'Hello there.\nSecond one.');
  // `text` stays the human prose - the provenance recipe is signed from it.
  assert.equal(tts.text, 'Hello there. Second one.');
  assert.equal(tts.segments.length, 2, 'one entry per script line');
  // The ranges TILE: one segment ends exactly where the next begins, which is
  // what makes a single sentence replaceable.
  assert.deepEqual(tts.segments[0].samples, [0, 28800]);
  assert.deepEqual(tts.segments[1].samples, [28800, 72000]);
  assert.deepEqual(tts.segments[0].words, [0, 2]);
  assert.deepEqual(tts.segments[1].words, [2, 4]);
});

test('a tiling that does not have one entry per line is omitted, not guessed', () => {
  // "Welcome" is its own synthesis chunk (a line break ends a breath group) but
  // carries no terminal punctuation, so the word stream cannot see the seam.
  // Two lines, one derivable segment: store nothing and let the consumer derive.
  const clip = clipFixture({
    result: {
      sampleRate: RATE, duration: 3, granularity: 'word',
      words: [
        { text: 'Welcome', start: 0, end: 0.5 },
        { text: 'Hello', start: 1.1, end: 1.5 },
        { text: 'there.', start: 1.5, end: 2 },
      ],
    } as any,
    spokenText: 'Welcome\nHello there.',
  });
  assert.equal(ttsScriptOf(clip.spokenText), 'Welcome\nHello there.');
  assert.equal(ttsSegmentsFor(clip, 2), undefined);
  assert.equal((buildTtsRecord(clip).meta!.tts as any).segments, undefined);
});

test('a sentence-granular clip stores no tiling at all', () => {
  const clip = clipFixture({
    result: { ...twoSentenceResult(), granularity: 'sentence' },
    spokenText: 'Hello there. Second one.',
  });
  assert.equal(ttsSegmentsFor(clip, 2), undefined);
});

test('an exact tiling from the synthesis wins over the derived one', () => {
  const exact = [
    { words: [0, 2], samples: [0, 30000], gapAfter: 1200 },
    { words: [2, 4], samples: [30000, 72000], gapAfter: 0 },
  ];
  const clip = clipFixture({
    result: twoSentenceResult(), spokenText: 'Hello there. Second one.', segments: exact as any,
  });
  assert.deepEqual(ttsSegmentsFor(clip, 2), exact);
});

function rewriteHost(calls: any[]): ScriptAudioHost {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      _uploadUserAsset: async () => { throw new Error('a rewrite must never mint a new id'); },
      _replaceUserAssetBytes: async (id: string, patch: any) => { calls.push({ id, patch }); },
      get: async (id: string) => ({ source: 'user', id, type: 'audio', format: 'wav', url: 'blob:x' }),
    },
  } as any;
}

test('rewriteTtsClip replaces the bytes at the SAME asset id, keeping the name', async () => {
  const calls: any[] = [];
  const clip = clipFixture({ result: twoSentenceResult(), spokenText: 'Hello there. Second one.' });
  const ref = await rewriteTtsClip(rewriteHost(calls), 'user/tts/1-hello', clip, { name: 'Intro line' });
  assert.equal(ref?.id, 'user/tts/1-hello', 'the id is the contract - no box is re-pointed');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'user/tts/1-hello');
  assert.ok(calls[0].patch.blob instanceof Blob);
  assert.ok(calls[0].patch.credential instanceof Uint8Array, 'a rewrite is re-signed, not left stale');
  assert.equal(calls[0].patch.credentialFormat, 'wav');
  assert.equal(calls[0].patch.meta.name, 'Intro line', 'a regenerated clip is the same clip');
  assert.equal((calls[0].patch.meta.tts as any).script, 'Hello there.\nSecond one.');
});

test('rewriteTtsClip refuses on a shell with no in-place replace', async () => {
  const uploads: any[] = [];
  await assert.rejects(
    () => rewriteTtsClip(fakeHost(uploads), 'user/tts/1-hello', clipFixture()),
    /cannot rewrite/,
  );
  assert.equal(uploads.length, 0, 'and never quietly saves a copy instead');
});
