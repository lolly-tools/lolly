// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's instrument browser (#/music): one for each pitched track (the
 * Melody, the Chords and the Bass) and one for the drums' kits. It opens from what the
 * person clicked, and shows where. On a wide screen it is a popup beside that origin (a lane
 * head, or a section in a lane), growing out of the click and shrinking back into it
 * when it closes (instrument-popup.ts); it stays out of the way, so the timeline is
 * usable beside the popup and a click on another section moves the popup there. On a phone it
 * is a sheet that rises from the bottom. Its heading gives the origin ("Chords ·
 * Chorus", or "Chords · every section" from the lane head) with what plays there now
 * under it ("Auto · Banjo", or the instrument chosen), and the view lights up the lane
 * or the kind of section behind the popup while the popup is open. The cards come in with the app's
 * quick entrance cascade.
 *
 * Instruments are cards grouped by family, a card with a line under its name where the name
 * alone says too little (lib/lofi-names.ts LOFI_INSTRUMENT_LINE). A card plays two bars of this tune's part, in
 * the kind of section chosen at the top, on that instrument: a small station of the
 * generator's own (lib/lofi-station.ts) started at that section, with the instrument set
 * there and the other parts turned down, stopped after two bars. "Use here" sets the
 * instrument for every section of that kind, and "Use everywhere" for the whole track.
 * The first card leaves the part to the composer, and reads "Auto" with the instrument
 * the composer plays in that section ("Auto · Banjo"; track-names.ts).
 * The star makes an instrument a favourite and the block button keeps it out of shuffles
 * and new tunes (lib/music-prefs.ts); the view keeps both on the person's profile, and
 * "Your instruments" in the heading lists every star and block for every part, each with
 * one button to take it away (your-instruments.ts).
 *
 * Escape and the close button close the browser and put focus back on the control that
 * opened the browser. Built on mountModal (components/modal.ts): modal on a phone, in the
 * page on a wider screen. The markup is written once when it opens; after that only
 * attributes and text change, and Your instruments is built with DOM calls.
 */
import { closeButtonHtml } from '../../lib/close-button.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import { instrumentIcon, musicIconNode } from '../../lib/instrument-icons.ts';
import { LOFI_KEYS_NAME, LOFI_LEAD_NAME, LOFI_BASS_NAME, LOFI_SNARE_NAME, LOFI_HATS_NAME, LOFI_INSTRUMENT_LINE } from '../../lib/lofi-names.ts';
import { LOFI_KITS, LOFI_KIT_NAME } from '../../lib/lofi-drums.ts';
import { LofiStation, type LofiMix } from '../../lib/lofi-station.ts';
import { composeTrack, trackSettings, type MusicState } from '../../lib/music-state.ts';
import { autoLabel, sentenceCase, styleKitName, trackName } from './track-names.ts';
import { cascade, motionOn, placePopup, playOut, type PopupOrigin } from './instrument-popup.ts';
import { yourInstruments, type YourInstruments } from './your-instruments.ts';
import { LOFI_SNARES, LOFI_HATS, LOFI_DRUM_VOICES, type LofiBar } from '../../../../../engine/src/lofi-compose.ts';
import {
  INSTRUMENT_FAMILIES, familyOf, instrumentsOf, isBlocked, isFavourite, setPartInstrument,
  type InstrumentFamily, type MusicPart, type MusicPrefKind, type MusicPrefs,
} from '../../lib/music-prefs.ts';
import '../../styles/parts/music-browser.css';

export type BrowseTrack = MusicPart | 'drums';

/** What the browser needs from the music generator. */
export interface BrowserHost {
  /** The generator's live state: read, never written here. */
  state: MusicState;
  /** The composed track now. */
  bars(): readonly LofiBar[];
  /** A kind of section's name in this style ("Chorus" for a band's drop). */
  sectionLabel(section: string): string;
  prefs(): MusicPrefs;
  /** Star or block an instrument, or undo either; the generator saves it to the profile.
   *  Returns what that changed in this tune (a blocked instrument swapped out), if anything. */
  setPref(part: MusicPart, id: string, kind: MusicPrefKind, on: boolean): string;
  /** Choose an instrument (undefined: the composer's) for one kind of section, or for the whole track when `section` is null. A kit for the drums. */
  use(track: BrowseTrack, id: string | undefined, section: string | null): void;
  /** The drums' snare or cymbals for one kind of section (undefined: as composed). */
  useDrumPart(section: string, which: 'snare' | 'hats', id: string | undefined): void;
  setDrumsOn(on: boolean): void;
  /** The audio graph to play previews through, made on first use. */
  audio(): { ctx: BaseAudioContext; dest: AudioNode };
  /** Stop the track if it plays, so a preview is heard alone. */
  stopPlayback(): void;
  trackColour(track: BrowseTrack): string;
  /** The browser's origin changed (another kind of section, or every section), so the view lights up the lane behind it again. */
  focusChanged?(): void;
}

export interface InstrumentBrowser {
  readonly track: BrowseTrack;
  /** Show and preview another kind of section. */
  setSection(section: string): void;
  /** Point the browser at a new origin: a kind of section, or every section, and the place clicked. */
  retarget(to: { section?: string; wholeTrack: boolean; origin?: PopupOrigin }): void;
  /** What the browser is about, for the view to light up behind it: the track, and its kind of section (null: every section). */
  focus(): { track: BrowseTrack; section: string | null };
  /** Paint again after the track or the preferences changed. */
  refresh(): void;
  stopPreview(): void;
  /** Close with the leaving motion, or at once (`immediate`, the view going away). */
  close(immediate?: boolean): void;
}

/** How long a preview plays, in bars. */
const PREVIEW_BARS = 2;
/** How loud the other parts play under the one previewed. */
const UNDER = 0.3;
const DRUM_VOICES = new Set<string>(LOFI_DRUM_VOICES);
/** The browser opens as a side panel from this width, as a sheet below it (the view's breakpoint). */
const WIDE = '(min-width: 761px)';
let opened = 0;

/** An instrument's name as a sentence carries it ("felt piano", "Rhodes"), or a kit's ("Jazz kit"). */
export function instrumentWord(track: BrowseTrack, id: string): string {
  if (track === 'drums') {
    const kit = LOFI_KITS.find(k => k === id);
    return kit ? t(LOFI_KIT_NAME[kit]) : id;
  }
  const names: Record<string, string> = track === 'keys' ? LOFI_KEYS_NAME : track === 'lead' ? LOFI_LEAD_NAME : LOFI_BASS_NAME;
  return names[id] ?? id;
}
/** An instrument's name as a card or the start of a sentence shows it ("Felt piano"). */
export const instrumentName = (track: BrowseTrack, id: string): string => sentenceCase(instrumentWord(track, id));

const FAMILY_LABEL = (): Record<InstrumentFamily, string> => ({
  keys: t('Keys'), guitars: t('Guitars and strings'), bells: t('Bells and mallets'), winds: t('Winds and brass'),
  voices: t('Voices'), world: t('World'), synths: t('Synths'), chip: t('8-bit'),
});
const TRACK_TITLE = (): Record<BrowseTrack, string> => ({ lead: t('Instruments for the melody'), keys: t('Instruments for the chords'), bass: t('Instruments for the bass'), drums: t('Drum kits') });

/** Whether a bar plays the track. */
const plays = (bar: LofiBar, track: BrowseTrack): boolean => bar.notes.some(n => (track === 'drums' ? DRUM_VOICES.has(n.voice) : n.voice === track));

/** The kinds of section the track plays in, in the order they first come. */
export function sectionsFor(bars: readonly LofiBar[], track: BrowseTrack): string[] {
  const out: string[] = [];
  for (const b of bars) if (b.section !== 'rest' && !out.includes(b.section) && plays(b, track)) out.push(b.section);
  return out;
}

/** The instruments the part plays in a kind of section, as the track has them now. */
function heardIn(bars: readonly LofiBar[], part: MusicPart, section: string): string[] {
  const out: string[] = [];
  for (const b of bars) {
    if (b.section !== section || !plays(b, part)) continue;
    const id = b.voices?.[part] ?? b.tune.style[part];
    if (!out.includes(id)) out.push(id);
    if (part === 'lead' && b.voices?.double && !out.includes(b.voices.double)) out.push(b.voices.double);
    if (part === 'bass' && b.voices?.over && !out.includes(b.voices.over)) out.push(b.voices.over);
  }
  return out;
}

/** The state a preview plays: the instrument set in this kind of section (`''` is the composer's own, undefined the track as it is). */
export function previewState(state: MusicState, track: BrowseTrack, id: string, section: string): MusicState {
  const s: MusicState = { ...state, mix: { ...state.mix }, sections: Object.fromEntries(Object.entries(state.sections).map(([k, v]) => [k, { ...v }])) };
  if (track === 'drums') {
    s.drums = true;
    s.kit = LOFI_KITS.find(k => k === id);
  } else if (id) {
    setPartInstrument(s, track, id, section);
  } else {
    setPartInstrument(s, track, undefined, section);
    setPartInstrument(s, track, undefined);
  }
  return s;
}

/** The preview's mix: the part at its own level (at least the designed one), the rest turned down, no effects. */
export function previewMix(mix: LofiMix, track: BrowseTrack): LofiMix {
  const m: LofiMix = { ...mix, fx: 0 };
  for (const k of ['keys', 'lead', 'bass', 'drums'] as const) m[k] = k === track ? Math.max(1, mix[k]) : mix[k] * UNDER;
  return m;
}

export function openInstrumentBrowser(h: BrowserHost, track: BrowseTrack, opts: {
  section?: string;
  /** Opened for every section (a lane head) or for the section given (a section in a lane). Default: every section. */
  wholeTrack?: boolean;
  /** Where the person clicked, so the popup opens beside that place and grows out of the point. */
  origin?: PopupOrigin;
  opener?: HTMLElement | null;
  onClose?: () => void;
} = {}): InstrumentBrowser {
  const n = ++opened;
  const part: MusicPart | null = track === 'drums' ? null : track;
  const ids: readonly string[] = part ? instrumentsOf(part) : LOFI_KITS;
  const wide = window.matchMedia(WIDE).matches;
  let sections = sectionsFor(h.bars(), track);
  let section = opts.section && sections.includes(opts.section) ? opts.section : sections[0] ?? '';
  /** For every section (opened from a lane head) or for the kind of section above (from a section in a lane). */
  let wholeTrack = opts.wholeTrack !== false || !section;
  let origin = opts.origin;
  let yours: YourInstruments | null = null;
  /** The card chosen for Use: an instrument, or '' for the composer's own. Null before one is. */
  let selected: string | null = null;
  let preview: { station: LofiStation; timer: ReturnType<typeof setTimeout>; id: string } | null = null;

  const titleId = `msb-title-${n}`;
  const stateId = (id: string): string => `msb-st-${n}-${id || 'auto'}`;
  const playGlyph = `<span class="msb-play" aria-hidden="true"><span class="msb-go">${icon('play', { size: 14, filled: true })}</span><span class="msb-stop">${icon('pause', { size: 14, filled: true })}</span></span>`;
  const card = (id: string, name: string, toggles: boolean): string => `
    <li class="msb-card" data-card="${escapeHtml(id)}">
      <button type="button" class="msb-main" data-preview="${escapeHtml(id)}" aria-pressed="false" aria-label="${escapeHtml(name)}" aria-describedby="${stateId(id)} msb-how-${n}">
        <span class="msb-icon" aria-hidden="true">${id ? '' : icon('sparkle', { size: 18 })}</span>
        <span class="msb-text"><span class="msb-name">${escapeHtml(name)}</span>${LOFI_INSTRUMENT_LINE[id] ? `<span class="msb-line">${escapeHtml(t(LOFI_INSTRUMENT_LINE[id]))}</span>` : ''}<span class="msb-state" id="${stateId(id)}"></span></span>
        ${playGlyph}
      </button>
      ${toggles ? `
      <button type="button" class="msb-toggle msb-fav" data-fav="${escapeHtml(id)}" aria-pressed="false" aria-label="${escapeHtml(tRaw('Favourite: {name}', { name }))}" title="${escapeHtml(t('Favourite'))}">${icon('star', { size: 18 })}</button>
      <button type="button" class="msb-toggle msb-block" data-block="${escapeHtml(id)}" aria-pressed="false" aria-label="${escapeHtml(tRaw('Block from shuffle: {name}', { name }))}" title="${escapeHtml(t('Block from shuffle'))}">${icon('ban', { size: 18 })}</button>` : ''}
    </li>`;
  const families = (): string => {
    if (!part) return `<ul class="msb-cards" role="list">${ids.map(id => card(id, instrumentName('drums', id), false)).join('')}</ul>`;
    const labels = FAMILY_LABEL();
    return INSTRUMENT_FAMILIES.map(f => {
      const members = ids.filter(id => familyOf(part, id) === f);
      if (!members.length) return '';
      return `<section class="msb-family" aria-labelledby="msb-fam-${n}-${f}">
        <h3 class="msb-family-title" id="msb-fam-${n}-${f}">${escapeHtml(labels[f])}</h3>
        <ul class="msb-cards" role="list">${members.map(id => card(id, instrumentName(part, id), true)).join('')}</ul>
      </section>`;
    }).join('');
  };
  const content = `
    <div class="msb-head">
      <span class="msb-grip" aria-hidden="true"></span>
      <div class="msb-title-row">
        <button type="button" class="btn btn--ghost btn--sm msb-back" data-yours-back hidden aria-label="${escapeHtml(t('Back to the instruments'))}" title="${escapeHtml(t('Back to the instruments'))}">${icon('chevronLeft', { size: 18 })}</button>
        <span class="msb-swatch" aria-hidden="true"></span>
        <h2 class="msb-title" id="${titleId}" data-origin-title>${escapeHtml(TRACK_TITLE()[track])}</h2>
        ${track === 'drums' ? `<button type="button" class="msb-chip msb-drums-on" data-drums-on aria-pressed="false">${escapeHtml(t('Drums on'))}</button>` : `<button type="button" class="msb-chip" data-yours title="${escapeHtml(t('Every instrument you starred or blocked, for every part'))}">${escapeHtml(t('Your instruments'))}</button>`}
        ${closeButtonHtml({ className: 'msb-close', attrs: { 'data-close': true, title: t('Close') } })}
      </div>
      <p class="msb-now msb-origin-now" data-now></p>
      <p id="msb-how-${n}" hidden>${escapeHtml(track === 'drums' ? t('Plays two bars of this tune’s drums on this kit.') : t('Plays two bars of this tune’s part on this instrument, in the section chosen above.'))}</p>
      <div class="msb-sections" role="group" aria-label="${escapeHtml(t('Hear it in'))}" data-sections></div>
    </div>
    <div class="msb-body">
      <ul class="msb-cards msb-cards--auto" role="list">${card('', t('Auto'), false)}</ul>
      ${families()}
      ${track === 'drums' ? `
      <div class="msb-drum-parts" role="group" aria-labelledby="msb-dp-${n}">
        <p class="msb-family-title" id="msb-dp-${n}" data-drum-parts-title></p>
        <label class="msb-field"><span>${escapeHtml(t('Snare'))}</span><select class="field-select field-select--sm" data-drum-part="snare"></select></label>
        <label class="msb-field"><span>${escapeHtml(t('Cymbals'))}</span><select class="field-select field-select--sm" data-drum-part="hats"></select></label>
      </div>` : ''}
    </div>
    <div class="msb-foot">
      <p class="msb-pick" data-pick-line role="status"></p>
      <div class="msb-actions">
        ${track === 'drums' ? '' : `<button type="button" class="btn btn--sm" data-use="here" disabled><span data-use-here-label>${escapeHtml(t('Use here'))}</span></button>`}
        <button type="button" class="btn btn--primary btn--sm" data-use="everywhere" disabled>${escapeHtml(track === 'drums' ? t('Use this kit') : t('Use everywhere'))}</button>
      </div>
    </div>`;

  let closedBy: 'escape' | 'button' | undefined;
  let leaving = false;
  /** Close with the leaving motion (the popup shrinking back into its origin, the sheet
   *  dropping away), then for good. Under reduced motion it closes at once. */
  function leave(how?: 'escape' | 'button'): void {
    if (leaving) return;
    leaving = true;
    stopPreview();
    void playOut(dlg, 'is-leaving', 500).then(() => modal.close(how));
  }
  const modal: ModalHandle<'escape' | 'button'> = mountModal<'escape' | 'button'>(content, {
    className: `msb ${wide ? 'msb--pop' : 'msb--sheet'}${motionOn() ? ' is-entering' : ''}`,
    modal: !wide,
    cancelValue: 'escape',
    onEscape: () => leave('escape'),
    dismissOnBackdrop: false,
    onClose: (how) => {
      closedBy = how;
      stopPreview();
      // Back to the control that opened the browser, when the person closed it (a route
      // change or another browser opening takes focus elsewhere).
      if (closedBy && opts.opener?.isConnected) opts.opener.focus({ preventScroll: true });
      opts.onClose?.();
    },
  });
  const dlg = modal.el;
  dlg.setAttribute('aria-labelledby', titleId);
  dlg.style.setProperty('--msb-track', h.trackColour(track));
  // A tap on the sheet's dimmed page closes it, with the same motion as Escape.
  dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) leave('escape');
  });
  dlg.addEventListener('animationend', (e) => { if (e.target === dlg) dlg.classList.remove('is-entering'); });
  /** On a wide screen, sit beside the origin and grow from the point clicked. */
  function place(): void {
    if (!wide || !origin) return;
    // The laid-out size, not the drawn one: the opening motion scales the popup down at first.
    const at = placePopup(origin, { width: dlg.offsetWidth, height: dlg.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    dlg.style.left = `${at.left}px`;
    dlg.style.top = `${at.top}px`;
    dlg.style.setProperty('--msb-origin', `${at.originX}px ${at.originY}px`);
    dlg.dataset.side = at.side;
  }
  const q = <T extends Element>(sel: string): T | null => dlg.querySelector<T>(sel);
  // The instruments' own icons, as nodes (the lane heads draw the same ones).
  for (const li of dlg.querySelectorAll<HTMLElement>('.msb-card[data-card]')) {
    const id = li.dataset.card ?? '';
    if (!id) continue;
    li.querySelector('.msb-icon')?.append(musicIconNode(part ? instrumentIcon(part, id) : 'drum', 20));
  }

  // ── painting ───────────────────────────────────────────────────────────────
  const sectionName = (sec: string): string => (sec ? h.sectionLabel(sec) : '');
  function paintSections(): void {
    const box = q<HTMLElement>('[data-sections]');
    if (!box) return;
    const chip = (sec: string, label: string, on: boolean): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'msb-chip';
      b.dataset.section = sec;
      b.textContent = label;
      b.setAttribute('aria-pressed', String(on));
      return b;
    };
    // Every section first: the whole track, as from a lane head. A kind of section then
    // chooses where a card is heard, and what Use in every one of them changes.
    box.replaceChildren(
      ...(part ? [chip('', t('Every section'), wholeTrack)] : []),
      ...sections.map(sec => chip(sec, sectionName(sec), !wholeTrack && sec === section)),
    );
    box.hidden = sections.length < (part ? 1 : 2);
  }
  /** The heading: the track and where the choice applies ("Chords · Chorus", "Chords · every section"). */
  const originTitle = (): string => tRaw('{track} · {where}', { track: trackName(track), where: wholeTrack || !section ? t('every section') : sectionName(section) });
  /** What plays at the origin now, under the heading: Auto and the composer's instrument, or the one chosen and where. */
  function originNow(): string {
    const s = h.state;
    if (!part) return tRaw('Kit: {kit}', { kit: s.kit ? instrumentName('drums', s.kit) : autoLabel(styleKitName(s.mood)) });
    if (!section) return t('This part has no notes in the track.');
    // Every name as a card shows it: "Auto · Fiddle, Harmonica".
    const names = (ids: readonly string[]): string => ids.slice(0, 2).map(id => instrumentName(part, id)).join(', ');
    if (!wholeTrack && s.sections[section]?.[part]) return tRaw('{name}, chosen for every {section}', { name: instrumentName(part, s.sections[section]![part]!), section: sectionName(section) });
    if (s[part]) return tRaw('{name}, chosen for the whole track', { name: instrumentName(part, s[part]!) });
    if (wholeTrack) {
      const heard = [...new Set(sections.flatMap(sec => heardIn(h.bars(), part, sec)))];
      return Object.values(s.sections).some(v => !!v?.[part]) ? names(heard) : autoLabel(names(heard));
    }
    return autoLabel(names(composersOwn(part)));
  }
  /** What a card says about itself (chosen, playing here, blocked), and whether it plays here now. */
  function cardState(id: string): { text: string; current: boolean } {
    const s = h.state;
    let now = '';
    if (!part) now = (s.kit ?? '') === id ? t('In use') : '';
    else if (!id) now = !s.sections[section]?.[part] && !s[part] ? t('In use') : '';
    else if (s.sections[section]?.[part] === id) now = t('Chosen here');
    else if (s[part] === id) now = t('Chosen for the track');
    else if (heardIn(h.bars(), part, section).includes(id)) now = t('Plays here');
    const blocked = !!part && !!id && isBlocked(h.prefs(), part, id);
    return { text: [now, blocked ? t('Blocked') : ''].filter(Boolean).join(' · '), current: !!now };
  }
  /** The composer's own instruments in this kind of section, for the Auto card: as heard
   *  when the part is left to the composer, else from the track composed without the
   *  person's choice for this part. */
  let autoOf: { key: string; ids: string[] } | null = null;
  function composersOwn(p: MusicPart): string[] {
    const s = h.state;
    if (!s[p] && !s.sections[section]?.[p]) return heardIn(h.bars(), p, section);
    const key = `${JSON.stringify(s)}|${section}`;
    if (autoOf?.key !== key) autoOf = { key, ids: heardIn(composeTrack(previewState(s, p, '', section)), p, section) };
    return autoOf.ids;
  }
  /** The Auto card's name: "Auto" and what the composer plays ("Auto · Banjo", "Auto · Jazz kit"). */
  function autoName(): string {
    if (!part) return autoLabel(styleKitName(h.state.mood));
    return autoLabel(composersOwn(part).slice(0, 2).map(id => instrumentName(part, id)).join(', '));
  }
  function paint(): void {
    const prefs = h.prefs();
    const s = h.state;
    const auto = dlg.querySelector<HTMLElement>('.msb-card[data-card=""]');
    if (auto) {
      const name = autoName();
      const label = auto.querySelector<HTMLElement>('.msb-name');
      if (label) label.textContent = name;
      auto.querySelector('.msb-main')?.setAttribute('aria-label', name);
    }
    for (const li of dlg.querySelectorAll<HTMLElement>('.msb-card[data-card]')) {
      const id = li.dataset.card ?? '';
      const { text, current } = cardState(id);
      const st = li.querySelector<HTMLElement>('.msb-state');
      if (st) st.textContent = text;
      li.classList.toggle('is-current', current);
      li.classList.toggle('is-selected', selected === id);
      li.querySelector('.msb-main')?.setAttribute('aria-pressed', String(preview?.id === id));
      if (part && id) {
        li.classList.toggle('is-blocked', isBlocked(prefs, part, id));
        li.querySelector('[data-fav]')?.setAttribute('aria-pressed', String(isFavourite(prefs, part, id)));
        li.querySelector('[data-block]')?.setAttribute('aria-pressed', String(isBlocked(prefs, part, id)));
      }
    }
    const now = q<HTMLElement>('[data-now]');
    if (now && !yoursOpen()) now.textContent = originNow();
    const title = q<HTMLElement>('[data-origin-title]');
    if (title && !yoursOpen()) title.textContent = originTitle();
    q<HTMLElement>('[data-drums-on]')?.setAttribute('aria-pressed', String(s.drums));
    const here = q<HTMLButtonElement>('[data-use="here"]');
    const all = q<HTMLButtonElement>('[data-use="everywhere"]');
    // The button for the origin leads: Use everywhere from a lane head, Use in every Chorus from a chorus.
    if (here) {
      here.hidden = wholeTrack || !section;
      here.disabled = selected === null || !section;
      here.classList.toggle('btn--primary', !wholeTrack);
      const label = here.querySelector<HTMLElement>('[data-use-here-label]');
      if (label) label.textContent = section ? tRaw('Use in every {section}', { section: sectionName(section) }) : t('Use here');
    }
    if (all) {
      all.disabled = selected === null;
      all.classList.toggle('btn--primary', wholeTrack || !part);
    }
    if (!part) paintDrumParts();
  }
  function paintDrumParts(): void {
    const title = q<HTMLElement>('[data-drum-parts-title]');
    if (title) title.textContent = section ? tRaw('In every {section}', { section: sectionName(section) }) : '';
    const bar = h.bars().find(b => b.section === section);
    const chosen = h.state.sections[section];
    for (const sel of dlg.querySelectorAll<HTMLSelectElement>('[data-drum-part]')) {
      const which = sel.dataset.drumPart === 'hats' ? 'hats' : 'snare';
      const values: readonly string[] = which === 'snare' ? LOFI_SNARES : LOFI_HATS;
      const names: Record<string, string> = which === 'snare' ? LOFI_SNARE_NAME : LOFI_HATS_NAME;
      const composed = bar ? names[bar.tune.style[which]] ?? '' : '';
      sel.replaceChildren(new Option(autoLabel(composed), ''), ...values.map(v => new Option(sentenceCase(names[v] ?? v), v, false, v === chosen?.[which])));
      sel.disabled = !section;
    }
  }
  const say = (text: string): void => { const el = q<HTMLElement>('[data-pick-line]'); if (el) el.textContent = text; };
  const pickName = (id: string): string => (id ? instrumentName(track, id) : track === 'drums' ? t('The style’s own kit') : t('The composer’s choice'));

  // ── previews ───────────────────────────────────────────────────────────────
  function stopPreview(): void {
    if (!preview) return;
    clearTimeout(preview.timer);
    preview.station.stop(0.08);
    preview = null;
    if (dlg.isConnected) paint();
  }
  function playPreview(id: string): void {
    stopPreview();
    const bars = h.bars();
    const start = bars.findIndex(b => b.section === section && plays(b, track));
    if (start < 0) { say(t('This part has no notes here to preview.')); return; }
    h.stopPlayback();
    const { ctx, dest } = h.audio();
    const s = previewState(h.state, track, id, section);
    const station = new LofiStation(ctx, dest, s.seed, trackSettings(s, start), previewMix(s.mix, track));
    const seconds = (PREVIEW_BARS * (bars[start]?.tune.beats ?? 4) * 60) / (bars[start]?.tune.bpm ?? 100);
    station.start();
    // The station starts a tenth of a second from now; fade over the last moment of the two bars.
    station.fadeOutAt(ctx.currentTime + 0.1 + seconds - 0.25, 0.25);
    preview = { station, id, timer: setTimeout(stopPreview, (seconds + 0.2) * 1000) };
    paint();
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  dlg.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const btn = target?.closest<HTMLElement>('button');
    if (!btn || !dlg.contains(btn)) return;
    if (btn.matches('[data-close]')) { leave('button'); return; }
    if (btn.matches('[data-yours]')) { showYours(true); return; }
    if (btn.matches('[data-yours-back]')) { showYours(false); return; }
    if (btn.dataset.section !== undefined) { if (btn.dataset.section) setSection(btn.dataset.section); else retarget({ wholeTrack: true }); return; }
    if (btn.matches('[data-drums-on]')) { h.setDrumsOn(!h.state.drums); paint(); return; }
    const preview_ = btn.dataset.preview;
    if (preview_ !== undefined) {
      selected = preview_;
      say(pickName(preview_));
      if (preview?.id === preview_) stopPreview(); else playPreview(preview_);
      return;
    }
    const fav = btn.dataset.fav, block = btn.dataset.block;
    if (part && (fav || block)) {
      const id = (fav ?? block)!;
      const kind: MusicPrefKind = fav ? 'favourite' : 'blocked';
      const on = btn.getAttribute('aria-pressed') !== 'true';
      const note = h.setPref(part, id, kind, on);
      const name = instrumentName(part, id);
      say(note || (kind === 'favourite'
        ? (on ? tRaw('{name} is a favourite: shuffles draw it more often.', { name }) : tRaw('{name} is no longer a favourite.', { name }))
        : (on ? tRaw('{name} is blocked: shuffles and new tunes leave it out.', { name }) : tRaw('{name} can play in shuffles again.', { name }))));
      paint();
      return;
    }
    const use = btn.dataset.use;
    if ((use === 'here' || use === 'everywhere') && selected !== null) {
      const id = selected || undefined;
      const here = use === 'here' && !!section;
      stopPreview();
      h.use(track, id, here ? section : null);
      const name = pickName(selected);
      say(track === 'drums'
        ? tRaw('{name} plays all through the track.', { name })
        : here
          ? tRaw('{name} plays in every {section}.', { name, section: sectionName(section) })
          : tRaw('{name} plays all through the track.', { name }));
      paint();
    }
  });
  dlg.addEventListener('change', (e) => {
    const sel = e.target instanceof HTMLSelectElement ? e.target : null;
    if (!sel?.dataset.drumPart || !section) return;
    h.useDrumPart(section, sel.dataset.drumPart === 'hats' ? 'hats' : 'snare', sel.value || undefined);
  });

  function setSection(sec: string): void {
    if (!sections.includes(sec)) return;
    section = sec;
    wholeTrack = false;
    stopPreview();
    paintSections();
    paint();
    h.focusChanged?.();
  }
  /** A new origin: a kind of section or every section, and the place clicked. The popup moves beside that place. */
  function retarget(to: { section?: string; wholeTrack: boolean; origin?: PopupOrigin }): void {
    if (to.section && sections.includes(to.section)) section = to.section;
    wholeTrack = to.wholeTrack || !section;
    if (to.origin) origin = to.origin;
    if (yoursOpen()) showYours(false);
    stopPreview();
    paintSections();
    paint();
    if (to.origin) place();
    h.focusChanged?.();
  }

  // ── Your instruments: every star and block, for every part ────────────────
  const yoursOpen = (): boolean => !!yours && !yours.el.hidden;
  function showYours(on: boolean): void {
    if (!part) return;
    const body = q<HTMLElement>('.msb-body');
    if (on && !yours && body) {
      yours = yourInstruments(document, {
        prefs: h.prefs,
        setPref: (p, id, kind, value) => { h.setPref(p, id, kind, value); },
        name: (p, id) => instrumentName(p, id),
        changed: () => paint(),
      });
      body.after(yours.el);
    }
    if (!yours || !body) return;
    if (on) yours.paint();
    stopPreview();
    yours.el.hidden = !on;
    body.hidden = on;
    for (const el of dlg.querySelectorAll<HTMLElement>('.msb-foot, [data-sections], [data-yours], .msb-swatch')) el.hidden = on || (el.matches('[data-sections]') && sections.length < 1);
    const back = q<HTMLElement>('[data-yours-back]');
    if (back) back.hidden = !on;
    const title = q<HTMLElement>('[data-origin-title]');
    const now = q<HTMLElement>('[data-now]');
    if (on) {
      if (title) title.textContent = t('Your instruments');
      if (now) now.textContent = t('Every instrument you starred or blocked, for every part.');
      cascade(yours.rows().slice(0, 30));
      back?.focus({ preventScroll: true });
    } else {
      paint();
      q<HTMLElement>('[data-yours]')?.focus({ preventScroll: true });
    }
  }
  function refresh(): void {
    sections = sectionsFor(h.bars(), track);
    if (!sections.includes(section)) section = sections[0] ?? '';
    paintSections();
    paint();
  }

  paintSections();
  paint();
  place();
  // The cards come in with the app's quick cascade, the first screenful of them.
  cascade([...dlg.querySelectorAll('.msb-body .msb-card, .msb-body .msb-family-title')].slice(0, 28));
  // A phone's sheet opens at the top of the list, on the composer's card, every row of
  // the first screen in full. The popup, which has the height, opens on the instrument
  // playing at its origin, scrolled into view only when it is below the fold.
  const body = q<HTMLElement>('.msb-body');
  const current = wide ? q<HTMLElement>('.msb-card.is-current:not([data-card=""])') : null;
  (current?.querySelector<HTMLElement>('.msb-main') ?? q<HTMLElement>('.msb-main'))?.focus({ preventScroll: true });
  if (body) {
    body.scrollTop = 0;
    const card = current?.getBoundingClientRect();
    const view = body.getBoundingClientRect();
    if (card && card.bottom > view.bottom) body.scrollTop = card.top - view.top - (body.clientHeight - card.height) / 2;
  }
  if (track !== 'drums' && !sections.length) say(t('This part has no notes in the track.'));

  return {
    track, setSection, retarget, refresh, stopPreview,
    focus: () => ({ track, section: wholeTrack || !section ? null : section }),
    close: (immediate) => { if (immediate) modal.close(); else leave(); },
  };
}
