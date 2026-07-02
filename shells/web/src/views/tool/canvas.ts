// SPDX-License-Identifier: MPL-2.0
/**
 * Sidebar-focus choreography for canvas interactions (finding 1): scroll a
 * control into view with the "you are here" pulse, fold/unfold blocks, and the
 * click-a-canvas-block → focus-its-sidebar-row flow. Extracted from tool.js
 * unchanged.
 */
import { prefersReducedMotion } from './stage.ts';

// Bring a sidebar control into view and flash a one-shot "you are here" pulse on
// its row. The single entry point for every canvas-click and block-expand scroll,
// so arrival is consistent: top-aligned (clear of the sticky header via the row's
// scroll-margin), smooth unless reduce-motion. `control` may be the control itself
// or any node inside its row/block.
export function scrollToControl(control: Element | null | undefined, { pulse = true }: { pulse?: boolean } = {}): void {
  if (!control) return;
  const row = control.closest('.input-row, .block-item') || control;
  row.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  if (!pulse) return;
  row.classList.remove('is-target');
  if (row instanceof HTMLElement) void row.offsetWidth;   // restart the keyframe if it's mid-flight
  row.classList.add('is-target');
  const done = () => row.classList.remove('is-target');
  row.addEventListener('animationend', done, { once: true });
  setTimeout(done, 700);                       // fallback if the keyframe is reduce-motion-zeroed
}

// Reveal a block's fields with a brief height tween when it expands. The resting
// collapsed state stays `display:none` (so folded fields keep out of the Tab order
// and the a11y tree) — only the open is animated, and only when motion is allowed.
export function revealBlockFields(item: Element): void {
  if (prefersReducedMotion()) return;
  const fields = item.querySelector<HTMLElement>('.block-fields');
  if (!fields || typeof fields.animate !== 'function') return;
  fields.style.height = '0px';
  fields.style.overflow = 'hidden';
  const h = fields.scrollHeight;               // full content height even while clamped to 0
  if (!h) { fields.style.height = ''; fields.style.overflow = ''; return; }
  const anim = fields.animate(
    [{ height: '0px', opacity: 0.4 }, { height: `${h}px`, opacity: 1 }],
    { duration: 180, easing: 'ease' }
  );
  const clear = () => { fields.style.height = ''; fields.style.overflow = ''; };
  anim.onfinish = anim.oncancel = clear;
}

// Single seam for folding/unfolding a block: keeps the collapse class, the chevron
// button's aria-label/title, and the open animation in lockstep wherever a block is
// toggled (chevron, pill body, collapse-all, canvas click). renderInputs re-applies
// the collapse state across model rebuilds via the captured collapsedBlocks set.
export function toggleBlock(item: Element, collapsed: boolean): void {
  if (item.classList.contains('is-collapsed') === collapsed) return;
  item.classList.toggle('is-collapsed', collapsed);
  const btn = item.querySelector('[data-block-collapse]');
  btn?.setAttribute('aria-label', collapsed ? 'Expand block' : 'Collapse block');
  btn?.setAttribute('title', collapsed ? 'Expand' : 'Collapse');
  if (!collapsed) revealBlockFields(item);
}

// Click-to-focus for a single block inside a blocks input: expand the target
// block and fold every other typed block to a pill, then drop the caret in its
// text field and scroll it into view. Folding mirrors the manual collapse
// toggle's button state so renderInputs re-applies it across model rebuilds.
// Triggered when a rendered canvas block is clicked — an "edit one at a time"
// focus mode. Blocks with no text field (headshot, blank) just expand + scroll.
export function focusSidebarBlock(blocksEl: Element, index: number | string): void {
  const items = [...blocksEl.querySelectorAll<HTMLElement>('.block-item.is-typed')];
  const target = items.find(b => b.dataset.blockIndex === String(index));
  if (!target) return;

  for (const b of items) toggleBlock(b, b !== target);

  // Reveal the block if it sits inside a closed section, then bring it into view.
  target.closest('details.input-section')?.setAttribute('open', '');
  scrollToControl(target);

  const field = target.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '.block-fields textarea.block-field, .block-fields input.block-field:not([type="range"])'
  );
  if (field) {
    field.focus();
    const end = field.value?.length ?? 0;
    try { field.setSelectionRange(end, end); } catch { /* non-text field */ }
  }
}
