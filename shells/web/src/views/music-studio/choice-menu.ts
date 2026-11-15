// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's choice menus (#/music): Render (render and play, or download as
 * M4A or WAV, views/music-studio/render-button.ts) and Save (Assets, where the tune is an
 * asset that plays anywhere a tune plays, or Projects, where it opens back in the studio
 * with every setting, lib/music-project.ts). On a wide screen the button opens a dropdown
 * under the button (components/body-popover.ts); on a phone it opens a sheet from the
 * bottom (components/modal.ts, styled with the instrument browser's sheet in
 * parts/music-browser.css). Each choice says what it does or records, and a menu can end
 * with a line that holds for every choice (what a download records), so the note is in
 * view at the moment of choosing, on a touch screen as with a mouse. Escape, the close
 * button and a tap outside close either one, and focus goes back to the button. The
 * dropdown unfolds from its button and the sheet rises, as the app's menus and sheets do,
 * except under reduced motion or the performance setting.
 */
import { t } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import { iconNode } from '../../lib/icon-node.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import { motionOn } from './instrument-popup.ts';
import '../../styles/parts/music-browser.css';

/** Arm an opening motion on a menu or sheet that has just appeared, unless motion is off; it
 *  takes the class off again once the motion ends, so nothing lingers on the element. */
function enter(el: HTMLElement): void {
  if (!motionOn()) return;
  el.classList.add('is-entering');
  el.addEventListener('animationend', () => el.classList.remove('is-entering'), { once: true });
}

export interface MenuChoice<T extends string> {
  id: T;
  title: string;
  /** What the choice does or records, in a line. */
  note: string;
  icon: IconName;
}

export interface ChoiceMenuOptions<T extends string> {
  /** The menu's name: the button's word. */
  title: string;
  /** Read on every open, so a note can follow the profile or the render. */
  choices: () => MenuChoice<T>[];
  pick: (id: T) => void;
  /** A line under the choices that holds for every one of them, read on every open. */
  foot?: () => string;
  /** A data attribute the foot carries, for the tests and the view to find the foot by. */
  footAttr?: string;
}

export interface ChoiceMenu {
  isOpen(): boolean;
  close(): void;
}

/** The dropdown from this width, the sheet below it (the view's breakpoint). */
const WIDE = '(min-width: 761px)';
let seq = 0;

/** One choice as a button: its icon, its name and its note, named by the one and described by the other. */
function choiceButton<T extends string>(c: MenuChoice<T>, role: string | null): HTMLButtonElement {
  const n = ++seq;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ms-choice';
  btn.dataset.choice = c.id;
  if (role) btn.setAttribute('role', role);
  btn.setAttribute('aria-labelledby', `ms-choice-t-${n}`);
  btn.setAttribute('aria-describedby', `ms-choice-n-${n}`);
  const glyph = document.createElement('span');
  glyph.className = 'ms-choice-icon';
  glyph.setAttribute('aria-hidden', 'true');
  const g = iconNode(c.icon);
  if (g) glyph.append(g);
  const title = Object.assign(document.createElement('span'), { className: 'ms-choice-title', id: `ms-choice-t-${n}`, textContent: c.title });
  const note = Object.assign(document.createElement('span'), { className: 'ms-choice-note', id: `ms-choice-n-${n}`, textContent: c.note });
  btn.append(glyph, title, note);
  return btn;
}

/** The line under the choices, when the menu has one. */
function footNode<T extends string>(opts: ChoiceMenuOptions<T>): HTMLElement | null {
  const text = opts.foot?.();
  if (!text) return null;
  const p = Object.assign(document.createElement('p'), { className: 'ms-choice-foot', textContent: text });
  if (opts.footAttr) p.setAttribute(opts.footAttr, '');
  return p;
}

/** Wire a button to its choices: a dropdown on a wide screen, a sheet on a phone. */
export function wireChoiceMenu<T extends string>(button: HTMLElement, opts: ChoiceMenuOptions<T>): ChoiceMenu {
  const popover = mountBodyPopover(button, (el, handle) => {
    const list = document.createElement('div');
    list.className = 'ms-choice-list';
    for (const c of opts.choices()) {
      const b = choiceButton(c, 'menuitem');
      b.addEventListener('click', () => { handle.close(true); opts.pick(c.id); });
      list.append(b);
    }
    el.append(list);
    const foot = footNode(opts);
    if (foot) el.append(foot);
    enter(el);
    return list.querySelector<HTMLElement>('button');
  }, {
    className: 'surface surface--floating ms-choice-menu',
    role: 'menu',
    ariaLabel: opts.title,
    menuNavigation: true,
  });

  let sheet: ModalHandle<T | 'close'> | null = null;
  const openSheet = (): void => {
    const titleId = `ms-choice-sheet-${++seq}`;
    sheet = mountModal<T | 'close'>(`
      <div class="msb-head">
        <span class="msb-grip" aria-hidden="true"></span>
        <div class="msb-title-row">
          <h2 class="msb-title" id="${titleId}">${escapeHtml(opts.title)}</h2>
          <button type="button" class="btn btn--ghost btn--sm msb-close" data-close aria-label="${escapeHtml(t('Close'))}" title="${escapeHtml(t('Close'))}">${icon('close', { size: 18 })}</button>
        </div>
      </div>
      <div class="msb-body ms-choice-sheet-body">
        <div class="ms-choice-list" role="group" aria-labelledby="${titleId}"></div>
      </div>`, {
      className: 'msb msb--sheet ms-choice-sheet',
      cancelValue: 'close',
      initialFocus: (el) => el.querySelector<HTMLElement>('.ms-choice'),
      onClose: (how) => {
        sheet = null;
        if (how && how !== 'close') opts.pick(how);
        if (button.isConnected) button.focus({ preventScroll: true });
      },
    });
    const dlg = sheet.el;
    dlg.setAttribute('aria-labelledby', titleId);
    enter(dlg);
    const list = dlg.querySelector<HTMLElement>('.ms-choice-list');
    for (const c of opts.choices()) {
      const b = choiceButton(c, null);
      b.addEventListener('click', () => sheet?.close(c.id));
      list?.append(b);
    }
    const foot = footNode(opts);
    if (foot) list?.after(foot);
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
