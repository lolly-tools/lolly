// SPDX-License-Identifier: MPL-2.0
/**
 * The context every `#/rebrand` feature module receives as its first argument (plan
 * 274 section 4): the view's state plus one namespace of bound operations per module.
 *
 * The rules are the ones every split view in this shell follows. A module function
 * takes `rb` first. Same-module calls are direct; a call into another module, and every
 * use of a function as a value (an event listener), goes through `rb.<module>.<fn>`, so
 * no feature module imports another. The only edges are module to this file and module
 * to `shared.ts`.
 *
 * Everything the person decides lives in the controller, not here. This context holds
 * what the view alone owns: the latest controller state, the review model derived from
 * it, the selection, which list and which pane are showing, and the regions.
 */
import type { RebrandControllerV1, RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import type { columnsOps } from './columns.ts';
import type { compareOps } from './compare.ts';
import type { decideOps } from './decide.ts';
import type { footOps } from './foot.ts';
import type { intakeOps } from './intake.ts';
import type { keepOps } from './keep.ts';
import type { keysOps } from './keys.ts';
import type { chooserOps } from './layout-chooser.ts';
import type { queueOps } from './queue.ts';
import type { reportOps } from './report.ts';
import type { dragOps } from './strip-drag.ts';
import type { stripOps } from './strip.ts';
import type { themeOps } from './theme.ts';
import type { topOps } from './top.ts';
import type { RbCompareSide, RbDerived, RbElements, RbQueueTab, RbSelection, RebrandHost, ViewElement } from './shared.ts';

export interface RbCtx {
  // ---- state ----
  viewEl: ViewElement;
  host: RebrandHost;
  params: URLSearchParams;
  els: RbElements;
  controller: RebrandControllerV1;
  /** The controller state the last render drew. */
  state: RebrandStateV1;
  /** The engine's review model for `state.plan`, or null before there is a plan. */
  derived: RbDerived | null;
  sel: RbSelection;
  queueTab: RbQueueTab;
  compareSide: RbCompareSide;
  reportOpen: boolean;
  narrow: boolean;
  /** Between the narrow and the wide layout: the queue shows as chips above the comparison. */
  medium: boolean;
  /**
   * Per-module memo keys, so a render that has nothing new to draw returns early.
   * A module reads and writes only its own key (its module name).
   */
  memo: Record<string, string>;
  /** Teardown work, run once when the view unmounts. */
  disposers: Array<() => void>;
  /** Redraw every module from `state`, `derived` and `sel`. Set by the orchestrator. */
  render: () => void;
  /** Change the selection and redraw. Set by the orchestrator. */
  select: (next: Partial<RbSelection>) => void;
  /** Say a settled result once, through the view's live region. Set by the orchestrator. */
  announce: (message: string) => void;

  // ---- one namespace per module ----
  intake: ReturnType<typeof intakeOps>;
  top: ReturnType<typeof topOps>;
  foot: ReturnType<typeof footOps>;
  report: ReturnType<typeof reportOps>;
  keep: ReturnType<typeof keepOps>;
  queue: ReturnType<typeof queueOps>;
  compare: ReturnType<typeof compareOps>;
  decide: ReturnType<typeof decideOps>;
  strip: ReturnType<typeof stripOps>;
  keys: ReturnType<typeof keysOps>;
  /** Plan 275: the layout chooser (layout-chooser.ts), the filmstrip drag (strip-drag.ts) and the deck theme (theme.ts). */
  chooser: ReturnType<typeof chooserOps>;
  drag: ReturnType<typeof dragOps>;
  theme: ReturnType<typeof themeOps>;
  /** Plan 275 close-out section 9.1: the grips between the columns (columns.ts). */
  columns: ReturnType<typeof columnsOps>;
}

/** A module function minus its leading context parameter. */
export type Op<F> = F extends (rb: RbCtx, ...a: infer A) => infer R ? (...a: A) => R : never;

/** Bind a module function to one context so it can be passed around as a value. */
export function bindOp<F extends (rb: RbCtx, ...a: never[]) => unknown>(rb: RbCtx, f: F): Op<F> {
  return ((...a: never[]) => f(rb, ...a)) as Op<F>;
}
