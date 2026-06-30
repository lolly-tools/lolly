// SPDX-License-Identifier: MPL-2.0
/**
 * Mobile profile menu — the avatar in the top-right cluster becomes a single
 * compact button on narrow screens (the standalone history button and the
 * "Profile" wordmark are hidden by CSS), and tapping it opens this popover with
 * everything that was scattered across the bar: the theme switcher, saved
 * sessions (history), and a link to the full Settings page.
 *
 * On desktop the avatar is left alone — it stays a plain link to #/profile — so
 * this only intercepts the click while the small-screen layout is active.
 *
 * attachProfileMenu(trigger, host, { savedCount, onHistory }) — wires `trigger`
 * (the .profile-link anchor). Returns a cleanup function that detaches listeners
 * and removes any open popover (the views call it on re-render / unmount).
 *
 * Mirrors the filter popover's conventions: Escape + outside-pointerdown close,
 * focus returns to the trigger.
 */
import { THEMES, THEME_LABELS, currentTheme, applyTheme } from '../theme.js';
import { escape } from '../utils.js';

// Matches the gallery/projects mobile breakpoint (the chrome only collapses there).
const MOBILE = '(max-width: 640px)';
// Route-change signals the web shell fires (see main.js) — any one dismisses an
// open menu so it never outlives the view that spawned it.
const NAV_EVENTS = ['hashchange', 'popstate', 'lolly:navigate'];

export function attachProfileMenu(trigger, host, { savedCount = 0, onHistory } = {}) {
  if (!trigger) return () => {};
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  let menu = null;
  let outside = null;

  function close(returnFocus = false) {
    if (!menu) return;
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNavAway));
    outside = null;
    menu.remove();
    menu = null;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } };
  // A viewport resize past the breakpoint (rotate / desktop) makes the menu moot —
  // the inline buttons take over again — so just dismiss it rather than reflow.
  const onResize = () => { if (!window.matchMedia(MOBILE).matches) close(); };
  // The menu lives on document.body, so a route change would otherwise leave it
  // orphaned (the view's innerHTML swap can't reach it). Dismiss on any navigation.
  const onNavAway = () => close();

  function position() {
    if (!menu) return;
    const r = trigger.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 8)}px`;
    // Right-align the panel with the avatar's right edge.
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  }

  function open() {
    if (menu) return;
    const theme = currentTheme();
    menu = document.createElement('div');
    menu.className = 'profile-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Profile and settings');
    menu.innerHTML = `
      <div class="profile-menu-theme" role="group" aria-label="Theme">
        ${THEMES.map(t => `<button type="button" class="profile-menu-seg" role="menuitemradio" data-theme="${t}" aria-checked="${t === theme}">${escape(THEME_LABELS[t] ?? t)}</button>`).join('')}
      </div>
      ${savedCount ? `<button type="button" class="profile-menu-item" role="menuitem" data-act="history">
        <span>Saved sessions</span><span class="profile-menu-count">${savedCount}</span>
      </button>` : ''}
      <a class="profile-menu-item" role="menuitem" href="#/profile" data-act="settings">
        <span>Settings</span>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </a>`;
    document.body.appendChild(menu);
    position();
    trigger.setAttribute('aria-expanded', 'true');

    // Theme: apply immediately + persist to the profile (canonical store), like the
    // profile view's segmented control. Keep the menu open so it can be re-tried.
    menu.querySelector('.profile-menu-theme')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      const next = btn.dataset.theme;
      applyTheme(next);
      menu.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.theme === next)));
      try {
        const profile = await host.profile.get();
        await host.profile.set({ ...profile, theme: next });
      } catch { /* preference save is best-effort */ }
    });

    menu.querySelector('[data-act="history"]')?.addEventListener('click', () => {
      close();
      onHistory?.();
    });
    // Settings is a plain hash link; just let it navigate, closing the menu first.
    menu.querySelector('[data-act="settings"]')?.addEventListener('click', () => close());

    outside = (e) => { if (menu && !menu.contains(e.target) && !trigger.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNavAway));
    menu.querySelector('button, a')?.focus();
  }

  const onClick = (e) => {
    // Desktop: leave the avatar as a direct link to the profile page.
    if (!window.matchMedia(MOBILE).matches) return;
    e.preventDefault();
    menu ? close(true) : open();
  };
  trigger.addEventListener('click', onClick);

  return () => { close(); trigger.removeEventListener('click', onClick); };
}
