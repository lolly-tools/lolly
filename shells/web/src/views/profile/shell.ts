// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the page markup, the settings nav rail and the ?focus= deep-link target.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { THEMES, THEME_ICONS, THEME_LABELS } from '../../theme.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { fold, scoreHaystack, tokenize } from '../../lib/search/match.ts';
import { t } from '../../i18n.ts';
import { langFabHtml } from '../../components/lang-menu.ts';
import { soundSwitchHtml } from '../../components/sound-toggle.ts';
import { escape as escapeText } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { renderActivity } from '../../lib/activity-summary.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { getFieldPolicy } from '../../lib/field-policy.ts';
import { updatesRowHtml } from '../profile-updates.ts';
import { backHomeHtml } from '../../components/back-pill.ts';
import { DEFAULT_HEADSHOT, FIELD_LABELS, NAV_SECTIONS, pulseHighlight, skeletonRow, summaryRow } from './shared.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

/** The whole page markup in one write: the nav rail and every settings card. */
export function renderShell(pv: ProfileViewCtx): void {
  const { activeDesignSystemLabel, activeTheme, adminHref, canChangeInstance, displayName, fields, hasShellUpdater, instanceBase, metrics, profile, viewEl } = pv;
  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topbar" style="justify-content:flex-end">
      <div class="gallery-topright">
        ${langFabHtml()}
      </div>
    </div>
    <div class="profile-layout">
      <h1 class="visually-hidden">${t('Your profile')}</h1>

      <aside class="profile-nav" aria-label="${escapeText(t('Settings sections'))}">
        <div class="profile-nav-search">
          <span class="profile-nav-search-ic" aria-hidden="true">${icon('search', { size: 15 })}</span>
          <input type="search" id="profile-nav-search" class="profile-nav-search-input" placeholder="${escapeText(t('Search settings'))}" aria-label="${escapeText(t('Search settings'))}" autocomplete="off" spellcheck="false">
        </div>
        <ul class="profile-nav-list" role="list">
          ${NAV_SECTIONS.map(s => `<li><button type="button" class="profile-nav-item" data-nav="${s.id}">${icon(s.icon, { size: 16, className: 'profile-nav-ic' })}<span class="profile-nav-text">${escapeText(t(s.label))}</span></button></li>`).join('')}
        </ul>
        <p class="profile-nav-empty" id="profile-nav-empty" hidden>${t('No settings match')}</p>
      </aside>

      <div class="profile-panes">

      <details class="profile-card profile-collapse" id="details-section"${pv.rows.startOpen('details-section')}>
        ${summaryRow('details-section', t('Your details'), displayName
          ? `<span class="profile-summary-name">${escapeText(displayName)}</span>`
          : t('Nothing added - exports stay anonymous'))}
        <div class="profile-collapse-body section-card-body">
        <form class="profile-form" id="profile-form">
          ${/* The opt-in leads the form (plans/163 section 4.3): it is the door that
               decides whether anything below ever leaves this device, so it reads
               before the fields rather than after the Save button. Same checkbox,
               same name, same live label swap - placement and one sentence only. */''}
          <div class="profile-optin">
            <label class="profile-check">
              <span class="profile-check-tag">${t(profile.useDetails ? 'Opted-in' : 'opt-in')}</span>
              ${pv.jellyOn
                ? `<jelly-checkbox name="useDetails" size="sm" label="${escapeText(t('Use my details to create'))}"${profile.useDetails ? ' checked' : ''}></jelly-checkbox>`
                : `<input type="checkbox" name="useDetails" ${profile.useDetails ? 'checked' : ''}>`}
              <span class="profile-check-text">${t(profile.useDetails ? 'Using my details' : 'Use my details to create')}</span>
            </label>
            <p class="profile-optin-note">${t('Only when this is on do your details go into the files you export - shown per file at export time.')}</p>
          </div>
          <div class="profile-details-grid">
            <div class="profile-details-main">
              <div class="profile-fields">
                ${fields.filter(f => getFieldPolicy(f)?.mode !== 'hidden').map(f => {
                  // Consult the generic field-policy registry: hidden fields are
                  // dropped above; a locked field shows a small "Managed by …"
                  // chip and its policy value overrides the stored one. With no
                  // policy (the default) this is exactly today's render.
                  const pol = getFieldPolicy(f);
                  const val = pol && pol.value !== undefined
                    ? String(pol.value)
                    : String((profile as Record<string, unknown>)[f] ?? '');
                  // A locked field shows a padlock, not a text chip: the "Managed
                  // by …" note rides along as its tooltip (title + accessible
                  // label) so the row stays uncluttered. No note ⇒ nothing.
                  const note = pol?.mode === 'locked' && pol.note
                    ? `<span class="profile-field-lock" tabindex="0" role="img" title="${escapeText(pol.note)}" aria-label="${escapeText(pol.note)}" style="margin-inline-start:.35rem;display:inline-flex;vertical-align:middle;color:hsl(var(--muted-foreground))">${icon('lock', { size: 13 })}</span>`
                    : '';
                  return `<label class="profile-field">
                  <span class="profile-field-label">${escapeText(t(FIELD_LABELS[f] ?? f))}${note}</span>
                  ${pv.rows.fieldControl(f, val)}
                </label>`;
                }).join('')}
              </div>

              <div class="profile-actions">
                ${pv.rows.saveButtonHtml()}
              </div>
            </div>

            <aside class="profile-side">
              <div class="profile-field">
                <span class="profile-field-label headshot-heading">${t('Headshot')}</span>
                <div class="headshot">
                  <div class="headshot-preview${pv.headshotUrl ? '' : ' is-empty'}" id="headshot-preview" style="background-image:url('${escapeText(pv.headshotUrl || DEFAULT_HEADSHOT)}')">
                    ${pv.jellyOn
                      ? `<jelly-button variant="platinum" class="headshot-edit-jelly" id="headshot-upload">${t(pv.headshotUrl ? 'Edit' : 'Upload')}</jelly-button>`
                      : `<button type="button" class="headshot-edit" id="headshot-upload">${t(pv.headshotUrl ? 'Edit' : 'Upload')}</button>`}
                  </div>
                  <button type="button" class="headshot-remove" id="headshot-remove" aria-label="${escapeText(t('Remove headshot'))}" title="${escapeText(t('Remove'))}"${pv.headshotUrl ? '' : ' hidden'}>&times;</button>
                  <input type="file" id="headshot-file" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/svg+xml" hidden>
                </div>
                <p class="profile-inline-error" id="headshot-error" style="color:hsl(var(--destructive));font-size:13px;margin:.4rem 0 0" hidden></p>
              </div>
            </aside>
          </div>
        </form>
        </div>
      </details>

      ${/* Content Credentials sits second, right under Your details: the two are one
           subject - what goes into the files you export - and splitting them across
           the page was what made the provenance story unfindable (plans/163 4.2). */''}
      <details class="profile-card profile-collapse" id="identity-section"${pv.rows.startOpen('identity-section')}>
        ${summaryRow('identity-section', t('Content Credentials'))}
        <div class="profile-collapse-body section-card-body" id="identity-body">${skeletonRow()}</div>
      </details>

      <details class="profile-card profile-collapse" id="design-systems-section"${pv.rows.startOpen('design-systems-section')}>
        ${summaryRow('design-systems-section', t('Design systems'), escapeText(activeDesignSystemLabel))}
        <div class="profile-collapse-body section-card-body" id="design-systems-body">${skeletonRow()}</div>
      </details>

      <details class="profile-card profile-collapse profile-card--appearance" id="appearance-section"${pv.rows.startOpen('appearance-section')}>
        ${summaryRow('appearance-section', t('Appearance'), escapeText(pv.summaries.themeLabel(activeTheme)))}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('How the app dresses for you - your preference, separate from your brand. Applied instantly and remembered on this device.')}</p>
        <div class="profile-theme-grid" data-theme-pick>
          ${THEMES.map(theme => `
            <button type="button" class="profile-theme${theme === activeTheme ? ' is-active' : ''}" data-theme-set="${escapeText(theme)}" data-theme="${escapeText(theme)}" aria-pressed="${theme === activeTheme ? 'true' : 'false'}">
              <div class="profile-theme-name"><span class="profile-theme-ic" aria-hidden="true">${THEME_ICONS[theme]}</span>${escapeText(t(THEME_LABELS[theme]))}${theme === 'light' ? `<span class="profile-theme-pill">${t('default')}</span>` : ''}</div>
              <div class="profile-theme-dots">
                <span style="background:hsl(var(--primary))" title="primary"></span>
                <span style="background:hsl(var(--card))" title="card"></span>
                <span style="background:hsl(var(--accent))" title="accent"></span>
                <span style="background:hsl(var(--muted))" title="muted"></span>
                <span style="background:hsl(var(--foreground))" title="foreground"></span>
              </div>
              <div class="profile-theme-sample">Aa</div>
            </button>`).join('')}
        </div>
        <ul class="feature-flags profile-a11y-prefs" id="appearance-prefs">${pv.prefs.followDsListHtml()}
        </ul>
        </div>
      </details>

      <details class="profile-card profile-collapse profile-card--a11y" id="a11y-section"${pv.rows.startOpen('a11y-section')}>
        ${summaryRow('a11y-section', t('Accessibility'), pv.summaries.a11ySummary())}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('Comfort settings for the app around your work. Each one is off until you turn it on, and none of them touch your designs or your exports.')}</p>
        <ul class="feature-flags profile-a11y-prefs" id="a11y-prefs">${pv.prefs.a11yListHtml()}
        </ul>
        ${/* Sound + focus music live IN the comfort card (plans/142 A11y-1/2,
            Andy's call): the same switches that used to sit beside the headshot.
            One home for every stimulation control - visual prefs above, audio
            here. The Neurospicy row inside soundSwitchHtml stays governed by
            its (default-ON) flag, so managed instances keep their say. */''}
        <div class="profile-field profile-field--sound" style="margin-top:.9rem">
          ${soundSwitchHtml()}
        </div>
        </div>
      </details>

      ${/* Sync across devices is a sub-block of this card, not a card of its own: it
           syncs THROUGH the providers connected right above it, so the two were
           always one subject. Both bodies mount lazily when the card opens. */''}
      <details class="profile-card profile-collapse" id="connections-section"${pv.rows.startOpen('connections-section')}>
        ${summaryRow('connections-section', t('Connected services'))}
        <div class="profile-collapse-body section-card-body">
          <div id="connections-body">${skeletonRow()}</div>
          <div class="storage-subsection">
            <div class="storage-subsection-header"><h3>${t('Sync across devices')}</h3></div>
            <div id="sync-body">${skeletonRow()}</div>
          </div>
        </div>
      </details>

      <details class="profile-card profile-collapse" id="renders-section"${pv.rows.startOpen('renders-section')}>
        ${summaryRow('renders-section', t('Your renders'), pv.summaries.rendersSummary())}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('Keep a copy of everything you download, ready to reopen or reuse.')}</p>
        <ul class="feature-flags profile-a11y-prefs" id="render-save-prefs">${pv.prefs.renderSaveListHtml()}
        </ul>
        </div>
      </details>

      <details class="profile-card profile-collapse" id="storage-section"${pv.rows.startOpen('storage-section')}>
        ${summaryRow('storage-section', t('Storage'))}
        <div class="profile-collapse-body section-card-body" id="storage-body">${skeletonRow()}</div>
      </details>

      <details class="profile-card profile-collapse" id="offline-section"${pv.rows.startOpen('offline-section')}>
        ${summaryRow('offline-section', t('Available offline'))}
        <div class="profile-collapse-body section-card-body" id="offline-body">${skeletonRow()}</div>
      </details>

      ${isTauriShell() ? `
      <details class="profile-card profile-collapse" id="hotfolder-section"${pv.rows.startOpen('hotfolder-section')}>
        ${summaryRow('hotfolder-section', t('Hot folder'), '')}
        <div class="profile-collapse-body section-card-body" id="hotfolder-body">
          <p class="profile-hint">${t('Watch one folder on this computer. Anything dropped into it is pulled into Lolly through the same chooser a drag-and-drop gets - nothing leaves the device.')}</p>
          <label class="field-row"><span>${t('Folder path')}</span>
            <input type="text" class="field-input" id="hotfolder-path" placeholder="${escapeText(t('e.g. /home/you/Lolly-inbox'))}" autocomplete="off" spellcheck="false">
          </label>
          <div class="profile-actions-row">
            <button type="button" class="btn" id="hotfolder-enable">${t('Watch this folder')}</button>
            <button type="button" class="btn" id="hotfolder-disable" hidden>${t('Stop watching')}</button>
          </div>
          <p class="be-err" id="hotfolder-err" hidden></p>
        </div>
      </details>` : ''}

      <details class="profile-card profile-collapse profile-activity" id="activity-section"${pv.rows.startOpen('activity-section')}>
        ${summaryRow('activity-section', t('Your activity'), t('{n} renders', { n: metrics.filesRendered }))}
        <div class="profile-collapse-body section-card-body">${renderActivity(metrics, window.__toolIndex?.tools ?? [])}</div>
      </details>

      <details class="profile-card profile-collapse" id="feature-flags-section"${pv.rows.startOpen('feature-flags-section')}>
        ${summaryRow('feature-flags-section', t('Feature flags'), pv.summaries.flagsSummary())}
        <div class="profile-collapse-body section-card-body">
          <p class="storage-hint-text feature-hint-text">${t('Self-governance, autonomy, choice. Enable or disable parts of the app here')}</p>
          <ul class="feature-flags" id="feature-flags">${pv.rows.flagListHtml()}
          </ul>
        </div>
      </details>

      <details class="profile-card profile-collapse" id="instance-section"${pv.rows.startOpen('instance-section')}>
        ${summaryRow('instance-section', t('Lolly instance'), instanceBase ? escapeText(instanceBase) : t('Bundled'))}
        <div class="profile-collapse-body section-card-body">
        <p class="profile-appearance-sub">${t('Where this install gets its tools and catalogue from.')}</p>
        <div class="store-manage--row">
          <span class="store-manage-name">${escapeText(instanceBase || t('Bundled with this app'))}</span>
          <span style="display:flex;gap:8px">
            ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - orgAdminHref() returns the '/admin' literal or null; no control-plane value reaches it */ ''}
            ${adminHref ? `<a class="btn" id="instance-console-link" href="${escapeText(adminHref)}">${t('Instance console')}</a>` : ''}
            ${canChangeInstance ? `<button type="button" class="btn" id="instance-change-btn">${t('Change')}</button>` : ''}
            ${/* Leave is never desktop-only: a .lolly share file carrying an instance pack
                  connects ANY shell to that pack's instance (brand-transfer.ts), and a browser
                  that got there this way needs the same way back. */ ''}
            ${instanceBase ? `<button type="button" class="btn-link-danger" id="instance-disconnect-btn">${t('Leave')}</button>` : ''}
          </span>
        </div>
        ${canChangeInstance ? '' : `<p class="profile-appearance-sub">${t('Pointing at another Lolly instance needs the desktop app - a browser blocks a page from loading tools and assets across origins.')}</p>`}
        ${/* App updates (plans/202 WP4.1) - the row and its wiring live in
              views/profile-updates.ts. */ ''}
        ${updatesRowHtml(hasShellUpdater)}
        </div>
      </details>

      </div>
    </div>
  `;
}

/** The settings nav rail: jump, scroll-spy and the search filter. */
export function wireNav(pv: ProfileViewCtx): void {
  const { viewEl } = pv;
  // (The old two-button .profile-footer is retired - the shell's persistent search
  // bar (components/search-bar.ts, plans/99 M1) shows on this route and carries the
  // same Dashboard/Verify links plus the search field. Profile makes no claim, so
  // the bar keeps its global default placeholder.)

  // ─── Settings nav rail: jump, scroll-spy, and search ─────────────────────
  // A macOS/GNOME-style left rail. Clicking a section scrolls to it (opening a
  // collapsed <details> first); scrolling highlights the section in view; the
  // search box filters the rail (and, while typing, the visible cards) so a
  // buried setting is one query away. All progressive: if there's no matching
  // markup the wiring simply no-ops.
  (() => {
    const nav = viewEl.querySelector<HTMLElement>('.profile-nav');
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLButtonElement>('.profile-nav-item'));
    const search = nav.querySelector<HTMLInputElement>('#profile-nav-search');
    const empty = nav.querySelector<HTMLElement>('#profile-nav-empty');
    const sectionOf = (id: string) => viewEl.querySelector<HTMLElement>(`#${CSS.escape(id)}`);

    const jump = (id: string) => {
      const el = sectionOf(id);
      if (!el) return;
      // A collapsed <details> must open before it can be scrolled into meaningful view.
      if (el instanceof HTMLDetailsElement && !el.open) el.open = true;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    };

    for (const btn of items) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.nav!;
        jump(id);
        // Move focus to the section heading for screen-reader/keyboard continuity,
        // without stealing the smooth scroll (focus without scroll).
        sectionOf(id)?.querySelector<HTMLElement>('h2')?.focus?.();
      });
    }

    // Scroll-spy - highlight the section whose top is nearest the rail. rootMargin
    // biases the "active" band to the upper third so a section lights up as its
    // heading reaches the top, not only when it fills the viewport.
    const setActive = (id: string | null) => {
      for (const btn of items) {
        const on = btn.dataset.nav === id;
        btn.classList.toggle('is-active', on);
        if (on) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      }
    };
    if ('IntersectionObserver' in window) {
      const visible = new Map<string, number>();
      const io = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        }
        // Pick the topmost currently-intersecting section (page order = NAV_SECTIONS order).
        const top = NAV_SECTIONS.find(s => visible.has(s.id));
        if (top) setActive(top.id);
      }, { rootMargin: '-10% 0px -70% 0px', threshold: [0, 1] });
      for (const s of NAV_SECTIONS) {
        const el = sectionOf(s.id);
        if (el) io.observe(el);
      }
      // Tear down when the view unmounts (the router replaces viewEl's subtree).
      const mo = new MutationObserver(() => {
        if (!viewEl.contains(nav)) { io.disconnect(); mo.disconnect(); }
      });
      mo.observe(viewEl, { childList: true });
    }

    // Search - filter the rail by label + keywords; hide non-matching cards while a
    // query is present so the page itself narrows to what you're looking for.
    // Matching is lib/search (plans/99 M3 - the shared matcher replaces the old
    // single `.includes()` here). Two behaviour changes ride along, both wanted:
    // a multi-word query ANDs across tokens ("large text" needs both words to
    // land, in any field), and diacritics fold ("accessibilité" finds the
    // Accessibility card). Same haystack as before - t(label) + English label +
    // keywords - scored > 0 as a plain filter; the rail keeps page order.
    if (search) {
      const panes = viewEl.querySelector<HTMLElement>('.profile-panes');
      const apply = () => {
        const tokens = tokenize(search.value);
        let matches = 0;
        for (const s of NAV_SECTIONS) {
          const btn = items.find(b => b.dataset.nav === s.id);
          const card = sectionOf(s.id);
          const hit = !tokens.length || scoreHaystack([
            { text: fold(t(s.label)), weight: 2 },
            { text: fold(s.label), weight: 2 },
            { text: fold(s.keywords), weight: 1 },
          ], tokens) > 0;
          if (btn) btn.hidden = !hit;
          // Only narrow the cards while actively searching - an empty query restores
          // the full page (never leaves a card orphaned hidden).
          if (card) card.classList.toggle('is-filtered-out', tokens.length > 0 && !hit);
          if (hit) matches++;
        }
        panes?.classList.toggle('is-searching', tokens.length > 0);
        if (empty) empty.hidden = matches > 0;
      };
      search.addEventListener('input', apply);
      // Enter jumps to the first (only) remaining match - the quickest path to a
      // setting you searched for.
      search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const first = items.find(b => !b.hidden);
        if (first) { jump(first.dataset.nav!); first.classList.add('is-active'); }
      });
    }
  })();
}

/** The #/profile?focus=<id> deep-link target: open, scroll, highlight. */
export function wireFocusTarget(pv: ProfileViewCtx): void {
  const { focusFlags, focusParam, focusUseDetails, viewEl } = pv;
  // Label-click forwarding for the jelly switches is app-wide now - the one
  // delegated forwarder installed by lib/jelly.ts when the bundle loads. (A
  // second, view-local forwarder here would run on the same click and toggle the
  // switch straight back - reading as a dead toggle.)

  // Deep-link target: #/profile?focus=<id> scrolls a section or control into view
  // and briefly highlights it, so a link that promises "go set this up" visibly
  // delivers it instead of landing on the page top with no clue where to look.
  // Three recognised forms, one shared path (pulseHighlight below) so a target
  // never falls back to a silent scroll: the feature-flags alias (gallery's
  // empty-state nudge), the use-details alias (gallery's personalisation nudge),
  // and any NAV_SECTIONS id (the rail's own jump(), search hits, share links,
  // screenshot recipes). A collapsible target is opened first (fires the toggle
  // that lazy-loads storage/images - the initial-open check at the bottom catches
  // it too).
  const sec: HTMLElement | null = focusFlags
    ? viewEl.querySelector<HTMLElement>('#feature-flags-section')
    : focusUseDetails
    ? viewEl.querySelector<HTMLElement>('.profile-check')
    : focusParam && NAV_SECTIONS.some(s => s.id === focusParam)
    ? viewEl.querySelector<HTMLElement>('#' + CSS.escape(focusParam))
    : null; pv.sec = sec;
  if (sec) {
    if (sec instanceof HTMLDetailsElement) sec.open = true;
    requestAnimationFrame(() => {
      sec.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: focusUseDetails ? 'center' : 'start',
      });
      // Focus the heading for screen-reader/keyboard continuity - the same move
      // the rail's nav buttons make (a no-op for .profile-check, which has none).
      sec.querySelector<HTMLElement>('h2')?.focus?.();
      pulseHighlight(sec);
    });
  }
}

export function shellOps(pv: ProfileViewCtx) {
  return {
    renderShell: bindOp(pv, renderShell),
    wireNav: bindOp(pv, wireNav),
    wireFocusTarget: bindOp(pv, wireFocusTarget),
  };
}
