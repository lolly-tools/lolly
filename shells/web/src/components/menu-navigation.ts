// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
// SPDX-License-Identifier: MPL-2.0

/** Wrapped menu focus adapts Penpot context_menu_a11y.cljs and DS select.cljs.
 * Source snapshots and modifications: ../views/design-canvas-ux.penpot/. */
export interface MenuNavigationOptions {
  /** Maintain one Tab stop in menus that already use roving focus. */
  roving?: boolean;
}

const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
const EDITORS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="tablist"]';

function visible(
  item: HTMLElement,
  menu: HTMLElement,
  visibility: Map<HTMLElement, boolean>
): boolean {
  if (item.matches(':disabled') || item.closest('[hidden], [inert], [aria-hidden="true"]'))
    return false;
  const view = item.ownerDocument.defaultView;
  for (let node: HTMLElement | null = item; node; node = node.parentElement) {
    let shown = visibility.get(node);
    if (shown === undefined) {
      const style = view?.getComputedStyle(node);
      shown = style?.display !== 'none' && style?.visibility !== 'hidden';
      visibility.set(node, shown);
    }
    if (!shown) return false;
    if (node === menu) break;
  }
  return true;
}

/** One delegated listener while a menu panel is open. Activation and dismissal
 * stay with native controls and the existing popover lifecycle. */
export function wireMenuNavigation(
  panel: HTMLElement,
  options: MenuNavigationOptions = {}
): () => void {
  const onKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest || target.closest(EDITORS)) return;
    let menu = target.closest<HTMLElement>('[role="menu"]');
    // A touch sheet initially focuses its dialog instead of choosing a row.
    if (!menu && target === panel) menu = panel.querySelector<HTMLElement>('[role="menu"]');
    if (!menu || !panel.contains(menu)) return;
    const visibility = new Map<HTMLElement, boolean>();
    const items = [...menu.querySelectorAll<HTMLElement>(ITEMS)].filter(
      (item) => item.closest('[role="menu"]') === menu && visible(item, menu, visibility)
    );
    event.preventDefault();
    event.stopPropagation();
    if (!items.length) return;
    const active = panel.ownerDocument.activeElement;
    const index = items.findIndex((item) => item === active || item.contains(active));
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : index < 0
            ? event.key === 'ArrowDown'
              ? 0
              : items.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    const item = items[next]!;
    if (options.roving)
      items.forEach((candidate) => {
        candidate.tabIndex = candidate === item ? 0 : -1;
      });
    item.focus({ preventScroll: true });
    item.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  panel.addEventListener('keydown', onKey);
  return () => panel.removeEventListener('keydown', onKey);
}
