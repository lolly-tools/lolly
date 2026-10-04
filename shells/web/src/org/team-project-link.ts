// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-project-link - the `#/team/project/<projectId>` route: the link an invite
 * sends, which opens the Team projects view on that project.
 *
 * Reached through org/team-link.ts (main.ts hands it the slug `project/<id>`), with
 * the same hand-off rules as a session link, and the same id check, plan and card
 * (org/team-link-shared.ts):
 *
 *  - a signed-in member: check the project can be read (a 404 and a 403 say which, in
 *    plain words), then go on to Projects with the Team projects dialog
 *    (org/team-projects.ts) open on that project, through the session source's
 *    project request (lib/session-source.ts). The card stays only for a failure. A
 *    403 offers Ask for access and Use a different account, and opens the project
 *    once an answer gives access; a 401 offers Sign in (org/team-link-shared.ts);
 *  - a gated instance and no session: the sign-in gate renders first and carries this
 *    address in its `returnTo`, so signing in opens the invited project;
 *  - an open instance and no session: a card with a sign-in link that returns here;
 *  - no instance, or no answer: the same cards as a session link.
 *
 * Every string reaches the page through textContent.
 */
import { getSessionSource, requestSourceProject } from '../lib/session-source.ts';
import { canGoBack, getPrevView } from '../lib/back-nav.ts';
import { tRaw } from '../i18n.ts';
import { isRecentlyAbsent, probeInstance } from './probe.ts';
import { canAskForAccess, card, noAccessCard, planTeamLink, signInAgainCard, teamLinkSessionId } from './team-link-shared.ts';
import { teamOpenMessage } from './team-open.ts';
import { fetchTeamProjectSessions } from './session-source.ts';

/** A project id from the route, or '' when it is not a plausible id. Pure. */
export function teamProjectLinkId(raw: string | null | undefined): string {
  return teamLinkSessionId(raw);
}

/** What the project route should do. Pure. */
export type TeamProjectLinkPlan =
  | { kind: 'open'; projectId: string }
  | { kind: 'invalid' }
  | { kind: 'sign-in'; href: string | null }
  | { kind: 'unreachable' }
  | { kind: 'no-instance' };

export function planTeamProjectLink(input: {
  projectId: string;
  hasSource: boolean;
  loginPath: string | null | undefined;
  unreachable?: boolean;
  returnTo: string;
}): TeamProjectLinkPlan {
  const plan = planTeamLink({ ...input, sessionId: input.projectId });
  return plan.kind === 'open' ? { kind: 'open', projectId: plan.sessionId } : plan;
}

/** The sentence for a project that could not be opened, by status. Plain text. */
export function teamProjectMessage(status: number): string {
  switch (status) {
    case 404:
    case 410: return tRaw('That team project was not found. It may have been deleted, or the link is incomplete.');
    case 403: return tRaw('You do not have access to that team project. Ask whoever sent the link to add you.');
    default: return teamOpenMessage(status);
  }
}

/** True when `href` (a previous view's address) is Projects, by hash or by path. Pure. */
export function isProjectsHref(href: string | null | undefined): boolean {
  if (!href) return false;
  let url: URL;
  try { url = new URL(href, 'https://instance.invalid/'); } catch { return false; }
  const route = url.hash ? url.hash.slice(1) : url.pathname;
  return /^\/(?:p|projects)(?:[/?]|$)/.test(route);
}

interface RouteView extends HTMLElement { _cleanup?: () => void }

/** Mount the route. Resolves once the card is up; for a member, the move to Projects follows. */
export async function mountTeamProjectLink(view: HTMLElement, rawProjectId: string): Promise<void> {
  const projectId = teamProjectLinkId(rawProjectId);
  const heading = tRaw('Team project');
  document.title = `${heading} - Lolly`;
  let cancelled = false;
  (view as RouteView)._cleanup = () => { cancelled = true; };
  const linkHash = window.location.hash;

  const hasSource = !!getSessionSource();
  let loginPath: string | null | undefined;
  let unreachable = false;
  if (projectId && !hasSource) {
    if (!isRecentlyAbsent()) {
      const probe = await probeInstance().catch(() => ({ auth: null, absent: false }));
      loginPath = probe.auth ? probe.auth.loginPath : undefined;
      unreachable = !probe.auth && !probe.absent;
    }
    if (cancelled) return;
  }
  const plan = planTeamProjectLink({
    projectId,
    hasSource,
    loginPath,
    unreachable,
    returnTo: window.location.pathname + window.location.search + window.location.hash,
  });

  const toProjects = { label: tRaw('Go to Projects'), href: '#/p' };
  if (plan.kind === 'invalid') {
    card(view, heading, tRaw('This team link is incomplete. Ask whoever sent it for the full link.'), toProjects);
    return;
  }
  if (plan.kind === 'unreachable') {
    card(view, heading, teamOpenMessage(0), { label: tRaw('Try again'), id: 'teamRetry', run: () => window.location.reload() });
    return;
  }
  if (plan.kind === 'no-instance') {
    card(view, heading, tRaw('This link opens a team project on an organisation’s Lolly instance. This app is not connected to one.'), { label: tRaw('Go to the gallery'), href: '#/' });
    return;
  }
  if (plan.kind === 'sign-in') {
    card(view, heading, tRaw('Sign in to this instance to open the team project.'), plan.href ? { label: tRaw('Sign in'), href: plan.href } : undefined);
    return;
  }

  const target = plan.projectId;
  const current = (): boolean => !cancelled && view.isConnected && window.location.hash === linkHash;
  const open = (): void => {
    card(view, heading, tRaw('Opening the team project…'));
    // Not awaited, as for a session link: the route resolves with the card up, and the
    // address moves on once the project has answered, so the router is never asked to
    // mount Projects while it is still mounting this route.
    void fetchTeamProjectSessions(target).then((got) => {
      if (!current()) return;
      if (!got.ok && got.status === 403) {
        // Ask for access, when the instance takes requests; otherwise the sentence
        // says who can help. An approval opens the project from here.
        noAccessCard(view, {
          heading,
          message: canAskForAccess() ? tRaw('You do not have access to this team project.') : teamProjectMessage(403),
          target: { projectId: target },
          onApproved: () => { if (current()) open(); },
        });
        return;
      }
      if (!got.ok && got.status === 401) {
        signInAgainCard(view, heading);
        return;
      }
      if (!got.ok) {
        card(view, heading, teamProjectMessage(got.status), got.status === 0
          ? { label: tRaw('Try again'), id: 'teamRetry', run: () => window.location.reload() }
          : toProjects);
        return;
      }
      // Land on Projects with the project open in the Team projects dialog, so Back does
      // not open the link again. No card is left behind. Followed from Projects (the
      // inbox bar's Open, say), the link steps back to that entry instead of replacing
      // itself with a second copy of it, which would cost a Back press that changes
      // nothing. From anywhere else it replaces itself with Projects.
      requestSourceProject(target);
      view.replaceChildren();
      if (canGoBack() && isProjectsHref(getPrevView()?.href)) window.history.back();
      else window.location.replace('#/p');
    });
  };
  open();
}
