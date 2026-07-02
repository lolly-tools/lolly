// SPDX-License-Identifier: MPL-2.0
/**
 * Compose — resolve a tool's manifest `composes` entries into embeddable assets.
 *
 * Tool composition ("nested exports"): a tool declares, in its manifest, that
 * another tool's render should be embedded as an image. The engine renders the
 * referenced tool (via the host's `compose` capability) and exposes each result
 * as an `extra` keyed by the entry's `id`, so the logic-less template can place
 * it with `{{asset <id>}}` — no template parsing, no tool→tool imports.
 *
 * Each entry's `inputs` string values are Handlebars, hydrated against the SAME
 * context as the template (input values + extras), so a child input can bind to
 * a parent value: `{ "url": "{{url}}" }`. Resolution is memoised per entry id so
 * an unrelated keystroke doesn't re-render the child; the host bridge caches the
 * actual render and owns the depth/cycle guards (we thread the tool-id stack).
 *
 * No-op (returns {}) when the shell provides no `host.compose` or the tool
 * declares no `composes` — so composition degrades gracefully everywhere.
 */

import { hydrate } from './template.ts';
import { modelToValues } from './inputs.ts';
import type { InputModelItem } from './inputs.ts';
import type { AssetRef, ComposeAPI, ExportFormat, HostV1 } from './bridge/host-v1.ts';

/**
 * One manifest `composes` entry, as parsed from JSON. The schema requires
 * `id`/`tool`, but this module defends against malformed entries anyway (the
 * manifest is network content), so every member is optional here and narrowed
 * at the point of use.
 */
export interface ComposeEntry {
  /** Name the composed asset is exposed under (`{{asset <id>}}`). */
  id?: string;
  /** id of the tool to render. */
  tool?: string;
  /** Child inputs; string values are Handlebars bound to the parent context. */
  inputs?: Record<string, unknown>;
  /** Render format for the composed output. */
  format?: ExportFormat;
  /** Render width (child-native when omitted). */
  width?: number;
  /** Render height (child-native when omitted). */
  height?: number;
}

/** The slice of a loaded tool this module reads. */
export interface ComposeToolSlice {
  manifest: { id: string; composes?: readonly ComposeEntry[] };
}

/** The slice of the host bridge compose resolution reads. */
export interface ComposeHost {
  compose?: Pick<ComposeAPI, 'render'>;
  log?: HostV1['log'];
}

/** One memoised child render, keyed by the entry id that produced it. */
export interface ComposeMemoEntry {
  key: string;
  ref: AssetRef;
}

/** Per-runtime render memo: entry id → last render + its cache key. */
export type ComposeMemo = Map<string, ComposeMemoEntry>;

/**
 * @param tool          loaded tool (manifest + template)
 * @param model         current input model
 * @param extras        current extras (hook-computed values)
 * @param host          capability bridge
 * @param composeStack  tool ids already on the compose path
 * @param memo          per-id render memo (runtime-owned)
 * @returns `{ [entry.id]: AssetRef }` to merge into extras
 */
export async function resolveNestedRenders(
  tool: ComposeToolSlice,
  model: InputModelItem[],
  extras: Record<string, unknown>,
  host: ComposeHost,
  composeStack: readonly string[] = [],
  memo: ComposeMemo = new Map(),
): Promise<Record<string, AssetRef | null>> {
  const specs = tool?.manifest?.composes;
  if (!host?.compose || !Array.isArray(specs) || specs.length === 0) return {};
  const compose = host.compose;

  const ctx: Record<string, unknown> = { ...modelToValues(model), ...extras };
  const out: Record<string, AssetRef | null> = {};

  for (const spec of specs) {
    if (!spec || typeof spec.id !== 'string' || typeof spec.tool !== 'string') continue;

    // Hydrate input bindings against the parent context. `raw` (no HTML escaping)
    // so values like a URL with `&` pass through untouched — these are values fed
    // to the child input model, not HTML.
    const inputs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(spec.inputs ?? {})) {
      inputs[k] = typeof v === 'string' ? hydrate(v, ctx, { raw: true }) : v;
    }

    const key = composeKey(spec.tool, inputs, spec.format, spec.width, spec.height);
    const cached = memo.get(spec.id);
    if (cached && cached.key === key) { out[spec.id] = cached.ref; ctx[spec.id] = cached.ref; continue; }

    try {
      const ref = await withTimeout(compose.render({
        toolId: spec.tool,
        inputs,
        format: spec.format,
        width: spec.width,
        height: spec.height,
        _stack: [...composeStack, tool.manifest.id],
      }), COMPOSE_TIMEOUT_MS, spec.tool);
      if (ref && typeof ref.url === 'string') {
        out[spec.id] = ref;
        // Expose to later specs so a subsequent compose can bind to this one
        // (e.g. {{asset earlierId}}); composes resolve top-to-bottom.
        ctx[spec.id] = ref;
        memo.set(spec.id, { key, ref });
      } else {
        // Authoritative: clear the slot so the runtime's additive merge drops a
        // previously-successful render instead of leaving it stale.
        out[spec.id] = null;
        memo.delete(spec.id);
      }
    } catch (e) {
      // Graceful: log and CLEAR the slot. The template's {{#if <id>}} then hides
      // it and the parent still renders. Covers cycle/depth/timeout + child errors.
      const message = e instanceof Error ? e.message : String(e);
      host.log?.('warn', `compose "${spec.tool}": ${message}`, { toolId: tool.manifest.id });
      out[spec.id] = null;
      memo.delete(spec.id);
    }
  }

  return out;
}

// Backstop so a hung/slow child render can't block the parent's mount or a
// keystroke indefinitely; reject → graceful slot clear above. The web bridge has
// its own inner bound (waitForQuiescence), so this only catches a stuck loadTool.
const COMPOSE_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T> | T, ms: number, toolId: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms (${toolId})`)), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e: unknown) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Stable cache key for a composition (insensitive to input key order). */
export function composeKey(
  toolId: string,
  inputs: Record<string, unknown>,
  format?: string,
  width?: number,
  height?: number,
): string {
  return `${toolId}|${stableStringify(inputs)}|${format ?? ''}|${width ?? ''}x${height ?? ''}`;
}

// Any non-null object (arrays included, matching the original typeof check).
const isObjectLike = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

function stableStringify(value: unknown): string {
  if (!isObjectLike(value)) return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}
