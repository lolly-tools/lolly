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
 * event). That global protocol is preserved verbatim here so behaviour is
 * unchanged; making it per-render/per-canvas is a separate, higher-risk step
 * (it also touches any opted-in tool templates).
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
}

/**
 * Resolves once the node has been mutation-quiet for `silenceMs` AND any pending
 * async signal has fired, or after `timeoutMs` regardless.
 *
 * Opt-in contract for async tools (e.g. fetch-driven weather/maps):
 *   1. Before returning from the script, set window.__toolHasReadySignal = true.
 *   2. When all async work is done (every success AND error path), dispatch:
 *        document.dispatchEvent(new CustomEvent('tool:ready'))
 *   Without the signal this behaves exactly as before (mutation-silence only).
 */
export async function waitForQuiescence(
  node: Node,
  { silenceMs = 400, timeoutMs = 8000 }: QuiescenceOptions = {},
): Promise<void> {
  await document.fonts.ready;

  const needsReadySignal = !!window.__toolHasReadySignal;
  delete window.__toolHasReadySignal;

  return new Promise<void>((resolve) => {
    let settled = false;
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    let isReady = !needsReadySignal; // pre-resolved when no signal expected
    let isSilent = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(silenceTimer);
      clearTimeout(capTimer);
      observer.disconnect();
      document.removeEventListener('tool:ready', onReady);
      resolve();
    };

    const tryFinish = () => { if (isReady && isSilent) finish(); };

    const resetSilence = () => {
      isSilent = false;
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { isSilent = true; tryFinish(); }, silenceMs);
    };

    const onReady = () => { isReady = true; tryFinish(); };

    const observer = new MutationObserver(resetSilence);
    observer.observe(node, { childList: true, subtree: true, attributes: true, characterData: true });
    document.addEventListener('tool:ready', onReady, { once: true });

    const capTimer = setTimeout(finish, timeoutMs);
    resetSilence();
  });
}
