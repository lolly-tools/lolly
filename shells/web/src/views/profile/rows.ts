// SPDX-License-Identifier: MPL-2.0
/**
 * profile: which sections start open, the details field controls, the save button and the feature-flag rows.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { helpTip } from '../../components/help-tip.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { CATEGORY_FLAGS, CONNECTOR_FLAGS, JELLY_FLAG, NEUROSPICY_FLAG, PERFORMANCE_UI_FLAG, PERF_HUD_FLAG, PREFLIGHT_FLAG, PRIVATE_COLLAB_FLAG, STRIP_UPLOAD_META_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, applyPerfUi, flagHidden, isFlagOn, setFlagMirror } from '../../feature-flags.ts';
import type { FeatureFlag } from '../../feature-flags.ts';
import { mountPerfHud, unmountPerfHud } from '../../lib/perf-hud.ts';
import { ensureJelly } from '../../lib/jelly.ts';
import { stopNeurospicy } from '../../lib/neurospicy.ts';
import { stopAtmosphere } from '../../lib/atmosphere.ts';
import { syncNeuroDock } from '../../components/neuro-dock.ts';
import { getFieldPolicy } from '../../lib/field-policy.ts';
import { FIELD_LABELS, NAV_SECTIONS, fieldAttrs } from './shared.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

export const startOpen = (pv: ProfileViewCtx, id: string) => { const { focusSectionId } = pv; return (pv.openState[id] || focusSectionId === id ? ' open' : ''); };
// One toggle row for a feature flag (closes over `profile` for its checked state). Honours
// a flag's `default` (opt-in flags start off) and shows an (i) explainer when it has `info`.
// The explainer is the shared help-tip button too (component audit rec 13) - kept on
// `.feature-flag-info` as its positioning host (it already carries the right
// position:relative/margin) with `help-tip-host` added alongside so the shared
// hover/focus-reveal CSS (tool.css) recognises it. The pop's placement is a real,
// deliberate delta worth keeping: this row sits at the *bottom* of a long list, so
// it opens upward/centred (inline style override) rather than help-tip-pop's default
// "drop below, span the host" - which here would spill past the list, off-screen.
export const flagRow = (pv: ProfileViewCtx, f: FeatureFlag) => {
  // A control plane can hide a flag's toggle (a staged surprise, or a policy the
  // deployment owns): drop the row entirely - the resolved default still applies,
  // the user just never sees a switch. Dormant / shown ⇒ rendered as ever.
  if (flagHidden(f.id)) return '';
  const info = f.info ? helpTip(t(f.info)) : null;
  const infoPop = info ? info.pop.replace(
    'class="help-tip-pop"',
    'class="help-tip-pop" style="left:50%;right:auto;top:auto;bottom:calc(100% + .4rem);transform:translateX(-50%);width:max-content;max-width:16rem"',
  ) : '';
  // Jelly mode swaps the CSS switch for a <jelly-switch> (vendored web
  // component, lib/jelly.ts). Its hidden native checkbox lives in shadow DOM,
  // so the visible row label can't name it - the `label` attribute carries the
  // accessible name instead. It reflects `.checked` and re-dispatches a
  // bubbling `change` on the host, so the generic [data-flag] save listener
  // below works identically for both control kinds.
  //
  // The label→control link is EXPLICIT (`for`/id): with no `for`, a label
  // activates its FIRST labelable descendant - and on rows with an (i)
  // explainer that's the help-tip <button>, not the switch, so row clicks
  // opened the tip instead of toggling (the "mouse-blocked toggle" bug).
  const ctlId = `ff-${f.id}`;
  const control = pv.jellyOn
    ? `<jelly-switch id="${escapeText(ctlId)}" class="feature-flag-jelly" data-flag="${escapeText(f.id)}" size="sm" label="${escapeText(t(f.label))}" ${isFlagOn(pv.liveProfile, f) ? 'checked' : ''}></jelly-switch>`
    : `<input type="checkbox" id="${escapeText(ctlId)}" class="feature-flag-input" data-flag="${escapeText(f.id)}" ${isFlagOn(pv.liveProfile, f) ? 'checked' : ''}>
        <span class="feature-flag-switch" aria-hidden="true"></span>`;
  return `
    <li>
      <label class="feature-flag" for="${escapeText(ctlId)}">
        <span class="feature-flag-label">${escapeText(t(f.label))}${f.pill ? `<span class="feature-flag-pill">${escapeText(t(f.pill))}</span>` : ''}${
          info ? `<span class="feature-flag-info help-tip-host">${info.button}${infoPop}</span>` : ''
        }</span>
        ${control}
      </label>
    </li>`;
};
// One identity-form control - <jelly-input> in jelly mode (form-associated:
// its ElementInternals.setFormValue keeps it in the form's FormData under the
// host's `name`, so the submit handler below reads both kinds identically).
// The visible .profile-field-label span stays either way; `label` doubles it
// onto the shadow input's aria-label so the accessible name survives the
// shadow boundary. Takes the value as an argument so the jelly-flag toggle
// can rebuild a control in place without dropping unsaved edits.
export const fieldControl = (pv: ProfileViewCtx, f: string, value: string) => {
  // A locked field (control-plane policy, via lib/field-policy.ts) renders
  // read-only. Dormant default: no policy ⇒ no attribute ⇒ unchanged.
  const ro = getFieldPolicy(f)?.mode === 'locked' ? ' readonly' : '';
  return pv.jellyOn
    ? `<jelly-input ${fieldAttrs(f)}${ro} name="${f}" size="sm" label="${escapeText(t(FIELD_LABELS[f] ?? f))}" value="${escapeText(value)}"></jelly-input>`
    : `<input ${fieldAttrs(f)}${ro} name="${f}" value="${escapeText(value)}" placeholder=" ">`;
};
// The Save button - <jelly-button type="submit"> drives the closest light-DOM
// form via requestSubmit(), so the same submit listener fires. It must NOT
// carry .profile-btn-primary (those border/fill styles would paint a second
// box behind the jelly canvas).
export const saveButtonHtml = (pv: ProfileViewCtx) => pv.jellyOn
  ? `<jelly-button type="submit" class="profile-btn-jelly">${t('Save Profile')}</jelly-button>`
  : `<button type="submit" class="profile-btn-primary">${t('Save Profile')}</button>`;
// The Feature-flags card's <ul> contents - a function so the jelly-flag toggle
// can re-render the list in place (its switches change kind on the spot).
export const flagListHtml = (pv: ProfileViewCtx): string => { const { jellyHidden } = pv; return `
            ${CATEGORY_FLAGS.map(f =>
              // Set the on-device Offline Utilities drawer apart from the creative
              // tool categories above it with its own separator.
              (f.category === 'utility' ? '<li class="feature-flag-divider" aria-hidden="true"></li>' : '') + flagRow(pv, f)
            ).join('')}
            <li class="feature-flag-divider" aria-hidden="true"></li>
            ${/* Neurospicy is NOT listed here any more: it is a first-class
                accommodation (Andy, plans/142 A11y-2) controlled from the
                Accessibility card's Sound row. The flag object survives for
                instance governance only. */''}
            ${jellyHidden ? '' : flagRow(pv, JELLY_FLAG)}
            ${flagRow(pv, WOBBLY_FLAG)}
            ${flagRow(pv, WOBBLY_MESH_FLAG)}
            ${flagRow(pv, PERFORMANCE_UI_FLAG)}
            ${flagRow(pv, PERF_HUD_FLAG)}
            ${flagRow(pv, STRIP_UPLOAD_META_FLAG)}
            ${flagRow(pv, PREFLIGHT_FLAG)}
            ${flagRow(pv, PRIVATE_COLLAB_FLAG)}
            <li class="feature-flag-divider" aria-hidden="true"></li>
            <li class="feature-flag-group">${t('Connectors')}<span class="feature-flag-group-note">${t('Where this device may send finished exports. Turning one off withdraws it from every send and share surface, and hides its row in Connected services.')}</span></li>
            ${CONNECTOR_FLAGS.map(pv.rows.flagRow).join('')}`; };
/** Feature-flag toggles: auto-save each flip and apply the ones with live effects. */
export function wireFlagRows(pv: ProfileViewCtx): void {
  const { fields, host, viewEl } = pv;
  // Feature flags - auto-save each toggle (a preference, like the theme picker).
  // `[data-flag]` is either the native checkbox or a <jelly-switch> host; both
  // carry `.checked` and emit a bubbling `change`, so one handler covers both.
  viewEl.querySelector('#feature-flags')?.addEventListener('change', async e => {
    const input = (e.target as Element).closest<HTMLInputElement>('[data-flag]');
    if (!input) return;
    const current = await host.profile.get();
    const flagId = input.dataset.flag!;
    const featureFlags = { ...(current.featureFlags ?? {}), [flagId]: input.checked };
    await host.profile.set!({ ...current, featureFlags });
    pv.liveProfile = { ...current, featureFlags };
    // Keep the synchronous mirror in step so the Neurospicy player (rendered in
    // popovers, outside the profile-aware views) reflects the change on next render.
    setFlagMirror(flagId, input.checked);
    pv.summaries.setSummary('feature-flags-section', pv.summaries.flagsSummary());
    // Performance UI applies on the spot: reflect it onto <html> so the gated stylesheet
    // switches immediately - no reload, and off restores the full chrome byte-for-byte.
    if (flagId === PERFORMANCE_UI_FLAG.id) applyPerfUi(input.checked);
    // Performance HUD mounts/unmounts on the spot (the mirror above is already set, so
    // mountPerfHud's own perfHudOn() gate passes when turning on). Off removes the element
    // and stops its rAF loop, leaving no residue.
    if (flagId === PERF_HUD_FLAG.id) { if (input.checked) mountPerfHud(); else unmountPerfHud(); }
    // A connector kill switch changes what Connected services may offer, so re-mount
    // that card's two bodies in place (only if they are already mounted - a closed
    // card will read the flag when it first opens). Every SEND surface reads
    // connectorEnabled() at call time, so nothing else needs telling.
    if (flagId.startsWith('conn-') && pv.connectionsLoaded) {
      pv.connectionsLoaded = false;
      pv.syncLoaded = false;
      pv.connections.loadConnectionsCard();
    }
    // Toggling the Neurospicy feature: silence any loop when turning it off (the UI is
    // gone, so leave no invisible audio), and show/hide the bottom-right dock to match.
    if (flagId === NEUROSPICY_FLAG.id) {
      // Atmosphere lives in the same player, so it goes quiet on the same terms - 
      // its controls disappear with the dock and audio must not outlive them.
      if (!input.checked) { stopNeurospicy(); stopAtmosphere(); }
      syncNeuroDock(host as unknown as Parameters<typeof syncNeuroDock>[0]);
    }
    // Toggling Jelly effects applies on the spot: load the bundle if needed, then
    // re-render the list so every row swaps between the CSS switch and
    // <jelly-switch>. Focus returns to the toggled control (innerHTML drops it).
    if (flagId === JELLY_FLAG.id) {
      pv.jellyOn = await ensureJelly(input.checked);
      const list = viewEl.querySelector('#feature-flags');
      if (list) {
        list.innerHTML = pv.rows.flagListHtml();
        list.querySelector<HTMLElement>(`[data-flag="${flagId}"]`)?.focus();
      }
      // The Accessibility card's rows use the same two control kinds, so they swap
      // with the flag rows - otherwise the page would show both looks at once.
      // Rebuilt from a11yState (not the DOM), which the pref listener keeps current.
      const a11yList = viewEl.querySelector('#a11y-prefs');
      if (a11yList) a11yList.innerHTML = pv.prefs.a11yListHtml();
      const renderSaveList = viewEl.querySelector('#render-save-prefs');
      if (renderSaveList) renderSaveList.innerHTML = pv.prefs.renderSaveListHtml();
      // The Appearance card's one toggle row swaps its control kind with them.
      const followDsList = viewEl.querySelector('#appearance-prefs');
      if (followDsList) followDsList.innerHTML = pv.prefs.followDsListHtml();
      // The identity form swaps its controls in place too, carrying any unsaved
      // edits across (both control kinds expose `.value` on the [name] element).
      const form = viewEl.querySelector('#profile-form');
      if (form) {
        for (const f of fields) {
          const ctl = form.querySelector<HTMLElement & { value?: string }>(`[name="${f}"]`);
          if (ctl) ctl.outerHTML = pv.rows.fieldControl(f, String(ctl.value ?? ''));
        }
        const save = form.querySelector('button[type="submit"], jelly-button[type="submit"]');
        if (save) save.outerHTML = pv.rows.saveButtonHtml();
      }
    }
    announce(input.checked ? t('Enabled') : t('Disabled'));
  });
}

/** Persist each section's open state across visits. */
export function wireOpenState(pv: ProfileViewCtx): void {
  const { OPEN_KEY, viewEl } = pv;
  // Persist each section's open/closed state across visits. Every card in
  // NAV_SECTIONS is a <details> now, so the registry is the list (it was a
  // hand-kept copy of the five collapsibles).
  for (const { id } of NAV_SECTIONS) {
    const d = viewEl.querySelector<HTMLDetailsElement>('#' + id);
    d?.addEventListener('toggle', () => {
      pv.openState[id] = d!.open;
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(pv.openState)); } catch { /* storage blocked */ }
    });
  }
}

export function rowsOps(pv: ProfileViewCtx) {
  return {
    startOpen: bindOp(pv, startOpen),
    flagRow: bindOp(pv, flagRow),
    fieldControl: bindOp(pv, fieldControl),
    saveButtonHtml: bindOp(pv, saveButtonHtml),
    flagListHtml: bindOp(pv, flagListHtml),
    wireFlagRows: bindOp(pv, wireFlagRows),
    wireOpenState: bindOp(pv, wireOpenState),
  };
}
