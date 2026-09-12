// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the accessibility, chrome-follow and render-save preference rows, and the theme picker.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { currentTheme } from '../../theme.ts';
import { setTheme } from '../../lib/set-theme.ts';
import { setA11yPref } from '../../lib/a11y-prefs.ts';
import type { A11yPrefs } from '../../lib/a11y-prefs.ts';
import { setChromeFollow } from '../../lib/chrome-follow.ts';
import { t } from '../../i18n.ts';
import { helpTip } from '../../components/help-tip.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

// Same markup contract as flagRow: the .feature-flag primitives (so there is one
// toggle-row look in this view), the explicit label `for`/id link (without it a
// row click hits the help-tip <button> instead of the switch - the
// "mouse-blocked toggle" bug), and a control that carries `.checked` + emits a
// bubbling `change` in both jelly and CSS-switch modes. The pop takes its own
// width here (the (i) host is a few px wide, and help-tip-pop's default
// `left:0;right:0` would size to it) - see .a11y-pref-info in profile.css.
//
// The scope text is also wired as the switch's accessible DESCRIPTION, which the
// generic linkHelpDescriptions() can't do for a row like this (it looks for a
// control inside the tip's own host, and the host here holds only the button +
// pop). Native control only: a <jelly-switch>'s real checkbox lives in shadow
// DOM, so an aria-describedby on the host would never reach it - the same
// boundary the `label` attribute works around for the accessible name.
export const a11yRow = (pv: ProfileViewCtx, row: { key: keyof A11yPrefs; label: string; info: string }) => {
  const { a11yState } = pv;
  const tip = helpTip(t(row.info));
  const ctlId = `a11y-${row.key}`;
  const on = a11yState[row.key] ? ' checked' : '';
  const control = pv.jellyOn
    ? `<jelly-switch id="${escapeText(ctlId)}" class="feature-flag-jelly" data-a11y="${escapeText(row.key)}" size="sm" label="${escapeText(t(row.label))}"${on}></jelly-switch>`
    : `<input type="checkbox" id="${escapeText(ctlId)}" class="feature-flag-input" data-a11y="${escapeText(row.key)}" aria-describedby="${tip.id}"${on}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
  return `
    <li>
      <label class="feature-flag" for="${escapeText(ctlId)}">
        <span class="feature-flag-label">${escapeText(t(row.label))}<span class="feature-flag-info a11y-pref-info help-tip-host">${tip.button}${tip.pop}</span></span>
        ${control}
      </label>
    </li>`;
};
// A function for the same reason flagListHtml() is one: toggling the Jelly flag
// re-renders these rows in place so their control kind swaps with the rest.
export const a11yListHtml = (pv: ProfileViewCtx): string => { const { A11Y_ROWS } = pv; return A11Y_ROWS.map(pv.prefs.a11yRow).join(''); };
export const followDsRow = (pv: ProfileViewCtx, on: boolean) => {
  const tip = helpTip(t('The app\'s accent takes the primary colour. Tools and exports are not affected.'));
  const ctlId = 'follow-ds';
  const checked = on ? ' checked' : '';
  const label = t('Interface follows the design system');
  const control = pv.jellyOn
    ? `<jelly-switch id="${escapeText(ctlId)}" class="feature-flag-jelly" data-follow-ds size="sm" label="${escapeText(label)}"${checked}></jelly-switch>`
    : `<input type="checkbox" id="${escapeText(ctlId)}" class="feature-flag-input" data-follow-ds aria-describedby="${tip.id}"${checked}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
  return `
    <li>
      <label class="feature-flag" for="${escapeText(ctlId)}">
        <span class="feature-flag-label">${escapeText(label)}<span class="feature-flag-info a11y-pref-info help-tip-host">${tip.button}${tip.pop}</span></span>
        ${control}
      </label>
    </li>`;
};
export const followDsListHtml = (pv: ProfileViewCtx) => followDsRow(pv, pv.followDsState);
// ── Renders auto-save (WP-B) ─────────────────────────────────────────────────
// A single toggle for "keep a copy of every render in my library". Default ON:
// unset means on, so an untouched profile keeps its renders. Same control kinds
// + label wiring as the a11y rows so it swaps with the Jelly flag too.
export const renderSaveRow = (pv: ProfileViewCtx, on: boolean) => {
  const tip = helpTip(t('Every image, audio clip and video you download is also kept in your library under a Renders tag, so you can find it again without re-exporting. Identical files are only kept once, and large videos ask first. Nothing about the file you downloaded changes.'));
  const ctlId = 'save-renders';
  const checked = on ? ' checked' : '';
  const control = pv.jellyOn
    ? `<jelly-switch id="${escapeText(ctlId)}" class="feature-flag-jelly" data-save-renders size="sm" label="${escapeText(t('Save my renders to my library'))}"${checked}></jelly-switch>`
    : `<input type="checkbox" id="${escapeText(ctlId)}" class="feature-flag-input" data-save-renders aria-describedby="${tip.id}"${checked}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
  return `
    <li>
      <label class="feature-flag" for="${escapeText(ctlId)}">
        <span class="feature-flag-label">${escapeText(t('Save my renders to my library'))}<span class="feature-flag-info a11y-pref-info help-tip-host">${tip.button}${tip.pop}</span></span>
        ${control}
      </label>
    </li>`;
};
export const renderSaveListHtml = (pv: ProfileViewCtx) => renderSaveRow(pv, pv.renderSaveState);
/** The four accessibility prefs auto-save on change. */
export function wireA11yRows(pv: ProfileViewCtx): void {
  const { a11yState, host, viewEl } = pv;
  // Accessibility prefs - auto-save each toggle, same shape as the flag listener
  // above (and its own container, so a pref is never written to profile.featureFlags).
  // setA11yPref switches the <html> attribute FIRST and persists after, so the
  // change is visible on the same frame even if the profile write is slow or fails.
  viewEl.querySelector('#a11y-prefs')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-a11y]');
    if (!input) return;
    const key = input.dataset.a11y as keyof A11yPrefs;
    a11yState[key] = input.checked;   // keeps a jelly-flag re-render in step with the live state
    pv.summaries.setSummary('a11y-section', pv.summaries.a11ySummary());
    await setA11yPref(host, key, input.checked);
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });
}

/** The "interface follows the design system" row. */
export function wireAppearanceRows(pv: ProfileViewCtx): void {
  const { host, viewEl } = pv;
  // "Interface follows the design system" - mirror + profile through
  // lib/chrome-follow.ts, then one repaint through the painter that owns the
  // chrome accent. Turning it off removes the injected style; turning it on
  // resolves the primary again, so the accent is right on the same gesture.
  viewEl.querySelector('#appearance-prefs')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-follow-ds]');
    if (!input) return;
    pv.followDsState = input.checked;   // keeps a jelly-flag re-render in step
    await setChromeFollow(host as unknown as Parameters<typeof setChromeFollow>[0], input.checked);
    const { applyChromeBrandVars } = await import('../../brand-vars.ts');
    await applyChromeBrandVars(host as unknown as Parameters<typeof applyChromeBrandVars>[0]);
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });
}

/** The "save my renders" row. */
export function wireRenderSaveRows(pv: ProfileViewCtx): void {
  const { host, viewEl } = pv;
  // Renders auto-save toggle - auto-saves to the profile like the flags above.
  // Stored on profile.saveRenders (default ON = unset), never localStorage.
  viewEl.querySelector('#render-save-prefs')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-save-renders]');
    if (!input) return;
    pv.renderSaveState = input.checked;   // keep a jelly-flag re-render in step
    pv.summaries.setSummary('renders-section', pv.summaries.rendersSummary());
    const current = await host.profile.get();
    await host.profile.set!({ ...current, saveRenders: input.checked });
    pv.liveProfile = { ...current, saveRenders: input.checked };
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });
}

/** The Appearance card's theme preview cards. */
export function wireThemePick(pv: ProfileViewCtx): void {
  const { host, viewEl } = pv;
  // Appearance - theme preview cards (moved here from the dashboard). Each preview
  // applies the theme app-wide immediately (applyTheme mirrors to localStorage +
  // updates the PWA chrome colour) and persists it to the profile (canonical). The
  // active preview is flagged; a soft theme cue plays on switch.
  const themePick = viewEl.querySelector<HTMLElement>('[data-theme-pick]'); pv.themePick = themePick;
  themePick?.addEventListener('click', async e => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-theme-set]');
    if (!btn) return;
    const next = btn.dataset.themeSet;
    if (!next || next === currentTheme()) return;
    // Reflect the new active state across the picker.
    themePick.querySelectorAll<HTMLButtonElement>('[data-theme-set]').forEach(b => {
      const on = b.dataset.themeSet === next;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    await setTheme(host, next);
    pv.summaries.setSummary('appearance-section', pv.summaries.themeLabel(currentTheme()));
  });
}

export function prefsOps(pv: ProfileViewCtx) {
  return {
    a11yRow: bindOp(pv, a11yRow),
    a11yListHtml: bindOp(pv, a11yListHtml),
    followDsRow: bindOp(pv, followDsRow),
    followDsListHtml: bindOp(pv, followDsListHtml),
    renderSaveRow: bindOp(pv, renderSaveRow),
    renderSaveListHtml: bindOp(pv, renderSaveListHtml),
    wireA11yRows: bindOp(pv, wireA11yRows),
    wireAppearanceRows: bindOp(pv, wireAppearanceRows),
    wireRenderSaveRows: bindOp(pv, wireRenderSaveRows),
    wireThemePick: bindOp(pv, wireThemePick),
  };
}
