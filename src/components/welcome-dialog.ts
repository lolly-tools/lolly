// SPDX-License-Identifier: MPL-2.0
/**
 * First-run welcome for an UNBRANDED install (the lolly-start profile) - plus
 * the slim "how Lolly works" tips strip the gallery shows until dismissed.
 *
 * The gallery decides WHEN to show these (token discovery still resolves the
 * `lolly/tokens/brand` placeholder - see mountGallery); this module owns the
 * dialog/strip themselves. The welcome is built on mountModal (components/modal.ts,
 * Escape via the `cancel` event, backdrop-box click test, mounted on <body>),
 * offering two paths:
 *
 *   "Make it yours"          → the #/start brand wizard. Persists the dismissed
 *                              flag (audit 167 F-A5: taking a door IS an answer;
 *                              the fork re-appearing after a brand-room detour
 *                              read as amnesia). The brand room's own empty
 *                              state is the re-invitation if the user backs out.
 *   "Bring your design"      → the universal drop router's file picker
 *                              (lib/drop-router.ts): a Figma/Penpot/PDF/… file
 *                              routes into Design or the library. Persists
 *                              the flag, same reasoning as the wizard path.
 *   "Explore the tools"      → dismiss, persist the flag, stay on the gallery.
 *   "Skip for now"           → the quiet text link under the cards; identical to
 *                              Escape (dismiss + persist), just visible.
 *
 * Dismissing by any other means (Escape, backdrop) persists the flag too - a
 * welcome that keeps re-appearing after being waved away is a nag, not a hello.
 * Any of those explicit dismissals also acknowledges the privacy notice: page 1
 * carries the short assurance line, so the standalone strip has nothing left to
 * say (plans/137 A2). A route change (close(null)) is not a dismissal and
 * acknowledges nothing.
 *
 * Two pages, one dialog. The shell is a fixed size on both pages (a scrolling
 * body plus a footer that never moves - styles/parts/welcome.css), so switching
 * pages does not resize the dialog and the footer can never be clipped off the
 * bottom of a phone screen:
 *
 *   Page 1  the three doors above.
 *   Page 2  "Private by design" - the privacy assurance in full, with a "Got it"
 *           button that calls ackPrivacyNotice() and CLOSES the dialog (audit
 *           167 F-A4: agreeing must complete something, not bounce to page 1).
 *           Only that button acknowledges; opening the dialog or reading
 *           page 2 does not.
 *
 * The footer holds the two page dots (clickable), the language row and "Skip for
 * now" on both pages. The language row starts collapsed to the detected language
 * plus a "More languages…" expander - 26 chips is a wall of choice nobody asked
 * for at boot (plans/137 A3). Expanding, switching language and changing page all
 * re-render the same <dialog> in place; nothing re-opens a modal.
 *
 * Singleton: the gallery force re-mounts itself after a catalog sync, and a
 * second show call while open must hand back the SAME promise instead of
 * stacking a second modal. Any route change tears the dialog down (without
 * setting the flag - navigation isn't a dismissal), so it can never linger
 * over another view.
 */
import '../styles/parts/welcome.css';
import { currentLang, docsAppHref, langOptions, setActiveLang, t, LANG_ICON_SVG, flagEmoji } from '../i18n.ts';
import type { Lang } from '../i18n.ts';
import { escape, NAV_EVENTS } from '../utils.ts';
import { createScope } from '../lib/dispose.ts';
import { icon } from '../lib/icons.ts';
import type { WebProfileAPI } from '../bridge/profile.ts';
import type { PickerHost } from '../views/picker.ts';
import { openDropFilePicker } from '../lib/drop-router.ts';
import { ackPrivacyNotice } from '../views/privacy-notice.ts';
import { mountModal } from './modal.ts';

/** Persisted (localStorage, same tier as the theme) once the welcome is settled. */
export const WELCOME_DISMISSED_KEY = 'lolly-welcome-dismissed';
const TIPS_DISMISSED_KEY = 'lolly-tips-dismissed';

/** True once the user has settled the welcome (or when storage is unavailable - 
 *  we'd re-prompt every visit otherwise, which is worse than never prompting). */
export function isWelcomeDismissed(): boolean {
  try { return localStorage.getItem(WELCOME_DISMISSED_KEY) === '1'; }
  catch { return true; }
}

/** Persist the dismissal - also called by the #/start wizard after an install. */
export function markWelcomeDismissed(): void {
  try { localStorage.setItem(WELCOME_DISMISSED_KEY, '1'); } catch { /* storage off - just won't persist */ }
}

export type WelcomeChoice = 'brand' | 'import' | 'explore' | 'dismiss';

let openPromise: Promise<WelcomeChoice> | null = null;
// The open dialog's settle fn - lets closeWelcomeDialog() tear down through the
// same path a route change does (resolve without persisting the flag).
let settleOpen: ((choice: WelcomeChoice | null) => void) | null = null;

/** The pages of the carousel. Page 1 is the three doors, page 2 the privacy page. */
type WelcomePage = 1 | 2;
const PAGE_COUNT = 2;

// Page 1: the three doors. `withImport` gates the "Bring your design" card on the
// caller having handed over an upload-capable host (the drop router needs it for
// the library route).
function welcomeDoors(withImport: boolean): string {
  return `
    <p class="welcome-eyebrow">${t('Welcome to Lolly')}</p>
    <h2 class="welcome-title">${t('Your tools, your rules')}</h2>
    <p class="welcome-sub">${t('Finished creative assets from simple inputs - pick a path, change your mind any time.')}</p>
    <div class="welcome-cards">
      <button type="button" class="welcome-card welcome-card--brand" data-choice="brand">
        <span class="welcome-card-icon">${icon('heart', { size: 22 })}</span>
        <span class="welcome-card-kicker">${t('Make it yours')}</span>
        <span class="welcome-card-line">${t('Start from one colour or your design tokens - everything stays on this device.')}</span>
        <span class="welcome-card-cta" aria-hidden="true">${t('Set up your brand →')}</span>
      </button>
      ${withImport ? `
      <button type="button" class="welcome-card" data-choice="import">
        <span class="welcome-card-icon">${icon('filePlus', { size: 22 })}</span>
        <span class="welcome-card-kicker">${t('Bring your design')}</span>
        <span class="welcome-card-line">${t('Drop in a Figma, Penpot, InDesign or PDF file - it becomes an editable layout.')}</span>
        <span class="welcome-card-cta" aria-hidden="true">${t('Import a file →')}</span>
      </button>` : ''}
      <button type="button" class="welcome-card" data-choice="explore">
        <span class="welcome-card-icon">${icon('eye', { size: 22 })}</span>
        <span class="welcome-card-kicker">${t('Explore the community tools')}</span>
        <span class="welcome-card-line">${t('Jump straight in - QR codes, street maps, filters and more, no setup needed.')}</span>
        <span class="welcome-card-cta" aria-hidden="true">${t('Browse the gallery →')}</span>
      </button>
    </div>
    <p class="welcome-privacy">
      ${t('Everything you make stays on this device.')}
      <button type="button" class="welcome-privacy-link" data-page="2">${t('Private by design')}</button>
    </p>`;
}

// Page 2: the privacy assurance in full, ending in the "Got it" button that
// acknowledges the standalone notice (see the click handler in showWelcomeDialog).
// The copy matches views/privacy-notice.ts and docs/privacy.md - keep the three
// in step when any of them changes.
function welcomePrivacy(): string {
  return `
    <p class="welcome-eyebrow">${t('Private by design')}</p>
    <h2 class="welcome-title">${t('Your designs and files stay on this device')}</h2>
    <p class="welcome-sub">${t('No tracking, no analytics, no accounts.')}</p>
    <ul class="welcome-facts">
      <li>${t('Your documents, theme and preferences are kept in this browser only.')}</li>
      <li>${t('Exports are made here and saved wherever you choose.')}</li>
      <li>${t('Nothing is sent anywhere unless you start something that needs the internet, such as adding a Google Font.')}</li>
    </ul>
    <p class="welcome-privacy">
      <a href="${docsAppHref('trust/privacy')}" class="welcome-privacy-link">${t('What we store')}</a>
    </p>
    <button type="button" class="welcome-gotit btn btn--primary" data-ack>${t('Got it')}</button>`;
}

// The pinned footer, identical on every page: the page dots, the language row and
// the skip link. Rendering it inside the one dialog markup (rather than as its own
// node) keeps the single innerHTML sink this module is reviewed for.
// `langsOpen` is the A3 expander's state: false shows the detected language plus
// "More languages…", true shows every chip. Every control is a plain <button>, so
// they all take the global keyboard focus ring (parts/base.css).
function welcomeFoot(page: WelcomePage, langsOpen: boolean): string {
  const langs = langsOpen ? langOptions() : langOptions().filter(o => o.code === currentLang());
  const dots = [1, 2].map(n => `<button type="button" class="welcome-dot${n === page ? ' is-active' : ''}" data-page="${n}"${n === page ? ' aria-current="true"' : ''} aria-label="${t('Page {n} of {total}', { n, total: PAGE_COUNT })}"></button>`).join('');
  return `
    <div class="welcome-foot">
      <div class="welcome-dots" role="group" aria-label="${t('Pages')}">${dots}</div>
      <div class="welcome-langs" role="group" aria-label="Language">
        ${LANG_ICON_SVG}
        ${langs.map(o => {
          const flags = o.flags.length ? `<span class="welcome-lang-flags" aria-hidden="true">${o.flags.map(flagEmoji).join('')}</span>` : '';
          return `<button type="button" class="welcome-lang${o.code === currentLang() ? ' is-active' : ''}" data-lang="${o.code}" aria-pressed="${o.code === currentLang()}">${flags}${escape(o.nativeName)}</button>`;
        }).join('')}
        ${langsOpen ? '' : `<button type="button" class="welcome-lang welcome-lang-more" data-lang-more aria-expanded="false">${t('More languages…')}</button>`}
      </div>
      <button type="button" class="welcome-skip" data-choice="dismiss">${t('Skip for now')}</button>
    </div>`;
}

// Renders the dialog's own copy through t() so a language-chip switch or a page
// change can re-paint it in place (native language names and the active chip come
// from the resolved boot-time language - see i18n.ts's initI18n). The scrolling
// body and the fixed-height footer are the same two elements on both pages, so the
// dialog keeps one size for the whole run (styles/parts/welcome.css).
function renderWelcomeContent(withImport: boolean, langsOpen: boolean, page: WelcomePage): string {
  return `
    <div class="welcome-body">${page === 2 ? welcomePrivacy() : welcomeDoors(withImport)}</div>
    ${welcomeFoot(page, langsOpen)}`;
}

/**
 * Show the welcome (or return the already-open instance's promise). Resolves
 * with the user's choice; 'brand' has already navigated to #/start by the time
 * the promise settles, so callers typically don't need to act on it.
 *
 * `profileApi`, when given, lets the language chips persist a choice to the
 * canonical profile record (mirrors the profile-card picker); without it the
 * choice still applies for the session via i18n.ts's localStorage mirror.
 * `uploadHost` (the full web host) enables the "Bring your design" card, whose
 * picked file routes through lib/drop-router.ts's chooser.
 */
export function showWelcomeDialog(profileApi?: WebProfileAPI, uploadHost?: PickerHost): Promise<WelcomeChoice> {
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve) => {
    // Per-dialog, not persisted: a fresh welcome opens collapsed, on page 1.
    let langsOpen = false;
    let page: WelcomePage = 1;
    const modal = mountModal<WelcomeChoice | null>(renderWelcomeContent(!!uploadHost, langsOpen, page), {
      className: 'welcome-dialog',
      ariaLabel: 'Welcome to Lolly',
      cancelValue: 'dismiss', // Escape / backdrop click
      initialFocus: (el) => el.querySelector<HTMLElement>('.welcome-card--brand'), // lead with the brand path
      // `result` null = programmatic teardown (a navigation) - resolve without
      // persisting; every USER dismissal except the wizard path sets the flag.
      onClose: (result) => {
        // Every USER choice ends the welcome for good (audit 167 F-A5): taking a
        // door IS engagement, and re-raising the fork after a brand-room or
        // import detour read as the app forgetting the answer. Only explore /
        // dismiss also ack the privacy notice - a door-taker never saw page 2,
        // so the one-line privacy banner keeps its turn on a later visit.
        if (result === 'explore' || result === 'dismiss') { markWelcomeDismissed(); ackPrivacyNotice(); }
        else if (result === 'brand' || result === 'import') { markWelcomeDismissed(); }
        NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNav));
        settleOpen = null;
        openPromise = null;
        resolve(result ?? 'dismiss');
      },
    });
    settleOpen = (choice) => modal.close(choice);
    const onNav = (): void => modal.close(null);
    // The one in-place repaint path, shared by the language switch, the expander
    // and the page dots - `focus` is the selector to put focus back on afterwards.
    // It rewrites the contents of the SAME <dialog>, so a page change is never a
    // second modal and never re-runs the open animation.
    const repaint = (focus: string): void => {
      modal.el.innerHTML = renderWelcomeContent(!!uploadHost, langsOpen, page);
      modal.el.querySelector<HTMLElement>(focus)?.focus();
    };
    /** Move to a page and focus its first control. No-op when already there. */
    const goToPage = (next: WelcomePage): void => {
      if (next === page) return;
      page = next;
      repaint(page === 2 ? '.welcome-gotit' : '.welcome-card--brand');
    };

    modal.el.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;

      // Language chip - applies immediately (re-renders this dialog's own copy),
      // persists to the profile (if we have write access) + localStorage, and
      // deliberately does NOT settle the dialog: picking a language isn't a choice
      // about brand vs. explore.
      const langBtn = target?.closest<HTMLButtonElement>('[data-lang]');
      if (langBtn) {
        const lang = langBtn.dataset.lang as Lang;
        void (async () => {
          await setActiveLang(lang, { persist: true });
          if (profileApi) {
            try {
              const current = await profileApi.get();
              const { lang: _drop, ...rest } = current as Record<string, unknown>;
              await profileApi.set(lang === 'en' ? rest : { ...rest, lang });
            } catch { /* preference save is best-effort */ }
          }
          if (modal.el.isConnected) repaint(`[data-lang="${lang}"]`);
        })();
        return;
      }

      // "More languages…" - one-way, in place: re-render with the full row and
      // move focus into it, so the keyboard goes straight to the chips.
      if (target?.closest('[data-lang-more]')) {
        langsOpen = true;
        repaint('.welcome-lang');
        return;
      }

      // "Got it" on the privacy page: the only thing that acknowledges the
      // standalone privacy notice (views/privacy-notice.ts) - reading page 2 is
      // not enough, the user has to say so. Agreeing COMPLETES the dialog
      // (audit 167 F-A4): it used to bounce back to page 1, and "the button
      // that agrees returns you to the start" read as a loop. Anyone who still
      // wants the doors has the gallery underneath.
      if (target?.closest('[data-ack]')) {
        ackPrivacyNotice();
        modal.close('dismiss');
        return;
      }

      // Page dots (and the "Private by design" link on page 1).
      const pageBtn = target?.closest<HTMLElement>('[data-page]');
      if (pageBtn) {
        goToPage(pageBtn.dataset.page === '2' ? 2 : 1);
        return;
      }

      const card = target?.closest<HTMLElement>('[data-choice]');
      if (card) {
        const choice = card.dataset.choice as WelcomeChoice;
        modal.close(choice);
        if (choice === 'brand') window.location.hash = '#/start';
        // Both doors persist the dismissal in onClose above - a cancelled file
        // picker still counted as engaging with the fork (audit 167 F-A5).
        if (choice === 'import' && uploadHost) openDropFilePicker(uploadHost);
      }
      // Backdrop dismissal is handled by mountModal (cancelValue: 'dismiss').
    });
    NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNav));
  });
  return openPromise;
}

/** Tear down an open welcome without persisting the flag (safety hatch for hosts) - 
 *  the same non-dismissal path a route change takes. No-op when nothing is open. */
export function closeWelcomeDialog(): void {
  settleOpen?.(null);
}

/**
 * The one-time tips strip - "Every tool is a URL · works offline · nothing
 * leaves this device" - inserted just above the gallery masonry while the
 * install is unbranded and until the user dismisses it. `anchorEl` is the
 * element to insert before (the `.tool-masonry`); no-op when it's gone
 * (navigated away) or the strip was already dismissed.
 */
export function mountBrandTips(anchorEl: HTMLElement | null): void {
  if (!anchorEl || !anchorEl.isConnected) return;
  try { if (localStorage.getItem(TIPS_DISMISSED_KEY) === '1') return; }
  catch { return; } // storage off - a dismissal couldn't persist, so don't nag every visit
  if (anchorEl.parentElement?.querySelector('.brand-tips')) return; // already mounted
  const strip = document.createElement('aside');
  strip.className = 'brand-tips';
  strip.setAttribute('role', 'note');
  strip.setAttribute('aria-label', 'How Lolly works');
  strip.innerHTML = `
    <a class="brand-tips-import" href="#/start?import=1">Bring your brand: import DTCG, Tokens Studio or Penpot tokens</a>
    <p class="brand-tips-text">Every tool is a URL <span class="brand-tips-dot" aria-hidden="true">&middot;</span> works offline <span class="brand-tips-dot" aria-hidden="true">&middot;</span> nothing leaves this device</p>
    <button type="button" class="brand-tips-dismiss" aria-label="Dismiss tips">&#x2715;</button>`;
  strip.querySelector<HTMLButtonElement>('.brand-tips-dismiss')?.addEventListener('click', () => {
    try { localStorage.setItem(TIPS_DISMISSED_KEY, '1'); } catch { /* storage off */ }
    strip.remove();
  });
  anchorEl.before(strip);
}

const BRANDED_INTRO_KEY = 'lolly-branded-intro-dismissed';

/**
 * The BRANDED install's first-run strip (plans/140 S4). The welcome dialog and
 * the tips strip above are unbranded-only, so a branded first visit used to get
 * the gallery with no orientation at all beyond the What? button. Same slim
 * shape as the tips strip, shown only when the banner ladder left the slot free
 * (the gallery decides that; this module owns the surface), and settled by:
 * its ✕, or opening ANY tool (making something IS the orientation) - watched
 * via NAV_EVENTS while mounted. An install that already holds saved work needs
 * no introduction: the flag settles silently and the strip never appears
 * mid-tenure.
 */
export async function mountBrandedIntro(
  anchorEl: HTMLElement | null,
  state?: { list?: () => Promise<unknown[]> },
): Promise<boolean> {
  if (!anchorEl || !anchorEl.isConnected) return false;
  try { if (localStorage.getItem(BRANDED_INTRO_KEY) === '1') return false; }
  catch { return false; } // storage off - a dismissal couldn't persist, so don't nag every visit
  const settle = (): void => { try { localStorage.setItem(BRANDED_INTRO_KEY, '1'); } catch { /* storage off */ } };
  try {
    const slots = await state?.list?.();
    if (slots && slots.length > 0) { settle(); return false; }
  } catch { /* state unavailable - fall through and show the strip */ }
  if (!anchorEl.isConnected) return false; // navigated away while the state check ran
  if (anchorEl.parentElement?.querySelector('.brand-tips')) return false; // one strip only
  const strip = document.createElement('aside');
  strip.className = 'brand-tips brand-tips--intro';
  strip.setAttribute('role', 'note');
  strip.setAttribute('aria-label', 'Getting started');
  strip.innerHTML = `
    <p class="brand-tips-text">Your brand is loaded <span class="brand-tips-dot" aria-hidden="true">&middot;</span> pick a template, make it yours, export on brand <span class="brand-tips-dot" aria-hidden="true">&middot;</span> <a href="${docsAppHref('start/quickstart')}">Quickstart</a></p>
    <button type="button" class="brand-tips-dismiss" aria-label="Dismiss">&#x2715;</button>`;
  // One scope owns the strip's listeners: dispose releases them all, so a
  // teardown path can never forget one (lib/dispose.ts).
  const scope = createScope();
  const onNav = (): void => {
    // Opening a tool is the strip's own advice taken - settle without requiring the ✕.
    if (location.pathname.startsWith('/t/') || location.hash.startsWith('#/tool')) {
      settle();
      teardown();
    }
    if (!strip.isConnected) teardown(); // the gallery unmounted - stop listening either way
  };
  const teardown = (): void => {
    scope.dispose();
    strip.remove();
  };
  NAV_EVENTS.forEach(ev => scope.listen(window, ev, onNav));
  strip.querySelector<HTMLButtonElement>('.brand-tips-dismiss')?.addEventListener('click', () => { settle(); teardown(); });
  anchorEl.before(strip);
  return true;
}
