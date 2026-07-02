// SPDX-License-Identifier: MPL-2.0
/**
 * Shared render lifecycle for tool canvases (finding 4: these helpers used to
 * exist twice — views/tool.js and pro/render-export.js each carried a "faithful
 * copy" that had already drifted: the batch copy waited 350ms of silence, the
 * visible canvas 400ms. This module is now the single implementation; the
 * batch path keeps its shorter window via the `silenceMs` option.)
 *
 * Embed hydration is NOT here because it never was duplicated — it lives in
 * bridge/embed.ts and both render paths import it from there.
 */
import { createQuiescenceGate } from './quiescence.ts';

export { scopeCss } from './scope-css.ts';

/**
 * Re-create every <script> inside `container` so the browser executes it.
 * innerHTML-inserted scripts are inert by spec; swapping in fresh nodes (same
 * attributes + text) runs them. `document.currentScript` inside a template
 * script therefore points at the re-created node — which is how a tool script
 * finds its own render root (see readiness contract below).
 */
export function runTemplateScripts(container: HTMLElement): void {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script');
    [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

/**
 * Walk the canvas DOM for HTML comment markers left by annotateTemplate,
 * convert them into data-canvas-input attributes, then remove the comments.
 * Block-element outputs (e.g. <p> from {{markdown}}) are marked directly;
 * plain text outputs get wrapped in a transparent <span> so they're clickable.
 */
export function resolveCanvasAnnotations(canvasEl: HTMLElement): void {
  const comments: Comment[] = [];
  const walker = document.createTreeWalker(canvasEl, NodeFilter.SHOW_COMMENT);
  let node: Node | null;
  while ((node = walker.nextNode())) comments.push(node as Comment);

  for (const comment of comments) {
    const parent = comment.parentNode;
    if (!parent) continue;
    const text = (comment.nodeValue ?? '').trim();
    const m = /^ci:(.+)$/.exec(text);
    if (!m || m[1] === undefined) continue;
    const id = m[1];

    // Collect siblings until the matching closing comment.
    const between: ChildNode[] = [];
    let closing: Comment | null = null;
    let cur = comment.nextSibling;
    while (cur) {
      if (cur.nodeType === Node.COMMENT_NODE && (cur.nodeValue ?? '').trim() === `/ci:${id}`) {
        closing = cur as Comment;
        break;
      }
      between.push(cur);
      cur = cur.nextSibling;
    }

    const elements = between.filter((n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE);
    if (elements.length > 0) {
      for (const el of elements) el.dataset.canvasInput = id;
    } else {
      // Pure text — wrap in a span so it's individually clickable.
      const span = document.createElement('span');
      span.dataset.canvasInput = id;
      parent.insertBefore(span, comment);
      for (const n of between) span.appendChild(n);
    }

    comment.remove();
    closing?.remove();
  }
}

export interface WaitForQuiescenceOpts {
  /** Mutation-quiet window; the visible canvas uses the 400ms default, batch export passes 350. */
  silenceMs?: number;
  /** Hard cap: resolve regardless after this long. */
  timeoutMs?: number;
}

/**
 * Resolves once `node`'s DOM has been mutation-quiet for `silenceMs` AND any
 * pending per-render ready signal has fired, or after `timeoutMs` regardless.
 *
 * Readiness contract for async tools (finding 5 — previously a hidden GLOBAL
 * protocol: window.__toolHasReadySignal + a document-level event, shared by
 * every concurrent render). It is now scoped to the render root:
 *   1. While its async work is pending, the template's script sets the
 *      `data-ready-signal` attribute on an element inside the render root —
 *      its own root is the natural choice, found via document.currentScript
 *      (runTemplateScripts re-creates script nodes, so it is always live):
 *        var root = document.currentScript.parentNode.querySelector('.my-root');
 *        root.setAttribute('data-ready-signal', '');
 *   2. When all async work is done (every success AND error path), dispatch a
 *      BUBBLING event from that element:
 *        root.dispatchEvent(new CustomEvent('tool:ready', { bubbles: true }));
 * Each call consumes the marker (mirrors the old one-shot window flag), so
 * concurrent renders — the visible canvas next to an off-screen batch row —
 * wait on their own signal only. Without the marker this is silence-only.
 */
export async function waitForQuiescence(node: HTMLElement, { silenceMs = 400, timeoutMs = 8000 }: WaitForQuiescenceOpts = {}): Promise<void> {
  await document.fonts.ready;

  const marker = node.querySelector('[data-ready-signal]');
  if (marker) marker.removeAttribute('data-ready-signal'); // consume: one waiter per render pass

  return new Promise(resolve => {
    const timers: (() => void)[] = [];
    const observer = new MutationObserver(() => gate.activity());
    const onReady = (): void => gate.ready();

    const gate = createQuiescenceGate(
      {
        needsReadySignal: marker !== null,
        silenceMs,
        timeoutMs,
        setTimer: (fn, ms) => {
          const t = setTimeout(fn, ms);
          const cancel = (): void => clearTimeout(t);
          timers.push(cancel);
          return cancel;
        },
      },
      {
        onSettled: () => {
          observer.disconnect();
          node.removeEventListener('tool:ready', onReady);
          timers.forEach(c => c());
          resolve();
        },
      },
    );

    observer.observe(node, { childList: true, subtree: true, attributes: true, characterData: true });
    node.addEventListener('tool:ready', onReady);
  });
}
