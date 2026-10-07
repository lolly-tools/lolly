// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { subscribeCanvasRecovery } from '../lib/canvas-recovery.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { navigateHistoryHref } from '../lib/history-navigation.ts';
import { configureNotifications, dismissNotification, notificationEntries, publishNotification } from '../lib/notifications.ts';
import type { ShellNotification } from '../lib/notifications.ts';
import { tRaw } from '../i18n.ts';

/** Library slot prefix of an interrupted-edit copy; the rest of the slot is the draft id. */
export const RECOVERY_SLOT_PREFIX = 'collab-recovery:';
/** A copy is removed from this device once it is older than this. */
export const RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * The key under which each copy records who it belongs to: the workspace it came from,
 * the account that made the edit ('' in a private pairing) and when it was written. A
 * save from the tool rewrites the slot without this key, so work the person has since
 * saved as their own is never listed here or removed by the age limit.
 */
export const RECOVERY_OWNER_KEY = '__collabRecovery';
export interface RecoveryOwner { origin: string; account: string; at: string }
type CopyData = Record<string, unknown>;
const TOOL_ID = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;

export function recoveryOwner(data: unknown): RecoveryOwner | null {
  const value = data && typeof data === 'object' ? (data as CopyData)[RECOVERY_OWNER_KEY] : undefined;
  if (!value || typeof value !== 'object') return null;
  const { origin, account, at } = value as CopyData;
  return typeof origin === 'string' && typeof account === 'string' && typeof at === 'string' && Number.isFinite(Date.parse(at))
    ? { origin, account, at } : null;
}
const openableTool = (data: CopyData): string | null =>
  typeof data.__toolId === 'string' && TOOL_ID.test(data.__toolId) ? data.__toolId : null;

/**
 * A new Library slot keeps interrupted work separate from the room and earlier saves.
 * The notice stays until the person dismisses it, and the account's copies stay in the
 * notification queue while a live document is open. `account` reads the signed-in
 * account of the live room; another account's or workspace's copies are never listed
 * or opened, and copies older than 30 days are removed.
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
  const notices = new Map<string, () => void>();
  const scope = () => ({ origin: getInstanceBase() || win?.location.origin || '', account: account() ?? '' });
  const owns = (data: unknown): data is CopyData => {
    const owner = recoveryOwner(data), here = scope();
    return !!owner && owner.origin === here.origin && owner.account === here.account;
  };
  const shown = (id: string): boolean => !!latest && (id === latest.slot || id === `${latest.slot}:unsaved`);
  const deliver = (data: CopyData): Promise<void> => {
    const blob = new Blob([JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key]) => key !== RECOVERY_OWNER_KEY)), null, 2)], { type: 'application/json' });
    return host?.export?.download ? host.export.download(blob, 'lolly-recovery.json')
      : import('../bridge/export.ts').then(({ anchorSave }) => anchorSave(blob, 'lolly-recovery.json'));
  };
  const notify = (id: string, entry: Omit<ShellNotification, 'id' | 'onDismiss'>): void => {
    notices.get(id)?.();
    notices.set(id, publishNotification({ ...entry, id, onDismiss: () => { if (shown(id)) root.hidden = true; } }));
  };
  const withdraw = (id: string): void => { notices.get(id)?.(); notices.delete(id); };
  async function openCopy(slot: string): Promise<void> {
    const data = await host?.state?.load(slot);
    const toolId = owns(data) ? openableTool(data) : null;
    // A copy that is gone, or that belongs to someone else, is never opened.
    if (disposed || !toolId) { withdraw(slot); if (latest?.slot === slot) open.hidden = true; return; }
    const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
    navigateHistoryHref(sessionOpenHref({ slot, toolId }, false));
  }
  const listCopy = (slot: string, data: CopyData): void => {
    notify(slot, { title: tRaw('Interrupted edit saved on this device.'), tone: 'action',
      body: tRaw('Your interrupted edit is saved as a separate copy on this device. Accepted changes are already in the shared document.'),
      action: openableTool(data) ? { label: tRaw('Open recovery copy'), run: () => openCopy(slot) }
        : { label: tRaw('Download recovery copy'), run: () => deliver(data) } });
  };
  // Unreadable storage leaves the notice and its queued copy in place to try again.
  open.addEventListener('click', () => { if (latest) openCopy(latest.slot).catch(() => {}); });
  download.addEventListener('click', () => {
    if (!latest) return;
    void deliver(latest.copy).catch(() => { if (!disposed) status.textContent = tRaw('Recovery download failed. Try again.'); });
  });
  dismiss.addEventListener('click', () => {
    root.hidden = true;
    for (const id of [...notices.keys()]) if (shown(id)) dismissNotification(id);
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
          tone: 'warning', action: { label: tRaw('Download recovery copy'), run: () => deliver(copy) } });
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
      if (!slot.startsWith(RECOVERY_SLOT_PREFIX) || notices.has(slot)) continue;
      try {
        const data = await state.load(slot), owner = recoveryOwner(data);
        if (!owner) continue;
        if (now - Date.parse(owner.at) > RECOVERY_MAX_AGE_MS) await state.delete(slot);
        else if (!disposed && owns(data) && !notices.has(slot)) listCopy(slot, data);
      } catch { /* One unreadable copy leaves the rest listed. */ }
    }
  }
  return { teardown() {
    disposed = true; clearTimeout(retry); clearTimeout(scan); off();
    for (const stop of notices.values()) stop();
    notices.clear(); root.remove();
  } };
}
