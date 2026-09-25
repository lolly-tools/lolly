// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: footer (plan 274 section 4 "Footer"; plan 275 close-out section 3.8).
 *
 * Owns `rb.els.foot`, shown in renovate mode once a plan exists, named "Finish".
 * Contents, left to right: the counts ("12 slides, 5 to review"), the Report button
 * that opens the report drawer (`rb.report.open()`), the outcome line after a hairline,
 * and the two actions.
 *
 * The actions. While a card waits for an answer (`toReviewCount`, the number the To
 * review tab shows) "Accept all suggestions" is the primary (one undoable transaction
 * over every waiting row) and Open in Design is a ghost beside it, enabled: pressed with
 * cards left it asks through the standard confirm dialog, then runs Accept all, waits for
 * the Proposed pane to show the accepted plan and opens. Once no card waits, Accept all
 * leaves and Open in Design is the primary. A row the picture deck's notice band speaks
 * for is no card: Open in Design then asks about the pictures in the band's own words,
 * never about a card nobody was shown. Either action steps down to a ghost while the band
 * shows a primary of its own (Read the text), so the view has one primary.
 *
 * The outcome line. Every edit in the view answers here in its own words, through
 * `say(text, { undo: true })`, with an inline Undo beside the words while the history's
 * next undo is still that edit. The line has no live role: `say` speaks through the
 * view's one live region (`rb.announce`), so nothing is heard twice. The line gives way
 * at the next result, and clears when its edit is undone from elsewhere. A result that
 * waits on the Proposed pane adds "Updating the proposed slides." until the pane is
 * current. On a return from Design the line says so, carried across the remount.
 *
 * The number of cards is the number on the queue's To review tab: queue items still
 * waiting for a person (`reviewItems`), never objects, so the two never disagree.
 *
 * Open in Design stays disabled only for a reason a person cannot answer from here (a
 * step running, a failed notice, a pane that failed to update, no slide included), and
 * that reason is a line in the outcome line's place, tied to the button with
 * `aria-describedby`. What Open in Design warned about goes to the report drawer
 * (`rb.report.notes`).
 */
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { tRaw } from '../../i18n.ts';
import type { QueueItemV1 } from '@lolly/engine';
import type {
  RebrandEditOutcomeV1,
  RebrandHistoryV1,
  RebrandOpenOutcomeV1,
  RebrandStateV1,
} from '../../lib/rebrand/controller-api.ts';
import { bindOp, type RbCtx } from './context.ts';

// ─── view-only state ─────────────────────────────────────────────────────────

interface FootEls {
  info: HTMLElement;
  counts: HTMLElement;
  report: HTMLButtonElement;
  /** The last result: its words and, outside them, the inline Undo. */
  outcome: HTMLElement;
  said: HTMLElement;
  undo: HTMLButtonElement;
  /** Why Open in Design waits, in the outcome line's place while no result shows. */
  reason: HTMLElement;
  accept: HTMLButtonElement;
  open: HTMLButtonElement;
}

/** A result on the outcome line. */
interface FootOutcome {
  text: string;
  /**
   * The history's next undo when the result was said (`stepKey`), while it offers an
   * Undo; null when it offers none. The Undo shows while the history still names it.
   */
  step: string | null;
  /** The result changed the plan, so the line adds that the pane is catching up while it is. */
  catchUp: boolean;
}

/** A line kept past a remount: a refusal of Open in Design, or the return from Design. */
interface Carried {
  projectId: string;
  kind: 'refused' | 'returned';
  text: string;
  at: number;
}

interface FootLocal {
  els: FootEls | null;
  outcome: FootOutcome | null;
  /** An action is running, so both buttons wait. */
  working: boolean;
  /** The inline Undo is running, so its own line is not cleared under it. */
  undoing: boolean;
  /** The carried line this mount adopted, shown on its first render with the same project. */
  carried: Carried | null;
}

const LOCAL = new WeakMap<RbCtx, FootLocal>();

function localOf(rb: RbCtx): FootLocal {
  let local = LOCAL.get(rb);
  if (!local) {
    local = { els: null, outcome: null, working: false, undoing: false, carried: null };
    LOCAL.set(rb, local);
  }
  return local;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** How long Open in Design waits, after its Accept all, for the Proposed pane to catch up. */
const PREVIEW_WAIT_MS = 120_000;

/** How long after a handoff the return line still says "just now". */
const JUST_NOW_MS = 10 * 60_000;

// ─── copy ────────────────────────────────────────────────────────────────────

/**
 * "12 slides, 5 to review", "10 of 12 slides" when some are left out, and on a phone
 * the part a person acts on: "5 to review".
 */
export function countsLine(included: number, total: number, toReview: number, short = false): string {
  const slides = included === total
    ? total === 1 ? tRaw('1 slide') : tRaw('{n} slides', { n: total })
    : tRaw('{included} of {total} slides', { included, total });
  if (toReview === 0) return slides;
  const review = tRaw('{n} to review', { n: toReview });
  return short ? review : tRaw('{slides}, {review}', { slides, review });
}

/** The cards still to answer, as the confirm and a refusal say it. */
export function cardsLeftText(cards: number): string {
  return cards === 1 ? tRaw('1 card is still to answer.') : tRaw('{n} cards are still to answer.', { n: cards });
}

/**
 * The confirm Open in Design asks when the only rows left are the slide pictures the
 * notice band speaks for: keeping them as pictures is what accepting them does.
 */
export function confirmPicturesText(slides: number): string {
  return slides === 1
    ? tRaw('1 slide is still a picture. Keep it as a picture and open in Design?')
    : tRaw('{n} slides are still pictures. Keep them as pictures and open in Design?', { n: slides });
}

/**
 * The confirm Open in Design asks while cards are left. With no card to count (rows left
 * that no card lists) it names the suggestions instead of a number the screen does not show.
 */
export function confirmOpenText(cards: number): string {
  if (cards <= 0) return tRaw('Some suggestions are still to answer. Accept them as proposed and open in Design?');
  return cards === 1
    ? tRaw('1 card is still to answer. Accept it as proposed and open in Design?')
    : tRaw('{n} cards are still to answer. Accept them as proposed and open in Design?', { n: cards });
}

/** What Accept all does, as the button's tooltip. */
const ACCEPT_TITLE = (): string => tRaw('Takes every suggestion as Proposed shows it. Undo reverses it.');
const CATCH_UP = (): string => tRaw('Updating the proposed slides.');
const BUSY = (): string => tRaw('Still working. Try again in a moment.');
const STALE = (): string => tRaw('Changed in another tab. Reload to continue.');

/** The outcome of Open in Design in words: a refusal names its reason. */
export function openOutcomeText(outcome: RebrandOpenOutcomeV1): string {
  if (outcome.ok) {
    const notes = outcome.warnings.length;
    if (notes === 0) return tRaw('Opened in Design.');
    return notes === 1
      ? tRaw('Opened in Design, with 1 note in the report.')
      : tRaw('Opened in Design, with {n} notes in the report.', { n: notes });
  }
  switch (outcome.reason) {
    case 'unreviewed':
      return cardsLeftText(Math.max(1, outcome.pending ?? 0));
    case 'no-plan':
      return tRaw('Choose a deck first.');
    case 'busy':
      return BUSY();
    case 'compile-failed':
      return tRaw('The proposed slides could not be made. Open the report to see why.');
    case 'stale-revision':
      return STALE();
    default:
      return tRaw('Design did not open. Try again.');
  }
}

/** The outcome of Accept all suggestions in words. The Undo beside it says how to reverse it. */
export function acceptOutcomeText(outcome: RebrandEditOutcomeV1): string {
  if (outcome.ok) {
    return outcome.touched === 1 ? tRaw('Accepted 1 suggestion.') : tRaw('Accepted {n} suggestions.', { n: outcome.touched });
  }
  switch (outcome.refusal) {
    case 'nothing-to-do':
      return tRaw('There are no suggestions left to accept.');
    case 'busy':
      return BUSY();
    case 'stale-revision':
      return STALE();
    case 'quota':
      return tRaw('This device has no room left, so the change was not saved.');
    default:
      return tRaw('Choose a deck first.');
  }
}

/** The line shown on a return from Design. */
export function returnText(at: number, now = Date.now()): string {
  return now - at < JUST_NOW_MS
    ? tRaw('Opened in Design just now. Opening again makes a new revision.')
    : tRaw('Opened in Design. Opening again makes a new revision.');
}

/**
 * The queue items still waiting for a person: not settled, and holding at least one of
 * the rows Open in Design waits on (`derived.pendingIds`). A card whose members sit on
 * left-out slides, are all locked or are already answered is not one, so the To review
 * tab, this footer's count and the sentence said when the review appears count the
 * same cards, and the number reaches 0 exactly when Open in Design is free to run.
 */
export function reviewItems(rb: RbCtx): QueueItemV1[] {
  const derived = rb.derived;
  if (!derived) return [];
  const pending = new Set(derived.pendingIds);
  return derived.queue.filter((item) => item.section !== 'settled' && item.objectIds.some((id) => pending.has(id)));
}

/**
 * The cards the queue leaves out while the picture deck's notice band speaks for them
 * (`rb.queue.bandCardIds`), read by name so a queue without that operation leaves
 * nothing out.
 */
function bandCards(rb: RbCtx): ReadonlySet<unknown> {
  const queue: object = rb.queue;
  const op = 'bandCardIds' in queue ? queue.bandCardIds : undefined;
  const ids: unknown = typeof op === 'function' ? op.call(queue) : undefined;
  return ids instanceof Set ? ids : new Set();
}

/**
 * How many cards the To review tab lists: `reviewItems` less those the notice band
 * speaks for. The number in the footer and in the confirm.
 */
export function toReviewCount(rb: RbCtx): number {
  const band = bandCards(rb);
  return reviewItems(rb).filter((item) => !band.has(item.id)).length;
}

// ─── the outcome line ────────────────────────────────────────────────────────

/** The history's next undo as a comparable key, or null when there is none. */
function stepKey(history: RebrandHistoryV1): string | null {
  return history.canUndo && history.undo ? JSON.stringify(history.undo) : null;
}

/** The Proposed pane has not shown the current plan yet. */
function previewPending(state: RebrandStateV1): boolean {
  return state.previewStale || !state.preview;
}

/**
 * The notice band above shows a primary of its own (the picture deck's Read the text,
 * drawn by the intake), so the footer's actions step down to ghosts and the view keeps
 * one primary. Read from the band itself, which the intake draws before this footer.
 */
function bandAsks(rb: RbCtx): boolean {
  const band = rb.els.alert;
  if (band.hidden) return false;
  return [...band.querySelectorAll<HTMLElement>('.btn--primary')].some((button) => !button.closest('[hidden]'));
}

/**
 * How a result is offered. `undo`: the result can be undone, so the line offers Undo
 * while the history names it. `spoken`: a fuller sentence for the live region, where the
 * line would repeat what the screen already shows beside it.
 */
export interface RbSayOptions {
  undo?: boolean;
  spoken?: string;
}

/**
 * A result a person must see, from anywhere in the view (an edit in the decision
 * column, the strip, the chooser or the theme; a preset saved; a newer version being
 * read): in the footer's outcome line while the footer shows, and through the live
 * region always, so a caller says it here and nowhere else.
 */
export function say(rb: RbCtx, text: string, opts: RbSayOptions = {}): void {
  if (!text) return;
  show(rb, text, { undo: Boolean(opts.undo), catchUp: false });
  rb.announce(opts.spoken || text);
}

/**
 * Put a result on the line without speaking it. Only while the footer shows: a result
 * said on the intake (a preset saved there) is not left waiting for the review.
 */
function show(rb: RbCtx, text: string, opts: { undo: boolean; catchUp: boolean }): void {
  const local = localOf(rb);
  if (!local.els || rb.els.foot.hidden) return;
  // The controller's own state, not the last one drawn: a caller says its result as its
  // edit resolves, and the Undo must name that edit even before the view redraws.
  const step = opts.undo ? stepKey(rb.controller.getState().history) : null;
  local.outcome = { text, step, catchUp: opts.catchUp };
  renderFoot(rb);
}

/**
 * The inline Undo: the same step the top bar's Undo takes (`rb.keys.step`, which says
 * what was undone). The line then shows those words without an Undo of its own, and
 * focus moves to the actions, since the button it was on is gone.
 */
async function undoFromLine(rb: RbCtx): Promise<void> {
  const local = localOf(rb);
  const step = rb.state.history.undo;
  const before = stepKey(rb.state.history);
  if (!local.outcome || local.outcome.step === null || before !== local.outcome.step) return;
  local.undoing = true;
  try {
    await rb.keys.step('undo');
  } finally {
    local.undoing = false;
  }
  // `step` has put its words on the line already; a refusal leaves the line as it was.
  if (stepKey(rb.state.history) !== before && local.outcome?.step !== null) {
    local.outcome = { text: rb.top.stepDone('undo', step), step: null, catchUp: false };
  }
  renderFoot(rb);
  focusAction(rb);
}

/** Focus the first action a person can still press, else the counts. */
function focusAction(rb: RbCtx): void {
  const els = localOf(rb).els;
  if (!els) return;
  const target = [els.open, els.accept].find((button) => !button.hidden && !button.disabled);
  if (target) {
    target.focus();
    return;
  }
  els.counts.tabIndex = -1;
  els.counts.focus();
}

// ─── work ────────────────────────────────────────────────────────────────────

/**
 * A line kept past a remount: the Design handoff leaves the view, which mounts again
 * with a new context on the way back, and the person still needs to know what happened.
 * A mount adopts it in `wireFoot`, so the mount that set it never shows it.
 */
let carried: Carried | null = null;

/** Accept every suggestion and put the result on the line. Answers whether it went through. */
async function runAccept(rb: RbCtx): Promise<boolean> {
  const local = localOf(rb);
  local.outcome = null;
  local.working = true;
  renderFoot(rb);
  let outcome: RebrandEditOutcomeV1 | null;
  try {
    outcome = await rb.controller.acceptSuggestions();
  } catch {
    outcome = null;
  }
  local.working = false;
  const ok = Boolean(outcome?.ok);
  const text = outcome ? acceptOutcomeText(outcome) : BUSY();
  // Accepting changes most of the deck, so the line says the pane is catching up while it is.
  show(rb, text, { undo: ok, catchUp: ok });
  rb.announce(text);
  return ok;
}

export async function acceptAll(rb: RbCtx): Promise<void> {
  await runAccept(rb);
  // Accept all leaves once nothing is pending, so focus goes to the Undo beside the
  // result (or to Open in Design when there is none), never to the sentence.
  const els = localOf(rb).els;
  if (!els) return;
  const active = typeof document === 'undefined' ? null : document.activeElement;
  const lost = !(active instanceof HTMLElement) || active === document.body || active === els.accept || !active.isConnected;
  if (!lost) return;
  if (!els.outcome.hidden && !els.undo.hidden) els.undo.focus();
  else focusAction(rb);
}

/**
 * Wait for the Proposed pane to show the current plan, since Open in Design opens what
 * the pane showed. Answers false when it failed, the review ended or the wait ran out.
 */
function previewReady(rb: RbCtx): Promise<boolean> {
  const check = (state: RebrandStateV1): boolean | null => {
    if (state.phase !== 'review' || state.error?.step === 'preview') return false;
    if (!state.previewStale && state.plan && state.preview?.planRevision === state.plan.revision) return true;
    return null;
  };
  const now = check(rb.controller.getState());
  if (now !== null) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let off: (() => void) | null = null;
    const finish = (value: boolean): void => {
      if (done) return;
      done = true;
      off?.();
      if (timer !== null) clearTimeout(timer);
      resolve(value);
    };
    off = rb.controller.subscribe((state) => {
      const ready = check(state);
      if (ready !== null) finish(ready);
    });
    timer = setTimeout(() => finish(false), PREVIEW_WAIT_MS);
    rb.disposers.push(() => finish(false));
  });
}

/** How many slides the notice band's waiting rows are on: the pictures it speaks for. */
function bandSlides(rb: RbCtx): number {
  const band = bandCards(rb);
  const slides = new Set<string>();
  for (const item of reviewItems(rb)) if (band.has(item.id)) for (const id of item.slideIds) slides.add(id);
  return slides.size;
}

/** What is left before Open in Design, in the words the screen uses: cards, else the band's pictures. */
function leftText(rb: RbCtx): string {
  const cards = toReviewCount(rb);
  if (cards > 0) return cardsLeftText(cards);
  const pictures = bandSlides(rb);
  if (pictures === 1) return tRaw('1 slide is still a picture.');
  return pictures > 1 ? tRaw('{n} slides are still pictures.', { n: pictures }) : tRaw('Some suggestions are still to answer.');
}

/**
 * Open in Design, on `focusSlideId`'s frame when the slide menu asks. With rows left it
 * asks first, and on yes runs Accept all (its own undo step, named in the line), waits
 * for the pane, then opens (a second step). The question names what the screen shows:
 * the cards on the To review tab, or the pictures the notice band speaks for.
 */
export async function openInDesign(rb: RbCtx, focusSlideId?: string): Promise<void> {
  const local = localOf(rb);
  if ((rb.derived?.pendingIds.length ?? 0) > 0) {
    const cards = toReviewCount(rb);
    const pictures = cards === 0 ? bandSlides(rb) : 0;
    const ok = await confirmDialog({
      title: tRaw('Open in Design'),
      message: cards > 0 || pictures === 0 ? confirmOpenText(cards) : confirmPicturesText(pictures),
      confirmLabel: cards > 0 || pictures === 0 ? tRaw('Accept and open') : tRaw('Keep and open'),
      danger: false,
    });
    if (!ok) return;
    if (!(await runAccept(rb))) return;
    if (!(await previewReady(rb))) return;
  }
  local.working = true;
  renderFoot(rb);
  let outcome: RebrandOpenOutcomeV1;
  try {
    outcome = await rb.controller.openInDesign(focusSlideId ? { focusSlideId } : undefined);
  } catch {
    outcome = { ok: false, reason: 'handoff-failed', warnings: [] };
  }
  local.working = false;
  if (outcome.warnings.length) rb.report.notes(outcome.warnings);
  // A refusal over waiting rows says what the screen shows: the cards, or the pictures.
  const text = outcome.reason === 'unreviewed' ? leftText(rb) : openOutcomeText(outcome);
  const projectId = rb.state.project?.id;
  carried = null;
  if (projectId && outcome.ok) carried = { projectId, kind: 'returned', text: '', at: Date.now() };
  else if (projectId && outcome.reason === 'handoff-failed') carried = { projectId, kind: 'refused', text, at: Date.now() };
  say(rb, text);
}

// ─── wiring and drawing ──────────────────────────────────────────────────────

export function wireFoot(rb: RbCtx): void {
  const local = localOf(rb);
  const foot = rb.els.foot;
  foot.replaceChildren();
  foot.setAttribute('aria-label', tRaw('Finish'));
  local.carried = carried;
  carried = null;

  const info = node('div', 'rb-foot-info');
  const counts = node('p', 'rb-foot-counts');
  const report = node('button', 'btn btn--text btn--sm rb-foot-report', tRaw('Report'));
  report.type = 'button';
  info.append(counts, report);

  // A plain paragraph with no live role: `say` speaks through the view's live region.
  // The Undo sits outside the words, so the sentence reads on its own.
  const outcome = node('p', 'rb-foot-outcome');
  outcome.hidden = true;
  const said = node('span', 'rb-foot-said');
  const undo = node('button', 'btn btn--text btn--sm rb-foot-undo', tRaw('Undo'));
  undo.type = 'button';
  undo.hidden = true;
  outcome.append(said, undo);
  const reason = node('p', 'rb-foot-reason');
  reason.id = 'rb-foot-reason';
  reason.hidden = true;

  const act = node('div', 'rb-foot-actions');
  const accept = node('button', 'btn btn--primary rb-foot-accept', tRaw('Accept all suggestions'));
  accept.type = 'button';
  accept.title = ACCEPT_TITLE();
  const open = node('button', 'btn btn--ghost rb-foot-open', tRaw('Open in Design'));
  open.type = 'button';
  act.append(accept, open);

  foot.append(info, outcome, reason, act);
  local.els = { info, counts, report, outcome, said, undo, reason, accept, open };

  report.addEventListener('click', () => rb.report.open());
  undo.addEventListener('click', () => void undoFromLine(rb));
  accept.addEventListener('click', () => void acceptAll(rb));
  open.addEventListener('click', () => void openInDesign(rb));
}

export function renderFoot(rb: RbCtx): void {
  const local = localOf(rb);
  const els = local.els;
  const derived = rb.derived;
  if (!els || !derived) return;
  const { state } = rb;
  const { summary } = derived;
  const pending = derived.pendingIds.length;
  const toReview = toReviewCount(rb);
  const busy = local.working || state.phase === 'opening' || state.phase === 'reading' || state.phase === 'analysing';
  const failed = state.phase === 'failed';

  const adopted = local.carried;
  if (adopted && adopted.projectId === state.project?.id && !local.outcome) {
    local.carried = null;
    const text = adopted.kind === 'returned' ? returnText(adopted.at) : adopted.text;
    local.outcome = { text, step: null, catchUp: false };
    rb.announce(text);
  }
  // A line whose edit was undone from elsewhere (the top bar, a chord) is no longer true.
  // Read from the controller, as `show` reads it, so the two never disagree mid-render.
  const current = stepKey(rb.controller.getState().history);
  if (local.outcome?.step && local.outcome.step !== current && !local.undoing) local.outcome = null;

  const previewFailed = state.error?.step === 'preview';
  const waiting = previewPending(state);
  const yields = bandAsks(rb);
  const outcome = local.outcome;
  const key = JSON.stringify([
    summary.slides,
    pending,
    toReview,
    busy,
    failed,
    state.phase,
    outcome,
    current,
    previewFailed,
    waiting,
    yields,
    rb.narrow,
  ]);
  if (rb.memo.foot === key) return;
  rb.memo.foot = key;

  els.counts.textContent = countsLine(summary.slides.included, summary.slides.total, toReview, rb.narrow);

  // Open in Design waits only for what a person cannot answer from here; cards left are
  // answered by its confirm.
  const noSlides = summary.slides.included === 0;
  let reason = '';
  if (state.phase === 'opening') reason = tRaw('Opening the slides in Design.');
  else if (busy) reason = tRaw('Waiting for the current step to finish.');
  else if (failed) reason = tRaw('Fix the notice above first.');
  else if (previewFailed) reason = tRaw('The proposed slides could not be updated. Try again first.');
  else if (noSlides) reason = tRaw('Include at least 1 slide first.');
  else if (pending === 0 && waiting) reason = CATCH_UP();

  // Accept all shows while a card the To review tab counts waits: the band's rows are
  // answered in the band.
  els.accept.hidden = toReview === 0;
  els.accept.disabled = busy || failed;
  els.accept.textContent = rb.narrow ? tRaw('Accept all') : tRaw('Accept all suggestions');
  // One primary: Accept all while cards wait, else Open in Design; neither while the
  // notice band shows its own.
  const acceptLeads = toReview > 0 && !yields;
  const openLeads = toReview === 0 && !yields;
  els.accept.classList.toggle('btn--primary', acceptLeads);
  els.accept.classList.toggle('btn--ghost', !acceptLeads);
  els.open.classList.toggle('btn--primary', openLeads);
  els.open.classList.toggle('btn--ghost', !openLeads);
  els.open.disabled = Boolean(reason);

  els.reason.textContent = reason;
  els.reason.title = reason;
  els.reason.hidden = !reason;
  // The result takes the reason's place on screen while it shows; the reason stays for a
  // screen reader through aria-describedby.
  els.reason.classList.toggle('visually-hidden', Boolean(outcome));
  if (reason) els.open.setAttribute('aria-describedby', els.reason.id);
  else els.open.removeAttribute('aria-describedby');
  if (els.accept.disabled && reason) els.accept.setAttribute('aria-describedby', els.reason.id);
  else els.accept.removeAttribute('aria-describedby');

  const words = outcome ? (outcome.catchUp && waiting ? `${outcome.text} ${CATCH_UP()}` : outcome.text) : '';
  els.said.textContent = words;
  els.outcome.title = words;
  els.outcome.hidden = !outcome;
  const offersUndo = Boolean(outcome?.step) && outcome?.step === current;
  els.undo.hidden = !offersUndo;
  if (offersUndo) els.undo.setAttribute('aria-label', rb.top.stepDone('undo', rb.controller.getState().history.undo, 'button'));
  else els.undo.removeAttribute('aria-label');
  // On a phone the result stands where the counts were, so the footer keeps its row.
  els.info.classList.toggle('rb-foot-info--yield', Boolean(outcome));
}

export function footOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireFoot),
    render: bindOp(rb, renderFoot),
    accept: bindOp(rb, acceptAll),
    openInDesign: bindOp(rb, openInDesign),
    toReviewCount: bindOp(rb, toReviewCount),
    reviewItems: bindOp(rb, reviewItems),
    say: bindOp(rb, say),
  };
}
