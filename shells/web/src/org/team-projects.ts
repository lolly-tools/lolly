// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-projects - the Team projects modal the Projects view opens from its
 * "Team projects" tile (shown only while a session source is registered).
 *
 * Browse the instance's shared projects, then a project's sessions, then open one
 * into its tool through org/team-open.ts (a working copy that remembers its origin,
 * so the Share dialog can save changes back). When the source can write, a "New
 * project" action creates one with the same form the Share dialog uses, offered only
 * while the instance lets this person create projects (`can['project.create']`).
 *
 * Each project and session row says who changed it last and when ("Edited by Ana,
 * 3h ago"), and a project's "People" action opens "People with access"
 * (org/team-people.ts) for anyone org/team-access.ts lets see the panel. The
 * `#/team/project/<id>` link (org/team-project-link.ts) goes on to Projects, which
 * opens this modal straight on that project. Opening a project acks the inbox
 * message that shared it (org/banner.ts).
 *
 * Moved out of views/projects.ts so that view only knows the tile exists; it hands
 * in the three things it owns (the host, its tool-name lookup and its return arm)
 * and lazy-loads this module on the first click.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountModal } from '../components/modal.ts';
import { getSessionSource } from '../lib/session-source.ts';
import { announce } from '../a11y.ts';
import { historySettled } from '../lib/overlay-back.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { styleTeamBack } from './team-back.ts';
import { icon } from '../lib/icons.ts';
import type { TeamProjectRef } from '../lib/session-source.ts';
import { openTeamSession, teamOpenMessage } from './team-open.ts';
import { buildNewProjectForm } from './team-project-form.ts';
import { activityLabel, canWriteProject, invitePolicy, isManagerPlus, peopleAccess, sessionCountLabel } from './team-access.ts';
import { noteProjectOpened } from './opened-projects.ts';
import { orgConfig } from './index.ts';

export interface TeamProjectsDeps {
  /** The host to open a session with; the live web host when absent. */
  host?: HostV1 | null;
  /** The display name of a tool id (the Projects view's own lookup). */
  toolName: (toolId: string) => string;
  /** Runs right before an open navigates (the view arms its back-to-Projects return). */
  beforeNavigate?: () => void;
  /** Open straight on this project's sessions instead of the project list. */
  initialProject?: { id: string; name?: string };
  /** Runs once the modal has closed; `opened` is true when it closed to open a session. */
  onClose?: (opened: boolean) => void;
}

const ROW_STYLE = 'display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:.15rem 1rem;width:100%;min-height:44px;padding:.6rem .75rem;background:none;border:0;border-radius:var(--radius);color:inherit;text-align:left;cursor:pointer;font:inherit';
/** A row's name: one step above its meta line at every type size, Large text included. */
const ROW_NAME_STYLE = 'font-weight:600;font-size:var(--fs-lg);overflow-wrap:anywhere';
const MUTED = 'color:hsl(var(--muted-foreground))';

/** The dialog while it is up: a second open (a double click while this module was
 *  still loading runs every queued open at once) is ignored rather than stacked. */
let openDialog: HTMLElement | null = null;

/** Open the modal. Does nothing while no session source is registered, or while the
 *  dialog is already open. */
export function openTeamProjectsModal(deps: TeamProjectsDeps): void {
  const src = getSessionSource();
  if (!src || openDialog?.isConnected) return;
  const writer = src.write;
  const canCreate = !!writer && writer.projectOptions().canCreate;
  const title = t('Team projects');
  // The shared .modal chrome (components/modal.ts, styles/parts/dialogs.css), the same
  // card the save-conflict and confirm dialogs use. A header that stays put (title,
  // New project, Close) over a body that scrolls on its own, so a long list or the
  // People panel never pushes the way out off a phone screen.
  const modal = mountModal<boolean>(
    `<div style="display:flex;flex-direction:column;max-height:min(42rem,calc(100dvh - 24px))">
      <div style="display:flex;align-items:center;gap:.5rem;padding:18px 14px 10px 22px;border-bottom:1px solid hsl(var(--border))">
        <h2 class="modal-title" data-team-title tabindex="-1" style="margin:0;flex:1 1 auto;min-width:0;outline:none">${escapeHtml(title)}</h2>
        ${canCreate ? `<button type="button" class="btn btn--sm" data-team-new hidden>${escapeHtml(t('New project'))}</button>` : ''}
        <button type="button" class="save-dialog-close" data-team-close aria-label="${escapeHtml(t('Close'))}" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px">${icon('close', { size: 18 })}</button>
      </div>
      <div data-team-body style="flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 22px 22px"><p class="projects-empty" style="margin:.5rem 0">${escapeHtml(t('Loading…'))}</p></div>
    </div>`,
    {
      className: 'modal team-projects-dialog',
      ariaLabel: title,
      cancelValue: false,
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-team-title]'),
      onClose: (opened) => deps.onClose?.(opened === true),
    },
  );
  // Wider than a confirm card, and edge to edge less 12px a side on a phone. The
  // padding moves inside, to the header and the scrolling body.
  openDialog = modal.el;
  modal.el.style.cssText = 'width:min(34rem,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 24px);padding:0;overflow:hidden';
  const body = modal.el.querySelector<HTMLElement>('[data-team-body]')!;
  const newBtn = modal.el.querySelector<HTMLButtonElement>('[data-team-new]');
  modal.el.querySelector('[data-team-close]')?.addEventListener('click', () => modal.close(false));
  // Which project's session list is on screen - the modal is two screens deep and the
  // session rows only carry their own id. Recorded so an opened session can name the
  // project it came from in its origin stash (org/team-session-origin.ts).
  let openProjectId: string | null = null;
  // The project list as last fetched, so a project's screen knows the person's role
  // in it (whether to offer People) without asking again.
  let known: TeamProjectRef[] = [];
  // Which screen is current. Every screen change takes the next number, and work that
  // awaited something draws only if its number is still current: a list that arrives
  // after the person moved on (pressed New project, opened a project, went back) is
  // dropped instead of replacing what they are looking at.
  let screen = 0;
  // A session open in progress: one at a time.
  let opening = false;
  const policy = invitePolicy(orgConfig());
  // Built with DOM APIs and textContent: project and session names come from the
  // instance, so none of them passes through an HTML sink.
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, style?: string): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (style) n.style.cssText = style;
    return n;
  };
  const row = (key: 'teamProject' | 'teamSession', id: string, name: string, meta: string): HTMLLIElement => {
    const b = node('button', undefined, ROW_STYLE);
    b.type = 'button';
    b.dataset[key] = id;
    const tint = (on: boolean) => () => { b.style.background = on ? 'hsl(var(--muted))' : 'none'; };
    b.addEventListener('mouseenter', tint(true));
    b.addEventListener('mouseleave', tint(false));
    b.append(node('span', name, ROW_NAME_STYLE), node('span', meta, `${MUTED};font-size:var(--fs-sm)`));
    const li = node('li');
    li.append(b);
    return li;
  };
  const list = (items: HTMLLIElement[]): HTMLUListElement => {
    const ul = node('ul', undefined, 'list-style:none;margin:.25rem -.75rem 0;padding:0;display:flex;flex-direction:column;gap:2px');
    ul.append(...items);
    return ul;
  };
  const empty = (text: string): HTMLParagraphElement => {
    const p = node('p', text, `margin:.5rem 0;${MUTED}`);
    p.className = 'projects-empty';
    return p;
  };

  /** `focusProject`: the project whose row gets focus (coming back from its sessions). */
  const showProjects = async (focusProject?: string): Promise<void> => {
    const my = ++screen;
    openProjectId = null;
    // Offered once the list is drawn, so the form it opens cannot be replaced by a
    // list that was still on its way.
    if (newBtn) newBtn.hidden = true;
    const projects = await src.listProjects().catch(() => []);
    if (!modal.el.isConnected || my !== screen) return;
    known = projects;
    if (newBtn) newBtn.hidden = false;
    const now = Date.now();
    body.replaceChildren(projects.length
      ? list(projects.map(p => row('teamProject', p.id, p.name, [
        p.sessionCount != null ? sessionCountLabel(p.sessionCount) : '',
        activityLabel(p, now),
      ].filter(Boolean).join(' · '))))
      : empty(tRaw('No team projects are shared with you yet.')));
    if (focusProject) {
      const back = Array.from(body.querySelectorAll<HTMLElement>('[data-team-project]')).find((b) => b.dataset.teamProject === focusProject);
      (back ?? modal.el.querySelector<HTMLElement>('[data-team-title]'))?.focus();
    }
  };
  const backButton = (label: string, key: string): HTMLButtonElement => {
    const back = styleTeamBack(node('button', label));
    back.type = 'button';
    back.dataset[key] = '';
    return back;
  };
  /** `focus`: move focus to the project's name once drawn (the row that was pressed is gone). */
  const showSessions = async (projectId: string, name: string, focus = false): Promise<boolean> => {
    const my = ++screen;
    openProjectId = projectId;
    // Opening the project is what a "shared <project> with you" message asked for.
    noteProjectOpened(projectId);
    if (newBtn) newBtn.hidden = true;
    body.replaceChildren(empty(tRaw('Loading…')));
    const sessions = await src.listSessions(projectId).catch(() => []);
    if (!modal.el.isConnected || my !== screen) return false;
    // Opened from a link, the project list has not been read yet; read it for the
    // person's role here, so People is offered exactly as it would be from the list.
    if (!known.some((p) => p.id === projectId)) known = await src.listProjects().catch(() => known);
    if (!modal.el.isConnected || my !== screen) return false;
    const project = known.find((p) => p.id === projectId);
    const projectTitle = name || project?.name || tRaw('Team project');
    const head = node('div', undefined, 'display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap');
    // The screen's title, a clear step above the session names below.
    const heading = node('h3', projectTitle, 'margin:.1rem 0 .2rem;font-size:var(--fs-xl);font-weight:700;overflow-wrap:anywhere;outline:none');
    heading.tabIndex = -1;
    heading.dataset.teamHeading = '';
    head.append(heading);
    if (orgConfig()?.sharing?.projectFiles) {
      const files = node('button', tRaw('Files'));
      files.type = 'button'; files.className = 'btn btn--sm';
      files.dataset.teamFiles = projectId; files.dataset.teamName = projectTitle;
      head.append(files);
    }
    if (peopleAccess(project?.myRole, policy) !== 'hidden') {
      const people = node('button', tRaw('People'));
      people.type = 'button';
      people.className = 'btn btn--sm';
      people.dataset.teamPeople = projectId;
      people.dataset.teamName = projectTitle;
      head.append(people);
    }
    const now = Date.now();
    body.replaceChildren(backButton(tRaw('← All team projects'), 'teamBack'), head, sessions.length
      ? list(sessions.map(x => row('teamSession', x.id, x.label || deps.toolName(x.toolId) || x.toolId,
        [deps.toolName(x.toolId) || x.toolId, activityLabel(x, now)].filter(Boolean).join(' · '))))
      : empty(tRaw('This project has no sessions yet.')));
    if (focus) heading.focus();
    return true;
  };
  const showPeople = (projectId: string, name: string): void => {
    const my = ++screen;
    void import('./team-people.ts').then(({ buildPeoplePanel }) => {
      if (!modal.el.isConnected || my !== screen) return;
      body.replaceChildren(buildPeoplePanel({
        projectId,
        projectName: name,
        policy,
        backLabel: tRaw('← Back to sessions'),
        // Back replaces the panel, so focus goes to the People button it came from (or
        // the project's name), not to the top of the dialog.
        onBack: () => {
          void showSessions(projectId, name).then((drawn) => {
            if (!drawn) return;
            (body.querySelector<HTMLElement>('[data-team-people]') ?? body.querySelector<HTMLElement>('[data-team-heading]'))?.focus();
          });
        },
      }));
      body.querySelector<HTMLElement>('[data-act="people-back"]')?.focus();
    }).catch(() => announce(t('That could not be opened. Try again.')));
  };
  const showFiles = (projectId: string, name: string): void => {
    const my = ++screen;
    const project = known.find(p => p.id === projectId);
    void import('./team-files-panel.ts').then(({ buildTeamFilesPanel }) => {
      if (!modal.el.isConnected || my !== screen) return;
      body.replaceChildren(buildTeamFilesPanel({ projectId,
        canUpload: canWriteProject(project?.myRole) && orgConfig()?.can?.['session.create'] !== false,
        // The project list's role already counts the instance's project.manage.
        canManage: isManagerPlus(project?.myRole),
        onBack: () => { void showSessions(projectId, name, true); },
      }));
      body.querySelector<HTMLElement>('[data-act="files-back"]')?.focus();
    }).catch(() => announce(t('That could not be opened. Try again.')));
  };
  const showNewProject = (): void => {
    if (!writer) return;
    ++screen;
    if (newBtn) newBtn.hidden = true;
    body.replaceChildren(buildNewProjectForm(writer, {
      onCreated: (project) => { void showSessions(project.id, project.name, true); },
      // The New project button hid while the form was up; it is back now, so focus returns there.
      onCancel: () => { void showProjects().then(() => { if (modal.el.isConnected && newBtn && !newBtn.hidden) newBtn.focus(); }); },
    }));
  };

  newBtn?.addEventListener('click', showNewProject);
  body.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const proj = el.closest<HTMLElement>('[data-team-project]');
    if (proj) { void showSessions(proj.dataset.teamProject!, proj.querySelector('span')?.textContent || '', true); return; }
    const people = el.closest<HTMLElement>('[data-team-people]');
    if (people) { showPeople(people.dataset.teamPeople!, people.dataset.teamName || ''); return; }
    const files = el.closest<HTMLElement>('[data-team-files]');
    if (files) { showFiles(files.dataset.teamFiles!, files.dataset.teamName || ''); return; }
    if (el.closest('[data-team-back]')) { void showProjects(openProjectId ?? undefined); return; }
    const sess = el.closest<HTMLButtonElement>('[data-team-session]');
    if (sess && !opening) void openSession(sess);
  });

  /** A visible line at the top of the body, for a session that could not be opened. */
  const showFailure = (message: string): void => {
    body.querySelector('[data-team-failure]')?.remove();
    const line = node('p', message, 'margin:0 0 .6rem;color:hsl(var(--destructive))');
    line.dataset.teamFailure = '';
    body.prepend(line);
  };

  /**
   * Open a session from its row. The dialog stays up, with the row marked busy, until
   * the session has been fetched and its tool built, and closes right before the
   * navigation. A failure is shown in
   * the dialog (and announced), so it is never only in the live region of a page the
   * person cannot see. Going to another screen or closing the dialog meanwhile
   * abandons the open.
   */
  const openSession = async (sess: HTMLButtonElement): Promise<void> => {
    const my = screen;
    const projectId = openProjectId;
    opening = true;
    body.querySelector('[data-team-failure]')?.remove();
    const meta = sess.lastElementChild as HTMLElement | null;
    const metaText = meta?.textContent ?? '';
    sess.setAttribute('aria-busy', 'true');
    if (meta) meta.textContent = tRaw('Opening…');
    const got = await openTeamSession(sess.dataset.teamSession!, {
      host: deps.host,
      projectId,
      stillWanted: () => modal.el.isConnected && my === screen,
      // Close first, and wait for the entry the dialog pushed to be popped, so the
      // tool's address goes straight after Projects' own entry: Back from the tool is
      // then one step to Projects, with no second copy of Projects in between.
      beforeNavigate: async () => {
        modal.close(true);
        await historySettled();
        deps.beforeNavigate?.();
      },
    });
    opening = false;
    sess.removeAttribute('aria-busy');
    if (meta) meta.textContent = metaText;
    if (got.ok) {
      // The same document was already on screen: nothing navigated, so close here.
      if (modal.el.isConnected) modal.close(true);
      return;
    }
    // Abandoned (the person moved on), or the dialog is gone: nothing to say here.
    if (got.status === -2 || !modal.el.isConnected || my !== screen) return;
    // The list said the session existed a moment ago; a fetch that now finds nothing
    // is the session going away, which is what the old modal said.
    const message = got.status === 404 || got.status === 410 ? t('That session is no longer available.') : teamOpenMessage(got.status);
    showFailure(message);
    announce(message);
    sess.focus();
  };
  // Opened on one project (a link): focus moves from the dialog's title to the project's name once it is drawn.
  if (deps.initialProject) void showSessions(deps.initialProject.id, deps.initialProject.name ?? '', true);
  else void showProjects();
}
