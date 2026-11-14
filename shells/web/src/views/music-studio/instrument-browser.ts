// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's instrument browser (#/music): one for each pitched track (the
 * lead, the keys and the bass) and one for the drums' kits. It opens from a track's head
 * or row, or from a section in a lane: a sheet from the bottom on a phone, and a panel at
 * the side on a wider screen, where the timeline stays usable beside the panel.
 *
 * Instruments are cards grouped by family. A card plays two bars of this tune's part, in
 * the kind of section chosen at the top, on that instrument: a small station of the
 * generator's own (lib/lofi-station.ts) started at that section, with the instrument set
 * there and the other parts turned down, stopped after two bars. "Use here" sets the
 * instrument for every section of that kind, and "Use everywhere" for the whole track.
 * The star makes an instrument a favourite and the block button keeps it out of shuffles
 * and new tunes (lib/music-prefs.ts); the view keeps both on the person's profile.
 *
 * Escape and the close button close the browser and put focus back on the control that
 * opened the browser. Built on mountModal (components/modal.ts): modal on a phone, in the page
 * beside the timeline on a wider screen. The markup is written once when it opens; after
 * that only attributes and text change.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import { instrumentIcon, musicIconNode } from '../../lib/instrument-icons.ts';
import { LOFI_KEYS_NAME, LOFI_LEAD_NAME, LOFI_BASS_NAME, LOFI_SNARE_NAME, LOFI_HATS_NAME } from '../../lib/lofi-names.ts';
import { LOFI_KITS, LOFI_KIT_NAME } from '../../lib/lofi-drums.ts';
import { LofiStation, type LofiMix } from '../../lib/lofi-station.ts';
import { trackSettings, type MusicState } from '../../lib/music-state.ts';
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
}

export interface InstrumentBrowser {
  readonly track: BrowseTrack;
  /** Show and preview another kind of section. */
  setSection(section: string): void;
  /** Paint again after the track or the preferences changed. */
  refresh(): void;
  stopPreview(): void;
  close(): void;
}

/** How long a preview plays, in bars. */
const PREVIEW_BARS = 2;
/** How loud the other parts play under the one previewed. */
const UNDER = 0.3;
const DRUM_VOICES = new Set<string>(LOFI_DRUM_VOICES);
/** The browser opens as a side panel from this width, as a sheet below it (the view's breakpoint). */
const WIDE = '(min-width: 761px)';
let opened = 0;

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
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
export const instrumentName = (track: BrowseTrack, id: string): string => capital(instrumentWord(track, id));

const FAMILY_LABEL = (): Record<InstrumentFamily, string> => ({
  keys: t('Keys'), guitars: t('Guitars and strings'), bells: t('Bells and mallets'), winds: t('Winds and brass'),
  voices: t('Voices'), world: t('World'), synths: t('Synths'), chip: t('8-bit'),
});
const TRACK_TITLE = (): Record<BrowseTrack, string> => ({ lead: t('Lead instruments'), keys: t('Keys instruments'), bass: t('Bass instruments'), drums: t('Drum kits') });

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

export function openInstrumentBrowser(h: BrowserHost, track: BrowseTrack, opts: { section?: string; opener?: HTMLElement | null; onClose?: () => void } = {}): InstrumentBrowser {
  const n = ++opened;
  const part: MusicPart | null = track === 'drums' ? null : track;
  const ids: readonly string[] = part ? instrumentsOf(part) : LOFI_KITS;
  const wide = window.matchMedia(WIDE).matches;
  let sections = sectionsFor(h.bars(), track);
  let section = opts.section && sections.includes(opts.section) ? opts.section : sections[0] ?? '';
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
        <span class="msb-text"><span class="msb-name">${escapeHtml(name)}</span><span class="msb-state" id="${stateId(id)}"></span></span>
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
        <span class="msb-swatch" aria-hidden="true"></span>
        <h2 class="msb-title" id="${titleId}">${escapeHtml(TRACK_TITLE()[track])}</h2>
        ${track === 'drums' ? `<button type="button" class="msb-chip msb-drums-on" data-drums-on aria-pressed="false">${escapeHtml(t('Drums on'))}</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm msb-close" data-close aria-label="${escapeHtml(t('Close'))}" title="${escapeHtml(t('Close'))}">${icon('close', { size: 18 })}</button>
      </div>
      <p class="msb-now" data-now></p>
      <p id="msb-how-${n}" hidden>${escapeHtml(track === 'drums' ? t('Plays two bars of this tune’s drums on this kit.') : t('Plays two bars of this tune’s part on this instrument, in the section chosen above.'))}</p>
      <div class="msb-sections" role="group" aria-label="${escapeHtml(t('Hear it in'))}" data-sections></div>
    </div>
    <div class="msb-body">
      <ul class="msb-cards msb-cards--auto" role="list">${card('', track === 'drums' ? t('The style’s own kit') : t('Let the composer choose'), false)}</ul>
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
        ${track === 'drums' ? '' : `<button type="button" class="btn btn--sm" data-use="here" disabled>${escapeHtml(t('Use here'))}</button>`}
        <button type="button" class="btn btn--primary btn--sm" data-use="everywhere" disabled>${escapeHtml(track === 'drums' ? t('Use this kit') : t('Use everywhere'))}</button>
      </div>
    </div>`;

  let closedBy: 'escape' | 'button' | undefined;
  const modal: ModalHandle<'escape' | 'button'> = mountModal<'escape' | 'button'>(content, {
    className: `msb ${wide ? 'msb--panel' : 'msb--sheet'}`,
    modal: !wide,
    cancelValue: 'escape',
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
    box.replaceChildren(...sections.map(sec => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'msb-chip';
      b.dataset.section = sec;
      b.textContent = sectionName(sec);
      b.setAttribute('aria-pressed', String(sec === section));
      return b;
    }));
    box.hidden = sections.length < 2;
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
  function paint(): void {
    const prefs = h.prefs();
    const s = h.state;
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
    if (now) {
      if (!part) now.textContent = s.kit ? tRaw('Kit: {kit}', { kit: instrumentName('drums', s.kit) }) : t('Kit: the style’s own');
      else if (!section) now.textContent = t('This part has no notes in the track.');
      else now.textContent = `${sectionName(section)}: ${heardIn(h.bars(), part, section).map(id => instrumentWord(part, id)).join(', ')}`;
    }
    q<HTMLElement>('[data-drums-on]')?.setAttribute('aria-pressed', String(s.drums));
    const here = q<HTMLButtonElement>('[data-use="here"]');
    const all = q<HTMLButtonElement>('[data-use="everywhere"]');
    if (here) {
      here.disabled = selected === null || !section;
      here.setAttribute('aria-label', section ? tRaw('Use here: every {section}', { section: sectionName(section) }) : t('Use here'));
    }
    if (all) all.disabled = selected === null;
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
      sel.replaceChildren(new Option(`${t('As composed')}: ${composed}`, ''), ...values.map(v => new Option(names[v] ?? v, v, false, v === chosen?.[which])));
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
    const seconds = (PREVIEW_BARS * 240) / (bars[start]?.tune.bpm ?? 100);
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
    if (btn.matches('[data-close]')) { modal.close('button'); return; }
    if (btn.dataset.section !== undefined) { setSection(btn.dataset.section); return; }
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
    stopPreview();
    paintSections();
    paint();
  }
  function refresh(): void {
    sections = sectionsFor(h.bars(), track);
    if (!sections.includes(section)) section = sections[0] ?? '';
    paintSections();
    paint();
  }

  paintSections();
  paint();
  // A phone's sheet opens at the top of the list, on the composer's card, every row of
  // the first screen in full. The side panel, which has the height, opens on the
  // instrument playing in this section, scrolled into view only when it is below the fold.
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

  return { track, setSection, refresh, stopPreview, close: () => modal.close() };
}
