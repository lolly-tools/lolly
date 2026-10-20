// SPDX-License-Identifier: MPL-2.0
/**
 * Generated content as real elements, for the length of one page walk.
 *
 * The export walker draws a `::before`/`::after` only in the idiom Lolly's own
 * tools use: absolutely positioned, painted by its text or its background. Pages
 * lean on generated content far more than that. A chevron is an empty inline-block
 * with two borders and a rotation, a tooltip arrow is a CSS triangle made of
 * borders, an icon font draws its glyph as `content: "\e900"` in the line. A
 * pseudo-element has no box the DOM can measure, so the walker dropped all of
 * them.
 *
 * This puts a `<lolly-pseudo>` in each one's place, carrying the pseudo's computed
 * style, and switches the pseudo itself off. The walker then paints the stand-in
 * as it paints any element: borders, transforms, backgrounds, and text outlined
 * from the page's own faces. A stand-in counts as an element where the pseudo did
 * not (`:first-child`, `> *`, `:empty`), so a page whose selectors notice can lay
 * out differently. Every element's box is measured before and after, and a
 * stand-in whose presence moved anything is taken out again, by halves, so the
 * walk only ever sees the layout the screenshot shows.
 *
 * The capture tab is disposable, but `restore()` still puts the page back.
 */

const TAG = 'lolly-pseudo';
const OFF = 'data-lolly-pseudo-off';
/** Elements whose generated content is never painted, or that cannot hold a child. */
const NO_CHILDREN = new Set([
  'AREA', 'AUDIO', 'BASE', 'BR', 'CANVAS', 'COL', 'EMBED', 'HEAD', 'IFRAME', 'IMG', 'INPUT', 'LINK', 'META',
  'NOSCRIPT', 'OBJECT', 'OPTION', 'PARAM', 'PICTURE', 'SCRIPT', 'SELECT', 'SOURCE', 'STYLE', 'TEMPLATE',
  'TEXTAREA', 'TITLE', 'TRACK', 'VIDEO', 'WBR',
]);
/** How far a box may move before the layout counts as changed, in CSS px. */
const SLOP = 0.5;
/** A page with more generated content than this keeps the rest as before. */
const MAX_STAND_INS = 3000;
/** Layout checks the search for stand-ins that move the page may spend. Each one
 *  measures every watched box, so past this the rest are refused unchecked. */
const MAX_CHECKS = 64;

interface Candidate { el: Element; name: '::before' | '::after'; text: string; standIn: HTMLElement | null }
type Box = { x: number; y: number; w: number; h: number };

/** The text of a `content` value that is one string, or null for anything else
 *  (counters, `attr()`, images, quotes, several strings). */
export function contentText(content: string): string | null {
  const m = /^"((?:[^"\\]|\\[\s\S])*)"$/.exec(content.trim());
  if (!m) return null;
  return m[1]!.replace(/\\([0-9a-fA-F]{1,6})\s?|\\([\s\S])/g, (_s, hex: string | undefined, ch: string | undefined) => {
    if (hex) {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '�';
    }
    return ch === '\n' ? '' : ch!;
  });
}

function boxOf(r: DOMRect): Box { return { x: r.left, y: r.top, w: r.width, h: r.height }; }
const moved = (a: Box, b: Box): boolean =>
  Math.abs(a.x - b.x) > SLOP || Math.abs(a.y - b.y) > SLOP || Math.abs(a.w - b.w) > SLOP || Math.abs(a.h - b.h) > SLOP;

/** The box of an element's own text, which a stand-in in the same line can push. */
function textBox(el: Element): Box | null {
  let first: Node | null = null, last: Node | null = null;
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE && n.textContent!.trim()) { first ??= n; last = n; }
  }
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  return boxOf(range.getBoundingClientRect());
}

function toggleOff(el: Element, name: Candidate['name'], on: boolean): void {
  const token = name === '::before' ? 'before' : 'after';
  const list = new Set((el.getAttribute(OFF) || '').split(/\s+/).filter(Boolean));
  if (on) list.add(token); else list.delete(token);
  if (list.size) el.setAttribute(OFF, [...list].join(' '));
  else el.removeAttribute(OFF);
}

function makeStandIn(cs: CSSStyleDeclaration, text: string): HTMLElement {
  const s = document.createElement(TAG);
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!;
    if (p === 'content') continue;
    s.style.setProperty(p, cs.getPropertyValue(p), 'important');
  }
  // The pseudo's current frame, held still: a copied animation would start over.
  s.style.setProperty('animation', 'none', 'important');
  s.style.setProperty('transition', 'none', 'important');
  s.setAttribute('aria-hidden', 'true');
  s.textContent = text;
  return s;
}

export interface StandIns {
  /** Stand-ins in place for the walk. */
  placed: number;
  /** Pseudo-elements left as they were because a stand-in moved the layout. */
  refused: number;
  restore(): void;
}

/**
 * Stand in for the generated content of every element whose box comes near the
 * window (viewport CSS px), keeping only stand-ins that leave the layout as it was.
 */
export function standInPseudos(win: { x: number; y: number; width: number; height: number }, margin = 64): StandIns {
  const sheet = new CSSStyleSheet();
  // A constructed sheet, not a <style>: a strict style-src refuses the element, not
  // the CSSOM. The stand-in's own style goes in through the CSSOM for the same reason.
  sheet.replaceSync(`[${OFF}~="before"]::before,[${OFF}~="after"]::after{content:none!important}`);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  const near = (b: Box): boolean => (b.w === 0 && b.h === 0)
    || !(b.x + b.w < win.x - margin || b.y + b.h < win.y - margin || b.x > win.x + win.width + margin || b.y > win.y + win.height + margin);

  // What the screenshot shows: every element near the window, and the text of
  // every element that has generated content.
  const watched: Array<{ el: Element; box: Box; text: Box | null }> = [];
  const candidates: Candidate[] = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || el.tagName === TAG.toUpperCase()) continue;
    const box = boxOf(el.getBoundingClientRect());
    if (!near(box)) continue;
    if (box.w === 0 && box.h === 0 && getComputedStyle(el).display === 'none') continue;
    let has = false;
    if (!NO_CHILDREN.has(el.tagName) && candidates.length < MAX_STAND_INS) {
      for (const name of ['::before', '::after'] as const) {
        const cs = getComputedStyle(el, name);
        if (cs.display === 'none') continue;
        const text = contentText(cs.content);
        if (text === null) continue;
        candidates.push({ el, name, text, standIn: null });
        has = true;
      }
    }
    watched.push({ el, box, text: has ? textBox(el) : null });
  }

  const insert = (c: Candidate): void => {
    if (c.name === '::before') c.el.insertBefore(c.standIn!, c.el.firstChild);
    else c.el.appendChild(c.standIn!);
    toggleOff(c.el, c.name, true);
  };
  const lift = (c: Candidate): void => { c.standIn?.remove(); toggleOff(c.el, c.name, false); };
  const stable = (): boolean => {
    for (const w of watched) {
      if (moved(w.box, boxOf(w.el.getBoundingClientRect()))) return false;
      if (w.text) { const t = textBox(w.el); if (!t || moved(w.text, t)) return false; }
    }
    return true;
  };

  // Every stand-in made from its pseudo's style while the page is untouched, then
  // all of them in at once. Most pages are done in one layout.
  for (const c of candidates) c.standIn = makeStandIn(getComputedStyle(c.el, c.name), c.text);
  for (const c of candidates) insert(c);
  let refused = 0;
  if (!stable()) {
    // Take groups out until the layout matches: a group that passes stays in, one
    // that fails is split in two and each half tried again.
    for (const c of candidates) lift(c);
    const queue: Candidate[][] = [candidates.slice()];
    let checks = 0;
    while (queue.length) {
      const group = queue.pop()!;
      if (++checks > MAX_CHECKS) {
        for (const c of group) c.standIn = null;
        refused += group.length;
        continue;
      }
      for (const c of group) insert(c);
      if (stable()) continue;
      for (const c of group) lift(c);
      if (group.length === 1) { group[0]!.standIn = null; refused++; continue; }
      const half = group.length >> 1;
      queue.push(group.slice(half), group.slice(0, half));
    }
  }
  const placed = candidates.filter(c => c.standIn).length;

  return {
    placed,
    refused,
    restore() {
      for (const c of candidates) if (c.standIn) { lift(c); c.standIn = null; }
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== sheet);
    },
  };
}
