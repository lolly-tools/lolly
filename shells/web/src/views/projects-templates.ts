// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects "Templates" collection (plans/226 section 4.3) - the route
 * `#/p/__templates__` (+ `?tool=<id>` to pre-filter), plus the session-tile
 * "Save as a template..." flow that fills it.
 *
 * It lives beside views/projects.ts rather than inside it for two reasons: that view is
 * already a 3k-line closure under a no-growth ratchet, and everything here is a pure
 * function over data (a model, some HTML, one action dispatch) that a node test can
 * import directly - views/projects.ts cannot be imported outside Vite.
 *
 * The collection is a VIEW over three sources, never a fourth store:
 *   - shipped templates: the metadata each tool carries in the catalog index
 *     (window.__toolIndex), values fetched per tile when its preview renders
 *   - the person's own: lib/user-templates.ts (profile.userTemplates)
 *   - the hidden overlay + "Start with": lib/hidden-templates.ts, lib/template-start.ts
 *
 * Every mutation goes through lib/template-actions.ts (hide / restore / start-with /
 * make-a-copy / delete / export-as-file) or the store, so the chooser's tile menu and
 * these tiles cannot drift apart.
 */

import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { menuItemHtml } from '../lib/context-menu.ts';
import { loadHiddenTemplates } from '../lib/hidden-templates.ts';
import { loadTemplateStart } from '../lib/template-start.ts';
import { resolveTemplateSeed, shippedTemplateRef, userTemplateRef } from '../lib/template-ref.ts';
import { createUserTemplateStore, type UserTemplate } from '../lib/user-templates.ts';
import {
  copyShippedTemplate, deleteUserTemplate, downloadTemplateFile, hiddenTemplates, hideShippedTemplate,
  restoreShippedTemplate, setStartWith, templateDesignSystemStamp, type TemplateActionHost,
} from '../lib/template-actions.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

/** Sentinel folderId for the synthetic Templates collection (the twin of `__uncat__`). */
export const TEMPLATES = '__templates__';

const USE_ICON = icon('externalLink', { strokeWidth: 1.9 });
const START_ICON = icon('pin', { strokeWidth: 1.9 });
const EDIT_ICON = icon('pen', { strokeWidth: 1.9 });
const COPY_ICON = icon('duplicate', { strokeWidth: 1.9 });
const DOWNLOAD_ICON = icon('download', { strokeWidth: 1.9 });
const SHARE_ICON = icon('share', { strokeWidth: 1.9 });
const HIDE_ICON = icon('eyeOff', { strokeWidth: 1.9 });
const SHOW_ICON = icon('eye', { strokeWidth: 1.9 });
const TRASH_ICON = icon('trash', { strokeWidth: 1.9 });
const TEMPLATE_GLYPH = icon('layersStack', { strokeWidth: 1.6 });
const BACK_ICON = icon('chevronLeft');
const MENU_ICON = icon('menuDots');
const CHECK_ICON = icon('check');

/** A tool as this collection reads it off the catalog index (window.__toolIndex). */
export interface TemplatesToolInfo {
  id: string;
  name?: string;
  formats?: readonly string[];
  templates?: ReadonlyArray<{
    id: string; name: string; description?: string; category?: string;
    motion?: { posterMs?: number };
  }>;
}

/** One tile's worth of template: shipped or the person's own, hidden or not. */
export interface TemplateItem {
  /** The canonical ref: `"<toolId>:<tid>"` (shipped) or `"user:<id>"` (own). */
  ref: string;
  own: boolean;
  toolId: string;
  toolName: string;
  /** The template id inside its tool (the tid, or the user record's id). */
  id: string;
  name: string;
  description?: string;
  hidden: boolean;
  /** This template is the tool's current "Start with". */
  startsHere: boolean;
  formats?: readonly string[];
  /** A motion template's poster time, so its preview freezes where the author asked. */
  posterMs?: number;
  /** Own templates carry their seed inline; a shipped one is fetched when it paints. */
  values?: Record<string, unknown>;
}

export interface TemplatesModel {
  items: TemplateItem[];
  /** Tools with at least one template, in catalog-index order, for the chips row. */
  tools: Array<{ id: string; name: string }>;
}

/**
 * Fold the three sources into one list. Pure, so the whole listing rule (which tools
 * appear, what is hidden, which tile is the tool's start) is testable without a DOM.
 */
export function buildTemplatesModel(input: {
  tools: readonly TemplatesToolInfo[];
  own: readonly UserTemplate[];
  hidden: ReadonlySet<string>;
  startOf: (toolId: string) => string | null;
  toolName: (id: string) => string;
}): TemplatesModel {
  const { tools, own, hidden, startOf, toolName } = input;
  const items: TemplateItem[] = [];
  const withAny = new Set<string>();
  const formatsOf = new Map<string, readonly string[] | undefined>();
  for (const tool of tools) {
    formatsOf.set(tool.id, tool.formats);
    for (const meta of tool.templates ?? []) {
      const ref = shippedTemplateRef(tool.id, meta.id);
      withAny.add(tool.id);
      items.push({
        ref, own: false, toolId: tool.id, toolName: toolName(tool.id), id: meta.id,
        name: meta.name, description: meta.description,
        hidden: hidden.has(ref), startsHere: startOf(tool.id) === ref,
        formats: tool.formats, posterMs: meta.motion?.posterMs,
      });
    }
  }
  for (const tpl of own) {
    const ref = userTemplateRef(tpl.id);
    withAny.add(tpl.toolId);
    items.push({
      ref, own: true, toolId: tpl.toolId, toolName: toolName(tpl.toolId), id: tpl.id,
      name: tpl.name, description: tpl.description,
      hidden: false, startsHere: startOf(tpl.toolId) === ref,
      formats: formatsOf.get(tpl.toolId), values: tpl.values,
    });
  }
  // Chips follow the index order for shipped tools, then a tool that only has the
  // person's own templates (a sideloaded or since-removed tool still lists its work).
  const chipIds = [
    ...tools.map(x => x.id).filter(id => withAny.has(id)),
    ...[...withAny].filter(id => !tools.some(x => x.id === id)),
  ];
  return { items, tools: chipIds.map(id => ({ id, name: toolName(id) })) };
}

/** The `#/tool/<id>?template=<ref>` link a tile's Use action follows. */
export function templateUseHref(item: TemplateItem): string {
  return `#/tool/${encodeURIComponent(item.toolId)}?template=${encodeURIComponent(item.ref)}`;
}

/** Fold a string for matching: lowercase, diacritics stripped. */
const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Name + description + tool, matched token-AND like the rest of the Projects search. */
export function matchesTemplate(item: TemplateItem, query: string): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = fold(`${item.name} ${item.description ?? ''} ${item.toolName} ${item.toolId}`);
  return tokens.every(tok => hay.includes(tok));
}

/** The items a given tool filter + query leaves, hidden ones separated out. */
export function selectTemplates(model: TemplatesModel, tool: string, query: string): {
  own: TemplateItem[]; shipped: TemplateItem[]; hidden: TemplateItem[];
} {
  const keep = (i: TemplateItem): boolean => (!tool || i.toolId === tool) && matchesTemplate(i, query);
  const kept = model.items.filter(keep);
  return {
    own: kept.filter(i => i.own),
    shipped: kept.filter(i => !i.own && !i.hidden),
    hidden: kept.filter(i => i.hidden),
  };
}

/** The rows a template tile's context menu offers (plans/226 section 4.2's set). */
export function templateMenuHtml(item: TemplateItem): string {
  const startRow = item.startsHere
    ? menuItemHtml('tpl-start-off', START_ICON, t('Ask me every time'))
    : menuItemHtml('tpl-start', START_ICON, tRaw('Start {tool} with this', { tool: item.toolName }));
  return [
    menuItemHtml('tpl-use', USE_ICON, t('Use')),
    startRow,
    item.own ? menuItemHtml('tpl-rename', EDIT_ICON, t('Rename')) : '',
    item.own ? menuItemHtml('tpl-describe', EDIT_ICON, t('Edit description')) : '',
    item.own ? '' : menuItemHtml('tpl-copy', COPY_ICON, t('Make a copy')),
    item.own ? menuItemHtml('tpl-export', DOWNLOAD_ICON, t('Export as file (.json)')) : '',
    item.own ? menuItemHtml('tpl-share', SHARE_ICON, t('Share as .lolly')) : '',
    !item.own && !item.hidden ? menuItemHtml('tpl-hide', HIDE_ICON, t('Hide')) : '',
    item.hidden ? menuItemHtml('tpl-restore', SHOW_ICON, t('Restore')) : '',
    item.own ? menuItemHtml('tpl-delete', TRASH_ICON, t('Delete'), { danger: true }) : '',
  ].join('');
}

/**
 * The selection menu when the selection is templates: the file actions have nothing to
 * act on, so Hide / Restore / Delete take their place, per what the selection holds.
 * The `<p>` head is plain text outside the role="menu" list, matching the view's own
 * bulk menu (the shared wireTileContextMenu demotes the outer div for bulk menus).
 */
export function templateBulkMenuHtml(count: number, kinds: { hide: boolean; restore: boolean; delete: boolean }): string {
  const rows = [
    kinds.hide ? menuItemHtml('hide', HIDE_ICON, t('Hide')) : '',
    kinds.restore ? menuItemHtml('restore', SHOW_ICON, t('Restore')) : '',
    kinds.delete ? menuItemHtml('delete', TRASH_ICON, t('Delete'), { danger: true }) : '',
  ].join('');
  return `<p class="folder-menu-head">${t('{n} selected', { n: count })}</p>`
    + `<div class="folder-menu-list" role="menu" aria-label="${escapeHtml(t('Selection actions'))}">${rows}</div>`;
}

/** One template tile: the chooser's card look, with a live preview painted in later. */
export function templateTileHtml(item: TemplateItem, selected: boolean): string {
  const sub = item.description ? `${item.description} · ${item.toolName}` : item.toolName;
  return `
    <div class="folder-tile tpl-tile${selected ? ' is-selected' : ''}" data-ref="${escapeHtml(item.ref)}" data-kind="template">
      <button type="button" class="tile-check" data-select="${escapeHtml(item.ref)}" data-kind="template"
        aria-pressed="${selected ? 'true' : 'false'}" aria-label="${escapeHtml(tRaw('Select {name}', { name: item.name }))}">${CHECK_ICON}</button>
      ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - a fixed '#/tool/<id>' hash route built by templateUseHref */ ''}
      <a class="tile-primary" href="${escapeHtml(templateUseHref(item))}" draggable="false"
         data-open-template="${escapeHtml(item.ref)}" aria-label="${escapeHtml(tRaw('Use {name}', { name: item.name }))}">
        <span class="tile-cover tpl-cover">
          <span class="tpl-cover-glyph" aria-hidden="true">${TEMPLATE_GLYPH}</span>
          <img class="tpl-cover-img" alt="" decoding="async" data-tpl-preview="${escapeHtml(item.ref)}">
        </span>
        <span class="tile-meta">
          <span class="tile-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="tile-sub">${escapeHtml(sub)}</span>
          ${item.startsHere ? `<span class="tile-badges"><span class="tpl-starts">${t('Starts here')}</span></span>` : ''}
        </span>
      </a>
      <button type="button" class="tile-menu-btn" data-menu="${escapeHtml(item.ref)}" data-menu-kind="template"
        aria-label="${escapeHtml(t('Template actions'))}">${MENU_ICON}</button>
    </div>`;
}

/** The whole collection body: header, tool chips, the three sections. */
export function templatesBodyHtml(
  model: TemplatesModel,
  state: { tool: string; hiddenOpen: boolean },
  opts: { query: string; isSelected: (ref: string) => boolean },
): string {
  const { own, shipped, hidden } = selectTemplates(model, state.tool, opts.query);
  const tiles = (items: readonly TemplateItem[]): string =>
    `<div class="folder-grid projects-grid">${items.map(i => templateTileHtml(i, opts.isSelected(i.ref))).join('')}</div>`;
  const chip = (id: string, label: string): string =>
    `<button type="button" class="projects-chip${state.tool === id ? ' is-on' : ''}" data-tpl-tool="${escapeHtml(id)}" aria-pressed="${state.tool === id}">${escapeHtml(label)}</button>`;
  const chips = model.tools.length > 1 || state.tool
    ? `<div class="projects-rail tpl-chips" role="group" aria-label="${escapeHtml(t('Filter templates by tool'))}">
         ${chip('', t('All tools'))}${model.tools.map(x => chip(x.id, x.name)).join('')}
       </div>`
    : '';
  // Shipped tiles group per tool, so "Shipped with Chart" reads as the tool's own set
  // even when nothing is filtered.
  const shippedByTool = new Map<string, TemplateItem[]>();
  for (const item of shipped) {
    const list = shippedByTool.get(item.toolId);
    if (list) list.push(item); else shippedByTool.set(item.toolId, [item]);
  }
  const shippedSecs = [...shippedByTool].map(([toolId, items]) => `
    <section class="tpl-sec">
      <h2 class="projects-sec-label">${t('Shipped with {tool}', { tool: items[0]?.toolName ?? toolId })}</h2>
      ${tiles(items)}
    </section>`).join('');
  const ownSec = own.length ? `
    <section class="tpl-sec">
      <h2 class="projects-sec-label">${t('Yours')}</h2>
      ${tiles(own)}
    </section>` : '';
  const hiddenSec = hidden.length ? `
    <section class="tpl-sec tpl-sec--hidden">
      <button type="button" class="tpl-hidden-toggle" data-tpl-hidden aria-expanded="${state.hiddenOpen}">
        <span>${t('Hidden')}</span><span class="tpl-hidden-count">${hidden.length}</span>
      </button>
      ${state.hiddenOpen ? tiles(hidden) : ''}
    </section>` : '';
  const nothing = !own.length && !shipped.length && !hidden.length;
  const empty = nothing ? `<p class="projects-empty">${
    opts.query || state.tool
      ? t('No templates match. Clear the filter to see them all.')
      : t('Save one from a tool with “Save as”, or from a project tile with “Save as a template…”.')
  }</p>` : '';
  return `
    <nav class="projects-crumbs" aria-label="${escapeHtml(t('Folder path'))}"><a href="#/p">${t('Projects')}</a></nav>
    <div class="projects-head">
      <a href="#/p" class="projects-back" aria-label="${escapeHtml(t('Back to Projects'))}">${BACK_ICON}</a>
      <h2 class="projects-title">${t('Templates')}</h2>
    </div>
    <p class="tpl-lede">${t('Starting points you saved, and the ones that shipped with each tool.')}</p>
    ${chips}${ownSec}${shippedSecs}${hiddenSec}${empty}`;
}

// ── the live collection ──────────────────────────────────────────────────────

/** What the view lends the collection: data access, dialogs, and a way to repaint. */
export interface TemplatesCtx {
  host: TemplateActionHost;
  /** The catalog index tools (window.__toolIndex.tools), read fresh each load. */
  toolIndex(): readonly TemplatesToolInfo[];
  toolName(id: string): string;
  /** The mount's raw route query, for the `?tool=` pre-filter. */
  params: string;
  isSelected(ref: string): boolean;
  announce(message: string): void;
  toast(message: string, actionLabel: string, action: () => void): void;
  prompt(opts: { title: string; message: string; value?: string; confirmLabel?: string }): Promise<string | null>;
  confirm(opts: { title: string; message: string; confirmLabel?: string }): Promise<boolean>;
  /** Reload the view's data and repaint (a no-op once unmounted). */
  refresh(): Promise<void>;
  isMounted(): boolean;
  /** A saved session's stored record. */
  loadSession(slot: string): Promise<Record<string, unknown> | null>;
  /** A tool's manifest inputs, `{ inputs: [] }` when it cannot be loaded. */
  loadManifest(toolId: string): Promise<{ inputs?: ReadonlyArray<{ id: string; type?: string }> }>;
}

export interface SessionSaveSource { slot: string; toolId: string; label: string }

/** One row of the add-picker's "blank, or from a template" choice. */
export interface AddSeedChoice { id: string; label: string; primary?: boolean }
/** The blank row's id - the add-picker's long-standing "resolved defaults" answer. */
export const ADD_SEED_BLANK = '__default__';

export interface TemplatesCollection {
  /** True while the collection has data for this ref (drives the view's kind lookup). */
  has(ref: string): boolean;
  load(profile: Profile | null): Promise<void>;
  html(query: string): string;
  wire(root: HTMLElement, query: string): void;
  menuHtml(ref: string): string;
  action(act: string, ref: string): Promise<void>;
  bulk(act: string, refs: readonly string[]): Promise<void>;
  /** Which bulk actions the current selection supports. */
  bulkKinds(refs: readonly string[]): { hide: boolean; restore: boolean; delete: boolean };
  /** Refs the collection would render for this query (the view prunes selection with it). */
  visibleRefs(query: string): string[];
  /** Can this tool carry a template at all? Optimistic until its manifest is known. */
  canTemplate(toolId: string): boolean;
  saveSessions(sources: readonly SessionSaveSource[], opts: { ask: boolean }): Promise<void>;
  /** The add-picker's choices for one tool: blank first, then shipped, then yours.
   *  A single entry means there is nothing to choose, so the caller skips the dialog. */
  addSeedChoices(toolId: string, profile: Profile | null): Promise<AddSeedChoice[]>;
  /** The values behind an add-picker choice (a shipped seed is fetched). */
  seedForRef(ref: string, toolId: string): Promise<Record<string, unknown> | undefined>;
  destroy(): void;
}

export function createTemplatesCollection(ctx: TemplatesCtx): TemplatesCollection {
  let model: TemplatesModel = { items: [], tools: [] };
  let byRef = new Map<string, TemplateItem>();
  const state = { tool: new URLSearchParams(ctx.params).get('tool') || '', hiddenOpen: false };
  // Which tools can carry a template (>= 1 non-file input). Filled from the manifest the
  // first time a session menu asks; unknown reads as yes, and the save path re-checks
  // against the real manifest before writing, so an optimistic row cannot save nothing.
  const canTemplateByTool = new Map<string, boolean>();
  const warming = new Set<string>();
  let stopPreviews: (() => void) | null = null;

  const store = (): ReturnType<typeof createUserTemplateStore> =>
    createUserTemplateStore(ctx.host);

  async function load(profile: Profile | null): Promise<void> {
    let own: UserTemplate[] = [];
    try { own = await store().list(); } catch { own = []; }
    let defaults: readonly string[] = [];
    try { defaults = (await import('../catalog/sync.ts')).defaultHiddenTemplateRefs(); } catch { defaults = []; }
    model = buildTemplatesModel({
      tools: ctx.toolIndex(),
      own,
      hidden: loadHiddenTemplates(profile, defaults),
      startOf: (toolId) => loadTemplateStart(profile, toolId),
      toolName: ctx.toolName,
    });
    byRef = new Map(model.items.map(i => [i.ref, i]));
  }

  function visibleRefs(query: string): string[] {
    const { own, shipped, hidden } = selectTemplates(model, state.tool, query);
    return [...own, ...shipped, ...(state.hiddenOpen ? hidden : [])].map(i => i.ref);
  }

  /**
   * Reflect the tool filter in the URL so the view is linkable, without a router round
   * trip: the projects route keys on the folder id, so a same-folder hash change is
   * deduped and never re-mounts (the pattern views/projects.ts exitSearch uses). Written
   * with replace(), so filtering does not fill the Back button with chip clicks.
   */
  function syncFilterUrl(): void {
    const hash = window.location.hash;
    const at = hash.indexOf('?');
    const params = new URLSearchParams(at >= 0 ? hash.slice(at + 1) : '');
    if (state.tool) params.set('tool', state.tool); else params.delete('tool');
    const rest = params.toString();
    window.location.replace((at >= 0 ? hash.slice(0, at) : hash) + (rest ? `?${rest}` : ''));
  }

  function wire(root: HTMLElement, query: string): void {
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const chip = target.closest<HTMLElement>('[data-tpl-tool]');
      if (chip) {
        e.preventDefault();
        state.tool = chip.dataset.tplTool || '';
        syncFilterUrl();
        void ctx.refresh();
        return;
      }
      const reveal = target.closest<HTMLElement>('[data-tpl-hidden]');
      if (reveal) {
        e.preventDefault();
        state.hiddenOpen = !state.hiddenOpen;
        void ctx.refresh();
      }
    });
    stopPreviews?.();
    stopPreviews = hydrateTemplatePreviews(root, ctx.host, visibleRefs(query).map(r => byRef.get(r)!).filter(Boolean));
  }

  // ── actions ────────────────────────────────────────────────────────────────

  /** A shipped template's seed, fetched on demand (an own one carries its values). */
  async function seedOf(item: TemplateItem): Promise<Record<string, unknown> | null> {
    if (item.values) return item.values;
    const found = await resolveTemplateSeed(ctx.host, item.ref, { toolId: item.toolId });
    return (found?.values ?? null) as Record<string, unknown> | null;
  }

  async function action(act: string, ref: string): Promise<void> {
    const item = byRef.get(ref);
    if (!item) return;
    if (act === 'tpl-use') { window.location.hash = templateUseHref(item); return; }
    if (act === 'tpl-start' || act === 'tpl-start-off') {
      await setStartWith(ctx.host, item.toolId, act === 'tpl-start' ? item.ref : null);
      ctx.announce(act === 'tpl-start'
        ? tRaw('{tool} starts with {name}', { tool: item.toolName, name: item.name })
        : tRaw('{tool} asks every time', { tool: item.toolName }));
      await ctx.refresh();
      return;
    }
    if (act === 'tpl-rename' && item.own) {
      const name = await ctx.prompt({ title: t('Rename template'), message: t('Template name'), value: item.name, confirmLabel: t('Save') });
      if (!name?.trim() || !ctx.isMounted()) return;
      await store().rename(item.id, name.trim());
      await ctx.refresh();
      return;
    }
    if (act === 'tpl-describe' && item.own) {
      const text = await ctx.prompt({ title: t('Edit description'), message: t('One line about this template'), value: item.description ?? '', confirmLabel: t('Save') });
      if (text === null || !ctx.isMounted()) return;
      await store().describe(item.id, text);
      await ctx.refresh();
      return;
    }
    if (act === 'tpl-copy' && !item.own) {
      const values = await seedOf(item);
      if (!values) { ctx.announce(t('That template could not be read.')); return; }
      await copyShippedTemplate(ctx.host, item.toolId, item.id, values, {
        name: tRaw('{name} copy', { name: item.name }),
        description: item.description,
        designSystem: await templateDesignSystemStamp(ctx.host),
      });
      ctx.announce(t('Copied to Yours'));
      await ctx.refresh();
      return;
    }
    if (act === 'tpl-export' && item.own) {
      const tpl = await store().get(item.id);
      if (tpl) downloadTemplateFile(tpl);
      return;
    }
    if (act === 'tpl-share' && item.own) {
      const tpl = await store().get(item.id);
      if (!tpl) return;
      try {
        const { shareTemplateAsLolly } = await import('../lib/template-share.ts');
        await shareTemplateAsLolly(ctx.host, tpl);
      } catch (err) {
        ctx.toast(String((err as Error)?.message || err), t('Close'), () => {});
      }
      return;
    }
    if (act === 'tpl-hide' && !item.own) { await bulk('hide', [ref]); return; }
    if (act === 'tpl-restore') { await bulk('restore', [ref]); return; }
    if (act === 'tpl-delete' && item.own) { await bulk('delete', [ref]); }
  }

  function bulkKinds(refs: readonly string[]): { hide: boolean; restore: boolean; delete: boolean } {
    const items = refs.map(r => byRef.get(r)).filter(Boolean) as TemplateItem[];
    return {
      hide: items.some(i => !i.own && !i.hidden),
      restore: items.some(i => i.hidden),
      delete: items.some(i => i.own),
    };
  }

  async function bulk(act: string, refs: readonly string[]): Promise<void> {
    const items = refs.map(r => byRef.get(r)).filter(Boolean) as TemplateItem[];
    if (!items.length) return;
    let defaults: readonly string[] = [];
    try { defaults = (await import('../catalog/sync.ts')).defaultHiddenTemplateRefs(); } catch { defaults = []; }
    // Hide and restore read the LIVE overlay rather than the flag the tiles were rendered
    // with: another surface (the chooser, another tab) may have moved it since.
    if (act === 'hide' || act === 'tpl-hide') {
      const live = await hiddenTemplates(ctx.host, defaults);
      for (const item of items.filter(i => !i.own && !live.has(i.ref))) await hideShippedTemplate(ctx.host, item.ref, defaults);
      ctx.announce(t('Hidden'));
    } else if (act === 'restore' || act === 'tpl-restore') {
      const live = await hiddenTemplates(ctx.host, defaults);
      for (const item of items.filter(i => !i.own && live.has(i.ref))) await restoreShippedTemplate(ctx.host, item.ref, defaults);
      ctx.announce(t('Restored'));
    } else if (act === 'delete' || act === 'tpl-delete') {
      const mine = items.filter(i => i.own);
      if (!mine.length) return;
      // The itemised confirm the Projects grid uses: the names are in the question, so
      // nobody deletes a set they cannot see.
      const ok = await ctx.confirm({
        title: mine.length === 1 ? t('Delete this template?') : tRaw('Delete {n} templates?', { n: mine.length }),
        message: mine.map(i => i.name).join(', '),
        confirmLabel: t('Delete'),
      });
      if (!ok || !ctx.isMounted()) return;
      for (const item of mine) await deleteUserTemplate(ctx.host, { id: item.id, toolId: item.toolId });
      ctx.announce(mine.length === 1 ? t('Template deleted') : tRaw('{n} templates deleted', { n: mine.length }));
    } else {
      return;
    }
    await ctx.refresh();
  }

  // ── the add-picker's seed choice ───────────────────────────────────────────

  /**
   * "Start blank, or from a template" for the Projects quick-add. It lists the shipped
   * templates too (the picker used to offer only the person's own), drops the hidden ones,
   * and leads with the tool's "Start with" so the quick-add agrees with what a blank open
   * of that tool would do.
   */
  async function addSeedChoices(toolId: string, profile: Profile | null): Promise<AddSeedChoice[]> {
    let own: UserTemplate[] = [];
    try { own = await store().list(toolId); } catch { own = []; }
    let defaults: readonly string[] = [];
    try { defaults = (await import('../catalog/sync.ts')).defaultHiddenTemplateRefs(); } catch { defaults = []; }
    const hidden = loadHiddenTemplates(profile, defaults);
    const start = loadTemplateStart(profile, toolId);
    const row = (id: string, name: string): AddSeedChoice => start === id
      ? { id, label: tRaw('Start with: {name}', { name }), primary: true }
      : { id, label: name };
    // 'blank' is the stored form of "open on the manifest defaults" (lib/template-start).
    const blank: AddSeedChoice = start === 'blank'
      ? { id: ADD_SEED_BLANK, label: tRaw('Start with: {name}', { name: t('Blank') }), primary: true }
      : { id: ADD_SEED_BLANK, label: t('Blank'), primary: start === null };
    const shipped = (ctx.toolIndex().find(x => x.id === toolId)?.templates ?? [])
      .map(meta => ({ meta, ref: shippedTemplateRef(toolId, meta.id) }))
      .filter(x => !hidden.has(x.ref))
      .map(x => row(x.ref, x.meta.name));
    return [blank, ...shipped, ...own.map(tpl => row(userTemplateRef(tpl.id), tpl.name))];
  }

  async function seedForRef(ref: string, toolId: string): Promise<Record<string, unknown> | undefined> {
    const found = await resolveTemplateSeed(ctx.host, ref, { toolId });
    return (found?.values ?? undefined) as Record<string, unknown> | undefined;
  }

  // ── "Save as a template..." from a session tile ────────────────────────────

  function canTemplate(toolId: string): boolean {
    const known = canTemplateByTool.get(toolId);
    if (known !== undefined) return known;
    if (!warming.has(toolId)) {
      warming.add(toolId);
      void ctx.loadManifest(toolId)
        .then(async (manifest) => {
          const { canSaveTemplate } = await import('../lib/user-templates.ts');
          canTemplateByTool.set(toolId, canSaveTemplate(manifest.inputs));
        })
        .catch(() => { /* leave it unknown - the save path re-checks */ });
    }
    return true;
  }

  async function saveSessions(sources: readonly SessionSaveSource[], opts: { ask: boolean }): Promise<void> {
    const { templateValuesFromSnapshot } = await import('./tool-session-snapshot.ts');
    const { canSaveTemplate } = await import('../lib/user-templates.ts');
    const designSystem = await templateDesignSystemStamp(ctx.host);
    let saved = 0;
    let lastToolId = '';
    for (const source of sources) {
      const snapshot = await ctx.loadSession(source.slot).catch(() => null);
      if (!snapshot) continue;
      const manifest = await ctx.loadManifest(source.toolId);
      canTemplateByTool.set(source.toolId, canSaveTemplate(manifest.inputs));
      if (!canSaveTemplate(manifest.inputs)) continue;
      let name = source.label;
      if (opts.ask) {
        const typed = await ctx.prompt({
          title: t('Save as a template'), message: t('Name this template'),
          value: source.label, confirmLabel: t('Save'),
        });
        if (!typed?.trim() || !ctx.isMounted()) return;
        name = typed.trim();
      }
      try {
        await store().save({
          toolId: source.toolId,
          name,
          values: templateValuesFromSnapshot(snapshot, manifest),
          ...(designSystem ? { designSystem } : {}),
        });
        saved++;
        lastToolId = source.toolId;
      } catch { /* a nameless or oversized record is refused by the store; skip it */ }
    }
    if (!saved) { ctx.announce(t('Nothing here could be saved as a template.')); return; }
    ctx.toast(
      saved === 1 ? t('Saved as a template') : tRaw('{n} templates saved', { n: saved }),
      t('Manage'),
      () => { window.location.hash = `#/p/${TEMPLATES}${lastToolId ? `?tool=${encodeURIComponent(lastToolId)}` : ''}`; },
    );
    await ctx.refresh();
  }

  return {
    has: (ref) => byRef.has(ref),
    load,
    html: (query) => templatesBodyHtml(model, state, { query, isSelected: ctx.isSelected }),
    wire,
    menuHtml: (ref) => { const item = byRef.get(ref); return item ? templateMenuHtml(item) : ''; },
    action,
    bulk,
    bulkKinds,
    visibleRefs,
    canTemplate,
    saveSessions,
    addSeedChoices,
    seedForRef,
    destroy: () => { stopPreviews?.(); stopPreviews = null; },
  };
}

// ── previews ─────────────────────────────────────────────────────────────────

/**
 * Paint each tile's preview through the SAME `template:<toolId>:<tid>` cache the in-tool
 * chooser and the gallery's info dialog use, so a template either surface has rendered
 * resolves instantly. Lazy (an IntersectionObserver where there is one) and serial: a
 * render is an offscreen mount, so a screenful of them must not start at once.
 */
export function hydrateTemplatePreviews(
  root: HTMLElement,
  host: TemplateActionHost,
  items: readonly TemplateItem[],
): () => void {
  const byRef = new Map(items.map(i => [i.ref, i]));
  const queue: HTMLImageElement[] = [];
  let running = false;
  let stopped = false;

  async function pump(): Promise<void> {
    if (running) return;
    running = true;
    const { renderFeaturedVariant } = await import('../lib/featured-render.ts');
    const { fetchTemplateFile } = await import('../lib/template-source.ts');
    while (queue.length && !stopped) {
      const img = queue.shift()!;
      const item = byRef.get(img.dataset.tplPreview ?? '');
      if (!item || !img.isConnected || img.getAttribute('src')) continue;
      try {
        let values = item.values;
        let posterMs = item.posterMs;
        if (!values) {
          const file = await fetchTemplateFile(item.toolId, item.id);
          if (!file) continue;
          values = file.values as Record<string, unknown>;
          posterMs = posterMs ?? file.motion?.posterMs;
        }
        const thumb = await renderFeaturedVariant(host, item.toolId, item.formats, item.id, values, 'template', posterMs);
        if (thumb && img.isConnected && !stopped) img.src = thumb;
      } catch { /* the glyph behind the image stays */ }
    }
    running = false;
  }

  const imgs = [...root.querySelectorAll<HTMLImageElement>('img[data-tpl-preview]')];
  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        queue.push(entry.target as HTMLImageElement);
      }
      void pump();
    }, { rootMargin: '200px' });
    for (const img of imgs) observer.observe(img);
  } else {
    queue.push(...imgs);
    void pump();
  }
  return () => { stopped = true; queue.length = 0; observer?.disconnect(); };
}
