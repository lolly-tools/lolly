// SPDX-License-Identifier: MPL-2.0
/**
 * Shared tile + badge markup for the folder overlay and the asset picker.
 *
 * Pure HTML-string builders - no host, no DOM events. Consumers (folder-overlay.js,
 * picker.js) own the delegated click handling via the data-* hooks each tile
 * carries. Kept free of pro/ imports so the (removable) /pro folder stays optional.
 *
 * Previews are stored-thumb + metadata only: we never live-render here. A batch
 * session has no single thumbnail, so it shows a package glyph plus metadata badges.
 */
import { escape, safeHref } from './utils.ts';
import { icon } from './lib/icons.ts';

// Batch-slot helpers are the shared, /pro-free lib module now (finding #13),
// re-exported here so existing importers (folder-overlay, projects) are unchanged.
export { BATCH_SLOT_PREFIX, isBatchSlot } from './lib/batch-slots.ts';
// Local binding for isBatchSlot used below (a re-export creates no in-scope name).
import { isBatchSlot } from './lib/batch-slots.ts';

/** A host.state.list() row as the tiles read it. */
export interface SessionEntry {
  slot: string;
  toolId?: string;
  label?: string | null;
  filename?: string | null;
  thumb?: string | null;
  updatedAt?: string | null;
}

/** The slice of a tool's catalog index entry a session tile reads. */
export interface TileToolInfo {
  formats?: readonly string[];
  width?: number | string;
  height?: number | string;
  unit?: string;
  exportable?: boolean;
}

/** Explicit per-session output metadata (wins over the tool's index entry). */
export interface SessionTileMeta {
  format?: string;
  width?: number | string;
  height?: number | string;
  unit?: string;
  rowCount?: number;
}

/** One cell of a folder tile's 2×2 mosaic, resolved by the caller. */
export interface MemberPreview {
  thumb?: string | null;
  url?: string | null;
  batch?: boolean;
}

/** A user image AssetRef as the image tile reads it. */
export interface ImageTileRef {
  id: string;
  url?: string | null;
  format?: string;
  meta?: { name?: string | null };
}

// Export-format display labels (mirrors the subset used by the gallery/tool views).
const FMT_LABEL: Record<string, string> = {
  'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', jpeg: 'JPG', jpg: 'JPG',
  webm: 'WebM', mp4: 'MP4', emf: 'EMF', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', dxf: 'DXF', pptx: 'PowerPoint',
  ics: 'Calendar', vcf: 'vCard', ico: 'Icon',
  zip: 'ZIP', csv: 'CSV', json: 'JSON', svg: 'SVG', 'svg-anim': 'Animated SVG', pdf: 'PDF', png: 'PNG',
  webp: 'WebP', 'webp-anim': 'Animated WebP', avif: 'AVIF', html: 'HTML', md: 'Markdown', txt: 'Text', gif: 'GIF',
};
export const fmtLabel = (f: string | null | undefined): string => (f != null ? FMT_LABEL[f] : undefined) ?? String(f ?? '').toUpperCase();

// lucide "package" - placeholder thumbnail for batch sessions (no single render).
// Path data lives in lib/icons.ts as 'package' - also used by projects.ts/gallery.ts's
// identical PACKAGE_ICON (component-audit rec 5).
export const PACKAGE_ICON = icon('package');
// lucide "folder"
export const FOLDER_ICON = icon('folder');
// lucide "more-horizontal" - the per-tile overflow (move / rename / delete) trigger.
export const MENU_ICON = icon('menu');
// lucide "check" - the tick shown inside a selected tile's selection toggle.
// width/height are set on the SVG itself (not only via CSS) so the tick can never
// balloon to the intrinsic SVG default if it's ever painted before/without the
// `.tile-check svg` sizing rule (the cause of the "giant tick" flash during a batch render).
export const CHECK_ICON = icon('check', { size: 13, strokeWidth: 3 });

/**
 * A multi-select toggle for a tile - a BUTTON that is a SIBLING of `.tile-primary`
 * (never nested inside it: an interactive control inside the tile's <button> lets
 * Space/Enter double-fire the open action). Opt-in via the tile builders' `selectable`
 * opt, so the folder overlay / picker (which don't pass it) are unaffected. State is on
 * `aria-pressed`; the caller toggles it + the wrapper's `.is-selected` in place.
 */
function selectToggle(ref: string, kind: string, selected: boolean, name: string): string {
  return `<button type="button" class="tile-check" data-select="${escape(ref)}" data-kind="${kind}" aria-pressed="${selected ? 'true' : 'false'}" aria-label="Select ${escape(name)}">${CHECK_ICON}</button>`;
}

// ── Badges ──────────────────────────────────────────────────────────────────

export function fmtBadge(format: string | null | undefined): string {
  return format ? `<span class="tile-badge tile-badge--fmt">${escape(fmtLabel(format))}</span>` : '';
}
// The canvas size chip - "1080×1080 px" / "210×297 mm". Pixels are rounded (they're
// integers anyway); a physical unit keeps its authored precision so "8.5×11 in" isn't
// mangled to "9×11". Mirrors the gallery card's dimText.
export function dimBadge(w: number | string | undefined, h: number | string | undefined, unit: string | undefined): string {
  if (!w || !h) return '';
  const u = unit && unit !== 'px' ? unit : 'px';
  const n = (v: number | string) => (u === 'px' ? Math.round(v as number) : +(+v).toFixed(2));
  return `<span class="tile-badge">${n(w)}×${n(h)} ${u}</span>`;
}
export function rowCountBadge(n: number | undefined): string {
  return n ? `<span class="tile-badge tile-badge--rows">${n} row${n === 1 ? '' : 's'}</span>` : '';
}

// Format from a filename extension when richer metadata isn't loaded (cheap path).
function fmtFromName(name: string | null | undefined): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name ?? ''));
  return m ? m[1]!.toLowerCase() : '';
}

// ── Tiles ─────────────────────────────────────────────────────────────────

/** Options for {@link sessionTile}. */
export interface SessionTileOpts {
  toolName?: string;
  sizeBytes?: number;
  meta?: SessionTileMeta;
  tool?: TileToolInfo | null;
  selectable?: boolean;
  selected?: boolean;
  /** List-view column strings (plans/133 WP-2). */
  cols?: TileCols;
  /** When set, the primary cover is a real `<a href>` (plans/133 WP-13) so
   *  middle/Cmd-click can open it in a new tab; the view still intercepts the
   *  plain click. Omit (folder overlay, picker) and it stays a button. */
  href?: string;
}

/**
 * A saved session tile.
 * @param entry  host.state.list() row: { slot, toolId, label, filename, thumb, updatedAt }
 * @param opts   { toolName, sizeBytes, meta:{ format, width, height, rowCount },
 *                 tool } - `tool` is the tool's catalog index entry
 *                 ({ formats, width, height, unit, exportable }); it supplies the
 *                 tool's INTENDED output (format + canvas size) so the tile reads the
 *                 same "what you'll get" spec as the gallery card. Explicit `meta`
 *                 values win over it.
 */
export function sessionTile(entry: SessionEntry, { toolName = '', sizeBytes = 0, meta = {}, tool = null, selectable = false, selected = false, cols, href }: SessionTileOpts = {}): string {
  const batch = isBatchSlot(entry.slot);
  const title = batch
    ? (entry.label || 'Batch session')
    : (entry.label || entry.filename || toolName || entry.toolId || 'Saved session');

  const cover = batch
    ? `<span class="tile-cover tile-cover--batch" aria-hidden="true">${PACKAGE_ICON}</span>`
    : entry.thumb
      ? `<img class="tile-cover" src="${escape(entry.thumb)}" alt="" loading="lazy" decoding="async">`
      : `<span class="tile-cover tile-cover--empty" aria-hidden="true"></span>`;

  // Intended output spec, drawn from the tool's index entry (primary format + canvas
  // size at its unit). Non-exportable transforms (strip-data etc.) have no fixed
  // output, so they show nothing - matching how the gallery drops the spec line.
  // Falls back to the filename extension only when the tool isn't in the index.
  const exportable = tool ? tool.exportable !== false : true;
  let format = '', width: number | string | undefined, height: number | string | undefined, unit: string | undefined;
  if (!batch) {
    format = meta.format
      || (tool ? (exportable ? (tool.formats?.[0] ?? '') : '') : fmtFromName(entry.filename));
    width  = meta.width  ?? (exportable ? tool?.width  : undefined);
    height = meta.height ?? (exportable ? tool?.height : undefined);
    unit   = meta.unit   ?? tool?.unit;
  }

  const badges = [
    batch ? '<span class="tile-badge tile-badge--type">Batch</span>' : fmtBadge(format),
    dimBadge(width, height, unit),
    batch ? rowCountBadge(meta.rowCount) : '',
    sizeBytes ? `<span class="tile-badge tile-badge--size">${fmtBytes(sizeBytes)}</span>` : '',
  ].filter(Boolean).join('');

  return tileShell({
    ref: entry.slot, kind: 'session', batch,
    cover, title,
    sub: relativeTime(entry.updatedAt),
    badges,
    openAttr: 'data-open-session',
    openLabel: batch ? `Open batch ${title}` : `Resume ${title}`,
    selectable, selected, href,
    cols: cols ?? {
      kind: batch ? 'Batch' : (toolName || 'Session'),
      count: sizeBytes ? fmtBytes(sizeBytes) : '',
      when: relativeTime(entry.updatedAt),
    },
  });
}

/** Options for {@link imageTile} - the Projects grid opts in to selection; the folder
 *  overlay / picker leave both false (unchanged). */
export interface ImageTileOpts {
  selectable?: boolean;
  selected?: boolean;
  /** Sub-line under the name; defaults to "Image". The Projects grid passes "Catalog
   *  image" for a referenced catalog asset so it reads distinctly from an upload. */
  sub?: string;
}

/**
 * A user (or referenced catalog) image tile.
 * @param ref  AssetRef: { id, url, format, meta:{ name } }
 */
export function imageTile(ref: ImageTileRef, { selectable = false, selected = false, sub = 'Image' }: ImageTileOpts = {}): string {
  const name = ref.meta?.name || 'Image';
  const cover = ref.url
    ? `<img class="tile-cover" src="${escape(ref.url)}" alt="" loading="lazy" decoding="async">`
    : `<span class="tile-cover tile-cover--empty" aria-hidden="true"></span>`;
  return tileShell({
    ref: ref.id, kind: 'image', batch: false,
    cover, title: name,
    sub,
    badges: fmtBadge(ref.format),
    openAttr: 'data-open-image',
    openLabel: `Use image ${name}`,
    selectable, selected,
    cols: { kind: 'Image', count: ref.format ? fmtLabel(ref.format) : '', when: '' },
  });
}

/** Options for {@link folderTile}. */
export interface FolderTileOpts {
  memberPreviews?: readonly MemberPreview[];
  count?: number;
  selectable?: boolean;
  selected?: boolean;
  /** Favourited folder - shows the corner star (the Projects view also sorts
   *  starred folders first). */
  starred?: boolean;
  /** Real `<a href>` cover (see SessionTileOpts.href). */
  href?: string;
}

/**
 * A folder tile with a 2×2 mosaic of its first members.
 * @param folder         { id, name, items }
 * @param memberPreviews array of up to 4 { thumb?, url?, batch? } resolved by the caller
 * @param count          optional item count for the sub-line (defaults to items.length);
 *                       the Projects view passes items + sub-folders so a nested folder
 *                       reads "N items" inclusive of its sub-folders.
 */
export function folderTile(folder: { id: string; name: string; items?: readonly unknown[]; color?: string; emoji?: string; updatedAt?: string }, { memberPreviews = [], count, selectable = false, selected = false, starred = false, href }: FolderTileOpts = {}): string {
  count = count ?? folder.items?.length ?? 0;
  const cells = memberPreviews.slice(0, 4).map(p => {
    if (p.batch) return `<span class="folder-cell folder-cell--batch" aria-hidden="true">${PACKAGE_ICON}</span>`;
    const src = p.thumb || p.url;
    return src
      ? `<img class="folder-cell" src="${escape(src)}" alt="" loading="lazy" decoding="async">`
      : `<span class="folder-cell folder-cell--empty" aria-hidden="true"></span>`;
  }).join('');
  // A folder-SHAPED cover (plans/133 WP-1): a tabbed silhouette so containers
  // read differently from the sessions' 4/3 document cards, tinted by the
  // folder's optional accent colour, with an optional emoji identity mark and
  // the favourite star in the corner.
  const accent = folder.color ? ` style="--folder-tint:${escape(folder.color)}"` : '';
  const inner = cells
    ? `<span class="folder-mosaic">${cells}</span>`
    : `<span class="folder-cover-glyph">${FOLDER_ICON}</span>`;
  const cover = `<span class="folder-cover"${accent} aria-hidden="true">
      ${folder.emoji ? `<span class="folder-emoji">${escape(folder.emoji)}</span>` : ''}
      ${inner}
      ${starred ? `<span class="folder-star">★</span>` : ''}
    </span>`;

  const [open, close] = primaryTag(href, `data-open-folder="${escape(folder.id)}" aria-label="Open folder ${escape(folder.name)}"`);
  return `
    <div class="folder-tile folder-tile--folder${selected ? ' is-selected' : ''}" data-ref="${escape(folder.id)}" data-kind="folder">
      ${selectable ? selectToggle(folder.id, 'folder', selected, folder.name) : ''}
      ${open}
        ${cover}
        <span class="tile-meta">
          <span class="tile-title" title="${escape(folder.name)}">${escape(folder.name)}</span>
          <span class="folder-count" title="${count} item${count === 1 ? '' : 's'}" aria-label="${count} item${count === 1 ? '' : 's'}">${escape(compactCount(count))}</span>
        </span>
        <span class="tile-cols" aria-hidden="true"><span class="tile-col">Folder</span><span class="tile-col">${count} item${count === 1 ? '' : 's'}</span><span class="tile-col">${folder.updatedAt ? relativeTime(folder.updatedAt) : ''}</span></span>
      ${close}
      <button type="button" class="tile-menu-btn" data-menu="${escape(folder.id)}" data-menu-kind="folder" aria-label="Folder actions">${MENU_ICON}</button>
    </div>`;
}

/** The primary cover's open/close tags: an `<a href>` when the caller gave one
 *  (draggable="false" so the TILE's own HTML5 drag, not a link drag, starts),
 *  else the plain button every tile had before. */
function primaryTag(href: string | undefined, attrs: string): [string, string] {
  // Links only for schemes the shell trusts (utils.safeHref): a caller-supplied
  // javascript:/data: href degrades to the plain button, exactly like no href.
  return href && safeHref(href)
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
    ? [`<a class="tile-primary" href="${escape(href)}" draggable="false" ${attrs}>`, '</a>']
    : [`<button type="button" class="tile-primary" ${attrs}>`, '</button>'];
}

// ── Rows ──────────────────────────────────────────────────────────────────
// A row is the same domain object as sessionTile() (thumb + title + subtitle +
// bytes, plus a batch variant) laid out as a compact list row instead of a grid
// tile - the gallery's per-tool history list and the profile Storage manager's
// session list (component-audit rec 6). The two callers differ in chrome (a
// full-row open/resume trigger vs a leading select checkbox; an inline "batch"
// pill vs folding it into the subtitle text; which HTML tag carries the title,
// since each view's own stylesheet still keys off that tag) - kept as slots/opts
// here rather than forked implementations. `rowClass`/`thumbClass`/etc. are each
// view's own CSS hook so their existing stylesheets keep matching unchanged.
function clsAttr(c: string | undefined): string {
  return c ? ` class="${c}"` : '';
}

/** Options for {@link sessionRow}. */
export interface SessionRowOpts {
  /** Class(es) on the <li> - each view's own CSS hook (e.g. 'saved-row saved-row--batch' / 'store-sess'). */
  rowClass: string;
  /** Extra raw (already-escaped) attribute(s) on the <li>, e.g. `data-search="…"`. */
  rowAttrs?: string;
  /** Base thumb class - a plain <img> gets exactly this. */
  thumbClass: string;
  /** Extra raw attrs on the <img> thumb (views differ: aria-hidden vs loading="lazy"). */
  thumbImgAttrs?: string;
  /** Batch-session thumbnail glyph; omit to fall through to the normal empty-thumb
   *  placeholder (profile's rows don't special-case batch thumbnails). */
  batchIcon?: string;
  /** Class appended (after thumbClass) for the batch glyph state; defaults to `${thumbClass}--batch`. */
  batchThumbClass?: string;
  /** Inner content of the no-thumbnail placeholder (profile's grey "image" glyph; gallery's is empty). */
  emptyThumbContent?: string;
  /** Class appended (after thumbClass) for the empty state; defaults to `${thumbClass}--empty`. */
  emptyThumbClass?: string;
  /** Wraps the row in a full-bleed open/resume trigger (gallery's history list;
   *  profile's Storage manager has no open action). Raw already-escaped attrs
   *  besides aria-label. */
  openClass?: string;
  openAttrs?: string;
  openLabel?: string;
  /** Leading multi-select checkbox (profile's Storage manager; gallery has none). */
  selectClass?: string;
  selectLabel?: string;
  /** Meta block (title + subtitle). */
  metaClass: string;
  titleTag?: string;
  titleClass?: string;
  title: string;
  /** Inline pill right after the title (profile's "batch" tag); leave unset and
   *  fold batch wording into `subtitle` yourself instead (gallery's style). */
  batchTag?: string;
  batchTagClass?: string;
  subTag?: string;
  subClass?: string;
  subtitle: string;
  /** Size chip; only rendered when there are bytes to show (matches both views). */
  sizeBytes?: number;
  sizeClass?: string;
  /** Delete button; only rendered when an attribute is supplied. */
  deleteAttr?: string;
  deleteClass?: string;
  deleteLabel?: string;
  deleteTitle?: string;
}

/**
 * One saved-session ROW (as opposed to {@link sessionTile}'s grid tile) - the
 * shared shape behind the gallery's per-tool history list and the profile
 * Storage manager's session list. Resolves the batch/thumb/size fallback chain
 * once; each caller supplies its own CSS-hook classes and opts into the
 * affordances it needs (selection, an open trigger, delete) as slots.
 */
export function sessionRow(entry: SessionEntry, opts: SessionRowOpts): string {
  const batch = isBatchSlot(entry.slot);
  const TTag = opts.titleTag ?? 'span';
  const STag = opts.subTag ?? 'span';

  const thumb = (batch && opts.batchIcon)
    ? `<span class="${opts.thumbClass} ${opts.batchThumbClass ?? `${opts.thumbClass}--batch`}" aria-hidden="true">${opts.batchIcon}</span>`
    : entry.thumb
      ? `<img class="${opts.thumbClass}" src="${escape(entry.thumb)}" alt=""${opts.thumbImgAttrs ? ` ${opts.thumbImgAttrs}` : ''}>`
      : `<span class="${opts.thumbClass} ${opts.emptyThumbClass ?? `${opts.thumbClass}--empty`}" aria-hidden="true">${opts.emptyThumbContent ?? ''}</span>`;

  const openBtn = opts.openAttrs
    ? `<button type="button"${clsAttr(opts.openClass)} ${opts.openAttrs} aria-label="${escape(opts.openLabel ?? '')}"></button>`
    : '';
  const checkbox = opts.selectClass
    ? `<input type="checkbox" class="${opts.selectClass}" data-slot="${escape(entry.slot)}" aria-label="${escape(opts.selectLabel ?? '')}">`
    : '';
  const batchTagEl = opts.batchTag
    ? `<span${clsAttr(opts.batchTagClass)}>${escape(opts.batchTag)}</span>`
    : '';
  const sizeEl = opts.sizeBytes
    ? `<span class="${opts.sizeClass ?? 'session-size'}">${fmtBytes(opts.sizeBytes)}</span>`
    : '';
  const deleteBtn = opts.deleteAttr
    ? `<button type="button"${clsAttr(opts.deleteClass)} ${opts.deleteAttr}${opts.deleteTitle ? ` title="${escape(opts.deleteTitle)}"` : ''} aria-label="${escape(opts.deleteLabel ?? '')}">&#x2715;</button>`
    : '';

  return `
    <li class="${opts.rowClass}"${opts.rowAttrs ? ` ${opts.rowAttrs}` : ''}>
      ${openBtn}${checkbox}${thumb}
      <span class="${opts.metaClass}">
        <${TTag}${clsAttr(opts.titleClass)}>${escape(opts.title)}${batchTagEl}</${TTag}>
        <${STag}${clsAttr(opts.subClass)}>${escape(opts.subtitle)}</${STag}>
      </span>
      ${sizeEl}
      ${deleteBtn}
    </li>`;
}

// Shared wrapper for session/image tiles.
/** List-view column strings (pre-formatted by the caller). */
export interface TileCols { kind: string; count: string; when: string }

interface TileShellOpts {
  ref: string;
  kind: string;
  batch: boolean;
  cover: string;
  title: string;
  sub: string;
  badges: string;
  openAttr: string;
  openLabel: string;
  selectable?: boolean;
  selected?: boolean;
  cols?: TileCols;
  href?: string;
}

/** The list view's aligned columns (Kind · Items/Size · Modified, plans/133
 *  WP-2); grid mode hides them in CSS, so every tile can carry them. */
export function tileColsHtml(cols: TileCols): string {
  return `<span class="tile-cols" aria-hidden="true"><span class="tile-col">${escape(cols.kind)}</span><span class="tile-col">${escape(cols.count)}</span><span class="tile-col">${escape(cols.when)}</span></span>`;
}

function tileShell({ ref, kind, batch, cover, title, sub, badges, openAttr, openLabel, selectable = false, selected = false, cols, href }: TileShellOpts): string {
  const [open, close] = primaryTag(href, `${openAttr}="${escape(ref)}" aria-label="${escape(openLabel)}"`);
  return `
    <div class="folder-tile${selected ? ' is-selected' : ''}" data-ref="${escape(ref)}" data-kind="${kind}"${batch ? ' data-batch="1"' : ''}>
      ${selectable ? selectToggle(ref, kind, selected, title) : ''}
      ${open}
        ${cover}
        <span class="tile-meta">
          <span class="tile-title" title="${escape(title)}">${escape(title)}</span>
          ${sub ? `<span class="tile-sub">${escape(sub)}</span>` : ''}
          ${badges ? `<span class="tile-badges">${badges}</span>` : ''}
        </span>
        ${cols ? tileColsHtml(cols) : ''}
      ${close}
      <button type="button" class="tile-menu-btn" data-menu="${escape(ref)}" data-menu-kind="${kind}" aria-label="Item actions">${MENU_ICON}</button>
    </div>`;
}

// ── Time / size helpers (shared) ────────────────────────────────────────────
// Canonical implementations live in ./lib/format.ts; re-exported here so
// existing importers of these names keep working.
export { relativeTime, fmtBytes } from './lib/format.ts';
// Local bindings for the two used above (a re-export creates no in-scope name).
import { relativeTime, fmtBytes, compactCount } from './lib/format.ts';
