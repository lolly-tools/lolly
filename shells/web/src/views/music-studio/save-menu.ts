// SPDX-License-Identifier: MPL-2.0
/**
 * Where the music generator's Save puts the tune (#/music): Assets, where the tune is an
 * asset that plays anywhere a tune plays, or Projects, where it opens back in the studio
 * with every setting (lib/music-project.ts). On a wide screen Save opens a dropdown under
 * the button (components/body-popover.ts); on a phone it opens a sheet from the bottom
 * (components/modal.ts, styled with the instrument browser's sheet in
 * parts/music-browser.css). Each choice says what its save records, so the note is in
 * view at the moment of choosing, on a touch screen as with a mouse. Escape, the close
 * button and a tap outside close either one, and focus goes back to Save.
 */
import { t } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import { iconNode } from '../../lib/icon-node.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import '../../styles/parts/music-browser.css';

export type SaveDestination = 'assets' | 'projects';

export interface SaveChoice {
  id: SaveDestination;
  title: string;
  /** What a save there records, in a line. */
  note: string;
  icon: IconName;
}

export interface SaveMenu {
  isOpen(): boolean;
  close(): void;
}

/** The dropdown from this width, the sheet below it (the view's breakpoint). */
const WIDE = '(min-width: 761px)';
let seq = 0;

/** One choice as a button: its icon, its name and its note, named by the one and described by the other. */
function choiceButton(c: SaveChoice, role: string | null): HTMLButtonElement {
  const n = ++seq;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ms-save-choice';
  btn.dataset.saveTo = c.id;
  if (role) btn.setAttribute('role', role);
  btn.setAttribute('aria-labelledby', `ms-save-t-${n}`);
  btn.setAttribute('aria-describedby', `ms-save-n-${n}`);
  const glyph = document.createElement('span');
  glyph.className = 'ms-save-choice-icon';
  glyph.setAttribute('aria-hidden', 'true');
  const g = iconNode(c.icon);
  if (g) glyph.append(g);
  const title = Object.assign(document.createElement('span'), { className: 'ms-save-choice-title', id: `ms-save-t-${n}`, textContent: c.title });
  const note = Object.assign(document.createElement('span'), { className: 'ms-save-choice-note', id: `ms-save-n-${n}`, textContent: c.note });
  btn.append(glyph, title, note);
  return btn;
}

/** Wire Save to its choices. `choices` is read on every open, so a note can follow the profile. */
export function wireSaveMenu(button: HTMLElement, choices: () => SaveChoice[], pick: (id: SaveDestination) => void): SaveMenu {
  const popover = mountBodyPopover(button, (el, handle) => {
    const list = document.createElement('div');
    list.className = 'ms-save-list';
    for (const c of choices()) {
      const b = choiceButton(c, 'menuitem');
      b.addEventListener('click', () => { handle.close(true); pick(c.id); });
      list.append(b);
    }
    el.append(list);
    return list.querySelector<HTMLElement>('button');
  }, {
    className: 'surface surface--floating ms-save-menu',
    role: 'menu',
    ariaLabel: t('Save'),
    menuNavigation: true,
  });

  let sheet: ModalHandle<SaveDestination | 'close'> | null = null;
  const openSheet = (): void => {
    const titleId = `ms-save-sheet-${++seq}`;
    sheet = mountModal<SaveDestination | 'close'>(`
      <div class="msb-head">
        <span class="msb-grip" aria-hidden="true"></span>
        <div class="msb-title-row">
          <h2 class="msb-title" id="${titleId}">${escapeHtml(t('Save'))}</h2>
          <button type="button" class="btn btn--ghost btn--sm msb-close" data-close aria-label="${escapeHtml(t('Close'))}" title="${escapeHtml(t('Close'))}">${icon('close', { size: 18 })}</button>
        </div>
      </div>
      <div class="msb-body ms-save-list" role="group" aria-labelledby="${titleId}"></div>`, {
      className: 'msb msb--sheet ms-save-sheet',
      cancelValue: 'close',
      initialFocus: (el) => el.querySelector<HTMLElement>('.ms-save-choice'),
      onClose: (how) => {
        sheet = null;
        if (how && how !== 'close') pick(how);
        if (button.isConnected) button.focus({ preventScroll: true });
      },
    });
    const dlg = sheet.el;
    dlg.setAttribute('aria-labelledby', titleId);
    const list = dlg.querySelector<HTMLElement>('.ms-save-list');
    for (const c of choices()) {
      const b = choiceButton(c, null);
      b.addEventListener('click', () => sheet?.close(c.id));
      list?.append(b);
    }
    dlg.querySelector('[data-close]')?.addEventListener('click', () => sheet?.close('close'));
  };

  button.setAttribute('aria-haspopup', window.matchMedia?.(WIDE).matches === false ? 'dialog' : 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    if (popover.isOpen()) { popover.close(true); return; }
    if (window.matchMedia?.(WIDE).matches === false) openSheet();
    else popover.open();
  });

  return {
    isOpen: () => popover.isOpen() || sheet !== null,
    close: () => { popover.close(); sheet?.close('close'); },
  };
}
