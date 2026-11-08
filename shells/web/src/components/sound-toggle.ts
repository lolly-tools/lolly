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
 *
 * Under the switch sits the sound shape slider: the Bouba blob at one end, the Kiki star at
 * the other, Lolly's chimes in the middle. It sets what every interface sound is made of
 * (lib/sfx-voices.ts) and persists as `sfxShape` (0 to 1) on the profile, the same way.
 * It stays usable while sound is off, so a listener can pick a shape before hearing anything.
 */
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { escape as escapeHtml } from '../utils.ts';
import { isSfxMuted, playSfx, getSfxShape, setSfxShape } from '../lib/sfx.ts';
import { getNeurospicy, setNeurospicyEnabled } from '../lib/neurospicy.ts';
import { applySoundMaster } from '../lib/sound-master.ts';
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
const BOUBA_ICON = icon('bouba', { size: 22, filled: true });
const KIKI_ICON = icon('kiki', { size: 22, filled: true });
/** Fired on document when the sound shape is committed, so every open slider follows. */
const SHAPE_EVENT = 'lolly:sfx-shape';

/**
 * Apply + persist a new mute state everywhere: the in-memory flag + localStorage mirror
 * (via setSfxMuted), and the profile (canonical, best-effort). Plays the confirming chirp
 * when enabling. Exported so bespoke settings surfaces (e.g. the profile page) can reuse it.
 */
export async function applySfxMuted(host: SoundToggleHost, muted: boolean): Promise<void> {
  // The runtime host is the full WebHost (has assets), so the cast is safe.
  await applySoundMaster(host as unknown as Parameters<typeof applySoundMaster>[0], muted);
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
/* Turning Neurospicy on: one ring pulses out from the switch. Transform and opacity only,
   on a single pseudo-element, so the compositor runs it without a paint per frame. */
.sound-switch-track.is-celebrating::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  border: 2px solid hsl(var(--primary));
  animation: sound-switch-ring .6s cubic-bezier(.2,.7,.3,1) both;
}
@keyframes sound-switch-ring { from { transform: scale(1); opacity: .9; } to { transform: scale(1.9, 2.4); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .sound-switch-knob, .sound-switch-track, .sound-switch-icon, .sound-shape, .sound-shape-end { transition: none; }
  .sound-switch-track.is-celebrating::after { animation: none; display: none; }
}
/* And for the app's own preference (data-a11y-motion, lib/a11y-prefs.ts) -
   parts/base.css leaves transitions alone by design, so this has to repeat. */
html[data-a11y-motion="reduce"] :is(.sound-switch-knob, .sound-switch-track, .sound-switch-icon, .sound-shape, .sound-shape-end) { transition: none; }
html[data-a11y-motion="reduce"] .sound-switch-track.is-celebrating::after { animation: none; display: none; }
/* Neurospicy sits directly under Sound as ONE group - no dividing rule between them; the loop
   picker + volume tuck underneath its own switch. */
.neurospicy { display: flex; flex-direction: column; gap: 9px; margin-top: 9px; transition: opacity .18s ease; }
/* Sound is the master switch: while it's muted, Neurospicy reads as off + dimmed and can't be
   toggled until sound is turned back on. */
.neurospicy.is-muted { opacity: .45; pointer-events: none; }
/* The sound shape slider: Bouba blob, track, Kiki star, and a caption underneath. Each shape
   brightens as the thumb moves toward it (--sound-shape, 0 to 1, set by wireSoundShape).
   Muted, it dims but stays usable: the shape can be chosen before any sound plays. */
.sound-shape { display: flex; flex-direction: column; gap: 3px; max-width: 22rem; margin-top: 10px; transition: opacity .18s ease; }
.sound-shape.is-muted { opacity: .6; }
.sound-shape-row { display: flex; align-items: center; gap: 10px; }
.sound-shape-row > .field-range, .sound-shape-row > .custom-slider { flex: 1 1 auto; min-width: 0; }
/* Two ends, not an amount: no fill from the left, an even track, and a small mark at the
   centre where the chimes are. */
.sound-shape .cs-fill { visibility: hidden; }
.sound-shape .cs-track { background: var(--ui-color-border-default, hsl(var(--muted))); }
.sound-shape .cs-track::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: 2px; height: 10px;
  border-radius: 1px; transform: translate(-50%, -50%);
  background: hsl(var(--muted-foreground)); opacity: .6; pointer-events: none;
}
.sound-shape-end {
  display: inline-flex; flex-shrink: 0; color: hsl(var(--foreground)); cursor: pointer;
  transition: opacity .18s ease;
}
.sound-shape-end svg { width: calc(26px * var(--a11y-fs, 1)); height: calc(26px * var(--a11y-fs, 1)); }
.sound-shape-end[data-end="bouba"] { opacity: calc(.35 + .65 * (1 - var(--sound-shape, .5))); }
.sound-shape-end[data-end="kiki"] { opacity: calc(.35 + .65 * var(--sound-shape, .5)); }
.sound-shape-caption { font-size: .78rem; line-height: 1.3; color: hsl(var(--muted-foreground)); text-align: center; }`;
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
    </div>${soundShapeHtml()}${flagEnabledSync('neurospicy') ? neurospicyHtml() : ''}`;
}

/** The words for a sound shape position (0 Bouba … 0.5 chimes … 1 Kiki): the caption
 *  under the slider and the value a screen reader announces. */
export function soundShapeCaption(shape: number): string {
  if (shape <= 0) return t('Bouba: drops, bubbles and bass');
  if (shape < 0.25) return t('Mostly drops and bubbles');
  if (shape < 0.5) return t('Chimes with drops');
  if (shape === 0.5) return t('Chimes and notes');
  if (shape <= 0.75) return t('Chimes with ticks');
  if (shape < 1) return t('Mostly ticks and scratches');
  return t('Kiki: ticks, scratches and metal');
}

// The sound shape slider. A plain `.field-range`, so the app's range upgrader
// (components/custom-slider.ts) draws it as the same slider as every other one in the
// chrome; the input stays the value and event carrier that wireSoundShape listens to.
// The shapes are click targets for the two ends; the slider itself takes Home and End.
function soundShapeHtml(): string {
  const shape = getSfxShape();
  const caption = soundShapeCaption(shape);
  return `<div class="sound-shape${isSfxMuted() ? ' is-muted' : ''}" data-sound-shape-root style="--sound-shape:${shape}">
      <div class="sound-shape-row">
        <span class="sound-shape-end" data-end="bouba" data-shape-to="0" title="${escapeHtml(t('Bouba'))}" aria-hidden="true">${BOUBA_ICON}</span>
        <input type="range" class="field-range" min="0" max="100" step="5" value="${Math.round(shape * 100)}"
          aria-label="${escapeHtml(t('Sound shape, from Bouba (round drops and bubbles) to Kiki (ticks and scratches)'))}"
          aria-valuetext="${escapeHtml(caption)}" data-sound-shape>
        <span class="sound-shape-end" data-end="kiki" data-shape-to="100" title="${escapeHtml(t('Kiki'))}" aria-hidden="true">${KIKI_ICON}</span>
      </div>
      <span class="sound-shape-caption" data-sound-shape-caption aria-hidden="true">${escapeHtml(caption)}</span>
    </div>`;
}

/** Bring a sound shape block in line with the current shape and mute state. */
function paintSoundShape(root: ParentNode): void {
  const wrap = root.querySelector<HTMLElement>('[data-sound-shape-root]');
  if (!wrap) return;
  const shape = getSfxShape();
  const caption = soundShapeCaption(shape);
  wrap.classList.toggle('is-muted', isSfxMuted());
  wrap.style.setProperty('--sound-shape', String(shape));
  const capEl = wrap.querySelector<HTMLElement>('[data-sound-shape-caption]');
  if (capEl) capEl.textContent = caption;
  const input = wrap.querySelector<HTMLInputElement>('[data-sound-shape]');
  if (!input) return;
  const v = String(Math.round(shape * 100));
  if (input.value !== v) input.value = v;   // an upgraded slider follows its input's value
  input.setAttribute('aria-valuetext', caption);
  // The upgraded slider announces its own number after every step; give it the words instead.
  wrap.querySelector('.custom-slider')?.setAttribute('aria-valuetext', caption);
}

/**
 * Wire a soundShapeHtml() block: dragging moves the shape live (the slider's own detent
 * ticks play in it as it changes); letting go saves it to the profile and plays a short
 * preview phrase in the new shape. Clicking a shape jumps to that end.
 */
function wireSoundShape(root: ParentNode, host: SoundToggleHost): void {
  const wrap = root.querySelector<HTMLElement>('[data-sound-shape-root]');
  const input = wrap?.querySelector<HTMLInputElement>('[data-sound-shape]');
  if (!wrap || !input) return;
  const read = (): number => Math.min(1, Math.max(0, Number(input.value) / 100));
  input.addEventListener('input', () => {
    setSfxShape(read());
    paintSoundShape(root);
  });
  input.addEventListener('change', async () => {
    const shape = read();
    setSfxShape(shape);
    paintSoundShape(root);
    playSfx('preview');
    document.dispatchEvent(new CustomEvent(SHAPE_EVENT));
    try {
      const profile = await host.profile.get();
      await host.profile.set({ ...profile, sfxShape: shape });
    } catch { /* preference save is best-effort */ }
  });
  for (const end of wrap.querySelectorAll<HTMLElement>('[data-shape-to]')) {
    end.addEventListener('click', (e) => {
      e.stopPropagation();   // keep a host popover from reading it as a dismiss
      input.value = end.dataset.shapeTo ?? '50';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  // Another open copy (the profile menu over the Profile page) committed a new shape.
  // Popovers are rebuilt on each open, so unhook once this one has left the document.
  const follow = (): void => {
    if (!wrap.isConnected) { document.removeEventListener(SHAPE_EVENT, follow); return; }
    paintSoundShape(root);
  };
  document.addEventListener(SHAPE_EVENT, follow);
  // The range upgrader mounts the real slider just after this markup is added; give that slider the words too.
  requestAnimationFrame(() => paintSoundShape(root));
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
  wireSoundShape(root, host);
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
    paintSoundShape(root);   // and dims the sound shape slider (which stays usable)
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
    // Mark turning it ON with one ring pulsing out from the switch (SWITCH_CSS). It replaced
    // a full-screen confetti burst that was too heavy for the front end.
    if (on) {
      sw.classList.remove('is-celebrating');
      void sw.offsetWidth;   // restart the ring on a quick off-and-on
      sw.classList.add('is-celebrating');
      sw.addEventListener('animationend', () => sw.classList.remove('is-celebrating'), { once: true });
    }
    await setNeurospicyEnabled(host, on);
    void neuroDock().then(m => m.syncNeuroDock(host, on));   // show (springing in on enable) / hide the dock
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
