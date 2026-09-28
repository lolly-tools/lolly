// SPDX-License-Identifier: MPL-2.0
/**
 * Opening a saved document: the "Opening…" card (components/open-progress.ts) for the
 * length of the mount, and Cancel.
 *
 * Measured on a 19-page Design document opened from Projects: the editor drew nothing
 * for 5.9 s (its onInit ran out its 5 s budget) and the text arrived at 13.9 s, when
 * an onInput that had outrun its own budget applied late. The card covers both: the
 * mount's steps, then `runtime.whenSettled()` until that late patch is applied.
 *
 * Cancel is cooperative. The mount checks `stopped()` after each step and unwinds with
 * `abandon()`; the longest step (the runtime and its onInit) is raced instead, so
 * Cancel does not wait out a hook's budget. Nothing the open read is written back.
 *
 * With pages shown as they finish (engine progressiveInit, Design's reports), the
 * editor mounts once the first page is laid out. The card then lifts so the rest can be
 * seen arriving, and the job toast counts the stories still to come.
 */
import { openProgress, type OpenPhase } from '../../components/open-progress.ts';
import { resolveBackTarget } from '../../components/back-pill.ts';
import { takeOpenIntent } from '../../lib/open-intent.ts';
import { onTextLayoutDone, textLayoutsDone } from '../../lib/text-layout-progress.ts';
import { dismissJob, startJob } from '../../lib/jobs.ts';
import { navigateTo } from '../../nav.ts';
import { t } from '../../i18n.ts';
import type { ToolViewCtx } from './context.ts';

/** Stories laid out since the open began, against the document's story count. */
interface LayoutTracker {
  readonly done: number;
  /** Null until the first layout is done, and for a tool with no composed text. */
  readonly total: number | null;
  listen(fn: () => void): () => void;
  stop(): void;
}
const trackers = new WeakMap<ToolViewCtx, LayoutTracker>();

/**
 * Count the host's finished layouts from now on. The total is read at the first one,
 * when the seeded values exist. It outlives the card: after a progressive open the job
 * toast keeps counting.
 */
function trackLayouts(tview: ToolViewCtx): LayoutTracker {
  const mark = textLayoutsDone(), listeners = new Set<() => void>();
  let total: number | null | undefined, done = 0;
  const off = onTextLayoutDone((count) => {
    if (total === undefined) total = storyCount(tview);
    done = count - mark;
    for (const listener of [...listeners]) listener();
  });
  return {
    get done() { return done; },
    get total() { return total ?? null; },
    listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    stop() { off(); listeners.clear(); },
  };
}

/**
 * How long the card waits for the document's late layout once the editor is built.
 * A hook that never settles must not leave a modal up for ever: past this the card
 * goes and the editor, which is already usable, takes over.
 */
export const OPEN_SETTLE_CAP_MS = 60_000;

/**
 * Put the card up for a saved document (`slot`). Anything else opens as before, and so
 * does a scripted export of a slot (`?slot=…&export`, docs/url-export.md): nobody is
 * watching it, and a modal would make the page inert under the script.
 */
export function begin(tview: ToolViewCtx, slot: string | null): void {
  tview.openCard = null;
  if (!slot || new URLSearchParams(tview.urlParams || '').has('export')) return;
  const intent = takeOpenIntent(slot);
  // Progress through a long text document: the host counts finished layouts, one per
  // story, and the saved document says how many stories there are.
  const tracker = trackLayouts(tview);
  trackers.set(tview, tracker);
  let handedOff = false;
  const card = openProgress({
    name: intent?.name, thumb: intent?.thumb,
    // However the open ends, the counting ends with it, unless finish() handed it on.
    onClose: () => { offCard(); if (!handedOff) tracker.stop(); },
  });
  const offCard = tracker.listen(() => { if (tracker.total) card.progress(tracker.done, tracker.total); });
  handOff.set(card, () => { handedOff = true; });
  card.phase('document');
  tview.openCard = card;
  // The router asks the outgoing view before it leaves (main.ts navigate()), so Back or
  // a link during the open arrives here: the card goes at once and the mount stops at
  // its next step. It never refuses a leave. The tool view has no leave guard of its
  // own; one added later has to keep calling `left()` while an open is running.
  tview.viewEl._beforeLeave = async () => {
    card.left();
    return true;
  };
}

/** Marks a card's tracker as handed on to the job toast before the card closes. */
const handOff = new WeakMap<object, () => void>();

/**
 * How many text stories the opened document holds, or null when the tool keeps no
 * composed text. Found through the canvas setting `canvas.textDocumentInput` (Design's
 * `textDocument`), so no tool is named here.
 */
function storyCount(tview: ToolViewCtx): number | null {
  const owner = tview.tool.manifest.inputs.find((input) => (input as { canvas?: { textDocumentInput?: string } }).canvas?.textDocumentInput);
  const id = (owner as { canvas?: { textDocumentInput?: string } } | undefined)?.canvas?.textDocumentInput;
  const raw: unknown = id ? tview.initialValues?.[id] : undefined;
  try {
    const doc = typeof raw === 'string' ? JSON.parse(raw) as { stories?: unknown[] } : raw as { stories?: unknown[] } | undefined;
    const n = Array.isArray(doc?.stories) ? doc.stories.length : 0;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function phase(tview: ToolViewCtx, p: OpenPhase): void {
  tview.openCard?.phase(p);
}

/** Has the open been stopped by Cancel, Escape or a navigation? */
export function stopped(tview: ToolViewCtx): boolean {
  return !!tview.openCard?.stop();
}

/**
 * Await one mount step, unless the open is stopped first. True when the step finished
 * and the open goes on. When the open is stopped mid-step the step keeps running to its
 * end, since nothing can interrupt the step, and the runtime it creates is destroyed
 * when the step ends: this mount will never use that runtime.
 */
export async function race(tview: ToolViewCtx, step: Promise<void>): Promise<boolean> {
  const card = tview.openCard;
  if (!card) {
    await step;
    return true;
  }
  const done = await Promise.race([step.then(() => true), card.stopped.then(() => false)]);
  if (done && !card.stop()) return true;
  void step.then(() => tview.runtime?.destroy?.(), () => {});
  return false;
}

/**
 * Unwind a stopped open. The caller releases the team-session origin (the tool view's
 * early returns each do so in place, see views/tool-team-origin.test.ts).
 *
 * After a navigation (`left`) the view belongs to the next route, which has already run
 * whatever teardown this mount had assigned, so only this mount's own pieces go. After
 * Cancel the view is still this mount's: its teardown runs, when it has one yet, the
 * half-built view is cleared and the person goes back to where they opened it from.
 */
export function abandon(tview: ToolViewCtx): void {
  const { viewEl } = tview;
  const why = tview.openCard?.stop();
  tview.openCard?.close();
  clearTimeout(tview.loadingTimer);
  if (why !== 'left') {
    const cleanup = viewEl._cleanup;
    delete viewEl._cleanup;
    delete viewEl._beforeLeave;
    try {
      cleanup?.();
    } catch (e) {
      console.error('[tool] cancelled open teardown:', e);
    }
  }
  // Before the teardown exists (it is assigned in wireCanvas) these are the pieces the
  // mount holds. Each is idempotent, so a teardown that already ran them costs nothing.
  tview.mountLifecycle.dispose();
  window.removeEventListener('lolly:design-system-changed', tview.designSystem.onDesignSystemChanged);
  tview.runtime?.destroy?.();
  if (why === 'left') return;
  viewEl.replaceChildren();
  leave();
}

/** Back to where the document was opened from - the same answer the back pill gives. */
function leave(): void {
  const target = resolveBackTarget();
  if (target.useHistory && window.history.length > 1) window.history.back();
  else navigateTo(target.href);
}

/**
 * The mount is built; hold the card until the document is laid out. Detached from the
 * mount, so the router's own post-mount work is not delayed. Cancel here is an
 * ordinary leave: the view is whole and its teardown is in place.
 */
export async function finish(tview: ToolViewCtx): Promise<void> {
  const card = tview.openCard;
  if (!card) return;
  card.phase('layout');
  // A progressive open: the editor mounted on the first finished page and the rest is
  // still landing. Lift the card so those pages can be seen arriving, and count the
  // stories still to come in the job toast rather than over the document.
  const tracker = trackers.get(tview);
  if (tracker?.total && tracker.done > 0 && tracker.done < tracker.total) {
    handOff.get(card)?.();
    card.close();
    await countRemaining(tview, tracker);
    return;
  }
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<'cap'>((resolve) => { capTimer = setTimeout(() => resolve('cap'), OPEN_SETTLE_CAP_MS); });
  const outcome = await Promise.race([
    tview.runtime.whenSettled().then(() => 'settled' as const),
    card.stopped,
    cap,
  ]);
  clearTimeout(capTimer);
  if (outcome === 'cancel') {
    card.close();
    leave();
    return;
  }
  // Let the late patch paint before the card lifts, so the first thing seen is the
  // document as it will stay.
  if (outcome === 'settled') await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  card.close();
}

/**
 * The rest of a progressive open, as a light job: "Laying out text" with its count,
 * gone when the runtime settles or the view is left. It is dismissed before it
 * finishes, so it leaves without a "Done" row or a notification: the text appearing on
 * the page is the whole story.
 */
async function countRemaining(tview: ToolViewCtx, tracker: LayoutTracker): Promise<void> {
  const total = tracker.total!;
  const job = startJob({ title: t('Laying out text'), heavy: false });
  const show = (): void => job.progress(Math.min(tracker.done, total), total);
  show();
  const off = tracker.listen(show);
  let ended = false;
  const end = (): void => {
    if (ended) return;
    ended = true;
    off();
    tracker.stop();
    dismissJob(job.id);
    job.finish();
  };
  tview.mountLifecycle.add('text layout progress', end);
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    tview.runtime.whenSettled(),
    new Promise<void>((resolve) => { capTimer = setTimeout(resolve, OPEN_SETTLE_CAP_MS); }),
  ]);
  clearTimeout(capTimer);
  end();
}

export const openDocumentOps = (tview: ToolViewCtx) => ({
  begin: (slot: string | null) => begin(tview, slot),
  phase: (p: OpenPhase) => phase(tview, p),
  stopped: () => stopped(tview),
  race: (step: Promise<void>) => race(tview, step),
  abandon: () => abandon(tview),
  finish: () => finish(tview),
});
