// SPDX-License-Identifier: MPL-2.0
/**
 * One answer to "can this device get model part X, how big is it, and is it here
 * already?" for every surface that offers a model download: Profile's Available
 * offline rows, the in-context offer (lib/model-offer.ts) and the desktop first-run
 * sheet (components/models-welcome.ts).
 *
 * WHERE THE FILE LIST COMES FROM
 * A production build writes dist/precache.json with a group per model part (the
 * vite build merges shells/web/models-manifest.json into it, because the model
 * files themselves live on the model host, not in dist). A dev server, `tauri dev`
 * and an instance built before a group existed have no such group, yet the model
 * host still serves the files: every downloader fetches `${MODELS_BASE}/models/...`
 * whatever precache says. So a group missing from precache is filled from the
 * committed models-manifest.json, imported here as data so every shell carries it
 * (production does not serve that file, so it cannot be fetched).
 *
 * WHEN A PART IS AVAILABLE
 * A group filled from the committed listing is checked once per session with a
 * HEAD request for its largest file, so a fresh clone whose dev server has no
 * public/models, or a file the host has dropped, reads "not available" instead of
 * showing a Download button that fails. Only a definite answer (a 404 or the SPA
 * fallback page) is remembered; a request that times out or cannot complete, or a
 * server error, leaves the part available and the download states its own
 * failure. A group from precache.json is taken as the build's word and is not
 * checked: web production and packaged desktop builds always carry every model
 * group there, so on those builds "available" means "listed by the build". An AI
 * policy that forbids the part is reported separately as `allowed`, so the row
 * keeps its own policy line.
 *
 * The prefix rules below mirror vite.config.js's groupPrecacheFiles for the model
 * groups; model-parts.test.ts runs both over the committed listing and fails on
 * a difference.
 */
import modelsListing from '../../models-manifest.json' with { type: 'json' };
import { t } from '../i18n.ts';
import { aiOfflinePartAllowed } from './ai-policy.ts';
import {
  downloadAiDetect, downloadAsk, downloadDurable, downloadMatte, downloadOcr, downloadReword,
  downloadSpeech, downloadUpscale, downloadVerify, fetchPrecacheManifest, modelFetchUrl,
  partRecords, speechFileLists, trustmarkGroupSplit, SPEECH_CACHE, TRANSFORMERS_CACHE,
  type ManifestFile, type OfflinePartId, type OnProgress, type PartRecord, type PartState, type PrecacheManifest,
} from './offline-manager.ts';

/** The offline parts that are on-device AI models. */
export const MODEL_PART_IDS = ['speech', 'upscale', 'matte', 'ocr', 'reword', 'ask', 'ai-detect', 'verify', 'durable'] as const;
export type ModelPartId = (typeof MODEL_PART_IDS)[number];

export function isModelPart(id: OfflinePartId | string): id is ModelPartId {
  return (MODEL_PART_IDS as readonly string[]).includes(id);
}

/** The precache groups that hold model files. */
export type ModelGroupKey = 'models' | 'speech' | 'upscale' | 'matte' | 'ocr' | 'reword' | 'embed' | 'aiDetect';

const GROUP_PREFIXES: Record<ModelGroupKey, readonly string[]> = {
  models: ['/models/trustmark/'],
  speech: ['/models/kokoro/', '/models/whisper/'],
  upscale: ['/models/upscale/'],
  matte: ['/models/matte/'],
  ocr: ['/models/ocr/'],
  reword: ['/models/reword/'],
  embed: ['/models/embed/'],
  aiDetect: ['/models/ai-detect/'],
};

/** Which group holds a part's model files, which runtime group rides with it, and
 *  (for the shared trustmark group) which half of it the part owns. */
const PART_GROUPS: Record<ModelPartId, { model: ModelGroupKey; runtime?: 'ort' | 'ortHf'; half?: 'verify' | 'durable' }> = {
  speech: { model: 'speech', runtime: 'ortHf' },
  upscale: { model: 'upscale' },
  matte: { model: 'matte' },
  ocr: { model: 'ocr' },
  reword: { model: 'reword', runtime: 'ortHf' },
  ask: { model: 'embed', runtime: 'ortHf' },
  'ai-detect': { model: 'aiDetect', runtime: 'ortHf' },
  verify: { model: 'models', runtime: 'ort', half: 'verify' },
  durable: { model: 'models', half: 'durable' },
};

/** Split a file listing into the model groups, by the build's prefix rules. Pure. */
export function groupModelFiles(files: readonly ManifestFile[]): Record<ModelGroupKey, ManifestFile[]> {
  const out = {} as Record<ModelGroupKey, ManifestFile[]>;
  for (const key of Object.keys(GROUP_PREFIXES) as ModelGroupKey[]) {
    out[key] = files.filter(f => GROUP_PREFIXES[key].some(p => f.url.startsWith(p)));
  }
  return out;
}

const LISTED: readonly ManifestFile[] = (modelsListing as ManifestFile[])
  .filter(f => f && typeof f.url === 'string' && typeof f.size === 'number');
const LISTED_GROUPS = groupModelFiles(LISTED);

/** The version a part record carries when its files came from the committed
 *  listing rather than a build's precache.json. */
export const LISTED_VERSION = 'models-manifest';

/** A precache manifest whose missing model groups are filled from the committed
 *  listing, plus which groups were filled that way. The runtime groups (ort,
 *  ortHf) are never filled: the desktop shells embed them and a dev server serves
 *  them, so only the model files need a download there. */
export function withModelFiles(precache: PrecacheManifest | null): { manifest: PrecacheManifest; listed: ReadonlySet<ModelGroupKey> } {
  const groups: PrecacheManifest['groups'] = precache
    ? { ...precache.groups }
    : { app: [], ort: [], models: [] };
  const listed = new Set<ModelGroupKey>();
  for (const key of Object.keys(GROUP_PREFIXES) as ModelGroupKey[]) {
    if ((groups[key] ?? []).length) continue;
    if (!LISTED_GROUPS[key].length) continue;
    groups[key] = LISTED_GROUPS[key];
    listed.add(key);
  }
  return { manifest: { version: precache?.version ?? LISTED_VERSION, groups }, listed };
}

/** The model files a part owns (no runtime). */
export function partModelFiles(manifest: PrecacheManifest, id: ModelPartId): ManifestFile[] {
  const def = PART_GROUPS[id];
  const files = manifest.groups[def.model] ?? [];
  return def.half ? trustmarkGroupSplit(files)[def.half] : files;
}

/** Everything a part downloads: its model files plus the runtime that rides with it. */
export function partFiles(manifest: PrecacheManifest, id: ModelPartId): ManifestFile[] {
  const def = PART_GROUPS[id];
  const runtime = def.runtime ? manifest.groups[def.runtime] ?? [] : [];
  return [...partModelFiles(manifest, id), ...runtime];
}

const sum = (files: readonly ManifestFile[]): number => files.reduce((n, f) => n + f.size, 0);

/** The name every surface uses for a part: the Profile row's name. */
export function modelPartLabel(id: ModelPartId): string {
  switch (id) {
    case 'speech': return t('Speech voices');
    case 'upscale': return t('Upscaling models');
    case 'matte': return t('Background removal');
    case 'ocr': return t('Text recognition');
    case 'reword': return t('Rewriter model');
    case 'ask': return t('Ask matching model');
    case 'ai-detect': return t('AI text detector');
    case 'verify': return t('Verify deep scan');
    case 'durable': return t('Durable credential');
  }
}

export interface ModelPartInfo {
  id: ModelPartId;
  label: string;
  /** The model host can serve this part to this device. */
  available: boolean;
  /** The AI policy allows this part. A forbidden part keeps its own line. */
  allowed: boolean;
  /** The full download size, when known. Never 0: unknown is undefined. */
  bytes?: number;
  /** On this device already: a recorded download, or the runtime's own check
   *  found the files. 'unknown' when the check itself could not run. */
  ready: boolean | 'unknown';
  /** Where the file list came from. */
  source: 'precache' | 'models-manifest';
}

type ReadyCheck = (id: ModelPartId, manifest: PrecacheManifest) => Promise<boolean>;

interface Deps {
  precache: () => Promise<PrecacheManifest | null>;
  probe: (url: string) => Promise<boolean>;
  ready: ReadyCheck;
  records: () => Promise<PartState>;
}

let precacheOnce: Promise<PrecacheManifest | null> | null = null;
const probes = new Map<string, Promise<boolean>>();

/** How long a HEAD may take before the part is left available. */
const PROBE_TIMEOUT_MS = 4000;

/** HEAD the file on the model host. `definite` is true only for an answer worth
 *  keeping for the session: served, missing (404/410), or the SPA fallback page. */
async function probeServed(url: string): Promise<{ served: boolean; definite: boolean }> {
  try {
    const resp = await fetch(modelFetchUrl(url), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (resp.ok) {
      const html = (resp.headers.get('content-type') ?? '').includes('text/html');
      return { served: !html, definite: true };
    }
    if (resp.status === 404 || resp.status === 410) return { served: false, definite: true };
    // A server error or a refusal may pass: the download reports its own failure.
    return { served: true, definite: false };
  } catch {
    return { served: true, definite: false };
  }
}

/** Every file of `files` in a Cache Storage bucket, under the key the runtime
 *  fetched it by (the model host URL on desktop) or its path. */
async function cacheHasAll(cacheName: string, files: readonly ManifestFile[]): Promise<boolean> {
  if (!files.length) return false;
  const cache = await caches.open(cacheName);
  for (const f of files) {
    const held = (await cache.match(modelFetchUrl(f.url))) ?? (await cache.match(f.url));
    if (!held) return false;
  }
  return true;
}

async function storeHasAll(store: string, files: readonly string[]): Promise<boolean> {
  if (!files.length) return false;
  const { openDB } = await import('../bridge/db.ts');
  const db = await openDB();
  const keys = new Set((await db.getAllKeys(store)).map(String));
  return files.every(f => keys.has(f));
}

/** The runtime's own presence checks, read without loading a model. */
async function defaultReady(id: ModelPartId, manifest: PrecacheManifest): Promise<boolean> {
  switch (id) {
    case 'upscale': {
      const { UPSCALE_MODEL_STORE, UPSCALE_MODEL_FILES, stagedUpscaleModels } = await import('./upscale-models.ts');
      return storeHasAll(UPSCALE_MODEL_STORE, stagedUpscaleModels().map(m => UPSCALE_MODEL_FILES[m.id]));
    }
    case 'matte': {
      const [{ MATTE_MODEL_STORE }, { matteOfflineFiles }] = await Promise.all([import('./matte-models.ts'), import('./model-prefetch.ts')]);
      return storeHasAll(MATTE_MODEL_STORE, matteOfflineFiles());
    }
    case 'ocr': {
      const [{ OCR_MODEL_STORE }, { ocrOfflineFiles }] = await Promise.all([import('./ocr-models.ts'), import('./model-prefetch.ts')]);
      return storeHasAll(OCR_MODEL_STORE, ocrOfflineFiles());
    }
    case 'durable': {
      const { DURABLE_MODEL_STORE, DURABLE_ENCODER_FILE } = await import('./durable-model.ts');
      return storeHasAll(DURABLE_MODEL_STORE, [DURABLE_ENCODER_FILE]);
    }
    case 'verify': {
      const { trustmarkModelsReady } = await import('./trustmark.ts');
      return trustmarkModelsReady();
    }
    case 'speech': {
      // Voices arrive one at a time on first use, so the weights being cached says
      // little: the part is here only when every model file (Kokoro and Whisper)
      // and every voice is. Anything less keeps the Download button.
      if (!('caches' in globalThis)) return false;
      const { model, voices } = speechFileLists(manifest);
      return (await cacheHasAll(TRANSFORMERS_CACHE, model)) && (await cacheHasAll(SPEECH_CACHE, voices));
    }
    default: {
      // reword, ask, ai-detect: every model weight file of the part must be in
      // transformers.js's cache, which keys an entry by the URL it fetched, so
      // both spellings are checked.
      if (!('caches' in globalThis)) return false;
      return cacheHasAll(TRANSFORMERS_CACHE, partModelFiles(manifest, id).filter(f => f.url.endsWith('.onnx')));
    }
  }
}

const DEFAULT_DEPS: Deps = {
  // A failed read (null) is not kept, so the next caller asks again.
  precache: () => (precacheOnce ??= fetchPrecacheManifest().then(
    (m) => { if (!m) precacheOnce = null; return m; },
    () => { precacheOnce = null; return null; },
  )),
  probe: (url) => {
    const known = probes.get(url);
    if (known) return known;
    return probeServed(url).then(({ served, definite }) => {
      if (definite) probes.set(url, Promise.resolve(served));
      return served;
    });
  },
  ready: defaultReady,
  records: () => partRecords(),
};
let deps: Deps = DEFAULT_DEPS;

/** Test hook: replace one or more dependencies; call with no argument to restore them. */
export function __setModelPartsDepsForTest(next?: Partial<Deps>): void {
  deps = next ? { ...DEFAULT_DEPS, ...next } : DEFAULT_DEPS;
  precacheOnce = null;
  probes.clear();
}

/** The precache manifest (kept for the session once read), for callers that also
 *  need it. Profile reads its own fresh copy to see a deploy made meanwhile. */
export function modelPrecache(): Promise<PrecacheManifest | null> {
  return deps.precache();
}

export interface ModelPartsContext {
  /** Pass what the caller already read, to skip a second fetch. */
  precache?: PrecacheManifest | null;
  records?: PartState;
}

/** The facts for one part. */
export async function modelPartInfo(id: ModelPartId, ctx: ModelPartsContext = {}): Promise<ModelPartInfo> {
  const [info] = await modelPartsInfo([id], ctx);
  return info!;
}

/** The facts for several parts, with one precache read and one records read. */
export async function modelPartsInfo(ids: readonly ModelPartId[], ctx: ModelPartsContext = {}): Promise<ModelPartInfo[]> {
  const precache = ctx.precache !== undefined ? ctx.precache : await deps.precache().catch(() => null);
  const records = ctx.records ?? await deps.records().catch(() => ({} as PartState));
  const { manifest, listed } = withModelFiles(precache);
  return Promise.all(ids.map(async (id): Promise<ModelPartInfo> => {
    const files = partModelFiles(manifest, id);
    const total = sum(partFiles(manifest, id));
    const allowed = aiOfflinePartAllowed(id);
    const fromListing = listed.has(PART_GROUPS[id].model);
    let available = files.length > 0;
    // Never probe for a part the policy forbids: no request is made on its behalf.
    if (available && allowed && fromListing) {
      const big = files.reduce((a, f) => (f.size > a.size ? f : a));
      available = await deps.probe(big.url).catch(() => true);
    }
    let ready: boolean | 'unknown' = !!records[id];
    if (!ready) {
      try { ready = await deps.ready(id, manifest); } catch { ready = 'unknown'; }
    }
    return {
      id, label: modelPartLabel(id), available, allowed, ready,
      bytes: total > 0 ? total : undefined,
      source: fromListing ? 'models-manifest' : 'precache',
    };
  }));
}

/**
 * Run one part's download, whichever shell and whichever file source. The
 * downloaders record the part in Profile's offline state themselves, so the
 * Profile row reads Downloaded afterwards wherever the download was started.
 */
export async function downloadModelPart(
  id: ModelPartId,
  precache: PrecacheManifest | null,
  opts: { signal?: AbortSignal; onProgress?: OnProgress } = {},
): Promise<PartRecord> {
  const { manifest } = withModelFiles(precache);
  switch (id) {
    case 'speech': return downloadSpeech(manifest, opts);
    case 'reword': return downloadReword(manifest, opts);
    case 'ask': return downloadAsk(manifest, opts);
    case 'ai-detect': return downloadAiDetect(manifest, opts);
    case 'verify': return downloadVerify(manifest, opts);
    case 'upscale': return downloadUpscale(opts);
    case 'matte': return downloadMatte(opts);
    case 'ocr': return downloadOcr(opts);
    case 'durable': return downloadDurable(opts);
  }
}
