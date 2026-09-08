// SPDX-License-Identifier: MPL-2.0
/**
 * Sound toggle - the interface-sound (sfx) on/off control, in the two presentations the
 * theme control uses so it can sit wherever settings live:
 *
 *   createSoundToggle(host)          → an icon-only button for the canvas zoom HUD
 *                                      (.stage-nav), beside the theme toggle.
 *   soundSegmentHtml() / wireSound…  → an On/Off segment for the gallery / catalogue /
 *                                      Projects view-options popovers.
 *
 * The mute flag lives in lib/sfx.ts (in-memory + localStorage mirror); the PROFILE is the
 * canonical store, exactly like the theme (an undeclared `sfxMuted` field on the record).
 * Turning sound back ON plays a short confirming chirp; turning it off stays silent.
 */
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { isSfxMuted, setSfxMuted, playSfx } from '../lib/sfx.ts';
import { getNeurospicy, setNeurospicyEnabled, applyNeurospicy } from '../lib/neurospicy.ts';
import { applyAtmosphere } from '../lib/atmosphere.ts';
// The dock itself (and, through it, components/music-player.ts) is dynamic-imported:
// every use below is inside a click handler or a post-render sync, and the module
// would otherwise sit on the boot path for every visitor - including the majority
// who have never turned Neurospicy on.
const neuroDock = () => import('./neuro-dock.ts');
import { flagEnabledSync } from '../feature-flags.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** The slice of the host this control needs - the profile record it spreads + persists. */
interface SoundToggleHost {
  profile: {
    get(): Promise<object>;
    set(profile: object): Promise<unknown>;
  };
}
/** The switch surface also drives Neurospicy Mode, which needs host.assets (loop list + bytes). */
type NeuroHost = SoundToggleHost & Pick<HostV1, 'assets'>;

// A heartbeat/waveform - the "beat" behind Neurospicy Mode's focus loop. Path data
// lives in lib/icons.ts as 'neuroBeat' - deduped against neuro-dock.ts's identical NOTE glyph.
const NEURO_ICON = icon('neuroBeat', { size: 22 });
const ICON_ON = icon('volumeOn', { size: 16 });
const ICON_OFF = icon('volumeOff', { size: 16 });

/**
 * Apply + persist a new mute state everywhere: the in-memory flag + localStorage mirror
 * (via setSfxMuted), and the profile (canonical, best-effort). Plays the confirming chirp
 * when enabling. Exported so bespoke settings surfaces (e.g. the profile page) can reuse it.
 */
export async function applySfxMuted(host: SoundToggleHost, muted: boolean): Promise<void> {
  setSfxMuted(muted);
  if (!muted) playSfx('toggle');
  // Master mute: stop the Neurospicy focus loop when muting, resume it (if still enabled) when
  // un-muting. The runtime host is the full WebHost (has assets), so the cast is safe.
  void applyNeurospicy(host as unknown as Parameters<typeof applyNeurospicy>[0]);
  // Same master-mute contract for the Atmosphere beds: muting stops them, un-muting
  // brings back exactly the layers that were up.
  applyAtmosphere(host);
  try {
    const profile = await host.profile.get();
    await host.profile.set({ ...profile, sfxMuted: muted });
  } catch { /* preference save is best-effort */ }
}

/**
 * Icon-only toggle for the stage-nav zoom HUD, styled like the theme toggle it sits with.
 * No `data-nav` attribute, so the HUD's zoom-click delegation ignores it.
 */
export function createSoundToggle(host: SoundToggleHost): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'stage-nav-btn stage-nav-sound';
  const paint = () => {
    const on = !isSfxMuted();
    btn.innerHTML = on ? ICON_ON : ICON_OFF;
    btn.dataset.on = on ? 'true' : 'false';
    const label = on ? t('Interface sounds: on - mute') : t('Interface sounds: off - unmute');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = label;
  };
  paint();
  btn.addEventListener('click', async () => {
    await applySfxMuted(host, !isSfxMuted());
    paint();
  });
  return btn;
}

// The one on/off presentation used everywhere sound is a labelled setting (view-option
// popovers + the Profile page): a big speaker indicator, the word "Sound:", then a sliding
// switch whose knob animates left (off) → right (on). role="switch" + aria-checked make it a
// real toggle for AT; the knob/track transition is pure CSS. Style is injected once (below)
// so this control is self-contained and needs no edit to a shared stylesheet.
const SWITCH_STYLE_ID = 'lolly-sound-switch-styles';
const SWITCH_CSS = `
.sound-switch { display: inline-flex; align-items: center; gap: 9px; }
.sound-switch-icon { display: inline-flex; color: hsl(var(--muted-foreground)); transition: color .2s ease; }
.sound-switch-icon svg { width: 22px; height: 22px; }          /* the "big" speaker indicator */
.sound-switch[data-on="true"] .sound-switch-icon { color: hsl(var(--foreground)); }
.sound-switch-label { font-weight: 600; font-size: .9rem; color: hsl(var(--foreground)); }
.sound-switch-track {
  position: relative; flex-shrink: 0; width: 46px; height: 26px; padding: 0; border: none;
  border-radius: var(--radius); cursor: pointer; background: hsl(var(--muted));
  transition: background .2s ease;
}
.sound-switch-track[aria-checked="true"] { background: hsl(var(--primary)); }
.sound-switch-knob {
  position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: var(--radius);
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35);
  transition: transform .22s cubic-bezier(.2,.7,.3,1);
}
.sound-switch-track[aria-checked="true"] .sound-switch-knob { transform: translateX(20px); }
.sound-switch-track:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .sound-switch-knob, .sound-switch-track, .sound-switch-icon { transition: none; }
}
/* And for the app's own preference (data-a11y-motion, lib/a11y-prefs.ts) -
   parts/base.css leaves transitions alone by design, so this has to repeat. */
html[data-a11y-motion="reduce"] :is(.sound-switch-knob, .sound-switch-track, .sound-switch-icon) { transition: none; }
/* Neurospicy sits directly under Sound as ONE group - no dividing rule between them; the loop
   picker + volume tuck underneath its own switch. */
.neurospicy { display: flex; flex-direction: column; gap: 9px; margin-top: 9px; transition: opacity .18s ease; }
/* Sound is the master switch: while it's muted, Neurospicy reads as off + dimmed and can't be
   toggled until sound is turned back on. */
.neurospicy.is-muted { opacity: .45; pointer-events: none; }
/* Not a primary-fill button (component audit rec 2 named it as one - stale: it
   fills with --card/--foreground, a quiet secondary treatment, not --primary/
   --primary-foreground), so it's left off buttons.css's .btn--primary alias list. */
.neuro-show-btn { align-self: flex-start; margin-left: 31px; padding: 5px 12px; border-radius: var(--radius); border: 1px solid hsl(var(--border)); background: hsl(var(--card)); color: hsl(var(--foreground)); font-size: .82rem; font-weight: 600; cursor: pointer; }
.neuro-show-btn:hover { background: hsl(var(--muted)); }
.neuro-show-btn:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }`;
function ensureSoundSwitchStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(SWITCH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SWITCH_STYLE_ID;
  style.textContent = SWITCH_CSS;
  document.head.appendChild(style);
}

/**
 * The unified "Sound:" switch - a speaker indicator + label + sliding on/off toggle. Returned
 * as HTML; wire with wireSoundSwitch once it's in the DOM. Self-styling (injects its CSS on
 * first build), so it drops into any settings surface unchanged.
 */
export function soundSwitchHtml(): string {
  ensureSoundSwitchStyles();
  const on = !isSfxMuted();
  return `<div class="sound-switch" data-sound-switch-root data-on="${on}">
      <span class="sound-switch-icon">${on ? ICON_ON : ICON_OFF}</span>
      <span class="sound-switch-label">${t('Sound')}:</span>
      <button type="button" class="sound-switch-track" role="switch" aria-checked="${on}" aria-label="${t('Interface sounds')}" data-sound-switch>
        <span class="sound-switch-knob"></span>
      </button>
    </div>${flagEnabledSync('neurospicy') ? neurospicyHtml() : ''}`;
}

// Neurospicy Mode - a background focus BEAT that loops while you use the app: a switch (like
// Sound), then a loop picker + volume. Rendered alongside soundSwitchHtml so it appears
// everywhere the sound on/off toggle does. The <select> is filled from the catalog in
// wireNeurospicy (async), so this stays a synchronous HTML string.
function neurospicyHtml(): string {
  const ns = getNeurospicy();
  const muted = isSfxMuted();
  const on = ns.enabled && !muted;   // shows OFF (and dimmed) while sound is muted - see .is-muted
  return `<div class="neurospicy${muted ? ' is-muted' : ''}" data-neurospicy-root>
      <div class="sound-switch" data-on="${on}">
        <span class="sound-switch-icon">${NEURO_ICON}</span>
        <span class="sound-switch-label">${t('Neurospicy')}:</span>
        <button type="button" class="sound-switch-track" role="switch" aria-checked="${on}" aria-label="${t('Neurospicy Mode - a looping focus beat')}" data-neurospicy-switch>
          <span class="sound-switch-knob"></span>
        </button>
      </div>
    </div>`;
}

/**
 * Wire a soundSwitchHtml() block within `root`: the switch applies + persists the choice and
 * animates in place (knob + speaker indicator both track the new state). stopPropagation keeps
 * a host popover from treating the click as a select/dismiss. Call once after it's in the DOM.
 */
export function wireSoundSwitch(root: ParentNode, host: NeuroHost): void {
  ensureSoundSwitchStyles();
  wireNeurospicy(root, host);
  const wrap = root.querySelector<HTMLElement>('[data-sound-switch-root]');
  const btn = root.querySelector<HTMLButtonElement>('[data-sound-switch]');
  const icon = wrap?.querySelector<HTMLElement>('.sound-switch-icon');
  if (!wrap || !btn) return;
  const paint = (): void => {
    const on = !isSfxMuted();
    wrap.dataset.on = String(on);
    btn.setAttribute('aria-checked', String(on));
    if (icon) icon.innerHTML = on ? ICON_ON : ICON_OFF;
    paintNeurospicy(root);   // master mute greys out + switches off the Neurospicy control too
  };
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await applySfxMuted(host, !isSfxMuted());
    paint();
  });
}

/** Repaint the Neurospicy control from its state + the master (sfx) mute: OFF and dimmed
 *  (.is-muted, non-interactive) while sound is muted; its real enabled state when sound is on. */
function paintNeurospicy(root: ParentNode): void {
  const wrap = root.querySelector<HTMLElement>('[data-neurospicy-root]');
  if (!wrap) return;
  const muted = isSfxMuted();
  const on = getNeurospicy().enabled && !muted;
  wrap.classList.toggle('is-muted', muted);
  wrap.querySelector<HTMLElement>('.sound-switch')?.setAttribute('data-on', String(on));
  wrap.querySelector<HTMLButtonElement>('[data-neurospicy-switch]')?.setAttribute('aria-checked', String(on));
}

// Wire the Neurospicy block: the switch enables/disables the mode; the actual
// player lives in the bottom-right toast dock (neuro-dock.ts), shown/hidden here
// to match. stopPropagation keeps a host popover from treating the click as a dismiss.
function wireNeurospicy(root: ParentNode, host: NeuroHost): void {
  const wrap = root.querySelector<HTMLElement>('[data-neurospicy-root]');
  if (!wrap) return;
  const sw = wrap.querySelector<HTMLButtonElement>('[data-neurospicy-switch]');
  const swWrap = sw?.closest<HTMLElement>('.sound-switch');
  paintNeurospicy(root);   // sync the initial dimmed/off look to the current mute state
  // If the mode is already on, the dock should already be showing. Skipped entirely
  // when it is off - syncNeuroDock's else-branch is hideNeuroDock(), a no-op for a
  // dock that was never built, so not importing is exactly equivalent.
  if (getNeurospicy().enabled) void neuroDock().then(m => m.syncNeuroDock(host));
  // Repaint whenever the shared enabled state changes elsewhere (e.g. the dock's close
  // button). Popovers get rebuilt/rewired each time they open, so self-unhook once this
  // instance's root is no longer in the document instead of leaking one listener per open.
  const onEnabledChange = (): void => {
    if (!wrap.isConnected) { document.removeEventListener('lolly:neuro-enabled', onEnabledChange); return; }
    paintNeurospicy(root);
  };
  document.addEventListener('lolly:neuro-enabled', onEnabledChange);
  sw?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (isSfxMuted()) return;   // sound is the master switch - turn it on first (also .is-muted blocks this)
    const on = !getNeurospicy().enabled;
    sw.setAttribute('aria-checked', String(on));
    swWrap?.setAttribute('data-on', String(on));
    // Celebrate turning it ON: a one-shot confetti blast across the screen, launched from the
    // toggle itself (like the /info hero's click-burst). Only on enable, once per activation.
    if (on) {
      const r = sw.getBoundingClientRect();
      // Lazy: confetti code only loads on first activation of this niche feature,
      // not on the gallery boot path. celebrateBurst is already fire-and-forget.
      // Passing the host lets the chips take the LOADED brand's light/dark pairs
      // (the runtime host is the full WebHost, so tokens rides along even though
      // this control's slice type doesn't declare it).
      void import('../lib/particles.ts').then(m =>
        m.celebrateBurst(r.left + r.width / 2, r.top + r.height / 2,
          host as import('../lib/particles.ts').ChipPairsHost));
    }
    await setNeurospicyEnabled(host, on);
    void neuroDock().then(m => m.syncNeuroDock(host, on));   // show (with a spring-in + corner confetti on enable) / hide the dock
  });
}

/**
 * Back-compat aliases: the view-option popovers (gallery / catalogue / Projects) call these to
 * drop a sound control into their settings popover. They now render the unified switch above - 
 * so every labelled sound control in the app is the same speaker + "Sound:" + sliding toggle.
 */
export function soundSegmentHtml(_headClass?: string): string {
  return soundSwitchHtml();  // _headClass ignored - the switch is self-contained (kept for call-site compat)
}
export function wireSoundSegment(root: ParentNode, host: NeuroHost): void {
  wireSoundSwitch(root, host);
}
