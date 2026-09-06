// SPDX-License-Identifier: MPL-2.0
/**
 * createMockHost - an in-memory {@link HostV1} for unit-testing a tool's hooks
 * without a real shell (no DOM, no filesystem, no network). State is an in-memory
 * Map; clipboard / export / log calls are captured so a test can assert what the
 * tool did via `host.inspect`.
 *
 * It implements the REQUIRED bridge surface (profile, assets, state, clipboard,
 * export, log). Every optional API (`HOST_V1_OPTIONAL_APIS`: net, tokens, text,
 * pdf, … 26 of them) is left undefined by default, so a hook that
 * feature-detects one sees it as absent. To test a tool that DECLARES
 * `requires`, or a hook's behaviour when an API is present but unhelpful, wrap
 * the mock in {@link withOptionalStubs}: every method of every optional API is
 * then a function that throws a clear "stub" error (`isAvailable`-style probes
 * answer false), which is enough for `missingRequires` and the conformance
 * kit's shape check to pass, and for a hook's own error path to be exercised.
 */
import type {
  HostV1,
  Profile,
  AssetRef,
  AssetQuery,
  AssetPickerOpts,
  StateEntry,
  ExportFormat,
  ExportOpts,
} from './host-v1.ts';

export interface CreateMockHostOpts {
  /** Profile the tool reads via `host.profile.get()`. Default: empty. */
  profile?: Profile;
  /** Assets addressable by `host.assets.get()` / `query()`, keyed by id. */
  assets?: Record<string, AssetRef>;
  /** What `host.assets.pick()` resolves to. Default: `null` (user cancelled). */
  pick?: AssetRef | null;
  /** Also mirror `log()` to the console. Default: false (captured only). */
  echoLogs?: boolean;
  /** The shell identity the mock reports as. Default: `'cli'`. */
  shell?: HostV1['shell'];
}

/** A captured export/download/file call. */
export interface ExportCall {
  kind: 'render' | 'download' | 'file';
  format?: ExportFormat;
  filename?: string;
  /** Byte length of the blob involved (0 for the stub render). */
  bytes: number;
}

/** A captured log line. */
export interface LogLine {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  ctx?: object;
}

/** Read-only view of everything the tool did against the mock. */
export interface MockHostInspection {
  /** Current persisted state: slot → data. */
  state: ReadonlyMap<string, object>;
  /** Text written to the clipboard, most recent last. */
  clipboardText: readonly string[];
  /** Every export() / download() / file() call, in order. */
  exports: readonly ExportCall[];
  /** Every log() line, in order. */
  logs: readonly LogLine[];
}

/** A {@link HostV1} with an extra `inspect` accessor for test assertions. */
export type MockHost = HostV1 & { readonly inspect: MockHostInspection };

export function createMockHost(opts: CreateMockHostOpts = {}): MockHost {
  const profile: Profile = opts.profile ?? {};
  const assetMap = new Map<string, AssetRef>(Object.entries(opts.assets ?? {}));
  // Fixed timestamp keeps the mock deterministic across test runs.
  const stamp = new Date(0).toISOString();
  const state = new Map<string, { data: object; updatedAt: string }>();
  const clipboardText: string[] = [];
  const exports: ExportCall[] = [];
  const logs: LogLine[] = [];

  const matches = (a: AssetRef, q: AssetQuery): boolean => {
    if (q.type && a.type !== q.type) return false;
    if (q.namespace && !a.id.startsWith(q.namespace)) return false;
    if (q.tags && q.tags.length) {
      const tags = (a.meta?.tags as string[] | undefined) ?? [];
      if (!q.tags.every((t) => tags.includes(t))) return false;
    }
    return true;
  };

  const host: MockHost = {
    version: '1',
    shell: opts.shell ?? 'cli',

    profile: {
      async get() {
        return profile;
      },
      subscribe() {
        return () => {};
      },
    },

    assets: {
      async get(id) {
        const a = assetMap.get(id);
        if (!a) throw new Error(`Mock host has no asset "${id}"`);
        return a;
      },
      async query(filter) {
        return [...assetMap.values()].filter((a) => matches(a, filter));
      },
      async pick(_opts: AssetPickerOpts) {
        return opts.pick ?? null;
      },
      async isAvailable(id) {
        return assetMap.has(id);
      },
    },

    state: {
      async save(slot, data) {
        state.set(slot, { data, updatedAt: stamp });
      },
      async load(slot) {
        return state.get(slot)?.data ?? null;
      },
      async list() {
        const out: StateEntry[] = [];
        for (const [slot, v] of state) {
          out.push({ slot, toolId: 'mock', toolVersion: '0.0.0', updatedAt: v.updatedAt });
        }
        return out;
      },
      async delete(slot) {
        state.delete(slot);
      },
    },

    clipboard: {
      async writeText(text) {
        clipboardText.push(text);
      },
      async writeImage(_blob: Blob) {
        return { method: 'download' as const };
      },
    },

    export: {
      async render(_node: Element, format: ExportFormat, o?: ExportOpts) {
        exports.push({ kind: 'render', format, filename: o?.filename, bytes: 0 });
        return new Blob([], { type: 'application/octet-stream' });
      },
      async download(blob: Blob, filename: string) {
        exports.push({ kind: 'download', filename, bytes: blob.size });
      },
      async file(blob: Blob, o?: { filename?: string }) {
        exports.push({ kind: 'file', filename: o?.filename, bytes: blob.size });
      },
      async imprint(bytes: Uint8Array, _format: string, _o?: { durable?: boolean }) {
        // No rasteriser in the mock. Return the bytes unchanged (the progressive-
        // enhancement contract), same as the headless CLI.
        return bytes;
      },
    },

    log(level, msg, ctx) {
      logs.push({ level, msg, ctx });
      if (opts.echoLogs) {
        const fn =
          level === 'debug'
            ? console.log
            : level === 'info'
              ? console.info
              : level === 'warn'
                ? console.warn
                : console.error;
        fn(`[${level}] ${msg}`, ctx ?? '');
      }
    },

    get inspect(): MockHostInspection {
      const flat = new Map<string, object>();
      for (const [k, v] of state) flat.set(k, v.data);
      return {
        state: flat,
        clipboardText: [...clipboardText],
        exports: [...exports],
        logs: [...logs],
      };
    },
  };

  return host;
}

import { HOST_V1_OPTIONAL_APIS, type HostApiName } from './host-v1/apis.ts';
import { HOST_V1_METHODS } from './host-conformance.ts';

/** Methods that are presence/availability probes: a stub answers `false` for
 *  these instead of throwing, so a tool that asks before acting takes its
 *  graceful path. */
const PROBE_METHODS = new Set(['isAvailable', 'cached', 'canRun', 'canShare', 'transcribeAvailable', 'transcribeCached', 'canRaster']);

/**
 * Install stub implementations of optional host APIs on a host (the mock, or
 * any partial host in a test). Each stub method throws
 * `host.<api>.<method> is a stub` unless it is an availability probe, which
 * resolves false. Existing real implementations are left alone.
 */
export function withOptionalStubs<T extends object>(host: T, apis: readonly HostApiName[] = HOST_V1_OPTIONAL_APIS): T {
  const rec = host as Record<string, unknown>;
  for (const api of apis) {
    if (rec[api] !== undefined && rec[api] !== null) continue;
    const stub: Record<string, unknown> = {};
    const { required, optional } = HOST_V1_METHODS[api];
    for (const m of [...required, ...optional]) {
      stub[m] = PROBE_METHODS.has(m)
        ? async () => false
        : () => { throw new Error(`mock host: host.${api}.${m} is a stub - supply a real implementation for this test`); };
    }
    rec[api] = stub;
  }
  return host;
}
