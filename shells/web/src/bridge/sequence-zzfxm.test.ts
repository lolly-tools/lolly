// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-zzfxm.test.ts - the procedural (`zzfxm:`) audio source.
 *
 * WHAT THIS PROVES, AND WHY IT IS A SEPARATE FILE FROM sequence-providers.test.ts.
 * Everything here is about ONE property - that a seed and a length determine the
 * bytes, totally, forever. That is a different kind of claim from the decoder
 * plumbing its sibling covers, and it is the claim a shared link depends on: the
 * recipient of a `?boxes=…zzfxm:20260726…` url must hear the tune the author
 * heard, on another device, next year, offline.
 *
 * The song is rendered with the ENGINE's real `renderZzfxm` (injected in place of
 * the shipped Worker, which Node has no use for), so these are real samples from
 * the real synth - not a mock standing in for one.
 *
 * NOT PROVEN HERE: that the mix places the bed correctly (sequence-render's job,
 * covered there), and that the panel draws a waveform for it (browser tier).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ZZFXM_MAX_TARGET_SEC,
  ZZFXM_MIN_TARGET_SEC,
  ZZFXM_SCHEME,
  createClipAudio,
  formatZzfxmRef,
  generatedSongSpec,
  parseZzfxmRef,
  zzfxmTargetSec,
  type ClipAudioOpts,
} from './sequence-providers.ts';
import { composeSong } from '../../../../engine/src/zzfx-compose.ts';
import { renderZzfxm, type RenderedPcm, type ZzfxSong } from '../../../../engine/src/zzfxm.ts';

// ── harness ─────────────────────────────────────────────────────────────────

/** The real synth, standing in for the Worker. Records what it was asked to render. */
function realRenderer(): {
  render: (s: ZzfxSong) => Promise<RenderedPcm>;
  calls: () => number;
  songs: ZzfxSong[];
} {
  const songs: ZzfxSong[] = [];
  return {
    render: async (song) => { songs.push(song); return renderZzfxm(song); },
    calls: () => songs.length,
    songs,
  };
}

/** Peak absolute sample. A loop, not `Math.max(...arr)` - these arrays are 6-figure long. */
function peakOf(ch: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i] as number); if (v > peak) peak = v; }
  return peak;
}

function deps(render: (s: ZzfxSong) => Promise<RenderedPcm>): ClipAudioOpts {
  // hasWebCodecs deliberately false: a procedural clip must open on a platform
  // with no AudioDecoder at all, which is half the point of shipping one.
  return { deps: { renderSong: render, hasWebCodecs: () => false }, timeoutMs: 0 };
}

function digest(channels: Float32Array[]): string {
  // FNV-1a over the raw sample bits. Cheap, and sensitive to a single flipped
  // bit - "byte-identical" has to mean bytes, not "sounds about the same".
  let h = 0x811c9dc5;
  for (const ch of channels) {
    const bytes = new Uint8Array(ch.buffer, ch.byteOffset, ch.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i] as number;
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16);
}

// ── the grammar ─────────────────────────────────────────────────────────────

test('parseZzfxmRef: accepts a bare seed', () => {
  assert.deepEqual(parseZzfxmRef('zzfxm:20260726'), { seed: 20260726 });
  assert.deepEqual(parseZzfxmRef('zzfxm:0'), { seed: 0 });
  assert.deepEqual(parseZzfxmRef('zzfxm:4294967295'), { seed: 4294967295 });
});

test('parseZzfxmRef: accepts a recognised style', () => {
  assert.deepEqual(parseZzfxmRef('zzfxm:7:lofi'), { seed: 7, style: 'lofi' });
  assert.deepEqual(parseZzfxmRef('zzfxm:7:drumAndBass'), { seed: 7, style: 'drumAndBass' });
});

test('parseZzfxmRef: an unrecognised style degrades to the seed\'s own, it does not fail the bed', () => {
  assert.deepEqual(parseZzfxmRef('zzfxm:7:jazzhands'), { seed: 7, rawStyle: 'jazzhands' });
  // Style matching is exact - a case slip is a typo, not an alias.
  assert.deepEqual(parseZzfxmRef('zzfxm:7:LoFi'), { seed: 7, rawStyle: 'LoFi' });
});

test('parseZzfxmRef: an empty style segment is the same as no style', () => {
  assert.deepEqual(parseZzfxmRef('zzfxm:7:'), { seed: 7 });
});

test('parseZzfxmRef: rejects everything that is not the grammar', () => {
  for (const bad of [
    'zzfxm:', 'zzfxm:abc', 'zzfxm:-1', 'zzfxm:1.5', 'zzfxm:0x10', 'zzfxm: 7', 'zzfxm:7 ',
    'zzfxm:12345678901',            // 11 digits - past uint32's decimal width
    'zzfxm:7:lofi:extra',           // a third segment is not in the grammar
    'blob:https://x/y', 'https://x/a.mp3', 'data:audio/wav;base64,AA', 'ZZFXM:7', '',
  ]) {
    assert.equal(parseZzfxmRef(bad), null, `should not parse: ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, 7, {}, ['zzfxm:7']]) assert.equal(parseZzfxmRef(bad), null);
});

test('formatZzfxmRef round-trips through parseZzfxmRef', () => {
  for (const s of ['zzfxm:20260726', 'zzfxm:7:lofi', 'zzfxm:0:ambient']) {
    const ref = parseZzfxmRef(s);
    assert.ok(ref);
    assert.equal(formatZzfxmRef(ref), s);
    assert.deepEqual(parseZzfxmRef(formatZzfxmRef(ref)), ref);
  }
});

// ── the spec is totally determined ──────────────────────────────────────────

test('generatedSongSpec: no Math.random / Date / performance leak on the spec path', () => {
  // A source guard rather than a behavioural one: a future edit that reaches for
  // a random archetype "just for variety" would break every shared link, and the
  // failure would show up as "the music changed", months later, with no stack.
  const src = readFileSync(fileURLToPath(new URL('./sequence-providers.ts', import.meta.url)), 'utf8');
  const section = src.slice(src.indexOf('procedural audio: the `zzfxm:` scheme'));
  assert.ok(section.length > 1000, 'the procedural section moved - retarget this guard');
  const code = section.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['Math.random', 'Date.now', 'new Date', 'performance.now', 'crypto.']) {
    assert.equal(code.includes(forbidden), false, `${forbidden} destroys reproducibility`);
  }
});

test('generatedSongSpec: same inputs ⇒ deeply equal spec', () => {
  assert.deepEqual(generatedSongSpec(20260726, 30), generatedSongSpec(20260726, 30));
  assert.deepEqual(generatedSongSpec(7, 12, 'lofi'), generatedSongSpec(7, 12, 'lofi'));
});

test('generatedSongSpec: a named style overrides only the archetype', () => {
  const bare = generatedSongSpec(4242, 30);
  const styled = generatedSongSpec(4242, 30, 'jungle');
  assert.equal(styled.archetype, 'jungle');
  // The rng stream is consumed in the same order either way, so the progression
  // and the pan are untouched - only the tempo moves, because it is drawn from
  // the (now different) archetype's window with the same random draw.
  assert.deepEqual(styled.roots, bare.roots);
  assert.equal(styled.pan, bare.pan);
  assert.equal(styled.scale, bare.scale);
  assert.equal(styled.seed, 4242);
});

test('generatedSongSpec: different seeds diverge', () => {
  const a = generatedSongSpec(1, 30);
  const b = generatedSongSpec(2, 30);
  assert.notDeepEqual(a, b);
});

test('generatedSongSpec: the seed is coerced to uint32, and only targetSec is free', () => {
  const a = generatedSongSpec(5, 30);
  const b = generatedSongSpec(5, 60);
  assert.equal(a.archetype, b.archetype);
  assert.equal(a.bpm, b.bpm);
  assert.deepEqual(a.roots, b.roots);
  assert.equal(a.targetSec, 30);
  assert.equal(b.targetSec, 60);
});

// ── the target-length grid ──────────────────────────────────────────────────

test('zzfxmTargetSec: rounds UP to the grid, clamps to the floor and ceiling', () => {
  assert.equal(zzfxmTargetSec(0), ZZFXM_MIN_TARGET_SEC);
  assert.equal(zzfxmTargetSec(-5), ZZFXM_MIN_TARGET_SEC);
  assert.equal(zzfxmTargetSec(Number.NaN), ZZFXM_MIN_TARGET_SEC);
  assert.equal(zzfxmTargetSec(1e9), ZZFXM_MAX_TARGET_SEC);
  assert.equal(zzfxmTargetSec(30), 30);
  assert.equal(zzfxmTargetSec(30.01), 30.5);
  assert.equal(zzfxmTargetSec(30.5), 30.5);
});

test('zzfxmTargetSec: absorbs float jitter in totalMs - the whole reason it exists', () => {
  // 8000ms and 8000.0000001ms are the same composition, or a preview and its
  // export would be different songs.
  assert.equal(zzfxmTargetSec(20), zzfxmTargetSec(20 + 1e-9));
  assert.equal(zzfxmTargetSec(20.4), zzfxmTargetSec(20.499999));
});

// ── the ClipAudio ───────────────────────────────────────────────────────────

test('createClipAudio: a zzfxm ref opens without WebCodecs and reports no intrinsic duration', async () => {
  const r = realRenderer();
  const clip = await createClipAudio('zzfxm:20260726', deps(r.render));
  assert.ok(clip, 'a procedural ref must never come back null');
  // 0 is the contract with sequence-render's mix: "ask me for exactly the window
  // the box occupies". A non-zero value here would silently truncate every bed.
  assert.equal(clip.durationSec(), 0);
  await clip.dispose();
});

test('createClipAudio: a malformed zzfxm ref is a silent clip, never a demux attempt', async () => {
  const warns: string[] = [];
  const clip = await createClipAudio('zzfxm:not-a-seed', {
    deps: { hasWebCodecs: () => false, loadMediabunny: () => { throw new Error('must not be reached'); } },
    log: (_l, m) => warns.push(m),
  });
  assert.equal(clip, null);
  assert.equal(warns.length, 1);
  assert.match(warns[0] as string, /not a valid zzfxm: ref/);
});

test('createClipAudio: an unknown style warns but still plays', async () => {
  const r = realRenderer();
  const warns: string[] = [];
  const clip = await createClipAudio('zzfxm:7:jazzhands', { ...deps(r.render), log: (_l, m) => warns.push(m) });
  assert.ok(clip);
  assert.match(warns.join('\n'), /unknown zzfxm: style "jazzhands"/);
  const { channels } = await clip.pcm(0, 2, 48_000);
  assert.equal(channels.length, 2);
  await clip.dispose();
});

test('DETERMINISM: two independent clips of the same ref and window are byte-identical', async () => {
  const a = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  const b = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  assert.ok(a && b);
  const pa = await a.pcm(0, 6, 48_000);
  const pb = await b.pcm(0, 6, 48_000);
  assert.equal(pa.channels.length, 2);
  assert.ok((pa.channels[0] as Float32Array).length > 0);
  assert.equal(digest(pa.channels), digest(pb.channels));
  // Not just the hash: every sample, so a hash collision cannot hide a defect.
  for (let c = 0; c < pa.channels.length; c++) {
    assert.deepEqual(
      Array.from(pa.channels[c] as Float32Array),
      Array.from(pb.channels[c] as Float32Array),
      `channel ${c} diverged`,
    );
  }
  await a.dispose(); await b.dispose();
});

test('DETERMINISM: the rendered audio is not silence (a trivially-equal pass would prove nothing)', async () => {
  const clip = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  assert.ok(clip);
  const { channels } = await clip.pcm(0, 6, 48_000);
  const peak = peakOf(channels[0] as Float32Array);
  assert.ok(peak > 0.01, `expected audible samples, peak was ${peak}`);
  await clip.dispose();
});

test('DETERMINISM: a different seed produces different audio', async () => {
  const a = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  const b = await createClipAudio('zzfxm:20260727', deps(realRenderer().render));
  assert.ok(a && b);
  const pa = await a.pcm(0, 6, 48_000);
  const pb = await b.pcm(0, 6, 48_000);
  assert.notEqual(digest(pa.channels), digest(pb.channels));
  await a.dispose(); await b.dispose();
});

test('DETERMINISM: a named style produces different audio from the bare seed', async () => {
  const a = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  // `classical` is one of the four the seed can never draw, so this cannot
  // accidentally name the archetype the bare seed already chose.
  const b = await createClipAudio('zzfxm:20260726:classical', deps(realRenderer().render));
  assert.ok(a && b);
  const pa = await a.pcm(0, 6, 48_000);
  const pb = await b.pcm(0, 6, 48_000);
  assert.notEqual(digest(pa.channels), digest(pb.channels));
  await a.dispose(); await b.dispose();
});

test('the window is trimmed and sized exactly like a decoded clip', async () => {
  const clip = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  assert.ok(clip);
  const rate = 48_000;
  const { channels, sampleRate } = await clip.pcm(1.5, 4, rate);
  assert.equal(sampleRate, rate);
  assert.equal((channels[0] as Float32Array).length, Math.round(2.5 * rate));
  // The same window read out of the same song twice is the same samples - the
  // read is a pure slice of a cached render, not a fresh composition.
  const again = await clip.pcm(1.5, 4, rate);
  assert.equal(digest(channels), digest(again.channels));
  await clip.dispose();
});

test('an offset window really is offset (it is not just re-reading from zero)', async () => {
  const clip = await createClipAudio('zzfxm:20260726', deps(realRenderer().render));
  assert.ok(clip);
  const head = await clip.pcm(0, 2, 48_000);
  const later = await clip.pcm(2, 4, 48_000);
  assert.notEqual(digest(head.channels), digest(later.channels));
  await clip.dispose();
});

test('the song is composed ONCE per target length, then sliced', async () => {
  const r = realRenderer();
  const clip = await createClipAudio('zzfxm:20260726', { ...deps(r.render), targetSec: 30 });
  assert.ok(clip);
  await clip.pcm(0, 5, 48_000);
  await clip.pcm(5, 10, 48_000);
  await clip.pcm(10, 15, 48_000);
  assert.equal(r.calls(), 1, 'three windows of one bed must be three slices of one song');
  await clip.dispose();
});

test('an explicit targetSec wins over the window end, and lengthens the arrangement', async () => {
  const long = realRenderer();
  const clip = await createClipAudio('zzfxm:20260726', { ...deps(long.render), targetSec: 45 });
  assert.ok(clip);
  await clip.pcm(0, 3, 48_000);

  const short = realRenderer();
  const bare = await createClipAudio('zzfxm:20260726', deps(short.render));
  assert.ok(bare);
  await bare.pcm(0, 3, 48_000);   // window end 3s → clamped up to the 8s floor

  // Both composed the same seed, so the arrangement OPENS the same way (which is
  // why comparing the first three seconds of PCM would prove nothing) - what
  // differs is how long it runs. That is the "a bed re-composes when the
  // sequence changes length" rule, observed where it is actually visible.
  assert.equal(long.calls(), 1);
  assert.equal(short.calls(), 1);
  const longSeq = (long.songs[0] as ZzfxSong).sequence.length;
  const shortSeq = (short.songs[0] as ZzfxSong).sequence.length;
  assert.ok(longSeq > shortSeq, `expected a longer arrangement, got ${longSeq} vs ${shortSeq}`);
  await clip.dispose(); await bare.dispose();
});

test('a render failure is coded, not cached, and retryable', async () => {
  let n = 0;
  const clip = await createClipAudio('zzfxm:9', {
    timeoutMs: 0,
    deps: {
      hasWebCodecs: () => false,
      renderSong: async (song) => { n++; if (n === 1) throw new Error('worker died'); return renderZzfxm(song); },
    },
  });
  assert.ok(clip);
  await assert.rejects(() => clip.pcm(0, 3, 48_000), (e: Error & { code?: string }) => {
    assert.equal(e.code, 'SEQ_DECODE_FAILED');
    return true;
  });
  const ok = await clip.pcm(0, 3, 48_000);
  assert.ok((ok.channels[0] as Float32Array).length > 0, 'a dead worker must not poison the clip forever');
  assert.equal(n, 2);
  await clip.dispose();
});

test('dispose is idempotent and closes the clip to further reads', async () => {
  const clip = await createClipAudio('zzfxm:9', deps(realRenderer().render));
  assert.ok(clip);
  await clip.dispose();
  await clip.dispose();
  await assert.rejects(() => clip.pcm(0, 1, 48_000), (e: Error & { code?: string }) => e.code === 'SEQ_ABORTED');
});

// ── the ref survives the wire ───────────────────────────────────────────────

test('a zzfxm ref survives the blocks-row asset-ref form and URL encoding unharmed', () => {
  // The shape url-mode.ts mints for an unresolved asset sub-field, verbatim.
  const ref = { source: 'library', id: 'zzfxm:20260726', _unresolved: true } as const;
  const roundTripped = JSON.parse(JSON.stringify(ref)) as typeof ref;
  assert.equal(roundTripped.id, 'zzfxm:20260726');
  assert.ok(parseZzfxmRef(roundTripped.id));
  // And through a query string: the colon is legal unencoded in a query value,
  // and survives encode/decode either way.
  const url = new URL(`https://lolly.tools/tool/sequence-studio?bed=${encodeURIComponent(ref.id)}`);
  assert.equal(url.searchParams.get('bed'), 'zzfxm:20260726');
  assert.ok(parseZzfxmRef(url.searchParams.get('bed')));
});

test('the assets bridge RESOLVES a zzfxm ref to itself, so the bed reaches the mix', async () => {
  // THE BUG THIS EXISTS FOR. The manifest assertion below is tautological on its
  // own: it re-reads a string and hands it to the parser. What actually broke was
  // one step earlier - the engine's `resolveOne` calls `host.assets.get(id)`, the
  // bridge threw "Asset not in catalog", the catch nulled the field BEFORE hooks
  // ran, `hooks.js` emitted no `data-audio-src` marker at all, and the mix never
  // saw the bed. A working default became a silent one with nothing logged as an
  // error. So: prove the bridge answers.
  const { createAssetsAPI } = await import('./assets.ts');
  const api = createAssetsAPI({
    get: async () => undefined,
    getAll: async () => [],
    getAllKeys: async () => [],
    put: async () => {},
    delete: async () => {},
  } as unknown as Parameters<typeof createAssetsAPI>[0]);

  const ref = await api.get('zzfxm:20260726');
  assert.equal(ref.type, 'audio');
  // The url IS the id: a procedural asset resolves to its own name, which is what
  // carries the seed to `createClipAudio` through the marker hooks.js writes.
  assert.equal(ref.url, 'zzfxm:20260726');
  assert.ok(parseZzfxmRef(ref.url), 'and what comes out the other side still parses');

  // A style-bearing ref, and a canonicalising one.
  assert.equal((await api.get('zzfxm:7:lofi')).url, 'zzfxm:7:lofi');
  // A malformed ref is an ERROR, not a silently-dropped field - the one thing
  // worse than a broken bed is a broken bed nobody is told about.
  await assert.rejects(() => api.get('zzfxm:not-a-seed'), /Malformed procedural audio ref/);
});

test('the scheme prefix is the exported constant the tool default is authored against', () => {
  assert.equal(ZZFXM_SCHEME, 'zzfxm:');
});

// ── the shipped default composition ─────────────────────────────────────────

test('the Design video template ships a procedural bed, not a catalog loop', () => {
  // Migrated from Sequence Studio (retired into Design, plans/104): the "carry a
  // procedural, licence-free bed" contract now lives on Design's Video template.
  const tpl = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../community/design/templates/video.json', import.meta.url)), 'utf8'),
  ) as { values?: { boxes?: { kind?: string; image?: { id?: string } }[] } };
  const boxes = tpl.values?.boxes;
  assert.ok(Array.isArray(boxes));
  const bed = boxes.find(b => b.kind === 'audio');
  assert.ok(bed, 'the video template must carry an audio bed');
  const ref = parseZzfxmRef(bed.image?.id);
  assert.ok(ref, `the bed must be a procedural ref, got ${JSON.stringify(bed.image?.id)}`);
  // Pinned: changing the shipped seed changes the tune every existing share link
  // of the untouched template renders. It is a contract, not a preference.
  assert.equal(bed.image?.id, 'zzfxm:20260807');
  // Offline by construction - no fetch, no brand pack, no licence surface.
  const song = composeSong(generatedSongSpec(ref.seed, 8));
  assert.ok(song.sequence.length > 0 && song.patterns.length > 0);
});
