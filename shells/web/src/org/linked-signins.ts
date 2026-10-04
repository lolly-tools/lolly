// SPDX-License-Identifier: MPL-2.0
/**
 * org/linked-signins - the "Linked sign-ins" card in the profile view's instance
 * section: the providers this person can sign in to the instance with, removing one,
 * and a "Link" action for each provider the instance offers, email and password aside.
 *
 * Mounted only by org/index.ts mountOrgAccount, which does nothing without a member
 * session, so a deployment with no control plane never loads this module. Data comes
 * from org/identities.ts; every instance-supplied string reaches the page through
 * textContent, and the Link actions are plain links (a page navigation through the
 * provider, which comes back to this view).
 */
import { confirmDialog } from '../components/confirm-dialog.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { relTime } from '../lib/rel-time.ts';
import {
  linkSignInHref, linkableProviders, listIdentities, listSignInProviders, unlinkIdentity,
  type LinkedIdentity, type SignInProvider,
} from './identities.ts';

/** Why a sign-in stays: the one the account was created with. Plain text. */
const accountSignIn = (): string => tRaw('Your account was created with this sign-in, so it stays.');

/** The sentence for a failed remove, by status and the instance's error code (a 409
 *  is `ACCOUNT_SIGN_IN` or `LAST_SIGN_IN`). Plain text. */
export function unlinkMessage(status: number, code?: string): string {
  if (status === 409 && code === 'ACCOUNT_SIGN_IN') return accountSignIn();
  if (status === 409 || status === 400) return tRaw('This is your only sign-in, so it cannot be removed.');
  if (status === 401) return tRaw('Your sign-in has expired. Sign in again, then try again.');
  if (status === 0) return tRaw('The instance could not be reached. Try again when you are back online.');
  return tRaw('Could not remove that sign-in. Try again.');
}

/** The muted line under one sign-in: its address, when it was last used and, for the
 *  sign-in the account was created with, why it has no Remove. Plain text. */
export function identityDetail(identity: LinkedIdentity, now: number = Date.now()): string {
  const used = relTime(identity.lastLoginAt, now, tRaw);
  return [
    identity.email ?? '',
    used ? tRaw('Last used {time}', { time: used }) : '',
    identity.unlinkBlocked === 'account' ? accountSignIn() : '',
  ].filter(Boolean).join(' · ');
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** Fill `into` with the card. Resolves once the instance has answered. */
export async function mountLinkedSignIns(into: HTMLElement, opts: { returnTo?: () => string } = {}): Promise<void> {
  const box = el('div', undefined, 'org-linked-signins');
  box.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid hsl(var(--border))';
  const heading = el('h3', tRaw('Linked sign-ins'));
  heading.style.cssText = 'margin:0 0 4px;font-size:calc(14px * var(--a11y-fs));font-weight:650';
  const hint = el('p', tRaw('Each of these signs you in to the same account on this instance.'), 'profile-appearance-sub');
  const list = el('ul');
  list.style.cssText = 'list-style:none;margin:0;padding:0';
  const status = el('p', undefined, 'profile-appearance-sub');
  status.setAttribute('role', 'status');
  status.hidden = true;
  const linkRow = el('div');
  linkRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px';
  box.append(heading, hint, list, linkRow, status);
  into.append(box);

  const say = (msg: string, error: boolean): void => {
    status.textContent = msg;
    status.style.color = error ? 'hsl(var(--destructive))' : '';
    status.hidden = false;
    announce(msg, { assertive: error });
  };
  const returnTo = opts.returnTo ?? (() => window.location.pathname + window.location.search + window.location.hash);

  const row = (identity: LinkedIdentity): HTMLLIElement => {
    const li = el('li', undefined, 'store-manage--row');
    li.dataset.idp = identity.idp;
    const who = el('div');
    who.style.cssText = 'min-width:0;flex:1 1 12rem';
    const name = el('span', identity.displayName, 'store-manage-name');
    who.append(name);
    const detail = identityDetail(identity);
    if (detail) {
      const d = el('div', detail, 'profile-appearance-sub');
      d.style.cssText = 'margin:2px 0 0;overflow-wrap:anywhere';
      who.append(d);
    }
    li.append(who);
    if (identity.canUnlink) {
      const remove = el('button', tRaw('Remove'), 'btn');
      remove.type = 'button';
      remove.dataset.act = 'identity-unlink';
      remove.setAttribute('aria-label', tRaw('Remove the {name} sign-in', { name: identity.displayName }));
      remove.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: tRaw('Remove the {name} sign-in?', { name: identity.displayName }),
          message: tRaw('You will no longer be able to sign in with that provider. You can link the provider again later.'),
          confirmLabel: tRaw('Remove'),
        });
        if (!ok) return;
        remove.disabled = true;
        const got = await unlinkIdentity(identity);
        remove.disabled = false;
        if (!got.ok) { say(unlinkMessage(got.status, got.code), true); return; }
        say(tRaw('Removed the {name} sign-in.', { name: identity.displayName }), false);
        await load();
      });
      li.append(remove);
    }
    return li;
  };

  const links = (all: SignInProvider[]): void => {
    linkRow.replaceChildren();
    const providers = linkableProviders(all);
    if (!providers.length) return;
    linkRow.append(el('span', tRaw('Link another sign-in:'), 'profile-appearance-sub'));
    for (const p of providers) {
      const href = linkSignInHref(p.id, returnTo());
      if (!href) continue;
      const a = el('a', tRaw('Link {name}', { name: p.name }), 'btn');
      a.href = href;
      a.dataset.act = 'identity-link';
      linkRow.append(a);
    }
  };

  async function load(): Promise<void> {
    const [got, providers] = await Promise.all([listIdentities(), listSignInProviders()]);
    if (!box.isConnected) return;
    // An older instance has neither the list nor the link route: show nothing at all.
    if (!got.ok && got.status === 404) { box.remove(); return; }
    if (!got.ok) {
      list.replaceChildren();
      say(got.status === 0
        ? tRaw('The instance could not be reached. Try again when you are back online.')
        : tRaw('Could not load your sign-ins. Try again.'), true);
      links(providers);
      return;
    }
    list.replaceChildren(...got.data.map(row));
    links(providers);
  }
  await load();
}
