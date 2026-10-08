// SPDX-License-Identifier: MPL-2.0
/**
 * host.models (v1.246) on the web and desktop shells: the bytes of named files of
 * an on-device model family, for a tool that runs a model in a context of its own.
 *
 * The one caller today is the Rondocode utility's editor frame (plan 301 phase F).
 * Its origin is opaque, so it has no IndexedDB, no Cache API and no network of its
 * own, and it cannot load the shell's same-origin /ort/ runtime either. The
 * utility asks here, by path, and transfers the bytes into the frame.
 *
 * WHAT IS ANSWERED, AND HOW
 *   - Only `sing` is readable by tools. Any other family, and any path that is not
 *     one of the family's hosted files or a `runtime/<file>` the shell serves, is
 *     refused by name: the promise rejects, so a mistake is loud.
 *   - A policy that forbids the family resolves null before anything is read.
 *   - A file of the "Singing voices" part that is not on the device yet: the
 *     shared in-place offer (lib/model-offer.ts ensureModel) shows the part's
 *     size and licence facts. Download records the part, so Profile reads
 *     Downloaded afterwards; Not now resolves null.
 *   - An fp32 fallback (lib/sing-models.ts SING_FALLBACK_FILES) that is not on the
 *     device: its own consent line with its size, then a download through the
 *     same fetcher and store, in the job toast. Not now resolves null.
 *   - `runtime/<file>`: the shell's own onnxruntime-web WebAssembly binary, read
 *     from /ort/ (the service worker serves it from its runtime bucket when held).
 *
 * Each value is a fresh Uint8Array over its own whole ArrayBuffer, so the caller
 * can transfer `bytes.buffer` to the frame without a copy; the stored copy in
 * IndexedDB is untouched by that.
 *
 * Lazy: bridge/index.ts imports this module on the first call only, so neither the
 * offer sheet nor the model fetcher reaches the boot chunk.
 */
import type { ModelFilesOpts, ModelFilesProgress, ModelsAPI } from '@lolly-tools/core/host-v1';
import { aiAllowed } from '../lib/ai-policy.ts';
import { t, tRaw } from '../i18n.ts';
import { fmtBytes } from '../lib/format.ts';
import {
  isSingModelFile, isSingPartFile, SING_FAMILY, SING_FILE_BYTES, SING_MODEL_STORE, singRuntimeUrl,
} from '../lib/sing-models.ts';

/** The model families a tool may read through host.models. */
export const TOOL_READABLE_FAMILIES: readonly string[] = Object.freeze([SING_FAMILY]);

/** The most paths one call may name: the family has 27 files and one runtime. */
const MAX_PATHS = 64;
/** The longest `reason` shown in the offer sheet. */
const MAX_REASON = 120;

interface ModelsDeps {
  /** The AI policy allows the family. */
  allowed: () => boolean;
  /** The keys the family's store holds (cheap: no bytes are read). */
  present: () => Promise<Set<string>>;
  /** One stored file (cacheOnly), or fetch and store the file. Null when neither works. */
  read: (file: string, cacheOnly: boolean, onProgress?: (p: { loaded: number; total: number | null }) => void) => Promise<ArrayBuffer | null>;
  /** The in-place offer for the part: true once it is on the device. */
  ensure: (reason: string, onProgress?: (p: { loaded: number; total: number | null }) => void) => Promise<boolean>;
  /** Consent for fallback files outside the part, by their total size. */
  confirmExtra: (bytes: number) => Promise<boolean>;
  /** A job-toast run for the fallback download, or null while another runs. */
  beginRun: (title: string) => Promise<{ signal: AbortSignal; cancelled: boolean; report: (loaded: number, total: number) => void; end: (error?: string) => void } | null>;
  /** The bytes of a same-origin runtime file. */
  runtime: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
}

const DEFAULT_DEPS: ModelsDeps = {
  allowed: () => aiAllowed('sing'),
  present: async () => {
    try {
      const { openDB } = await import('./db.ts');
      const db = await openDB();
      return new Set((await db.getAllKeys(SING_MODEL_STORE)).map(String));
    } catch {
      return new Set();
    }
  },
  read: async (file, cacheOnly, onProgress) => {
    const { fetchSingModelFile } = await import('../lib/model-prefetch.ts');
    return fetchSingModelFile(file, cacheOnly, onProgress);
  },
  ensure: async (reason, onProgress) => {
    const { ensureModel } = await import('../lib/model-offer.ts');
    return ensureModel('sing', { reason, onProgress });
  },
  confirmExtra: async (bytes) => {
    const { confirmDialog } = await import('../components/confirm-dialog.ts');
    return confirmDialog({
      title: t('One more singing model'),
      message: tRaw('Singing needs a larger model file on this device: {size}. It stays on this device.', { size: fmtBytes(bytes) }),
      confirmLabel: t('Download'),
      danger: false,
    });
  },
  beginRun: async (title) => {
    const { beginOfflineRun } = await import('../lib/offline-run.ts');
    const run = beginOfflineRun(title);
    if (!run) return null;
    const label = t('Singing voices');
    return {
      signal: run.signal,
      get cancelled() { return run.cancelled; },
      report: (loaded, total) => run.report({ label, loaded, total, unit: 'bytes' }),
      end: (error) => run.end(error),
    };
  },
  runtime: async (url, signal) => {
    const resp = await fetch(url, { signal });
    const type = resp.headers.get('content-type') ?? '';
    if (!resp.ok || type.includes('text/html')) throw new Error(`host.models: the runtime file ${url} is not served here`);
    const bytes = await resp.arrayBuffer();
    // A WebAssembly binary starts with "\0asm"; anything else (an SPA fallback
    // page served as something else) is refused rather than handed over.
    const head = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    if (head[0] !== 0x00 || head[1] !== 0x61 || head[2] !== 0x73 || head[3] !== 0x6d) {
      throw new Error(`host.models: ${url} is not a WebAssembly binary`);
    }
    return bytes;
  },
};
let deps: ModelsDeps = DEFAULT_DEPS;

/** Test hook: replace one or more dependencies; call with no argument to restore them. */
export function __setModelsDepsForTest(next?: Partial<ModelsDeps>): void {
  deps = next ? { ...DEFAULT_DEPS, ...next } : DEFAULT_DEPS;
}

/** The `reason` as the sheet may show it: plain, one line, bounded. */
function cleanReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, MAX_REASON) : t('Songs that sing in Rondocode');
}

/** Refuse what tools may not read, by name. */
function checkRequest(family: unknown, paths: unknown): string[] {
  if (typeof family !== 'string' || !TOOL_READABLE_FAMILIES.includes(family)) {
    throw new Error(`host.models: tools cannot read the model family "${String(family)}"`);
  }
  if (!Array.isArray(paths) || paths.length === 0) throw new TypeError('host.models.files: name at least one file');
  if (paths.length > MAX_PATHS) throw new RangeError(`host.models.files: at most ${MAX_PATHS} files per call`);
  for (const p of paths) {
    if (typeof p !== 'string' || !(isSingModelFile(p) || singRuntimeUrl(p))) {
      throw new Error(`host.models: "${String(p)}" is not a file of the ${family} family`);
    }
  }
  return [...new Set(paths as string[])];
}

const sizeOf = (files: readonly string[]): number => files.reduce((n, f) => n + (SING_FILE_BYTES[f] ?? 0), 0);

/** host.models.files. */
export async function modelFiles(
  family: string, paths: string[], opts: ModelFilesOpts = {},
): Promise<Record<string, Uint8Array> | null> {
  const wanted = checkRequest(family, paths);
  const { signal } = opts;
  const report = (p: ModelFilesProgress): void => { try { opts.onProgress?.(p); } catch { /* a caller's display must not break the read */ } };
  signal?.throwIfAborted();
  if (!deps.allowed()) return null;

  const models = wanted.filter(isSingModelFile);
  const runtime = wanted.filter(p => !isSingModelFile(p));
  const held = await deps.present();
  const missingPart = models.filter(p => isSingPartFile(p) && !held.has(p));
  const missingExtra = models.filter(p => !isSingPartFile(p) && !held.has(p));

  // Bytes a fallback download just fetched, kept so the read below does not load
  // a gigabyte back out of IndexedDB a second time.
  const fetched = new Map<string, ArrayBuffer>();

  // The part first: one offer for the whole family, never one per file.
  if (missingPart.length) {
    const ok = await deps.ensure(cleanReason(opts.reason), (p) => { if (p.total) report({ loaded: p.loaded, total: p.total }); });
    if (!ok) return null;
    signal?.throwIfAborted();
  }
  if (missingExtra.length) {
    const bytes = sizeOf(missingExtra);
    if (!(await deps.confirmExtra(bytes))) return null;
    if (!deps.allowed()) return null;
    const run = await deps.beginRun(tRaw('Downloading: {name}', { name: t('Singing voices') }));
    if (!run) throw new Error(t('Another download is running. Try again when it finishes.'));
    let loaded = 0;
    try {
      for (const file of missingExtra) {
        if (run.cancelled || signal?.aborted) break;
        const buf = await deps.read(file, false, (p) => {
          run.report(loaded + p.loaded, bytes);
          report({ loaded: loaded + p.loaded, total: bytes });
        });
        if (!buf) throw new Error(`host.models: ${file} could not be downloaded`);
        fetched.set(file, buf);
        loaded += buf.byteLength;
      }
    } catch (err) {
      run.end(t('The download did not finish. Check your connection and try again.'));
      throw err;
    }
    // The fetcher finishes a file in flight, so a cancel takes effect between files.
    const stopped = run.cancelled || !!signal?.aborted;
    run.end();
    if (stopped) {
      signal?.throwIfAborted();
      return null;
    }
  }

  // Read what was asked for, in the order asked. A stored copy from an older cache
  // version reads as missing, and is fetched again under the consent already given.
  const out: Record<string, Uint8Array> = {};
  const total = sizeOf(models);
  let loaded = 0;
  for (const file of models) {
    signal?.throwIfAborted();
    let buf = fetched.get(file) ?? await deps.read(file, true);
    fetched.delete(file);
    if (!buf) {
      if (!deps.allowed()) return null;
      buf = await deps.read(file, false, (p) => report({ loaded: loaded + p.loaded, total }));
    }
    if (!buf) throw new Error(`host.models: ${file} is not on this device and could not be downloaded`);
    out[file] = new Uint8Array(buf);
    loaded += buf.byteLength;
    report({ loaded, total: Math.max(total, loaded) });
  }
  for (const file of runtime) {
    signal?.throwIfAborted();
    out[file] = new Uint8Array(await deps.runtime(singRuntimeUrl(file)!, signal));
  }
  return out;
}

/** The web shell's host.models. */
export function createModelsAPI(): ModelsAPI {
  return { files: modelFiles };
}
