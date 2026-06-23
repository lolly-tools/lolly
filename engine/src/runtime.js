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

/**
 * @param {Tool} tool                 from loader.js
 * @param {HostV1} host               capability bridge implementation
 * @param {object} [initialState]     from URL params or saved slot
 */
export async function createRuntime(tool, host, initialState = {}) {
  if (host.version !== '1') {
    throw new Error(`Tool requires host bridge v1, got v${host.version}`);
  }

  const profile = await host.profile.get();
  let model = buildInputModel(tool.manifest, { profile, initial: initialState });

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
        if (patch) ({ model, extras } = mergePatch(model, extras, patch));
      } catch (e) {
        host.log('warn', `onInit ${e.message}`, { toolId: tool.manifest.id });
      }
    }
  }

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

    async setInput(id, value) {
      model = updateInput(model, id, value);
      if (hooks?.onInput) {
        try {
          const patch = await withTimeout(hooks.onInput({ id, value: flattenValue(value), model: modelForHooks(model), host }), 2000, tool.manifest.id);
          if (patch) ({ model, extras } = mergePatch(model, extras, patch));
        } catch (e) {
          host.log('warn', `onInput ${e.message}`, { toolId: tool.manifest.id });
        }
      }
      emit();
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
        meta = await buildExportMeta(host, tool.manifest);
      }
      // Data/text formats are produced from the input model (and optional sibling
      // text templates), not the rendered DOM. The engine hydrates the text here
      // and hands it to the host, which only has to wrap it in a Blob (one MIME
      // per format). This keeps the single export entry point — every shell that
      // calls runtime.export gets these formats for free.
      const dataExtra = buildDataPayload(tool, format, model, getHydratedText);
      const blob = await host.export.render(renderedNode, format, {
        ...opts,
        watermark: opts.watermark ?? (isExperimental && !isOnDevice),
        meta,
        // Tag output with a colour profile by default (sRGB for raster, the
        // default press condition for CMYK PDF). Thumbnails stay untagged.
        colorProfile: opts.colorProfile ?? (opts.thumbnail ? 'none' : 'srgb'),
        ...dataExtra,
      });
      if (hooks?.afterExport) {
        await hooks.afterExport({ node: renderedNode, format, opts, host });
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
    throw new Error(`Tool "${tool.manifest.id}" declares format "${format}" but ships no template.${format}`);
  }
  return { dataText: getHydratedText(tpl), dataMime };
}

async function resolveAssetRefs(model, host, dropped = []) {
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

async function loadHooks(tool, host) {
  // Hooks run in a Function() scope with only the host bridge in reach.
  // No window, no global fetch — anything tools need goes through host.
  // typeof guards prevent ReferenceError for hooks that aren't declared.
  const factory = new Function(
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
 */
function mergePatch(model, extras, patch) {
  if (!patch || typeof patch !== 'object') return { model, extras };
  const inputIds = new Set(model.map(i => i.id));
  const newExtras = { ...extras };
  const modelPatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (inputIds.has(k)) modelPatch[k] = v;
    else newExtras[k] = v;
  }
  const newModel = model.map(input =>
    input.id in modelPatch ? { ...input, value: modelPatch[input.id] } : input,
  );
  return { model: newModel, extras: newExtras };
}
