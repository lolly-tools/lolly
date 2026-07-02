// SPDX-License-Identifier: MPL-2.0
/**
 * Shared tile + badge markup for the folder overlay and the asset picker.
 *
 * Pure HTML-string builders — no host, no DOM events. Consumers (folder-overlay.js,
 * picker.js) own the delegated click handling via the data-* hooks each tile
 * carries. Kept free of pro/ imports so the (removable) /pro folder stays optional.
 *
 * Previews are stored-thumb + metadata only: we never live-render here. A batch
 * session has no single thumbnail, so it shows a package glyph plus metadata badges.
 */
import { escape } from './utils.ts';
import { isBatchSlot } from './batch-slots.ts';

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
  webm: 'WebM', mp4: 'MP4', emf: 'EMF', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', ics: 'Calendar', vcf: 'vCard', ico: 'Icon',
  zip: 'ZIP', csv: 'CSV', json: 'JSON', svg: 'SVG', pdf: 'PDF', png: 'PNG',
  webp: 'WebP', avif: 'AVIF', html: 'HTML', md: 'Markdown', txt: 'Text', gif: 'GIF',
};
export const fmtLabel = (f: string | null | undefined): string => (f != null ? FMT_LABEL[f] : undefined) ?? String(f ?? '').toUpperCase();

// lucide "package" — placeholder thumbnail for batch sessions (no single render).
export const PACKAGE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
// lucide "folder"
export const FOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
// lucide "more-horizontal" — the per-tile overflow (move / rename / delete) trigger.
export const MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
// lucide "check" — the tick shown inside a selected tile's selection toggle.
export const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/**
 * A multi-select toggle for a tile — a BUTTON that is a SIBLING of `.tile-primary`
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
// The canvas size chip — "1080×1080 px" / "210×297 mm". Pixels are rounded (they're
// integers anyway); a physical unit keeps its authored precision so "8.5×11 in" isn't
// mangled to "9×11". Mirrors the gallery card's dimText.
export function dimBadge(w: number | string | undefined, h: number | string | undefined, unit: string | undefined): string {
  if (!w || !h) return '';
  const u = unit && unit !== 'px' ? unit : 'px';
  const n = (v: number | string) => (u === 'px' ? Math.round(Number(v)) : +(+v).toFixed(2));
  return `<span class="tile-badge">${n(w)}×${n(h)} ${u}</span>`;
}
export function rowCountBadge(n: number | undefined): string {
  return n ? `<span class="tile-badge tile-badge--rows">${n} row${n === 1 ? '' : 's'}</span>` : '';
}

// Format from a filename extension when richer metadata isn't loaded (cheap path).
function fmtFromName(name: string | null | undefined): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name ?? ''));
  return m?.[1]?.toLowerCase() ?? '';
}

// ── Tiles ─────────────────────────────────────────────────────────────────

/**
 * A saved session tile.
 * @param entry  host.state.list() row: { slot, toolId, label, filename, thumb, updatedAt }
 * @param opts   { toolName, sizeBytes, meta:{ format, width, height, rowCount },
 *                 tool } — `tool` is the tool's catalog index entry
 *                 ({ formats, width, height, unit, exportable }); it supplies the
 *                 tool's INTENDED output (format + canvas size) so the tile reads the
 *                 same "what you'll get" spec as the gallery card. Explicit `meta`
 *                 values win over it.
 */
export interface SessionTileOpts {
  toolName?: string;
  sizeBytes?: number;
  meta?: SessionTileMeta;
  tool?: TileToolInfo | null;
  selectable?: boolean;
  selected?: boolean;
}

export function sessionTile(entry: SessionEntry, { toolName = '', sizeBytes = 0, meta = {}, tool = null, selectable = false, selected = false }: SessionTileOpts = {}): string {
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
  // output, so they show nothing — matching how the gallery drops the spec line.
  // Falls back to the filename extension only when the tool isn't in the index.
  const exportable = tool ? tool.exportable !== false : true;
  let format = '';
  let width: number | string | undefined, height: number | string | undefined, unit: string | undefined;
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
    selectable, selected,
  });
}

/**
 * A user image tile.
 * @param ref  user AssetRef: { id, url, format, meta:{ name } }
 */
export function imageTile(ref: ImageTileRef): string {
  const name = ref.meta?.name || 'Image';
  const cover = ref.url
    ? `<img class="tile-cover" src="${escape(ref.url)}" alt="" loading="lazy" decoding="async">`
    : `<span class="tile-cover tile-cover--empty" aria-hidden="true"></span>`;
  return tileShell({
    ref: ref.id, kind: 'image', batch: false,
    cover, title: name,
    sub: 'Image',
    badges: fmtBadge(ref.format),
    openAttr: 'data-open-image',
    openLabel: `Use image ${name}`,
  });
}

/**
 * A folder tile with a 2×2 mosaic of its first members.
 * @param folder         { id, name, items }
 * @param memberPreviews array of up to 4 { thumb?, url?, batch? } resolved by the caller
 * @param count          optional item count for the sub-line (defaults to items.length);
 *                       the Projects view passes items + sub-folders so a nested folder
 *                       reads "N items" inclusive of its sub-folders.
 */
export interface FolderTileOpts {
  memberPreviews?: readonly MemberPreview[];
  count?: number;
  selectable?: boolean;
  selected?: boolean;
}

export function folderTile(
  folder: { id: string; name: string; items?: readonly unknown[] },
  { memberPreviews = [], count, selectable = false, selected = false }: FolderTileOpts = {},
): string {
  count = count ?? folder.items?.length ?? 0;
  const cells = memberPreviews.slice(0, 4).map(p => {
    if (p.batch) return `<span class="folder-cell folder-cell--batch" aria-hidden="true">${PACKAGE_ICON}</span>`;
    const src = p.thumb || p.url;
    return src
      ? `<img class="folder-cell" src="${escape(src)}" alt="" loading="lazy" decoding="async">`
      : `<span class="folder-cell folder-cell--empty" aria-hidden="true"></span>`;
  }).join('');
  const mosaic = cells
    ? `<span class="folder-mosaic">${cells}</span>`
    : `<span class="tile-cover tile-cover--batch" aria-hidden="true">${FOLDER_ICON}</span>`;

  return `
    <div class="folder-tile folder-tile--folder${selected ? ' is-selected' : ''}" data-ref="${escape(folder.id)}" data-kind="folder">
      ${selectable ? selectToggle(folder.id, 'folder', selected, folder.name) : ''}
      <button type="button" class="tile-primary" data-open-folder="${escape(folder.id)}" aria-label="Open folder ${escape(folder.name)}">
        ${mosaic}
        <span class="tile-meta">
          <span class="tile-title" title="${escape(folder.name)}">${escape(folder.name)}</span>
          <span class="tile-sub">${count} item${count === 1 ? '' : 's'}</span>
        </span>
      </button>
      <button type="button" class="tile-menu-btn" data-menu="${escape(folder.id)}" data-menu-kind="folder" aria-label="Folder actions">${MENU_ICON}</button>
    </div>`;
}

// Shared wrapper for session/image tiles.
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
}

function tileShell({ ref, kind, batch, cover, title, sub, badges, openAttr, openLabel, selectable = false, selected = false }: TileShellOpts): string {
  return `
    <div class="folder-tile${selected ? ' is-selected' : ''}" data-ref="${escape(ref)}" data-kind="${kind}"${batch ? ' data-batch="1"' : ''}>
      ${selectable ? selectToggle(ref, kind, selected, title) : ''}
      <button type="button" class="tile-primary" ${openAttr}="${escape(ref)}" aria-label="${escape(openLabel)}">
        ${cover}
        <span class="tile-meta">
          <span class="tile-title" title="${escape(title)}">${escape(title)}</span>
          ${sub ? `<span class="tile-sub">${escape(sub)}</span>` : ''}
          ${badges ? `<span class="tile-badges">${badges}</span>` : ''}
        </span>
      </button>
      <button type="button" class="tile-menu-btn" data-menu="${escape(ref)}" data-menu-kind="${kind}" aria-label="Item actions">${MENU_ICON}</button>
    </div>`;
}

// ── Time / size helpers (shared) ────────────────────────────────────────────

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24; if (d < 7) return `${Math.round(d)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
