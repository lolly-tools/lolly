// SPDX-License-Identifier: MPL-2.0
/**
 * Types, constants and pure helpers the `#/rebrand` feature modules share.
 *
 * Nothing here holds state or touches the controller. The review model itself is
 * the engine's (`rebrand-review.ts`: the queue, the three states per object and
 * slide, the summary), computed once per plan and kept on the context as
 * `rb.derived`, so the queue, the decision panel, the filmstrip, the report and the
 * footer all read the same numbers.
 */
import {
  archetypeForStructure,
  objectStates,
  planSummary,
  reviewQueue,
  slideStates,
  type ObjectStateV1,
  type PlanSummaryV1,
  type QueueItemV1,
  type SlideStateV1,
} from '@lolly/engine';
import type { SlideMasterV1, SlidePlanV1 } from '@lolly-tools/core';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { CompiledDeckV1, CompiledFrameV1, RenovationPlanV1, SourceDeckV1, SourceObjectV1 } from '@lolly-tools/core/rebrand-v1';
import type { RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import { openPendingIds } from '../../lib/rebrand/controller.ts';
import { tRaw } from '../../i18n.ts';

/** The view container, which main.ts reads a teardown function off. */
export type ViewElement = HTMLElement & { _cleanup?: () => void };

/** The host slice the view and its modules use. The controller's deps take the rest. */
export type RebrandHost = HostV1;

/**
 * The regions the orchestrator builds once. Each module renders only inside its own
 * region and never queries another module's.
 */
export interface RbElements {
  /** The whole view. `data-phase` and `data-mode` on it drive the layout. */
  root: HTMLElement;
  /** Top bar: title, design system, undo and redo, save state, overflow. */
  top: HTMLElement;
  /** Where the Renovate the layout / Keep the design control goes, inside the top bar. */
  modeSlot: HTMLElement;
  /** The intake: pick or drop a file, recent projects, reading progress, readiness. */
  intake: HTMLElement;
  /**
   * The review grid: queue, work area, decision column. Hidden until a plan exists, and
   * in Keep the design until its source does.
   */
  body: HTMLElement;
  /** Left column: needs attention, all slides, removed. */
  queue: HTMLElement;
  /** The grip between the queue and the work area. Hidden; the columns module fills it. */
  queueGrip: HTMLElement;
  /**
   * Centre: the before and after comparison with the object overlay. Keep the design
   * draws its own work area into this region too (keep.ts), and the comparison's own
   * markup steps aside while it does.
   */
  compare: HTMLElement;
  /** The grip between the work area and the decision column. Hidden; the columns module fills it. */
  decideGrip: HTMLElement;
  /** Right column: the selected object's decision, the slide, colours, fonts. */
  decide: HTMLElement;
  /** Its own row under the review grid: the windowed filmstrip. */
  strip: HTMLElement;
  /** The report drawer. */
  report: HTMLElement;
  /** Footer: counts, the report link, Accept all suggestions, Open in Design. */
  foot: HTMLElement;
  /** The one polite live region. Settled results only, never every tick. */
  status: HTMLElement;
  /**
   * The band under the top bar that carries a problem and the readiness rows once the
   * intake is hidden (a plan exists, or Keep the design has its source). intake.ts fills it.
   */
  alert: HTMLElement;
  /** The dimmer behind the report drawer and the narrow decision sheet. Clicking it closes them. */
  scrim: HTMLElement;
}

/** What the person has selected. An object implies its slide; a queue item implies its exemplar. */
export interface RbSelection {
  slideId: string | null;
  objectId: string | null;
  itemId: string | null;
  /**
   * The filmstrip's multi-selection (plan 275 section 5.5), by slide id, so a selected
   * slide outside the mounted window stays selected. It counts only while it holds
   * `slideId`, the slide the comparison shows: a selection made anywhere else (a queue
   * item, an object) that names another slide leaves the filmstrip with that one slide.
   * A new set replaces the old one, so the filmstrip's memo sees the change.
   */
  selSlides?: ReadonlySet<string>;
}

/**
 * The slides a filmstrip command acts on, in deck order: the multi-selection while it
 * holds the current slide, else the current slide alone. Empty with nothing selected.
 */
export function selectedSlideIds(sel: RbSelection, slides: ReadonlyArray<{ id: string }>): string[] {
  const current = sel.slideId;
  if (!current) return [];
  const set = sel.selSlides;
  if (!set || set.size < 2 || !set.has(current)) return [current];
  return slides.filter((slide) => set.has(slide.id)).map((slide) => slide.id);
}

/** Which list the queue column shows. */
export type RbQueueTab = 'attention' | 'all' | 'removed';

/** Which pane a narrow screen shows, or both side by side. */
export type RbCompareSide = 'both' | 'original' | 'proposed';

/** The engine's review model for one plan revision. */
export interface RbDerived {
  plan: RenovationPlanV1;
  queue: QueueItemV1[];
  slides: SlideStateV1[];
  objects: Map<string, ObjectStateV1>;
  summary: PlanSummaryV1;
  /** Queue item id for every object that belongs to one. */
  itemOfObject: Map<string, string>;
  /**
   * The rows Open in Design waits on (`openPendingIds`): the footer's reason and Accept
   * all suggestions read this one list. The queue's To review tab counts its cards.
   */
  pendingIds: string[];
}

/** Below this width the queue becomes chips, the comparison a toggle and the decision column a sheet. */
export const RB_NARROW_PX = 760;

/**
 * Below this width, and above `RB_NARROW_PX`, the queue becomes the chip row above the
 * comparison while the decision column stays, so the comparison keeps most of the width.
 */
export const RB_MEDIUM_PX = 1100;

/** How many filmstrip thumbnails stay mounted either side of the visible window. */
export const RB_STRIP_OVERSCAN = 4;

/**
 * The review model for the state's plan, or null before there is one (a plan always
 * comes after its census, so a missing census means no plan yet). Recomputed
 * only when the plan object changes; the caller keeps the previous result and
 * passes it back in.
 */
export function deriveReview(state: RebrandStateV1, previous: RbDerived | null): RbDerived | null {
  const { plan, census, source } = state;
  if (!plan || !source || !census) return null;
  if (previous && previous.plan === plan) return previous;
  const queue = reviewQueue(plan, census, source);
  const itemOfObject = new Map<string, string>();
  for (const item of queue) for (const id of item.objectIds) if (!itemOfObject.has(id)) itemOfObject.set(id, item.id);
  return {
    plan,
    queue,
    slides: slideStates(plan, source, census),
    objects: objectStates(plan, source),
    summary: planSummary(plan, source, census),
    itemOfObject,
    pendingIds: openPendingIds(plan),
  };
}

/** The compiled frames that came from one source slide: the first is the slide, the rest continuations. */
export function framesForSlide(frames: readonly CompiledFrameV1[], slideId: string): CompiledFrameV1[] {
  return frames.filter((frame) => frame.sourceSlideId === slideId);
}

/**
 * A slide title worth showing, or undefined. A title made only of underscores, dashes,
 * dots or white space (a placeholder someone typed over, a rule drawn in text) is no
 * title, so the caller falls back to "Slide 3".
 */
export function readableTitle(title: string | undefined): string | undefined {
  const text = title?.replace(/\s+/g, ' ').trim() ?? '';
  return /[\p{L}\p{N}]/u.test(text) ? text : undefined;
}

/** A source object's own words, collapsed, for a list row: its text, else its alt text. */
export function objectSnippet(object: SourceObjectV1 | undefined, max = 60): string {
  if (!object) return '';
  const text = (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join(' ').replace(/\s+/g, ' ').trim();
  return (text || object.alt || '').slice(0, max);
}

/**
 * The objects the compile could place on no slide, with the source slide each came
 * from: the plan's row first, else the source deck (the compile also sends an object
 * the plan does not list to the tray).
 */
export function unplacedOf(
  deck: CompiledDeckV1 | undefined,
  derived: RbDerived | null,
  source?: SourceDeckV1 | null,
): Array<{ objectId: string; slideId: string | null }> {
  return (deck?.tray ?? []).map((item) => ({
    objectId: item.sourceObjectId,
    slideId: derived?.objects.get(item.sourceObjectId)?.slideId
      ?? source?.slides.find((slide) => slide.objects.some((object) => object.id === item.sourceObjectId))?.id
      ?? null,
  }));
}

/** True when the viewport is at most `px` wide. */
function atMost(px: number): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(`(max-width: ${px}px)`).matches
    : false;
}

/** True when the viewport is under `px` tall. */
function shorterThan(px: number): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(`(max-height: ${px - 1}px)`).matches
    : false;
}

/**
 * True when the viewport is narrow enough for the stacked layout, or too short for the
 * columns: a phone on its side (under 480 px tall) takes the phone's layout, which
 * rebrand.css turns to the top bar, the slide, the strip and the footer.
 */
export function isNarrow(): boolean {
  return atMost(RB_NARROW_PX) || shorterThan(480);
}

/** True when the viewport is in the middle tier: the queue is a chip row, the decision column stays. */
export function isMedium(): boolean {
  return !isNarrow() && atMost(RB_MEDIUM_PX);
}

/** The layout the matcher leads with, as an archetype this master carries, or undefined. */
export function suggestedLayoutOf(master: SlideMasterV1 | null, slide: Pick<SlidePlanV1, 'layoutMatch'>): string | undefined {
  const match = slide.layoutMatch;
  if (!master || !match || match.band === 'none') return undefined;
  return archetypeForStructure(master, match.structure, { nearest: true })?.id;
}

/**
 * Who set a slide's layout, in one or two words, as plain text: the Layout band's
 * flag and the phone's layout row say the same word ("Suggested", "Yours", "Set by
 * Auto-match"). Escape it before it goes into markup.
 */
export function layoutFlagWord(slide: Pick<SlidePlanV1, 'layout' | 'layoutSource' | 'arrangement'>, suggested: string | undefined): string {
  if (slide.arrangement === 'original' || slide.arrangement === 'picture') return tRaw('Yours');
  if (slide.layoutSource === 'user') return tRaw('Yours');
  if (slide.layoutSource === 'preset') return tRaw('Set by the preset');
  if (slide.layoutSource === 'auto') return tRaw('Set by Auto-match');
  return suggested !== undefined && suggested === slide.layout ? tRaw('Suggested') : tRaw('By the rule');
}
