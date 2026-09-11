// SPDX-License-Identifier: MPL-2.0
/**
 * Interactive canvas - runs a tool's OWN JavaScript in a script-enabled jsdom so the TUI
 * can actually USE the DOM-based tools (Text Helper's tabs + transforms, Colour Palette,
 * countdown, …), not just render a static snapshot. It mounts the hydrated template into a
 * `runScripts` jsdom (injecting the handful of globals jsdom omits), exposes the tool's
 * focusable controls (buttons/tabs/inputs), and lets the shell click them and type into
 * them - the tool's own listeners fire, its DOM updates, and html-render re-reads it.
 *
 * DOM-only tools work fully; canvas/WebGL tools (Design, filters) don't - jsdom has
 * no 2D context - so those degrade to whatever DOM controls they expose. `createInteractive`
 * returns null when the template ships no <script> (nothing to run).
 */
import { JSDOM } from 'jsdom';
import { webcrypto } from 'node:crypto';
import { htmlToRuns, htmlToRunsFocused } from './html-render.ts';
import type { Run, RenderResult } from './html-render.ts';

export type FocusKind = 'button' | 'text' | 'checkbox' | 'select' | 'link';
export interface Focusable {
  el: Element;
  kind: FocusKind;
  label: string;
  value: string;      // current value (text/select) or ''
  editable: boolean;  // text fields
}

/** True when a template carries interactive script worth running. */
export function isInteractiveHtml(html: string): boolean {
  return /<script[\s>]/i.test(html);
}

// jsdom builds no layout, so offsetParent is always null - judge visibility structurally.
function shown(el: Element): boolean {
  if ((el as HTMLElement).hidden) return false;
  if (el.closest('[hidden]')) return false;
  const style = el.getAttribute('style') ?? '';
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return false;
  return true;
}

function labelFor(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (tag === 'button' || tag === 'a' || role === 'tab' || role === 'button') return text || el.getAttribute('title') || el.getAttribute('data-op') || 'button';
  // A form control: prefer an associated/ wrapping <label>, then placeholder, then the
  // selected option (select), then a title/name/data-* hint.
  const id = el.getAttribute('id');
  let assoc = '';
  try {
    const forLabel = id ? el.ownerDocument?.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`) : null;
    assoc = (forLabel?.textContent ?? el.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  } catch { /* exotic id - skip */ }
  if (assoc) return assoc;
  const ph = el.getAttribute('placeholder');
  if (ph) return ph.trim();
  if (tag === 'select') {
    const opt = (el as unknown as { selectedOptions?: ArrayLike<{ textContent: string | null }> }).selectedOptions?.[0]?.textContent?.trim();
    if (opt) return opt;
  }
  return el.getAttribute('title') || el.getAttribute('name') || el.getAttribute('data-op') || tag;
}

function kindOf(el: Element): FocusKind {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return 'text';
  if (tag === 'select') return 'select';
  if (tag === 'a') return 'link';
  if (tag === 'input') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (t === 'checkbox' || t === 'radio') return 'checkbox';
    if (['button', 'submit', 'reset'].includes(t)) return 'button';
    return 'text';
  }
  if (el.hasAttribute('contenteditable')) return 'text';
  return 'button';   // button, [role=tab], [role=button]
}

export class InteractiveCanvas {
  readonly dom: JSDOM;
  private readonly win: JSDOM['window'];
  private readonly doc: Document;
  private copied: string | null = null;   // text a tool's copy button wrote this interaction

  constructor(html: string, styleText: string) {
    this.dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { runScripts: 'dangerously', pretendToBeVisual: true });
    this.win = this.dom.window;
    this.doc = this.win.document as unknown as Document;
    // Globals jsdom doesn't ship but tool scripts reach for.
    const w = this.win as unknown as Record<string, unknown>;
    try { Object.defineProperty(this.win, 'crypto', { value: webcrypto, configurable: true }); } catch { /* already present */ }
    w.TextEncoder ??= TextEncoder;
    w.TextDecoder ??= TextDecoder;
    // Clipboard capture: the utilities copy via navigator.clipboard.writeText (colour
    // values, de-identified maps). jsdom has no clipboard, so shim one that records the
    // text - the shell forwards it to the real OS clipboard after the interaction.
    try {
      Object.defineProperty(this.win.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (t: unknown) => { this.copied = String(t ?? ''); return Promise.resolve(); }, readText: () => Promise.resolve('') },
      });
    } catch { /* navigator locked down - copy just won't be captured */ }
    // execCommand('copy') fallback path - capture the current selection instead.
    try {
      (this.doc as unknown as { execCommand: (c: string) => boolean }).execCommand = (cmd: string) => {
        if (cmd === 'copy') { const s = this.win.getSelection?.()?.toString(); if (s) this.copied = s; }
        return true;
      };
    } catch { /* ignore */ }
    if (styleText) { const st = this.doc.createElement('style'); st.textContent = styleText; this.doc.head.appendChild(st); }
    this.doc.body.innerHTML = html;               // markup in - inline scripts are inert
    // Re-create each <script> so it EXECUTES, now that the globals are in place.
    for (const old of Array.from(this.doc.querySelectorAll('script'))) {
      const s = this.doc.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.textContent = old.textContent;
      old.replaceWith(s);
    }
  }

  /** The tool's focusable controls, in DOM order. Skips hidden and non-actionable
   *  (disabled / readonly) controls so navigation only lands on things you can use. */
  focusables(): Focusable[] {
    const sel = 'button, a[href], input, textarea, select, [role="tab"], [role="button"], [contenteditable=""], [contenteditable="true"]';
    const usable = (el: Element): boolean => {
      if (!shown(el)) return false;
      if ((el as HTMLInputElement).disabled || el.getAttribute('aria-disabled') === 'true') return false;
      if (el.hasAttribute('readonly')) return false;   // a readonly output: shown in the render, not a stop
      return true;
    };
    return Array.from(this.doc.querySelectorAll(sel))
      .filter(usable)
      .map((el) => {
        const kind = kindOf(el);
        return { el, kind, label: labelFor(el), value: String((el as HTMLInputElement).value ?? el.textContent ?? '').trim(), editable: kind === 'text' || kind === 'select' };
      });
  }

  /** Return (and clear) any text a copy button wrote since the last call. */
  takeCopy(): string | null { const c = this.copied; this.copied = null; return c; }

  /** Click a control - the tool's own listeners run and mutate the DOM. */
  activate(el: Element): void {
    if (el.tagName.toLowerCase() === 'input' && (el as HTMLInputElement).type === 'checkbox') {
      (el as HTMLInputElement).checked = !(el as HTMLInputElement).checked;
      el.dispatchEvent(new this.win.Event('change', { bubbles: true }));
    }
    el.dispatchEvent(new this.win.MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  /** Set a text/select control's value and fire the events the tool listens for. */
  setValue(el: Element, v: string): void {
    if (el.hasAttribute('contenteditable')) { el.textContent = v; }
    else { (el as HTMLInputElement).value = v; }
    el.dispatchEvent(new this.win.Event('input', { bubbles: true }));
    el.dispatchEvent(new this.win.Event('change', { bubbles: true }));
  }

  private styleText(): string {
    return Array.from(this.doc.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
  }

  /** The live DOM rendered to coloured terminal lines (its current, post-script state). */
  render(cols: number): Run[][] {
    return htmlToRuns(this.doc.body as unknown as Parameters<typeof htmlToRuns>[0], this.styleText(), cols);
  }

  /** Live render with one control marked focused; `focusLine` locates it for scrolling. */
  renderFocused(cols: number, focus: Element | null): RenderResult {
    return htmlToRunsFocused(this.doc.body as unknown as Parameters<typeof htmlToRunsFocused>[0], this.styleText(), cols, (focus as unknown as Parameters<typeof htmlToRunsFocused>[3]) ?? null);
  }

  destroy(): void { try { this.win.close(); } catch { /* ignore */ } }
}

/** Build an interactive canvas from a tool's hydrated HTML, or null if it has no script. */
export function createInteractive(html: string, styleText: string): InteractiveCanvas | null {
  if (!isInteractiveHtml(html)) return null;
  try { return new InteractiveCanvas(html, styleText); } catch { return null; }
}

export type { Run };
