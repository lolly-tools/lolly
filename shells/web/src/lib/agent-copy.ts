// SPDX-License-Identifier: MPL-2.0
/**
 * The landing's "Copy agent instructions" button. The text rides on the button
 * itself (`data-agent-text`, filled by the docs build from docs/agents-pages.ts
 * buildAgentInstructions, the same text served as /info/agent-instructions.md),
 * so a copy needs no network and happens inside the click, and an attribute
 * stays out of the page text that search and narration read. One module for
 * both readers: docs/build.ts bundles it into the static page, and the in-app
 * reader (lib/docs-landing.ts) calls it on the fragment it adopts.
 *
 * The button's own label turns into the result for a moment, and the same words
 * go to its live region. When the browser has no clipboard, it says so; the
 * link to the file beside the button is the manual route.
 */

const RESET_MS = 2400;

type WriteText = (text: string) => Promise<void>;

const clipboardWrite: WriteText = (text) =>
  typeof navigator !== 'undefined' && navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(text)
    : Promise.reject(new Error('unavailable'));

export function wireAgentCopy(root: ParentNode, writeText: WriteText = clipboardWrite): void {
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-agent-copy]')) {
    if (btn.dataset.agentCopyWired) continue;
    btn.dataset.agentCopyWired = '1';
    const label = btn.querySelector<HTMLElement>('.agent-copy-label') ?? btn;
    const idle = label.textContent ?? '';
    const live = btn.parentElement?.querySelector<HTMLElement>('.agent-copy-status') ?? null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const say = (text: string, state: 'done' | 'failed'): void => {
      label.textContent = text;
      btn.dataset.state = state;
      if (live) live.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(() => {
        label.textContent = idle;
        delete btn.dataset.state;
        if (live) live.textContent = '';
      }, RESET_MS);
    };
    btn.addEventListener('click', () => {
      const text = btn.dataset.agentText ?? '';
      if (!text) return;
      let write: Promise<void>;
      try { write = writeText(text); } catch (error) { write = Promise.reject(error); }
      write.then(
        () => say(btn.dataset.copied || 'Copied', 'done'),
        () => say(btn.dataset.failed || 'Copy did not work', 'failed'),
      );
    });
  }
}
