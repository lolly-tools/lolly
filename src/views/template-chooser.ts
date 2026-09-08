// SPDX-License-Identifier: MPL-2.0
/**
 * "New from template" chooser - a host-owned modal shown ONLY on a blank fresh
 * open of a tool that declares `templates[]` (see views/tool.ts's mount flow).
 *
 * Why this is a host concern, not a tool concern: a tool declares its starting
 * points (manifest `templates[]`); the shell owns the on-ramp UX, exactly like
 * the asset picker. The chooser never appears on a resume (`?slot`), a URL-seeded
 * / parameterised open, an in-process direct seed (the drop/PSD route), or a
 * `?template=<id>` launch - those all carry their own intent.
 *
 * It resolves the input-value seed for the fresh session: a chosen template's
 * `values`, or `{}` for the always-first "Blank canvas" tile (and for Escape /
 * backdrop / close - closing the chooser proceeds to the tool's own default
 * composition, which is what a blank open has always done). It never rejects.
 *
 * THE MOUNT DOES NOT WAIT FOR THIS. views/tool.ts starts the chooser and carries
 * straight on to `createRuntime`, so the tool paints and becomes interactive
 * underneath while the modal sits on top; the pick is applied afterwards as an
 * `applyPatch` seed. That is why nothing here may assume it owns the main thread - 
 * see `whenIdle()` and the preview drain below. It also means the caller can navigate
 * away before a tile is picked, with nothing else holding a reference to this modal - 
 * `ChooserOpts.onOpen` hands back a force-close for exactly that (see views/tool.ts's
 * `_cleanup`, which calls it so a torn-down view never leaves this floating on top of
 * whatever loads next).
 *
 * House UI rules honoured: Escape closes; focus is trapped and lands in the
 * search field; tiles are rounded with a neutral border (no accent-coloured
 * border, no dashed border - dashed is reserved for drop areas). Chrome strings
 * go through t() (they became mid-session UI with plans/142 WP-1); template
 * names/descriptions/categories are authored metadata and stay as written until
 * the template i18n sidecar ships.
 */

import { parseTemplateMotion, type TemplateMotion } from '../lib/template-motion.ts';
import '../styles/template-chooser.css'; // async CSS chunk (lazy view - not on the landing)
import { t, tRaw } from '../i18n.ts';
import { escapeHtml } from '../lib/html.ts';
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { icon } from '../lib/icons.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/**
 * A parsed template entry. Its metadata (id/name/category/description/thumb) is what
 * the synced index carries and the chooser renders the grid from; `values` is the heavy
 * input seed, which now lives in an EXTERNAL per-template file (tools/<id>/templates/
 * <tid>.json) and is FETCHED ON DEMAND (preview render + select). For a metadata-only
 * entry `values` is `{}` - fetchTemplateValues() supplies the real seed lazily.
 */
/** A template's curated variant (plans/142): a values OVERLAY merged over the
 *  template's base `values` (shallow, preset wins). `values` is `{}` for a
 *  metadata-only entry off the synced index - the overlay rides the template's
 *  external file and is read with it. */
export interface TemplatePreset {
  id: string;
  name: string;
  description?: string;
  values: Record<string, InputValue>;
}

export interface TemplateVariant {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumb?: string;
  motion?: TemplateMotion;
  values: Record<string, InputValue>;
  presets?: TemplatePreset[];
}

/** Narrow an unknown `presets` array (template file, index metadata, or inline
 *  manifest) to the shape above - malformed entries drop, first id wins. */
function parsePresets(raw: unknown): TemplatePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplatePreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id || seen.has(p.id)) continue;
    if (typeof p.name !== 'string' || !p.name) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      name: p.name,
      description: typeof p.description === 'string' ? p.description : undefined,
      values: p.values && typeof p.values === 'object' && !Array.isArray(p.values)
        ? (p.values as Record<string, InputValue>)
        : {},
    });
  }
  return out;
}

/**
 * Fetch one template's full input seed from its external file
 * (tools/<toolId>/templates/<tid>.json) through the instance base / profile view - the
 * same static namespace the card-preview paths use. Returns the `values` map, or `null`
 * on any failure (network, missing file, malformed JSON, non-object `values`) so a
 * caller falls through to a blank/default open rather than throwing. The heavy seed is
 * never packed into a URL - this fetch is the on-demand path for both the chooser select
 * and the reserved `?template=<id>` launcher.
 */
export async function fetchTemplateValues(toolId: string, tid: string): Promise<Record<string, InputValue> | null> {
  const f = await fetchTemplateFile(toolId, tid);
  return f?.values ?? null;
}

/**
 * Fetch one template's external file whole: the base `values` plus its `presets`
 * overlays (plans/142). Same failure contract as fetchTemplateValues - null, never
 * a throw. The chooser's select path and the `?template=&preset=` launcher both
 * need the presets, so the file is read once and shared.
 */
export async function fetchTemplateFile(toolId: string, tid: string): Promise<{ values: Record<string, InputValue>; presets: TemplatePreset[]; motion?: TemplateMotion } | null> {
  try {
    const { instanceFetch, instancePath } = await import('../lib/instance.ts');
    const resp = await instanceFetch(instancePath(`/tools/${encodeURIComponent(toolId)}/templates/${encodeURIComponent(tid)}.json`));
    if (!resp.ok) return null;
    const data = await resp.json() as { values?: unknown; presets?: unknown; motion?: unknown };
    const v = data?.values;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return { values: v as Record<string, InputValue>, presets: parsePresets(data?.presets), ...(parseTemplateMotion(data.motion) ? { motion: parseTemplateMotion(data.motion) } : {}) };
  } catch {
    return null;
  }
}

/** The seed for `?template=<tid>[&preset=<pid>]`: the template base merged with the
 *  named preset's overlay (shallow, preset wins). An unknown preset id applies the
 *  base alone - a stale link still opens something sensible. */
/** A blank template keeps declared artboards, with no composed cover content. */
export function blankTemplateSeed(inputs: Array<{ id: string; type?: string; default?: unknown; canvas?: { frameKind?: string; kindField?: string } }>): Record<string, InputValue> {
  const input = inputs.find(i => i.type === 'blocks' && !!i.canvas?.frameKind);
  const rows = Array.isArray(input?.default) ? input.default as Array<Record<string, unknown>> : [];
  const frames = rows.filter(row => row && String(row[input?.canvas?.kindField ?? 'kind']) === input?.canvas?.frameKind);
  return frames.length && input ? { [input.id]: frames as InputValue } : {};
}

const seedPosters = new WeakMap<object, number>();
export const templateEditorPose = (values: object): { playhead?: number } => {
  const ms = seedPosters.get(values);
  return ms === undefined ? {} : { playhead: ms / 1000 };
};
function rememberPoster(values: Record<string, InputValue>, motion?: TemplateMotion) {
  if (motion) {
    const rows = Array.isArray(values.boxes) ? values.boxes as Array<Record<string, unknown>> : [];
    const duration = Math.max(0, ...rows.map(b => (Number(b.start) || 0) + (Number(b.dur) || 0))) * 1000;
    seedPosters.set(values, motion.posterMs * (duration || motion.durationMs) / motion.durationMs);
  }
  return values;
}

export async function fetchTemplateSeed(toolId: string, tid: string, presetId?: string | null): Promise<Record<string, InputValue> | null> {
  const f = await fetchTemplateFile(toolId, tid);
  if (!f) return null;
  const overlay = presetId ? f.presets.find(p => p.id === presetId)?.values : undefined;
  return rememberPoster(overlay && Object.keys(overlay).length ? { ...f.values, ...overlay } : f.values, f.motion);
}

/**
 * Narrow a manifest's `templates` (typed `unknown[]` on the SDK Manifest) into
 * the variants this chooser can render. Entries missing the required `id` /
 * `name` / object `values` are dropped rather than throwing - a malformed
 * template must never break a tool's fresh open.
 */
export function parseTemplates(raw: unknown): TemplateVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateVariant[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id) continue;
    if (typeof t.name !== 'string' || !t.name) continue;
    if (seen.has(t.id)) continue; // first wins on a duplicate id
    const values = t.values && typeof t.values === 'object' && !Array.isArray(t.values)
      ? (t.values as Record<string, InputValue>)
      : {};
    seen.add(t.id);
    const presets = parsePresets(t.presets);
    out.push({
      id: t.id,
      name: t.name,
      description: typeof t.description === 'string' ? t.description : undefined,
      category: typeof t.category === 'string' && t.category ? t.category : undefined,
      thumb: typeof t.thumb === 'string' && t.thumb ? t.thumb : undefined,
      values,
      ...(presets.length ? { presets } : {}),
      ...(parseTemplateMotion(t.motion) ? { motion: parseTemplateMotion(t.motion) } : {}),
    });
  }
  return out;
}

/** Look up one template's seed by id (the inline-manifest fallback for the reserved
 *  `?template=<id>` path). With `presetId`, the named preset's overlay is merged over
 *  the base (shallow, preset wins); an unknown preset id applies the base alone. */
export function templateValuesById(raw: unknown, id: string, presetId?: string | null): Record<string, InputValue> | null {
  const found = parseTemplates(raw).find(v => v.id === id);
  if (!found) return null;
  const overlay = presetId ? found.presets?.find(p => p.id === presetId)?.values : undefined;
  return overlay && Object.keys(overlay).length ? { ...found.values, ...overlay } : found.values;
}

// A neutral glyph per template, chosen from the category keyword so a poster reads
// as an image and a carousel as a grid - falls back to a generic layers glyph.
function glyphFor(t: TemplateVariant): Parameters<typeof icon>[0] {
  const hay = `${t.category ?? ''} ${t.name}`.toLowerCase();
  if (/carousel|slides?|deck|grid|gallery/.test(hay)) return 'grid';
  if (/poster|flyer|cover|image|photo|banner/.test(hay)) return 'image';
  if (/story|social|post/.test(hay)) return 'photos';
  if (/card|badge|label/.test(hay)) return 'shapes';
  return 'layers';
}

const BLANK_ID = '__blank__';

// ── Brand token scope (plan 179 C12) ────────────────────────────────────────────
//
// brand-vars.ts writes the brand's semantic colour slots (--brand-primary, --brand-
// on-primary, …) INLINE onto the tool-canvas root, and only the primary onto <html>.
// This modal is a body-level overlay OUTSIDE that element, so anything it paints from
// `var(--brand-primary, <fallback>)` resolves to the template's stand-in colour while
// the canvas underneath resolves to the brand's - the tile and the document it seeds
// disagree, which is exactly what C12 reports.
//
// Two consequences, both handled below: the modal copies the slots onto its own root so
// its subtree sits in the same scope as the canvas, and a rendered preview is cached
// under a namespace that names the brand it was rendered in. Without the second half the
// first brand to render a template would own its thumbnail permanently - the memoised
// `sig` is the values JSON, which is byte-identical under every brand.

/** Every `--brand-*` custom property in force on the live tool canvas, nearest ancestor
 *  first (the cascade's own answer for that element). Empty when no tool canvas is
 *  mounted or the active brand declares no semantic slots, which is the unbranded
 *  default and needs no scope of its own. */
function brandScopeVars(): Array<[string, string]> {
  if (typeof document === 'undefined') return [];
  const start = document.querySelector<HTMLElement>('#tool-content')
    ?? document.querySelector<HTMLElement>('#tool-canvas')
    ?? document.documentElement;
  const seen = new Map<string, string>();
  for (let node: HTMLElement | null = start; node; node = node.parentElement) {
    const decl = node.style;
    for (let i = 0; i < decl.length; i++) {
      const name = decl.item(i);
      if (name.startsWith('--brand-') && !seen.has(name)) {
        seen.set(name, decl.getPropertyValue(name).trim());
      }
    }
  }
  return [...seen].filter(([, v]) => v !== '');
}

/** FNV-1a, base36 - a short stable tag for a set of colour values. Not a checksum of
 *  anything anyone verifies; it only has to change when the brand does. */
function brandTag(vars: ReadonlyArray<readonly [string, string]>): string {
  let h = 2166136261;
  const s = vars.map(([n, v]) => `${n}:${v}`).join(';');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/**
 * Resolve at the next idle moment (or after `timeout` ms, whichever comes first).
 *
 * The chooser is no longer awaited by views/tool.ts - the tool mounts UNDERNEATH it - 
 * so its tile previews now share the main thread with a live mount (the editor overlay
 * chunk alone is ~500 KB) instead of having it to themselves. Each preview is a real
 * off-screen tool mount + walker export, ~1 s of mostly-synchronous work, so firing
 * them back-to-back would starve exactly the paint the deferral was meant to let
 * through, and would hold a tile click up behind however many renders were still
 * queued. Yielding once before the render chunk is fetched and once between renders
 * costs the previews nothing they can perceive and gives the mount (and the click) the
 * gaps they need. `requestIdleCallback` is absent in jsdom and older Safari - a
 * macrotask is the honest fallback there: still a yield, just not a prioritised one.
 */
function whenIdle(timeout = 1000): Promise<void> {
  return new Promise(resolve => {
    const ric = (globalThis as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') ric(() => resolve(), { timeout });
    else setTimeout(resolve, 0);
  });
}

interface ChooserOpts {
  toolName: string;
  /** Header override - the fresh-open default is "Start <toolName>"; the mid-session
   *  re-entry (plans/142 WP-1) passes its own, e.g. "New from template". */
  title?: string;
  /** The tool id - needed to fetch each template's external values file. */
  toolId: string;
  templates: TemplateVariant[];
  /**
   * Host bridge - enables the live VISUAL PREVIEW (each tile fetches its values file and
   * live-renders via renderFeaturedVariant). Omit (e.g. offline / no render path) and the
   * chooser shows glyph tiles; select still fetches values.
   */
  host?: HostV1;
  /** The tool's render.formats - the preview renders vector-first at displayFormatOf. */
  formats?: readonly string[];
  /**
   * Called synchronously, once the modal exists, with a function that force-closes it - 
   * exactly as if Escape/backdrop/× had been used - and resolves the returned promise
   * with `{}`. views/tool.ts never awaits this chooser (see the header), so nothing else
   * holds a reference to it; a caller that tears its view down while the modal is still
   * open needs this to take the modal with it, or it is left floating over whatever view
   * loads next with a click handler still wired to the torn-down mount. Fires at most
   * once per open; calling the returned function after the chooser has already settled
   * (a pick, Escape, or an earlier call) is a no-op, same as any other post-settle path.
   */
  onOpen?: (close: () => void) => void;
  /** Reports the chosen starting point before its values are applied. The Design
   * shell uses this lightweight metadata to select outcome-aware chrome/export
   * defaults; the template seed itself remains ordinary input data. */
  onPick?: (pick: { templateId: string | null; category?: string }) => void;
  /**
   * The seed for the "Blank canvas" tile. Defaults to `{}`, which opens the tool's
   * DEFAULT document; a tool whose default is a composed cover (Design, plan 179) hands
   * in a real blank here - the bare artboard with nothing on it - so "start from
   * scratch" means what it says.
   */
  blankSeed?: () => Record<string, InputValue>;
}

/**
 * Open the chooser. Resolves with the seed for the fresh session: a template's
 * `values`, or `{}` for a blank start (also the result of Escape / close /
 * backdrop). Never rejects.
 */
export function openTemplateChooser(opts: ChooserOpts): Promise<Record<string, InputValue>> {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'tmpl-chooser-modal';
    let motionCleanup: (() => void) | undefined;
    document.body.appendChild(root);
    let disposeOpenObservers = (): void => {};
    // The documented contract is "never rejects (close = {})" - make it structurally
    // true: any throw below (markup build, icon lookup, preview wiring) would REJECT
    // this promise and strand the caller's await, leaving the tool stuck on its
    // loading screen with an invisible empty modal (the :empty CSS hides the root).
    // Trade the whole chooser for a blank open instead.
    const settleBlank = (e: unknown): void => {
      disposeOpenObservers();
      motionCleanup?.();
      try { root.remove(); } catch { /* already gone */ }
      console.warn('template chooser failed - resolving blank', e);
      resolve({});
    };
    try {

    // Brand token scope (C12). Mirrors the canvas's --brand-* slots onto this modal, so
    // the chooser's own subtree resolves them the way the document it seeds will, and
    // names the brand in the preview cache namespace so a tile can never be served a
    // picture rendered under a different one. Re-run before each preview render, because
    // the slots arrive asynchronously while the tool mounts underneath.
    let previewNs = 'template';
    let brandTagApplied = '';
    let appliedBrandVars = new Set<string>();
    const syncBrandScope = (): boolean => {
      const vars = brandScopeVars();
      const tag = vars.length ? brandTag(vars) : '';
      if (tag === brandTagApplied) return false;
      brandTagApplied = tag;
      const nextNames = new Set(vars.map(([name]) => name));
      for (const name of appliedBrandVars) {
        if (!nextNames.has(name)) root.style.removeProperty(name);
      }
      for (const [name, value] of vars) root.style.setProperty(name, value);
      appliedBrandVars = nextNames;
      // No brand slots in force is the unbranded default: keep the bare namespace so an
      // install that never had a brand keeps the previews it has already cached.
      previewNs = tag ? `template@${tag}` : 'template';
      return true;
    };
    syncBrandScope();

    const byId = new Map<string, TemplateVariant>(opts.templates.map(v => [v.id, v]));

    // Memoised whole-file per template: the base `values` seed PLUS its preset
    // overlays (plans/142). An inline entry that already carries a non-empty
    // `values` (the inline-fallback shape, incl. user templates) is used verbatim;
    // otherwise the external file is fetched once, and the preview render, a tile
    // select and a preset chip all share that single fetch. Resolves null on
    // failure → the caller falls back to a blank/default open.
    type TplFile = { values: Record<string, InputValue>; presets: TemplatePreset[] };
    const fileById = new Map<string, Promise<TplFile | null>>();
    const getFile = (id: string): Promise<TplFile | null> => {
      const cached = fileById.get(id);
      if (cached) return cached;
      const entry = byId.get(id);
      const inline = entry?.values;
      const p = inline && Object.keys(inline).length
        ? Promise.resolve({ values: inline, presets: entry?.presets ?? [] })
        : fetchTemplateFile(opts.toolId, id);
      fileById.set(id, p);
      return p;
    };
    const getValues = (id: string): Promise<Record<string, InputValue> | null> =>
      getFile(id).then(f => f?.values ?? null);

    // Distinct categories (tags), first-seen order - these become the filter chips. Every
    // template lives in ONE grid; a chip narrows it, so there are no per-category sections.
    const cats: string[] = [];
    for (const v of opts.templates) { const c = v.category; if (c && !cats.includes(c)) cats.push(c); }

    const tileHtml = (v: TemplateVariant): string => {
      // The media slot starts as the authored thumb (if any) or a category glyph; when a
      // host + formats are supplied, renderPreviews() swaps in a live-rendered <img>.
      const media = v.thumb
        ? `<img class="tmpl-chooser-tile-thumb" src="${escapeHtml(v.thumb)}" alt="" loading="lazy">`
        : `<span class="tmpl-chooser-tile-icon" aria-hidden="true">${icon(glyphFor(v), { size: 22 })}</span>`;
      const search = `${v.name} ${v.description ?? ''} ${v.category ?? ''} ${(v.presets ?? []).map(p => p.name).join(' ')}`.toLowerCase();
      // Preset chips (plans/142 WP-3): the tile itself picks the template BASE; a chip
      // picks base + that preset's overlay. Chips are buttons INSIDE the tile button -
      // invalid nesting is avoided by making the tile a div with role=button below.
      const chips = v.presets?.length
        ? `<span class="tmpl-chooser-presets" role="group" aria-label="${escapeHtml(t('Variants'))}">${v.presets.map(p =>
            `<button type="button" class="tmpl-chooser-preset" data-preset-id="${escapeHtml(p.id)}"${p.description ? ` title="${escapeHtml(p.description)}"` : ''}>${escapeHtml(p.name)}</button>`).join('')}</span>`
        : '';
      // A tile WITH chips renders as a div[role=button] (a <button> cannot contain
      // buttons); a chipless tile stays a real <button> for free keyboard semantics.
      const tag = chips || v.motion ? 'div' : 'button';
      const btnAttrs = chips || v.motion ? ' role="button" tabindex="0"' : ' type="button"';
      return `<${tag} class="tmpl-chooser-tile" data-template-id="${escapeHtml(v.id)}"${v.motion ? ' data-motion-template="true"' : ''} data-category="${escapeHtml(v.category ?? '')}" data-search="${escapeHtml(search)}"${btnAttrs}>
        <span class="tmpl-chooser-tile-media">${media}</span>
        <span class="tmpl-chooser-tile-name">${escapeHtml(v.name)}</span>
        ${v.description ? `<span class="tmpl-chooser-tile-desc">${escapeHtml(v.description)}</span>` : ''}
        ${v.motion ? `<span class="tmpl-motion-beats">${escapeHtml(v.motion.beats.join(' → '))}</span><span class="tmpl-motion-actions"><button type="button" class="btn btn--sm" data-motion-play aria-pressed="false"${opts.host && opts.toolId === 'design' ? '' : ' disabled'}>${escapeHtml(t('Preview animation'))}</button><button type="button" class="btn btn--primary btn--sm">${escapeHtml(t('Use this'))} ↗</button></span>` : ''}
        ${chips}
      </${tag}>`;
    };

    // The always-first "Blank canvas" tile sits in its own leading group.
    const blankTile = `<button type="button" class="tmpl-chooser-tile" data-template-id="${BLANK_ID}" data-search="blank canvas empty scratch">
      <span class="tmpl-chooser-tile-icon" aria-hidden="true">${icon('filePlus', { size: 22 })}</span>
      <span class="tmpl-chooser-tile-name">${escapeHtml(t('Blank canvas'))}</span>
      <span class="tmpl-chooser-tile-desc">${escapeHtml(t('Start from scratch.'))}</span>
    </button>`;

    // Tag filters - "All" plus one chip per category. Only shown when there's more than one
    // category to choose between; a single-category set has nothing to filter.
    const filtersHtml = cats.length > 1 ? `
      <div class="tmpl-chooser-filters" role="group" aria-label="${escapeHtml(t('Filter templates by type'))}">
        <button type="button" class="tmpl-chooser-filter is-active" data-filter="" aria-pressed="true">${escapeHtml(t('All'))}</button>
        ${cats.map(c => `<button type="button" class="tmpl-chooser-filter" data-filter="${escapeHtml(c)}" aria-pressed="false">${escapeHtml(c)}</button>`).join('')}
      </div>` : '';

    root.innerHTML = `
      <div class="tmpl-chooser-backdrop" aria-hidden="true"></div>
      <div class="tmpl-chooser-panel" role="dialog" aria-modal="true" aria-labelledby="tmpl-chooser-title">
        <header class="tmpl-chooser-header">
          <h2 id="tmpl-chooser-title">${escapeHtml(opts.title ?? tRaw('Start {tool}', { tool: opts.toolName }))}</h2>
          <input type="search" class="tmpl-chooser-search" placeholder="${escapeHtml(t('Search templates…'))}" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(t('Search templates'))}">
          <button type="button" class="tmpl-chooser-close" aria-label="${escapeHtml(t('Close'))}">×</button>
        </header>
        <div class="tmpl-chooser-body">
          ${filtersHtml}
          <div class="tmpl-chooser-grid">${blankTile}${opts.templates.map(tileHtml).join('')}</div>
          <p class="tmpl-chooser-empty" hidden>${tRaw('No templates match “{term}”.', { term: '<span data-empty-term></span>' })}</p>
        </div>
      </div>
    `;

    const panel = root.querySelector<HTMLElement>('.tmpl-chooser-panel')!;
    const searchInput = root.querySelector<HTMLInputElement>('.tmpl-chooser-search')!;
    const emptyEl = root.querySelector<HTMLElement>('.tmpl-chooser-empty')!;
    const emptyTermEl = root.querySelector<HTMLElement>('[data-empty-term]')!;

    const opener = document.activeElement;
    let trap: FocusTrap | undefined;
    let settled = false;

    const finish = (values: Record<string, InputValue>): void => {
      if (settled) return;
      settled = true;
      disposeOpenObservers();
      motionCleanup?.();
      trap?.release();
      root.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(values);
    };

    // On touch, seeding focus into the search input pops the soft keyboard over the
    // template grid before any intent to type (mirrors search-bar.ts's gate); the
    // close button keeps the trap anchored without summoning a keyboard.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    trap = trapFocus(root, {
      initialFocus: coarse ? root.querySelector<HTMLElement>('.tmpl-chooser-close') ?? searchInput : searchInput,
    });
    // Hand the caller a close handle now - the modal is fully built (root is in the
    // document, `finish` closes over it) - so a navigate-away arriving any time from
    // here on has something to call. `finish` is itself idempotent (the `settled`
    // guard above), so this can never double-resolve against a real pick.
    opts.onOpen?.(() => finish({}));

    root.querySelector('.tmpl-chooser-close')?.addEventListener('click', () => finish({}));
    root.querySelector('.tmpl-chooser-backdrop')?.addEventListener('click', () => finish({}));

    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); finish({}); }
    });

    const pickTile = (tile: HTMLElement, presetId?: string): void => {
      const id = tile.dataset.templateId!;
      if (id === BLANK_ID) {
        opts.onPick?.({ templateId: null });
        finish(opts.blankSeed ? opts.blankSeed() : {});
        return;
      }
      // Reflect the fetch in the tile so a slow network doesn't read as a dead click.
      tile.setAttribute('aria-busy', 'true');
      // Fetch (or reuse) the template's external file, THEN resolve: the base seed,
      // or base + the picked preset's overlay (shallow, preset wins). A null file
      // (unknown id / network failure) falls back to a blank open, exactly like Escape.
      void getFile(id).then(f => {
        if (!f) { finish({}); return; }
        const overlay = presetId ? f.presets.find(p => p.id === presetId)?.values : undefined;
        opts.onPick?.({ templateId: id, category: byId.get(id)?.motion ? 'Video' : byId.get(id)?.category });
        finish(rememberPoster(overlay && Object.keys(overlay).length ? { ...f.values, ...overlay } : f.values, byId.get(id)?.motion));
      });
    };
    root.querySelector('.tmpl-chooser-body')?.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('[data-motion-play]')) return;
      const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-template-id]');
      if (!tile) return;
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-preset-id]');
      pickTile(tile, chip?.dataset.presetId);
    });
    // div[role=button] tiles (the ones carrying preset chips) need their keyboard
    // activation wired by hand; real <button> tiles fire click natively.
    root.querySelector('.tmpl-chooser-body')?.addEventListener('keydown', ev => {
      const e = ev as KeyboardEvent;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target as HTMLElement;
      if (el.matches('[data-preset-id]')) return;               // a chip is a real button
      if (!el.matches('.tmpl-chooser-tile[role="button"]')) return;
      e.preventDefault();
      pickTile(el);
    });

    if (opts.host && opts.templates.some(v => v.motion)) {
      void import('../lib/template-motion-preview.ts').then(({ armTemplateMotion }) => {
        if (settled) return;
        motionCleanup = armTemplateMotion(root, {
          host: opts.host!, toolId: opts.toolId, card: '[data-motion-template]', media: '.tmpl-chooser-tile-media',
          id: card => card.dataset.templateId,
          async load(id) { const values = await getValues(id); const motion = byId.get(id)?.motion; return values && motion ? { values, motion } : null; },
        });
      });
    }

    // Live filter: the search term AND the active tag chip, over the one grid. Blank always
    // shows; an empty-state note appears only when a real query leaves nothing but Blank.
    let activeFilter = '';
    const applyFilter = (): void => {
      const term = searchInput.value.trim().toLowerCase();
      let anyTemplateVisible = false;
      for (const tile of root.querySelectorAll<HTMLElement>('.tmpl-chooser-tile')) {
        if (tile.dataset.templateId === BLANK_ID) { tile.hidden = false; continue; } // Blank is never filtered
        const matchTerm = !term || (tile.dataset.search ?? '').includes(term);
        const matchTag = !activeFilter || tile.dataset.category === activeFilter;
        const show = matchTerm && matchTag;
        tile.hidden = !show;
        if (show) anyTemplateVisible = true;
      }
      emptyEl.hidden = anyTemplateVisible || (!term && !activeFilter);
      emptyTermEl.textContent = term || activeFilter;
    };
    searchInput.addEventListener('input', applyFilter);
    for (const chip of root.querySelectorAll<HTMLButtonElement>('.tmpl-chooser-filter')) {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter ?? '';
        for (const c of root.querySelectorAll<HTMLElement>('.tmpl-chooser-filter')) {
          const on = c === chip;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        applyFilter();
      });
    }

    // ── Live visual previews (fire-and-forget) ──────────────────────────────────
    // Each template tile fetches its external values seed and live-renders a vector-first
    // thumbnail via the SAME off-screen engine path an export takes (renderFeaturedVariant,
    // memoised under `template:<toolId>:<tid>:<fmt>` - a namespace that never collides with
    // the featured/example `featured:` records). Rendered SERIALLY, and each render waits
    // for an idle gap first (whenIdle), so opening the chooser never stampedes the engine
    // and never starves the tool mount running underneath it. A still poster-frame is fine
    // for an animated template (v1). With no host / formats - or an authored `thumb` - the
    // glyph/thumb placeholder stays. Results are memoised in host.previews, so this whole
    // block is a FIRST-open cost: a second open resolves every tile from cache.
    if (opts.host && opts.formats && opts.formats.length && typeof IntersectionObserver !== 'undefined') {
      const host = opts.host;
      const formats = opts.formats;
      const queue: string[] = [];
      const queued = new Set<string>();
      let draining = false;
      // A brand can finish hydrating after early tiles have already rendered. Reset
      // the queue under the new namespace so every visible preview agrees with the
      // canvas; stale in-flight results are discarded by their captured tag.
      const requeueAll = (): void => {
        queue.length = 0;
        queued.clear();
        for (const template of opts.templates) {
          if (template.id !== BLANK_ID) enqueue(template.id);
        }
      };
      const refreshBrand = (): void => {
        if (syncBrandScope()) requeueAll();
      };
      const drain = async (): Promise<void> => {
        if (draining) return;
        draining = true;
        try {
          // Yield before the render-engine chunk is even requested: the tool is mounting
          // underneath this modal right now and its own lazy chunks are in flight.
          await whenIdle();
          const { renderFeaturedVariant } = await import('../lib/featured-render.ts');
          while (queue.length && !settled) {
            const id = queue.shift()!;
            const values = await getValues(id).catch(() => null);
            if (!values || settled) continue;
            // Re-read the brand scope per render, not once on open: the tool is mounting
            // underneath and applyBrandVars writes its slots asynchronously, so the first
            // tile can easily be queued before the canvas has them. Cheap - a walk up one
            // inline style chain (C12; see brandScopeVars above).
            syncBrandScope();
            const renderedBrandTag = brandTagApplied;
            try {
              const src = await renderFeaturedVariant(
                host as Parameters<typeof renderFeaturedVariant>[0],
                opts.toolId, formats, id, values as Record<string, unknown>, previewNs, byId.get(id)?.motion?.posterMs,
              );
              refreshBrand();
              if (settled || !src || renderedBrandTag !== brandTagApplied) continue;
              const media = root.querySelector<HTMLElement>(
                `.tmpl-chooser-tile[data-template-id="${CSS.escape(id)}"] .tmpl-chooser-tile-media`,
              );
              if (media) {
                const img = document.createElement('img');
                img.className = 'tmpl-chooser-tile-thumb';
                img.alt = '';
                img.src = src;
                media.querySelectorAll('.tmpl-chooser-tile-thumb, .tmpl-chooser-tile-icon').forEach(el => { el.remove(); });
                media.prepend(img);
              }
            } catch { /* leave the glyph placeholder for this tile */ }
            // …and between renders, so a tile click (or the mount) can land in the gap
            // rather than queueing behind every remaining preview.
            if (queue.length && !settled) await whenIdle();
          }
        } finally {
          draining = false;
        }
      };
      const enqueue = (id: string): void => {
        if (queued.has(id) || byId.get(id)?.thumb) return; // authored thumb already shows art
        queued.add(id);
        queue.push(id);
        void drain();
      };

      // Eager: enqueue every renderable template on open so previews render even if the
      // IntersectionObserver never delivers an intersecting entry (a false-negative on the
      // first async callback - panel mid-layout, backgrounded/occluded tab, or a stale
      // bundle - was permanent, since each tile is unobserved on first intersect and the IO
      // callback was the ONLY producer for the queue). There are only a handful of templates,
      // and the serial drain renders one at a time, so this cannot stampede the engine.
      // enqueue() dedups via `queued` and skips authored-thumb tiles, so it can't double-render.
      for (const v of opts.templates) {
        if (v.id !== BLANK_ID) enqueue(v.id);
      }

      // IntersectionObserver stays as an off-screen prioritisation nicety - with the eager
      // loop above it is no longer required (its enqueue() calls dedup to no-ops against
      // `queued`). Root to the real scroll container (the body panel; see template-chooser.css
      // `.tmpl-chooser-body { overflow-y: auto }`), falling back to the viewport - the modal is
      // a fixed overlay filling it - so a missing body never means a dead observer.
      const bodyEl = root.querySelector('.tmpl-chooser-body');
      const io = new IntersectionObserver((entries, obs) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          obs.unobserve(en.target);
          const id = (en.target as HTMLElement).dataset.templateId;
          if (id && id !== BLANK_ID) enqueue(id);
        }
      }, { root: bodyEl, rootMargin: '200px' });
      for (const tile of root.querySelectorAll<HTMLElement>('.tmpl-chooser-tile')) {
        if (tile.dataset.templateId !== BLANK_ID) io.observe(tile);
      }

      // Observe the exact inline-style chain brandScopeVars reads. applyBrandVars
      // settles asynchronously while the chooser is already open; this closes the
      // race where the first cached previews were painted with neutral fallbacks and
      // then remained there for the rest of the modal's lifetime.
      const brandRoot = document.querySelector<HTMLElement>('#tool-content')
        ?? document.querySelector<HTMLElement>('#tool-canvas');
      const brandObserver = typeof MutationObserver !== 'undefined'
        ? new MutationObserver(refreshBrand)
        : null;
      for (let node: HTMLElement | null = brandRoot; node; node = node.parentElement) {
        brandObserver?.observe(node, { attributes: true, attributeFilter: ['style'] });
      }
      disposeOpenObservers = (): void => {
        io.disconnect();
        brandObserver?.disconnect();
      };
    }
    } catch (e) { settleBlank(e); }
  });
}
