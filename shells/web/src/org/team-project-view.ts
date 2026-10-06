// SPDX-License-Identifier: MPL-2.0
/** Shared projects are folder screens inside Projects, with ordinary cards and routes. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getSessionSource, readSourceProjects, readSourceSessions } from '../lib/session-source.ts';
import { folderTile, sessionTile } from '../folder-tiles.ts';
import { createTeamFolder, listTeamFolders, moveTeamFolderItem, teamFolderHref } from './team-folders.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { applyCardSize, readCardSize } from '../components/view-options.ts';
import { confirmDialog, promptDialog } from '../components/confirm-dialog.ts';
import { duplicateProjectItem } from './team-project-duplicate.ts';
import { mountTeamProjectActions } from './team-project-actions.ts';
import { orgConfig } from './index.ts';
import { activityLabel, canWriteProject, invitePolicy, isManagerPlus, peopleAccess, roleLabel } from './team-access.ts';
import { buildNewProjectForm } from './team-project-form.ts';
import { buildPeoplePanel, copyText } from './team-people.ts';
import { deleteTeamSession, renameTeamProject, renameTeamSession, teamProjectLinkUrl } from './project-members.ts';
import { fetchTeamSession } from './session-source.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { openTeamSession, teamOpenMessage } from './team-open.ts';
import { noteProjectOpened } from './opened-projects.ts';
import { buildTeamFilesPanel } from './team-files-panel.ts';
import { listTeamFiles, teamFileMessage, type TeamFile } from './team-files.ts';
import type { ProjectAssetPageOptions } from '../components/project-asset-page.ts';
import { buildProjectAsset, teamAssetTiles } from './team-project-assets.ts';
import { hydrateSharedPreviews } from './team-previews.ts';
import { tokenize } from '../lib/search/match.ts';
import { buildFolderHaystack, matchesHaystack } from '../lib/search/projects-source.ts';
import { mountInviteLinkControl } from '../components/invite-link-control.ts';
import { projectInviteLinks } from './project-invite-links.ts';
import { showProjectInviteLink } from './project-sharing.ts';
import type { BodyPopoverHandle } from '../components/body-popover.ts';
import { mountProjectAgentsPanel } from './project-agents-panel.ts';

interface ProjectViewOptions {
  host: HostV1;
  projectId: string;
  create: boolean;
  tab: string;
  toolName: (id: string) => string;
  tools?: Array<{ id: string; name: string }>;
  beforeNavigate: () => void;
  isMounted: () => boolean;
  query?: string;
  list?: boolean;
  sort?: string;
  reversed?: boolean;
  assetId?: string;
  assetPreview?(projectId: string, file: TeamFile): ProjectAssetPageOptions['preview'];
  folderId?: string;
}

export function mountTeamProjectView(container: HTMLElement, opts: ProjectViewOptions): () => void {
  const source = getSessionSource(), abort = new AbortController();
  let disposed = false, ticket = 0, opening = false;
  let clearPreviews: (() => void) | undefined;
  let clearAssetPreview: (() => void) | undefined;
  let clearActions: (() => void) | undefined;
  let clearAgents: (() => void) | undefined;
  let clearInvite: (() => void) | undefined, invitation: BodyPopoverHandle | undefined;
  let createFolderAction: (() => void) | undefined;
  container.addEventListener('lolly:team-folder-create', () => createFolderAction?.(), { signal: abort.signal });
  const current = () => !disposed && container.isConnected && opts.isMounted() && source === getSessionSource();
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el;
  };
  const button = (label: string, action: () => void, primary = false) => {
    const el = node('button', label, `btn${primary ? ' btn--primary' : ''}`); el.type = 'button'; el.addEventListener('click', action, { signal: abort.signal }); return el;
  };
  const breadcrumbs = node('nav', undefined, 'projects-crumbs'); breadcrumbs.setAttribute('aria-label', tRaw('Folder path'));
  const root = node('a', tRaw('Projects')); root.href = '#/p'; breadcrumbs.append(root);
  container.append(breadcrumbs);
  const body = node('div', undefined, 'team-project-content'); container.append(body);
  const failure = (status: number, retry: () => void) => {
    body.replaceChildren(node('p', teamOpenMessage(status), 'team-project-notice'), button(tRaw('Try again'), retry));
  };
  if (!source) { body.append(node('p', tRaw('Sign in to your workspace to open shared projects.'), 'team-project-notice')); return () => { disposed = true; abort.abort(); }; }
  if (opts.create) {
    const writer = source.write;
    body.append(node('h2', tRaw('New team project')), node('p', tRaw('Create a shared folder for your team’s sessions. Choose people after creating the project.'), 'team-project-notice'));
    if (!writer?.projectOptions().canCreate) body.append(node('p', tRaw('This instance does not let you create projects.'), 'team-project-notice'));
    else body.append(buildNewProjectForm(writer, { onCreated: project => {
      if (current()) window.location.hash = `#/p?team=${encodeURIComponent(project.id)}&tab=people`;
    }, onCancel: () => { window.location.hash = '#/p'; } }));
  } else void load();

  const refresh = () => {
    if (!opts.create && opts.tab === 'sessions' && !opening && current() && document.visibilityState === 'visible' && !body.querySelector('form') && !document.querySelector('dialog[open]')) void load();
  };
  window.addEventListener('focus', refresh, { signal: abort.signal });
  const timer = window.setInterval(refresh, 60_000);

  async function load(): Promise<void> {
    if (!source || !current()) return;
    const my = ++ticket;
    createFolderAction = undefined;
    clearPreviews?.(); clearPreviews = undefined;
    clearAssetPreview?.(); clearAssetPreview = undefined;
    clearActions?.(); clearActions = undefined;
    clearAgents?.(); clearAgents = undefined;
    clearInvite?.(); clearInvite = undefined; invitation?.close(); invitation = undefined;
    body.replaceChildren(node('p', tRaw('Loading…'), 'team-project-notice'));
    const projects = await readSourceProjects(source);
    if (!current() || my !== ticket) return;
    if (!projects.ok) { failure(projects.status, () => { void load(); }); return; }
    const project = projects.items.find(p => p.id === opts.projectId);
    if (!project) { failure(403, () => { void load(); }); return; }
    const projectId = project.id, projectRole = project.myRole;
    const crumb = node('span', project.name); crumb.setAttribute('aria-current', 'page'); breadcrumbs.replaceChildren(root, crumb);
    noteProjectOpened(project.id);
    document.title = tRaw('{name} - Lolly', { name: project.name });
    const head = node('header', undefined, 'team-project-head'), identity = node('div', undefined, 'team-project-identity');
    const glyph = node('span', undefined, 'team-project-glyph'); glyph.innerHTML = icon('folderUsers'); glyph.setAttribute('aria-hidden', 'true');
    const title = node('div'), name = node('h2', project.name); name.tabIndex = -1;
    title.append(name, node('p', [tRaw('Shared project'), project.myRole ? roleLabel(project.myRole) : ''].filter(Boolean).join(' · '), 'team-project-notice'));
    identity.append(glyph, title); head.append(identity);
    const actions = node('div', undefined, 'team-project-actions');
    if (isManagerPlus(projectRole)) {
      actions.append(button(tRaw('Share'), () => { window.location.hash = `#/p?team=${encodeURIComponent(projectId)}&tab=people`; }));
      clearInvite = mountInviteLinkControl(actions, projectInviteLinks(projectId, invitePolicy(orgConfig()), () => current() && my === ticket));
    }
    const copy = button(tRaw('Copy project link'), () => { void copyText(teamProjectLinkUrl(project.id)).then(ok => {
      if (current()) notice.textContent = ok ? tRaw('Link copied') : tRaw('Could not copy. Try again.');
    }); }); actions.append(copy);
    const canWrite = canWriteProject(project.myRole) && orgConfig()?.can?.['session.edit'] !== false;
    const canCreateSession = canWrite && orgConfig()?.can?.['session.create'] !== false;
    if (source.write && canCreateSession) actions.append(button(tRaw('New session'), () => showNewSession(), true));
    if (canWrite) actions.append(button(tRaw('New folder'), () => createFolderAction?.()));
    if (isManagerPlus(projectRole)) actions.append(button(tRaw('Rename'), () => { void (async () => {
      const name = await promptDialog({ title: tRaw('Rename shared project'), message: tRaw('Project name'), value: project.name, confirmLabel: tRaw('Save') });
      if (!current() || !name?.trim() || name.trim() === project.name) return;
      const got = await renameTeamProject(projectId, name.trim().slice(0, 200));
      if (!current()) return;
      if (got.ok) void load(); else notice.textContent = tRaw('Could not rename this project. Refresh and try again.');
    })(); }));
    actions.append(button(tRaw('Refresh'), () => { void load(); })); head.append(actions);
    const tabs = node('nav', undefined, 'team-project-tabs'); tabs.setAttribute('aria-label', tRaw('Shared project'));
    const addTab = (label: string, tab: string) => {
      const link = node('a', label, 'btn btn--sm btn--ghost'); link.href = `#/p?team=${encodeURIComponent(project.id)}&tab=${tab}`;
      if (opts.tab === tab || opts.tab === 'sessions' && tab === 'sessions') link.setAttribute('aria-current', 'page'); tabs.append(link);
    };
    addTab(tRaw('Contents'), 'sessions');
    addTab(tRaw('Agents'), 'agents');
    if (peopleAccess(project.myRole, invitePolicy(orgConfig())) !== 'hidden') addTab(tRaw('People'), 'people');
    if (orgConfig()?.sharing?.projectFiles) addTab(tRaw('Files'), 'files');
    const notice = node('p', undefined, 'team-project-notice'); notice.setAttribute('role', 'status');
    const content = node('div'); body.replaceChildren(head, tabs, notice, content);
    if (opts.tab === 'agents') {
      clearAgents = mountProjectAgentsPanel(content, { projectId: project.id, projectName: project.name, isCurrent: () => current() && my === ticket }); return;
    }
    if (opts.tab === 'people') {
      content.append(buildPeoplePanel({ projectId: project.id, projectName: project.name, policy: invitePolicy(orgConfig()) })); return;
    }
    if (opts.tab === 'files' && orgConfig()?.sharing?.projectFiles) {
      content.append(buildTeamFilesPanel({ projectId: project.id, canUpload: canWrite, canManage: isManagerPlus(projectRole), onBack: () => { window.location.hash = `#/p?team=${encodeURIComponent(project.id)}`; } })); return;
    }
    const [got, assets, folderData] = await Promise.all([
      readSourceSessions(source!, project.id),
      orgConfig()?.sharing?.projectFiles ? listTeamFiles(project.id).then(data => ({ files: data.files, error: '' }), error => ({ files: [], error: teamFileMessage(error, 'list') })) : Promise.resolve({ files: [], error: '' }),
      listTeamFolders(project.id).then(folders => ({ folders, error: '' }), error => ({ folders: [], error: String(error instanceof Error ? error.message : error) })),
    ]);
    if (!current() || my !== ticket) return;
    if (!got.ok) { content.append(node('p', teamOpenMessage(got.status), 'team-project-notice'), button(tRaw('Try again'), () => { void load(); })); return; }
    if (assets.error) content.append(node('p', assets.error, 'team-project-notice'), button(tRaw('Try again'), () => { void load(); }));
    if (folderData.error) content.append(node('p', folderData.error, 'team-project-notice'));
    const folders = folderData.folders, folderId = opts.folderId || null;
    const folder = folders.find(f => f.id === folderId);
    if (folderId && !folder) { content.append(node('p', tRaw('This shared folder is unavailable. Return to the project or refresh.'), 'team-project-notice')); return; }
    const chain = []; let ancestor = folder; const seen = new Set<string>();
    while (ancestor && !seen.has(ancestor.id)) { seen.add(ancestor.id); chain.unshift(ancestor); ancestor = folders.find(f => f.id === ancestor!.parentId); }
    breadcrumbs.replaceChildren(root);
    const projectCrumb = node('a', project.name); projectCrumb.href = teamFolderHref(project.id); breadcrumbs.append(projectCrumb);
    for (const entry of chain) { const crumb = node('a', entry.name); crumb.href = teamFolderHref(project.id, entry.id); if (entry.id === folderId) crumb.setAttribute('aria-current', 'page'); breadcrumbs.append(crumb); }
    if (folder) head.querySelector('h2')!.textContent = folder.name;
    if (canWrite) createFolderAction = showNewFolder;
    if (opts.assetId) {
      const file = assets.files.find(file => file.id === opts.assetId);
      if (file) {
        const page = buildProjectAsset(project.id, file, folderId, opts.assetPreview?.(project.id, file));
        clearAssetPreview = () => page.dispose();
        content.append(page);
      } else content.append(node('p', tRaw('This asset is unavailable. Return to the project or refresh to check your access.'), 'team-project-notice'));
      return;
    }
    const tokens = tokenize(opts.query || '');
    const belongs = (kind: 'session' | 'file', ref: string) => folder ? folder.items.some(item => item.kind === kind && item.ref === ref)
      : !folders.some(f => f.items.some(item => item.kind === kind && item.ref === ref));
    const sessions = got.items.filter(session => belongs('session', session.id) && (!tokens.length || matchesHaystack(buildFolderHaystack(`${session.label || ''} ${opts.toolName(session.toolId)}`), tokens)));
    sessions.sort((a, b) => (opts.reversed ? -1 : 1) * (opts.sort === 'name' ? (a.label || a.toolId).localeCompare(b.label || b.toolId) : opts.sort === 'tool' ? opts.toolName(a.toolId).localeCompare(opts.toolName(b.toolId)) : (b.updatedAt || '').localeCompare(a.updatedAt || '')));
    const grid = node('div', undefined, `folder-grid projects-grid${opts.list ? ' projects-list' : ''}`);
    const files = assets.files.filter(file => belongs('file', file.id) && (!tokens.length || matchesHaystack(buildFolderHaystack(file.name), tokens)));
    const children = folders.filter(f => f.parentId === folderId && (!tokens.length || matchesHaystack(buildFolderHaystack(f.name), tokens))).sort((a, b) => a.name.localeCompare(b.name));
    grid.innerHTML = children.map(f => folderTile(f, { count: f.items.length + folders.filter(child => child.parentId === f.id).length, href: teamFolderHref(project.id, f.id), shared: { subfolder: true, subtitle: tRaw('Shared folder'), openLabel: tRaw('Open shared folder {name}', { name: f.name }) } })).join('') + sessions.map(session => {
      const name = session.label || opts.toolName(session.toolId) || session.toolId;
      return sessionTile({ slot: session.id, toolId: session.toolId, label: name, updatedAt: session.updatedAt }, {
        toolName: opts.toolName(session.toolId), href: `#/team/${encodeURIComponent(session.id)}`,
        shared: { subtitle: [opts.toolName(session.toolId), activityLabel(session)].filter(Boolean).join(' · '), openLabel: tRaw('Open shared session {name}', { name }) },
      });
    }).join('') + teamAssetTiles(project.id, files, folderId);
    applyCardSize(grid, readCardSize('projects'));
    clearActions = mountTeamProjectActions({ grid, content, projectId, projectName: project.name, folderId, folders, files,
      canWrite, canManage: isManagerPlus(projectRole), canDeleteSession: isManagerPlus(projectRole) && orgConfig()?.can?.['session.delete'] !== false,
      current: () => current() && my === ticket, reload: () => { void load(); },
      duplicate: (id, kind) => duplicateProjectItem({ projectId, id, kind, folderId, folders, writer: source?.write,
        name: grid.querySelector<HTMLElement>(`[data-ref="${CSS.escape(id)}"] .tile-title`)?.textContent || id, current: () => current() && my === ticket }),
      notice: message => { if (current() && my === ticket) notice.textContent = message; }, sessionAction,
    });
    async function sessionAction(action: string, id: string, tile: HTMLElement | null): Promise<boolean | undefined> {
      const session = sessions.find(s => s.id === id); if (!session || !current()) return;
      if (action === 'invite' && tile && isManagerPlus(projectRole)) {
        invitation?.close(); invitation = showProjectInviteLink(tile.querySelector<HTMLElement>('.tile-menu-btn') || tile, projectId, () => current() && my === ticket, id); return;
      }
      if (action === 'copy') {
        const ok = await copyText(`${getInstanceBase() || window.location.origin}/#/team/${encodeURIComponent(id)}`);
        if (current()) notice.textContent = ok ? tRaw('Link copied') : tRaw('Could not copy. Try again.');
        return;
      }
      if (action === 'rename' && canWrite) {
        const label = await promptDialog({ title: tRaw('Rename shared session'), message: tRaw('Session name'), value: session.label || opts.toolName(session.toolId), confirmLabel: tRaw('Save') });
        if (!current() || !label?.trim()) return;
        const fresh = await fetchTeamSession(id); if (!current()) return;
        if (!fresh.ok || fresh.data.rev === undefined) { notice.textContent = teamOpenMessage(fresh.ok ? 0 : fresh.status); return; }
        const got = await renameTeamSession(id, label.trim().slice(0, 200), fresh.data.rev, fresh.data.meta);
        if (!current()) return;
        if (got.ok) void load(); else notice.textContent = got.code === 'COLLAB_ACTIVE' ? tRaw('Close the live session before renaming it, then try again.') : tRaw('This session changed or your access changed. Refresh and try again.');
      } else if ((action === 'delete' || action === 'delete-confirmed') && isManagerPlus(projectRole)) {
        const accepted = action === 'delete-confirmed' || await confirmDialog({ title: tRaw('Delete shared session?'), message: tRaw('Delete {name} for everyone in this project?', { name: session.label || opts.toolName(session.toolId) }), confirmLabel: tRaw('Delete') });
        if (!accepted || !current()) return;
        const got = await deleteTeamSession(id); if (!current()) return;
        if (action === 'delete-confirmed') { if (!got.ok) throw new Error(tRaw('Could not delete this session. Refresh and try again.')); return true; }
        if (got.ok) void load(); else notice.textContent = tRaw('Could not delete this session. Refresh and try again.');
      }
    }
    grid.addEventListener('click', event => {
      const link = (event.target as Element).closest<HTMLElement>('[data-open-team-session]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); event.stopPropagation(); void open(link.dataset.openTeamSession!, notice);
    }, { signal: abort.signal });
    content.append(children.length || sessions.length || files.length ? grid : node('p', tokens.length ? tRaw('No shared folders, sessions or assets match your search.') : tRaw('No contents yet. Create a folder or session to start working together.'), 'team-project-empty'));
    clearPreviews = hydrateSharedPreviews(grid, source!, opts.host, current);

    function showNewFolder(): void {
      if (!canWrite || !current() || my !== ticket) return;
      const form = node('form', undefined, 'team-new-project'), label = node('label', tRaw('Folder name'));
      const input = node('input', undefined, 'field-input'); input.required = true; input.maxLength = 200; input.setAttribute('aria-label', tRaw('New shared folder name')); label.append(input);
      const status = node('p', undefined, 'team-project-notice'); status.setAttribute('role', 'status');
      const create = node('button', tRaw('Create folder'), 'btn btn--primary'); create.type = 'submit';
      const controls = node('div', undefined, 'modal-actions'); controls.append(button(tRaw('Cancel'), () => { void load(); }), create); form.append(label, status, controls);
      content.replaceChildren(form); input.focus();
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (create.disabled || !input.value.trim()) return; create.disabled = true;
        try { await createTeamFolder(projectId, input.value.trim(), folderId); if (current()) void load(); }
        catch (error) { if (current()) { status.textContent = String(error instanceof Error ? error.message : error); create.disabled = false; } }
      }, { signal: abort.signal });
    }

    function showNewSession(): void {
      const form = node('form', undefined, 'team-new-project');
      const titleLabel = node('label', tRaw('Session name')), titleInput = node('input', undefined, 'field-input'); titleInput.required = true; titleInput.maxLength = 200; titleLabel.append(titleInput);
      const toolLabel = node('label', tRaw('Tool')), tool = node('select', undefined, 'field-select');
      for (const item of opts.tools ?? []) { const option = node('option', item.name); option.value = item.id; tool.append(option); }
      if ([...tool.options].some(o => o.value === 'design')) tool.value = 'design'; toolLabel.append(tool);
      const create = node('button', tRaw('Create session'), 'btn btn--primary'); create.type = 'submit';
      const status = node('p', undefined, 'team-project-notice'); status.setAttribute('role', 'status');
      form.append(titleLabel, toolLabel, status, node('div', undefined, 'modal-actions'));
      form.lastElementChild!.append(button(tRaw('Cancel'), () => { void load(); }), create);
      content.replaceChildren(form); titleInput.focus();
      let savedId: string | undefined;
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (create.disabled || !tool.value || !titleInput.value.trim()) return; create.disabled = true;
        try {
          if (!savedId) {
            const saved = await source!.write!.createSession(projectId, { toolId: tool.value, inputs: {}, meta: { label: titleInput.value.trim() } });
            if (!current()) return;
            if (saved.kind !== 'saved') { status.textContent = saved.kind === 'file-error' ? saved.message : teamOpenMessage(saved.kind === 'error' ? saved.status : 409); return; }
            savedId = saved.id; titleInput.disabled = true; tool.disabled = true;
          }
          if (folderId) await moveTeamFolderItem(projectId, folderId, 'session', savedId);
          if (current()) await open(savedId, status);
        } catch { if (current()) status.textContent = savedId ? tRaw('Your session is saved. Try again to move the session into this folder and open the document.') : tRaw('Could not create the session. Check your connection and try again.'); }
        finally { create.disabled = false; }
      }, { signal: abort.signal });
    }
  }
  async function open(id: string, notice: HTMLElement): Promise<void> {
    if (opening || !current()) return; opening = true; notice.textContent = tRaw('Opening shared session…');
    try {
      const got = await openTeamSession(id, { host: opts.host, projectId: opts.projectId, beforeNavigate: opts.beforeNavigate, stillWanted: current });
      if (!got.ok && current()) notice.textContent = teamOpenMessage(got.status);
    } finally { opening = false; }
  }
  return () => { disposed = true; ++ticket; clearActions?.(); clearAgents?.(); clearAssetPreview?.(); clearPreviews?.(); clearInvite?.(); invitation?.close(); window.clearInterval(timer); abort.abort(); };
}
