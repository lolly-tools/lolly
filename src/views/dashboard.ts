// SPDX-License-Identifier: MPL-2.0
/**
 * Dashboard view (#/d) - the "instrument panel" for the whole platform. It
 * merges what used to be two pages (#/platform and #/capabilities) and pulls
 * read-only glances of your own data (activity + storage) from the Profile.
 * Nothing here is removed from Profile; this is a mirror, not a move.
 * The Design-system tab is deliberately READ-ONLY: it renders the loaded
 * brand (name, logo, primary colour, the faces in force, the palette and the
 * token primitives) wearing the brand's own variables (see brandHero()), and,
 * when the catalogue isn't locked, points at #/start where the brand is
 * actually adjusted. Nothing on this page writes brand state; personal
 * preferences (theme, sound) live on #/profile.
 *
 * The layout is deliberate: the brand hero leads (full-width, never
 * collapsible), then the bento of instrument tiles (palette wheel, type in
 * motion), the palette ink-ribbon, the brand-token chips and the print
 * reference, with THIS DEVICE (the live machine readout people find
 * genuinely interesting), the full capability map, and activity/storage on
 * the other tabs. Each primary section folds to its title bar with a soft
 * hydraulic cue (see the toggle listener in mountDashboard). Apart from the
 * sound switch, everything here is a snapshot of what this session currently
 * knows.
 *
 * Data sources (single sources of truth, imported, never duplicated):
 *   brand     → the active design system (lib/design-system/active.ts) + host.tokens resolve/raw,
 *               read-only: the hero's name/logo/primary and the token chips
 *   device    → lib/device-info.ts        (live session snapshot)
 *   activity  → metrics.ts + lib/activity-summary.ts
 *   storage   → navigator.storage + host.state / host.assets measurers
 *   palette   → lib/live-palette.ts (host.tokens, falls back to src/palette.ts) via lib/swatches.ts
 *   catalogue → window.__toolIndex + /catalog/assets/index.json
 *   caps      → lib/capabilities-data.ts
 *   CMYK      → engine/src/color.ts (CMYK_CONDITIONS)
 *   fonts     → the LIVE --font-brand/--font-mono vars (lib/type-demo.ts
 *               loadedFaces - brand/user fonts included)
 */

import '../styles/parts/platform.css'; // shared dashboard chrome (.plat-* / .cap-*)
import '../styles/parts/dashboard.css'; // this view's layout + signature pieces
import { escape } from '../utils.ts';
import { t, tRaw, loadNamespace } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { icon } from '../lib/icons.ts';
import { createRecentStack } from '../lib/recent-stack.ts';
import { renderPaletteWheel, wirePaletteWheel } from '../lib/palette-wheel.ts';
import { renderBrandSeal, sealColors } from '../lib/brand-seal.ts';
import { renderTypeDemo, wireTypeDemo, loadedFaces } from '../lib/type-demo.ts';
import type { LiveFace } from '../lib/type-demo.ts';
import { catalogSummaryBody, hydrateCatalogAssets } from '../lib/catalog-summary.ts';
import type { CatalogTool } from '../lib/catalog-summary.ts';
import type { PaletteEntry } from '../palette.ts';
import { livePalette } from '../lib/live-palette.ts';
import { groupPalette, swatch, isTransparent, inkText, isLockedInk } from '../lib/swatches.ts';
import { currentTheme } from '../theme.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION, hexToOklch, formatOklch, createTokenSet } from '@lolly/engine';
import { getMetrics } from '../metrics.ts';
import { renderActivity } from '../lib/activity-summary.ts';
import { collectDevice, renderDeviceCards, renderDeviceStat, wireDeviceLive, fmtBytes } from '../lib/device-info.ts';
import { playSfx } from '../lib/sfx.ts';
import { wireTabs } from '../lib/tabs.ts';
import { soundSwitchHtml, wireSoundSwitch } from '../components/sound-toggle.ts';
import { activeDesignSystemLabel, isUserDesignSystemActive } from '../lib/design-system/active.ts';
import { applyBrandVars, brandRadiusValue, tokenValueToHex } from '../brand-vars.ts';
import { listStudioTokens, formatStudioValue, gradientCss } from '../lib/token-studio.ts';
import type { StudioToken } from '../lib/token-studio.ts';
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
import { DASH_SECTIONS, dashFlag } from './dashboard-registry.ts';

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
// id / data-flag / classes, so all the existing wiring (brand hydration,
// device probe, storage, type demo, deep links) works unchanged whichever tab
// is showing. Inactive panels are `hidden`, not removed. The `key` doubles as
// the ?tab= deep-link value and the /b · /brand alias target (Design system).
const TAB_ICON: Record<string, string> = {
  // Monitor - this device.
  device: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  // Palette - the design system (colour, type, brand).
  brand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.05 0 1.5-.86 1.5-1.75 0-1.16-.98-2.1-.98-2.1s1.98.35 3.98.35A4.5 4.5 0 0 0 21 12.5C21 7 17 3 12 3z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>`,
  // App grid - the full feature set.
  caps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  // Bars - activity & stats.
  activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><rect x="5" y="11" width="3.4" height="6" rx="0.6"/><rect x="10.3" y="7" width="3.4" height="10" rx="0.6"/><rect x="15.6" y="4" width="3.4" height="13" rx="0.6"/></svg>`,
};
// Derived from the registry's tab rows (the flagless entries) so the tab bar
// and the search registry can't disagree on keys or labels.
const DASH_TABS: ReadonlyArray<{ key: string; label: string }> =
  DASH_SECTIONS.filter((s) => !s.flag && s.tab).map((s) => ({ key: s.tab!, label: s.label }));
const DASH_TAB_KEYS = new Set(DASH_TABS.map((tab) => tab.key));

// The tablist. Roving tabindex (only the active tab is focusable) + arrow-key nav
// are wired in wireTabs; labels display uppercase via CSS while the DOM keeps a
// clean accessible name.
function tabBar(active: string): string {
  return `
    <div class="dash-tabs" role="tablist" aria-label="${escape(t('Dashboard sections'))}">
      ${DASH_TABS.map((tab) => `
        <button type="button" role="tab" id="dtab-${tab.key}" class="dash-tab${tab.key === active ? ' is-active' : ''}"
                data-dash-tab="${tab.key}" aria-controls="dpanel-${tab.key}" aria-selected="${tab.key === active ? 'true' : 'false'}"
                tabindex="${tab.key === active ? '0' : '-1'}">
          <span class="dash-tab-icon" aria-hidden="true">${TAB_ICON[tab.key] ?? ''}</span>
          <span class="dash-tab-label">${escape(t(tab.label))}</span>
        </button>`).join('')}
    </div>`;
}

// One tabpanel wrapper. Inactive panels stay in the DOM (so async hydration + live
// listeners keep resolving onto them) but are `hidden`.
function panel(key: string, active: string, inner: string): string {
  return `<section role="tabpanel" id="dpanel-${key}" class="dash-panel" data-dash-panel="${key}" aria-labelledby="dtab-${key}" tabindex="0"${key === active ? '' : ' hidden'}>${inner}</section>`;
}

// A collapsible primary section: the whole card folds to its title bar,
// reusing the reference-panel <details> chrome (.plat-section-summary /
// .plat-section-body handle the chevron rotation + padding). `half` sizes it
// for the two-up palette/catalogue row. Marked data-dash-collapse so the
// mount wires a soft open/close cue on toggle. `iconSlot`/`chipsSlot` render
// EMPTY hooks (data-dash-collapse-icon/-chips) instead of real content: some
// callers' icon/facts are only known after an async client-side probe (see
// collectDevice()), so they hydrate in later exactly like the hero stats do.
function collapse(o: {
  id: string; title: string; body: string; desc?: string; flag?: string; open?: boolean; half?: boolean; cls?: string;
  iconSlot?: boolean; chipsSlot?: boolean;
}): string {
  return `
    <details class="plat-section dash-collapse${o.half ? ' dash-collapse--half' : ''}${o.cls ? ' ' + o.cls : ''}" id="${o.id}"${
      o.flag ? ` data-flag="${escape(o.flag)}"` : ''} data-dash-collapse${o.open === false ? '' : ' open'}>
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

// ── Brand hero: the Design-system tab's opening statement, a READ-ONLY card
// that literally wears the loaded brand. Its surface/text/edge come from the
// brand's semantic slots (applyBrandVars paints --brand-* onto the section
// just after first paint; every consumer in dashboard.css keeps a
// shell-token fallback, so an unbranded install, or a brand with no semantic
// slots like SUSE's, reads perfectly in both themes). The name, logo,
// primary colour and status line hydrate async (IDB reads); when the
// catalogue isn't locked, a single CTA points at #/start, where the brand is
// actually adjusted. Never collapsible: this is the one section that must
// always show.
function brandHero(): string {
  const { brand, mono } = loadedFaces();
  const faces = ([
    brand ? { face: brand, cssVar: '--font-brand', role: t('Primary typeface') } : null,
    mono ? { face: mono, cssVar: '--font-mono', role: t('Mono typeface') } : null,
  ] as Array<{ face: LiveFace; cssVar: string; role: string } | null>)
    .filter(Boolean) as Array<{ face: LiveFace; cssVar: string; role: string }>;
  return `
    <section class="plat-section dash-section dash-hero" id="dash-brand" aria-label="${escape(t('Your brand'))}" data-flag="${escape(dashFlag('dash-brand'))}">
      <div class="dash-hero-main">
        <div class="dash-hero-id">
          <span class="dash-hero-eyebrow">${t('The brand in force')}</span>
          <img class="dash-hero-logo" data-hero-logo alt="" hidden>
          <h2 class="dash-hero-name" id="dash-brand-h" data-hero-name>&nbsp;</h2>
          <p class="dash-hero-status" id="dash-brand-status">${t('Loading…')}</p>
          <a class="dash-hero-cta" href="#/start" data-hero-cta hidden>${t('Adjust your brand')} <span class="dash-hero-cta-arrow" aria-hidden="true">→</span></a>
        </div>
        <button type="button" class="dash-hero-primary" data-hero-primary data-copy="" aria-label="${escape(t('Primary colour - click to copy its value'))}">
          <span class="dash-hero-primary-label">${t('Primary')}</span>
          <code class="dash-hero-primary-code" data-hero-primary-code></code>
        </button>
      </div>
      ${faces.length ? `
      <div class="dash-hero-type">
        ${faces.map(({ face, cssVar, role }) => `
          <span class="dash-hero-face" style="font-family:var(${cssVar})">
            <strong>${escape(face.label)}</strong>
            <em>${escape(role)}</em>
          </span>`).join('')}
      </div>` : ''}
    </section>`;
}

// ── Brand tokens: read-only chips for the brand's non-colour primitives, the
// corner radius plus anything lib/token-studio.ts manages (spacing, sizing,
// stroke, opacity, rotation, numbers, shadows, gradients). Rendered hidden
// and filled by the async brand hydration; a doc carrying none of these keeps
// the whole section off the page.
function tokensSection(): string {
  return `
    <section class="plat-section dash-section dash-tokens" id="dash-tokens" data-flag="${escape(dashFlag('dash-tokens'))}" hidden>
      ${sectionHead(t('Brand tokens'), 'dash-tokens-h', tRaw('The primitives the tokens document carries - shape, space, effects - exactly as tools consume them. Adjusted at {link}.', { link: `<a href="#/start?tab=tokens">${t('Start')}</a>` }))}
      <ul class="dash-token-grid" data-token-grid></ul>
    </section>`;
}

// A CSS length as this page will render into a style attribute - same
// defence-in-depth stance as brand-vars.ts's RADIUS_RE, widened to allow the
// negative offsets a shadow may carry. Anything else simply drops its preview.
const TOKEN_LEN_RE = /^-?\d+(\.\d+)?(px|rem|em)$/;

/** One read-only token chip: kind-specific preview · name over kind · value. */
function tokenChip(o: { name: string; kind: string; value: string; preview: string }): string {
  return `
    <li class="dash-token">
      <span class="dash-token-preview" aria-hidden="true">${o.preview}</span>
      <span class="dash-token-text">
        <span class="dash-token-name">${escape(o.name)}</span>
        <span class="dash-token-kind">${escape(t(o.kind))}</span>
      </span>
      ${o.value ? `<code class="dash-token-value">${escape(o.value)}</code>` : ''}
    </li>`;
}

/** A studio token's tiny visual: bar / rule / translucency / needle / shadow /
 *  gradient. Values come from an untrusted imported doc and land in a style
 *  attribute, so every branch validates before it renders. A chip whose value
 *  can't be shown safely just shows none. `resolve` answers gradient stops'
 *  `{path}` alias colours (gradientCss re-validates whatever it returns). */
function studioPreview(tok: StudioToken, resolve?: (ref: string) => unknown): string {
  const raw = tok.raw;
  const len = typeof raw === 'string' && TOKEN_LEN_RE.test(raw.trim()) ? raw.trim() : null;
  switch (tok.kind) {
    case 'spacing':
    case 'sizing':
      return len ? `<span class="dash-token-bar"><i style="width:${escape(len)}"></i></span>` : '';
    case 'stroke':
      return len ? `<span class="dash-token-rule"><i style="height:${escape(len)}"></i></span>` : '';
    case 'opacity': {
      const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : null;
      return n == null ? '' : `<span class="dash-token-alpha"><i style="opacity:${n}"></i></span>`;
    }
    case 'rotation': {
      const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw * 100) / 100 : null;
      return n == null ? '' : `<span class="dash-token-rot"><i style="transform:rotate(${n}deg)"></i></span>`;
    }
    case 'shadow': {
      const css = shadowCss(raw);
      return css ? `<span class="dash-token-shadow" style="box-shadow:${escape(css)}"></span>` : '';
    }
    case 'gradient': {
      const css = gradientCss(raw, tok.angle, { resolve, space: 'oklch' });
      return css ? `<span class="dash-token-grad" style="background:${escape(css)}"></span>` : '';
    }
    default:
      return ''; // number - the value line carries it
  }
}

/** A DTCG shadow $value ({ color, offsetX, offsetY, blur, spread } strings) as
 *  a safe CSS box-shadow, or null when its colour or any offset is unusable. */
function shadowCss(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const dim = (v: unknown): string | null =>
    typeof v === 'string' && TOKEN_LEN_RE.test(v.trim()) ? v.trim() : null;
  const color = tokenValueToHex(r.color);
  if (!color) return null;
  return `${dim(r.offsetX) ?? '0px'} ${dim(r.offsetY) ?? '0px'} ${dim(r.blur) ?? '0px'} ${dim(r.spread) ?? '0px'} ${color}`;
}

/** A studio token's display value - the contract's formatter first, else the
 *  raw string/number itself (shadows/gradients read from their preview). */
function studioValue(tok: StudioToken): string {
  const formatted = formatStudioValue(tok);
  if (formatted) return formatted;
  return typeof tok.raw === 'string' ? tok.raw : typeof tok.raw === 'number' ? String(tok.raw) : '';
}

/** A computed `rgb()`/`rgba()` colour → #rrggbb (the hover-code fallback when
 *  the brand declares no semantic primary and the chip shows the shell accent). */
function cssRgbToHex(css: string): string | null {
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css.trim());
  if (!m) return null;
  const h = (n: string) => Math.min(255, +n).toString(16).padStart(2, '0');
  return `#${h(m[1]!)}${h(m[2]!)}${h(m[3]!)}`;
}

// ── Palette: the compact "ink ribbon" ──────────────────────────────────────
// Every colour as one thin bar, grouped by family; hover/focus drives a single
// mono readout (the instrument), click copies the hex. No value is lost - the
// full name/hex/CMYK grid is one click away under "All values".
function inkBar(c: PaletteEntry): string {
  const trans = isTransparent(c.hex);
  const measured = isLockedInk(c);
  const hex = trans ? 'transparent' : c.hex;
  const cmyk = trans ? t('no ink') : inkText(c);
  return `<button type="button" class="dash-ink${trans ? ' is-transparent' : ''}${measured ? ' is-measured' : ''}"${
    trans ? '' : ` style="--ink:${escape(c.hex)}"`
  } data-copy="${escape(hex)}" data-name="${escape(c.label)}" data-hex="${escape(hex)}" data-cmyk="${escape(cmyk)}"${
    measured ? ' data-measured="1"' : ''
  } aria-label="${escape(c.label)} - ${escape(hex)}${measured ? `, ${escape(t('exact CMYK ink'))}` : ''} (${escape(t('click to copy'))})" title="${escape(c.label)} · ${escape(hex)}"></button>`;
}

function inkGroup(label: string, cols: readonly PaletteEntry[], count = false): string {
  return `
    <div class="dash-ink-group">
      <span class="dash-ink-group-label">${escape(label)}${count ? `<span class="dash-ink-group-n">${cols.length}</span>` : ''}</span>
      <div class="dash-ink-row">${cols.map(inkBar).join('')}</div>
    </div>`;
}

function paletteSection(palette: readonly PaletteEntry[]): string {
  const { brand, spectrum, ramps } = groupPalette(palette);
  const measuredCount = palette.filter(isLockedInk).length;

  const ribbon = `
    <div class="dash-ribbon" data-ribbon>
      ${inkGroup(t('Brand'), brand)}
      ${spectrum.length ? inkGroup(t('Spectrum'), spectrum, true) : ''}
      ${ramps.map(([fam, cols]) => inkGroup(fam, cols, true)).join('')}
    </div>
    <div class="dash-readout" data-readout aria-live="polite">
      <span class="dash-readout-swatch" data-ro-swatch aria-hidden="true"></span>
      <span class="dash-readout-name" data-ro-name>${t('Hover or focus a colour')}</span>
      <code class="dash-readout-hex" data-ro-hex></code>
      <span class="dash-readout-cmyk" data-ro-cmyk></span>
    </div>`;

  // Full values, disclosed on demand: the classic grouped swatch grid so no
  // hex / CMYK figure is ever hidden, only tucked away.
  const fullGrid = `
    <details class="dash-values">
      <summary class="dash-values-summary">${t('All values')}<span class="dash-values-n">${palette.length}</span>${COLLAPSE_CHEV}</summary>
      <div class="dash-values-body">
        <div class="plat-legend">
          <span class="plat-legend-item"><span class="plat-chip-flag is-static">CMYK</span> ${t('exact ink substitution')}</span>
          <span class="plat-legend-item"><span class="plat-chip-flag is-static">SPOT</span> ${t('named spot colour, its CMYK equivalent substituted at export')}</span>
          <span class="plat-legend-item"><span class="plat-swatch-cmyk is-generic">${t('RGB→CMYK (generic)')}</span> ${t('generic conversion at export')}</span>
        </div>
        <h3 class="plat-ramp-title">${t('Brand colours')}</h3>
        <div class="plat-swatch-grid">${brand.map(swatch).join('')}</div>
        ${spectrum.length ? `<h3 class="plat-ramp-title">${t('Spectrum')} <span class="plat-ramp-count">${spectrum.length}</span></h3>
        <p class="plat-ramp-note">${t('Secondary palette for infographics, charts &amp; data viz - it expands the colour wheel but does <strong>not</strong> replace brand colours.')}</p>
        <div class="plat-swatch-grid">${spectrum.map(swatch).join('')}</div>` : ''}
        ${ramps.map(([fam, cols]) => `<h3 class="plat-ramp-title">${escape(fam)} <span class="plat-ramp-count">${cols.length}</span></h3>
        <div class="plat-swatch-grid">${cols.map(swatch).join('')}</div>`).join('')}
      </div>
    </details>`;

  return collapse({
    id: 'dash-palette',
    flag: dashFlag('dash-palette'),
    title: t('Colour palette'),
    desc: t('Shown in every colour picker. <strong>{n} of {total}</strong> carry a locked ink value (CMYK or spot), substituted directly into CMYK PDF exports - the tick on a bar marks one.', { n: measuredCount, total: palette.length }),
    body: `${ribbon}${fullGrid}`,
    half: true,
  });
}

// Copy-to-clipboard for ink bars, the full-values swatch chips AND the hero's
// primary field (its data-copy hydrates in async; the handler reads the dataset
// at click time, so wiring before hydration is fine).
function wireCopyButtons(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard?.writeText(btn.dataset.copy!);
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 900);
      } catch {
        /* clipboard blocked - no-op */
      }
    });
  });
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
  const [{ CAPABILITY_SECTIONS }] = await Promise.all([
    import('../lib/capabilities-data.ts'),
    loadNamespace('caps'),
  ]);
  // Each group is its own collapsible accordion panel - the section desc stays
  // visible in the summary as a table-of-contents, and the card grid expands below.
  // The first opens by default; the rest are folded so the whole map is scannable
  // at a glance. data-dash-collapse wires the shared fold sound cue.
  // A section's summary also carries its card count: the folded state otherwise
  // gives no clue whether opening it reveals one card or eight.
  const groups = CAPABILITY_SECTIONS.map((s, idx) => `
    <details class="dash-cap-group" id="${s.id}" data-flag="${escape(s.flag)}" data-dash-collapse${idx === 0 ? ' open' : ''}>
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
  const totalCards = CAPABILITY_SECTIONS.reduce((n, s) => n + s.cards.length, 0);
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
  // sections reads as "broken", so say so in words.
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

// ── Reference panels (collapsible) ──────────────────────────────────────────
function refPanel(flag: string, defaultOpen: boolean, id: string, title: string, body: string): string {
  return `
    <details class="plat-section dash-ref" id="${id}" data-flag="${escape(flag)}"${defaultOpen ? ' open' : ''}>
      <summary class="plat-section-summary"><h2 class="plat-section-title">${escape(title)}</h2>${COLLAPSE_CHEV}</summary>
      <div class="plat-section-body">${body}</div>
    </details>`;
}

// A compact "type facts" strip for the Type-in-motion tile: the fonts IN
// FORCE, resolved from the live --font-brand / --font-mono vars (platform
// defaults, the brand's font tokens, or a user-installed primary, whatever is
// actually set), with each row rendered in its own face. "Manage fonts"
// points at the Start studio's Type step, where fonts are added and the
// primary is chosen.
function typeFacts(): string {
  const { brand, mono } = loadedFaces();
  const rootStyle = getComputedStyle(document.documentElement);
  const rows = ([
    brand ? { face: brand, role: t('Brand · UI & body'), cssVar: '--font-brand' } : null,
    mono ? { face: mono, role: t('Mono · code & data'), cssVar: '--font-mono' } : null,
  ] as Array<{ face: LiveFace; role: string; cssVar: string } | null>).filter(Boolean) as Array<{ face: LiveFace; role: string; cssVar: string }>;
  return `
    <ul class="dash-type-facts">
      ${rows.map(({ face, role, cssVar }) => `
        <li>
          <span class="dash-type-fam" style="font-family:var(${cssVar})">${escape(face.label)}</span>
          <span class="dash-type-meta">${escape(role)} · wght ${face.axis.min}–${face.axis.max}</span>
          <code class="dash-type-src">${escape(`${cssVar}: ${rootStyle.getPropertyValue(cssVar).trim()}`)}</code>
        </li>`).join('')}
      <li class="dash-type-manage"><a href="#/start?tab=type">${t('Manage fonts')} →</a></li>
    </ul>`;
}

// Reuses the shared swatch() tile (chip + name + hex + ink readout, same as
// the "All values" grid below) instead of a bespoke list: a locked-ink brand
// colour should look identical wherever it's shown.
function printBody(palette: readonly PaletteEntry[]): string {
  const locked = palette.filter((c) => isLockedInk(c) && !isTransparent(c.hex));
  return `
    <p class="plat-section-desc">${t('Brand colours locked to an exact ink value (CMYK or spot) - substituted directly into CMYK PDF exports instead of a generic sRGB→CMYK conversion.')}</p>
    ${locked.length
      ? `<div class="plat-swatch-grid">${locked.map(swatch).join('')}</div>`
      : `<p class="cat-empty">${t("No brand colours are locked to an exact ink yet - pin one from a swatch's print lock in the Design system tab above.")}</p>`}
    <p class="plat-section-desc">${t('Press conditions a CMYK PDF can declare in its <code>OutputIntent</code>. Selected per-export via the <code>colorProfile</code> option; raster &amp; on-screen output stays sRGB.')}</p>
    <table class="plat-table">
      <thead><tr><th>${t('Profile key')}</th><th>${t('Identifier')}</th><th>${t('Condition')}</th></tr></thead>
      <tbody>
        ${Object.entries(CMYK_CONDITIONS).map(([key, c]) => `
          <tr${key === DEFAULT_CMYK_CONDITION ? ' class="is-default"' : ''}>
            <td><code>${escape(key)}</code>${key === DEFAULT_CMYK_CONDITION ? `<span class="plat-pill">${t('default')}</span>` : ''}</td>
            <td>${escape(c.identifier)}</td>
            <td>${escape(c.info)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
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
    : `<p class="dash-store-headline">${t('<strong>{n}</strong> measured on this device', { n: fmtBytes(m.total) })}</p>`;
  return `
    ${hero}
    <div class="dash-store-bar" role="img" aria-label="${escape(tRaw('Storage composition: {list}', { list: segs.map((s) => `${s.label} ${fmtBytes(s.bytes)}`).join(', ') }))}">${bar || '<span class="dash-store-seg dash-store-seg--other" style="flex:1"></span>'}</div>
    <div class="dash-store-legend">${legend}</div>
    <p class="dash-store-note">${tRaw('A read-only view - manage or clear it in your {link}. Nothing is uploaded.', { link: `<a href="#/profile?focus=storage-section">${t('Profile')}</a>` })}</p>`;
}

// ────────────────────────────────────────────────────────────────────────────

export async function mountDashboard(viewEl: HTMLElement, host: HostV1, routeParams?: string): Promise<void> {
  document.title = t('Dashboard - Lolly');

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

  const capsHtml = await capabilitiesSection();

  // The active brand's palette (SUSE's measured inks, or whichever catalog
  // is mounted), not the tokenless PALETTE fallback, so this page always
  // shows the profile that's actually running. See lib/live-palette.ts.
  const palette = await livePalette(host);

  // The whole palette on the wheel, each dot labelled with its canonical
  // scale-token name (jungle-6, pine-2, persimmon-5), not the display label
  // ("Jungle 6"). The tint ramps (jungle-1..8, pine-1..8, ...) are what carry
  // those numbered tokens, so they're plotted too, not just the base
  // colours. The palette aliases some hexes (base Persimmon IS persimmon-5,
  // base Jungle IS jungle-4), so dedup by hex: a same-family scale token
  // supersedes its bare base name (persimmon becomes persimmon-5), while a
  // cross-family alias keeps its distinct brand name (Mint is #90ebcd, which
  // is also pine-6; it stays "mint"). 'transparent' has no hue to plot, so
  // it's skipped.
  const tokenName = (label: string): string => label.toLowerCase().replace(/\s+/g, '-'); // "Jungle 6" → "jungle-6"
  const familyOf = (name: string): string => name.replace(/-\d+$/, '');                  // "jungle-6" → "jungle"
  const isScaleToken = (name: string): boolean => /-\d+$/.test(name);
  const byHex = new Map<string, { hex: string; label: string }>();
  for (const c of palette) {
    if (isTransparent(c.hex)) continue;
    const key = c.hex.toLowerCase();
    const name = tokenName(c.label);
    const prev = byHex.get(key);
    if (!prev) { byHex.set(key, { hex: c.hex, label: name }); continue; }
    // Base colours list first, so a same-family scale token (persimmon-5)
    // arriving after its bare base (persimmon) upgrades it; a cross-family
    // alias (pine-6 vs mint) does not.
    if (isScaleToken(name) && !isScaleToken(prev.label) && familyOf(name) === prev.label) {
      byHex.set(key, { hex: c.hex, label: name });
    }
  }
  const wheelColors = [...byHex.values()];

  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="dash-layout">
      <header class="plat-header dash-header">
        <h1 class="plat-title">${t('Dashboard')}</h1>
        <div class="plat-header-text">

        </div>
      </header>

      ${tabBar(initialTab)}

      <div class="dash-panels">
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
                desc: t('What Lolly is keeping on this device.'),
                body: `<div class="dash-store" data-store><p class="cat-empty">${t('measuring…')}</p></div>`,
              })}
            </div>
          </div>
        `)}

        ${panel('brand', initialTab, `
          ${brandHero()}
          <section class="plat-section dash-section dash-lock" id="dash-lock" data-flag="${escape(dashFlag('dash-lock'))}" hidden></section>
          <div class="dash-bento">
            <section class="plat-section dash-section dash-card" id="dash-palette-wheel" data-flag="${escape(dashFlag('dash-palette-wheel'))}">
              ${sectionHead(t('Palette on the wheel'), 'dash-wheel-h', t('Every brand colour plotted by hue (the angle) and chroma (distance out from the centre). Greys have no hue, so they ride the rail beside it, by lightness. Hover a dot to read it.'))}
              ${renderPaletteWheel(wheelColors)}
            </section>
            <section class="plat-section dash-section dash-card dash-typedemo" id="dash-typedemo" data-flag="${escape(dashFlag('dash-typedemo'))}">
              ${sectionHead(t('Type in motion'), 'dash-typedemo-h', t('The faces in force - the fonts loaded on this device, live. The axes themselves are the animation.'))}
              ${renderTypeDemo()}
              ${typeFacts()}
            </section>
          </div>
          ${paletteSection(palette)}
          ${tokensSection()}
          ${refPanel(dashFlag('dash-print'), false, 'dash-print', t('Print & CMYK'), printBody(palette))}
          <p class="plat-note dash-foot" role="note">
            ${tRaw('<strong>This page is read-only</strong> - it renders the brand this device is wearing; every tool, page and export follows it. The brand itself is adjusted at {start}; personal preferences - theme and sound - live on your {profile}.', { start: `<a href="#/start">${t('Start')}</a>`, profile: `<a href="#/profile">${t('Profile')}</a>` })}
            ${' '}${tRaw('Building the UI? Browse the shell’s primitives & views in the {link}.', { link: `<a href="#/components">${t('Component library')}</a>` })}
          </p>
        `)}

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

  // Include the read-only foot note (now inside the Design system panel) in
  // the reveal ladder so it settles in with that panel's other sections
  // instead of snapping in at full opacity beneath the cascade.
  armViewEnter(viewEl, '.tools-home, .plat-header, .dash-tabs, .plat-section, .dash-foot');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  // The dashboard renders your brand read-only; a theme flip here checks it in
  // light, dark and brand without a trip to the profile.
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
  // toggle-cue listener below is attached, so this doesn't play the fold
  // sound on page load.
  const deviceDetails = viewEl.querySelector<HTMLDetailsElement>('#dash-device');
  if (deviceDetails && window.matchMedia('(min-width: 900px)').matches) deviceDetails.open = true;

  // Primary tabs (lib/tabs.ts's shared roving-tabindex machinery, component
  // audit rec 1). Returns a `selectTab(key)` so the deep-link handler can
  // jump to the panel that owns a flagged section. Wiring the tabs before the
  // deep link means a `?print`/`?formats` link both switches to the right
  // tab AND scrolls. `onSelect` owns everything view-specific: showing the
  // matching panel, and, for a live click/arrow-key selection (not the
  // initial paint or a deep link), the toggle sound plus mirroring the tab
  // into the URL (replaceState, so it fires no hashchange and doesn't
  // re-mount the view).
  const dashPanels = [...viewEl.querySelectorAll<HTMLElement>('[data-dash-panel]')];
  const dashTabsEl = viewEl.querySelector<HTMLElement>('.dash-tabs');
  const selectTab = dashTabsEl ? wireTabs(dashTabsEl, {
    key: 'dashTab',
    onSelect: (key, { reason }) => {
      for (const p of dashPanels) p.hidden = p.dataset.dashPanel !== key;
      if (reason !== 'programmatic') {
        playSfx('toggle');
        try { history.replaceState(history.state, '', `#/d?tab=${key}`); } catch { /* history unavailable */ }
      }
    },
  }) : (() => {});
  // Establish the initial state without rewriting the URL (aliases already set it).
  selectTab(initialTab);

  // The brand hero + token chips, hydrated just after first paint instead of
  // blocking it (IDB reads: brand discovery, tokens, the raw doc). Everything
  // here READS: the hero's only affordances are the #/start CTA and a
  // copy-to-clipboard on the primary field, so there is nothing to tear down.
  // Guarded after every await: a route change mid-read must not paint a
  // detached node.
  void (async () => {
    const hero = viewEl.querySelector<HTMLElement>('#dash-brand');
    if (!hero || !viewEl.contains(hero)) return;
    const tokensApi = host.tokens as {
      resolve?(ref: string): Promise<unknown>;
      raw?(): Promise<unknown>;
      isLocked?(): Promise<boolean>;
    } | undefined;

    // Dress the hero in the brand's own semantic slots: applyBrandVars
    // resolves color.semantic.* onto the section as --brand-* custom
    // properties. Every consumer in dashboard.css keeps a shell-token
    // fallback, so a doc without semantic slots (SUSE's) or no doc at all
    // reads perfectly in both themes.
    void applyBrandVars(hero, host as Parameters<typeof applyBrandVars>[1]).catch(() => { /* cosmetic */ });

    // Name + status: the tokens asset's metadata (a user install's own
    // label, else the catalogue asset's name with its "... tokens" suffix
    // trimmed for display: "SUSE Brand Design Tokens" reads as "SUSE" up here).
    let rec: { id: string; name?: string; meta?: Record<string, unknown> } | null = null;
    try {
      rec = (await (host.assets as unknown as {
        _findMetaByType?(t: string): Promise<{ id: string; name?: string; meta?: Record<string, unknown> } | null>;
      })._findMetaByType?.('tokens')) ?? null;
    } catch { /* discovery unavailable - show the unbranded pathway */ }
    const locked = await tokensApi?.isLocked?.().catch(() => false) ?? false;
    // Who owns what is running, and what they called it (plans/186 section 3.3).
    // The label is null on a device with no registry yet, which is what keeps the
    // asset's own trimmed name below as the answer there.
    const mine = await isUserDesignSystemActive(host).catch(() => false);
    const recordLabel = await activeDesignSystemLabel(host).catch(() => null);
    if (!viewEl.contains(hero)) return;

    const metaId = rec?.id ?? '';
    const metaName = typeof rec?.meta?.name === 'string' && rec.meta.name ? rec.meta.name : rec?.name ?? '';
    const nameEl = hero.querySelector<HTMLElement>('[data-hero-name]');
    if (nameEl) {
      nameEl.textContent = recordLabel
        || metaName.replace(/\s+(brand\s+)?(design\s+)?tokens$/i, '').trim()
        || t('Your brand');
    }

    const statusEl = hero.querySelector<HTMLElement>('#dash-brand-status');
    if (statusEl) {
      statusEl.innerHTML = locked
        ? t('This build ships with a fixed brand - every tool, page and export already wears it.')
        : mine
          ? t('Your brand is installed - every tool, page and export wears it.')
          : metaId
            ? t('Running the catalogue’s built-in brand. Make it yours - pick a colour and Lolly derives the rest. It stays on this device.')
            : t('This install is unbranded. Pick one colour and Lolly derives the ramps, themes and every semantic slot - <strong>make it yours</strong>.');
    }
    // The one action: adjust the brand at Start. A locked catalogue's brand
    // is part of its identity, so the CTA never shows there (the status line
    // above is the fixed-brand note).
    const cta = hero.querySelector<HTMLElement>('[data-hero-cta]');
    if (cta) cta.hidden = locked;

    // A locked brand gets a seal instead of a disabled-looking editor: a
    // metal disc struck in the brand's own inks, padlocked. It only exists
    // when the catalogue's tokens asset is authoritative (brandLock, see
    // bridge/tokens.ts), which is also the only case where the editor at
    // #/start refuses to open.
    const lockEl = viewEl.querySelector<HTMLElement>('#dash-lock');
    if (lockEl && locked) {
      const brandLabel = nameEl?.textContent?.trim() || t('This brand');
      lockEl.innerHTML = `
        ${renderBrandSeal(sealColors(palette))}
        <div class="dash-lock-text">
          <h2 class="dash-lock-title">${escape(t('Brand locked'))}</h2>
          <p class="dash-lock-desc">${t('<span class="dash-lock-brand">{brand}</span> ships with this build and is authoritative - its colours, type and tokens come from the catalogue and cannot be edited on this device. Every tool, page and export already wears it.', { brand: brandLabel })}</p>
        </div>`;
      lockEl.hidden = false;
    }

    // The horizontal-primary logo, when the brand carries one, resolved from
    // its asset token to the stored asset's url and rendered via <img>, so an
    // uploaded SVG's markup is drawn, never executed. On a dark-leaning
    // theme (dark/brand) the reverse form is preferred when present. The
    // bridge owns the object URL (its cache), so nothing here revokes it.
    try {
      const wantReverse = currentTheme() !== 'light';
      const refs = wantReverse
        ? ['{asset.logo.horizontal-primary-reverse}', '{asset.logo.horizontal-primary}']
        : ['{asset.logo.horizontal-primary}'];
      for (const ref of refs) {
        const id = await tokensApi?.resolve?.(ref);
        if (typeof id !== 'string' || !id || id.startsWith('{')) continue;
        const asset = await host.assets.get(id).catch(() => null);
        if (!viewEl.contains(hero)) break;
        if (!asset?.url) continue; // stale token / missing asset - try the next form
        const img = hero.querySelector<HTMLImageElement>('[data-hero-logo]');
        if (img) { img.src = asset.url; img.hidden = false; }
        break;
      }
    } catch { /* no logo installed - the name carries the hero */ }

    // The primary field's quiet instrument line: hex + oklch, plus
    // click-to-copy (wireCopyButtons reads data-copy at click time).
    // Resolved from the brand's semantic primary; when the doc declares
    // none, read the chip's painted fallback (the shell accent) so the
    // readout always tells the truth.
    const chip = hero.querySelector<HTMLButtonElement>('[data-hero-primary]');
    if (chip && viewEl.contains(chip)) {
      let hex: string | null = null;
      try { hex = tokenValueToHex(await tokensApi?.resolve?.('{color.semantic.primary}')); } catch { /* fall through */ }
      if (!hex) hex = cssRgbToHex(getComputedStyle(chip).backgroundColor);
      if (hex && viewEl.contains(chip)) {
        const o = hexToOklch(hex);
        const code = chip.querySelector<HTMLElement>('[data-hero-primary-code]');
        if (code) code.textContent = o ? `${hex} · ${formatOklch(o)}` : hex;
        chip.dataset.copy = hex;
        chip.title = tRaw('Primary · {hex} (click to copy)', { hex });
      }
    }

    // Brand tokens: the read-only chip grid, the corner radius (same token
    // the Start studio's slider writes) plus every studio-managed primitive
    // in the raw doc. A doc carrying none keeps the section hidden entirely.
    try {
      const radius = await tokensApi?.resolve?.('{shape.radius}').then(v => brandRadiusValue(v)).catch(() => null) ?? null;
      let studio: StudioToken[] = [];
      let resolveTok: ((ref: string) => unknown) | undefined;
      try {
        const doc = await tokensApi?.raw?.();
        if (doc) {
          studio = listStudioTokens(doc);
          // Gradient stops may alias palette swatches - resolve against the
          // same doc, in the theme the page is showing.
          const set = createTokenSet(doc, { theme: currentTheme() === 'dark' ? 'dark' : 'light' });
          resolveTok = (ref: string) => set.resolve(ref);
        }
      } catch { /* no readable doc - chips fall back to radius alone */ }
      const chips = [
        ...(radius ? [tokenChip({
          name: t('Corner radius'), kind: 'shape', value: radius,
          preview: `<span class="dash-token-shape" style="border-radius:${escape(radius)}"></span>`,
        })] : []),
        ...studio.map(tok => tokenChip({ name: tok.name, kind: tok.kind, value: studioValue(tok), preview: studioPreview(tok, resolveTok) })),
      ];
      const sec = viewEl.querySelector<HTMLElement>('#dash-tokens');
      const grid = sec?.querySelector<HTMLElement>('[data-token-grid]');
      if (sec && grid && chips.length && viewEl.contains(sec)) {
        grid.innerHTML = chips.join('');
        sec.hidden = false;
      }
    } catch { /* tokens unreadable - the section stays hidden */ }
  })();

  // Fold cue: a soft hydraulic open/close whenever a primary section (device,
  // palette, catalogue, capabilities) is collapsed or revealed. Capture
  // phase: the <details> `toggle` event does not bubble, so a bubble-phase
  // delegated listener never sees it. Respects the global mute (playSfx
  // no-ops when muted).
  viewEl.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d instanceof HTMLDetailsElement && d.hasAttribute('data-dash-collapse')) {
      playSfx(d.open ? 'hydraulicOpen' : 'hydraulicClose');
    }
  }, true);

  // Deep-link: switch to the owning tab, then open + scroll to any panel/group
  // whose flag is in the hash query.
  if (flags.size) applyDeepLink(viewEl, flags, selectTab);

  // Copy-to-clipboard for ink bars AND the full-values swatch chips.
  wireCopyButtons(viewEl);

  // Palette readout: hover/focus an ink bar → update the mono instrument line.
  wireReadout(viewEl);
  // Signature pieces: the palette wheel's hub readout + the variable-type motion.
  wirePaletteWheel(viewEl);
  // wireTypeDemo returns a teardown (stops its rAF sweep + IntersectionObserver); chain it
  // onto the view's _cleanup so the sweep can't outlive the dashboard after a route change.
  const stopTypeDemo = wireTypeDemo(viewEl);
  {
    const prev = (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup;
    (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { prev?.(); stopTypeDemo(); };
  }

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

    capSearch.addEventListener('input', () => apply(capSearch.value));
    // Esc clears instead of closing anything: the field is inside a
    // <dialog>-free panel, so the key is free, and a filtered page with no
    // visible way back is the trap this avoids.
    capSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && capSearch.value) { e.stopPropagation(); capSearch.value = ''; apply(''); }
    });
    clearBtn?.addEventListener('click', () => { capSearch.value = ''; apply(''); capSearch.focus(); });
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
    // Sections above the target (palette wheel, catalogue summary) mount
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

// Palette readout instrument - one shared mono line driven by whichever ink bar
// is hovered or focused. Delegated so it survives nothing (static markup) and
// costs one listener pair.
function wireReadout(viewEl: HTMLElement): void {
  const ribbon = viewEl.querySelector<HTMLElement>('[data-ribbon]');
  const readout = viewEl.querySelector<HTMLElement>('[data-readout]');
  if (!ribbon || !readout) return;
  const sw = readout.querySelector<HTMLElement>('[data-ro-swatch]');
  const name = readout.querySelector<HTMLElement>('[data-ro-name]');
  const hex = readout.querySelector<HTMLElement>('[data-ro-hex]');
  const cmyk = readout.querySelector<HTMLElement>('[data-ro-cmyk]');
  const show = (el: Element | null) => {
    const btn = (el as Element | null)?.closest<HTMLElement>('.dash-ink');
    if (!btn) return;
    const trans = btn.classList.contains('is-transparent');
    if (sw) {
      sw.style.background = trans ? '' : btn.style.getPropertyValue('--ink');
      sw.classList.toggle('is-transparent', trans);
    }
    if (name) name.textContent = btn.dataset.name || '';
    if (hex) hex.textContent = btn.dataset.hex || '';
    if (cmyk) {
      cmyk.textContent = btn.dataset.cmyk || '';
      cmyk.classList.toggle('is-measured', btn.dataset.measured === '1');
    }
    readout.classList.add('is-active');
  };
  ribbon.addEventListener('pointerover', (e) => show(e.target as Element));
  ribbon.addEventListener('focusin', (e) => show(e.target as Element));
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
