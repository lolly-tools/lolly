// SPDX-License-Identifier: MPL-2.0
/**
 * The Ear candy lane's moments (#/music): each sound laid over the tune, drawn on the lane
 * as a small chip with its icon (a bird, the sea's waves, a games console, a riser or a
 * sweep, a shout or the Lolly tag, sparkles, a place's sounds, a record for a DJ's scratch), so a person can see where
 * the ear candy comes and learn what each sound is.
 *
 * A moment is one sound and where it plays: its first note, and the bars it runs on for
 * (a run of sparkles over a drop is one moment, a magpie's carol another). The chips are
 * painted into the timeline's canvas with the notes. Over the lane, a row of transparent
 * buttons sits on the chips drawn now, so pointing at a chip or reaching one from the
 * keyboard gives its name. Pressing one while the track is stopped plays that moment's
 * ear candy on its own (the view's audition); while the track plays, the music carries
 * on from the moment's bar (pressMoment). The buttons are one Tab stop: the arrow keys move from moment to
 * moment through the whole track, scrolling the timeline as they go, and Home and End go
 * to the first and last.
 *
 * A sound this table does not know yet (a new effect arriving with a new genre) still gets
 * a chip, with the wand the lane's head wears and the lane's own name.
 */
import { t, tRaw } from '../../i18n.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import { markupPath, musicIconBody } from '../../lib/instrument-icons.ts';
import { LofiStation, type LofiMix } from '../../lib/lofi-station.ts';
import { trackSettings, type MusicState } from '../../lib/music-state.ts';
import { lofiBarSeconds, type LofiBar } from '../../../../../engine/src/lofi-compose.ts';

/** What kind of ear candy a sound is, which sets how readily its chip shows when chips crowd. */
export type FxKind = 'bird' | 'wave' | 'voice' | 'place' | 'console' | 'sweep' | 'sparkle' | 'other';

interface FxSound { kind: FxKind; glyph: IconName | 'gamepad' | 'guitar' | 'disc'; name: () => string }

/** The sounds the lane knows, by the composer's voice ids. */
const SOUNDS: Readonly<Record<string, FxSound>> = {
  magpie: { kind: 'bird', glyph: 'bird', name: () => t('Magpie') },
  kookaburra: { kind: 'bird', glyph: 'bird', name: () => t('Kookaburra') },
  wave: { kind: 'wave', glyph: 'waves', name: () => t('Waves') },
  hey: { kind: 'voice', glyph: 'megaphone', name: () => t('Shout') },
  tag: { kind: 'voice', glyph: 'speech', name: () => t('Lolly tag') },
  nature: { kind: 'place', glyph: 'leaf', name: () => t('Outdoor sounds') },
  game: { kind: 'console', glyph: 'gamepad', name: () => t('Console sound') },
  coin: { kind: 'console', glyph: 'gamepad', name: () => t('Coin') },
  fm: { kind: 'console', glyph: 'gamepad', name: () => t('Console spin, shot or level-up') },
  glitch: { kind: 'console', glyph: 'zap', name: () => t('Glitch') },
  riser: { kind: 'sweep', glyph: 'wind', name: () => t('Riser') },
  phaser: { kind: 'sweep', glyph: 'wind', name: () => t('Phaser sweep') },
  siren: { kind: 'sweep', glyph: 'wind', name: () => t('Dub siren') },
  impact: { kind: 'other', glyph: 'zap', name: () => t('Impact') },
  braam: { kind: 'other', glyph: 'megaphone', name: () => t('Braam') },
  subdrop: { kind: 'sweep', glyph: 'wind', name: () => t('Sub drop') },
  grain: { kind: 'sweep', glyph: 'cloud', name: () => t('Granular pad') },
  sparkle: { kind: 'sparkle', glyph: 'sparkle', name: () => t('Sparkles') },
  blip: { kind: 'sparkle', glyph: 'sparkle', name: () => t('Bleeps') },
  fill: { kind: 'other', glyph: 'guitar', name: () => t('Guitar fill') },
  scratch: { kind: 'other', glyph: 'disc', name: () => t('Record scratch') },
};
const UNKNOWN: FxSound = { kind: 'other', glyph: 'wand', name: () => t('Ear candy') };

/** A sound's kind, icon and name; a sound the table does not know gets the lane's wand and name. */
export function fxSound(voice: string): FxSound {
  return Object.hasOwn(SOUNDS, voice) ? SOUNDS[voice]! : UNKNOWN;
}

/** The kinds a crowded lane shows first: the rare, telling sounds before the steady ones. */
const PRIORITY: Record<FxKind, number> = { bird: 0, wave: 0, voice: 0, place: 0, console: 1, sweep: 1, other: 1, sparkle: 2 };

export interface FxMoment {
  voice: string;
  kind: FxKind;
  /** Where its first note plays: the bar, and the beat in that bar. */
  bar: number;
  beat: number;
  /** The last bar the run reaches. */
  lastBar: number;
}

/** A bar as the moments read it: its notes' voices and beats. */
type FxBar = { notes: ReadonlyArray<{ voice: string; beat: number }> };

/**
 * The track's moments, in the order they come: for each sound, a run of bars it plays in
 * (a bar's gap allowed, so a sound every other bar is still one run), starting at its
 * first note. `isFx` says which notes are the ear candy lane's.
 */
export function fxMoments(bars: readonly FxBar[], isFx: (note: { voice: string }) => boolean): FxMoment[] {
  const out: FxMoment[] = [];
  const open = new Map<string, FxMoment>();
  bars.forEach((bar, i) => {
    const first = new Map<string, number>();
    for (const n of bar.notes) {
      if (!isFx(n)) continue;
      const was = first.get(n.voice);
      if (was === undefined || n.beat < was) first.set(n.voice, n.beat);
    }
    for (const [voice, beat] of first) {
      const run = open.get(voice);
      if (run && i - run.lastBar <= 2) { run.lastBar = i; continue; }
      const m: FxMoment = { voice, kind: fxSound(voice).kind, bar: i, beat, lastBar: i };
      open.set(voice, m);
      out.push(m);
    }
  });
  return out.sort((a, b) => a.bar - b.bar || a.beat - b.beat || a.voice.localeCompare(b.voice));
}

/** A moment's key, the same for the same moment in every paint. */
export const momentKey = (m: FxMoment): string => `${m.voice}:${m.bar}`;

/** A moment's name with where it plays, as a button and a screen reader say the moment. */
export function momentLabel(m: FxMoment): string {
  const name = fxSound(m.voice).name();
  return m.lastBar > m.bar
    ? tRaw('{name}, bars {from} to {to}', { name, from: m.bar + 1, to: m.lastBar + 1 })
    : tRaw('{name}, bar {bar}', { name, bar: m.bar + 1 });
}

export interface PlacedChip { moment: FxMoment; x: number }

/**
 * Which moments get a chip in the span of the lane on show, from `from` to `to` (in the
 * timeline's pixels): each chip `width` wide with no two overlapping, the rare sounds
 * placed first and the rest where they fit, in the order they come.
 */
export function placeChips(moments: readonly FxMoment[], xOf: (m: FxMoment) => number, from: number, to: number, width: number): PlacedChip[] {
  const shown = moments.map(moment => ({ moment, x: xOf(moment) })).filter(c => c.x + width >= from && c.x <= to);
  const order = [...shown].sort((a, b) => PRIORITY[a.moment.kind] - PRIORITY[b.moment.kind] || a.x - b.x);
  const placed: PlacedChip[] = [];
  for (const c of order) if (placed.every(p => Math.abs(p.x - c.x) >= width + 2)) placed.push(c);
  return placed.sort((a, b) => a.x - b.x);
}

/** A sound's icon markup in the 24-unit stroke style. */
const glyphMarkup = (sound: FxSound): string => {
  if (sound.glyph === 'gamepad' || sound.glyph === 'guitar' || sound.glyph === 'disc') return musicIconBody(sound.glyph);
  return /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(icon(sound.glyph))?.[1] ?? '';
};

/** The chips' size in the canvas, in CSS pixels. */
export const CHIP = 18;

/** Paint the chips into the timeline's canvas at the top of the lane: a disc in the lane's colour with the sound's icon in `ink`, at the canvas's alpha (faint while the lane is silent). */
export function drawChips(cx: CanvasRenderingContext2D, chips: readonly PlacedChip[], top: number, colour: string, ink: string): void {
  cx.save();
  for (const { moment, x } of chips) {
    cx.fillStyle = colour;
    cx.beginPath();
    cx.arc(x + CHIP / 2, top + CHIP / 2, CHIP / 2, 0, Math.PI * 2);
    cx.fill();
    cx.save();
    cx.translate(x + 3, top + 3);
    cx.scale(12 / 24, 12 / 24);
    cx.lineWidth = 2.4;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    cx.strokeStyle = ink;
    cx.stroke(markupPath(glyphMarkup(fxSound(moment.voice))));
    cx.restore();
  }
  cx.restore();
}

export interface FxLayerDeps {
  /** Every moment in the track, in order, for the arrow keys. */
  moments(): readonly FxMoment[];
  /** Scroll the timeline so a moment is on show and paint it, so its chip has a button. */
  reveal(m: FxMoment): void;
  /** A moment pressed: the view answers with pressMoment. */
  press(m: FxMoment): void;
}

export interface PressDeps {
  /** Whether the track is playing now (live or the render). */
  playing(): boolean;
  /** Carry the playing track on from a bar. */
  jump(bar: number): void;
  /** Play a moment's ear candy on its own. */
  audition(m: FxMoment): void;
}

/** What pressing a moment does: while the track plays, the music carries on from the moment's bar; stopped, the moment plays alone. */
export function pressMoment(m: FxMoment, d: PressDeps): 'jump' | 'audition' {
  if (d.playing()) { d.jump(m.bar); return 'jump'; }
  d.audition(m);
  return 'audition';
}

export interface FxLayer {
  /** Put a button on each chip painted now; `top` and `height` are the lane's, `width` the timeline's. */
  sync(chips: readonly PlacedChip[], top: number, height: number, width: number): void;
  destroy(): void;
}

/** The row of buttons over the lane's chips, inside the timeline's scrolling box. */
export function createFxLayer(scroll: HTMLElement, deps: FxLayerDeps): FxLayer {
  const layer = document.createElement('div');
  layer.className = 'ms-fx-layer';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', t('Ear candy moments'));
  const how = document.createElement('span');
  how.id = `ms-fx-how-${Math.random().toString(36).slice(2, 8)}`;
  how.hidden = true;
  how.textContent = t('Press to hear this moment alone, or to play on from here while the track plays. The arrow keys move between moments.');
  layer.append(how);
  scroll.append(layer);
  const buttons = new Map<string, HTMLButtonElement>();
  /** The moment that holds the lane's Tab stop. */
  let active = '';

  const make = (m: FxMoment): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ms-fx-moment';
    b.dataset.moment = momentKey(m);
    b.setAttribute('aria-describedby', how.id);
    b.addEventListener('click', () => { active = momentKey(m); deps.press(m); });
    b.addEventListener('focus', () => { active = momentKey(m); settleTabStop(); });
    return b;
  };
  function settleTabStop(): void {
    const keys = [...buttons.keys()];
    const stop = buttons.has(active) ? active : keys[0];
    for (const [k, b] of buttons) b.tabIndex = k === stop ? 0 : -1;
  }
  /** Move to the next moment that way (or the first or last), revealing it; skips a moment whose chip a busier one hides. */
  function move(from: string, key: string): void {
    const all = deps.moments();
    if (!all.length) return;
    let i = all.findIndex(m => momentKey(m) === from);
    const step = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End' ? -1 : 1;
    if (key === 'Home') i = -1;
    if (key === 'End') i = all.length;
    for (let tries = 0; tries < all.length; tries++) {
      i += step;
      const m = all[i];
      if (!m) return;
      deps.reveal(m);
      const b = buttons.get(momentKey(m));
      if (b) { active = momentKey(m); settleTabStop(); b.focus({ preventScroll: true }); return; }
    }
  }
  layer.addEventListener('keydown', (e) => {
    const b = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-moment]') : null;
    if (!b || e.altKey || e.ctrlKey || e.metaKey) return;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    move(b.dataset.moment ?? '', e.key);
  });

  return {
    sync(chips, top, height, width) {
      layer.style.top = `${top}px`;
      layer.style.height = `${height}px`;
      layer.style.width = `${width}px`;
      const keep = new Set<string>();
      chips.forEach((chip, n) => {
        const key = momentKey(chip.moment);
        keep.add(key);
        let b = buttons.get(key);
        if (!b) { b = make(chip.moment); buttons.set(key, b); layer.append(b); }
        // As wide as a finger where the next chip leaves room, never narrower than the chip.
        const next = chips[n + 1];
        const room = next ? next.x - chip.x : 44;
        const w = Math.max(CHIP + 4, Math.min(44, room));
        b.style.left = `${chip.x + CHIP / 2 - w / 2}px`;
        b.style.width = `${w}px`;
        const name = fxSound(chip.moment.voice).name();
        b.dataset.name = name;
        b.setAttribute('aria-label', momentLabel(chip.moment));
      });
      for (const [key, b] of buttons) {
        if (keep.has(key)) continue;
        // A focused button scrolled away keeps focus until another takes over; the next paint removes the old one.
        if (document.activeElement === b) continue;
        b.remove();
        buttons.delete(key);
      }
      settleTabStop();
    },
    destroy() { layer.remove(); buttons.clear(); },
  };
}

export interface AuditionDeps {
  ctx: BaseAudioContext;
  dest: AudioNode;
  /** The track's settings and its composed bars, as they are now. */
  state: MusicState;
  bars: readonly LofiBar[];
}

/**
 * Play a moment's ear candy on its own: the track from the moment's bar with every other
 * part and the record's texture turned off, for the bars the moment runs (two at most),
 * then a short fade. Answers a way to stop it early.
 */
export function auditionMoment(d: AuditionDeps, m: FxMoment): { stop(): void; seconds: number } {
  const mix: LofiMix = { ...d.state.mix, keys: 0, lead: 0, bass: 0, drums: 0, fx: Math.max(1, d.state.mix.fx) };
  const station = new LofiStation(d.ctx, d.dest, d.state.seed, { ...trackSettings(d.state, m.bar), texture: 0 }, mix);
  let seconds = 0;
  for (let b = m.bar; b <= Math.min(m.lastBar, m.bar + 1); b++) seconds += d.bars[b] ? lofiBarSeconds(d.bars[b]!.tune) : 0;
  station.start();
  // The station starts a tenth of a second from now; the fade covers a held note's tail.
  station.fadeOutAt(d.ctx.currentTime + 0.1 + seconds, 0.5);
  let stopped = false;
  const timer = setTimeout(() => stop(), (seconds + 0.8) * 1000);
  function stop(): void {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    station.stop(0.08);
  }
  return { stop, seconds };
}
