// SPDX-License-Identifier: MPL-2.0
/*
 * Lolly bridge - Penpot plugin entry (sandboxed; global `penpot`).
 *
 * The zero-server channel between Lolly and Penpot: the user pastes a Lolly
 * DTCG tokens export or a session SVG into the plugin UI, and this file turns
 * them into Penpot token sets / editable shapes with the plugin API alone.
 * Both operations are frontend-only - Penpot's RPC API refuses cross-origin
 * callers (the preflight 401s with no CORS headers), which is exactly why this
 * is a plugin and not a fetch. Nothing here talks to the network at all: no
 * fetch, no XHR, no dynamic import. That zero-egress property is the privacy
 * story, and shells/web/src/penpot-plugin.test.ts asserts it against this
 * file's text.
 *
 * Ships as static data (like tool hooks.js) - vanilla JS, no build step.
 */

/**
 * The DTCG walker, on a namespace object so the test suite can evaluate this
 * file with node:vm (stub `penpot`) and exercise it directly.
 *
 * flattenTokens(doc) -> { tokens: [{ name, type, value }], skipped: [names] }
 *
 * - Groups walk to dotted names; keys starting with '$' are metadata, not
 *   children (so Tokens-Studio wrappers with $themes/$metadata walk fine -
 *   their set names just become the top path segment).
 * - $type inherits from the nearest ancestor group (DTCG group-level $type).
 * - CRITICAL naming rule (learned against the live token catalog): a Penpot
 *   token at 'edge' BLOCKS 'edge.faint' - dotted names form a hierarchy. So a
 *   node that is BOTH a token ($value) and a group (non-$ children) emits its
 *   leaf as '<name>.default' and keeps walking the children.
 * - Unknown/unmappable $types are skipped and counted, never dropped silently.
 */
const LollyBridge = {
  /** DTCG $type -> Penpot token type. Singular DTCG spellings and the plural
   *  Penpot ones both map, since exports in the wild use either. */
  TYPE_MAP: {
    color: 'color',
    dimension: 'dimension',
    fontFamily: 'fontFamilies',
    fontFamilies: 'fontFamilies',
    fontSize: 'fontSizes',
    fontSizes: 'fontSizes',
    fontWeight: 'fontWeights',
    fontWeights: 'fontWeights',
    letterSpacing: 'letterSpacing',
    number: 'number',
    duration: 'number', // converted to a bare ms number below
    opacity: 'opacity',
    spacing: 'spacing',
    borderRadius: 'borderRadius',
    shadow: 'shadow',
  },

  /** '300ms' | '0.3s' | {value,unit} | 300 -> ms as a string, or null. */
  durationToMs(value) {
    if (value && typeof value === 'object' && 'value' in value) {
      const n = Number(value.value);
      if (!Number.isFinite(n)) return null;
      return String(value.unit === 's' ? n * 1000 : n);
    }
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string') return null;
    const m = value.trim().match(/^(-?\d*\.?\d+)\s*(ms|s)?$/);
    if (!m) return null;
    const n = Number(m[1]);
    return String(m[2] === 's' ? n * 1000 : n);
  },

  /** DTCG dimension objects ({value, unit}) -> '16px'; numbers -> strings.
   *  Penpot token values are strings (or arrays, for fontFamilies). */
  normaliseScalar(value) {
    if (value && typeof value === 'object' && 'value' in value && 'unit' in value) {
      return String(value.value) + String(value.unit);
    }
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    return null;
  },

  /** One DTCG shadow layer -> Penpot's string-field object, or null when the
   *  layer has no offsets (e.g. a CSS-string extension carrying no structure -
   *  the caller skips the whole token and counts it). */
  normaliseShadowLayer(layer) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return null;
    if (!('offsetX' in layer) || !('offsetY' in layer)) return null;
    const dim = (v) => { const s = this.normaliseScalar(v); return s === null ? '0' : s; };
    return {
      color: typeof layer.color === 'string' ? layer.color : '#000000',
      inset: layer.inset === true || layer.inset === 'true' ? 'true' : 'false',
      offsetX: dim(layer.offsetX),
      offsetY: dim(layer.offsetY),
      blur: dim(layer.blur),
      spread: dim(layer.spread),
    };
  },

  /** Map one DTCG token onto {type, value} for Penpot, or null -> skip. */
  mapToken(dtcgType, value) {
    const type = this.TYPE_MAP[dtcgType];
    if (!type) return null;
    if (dtcgType === 'duration') {
      const ms = this.durationToMs(value);
      return ms === null ? null : { type, value: ms };
    }
    if (type === 'shadow') {
      const layers = Array.isArray(value) ? value : [value];
      const out = layers.map((l) => this.normaliseShadowLayer(l));
      if (out.length === 0 || out.some((l) => l === null)) return null;
      return { type, value: out };
    }
    if (type === 'fontFamilies') {
      if (Array.isArray(value)) return { type, value };
      if (typeof value === 'string') return { type, value };
      return null;
    }
    const v = this.normaliseScalar(value);
    return v === null ? null : { type, value: v };
  },

  flattenTokens(doc) {
    const tokens = [];
    const skipped = [];
    const walk = (node, path, inheritedType) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const ownType = typeof node.$type === 'string' ? node.$type : inheritedType;
      const childKeys = Object.keys(node).filter((k) => !k.startsWith('$'));
      if ('$value' in node) {
        // Token - and possibly ALSO a group (see the .default rule above).
        const name = childKeys.length > 0 ? path + '.default' : path;
        const mapped = ownType ? this.mapToken(ownType, node.$value) : null;
        if (mapped) tokens.push({ name, type: mapped.type, value: mapped.value });
        else skipped.push(name);
        // A token node's children (if any) walk WITHOUT its $type: that $type
        // described the leaf, not the subtree.
        for (const k of childKeys) walk(node[k], path ? path + '.' + k : k, inheritedType);
        return;
      }
      for (const k of childKeys) walk(node[k], path ? path + '.' + k : k, ownType);
    };
    walk(doc, '', undefined);
    return { tokens, skipped };
  },
};

/* ── Plugin wiring (everything below needs the real `penpot` global) ────────── */

/** Apply a flattened token list into the named local set, idempotently:
 *  reuse a same-named set, update same-named tokens in place. */
function applyTokens(json, setName) {
  const doc = JSON.parse(json);
  const { tokens, skipped } = LollyBridge.flattenTokens(doc);
  const catalog = penpot.library.local.tokens;
  let set = (catalog.sets || []).find((s) => s.name === setName);
  if (!set) set = catalog.addSet({ name: setName, active: true });
  let added = 0;
  let updated = 0;
  for (const tok of tokens) {
    let existing;
    try {
      existing = (set.tokens || []).find((t) => t.name === tok.name);
    } catch { existing = undefined; }
    if (existing) {
      // Update in place where the API allows it; if the token object refuses
      // assignment, fall back to remove + re-add, and failing that count the
      // token as skipped rather than dying.
      try {
        existing.value = tok.value;
        updated++;
      } catch {
        try {
          if (typeof existing.remove === 'function') existing.remove();
          set.addToken({ type: tok.type, name: tok.name, value: tok.value });
          updated++;
        } catch { skipped.push(tok.name); }
      }
    } else {
      try {
        set.addToken({ type: tok.type, name: tok.name, value: tok.value });
        added++;
      } catch { skipped.push(tok.name); }
    }
  }
  return { type: 'tokens-applied', added, updated, skipped };
}

/** Place a pasted session SVG as editable shapes at the viewport center. */
function placeSvg(svg) {
  const group = penpot.createShapeFromSvg(svg);
  if (!group) throw new Error('Penpot could not parse that SVG');
  try { group.name = 'From Lolly'; } catch { /* name is cosmetic */ }
  // Feature-detect the viewport - older hosts may not expose it.
  try {
    const center = penpot && penpot.viewport && penpot.viewport.center;
    if (center) {
      group.x = center.x - (group.width || 0) / 2;
      group.y = center.y - (group.height || 0) / 2;
    } else {
      group.x = 0;
      group.y = 0;
    }
  } catch { /* leave wherever Penpot dropped it */ }
  let shapes = 1;
  try {
    if (Array.isArray(group.children)) shapes = group.children.length || 1;
  } catch { /* a lone shape is still one shape */ }
  return { type: 'svg-placed', shapes };
}

// Guard the wiring so evaluating this file with a stub penpot (the test) or a
// future API drift can't kill the plugin at load.
try {
  const theme = (typeof penpot.theme === 'string' && penpot.theme) || 'dark';
  penpot.ui.open('Lolly bridge', '/penpot-plugin/index.html?theme=' + encodeURIComponent(theme), {
    width: 420,
    height: 560,
  });

  penpot.ui.onMessage((msg) => {
    // A plugin that throws dies silently - every branch answers, even failure.
    try {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'apply-tokens') {
        penpot.ui.sendMessage(applyTokens(String(msg.json || ''), String(msg.setName || 'brand') || 'brand'));
      } else if (msg.type === 'place-svg') {
        penpot.ui.sendMessage(placeSvg(String(msg.svg || '')));
      }
    } catch (err) {
      try {
        penpot.ui.sendMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
      } catch { /* nothing left to do */ }
    }
  });
} catch (err) {
  /* stubbed host or API drift - stay alive */
}
