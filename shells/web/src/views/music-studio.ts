// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator (#/music): a track editor for Lolly Sings, so a person or a brand
 * can dial in a track and keep the result.
 *
 * Laid out like a sequence editor. A transport across the top (play, position, style,
 * seed, length, key and tempo); tracks down the left (lead, keys, bass, drums, effects),
 * each with an instrument picker, a level, mute and solo; a ruler of the tune's sections
 * and a lane of its chords above the tracks; every note drawn in the lanes; an inspector
 * for the bar you click. Double-click a bar to play from there, or pick a section from the
 * chips under the transport. The seed is a design-tool number: drag across it to slide
 * through seeds, and the tracks redraw as it moves.
 *
 * Every setting lives in the link, so a link plays and edits the same track for anyone
 * who opens it: the composer is deterministic (engine/src/lofi-compose.ts), and the
 * pickers lock a part for the whole track without changing the rest. Rendering makes the
 * whole track offline with progress, then it can be downloaded or saved to the library,
 * with the recipe kept in the asset's details.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import {
  lofiStream, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES,
  type LofiBar, type LofiMood, type LofiStyle,
} from '../../../../engine/src/lofi-compose.ts';
import { LofiStation, LOFI_MIX, type LofiMix, type LofiSettings } from '../lib/lofi-station.ts';
import { LOFI_STATION_MOODS, lofiStationName } from '../lib/neurospicy-lofi.ts';
import { LOFI_KEYS_NAME, LOFI_LEAD_NAME, LOFI_BASS_NAME } from '../lib/lofi-names.ts';
import { encodeWav, encodeM4a, pcmFromAudioBuffer } from '../lib/audio-encode.ts';
import { attachScrub } from '../lib/scrub.ts';
import { mountViz, type VizHandle } from '../lib/butterchurn-viz.ts';
import { defaultVizPresetId } from '../lib/viz-presets.ts';
import { icon } from '../lib/icons.ts';
import '../styles/parts/music-studio.css';

type Track = 'lead' | 'keys' | 'bass' | 'drums' | 'fx';
const TRACKS: readonly Track[] = ['lead', 'keys', 'bass', 'drums', 'fx'];
const TRACK_LABEL: Record<Track, string> = { lead: 'Lead', keys: 'Keys', bass: 'Bass', drums: 'Drums', fx: 'Effects' };
/** Which mix level each track's slider moves (effects ride with the lead's bus). */
const TRACK_MIX: Record<Track, keyof LofiMix> = { lead: 'lead', keys: 'keys', bass: 'bass', drums: 'drums', fx: 'lead' };
const DRUM_VOICES = new Set(['kick', 'snare', 'rim', 'hat', 'openHat', 'crash']);
const MIX_KEYS: readonly (keyof LofiMix)[] = ['keys', 'bass', 'lead', 'drums', 'reverb', 'texture'];
const FX_VOICES = new Set(['riser', 'coin', 'magpie', 'hey']);

/** Lane heights in CSS pixels: the section ruler, the chords, then each track. */
const RULER = 26;
const CHORDS = 22;
const LANE: Record<Track, number> = { lead: 70, keys: 70, bass: 70, drums: 56, fx: 34 };
const LENGTHS = [8, 16, 32, 48, 64, 96, 128, 192, 256];
type VizMode = 'off' | 'bars' | 'scope' | 'milkdrop';
const VIZ_MODES: readonly VizMode[] = ['bars', 'scope', 'milkdrop', 'off'];
const VIZ_KEY = 'lolly:musicViz';

/** Instruments a person chose for one kind of section (every drop, every build…). */
export type SectionVoices = Partial<Pick<LofiStyle, 'keys' | 'lead' | 'bass'>>;
const SECTION_NAMES = ['intro', 'verse', 'build', 'drop', 'break', 'bridge', 'feature', 'groove', 'drums', 'outro'] as const;

export interface MusicState {
  mood: LofiMood;
  /** Per kind of section, the instruments chosen for it, over whatever the composer chose. */
  sections: Partial<Record<string, SectionVoices>>;
  seed: number;
  bars: number;
  keys?: LofiStyle['keys'];
  lead?: LofiStyle['lead'];
  bass?: LofiStyle['bass'];
  drums: boolean;
  texture: number;
  bright?: number;
  drive?: number;
  mix: LofiMix;
}

const DEFAULT_STATE: MusicState = { mood: 'sugar', seed: 2024, bars: 64, drums: true, texture: 0.3, mix: { ...LOFI_MIX }, sections: {} };

/** Read a state from the link's parameters. Anything unknown or out of range falls back. */
export function parseMusicState(params: string): MusicState {
  const q = new URLSearchParams(params);
  const pick = <T extends string>(v: string | null, from: readonly T[]): T | undefined => (from as readonly string[]).includes(v ?? '') ? from.find(x => x === v) : undefined;
  const num = (v: string | null, lo: number, hi: number): number | undefined => {
    const n = Number(v);
    return v !== null && v !== '' && Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
  };
  const mix: LofiMix = { ...LOFI_MIX };
  for (const k of MIX_KEYS) {
    const v = num(q.get(`mix.${k}`), 0, 2);
    if (v !== undefined) mix[k] = v;
  }
  const sections: Partial<Record<string, SectionVoices>> = {};
  for (const name of SECTION_NAMES) {
    const v: SectionVoices = {};
    const keys = pick(q.get(`${name}.keys`), LOFI_KEYS);
    const lead = pick(q.get(`${name}.lead`), LOFI_LEADS);
    const bass = pick(q.get(`${name}.bass`), LOFI_BASSES);
    if (keys) v.keys = keys;
    if (lead) v.lead = lead;
    if (bass) v.bass = bass;
    if (keys || lead || bass) sections[name] = v;
  }
  return {
    sections,
    mood: pick(q.get('style'), LOFI_STATION_MOODS) ?? DEFAULT_STATE.mood,
    seed: Math.floor(num(q.get('seed'), 0, 4294967295) ?? DEFAULT_STATE.seed),
    bars: Math.round(num(q.get('bars'), 4, 512) ?? DEFAULT_STATE.bars),
    keys: pick(q.get('keys'), LOFI_KEYS),
    lead: pick(q.get('lead'), LOFI_LEADS),
    bass: pick(q.get('bass'), LOFI_BASSES),
    drums: q.get('drums') !== '0',
    texture: num(q.get('texture'), 0, 1) ?? DEFAULT_STATE.texture,
    bright: num(q.get('bright'), 0.5, 1.8),
    drive: num(q.get('drive'), 0.8, 4.5),
    mix,
  };
}

/** The link's parameters for a state: only what differs from the defaults, so links stay short. */
export function musicStateParams(s: MusicState): string {
  const q = new URLSearchParams();
  q.set('style', s.mood);
  q.set('seed', String(s.seed >>> 0));
  q.set('bars', String(s.bars));
  if (s.keys) q.set('keys', s.keys);
  if (s.lead) q.set('lead', s.lead);
  if (s.bass) q.set('bass', s.bass);
  if (!s.drums) q.set('drums', '0');
  if (s.texture !== DEFAULT_STATE.texture) q.set('texture', String(s.texture));
  if (s.bright !== undefined) q.set('bright', String(s.bright));
  if (s.drive !== undefined) q.set('drive', String(s.drive));
  for (const k of MIX_KEYS) if (s.mix[k] !== 1) q.set(`mix.${k}`, String(s.mix[k]));
  for (const name of SECTION_NAMES) {
    const v = s.sections[name];
    if (v?.keys) q.set(`${name}.keys`, v.keys);
    if (v?.lead) q.set(`${name}.lead`, v.lead);
    if (v?.bass) q.set(`${name}.bass`, v.bass);
  }
  return q.toString();
}

/** The parts the person locked, as the composer's fixed style. */
function fixedStyle(s: MusicState): Partial<LofiStyle> {
  const f: Partial<LofiStyle> = {};
  if (s.keys) f.keys = s.keys;
  if (s.lead) f.lead = s.lead;
  if (s.bass) f.bass = s.bass;
  if (s.bright !== undefined) f.bright = s.bright;
  if (s.drive !== undefined) f.drive = s.drive;
  return f;
}

/** Each bar with the instruments chosen for its kind of section, if any: what the station plays too. */
export function shapeBar(s: MusicState): (bar: LofiBar) => LofiBar {
  return (bar) => {
    const chosen = s.sections[bar.section];
    return chosen ? { ...bar, voices: { ...bar.voices, ...chosen, ...(chosen.lead ? { double: undefined } : {}) } } : bar;
  };
}

/** The track's bars, composed: the same bars the station will play. */
export function composeTrack(s: MusicState): LofiBar[] {
  const stream = lofiStream(s.seed, { mood: s.mood, style: fixedStyle(s) });
  const shape = shapeBar(s);
  return Array.from({ length: s.bars }, () => shape(stream.next()));
}

/** Where each bar starts, in seconds, and the whole track's length. */
function barTimes(bars: readonly LofiBar[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let at = 0;
  for (const b of bars) { starts.push(at); at += 240 / b.tune.bpm; }
  return { starts, total: at };
}

const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Which track a note is drawn in. */
function trackOf(voice: string): Track {
  if (DRUM_VOICES.has(voice)) return 'drums';
  if (FX_VOICES.has(voice)) return 'fx';
  if (voice === 'soar') return 'bass';
  return voice === 'keys' || voice === 'lead' || voice === 'bass' ? voice : 'fx';
}

const SECTION_HUE: Record<string, number> = { intro: 200, verse: 150, build: 40, drop: 330, break: 260, bridge: 260, feature: 280, groove: 170, drums: 20, outro: 210, rest: 0 };

interface UploadingAssets { _uploadUserAsset(record: { id: string; type: 'audio'; format: string; blob: Blob; meta: Record<string, unknown> }): Promise<void> }
function canUpload(assets: unknown): assets is UploadingAssets {
  return typeof assets === 'object' && assets !== null && '_uploadUserAsset' in assets && typeof assets._uploadUserAsset === 'function';
}

export function mountMusicStudio(view: HTMLElement & { _cleanup?: () => void }, host: HostV1, params = ''): void {
  document.title = `${t('Music generator')} - Lolly`;
  view.innerHTML = backHomeHtml(); mountBackPill(view); mountHomeFab(view);
  const state = parseMusicState(params);
  let bars = composeTrack(state);
  let times = barTimes(bars);
  let selected = 0;
  let pxPerBeat = 9;
  const muted = new Set<Track>();
  const solo = new Set<Track>();

  const optionList = (values: readonly string[], names: Record<string, string>, current: string | undefined): string =>
    `<option value="">${t('Auto')}</option>` + values.filter(v => v !== 'none').map(v => `<option value="${v}"${v === current ? ' selected' : ''}>${escapeHtml(names[v] ?? v)}</option>`).join('');
  const picker = (track: Track): string => {
    if (track === 'keys') return `<select class="field-select ms-pick" data-pick="keys" aria-label="${t('Keys instrument')}">${optionList(LOFI_KEYS, LOFI_KEYS_NAME, state.keys)}</select>`;
    if (track === 'lead') return `<select class="field-select ms-pick" data-pick="lead" aria-label="${t('Lead instrument')}">${optionList(LOFI_LEADS, LOFI_LEAD_NAME, state.lead)}</select>`;
    if (track === 'bass') return `<select class="field-select ms-pick" data-pick="bass" aria-label="${t('Bass instrument')}">${optionList(LOFI_BASSES, LOFI_BASS_NAME, state.bass)}</select>`;
    if (track === 'drums') return `<label class="ms-check"><input type="checkbox" data-drums${state.drums ? ' checked' : ''}> ${t('On')}</label>`;
    return '';
  };
  const slider = (id: string, label: string, min: number, max: number, step: number, value: number): string =>
    `<label class="ms-slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-slider="${id}"><output data-out="${id}"></output></label>`;

  const page = document.createElement('section');
  page.className = 'ms-page';
  page.innerHTML = `
    <header class="ms-head">
      <h1>${t('Music generator')}</h1>
      <p>${t('Pick a style and a seed, lock any part you like, and dial in a track. Every seed is a different song, the same for everyone who opens the link.')}</p>
    </header>
    <div class="ms-transport" role="group" aria-label="${t('Transport')}">
      <button type="button" class="btn btn--primary ms-play" data-play aria-pressed="false">${icon('play', { size: 16 })}<span>${t('Play')}</span></button>
      <span class="ms-pos" data-pos aria-live="off">1 / ${state.bars}</span>
      <label class="ms-field"><span>${t('Style')}</span><select class="field-select" data-style>${LOFI_STATION_MOODS.map(m => `<option value="${m}"${m === state.mood ? ' selected' : ''}>${escapeHtml(lofiStationName(m))}</option>`).join('')}</select></label>
      <span class="ms-field ms-seed"><span class="ms-scrub-label" title="${t('Drag across the number to slide through seeds')}">${t('Seed')}</span>
        <button type="button" class="btn ms-icon" data-seed-step="-1" aria-label="${t('Previous seed')}">${icon('chevronLeft', { size: 16 })}</button>
        <input type="number" class="field-input ms-seed-input" min="0" max="4294967295" value="${state.seed}" data-seed aria-label="${t('Seed')}" title="${t('Type a seed, or drag across the number to slide through seeds')}">
        <button type="button" class="btn ms-icon" data-seed-step="1" aria-label="${t('Next seed')}">${icon('chevronRight', { size: 16 })}</button>
        <button type="button" class="btn" data-dice title="${t('A random seed: a different song')}">${icon('sparkle', { size: 16 })}<span>${t('Shuffle')}</span></button>
      </span>
      <label class="ms-field"><span>${t('Length')}</span><select class="field-select" data-bars>${LENGTHS.map(n => `<option value="${n}"${n === state.bars ? ' selected' : ''}>${n} ${t('bars')}</option>`).join('')}</select></label>
      <span class="ms-meta" data-meta></span>
    </div>
    <nav class="ms-sections" data-sections aria-label="${t('Jump to a section')}"></nav>
    <div class="ms-viz-wrap">
      <canvas class="ms-viz" data-viz aria-hidden="true"></canvas>
      <canvas class="ms-viz" data-viz-rich aria-hidden="true" hidden></canvas>
      <label class="ms-viz-pick">${t('Visualiser')} <select class="field-select" data-viz-mode>
        <option value="bars">${t('Bars')}</option><option value="scope">${t('Scope')}</option>
        <option value="milkdrop">${t('Visualiser')}</option><option value="off">${t('Off')}</option>
      </select></label>
    </div>
    <div class="ms-editor">
      <div class="ms-heads">
        <div class="ms-lane-head" style="height:${RULER}px">${t('Sections')}</div>
        <div class="ms-lane-head" style="height:${CHORDS}px">${t('Chords')}</div>
        ${TRACKS.map(tr => `
          <div class="ms-lane-head ms-track" data-track="${tr}" style="height:${LANE[tr]}px">
            <span class="ms-track-name">${t(TRACK_LABEL[tr])}</span>
            ${picker(tr)}
            ${tr === 'fx' ? `<span class="ms-dim">${t('with the lead')}</span>` : `<span class="ms-track-tools">
              <input type="range" min="0" max="1.6" step="0.05" value="${state.mix[TRACK_MIX[tr]]}" data-level="${tr}" aria-label="${t(TRACK_LABEL[tr])} ${t('level')}">
              <button type="button" class="ms-ms" data-mute="${tr}" aria-pressed="false" title="${t('Mute')}">M</button>
              <button type="button" class="ms-ms" data-solo="${tr}" aria-pressed="false" title="${t('Solo')}">S</button>
            </span>`}
          </div>`).join('')}
      </div>
      <div class="ms-scroll" data-scroll>
        <canvas class="ms-canvas" data-canvas role="img" aria-label="${t('The track: its sections, chords and every note')}"></canvas>
        <div class="ms-spacer" data-spacer></div>
      </div>
    </div>
    <div class="ms-under">
      <div class="ms-inspector" data-inspector aria-live="polite"></div>
      <div class="ms-sliders">
        ${slider('reverb', t('Room'), 0, 2, 0.05, state.mix.reverb)}
        ${slider('texture', t('Texture'), 0, 1, 0.05, state.texture)}
        ${slider('bright', t('Brightness'), 0.5, 1.8, 0.05, state.bright ?? 1)}
        ${slider('drive', t('Drive'), 0.8, 4.5, 0.1, state.drive ?? 2)}
        ${slider('zoom', t('Zoom'), 0.5, 30, 0.25, pxPerBeat)}
        <button type="button" class="btn ms-fit" data-fit>${t('Fit the track')}</button>
      </div>
    </div>
    <div class="ms-export">
      <button type="button" class="btn btn--primary" data-render>${t('Make the track')}</button>
      <progress max="1" value="0" data-progress hidden></progress>
      <select class="field-select" data-format aria-label="${t('File type')}"><option value="m4a">M4A</option><option value="wav">WAV</option></select>
      <button type="button" class="btn" data-download disabled>${t('Download')}</button>
      <button type="button" class="btn" data-save disabled>${t('Save to library')}</button>
      <button type="button" class="btn" data-link>${t('Copy link')}</button>
      <span class="ms-status" data-status role="status"></span>
    </div>`;
  view.append(page);

  const q = <T extends Element>(sel: string): T => {
    const el = page.querySelector<T>(sel);
    if (!el) throw new Error(`music generator: ${sel} is missing`);
    return el;
  };
  const canvas = q<HTMLCanvasElement>('[data-canvas]');
  const scroll = q<HTMLElement>('[data-scroll]');
  const spacer = q<HTMLElement>('[data-spacer]');
  const status = q<HTMLElement>('[data-status]');
  const playBtn = q<HTMLButtonElement>('[data-play]');
  const pos = q<HTMLElement>('[data-pos]');
  const progress = q<HTMLProgressElement>('[data-progress]');
  const downloadBtn = q<HTMLButtonElement>('[data-download]');
  const saveBtn = q<HTMLButtonElement>('[data-save]');

  // ── drawing ─────────────────────────────────────────────────────────────────
  const height = RULER + CHORDS + TRACKS.reduce((h, tr) => h + LANE[tr], 0);
  const laneTop = (tr: Track): number => RULER + CHORDS + TRACKS.slice(0, TRACKS.indexOf(tr)).reduce((h, x) => h + LANE[x], 0);
  const beatX = (bar: number, beat: number): number => (bar * 4 + beat) * pxPerBeat;
  let playheadBar = -1;
  let playheadBeat = 0;
  let rendered = 0;   // the share of the track already made, 0..1

  function draw(): void {
    // The canvas is only as wide as the view and is drawn at the scroll offset: a long
    // track at a close zoom would be wider than a canvas is allowed to be.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const total = bars.length * 4 * pxPerBeat + 2;
    spacer.style.width = `${total}px`;
    const width = Math.max(1, scroll.clientWidth);
    const offset = scroll.scrollLeft;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
    const cx = canvas.getContext('2d');
    if (!cx) return;
    cx.setTransform(dpr, 0, 0, dpr, -offset * dpr, 0);
    const first = Math.max(0, Math.floor(offset / (4 * pxPerBeat)) - 1);
    const last = Math.min(bars.length, Math.ceil((offset + width) / (4 * pxPerBeat)) + 1);
    const css = getComputedStyle(page);
    const ink = css.getPropertyValue('--ms-ink').trim() || '#123';
    const muteInk = css.getPropertyValue('--ms-muted').trim() || '#789';
    const line = css.getPropertyValue('--ms-line').trim() || 'rgba(0,0,0,.12)';
    cx.clearRect(offset, 0, width, height);
    // Sections: one band for each run of bars in the same section.
    for (let i = 0; i < bars.length;) {
      let j = i;
      while (j + 1 < bars.length && bars[j + 1]!.section === bars[i]!.section && bars[j + 1]!.index === bars[j]!.index + 1) j++;
      const hue = SECTION_HUE[bars[i]!.section] ?? 200;
      const x0 = beatX(i, 0), x1 = beatX(j + 1, 0);
      cx.fillStyle = `hsl(${hue} 70% 55% / .2)`;
      cx.fillRect(x0, 0, x1 - x0, height);
      cx.fillStyle = `hsl(${hue} 60% 45%)`;
      cx.fillRect(x0, 0, x1 - x0, 4);
      cx.fillStyle = ink;
      cx.font = '600 11px system-ui, sans-serif';
      cx.fillText(t(bars[i]!.section), x0 + 4, 18);
      i = j + 1;
    }
    // Bar lines and the chord lane.
    cx.font = '11px system-ui, sans-serif';
    // A chord's name is drawn only when the name has room before the next chord.
    for (let i = first; i < last; i++) {
      cx.fillStyle = line;
      cx.fillRect(beatX(i, 0), RULER, 1, height - RULER);
      const chord = bars[i]!.chord;
      if (!chord || (i > 0 && bars[i - 1]!.chord === chord)) continue;
      let next = i + 1;
      while (next < bars.length && bars[next]!.chord === chord) next++;
      const room = beatX(next, 0) - beatX(i, 0) - 6;
      if (cx.measureText(chord).width <= room) { cx.fillStyle = muteInk; cx.fillText(chord, beatX(i, 0) + 3, RULER + 15); }
    }
    for (const tr of TRACKS) { cx.fillStyle = line; cx.fillRect(offset, laneTop(tr), width, 1); }
    // Notes, each in its track: pitched parts by pitch, drums on three rows, effects as dots.
    const pitchRange: Record<'lead' | 'keys' | 'bass', [number, number]> = { lead: [52, 96], keys: [48, 80], bass: [24, 64] };
    for (let i = first; i < last; i++) {
      const bar = bars[i]!;
      for (const n of bar.notes) {
        const tr = trackOf(n.voice);
        const silent = muted.has(tr) || (solo.size > 0 && !solo.has(tr)) || (tr === 'drums' && !state.drums);
        const x = beatX(i, n.beat);
        const top = laneTop(tr);
        cx.globalAlpha = silent ? 0.18 : 0.55 + n.vel * 0.45;
        if (tr === 'drums') {
          const row = n.voice === 'kick' ? 2 : n.voice === 'snare' || n.voice === 'rim' ? 1 : 0;
          cx.fillStyle = `hsl(${[45, 10, 330][row]} 70% 50%)`;
          cx.fillRect(x, top + 8 + row * 15, 3, 10);
        } else if (tr === 'fx') {
          cx.fillStyle = 'hsl(280 60% 55%)';
          cx.beginPath(); cx.arc(x + 3, top + LANE.fx / 2, 4, 0, Math.PI * 2); cx.fill();
        } else {
          const [lo, hi] = pitchRange[tr];
          const y = top + 4 + (1 - (Math.min(hi, Math.max(lo, n.midi)) - lo) / (hi - lo)) * (LANE[tr] - 10);
          cx.fillStyle = tr === 'lead' ? 'hsl(330 65% 52%)' : tr === 'keys' ? 'hsl(200 65% 45%)' : n.voice === 'soar' ? 'hsl(170 50% 45%)' : 'hsl(150 60% 38%)';
          cx.fillRect(x, y, Math.max(2, n.dur * pxPerBeat - 1), 4);
        }
      }
    }
    cx.globalAlpha = 1;
    // What has been made so far, under the ruler, then the selection and the playhead.
    if (rendered > 0) { cx.fillStyle = 'hsl(150 60% 40%)'; cx.fillRect(0, RULER - 4, total * rendered, 3); }
    cx.strokeStyle = ink; cx.lineWidth = 1;
    cx.strokeRect(beatX(selected, 0) + 0.5, RULER + 0.5, 4 * pxPerBeat - 1, height - RULER - 1);
    if (playheadBar >= 0) {
      cx.fillStyle = 'hsl(0 75% 50%)';
      cx.fillRect(beatX(playheadBar, playheadBeat), 0, 2, height);
    }
  }

  function inspect(): void {
    const bar = bars[selected];
    if (!bar) return;
    const st = bar.tune.style;
    const keys = bar.voices?.keys ?? st.keys;
    const lead = bar.voices?.lead ?? st.lead;
    const bass = bar.voices?.bass ?? st.bass;
    const playing = new Set(bar.notes.map(n => trackOf(n.voice)));
    q<HTMLElement>('[data-inspector]').innerHTML = `
      <strong>${t('Bar')} ${selected + 1}</strong> · ${escapeHtml(t(bar.section))} · ${escapeHtml(bar.chord || t('rest'))}
      <span class="ms-dim">${escapeHtml(bar.tune.key)} · ${bar.tune.bpm} bpm</span><br>
      ${playing.has('lead') ? `${t('Lead')}: ${escapeHtml(LOFI_LEAD_NAME[lead] || lead)}${bar.voices?.double ? ` + ${escapeHtml(LOFI_LEAD_NAME[bar.voices.double])}` : ''} · ` : ''}
      ${playing.has('keys') ? `${t('Keys')}: ${escapeHtml(LOFI_KEYS_NAME[keys])} · ` : ''}
      ${playing.has('bass') ? `${t('Bass')}: ${escapeHtml(LOFI_BASS_NAME[bass])} · ` : ''}
      ${bar.notes.length} ${t('notes')} <span class="ms-dim">${t('Double-click a bar to play from that bar.')}</span>
      ${bar.section === 'rest' ? '' : `<div class="ms-section-voices" role="group" aria-label="${t('Instruments for this kind of section')}">
        <span>${t('In every')} ${escapeHtml(t(bar.section))}:</span>
        <label>${t('Keys')} <select class="field-select" data-sec-pick="keys">${optionList(LOFI_KEYS, LOFI_KEYS_NAME, state.sections[bar.section]?.keys)}</select></label>
        <label>${t('Lead')} <select class="field-select" data-sec-pick="lead">${optionList(LOFI_LEADS, LOFI_LEAD_NAME, state.sections[bar.section]?.lead)}</select></label>
        <label>${t('Bass')} <select class="field-select" data-sec-pick="bass">${optionList(LOFI_BASSES, LOFI_BASS_NAME, state.sections[bar.section]?.bass)}</select></label>
      </div>`}`;
  }

  /** The sections in order, each a chip that plays from its first bar ("Drop 2" for a second drop). */
  function sectionChips(): void {
    const seen = new Map<string, number>();
    const chips: string[] = [];
    for (let i = 0; i < bars.length; i++) {
      const sec = bars[i]!.section;
      if (sec === 'rest' || (i > 0 && bars[i - 1]!.section === sec)) continue;
      const n = (seen.get(sec) ?? 0) + 1;
      seen.set(sec, n);
      const label = `${t(sec.charAt(0).toUpperCase() + sec.slice(1))}${n > 1 ? ` ${n}` : ''}`;
      chips.push(`<button type="button" class="ms-chip" data-jump="${i}" style="--ms-hue:${SECTION_HUE[sec] ?? 200}">${escapeHtml(label)}<span class="ms-dim">${clock(times.starts[i]!)}</span></button>`);
    }
    q<HTMLElement>('[data-sections]').innerHTML = chips.join('');
  }

  function meta(): void {
    const first = bars[0]!.tune;
    q<HTMLElement>('[data-meta]').textContent = `${first.key} · ${first.bpm} bpm · ${clock(times.total)}`;
  }

  // ── state, link and recomposing ──────────────────────────────────────────────
  function writeLink(): void {
    const next = `#/music?${musicStateParams(state)}`;
    if (location.hash !== next) history.replaceState(history.state, '', next);
  }
  function recompose(): void {
    bars = composeTrack(state);
    times = barTimes(bars);
    selected = Math.min(selected, bars.length - 1);
    renderedBuffer = null; rendered = 0;
    downloadBtn.disabled = true; saveBtn.disabled = true; progress.hidden = true;
    if (!station) pos.textContent = `${selected + 1} / ${bars.length}`;
    writeLink(); meta(); inspect(); sectionChips(); draw();
    if (station) play(Math.max(0, playheadBar));
  }

  // ── playback ─────────────────────────────────────────────────────────────────
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let station: LofiStation | null = null;
  let startedAt = 0;
  let startedBar = 0;
  let raf = 0;

  function effectiveMix(): LofiMix {
    const m = { ...state.mix };
    const silent = (tr: Track): boolean => muted.has(tr) || (solo.size > 0 && !solo.has(tr));
    for (const tr of ['lead', 'keys', 'bass', 'drums'] as const) if (silent(tr)) m[TRACK_MIX[tr]] = 0;
    return m;
  }
  function settings(startBar: number): LofiSettings {
    return { mood: state.mood, drums: state.drums, texture: state.texture, style: fixedStyle(state), startBar, bars: state.bars, shape: shapeBar(state) };
  }
  function stopPlayback(): void {
    station?.stop(0.15);
    station = null;
    cancelAnimationFrame(raf);
    playBtn.innerHTML = `${icon('play', { size: 16 })}<span>${t('Play')}</span>`;
    playBtn.setAttribute('aria-pressed', 'false');
  }
  function play(fromBar: number): void {
    station?.stop(0.08);
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      master.connect(ctx.destination);
      master.connect(analyser);
      void syncRichViz();
    }
    void ctx.resume();
    station = new LofiStation(ctx, master ?? ctx.destination, state.seed, settings(fromBar), effectiveMix());
    station.setVolume(1);
    station.start();
    startedAt = ctx.currentTime + 0.1;
    startedBar = fromBar;
    playBtn.innerHTML = `${icon('pause', { size: 16 })}<span>${t('Stop')}</span>`;
    playBtn.setAttribute('aria-pressed', 'true');
    cancelAnimationFrame(raf);
    const tick = (): void => {
      if (!ctx || !station) return;
      const at = times.starts[startedBar]! + Math.max(0, ctx.currentTime - startedAt);
      if (at >= times.total + 1.5) { stopPlayback(); playheadBar = -1; draw(); return; }
      let b = startedBar;
      while (b + 1 < bars.length && times.starts[b + 1]! <= at) b++;
      playheadBar = b;
      playheadBeat = Math.min(4, (at - times.starts[b]!) / (240 / bars[b]!.tune.bpm) * 4);
      pos.textContent = `${b + 1} / ${bars.length} · ${clock(at)}`;
      drawViz();
      const x = beatX(b, playheadBeat);
      if (x < scroll.scrollLeft || x > scroll.scrollLeft + scroll.clientWidth - 40) scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 3);
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // ── making the track ─────────────────────────────────────────────────────────
  let renderedBuffer: AudioBuffer | null = null;
  let rendering = 0;
  async function render(): Promise<void> {
    const job = ++rendering;
    const seconds = times.total + 2.5;
    const octx = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
    const offline = new LofiStation(octx, octx.destination, state.seed, settings(0), effectiveMix());
    offline.scheduleAll(seconds);
    offline.fadeOutAt(Math.max(0, seconds - 2.5), 2.5);
    progress.hidden = false; progress.value = 0;
    status.textContent = t('Making the track…');
    for (let s = 1; s < seconds; s += 1) {
      void octx.suspend(s).then(() => {
        if (job === rendering) { rendered = s / seconds; progress.value = rendered; draw(); }
        void octx.resume();
      });
    }
    const buffer = await octx.startRendering();
    if (job !== rendering) return;
    renderedBuffer = buffer; rendered = 1; progress.value = 1; draw();
    downloadBtn.disabled = false; saveBtn.disabled = false;
    status.textContent = t('Made. Download the track or save it to your library.');
  }
  async function encoded(): Promise<{ blob: Blob; format: string }> {
    if (!renderedBuffer) throw new Error('nothing made yet');
    const pcm = pcmFromAudioBuffer(renderedBuffer);
    const want = q<HTMLSelectElement>('[data-format]').value;
    if (want === 'm4a') {
      try { return { blob: await encodeM4a(pcm), format: 'm4a' }; } catch { /* no AAC encoder here: fall back to WAV */ }
    }
    return { blob: encodeWav(pcm), format: 'wav' };
  }
  const trackName = (): string => `${lofiStationName(state.mood)} · ${bars[0]!.tune.key} · ${bars[0]!.tune.bpm} bpm · ${state.seed}`;
  const fileName = (format: string): string => `${trackName().replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').toLowerCase()}.${format}`;

  // ── wiring ───────────────────────────────────────────────────────────────────
  const listen = <K extends keyof HTMLElementEventMap>(sel: string, type: K, fn: (e: HTMLElementEventMap[K], el: HTMLElement) => void): void => {
    for (const el of page.querySelectorAll<HTMLElement>(sel)) el.addEventListener(type, e => fn(e, el));
  };
  listen('[data-play]', 'click', () => { if (station) stopPlayback(); else play(selected); });
  listen('[data-style]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.mood = parseMusicState(`style=${el.value}`).mood; recompose(); } });
  const setSeed = (seed: number): void => {
    state.seed = ((seed % 4294967296) + 4294967296) % 4294967296;
    q<HTMLInputElement>('[data-seed]').value = String(state.seed);
    recompose();
  };
  listen('[data-seed]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) setSeed(Math.floor(Number(el.value) || 0)); });
  listen('[data-seed-step]', 'click', (_e, el) => setSeed(state.seed + Number(el.dataset.seedStep)));
  listen('[data-dice]', 'click', () => setSeed(crypto.getRandomValues(new Uint32Array(1))[0]!));
  listen('[data-bars]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.bars = Number(el.value); recompose(); } });
  listen('[data-pick]', 'change', (_e, el) => {
    if (!(el instanceof HTMLSelectElement)) return;
    const v = el.value || undefined;
    if (el.dataset.pick === 'keys') state.keys = LOFI_KEYS.find(x => x === v);
    if (el.dataset.pick === 'lead') state.lead = LOFI_LEADS.find(x => x === v);
    if (el.dataset.pick === 'bass') state.bass = LOFI_BASSES.find(x => x === v);
    recompose();
  });
  listen('[data-drums]', 'change', (_e, el) => {
    if (el instanceof HTMLInputElement) { state.drums = el.checked; station?.setDrums(state.drums); writeLink(); draw(); }
  });
  listen('[data-level]', 'input', (_e, el) => {
    const tr = TRACKS.find(x => x === el.dataset.level);
    if (!tr || !(el instanceof HTMLInputElement)) return;
    state.mix[TRACK_MIX[tr]] = Number(el.value);
    station?.setMix(effectiveMix()); writeLink();
  });
  const toggle = (set: Set<Track>, el: HTMLElement, tr: Track): void => {
    if (set.has(tr)) set.delete(tr); else set.add(tr);
    el.setAttribute('aria-pressed', String(set.has(tr)));
    station?.setMix(effectiveMix()); draw();
  };
  listen('[data-mute]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.mute); if (tr) toggle(muted, el, tr); });
  listen('[data-solo]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.solo); if (tr) toggle(solo, el, tr); });
  const showSlider = (id: string, v: number): void => {
    const out = page.querySelector<HTMLOutputElement>(`[data-out="${id}"]`);
    if (out) out.textContent = id === 'zoom' ? `${v.toFixed(1)}×` : v.toFixed(2);
  };
  listen('[data-slider]', 'input', (_e, el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const id = el.dataset.slider ?? '';
    const v = Number(el.value);
    showSlider(id, v);
    if (id === 'zoom') { pxPerBeat = v; draw(); return; }
    if (id === 'reverb') { state.mix.reverb = v; station?.setMix(effectiveMix()); }
    if (id === 'texture') { state.texture = v; station?.setTexture(v); }
    writeLink();
  });
  // Brightness and drive change the tune's colour, so they recompose when let go.
  listen('[data-slider="bright"]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) { state.bright = Number(el.value); recompose(); } });
  listen('[data-slider="drive"]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) { state.drive = Number(el.value); recompose(); } });
  for (const el of page.querySelectorAll<HTMLInputElement>('[data-slider]')) showSlider(el.dataset.slider ?? '', Number(el.value));

  /** Zoom so the whole track fits the visible width. */
  function fit(): void {
    pxPerBeat = Math.max(0.5, Math.min(30, (scroll.clientWidth - 4) / (bars.length * 4)));
    const zoom = page.querySelector<HTMLInputElement>('[data-slider="zoom"]');
    if (zoom) zoom.value = String(pxPerBeat);
    showSlider('zoom', pxPerBeat);
    draw();
  }
  listen('[data-fit]', 'click', () => fit());
  // A new length fits the new track to the view.
  listen('[data-bars]', 'change', () => fit());

  // ── the visualiser ───────────────────────────────────────────────────────────
  const vizCanvas = q<HTMLCanvasElement>('[data-viz]');
  const richCanvas = q<HTMLCanvasElement>('[data-viz-rich]');
  let vizMode: VizMode = 'bars';
  try { vizMode = VIZ_MODES.find(m => m === localStorage.getItem(VIZ_KEY)) ?? 'bars'; } catch { /* private mode */ }
  q<HTMLSelectElement>('[data-viz-mode]').value = vizMode;
  let rich: VizHandle | null = null;
  const bins = new Uint8Array(1024);
  function drawViz(): void {
    const show = vizMode === 'bars' || vizMode === 'scope';
    vizCanvas.hidden = !show;
    if (!show) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = vizCanvas.clientWidth || 600, h = vizCanvas.clientHeight || 120;
    if (vizCanvas.width !== Math.round(w * dpr)) vizCanvas.width = Math.round(w * dpr);
    if (vizCanvas.height !== Math.round(h * dpr)) vizCanvas.height = Math.round(h * dpr);
    const cx = vizCanvas.getContext('2d');
    if (!cx) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    if (!analyser || !station) return;
    const hue = SECTION_HUE[bars[Math.max(0, playheadBar)]?.section ?? 'intro'] ?? 200;
    if (vizMode === 'bars') {
      analyser.getByteFrequencyData(bins);
      const count = 64;
      for (let i = 0; i < count; i++) {
        // Bins spread on a log scale, so the bass is not one bar at the edge.
        const from = Math.floor(2 ** ((i / count) * Math.log2(bins.length / 2)));
        const v = (bins[Math.min(bins.length - 1, from)] ?? 0) / 255;
        cx.fillStyle = `hsl(${hue + i * 2} 70% ${45 + v * 15}%)`;
        const bw = w / count;
        cx.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
      }
    } else {
      analyser.getByteTimeDomainData(bins);
      cx.strokeStyle = `hsl(${hue} 70% 50%)`;
      cx.lineWidth = 2;
      cx.beginPath();
      for (let i = 0; i < bins.length; i++) {
        const x = (i / (bins.length - 1)) * w, y = ((bins[i] ?? 128) / 255) * h;
        if (i) cx.lineTo(x, y); else cx.moveTo(x, y);
      }
      cx.stroke();
    }
  }
  /** The full visualiser (MilkDrop, in the brand's colours), mounted only while chosen. */
  async function syncRichViz(): Promise<void> {
    const want = vizMode === 'milkdrop' && !!analyser;
    richCanvas.hidden = !want;
    if (!want) { rich?.destroy(); rich = null; return; }
    if (rich) return;
    rich = await mountViz(richCanvas, host, defaultVizPresetId(false), () => { rich = null; }, null, { audio: { analyser } });
  }
  listen('[data-viz-mode]', 'change', (_e, el) => {
    if (!(el instanceof HTMLSelectElement)) return;
    vizMode = VIZ_MODES.find(m => m === el.value) ?? 'bars';
    try { localStorage.setItem(VIZ_KEY, vizMode); } catch { /* private mode */ }
    drawViz();
    void syncRichViz();
  });

  const barAt = (e: MouseEvent): number => {
    const r = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(bars.length - 1, Math.floor((e.clientX - r.left + scroll.scrollLeft) / (4 * pxPerBeat))));
  };
  canvas.addEventListener('click', e => {
    selected = barAt(e);
    // A click on the section ruler plays from the start of that section.
    if (e.clientY - canvas.getBoundingClientRect().top < RULER) {
      let start = selected;
      while (start > 0 && bars[start - 1]!.section === bars[selected]!.section) start--;
      selected = start; inspect(); play(start); return;
    }
    inspect(); draw();
  });
  canvas.addEventListener('dblclick', e => { selected = barAt(e); inspect(); play(selected); });
  listen('[data-render]', 'click', () => { void render().catch(err => { status.textContent = `${t('Could not make the track')}: ${String(err)}`; }); });
  listen('[data-download]', 'click', () => {
    void (async () => {
      const { blob, format } = await encoded();
      await host.export.download(blob, fileName(format));
      status.textContent = t('File handed to your device’s save/download flow.');
    })().catch(err => { status.textContent = String(err); });
  });
  listen('[data-save]', 'click', () => {
    void (async () => {
      if (!canUpload(host.assets)) { status.textContent = t('This host cannot save to the library.'); return; }
      const { blob, format } = await encoded();
      await host.assets._uploadUserAsset({
        id: `user/tune/${Date.now()}-${state.mood}-${state.seed}`, type: 'audio', format, blob,
        meta: {
          name: trackName(), tags: ['music', 'generated', 'lolly-sings'],
          lofi: { mood: state.mood, seed: state.seed }, generator: musicStateParams(state),
          durationMs: Math.round((renderedBuffer?.duration ?? 0) * 1000),
        },
      });
      document.dispatchEvent(new Event('lolly:neuro-tracks'));
      status.textContent = t('Saved to your library.');
    })().catch(err => { status.textContent = String(err); });
  });
  listen('[data-link]', 'click', () => {
    void navigator.clipboard.writeText(`${location.origin}${location.pathname}#/music?${musicStateParams(state)}`)
      .then(() => { status.textContent = t('Link copied: it opens this track, ready to edit.'); })
      .catch(() => { status.textContent = t('Could not copy the link.'); });
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ') { e.preventDefault(); if (station) stopPlayback(); else play(selected); }
    else if (e.key === 'ArrowRight' && e.shiftKey) setSeed(state.seed + 1);
    else if (e.key === 'ArrowLeft' && e.shiftKey) setSeed(state.seed - 1);
  };
  document.addEventListener('keydown', onKey);
  const onResize = (): void => draw();
  window.addEventListener('resize', onResize);
  scroll.addEventListener('scroll', () => draw(), { passive: true });

  // The seed as a design-tool number: drag across it to slide through seeds. While it
  // slides, only the picture follows; letting go plays and links the seed it stopped on.
  const detachScrub = attachScrub(page, {
    selector: '[data-seed]', min: 0, max: 4294967295, unitPerPx: 1, touch: true,
    onDrag: (_el, value) => { state.seed = Math.round(value); bars = composeTrack(state); times = barTimes(bars); meta(); sectionChips(); draw(); },
    onCommit: (el) => setSeed(Math.floor(Number(el.value) || 0)),
  });
  // The inspector's per-section pickers: every bar of that kind of section takes the choice.
  page.addEventListener('change', e => {
    const el = e.target;
    if (!(el instanceof HTMLSelectElement) || !el.dataset.secPick) return;
    const section = bars[selected]?.section;
    if (!section) return;
    const v: SectionVoices = { ...state.sections[section] };
    const value = el.value || undefined;
    if (el.dataset.secPick === 'keys') v.keys = LOFI_KEYS.find(x => x === value);
    if (el.dataset.secPick === 'lead') v.lead = LOFI_LEADS.find(x => x === value);
    if (el.dataset.secPick === 'bass') v.bass = LOFI_BASSES.find(x => x === value);
    if (!v.keys) delete v.keys;
    if (!v.lead) delete v.lead;
    if (!v.bass) delete v.bass;
    if (Object.keys(v).length) state.sections[section] = v; else delete state.sections[section];
    recompose();
  });
  page.addEventListener('click', e => {
    const jump = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-jump]') : null;
    if (!jump) return;
    selected = Number(jump.dataset.jump); inspect(); play(selected);
  });

  writeLink(); meta(); inspect(); sectionChips(); fit(); drawViz();
  view._cleanup = () => {
    detachScrub();
    rich?.destroy();
    stopPlayback();
    rendering++;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    void ctx?.close();
  };
}
