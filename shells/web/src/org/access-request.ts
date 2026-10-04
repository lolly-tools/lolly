// SPDX-License-Identifier: MPL-2.0
/**
 * org/access-request - asking for access to a team project: "Ask for access" on a
 * project or session link this person cannot open (org/team-link-shared.ts), and
 * "Ask to edit" for a viewer (org/team-save.ts, org/team-people.ts).
 *
 * Server contract (lolly-work plans/75 G13):
 *   POST /api/v1/projects/:id/access-requests  { role, note? } -> 202 { ok: true }
 *   POST /api/v1/sessions/:id/access-requests  { role, note? } -> 202 { ok: true }
 *   GET  /api/v1/access-requests/mine?projectId=…|sessionId=… -> { requests: MyRequest[] }
 *   POST /api/v1/access-requests/:id/withdraw  {}             -> { request }
 * Filing answers the same 202 whatever the instance knows (an unknown or archived
 * project, access already held, a request already open), so the form learns nothing
 * the link did not already show. Who manages the project is never shown here: the
 * answer comes to this person's inbox.
 *
 * buildAskForm reads this person's own requests for the target first, then shows one
 * of: the form, a request still waiting (with Withdraw), the last request declined
 * (with the form again), a request sent just now, or access given. The caller may
 * hand in a watch over the inbox (org/inbox.ts onInboxChange): an answer to one of
 * this person's requests then moves the form to approved or declined with no reload.
 * This module never imports the inbox itself. org/team-save.ts imports this module
 * and org/index.ts loads team-save, so an inbox import here would put the two in a
 * load-order cycle.
 *
 * Pure data and DOM, no other org/ state. Every string reaches the page through
 * textContent.
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { longRelTime } from './team-access.ts';

/** What a request is for: a project, or the session a link opened (the instance
 *  works out the session's project). */
export type AskTarget = { projectId: string } | { sessionId: string };

/** The roles a person may ask for. */
export type AskRole = 'viewer' | 'editor';

/** The form's states, reported to the caller through `onState`. */
export type AskState = 'form' | 'sent' | 'asked' | 'declined' | 'approved';

/** One of this person's own requests, as the instance reports the request. */
export interface MyRequest {
  id: string;
  status: string;
  role: 'viewer' | 'editor' | 'manager' | null;
  createdAt: string;
  answeredAt: string | null;
  answerRole: string | null;
}

/** The most characters a note may have; the instance refuses a longer one. */
export const NOTE_MAX = 280;

/** The part of an inbox message an ask form reads. */
export interface AnswerMessage { id?: string; data?: Record<string, unknown> }

/** A watch over the inbox: `fn` gets the whole list on every change. Returns the
 *  unsubscribe. */
export type InboxWatch = (fn: (msgs: readonly AnswerMessage[]) => void) => () => void;

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const ROLES = ['viewer', 'editor', 'manager'] as const;

/** The instance's path for filing a request about `target`. Pure. */
export function askPath(target: AskTarget): string {
  return 'projectId' in target
    ? `/api/v1/projects/${encodeURIComponent(target.projectId)}/access-requests`
    : `/api/v1/sessions/${encodeURIComponent(target.sessionId)}/access-requests`;
}

/** The instance's path for this person's own requests about `target`. Pure. */
export function minePath(target: AskTarget): string {
  const q = 'projectId' in target
    ? `projectId=${encodeURIComponent(target.projectId)}`
    : `sessionId=${encodeURIComponent(target.sessionId)}`;
  return `/api/v1/access-requests/mine?${q}`;
}

/** One request row, or null when it is not usable (no id, no status, or no readable
 *  time). Pure. */
export function myRequestFromRow(row: unknown): MyRequest | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = str(r.id);
  const status = str(r.status);
  const createdAt = str(r.createdAt);
  if (!id || !status || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  const role = (ROLES as readonly unknown[]).includes(r.role) ? r.role as MyRequest['role'] : null;
  return { id, status, role, createdAt, answeredAt: str(r.answeredAt) ?? null, answerRole: str(r.answerRole) ?? null };
}

/**
 * Which state the form opens in, from this person's requests, newest first (as the
 * instance sends them): the newest still open is `asked`, a newest declined is
 * `declined` (the form, with a line saying so), anything else is the form. An
 * approved request is not `approved` here: the form only opens where access is
 * missing, so that access was taken away after. Pure.
 */
export function askStateOf(list: readonly MyRequest[] | null): { state: 'form' | 'asked' | 'declined'; open?: MyRequest } {
  const newest = list?.[0];
  if (newest?.status === 'open') return { state: 'asked', open: newest };
  if (newest?.status === 'declined') return { state: 'declined' };
  return { state: 'form' };
}

/** The answer to one of this person's own requests (`ownIds`) among inbox messages, or
 *  null when there is none. An approval wins over a decline. Pure. */
export function answerOutcome(msgs: readonly AnswerMessage[], ownIds: ReadonlySet<string>): 'approved' | 'declined' | null {
  let declined = false;
  for (const m of msgs) {
    const d = m?.data;
    if (!d || d.kind !== 'access-answer' || typeof d.requestId !== 'string' || !ownIds.has(d.requestId)) continue;
    if (d.outcome === 'approved') return 'approved';
    if (d.outcome === 'declined') declined = true;
  }
  return declined ? 'declined' : null;
}

/** Whether the instance takes project access requests, from its org-config
 *  (`requests.project`). An older instance sends no `requests` block. Pure. */
export function projectRequestsOn(config: unknown): boolean {
  const requests = (config as { requests?: { project?: unknown } } | null | undefined)?.requests;
  return !!requests && typeof requests === 'object' && requests.project === true;
}

/** The sentence for a request that was not sent, by status. Plain text. */
export function askErrorMessage(status: number): string {
  return status === 429
    ? tRaw('That is a lot of requests for one day. Try again tomorrow.')
    : tRaw('Could not send the request. Try again.');
}

// ── Network ──────────────────────────────────────────────────────────────────

async function request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response | null> {
  try {
    return await instanceFetch(instancePath(path), {
      method,
      ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    return null;
  }
}

async function readJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

/** File a request. Resolves `{ ok: true }` for any 2xx, else the status (0: no
 *  answer) and the instance's error code when it sent one. Never throws. */
export async function askForAccess(target: AskTarget, role: AskRole, note: string): Promise<{ ok: true } | { ok: false; status: number; code?: string }> {
  const text = String(note ?? '').trim().slice(0, NOTE_MAX);
  const res = await request('POST', askPath(target), { role, ...(text ? { note: text } : {}) });
  if (!res) return { ok: false, status: 0 };
  if (res.ok) return { ok: true };
  const code = str((await readJson(res) as { error?: { code?: unknown } } | null)?.error?.code);
  return { ok: false, status: res.status, ...(code ? { code } : {}) };
}

/** This person's own requests about `target`, newest first, or null when the
 *  instance could not be asked or answered something else. */
export async function myRequests(target: AskTarget): Promise<MyRequest[] | null> {
  const res = await request('GET', minePath(target));
  if (!res?.ok) return null;
  const body = await readJson(res) as { requests?: unknown } | null;
  if (!body || !Array.isArray(body.requests)) return null;
  return body.requests.map(myRequestFromRow).filter((r): r is MyRequest => !!r);
}

/** Withdraw one of this person's open requests. True when the instance confirmed. */
export async function withdrawRequest(id: string): Promise<boolean> {
  const res = await request('POST', `/api/v1/access-requests/${encodeURIComponent(id)}/withdraw`, {});
  return !!res?.ok;
}

// ── DOM ─────────────────────────────────────────────────────────────────────

export interface AskFormOptions {
  target: AskTarget;
  /** The role the select starts on. */
  defaultRole: AskRole;
  /** Ask to edit: the role is fixed, and its select is not shown. */
  fixedRole?: 'editor';
  heading?: string;
  /** The heading's level: 2 (the default) under a card's h1, deeper inside a
   *  dialog section. */
  level?: 2 | 3 | 4;
  intro?: string;
  onState?: (s: AskState) => void;
  /** A watch over the inbox, so an answer moves the form on with no reload. */
  watch?: InboxWatch;
}

const TEXT_STYLE = 'margin:0;font-size:.9rem;line-height:1.5';
const MUTED_STYLE = `${TEXT_STYLE};color:hsl(var(--muted-foreground))`;
const HINT_STYLE = 'margin:0;font-size:var(--fs-sm);line-height:1.45;color:hsl(var(--muted-foreground))';
const LABEL_STYLE = 'font-size:var(--fs-md);font-weight:600';
const BUTTON_STYLE = 'display:inline-flex;align-items:center;justify-content:center;min-height:var(--ui-size-target);align-self:flex-start';

let formSeq = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, style?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (style) node.style.cssText = style;
  return node;
}

function option(label: string, value: string): HTMLOptionElement {
  const o = el('option', label);
  o.value = value;
  return o;
}

function actionButton(label: string, act: string, primary = false): HTMLButtonElement {
  const b = el('button', label, BUTTON_STYLE);
  b.type = primary ? 'submit' : 'button';
  b.className = primary ? 'btn btn--primary' : 'btn';
  b.dataset.act = act;
  return b;
}

/**
 * The ask form and its states. Starts on a short loading line while this person's own
 * requests are read, then draws the state those give (askStateOf). A failed read
 * draws the form: asking twice is harmless, because the instance keeps one open
 * request per person and target.
 */
export function buildAskForm(o: AskFormOptions): HTMLElement {
  const root = el('div', undefined, 'display:flex;flex-direction:column;gap:.6rem;text-align:left;margin-top:1rem');
  root.className = 'team-ask';
  root.dataset.teamAsk = '';
  if (o.heading) {
    const h = document.createElement(`h${o.level ?? 2}`);
    h.textContent = o.heading;
    h.style.cssText = 'margin:0;font-size:1rem;font-weight:700';
    root.append(h);
  }
  if (o.intro) root.append(el('p', o.intro, MUTED_STYLE));
  const body = el('div');
  const status = el('p', undefined, `${HINT_STYLE};margin:0`);
  status.className = 'team-ask-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  root.append(body, status);

  /** This person's requests the form knows to be theirs: an answer to one of these
   *  moves the form on. */
  const ownIds = new Set<string>();
  let state: AskState | null = null;
  let stopWatch: (() => void) | null = null;

  const say = (msg: string, error: boolean): void => {
    status.textContent = msg;
    status.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
    status.hidden = false;
    announce(msg, { assertive: error });
  };
  const quiet = (): void => { status.hidden = true; status.textContent = ''; };
  const enter = (next: AskState, draw: () => void): void => {
    state = next;
    draw();
    o.onState?.(next);
  };
  /** A line that replaces the control the person pressed. It takes the focus that
   *  control had, so the keyboard is not sent back to the top of the page. */
  const replaceWithLine = (text: string): void => {
    const hadFocus = root.contains(document.activeElement) || document.activeElement === document.body;
    const line = el('p', text, TEXT_STYLE);
    line.tabIndex = -1;
    body.replaceChildren(line);
    announce(text);
    if (hadFocus && root.isConnected) line.focus();
  };
  /** After a send, read the requests again for the id of the one just filed: the
   *  202 carries none, so that nothing is disclosed. */
  const learnOwnId = (): void => {
    void myRequests(o.target).then((list) => {
      const open = list?.find((r) => r.status === 'open');
      if (open) ownIds.add(open.id);
    });
  };

  const drawForm = (lead?: string): void => {
    const uid = `team-ask-${++formSeq}`;
    const form = el('form', undefined, 'display:flex;flex-direction:column;gap:.6rem;margin:0');
    form.noValidate = true;
    if (lead) form.append(el('p', lead, TEXT_STYLE));
    let roleSelect: HTMLSelectElement | null = null;
    if (!o.fixedRole) {
      const row = el('div', undefined, 'display:flex;flex-direction:column;gap:.3rem');
      const label = el('label', tRaw('Access you need'), LABEL_STYLE);
      label.htmlFor = `${uid}-role`;
      roleSelect = el('select');
      roleSelect.className = 'field-select';
      roleSelect.id = `${uid}-role`;
      roleSelect.append(option(tRaw('Can view'), 'viewer'), option(tRaw('Can edit'), 'editor'));
      roleSelect.value = o.defaultRole;
      const view = el('p', tRaw('View: open the work and make your own copy.'), HINT_STYLE);
      view.id = `${uid}-view`;
      const edit = el('p', tRaw('Edit: open the work and save changes.'), HINT_STYLE);
      edit.id = `${uid}-edit`;
      roleSelect.setAttribute('aria-describedby', `${view.id} ${edit.id}`);
      row.append(label, roleSelect, view, edit);
      form.append(row);
    }
    const noteRow = el('div', undefined, 'display:flex;flex-direction:column;gap:.3rem');
    const noteLabel = el('label', tRaw('Add a note (optional)'), LABEL_STYLE);
    noteLabel.htmlFor = `${uid}-note`;
    const note = el('textarea', undefined, 'resize:vertical;min-height:4.5rem');
    note.className = 'field-input';
    note.id = `${uid}-note`;
    note.rows = 3;
    note.maxLength = NOTE_MAX;
    const noteHint = el('p', tRaw('Notes can be up to {n} characters.', { n: NOTE_MAX }), HINT_STYLE);
    noteHint.id = `${uid}-note-hint`;
    note.setAttribute('aria-describedby', noteHint.id);
    noteRow.append(noteLabel, note, noteHint);
    const send = actionButton(tRaw('Send request'), 'team-ask-send', true);
    form.append(noteRow, send);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (send.disabled) return;
      quiet();
      send.disabled = true;
      send.textContent = tRaw('Sending…');
      const role: AskRole = o.fixedRole ?? (roleSelect?.value === 'viewer' ? 'viewer' : 'editor');
      void askForAccess(o.target, role, note.value).then((got) => {
        if (got.ok) {
          enter('sent', drawSent);
          learnOwnId();
          return;
        }
        send.disabled = false;
        send.textContent = tRaw('Send request');
        say(askErrorMessage(got.status), true);
      });
    });
    body.replaceChildren(form);
  };

  const drawAsked = (req: MyRequest): void => {
    const time = longRelTime(req.createdAt, Date.now());
    const line = el('p', tRaw('You asked for access {time}. Nobody has answered yet.', { time }), TEXT_STYLE);
    const withdraw = actionButton(tRaw('Withdraw request'), 'team-ask-withdraw');
    withdraw.addEventListener('click', () => {
      if (withdraw.disabled) return;
      quiet();
      withdraw.disabled = true;
      void withdrawRequest(req.id).then(async (ok) => {
        if (ok) {
          ownIds.delete(req.id);
          enter('form', () => drawForm());
          say(tRaw('Request withdrawn.'), false);
          body.querySelector<HTMLElement>('select, textarea')?.focus();
          return;
        }
        // Refused: the request may have been answered meanwhile, and then the answer
        // is what to show, not an error to try again.
        const newest = (await myRequests(o.target))?.[0];
        if (newest && newest.id === req.id && newest.status === 'approved') {
          enter('approved', drawApproved);
        } else if (newest && newest.id === req.id && newest.status === 'declined') {
          enter('declined', () => drawForm(tRaw('Your last request was not approved. You can ask again.')));
        } else {
          withdraw.disabled = false;
          say(tRaw('Could not make that change. Try again.'), true);
        }
      });
    });
    const box = el('div', undefined, 'display:flex;flex-direction:column;gap:.6rem');
    box.append(line, withdraw);
    body.replaceChildren(box);
  };

  const drawSent = (): void => {
    replaceWithLine(tRaw('Request sent. The people who manage this project will see your request. Their answer comes to your inbox here.'));
  };

  const drawApproved = (): void => {
    replaceWithLine(tRaw('You have access now.'));
  };

  body.replaceChildren(el('p', tRaw('Loading…'), MUTED_STYLE));
  void myRequests(o.target).then((list) => {
    const { state: first, open } = askStateOf(list);
    if (first === 'asked' && open) {
      ownIds.add(open.id);
      enter('asked', () => drawAsked(open));
    } else if (first === 'declined') {
      enter('declined', () => drawForm(tRaw('Your last request was not approved. You can ask again.')));
    } else {
      enter('form', () => drawForm());
    }
  });

  if (o.watch) {
    // The form is drawn before the caller attaches the form, so the watch only lets go
    // once the form has been on the page and then left the page.
    let attached = false;
    const stop = (): void => { stopWatch?.(); stopWatch = null; };
    stopWatch = o.watch((msgs) => {
      if (!root.isConnected) { if (attached) stop(); return; }
      attached = true;
      const outcome = answerOutcome(msgs, ownIds);
      if (outcome === 'approved' && state !== 'approved') {
        stop();
        quiet();
        enter('approved', drawApproved);
      } else if (outcome === 'declined' && (state === 'asked' || state === 'sent')) {
        quiet();
        enter('declined', () => drawForm(tRaw('Your last request was not approved. You can ask again.')));
      }
    });
  }
  return root;
}
