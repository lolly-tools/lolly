// SPDX-License-Identifier: MPL-2.0
/**
 * Collapse a row of labelled buttons to icons only when the labels do not fit.
 *
 * A fixed breakpoint is wrong for these rows: how much they hold depends on the
 * selection, the catalogue and the language (German labels run a third longer),
 * so a tablet could wrap a bar into three rows or push a toolbar past the right
 * edge and scroll the whole page sideways. Instead the row measures itself.
 *
 * `steps` are classes applied cumulatively, gentlest first. Each call clears them
 * all, measures, and adds one more until the row fits (or the steps run out).
 * The classes flip inside one synchronous block, so a state that does not fit is
 * never painted. What each class hides is up to the view's stylesheet; clip a
 * label (visually hidden) rather than remove it unless the button carries its own
 * aria-label.
 *
 * Every fitted element is re-fitted on window resize until it leaves the DOM.
 */

/** True when `el` (or `row`) is wider than its box, or `row`'s children wrap onto a second row. */
export function rowOverflows(el: HTMLElement, row: HTMLElement = el): boolean {
  if (el.scrollWidth > el.clientWidth + 1 || row.scrollWidth > row.clientWidth + 1) return true;
  // Wrapped = some child sits wholly below the first one. Comparing tops alone is
  // wrong: centred children of different heights start a few pixels apart on one row.
  let first: DOMRect | null = null;
  for (const c of row.children) {
    const b = c as HTMLElement;
    if (b.hidden || !b.offsetParent) continue;
    const r = b.getBoundingClientRect();
    if (!first) first = r;
    else if (r.top >= first.bottom - 1) return true;
  }
  return false;
}

const fitted = new Map<HTMLElement, () => void>();
let resizeBound = false;

/**
 * Apply as few of `steps` as it takes for `overflows()` to report false, then call
 * `after` with the count (on resize too). Returns how many steps are applied
 * (0 = everything labelled).
 */
export function fitLabels(
  el: HTMLElement,
  steps: readonly string[],
  overflows: () => boolean = () => rowOverflows(el),
  after?: (applied: number) => void,
): number {
  if (!resizeBound && typeof window !== 'undefined') {
    resizeBound = true;
    window.addEventListener('resize', () => {
      for (const [node, refit] of fitted) {
        if (node.isConnected) refit();
        else fitted.delete(node);
      }
    });
  }
  fitted.set(el, () => fitLabels(el, steps, overflows, after));
  el.classList.remove(...steps);
  let applied = 0;
  if (el.isConnected && !el.hidden) {
    while (applied < steps.length && overflows()) el.classList.add(steps[applied++]!);
  }
  after?.(applied);
  return applied;
}
