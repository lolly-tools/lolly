// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the "Available offline" download engine - the pure download
 * machinery (list downloads with resume/cancel/failure semantics, the docs
 * file-list selection). The IDB-backed part records and the actual service
 * worker serving are covered elsewhere (sw.test.ts drives the real sw.js).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Minimal Cache Storage + fetch stand-ins (same shape sw.test.ts fakes) ────

class FakeCache {
  entries = new Map<string, { body: string; headers: Map<string, string> }>();
  async match(key: string | { url?: string }) {
    const k = typeof key === 'string' ? k1(key) : k1(key.url ?? '');
    const held = this.entries.get(k);
    if (!held) return undefined;
    return { headers: { get: (n: string) => held.headers.get(n.toLowerCase()) ?? null } };
  }
  async put(key: string | { url?: string }, resp: { _body: string; headers: Headers | Map<string, string> }) {
    const k = typeof key === 'string' ? k1(key) : k1(key.url ?? '');
    const headers = new Map<string, string>();
    const h = resp.headers as { forEach?: (fn: (v: string, n: string) => void) => void };
    h.forEach?.((v, n) => headers.set(n.toLowerCase(), v));
    this.entries.set(k, { body: resp._body, headers });
  }
  async keys() { return [...this.entries.keys()].map(url => ({ url: `https://x${url}` })); }
  async delete(key: { url: string }) { return this.entries.delete(k1(key.url)); }
}
const k1 = (u: string): string => (u.startsWith('http') ? new URL(u).pathname : u);

const cacheStore = new Map<string, FakeCache>();
(globalThis as Record<string, unknown>).caches = {
  async open(name: string) {
    if (!cacheStore.has(name)) cacheStore.set(name, new FakeCache());
    return cacheStore.get(name)!;
  },
  async delete(name: string) { return cacheStore.delete(name); },
};

/** URLs the fake network serves, with sizes; a missing URL 404s. */
const server = new Map<string, number>();
let fetches: string[] = [];
(globalThis as Record<string, unknown>).fetch = async (url: string, init?: { signal?: AbortSignal }) => {
  init?.signal?.throwIfAborted();
  fetches.push(url);
  const size = server.get(url);
  if (size === undefined) {
    return { ok: false, status: 404, headers: new Headers({ 'content-type': 'text/html' }), blob: async () => new Blob(['nope']) };
  }
  const body = 'x'.repeat(size);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    // content-encoding + a COMPRESSED content-length, the way a br/gzip host
    // answers - what the poisoning regression test needs on the wire.
    headers: new Headers({
      'content-type': 'application/octet-stream',
      'content-encoding': 'br',
      'content-length': String(Math.ceil(size / 2)),
    }),
    blob: async () => new Blob([body]),
    _body: body,
  };
};

const {
  downloadList, docsFileList, speechFileLists, downloadSpeechFiles,
  clearSpeechCaches, speechCacheBytes, TRANSFORMERS_CACHE, SPEECH_CACHE, ORT_HF_CACHE,
  downloadRewordFiles, downloadReword, clearRewordCaches, rewordCacheBytes,
  downloadAskFiles, downloadAsk, clearAskCaches, askCacheBytes,
  trustmarkGroupSplit, verifyModelKeys,
} = await import('./offline-manager.ts');
const { DURABLE_ENCODER_FILE, DURABLE_ENCODER_PATH } = await import('./durable-model.ts');

beforeEach(() => {
  cacheStore.clear();
  server.clear();
  fetches = [];
});

describe('offline-manager: downloadList', () => {
  test('downloads every file, reports byte progress, and lands them in the bucket', async () => {
    server.set('/assets/a.js', 100);
    server.set('/fonts/b.woff2', 50);
    const seen: Array<{ loaded: number; total: number | null }> = [];
    const res = await downloadList('bucket', [
      { url: '/assets/a.js', size: 100 },
      { url: '/fonts/b.woff2', size: 50 },
    ], { onProgress: p => seen.push({ loaded: p.loaded, total: p.total }) });

    assert.deepEqual(res, { bytes: 150, files: 2 });
    assert.equal(cacheStore.get('bucket')!.entries.size, 2);
    assert.equal(seen[0]!.loaded, 0, 'progress starts at zero');
    assert.equal(seen.at(-1)!.loaded, 150, 'progress ends at the full byte total');
    assert.ok(seen.every(p => p.total === 150));
  });

  test('stored responses carry no transfer headers and a manifest-size stamp', async () => {
    // Regression pin for the content-decoding poisoning: fetch() hands back a
    // DECODED body, so replaying the wire content-encoding header over it
    // breaks every offline load of that file. The stored entry must drop the
    // encoding headers and stamp the manifest identity for resumes.
    server.set('/fonts/a.woff2', 64);
    await downloadList('bucket', [{ url: '/fonts/a.woff2', size: 64 }]);
    const held = cacheStore.get('bucket')!.entries.get('/fonts/a.woff2')!;
    assert.equal(held.headers.get('content-encoding'), undefined, 'wire encoding must not survive');
    assert.equal(held.headers.get('x-lolly-manifest-size'), '64');
  });

  test('a hash-carrying manifest entry revalidates by hash, not size', async () => {
    server.set('/icons/logo.svg', 40);
    await downloadList('bucket', [{ url: '/icons/logo.svg', size: 40, hash: 'aaaa' }]);
    fetches = [];
    // Same URL, same size, DIFFERENT bytes (new hash) - must re-download.
    await downloadList('bucket', [{ url: '/icons/logo.svg', size: 40, hash: 'bbbb' }]);
    assert.deepEqual(fetches, ['/icons/logo.svg'], 'a same-size content change must not be invisible');
    fetches = [];
    // Unchanged hash - must skip.
    await downloadList('bucket', [{ url: '/icons/logo.svg', size: 40, hash: 'bbbb' }]);
    assert.deepEqual(fetches, [], 'an unchanged file must resume for free');
  });

  test('resumes: files already present and current are not re-fetched', async () => {
    server.set('/assets/a.js', 100);
    server.set('/data/big.bin', 500);
    await downloadList('bucket', [{ url: '/assets/a.js', size: 100 }]);
    fetches = [];

    const res = await downloadList('bucket', [
      { url: '/assets/a.js', size: 100 },       // hashed name - existence is proof
      { url: '/data/big.bin', size: 500 },      // new file - must fetch
    ]);
    assert.deepEqual(res, { bytes: 600, files: 2 });
    assert.deepEqual(fetches, ['/data/big.bin'], 'the already-downloaded file must be skipped');
  });

  test('a size mismatch on a non-hashed path re-downloads (stale copy ≠ downloaded)', async () => {
    server.set('/info/page.html', 80);
    await downloadList('bucket', [{ url: '/info/page.html', size: 80 }]);
    fetches = [];
    // The deploy changed the page: manifest now says 90 bytes.
    server.set('/info/page.html', 90);
    await downloadList('bucket', [{ url: '/info/page.html', size: 90 }]);
    assert.deepEqual(fetches, ['/info/page.html'], 'a stale-size copy must re-fetch');
  });

  test('throws when any file fails, after draining the rest - never silently partial', async () => {
    server.set('/assets/a.js', 10);
    // /assets/missing.js is not served → 404 (an HTML body, the SPA-fallback shape)
    await assert.rejects(
      downloadList('bucket', [
        { url: '/assets/a.js', size: 10 },
        { url: '/assets/missing.js', size: 20 },
      ]),
      /1 of 2 files failed/,
    );
    assert.ok(cacheStore.get('bucket')!.entries.has('/assets/a.js'),
      'the good file stays cached for the retry to resume from');
  });

  test('cancel aborts the queue and leaves already-fetched files for the resume', async () => {
    const controller = new AbortController();
    server.set('/a', 10);
    server.set('/b', 10);
    let calls = 0;
    const onProgress = () => { if (++calls === 2) controller.abort(); }; // after the first file lands
    await assert.rejects(
      downloadList('bucket', [{ url: '/a', size: 10 }, { url: '/b', size: 10 }],
        { signal: controller.signal, onProgress }),
    );
    assert.ok(cacheStore.get('bucket')!.entries.size >= 1, 'completed files survive the cancel');
  });
});

describe('offline-manager: docsFileList', () => {
  const manifest = {
    version: 'v1',
    groups: {
      en: [{ url: '/info/index.html', size: 1 }],
      shots: [{ url: '/info/shots/a.svg', size: 2 }],
      audio: [{ url: '/info/audio/en/index/audio.opus', size: 9 }],
      locales: { fr: [{ url: '/info/fr/index.html', size: 3 }] },
    },
  };

  test('English installs take the root pages + shots only', () => {
    assert.deepEqual(docsFileList(manifest, 'en').map(f => f.url),
      ['/info/index.html', '/info/shots/a.svg']);
  });

  test('a translated install adds its locale on top', () => {
    assert.deepEqual(docsFileList(manifest, 'fr').map(f => f.url),
      ['/info/index.html', '/info/shots/a.svg', '/info/fr/index.html']);
  });

  test('an unknown locale degrades to the English set', () => {
    assert.deepEqual(docsFileList(manifest, 'xx').map(f => f.url),
      ['/info/index.html', '/info/shots/a.svg']);
  });

  // Narration must never silently fatten "Available offline: Docs"
  // (plans/40-docs-audio-listen.md section 7) - the group is excluded for every locale.
  test('the audio group never rides along in the docs part', () => {
    for (const lang of ['en', 'fr', 'xx']) {
      assert.ok(!docsFileList(manifest, lang).some(f => f.url.includes('/audio/')),
        `${lang} docs part must not include narration`);
    }
  });
});

describe('offline-manager: speech part', () => {
  // A precache.json speech group as vite.config.js's groupPrecacheFiles emits
  // it: the Kokoro model set. The IDB-free downloadSpeechFiles is what these
  // tests drive; downloadSpeech is that plus the part record.
  const manifest = {
    version: 'v1',
    groups: {
      app: [], ort: [], models: [],
      speech: [
        { url: '/models/kokoro/onnx/model_quantized.onnx', size: 1000 },
        { url: '/models/kokoro/config.json', size: 10 },
        { url: '/models/kokoro/tokenizer.json', size: 20 },
        { url: '/models/kokoro/tokenizer_config.json', size: 5 },
        { url: '/models/kokoro/voices/af_heart.bin', size: 100 },
        { url: '/models/kokoro/voices/bm_fable.bin', size: 100 },
      ],
    },
  };
  const serveAll = () => { for (const f of manifest.groups.speech) server.set(f.url, f.size); };

  test('the file list splits voice matrices from the model files', () => {
    const { model, voices } = speechFileLists(manifest);
    assert.deepEqual(model.map(f => f.url), [
      '/models/kokoro/onnx/model_quantized.onnx',
      '/models/kokoro/config.json',
      '/models/kokoro/tokenizer.json',
      '/models/kokoro/tokenizer_config.json',
    ]);
    assert.deepEqual(voices.map(f => f.url),
      ['/models/kokoro/voices/af_heart.bin', '/models/kokoro/voices/bm_fable.bin']);
  });

  test('a manifest built before the speech group existed yields no files', () => {
    assert.deepEqual(speechFileLists({ version: 'v0', groups: { app: [], ort: [], models: [] } }),
      { model: [], voices: [] });
  });

  test('downloads land in the exact buckets the speech runtime reads', async () => {
    serveAll();
    const seen: Array<{ loaded: number; total: number | null }> = [];
    const res = await downloadSpeechFiles(manifest, { onProgress: p => seen.push({ loaded: p.loaded, total: p.total }) });
    assert.deepEqual(res, { bytes: 1235, files: 6 });
    const tf = cacheStore.get(TRANSFORMERS_CACHE)!;
    // The model file must sit under the SAME key bridge/speech.ts's cached()
    // probes and transformers.js's hub reads - a mismatch here downloads
    // ~92 MB the worker then re-downloads.
    assert.ok(tf.entries.has('/models/kokoro/onnx/model_quantized.onnx'));
    assert.equal(tf.entries.size, 4, 'model/config/tokenizer files only');
    const sp = cacheStore.get(SPEECH_CACHE)!;
    assert.deepEqual([...sp.entries.keys()].sort(),
      ['/models/kokoro/voices/af_heart.bin', '/models/kokoro/voices/bm_fable.bin'],
      'voice matrices ride the worker\'s own bucket, keyed by path');
    assert.equal(seen.at(-1)!.loaded, 1235, 'one progress bar spans both buckets');
    assert.ok(seen.every(p => p.total === 1235));
  });

  test('prune evicts stale kokoro entries but never a model outside the listing', async () => {
    serveAll();
    const tf = cacheStore.get(TRANSFORMERS_CACHE) ?? new FakeCache();
    cacheStore.set(TRANSFORMERS_CACHE, tf);
    // A retired model file (stale deploy) and a Whisper model cached through
    // its own consent flow before joining the manifest.
    tf.entries.set('/models/kokoro/onnx/model_old.onnx', { body: 'x', headers: new Map() });
    tf.entries.set('/models/whisper/model.onnx', { body: 'x', headers: new Map() });
    await downloadSpeechFiles(manifest);
    assert.ok(!tf.entries.has('/models/kokoro/onnx/model_old.onnx'), 'stale listing-scope entries are pruned');
    assert.ok(tf.entries.has('/models/whisper/model.onnx'), 'unlisted model dirs are out of prune scope');
  });

  test('remove clears the speech entries but never the reword model sharing the bucket', async () => {
    serveAll();
    await downloadSpeechFiles(manifest);
    const tf = cacheStore.get(TRANSFORMERS_CACHE)!;
    // The reword model shares transformers-cache (plans/127): removing Speech
    // must evict its own directories only, not a 370 MB neighbour.
    tf.entries.set('/models/reword/smollm2-360m-instruct/onnx/model_q4.onnx', { body: 'x', headers: new Map() });
    await clearSpeechCaches();
    assert.ok(![...tf.entries.keys()].some(k => k.startsWith('/models/kokoro/')), 'kokoro entries are gone');
    assert.ok(tf.entries.has('/models/reword/smollm2-360m-instruct/onnx/model_q4.onnx'), 'the reword model survives');
    assert.ok(!cacheStore.has(SPEECH_CACHE), 'the voice bucket is gone');
    assert.ok(!cacheStore.has(ORT_HF_CACHE), 'the runtime bucket goes by default');
  });

  test('remove keeps the shared /ort-hf/ runtime when asked (the other part still needs it)', async () => {
    serveAll();
    await downloadSpeechFiles(manifest);
    cacheStore.set(ORT_HF_CACHE, new FakeCache());
    await clearSpeechCaches({ keepOrtHf: true });
    assert.ok(cacheStore.has(ORT_HF_CACHE), 'the runtime bucket survives for the reword part');
  });

  test('speechCacheBytes measures both buckets for the storage meter, reword excluded', async () => {
    serveAll();
    await downloadSpeechFiles(manifest);
    cacheStore.get(TRANSFORMERS_CACHE)!.entries.set(
      '/models/reword/smollm2-360m-instruct/tokenizer.json',
      { body: 'x', headers: new Map([['content-length', '777']]) },
    );
    assert.deepEqual(await speechCacheBytes(), { bytes: 1235, files: 6 },
      'the reword slice of the shared bucket never fattens the speech meter');
  });
});

describe('offline-manager: reword part (plans/127)', () => {
  const manifest = {
    version: 'v1',
    groups: {
      app: [], ort: [], models: [],
      ortHf: [{ url: '/ort-hf/1.0/ort-wasm-simd.wasm', size: 50 }],
      reword: [
        { url: '/models/reword/smollm2-360m-instruct/onnx/model_q4.onnx', size: 2000 },
        { url: '/models/reword/smollm2-360m-instruct/tokenizer.json', size: 30 },
        { url: '/models/reword/smollm2-360m-instruct/config.json', size: 10 },
      ],
    },
  };
  const serveAll = () => {
    for (const f of [...manifest.groups.reword, ...manifest.groups.ortHf]) server.set(f.url, f.size);
  };

  test('downloads land under the path keys the reword worker reads, runtime included', async () => {
    serveAll();
    const seen: Array<{ loaded: number; total: number | null }> = [];
    const res = await downloadRewordFiles(manifest, { onProgress: p => seen.push({ loaded: p.loaded, total: p.total }) });
    assert.deepEqual(res, { bytes: 2090, files: 4 });
    const tf = cacheStore.get(TRANSFORMERS_CACHE)!;
    // The model file must sit under the SAME key lib/reworder.ts's status()
    // probes and transformers.js's hub reads - a mismatch downloads ~370 MB
    // the worker then re-downloads.
    assert.ok(tf.entries.has('/models/reword/smollm2-360m-instruct/onnx/model_q4.onnx'));
    assert.ok(cacheStore.get(ORT_HF_CACHE)!.entries.has('/ort-hf/1.0/ort-wasm-simd.wasm'),
      'pre-downloading Reword is offline-complete, runtime included');
    assert.equal(seen.at(-1)!.loaded, 2090, 'one progress bar spans both buckets');
  });

  test('rewordCacheBytes measures only the reword slice', async () => {
    serveAll();
    await downloadRewordFiles(manifest);
    assert.deepEqual(await rewordCacheBytes(), { bytes: 2040, files: 3 },
      'the /ort-hf/ runtime is counted under speech, never twice');
  });

  test('remove clears the reword slice only; kokoro survives in the shared bucket', async () => {
    serveAll();
    await downloadRewordFiles(manifest);
    const tf = cacheStore.get(TRANSFORMERS_CACHE)!;
    tf.entries.set('/models/kokoro/config.json', { body: 'x', headers: new Map() });
    await clearRewordCaches({ keepOrtHf: true });
    assert.ok(![...tf.entries.keys()].some(k => k.startsWith('/models/reword/')), 'reword entries are gone');
    assert.ok(tf.entries.has('/models/kokoro/config.json'), 'the speech model survives');
    assert.ok(cacheStore.has(ORT_HF_CACHE), 'the runtime bucket survives for the speech part');
  });

  test('a build without the staged model refuses to record an empty download', async () => {
    await assert.rejects(
      () => downloadReword({ version: 'v1', groups: { app: [], ort: [], models: [] } }),
      /no reword model/,
    );
  });
});

describe('offline-manager: ask part (plans/103 M1)', () => {
  const manifest = {
    version: 'v1',
    groups: {
      app: [], ort: [], models: [],
      ortHf: [{ url: '/ort-hf/1.0/ort-wasm-simd.wasm', size: 50 }],
      embed: [
        { url: '/models/embed/onnx/model_quantized.onnx', size: 900 },
        { url: '/models/embed/tokenizer.json', size: 20 },
        { url: '/models/embed/config.json', size: 5 },
      ],
    },
  };
  const serveAll = () => {
    for (const f of [...manifest.groups.embed, ...manifest.groups.ortHf]) server.set(f.url, f.size);
  };

  test('downloads land under the path keys the embed worker reads, runtime included', async () => {
    serveAll();
    const seen: Array<{ loaded: number; total: number | null }> = [];
    const res = await downloadAskFiles(manifest, { onProgress: p => seen.push({ loaded: p.loaded, total: p.total }) });
    assert.deepEqual(res, { bytes: 975, files: 4 });
    const tf = cacheStore.get(TRANSFORMERS_CACHE)!;
    // The model file must sit under the SAME key embed.ts's cachedEmbedModel()
    // probes and transformers.js's hub reads - a mismatch downloads ~23 MB the
    // worker then re-downloads.
    assert.ok(tf.entries.has('/models/embed/onnx/model_quantized.onnx'));
    assert.ok(cacheStore.get(ORT_HF_CACHE)!.entries.has('/ort-hf/1.0/ort-wasm-simd.wasm'),
      'pre-downloading the Ask model is offline-complete, runtime included');
    assert.equal(seen.at(-1)!.loaded, 975, 'one progress bar spans both buckets');
  });

  test('askCacheBytes measures only the embed slice', async () => {
    serveAll();
    await downloadAskFiles(manifest);
    assert.deepEqual(await askCacheBytes(), { bytes: 925, files: 3 },
      'the /ort-hf/ runtime is counted under speech, never twice');
  });

  test('remove clears the embed slice only; kokoro and reword survive in the shared bucket', async () => {
    serveAll();
    await downloadAskFiles(manifest);
    const tf = cacheStore.get(TRANSFORMERS_CACHE)!;
    tf.entries.set('/models/kokoro/config.json', { body: 'x', headers: new Map() });
    tf.entries.set('/models/reword/smollm2-360m-instruct/config.json', { body: 'x', headers: new Map() });
    await clearAskCaches({ keepOrtHf: true });
    assert.ok(![...tf.entries.keys()].some(k => k.startsWith('/models/embed/')), 'embed entries are gone');
    assert.ok(tf.entries.has('/models/kokoro/config.json'), 'the speech model survives');
    assert.ok(tf.entries.has('/models/reword/smollm2-360m-instruct/config.json'), 'the reword model survives');
    assert.ok(cacheStore.has(ORT_HF_CACHE), 'the runtime bucket survives for the other parts');
  });

  test('a build without the staged model refuses to record an empty download', async () => {
    await assert.rejects(
      () => downloadAsk({ version: 'v1', groups: { app: [], ort: [], models: [] } }),
      /no embed model/,
    );
  });
});

describe('offline-manager: the durable-credential part (plans/202 WP4.2)', () => {
  // The encoder and the deep-scan decoders share one IndexedDB store and one
  // manifest group. Two parts, one store, so each has to own its files by NAME:
  // taking Verify off a device must leave a durable export working, and removing
  // the durable model must not disarm the deep scan.

  test('the manifest group splits into the two parts that share the store', () => {
    const models = [
      { url: '/models/trustmark/decoder_Q.onnx', size: 47_401_222 },
      { url: '/models/trustmark/decoder_P.onnx', size: 47_400_467 },
      { url: DURABLE_ENCODER_PATH, size: 34_603_555 },
      { url: '/models/trustmark/resizer.onnx', size: 454 },
    ];
    const split = trustmarkGroupSplit(models);
    assert.deepEqual(split.durable.map(f => f.url), [DURABLE_ENCODER_PATH]);
    assert.deepEqual(split.verify.map(f => f.url), [
      '/models/trustmark/decoder_Q.onnx',
      '/models/trustmark/decoder_P.onnx',
      '/models/trustmark/resizer.onnx',
    ]);
    // No file counted twice: the two rows in Profile must add up to the group.
    const sum = (fs: { size: number }[]) => fs.reduce((n, f) => n + f.size, 0);
    assert.equal(sum(split.verify) + sum(split.durable), sum(models));
  });

  test('a manifest with no encoder entry leaves the durable half empty', () => {
    const split = trustmarkGroupSplit([{ url: '/models/trustmark/decoder_Q.onnx', size: 10 }]);
    assert.deepEqual(split.durable, []);
    assert.equal(split.verify.length, 1);
  });

  test('removing Verify keeps the durable encoder, and only the encoder', () => {
    const keys = ['decoder_Q.onnx', 'decoder_P.onnx', 'resizer.onnx', '__ready__', DURABLE_ENCODER_FILE];
    assert.deepEqual(verifyModelKeys(keys), ['decoder_Q.onnx', 'decoder_P.onnx', 'resizer.onnx', '__ready__']);
    assert.ok(!verifyModelKeys(keys).includes(DURABLE_ENCODER_FILE));
  });
});
