// SPDX-License-Identifier: MPL-2.0
import { moveSessionSlot } from './tool-revision-history.ts';
/**
 * Projects view (route /p and /p/<folderId>).
 *
 * A gallery-style page over the FOLDERS of saved sessions (the same data the folder
 * overlay manages, surfaced as a first-class destination). Two modes:
 *
 *   ROOT (/p) - a grid of the TOP-LEVEL folder tiles, then the LOOSE saved
 *                          sessions (those in no folder - also reachable as the
 *                          synthetic /p/__uncat__ route), then the "+ New folder" /
 *                          "+ New asset" create tiles. Open a folder → /p/<id>.
 *   FOLDER (/p/<id>) - that folder's SUB-FOLDERS and saved sessions as tiles, a
 *                          breadcrumb of its ancestors, "+ New folder" (nests here) and
 *                          "+ New tool" tiles, a "Move to" rail of other folders as drop
 *                          targets, rename, and "Render folder" (export its whole subtree
 *                          as one nested batch zip).
 *
 * Folders nest: each folder has a `parentId` (see ../folders.js). Moving a session OR a
 * sub-folder is drag-and-drop (drop onto a folder tile / rail chip) with a per-tile
 * "Move to…" menu as the fallback; reparenting a folder is kept acyclic by the store.
 * Folders live on the profile via the pro-free folder store; rendering a folder gates a
 * dynamic import of ./pro so the Projects chunk stays light and /pro stays removable.
 */
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { createFolderStore, childFolders, folderPath, descendantFolderIds, TRASH_RETENTION_MS, FOLDER_COLORS } from '../folders.ts';
import type { Folder, FolderItem, TrashEntry, ProjectTemplate } from '../folders.ts';
import { TRASH_SLOT_PREFIX, PTPL_SLOT_PREFIX, isHiddenSlot } from '../lib/batch-slots.ts';
import { showUndoToast, flushUndoToasts } from '../lib/undo-toast.ts';
import { livePalette } from '../lib/live-palette.ts';
import { MULTI_EDIT_MIN, MULTI_EDIT_MAX } from '../lib/multi-edit-limits.ts';
import { svgDataUrl } from '../lib/format.ts';
import {
  folderTile, sessionTile, imageTile, tileColsHtml, FOLDER_ICON, MENU_ICON,
  isBatchSlot, BATCH_SLOT_PREFIX, fmtBytes,
  type MemberPreview,
} from '../folder-tiles.ts';
import type { PickerHost } from './picker.ts';   // type-only (erased); the value is lazy-imported in openAddPicker
import { wireTileSelect } from '../lib/tile-select.ts';
import { wireTileContextMenu, menuItemHtml } from '../lib/context-menu.ts';
import { loadProjectFavourites, saveProjectFavourites } from '../lib/project-favourites.ts';
import { bulkBarHtml as buildBulkBar, syncBulkBar as syncSharedBulkBar, wireEscapeClearsSelection } from '../lib/bulk-bar.ts';
import type { BulkBarConfig } from '../lib/bulk-bar.ts';
import { playProjectsAah, cancelArrivalAah } from '../lib/sfx.ts';
import { mountFeaturedRow } from '../components/featured-row.ts';
import type { FeaturedEntry, FeaturedRowHandle, FeaturedViewMode } from '../components/featured-row.ts';
import { viewTopbarHtml, mountViewTopbar } from '../components/view-topbar.ts';
import { projectsTopRight } from './projects-topbar.ts';
import { claimSearchBar, clearSearchBar } from '../components/search-bar.ts';
import {
  RETURN_KEY, armSessionReturn, sessionOpenHref,
  buildSessionHaystack, buildFolderHaystack, matchesHaystack,
} from '../lib/search/projects-source.ts';
import { tokenize } from '../lib/search/match.ts';
import { confirmDialog as baseConfirmDialog, choiceDialog, closeConfirmDialogs } from '../components/confirm-dialog.ts';
import type { ConfirmDialogOpts } from '../components/confirm-dialog.ts';
import { mountModal } from '../components/modal.ts';
import type { ModalHandle } from '../components/modal.ts';
import { startBatchExport } from '../lib/batch-job.ts';
import { announce } from '../a11y.ts';
import { soundSegmentHtml, wireSoundSegment } from '../components/sound-toggle.ts';
import { openShareDialog } from '../components/share-dialog.ts';
import { themeSegmentHtml, wireThemeSegment } from '../components/theme-toggle.ts';
import { serializeUrlState, ENGINE_VERSION } from '@lolly/engine';
import { createToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
import { getTool } from '../bridge/tool-loader.ts';
import type { UserTemplate } from '../lib/user-templates.ts';   // type-only (erased) - the store is lazy-imported
import type { ProjectedUserTool } from '../lib/user-tools.ts';   // type-only (erased) - the store is lazy-imported
import { setPendingToolSeed } from '../lib/drop-router.ts';
import { getSessionSource } from '../lib/session-source.ts';
// A leaf with no imports of its own (module state, no network/DOM), so this costs the
// Projects chunk nothing and drags no control-plane code onto any path - see its header.
import { rememberTeamSessionOrigin } from '../org/team-session-origin.ts';
import { getCollabTileProvider, renderCollabBadge } from '../lib/collab-tile-state.ts';
import type { HostV1, Profile, AssetRef } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import type { BatchFile } from '../pro/batch.ts';

// The web shell hands mountProjects its concrete host, whose state/assets/profile
// expose more than the tool-facing HostV1 contract: state.sizes(), a thumbnail-carrying
// 3-arg save(), the user-asset helpers, and profile.set(). We describe just that extra
// surface this view reaches for and cast to it at the (few) call sites - erased at
// runtime, no behaviour change. main.js passes the concrete WebHost (assignable to
// HostV1), so the parameter stays typed HostV1 and this narrows locally.
interface ProjectsHost extends HostV1 {
  state: WebStateAPI;
  assets: HostV1['assets'] & {
    // `type` is read here to keep the non-visual user assets (fonts, tokens, ICC
    // profiles) out of surfaces that tile the list as images.
    _listUserAssets(): Promise<ReadonlyArray<{ id: string; type: string }>>;
    _deleteUserAsset(id: string): Promise<void>;
  };
  profile: HostV1['profile'] & { set(profile: object): Promise<unknown> };
}

// Denormalised projection of a catalogue-index tool entry this view reads off
// window.__toolIndex - a build artifact, not a domain type the engine owns.
interface ProjectsTool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  formats?: readonly string[];
  width?: number;
  height?: number;
  unit?: string;
  exportable?: boolean;
}

/** A host.state.list() row, as this view reads it (WebStateAPI's return shape). */
type Entry = Awaited<ReturnType<WebStateAPI['list']>>[number];

// 'added' = creation time (createdAt, with a slot-timestamp fallback for legacy rows);
// 'modified' = last save (updatedAt) - the old catch-all 'date', which stored prefs
// migrate to on load. 'tool' groups by the owning tool (folder views only).
type SortBy = 'modified' | 'added' | 'name' | 'tool' | 'size';
type ViewMode = 'preview' | 'list';
// The two vocabularies a `#/p?view=&sort=` deep link is checked against. Sets, not
// object lookups - an object answers true for 'constructor' and every other inherited
// key (see lib/design-system/start-route.ts). The stored prefs above still parse with
// their own literal comparisons; these exist for the URL, which is untrusted input.
const VIEW_MODES = new Set<string>(['preview', 'list'] satisfies ViewMode[]);
const SORT_BYS = new Set<string>(['modified', 'added', 'name', 'tool', 'size'] satisfies SortBy[]);
type SelectKind = 'folder' | 'session' | 'image';   // images join via marquee (no checkbox)

/** Query result: the (capped) tiles to render plus the true `total` so the header can
 *  say "showing the first N of M" without holding every match's DOM. */
interface SearchMatches { folders: Folder[]; sessions: Entry[]; total: number; capped: boolean }
// Ceiling on rendered result tiles. A one- or two-character handoff query can match
// thousands of sessions; building that many tiles (+ their drag/select wiring) in one
// render is the one place this view could stall at scale, so we render the first slice
// and tell the user to narrow. Filtering still scans everything (it's O(n) over a
// prebuilt index) - only the DOM is bounded.
const SEARCH_LIMIT = 200;

/** Options passed in by main.js - a metrics hook injected so /pro isn't imported
 *  eagerly (see the batch export call sites below). */
interface MountProjectsOpts {
  onBatchRendered?: (files: BatchFile[]) => void;
  /** Raw route query string (#/p?q=…). `q` enters the explicit results mode
   *  (plans/99 section 2a) - read at mount only; exitSearch leaves by replacing the
   *  hash with the q-less form, which remounts (the signature carries ?q=). */
  params?: string;
}

// Sentinel folderId for the synthetic "Uncategorised" folder (sessions in no folder).
const UNCAT = '__uncat__';
// The Cut/Copy clipboard (plans/133 WP-7). MODULE scope on purpose: it must outlive
// a mount, so you can cut in one folder, open another, and paste there. Refs are
// re-validated at paste time (a cut session deleted meanwhile just drops out).
let clipboard: { mode: 'cut' | 'copy'; items: Array<{ ref: string; kind: 'folder' | 'session' | 'image' }> } | null = null;
// Ctrl-click is the context-menu gesture on Apple platforms, never a selection modifier there.
const IS_APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
// Set by the "+ New tool" tile so the next saved session files into this folder; read
// + cleared by the tool view after its first save. sessionStorage so it survives the
// navigation to the tool and dies with the tab.
const FILE_INTO_KEY = 'lolly:fileInto';

// (RETURN_KEY - the one-shot "Save returns to this page" marker - lives in
// lib/search/projects-source.ts now, shared with the spotlight's projects
// provider alongside the session-open semantics; imported above.)

// The Uncategorised view floats the same cinematic strip the gallery's Featured row uses
// (drift · Cover Flow · mobile grip) as a browsable ribbon of loose-session previews above
// the "Move to" rail. It honours the SAME view-mode preference the gallery persists, so
// switching to Cover Flow in the gallery carries over here.
const FEATURED_VIEW_STORAGE = 'lolly-featured-view';
const FEATURED_VIEWS: readonly FeaturedViewMode[] = ['gallery', 'coverflow'];

const FOLDER_PLUS_ICON = icon('folderPlus', { strokeWidth: 1.8 });
const FILE_PLUS_ICON = icon('filePlus', { strokeWidth: 1.8 });
const BACK_ICON = icon('chevronLeft');
const RENDER_ICON = icon('play');
// "history" (clock-rewind) - matches the gallery's saved-sessions button.
// "sliders-horizontal" - the gallery's filter/view-options button, reused here for
// view mode (preview/list) + sort.
// Context-menu glyphs (lucide house style). None of these existed in the codebase.
const OPEN_ICON = icon('externalLink', { strokeWidth: 1.9 });
const EDIT_ICON = icon('pen', { strokeWidth: 1.9 });
// lucide "copy" - duplicate a saved session into a fresh, independent copy.
const DUPLICATE_ICON = icon('duplicate', { strokeWidth: 1.9 });
// Star - favourite / unfavourite. Filled when the item is already a favourite.
const STAR_ICON = icon('star', { strokeWidth: 1.9 });
const STAR_FILLED_ICON = icon('star', { filled: true });
const SHEET_ICON = icon('grid', { strokeWidth: 1.9 });
const BATCH_ICON = icon('table', { strokeWidth: 1.9 });
const MOVE_ICON = icon('move', { strokeWidth: 1.9 });
const TRASH_ICON = icon('trash', { strokeWidth: 1.9 });
const PALETTE_ICON = icon('palette', { strokeWidth: 1.9 });
const INFO_ICON = icon('info', { strokeWidth: 1.9 });
const CHEVRON_ICON = icon('chevronRight');
// lucide "link" - the shareable-link glyph (matches the tool view's Share button).
const SHARE_ICON = icon('share', { strokeWidth: 1.9 });
// Clipboard verbs (plans/133 WP-7), download-originals (WP-6), project templates (WP-11a).
const CUT_ICON = icon('scissors', { strokeWidth: 1.9 });
const PASTE_ICON = icon('checklist', { strokeWidth: 1.9 });
const DOWNLOAD_ICON = icon('download', { strokeWidth: 1.9 });
const TEMPLATE_ICON = icon('layersStack', { strokeWidth: 1.8 });
const SELECT_ALL_ICON = icon('circleCheck', { strokeWidth: 1.9 });
// lucide "users" - the team-projects create tile (shown only when a control plane
// registers a session source; see lib/session-source.ts).
const TEAM_ICON = icon('users', { strokeWidth: 1.9 });
// (The bottom bar - nav links + search field - is the shell-level singleton in
// components/search-bar.ts, shared with every browse view; this view just claims it.)

export async function mountProjects(
  viewEl: HTMLElement,
  host: HostV1,
  folderId: string | null,
  opts: MountProjectsOpts = {},
): Promise<void> {
  const store = createFolderStore(host as ProjectsHost);
  // The soft "stacking clicks → puff of wind" arrival - only on the MAIN projects view
  // (folderId null), NOT every time a folder opens. One-shot, gesture-gated, silent when
  // sound's off; cancelled on leave (see _cleanup) so it can't fire on another page.
  if (!folderId) playProjectsAah();
  const w = window as typeof window & { __toolIndex?: { tools?: ProjectsTool[] } };
  const nameById = new Map((w.__toolIndex?.tools ?? []).map((tool): [string, string] => [tool.id, (tool as unknown as ProjectsTool).name]));
  const toolName = (id: string): string => nameById.get(id) || id || t('Saved session');
  // Full index entries (formats + intended width/height/unit) so session tiles can show
  // the same "what you'll get" spec the gallery cards do - see sessionTile's `tool` opt.
  const toolById = new Map((w.__toolIndex?.tools ?? []).map((t): [string, ProjectsTool] => [t.id, t as unknown as ProjectsTool]));

  // Live data, re-read on every reload() so a move/rename/delete reflects at once.
  let folders: Folder[] = [];
  let entries: Entry[] = [];          // host.state.list() rows
  let trashEntries: TrashEntry[] = []; // profile.trash (plans/133 WP-4)
  let templates: ProjectTemplate[] = []; // profile.projectTemplates (plans/133 WP-11a)
  let sizes: Record<string, number> = {};            // slot -> bytes
  // Derived indices, rebuilt once per reload() (see reindex()). `folders`/`entries` only
  // change in reload(), so these stay valid between renders and turn the per-tile lookups
  // below from O(entries)/O(folders×items) rebuilds-per-call into O(1) map hits - the
  // difference between linear and quadratic work when a project holds thousands of sessions.
  let entryMap = new Map<string, Entry>();       // slot → row
  let ownerByRef = new Map<string, Folder>();    // item ref (session OR image) → the folder that holds it
  let searchIndex = new Map<string, string>();   // slot → folded search haystack (lib/search/projects-source.ts)
  let uncatCache: Entry[] = [];                  // sessions filed into no folder
  // Folder IMAGE items resolved to AssetRefs (url/format/name) so their tiles + folder
  // mosaics can render. Keyed by the item ref: a user upload (`user/…`) or a catalog asset
  // referenced by id. Resolved once per reload() - folders hold few images relative to a
  // whole library, and get() is a local (offline) lookup for both id shapes.
  let imageRefs = new Map<string, AssetRef>();
  let profile: Profile | null = null;
  let headshotUrl = '';
  let mounted = true;        // false after the view is swapped out (guards async renders)
  let overlayModal: ModalHandle<any> | null = null;      // the move-picker / new-folder-name dialog, if open
  let releaseSearch: (() => void) | null = null;         // the shell search-bar claim (set in boot, below)
  let featuredHandle: FeaturedRowHandle | null = null; // the Uncategorised preview ribbon (drift/coverflow/grip), if mounted
  // Multi-select: ref → 'folder' | 'session'. A closure var (NOT the DOM) because
  // render() wipes viewEl.innerHTML - the selection is re-emitted from this Map each
  // render, and toggles update just the affected tile + the bulk bar in place.
  const selected = new Map<string, SelectKind>();
  // Starred project refs (folders / sessions / images), loaded from the profile in reload().
  let favourites = new Set<string>();
  let viewMode: ViewMode = 'preview';  // 'preview' (tile grid) | 'list'
  let sortBy: SortBy = 'modified';   // display preference - see the SortBy type note
  let sortRev = false;               // list-header second click reverses (plans/133 WP-2)
  // The results-mode query (trimmed). Non-empty ONLY via the ?q= URL param - the
  // spotlight's explicit "See all in Projects →" handoff (plans/99 section 2a): typing in the
  // bottom bar feeds the overlay and NEVER reshapes this view, so the user's items
  // can't seem to disappear without obvious context. When set, the view swaps to a
  // flat "results" grid searching the CURRENT scope's WHOLE subtree - every folder
  // and saved session nested beneath it - under an explicit "N results for X · Clear"
  // header. Exited only by exitSearch() (the bar's ✕/Escape via the claim's onClear,
  // or an in-body [data-search-clear]). Matching is the shared folded token-AND
  // (lib/search/projects-source.ts), so case is kept here for display.
  let query = (new URLSearchParams(opts.params || '').get('q') || '').trim();
  // The "sessions for these tools" filter (?tools=id,id) - where the gallery's
  // "View sessions" group action lands (root scope only). A flat results-style grid
  // of every saved session whose toolId is in the set, exited via its own status-line
  // Clear (which just navigates to the bare #/p). Distinct from `query`: no text
  // matching, and the search bar stays unclaimed by it.
  const toolsFilter = (new URLSearchParams(opts.params || '').get('tools') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  // Leave the ?tools= grid for the normal root, stripping the param from the URL
  // without a router round-trip (a same-folderId hash change is sig-deduped).
  function exitToolsFilter(): void {
    toolsFilter.length = 0;
    const h = window.location.href;
    const qi = h.indexOf('?');
    if (qi >= 0) {
      const params = new URLSearchParams(h.slice(qi + 1));
      params.delete('tools');
      const rest = params.toString();
      window.location.replace(h.slice(0, qi) + (rest ? `?${rest}` : ''));
    }
    render();
  }
  // Memoised searchMatches() result (invalidated on data reload + query change) so the two
  // callers in a render - pruneSelection + searchBodyHtml - don't each re-scan the tree.
  let searchCache: { q: string; scope: string | null; matches: SearchMatches } | null = null;
  // Recent-exports rail (plans/133 WP-10): the downloads log's reopen tiles,
  // rendered at the ROOT of /p now that this view is the one folder manager.
  // Collapsible, remembered per device (a convenience, not state that matters).
  let recentExports: Array<{ href: string; thumb: string; caption: string; at: number }> = [];
  const RECENTS_COLLAPSED_KEY = 'lolly-projects-recents-collapsed';
  let recentsCollapsed = ((): boolean => { try { return localStorage.getItem(RECENTS_COLLAPSED_KEY) === '1'; } catch { return false; } })();
  async function loadRecentExports(): Promise<void> {
    try {
      const { listExports, exportReopenHref } = await import('../lib/export-history.ts');
      recentExports = (await listExports(12))
        .filter(x => x.thumb)
        .map(x => ({ href: exportReopenHref(x), thumb: x.thumb!, caption: x.filename || x.label, at: x.at }));
    } catch { recentExports = []; }
  }
  try {
    if (localStorage.getItem('lolly:projectsView') === 'list') viewMode = 'list';
    const s = localStorage.getItem('lolly:projectsSort');
    if (s === 'name' || s === 'tool' || s === 'added' || s === 'modified' || s === 'size') sortBy = s;
    else if (s === 'date') sortBy = 'modified';   // pre-'added' prefs stored 'date'
    // Per-folder memory (plans/133 WP-2) wins over the device-global default.
    const perFolder = (JSON.parse(localStorage.getItem('lolly:projectsViewPrefs') || '{}') as Record<string, { v?: string; s?: string; r?: boolean }>)[folderId ?? '__root__'];
    if (perFolder) {
      if (perFolder.v === 'list' || perFolder.v === 'preview') viewMode = perFolder.v;
      if (perFolder.s === 'name' || perFolder.s === 'tool' || perFolder.s === 'added' || perFolder.s === 'modified' || perFolder.s === 'size') sortBy = perFolder.s;
      sortRev = !!perFolder.r;
    }
  } catch { /* localStorage unavailable */ }
  // `#/p?view=&sort=&rev` seed the same three for THIS mount, outranking both stored
  // layers above - what a shared link, a docs recipe or a screenshot run needs to land
  // on a known layout. Never written back to either localStorage key: a link someone
  // pasted must not rewrite their own view preference. Read at mount only, like `q`
  // and `tools`, and never propagated into a generated link. Sets, so an inherited key
  // ('constructor') can't pass; anything unrecognised leaves the stored value standing.
  const urlView = new URLSearchParams(opts.params || '').get('view');
  if (urlView && VIEW_MODES.has(urlView)) viewMode = urlView as ViewMode;
  const urlSort = new URLSearchParams(opts.params || '').get('sort');
  if (urlSort && SORT_BYS.has(urlSort)) sortBy = urlSort as SortBy;
  if (new URLSearchParams(opts.params || '').has('rev')) sortRev = true;

  async function reload(): Promise<void> {
    await loadRecentExports();
    [folders, entries, sizes, profile] = await Promise.all([
      store.list(),
      (host as ProjectsHost).state.list().catch(() => []),
      (host as ProjectsHost).state.sizes().catch(() => ({}) as Record<string, number>),
      host.profile.get().catch(() => null),
    ]);
    // Trashed sessions keep their state records under `__trash__:` slots, project
    // templates theirs under `__ptpl__:` - neither is a browsable tile.
    entries = entries.filter(e => !isHiddenSlot(e.slot));
    trashEntries = await store.trashList().catch(() => []);
    templates = await store.templateList().catch(() => []);
    favourites = loadProjectFavourites(profile);
    headshotUrl = profile?.headshot?.id
      ? (await host.assets.get(profile.headshot.id).catch(() => null))?.url || ''
      : '';
    // Self-heal stale refs (a session deleted elsewhere) so counts/mosaics are honest.
    await store.prune().catch(() => {});
    folders = await store.list();
    reindex();
    await resolveImages();
  }

  // Resolve every folder's IMAGE items to AssetRefs so their tiles / mosaics can paint.
  // A ref get() may fail (a race with a delete elsewhere) - those drop out and prune
  // reconciles the membership on the next pass.
  async function resolveImages(): Promise<void> {
    const refs = [...new Set(folders.flatMap(f => f.items.filter(i => i.type === 'image').map(i => i.ref)))];
    const resolved = await Promise.all(refs.map(ref =>
      host.assets.get(ref).then(r => [ref, r] as const).catch(() => null)));
    imageRefs = new Map(resolved.filter(Boolean) as [string, AssetRef][]);
  }

  // Rebuild the derived indices from the freshly-loaded folders/entries. One linear pass
  // each - everything downstream then reads O(1) instead of re-deriving per call/per tile.
  function reindex(): void {
    entryMap = new Map(entries.map(e => [e.slot, e]));
    ownerByRef = new Map();
    const claimed = new Set<string>();
    for (const f of folders) {
      for (const it of f.items) {
        // Every item (session OR image) lives in at most one folder (store invariant);
        // map it to its owner so a per-tile "remove"/"move" can find its home in O(1).
        ownerByRef.set(it.ref, f);
        if (it.type === 'session') claimed.add(it.ref);   // only sessions gate the Uncategorised bucket
      }
    }
    uncatCache = entries.filter(e => !claimed.has(e.slot));
    searchIndex = new Map(entries.map(e => [e.slot, buildSessionHaystack(e, toolName, isBatchSlot(e.slot))]));
    searchCache = null;   // matches depend on the data that just changed
  }

  const entryBySlot = (): Map<string, Entry> => entryMap;
  const uncategorised = (): Entry[] => uncatCache;

  // Resolve an item ref → a mosaic preview cell ({thumb}|{url}|{batch}) for folder tiles.
  // Sessions resolve via the state index; images via the resolved AssetRef map.
  function previewForRef(ref: string): MemberPreview | null {
    const e = entryMap.get(ref);
    if (e) return isBatchSlot(e.slot) ? { batch: true } : { thumb: e.thumb || null };
    const img = imageRefs.get(ref);
    return img?.url ? { url: img.url } : null;
  }
  function sessionsInFolder(f: Folder | null | undefined): Entry[] {
    return (f?.items ?? []).filter(i => i.type === 'session').map(i => entryMap.get(i.ref)).filter(Boolean) as Entry[];
  }

  // Sort helpers honouring the view-options menu. 'modified' is the default (recent first).
  function sortFolders(arr: readonly Folder[]): Folder[] {
    const a = [...arr];
    if (sortBy === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
    else if (sortBy === 'added') a.sort((x, y) => +new Date(y.createdAt || 0) - +new Date(x.createdAt || 0));
    else if (sortBy === 'modified') a.sort((x, y) => +new Date(y.updatedAt || y.createdAt || 0) - +new Date(x.updatedAt || x.createdAt || 0));
    else if (sortBy === 'size') a.sort((x, y) => tileItemCount(y) - tileItemCount(x));
    // 'tool' has no meaning for folders → keep stored order.
    if (sortRev) a.reverse();
    // Starred folders PIN first (plans/133 WP-1) - a stable second pass, so the
    // chosen sort still orders within the starred and unstarred bands.
    a.sort((x, y) => Number(favourites.has(y.id)) - Number(favourites.has(x.id)));
    return a;
  }
  // Tile / header count = every renderable file (session or image) in a folder's WHOLE
  // subtree - exactly what "Render folder" would output - so "N items" matches the number
  // of files you'd get even when they live in sub-folders. Sub-folders are containers, not
  // files, so they aren't counted themselves (a folder of two sub-folders holding 11
  // sessions reads "11 items", not "2"). Mirrors renderFolder's subtreeItems gather.
  const tileItemCount = (f: Folder): number =>
    [f.id, ...descendantFolderIds(folders, f.id)]
      .reduce((n, cid) => n + (folders.find(x => x.id === cid)?.items?.length ?? 0), 0);

  // ── selection helpers ───────────────────────────────────────────────────────
  const isSelected = (ref: string): boolean => selected.has(ref);
  const selectedByKind = (kind: SelectKind): string[] => [...selected].filter(([, k]) => k === kind).map(([ref]) => ref);
  // Selection is scoped to what the CURRENT view can show as a tile. Drop any selected
  // ref that isn't currently visible - deleted, OR moved out of view via drag / a per-tile
  // "Move to…" / the history overlay (none of which clear selection). This keeps the bulk
  // bar count honest and stops a bulk action (esp. Delete) from silently hitting an item
  // the user can no longer see was selected. Called at the top of every render().
  function pruneSelection(): void {
    if (!selected.size) return;
    const visible = new Set<string>();
    if (query) {
      // Searching swaps the grid for a flat results set spanning the subtree - the
      // selection stays valid for anything the results still show.
      const m = searchMatches();
      for (const f of m.folders) visible.add(f.id);
      for (const e of m.sessions) visible.add(e.slot);
    } else if (folderId == null && toolsFilter.length) {
      // The ?tools= results grid shows only the named tools' sessions.
      const set = new Set(toolsFilter);
      for (const e of entries) if (set.has(e.toolId)) visible.add(e.slot);
    } else if (folderId == null) {
      for (const f of childFolders(folders, null)) visible.add(f.id);
      for (const e of uncategorised()) visible.add(e.slot);   // loose sessions now tile at root
    } else if (folderId === UNCAT) {
      for (const e of uncategorised()) visible.add(e.slot);
    } else {
      const folder = folders.find(f => f.id === folderId);
      for (const f of childFolders(folders, folderId)) visible.add(f.id);
      for (const e of sessionsInFolder(folder)) visible.add(e.slot);
      for (const it of folder?.items ?? []) if (it.type === 'image') visible.add(it.ref);
    }
    for (const ref of [...selected.keys()]) if (!visible.has(ref)) selected.delete(ref);
  }

  /** Persist view + sort for THIS folder (plans/133 WP-2). */
  function saveViewPrefs(): void {
    try {
      const key = folderId ?? '__root__';
      const map = JSON.parse(localStorage.getItem('lolly:projectsViewPrefs') || '{}') as Record<string, unknown>;
      map[key] = { v: viewMode, s: sortBy, r: sortRev };
      localStorage.setItem('lolly:projectsViewPrefs', JSON.stringify(map));
    } catch { /* storage off */ }
  }

  /** The list view's clickable column header (plans/133 WP-2 → WP-12). Click
   *  sorts by that column; a second click reverses. The header is the SAME grid
   *  as every row (projects.css --list-cols), so it cannot drift from them. A
   *  sort with no column (Date added) is named beside Name, so the active
   *  order is never invisible. Rendered only in list mode. */
  function listHeadHtml(): string {
    // The arrow shows the REAL direction: name/kind run A→Z unreversed, while the
    // date and size sorts run newest/biggest first unreversed - i.e. descending.
    const descending = (key: SortBy): boolean => (key === 'name' || key === 'tool') ? sortRev : !sortRev;
    const glyph = (key: SortBy): string => descending(key) ? '▾' : '▴';
    // The sort state rides the accessible NAME: aria-sort is only exposed on real
    // table header roles, and these are buttons in a div, so a screen reader would
    // otherwise hear nothing of it.
    const col = (key: SortBy, label: string): string => {
      const on = sortBy === key;
      const state = on ? (descending(key) ? t('sorted descending') : t('sorted ascending')) : t('not sorted');
      return `<button type="button" class="listhead-col${on ? ' is-on' : ''}" data-listsort="${key}" aria-label="${escape(`${label}, ${state}`)}">${escape(label)}${on ? `<span class="listhead-dir" aria-hidden="true">${glyph(key)}</span>` : ''}</button>`;
    };
    const note = sortBy === 'added'
      ? `<span class="listhead-sortnote">${t('Sorted by date added')} <span aria-hidden="true">${glyph('added')}</span></span>`
      : '';
    return `<div class="projects-listhead" role="row">
      <span class="listhead-name">${col('name', t('Name'))}${note}</span>
      ${col('tool', t('Kind'))}${col('size', t('Size'))}${col('modified', t('Modified'))}
    </div>`;
  }

  const sessionTitle = (e: Entry): string => (e.label || e.filename || toolName(e.toolId) || '').toLowerCase();
  // A session's creation time for the "Date added" sort: the stored createdAt when the
  // row has one, else the timestamp minted into the slot (`<toolId>:<Date.now()>` - 
  // batch `__batch__:` and font-asset pseudo-slots carry none), else last-saved.
  const sessionAdded = (e: Entry): number => {
    if (e.createdAt) return +new Date(e.createdAt);
    const m = /:(\d{12,})$/.exec(e.slot);
    if (m) return Number(m[1]);
    return +new Date(e.updatedAt || 0);
  };
  function sortSessions(arr: Entry[]): Entry[] {
    const a = [...arr];
    if (sortBy === 'name') a.sort((x, y) => sessionTitle(x).localeCompare(sessionTitle(y)));
    else if (sortBy === 'tool') a.sort((x, y) => (toolName(x.toolId) || '').localeCompare(toolName(y.toolId) || '') || sessionTitle(x).localeCompare(sessionTitle(y)));
    else if (sortBy === 'added') a.sort((x, y) => sessionAdded(y) - sessionAdded(x));
    else if (sortBy === 'size') a.sort((x, y) => (sizes[y.slot] || 0) - (sizes[x.slot] || 0));
    else a.sort((x, y) => +new Date(y.updatedAt || 0) - +new Date(x.updatedAt || 0)); // modified
    if (sortRev) a.reverse();
    return a;
  }

  // ── search (within the current scope's whole subtree) ───────────────────────
  // Haystacks + matching live in lib/search/projects-source.ts, shared verbatim with
  // the spotlight's projects provider so the two can't drift (plans/99 section 8 M2). That
  // move also migrated matching from substring .includes onto the shared folded
  // token-AND matcher - the plan's deliberate unification: every query word must hit
  // (in any field) and diacritics fold, same hits here as in the overlay.

  // All folders + sessions in scope for the current view, BEFORE the query filter:
  //   root         → every folder + every saved session (the whole tree)
  //   Uncategorised → the loose sessions (flat, no sub-folders)
  //   a folder      → that folder's descendant folders + every session in its subtree
  function searchScope(): { folders: Folder[]; sessions: Entry[] } {
    if (folderId == null) return { folders, sessions: entries };
    if (folderId === UNCAT) return { folders: [], sessions: uncategorised() };
    const subIds = descendantFolderIds(folders, folderId);          // strictly inside
    const map = entryBySlot();
    const refs = [folderId, ...subIds].flatMap(id =>
      folders.find(f => f.id === id)?.items.filter(i => i.type === 'session').map(i => i.ref) ?? []);
    return {
      folders: folders.filter(f => subIds.includes(f.id)),
      sessions: refs.map(r => map.get(r)).filter(Boolean) as Entry[],
    };
  }

  // The query-filtered, sorted matches for the current scope - capped for render (see
  // SEARCH_LIMIT) and memoised so a single render's two callers scan the tree once.
  function searchMatches(): SearchMatches {
    if (!query) return { folders: [], sessions: [], total: 0, capped: false };
    if (searchCache && searchCache.q === query && searchCache.scope === folderId) return searchCache.matches;
    const scope = searchScope();
    const tokens = tokenize(query);
    // Sessions match via the prebuilt folded haystack (searchIndex) - no per-query
    // string building. Folders match on name (there are far fewer of them). Results
    // keep the view's sort preference (date/name/tool), not match score: this is a
    // browse surface; score-ranking lives in the spotlight overlay.
    const mf = sortFolders(scope.folders.filter(f => matchesHaystack(buildFolderHaystack(f.name, f.tags), tokens) > 0));
    const ms = sortSessions(scope.sessions.filter(e => matchesHaystack(searchIndex.get(e.slot) ?? '', tokens) > 0));
    const total = mf.length + ms.length;
    const cf = total > SEARCH_LIMIT ? mf.slice(0, SEARCH_LIMIT) : mf;
    const cs = total > SEARCH_LIMIT ? ms.slice(0, Math.max(0, SEARCH_LIMIT - cf.length)) : ms;
    const matches: SearchMatches = { folders: cf, sessions: cs, total, capped: total > SEARCH_LIMIT };
    searchCache = { q: query, scope: folderId, matches };
    return matches;
  }

  // ── render ───────────────────────────────────────────────────────────────
  function render(): void {
    if (!mounted) return; // an async callback fired after we navigated away - don't clobber the new view
    // Title the view for the tab bar AND for back-nav (lib/back-nav.ts labels the
    // previous view off document.title - this is how a tool opened from a folder,
    // or #/start reached from one, gets a back pill wearing the folder's name).
    const titleName = folderId == null ? t('Projects')
      : folderId === UNCAT ? t('Uncategorised')
      : (folders.find(f => f.id === folderId)?.name || t('Projects'));
    document.title = tRaw('{name} - Lolly', { name: titleName });
    featuredHandle?.destroy(); featuredHandle = null;  // stop the prior ribbon's rAF loop + listeners before its DOM is wiped
    searchCache = null;   // recompute matches once for this render (sort/data may have changed); the two callers below then share it
    pruneSelection();     // forget refs that vanished since the last render
    viewEl.innerHTML = folderId == null ? rootHtml() : folderHtml(folderId);
    wire();
  }

  function rootHtml(): string {
    if (query) return shell(t('Projects'), 'projects', searchBodyHtml());
    if (toolsFilter.length) return shell(t('Projects'), 'projects', toolsBodyHtml());
    const loose = sortSessions(uncategorised());
    // Card copy says "project" for the thing the user made (plans/163 F14) - the
    // stored record stays a session everywhere in the code.
    const createFolder = createTile('folder', FOLDER_PLUS_ICON, t('New folder'), t('Group related projects'));
    const createTool = createTile('tool', FILE_PLUS_ICON, t('New asset'), t('Start a new project'));
    // Only TOP-LEVEL folders at the root; nested folders show inside their parent.
    const topFolders = sortFolders(childFolders(folders, null));
    const folderTiles = topFolders.map(f => folderTile(f, folderTileOpts(f))).join('');
    // Loose (uncategorised) saved sessions render as tiles directly on the root grid -
    // a just-added creation shows here at once instead of vanishing into an
    // "Uncategorised" bucket. They're the SAME sessionTile a folder uses, so
    // drag-into-folder, select, rename, render, and open all work by delegation
    // (see wire()/wireDrag()). Newest first (the default sort) so a fresh add lands top-left.
    const looseTiles = loose.map(e => sessionTile(e, sessionTileOpts(e))).join('');
    // First run: no folders AND no loose sessions → lead with a one-line invite explaining
    // what Projects hold, instead of a grid that's only the two "new" tiles.
    const nothingSaved = !topFolders.length && !loose.length;
    const invite = nothingSaved
      ? `<p class="projects-empty">${t('Your projects appear here - save one from any tool to begin.')}</p>`
      : '';
    // Folders lead (the file-manager convention - containers first, so the structure
    // reads before the loose items), then loose creations (newest first within their
    // block), then the "new" affordances trailing.
    // A "Team projects" tile appears only when a deployment's control plane has
    // registered a session source (lib/session-source.ts); dormant otherwise, so
    // the grid is byte-identical on the public shell.
    const teamTile = getSessionSource()
      ? createTile('team', TEAM_ICON, t('Team projects'), t('Shared with you on this instance'))
      : '';
    // Trash (plans/133 WP-4): a muted system tile, only while it holds anything.
    const trashCount = trashEntries.length === 1 ? t('1 item') : tRaw('{n} items', { n: trashEntries.length });
    const trashTile = trashEntries.length
      ? `<div class="folder-tile folder-tile--trash"><button type="button" class="tile-primary" data-open-trash aria-label="${escape(t('Open Trash'))}">
           <span class="tile-cover tile-cover--batch" aria-hidden="true">${TRASH_ICON}</span>
           <span class="tile-meta"><span class="tile-title">${t('Trash')}</span><span class="tile-sub">${trashCount}</span></span>
           ${tileColsHtml({ kind: t('Trash'), count: trashCount, when: '' })}
         </button></div>`
      : '';
    // The favourites hero is a grid-mode thing: above a table it would push the
    // rows below the fold for a carousel of two covers (Part C, C2h). Starred
    // folders still pin first in the sort either way. List mode also swaps the
    // create tiles for the compact actions row above the table.
    const list = viewMode === 'list';
    return shell(t('Projects'), 'projects', `
      ${/* Batch needs something to batch (plans/163 F14): with nothing saved yet the
            pill is an offer the view cannot honour, so the whole row waits for the
            first project. */ ''}
      ${nothingSaved ? '' : `<div class="projects-roothead">${batchButtonHtml()}</div>`}
      ${favourites.size && !list ? `<div class="projects-featured" data-fav-strip></div>` : ''}
      ${invite}
      ${list ? `<div class="projects-actions">${listCreateBtns()}</div>` : ''}
      <div class="folder-grid projects-grid${list ? ' projects-list' : ''}">
        ${list ? listHeadHtml() : ''}
        ${folderTiles}${/* "My library" names the loose block when folders sit above
          it (plans/170 keeping-model): the save dialog files here by that name,
          so the place answers to it. Grid mode only - the list table has its own
          header row - and pointless when the grid IS only the library. */ ''}
        ${!list && loose.length && topFolders.length ? `<h2 class="projects-sec-label">${t('My library')}</h2>` : ''}
        ${looseTiles}${list ? '' : `${createFolder}${createTool}${templateTile()}`}${teamTile}${trashTile}
      </div>
      ${recentExports.length ? `
        <section class="projects-exports folder-exports">
          <button type="button" class="projects-exports-head" data-recents-toggle aria-expanded="${!recentsCollapsed}">
            <span class="folder-exports-title">${t('Recent exports')}</span>
            <span class="projects-exports-count">${recentExports.length}</span>
          </button>
          ${recentsCollapsed ? '' : `<div class="folder-exports-rail">
            ${recentExports.map(x => `
              ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - exportReopenHref() builds a fixed '#/tool/<id>' hash route */ ''}
              <a class="folder-export-tile" href="${escape(x.href)}" data-open-export
                 title="${escape(x.caption)} · ${escape(new Date(x.at).toLocaleDateString())}">
                <img src="${escape(x.thumb)}" alt="${escape(x.caption)}" loading="lazy">
              </a>`).join('')}
          </div>`}
        </section>` : ''}`);
  }

  // The flat results grid for the ?tools= filter - every saved session belonging to
  // the named tools, under an explicit status line with its own way out. Mirrors
  // searchBodyHtml's shape (status + .projects-search-grid) so the two modes read
  // the same; tiles are the shared sessionTile, so open/select/menu/drag all work
  // by the existing delegation.
  function toolsBodyHtml(): string {
    const set = new Set(toolsFilter);
    const ms = sortSessions(entries.filter(e => set.has(e.toolId)));
    const names = toolsFilter.map(id => toolName(id));
    const label = names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '');
    const clearBtn = `<button type="button" class="projects-linkbtn" data-tools-clear>${t('Show all projects')}</button>`;
    if (!ms.length) {
      return `<p class="projects-search-status" role="status" aria-live="polite">${tRaw('No saved sessions yet for {names}', { names: escape(label) })} · ${clearBtn}</p>
        <p class="projects-empty">${t('Save a session from one of these tools and it will appear here.')}</p>`;
    }
    const countText = ms.length === 1 ? t('1 saved session') : t('{n} saved sessions', { n: ms.length });
    const status = `<p class="projects-search-status" role="status" aria-live="polite">${tRaw('{count} for {names}', { count: countText, names: escape(label) })} · ${clearBtn}</p>`;
    const gridClass = `folder-grid projects-grid projects-search-grid${viewMode === 'list' ? ' projects-list' : ''}`;
    const tiles = ms.map(e => sessionTile(e, sessionTileOpts(e))).join('');
    return `${status}<div class="${gridClass}">${viewMode === 'list' ? listHeadHtml() : ''}${tiles}</div>`;
  }

  // The per-tile options every surface (root, folder, results) passes, so a tile
  // is identical wherever it appears. `href` makes the cover a real link (WP-13):
  // middle/Cmd-click opens a new tab, the plain click is intercepted in wire().
  function folderTileOpts(f: Folder): Parameters<typeof folderTile>[1] {
    return {
      memberPreviews: f.items.map(i => previewForRef(i.ref)).filter(Boolean) as MemberPreview[],
      count: tileItemCount(f),
      selectable: true, selected: isSelected(f.id), starred: favourites.has(f.id),
      href: `#/p/${f.id}`,
    };
  }
  function sessionTileOpts(e: Entry): Parameters<typeof sessionTile>[1] {
    return {
      toolName: toolName(e.toolId), sizeBytes: sizes[e.slot] || 0, tool: toolById.get(e.toolId),
      selectable: true, selected: isSelected(e.slot),
      href: resumeHref(e),
    };
  }
  /** "New from template" create tile - only once a project template exists (WP-11a). */
  const templateTile = (): string => templates.length
    ? createTile('template', TEMPLATE_ICON, t('New from template'), t('Start from a saved project template'))
    : '';

  /** The compact create buttons UP TOP (Andy, 2026-08-22): at the root, list
   *  mode shows them as an actions row above the table (the root grid keeps its
   *  create tiles); in a folder view they sit in the header before "Render
   *  folder" in BOTH view modes, and the folder grid carries no create tiles. */
  function listCreateBtns(isUncat = false): string {
    const btn = (kind: string, glyph: string, label: string): string =>
      `<button type="button" class="btn projects-create-btn" data-create-btn="${kind}">${glyph}<span>${escape(label)}</span></button>`;
    return [
      isUncat ? '' : btn('folder', FOLDER_PLUS_ICON, t('New folder')),
      btn('tool', FILE_PLUS_ICON, t('New asset')),
      !isUncat && templates.length ? btn('template', TEMPLATE_ICON, t('New from template')) : '',
    ].join('');
  }

  /** The empty-folder blank state (Andy, 2026-08-22): no grid, an invitation to
   *  the two create actions instead. The buttons reuse the header's
   *  [data-create-btn] wiring; Uncategorised (not a real folder) offers only
   *  New asset under its own explanation. */
  function emptyFolderHtml(isUncat: boolean): string {
    return `
      <div class="projects-blank">
        <span class="projects-blank-icon" aria-hidden="true">${isUncat ? FILE_PLUS_ICON : FOLDER_ICON}</span>
        <p class="projects-blank-title">${isUncat ? t('Nothing is uncategorised') : t('This folder is empty')}</p>
        <p class="projects-blank-sub">${isUncat ? t('Sessions you save without filing them are kept here.') : t('Add your first creation, or group work in a sub-folder.')}</p>
        <div class="projects-blank-actions">
          <button type="button" class="btn projects-render projects-create-btn" data-create-btn="tool">${FILE_PLUS_ICON}<span>${t('New asset')}</span></button>
          ${isUncat ? '' : `<button type="button" class="btn projects-create-btn" data-create-btn="folder">${FOLDER_PLUS_ICON}<span>${t('New folder')}</span></button>`}
        </div>
      </div>`;
  }

  function folderHtml(id: string): string {
    const isUncat = id === UNCAT;
    const folder = isUncat ? null : folders.find(f => f.id === id);
    if (!isUncat && !folder) {
      return shell(t('Projects'), 'projects', `<p class="projects-empty">${tRaw('That folder no longer exists. {link}.', { link: `<a href="#/p">${t('Back to Projects')}</a>` })}</p>`, { inFolder: true });
    }
    const subfolders = isUncat ? [] : sortFolders(childFolders(folders, id));
    const sessions = sortSessions(isUncat ? uncategorised() : sessionsInFolder(folder));
    const title = isUncat ? t('Uncategorised') : folder!.name;
    // Header count matches the folder tile: total renderable files in the whole subtree
    // (Uncategorised is flat, so its direct session count is already the full picture).
    const count = isUncat ? sessions.length : tileItemCount(folder!);

    // Breadcrumb + parent - the back arrow climbs ONE level (to the parent folder, or
    // the root), and the trail links every ancestor. The current folder is the <h2>.
    const ancestors = isUncat ? [] : folderPath(folders, id).slice(0, -1);
    const parentId = ancestors.length ? ancestors[ancestors.length - 1]!.id : null;
    const backHref = parentId ? `#/p/${escape(parentId)}` : '#/p';
    const crumbs = `
      <nav class="projects-crumbs" aria-label="${escape(t('Folder path'))}">
        <a href="#/p">${t('Projects')}</a>
        ${ancestors.map(a => `<span class="projects-crumb-sep" aria-hidden="true">/</span><a href="#/p/${escape(a.id)}">${escape(a.name)}</a>`).join('')}
      </nav>`;

    // "Move to" rail: CONTEXTUAL drop targets only (not the whole tree dumped flat) - 
    // inside a folder it's Top level + the parent + siblings; in Uncategorised it's the
    // top-level folders. Arbitrary-depth moves use the per-tile "Move to…" drill-down.
    const railTargets = isUncat
      ? childFolders(folders, null).map(f => ({ id: f.id, name: f.name }))
      : [
          { id: '__root__', name: t('Top level') },
          ...(parentId ? [{ id: parentId, name: folders.find(f => f.id === parentId)?.name || t('Parent') }] : []),
          ...childFolders(folders, folder!.parentId ?? null).filter(f => f.id !== id).map(f => ({ id: f.id, name: f.name })),
        ];
    const rail = railTargets.length ? `
      <div class="projects-rail" aria-label="${escape(t('Drag a session or folder onto a folder to move it'))}">
        <span class="projects-rail-hint">${t('Move to')}</span>
        ${railTargets.map(rt => `<button type="button" class="projects-chip" data-drop-folder="${escape(rt.id)}" data-open-folder-nav="${escape(rt.id)}">${escape(rt.name)}</button>`).join('')}
      </div>` : '';

    // Uncategorised only: a cinematic preview ribbon of the loose sessions, ABOVE the
    // "Move to" rail. Empty mount now; wire() hydrates it with the shared Featured strip
    // (drift · Cover Flow · mobile grip) once the DOM exists - see mountUncatRibbon().
    const ribbon = isUncat && sessions.length ? `<div class="projects-featured" data-uncat-ribbon></div>` : '';
    // Preview-strip view switcher, BELOW the ribbon - the SAME `.view-seg` segmented control
    // the catalog uses for its favourites strip (Gallery drift | Cover Flow), so the two match
    // instead of this being buried as menu items. Shares the FEATURED_VIEW_STORAGE pref.
    const stripFview = readFeaturedView();
    const stripSwitch = isUncat && sessions.length
      ? `<div class="view-seg projects-featured-switch" role="group" aria-label="${escape(t('Preview strip view mode'))}">
          <button type="button" class="view-seg-btn" data-fview="gallery" aria-pressed="${stripFview === 'gallery'}">${t('Gallery')}</button>
          <button type="button" class="view-seg-btn" data-fview="coverflow" aria-pressed="${stripFview === 'coverflow'}">${t('Cover Flow')}</button>
        </div>`
      : '';

    // No create tiles inside a folder (Andy, 2026-08-22): the New folder / New
    // asset buttons live in the HEADER in both view modes (listCreateBtns below),
    // and an empty folder shows the blank state instead. The tiles remain a
    // root-grid affordance only.
    // Image items in this folder (never in Uncategorised - an image needs a folder to
    // live in), resolved to AssetRefs so their tiles render. Kept in store order after
    // the sessions.
    const images = isUncat ? [] : (folder!.items
      .filter(i => i.type === 'image')
      .map(i => imageRefs.get(i.ref))
      .filter(Boolean) as AssetRef[]);
    const tiles = [
      ...subfolders.map(f => folderTile(f, folderTileOpts(f))),
      ...sessions.map(e => sessionTile(e, sessionTileOpts(e))),
      ...images.map(a => imageTile(a, {
        selectable: true, selected: isSelected(a.id),
        sub: a.id.startsWith('user/') ? t('Image') : t('Catalog image'),
      })),
    ].join('');

    // While a search is active the folder's own actions (rename / render whole folder)
    // would act on the folder, not the results, so they're dropped - the header keeps just
    // the breadcrumb, the back arrow, and the title so the user can still climb out.
    const searching = !!query;
    const header = `
      ${crumbs}
      <div class="projects-head">
        <a href="${backHref}" class="projects-back" aria-label="${escape(parentId ? t('Up to parent folder') : t('Back to Projects'))}">${BACK_ICON}</a>
        <h2 class="projects-title"${isUncat || searching ? '' : ` data-rename-folder="${escape(id)}" title="${escape(t('Rename folder'))}"`}>${escape(title)}</h2>
        ${searching ? '' : `<span class="projects-count">${count === 1 ? t('1 item') : t('{n} items', { n: count })}</span>`}
        <span class="projects-head-spacer"></span>
        ${searching ? '' : listCreateBtns(isUncat)}
        ${searching ? '' : batchButtonHtml()}
        ${!searching && count ? `<button type="button" class="projects-render btn" data-render-folder="${escape(id)}">${RENDER_ICON}<span>${t('Render folder')}</span></button>` : ''}
        ${isUncat || searching ? '' : `<button type="button" class="tile-menu-btn projects-head-menu" data-menu="${escape(id)}" data-menu-kind="folder" aria-label="${escape(t('Folder actions (rename, render, delete)'))}">${MENU_ICON}</button>`}
      </div>`;

    // Searching swaps the ribbon/rail/create tiles for the flat results grid, but keeps the
    // breadcrumb + header so the folder context (and the way back out) stays visible.
    if (searching) return shell(title, 'projects', `${header}${searchBodyHtml()}`, { inFolder: true });

    const gridClass = `folder-grid projects-grid${viewMode === 'list' ? ' projects-list' : ''}`;
    // Gate on whether there are TILES to show (sub-folders OR sessions), not on the
    // subtree file count: an empty sub-folder is a real tile the user needs to see, but
    // contributes 0 to `count` (tileItemCount ignores folders), so keying off `count`
    // would hide a freshly-created empty sub-folder.
    const hasTiles = subfolders.length > 0 || sessions.length > 0 || images.length > 0;
    // Empty folder → a blank state inviting the two create actions (no grid at all).
    const body = hasTiles
      ? `<div class="${gridClass}">${viewMode === 'list' ? listHeadHtml() : ''}${tiles}</div>`
      : emptyFolderHtml(isUncat);

    return shell(title, 'projects', `${ribbon}${stripSwitch}${rail}${header}${body}`, { inFolder: true });
  }

  // The flat results grid for the active query - matching folders first, then sessions,
  // each tile trailing a clickable breadcrumb of WHERE it lives so a hit nested three
  // folders deep still reads in context. Shared by the root + folder search branches.
  function searchBodyHtml(): string {
    const { folders: mf, sessions: ms, total, capped } = searchMatches();
    const shown = mf.length + ms.length;
    const scope = folderId == null ? t('all projects')
      : folderId === UNCAT ? t('Uncategorised')
      : `“${folders.find(f => f.id === folderId)?.name ?? t('this folder')}”`;
    // Results mode always carries an explicit Clear in the status line - BOTH the
    // results and no-results states (plans/99 section 2a: the URL-entered mode needs
    // unmistakable context AND an unmissable way out). Routed through
    // [data-search-clear] → clearSearchBar → the claim's onClear, so the bar's
    // field and this view exit as one.
    const clearBtn = `<button type="button" class="projects-linkbtn" data-search-clear>${t('Clear')}</button>`;
    if (!total) {
      return `<p class="projects-search-status" role="status" aria-live="polite">${t('No matches for “{query}” in {scope}', { query, scope })} · ${clearBtn}</p>
        <p class="projects-empty">${tRaw('Nothing here matches “{query}”. Try a different search, or {button}.', { query: escape(query), button: `<button type="button" class="projects-linkbtn" data-search-clear>${t('clear the search')}</button>` })}</p>`;
    }
    // When the match set is capped, name the true total and that only a slice is shown so a
    // broad query never silently looks "complete".
    const countText = capped
      ? t('{total} results - showing the first {shown}, refine to narrow', { total: total.toLocaleString(), shown })
      : (total === 1 ? t('1 result') : t('{n} results', { n: total }));
    const status = `<p class="projects-search-status" role="status" aria-live="polite">${tRaw('{count} for “{query}” in {scope}', { count: countText, query: escape(query), scope: escape(scope) })} · ${clearBtn}</p>`;
    const gridClass = `folder-grid projects-grid projects-search-grid${viewMode === 'list' ? ' projects-list' : ''}`;
    const tiles = [...mf.map(folderResultTile), ...ms.map(sessionResultTile)].join('');
    return `${status}<div class="${gridClass}">${viewMode === 'list' ? listHeadHtml() : ''}${tiles}</div>`;
  }

  // A search hit = the normal tile + a location breadcrumb beneath it. Reusing the shared
  // folderTile/sessionTile keeps open / select / drag / menu working with no extra wiring.
  function folderResultTile(f: Folder): string {
    const tile = folderTile(f, folderTileOpts(f));
    const anc = folderPath(folders, f.id).slice(0, -1);   // this folder's ancestors
    const parent = anc.length ? anc[anc.length - 1]!.id : null;
    return `<div class="projects-result">${tile}${locationChip(parent, anc.length ? anc.map(a => a.name).join(' / ') : t('Top level'))}</div>`;
  }
  function sessionResultTile(e: Entry): string {
    const tile = sessionTile(e, sessionTileOpts(e));
    const owner = ownerByRef.get(e.slot);   // O(1) - prebuilt in reindex()
    const chip = owner
      ? locationChip(owner.id, folderPath(folders, owner.id).map(a => a.name).join(' / '))
      : locationChip(UNCAT, t('Uncategorised'));
    return `<div class="projects-result">${tile}${chip}</div>`;
  }
  // A folder-path breadcrumb chip. When it points at a real folder (or Uncategorised) it's
  // a button that navigates there (reusing the rail's [data-open-folder-nav]); a top-level
  // item is static text.
  function locationChip(targetId: string | null, text: string): string {
    const inner = `${FOLDER_ICON}<span>${escape(text)}</span>`;
    return targetId
      ? `<button type="button" class="projects-result-path" data-open-folder-nav="${escape(targetId)}" title="${escape(tRaw('Open {name}', { name: text }))}">${inner}</button>`
      : `<span class="projects-result-path projects-result-path--static">${inner}</span>`;
  }

  function createTile(kind: string, icon: string, title: string, sub: string): string {
    return `
      <div class="folder-tile folder-tile--create" data-create="${kind}">
        <button type="button" class="tile-primary" aria-label="${escape(title)}">
          <span class="tile-cover tile-cover--create" aria-hidden="true">${icon}</span>
          <span class="tile-meta">
            <span class="tile-title">${escape(title)}</span>
            <span class="tile-sub">${escape(sub)}</span>
          </span>
        </button>
      </div>`;
  }

  /** The "Batch" button that leads to the grid (moved off the shared bottom bar,
   *  Andy 2026-08-26 - a batch is a Projects-scoped action). Rendered in the Projects
   *  content header of BOTH the root and folder views. Carries the current REAL folder
   *  as the batch's origin (`?from=`), so a batch saved from inside a folder defaults
   *  back to that folder; root/Uncategorised carry none (save defaults to top level). */
  function batchButtonHtml(): string {
    const batchFrom = folderId && folderId !== UNCAT ? folderId : null;
    const batchHref = `#/batch${batchFrom ? `?from=${encodeURIComponent(batchFrom)}` : ''}`;
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - first-party `#/batch` hash route built just above
    return `<a href="${escape(batchHref)}" class="btn projects-batch-btn" aria-label="${escape(t('Open Batch mode - render many at once'))}" title="${escape(t('Batch'))}">${BATCH_ICON}<span>${t('Batch')}</span></a>`;
  }

  function shell(heading: string, active: 'tools' | 'projects' | 'catalog', inner: string, { inFolder = false }: { inFolder?: boolean } = {}): string {
    // projects--searching marks the URL-entered results mode (plans/99 section 2a) - it can
    // never flip mid-view from typing, since live keystrokes go to the spotlight
    // overlay and only ?q= at mount (or exitSearch) changes `query`.
    return `
      <div class="projects${inFolder ? ' projects--folder' : ''}${query ? ' projects--searching' : ''}">
        ${viewTopbarHtml({
          active,
          right: projectsTopRight(folderId && folderId !== UNCAT ? folderId : null),
          // No view-specific class on the cluster: the old `.projects-topright` marker
          // this markup used to carry had no CSS rule and no selector anywhere in the
          // repo, so it went out with the hand-rolled copy.
          profile: { firstname: profile?.firstname, headshotUrl },
        })}
        <h1 class="visually-hidden">${escape(heading)}</h1>
        ${inner}
        ${bulkBarHtml()}
      </div>`;
  }

  // The bottom bar is the persistent shell singleton (components/search-bar.ts).
  // Projects claims it with a scope-aware placeholder (it names the CURRENT folder
  // so it's clear a query reaches INTO sub-folders) but NO live-filter tap - typing
  // feeds the spotlight overlay (plans/99 section 2a M2), and only the explicit ?q=
  // handoff puts this view into results mode.
  function searchPlaceholder(): string {
    const scopeName = folderId == null ? t('all projects')
      : folderId === UNCAT ? t('Uncategorised')
      : (folders.find(f => f.id === folderId)?.name || t('this folder'));
    return folderId == null ? t('Search all projects…') : tRaw('Search {scope}…', { scope: scopeName });
  }

  // Exit the URL-entered results mode (plans/99 section 2a). location.replace with the
  // q-less hash (no new history entry): the projects route signature carries ?q=
  // (main.ts routeSignature), so the hash change remounts the plain grid - the
  // same path the browser's Back button takes out of results mode, so exit
  // behaviour can't fork. Wired as the bar claim's onClear, and reached by
  // every in-body [data-search-clear] via clearSearchBar.
  function exitSearch(): void {
    if (!mounted || !query) return;
    const h = window.location.hash;
    const qi = h.indexOf('?');
    if (qi === -1) { query = ''; searchCache = null; render(); return; }
    const params = new URLSearchParams(h.slice(qi + 1));
    params.delete('q');
    const rest = params.toString();
    window.location.replace(h.slice(0, qi) + (rest ? `?${rest}` : ''));
  }

  // The floating multi-selection action bar - markup + sync live in lib/bulk-bar.ts
  // (shared with the catalog and gallery); this view supplies its action set. The
  // "Render selection" action leads with the primary Render styling to match the
  // header button; "Edit together" only shows for a manageable set of single-tool
  // sessions (2–8, no folders/images/batch grids) - the multi-edit view mounts one
  // live runtime per session, so the cap keeps it responsive.
  const bulkBarCfg: BulkBarConfig = {
    prefix: 'projects-bulkbar',
    rootSelector: '.projects',
    count: () => selected.size,
    actions: [
      { id: 'render', icon: RENDER_ICON, label: () => t('Render selection'), extraClass: 'projects-render projects-bulk-render' },
      { id: 'edit', icon: EDIT_ICON, label: () => t('Edit together'), title: () => t('Open the selected sessions side by side with one combined sidebar'), hidden: () => !editableSelection() },
      { id: 'sheet', icon: SHEET_ICON, label: () => t('Edit as sheet'), title: () => t('Open the whole selection as rows in the batch grid - no size limit'), hidden: () => !sheetableSelection() },
      { id: 'duplicate', icon: DUPLICATE_ICON, label: () => t('Duplicate'), title: () => t('Copy each selected creation beside the original'), hidden: () => ![...selected.values()].includes('session') },
      { id: 'favourite', icon: STAR_ICON, label: () => [...selected.keys()].every(r => favourites.has(r)) ? t('Unfavourite') : t('Favourite') },
      { id: 'move', icon: MOVE_ICON, label: () => t('Move to…') },
      { id: 'cut', icon: CUT_ICON, label: () => t('Cut') },
      { id: 'copy', icon: DUPLICATE_ICON, label: () => t('Copy') },
      { id: 'download', icon: DOWNLOAD_ICON, label: () => t('Download originals'), title: () => t('A zip of the selected files as they are stored - .lolly sessions and image bytes, nothing rendered') },
      { id: 'newfolder', icon: FOLDER_PLUS_ICON, label: () => t('New folder') },
      { id: 'delete', icon: TRASH_ICON, label: () => t('Delete'), extraClass: 'projects-bulk-danger' },
    ],
  };
  const bulkBarHtml = (): string => buildBulkBar(bulkBarCfg);
  const syncBulkBar = (): void => syncSharedBulkBar(viewEl, bulkBarCfg);

  /** The selected slots IFF the whole selection is 2–8 single-tool sessions; else null. */
  function editableSelection(): string[] | null {
    if (selected.size < MULTI_EDIT_MIN || selected.size > MULTI_EDIT_MAX) return null;
    const slots: string[] = [];
    for (const [ref, kind] of selected) {
      if (kind !== 'session' || isBatchSlot(ref)) return null;
      slots.push(ref);
    }
    return slots;
  }

  /** Open the selected sessions in the multi-edit view (#/multi?s=slot,slot…). Carries
   *  the current real folder as the origin (`&from=`) so its "Save all" picker defaults
   *  back here. */
  function editSelection(): void {
    const slots = editableSelection();
    if (!slots) return;
    const from = folderId && folderId !== UNCAT ? `&from=${encodeURIComponent(folderId)}` : '';
    window.location.hash = `#/multi?s=${slots.map(encodeURIComponent).join(',')}${from}`;
  }

  /** The selected SESSION + IMAGE refs (any count), or null if the selection has
   *  none. The batch grid's complement to multi-edit: no 2–8 cap, heterogeneous
   *  tools welcome, non-tool items land as tool-less rows (see rowsFromRefs).
   *  Folders are excluded - they stay containers with their own open-in-grid path. */
  function sheetableSelection(): string[] | null {
    const refs = [...selected].filter(([, k]) => k !== 'folder').map(([ref]) => ref);
    return refs.length ? refs : null;
  }

  /** Open the selection as rows in the Batch grid (#/batch?s=slot,slot…). Carries the
   *  current real folder as the batch's origin (`&from=`) so a save defaults back here. */
  function editAsSheet(): void {
    const refs = sheetableSelection();
    if (!refs) return;
    const from = folderId && folderId !== UNCAT ? `&from=${encodeURIComponent(folderId)}` : '';
    window.location.hash = `#/batch?s=${refs.map(encodeURIComponent).join(',')}${from}`;
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  // The view-options (filter) popover is still this hand-rolled body-absolute one - 
  // only the two CONTEXT menus (below) moved onto mountBodyPopover, rec 9's remainder.
  let openPopover: HTMLElement | null = null;
  function closeMenu(): void {
    openPopover?.remove(); openPopover = null;
    document.removeEventListener('pointerdown', onDocDown, true); document.removeEventListener('keydown', onMenuKey, true);
    tileMenu.close();
  }
  function onDocDown(e: PointerEvent): void { if (openPopover && !openPopover.contains(e.target as Node)) closeMenu(); }
  // Escape closes an open popover menu - matching the app-wide dialog convention (see confirm-dialog).
  function onMenuKey(e: KeyboardEvent): void { if (e.key === 'Escape' && openPopover) { e.preventDefault(); e.stopPropagation(); closeMenu(); } }

  // ── per-tile / bulk-selection context menu (kebab button, right-click, long-press) ──
  // The whole mechanism - one mountBodyPopover over a mutable pointAnchor, the edge-
  // clamped fixed positioning, right-click delegation ("inside a multi-selection →
  // bulk menu"), and the press-and-hold touch bridge - now lives in
  // lib/context-menu.ts (extracted from this view, shared with gallery + catalog).
  // This view supplies the menu bodies and the action dispatch; the kebab buttons
  // (recreated each render) route through tileMenu.openAt with themselves as the
  // focus-restore delegate. Create tiles + the synthetic Uncategorised tile decline
  // (refOf → null) → the NATIVE menu shows, as before.
  const tileMenu = wireTileContextMenu({
    host: viewEl,
    tileSelector: '.folder-tile[data-ref][data-kind]',
    refOf: (tile) => tile.classList.contains('folder-tile--create')
      ? null : tile.dataset.ref ?? null,
    isBulkTarget: (ref) => selected.size > 1 && selected.has(ref),
    singleHtml: (tgt) => tileMenuHtml(tgt.data ?? tgt.tile?.dataset.kind ?? 'session', tgt.ref),
    bulkHtml: () => bulkMenuHtml(),
    // Right-click on empty canvas (WP-13): the file-manager background menu. Not
    // in results mode - "New folder" there would have no clear home.
    backgroundHtml: () => query ? '' : backgroundMenuHtml(),
    onAction: (act, tgt, kind) => { void (kind === 'background' ? onBackgroundAction(act) : onMenuAction(act, tgt)); },
    className: 'folder-menu projects-menu',
  });

  // Destructive actions (delete a folder + its contents, delete a saved session) use
  // the shared styled confirm modal - close any open tile menu first so it doesn't
  // hang behind the dialog. closeMenu() detaches the popover that held the trigger, so
  // the native <dialog>'s focus-restore would land on <body>; capture a still-connected
  // fallback up front and refocus it once the dialog resolves. See components/confirm-dialog.js.
  const confirmDialog = (opts: ConfirmDialogOpts): Promise<boolean> => {
    const active = document.activeElement;
    const fallback = (active instanceof HTMLElement && active !== document.body && active.isConnected && !openPopover?.contains(active))
      ? active
      : viewEl.querySelector<HTMLElement>('.projects-viewopts');
    closeMenu();
    return baseConfirmDialog(opts).then((ok) => { if (fallback?.isConnected) fallback.focus({ preventScroll: true }); return ok; });
  };

  function wire(): void {
    const root = viewEl.querySelector<HTMLElement>('.projects');
    if (!root) return;

    root.addEventListener('click', async (e) => {
      const t = e.target as HTMLElement;

      // Exit results mode (the status line's Clear + the no-results link). Routed
      // through clearSearchBar so the bar's field empties too; with no onQuery
      // claimed, the bar invokes this view's onClear (the M2 contract).
      const clr = t.closest<HTMLElement>('[data-search-clear]');
      if (clr) { e.preventDefault(); clearSearchBar({ focus: false }); return; }

      // Exit the ?tools= results mode. In place, not by navigation: the projects route
      // signature keys on folderId alone (main.ts), so a hash change #/p?tools=… → #/p
      // is deduped and would never re-mount - same reason the ?q= exit works in place.
      const tclr = t.closest<HTMLElement>('[data-tools-clear]');
      if (tclr) { e.preventDefault(); exitToolsFilter(); return; }

      // Preview-strip view switcher (the .view-seg below the Uncategorised ribbon). Live-
      // switch the strip via its handle (no full re-render) and persist the shared pref so the
      // choice carries to the gallery hero + next mount - matching the catalog's switch.
      const fviewBtn = t.closest<HTMLElement>('[data-fview]');
      if (fviewBtn) {
        const mode = fviewBtn.dataset.fview as FeaturedViewMode;
        try { localStorage.setItem(FEATURED_VIEW_STORAGE, mode); } catch { /* storage off */ }
        featuredHandle?.setViewMode(mode);
        root.querySelectorAll<HTMLElement>('.projects-featured-switch [data-fview]')
          .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fview === mode)));
        return;
      }

      // Per-tile overflow menu (check before the open-folder primary it sits inside)
      const menuBtn = t.closest<HTMLElement>('[data-menu]');
      if (menuBtn) {
        e.preventDefault(); e.stopPropagation();
        const r = menuBtn.getBoundingClientRect();
        openMenu({ ref: menuBtn.dataset.menu!, kind: menuBtn.dataset.menuKind!, tileEl: menuBtn.closest<HTMLElement>('.folder-tile'), anchorEl: menuBtn, x: r.left, y: r.bottom + 6 });
        return;
      }

      // Selection toggle (must beat the open-folder / open-session primary it neighbours).
      // Shift-click extends from the anchor instead of toggling - see lib/tile-select.ts.
      const selBtn = t.closest<HTMLElement>('[data-select]');
      if (selBtn) {
        e.preventDefault(); e.stopPropagation();
        tileSelect.onDotClick(selBtn.dataset.select!, e.shiftKey, () => toggleSelect(selBtn));
        return;
      }
      // Modifier-click on the TILE itself (plans/133 WP-13 - the file-manager
      // selection model): Cmd (Ctrl elsewhere) toggles, Shift extends the range.
      // On Apple platforms Ctrl-click IS the right-click gesture (it has already
      // opened the menu), so it must not also flip the selection. Middle-click
      // never reaches here (auxclick), so the cover's href opens a new tab as-is.
      const toggleKey = e.metaKey || (e.ctrlKey && !IS_APPLE);
      const modTile = (toggleKey || e.shiftKey) ? t.closest<HTMLElement>('.folder-tile[data-ref][data-kind]') : null;
      if (modTile && !modTile.classList.contains('folder-tile--create')) {
        e.preventDefault(); e.stopPropagation();
        const ref = modTile.dataset.ref!, kind = modTile.dataset.kind as SelectKind;
        tileSelect.onDotClick(ref, e.shiftKey && !toggleKey, () => toggleSelectRef(ref, kind));
        return;
      }

      // Bulk-action bar
      const bulk = t.closest<HTMLElement>('[data-bulk]');
      if (bulk) { e.preventDefault(); e.stopPropagation(); handleBulk(bulk.dataset.bulk!); return; }

      // Trash tile opens the trash browser (plans/133 WP-4).
      if (t.closest('[data-open-trash]')) { openTrashDialog(); return; }

      // List-view column headers: click sorts, second click reverses (WP-2).
      const colBtn = t.closest<HTMLElement>('[data-listsort]');
      if (colBtn) {
        const key = colBtn.dataset.listsort as SortBy;
        if (key === sortBy) sortRev = !sortRev;
        else { sortBy = key; sortRev = false; }
        try { localStorage.setItem('lolly:projectsSort', sortBy); } catch { /* ignore */ }
        saveViewPrefs();
        render();
        return;
      }

      // Open a folder (folder tile primary). Hash navigation (folders are hash-routed);
      // the cover is an <a href> to the same route, so a plain click is intercepted
      // here (one navigation, not two) and middle-click keeps the link's new tab.
      const open = t.closest<HTMLElement>('[data-open-folder]');
      if (open) { e.preventDefault(); window.location.hash = '#/p/' + open.dataset.openFolder; return; }
      // Rail chip navigates (drops are handled separately)
      const navChip = t.closest<HTMLElement>('[data-open-folder-nav]');
      if (navChip) {
        const dest = navChip.dataset.openFolderNav;
        window.location.hash = (!dest || dest === '__root__') ? '#/p' : '#/p/' + dest;
        return;
      }

      // List mode's compact create buttons (the tiles are grid mode's).
      const cbtn = t.closest<HTMLElement>('[data-create-btn]');
      if (cbtn) {
        const kind = cbtn.dataset.createBtn;
        if (kind === 'folder') {
          const name = await promptFolderName();
          if (name && mounted) { await store.create(name, currentFolderTarget()); await reload(); render(); }
        } else if (kind === 'template') void openTemplateChooser();
        else startCreateTool();
        return;
      }

      // Create tiles
      const create = t.closest<HTMLElement>('[data-create]');
      if (create) {
        const kind = create.dataset.create;
        if (kind === 'folder') startCreateFolder(create);
        else if (kind === 'team') void openTeamProjects();
        else if (kind === 'template') void openTemplateChooser();
        else startCreateTool();
        return;
      }

      // Rename folder (click the title in a folder view)
      const rn = t.closest<HTMLElement>('[data-rename-folder]');
      if (rn) { startRename(rn, rn.dataset.renameFolder); return; }

      // Render whole folder
      const rf = t.closest<HTMLElement>('[data-render-folder]');
      if (rf) { renderFolder(rf.dataset.renderFolder!); return; }

      // Open a saved session (resume the tool / open batch). The cover's href is the
      // same destination for middle-click; the plain click goes through resumeSession
      // so Save returns here.
      const os = t.closest<HTMLElement>('[data-open-session]');
      if (os) { e.preventDefault(); resumeSession(os.dataset.openSession!); return; }

      // Open a folder image (catalog reference or your upload) in a lightbox preview.
      const oi = t.closest<HTMLElement>('[data-open-image]');
      if (oi) { openImagePreview(oi.dataset.openImage!); return; }

      // A tap on a preview-ribbon tile resumes that session. The Featured strip's own
      // capture-phase handler has already swallowed a drag / a Cover-Flow re-centre before
      // this bubbles, so reaching here means a clean open - route it through resumeSession
      // (closeMenu + armReturn + batch handling) rather than the anchor's raw navigation.
      const ribbonTile = t.closest<HTMLElement>('.projects-featured .ftile');
      if (ribbonTile) { e.preventDefault(); resumeSession(ribbonTile.dataset.tool!); return; }
    });

    // (The search field lives in the shell's persistent bar; typing there feeds the
    // spotlight overlay, never this view - see the claimSearchBar call in the boot
    // section. Only the explicit ?q= handoff enters results mode.)

    // View-options (filter) button → preview/list + sort popover.
    root.querySelector('.projects-viewopts')?.addEventListener('click', (e) => { e.stopPropagation(); openViewOpts(e.currentTarget as HTMLElement); });

    // Recent-exports collapse (plans/133 WP-10) - device-remembered, render() redraws.
    root.querySelector('[data-recents-toggle]')?.addEventListener('click', () => {
      recentsCollapsed = !recentsCollapsed;
      try { localStorage.setItem(RECENTS_COLLAPSED_KEY, recentsCollapsed ? '1' : '0'); } catch { /* storage off */ }
      render();
    });

    // The folder-overlay mount is RETIRED here (plans/133 WP-10): this view IS
    // the folder manager, and the one thing the overlay added that the grid
    // lacked - the Recent-exports reopen rail - now renders at the root above.
    // The history fab went with it; the mobile profile menu keeps its saved
    // count but hands off nowhere (you are already looking at your saved work).

    // The invariant top-bar wiring - language menu, plus the mobile profile menu (on
    // mobile the avatar opens theme + saved sessions + Settings; on desktop it stays a
    // plain link to the profile page). Same call Tools and Catalog make.
    mountViewTopbar(root, host as ProjectsHost, {
      profileMenu: { savedCount: entries.length },
    });

    wireDrag(root);
    mountUncatRibbon(root);
    mountFavStrip(root);
    syncBulkBar();   // reflect a selection that survived this re-render
    applyCollabBadges(root);
    tileSelect.syncRoving();   // one Tab stop for the grid (WP-13)
    // Cut items read as "leaving" until pasted (WP-7).
    for (const tile of root.querySelectorAll<HTMLElement>('.folder-tile[data-ref]')) {
      tile.classList.toggle('is-cut', clipboard?.mode === 'cut' && clipboard.items.some(i => i.ref === tile.dataset.ref));
    }
    attachDrops();
  }

  // OS drops land here too (plans/133 WP-6): the shared chooser ingests them, and
  // whatever the library routes stored is filed into the folder on screen. Bound to
  // the persistent viewEl; the router tears itself down on every hashchange, which
  // the in-place ?tools= / ?q= exits also fire WITHOUT a remount - so this is
  // (re)attached from wire(), and attachDropRouter replaces any live attachment.
  const dropRouter = import('../lib/drop-router.ts');
  function attachDrops(): void {
    void dropRouter.then((m) => {
      if (!mounted) return;
      m.attachDropRouter(viewEl, host as unknown as PickerHost, {
        onStored: (ids) => {
          const target = currentFolderTarget();
          void (async () => {
            if (target) for (const id of ids) await store.addItem(target, { type: 'image', ref: id }).catch(() => {});
            if (mounted) { await reload(); render(); }
          })();
        },
      });
    });
  }

  // Live-collab badge (plan 100 section 4.6; lib/collab-tile-state.ts) - every session
  // tile, in both the grid and the search-results list (sessionResultTile reuses
  // the same sessionTile() shape), gets consulted against the dormant-by-default
  // provider registry. No provider registered anywhere in this repo yet, so
  // renderCollabBadge is always called with an empty peer list and paints
  // nothing - the grid stays byte-identical to before this call existed
  // (pinned by collab-tile-state.test.ts). Called once per render() (wire()'s
  // last step), matching how the rest of this view re-derives its DOM from
  // scratch on every data change rather than patching incrementally.
  function applyCollabBadges(root: HTMLElement): void {
    const provider = getCollabTileProvider();
    for (const tile of root.querySelectorAll<HTMLElement>('.folder-tile[data-kind="session"]')) {
      const slot = tile.dataset.ref;
      renderCollabBadge(tile, slot && provider ? provider.peersFor(slot) : []);
    }
  }

  // (Right-click + long-press → context menu is wired once per mount by the shared
  // wireTileContextMenu above - bound to the persistent viewEl, so it survives the
  // render() that replaces `.projects` and needs no per-render re-wiring here.)

  // ── multi-select gestures (marquee + Shift-range) ───────────────────────────
  // Both live in lib/tile-select.ts, shared verbatim with the Catalogue so the two
  // grids behave identically: drag a box through the gaps between cards to select
  // what it touches, Shift-click a dot to sweep up everything back to the anchor.
  // Wired ONCE per mount against viewEl - render() replaces the `.projects` root,
  // so a listener bound in wire() would be orphaned (and re-wiring per render would
  // reset the Shift-anchor mid-gesture).
  const selectableTiles = (): HTMLElement[] =>
    [...viewEl.querySelectorAll<HTMLElement>('.folder-tile[data-ref][data-kind]')]
      .filter(t => !t.classList.contains('folder-tile--create'));

  const tileSelect = wireTileSelect({
    host: viewEl,
    tiles: selectableTiles,
    refOf: (t) => t.dataset.ref!,
    current: () => new Set(selected.keys()),
    setRefs: applySelectionRefs,
    clear: () => { dropSelection(); render(); },
    // Never start a box on a tile, control, chip, bar, breadcrumb, etc. - only in a gap.
    noStart: '.folder-tile, button, a, input, label, dialog, .projects-bulkbar, .projects-rail, .projects-crumbs, .projects-head, .gallery-topbar',
    // Keyboard grid (plans/133 WP-3 + WP-13): arrows/Space/Cmd-A come from the shared
    // model; Delete routes through the Trash path, F2 into the inline renames, the
    // Menu key opens the tile's menu, Cmd-I its info sheet, Cmd-X/C/V the clipboard.
    keyboard: {
      remove: (refs) => {
        selected.clear();
        for (const ref of refs) selected.set(ref, kindOfRef(ref));
        void deleteSelection();
      },
      rename: (ref, tile) => {
        if (folders.some(f => f.id === ref)) startRename(tile, ref);
        else if (entryMap.has(ref)) startRenameSession(tile, ref);
      },
      menu: (ref, tile) => {
        const r = tile.getBoundingClientRect();
        if (selected.size > 1 && selected.has(ref)) tileMenu.openBulkAt(r.left + 24, r.top + 24);
        else openMenu({ ref, kind: kindOfRef(ref), tileEl: tile, anchorEl: tile.querySelector<HTMLElement>('.tile-menu-btn'), x: r.left + 24, y: r.top + 24 });
      },
      info: (ref) => openInfoSheet(ref),
      cut: (refs) => setClipboard('cut', refs),
      copy: (refs) => setClipboard('copy', refs),
      paste: () => { void pasteClipboard(currentFolderTarget()); },
    },
  });

  /** A ref's kind, from the live data (folder record → folder, state row → session, else image). */
  const kindOfRef = (ref: string): SelectKind =>
    folders.some(f => f.id === ref) ? 'folder' : entryMap.has(ref) ? 'session' : 'image';

  // Reconcile the Map to exactly `refs` (the kind is read back off each tile), then
  // repaint every tile in place - a full render() would drop scroll/focus mid-drag.
  // Shared by the marquee/keyboard model and the background menu's Select all.
  function applySelectionRefs(refs: ReadonlySet<string>): void {
    selected.clear();
    for (const t of selectableTiles()) {
      const ref = t.dataset.ref!;
      if (refs.has(ref)) selected.set(ref, t.dataset.kind as SelectKind);
    }
    for (const t of viewEl.querySelectorAll<HTMLElement>('.folder-tile[data-ref]')) {
      const on = selected.has(t.dataset.ref!);
      t.classList.toggle('is-selected', on);
      t.querySelector('.tile-check')?.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    syncBulkBar();
  }

  // Empty the selection AND forget the Shift-anchor together. They have to move as one:
  // an anchor left behind by a cleared selection would silently become the far end of the
  // next Shift-click's range, selecting a swathe the user never started.
  function dropSelection(): void {
    selected.clear();
    tileSelect.resetAnchor();
  }

  // Escape drops the selection (yielding to any open menu/dialog/field first) - 
  // the keyboard exit the ✕ button and an empty-canvas click already provide.
  const unwireEscape = wireEscapeClearsSelection({
    active: () => mounted && selected.size > 0,
    clear: () => { dropSelection(); render(); },
  });

  // Toggle one tile's membership in `selected` and update just that tile + the bulk bar
  // in place (a full render() would drop scroll position / focus and interrupt a drag).
  function toggleSelect(btn: HTMLElement): void {
    toggleSelectRef(btn.dataset.select!, btn.dataset.kind as SelectKind);
  }
  function toggleSelectRef(ref: string, kind: SelectKind): void {
    if (selected.has(ref)) selected.delete(ref); else selected.set(ref, kind);
    const on = selected.has(ref);
    for (const tile of viewEl.querySelectorAll<HTMLElement>(`.folder-tile[data-ref="${CSS.escape(ref)}"]`)) {
      tile.classList.toggle('is-selected', on);
      tile.querySelector('.tile-check')?.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    syncBulkBar();
  }

  // Bulk-bar dispatch. Each action re-checks `mounted` after awaits and clears the
  // selection once applied.
  function handleBulk(action: string): void {
    if (action === 'clear') { dropSelection(); render(); return; }
    if (action === 'render') { renderSelection(); return; }
    if (action === 'cut' || action === 'copy') { setClipboard(action, [...selected.keys()]); return; }
    if (action === 'download') { void downloadOriginals(t('Selection'), selectedByKind('session'), selectedByKind('image'), topLevelSelectedFolders()); return; }
    if (action === 'edit') { editSelection(); return; }
    if (action === 'sheet') { editAsSheet(); return; }
    if (action === 'duplicate') { duplicateSelection(); return; }
    if (action === 'favourite') { favouriteSelection(); return; }
    if (action === 'move') { moveSelection(); return; }
    if (action === 'newfolder') { newFolderFromSelection(); return; }
    if (action === 'delete') { deleteSelection(); return; }
  }

  // ── drag-and-drop: drag a session OR a sub-folder onto a folder chip / folder tile ──
  function wireDrag(root: HTMLElement): void {
    // Session, image AND real folder tiles are draggable (not the synthetic Uncategorised,
    // not the create tiles). A folder carries 'text/lolly-folder'; a session 'text/lolly-session';
    // an image 'text/lolly-image' - the kind lets the drop target pick store.moveItem's type.
    root.querySelectorAll<HTMLElement>('.folder-tile[data-kind="session"], .folder-tile[data-kind="image"], .folder-tile--folder').forEach(tile => {
      const kind = tile.dataset.kind as SelectKind;   // 'folder' | 'session' | 'image'
      const mime = kind === 'folder' ? 'text/lolly-folder' : kind === 'image' ? 'text/lolly-image' : 'text/lolly-session';
      tile.setAttribute('draggable', 'true');
      tile.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData(mime, tile.dataset.ref!);
        e.dataTransfer!.effectAllowed = 'move';
        tile.classList.add('is-dragging');
        root.classList.add(kind === 'folder' ? 'is-dragging-folder' : 'is-dragging-session');
      });
      tile.addEventListener('dragend', () => {
        tile.classList.remove('is-dragging');
        root.classList.remove('is-dragging-session', 'is-dragging-folder');
      });
    });
    // Drop targets: the move-rail chips AND folder tiles (the open-button is the hit area).
    const targets: HTMLElement[] = [
      ...root.querySelectorAll<HTMLElement>('[data-drop-folder]'),
      ...[...root.querySelectorAll('.folder-tile--folder')].map(t => t.querySelector<HTMLElement>('[data-open-folder]')).filter(Boolean) as HTMLElement[],
    ];
    // Spring-loaded folders (plans/133 WP-5): hovering a folder target mid-drag
    // for ~650ms navigates INTO it, so a deep move never needs two trips. The
    // timer resets when the pointer leaves or the drop lands first.
    let springTimer: ReturnType<typeof setTimeout> | undefined;
    const armSpring = (dest: string | null): void => {
      clearTimeout(springTimer);
      springTimer = setTimeout(() => {
        window.location.hash = dest ? `#/p/${dest}` : '#/p';
      }, 650);
    };
    const disarmSpring = (): void => clearTimeout(springTimer);
    // Edge auto-scroll while dragging (file-manager convention).
    root.addEventListener('dragover', (e) => {
      const y = (e as DragEvent).clientY;
      if (y < 90) window.scrollBy(0, -14);
      else if (window.innerHeight - y < 90) window.scrollBy(0, 14);
    });
    // Breadcrumb segments + the back arrow are drop-NAV targets too: hovering
    // springs up the tree; dropping moves to that ancestor.
    for (const crumb of root.querySelectorAll<HTMLElement>('.projects-crumbs [data-open-folder-nav], .projects-back')) {
      const dest = crumb.dataset.openFolderNav ?? (folders.find(f => f.id === folderId)?.parentId ?? null) ?? '';
      const destId = dest === '' ? null : dest;
      crumb.addEventListener('dragover', (e) => { e.preventDefault(); crumb.classList.add('is-drop'); armSpring(destId); });
      crumb.addEventListener('dragleave', () => { crumb.classList.remove('is-drop'); disarmSpring(); });
      crumb.addEventListener('drop', async (e) => {
        e.preventDefault(); crumb.classList.remove('is-drop'); disarmSpring();
        const dt = (e as DragEvent).dataTransfer!;
        const draggedRef = dt.getData('text/lolly-session') || dt.getData('text/lolly-image') || dt.getData('text/lolly-folder');
        if (!draggedRef) return;
        const kind: SelectKind = dt.getData('text/lolly-folder') ? 'folder' : dt.getData('text/lolly-image') ? 'image' : 'session';
        if (kind === 'folder') await store.moveFolder(draggedRef, destId);
        else await store.moveItem(draggedRef, destId, kind);
        await reload(); render();
      });
    }
    targets.forEach(target => {
      const folderRef = (target.dataset.dropFolder || target.dataset.openFolder)!;
      const hit = target.closest('[data-drop-folder]') || target.closest('.folder-tile');
      const springDest = (folderRef === UNCAT || folderRef === '__root__') ? null : folderRef;
      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        (e as DragEvent).dataTransfer!.dropEffect = 'move';
        // Spring only on FOLDER TILES - a rail chip is already a visible target,
        // navigating under the drag there would be rug-pulling.
        if (target.closest('.folder-tile--folder') && !hit?.classList.contains('is-drop')) armSpring(springDest);
        hit?.classList.add('is-drop');
      });
      target.addEventListener('dragleave', () => { hit?.classList.remove('is-drop'); disarmSpring(); });
      target.addEventListener('drop', async (e) => {
        e.preventDefault(); hit?.classList.remove('is-drop'); disarmSpring();
        const dt = (e as DragEvent).dataTransfer!;
        const slot = dt.getData('text/lolly-session');
        const image = dt.getData('text/lolly-image');
        const draggedFolder = dt.getData('text/lolly-folder');
        const draggedRef = slot || image || draggedFolder;
        if (!draggedRef) return;
        const dest = (folderRef === UNCAT || folderRef === '__root__') ? null : folderRef;
        // Grabbing one tile of a multi-selection drags the WHOLE set - move every
        // selected folder/session/image so they all follow, matching the "Move to…" bar.
        if (selected.size > 1 && selected.has(draggedRef)) {
          await applySelectionMove(dest);
        } else if (slot) {
          await store.moveItem(slot, dest, 'session');
        } else if (image) {
          await store.moveItem(image, dest, 'image');
        } else {
          if (draggedFolder === folderRef) return;   // dropped on itself - no-op
          await store.moveFolder(draggedFolder, dest); // store guards self/descendant cycles
        }
        await reload(); render(); announce(t('Moved'));
      });
    });
  }

  // ── per-tile menu ────────────────────────────────────────────────────────
  // One row of the context menu, icon + label - the shared builder (lib/context-menu.ts).
  const menuItem = menuItemHtml;

  // Content for the per-tile context menu - folder actions or session actions. `kind`/
  // `ref` come through the shared wireTileContextMenu's target: folder or session,
  // "Move to…" opens the drill-down picker (no more flat all-folders-at-once list).
  function tileMenuHtml(kind: string, ref: string): string {
    // Favourite / unfavourite row - a folder, session or image can be starred to the strip up top.
    const fav = (): string => menuItem('fav', favourites.has(ref) ? STAR_FILLED_ICON : STAR_ICON,
      favourites.has(ref) ? t('Remove from favourites') : t('Add to favourites'));
    // Cut / Copy on every kind; Paste (into this folder) only on a folder, and only
    // while the clipboard holds something other than this very folder.
    const clip = (): string => menuItem('cut', CUT_ICON, t('Cut')) + menuItem('copy', DUPLICATE_ICON, t('Copy'));
    if (kind === 'folder') {
      const canPaste = !!clipboard?.items.length && !clipboard.items.some(i => i.ref === ref);
      return [
        menuItem('open-folder', OPEN_ICON, t('Open')),
        menuItem('rename', EDIT_ICON, t('Rename folder')),
        fav(),
        menuItem('move-folder', MOVE_ICON, t('Move to…')),
        clip(),
        canPaste ? menuItem('paste-into', PASTE_ICON, t('Paste here')) : '',
        menuItem('render', RENDER_ICON, t('Render folder'), { render: true }),
        menuItem('download-folder', DOWNLOAD_ICON, t('Download originals')),
        menuItem('save-template', TEMPLATE_ICON, t('Save as project template…')),
        menuItem('style-folder', PALETTE_ICON, t('Colour and icon…')),
        menuItem('info', INFO_ICON, t('Get info')),
        menuItem('delete', TRASH_ICON, t('Move to Trash'), { danger: true }),
      ].join('');
    }
    if (kind === 'image') {
      // Every folder image is a REFERENCE (plans/133 WP-4): removing it only takes
      // it out of this project - the bytes stay in the Catalog, which owns deletion.
      return [
        menuItem('open-image', OPEN_ICON, t('Preview')),
        fav(),
        menuItem('move-image', MOVE_ICON, t('Move to…')),
        clip(),
        menuItem('delete-image', TRASH_ICON, t('Remove from project'), { danger: true }),
      ].join('');
    }
    // A batch session is a multi-row group with no single tool URL, so it can't be
    // shared as a link - offer Share only for single-tool sessions.
    const canShare = !isBatchSlot(ref);
    return [
      menuItem('open', OPEN_ICON, t('Open')),
      menuItem('rename-session', EDIT_ICON, t('Rename')),
      menuItem('duplicate-session', DUPLICATE_ICON, t('Duplicate')),
      fav(),
      menuItem('move', MOVE_ICON, t('Move to…')),
      clip(),
      canShare ? menuItem('share', SHARE_ICON, t('Share link')) : '',
      menuItem('info', INFO_ICON, t('Get info')),
      menuItem('render-session', RENDER_ICON, t('Render'), { render: true }),
      menuItem('delete-session', TRASH_ICON, t('Move to Trash'), { danger: true }),
    ].join('');
  }

  /** The background menu (WP-13): what a right-click on empty canvas offers. */
  function backgroundMenuHtml(): string {
    const canPaste = !!clipboard?.items.length;
    return [
      menuItem('new-folder', FOLDER_PLUS_ICON, t('New folder')),
      menuItem('new-asset', FILE_PLUS_ICON, t('New asset')),
      templates.length ? menuItem('new-from-template', TEMPLATE_ICON, t('New from template…')) : '',
      canPaste ? menuItem('paste', PASTE_ICON, t('Paste')) : '',
      menuItem('select-all', SELECT_ALL_ICON, t('Select all')),
    ].join('');
  }
  async function onBackgroundAction(act: string): Promise<void> {
    if (act === 'new-folder') {
      // The create tile's inline editor where there is one; Uncategorised and the
      // ?tools= grid render no create tiles, so they get the name prompt instead.
      const tile = viewEl.querySelector<HTMLElement>('[data-create="folder"]');
      if (tile) { startCreateFolder(tile); return; }
      const name = await promptFolderName();
      if (!name || !mounted) return;
      await store.create(name, currentFolderTarget());
      await reload(); render();
    }
    else if (act === 'new-asset') startCreateTool();
    else if (act === 'new-from-template') await openTemplateChooser();
    else if (act === 'paste') await pasteClipboard(currentFolderTarget());
    else if (act === 'select-all') applySelectionRefs(new Set(selectableTiles().map(t2 => t2.dataset.ref!)));
  }

  // The context menu for a MULTI-selection (right-clicking a tile that's part of the
  // current selection) - the same actions as the bulk bar, at the cursor. The "{n}
  // selected" head is plain text, not a menuitem - nested in its own role="menu" (the
  // shared wireTileContextMenu demotes the OUTER div to a plain group for bulk menus)
  // so it's a valid sibling instead of an invalid child of the menu - the same
  // reasoning lang-menu.ts's sort-tabs-above-the-list split documents.
  function bulkMenuHtml(): string {
    return `<p class="folder-menu-head">${t('{n} selected', { n: selected.size })}</p>`
      + `<div class="folder-menu-list" role="menu" aria-label="${escape(t('Selection actions'))}">${[
        menuItem('render', RENDER_ICON, t('Render selection'), { render: true }),
        ...(sheetableSelection() ? [menuItem('sheet', SHEET_ICON, t('Edit as sheet'))] : []),
        ...([...selected.values()].includes('session') ? [menuItem('duplicate', DUPLICATE_ICON, t('Duplicate'))] : []),
        menuItem('favourite', STAR_ICON, [...selected.keys()].every(r => favourites.has(r)) ? t('Unfavourite') : t('Favourite')),
        menuItem('move', MOVE_ICON, t('Move to…')),
        menuItem('cut', CUT_ICON, t('Cut')),
        menuItem('copy', DUPLICATE_ICON, t('Copy')),
        menuItem('download', DOWNLOAD_ICON, t('Download originals')),
        menuItem('newfolder', FOLDER_PLUS_ICON, t('New folder from selection')),
        menuItem('delete', TRASH_ICON, t('Delete'), { danger: true }),
      ].join('')}</div>`;
  }

  // Dispatch a picked context-menu row. The shared wireTileContextMenu has already
  // closed the popover; `target` is null for the bulk menu, else carries the tile's
  // ref + element (tileEl null when the folder-view header ⋯ opened it - those
  // actions fall back to the header <h2>).
  async function onMenuAction(act: string, target: { ref: string; tile: HTMLElement | null } | null): Promise<void> {
    if (!target) { handleBulk(act); return; }
    const { ref, tile: tileEl } = target;
    closeMenu();   // the viewopts popover could be up behind a kebab-opened menu
    // Rename can fire from a folder TILE (root view) or the folder-view header menu
    // button (no enclosing tile) - fall back to the header <h2> in that case.
    if (act === 'rename') startRename(tileEl || viewEl.querySelector<HTMLElement>('.projects-title[data-rename-folder]'), ref);
    else if (act === 'render') renderFolder(ref);
    else if (act === 'fav') toggleFavourite(ref);
    else if (act === 'delete') deleteFolderCascade(ref);
    else if (act === 'style-folder') void openFolderStyleDialog(ref);
    else if (act === 'info') openInfoSheet(ref);
    else if (act === 'cut' || act === 'copy') setClipboard(act, selected.has(ref) ? [...selected.keys()] : [ref]);
    else if (act === 'paste-into') await pasteClipboard(ref);
    else if (act === 'download-folder') await downloadOriginals(folders.find(f => f.id === ref)?.name || t('Folder'), [], [], [ref]);
    else if (act === 'save-template') await saveAsTemplate(ref);
    else if (act === 'open-folder') { window.location.hash = '#/p/' + ref; }
    else if (act === 'move-folder') {
      // A folder can't move into itself or its own subtree - block those targets.
      const blocked = new Set([ref, ...descendantFolderIds(folders, ref)]);
      openMovePicker({
        title: t('Move folder to…'), blocked,
        onPick: async (dest) => { await store.moveFolder(ref, dest); await reload(); render(); announce(t('Folder moved')); },
      });
    }
    else if (act === 'open') resumeSession(ref);
    else if (act === 'rename-session') startRenameSession(tileEl, ref);
    else if (act === 'duplicate-session') duplicateSession(ref);
    else if (act === 'move') {
      openMovePicker({
        title: t('Move to…'),
        onPick: async (dest) => { await store.moveItem(ref, dest, 'session'); await reload(); render(); announce(t('Session moved')); },
      });
    }
    else if (act === 'render-session') renderSession(ref);
    else if (act === 'share') shareSession(ref);
    else if (act === 'delete-session') { await trashSessions([ref]); }
    else if (act === 'open-image') openImagePreview(ref);
    else if (act === 'move-image') {
      openMovePicker({
        title: t('Move to…'),
        onPick: async (dest) => { await store.moveItem(ref, dest, 'image'); await reload(); render(); announce(t('Image moved')); },
      });
    }
    else if (act === 'delete-image') { await deleteImage(ref); }
  }

  // Favourite / unfavourite a ref (folder, session, or image). Persists to the profile and
  // repaints so the item's menu label + the favourites strip update.
  async function toggleFavourite(ref: string): Promise<void> {
    if (favourites.has(ref)) favourites.delete(ref); else favourites.add(ref);
    if (profile) await saveProjectFavourites(host, profile, favourites);
    if (!mounted) return;
    await reload(); render();
  }
  // Bulk favourite (the selection bar): star every selected ref, or - when the whole selection
  // is already starred - unstar it, in one repaint.
  async function favouriteSelection(): Promise<void> {
    const refs = [...selected.keys()];
    if (!refs.length) return;
    const allFav = refs.every(r => favourites.has(r));
    for (const r of refs) { if (allFav) favourites.delete(r); else favourites.add(r); }
    if (profile) await saveProjectFavourites(host, profile, favourites);
    if (!mounted) return;
    await reload(); render();
    announce(allFav ? t('Removed from favourites') : t('Added to favourites'));
  }

  // Remove a folder image. Images are REFERENCES here (2026-08-20, plans/133
  // WP-4): removing one only takes it out of this project - uploads and catalog
  // assets alike keep their bytes in the Catalog, which owns real deletion (and
  // has its own undo there). No confirm; the undo toast is the way back.
  async function deleteImage(ref: string): Promise<void> {
    const owner = ownerByRef.get(ref);
    if (!owner) return;
    const name = String(imageRefs.get(ref)?.meta?.name ?? ref.split('/').pop() ?? ref);
    await store.removeItem(owner.id, ref);
    if (!mounted) return;
    await reload(); render();
    announce(t('Removed from project'));
    showUndoToast({
      message: tRaw('Removed "{name}" from the project. It is still in the Catalog.', { name }),
      undo: async () => {
        await store.addItem(owner.id, { type: 'image', ref });
        if (!mounted) return;
        await reload(); render();
      },
    });
  }

  // A lightbox preview for a folder image - the resolved AssetRef carries the url + name.
  // Modal chrome + Escape-to-close come from mountModal (matching the app-wide convention).
  function openImagePreview(ref: string): void {
    const a = imageRefs.get(ref);
    if (!a?.url) return;
    const name = String(a.meta?.name ?? '');
    const modal = mountModal<void>(
      `<figure class="projects-imgpreview">
        <img src="${escape(a.url)}" alt="${escape(name)}" decoding="async">
        ${name ? `<figcaption>${escape(name)}</figcaption>` : ''}
      </figure>`,
      { className: 'projects-imgpreview-modal', ariaLabel: name || t('Image preview') },
    );
    overlayModal = modal;
    modal.el.querySelector('.projects-imgpreview')?.addEventListener('click', () => modal.close());
  }

  // Open the per-tile context menu from a ⋯ kebab button (anchored below it, with the
  // button as the focus-restore delegate). Right-click/long-press opens are handled by
  // the shared wireTileContextMenu delegation directly. tileEl is the enclosing
  // .folder-tile (null for the folder-view header ⋯, which falls back to <h2>).
  function openMenu({ ref, kind, tileEl = null, anchorEl = null, x, y }: { ref: string; kind: string; tileEl?: HTMLElement | null; anchorEl?: HTMLElement | null; x: number; y: number }): void {
    closeMenu();
    tileMenu.openAt(x, y, { ref, tile: tileEl, data: kind }, anchorEl);
  }

  // ── drill-down "Move to" picker ─────────────────────────────────────────────
  // A native <dialog> that navigates the folder tree one level at a time (rather than
  // dumping every folder at once): click a folder to drill in, breadcrumb to climb, then
  // "Move to «here»" commits at the current level. `blocked` folder ids (a folder's own
  // subtree, to prevent a cycle) are shown disabled. onPick(destId|null) - null = top level.
  /** The Trash browser (plans/133 WP-4): restore / delete forever / empty. */
  function openTrashDialog(): void {
    const fmtWhen = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const rows = trashEntries.map((e, i) => {
      const name = e.kind === 'session' ? e.label : e.name;
      const kind = e.kind === 'session' ? t('Saved session') : t('Folder');
      return `<li class="trash-row">
        <span class="trash-row-icon" aria-hidden="true">${e.kind === 'folder' ? FOLDER_ICON : FILE_PLUS_ICON}</span>
        <span class="trash-row-meta"><span class="trash-row-name">${escape(name)}</span><span class="trash-row-sub">${kind} · ${escape(fmtWhen(e.deletedAt))}</span></span>
        <button type="button" class="btn btn--sm" data-trash-restore="${i}">${t('Restore')}</button>
        <button type="button" class="btn btn--sm cat-act-danger" data-trash-purge="${i}">${t('Delete forever')}</button>
      </li>`;
    }).join('');
    const modal = mountModal<void>(`
      <div class="trash-dialog-body">
        <h2>${t('Trash')}</h2>
        <p class="trash-note">${t('Items here are removed for good after 30 days.')}</p>
        ${rows ? `<ul class="trash-list">${rows}</ul>` : `<p class="trash-note">${t('The Trash is empty.')}</p>`}
        <div class="trash-actions">
          ${rows ? `<button type="button" class="btn cat-act-danger" data-trash-empty>${t('Empty Trash')}</button>` : ''}
          <button type="button" class="btn" data-trash-close>${t('Close')}</button>
        </div>
      </div>`, { className: 'trash-dialog', ariaLabel: t('Trash') });
    modal.el.addEventListener('click', async (e) => {
      const el = e.target as HTMLElement;
      const restore = el.closest<HTMLElement>('[data-trash-restore]');
      const purge = el.closest<HTMLElement>('[data-trash-purge]');
      if (el.closest('[data-trash-close]')) { modal.close(); return; }
      if (el.closest('[data-trash-empty]')) {
        for (const entry of [...trashEntries]) await purgeTrashEntry(entry).catch(() => {});
        modal.close();
        if (mounted) { await reload(); render(); }
        announce(t('Trash emptied'));
        return;
      }
      if (restore) {
        const entry = trashEntries[Number(restore.dataset.trashRestore)];
        modal.close();
        if (entry) { await restoreTrashEntry(entry); announce(t('Restored')); }
        return;
      }
      if (purge) {
        const entry = trashEntries[Number(purge.dataset.trashPurge)];
        modal.close();
        if (entry) { await purgeTrashEntry(entry).catch(() => {}); if (mounted) { await reload(); render(); } }
      }
    });
  }

  /** Get info (plans/133 WP-8): path, dates, counts, aggregate size. */
  function openInfoSheet(ref: string): void {
    closeMenu();
    const fmtIso = (iso: string | null | undefined): string => iso ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    const rows: Array<[string, string]> = [];
    let title = '';
    const folder = folders.find(f => f.id === ref);
    if (folder) {
      title = folder.name;
      const subtree = [folder.id, ...descendantFolderIds(folders, folder.id)];
      const items = folders.filter(f => subtree.includes(f.id)).flatMap(f => f.items ?? []);
      const sessionSlots = items.filter(i => i.type === 'session').map(i => i.ref);
      const bytes = sessionSlots.reduce((n, slot) => n + (sizes[slot] || 0), 0);
      rows.push(
        [t('Kind'), t('Folder')],
        [t('Where'), folderPath(folders, folder.id).slice(0, -1).map(f => f.name).join(' / ') || t('Top level')],
        [t('Contains'), tRaw('{s} sessions, {i} images, {f} sub-folders', { s: sessionSlots.length, i: items.length - sessionSlots.length, f: subtree.length - 1 })],
        [t('Size'), bytes ? fmtBytes(bytes) : t('Empty')],
        [t('Created'), fmtIso(folder.createdAt)],
        [t('Modified'), fmtIso(folder.updatedAt)],
        [t('Tags'), (folder.tags ?? []).join(', ')],
        [t('Favourite'), favourites.has(ref) ? t('Yes') : t('No')],
      );
    } else {
      const e = entryMap.get(ref);
      if (!e) return;
      title = e.label || e.filename || toolName(e.toolId) || ref;
      const owner = ownerByRef.get(ref);
      rows.push(
        [t('Kind'), isBatchSlot(ref) ? t('Batch session') : tRaw('{tool} session', { tool: toolName(e.toolId) || e.toolId || '' })],
        [t('Where'), owner ? folderPath(folders, owner.id).map(f => f.name).join(' / ') : t('Top level')],
        [t('Size'), sizes[ref] ? fmtBytes(sizes[ref]!) : ''],
        [t('Added'), fmtIso(e.createdAt)],
        [t('Modified'), fmtIso(e.updatedAt)],
        [t('Favourite'), favourites.has(ref) ? t('Yes') : t('No')],
      );
    }
    mountModal<void>(`
      <div class="trash-dialog-body">
        <h2>${escape(title)}</h2>
        <dl class="cat-details-meta">${rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl>
      </div>`, { className: 'trash-dialog', ariaLabel: t('Info') });
  }

  /** Colour + emoji accents for a folder (plans/133 WP-1). */
  async function openFolderStyleDialog(ref: string): Promise<void> {
    closeMenu();
    const folder = folders.find(f => f.id === ref);
    if (!folder) return;
    // The colour options are the ACTIVE design system's palette (Andy,
    // 2026-08-20) - the same live token resolution the swatch surfaces use -
    // so a folder tint always speaks the brand's language. Lead with the core
    // brand colours, then the spectrum, deduped by hex and capped so the row
    // stays a row; the fixed FOLDER_COLORS survive only as the no-palette
    // fallback (livePalette itself already falls back to the starter set).
    const palette = await livePalette(host as Parameters<typeof livePalette>[0]).catch(() => []);
    if (!mounted) return;
    // Only accent-worthy hues: a palette also carries transparent, white/black
    // and neutral chrome tokens (borders, foregrounds) that make no folder
    // tint - drop non-hex values, near-greys, and the near-white/near-black
    // extremes by inspection of the colour itself, not its name.
    const tintWorthy = (hex: string): boolean => {
      const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) return false;
      const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1]!.slice(i, i + 2), 16)) as [number, number, number];
      const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
      return hi - lo >= 24 && lo <= 235 && hi >= 30;
    };
    // One dot per colour FAMILY: a ramp contributes "Jungle", not Jungle 2…7 -
    // the family key is the label minus a trailing step number.
    const seen = new Set<string>();
    const famSeen = new Set<string>();
    const swatches = [...palette.filter(p => !p.group), ...palette.filter(p => p.group)]
      .filter(p => tintWorthy(p.hex))
      .filter(p => { const hx = p.hex.toLowerCase(); if (seen.has(hx)) return false; seen.add(hx); return true; })
      .filter(p => {
        const fam = (p.label || p.hex).replace(/\s+\d+$/, '').toLowerCase();
        if (famSeen.has(fam)) return false;
        famSeen.add(fam);
        return true;
      })
      .slice(0, 14)
      .map(p => ({ hex: p.hex, label: p.label || p.hex }));
    const options = swatches.length ? swatches : FOLDER_COLORS.map(c => ({ hex: c, label: c }));
    const isOn = (hx: string): boolean => (folder.color ?? '').toLowerCase() === hx.toLowerCase();
    const dots = options.map(o =>
      `<button type="button" class="folder-color-dot${isOn(o.hex) ? ' is-on' : ''}" data-style-color="${escape(o.hex)}" style="background:${escape(o.hex)}" title="${escape(o.label)}" aria-label="${escape(tRaw('Colour {color}', { color: o.label }))}" aria-pressed="${isOn(o.hex)}"></button>`).join('');
    const modal = mountModal<void>(`
      <div class="folder-style-body">
        <h2>${tRaw('Colour and icon for "{name}"', { name: folder.name })}</h2>
        <div class="folder-style-row" role="group" aria-label="${escape(t('Folder colour'))}">
          ${dots}
          <button type="button" class="btn btn--sm" data-style-color="">${t('No colour')}</button>
        </div>
        <label class="folder-style-row folder-style-emoji">
          <span>${t('Icon (an emoji)')}</span>
          <input type="text" maxlength="4" data-style-emoji value="${escape(folder.emoji ?? '')}" placeholder="📁">
        </label>
        <label class="folder-style-row folder-style-tags">
          <span>${t('Tags')}</span>
          <input type="text" data-style-tags value="${escape((folder.tags ?? []).join(', '))}" placeholder="${escape(t('client, q3, print'))}">
          <span class="trash-note">${t('Comma-separated. Search finds the folder by any of them.')}</span>
        </label>
        <div class="trash-actions">
          <button type="button" class="btn modal-primary" data-style-save>${t('Save')}</button>
        </div>
      </div>`, { className: 'folder-style-dialog', ariaLabel: t('Folder colour and icon') });
    let color: string | null = folder.color ?? null;
    modal.el.addEventListener('click', async (e) => {
      const dot = (e.target as HTMLElement).closest<HTMLElement>('[data-style-color]');
      if (dot) {
        color = dot.dataset.styleColor || null;
        modal.el.querySelectorAll<HTMLElement>('.folder-color-dot').forEach(d =>
          d.setAttribute('aria-pressed', String(!!color && (d.dataset.styleColor ?? '').toLowerCase() === color.toLowerCase())));
        return;
      }
      if ((e.target as HTMLElement).closest('[data-style-save]')) {
        const emoji = modal.el.querySelector<HTMLInputElement>('[data-style-emoji]')?.value.trim() ?? '';
        const tags = (modal.el.querySelector<HTMLInputElement>('[data-style-tags]')?.value ?? '').split(',').map(x => x.trim()).filter(Boolean);
        modal.close();
        await store.setStyle(ref, { color, emoji: emoji || null, tags });
        if (mounted) { await reload(); render(); }
      }
    });
  }

  function openMovePicker({ title, blocked = new Set<string>(), onPick }: { title: string; blocked?: Set<string>; onPick: (dest: string | null) => void }): void {
    closeMenu();
    let cursor: string | null = null; // current folder id (null = top level)

    const render = (): string => {
      const kids = sortFolders(childFolders(folders, cursor));
      const path = cursor ? folderPath(folders, cursor) : [];
      const curName = cursor ? (path[path.length - 1]?.name ?? t('Folder')) : t('Top level');
      const canDropHere = cursor == null || !blocked.has(cursor);
      return `
        <div class="movepicker-head">
          <h2 class="movepicker-title">${escape(title)}</h2>
          <button type="button" class="movepicker-close" aria-label="${escape(t('Close'))}">✕</button>
        </div>
        <nav class="movepicker-crumbs" aria-label="${escape(t('Folder path'))}">
          <button type="button" class="movepicker-crumb${cursor == null ? ' is-current' : ''}" data-cursor="">${t('Projects')}</button>
          ${path.map(f => `<span class="projects-crumb-sep" aria-hidden="true">/</span><button type="button" class="movepicker-crumb${f.id === cursor ? ' is-current' : ''}" data-cursor="${escape(f.id)}">${escape(f.name)}</button>`).join('')}
        </nav>
        <div class="movepicker-list">
          ${kids.length ? kids.map(f => {
            const isBlocked = blocked.has(f.id);
            const kidCount = childFolders(folders, f.id).length;
            return `<button type="button" class="movepicker-row${isBlocked ? ' is-blocked' : ''}" data-into="${escape(f.id)}"${isBlocked ? ' disabled' : ''}>
              <span class="movepicker-row-icon" aria-hidden="true">${FOLDER_ICON}</span>
              <span class="movepicker-row-name">${escape(f.name)}</span>
              ${kidCount ? `<span class="movepicker-row-chev" aria-hidden="true">${CHEVRON_ICON}</span>` : ''}
            </button>`;
          }).join('') : `<p class="movepicker-empty">${t('No sub-folders here.')}</p>`}
        </div>
        <div class="movepicker-foot">
          <button type="button" class="btn movepicker-newfolder"${canDropHere ? '' : ' disabled'}>${FOLDER_PLUS_ICON}<span>${t('New folder')}</span></button>
          <span class="projects-head-spacer"></span>
          <button type="button" class="btn movepicker-cancel">${t('Cancel')}</button>
          <button type="button" class="btn projects-render movepicker-confirm"${canDropHere ? '' : ' disabled'}>${t('Move to {name}', { name: curName })}</button>
        </div>`;
    };

    // Focus the first meaningful control so keyboard users don't land on <body> or the ✕:
    // a folder to drill into, else the "Move to …" confirm, else the dialog shell itself
    // (kept tabbable via tabIndex=-1, set once on mount below).
    const focusFirst = (el: HTMLDialogElement): HTMLElement =>
      el.querySelector<HTMLElement>('.movepicker-row:not([disabled])')
        ?? el.querySelector<HTMLElement>('.movepicker-confirm:not([disabled])')
        ?? el;

    const modal = mountModal<void>(render(), {
      className: 'projects-movepicker',
      initialFocus: (el) => { el.tabIndex = -1; return focusFirst(el); },
      onClose: () => { if (overlayModal === modal) overlayModal = null; },
    });
    overlayModal = modal;

    const redraw = (): void => {
      modal.el.innerHTML = render();
      // Keep keyboard focus inside the picker after a redraw (drill-in / crumb climb).
      if (modal.el.open) focusFirst(modal.el).focus({ preventScroll: true });
    };

    modal.el.addEventListener('click', async (e) => {
      const crumb = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor]');
      if (crumb) { cursor = crumb.dataset.cursor || null; redraw(); return; }
      const into = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-into]');
      if (into && !into.disabled) { cursor = into.dataset.into!; redraw(); return; }
      if ((e.target as HTMLElement).closest('.movepicker-close, .movepicker-cancel')) { modal.close(); return; }
      if ((e.target as HTMLElement).closest('.movepicker-confirm:not([disabled])')) { const dest = cursor; modal.close(); onPick(dest); return; }
      // "New folder" at the current level (WP-7): create it, drill into it, so the
      // move can land there in one trip. The prompt is its own modal; this one
      // stays open underneath and redraws with the fresh tree.
      if ((e.target as HTMLElement).closest('.movepicker-newfolder:not([disabled])')) {
        const name = await promptFolderName();
        overlayModal = modal;
        if (!name || !modal.el.isConnected) return;
        const created = await store.create(name, cursor);
        folders = await store.list();
        reindex();
        cursor = created.id;
        redraw();
      }
    });
  }

  // A tiny name prompt (New folder from selection, New folder in the Move-to picker,
  // Save as project template). Resolves the trimmed name, or null.
  function promptFolderName({ title = t('New folder'), placeholder = t('Folder name'), ok = t('Create'), value = '' }: { title?: string; placeholder?: string; ok?: string; value?: string } = {}): Promise<string | null> {
    return new Promise((resolve) => {
      closeMenu();
      const content = `
        <h2 class="modal-title">${escape(title)}</h2>
        <input class="projects-name-input projects-prompt-input" type="text" placeholder="${escape(placeholder)}" value="${escape(value)}" maxlength="60" aria-label="${escape(placeholder)}">
        <div class="modal-actions">
          <button type="button" class="btn" data-act="cancel">${t('Cancel')}</button>
          <button type="button" class="btn projects-render" data-act="ok">${escape(ok)}</button>
        </div>`;
      // Resolves null however the dialog closes (Cancel, Escape, backdrop, or _cleanup
      // calling modal.close() on navigate-away) so the awaiting newFolderFromSelection()
      // never hangs - cancelValue + onClose cover every path, mountModal is idempotent.
      const modal = mountModal<string | null>(content, {
        className: 'modal projects-prompt',
        cancelValue: null,
        initialFocus: (el) => el.querySelector<HTMLElement>('input'),
        onClose: (result) => { if (overlayModal === modal) overlayModal = null; resolve(result || null); },
      });
      overlayModal = modal;
      const input = modal.el.querySelector('input')!;
      input.select?.();
      modal.el.addEventListener('click', (e) => {
        const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
        if (act === 'ok') return modal.close(input.value.trim());
        if (act === 'cancel') return modal.close(null);
      });
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') modal.close(input.value.trim()); });
    });
  }

  // The gallery-style filter button → a popover to switch view mode (Preview/List) and
  // sort (Name / Date added / Last modified / By tool). Preference persists in localStorage.
  function openViewOpts(btn: HTMLElement): void {
    closeMenu();
    const atRoot = folderId == null;
    const opt = (on: boolean, attr: string, val: string, label: string): string =>
      `<button type="button" class="folder-menu-item${on ? ' is-on' : ''}" data-${attr}="${val}">${on ? '✓ ' : '  '}${label}</button>`;
    // (The Uncategorised preview-strip Gallery↔Cover-Flow switch is no longer a menu item - 
    // it's a .view-seg segmented control below the ribbon, matching the catalog.)
    const pop = document.createElement('div');
    pop.className = 'folder-menu projects-viewmenu';
    pop.innerHTML = `
      ${themeSegmentHtml('folder-menu-head')}
      <p class="folder-menu-head">${t('View')}</p>
      ${opt(viewMode === 'preview', 'vm', 'preview', t('Preview'))}
      ${opt(viewMode === 'list', 'vm', 'list', t('List'))}
      <p class="folder-menu-head">${t('Sort')}</p>
      ${opt(sortBy === 'name', 'sort', 'name', t('Name'))}
      ${opt(sortBy === 'added', 'sort', 'added', t('Date added'))}
      ${opt(sortBy === 'modified', 'sort', 'modified', t('Last modified'))}
      ${opt(sortBy === 'size', 'sort', 'size', t('Size'))}
      ${atRoot ? '' : opt(sortBy === 'tool', 'sort', 'tool', t('By tool'))}
      ${soundSegmentHtml('folder-menu-head')}`;
    document.body.appendChild(pop);
    wireThemeSegment(pop, host as unknown as Parameters<typeof wireThemeSegment>[1]);   // Theme picker atop the menu
    wireSoundSegment(pop, host as unknown as Parameters<typeof wireSoundSegment>[1]);   // Sound on/off segment
    const r = btn.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 6 + window.scrollY)}px`;
    pop.style.left = `${Math.round(Math.min(r.left, window.innerWidth - pop.offsetWidth - 12) + window.scrollX)}px`;
    openPopover = pop;
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onMenuKey, true);
    pop.addEventListener('click', (e) => {
      const vm = (e.target as HTMLElement).closest<HTMLElement>('[data-vm]'); const so = (e.target as HTMLElement).closest<HTMLElement>('[data-sort]');
      if (vm) { viewMode = vm.dataset.vm as ViewMode; try { localStorage.setItem('lolly:projectsView', viewMode); } catch { /* ignore */ } saveViewPrefs(); closeMenu(); render(); }
      else if (so) { sortBy = so.dataset.sort as SortBy; sortRev = false; try { localStorage.setItem('lolly:projectsSort', sortBy); } catch { /* ignore */ } saveViewPrefs(); closeMenu(); render(); }
    });
  }

  // ── create / rename ────────────────────────────────────────────────────────
  // Wire an inline name <input> to commit-on-Enter/blur, cancel-on-Escape (once).
  function wireNameInput(input: HTMLInputElement, onCommit: (name: string) => void | Promise<void>): void {
    input.focus(); input.select?.();
    let done = false;
    const commit = async (): Promise<void> => { if (done) return; done = true; await onCommit(input.value.trim()); };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { done = true; render(); }
    });
    input.addEventListener('blur', commit);
  }

  function startCreateFolder(tile: HTMLElement): void {
    // Replace the whole tile (NOT just .tile-meta): the input must not live inside the
    // <button class="tile-primary"> or Space/Enter would also activate the button.
    tile.classList.add('is-editing');
    tile.removeAttribute('data-create');
    tile.innerHTML = `
      <span class="tile-cover tile-cover--create" aria-hidden="true">${FOLDER_PLUS_ICON}</span>
      <div class="tile-meta"><input class="projects-name-input" type="text" placeholder="${escape(t('Folder name'))}" aria-label="${escape(t('New folder name'))}" maxlength="60"></div>`;
    // Inside a real folder, the new folder nests here (parentId); at root / Uncategorised
    // it's a top-level folder.
    const parent = (folderId && folderId !== UNCAT) ? folderId : null;
    wireNameInput(tile.querySelector('input')!, async (name) => {
      if (name) { try { await store.create(name, parent); } catch { /* empty name */ } }
      await reload(); render();
    });
  }

  function startRename(tile: HTMLElement | null, id: string | undefined): void {
    if (!id || id === UNCAT) return;
    const f = folders.find(x => x.id === id); if (!f) return;
    const onCommit = async (name: string): Promise<void> => {
      if (name && name !== f.name) { try { await store.rename(id, name); announce(t('Folder renamed')); } catch { /* empty */ } }
      await reload(); render();
    };
    if (tile?.matches?.('[data-rename-folder]')) {
      // Folder-view header: the title is an <h2> (not inside a button) - swap it directly.
      const input = document.createElement('input');
      input.className = 'projects-name-input'; input.value = f.name; input.maxLength = 60;
      input.setAttribute('aria-label', t('Folder name'));
      tile.replaceWith(input);
      wireNameInput(input, onCommit);
    } else if (tile) {
      // Root folder tile: replace the whole tile so the input isn't nested in the button.
      tile.classList.add('is-editing');
      tile.innerHTML = `
        <span class="tile-cover tile-cover--batch" aria-hidden="true">${FOLDER_ICON}</span>
        <div class="tile-meta"><input class="projects-name-input" type="text" maxlength="60" aria-label="${escape(t('Folder name'))}"></div>`;
      const input = tile.querySelector('input')!;
      input.value = f.name;
      wireNameInput(input, onCommit);
    }
  }

  // Rename a saved session in place. For a single-tool session the name IS the export
  // filename (host.state.list().filename = data.__export_filename), so the rename rewrites
  // both __export_filename and __label - the displayed name AND every future export (a
  // single download, or a folder "Render" batch row via folder-rows.js) use the new name.
  function startRenameSession(tile: HTMLElement | null, slot: string): void {
    const e = entryBySlot().get(slot); if (!tile || !e) return;
    const current = e.label || e.filename || toolName(e.toolId) || '';
    // Replace the WHOLE tile (the title lives inside the <button>; an input nested there
    // would let Space/Enter activate the button - see startCreateFolder).
    const cover = tile.querySelector('.tile-cover, .folder-mosaic')?.outerHTML || '';
    tile.classList.add('is-editing');
    tile.innerHTML = `${cover}<div class="tile-meta"><input class="projects-name-input" type="text" maxlength="80" aria-label="${escape(t('Session name'))}"></div>`;
    const input = tile.querySelector('input')!;
    input.value = current;
    wireNameInput(input, async (name) => {
      if (name && name !== current) { await applySessionRename(e, name); announce(t('Session renamed')); }
      await reload(); render();
    });
  }

  async function applySessionRename(entry: Entry, name: string): Promise<void> {
    try {
      const data = await (host as ProjectsHost).state.load(entry.slot);
      if (!data) return;
      data.__label = name;
      if (isBatchSlot(entry.slot)) {
        // A batch slot encodes its label → re-key under a new slot + follow membership.
        const newSlot = BATCH_SLOT_PREFIX + name;
        if (newSlot !== entry.slot) {
          await (host as ProjectsHost).state.save(newSlot, data, entry.thumb);
          await host.state.delete(entry.slot).catch(() => {});
          await store.swapSessionSlot(entry.slot, newSlot);
        } else {
          await (host as ProjectsHost).state.save(entry.slot, data, entry.thumb);
        }
      } else {
        data.__export_filename = name;   // the export filename for single-tool sessions
        await (host as ProjectsHost).state.save(entry.slot, data, entry.thumb);
      }
    } catch (e) { if (host.log) host.log('warn', 'projects: rename failed', { error: String(e) }); }
  }

  // Duplicate a saved session: copy its stored inputs to a FRESH slot filed beside the
  // original, named "… copy". Referenced assets are shared, not re-encoded (a copy of the
  // creation, not its bytes) - the same reference semantics Move keeps. The copy reuses the
  // source's thumbnail so it reads right before it's ever opened. A batch slot is keyed by
  // its label, so a colliding name gets a "copy 2/3…" bump; a single-tool slot is unique by
  // timestamp and needs none.
  // The core copy, WITHOUT the reload/render/announce - so a bulk run can duplicate many and
  // repaint once. `alsoTaken` carries the slots minted earlier in the same bulk loop, so two
  // copies of the same tool made in the SAME millisecond (Date.now() ties) still get distinct
  // slots. Returns the new slot, or null on skip/failure.
  async function duplicateSessionCore(slot: string, alsoTaken?: Set<string>): Promise<string | null> {
    const entry = entryBySlot().get(slot);
    if (!entry) return null;
    try {
      const data = await (host as ProjectsHost).state.load(slot);
      if (!data) return null;
      const base = entry.label || entry.filename || toolName(entry.toolId) || t('Untitled');
      let name = t('{name} copy', { name: base });
      const batch = isBatchSlot(slot);
      const taken = entryBySlot();
      const isTaken = (s: string): boolean => taken.has(s) || alsoTaken?.has(s) === true;
      let newSlot = batch ? BATCH_SLOT_PREFIX + name : `${entry.toolId}:${Date.now()}`;
      // Guarantee a fresh slot even inside a bulk loop (same-ms timestamps, or a batch name clash).
      for (let n = 2; isTaken(newSlot); n++) {
        name = t('{name} copy {n}', { name: base, n });
        newSlot = batch ? BATCH_SLOT_PREFIX + name : `${entry.toolId}:${Date.now()}-${n}`;
      }
      data.__label = name;
      if (!batch) data.__export_filename = name;   // single-tool export filename tracks the name
      await (host as ProjectsHost).state.save(newSlot, data, entry.thumb || '');
      // File beside the original: same folder, or loose (Uncategorised) if it was loose.
      const owner = ownerByRef.get(slot);
      if (owner) await store.moveItem(newSlot, owner.id, 'session');
      alsoTaken?.add(newSlot);
      return newSlot;
    } catch (e) { if (host.log) host.log('warn', 'projects: duplicate failed', { error: String(e) }); return null; }
  }

  // Duplicate a saved session: copy its stored inputs to a FRESH slot filed beside the
  // original, named "… copy". Referenced assets are shared, not re-encoded (a copy of the
  // creation, not its bytes) - the same reference semantics Move keeps. The copy reuses the
  // source's thumbnail so it reads right before it's ever opened.
  async function duplicateSession(slot: string): Promise<void> {
    if (!(await duplicateSessionCore(slot)) || !mounted) return;
    await reload(); render();
    announce(t('Session duplicated'));
  }

  // Bulk Duplicate (the selection bar): copy every selected SESSION beside its original in one
  // repaint. Folders and images in the selection are skipped - only creations duplicate.
  async function duplicateSelection(): Promise<void> {
    const slots = [...selected].filter(([, kind]) => kind === 'session').map(([ref]) => ref);
    if (!slots.length) return;
    const made = new Set<string>();
    let n = 0;
    for (const slot of slots) if (await duplicateSessionCore(slot, made)) n++;
    if (!mounted) return;
    await reload(); render();
    announce(t('{n} duplicated', { n }));
  }

  // "+ New asset": open the shared, host-owned asset picker (the SAME Library / Saved
  // creations / Projects / Tools dialog that fills a tool image slot) in "collect into
  // this folder" mode. Every pick ADDS to the current folder and the dialog stays open
  // for several in a row: a Library/your-images/uploaded/rendered image is filed as an
  // image item (catalog assets by reference - no duplicate bytes), a saved creation is
  // filed as an editable session, and a tool either opens its editor (files in on first
  // save) or "+ Add"s a default-settings session. Standardised in one component, so the
  // UX improves everywhere at once (replaces the old bespoke tools-only chooser).
  function startCreateTool(): void { void openAddPicker(); }

  async function openAddPicker(): Promise<void> {
    // A real folder is the drop target; at the root / the synthetic Uncategorised bucket
    // there's no folder to hold an image (catalog references especially have nowhere to
    // live loose), so image adds are declined there with a nudge while tool + saved-
    // creation adds still work (they file loose = Uncategorised).
    const target = (folderId && folderId !== UNCAT) ? folderId : null;
    const folderName = target ? (folders.find(f => f.id === target)?.name || t('this folder'))
      : folderId === UNCAT ? t('Uncategorised') : t('Projects');
    // Projects are creations you file, not on-device transforms - offer every non-utility
    // tool (a superset of the picker's image-embeddable set, so audio/video tools show too).
    const tools = ((w.__toolIndex?.tools ?? []) as unknown as ProjectsTool[]).filter(x => x.category !== 'utility');
    // Fold in the user's own saved tools (lib/user-tools) as extra tool cards under the "Your
    // tools" category. Their id is namespaced (usertool:<id>), so onOpenTool / onQuickAddTool
    // below route them through their BASE tool seeded with the saved values - never the
    // synthetic id, which no tool loader could resolve. Kept LOCAL to this picker's tool list
    // (not merged into window.__toolIndex, which ~17 other readers consume), so nothing else
    // has to become user-tool-aware. Best-effort: a load failure just omits them.
    const userToolById = new Map<string, ProjectedUserTool>();
    try {
      const { createUserToolStore, projectUserTool } = await import('../lib/user-tools.ts');
      const mine = await createUserToolStore(host as unknown as Parameters<typeof createUserToolStore>[0]).list();
      for (const ut of mine) {
        const p = projectUserTool(ut);
        userToolById.set(p.id, p);
        tools.push({ id: p.id, name: p.name, description: p.description, category: p.category, icon: p.icon, formats: p.formats });
      }
    } catch (err) { host.log?.('warn', 'projects: user tools load failed', { error: String(err) }); }
    // Lazy chunk - the shared picker (DOMPurify, engine, its own CSS) stays out of the
    // Projects boot chunk, loaded only when the add flow actually opens (matches how the
    // bridge's host.assets.pick and this view's other heavy actions import on demand).
    const { openPicker } = await import('./picker.ts');
    await openPicker(host as unknown as PickerHost, {
      allowUpload: true,
      collect: {
        folderName,
        tools,
        onAsset: async (ref) => {
          // Images (catalog references especially) need a real folder to live in - the
          // root and the synthetic Uncategorised bucket can't hold one. Decline with a nudge.
          if (!target) return { ok: false, label: t('Open a folder to add images') };
          // A user upload (user/…) is owned bytes; a catalog id is a reference. Both are
          // stored as the folder's image item by id - reconciliation keeps either kind.
          await store.addItem(target, { type: 'image', ref: ref.id });
          return { ok: true };
        },
        onSession: async (slot) => {
          await store.moveItem(slot, target, 'session');   // target null → filed loose (Uncategorised)
          return { ok: true };
        },
        onOpenTool: async (toolId) => {
          // A user tool opens its BASE tool seeded with its saved values, via the same
          // in-memory pending-seed the drop/PSD route uses (the mount consumes it as
          // `seededDirect`, so no URL packing and no chooser). A REAL tool with saved
          // variations offers the same default-or-variation chooser the quick-add path
          // does (plans/134 WP-P10) - configure-first and quick-add can't diverge on
          // whether your saved work is offered. A tool with none opens as before.
          const ut = userToolById.get(toolId);
          const openId = ut ? ut.userTool.baseToolId : toolId;
          if (ut) setPendingToolSeed(openId, ut.userTool.values);
          else {
            const choice = await chooseAddSeed(toolId);
            if (choice.cancelled) return;   // stay in the picker
            if (choice.values) setPendingToolSeed(openId, choice.values);
          }
          try { sessionStorage.setItem(FILE_INTO_KEY, target ?? ''); } catch { /* private mode */ }
          armReturn();
          window.location.hash = '#/tool/' + openId;
        },
        onQuickAddTool: async (toolId) => {
          try {
            // A user tool IS a specific seed, so it quick-adds its base tool + saved values
            // straight away (no default-or-variation step). A real tool offers that chooser.
            const ut = userToolById.get(toolId);
            if (ut) { await addDefaultSession(ut.userTool.baseToolId, ut.userTool.values); return { ok: true }; }
            const choice = await chooseAddSeed(toolId);
            if (choice.cancelled) return { ok: false, silent: true };   // chooser dismissed → no toast
            await addDefaultSession(toolId, choice.values);
            return { ok: true };
          }
          catch (err) { host.log?.('warn', 'projects: quick-add failed', { tool: toolId, error: String(err) }); return { ok: false }; }
        },
      },
    });
    // The picker closed (× / Escape / a tool that navigated away) - reflect everything
    // added under it in one pass.
    if (mounted) { await reload(); render(); }
  }

  // Create a saved session for `toolId` and file it into the current folder. With no seed it
  // is the tool's RESOLVED defaults (createRuntime alone runs onInit + profile binding, no
  // offscreen render); with a seed (a saved user template/variation) the runtime is born with
  // those input values, exactly the way the template chooser seeds a fresh mount. No thumbnail:
  // a fresh session shows the standard placeholder cover until it's opened and saved. The
  // caller re-renders once the picker closes.
  async function addDefaultSession(toolId: string, seedValues?: Record<string, unknown>): Promise<void> {
    const tool = await getTool(toolId);
    const runtime = await createRuntime(tool, host, (seedValues ?? {}) as Parameters<typeof createRuntime>[2]);
    const values = Object.fromEntries(runtime.getModel().map(i => [i.id, i.value]));
    // getModel returns only declared inputs, so carry any __-prefixed export markers the seed
    // brought (a saved template may store them beside its input values) through separately.
    const markers: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(seedValues ?? {})) if (k.startsWith('__')) markers[k] = v;
    const slot = `${tool.manifest.id}:${Date.now()}`;
    await (host as ProjectsHost).state.save(slot, {
      ...values,
      ...markers,
      __toolId:        tool.manifest.id,
      __toolVersion:   tool.manifest.version,
      __export_format: (markers.__export_format as string) || tool.manifest.render?.formats?.[0] || '',
    }, '');
    const target = (folderId && folderId !== UNCAT) ? folderId : null;
    if (target) await store.moveItem(slot, target, 'session');
  }

  // Quick-add intermediate step: when a tool has saved templates/variations, offer a tiny
  // chooser (the tool's default settings, or one of the user's saved variations) and return
  // the seed values to hand addDefaultSession. A tool with NONE resolves straight to the
  // default (no extra step, exactly as before). `cancelled` is true only when the chooser was
  // actually shown and dismissed, so the caller can stay silent instead of flashing a failure.
  async function chooseAddSeed(toolId: string): Promise<{ cancelled: boolean; values?: Record<string, unknown> }> {
    let mine: UserTemplate[] = [];
    try {
      const { createUserTemplateStore } = await import('../lib/user-templates.ts');
      mine = await createUserTemplateStore(host as unknown as Parameters<typeof createUserTemplateStore>[0]).list(toolId);
    } catch { /* best-effort - fall through to the default add */ }
    if (!mine.length) return { cancelled: false };   // nothing saved → default, no extra step
    closeMenu();
    const toolName = nameById.get(toolId) || toolId;
    const chosen = await choiceDialog({
      title: tRaw('Add {tool}', { tool: toolName }),
      message: t('Start from the default, or one of your saved variations.'),
      choices: [
        { id: '__default__', label: t('Default settings'), primary: true },
        ...mine.map(ut => ({ id: ut.id, label: ut.name })),
      ],
    });
    if (chosen === null) return { cancelled: true };            // Cancel / Escape / backdrop
    if (chosen === '__default__') return { cancelled: false };  // resolved defaults
    return { cancelled: false, values: mine.find(x => x.id === chosen)?.values };
  }

  // Arm the return target so the tool's Save button lands back on this exact page - 
  // root `/#/p`, the Uncategorised view, or a specific folder. navigateTo-compatible URL.
  function armReturn(): void {
    armSessionReturn('/#/p' + (folderId ? '/' + folderId : ''));
  }

  function resumeSession(slot: string): void {
    closeMenu();
    const batch = isBatchSlot(slot);
    if (!batch) armReturn();   // a batch grid opens in /pro, which owns its own return
    window.location.hash = sessionOpenHref({ slot, toolId: entryBySlot().get(slot)?.toolId || '' }, batch);
  }

  // The href resumeSession() ends up at (the shared sessionOpenHref - same target the
  // spotlight's projects provider uses) - set on the preview-ribbon tiles so a
  // middle-click / no-JS open still lands right (the click handler routes clean taps
  // through resumeSession so Save returns here, but the anchor is the accessible fallback).
  const resumeHref = (e: Entry): string => sessionOpenHref(e, isBatchSlot(e.slot));

  // The gallery persists the Featured strip's view mode (Gallery drift | Cover Flow); the
  // Uncategorised ribbon reads the same key so a mode chosen there carries over.
  function readFeaturedView(): FeaturedViewMode {
    try {
      const v = localStorage.getItem(FEATURED_VIEW_STORAGE);
      if (v && (FEATURED_VIEWS as readonly string[]).includes(v)) return v as FeaturedViewMode;
    } catch { /* storage off */ }
    return 'gallery';
  }

  // The favourites strip at the top of the Projects ROOT view: a browsable ribbon of the
  // user's starred folders / sessions / images, like the gallery + catalog favourites strips.
  // Mounts only at root (its [data-fav-strip] element exists only in rootHtml), so it is
  // mutually exclusive with the Uncategorised ribbon and both can share featuredHandle.
  /** The folder silhouette as a standalone SVG (for the favourites carousel):
   *  tab flush with a SQUARE top-left body corner (exactly the folders.css
   *  cover geometry - radius 0 where the tab sits, rounded elsewhere), a 2×2
   *  mosaic of member previews inside the body, tint + overhanging emoji.
   *  Member thumbs embed only as data: URLs (an SVG loaded via <img> cannot
   *  fetch blob:/http resources) - anything else renders as a tinted cell. */
  function folderCoverDataUrl(folder: Folder): string {
    const tint = folder.color || '#8d8d8d';
    const escXml = (s: string): string => s.replace(/[&<>"]/g, c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]!));
    // Up to four member previews, resolved the same way the grid tile's mosaic is.
    const thumbs = folder.items.slice(0, 4).map(i => {
      const p = previewForRef(i.ref);
      const src = p && 'thumb' in p && p.thumb ? p.thumb : p && 'url' in p && p.url ? p.url : '';
      return typeof src === 'string' && src.startsWith('data:') ? src : '';
    });
    // Body x14..166, y30..112; cells inset 8 with a 4px gutter.
    const CELL_W = 66, CELL_H = 31;
    const cellPos: Array<[number, number]> = [[22, 38], [92, 38], [22, 73], [92, 73]];
    const cells = cellPos.map(([x, y], i) => {
      const src = thumbs[i];
      const frame = `<rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="5" fill="#ffffff" fill-opacity="${src ? '0.9' : '0.35'}"/>`;
      if (!src) return frame;
      return `${frame}<clipPath id="fc${i}"><rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="5"/></clipPath>`
        + `<image href="${escXml(src)}" x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#fc${i})"/>`;
    }).join('');
    const emoji = folder.emoji ? `<text x="152" y="118" font-size="32" text-anchor="middle">${escXml(folder.emoji)}</text>` : '';
    return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 130">
      <path d="M14 30 v-10 a8 8 0 0 1 8 -8 h44 a10 10 0 0 1 10 10 v8 z" fill="${escXml(tint)}" fill-opacity="0.72"/>
      <path d="M14 30 H154 A12 12 0 0 1 166 42 V100 A12 12 0 0 1 154 112 H26 A12 12 0 0 1 14 100 Z" fill="${escXml(tint)}" fill-opacity="0.3"/>
      <path d="M14 30 H154 A12 12 0 0 1 166 42 V100 A12 12 0 0 1 154 112 H26 A12 12 0 0 1 14 100 Z" fill="none" stroke="${escXml(tint)}" stroke-opacity="0.55"/>
      ${cells}
      ${emoji}
    </svg>`);
  }

  function favEntries(): FeaturedEntry[] {
    const out: FeaturedEntry[] = [];
    for (const ref of favourites) {
      const e = entryBySlot().get(ref);
      if (e) {   // a favourited saved session
        const name = e.label || e.filename || toolName(e.toolId);
        const tn = toolName(e.toolId);
        out.push({ id: ref, name, preview: e.thumb || undefined, href: resumeHref(e), featured: { blurb: name !== tn ? tn : undefined } });
        continue;
      }
      const folder = folders.find(f => f.id === ref);
      if (folder) {
        // A favourited folder shows AS a folder (Andy, 2026-08-20) - the same
        // tabbed silhouette its tile wears, tint + emoji included, as a pure
        // vector data URL - never one member's render masquerading as an asset.
        out.push({ id: ref, name: folder.name, preview: folderCoverDataUrl(folder), href: '#/p/' + ref, featured: { blurb: tRaw('Folder · {n} items', { n: tileItemCount(folder) }) } });
        continue;
      }
      const img = imageRefs.get(ref);   // a favourited folder image - opens the folder it lives in
      const imgOwner = img?.url ? ownerByRef.get(ref) : null;
      // Only show it with a valid href (its folder); without one the featured strip would fall
      // back to a dead #/tool/<ref> route, so an owner-less image is simply left off the strip.
      if (img?.url && imgOwner) out.push({ id: ref, name: String(img.meta?.name ?? ''), preview: img.url, href: '#/p/' + imgOwner.id, featured: { blurb: t('Image') } });
    }
    return out;
  }
  function mountFavStrip(root: HTMLElement): void {
    const mount = root.querySelector<HTMLElement>('[data-fav-strip]');
    if (!mount) return;
    const tiles = favEntries();
    if (!tiles.length) { mount.remove(); return; }   // all favourites vanished (deleted elsewhere)
    featuredHandle = mountFeaturedRow(mount, tiles, host, {
      viewMode: readFeaturedView(),
      ariaLabel: t('Favourites'),
      tileDragOut: false,
      tileMenu: false,
    });
  }

  // Hydrate the Uncategorised preview ribbon: the shared Featured strip over the loose
  // sessions (same drift / Cover Flow / mobile grip). Re-mounted each render; the prior
  // handle is destroyed at the top of render() so its rAF loop + listeners don't leak.
  function mountUncatRibbon(root: HTMLElement): void {
    const mount = root.querySelector<HTMLElement>('[data-uncat-ribbon]');
    if (!mount) return;
    const tiles: FeaturedEntry[] = sortSessions(uncategorised()).map(e => {
      const name = e.label || e.filename || toolName(e.toolId);
      const tn = toolName(e.toolId);
      return {
        id: e.slot,
        name,
        preview: e.thumb || undefined,
        href: resumeHref(e),
        featured: { blurb: name !== tn ? tn : undefined },
      };
    });
    if (!tiles.length) return;
    featuredHandle = mountFeaturedRow(mount, tiles, host, {
      viewMode: readFeaturedView(),
      ariaLabel: t('Uncategorised previews'),
      tileDragOut: true,
      tileMenu: true,
    });
    // A ⋯ button on every ribbon preview opens the SAME actions menu (Open · Rename · Move to
    // folder… · Render · Delete) the grid session tiles get - the touch-friendly path to
    // organising loose sessions that also works in Cover Flow, where drag-to-folder can't
    // (native HTML5 drag is mouse-only and fights the 3D pointer capture). Delegated on the
    // persistent mount so it survives the strip's clone / view-mode rebuilds.
    mount.addEventListener('click', (e) => {
      const btn = (e.target as Element | null)?.closest?.<HTMLElement>('.ftile-menu');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const tile = btn.closest<HTMLElement>('.ftile');
      const slot = tile?.dataset.tool;
      if (!slot) return;
      const r = btn.getBoundingClientRect();
      openMenu({ ref: slot, kind: 'session', tileEl: tile, anchorEl: btn, x: r.left, y: r.bottom + 6 });
    });
    // Each ribbon preview is also a drag source for the "Move to" rail (desktop) - same payload
    // a grid session tile carries (wireDrag), so the shared drop targets move it with no extra
    // wiring. Delegated on the persistent mount so it survives the strip's clone rebuilds
    // on a Gallery↔Cover-Flow switch. The tile's data-tool is the session slot.
    mount.addEventListener('dragstart', (e) => {
      const tile = (e.target as Element | null)?.closest?.<HTMLElement>('.ftile');
      const slot = tile?.dataset.tool;
      if (!tile || !slot) return;
      (e as DragEvent).dataTransfer!.setData('text/lolly-session', slot);
      (e as DragEvent).dataTransfer!.effectAllowed = 'move';
      tile.classList.add('is-dragging');
      root.classList.add('is-dragging-session');   // lights up the rail chips (see projects.css)
    });
    mount.addEventListener('dragend', (e) => {
      (e.target as Element | null)?.closest?.<HTMLElement>('.ftile')?.classList.remove('is-dragging');
      root.classList.remove('is-dragging-session');
    });
  }

  // ── delete a folder AND everything inside it (its WHOLE subtree) ────────────
  // Unlike store.remove() (which only drops one record and lifts its contents up), this
  // permanently deletes the folder, every SUB-FOLDER beneath it, and every saved session
  // and image they hold - including stored previews - then the folder records. Confirmed.
  // ── Trash (plans/133 WP-4) ───────────────────────────────────────────────
  // Deletes are soft: sessions move their state record into the `__trash__:`
  // slot namespace, folders lift their subtree records into a profile.trash
  // entry, and both get an undo toast. Real deletion happens on Delete forever,
  // Empty trash, or the 30-day sweep. Image items are references - "deleting"
  // one only removes it from the project; the bytes stay in the Catalog, whose
  // own delete has its own soft path.

  /** Move one session's state record between slots (thumb preserved). */
  const moveSlot = (from: string, to: string) => moveSessionSlot(host, from, to);

  /** Trash a set of loose/foldered sessions with ONE undo toast. */
  async function trashSessions(slots: readonly string[]): Promise<void> {
    const moved: Array<{ entry: import('../folders.ts').TrashedSession }> = [];
    for (const slot of slots) {
      const e = entryMap.get(slot);
      const parentId = ownerByRef.get(slot)?.id ?? null;
      const label = e?.label || e?.filename || toolName(e?.toolId ?? '') || slot;
      const tslot = TRASH_SLOT_PREFIX + slot;
      if (!(await moveSlot(slot, tslot))) continue;
      await store.moveItem(slot, null, 'session');
      const entry: import('../folders.ts').TrashedSession = {
        kind: 'session', slot: tslot, originalSlot: slot, label, parentId, deletedAt: new Date().toISOString(),
      };
      await store.trashAdd(entry);
      moved.push({ entry });
    }
    if (!mounted) return;
    await reload(); render();
    if (!moved.length) return;
    const first = moved[0]!.entry.label;
    showUndoToast({
      message: moved.length === 1 ? tRaw('Moved "{name}" to Trash.', { name: first }) : tRaw('Moved {n} sessions to Trash.', { n: moved.length }),
      undo: async () => { for (const m of moved) await restoreTrashEntry(m.entry); },
    });
  }

  /** Trash a folder subtree (records + member sessions) with an undo toast. */
  async function trashFolder(id: string): Promise<void> {
    closeMenu();
    if (!id || id === UNCAT) return;
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const subtreeIds = [id, ...descendantFolderIds(folders, id)];
    const tree = await store.detachSubtree(id);
    if (!tree) return;
    const sessionRefs = tree.flatMap(f => f.items.filter(i => i.type === 'session').map(i => i.ref));
    const moves: Array<{ originalSlot: string; slot: string }> = [];
    for (const ref of sessionRefs) {
      const tslot = TRASH_SLOT_PREFIX + ref;
      if (await moveSlot(ref, tslot)) moves.push({ originalSlot: ref, slot: tslot });
    }
    const entry: import('../folders.ts').TrashedFolder = {
      kind: 'folder', tree, rootId: id, name: folder.name, sessions: moves, deletedAt: new Date().toISOString(),
    };
    await store.trashAdd(entry);
    announce(tRaw('Moved "{name}" to Trash', { name: folder.name }));
    if (!mounted) return;
    showUndoToast({
      message: tRaw('Moved "{name}" to Trash.', { name: folder.name }),
      undo: async () => { await restoreTrashEntry(entry); },
    });
    // If we were viewing the trashed folder (or one beneath it), climb out.
    if (folderId != null && subtreeIds.includes(folderId)) {
      const parentId = folder.parentId ?? null;
      window.location.hash = parentId ? `#/p/${parentId}` : '#/p';
      return;
    }
    await reload(); render();
  }

  /** Put a trash entry back: records + slots + membership. */
  async function restoreTrashEntry(entry: TrashEntry): Promise<void> {
    if (entry.kind === 'session') {
      await moveSlot(entry.slot, entry.originalSlot);
      const live = await store.list();
      if (entry.parentId && live.some(f => f.id === entry.parentId)) {
        await store.moveItem(entry.originalSlot, entry.parentId, 'session');
      }
      await store.trashDrop(new Set([entry.slot]));
    } else {
      for (const m of entry.sessions) await moveSlot(m.slot, m.originalSlot);
      await store.restoreSubtree(entry.tree);
      await store.trashDrop(new Set([entry.rootId]));
    }
    if (!mounted) return;
    await reload(); render();
  }

  /** Really delete a trash entry's data (Delete forever / Empty trash / sweep). */
  async function purgeTrashEntry(entry: TrashEntry): Promise<void> {
    if (entry.kind === 'session') {
      await host.state.delete(entry.slot).catch(() => {});
      await store.trashDrop(new Set([entry.slot]));
    } else {
      for (const m of entry.sessions) await host.state.delete(m.slot).catch(() => {});
      await store.trashDrop(new Set([entry.rootId]));
    }
  }

  /** Age out entries past the retention window. Runs once per mount, silently. */
  async function sweepTrash(): Promise<void> {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const old = trashEntries.filter(e => +new Date(e.deletedAt) < cutoff);
    for (const e of old) await purgeTrashEntry(e).catch(() => {});
    if (old.length) trashEntries = await store.trashList().catch(() => trashEntries);
  }

  async function deleteFolderCascade(id: string): Promise<void> {
    await trashFolder(id);
  }

  const authorForExport = (): Profile | null => (profile?.useDetails ? profile : null);

  // Every render/export path (folder, single session, selection) runs as a WP-F background
  // JOB (lib/batch-job.ts): the global job toast owns its progress and its cancel, and a
  // failure anywhere in `run` - row assembly included - surfaces there through job.fail.
  // Nothing is bound to this view any more, so navigating away leaves the run alive and
  // visible, and the zip still downloads when it lands.
  function startRenderJob(title: string, run: Parameters<typeof startBatchExport>[1]): void {
    closeMenu();
    startBatchExport(title, run);
  }

  // ── render a whole folder as one nested batch zip (gated /pro import) ────────
  async function renderFolder(id: string): Promise<void> {
    closeMenu();
    const isUncat = id === UNCAT;
    const folder = isUncat
      ? { name: t('Uncategorised'), items: uncategorised().map(e => ({ type: 'session', ref: e.slot })) } as Folder
      : folders.find(f => f.id === id);
    if (!folder) return;
    // A folder is renderable if its WHOLE subtree (it + descendants) holds any items.
    const subtreeItems = isUncat
      ? folder.items
      : [id, ...descendantFolderIds(folders, id)].flatMap(cid => folders.find(f => f.id === cid)?.items ?? []);
    if (!subtreeItems.length) return;
    // Ask before rendering, and optionally AES-256-lock any PDF members in the zip.
    const { askExportLock } = await import('../lib/export-lock.ts');
    const { ok, strongPassword, zipLock } = await askExportLock(t('this folder'), true);
    if (!ok) return;
    startRenderJob(tRaw('Rendering {name}', { name: folder.name }), async (job) => {
      const { exportFolderAsBatch } = await import('../pro/folder-export.ts');
      return exportFolderAsBatch(host, folder, {
        job,
        author: authorForExport(),
        folders,   // recurse sub-folders into nested zip paths (Uncategorised has none)
        onBatchRendered: opts.onBatchRendered,
        strongPassword, zipLock,
      });
    });
  }

  // ── render a SINGLE saved session (parity with "Render folder") ─────────────
  // A single-tool session downloads as a bare file (its native format); a batch session
  // falls back to a zip. See pro/folder-export.js renderSessionToFile.
  function renderSession(slot: string): void {
    // The job is named by what it is rendering - the session's own name, else its tool.
    // It is what the toast (and a desktop notification) says while this view is gone.
    const entry = entryBySlot().get(slot);
    const label = entry?.label || entry?.filename || toolName(entry?.toolId ?? '');
    startRenderJob(tRaw('Rendering {name}', { name: label }), async (job) => {
      const { renderSessionToFile } = await import('../pro/folder-export.ts');
      return renderSessionToFile(host, slot, { job, author: authorForExport(), onBatchRendered: opts.onBatchRendered });
    });
  }

  // ── share a saved session as a link (same dialog as the tool view's Share) ──
  // Reconstruct the tool's URL state from the saved values (createRuntime →
  // serializeUrlState, the picker's recipe) and hand it to the shared Share dialog.
  async function shareSession(slot: string): Promise<void> {
    closeMenu();
    const entry = entryBySlot().get(slot);
    if (!entry || isBatchSlot(slot)) return;   // batch sessions have no single tool URL
    try {
      const data = await (host as ProjectsHost).state.load(slot);
      if (!data) throw new Error('This saved session could not be loaded.');
      const tool = await getTool(entry.toolId);
      const runtime = await createRuntime(tool, host, data as Parameters<typeof createRuntime>[2]);
      const query = serializeUrlState(runtime.getModel());
      const baseParts = query ? query.split('&') : [];
      // Carry the session's export format so the recipient's link opens on the same one.
      if (data.__export_format) baseParts.push(`format=${encodeURIComponent(data.__export_format as string)}`);
      openShareDialog({
        toolId: entry.toolId, baseParts, manifest: tool.manifest,
        currentFormat: (data.__export_format as string) || '', title: t('Share this creation'),
      });
    } catch (err) {
      host.log?.('warn', 'projects: share session failed', { slot, error: String(err) });
    }
  }

  // ── team projects (control-plane session source; dormant without one) ───────
  // A self-contained modal: browse the instance's shared projects → their
  // sessions → open one into its tool. Opening reuses the SAME reconstruction
  // shareSession() uses (createRuntime → serializeUrlState → navigate), so a team
  // session opens as a fresh working copy at full fidelity (blocks included), with
  // no local slot written. The source is pure data (see lib/session-source.ts).
  const teamRowStyle = 'display:flex;justify-content:space-between;gap:1rem;width:100%;padding:.55rem .7rem;background:none;border:0;border-radius:var(--radius);color:inherit;text-align:left;cursor:pointer;font:inherit';
  async function openTeamProjects(): Promise<void> {
    const src = getSessionSource();
    if (!src) return;
    const modal = mountModal<void>(
      `<div style="min-width:min(30rem,86vw)"><h2 style="margin-top:0">${escape(t('Team projects'))}</h2>
        <div data-team-body><p class="projects-empty">${escape(t('Loading…'))}</p></div></div>`,
      { className: 'team-projects-dialog' },
    );
    const body = modal.el.querySelector<HTMLElement>('[data-team-body]')!;
    // Which project's session list is on screen - the modal is two screens deep and the
    // session rows only carry their own id. Recorded so an opened session can name the
    // project it came from in its origin stash (org/team-session-origin.ts).
    let openProjectId: string | null = null;
    const row = (attr: string, id: string, name: string, meta: string): string =>
      `<li><button type="button" style="${teamRowStyle}" ${attr}="${escape(id)}"
        onmouseover="this.style.background='color-mix(in oklab,currentColor 8%,transparent)'" onmouseout="this.style.background='none'">
        <span>${escape(name)}</span><span style="opacity:.6">${escape(meta)}</span></button></li>`;
    const list = (items: string): string => `<ul style="list-style:none;margin:.4rem 0 0;padding:0;display:flex;flex-direction:column;gap:2px">${items}</ul>`;
    const showProjects = async (): Promise<void> => {
      openProjectId = null;
      const projects = await src.listProjects().catch(() => []);
      if (!modal.el.isConnected) return;
      body.innerHTML = projects.length
        ? list(projects.map(p => row('data-team-project', p.id, p.name, p.sessionCount != null ? t('{n} sessions', { n: String(p.sessionCount) }) : '')).join(''))
        : `<p class="projects-empty">${escape(t('No team projects are shared with you yet.'))}</p>`;
    };
    const showSessions = async (projectId: string, name: string): Promise<void> => {
      openProjectId = projectId;
      body.innerHTML = `<p class="projects-empty">${escape(t('Loading…'))}</p>`;
      const sessions = await src.listSessions(projectId).catch(() => []);
      if (!modal.el.isConnected) return;
      const back = `<button type="button" data-team-back style="background:none;border:0;color:inherit;opacity:.7;cursor:pointer;font:inherit;padding:.2rem 0;margin-bottom:.3rem">${escape(t('← All team projects'))}</button>`;
      body.innerHTML = back + `<h3 style="margin:.1rem 0 .2rem;font-size:1rem">${escape(name)}</h3>` + (sessions.length
        ? list(sessions.map(s => row('data-team-session', s.id, s.label || toolName(s.toolId) || s.toolId, toolName(s.toolId) || s.toolId)).join(''))
        : `<p class="projects-empty">${escape(t('This project has no sessions yet.'))}</p>`);
    };
    body.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const proj = el.closest<HTMLElement>('[data-team-project]');
      if (proj) { void showSessions(proj.dataset.teamProject!, proj.querySelector('span')?.textContent || ''); return; }
      if (el.closest('[data-team-back]')) { void showProjects(); return; }
      const sess = el.closest<HTMLElement>('[data-team-session]');
      if (sess) { modal.close(); void openTeamSession(sess.dataset.teamSession!, openProjectId); }
    });
    void showProjects();
  }

  async function openTeamSession(sessionId: string, projectId?: string | null): Promise<void> {
    const src = getSessionSource();
    if (!src) return;
    try {
      const data = await src.fetchSession(sessionId);
      if (!data) { announce(t('That session is no longer available.')); return; }
      const tool = await getTool(data.toolId);
      const runtime = await createRuntime(tool, host, data.inputs as Parameters<typeof createRuntime>[2]);
      const query = serializeUrlState(runtime.getModel());
      armReturn();
      // The hash below is a faithful working copy that has otherwise forgotten where it
      // came from: the instance's id for this session is not an input and is deliberately
      // not serialised into a link. Hand it to the mount alongside the navigation instead
      // - a one-shot stash the tool view spends on mount, and the only thing that lets the
      // Share dialog's "Work collab" row key a room on the session actually being edited
      // (org/team-session-origin.ts; plans/100 section 7). Armed LAST, immediately before the
      // navigation it belongs to, so a failure above leaves nothing armed.
      rememberTeamSessionOrigin({ sessionId, toolId: data.toolId, ...(projectId ? { projectId } : {}) });
      window.location.hash = `#/tool/${data.toolId}${query ? `?${query}` : ''}`;
    } catch (err) {
      host.log?.('warn', 'projects: open team session failed', { sessionId, error: String(err) });
      announce(t('That session could not be opened.'));
    }
  }

  // ── bulk actions over the current multi-selection ───────────────────────────
  // Selected FOLDERS that are descendants of another selected folder are redundant - 
  // the ancestor's subtree already covers them. Drop them so we don't double-process.
  function topLevelSelectedFolders(): string[] {
    const ids = selectedByKind('folder');
    return ids.filter(id => !ids.some(other => other !== id && descendantFolderIds(folders, other).includes(id)));
  }

  async function renderSelection(): Promise<void> {
    const sessionRefs = selectedByKind('session');
    const folderIds = topLevelSelectedFolders();
    if (!sessionRefs.length && !folderIds.length) return;
    const label = folderId && folderId !== UNCAT ? (folders.find(f => f.id === folderId)?.name || t('Selection')) : t('Selection');
    // Ask before rendering, and optionally AES-256-lock any PDF members in the zip.
    const { askExportLock } = await import('../lib/export-lock.ts');
    const { ok, strongPassword, zipLock } = await askExportLock(t('this selection'), true);
    if (!ok) return;
    startRenderJob(tRaw('Rendering {name}', { name: label }), async (job) => {
      const { exportSelectionAsBatch } = await import('../pro/folder-export.ts');
      return exportSelectionAsBatch(host, {
        label, sessionRefs, folderIds, allFolders: folders,
        job, author: authorForExport(), onBatchRendered: opts.onBatchRendered,
        strongPassword, zipLock,
      });
    });
  }

  // Move EVERY selected item into `dest` (null = root) and clear the selection. Descendant
  // folders of another selected folder are pruned (their ancestor already carries them);
  // store.moveFolder guards self/descendant cycles, so dropping onto a selected folder just
  // leaves it put while its siblings move in. Shared by drag-and-drop and the "Move to…" bar.
  async function applySelectionMove(dest: string | null): Promise<void> {
    for (const ref of selectedByKind('session')) await store.moveItem(ref, dest, 'session');
    for (const ref of selectedByKind('image'))   await store.moveItem(ref, dest, 'image');
    for (const id of topLevelSelectedFolders())  await store.moveFolder(id, dest); // store guards cycles
    dropSelection();
  }

  function moveSelection(): void {
    const folderIds = topLevelSelectedFolders();
    if (!selected.size) return;
    // Can't move a selected folder into itself or any selected folder's subtree.
    const blocked = new Set(folderIds.flatMap(id => [id, ...descendantFolderIds(folders, id)]));
    openMovePicker({
      title: selected.size === 1 ? t('Move 1 item to…') : t('Move {n} items to…', { n: selected.size }), blocked,
      onPick: async (dest) => {
        const n = selected.size;
        await applySelectionMove(dest);
        if (!mounted) return;
        await reload(); render();
        announce(n === 1 ? t('1 item moved') : t('{n} items moved', { n }));
      },
    });
  }

  async function newFolderFromSelection(): Promise<void> {
    if (!selected.size) return;
    const name = await promptFolderName();
    if (!name || !mounted) return;
    const parent = (folderId && folderId !== UNCAT) ? folderId : null;
    const created = await store.create(name, parent);
    for (const ref of selectedByKind('session')) await store.moveItem(ref, created.id, 'session');
    for (const ref of selectedByKind('image'))   await store.moveItem(ref, created.id, 'image');
    for (const id of topLevelSelectedFolders()) { if (id !== created.id) await store.moveFolder(id, created.id); }
    dropSelection();
    if (!mounted) return;
    await reload(); render();
  }

  async function deleteSelection(): Promise<void> {
    // Everything goes through the Trash (plans/133 WP-4) - no confirm, an undo
    // toast per kind is the safety net. Images are references: they just leave
    // their project (bytes stay in the Catalog).
    const sessionRefs = selectedByKind('session');
    const imageSelRefs = selectedByKind('image');   // standalone-selected folder images
    const folderIds = topLevelSelectedFolders();
    if (!sessionRefs.length && !imageSelRefs.length && !folderIds.length) return;
    dropSelection();
    const removedImages: Array<{ owner: string; ref: string }> = [];
    for (const ref of imageSelRefs) {
      const owner = ownerByRef.get(ref);
      if (!owner) continue;
      try { await store.removeItem(owner.id, ref); removedImages.push({ owner: owner.id, ref }); }
      catch (err) { host.log?.('warn', 'projects: bulk image remove failed', { ref, error: String(err) }); }
    }
    if (removedImages.length) {
      showUndoToast({
        message: tRaw('Removed {n} images from the project. They are still in the Catalog.', { n: removedImages.length }),
        undo: async () => {
          for (const r of removedImages) await store.addItem(r.owner, { type: 'image', ref: r.ref }).catch(() => {});
          if (mounted) { await reload(); render(); }
        },
      });
    }
    for (const id of folderIds) await trashFolder(id);
    if (sessionRefs.length) await trashSessions(sessionRefs);
    if (!mounted) return;
    await reload(); render();
  }

  // ── clipboard (plans/133 WP-7) ──────────────────────────────────────────────
  /** The destination for a paste, an OS drop, or New-from-template: the open folder, or loose (null). */
  const currentFolderTarget = (): string | null => (folderId && folderId !== UNCAT) ? folderId : null;

  /** Put refs on the module clipboard. Images are single-home REFERENCES, so they
   *  can be cut (moved) but never copied - a copy drops them and says so. */
  function setClipboard(mode: 'cut' | 'copy', refs: readonly string[]): void {
    closeMenu();
    let items = refs.map(ref => ({ ref, kind: kindOfRef(ref) }));
    const droppedImages = mode === 'copy' ? items.filter(i => i.kind === 'image').length : 0;
    if (droppedImages) items = items.filter(i => i.kind !== 'image');
    clipboard = items.length ? { mode, items } : null;
    dropSelection();
    render();
    const n = items.length;
    const counted = mode === 'cut' ? (n === 1 ? t('1 item cut') : t('{n} items cut', { n })) : (n === 1 ? t('1 item copied') : t('{n} items copied', { n }));
    announce(
      droppedImages && !n ? t('Images are references - use Cut to move them')
      : droppedImages ? `${counted}. ${t('Images are references - use Cut to move them')}`
      : counted,
    );
  }

  /** Paste the clipboard into `dest` (null = loose). A cut moves and empties the
   *  clipboard; a copy duplicates and keeps it, so it can be pasted again. */
  async function pasteClipboard(dest: string | null): Promise<void> {
    closeMenu();
    const clip = clipboard;
    if (!clip?.items.length) return;
    // A folder can't land inside itself or its own subtree.
    const blocked = new Set(clip.items.filter(i => i.kind === 'folder').flatMap(i => [i.ref, ...descendantFolderIds(folders, i.ref)]));
    if (dest && blocked.has(dest)) { announce(t('A folder cannot be pasted into itself')); return; }
    // An image needs a folder to live in: refuse up front (clipboard kept) rather
    // than silently dropping it at the top level.
    if (!dest && clip.items.some(i => i.kind === 'image')) { announce(t('Open a folder to paste images into it')); return; }
    let n = 0;
    let stayed = 0;   // image references a COPY leaves with the original
    if (clip.mode === 'cut') {
      const left: typeof clip.items = [];
      for (const it of clip.items) {
        if (it.kind === 'folder' && folders.some(f => f.id === it.ref)) { await store.moveFolder(it.ref, dest); n++; }
        else if (it.kind === 'session' && entryMap.has(it.ref)) { await store.moveItem(it.ref, dest, 'session'); n++; }
        else if (it.kind === 'image' && dest && ownerByRef.has(it.ref)) { await store.moveItem(it.ref, dest, 'image'); n++; }
        else left.push(it);   // gone since it was cut (deleted elsewhere) - nothing to move
      }
      clipboard = null;
      if (left.length) host.log?.('info', 'projects: cut items no longer exist', { refs: left.map(i => i.ref) });
    } else {
      const made = new Set<string>();
      for (const it of clip.items) {
        if (it.kind === 'session') {
          const slot = await duplicateSessionCore(it.ref, made);
          if (slot) { await store.moveItem(slot, dest, 'session'); n++; }
        } else if (it.kind === 'folder') {
          const r = await deepCopyFolder(it.ref, dest, made);
          if (r) { n++; stayed += r.imagesStayed; }
        }
      }
    }
    if (!mounted) return;
    await reload(); render();
    const pasted = n === 1 ? t('1 item pasted') : t('{n} items pasted', { n });
    announce(stayed
      ? `${pasted}. ${stayed === 1 ? t('1 image stayed with the original - images have one home; use Cut to move them') : t('{n} images stayed with the original - images have one home; use Cut to move them', { n: stayed })}`
      : pasted);
  }

  /** Copy a folder and its whole subtree under `dest`: fresh records, every session
   *  duplicated. Image references stay with the original (one home each) - the
   *  count comes back so the paste can say so. */
  async function deepCopyFolder(id: string, dest: string | null, made: Set<string>): Promise<{ imagesStayed: number } | null> {
    const src = folders.find(f => f.id === id);
    if (!src) return null;
    let imagesStayed = 0;
    const copy = async (f: Folder, parent: string | null, name: string): Promise<void> => {
      const created = await store.create(name, parent);
      if (f.color || f.emoji || f.tags) await store.setStyle(created.id, { color: f.color ?? null, emoji: f.emoji ?? null, tags: f.tags ?? null });
      for (const it of f.items) {
        if (it.type !== 'session') { imagesStayed++; continue; }
        const slot = await duplicateSessionCore(it.ref, made);
        if (slot) await store.moveItem(slot, created.id, 'session');
      }
      for (const child of childFolders(folders, f.id)) await copy(child, created.id, child.name);
    };
    await copy(src, dest, t('{name} copy', { name: src.name }));
    return { imagesStayed };
  }

  // ── Download originals (plans/133 WP-6) ─────────────────────────────────────
  // The stored files as they are, zipped: every single-tool session as a `.lolly`
  // (the same file Share builds - inputs, carried user assets, thumb), a batch
  // session as its stored JSON, every folder image as its bytes. Nothing is
  // rendered - that is what Render is for. Folders recurse into zip paths.
  // Leading dots are stripped too, so a folder named ".." can never mint a `../`
  // zip path (zip-slip) - it falls back to the 'folder' default like an empty name.
  const slug = (s: string): string => s.trim().replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '');
  async function downloadOriginals(label: string, sessionSlots: readonly string[], imageIds: readonly string[], folderIds: readonly string[]): Promise<void> {
    closeMenu();
    const items: Array<{ dir: string; kind: 'session' | 'image'; ref: string }> = [];
    const seen = new Set<string>();
    const add = (dir: string, kind: 'session' | 'image', ref: string): void => { if (!seen.has(ref)) { seen.add(ref); items.push({ dir, kind, ref }); } };
    const walk = (fid: string, dir: string): void => {
      const f = folders.find(x => x.id === fid);
      if (!f) return;
      const d = `${dir}${slug(f.name) || 'folder'}/`;
      for (const it of f.items) add(d, it.type, it.ref);
      for (const c of childFolders(folders, fid)) walk(c.id, d);
    };
    for (const s of sessionSlots) add('', 'session', s);
    for (const i of imageIds) add('', 'image', i);
    for (const fid of folderIds) walk(fid, '');
    if (!items.length) return;
    const zipName = `${slug(label) || 'lolly'}-originals.zip`;
    startRenderJob(tRaw('Packing {name}', { name: label }), async (job) => {
      const [{ zipAsync }, { buildLollyFile, creatorFromProfile }] = await Promise.all([import('../lib/zip.ts'), import('../lib/lolly-pack.ts')]);
      const h = host as ProjectsHost & { assets: { _exportUserAssets(): Promise<Parameters<typeof buildLollyFile>[0]['userAssets']>; _getBlob(id: string): Promise<Blob | null> } };
      const userAssets = await h.assets._exportUserAssets();
      const appVersion = `Lolly ${ENGINE_VERSION}`;
      const creator = creatorFromProfile(profile, { appVersion });
      const entries: Record<string, Uint8Array> = {};
      const taken = new Set<string>();
      // Two same-named members never collide: name-2.ext, name-3.ext…
      const unique = (p: string): string => {
        const dot = p.lastIndexOf('.');
        let q = p;
        for (let n = 2; taken.has(q.toLowerCase()); n++) q = dot > p.lastIndexOf('/') ? `${p.slice(0, dot)}-${n}${p.slice(dot)}` : `${p}-${n}`;
        taken.add(q.toLowerCase());
        return q;
      };
      let done = 0, skipped = 0;
      // The exporter's own design system rides in every .lolly of the batch (see tool.ts's
      // share path); read once, not per session.
      const designSystem = await import('../bridge/tokens.ts')
        .then(m => m.readUserDesignSystem(h as unknown as Parameters<typeof m.readUserDesignSystem>[0]))
        .catch(() => null);
      for (const it of items) {
        if (job.cancelled) return;
        try {
          if (it.kind === 'session') {
            const e = entryMap.get(it.ref);
            const data = await h.state.load(it.ref);
            if (!e || !data) { skipped++; continue; }
            const name = e.label || e.filename || toolName(e.toolId) || it.ref;
            if (isBatchSlot(it.ref)) {
              entries[unique(`${it.dir}${slug(name) || 'batch'}.json`)] = new TextEncoder().encode(JSON.stringify(data, null, 2));
            } else {
              const { blob } = await buildLollyFile({ session: data, toolId: e.toolId, name, thumb: e.thumb, userAssets, creator, appVersion, engineVersion: ENGINE_VERSION, ...(designSystem ? { designSystem } : {}) });
              entries[unique(`${it.dir}${slug(name) || 'session'}.lolly`)] = new Uint8Array(await blob.arrayBuffer());
            }
          } else {
            // A catalog ref may carry a ?theme= / ?treatment= modifier; the byte
            // store is keyed by the plain base id (folders.ts's catalogBaseId rule).
            const baseId = it.ref.startsWith('user/') ? it.ref : it.ref.split('?')[0]!.split('#')[0]!;
            const blob = await h.assets._getBlob(baseId);
            if (!blob) { skipped++; host.log?.('warn', 'projects: originals member has no bytes', { ref: it.ref }); continue; }
            const ref = imageRefs.get(it.ref);
            const base = String(ref?.meta?.name ?? it.ref.split('/').pop() ?? 'image');
            const file = /\.[a-z0-9]{1,5}$/i.test(base) || !ref?.format ? base : `${base}.${ref.format}`;
            entries[unique(`${it.dir}${slug(file) || 'image'}`)] = new Uint8Array(await blob.arrayBuffer());
          }
        } catch (err) { skipped++; host.log?.('warn', 'projects: originals member skipped', { ref: it.ref, error: String(err) }); }
        job.progress(++done, items.length);
      }
      if (!Object.keys(entries).length) throw new Error(t('Nothing could be packed.'));
      const bytes = await zipAsync(entries);
      await host.export.file(new Blob([bytes as BlobPart], { type: 'application/zip' }), { filename: zipName });
      if (skipped) announce(skipped === 1 ? t('1 file could not be packed and was left out') : t('{n} files could not be packed and were left out', { n: skipped }));
      return { zipName };
    });
  }

  // ── Project templates (plans/133 WP-11a) ────────────────────────────────────
  // "Save as project template" copies a folder's subtree + each member session's
  // record into the `__ptpl__:` namespace (the trash's split: records in the
  // profile, slots in state); "New from template" copies them back out under
  // fresh ids and slots, so one template seeds any number of projects.
  async function saveAsTemplate(id: string): Promise<void> {
    closeMenu();
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const name = await promptFolderName({ title: t('Save as project template'), placeholder: t('Template name'), ok: t('Save'), value: folder.name });
    if (!name || !mounted) return;
    const tree = await store.snapshotSubtree(id);
    if (!tree) return;
    const h = host as ProjectsHost;
    const token = (globalThis.crypto as { randomUUID?: () => string } | undefined)?.randomUUID?.() ?? Date.now().toString(36);
    let copied = 0;
    for (const f of tree) {
      const kept: FolderItem[] = [];
      for (const it of f.items) {
        if (it.type !== 'session') continue;   // image items are single-home references: a template carries sessions only
        const e = entryMap.get(it.ref);
        const data = await h.state.load(it.ref).catch(() => null);
        if (!e || !data) continue;
        const tslot = `${PTPL_SLOT_PREFIX}${token}:${it.ref}`;
        await h.state.save(tslot, data, e.thumb || '');
        kept.push({ type: 'session', ref: tslot });
        copied++;
      }
      f.items = kept;
    }
    await store.templateAdd({ name, tree });
    if (!mounted) return;
    await reload(); render();
    announce(copied === 1 ? tRaw('Saved "{name}" as a project template (1 session)', { name }) : tRaw('Saved "{name}" as a project template ({n} sessions)', { name, n: copied }));
  }

  /** Pick a template to instantiate here, or delete one. */
  async function openTemplateChooser(): Promise<void> {
    closeMenu();
    if (!templates.length) return;
    const fmtWhen = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const rows = templates.map((tp, i) => {
      const sessions = tp.tree.reduce((n, f) => n + f.items.length, 0);
      const sub = `${sessions === 1 ? t('1 session') : t('{n} sessions', { n: sessions })} · ${tp.tree.length === 1 ? t('1 folder') : t('{n} folders', { n: tp.tree.length })} · ${escape(fmtWhen(tp.createdAt))}`;
      return `<li class="trash-row">
        <span class="trash-row-icon" aria-hidden="true">${FOLDER_ICON}</span>
        <span class="trash-row-meta"><span class="trash-row-name">${escape(tp.name)}</span><span class="trash-row-sub">${sub}</span></span>
        <button type="button" class="btn btn--sm modal-primary" data-tpl-use="${i}">${t('Use')}</button>
        <button type="button" class="btn btn--sm cat-act-danger" data-tpl-drop="${i}" aria-label="${escape(tRaw('Delete template {name}', { name: tp.name }))}">${t('Delete')}</button>
      </li>`;
    }).join('');
    const where = currentFolderTarget() ? (folders.find(f => f.id === currentFolderTarget())?.name ?? t('this folder')) : t('Projects');
    const modal = mountModal<void>(`
      <div class="trash-dialog-body">
        <h2>${t('New from template')}</h2>
        <p class="trash-note">${t('A copy of the template lands in {where} with fresh sessions.', { where })}</p>
        <ul class="trash-list">${rows}</ul>
        <div class="trash-actions"><button type="button" class="btn" data-tpl-close>${t('Close')}</button></div>
      </div>`, { className: 'trash-dialog', ariaLabel: t('Project templates'), onClose: () => { if (overlayModal === modal) overlayModal = null; } });
    overlayModal = modal;
    modal.el.addEventListener('click', async (e) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-tpl-close]')) { modal.close(); return; }
      const use = el.closest<HTMLElement>('[data-tpl-use]');
      const drop = el.closest<HTMLElement>('[data-tpl-drop]');
      if (use) { const tp = templates[Number(use.dataset.tplUse)]; modal.close(); if (tp) await instantiateTemplate(tp, currentFolderTarget()); return; }
      if (drop) {
        const tp = templates[Number(drop.dataset.tplDrop)];
        modal.close();
        if (!tp) return;
        for (const f of tp.tree) for (const it of f.items) await host.state.delete(it.ref).catch(() => {});
        await store.templateDrop(tp.id);
        if (mounted) { await reload(); render(); }
        announce(tRaw('Deleted template "{name}"', { name: tp.name }));
      }
    });
  }

  async function instantiateTemplate(tp: ProjectTemplate, parent: string | null): Promise<void> {
    const h = host as ProjectsHost;
    const rows = await h.state.list().catch(() => [] as Entry[]);
    const thumbOf = new Map(rows.map(r => [r.slot, r.thumb]));
    const live = new Set(rows.map(r => r.slot));
    const slotMap = new Map<string, string>();
    let i = 0;
    for (const f of tp.tree) for (const it of f.items) {
      if (it.type !== 'session' || slotMap.has(it.ref)) continue;
      const data = await h.state.load(it.ref).catch(() => null);
      if (!data) continue;
      // The original slot sits after the template token: __ptpl__:<token>:<toolId:ts | __batch__:label>.
      const original = it.ref.slice(PTPL_SLOT_PREFIX.length).split(':').slice(1).join(':');
      let slot: string;
      if (isBatchSlot(original)) {
        const base = original.slice(BATCH_SLOT_PREFIX.length);
        slot = BATCH_SLOT_PREFIX + base;
        for (let n = 2; live.has(slot); n++) slot = `${BATCH_SLOT_PREFIX}${base} ${n}`;
      } else {
        const toolId = String((data as { __toolId?: unknown }).__toolId || original.split(':')[0] || 'session');
        slot = `${toolId}:${Date.now()}-${++i}`;
      }
      await h.state.save(slot, data, thumbOf.get(it.ref) ?? undefined);
      live.add(slot);
      slotMap.set(it.ref, slot);
    }
    const root = await store.instantiateSubtree(tp.tree, parent, slotMap);
    if (!mounted) return;
    await reload(); render();
    if (root) announce(tRaw('Created "{name}" from the template', { name: root.name }));
  }

  // ── boot ─────────────────────────────────────────────────────────────────
  // Arriving at Projects means we're not mid-"+ New tool" creation, so disarm any
  // stale file-into / return-to markers left by an abandoned flow.
  try { sessionStorage.removeItem(FILE_INTO_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
  // NB tileSelect.destroy() is not optional: its mousedown is bound to viewEl (#view), which
  // the router REUSES for every route - leave it bound and the next mount stacks another.
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => { mounted = false; flushUndoToasts(); cancelArrivalAah(); tileSelect.destroy(); tileMenu.destroy(); unwireEscape(); featuredHandle?.destroy(); featuredHandle = null; closeMenu(); closeConfirmDialogs(); overlayModal?.close(); releaseSearch?.(); };
  await reload();
  void sweepTrash();   // age out trash entries past the 30-day retention (silent)
  // A stale /p/<id> deep link to a deleted folder falls back to root.
  if (folderId && folderId !== UNCAT && !folders.some(f => f.id === folderId)) folderId = null;
  // Claim the shell search bar AFTER reload() - the scope-aware placeholder needs
  // `folders` (and the deleted-folder fallback above) resolved. NO onQuery (the M2
  // flip, plans/99 section 2a): Projects is an overlay-only view, so typing feeds the
  // spotlight and this grid never reshapes under the user's hands. The claim seeds
  // the bar with the ?q= handoff query, and onClear (the bar's ✕/Escape, with no
  // live tap claimed) exits results mode in place.
  releaseSearch = claimSearchBar({
    placeholder: searchPlaceholder(),
    value: query,
    // Live subtree filter (plans/133 WP-9, the catalog's dual pattern): typing
    // still feeds the spotlight overlay on top (ROUTE_DOMAIN projects is 'live'
    // now, same as catalog), and the grid behind live-filters through the SAME
    // scope-aware results renderer the ?q= handoff uses. Clearing restores the
    // browse grid - through exitSearch when a ?q= URL is standing (so the URL
    // and the view can't disagree), in place otherwise.
    onQuery: (raw) => {
      if (!mounted) return;
      const q = raw.trim();
      if (q === query) return;
      if (!q && window.location.hash.includes('q=')) { exitSearch(); return; }
      query = q;
      searchCache = null;
      render();
    },
    onClear: exitSearch,
  });
  render();
}
