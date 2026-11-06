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
  const actions = anchor.closest('.design-compact-actions');
  const viewport = window.visualViewport;
  const visibleTop = Math.max(sr.top, viewport?.offsetTop ?? 0);
  const visibleBottom = Math.min(sr.top + sr.height, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight));
  const menuBottom = actions ? Math.min(visibleBottom, actions.getBoundingClientRect().top) : sr.top + sr.height;
  if (actions) menu.style.maxHeight = `${Math.max(0, menuBottom - visibleTop - 12)}px`;
  const below = !!anchor.closest('.design-topbar');
  // A top-bar menu scrolls into the space below its trigger instead of covering it.
  if (below) menu.style.maxHeight = `${Math.max(0, sr.height - (ar.bottom - sr.top) - 14)}px`;
  const pr = menu.getBoundingClientRect();
  const pos = placePopover(
    { left: ar.left - sr.left, right: ar.right - sr.left, top: ar.top - sr.top,
      ...(below ? { bottom: ar.bottom - sr.top } : {}) },
    { w: pr.width, h: pr.height }, { w: sr.width, h: menuBottom - sr.top },
  );
  menu.style.left = `${pos.left}px`;
  menu.style.top = `${actions ? Math.max(visibleTop - sr.top + 6, pos.top) : pos.top}px`;
}

/**
 * Mount a floating editor PANEL (an `.fc-panel`, where the function above mounts a menu)
 * so that nothing can paint over it, and report whether it went to the body.
 *
 * The stage is `position: fixed`, which makes it a stacking context of its own: no
 * z-index inside it lifts a panel over a surface the body stacks above the stage. Two
 * such surfaces can cover the stage. A trigger outside the stage sits in one of them (the
 * docked column, a floating inspector, the phone's inspector sheet), so a panel appended
 * to the stage opened behind its own trigger. And in Design's phone layout the inspector
 * sheet and the navigator lie over the lower half of the stage, whichever control opened
 * the panel. In both cases the panel goes to the body with the class a menu gets for the
 * first case, and the caller places it in viewport coordinates.
 */
export function mountEditorPanel(panel: HTMLElement, anchor: HTMLElement, stage: HTMLElement): boolean {
  const over = !stage.contains(anchor) || stage.dataset.designLayout === 'compact';
  if (over) panel.classList.add('fc-popover--viewport');
  (over ? stage.ownerDocument.body : stage).appendChild(panel);
  return over;
}

/**
 * Where the room for a floating panel ends, in stage-relative px: the top of Design's
 * phone action bar while that bar is shown, otherwise the foot of the stage. Without
 * this limit a panel on the body would cover the bar, and one in the stage slid under the bar.
 */
export function stageFoot(stage: HTMLElement, sr: { top: number; height: number }): number {
  const bar = stage.querySelector<HTMLElement>('.design-compact-actions');
  const r = bar && !bar.hidden ? bar.getBoundingClientRect() : null;
  return r && r.height > 0 ? Math.min(sr.height, r.top - sr.top) : sr.height;
}

/**
 * Where a panel opened beside its trigger goes, in stage-relative px: to the trigger's
 * right, kept inside the stage, with its top level with the trigger's and pulled up so
 * its foot stays above `foot`. A panel taller than the room gets a `maxHeight` and
 * scrolls instead of running off the bottom. Pure numbers, so it is testable without a
 * browser.
 */
export function placePanelBeside(
  anchor: { right: number; top: number },
  pop: { w: number; h: number },
  stage: { w: number },
  foot: number,
  gap = 8,
  pad = 6
): { left: number; top: number; maxHeight?: number } {
  // No measurable stage (display:none, or jsdom with no layout): keep the plain anchored
  // placement, as placePopover does, rather than clamping against zeroes.
  if (!(stage.w > 0) || !(foot > 0)) return { left: anchor.right + gap, top: Math.max(pad, anchor.top) };
  const left = Math.max(pad, Math.min(anchor.right + gap, stage.w - pop.w - gap));
  const room = foot - pad - gap;
  if (pop.h <= room) return { left, top: Math.max(pad, Math.min(anchor.top, foot - pop.h - gap)) };
  return { left, top: pad, maxHeight: Math.max(0, room) };
}
