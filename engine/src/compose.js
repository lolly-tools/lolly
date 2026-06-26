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

import { hydrate } from './template.js';
import { modelToValues } from './inputs.js';

/**
 * @param {Tool} tool                          loaded tool (manifest + template)
 * @param {InputModel} model                   current input model
 * @param {object} extras                      current extras (hook-computed values)
 * @param {HostV1} host                        capability bridge
 * @param {readonly string[]} [composeStack]   tool ids already on the compose path
 * @param {Map<string,{key:string,ref:object}>} [memo]  per-id render memo (runtime-owned)
 * @returns {Promise<Record<string, object>>}  { [entry.id]: AssetRef } to merge into extras
 */
export async function resolveNestedRenders(tool, model, extras, host, composeStack = [], memo = new Map()) {
  const specs = tool?.manifest?.composes;
  if (!host?.compose || !Array.isArray(specs) || specs.length === 0) return {};

  const ctx = { ...modelToValues(model), ...extras };
  const out = {};

  for (const spec of specs) {
    if (!spec || typeof spec.id !== 'string' || typeof spec.tool !== 'string') continue;

    // Hydrate input bindings against the parent context. `raw` (no HTML escaping)
    // so values like a URL with `&` pass through untouched — these are values fed
    // to the child input model, not HTML.
    const inputs = {};
    for (const [k, v] of Object.entries(spec.inputs ?? {})) {
      inputs[k] = typeof v === 'string' ? hydrate(v, ctx, { raw: true }) : v;
    }

    const key = composeKey(spec.tool, inputs, spec.format, spec.width, spec.height);
    const cached = memo.get(spec.id);
    if (cached && cached.key === key) { out[spec.id] = cached.ref; continue; }

    try {
      const ref = await host.compose.render({
        toolId: spec.tool,
        inputs,
        format: spec.format,
        width: spec.width,
        height: spec.height,
        _stack: [...composeStack, tool.manifest.id],
      });
      if (ref && typeof ref.url === 'string') {
        out[spec.id] = ref;
        memo.set(spec.id, { key, ref });
      } else {
        memo.delete(spec.id);
      }
    } catch (e) {
      // Graceful: log and omit the slot. The template's {{#if <id>}} hides it and
      // the parent still renders. Covers cycle/depth rejections and child errors.
      host.log?.('warn', `compose "${spec.tool}": ${e.message}`, { toolId: tool.manifest.id });
      memo.delete(spec.id);
    }
  }

  return out;
}

/** Stable cache key for a composition (insensitive to input key order). */
export function composeKey(toolId, inputs, format, width, height) {
  return `${toolId}|${stableStringify(inputs)}|${format ?? ''}|${width ?? ''}x${height ?? ''}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}
