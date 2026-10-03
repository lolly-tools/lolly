// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-link-shared - the pieces both team link routes use: the id check, the plan
 * a link follows (open, sign in, no instance, no answer), and the centred card.
 *
 * org/team-link.ts (`#/team/<sessionId>`) lazy-loads org/team-project-link.ts
 * (`#/team/project/<projectId>`), and the project route needs these too. Keeping them
 * here, in a module that imports neither route, keeps the two out of a load-order
 * cycle. org/team-link.ts re-exports the two pure helpers for its tests.
 *
 * Every string reaches the page through textContent.
 */
import { instancePath } from '../lib/instance.ts';
import { safeHref } from '../utils.ts';

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
  if (!input.loginPath) return { kind: 'sign-in', href: null };
  const base = instancePath(input.loginPath);
  const href = `${base}${base.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(input.returnTo)}`;
  return { kind: 'sign-in', href: safeHref(href) ? href : null };
}

/** A card's one action: a link, or a button that runs `run`. */
type CardAction = { label: string; href: string } | { label: string; run: () => void; id: string };

/** A centred card in the view, in the sign-in gate's visual language. */
export function card(view: HTMLElement, heading: string, message: string, action?: CardAction): void {
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
