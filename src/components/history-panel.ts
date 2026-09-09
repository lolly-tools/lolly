// SPDX-License-Identifier: MPL-2.0
import type { SavedStateData, WebStateAPI } from '../bridge/state.ts';
import type { RevisionEntry } from '../bridge/revision-history.ts';
import type { CollabHistoryCapability, CollabHistoryEntry } from '../lib/collab-history.ts';
import type { HistoryWireEntry } from '../collab/history-exchange.ts';
import { mountHistoryRecovery } from './history-recovery.ts';
import { mountHistoryWorkflows } from './history-workflows.ts';
import { mountHistoryFidelity } from './history-fidelity.ts';
import { createHistoryPreviews } from './history-previews.ts';
import { navigateHistoryHref } from '../lib/history-navigation.ts';
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
  /** Only an explicit copy may cross out of a guest's temporary state. */
  copyState?: WebStateAPI;
  container?: HTMLElement;
  onClose?: () => void;
  onNamed?: () => void;
  slot?: () => string | null;
  controller?: AutomaticHistory;
  collab?: CollabHistoryCapability;
  /** An older transport can be collaborative without supplying history. */
  collaborating?: boolean;
  /** The negotiated peer history (plan 221 section 9): list the peer's shared revisions and
   *  fetch one as a new local copy. Present only in a collab that agreed the capability. */
  peer?: {
    list(): Promise<readonly HistoryWireEntry[]>;
    fetch(revisionId: string): Promise<SavedStateData>;
  };
}): () => void {
  closeActive?.();
  const shared = opts.collaborating || !!opts.collab;
  const history = shared ? undefined : opts.state.history;
  if (!history && !shared) return () => {};
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
  if (shared) scope.add(new Option(t('This collaboration'), 'collaboration'));
  else {
    if (opts.slot) scope.add(new Option(t('This creation'), 'document'));
    scope.add(new Option(t('All history on this device'), 'all'));
  }
  // The status line only ever shows a genuine error or the collab-only ephemerality
  // note now: the routine "Checkpoint saved at…" and the local how-it-works blurb are
  // inferable from the checkpoint rows below, so they are not rendered.
  const status = document.createElement('p'); status.className = 'revision-history-status'; status.setAttribute('role', 'status'); status.hidden = true;
  const showError = (message: string): void => { status.textContent = message; status.hidden = false; };
  const note = document.createElement('p'); note.className = 'revision-history-note';
  if (opts.collab) note.textContent = opts.collab.scope === 'memory'
    ? t('This session history lives in memory. Save a copy to keep a checkpoint on this device.')
    : opts.collab.durability === 'session'
      ? t('These session checkpoints are temporary. Open a copy to keep one on this device.')
      : t('These checkpoints are stored by your Lolly Work instance. Open a copy to edit a version separately.');
  const list = document.createElement('div'); list.className = 'revision-history-list';
  const peerList = document.createElement('div'); peerList.className = 'revision-history-list revision-history-peer';
  const more = document.createElement('button'); more.type = 'button'; more.className = 'btn'; more.textContent = t('Load older history'); more.hidden = true;
  const newer = document.createElement('button'); newer.type = 'button'; newer.className = 'btn'; newer.textContent = t('Newer history'); newer.hidden = true;
  const projects = document.createElement('a'); projects.className = 'btn'; projects.href = '#/p'; projects.textContent = t('Open Projects');
  const recovery = document.createElement('div');
  panel.append(head, scope, status);
  const workflows = history ? mountHistoryWorkflows(history, () => { void load(); }, showError, opts.onNamed) : undefined;
  if (workflows) panel.append(workflows.el);
  if (opts.collab) panel.append(note);
  panel.append(recovery, list, newer, more);
  if (opts.peer) panel.append(peerList);
  panel.append(projects);
  if (!shared && !opts.container) { const app = document.createElement('a'); app.className = 'btn'; app.href = '#/history'; app.textContent = t('Open app history'); panel.append(app); }
  let closed = false, request = 0;
  let mobileBackground: HTMLElement | null = null, backgroundWasInert = false;
  let before: string | undefined;
  let pageCursor: string | undefined;
  const pages: Array<string | undefined> = [];
  const previews = history ? createHistoryPreviews(panel, id => history.preview(id)) : undefined;
  const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.preventDefault(); dispose(); } };
  const dispose = (): void => {
    if (closed) return;
    closed = true; request++;
    unsubscribe?.(); recoveryView.dispose(); workflows?.dispose(); previews?.dispose(); fidelity?.clear();
    if (mobileBackground) mobileBackground.inert = backgroundWasInert;
    if (!opts.container && isDocked('history')) releaseDock('history', 'host');
    panel.remove();
    window.removeEventListener('hashchange', dispose);
    panel.removeEventListener('keydown', onKey);
    if (closeActive === dispose) closeActive = undefined;
    opts.onClose?.();
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  closeActive = dispose;
  const recoveryView = history && !opts.collab ? mountHistoryRecovery(recovery, history, { slot: () => scope.value === 'document' ? opts.slot?.() : undefined, emptyScope: () => scope.value === 'document' && !opts.slot?.(), error: showError, opened: dispose }) : { refresh: async () => {}, update: () => {}, dispose: () => {} };
  // Open a revision as a NEW local document. It never replaces a shared head or applies
  // historical values to a running collaboration runtime - a copy is a fresh creation.
  const writeLocalCopy = async (entry: { id: string; toolId: string; label: string }, data: SavedStateData | null): Promise<void> => {
    if (!data) throw new Error(t('This checkpoint is no longer available.'));
    const slot = `${entry.toolId}:${crypto.randomUUID()}`;
    const name = `${entry.label} (${t('copy')})`;
    const destination = opts.copyState ?? opts.state;
    const copy = { ...data, __toolId: entry.toolId, __label: name, __export_filename: name };
    if (destination.history) await destination.history.checkpoint(slot, copy, { reason: 'save', expectedHead: null });
    else await destination.save(slot, copy);
    const { sessionOpenHref } = await import('../lib/search/projects-source.ts');
    dispose();
    navigateHistoryHref(sessionOpenHref({ slot, toolId: entry.toolId }, false));
  };
  const fidelity = history?.fidelity ? mountHistoryFidelity(history.fidelity, writeLocalCopy) : undefined;
  const row = (entry: RevisionEntry | CollabHistoryEntry): HTMLElement => {
    const article = document.createElement('article'); article.className = 'revision-history-entry';
    const image = document.createElement('img'); image.alt = ''; image.loading = 'lazy'; image.hidden = true;
    previews?.add(entry.id, article, image);
    const text = document.createElement('div');
    const label = document.createElement('strong'); label.textContent = 'milestone' in entry && entry.milestone ? entry.milestone : entry.label;
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
        if (!closed && copy.isConnected) await writeLocalCopy(entry, data);
      } catch (error) { showError(error instanceof Error ? error.message : t('Could not open this checkpoint.')); copy.disabled = false; }
    });
    text.append(label, when, reason, copy); article.append(image, text);
    if ('slot' in entry && workflows) text.append(workflows.actions(entry));
    if ('slot' in entry && fidelity) text.append(fidelity.action(entry, article));
    if (opts.collab) { image.hidden = true; return article; }
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
  const load = async (older = false, backwards = false): Promise<void> => {
    const token = ++request;
    if (backwards) pageCursor = pages.pop();
    else if (older) { pages.push(pageCursor); pageCursor = before; }
    else { pages.length = 0; pageCursor = undefined; void recoveryView.refresh(); }
    previews?.clear(); fidelity?.clear(); list.replaceChildren(); workflows?.pageChanged();
    more.disabled = true;
    newer.disabled = true;
    try {
      const slot = scope.value === 'document' ? opts.slot?.() : undefined;
      const page = opts.collab
        ? await opts.collab.list({ before: pageCursor, limit: 30 })
        : !history || (scope.value === 'document' && !slot) ? { entries: [] } : await history.list({ ...workflows?.query(), slot: slot ?? undefined, before: pageCursor, limit: 30 });
      if (closed || token !== request) return;
      status.hidden = true;
      const periods = new Map<string, HTMLDetailsElement>();
      for (const entry of page.entries) {
        if (!opts.collab && 'slot' in entry && entry.slot.startsWith('__trash__:')) continue;
        const period = new Date(entry.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        let group = periods.get(period);
        if (!group) {
          group = document.createElement('details'); group.className = 'revision-history-period'; group.open = true;
          const heading = document.createElement('summary'); heading.textContent = period; group.append(heading); periods.set(period, group); list.append(group);
        }
        group.append(row(entry));
      }
      if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.textContent = shared ? (opts.collab ? t('No session checkpoints yet.') : t('This collaboration does not provide revision history.')) : workflows?.active()
          ? (page.before ? t('No matches in this period. Load older history to continue searching.') : t('No matching versions.'))
          : t('No saved checkpoints in this scope yet.');
        list.append(empty);
      }
      before = page.before; more.hidden = !before;
      newer.hidden = pages.length === 0;
    } catch (error) { if (!closed && token === request) showError(error instanceof Error ? error.message : t('Could not load history.')); }
    finally { if (token === request) { more.disabled = false; newer.disabled = false; } }
  };
  let showedDivergence = false;
  const unsubscribe = opts.controller?.subscribe(() => {
    // The controller's message drives the refresh cadence; it is no longer rendered
    // (failures still reach the user through the undo toast the controller raises).
    const message = opts.controller?.status() ?? '';
    if (message.startsWith('Checkpoint saved at')) { previews?.refresh(); void recoveryView.refresh(); }
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
  newer.addEventListener('click', () => { void load(false, true); });
  panel.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', dispose);
  if (opts.container) opts.container.append(panel);
  else if (!requestDock('history', panel, { label: t('History'), icon: icon('history'), onRelease: dispose })) {
    panel.classList.add('revision-history-mobile'); document.body.append(panel);
    mobileBackground = document.getElementById('view');
    if (mobileBackground) { backgroundWasInert = mobileBackground.inert; mobileBackground.inert = true; }
  }
  close.focus();
  void load();
  return dispose;
}
