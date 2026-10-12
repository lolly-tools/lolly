// SPDX-License-Identifier: MPL-2.0
/** Pages are document metadata; choosing one only changes the local editor view. */
import type { Box } from './free-canvas-math.ts';
import type { DesignPage, DesignPagePort } from './design-ports.ts';
import { navigatorWindow } from './design-navigator-window.ts';
import { mountBodyPopover, pointAnchor } from '../components/body-popover.ts';
import { tRaw as t } from '../i18n.ts';
import { DESIGN_HIERARCHY_LIMITS, designHierarchyDescendants, designHierarchyIndex } from '../../../../engine/src/design-hierarchy.ts';

export function designPageId(pages: readonly DesignPage[]): string {
  const known = new Set(pages.map(page => page.id));
  let value = '';
  do { value = `page-${globalThis.crypto.randomUUID()}`; } while (known.has(value));
  return value;
}

export function reorderDesignPages(pages: readonly DesignPage[], id: string, delta: number): DesignPage[] {
  const next = pages.map(page => ({ ...page })), from = next.findIndex(page => page.id === id);
  if (from < 0) return next;
  const to = Math.max(0, Math.min(next.length - 1, from + delta));
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next.map((page, order) => ({ ...page, order }));
}

/** Move an artboard and its complete ownership subtree without changing geometry. */
export function moveArtboardToPage(boxes: readonly Box[], artboard: string, pageId: string, pages: readonly DesignPage[]): Box[] {
  const index = designHierarchyIndex(boxes, pages);
  if (index.byId.get(artboard)?.kind !== 'frame' || !pages.some(page => page.id === pageId)) return boxes.slice();
  const moving = designHierarchyDescendants(index, new Set([artboard]));
  return boxes.map(box => moving.has(String(box.id)) ? { ...box, pageId } : box);
}

export function mountDesignPages(host: HTMLElement, port: DesignPagePort) {
  const doc = host.ownerDocument;
  const section = doc.createElement('section'); section.className = 'fc-nav-document-pages'; section.dataset.designPages = '';
  const head = doc.createElement('div'); head.className = 'fc-nav-pages-head';
  const title = doc.createElement('h3'); title.textContent = t('Pages');
  const add = doc.createElement('button'); add.type = 'button'; add.className = 'btn btn--ghost btn--sm';
  add.textContent = '+'; add.setAttribute('aria-label', t('Add page')); add.dataset.addDesignPage = '';
  const list = doc.createElement('div'); list.className = 'fc-nav-document-page-list'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t('Pages'));
  head.append(title, add); section.append(head, list); host.prepend(section);
  let renaming = '', disposed = false;
  const rows = new Map<string, { signature: string; node: HTMLElement }>();
  const anchor = pointAnchor();
  let menuId = '';
  const editable = (): boolean => port.canEdit?.() !== false;
  const menu = mountBodyPopover(anchor, (el, popover) => {
      const pages = port.get(), at = pages.findIndex(page => page.id === menuId);
      const action = (name: string, disabled: boolean, run: () => void): void => {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'fc-nav-menu-item';
        button.textContent = name; button.setAttribute('role', 'menuitem'); button.disabled = disabled;
        button.onclick = () => { popover.close(); if (editable()) run(); }; el.append(button);
      };
      action(t('Rename page'), !editable(), () => rename(menuId));
      action(t('Duplicate page'), !editable(), () => port.duplicate(menuId));
      action(t('Move up'), !editable() || at <= 0, () => port.commit(reorderDesignPages(pages, menuId, -1), port.getBoxes(), t('Reorder pages')));
      action(t('Move down'), !editable() || at < 0 || at >= pages.length - 1, () => port.commit(reorderDesignPages(pages, menuId, 1), port.getBoxes(), t('Reorder pages')));
      action(t('Delete page'), !editable() || pages.length <= 1, () => port.remove(menuId));
      return el.querySelector<HTMLElement>('button:not(:disabled)');
  }, { className: 'fc-nav-menu fc-nav-page-menu', ariaLabel: t('Page actions'), menuNavigation: true });
  function openMenu(id: string, source: HTMLElement): void {
    menuId = id; const rect = source.getBoundingClientRect(); anchor.x = rect.right; anchor.y = rect.bottom; anchor.delegate = source; menu.open();
  }
  function rename(id: string): void {
    if (!editable() || renaming) return;
    const page = port.get().find(value => value.id === id), row = rows.get(id)?.node;
    const name = row?.querySelector<HTMLElement>('[data-page-name]'); if (!page || !row || !name) return;
    renaming = id;
    const input = doc.createElement('input'); input.className = 'fc-nav-name-input'; input.value = page.name; input.maxLength = DESIGN_HIERARCHY_LIMITS.name;
    input.setAttribute('aria-label', t('Page name')); name.replaceWith(input); input.focus(); input.select();
    let settled = false;
    function finish(commit: boolean): void {
      if (settled) return; settled = true; renaming = '';
      const value = input.value.trim(); rows.delete(id);
      if (commit && editable() && value && value !== page!.name) port.commit(port.get().map(valuePage => valuePage.id === id ? { ...valuePage, name: value } : valuePage), port.getBoxes(), t('Rename page'));
      render(); rows.get(id)?.node.querySelector<HTMLElement>('[data-nav-row]')?.focus();
    }
    input.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(event.key === 'Enter'); } });
    input.addEventListener('blur', () => finish(true));
  }
  const windowed = navigatorWindow(list, (page: DesignPage, index) => {
    const signature = `${page.name}|${port.active() === page.id}|${editable()}|${index}`;
    const cached = rows.get(page.id); if (cached?.signature === signature) return cached.node;
    const item = doc.createElement('div'); item.className = 'fc-nav-document-page'; item.dataset.pageId = page.id;
    const row = doc.createElement('div'); row.className = 'fc-nav-page-select'; row.dataset.navRow = ''; row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(port.active() === page.id)); row.tabIndex = port.active() === page.id ? 0 : -1;
    const name = doc.createElement('span'); name.dataset.pageName = ''; name.textContent = page.name; row.append(name);
    row.onclick = () => port.setActive(page.id); row.ondblclick = () => rename(page.id);
    row.onkeydown = event => {
      if (event.metaKey || event.ctrlKey) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); port.setActive(page.id); }
      else if (event.key === 'F2') { event.preventDefault(); rename(page.id); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); const pages = port.get();
        const at = event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : Math.max(0, Math.min(pages.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        windowed.reveal(at);
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); openMenu(page.id, row); }
    };
    const more = doc.createElement('button'); more.type = 'button'; more.className = 'fc-nav-row-menu'; more.textContent = '⋯'; more.tabIndex = -1;
    more.setAttribute('aria-label', t('Actions for {name}', { name: page.name })); more.setAttribute('aria-haspopup', 'menu'); more.onclick = () => openMenu(page.id, more);
    item.append(row, more); rows.set(page.id, { signature, node: item }); return item;
  }, { height: 30 });
  add.onclick = () => {
    if (!editable() || port.get().length >= DESIGN_HIERARCHY_LIMITS.pages) return;
    const pages = port.get(), id = designPageId(pages);
    port.commit([...pages, { id, name: t('Page {n}', { n: pages.length + 1 }) }], port.getBoxes(), t('Add page'));
    port.setActive(id);
  };
  function render(): void {
    if (disposed || renaming) return;
    const pages = port.get(), known = new Set(pages.map(page => page.id));
    for (const id of rows.keys()) if (!known.has(id)) rows.delete(id);
    add.disabled = !editable() || pages.length >= DESIGN_HIERARCHY_LIMITS.pages; windowed.set(pages);
  }
  const off = port.onChange(render); render();
  return { render, destroy(): void { disposed = true; menu.close(false); off(); windowed.destroy(); rows.clear(); section.remove(); } };
}
