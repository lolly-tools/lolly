// SPDX-License-Identifier: MPL-2.0
/**
 * The picker's markup for everything that is not a catalog asset tile: the tab strip's
 * buttons and per-pane search placeholder, the Tools pane, and the three cards that
 * START something - a tool, a saved creation, a template.
 *
 * Pure HTML-string builders, moved out of views/picker.ts so the dialog itself keeps to
 * its wiring. The data-* hooks are the contract: picker.ts owns the delegated click
 * handling for [data-tool-id], [data-quickadd-tool], [data-session-slot],
 * [data-template-ref] and [data-quickadd-template].
 */
import { t, tRaw } from '../i18n.ts';
import { escapeHtml } from '../lib/html.ts';
import { svgDataUrl } from '../lib/format.ts';
import { icon } from '../lib/icons.ts';
import { previewMedia } from '../lib/preview-media.ts';
import { relTime as relTimeAt } from './picker-formats.ts';

/** A tool the picker can offer, as the catalog index describes it. */
export interface PickerTool {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  preview?: string;
  /** The tool's motion preview, when its content genuinely animates (catalog index `anim`).
   *  `preview` stays the still poster - see lib/preview-media.ts. */
  anim?: string;
  formats?: readonly string[];
  exportable?: boolean;
  // Canvas dimensions (from the catalog index) - used to fit an animated card.html banner
  // to the fixed-height preview slot at the right aspect. See toolCard / previewMedia.
  width?: number;
  height?: number;
}

/** A saved single-tool session, projected for the "Saved creations" tab. */
export interface PickerSession {
  slot: string;
  toolId: string;
  label?: string;
  toolName: string;
  toolIcon: string | null;
  thumb: string | null;
  updatedAt: string;
}

/** One starting point for the Templates tab: a person's own, or one that shipped
 *  with the tool. The `ref` is the canonical template ref (plans/226). */
export interface PickerTemplate {
  ref: string;
  name: string;
  toolId: string;
  toolName: string;
  own: boolean;
  description?: string;
}

const TEMPLATE_GLYPH = icon('layersStack', { strokeWidth: 1.6 });

// A tool the user can render to an image. Preview-forward like the gallery: show the
// tool's rendered preview thumbnail, falling back to its inline icon. The `preview` is
// a build artifact (catalog/previews/ - committed, but absent on a fresh checkout or
// after index drift) that can still 404 - so the icon is always rendered too, revealed
// by a capture-phase error handler (see render). The index ships the icon as trusted
// inline SVG (built from tools/<id>/icon.svg) - inlined so it themes via currentColor.
export function toolCard(tool: PickerTool, quickAdd = false): string {
  const hasPreview = Boolean(tool.preview);
  // The preview slot is a fixed 84px-tall box (picker.css). A card.html banner renders in
  // a sandboxed iframe fitted to that height at the tool's aspect (so a square ad isn't
  // stretched to the tile width); svg/png stay <img> with the slot's object-fit.
  // Keep the slot's fixed 84px height (from the class) and derive width from the tool's
  // aspect, so an animated banner tile is the same height as its <img> neighbours.
  const iframeSize = (tool.width && tool.height)
    ? `aspect-ratio:${tool.width} / ${tool.height};width:auto;margin-inline:auto`
    : 'width:100%;height:100%';
  // A `<div>` wrapper (not a bare <button>) when the quick-add affordance is present:
  // the "+ Add" control is a SIBLING of the open-primary, never nested (nested buttons
  // are invalid HTML and break the delegated handler - same reasoning as userCard).
  const openBtn = `<button type="button" class="asset-picker-card asset-picker-toolitem${hasPreview ? '' : ' no-preview'}${quickAdd ? ' asset-picker-toolitem--collect' : ''}" data-tool-id="${escapeHtml(tool.id)}" title="${escapeHtml(tool.description ?? tool.name)}">
      ${hasPreview ? previewMedia(tool.preview!, 'asset-picker-toolitem-preview', iframeSize, false, tool.anim) : ''}
      <span class="asset-picker-toolitem-icon" aria-hidden="true">${tool.icon ?? ''}</span>
      <span class="asset-picker-name">${escapeHtml(tool.name)}</span>
    </button>`;
  if (!quickAdd) return openBtn;
  return `<div class="asset-picker-toolcell">${openBtn}<button type="button" class="asset-picker-toolquick" data-quickadd-tool="${escapeHtml(tool.id)}" title="${escapeHtml('Add to this folder with default settings - without opening the editor')}" aria-label="${escapeHtml(`Add ${tool.name} to this folder without opening`)}">+ Add</button></div>`;
}

/**
 * One template on the Templates tab (plans/245). The same two controls a tool card
 * offers, for the same two intents: the primary opens the tool seeded from this
 * template, and "+ Add" files a project from it without opening the editor. The glyph
 * is the shared layers mark the Templates collection uses, so a starting point reads
 * as one wherever it appears.
 */
export function templateCard(template: PickerTemplate, quickAdd = false): string {
  // The tab spans every tool, so each card names its own: yours reads "Chart · Yours",
  // one that shipped reads "Shipped with Chart" (which already names it).
  const sub = template.own
    ? `${template.toolName} · ${t('Yours')}`
    : tRaw('Shipped with {tool}', { tool: template.toolName });
  const openBtn = `<button type="button" class="asset-picker-card asset-picker-toolitem no-preview${quickAdd ? ' asset-picker-toolitem--collect' : ''}" data-template-ref="${escapeHtml(template.ref)}" title="${escapeHtml(template.description ?? template.name)}">
      <span class="asset-picker-toolitem-icon" aria-hidden="true">${TEMPLATE_GLYPH}</span>
      <span class="asset-picker-name">${escapeHtml(template.name)}</span>
      <span class="asset-picker-sessitem-when">${escapeHtml(sub)}</span>
    </button>`;
  if (!quickAdd) return openBtn;
  return `<div class="asset-picker-toolcell">${openBtn}<button type="button" class="asset-picker-toolquick" data-quickadd-template="${escapeHtml(template.ref)}" title="${escapeHtml(t('Add a project from this template without opening the editor'))}" aria-label="${escapeHtml(tRaw('Add {name} to this folder without opening', { name: template.name }))}">${escapeHtml(t('+ Add'))}</button></div>`;
}

// A previous saved creation. Its thumbnail is a PNG data-URL (raster tools) or raw SVG
// markup (vector tools); SVG is rendered via a data-URL <img> so an embedded script in
// an imported session cannot execute. No thumb → the tool's icon as a stub.
export function sessionCard(s: PickerSession): string {
  const name = s.toolName ?? s.toolId;
  return `
    <button type="button" class="asset-picker-card asset-picker-sessitem" data-session-slot="${escapeHtml(s.slot)}" title="${escapeHtml(name)}">
      ${sessionThumb(s.thumb, s.toolIcon)}
      <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <span class="asset-picker-sessitem-when">${escapeHtml(relTimeAt(s.updatedAt, Date.now(), t))}</span>
    </button>
  `;
}

export function sessionThumb(thumb: string | null, iconSvg: string | null): string {
  if (typeof thumb === 'string' && thumb) {
    if (thumb.startsWith('data:')) {
      return `<img class="asset-picker-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`;
    }
    if (/^\s*<(\?xml|svg)/i.test(thumb)) {
      return `<img class="asset-picker-thumb" src="${escapeHtml(svgDataUrl(thumb))}" alt="" loading="lazy" decoding="async">`;
    }
  }
  return `<span class="asset-picker-thumb asset-picker-thumb-stub asset-picker-thumb-icon" aria-hidden="true">${iconSvg ?? ''}</span>`;
}

/** One tab in the picker's source strip. Roving tabindex: only the selected tab is in
 *  the page Tab sequence; the rest are reached with Arrow keys (picker.ts wires that
 *  through lib/tabs.ts). */
export function tabButtonHtml(tab: { id: string; label: string }, activeTab: string): string {
  const on = tab.id === activeTab;
  return `<button type="button" id="asset-picker-tab-${tab.id}" class="asset-picker-tab${on ? ' is-active' : ''}" role="tab" data-tab="${tab.id}" aria-selected="${on}" aria-controls="asset-picker-pane-${tab.id}" tabindex="${on ? '0' : '-1'}">${escapeHtml(t(tab.label))}</button>`;
}

/** The search field's placeholder for the pane on show, so it never promises a search
 *  the visible pane does not do. */
export function paneSearchPlaceholder(id: string, allowToolUrl: boolean): string {
  if (id === 'templates') return t('Search templates…');
  if (id === 'tools') return t('Search tools…');
  if (id === 'sessions') return t('Search your saved creations…');
  if (id === 'projects') return t('Search your projects…');
  if (id === 'uploads') return t('Search your private assets…');
  return allowToolUrl ? t('Search, or paste a Lolly link…') : t('Search…');
}

/** The Tools pane for one query: the head counts the whole set, the grid shows matches. */
export function toolsPaneHtml(list: readonly PickerTool[], total: number, collect: boolean): string {
  if (!list.length) return `<p class="asset-picker-empty">${t('No tools match.')}</p>`;
  const head = collect ? t('Start a new creation from a tool') : t('Make an image from a tool');
  return `<div class="asset-picker-section-head">${head} <span class="asset-picker-count">${total}</span></div>`
    + `<div class="asset-picker-grid asset-picker-toolgrid">${list.map(tool => toolCard(tool, collect)).join('')}</div>`;
}
