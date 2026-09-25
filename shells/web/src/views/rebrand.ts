// SPDX-License-Identifier: MPL-2.0
/**
 * #/rebrand - renovate an old deck into an on-brand one (plan 274 sections 2.1 and 4).
 *
 * Drop a pptx, see the first slide beside the proposed slide, work through a short queue
 * of grouped proposals (Keep, Replace or Remove, each with its evidence and a named
 * scope), then open the result in Design as artboards. "Keep the design" is the other
 * mode: the original file with the design system's theme, colours and fonts swapped in
 * place, for a person who wants the old layout.
 *
 * This file is the orchestrator: it builds the regions once, creates the context, wires
 * the feature modules in order and redraws them from the controller's state. It holds
 * no decision logic. The controller (`lib/rebrand/controller.ts`) owns the project and
 * outlives the view, so leaving the view does not stop a running stage and returning
 * shows the same project. Params: `?project=<id>` opens a stored project, `?mode=keep`
 * starts in Keep the design; the files the drop router handed over are read by the
 * intake, several decks at once as one read.
 *
 * A newer version of a deck adds two items to the engine's queue (`lineageQueueItems`
 * in the controller) when the review model is derived: the objects that changed, at the
 * head of the attention section, counted as every other item is; and the decisions
 * carried from the last version, settled, which the queue shows as a note.
 *
 * Results a person must see (a preset saved or applied, a newer version being read) go
 * to the footer's outcome line through `rb.foot.say`, as well as to the live region.
 */
// The cascade order rebrand.css states at its top: the grid first, then each region's
// sheet in region order. A later sheet wins a tie, so the order is part of the look.
import '../styles/parts/rebrand.css';
import '../styles/parts/rebrand-top.css';
import '../styles/parts/rebrand-intake.css';
import '../styles/parts/rebrand-queue.css';
import '../styles/parts/rebrand-compare.css';
import '../styles/parts/rebrand-decide.css';
import '../styles/parts/rebrand-strip.css';
import '../styles/parts/rebrand-foot.css';
import '../styles/parts/rebrand-report.css';
import '../styles/parts/rebrand-keep.css';
import '../styles/parts/rebrand-chooser.css';
import '../styles/parts/rebrand-theme.css';
import '../styles/parts/rebrand-columns.css';
import { t, tRaw } from '../i18n.ts';
import type { RebrandFinishedJobV1, RebrandStateV1 } from '../lib/rebrand/controller-api.ts';
import { queueWithLineage, rebrandControllerFor } from '../lib/rebrand/controller.ts';
import { createRebrandDeps } from '../lib/rebrand/deps.ts';
import { designOpener } from '../lib/rebrand/design-open.ts';
import { keepDesignPatch } from '../lib/rebrand/keep-design.ts';
import { setRebrandPictureUpload } from '../lib/rebrand/user-assets.ts';
import { columnsOps } from './rebrand/columns.ts';
import { compareOps } from './rebrand/compare.ts';
import type { RbCtx } from './rebrand/context.ts';
import { decideOps } from './rebrand/decide.ts';
import { footOps } from './rebrand/foot.ts';
import { intakeOps } from './rebrand/intake.ts';
import { keepOps } from './rebrand/keep.ts';
import { keysOps } from './rebrand/keys.ts';
import { chooserOps } from './rebrand/layout-chooser.ts';
import { queueOps } from './rebrand/queue.ts';
import { reportOps } from './rebrand/report.ts';
import {
  RB_MEDIUM_PX,
  RB_NARROW_PX,
  deriveReview,
  isMedium,
  isNarrow,
  type RbDerived,
  type RbElements,
  type RbSelection,
  type RebrandHost,
  type ViewElement,
} from './rebrand/shared.ts';
import { dragOps } from './rebrand/strip-drag.ts';
import { stripOps } from './rebrand/strip.ts';
import { themeOps } from './rebrand/theme.ts';
import { topOps } from './rebrand/top.ts';

/**
 * Build the regions once. Modules fill them; none of them creates a region of its own.
 * Five rows: the top bar, the notice band, the intake or the review grid, the filmstrip
 * and the footer. The filmstrip is a row of its own, not part of the work area, and the
 * two grips between the columns start hidden (columns.ts fills them). Keep the design
 * draws into the comparison region, so it has no region of its own.
 */
export function buildRegions(viewEl: HTMLElement): RbElements {
  viewEl.innerHTML = `
    <div class="rb" data-phase="idle" data-mode="renovate">
      <header class="rb-top"><div class="rb-mode-slot"></div></header>
      <section class="rb-alert" hidden aria-label="${t('Notices')}"></section>
      <section class="rb-intake" aria-label="${t('Choose a deck')}"></section>
      <div class="rb-body" hidden>
        <nav class="rb-queue" aria-label="${t('Review queue')}"></nav>
        <div class="rb-grip" data-grip="queue" hidden></div>
        <main class="rb-work">
          <section class="rb-compare" aria-label="${t('Original and proposed slide')}"></section>
        </main>
        <div class="rb-grip" data-grip="decide" hidden></div>
        <aside class="rb-decide" aria-label="${t('Decision')}"></aside>
      </div>
      <nav class="rb-strip" hidden aria-label="${t('Slides')}"></nav>
      <footer class="rb-foot" hidden></footer>
      <div class="rb-scrim" hidden aria-hidden="true"></div>
      <aside class="rb-report" hidden aria-label="${t('Report')}"></aside>
      <p class="rb-status visually-hidden" role="status" aria-live="polite" data-a11y-live></p>
    </div>`;
  const q = (selector: string): HTMLElement => {
    const el = viewEl.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`rebrand: region ${selector} missing`);
    return el;
  };
  return {
    root: q('.rb'),
    top: q('.rb-top'),
    modeSlot: q('.rb-mode-slot'),
    intake: q('.rb-intake'),
    body: q('.rb-body'),
    queue: q('.rb-queue'),
    queueGrip: q('.rb-grip[data-grip="queue"]'),
    compare: q('.rb-compare'),
    decideGrip: q('.rb-grip[data-grip="decide"]'),
    decide: q('.rb-decide'),
    strip: q('.rb-strip'),
    report: q('.rb-report'),
    foot: q('.rb-foot'),
    status: q('.rb-status'),
    alert: q('.rb-alert'),
    scrim: q('.rb-scrim'),
  };
}

/**
 * The derived model with the items a newer version adds (`queueWithLineage`). Applied
 * once per derived model, which is recomputed only when the plan changes.
 */
function withLineageItems(derived: RbDerived, state: RebrandStateV1): RbDerived {
  derived.queue = queueWithLineage(derived.queue, derived.plan, state.source);
  return derived;
}

/**
 * Keep the selection pointing at something that exists. With nothing selected, the
 * first item needing attention is selected, else the first included slide, so the view
 * always opens on a comparison rather than on an empty pane.
 */
function settleSelection(rb: RbCtx): void {
  const derived = rb.derived;
  if (!derived) {
    rb.sel = { slideId: null, objectId: null, itemId: null };
    return;
  }
  const { sel } = rb;
  if (sel.itemId && !derived.queue.some((item) => item.id === sel.itemId)) sel.itemId = null;
  if (sel.objectId && !derived.objects.has(sel.objectId)) sel.objectId = null;
  if (sel.slideId && !derived.slides.some((slide) => slide.id === sel.slideId)) sel.slideId = null;
  if (sel.slideId) return;
  const first = derived.queue.find((item) => item.section === 'attention');
  if (first) {
    sel.itemId = first.id;
    sel.objectId = first.exemplar;
    sel.slideId = derived.objects.get(first.exemplar)?.slideId ?? first.slideIds[0] ?? null;
    return;
  }
  sel.slideId = derived.slides.find((slide) => slide.include)?.id ?? derived.slides[0]?.id ?? null;
}

/**
 * Which regions show for the current phase and mode. Keep the design shows the review
 * grid once its source is read, for the comparison region its work area draws into; the
 * columns and the review's own comparison step aside there (rebrand.css). Its filmstrip
 * shows as in the review, where it only selects the slide the stage compares.
 */
export function applyLayout(rb: Pick<RbCtx, 'els' | 'state' | 'narrow' | 'medium' | 'reportOpen'>): void {
  const { els, state } = rb;
  const hasPlan = Boolean(state.plan);
  const keep = state.mode === 'keep-design';
  els.root.dataset.phase = state.phase;
  els.root.dataset.mode = state.mode;
  els.root.dataset.narrow = rb.narrow ? 'true' : 'false';
  els.root.dataset.medium = rb.medium ? 'true' : 'false';
  els.intake.hidden = hasPlan || (keep && Boolean(state.source));
  els.body.hidden = keep ? !state.source : !hasPlan;
  els.strip.hidden = !hasPlan;
  els.foot.hidden = !hasPlan || keep;
  els.report.hidden = !rb.reportOpen;
}

/**
 * The sentence said when the review appears, with the number and the words the To
 * review tab and the footer use: cards still to review, never objects.
 */
function arrivalText(rb: RbCtx): string {
  const n = rb.foot.toReviewCount();
  if (n === 0) return tRaw('The deck is read, and nothing is left to review.');
  return n === 1
    ? tRaw('The deck is read, and 1 card is left to review.')
    : tRaw('The deck is read, and {n} cards are left to review.', { n });
}

/** How long the finished read's toast stays after the arrival sentence (close-out section 2.1). */
const ARRIVAL_DISMISS_MS = 4000;

/**
 * When a project's review first appears, announce it once and put focus somewhere real:
 * the button that started the read (Choose file, a recent project's Open) was just
 * hidden with the intake, so focus would otherwise fall to the page.
 */
function arrive(rb: RbCtx, arrived: { id: string | null; job?: RebrandFinishedJobV1 }): void {
  const { state } = rb;
  const id = state.project?.id ?? null;
  // A finished job's toast, if it showed at all (the person left the intake while it
  // ran), goes a few seconds after the work area shows its result (close-out section
  // 2.1): the read in Renovate the layout, the swap in Keep the design. The job can
  // finish just after the work area appears, so each finished job is taken once.
  const finished = state.finishedJob;
  if (finished && finished !== arrived.job && id && !rb.els.body.hidden) {
    arrived.job = finished;
    const timer = setTimeout(() => finished.dismiss(), ARRIVAL_DISMISS_MS);
    rb.disposers.push(() => clearTimeout(timer));
  }
  const reviewing = state.phase === 'review' && Boolean(state.plan) && state.mode === 'renovate';
  if (!reviewing || !id) {
    if (!id) arrived.id = null;
    return;
  }
  if (arrived.id === id) return;
  arrived.id = id;
  rb.announce(arrivalText(rb));
  const active = typeof document === 'undefined' ? null : document.activeElement;
  const lost = !(active instanceof HTMLElement) || active === document.body || !active.isConnected || rb.els.intake.contains(active);
  if (!lost) return;
  const first = rb.els.queue.querySelector<HTMLElement>('.rb-q-item, .rb-q-chip, [data-tab]');
  if (first) first.focus();
  else {
    rb.els.queue.tabIndex = -1;
    rb.els.queue.focus();
  }
}

/**
 * Keep the address a live deep link: the open project and the mode ride in the query,
 * so a reload or a copied link opens the same project. replaceState fires no
 * hashchange, so the route does not remount.
 */
function syncUrl(viewEl: HTMLElement, state: RebrandStateV1, onUrlSync?: () => void): void {
  if (typeof window === 'undefined' || !viewEl.isConnected) return;
  if (!window.location.hash.startsWith('#/rebrand')) return;
  const query = new URLSearchParams();
  if (state.project) query.set('project', state.project.id);
  if (state.mode === 'keep-design') query.set('mode', 'keep');
  const url = `#/rebrand${query.size ? `?${query}` : ''}`;
  if (window.location.hash === url) return;
  window.history.replaceState(window.history.state, '', url);
  // The router keys this route on its params. Without this, the pop of a dialog's
  // history entry reads the new URL as a different route and mounts the view again,
  // which drops the selection and anything just announced.
  onUrlSync?.();
}

/**
 * `onUrlSync` runs after the view rewrites its own URL (the open project, the mode), so
 * the router can record the route it now shows.
 */
export async function mountRebrand(view: HTMLElement, host: RebrandHost, params: string, onUrlSync?: () => void): Promise<void> {
  const viewEl = view as ViewElement;
  // lib/ never imports views/, so the view hands the picker's upload to the ingest. The
  // picker module loads only when a deck's first picture is stored.
  setRebrandPictureUpload(async (target, file, opts) => (await import('./picker.ts')).storeUserUpload(target, file, opts));
  const els = buildRegions(viewEl);
  const controller = rebrandControllerFor(host, () => createRebrandDeps(host, {
    design: designOpener(host),
    keepDesign: keepDesignPatch(host),
  }));

  const rb = {} as RbCtx;
  rb.viewEl = viewEl;
  rb.host = host;
  rb.params = new URLSearchParams(params.startsWith('?') ? params.slice(1) : params);
  rb.els = els;
  rb.controller = controller;
  rb.state = controller.getState();
  rb.derived = null;
  rb.sel = { slideId: null, objectId: null, itemId: null };
  rb.queueTab = 'attention';
  rb.narrow = isNarrow();
  rb.medium = isMedium();
  // A phone shows one pane at a time, and the proposed slide is the one being decided on.
  rb.compareSide = rb.narrow ? 'proposed' : 'both';
  rb.reportOpen = false;
  rb.memo = {};
  rb.disposers = [];

  rb.render = () => {
    const before = rb.derived;
    rb.derived = deriveReview(rb.state, rb.derived);
    if (rb.derived && rb.derived !== before) withLineageItems(rb.derived, rb.state);
    settleSelection(rb);
    applyLayout(rb);
    rb.top.render();
    rb.keep.render();
    rb.intake.render();
    if (rb.derived) {
      rb.queue.render();
      rb.compare.render();
      rb.decide.render();
      rb.strip.render();
      rb.columns.render();
      rb.foot.render();
    }
    rb.report.render();
    // The report carries its own dimmer; this one is for the narrow decision sheet.
    els.scrim.hidden = !rb.decide.sheetOpen() || rb.reportOpen;
  };
  rb.select = (next: Partial<RbSelection>) => {
    rb.sel = { ...rb.sel, ...next };
    rb.render();
    if (rb.sel.slideId) rb.strip.reveal(rb.sel.slideId);
  };
  // Every call is said, even the same words twice in a row (a second Remove, a second
  // Undo): the region is emptied and refilled a frame later, so a screen reader hears it
  // again. A render that could repeat itself keeps its own memo of what it said.
  let announceSeq = 0;
  rb.announce = (message: string) => {
    if (!message) return;
    announceSeq += 1;
    const seq = announceSeq;
    if (els.status.textContent !== message) {
      els.status.textContent = message;
      return;
    }
    els.status.textContent = '';
    const again = (): void => {
      if (seq === announceSeq) els.status.textContent = message;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(again);
    else setTimeout(again, 0);
  };

  rb.intake = intakeOps(rb);
  rb.top = topOps(rb);
  rb.foot = footOps(rb);
  rb.report = reportOps(rb);
  rb.keep = keepOps(rb);
  rb.queue = queueOps(rb);
  rb.compare = compareOps(rb);
  rb.decide = decideOps(rb);
  rb.strip = stripOps(rb);
  rb.keys = keysOps(rb);
  rb.chooser = chooserOps(rb);
  rb.drag = dragOps(rb);
  rb.theme = themeOps(rb);
  rb.columns = columnsOps(rb);

  rb.top.wire();
  rb.keep.wire();
  rb.intake.wire();
  rb.queue.wire();
  rb.compare.wire();
  rb.decide.wire();
  rb.strip.wire();
  rb.report.wire();
  rb.foot.wire();
  rb.keys.wire();
  rb.columns.wire();

  // While the intake is on screen it shows the reading itself (its frames row), so the
  // read job keeps its toast off. Leaving the view hands the reading back to the toast.
  controller.quietJobsWhile?.(() => viewEl.isConnected && !els.intake.hidden);
  rb.disposers.push(() => controller.quietJobsWhile?.(null));

  // The address follows the project only once the mount's own open has settled, so
  // an early emit cannot drop the ?project= this mount is about to open.
  let urlLive = false;
  // A job that finished before this mount is left to the toast's own retention.
  const arrived: { id: string | null; job?: RebrandFinishedJobV1 } = {
    id: controller.getState().plan ? controller.getState().project?.id ?? null : null,
    job: controller.getState().finishedJob,
  };
  rb.disposers.push(controller.subscribe((state) => {
    rb.state = state;
    rb.render();
    arrive(rb, arrived);
    if (urlLive) syncUrl(viewEl, state, onUrlSync);
  }));

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    // A phone turned on its side is narrow too (isNarrow counts a viewport under 480 px
    // tall), so the tier follows the height as well as the width.
    const queries = [
      window.matchMedia(`(max-width: ${RB_NARROW_PX}px)`),
      window.matchMedia(`(max-width: ${RB_MEDIUM_PX}px)`),
      window.matchMedia('(max-height: 479px)'),
    ];
    const onChange = (): void => {
      const wasNarrow = rb.narrow;
      rb.narrow = isNarrow();
      rb.medium = isMedium();
      if (rb.narrow && !wasNarrow && rb.compareSide === 'both') rb.compareSide = 'proposed';
      rb.render();
    };
    for (const query of queries) query.addEventListener('change', onChange);
    rb.disposers.push(() => {
      for (const query of queries) query.removeEventListener('change', onChange);
    });
  }

  // The report drawer starts under the top bar, and the global job toast keeps clear of
  // the footer, the filmstrip and the decision column, so neither covers the controls a
  // person reaches for. On a narrow screen the column is a sheet, so the toast only rises.
  if (typeof ResizeObserver === 'function') {
    const measure = (): void => {
      const topEdge = Math.round(els.top.getBoundingClientRect().bottom);
      els.root.style.setProperty('--rb-top-h', `${Math.max(0, topEdge)}px`);
      const foot = els.foot.hidden ? 0 : Math.round(els.foot.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--rb-foot-h', `${foot}px`);
      const strip = els.strip.hidden ? 0 : Math.round(els.strip.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--rb-strip-h', `${strip}px`);
      const column = rb.narrow || els.body.hidden ? 0 : Math.round(els.decide.getBoundingClientRect().width);
      document.documentElement.style.setProperty('--rb-decide-w', `${column}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(els.top);
    observer.observe(els.foot);
    observer.observe(els.decide);
    observer.observe(els.strip);
    rb.disposers.push(() => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--rb-foot-h');
      document.documentElement.style.removeProperty('--rb-strip-h');
      document.documentElement.style.removeProperty('--rb-decide-w');
    });
  }

  // The narrow sheet closes when the dimmer behind it is pressed.
  const onScrim = (): void => rb.decide.closeSheet();
  els.scrim.addEventListener('click', onScrim);
  rb.disposers.push(() => els.scrim.removeEventListener('click', onScrim));

  viewEl._cleanup = () => {
    for (const dispose of rb.disposers.splice(0)) {
      try {
        dispose();
      } catch {
        /* one failing teardown must not keep the others from running */
      }
    }
  };

  rb.render();

  const projectId = rb.params.get('project');
  // ?mode=keep picks the mode for a fresh start or for the project the link names. The
  // controller outlives the view, so a bare link (the retired rebrand-deck tool) must not
  // flip a renovation that is already open into Keep the design.
  if (rb.params.get('mode') === 'keep' && (!controller.getState().project || projectId)) await controller.setMode('keep-design');
  try {
    if (projectId && controller.getState().project?.id !== projectId) await controller.open(projectId);
  } finally {
    urlLive = true;
    syncUrl(viewEl, controller.getState(), onUrlSync);
  }
}
