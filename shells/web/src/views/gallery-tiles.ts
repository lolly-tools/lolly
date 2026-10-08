// SPDX-License-Identifier: MPL-2.0
/**
 * Gallery tiles: the markup of one Tools or Utilities card, and the small label
 * helpers it shares with the gallery view (moved out of views/gallery.ts, which
 * mounts, wires and paints them).
 *
 * One markup serves every browse layout (components/browse-layout.ts). A tile carries,
 * from its first paint, the pieces Card draws and Grid does not: the Continue button
 * (`.gtile-resume-link`), the quiet "+ New" icon (`.gtile-new-icon`), the status line
 * (`.gtile-status`), the formats line on a utility and the detail cells
 * (`.tile-cols`, which describe the tile outside Grid). Each is `display: none` in
 * Grid (styles/parts/browse-layout.css), so a layout switch only flips an attribute
 * and Grid draws exactly what it drew before.
 */
import { escape as escapeHtml } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { toolSupport } from '../capabilities.ts';
import { resolveExamples } from '../components/featured-row.ts';
import { displayFormatOf } from '../lib/featured-render.ts';
import { CHECK_ICON } from '../folder-tiles.ts';
import { carouselDotsMarkup, carouselNavMarkup } from './gallery-carousel.ts';
import type { StateEntry } from '@lolly-tools/core/host-v1';
import type { FeaturedVariant } from '../components/featured-row.ts';
import type { GalleryTool, UtilityView } from './gallery.ts';

// Most example looks a gallery tile's preview strip will show (after the lead slide).
// Keeps the carousel DOM + the number of live renders per tile bounded.
const EXAMPLE_MAX = 6;

/** A saved-session entry as returned by host.state.list(). */
export type SavedEntry = StateEntry & { filename: string | null; thumb: string | null; openedAt?: string };

// Short category names for the filter pills / card sub-lines - distinct from the
// longer feature-flag labels (e.g. "Tools for Everyone") shown in profile settings.
const CAT_LABEL: Record<string, string> = { everyone: 'Everyone', designer: 'Designer', event: 'Event', utility: 'Utilities' };
export const catLabel = (c: string | undefined) => CAT_LABEL[c as string] || (c ? c[0]!.toUpperCase() + c.slice(1) : 'Other');
export const statusLabel = (s: string | undefined) => ({ official: 'Official', community: 'Community', experimental: 'Experimental' } as Record<string, string>)[s as string] || s;

// Export-format display labels (mirrors the subset used by the tool view).
const FMT_LABEL: Record<string, string> = {
  'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', tiff: 'TIFF', jpeg: 'JPG', jpg: 'JPG',
  webm: 'WebM', mp4: 'MP4', emf: 'EMF', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', dxf: 'DXF', pptx: 'PowerPoint',
  ics: 'Calendar', vcf: 'vCard', ico: 'Icon', penpot: 'Penpot',
  zip: 'ZIP', csv: 'CSV', json: 'JSON', svg: 'SVG', 'svg-anim': 'Animated SVG', pdf: 'PDF', png: 'PNG',
  webp: 'WebP', 'webp-anim': 'Animated WebP', avif: 'AVIF', html: 'HTML', md: 'Markdown', txt: 'Text', gif: 'GIF', apng: 'aPNG',
};
export const fmtLabel = (f: string) => FMT_LABEL[f] ?? String(f).toUpperCase();

// Always-present backup art for a tile: the tool's own icon. The icon is INLINED into
// the catalog index (never a network fetch), so unlike a committed preview PNG/SVG - a
// build artifact that can 404 on a fresh install / before `pnpm run previews` - it can
// never fail to load. It sits BEHIND every preview image and carousel (z-index:-1, see
// gallery.css .gtile-iconfill) as an instant, on-brand placeholder while lazy art
// decodes, and as the permanent fallback if a preview is missing or errors - so a gallery
// tile never shows a broken image or an empty box. '' when a tool has no icon (rare - the
// tile's checkerboard background still stands in).
function iconBackdrop(icon: string | undefined): string {
  if (!icon) return '';
  // Two stacked copies of the icon: a static muted BASE, and a green TRACE on top
  // whose stroke-dasharray leaves only a short segment drawn and whose animated
  // stroke-dashoffset walks that green segment along the icon's outline - a "drawing"
  // shimmer shown WHILE a preview is still loading. The trace is transparent wherever
  // it isn't currently stroking, so the muted base shows through (green passes over a
  // stretch, then it's muted again). CSS stops the trace once art loads / on the
  // permanent icon-only fallback / under reduced-motion (see .gtile-iconfill in gallery.css).
  return `<span class="gtile-iconfill" aria-hidden="true">`
    + `<span class="gtile-iconfill-base">${icon}</span>`
    + `<span class="gtile-iconfill-trace">${icon}</span>`
    + `</span>`;
}

/**
 * The theme-filtered example looks for a tool's gallery preview strip, each paired with
 * its ORIGINAL index in the manifest list (the render cache key `featured:<id>:<i>` is
 * keyed on that index, so it's shared with the featured hero row and stays stable
 * whichever looks the current theme filters in). Capped at EXAMPLE_MAX. Empty for a
 * tool with no examples, no raster format, or one the shell can't run.
 */
export function galleryExampleLooks(tool: GalleryTool, darkTheme: boolean, max = EXAMPLE_MAX): Array<{ v: FeaturedVariant; i: number }> {
  if (!displayFormatOf(tool.formats)) return [];
  return resolveExamples(tool)
    .map((v, i) => ({ v, i }))
    // Same theme filter as the featured row: a reverse/white look on a light tile (or a
    // dark look on a dark tile) would be near-invisible on the checkerboard backdrop.
    .filter(({ v }) => !v.theme || (v.theme === 'dark') === darkTheme)
    .slice(0, max);
}

/** The profile-favourites key for a utility VIEW card - namespaced so it can
 *  never collide with a tool id. */
export const viewFavKey = (id: string): string => `view:${id}`;

/** The top-left multi-select dot every gallery tile carries - the same
 *  `.tile-check` primitive as projects/catalog tiles (folder-tiles.ts), with a
 *  gallery-scoped reveal (gallery.css). `ref` doubles as the tile's selection
 *  key: the tool id, or `view:<id>` for a utility view card. */
const selectDot = (ref: string, name: string): string =>
  `<button type="button" class="tile-check" data-select="${escapeHtml(ref)}" aria-pressed="false" aria-label="${escapeHtml(tRaw('Select {name}', { name }))}">${CHECK_ICON}</button>`;

const PLUS_ICON = icon('plus');
// The Tools glyph from the view toggle, for a tool whose index entry has no icon.
const FALLBACK_ICON = icon('hammer');

/** The id of a tile's detail cells, which its name link names in `data-describedby`. */
const cellsId = (ref: string): string => `gtc-${ref}`;

/**
 * A tile's detail cells, in column order. List draws them as columns; outside Grid
 * they are the name link's description (components/browse-layout.ts). Each value sits
 * in a <bdi>, so "2d ago" or a format keeps its own direction in a right-to-left row.
 * A comma no one sees comes before every value after the first, so a screen reader
 * reads "2d ago, PNG, Designer" rather than one run of words. Empty cells add none.
 */
function detailCells(ref: string, cells: ReadonlyArray<readonly [col: string, value: string]>): string {
  let filled = 0;
  return `<span class="tile-cols" id="${escapeHtml(cellsId(ref))}">${cells.map(([col, value]) => {
    const sep = value && filled++ ? '<span class="visually-hidden">, </span>' : '';
    return `<span class="tile-col" data-col="${col}">${value ? `${sep}<bdi>${escapeHtml(value)}</bdi>` : ''}</span>`;
  }).join('')}</span>`;
}

/** Up to three export formats, for a utility card's Card line. */
const formatsLine = (tool: GalleryTool): string =>
  (tool.exportable !== false ? tool.formats ?? [] : []).slice(0, 3).map(fmtLabel).join(' · ');

export function viewCardMarkup(v: UtilityView): string {
  const ref = `view-${v.id}`;
  return `
    <article class="gtile gtile--utility gtile--view" data-view-card="${escapeHtml(v.id)}" data-select-ref="${escapeHtml(viewFavKey(v.id))}">
      ${selectDot(viewFavKey(v.id), v.name)}
      <div class="gtile-body gtile-body--link">
        <div class="gtile-cap">
          <span class="tool-card-icon" aria-hidden="true">${icon(v.icon, { size: 24 })}</span>
          <span class="gtile-meta">
            ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - v.href comes from the hardcoded utilityViews() table ('#/verify', '#/unpack', '#/lab', '#/data', '#/script') */ ''}
            <a class="gtile-name" href="${escapeHtml(v.href)}" data-describedby="${escapeHtml(cellsId(ref))}">${escapeHtml(v.name)}</a>
            <p class="gtile-desc">${escapeHtml(v.description)}</p>
            ${detailCells(ref, [['opened', ''], ['format', ''], ['description', v.description]])}
          </span>
        </div>
      </div>
    </article>`;
}

export function cardMarkup(
  tool: GalleryTool,
  latest: SavedEntry | undefined,
  shellCaps: readonly string[] | undefined,
  darkTheme = false,
  utilityLayout = false,
  eager = false,
  /** The starting-point line (plans/226): "Starts with X", "N templates", or nothing.
   *  Composed by the mount, which is where the hidden overlay and the person's own
   *  templates live; this function only places the line. */
  templateLine = '',
): string {
  const sup = toolSupport(tool, shellCaps);
  const unavailable = sup.status === 'unavailable';

  const statusBadge = unavailable
    ? `<span class="badge badge-desktop">${t('Desktop')}</span>`
    : sup.status === 'install'
      ? `<span class="badge badge-install">${t('Add&#8209;on')}</span>`
      : (tool.status !== 'official'
          ? `<span class="badge badge-${tool.status}"${tool.status === 'experimental' ? ` title="${escapeHtml(t('Experimental - exports carry a PREVIEW watermark until the tool graduates.'))}"` : ''}>${escapeHtml(t(statusLabel(tool.status) || ''))}</span>`
          : '');

  // A tool with no icon in the index still needs something in Card's thumbnail slot;
  // Grid hides this stand-in (styles/parts/browse-layout.css) and draws what it always drew.
  const iconSvg = tool.icon
    ? `<span class="tool-card-icon" aria-hidden="true">${tool.icon}</span>`
    : `<span class="tool-card-icon tool-card-icon--fallback" aria-hidden="true">${FALLBACK_ICON}</span>`;
  // A url-source injected tool opens preconfigured (its URL-mode query); every other
  // tool opens blank. escapeHtml() the query for the attribute (its & becomes &amp;).
  const openHref = `#/tool/${escapeHtml(tool.id)}${tool.openQuery ? `?${escapeHtml(tool.openQuery)}` : ''}`;
  const describedBy = ` data-describedby="${escapeHtml(cellsId(tool.id))}"`;
  const hasSession = !!latest && !unavailable;          // resumable, with or without a preview
  const lastOpened = hasSession ? relativeTime(sessionCaptionTime(latest!)) : '';
  // Card's line 1 when the tool has a session: a real Continue button (Grid keeps
  // its own resume affordances and hides this one).
  const resumeLink = hasSession
    ? `<span class="gtile-resume"><button type="button" class="gtile-resume-link" data-resume="${escapeHtml(latest!.toolId)}" data-slot="${escapeHtml(latest!.slot)}"
         aria-label="${escapeHtml(tRaw('Continue {name}', { name: latest!.filename || tool.name }))}">${t('Continue · {time}', { time: lastOpened })}</button></span>`
    : '';
  // Card's status line. When the badge is drawn on a preview, the caption already
  // announces the status, so this copy is for the eye only. It comes right after the
  // name: Compact runs the detail text on after it and cuts that text from the end, so
  // the badge is never the piece cut off. Comfortable places every piece by grid row.
  const statusLine = (forEyeOnly: boolean): string => statusBadge
    ? `<span class="gtile-status"${forEyeOnly ? ' aria-hidden="true"' : ''}>${statusBadge}</span>` : '';

  // Utilities view (#/u): the icon alone is a clear enough affordance, so drop the
  // preview hero entirely and stack a larger icon ABOVE the title + description. The
  // card is a fixed landscape box (CSS clamps it between 4:3 and 16:9) so every tile
  // is the same height regardless of description length.
  if (utilityLayout) {
    const formats = formatsLine(tool);
    const uName = unavailable
      ? `<span class="gtile-name" aria-disabled="true"${describedBy}>${escapeHtml(tool.name)}</span>`
      : `<a class="gtile-name" href="${openHref}" data-new-tool="${escapeHtml(tool.id)}"${hasSession ? ` aria-label="${escapeHtml(tRaw('Start a new {name} session', { name: tool.name }))}"` : ''}${describedBy}>${escapeHtml(tool.name)}</a>`;
    return `
      <article class="gtile gtile--utility${unavailable ? ' gtile--unavailable' : ''}${hasSession ? ' gtile--resumable' : ''}" data-tool-id="${escapeHtml(tool.id)}" data-select-ref="${escapeHtml(tool.id)}">
        ${selectDot(tool.id, tool.name)}
        <div class="gtile-body${unavailable ? '' : ' gtile-body--link'}">
          <div class="gtile-cap">
            ${iconSvg}
            <span class="gtile-meta">
              ${uName}
              ${statusLine(false)}
              ${resumeLink}
              <p class="gtile-desc">${escapeHtml(tool.description ?? '')}</p>
              ${formats ? `<span class="gtile-fmts">${escapeHtml(formats)}</span>` : ''}
              ${detailCells(tool.id, [['opened', lastOpened], ['format', formats.split(' · ')[0] ?? ''], ['description', tool.description ?? '']])}
            </span>
            ${statusBadge}
          </div>
        </div>
      </article>
    `;
  }
  // A gallery cover shows what a new template/default produces in the active brand.
  // Saved-session images are still available through the tool's history controls.
  const paged = !unavailable && !!tool.paged && !!displayFormatOf(tool.formats) && !tool.templates?.length;
  const exampleLooks = (unavailable || paged) ? [] : galleryExampleLooks(tool, darkTheme);
  const hasExamples = exampleLooks.length > 0;
  const hasImageHero = hasExamples || paged;

  let visual: string;
  if (unavailable) {
    visual = `<span class="gtile-tile gtile-tile--static"><span class="gtile-tile-txt">${t('Desktop&nbsp;app only')}</span></span>`;
  } else if (paged) {
    // Multi-page document: rendered as a stacked DECK. Page count is unknown until the
    // doc renders, so start with one skeleton slide; hydratePaged (mountGallery) renders
    // the pages and rebuilds the deck. Box is a fixed square (gallery.css); each card is
    // sized to its page's aspect (deckPageFit), so landscape and portrait pages both read
    // as correctly-shaped sheets rather than letterboxed squares.
    visual = `
      <div class="gcar" data-tool="${escapeHtml(tool.id)}" data-paged="1">
        ${iconBackdrop(tool.icon)}
        <ol class="gcar-track"><li class="gcar-slide gcar-slide--ex" data-ex-index="0" data-look-pending><a class="gcar-open" href="${openHref}" data-new-tool="${escapeHtml(tool.id)}" tabindex="-1" aria-hidden="true"><img class="gcar-img" alt="" aria-hidden="true" decoding="async"></a></li></ol>
        ${statusBadge}
      </div>`;
  } else if (hasExamples) {
    // One slide per template, or the tool's default state. Images arrive from
    // the active-brand render cache as the tile approaches the viewport.
    const exSlides = exampleLooks.map(({ v, i }, k) =>
      `<li class="gcar-slide gcar-slide--ex" data-ex-index="${i}"${exampleLooks.length === 1 ? ' data-look-pending' : ''}${v.motion && v.templateId ? ` data-motion-template="${escapeHtml(v.templateId)}"` : ''}>
         <a class="gcar-open" href="${openHref}" data-new-tool="${escapeHtml(tool.id)}" tabindex="-1" aria-hidden="true">
           <img class="gcar-img" alt="" aria-hidden="true"${eager && k === 0 ? ' fetchpriority="high"' : ''} decoding="async">
         </a>
         ${v.motion && v.templateId ? `<button type="button" class="btn btn--sm gcar-motion-play" data-motion-play aria-pressed="false">${escapeHtml(t('Preview animation'))}</button><span class="gcar-motion-label">${escapeHtml(v.label ?? '')}</span>` : ''}
       </li>`).join('');
    // Nav + dots come from the look COUNT, which the manifest knows before the first
    // render starts - so a cold tile says how many looks are coming and which one it is
    // on, instead of reading as empty until the art arrives (plans/246). Each dot starts
    // pending and clears as its look loads or gives up; see views/gallery-carousel.ts.
    const slideCount = exampleLooks.length;
    const dots = carouselDotsMarkup(slideCount);
    const nav = carouselNavMarkup(slideCount);
    visual = `
      <div class="gcar" data-tool="${escapeHtml(tool.id)}">
        ${iconBackdrop(tool.icon)}
        <ol class="gcar-track">${exSlides}</ol>
        ${nav}
        ${dots}
        ${statusBadge}
      </div>`;
  } else if (hasSession) {
    // Session exists but its preview failed to capture - still resumable from the card.
    visual = `<button class="gtile-tile gtile-tile--resume" data-resume="${escapeHtml(latest!.toolId)}" data-slot="${escapeHtml(latest!.slot)}"
              aria-label="${escapeHtml(tRaw('Continue {name}', { name: latest!.filename || tool.name }))}"><span class="gtile-tile-txt">${t('Continue · {time}', { time: relativeTime(sessionCaptionTime(latest!)) })}</span></button>`;
  } else {
    // No session, no preview, no examples - still lead with the tool's icon (never
    // a network fetch, so never broken) so the tile is a real, on-brand card rather
    // than a bare line of text. Decorative duplicate of the name link (tabindex/
    // aria-hidden so AT hears one link).
    visual = `<a class="gtile-tile gtile-tile--iconled" href="${openHref}" data-new-tool="${escapeHtml(tool.id)}" tabindex="-1" aria-hidden="true">${tool.icon ? `<span class="gtile-tile-icon" aria-hidden="true">${tool.icon}</span>` : ''}<span class="gtile-tile-txt">${t('Open to start')}</span></a>`;
  }

  // Caption sub-line: when the resumable session was last opened or changed, and
  // only on resumable cards (plan 277 P10). The label says which time is shown:
  // "Last opened" only where the app recorded an open (the web app stamps one when a
  // saved item is reopened in a tool), else "Last modified", the save time Projects
  // sorts and labels by. It used to say "Last opened" over the save time.
  // The category is deliberately omitted here - it's discoverable via the filter
  // pills and shown in the info dialog - so the card stays about this tool itself.
  const sub = hasSession
    ? (latest!.openedAt
      ? t('Last opened · {time}', { time: relativeTime(latest!.openedAt) })
      : t('Last modified · {time}', { time: relativeTime(latest!.updatedAt) }))
    : '';

  // Export formats no longer clutter the card - they live in the About dialog now,
  // grouped by vector / raster with the default highlighted (see showInfoDialog).

  // The title is the "start a new session" link. A stretched ::after (see CSS)
  // makes the whole text body - caption + description - its click target, so a
  // fresh session is as easy to hit as the hero's Continue. On a tool that
  // already has a saved session the link carries an explicit aria-label so it
  // reads as "new" against the hero's "Continue".
  const name = unavailable
    ? `<span class="gtile-name" aria-disabled="true"${describedBy}>${escapeHtml(tool.name)}</span>`
    : `<a class="gtile-name" href="${openHref}" data-new-tool="${escapeHtml(tool.id)}"${hasSession ? ` aria-label="${escapeHtml(tRaw('Start a new {name} session', { name: tool.name }))}"` : ''}${describedBy}>${escapeHtml(tool.name)}</a>`;
  const newHref = `#/tool/${escapeHtml(tool.id)}?template=${tool.openQuery ? `&amp;${escapeHtml(tool.openQuery)}` : ''}`;
  const primaryFormat = tool.exportable !== false && tool.formats?.length ? fmtLabel(tool.formats[0]!) : '';

  return `
    <article class="gtile${unavailable ? ' gtile--unavailable' : ''}${hasImageHero ? ' gtile--has-preview' : ''}${hasSession ? ' gtile--resumable' : ''}" data-tool-id="${escapeHtml(tool.id)}" data-select-ref="${escapeHtml(tool.id)}">
      ${selectDot(tool.id, tool.name)}
      ${visual}
      <div class="gtile-body${unavailable ? '' : ' gtile-body--link'}">
        <div class="gtile-cap">
          ${iconSvg}
          <span class="gtile-meta">
            ${name}
            ${sub ? `<span class="gtile-sub">${sub}</span>` : ''}
            ${statusLine(hasImageHero)}
            ${resumeLink}
            <p class="gtile-desc">${escapeHtml(tool.description ?? '')}</p>
            ${templateLine && !unavailable
              // Curated starting points (plans/142): say they exist right on the card.
              // Opening the tool fresh presents the chooser, so the count IS the path -
              // unless this person set a "Start with", in which case the line says which one
              // and the chooser is one "+ New" click away (plans/226 section 4.4).
              ? `<span class="gtile-tpl">${escapeHtml(templateLine)}</span>`
              : ''}
            ${detailCells(tool.id, [['opened', lastOpened], ['format', primaryFormat], ['category', t(catLabel(tool.category))], ['description', tool.description ?? '']])}
          </span>
          ${unavailable ? ''
            // Persistent "+ New" action on every card: opens the tool's template
            // chooser via the empty-`?template=` boot flag (views/tool.ts reads it as
            // an explicit chooser ask); a tool with no templates just opens blank.
            // openQuery (url-source injected tools) rides along so their seed survives.
            // Card draws the same action as a quiet icon button at the card's end.
            : `<a class="gtile-new" href="${newHref}" data-new-tool="${escapeHtml(tool.id)}" aria-label="${escapeHtml(tRaw('Start a new {name} session', { name: tool.name }))}">${t('+ New')}</a>
               <a class="gtile-new-icon" href="${newHref}" data-new-tool="${escapeHtml(tool.id)}" aria-label="${escapeHtml(tRaw('New {name}', { name: tool.name }))}">${PLUS_ICON}</a>`}
          ${hasImageHero
            // Badge moved onto the preview image (see the hero markup), but that
            // hero is aria-hidden / aria-labelled, so keep the status announced.
            ? (statusBadge ? `<span class="visually-hidden">${escapeHtml(t(statusLabel(tool.status) || ''))}</span>` : '')
            : statusBadge}
        </div>
      </div>
    </article>
  `;
}

/** The time a resumable card shows: the recorded last open where there is one,
 *  else the last save (see the caption in the card builder). */
export function sessionCaptionTime(entry: SavedEntry): string {
  return entry.openedAt || entry.updatedAt;
}

export function relativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return t('just now');
  const m = s / 60; if (m < 60) return t('{n}m ago', { n: Math.round(m) });
  const h = m / 60; if (h < 24) return t('{n}h ago', { n: Math.round(h) });
  const d = h / 24; if (d < 7) return t('{n}d ago', { n: Math.round(d) });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
