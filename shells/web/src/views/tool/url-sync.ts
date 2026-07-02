// SPDX-License-Identifier: MPL-2.0
/**
 * Address-bar URL state for the tool view (finding 1): the per-mount syncUrl
 * writer (dirty-param tracking + auto-pack), the default-stripping shrinkUrl,
 * and the share-link query builder. Extracted from tool.js unchanged.
 */
import type { Runtime, ToolManifest, InputValue, BlockFieldSpec } from '@lolly/engine';
import { isTokenValue, packQuery, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM, DEFAULT_CMYK_CONDITION } from '@lolly/engine';
import {
  AUTO_PACK_MIN, isCmykFmt, isPrintFmt, marksToCsv, printEnabled, readBleed, readMarks,
} from './constants.ts';

/** The runtime slice URL writers read (the live model). */
type UrlRuntime = Pick<Runtime, 'getModel'>;

/** Read a string `id` member off a structured input value (AssetRef-ish), if any. */
const objectId = (value: InputValue | undefined): string | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
    const id = value.id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
};

/** Structured (indexable) input value — a vector compound or a blocks row. */
const isRecord = (v: InputValue | undefined): v is { [key: string]: InputValue | undefined } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);

const inputValue = (scope: Element | null | undefined, selector: string): string | undefined =>
  scope?.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value;
const inputChecked = (scope: Element | null | undefined, selector: string): boolean | undefined =>
  scope?.querySelector<HTMLInputElement>(selector)?.checked;

/**
 * Monotonic guard shared by every address-bar writer (syncUrl AND shrinkUrl). It's
 * bumped on EVERY bar write, so any later write invalidates an in-flight async pack
 * — a stale pack from an earlier (larger) state can never clobber a newer bar. A
 * holder object (not a bare `let`) so shrinkUrl can share it.
 */
export interface BarSeq { v: number; }

export interface UrlSync {
  /** Write the address bar from the model's dirty params (plus export controls). */
  syncUrl(dirtyId?: string): void;
  /** Record a param as dirty without writing (the coalesced render writes later). */
  markDirty(id: string): void;
  /** Forget every dirty param (the "Clear changes" reset). */
  clearDirty(): void;
  /** Shared write-guard, passed to shrinkUrl. */
  readonly barSeq: BarSeq;
}

export function createUrlSync({ runtime, toolUrlBase, urlParams, actionsEl }: {
  runtime: UrlRuntime;
  /** Canonical path form for this tool, e.g. `/t/qr-code`. */
  toolUrlBase: string;
  /** The params this mount was routed with (seeds the dirty set). */
  urlParams: string | null | undefined;
  /** The export actions bar (export controls are read live from it). */
  actionsEl: Element | null;
}): UrlSync {
  // Seed from the params this mount was routed with (form-agnostic — works whether the
  // bar arrived as /t/<id>?… or #/tool/<id>?…) so shared/bookmarked links survive the
  // first subscribe callback.
  const dirtyParams = new Set(new URLSearchParams(urlParams || '').keys());
  const barSeq: BarSeq = { v: 0 };

  function syncUrl(dirtyId?: string): void {
    if (dirtyId) dirtyParams.add(dirtyId);

    const params = new URLSearchParams();

    for (const entry of runtime.getModel()) {
      const { id, type, value } = entry;
      if (!dirtyParams.has(id)) continue;
      // A picked file is binary, in-memory, device-local content — it has no
      // shareable URL form. Never write it (would otherwise serialise to junk).
      if (type === 'file') continue;
      if (type === 'asset') {
        // Library assets are shareable by ID; user uploads are device-local.
        const assetId = objectId(value);
        if (assetId && !assetId.startsWith('user/')) params.set(id, assetId);
        continue;
      }
      if (type === 'blocks') {
        if (Array.isArray(value) && value.length > 0) {
          const json = JSON.stringify(value);
          if (json.length <= 8000) params.set(id, json);
        }
        continue;
      }
      if (type === 'vector') {
        // One flat param per field: "<inputId>.<fieldId>" (e.g. transform.zoom=200).
        if (isRecord(value)) {
          for (const f of entry.fields ?? []) {
            const fv = value[f.id];
            if (fv !== undefined && fv !== null) params.set(`${id}.${f.id}`, String(fv));
          }
        }
        continue;
      }
      if (value == null || value === '') continue;
      if (typeof value === 'boolean' && !value) continue;
      // A token-backed colour ({ ref, value }) serialises to its canonical token ref
      // (mirrors the engine's coerceToString) — never String()'d into the URL as
      // "[object Object]", which would then ride into a lolly-URL embed of this tool.
      const str = type === 'color' && isTokenValue(value) ? value.ref : String(value);
      if (str.length > 150) continue;
      params.set(id, str);
    }

    if (dirtyParams.has('w')) {
      const w = parseInt(inputValue(actionsEl, '[data-action="export-width"]') ?? '', 10);
      if (w > 0) params.set('w', String(w));
    }
    if (dirtyParams.has('h')) {
      const h = parseInt(inputValue(actionsEl, '[data-action="export-height"]') ?? '', 10);
      if (h > 0) params.set('h', String(h));
    }
    if (dirtyParams.has('unit')) {
      const u = inputValue(actionsEl, '[data-action="export-unit"]');
      if (u && u !== 'px') params.set('unit', u);
    }
    if (dirtyParams.has('dpi')) {
      const d = parseInt(inputValue(actionsEl, '[data-action="export-dpi"]') ?? '', 10);
      const u = inputValue(actionsEl, '[data-action="export-unit"]');
      if (d > 0 && u && u !== 'px') params.set('dpi', String(d));
    }
    if (dirtyParams.has('format')) {
      const fmt = inputValue(actionsEl, '[data-action="format"]');
      if (fmt) params.set('format', fmt);
    }
    if (dirtyParams.has('filename')) {
      const filename = inputValue(actionsEl, '[data-action="filename"]')?.trim();
      if (filename) params.set('filename', filename);
    }
    if (dirtyParams.has('profile')) {
      // Meaningful for the CMYK print formats (Print PDF / Print TIFF); share it only
      // when one is selected and it isn't the default condition (keeps links clean).
      const fmt = inputValue(actionsEl, '[data-action="format"]');
      const prof = inputValue(actionsEl, '[data-action="cmyk-profile"]');
      if (isCmykFmt(fmt) && prof && prof !== DEFAULT_CMYK_CONDITION) params.set('profile', prof);
    }
    if (dirtyParams.has('password')) {
      // Open-password for the standard PDF only; carried clear-text by design (a
      // basic lock for short-lived transactional material). Empty value → omitted.
      const fmt = inputValue(actionsEl, '[data-action="format"]');
      const pw = inputValue(actionsEl, '[data-action="pdf-password"]');
      if (fmt === 'pdf' && pw) params.set('password', pw);
    }
    if (dirtyParams.has('bleed') || dirtyParams.has('marks')) {
      // Print marks & bleed — print formats (pdf / pdf-cmyk / cmyk-tiff) only, and
      // only when the card is on.
      const fmt = inputValue(actionsEl, '[data-action="format"]');
      const on  = inputChecked(actionsEl, '[data-action="print-enable"]');
      if (isPrintFmt(fmt) && on) {
        const mm = parseFloat(inputValue(actionsEl, '[data-action="print-bleed"]') ?? '');
        if (mm > 0) params.set('bleed', `${mm}mm`);
        const csv = marksToCsv({
          crop:         inputChecked(actionsEl, '[data-action="mark-crop"]'),
          registration: inputChecked(actionsEl, '[data-action="mark-reg"]'),
          bleed:        inputChecked(actionsEl, '[data-action="mark-bleed"]'),
          colorBars:    inputChecked(actionsEl, '[data-action="mark-bars"]'),
          provenance:   inputChecked(actionsEl, '[data-action="mark-prov"]'),
        });
        if (csv) params.set('marks', csv);
      }
    }
    if (dirtyParams.has('nostage')) {
      // Full-page HTML export — a presence flag, written only while HTML is the
      // selected format and the toggle is on (so it drops off other formats).
      const fmt = inputValue(actionsEl, '[data-action="format"]');
      const on  = inputChecked(actionsEl, '[data-action="full-page"]');
      if (fmt === 'html' && on) params.set('nostage', '');
    }

    const qs = params.toString();
    // Bump the shared guard on EVERY write (not just when we pack) so a later,
    // possibly sub-threshold, syncUrl invalidates any pack still in flight from an
    // earlier large state — otherwise that stale pack could resolve afterward and
    // overwrite this bar with the old state.
    const seq = ++barSeq.v;
    history.replaceState(null, '', qs ? `${toolUrlBase}?${qs}` : toolUrlBase);

    // Auto-switch to the packed form once the readable query gets long enough to
    // risk the ~2000-char URL ceiling. The readable write above already landed, so
    // simple links stay readable/editable and only large states get compressed —
    // and only if packing is available AND genuinely shorter. Async + seq-guarded so
    // a slow pack from an older keystroke can never clobber a newer bar.
    if (qs.length >= AUTO_PACK_MIN && isPackAvailable()) {
      packQuery(qs).then(token => {
        if (token == null || seq !== barSeq.v) return;      // unavailable, or superseded
        const packed = `${PACK_PARAM}=${token}`;
        if (packed.length >= qs.length) return;             // packing didn't help — keep readable
        history.replaceState(null, '', `${toolUrlBase}?${packed}`);
      }).catch(() => { /* keep the readable URL already written */ });
    }
  }

  return {
    syncUrl,
    markDirty(id: string): void { dirtyParams.add(id); },
    clearDirty(): void { dirtyParams.clear(); },
    barSeq,
  };
}

function matchesDefault(input: { default?: InputValue; type: string }, paramVal: string): boolean {
  const def = input.default;
  if (def == null) return false;
  if (input.type === 'blocks') return false;
  if (input.type === 'boolean') return (paramVal === '1' || paramVal === 'true') === !!def;
  if (input.type === 'number')  return Number(paramVal) === Number(def);
  if (input.type === 'color')   return paramVal.replace(/^#/, '').toLowerCase() === String(def).replace(/^#/, '').toLowerCase();
  return paramVal === String(def);
}

/**
 * Remove URL params from the live address bar that already equal the tool's defaults.
 * Operates on the raw query string to preserve compact encodings (e.g. ~,).
 */
export async function shrinkUrl(runtime: UrlRuntime, manifest: ToolManifest, barSeq: BarSeq | null): Promise<void> {
  // The bar is normally the path form /t/<id>?… by now; tolerate the boot-time hash
  // form too. Keep the route part, rewrite only the query.
  const hashQ = window.location.hash.indexOf('?');
  const rawQs = window.location.search ? window.location.search.slice(1)
           : (hashQ >= 0 ? window.location.hash.slice(hashQ + 1) : '');
  if (!rawQs) return;
  const base = window.location.pathname + (window.location.hash.split('?')[0] ?? '');

  // If the bar is already packed, expand it back to the readable query so the
  // default-stripping below can see individual params (it operates per-key).
  const qs = hasPackedState(rawQs) ? await expandQuery(rawQs) : rawQs;

  const model = runtime.getModel();
  const inputsByKey: Record<string, (typeof model)[number]> = {};
  for (const input of model) {
    inputsByKey[input.id] = input;
    if (input.urlKey) inputsByKey[input.urlKey] = input;
  }

  const RESERVED_KEEP = new Set(['format', 'export', 'copy', 'slot', 'output', 'full', '_v', 'nostage']);

  const kept: string[] = [];
  for (const part of qs.split('&')) {
    if (!part) continue;
    const eqIdx  = part.indexOf('=');
    const key    = eqIdx < 0 ? part : part.slice(0, eqIdx);
    const rawVal = eqIdx < 0 ? '' : part.slice(eqIdx + 1);
    const val    = decodeURIComponent(rawVal.replace(/\+/g, ' '));

    if (RESERVED_KEEP.has(key)) { kept.push(part); continue; }

    if (key === 'w' || key === 'width') {
      if (parseInt(val, 10) !== manifest.render.width) kept.push(part);
      continue;
    }
    if (key === 'h' || key === 'height') {
      if (parseInt(val, 10) !== manifest.render.height) kept.push(part);
      continue;
    }
    if (key === 'filename') {
      if (val !== manifest.name) kept.push(part);
      continue;
    }

    const input = inputsByKey[key];
    if (!input || !matchesDefault(input, val)) kept.push(part);
  }

  const newQs = kept.join('&');
  // Bump the shared guard so an in-flight syncUrl pack can't resolve later and clobber
  // this shrunk bar with the pre-shrink state (barSeq is the same holder syncUrl uses).
  const seq = barSeq ? ++barSeq.v : 0;
  // Re-pack if the shrunk-but-still-large query would still risk the URL ceiling and
  // packing actually wins; otherwise leave the readable form (shorter and editable).
  if (newQs.length >= AUTO_PACK_MIN && isPackAvailable()) {
    const token = await packQuery(newQs);
    if (barSeq && seq !== barSeq.v) return;             // a newer bar write happened mid-pack
    const packed = token && `${PACK_PARAM}=${token}`;
    if (packed && packed.length < newQs.length) {
      history.replaceState(null, '', `${base}?${packed}`);
      return;
    }
  }
  history.replaceState(null, '', newQs ? `${base}?${newQs}` : base);
}

/**
 * Encode a blocks array into the compact tilde-delimited URL format.
 * Each item's fields are comma-separated; items are tilde-separated.
 * Field values are encodeURIComponent'd so commas inside values become %2C
 * and are safe to split on. Color fields have their # stripped.
 * Returns null if encoding isn't possible (no fields defined).
 */
export function encodeBlocksCompact(items: InputValue, fields: BlockFieldSpec[]): string | null {
  if (!Array.isArray(items) || !items.length || !fields.length) return null;
  return items.map(item =>
    fields.map(f => {
      const raw = isRecord(item) ? item[f.id] : undefined;
      // Asset sub-fields hold an AssetRef object — encode its id (library assets
      // only; uploaded user/ refs aren't shareable, same as top-level assets).
      if (f.type === 'asset') {
        const id = raw && typeof raw === 'object' ? objectId(raw) : '';
        return encodeURIComponent(id && !String(id).startsWith('user/') ? id : '');
      }
      const v = String(raw ?? '');
      const s = f.type === 'color' ? v.replace(/^#/, '') : v;
      return encodeURIComponent(s);
    }).join(',')
  ).join('~');
}

// Builds the base share-link query parts (tool inputs + the chosen export
// settings) — WITHOUT the on-visit behaviour flags (full/options/export/copy/_v),
// which the share dialog appends per the user's toggles.
export function buildShareParams(runtime: UrlRuntime, exportScope: Element | null): string[] {
  const parts: string[] = [];

  for (const input of runtime.getModel()) {
    const { id, type, value, group, fields } = input;
    const key = input.urlKey ?? id;
    if (group === 'export') continue;

    if (type === 'asset') {
      const assetId = objectId(value);
      if (assetId && !assetId.startsWith('user/')) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(assetId)}`);
      }
      continue;
    }

    if (type === 'blocks') {
      if (!Array.isArray(value) || value.length === 0) continue;
      const compact = encodeBlocksCompact(value, fields ?? []);
      // Fall back to JSON if no fields defined (other tools)
      const encoded = compact ?? JSON.stringify(value);
      if (encoded.length <= 8000) parts.push(`${key}=${compact ? encoded : encodeURIComponent(encoded)}`);
      continue;
    }

    if (type === 'vector') {
      // One flat param per field ("<inputId>.<fieldId>"), matching syncUrl and
      // serializeUrlState. Without this the object stringifies to "[object Object]".
      // Fields still at their default are omitted to keep the link short.
      if (isRecord(value)) {
        for (const f of fields ?? []) {
          const fv = value[f.id];
          if (fv == null) continue;
          if (f.default !== undefined && String(fv) === String(f.default)) continue;
          parts.push(`${encodeURIComponent(`${key}.${f.id}`)}=${encodeURIComponent(String(fv))}`);
        }
      }
      continue;
    }

    if (value == null || value === '') continue;
    if (typeof value === 'boolean' && !value) continue;

    // Skip params whose value matches the declared default — they load identically
    // without being in the URL. (Assets were handled above, so no type guard here.)
    const def = input.default;
    if (def != null) {
      if (String(value) === String(def)) continue;
    }

    // A token-backed colour ({ ref, value }) serialises to its canonical token ref
    // so a shared/embedded link re-resolves against the destination's tokens — and
    // never leaks "[object Object]" into the URL (mirrors the engine's coerceToString).
    let str = type === 'color' && isTokenValue(value) ? value.ref : String(value);
    if (str.length > 150) continue;

    // Strip # from plain hex colors — saves 3 encoded chars (%23) per color param.
    // A token ref ({color.brand.jungle}) has no leading # and passes through as-is.
    if (type === 'color' && str.startsWith('#')) str = str.slice(1);

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(str)}`);
  }

  // Export settings come from the live actions-bar controls (the export panel).
  const fmtEl = exportScope?.querySelector<HTMLSelectElement>('[data-action="format"]');
  if (fmtEl?.value) parts.push(`format=${encodeURIComponent(fmtEl.value)}`);
  const fname = inputValue(exportScope, '[data-action="filename"]')?.trim();
  if (fname) parts.push(`filename=${encodeURIComponent(fname)}`);
  const w = parseFloat(inputValue(exportScope, '[data-action="export-width"]') ?? '');
  const h = parseFloat(inputValue(exportScope, '[data-action="export-height"]') ?? '');
  if (w > 0) parts.push(`w=${w}`);
  if (h > 0) parts.push(`h=${h}`);
  const u = inputValue(exportScope, '[data-action="export-unit"]');
  if (u && u !== 'px') {
    parts.push(`unit=${u}`);
    const d = parseInt(inputValue(exportScope, '[data-action="export-dpi"]') ?? '', 10);
    if (d > 0) parts.push(`dpi=${d}`);
  }
  // Colour profile is only meaningful for the CMYK print formats (Print PDF / Print
  // TIFF); carry it only when one is selected and it isn't the default condition.
  const prof = inputValue(exportScope, '[data-action="cmyk-profile"]');
  if (isCmykFmt(fmtEl?.value) && prof && prof !== DEFAULT_CMYK_CONDITION) {
    parts.push(`profile=${encodeURIComponent(prof)}`);
  }
  // PDF open-password — only for the standard PDF, only when set. Clear-text by
  // design so a shared link can carry the lock; never used for confidential files.
  const pdfPass = inputValue(exportScope, '[data-action="pdf-password"]');
  if (fmtEl?.value === 'pdf' && pdfPass) {
    parts.push(`password=${encodeURIComponent(pdfPass)}`);
  }
  // Print marks & bleed — print formats (pdf / pdf-cmyk / cmyk-tiff) only, and only
  // when the card is on.
  if (isPrintFmt(fmtEl?.value) && printEnabled(exportScope)) {
    const bleed = readBleed(exportScope);
    if (bleed) parts.push(`bleed=${encodeURIComponent(bleed)}`);
    const marks = readMarks(exportScope);
    if (marks) parts.push(`marks=${encodeURIComponent(marks)}`);
  }

  return parts;
}
