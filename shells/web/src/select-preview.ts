// SPDX-License-Identifier: MPL-2.0
/**
 * Make <select> a live-preview scrubber, by keyboard AND mouse.
 *
 * On Windows/Linux, ArrowUp/ArrowDown on a focused (closed) <select> cycles its
 * value in place and fires `change` - so a tool sees each value and live-previews
 * it. On macOS the same key instead OPENS the native popup, which breaks that loop
 * (nothing changes until you commit from the menu). And no platform previews while
 * you browse the popup with the mouse - the native menu only commits on release.
 *
 * We normalise both:
 *   • Arrow keys cycle the value in place (never open the popup), everywhere.
 *   • The wheel cycles the value while the select is focused - the mouse analog of
 *     the arrow scrub - so a value can be dialled in and previewed without ever
 *     opening the menu.
 *
 * Each step moves to the next enabled option (clamped at the ends, like native
 * cycling) and dispatches `input` + `change` so every listener fires regardless of
 * which it hooks. The native menu is still reachable by click, Space/Enter, or a
 * modified arrow (Alt/⌥/Ctrl/Cmd+Arrow pass straight through). Real list boxes
 * (`multiple` / `size > 1`) navigate natively and are left alone.
 */
export function initSelectPreview(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;             // leave modified arrows to the OS
    const sel = asPlainSelect(e.target);
    if (!sel) return;
    // Always swallow the key so macOS never opens its popup; cycle in place.
    e.preventDefault();
    step(sel, e.key === 'ArrowDown' ? 1 : -1);
  });

  // Wheel = the mouse scrubber. Only while the select is FOCUSED, so idle
  // scrolling over a select (e.g. in the sidebar) never hijacks the page or
  // silently changes a value - the user has to engage the control first.
  // Non-passive so preventDefault can stop the page from also scrolling.
  document.addEventListener('wheel', (e) => {
    const sel = asPlainSelect(e.target);
    if (!sel || document.activeElement !== sel) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;       // treat only vertical intent as a step
    e.preventDefault();
    step(sel, e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}

/** The event target as a plain (single, enabled, dropdown) <select>, else null. */
function asPlainSelect(target: EventTarget | null): HTMLSelectElement | null {
  const el = target as HTMLElement | null;
  if (!el || el.tagName !== 'SELECT') return null;
  const sel = el as HTMLSelectElement;
  if (sel.disabled || sel.multiple || sel.size > 1 || !sel.options.length) return null;
  return sel;
}

/** Move the selection one enabled step in `dir` (clamped) and fire input+change.
 *  Skips `hidden` options too: nothing in the shell hides one today (the long-select
 *  filter box that used to is gone), but scrubbing must never land on a value the
 *  user cannot pick from the dropdown itself. */
function step(sel: HTMLSelectElement, dir: number): void {
  const opts = sel.options;
  let next = sel.selectedIndex;
  for (let n = sel.selectedIndex + dir; n >= 0 && n < opts.length; n += dir) {
    const o = opts[n];
    if (o && !o.disabled && !o.hidden) { next = n; break; }
  }
  if (next === sel.selectedIndex) return;                        // already at an end
  sel.selectedIndex = next;
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}
