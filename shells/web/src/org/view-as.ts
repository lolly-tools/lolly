// SPDX-License-Identifier: MPL-2.0
import { tRaw } from '../i18n.ts';

const VIEW_AS_KEY = 'lolly-view-as';
export const VIEW_AS_DB = 'lolly-view-as';

export interface ViewAsEntity { id: string; name: string }
export interface ViewAsState {
  token: string;
  expiresAt: string;
  programme: ViewAsEntity;
  company?: ViewAsEntity;
}

type ViewAsFetch = (input: string, init?: RequestInit) => Promise<Response>;

function entity(value: unknown): value is ViewAsEntity {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && !!row.id.trim()
    && typeof row.name === 'string' && !!row.name.trim();
}

function parseState(value: unknown): ViewAsState | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.token !== 'string' || !/^[\x21-\x7e]+$/.test(row.token)
    || typeof row.expiresAt !== 'string' || !Number.isFinite(Date.parse(row.expiresAt))
    || Date.parse(row.expiresAt) <= Date.now() || !entity(row.programme)
    || (row.company !== undefined && !entity(row.company))) return null;
  return {
    token: row.token,
    expiresAt: row.expiresAt,
    programme: { id: row.programme.id, name: row.programme.name },
    ...(entity(row.company) ? { company: { id: row.company.id, name: row.company.name } } : {}),
  };
}

/** The viewing identity belongs to this tab and expires with the server's grant. */
export function viewingAs(): ViewAsState | null {
  try {
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    if (raw === null) return null;
    const state = parseState(JSON.parse(raw));
    if (state) return state;
  } catch { /* malformed or unavailable storage */ }
  try { sessionStorage.removeItem(VIEW_AS_KEY); } catch { /* storage unavailable */ }
  return null;
}

export function viewAsHeader(): string | null {
  return viewingAs()?.token ?? null;
}

/** Drop catalog validators and the cached tool index when the viewing identity changes. */
export function clearCatalogCaches(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('sbt-catalog:') || key === 'sbt-tool-index') localStorage.removeItem(key);
    }
  } catch { /* storage unavailable */ }
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    const message = body?.error?.message ?? body?.message ?? body?.error;
    if (typeof message === 'string' && message.trim()) return tRaw(message);
  } catch { /* an error response may have no JSON body */ }
  return fallback;
}

export async function startViewAs(fetchImpl: ViewAsFetch, programmeId: string, companyId?: string): Promise<string | null> {
  try {
    const response = await fetchImpl(`/api/v1/programmes/${encodeURIComponent(programmeId)}/view-as`, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(companyId ? { company: companyId } : {}),
    });
    if (response.status !== 201) return responseError(response, tRaw('Could not start this view. Try again.'));
    const state = parseState(await response.json());
    if (!state) return tRaw('The server returned an invalid view. Try again.');
    sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(state));
  } catch { return tRaw('Could not start this view. Try again.'); }
  clearCatalogCaches();
  location.reload();
  return null;
}

async function deleteViewingDatabase(): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2000);
    const done = (): void => { clearTimeout(timer); resolve(); };
    try {
      const request = indexedDB.deleteDatabase(VIEW_AS_DB);
      request.onsuccess = done;
      request.onblocked = done;
      request.onerror = done;
    } catch { done(); }
  });
}

export async function stopViewAs(fetchImpl: ViewAsFetch): Promise<void> {
  const state = viewingAs();
  // The tab stops being a view first, so the end request goes out as the admin
  // (a request that still carried the view would be refused as a write).
  try { sessionStorage.removeItem(VIEW_AS_KEY); } catch { /* storage unavailable */ }
  if (state) {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        fetchImpl('/api/v1/view-as/end', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: state.token }), signal: abort.signal,
        }),
        new Promise<void>((resolve) => { timer = setTimeout(() => { abort.abort(); resolve(); }, 2000); }),
      ]);
    } catch { /* ending locally must still work when the server cannot be reached */ }
    finally { clearTimeout(timer); }
  }
  await deleteViewingDatabase();
  clearCatalogCaches();
  location.reload();
}

let viewEnded = false;

export function markViewEnded(doc: Document = document): void {
  viewEnded = true;
  const title = doc.querySelector('.view-as-banner-title');
  if (title) title.textContent = tRaw('This view has ended.');
}

/** The caller supplies the stop action so this module has no transport dependency. */
export function mountViewAsBanner(doc: Document = document, onStop?: () => void | Promise<void>): void {
  const state = viewingAs();
  if (!state || doc.querySelector('.view-as-banner')) return;
  const banner = doc.createElement('div');
  banner.className = 'view-as-banner';
  banner.setAttribute('role', 'status');
  const copy = doc.createElement('div');
  copy.className = 'view-as-banner-copy';
  const title = doc.createElement('div');
  title.className = 'view-as-banner-title';
  title.textContent = viewEnded ? tRaw('This view has ended.')
    : tRaw('Viewing as {name}', { name: state.company?.name ?? state.programme.name });
  if (state.company && !viewEnded) {
    const programme = doc.createElement('span');
    programme.className = 'view-as-banner-programme';
    programme.textContent = tRaw(' · {programme}', { programme: state.programme.name });
    title.append(programme);
  }
  const note = doc.createElement('div');
  note.className = 'view-as-banner-note';
  note.textContent = tRaw("Changes are not saved to the partner's account.");
  copy.append(title, note);
  const stop = doc.createElement('button');
  stop.type = 'button';
  stop.className = 'btn btn--sm';
  stop.textContent = tRaw('Stop viewing');
  stop.addEventListener('click', () => { stop.disabled = true; void onStop?.(); });
  banner.append(copy, stop);
  doc.documentElement.dataset.viewingAs = '';
  doc.body.prepend(banner);
  const measure = (): void => {
    doc.documentElement.style.setProperty('--view-as-h', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
    doc.documentElement.style.setProperty('--safe-top', 'calc(var(--view-as-h) + max(env(safe-area-inset-top, 0px), var(--safe-top-fb, 0px)))');
  };
  measure();
  const Observer = doc.defaultView?.ResizeObserver;
  if (Observer) new Observer(measure).observe(banner);
}

export interface ViewAsSheetOptions {
  fetchImpl: ViewAsFetch;
  /** Reuse the programme list from the account menu's permission check. */
  programmes?: readonly ViewAsEntity[];
}

export async function openViewAsSheet(opts: ViewAsSheetOptions): Promise<void> {
  const { mountModal } = await import('../components/modal.ts');
  return new Promise<void>((resolve) => {
    let disposed = false;
    let loading = true;
    let starting = false;
    let generation = 0;
    const modal = mountModal('', {
      className: 'modal view-as-sheet', ariaLabel: tRaw('View as partner'),
      onClose: () => { disposed = true; generation++; resolve(); },
    });
    const doc = modal.el.ownerDocument;
    const heading = doc.createElement('h2');
    heading.className = 'modal-title';
    heading.textContent = tRaw('View as partner');
    const field = (label: string): HTMLSelectElement => {
      const wrap = doc.createElement('label');
      wrap.className = 'view-as-field';
      wrap.textContent = label;
      const select = doc.createElement('select');
      select.className = 'field-select';
      select.disabled = true;
      wrap.append(select);
      modal.el.append(wrap);
      return select;
    };
    modal.el.append(heading);
    const programme = field(tRaw('Programme'));
    const company = field(tRaw('Company'));
    const error = doc.createElement('p');
    error.className = 'view-as-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    modal.el.append(error);
    const actions = doc.createElement('div');
    actions.className = 'modal-actions';
    const cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn modal-cancel';
    cancel.textContent = tRaw('Cancel');
    cancel.addEventListener('click', () => modal.close());
    const start = doc.createElement('button');
    start.type = 'button';
    start.className = 'btn modal-primary';
    start.textContent = tRaw('View as partner');
    start.disabled = true;
    actions.append(cancel, start);
    modal.el.append(actions);
    cancel.focus();

    const showError = (message: string): void => { error.textContent = message; error.hidden = !message; };
    const option = (select: HTMLSelectElement, value: string, label: string): void => {
      const row = doc.createElement('option');
      row.value = value;
      row.textContent = label;
      select.append(row);
    };
    const loadCompanies = async (): Promise<void> => {
      const run = ++generation;
      loading = true;
      start.disabled = true;
      company.disabled = true;
      company.replaceChildren();
      option(company, '', tRaw('Everyone in the programme'));
      showError('');
      try {
        const response = await opts.fetchImpl(`/api/v1/programmes/${encodeURIComponent(programme.value)}/people`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(await responseError(response, tRaw('Could not load companies. Try again.')));
        const body = await response.json();
        if (!Array.isArray(body?.companies)) throw new Error(tRaw('Could not load companies. Try again.'));
        if (disposed || run !== generation) return;
        for (const row of body.companies) if (entity(row)) option(company, row.id, row.name);
        company.disabled = false;
        start.disabled = false;
      } catch (cause) {
        if (!disposed && run === generation) showError(cause instanceof Error ? tRaw(cause.message) : tRaw('Could not load companies. Try again.'));
      } finally { if (run === generation) loading = false; }
    };
    programme.addEventListener('change', () => { void loadCompanies(); });
    start.addEventListener('click', () => {
      if (loading || starting || !programme.value) return;
      starting = true;
      start.disabled = true;
      programme.disabled = true;
      company.disabled = true;
      showError('');
      void startViewAs(opts.fetchImpl, programme.value, company.value || undefined).then((message) => {
        if (disposed) return;
        starting = false;
        start.disabled = false;
        programme.disabled = false;
        company.disabled = false;
        if (message) showError(message);
      });
    });
    void (async () => {
      try {
        let rows = opts.programmes;
        if (!rows) {
          const response = await opts.fetchImpl('/api/v1/programmes', { credentials: 'same-origin' });
          if (response.status !== 200) throw new Error(await responseError(response, tRaw('Could not load programmes. Try again.')));
          const body = await response.json();
          rows = Array.isArray(body?.programmes) ? body.programmes.filter(entity) : [];
        }
        if (disposed) return;
        if (!rows?.length) { showError(tRaw('No programmes are available.')); return; }
        for (const row of rows) option(programme, row.id, row.name);
        programme.disabled = false;
        programme.focus();
        await loadCompanies();
      } catch (cause) {
        if (!disposed) showError(cause instanceof Error ? tRaw(cause.message) : tRaw('Could not load programmes. Try again.'));
      }
    })();
  });
}
