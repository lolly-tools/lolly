// SPDX-License-Identifier: MPL-2.0
/**
 * Per-canvas commit channel - the 1:1 path an interactive tool uses to write a
 * value back to ITS OWN runtime.
 *
 * Interactive tool templates (gradient dot drags, street-map pan/zoom)
 * historically committed a canvas edit by reaching into the sidebar with a
 * GLOBAL `document.querySelector('[data-input-id="…"]')` + a bubbling `input`
 * event. That assumes exactly one sidebar bound to one runtime - true in the
 * single-tool view, FALSE in multi-edit (#/multi), where the FIRST match in
 * document order is the shared "fan" control bound to every sibling session, so
 * a drag on one canvas leaks the value to every similar tool. The tool has no
 * way to know which of the N canvases it came from.
 *
 * The shell instead hands each mounted canvas its own commit function keyed to
 * the runtime that owns it. A tool script resolves it from its OWN subtree:
 *
 *     var root = wrap.closest('[data-lolly-canvas]');
 *     var commit = root && root.__lollyCommit;
 *     if (commit) commit('pos1', { x: 12, y: 34 });   // 1:1 - this canvas only
 *     else …legacy sidebar poke…                      // offscreen export / old shell
 *
 * `data-lolly-canvas` is set on the STABLE canvas container (it survives the
 * innerHTML swap each paint does), so a script may also park per-instance state
 * on that element instead of on `window.__*` globals that N instances stomp.
 */
import type { Runtime, RuntimeState } from '../../../../engine/src/runtime.js';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.js';

export interface CanvasCommitEl extends HTMLElement {
  /** Commit `id`→`value` to the runtime that owns THIS canvas (1:1, never fanned). */
  __lollyCommit?: (id: string, value: InputValue) => void;
  /**
   * READ the current input model of the runtime that owns THIS canvas. The dual of
   * `__lollyCommit`: a tool that keeps its declared inputs as a pure DATA channel
   * (never referenced in its template markup, so hydrated output stays byte-constant)
   * seeds its own DOM from the model at boot by reading it here. Returns the live
   * `InputModelItem[]` - the same array `runtime.getModel()` hands the shell, swapped
   * wholesale on every change, so read it fresh each time rather than caching.
   */
  __lollyModel?: () => InputModelItem[];
  /**
   * Subscribe to model changes on the runtime that owns THIS canvas, returning an
   * unsubscribe function. Fires once immediately with the current state, then on every
   * edit (including edits that arrived from a collab peer, since inbound ops apply
   * through the same model). A tool using its inputs as a data channel mirrors remote
   * edits into its own DOM from here - echo-swallowing its own just-committed values so
   * the loop settles. `cb` receives the full `RuntimeState` ({ model, hydrated }); there
   * is no per-id diff, so compare each input's value against what the DOM already holds.
   */
  __lollySubscribe?: (cb: (state: RuntimeState) => void) => () => void;
  /**
   * Re-run `id`'s CURRENT runtime value through onInput, with no undo-history
   * entry. For canvas pollers waiting on an async extra (e.g. redact's PDF page
   * previews): a poller that re-commits a value it captured at paint time can
   * overwrite an edit or undo that landed in the rAF gap before repaint, and
   * its commit coalesces into (and silently rewrites) the user's history entry.
   * The nudge reads the live value at tick time instead, so it is always a
   * no-op on the model and only re-derives hook extras.
   */
  __lollyNudge?: (id: string) => void;
  /**
   * Mount the shell's ONE colour picker (components/color-field.ts) into a
   * container the tool owns - the same field every sidebar colour input uses,
   * so a tool's on-canvas colour affordance (the gradient tool's mesh-node
   * popover) offers the full picker instead of hand-rolling swatches around a
   * native `<input type=color>` (which the shell itself never opens). The
   * component is imported lazily at call time so this module stays type-only
   * for its node-run unit test. Absent offscreen and in older shells - the
   * tool keeps its self-contained fallback then.
   */
  __lollyColorField?: (container: HTMLElement, id: string, opts: {
    value?: unknown;
    onChange(value: string): void;
    swatchesOnly?: boolean;
    inline?: boolean;
    modes?: boolean;
    dials?: boolean;
    onInteractStart?(): void;
    onInteractEnd?(): void;
  }) => void;
  /**
   * Write `id`→`value` with NO undo-history entry, for a correction the tool
   * makes on the user's behalf rather than an edit the user made.
   *
   * redact's re-measure pass is the case this exists for: bars that arrive from
   * a share link, the sidebar or `lolly redact --bars=` have never been near a
   * DOM, so the first render that can see the page snaps them to what they
   * cover and stamps the node addresses vector export deletes. Committing that
   * through the ordinary channel would put a step nobody took on top of the
   * undo stack, wipe the redo stack, and then fight the user: undoing the
   * correction restores the unmeasured bars, and the very next paint measures
   * and re-commits them. Quiet writes make the correction what it actually is - 
   * bookkeeping the user never asked for and cannot meaningfully undo.
   *
   * NOT for anything the user did: an edit that leaves no history entry is an
   * edit they cannot take back.
   */
  __lollyCommitQuiet?: (id: string, value: InputValue) => void;
}

/** mountTool installs the history-free setter on its runtime (views/tool.ts). */
type NudgeRuntime = Runtime & { setInputNoHistory?: Runtime['setInput'] };

/**
 * Bind `canvasEl` to `runtime` so an interactive tool script mounted inside it
 * commits values 1:1 to that runtime. Call once when the canvas element is
 * created - the property (and the `data-lolly-canvas` marker) persist across the
 * innerHTML swaps each paint performs, so it never needs re-attaching per render.
 */
export function attachCanvasCommit(canvasEl: CanvasCommitEl, runtime: Runtime): void {
  canvasEl.dataset.lollyCanvas = '';
  canvasEl.__lollyCommit = (id, value) => { void runtime.setInput(id, value); };
  canvasEl.__lollyCommitQuiet = (id, value) => {
    // Resolved at call time: mountTool assigns setInputNoHistory after mount.
    const set = (runtime as NudgeRuntime).setInputNoHistory ?? runtime.setInput;
    void set(id, value);
  };
  canvasEl.__lollyNudge = (id) => {
    const cur = runtime.getModel().find((i) => i.id === id);
    if (!cur) return;
    // Resolved at call time: mountTool assigns setInputNoHistory after mount.
    const set = (runtime as NudgeRuntime).setInputNoHistory ?? runtime.setInput;
    void set(cur.id, cur.value);
  };
  canvasEl.__lollyModel = () => runtime.getModel();
  canvasEl.__lollySubscribe = (cb) => runtime.subscribe(cb);
  canvasEl.__lollyColorField = (container, id, opts) => {
    void import('../components/color-field.ts').then(m => { m.mountColorField(container, id, opts); });
  };
}
