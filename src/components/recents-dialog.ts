// SPDX-License-Identifier: MPL-2.0
/**
 * The thin recents dialog (plans/133 WP-10) - what the gallery's history fab
 * opens now that Projects is the ONE folder manager. It shows the downloads
 * log's reopen rail (lib/export-history.ts, the same tiles the /p root rail
 * renders) over a single "Manage in Projects" hand-off, and manages nothing
 * itself: no folders, no delete, no move. The full manager UI lives in /p;
 * the batch view keeps folder-overlay.ts for its functional open-a-folder-
 * into-the-grid workflow, which is a different job.
 */
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { mountModal } from './modal.ts';

/** A saved session offered for one-click resume (plans/142 W4): the slot's
 *  entry as the gallery already holds it. `name` is the display caption (the
 *  session's filename or its tool's name). */
export interface RecentsSession { slot: string; toolId: string; name: string; thumb?: string | null; updatedAt?: string }

export async function openRecentsDialog(opts: { savedCount?: number; sessions?: RecentsSession[] } = {}): Promise<void> {
  const { getHostRef } = await import('../lib/host-ref.ts');
  const state = getHostRef()?.state as import('../bridge/state.ts').WebStateAPI | undefined;
  if (state?.history) {
    const { openHistoryPanel } = await import('./history-panel.ts');
    openHistoryPanel({ state });
    return;
  }
  let rail = '';
  try {
    const { listExports, exportReopenHref } = await import('../lib/export-history.ts');
    const recents = (await listExports(12))
      .filter(x => x.thumb)
      .map(x => ({ href: exportReopenHref(x), thumb: x.thumb!, caption: x.filename || x.label, at: x.at }));
    rail = recents.length ? `
      <div class="folder-exports">
        <h3 class="folder-exports-title">${t('Recent exports')}</h3>
        <div class="folder-exports-rail">
          ${recents.map(x => `
            ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - exportReopenHref() builds a fixed '#/tool/<id>' hash route */ ''}
            <a class="folder-export-tile" href="${escape(x.href)}" data-open-export
               title="${escape(x.caption)} · ${escape(new Date(x.at).toLocaleDateString())}">
              <img src="${escape(x.thumb)}" alt="${escape(x.caption)}" loading="lazy">
            </a>`).join('')}
        </div>
      </div>` : '';
  } catch { /* history is best-effort - the hand-off below still stands */ }

  // Saved sessions, resumable in ONE click (plans/142 W4): the operator coming
  // back for a half-done session should not be handed off to Projects first.
  // Same tile shape as the exports rail; sessions without a thumb still list
  // (caption-only tile), and the Projects hand-off below stays the manager.
  let sessionsRail = '';
  try {
    const sessions = (opts.sessions ?? []).slice(0, 8);
    if (sessions.length) {
      const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
      const { isBatchSlot } = await import('../lib/batch-slots.ts');
      sessionsRail = `
      <div class="folder-exports recents-sessions">
        <h3 class="folder-exports-title">${t('Saved sessions')}</h3>
        <div class="folder-exports-rail">
          ${sessions.map(s => `
            ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - sessionOpenHref() builds a fixed in-app route */ ''}
            <a class="folder-export-tile" href="${escape(sessionOpenHref(s, isBatchSlot(s.slot)))}" data-open-session-tile
               title="${escape(s.name)}${s.updatedAt ? ` · ${escape(new Date(s.updatedAt).toLocaleDateString())}` : ''}">
              ${s.thumb ? `<img src="${escape(s.thumb)}" alt="${escape(s.name)}" loading="lazy">`
                        : `<span class="folder-export-tile-caption">${escape(s.name)}</span>`}
            </a>`).join('')}
        </div>
      </div>`;
    }
  } catch { /* sessions rail is best-effort - the hand-off below still stands */ }

  const saved = opts.savedCount ?? 0;
  const modal = mountModal(`
    <div class="recents-dialog">
      <div class="recents-dialog-head">
        <h2 class="recents-dialog-title">${t('Your recent work')}</h2>
        <button type="button" class="recents-dialog-close" data-recents-close
          aria-label="${escape(t('Close'))}">&#x2715;</button>
      </div>
      ${sessionsRail}
      ${rail || (sessionsRail ? '' : `<p class="recents-dialog-empty">${t('Exports you download will show here for quick reopening.')}</p>`)}
      <a class="btn recents-dialog-go" href="#/p">${saved
        ? tRaw('Manage {n} saved sessions in Projects', { n: saved })
        : t('Open Projects')}</a>
    </div>`,
  { className: 'tool-meta-dialog recents-modal' });
  // Any navigation out of the dialog (a reopen tile, the Projects hand-off)
  // closes it - the destination view takes over.
  modal.el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a[href]')) modal.close();
  });
  modal.el.querySelector('[data-recents-close]')?.addEventListener('click', () => modal.close());
}
