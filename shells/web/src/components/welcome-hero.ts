// SPDX-License-Identifier: MPL-2.0
/**
 * The first-visit greeting, in place: the gallery's opening frame rather than a
 * dialog over it (Andy approved the design on 2026-11-09). Lolly hands you a
 * lollipop: one short branded gesture, one sentence, one obvious next step, and the
 * gallery itself under it, loading as it would on any visit.
 *
 *   The mark       the swirl lollipop draws its line, closes into a shape and fills
 *                  with colour, once (under 1.5 s), the first time the band is in
 *                  view, and never on a later visit. Under Reduce motion it is simply
 *                  the finished mark.
 *   The sentence   "Make the next thing beautiful." The brand already says this on
 *                  the featured poster, so the greeting and the product agree.
 *   One action     chosen by who is visiting: on a shipped design system (Lolly
 *                  Demo, lolly.tools) "Start making" opens Design on the lorikeet
 *                  poster (its brand-starter template); on a blank install "Make it yours" opens Design System
 *                  Setup, because there the brand is the point.
 *   The lorikeet   perches by that button and turns to look at it
 *                  (components/fauna-art.ts), which is what the drawings are for.
 *   Quiet lines    bring a file, the other audience's path, the privacy promise with
 *                  its "What we store" link, and a language chip only when the
 *                  detected language may be wrong.
 *
 * What it keeps from the dialog (components/welcome-dialog.ts, still reachable at
 * #/?welcome=classic): the gate rules (views/gallery-welcome.ts decides who sees
 * it), any explicit choice settles the welcome for good, a route change is not a
 * dismissal, Escape and the close button dismiss, the language choice persists, the
 * file path is the drop router's. Every explicit choice also acknowledges the
 * privacy notice, because the promise is on the band itself.
 *
 * Maintenance waits (lib/welcome-gate.ts) only while the mark draws, and never more
 * than MAX_HOLD_MS: a greeting in place can stay on the page for a whole visit, and
 * background work must not wait that long. The gallery's previews do not wait at all.
 *
 * The greeting is a card that floats over the top of the gallery (Andy, 2026-11-13:
 * floating, easy to dismiss, lit like an object). Three ways put it away: the close
 * button, Escape, and on a touch screen a sideways swipe. When it goes, it fades and
 * the space it held closes, so the gallery slides up rather than jumping.
 *
 * Singleton, like the dialog: the gallery re-mounts after a catalog sync, and a
 * second call while the greeting is up moves the same element into the new gallery
 * and hands back the same promise, so the mark does not draw twice.
 */
import '../styles/parts/welcome-hero.css';
import { currentLang, langOptions, setActiveLang, t, LANG_ICON_SVG, flagEmoji } from '../i18n.ts';
import type { Lang } from '../i18n.ts';
import { escape as escapeHtml, NAV_EVENTS, safeHref } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import type { WebProfileAPI } from '../bridge/profile.ts';
import type { PickerHost } from '../views/picker.ts';
import { openDropFilePicker } from '../lib/drop-file-picker.ts';
import { holdWelcomeGate, markWelcomeDismissed } from '../lib/welcome-gate.ts';
import { APPROVED_FAUNA, hydrateFauna } from './fauna-art.ts';

/** Who the greeting is for: a shipped design system to try, or a blank install to brand. */
export type WelcomeAudience = 'demo' | 'blank';
/** How the greeting ended. `make` and `brand` have already navigated when the promise settles. */
export type HeroChoice = 'make' | 'brand' | 'import' | 'explore' | 'dismiss';

/** Set once the mark has drawn, so a later visit shows it finished. */
const DRAWN_KEY = 'lolly-welcome-mark-drawn';
/** How long the drawing runs, with a moment after (welcome-hero.css adds up to 1.2 s). */
const INTRO_MS = 1600;
/** The longest maintenance waits for the greeting, whether or not the band came into view. */
const MAX_HOLD_MS = 4000;
/** The longest a leaving card stays in the page if its animation never reports an end. */
const LEAVE_MAX_MS = 900;
/** How far a swipe travels, as a share of the card's width, before letting go dismisses. */
const SWIPE_SHARE = 0.3;
/** A quicker flick than this (pixels per millisecond) dismisses however short it was. */
const SWIPE_FLICK = 0.6;

let openPromise: Promise<HeroChoice> | null = null;
let current: { el: HTMLElement; close: (choice: HeroChoice | null) => void; settle: () => void } | null = null;

/** The lollipop's swirl: an Archimedean spiral from the centre out, about three turns. */
function swirlPath(cx: number, cy: number, radius: number, turns: number): string {
  const steps = 96;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const along = i / steps;
    const angle = along * turns * Math.PI * 2;
    const r = along * radius;
    parts.push(`${i ? 'L' : 'M'}${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return parts.join('');
}

/** The mark: a stick, a round candy and its swirl, each drawn as one line (see welcome-hero.css). */
function markSvg(): string {
  return `<svg class="welcome-hero-mark" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <path class="whm-stick" d="M76 76L106 106" pathLength="1"/>
    <circle class="whm-candy" cx="50" cy="50" r="38" pathLength="1"/>
    <path class="whm-swirl" d="${swirlPath(50, 50, 31, 3.2)}" pathLength="1"/>
  </svg>`;
}

/** Whether the detected language may be wrong: the browser's first language is not the one in use. */
export function languageMayBeWrong(): boolean {
  const first = (globalThis.navigator?.languages?.[0] ?? globalThis.navigator?.language ?? '').toLowerCase().split('-')[0];
  return !!first && first !== currentLang().toLowerCase().split('-')[0];
}

/** The privacy promise the band carries, and where "What we store" leads. */
export interface WelcomePrivacy { text: string; href: string }

/** The quiet privacy line. The caller words it (views/gallery-welcome.ts, from the notice). */
function privacyLine(p: WelcomePrivacy): string {
  // The link is the caller's, so its scheme is checked before it reaches the page.
  // nosemgrep: lolly-href-escape-is-not-scheme-validation -- gated by safeHref() on this line
  const link = safeHref(p.href) ? ` <a href="${escapeHtml(p.href)}">${t('What we store')}</a>` : '';
  return `${escapeHtml(p.text)}${link}`;
}

function languageRow(open: boolean): string {
  if (!open) {
    const here = langOptions().find(o => o.code === currentLang());
    return `<button type="button" class="welcome-hero-chip" data-lang-more aria-expanded="false">${LANG_ICON_SVG}<span>${escapeHtml(here?.nativeName ?? currentLang())}</span><span class="welcome-hero-dim">${t('Change')}</span></button>`;
  }
  return `<span class="welcome-hero-langs" role="group" aria-label="${t('Language')}">${langOptions().map(o => {
    const flags = o.flags.length ? `<span aria-hidden="true">${o.flags.map(flagEmoji).join('')}</span>` : '';
    return `<button type="button" class="welcome-hero-chip${o.code === currentLang() ? ' is-active' : ''}" data-lang="${o.code}" aria-pressed="${o.code === currentLang()}">${flags}${escapeHtml(o.nativeName)}</button>`;
  }).join('')}</span>`;
}

/** The greeting's markup, painted again in place when the language changes. */
function heroMarkup(audience: WelcomeAudience, withImport: boolean, langsOpen: boolean, privacy: WelcomePrivacy): string {
  const primary = audience === 'demo'
    ? `<button type="button" class="btn btn--primary welcome-hero-go" data-choice="make">${t('Start making')}</button>`
    : `<button type="button" class="btn btn--primary welcome-hero-go" data-choice="brand">${t('Make it yours')}<span class="welcome-hero-go-sub">${t('One colour is enough')}</span></button>`;
  const other = audience === 'demo'
    ? `<button type="button" class="welcome-hero-link" data-choice="brand">${t('Make it yours')}</button>`
    : `<button type="button" class="welcome-hero-link" data-choice="explore">${t('Explore the tools')}</button>`;
  const file = withImport ? `<button type="button" class="welcome-hero-link" data-choice="import">${t('Bring a file')}</button>` : '';
  return `
    <button type="button" class="welcome-hero-close" data-choice="dismiss" aria-label="${t('Close the welcome')}">${icon('close', { size: 18 })}</button>
    <div class="welcome-hero-lead">
      ${markSvg()}
      <h2 class="welcome-hero-title" id="welcome-hero-title">${t('Make the next thing beautiful.')}</h2>
    </div>
    <div class="welcome-hero-act">
      <div class="welcome-hero-perch">
        <span class="fauna-slot welcome-hero-bird" data-fauna="lorikeet" data-fauna-watch=".welcome-hero-go" data-fauna-key="welcome-hero" aria-hidden="true"></span>
        ${primary}
      </div>
      <p class="welcome-hero-more">${[file, other].filter(Boolean).join('<span aria-hidden="true">·</span>')}</p>
    </div>
    <p class="welcome-hero-quiet">${privacyLine(privacy)}${languageMayBeWrong() || langsOpen ? ` ${languageRow(langsOpen)}` : ''}</p>`;
}

/**
 * Take the card out of the page. With motion on, the card fades first and then the
 * space it held closes; the class changes at once, so the greeting counts as gone
 * (a query for `.welcome-hero` finds nothing) while the card animates away.
 */
function leave(el: HTMLElement, animate: boolean): void {
  if (!animate || !el.isConnected || prefersReducedMotion()) { el.remove(); return; }
  el.style.setProperty('--wh-h', `${el.offsetHeight}px`);
  el.className = 'welcome-hero-leaving';
  const done = (): void => { clearTimeout(timer); el.remove(); };
  const timer = setTimeout(done, LEAVE_MAX_MS);
  el.addEventListener('animationend', (e) => { if (e.target === el) done(); });
}

/**
 * A sideways swipe on a touch screen puts the card away. The card follows the
 * finger and fades as it goes; let go past a third of its width, or with a flick,
 * and it leaves that way; anything less and it settles back. Taps still reach the
 * buttons: the card only takes the gesture once it is clearly sideways.
 */
function wireSwipe(card: HTMLElement, dismiss: () => void): void {
  let id: number | null = null;
  let x0 = 0; let y0 = 0; let t0 = 0; let dx = 0; let dragging = false;
  const reset = (): void => { id = null; dragging = false; dx = 0; };
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || id !== null) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = e.timeStamp; dx = 0; dragging = false;
  });
  card.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0; const my = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { reset(); return; }
      if (Math.abs(mx) < 10) return;
      dragging = true;
      card.classList.remove('is-settling');
      card.setPointerCapture(e.pointerId);
    }
    dx = mx;
    card.style.translate = `${dx}px 0`;
    card.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / card.offsetWidth));
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== id) return;
    const wasDragging = dragging;
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - t0);
    const out = wasDragging && e.type === 'pointerup'
      && (Math.abs(dx) > card.offsetWidth * SWIPE_SHARE || speed > SWIPE_FLICK);
    const sign = Math.sign(dx) || 1;
    reset();
    if (!wasDragging) return;
    // The click that ends a drag is not a tap on whatever was under the finger.
    // The browser sends it straight after pointerup, so the guard comes off on the next task.
    const swallow = (c: Event): void => { c.stopPropagation(); c.preventDefault(); };
    card.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => card.removeEventListener('click', swallow, { capture: true }), 0);
    card.classList.add('is-settling');
    if (out) {
      card.classList.add('is-flung');
      card.style.translate = `${sign * 110}% 0`;
      card.style.opacity = '0';
      dismiss();
    } else {
      card.style.translate = '';
      card.style.opacity = '';
    }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

/**
 * Show the greeting at the top of `root` (the gallery), or move the one already up
 * there. Resolves with how it ended; a route change resolves 'dismiss' without
 * settling anything, as the dialog does.
 */
export function showWelcomeHero(
  root: HTMLElement,
  opts: {
    audience: WelcomeAudience; privacy: WelcomePrivacy;
    /** Acknowledge the privacy notice: every explicit choice does, since the band carries the promise. */
    ackPrivacy: () => void;
    profileApi?: WebProfileAPI; uploadHost?: PickerHost;
  },
): Promise<HeroChoice> {
  if (openPromise && current) {
    adoptWelcomeHero(root);
    return openPromise;
  }
  const releaseGate = holdWelcomeGate();
  const holdTimer = setTimeout(releaseGate, MAX_HOLD_MS);
  const pending = new Promise<HeroChoice>((resolve) => {
    let langsOpen = false;
    const el = document.createElement('section');
    el.className = 'welcome-hero';
    el.setAttribute('aria-labelledby', 'welcome-hero-title');
    // The section places the card; the card is the floating surface, painted in place.
    const card = document.createElement('div');
    card.className = 'welcome-hero-card';
    el.append(card);
    // The card rises in once. Moving the element to a re-mounted gallery would
    // restart that, so once it has arrived it stays arrived.
    card.addEventListener('animationend', (e) => {
      if (e.target === card && e.animationName === 'wh-arrive') el.classList.add('is-arrived');
    });
    let drawn = false;
    try { drawn = localStorage.getItem(DRAWN_KEY) === '1'; } catch { drawn = true; }
    // The mark draws once, when the band is first in view: a finished mark from the
    // start on a later visit, under Reduce motion, or where nothing can tell when the
    // band is seen.
    let drawTimer: ReturnType<typeof setTimeout> | undefined;
    let seen: IntersectionObserver | null = null;
    const settle = (): void => {
      clearTimeout(drawTimer);
      seen?.disconnect();
      el.classList.remove('is-drawing');
      el.classList.add('is-settled');
      try { localStorage.setItem(DRAWN_KEY, '1'); } catch { /* storage off: it draws again next time */ }
      releaseGate();
    };
    const paint = (focus?: string): void => {
      card.innerHTML = heroMarkup(opts.audience, !!opts.uploadHost, langsOpen, opts.privacy);
      hydrateFauna(card, { only: APPROVED_FAUNA });
      if (focus) card.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
    };
    paint();
    root.prepend(el);
    if (drawn || prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
      settle();
    } else {
      seen = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        seen?.disconnect();
        el.classList.add('is-drawing');
        drawTimer = setTimeout(settle, INTRO_MS);
      }, { threshold: 0.5 });
      seen.observe(el);
    }

    const close = (choice: HeroChoice | null): void => {
      if (!current) return;
      current = null;
      openPromise = null;
      clearTimeout(holdTimer);
      clearTimeout(drawTimer);
      seen?.disconnect();
      releaseGate();
      for (const ev of NAV_EVENTS) window.removeEventListener(ev, onNav);
      document.removeEventListener('keydown', onKey);
      // Every explicit choice settles the welcome, and the band carried the privacy
      // promise, so each also acknowledges the notice. A route change does neither.
      if (choice) { markWelcomeDismissed(); opts.ackPrivacy(); }
      // A choice that stays on the gallery animates away; one that navigates, or a
      // route change, goes at once, since the gallery is leaving too.
      leave(el, choice === 'dismiss' || choice === 'import' || choice === 'explore');
      resolve(choice ?? 'dismiss');
    };
    current = { el, close, settle };
    const onNav = (): void => close(null);
    const onKey = (e: KeyboardEvent): void => {
      // Escape dismisses the greeting, unless another dialog is open above the page.
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) close('dismiss');
    };
    for (const ev of NAV_EVENTS) window.addEventListener(ev, onNav);
    document.addEventListener('keydown', onKey);
    wireSwipe(card, () => close('dismiss'));

    el.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const langBtn = target?.closest<HTMLButtonElement>('[data-lang]');
      if (langBtn) {
        const lang = langBtn.dataset.lang as Lang;
        void (async () => {
          await setActiveLang(lang, { persist: true });
          if (opts.profileApi) {
            try {
              const saved = await opts.profileApi.get();
              const { lang: _drop, ...rest } = saved as Record<string, unknown>;
              await opts.profileApi.set(lang === 'en' ? rest : { ...rest, lang });
            } catch { /* the preference save is best-effort */ }
          }
          langsOpen = false;
          if (el.isConnected) paint('.welcome-hero-go');
        })();
        return;
      }
      if (target?.closest('[data-lang-more]')) {
        langsOpen = true;
        paint('[data-lang]');
        return;
      }
      const chosen = target?.closest<HTMLElement>('[data-choice]');
      if (!chosen) return;
      const choice = chosen.dataset.choice as HeroChoice;
      close(choice);
      if (choice === 'make') window.location.hash = '#/tool/design?template=brand-starter';
      else if (choice === 'brand') window.location.hash = '#/start';
      else if (choice === 'import' && opts.uploadHost) openDropFilePicker(opts.uploadHost);
    });
    // Focus stays where the page put it: the band is part of the page, not a modal, so
    // the keyboard reaches its action in reading order, first after the navigation.
  });
  openPromise = pending;
  return pending;
}

/**
 * Move an open greeting into a gallery that has just mounted, in the same task as the
 * gallery's markup, so the band never leaves the screen while the welcome step catches
 * up. Moving an element restarts its CSS animations, so a drawing caught mid-way is
 * shown finished instead of drawn twice. A no-op when no greeting is open.
 */
export function adoptWelcomeHero(root: HTMLElement | null): void {
  if (!root || !current || current.el.parentElement === root) return;
  if (current.el.classList.contains('is-drawing')) current.settle();
  current.el.classList.add('is-arrived');
  root.prepend(current.el);
}

/** Take the greeting down without settling it (a host's safety hatch, and the tests'). */
export function closeWelcomeHero(): void {
  current?.close(null);
}
