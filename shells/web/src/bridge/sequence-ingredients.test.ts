// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-ingredients - the provenance gather a sequence export owes its stamp.
 *
 * This file exists because the renderer it serves cannot be tested. The frame loop
 * is canvas, WebCodecs and dom-to-image, so `renderSequenceAuthored` is browser-tier
 * (tests/sequence-render.browser.test.ts) and the node suites beside it are pure
 * helpers and source scans. Every DECISION in the gather - which source of truth
 * wins, what a failure costs, when a scan is refused - was therefore pushed into a
 * dependency-injected module so it could be run for real here, against a genuinely
 * signed fixture rather than a shape that merely looks like one.
 *
 * The fixture is built the way tests/c2pa.test.ts builds one: the engine's own
 * embedder signs a tiny container, and the engine's own extractor reads it back. So
 * a passing ingredient here is one the C2PA writer would actually accept.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/sequence-ingredients.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { gatherSequenceIngredients, type SequenceIngredientSource } from './sequence-ingredients.ts';
import { embedC2pa } from '../../../../engine/src/c2pa.ts';
import { extractC2paStore } from '../../../../engine/src/c2pa-verify.ts';
import type { IngredientCredential } from '@lolly-tools/core/host-v1';

// ── fixtures ────────────────────────────────────────────────────────────────
// A minimal RIFF/WAVE - enough grammar for the embedder and the extractor, which
// is all either one reads (neither decodes samples). Same shape the capture-clip
// suite next door uses.
function tinyWav(frames = 32, sampleRate = 24000): Uint8Array {
  const dataLen = frames * 2;
  const u8 = new Uint8Array(44 + dataLen);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => { for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames; i++) dv.setInt16(44 + i * 2, ((i % 16) - 8) * 1024, true);
  return u8;
}

/** A signed clip: the bytes a fetch would return, and the store an id lookup serves. */
async function signedClip(title: string): Promise<{ bytes: Uint8Array; store: Uint8Array; format: string }> {
  const bytes = await embedC2pa(tinyWav(), 'wav', {
    title,
    claimGenerator: 'LollyTest/1.0',
    generatorInfo: { name: 'Lolly', version: '1.9.0' },
    environment: { tool: 'Fixture Tool', format: 'wav', surface: 'test', engine: 'node', os: 'test' },
  });
  const ex = extractC2paStore(bytes);
  assert.ok(ex, `the ${title} fixture must carry an extractable store`);
  return { bytes, store: ex!.store, format: ex!.format };
}

// Signing generates a key pair per call, so the two clips are built once and shared.
const CLIP_A = await signedClip('Clip A');
const CLIP_B = await signedClip('Clip B');

const src = (url: string, kind: SequenceIngredientSource['kind'] = 'video'): SequenceIngredientSource => ({ kind, url });

// ── the resolution order ────────────────────────────────────────────────────

test('the id-based credential wins, and the byte scan is never reached', async () => {
  // Not a preference: a user upload's pixels were re-encoded at ingest, so its
  // store lives beside the record and NOT in the bytes the timeline plays. If the
  // scan ran first it would answer "nothing" for exactly the sources most likely
  // to be credentialed.
  const fetched: string[] = [];
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:clip-a')], sink, {
    credentialForUrl: async () => ({ store: CLIP_A.store, format: CLIP_A.format }),
    fetchBytes: async (url) => { fetched.push(url); return CLIP_B.bytes; },
  });
  assert.equal(sink.length, 1, 'one source, one ingredient');
  assert.equal(typeof sink[0]!.activeLabel, 'string');
  assert.ok(sink[0]!.manifestBoxes.length >= 1, 'the manifest boxes ride verbatim');
  assert.deepEqual(fetched, [], 'a credential that answered must not also cost a full media fetch');
});

test('the scan is told the id route answered NOTHING, so a caller cannot skip it', async () => {
  // The defect this pins cost a credential every time: the real caller skipped the
  // byte scan for any URL the asset bridge could name an id for, on the premise
  // that `credential(id)` had already answered for it. A `user/` record answers
  // from a stored field with no scan behind it, so a video job's own output - which
  // signs its provenance INTO its bytes - resolved to an id, to null, and to a skip.
  const seen: Array<{ url: string; answered: boolean }> = [];
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:job-output'), src('blob:upload')], sink, {
    credentialForUrl: async (url) => (url === 'blob:upload' ? { store: CLIP_A.store, format: CLIP_A.format } : null),
    // Exactly the shape sequence-render.ts wires in: read nothing when the id
    // route answered, read the bytes when it did not.
    fetchBytes: async (url, answered) => {
      seen.push({ url, answered });
      return answered ? null : CLIP_B.bytes;
    },
  });
  assert.deepEqual(seen, [{ url: 'blob:job-output', answered: false }],
    'the answered source is never re-read, and the unanswered one is');
  assert.equal(sink.length, 2, 'both clips are credited: one from the store, one from the bytes');
  assert.ok(sink.some(i => i.title === 'Clip B'), 'including the one only the scan could find');
});

test('the byte scan is the fallback when no id resolves', async () => {
  // The case with no id to find: a catalog clip served over http, or a file the
  // user dropped straight onto the timeline.
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('https://example.test/bed.wav', 'audio')], sink, {
    credentialForUrl: async () => null,
    fetchBytes: async () => CLIP_B.bytes,
  });
  assert.equal(sink.length, 1, 'the scan found the manifest the id lookup could not');
  assert.ok(sink[0]!.manifestBoxes.length >= 1);
});

test('a credential store that will not parse falls through to the scan', async () => {
  // The two routes read different bytes, so one of them failing says nothing about
  // the other - returning early here would drop a recoverable ingredient.
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:half-written')], sink, {
    credentialForUrl: async () => ({ store: new Uint8Array([1, 2, 3, 4]), format: 'wav' }),
    fetchBytes: async () => CLIP_A.bytes,
  });
  assert.equal(sink.length, 1, 'the scan rescued it');
});

test('a source with nothing signed contributes nothing, quietly', async () => {
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:plain')], sink, {
    credentialForUrl: async () => null,
    fetchBytes: async () => tinyWav(),
  });
  assert.deepEqual(sink, [], 'carrying no credential is the ordinary case, not a failure');
});

// ── the relationship ────────────────────────────────────────────────────────

test('every ingredient is componentOf, whichever route found it', async () => {
  // The embedder defaults a relationship-less ingredient to `parentOf`, and C2PA
  // allows at most ONE of those per claim - so a two-clip timeline written the
  // default way reports multipleParents and the film's whole credential reads as
  // invalid. A clip is also simply not a parent: the film is composed WITH it, the
  // same word the SVG/PDF walker uses for a bitmap it inlines into the same sink.
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:from-store'), src('blob:from-bytes', 'audio')], sink, {
    credentialForUrl: async (url) => (url === 'blob:from-store' ? { store: CLIP_A.store, format: CLIP_A.format } : null),
    fetchBytes: async () => CLIP_B.bytes,
  });
  assert.equal(sink.length, 2, 'both routes produced one');
  for (const ing of sink) assert.equal(ing.relationship, 'componentOf', `${ing.title} is a component of the film`);
});

// ── the cost guards ─────────────────────────────────────────────────────────

test('bytes over the scan cap are refused rather than parsed', async () => {
  // A timeline can hold several multi-hundred-megabyte clips. Reading all of them
  // to look for a manifest most of them do not carry is a cost nobody asked for.
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:huge')], sink, {
    credentialForUrl: async () => null,
    fetchBytes: async () => CLIP_A.bytes,
    maxScanBytes: 8,
  });
  assert.deepEqual(sink, [], 'the cap holds even against a genuinely signed file');
  // …and the same file under a cap that fits is gathered, so the refusal above is
  // the cap acting and not the fixture failing.
  const ok: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:huge')], ok, {
    credentialForUrl: async () => null,
    fetchBytes: async () => CLIP_A.bytes,
    maxScanBytes: CLIP_A.bytes.length,
  });
  assert.equal(ok.length, 1);
});

test('a fetch that declines (null, or empty bytes) costs nothing', async () => {
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:gone'), src('blob:empty')], sink, {
    credentialForUrl: async () => null,
    fetchBytes: async (url) => (url === 'blob:empty' ? new Uint8Array(0) : null),
  });
  assert.deepEqual(sink, []);
});

// ── deduplication ───────────────────────────────────────────────────────────

test('the same clip placed twice is one ingredient, resolved once', async () => {
  const asked: string[] = [];
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients(
    [src('blob:clip-a'), src('blob:clip-a', 'audio'), src('blob:clip-a')],
    sink,
    {
      credentialForUrl: async (url) => { asked.push(url); return { store: CLIP_A.store, format: CLIP_A.format }; },
      fetchBytes: async () => null,
    },
  );
  assert.equal(sink.length, 1, 'one URL, one ingredient');
  assert.deepEqual(asked, ['blob:clip-a'], 'and it is resolved once, not once per placement');
});

test('two URLs serving the same manifest are still one ingredient', async () => {
  // renderFormat dedupes the sink against what the runtime already supplied, but
  // not the sink against itself - so the same manifest arriving down two URLs (a
  // clip and the bed pointing at one file) would otherwise be listed twice.
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:one'), src('blob:two', 'audio')], sink, {
    credentialForUrl: async () => ({ store: CLIP_A.store, format: CLIP_A.format }),
  });
  assert.equal(sink.length, 1);
});

test('an ingredient already in the sink is not added a second time', async () => {
  const first: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:clip-a')], first, {
    credentialForUrl: async () => ({ store: CLIP_A.store, format: CLIP_A.format }),
  });
  assert.equal(first.length, 1);
  // A second gather over the same sink (the ZIP path re-dispatches members; the
  // SVG/PDF walker fills this same sink) must not double-list it.
  await gatherSequenceIngredients([src('blob:clip-a-again')], first, {
    credentialForUrl: async () => ({ store: CLIP_A.store, format: CLIP_A.format }),
  });
  assert.equal(first.length, 1, 'deduped by activeLabel, not just by URL');
  // A genuinely different manifest still lands.
  await gatherSequenceIngredients([src('blob:clip-b')], first, {
    credentialForUrl: async () => ({ store: CLIP_B.store, format: CLIP_B.format }),
  });
  assert.equal(first.length, 2);
  assert.notEqual(first[0]!.activeLabel, first[1]!.activeLabel);
});

// ── never fatal ─────────────────────────────────────────────────────────────

test('a dependency that throws never escapes, and the rest of the list still resolves', async () => {
  // A provenance gather failing is not a reason to refuse someone their film.
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:bad'), src('blob:good')], sink, {
    credentialForUrl: async (url) => {
      if (url === 'blob:bad') throw new Error('IndexedDB went away');
      return { store: CLIP_B.store, format: CLIP_B.format };
    },
    fetchBytes: async (url) => { if (url === 'blob:bad') throw new Error('network down'); return null; },
  });
  assert.equal(sink.length, 1, 'the failed source is skipped, not the whole gather');
});

test('a synchronously throwing dependency is caught too', async () => {
  const sink: IngredientCredential[] = [];
  await gatherSequenceIngredients([src('blob:x')], sink, {
    credentialForUrl: () => { throw new Error('boom'); },
    fetchBytes: () => { throw new Error('boom'); },
  });
  assert.deepEqual(sink, []);
});

// ── the empty cases ─────────────────────────────────────────────────────────

test('no sources, no deps, or a source with no URL: a no-op that asks nothing', async () => {
  let asked = 0;
  const sink: IngredientCredential[] = [];
  const count = { credentialForUrl: async () => { asked++; return null; } };
  await gatherSequenceIngredients([], sink, count);
  assert.equal(asked, 0, 'an empty timeline resolves nothing');
  await gatherSequenceIngredients([src('')], sink, count);
  assert.equal(asked, 0, 'a media box with no src is not a source');
  // No deps at all is the shape a caller with no host takes: it must not throw.
  await gatherSequenceIngredients([src('blob:whatever')], sink);
  assert.deepEqual(sink, []);
});
