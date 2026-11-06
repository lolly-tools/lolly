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
import { helpTip } from '../../components/help-tip.ts';
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
  // Where the design system is kept, one tap away beside its name rather than a
  // line repeated over every room (plan 336 P1). helpTip escapes the text.
  const kept = helpTip(isTauriShell() ? t('Your design system stays on this device.') : t('Your design system stays in this browser.'));
  viewEl.innerHTML = `
    <div class="start start--studio">
      <div class="gallery-topright start-topright">${langFabHtml()}</div>
      <!-- The studio's one bar (plan 336 P1): the way out, the system's name, and
           the actions that work on the whole system. The rooms follow it as one
           strip on a desk and as a bar at the bottom edge on a phone (P2). -->
      <div class="ds-top">
        <header class="ds-bar">
          <div class="ds-bar-exit">${backPill}${homeFab}</div>
          <div class="ds-bar-id help-tip-host">
            <!-- The page's one heading. On screen it is the small label before
                 the name; the name itself is a field, so brand.ts copies it
                 into the heading for a screen reader as well. -->
            <h1 class="ds-bar-kicker">${t('Design system')}<span class="ds-bar-heading-name visually-hidden" data-start-ds-heading></span></h1>
            <!-- Which design system the studio is editing (plans/186 section 5),
                 filled async from the registry as an inline editable name. -->
            <span class="ds-bar-name" data-start-ds hidden></span>
            ${kept.button}${kept.pop}
          </div>
          <div class="ds-bar-acts">
            <!-- Hidden until a scan actually keeps something: an empty concept is
                 never advertised (plan 97 section 9). The count rides the subscription. -->
            <button type="button" class="be-btn ds-bar-btn ds-tray-toggle" data-start-tray aria-expanded="false" hidden>
              <span class="ds-bar-btn-ic" aria-hidden="true">${icon('dock')}</span>
              <span class="ds-bar-btn-label">${t('Tray')}</span>
              <span class="ds-tray-toggle-n" data-start-tray-n></span></button>
            <!-- The filled action while the system is not the person's yet (plan
                 346, change 1): a small menu of the first moves. bar.ts shows it
                 and hands Export the outline; once the system is theirs it steps
                 aside and Export takes the fill back. -->
            <button type="button" class="be-cta ds-bar-btn ds-bar-make" data-start-make aria-haspopup="menu" aria-expanded="false" hidden>
              <span class="ds-bar-btn-ic" aria-hidden="true">${icon('heart')}</span>
              <span class="ds-bar-btn-label">${t('Make it yours')}</span>
              <span class="ds-bar-btn-caret" aria-hidden="true">${icon('chevronDown')}</span></button>
            <!-- Hidden while the studio is empty: the Board's own doors are showing
                 then, and "Start from a reference" opens this very modal (plans/163
                 F2). Hidden too while "Make it yours" holds that action. On a phone it moves
                 into the More menu. -->
            <button type="button" class="be-btn ds-bar-btn ds-bar-add" data-start-import aria-haspopup="dialog" hidden>
              <span class="ds-bar-btn-label">${t('Add from…')}</span></button>
            <!-- Waits for a system worth exporting (plans/137 B1, plans/163 F4): one
                 colour in is still nearly empty. data-start-furnished is what
                 refreshFurnished() reveals. -->
            <button type="button" class="be-cta ds-bar-btn start-export-btn" data-start-export data-start-furnished data-sfx="whoosh" hidden>
              <span class="ds-bar-btn-ic" aria-hidden="true">${icon('download')}</span>
              <span class="ds-bar-btn-label">${t('Export')}</span></button>
            <button type="button" class="ds-bar-more" data-ds-more aria-haspopup="menu" aria-expanded="false"
              aria-label="${escapeText(t('More actions'))}" title="${escapeText(t('More actions'))}">${icon('menuDots')}</button>
          </div>
          <!-- The quieter whole-system actions. Never shown in place: the More menu
               lists the ones that are not hidden and presses them, so each keeps
               the listener and the hidden-until-it-applies rule it always had. -->
          <div class="ds-bar-overflow" data-ds-overflow hidden>
            <!-- The plain document, for a repo or another tool that reads DTCG. -->
            <button type="button" data-start-export-tokens data-start-furnished hidden>${t('Tokens (.json)')}</button>
            <!-- This system's fonts as an installable Linux package (plan 197 M5). -->
            <button type="button" data-start-get-on-device data-start-furnished data-sfx="whoosh" hidden>${t('Fonts for Linux (.rpm)')}</button>
            <!-- The way to a FIRST publish, for a furnished system that has never
                 published one; it stands down once the Versions room joins the
                 strip. Its own listener, not data-ds-room. -->
            <button type="button" class="ds-versions-link" data-ds-versions-link hidden>${t('Versions & publishing')}</button>
            <!-- Hidden until the studio holds something of its own to restore. -->
            <button type="button" class="ds-versions-link" data-start-recovery aria-haspopup="dialog" hidden>${t('Restore brand settings')}</button>
            <!-- Switching lives with the list of systems in Settings. -->
            <a href="#/profile?focus=design-systems-section" data-ds-switch>${t('Design systems')}</a>
          </div>
        </header>
        <!-- Shown only on a copy that goes back to an instance, while it still may. -->
        <p class="ds-instance-line" data-ds-instance-line role="note" hidden></p>
        <!-- The rooms: independent areas in no order, so nothing is numbered and
             nothing gates on anything else. Versions joins once offered. -->
        <nav class="ds-room-nav" aria-label="${escapeText(t('Design system rooms'))}">
          <ul class="ds-rooms" role="list">
          ${[...START_ROOMS, 'versions' as const].map(
            (area) => `
            <li>
              <button type="button" class="ds-room" id="ds-room-${area}" data-ds-room="${area}"${area === start.activeArea ? ' aria-current="page"' : ''}${area === 'versions' ? ' hidden' : ''}>
                <span class="ds-room-ic" aria-hidden="true">${icon(ROOM_ICONS[area])}</span>
                <span class="ds-room-label">${escapeText(ROOM_LABELS[area])}</span>
              </button>
            </li>`
          ).join('')}
          </ul>
        </nav>
        <p class="ds-bar-note" data-start-note aria-live="polite"></p>
      </div>
      <div class="ds-ask-slot" data-start-ds-ask-slot></div>

      <div class="ds-shell">
        <div class="ds-main">
          <section class="ds-panel" id="start-panel-overview" data-ds-panel="overview"
            role="region" aria-labelledby="ds-room-overview" hidden></section>
          <!-- The Board's live column: the In context specimen, beside the Board
               on a desk, under it on a phone and in the other pane in two panes
               (plan 346, changes 3, 15 and 16). The Board's room paints the column. -->
          <section class="ds-panel ds-live" id="start-panel-live" data-ds-panel="live"
            role="region" aria-labelledby="ds-live-title" hidden></section>
          <section class="ds-panel" id="start-panel-versions" data-ds-panel="versions"
            role="region" aria-labelledby="ds-room-versions" hidden></section>
          <section class="ds-panel" id="start-panel-usage" data-ds-panel="usage"
            role="region" aria-labelledby="ds-room-usage" hidden></section>
          <section class="ds-panel" id="start-panel-skills" data-ds-panel="skills"
            role="region" aria-labelledby="ds-room-skills" hidden></section>
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
          <input type="file" class="start-import-file visually-hidden" accept=".json,application/json,.penpot,.svg,image/svg+xml,.zip,application/zip,.lolly,.md,.markdown,text/markdown" aria-label="${escapeText(t('Choose a design or brand file'))}">
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
        <!-- A brand page is a folder. A file input cannot take one and a file at once. -->
        <label class="be-btn start-import-folder">
          <input type="file" class="visually-hidden" data-start-import-folder webkitdirectory multiple aria-label="${escapeText(t('Choose a brand page folder'))}">
          <span>${t('Choose a brand page folder')}</span>
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
