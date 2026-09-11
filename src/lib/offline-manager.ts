// SPDX-License-Identifier: MPL-2.0
import { assertAiAllowed, modelCapability, runAi } from './ai-policy.ts';
/**
 * The "Available offline" download manager - the engine behind the profile
 * view's offline section.
 *
 * offline-pins.ts makes ONE TOOL a guarantee; this module makes the PROMISE a
 * guarantee: a user with an hour of airport wifi can pull down every part of
 * the app they'll need for a connectionless flight and watch a real progress
 * bar while it happens. Five downloadable parts, each landing in the
 * service-worker bucket (or store) that actually serves it offline:
 *
 *   app - the full build payload (dist/precache.json `app` group: every
 *             hashed /assets/ chunk incl. lazy views + locale chunks +
 *             HarfBuzz wasm, the bundled UI fonts, icons, share stubs) into
 *             the APP_CACHE bucket. Closes the biggest hole in the offline
 *             story: before this, a lazy chunk cached only if its code path
 *             ran while online.
 *   docs - the /info site (its manifest.json: the English pages, the
 *             shared screenshots, plus the active locale) into INFO_CACHE.
 *   verify - the deep-scan machinery: the onnxruntime-web runtime
 *             (precache.json `ort` group) into ORT_CACHE, plus the TrustMark /
 *             Content Seal models through their own IndexedDB fetchers
 *             (lib/trustmark.ts, lib/contentseal.ts). ~220 MB - opt-in.
 *   durable - the TrustMark ENCODER behind the export panel's "Durable
 *             credential" toggle (lib/trustmark-embed.ts), ~33 MB. It shares the
 *             'trustmark-models' IDB store with verify's decoders, so the two
 *             parts own their own KEYS there and neither clears the store.
 *   speech - the on-device voice models (Kokoro - plans/41-tts-stt-programme.md
 *             section 3): model/config/tokenizer files into transformers.js's OWN
 *             'transformers-cache' bucket under the exact request keys its hub
 *             probes (bridge/speech.ts cached() matches the same shape), voice
 *             style matrices into the worker's 'lolly-speech' bucket - the
 *             SAME caches the speech runtime reads, so a downloaded part means
 *             zero bytes move on first synthesis. Opt-in, like verify.
 *   catalog - brand/catalog assets beyond the core tier, whole or scoped by
 *             tag. The BYTES go through catalog/sync.ts's checksum-verified
 *             prefetch into the IDB blob cache (threaded in by the view, same
 *             cycle-avoidance as offline-pins' PrefetchAssets); this module
 *             owns the SELECTION (which tags / all), which sync.ts reads back
 *             at boot to keep those blobs out of the browsed-but-unsaved prune
 *             and refreshed with the core tier.
 *
 * (Tools stay offline-pins.ts's job - the profile section drives both.)
 *
 * Downloads are resumable and cancellable: every file already present (same
 * URL, and where sizes are known, same byte size) is skipped, so a dropped
 * connection or a cancelled run resumes from where it stopped, and a deploy
 * re-downloads only the delta (hashed /assets/ names miss the cache only when
 * their content actually changed). An AbortController threads through every
 * fetch. Part state (which parts are downloaded, at which manifest version)
 * persists in IndexedDB next to the pin map - device-local, never in the
 * portable backup.
 *
 * resyncOfflineParts() keeps a downloaded install current: called from the
 * boot idle path (catalog/sync.ts, beside the pinned-tool refresh), it
 * re-syncs any downloaded part whose manifest version watermark moved.
 */

import { openDB } from '../bridge/db.ts';
import { currentLang } from '../i18n.ts';
import { MODELS_BASE } from './models-base.ts';
import { UPSCALE_MODEL_STORE, UPSCALE_MODEL_CACHE_VERSION } from './upscale-models.ts';
import { MATTE_MODEL_STORE, MATTE_MODEL_CACHE_VERSION } from './matte-models.ts';
import { OCR_MODEL_STORE, OCR_MODEL_CACHE_VERSION } from './ocr-models.ts';
import {
  DURABLE_ENCODER_BYTES, DURABLE_ENCODER_CACHE_VERSION, DURABLE_ENCODER_FILE, DURABLE_ENCODER_PATH,
  DURABLE_MODEL_STORE,
} from './durable-model.ts';

/** The page-owned, unversioned Cache Storage buckets sw.js serves offline
 *  fallbacks from. Mirrored by sw.js (APP_CACHE / ORT_CACHE / INFO_CACHE
 *  there) - keep the literals in sync, same contract as offline-pins.ts's
 *  PIN_CACHE. */
export const APP_CACHE = 'lolly-app';
export const ORT_CACHE = 'lolly-ort';
/** The transformers.js speech runtime (/ort-hf/<version>/ort-wasm-*), OWNED by the
 *  speech part so pre-downloading Speech is offline-complete - it used to ride in the
 *  verify-owned ORT_CACHE. sw.js serves /ort-hf/ from HERE, falling back to ORT_CACHE
 *  for users who pre-downloaded it via Verify before this split. Also in sw.js's
 *  PERSISTENT_CACHES. */
export const ORT_HF_CACHE = 'lolly-ort-hf';
export const INFO_CACHE = 'lolly-info';

/** The speech buckets (also in sw.js's PERSISTENT_CACHES). 'transformers-cache'
 *  is transformers.js's own bucket name - not ours to rename; a key mismatch
 *  here would download ~92 MB the worker then re-downloads, so the speech part
 *  writes the same path-shaped keys lib/speech-kokoro-worker.ts reads. */
export const TRANSFORMERS_CACHE = 'transformers-cache';
export const SPEECH_CACHE = 'lolly-speech';

/** Key of the part-state record inside the 'profile' KV store (a sibling of
 *  offline-pins' map - device-local by design, see the module comment). */
const PARTS_KEY = 'offline-parts';

/** One downloadable file as the manifests list it. `hash` (sha256, base64url,
 *  truncated) is present for files whose URL does not already encode their
 *  content (everything except the content-hash-named /assets/ chunks and the
 *  huge, release-versioned /ort/ + /models/ binaries) - it is what lets a
 *  resume distinguish "current" from "same size, different bytes". */
export interface ManifestFile { url: string; size: number; hash?: string }

/** dist/precache.json - emitted by the vite build (see vite.config.js's
 *  precacheManifest plugin). Absent in dev (the dev server has no dist). */
export interface PrecacheManifest {
  version: string;
  /** `models`/`upscale`/`matte` are size metadata only - those bytes download
   *  through the detectors' / model runners' own IndexedDB path (lib/trustmark.ts,
   *  lib/model-prefetch.ts), never through downloadList. `ortHf`/`speech`/`upscale`/`matte`
   *  are optional: manifests built before those parts existed don't carry the group. */
  groups: {
    app: ManifestFile[]; ort: ManifestFile[]; models: ManifestFile[];
    ortHf?: ManifestFile[]; speech?: ManifestFile[]; upscale?: ManifestFile[]; matte?: ManifestFile[]; ocr?: ManifestFile[];
    /** The reword model (plans/127) - transformers-cache path keys, like speech.
     *  Empty on builds where the model is not staged. */
    reword?: ManifestFile[];
    /** The AI-text detector (plans/126 WP-A) - transformers-cache path keys,
     *  like speech and reword. Empty on builds where no model is staged. */
    aiDetect?: ManifestFile[];
    /** The Ask embedding model (plans/103 M1) - transformers-cache path keys,
     *  like speech and reword. Empty on builds where the model is not staged. */
    embed?: ManifestFile[];
  };
}

/** /info/manifest.json - emitted by docs/build.ts. `audio` is the docs
 *  narration + its player bundle (plans/40-docs-audio-listen.md section 7); optional
 *  because manifests built before it existed don't carry the group. */
export interface InfoManifest {
  version: string;
  groups: { en: ManifestFile[]; shots: ManifestFile[]; audio?: ManifestFile[]; locales: Record<string, ManifestFile[]> };
}

export type OfflinePartId = 'app' | 'docs' | 'verify' | 'catalog' | 'speech' | 'upscale' | 'matte' | 'ocr' | 'reword' | 'ask' | 'ai-detect' | 'durable';

/** What one downloaded part records. `version` is the manifest watermark the
 *  download completed against; resyncOfflineParts re-downloads the delta when
 *  the live manifest's version differs. */
export interface PartRecord {
  at: string;
  version: string;
  bytes: number;
  files: number;
  /** docs: the locale downloaded alongside English. */
  lang?: string;
  /** catalog: the scope - 'all' or the selected tag list. */
  tags?: 'all' | string[];
}

export type PartState = Partial<Record<OfflinePartId, PartRecord>>;

/** Byte-level progress for one running download. `total` is the sum of the
 *  manifest-listed sizes (bytes already on device count as loaded, so a resume
 *  starts the bar where it left off); null while a phase can't know its total
 *  (the model fetchers report a running total that goes null on any file
 *  without a Content-Length). */
export interface DownloadProgress {
  loaded: number;
  total: number | null;
  done: number;
  count: number;
}
export type OnProgress = (p: DownloadProgress) => void;

async function readParts(): Promise<PartState> {
  const db = await openDB();
  return ((await db.get('profile', PARTS_KEY)) as PartState | undefined) ?? {};
}

async function writeParts(parts: PartState): Promise<void> {
  const db = await openDB();
  await db.put('profile', parts, PARTS_KEY);
}

/** The recorded state of every downloaded part. */
export async function partRecords(): Promise<PartState> {
  return readParts();
}

// Every read-modify-write of the part map goes through one in-page queue: the
// profile UI and the boot-idle resync can both finish a download in the same
// session, and two interleaved readParts→writeParts round-trips would lose one
// record (or resurrect a part the user just removed).
let partsChain: Promise<unknown> = Promise.resolve();
function withParts<T>(fn: () => Promise<T>): Promise<T> {
  const next = partsChain.then(fn, fn);
  partsChain = next.catch(() => {});
  return next;
}

function recordPart(id: OfflinePartId, rec: PartRecord): Promise<void> {
  return withParts(async () => {
    const parts = await readParts();
    parts[id] = rec;
    await writeParts(parts);
  });
}

function forgetPart(id: OfflinePartId): Promise<void> {
  return withParts(async () => {
    const parts = await readParts();
    if (parts[id]) {
      delete parts[id];
      await writeParts(parts);
    }
  });
}

/** Fetch + parse a download manifest; null when it isn't there (dev server, or
 *  an instance built before manifests existed). The SPA-fallback guard matters:
 *  a missing /precache.json comes back as the app shell's HTML with a 200. */
async function fetchManifest<T>(url: string): Promise<T | null> {
  try {
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok || (resp.headers.get('content-type') ?? '').includes('text/html')) return null;
    return await resp.json() as T;
  } catch {
    return null;
  }
}

export function fetchPrecacheManifest(): Promise<PrecacheManifest | null> {
  return fetchManifest<PrecacheManifest>('/precache.json');
}

export function fetchInfoManifest(): Promise<InfoManifest | null> {
  return fetchManifest<InfoManifest>('/info/manifest.json');
}

/** The docs file list for one install: English pages + shared shots + the
 *  active locale's pages (English needs no extra group). The `audio` group is
 *  deliberately NOT included: narration grows linearly with pages × locales and
 *  must never silently fatten "Available offline: Docs". If demand appears it
 *  becomes its own opt-in part with its size shown honestly; until then online
 *  playback caches incidentally through the SW's lolly-info bucket. */
export function docsFileList(manifest: InfoManifest, lang: string): ManifestFile[] {
  const { en, shots, locales } = manifest.groups;
  return [...en, ...shots, ...(lang !== 'en' ? locales[lang] ?? [] : [])];
}

/** The header a downloaded entry records its manifest identity under - what a
 *  resume compares instead of guessing from transfer headers. */
const HASH_HEADER = 'x-lolly-manifest-hash';
const SIZE_HEADER = 'x-lolly-manifest-size';

/** Is this cached copy still the manifest's copy? Hashed /assets/ names make
 *  existence proof enough. Everything else compares the manifest identity the
 *  download stamped onto the stored response: the content hash when the
 *  manifest carries one, else the DECODED byte size (never the wire
 *  Content-Length - that is the compressed transfer size on a br/gzip host
 *  and comparing it to the on-disk manifest size would re-download every file
 *  on every resume). A stale or unstamped entry is treated as absent. */
async function cachedMatches(cache: Cache, file: ManifestFile): Promise<boolean> {
  const held = await cache.match(file.url);
  if (!held) return false;
  if (/^\/assets\//.test(file.url)) return true;
  if (file.hash) return held.headers.get(HASH_HEADER) === file.hash;
  const stamped = held.headers.get(SIZE_HEADER);
  return stamped !== null && Number(stamped) === file.size;
}

/** Store one fetched file. The response is REBUILT around the decoded body:
 *  fetch() transparently decodes br/gzip but leaves the wire headers, so
 *  putting the original headers with a decoded body poisons the entry - the
 *  browser would try to decode it AGAIN when the SW replays it offline
 *  (net::ERR_CONTENT_DECODING_FAILED on the exact chunk the download existed
 *  to guarantee). Strip the transfer headers, set the true length, and stamp
 *  the manifest identity for cachedMatches. */
async function putFile(cache: Cache, file: ManifestFile, resp: Response, signal?: AbortSignal): Promise<void> {
  const blob = await resp.blob();
  signal?.throwIfAborted();
  const headers = new Headers(resp.headers);
  headers.delete('content-encoding');
  headers.delete('content-range');
  headers.delete('transfer-encoding');
  headers.set('content-length', String(blob.size));
  headers.set(SIZE_HEADER, String(blob.size));
  if (file.hash) headers.set(HASH_HEADER, file.hash);
  await cache.put(file.url, new Response(blob, { status: resp.status, statusText: resp.statusText, headers }));
}

const DOWNLOAD_CONCURRENCY = 4;

/** Where to actually FETCH a manifest file from. The manifest lists model weights
 *  under same-origin `/models/…`, which is correct for the web deploy (it self-serves
 *  them) but 404s in the desktop shell, whose build prunes `dist/models/` to stay
 *  under the binary-embed limit. There, VITE_MODELS_BASE points at the model host
 *  (https://lolly.tools) so ONLY the pruned `/models/` bytes are pulled from there;
 *  `/ort/`, `/ort-hf/`, `/assets/` etc. stay in the bundle and same-origin. The CACHE
 *  KEY stays `file.url` (relative) so cachedMatches/pruneList are unchanged, and on
 *  the web build MODELS_BASE is '' so this is a no-op (byte-identical). */
const modelFetchUrl = (url: string): string =>
  MODELS_BASE && url.startsWith('/models/') ? MODELS_BASE + url : url;

/**
 * Download a manifest file list into a named bucket. Resumable (files already
 * present and current are folded into `loaded` without a fetch), cancellable
 * (`signal` aborts the in-flight fetches and stops the queue), and honest
 * about failures: any file that can't be fetched throws once the queue
 * drains, so a "downloaded" part is never silently partial.
 */
export async function downloadList(
  cacheName: string,
  files: ManifestFile[],
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<{ bytes: number; files: number }> {
  if (!('caches' in globalThis)) throw new Error('offline download: Cache Storage unavailable');
  const { signal, onProgress } = opts;
  const cache = await caches.open(cacheName);
  const total = files.reduce((n, f) => n + f.size, 0);
  let loaded = 0;
  let done = 0;
  const failures: string[] = [];
  const report = () => onProgress?.({ loaded, total, done, count: files.length });
  report();

  const downloadFile = async (file: ManifestFile, downloadSignal?: AbortSignal): Promise<void> => {
    downloadSignal?.throwIfAborted();
    try {
      if (await cachedMatches(cache, file)) {
        downloadSignal?.throwIfAborted();
        loaded += file.size;
        done++;
        report();
        return;
      }
      const resp = await fetch(modelFetchUrl(file.url), { signal: downloadSignal });
      const ct = resp.headers.get('content-type') ?? '';
      if (!resp.ok || (ct.includes('text/html') && !file.url.endsWith('.html'))) {
        failures.push(file.url);
        return;
      }
      // Buffer before publishing to Cache Storage so policy revocation aborts
      // the download rather than leaving an apparently complete cache entry.
      await putFile(cache, file, resp, downloadSignal);
      loaded += file.size;
      done++;
      report();
    } catch (err) {
      if (downloadSignal?.aborted) throw err;
      failures.push(file.url);
    }
  };
  const queue = [...files];
  const worker = async (): Promise<void> => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      if (/\/models\//.test(file.url)) {
        const current = file;
        await runAi(modelCapability(file.url) ?? 'unclassified', (policySignal) =>
          downloadFile(current, signal ? AbortSignal.any([signal, policySignal]) : policySignal));
      } else await downloadFile(file, signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, files.length) }, worker));
  signal?.throwIfAborted();
  if (failures.length) throw new Error(`offline download: ${failures.length} of ${files.length} files failed (first: ${failures[0]})`);
  return { bytes: total, files: files.length };
}

/** Evict every entry in a bucket that a fresh manifest no longer lists - 
 *  yesterday's hashed chunks and retired docs pages don't deserve quota. */
async function pruneList(cacheName: string, files: ManifestFile[]): Promise<void> {
  const cache = await caches.open(cacheName);
  const keep = new Set(files.map(f => f.url));
  for (const req of await cache.keys()) {
    if (!keep.has(new URL(req.url).pathname)) await cache.delete(req);
  }
}

/** Download the whole app build for offline (see module comment: `app` part). */
export async function downloadApp(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  const res = await downloadList(APP_CACHE, manifest.groups.app, opts);
  await pruneList(APP_CACHE, manifest.groups.app);
  const rec: PartRecord = { at: new Date().toISOString(), version: manifest.version, ...res };
  await recordPart('app', rec);
  return rec;
}

/** Download the /info docs site (English + shots + the active locale). */
export async function downloadDocs(
  manifest: InfoManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  const lang = currentLang();
  const files = docsFileList(manifest, lang);
  const res = await downloadList(INFO_CACHE, files, opts);
  await pruneList(INFO_CACHE, files);
  const rec: PartRecord = { at: new Date().toISOString(), version: manifest.version, lang, ...res };
  await recordPart('docs', rec);
  return rec;
}

/** Split the manifest's `models` group (everything under /models/trustmark/ plus
 *  Content Seal) between the two parts that share the 'trustmark-models' store:
 *  the durable-credential ENCODER, and everything else - the deep-scan decoders
 *  and the resizer, which are the verify part's. Pure, so the sizes the profile
 *  rows quote and the bytes each part actually fetches come from one rule. */
export function trustmarkGroupSplit(
  models: readonly ManifestFile[],
): { verify: ManifestFile[]; durable: ManifestFile[] } {
  const durable = models.filter(f => f.url === DURABLE_ENCODER_PATH);
  return { verify: models.filter(f => f.url !== DURABLE_ENCODER_PATH), durable };
}

/** Which keys of the shared 'trustmark-models' store belong to the VERIFY part -
 *  the decoders, the resizer and trustmark.ts's readiness marker, but never the
 *  durable encoder. Removing Verify must not take the durable model with it (and
 *  the reverse), the same shared-bucket rule the transformers cache follows. */
export function verifyModelKeys(keys: readonly string[]): string[] {
  return keys.filter(k => k !== DURABLE_ENCODER_FILE);
}

/**
 * Download the /verify deep-scan machinery: the ORT runtime into ORT_CACHE,
 * then the TrustMark + Content Seal models through their own IDB fetchers
 * (lazy-imported - those modules must stay off the boot graph). Model bytes
 * report as a running total on top of the runtime's known size, going
 * null-total (indeterminate) if any model omits Content-Length.
 */
export async function downloadVerify(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  assertAiAllowed('watermark');
  const { signal, onProgress } = opts;
  const ortTotal = manifest.groups.ort.reduce((n, f) => n + f.size, 0);
  // Seed the model share of the bar from the manifest's size metadata - the
  // fetchers only learn sizes file by file, and a total that grows under the
  // bar makes it jump backwards. The running total takes over only if it ever
  // exceeds the plan (a bigger model shipped than the manifest knew).
  const plannedModels = trustmarkGroupSplit(manifest.groups.models).verify.reduce((n, f) => n + f.size, 0);
  let modelLoaded = 0;
  let modelTotal: number | null = 0;
  let ortLoaded = 0;
  let ortDone = 0;
  const report = () => onProgress?.({
    loaded: ortLoaded + modelLoaded,
    total: modelTotal === null ? null : ortTotal + Math.max(plannedModels, modelTotal),
    done: ortDone,
    count: manifest.groups.ort.length,
  });

  const res = await downloadList(ORT_CACHE, manifest.groups.ort, {
    signal,
    onProgress: p => { ortLoaded = p.loaded; ortDone = p.done; report(); },
  });
  await pruneList(ORT_CACHE, manifest.groups.ort);

  // Model downloads are the same fetch-once-into-IDB path the /verify header's
  // own "enable deep scan" button uses - one copy, shared consent.
  signal?.throwIfAborted();
  const [{ prefetchTrustmarkModels }, { prefetchContentSealModel }] = await Promise.all([
    import('./trustmark.ts'),
    import('./contentseal.ts'),
  ]);
  const onModel = (p: { loaded: number; total: number | null }): void => {
    modelLoaded = p.loaded;
    modelTotal = p.total;
    report();
  };
  const okTm = await prefetchTrustmarkModels({ onProgress: p => onModel({ loaded: p.loaded, total: p.total }) });
  signal?.throwIfAborted();
  // The durable-watermark ENCODER is deliberately NOT fetched here any more: it is
  // its own part (downloadDurable), so a user who only ever verifies files does not
  // pay 33 MB for the export-side model, and the desktop shell can take the encoder
  // without the 95 MB of decoders. Both parts still land in the same IDB store,
  // keyed per part (verifyModelKeys).
  const modelBase = modelLoaded;
  signal?.throwIfAborted();
  // Best-effort: the Content Seal extractor is usually never vendored at all
  // (its prefetch returns false on the routine 404) - only the TrustMark
  // decoder decides whether this part counts as downloaded.
  await prefetchContentSealModel({ onProgress: p => onModel({ loaded: modelBase + p.loaded, total: p.total === null || modelTotal === null ? null : modelBase + p.total }) });
  if (!okTm) throw new Error('offline download: TrustMark model download incomplete');
  // The model fetchers take no AbortSignal (they finish the file in flight),
  // so a cancel lands HERE at the latest - a cancelled run must never record
  // itself as a completed part.
  signal?.throwIfAborted();

  const rec: PartRecord = {
    at: new Date().toISOString(),
    version: manifest.version,
    bytes: res.bytes + modelLoaded,
    files: res.files,
  };
  await recordPart('verify', rec);
  return rec;
}

/** Split the manifest's speech group between the two buckets the runtime
 *  reads: voice style matrices go to SPEECH_CACHE (lib/speech-kokoro-worker.ts's
 *  getVoiceData fetch-and-put, keyed by path), everything else - the ONNX
 *  model, config, tokenizer, and Whisper files when they ship - to
 *  TRANSFORMERS_CACHE under the same path keys transformers.js's hub probes
 *  (the shape bridge/speech.ts's cached() matches). */
export function speechFileLists(manifest: PrecacheManifest): { model: ManifestFile[]; voices: ManifestFile[] } {
  const files = manifest.groups.speech ?? [];
  const isVoice = (f: ManifestFile): boolean => f.url.startsWith('/models/kokoro/voices/');
  return { model: files.filter(f => !isVoice(f)), voices: files.filter(isVoice) };
}

/** Prune a speech bucket to the manifest listing, but ONLY inside the model
 *  directories the listing covers ('/models/kokoro/', …) - a model cached
 *  through its own consent flow before it joins the manifest (Whisper's
 *  staging order) must not be evicted by a Kokoro-only listing. */
async function pruneSpeechBucket(cacheName: string, files: ManifestFile[]): Promise<void> {
  const prefixes = [...new Set(files.map(f => f.url.split('/').slice(0, 3).join('/') + '/'))];
  const keep = new Set(files.map(f => f.url));
  const cache = await caches.open(cacheName);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (!keep.has(path) && prefixes.some(p => path.startsWith(p))) await cache.delete(req);
  }
}

/** The cache work of the speech part, IDB-free (tested directly): model files
 *  into transformers.js's bucket, voices into the worker's, one progress bar
 *  across both. */
export async function downloadSpeechFiles(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<{ bytes: number; files: number }> {
  assertAiAllowed('speech');
  const { signal, onProgress } = opts;
  const { model, voices } = speechFileLists(manifest);
  // The transformers.js runtime (/ort-hf/) the Kokoro/Whisper worker RUNS on. Owned by
  // the speech part now (it used to ride in the verify-owned `ort` group), so downloading
  // Speech is offline-complete instead of fetching ~22 MB on the first synthesis.
  const ortHf = manifest.groups.ortHf ?? [];
  const total = [...model, ...voices, ...ortHf].reduce((n, f) => n + f.size, 0);
  const count = model.length + voices.length + ortHf.length;
  const zero: DownloadProgress = { loaded: 0, total: 0, done: 0, count: 0 };
  let modelP = zero, voiceP = zero, ortHfP = zero;
  const report = (): void => onProgress?.({
    loaded: modelP.loaded + voiceP.loaded + ortHfP.loaded,
    total,
    done: modelP.done + voiceP.done + ortHfP.done,
    count,
  });
  const a = await downloadList(TRANSFORMERS_CACHE, model, { signal, onProgress: p => { modelP = p; report(); } });
  const b = await downloadList(SPEECH_CACHE, voices, { signal, onProgress: p => { voiceP = p; report(); } });
  const c = await downloadList(ORT_HF_CACHE, ortHf, { signal, onProgress: p => { ortHfP = p; report(); } });
  await pruneSpeechBucket(TRANSFORMERS_CACHE, model);
  await pruneSpeechBucket(SPEECH_CACHE, voices);
  await pruneSpeechBucket(ORT_HF_CACHE, ortHf);
  return { bytes: a.bytes + b.bytes + c.bytes, files: a.files + b.files + c.files };
}

/** Download the speech part - the on-device voice models, into the exact
 *  caches the speech worker reads (plans/41-tts-stt-programme.md section 3). */
export async function downloadSpeech(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  assertAiAllowed('speech');
  const res = await downloadSpeechFiles(manifest, opts);
  const rec: PartRecord = { at: new Date().toISOString(), version: manifest.version, ...res };
  await recordPart('speech', rec);
  return rec;
}

/** Delete a bucket's entries under the given path prefixes only - the shared-
 *  bucket rule: 'transformers-cache' now holds the speech models, the reword
 *  model (plans/127) AND the Ask embed model (plans/103 M1), so no part may
 *  delete the whole bucket. */
async function clearCacheDirs(cacheName: string, prefixes: string[]): Promise<void> {
  try {
    const cache = await caches.open(cacheName);
    for (const req of await cache.keys()) {
      const path = new URL(req.url).pathname;
      if (prefixes.some(p => path.startsWith(p))) await cache.delete(req);
    }
  } catch { /* bucket sealed - nothing to clear */ }
}

/** Delete the speech caches - removePart's cache half, exported for tests.
 *  The runtime re-downloads (behind its own consent line) on next use.
 *  transformers-cache is cleared by DIRECTORY (it is shared with the reword
 *  model since plans/127); `keepOrtHf` keeps the shared /ort-hf/ runtime
 *  bucket when another downloaded part still needs it. */
export async function clearSpeechCaches(opts: { keepOrtHf?: boolean } = {}): Promise<void> {
  if (!('caches' in globalThis)) return;
  await clearCacheDirs(TRANSFORMERS_CACHE, ['/models/kokoro/', '/models/whisper/']);
  await caches.delete(SPEECH_CACHE);
  // The speech-owned runtime bucket. NOT ORT_CACHE's legacy /ort-hf/ copy - that
  // belongs to the verify part; the SW falls back to it if the user has it.
  if (!opts.keepOrtHf) await caches.delete(ORT_HF_CACHE);
}

/** Delete the reword model's slice of the shared transformers bucket. The
 *  /ort-hf/ runtime goes too unless the speech part still holds it. */
export async function clearRewordCaches(opts: { keepOrtHf?: boolean } = {}): Promise<void> {
  if (!('caches' in globalThis)) return;
  await clearCacheDirs(TRANSFORMERS_CACHE, ['/models/reword/']);
  if (!opts.keepOrtHf) await caches.delete(ORT_HF_CACHE);
}

/** Sum one bucket's entries, optionally scoped to path prefixes. Sizes come
 *  from the stamped manifest size (part downloads), else Content-Length (a
 *  worker's own put keeps wire headers), else the body itself. */
async function cacheDirBytes(cacheName: string, prefixes?: string[]): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  try {
    const cache = await caches.open(cacheName);
    for (const req of await cache.keys()) {
      if (prefixes && !prefixes.some(p => new URL(req.url).pathname.startsWith(p))) continue;
      const resp = await cache.match(req);
      if (!resp) continue;
      files++;
      const stamped = resp.headers.get(SIZE_HEADER) ?? resp.headers.get('content-length');
      bytes += stamped ? Number(stamped) : (await resp.blob()).size;
    }
  } catch { /* bucket sealed (incognito iframe) - count nothing */ }
  return { bytes, files };
}

/** Measure the speech caches for the profile storage meter - the buckets also
 *  fill through the Script-audio dialog's consent download, which this must
 *  count without a part record existing. transformers-cache is counted by
 *  DIRECTORY (shared with reword); the /ort-hf/ runtime stays counted here. */
export async function speechCacheBytes(): Promise<{ bytes: number; files: number }> {
  if (!('caches' in globalThis)) return { bytes: 0, files: 0 };
  const parts = await Promise.all([
    cacheDirBytes(TRANSFORMERS_CACHE, ['/models/kokoro/', '/models/whisper/']),
    cacheDirBytes(SPEECH_CACHE),
    cacheDirBytes(ORT_HF_CACHE),
  ]);
  return { bytes: parts.reduce((n, p) => n + p.bytes, 0), files: parts.reduce((n, p) => n + p.files, 0) };
}

/** Measure the reword model's slice for the storage meter (the shared /ort-hf/
 *  runtime is counted under speech, not twice). Fills through the panel's own
 *  consent download too, so no part record is required. */
export async function rewordCacheBytes(): Promise<{ bytes: number; files: number }> {
  if (!('caches' in globalThis)) return { bytes: 0, files: 0 };
  return cacheDirBytes(TRANSFORMERS_CACHE, ['/models/reword/']);
}

/** Delete the AI-text detector's slice of the shared transformers bucket. The
 *  /ort-hf/ runtime goes too unless another downloaded part still holds it. */
export async function clearAiDetectCaches(opts: { keepOrtHf?: boolean } = {}): Promise<void> {
  if (!('caches' in globalThis)) return;
  await clearCacheDirs(TRANSFORMERS_CACHE, ['/models/ai-detect/']);
  if (!opts.keepOrtHf) await caches.delete(ORT_HF_CACHE);
}

/** Measure the AI-text detector's slice for the storage meter. Fills through
 *  the panel's own consent download, so no part record is required. */
export async function aiDetectCacheBytes(): Promise<{ bytes: number; files: number }> {
  if (!('caches' in globalThis)) return { bytes: 0, files: 0 };
  return cacheDirBytes(TRANSFORMERS_CACHE, ['/models/ai-detect/']);
}

/** Delete the Ask embed model's slice of the shared transformers bucket. The
 *  /ort-hf/ runtime goes too unless another downloaded part still holds it. */
export async function clearAskCaches(opts: { keepOrtHf?: boolean } = {}): Promise<void> {
  if (!('caches' in globalThis)) return;
  await clearCacheDirs(TRANSFORMERS_CACHE, ['/models/embed/']);
  if (!opts.keepOrtHf) await caches.delete(ORT_HF_CACHE);
}

/** Measure the Ask embed model's slice for the storage meter (the shared
 *  /ort-hf/ runtime is counted under speech, not twice). Fills through the Ask
 *  view's own consent download too, so no part record is required. */
export async function askCacheBytes(): Promise<{ bytes: number; files: number }> {
  if (!('caches' in globalThis)) return { bytes: 0, files: 0 };
  return cacheDirBytes(TRANSFORMERS_CACHE, ['/models/embed/']);
}

/** The cache work of the ai-detect part (plans/126 WP-A): the detector files
 *  into transformers.js's own bucket under the path keys its hub probes
 *  (lib/ai-detect.ts's status() matches the same shape), plus the shared
 *  /ort-hf/ runtime - the reword part's exact contract. */
export async function downloadAiDetectFiles(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<{ bytes: number; files: number }> {
  assertAiAllowed('ai-detect');
  const { signal, onProgress } = opts;
  const model = manifest.groups.aiDetect ?? [];
  const ortHf = manifest.groups.ortHf ?? [];
  const total = [...model, ...ortHf].reduce((n, f) => n + f.size, 0);
  const count = model.length + ortHf.length;
  const zero: DownloadProgress = { loaded: 0, total: 0, done: 0, count: 0 };
  let modelP = zero, ortHfP = zero;
  const report = (): void => onProgress?.({
    loaded: modelP.loaded + ortHfP.loaded,
    total,
    done: modelP.done + ortHfP.done,
    count,
  });
  const a = await downloadList(TRANSFORMERS_CACHE, model, { signal, onProgress: p => { modelP = p; report(); } });
  const b = await downloadList(ORT_HF_CACHE, ortHf, { signal, onProgress: p => { ortHfP = p; report(); } });
  return { bytes: a.bytes + b.bytes, files: a.files + b.files };
}

/** Download the ai-detect part - the on-device AI-text detector (plans/126
 *  WP-A), into the exact cache the detector worker reads. Guarded on the
 *  group: a build without a staged model records nothing. */
export async function downloadAiDetect(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  assertAiAllowed('ai-detect');
  if (!manifest.groups.aiDetect?.length) throw new Error('offline download: this build carries no AI-text detector');
  const res = await downloadAiDetectFiles(manifest, opts);
  const rec: PartRecord = { at: new Date().toISOString(), version: manifest.version, ...res };
  await recordPart('ai-detect', rec);
  return rec;
}

/** The cache work of the reword part (plans/127), IDB-free (tested directly):
 *  the model files into transformers.js's own bucket under the path keys its
 *  hub probes (lib/reworder.ts's status() matches the same shape), plus the
 *  shared /ort-hf/ runtime, so a pre-download means zero bytes move on first
 *  use - the speech part's exact contract. */
export async function downloadRewordFiles(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<{ bytes: number; files: number }> {
  assertAiAllowed('reword');
  const { signal, onProgress } = opts;
  const model = manifest.groups.reword ?? [];
  const ortHf = manifest.groups.ortHf ?? [];
  const total = [...model, ...ortHf].reduce((n, f) => n + f.size, 0);
  const count = model.length + ortHf.length;
  const zero: DownloadProgress = { loaded: 0, total: 0, done: 0, count: 0 };
  let modelP = zero, ortHfP = zero;
  const report = (): void => onProgress?.({
    loaded: modelP.loaded + ortHfP.loaded,
    total,
    done: modelP.done + ortHfP.done,
    count,
  });
  const a = await downloadList(TRANSFORMERS_CACHE, model, { signal, onProgress: p => { modelP = p; report(); } });
  const b = await downloadList(ORT_HF_CACHE, ortHf, { signal, onProgress: p => { ortHfP = p; report(); } });
  await pruneSpeechBucket(TRANSFORMERS_CACHE, model);
  return { bytes: a.bytes + b.bytes, files: a.files + b.files };
}

/** Download the reword part - the on-device rewriter model (plans/127), into
 *  the exact cache the reword worker reads. Guarded on the group: a build
 *  without the staged model records nothing. */
export async function downloadReword(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  assertAiAllowed('reword');
  if (!manifest.groups.reword?.length) throw new Error('offline download: this build carries no reword model');
  const res = await downloadRewordFiles(manifest, opts);
  const rec: PartRecord = { at: new Date().toISOString(), version: manifest.version, ...res };
  await recordPart('reword', rec);
  return rec;
}

/** The cache work of the ask part (plans/103 M1), IDB-free (tested directly):
 *  the embed model files into transformers.js's own bucket under the path keys
 *  its hub probes, plus the shared /ort-hf/ runtime (idempotent with speech and
 *  reword - the part SIZE shown in Profile counts the embed group only, since
 *  the runtime stays speech-owned), so a pre-download means zero bytes move on
 *  first use - the speech part's exact contract. */
export async function downloadAskFiles(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<{ bytes: number; files: number }> {
  assertAiAllowed('embedding');
  const { signal, onProgress } = opts;
  const model = manifest.groups.embed ?? [];
  const ortHf = manifest.groups.ortHf ?? [];
  const total = [...model, ...ortHf].reduce((n, f) => n + f.size, 0);
  const count = model.length + ortHf.length;
  const zero: DownloadProgress = { loaded: 0, total: 0, done: 0, count: 0 };
  let modelP = zero, ortHfP = zero;
  const report = (): void => onProgress?.({
    loaded: modelP.loaded + ortHfP.loaded,
    total,
    done: modelP.done + ortHfP.done,
    count,
  });
  const a = await downloadList(TRANSFORMERS_CACHE, model, { signal, onProgress: p => { modelP = p; report(); } });
  const b = await downloadList(ORT_HF_CACHE, ortHf, { signal, onProgress: p => { ortHfP = p; report(); } });
  await pruneSpeechBucket(TRANSFORMERS_CACHE, model);
  return { bytes: a.bytes + b.bytes, files: a.files + b.files };
}

/** Download the ask part - the Ask embedding model (plans/103 M1), into the
 *  exact cache the embed worker reads. Guarded on the group: a build without
 *  the staged model records nothing. */
export async function downloadAsk(
  manifest: PrecacheManifest,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  assertAiAllowed('embedding');
  if (!manifest.groups.embed?.length) throw new Error('offline download: this build carries no embed model');
  const res = await downloadAskFiles(manifest, opts);
  const rec: PartRecord = { at: new Date().toISOString(), version: manifest.version, ...res };
  await recordPart('ask', rec);
  return rec;
}

// ── On-device image-AI models (host.upscale / host.matte) ────────────────────
//
// Pre-download the SAME bytes the upscale/matte dialogs fetch on first use, into
// the SAME IndexedDB stores their worker runners read (see lib/model-prefetch.ts
// for why cache parity matters, and why this can't use downloadList - that writes
// an unread SW-cache bucket, but the SW bypasses /models/ so the one true copy is
// the IDB one). So a user can pull the models down from Profile in anticipation and
// the dialog then finds them already on-device. Release-versioned like /ort/ + the
// verify models, so resyncOfflineParts deliberately never re-syncs them (there is
// no per-deploy delta - a bytes change rides UPSCALE/MATTE_MODEL_CACHE_VERSION).

/** Download the upscale part - every staged upscaler into the `upscale-models` IDB
 *  store the dialog reads. Throws (like downloadVerify) if a staged model didn't
 *  land, so a partial run never records itself complete. */
export async function downloadUpscale(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PartRecord> {
  assertAiAllowed('upscale');
  const { prefetchUpscaleModels } = await import('./model-prefetch.ts');
  const res = await prefetchUpscaleModels(opts);
  opts.signal?.throwIfAborted();
  if (!res.ok) throw new Error('offline download: an upscale model download was incomplete');
  const rec: PartRecord = { at: new Date().toISOString(), version: String(UPSCALE_MODEL_CACHE_VERSION), bytes: res.bytes, files: res.files };
  await recordPart('upscale', rec);
  return rec;
}

/** Download the background-removal part - every staged matte model into the
 *  `matte-models` IDB store the dialog reads. */
export async function downloadMatte(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PartRecord> {
  assertAiAllowed('matte');
  const { prefetchMatteModels } = await import('./model-prefetch.ts');
  const res = await prefetchMatteModels(opts);
  opts.signal?.throwIfAborted();
  if (!res.ok) throw new Error('offline download: a matte model download was incomplete');
  const rec: PartRecord = { at: new Date().toISOString(), version: String(MATTE_MODEL_CACHE_VERSION), bytes: res.bytes, files: res.files };
  await recordPart('matte', rec);
  return rec;
}

/**
 * Download the durable-credential part - the TrustMark ENCODER the export panel's
 * "Durable credential" toggle runs, into the shared `trustmark-models` IDB store.
 *
 * The same bytes the first durable export fetches on demand, so pulling them here
 * means that export starts immediately (and works with no connection afterwards).
 * On the Tauri shells it is the only way to get them ahead of time, and it is what
 * makes the export toggle appear there at all - see bridge/format-support.ts's
 * durable probe. Throws when the encoder is not served (a 404 on a build whose
 * model host has not been given the file), so a part is never recorded as
 * downloaded when nothing came down.
 */
export async function downloadDurable(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PartRecord> {
  assertAiAllowed('watermark');
  const { signal, onProgress } = opts;
  const { prefetchTrustmarkEncoder } = await import('./trustmark-embed.ts');
  let bytes = 0;
  const ok = await prefetchTrustmarkEncoder({
    onProgress: p => {
      bytes = p.loaded;
      onProgress?.({ loaded: p.loaded, total: p.total, done: 0, count: 1 });
    },
  });
  signal?.throwIfAborted();
  if (!ok) throw new Error('offline download: the durable-credential model is not available from this server');
  const rec: PartRecord = {
    at: new Date().toISOString(),
    version: String(DURABLE_ENCODER_CACHE_VERSION),
    // A cache hit (the file was already fetched by an export) reports no chunks at
    // all, so the record falls back to the pinned served size rather than claiming
    // a part of zero bytes.
    bytes: bytes || DURABLE_ENCODER_BYTES,
    files: 1,
  };
  await recordPart('durable', rec);
  return rec;
}

/** Download the OCR part - every staged model's det + rec + dict into the
 *  `ocr-models` IDB store the runner reads. */
export async function downloadOcr(opts: { signal?: AbortSignal; onProgress?: OnProgress } = {}): Promise<PartRecord> {
  assertAiAllowed('ocr');
  const { prefetchOcrModels } = await import('./model-prefetch.ts');
  const res = await prefetchOcrModels(opts);
  opts.signal?.throwIfAborted();
  if (!res.ok) throw new Error('offline download: an OCR model download was incomplete');
  const rec: PartRecord = { at: new Date().toISOString(), version: String(OCR_MODEL_CACHE_VERSION), bytes: res.bytes, files: res.files };
  await recordPart('ocr', rec);
  return rec;
}

/** Record a completed catalog download's scope + measured size. The BYTES went
 *  through catalog/sync.ts's prefetch (threaded in by the view); this record is
 *  what keeps them protected + refreshed at every boot (sync.ts reads it back
 *  via offlineCatalogScope). */
export async function recordCatalogDownload(tags: 'all' | string[], bytes: number, files: number): Promise<void> {
  await recordPart('catalog', { at: new Date().toISOString(), version: '', bytes, files, tags });
}

/** The saved catalog scope, or null when no catalog download is recorded.
 *  catalog/sync.ts reads this at boot to extend the prune keep-set and the
 *  core-tier refresh to the downloaded selection. */
export async function offlineCatalogScope(): Promise<'all' | string[] | null> {
  try {
    return (await readParts()).catalog?.tags ?? null;
  } catch {
    return null;
  }
}

/** Remove one downloaded part. app/docs/verify delete their buckets (verify
 *  also clears the model stores - the same bytes /verify's own banner offers,
 *  so removing here re-offers the download there). upscale/matte clear their IDB
 *  model stores - the dialog re-offers the download on next use. catalog only
 *  forgets the SELECTION: the blobs are shared with sessions and pins, so the next
 *  catalog sync's prune reclaims whatever nothing else references. */
export async function removePart(id: OfflinePartId): Promise<void> {
  if ('caches' in globalThis) {
    if (id === 'app') await caches.delete(APP_CACHE);
    if (id === 'docs') await caches.delete(INFO_CACHE);
    if (id === 'verify') await caches.delete(ORT_CACHE);
  }
  // speech, reword, ask and ai-detect share the transformers bucket AND the
  // /ort-hf/ runtime: each clears only its own model directory, and the runtime
  // bucket survives while ANY other of the four still holds a download.
  if (id === 'speech' || id === 'reword' || id === 'ask' || id === 'ai-detect') {
    const parts = await readParts();
    const others = (['speech', 'reword', 'ask', 'ai-detect'] as const).some(p => p !== id && !!parts[p]);
    if (id === 'speech') await clearSpeechCaches({ keepOrtHf: others });
    if (id === 'reword') await clearRewordCaches({ keepOrtHf: others });
    if (id === 'ask') await clearAskCaches({ keepOrtHf: others });
    if (id === 'ai-detect') await clearAiDetectCaches({ keepOrtHf: others });
  }
  if (id === 'verify' || id === 'upscale' || id === 'matte' || id === 'ocr' || id === 'durable') {
    try {
      const db = await openDB();
      if (id === 'verify') {
        // The decoders, the resizer and the readiness marker - but NOT the durable
        // encoder sharing the store (verifyModelKeys). Removing the deep scan must
        // not silently take the export-side model with it.
        const keys = await db.getAllKeys(DURABLE_MODEL_STORE).catch(() => [] as IDBValidKey[]);
        for (const k of verifyModelKeys(keys.map(String))) await db.delete(DURABLE_MODEL_STORE, k).catch(() => {});
        await db.clear('contentseal-models').catch(() => {});
      } else if (id === 'durable') {
        await db.delete(DURABLE_MODEL_STORE, DURABLE_ENCODER_FILE).catch(() => {});
      } else {
        const store = id === 'upscale' ? UPSCALE_MODEL_STORE : id === 'matte' ? MATTE_MODEL_STORE : OCR_MODEL_STORE;
        await db.clear(store).catch(() => {});
      }
    } catch { /* stores absent - nothing to clear */ }
  }
  await forgetPart(id);
}

/**
 * Re-sync every downloaded part whose manifest watermark moved - called from
 * the boot idle path (catalog/sync.ts, beside refreshPinnedToolFiles). Cheap
 * when nothing changed (two small manifest fetches); after a deploy it
 * re-downloads only the delta, since unchanged files skip via cachedMatches.
 * Best-effort: a failed re-sync keeps the old record so the next boot retries.
 */
export async function resyncOfflineParts(): Promise<void> {
  const parts = await readParts();
  if (parts.app || parts.verify || parts.speech || parts.reword || parts.ask || parts['ai-detect']) {
    const manifest = await fetchPrecacheManifest();
    if (manifest) {
      if (parts.app && parts.app.version !== manifest.version) {
        await downloadApp(manifest).catch(() => {});
      }
      if (parts.verify && parts.verify.version !== manifest.version) {
        await downloadVerify(manifest).catch(() => {});
      }
      // Guarded on the group: a manifest from before the speech part existed
      // must not "re-sync" the record down to an empty download.
      if (parts.speech && parts.speech.version !== manifest.version && manifest.groups.speech?.length) {
        await downloadSpeech(manifest).catch(() => {});
      }
      if (parts.reword && parts.reword.version !== manifest.version && manifest.groups.reword?.length) {
        await downloadReword(manifest).catch(() => {});
      }
      if (parts.ask && parts.ask.version !== manifest.version && manifest.groups.embed?.length) {
        await downloadAsk(manifest).catch(() => {});
      }
      if (parts['ai-detect'] && parts['ai-detect'].version !== manifest.version && manifest.groups.aiDetect?.length) {
        await downloadAiDetect(manifest).catch(() => {});
      }
    }
  }
  if (parts.docs) {
    const manifest = await fetchInfoManifest();
    // A language switch re-downloads too - the docs part promises the ACTIVE locale.
    if (manifest && (parts.docs.version !== manifest.version || parts.docs.lang !== currentLang())) {
      await downloadDocs(manifest).catch(() => {});
    }
  }
}

/** Storage headroom for a planned download. `fits` applies the same safety
 *  fraction the asset store's quota guard uses - a download that would land
 *  the device on the quota ceiling breaks saves everywhere else. */
export async function storageHeadroom(plannedBytes: number): Promise<{ fits: boolean; free: number | null }> {
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (!quota) return { fits: true, free: null };
    const free = Math.max(0, quota * 0.9 - usage);
    return { fits: plannedBytes <= free, free };
  } catch {
    return { fits: true, free: null };
  }
}

/** Whether the browser granted persistent storage - surfaced in the offline
 *  section because it's the difference between "downloaded" and "downloaded
 *  until the browser feels storage pressure". Requested (silently, once) at
 *  bridge construction; this re-requests on demand from a user gesture, which
 *  is exactly when browsers are most willing to grant it. */
export async function persistenceState(request = false): Promise<'granted' | 'denied' | 'unsupported'> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    if (request && await navigator.storage.persist()) return 'granted';
    return 'denied';
  } catch {
    return 'unsupported';
  }
}
