// SPDX-License-Identifier: MPL-2.0
import { navigateTo } from '../nav.ts';
import '../styles/parts/settings.css';
import { t } from '../i18n.ts';
import { escape as escapeText } from '../utils.ts';
import { DASH_SECTIONS } from '../lib/dashboard-registry.ts';

const sections = [
  { tab: 'preferences', label: 'Preferences' },
  ...DASH_SECTIONS.filter(section => !section.flag && section.tab),
];

/** Shared page identity and navigation for every part of Settings. */
export function settingsNavHtml(active: string): string {
  return `<header class="settings-header">
    <h1 class="settings-title">${t('Settings')}</h1>
    <nav class="settings-nav" aria-label="${escapeText(t('Settings sections'))}">
      ${sections.map(section => `<a id="settings-tab-${section.tab}" class="settings-nav-link" data-sfx="click" data-settings-tab="${section.tab}" href="${section.tab === 'preferences' ? '#/settings' : `#/settings?tab=${section.tab}`}"${section.tab === active ? ' aria-current="page"' : ''}>${escapeText(t(section.label))}</a>`).join('')}
    </nav>
  </header>`;
}

/** Settings tabs create navigation entries so Back returns to the previous tab. */
export function wireSettingsNav(view: HTMLElement): void {
  view.querySelector('.settings-nav')?.addEventListener('click', (event) => {
    const e = event as MouseEvent;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element).closest<HTMLAnchorElement>('.settings-nav-link');
    if (!link) return;
    e.preventDefault();
    if (link.hasAttribute('aria-current')) return;
    navigateTo(link.href);
  });
}
