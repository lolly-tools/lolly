// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — folder (group) browsing actions.
 *
 * Opens the shared folder overlay to organize saved sessions and to open a whole
 * folder into the grid — flattened, each row's "Save as" carrying its
 * group/subgroup path. Folder *creation* is disabled here (done in the gallery);
 * /pro only browses, loads, and flattens.
 *
 * The overlay itself is injected (index.ts is handed `openFolderOverlay` by the
 * shell) so /pro keeps its "imports only engine/host/siblings" isolation — this
 * module never imports ../folder-overlay.ts, only reconstructs the slice of its
 * contract that /pro actually uses.
 */
import { rowsForFolder, type Folder, type FolderHost, type ExportRow } from './folder-rows.ts';
import type { BatchSnapshot } from './sessions.ts';

/** A saved-session list entry as /pro reads it (from host.state.list()). */
export interface SessionEntry {
  slot: string;
  toolId: string;
}

/** The slice of the folder-overlay options /pro passes when browsing groups. */
export interface ProFolderOverlayOpts {
  context: 'pro';
  sessionEntries: readonly SessionEntry[];
  sessionSizes: Record<string, number>;
  nameById: Map<string, string>;
  showCreateFolder: boolean;
  allowBatchExport: boolean;
  onResume(entry: SessionEntry): Promise<void>;
  onOpenGroup(folder: Folder): Promise<void>;
}

/** The injected overlay opener (real implementation lives in ../folder-overlay).
 *  The shell binds the host in when it injects this — the overlay needs a wider
 *  host slice than /pro models, and keeping the host out of /pro's contract both
 *  preserves /pro's isolation and sidesteps the host-slice variance mismatch. */
export type OpenFolderOverlay = (opts: ProFolderOverlayOpts) => void;

/** The slice of the host this module needs: loading sessions + listing/sizing them. */
export interface FolderActionsHost extends FolderHost {
  state: FolderHost['state'] & {
    list(): Promise<readonly SessionEntry[]>;
    sizes(): Promise<Record<string, number>>;
  };
}

/** What index.ts hands the folder seam. */
export interface FolderActionsContext {
  host: FolderActionsHost;
  /** Injected overlay opener; absent when the shell didn't provide one. */
  openFolderOverlay?: OpenFolderOverlay;
  /** Load a saved batch snapshot (null unless the slot is a batch slot). */
  loadSession(slot: string): Promise<BatchSnapshot | null>;
  /** Replace the grid with a snapshot or a flattened folder's rows. */
  applySnapshot(data: BatchSnapshot | { rows: ExportRow[]; zipName: string }): Promise<void>;
  showProgress(html: string): void;
  closeSessions(): void;
}

/** Folder-browsing operations bound to one mounted /pro view. */
export interface FolderActions {
  /** True when the shell injected an overlay opener (drives the Folders… button). */
  readonly enabled: boolean;
  openFoldersOverlay(): Promise<void>;
}

export function createFolderActions(ctx: FolderActionsContext): FolderActions {
  const { host, openFolderOverlay } = ctx;

  async function openFoldersOverlay(): Promise<void> {
    if (!openFolderOverlay) return;
    ctx.closeSessions();
    const [entries, sizes] = await Promise.all([
      host.state.list(),
      host.state.sizes().catch(() => ({})),
    ]);
    const w: Window & { __toolIndex?: { tools?: { id: string; name: string }[] } } = window;
    const nameById = new Map((w.__toolIndex?.tools ?? []).map(t => [t.id, t.name]));
    openFolderOverlay({
      context: 'pro',
      sessionEntries: entries,
      sessionSizes: sizes,
      nameById,
      showCreateFolder: false,        // groups are created in the gallery
      allowBatchExport: false,        // exporting from inside the grid is redundant
      onResume: async (entry) => {
        const data = await ctx.loadSession(entry.slot);   // null unless a batch slot
        if (data) await ctx.applySnapshot(data);
        else window.location.hash = `#/tool/${entry.toolId}?slot=${encodeURIComponent(entry.slot)}`;
      },
      onOpenGroup: async (folder) => {
        // Flatten every subgroup's rows into the grid; each row's filename already
        // carries its "group/subgroup/stem" path (set by rowsForFolder).
        const rows = await rowsForFolder(host, folder);
        if (!rows.length) { ctx.showProgress(`<p class="pro-progress-msg">That folder has no renderable rows.</p>`); return; }
        await ctx.applySnapshot({ rows, zipName: folder.name });
        ctx.showProgress(`<p class="pro-progress-msg">Opened folder “${escapeHtml(folder.name)}” — ${rows.length} row${rows.length === 1 ? '' : 's'} flattened into the grid.</p>`);
      },
    });
  }

  return { enabled: !!openFolderOverlay, openFoldersOverlay };
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}
