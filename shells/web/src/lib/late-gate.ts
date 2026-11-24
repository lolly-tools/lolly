// SPDX-License-Identifier: MPL-2.0
/**
 * The sign-in gate when it arrives after the first view has painted.
 *
 * Boot paints before the control-plane probe answers only when the last answer for
 * this origin and instance base was "no control plane" (plan 371; org/probe.ts, "THE
 * LAST ANSWER"). If the probe then reports a gate, org/index.ts draws it into the view
 * and this module takes over the view: the mounted view's cleanup runs, its scoping
 * classes and leave guard go, dialogs close, and the gate is the one thing left. From
 * then on no route mounts (main.ts asks {@link LateGate.stopped} at the top of
 * navigate()), and a mount that was already in flight and paints over the gate is
 * replaced again when it settles, the same rule as a late WebGPU failure.
 *
 * The gate's own markup is taken out of the view before the cleanup runs, so a cleanup
 * that empties the view cannot take the gate away. With no gate markup at all (the
 * renderer found no view) the view is left empty: never as it was.
 *
 * Anything written into the view after that is undone before the next frame: a mount
 * still in flight resumes after an IndexedDB read and writes its markup, including one
 * whose navigation was superseded and so never reaches navigate()'s own check. A
 * mutation observer on the view puts the gate back in the same microtask checkpoint, so
 * the write is never painted. The snapshot a view cross-fade moved out of the view (a
 * `.view-fade` overlay on the body) goes too, so the old view cannot stay on screen
 * above the gate while a stalled mount never commits its fade.
 *
 * Files dragged onto the page are swallowed from then on, in the capture phase on the
 * window, ahead of any handler: a view's drop listener on the router's view (the
 * gallery's intake) is detached by navigation, which a gate never emits, and the chooser
 * it would open lives on the body, outside the view. A dialog that something already
 * under way opens on the body after the gate (a file chooser whose module was still
 * loading, any modal) is closed and removed as it is added, before it is painted.
 */

/** The router's view element: a mounted view leaves its teardown here. */
export interface GateView extends HTMLElement {
  _cleanup?: () => void;
  _beforeLeave?: () => unknown;
}

export interface LateGateDeps {
  /** The router's view, or null. */
  view(): GateView | null;
  /** Router state to drop before the view is torn down (the loading card, the mounted route). */
  reset(): void;
  /** Chrome to settle after the cleanup has released its claims (the search bar). */
  settleChrome(): void;
  /** Every scoping class a route can put on the view. */
  viewClasses(): Iterable<string>;
  /** Snapshots of an outgoing view held outside the view (the cross-fade overlays). */
  snapshots(): Iterable<Element>;
}

export interface LateGate {
  /** True once a gate has taken the view; no route mounts after that. */
  stopped(): boolean;
  /** The gate was drawn (its markup) or reported with no markup (null). */
  stop(gate: Element | null): void;
  /** Tear down whatever is in the view and put the gate back. Safe to repeat. */
  replace(): void;
}

export function createLateGate(deps: LateGateDeps): LateGate {
  let state: { node: Element | null; title: string } | null = null;
  let guard: MutationObserver | null = null;

  /** The view holds the gate and nothing else (or nothing, with no gate markup). */
  const settled = (view: GateView): boolean => {
    const gate = state?.node ?? null;
    return gate ? view.childNodes.length === 1 && view.firstChild === gate : view.childNodes.length === 0;
  };

  const replace = (): void => {
    if (!state) return;
    deps.reset();
    const view = deps.view();
    if (!view) return;
    const gate = state.node;
    gate?.remove();
    try { view._cleanup?.(); } catch (error) { console.error('[nav] view cleanup threw:', error); }
    delete view._cleanup;
    delete view._beforeLeave;
    for (const cls of deps.viewClasses()) view.classList.remove(cls);
    deps.settleChrome();
    view.replaceChildren(...(gate ? [gate] : []));
    for (const snapshot of [...deps.snapshots()]) snapshot.remove();
    for (const dialog of view.ownerDocument.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
      if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    }
    if (state.title) view.ownerDocument.title = state.title;
    const win = view.ownerDocument.defaultView;
    if (!guard && win?.MutationObserver) {
      guard = new win.MutationObserver(() => { if (!settled(view)) replace(); });
      guard.observe(view, { childList: true });
      const swallow = (event: Event): void => { event.preventDefault(); event.stopImmediatePropagation(); };
      for (const type of ['dragenter', 'dragover', 'drop']) win.addEventListener(type, swallow, true);
      const body = view.ownerDocument.body;
      if (body) {
        new win.MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (!(node instanceof win.Element)) continue;
            const dialogs = node.tagName === 'DIALOG' ? [node] : [...node.querySelectorAll('dialog')];
            for (const dialog of dialogs as HTMLDialogElement[]) {
              if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
              dialog.remove();
            }
          }
        }).observe(body, { childList: true });
      }
    }
  };

  return {
    stopped: () => state !== null,
    stop(gate) {
      state ??= { node: null, title: '' };
      if (gate && !state.node) { state.node = gate; state.title = gate.ownerDocument.title; }
      replace();
    },
    replace,
  };
}
