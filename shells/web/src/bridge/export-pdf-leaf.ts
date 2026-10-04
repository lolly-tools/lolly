/**
 * Which boxes the PDF walker may treat as a leaf when it applies partial opacity.
 *
 * The walker in export.ts sets a box's opacity on the box's own draws only when nothing
 * under it paints. A Design box is a div with an empty text child, so a translucent box
 * over a photo (a veil) has a child yet draws only itself; these helpers let its opacity
 * ride on its own draws (plan 291 M4). Moved out of export.ts to keep that hotspot from
 * growing.
 */
import { parseCssColorFull } from './export-css.ts';

/** Elements that paint content of their own whatever their style says. */
const SELF_PAINTING_TAGS = new Set(['img', 'svg', 'canvas', 'video', 'picture', 'iframe', 'object', 'embed', 'input', 'textarea', 'select']);

/** Does a computed style paint a box: a fill, a background image, a border or a shadow. */
export function stylePaintsBox(s: CSSStyleDeclaration): boolean {
  const color = parseCssColorFull(s.backgroundColor);
  if (color && color[3] > 0) return true;
  if (s.backgroundImage && s.backgroundImage !== 'none') return true;
  if (s.boxShadow && s.boxShadow !== 'none') return true;
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const style = s.getPropertyValue(`border-${side}-style`);
    if (style && style !== 'none' && style !== 'hidden' && parseFloat(s.getPropertyValue(`border-${side}-width`) || '0') > 0) return true;
  }
  return false;
}

/**
 * Whether nothing under `el` paints: no text, no picture and no descendant with a fill,
 * border or shadow of its own. A large subtree (over 32 descendants) is not looked at
 * and counts as painting.
 */
export function subtreePaintsNothing(el: Element): boolean {
  if ((el.textContent ?? '').trim()) return false;
  const all = el.querySelectorAll('*');
  if (all.length > 32) return false;
  for (const d of Array.from(all)) {
    if (SELF_PAINTING_TAGS.has(d.tagName.toLowerCase())) return false;
    const s = window.getComputedStyle(d);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    if (stylePaintsBox(s)) return false;
    for (const pseudo of ['::before', '::after']) {
      const c = window.getComputedStyle(d, pseudo).content;
      if (c && c !== 'none' && c !== 'normal') return false;
    }
  }
  return true;
}
