// SPDX-License-Identifier: MPL-2.0
import { prefersReducedMotion } from './a11y-prefs.ts';

// The JS-driven scroll/reveal below is gated on lib/a11y-prefs.ts's shared read
// (the OS setting OR the app's own preference). The global CSS reset zeroes CSS
// animations + scroll-behavior, but it can't reach an explicit JS
// scrollIntoView({behavior:'smooth'}) or a WAAPI tween - those have to be gated in JS.

// Bring a sidebar control into view and flash a one-shot "you are here" pulse on
// its row. The single entry point for every canvas-click and block-expand scroll,
// so arrival is consistent: top-aligned (clear of the sticky header via the row's
// scroll-margin), smooth unless reduce-motion. `control` may be the control itself
// or any node inside its row/block.
export function scrollToControl(
  control: Element | null | undefined,
  { pulse = true }: { pulse?: boolean } = {}
): void {
  if (!control) return;
  const row = control.closest('.input-row, .block-item') || control;
  // A folded section hides its rows, so scrolling to one inside a closed fold would
  // land on nothing. Reveal it here rather than in each caller, so every path that
  // brings a control into view (canvas click, block expand, deep link) reveals it.
  row.closest('details.input-section')?.setAttribute('open', '');
  row.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  if (!pulse) return;
  row.classList.remove('is-target');
  void (row as HTMLElement).offsetWidth; // restart the keyframe if it's mid-flight
  row.classList.add('is-target');
  const done = () => row.classList.remove('is-target');
  row.addEventListener('animationend', done, { once: true });
  setTimeout(done, 700); // fallback if the keyframe is reduce-motion-zeroed
}

// Reveal a block's fields with a brief height tween when it expands. The resting
// collapsed state stays `display:none` (so folded fields keep out of the Tab order
// and the a11y tree) - only the open is animated, and only when motion is allowed.
export function revealBlockFields(item: Element): void {
  if (prefersReducedMotion()) return;
  const fields = item.querySelector<HTMLElement>('.block-fields');
  if (!fields || typeof fields.animate !== 'function') return;
  // Compositor-only fade - NO height tween. The old height animation forced a full
  // sidebar reflow every frame and slid every block below for 180ms, while the card
  // chrome (padding/border-radius/background) snapped instantly - the visible shake.
  // The fields are display:none when collapsed, so they land in their FINAL position
  // in a single reflow the moment they un-hide; only opacity/transform (which never
  // affect layout) animate, so nothing moves a pixel after settle.
  fields.animate(
    [
      { opacity: 0, transform: 'translateY(-4px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 120, easing: 'ease-out' }
  );
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
// Triggered when a rendered canvas block is clicked - an "edit one at a time"
// focus mode. Blocks with no text field (headshot, blank) just expand + scroll.
export function focusSidebarBlock(blocksEl: Element, index: number | string): void {
  const items = [...blocksEl.querySelectorAll<HTMLElement>('.block-item.is-typed')];
  const target = items.find((b) => b.dataset.blockIndex === String(index));
  if (!target) return;

  for (const b of items) toggleBlock(b, b !== target);

  // Reveal the block if it sits inside a closed section, then bring it into view.
  target.closest('details.input-section')?.setAttribute('open', '');
  // Defer the scroll one frame: the bulk collapse above relocated every block, so
  // scrolling now would chase a layout that's still settling and cause a visible double jump.
  requestAnimationFrame(() => scrollToControl(target));

  const field = target.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '.block-fields textarea.block-field, .block-fields input.block-field:not([type="range"])'
  );
  if (field) {
    field.focus();
    const end = field.value?.length ?? 0;
    try {
      field.setSelectionRange(end, end);
    } catch {
      /* non-text field */
    }
  }
}

