// SPDX-License-Identifier: MPL-2.0
/**
 * The heal decision is what keeps the lazy re-stamp honest: ONLY a user wav
 * whose meta.tts recipe proves Lolly generated it, and whose stored bytes
 * carry no embedded C2PA chunk yet, may be stamped. A user-recorded or
 * uploaded file is never ours to mark, whatever its format. Those rules are
 * pure functions here; the embed round-trip itself is pinned engine-side in
 * tests/c2pa-wav.test.ts, and the final test below takes a bare WAV + a fake
 * record through the real heal path (engine embed + extract) as proof.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRiffC2pa, ttsRecipeFromMeta, spokenScriptOf, shouldHealTts, healTtsProvenance, rewriteTtsClip,
  TTS_MODEL, type TtsHealHost, type TtsRewriteHost,
} from './tts-provenance.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A minimal but well-formed WAV: RIFF/WAVE + a 16-byte fmt chunk + a data chunk. */
function bareWav(dataBytes = 64): Uint8Array {
  const data = new Uint8Array(dataBytes);
  const size = 4 + 8 + 16 + 8 + dataBytes;
  const out = new Uint8Array(8 + size);
  const dv = new DataView(out.buffer);
  const put = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, size, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);       // PCM
  dv.setUint16(22, 1, true);       // mono
  dv.setUint32(24, 8000, true);    // sample rate
  dv.setUint32(28, 16000, true);   // byte rate
  dv.setUint16(32, 2, true);       // block align
  dv.setUint16(34, 16, true);      // bits
  put(36, 'data'); dv.setUint32(40, dataBytes, true);
  out.set(data, 44);
  return out;
}

/** The same WAV with a (fake) top-level C2PA chunk appended, size field fixed up. */
function stampedWav(): Uint8Array {
  const wav = bareWav();
  const payload = new TextEncoder().encode('not a real manifest');
  const padded = payload.length + (payload.length & 1);
  const out = new Uint8Array(wav.length + 8 + padded);
  out.set(wav, 0);
  const dv = new DataView(out.buffer);
  const put = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  put(wav.length, 'C2PA');
  dv.setUint32(wav.length + 4, payload.length, true);
  out.set(payload, wav.length + 8);
  dv.setUint32(4, out.length - 8, true);
  return out;
}

const ttsMeta = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Hello from Lolly…',
  tts: { voice: 'af_heart', speed: 1, model: TTS_MODEL, text: 'Hello from Lolly, this voice is synthetic.', ...over },
});

const ttsRef = (over: Partial<AssetRef> = {}): AssetRef => ({
  source: 'user', id: 'user/tts/123-hello', type: 'audio', format: 'wav', url: 'blob:x',
  meta: ttsMeta(),
  ...over,
});

// ── hasRiffC2pa ──────────────────────────────────────────────────────────────

test('hasRiffC2pa: bare wav no, stamped wav yes, non-RIFF junk no', () => {
  assert.equal(hasRiffC2pa(bareWav()), false);
  assert.equal(hasRiffC2pa(stampedWav()), true);
  assert.equal(hasRiffC2pa(new TextEncoder().encode('ID3 something mp3-ish')), false);
  assert.equal(hasRiffC2pa(new Uint8Array(0)), false);
  assert.equal(hasRiffC2pa(new Uint8Array([0x52, 0x49])), false);   // truncated 'RI'
});

test('hasRiffC2pa: a malformed chunk size cannot loop or throw', () => {
  const wav = bareWav();
  const dv = new DataView(wav.buffer);
  dv.setUint32(40, 0xffffffff, true);   // data chunk claims 4 GB
  assert.equal(hasRiffC2pa(wav), false);
});

// ── ttsRecipeFromMeta ────────────────────────────────────────────────────────

test('ttsRecipeFromMeta reads the buildTtsRecord shape and defaults the rest', () => {
  const r = ttsRecipeFromMeta(ttsMeta());
  assert.ok(r);
  assert.equal(r.text, 'Hello from Lolly, this voice is synthetic.');
  assert.equal(r.voice, 'af_heart');
  assert.equal(r.speed, 1);
  assert.equal(r.model, TTS_MODEL);
  assert.equal(r.lang, 'en');
  // Missing/invalid optionals default like the save path wrote them.
  const loose = ttsRecipeFromMeta({ tts: { text: 'Hi there', voice: 'bf_emma', speed: Number.NaN } });
  assert.ok(loose);
  assert.equal(loose.speed, 1);
  assert.equal(loose.model, TTS_MODEL);
});

test('ttsRecipeFromMeta refuses anything that does not prove Lolly generated it', () => {
  assert.equal(ttsRecipeFromMeta(undefined), null);
  assert.equal(ttsRecipeFromMeta({}), null);
  assert.equal(ttsRecipeFromMeta({ tts: 'yes' }), null);
  assert.equal(ttsRecipeFromMeta({ tts: { voice: 'af_heart' } }), null);          // no script
  assert.equal(ttsRecipeFromMeta({ tts: { text: 'Words here' } }), null);         // no voice
  assert.equal(ttsRecipeFromMeta({ tts: { text: '   ', voice: 'af_heart' } }), null);
});

test('spokenScriptOf prefers the marks-bearing script, and every re-opener reads it', () => {
  const prose = { text: 'the render finished', voice: 'bf_lily', speed: 1, model: TTS_MODEL, lang: 'en' };
  assert.equal(spokenScriptOf(prose), 'the render finished');
  // Once a regeneration has written one, the script IS what the voice read;
  // `text` still holds the prose someone first typed, one edit behind. An
  // editor prefilling from `text` and saving would re-speak the old words
  // under the same asset id and undo the fix wherever the clip is used.
  const edited = { ...prose, script: '[slow] The render just finished!' };
  assert.equal(spokenScriptOf(edited), '[slow] The render just finished!');
});

// ── shouldHealTts ────────────────────────────────────────────────────────────

test('a pre-embed TTS clip (meta.tts + bare wav bytes) heals', () => {
  assert.equal(shouldHealTts(ttsRef(), bareWav()), true);
});

test('an already stamped clip never re-heals', () => {
  assert.equal(shouldHealTts(ttsRef(), stampedWav()), false);
});

test('uploaded or recorded audio is never stamped', () => {
  // An uploaded mp3 without a recipe.
  assert.equal(shouldHealTts(ttsRef({ format: 'mp3', meta: { name: 'song.mp3' } }), bareWav()), false);
  // A user wav recording without meta.tts - same bytes, no proof of origin.
  assert.equal(shouldHealTts(ttsRef({ id: 'user/rec/1', meta: { name: 'take 1' } }), bareWav()), false);
  // Even WITH a recipe, an mp3 container is not the wav heal's business.
  assert.equal(shouldHealTts(ttsRef({ format: 'mp3' }), bareWav()), false);
});

test('library assets and non-audio types are out of scope', () => {
  assert.equal(shouldHealTts(ttsRef({ source: 'library' }), bareWav()), false);
  assert.equal(shouldHealTts(ttsRef({ type: 'video' }), bareWav()), false);
});

// ── the heal path end to end (real engine embed, stubbed bridge write) ──────

test('healTtsProvenance stamps a bare clip, writes the record and the manifest reads back', async () => {
  const writes: Array<{ id: string; patch: { blob: Blob; credential: Uint8Array; credentialFormat: string } }> = [];
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      _restampUserAsset: async (id: string, patch: never) => { writes.push({ id, patch }); },
    },
  } as unknown as TtsHealHost;

  const healed = await healTtsProvenance(host, ttsRef(), bareWav(2048));
  assert.ok(healed, 'the heal produced a stamped blob');
  assert.equal(writes.length, 1);
  assert.equal(writes[0]!.id, 'user/tts/123-hello');
  assert.equal(writes[0]!.patch.credentialFormat, 'wav');
  assert.ok(writes[0]!.patch.credential.length > 0);

  // The stamped bytes carry a chunk the sniff sees, so a second pass is a no-op…
  const bytes = new Uint8Array(await healed.arrayBuffer());
  assert.equal(hasRiffC2pa(bytes), true);
  assert.equal(await healTtsProvenance(host, ttsRef(), bytes), null);
  assert.equal(writes.length, 1, 'no second write');

  // …and the manifest reads back with the AI source type and the full recipe.
  const { prepareC2paIngredientFromStore, GENERATED_SOURCE_TYPE } = await import('@lolly/engine');
  const ing = prepareC2paIngredientFromStore(writes[0]!.patch.credential, 'wav');
  assert.equal(ing?.digitalSourceType, GENERATED_SOURCE_TYPE);
  const { collectActionChain } = await import('../../../../engine/src/c2pa-extract.ts');
  const created = collectActionChain(writes[0]!.patch.credential).find((s) => s.action === 'c2pa.created');
  const params = created?.parameters as Map<string, unknown>;
  assert.equal(params.get('script'), 'Hello from Lolly, this voice is synthetic.');
  assert.equal(params.get('voice'), 'af_heart');
  assert.equal(params.get('model'), TTS_MODEL);
  assert.equal(params.get('lang'), 'en');
});

test('a failed record write reports no heal (the file bytes were never swapped)', async () => {
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      _restampUserAsset: async () => { throw new Error('quota'); },
    },
  } as unknown as TtsHealHost;
  assert.equal(await healTtsProvenance(host, ttsRef(), bareWav()), null);
});

// ── the rewrite path (plans/181 section 5.2 step 4) ──────────────────────────

test('a rewritten clip is stamped with the marks-bearing script and written at the same id', async () => {
  const writes: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      _replaceUserAssetBytes: async (id: string, patch: never) => { writes.push({ id, patch }); },
    },
  } as unknown as TtsRewriteHost;

  const script = 'Hello from Lolly.\n[pause 1.2] This voice is [slow] synthetic.';
  const stored = await rewriteTtsClip(host, {
    id: 'user/tts/123-hello',
    name: 'Hello from Lolly…',
    blob: new Blob([bareWav(2048) as BlobPart], { type: 'audio/wav' }),
    recipe: {
      text: 'Hello from Lolly, this voice is synthetic.',
      voice: 'af_heart+bf_lily:0.3', speed: 1, model: TTS_MODEL, lang: 'en', script,
    },
    meta: { durationMs: 4200, tts: { voice: 'af_heart+bf_lily:0.3', script } },
  });

  assert.ok(stored, 'the rewrite produced stored bytes');
  assert.equal(writes.length, 1);
  assert.equal(writes[0]!.id, 'user/tts/123-hello', 'the asset id never moves');
  assert.equal(writes[0]!.patch.credentialFormat, 'wav');
  assert.deepEqual(writes[0]!.patch.meta, { durationMs: 4200, tts: { voice: 'af_heart+bf_lily:0.3', script } });

  // The credential binds these bytes and says what the voice actually read:
  // the marks-bearing script, not the prose someone first typed.
  const { collectActionChain } = await import('../../../../engine/src/c2pa-extract.ts');
  const created = collectActionChain(writes[0]!.patch.credential as Uint8Array)
    .find((s) => s.action === 'c2pa.created');
  const params = created?.parameters as Map<string, unknown>;
  assert.equal(params.get('script'), script);
  assert.equal(params.get('voice'), 'af_heart+bf_lily:0.3');
  assert.equal(hasRiffC2pa(new Uint8Array(await stored.arrayBuffer())), true);
});

test('a clip with no edited script still stamps the prose it was generated from', async () => {
  const writes: Array<{ patch: Record<string, unknown> }> = [];
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: { _replaceUserAssetBytes: async (_id: string, patch: never) => { writes.push({ patch }); } },
  } as unknown as TtsRewriteHost;

  await rewriteTtsClip(host, {
    id: 'user/tts/123-hello',
    name: 'Hello',
    blob: new Blob([bareWav(2048) as BlobPart], { type: 'audio/wav' }),
    recipe: { text: 'Hello from Lolly.', voice: 'bf_lily', speed: 1, model: TTS_MODEL, lang: 'en' },
  });
  const { collectActionChain } = await import('../../../../engine/src/c2pa-extract.ts');
  const created = collectActionChain(writes[0]!.patch.credential as Uint8Array)
    .find((s) => s.action === 'c2pa.created');
  assert.equal((created?.parameters as Map<string, unknown>).get('script'), 'Hello from Lolly.');
});

test('ttsRecipeFromMeta reads a stored script, and a failed write reports no rewrite', async () => {
  const recipe = ttsRecipeFromMeta(ttsMeta({ script: 'Hello from Lolly.\n[pause] Again.' }));
  assert.equal(recipe?.script, 'Hello from Lolly.\n[pause] Again.');
  assert.equal(recipe?.text, 'Hello from Lolly, this voice is synthetic.', 'the prose is still its own field');
  // A clip that never carried one keeps `script` absent rather than empty.
  assert.equal('script' in (ttsRecipeFromMeta(ttsMeta()) ?? {}), false);

  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: { _replaceUserAssetBytes: async () => { throw new Error('quota'); } },
  } as unknown as TtsRewriteHost;
  assert.equal(await rewriteTtsClip(host, {
    id: 'user/tts/123-hello', name: 'Hello',
    blob: new Blob([bareWav() as BlobPart], { type: 'audio/wav' }),
    recipe: { text: 'Hello.', voice: 'bf_lily', speed: 1, model: TTS_MODEL, lang: 'en' },
  }), null);
});
