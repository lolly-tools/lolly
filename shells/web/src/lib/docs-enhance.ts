// SPDX-License-Identifier: MPL-2.0
/**
 * The docs reading enhancer (plan 277 step 3): Copy on code blocks, its feedback, and
 * opening a closed disclosure when a link points at something inside that disclosure.
 *
 * One module for both readers. The in-app reader (views/docs.ts, views/document-model.ts)
 * imports it; docs/build.ts bundles this same file into the /info page script. It
 * imports nothing from the app, takes its words and its clipboard from the caller, and
 * only enhances: every code block reads and selects without it, and a native <details>
 * opens without this script. Markup comes from packages/docs-render (components.ts), styles from
 * styles/parts/docs-components.css.
 *
 * Copy rules: the exact text of the code element is written, never a decorated copy;
 * success is reported only when the write resolves; a refusal says so and leaves
 * neutral help that stays in place, so a later success cannot move the page. Feedback
 * floats beside the button and never enters the flow. Focus stays on the button.
 */

export interface DocsEnhanceLabels {
  copy: string;
  copied: string;
  copyFailed: string;
  /** Shown under a block after a refused copy. */
  help: string;
  select: string;
  selected: string;
  /** The button's accessible name for one block, from its label ("Copy Terminal"). */
  copyNamed: (label: string) => string;
}

export interface DocsEnhanceOptions {
  /** Resolves only when the text is on the clipboard; rejects otherwise. */
  writeText: (text: string) => Promise<void>;
  labels: DocsEnhanceLabels;
  /** Trusted SVG markup for the Copy glyph (from lib/icons.ts). */
  copyIcon?: string;
  /** /info only: open the closed disclosure holding the target of the page's #hash. The
   *  app already does this through lib/docs-rehost.ts scrollToHeading. */
  openOnHash?: boolean;
}

/**
 * The commands in a shell example, as a reader should paste them: a transcript's "$ "
 * lines without the prompt (and their backslash continuations), otherwise every line
 * except comments. A trailing comment is cut too, found by a quote-aware scan so a value
 * such as --color=#0c322c or "Section #2" is kept. Comments go because zsh, the macOS
 * default shell, treats them as commands unless interactive comments are on, and a "("
 * inside one fails the whole line.
 */
export function shellCommands(text: string): string {
  const lines = text.split('\n');
  const prompt = /^\s*\$ /;
  let kept: string[];
  if (lines.some((l) => prompt.test(l))) {
    kept = [];
    let continuing = false;
    for (const l of lines) {
      if (prompt.test(l)) { kept.push(l.replace(prompt, '')); continuing = /\\$/.test(l); }
      else if (continuing) { kept.push(l); continuing = /\\$/.test(l); }
    }
  } else {
    kept = lines.filter((l) => !/^\s*#/.test(l));
  }
  const cut = (l: string): string => {
    let q: string | null = null;
    for (let i = 0; i < l.length; i++) {
      const c = l[i]!;
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '#' && i > 0 && /\s/.test(l[i - 1]!)) return l.slice(0, i).trimEnd();
    }
    return l;
  };
  return kept.map(cut).join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

/** How long "Copied to clipboard" stays up; a repeat copy restarts the timer. */
export const COPY_FEEDBACK_MS = 2400;
const EDGE = 8;

const enhanced = new WeakMap<HTMLElement, () => void>();

export function enhanceDocsReading(root: HTMLElement, opts: DocsEnhanceOptions): () => void {
  const existing = enhanced.get(root);
  if (existing) return existing;

  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const { labels } = opts;
  const injected: Element[] = [];
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  const busy = new WeakSet<HTMLElement>();

  // One polite live region per reader: the result is announced once, not per block.
  const status = doc.createElement('div');
  status.className = 'doc-visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  root.appendChild(status);
  injected.push(status);
  const announce = (text: string): void => {
    status.textContent = '';
    // A separate task, so a repeat of the same words is announced again.
    setTimeout(() => { status.textContent = text; }, 30);
  };

  for (const block of root.querySelectorAll<HTMLElement>('.doc-code[data-copy]')) {
    const bar = block.querySelector<HTMLElement>(':scope > .doc-code-bar');
    const code = block.querySelector<HTMLElement>('pre code') ?? block.querySelector<HTMLElement>('pre');
    if (!bar || !code || bar.querySelector('.doc-copy')) continue;
    const slot = doc.createElement('span');
    slot.className = 'doc-copy-slot';
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'doc-copy';
    btn.dataset.docCopy = '';
    btn.setAttribute('aria-label', labels.copyNamed(block.dataset.label || labels.copy));
    if (opts.copyIcon) btn.insertAdjacentHTML('afterbegin', opts.copyIcon);
    const word = doc.createElement('span');
    word.textContent = labels.copy;
    btn.appendChild(word);
    const toast = doc.createElement('span');
    toast.className = 'doc-copy-toast';
    toast.setAttribute('aria-hidden', 'true');
    toast.hidden = true;
    slot.append(btn, toast);
    bar.appendChild(slot);
    injected.push(slot);

    const help = doc.createElement('div');
    help.className = 'doc-copy-help';
    help.hidden = true;
    const helpText = doc.createElement('span');
    helpText.textContent = labels.help;
    const select = doc.createElement('button');
    select.type = 'button';
    select.className = 'doc-copy';
    select.dataset.docSelect = '';
    select.textContent = labels.select;
    help.append(helpText, select);
    block.appendChild(help);
    injected.push(help);
  }

  const toastOf = (btn: HTMLElement): HTMLElement | null =>
    btn.closest('.doc-copy-slot')?.querySelector<HTMLElement>('.doc-copy-toast') ?? null;

  const hide = (btn: HTMLElement): void => {
    clearTimeout(timers.get(btn));
    timers.delete(btn);
    const toast = toastOf(btn);
    if (toast) toast.hidden = true;
  };

  const show = (btn: HTMLElement, text: string): void => {
    const toast = toastOf(btn);
    if (!toast) return;
    clearTimeout(timers.get(btn));
    toast.textContent = text;
    toast.style.setProperty('--doc-toast-shift', '0px');
    toast.removeAttribute('data-above');
    toast.hidden = false;
    // Keep it on screen: flip above near the bottom edge, slide in from a side edge.
    const r = toast.getBoundingClientRect();
    // Flip above near the bottom edge, or when something fixed outside the reader (the
    // app's narration dock, a floating button) sits where the message would show.
    const cover = doc.elementFromPoint?.(Math.min(Math.max(r.left + r.width / 2, 0), win.innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), win.innerHeight - 1));
    const covered = !!cover && !root.contains(cover) && !cover.contains(root);
    if (r.bottom > win.innerHeight - EDGE || covered) toast.setAttribute('data-above', '');
    const w = doc.documentElement.clientWidth;
    const shift = r.left < EDGE ? EDGE - r.left : r.right > w - EDGE ? w - EDGE - r.right : 0;
    if (shift) toast.style.setProperty('--doc-toast-shift', `${Math.round(shift)}px`);
    timers.set(btn, setTimeout(() => hide(btn), COPY_FEEDBACK_MS));
  };

  const hideAll = (): void => {
    for (const btn of [...timers.keys()]) hide(btn);
  };

  const onClick = (e: Event): void => {
    const target = e.target as Element | null;
    const selectBtn = target?.closest<HTMLElement>('[data-doc-select]');
    const block = target?.closest<HTMLElement>('.doc-code');
    if (selectBtn && block && root.contains(selectBtn)) {
      const code = block.querySelector('pre code') ?? block.querySelector('pre');
      if (!code) return;
      const range = doc.createRange();
      range.selectNodeContents(code);
      const sel = win.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      announce(labels.selected);
      return;
    }
    const btn = target?.closest<HTMLElement>('[data-doc-copy]');
    if (!btn || !block || !root.contains(btn)) return;
    // A second click while a write is in flight is ignored; the button stays enabled
    // so it keeps focus.
    if (busy.has(btn)) return;
    const code = block.querySelector('pre code') ?? block.querySelector('pre');
    if (!code) return;
    busy.add(btn);
    hide(btn);
    const shown = code.textContent ?? '';
    const text = block.dataset.copy === 'shell' ? shellCommands(shown) : shown;
    let write: Promise<void>;
    try { write = opts.writeText(text); } catch (err) { write = Promise.reject(err); }
    write.then(
      () => { show(btn, labels.copied); announce(labels.copied); },
      () => {
        show(btn, labels.copyFailed);
        announce(`${labels.copyFailed} ${labels.help}`);
        const help = block.querySelector<HTMLElement>(':scope > .doc-copy-help');
        if (help) help.hidden = false;
      },
    ).finally(() => { busy.delete(btn); });
  };

  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') hideAll(); };

  const openTarget = (): void => {
    const id = decodeURIComponent(win.location.hash.slice(1));
    if (!id) return;
    const el = doc.getElementById(id);
    if (!el || !root.contains(el)) return;
    let opened = false;
    if (el instanceof win.HTMLDetailsElement && !el.open) { el.open = true; opened = true; }
    for (let d = el.parentElement?.closest('details'); d; d = d.parentElement?.closest('details')) {
      if (!(d as HTMLDetailsElement).open) { (d as HTMLDetailsElement).open = true; opened = true; }
    }
    // The browser already scrolled to where the target sat while it was hidden.
    if (opened) el.scrollIntoView();
  };

  root.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  win.addEventListener('resize', hideAll);
  if (opts.openOnHash) {
    win.addEventListener('hashchange', openTarget);
    openTarget();
  }

  const dispose = (): void => {
    root.removeEventListener('click', onClick);
    doc.removeEventListener('keydown', onKey);
    win.removeEventListener('resize', hideAll);
    win.removeEventListener('hashchange', openTarget);
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    for (const node of injected) node.remove();
    enhanced.delete(root);
  };
  enhanced.set(root, dispose);
  return dispose;
}
