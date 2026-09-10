// SPDX-License-Identifier: MPL-2.0
/**
 * #/prepare - review private text, credentials and hidden data before a copy leaves
 * the device. A utility view like Convert: the full escape chrome (back pill, home,
 * the top-right cluster), a page header, and the shared preparation panel, whose
 * inspection column docks into the app's one right edge column here on desktop.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountPreparationPanel } from '../components/prepare/panel.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { t } from '../i18n.ts';
import '../styles/parts/platform.css';   // .plat-header / .plat-title / .plat-sub

export function mountPrepare(view: HTMLElement & { _cleanup?: () => void }, host: HostV1): void {
  document.title = `${t('Prepare for sharing')} - Lolly`;
  view.classList.add('prepare-view');
  view.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="prepare-page">
      <header class="plat-header">
        <span class="section-header-eyebrow">${t('On this device')}</span>
        <h1 class="plat-title">${t('Prepare for sharing')}</h1>
        <p class="plat-sub">${t('Find private text, credentials and hidden data in a copy before it leaves your hands. Suggestions are yours to accept, and nothing is uploaded.')}</p>
      </header>
      <div data-prepare-root></div>
    </div>`;
  mountBackPill(view);
  mountHomeFab(view);
  mountThemeFab(view.querySelector('.gallery-topright'), host);
  mountProfileFab(view.querySelector('.gallery-topright'), host);
  const detachLang = attachLangMenu(view.querySelector<HTMLElement>('.lang-fab'), host);
  const dispose = mountPreparationPanel(view.querySelector<HTMLElement>('[data-prepare-root]')!, host, [], { dock: true });
  view._cleanup = () => { dispose(); detachLang(); };
}
