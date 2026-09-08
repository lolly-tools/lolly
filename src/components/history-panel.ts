// SPDX-License-Identifier: MPL-2.0
import type { SavedStateData, WebStateAPI } from '../bridge/state.ts';
import type { RevisionEntry } from '../bridge/revision-history.ts';
import type { CollabHistoryCapability, CollabHistoryEntry } from '../lib/collab-history.ts';
import type { HistoryWireEntry } from '../collab/history-exchange.ts';
import { mountHistoryRecovery } from './history-recovery.ts';
import { navigateHistoryHref, bindHistoryLink } from '../lib/history-navigation.ts';
import type { AutomaticHistory } from '../views/automatic-history.ts';
import { requestDock, releaseDock, isDocked } from '../lib/edge-dock.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';
import './history-panel.css';

let closeActive: (() => void) | undefined;

/** One app-owned panel; opening another scope replaces its contents, never adds
 * a second column. Metadata is paged; payloads load only on an explicit action. */
export function openHistoryPanel(opts: {
  state: WebStateAPI;
  slot?: () => string | null;
  controller?: AutomaticHistory;
  collab?: CollabHistoryCapability;
  /** The negotiated peer history (plan 221 section 9): list the peer's shared revisions and
   *  fetch one as a new local copy. Present only in a collab that agreed the capability. */
  peer?: {
    list(): Promise<readonly HistoryWireEntry[]>;
    fetch(revisionId: string): Promise<SavedStateData>;
  };
}): () => void {
  closeActive?.();
  const history = opts.state.history;
  if (!history && !opts.collab) return () => {};
  const returnFocus = document.activeElement as HTMLElement | null;
  const panel = document.createElement('section');
  panel.className = 'revision-history-panel';
  panel.setAttribute('aria-label', t('History'));
  const head = document.createElement('header');
  const title = document.createElement('h2'); title.textContent = t('History');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn';
  close.textContent = t('Close');
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'btn'; refresh.textContent = t('Refresh');
  const loadPeer = document.createElement('button'); loadPeer.type = 'button'; loadPeer.className = 'btn'; loadPeer.textContent = t('Load from peer'); loadPeer.hidden = !opts.peer;
  head.append(title, refresh, ...(opts.peer ? [loadPeer] : []), close);
  const scope = document.createElement('select');
  scope.className = 'field-select'; scope.setAttribute('aria-label', t('History scope'));
  if (opts.slot) scope.add(new Option(t('This creation'), 'document'));
  scope.add(new Option(t('All history on this device'), 'all'));
  // The status line only ever shows a genuine error or the collab-only ephemerality
  // note now: the routine "Checkpoint saved at…" and the local how-it-works blurb are
  // inferable from the checkpoint rows below, so they are not rendered.
  const status = document.createElement('p'); status.className = 'revision-history-status'; status.setAttribute('role', 'status'); status.hidden = true;
  const showError = (message: string): void => { status.textContent = message; status.hidden = false; };
  const note = document.createElement('p'); note.className = 'revision-history-note';
  if (opts.collab) note.textContent = opts.collab.scope === 'memory'
    ? t('This session history lives in memory. Save a copy to keep a checkpoint on this device.')
    : t('These checkpoints are shared with the collaboration session. Restore is available to writers.');
  const list = document.createElement('div'); list.className = 'revision-history-list';
  const peerList = document.createElement('div'); peerList.className = 'revision-history-list revision-history-peer';
  const more = document.createElement('button'); more.type = 'button'; more.className = 'btn'; more.textContent = t('Load older history'); more.hidden = true;
  const projects = document.createElement('a'); projects.className = 'btn'; projects.href = '#/p'; projects.textContent = t('Open Projects');
  const recovery = document.createElement('div');
  panel.append(head, scope, status);
  if (opts.collab) panel.append(note);
  panel.append(recovery, list, more);
  if (opts.peer) panel.append(peerList);
  panel.append(projects);
  let closed = false, request = 0;
  let before: string | undefined;
  const previewTargets = new Map<string, HTMLImageElement>();
  const fillPreviews = (): void => {
    if (opts.collab) return;
    for (const [id, target] of previewTargets) if (target.hidden) void history!.preview(id).then(preview => {
      if (!closed && target.isConnected && preview && /^data:image\/(png|jpeg|webp);base64,/.test(preview)) { target.src = preview; target.hidden = false; }
    }).catch(() => {});
  };
  const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.preventDefault(); dispose(); } };
  const dispose = (): void => {
    if (closed) return;
    closed = true; request++;
    unsubscribe?.(); recoveryView.dispose();
    if (isDocked('history')) releaseDock('history', 'host');
    panel.remove();
    window.removeEventListener('hashchange', dispose);
    panel.removeEventListener('keydown', onKey);
    if (closeActive === dispose) closeActive = undefined;
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  closeActive = dispose;
  const recoveryView = history ? mountHistoryRecovery(recovery, history, { slot: () => scope.value === 'document' ? opts.slot?.() : undefined, emptyScope: () => scope.value === 'document' && !opts.slot?.(), error: showError, opened: dispose }) : { refresh: async () => {}, update: () => {}, dispose: () => {} };
  // Open a revision as a NEW local document. It never replaces a shared head or applies
  // historical values to a running collaboration runtime - a copy is a fresh creation.
  const writeLocalCopy = async (entry: { id: string; toolId: string; label: string }, data: SavedStateData | null): Promise<void> => {
    if (!data) throw new Error(t('This checkpoint is no longer available.'));
    const slot = `${entry.toolId}:${crypto.randomUUID()}`;
    const name = `${entry.label} (${t('copy')})`;
    if (history) await history.checkpoint(slot, { ...data, __label: name, __export_filename: name }, { reason: 'save', expectedHead: null });
    else await opts.state.save(slot, { ...data, __label: name, __export_filename: name });
    const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
    dispose();
    navigateHistoryHref(sessionOpenHref({ slot, toolId: entry.toolId }, false));
  };
  const row = (entry: RevisionEntry | CollabHistoryEntry, token: number): HTMLElement => {
    const article = document.createElement('article'); article.className = 'revision-history-entry';
    const image = document.createElement('img'); image.alt = ''; image.loading = 'lazy'; image.hidden = true;
    if (!opts.collab) previewTargets.set(entry.id, image);
    const text = document.createElement('div');
    const label = document.createElement('strong'); label.textContent = entry.label;
    const when = document.createElement('time'); when.dateTime = entry.at;
    when.textContent = new Date(entry.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const reason = document.createElement('span'); reason.textContent = entry.reason === 'save' ? t('Saved version') : entry.reason === 'recovery' ? t('Recovered work') : t('Automatic checkpoint');
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn'; copy.textContent = t('Open as a copy');
    copy.hidden = opts.collab ? !opts.collab.canSaveCopy : false;
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      try {
        const data = opts.collab
          ? (opts.collab.saveCopy ? await opts.collab.saveCopy(entry.id) : await opts.collab.read(entry.id))
          : await history!.read(entry.id);
        await writeLocalCopy(entry, data);
      } catch (error) { showError(error instanceof Error ? error.message : t('Could not open this checkpoint.')); copy.disabled = false; }
    });
    text.append(label, when, reason, copy); article.append(image, text);
    if (opts.collab) { image.hidden = true; return article; }
    void history!.preview(entry.id).then(preview => {
      if (preview && !closed && request === token && /^data:image\/(png|jpeg|webp);base64,/.test(preview)) { image.src = preview; image.hidden = false; }
    }).catch(() => {});
    return article;
  };
  const peerRow = (entry: HistoryWireEntry): HTMLElement => {
    const article = document.createElement('article'); article.className = 'revision-history-entry';
    const text = document.createElement('div');
    const label = document.createElement('strong'); label.textContent = entry.label;
    const when = document.createElement('time'); when.dateTime = entry.at;
    when.textContent = new Date(entry.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const reason = document.createElement('span'); reason.textContent = entry.reason === 'save' ? t('Saved version') : entry.reason === 'recovery' ? t('Recovered work') : t('Automatic checkpoint');
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn'; copy.textContent = t('Open as a copy');
    copy.addEventListener('click', async () => {
      // The payload is fetched (chunked, hash-verified) only on this explicit action.
      copy.disabled = true;
      try { await writeLocalCopy(entry, await opts.peer!.fetch(entry.id)); }
      catch (error) { showError(error instanceof Error ? error.message : t('Could not open this checkpoint.')); copy.disabled = false; }
    });
    text.append(label, when, reason, copy); article.append(text);
    return article;
  };
  const loadFromPeer = async (): Promise<void> => {
    if (!opts.peer) return;
    loadPeer.disabled = true;
    try {
      const entries = await opts.peer.list();
      peerList.replaceChildren();
      const heading = document.createElement('p'); heading.className = 'revision-history-note';
      heading.textContent = entries.length ? t('Shared by the collaboration session') : t('The peer has not shared any revisions yet.');
      peerList.append(heading);
      for (const entry of entries) peerList.append(peerRow(entry));
    } catch (error) { showError(error instanceof Error ? error.message : t('Could not load the peer history.')); }
    finally { loadPeer.disabled = false; }
  };
  const load = async (append = false): Promise<void> => {
    const token = ++request;
    if (!append) { void recoveryView.refresh(); before = undefined; previewTargets.clear(); list.replaceChildren(); }
    more.disabled = true;
    try {
      const slot = scope.value === 'document' ? opts.slot?.() : undefined;
      const page = opts.collab
        ? await opts.collab.list({ before, limit: 30 })
        : scope.value === 'document' && !slot ? { entries: [] } : await history!.list({ slot: slot ?? undefined, before, limit: 30 });
      if (closed || token !== request) return;
      if (!append && scope.value === 'all' && !opts.collab) {
        // Keep the old modal's resume paths while the app-wide event index grows.
        const sessions = await history!.recentSessions();
        const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
        const { isBatchSlot } = await import('../lib/batch-slots.ts');
        if (closed || token !== request) return;
        for (const session of sessions) {
          const link = document.createElement('a'); link.className = 'revision-history-resume';
          link.href = sessionOpenHref(session, isBatchSlot(session.slot));
          bindHistoryLink(link);
          link.textContent = `${t('Resume')} · ${session.label || session.filename || session.toolId}`;
          list.append(link);
        }
        const { listExports, exportReopenHref } = await import('../lib/export-history.ts');
        const exports = await listExports(12).catch(() => []);
        if (closed || token !== request) return;
        for (const entry of exports) {
          const link = document.createElement('a'); link.className = 'revision-history-resume';
          link.href = exportReopenHref(entry); link.textContent = `${t('Export')} · ${entry.filename || entry.label}`;
          bindHistoryLink(link);
          list.append(link);
        }
      }
      for (const entry of page.entries) {
        if (opts.collab) list.append(row(entry, token));
        else if ('slot' in entry && !entry.slot.startsWith('__trash__:')) list.append(row(entry, token));
      }
      if (!list.childElementCount) {
        const empty = document.createElement('p'); empty.textContent = t('Your checkpoints will appear here as you edit Design.'); list.append(empty);
      }
      before = page.before; more.hidden = !before;
    } catch (error) { if (!closed && token === request) showError(error instanceof Error ? error.message : t('Could not load history.')); }
    finally { if (token === request) more.disabled = false; }
  };
  let showedDivergence = false;
  const unsubscribe = opts.controller?.subscribe(() => {
    // The controller's message drives the refresh cadence; it is no longer rendered
    // (failures still reach the user through the undo toast the controller raises).
    const message = opts.controller?.status() ?? '';
    if (message.startsWith('Checkpoint saved at')) { fillPreviews(); void recoveryView.refresh(); }
    // Do not reset someone's older page or move keyboard focus on each save.
    if (message.startsWith('Checkpoint saved at') && !list.querySelector('article')) void load();
    if (message.startsWith('Current work saved')) void (recovery.hidden ? recoveryView.refresh() : recoveryView.update());
    if (message.startsWith('Another tab saved') && !showedDivergence) { showedDivergence = true; void recoveryView.refresh(); }
  });
  close.addEventListener('click', dispose);
  refresh.addEventListener('click', () => { void load(); });
  if (opts.peer) loadPeer.addEventListener('click', () => { void loadFromPeer(); });
  scope.addEventListener('change', () => { void load(); });
  more.addEventListener('click', () => { void load(true); });
  panel.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', dispose);
  if (!requestDock('history', panel, { label: t('History'), icon: icon('history'), onRelease: dispose })) {
    panel.classList.add('revision-history-mobile'); document.body.append(panel);
  }
  close.focus();
  void load();
  return dispose;
}
