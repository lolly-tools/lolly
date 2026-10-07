// SPDX-License-Identifier: MPL-2.0
/**
 * The scope chip on the tool stage (plan 75 section 5.1): where the document belongs,
 * the person's role there and its save state, in words ("Brand refresh · Can edit",
 * "Not saved yet"), never in colour alone.
 *
 * Drawn by lib/document-scope.ts, which decides whether there is a chip at all and
 * hands over already-localised text. With menu rows the chip is a real button with
 * `aria-haspopup="menu"` and a keyboard menu (arrows, Home, End, Escape); without any
 * it is plain status text, because a button that does nothing is worse than none.
 */
import type { DocumentScopeChip, DocumentScopeChipView, DocumentScopeMenuItem } from '../lib/document-scope.ts';
import './document-scope-chip.css';

let seq = 0;

function span(className: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  return el;
}

/** Mount the chip on `stage` (positioned by the stylesheet) and return its handle. */
export function createDocumentScopeChip(stage: HTMLElement): DocumentScopeChipView {
  const id = `document-scope-${++seq}`;
  const root = document.createElement('div');
  root.className = 'document-scope';
  const label = span('document-scope-label');
  const state = span('document-scope-state');
  state.hidden = true;
  // Without menu rows the text sits in a status line; with them, in the button.
  const status = span('document-scope-chip');
  status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'document-scope-chip document-scope-chip--menu';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `${id}-menu`);
  button.hidden = true;
  const menu = document.createElement('div');
  menu.className = 'document-scope-menu';
  menu.id = `${id}-menu`;
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  status.append(label, state);
  root.append(status, button, menu);
  stage.append(root);

  let rows: readonly DocumentScopeMenuItem[] = [];

  const entries = (): HTMLButtonElement[] => [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const close = (focusButton: boolean): void => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  };
  const open = (): void => {
    menu.replaceChildren(...rows.map((row) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'document-scope-item';
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.dataset.scopeItem = row.id;
      item.textContent = row.label;
      item.addEventListener('click', () => {
        close(true);
        row.run();
      });
      return item;
    }));
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    entries()[0]?.focus();
  };
  button.addEventListener('click', () => {
    if (menu.hidden) open();
    else close(true);
  });
  button.addEventListener('keydown', (event) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && menu.hidden) {
      event.preventDefault();
      open();
      if (event.key === 'ArrowUp') entries().at(-1)?.focus();
    }
  });
  menu.addEventListener('keydown', (event) => {
    const items = entries();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number): void => { event.preventDefault(); items[(to + items.length) % items.length]?.focus(); };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'Tab') close(false);
  });
  const outside = (event: Event): void => {
    if (!root.contains(event.target as Node)) close(false);
  };
  document.addEventListener('pointerdown', outside, true);

  return {
    update(chip: DocumentScopeChip, menuRows: readonly DocumentScopeMenuItem[]): void {
      rows = menuRows;
      root.dataset.role = chip.role;
      label.textContent = chip.label;
      state.textContent = chip.state ?? '';
      state.hidden = !chip.state;
      const interactive = rows.length > 0;
      const host = interactive ? button : status;
      if (label.parentElement !== host) host.append(label, state);
      button.hidden = !interactive;
      status.hidden = interactive;
      if (!interactive) close(false);
      else if (!menu.hidden) open();
    },
    destroy(): void {
      document.removeEventListener('pointerdown', outside, true);
      root.remove();
    },
  };
}
