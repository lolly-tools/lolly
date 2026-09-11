// SPDX-License-Identifier: MPL-2.0
/**
 * Recording tips - plain-language best practice for the capture tools (voice-recorder,
 * top-tail-recorder). Two things live here:
 *   • RECORDING_TIPS - the canonical list. Each tip carries a `cue` so a later step can
 *     have the live audio coach (lib/audio-coaching.ts) spotlight the relevant one.
 *   • mountRecordingHelp - a "?" affordance on the tool stage that opens a tips panel.
 *
 * Content-first: the panel shows every tip today. The returned handle exposes flash(cue)
 * - the seam for the "detect when a tip is needed and flash it" follow-up - which opens
 * the panel and highlights that one tip; nothing drives it from the meter yet.
 */
import { escape } from '../utils.ts';

export type TipCue =
  | 'room' | 'distance' | 'aim' | 'project' | 'level' | 'wind' | 'fan'  // audio
  | 'dark' | 'bright' | 'glare';                                        // video / lighting

export interface RecordingTip {
  id: string;
  cue: TipCue;
  text: string;
  alert?: string;  // punchier phrasing for a live flash nudge (falls back to `text`)
  kind?: 'audio' | 'video';  // 'video' tips (lighting) only show when the tool captures video
}

// The wording is intentionally close to the source guidance; the `cue` tags which live
// signal (if any) could later surface each tip: room/level/project/wind are detectable
// from the meter's level + noiseFloor/hum/hiss; distance is inferable from a weak
// signal; aim has no reliable signal (reference-only).
export const RECORDING_TIPS: RecordingTip[] = [
  { id: 'room', cue: 'room', text: 'Find a quiet, non-reverberant (non-echoey) room or space to record in.' },
  { id: 'distance', cue: 'distance', text: 'Keep the microphone 2–3 inches (5–7 cm) from your mouth. If that’s not possible, get it as close as you can.' },
  { id: 'aim', cue: 'aim', text: 'Point the front of the microphone directly at your mouth.' },
  { id: 'project', cue: 'project', text: 'In a louder environment, project your voice more than a normal speaking level.' },
  { id: 'level', cue: 'level', text: 'Watch the meter: keep it mostly around −12 to −8, with only the loudest moments reaching −5 or −4.' },
  { id: 'wind', cue: 'wind', text: 'If your hair is moving from the wind outdoors, choose another location ;)' },
  { id: 'fan', cue: 'fan',
    text: 'Keep fans, AC and air vents from blowing on the mic - moving air roars.',
    alert: 'Please make sure all fans and air circulation are turned off.' },
  // Lighting tips - shown only when the tool captures video (see mountRecordingHelp).
  { id: 'dark', cue: 'dark', kind: 'video',
    text: 'Light your face from the front - a window or lamp in front of you, not behind. If the picture looks dark, add light or turn to face it.',
    alert: 'Too dark - add light or turn to face a window.' },
  { id: 'bright', cue: 'bright', kind: 'video',
    text: 'Aim for soft, even light - harsh light straight on your face washes you out. If you look blown out, dim the light or step back.',
    alert: 'Too bright - dim the light or step back.' },
  { id: 'glare', cue: 'glare', kind: 'video',
    text: 'Keep bright windows and lamps out of the shot behind you - a bright background turns you into a dark silhouette. Face the light instead.',
    alert: 'Bright background - face the light, don’t sit in front of it.' },
];

// A Lucide-house-style glyph per cue, so each tip is scannable at a glance: home = the
// room/space, ruler = mic distance, target = aiming the mic, megaphone = project, gauge =
// the level meter, wind = wind outdoors, fan = a fan/AC blowing on the mic. Inner SVG
// only; iconSvg wraps it.
const ICONS: Record<TipCue, string> = {
  room: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  distance: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  aim: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  project: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  level: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  fan: '<path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618z"/><path d="M12 12v.01"/>',
  // Lighting glyphs: moon = too dark, sun = too bright, contrast = harsh backlight/glare.
  dark: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  bright: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  glare: '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z"/>',
};
const iconSvg = (cue: TipCue): string =>
  `<svg class="crt-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[cue] ?? ''}</svg>`;

export interface RecordingHelp {
  /** Open the panel and spotlight the tip for that cue (the flash seam for phase 2). */
  flash(cue: TipCue): void;
  destroy(): void;
}

/**
 * Mount the "?" recording-tips affordance onto the tool stage: a small button in the
 * top-left, and a panel listing every tip. Neither captures the whole stage's pointer
 * events, and both are marked [data-export-hide] so a captured take never includes them.
 */
export function mountRecordingHelp(stageEl: HTMLElement, opts: { video?: boolean } = {}): RecordingHelp {
  const video = opts.video ?? false;
  const wrap = document.createElement('div');
  wrap.className = 'canvas-record-help';
  wrap.setAttribute('data-export-hide', '');

  const panelId = 'canvas-record-tips-panel';
  // Lighting tips only make sense (and only get a live signal) when the tool captures
  // video; a mic-only tool never shows them.
  const tips = RECORDING_TIPS.filter((t) => t.kind !== 'video' || video);
  const title = video ? 'Look &amp; sound your best' : 'Sound your best';
  const items = tips.map(
    (t) => `<li class="crt-item" data-cue="${t.cue}">${iconSvg(t.cue)}<span>${escape(t.text)}</span></li>`,
  ).join('');
  wrap.innerHTML =
    `<button type="button" class="crh-btn" aria-expanded="false" aria-controls="${panelId}" ` +
    `aria-label="Recording tips" title="Recording tips">?</button>` +
    `<div class="crh-panel" id="${panelId}" role="dialog" aria-label="Recording tips" hidden>` +
    `<p class="crt-title">${title}</p><ul class="crt-list">${items}</ul></div>` +
    // Transient single-tip nudge (shown by flash() when the panel is closed). aria-live
    // so screen-reader users hear the coaching; empty + inert until a cue fires.
    `<div class="crh-nudge" role="status" aria-live="polite"></div>`;
  stageEl.appendChild(wrap);

  const btn = wrap.querySelector<HTMLButtonElement>('.crh-btn')!;
  const panel = wrap.querySelector<HTMLElement>('.crh-panel')!;
  const nudge = wrap.querySelector<HTMLElement>('.crh-nudge')!;
  let flashTimer = 0;
  let nudgeTimer = 0;

  const hideNudge = (): void => {
    window.clearTimeout(nudgeTimer);
    nudge.classList.remove('is-shown');
    nudge.textContent = '';
    wrap.classList.remove('is-nudging');
  };
  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('is-open', open);
    if (open) hideNudge();  // the full panel supersedes a transient nudge
  };
  const onDocKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); } };
  const onDocClick = (e: MouseEvent): void => { if (!wrap.contains(e.target as Node) && !panel.hidden) setOpen(false); };

  btn.addEventListener('click', () => setOpen(panel.hidden));
  // Esc-to-close + click-away. Both handlers early-return unless the panel is open, so
  // leaving them attached is cheap; destroy() detaches them.
  document.addEventListener('keydown', onDocKey);
  document.addEventListener('click', onDocClick);

  return {
    flash(cue) {
      const tip = RECORDING_TIPS.find((t) => t.cue === cue);
      if (!tip) return;
      if (!panel.hidden) {
        // Panel already open → spotlight the tip in place rather than pop a nudge over it.
        const item = panel.querySelector<HTMLElement>(`.crt-item[data-cue="${cue}"]`);
        if (!item) return;
        item.scrollIntoView({ block: 'nearest' });
        panel.querySelectorAll('.crt-item.is-flash').forEach((n) => n.classList.remove('is-flash'));
        void item.offsetWidth;  // reflow so re-flashing the same tip restarts the highlight
        item.classList.add('is-flash');
        window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => item.classList.remove('is-flash'), 4000);
        return;
      }
      // Panel closed → a transient single-tip nudge (punchier `alert` phrasing when the
      // tip has one) + a brief pulse on the "?".
      nudge.innerHTML = `${iconSvg(cue)}<span>${escape(tip.alert ?? tip.text)}</span>`;
      nudge.classList.add('is-shown');
      wrap.classList.remove('is-nudging');
      void wrap.offsetWidth;    // restart the button pulse on each nudge
      wrap.classList.add('is-nudging');
      window.clearTimeout(nudgeTimer);
      nudgeTimer = window.setTimeout(hideNudge, 5200);
    },
    destroy() {
      window.clearTimeout(flashTimer);
      window.clearTimeout(nudgeTimer);
      document.removeEventListener('keydown', onDocKey);
      document.removeEventListener('click', onDocClick);
      wrap.remove();
    },
  };
}

export interface TipFlasher {
  /** Feed the current cue (or null); flashes once a cue holds, then cools down. */
  push(cue: TipCue | null): void;
  /** Forget any pending/cooldown state (e.g. when the meter stops). */
  reset(): void;
}

/**
 * Debounced, rate-limited driver for a help.flash function: a cue must persist for
 * `dwellMs` before it flashes, and the same cue won't re-flash within `cooldownMs` - so
 * detection coaches rather than nags. Cue evaluation itself lives in coachAudio.
 */
export function createTipFlasher(
  flash: (cue: TipCue) => void,
  opts: { dwellMs?: number; cooldownMs?: number } = {},
): TipFlasher {
  const dwell = opts.dwellMs ?? 1500;
  const cooldown = opts.cooldownMs ?? 15000;
  let pending: TipCue | null = null;
  let since = 0;
  const lastFlashed = new Map<TipCue, number>();
  return {
    push(cue) {
      const now = performance.now();
      if (cue !== pending) { pending = cue; since = now; return; }   // cue changed → restart dwell
      if (cue == null || now - since < dwell) return;                // nothing, or not steady long enough
      if (now - (lastFlashed.get(cue) ?? -Infinity) < cooldown) return; // still cooling down
      lastFlashed.set(cue, now);
      since = now;                                                   // require a fresh dwell before repeating
      flash(cue);
    },
    reset() { pending = null; since = 0; lastFlashed.clear(); },
  };
}
