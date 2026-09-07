// SPDX-License-Identifier: MPL-2.0
/**
 * Shared icon registry - ONE Lucide-house path table for the whole shell.
 *
 * Before this file, the same handful of glyphs (circle-help "?", the chevrons,
 * the shield-check, the package box, the Neurospicy heartbeat …) were each
 * hand-inlined as a per-file `<svg>` const in category-icons.ts, catalog-summary.ts,
 * valid.ts, projects.ts, folder-tiles.ts, gallery.ts, profile.ts, footer-nav.ts,
 * featured-row.ts, sound-toggle.ts and neuro-dock.ts - see
 * plans/76-component-audit.md recommendation 5. Several were byte-for-byte
 * duplicates under different names (the icons noted "merged, was X" below);
 * those are collapsed onto one canonical name here. Genuinely different Lucide
 * glyphs that merely *look* similar (e.g. a plain shield vs. a shield with a
 * check mark, or "box" vs. "package") are kept as separate entries - dedupe
 * never trades away a real visual distinction.
 *
 * Usage: `icon('trash')` → a 24×24 stroke <svg> string. `icon('trash', { size: 18 })`
 * sizes it; `{ className }` adds a class; `{ strokeWidth }` overrides the
 * default 2 (callers that hand-tuned a thinner/thicker stroke keep that look).
 * `{ filled: true }` switches to a filled glyph (fill=currentColor, no stroke)
 * for the handful of dot/glyph icons that were authored solid rather than
 * outlined (e.g. the featured-row "⋯" menu dots).
 *
 * Tree-shake-friendly: `PATHS` is one flat object of strings (no per-icon
 * modules, no runtime cost beyond template-string concatenation), and nothing
 * here touches the DOM.
 */

export interface IconOpts {
  /** Sets `width`/`height` (px). Omitted → no size attributes (CSS controls it), matching most existing call sites. */
  size?: number;
  /** Extra class(es) on the `<svg>` element. */
  className?: string;
  /** Overrides the default stroke-width of 2 (ignored when `filled`). */
  strokeWidth?: number;
  /** Solid glyph (fill=currentColor, stroke=none) instead of the default outline style. */
  filled?: boolean;
}

// ---- Shared path fragments (referenced by ≥2 registry keys, DRY like the
// former category-icons.ts g()-const pattern) ---------------------------------
const CHECK_TICK = '<path d="m9 12 2 2 4-4"/>';
const SHIELD_OUTLINE = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
const FILM_STRIP = '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>';
const GRID_4 = '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>';
/** Lens + handle. Shared by `search` and the two zoom glyphs, which differ only
 *  by the sign drawn inside the lens - that is what makes them read as a family. */
const MAGNIFIER = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>';
const PACKAGE_BOX = '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>';

/**
 * The registry. Grouped by where the glyph mainly lives, but every key is a
 * flat, global name - there is no per-category namespacing.
 */
const PATHS = {
  // ---- Chrome / navigation (footer-nav, gallery, projects, profile, folder-tiles) ----
  search: MAGNIFIER,
  // Lucide "plane" - the offline nudge's trip metaphor (views/offline-nudge.ts).
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  // merged: identical in footer-nav.ts (NAV_ICONS.help) and featured-row.ts (HELP_ICON)
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  // merged: gallery.ts INFO_ICON (two <path>s) + profile.ts INFO_ICON (one combined <path>) drew the same glyph
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  // Warning triangle (Lucide triangle-alert). Used by the export preflight findings and
  // the aspect-warning surface - an amber "check this" mark, not an error stop.
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  dashboard: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  // Lucide "house" - the /start studio's always-available escape to the front
  // door (Tools). A history-independent Home, so a studio reached mid-session is
  // never a one-way trip regardless of what sits in the back stack.
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  // plain outline (no check) - the /valid hero fallback + drop-zone glyph
  shield: SHIELD_OUTLINE,
  // merged: footer-nav.ts NAV_ICONS.shield ("Verify" nav link) === profile.ts VERIFY_SHIELD, byte-identical
  shieldCheck: `${SHIELD_OUTLINE}${CHECK_TICK}`,
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  // merged: projects.ts CHEVRON_ICON === gallery.ts CHEVRON_RIGHT === profile.ts COLLAPSE_CHEV (same shape, was a <polyline>)
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  // merged: projects.ts BACK_ICON === gallery.ts CHEVRON_LEFT
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minus: '<path d="M5 12h14"/>',
  menu: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  // solid dot-menu - pass { filled: true }
  menuDots: '<circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  // The back pill's leading mark (components/back-pill.ts). A stroked Lucide
  // arrow so the pill reads as one of the top-row chrome set rather than the
  // text "←" glyph it used to draw from a ::before.
  arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  // Lucide "pin" - the gallery card's "available offline" toggle (filled via CSS when active).
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
  // Lucide "download" - the gallery card's "keep available offline" idle state.
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  // Lucide "circle-check" - the "available offline" done state (circle filled with
  // the accent + contrasting tick via the gallery's .pin-done rules).
  circleCheck: `<circle cx="12" cy="12" r="10"/>${CHECK_TICK}`,
  // A bare circle - the offline download's progress ring (CSS turns it into a
  // spinning arc with stroke-dasharray while a pin is in flight).
  ring: '<circle cx="12" cy="12" r="9"/>',
  // compound sort-direction glyph (two <g> arrows, toggled by CSS via .sd-up/.sd-down)
  sortDir: '<g class="sd-up"><path d="M8 20V5"/><polyline points="4 9 8 5 12 9"/></g><g class="sd-down"><path d="M16 4v15"/><polyline points="12 15 16 19 20 15"/></g>',
  // merged: projects.ts FILTER_ICON === gallery.ts FILTER_ICON
  filterLines: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  // merged: projects.ts HISTORY_ICON === gallery.ts HISTORY_ICON
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  play: '<path d="M5 3 19 12 5 21Z"/>',
  // Filled skip-to-frame glyphs for the animation transport bar (views/anim-transport.ts):
  // a bar plus a triangle, drawn solid via icon(..., { filled: true }).
  skipBack: '<path d="M6 6h2v12H6zM20 6v12l-9-6z"/>',
  skipForward: '<path d="M16 6h2v12h-2zM4 6l9 6-9 6z"/>',
  externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  // merged: valid.ts ICONS.pen === projects.ts EDIT_ICON (a 2.1 vs 2.12 arc-radius rounding difference)
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  move: '<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.7.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  duplicate: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  // Lucide move-horizontal - the docs reader's full-width reading toggle.
  'full-width': '<path d="m18 8 4 4-4 4"/><path d="m6 8-4 4 4 4"/><path d="M2 12h20"/>',
  folderPlus: '<path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.7.9H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>',
  filePlus: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  // merged: folder-tiles.ts / projects.ts / gallery.ts all defined the identical PACKAGE_ICON;
  // also now used for valid.ts's c2pa.placed/c2pa.published action glyph (was a near-identical rounding variant)
  package: PACKAGE_BOX,

  // ---- Component families (Lucide-style, 24px grid) ----
  // A horizontal capsule matches the shell's pill buttons.
  pill: '<rect x="3" y="7" width="18" height="10" rx="5"/>',
  messageCircle: '<path d="M7.9 20.1A9 9 0 1 0 3.9 16.1L2 22Z"/>',
  panelTop: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  toggleRight: '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="2"/>',

  // ---- Catalog category glyphs (category-icons.ts, catalog-summary.ts) ----
  // merged: category-icons.ts "credentials" - a rounded shield badge (distinct from the plain `shield`/`shieldCheck` pair above)
  credentialShield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>' + CHECK_TICK,
  hexagon: '<path d="M21 16.05V7.95a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4a2 2 0 0 0-1 1.73v8.1a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z"/><circle cx="12" cy="12" r="3"/>',
  layersStack: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  photos: '<rect x="6" y="2" width="16" height="16" rx="2"/><path d="M18 22H4a2 2 0 0 1-2-2V6"/><circle cx="12" cy="8" r="2"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L11 18"/>',
  headshot: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  // merged: category-icons.ts "icons" (triangle/square/circle) === catalog-summary.ts "vector" asset-type glyph
  shapes: '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  penTool: '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>',
  // merged: category-icons.ts "animations"/"lottie" === catalog-summary.ts "lottie" asset type (near-verbatim film-strip)
  filmStrip: FILM_STRIP,
  // merged: category-icons.ts "swatches" === catalog-summary.ts "palette", byte-identical
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  font: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  uploadImage: '<path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22.5v-6"/><circle cx="9" cy="9" r="2"/>',
  // merged: category-icons.ts "other" (GRID) === catalog-summary.ts "categoryOther"
  grid: GRID_4,

  // ---- catalog-summary.ts tool/status/asset-type glyphs ----
  // merged: catalog-summary.ts "everyone" === valid.ts ICONS.globe (a slightly different curve-radius rendering of the same Lucide "globe")
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  paintbrush: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  /** The clone/retouch rubber stamp - Retouch's action glyph (plan 124 WP-E). */
  stamp: '<path d="M5 22h14"/><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5a2.5 2.5 0 0 0-.73-1.77Z"/><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/>',
  // merged: catalog-summary.ts "event" === valid.ts ICONS.calendar (same Lucide "calendar", different rounding)
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  box: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  hammer: '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  flask: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  sunburst: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>' + CHECK_TICK,
  // merged: catalog-summary.ts "raster" === valid.ts ICONS.image === profile.ts's inline session-placeholder glyph
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  tokens: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  // merged: catalog-summary.ts "assetOther" === valid.ts ICONS.document
  document: '<path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',

  // ---- /valid-specific glyphs (no dupes elsewhere) ----
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  // The struck-through eye: a HIDDEN layer in the Design navigator, and the state its
  // own toggle shows. Same 24-grid and stroke weight as `eye`, so the two swap in place.
  eyeOff: '<path d="M3 3 21 21"/><path d="M10.2 5.2A11 11 0 0 1 12 5c7 0 11 7 11 7a19 19 0 0 1-3.4 4.3"/><path d="M6.9 7A19 19 0 0 0 1 12s4 7 11 7a11 11 0 0 0 4.4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  heart: '<path d="M12 20.3 4.2 12.5a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z"/>',
  link: '<path d="M9 15 15 9"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.5 2"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  userCheck: '<path d="M14 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8" cy="8" r="4"/><path d="M15 11.5l2.2 2.2 4.3-4.3"/>',
  sparkle: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>',
  lollipop: '<circle cx="9" cy="9" r="7"/><path d="M9 5a4 4 0 0 1 0 8 2 2 0 0 1 0-4"/><path d="m14 14 6 6"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.2 5.2l-6.1 6.1a1.5 1.5 0 0 0 2.1 2.1l6.1-6.1a4 4 0 0 0 5.2-5.2l-2.4 2.4-2-2z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  seal: '<circle cx="12" cy="9" r="6"/><path d="M9 14.2 8 22l4-2.5 4 2.5-1-7.8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  building: '<path d="M4 22V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v18"/><path d="M15 9h4a1 1 0 0 1 1 1v12"/><path d="M8 7h2M8 11h2M8 15h2M4 22h16"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.2" r="1.1"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  // Big central sparkle + two small twinkles - the "auto / AI generated" glyph.
  aiSpark: '<path d="M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15v3.5M17.25 16.75h3.5"/><path d="M5 3.5v3M3.5 5h3"/>',
  checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.3 1.3L6.5 5"/><path d="m3 12 1.3 1.3 2.2-2.3"/><path d="m3 18 1.3 1.3 2.2-2.3"/>',
  // A framed ripple - the "in-pixel imprint" glyph.
  imprint: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M6.5 13.5c1.8-3 3.6-3 5.5 0s3.7 3 5.5 0"/><path d="M6.5 9.5c1.8-2.4 3.6-2.4 5.5 0s3.7 2.4 5.5 0"/>',
  // Per-operation change-history glyphs - a recognisable mark for each edit we log.
  crop: '<path d="M6.13 1 6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13 16 6a2 2 0 0 1 2 2v15"/>',
  droplet: '<path d="M12 2.7l5.3 5.3a7.5 7.5 0 1 1-10.6 0z"/>',
  // Lucide "blend" - two overlapping circles. Reads as opacity / overlay, unlike the
  // droplet, which looks like a colour/tint control.
  opacity: '<circle cx="9" cy="9" r="7"/><circle cx="15" cy="15" r="7"/>',
  convert: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  resize: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
  // A vertical double-headed arrow. Drawn upright so it can be ROTATED by whoever uses it
  // - the visualizer turns it 45deg for its "enlarge" control, which is the conventional
  // diagonal expand affordance.
  arrowsV: '<path d="M12 4v16"/><path d="m8 8 4-4 4 4"/><path d="m8 16 4 4 4-4"/>',
  // Horizontal twin of arrowsV - a left/right double-arrow. Pairs with it as the pitch (X)
  // / yaw (Y) tilt pair; roll (Z) is the circular rotateCw below.
  arrowsH: '<path d="M4 12h16"/><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/>',
  // Single clockwise circular arrow (Lucide rotate-cw) - an in-plane spin, i.e. roll.
  rotateCw: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  // Translate handles - a double-arrow with a centre tick marking the moved object, so they
  // read as "move along X / Y" and stay distinct from the tilt rotation arrows above.
  moveX: '<path d="M2 12h20"/><path d="m6 8-4 4 4 4"/><path d="m18 8 4 4-4 4"/><path d="M12 8.5v7"/>',
  moveY: '<path d="M12 2v20"/><path d="m8 6 4-4 4 4"/><path d="m8 18 4 4 4-4"/><path d="M8.5 12h7"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  // Drag-handle dots (2×3). Meant for `{ filled: true }` - solid dots read as a grip.
  grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  // rows-and-columns grid: the Batch view's mark (a spreadsheet of renders)
  table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  // Image fit modes - a deliberately symmetric pair: the same frame, with the
  // artwork drawn OVERFLOWING it (fill/crop) or INSET within it (fit whole). The
  // difference between the two glyphs is the whole message, so they only read
  // side by side or as a toggle that swaps between them.
  fitCover: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="6" y="1" width="12" height="22" rx="1"/>',
  fitContain: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="6" y="8" width="12" height="8" rx="1"/>',
  // Stacked planes - "composite of multiple elements".
  layers: '<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  // Microphone - "recorded live from the microphone".
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M8 21h8"/>',
  // Lucide "speech" - a voice with sound waves. The Script audio surfaces
  // (Utilities card + #/script writing view): words in, a spoken voice out.
  // Deliberately NOT `mic` (that claims live capture) or `music` (a tune).
  speech: '<path d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.95 1 4.8a.2.2 0 0 1 .2.2v3.5"/><path d="M19.8 17.8a7.5 7.5 0 0 0 .003-10.603"/><path d="M17 15a3.5 3.5 0 0 0-.025-4.975"/>',
  // Two overlapping chat bubbles (Lucide messages-square) - a spoken exchange as
  // text: the Transcript panel (plans/174), edit-video-by-editing-the-words.
  transcript: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  // A screen on a stand - "captured from the screen" (IPTC screenCapture). Deliberately
  // NOT the camera glyph: a screenshot is a different claim from a photograph.
  monitor: '<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',

  // ---- sound-toggle.ts / neuro-dock.ts ----
  // merged: sound-toggle.ts NEURO_ICON === neuro-dock.ts NOTE (a heartbeat/waveform), byte-identical
  neuroBeat: '<path d="M2 12h3l2-7 4 18 3-14 2 7h6"/>',
  volumeOn: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  volumeOff: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',

  // ---- tool-actions.ts export bar ----
  // Lucide rotate-cw - the "Regenerate music" button on the video audio-track card.
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>',
  // Lucide repeat - the catalog's upload "Replace" action (swap bytes, keep the id).
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  // The export panel's "dock to the side" control (lib/export-panel-float.ts) - 
  // Lucide panel-left: a framed area with a rail down the left edge.
  dock: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',

  // ---- timeline panel (views/timeline-panel.ts) ----
  // These five replace the CSS-drawn `.tl-glyph` pseudo-element drawings that the
  // panel used while the registry had no entry for them. Zoom is deliberately a
  // magnifying glass with a sign in the lens, not a bare +/− : a lone plus next to
  // the panel's other add affordances read as "add", not "zoom".
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  // Lucide `upload` - the tray-and-arrow every drop zone in the app wears.
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  zoomIn: `${MAGNIFIER}<path d="M8 11h6"/><path d="M11 8v6"/>`,
  zoomOut: `${MAGNIFIER}<path d="M8 11h6"/>`,
  // Lucide pause / scissors.
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  /**
   * The clip inspector's **Animate** group (enter/exit kind + duration + curve).
   * Two axes and an ease curve rising between them - the same picture
   * components/easing-editor.ts plots, so the group header and the control it
   * opens onto read as one thing. Nothing else in the registry says "a value
   * moving over time": `sparkle`/`aiSpark` mean generated, `zap` means fast,
   * `convert` means round-trip.
   */
  animate: '<path d="M4 4v16h16"/><path d="M7 17c6.5 0 3.5-10 10-10"/>',
  /**
   * The clip inspector's **Keyframes** group, and the diamond vocabulary the
   * timeline strip uses for a pose (plans/104 section 8). A keyframe has been a diamond
   * since the first NLE; no registry glyph came close.
   */
  keyframe: '<path d="M12 3 21 12 12 21 3 12Z"/>',
  /**
   * Lucide `unlink` - break the A/V link between a picture and the sound detached
   * from it. The paired direction re-uses `link`, which the bar's link chip
   * already wears, so the two directions of one relationship look related.
   */
  unlink: '<path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.72"/><path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M8 2v3"/><path d="M2 8h3"/><path d="M16 19v3"/><path d="M19 16h3"/>',

  // ---- Atmosphere layers (the player's background-noise beds, music-player.ts) ----
  // Lucide cloud-rain / waves / wind / flame; `noise` is Lucide audio-waveform, the
  // one row-glyph shared by the three noise colours (they differ by label, not by
  // scene - a fake "pink" vs "brown" pictogram would only mislead).
  cloudRain: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
  waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  noise: '<path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/>',
  // Lucide cloud-lightning / bird / moon / coffee / building-2 / train-front / keyboard.
  cloudLightning: '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
  bird: '<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  // Windchimes - no Lucide equivalent, so drawn in the same house style: the
  // suspension bar, four tubes of falling length, and the clapper disc below.
  chimes: '<path d="M4 4h16"/><path d="M7 4v9"/><path d="M11 4v12"/><path d="M15 4v8"/><path d="M19 4v11"/><circle cx="13" cy="19.5" r="2"/><path d="M13 16v1.5"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  city: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',

  // ---- object align / distribute / stacking order (shared with the free-canvas editors) ----
  // Object alignment (two bars snapping to an edge/centre) - distinct from text-align icons.
  alignL: '<line x1="4" y1="3.5" x2="4" y2="20.5"/><rect x="7" y="5.5" width="13" height="4.5" rx="1"/><rect x="7" y="14" width="8" height="4.5" rx="1"/>',
  alignC: '<line x1="12" y1="3.5" x2="12" y2="20.5"/><rect x="5" y="5.5" width="14" height="4.5" rx="1"/><rect x="8" y="14" width="8" height="4.5" rx="1"/>',
  alignR: '<line x1="20" y1="3.5" x2="20" y2="20.5"/><rect x="4" y="5.5" width="13" height="4.5" rx="1"/><rect x="9" y="14" width="8" height="4.5" rx="1"/>',
  alignT: '<line x1="3.5" y1="4" x2="20.5" y2="4"/><rect x="5.5" y="7" width="4.5" height="13" rx="1"/><rect x="14" y="7" width="4.5" height="8" rx="1"/>',
  alignM: '<line x1="3.5" y1="12" x2="20.5" y2="12"/><rect x="5.5" y="5" width="4.5" height="14" rx="1"/><rect x="14" y="8" width="4.5" height="8" rx="1"/>',
  alignB: '<line x1="3.5" y1="20" x2="20.5" y2="20"/><rect x="5.5" y="4" width="4.5" height="13" rx="1"/><rect x="14" y="9" width="4.5" height="8" rx="1"/>',
  distH: '<line x1="4" y1="3.5" x2="4" y2="20.5"/><line x1="20" y1="3.5" x2="20" y2="20.5"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distV: '<line x1="3.5" y1="4" x2="20.5" y2="4"/><line x1="3.5" y1="20" x2="20.5" y2="20"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  orderFront: '<rect x="6" y="13" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M3 3h18"/><path d="M12 10V6"/><path d="m8.5 9.5 3.5-3.5 3.5 3.5"/>',
  orderForward: '<rect x="6" y="13" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M12 10V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/>',
  orderBackward: '<rect x="6" y="3" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M12 14v6"/><path d="m8.5 16.5 3.5 3.5 3.5-3.5"/>',
  orderBack: '<rect x="6" y="3" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M3 21h18"/><path d="M12 14v4"/><path d="m8.5 14.5 3.5 3.5 3.5-3.5"/>',

  // ---- editor bar (views/design-topbar.ts, plan 179 M1) ----
  // The history pair and the three view verbs the Design top bar shows. They were
  // drawn as a local `GLYPH` map in that module first; minted here on 2026-09-02 so
  // the bar and the editor rail can say the same thing with one picture (rec 5).
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/>',
  /** Four corner brackets - "fit everything on screen". */
  fitAll: '<path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/>',
  /** The "#" artboard mark - "fit the artboard I am on". */
  fitArtboard: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
  /** Playhead plus three frame chevrons - the sequence/timeline panel toggle. */
  timeline: '<path d="M4 9v6"/><path d="M1 12h6"/><path d="M9 6.5l5 5.5-5 5.5"/><path d="M13 6.5l5 5.5-5 5.5"/><path d="M17 6.5l5 5.5-5 5.5"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** Shared visual metaphors. Consumers choose a stable concept; the glyph choice
 *  stays here alongside its paths, independent of section titles and copy.
 *  Use `icon(ICON_METAPHORS.colour, opts)` anywhere that concept appears. */
export const ICON_METAPHORS = {
  colour: 'droplet',
  design: 'penTool',
  primitives: 'shapes',
  buttons: 'pill',
  tabs: 'panelTop',
  badges: 'tag',
  surfaces: 'layersStack',
  inputs: 'sliders',
  dialogs: 'duplicate',
  toggles: 'toggleRight',
  callouts: 'messageCircle',
  navigation: 'dock',
  gallery: 'image',
  catalog: 'grid',
  brandStudio: 'palette',
  toolInputs: 'filterLines',
  export: 'download',
  batch: 'table',
  multiEdit: 'layers',
  projects: 'folder',
  profile: 'user',
  verify: 'shieldCheck',
  foundations: 'building',
  tokens: 'tokens',
  audit: 'checklist',
} as const satisfies Record<string, IconName>;

export type IconMetaphor = keyof typeof ICON_METAPHORS;

/** Every registered glyph name, derived from `PATHS` so callers (e.g. the
 *  #/components specimen gallery) never hand-sync a duplicate list. */
export const iconNames = Object.keys(PATHS) as IconName[];

/** True when `name` has a registry entry - lets a caller feed an untrusted/dynamic key
 *  through without a TS cast (mirrors the old maps' `?? fallback` pattern). */
export function hasIcon(name: string): name is IconName {
  return Object.hasOwn(PATHS, name);
}

/**
 * Build a 24×24 `<svg>` string for a registered glyph. Returns `''` for an
 * unregistered name (callers that need a fallback glyph should check
 * `hasIcon()` first, or use `??`/`||` against another `icon()` call).
 */
export function icon(name: IconName, opts: IconOpts = {}): string {
  const paths = PATHS[name];
  if (!paths) return '';
  const { size, className, strokeWidth = 2, filled = false } = opts;
  const attrs = [
    'viewBox="0 0 24 24"',
    // Declared explicitly so XML consumers work too: innerHTML auto-namespaces
    // <svg>, but DOMParser('image/svg+xml') does NOT - collab-pill's iconNode
    // got null-namespace elements that never rendered (live UI and walker
    // shots both; the walker serialised them as xmlns="", found 2026-08-10).
    'xmlns="http://www.w3.org/2000/svg"',
    size != null ? `width="${size}" height="${size}"` : '',
    filled ? 'fill="currentColor"' : 'fill="none"',
    filled ? '' : 'stroke="currentColor"',
    filled ? '' : `stroke-width="${strokeWidth}"`,
    filled ? '' : 'stroke-linecap="round"',
    filled ? '' : 'stroke-linejoin="round"',
    className ? `class="${className}"` : '',
    'aria-hidden="true"',
  ].filter(Boolean).join(' ');
  return `<svg ${attrs}>${paths}</svg>`;
}
