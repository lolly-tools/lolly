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
 * It is ALSO the per-tool template manager (plans/226 WP-3). When the host can read
 * the profile, each tile carries a menu (right-click, press-and-hold, and a "…"
 * button for pointer users) that uses, sets "Start with", renames/describes/updates/
 * exports/deletes the person's own templates, and copies or hides a shipped one. The
 * hidden shipped tiles leave the grid and sit behind a "Hidden (N)" chip with a
 * Restore action, and the person's own group is listed first. Every mutation goes
 * through lib/template-actions.ts + the lib/user-templates.ts store, so the Projects
 * Templates collection and this chooser behave identically.
 *
 * House UI rules honoured: Escape closes (an open tile menu takes the first Escape
 * and stops there); focus is trapped and lands in the search field; tiles are rounded
 * with a neutral border (no accent-coloured border, no dashed border - dashed is
 * reserved for drop areas), so ownership and "Starts here" are glyphs with a tinted
 * fill rather than a coloured edge. Chrome strings go through t() (they became
 * mid-session UI with plans/142 WP-1); template names/descriptions/categories are
 * authored metadata and stay as written until the template i18n sidecar ships.
 */

import '../styles/template-chooser.css'; // async CSS chunk (lazy view - not on the landing)
import { t, tRaw } from '../i18n.ts';
import { escapeHtml } from '../lib/html.ts';
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { icon } from '../lib/icons.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { loadHiddenTemplates } from '../lib/hidden-templates.ts';
import {
  copyShippedTemplate,
  deleteUserTemplate,
  downloadTemplateFile,
  hideShippedTemplate,
  restoreShippedTemplate,
  setStartWith,
  templateDesignSystemStamp,
  type TemplateActionHost,
} from '../lib/template-actions.ts';
import { parseTemplateRef, userVariants } from '../lib/template-ref.ts';
import { loadTemplateStart, START_BLANK, type TemplateStart } from '../lib/template-start.ts';
import { createUserTemplateStore } from '../lib/user-templates.ts';

import {
  fetchTemplateFile,
  rememberPoster,
  type TemplatePreset,
  type TemplateVariant,
} from '../lib/template-source.ts';
// The data layer moved to lib/template-source.ts (plans/226 WP-0); every importer that
// reached these through the chooser keeps working via this re-export.
export {
  blankTemplateSeed,
  fetchTemplateFile,
  fetchTemplateSeed,
  fetchTemplateValues,
  parseTemplates,
  templateEditorPose,
  templateValuesById,
  type TemplatePreset,
  type TemplateVariant,
} from '../lib/template-source.ts';

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

/** The pseudo-category the "Hidden (N)" chip selects. Not a real `category` value, so it
 *  can never collide with an authored one (those are display strings, never `__`-fenced). */
const HIDDEN_FILTER = '__hidden__';

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
  /**
   * Management (plans/226 WP-3). `hiddenDefaults` is the brand's
   * defaultHiddenTemplateRefs(); the chooser reads the person's hidden set and
   * "Start with" through `host` (profile get/set), shows shipped tiles that are
   * hidden behind a "Hidden (N)" chip, and offers the tile menu (use, start with,
   * rename / describe / delete for own, make a copy / hide for shipped, export as
   * file). Entries need `ref` + `own` (lib/template-ref.ts shippedVariants /
   * userVariants) for the menu to appear.
   */
  hiddenDefaults?: readonly string[];
  /** Mid-session only: the live document's template values, for "Update from this
   *  document" on one of the person's own templates. */
  currentValues?: () => Record<string, unknown>;
  /** Fired after any management change (hide, restore, rename, delete, start-with) so
   *  the caller can refresh what it derived from the list. */
  onChanged?: () => void;
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
    // The tile context menu is body-mounted and outlives a re-render of the grid, so it
    // is torn down on every exit path (a pick, Escape, the caller's force-close, a throw).
    let ctxMenu: import('../lib/context-menu.ts').TileContextMenuHandle | null = null;
    // The documented contract is "never rejects (close = {})" - make it structurally
    // true: any throw below (markup build, icon lookup, preview wiring) would REJECT
    // this promise and strand the caller's await, leaving the tool stuck on its
    // loading screen with an invisible empty modal (the :empty CSS hides the root).
    // Trade the whole chooser for a blank open instead.
    const settleBlank = (e: unknown): void => {
      disposeOpenObservers();
      motionCleanup?.();
      ctxMenu?.destroy();
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

    // ── Management state (plans/226 WP-3) ──────────────────────────────────────
    // The manager half needs the profile: which shipped templates this person hid, and
    // what a blank open of this tool starts from. A host without a profile bridge (an
    // offline shell, a preview-only test host) gets the plain picker instead - no tile
    // menu, no Hidden chip, no "Starts with" line - so the chooser never depends on it.
    const profileHost = opts.host && typeof (opts.host as { profile?: { get?: unknown } }).profile?.get === 'function'
      ? (opts.host as TemplateActionHost)
      : null;
    const store = profileHost ? createUserTemplateStore(profileHost) : null;
    /** The group name the caller listed the person's own templates under, so a refresh
     *  from the store re-files them under the same chip. */
    const ownCategory = opts.templates.find(v => v.own)?.category ?? t('Yours');
    /** Own first, shipped after: the person's own starting points lead the grid. */
    const ownFirst = (list: readonly TemplateVariant[]): TemplateVariant[] =>
      [...list.filter(v => v.own), ...list.filter(v => !v.own)];

    let hiddenRefs = new Set<string>();
    let startRef: TemplateStart | null = null;
    let entries = ownFirst(opts.templates);
    let activeFilter = '';
    /** Set by the preview block below (when there is one) so a re-render can re-observe
     *  its tiles and re-queue their thumbnails. */
    let repaintPreviews: (() => void) | null = null;

    let byId = new Map<string, TemplateVariant>();
    let byRef = new Map<string, TemplateVariant>();
    const reindex = (): void => {
      byId = new Map(entries.map(v => [v.id, v]));
      byRef = new Map(entries.filter(v => v.ref).map(v => [v.ref!, v]));
    };
    reindex();

    /** A shipped tile this person has hidden. Own templates are deleted, never hidden. */
    const isHidden = (v: TemplateVariant): boolean => !!v.ref && !v.own && hiddenRefs.has(v.ref);
    /** The ref the tile menu acts on, or '' for a tile that has none (no menu is wired). */
    const menuRefOf = (v: TemplateVariant): string => (profileHost && v.ref ? v.ref : '');

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

    // The corner marks and the "…" button a tile carries. They live inside the tile box
    // (which is position:relative) rather than in the media slot, so the preview drain's
    // thumb-for-glyph swap cannot take them with it.
    const tileChromeHtml = (v: TemplateVariant | null, ref: string): string => {
      const startMark = ref && startRef === ref
        ? `<span class="tmpl-chooser-tile-mark" role="img" title="${escapeHtml(t('Starts here'))}" aria-label="${escapeHtml(t('Starts here'))}">${icon('pin', { size: 14 })}</span>`
        : '';
      const menuRef = v ? menuRefOf(v) : (profileHost ? ref : '');
      const kebab = menuRef
        ? `<button type="button" class="tmpl-chooser-tile-menu" data-tile-menu aria-haspopup="menu" aria-expanded="false" aria-label="${escapeHtml(t('Template options'))}" title="${escapeHtml(t('Template options'))}">${icon('menuDots', { size: 16 })}</button>`
        : '';
      return startMark + kebab;
    };

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
      const menuRef = menuRefOf(v);
      // Ownership reads as a glyph beside the name, never as a coloured edge (house rule).
      const ownMark = v.own
        ? `<span class="tmpl-chooser-tile-own" role="img" title="${escapeHtml(t('Yours'))}" aria-label="${escapeHtml(t('Yours'))}">${icon('user', { size: 12 })}</span>`
        : '';
      // A hidden tile is only ever shown under the Hidden chip, and carries its way back.
      const restore = isHidden(v)
        ? `<span class="tmpl-chooser-tile-actions"><button type="button" class="btn btn--sm" data-restore>${escapeHtml(t('Restore'))}</button></span>`
        : '';
      // A tile WITH chips, motion, a menu button or a Restore button renders as a
      // div[role=button] (a <button> cannot contain buttons); a plain one stays a real
      // <button> for free keyboard semantics.
      const rich = !!chips || !!v.motion || !!menuRef || !!restore;
      const tag = rich ? 'div' : 'button';
      const btnAttrs = rich ? ' role="button" tabindex="0"' : ' type="button"';
      return `<${tag} class="tmpl-chooser-tile" data-template-id="${escapeHtml(v.id)}"${menuRef ? ` data-menu-ref="${escapeHtml(menuRef)}"` : ''}${v.own ? ' data-own-template="true"' : ''}${v.motion ? ' data-motion-template="true"' : ''} data-category="${escapeHtml(v.category ?? '')}" data-search="${escapeHtml(search)}"${btnAttrs}>
        ${tileChromeHtml(v, v.ref ?? '')}
        <span class="tmpl-chooser-tile-media">${media}</span>
        <span class="tmpl-chooser-tile-name">${ownMark}${escapeHtml(v.name)}</span>
        ${v.description ? `<span class="tmpl-chooser-tile-desc">${escapeHtml(v.description)}</span>` : ''}
        ${v.motion ? `<span class="tmpl-motion-beats">${escapeHtml(v.motion.beats.join(' → '))}</span><span class="tmpl-motion-actions"><button type="button" class="btn btn--sm" data-motion-play aria-pressed="false"${opts.host && opts.toolId === 'design' ? '' : ' disabled'}>${escapeHtml(t('Preview animation'))}</button><button type="button" class="btn btn--primary btn--sm">${escapeHtml(t('Use this'))} ↗</button></span>` : ''}
        ${chips}${restore}
      </${tag}>`;
    };

    // The always-first "Blank canvas" tile sits in its own leading group. Its menu ref is
    // the START_BLANK sentinel, which parseTemplateRef never reads as a template.
    const blankTileHtml = (): string => {
      const menuRef = profileHost ? START_BLANK : '';
      const tag = menuRef ? 'div' : 'button';
      const btnAttrs = menuRef ? ' role="button" tabindex="0"' : ' type="button"';
      return `<${tag} class="tmpl-chooser-tile" data-template-id="${BLANK_ID}"${menuRef ? ` data-menu-ref="${escapeHtml(menuRef)}"` : ''} data-search="blank canvas empty scratch"${btnAttrs}>
        ${tileChromeHtml(null, menuRef)}
        <span class="tmpl-chooser-tile-icon" aria-hidden="true">${icon('filePlus', { size: 22 })}</span>
        <span class="tmpl-chooser-tile-name">${escapeHtml(t('Blank canvas'))}</span>
        <span class="tmpl-chooser-tile-desc">${escapeHtml(t('Start from scratch.'))}</span>
      </${tag}>`;
    };

    // Tag filters - "All", one chip per category (own first, since `entries` is own-first),
    // then "Hidden (N)" at the end when this person has hidden anything. Shown when there is
    // more than one category to choose between OR there is a hidden set to reach; a single
    // visible category with nothing hidden has nothing to filter.
    const chipHtml = (filter: string, label: string): string => {
      const on = activeFilter === filter;
      return `<button type="button" class="tmpl-chooser-filter${on ? ' is-active' : ''}" data-filter="${escapeHtml(filter)}" aria-pressed="${on ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
    };
    const filtersHtml = (): string => {
      const cats: string[] = [];
      for (const v of entries) { const c = v.category; if (c && !isHidden(v) && !cats.includes(c)) cats.push(c); }
      const hiddenCount = entries.filter(isHidden).length;
      if (cats.length <= 1 && !hiddenCount) return '';
      return `<div class="tmpl-chooser-filters" role="group" aria-label="${escapeHtml(t('Filter templates by type'))}">
        ${chipHtml('', t('All'))}${cats.map(c => chipHtml(c, c)).join('')}${hiddenCount ? chipHtml(HIDDEN_FILTER, tRaw('Hidden ({n})', { n: hiddenCount })) : ''}
      </div>`;
    };

    // The "Starts with X" line, with the link that puts this tool back to asking.
    const startLineHtml = (): string => {
      if (!startRef) return '';
      const name = startRef === START_BLANK
        ? t('Blank canvas')
        : byRef.get(startRef)?.name ?? parseTemplateRef(startRef, { toolId: opts.toolId })?.id ?? startRef;
      return `<p class="tmpl-chooser-start">${escapeHtml(tRaw('Starts with {name}', { name }))} <button type="button" class="tmpl-chooser-startclear">${escapeHtml(t('Ask me every time'))}</button></p>`;
    };

    const gridHtml = (): string => {
      const showing = activeFilter === HIDDEN_FILTER ? entries.filter(isHidden) : entries.filter(v => !isHidden(v));
      const blank = activeFilter === HIDDEN_FILTER ? '' : blankTileHtml();
      return `<div class="tmpl-chooser-grid">${blank}${showing.map(tileHtml).join('')}</div>`;
    };

    const bodyHtml = (): string =>
      `${startLineHtml()}${filtersHtml()}${gridHtml()}<p class="tmpl-chooser-empty" hidden>${tRaw('No templates match “{term}”.', { term: '<span data-empty-term></span>' })}</p>`;

    /** Everything the body's markup is derived from, minus the active chip (which drives
     *  its own render). Comparing it is how refresh() tells a real change from a no-op. */
    const renderSig = (): string => JSON.stringify([
      startRef ?? '',
      [...hiddenRefs].sort(),
      entries.map(v => [v.id, v.name, v.description ?? '', v.category ?? '', v.own === true]),
    ]);

    root.innerHTML = `
      <div class="tmpl-chooser-backdrop" aria-hidden="true"></div>
      <div class="tmpl-chooser-panel" role="dialog" aria-modal="true" aria-labelledby="tmpl-chooser-title">
        <header class="tmpl-chooser-header">
          <h2 id="tmpl-chooser-title">${escapeHtml(opts.title ?? tRaw('Start {tool}', { tool: opts.toolName }))}</h2>
          <input type="search" class="tmpl-chooser-search" placeholder="${escapeHtml(t('Search templates…'))}" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(t('Search templates'))}">
          <button type="button" class="tmpl-chooser-close" aria-label="${escapeHtml(t('Close'))}">×</button>
        </header>
        <div class="tmpl-chooser-body">${bodyHtml()}</div>
      </div>
    `;

    /** The signature the body currently ON SCREEN was built from. */
    let paintedSig = renderSig();

    const panel = root.querySelector<HTMLElement>('.tmpl-chooser-panel')!;
    const searchInput = root.querySelector<HTMLInputElement>('.tmpl-chooser-search')!;
    const bodyEl = root.querySelector<HTMLElement>('.tmpl-chooser-body')!;
    let emptyEl = root.querySelector<HTMLElement>('.tmpl-chooser-empty')!;
    let emptyTermEl = root.querySelector<HTMLElement>('[data-empty-term]')!;

    const opener = document.activeElement;
    let trap: FocusTrap | undefined;
    let settled = false;

    const finish = (values: Record<string, InputValue>): void => {
      if (settled) return;
      settled = true;
      disposeOpenObservers();
      motionCleanup?.();
      ctxMenu?.destroy();
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
      if (e.key !== 'Escape') return;
      // One Escape, the innermost overlay: an open tile menu takes it and the chooser
      // stays. The menu's own listener is on `document`, so it only sees this event when
      // focus is already inside the popover; when focus is still on the "…" button that
      // opened it, this handler is the one in the bubble path and has to stop here.
      if (ctxMenu?.isOpen()) { e.preventDefault(); e.stopPropagation(); ctxMenu.close(); focusAfter(''); return; }
      e.preventDefault();
      finish({});
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
    bodyEl.addEventListener('click', e => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-motion-play]')) return;
      // The management controls sit inside tiles and the body, so each one is claimed
      // before the tile pick below can read the click as "open this template".
      if (el.closest('.tmpl-chooser-startclear')) { void runAction('start-clear', ''); return; }
      const filterChip = el.closest<HTMLElement>('.tmpl-chooser-filter');
      if (filterChip) { setFilter(filterChip.dataset.filter ?? ''); return; }
      const kebab = el.closest<HTMLElement>('[data-tile-menu]');
      if (kebab) { openTileMenu(kebab); return; }
      const restoreBtn = el.closest<HTMLElement>('[data-restore]');
      if (restoreBtn) {
        const ref = restoreBtn.closest<HTMLElement>('.tmpl-chooser-tile')?.dataset.menuRef;
        if (ref) void runAction('restore', ref);
        return;
      }
      const tile = el.closest<HTMLElement>('[data-template-id]');
      if (!tile) return;
      const chip = el.closest<HTMLElement>('[data-preset-id]');
      pickTile(tile, chip?.dataset.presetId);
    });
    // div[role=button] tiles (the ones carrying preset chips, a menu button or motion)
    // need their keyboard activation wired by hand; real <button> tiles fire click natively.
    bodyEl.addEventListener('keydown', ev => {
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
    // The Hidden chip is not a tag - the grid it renders holds only hidden tiles already,
    // so it narrows nothing here and the term is the whole filter.
    const applyFilter = (): void => {
      const term = searchInput.value.trim().toLowerCase();
      let anyTemplateVisible = false;
      for (const tile of root.querySelectorAll<HTMLElement>('.tmpl-chooser-tile')) {
        if (tile.dataset.templateId === BLANK_ID) { tile.hidden = false; continue; } // Blank is never filtered
        const matchTerm = !term || (tile.dataset.search ?? '').includes(term);
        const matchTag = !activeFilter || activeFilter === HIDDEN_FILTER || tile.dataset.category === activeFilter;
        const show = matchTerm && matchTag;
        tile.hidden = !show;
        if (show) anyTemplateVisible = true;
      }
      emptyEl.hidden = anyTemplateVisible || (!term && !activeFilter);
      emptyTermEl.textContent = term || activeFilter;
    };
    searchInput.addEventListener('input', applyFilter);

    // ── Rendering the body ─────────────────────────────────────────────────────
    // Chips + grid are rebuilt whenever the underlying data moves (a hide, a restore, a
    // rename, a delete, a new copy) or the Hidden view is entered/left. The delegated
    // listeners are bound to `.tmpl-chooser-body`, which this never replaces, so nothing
    // has to be re-wired; only the two empty-state nodes are re-read.
    const renderBody = (): void => {
      // A chip can vanish under the person (the last own template deleted, the last
      // hidden one restored) - fall back to "All" rather than render an empty grid.
      if (activeFilter === HIDDEN_FILTER) {
        if (!entries.some(isHidden)) activeFilter = '';
      } else if (activeFilter && !entries.some(v => !isHidden(v) && v.category === activeFilter)) {
        activeFilter = '';
      }
      bodyEl.innerHTML = bodyHtml();
      paintedSig = renderSig();
      emptyEl = root.querySelector<HTMLElement>('.tmpl-chooser-empty')!;
      emptyTermEl = root.querySelector<HTMLElement>('[data-empty-term]')!;
      applyFilter();
      repaintPreviews?.();
    };

    const setFilter = (next: string): void => {
      if (next === activeFilter) return;
      // Entering or leaving the Hidden view changes WHICH tiles exist, not just which are
      // shown, so that one needs a rebuild; an ordinary tag chip only toggles visibility.
      const membershipMoves = (next === HIDDEN_FILTER) !== (activeFilter === HIDDEN_FILTER);
      activeFilter = next;
      if (membershipMoves) { renderBody(); return; }
      for (const c of root.querySelectorAll<HTMLElement>('.tmpl-chooser-filter')) {
        const on = (c.dataset.filter ?? '') === activeFilter;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      applyFilter();
    };

    // ── The manager: hidden set, "Start with", and the per-tile menu ───────────
    // Every mutation below is one of lib/template-actions.ts's shared handlers or one
    // call on the lib/user-templates.ts store, never a profile write of its own, so the
    // Projects Templates collection and this chooser cannot drift apart.

    const tileFor = (ref: string): HTMLElement | null =>
      ref ? root.querySelector<HTMLElement>(`.tmpl-chooser-tile[data-menu-ref="${CSS.escape(ref)}"]`) : null;

    /** Re-read the profile + the person's own templates and repaint, but only when the
     *  read actually moved something. The FIRST refresh is the common case - no hidden
     *  set, no "Start with", the same own list the caller already handed in - and a
     *  repaint there would throw away tile previews and a mounted motion player for
     *  nothing. */
    const refresh = async (): Promise<void> => {
      if (!profileHost) return;
      try {
        const profile = await profileHost.profile.get();
        hiddenRefs = loadHiddenTemplates(profile, opts.hiddenDefaults ?? []);
        startRef = loadTemplateStart(profile, opts.toolId);
        if (store) entries = ownFirst([...userVariants(await store.list(opts.toolId), ownCategory), ...opts.templates.filter(v => !v.own)]);
      } catch (e) {
        console.warn('template chooser could not read the profile', e);
        return;
      }
      reindex();
      if (settled || renderSig() === paintedSig) return;
      renderBody();
    };

    /** Keep focus inside the modal after a menu or a dialog took it away. */
    const focusAfter = (ref: string): void => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && root.contains(active)) return;
      (tileFor(ref) ?? searchInput).focus();
    };

    async function runAction(act: string, ref: string): Promise<void> {
      if (!profileHost || !store) return;
      const entry = ref && ref !== START_BLANK ? byRef.get(ref) ?? null : null;
      const hiddenDefaults = opts.hiddenDefaults ?? [];
      try {
        switch (act) {
          case 'use': {
            const tile = tileFor(ref);
            if (tile) pickTile(tile);
            return;
          }
          case 'start':
            await setStartWith(profileHost, opts.toolId, ref === START_BLANK ? START_BLANK : ref);
            break;
          case 'start-clear':
            await setStartWith(profileHost, opts.toolId, null);
            break;
          case 'hide':
            await hideShippedTemplate(profileHost, ref, hiddenDefaults);
            break;
          case 'restore':
            await restoreShippedTemplate(profileHost, ref, hiddenDefaults);
            break;
          case 'copy': {
            const parsed = parseTemplateRef(ref, { toolId: opts.toolId });
            if (!entry || entry.own || parsed?.kind !== 'shipped') return;
            const values = await getValues(entry.id);
            if (!values) return;
            await copyShippedTemplate(profileHost, parsed.toolId, parsed.id, values, {
              name: entry.name,
              description: entry.description,
              designSystem: await templateDesignSystemStamp(profileHost),
            });
            break;
          }
          case 'rename': {
            if (!entry?.own) return;
            const { promptDialog } = await import('../components/confirm-dialog.ts');
            const name = await promptDialog({
              title: t('Rename template'), message: t('Template name'),
              confirmLabel: t('Rename'), value: entry.name,
            });
            if (name === null || !name.trim()) { focusAfter(ref); return; }
            await store.rename(entry.id, name);
            break;
          }
          case 'describe': {
            if (!entry?.own) return;
            const { promptDialog } = await import('../components/confirm-dialog.ts');
            const text = await promptDialog({
              title: t('Edit description'), message: t('One line about this template'),
              confirmLabel: t('Save'), value: entry.description ?? '',
            });
            if (text === null) { focusAfter(ref); return; }
            await store.describe(entry.id, text);
            break;
          }
          case 'replace': {
            if (!entry?.own || !opts.currentValues) return;
            await store.replace(entry.id, opts.currentValues());
            // A tile preview is memoised against a signature of the values it was rendered
            // from (featured-render.ts), so the new seed re-renders on its own; the
            // whole-file cache here is keyed by template id alone and has to be dropped.
            fileById.delete(entry.id);
            break;
          }
          case 'export': {
            if (!entry?.own) return;
            const tpl = await store.get(entry.id);
            if (tpl) downloadTemplateFile(tpl);
            return;
          }
          case 'delete': {
            if (!entry?.own) return;
            const { confirmDialog } = await import('../components/confirm-dialog.ts');
            const ok = await confirmDialog({
              title: t('Delete this template?'),
              message: tRaw('{name} is removed from this tool. Documents you already made from it are not affected.', { name: entry.name }),
              confirmLabel: t('Delete'),
            });
            if (!ok) { focusAfter(ref); return; }
            await deleteUserTemplate(profileHost, { id: entry.id, toolId: opts.toolId });
            break;
          }
          default:
            return;
        }
      } catch (e) {
        console.warn('template action failed', act, e);
        return;
      }
      await refresh();
      opts.onChanged?.();
      focusAfter(ref);
    }

    let ctxMod: typeof import('../lib/context-menu.ts') | null = null;

    /** The rows for one tile - only the ones that apply to it. */
    const tileMenuHtml = (ref: string): string => {
      const mod = ctxMod;
      if (!mod) return '';
      const blank = ref === START_BLANK;
      const entry = blank ? null : byRef.get(ref);
      if (!blank && !entry) return '';
      const rows = [
        mod.menuItemHtml('use', icon('arrowRight', { size: 16 }), t('Use')),
        startRef === ref
          ? mod.menuItemHtml('start-clear', icon('pin', { size: 16 }), t('Ask me every time'))
          : mod.menuItemHtml('start', icon('pin', { size: 16 }), tRaw('Start {tool} with this', { tool: opts.toolName })),
      ];
      if (entry?.own) {
        rows.push(mod.menuItemHtml('rename', icon('pen', { size: 16 }), t('Rename')));
        rows.push(mod.menuItemHtml('describe', icon('document', { size: 16 }), t('Edit description')));
        if (opts.currentValues) rows.push(mod.menuItemHtml('replace', icon('refresh', { size: 16 }), t('Update from this document')));
        rows.push(mod.menuItemHtml('export', icon('download', { size: 16 }), t('Export as file (.json)')));
        rows.push(mod.menuItemHtml('delete', icon('trash', { size: 16 }), t('Delete'), { danger: true }));
      } else if (entry) {
        rows.push(mod.menuItemHtml('copy', icon('duplicate', { size: 16 }), t('Make a copy')));
        rows.push(hiddenRefs.has(ref)
          ? mod.menuItemHtml('restore', icon('eye', { size: 16 }), t('Restore'))
          : mod.menuItemHtml('hide', icon('eyeOff', { size: 16 }), t('Hide')));
      }
      return rows.join('');
    };

    /** The pointer-user door into the same menu: the tile's hover/focus "…" button. */
    const openTileMenu = (kebab: HTMLElement): void => {
      const tile = kebab.closest<HTMLElement>('.tmpl-chooser-tile');
      const ref = tile?.dataset.menuRef;
      if (!ctxMenu || !tile || !ref) return;
      const r = kebab.getBoundingClientRect();
      ctxMenu.openAt(r.left, r.bottom, { ref, tile }, kebab);
    };

    if (profileHost) {
      void refresh();
      void import('../lib/context-menu.ts').then(mod => {
        if (settled) return;
        ctxMod = mod;
        ctxMenu = mod.wireTileContextMenu({
          host: bodyEl,
          tileSelector: '.tmpl-chooser-tile[data-menu-ref]',
          refOf: tile => tile.dataset.menuRef ?? null,
          singleHtml: target => tileMenuHtml(target.ref),
          onAction: (act, target) => { if (target) void runAction(act, target.ref); },
        });
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
      // Reads the tiles that are ON SCREEN rather than the whole template list: the grid
      // shows a subset now (hidden tiles only under the Hidden chip), and a manager
      // re-render replaces every tile node, so this is also what re-queues them.
      const renderedIds = (): string[] =>
        [...root.querySelectorAll<HTMLElement>('.tmpl-chooser-tile')]
          .map(tile => tile.dataset.templateId ?? '')
          .filter(id => id && id !== BLANK_ID);
      const requeueAll = (): void => {
        queue.length = 0;
        queued.clear();
        for (const id of renderedIds()) enqueue(id);
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
      for (const id of renderedIds()) enqueue(id);

      // IntersectionObserver stays as an off-screen prioritisation nicety - with the eager
      // loop above it is no longer required (its enqueue() calls dedup to no-ops against
      // `queued`). Root to the real scroll container (the body panel; see template-chooser.css
      // `.tmpl-chooser-body { overflow-y: auto }`), falling back to the viewport - the modal is
      // a fixed overlay filling it - so a missing body never means a dead observer.
      const io = new IntersectionObserver((entries, obs) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          obs.unobserve(en.target);
          const id = (en.target as HTMLElement).dataset.templateId;
          if (id && id !== BLANK_ID) enqueue(id);
        }
      }, { root: bodyEl, rootMargin: '200px' });
      const observeTiles = (): void => {
        for (const tile of root.querySelectorAll<HTMLElement>('.tmpl-chooser-tile')) {
          if (tile.dataset.templateId !== BLANK_ID) io.observe(tile);
        }
      };
      observeTiles();
      // A manager re-render swaps every tile node, taking the rendered <img> and the
      // observed elements with it - so the new nodes are observed and re-queued. The
      // per-template results are memoised in host.previews, so this is a cache read
      // rather than a second round of engine work.
      repaintPreviews = (): void => { observeTiles(); requeueAll(); };

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
