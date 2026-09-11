// SPDX-License-Identifier: MPL-2.0
/**
 * Profile menu - clicking the avatar/pill in the top-right cluster opens this
 * popover on every width (2026-08-26: was mobile-only; standardised across
 * desktop too so there's ONE consolidated place to switch theme, jump Home,
 * pick a language, etc.). It gathers what used to be scattered across the bar:
 * the theme switcher, Home, saved sessions (history), the language menu (opened
 * as a child popover off its row), and a link to the full Settings page. On
 * mobile the standalone history button, language FAB and "Profile" wordmark
 * also fold into it (hidden by CSS at <=640px).
 *
 * The avatar stays an `<a href="#/profile">` for no-JS / middle-click / open-in-
 * new-tab; the click handler preventDefaults and opens the menu instead, and the
 * full profile page is reachable from the menu's Settings row.
 *
 * attachProfileMenu(trigger, host, { savedCount, onHistory }) - wires `trigger`
 * (the .profile-link anchor). Returns a cleanup function that detaches listeners
 * and removes any open popover (the views call it on re-render / unmount).
 *
 * Mirrors the filter popover's conventions: Escape + outside-pointerdown close,
 * focus returns to the trigger.
 */
import { THEMES, THEME_LABELS, THEME_ICONS, currentTheme } from '../theme.ts';
import { setTheme, type SetThemeHost } from '../lib/set-theme.ts';
import { escape } from '../utils.ts';
import { mountBodyPopover } from './body-popover.ts';
import { soundSwitchHtml, wireSoundSwitch } from './sound-toggle.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';
import { t, LANG_META, currentLang, type LangSwitchHost } from '../i18n.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

// The chevron every navigation row wears (was hand-copied per row).
const CHEVRON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

// setTheme's weak profile slice (see folders.ts FolderProfile for the same
// no-index-signature pattern) plus switchLang's - the Language row hands the
// host to lang-menu's switchLang. Every caller passes a full HostV1 anyway.
type ProfileMenuHost = SetThemeHost & LangSwitchHost;

// The Sound/Neurospicy switch + the avatar headshot need a real assets API. The main
// views pass a full HostV1, but the two chrome slices (color-lab, /start) pass narrowed
// hosts - so detect a usable assets API at runtime rather than demanding it in the type,
// and simply omit those pieces when it isn't there.
type AssetsHost = ProfileMenuHost & { assets: HostV1['assets'] };
function hasAssets(h: ProfileMenuHost): h is AssetsHost {
  const a = (h as { assets?: unknown }).assets;
  return !!a && typeof (a as { get?: unknown }).get === 'function';
}

/** True when `node` sits inside the language popover this menu spawns - the
 *  body-popover `isInside` escape hatch, so a tap or Escape in the child
 *  doesn't dismiss this menu underneath it. */
function inLangMenu(node: Node | null): boolean {
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  return !!el?.closest('.lang-menu');
}

export function attachProfileMenu(
  triggerEl: HTMLElement | null,
  host: ProfileMenuHost,
  { savedCount = 0, onHistory }: { savedCount?: number; onHistory?: () => void } = {},
): () => void {
  if (!triggerEl) return () => {};
  const trigger = triggerEl; // const so closures see the narrowed (non-null) type
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  // The Language row's child popover detach - re-wired per open (render runs
  // fresh each time), torn down with the menu so the child can't outlive it.
  let detachLang: (() => void) | null = null;

  const popover = mountBodyPopover(trigger, (el, pop) => {
    const theme = currentTheme();
    el.innerHTML = `
      <div class="profile-menu-theme" role="group" aria-label="${escape(t('Theme'))}">
        ${THEMES.map(seg => { const name = escape(t(THEME_LABELS[seg] ?? seg)); return `<button type="button" class="profile-menu-seg" role="menuitemradio" data-theme-seg="${seg}" aria-checked="${seg === theme}" aria-label="${name}" title="${name}">${THEME_ICONS[seg]}</button>`; }).join('')}
      </div>
      ${hasAssets(host) ? `<div class="profile-menu-sound">${soundSwitchHtml()}</div>` : ''}
      <a class="profile-menu-item" role="menuitem" href="/#/" data-act="home">
        <span>${t('Home')}</span>
        ${CHEVRON}
      </a>
      ${savedCount ? `<button type="button" class="profile-menu-item" role="menuitem" data-act="history">
        <span>${t('Saved sessions')}</span><span class="profile-menu-count">${savedCount}</span>
      </button>` : ''}
      <button type="button" class="profile-menu-item" role="menuitem" data-act="lang" aria-haspopup="menu" aria-expanded="false">
        <span>${t('Language')}</span><span class="profile-menu-count">${escape(LANG_META[currentLang()].nativeName)}</span>
      </button>
      <a class="profile-menu-item" role="menuitem" href="#/profile?focus=design-systems-section" data-act="design-system">
        <span>${t('Design system')}</span><span class="profile-menu-count" data-ds-label></span>
      </a>
      <a class="profile-menu-item" role="menuitem" href="#/start" data-act="brand">
        <span>${t('Set up your brand')}</span>
        ${CHEVRON}
      </a>
      <a class="profile-menu-item" role="menuitem" href="#/profile" data-act="settings">
        <span>${t('Settings')}</span>
        ${CHEVRON}
      </a>`;

    // Theme: apply immediately + persist to the profile (canonical store), like the
    // profile view's segmented control. Keep the menu open so it can be re-tried.
    // The theme id rides on data-theme-seg, NOT data-theme: tokens.css scopes every theme
    // variable via the [data-theme="…"] attribute selector, so a data-theme on each button
    // would re-scope the tokens onto it (its --muted-foreground etc. would resolve in the
    // button's OWN theme) - making the "Light" label render in light theme's dark grey,
    // near-invisible on a dark menu. Matching the other segments' data-*-seg keeps that off.
    // The theme segments form a radio group: use a roving tabindex so Tab treats the
    // whole group as one stop (landing on the checked segment) and Arrow keys move
    // between segments. focus-trap skips the tabindex="-1" segments, so Tab steps
    // straight past the group to the menu items below.
    const segs = [...el.querySelectorAll<HTMLElement>('[data-theme-seg]')];
    const checkedSeg = segs.find(b => b.getAttribute('aria-checked') === 'true') ?? segs[0]!;
    const rove = (active: HTMLElement, focus = true): void => {
      segs.forEach(b => { b.tabIndex = b === active ? 0 : -1; });
      if (focus) active.focus();
    };
    rove(checkedSeg, false);

    const themeGroup = el.querySelector<HTMLElement>('.profile-menu-theme');
    themeGroup?.addEventListener('click', async (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('[data-theme-seg]');
      if (!btn) return;
      const next = btn.dataset.themeSeg!;
      segs.forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSeg === next)));
      rove(btn, false);   // the newly-checked segment becomes the group's single tab stop
      await setTheme(host, next);   // theme switch always sings - including this mobile profile-menu path
    });
    // Roving arrow-key navigation between the radio segments (Up/Left ←, Down/Right →), wrapping.
    themeGroup?.addEventListener('keydown', (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = segs.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      rove(segs[(i + step + segs.length) % segs.length]!);
    });

    // Sound + Neurospicy switch (the same unified control the view-option popovers
    // carry) - rendered + wired only when the host can supply loop bytes. Cast:
    // SetThemeHost's profile.set is optional, wireSoundSwitch wants it required.
    if (hasAssets(host)) wireSoundSwitch(el, host as unknown as Parameters<typeof wireSoundSwitch>[1]);

    el.querySelector('[data-act="history"]')?.addEventListener('click', () => {
      pop.close();
      onHistory?.();
    });
    // Home / Brand wizard / Settings are plain hash links; just let them
    // navigate, closing the menu first. Home is `/#/` (root-absolute like the
    // back pill's HOME_HREF - a bare '#/' resolves against a /t/<id> path). The
    // wizard entry shows always - a branded user re-running it is a supported
    // path (it overwrites the user tokens).
    el.querySelector('[data-act="home"]')?.addEventListener('click', () => pop.close());
    // The active design system's label (plans/186): read async, filled in place,
    // so the row costs the menu nothing at open. The row opens the Profile card
    // that lists and switches them.
    el.querySelector('[data-act="design-system"]')?.addEventListener('click', () => pop.close());
    void (host as unknown as { tokens?: { active?(): Promise<{ label: string } | null> } }).tokens?.active?.()
      .then(a => { const slot = el.querySelector<HTMLElement>('[data-ds-label]'); if (slot && a) slot.textContent = a.label; })
      .catch(() => { /* no registry - the row still opens the card */ });
    el.querySelector('[data-act="brand"]')?.addEventListener('click', () => pop.close());
    el.querySelector('[data-act="settings"]')?.addEventListener('click', () => pop.close());

    // Language opens the full lang-menu popover as a CHILD anchored off this
    // row (mountBodyPopover's documented spawns-popovers case - `isInside`
    // below keeps this menu open under it and yields Escape to it). Same lazy
    // import as view-topbar's fab wiring: the chunk loads while the menu is
    // open, so the row wires within ~ms of first paint.
    const langBtn = el.querySelector<HTMLElement>('[data-act="lang"]');
    if (langBtn) {
      void import('./lang-menu.ts').then((m) => {
        if (langBtn.isConnected) detachLang = m.attachLangMenu(langBtn, host);
      });
    }

    // Contain keyboard focus: wrap Tab/Shift+Tab within the menu, moving initial
    // focus to the checked theme segment. inertBackground is off - the avatar
    // trigger lives in the branch that would get inerted, and inert cascades with
    // no way for a descendant to opt back out, which would kill the trigger's
    // re-tap-to-close affordance (and looks like the whole page is stuck).
    return checkedSeg;
  }, {
    className: 'profile-menu',
    ariaLabel: escape(t('Profile and settings')),
    // No onResize override: body-popover's default re-runs position() so the menu
    // just re-anchors on resize (it's a valid control at every width now).
    // The Language row's child popover is a body sibling - own it (see inLangMenu).
    isInside: inLangMenu,
    // Close the child with the parent, whichever route closed it (Escape,
    // outside tap, route change) - detachLang's cleanup closes the child popover.
    onClose: () => { detachLang?.(); detachLang = null; },
  });

  const onClick = (e: MouseEvent) => {
    // Left-click on every width opens the consolidated menu; a modified click
    // (middle/cmd/ctrl/shift - open in new tab, etc.) falls through to the
    // anchor's href so #/profile is still directly reachable.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    popover.isOpen() ? popover.close(true) : popover.open();
  };
  trigger.addEventListener('click', onClick);

  return () => { popover.close(); trigger.removeEventListener('click', onClick); };
}

/**
 * Append the profile FAB (icon-only `#/profile` link, skinned `.profile-fab` -
 * topbar.css, same box as `.theme-fab`) to a view's fixed top-right cluster and
 * attach the mobile menu to it - the mirror of theme-toggle.ts's mountThemeFab,
 * for the nav-less utility views (Dashboard, Verify, Convert, Spreadsheet,
 * Unpack, Script, /start, the Lab). Clicking it opens the consolidated menu at
 * every width; the cluster's own language + theme FABs hide against it at every
 * width too (overrides.css `.gallery-topright:has(.profile-fab, .profile-link)`).
 * A no-op when the cluster isn't present, like mountThemeFab.
 */
export function mountProfileFab(
  cluster: Element | null,
  host: ProfileMenuHost,
  opts: { className?: string } = {},
): void {
  if (!cluster) return;
  const link = document.createElement('a');
  link.href = '#/profile';
  link.className = opts.className ?? 'profile-fab';
  link.setAttribute('aria-label', t('Open your profile'));
  link.title = t('Profile');
  // The Lolly mark (then the user's headshot), same as the topbar pill - not a
  // generic person glyph. `.profile-fab svg` centres the mark; `.profile-fab-avatar`
  // (topbar.css) fills the square once a headshot loads.
  paintProfileMark(link, host, LOLLY_MARK_SVG, 'profile-fab-avatar');
  cluster.appendChild(link);
  attachProfileMenu(link, host);
}

/**
 * Paint a profile trigger with the Lolly mark, then swap in the user's headshot
 * off the first-paint path - it's a blob fetch by id (its object URL goes stale
 * across reloads), so keep it off first paint; a failure leaves the mark. Shared
 * by the pill (`.profile-link-mark` / `.profile-link-avatar`) and the square FAB
 * (`.profile-fab-avatar`); each surface skins `markHtml` + `avatarClass` its way.
 */
function paintProfileMark(
  link: HTMLAnchorElement,
  host: ProfileMenuHost,
  markHtml: string,
  avatarClass: string,
): void {
  link.innerHTML = markHtml;
  if (!hasAssets(host)) return;
  void host.profile.get().then(p => {
    const hid = (p as { headshot?: { id?: string } }).headshot?.id;
    if (!hid) return;
    void host.assets.get(hid).then(res => {
      if (!res?.url || !link.isConnected) return;
      let img = link.querySelector<HTMLImageElement>(`.${avatarClass}`);
      if (!img) { img = document.createElement('img'); img.className = avatarClass; img.alt = ''; link.prepend(img); }
      img.src = res.url;
      link.classList.add('has-avatar');
    }).catch(() => { /* no avatar - the mark stands */ });
  }).catch(() => { /* no profile - the mark stands */ });
}

/**
 * Build a standalone, icon-only profile control (the `.profile-link` avatar the
 * topbar uses, no name) wired to the consolidated menu, and RETURN it - for surfaces
 * that dock it themselves rather than into a `.gallery-topright` cluster (the canvas
 * zoom HUD in the tool editor). Renders the Lolly-mark immediately, then swaps in the
 * user's headshot off the first-paint path (like mountViewTopbar's deferred fetch).
 */
export function createProfileControl(host: ProfileMenuHost, opts: { className?: string } = {}): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = '#/profile';
  link.className = `profile-link${opts.className ? ` ${opts.className}` : ''}`;
  link.setAttribute('aria-label', t('Open your profile'));
  attachProfileMenu(link, host);   // sets aria-haspopup/expanded + opens the menu on click
  paintProfileMark(link, host, `<span class="profile-link-mark" aria-hidden="true">${LOLLY_MARK_SVG}</span>`, 'profile-link-avatar');
  return link;
}
