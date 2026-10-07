// SPDX-License-Identifier: MPL-2.0
/**
 * org/account-chip.ts - the workspace account chip (plan 75 G5, G18 and the recovery
 * copy offer from SEC-13).
 *
 * Pinned:
 *  - a member's chip shows their name and says "Signed in to {workspace} as {name}";
 *    its dot follows the inbox count;
 *  - the menu carries Inbox, Team projects, Linked sign-ins, Sign out and Sign out on all
 *    devices, with Workspace console only for someone with a console address, absolute
 *    and opening apart from the app;
 *  - a visitor's chip is only Sign in, and there is no chip without a way in;
 *  - recovery copies count only when tagged with this workspace and this account;
 *  - Sign out with no copies signs out at once; with copies it asks first, and Download,
 *    Discard and Cancel each do what they say;
 *  - a failed sign-out, and an instance with no sign-out-everywhere route, leave the
 *    person signed in and tell them at the top of the menu.
 *
 * Run directly:  node --test shells/web/src/org/account-chip.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AccountChipDeps, ChipAccount, EverywhereOutcome } from './account-chip.ts';

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"><main id="view"><div class="gallery-topright"><a class="profile-link" href="#/settings"></a></div></main></div></body></html>', { url: 'https://work.test/#/p', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.Node = dom.window.Node as unknown as typeof Node;
globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof MutationObserver;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const {
  mountAccountChip, registerAccountChip, accountRecoveryCopies, recoveryOwner, chipName, RECOVERY_COPIES_FILENAME,
} = await import('./account-chip.ts');
const { _clearAccountSlotForTests } = await import('../lib/account-slot.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 10; i++) await tick(); }
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await tick(); }
  assert.fail(`timed out waiting for ${what}`);
}

const WORKSPACE = 'https://work.test';

/** A device store with the given slots. */
function deviceState(slots: Record<string, object>) {
  const data = new Map(Object.entries(slots));
  const deleted: string[] = [];
  return {
    deleted,
    state: {
      async list() { return [...data.keys()].map((slot) => ({ slot, toolId: 'design', toolVersion: '1', updatedAt: '2026-10-07T00:00:00Z' })); },
      async load(slot: string) { return data.get(slot) ?? null; },
      async save(slot: string, value: object) { data.set(slot, value); },
      async delete(slot: string) { deleted.push(slot); data.delete(slot); },
    },
  };
}

interface Harness {
  deps: AccountChipDeps;
  signOuts: number;
  everywhere: number;
  after: number;
  downloads: Array<{ name: string; text: string }>;
  went: string[];
  inbox: { set(n: number): void; opened: number };
}

function harness(opts: {
  account?: ChipAccount | null;
  consoleUrl?: string | null;
  signInUrl?: string | null;
  signOut?: boolean;
  everywhere?: EverywhereOutcome;
  slots?: Record<string, object>;
  principal?: string;
} = {}): Harness & { device: ReturnType<typeof deviceState> } {
  const listeners = new Set<(n: number) => void>();
  let count = 2;
  const device = deviceState(opts.slots ?? {});
  const record = {
    signOuts: 0, everywhere: 0, after: 0, downloads: [] as Array<{ name: string; text: string }>, went: [] as string[], device,
    inbox: { set(n: number) { count = n; for (const fn of listeners) fn(n); }, opened: 0 },
  };
  const account: ChipAccount | null = opts.account === undefined
    ? {
      workspace: 'Acme',
      member: { email: 'ana@acme.com', name: 'Ana Ruiz' },
      inbox: { count: () => count, onChange(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, open() { h.inbox.opened++; } },
    }
    : opts.account;
  const deps: AccountChipDeps = {
    account: () => account,
    consoleUrl: () => opts.consoleUrl ?? null,
    signInUrl: () => opts.signInUrl ?? null,
    signOut: async () => { h.signOuts++; return opts.signOut ?? true; },
    signOutEverywhere: async () => { h.everywhere++; return opts.everywhere ?? 'ok'; },
    principal: opts.principal ?? 'u_ana',
    workspaceOrigin: WORKSPACE,
    host: () => ({
      state: device.state,
      export: { async download(blob: Blob, name: string) { h.downloads.push({ name, text: await blob.text() }); } },
    }),
    afterSignOut: () => { h.after++; },
    go: (hash) => { h.went.push(hash); },
  };
  const h = { ...record, deps };
  return h;
}

const slot = (): HTMLElement => {
  for (const n of document.querySelectorAll('.org-account-menu, dialog')) n.remove();
  const s = document.createElement('div');
  document.querySelector('.gallery-topright')!.prepend(s);
  return s;
};
const chip = (): HTMLElement => document.querySelector<HTMLElement>('.org-account-chip')!;
const menu = (): HTMLElement | null => document.querySelector('.org-account-menu');
const act = (name: string): HTMLElement | null => menu()?.querySelector<HTMLElement>(`[data-account-act="${name}"]`) ?? null;
const click = (el: Element): void => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); };
const dialog = (): HTMLDialogElement | null => document.querySelector('dialog[open]');

// ── Pure parts ──────────────────────────────────────────────────────────────────

test('chipName prefers the name, then the address', () => {
  assert.equal(chipName({ name: ' Ana ', email: 'ana@acme.com' }), 'Ana');
  assert.equal(chipName({ name: '', email: 'ana@acme.com' }), 'ana@acme.com');
});

test('recoveryOwner reads the tags on the copy, or inside __recovery, and nothing else', () => {
  assert.deepEqual(recoveryOwner({ __workspace: 'https://work.test/', __account: 'u1', x: 1 }), { workspace: 'https://work.test', account: 'u1' });
  assert.deepEqual(recoveryOwner({ __recovery: { workspace: 'https://work.test', account: 'u2' } }), { workspace: 'https://work.test', account: 'u2' });
  assert.equal(recoveryOwner({ __label: 'Canvas' }), null, 'an untagged copy belongs to nobody we can name');
  assert.equal(recoveryOwner({ __workspace: 'https://work.test' }), null);
  assert.equal(recoveryOwner(null), null);
});

test('accountRecoveryCopies keeps only this account on this workspace', async () => {
  const { state } = deviceState({
    'collab-recovery:a': { __workspace: WORKSPACE, __account: 'u_ana', v: 1 },
    'collab-recovery:b': { __workspace: WORKSPACE, __account: 'u_bo', v: 2 },
    'collab-recovery:c': { __workspace: 'https://other.test', __account: 'u_ana', v: 3 },
    'collab-recovery:d': { __label: 'old, untagged' },
    'design-session': { __workspace: WORKSPACE, __account: 'u_ana' },
    'collab-recovery:e': { __recovery: { workspace: `${WORKSPACE}/`, account: 'u_ana' }, v: 5 },
  });
  const copies = await accountRecoveryCopies(state, WORKSPACE, 'u_ana');
  assert.deepEqual(copies.map((c) => c.slot), ['collab-recovery:a', 'collab-recovery:e']);
  assert.deepEqual(await accountRecoveryCopies(state, WORKSPACE, undefined), [], 'no account, no copies');
  const broken = { async list(): Promise<never> { throw new Error('blocked'); }, async load() { return null; } };
  assert.deepEqual(await accountRecoveryCopies(broken, WORKSPACE, 'u_ana'), [], 'unreadable storage counts as none');
});

// ── The chip ──────────────────────────────────────────────────────────────────

test('a member chip shows the name, says who is signed in where, and follows the inbox', () => {
  const h = harness();
  const off = mountAccountChip(slot(), h.deps);
  assert.equal(chip().dataset.accountChip, 'member');
  assert.equal(chip().textContent, 'Ana Ruiz');
  assert.equal(chip().getAttribute('aria-label'), 'Signed in to Acme as Ana Ruiz');
  assert.equal(chip().getAttribute('aria-haspopup'), 'menu');
  const dot = chip().querySelector<HTMLElement>('.org-account-chip-dot')!;
  assert.equal(dot.hidden, false, 'two unread messages: the dot shows');
  h.inbox.set(0);
  assert.equal(dot.hidden, true, 'read: the dot goes');
  off();
  assert.equal(document.querySelector('.org-account-chip'), null, 'cleanup removes the chip');
});

test('the menu carries the account actions, and the console only for someone with one', async () => {
  const h = harness();
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  assert.ok(menu(), 'the menu opens');
  assert.equal(chip().getAttribute('aria-expanded'), 'true');
  assert.equal(menu()!.querySelector('.org-account-menu-head')?.textContent, 'Signed in to Acme as Ana Ruiz');
  assert.equal(menu()!.querySelector('.org-account-menu-line')?.textContent, 'ana@acme.com');
  for (const name of ['inbox', 'projects', 'signins', 'signout', 'everywhere']) assert.ok(act(name), `${name} is offered`);
  assert.equal(act('console'), null, 'no console address, no console item');
  assert.match(act('signout')!.textContent!, /Signs you out on this device\./);
  assert.match(act('everywhere')!.textContent!, /Signs you out everywhere, including this device\./);
  click(act('projects')!);
  assert.deepEqual(h.went, ['#/p']);
  click(chip());
  click(act('signins')!);
  assert.deepEqual(h.went, ['#/p', '#/settings?focus=instance-section']);
  click(chip());
  click(act('inbox')!);
  assert.equal(h.inbox.opened, 1);
  off();

  const admin = harness({ consoleUrl: 'https://work.test/admin' });
  const offAdmin = mountAccountChip(slot(), admin.deps);
  click(chip());
  const link = act('console') as HTMLAnchorElement | null;
  assert.ok(link, 'an admin gets Workspace console');
  assert.equal(link!.getAttribute('href'), 'https://work.test/admin', 'an absolute address');
  assert.equal(link!.target, '_blank');
  assert.equal(link!.rel, 'noopener');
  assert.match(link!.textContent!, /Workspace console/);
  offAdmin();
});

test('a visitor gets only Sign in, and nothing at all without a way in', () => {
  const visitor = harness({ account: { workspace: 'Acme', member: null, inbox: null }, signInUrl: '/login?returnTo=%2F%23%2Fp' });
  const off = mountAccountChip(slot(), visitor.deps);
  const link = document.querySelector<HTMLAnchorElement>('a.org-account-chip')!;
  assert.equal(link.dataset.accountChip, 'visitor');
  assert.equal(link.getAttribute('href'), '/login?returnTo=%2F%23%2Fp');
  assert.equal(link.textContent, 'Sign in');
  off();
  const noWay = harness({ account: { workspace: 'Acme', member: null, inbox: null }, signInUrl: null });
  const into = slot();
  mountAccountChip(into, noWay.deps);
  assert.equal(into.childElementCount, 0, 'no sign-in address: no chip');
  const none = harness({ account: null });
  const empty = slot();
  mountAccountChip(empty, none.deps);
  assert.equal(empty.childElementCount, 0, 'dormant account: no chip');
});

test('registerAccountChip puts the chip in the header slot', async () => {
  _clearAccountSlotForTests();
  for (const n of document.querySelectorAll('.gallery-topright > :not(.profile-link)')) n.remove();
  const h = harness();
  const off = registerAccountChip(h.deps);
  const placed = document.querySelector('[data-account-slot] .org-account-chip');
  assert.ok(placed, 'the chip sits in the account slot');
  assert.equal(placed!.parentElement!.nextElementSibling?.className, 'profile-link');
  off();
  assert.equal(document.querySelector('[data-account-slot]'), null);
});

// ── Signing out ───────────────────────────────────────────────────────────────

test('Sign out with no recovery copies signs out at once', async () => {
  const h = harness({ slots: { 'collab-recovery:x': { __workspace: WORKSPACE, __account: 'someone-else' } } });
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  click(act('signout')!);
  await until(() => h.after === 1, 'the sign-out to finish');
  assert.equal(h.signOuts, 1);
  assert.equal(dialog(), null, 'nothing to ask about');
  assert.deepEqual(h.device.deleted, [], "another person's copy is left alone");
  off();
});

const MINE = {
  'collab-recovery:1': { __workspace: WORKSPACE, __account: 'u_ana', __label: 'Poster · Text' },
  'collab-recovery:2': { __workspace: WORKSPACE, __account: 'u_ana', __label: 'Poster · Image' },
};

test('with recovery copies, Discard removes them, then signs out', async () => {
  const h = harness({ slots: MINE });
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  click(act('signout')!);
  await until(() => !!dialog(), 'the recovery question');
  assert.equal(dialog()!.querySelector('.modal-title')?.textContent, 'Download or discard 2 recovery copies before signing out?');
  click(dialog()!.querySelector('[data-choice="discard"]')!);
  await until(() => h.after === 1, 'the sign-out to finish');
  assert.deepEqual(h.device.deleted.sort(), ['collab-recovery:1', 'collab-recovery:2']);
  assert.equal(h.signOuts, 1);
  assert.equal(h.downloads.length, 0);
  off();
});

test('with recovery copies, Download saves one file holding them all, keeps them, then signs out', async () => {
  const h = harness({ slots: MINE });
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  click(act('signout')!);
  await until(() => !!dialog(), 'the recovery question');
  click(dialog()!.querySelector('[data-choice="download"]')!);
  await until(() => h.after === 1, 'the sign-out to finish');
  assert.equal(h.downloads.length, 1);
  assert.equal(h.downloads[0]!.name, RECOVERY_COPIES_FILENAME);
  const saved = JSON.parse(h.downloads[0]!.text) as Array<{ __label: string }>;
  assert.deepEqual(saved.map((c) => c.__label).sort(), ['Poster · Image', 'Poster · Text']);
  assert.deepEqual(h.device.deleted, [], 'a download keeps the copies on the device');
  off();
});

test('with recovery copies, Cancel keeps the person signed in', async () => {
  const h = harness({ slots: MINE });
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  click(act('everywhere')!);
  await until(() => !!dialog(), 'the recovery question');
  click(dialog()!.querySelector('[data-act="cancel"]')!);
  await settle();
  assert.equal(h.signOuts + h.everywhere + h.after, 0, 'nothing signed out');
  assert.deepEqual(h.device.deleted, []);
  off();
});

test('Sign out on all devices uses its own route and then leaves', async () => {
  const h = harness();
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  click(act('everywhere')!);
  await until(() => h.after === 1, 'the sign-out to finish');
  assert.equal(h.everywhere, 1);
  assert.equal(h.signOuts, 0, 'the everywhere route does the whole job');
  off();
});

test('a failed sign-out, or no sign-out-everywhere route, stays signed in and says so', async () => {
  const h = harness({ signOut: false, everywhere: 'unsupported' });
  const off = mountAccountChip(slot(), h.deps);
  click(chip());
  click(act('signout')!);
  await until(() => !!menu()?.querySelector('.org-account-menu-error'), 'the failure line');
  assert.equal(menu()!.querySelector('[role="alert"]')?.textContent, 'Could not sign out. Try again.');
  assert.equal(h.after, 0);
  // The failure shows once: the next open is clean.
  click(chip());
  click(chip());
  assert.equal(menu()!.querySelector('.org-account-menu-error'), null);
  click(act('everywhere')!);
  await until(() => !!menu()?.querySelector('.org-account-menu-error'), 'the failure line');
  assert.equal(menu()!.querySelector('[role="alert"]')?.textContent, 'This workspace cannot sign you out on other devices yet.');
  assert.equal(h.after, 0, 'still signed in');
  off();
});
