// SPDX-License-Identifier: MPL-2.0
/**
 * Workspace account actions in the existing profile menu, with a standalone
 * header chip only on views that have no profile control.
 *
 * Members get Inbox, Projects, Admin (when allowed) and sign-out actions. The
 * existing Settings row contains linked sign-ins; the standalone chip offers that
 * destination directly. Visitors get Sign in. org/index.ts registers the actions,
 * hands in everything this module reads (this module imports
 * nothing from org/index.ts, so it adds no load-order cycle) and loads it lazily, so it
 * is not on the boot path.
 *
 * Signing out first looks for recovery copies on this device: interrupted edits from a
 * live document, kept in `collab-recovery:<id>` slots (views/tool-collab-recovery.ts).
 * When this account on this workspace holds any, the person chooses to download them,
 * discard them or stay signed in, so work never stays behind unnoticed on a shared
 * device. Either choice takes them off the device: a download saves one file and then
 * removes the copies, and the file carries no owner tag. A copy counts only when its tag
 * (lib/collab-recovery-owner.ts, the reader the copies are written with) carries this
 * workspace and this account's id; the copies of other people, and untagged older
 * copies, are left as they are.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import { choiceDialog } from '../components/confirm-dialog.ts';
import { registerAccountSlot, type AccountMenuControls } from '../lib/account-slot.ts';
import { RECOVERY_SLOT_PREFIX, ownsRecoveryCopy, withoutRecoveryOwner } from '../lib/collab-recovery-owner.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { iconNode } from '../lib/icon-node.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';

/** The account as org/index.ts's orgProfileAccount() reports the account. */
export interface ChipAccount {
  workspace: string;
  member: { email: string; name: string } | null;
  inbox: { count(): number; onChange(fn: (count: number) => void): () => void; open(): void } | null;
}

/** How Sign out on all devices ended: done, an instance without the route, or a failure. */
export type EverywhereOutcome = 'ok' | 'unsupported' | 'failed';

/** Everything the chip reads and does, handed in by org/index.ts. */
export interface AccountChipDeps {
  account(): ChipAccount | null;
  /** The absolute workspace console address for an admin or owner, else null. */
  consoleUrl(): string | null;
  /** Where Sign in goes, for a visitor on an open workspace; null when there is no way in. */
  signInUrl(): string | null;
  signOut(): Promise<boolean>;
  signOutEverywhere(): Promise<EverywhereOutcome>;
  /** The member's account id (`OrgUser.sub`), which tags their recovery copies. */
  principal?: string;
  /** The workspace's own address, which tags recovery copies too. */
  workspaceOrigin: string;
  /** The host whose device storage holds the recovery copies (the live web host when absent). */
  host?: () => Pick<HostV1, 'state'> & { export?: Partial<Pick<HostV1['export'], 'download'>> } | null;
  /** Runs after a sign-out that worked. Defaults to a fresh load at the app root. */
  afterSignOut?: () => void;
  /** Moves to an in-app address (a hash route). Defaults to setting `location.hash`. */
  go?: (hash: string) => void;
}

// ── Recovery copies ─────────────────────────────────────────────────────────

/** One recovery copy as saved on this device. */
export interface RecoveryCopy { slot: string; data: Record<string, unknown> }

/** The recovery copies on this device that belong to `account` (the member's id) on the
 *  workspace at `workspace`. Resolves [] when device storage cannot be read. */
export async function accountRecoveryCopies(state: Pick<HostV1['state'], 'list' | 'load'>, workspace: string, account: string | undefined): Promise<RecoveryCopy[]> {
  if (!account) return [];
  let rows: Awaited<ReturnType<HostV1['state']['list']>>;
  try { rows = await state.list(); } catch { return []; }
  const out: RecoveryCopy[] = [];
  for (const row of rows) {
    if (!row?.slot?.startsWith(RECOVERY_SLOT_PREFIX)) continue;
    let data: object | null = null;
    try { data = await state.load(row.slot); } catch { continue; }
    if (ownsRecoveryCopy(data, workspace, account)) out.push({ slot: row.slot, data: data as Record<string, unknown> });
  }
  return out;
}

/** Every copy in one JSON file, each in the same form as a single recovery download:
 *  without the owner tag, so the file carries no workspace address or account id. */
export function recoveryCopiesFile(copies: readonly RecoveryCopy[]): Blob {
  return new Blob([JSON.stringify(copies.map((c) => withoutRecoveryOwner(c.data)), null, 2)], { type: 'application/json' });
}

/** The file name of a download of several copies. */
export const RECOVERY_COPIES_FILENAME = 'lolly-recovery-copies.json';

// ── Styles (one sheet, added the first time a chip mounts) ───────────────────

const STYLE_ID = 'org-account-chip-style';
const CSS = `
.org-account-chip{display:inline-flex;align-items:center;gap:.45rem;min-height:var(--chrome-h,44px);min-width:var(--chrome-h,44px);max-width:16rem;padding:0 .85rem;border:1px solid transparent;border-radius:var(--radius-round,999px);background:var(--ui-color-surface-raised,hsl(var(--card)));color:inherit;font:inherit;font-size:calc(13px * var(--a11y-fs,1));font-weight:600;text-decoration:none;cursor:pointer;box-shadow:inset 0 -.1em 1em 1px hsl(var(--primary) / 0.22),0 .1em .3em #0002}
.org-account-chip:hover,.org-account-chip[aria-expanded="true"]{background:hsl(var(--primary) / 0.16);box-shadow:inset 0 0 0 1px hsl(var(--primary) / 0.34)}
.org-account-chip:focus-visible{outline:2px solid var(--ui-color-focus-ring,currentColor);outline-offset:2px}
.org-account-chip svg{width:calc(16px * var(--a11y-fs,1));height:calc(16px * var(--a11y-fs,1));flex:none}
.org-account-chip-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.org-account-chip-dot{width:.5rem;height:.5rem;border-radius:50%;background:hsl(var(--primary));flex:none}
.org-account-menu-head{margin:0;padding:6px 12px 2px;font-size:var(--fs-sm);font-weight:650;overflow-wrap:anywhere}
.org-account-menu-line{margin:0;padding:0 12px 6px;font-size:var(--fs-sm);color:var(--ui-color-text-muted);overflow-wrap:anywhere}
.org-account-menu-error{margin:0 0 4px;padding:8px 12px;border:1px solid hsl(var(--destructive) / 0.45);border-radius:var(--ui-radius-panel);background:hsl(var(--destructive) / 0.08);font-size:var(--fs-sm)}
.org-account-menu .profile-menu-item[aria-disabled="true"]{opacity:.6;cursor:progress}
.org-account-menu-split{height:1px;margin:4px 0;background:var(--ui-color-border-default)}
@media (max-width:640px){.org-account-chip{padding:0;justify-content:center}.org-account-chip-name{display:none}}
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

// ── The chip ──────────────────────────────────────────────────────────────────

/** An element with a class and text, built without an HTML sink. */
function node<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A glyph from the shared icon set as a node (none where the document cannot parse SVG). */
function glyph(name: 'user' | 'externalLink', doc: Document): Element[] {
  const svg = iconNode(name, doc);
  if (!svg) return [];
  svg.setAttribute('aria-hidden', 'true');
  return [svg];
}

/** The name the chip shows: the person's name, else their address. Pure. */
export function chipName(member: { email: string; name: string }): string {
  return member.name.trim() || member.email.trim();
}

/** Save a file through the host (the apps save natively), else the bridge's anchor. */
async function deliver(host: ReturnType<NonNullable<AccountChipDeps['host']>>, blob: Blob, filename: string): Promise<void> {
  if (host?.export?.download) { await host.export.download(blob, filename); return; }
  (await import('../bridge/anchor-save.ts')).anchorSave(blob, filename);
}

/**
 * Fill `into` with the chip for the account `deps` describes. Returns the cleanup.
 * Exported for tests; the header gets it through {@link registerAccountChip}.
 */
interface AccountActionState { failure: string; busy: boolean }

export function mountAccountChip(into: HTMLElement, deps: AccountChipDeps, menu?: AccountMenuControls, state: AccountActionState = { failure: '', busy: false }): () => void {
  const doc = into.ownerDocument;
  ensureStyle(doc);
  const account = deps.account();
  if (!account) return () => {};
  const member = account.member;
  if (!member) {
    // A visitor on an open workspace: the chip is only the way in.
    const href = deps.signInUrl();
    if (!href) return () => {};
    const link = doc.createElement('a');
    link.className = menu ? 'profile-menu-item' : 'org-account-chip';
    link.href = href;
    link.dataset.accountChip = 'visitor';
    if (menu) link.setAttribute('role', 'menuitem');
    link.append(...(menu ? [] : glyph('user', doc)), node(doc, 'span', menu ? '' : 'org-account-chip-name', tRaw('Sign in')));
    into.replaceChildren(link);
    return () => { link.remove(); };
  }

  const name = chipName(member);
  const workspace = account.workspace;
  const chip = menu?.trigger ?? doc.createElement('button');
  const signedIn = workspace ? tRaw('Signed in to {workspace} as {name}', { workspace, name }) : tRaw('Signed in as {email}', { email: name });
  const dot = node(doc, 'span', 'org-account-chip-dot');
  dot.setAttribute('aria-hidden', 'true');
  if (!menu) {
    chip.setAttribute('type', 'button');
    chip.className = 'org-account-chip';
    chip.dataset.accountChip = 'member';
    chip.setAttribute('aria-haspopup', 'menu');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-label', signedIn);
    chip.title = signedIn;
    chip.append(...glyph('user', doc), node(doc, 'span', 'org-account-chip-name', name), dot);
    into.replaceChildren(chip);
  }

  const inbox = account.inbox;
  let unread = inbox ? inbox.count() : 0;
  const showUnread = (): void => { dot.hidden = unread <= 0; };
  showUnread();
  const offInbox = inbox?.onChange((n) => {
    unread = n;
    showUnread();
    const slot = doc.querySelector<HTMLElement>('.org-account-menu [data-inbox-count]');
    if (slot) { slot.textContent = String(n); slot.hidden = n <= 0; }
  });

  /** One menu row: a button, or a link for the console. */
  const item = (act: string, label: string, opts: { count?: number; href?: string } = {}): HTMLElement => {
    let row: HTMLAnchorElement | HTMLButtonElement;
    if (opts.href) {
      const link = doc.createElement('a');
      link.href = opts.href;
      link.target = '_blank';
      link.rel = 'noopener';
      row = link;
    } else {
      const press = doc.createElement('button');
      press.type = 'button';
      row = press;
    }
    row.className = 'profile-menu-item';
    row.setAttribute('role', 'menuitem');
    row.dataset.accountAct = act;
    row.append(node(doc, 'span', '', label));
    if (opts.count !== undefined) {
      const count = node(doc, 'span', 'profile-menu-count', String(opts.count));
      count.dataset.inboxCount = '';
      count.hidden = opts.count <= 0;
      row.append(count);
    }
    if (opts.href) row.append(...glyph('externalLink', doc));
    return row;
  };
  const split = (): HTMLElement => {
    const line = node(doc, 'div', 'org-account-menu-split');
    line.setAttribute('role', 'separator');
    return line;
  };

  const renderMenu = (el: HTMLElement, pop: Pick<BodyPopoverHandle, 'close'>): HTMLElement | null => {
    const consoleUrl = deps.consoleUrl();
    el.append(split(), node(doc, 'p', 'org-account-menu-head', workspace || tRaw('Account')));
    if (member.email && member.email !== name) el.append(node(doc, 'p', 'org-account-menu-line', member.email));
    if (state.failure) {
      const error = node(doc, 'p', 'org-account-menu-error', state.failure);
      error.setAttribute('role', 'alert');
      el.append(error);
    }
    if (inbox) el.append(item('inbox', tRaw('Inbox'), { count: unread }));
    el.append(item('projects', tRaw('Projects')));
    if (!menu) el.append(item('signins', tRaw('Linked sign-ins')));
    if (consoleUrl) el.append(item('console', tRaw('Admin'), { href: consoleUrl }));
    el.append(
      split(),
      item('signout', tRaw('Sign out')),
      item('everywhere', tRaw('Sign out everywhere')),
    );
    el.addEventListener('click', (e) => {
      const target = (e.target as Element).closest<HTMLElement>('[data-account-act]');
      if (!target) return;
      const act = target.dataset.accountAct;
      if (act === 'console') { pop.close(); return; }
      if (act === 'inbox') { pop.close(true); inbox?.open(); return; }
      if (act === 'projects') { pop.close(); go('#/p'); return; }
      if (act === 'signins') { pop.close(); go('#/settings?focus=instance-section'); return; }
      if (act === 'signout' || act === 'everywhere') void leave(act, target);
    });
    const first = el.querySelector<HTMLElement>(state.failure ? '[data-account-act="signout"]' : '[data-account-act]');
    state.failure = '';
    return first;
  };
  const popover = menu ? { close: menu.close, open: menu.reopen } : mountBodyPopover(chip, renderMenu, {
    className: 'profile-menu org-account-menu',
    ariaLabel: signedIn,
    onClose: () => { chip.setAttribute('aria-expanded', 'false'); },
  });

  const go = deps.go ?? ((hash: string) => { location.hash = hash; });

  const onClick = (): void => {
    if ('isOpen' in popover && popover.isOpen()) { popover.close(true); return; }
    popover.open();
    chip.setAttribute('aria-expanded', 'true');
  };
  if (menu) renderMenu(into, popover);
  else chip.addEventListener('click', onClick);

  /** A failure: said aloud now, and shown at the top of the menu, which opens again to show the failure. */
  const fail = (message: string): void => {
    state.failure = message;
    announce(message, { assertive: true });
    if (chip.isConnected) { popover.close(); popover.open(); chip.setAttribute('aria-expanded', 'true'); }
  };

  /** Offer to download or discard this account's recovery copies. Resolves whether to go on signing out. */
  const settleRecoveryCopies = async (): Promise<boolean> => {
    const host = deps.host ? deps.host() : getHostRef();
    if (!host?.state) return true;
    const copies = await accountRecoveryCopies(host.state, deps.workspaceOrigin, deps.principal);
    if (!copies.length) return true;
    const choice = await choiceDialog({
      title: tRaw('Download or discard {count} recovery copies before signing out?', { count: String(copies.length) }),
      message: tRaw('Recovery copies keep interrupted edits from live documents on this device.'),
      choices: [
        { id: 'discard', label: tRaw('Discard recovery copies') },
        { id: 'download', label: tRaw('Download recovery copies'), primary: true },
      ],
    });
    if (choice === 'download') {
      try { await deliver(host, recoveryCopiesFile(copies), RECOVERY_COPIES_FILENAME); } catch { fail(tRaw('Recovery download failed. Try again.')); return false; }
    } else if (choice !== 'discard') {
      return false;
    }
    // Downloaded or discarded, the copies leave this device before the person does: on a
    // shared device the next person's browser must not hold them. A copy that cannot be
    // removed keeps the person signed in, and says so.
    try { for (const c of copies) await host.state.delete(c.slot); } catch { fail(tRaw('Could not complete this action. Please try again.')); return false; }
    return true;
  };

  const leave = async (act: 'signout' | 'everywhere', control: HTMLElement): Promise<void> => {
    if (state.busy) return;
    state.busy = true;
    control.setAttribute('aria-disabled', 'true');
    try {
      popover.close();
      if (!await settleRecoveryCopies()) return;
      if (act === 'everywhere') {
        const outcome = await deps.signOutEverywhere().catch((): EverywhereOutcome => 'failed');
        // An older instance has no such route: trying again would not help, so say what is missing.
        if (outcome === 'unsupported') { fail(tRaw('This workspace cannot sign you out on other devices yet.')); return; }
        if (outcome !== 'ok') { fail(tRaw('Could not sign out. Try again.')); return; }
      } else if (!await deps.signOut().catch(() => false)) {
        fail(tRaw('Could not sign out. Try again.'));
        return;
      }
      (deps.afterSignOut ?? (() => {
        window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
        location.replace('/');
      }))();
    } finally {
      state.busy = false;
      control.removeAttribute('aria-disabled');
    }
  };

  return () => {
    offInbox?.();
    if (!menu) {
      chip.removeEventListener('click', onClick);
      popover.close();
      chip.remove();
    }
  };
}

/** Put the chip in the header's account slot. Returns the unregister function. */
export function registerAccountChip(deps: AccountChipDeps): () => void {
  const state: AccountActionState = { failure: '', busy: false };
  return registerAccountSlot({ mount: into => mountAccountChip(into, deps), menu: (into, controls) => mountAccountChip(into, deps, controls, state) });
}
