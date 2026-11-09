// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator (#/music): a track editor for Lolly Sings, so a person or a brand
 * can dial in a track and keep the result.
 *
 * One row of controls (play, style, seed, length, sound, make, link), a visualiser, and
 * the track laid out like a sequence editor: the sections and chords above a lane for
 * each part, every note drawn. Click a section in a lane to change that part's
 * instrument in every section of that kind (the bass in every drop, the lead in every
 * solo); click the section ruler to play from there. The seed is a design-tool number:
 * type one, step it, shuffle it, or drag across it to slide through seeds and watch the
 * tune change. Colours come from the brand's palette, with extra hues only where the
 * palette runs out.
 *
 * Every setting lives in the link, so a link plays and edits the same track for anyone
 * who opens it: the composer is deterministic (engine/src/lofi-compose.ts). Making the
 * track renders the whole of it offline with progress; it can then be downloaded or
 * saved to the library, with the recipe kept in the asset's details.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import {
  lofiStream, lofiSectionName, isDanceMood, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES, LOFI_SNARES, LOFI_HATS, LOFI_DRUM_VOICES, LOFI_BLENDS,
  type LofiBar, type LofiBlend, type LofiMood, type LofiStyle,
} from '../../../../engine/src/lofi-compose.ts';
import { LofiStation, LOFI_MIX, type LofiMix, type LofiSettings } from '../lib/lofi-station.ts';
import { LOFI_STATION_MOODS, lofiStationName } from '../lib/neurospicy-lofi.ts';
import { LOFI_KEYS_NAME, LOFI_LEAD_NAME, LOFI_BASS_NAME, LOFI_SNARE_NAME, LOFI_HATS_NAME } from '../lib/lofi-names.ts';
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
const DRUM_VOICES = new Set<string>(LOFI_DRUM_VOICES);
const MIX_KEYS: readonly (keyof LofiMix)[] = ['keys', 'bass', 'lead', 'drums', 'reverb', 'texture'];
/** The pitched tracks, whose instrument can be chosen for the whole track or a kind of section. */
type Pitched = 'lead' | 'keys' | 'bass';
const PITCHED: readonly Pitched[] = ['lead', 'keys', 'bass'];

/** Lane heights in CSS pixels: the section ruler, the chords, then each track. */
const RULER = 26;
const CHORDS = 22;
const LANE: Record<Track, number> = { lead: 64, keys: 64, bass: 64, drums: 52, fx: 30 };
const LENGTHS = [8, 16, 32, 48, 64, 96, 128, 192, 256];
type VizMode = 'off' | 'bars' | 'scope' | 'milkdrop';
const VIZ_MODES: readonly VizMode[] = ['bars', 'scope', 'milkdrop', 'off'];
const VIZ_LABEL: Record<VizMode, string> = { bars: 'Visualiser: bars', scope: 'Visualiser: scope', milkdrop: 'Visualiser: full', off: 'Visualiser: off' };
const VIZ_KEY = 'lolly:musicViz';

/** Instruments a person chose for one kind of section (every drop, every build…). */
export type SectionVoices = Partial<Pick<LofiStyle, 'keys' | 'lead' | 'bass' | 'snare' | 'hats'>>;
const SECTION_NAMES = ['intro', 'verse', 'build', 'drop', 'break', 'bridge', 'feature', 'groove', 'drums', 'outro'] as const;

const BLEND_LABEL: Record<LofiBlend, string> = { fantasy: 'Fantasy', kpop: 'K-pop', dream: 'Dreamscape', metal: 'Metal' };

export interface MusicState {
  mood: LofiMood;
  /** A flavour blended into the style (dance styles only). */
  blend?: LofiBlend;
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
    const snare = pick(q.get(`${name}.snare`), LOFI_SNARES);
    const hats = pick(q.get(`${name}.hats`), LOFI_HATS);
    if (keys) v.keys = keys;
    if (lead) v.lead = lead;
    if (bass) v.bass = bass;
    if (snare) v.snare = snare;
    if (hats) v.hats = hats;
    if (keys || lead || bass || snare || hats) sections[name] = v;
  }
  return {
    sections,
    mood: pick(q.get('style'), LOFI_STATION_MOODS) ?? DEFAULT_STATE.mood,
    blend: pick(q.get('blend'), LOFI_BLENDS),
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
  if (s.blend) q.set('blend', s.blend);
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
    if (v?.snare) q.set(`${name}.snare`, v.snare);
    if (v?.hats) q.set(`${name}.hats`, v.hats);
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
  const stream = lofiStream(s.seed, { mood: s.mood, style: fixedStyle(s), ...(s.blend && isDanceMood(s.mood) ? { blend: s.blend } : {}) });
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
  if (voice === 'soar') return 'bass';
  return voice === 'keys' || voice === 'lead' || voice === 'bass' ? voice : 'fx';
}

/** The kinds of section, in the order their colours are given out. */
const SECTION_ORDER = ['drop', 'verse', 'build', 'break', 'intro', 'outro', 'bridge', 'feature', 'groove', 'drums'];

/** A colour's hue, saturation and lightness (0..360, 0..1, 0..1), or null when it is not a hex colour. */
function hslOf(colour: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return null;
  const hex = m[1]!.length === 3 ? [...m[1]!].map(c => c + c).join('') : m[1]!;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, sat, l];
}

/**
 * The editor's colours from the brand's palette: its vivid colours, one hue apart, in
 * the palette's order. A palette with fewer than `want` gets more by turning the hue of
 * its first colour, so every track and section still has its own colour.
 */
export function musicPalette(colours: readonly string[], want: number): string[] {
  const picked: Array<[number, number, number]> = [];
  for (const c of colours) {
    const hsl = hslOf(c);
    if (!hsl || hsl[1] < 0.3 || hsl[2] < 0.22 || hsl[2] > 0.8) continue;
    if (picked.some(p => Math.min(Math.abs(p[0] - hsl[0]), 360 - Math.abs(p[0] - hsl[0])) < 24)) continue;
    picked.push(hsl);
  }
  const base = picked[0] ?? [330, 0.7, 0.5];
  for (let n = 1; picked.length < want; n++) picked.push([(base[0] + n * 137.5) % 360, Math.max(0.5, base[1]), Math.min(0.55, Math.max(0.42, base[2]))]);
  return picked.slice(0, want).map(([h, sat, l]) => `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%)`);
}

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
  // Lane heights, grown to fill the screen's height (see fitHeight).
  const lane: Record<Track, number> = { ...LANE };
  const muted = new Set<Track>();
  const solo = new Set<Track>();
  // The brand's colours, until they load a neutral set of the same shape.
  let trackColour: Record<Track, string> = { lead: 'hsl(330 65% 52%)', keys: 'hsl(200 65% 45%)', bass: 'hsl(150 60% 38%)', drums: 'hsl(30 75% 50%)', fx: 'hsl(275 55% 55%)' };
  let sectionColour = new Map<string, string>(SECTION_ORDER.map((s, i) => [s, `hsl(${(i * 47) % 360} 60% 50%)`]));

  const namesOf = (tr: Pitched): Record<string, string> => tr === 'keys' ? LOFI_KEYS_NAME : tr === 'lead' ? LOFI_LEAD_NAME : LOFI_BASS_NAME;
  const valuesOf = (tr: Pitched): readonly string[] => (tr === 'keys' ? LOFI_KEYS : tr === 'lead' ? LOFI_LEADS : LOFI_BASSES).filter(v => v !== 'none');
  const fillSelect = (sel: HTMLSelectElement, tr: Pitched, current: string | undefined, auto: string): void => {
    sel.replaceChildren(new Option(auto, ''), ...valuesOf(tr).map(v => new Option(namesOf(tr)[v] ?? v, v, false, v === current)));
  };
  const iconBtn = (attr: string, name: Parameters<typeof icon>[0], label: string, extra = ''): string =>
    `<button type="button" class="btn btn--ghost btn--sm ms-icon" ${attr} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"${extra}>${icon(name, { size: 18 })}</button>`;
  const slider = (id: string, label: string, min: number, max: number, step: number, value: number): string =>
    `<label class="ms-slider"><span>${escapeHtml(label)}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-slider="${id}"><output data-out="${id}"></output></label>`;

  const page = document.createElement('section');
  page.className = 'ms-page';
  page.setAttribute('aria-label', t('Music generator'));
  page.innerHTML = `
    <div class="ms-bar" role="toolbar" aria-label="${escapeHtml(t('Track'))}">
      <button type="button" class="btn btn--primary ms-play" data-play aria-label="${escapeHtml(t('Play'))}" title="${escapeHtml(t('Play or stop (space)'))}">
        <span data-play-icon>${icon('play', { size: 18 })}</span><span data-stop-icon hidden>${icon('pause', { size: 18 })}</span>
      </button>
      <span class="ms-time" data-pos></span>
      <select class="field-select field-select--sm" data-style aria-label="${escapeHtml(t('Style'))}">${LOFI_STATION_MOODS.map(m => `<option value="${m}"${m === state.mood ? ' selected' : ''}>${escapeHtml(lofiStationName(m))}</option>`).join('')}</select>
      <select class="field-select field-select--sm" data-blend aria-label="${escapeHtml(t('Blend'))}" title="${escapeHtml(t('Blend a flavour into the style'))}">
        <option value="">${escapeHtml(t('No blend'))}</option>${LOFI_BLENDS.map(b => `<option value="${b}"${b === state.blend ? ' selected' : ''}>${escapeHtml(t(BLEND_LABEL[b]))}</option>`).join('')}
      </select>
      <span class="ms-seed" role="group" aria-label="${escapeHtml(t('Seed'))}">
        ${iconBtn('data-seed-step="-1"', 'chevronLeft', t('Previous seed'))}
        <input type="number" class="field-input field-input--sm ms-seed-input" min="0" max="4294967295" value="${state.seed}" data-seed aria-label="${escapeHtml(t('Seed'))}" title="${escapeHtml(t('The seed: type one, or drag across it to slide through seeds'))}">
        ${iconBtn('data-seed-step="1"', 'chevronRight', t('Next seed'))}
        ${iconBtn('data-dice', 'sparkle', t('Surprise me: a new seed'))}
      </span>
      <select class="field-select field-select--sm" data-bars aria-label="${escapeHtml(t('Length'))}">${LENGTHS.map(n => `<option value="${n}"${n === state.bars ? ' selected' : ''}>${n} ${escapeHtml(t('bars'))}</option>`).join('')}</select>
      <span class="ms-meta" data-meta></span>
      <span class="ms-bar-end">
        ${iconBtn('data-panel="sound" aria-expanded="false"', 'sliders', t('Sound and mix'))}
        ${iconBtn('data-panel="make" aria-expanded="false"', 'download', t('Make, download or save the track'))}
        ${iconBtn('data-link', 'link', t('Copy a link to this track'))}
      </span>
    </div>
    <div class="ms-panel" data-panel-body="sound" hidden>
      ${slider('lead', t('Lead'), 0, 1.6, 0.05, state.mix.lead)}
      ${slider('keys', t('Keys'), 0, 1.6, 0.05, state.mix.keys)}
      ${slider('bass', t('Bass'), 0, 1.6, 0.05, state.mix.bass)}
      ${slider('drums', t('Drums'), 0, 1.6, 0.05, state.mix.drums)}
      ${slider('reverb', t('Room'), 0, 2, 0.05, state.mix.reverb)}
      ${slider('texture', t('Texture'), 0, 1, 0.05, state.texture)}
      ${slider('bright', t('Brightness'), 0.5, 1.8, 0.05, state.bright ?? 1)}
      ${slider('drive', t('Drive'), 0.8, 4.5, 0.1, state.drive ?? 2)}
    </div>
    <div class="ms-panel ms-panel--make" data-panel-body="make" hidden>
      <button type="button" class="btn btn--primary btn--sm" data-render>${escapeHtml(t('Make the track'))}</button>
      <progress max="1" value="0" data-progress hidden></progress>
      <select class="field-select field-select--sm" data-format aria-label="${escapeHtml(t('File type'))}"><option value="m4a">M4A</option><option value="wav">WAV</option></select>
      <button type="button" class="btn btn--sm" data-download disabled>${escapeHtml(t('Download'))}</button>
      <button type="button" class="btn btn--sm" data-save disabled>${escapeHtml(t('Save to library'))}</button>
    </div>
    <div class="ms-stage">
      <canvas class="ms-viz" data-viz aria-hidden="true"></canvas>
      <canvas class="ms-viz" data-viz-rich aria-hidden="true" hidden></canvas>
      ${iconBtn('data-viz-mode', 'neuroBeat', t('Visualiser'))}
    </div>
    <div class="ms-editor">
      <div class="ms-heads">
        <div class="ms-lane-head ms-zoom" style="height:${RULER + CHORDS}px">
          ${iconBtn('data-zoom="-1"', 'zoomOut', t('Zoom out'))}
          ${iconBtn('data-fit', 'fitAll', t('Fit the track'))}
          ${iconBtn('data-zoom="1"', 'zoomIn', t('Zoom in'))}
        </div>
        ${TRACKS.map(tr => `
          <div class="ms-lane-head ms-track" data-track="${tr}" style="height:${lane[tr]}px">
            <span class="ms-swatch" data-swatch="${tr}" aria-hidden="true"></span>
            <span class="ms-track-name">${escapeHtml(t(TRACK_LABEL[tr]))}</span>
            ${tr === 'fx' ? '' : tr === 'drums'
              ? `<button type="button" class="ms-ms" data-drums aria-pressed="${state.drums}" title="${escapeHtml(t('Drums on or off'))}">${escapeHtml(t('On'))}</button>`
              : `<select class="field-select field-select--sm ms-pick" data-pick="${tr}" aria-label="${escapeHtml(t(TRACK_LABEL[tr]))}"></select>`}
            ${tr === 'fx' ? '' : `<button type="button" class="ms-ms" data-mute="${tr}" aria-pressed="false" title="${escapeHtml(t('Mute'))}">M</button><button type="button" class="ms-ms" data-solo="${tr}" aria-pressed="false" title="${escapeHtml(t('Solo'))}">S</button>`}
          </div>`).join('')}
      </div>
      <div class="ms-scroll" data-scroll>
        <canvas class="ms-canvas" data-canvas role="img" aria-label="${escapeHtml(t('The track: its sections, chords and every note'))}"></canvas>
        <div class="ms-spacer" data-spacer></div>
      </div>
    </div>
    <p class="ms-hint" data-hint role="status"></p>
    <div class="ms-pop" data-pop hidden role="dialog" aria-label="${escapeHtml(t('Instrument for this kind of section'))}">
      <p class="ms-pop-title" data-pop-title></p>
      <select class="field-select field-select--sm" data-pop-pick></select>
      <select class="field-select field-select--sm" data-pop-pick2 hidden></select>
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
  const hint = q<HTMLElement>('[data-hint]');
  const playBtn = q<HTMLButtonElement>('[data-play]');
  const pos = q<HTMLElement>('[data-pos]');
  const progress = q<HTMLProgressElement>('[data-progress]');
  const downloadBtn = q<HTMLButtonElement>('[data-download]');
  const saveBtn = q<HTMLButtonElement>('[data-save]');
  const pop = q<HTMLElement>('[data-pop]');
  const popPick = q<HTMLSelectElement>('[data-pop-pick]');
  const popPick2 = q<HTMLSelectElement>('[data-pop-pick2]');
  const say = (text: string): void => { hint.textContent = text; };
  const HINT = t('Click a section in a track to change its instrument there. Click the top row to play from a section.');
  for (const tr of PITCHED) fillSelect(q<HTMLSelectElement>(`[data-pick="${tr}"]`), tr, state[tr], t('Auto'));

  // ── drawing ─────────────────────────────────────────────────────────────────
  let height = RULER + CHORDS + TRACKS.reduce((h, tr) => h + lane[tr], 0);
  /** Grow the lanes so the editor reaches the bottom of the screen, on a phone as on a monitor. */
  function fitHeight(): void {
    const top = q<HTMLElement>('.ms-editor').getBoundingClientRect().top + window.scrollY;
    const room = window.innerHeight - top - 56;
    const base = TRACKS.reduce((h, tr) => h + LANE[tr], 0);
    const scale = Math.max(0.85, Math.min(2.2, (room - RULER - CHORDS) / base));
    for (const tr of TRACKS) {
      lane[tr] = Math.round(LANE[tr] * (tr === 'fx' ? Math.min(scale, 1.3) : scale));
      const head = page.querySelector<HTMLElement>(`.ms-track[data-track="${tr}"]`);
      if (head) head.style.height = `${lane[tr]}px`;
    }
    height = RULER + CHORDS + TRACKS.reduce((h, tr) => h + lane[tr], 0);
  }
  const laneTop = (tr: Track): number => RULER + CHORDS + TRACKS.slice(0, TRACKS.indexOf(tr)).reduce((h, x) => h + lane[x], 0);
  const beatX = (bar: number, beat: number): number => (bar * 4 + beat) * pxPerBeat;
  const sectionLabel = (sec: string): string => {
    const name = lofiSectionName(state.mood, bars[0]!.section === sec ? bars[0]!.section : bars.find(b => b.section === sec)?.section ?? 'verse');
    return t(name.charAt(0).toUpperCase() + name.slice(1));
  };
  const instrumentOf = (bar: LofiBar, tr: Pitched): string => {
    const st = bar.tune.style;
    const v = tr === 'keys' ? bar.voices?.keys ?? st.keys : tr === 'lead' ? bar.voices?.lead ?? st.lead : bar.voices?.bass ?? st.bass;
    return namesOf(tr)[v] ?? v;
  };
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
    // Sections: a tinted band for each run of bars in one section, its name on the ruler,
    // and in each pitched lane the instrument it plays there.
    cx.font = '600 11px system-ui, sans-serif';
    for (let i = 0; i < bars.length;) {
      let j = i;
      while (j + 1 < bars.length && bars[j + 1]!.section === bars[i]!.section && bars[j + 1]!.index === bars[j]!.index + 1) j++;
      const sec = bars[i]!.section;
      const colour = sectionColour.get(sec) ?? muteInk;
      const x0 = beatX(i, 0), x1 = beatX(j + 1, 0);
      if (x1 >= offset && x0 <= offset + width && sec !== 'rest') {
        cx.fillStyle = colour;
        cx.globalAlpha = 0.12;
        cx.fillRect(x0, 0, x1 - x0, height);
        cx.globalAlpha = 1;
        cx.fillRect(x0, 0, x1 - x0, 4);
        cx.fillStyle = ink;
        const label = sectionLabel(sec);
        if (cx.measureText(label).width + 8 < x1 - x0) cx.fillText(label, x0 + 4, 18);
        cx.save();
        cx.font = '10px system-ui, sans-serif';
        cx.fillStyle = muteInk;
        for (const tr of PITCHED) {
          const name = instrumentOf(bars[i]!, tr);
          const changed = i === 0 || instrumentOf(bars[i - 1]!, tr) !== name;
          if (changed && name && cx.measureText(name).width + 8 < x1 - x0 && bars.slice(i, j + 1).some(b => b.notes.some(n => trackOf(n.voice) === tr))) cx.fillText(name, x0 + 4, laneTop(tr) + 11);
        }
        cx.restore();
      }
      i = j + 1;
    }
    // Bar lines and the chord lane. A chord's name is drawn only when it has room.
    cx.font = '11px system-ui, sans-serif';
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
    const pitchRange: Record<Pitched, [number, number]> = { lead: [52, 96], keys: [48, 80], bass: [24, 64] };
    for (let i = first; i < last; i++) {
      const bar = bars[i]!;
      for (const n of bar.notes) {
        const tr = trackOf(n.voice);
        const silent = muted.has(tr) || (solo.size > 0 && !solo.has(tr)) || (tr === 'drums' && !state.drums);
        const x = beatX(i, n.beat);
        const top = laneTop(tr);
        cx.globalAlpha = silent ? 0.15 : 0.5 + n.vel * 0.5;
        cx.fillStyle = trackColour[tr];
        if (tr === 'drums') {
          const row = n.voice === 'kick' ? 2 : n.voice === 'snare' || n.voice === 'rim' || n.voice === 'tom' ? 1 : 0;
          cx.fillRect(x, top + 8 + row * 14, 3, 9);
        } else if (tr === 'fx') {
          cx.beginPath(); cx.arc(x + 3, top + lane.fx / 2, 4, 0, Math.PI * 2); cx.fill();
        } else {
          const [lo, hi] = pitchRange[tr];
          const y = top + 14 + (1 - (Math.min(hi, Math.max(lo, n.midi)) - lo) / (hi - lo)) * (lane[tr] - 20);
          cx.fillRect(x, y, Math.max(2, n.dur * pxPerBeat - 1), 4);
        }
      }
    }
    cx.globalAlpha = 1;
    // What has been made so far, under the ruler, then the selection and the playhead.
    if (rendered > 0) { cx.fillStyle = trackColour.bass; cx.fillRect(0, RULER - 4, total * rendered, 3); }
    cx.strokeStyle = ink; cx.lineWidth = 1;
    cx.strokeRect(beatX(selected, 0) + 0.5, RULER + 0.5, 4 * pxPerBeat - 1, height - RULER - 1);
    if (playheadBar >= 0) {
      cx.fillStyle = ink;
      cx.fillRect(beatX(playheadBar, playheadBeat), 0, 2, height);
    }
  }

  function meta(): void {
    const first = bars[0]!.tune;
    q<HTMLElement>('[data-meta]').textContent = `${first.key} · ${first.bpm} bpm`;
    if (!station) pos.textContent = `0:00 / ${clock(times.total)}`;
  }

  // The brand's colours, for the tracks and the sections.
  void (async () => {
    let colours: string[] = [];
    try { colours = (await host.tokens?.colors())?.map(c => c.value) ?? []; } catch { /* no tokens: the neutral set */ }
    const pal = musicPalette(colours, TRACKS.length + 4);
    trackColour = { lead: pal[0]!, keys: pal[1]!, bass: pal[2]!, drums: pal[3]!, fx: pal[4]! };
    sectionColour = new Map(SECTION_ORDER.map((s, i) => [s, pal[i % pal.length]!]));
    for (const tr of TRACKS) page.querySelector<HTMLElement>(`[data-swatch="${tr}"]`)?.style.setProperty('background', trackColour[tr]);
    draw();
  })();

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
    writeLink(); meta(); draw();
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
    return { mood: state.mood, drums: state.drums, texture: state.texture, style: fixedStyle(state), startBar, bars: state.bars, shape: shapeBar(state), ...(state.blend && isDanceMood(state.mood) ? { blend: state.blend } : {}) };
  }
  const showPlaying = (on: boolean): void => {
    q<HTMLElement>('[data-play-icon]').hidden = on;
    q<HTMLElement>('[data-stop-icon]').hidden = !on;
    playBtn.setAttribute('aria-label', on ? t('Stop') : t('Play'));
    playBtn.setAttribute('aria-pressed', String(on));
  };
  function stopPlayback(): void {
    station?.stop(0.15);
    station = null;
    cancelAnimationFrame(raf);
    showPlaying(false);
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
    showPlaying(true);
    cancelAnimationFrame(raf);
    const tick = (): void => {
      if (!ctx || !station) return;
      const at = times.starts[startedBar]! + Math.max(0, ctx.currentTime - startedAt);
      if (at >= times.total + 1.5) { stopPlayback(); playheadBar = -1; meta(); draw(); return; }
      let b = startedBar;
      while (b + 1 < bars.length && times.starts[b + 1]! <= at) b++;
      playheadBar = b;
      playheadBeat = Math.min(4, (at - times.starts[b]!) / (240 / bars[b]!.tune.bpm) * 4);
      pos.textContent = `${clock(at)} / ${clock(times.total)}`;
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
    say(t('Making the track…'));
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
    say(t('Made. Download the track or save it to your library.'));
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

  // ── the section picker ───────────────────────────────────────────────────────
  // A click in a lane opens a picker for that part in that kind of section: an
  // instrument for the lead, keys or bass, the snare and the cymbals for the drums.
  let popFor: { tr: Pitched | 'drums'; section: string } | null = null;
  const kitSelect = (sel: HTMLSelectElement, values: readonly string[], names: Record<string, string>, current: string | undefined, composed: string): void => {
    sel.replaceChildren(new Option(`${t('As composed')}: ${composed}`, ''), ...values.map(v => new Option(names[v] ?? v, v, false, v === current)));
  };
  function openPop(tr: Pitched | 'drums', bar: LofiBar, x: number, y: number): void {
    popFor = { tr, section: bar.section };
    q<HTMLElement>('[data-pop-title]').textContent = `${t(TRACK_LABEL[tr])} · ${sectionLabel(bar.section)}`;
    const chosen = state.sections[bar.section];
    if (tr === 'drums') {
      const st = bar.tune.style;
      kitSelect(popPick, LOFI_SNARES, LOFI_SNARE_NAME, chosen?.snare, LOFI_SNARE_NAME[st.snare]);
      kitSelect(popPick2, LOFI_HATS, LOFI_HATS_NAME, chosen?.hats, LOFI_HATS_NAME[st.hats]);
      popPick.setAttribute('aria-label', t('Snare'));
      popPick2.setAttribute('aria-label', t('Cymbals'));
      popPick2.hidden = false;
    } else {
      fillSelect(popPick, tr, chosen?.[tr], `${t('As composed')}: ${instrumentOf(bars.find(b => b.section === bar.section && !state.sections[b.section]?.[tr]) ?? bar, tr)}`);
      popPick.setAttribute('aria-label', t(TRACK_LABEL[tr]));
      popPick2.hidden = true;
    }
    const host = page.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(host.width - 240, x - host.left))}px`;
    pop.style.top = `${y - host.top + 8}px`;
    pop.hidden = false;
    popPick.focus();
  }
  const closePop = (): void => { pop.hidden = true; popFor = null; };
  const choose = (second: boolean): void => {
    if (!popFor) return;
    const { tr, section } = popFor;
    const v: SectionVoices = { ...state.sections[section] };
    const value = (second ? popPick2 : popPick).value || undefined;
    if (tr === 'keys') v.keys = LOFI_KEYS.find(x => x === value);
    if (tr === 'lead') v.lead = LOFI_LEADS.find(x => x === value);
    if (tr === 'bass') v.bass = LOFI_BASSES.find(x => x === value);
    if (tr === 'drums' && !second) v.snare = LOFI_SNARES.find(x => x === value);
    if (tr === 'drums' && second) v.hats = LOFI_HATS.find(x => x === value);
    for (const key of ['keys', 'lead', 'bass', 'snare', 'hats'] as const) if (!v[key]) delete v[key];
    if (Object.keys(v).length) state.sections[section] = v; else delete state.sections[section];
    if (tr !== 'drums') closePop();
    recompose();
  };
  popPick.addEventListener('change', () => choose(false));
  popPick2.addEventListener('change', () => choose(true));

  // ── wiring ───────────────────────────────────────────────────────────────────
  const listen = <K extends keyof HTMLElementEventMap>(sel: string, type: K, fn: (e: HTMLElementEventMap[K], el: HTMLElement) => void): void => {
    for (const el of page.querySelectorAll<HTMLElement>(sel)) el.addEventListener(type, e => fn(e, el));
  };
  listen('[data-play]', 'click', () => { if (station) stopPlayback(); else play(selected); });
  const blendSelect = q<HTMLSelectElement>('[data-blend]');
  // A blend flavours the dance styles; the Lofi moods have none.
  const showBlend = (): void => { blendSelect.disabled = !isDanceMood(state.mood); };
  listen('[data-style]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.mood = parseMusicState(`style=${el.value}`).mood; showBlend(); recompose(); fit(); } });
  listen('[data-blend]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.blend = LOFI_BLENDS.find(b => b === el.value); recompose(); } });
  showBlend();
  const setSeed = (seed: number): void => {
    state.seed = ((seed % 4294967296) + 4294967296) % 4294967296;
    q<HTMLInputElement>('[data-seed]').value = String(state.seed);
    recompose();
  };
  listen('[data-seed]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) setSeed(Math.floor(Number(el.value) || 0)); });
  listen('[data-seed-step]', 'click', (_e, el) => setSeed(state.seed + Number(el.dataset.seedStep)));
  listen('[data-dice]', 'click', () => setSeed(crypto.getRandomValues(new Uint32Array(1))[0]!));
  listen('[data-bars]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.bars = Number(el.value); recompose(); fit(); } });
  listen('[data-pick]', 'change', (_e, el) => {
    if (!(el instanceof HTMLSelectElement)) return;
    const v = el.value || undefined;
    if (el.dataset.pick === 'keys') state.keys = LOFI_KEYS.find(x => x === v);
    if (el.dataset.pick === 'lead') state.lead = LOFI_LEADS.find(x => x === v);
    if (el.dataset.pick === 'bass') state.bass = LOFI_BASSES.find(x => x === v);
    recompose();
  });
  listen('[data-drums]', 'click', (_e, el) => {
    state.drums = !state.drums;
    el.setAttribute('aria-pressed', String(state.drums));
    station?.setDrums(state.drums); writeLink(); draw();
  });
  const toggle = (set: Set<Track>, el: HTMLElement, tr: Track): void => {
    if (set.has(tr)) set.delete(tr); else set.add(tr);
    el.setAttribute('aria-pressed', String(set.has(tr)));
    station?.setMix(effectiveMix()); draw();
  };
  listen('[data-mute]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.mute); if (tr) toggle(muted, el, tr); });
  listen('[data-solo]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.solo); if (tr) toggle(solo, el, tr); });
  // The panels: one open at a time, under the bar.
  listen('[data-panel]', 'click', (_e, el) => {
    const which = el.dataset.panel;
    for (const body of page.querySelectorAll<HTMLElement>('[data-panel-body]')) body.hidden = body.dataset.panelBody !== which || !body.hidden;
    for (const b of page.querySelectorAll<HTMLElement>('[data-panel]')) b.setAttribute('aria-expanded', String(!q<HTMLElement>(`[data-panel-body="${b.dataset.panel}"]`).hidden));
  });
  const showSlider = (id: string, v: number): void => {
    const out = page.querySelector<HTMLOutputElement>(`[data-out="${id}"]`);
    if (out) out.textContent = v.toFixed(2);
  };
  listen('[data-slider]', 'input', (_e, el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const id = el.dataset.slider ?? '';
    const v = Number(el.value);
    showSlider(id, v);
    const mixKey = MIX_KEYS.find(k => k === id);
    if (mixKey && mixKey !== 'texture') { state.mix[mixKey] = v; station?.setMix(effectiveMix()); }
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
    draw();
  }
  listen('[data-fit]', 'click', () => fit());
  listen('[data-zoom]', 'click', (_e, el) => {
    const centre = (scroll.scrollLeft + scroll.clientWidth / 2) / pxPerBeat;
    pxPerBeat = Math.max(0.5, Math.min(30, pxPerBeat * (Number(el.dataset.zoom) > 0 ? 1.5 : 1 / 1.5)));
    draw();
    scroll.scrollLeft = Math.max(0, centre * pxPerBeat - scroll.clientWidth / 2);
    draw();
  });

  // ── the visualiser ───────────────────────────────────────────────────────────
  const vizCanvas = q<HTMLCanvasElement>('[data-viz]');
  const richCanvas = q<HTMLCanvasElement>('[data-viz-rich]');
  const vizBtn = q<HTMLButtonElement>('[data-viz-mode]');
  let vizMode: VizMode = 'bars';
  try { vizMode = VIZ_MODES.find(m => m === localStorage.getItem(VIZ_KEY)) ?? 'bars'; } catch { /* private mode */ }
  const showVizMode = (): void => {
    vizBtn.setAttribute('aria-label', t(VIZ_LABEL[vizMode]));
    vizBtn.title = t(VIZ_LABEL[vizMode]);
    page.querySelector<HTMLElement>('.ms-stage')?.classList.toggle('is-off', vizMode === 'off');
  };
  let rich: VizHandle | null = null;
  const bins = new Uint8Array(1024);
  function drawViz(): void {
    const show = vizMode === 'bars' || vizMode === 'scope';
    vizCanvas.hidden = !show;
    if (!show) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = vizCanvas.clientWidth || 600, h = vizCanvas.clientHeight || 100;
    if (vizCanvas.width !== Math.round(w * dpr)) vizCanvas.width = Math.round(w * dpr);
    if (vizCanvas.height !== Math.round(h * dpr)) vizCanvas.height = Math.round(h * dpr);
    const cx = vizCanvas.getContext('2d');
    if (!cx) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    if (!analyser || !station) return;
    cx.fillStyle = sectionColour.get(bars[Math.max(0, playheadBar)]?.section ?? 'intro') ?? trackColour.lead;
    cx.strokeStyle = cx.fillStyle;
    if (vizMode === 'bars') {
      analyser.getByteFrequencyData(bins);
      const count = 64;
      for (let i = 0; i < count; i++) {
        // Bins spread on a log scale, so the bass is not one bar at the edge.
        const from = Math.floor(2 ** ((i / count) * Math.log2(bins.length / 2)));
        const v = (bins[Math.min(bins.length - 1, from)] ?? 0) / 255;
        const bw = w / count;
        cx.globalAlpha = 0.45 + v * 0.55;
        cx.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
      }
      cx.globalAlpha = 1;
    } else {
      analyser.getByteTimeDomainData(bins);
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
  vizBtn.addEventListener('click', () => {
    vizMode = VIZ_MODES[(VIZ_MODES.indexOf(vizMode) + 1) % VIZ_MODES.length]!;
    try { localStorage.setItem(VIZ_KEY, vizMode); } catch { /* private mode */ }
    showVizMode(); drawViz();
    void syncRichViz();
  });
  showVizMode();

  // ── the timeline ─────────────────────────────────────────────────────────────
  const barAt = (e: MouseEvent): number => {
    const r = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(bars.length - 1, Math.floor((e.clientX - r.left + scroll.scrollLeft) / (4 * pxPerBeat))));
  };
  const laneAt = (y: number): Track | 'ruler' | 'chords' => {
    if (y < RULER) return 'ruler';
    if (y < RULER + CHORDS) return 'chords';
    return TRACKS.find(tr => y >= laneTop(tr) && y < laneTop(tr) + lane[tr]) ?? 'fx';
  };
  canvas.addEventListener('click', e => {
    selected = barAt(e);
    const bar = bars[selected]!;
    const lane = laneAt(e.clientY - canvas.getBoundingClientRect().top);
    if (lane === 'ruler') {
      // The ruler plays from the start of the section.
      let start = selected;
      while (start > 0 && bars[start - 1]!.section === bar.section) start--;
      selected = start; closePop(); play(start); return;
    }
    if ((lane === 'lead' || lane === 'keys' || lane === 'bass' || lane === 'drums') && bar.section !== 'rest') openPop(lane, bar, e.clientX, e.clientY);
    else closePop();
    say(`${t('Bar')} ${selected + 1} · ${sectionLabel(bar.section)} · ${bar.chord || t('rest')}`);
    draw();
  });
  canvas.addEventListener('dblclick', e => { selected = barAt(e); closePop(); play(selected); });
  listen('[data-render]', 'click', () => { void render().catch(err => { say(`${t('Could not make the track')}: ${String(err)}`); }); });
  listen('[data-download]', 'click', () => {
    void (async () => {
      const { blob, format } = await encoded();
      await host.export.download(blob, fileName(format));
      say(t('File handed to your device’s save/download flow.'));
    })().catch(err => { say(String(err)); });
  });
  listen('[data-save]', 'click', () => {
    void (async () => {
      if (!canUpload(host.assets)) { say(t('This host cannot save to the library.')); return; }
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
      say(t('Saved to your library.'));
    })().catch(err => { say(String(err)); });
  });
  listen('[data-link]', 'click', () => {
    void navigator.clipboard.writeText(`${location.origin}${location.pathname}#/music?${musicStateParams(state)}`)
      .then(() => { say(t('Link copied: it opens this track, ready to edit.')); })
      .catch(() => { say(t('Could not copy the link.')); });
  });
  // Space plays and stops, shift and the arrows step the seed, Escape closes the picker
  // or a panel, and then leaves the way the back button does.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (!pop.hidden) { closePop(); return; }
      const open = page.querySelector<HTMLElement>('[data-panel-body]:not([hidden])');
      if (open) { open.hidden = true; return; }
      view.querySelector<HTMLElement>('[data-back-pill]')?.click();
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ') { e.preventDefault(); if (station) stopPlayback(); else play(selected); }
    else if (e.key === 'ArrowRight' && e.shiftKey) setSeed(state.seed + 1);
    else if (e.key === 'ArrowLeft' && e.shiftKey) setSeed(state.seed - 1);
  };
  document.addEventListener('keydown', onKey);
  const onDown = (e: PointerEvent): void => { if (!pop.hidden && e.target instanceof Node && !pop.contains(e.target) && e.target !== canvas) closePop(); };
  document.addEventListener('pointerdown', onDown);
  const onResize = (): void => { fitHeight(); draw(); };
  window.addEventListener('resize', onResize);
  scroll.addEventListener('scroll', () => { closePop(); draw(); }, { passive: true });

  // The seed as a design-tool number: drag across it to slide through seeds. While it
  // slides, only the picture follows; letting go plays and links the seed it stopped on.
  const detachScrub = attachScrub(page, {
    selector: '[data-seed]', min: 0, max: 4294967295, unitPerPx: 1, touch: true,
    onDrag: (_el, value) => { state.seed = Math.round(value); bars = composeTrack(state); times = barTimes(bars); meta(); draw(); },
    onCommit: (el) => setSeed(Math.floor(Number(el.value) || 0)),
  });

  say(HINT);
  writeLink(); meta(); fitHeight(); fit(); drawViz();
  view._cleanup = () => {
    detachScrub();
    rich?.destroy();
    stopPlayback();
    rendering++;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onDown);
    window.removeEventListener('resize', onResize);
    void ctx?.close();
  };
}
