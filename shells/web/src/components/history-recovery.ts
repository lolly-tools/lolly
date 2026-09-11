// SPDX-License-Identifier: MPL-2.0
import type { RevisionHistoryAPI } from '../bridge/revision-history.ts';
import type { RecoveryEntry } from '../bridge/revision-recovery.ts';
import { t } from '../i18n.ts';
import { navigateHistoryHref } from '../lib/history-navigation.ts';

/** Recovery has its own small, metadata-only page so abandoned drafts remain
 * reachable even before their first visible checkpoint. */
export function mountHistoryRecovery(container: HTMLElement, history: RevisionHistoryAPI, opts: {
  slot(): string | null | undefined; emptyScope(): boolean; error(message: string): void; opened(): void;
}): { refresh(): Promise<void>; update(): Promise<void>; dispose(): void } {
  const heading = document.createElement('h3'); heading.textContent = t('Protected drafts');
  const list = document.createElement('div'); list.className = 'revision-history-list';
  const more = document.createElement('button'); more.type = 'button'; more.className = 'btn'; more.textContent = t('Load older drafts');
  container.className = 'revision-history-recovery'; container.append(heading, list, more); container.hidden = true;
  let closed = false, request = 0, before: string | undefined;
  const updates = new Map<string, (entry: RecoveryEntry) => void>();
  const row = (entry: RecoveryEntry): HTMLElement => {
    const article = document.createElement('article'); article.className = 'revision-history-draft';
    const name = document.createElement('strong'); name.textContent = entry.label;
    const date = document.createElement('time'); date.dateTime = entry.at; date.textContent = new Date(entry.at).toLocaleString();
    const note = document.createElement('p'); note.textContent = entry.diverged ? t('Separate edits kept after another tab or import changed this creation.') : t('Latest edits, protected between checkpoints.');
    updates.set(entry.id, next => {
      Object.assign(entry, next); name.textContent = entry.label;
      date.dateTime = entry.at; date.textContent = new Date(entry.at).toLocaleString();
      note.textContent = entry.diverged ? t('Separate edits kept after another tab or import changed this creation.') : t('Latest edits, protected between checkpoints.');
    });
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn'; copy.textContent = t('Open draft as a copy');
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      try {
        const data = await history.recovery.read(entry.id);
        if (!data) throw new Error(t('This draft has already been replaced by a checkpoint. Refresh History.'));
        const slot = `${entry.toolId}:${crypto.randomUUID()}`, label = `${entry.label} (${t('recovered copy')})`;
        await history.checkpoint(slot, { ...data, __label: label, __export_filename: label }, { reason: 'save', expectedHead: null });
        const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
        opts.opened(); navigateHistoryHref(sessionOpenHref({ slot, toolId: entry.toolId }, false));
      } catch (error) { opts.error(error instanceof Error ? error.message : t('Could not open this draft.')); copy.disabled = false; }
    });
    article.append(name, date, note, copy); return article;
  };
  const load = async (append = false): Promise<void> => {
    const token = ++request; more.disabled = true;
    if (!append) { before = undefined; updates.clear(); list.replaceChildren(); }
    try {
      const page = opts.emptyScope() ? { entries: [] } : await history.recovery.list({ slot: opts.slot() ?? undefined, before, limit: 20 });
      if (closed || token !== request) return;
      for (const entry of page.entries) if (!entry.slot.startsWith('__trash__:')) list.append(row(entry));
      before = page.before; more.hidden = !before; container.hidden = !list.childElementCount && !before;
    } catch (error) { if (!closed && token === request) opts.error(error instanceof Error ? error.message : t('Could not load drafts.')); }
    finally { if (token === request) more.disabled = false; }
  };
  more.addEventListener('click', () => { void load(true); });
  return { refresh: () => load(), async update() {
    const token = request;
    try {
      const page = await history.recovery.list({ slot: opts.slot() ?? undefined, limit: 20 });
      if (!closed && token === request) for (const entry of page.entries) updates.get(entry.id)?.(entry);
    } catch { /* the explicit Refresh action reports read failures */ }
  }, dispose() { closed = true; request++; updates.clear(); container.remove(); } };
}
