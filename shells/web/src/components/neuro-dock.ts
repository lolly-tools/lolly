// SPDX-License-Identifier: MPL-2.0
/**
 * Neurospicy music source - registers the music/radio/atmosphere/visualiser player into
 * the app-global SINGLETON audio dock (lib/audio-dock-singleton.ts) while Neurospicy Mode
 * is on. There is ONE window app-wide: this module feeds the MUSIC side of it, and the
 * docs reader (views/docs.ts) feeds the NARRATION side; the two coexist in that one
 * draggable/resizable device rather than as two separate windows.
 *
 * This module keeps ONLY the neuro-specific lifecycle it always owned - flag-gated
 * register/unregister, the spring-in entrance + confetti, and the close (×) semantics
 * (leave the mode). Everything shell-shaped (DOM, drag/resize/collapse, placement, the
 * collapse pref) now lives in the singleton. The music `DockHost` itself is built by
 * lib/neurospicy-dock-host.ts from the untouched engine (lib/neurospicy.ts).
 *
 * Dismissals:
 *   - minimize: collapse to the Mini pill (music keeps playing); click the pill to expand.
 *   - close (×): turn the mode off (stops the music, releases the visualiser); the window
 *     hides unless the narration reader is still registered. Re-enable from Sound settings.
 */
import { createNeurospicyDockHost, type NeurospicyDockHandle } from '../lib/neurospicy-dock-host.ts';
import {
  registerMusicSource, unregisterMusicSource, audioDockController, audioDockElement, audioDockWobble, isAudioDockVisible,
} from '../lib/audio-dock-singleton.ts';
import { getNeurospicy, setNeurospicyEnabled, stopNeurospicy, type NeurospicyHost } from '../lib/neurospicy.ts';
import { flagEnabledSync } from '../feature-flags.ts';
import { setNeuroDockCollapsed } from '../lib/neuro-dock-pref.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { wobblyActive } from '../lib/wobble.ts';

let dockHandle: NeurospicyDockHandle | null = null;

function ensureHandle(host: NeurospicyHost): NeurospicyDockHandle {
  if (!dockHandle) dockHandle = createNeurospicyDockHost(host as Parameters<typeof createNeurospicyDockHost>[0]);
  return dockHandle;
}

/** Detach the music block from the shared window and release its WebGL context. Keeps the
 *  adapter (event subscriptions) alive so a re-enable re-registers cheaply. */
function releaseMusic(): void {
  dockHandle?.host.viz?.unmount?.();   // release the visualiser's GL before detaching
  unregisterMusicSource();
}

/** Close (×): leave the mode. Stops the music immediately, releases the visualiser, and
 *  detaches the music block (the window hides unless narration remains). */
function closeMode(host: NeurospicyHost): void {
  stopNeurospicy();
  void setNeurospicyEnabled(host, false);
  releaseMusic();
}

/** Options for showNeuroDock/syncNeuroDock. The legacy boolean form still means
 *  `{ animateIn }` - sound-toggle.ts passes it straight through. */
export interface NeuroDockShowOpts {
  /** Spring the window up from the corner with a confetti burst (mode just enabled). */
  animateIn?: boolean;
  /** Show expanded regardless of the collapsed pref - WITHOUT writing the pref (the
   *  ?neuro demo must not persist anything). A user's own minimize afterwards still works. */
  forceExpanded?: boolean;
}
function normShowOpts(o: boolean | NeuroDockShowOpts): NeuroDockShowOpts {
  return typeof o === 'boolean' ? { animateIn: o } : o;
}

/** Register the music source and show the shared window. When `animateIn` (the mode was
 *  just switched on) spring it up and pop a confetti burst to point the eye at it. */
export function showNeuroDock(host: NeurospicyHost, opts: boolean | NeuroDockShowOpts = false): void {
  if (typeof document === 'undefined') return;
  const { animateIn = false, forceExpanded = false } = normShowOpts(opts);
  const wasVisible = isAudioDockVisible();
  ensureHandle(host);
  const ctrl = registerMusicSource({ host: dockHandle!.host, onClose: () => closeMode(host) });
  const el = audioDockElement();
  if (!el) return;
  // Expand in place for a window that already existed collapsed.
  if (forceExpanded && ctrl.getCollapse() === 'mini') ctrl.setCollapse('full');
  if (animateIn && !wasVisible && !prefersReducedMotion()) {
    // The ONE spot we read the flag: a wobbly entrance REPLACES the CSS spring-in, so the
    // panel never plays two entrance animations at once. Flag off ⇒ today's CSS entrance.
    if (wobblyActive()) {
      audioDockWobble()?.wobbleIn();
    } else {
      el.classList.remove('is-entering');
      void el.offsetWidth; // reflow so the animation restarts on a repeat enable
      el.classList.add('is-entering');
      el.addEventListener('animationend', () => el.classList.remove('is-entering'), { once: true });
    }
    const r = el.getBoundingClientRect();
    void import('../lib/particles.ts').then((m) =>
      m.celebrateBurst(r.left + r.width / 2, r.top + r.height / 2,
        host as unknown as import('../lib/particles.ts').ChipPairsHost));
  }
}

/** Detach the music source (mode off). The window hides unless narration is still shown. */
export function hideNeuroDock(): void {
  releaseMusic();
}

/** Re-show + expand the music player - the "Show player" action for a mobile-hidden pill. */
export function reopenNeuroDock(host: NeurospicyHost): void {
  setNeuroDockCollapsed(false);
  showNeuroDock(host);
  audioDockController()?.setCollapse('full');
  audioDockController()?.refresh();
}

/** Show the shared window in the EXPANDED (draggable + resizable) window - used by the
 *  ?neuro=viz demo capture (fullscreen needs a user gesture a capture doesn't have). */
export function openNeuroDockExpanded(host: NeurospicyHost): void {
  showNeuroDock(host, { animateIn: false, forceExpanded: true });
  audioDockController()?.setCollapse('expanded');
  audioDockController()?.refresh();
}

/** Show or hide the music source to match state: visible only when the feature flag is on
 *  AND the mode is enabled. Call at boot and whenever the mode is toggled. */
export function syncNeuroDock(host: NeurospicyHost, opts: boolean | NeuroDockShowOpts = false): void {
  if (flagEnabledSync('neurospicy') && getNeurospicy().enabled) showNeuroDock(host, opts);
  else hideNeuroDock();
}
