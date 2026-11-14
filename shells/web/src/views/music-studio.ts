// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator (#/music): a track editor for Lolly Sings, so a person or a brand
 * can dial in a track and keep the result.
 *
 * A toolbar (play and the time, the shuffle cap with the seed beside it, the genre, the
 * render pill with Play and Download, Save and the link), folding sections for the tune
 * (length, key, tempo, reset) and the mix (levels, tone, effects), one above the other, a
 * visualiser that takes room only while there is sound to show (its switcher sits in the
 * timeline's header),
 * and the track laid out like a sequence editor: the sections and chords above a lane for
 * each part, every note drawn, each instrument in its own shade of the part's colour with
 * its name where it comes in (filled when the person chose that instrument). Each track's
 * head carries its icon in its colour, its instruments, and mute (a speaker) and solo (a
 * star). A track's head, or a section in its lane, opens the instrument browser
 * (views/music-studio/instrument-browser.ts): hear each instrument play this tune's part,
 * use one in every section of that kind (the bass in every drop) or all through the track,
 * and star or block instruments (lib/music-prefs.ts, kept on the person's profile). Click
 * the section ruler to play from there. The genre button opens the genre picker
 * (views/music-studio/genre-picker.ts): every genre as a card with its icon, and the
 * "Shuffle genres" switch. On a phone, play, the seed and shuffle sit in a dock at the
 * bottom, the genre button spans the bar, each track is a row with its instruments, mute
 * and solo in a Tracks section, and the lane heads narrow to an icon over a name.
 * The seed is a design-tool number: type one, step it, or drag across it to slide through
 * seeds and watch the tune change. Shuffle draws a new genre, seed and sound at once
 * (lib/music-shuffle.ts; with "Shuffle genres" off it keeps the genre, and with Shift it
 * draws only the sound), and Reset puts every
 * setting back to how the generator opens. The tempo is the composer's for the seed until
 * a person sets their own: the notes stay where they are in the bar, so the tune plays
 * faster or slower and no other part of it changes. The Neurospicy player always plays a
 * style at its own tempo. Colours come from the brand's palette, with extra hues only where
 * the palette runs out, and the grid's lines take the hue of the section they sit on. The
 * mix and tone are pill sliders (components/pill-slider.ts).
 *
 * Every setting lives in the link, so a link plays and edits the same track for anyone
 * who opens it: the composer is deterministic (engine/src/lofi-compose.ts). The render
 * pill (views/music-studio/render-pill.ts) renders the whole track offline with progress,
 * then plays the render or downloads the file. Save (views/music-studio/save-menu.ts) keeps
 * the tune in Assets, the recipe in the asset's details, or in Projects
 * (lib/music-project.ts), which opens the tune back here with every setting.
 *
 * What each of those writes is said before the click (Andy's approval of 2026-11-10,
 * lib/tune-provenance.ts): the download options under the pill's caret say that a download
 * carries Content Credentials naming the music generator, unless the person unticks the
 * switch, and Save's choice of Assets says that a saved tune records the person's profile
 * name as its maker, the music generator and the Lolly and engine versions. After the click
 * the hint says only what was written.
 */
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import {
  lofiSectionName, transposeChordName, LOFI_SNARES, LOFI_HATS, LOFI_DRUM_VOICES, LOFI_PERCUSSION,
  type LofiBar,
} from '../../../../engine/src/lofi-compose.ts';
import { LofiStation, renderStation, type LofiMix, type LofiSettings } from '../lib/lofi-station.ts';
import { lofiStationName } from '../lib/neurospicy-lofi.ts';
import { LOFI_KEYS_NAME, LOFI_LEAD_NAME, LOFI_BASS_NAME } from '../lib/lofi-names.ts';
import { encodeWav, encodeM4a, pcmFromAudioBuffer } from '../lib/audio-encode.ts';
import { attachScrub } from '../lib/scrub.ts';
import { mountViz, type VizHandle } from '../lib/butterchurn-viz.ts';
import { defaultVizPresetId } from '../lib/viz-presets.ts';
import { icon } from '../lib/icons.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { instrumentIcon, iconPath, musicIconNode, musicIconBody, strokeSvg } from '../lib/instrument-icons.ts';
import { MIX_KEYS, BPM_RANGE, TRANSPOSE_RANGE, FX_FAMILIES, TAG_CHOICES, parseMusicState, musicStateParams, fixedStyle, shapeBar, composeTrack, barTimes, type FxFamily, type MusicState, type SectionVoices } from '../lib/music-state.ts';
import { LOFI_KITS, LOFI_KIT_NAME } from '../lib/lofi-drums.ts';
import { shuffleMusic } from '../lib/music-shuffle.ts';
import { pillSliderHtml, showPillSlider } from '../components/pill-slider.ts';
import { mountModal, type ModalHandle } from '../components/modal.ts';
import { TUNE_DECLARATION } from '../../../../engine/src/tune-provenance.ts';
import { genreIconNode, genreTitle, shuffleIconSvg } from '../lib/genre-icons.ts';
import { openGenrePicker } from './music-studio/genre-picker.ts';
import { actionButton, PlainFailure } from './music-studio/action-button.ts';
import { renderPillHtml, wireRenderPill } from './music-studio/render-pill.ts';
import { wireSaveMenu, type SaveChoice, type SaveDestination } from './music-studio/save-menu.ts';
import { musicProjectRecord, musicStateFromProject, musicSlotFromParams, newMusicSlot } from '../lib/music-project.ts';
import { avoidBlocked, clearSwaps, loadMusicPrefs, loadShuffleGenres, setMusicPref, setShuffleGenres, setPartInstrument, swapKey, NO_PREFS, type MusicPart, type MusicPrefKind, type MusicPrefs, type MusicSwap } from '../lib/music-prefs.ts';
import { openInstrumentBrowser, instrumentName, instrumentWord, type BrowseTrack, type InstrumentBrowser } from './music-studio/instrument-browser.ts';
import '../styles/parts/music-studio.css';

// The track's settings and how they shape the composer's bars live in lib/music-state.ts
// (pure, shared with the saved-tune renderer and the player); re-exported for the tests.
export { parseMusicState, musicStateParams, composeTrack, shapeBar, BPM_RANGE, TRANSPOSE_RANGE, type MusicState, type SectionVoices } from '../lib/music-state.ts';

type Track = 'lead' | 'keys' | 'bass' | 'drums' | 'fx';
const TRACKS: readonly Track[] = ['lead', 'keys', 'bass', 'drums', 'fx'];
const TRACK_LABEL: Record<Track, string> = { lead: 'Lead', keys: 'Keys', bass: 'Bass', drums: 'Drums', fx: 'Effects' };
/** The kinds of effect a person can turn off, by name. */
const FX_FAMILY_LABEL: Record<FxFamily, string> = { voices: 'Voices', console: 'Console', sparkles: 'Sparkles', sweeps: 'Sweeps' };
/** The producer's tag choices, by name. */
const TAG_LABEL: Record<string, string> = { off: 'No Lolly tag', spoken: 'Lolly, spoken', shout: 'Lolly, shouted', crowd: 'Lolly, a crowd', sung: 'Lolly, sung', whisper: 'Lolly, whispered', high: 'Lolly, pitched up', deep: 'Lolly, pitched down', robot: 'Lolly, robot', stutter: 'Lolly, stuttered', echo: 'Lolly, echoed' };
/** The same choices in a word or two, for the effects lane's head, where the menu is narrow. */
const TAG_SHORT: Record<string, string> = { off: 'No tag', spoken: 'Spoken', shout: 'Shouted', crowd: 'A crowd', sung: 'Sung', whisper: 'Whispered', high: 'Pitched up', deep: 'Pitched down', robot: 'Robot', stutter: 'Stuttered', echo: 'Echoed' };
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
/** Which of the page's sections a viewer left open (a per-device convenience). */
const SECTIONS_KEY = 'lolly:musicSections';

const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Which track a note is drawn in. */
function trackOf(voice: string): Track {
  if (DRUM_VOICES.has(voice)) return 'drums';
  if (voice === 'soar' || voice === 'bwah' || voice === 'layer') return 'bass';
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
  // Salsa's: the tumba and the heel low, the bells, the clave, the güiro and the timbales' shell on top.
  if (kind === 'congas' && (stroke >= 16 || stroke % 8 === 4 || stroke % 8 === 6)) return 2;
  if (kind === 'bongoBell' || kind === 'mamboBell' || kind === 'clave' || kind === 'guiro' || (kind === 'timbales' && stroke === 3)) return 0;
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

interface ProfileWriter { set(p: Profile): Promise<unknown> }
function canWriteProfile(p: unknown): p is ProfileWriter {
  return typeof p === 'object' && p !== null && 'set' in p && typeof p.set === 'function';
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
  // that track. The person's instrument preferences arrive with their profile, and a
  // first visit is drawn again with them if nothing has been touched by then.
  // A tune kept in Projects (lib/music-project.ts) opens by its slot: read back below.
  const openSlot = musicSlotFromParams(params);
  const firstVisit = !openSlot && !/(^|[?&])(style|seed)=/.test(params);
  if (firstVisit) Object.assign(state, shuffleMusic(Math.random, { bars: state.bars }));
  let prefs: MusicPrefs = NO_PREFS;
  /** "Shuffle genres": on, shuffle draws a new genre; off, it keeps this one (Profile.music). */
  let shuffleGenres = true;
  let profile: Profile | null = null;
  let touched = false;
  /** Where the generator put an instrument in place of a blocked one (swapKey), taken back for the next new tune. */
  const swapped = new Set<string>();
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
  const iconBtn = (attr: string, name: Parameters<typeof icon>[0], label: string, extra = ''): string =>
    `<button type="button" class="btn btn--ghost btn--sm ms-icon" ${attr} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"${extra}>${icon(name, { size: 18 })}</button>`;
  const slider = (id: string, label: string, min: number, max: number, step: number, value: number): string =>
    pillSliderHtml({ label, min, max, step, value, attrs: `data-slider="${id}"` });
  /** A track's glyph, in the track's colour: the instrument playing now for the pitched
   *  tracks (painted by laneHeads), a drum for the drums and a wand for the effects. */
  const glyph = (tr: Track, label: boolean): string => tr === 'drums' || tr === 'fx'
    ? `<span class="ms-inst" aria-hidden="true">${tr === 'drums' ? strokeSvg(musicIconBody('drum'), 18) : icon('wand', { size: 18 })}</span>`
    : `<span class="ms-inst" data-inst="${tr}"${label ? ' role="img"' : ' aria-hidden="true"'}></span>`;
  /** Mute (a speaker) and solo (a star): toggles named for their track. */
  const muteSolo = (tr: Track): string => {
    const track = t(TRACK_LABEL[tr]);
    return `<span class="ms-ms-pair">`
      + `<button type="button" class="ms-ms ms-mute" data-mute="${tr}" aria-pressed="false" aria-label="${escapeHtml(tRaw('Mute: {track}', { track }))}" title="${escapeHtml(t('Mute'))}">${icon('volumeOn', { size: 16, className: 'ms-ms-up' })}${icon('volumeOff', { size: 16, className: 'ms-ms-down' })}</button>`
      + `<button type="button" class="ms-ms ms-solo" data-solo="${tr}" aria-pressed="false" aria-label="${escapeHtml(tRaw('Solo: {track}', { track }))}" title="${escapeHtml(t('Solo'))}">${icon('star', { size: 14 })}</button>`
      + `</span>`;
  };
  const tagSelect = (short: boolean): string => `<select class="field-select field-select--sm ms-pick" data-tag${short ? ' data-tag-short' : ''} aria-label="${escapeHtml(t('The Lolly tag'))}" title="${escapeHtml(t('How the tune says “Lolly”, or not at all'))}"></select>`;
  /** A collapsible section's head (styles/parts/disclosure.css, details.section-card). */
  const sectionHead = (name: Parameters<typeof icon>[0], title: string, value = ''): string =>
    `<summary class="section-card-summary"><span class="section-card-icon" aria-hidden="true">${icon(name, { size: 18 })}</span><h2 class="section-card-title">${escapeHtml(title)}</h2>${value}</summary>`;

  const page = document.createElement('section');
  page.className = 'ms-page';
  page.setAttribute('aria-label', t('Music generator'));
  page.innerHTML = `
    <div class="ms-bar surface surface--floating" role="toolbar" aria-label="${escapeHtml(t('Track'))}">
      <span class="ms-transport">
        <button type="button" class="btn btn--primary ms-play" data-play aria-label="${escapeHtml(t('Play'))}" title="${escapeHtml(t('Play or stop (space)'))}">
          <span data-play-icon>${icon('play', { size: 18, filled: true })}</span><span data-stop-icon hidden>${icon('pause', { size: 18, filled: true })}</span>
        </button>
        <span class="ms-time" data-pos></span>
        <span class="ms-dice">
          <button type="button" class="ms-shuffle" data-shuffle>${shuffleIconSvg(26)}</button>
          <span class="ms-seed" role="group" aria-label="${escapeHtml(t('Seed'))}">
            ${iconBtn('data-seed-step="-1"', 'chevronLeft', t('Previous seed'))}
            <label class="ms-seed-field" title="${escapeHtml(t('This tune’s number: type one, or drag across it to slide through seeds'))}">
              <span class="ms-seed-label">${escapeHtml(t('Seed'))}</span>
              <input type="number" class="ms-seed-input" min="0" max="4294967295" value="${state.seed}" data-seed inputmode="numeric">
            </label>
            ${iconBtn('data-seed-step="1"', 'chevronRight', t('Next seed'))}
          </span>
        </span>
      </span>
      <button type="button" class="field-select ms-genre" data-genre aria-haspopup="dialog"><span class="ms-genre-icon" data-genre-icon aria-hidden="true"></span><span class="ms-genre-name" data-genre-name></span></button>
      <span class="ms-bar-end">
        ${renderPillHtml()}
        <button type="button" class="btn btn--labelled ms-save" data-save>${escapeHtml(t('Save'))}</button>
        ${iconBtn('data-link', 'link', t('Copy a link to this track'))}
      </span>
    </div>
    <div class="ms-sections">
      <details class="section-card ms-sec" data-sec="tune">
        ${sectionHead('music', t('Tune'), '<span class="section-card-value" data-tune-value></span>')}
        <div class="section-card-body ms-sec-body ms-tune">
          <select class="field-select field-select--sm" data-bars aria-label="${escapeHtml(t('Length'))}">${LENGTHS.map(n => `<option value="${n}"${n === state.bars ? ' selected' : ''}>${n} ${escapeHtml(t('bars'))}</option>`).join('')}</select>
          <select class="field-select field-select--sm ms-key" data-transpose aria-label="${escapeHtml(t('Key'))}" title="${escapeHtml(t('Move the tune to another key'))}"></select>
          <span class="ms-tempo" role="group" aria-label="${escapeHtml(t('Tempo'))}">
            <input type="number" class="field-input field-input--sm ms-bpm-input" min="${BPM_RANGE[0]}" max="${BPM_RANGE[1]}" step="1" data-bpm aria-label="${escapeHtml(t('Tempo in beats a minute'))}" title="${escapeHtml(t('The tempo: type one, or drag across it'))}">
            <span class="ms-unit" aria-hidden="true">bpm</span>
            ${iconBtn('data-bpm-reset hidden', 'undo', t('Back to the tune’s own tempo'))}
          </span>
          <button type="button" class="btn btn--ghost btn--sm btn--labelled ms-reset" data-reset title="${escapeHtml(t('Every setting back to how the generator opens'))}">${icon('undo', { size: 16 })}<span>${escapeHtml(t('Reset'))}</span></button>
        </div>
      </details>
      <details class="section-card ms-sec" data-sec="mix">
        ${sectionHead('sliders', t('Mix'))}
        <div class="section-card-body ms-sec-body ms-mix">
          <div class="ms-sliders">
            ${slider('lead', t('Lead'), 0, 1.6, 0.05, state.mix.lead)}
            ${slider('keys', t('Keys'), 0, 1.6, 0.05, state.mix.keys)}
            ${slider('bass', t('Bass'), 0, 1.6, 0.05, state.mix.bass)}
            ${slider('drums', t('Drums'), 0, 1.6, 0.05, state.mix.drums)}
            ${slider('fx', t('Effects'), 0, 2, 0.05, state.mix.fx)}
            ${slider('reverb', t('Room'), 0, 2, 0.05, state.mix.reverb)}
          </div>
          <div class="ms-sliders">
            ${slider('texture', t('Texture'), 0, 1, 0.05, state.texture)}
            ${slider('bright', t('Brightness'), 0.5, 1.8, 0.05, state.bright ?? 1)}
            ${slider('drive', t('Drive'), 0.8, 4.5, 0.1, state.drive ?? 2)}
          </div>
          <div class="ms-fx-on" role="group" aria-label="${escapeHtml(t('Effects'))}">
            <span class="ms-fx-label">${icon('wand', { size: 16 })}${escapeHtml(t('Effects'))}</span>
            ${tagSelect(false)}
            ${FX_FAMILIES.map(f => `<button type="button" class="ms-chip" data-fx-family="${f}" aria-pressed="${!state.quiet?.includes(f)}">${icon('check', { size: 14, className: 'ms-chip-tick' })}${escapeHtml(t(FX_FAMILY_LABEL[f]))}</button>`).join('')}
          </div>
        </div>
      </details>
      <details class="section-card ms-sec ms-sec--tracks" data-sec="tracks">
        ${sectionHead('layers', t('Tracks'))}
        <div class="section-card-body ms-rows" role="group" aria-label="${escapeHtml(t('Tracks'))}">
          ${TRACKS.map(tr => `
            <div class="ms-row" data-row="${tr}">
              <button type="button" class="ms-row-open" ${tr === 'fx' ? 'data-open-mix' : `data-browse="${tr}"`}>
                ${glyph(tr, false)}
                <span class="ms-row-text"><span class="ms-row-name">${escapeHtml(t(TRACK_LABEL[tr]))}</span><span class="ms-row-inst" data-summary="${tr}"></span></span>
                ${icon('chevronRight', { size: 18 })}
              </button>
              ${muteSolo(tr)}
            </div>`).join('')}
        </div>
      </details>
    </div>
    <div class="ms-stage">
      <canvas class="ms-viz" data-viz aria-hidden="true"></canvas>
      <canvas class="ms-viz" data-viz-rich aria-hidden="true" hidden></canvas>
      ${iconBtn('data-viz-full hidden', 'monitor', t('Full screen'))}
    </div>
    <div class="ms-editor">
      <div class="ms-heads">
        <div class="ms-lane-head ms-zoom" style="height:${RULER + CHORDS}px">
          ${iconBtn('data-zoom="-1"', 'zoomOut', t('Zoom out'))}
          ${iconBtn('data-fit', 'fitAll', t('Fit the track'))}
          ${iconBtn('data-zoom="1"', 'zoomIn', t('Zoom in'))}
          ${iconBtn('data-viz-mode', 'neuroBeat', t('Visualiser'))}
        </div>
        ${TRACKS.map(tr => `
          <div class="ms-lane-head ms-track" data-track="${tr}" style="height:${lane[tr]}px">
            <span class="ms-track-id">${glyph(tr, true)}<span class="ms-track-name">${escapeHtml(t(TRACK_LABEL[tr]))}</span></span>
            ${tr === 'fx'
              ? tagSelect(true)
              : `<button type="button" class="field-select field-select--sm ms-pick ms-browse" data-browse="${tr}"><span data-short="${tr}"></span></button>`}
            ${muteSolo(tr)}
          </div>`).join('')}
      </div>
      <div class="ms-scroll" data-scroll>
        <canvas class="ms-canvas" data-canvas role="img" aria-label="${escapeHtml(t('The track: its sections, chords and every note'))}"></canvas>
        <div class="ms-spacer" data-spacer></div>
      </div>
    </div>
    <p class="ms-hint" data-hint role="status"></p>`;
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
  /** The pill's Download: it opens the download's panel, and shows the download's progress. */
  const downloadBtn = q<HTMLButtonElement>('[data-download-open]');
  // The download options are lent to a popover while it is open, so they are held here.
  const credToggle = q<HTMLInputElement>('[data-cred]');
  const credNote = q<HTMLElement>('[data-cred-note]');
  const renderPill = wireRenderPill(page);
  const say = (text: string): void => { hint.textContent = text; };
  const HINT = t('Click a section in a track to hear and choose its instruments there. Click the top row to play from a section.');
  /** The effects' tag menu and the effect switches, set to the state. */
  const fillOptions = (): void => {
    for (const sel of page.querySelectorAll<HTMLSelectElement>('[data-tag]')) {
      const short = sel.hasAttribute('data-tag-short');
      sel.replaceChildren(new Option(short ? t('As composed') : t('Lolly tag: as composed'), ''), ...TAG_CHOICES.map(c => new Option(t((short ? TAG_SHORT[c] : TAG_LABEL[c]) ?? c), c, false, c === state.tag)));
    }
    for (const el of page.querySelectorAll<HTMLElement>('[data-fx-family]')) el.setAttribute('aria-pressed', String(!state.quiet?.includes(el.dataset.fxFamily as FxFamily)));
  };
  fillOptions();

  // ── drawing ─────────────────────────────────────────────────────────────────
  let height = RULER + CHORDS + TRACKS.reduce((h, tr) => h + lane[tr], 0);
  /** Grow the lanes so the editor reaches the bottom of the screen, on a phone as on a monitor. */
  function fitHeight(): void {
    const top = q<HTMLElement>('.ms-editor').getBoundingClientRect().top + window.scrollY;
    // On a phone the play and shuffle dock covers the bottom of the screen: leave its room too.
    const dock = q<HTMLElement>('.ms-transport');
    const docked = getComputedStyle(dock).position === 'fixed' ? window.innerHeight - dock.getBoundingClientRect().top : 0;
    const room = window.innerHeight - top - 56 - docked;
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

  /** The effects lane's rows, by what makes the sound: voices and botanica's place on top, then the console's sounds and the glitches, its sparkles and bleeps, and the sweeps and pads at the bottom. */
  const fxRow = (voice: string): number => voice === 'hey' || voice === 'tag' || voice === 'magpie' || voice === 'kookaburra' || voice === 'nature' ? 0
    : voice === 'game' || voice === 'coin' || voice === 'glitch' ? 1 : voice === 'sparkle' || voice === 'blip' ? 2 : 3;

  /**
   * The grid's lines take the colour of the section they sit on, a lightness step from
   * its band: drawn in the section's own hue at a low alpha, they come out a little
   * darker on a light page and a little lighter on a dark one. Bar lines a step stronger
   * than beat lines, the line between sections a step stronger again; a lane's floor the
   * same as a bar line. The rests between sections take the muted ink the same way.
   */
  const GRID = { band: 0.08, head: 0.16, edge: 0.42, bar: 0.2, beat: 0.08, floor: 0.2 };
  /** Beat lines once a beat is this many pixels wide; closer, the bar lines say enough. */
  const BEAT_LINES_FROM = 8;
  /** Bar lines no closer than this: zoomed out, a line every two, four or eight bars of a section. */
  const BAR_LINES_APART = 9;

  function paintTrack(cx: CanvasRenderingContext2D, dpr: number, offset: number, width: number, ink: string, muteInk: string, family: string): void {
    cx.setTransform(dpr, 0, 0, dpr, -offset * dpr, 0);
    const first = Math.max(0, Math.floor(offset / (4 * pxPerBeat)) - 1);
    const last = Math.min(bars.length, Math.ceil((offset + width) / (4 * pxPerBeat)) + 1);
    cx.clearRect(offset, 0, width, height);
    const lanesTop = RULER + CHORDS;
    let barStep = 1;
    while (barStep < 16 && barStep * 4 * pxPerBeat < BAR_LINES_APART) barStep *= 2;
    // Sections: a tinted band for each run of bars in one section, a stronger tint behind
    // its name on the ruler, the grid in its hue, and in each pitched lane the instrument
    // it plays there.
    cx.font = `600 11px ${family}`;
    for (let i = 0; i < bars.length;) {
      let j = i;
      while (j + 1 < bars.length && bars[j + 1]!.section === bars[i]!.section && bars[j + 1]!.index === bars[j]!.index + 1) j++;
      const sec = bars[i]!.section;
      const rest = sec === 'rest';
      const colour = rest ? muteInk : sectionColour.get(sec) ?? muteInk;
      const x0 = beatX(i, 0), x1 = beatX(j + 1, 0);
      if (x1 >= offset && x0 <= offset + width) {
        cx.fillStyle = colour;
        if (!rest) {
          cx.globalAlpha = GRID.band;
          cx.fillRect(x0, 0, x1 - x0, height);
          cx.globalAlpha = GRID.head;
          cx.fillRect(x0, 0, x1 - x0, RULER);
        }
        // The grid: a beat line for every beat when they have room, a bar line for every
        // bar, the line where the section starts, and each lane's floor.
        const from = Math.max(i, first), to = Math.min(j, last - 1);
        if (pxPerBeat >= BEAT_LINES_FROM) {
          cx.globalAlpha = GRID.beat;
          for (let b = from; b <= to; b++) for (let beat = 1; beat < 4; beat++) cx.fillRect(beatX(b, beat), lanesTop, 1, height - lanesTop);
        }
        cx.globalAlpha = GRID.bar;
        for (let b = Math.max(from, i + 1); b <= to; b++) if ((b - i) % barStep === 0) cx.fillRect(beatX(b, 0), RULER, 1, height - RULER);
        cx.globalAlpha = GRID.floor;
        for (const tr of TRACKS) cx.fillRect(x0, laneTop(tr), x1 - x0, 1);
        if (i > 0) { cx.globalAlpha = GRID.edge; cx.fillRect(x0, 0, 1, height); }
        cx.globalAlpha = 1;
        if (rest) { i = j + 1; continue; }
        cx.fillStyle = ink;
        const label = sectionLabel(sec);
        if (cx.measureText(label).width + 8 < x1 - x0) cx.fillText(label, x0 + 5, 17);
        cx.save();
        cx.font = `600 10px ${family}`;
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
          cx.roundRect(x0 + 4, top + 4, fits ? w : 18, 16, 8);
          cx.fill();
          cx.globalAlpha = 1;
          // The instrument's family icon, then its name when the section has room.
          cx.save();
          cx.translate(x0 + 8, top + 6);
          cx.scale(12 / 24, 12 / 24);
          cx.lineWidth = 2.4;
          cx.lineCap = 'round';
          cx.lineJoin = 'round';
          cx.strokeStyle = chosen ? '#fff' : ink;
          cx.stroke(glyph);
          cx.restore();
          if (fits) { cx.fillStyle = chosen ? '#fff' : ink; cx.fillText(name, x0 + 23, top + 15.5); }
        }
        cx.restore();
      }
      i = j + 1;
    }
    // The chord lane. A chord's name is drawn only when it has room.
    cx.font = `11px ${family}`;
    cx.fillStyle = muteInk;
    for (let i = first; i < last; i++) {
      const chord = bars[i]!.chord;
      if (!chord || (i > 0 && bars[i - 1]!.chord === chord)) continue;
      let next = i + 1;
      while (next < bars.length && bars[next]!.chord === chord) next++;
      const room = beatX(next, 0) - beatX(i, 0) - 6;
      if (cx.measureText(chord).width <= room) cx.fillText(chord, beatX(i, 0) + 4, RULER + 15);
    }
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
          const sweep = n.voice === 'riser' || n.voice === 'phaser' || n.voice === 'grain' || n.voice === 'nature' || n.voice === 'glitch';
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
  /** The pitched parts with no note anywhere in the track (paintSummaries). */
  const silentParts = new Set<Pitched>();
  /** Each pitched lane's head shows the instrument playing at the playhead (or the selected bar), in its shade. */
  /** The bar whose instrument a part's head shows: this one, or where the part next plays (else last played). */
  const barFor = (tr: Pitched, at: number): LofiBar | undefined => {
    const plays = (b: LofiBar | undefined): boolean => !!b?.notes.some(n => trackOf(n.voice) === tr);
    for (let i = at; i < bars.length; i++) if (plays(bars[i])) return bars[i];
    for (let i = at - 1; i >= 0; i--) if (plays(bars[i])) return bars[i];
    return bars[at];
  };
  function laneHeads(): void {
    const at = Math.max(0, Math.min(bars.length - 1, playheadBar >= 0 ? playheadBar : selected));
    const heads = PITCHED.map(tr => barFor(tr, at));
    if (heads.some(b => !b)) return;
    const ids = PITCHED.map((tr, n) => instrumentIdOf(heads[n]!, tr));
    const key = ids.join('|') + PITCHED.map(tr => trackColour[tr]).join('|');
    if (key === laneHeadKey) return;
    laneHeadKey = key;
    PITCHED.forEach((tr, n) => {
      const bar = heads[n]!;
      const label = `${t(TRACK_LABEL[tr])}: ${instrumentOf(bar, tr)}`;
      // The lane head's menu gives the instrument of its icon, or Not playing for a part with no notes at all.
      const short = page.querySelector<HTMLElement>(`[data-short="${tr}"]`);
      if (short) short.textContent = silentParts.has(tr) ? t('Not playing') : instrumentOf(bar, tr);
      for (const el of page.querySelectorAll<HTMLElement>(`[data-inst="${tr}"]`)) {
        el.replaceChildren(musicIconNode(instrumentIcon(tr, ids[n]!), 18));
        el.style.color = shadeOf(tr, ids[n]!);
        // The lane head's icon is named; a row's sits in a button that names itself.
        if (el.getAttribute('role') !== 'img') continue;
        el.title = label;
        el.setAttribute('aria-label', label);
      }
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
    // The page's own face, so the canvas speaks in the brand's type like the rest of the page.
    const family = css.fontFamily || 'sans-serif';
    const key = [paintVersion, pxPerBeat, offset, canvas.width, canvas.height, dpr, ink, muteInk, family, [...muted].join(), [...solo].join(), state.drums, TRACKS.map(tr => lane[tr]).join()].join('|');
    if (key !== layerKey) {
      layer.width = canvas.width;
      layer.height = canvas.height;
      const lx = layer.getContext('2d');
      if (lx) paintTrack(lx, dpr, offset, width, ink, muteInk, family);
      layerKey = key;
    }
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, canvas.width, canvas.height);
    cx.drawImage(layer, 0, 0);
    cx.setTransform(dpr, 0, 0, dpr, -offset * dpr, 0);
    // What has been made so far, under the ruler, then the selection and the playhead.
    if (rendered > 0) { cx.fillStyle = trackColour.bass; cx.fillRect(0, RULER - 4, total * rendered, 3); }
    // The selected bar: a faint wash of ink with a quiet edge.
    cx.fillStyle = ink;
    cx.globalAlpha = 0.05;
    cx.fillRect(beatX(selected, 0), RULER, 4 * pxPerBeat, height - RULER);
    cx.globalAlpha = 0.32;
    cx.strokeStyle = ink; cx.lineWidth = 1;
    cx.strokeRect(beatX(selected, 0) + 0.5, RULER + 0.5, 4 * pxPerBeat - 1, height - RULER - 1);
    cx.globalAlpha = 1;
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
    // The Tune section's head says what it holds while it is folded.
    q<HTMLElement>('[data-tune-value]').textContent = `${state.bars} ${t('bars')} · ${first.key} · ${first.bpm} bpm`;
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
    // The track's colour lives in its icon, in the lane head and the row alike.
    for (const tr of TRACKS) for (const el of page.querySelectorAll<HTMLElement>(`[data-track="${tr}"], [data-row="${tr}"]`)) el.style.setProperty('--ms-track', trackColour[tr]);
    draw();
  })();

  // ── state, link and recomposing ──────────────────────────────────────────────
  /** The project this tune is kept as, once it is saved there or opened from there. */
  let projectSlot: string | null = openSlot;
  function writeLink(): void {
    const next = `#/music?${musicStateParams(state)}${projectSlot ? `&slot=${encodeURIComponent(projectSlot)}` : ''}`;
    if (location.hash !== next) history.replaceState(history.state, '', next);
  }
  function recompose(): void {
    touched = true;
    bars = composeTrack(state);
    paintVersion++;
    times = barTimes(bars);
    selected = Math.min(selected, bars.length - 1);
    // A render under way is of the track as it was: let it go.
    rendering++;
    renderedBuffer = null; rendered = 0;
    renderPill.showRendered(false);
    paintStage();
    writeLink(); meta(); paintSummaries(); draw();
    if (station || renderedSrc) play(Math.max(0, Math.min(playheadBar, bars.length - 1)));
    showFull();
    browser?.refresh();
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
    return { mood: state.mood, drums: state.drums, texture: state.texture, style: fixedStyle(state), startBar, bars: state.bars, shape: shapeBar(state), kit: state.kit, tag: state.tag };
  }
  const showPlaying = (on: boolean): void => {
    q<HTMLElement>('[data-play-icon]').hidden = on;
    q<HTMLElement>('[data-stop-icon]').hidden = !on;
    playBtn.setAttribute('aria-label', on ? t('Stop') : t('Play'));
    playBtn.setAttribute('aria-pressed', String(on));
    page.classList.toggle('is-playing', on);
    paintStage();
  };
  /**
   * The visualiser's band takes room only while there is sound to show: while a track
   * plays, while it is stopped part way (the playhead still in the track), and once a
   * render is made. Otherwise the band is gone and the timeline moves up; the lanes are
   * fitted to the screen again whenever the band comes or goes.
   */
  function paintStage(): void {
    const audible = !!station || !!renderedSrc || playheadBar >= 0 || !!renderedBuffer;
    if (page.classList.contains('has-audio') === audible) return;
    page.classList.toggle('has-audio', audible);
    onResize();
  }
  /** A rendered track playing (render and play), instead of the live station. */
  let renderedSrc: AudioBufferSourceNode | null = null;
  function stopPlayback(): void {
    station?.stop(0.15);
    station = null;
    if (renderedSrc) { renderedSrc.onended = null; try { renderedSrc.stop(); } catch { /* not started */ } }
    renderedSrc = null;
    cancelAnimationFrame(raf);
    showPlaying(false);
  }
  /** The audio graph, made on first play: the master, and the analyser the visualisers read. */
  function ensureAudio(): AudioContext {
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
    return ctx;
  }
  function play(fromBar: number): void {
    browser?.stopPreview();
    station?.stop(0.08);
    if (renderedSrc) stopPlayback();
    const c = ensureAudio();
    station = new LofiStation(c, master ?? c.destination, state.seed, settings(fromBar), effectiveMix());
    station.setVolume(1);
    station.start();
    follow(fromBar, 0.1);
  }
  /**
   * Play the rendered track from `fromBar`, with the big visualiser: render and play's
   * second half. The live station stops; a change to the track goes back to live playing,
   * since the render no longer matches.
   */
  function playRendered(fromBar: number): void {
    if (!renderedBuffer) return;
    browser?.stopPreview();
    stopPlayback();
    const c = ensureAudio();
    const src = c.createBufferSource();
    src.buffer = renderedBuffer;
    src.connect(master ?? c.destination);
    src.start(c.currentTime + 0.05, times.starts[fromBar] ?? 0);
    src.onended = () => { if (renderedSrc === src) { stopPlayback(); playheadBar = -1; paintStage(); meta(); draw(); } };
    renderedSrc = src;
    if (vizMode !== 'milkdrop') { vizMode = 'milkdrop'; showVizMode(); void syncRichViz(); }
    follow(fromBar, 0.05);
  }
  /** Move the playhead with whatever is playing, from `fromBar`, starting `lead` seconds from now. */
  function follow(fromBar: number, lead: number): void {
    const c = ensureAudio();
    startedAt = c.currentTime + lead;
    startedBar = fromBar;
    showPlaying(true);
    cancelAnimationFrame(raf);
    const tick = (): void => {
      if (!ctx || (!station && !renderedSrc)) return;
      const at = times.starts[startedBar]! + Math.max(0, ctx.currentTime - startedAt);
      if (at >= times.total + 1.5) { stopPlayback(); playheadBar = -1; paintStage(); meta(); draw(); return; }
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
  /** Render the track, at full quality (a render can take longer than the track: it is not live). True if it finished. */
  async function render(onProgress?: (done: number) => void): Promise<boolean> {
    const job = ++rendering;
    const seconds = times.total + 2.5;
    const octx = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
    const offline = new LofiStation(octx, octx.destination, state.seed, { ...settings(0), quality: 'high' }, effectiveMix());
    offline.fadeOutAt(Math.max(0, seconds - 2.5), 2.5);
    say(t('Rendering…'));
    const buffer = await renderStation(octx, offline, seconds, (done) => {
      if (job === rendering) { rendered = done; onProgress?.(done); draw(); }
    });
    if (job !== rendering) return false;
    renderedBuffer = buffer; rendered = 1; draw();
    renderPill.showRendered(true);
    paintStage();
    showFull();
    say(t('Rendered at full quality.'));
    return true;
  }

  // ── the render pill: render, then play or download ──────────────────────────
  /**
   * The track worked out at full quality, behind a progress card with the shared
   * candy-stripe bar and Cancel (Escape cancels too). True once there is a render to
   * play or download; a track already rendered needs no card.
   */
  let renderCard: ModalHandle<void> | null = null;
  async function renderWithCard(): Promise<boolean> {
    if (renderedBuffer) return true;
    stopPlayback();
    let finished = false;
    const titleId = 'ms-render-title';
    renderCard = mountModal<void>(`
      <h2 class="modal-title" id="${titleId}" tabindex="-1">${escapeHtml(t('Rendering your track'))}</h2>
      <p class="ms-render-note">${escapeHtml(t('Every part at full quality. A render can take longer than the track itself.'))}</p>
      <div class="ms-render-status"><span data-render-pct role="status" aria-live="polite">0%</span><span data-render-eta></span></div>
      <div class="job-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-labelledby="${titleId}"><span class="job-bar-fill"></span></div>
      <div class="modal-actions"><button type="button" class="btn modal-cancel" data-act="cancel">${escapeHtml(t('Cancel'))}</button></div>`, {
      className: 'modal ms-render-card',
      ariaLabel: t('Rendering your track'),
      dismissOnBackdrop: false,
      initialFocus: (el) => el.querySelector<HTMLElement>('.modal-title'),
      onClose: () => {
        renderCard = null;
        if (!finished) { rendering++; rendered = 0; draw(); say(t('Render stopped.')); }
      },
    });
    const card = renderCard;
    card.el.querySelector('[data-act="cancel"]')?.addEventListener('click', () => card.close());
    const bar = card.el.querySelector<HTMLElement>('.job-bar');
    const fill = card.el.querySelector<HTMLElement>('.job-bar-fill');
    const pct = card.el.querySelector<HTMLElement>('[data-render-pct]');
    const eta = card.el.querySelector<HTMLElement>('[data-render-eta]');
    const began = performance.now();
    const ok = await render((done) => {
      const p = Math.round(done * 100);
      if (fill) fill.style.width = `${p}%`;
      bar?.setAttribute('aria-valuenow', String(p));
      if (pct) pct.textContent = `${p}%`;
      // Time left, from the pace so far, once there is a pace to go by.
      if (eta && done > 0.05) eta.textContent = t('About {s} s to go', { s: String(Math.max(1, Math.round(((performance.now() - began) / 1000) * (1 - done) / done))) });
    }).catch((err: unknown) => { say(`${t('Could not make the track')}: ${String(err)}`); return false; });
    if (!ok || renderCard !== card) { card.close(); return false; }
    finished = true;
    card.close();
    return true;
  }
  /** Play: the rendered track with the big visualiser, which can go full screen. */
  async function renderAndPlay(): Promise<void> {
    if (renderedBuffer) { playRendered(Math.max(0, selected)); return; }
    if (await renderWithCard()) playRendered(0);
  }
  /** The full-screen button shows once a track is rendered, where the browser can go full screen. */
  function showFull(): void {
    const btn = page.querySelector<HTMLButtonElement>('[data-viz-full]');
    if (btn) btn.hidden = !renderedBuffer || !document.fullscreenEnabled;
  }
  async function encoded(): Promise<{ blob: Blob; format: string }> {
    if (!renderedBuffer) throw new Error('nothing made yet');
    const pcm = pcmFromAudioBuffer(renderedBuffer);
    const want = renderPill.format();
    if (want === 'm4a') {
      try { return { blob: await encodeM4a(pcm), format: 'm4a' }; } catch { /* no AAC encoder here: fall back to WAV */ }
    }
    return { blob: encodeWav(pcm), format: 'wav' };
  }
  const trackName = (): string => `${lofiStationName(state.mood)} · ${bars[0]!.tune.key} · ${bars[0]!.tune.bpm} bpm · ${state.seed}`;
  const fileName = (format: string): string => `${trackName().replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').toLowerCase()}.${format}`;

  // ── the instrument browser ───────────────────────────────────────────────────
  // A track's head or row, or a section in its lane, opens the browser for that track
  // (views/music-studio/instrument-browser.ts): cards to hear an instrument in this tune,
  // to use that instrument in a kind of section or the whole track, and to star or block
  // an instrument.
  let browser: InstrumentBrowser | null = null;
  /** The button that opens a track's browser where the screen shows one (a row on a phone, a lane head wider). */
  const browseButton = (tr: BrowseTrack): HTMLElement | null =>
    [...page.querySelectorAll<HTMLElement>(`[data-browse="${tr}"]`)].find(el => el.offsetParent !== null) ?? null;
  function openBrowser(tr: BrowseTrack, section?: string, opener?: HTMLElement | null): void {
    if (browser?.track === tr) { if (section) browser.setSection(section); return; }
    browser?.close();
    const at = bars[Math.max(0, Math.min(bars.length - 1, playheadBar >= 0 ? playheadBar : selected))]?.section;
    const opened: InstrumentBrowser = openInstrumentBrowser({
      state,
      bars: () => bars,
      sectionLabel,
      prefs: () => prefs,
      setPref: savePref,
      use: useInstrument,
      useDrumPart,
      setDrumsOn: setDrums,
      audio: () => { const c = ensureAudio(); return { ctx: c, dest: master ?? c.destination }; },
      stopPlayback: () => { if (station || renderedSrc) { stopPlayback(); playheadBar = -1; paintStage(); draw(); } },
      trackColour: (track) => trackColour[track],
    }, tr, { section: section ?? at, opener: opener ?? browseButton(tr), onClose: () => { if (browser === opened) { browser = null; besideBrowser(false); } } });
    browser = opened;
    besideBrowser(true);
  }
  /** On a wide screen the browser is a panel at the side: the page makes room for the panel, so nothing hides under the panel. */
  function besideBrowser(on: boolean): void {
    page.classList.toggle('has-browser', on);
    onResize();
  }
  /** An instrument chosen in the browser: for a kind of section, or for the whole track (and so every section). */
  function useInstrument(track: BrowseTrack, id: string | undefined, section: string | null): void {
    touched = true;
    if (track === 'drums') state.kit = LOFI_KITS.find(k => k === id);
    else if (section) { setPartInstrument(state, track, id, section); swapped.delete(`${section}.${track}`); }
    else {
      setPartInstrument(state, track, id);
      swapped.delete(track);
      for (const sec of Object.keys(state.sections)) { setPartInstrument(state, track, undefined, sec); swapped.delete(`${sec}.${track}`); }
    }
    // The composer's own choice still leaves out what the person blocked.
    const note = id === undefined ? avoid() : '';
    recompose();
    if (note) say(note);
  }
  function useDrumPart(section: string, which: 'snare' | 'hats', id: string | undefined): void {
    const v: SectionVoices = { ...state.sections[section] };
    if (which === 'snare') v.snare = LOFI_SNARES.find(x => x === id); else v.hats = LOFI_HATS.find(x => x === id);
    if (!v.snare) delete v.snare;
    if (!v.hats) delete v.hats;
    if (Object.keys(v).length) state.sections[section] = v; else delete state.sections[section];
    recompose();
  }
  function setDrums(on: boolean): void {
    state.drums = on;
    station?.setDrums(on); writeLink(); paintSummaries(); paintSilent(); draw();
    browser?.refresh();
  }

  // ── favourite and blocked instruments ──────────────────────────────────────────
  /** Put an instrument the style plays in place of each blocked one the composer drew, into the state (lib/music-prefs.ts). Says what it did. */
  function avoid(): string {
    const { swaps } = avoidBlocked(state, prefs);
    for (const w of swaps) { setPartInstrument(state, w.part, w.to, w.section); swapped.add(swapKey(w)); }
    return swapNote(swaps);
  }
  const swapNote = (swaps: readonly MusicSwap[]): string => swaps.slice(0, 2)
    .map(w => tRaw('{from} is blocked, so {to} plays in its place.', { from: instrumentName(w.part, w.from), to: instrumentWord(w.part, w.to) })).join(' ');
  /** A new tune (another seed, style or length): what earlier swaps set is taken back, and the new tune checked again. */
  function renew(): string {
    clearSwaps(state, swapped);
    swapped.clear();
    return avoid();
  }
  /** Star or block an instrument, or undo either, and keep it on the profile. Says what changed in this tune. */
  function savePref(part: MusicPart, id: string, kind: MusicPrefKind, on: boolean): string {
    if (!profile) {
      void host.profile.get().then(p => { profile = p; savePref(part, id, kind, on); }).catch(() => { /* no profile: nothing to keep it on */ });
      return '';
    }
    prefs = setMusicPref(profile, part, id, kind, on);
    // Blocking an instrument the composer drew for this tune takes it out now.
    const note = kind === 'blocked' && on ? avoid() : '';
    if (note) { recompose(); say(note); } else browser?.refresh();
    const writer = host.profile;
    if (canWriteProfile(writer)) void writer.set(profile).catch(() => { /* storage off: the choice holds for this visit */ });
    return note;
  }
  /** The person's preferences ride their profile. A first visit nobody has touched yet is
   *  drawn again with them, so even the opening tune honours a block. */
  async function loadPrefs(): Promise<void> {
    try { profile = await host.profile.get(); } catch { return; }
    prefs = loadMusicPrefs(profile);
    shuffleGenres = loadShuffleGenres(profile);
    paintGenre();
    if (!prefs.favourites.size && !prefs.blocked.size) return;
    if (firstVisit && !touched) restate({ ...shuffleMusic(Math.random, { bars: state.bars, prefs }), bars: state.bars });
    browser?.refresh();
  }

  /** What each track plays, in its row and its lane head: the instruments by how much of the track they play. */
  function paintSummaries(): void {
    const text: Record<Track, string> = { lead: '', keys: '', bass: '', drums: '', fx: '' };
    for (const tr of PITCHED) {
      const counts = new Map<string, number>();
      for (const b of bars) if (b.notes.some(n => n.voice === tr)) { const id = instrumentIdOf(b, tr); counts.set(id, (counts.get(id) ?? 0) + 1); }
      const ids = [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => namesOf(tr)[id] ?? id);
      text[tr] = ids.length ? `${ids.slice(0, 2).join(', ')}${ids.length > 2 ? ` +${ids.length - 2}` : ''}` : t('Not playing');
      if (ids.length) silentParts.delete(tr); else silentParts.add(tr);
    }
    // The lane heads' short names follow on the next paint.
    laneHeadKey = '';
    text.drums = `${state.kit ? t(LOFI_KIT_NAME[state.kit]) : t('Style kit')}${state.drums ? '' : ` · ${t('Off')}`}`;
    text.fx = state.tag ? t(TAG_LABEL[state.tag] ?? state.tag) : t('Lolly tag: as composed');
    for (const el of page.querySelectorAll<HTMLElement>('[data-summary]')) {
      const tr = TRACKS.find(x => x === el.dataset.summary);
      if (tr) el.textContent = text[tr];
    }
    // The drums' lane head: the kit in two words, or that the drums are off.
    const drumsShort = page.querySelector<HTMLElement>('[data-short="drums"]');
    if (drumsShort) drumsShort.textContent = !state.drums ? t('Off') : state.kit ? t(LOFI_KIT_NAME[state.kit]) : t('Style kit');
    for (const el of page.querySelectorAll<HTMLElement>('.ms-browse')) {
      const tr = TRACKS.find(x => x === el.dataset.browse);
      if (!tr) continue;
      el.classList.toggle('is-set', tr === 'drums' ? !!state.kit : tr !== 'fx' && !!state[tr]);
      el.setAttribute('aria-label', tRaw('{track}: {names}. Browse and hear the instruments.', { track: t(TRACK_LABEL[tr]), names: text[tr] }));
      el.title = text[tr];
    }
    // The effects lane's short menu carries the whole choice in its tooltip.
    for (const sel of page.querySelectorAll<HTMLSelectElement>('[data-tag-short]')) sel.title = text.fx;
  }

  // ── wiring ───────────────────────────────────────────────────────────────────
  const listen = <K extends keyof HTMLElementEventMap>(sel: string, type: K, fn: (e: HTMLElementEventMap[K], el: HTMLElement) => void): void => {
    for (const el of page.querySelectorAll<HTMLElement>(sel)) el.addEventListener(type, e => fn(e, el));
  };
  listen('[data-play]', 'click', () => { if (station || renderedSrc) stopPlayback(); else play(selected); });
  /** A new tune from a change of style, seed or length: checked for blocked instruments, then composed. */
  const newTune = (): void => { const note = renew(); recompose(); if (note) say(note); };
  /** The genre button (its icon and name) and the shuffle button's words, in step with the state. */
  const paintGenre = (): void => {
    const title = genreTitle(state.mood);
    q<HTMLElement>('[data-genre-icon]').replaceChildren(genreIconNode(state.mood, 18));
    q<HTMLElement>('[data-genre-name]').textContent = title;
    const btn = q<HTMLElement>('[data-genre]');
    btn.setAttribute('aria-label', tRaw('Genre: {genre}. Choose a genre', { genre: title }));
    btn.title = t('Choose a genre');
    const shuffle = q<HTMLElement>('[data-shuffle]');
    const label = shuffleGenres
      ? t('Shuffle: a new genre, seed and sound')
      : tRaw('Shuffle: a new seed and sound in {genre}. Shuffle genres is off.', { genre: title });
    shuffle.setAttribute('aria-label', label);
    shuffle.title = label;
  };
  const setStyle = (value: string | undefined): void => {
    state.mood = parseMusicState(`style=${value ?? ''}`).mood;
    paintGenre(); newTune(); fit();
  };
  /** "Shuffle genres", from the genre picker's switch: kept on the profile with the other music preferences. */
  const saveShuffleGenres = (on: boolean): void => {
    shuffleGenres = on;
    paintGenre();
    if (!profile) return;
    setShuffleGenres(profile, on);
    const writer = host.profile;
    if (canWriteProfile(writer)) void writer.set(profile).catch(() => { /* storage off: the choice holds for this visit */ });
  };
  listen('[data-genre]', 'click', (_e, el) => {
    openGenrePicker({ current: () => state.mood, pick: setStyle, shuffleGenres: () => shuffleGenres, setShuffleGenres: saveShuffleGenres }, { opener: el });
  });
  /** The seed field is as wide as its number, so a short seed sits snug beside the shuffle. */
  const seedInput = q<HTMLInputElement>('[data-seed]');
  const sizeSeed = (): void => { seedInput.style.width = `${Math.max(2, seedInput.value.length) + 1}ch`; };
  const setSeed = (seed: number): void => {
    state.seed = ((seed % 4294967296) + 4294967296) % 4294967296;
    seedInput.value = String(state.seed);
    sizeSeed();
    newTune();
  };
  listen('[data-seed]', 'change', (_e, el) => { if (el instanceof HTMLInputElement) setSeed(Math.floor(Number(el.value) || 0)); });
  listen('[data-seed]', 'input', () => sizeSeed());
  listen('[data-seed-step]', 'click', (_e, el) => setSeed(state.seed + Number(el.dataset.seedStep)));
  /** Put every control back in step with the state, after a shuffle or a reset. */
  const syncControls = (): void => {
    paintGenre();
    seedInput.value = String(state.seed);
    sizeSeed();
    q<HTMLSelectElement>('[data-bars]').value = String(state.bars);
    fillOptions();
    for (const el of page.querySelectorAll<HTMLElement>('[data-mute]')) el.setAttribute('aria-pressed', String(muted.has(el.dataset.mute as Track)));
    for (const el of page.querySelectorAll<HTMLElement>('[data-solo]')) el.setAttribute('aria-pressed', String(solo.has(el.dataset.solo as Track)));
    paintSilent();
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
  const restate = (next: MusicState): string => {
    for (const k of Object.keys(state) as (keyof MusicState)[]) delete state[k];
    Object.assign(state, next);
    swapped.clear();
    const note = avoid();
    syncControls(); recompose(); fit();
    return note;
  };
  // Shuffle: a new genre, seed and sound (lib/music-shuffle.ts), or with "Shuffle genres"
  // off a new seed and sound in this genre. Shift keeps the genre, the seed and the key,
  // and shuffles only the sound. The tempo goes back to the tune's own, and the length
  // stays the person's.
  listen('[data-shuffle]', 'click', (e, el) => {
    popAgain(el);
    const shift = e instanceof MouseEvent && e.shiftKey;
    const fixed = shift ? { keep: { mood: state.mood, seed: state.seed } } : shuffleGenres ? {} : { genre: state.mood };
    const drawn = shuffleMusic(Math.random, { bars: state.bars, after: state.mood, prefs, ...fixed });
    const note = restate({ ...drawn, bars: state.bars, ...(shift && state.transpose ? { transpose: state.transpose } : {}) });
    say(`${t('Shuffled')}: ${genreTitle(state.mood)} · ${t('seed')} ${state.seed}${note ? ` ${note}` : ''}`);
  });
  listen('[data-reset]', 'click', () => {
    muted.clear(); solo.clear();
    const note = restate({ ...parseMusicState(''), mood: state.mood, seed: state.seed });
    say(`${t('Every setting but the style and the seed is back to the composer\'s own.')}${note ? ` ${note}` : ''}`);
  });
  listen('[data-bars]', 'change', (_e, el) => { if (el instanceof HTMLSelectElement) { state.bars = Number(el.value); newTune(); fit(); } });
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
  // A track's head or row opens its instrument browser. The kit (chosen there) changes
  // the drums' sound, never their notes; the tag and the effect families change what the
  // effects lane plays. Each is in the link.
  listen('[data-browse]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.browse); if (tr && tr !== 'fx') openBrowser(tr, undefined, el); });
  listen('[data-tag]', 'change', (_e, el) => {
    if (!(el instanceof HTMLSelectElement)) return;
    state.tag = TAG_CHOICES.find(c => c === el.value);
    // The lane head and the Mix section each have the menu: both say the same.
    for (const sel of page.querySelectorAll<HTMLSelectElement>('[data-tag]')) sel.value = el.value;
    recompose();
  });
  listen('[data-fx-family]', 'click', (_e, el) => {
    const family = FX_FAMILIES.find(f => f === el.dataset.fxFamily);
    if (!family) return;
    const quiet = new Set(state.quiet ?? []);
    if (quiet.has(family)) quiet.delete(family); else quiet.add(family);
    state.quiet = quiet.size ? FX_FAMILIES.filter(f => quiet.has(f)) : undefined;
    el.setAttribute('aria-pressed', String(!quiet.has(family)));
    recompose();
  });
  // Mute and solo: a track's lane head and its row on a phone both show the same switch,
  // and a track that cannot be heard is drawn faint in both.
  const paintSilent = (): void => {
    for (const tr of TRACKS) {
      const silent = muted.has(tr) || (solo.size > 0 && !solo.has(tr)) || (tr === 'drums' && !state.drums);
      for (const el of page.querySelectorAll<HTMLElement>(`[data-track="${tr}"], [data-row="${tr}"]`)) el.classList.toggle('is-silent', silent);
    }
  };
  const toggle = (set: Set<Track>, attr: 'mute' | 'solo', tr: Track): void => {
    if (set.has(tr)) set.delete(tr); else set.add(tr);
    for (const el of page.querySelectorAll<HTMLElement>(`[data-${attr}="${tr}"]`)) el.setAttribute('aria-pressed', String(set.has(tr)));
    paintSilent();
    station?.setMix(effectiveMix()); draw();
  };
  listen('[data-mute]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.mute); if (tr) toggle(muted, 'mute', tr); });
  listen('[data-solo]', 'click', (_e, el) => { const tr = TRACKS.find(x => x === el.dataset.solo); if (tr) toggle(solo, 'solo', tr); });
  // The sections fold, and each viewer's open ones are remembered on this device. The
  // lanes grow or shrink to keep the editor on the screen as a section opens or closes:
  // the fold moves (parts/disclosure.css), so the lanes follow the sections' size as it
  // changes rather than the moment of the toggle.
  const sections = [...page.querySelectorAll<HTMLDetailsElement>('details[data-sec]')];
  try {
    const open = new Set<string>(JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '[]'));
    for (const d of sections) d.open = open.has(d.dataset.sec ?? '');
  } catch { /* private mode, or nothing kept: every section starts folded */ }
  for (const d of sections) {
    d.addEventListener('toggle', () => {
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections.filter(x => x.open).map(x => x.dataset.sec))); } catch { /* private mode */ }
    });
  }
  let sectionsHeight = -1;
  const sectionsSize = new ResizeObserver(([entry]) => {
    const h = Math.round(entry?.contentRect.height ?? 0);
    if (h === sectionsHeight) return;
    sectionsHeight = h;
    onResize();
  });
  sectionsSize.observe(q<HTMLElement>('.ms-sections'));
  // The effects row on a phone opens the Mix section, where the effects are.
  listen('[data-open-mix]', 'click', () => {
    const mix = sections.find(d => d.dataset.sec === 'mix');
    if (!mix) return;
    mix.open = true;
    mix.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    mix.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
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
    page.classList.toggle('viz-off', vizMode === 'off');
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
    if (!analyser || (!station && !renderedSrc)) return;
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
      selected = start; play(start); return;
    }
    if ((lane === 'lead' || lane === 'keys' || lane === 'bass' || lane === 'drums') && bar.section !== 'rest') openBrowser(lane, bar.section);
    say(`${t('Bar')} ${selected + 1} · ${sectionLabel(bar.section)} · ${bar.chord || t('rest')}`);
    draw();
  });
  canvas.addEventListener('dblclick', e => { selected = barAt(e); if (renderedSrc) playRendered(selected); else play(selected); });
  listen('[data-render-play]', 'click', () => { void renderAndPlay(); });
  listen('[data-viz-full]', 'click', () => {
    const stage = page.querySelector<HTMLElement>('.ms-stage');
    if (!stage) return;
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (vizMode !== 'milkdrop') { vizMode = 'milkdrop'; showVizMode(); void syncRichViz(); }
    void stage.requestFullscreen().catch(() => { say(t('This browser would not go full screen.')); });
  });
  // What a download and a save will record, said before either is clicked: the download
  // in its panel, under the switch, and each save in Save's own choices.
  const paintCredNote = (): void => {
    credNote.textContent = credToggle.checked
      ? tRaw('Downloads will carry Content Credentials that record: {declaration}.', { declaration: TUNE_DECLARATION })
      : t('Downloads will carry no Content Credentials.');
  };
  credToggle.addEventListener('change', paintCredNote);
  paintCredNote();
  /** The maker a tune saved to Assets records (the profile's name), once the profile is read. */
  let makerName = '';
  void (async () => {
    const { profileMaker } = await import('../lib/tune-provenance.ts');
    try { makerName = profileMaker(await host.profile.get()); } catch { /* no profile, no maker */ }
  })().catch(() => { /* the note is a courtesy; the save still says what it wrote */ });
  /** Save's two places, each with what a save there records. */
  const saveChoices = (): SaveChoice[] => [
    {
      id: 'assets', icon: 'grid', title: t('Save to assets'),
      note: makerName
        ? tRaw('Records {maker} as the maker, the music generator and the Lolly and engine versions. No licence is set.', { maker: makerName })
        : t('Records the music generator and the Lolly and engine versions. No maker or licence is set.'),
    },
    {
      id: 'projects', icon: 'folder', title: t('Save to projects'),
      note: projectSlot ? t('Updates this project with every setting, to open here again.') : t('Keeps every setting, so the tune opens here again as it is now.'),
    },
  ];
  // Download and Save to library show their work on the button itself: busy, then a tick
  // or the failure in plain words beside it (views/music-studio/action-button.ts).
  const downloadAct = actionButton(downloadBtn, { busy: t('Preparing…'), done: t('Downloaded'), failed: t('The file could not be made.'), rest: 'download', trail: 'chevronDown', errorAfter: q<HTMLElement>('[data-render-pill]') });
  const saveAct = actionButton(q<HTMLButtonElement>('[data-save]'), { busy: t('Saving…'), done: t('Saved'), failed: t('The tune could not be saved.'), trail: 'chevronDown' });
  const saveMenu = wireSaveMenu(q<HTMLButtonElement>('[data-save]'), saveChoices, (to) => { void saveTo(to); });
  // The panel's Download closes the panel, renders first when the track has not been
  // rendered (behind the same card as Play), and shows its progress on the pill.
  listen('[data-download]', 'click', () => { renderPill.close(true); void download(); });
  async function download(): Promise<void> {
    if (!(await renderWithCard())) return;
    const failed = await downloadAct.run(async () => {
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
    });
    if (failed) say(failed);
  }
  /**
   * Save the tune where the person chose. Save itself says Saved (a short word, so the
   * phone's bar keeps its shape); the toast says where, with Open to go there.
   */
  async function saveTo(to: SaveDestination): Promise<void> {
    let opened = '';
    const failed = await saveAct.run(async () => {
      opened = to === 'assets' ? await saveToAssets() : await saveToProject();
    });
    if (failed) { say(failed); return; }
    const { showUndoToast } = await import('../lib/undo-toast.ts');
    showUndoToast({
      message: to === 'assets' ? t('Saved to assets') : t('Saved to projects'),
      actionLabel: t('Open'),
      undo: () => { location.hash = opened; },
      duration: 6000,
    });
  }
  /** Assets: the tune as an asset. Answers where the asset opens. */
  async function saveToAssets(): Promise<string> {
      if (!canUpload(host.assets)) throw new PlainFailure(t('This host cannot save to the library.'));
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
      const id = `user/tune/${Date.now()}-${state.mood}-${state.seed}`;
      await host.assets._uploadUserAsset({
        id, type: 'audio', format: LOFI_TUNE_FORMAT,
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
      return `#/a?asset=${encodeURIComponent(id)}`;
  }
  /**
   * Projects: every setting kept as a project (lib/music-project.ts), with a picture of
   * the tune for its tile. A tune opened from a project, or saved to one already, updates
   * that project in place. Answers where Projects opens.
   */
  async function saveToProject(): Promise<string> {
    const slot = projectSlot ?? newMusicSlot();
    const record = musicProjectRecord(state, trackName());
    const save = host.state.save.bind(host.state) as (slot: string, data: object, thumb?: string | null) => Promise<void>;
    await save(slot, record, coverImage());
    projectSlot = slot;
    writeLink();
    void import('../lib/sync-service.ts').then(m => m.markSyncDirty()).catch(() => { /* device sync is off */ });
    say(t('Saved to projects: it opens here again with every setting, from Projects.'));
    return '#/p';
  }
  /**
   * The tune's picture for its project tile: the sections as bands in their colours and
   * the notes of each part across them, the timeline at a glance. Null when the browser
   * cannot draw one; the tile then shows its plain cover.
   */
  function coverImage(): string | null {
    try {
      const W = 480, H = 270;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const cx = c.getContext('2d');
      if (!cx) return null;
      const css = getComputedStyle(page);
      cx.fillStyle = css.getPropertyValue('--ms-surface').trim() || '#fff';
      cx.fillRect(0, 0, W, H);
      const bw = W / Math.max(1, bars.length);
      bars.forEach((b, i) => {
        const colour = sectionColour.get(b.section);
        if (!colour || b.section === 'rest') return;
        cx.globalAlpha = 0.18;
        cx.fillStyle = colour;
        cx.fillRect(i * bw, 0, Math.ceil(bw), H);
      });
      // Each part in a band of its own: the pitched parts by pitch, the drums and the effects as ticks.
      const band: Record<Track, [number, number]> = { lead: [0.06, 0.3], keys: [0.32, 0.54], bass: [0.56, 0.76], drums: [0.8, 0.9], fx: [0.92, 0.97] };
      const pitch: Record<Pitched, [number, number]> = { lead: [52, 96], keys: [48, 80], bass: [24, 64] };
      bars.forEach((b, i) => {
        for (const n of b.notes) {
          const tr = trackOf(n.voice);
          const [top, bottom] = band[tr];
          // The drums and the effects stay light: a steady pulse would fill their band.
          cx.globalAlpha = tr === 'drums' || tr === 'fx' ? 0.2 + n.vel * 0.2 : 0.55 + n.vel * 0.45;
          cx.fillStyle = trackColour[tr];
          const x = (i + n.beat / 4) * bw;
          if (tr === 'lead' || tr === 'keys' || tr === 'bass') {
            const [lo, hi] = pitch[tr];
            const y = (top + (1 - (Math.min(hi, Math.max(lo, n.midi)) - lo) / (hi - lo)) * (bottom - top)) * H;
            cx.fillRect(x, y, Math.max(1.5, (n.dur / 4) * bw), 2.5);
          } else cx.fillRect(x, top * H, 1.5, (bottom - top) * H);
        }
      });
      cx.globalAlpha = 1;
      return c.toDataURL('image/jpeg', 0.82);
    } catch { return null; }
  }
  listen('[data-link]', 'click', () => {
    void navigator.clipboard.writeText(`${location.origin}${location.pathname}#/music?${musicStateParams(state)}`)
      .then(() => { say(t('Link copied: it opens this track, ready to edit.')); })
      .catch(() => { say(t('Could not copy the link.')); });
  });
  // Space plays and stops, shift and the arrows step the seed, Escape closes the
  // instrument browser, and then leaves the way the back button does. Keys pressed in a
  // dialog (the browser, the render card) or in the download options are their own, and
  // Space on a button, a section's head or a field does what it always does there.
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || renderPill.isOpen() || saveMenu.isOpen() || (e.target instanceof Element && e.target.closest('dialog'))) return;
    if (e.key === 'Escape') {
      if (browser) { browser.close(); return; }
      view.querySelector<HTMLElement>('[data-back-pill]')?.click();
      return;
    }
    if (e.target instanceof Element && e.target.closest('input, select, textarea, button, summary, a[href], [role="slider"], [contenteditable]')) return;
    if (e.key === ' ') { e.preventDefault(); if (station || renderedSrc) stopPlayback(); else play(selected); }
    else if (e.key === 'ArrowRight' && e.shiftKey) setSeed(state.seed + 1);
    else if (e.key === 'ArrowLeft' && e.shiftKey) setSeed(state.seed - 1);
  };
  document.addEventListener('keydown', onKey);
  const onResize = (): void => { fitHeight(); draw(); };
  window.addEventListener('resize', onResize);
  scroll.addEventListener('scroll', () => { draw(); }, { passive: true });

  // The seed as a design-tool number: drag across it to slide through seeds. While it
  // slides, only the picture follows; letting go plays and links the seed it stopped on.
  const detachScrub = attachScrub(page, {
    selector: '[data-seed]', min: 0, max: 4294967295, unitPerPx: 1, touch: true,
    onDrag: (_el, value) => { state.seed = Math.round(value); sizeSeed(); bars = composeTrack(state); paintVersion++; times = barTimes(bars); meta(); draw(); },
    onCommit: (el) => setSeed(Math.floor(Number(el.value) || 0)),
  });
  // The tempo slides too: a beat a minute for every few pixels, the length following as it goes.
  const detachTempoScrub = attachScrub(page, {
    selector: '[data-bpm]', min: BPM_RANGE[0], max: BPM_RANGE[1], unitPerPx: 0.25, touch: true,
    onDrag: (_el, value) => { state.bpm = Math.round(value); bars = composeTrack(state); paintVersion++; times = barTimes(bars); meta(); draw(); },
    onCommit: (el) => setBpm(Number(el.value)),
  });

  say(HINT);
  writeLink(); meta(); paintSummaries(); paintGenre(); paintSilent(); sizeSeed(); fitHeight(); fit(); drawViz();
  void loadPrefs();
  // A kept tune's address (from Projects, lib/music-project.ts) opens that tune exactly as
  // it was saved: its settings come back from the project's record, as a link would bring
  // them, with no instrument swapped. An address that also carries the settings (a reload
  // after an edit) already has the newest ones and keeps them.
  if (openSlot && !/(^|[?&])(style|seed)=/.test(params)) {
    void host.state.load(openSlot).then((data) => {
      const kept = musicStateFromProject(data);
      if (!kept) { projectSlot = null; writeLink(); say(t('This project could not be opened. It may have been deleted.')); return; }
      for (const k of Object.keys(state) as (keyof MusicState)[]) delete state[k];
      Object.assign(state, kept);
      swapped.clear();
      syncControls(); recompose(); fit();
      say(t('Opened from Projects.'));
    }).catch(() => { say(t('This project could not be opened.')); });
  }
  view._cleanup = () => {
    downloadAct.reset(); saveAct.reset();
    renderPill.close();
    saveMenu.close();
    sectionsSize.disconnect();
    detachLang();
    detachScrub();
    detachTempoScrub();
    rich?.destroy();
    stopPlayback();
    renderCard?.close();
    rendering++;
    if (document.fullscreenElement) void document.exitFullscreen();
    document.removeEventListener('keydown', onKey);
    browser?.close();
    window.removeEventListener('resize', onResize);
    void ctx?.close();
  };
}
