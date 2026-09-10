// SPDX-License-Identifier: MPL-2.0
/**
 * Host conformance kit - does an object claiming to be a {@link HostV1} carry
 * the surface the contract says it does?
 *
 * Until now the only check was the `: HostV1` annotation at each shell's
 * bridge, which proves shape at compile time and nothing at run time: a shell
 * built from JavaScript, a Tauri override that lost a method in a merge, or a
 * server-side host that stubs half an API all pass typecheck and fail in a
 * hook. This kit is the run-time half: hand it a live host and it reports every
 * required member that is missing or not callable, every optional API that is
 * present but incomplete, and (opt-in) a handful of behavioural smokes that
 * every shell must agree on - state round-trips, `host.net` denies by default,
 * `host.tokens.get()` returns a token set.
 *
 * The method tables below are the contract as data. They are checked against
 * the interfaces in host-v1/*.ts by `tests/host-conformance.test.ts` (which
 * greps the interface bodies), so a member added to an API without a row here
 * fails that test rather than going unchecked.
 */
import type { HostV1 } from './host-v1/host.ts';
import { HOST_V1_OPTIONAL_APIS, presentApis, type HostApiName } from './host-v1/apis.ts';

export type HostRequiredApi = 'profile' | 'assets' | 'state' | 'clipboard' | 'export';
export type HostApi = HostRequiredApi | HostApiName;

export interface ApiMethods {
  /** Members every implementation must provide as functions. */
  required: readonly string[];
  /** Members an implementation may provide; when present they must be functions. */
  optional: readonly string[];
}

export const HOST_V1_REQUIRED_APIS: readonly HostRequiredApi[] = ['profile', 'assets', 'state', 'clipboard', 'export'];

export const HOST_V1_METHODS: Record<HostApi, ApiMethods> = {
  profile: { required: ['get', 'subscribe'], optional: [] },
  assets: { required: ['get', 'query', 'pick', 'isAvailable'], optional: ['resolveProvider', 'credential', 'bytes'] },
  state: { required: ['save', 'load', 'list', 'delete'], optional: [] },
  clipboard: { required: ['writeText', 'writeImage'], optional: [] },
  export: { required: ['render', 'download', 'file', 'imprint'], optional: ['pack', 'share', 'canShare'] },
  net: { required: ['fetch'], optional: [] },
  tokens: { required: ['get', 'colors', 'resolve', 'themes'], optional: ['list', 'active', 'snapshot'] },
  text: { required: ['toPath', 'preload'], optional: ['axisDefaults', 'fontUrl'] },
  pdf: { required: ['analyze', 'strip', 'compress'], optional: ['redact', 'pages', 'organize', 'stamp', 'lock'] },
  compare: { required: ['run'], optional: ['visual'] },
  prepare: { required: ['inspect', 'apply'], optional: [] },
  pptx: { required: ['inspect', 'rebrand'], optional: [] },
  capture: { required: ['page'], optional: ['vector'] },
  compose: { required: ['render'], optional: ['renderUrl'] },
  media: { required: ['isAvailable', 'start', 'stop', 'subscribe'], optional: ['trim'] },
  scan: { required: ['formats', 'detect'], optional: [] },
  lift: { required: ['svg'], optional: [] },
  keyframes: { required: ['sample'], optional: [] },
  recorder: { required: ['isAvailable', 'record', 'still'], optional: [] },
  audio: { required: ['isAvailable', 'analyse'], optional: ['clean'] },
  codec: { required: ['png16', 'exr', 'radiance', 'dither8'], optional: [] },
  layers: { required: ['writePsd'], optional: [] },
  upscale: { required: ['isAvailable', 'backend', 'models', 'modelBytes', 'cached', 'canRun', 'run'], optional: [] },
  matte: { required: ['isAvailable', 'backend', 'models', 'modelBytes', 'cached', 'canRun', 'run'], optional: [] },
  ocr: { required: ['isAvailable', 'backend', 'models', 'modelBytes', 'cached', 'canRun', 'run'], optional: [] },
  speech: {
    required: ['isAvailable', 'cached', 'modelBytes', 'voices', 'synthesize', 'transcribeAvailable', 'transcribeCached', 'transcribeModelBytes', 'transcribe'],
    optional: [],
  },
  viz: { required: ['isAvailable', 'presets'], optional: [] },
  color: {
    required: ['deltaE', 'apca', 'contrast', 'ramp', 'breaks', 'distinct'],
    optional: ['schemes', 'mix', 'gradientCss', 'gamut', 'maxChroma', 'slice', 'gamutRegion', 'oklch', 'fromOklch', 'solveApca', 'iccProfile', 'inProfileGamut', 'profileMaxChroma', 'inkCoverage', 'paletteExport', 'paletteExportBytes'],
  },
  images: { required: ['decode', 'resize', 'encode'], optional: [] },
  raster: { required: ['canRaster', 'measure', 'decode', 'encode'], optional: [] },
  geom: {
    required: ['union', 'intersect', 'difference', 'xor', 'selfUnion', 'offset', 'stroke', 'fromNodes', 'continuity', 'encodeAuthored', 'decodeAuthored', 'simplify', 'bounds', 'area', 'contains', 'winding', 'nearest', 'parse', 'toPathData', 'limits'],
    optional: [],
  },
  connectors: { required: ['build'], optional: ['pathHeadSvg', 'pathHeadInset', 'routeStyleForKind'] },
  c2pa: { required: ['sign', 'readIngredients'], optional: [] },
};

export interface ConformanceIssue {
  api: HostApi | 'host';
  member?: string;
  severity: 'error' | 'warn';
  message: string;
}

export interface ConformanceReport {
  shell: string;
  /** Optional APIs the host provides. */
  present: HostApiName[];
  /** Optional APIs the host does not provide (never an issue by itself). */
  absent: HostApiName[];
  issues: ConformanceIssue[];
  /** True when no issue has severity 'error'. */
  ok: boolean;
}

export interface ConformanceOpts {
  /** Run the behavioural smokes as well as the shape check. Default true. */
  behaviour?: boolean;
  /** Slot name the state round-trip uses (deleted afterwards). */
  stateSlot?: string;
}

function checkApi(api: HostApi, obj: unknown, issues: ConformanceIssue[]): void {
  if (!obj || typeof obj !== 'object') {
    issues.push({ api, severity: 'error', message: `host.${api} is ${obj === undefined ? 'missing' : typeof obj}, expected an object` });
    return;
  }
  const rec = obj as Record<string, unknown>;
  const { required, optional } = HOST_V1_METHODS[api];
  for (const m of required) {
    if (typeof rec[m] !== 'function') {
      issues.push({ api, member: m, severity: 'error', message: `host.${api}.${m} is ${rec[m] === undefined ? 'missing' : typeof rec[m]}, expected a function` });
    }
  }
  for (const m of optional) {
    if (rec[m] !== undefined && typeof rec[m] !== 'function') {
      issues.push({ api, member: m, severity: 'error', message: `host.${api}.${m} is present but is ${typeof rec[m]}, expected a function` });
    }
  }
}

/**
 * Check a live host against the v1 contract. Never throws on the host's
 * account: a behavioural smoke that throws becomes an issue.
 */
export async function runHostConformance(host: unknown, opts: ConformanceOpts = {}): Promise<ConformanceReport> {
  const issues: ConformanceIssue[] = [];
  const h = (host ?? {}) as Partial<HostV1> & Record<string, unknown>;
  if (h.version !== '1') issues.push({ api: 'host', severity: 'error', message: `host.version is ${JSON.stringify(h.version)}, expected '1'` });
  if (typeof h.shell !== 'string') issues.push({ api: 'host', severity: 'error', message: 'host.shell must name the shell' });
  if (typeof h.log !== 'function') issues.push({ api: 'host', member: 'log', severity: 'error', message: 'host.log must be a function' });
  if (h.capabilities !== undefined && !Array.isArray(h.capabilities)) {
    issues.push({ api: 'host', member: 'capabilities', severity: 'error', message: 'host.capabilities, when present, is an array of capability names' });
  }
  for (const api of HOST_V1_REQUIRED_APIS) checkApi(api, h[api], issues);
  const present = presentApis(h as Partial<Record<HostApiName, unknown>>);
  const absent = HOST_V1_OPTIONAL_APIS.filter((a) => !present.includes(a));
  for (const api of present) checkApi(api, h[api], issues);

  if (opts.behaviour !== false && !issues.some((i) => i.severity === 'error')) {
    const slot = opts.stateSlot ?? '__host-conformance';
    const smoke = async (api: HostApi | 'host', member: string, fn: () => Promise<void>): Promise<void> => {
      try {
        await fn();
      } catch (e) {
        issues.push({ api, member, severity: 'error', message: `host.${api}.${member}: ${(e as Error).message}` });
      }
    };
    await smoke('profile', 'get', async () => {
      const p = await h.profile!.get();
      if (!p || typeof p !== 'object') throw new Error('get() must resolve to a profile object');
    });
    await smoke('state', 'save/load/list/delete', async () => {
      const payload = { probe: 1, at: 'conformance' };
      await h.state!.save(slot, payload);
      const back = await h.state!.load(slot);
      const data = (back && typeof back === 'object' && 'data' in (back as object)) ? (back as { data: unknown }).data : back;
      if (JSON.stringify(data) !== JSON.stringify(payload)) throw new Error('load() must return what save() stored');
      const listed = await h.state!.list();
      if (!Array.isArray(listed)) throw new Error('list() must resolve to an array');
      await h.state!.delete(slot);
      const gone = await h.state!.load(slot);
      if (gone !== null && gone !== undefined) throw new Error('load() after delete() must resolve to null');
    });
    if (present.includes('net')) {
      await smoke('net', 'fetch', async () => {
        let resolved = false;
        try {
          await (h.net as { fetch: (u: string) => Promise<unknown> }).fetch('https://conformance.invalid/never-allowlisted');
          resolved = true;
        } catch { /* expected: deny by default */ }
        if (resolved) throw new Error('fetch() to a host outside the allowlist must reject');
      });
    }
    if (present.includes('tokens')) {
      await smoke('tokens', 'get/themes', async () => {
        const set = await (h.tokens as { get: () => Promise<{ size?: unknown; resolve?: unknown }> }).get();
        if (!set || typeof set !== 'object') throw new Error('get() must resolve to a token set');
        if (typeof set.size !== 'number') throw new Error('token set must report a numeric size');
        if (typeof set.resolve !== 'function') throw new Error('token set must expose resolve()');
        const themes = await (h.tokens as { themes: () => Promise<unknown> }).themes();
        if (!Array.isArray(themes)) throw new Error('themes() must resolve to an array');
      });
    }
    if (present.includes('color')) {
      await smoke('color', 'contrast', async () => {
        const c = await (h.color as { contrast: (a: string, b: string) => unknown }).contrast('#000000', '#ffffff');
        const n = typeof c === 'number' ? c : (c && typeof c === 'object' && 'ratio' in (c as object)) ? (c as { ratio: unknown }).ratio : c;
        if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('contrast() must yield a finite number');
      });
    }
  }

  return {
    shell: typeof h.shell === 'string' ? h.shell : 'unknown',
    present,
    absent,
    issues,
    ok: !issues.some((i) => i.severity === 'error'),
  };
}

/** One line per issue, for a CLI or a test failure message. */
export function formatConformance(report: ConformanceReport): string {
  const head = `${report.shell}: ${report.ok ? 'conforms' : 'does NOT conform'} - ${report.present.length} optional API(s) present, ${report.absent.length} absent`;
  return [head, ...report.issues.map((i) => `  ${i.severity.toUpperCase()} ${i.api}${i.member ? '.' + i.member : ''}: ${i.message}`)].join('\n');
}
