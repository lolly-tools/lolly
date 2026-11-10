// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator (#/music): a track editor for Lolly Sings, so a person or a brand
 * can dial in a track and keep the result.
 *
 * One row of controls (play, shuffle, style, seed, length, key, tempo, reset, sound, make,
 * link), a visualiser, and the track laid out like a sequence editor: the sections and
 * chords above a lane for each part, every note drawn, each instrument in its own shade of
 * the part's colour with its name where it comes in (filled when the person chose that
 * instrument). Click a section in a lane to change that part's instrument in every section
 * of that kind (the bass in every drop, the lead in every solo); click the section ruler to
 * play from there. The seed is a design-tool number: type one, step it, or drag across it
 * to slide through seeds and watch the tune change. Shuffle draws a new style, seed and
 * sound at once (lib/music-shuffle.ts; with Shift, only the sound), and Reset puts every
 * setting back to how the generator opens. The tempo is the composer's for the seed until
 * a person sets their own: the notes stay where they are in the bar, so the tune plays
 * faster or slower and no other part of it changes. The Neurospicy player always plays a
 * style at its own tempo. Colours come from the brand's palette, with extra hues only where
 * the palette runs out. The mix and tone are pill sliders (components/pill-slider.ts).
 *
 * Every setting lives in the link, so a link plays and edits the same track for anyone
 * who opens it: the composer is deterministic (engine/src/lofi-compose.ts). Making the
 * track renders the whole of it offline with progress; it can then be downloaded or
 * saved to the library, with the recipe kept in the asset's details.
 *
 * What each of those writes is said in the Make panel before the click (Andy's approval
 * of 2026-11-10, lib/tune-provenance.ts): a download carries Content Credentials that
 * say the music generator made it, unless the person unticks the switch, and a saved
 * tune records the person's profile name as its maker, the music generator and the
 * Lolly and engine versions. After the click the hint says only what was written.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import {
  lofiSectionName, transposeChordName, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES, LOFI_SNARES, LOFI_HATS, LOFI_DRUM_VOICES, LOFI_PERCUSSION,
  type LofiBar,
} from '../../../../engine/src/lofi-compose.ts';
import { LofiStation, renderStation, type LofiMix, type LofiSettings } from '../lib/lofi-station.ts';
import { LOFI_STATION_MOODS, lofiStationName } from '../lib/neurospicy-lofi.ts';
import { LOFI_KEYS_NAME, LOFI_LEAD_NAME, LOFI_BASS_NAME, LOFI_SNARE_NAME, LOFI_HATS_NAME } from '../lib/lofi-names.ts';
import { encodeWav, encodeM4a, pcmFromAudioBuffer } from '../lib/audio-encode.ts';
import { attachScrub } from '../lib/scrub.ts';
import { mountViz, type VizHandle } from '../lib/butterchurn-viz.ts';
import { defaultVizPresetId } from '../lib/viz-presets.ts';
import { icon } from '../lib/icons.ts';
import { instrumentIcon, iconPath, musicIconNode } from '../lib/instrument-icons.ts';
import { MIX_KEYS, BPM_RANGE, TRANSPOSE_RANGE, parseMusicState, musicStateParams, fixedStyle, shapeBar, composeTrack, barTimes, type MusicState, type SectionVoices } from '../lib/music-state.ts';
import { shuffleMusic } from '../lib/music-shuffle.ts';
import { pillSliderHtml, showPillSlider } from '../components/pill-slider.ts';
import { TUNE_DECLARATION } from '../../../../engine/src/tune-provenance.ts';
import '../styles/parts/music-studio.css';

// The track's settings and how they shape the composer's bars live in lib/music-state.ts
// (pure, shared with the saved-tune renderer and the player); re-exported for the tests.
export { parseMusicState, musicStateParams, composeTrack, shapeBar, BPM_RANGE, TRANSPOSE_RANGE, type MusicState, type SectionVoices } from '../lib/music-state.ts';

type Track = 'lead' | 'keys' | 'bass' | 'drums' | 'fx';
const TRACKS: readonly Track[] = ['lead', 'keys', 'bass', 'drums', 'fx'];
const TRACK_LABEL: Record<Track, string> = { lead: 'Lead', keys: 'Keys', bass: 'Bass', drums: 'Drums', fx: 'Effects' };
/** Which mix level each track's slider moves. */
const TRACK_MIX: Record<Track, keyof LofiMix> = { lead: 'lead', keys: 'keys', bass: 'bass', drums: 'drums', fx: 'fx' };
const DRUM_VOICES = new Set<string>(LOFI_DRUM_VOICES);
/** The pitched tracks, whose instrument can be chosen for the whole track or a kind of section. */
type Pitched = 'lead' | 'keys' | 'bass';
const PITCHED: readonly Pitched[] = ['lead', 'keys', 'bass'];

/** Lane heights in CSS pixels: the section ruler, the chords, then each track. */
const RULER = 26;
const CHORDS = 22;
const LANE: Record<Track, number> = { lead: 64, keys: 64, bass: 64, drums: 52, fx: 40 };
const LENGTHS = [8, 16, 32, 48, 64, 96, 128, 192, 256];
type VizMode = 'off' | 'bars' | 'scope' | 'milkdrop';
const VIZ_MODES: readonly VizMode[] = ['bars', 'scope', 'milkdrop', 'off'];
const VIZ_LABEL: Record<VizMode, string> = { bars: 'Visualiser: bars', scope: 'Visualiser: scope', milkdrop: 'Visualiser: full', off: 'Visualiser: off' };
const VIZ_KEY = 'lolly:musicViz';

const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Which track a note is drawn in. */
function trackOf(voice: string): Track {
  if (DRUM_VOICES.has(voice)) return 'drums';
  if (voice === 'soar' || voice === 'bwah') return 'bass';
  return voice === 'keys' || voice === 'lead' || voice === 'bass' ? voice : 'fx';
}

/**
 * Which of the drum lane's three rows a hit sits on: the kick's row for the low strokes
 * (a tombak's tom, a taiko's don, a djembe's bass, the dunun, a daf's boom), the snare's
 * for the middle ones, the top for the cymbals, rings, beads and bells.
 */
export function drumRow(voice: string, mod = 0, stroke = 0): 0 | 1 | 2 {
  if (voice === 'kick') return 2;
  if (voice === 'snare' || voice === 'rim' || voice === 'tom') return 1;
  if (voice !== 'perc') return 0;
  const kind = LOFI_PERCUSSION[mod] ?? 'shaker';
  if (kind === 'dunun' || ((kind === 'tombak' || kind === 'daf' || kind === 'tanggu' || kind === 'taiko' || kind === 'djembe') && stroke === 1)) return 2;
  if (kind === 'shaker' || kind === 'tambourine' || kind === 'shekere' || kind === 'agogo' || kind === 'gong' || kind === 'cowbell' || (kind === 'daf' && stroke === 3)) return 0;
  return 1;
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

/**
 * A track colour's shade for one instrument, so the notes change colour where the
 * instrument changes: the hue turned and the lightness moved a little, the same for the
 * same instrument every time. Colours that are not hsl() are kept as they are.
 */
export function instrumentShade(colour: string, instrument: string): string {
  const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(colour.trim());
  if (!m) return colour;
  let h = 0;
  for (let i = 0; i < instrument.length; i++) h = (h * 31 + instrument.charCodeAt(i)) >>> 0;
  const turn = [-28, -14, 0, 14, 28][h % 5]!;
  const light = [-7, 0, 7][(h >>> 3) % 3]!;
  const hue = ((Number(m[1]) + turn) % 360 + 360) % 360;
  return `hsl(${Math.round(hue)} ${m[2]}% ${Math.max(28, Math.min(68, Number(m[3]) + light))}%)`;
}

/** Play the shuffle button's pop from the start, however fast the presses come. */
function popAgain(el: HTMLElement): void {
  el.classList.remove('is-popping');
  void el.offsetWidth; // a reflow, so the animation starts over
  el.classList.add('is-popping');
}

interface UploadingAssets { _uploadUserAsset(record: { id: string; type: 'audio'; format: string; blob: Blob; meta: Record<string, unknown> }): Promise<void> }
function canUpload(assets: unknown): assets is UploadingAssets {
  return typeof assets === 'object' && assets !== null && '_uploadUserAsset' in assets && typeof assets._uploadUserAsset === 'function';
}

export function mountMusicStudio(view: HTMLElement & { _cleanup?: () => void }, host: HostV1, params = ''): void {
  document.title = `${t('Music generator')} - Lolly`;
  // The chrome every utility view has: back and home on the left, and on the right the
  // language, theme and profile buttons.
  view.innerHTML = `${backHomeHtml()}<div class="gallery-topright">${langFabHtml()}</div>`;
  mountBackPill(view); mountHomeFab(view);
  mountThemeFab(view.querySelector('.gallery-topright'), host);
  mountProfileFab(view.querySelector('.gallery-topright'), host);
  const detachLang = attachLangMenu(view.querySelector<HTMLElement>('.lang-fab'), host);
  const state = parseMusicState(params);
  // A first visit (a link with no track in it) opens on a track drawn at random, as
  // Shuffle draws one: a style, a seed and a sound to suit them. A link to a track opens
  // that track.
  if (!/(^|[?&])(style|seed)=/.test(params)) Object.assign(state, shuffleMusic(Math.random, { bars: state.bars }));
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
    pillSliderHtml({ label, min, max, step, value, attrs: `data-slider="${id}"` });

  const page = document.createElement('section');
  page.className = 'ms-page';
  page.setAttribute('aria-label', t('Music generator'));
  page.innerHTML = `
    <div class="ms-bar" role="toolbar" aria-label="${escapeHtml(t('Track'))}">
      <button type="button" class="btn btn--primary ms-play" data-play aria-label="${escapeHtml(t('Play'))}" title="${escapeHtml(t('Play or stop (space)'))}">
        <span data-play-icon>${icon('play', { size: 18 })}</span><span data-stop-icon hidden>${icon('pause', { size: 18 })}</span>
      </button>
      <button type="button" class="ms-shuffle" data-shuffle aria-label="${escapeHtml(t('Shuffle style and settings'))}" title="${escapeHtml(t('Shuffle: a new style, seed and sound'))}">${icon('sparkle', { size: 26 })}</button>
      <span class="ms-time" data-pos></span>
      <select class="field-select field-select--sm" data-style aria-label="${escapeHtml(t('Style'))}">${LOFI_STATION_MOODS.map(m => `<option value="${m}"${m === state.mood ? ' selected' : ''}>${escapeHtml(lofiStationName(m))}</option>`).join('')}</select>
      <span class="ms-seed" role="group" aria-label="${escapeHtml(t('Seed'))}">
        ${iconBtn('data-seed-step="-1"', 'chevronLeft', t('Previous seed'))}
        <input type="number" class="field-input field-input--sm ms-seed-input" min="0" max="4294967295" value="${state.seed}" data-seed aria-label="${escapeHtml(t('Seed'))}" title="${escapeHtml(t('The seed: type one, or drag across it to slide through seeds'))}">
        ${iconBtn('data-seed-step="1"', 'chevronRight', t('Next seed'))}
      </span>
      <select class="field-select field-select--sm" data-bars aria-label="${escapeHtml(t('Length'))}">${LENGTHS.map(n => `<option value="${n}"${n === state.bars ? ' selected' : ''}>${n} ${escapeHtml(t('bars'))}</option>`).join('')}</select>
      <select class="field-select field-select--sm ms-key" data-transpose aria-label="${escapeHtml(t('Key'))}" title="${escapeHtml(t('Move the tune to another key'))}"></select>
      <span class="ms-tempo" role="group" aria-label="${escapeHtml(t('Tempo'))}">
        <input type="number" class="field-input field-input--sm ms-bpm-input" min="${BPM_RANGE[0]}" max="${BPM_RANGE[1]}" step="1" data-bpm aria-label="${escapeHtml(t('Tempo in beats a minute'))}" title="${escapeHtml(t('The tempo: type one, or drag across it'))}">
        <span class="ms-unit" aria-hidden="true">bpm</span>
        ${iconBtn('data-bpm-reset hidden', 'undo', t('Back to the tune’s own tempo'))}
      </span>
      <span class="ms-bar-end">
        <button type="button" class="btn btn--ghost btn--sm ms-reset" data-reset title="${escapeHtml(t('Every setting back to how the generator opens'))}">${icon('undo', { size: 16 })}<span>${escapeHtml(t('Reset'))}</span></button>
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
      ${slider('fx', t('Effects'), 0, 2, 0.05, state.mix.fx)}
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
      <button type="button" class="btn btn--sm" data-save>${escapeHtml(t('Save to library'))}</button>
      <label class="field-toggle ms-cred">
        <input type="checkbox" class="field-check" data-cred checked>
        <span>${escapeHtml(t('Content Credentials'))}</span>
      </label>
      <div class="ms-make-notes">
        <p class="ms-make-note" data-cred-note></p>
        <p class="ms-make-note" data-save-note></p>
      </div>
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
            ${tr === 'lead' || tr === 'keys' || tr === 'bass' ? `<span class="ms-inst" data-inst="${tr}" role="img"></span>` : ''}
            ${tr === 'fx' ? '' : tr === 'drums'
              ? `<button type="button" class="ms-ms" data-drums aria-pressed="${state.drums}" title="${escapeHtml(t('Drums on or off'))}">${escapeHtml(t('On'))}</button>`
              : `<select class="field-select field-select--sm ms-pick" data-pick="${tr}" aria-label="${escapeHtml(t(TRACK_LABEL[tr]))}"></select>`}
            ${`<button type="button" class="ms-ms" data-mute="${tr}" aria-pressed="false" title="${escapeHtml(t('Mute'))}">M</button><button type="button" class="ms-ms" data-solo="${tr}" aria-pressed="false" title="${escapeHtml(t('Solo'))}">S</button>`}
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
  const credToggle = q<HTMLInputElement>('[data-cred]');
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
  /** The instrument a part plays in a bar, by the composer's own id for it (for its colour and icon). */
  const instrumentIdOf = (bar: LofiBar, tr: Pitched): string => {
    const st = bar.tune.style;
    return tr === 'keys' ? bar.voices?.keys ?? st.keys : tr === 'lead' ? bar.voices?.lead ?? st.lead : bar.voices?.bass ?? st.bass;
  };
  const shades = new Map<string, string>();
  const shadeOf = (tr: Pitched, instrument: string): string => {
    const key = `${trackColour[tr]}|${instrument}`;
    let c = shades.get(key);
    if (!c) { c = instrumentShade(trackColour[tr], instrument); shades.set(key, c); }
    return c;
  };
  /** Whether the person chose this part's instrument in this kind of section (or for the whole track). */
  const chosenHere = (section: string, tr: Pitched): boolean => !!state.sections[section]?.[tr] || !!state[tr];
  let playheadBar = -1;
  let playheadBeat = 0;
  let rendered = 0;   // the share of the track already made, 0..1

  // The track (sections, chords and every note) is painted once into a layer and copied
  // onto the canvas each frame; only the progress line, the selection and the playhead are
  // drawn every frame. Repainting thousands of notes sixty times a second while a tune
  // plays held up the page that also schedules the music.
  const layer = document.createElement('canvas');
  let layerKey = '';
  /** Bumped whenever the bars or the colours change, so the layer is painted again. */
  let paintVersion = 0;

  /** The effects lane's rows, by what makes the sound: voices on top, then the console's sounds, its sparkles and bleeps, and the sweeps at the bottom. */
  const fxRow = (voice: string): number => voice === 'hey' || voice === 'tag' || voice === 'magpie' || voice === 'kookaburra' ? 0
    : voice === 'game' || voice === 'coin' ? 1 : voice === 'sparkle' || voice === 'blip' ? 2 : 3;

  function paintTrack(cx: CanvasRenderingContext2D, dpr: number, offset: number, width: number, ink: string, muteInk: string, line: string): void {
    cx.setTransform(dpr, 0, 0, dpr, -offset * dpr, 0);
    const first = Math.max(0, Math.floor(offset / (4 * pxPerBeat)) - 1);
    const last = Math.min(bars.length, Math.ceil((offset + width) / (4 * pxPerBeat)) + 1);
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
        cx.font = '600 10px system-ui, sans-serif';
        for (const tr of PITCHED) {
          // Where a part changes instrument: a bar of the new instrument's colour down its
          // lane, and a chip with its name, filled when the person chose it, tinted when the
          // composer did.
          const name = instrumentOf(bars[i]!, tr);
          const changed = i === 0 || instrumentOf(bars[i - 1]!, tr) !== name;
          if (!changed || !name || !bars.slice(i, j + 1).some(b => b.notes.some(n => trackOf(n.voice) === tr))) continue;
          const shade = shadeOf(tr, instrumentIdOf(bars[i]!, tr));
          const top = laneTop(tr);
          if (i > 0) { cx.fillStyle = shade; cx.fillRect(x0, top + 1, 2, lane[tr] - 2); }
          const w = cx.measureText(name).width + 24;
          const chosen = chosenHere(sec, tr);
          const glyph = iconPath(instrumentIcon(tr, instrumentIdOf(bars[i]!, tr)));
          const fits = w + 6 <= x1 - x0;
          if (!fits && x1 - x0 < 22) continue;
          cx.fillStyle = shade;
          cx.globalAlpha = chosen ? 1 : 0.2;
          cx.beginPath();
          cx.roundRect(x0 + 4, top + 3, fits ? w : 18, 16, 8);
          cx.fill();
          cx.globalAlpha = 1;
          // The instrument's family icon, then its name when the section has room.
          cx.save();
          cx.translate(x0 + 8, top + 5);
          cx.scale(12 / 24, 12 / 24);
          cx.lineWidth = 2.4;
          cx.lineCap = 'round';
          cx.lineJoin = 'round';
          cx.strokeStyle = chosen ? '#fff' : ink;
          cx.stroke(glyph);
          cx.restore();
          if (fits) { cx.fillStyle = chosen ? '#fff' : ink; cx.fillText(name, x0 + 23, top + 14.5); }
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
    // Notes, each in its track: pitched parts by pitch, drums on three rows, effects on four
    // (a sweep drawn as long as it lasts, the rest as short ticks so a run of them stays legible).
    const pitchRange: Record<Pitched, [number, number]> = { lead: [52, 96], keys: [48, 80], bass: [24, 64] };
    const fxRowH = Math.max(5, (lane.fx - 8) / 4);
    for (let i = first; i < last; i++) {
      const bar = bars[i]!;
      for (const n of bar.notes) {
        const tr = trackOf(n.voice);
        const silent = muted.has(tr) || (solo.size > 0 && !solo.has(tr)) || (tr === 'drums' && !state.drums);
        const x = beatX(i, n.beat);
        const top = laneTop(tr);
        cx.globalAlpha = silent ? 0.15 : 0.5 + n.vel * 0.5;
        cx.fillStyle = tr === 'lead' || tr === 'keys' || tr === 'bass' ? (n.voice === 'soar' || n.voice === 'bwah' ? trackColour[tr] : shadeOf(tr, instrumentIdOf(bar, tr))) : trackColour[tr];
        if (tr === 'drums') {
          cx.fillRect(x, top + 8 + drumRow(n.voice, n.mod, n.midi) * 14, 3, 9);
        } else if (tr === 'fx') {
          const row = fxRow(n.voice);
          const y = top + 4 + row * fxRowH;
          const sweep = n.voice === 'riser' || n.voice === 'phaser';
          cx.fillRect(x, y, sweep ? Math.max(3, n.dur * pxPerBeat) : Math.max(2, Math.min(6, n.dur * pxPerBeat)), Math.max(3, fxRowH - 2));
        } else {
          const [lo, hi] = pitchRange[tr];
          const y = top + 14 + (1 - (Math.min(hi, Math.max(lo, n.midi)) - lo) / (hi - lo)) * (lane[tr] - 20);
          cx.fillRect(x, y, Math.max(2, n.dur * pxPerBeat - 1), 4);
        }
      }
    }
    cx.globalAlpha = 1;
  }

  /** What each lane head's icon shows now, so it is redrawn only when the instrument changes. */
  let laneHeadKey = '';
  /** Each pitched lane's head shows the instrument playing at the playhead (or the selected bar), in its shade. */
  function laneHeads(): void {
    const bar = bars[Math.max(0, Math.min(bars.length - 1, playheadBar >= 0 ? playheadBar : selected))];
    if (!bar) return;
    const ids = PITCHED.map(tr => instrumentIdOf(bar, tr));
    const key = ids.join('|') + PITCHED.map(tr => trackColour[tr]).join('|');
    if (key === laneHeadKey) return;
    laneHeadKey = key;
    PITCHED.forEach((tr, n) => {
      const el = page.querySelector<HTMLElement>(`[data-inst="${tr}"]`);
      if (!el) return;
      const label = `${t(TRACK_LABEL[tr])}: ${instrumentOf(bar, tr)}`;
      el.replaceChildren(musicIconNode(instrumentIcon(tr, ids[n]!), 16));
      el.style.color = shadeOf(tr, ids[n]!);
      el.title = label;
      el.setAttribute('aria-label', label);
    });
  }

  function draw(): void {
    laneHeads();
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
    const css = getComputedStyle(page);
    const ink = css.getPropertyValue('--ms-ink').trim() || '#123';
    const muteInk = css.getPropertyValue('--ms-muted').trim() || '#789';
    const line = css.getPropertyValue('--ms-line').trim() || 'rgba(0,0,0,.12)';
    const key = [paintVersion, pxPerBeat, offset, canvas.width, canvas.height, dpr, ink, muteInk, line, [...muted].join(), [...solo].join(), state.drums, TRACKS.map(tr => lane[tr]).join()].join('|');
    if (key !== layerKey) {
      layer.width = canvas.width;
      layer.height = canvas.height;
      const lx = layer.getContext('2d');
      if (lx) paintTrack(lx, dpr, offset, width, ink, muteInk, line);
      layerKey = key;
    }
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, canvas.width, canvas.height);
    cx.drawImage(layer, 0, 0);
    cx.setTransform(dpr, 0, 0, dpr, -offset * dpr, 0);
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
    // The key menu: every key a person can move the tune to, named, the tune's own first.
    const keySel = q<HTMLSelectElement>('[data-transpose]');
    const shift = state.transpose ?? 0;
    const own = transposeChordName(first.key, -shift);
    const options = Array.from({ length: TRANSPOSE_RANGE * 2 + 1 }, (_, n) => n - TRANSPOSE_RANGE)
      .map(n => new Option(n === 0 ? own : `${transposeChordName(own, n)} (${n > 0 ? '+' : ''}${n})`, String(n), false, n === shift));
    keySel.replaceChildren(...options);
    keySel.classList.toggle('is-set', shift !== 0);
    const bpmInput = q<HTMLInputElement>('[data-bpm]');
    if (document.activeElement !== bpmInput) bpmInput.value = String(first.bpm);
    bpmInput.classList.toggle('is-set', state.bpm !== undefined);
    q<HTMLElement>('[data-bpm-reset]').hidden = state.bpm === undefined;
    if (!station) pos.textContent = `0:00 / ${clock(times.total)}`;
  }

  // The brand's colours, for the tracks and the sections.
  void (async () => {
    let colours: string[] = [];
    try { colours = (await host.tokens?.colors())?.map(c => c.value) ?? []; } catch { /* no tokens: the neutral set */ }
    const pal = musicPalette(colours, TRACKS.length + 4);
    trackColour = { lead: pal[0]!, keys: pal[1]!, bass: pal[2]!, drums: pal[3]!, fx: pal[4]! };
    sectionColour = new Map(SECTION_ORDER.map((s, i) => [s, pal[i % pal.length]!]));
    paintVersion++;
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
    paintVersion++;
    times = barTimes(bars);
    selected = Math.min(selected, bars.length - 1);
    renderedBuffer = null; rendered = 0;
    downloadBtn.disabled = true; progress.hidden = true;
    writeLink(); meta(); draw();
    if (station) play(Math.max(0, Math.min(playheadBar, bars.length - 1)));
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
    for (const tr of ['lead', 'keys', 'bass', 'drums', 'fx'] as const) if (silent(tr)) m[TRACK_MIX[tr]] = 0;
    return m;
  }
  function settings(startBar: number): LofiSettings {
    return { mood: state.mood, drums: state.drums, texture: state.texture, style: fixedStyle(state), startBar, bars: state.bars, shape: shapeBar(state) };
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
    offline.fadeOutAt(Math.max(0, seconds - 2.5), 2.5);
    progress.hidden = false; progress.value = 0;
    say(t('Making the track…'));
    const buffer = await renderStation(octx, offline, seconds, (done) => {
      if (job === rendering) { rendered = done; progress.value = rendered; draw(); }
    });
    if (job !== rendering) return;
    renderedBuffer = buffer; rendered = 1; progress.value = 1; draw();
    downloadBtn.disabled = false;
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
  listen('[data-style]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.mood = parseMusicState(`style=${el.value}`).mood; recompose(); fit(); } });
  const setSeed = (seed: number): void => {
    state.seed = ((seed % 4294967296) + 4294967296) % 4294967296;
    q<HTMLInputElement>('[data-seed]').value = String(state.seed);
    recompose();
  };
  listen('[data-seed]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) setSeed(Math.floor(Number(el.value) || 0)); });
  listen('[data-seed-step]', 'click', (_e, el) => setSeed(state.seed + Number(el.dataset.seedStep)));
  /** Put every control back in step with the state, after a shuffle or a reset. */
  const syncControls = (): void => {
    q<HTMLSelectElement>('[data-style]').value = state.mood;
    q<HTMLInputElement>('[data-seed]').value = String(state.seed);
    q<HTMLSelectElement>('[data-bars]').value = String(state.bars);
    for (const tr of PITCHED) fillSelect(q<HTMLSelectElement>(`[data-pick="${tr}"]`), tr, state[tr], t('Auto'));
    page.querySelector('[data-drums]')?.setAttribute('aria-pressed', String(state.drums));
    for (const el of page.querySelectorAll<HTMLElement>('[data-mute]')) el.setAttribute('aria-pressed', String(muted.has(el.dataset.mute as Track)));
    for (const el of page.querySelectorAll<HTMLElement>('[data-solo]')) el.setAttribute('aria-pressed', String(solo.has(el.dataset.solo as Track)));
    // The sliders show 1 for a brightness and 2 for a drive left to the style, as they open.
    const values: Record<string, number> = { ...state.mix, texture: state.texture, bright: state.bright ?? 1, drive: state.drive ?? 2 };
    for (const el of page.querySelectorAll<HTMLInputElement>('[data-slider]')) {
      const v = values[el.dataset.slider ?? ''];
      if (v !== undefined) { el.value = String(v); showSlider(el); }
    }
    station?.setMix(effectiveMix());
    station?.setTexture(state.texture);
  };
  // Shuffle and Reset set the whole state at once: every setting the new state leaves out
  // goes back to its default, and a playing track plays on in the new one.
  const restate = (next: MusicState): void => {
    for (const k of Object.keys(state) as (keyof MusicState)[]) delete state[k];
    Object.assign(state, next);
    closePop(); syncControls(); recompose(); fit();
  };
  // Shuffle: a new style, seed and sound (lib/music-shuffle.ts). Shift keeps the style, the
  // seed and the key, and shuffles only the sound. The tempo goes back to the tune's own,
  // and the length stays the person's.
  listen('[data-shuffle]', 'click', (e, el) => {
    popAgain(el);
    const shift = e instanceof MouseEvent && e.shiftKey;
    const drawn = shuffleMusic(Math.random, { bars: state.bars, after: state.mood, ...(shift ? { keep: { mood: state.mood, seed: state.seed } } : {}) });
    restate({ ...drawn, bars: state.bars, ...(shift && state.transpose ? { transpose: state.transpose } : {}) });
    say(`${t('Shuffled')}: ${lofiStationName(state.mood)} · ${t('seed')} ${state.seed}`);
  });
  listen('[data-reset]', 'click', () => { muted.clear(); solo.clear(); restate({ ...parseMusicState(''), mood: state.mood, seed: state.seed }); say(t('Every setting but the style and the seed is back to the composer\'s own.')); });
  listen('[data-bars]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.bars = Number(el.value); recompose(); fit(); } });
  // The tempo: a number typed or dragged, back to the tune's own with the reset button.
  // Setting the composer's own tempo is the same as not setting one, so the link stays short.
  const composedBpm = (): number => composeTrack({ ...state, bpm: undefined, bars: 1 })[0]!.tune.bpm;
  const setBpm = (bpm: number | undefined): void => {
    const v = bpm === undefined || !Number.isFinite(bpm) ? undefined : Math.round(Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], bpm)));
    state.bpm = v === composedBpm() ? undefined : v;
    recompose();
  };
  listen('[data-bpm]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) setBpm(el.value === '' ? undefined : Number(el.value)); });
  listen('[data-bpm-reset]', 'click', () => setBpm(undefined));
  // The key: any of six semitones up or down, the tune's own key as the first choice.
  listen('[data-transpose]', 'change', (_e, el) => {
    if (!(el instanceof HTMLSelectElement)) return;
    const n = Math.round(Number(el.value));
    state.transpose = n >= -TRANSPOSE_RANGE && n <= TRANSPOSE_RANGE && n !== 0 ? n : undefined;
    recompose();
  });
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
  const showSlider = (el: HTMLInputElement): void => { showPillSlider(el); };
  listen('[data-slider]', 'input', (_e, el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const id = el.dataset.slider ?? '';
    const v = Number(el.value);
    showSlider(el);
    const mixKey = MIX_KEYS.find(k => k === id);
    if (mixKey && mixKey !== 'texture') { state.mix[mixKey] = v; station?.setMix(effectiveMix()); }
    if (id === 'texture') { state.texture = v; station?.setTexture(v); }
    writeLink();
  });
  // Brightness and drive change the tune's colour, so they recompose when let go.
  listen('[data-slider="bright"]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) { state.bright = Number(el.value); recompose(); } });
  listen('[data-slider="drive"]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) { state.drive = Number(el.value); recompose(); } });
  for (const el of page.querySelectorAll<HTMLInputElement>('[data-slider]')) showSlider(el);

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
  // What a download and a save will record, said before either is clicked.
  const paintCredNote = (): void => {
    q<HTMLElement>('[data-cred-note]').textContent = credToggle.checked
      ? tRaw('Downloads will carry Content Credentials that record: {declaration}.', { declaration: TUNE_DECLARATION })
      : t('Downloads will carry no Content Credentials.');
  };
  credToggle.addEventListener('change', paintCredNote);
  paintCredNote();
  void (async () => {
    const { profileMaker } = await import('../lib/tune-provenance.ts');
    let maker = '';
    try { maker = profileMaker(await host.profile.get()); } catch { /* no profile, no maker */ }
    q<HTMLElement>('[data-save-note]').textContent = maker
      ? tRaw('Save to library records {maker} as the maker, the music generator as the source, and the Lolly and engine versions. The licence stays not recorded until you set one in the tune’s details.', { maker })
      : t('Save to library records the music generator as the source, and the Lolly and engine versions. Your profile has no name, so no maker is recorded. The licence stays not recorded until you set one in the tune’s details.');
  })().catch(() => { /* the note is a courtesy; the save still says what it wrote */ });
  listen('[data-download]', 'click', () => {
    void (async () => {
      const { blob, format } = await encoded();
      if (!credToggle.checked) {
        await host.export.download(blob, fileName(format));
        say(t('File handed to your device’s save/download flow, with no Content Credentials.'));
        return;
      }
      const { signTrackDownload } = await import('../lib/tune-provenance.ts');
      let signed: { blob: Blob; declaration: string | null } | null = null;
      try {
        signed = await signTrackDownload(host, blob, format, { name: trackName(), style: state.mood, styleName: lofiStationName(state.mood), seed: state.seed });
      } catch { signed = null; }
      await host.export.download(signed?.blob ?? blob, fileName(format));
      // Only what the reading of the written file found.
      say(!signed
        ? t('File handed to your device’s save/download flow without Content Credentials: they could not be written.')
        : signed.declaration
          ? tRaw('File handed to your device’s save/download flow. Its Content Credentials record: {declaration}', { declaration: signed.declaration })
          : t('File handed to your device’s save/download flow. Reading it back found no Content Credentials, so none are confirmed.'));
    })().catch(err => { say(String(err)); });
  });
  listen('[data-save]', 'click', () => {
    void (async () => {
      if (!canUpload(host.assets)) { say(t('This host cannot save to the library.')); return; }
      // Saved as a tune (lib/lofi-tune.ts), not a recording: a few hundred bytes holding the
      // track's settings, played and rendered from them wherever a tune plays (the player,
      // the asset details, an audiogram, a video's music bed). Nothing to make first.
      // The tune also records who made it (the profile's name, left out when none is
      // set: a fact, not a rights claim), the music generator and the versions that made
      // it, all shown in its details. Its licence is not written: not recorded until set.
      const [{ lofiTuneBytes, LOFI_TUNE_FORMAT }, { profileMaker, tuneSaveRecord }, { LOLLY_RELEASE }, { ENGINE_VERSION }] = await Promise.all([
        import('../lib/lofi-tune.ts'), import('../lib/tune-provenance.ts'), import('../lib/lolly-release.ts'), import('../../../../engine/src/version.ts'),
      ]);
      let maker = '';
      try { maker = profileMaker(await host.profile.get()); } catch { /* no profile, no maker */ }
      const generator = musicStateParams(state);
      const recipe = { mood: state.mood, seed: state.seed >>> 0, generator };
      const bytes = lofiTuneBytes(recipe);
      await host.assets._uploadUserAsset({
        id: `user/tune/${Date.now()}-${state.mood}-${state.seed}`, type: 'audio', format: LOFI_TUNE_FORMAT,
        blob: new Blob([bytes.slice().buffer], { type: 'application/json' }),
        meta: {
          name: trackName(), tags: ['music', 'generated', 'lolly-sings'],
          lofi: recipe, generator,
          durationMs: Math.round(times.total * 1000),
          ...tuneSaveRecord(maker, { lolly: LOLLY_RELEASE, engine: ENGINE_VERSION }),
        },
      });
      // The player keeps a cached list of the library's audio: drop it, so the track is there now.
      (await import('../lib/neurospicy.ts')).invalidateNeurospicyTracks();
      say(maker
        ? tRaw('Saved to your library: it plays in the Neurospicy player and in Assets, and works as a music bed or an audiogram\'s sound. Its details record {maker} as the maker, the music generator, and Lolly {lolly} with engine {engine}.', { maker, lolly: LOLLY_RELEASE, engine: ENGINE_VERSION })
        : tRaw('Saved to your library: it plays in the Neurospicy player and in Assets, and works as a music bed or an audiogram\'s sound. Its details record the music generator, and Lolly {lolly} with engine {engine}.', { lolly: LOLLY_RELEASE, engine: ENGINE_VERSION }));
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
    onDrag: (_el, value) => { state.seed = Math.round(value); bars = composeTrack(state); paintVersion++; times = barTimes(bars); meta(); draw(); },
    onCommit: (el) => setSeed(Math.floor(Number(el.value) || 0)),
  });
  // The tempo slides too: a beat a minute for every few pixels, the length following as it goes.
  const detachTempoScrub = attachScrub(page, {
    selector: '[data-bpm]', min: BPM_RANGE[0], max: BPM_RANGE[1], unitPerPx: 0.25, touch: true,
    onDrag: (_el, value) => { state.bpm = Math.round(value); bars = composeTrack(state); paintVersion++; times = barTimes(bars); meta(); draw(); },
    onCommit: (el) => setBpm(Number(el.value)),
  });

  say(HINT);
  writeLink(); meta(); fitHeight(); fit(); drawViz();
  view._cleanup = () => {
    detachLang();
    detachScrub();
    detachTempoScrub();
    rich?.destroy();
    stopPlayback();
    rendering++;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onDown);
    window.removeEventListener('resize', onResize);
    void ctx?.close();
  };
}
