// SPDX-License-Identifier: MPL-2.0
/**
 * Runtime — orchestrates the 5-step lifecycle for a single mounted tool.
 *
 *   1. Request tool & template      → loader.js (done before runtime exists)
 *   2. Present inputs               → buildInputModel + host UI
 *   3. Hydrate template             → hydrate()
 *   4. Stage for render             → host configures the render target
 *   5. Render to format             → host.export.render()
 *
 * The runtime is platform-agnostic. It receives a host (the capability bridge)
 * and emits state updates. The shell renders them.
 *
 * Hooks (if the tool declares any) are loaded into a sandboxed context. The
 * runtime invokes them at the right lifecycle points and merges their effects.
 *
 * Patch semantics:
 *   Hooks return a plain object. Keys that match a declared input id update
 *   that input's value. Keys with no matching input go into `extras` — a
 *   parallel store of hook-computed values the template can reference directly.
 *   This is how QR module lists, chart data, etc. reach the template without
 *   being declared as user-facing inputs in the manifest.
 */

import { buildInputModel, updateInput, modelToValues, modelForHooks, flattenValue } from './inputs.js';
import { hydrate } from './template.js';
import { buildExportMeta } from './metadata.js';
import { isTokenValue, isAlias, colorToHex } from './tokens.js';
import { resolveNestedRenders } from './compose.js';

/**
 * @param {Tool} tool                 from loader.js
 * @param {HostV1} host               capability bridge implementation
 * @param {object} [initialState]     from URL params or saved slot
 * @param {object} [opts]
 * @param {readonly string[]} [opts.composeStack]  tool ids already on the compose
 *        path — set by the compose bridge when rendering a child, so nested
 *        composition (A embeds B embeds C) carries cycle/depth detection downward.
 */
export async function createRuntime(tool, host, initialState = {}, opts = {}) {
  if (host.version !== '1') {
    throw new Error(`Tool requires host bridge v1, got v${host.version}`);
  }
  const composeStack = opts.composeStack ?? [];
  // Per-runtime memo so resolveNestedRenders skips re-rendering a child whose
  // bound inputs are unchanged across keystrokes.
  const composeMemo = new Map();
  // Monotonic id so an out-of-order (slow) nested render from an earlier
  // setInput can't overwrite a newer value's render — see setInput below.
  let setInputSeq = 0;

  const profile = await host.profile.get();
  let model = buildInputModel(tool.manifest, { profile, initial: initialState });

  // The set of declared input ids is fixed for the life of the runtime (only
  // values change across keystrokes), so build it once here and reuse it in
  // mergePatch rather than rebuilding a Set on every hook patch.
  const inputIds = new Set(model.map(i => i.id));

  // Hook failures recorded for the shell: onInit blanking the canvas was
  // previously only logged, so a shell had no way to show its error banner.
  // The array is exposed on the runtime; entries: { hook, message }.
  const hookErrors = [];

  // Resolve any unresolved asset refs (from URL mode or a saved session). Any
  // that no longer resolve (e.g. a user deleted an image a saved design used) are
  // collected so the shell can tell the user the field was left blank.
  const droppedAssets = [];
  model = await resolveAssetRefs(model, host, droppedAssets);

  // Resolve token-referenced colour values (from URL mode or a saved session)
  // against the live token set, refreshing each cached hex so a token edit
  // propagates. Mirrors resolveAssetRefs; a no-op on shells without host.tokens.
  model = await resolveTokenRefs(model, host);

  // extras: hook-computed values that have no matching input id.
  // Available to templates alongside input values.
  let extras = {};

  let hooks = null;
  if (tool.hooksSource && tool.manifest.hooks) {
    hooks = await loadHooks(tool, host);
    if (hooks.onInit) {
      try {
        const patch = await withTimeout(hooks.onInit({ model: modelForHooks(model), host }), 5000, tool.manifest.id);
        if (patch) ({ model, extras } = mergePatch(model, extras, patch, inputIds));
      } catch (e) {
        // Record the failure (not just log it) so the shell can show a canvas-error
        // banner instead of silently hydrating against missing extras. Still don't
        // throw — the lifecycle stays resilient and the canvas renders what it can.
        hookErrors.push({ hook: 'onInit', message: e.message });
        host.log('error', `onInit ${e.message}`, { toolId: tool.manifest.id });
      }
    }
  }

  // Nested renders (manifest `composes`): render referenced tools to embeddable
  // assets and expose them as extras for `{{asset <id>}}`. Awaited here so the
  // first paint already carries the embed. A no-op without host.compose.
  extras = { ...extras, ...await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo) };

  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn({ model, hydrated: getHydrated() }));

  // The template context (flattened input values + hook extras) is rebuilt only
  // when `model` or `extras` is replaced. Both are swapped wholesale on every
  // mutation — updateInput/mergePatch/resolve* return fresh objects, never patch
  // in place — so reference equality is a sound cache key. This avoids
  // re-flattening the whole model on every render/emit (one emit per keystroke),
  // and Handlebars never mutates the data object so the cached one is safe to
  // share across the main template + data-format (raw) hydrations.
  let ctxCache = null;
  let ctxModel = null;
  let ctxExtras = null;
  function templateContext() {
    if (ctxModel !== model || ctxExtras !== extras) {
      ctxCache = { ...modelToValues(model), ...extras };
      ctxModel = model;
      ctxExtras = extras;
    }
    return ctxCache;
  }

  function getHydrated() {
    return hydrate(tool.template, templateContext());
  }

  // Hydrate an arbitrary template string against the SAME context as the main
  // template (input values + hook extras). Used by shells for things like a
  // live accessible-label summary of the current render (manifest.a11yLabel).
  function getHydratedString(str) {
    return str ? hydrate(str, templateContext()) : '';
  }

  // Same context, but WITHOUT HTML escaping — for non-HTML data templates
  // (template.ics/.vcf/.csv). Each data format escapes via its own helper.
  function getHydratedText(str) {
    return str ? hydrate(str, templateContext(), { raw: true }) : '';
  }

  return {
    getModel: () => model,
    getHydrated,
    getHydratedString,
    manifest: tool.manifest,
    styles: tool.styles,
    // Asset refs (from a saved session / URL) that no longer resolve. The shell
    // reads this once after mount to surface a "left blank" notice.
    droppedAssets,
    // Hook failures (currently onInit) so a shell can show a canvas-error banner
    // instead of a silently-blank canvas. Empty when every hook ran cleanly.
    hookErrors,

    async setInput(id, value) {
      model = updateInput(model, id, value);
      const seq = ++setInputSeq;
      // Paint the keystroke immediately, BEFORE awaiting the onInput hook (which may
      // do IndexedDB asset reads). Blocking the visible update on the hook made every
      // keystroke feel laggy. A hook that rewrites the just-typed input (e.g. quote
      // capitalisation) then triggers a one-frame correction on the re-emit below —
      // acceptable per the perf plan; the FINAL state is always the post-hook value.
      emit();
      if (hooks?.onInput) {
        try {
          const patch = await withTimeout(hooks.onInput({ id, value: flattenValue(value), model: modelForHooks(model), host }), 2000, tool.manifest.id);
          if (patch) {
            ({ model, extras } = mergePatch(model, extras, patch, inputIds));
            emit(); // re-emit with the hook's patch so the final state is correct
          }
        } catch (e) {
          host.log('warn', `onInput ${e.message}`, { toolId: tool.manifest.id });
        }
      }
      // Re-resolve nested renders OFF the critical path. Commit + re-emit only if
      // this is still the latest setInput (so an out-of-order child render can't
      // clobber a newer value, M5) and the resolved refs actually changed.
      if (host.compose && tool.manifest.composes?.length) {
        const composeOut = await resolveNestedRenders(tool, model, extras, host, composeStack, composeMemo);
        const changed = Object.keys(composeOut).some(k => extras[k] !== composeOut[k]);
        if (seq === setInputSeq && changed) {
          extras = { ...extras, ...composeOut };
          emit();
        }
      }
    },

    subscribe(fn) {
      listeners.add(fn);
      fn({ model, hydrated: getHydrated() });
      return () => listeners.delete(fn);
    },

    // Re-notify subscribers with the CURRENT model — no value change. For shell
    // state that lives outside the input model but still affects the render (e.g.
    // export dimensions): a shell can force the canvas to re-hydrate through the
    // one render path instead of mutating the DOM itself. Used to invalidate a
    // deferred preview (manifest.render.preview) when the capture geometry changes.
    refresh: emit,

    // Whether this tool produces output via the transform path (a user file in →
    // transformed file out) rather than the DOM-render path. Shells use it to wire
    // a "download the result" action to runtime.exportFile instead of export().
    hasExportFile: Boolean(tool.manifest.hooks?.exportFile),

    /**
     * Produce a transformed file from the tool's own inputs (the file-utility
     * shape: bytes in → bytes out). Runs the tool's `exportFile` hook, which
     * reads the picked file's bytes (input.value.bytes) and returns the result as
     * a plain { bytes, mime, filename } record. The shell wraps it in a Blob and
     * delivers it via host.export.file. NEVER watermarked and NO provenance is
     * embedded — the bytes are the user's own content, not a generated artifact.
     */
    async exportFile(opts = {}) {
      if (!hooks?.exportFile) {
        throw new Error(`Tool "${tool.manifest.id}" has no exportFile hook`);
      }
      const out = await withTimeout(
        hooks.exportFile({ model: modelForHooks(model), host, opts }),
        10000, tool.manifest.id,
      );
      if (!out || out.bytes == null) {
        throw new Error(`exportFile produced no bytes (${tool.manifest.id})`);
      }
      return out; // { bytes: Uint8Array|ArrayBuffer, mime, filename }
    },

    async export(renderedNode, format, opts = {}) {
      if (hooks?.beforeExport) {
        await hooks.beforeExport({ node: renderedNode, format, opts, host });
      }
      // Surface the 'Convert paths' export toggle (a synthetic export-group input)
      // to the bridge as opts.convertPaths, unless the caller set it explicitly.
      // When a tool suppresses the toggle (render.convertPaths:false) there's no
      // input to read, so honour the manifest opt-out directly — otherwise the
      // bridge's default would outline text anyway.
      if (opts.convertPaths === undefined) {
        const cp = model.find(i => i.id === 'convertPaths');
        if (cp) opts = { ...opts, convertPaths: Boolean(cp.value) };
        else if (tool.manifest?.render?.convertPaths === false) opts = { ...opts, convertPaths: false };
      }
      const isExperimental = tool.manifest.status === 'experimental';
      // On-device utilities (privacy:'on-device') process the user's OWN content,
      // so we must NOT stamp anything into the output: no provenance metadata
      // (it would be ironic to *add* identifying metadata while claiming to scrub
      // it) and no watermark. This also covers render-path utilities (crop/resize);
      // the exportFile transform path never embeds either way.
      const isOnDevice = tool.manifest.privacy === 'on-device';
      // Provenance: stamp authorship into the asset itself (per-format, in the
      // bridge). Auto-assembled from the host profile + tool unless the caller
      // supplied its own `meta` or opted out (e.g. thumbnails) with embedMeta:false.
      let meta = opts.meta;
      if (meta === undefined && opts.embedMeta !== false && !isOnDevice) {
        meta = await buildExportMeta(host, tool.manifest, profile);
      }
      // Data/text formats are produced from the input model (and optional sibling
      // text templates), not the rendered DOM. The engine hydrates the text here
      // and hands it to the host, which only has to wrap it in a Blob (one MIME
      // per format). This keeps the single export entry point — every shell that
      // calls runtime.export gets these formats for free.
      const dataExtra = buildDataPayload(tool, format, model, getHydratedText);
      let blob;
      try {
        blob = await host.export.render(renderedNode, format, {
          ...opts,
          watermark: opts.watermark ?? (isExperimental && !isOnDevice),
          meta,
          // Tag output with a colour profile by default (sRGB for raster, the
          // default press condition for CMYK PDF). Thumbnails stay untagged.
          colorProfile: opts.colorProfile ?? (opts.thumbnail ? 'none' : 'srgb'),
          ...dataExtra,
        });
      } finally {
        // afterExport is a cleanup guarantee (e.g. tools that mutate the live node
        // in beforeExport) — run it even if render throws, so a failed export
        // can't leave hook state / the DOM in the export configuration.
        if (hooks?.afterExport) {
          await hooks.afterExport({ node: renderedNode, format, opts, host });
        }
      }
      return blob;
    },
  };
}

// Text/data export formats and their MIME types. These are produced from the
// model rather than the rendered DOM, so the engine assembles the payload and
// the host just wraps it in a Blob. JSON is derived from the resolved input
// values; ICS/VCF/CSV come from a sibling text template (template.<ext>).
const DATA_FORMATS = { json: 'application/json', csv: 'text/csv', ics: 'text/calendar', vcf: 'text/vcard' };

// Returns { dataText, dataMime } for a data/text format, or {} for render
// formats (png/svg/pdf/…) so the host takes its normal DOM path.
function buildDataPayload(tool, format, model, getHydratedText) {
  const dataMime = DATA_FORMATS[format];
  if (!dataMime) return {};
  if (format === 'json') {
    const dataText = JSON.stringify(
      { tool: tool.manifest.id, version: tool.manifest.version, inputs: modelToValues(model) },
      null, 2,
    );
    return { dataText, dataMime };
  }
  const tpl = tool.textTemplates?.[format];
  if (tpl == null) {
    // Distinguish a template that failed to LOAD (transient/CDN) from one that's
    // genuinely absent, so a shell can map the failure to the right message
    // (e.g. "try again" vs. "this tool can't produce that format"). Tag both with
    // a stable code the shell can branch on.
    const loadError = tool.textTemplateErrors?.[format];
    const err = new Error(
      loadError != null
        ? `Tool "${tool.manifest.id}" couldn't load its template.${format} (${loadError})`
        : `Tool "${tool.manifest.id}" declares format "${format}" but ships no template.${format}`,
    );
    err.code = loadError != null ? 'TEXT_TEMPLATE_LOAD_FAILED' : 'TEXT_TEMPLATE_MISSING';
    throw err;
  }
  return { dataText: getHydratedText(tpl), dataMime };
}

// True when an input carries an asset ref that still needs resolving — either a
// top-level asset value or a block whose declared asset sub-fields hold a ref.
function inputNeedsAssetResolve(input) {
  const v = input.value;
  if (v && typeof v === 'object' && input.type === 'asset' && typeof v.id === 'string') return true;
  if (input.type === 'blocks' && Array.isArray(v)) {
    const assetFields = (input.fields ?? []).filter(f => f.type === 'asset');
    if (!assetFields.length) return false;
    return v.some(item => item && typeof item === 'object' &&
      assetFields.some(f => { const r = item[f.id]; return r && typeof r === 'object' && typeof r.id === 'string'; }));
  }
  return false;
}

async function resolveAssetRefs(model, host, dropped = []) {
  // Nothing to resolve → return the SAME model reference (no array/object churn,
  // no microtask). Most mounts have no unresolved asset refs at all.
  if (!model.some(inputNeedsAssetResolve)) return model;

  const resolveOne = async (id, inputId, label) => {
    // Re-resolve any asset ref that carries an id — this covers both the
    // _unresolved URL-mode path AND saved-session refs.  Saved sessions store
    // the full resolved object, but blob: URLs are session-scoped and invalid
    // after a page reload, so we always re-fetch a fresh blob URL from the cache.
    try {
      return await host.assets.get(id);
    } catch (e) {
      host.log('warn', `Failed to resolve asset ${id}`, { error: String(e) });
      dropped.push({ inputId, label, id });
      return null;
    }
  };

  return Promise.all(
    model.map(async input => {
      const v = input.value;
      if (v && typeof v === 'object' && input.type === 'asset' && typeof v.id === 'string') {
        return { ...input, value: await resolveOne(v.id, input.id, input.label || input.id) };
      }
      // Blocks may carry asset sub-fields (declared type:'asset'); resolve each
      // block item's ref so per-block images work in URL mode / CLI exactly as
      // they do via the web picker (which stores an already-resolved ref).
      if (input.type === 'blocks' && Array.isArray(v)) {
        const assetFields = (input.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
        if (!assetFields.length) return input;
        const value = await Promise.all(v.map(async item => {
          if (!item || typeof item !== 'object') return item;
          const next = { ...item };
          for (const fid of assetFields) {
            const ref = item[fid];
            if (ref && typeof ref === 'object' && typeof ref.id === 'string') {
              next[fid] = await resolveOne(ref.id, `${input.id}.${fid}`, input.label || input.id);
            }
          }
          return next;
        }));
        return { ...input, value };
      }
      return input;
    }),
  );
}

// Re-resolve token-backed colour values against the live token set. A value is
// token-backed when it's a { ref, value } object (saved session / resolved URL)
// or a bare `{path}` alias string (freshly parsed from a URL). Each becomes a
// { ref, value:<hex> } pair: the ref keeps it canonical, the hex is the cached
// fallback for when the token is absent on this device.
async function resolveTokenRefs(model, host) {
  if (!host.tokens) return model; // shell without token support — leave values as-is
  // No colour input carries a token ref/alias → skip the host.tokens.get() round
  // trip entirely and keep the same model reference.
  const needs = model.some(i => i.type === 'color' && (isTokenValue(i.value) || isAlias(i.value)));
  if (!needs) return model;
  let set;
  try { set = await host.tokens.get(); } catch { return model; }
  return model.map(input => {
    if (input.type !== 'color') return input;
    const v = input.value;
    const ref = isTokenValue(v) ? v.ref : (isAlias(v) ? v : null);
    if (!ref) return input;
    const resolved = set.resolve(ref);
    if (resolved !== undefined) return { ...input, value: { ref, value: colorToHex(resolved) } };
    // Unresolved here: keep the cached value if we had one; otherwise mark it
    // resolved-to-nothing so modelToValues yields '' rather than the raw alias.
    return { ...input, value: isTokenValue(v) ? v : { ref, value: undefined } };
  });
}

// Compiled hook factories, memoised by tool id@version. `new Function(...)`
// re-parses the whole hooks.js source (chart-creator is ~525 lines) — but the
// source is identical for a given tool version, and the factory is host-agnostic
// (it only takes `host` as an argument), so the compiled factory is safe to reuse
// across every mount/re-mount of that version.
const hookFactoryCache = new Map();

function getHookFactory(tool) {
  const key = `${tool.manifest.id}@${tool.manifest.version}`;
  let factory = hookFactoryCache.get(key);
  if (!factory) {
    // Hooks run in a Function() scope with only the host bridge in reach.
    // No window, no global fetch — anything tools need goes through host.
    // typeof guards prevent ReferenceError for hooks that aren't declared.
    factory = new Function(
      'host',
      `${tool.hooksSource}; return {` +
      `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
      `onInput: typeof onInput !== 'undefined' ? onInput : null,` +
      `beforeRender: typeof beforeRender !== 'undefined' ? beforeRender : null,` +
      `beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null,` +
      `afterExport:  typeof afterExport  !== 'undefined' ? afterExport  : null,` +
      `exportFile:   typeof exportFile   !== 'undefined' ? exportFile   : null` +
      `};`,
    );
    hookFactoryCache.set(key, factory);
  }
  return factory;
}

async function loadHooks(tool, host) {
  const factory = getHookFactory(tool);
  const mod = factory(host);
  return {
    onInit:       typeof mod.onInit       === 'function' ? mod.onInit       : null,
    onInput:      typeof mod.onInput      === 'function' ? mod.onInput      : null,
    beforeRender: typeof mod.beforeRender === 'function' ? mod.beforeRender : null,
    beforeExport: typeof mod.beforeExport === 'function' ? mod.beforeExport : null,
    afterExport:  typeof mod.afterExport  === 'function' ? mod.afterExport  : null,
    exportFile:   typeof mod.exportFile   === 'function' ? mod.exportFile   : null,
  };
}

function withTimeout(promise, ms, toolId) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms (${toolId})`)), ms);
    Promise.resolve(promise).then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Split a hook patch into model updates (declared input ids) and extras
 * (computed values with no matching input). Returns updated model + extras.
 *
 * `inputIds` is the runtime's stable Set of declared ids (built once at mount).
 * When the patch touches no declared input (the common extras-only case, e.g. a
 * hook that only computes QR modules / badge geometry) the SAME model reference
 * is returned, so templateContext's ref-equality cache isn't needlessly busted.
 */
function mergePatch(model, extras, patch, inputIds) {
  if (!patch || typeof patch !== 'object') return { model, extras };
  const ids = inputIds ?? new Set(model.map(i => i.id));
  const newExtras = { ...extras };
  const modelPatch = {};
  let hasModelPatch = false;
  for (const [k, v] of Object.entries(patch)) {
    if (ids.has(k)) { modelPatch[k] = v; hasModelPatch = true; }
    else newExtras[k] = v;
  }
  const newModel = hasModelPatch
    ? model.map(input => (input.id in modelPatch ? { ...input, value: modelPatch[input.id] } : input))
    : model;
  return { model: newModel, extras: newExtras };
}
