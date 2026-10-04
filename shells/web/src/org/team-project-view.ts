// SPDX-License-Identifier: MPL-2.0
/** Shared projects are folder screens inside Projects, with ordinary cards and routes. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getSessionSource, readSourceProjects, readSourceSessions } from '../lib/session-source.ts';
import { sessionTile } from '../folder-tiles.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { orgConfig } from './index.ts';
import { activityLabel, canWriteProject, invitePolicy, isManagerPlus, peopleAccess, roleLabel } from './team-access.ts';
import { buildNewProjectForm } from './team-project-form.ts';
import { buildPeoplePanel, copyText } from './team-people.ts';
import { teamProjectLinkUrl } from './project-members.ts';
import { openTeamSession, teamOpenMessage } from './team-open.ts';
import { noteProjectOpened } from './opened-projects.ts';
import { buildTeamFilesPanel } from './team-files-panel.ts';
import { hydrateSharedPreviews } from './team-previews.ts';
import { tokenize } from '../lib/search/match.ts';
import { buildFolderHaystack, matchesHaystack } from '../lib/search/projects-source.ts';

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
}

export function mountTeamProjectView(container: HTMLElement, opts: ProjectViewOptions): () => void {
  const source = getSessionSource(), abort = new AbortController();
  let disposed = false, ticket = 0, opening = false;
  let clearPreviews: (() => void) | undefined;
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
    body.append(node('h2', tRaw('New team project')), node('p', tRaw('Create a shared folder for your team’s sessions. Choose people after creating it.'), 'team-project-notice'));
    if (!writer?.projectOptions().canCreate) body.append(node('p', tRaw('This instance does not let you create projects.'), 'team-project-notice'));
    else body.append(buildNewProjectForm(writer, { onCreated: project => {
      if (current()) window.location.hash = `#/p?team=${encodeURIComponent(project.id)}&tab=people`;
    }, onCancel: () => { window.location.hash = '#/p'; } }));
  } else void load();

  async function load(): Promise<void> {
    if (!source || !current()) return;
    const my = ++ticket;
    clearPreviews?.(); clearPreviews = undefined;
    body.replaceChildren(node('p', tRaw('Loading…'), 'team-project-notice'));
    const projects = await readSourceProjects(source);
    if (!current() || my !== ticket) return;
    if (!projects.ok) { failure(projects.status, () => { void load(); }); return; }
    const project = projects.items.find(p => p.id === opts.projectId);
    if (!project) { failure(403, () => { void load(); }); return; }
    const projectId = project.id;
    noteProjectOpened(project.id);
    document.title = tRaw('{name} - Lolly', { name: project.name });
    const head = node('header', undefined, 'team-project-head'), identity = node('div', undefined, 'team-project-identity');
    const glyph = node('span', undefined, 'team-project-glyph'); glyph.innerHTML = icon('folderUsers'); glyph.setAttribute('aria-hidden', 'true');
    const title = node('div'), name = node('h2', project.name); name.tabIndex = -1;
    title.append(name, node('p', [tRaw('Shared project'), project.myRole ? roleLabel(project.myRole) : ''].filter(Boolean).join(' · '), 'team-project-notice'));
    identity.append(glyph, title); head.append(identity);
    const actions = node('div', undefined, 'team-project-actions');
    const copy = button(tRaw('Copy project link'), () => { void copyText(teamProjectLinkUrl(project.id)).then(ok => {
      if (current()) notice.textContent = ok ? tRaw('Link copied') : tRaw('Could not copy. Try again.');
    }); }); actions.append(copy);
    const canWrite = canWriteProject(project.myRole) && orgConfig()?.can?.['session.create'] !== false;
    if (source.write && canWrite) actions.append(button(tRaw('New session'), () => showNewSession(), true));
    actions.append(button(tRaw('Refresh'), () => { void load(); })); head.append(actions);
    const tabs = node('nav', undefined, 'team-project-tabs'); tabs.setAttribute('aria-label', tRaw('Shared project'));
    const addTab = (label: string, tab: string) => {
      const link = node('a', label, 'btn btn--sm btn--ghost'); link.href = `#/p?team=${encodeURIComponent(project.id)}&tab=${tab}`;
      if (opts.tab === tab || opts.tab === 'sessions' && tab === 'sessions') link.setAttribute('aria-current', 'page'); tabs.append(link);
    };
    addTab(tRaw('Sessions'), 'sessions');
    if (peopleAccess(project.myRole, invitePolicy(orgConfig())) !== 'hidden') addTab(tRaw('People'), 'people');
    if (orgConfig()?.sharing?.projectFiles) addTab(tRaw('Files'), 'files');
    const notice = node('p', undefined, 'team-project-notice'); notice.setAttribute('role', 'status');
    const content = node('div'); body.replaceChildren(head, tabs, notice, content);
    if (opts.tab === 'people') {
      content.append(buildPeoplePanel({ projectId: project.id, projectName: project.name, policy: invitePolicy(orgConfig()) })); return;
    }
    if (opts.tab === 'files' && orgConfig()?.sharing?.projectFiles) {
      content.append(buildTeamFilesPanel({ projectId: project.id, canUpload: canWrite, canManage: isManagerPlus(project.myRole), onBack: () => { window.location.hash = `#/p?team=${encodeURIComponent(project.id)}`; } })); return;
    }
    const got = await readSourceSessions(source!, project.id);
    if (!current() || my !== ticket) return;
    if (!got.ok) { content.append(node('p', teamOpenMessage(got.status), 'team-project-notice'), button(tRaw('Try again'), () => { void load(); })); return; }
    const tokens = tokenize(opts.query || '');
    const sessions = got.items.filter(session => !tokens.length || matchesHaystack(buildFolderHaystack(`${session.label || ''} ${opts.toolName(session.toolId)}`), tokens));
    sessions.sort((a, b) => (opts.reversed ? -1 : 1) * (opts.sort === 'name' ? (a.label || a.toolId).localeCompare(b.label || b.toolId) : (b.updatedAt || '').localeCompare(a.updatedAt || '')));
    const grid = node('div', undefined, `folder-grid projects-grid${opts.list ? ' projects-list' : ''}`);
    grid.innerHTML = sessions.map(session => {
      const name = session.label || opts.toolName(session.toolId) || session.toolId;
      return sessionTile({ slot: session.id, toolId: session.toolId, label: name, updatedAt: session.updatedAt }, {
        toolName: opts.toolName(session.toolId), href: `#/team/${encodeURIComponent(session.id)}`,
        shared: { subtitle: [opts.toolName(session.toolId), activityLabel(session)].filter(Boolean).join(' · '), openLabel: tRaw('Open shared session {name}', { name }) },
      });
    }).join('');
    grid.addEventListener('click', event => {
      const link = (event.target as Element).closest<HTMLElement>('[data-open-team-session]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); event.stopPropagation(); void open(link.dataset.openTeamSession!, notice);
    }, { signal: abort.signal });
    content.append(sessions.length ? grid : node('p', tokens.length ? tRaw('No shared sessions match your search.') : tRaw('No sessions yet. Create one to start working together.'), 'team-project-empty'));
    clearPreviews = hydrateSharedPreviews(grid, source!, opts.host, current);

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
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (create.disabled || !tool.value || !titleInput.value.trim()) return; create.disabled = true;
        const saved = await source!.write!.createSession(projectId, { toolId: tool.value, inputs: {}, meta: { label: titleInput.value.trim() } });
        if (!current()) return;
        if (saved.kind === 'saved') { await open(saved.id, status); }
        else status.textContent = saved.kind === 'file-error' ? saved.message : teamOpenMessage(saved.kind === 'error' ? saved.status : 409);
        create.disabled = false;
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
  return () => { disposed = true; ++ticket; clearPreviews?.(); abort.abort(); };
}
