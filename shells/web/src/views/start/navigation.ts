// SPDX-License-Identifier: MPL-2.0
/**
 * start: navigation.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { mountBackPill } from '../../components/back-pill.ts';
import { mountHomeFab } from '../../components/home-fab.ts';
import { attachLangMenu, langFabHtml } from '../../components/lang-menu.ts';
import { mountProfileFab } from '../../components/profile-menu.ts';
import { mountThemeFab } from '../../components/theme-toggle.ts';
import { t } from '../../i18n.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { START_ROOMS } from '../../lib/design-system/start-route.ts';
import { icon } from '../../lib/icons.ts';
import { escape as escapeText } from '../../utils.ts';
import { IMPORT_FORMATS, ROOM_ICONS } from './shared.ts';
import { bindOp, type StartCtx } from './context.ts';

export const wireBackPill = (start: StartCtx): void => {
  const { viewEl } = start;
  mountBackPill(viewEl);
};
export const wireHomeFab = (start: StartCtx): void => {
  const { host, viewEl } = start;
  mountHomeFab(viewEl);
  // Light/dark/brand beside the escape - the studio is where you're shaping the
  // brand, so flipping the theme to check it in place belongs right here.
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
};
export function renderShell(start: StartCtx): void {
  const { ROOM_LABELS, backPill, homeFab, viewEl } = start;
  viewEl.innerHTML = `
    <div class="start start--studio">
      <div class="start-back-row">${backPill}${homeFab}</div>
      <div class="gallery-topright start-topright">${langFabHtml()}</div>
      <header class="start-head">
        <p class="start-eyebrow">${t('Design system')}</p>
        <h1 class="start-title">${t('Make it yours')}</h1>
        <p class="start-sub">${isTauriShell() ? t('Everything stays on this device. Every tool and export follows it.') : t('Everything stays in this browser. Every tool and export follows the design system.')}</p>
        <!-- Which design system the studio is editing (plans/186 section 5): filled
             async from the registry; the link opens the Profile card that switches. -->
        <p class="start-sub start-ds" data-start-ds hidden></p>
      </header>

      <div class="ds-shell">
        <!-- The rail: independent rooms, in no order. A phone gets the same list
             as a horizontal chip strip pinned under the header. -->
        <aside class="ds-rail">
          <nav class="ds-room-nav" aria-label="${escapeText(t('Design system rooms'))}">
            <ul class="ds-rooms" role="list">
            ${START_ROOMS.map(
              (area) => `
              <li>
                <button type="button" class="ds-room" id="ds-room-${area}" data-ds-room="${area}"${area === start.activeArea ? ' aria-current="page"' : ''}>
                  <span class="ds-room-ic" aria-hidden="true">${icon(ROOM_ICONS[area])}</span>
                  <span class="ds-room-label">${escapeText(ROOM_LABELS[area])}</span>
                </button>
              </li>`
            ).join('')}
            </ul>
          </nav>
          <!-- Foot: whole-system actions. They belong to the studio rather than
               to any one room, and the transient note rides with them. -->
          <div class="ds-rail-actions">
            <!-- Hidden while the studio is empty: the Overview room's own two
                 doors are showing then, and "Start from a file" opens this very
                 modal - three ways into one dialog on one screen (plans/163 F2).
                 It appears with the furnished room, which is where the doors go. -->
            <button type="button" class="be-btn start-import-cta" data-start-import aria-haspopup="dialog" hidden>
              <span class="start-import-cta-ic" aria-hidden="true">↓</span> <span>${t('Add from…')}</span></button>
            <!-- Hidden until a scan actually keeps something: an empty concept is
                 never advertised (plan 97 section 9). The count rides the subscription. -->
            <button type="button" class="be-btn ds-tray-toggle" data-start-tray aria-expanded="false" hidden>
              <span class="ds-tray-toggle-ic" aria-hidden="true">${icon('dock')}</span>
              <span>${t('Tray')}</span>
              <span class="ds-tray-toggle-n" data-start-tray-n></span></button>
            <!-- Both exports wait for a system worth exporting (plans/137 B1,
                 raised by plans/163 F4). An empty studio has nothing to send
                 anywhere, and offering to export it is a button that can only
                 disappoint - and one colour in is still nearly empty, which is
                 why the bar is readOverview's worthExporting rather than its
                 furnished. data-start-furnished is what refreshFurnished()
                 reveals, on the same reading the Overview room decides its own
                 empty state with. -->
            <button type="button" class="be-btn start-export-btn" data-start-export data-start-furnished data-sfx="whoosh" hidden>
              <span aria-hidden="true">↑</span> <span>${t('Export')}</span></button>
            <!-- The pack zip carries fonts, logos and a theme preference; this is
                 the plain document, for a repo or another tool that reads DTCG. -->
            <button type="button" class="be-btn start-export-tokens" data-start-export-tokens data-start-furnished hidden>
              <span aria-hidden="true">↑</span> <span>${t('Tokens (.json)')}</span></button>
            <!-- Get this brand's fonts onto a Linux box as an installable package
                 (plan 197 M5). Shell-side because enumerating the brand's fonts uses
                 host.assets internals a tool hook can't reach; it seals them with
                 host.export.pack and hands over the .rpm. -->
            <button type="button" class="be-btn start-get-on-device" data-start-get-on-device data-start-furnished data-sfx="whoosh" hidden>
              <span aria-hidden="true">${icon('dock')}</span> <span>${t('Fonts for Linux (.rpm)')}</span></button>
            <!-- Versions (plan 97 section 6a). Hidden until something has actually been
                 published, or until a link asks for the panel by name (plans/137
                 B2): the entry used to appear the moment a system EXISTED, which
                 put publishing on the face of a studio one colour old. It carries
                 data-ds-room, so the rail's existing click delegate routes it with
                 no second listener. -->
            <button type="button" class="be-btn ds-versions-toggle" id="ds-room-versions" data-ds-room="versions" hidden>
              <span class="ds-versions-toggle-ic" aria-hidden="true">${icon(ROOM_ICONS.versions)}</span>
              <span>${escapeText(ROOM_LABELS.versions)}</span></button>
            <!-- The way to a FIRST publish, for a furnished system that has never
                 published one: a quiet line under the export actions rather than a
                 fifth peer button, and it stands down the moment the entry above
                 latches on. Its own listener, not data-ds-room: two elements with
                 that attribute would both take aria-current, and the versionsBtn
                 lookup reads the first one in the document. -->
            <button type="button" class="ds-versions-link" data-ds-versions-link hidden>${t('Versions & publishing')}</button>
            <button type="button" class="ds-versions-link" data-start-recovery aria-haspopup="dialog">${t('Restore brand settings')}</button>
            <span class="ds-rail-note" data-start-note aria-live="polite"></span>
          </div>
        </aside>

        <div class="ds-main">
          <section class="ds-panel" id="start-panel-overview" data-ds-panel="overview"
            role="region" aria-labelledby="ds-room-overview" hidden></section>
          <section class="ds-panel" id="start-panel-versions" data-ds-panel="versions"
            role="region" aria-labelledby="ds-room-versions" hidden></section>
          <div class="start-editor-wrap">
            <div class="start-editor-mount" data-start-editor><p class="start-editor-loading">${t('Loading the design system…')}</p></div>
          </div>
        </div>
      </div>

      <!-- The import card lives here at rest, inside a hidden holder, and is MOVED
           into the modal when "Add from…" is clicked (and back on close) - so the
           file input, the drop target and every delegated listener below are wired
           once against nodes that outlive any one dialog. -->
      <div class="start-import-home" data-start-import-home hidden>
      <div class="start-import-panel" data-start-import-panel>
        <!-- The whole card is the control: click anywhere (it's the file input's
             label) or drop a file on it. The format tiles lead so people
             recognise THEIR export at a glance, in preference order. -->
        <label class="start-import-drop" data-start-import-drop>
          <input type="file" class="start-import-file visually-hidden" accept=".json,application/json,.penpot,.svg,image/svg+xml,.zip,application/zip,.lolly" aria-label="${escapeText(t('Choose a design or brand file'))}">
          <span class="start-import-formats" role="list" aria-label="${escapeText(t('Accepted formats, in preference order'))}">
            ${IMPORT_FORMATS.map(
              (f) => `
              <span class="start-import-fmt" role="listitem">
                <span class="start-import-fmt-icon" aria-hidden="true">${f.icon}</span>
                <span class="start-import-fmt-name">${escapeText(t(f.name))}</span>
                <span class="start-import-fmt-ext">${escapeText(f.ext)}</span>
              </span>`
            ).join('')}
          </span>
          <span class="be-btn start-import-btn" aria-hidden="true">${t('Choose a design or brand file…')}</span>
          <span class="start-import-drophint">${t('or drag & drop it here')}</span>
        </label>
        <!-- tabindex="-1": the result is a status message with controls in it, so
             it takes focus when it appears rather than being announced whole. -->
        <div class="start-import-result" tabindex="-1" hidden></div>
      </div>
      </div>
    </div>`;
}

export function wireChrome(start: StartCtx): void {
  const { host, viewEl } = start;
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);
  start.navigation.wireBackPill();
  start.navigation.wireHomeFab();
}

export function navigationOps(start: StartCtx) {
  return {
    wireBackPill: bindOp(start, wireBackPill),
    wireHomeFab: bindOp(start, wireHomeFab),
    renderShell: bindOp(start, renderShell),
    wireChrome: bindOp(start, wireChrome),
  };
}
