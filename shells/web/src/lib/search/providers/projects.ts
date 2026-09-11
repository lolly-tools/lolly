// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects spotlight provider (plans/99 section 2b) - the user's OWN items:
 * folders (by name) and saved sessions (label/filename/tool name/tool id, plus
 * the literal 'batch' keyword), matched through the SAME shared source the
 * projects view uses (lib/search/projects-source.ts), so the overlay and the
 * view's ?q= results mode can never disagree about what a query finds.
 *
 * Data loads per search call through a short-lived cache: the in-flight
 * promise is shared and kept for 5s after it resolves, so a burst of
 * keystrokes costs one state.list() + folder read, while a session saved
 * elsewhere still shows up moments later. A failed load drops the cache (next
 * keystroke retries) and the provider returns [] rather than throwing
 * (registry contract).
 *
 * Session hits open exactly as a projects tile does (sessionOpenHref): batch →
 * its /pro grid, single-tool → the tool with the saved slot. Hits navigate by
 * href only, so the tile's one-shot Save-return marker (armSessionReturn) is
 * NOT armed here - Save falls back to its default return, which is right for
 * an open that didn't start on the projects page.
 */

import { t } from '../../../i18n.ts';
import { isHiddenSlot } from '../../batch-slots.ts';
import { icon } from '../../icons.ts';
import { createFolderStore, folderPath } from '../../../folders.ts';
import type { Folder, FolderHost } from '../../../folders.ts';
import { isBatchSlot } from '../../batch-slots.ts';
import {
  buildFolderHaystack, buildSessionHaystack, matchesHaystack, sessionOpenHref,
} from '../projects-source.ts';
import type { SearchHit, SearchProvider } from '../registry.ts';

/** A host.state.list() row as this provider reads it (the WebStateAPI shape,
 *  reduced to what the haystack + hit need). */
export interface ProjectsSearchSession {
  slot: string;
  toolId: string;
  label?: string | null;
  filename?: string | null;
}

/**
 * Minimal structural host slice (repo convention - see SyncHost): what
 * createFolderStore needs (profile get/set, state.list, _listUserAssets) with
 * state.list() narrowed to the richer web rows. The concrete WebHost satisfies
 * it; never the full HostV1.
 */
export interface ProjectsSearchHost {
  profile: FolderHost['profile'];
  assets: FolderHost['assets'];
  state: { list(): Promise<ReadonlyArray<ProjectsSearchSession>> };
}

const CACHE_TTL_MS = 5000;

interface Snapshot {
  folders: Folder[];
  folderRows: Array<{ folder: Folder; haystack: string }>;
  sessions: Array<{ entry: ProjectsSearchSession; batch: boolean; haystack: string }>;
  /** item ref → owning folder (for the subtitle's folder path). */
  ownerByRef: Map<string, Folder>;
  nameOf: (toolId: string) => string;
}

/** Tool display names off the synced index (catalog/sync.ts owns the global). */
function toolNames(): Map<string, string> {
  const tools = (globalThis as { window?: { __toolIndex?: { tools?: Array<{ id: string; name?: unknown }> } } })
    .window?.__toolIndex?.tools ?? [];
  const out = new Map<string, string>();
  for (const tool of tools) {
    if (typeof tool?.id === 'string' && typeof tool.name === 'string' && tool.name) out.set(tool.id, tool.name);
  }
  return out;
}

export function createProjectsProvider(host: ProjectsSearchHost): SearchProvider {
  const store = createFolderStore(host);
  let cache: { promise: Promise<Snapshot>; expires: number } | null = null;

  function load(): Promise<Snapshot> {
    if (cache && Date.now() < cache.expires) return cache.promise;
    const promise = Promise.all([
      store.list().catch(() => [] as Folder[]),
      host.state.list().then((rows) => rows.filter(r => !isHiddenSlot(r.slot))).catch(() => [] as ProjectsSearchSession[]),
    ]).then(([folders, entries]): Snapshot => {
      const names = toolNames();
      const nameOf = (id: string): string => names.get(id) || id || t('Saved session');
      const ownerByRef = new Map<string, Folder>();
      for (const f of folders) for (const it of f.items) ownerByRef.set(it.ref, f);
      return {
        folders,
        folderRows: folders.map((folder) => ({ folder, haystack: buildFolderHaystack(folder.name, (folder as { tags?: string[] }).tags) })),
        sessions: entries.map((entry) => {
          const batch = isBatchSlot(entry.slot);
          return { entry, batch, haystack: buildSessionHaystack(entry, nameOf, batch) };
        }),
        ownerByRef,
        nameOf,
      };
    });
    const slot = { promise, expires: Number.POSITIVE_INFINITY }; // in-flight: everyone shares it
    cache = slot;
    promise.then(
      () => { if (cache === slot) slot.expires = Date.now() + CACHE_TTL_MS; },
      () => { if (cache === slot) cache = null; }, // failed → next call retries
    );
    return promise;
  }

  const folderGlyph = icon('folder');
  const sessionGlyph = icon('history'); // the app-wide saved-sessions glyph

  return {
    id: 'projects',
    async search(tokens, limit): Promise<SearchHit[]> {
      const snap = await load();
      // Score everything, sort, THEN build only the sliced hits (the subtitle's
      // folderPath walk is per-hit work that shouldn't run for losers).
      const scored: Array<{ score: number; hit: () => SearchHit }> = [];
      for (const { folder, haystack } of snap.folderRows) {
        const score = matchesHaystack(haystack, tokens);
        if (score > 0) {
          scored.push({
            score,
            hit: () => ({
              icon: folderGlyph,
              title: folder.name,
              subtitle: t('Project'),
              href: `#/p/${encodeURIComponent(folder.id)}`,
              score,
            }),
          });
        }
      }
      for (const { entry, batch, haystack } of snap.sessions) {
        const score = matchesHaystack(haystack, tokens);
        if (score > 0) {
          scored.push({
            score,
            hit: () => {
              const toolName = snap.nameOf(entry.toolId);
              const owner = snap.ownerByRef.get(entry.slot);
              const path = owner ? folderPath(snap.folders, owner.id).map((f) => f.name).join(' / ') : '';
              return {
                icon: sessionGlyph,
                title: entry.label || entry.filename || toolName,
                subtitle: path ? `${toolName} · ${path}` : toolName,
                href: sessionOpenHref(entry, batch),
                score,
              };
            },
          });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.max(0, limit)).map((x) => x.hit());
    },
  };
}
