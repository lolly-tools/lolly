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
  const themePick = viewEl.querySelector<HTMLElement>('[data-theme-pick]');
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

/**
 * The Emoji card (plans/252) - the set new work starts from.
 *
 * The shared control in `preference` mode: a set and a treatment, no colours. It
 * is a SEED and the copy says so; a document or a saved session that already
 * names a set keeps it, so turning this on never redraws work already made.
 * Mounted lazily because the control carries its own stylesheet chunk, which the
 * profile page has no reason to pay for until this card exists.
 */
export async function wireEmojiPref(pv: ProfileViewCtx): Promise<void> {
  const { host, viewEl } = pv;
  const section = viewEl.querySelector<HTMLElement>('#emoji-pref-section');
  const body = viewEl.querySelector<HTMLElement>('#emoji-pref-body');
  if (!body) return;
  const [{ mountEmojiStyleControl }, { currentEmojiPreference, setEmojiPreference }] = await Promise.all([
    import('../../components/emoji-style-control.ts'),
    import('../../lib/emoji-prefs.ts'),
  ]);
  const prefsHost = host as unknown as Parameters<typeof setEmojiPreference>[0];
  const saved = await currentEmojiPreference(prefsHost);
  // The listing is read ONCE, here, and handed to the control: it decides whether
  // this card exists at all, and it is what turns a stored pin into the set's own
  // name in the collapsed summary. A device with no packs gets no card rather than
  // an empty dropdown, the same answer the tool sidebar gives.
  const sets = host.emoji ? await host.emoji.sets().catch(() => []) : [];
  if (!viewEl.isConnected) return;
  if (!sets.length) {
    if (section) section.hidden = true;
    return;
  }
  const summarise = (value: unknown): void => {
    const id = (value as { pin?: { id?: string } } | null)?.pin?.id;
    const known = id ? sets.find((set) => set.pin.id === id) : undefined;
    // The set's own name, the way every other summary on this page is human copy.
    // A pin this device no longer holds falls back to the slug, because that is
    // the only honest thing left to say about it.
    const label = known?.label ?? (id ? id.split('/').slice(-2).join('/') : '');
    pv.summaries.setSummary('emoji-pref-section', label || t('No set chosen'));
  };
  body.textContent = '';
  mountEmojiStyleControl(body, {
    host,
    mode: 'preference',
    value: saved,
    sets,
    onChange: (next) => {
      summarise(next);
      // A preference is never a document, so nothing here is applied to anything
      // on screen. It is saved, and the next new piece of work reads it.
      void setEmojiPreference(prefsHost, next && 'pin' in next ? next : null);
      announce(next ? t('Saved') : t('Cleared'));
    },
  });
  summarise(saved);
}

/**
 * The Trusted sites card (plan 288): every entry in force with where it came from, a
 * remove button on the person's own and the brand's, the organisation's blocks, and an
 * add field. Built with DOM calls and repainted whenever the list changes (an "Always
 * trust" in Design, an organisation's new rule), so it never shows a stale list.
 */
export async function wireTrustedSites(pv: ProfileViewCtx): Promise<void> {
  const { viewEl } = pv;
  const body = viewEl.querySelector<HTMLElement>('#trusted-sites-body');
  if (!body) return;
  const [sites, policy, grammar, anySite] = await Promise.all([
    import('../../lib/trusted-sites.ts'),
    import('../../lib/site-policy.ts'),
    import('../../../../../engine/src/trusted-sites.ts'),
    import('../../lib/any-site.ts'),
  ]);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const sourceWord = (source: string): string => {
    const by = policy.sitePolicy()?.by;
    if (source === 'organisation') return by ?? t('Your organisation');
    return source === 'brand' ? t('Brand') : source === 'default' ? t('Lolly default') : t('You');
  };
  let draft = '';
  const paint = (): void => {
    if (!body.isConnected) return;
    const rows = sites.trustedSiteRows();
    const blocked = sites.blockedSiteRows();
    const current = sitePolicyMode();
    pv.summaries.setSummary('trusted-sites-section', rows.length ? t('{n} sites', { n: rows.length }) : t('None'));
    body.replaceChildren();
    if (current === 'none') body.append(el('p', 'profile-hint', t('Your organisation allows no outside sites. Sandbox demos and Lolly tools still run, because they come from this app.')));
    else if (current === 'allowlist-only') body.append(el('p', 'profile-hint', t('Your organisation manages this list. Only the sites below can be contacted.')));
    const list = el('ul', 'trusted-sites-list');
    for (const row of rows) {
      const li = el('li', 'trusted-sites-row');
      const text = el('span', 'trusted-sites-entry', row.entry);
      const badge = el('span', 'trusted-sites-badge', sourceWord(row.source));
      li.append(text, badge);
      if (row.reason) li.append(el('span', 'trusted-sites-reason', row.reason));
      if (!row.locked) {
        const remove = el('button', 'btn btn--sm trusted-sites-remove', t('Remove'));
        remove.type = 'button';
        remove.setAttribute('aria-label', t('Remove {site}', { site: row.entry }));
        remove.addEventListener('click', () => { void sites.untrustSite(row.entry).then(() => announce(t('Removed {site}', { site: row.entry }))); });
        li.append(remove);
      }
      list.append(li);
    }
    if (rows.length) body.append(list);
    else body.append(el('p', 'profile-hint', t('No sites yet. Lolly asks before contacting a site.')));
    if (blocked.length) {
      body.append(el('h3', 'trusted-sites-subhead', t('Blocked by {org}', { org: sourceWord('organisation') })));
      const bl = el('ul', 'trusted-sites-list');
      for (const rule of blocked) {
        const li = el('li', 'trusted-sites-row');
        li.append(el('span', 'trusted-sites-entry', rule.entry));
        if (rule.reason) li.append(el('span', 'trusted-sites-reason', rule.reason));
        bl.append(li);
      }
      body.append(bl);
    }
    if (!sites.canTrustMore()) { paintAnySite(); return; }
    const form = el('form', 'trusted-sites-add');
    const label = el('label', 'field-row');
    const input = el('input', 'field-input');
    input.type = 'text';
    input.id = 'trusted-sites-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'example.com';
    input.value = draft;
    input.addEventListener('input', () => { draft = input.value; err.hidden = true; });
    label.append(el('span', '', t('Add a site')), input);
    const add = el('button', 'btn', t('Trust'));
    add.type = 'submit';
    const hint = el('p', 'profile-hint trusted-sites-grammar', t('A host (example.com), a host and its subdomains (*.example.com), or one part of a site (https://example.com/docs/).'));
    const err = el('p', 'be-err', t('That is not a site Lolly can trust. Use one of the three forms above, on https.'));
    err.hidden = true;
    err.setAttribute('role', 'alert');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const entry = grammar.normaliseTrustedSite(input.value);
      if (!entry) { err.hidden = false; input.focus(); return; }
      draft = '';
      void sites.trustSite(entry).then((saved) => {
        if (saved) announce(t('Trusted {site}', { site: saved }));
        document.getElementById('trusted-sites-input')?.focus();
      });
    });
    form.append(label, add);
    body.append(form, hint, err);
    paintAnySite();
  };
  const sitePolicyMode = (): string | undefined => policy.sitePolicy()?.mode;
  /** "Allow pages from any site" (lib/any-site.ts), on the web version only. Turning the
   *  switch on asks the server first, so a deployment without the wider /any-site/
   *  policy says so instead of reloading into one it does not have. */
  const paintAnySite = (): void => {
    if (!anySite.anySiteApplies()) return;
    body.append(el('h3', 'trusted-sites-subhead', t('Pages from any site')));
    const list = el('ul', 'feature-flags profile-a11y-prefs trusted-sites-anysite');
    const li = el('li', '');
    const label = el('label', 'feature-flag');
    label.htmlFor = 'trusted-sites-anysite';
    const input = el('input', 'feature-flag-input');
    input.type = 'checkbox';
    input.id = 'trusted-sites-anysite';
    input.checked = anySite.anySiteChosen();
    const note = el('p', 'profile-hint', t('On the web version, Design shows supported players and reference sites until you turn this on. Lolly then reloads under a looser frame policy on this device, and still asks before loading a site you have not trusted.'));
    note.id = 'trusted-sites-anysite-note';
    input.setAttribute('aria-describedby', note.id);
    const switchMark = el('span', 'feature-flag-switch');
    switchMark.setAttribute('aria-hidden', 'true');
    label.append(el('span', 'feature-flag-label', t('Allow pages from any site')), input, switchMark);
    li.append(label);
    list.append(li);
    const err = el('p', 'be-err');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    input.addEventListener('change', () => {
      if (!input.checked) { anySite.leaveAnySite(); return; }
      input.disabled = true;
      void anySite.probeAnySite().then((offer) => {
        if (offer === 'offered') { anySite.enterAnySite(); return; }
        input.checked = false;
        input.disabled = false;
        err.textContent = offer === 'unreachable'
          ? t('Lolly could not reach its server to check. Try again when you are online.')
          : t('This server does not offer pages from any site. The desktop app can show any page.');
        err.hidden = false;
      });
    });
    body.append(list, note, err);
  };
  paint();
  const offSites = sites.onTrustedSitesChange(paint);
  const offPolicy = policy.onSitePolicyChange(paint);
  // The view's _cleanup (profile/chrome.ts) detaches the card when the route changes.
  pv.trustedSitesUnsub = () => { offSites(); offPolicy(); };
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
    wireEmojiPref: bindOp(pv, wireEmojiPref),
    wireTrustedSites: bindOp(pv, wireTrustedSites),
  };
}
