// SPDX-License-Identifier: MPL-2.0
/**
 * Where a rail/anchor popover goes, in stage-relative px. It prefers the anchor's
 * right (the docked rail's long-standing behaviour, unchanged while the rail sits on
 * the left edge) and FLIPS to its left when that would overflow the stage.
 *
 * The flip only started mattering when the rail became draggable: a rail parked in the
 * right half of a `overflow:hidden` stage (carousel-maker and record are `.is-paged`)
 * used to open its menu straight out through the clipped edge. Vertically the popover
 * is pulled up to keep its foot inside rather than being pinned to the anchor's top.
 *
 * Pure numbers, so the geometry is testable without a browser.
 */
export function placePopover(
  anchor: { left: number; right: number; top: number; bottom?: number },
  pop: { w: number; h: number },
  stage: { w: number; h: number },
  gap = 8,
  pad = 6
): { left: number; top: number } {
  const below = anchor.bottom != null;
  const top = below ? anchor.bottom! + gap : anchor.top;
  const rightSide = below ? anchor.left : anchor.right + gap;
  const leftSide = anchor.left - gap - pop.w;
  // No measurable stage (detached / display:none / jsdom, which has no layout at all):
  // there is nothing to clamp against, so keep the plain anchored placement rather than
  // inventing a position from zeroes.
  if (!(stage.w > 0) || !(stage.h > 0)) return { left: rightSide, top: Math.max(pad, top) };
  // Flip only if the left side is genuinely better: on a stage too narrow for either,
  // stay on the preferred side and let the clamp do what it can.
  const left = !below && rightSide + pop.w > stage.w - pad && leftSide >= pad ? leftSide : rightSide;
  const maxTop = Math.max(pad, stage.h - pop.h - pad);
  return {
    left: Math.round(Math.max(pad, Math.min(left, Math.max(pad, stage.w - pop.w - pad)))),
    top: Math.round(Math.min(Math.max(top, pad), maxTop)),
  };
}

/** Mount and position the menu relative to the control that actually opened it. */
export function positionEditorPopover(menu: HTMLElement, anchor: HTMLElement, stage: HTMLElement): void {
  const detached = !stage.contains(anchor);
  if (detached) menu.classList.add('fc-popover--viewport');
  (detached ? document.body : stage).appendChild(menu);
  const ar = anchor.getBoundingClientRect();
  const sr = detached
    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    : stage.getBoundingClientRect();
  const below = !!anchor.closest('.design-topbar');
  // A top-bar menu scrolls into the space below its trigger instead of covering it.
  if (below) menu.style.maxHeight = `${Math.max(0, sr.height - (ar.bottom - sr.top) - 14)}px`;
  const pr = menu.getBoundingClientRect();
  const pos = placePopover(
    { left: ar.left - sr.left, right: ar.right - sr.left, top: ar.top - sr.top,
      ...(below ? { bottom: ar.bottom - sr.top } : {}) },
    { w: pr.width, h: pr.height }, { w: sr.width, h: sr.height },
  );
  menu.style.left = `${pos.left}px`;
  menu.style.top = `${pos.top}px`;
}
