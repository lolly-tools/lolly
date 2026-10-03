// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-link - the `#/team/<sessionId>` route: a link that opens a team session.
 * `#/team/project/<projectId>` is handed on to org/team-project-link.ts.
 *
 * main.ts parses the route and hands it here (lazy-loaded, so a deployment with no
 * control plane loads this only when someone follows such a link). The route is a
 * hand-off, not a view of its own:
 *
 *  - a signed-in member (the session source is registered): open the session with
 *    org/team-open.ts, which arms the team origin and REPLACES this address with the
 *    tool's, so Back does not return to the link and open it a second time;
 *  - a gated instance and no session: boot never gets here, because the sign-in gate
 *    renders first and carries this address in its `returnTo`, so signing in returns
 *    to the link;
 *  - an open instance and no session: a short card with a sign-in link that returns
 *    here;
 *  - no instance at all (the origin said so plainly, now or recently): a short card
 *    that says so;
 *  - no answer (a timeout, a network error, a 5xx such as a cold start): the
 *    unreachable sentence and a Try again action, never "no instance".
 *
 * A deleted (410) or unknown (404) session, or a refusal, says which in plain words.
 * Every string reaches the page through textContent.
 */
import { getSessionSource } from '../lib/session-source.ts';
import { tRaw } from '../i18n.ts';
import { isRecentlyAbsent, probeInstance } from './probe.ts';
import { openTeamSession, teamOpenMessage } from './team-open.ts';
import { card, planTeamLink, teamLinkSessionId } from './team-link-shared.ts';

// The id check, the plan and the card live in org/team-link-shared.ts, which the
// project route imports too. The two pure helpers are re-exported for this route's tests.
export { planTeamLink, teamLinkSessionId } from './team-link-shared.ts';

interface TeamLinkView extends HTMLElement { _cleanup?: () => void }

/** Mount the route. Resolves once the card is up; the open itself carries on after. */
export async function mountTeamLink(view: HTMLElement, rawSessionId: string): Promise<void> {
  // `#/team/project/<projectId>` arrives here as the slug `project/<projectId>` (main.ts),
  // and opens the Team projects view on that project instead of a session.
  if (String(rawSessionId ?? '').startsWith('project/')) {
    const { mountTeamProjectLink } = await import('./team-project-link.ts');
    await mountTeamProjectLink(view, String(rawSessionId).slice('project/'.length));
    return;
  }
  const sessionId = teamLinkSessionId(rawSessionId);
  const heading = tRaw('Team session');
  document.title = `${heading} - Lolly`;
  let cancelled = false;
  (view as TeamLinkView)._cleanup = () => { cancelled = true; };
  const linkHash = window.location.hash;

  const hasSource = !!getSessionSource();
  let loginPath: string | null | undefined;
  let unreachable = false;
  if (sessionId && !hasSource) {
    // No member session. Ask whether there is an instance at all, and how to sign in
    // to it; the boot probe's negative cache answers without a request when it can.
    // Only a definite "none here" is called that: a probe with no answer (a cold
    // start, a slow phone network) is said to be unreachable, so a reload can open the link.
    if (!isRecentlyAbsent()) {
      const probe = await probeInstance().catch(() => ({ auth: null, absent: false }));
      loginPath = probe.auth ? probe.auth.loginPath : undefined;
      unreachable = !probe.auth && !probe.absent;
    }
    if (cancelled) return;
  }
  const plan = planTeamLink({
    sessionId,
    hasSource,
    loginPath,
    unreachable,
    returnTo: window.location.pathname + window.location.search + window.location.hash,
  });

  if (plan.kind === 'invalid') {
    card(view, heading, tRaw('This team link is incomplete. Ask whoever sent it for the full link.'), { label: tRaw('Go to Projects'), href: '#/p' });
    return;
  }
  if (plan.kind === 'unreachable') {
    card(view, heading, teamOpenMessage(0), { label: tRaw('Try again'), id: 'teamRetry', run: () => window.location.reload() });
    return;
  }
  if (plan.kind === 'no-instance') {
    card(view, heading, tRaw('This link opens a team session on an organisation’s Lolly instance. This app is not connected to one.'), { label: tRaw('Go to the gallery'), href: '#/' });
    return;
  }
  if (plan.kind === 'sign-in') {
    card(view, heading, tRaw('Sign in to this instance to open the team session.'), plan.href ? { label: tRaw('Sign in'), href: plan.href } : undefined);
    return;
  }

  card(view, heading, tRaw('Opening the team session…'));
  // Not awaited: the route resolves with the card up, and the open replaces this
  // address with the tool's once the session has loaded, so the router is never asked
  // to mount the tool while it is still mounting this route.
  void openTeamSession(plan.sessionId, {
    replace: true,
    stillWanted: () => !cancelled && view.isConnected && window.location.hash === linkHash,
    // The session is on its way: take the card down, so it does not sit behind the
    // tool's own loading state. A failure after this point still draws a card.
    beforeNavigate: () => view.replaceChildren(),
  }).then((got) => {
    if (got.ok || got.status === -2 || cancelled) return;
    card(view, heading, teamOpenMessage(got.status), { label: tRaw('Go to Projects'), href: '#/p' });
  });
}
