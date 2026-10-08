// SPDX-License-Identifier: MPL-2.0

export interface ShellNotification {
  id: string;
  title: string;
  body?: string;
  tone?: 'info' | 'warning' | 'action';
  action?: { label: string; href?: string; run?(): void | Promise<void> };
  /** A second way to act, shown beside the action (for example, Download beside Open). */
  secondary?: { label: string; run(): void | Promise<void> };
  dismissible?: boolean;
  reminder?: boolean;
  onDismiss?(): void;
}
export interface NotificationEntry extends ShellNotification { dismissed: boolean; until: number; }
type Preference = { dismissed: boolean; until: number };
const entries = new Map<string, ShellNotification>();
const sources = new Map<string, () => readonly ShellNotification[]>();
const preferences = new Map<string, Preference>();
const listeners = new Set<() => void>();
const touched = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
export interface NotificationPreferencesStore { read(): Promise<unknown>; write(value: unknown): Promise<void>; }
const chromeStore: NotificationPreferencesStore = {
  read: async () => JSON.parse(localStorage.getItem(KEY) ?? 'null'),
  write: async value => { localStorage.setItem(KEY, JSON.stringify(value)); },
};
let storage: NotificationPreferencesStore | undefined;
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
const KEY = 'lolly:notification-preferences';

/** Chrome preferences contain dismissal flags and deadlines, never message content or tool state. */
export function configureNotifications(state: NotificationPreferencesStore = chromeStore): Promise<void> {
  if (storage === state && loading) return loading;
  storage = state;
  loading = state.read().then(value => {
    if (storage !== state || !Array.isArray(value)) return;
    for (const row of value.slice(-200)) {
      if (!row || typeof row.id !== 'string' || row.id.length > 2048 || touched.has(row.id)) continue;
      preferences.set(row.id, { dismissed: row.dismissed === true, until: Number.isFinite(row.until) ? row.until : 0 });
    }
    changed();
  }).catch(() => { /* Unavailable storage leaves the queue usable in this tab. */ });
  return loading;
}

export function notificationEntries(now = Date.now()): NotificationEntry[] {
  const all = new Map(entries);
  for (const read of sources.values()) for (const entry of read()) all.set(entry.id, entry);
  return [...all.values()].map(entry => {
    const preference = entry.dismissible === false ? undefined : preferences.get(entry.id);
    return { ...entry, dismissed: preference?.dismissed === true, until: (preference?.until ?? 0) > now ? preference!.until : 0 };
  });
}
export const notificationCount = (): number => notificationEntries().filter(entry => !entry.dismissed && !entry.until).length;
export function onNotificationsChange(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function notificationsChanged(): void { changed(); }
export function registerNotificationSource(id: string, read: () => readonly ShellNotification[]): () => void {
  sources.set(id, read); changed();
  return () => { if (sources.get(id) === read) { sources.delete(id); changed(); } };
}
export function publishNotification(entry: ShellNotification): () => void {
  entries.set(entry.id, entry);
  while (entries.size > 200) entries.delete(entries.keys().next().value!);
  changed();
  return () => { if (entries.get(entry.id) === entry) { entries.delete(entry.id); changed(); } };
}
export function dismissNotification(id: string): void {
  const entry = notificationEntries().find(item => item.id === id);
  if (!entry || entry.dismissible === false) return;
  entry.onDismiss?.();
  preferences.set(id, { dismissed: true, until: 0 }); touched.add(id); persist(); changed();
}
export function delayNotification(id: string, until: number): void {
  const entry = notificationEntries().find(item => item.id === id);
  if (!entry?.reminder || entry.dismissible === false || !Number.isFinite(until)) return;
  preferences.set(id, { dismissed: false, until: Math.max(Date.now(), until) }); touched.add(id); persist(); changed();
}
export function restoreNotification(id: string): void {
  preferences.delete(id); touched.add(id); persist(); changed();
}
function persist(): void {
  const state = storage;
  if (!state) return;
  while (preferences.size > 200) preferences.delete(preferences.keys().next().value!);
  const ready = loading;
  writes = writes.then(async () => {
    await ready;
    if (storage === state) await state.write([...preferences].slice(-200).map(([id, preference]) => ({ id, ...preference })));
  }).catch(() => { /* Keep the current tab's choices. */ });
}
function changed(): void {
  if (timer) clearTimeout(timer);
  const deadlines = notificationEntries().filter(entry => !entry.dismissed && entry.until).map(entry => entry.until);
  timer = deadlines.length ? setTimeout(changed, Math.min(2_147_483_647, Math.max(1, Math.min(...deadlines) - Date.now()))) : undefined;
  if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
  for (const listener of listeners) { try { listener(); } catch { /* Other views still receive the update. */ } }
}
export function _resetNotificationsForTests(): void {
  if (timer) clearTimeout(timer);
  timer = undefined; entries.clear(); sources.clear(); preferences.clear(); touched.clear(); listeners.clear();
  storage = undefined; loading = undefined; writes = Promise.resolve();
}
