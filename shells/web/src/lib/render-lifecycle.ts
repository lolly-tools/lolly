// SPDX-License-Identifier: MPL-2.0
/**
 * Shared render lifecycle for mounting a tool's hydrated template into a DOM
 * node - used by the live tool view (views/tool.js) and the off-screen
 * batch/compose renderer (pro/render-export.js). These were previously
 * "faithful copies" in both files and had already drifted (finding #4); this is
 * the single source of truth. CSS scoping lives next door in ./scope-css.ts.
 *
 * NOTE (finding #5): the async-readiness handshake below still rides two
 * document/window globals (`window.__toolHasReadySignal` + a `tool:ready`
 * event, with `tool:failed` as its unhappy sibling). That global protocol is
 * preserved verbatim here so behaviour is unchanged; making it per-render/per-canvas
 * is a separate, higher-risk step (it also touches any opted-in tool templates).
 */

declare global {
  interface Window {
    /** Opt-in flag a tool's inline <script> sets so waitForQuiescence defers
     *  until the tool later dispatches `tool:ready`. */
    __toolHasReadySignal?: boolean;
  }
}

/**
 * Re-run a container's <script> elements. Assigning innerHTML intentionally
 * skips script execution, so any template that needs runtime JS is bootstrapped
 * by cloning each <script> into a fresh, executable one.
 */
export function runTemplateScripts(container: ParentNode): void {
  container.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    for (const a of [...old.attributes]) s.setAttribute(a.name, a.value);
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

export interface QuiescenceOptions {
  /** Mutation-silence window before the node is considered settled. */
  silenceMs?: number;
  /** Hard cap after which quiescence resolves regardless. */
  timeoutMs?: number;
  /**
   * The same cap for a tool that promised a ready signal. Loading a model and compiling
   * its shaders on a busy page can pass `timeoutMs`, and resolving then photographs a
   * canvas that has not drawn yet.
   */
  readyTimeoutMs?: number;
}

/**
 * Resolves once the node has been mutation-quiet for `silenceMs` AND any pending
 * async signal has fired, or after `timeoutMs` regardless.
 *
 * Opt-in contract for async tools (e.g. fetch-driven weather/maps):
 *   1. Before returning from the script, set window.__toolHasReadySignal = true.
 *   2. When all async work is done, dispatch ONE of
 *        document.dispatchEvent(new CustomEvent('tool:ready'))   - it drew, and
 *        document.dispatchEvent(new CustomEvent('tool:failed', { detail: { message } }))
 *      when it could not.
 *   Without the signal this behaves exactly as before (mutation-silence only).
 *
 * REJECTS on `tool:failed`, carrying the tool's own message. A tool that cannot draw
 * puts an error panel on its canvas, and resolving let the batch and export paths
 * photograph that panel and hand it over as the picture (plan 265 milestone 2, E4).
 * Rejecting makes it the visible failure those paths already report. Templates that
 * only ever say `tool:ready` are untouched.
 */
export async function waitForQuiescence(
  node: Node,
  { silenceMs = 400, timeoutMs = 8000, readyTimeoutMs = 25_000 }: QuiescenceOptions = {},
): Promise<void> {
  await document.fonts.ready;

  const needsReadySignal = !!window.__toolHasReadySignal;
  delete window.__toolHasReadySignal;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    let isReady = !needsReadySignal; // pre-resolved when no signal expected
    let isSilent = false;

    const stop = () => {
      clearTimeout(silenceTimer);
      clearTimeout(capTimer);
      observer.disconnect();
      document.removeEventListener('tool:ready', onReady);
      document.removeEventListener('tool:failed', onFailed);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      stop();
      resolve();
    };

    const tryFinish = () => { if (isReady && isSilent) finish(); };

    const resetSilence = () => {
      isSilent = false;
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { isSilent = true; tryFinish(); }, silenceMs);
    };

    const onReady = () => { isReady = true; tryFinish(); };

    // Fail fast: the tool has said it cannot draw, so there is nothing to settle for.
    const onFailed = (e: Event) => {
      if (settled) return;
      settled = true;
      stop();
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      reject(new Error(detail?.message || 'The tool could not render.'));
    };

    const observer = new MutationObserver(resetSilence);
    observer.observe(node, { childList: true, subtree: true, attributes: true, characterData: true });
    document.addEventListener('tool:ready', onReady, { once: true });
    document.addEventListener('tool:failed', onFailed, { once: true });

    const capTimer = setTimeout(finish, needsReadySignal ? Math.max(timeoutMs, readyTimeoutMs) : timeoutMs);
    resetSilence();
  });
}
