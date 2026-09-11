// SPDX-License-Identifier: MPL-2.0
/** The Design canvas's discoverable keyboard contract. */

import { type ModalHandle, mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';

export interface DesignShortcutRow {
  keys: string;
  label: string;
}

export interface DesignShortcutGroup {
  label: string;
  rows: DesignShortcutRow[];
}

function isApple(platform: string): boolean {
  return /Mac|iPhone|iPad/i.test(platform);
}

/**
 * The one inventory rendered by the sheet. Labels resolve at call time so a live locale
 * switch never freezes the module in the language it was first imported under.
 */
export function designShortcutGroups(
  platform = typeof navigator === 'undefined' ? '' : navigator.platform
): DesignShortcutGroup[] {
  const mod = isApple(platform) ? '⌘' : t('Ctrl');
  const alt = isApple(platform) ? '⌥' : t('Alt');
  return [
    {
      label: t('Document'),
      rows: [
        { keys: `${mod} S`, label: t('Save to your library') },
        { keys: `${mod} E`, label: t('Export') },
        { keys: `${mod} Enter`, label: t('Present') },
        { keys: `${mod} Z`, label: t('Undo') },
        { keys: `${mod} Shift Z`, label: t('Redo') },
      ],
    },
    {
      label: t('Tools and editing'),
      rows: [
        { keys: 'V', label: t('Pointer tool') },
        { keys: 'P', label: t('Pen tool') },
        { keys: 'N', label: t('Edit points') },
        { keys: 'Enter / F2', label: t('Edit selected text') },
        { keys: 'Esc', label: t('Leave the current mode or selection') },
      ],
    },
    {
      label: t('Selection'),
      rows: [
        { keys: `${mod} A`, label: t('Select all') },
        { keys: `${mod} C / V`, label: t('Copy / paste objects') },
        { keys: `${mod} X`, label: t('Cut objects') },
        { keys: `${mod} D`, label: t('Duplicate') },
        { keys: `${mod} ${alt} C / V`, label: t('Copy / paste style') },
        { keys: `${mod} G`, label: t('Group') },
        { keys: `${mod} Shift G`, label: t('Ungroup') },
        { keys: 'Delete', label: t('Delete selection') },
        { keys: 'Arrow keys', label: t('Move by 1 px') },
        { keys: 'Shift + arrows', label: t('Move by 10 px') },
        { keys: 'Shift H / V', label: t('Flip horizontal / vertical') },
        { keys: `${mod} [ / ]`, label: t('Move backward / forward') },
        { keys: `${mod} Shift [ / ]`, label: t('Send to back / bring to front') },
      ],
    },
    {
      label: t('View and panels'),
      rows: [
        { keys: '0', label: t('Fit all') },
        { keys: '1', label: t('Actual size') },
        { keys: '+ / −', label: t('Zoom in / out') },
        { keys: 'Shift R', label: t('Toggle rulers and guides') },
        { keys: '/  or  \\', label: t('Hide / show editor chrome') },
        { keys: `${alt} 1`, label: t('Toggle timeline') },
        { keys: `${alt} 2`, label: t('Toggle navigator') },
        { keys: `${alt} 3`, label: t('Toggle inspector') },
        { keys: '?', label: t('Keyboard shortcuts') },
      ],
    },
  ];
}

export interface DesignShortcutsOptions {
  opener?: HTMLElement | null;
  onClose?(): void;
}

/** Mount the accessible sheet and return its ordinary modal lifecycle handle. */
export function openDesignShortcuts(opts: DesignShortcutsOptions = {}): ModalHandle<void> {
  const opener = opts.opener ?? (document.activeElement as HTMLElement | null);
  const sheet = document.createElement('div');
  sheet.className = 'fc-shortcuts-sheet';

  const heading = document.createElement('h2');
  heading.className = 'fc-shortcuts-title';
  heading.textContent = t('Design keyboard shortcuts');
  sheet.appendChild(heading);

  const groups = document.createElement('div');
  groups.className = 'fc-shortcuts-groups';
  for (const group of designShortcutGroups()) {
    const section = document.createElement('section');
    section.className = 'fc-shortcuts-group';
    const title = document.createElement('h3');
    title.textContent = group.label;
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    for (const row of group.rows) {
      const tr = document.createElement('tr');
      const keys = document.createElement('td');
      keys.className = 'fc-shortcuts-keys';
      const kbd = document.createElement('kbd');
      kbd.textContent = row.keys;
      keys.appendChild(kbd);
      const label = document.createElement('td');
      label.textContent = row.label;
      tr.append(keys, label);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    section.append(title, table);
    groups.appendChild(section);
  }
  sheet.appendChild(groups);

  const actions = document.createElement('div');
  actions.className = 'fc-shortcuts-actions';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn btn--primary';
  done.textContent = t('Done');
  actions.appendChild(done);
  sheet.appendChild(actions);

  const modal = mountModal<void>('', {
    className: 'modal fc-shortcuts-modal',
    ariaLabel: t('Design keyboard shortcuts'),
    onClose: () => {
      opts.onClose?.();
      if (opener?.isConnected) opener.focus();
    },
  });
  modal.el.appendChild(sheet);
  done.addEventListener('click', () => modal.close());
  done.focus();
  return modal;
}
