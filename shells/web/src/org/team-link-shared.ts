// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-link-shared - the pieces both team link routes use: the id check, the plan
 * a link follows (open, sign in, no instance, no answer), the centred card, and the
 * two cards for a member the instance turned away:
 *
 *  - no access (403): who they are signed in as, Ask for access (org/access-request.ts)
 *    when the instance takes requests, and Use a different account. An answer that
 *    gives access, seen through the inbox, opens the link again;
 *  - a sign-in that lapsed (401): Sign in, coming back to the link.
 *
 * org/team-link.ts (`#/team/<sessionId>`) lazy-loads org/team-project-link.ts
 * (`#/team/project/<projectId>`), and the project route needs these too. Keeping them
 * here, in a module that imports neither route, keeps the two out of a load-order
 * cycle. org/team-link.ts re-exports the two pure helpers for its tests.
 *
 * Every string reaches the page through textContent.
 */
import { instancePath } from '../lib/instance.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { safeHref } from '../utils.ts';
import { orgConfig, orgSession, signOutOfInstance } from './index.ts';
import { buildAskForm, projectRequestsOn, type AskTarget, type InboxWatch } from './access-request.ts';

/** A session id from the route, or '' when it is not a plausible id. Pure. */
export function teamLinkSessionId(raw: string | null | undefined): string {
  let id = String(raw ?? '');
  try { id = decodeURIComponent(id); } catch { return ''; }
  id = id.trim();
  return /^[A-Za-z0-9._~-]{1,200}$/.test(id) ? id : '';
}

/** What the route should do, decided from what this shell knows. Pure. */
export type TeamLinkPlan =
  | { kind: 'open'; sessionId: string }
  | { kind: 'invalid' }
  | { kind: 'sign-in'; href: string | null }
  | { kind: 'unreachable' }
  | { kind: 'no-instance' };

export function planTeamLink(input: {
  sessionId: string;
  hasSource: boolean;
  /** The instance's sign-in path, null when there is an instance but no usable path,
   *  undefined when there is no instance or none answered. */
  loginPath: string | null | undefined;
  /** True when the probe got no answer, so whether there is an instance is unknown. */
  unreachable?: boolean;
  returnTo: string;
}): TeamLinkPlan {
  if (!input.sessionId) return { kind: 'invalid' };
  if (input.hasSource) return { kind: 'open', sessionId: input.sessionId };
  if (input.loginPath === undefined) return input.unreachable ? { kind: 'unreachable' } : { kind: 'no-instance' };
  return { kind: 'sign-in', href: input.loginPath ? loginHref(input.loginPath, input.returnTo) : null };
}

/** The sign-in path of the instance this shell talks to (lolly-work's login route). */
export const LOGIN_PATH = '/api/auth/login';

/** `loginPath` on the instance, carrying `returnTo`; null when the result is not a
 *  safe link (a hostile path never reaches an href). Pure. */
export function loginHref(loginPath: string, returnTo: string): string | null {
  const base = instancePath(loginPath);
  const href = `${base}${base.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
  return safeHref(href) ? href : null;
}

/** Sign in again as another account: the instance's login with the account picker,
 *  coming back to `returnTo`. Pure. */
export function switchAccountHref(returnTo: string): string {
  return `${instancePath(LOGIN_PATH)}?prompt=select_account&returnTo=${encodeURIComponent(returnTo)}`;
}

/** The address on screen, for a sign-in to come back to. */
const here = (): string => window.location.pathname + window.location.search + window.location.hash;

/** A card's one action: a link, or a button that runs `run`. */
type CardAction = { label: string; href: string } | { label: string; run: () => void; id: string };

/** A centred card in the view, in the sign-in gate's visual language. `extra` goes
 *  under the message, above the action. */
export function card(view: HTMLElement, heading: string, message: string, action?: CardAction, extra?: HTMLElement): void {
  const wrap = document.createElement('section');
  wrap.className = 'team-link';
  wrap.style.cssText = 'min-height:60vh;display:flex;align-items:center;justify-content:center;padding:40px 16px';
  const box = document.createElement('div');
  box.style.cssText = 'width:100%;max-width:26rem;text-align:center;background:hsl(var(--card));color:hsl(var(--card-foreground));border:1px solid hsl(var(--border));border-radius:var(--radius);padding:1.75rem 1.5rem';
  const h = document.createElement('h1');
  h.style.cssText = 'margin:0 0 .5rem;font-size:1.25rem;font-weight:750';
  h.textContent = heading;
  const p = document.createElement('p');
  p.setAttribute('role', 'status');
  p.style.cssText = 'margin:0;color:hsl(var(--muted-foreground));font-size:.95rem;line-height:1.55';
  p.textContent = message;
  box.append(h, p);
  if (extra) box.append(extra);
  if (action && 'href' in action) {
    const a = document.createElement('a');
    a.className = 'btn btn--primary';
    a.href = action.href;
    a.textContent = action.label;
    a.style.cssText = 'display:inline-flex;margin-top:1.25rem';
    box.append(a);
  } else if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--primary';
    b.dataset[action.id] = '';
    b.textContent = action.label;
    b.style.cssText = 'display:inline-flex;margin-top:1.25rem';
    b.addEventListener('click', action.run);
    box.append(b);
  }
  wrap.append(box);
  view.replaceChildren(wrap);
}

// ── A member the instance turned away ─────────────────────────────────────────

/** A lapsed sign-in (401): Sign in again, coming back to this link. */
export function signInAgainCard(view: HTMLElement, heading: string): void {
  const href = loginHref(LOGIN_PATH, here());
  card(view, heading, tRaw('Your sign-in has expired. Sign in again to open the link.'), href ? { label: tRaw('Sign in'), href } : undefined);
}

/** Whether the no-access card offers Ask for access: the instance takes project
 *  requests (org-config `requests.project`). */
export function canAskForAccess(): boolean {
  return projectRequestsOn(orgConfig());
}

/** "You are signed in to {workspace} as {email}.", or '' when the session has no
 *  address. Plain text. */
export function signedInLine(): string {
  const s = orgSession();
  const email = s?.kind === 'member' ? s.user.email?.trim() : '';
  const workspace = orgConfig()?.instance?.name?.trim();
  return email && workspace ? tRaw('You are signed in to {workspace} as {email}.', { workspace, email }) : '';
}

/**
 * A watch over the inbox for the ask form. The inbox module loads with the first
 * subscription; without it (an instance with no inbox) the form keeps its state until
 * the link is opened again.
 */
const inboxWatch: InboxWatch = (fn) => {
  let off: (() => void) | null = null;
  let stopped = false;
  import('./inbox.ts')
    .then((m) => { if (!stopped) off = m.onInboxChange(fn); })
    .catch(() => { /* no inbox: the person opens the link again once answered */ });
  return () => { stopped = true; off?.(); };
};

/** Use a different account: sign out of the instance, then sign in again with the
 *  account picker, coming back to this link. */
function differentAccount(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:.4rem;margin-top:1.25rem';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.dataset.teamSwitchAccount = '';
  b.textContent = tRaw('Use a different account');
  b.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-height:var(--ui-size-target)';
  const error = document.createElement('p');
  error.style.cssText = 'margin:0;color:hsl(var(--destructive));font-size:.9rem';
  error.hidden = true;
  b.addEventListener('click', () => {
    if (b.disabled) return;
    b.disabled = true;
    error.hidden = true;
    const returnTo = here();
    void signOutOfInstance().catch(() => false).then((ok) => {
      if (ok) { window.location.assign(switchAccountHref(returnTo)); return; }
      b.disabled = false;
      error.textContent = tRaw('Could not sign out. Try again.');
      error.hidden = false;
      announce(error.textContent, { assertive: true });
    });
  });
  wrap.append(b, error);
  return wrap;
}

/**
 * The card for a link this member may not open (403): `message`, who they are signed
 * in as, Ask for access when the instance takes requests, and Use a different account.
 * `onApproved` runs once an answer gives access, to open the link again. `watch` is
 * for tests; the inbox is watched otherwise.
 */
export function noAccessCard(view: HTMLElement, o: {
  heading: string;
  message: string;
  target: AskTarget;
  onApproved: () => void;
  watch?: InboxWatch;
}): void {
  const extra = document.createElement('div');
  const line = signedInLine();
  if (line) {
    const p = document.createElement('p');
    p.style.cssText = 'margin:.75rem 0 0;font-size:.9rem;line-height:1.5';
    p.textContent = line;
    extra.append(p);
  }
  if (canAskForAccess()) {
    extra.append(buildAskForm({
      target: o.target,
      defaultRole: 'editor',
      heading: tRaw('Ask for access'),
      watch: o.watch ?? inboxWatch,
      onState: (s) => { if (s === 'approved') o.onApproved(); },
    }));
  }
  extra.append(differentAccount());
  card(view, o.heading, o.message, undefined, extra);
}
