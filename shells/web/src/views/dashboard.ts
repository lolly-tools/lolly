// SPDX-License-Identifier: MPL-2.0
/**
 * Device, design system, capabilities and activity sections within Settings.
 * The former #/d and #/dashboard routes still mount this renderer. Personal
 * preferences use the profile renderer, with the same heading and navigation.
 *
 * Four tabs, one panel each. The Design system tab is a read of the active
 * design system, rendered by views/dashboard/brand.ts: a cover in the system's
 * own look, then a page each for its colour, type, logos, colourways, tokens
 * and print reference, refreshed in place when the active system changes.
 * Editing lives at #/start. This device holds the live machine readout, sound
 * and storage; Capabilities holds the searchable capability map; Activity holds
 * the catalogue summary and the person's own counters, sessions and exports.
 * Apart from the sound switch and the design-system switch, everything here is
 * a snapshot of what this session currently knows.
 *
 * Data sources (single sources of truth, imported, never duplicated):
 *   design system → views/dashboard/brand.ts (lib/design-system/issue-model.ts
 *                   over host.tokens and lib/live-palette.ts)
 *   device        → lib/device-info.ts        (live session snapshot)
 *   activity      → metrics.ts + lib/activity-summary.ts
 *   storage       → navigator.storage + host.state / host.assets measurers
 *   catalogue     → window.__toolIndex + /catalog/assets/index.json
 *   caps          → lib/capabilities-data.ts
 */

import { bindDisclosureUrl, updateRouteParams } from '../lib/url-state.ts';
import '../styles/parts/platform.css'; // shared dashboard chrome (.plat-* / .cap-*)
import '../styles/parts/dashboard.css'; // this view's layout + signature pieces
import { escape } from '../utils.ts';
import { t, tRaw, loadNamespace } from '../i18n.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { armViewEnter } from '../view-enter.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { icon } from '../lib/icons.ts';
import { createRecentStack } from '../lib/recent-stack.ts';
import { catalogSummaryBody, hydrateCatalogAssets } from '../lib/catalog-summary.ts';
import type { CatalogTool } from '../lib/catalog-summary.ts';
import { currentTheme } from '../theme.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { getMetrics } from '../metrics.ts';
import { renderActivity } from '../lib/activity-summary.ts';
import { collectDevice, renderDeviceCards, renderDeviceStat, wireDeviceLive, fmtBytes } from '../lib/device-info.ts';
import { settingsNavHtml, wireSettingsNav } from '../components/settings-nav.ts';
import { soundSwitchHtml, wireSoundSwitch } from '../components/sound-toggle.ts';
import type { ExportEntry } from '../lib/export-history.ts';
import { attachDropRouter } from '../lib/drop-router.ts';
import type { PickerHost } from './picker.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
// The deep-link destination registry (plans/99 M2): every section's data-flag
// keyword set lives THERE, interpolated here via dashFlag(), never as a string
// literal in this file, so the spotlight settings provider and applyDeepLink
// read the same single source (dashboard-registry.test.ts pins it both ways).
import { DASH_SECTIONS, dashFlag } from '../lib/dashboard-registry.ts';
import { brandPanelHtml, mountBrandPanel, readBrandPanelInput } from './dashboard/brand.ts';

/** A compact personal shelf needs the catalogue's display name when it has one, but the
 * lightweight dashboard index deliberately only promises the smaller CatalogTool shape. */
type ShelfTool = CatalogTool & { name?: string };

/**
 * The user-facing part of a tool id for older/slim catalogue records that do not carry a
 * display name. Kept pure so the Dashboard cannot accidentally link a stale favourite to
 * a tool the current catalogue no longer contains.
 */
export function favouriteShelfTools(tools: readonly ShelfTool[], favourites: ReadonlySet<string>): ShelfTool[] {
  return tools.filter((tool) => favourites.has(tool.id)).slice(0, 8);
}

export function shelfToolLabel(tool: ShelfTool): string {
  return tool.name?.trim() || tool.id.split('-').map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : '').join(' ');
}

// Chevron for a collapsible reference panel (rotates 90° when open via CSS).
const COLLAPSE_CHEV = `<svg class="plat-section-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
// The Capabilities search field's leading glyph - from the shared registry, not
// inlined (see the R3 guard in primitive-guards.test.ts). Sized in CSS off
// --a11y-fs like every other chrome icon, so no `size` is passed here.
const SEARCH_GLYPH = icon('search');

// ── Primary tabs ─────────────────────────────────────────────────────────────
// The dashboard splits into four tabbed panels. Every section keeps its own
// id / data-flag / classes, so all the existing wiring (the design system's
// logo files, device probe, storage, deep links) works unchanged whichever tab
// is showing. Inactive panels are `hidden`, not removed. The `key` doubles as
// the ?tab= deep-link value and the /b · /brand alias target (Design system).
const DASH_TAB_KEYS = new Set(DASH_SECTIONS.filter(section => !section.flag).map(section => section.tab));

// One tabpanel wrapper. Inactive panels stay in the DOM (so async hydration + live
// listeners keep resolving onto them) but are `hidden`.
function panel(key: string, active: string, inner: string): string {
  return `<section role="region" id="dpanel-${key}" class="dash-panel" data-dash-panel="${key}" aria-labelledby="settings-tab-${key}" tabindex="0"${key === active ? '' : ' hidden'}>${inner}</section>`;
}

// A collapsible primary section: the whole card folds to its title bar,
// reusing the reference-panel <details> chrome (.plat-section-summary /
// .plat-section-body handle the chevron rotation + padding). `iconSlot`/`chipsSlot` render
// EMPTY hooks (data-dash-collapse-icon/-chips) instead of real content: some
// callers' icon/facts are only known after an async client-side probe (see
// collectDevice()), so they hydrate in later exactly like the hero stats do.
function collapse(o: {
  id: string; title: string; body: string; desc?: string; flag?: string; open?: boolean; cls?: string;
  iconSlot?: boolean; chipsSlot?: boolean;
}): string {
  return `
    <details class="plat-section dash-collapse${o.cls ? ' ' + o.cls : ''}" id="${o.id}"${
      o.flag ? ` data-flag="${escape(o.flag)}"` : ''}${o.open === false ? '' : ' open'}>
      <summary class="plat-section-summary dash-collapse-summary">
        ${o.iconSlot ? `<span class="dash-collapse-icon" data-dash-collapse-icon aria-hidden="true"></span>` : ''}
        <h2 class="plat-section-title" id="${o.id}-h">${escape(o.title)}</h2>
        ${o.chipsSlot ? `<span class="dash-collapse-chips" data-dash-collapse-chips></span>` : ''}
        ${COLLAPSE_CHEV}
      </summary>
      <div class="plat-section-body">
        ${o.desc ? `<p class="plat-section-desc dash-collapse-desc">${o.desc}</p>` : ''}
        ${o.body}
      </div>
    </details>`;
}

// Section heading + optional deep-link anchor. Sections here are NOT collapsible
// (the reference panels at the foot are); the label rides above the content.
function sectionHead(title: string, id: string, desc = ''): string {
  return `<div class="dash-sec-head"><h2 id="${id}" class="dash-sec-title">${escape(title)}</h2>${
    desc ? `<p class="dash-sec-desc">${desc}</p>` : ''
  }</div>`;
}

// ── Capabilities: grouped; each card POPS its detail open in a dialog ────────
// A card is a button that opens the shared dialog with its feature list,
// instead of an inline <details> that reflows the whole section as it
// expands. The detail markup rides in a sibling <template> (inert until
// cloned into the popup on click).
// Every string on a card comes from lib/capabilities-data.ts, so its t() keys
// are DYNAMIC: they aren't picked up by scripts/translate.ts's
// literal-call-site scan. They're translated by that script's own `caps`
// corpus (which reads the data module directly) into the lazily-loaded
// `caps` namespace, merged into the catalog by the loadNamespace('caps')
// below. A feature's `desc` carries authored inline HTML, so it stays raw;
// its translation preserves the same tags (the pipeline validates that).
function capCard(card: { icon: string; title: string; features: Array<{ name: string; desc: string }>; keywords?: string; shot?: string; shotExt?: 'png' }): string {
  // The modal detail (full feature list) rides in an inert <template>.
  const feats = `<dl class="cap-feat dash-cap-feat">${
    card.features.map((f) => `<div><dt>${escape(t(f.name))}</dt><dd>${t(f.desc)}</dd></div>`).join('')
  }</dl>`;
  // A tiny SUSE-Mono sneak of the subheadings you'll see in the modal.
  const peek = `<ul class="dash-cap-peek" aria-hidden="true">${
    card.features.map((f) => `<li>${escape(t(f.name))}</li>`).join('')
  }</ul>`;
  // The search haystack, built HERE instead of scraped from the DOM at wire
  // time: the feature descriptions live in an inert <template> whose text a
  // querySelector sweep would have to clone to read, and the untranslated
  // `keywords` have no rendered home at all. Lowercased once at build so the
  // filter is a plain substring test per keystroke. Descriptions are
  // stripped of their inline tags, or a search for "code" would match every
  // <code> element on the page.
  const haystack = [
    t(card.title),
    ...card.features.map((f) => `${t(f.name)} ${t(f.desc)}`),
    card.keywords ?? '',
  ].join(' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  // The shot is NOT rendered here - only carried on the item, so the dialog can
  // build an <img> at open time. A 264px card has no room for a screenshot, and
  // eagerly emitting ~45 <img> tags would fetch ~45 SVGs for a panel where most
  // are never opened. One image, on demand, for the card you actually clicked.
  const shotAttr = card.shot
    ? ` data-cap-shot="${escape(card.shot)}"${card.shotExt ? ` data-cap-shot-ext="${escape(card.shotExt)}"` : ''}`
    : '';
  return `
    <div class="dash-cap-item" data-cap-hay="${escape(haystack)}"${shotAttr}>
      <button type="button" class="dash-cap-card" data-cap-open aria-haspopup="dialog"
              aria-label="${escape(card.features.length === 1 ? tRaw('{title} - 1 detail', { title: t(card.title) }) : tRaw('{title} - {n} details', { title: t(card.title), n: card.features.length }))}">

        <span class="dash-cap-card-top">
          <span class="dash-cap-icon" aria-hidden="true">${card.icon}</span>
          <span class="dash-cap-title">${escape(t(card.title))}</span>
        </span>
        ${peek}
        <span class="dash-cap-foot">
          <span class="dash-cap-n">${card.features.length}</span>
          <span class="dash-cap-more" aria-hidden="true">${t('View')} →</span>
        </span>
      </button>
      <template class="dash-cap-detail">${feats}</template>
    </div>`;
}

async function capabilitiesSection(): Promise<string> {
  // The copy and its translations load together: the data module and the
  // `caps` string namespace it's keyed by. Both are lazy: this panel is one
  // tab of one view, and its ~300 prose strings have no business in the boot
  // bundle.
  const [{ visibleCapabilitySections }] = await Promise.all([
    import('../lib/capabilities-data.ts'),
    loadNamespace('caps'),
  ]);
  // Each group is its own collapsible accordion panel - the section desc stays
  // visible in the summary as a table-of-contents, and the card grid expands below.
  // The first opens by default; the rest are folded so the whole map is scannable
  // at a glance. data-dash-collapse wires the shared fold sound cue.
  // A section's summary also carries its card count: the folded state otherwise
  // gives no clue whether opening it reveals one card or eight.
  const sections = visibleCapabilitySections();
  const groups = sections.map((s, idx) => `
    <details class="dash-cap-group" id="${s.id}" data-flag="${escape(s.flag)}"${idx === 0 ? ' open' : ''}>
      <summary class="dash-cap-group-head">
        <span class="dash-cap-group-icon" aria-hidden="true">${s.icon}</span>
        <div class="dash-cap-group-text">
          <h3 class="dash-cap-group-title">${escape(t(s.title))}<span class="dash-cap-group-n">${s.cards.length}</span></h3>
          <p class="dash-cap-group-desc">${escape(t(s.desc))}</p>
        </div>
        ${COLLAPSE_CHEV}
      </summary>
      <div class="dash-cap-grid">${s.cards.map(capCard).join('')}</div>
    </details>`).join('');
  // Search. This map is long by design (eleven sections, ~60 cards), so the
  // one thing it must not require is reading it top to bottom to find "does
  // this do CMYK". The field filters cards live and force-opens whichever
  // sections still hold a match, so a query turns the accordion into a flat
  // result list.
  //
  // It is deliberately NOT wrapped in a <form>: an Enter keypress inside a
  // lone text input in a form triggers implicit submission and would reload
  // the view.
  const totalCards = sections.reduce((n, s) => n + s.cards.length, 0);
  const search = `
      <div class="dash-cap-search">
        <span class="dash-cap-search-icon" aria-hidden="true">${SEARCH_GLYPH}</span>
        <input type="search" class="dash-cap-search-input" data-cap-search
               autocomplete="off" spellcheck="false"
               aria-controls="dash-cap-results"
               placeholder="${escape(t('Search {n} capabilities - try “cmyk”, “figma”, “offline”', { n: totalCards }))}"
               aria-label="${escape(t('Search capabilities'))}">
        <button type="button" class="dash-cap-search-clear" data-cap-search-clear hidden
                aria-label="${escape(t('Clear search'))}">✕</button>
      </div>
      <p class="dash-cap-count" id="dash-cap-results" data-cap-count role="status" aria-live="polite" hidden></p>`;
  // Shown only when a query matches nothing - an accordion of collapsed, empty
  // sections reads as "broken", so report it in words.
  const empty = `
      <p class="dash-cap-empty" data-cap-empty hidden>${escape(t('Nothing matches that. Try a format (“svg”, “pptx”), a task (“print”, “share”) or a tool name.'))}</p>`;
  // The dialog is two-pane on a wide screen: the screenshot carries the left
  // (the thing being described), the feature list the right (what is true
  // about it). On a card with no shot the figure is removed entirely and the
  // dialog narrows to a single reading column: an empty pane would be worse
  // than none.
  const modal = `
      <dialog class="dash-cap-modal" data-cap-modal>
        <div class="dash-cap-modal-card">
          <header class="dash-cap-modal-head">
            <span class="dash-cap-modal-icon" data-cap-modal-icon aria-hidden="true"></span>
            <h3 class="dash-cap-modal-title" data-cap-modal-title></h3>
            <button type="button" class="dash-cap-modal-close" data-cap-modal-close aria-label="${escape(t('Close'))}">✕</button>
          </header>
          <div class="dash-cap-modal-panes">
            <figure class="dash-cap-modal-shot" data-cap-modal-shot hidden>
              <!-- NOT loading="lazy": the src is only set when a card is opened, so
                   there is nothing to defer, and deferring left the pane visibly
                   blank for a beat after the dialog appeared. -->
              <img data-cap-modal-img alt="" decoding="async">
              <figcaption>${escape(t('Screenshot of the app, captured as signed vector'))}</figcaption>
            </figure>
            <div class="dash-cap-modal-body" data-cap-modal-body></div>
          </div>
        </div>
      </dialog>`;
  return collapse({
    id: 'dash-caps',
    title: t('What Lolly can do'),
    desc: t('Every capability, stated as a fact you can check - formats by name, limits included. Search it, or open a section. Pick any card for its detail.'),
    body: `${search}${groups}${empty}${modal}`,
  });
}

// ── Storage glance (read-only mirror of the Profile meter) ──────────────────
type DashHost = HostV1 & {
  state: HostV1['state'] & { sizes?: () => Promise<Record<string, number>> };
  assets: HostV1['assets'] & {
    _blobCacheSize?: () => Promise<number>;
    _userAssetsSize?: () => Promise<number>;
  };
  previews?: { size?: () => Promise<number>; list?: () => Promise<Array<{ thumb?: { length?: number } }>> };
};

interface StorageSlice { label: string; bytes: number; key: string; }
interface StorageGlance {
  slices: StorageSlice[];
  other: number;
  total: number;
  usage: number | null;
  quota: number | null;
  sessions: number;
}

async function measureStorage(host: DashHost): Promise<StorageGlance> {
  const estP = navigator.storage?.estimate ? navigator.storage.estimate().catch(() => null) : Promise.resolve(null);
  const [estimate, sessionSizes, sessionList, imagesBytes, cacheBytes, previewBytes] = await Promise.all([
    estP,
    host.state.sizes?.().catch(() => ({} as Record<string, number>)) ?? Promise.resolve({} as Record<string, number>),
    host.state.list().catch(() => [] as Array<unknown>),
    host.assets._userAssetsSize?.().catch(() => 0) ?? Promise.resolve(0),
    host.assets._blobCacheSize?.().catch(() => 0) ?? Promise.resolve(0),
    host.previews?.size?.().catch(() => 0) ?? Promise.resolve(0),
  ]);
  const sessBytes = Object.values(sessionSizes).reduce((s, n) => s + (n || 0), 0);
  const slices: StorageSlice[] = [
    { label: t('Saved sessions'), bytes: sessBytes, key: 'sessions' },
    { label: t('My images'), bytes: imagesBytes, key: 'images' },
    { label: t('Asset cache'), bytes: cacheBytes, key: 'cache' },
    { label: t('Tool previews'), bytes: previewBytes, key: 'previews' },
  ].filter((s) => s.bytes > 0);
  const measured = slices.reduce((s, x) => s + x.bytes, 0);
  const hasEstimate = !!(estimate && estimate.usage != null);
  const usage = hasEstimate ? estimate!.usage! : null;
  const quota = (estimate && estimate.quota) || null;
  const overshoot = hasEstimate && measured > usage!;
  const other = hasEstimate && !overshoot ? Math.max(0, usage! - measured) : 0;
  const total = hasEstimate ? Math.max(usage!, measured) : measured;
  return { slices, other, total, usage, quota, sessions: sessionList.length };
}

// A rounded-cap stroke-ring: the used fraction of the device budget, drawn as an arc so
// even a near-empty disk shows a small nub. Used amount + total sit in the hub.
function storeDonut(usedBytes: number, quotaBytes: number): string {
  const R = 52, C = 2 * Math.PI * R;
  const frac = quotaBytes > 0 ? Math.min(1, usedBytes / quotaBytes) : 0;
  const arc = frac > 0 ? Math.max(frac * C, 4) : 0;   // a visible minimum when anything's used
  const pct = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
  const pctLabel = pct <= 0 ? '0%' : pct < 0.1 ? '<0.1%' : pct < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
  return `
    <div class="dash-store-donut" role="img" aria-label="${escape(tRaw('{used} used of {quota} ({pct})', { used: fmtBytes(usedBytes), quota: fmtBytes(quotaBytes), pct: pctLabel }))}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="dash-donut-track" cx="60" cy="60" r="${R}" fill="none" stroke-width="11"></circle>
        <circle class="dash-donut-arc" cx="60" cy="60" r="${R}" fill="none" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${arc.toFixed(1)} ${(C - arc).toFixed(1)}" transform="rotate(-90 60 60)"></circle>
      </svg>
      <div class="dash-store-donut-c">
        <strong>${escape(fmtBytes(usedBytes))}</strong>
        <span>${t('of {quota}', { quota: fmtBytes(quotaBytes) })}</span>
        <em>${tRaw('{pct} used', { pct: pctLabel })}</em>
      </div>
    </div>`;
}

function renderStorageGlance(m: StorageGlance): string {
  const segs = [...m.slices];
  if (m.other > 0) segs.push({ label: t('Other app data'), bytes: m.other, key: 'other' });
  const denom = m.total || 1;
  const bar = segs.map((s) => `<span class="dash-store-seg dash-store-seg--${s.key}" style="flex:${Math.max(0.5, (s.bytes / denom) * 100)}" title="${escape(s.label)} - ${escape(fmtBytes(s.bytes))}"></span>`).join('');
  const legend = segs.map((s) => `<span class="dash-store-key"><span class="dash-store-dot dash-store-seg--${s.key}"></span>${escape(s.label)}<strong>${escape(fmtBytes(s.bytes))}</strong></span>`).join('');
  // The ring headlines used-vs-budget when the browser reports a quota; otherwise a plain
  // measured line (some browsers withhold an estimate).
  const hero = m.usage != null && m.quota
    ? storeDonut(m.total, m.quota)
    : `<p class="dash-store-headline">${isTauriShell() ? t('<strong>{n}</strong> measured on this device', { n: fmtBytes(m.total) }) : t('<strong>{n}</strong> measured in this browser', { n: fmtBytes(m.total) })}</p>`;
  return `
    ${hero}
    <div class="dash-store-bar" role="img" aria-label="${escape(tRaw('Storage composition: {list}', { list: segs.map((s) => `${s.label} ${fmtBytes(s.bytes)}`).join(', ') }))}">${bar || '<span class="dash-store-seg dash-store-seg--other" style="flex:1"></span>'}</div>
    <div class="dash-store-legend">${legend}</div>
    <p class="dash-store-note">${tRaw('A read-only view - manage or clear it in your {link}. Nothing is uploaded.', { link: `<a href="#/settings?focus=storage-section">${t('Preferences')}</a>` })}</p>`;
}

// ────────────────────────────────────────────────────────────────────────────

export async function mountDashboard(viewEl: HTMLElement, host: HostV1, routeParams?: string): Promise<void> {
  document.title = `${t('Settings')} - Lolly`;

  // Deep links: `#/d?print`, `#/d?formats`, ... force-open a reference panel
  // or a capability group and scroll to it. The router hands its parsed query
  // through like every other view (plan 171); the hash re-parse stays as the
  // fallback for any direct caller. `?tab=<key>` picks the starting tab (the
  // /b - /brand aliases land here as ?tab=brand); it is NOT a section flag,
  // so keep it out of the flag set.
  const params = new URLSearchParams(routeParams ?? (window.location.hash.split('?')[1] || ''));
  const flags = new Set([...params.keys()].filter((k) => k !== 'tab'));
  const tabParam = params.get('tab') ?? '';
  // Design System is the landing tab: the brand is what people come here to
  // set; ?tab=<key> (and the deep-link handler) override it.
  const initialTab = DASH_TAB_KEYS.has(tabParam) ? tabParam : 'brand';

  const tools = (window as Window & { __toolIndex?: { tools: CatalogTool[] } }).__toolIndex?.tools ?? [];
  const toolCount = tools.length;
  const metrics = getMetrics();

  // The capability map and the design system's read land together, so the
  // tab waits for the slower of the two and no longer.
  const [capsHtml, brandInput] = await Promise.all([capabilitiesSection(), readBrandPanelInput(host)]);

  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    ${settingsNavHtml(initialTab)}
    <div class="dash-layout">
      <div class="dash-panels" data-reveal-sound="off">
        ${panel('device', initialTab, `
          <div class="dash-device-grid">
            <div class="dash-device-col">
              ${collapse({
                id: 'dash-device',
                flag: dashFlag('dash-device'),
                title: t('This Machine'),
                cls: 'dash-device',
                open: false,
                iconSlot: true,
                chipsSlot: true,
                desc: t('A live snapshot of the browser and machine this session runs on. Read on the fly; nothing is stored or sent anywhere.'),
                body: `
                  <div class="dash-dev-hero" data-dev-hero>
                    ${Array.from({ length: 6 }, () => `<div class="dash-dev-stat is-skeleton"></div>`).join('')}
                  </div>
                  <div class="dash-dev-split"><span>${t('Full readout')}</span></div>
                  <div class="plat-client-grid dash-dev-cards" data-client-grid></div>`,
              })}
            </div>
            <div class="dash-bento">
              ${collapse({
                id: 'dash-sound',
                flag: dashFlag('dash-sound'),
                title: t('Sound'),
                cls: 'dash-card dash-sound',
                desc: t('Interface sounds and Neurospicy focus loops - set them here; the choice follows you across the app.'),
                body: `<div class="dash-sound-mount" data-sound-mount>${soundSwitchHtml()}</div>`,
              })}
              ${collapse({
                id: 'dash-storage',
                flag: dashFlag('dash-storage'),
                title: t('Storage'),
                cls: 'dash-card',
                desc: isTauriShell() ? t('What Lolly is keeping on this device.') : t('What Lolly is keeping in this browser.'),
                body: `<div class="dash-store" data-store><p class="cat-empty">${t('measuring…')}</p></div>`,
              })}
            </div>
          </div>
        `)}

        ${panel('brand', initialTab, brandPanelHtml(brandInput))}

        ${panel('caps', initialTab, capsHtml)}

        ${panel('activity', initialTab, `
          <div class="dash-bento">
            <div class="plat-stats">
              <span class="plat-stat" data-tool-count${toolCount ? '' : ' hidden'}><strong>${escape(String(toolCount || ''))}</strong>${t('tools')}</span>
              <span class="plat-stat"><strong>40</strong>${t('export formats')}</span>
              <span class="plat-stat"><strong>6</strong>${t('surfaces')}</span>
              <span class="plat-stat" data-asset-stat hidden><strong data-asset-stat-n></strong>${t('brand assets')}</span>
            </div>
            ${collapse({
              id: 'dash-catalogue',
              flag: dashFlag('dash-catalogue'),
              title: t('Catalogue'),
              desc: t('What ships in this build, synced to clients as data.'),
              body: catalogSummaryBody(tools),
            })}
            <section class="plat-section dash-section dash-card" id="dash-activity" data-flag="${escape(dashFlag('dash-activity'))}">
              ${sectionHead(t('Your activity'), 'dash-activity-h', t('Local-only counters - nothing here is recorded remotely.'))}
              <div class="dash-activity">${renderActivity(metrics, tools as Array<{ id: string } & Record<string, unknown>>)}</div>
            </section>
            <section class="plat-section dash-section dash-card dash-yours" id="dash-yours" hidden>
              ${sectionHead(t('Yours'), 'dash-yours-h', t('Your starred tools, ready to pick up where you left off. Recent creations and exports stay below.'))}
              <div class="dash-yours-tools" data-yours-tools></div>
            </section>
            <section class="plat-section dash-section dash-card dash-recent" id="dash-recent" data-flag="${escape(dashFlag('dash-recent'))}" hidden>
              ${sectionHead(t('Recent creations'), 'dash-recent-h', t('Your latest saved sessions - swipe the stack to browse, or use Open below.'))}
              <div class="dash-recent-mount" data-recent-stack></div>
            </section>
            <section class="plat-section dash-section dash-card dash-recent" id="dash-exports" data-flag="${escape(dashFlag('dash-exports'))}" hidden>
              ${sectionHead(t('Latest exports'), 'dash-exports-h', t('Files you downloaded - swipe through, or use Open below to reopen one exactly as it was.'))}
              <div class="dash-recent-mount" data-exports-stack></div>
            </section>
          </div>
        `)}
      </div>
    </div>`;

  // Include the read-only foot note and the Design system tab's strip, cover and
  // pages in the reveal ladder so they settle in with the other sections
  // instead of snapping in at full opacity beneath the cascade.
  armViewEnter(viewEl, '.tools-home, .settings-header, .plat-section, .dash-foot, .ds-strip, .ds-issue-cover, .ds-issue-page');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  // The Design system tab reads the active system; a theme flip here checks it
  // in light, dark and brand without a trip to the profile.
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  // Universal drop front door: the same scoped router as the gallery (design
  // to Design, PDF to import/compress, media to library or /verify). Torn
  // down on navigation; the cast is erased (the concrete web host carries the
  // picker's upload surface).
  attachDropRouter(viewEl, host as unknown as PickerHost);

  // "This device" starts collapsed (the server-rendered default, above)
  // everywhere, then opens itself right away when the tab actually lays out
  // as two columns (≥900px, matching .dash-device-grid's breakpoint in
  // dashboard.css). There's room to just show it there, whereas mobile's
  // single column wants everything folded by default. Runs before the
  // live device listeners below are attached.
  const deviceDetails = viewEl.querySelector<HTMLDetailsElement>('#dash-device');
  if (deviceDetails && window.matchMedia('(min-width: 900px)').matches) deviceDetails.open = true;

  bindDisclosureUrl(viewEl, params);
  wireSettingsNav(viewEl);
  // Deep links select their owning panel and the matching navigation link.
  const dashPanels = [...viewEl.querySelectorAll<HTMLElement>('[data-dash-panel]')];
  const selectTab = (key: string): void => {
    for (const panel of dashPanels) panel.hidden = panel.dataset.dashPanel !== key;
    for (const link of viewEl.querySelectorAll<HTMLElement>('[data-settings-tab]')) {
      if (link.dataset.settingsTab === key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };
  selectTab(initialTab);

  // The Design system tab: copy, contents links, the logo files after first
  // paint, and an in-place refresh when the active design system changes.
  const brand = mountBrandPanel(viewEl.querySelector<HTMLElement>('[data-dash-panel="brand"]')!, host, brandInput);
  {
    const prev = (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup;
    (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { prev?.(); brand.teardown(); };
  }

  // Deep-link: switch to the owning tab, then open + scroll to any panel/group
  // whose flag is in the hash query.
  if (flags.size) applyDeepLink(viewEl, flags, selectTab);

  // The Sound box drives the real sfx + Neurospicy state (self-contained control).
  wireSoundSwitch(viewEl, host as unknown as Parameters<typeof wireSoundSwitch>[1]);

  // Capability cards POP their detail into a shared dialog (no inline reflow). Each card
  // clones its sibling <template>; the native <dialog> gives Esc-to-close + backdrop.
  const capModal = viewEl.querySelector<HTMLDialogElement>('[data-cap-modal]');
  if (capModal) {
    const mIcon = capModal.querySelector<HTMLElement>('[data-cap-modal-icon]')!;
    const mTitle = capModal.querySelector<HTMLElement>('[data-cap-modal-title]')!;
    const mBody = capModal.querySelector<HTMLElement>('[data-cap-modal-body]')!;
    const mShot = capModal.querySelector<HTMLElement>('[data-cap-modal-shot]');
    const mImg = capModal.querySelector<HTMLImageElement>('[data-cap-modal-img]');
    const close = () => { if (typeof capModal.close === 'function') capModal.close(); else capModal.removeAttribute('open'); };
    viewEl.querySelectorAll<HTMLButtonElement>('[data-cap-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.dash-cap-item');
        const tpl = item?.querySelector<HTMLTemplateElement>('template.dash-cap-detail');
        if (!tpl) return;
        const title = btn.querySelector('.dash-cap-title')?.textContent ?? '';
        mIcon.innerHTML = btn.querySelector('.dash-cap-icon')?.innerHTML ?? '';
        mTitle.textContent = title;
        mBody.replaceChildren(tpl.content.cloneNode(true));
        // The screenshot, only for cards that name one. `src` is set per open
        // (and cleared on the way out) so the dialog can never show the previous
        // card's picture for the instant before a new one decodes.
        const slug = (item as HTMLElement | null)?.dataset.capShot;
        // Nearly every baseline is vector; the few RASTER_ALLOWED shots declare
        // their extension on the card (data-cap-shot-ext).
        const shotExt = (item as HTMLElement | null)?.dataset.capShotExt || 'svg';
        if (mShot && mImg) {
          mShot.classList.remove('is-dark-shot');
          if (slug) {
            const light = `/info/shots/${slug}.${shotExt}`;
            // Under any non-light theme (dark, brand) prefer the dark twin
            // the docs pipeline captured, `<slug>.dark.svg`. Not every shot
            // has one (a light-only recipe like auth-url-render, whose bare
            // canvas has no chrome to theme), so a one-shot onerror falls
            // back to the light file, which also flips the frame pad back,
            // so a light image is never left sitting on the dark pad meant
            // for a dark capture.
            mImg.onerror = () => {
              mImg.onerror = null;
              mShot.classList.remove('is-dark-shot');
              mImg.src = light;
            };
            if (currentTheme() !== 'light') {
              mShot.classList.add('is-dark-shot');
              mImg.src = `/info/shots/${slug}.dark.${shotExt}`;
            } else {
              mImg.onerror = null;
              mImg.src = light;
            }
            // The shot illustrates prose that is right beside it, so a described
            // alt would be read twice. Name what it is, and let the list speak.
            mImg.alt = t('{title} - screenshot', { title });
            mShot.hidden = false;
          } else {
            mImg.onerror = null;
            mImg.removeAttribute('src');
            mShot.hidden = true;
          }
          capModal.classList.toggle('has-shot', Boolean(slug));
        }
        if (typeof capModal.showModal === 'function') capModal.showModal(); else capModal.setAttribute('open', '');
      });
    });
    capModal.querySelector('[data-cap-modal-close]')?.addEventListener('click', close);
    capModal.addEventListener('click', (e) => { if (e.target === capModal) close(); }); // backdrop click
  }

  // ── Capabilities search ───────────────────────────────────────────────────
  // Filters the cards live and force-opens the sections that still hold a
  // match, so a query flattens the accordion into a result list. Every
  // card's haystack was baked into data-cap-hay at render time (see
  // capCard), including the untranslated `keywords` and the feature prose
  // that otherwise only exists inside an inert <template>, so a keystroke
  // costs one substring test per card and never touches a template's content.
  const capSearch = viewEl.querySelector<HTMLInputElement>('[data-cap-search]');
  if (capSearch) {
    const groups = [...viewEl.querySelectorAll<HTMLDetailsElement>('.dash-cap-group')];
    const countEl = viewEl.querySelector<HTMLElement>('[data-cap-count]');
    const emptyEl = viewEl.querySelector<HTMLElement>('[data-cap-empty]');
    const clearBtn = viewEl.querySelector<HTMLButtonElement>('[data-cap-search-clear]');
    // The fold state to restore when the query is cleared, captured once at
    // wire time. Without this, clearing a search would leave every section
    // hanging open, the user's own folding silently replaced by the filter's.
    const wasOpen = new Map(groups.map((g) => [g, g.open]));

    const apply = (raw: string): void => {
      // Multi-word queries are AND-ed, so "print pdf" narrows instead of widening.
      const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
      const active = terms.length > 0;
      let hits = 0;
      for (const group of groups) {
        // A section's own title and description are part of its cards' scope:
        // matching "print production" should surface the whole section, not
        // require the word to also appear on each card inside it.
        const head = (group.querySelector('.dash-cap-group-text')?.textContent ?? '').toLowerCase();
        let shown = 0;
        for (const item of group.querySelectorAll<HTMLElement>('.dash-cap-item')) {
          const hay = `${item.dataset.capHay ?? ''} ${head}`;
          const match = !active || terms.every((term) => hay.includes(term));
          item.hidden = !match;
          if (match) shown++;
        }
        hits += shown;
        group.hidden = active && shown === 0;
        // Only drive the fold while filtering; on clear, hand it back untouched.
        if (active) group.open = shown > 0;
        else group.open = wasOpen.get(group) ?? false;
      }
      if (countEl) {
        countEl.hidden = !active;
        countEl.textContent = active
          ? (hits === 1 ? t('1 capability matches') : t('{n} capabilities match', { n: hits }))
          : '';
      }
      if (emptyEl) emptyEl.hidden = !(active && hits === 0);
      if (clearBtn) clearBtn.hidden = !active;
    };

    capSearch.value = params.get('q') ?? '';
    apply(capSearch.value);
    capSearch.addEventListener('input', () => { apply(capSearch.value); updateRouteParams({ q: capSearch.value || null }); });
    // Esc clears instead of closing anything: the field is inside a
    // <dialog>-free panel, so the key is free, and a filtered page with no
    // visible way back is the trap this avoids.
    capSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && capSearch.value) { e.stopPropagation(); capSearch.value = ''; apply(''); updateRouteParams({ q: null }); }
    });
    clearBtn?.addEventListener('click', () => { capSearch.value = ''; apply(''); updateRouteParams({ q: null }); capSearch.focus(); });
  }

  // Build-up: the capability cards start hidden and float in, staggered,
  // when their grid scrolls into view. Opt-in via [data-build] so that
  // WITHOUT this JS (or under reduced-motion) the cards are simply visible,
  // never a blank grid.
  const reduceMotion = prefersReducedMotion();
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) continue;
        ent.target.classList.add('is-in');
        obs.unobserve(ent.target);
      }
    }, { threshold: 0.12 });
    viewEl.querySelectorAll<HTMLElement>('.dash-cap-grid').forEach((grid) => {
      grid.dataset.build = '';
      grid.querySelectorAll<HTMLElement>('.dash-cap-item').forEach((item, i) => { item.style.setProperty('--i', String(i)); });
      io.observe(grid);
    });
    // Disconnect on unmount so a superseded dashboard's observer doesn't linger.
    // Composes with wireLive's later _cleanup chain (captures the current hook as prev).
    const prev = (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup;
    (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { prev?.(); io.disconnect(); };
  }

  // ── Deferred hydration ────────────────────────────────────────────────────
  // Fill the pieces kept off the first-paint path (device probe + a network
  // round-trip for assets + storage measurers). Guarded by a per-mount token
  // so a stale fill from a superseded same-view remount can't wire onto the
  // current one.
  const mountEl = viewEl as HTMLElement & { _dashMount?: number };
  const myMount = (mountEl._dashMount = (mountEl._dashMount || 0) + 1);
  const isCurrent = <T extends Element>(node: T | null): node is T =>
    mountEl._dashMount === myMount && !!node && viewEl.contains(node);

  // “Yours” is deliberately earned rather than a cold-start empty state: after someone
  // has opened a few tools, their explicit stars become the fastest route back into work.
  // Recent sessions and exports are independent shelves below, so a favourite remains
  // useful even before it has a saved render thumbnail.
  host.profile.get()
    .then((profile) => {
      if (metrics.toolOpens < 3) return;
      const favourites = new Set(Array.isArray(profile.favourites) ? profile.favourites.filter((id): id is string => typeof id === 'string') : []);
      const mine = favouriteShelfTools(tools as ShelfTool[], favourites);
      const sec = viewEl.querySelector<HTMLElement>('#dash-yours');
      const mount = viewEl.querySelector<HTMLElement>('[data-yours-tools]');
      if (!isCurrent(mount) || !sec || !mine.length) return;
      mount.innerHTML = mine.map((tool) =>
        `<a class="dash-yours-tool" href="#/tool/${encodeURIComponent(tool.id)}">${icon('star')}<span>${escape(shelfToolLabel(tool))}</span></a>`,
      ).join('');
      sec.hidden = false;
    })
    .catch(() => { /* no profile store - the Dashboard stays useful without this convenience */ });

  // Recent creations: reuse the session preview thumbnails the
  // Projects/gallery tiles already cache (host.state.list().thumb); no
  // re-render. Tool sessions only (they reopen cleanly via ?slot=), newest
  // first, into the interactive swipe stack.
  (host.state.list() as Promise<Array<{ slot: string; toolId?: string; label?: string; thumb?: string | null; updatedAt?: string }>>)
    .then((rows) => {
      const recent = rows
        .filter((r) => r.thumb && r.toolId)
        .sort((a, b) => +new Date(b.updatedAt || 0) - +new Date(a.updatedAt || 0))
        .slice(0, 12)
        .map((r) => ({ thumb: r.thumb!, label: r.label || r.toolId!, href: `#/tool/${r.toolId}?slot=${encodeURIComponent(r.slot)}` }));
      const sec = viewEl.querySelector<HTMLElement>('#dash-recent');
      const stackMount = viewEl.querySelector<HTMLElement>('[data-recent-stack]');
      if (isCurrent(stackMount) && sec && recent.length >= 2) {
        createRecentStack(stackMount, recent);
        sec.hidden = false;
      }
    })
    .catch(() => { /* no recent sessions - the section stays hidden */ });

  // Latest exports: the downloads log (export-history.ts), newest first,
  // into its own swipe stack. Distinct from Recent creations: these are
  // files you downloaded, not sessions you saved.
  import('../lib/export-history.ts')
    .then(({ listExports }) => listExports(12))
    .then((exports) => {
      const entries = exports.filter((e) => e.thumb);
      const items = entries
        .map((e) => ({ thumb: e.thumb!, label: e.filename || e.label, href: `#/tool/${e.toolId}${e.query ? '?' + e.query : ''}` }));
      const sec = viewEl.querySelector<HTMLElement>('#dash-exports');
      const stackMount = viewEl.querySelector<HTMLElement>('[data-exports-stack]');
      if (isCurrent(stackMount) && sec && items.length) {
        createRecentStack(stackMount, items);
        sec.hidden = false;
        wireExportShare(stackMount, entries, items.map((it) => it.href));
      }
    })
    .catch(() => { /* no exports yet - the section stays hidden */ });

  collectDevice()
    .then((snap) => {
      const hero = viewEl.querySelector<HTMLElement>('[data-dev-hero]');
      const grid = viewEl.querySelector<HTMLElement>('[data-client-grid]');
      if (isCurrent(hero)) {
        hero.innerHTML = snap.headline.map(renderDeviceStat).join('');
        hero.classList.add('plat-hydrated');
      }
      if (isCurrent(grid)) {
        grid.innerHTML = renderDeviceCards(snap.groups);
        grid.classList.add('plat-hydrated');
      }
      const iconSlot = viewEl.querySelector<HTMLElement>('#dash-device [data-dash-collapse-icon]');
      if (isCurrent(iconSlot)) iconSlot.innerHTML = snap.icon;
      const chipsSlot = viewEl.querySelector<HTMLElement>('#dash-device [data-dash-collapse-chips]');
      if (isCurrent(chipsSlot) && snap.chips.length) {
        chipsSlot.innerHTML = snap.chips.map((c) => `<span class="dash-chip">${escape(c)}</span>`).join('');
      }
      // Only wire the live rows if THIS mount is still the current one - a
      // superseded same-view remount whose probe resolves late must not attach a
      // second listener set (and re-chain _cleanup) onto the live mount's nodes.
      if (mountEl._dashMount === myMount) wireLive(viewEl); // [data-live] rows now exist
    })
    .catch(() => { /* device snapshot is best-effort */ });

  measureStorage(host as DashHost)
    .then((m) => {
      const box = viewEl.querySelector<HTMLElement>('[data-store]');
      if (!isCurrent(box)) return;
      box.innerHTML = renderStorageGlance(m);
      box.classList.add('plat-hydrated');
    })
    .catch(() => {
      const box = viewEl.querySelector<HTMLElement>('[data-store]');
      if (isCurrent(box)) box.innerHTML = `<p class="cat-empty">${t('unavailable')}</p>`;
    });

  if (mountEl._dashMount === myMount) {
    hydrateCatalogAssets(viewEl).then(() => {
      // Surface the asset total in the header stat strip too.
      const n = viewEl.querySelector<HTMLElement>('[data-asset-count]')?.textContent;
      const stat = viewEl.querySelector<HTMLElement>('[data-asset-stat]');
      const nEl = viewEl.querySelector<HTMLElement>('[data-asset-stat-n]');
      if (n && stat && nEl && viewEl.contains(stat)) {
        nEl.textContent = n;
        stat.hidden = false;
      }
    });
  }
}

// Share action for the Latest-exports stack: a pill beside the deck's Open
// link that hands whichever export is at the FRONT to the shared Share-link
// dialog (components/share-dialog.ts, extracted exactly to be callable
// anywhere) with the entry's toolId + serialized reopen state. The stack
// keeps its [data-open] href aimed at the front card (recent-stack
// layout()), so that href keys back to the export entry; the cards' own
// reopen links stay untouched. A duplicate href (same tool + state
// downloaded twice) resolves to the newest entry: same link either way.
function wireExportShare(stackMount: HTMLElement, entries: ExportEntry[], hrefs: string[]): void {
  const openEl = stackMount.querySelector<HTMLAnchorElement>('[data-open]');
  const ui = stackMount.querySelector<HTMLElement>('.dash-stack-ui');
  if (!openEl || !ui) return;
  const byHref = new Map<string, ExportEntry>();
  hrefs.forEach((href, i) => { if (!byHref.has(href)) byHref.set(href, entries[i]!); });
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dash-stack-open dash-stack-share';
  btn.style.margin = '0';           // .dash-stack-open centres itself; inline in the ‹ › row here
  btn.style.cursor = 'pointer';
  btn.textContent = t('Share link');
  ui.appendChild(btn);
  btn.addEventListener('click', async () => {
    const entry = byHref.get(openEl.getAttribute('href') ?? '');
    if (!entry) return;
    btn.disabled = true;
    try {
      const [{ openShareDialog }, { getTool }] = await Promise.all([
        import('../components/share-dialog.ts'),
        import('../bridge/tool-loader.ts'),
      ]);
      const { manifest } = await getTool(entry.toolId);
      const baseParts = entry.query ? entry.query.split('&') : [];
      // Carry the downloaded format so the recipient's link opens on the same one
      // (mirrors the Projects view's per-session share).
      if (entry.format) baseParts.push(`format=${encodeURIComponent(entry.format)}`);
      openShareDialog({ toolId: entry.toolId, baseParts, manifest, currentFormat: entry.format, title: t('Share this creation') });
    } catch { /* share is best-effort - the reopen links still work */ }
    finally { btn.disabled = false; }
  });
}

// Open + scroll to a deep-linked panel/group. Reference panels AND
// capability groups are <details> now, so force the match open, plus every
// ancestor <details> (a capability group lives inside the outer "What Lolly
// can do" panel), or the linked content would be folded away and the scroll
// would land on nothing. The target may live in an inactive tab, so switch
// to its panel first.
function applyDeepLink(viewEl: HTMLElement, flags: Set<string>, selectTab?: (key: string) => void): void {
  let target: HTMLElement | null = null;
  viewEl.querySelectorAll<HTMLElement>('[data-flag]').forEach((el) => {
    const owns = (el.dataset.flag || '').split(/\s+/).some((f) => flags.has(f));
    if (!owns) return;
    target ||= el;
    if (el.tagName === 'DETAILS') (el as HTMLDetailsElement).open = true;
    for (let anc = el.parentElement?.closest('details') as HTMLDetailsElement | null; anc; anc = anc.parentElement?.closest('details') as HTMLDetailsElement | null) {
      anc.open = true;
    }
  });
  if (target) {
    // Reveal the tab that owns the target before measuring/scrolling: a
    // hidden panel has no layout box, so scrollIntoView on it would be a no-op.
    const panelKey = (target as HTMLElement).closest<HTMLElement>('[data-dash-panel]')?.dataset.dashPanel;
    if (panelKey && selectTab) selectTab(panelKey);
    // Sections above the target (the logo files, catalogue summary) mount
    // async and keep growing the page for up to ~1.5s after this runs,
    // shoving the target down, so a one-shot scroll lands on its
    // pre-expansion spot. Re-land on a short repeating beat while the
    // layout settles so the deep-linked group reliably ends up in view.
    // Each re-land just re-aims at the target (idempotent once it's already
    // at the top).
    const land = (): void => { target!.scrollIntoView({ block: 'start', behavior: 'auto' }); };
    requestAnimationFrame(land);
    let n = 0;
    const again = (): void => { land(); if (++n < 12) setTimeout(again, 130); };
    setTimeout(again, 130);
  }
}

// Keep the live device rows (viewport, orientation) current while mounted.
// The wiring itself is the shared one in lib/device-info.ts (Colour Lab
// shows the same rows); this only chains its disposer onto viewEl._cleanup,
// since the device panel is never collapsed here, so the listeners run for
// the view's whole life.
function wireLive(viewEl: HTMLElement): void {
  const dispose = wireDeviceLive(viewEl);
  const prev = (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup;
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    prev?.();
    dispose();
  };
}
