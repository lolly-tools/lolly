// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — saved-sessions popover.
 *
 * The anchored popover that lists saved batch sessions, saves the current grid,
 * and hosts the offline-CSV + Folders entry points. It reads/writes the batch
 * through the small typed context index.ts hands it — index still owns the grid
 * closure and the applySnapshot / dirty-tracking primitives; the CSV, folders,
 * and file-upload actions are injected as callbacks so this module stays a pure
 * popover with no cross-imports.
 */
import type { SessionStore, SessionStateInput, BatchSnapshot } from './sessions.ts';

/** What index.ts hands the sessions popover: the store, state, and action hooks. */
export interface SessionsViewContext {
  sessions: SessionStore;
  /** The live batch state slice a snapshot save reads. */
  state: SessionStateInput;
  showProgress(html: string): void;
  /** Replace the grid with a loaded snapshot. */
  applySnapshot(data: BatchSnapshot): Promise<void>;
  /** Mark the batch clean (a save makes it clean). */
  markClean(): void;
  /** Navigate back to the tools home (used by "save & leave"). */
  goHome(): void;
  /** Trigger the offline-CSV download (csv-io). */
  exportCsv(): void;
  /** Open the OS file picker for CSV upload (the hidden file input). */
  openCsvUpload(): void;
  /** Open the folder overlay (folder-actions). */
  openFolders(): void;
  /** Whether the shell provided a folder overlay (drives the Folders… button). */
  foldersEnabled: boolean;
}

/** Sessions-popover operations bound to one mounted /pro view. */
export interface SessionsView {
  openSessions(anchorEl: HTMLElement): Promise<void>;
  closeSessions(): void;
  /** Arm the one-shot "leave after the next save" intent (leave-guard flow). */
  armLeaveAfterSave(): void;
}

export function createSessionsView(ctx: SessionsViewContext): SessionsView {
  const { sessions, state } = ctx;

  let leaveAfterSave = false;
  let sessPop: HTMLElement | null = null;
  let sessOutside: ((e: PointerEvent) => void) | null = null;

  function closeSessions(): void {
    leaveAfterSave = false;                   // abandoning the popover cancels "save & leave"
    if (sessOutside) { document.removeEventListener('pointerdown', sessOutside); sessOutside = null; }
    if (sessPop) { sessPop.remove(); sessPop = null; }
  }

  function armLeaveAfterSave(): void { leaveAfterSave = true; }

  async function openSessions(anchorEl: HTMLElement): Promise<void> {
    closeSessions();
    const pop = document.createElement('div');
    pop.className = 'pro-popover pro-popover--sessions';
    document.body.appendChild(pop);
    sessPop = pop;
    await drawSessions(pop);
    const r = anchorEl.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
    pop.style.left = `${Math.round(Math.min(r.left + window.scrollX, window.innerWidth - 320))}px`;
    const onOutside = (e: PointerEvent): void => { if (!(e.target instanceof Node) || !pop.contains(e.target)) closeSessions(); };
    sessOutside = onOutside;
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
  }

  // (Re)render the popover body — the saved list plus the save-current control.
  async function drawSessions(pop: HTMLElement): Promise<void> {
    const list = await sessions.list();
    pop.innerHTML = `
      <div class="pro-popover-title">Batch sessions</div>
      ${list.length ? `<ul class="pro-sess-list">${list.map(s => `
        <li class="pro-sess-item">
          <button type="button" class="pro-sess-load" data-load="${escapeHtml(s.slot)}" data-name="${escapeHtml(s.name)}" title="Load “${escapeHtml(s.name)}”">
            <span class="pro-sess-name">${escapeHtml(s.name)}</span>
            <span class="pro-sess-when">${escapeHtml(relTime(s.updatedAt))}</span>
          </button>
          <button type="button" class="pro-sess-del" data-del="${escapeHtml(s.slot)}" title="Delete" aria-label="Delete ${escapeHtml(s.name)}">✕</button>
        </li>`).join('')}</ul>`
        : `<p class="pro-sess-empty">No saved sessions yet — save the current grid below.</p>`}
      <div class="pro-sess-save">
        <input type="text" class="pro-sess-input" placeholder="Session name" value="${escapeHtml((state.zipName ?? '').trim())}" autocomplete="off" spellcheck="false" maxlength="60">
        <button type="button" class="pro-btn pro-btn--primary" data-save>Save</button>
      </div>
      <div class="pro-sess-csv">
        <span class="pro-sess-csv-label">Offline CSV</span>
        <button type="button" class="pro-btn" data-csv-export title="Download this batch as a CSV to edit in any spreadsheet">↓ Download</button>
        <button type="button" class="pro-btn" data-csv-import title="Load a batch from a CSV / TSV file">↑ Upload</button>
      </div>
      ${ctx.foldersEnabled ? `<div class="pro-sess-folders">
        <button type="button" class="pro-btn" data-folders title="Organize sessions into folders and open a folder in the grid">📁 Folders…</button>
      </div>` : ''}`;

    pop.querySelector('[data-folders]')?.addEventListener('click', () => ctx.openFolders());

    // CSV download/upload (offline round-trip). The hidden file input persists
    // outside the popover so the OS dialog survives the popover closing.
    pop.querySelector('[data-csv-export]')?.addEventListener('click', () => ctx.exportCsv());
    pop.querySelector('[data-csv-import]')?.addEventListener('click', () => ctx.openCsvUpload());

    pop.querySelectorAll<HTMLElement>('[data-load]').forEach(btn => btn.addEventListener('click', async () => {
      const slot = btn.dataset.load ?? '';
      const data = await sessions.load(slot);
      if (!data) { ctx.showProgress(`<p class="pro-progress-msg pro-log-err">That session couldn't be loaded.</p>`); return; }
      await ctx.applySnapshot(data);
      closeSessions();
      ctx.showProgress(`<p class="pro-progress-msg">Loaded session “${escapeHtml(btn.dataset.name)}”.</p>`);
    }));

    pop.querySelectorAll<HTMLElement>('[data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await sessions.delete(btn.dataset.del ?? '');
      await drawSessions(pop);
    }));

    const input = pop.querySelector<HTMLInputElement>('.pro-sess-input');
    if (!input) return;
    const doSave = async (): Promise<void> => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      if (!state.rows.some(r => r.toolId)) {
        ctx.showProgress(`<p class="pro-progress-msg">Pick at least one template before saving a session.</p>`);
        return;
      }
      await sessions.save(name, state);
      ctx.markClean();                        // saving makes the batch clean
      if (leaveAfterSave) { closeSessions(); ctx.goHome(); return; }
      await drawSessions(pop);
      pop.querySelector<HTMLInputElement>('.pro-sess-input')?.focus();
      ctx.showProgress(`<p class="pro-progress-msg">Saved session “${escapeHtml(name)}”.</p>`);
    };
    pop.querySelector('[data-save]')?.addEventListener('click', () => { void doSave(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void doSave(); } });
  }

  return { openSessions, closeSessions, armLeaveAfterSave };
}

function relTime(iso: string): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
}
