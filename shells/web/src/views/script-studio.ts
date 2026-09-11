// SPDX-License-Identifier: MPL-2.0
/**
 * Script audio (#/script) - the writing surface over on-device speech.
 *
 * The dialog (views/script-audio.ts) is a quick capture point inside the asset
 * picker and the catalog; this is the same synthesis with room to actually
 * WRITE. The script sheet is the hero: generous type, a tall page, and the
 * numbers a narrator cares about sitting quietly under it - how many words, and
 * roughly how long they take to listen to at a comfortable pace. Everything
 * mechanical (voice, speed, generate, save) lives in a side rail so the words
 * keep the widest column.
 *
 * All the plumbing is the dialog's, imported rather than re-implemented:
 * markdownToSpokenText strips structure from speech, generateSpeechAsJob runs
 * the synthesis as a background job (so a long script survives a nav away and
 * saves itself), speechProgressPainter drives the same thin progress track,
 * saveTtsClip writes the identical `user/tts/*` asset record (Gen AI pill,
 * `meta.tts` captioning block). The two surfaces cannot drift because they share
 * one recipe.
 *
 * A routed view like the Colour Lab, not an overlay: no tab, the shared back
 * pill (lib/back-nav.ts) names wherever you came from. Deep links onto a shell
 * without `host.speech` get an honest empty state, never a dead form.
 *
 * Three things live only here (plans/181 sections 2 and 4), which is why the
 * compact dialog links across rather than growing: the prosody chip bar and its
 * Tips popover, voice blending (a second voice and one weight slider, written
 * into the same `voice` string the recipe already stores), and editing a clip
 * that is already saved - `#/script?asset=<id>` prefills the recipe, and Save
 * rewrites those bytes at the same asset id so every document using the clip
 * hears the fix. Save as new clip sits beside it for a deliberate fork.
 */

import '../styles/script-audio.css';          // the shared progress track + preview row
import '../styles/parts/script-studio.css';   // this view's own layout (lazy chunk)
import {
  generateSpeechAsJob, markdownToSpokenText, saveTtsClip, rewriteTtsClip, speechProgressPainter,
  SOFT_CHAR_CAP, type ScriptAudioHost, type TtsClip,
} from './script-audio.ts';
import { spokenScriptOf, ttsRecipeFromMeta } from '../lib/tts-provenance.ts';
import { prosodyChips, prosodyTips, sayItAs, type ProsodyChip } from '../lib/prosody-chips.ts';
import { parseVoiceBlend, accentOfBlend } from '../lib/speech-kokoro.ts';
import { pcmToWavBlob } from '../lib/pcm-wav.ts';
import { audioTransportHtml, wireAudioTransport, type AudioTransport } from '../lib/audio-transport.ts';
import { fmtBytes } from '../lib/format.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { t, tRaw } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { announce } from '../a11y.ts';
import type { SpeechResult, SpeechVoiceInfo } from '@lolly-tools/core/host-v1';

/**
 * The honest listening pace: ~150 words a minute is the well-worn narration
 * average, and the label that renders this number always says it is an
 * estimate - the model's actual pace varies with the words.
 */
export const LISTEN_WPM = 150;

/** Words a voice would actually speak - counted on the SPOKEN text, so code
 *  blocks and image URLs never inflate the number. Pure, tested. */
export function countWords(spoken: string): number {
  return spoken.match(/\S+/g)?.length ?? 0;
}

/** Estimated listening seconds for `words` at LISTEN_WPM, scaled by the speed
 *  multiplier. 0 words is 0 seconds; a degenerate speed falls back to 1. */
export function estimateListenSeconds(words: number, speed = 1): number {
  const rate = speed > 0 ? speed : 1;
  return (words / (LISTEN_WPM * rate)) * 60;
}

/** The estimate as a whole sentence (translators need the sentence, not glued
 *  fragments - the pdf-extract count convention). Always says "an estimate". */
export function formatListenEstimate(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return t('About {s} sec to listen, an estimate', { s: Math.max(s, 1) });
  if (s === 0) return t('About {m} min to listen, an estimate', { m });
  return t('About {m} min {s} sec to listen, an estimate', { m, s });
}

// ── The chip bar over a plain textarea (plans/181 section 4) ─────────────────
// The transcript panel edits a contenteditable flow and owns its own caret
// work; here the script is one <textarea>, so a chip is a string edit plus a
// caret position. Both read the same chip set from lib/prosody-chips.ts.

/**
 * The word a "Say it as…" chip should wrap: the selection when there is one,
 * otherwise the run of non-space characters the caret sits in or just after.
 * Comes back empty (from === to) when there is no word to reach, which is the
 * caller's cue to do nothing rather than insert an empty mark.
 */
export function wordRangeAt(text: string, from: number, to: number): [number, number] {
  if (to > from) return [from, to];
  // Off the end of the string reads as whitespace, so a caret at the very end
  // of the script needs no special case.
  const isSpace = (i: number): boolean => /\s/.test(text[i] ?? ' ');
  let end = from;
  while (end < text.length && !isSpace(end)) end++;
  // Nothing forward means the caret sits in whitespace: reach BACK over it to
  // the word just typed, which is the word the user means.
  if (end === from) while (end > 0 && isSpace(end - 1)) end--;
  let start = end;
  while (start > 0 && !isSpace(start - 1)) start--;
  return end > start ? [start, end] : [from, from];
}

/** One chip applied to a script: the new text, and the caret's new position. */
export function applyChip(
  text: string, from: number, to: number, chip: ProsodyChip,
): { value: string; caret: number } {
  if (chip.wrapsWord) {
    const [w0, w1] = wordRangeAt(text, from, to);
    const word = text.slice(w0, w1);
    if (!word) return { value: text, caret: to };
    const mark = sayItAs(word);
    // Between the slashes, where the phonemes go: '[' + word + '](/' is
    // word.length + 4 characters.
    return { value: text.slice(0, w0) + mark + text.slice(w1), caret: w0 + word.length + 4 };
  }
  return {
    value: text.slice(0, from) + chip.insert + text.slice(to),
    caret: from + (chip.caret ?? chip.insert.length),
  };
}

// ── Voice blending (plans/181 section 4) ─────────────────────────────────────
// The rail edits two voices and one weight; the engine's grammar edits one
// string. These two functions are the whole join, and they are pure so the
// round trip (a saved recipe → the controls → a saved recipe) is testable.

/** The blend's smallest and largest share for the partner voice, as percent.
 *  A voice at 0 % is not a blend, it is the other voice with extra steps. */
export const BLEND_MIN_PCT = 5;
export const BLEND_MAX_PCT = 95;
/** Where the slider starts: a clear lead voice with a partner you can hear. */
export const BLEND_DEFAULT_PCT = 30;

/** The rail's three controls as one `voice` setting the recipe can store. */
export function blendVoiceString(primary: string, partner: string, partnerPct: number): string {
  if (!primary) return '';
  if (!partner || partner === primary) return primary;
  const pct = Number.isFinite(partnerPct) ? partnerPct : BLEND_DEFAULT_PCT;
  const w = Math.min(BLEND_MAX_PCT, Math.max(BLEND_MIN_PCT, Math.round(pct))) / 100;
  return `${primary}+${partner}:${w}`;
}

/** What the rail's three controls should read for a stored `voice` setting.
 *  An unparseable or unknown setting comes back empty rather than throwing, so
 *  a hand-typed link can never strand the view without a voice. */
export function readBlendSetting(voice: string): { primary: string; partner: string; partnerPct: number } {
  let parts;
  try { parts = parseVoiceBlend(voice); } catch { return { primary: '', partner: '', partnerPct: BLEND_DEFAULT_PCT }; }
  const [first, second] = parts;
  if (!first) return { primary: '', partner: '', partnerPct: BLEND_DEFAULT_PCT };
  if (!second) return { primary: first.id, partner: '', partnerPct: BLEND_DEFAULT_PCT };
  const pct = Math.min(BLEND_MAX_PCT, Math.max(BLEND_MIN_PCT, Math.round(second.w * 100)));
  return { primary: first.id, partner: second.id, partnerPct: pct };
}

/**
 * The accent a cross-accent blend is spoken in - the heaviest component's,
 * which is the whole policy (Andy, 2026-09-03: nothing is refused). Null when
 * the setting is one voice, or a blend whose voices already agree, because
 * there is then nothing surprising to tell anyone.
 */
export function crossAccentOf(voice: string): 'a' | 'b' | null {
  let parts;
  try { parts = parseVoiceBlend(voice); } catch { return null; }
  if (parts.length < 2) return null;
  const accents = new Set(parts.map(p => (p.id.startsWith('b') ? 'b' : 'a')));
  return accents.size > 1 ? accentOfBlend(parts) : null;
}

/**
 * One short audition line per voice, synthesized on first request and kept for
 * the session (module-level, so revisiting the view replays instantly). The
 * value is an object URL over a small WAV - a second or two of audio. Keyed by
 * the whole `voice` setting, so a blend auditions as itself rather than as its
 * lead voice.
 */
const auditionUrls = new Map<string, Promise<string>>();

export async function mountScriptStudio(viewEl: HTMLElement, host: ScriptAudioHost, params?: string): Promise<void> {
  document.title = tRaw('{name} - Lolly', { name: t('Script audio') });
  const speech = host.speech;

  // A deep link onto a shell without the speech bridge: say so, plainly.
  if (!speech?.isAvailable()) {
    viewEl.innerHTML = `
      ${backHomeHtml()}
      <div class="gallery-topright"></div>
      <div class="platform-layout scriptst-layout">
        <header class="plat-header">
          <h1 class="plat-title">${t('Script audio')}</h1>
          <div class="plat-header-text">
            <p class="plat-sub">${t('Speech generation is not available in this browser. Open Lolly in a current desktop or mobile browser to write and voice a script.')}</p>
          </div>
        </header>
      </div>`;
    mountBackPill(viewEl);
    // A deep link onto an unsupported shell is still a dead end without this - 
    // the back pill needs somewhere to have come from; Home always answers.
    mountHomeFab(viewEl);
    mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
    mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
    return;
  }

  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="platform-layout scriptst-layout">
      <header class="plat-header">
        <h1 class="plat-title">${t('Script audio')}</h1>
        <div class="plat-header-text">
          <p class="plat-sub">${t('Write a script and hear it in a natural voice, generated on this device. Save the clip to your uploads and use it anywhere audio goes.')}</p>
          <p class="scriptst-source" data-source hidden></p>
        </div>
      </header>
      <div class="scriptst-cols">
        <section class="scriptst-sheet">
          <label class="scriptst-sheet-label" for="scriptst-text">${t('Your script')}</label>
          <div class="scriptst-chips" role="group" aria-label="${escape(t('Sound marks'))}">
            ${prosodyChips().map(c => `<button type="button" class="scriptst-chip" data-chip="${escape(c.id)}"
              title="${escape(c.title)}" aria-label="${escape(c.title)}">${escape(c.label)}</button>`).join('')}
            <button type="button" class="scriptst-chip scriptst-tips-toggle" data-tips
              aria-expanded="false" aria-controls="scriptst-tips">${t('Tips')}</button>
          </div>
          <div class="scriptst-tips" id="scriptst-tips" data-tips-panel hidden>
            <ul class="scriptst-tips-list">
              ${prosodyTips().map(tip =>
                `<li><span class="scriptst-tip-text">${escape(tip.text)}</span><code class="scriptst-tip-eg">${escape(tip.example)}</code></li>`).join('')}
            </ul>
          </div>
          <textarea id="scriptst-text" class="field-input scriptst-text" spellcheck="true"
            placeholder="${escape(t('Type or paste the words to speak. Markdown is fine, only the words are read.'))}"></textarea>
          <p class="scriptst-meter" data-meter aria-live="polite"></p>
        </section>
        <aside class="scriptst-rail" aria-label="${escape(t('Voice and export'))}">
          <label class="scriptst-field">
            <span>${t('Voice')}</span>
            <select class="field-select" data-voice disabled><option>${t('Loading…')}</option></select>
          </label>
          <label class="scriptst-field">
            <span>${t('Blend with')}</span>
            <select class="field-select" data-blend disabled><option value="">${t('No second voice')}</option></select>
          </label>
          <div class="scriptst-mix" data-mix hidden>
            <label class="scriptst-field">
              <span data-mix-label></span>
              <input type="range" class="scriptst-slider" data-mix-weight
                min="${BLEND_MIN_PCT}" max="${BLEND_MAX_PCT}" step="5" value="${BLEND_DEFAULT_PCT}"
                aria-label="${escape(t('How much of the second voice'))}">
            </label>
            <p class="scriptst-accent" data-accent hidden></p>
          </div>
          <button type="button" class="btn scriptst-audition" data-audition disabled>
            <span class="scriptst-audition-icon" aria-hidden="true">${icon('play')}</span>${t('Hear this voice')}
          </button>
          <label class="scriptst-field">
            <span>${t('Speed')}</span>
            <select class="field-select" data-speed>
              <option value="0.8">${t('Slower (0.8×)')}</option>
              <option value="1" selected>${t('Normal')}</option>
              <option value="1.2">${t('Faster (1.2×)')}</option>
            </select>
          </label>
          <p class="scriptst-consent" data-consent hidden></p>
          <button type="button" class="btn btn--primary scriptst-generate" data-generate>${t('Generate speech')}</button>
          <p class="scriptst-kbd" data-kbd></p>
          <div class="script-audio-progress" data-progress role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${escape(t('Generating speech'))}" hidden>
            <div class="script-audio-progress-fill" data-progress-fill></div>
          </div>
          <p class="scriptst-status" data-status aria-live="polite" hidden></p>
          <div class="script-audio-preview scriptst-preview" data-preview hidden></div>
          <button type="button" class="btn btn--primary scriptst-save" data-save hidden>${t('Save to your uploads')}</button>
          <button type="button" class="btn scriptst-save-new" data-save-new hidden>${t('Save as new clip')}</button>
          <p class="scriptst-saved" data-saved hidden></p>
        </aside>
      </div>
    </div>`;
  armViewEnter(viewEl, '.plat-header, .scriptst-sheet, .scriptst-rail');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  const textarea    = viewEl.querySelector<HTMLTextAreaElement>('.scriptst-text')!;
  const meterEl     = viewEl.querySelector<HTMLElement>('[data-meter]')!;
  const voiceSel    = viewEl.querySelector<HTMLSelectElement>('[data-voice]')!;
  const blendSel    = viewEl.querySelector<HTMLSelectElement>('[data-blend]')!;
  const mixEl       = viewEl.querySelector<HTMLElement>('[data-mix]')!;
  const mixLabelEl  = viewEl.querySelector<HTMLElement>('[data-mix-label]')!;
  const mixRange    = viewEl.querySelector<HTMLInputElement>('[data-mix-weight]')!;
  const accentEl    = viewEl.querySelector<HTMLElement>('[data-accent]')!;
  const sourceEl    = viewEl.querySelector<HTMLElement>('[data-source]')!;
  const speedSel    = viewEl.querySelector<HTMLSelectElement>('[data-speed]')!;
  const auditionBtn = viewEl.querySelector<HTMLButtonElement>('[data-audition]')!;
  const consentEl   = viewEl.querySelector<HTMLElement>('[data-consent]')!;
  const kbdEl       = viewEl.querySelector<HTMLElement>('[data-kbd]')!;
  const progressEl  = viewEl.querySelector<HTMLElement>('[data-progress]')!;
  const fillEl      = viewEl.querySelector<HTMLElement>('[data-progress-fill]')!;
  const statusEl    = viewEl.querySelector<HTMLElement>('[data-status]')!;
  const previewEl   = viewEl.querySelector<HTMLElement>('[data-preview]')!;
  const generateBtn = viewEl.querySelector<HTMLButtonElement>('[data-generate]')!;
  const saveBtn     = viewEl.querySelector<HTMLButtonElement>('[data-save]')!;
  const saveNewBtn  = viewEl.querySelector<HTMLButtonElement>('[data-save-new]')!;
  const savedEl     = viewEl.querySelector<HTMLElement>('[data-saved]')!;

  // The generate shortcut, named in the platform's own words (textContent - no
  // markup, so no sink).
  const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
  kbdEl.textContent = tRaw('{keys} generates', { keys: isMac ? '⌘ Enter' : 'Ctrl Enter' });

  let transport: AudioTransport | null = null;
  let previewUrl: string | null = null;
  // The last generated clip + the exact inputs that produced it (Save stores
  // these, not the live form - the dialog's discipline).
  let result: SpeechResult | null = null;
  let wavBlob: Blob | null = null;
  let spokenText = '';
  let usedVoice = '';
  let usedSpeed = 1;
  // One shared element for voice auditions, replaced per play.
  let auditionAudio: HTMLAudioElement | null = null;
  // The clip this session is editing, when the view was opened from one
  // (#/script?asset=<id>). Save then rewrites THOSE bytes; Save as new clip
  // mints a fresh id. Null for a blank sheet, and it never changes afterwards -
  // a fork stays a fork.
  let source: { id: string; name: string } | null = null;
  // Every voice the bridge offered, kept for the blend select's own list and
  // for naming a voice in the mix label.
  let voiceList: SpeechVoiceInfo[] = [];

  const showStatus = (msg: string, isError = false): void => {
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.classList.toggle('scriptst-status-error', isError);
  };
  const hideStatus = (): void => { statusEl.hidden = true; statusEl.classList.remove('scriptst-status-error'); };

  // ── The margin note: words and listening time, live ────────────────────────
  const paintMeter = (): void => {
    const spoken = markdownToSpokenText(textarea.value);
    const words = countWords(spoken);
    if (words === 0) {
      meterEl.textContent = t('Start writing and the listening time appears here.');
      meterEl.classList.remove('scriptst-meter-over');
      return;
    }
    const count = words === 1 ? t('1 word') : t('{n} words', { n: words });
    const estimate = formatListenEstimate(estimateListenSeconds(words, Number(speedSel.value) || 1));
    const over = textarea.value.length > SOFT_CHAR_CAP;
    meterEl.textContent = over
      ? `${count} · ${estimate} · ${t('Long scripts take a while to generate.')}`
      : `${count} · ${estimate}`;
    meterEl.classList.toggle('scriptst-meter-over', over);
  };
  paintMeter();

  // ── The chip bar: marks typed for you, at the caret ────────────────────────
  const chipsEl = viewEl.querySelector<HTMLElement>('.scriptst-chips')!;
  const tipsBtn = viewEl.querySelector<HTMLButtonElement>('[data-tips]')!;
  const tipsEl  = viewEl.querySelector<HTMLElement>('[data-tips-panel]')!;
  const chipById = new Map(prosodyChips().map(c => [c.id, c]));

  // Pressing a chip must not take the caret out of the script: preventDefault
  // on mousedown keeps focus (and the selection) exactly where it was, and the
  // work happens on click so the keyboard path is identical.
  chipsEl.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement | null)?.closest('[data-chip]')) e.preventDefault();
  });
  chipsEl.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-chip]')?.dataset.chip;
    const chip = id ? chipById.get(id) : undefined;
    if (!chip) return;
    const from = textarea.selectionStart ?? textarea.value.length;
    const to = textarea.selectionEnd ?? from;
    const next = applyChip(textarea.value, from, to, chip);
    if (next.value === textarea.value) { textarea.focus(); return; }
    textarea.value = next.value;
    textarea.focus();
    textarea.setSelectionRange(next.caret, next.caret);
    // The script changed, so the same two things happen as for a keystroke.
    paintMeter();
    dropPreview();
  });

  const closeTips = (): void => {
    tipsEl.hidden = true;
    tipsBtn.setAttribute('aria-expanded', 'false');
  };
  tipsBtn.addEventListener('click', () => {
    const open = tipsEl.hidden;
    tipsEl.hidden = !open;
    tipsBtn.setAttribute('aria-expanded', String(open));
  });
  // Escape closes it, and so does a click anywhere else - the house rules for
  // an overlay that is not modal.
  const onTipsKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !tipsEl.hidden) { e.preventDefault(); closeTips(); tipsBtn.focus(); }
  };
  const onTipsOutside = (e: MouseEvent): void => {
    const el = e.target as HTMLElement | null;
    if (!tipsEl.hidden && !tipsEl.contains(el) && !tipsBtn.contains(el)) closeTips();
  };
  viewEl.addEventListener('keydown', onTipsKey);
  document.addEventListener('click', onTipsOutside);

  // ── The voice setting: two selects and a slider, one string ────────────────
  /** A voice's own name, or the id when the list has not arrived yet. */
  const voiceName = (id: string): string => voiceList.find(v => v.id === id)?.name ?? id;
  /** What Generate, Save and the audition all read - never the selects directly. */
  const voiceSetting = (): string =>
    blendVoiceString(voiceSel.value, blendSel.value, Number(mixRange.value));

  const paintBlend = (): void => {
    const partner = blendSel.value;
    mixEl.hidden = !partner || partner === voiceSel.value;
    if (mixEl.hidden) { accentEl.hidden = true; return; }
    const pct = Math.round(Number(mixRange.value));
    // Both shares, lead voice first, so the slider reads as a mix rather than
    // as "how much of the other one".
    mixLabelEl.textContent = tRaw('{lead} {leadPct}% · {partner} {partnerPct}%', {
      lead: voiceName(voiceSel.value), leadPct: 100 - pct,
      partner: voiceName(partner), partnerPct: pct,
    });
    // The slider's own aria-label names the control, so it wins over the
    // wrapping label's text and a screen reader would otherwise announce a
    // bare "55" - 55 of what, against which lead voice, never said. The mix
    // both shares, as sighted users read it, goes in as the value text.
    mixRange.setAttribute('aria-valuetext', mixLabelEl.textContent);
    const accent = crossAccentOf(voiceSetting());
    accentEl.hidden = !accent;
    accentEl.textContent = accent === 'b'
      ? t('Spoken with a British accent, from the heavier voice.')
      : accent === 'a' ? t('Spoken with an American accent, from the heavier voice.') : '';
  };

  // An edit to the script, voice or speed makes the preview stale - drop it so
  // Save can only ever store what the listener just heard.
  const dropPreview = (): void => {
    if (!result) return;
    result = null; wavBlob = null;
    transport?.destroy(); transport = null;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    previewEl.hidden = true; previewEl.innerHTML = '';
    saveBtn.hidden = true;
    saveNewBtn.hidden = true;
    savedEl.hidden = true; savedEl.innerHTML = '';
    generateBtn.textContent = t('Generate speech');
  };
  textarea.addEventListener('input', () => { paintMeter(); dropPreview(); });
  voiceSel.addEventListener('change', () => { paintBlend(); dropPreview(); });
  blendSel.addEventListener('change', () => { paintBlend(); dropPreview(); });
  // input, not change: the mix label has to follow the thumb, and a preview of
  // the old mix is stale the moment the slider moves.
  mixRange.addEventListener('input', () => { paintBlend(); dropPreview(); });
  speedSel.addEventListener('change', () => { paintMeter(); dropPreview(); });

  // Voices load async; audition stays disabled until they arrive. The blend
  // select offers the SAME list plus a "none" first option - a blend is a
  // setting, not a voice, so voices() never lists one (host-v1 contract).
  const voicesReady = speech.voices().then((voices) => {
    if (!viewEl.isConnected) return;
    voiceList = voices;
    voiceSel.innerHTML = voices.map(v =>
      `<option value="${escape(v.id)}">${escape(v.name)} (${escape(v.lang)})</option>`).join('');
    // The blend select is built as DOM rather than markup: it needs an extra
    // first option, and a second raw-HTML sink here would be a second place to
    // get escaping right for no gain.
    const option = (value: string, label: string): HTMLOptionElement => {
      const el = document.createElement('option');
      el.value = value;
      el.textContent = label;
      return el;
    };
    blendSel.replaceChildren(
      option('', t('No second voice')),
      ...voices.map(v => option(v.id, tRaw('{name} ({lang})', { name: v.name, lang: v.lang }))),
    );
    voiceSel.disabled = voices.length === 0;
    blendSel.disabled = voices.length === 0;
    auditionBtn.disabled = voices.length === 0;
    paintBlend();
  }).catch(() => {
    if (viewEl.isConnected) showStatus(t("Couldn't load the voice list."), true);
  });

  // First use: say what is about to happen BEFORE any bytes move.
  void speech.cached().then((cached) => {
    if (cached || !viewEl.isConnected) return;
    consentEl.hidden = false;
    consentEl.textContent = t('The first run downloads a {size} voice model once. It runs on-device and your script is never uploaded.', { size: fmtBytes(speech.modelBytes()) });
  }).catch(() => { /* unknown cache state → skip the consent line, never block */ });

  const paintProgress = speechProgressPainter(progressEl, fillEl, (phase) => {
    showStatus(phase === 'download' ? t('Downloading the voice model…') : t('Generating speech…'));
  });

  // ── One-click voice audition, cached per SETTING per session ───────────────
  // The key is the whole voice string, so 'af_heart' and 'af_heart+bf_lily:0.3'
  // are two different auditions and moving the slider gives a new one.
  const auditionUrlFor = (setting: string, spokenName: string): Promise<string> => {
    let p = auditionUrls.get(setting);
    if (!p) {
      p = speech.synthesize(tRaw("Hi, I'm {name}", { name: spokenName }), {
        voice: setting || undefined,
        onProgress: paintProgress,
      }).then((res) =>
        URL.createObjectURL(pcmToWavBlob({ left: res.pcm, right: res.pcm, sampleRate: res.sampleRate })));
      p.catch(() => auditionUrls.delete(setting)); // a failed audition retries next click
      auditionUrls.set(setting, p);
    }
    return p;
  };
  auditionBtn.addEventListener('click', async () => {
    const setting = voiceSetting();
    // A blend has no name of its own, so it introduces itself with the lead
    // voice's - the one whose accent it speaks in.
    const spokenName = voiceSel.selectedOptions[0]?.textContent?.replace(/\s*\(.*\)$/, '') || voiceSel.value;
    auditionBtn.disabled = true;
    try {
      const url = await auditionUrlFor(setting, spokenName);
      if (!viewEl.isConnected) return;
      hideStatus();
      auditionAudio?.pause();
      auditionAudio = new Audio(url);
      void auditionAudio.play();
    } catch (e) {
      if (!viewEl.isConnected) return;
      host.log('error', 'Voice audition failed', { error: String(e) });
      showStatus(t("Couldn't play the voice sample. Try again."), true);
    } finally {
      if (viewEl.isConnected) { auditionBtn.disabled = false; progressEl.hidden = true; }
    }
  });

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = async (): Promise<void> => {
    const spoken = markdownToSpokenText(textarea.value);
    if (!spoken) { showStatus(t('Type something to speak first.'), true); return; }
    dropPreview();
    hideStatus();
    generateBtn.disabled = true;
    try {
      const clip = await generateSpeechAsJob(host, {
        spokenText: spoken, voice: voiceSetting(), speed: Number(speedSel.value) || 1,
      }, {
        alive: () => viewEl.isConnected,
        onProgress: paintProgress,
        onQueued: () => showStatus(t('Waiting for other work to finish…')),
      });
      // No clip to paint: cancelled from the toast, or the view was replaced and
      // the take was saved to Your uploads without us. Never touch the DOM that
      // has since been swapped out.
      if (!clip || !viewEl.isConnected) return;
      result = clip.result;
      wavBlob = clip.wavBlob;
      spokenText = clip.spokenText;
      usedVoice = clip.voice;
      usedSpeed = clip.speed;
      previewUrl = URL.createObjectURL(wavBlob);
      previewEl.hidden = false;
      previewEl.innerHTML = audioTransportHtml({
        play: t('Play'), pause: t('Pause'), seek: t('Seek'),
        mute: t('Mute'), unmute: t('Unmute'), volume: t('Volume'),
      });
      const audioEl = document.createElement('audio');
      audioEl.src = previewUrl;
      audioEl.preload = 'metadata';
      previewEl.appendChild(audioEl);
      transport = wireAudioTransport(previewEl, audioEl);
      consentEl.hidden = true;   // the download (if any) has happened now
      hideStatus();
      saveBtn.hidden = false;
      // Editing a saved clip: Save rewrites it, and the fork is one click away.
      saveNewBtn.hidden = !source;
      generateBtn.textContent = t('Regenerate');
      saveBtn.focus();
    } catch (e) {
      if (!viewEl.isConnected) return;
      if ((e as Error | null)?.name !== 'AbortError') {
        host.log('error', 'Speech synthesis failed', { error: String(e) });
        showStatus(t("Couldn't generate the audio. Try again."), true);
      }
    } finally {
      if (viewEl.isConnected) { generateBtn.disabled = false; progressEl.hidden = true; }
    }
  };
  generateBtn.addEventListener('click', () => void generate());

  // Keyboard-first: Cmd/Ctrl+Enter generates from anywhere in the view.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !generateBtn.disabled) {
      e.preventDefault();
      void generate();
    }
  };
  viewEl.addEventListener('keydown', onKey);

  // ── Save, then say where it went ───────────────────────────────────────────
  // Two destinations, one path: 'new' mints a fresh `user/tts/*` id, 'rewrite'
  // replaces the bytes of the clip this view was opened on (plans/181 section
  // 5.2). The asset id is the contract - a rewrite re-points no timeline box
  // and breaks no link, so every document already using the clip hears the fix.
  const store = async (mode: 'new' | 'rewrite'): Promise<void> => {
    if (!result || !wavBlob) return;
    saveBtn.disabled = true;
    saveNewBtn.disabled = true;
    const clip: TtsClip = { result, wavBlob, spokenText, voice: usedVoice, speed: usedSpeed };
    try {
      const rewriting = mode === 'rewrite' && !!source;
      const ref = rewriting
        ? await rewriteTtsClip(host, source!.id, clip, { name: source!.name })
        : await saveTtsClip(host, clip);
      if (!viewEl.isConnected) return;
      saveBtn.hidden = true;
      saveNewBtn.hidden = true;
      savedEl.hidden = false;
      // The one interpolation is the asset id, URI- and attribute-escaped; the
      // link lands on the catalogue with the uploads section open and the clip
      // highlighted.
      const where = rewriting ? t('This clip has been updated everywhere it is used.') : t('Saved to your uploads.');
      savedEl.innerHTML = `${escape(where)} <a href="#/c?section=your-uploads&asset=${escape(encodeURIComponent(ref?.id ?? ''))}">${escape(t('View it in the Catalogue'))}</a>`;
      announce(where);
    } catch (e) {
      if (!viewEl.isConnected) return;
      host.log('error', 'Script audio store failed', { error: String(e) });
      // Quota errors carry a user-ready message (code set); prefix only the rest.
      showStatus((e as { code?: unknown }).code
        ? (e as Error).message
        : tRaw("Couldn't save the audio: {message}", { message: (e as Error).message }), true);
    } finally {
      if (viewEl.isConnected) { saveBtn.disabled = false; saveNewBtn.disabled = false; }
    }
  };
  saveBtn.addEventListener('click', () => void store(source ? 'rewrite' : 'new'));
  saveNewBtn.addEventListener('click', () => void store('new'));

  // ── Opened on a saved clip: #/script?asset=<id> ────────────────────────────
  // The recipe IS the prefill (lib/tts-provenance.ts reads the same block the
  // credential was signed from), so what loads here is what the model read.
  // Anything that is not a Lolly-generated clip - a recording, an upload, a
  // deleted id - quietly leaves a blank sheet rather than a broken one.
  const prefillFrom = async (assetId: string): Promise<void> => {
    const ref = await host.assets.get(assetId);
    const recipe = ref ? ttsRecipeFromMeta(ref.meta as Record<string, unknown> | undefined) : null;
    if (!recipe || !viewEl.isConnected) return;
    await voicesReady;
    if (!viewEl.isConnected) return;
    // The words the voice actually read, which is the marks-bearing script
    // once a regeneration has written one - the same reading the created
    // action records (lib/tts-provenance.ts). A clip regenerated from the
    // transcript panel keeps its prose in `text`, so prefilling from that
    // would show the words BEFORE the edit, and Save, which rewrites this clip
    // in place, would re-speak them and destroy the fix everywhere it is used.
    const prefill = spokenScriptOf(recipe);
    textarea.value = prefill;
    // Setting .value parks the caret at 0; a writer wants it after the words.
    textarea.setSelectionRange(prefill.length, prefill.length);
    const blend = readBlendSetting(recipe.voice);
    if (blend.primary && voiceList.some(v => v.id === blend.primary)) voiceSel.value = blend.primary;
    if (blend.partner && voiceList.some(v => v.id === blend.partner)) {
      blendSel.value = blend.partner;
      mixRange.value = String(blend.partnerPct);
    }
    // A stored speed the three preset options do not carry (a `[speed]` era
    // recipe, or a future preset) gets an option of its own rather than being
    // silently rounded to Normal.
    const speed = String(recipe.speed);
    if (![...speedSel.options].some(o => o.value === speed)) {
      const opt = document.createElement('option');
      opt.value = speed;
      opt.textContent = tRaw('{n}× speed', { n: speed });
      speedSel.appendChild(opt);
    }
    speedSel.value = speed;
    paintBlend();
    paintMeter();
    const name = String(ref?.meta?.name ?? assetId);
    // Rewriting in place needs the bridge method; without it this is still a
    // useful prefill, it just saves as a new clip like any other take.
    if (host.assets._replaceUserAssetBytes) {
      source = { id: assetId, name };
      saveBtn.textContent = t('Save changes to this clip');
    }
    sourceEl.hidden = false;
    sourceEl.textContent = source
      ? tRaw('Editing “{name}”. Saving replaces this clip wherever it is used.', { name })
      : tRaw('Started from “{name}”. Saving makes a new clip.', { name });
  };
  const assetParam = new URLSearchParams(params ?? '').get('asset');
  if (assetParam) {
    void prefillFrom(assetParam).catch((e) => {
      host.log('error', 'Script audio prefill failed', { id: assetParam, error: String(e) });
    });
  }

  textarea.focus();

  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    // Deliberately does NOT abort an in-flight generation: it is a background
    // job now, so leaving the view keeps it running and the clip lands in Your
    // uploads on its own. The job's own ✕ in the global toast is the cancel.
    transport?.destroy();
    transport = null;
    auditionAudio?.pause();
    auditionAudio = null;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    viewEl.removeEventListener('keydown', onKey);
    viewEl.removeEventListener('keydown', onTipsKey);
    // The one listener that outlives the view element, so the one that has to
    // be taken off by hand.
    document.removeEventListener('click', onTipsOutside);
  };
}
