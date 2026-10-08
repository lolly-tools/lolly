// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { subscribeCanvasRecovery } from '../lib/canvas-recovery.ts';
import { RECOVERY_OWNER_KEY, RECOVERY_SLOT_PREFIX, recoveryOrigin, recoveryOwner, withoutRecoveryOwner } from '../lib/collab-recovery-owner.ts';
import type { RecoveryOwner } from '../lib/collab-recovery-owner.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { navigateHistoryHref } from '../lib/history-navigation.ts';
import { configureNotifications, dismissNotification, notificationEntries, notificationsChanged, publishNotification, registerNotificationSource } from '../lib/notifications.ts';
import type { ShellNotification } from '../lib/notifications.ts';
import { tRaw } from '../i18n.ts';

/** A copy is removed from this device once it is older than this. */
export const RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/*
 * Each copy records who it belongs to under RECOVERY_OWNER_KEY (lib/collab-recovery-owner.ts,
 * the one reader and writer of that tag): the workspace it came from, the account that
 * made the edit (the member's workspace id, '' in a private pairing) and when it was
 * written. A save from the tool rewrites the slot without this key, so work the person
 * has since saved as their own is never listed here or removed by the age limit.
 */
type CopyData = Record<string, unknown>;
const TOOL_ID = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;
const openableTool = (data: CopyData): string | null =>
  typeof data.__toolId === 'string' && TOOL_ID.test(data.__toolId) ? data.__toolId : null;

type Scope = { origin: string; account: string };
/**
 * This tab's saved copies, by slot. They outlive the document they came from, so the
 * notice stays in the queue after the person leaves, until they dismiss the notice. Every read
 * lists only the copies of the workspace and account of the latest live document.
 */
const listed = new Map<string, { copy: CopyData; host: HostV1 | null | undefined }>();
let tabScope: (() => Scope) | null = null;
const dismissWatchers = new Set<(slot: string) => void>();
const ownedHere = (data: unknown): data is CopyData => {
  const owner = recoveryOwner(data), here = tabScope?.();
  return !!owner && !!here && recoveryOrigin(owner.origin) === here.origin && owner.account === here.account
    && Date.now() - Date.parse(owner.at) <= RECOVERY_MAX_AGE_MS;
};
function deliverCopy(host: HostV1 | null | undefined, data: CopyData): Promise<void> {
  const blob = new Blob([JSON.stringify(withoutRecoveryOwner(data), null, 2)], { type: 'application/json' });
  return host?.export?.download ? host.export.download(blob, 'lolly-recovery.json')
    : import('../bridge/export.ts').then(({ anchorSave }) => anchorSave(blob, 'lolly-recovery.json'));
}
/** Open a listed copy after reading it again. False when it is gone or no longer this account's. */
async function openListed(slot: string): Promise<boolean> {
  const item = listed.get(slot), data = await item?.host?.state?.load(slot);
  const toolId = ownedHere(data) ? openableTool(data) : null;
  // A copy that is gone, or that belongs to someone else, is never opened.
  if (!toolId) { if (listed.delete(slot)) notificationsChanged(); return false; }
  const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
  navigateHistoryHref(sessionOpenHref({ slot, toolId }, false));
  return true;
}
/** The queue's entries: Open recovery copy when the tool is known, and Download recovery copy always. */
function readListed(): ShellNotification[] {
  const entries: ShellNotification[] = [];
  for (const [slot, { copy, host }] of listed) {
    if (!ownedHere(copy)) continue;
    const download = { label: tRaw('Download recovery copy'), run: () => deliverCopy(host, copy) };
    entries.push({ id: slot, title: tRaw('Interrupted edit saved on this device.'), tone: 'action',
      body: tRaw('Your interrupted edit is saved as a separate copy on this device. Accepted changes are already in the shared document.'),
      ...(openableTool(copy) ? { action: { label: tRaw('Open recovery copy'), run: () => openListed(slot).then(() => {}) }, secondary: download } : { action: download }),
      onDismiss: () => { for (const watch of [...dismissWatchers]) watch(slot); } });
  }
  return entries;
}

/** TEST-ONLY: forget this tab's listed copies. */
export function _resetRecoveryCopiesForTests(): void {
  listed.clear(); tabScope = null; dismissWatchers.clear();
}

/**
 * A new Library slot keeps interrupted work separate from the room and earlier saves.
 * The notice stays until the person dismisses it, and the account's copies stay in the
 * notification queue, after the document closes too, with Open and Download. `account`
 * reads the member's workspace id in the live room (`self.account`, the same id Sign out
 * looks copies up by); another account's or workspace's copies
 * are never listed or opened, and copies older than 30 days are removed.
 */
export function mountCollabRecovery(runtime: object, host: HostV1 | null | undefined, parent: HTMLElement,
  capture: () => { state: Record<string, unknown>; label?: string }, account: () => string | undefined = () => undefined) {
  const doc = parent.ownerDocument, win = doc.defaultView;
  const root = doc.createElement('div'); root.className = 'collab-recovery'; root.hidden = true;
  const status = doc.createElement('span'); status.setAttribute('role', 'status');
  const control = (label: string): HTMLButtonElement => {
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'btn btn--sm'; button.textContent = label; return button;
  };
  const open = control(tRaw('Open recovery copy')), download = control(tRaw('Download recovery copy')), dismiss = control(tRaw('Dismiss'));
  open.hidden = true;
  root.append(status, open, download, dismiss); parent.append(root);
  root.setAttribute('data-export-hide', '');
  let disposed = false, latest: { slot: string; copy: CopyData } | undefined, generation = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Notices for copies that could not be saved: they live as long as this document. */
  const notices = new Map<string, () => void>();
  const scope = (): Scope => ({ origin: recoveryOrigin(getInstanceBase() || win?.location.origin || ''), account: account() ?? '' });
  // This document's account decides which copies the queue lists, from now on.
  tabScope = scope;
  registerNotificationSource('collab-recovery', readListed);
  const owns = (data: unknown): data is CopyData => {
    const owner = recoveryOwner(data), here = scope();
    return !!owner && recoveryOrigin(owner.origin) === here.origin && owner.account === here.account;
  };
  const shown = (id: string): boolean => !!latest && (id === latest.slot || id === `${latest.slot}:unsaved`);
  const watch = (slot: string): void => { if (shown(slot)) root.hidden = true; };
  dismissWatchers.add(watch);
  const notify = (id: string, entry: Omit<ShellNotification, 'id' | 'onDismiss'>): void => {
    notices.get(id)?.();
    notices.set(id, publishNotification({ ...entry, id, onDismiss: () => { watch(id); } }));
  };
  const withdraw = (id: string): void => { notices.get(id)?.(); notices.delete(id); };
  const listCopy = (slot: string, data: CopyData): void => {
    listed.set(slot, { copy: data, host }); notificationsChanged();
  };
  // Unreadable storage leaves the notice and its queued copy in place to try again.
  open.addEventListener('click', () => {
    const slot = latest?.slot;
    if (slot) openListed(slot).then(opened => { if (!opened && !disposed && latest?.slot === slot) open.hidden = true; }, () => {});
  });
  download.addEventListener('click', () => {
    if (!latest) return;
    void deliverCopy(host, latest.copy).catch(() => { if (!disposed) status.textContent = tRaw('Recovery download failed. Try again.'); });
  });
  dismiss.addEventListener('click', () => {
    root.hidden = true;
    if (latest) for (const id of [latest.slot, `${latest.slot}:unsaved`]) dismissNotification(id);
  });
  void configureNotifications();
  const off = subscribeCanvasRecovery(runtime, draft => {
    const ticket = ++generation, current = capture(), slot = `${RECOVERY_SLOT_PREFIX}${draft.id}`, unsaved = `${slot}:unsaved`;
    clearTimeout(retry);
    const copy: CopyData = { ...current.state, ...draft.values, __label: `${current.label ?? 'Canvas'} · ${draft.label}`,
      [RECOVERY_OWNER_KEY]: { ...scope(), at: new Date().toISOString() } satisfies RecoveryOwner };
    latest = { slot, copy }; root.hidden = false; open.hidden = true; status.textContent = tRaw('Saving an interrupted edit on this device…');
    let attempts = 0;
    async function save(): Promise<void> {
      if (disposed || ticket !== generation) return;
      let retryable = true;
      try {
        if (!host?.state) throw new Error('Device storage unavailable');
        const stored = await host.state.load(slot);
        // The first copy of a draft wins, and a slot another account holds is never written over.
        if (stored && !owns(stored)) { retryable = false; throw new Error('Recovery slot is held by another account'); }
        if (!stored) await host.state.save(slot, copy);
        if (disposed || ticket !== generation) return;
        const kept = owns(stored) ? stored : copy;
        latest = { slot, copy: kept }; status.textContent = tRaw('Interrupted edit saved on this device.');
        open.hidden = !openableTool(kept); withdraw(unsaved); listCopy(slot, kept);
        // A copy the person already dismissed (a replay after a remount) keeps its notice closed.
        if (notificationEntries().some(entry => entry.id === slot && entry.dismissed)) root.hidden = true;
      } catch {
        if (disposed || ticket !== generation) return;
        status.textContent = tRaw('Recovery copy could not be saved here. Download the recovery copy.');
        if (!notices.has(unsaved)) notify(unsaved, { title: tRaw('Recovery copy could not be saved here. Download the recovery copy.'),
          tone: 'warning', action: { label: tRaw('Download recovery copy'), run: () => deliverCopy(host, copy) } });
        if (retryable && ++attempts < 4) retry = setTimeout(() => { void save(); }, 2_000 * attempts);
      }
    }
    void save();
  });
  // Off the mount path: list this account's earlier copies and remove expired ones.
  const scan = setTimeout(() => { void listEarlierCopies(); }, 0);
  async function listEarlierCopies(): Promise<void> {
    const state = host?.state;
    if (!state?.list) return;
    let entries: Awaited<ReturnType<typeof state.list>>;
    try { entries = await state.list(); } catch { return; }
    const now = Date.now();
    for (const { slot } of entries) {
      if (disposed) return;
      if (!slot.startsWith(RECOVERY_SLOT_PREFIX) || listed.has(slot)) continue;
      try {
        const data = await state.load(slot), owner = recoveryOwner(data);
        if (!owner) continue;
        if (now - Date.parse(owner.at) > RECOVERY_MAX_AGE_MS) await state.delete(slot);
        else if (!disposed && owns(data) && !listed.has(slot)) listCopy(slot, data);
      } catch { /* One unreadable copy leaves the rest listed. */ }
    }
  }
  return { teardown() {
    // Saved copies stay listed until dismissed; only this document's unsaved warnings go.
    disposed = true; clearTimeout(retry); clearTimeout(scan); off(); dismissWatchers.delete(watch);
    for (const stop of notices.values()) stop();
    notices.clear(); root.remove();
  } };
}
