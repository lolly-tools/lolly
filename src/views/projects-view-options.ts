// SPDX-License-Identifier: MPL-2.0
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import { themeSegmentHtml, wireThemeSegment } from '../components/theme-toggle.ts';
import { soundSegmentHtml, wireSoundSegment } from '../components/sound-toggle.ts';
import { t } from '../i18n.ts';

export type ProjectsViewMode = 'preview' | 'list';
export type ProjectsSort = 'name' | 'added' | 'modified' | 'size' | 'tool';
type ThemeHost = Parameters<typeof wireThemeSegment>[1];
type SoundHost = Parameters<typeof wireSoundSegment>[1];

/** A settings dialog: its theme/sound segments and view/sort buttons use Tab,
 * not menu arrow-key semantics. The shared popover owns focus and dismissal. */
export function mountProjectsViewOptions(anchor: HTMLElement, host: ThemeHost & SoundHost, options: {
  view: ProjectsViewMode;
  sort: ProjectsSort;
  atRoot: boolean;
  onView(value: ProjectsViewMode): void;
  onSort(value: ProjectsSort): void;
}): BodyPopoverHandle {
  return mountBodyPopover(anchor, (el, popover) => {
    const option = (on: boolean, attr: string, value: string, label: string): string =>
      `<button type="button" class="folder-menu-item${on ? ' is-on' : ''}" aria-pressed="${on}" data-${attr}="${value}">${on ? '✓ ' : ''}${label}</button>`;
    el.innerHTML = `${themeSegmentHtml('folder-menu-head')}
      <p class="folder-menu-head">${t('View')}</p>
      ${option(options.view === 'preview', 'vm', 'preview', t('Preview'))}
      ${option(options.view === 'list', 'vm', 'list', t('List'))}
      <p class="folder-menu-head">${t('Sort')}</p>
      ${option(options.sort === 'name', 'sort', 'name', t('Name'))}
      ${option(options.sort === 'added', 'sort', 'added', t('Date added'))}
      ${option(options.sort === 'modified', 'sort', 'modified', t('Last modified'))}
      ${option(options.sort === 'size', 'sort', 'size', t('Size'))}
      ${options.atRoot ? '' : option(options.sort === 'tool', 'sort', 'tool', t('By tool'))}
      ${soundSegmentHtml('folder-menu-head')}`;
    wireThemeSegment(el, host);
    wireSoundSegment(el, host);
    el.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-vm], [data-sort]');
      if (!button) return;
      popover.close();
      if (button.dataset.vm) options.onView(button.dataset.vm as ProjectsViewMode);
      else options.onSort(button.dataset.sort as ProjectsSort);
    });
    return el.querySelector<HTMLElement>('[data-vm][aria-pressed="true"]');
  }, { className: 'folder-menu projects-viewmenu', role: 'dialog', ariaLabel: t('View and sort options'), trackScroll: true });
}
