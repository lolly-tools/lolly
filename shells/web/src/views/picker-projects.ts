// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's Projects tab (lolly plan 299 X8): the person's own folders and,
 * when a workspace is connected, the shared projects in their own list.
 *
 * A local folder offers its saved creations and images, as before. A shared project
 * offers its sessions, placed as a render, and its files, copied into the person's
 * uploads first: a shared file id says nothing of its project, so placing the id directly would
 * break in another project or on another device. A shortcut among the local folders
 * opens the shared project it points at. Search at the top level reaches every shared
 * project the person can open, not only the ones in their list.
 *
 * The picker lends the pane, its lists and the two place actions, so this module
 * knows nothing about the slot's tool or the collect mode.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { announce } from '../a11y.ts';
import { childFolders, folderPath, type Folder, type FolderItem } from '../folders.ts';
import { t, tRaw } from '../i18n.ts';
import { fmtBytes } from '../lib/format.ts';
import { escapeHtml } from '../lib/html.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { getInstanceBase } from '../lib/instance.ts';
import {
  getSessionSource, readSourceProjects, readSourceSessions,
  type TeamFileRef, type TeamFolderRef, type TeamProjectRef, type TeamSessionRef,
} from '../lib/session-source.ts';
import { isOwnProject } from '../lib/team-project-listing.ts';
import { sessionCard, type PickerSession } from './picker-cards.ts';
import { relTime } from './picker-formats.ts';

type Load = () => Promise<Record<string, unknown> | null>;

/** What the picker lends the tab. */
export interface ProjectsTabDeps {
  pane: HTMLElement;
  initialFolder: string | null;
  /** The person's folders, or null until they have loaded. */
  folders(): readonly Folder[] | null;
  sessions(): readonly PickerSession[] | null;
  userAssets(): readonly AssetRef[];
  imageCard(ref: AssetRef): string;
  matches(query: string, ...fields: Array<string | null | undefined>): boolean;
  /** A session tool's name and icon when this pick can place it, else null. */
  tool(toolId: string): { name: string; icon: string | null } | null;
  /** Whether a file of this asset type can fill the slot; null when the slot takes no files. */
  accepts: ((type: string) => boolean) | null;
  /** Place a shared session from its local data (loaded by `load`). */
  placeSession(load: Load, toolId: string, name: string, card: HTMLElement): Promise<void>;
  /** Place a shared file, already copied into the person's uploads under `assetId`. */
  placeFile(assetId: string, card: HTMLElement): Promise<void>;
  query(): string;
  /** True while the Projects pane is the one on screen. */
  visible(): boolean;
  /** After each paint: hydrate audio, text and motion thumbnails. */
  painted(): void;
  /** After moving into a folder: focus its first card. */
  navigated(): void;
  log(level: 'warn', message: string, data: Record<string, unknown>): void;
}

export interface ProjectsTab {
  render(query: string): void;
  /** Matches for the tab's search badge. */
  count(query: string): number;
  /** True when the click was this tab's own (a folder, a crumb, a shared item). */
  handle(target: HTMLElement): boolean;
  destroy(): void;
}

interface SharedProject {
  state: 'loading' | 'ready' | 'error';
  sessions: TeamSessionRef[];
  folders: TeamFolderRef[];
  files: TeamFileRef[];
}

/** The project and folder a local shortcut stands for, on this workspace only. Pure. */
export function shortcutTarget(folder: Folder, instance: string): { projectId: string; folderId: string | null } | null {
  return folder.link && folder.link.instance === instance ? { projectId: folder.link.projectId, folderId: folder.link.folderId ?? null } : null;
}

/**
 * The shared items one level of a shared project holds. Inside a folder: its items.
 * At the top: everything no folder holds, so nothing is listed twice. Pure.
 */
export function sharedLevel<T extends { id: string }>(items: readonly T[], kind: 'session' | 'file', folders: readonly TeamFolderRef[], folderId: string | null): T[] {
  if (folderId) {
    const here = folders.find(f => f.id === folderId)?.items ?? [];
    return items.filter(item => here.some(i => i.kind === kind && i.ref === item.id));
  }
  const filed = new Set(folders.flatMap(f => f.items.filter(i => i.kind === kind).map(i => i.ref)));
  return items.filter(item => !filed.has(item.id));
}

const FILE_GLYPH: Record<string, IconName> = { raster: 'image', svg: 'image', audio: 'music', video: 'filmStrip', font: 'font' };

const thumbImg = (url: string): string => `<img class="asset-picker-thumb" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async">`;
const stub = (glyph: string): string => `<span class="asset-picker-thumb asset-picker-thumb-stub asset-picker-thumb-icon" aria-hidden="true">${glyph}</span>`;
const crumbSep = '<span class="asset-picker-crumb-sep" aria-hidden="true">›</span>';

export function createProjectsTab(deps: ProjectsTabDeps): ProjectsTab {
  const { pane } = deps;
  let folder: string | null = deps.initialFolder;
  let at: { projectId: string; folderId: string | null } | null = null;
  let projects: TeamProjectRef[] | null = null;
  let projectsState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  const shared = new Map<string, SharedProject>();
  // A preview url by card key (`s:<session>` or `f:<file>`); '' when none could be made.
  const previews = new Map<string, string>();
  let stopPreviews: (() => void) | null = null;
  let busy = false;
  const here = (): string => getInstanceBase() || location.origin;
  const repaint = (): void => { if (deps.visible()) render(deps.query()); };

  function loadProjects(): void {
    const source = getSessionSource();
    if (!source || projectsState !== 'idle') return;
    projectsState = 'loading';
    void readSourceProjects(source).then(got => {
      projects = got.ok ? got.items : [];
      projectsState = got.ok ? 'ready' : 'error';
      repaint();
    });
  }

  function project(projectId: string): SharedProject {
    const known = shared.get(projectId);
    if (known) return known;
    const entry: SharedProject = { state: 'loading', sessions: [], folders: [], files: [] };
    shared.set(projectId, entry);
    const source = getSessionSource();
    const files = source?.files;
    // Folders and files are optional on a workspace: without them the project is one
    // flat list of sessions. The sessions are what make it readable at all.
    void Promise.all([
      source ? readSourceSessions(source, projectId) : Promise.resolve({ ok: false as const, status: 0 }),
      files ? files.listFolders(projectId).catch(() => []) : [],
      files && deps.accepts ? files.listFiles(projectId).catch(() => []) : [],
    ]).then(([sessions, folders, list]) => {
      entry.state = sessions.ok ? 'ready' : 'error';
      entry.sessions = sessions.ok ? sessions.items : [];
      entry.folders = folders;
      entry.files = list;
      repaint();
    });
    return entry;
  }

  /** Projects for the top level: the person's own, or every one when searching. */
  function listedProjects(query: string): TeamProjectRef[] {
    const drawn = new Set((deps.folders() ?? []).filter(f => !f.parentId).map(f => shortcutTarget(f, here())?.projectId).filter(Boolean));
    return (projects ?? []).filter(p => !drawn.has(p.id) && (query ? deps.matches(query, p.name) : isOwnProject(p)));
  }

  function projectCard(p: Pick<TeamProjectRef, 'id' | 'name' | 'sessionCount'>, folderId: string | null = null, name = p.name): string {
    const n = p.sessionCount ?? 0;
    const bits = n ? (n === 1 ? t('1 item') : t('{n} items', { n })) : t('Shared project');
    return `
      <button type="button" class="asset-picker-card asset-picker-folderitem" data-shared-open="${escapeHtml(p.id)}"${folderId ? ` data-shared-folder="${escapeHtml(folderId)}"` : ''} title="${escapeHtml(name)}">
        <span class="asset-picker-thumb asset-picker-folder-thumb" aria-hidden="true">${icon('folderUsers')}</span>
        <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <span class="asset-picker-sessitem-when">${escapeHtml(bits)}</span>
      </button>`;
  }

  // ── The person's own folders ─────────────────────────────────────────────────
  // The items a folder holds that this picker can place: saved creations whose tool
  // still renders here, and loaded images. Anything else is skipped.
  function pickable(f: Folder): FolderItem[] {
    return f.items.filter(it => it.type === 'session'
      ? (deps.sessions() ?? []).some(s => s.slot === it.ref)
      : deps.userAssets().some(a => a.id === it.ref));
  }

  function folderCard(f: Folder, folders: readonly Folder[]): string {
    const target = shortcutTarget(f, here());
    if (target) {
      const p = projects?.find(x => x.id === target.projectId);
      return getSessionSource() ? projectCard({ id: target.projectId, name: f.name, sessionCount: p?.sessionCount }, target.folderId, f.name) : '';
    }
    const subs = childFolders(folders, f.id).length;
    const items = pickable(f).length;
    const bits: string[] = [];
    if (subs) bits.push(subs === 1 ? t('1 folder') : t('{n} folders', { n: subs }));
    if (items) bits.push(items === 1 ? t('1 item') : t('{n} items', { n: items }));
    return `
      <button type="button" class="asset-picker-card asset-picker-folderitem" data-folder-open="${escapeHtml(f.id)}" title="${escapeHtml(f.name)}">
        <span class="asset-picker-thumb asset-picker-folder-thumb" aria-hidden="true">${icon('folder')}</span>
        <span class="asset-picker-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="asset-picker-sessitem-when">${escapeHtml(bits.join(' · ') || t('Empty'))}</span>
      </button>`;
  }

  function localHtml(query: string): string {
    const folders = deps.folders();
    if (!folders) return `<div class="asset-picker-loading">${t('Loading…')}</div>`;
    // A folder that vanished (deleted elsewhere, synced away) drops back to the top.
    if (folder && !folders.some(f => f.id === folder)) folder = null;
    const path = folder ? folderPath(folders, folder) : [];
    const crumbs = `<nav class="asset-picker-crumbs" aria-label="${escapeHtml(t('Folder path'))}">`
      + `<button type="button" class="asset-picker-crumb" data-folder-open="">${t('Projects')}</button>`
      + path.map((f, i) => crumbSep + (i === path.length - 1
          ? `<span class="asset-picker-crumb is-current" aria-current="true">${escapeHtml(f.name)}</span>`
          : `<button type="button" class="asset-picker-crumb" data-folder-open="${escapeHtml(f.id)}">${escapeHtml(f.name)}</button>`)).join('')
      + `</nav>`;
    const kids = childFolders(folders, folder).filter(f => deps.matches(query, f.name)).map(f => folderCard(f, folders)).filter(Boolean);
    const cur = folder ? folders.find(f => f.id === folder) ?? null : null;
    const itemCards: string[] = [];
    for (const it of cur ? pickable(cur) : []) {
      if (it.type === 'session') {
        const s = (deps.sessions() ?? []).find(x => x.slot === it.ref)!;
        if (deps.matches(query, s.toolName, s.label)) itemCards.push(sessionCard(s));
      } else {
        const a = deps.userAssets().find(x => x.id === it.ref)!;
        if (deps.matches(query, String(a.meta?.name ?? ''))) itemCards.push(deps.imageCard(a));
      }
    }
    const parts: string[] = [];
    if (kids.length) parts.push(`<div class="asset-picker-grid asset-picker-foldergrid">${kids.join('')}</div>`);
    if (itemCards.length) parts.push(`<div class="asset-picker-grid">${itemCards.join('')}</div>`);
    const source = cur ? undefined : getSessionSource();
    if (source) {
      const list = listedProjects(query);
      if (projectsState === 'error') parts.push(`<p class="asset-picker-empty" role="status">${t('Shared projects could not be loaded.')}</p>`);
      else if (projectsState !== 'ready') parts.push(`<div class="asset-picker-loading">${t('Loading…')}</div>`);
      else if (list.length) {
        parts.push(`<div class="asset-picker-section-head">${escapeHtml(source.label)} <span class="asset-picker-count">${list.length}</span></div>`
          + `<div class="asset-picker-grid asset-picker-foldergrid">${list.map(p => projectCard(p)).join('')}</div>`);
      }
    }
    if (parts.length) return crumbs + parts.join('');
    if (!folders.length && !source) return crumbs + `<p class="asset-picker-empty">${t('No projects yet - group your saved creations and images into folders to browse them here.')}</p>`;
    return crumbs + `<p class="asset-picker-empty">${query ? t('Nothing here matches.') : (cur ? t('This folder is empty.') : t('No folders yet.'))}</p>`;
  }

  // ── A shared project ─────────────────────────────────────────────────────────
  function sharedHtml(query: string, projectId: string, folderId: string | null): string {
    const entry = project(projectId);
    const name = projects?.find(p => p.id === projectId)?.name
      ?? (deps.folders() ?? []).find(f => shortcutTarget(f, here())?.projectId === projectId)?.name ?? t('Shared project');
    const path: TeamFolderRef[] = [];
    for (let id = folderId, guard = 0; id && guard < 32; guard++) {
      const f = entry.folders.find(x => x.id === id);
      if (!f) break;
      path.unshift(f);
      id = f.parentId;
    }
    const crumb = (label: string, folderAttr: string | null, last: boolean): string => last
      ? `<span class="asset-picker-crumb is-current" aria-current="true">${escapeHtml(label)}</span>`
      : `<button type="button" class="asset-picker-crumb" data-shared-open="${escapeHtml(projectId)}" data-shared-folder="${escapeHtml(folderAttr ?? '')}">${escapeHtml(label)}</button>`;
    const crumbs = `<nav class="asset-picker-crumbs" aria-label="${escapeHtml(t('Folder path'))}">`
      + `<button type="button" class="asset-picker-crumb" data-folder-open="">${t('Projects')}</button>`
      + crumbSep + crumb(name, null, !path.length)
      + path.map((f, i) => crumbSep + crumb(f.name, f.id, i === path.length - 1)).join('')
      + `</nav>`;
    if (entry.state === 'loading') return crumbs + `<div class="asset-picker-loading">${t('Loading…')}</div>`;
    if (entry.state === 'error') return crumbs + `<p class="asset-picker-empty" role="status">${t('This shared project could not be opened.')}</p>`;
    const subs = entry.folders.filter(f => (f.parentId ?? null) === folderId && deps.matches(query, f.name));
    const sessions = sharedLevel(entry.sessions, 'session', entry.folders, folderId).flatMap(s => {
      const tool = deps.tool(s.toolId);
      return tool && deps.matches(query, s.label, tool.name) ? [sessionCardHtml(s, tool)] : [];
    });
    const files = deps.accepts
      ? sharedLevel(entry.files, 'file', entry.folders, folderId).filter(f => deps.accepts!(f.type) && deps.matches(query, f.name)).map(fileCardHtml)
      : [];
    const parts: string[] = [];
    if (subs.length) {
      parts.push(`<div class="asset-picker-grid asset-picker-foldergrid">${subs.map(f => `
        <button type="button" class="asset-picker-card asset-picker-folderitem" data-shared-open="${escapeHtml(projectId)}" data-shared-folder="${escapeHtml(f.id)}" title="${escapeHtml(f.name)}">
          <span class="asset-picker-thumb asset-picker-folder-thumb" aria-hidden="true">${icon('folder')}</span>
          <span class="asset-picker-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <span class="asset-picker-sessitem-when">${escapeHtml(f.items.length === 1 ? t('1 item') : t('{n} items', { n: f.items.length }))}</span>
        </button>`).join('')}</div>`);
    }
    if (sessions.length || files.length) parts.push(`<div class="asset-picker-grid">${sessions.join('')}${files.join('')}</div>`);
    return crumbs + (parts.length ? parts.join('')
      : `<p class="asset-picker-empty">${query ? t('Nothing here matches.') : t('Nothing here can go in this slot.')}</p>`);
  }

  function sessionCardHtml(s: TeamSessionRef, tool: { name: string; icon: string | null }): string {
    const name = s.label || tool.name;
    const key = `s:${s.id}`;
    const when = s.updatedAt ? relTime(s.updatedAt, Date.now(), t) : '';
    return `
      <button type="button" class="asset-picker-card asset-picker-sessitem" data-shared-session="${escapeHtml(s.id)}" data-shared-preview="${escapeHtml(key)}" title="${escapeHtml(name)}">
        ${previews.get(key) ? thumbImg(previews.get(key)!) : stub(tool.icon ?? '')}
        <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <span class="asset-picker-sessitem-when">${escapeHtml(s.updatedByName ? tRaw('{when} by {name}', { when, name: s.updatedByName }) : when)}</span>
      </button>`;
  }

  function fileCardHtml(f: TeamFileRef): string {
    const key = `f:${f.id}`;
    return `
      <button type="button" class="asset-picker-card asset-picker-sessitem" data-shared-file="${escapeHtml(f.id)}" data-shared-preview="${escapeHtml(key)}" title="${escapeHtml(f.name)}">
        ${previews.get(key) ? thumbImg(previews.get(key)!) : stub(icon(FILE_GLYPH[f.type] ?? 'document'))}
        <span class="asset-picker-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="asset-picker-sessitem-when">${escapeHtml(fmtBytes(f.size))}</span>
      </button>`;
  }

  // Pictures for the cards on screen, two at a time; a picture made once is kept for
  // the next paint, and one that could not be made is not tried again.
  function hydratePreviews(projectId: string): void {
    const files = getSessionSource()?.files;
    if (!files) return;
    let stopped = false, active = 0;
    const queue: HTMLElement[] = [];
    const paint = async (card: HTMLElement): Promise<void> => {
      const key = card.dataset.sharedPreview!;
      const id = key.slice(2);
      const url = (key.startsWith('s:') ? await files.sessionPreview?.(id) : await files.filePreview?.(projectId, id)) ?? '';
      previews.set(key, url);
      if (!url || stopped || !card.isConnected) return;
      const img = document.createElement('img');
      img.className = 'asset-picker-thumb';
      img.alt = '';
      img.decoding = 'async';
      img.src = url;
      card.querySelector('.asset-picker-thumb')?.replaceWith(img);
    };
    const next = (): void => {
      while (!stopped && active < 2 && queue.length) {
        const card = queue.shift()!;
        active++;
        void paint(card).catch(() => { previews.set(card.dataset.sharedPreview!, ''); }).finally(() => { active--; next(); });
      }
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { observer?.unobserve(entry.target); queue.push(entry.target as HTMLElement); }
      next();
    }, { rootMargin: '160px' });
    for (const card of pane.querySelectorAll<HTMLElement>('[data-shared-preview]')) {
      if (previews.has(card.dataset.sharedPreview!)) continue;
      if (observer) observer.observe(card); else queue.push(card);
    }
    next();
    stopPreviews = () => { stopped = true; queue.length = 0; observer?.disconnect(); };
  }

  function render(query: string): void {
    stopPreviews?.();
    stopPreviews = null;
    if (getSessionSource()) loadProjects();
    if (at && !getSessionSource()) at = null;
    pane.innerHTML = at ? sharedHtml(query, at.projectId, at.folderId) : localHtml(query);
    if (at) hydratePreviews(at.projectId);
    deps.painted();
  }

  async function pick(card: HTMLElement, work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    card.setAttribute('aria-busy', 'true');
    try { await work(); }
    catch (error) {
      deps.log('warn', 'Shared project pick failed', { error: String(error) });
      announce(t('This shared item could not be placed. Try again.'), { assertive: true });
    } finally {
      busy = false;
      card.removeAttribute('aria-busy');
    }
  }

  function handle(target: HTMLElement): boolean {
    const local = target.closest<HTMLElement>('[data-folder-open]');
    if (local) {
      folder = local.dataset.folderOpen || null;
      at = null;
      render(deps.query());
      deps.navigated();
      return true;
    }
    const open = target.closest<HTMLElement>('[data-shared-open]');
    if (open) {
      at = { projectId: open.dataset.sharedOpen!, folderId: open.dataset.sharedFolder || null };
      render(deps.query());
      deps.navigated();
      return true;
    }
    const files = getSessionSource()?.files;
    const sessionCardEl = target.closest<HTMLElement>('[data-shared-session]');
    if (sessionCardEl && at) {
      const s = shared.get(at.projectId)?.sessions.find(x => x.id === sessionCardEl.dataset.sharedSession);
      const tool = s && deps.tool(s.toolId);
      if (s && tool && files) {
        void pick(sessionCardEl, () => deps.placeSession(() => files.localSession(s.id), s.toolId, s.label || tool.name, sessionCardEl));
      }
      return true;
    }
    const fileCard = target.closest<HTMLElement>('[data-shared-file]');
    if (fileCard && at) {
      const projectId = at.projectId;
      const fileId = fileCard.dataset.sharedFile!;
      const name = shared.get(projectId)?.files.find(f => f.id === fileId)?.name ?? '';
      if (files) {
        void pick(fileCard, async () => {
          announce(tRaw('Copying {name} to your files…', { name }));
          await deps.placeFile(await files.copyFile(projectId, fileId), fileCard);
        });
      }
      return true;
    }
    return false;
  }

  return {
    render,
    handle,
    count(query) {
      const folders = deps.folders();
      return (folders ? folders.filter(f => deps.matches(query, f.name)).length : 0) + (projectsState === 'ready' ? listedProjects(query).length : 0);
    },
    destroy() { stopPreviews?.(); stopPreviews = null; },
  };
}
