// SPDX-License-Identifier: MPL-2.0
/**
 * The Sound room's markup (rooms/sound.ts owns the state and the wiring).
 *
 * Simple first, depth on demand. The room opens on its starting sounds: a card for each,
 * on the genre's own colours, with a play button and Choose. Once a sound is chosen the
 * uses appear as chips, each with its own play button, and the use picked shows its
 * purpose, its music in plain words and the way to the music generator. The voice, the
 * notes and signature, and the brand's character and listening review each fold away in
 * a section card. Every value written here goes through escape(); the rest is translated
 * copy and the fixed icon registry.
 */
import type { SpeechVoiceInfo } from '@lolly-tools/core/host-v1';
import type { SonicContextV1, SonicProfileV1 } from '@lolly-tools/core/sonic-profile-v1';
import { pillSliderHtml } from '../../../components/pill-slider.ts';
import { t, tRaw } from '../../../i18n.ts';
import { escape as e } from '../../../utils.ts';
import { genreIconSvg, shuffleIconSvg } from '../../genre-icons.ts';
import { icon } from '../../icons.ts';
import { segHtml } from '../../seg.ts';
import { directionCopy, SONIC_DIRECTIONS, soundSummary } from '../../sonic-music.ts';

/** Everything the room shows, as rooms/sound.ts holds the state. */
export interface SoundViewModel {
  label: string;
  profile: SonicProfileV1;
  contextId: string;
  picked: boolean;
  saved: boolean;
  dirty: boolean;
  readonly: boolean;
  /** Whether this shell can speak. */
  speech: boolean;
  chosen: string | null;
  voices: SpeechVoiceInfo[];
  audio: Array<{ id: string; name: string }>;
  withVoice: boolean;
  sample: string;
  renaming: boolean;
  reviewing: boolean;
  open: ReadonlySet<string>;
  /** The settings a use plays now (its own, or with the tune drawn by Another tune). */
  playing(context: SonicContextV1): string;
}

/** The pill sliders' readouts. */
export const speedText = (v: number): string => `${v.toFixed(2)}×`;
export const percentText = (v: number): string => `${Math.round(v * 100)}%`;

/** The words the room says about its save state, beside its title. */
export function saveStateText(m: Pick<SoundViewModel, 'saved' | 'dirty' | 'picked' | 'readonly'>): string {
  if (m.readonly) return '';
  if (m.dirty) return m.saved ? t('Unsaved changes') : t('Not saved yet');
  return m.saved ? t('Saved') : '';
}

const playButton = (key: string, name: string, large = false): string =>
  `<button type="button" class="sound-play${large ? ' sound-play--lg' : ''}" data-play="${e(key)}" aria-pressed="false" aria-label="${e(tRaw('Play {name}', { name }))}" title="${e(t('Play or stop'))}">`
  + `<span class="sound-play-icon sound-play-icon--play" aria-hidden="true">${icon('play', { size: large ? 22 : 16, filled: true })}</span>`
  + `<span class="sound-play-icon sound-play-icon--stop" aria-hidden="true">${icon('pause', { size: large ? 22 : 16, filled: true })}</span>`
  + '</button>';

/** Set while the room paints a read-only design system: its fields show, and none edit. */
let fieldsReadonly = false;
/** A small button: its icon, then its label in a span the stylesheet trims to the ink. */
const btn = (attrs: string, label: string, opts: { kind?: 'primary' | 'ghost'; glyph?: string; cls?: string } = {}): string =>
  `<button type="button" class="btn btn--sm${opts.kind ? ` btn--${opts.kind}` : ''} sound-btn${opts.cls ? ` ${opts.cls}` : ''}" ${attrs}>${opts.glyph ?? ''}<span class="sound-btn-label">${e(label)}</span></button>`;

const field = (path: string, label: string, value: string, hint = '', rows = 2): string =>
  `<label class="sound-field"><span class="sound-field-label">${e(label)}</span><textarea class="field-input" data-field="${path}" rows="${rows}" maxlength="4000"${fieldsReadonly ? ' readonly' : ''}>${e(value)}</textarea>${hint ? `<small class="sound-hint">${e(hint)}</small>` : ''}</label>`;

/** A section card that folds away. `level`: its heading's place under the room's own (h3 beside the sections, h5 inside a use). */
const fold = (id: string, title: string, iconName: Parameters<typeof icon>[0], value: string, body: string, open: ReadonlySet<string>, level: 3 | 5 = 5): string =>
  `<details class="section-card sound-fold" data-fold="${id}"${open.has(id) ? ' open' : ''}>`
  + `<summary class="section-card-summary"><span class="section-card-icon" aria-hidden="true">${icon(iconName, { size: 18 })}</span><h${level} class="section-card-title">${e(title)}</h${level}>${value ? `<span class="section-card-value">${e(value)}</span>` : ''}</summary>`
  + `<div class="section-card-body sound-fold-body">${body}</div></details>`;

function directionsHtml(m: SoundViewModel): string {
  const cards = SONIC_DIRECTIONS.map((dir) => {
    const { name, line } = directionCopy(dir);
    const chosen = m.chosen === dir.id;
    return `<article class="sound-card${chosen ? ' is-chosen' : ''}" data-direction="${e(dir.id)}" data-mood="${e(dir.mood)}">`
      + `<div class="sound-card-top"><span class="sound-card-icon" aria-hidden="true">${genreIconSvg(dir.mood, 22)}</span>`
      + (chosen ? `<span class="sound-card-badge">${icon('check', { size: 14 })}<span>${t('Chosen')}</span></span>` : '')
      + '</div>'
      + `<h4 class="sound-card-name">${e(name)}</h4><p class="sound-card-line">${e(line)}</p><p class="sound-card-meta">${e(soundSummary(dir.parameters))}</p>`
      + `<div class="sound-card-actions">${playButton(`dir:${dir.id}`, name, true)}`
      + (m.readonly || chosen ? '' : btn(`data-choose="${e(dir.id)}"`, t('Choose'), { cls: 'sound-choose' }))
      + '</div></article>';
  }).join('');
  return `<section class="sound-section" aria-labelledby="sound-start-title"><div class="sound-section-head"><h3 class="sound-section-title" id="sound-start-title">${m.picked ? t('Your sound') : t('Pick a starting sound')}</h3>`
    + (m.picked ? '' : `<p class="sound-hint">${t('Listen, then choose one. You can change it at any time.')}</p>`)
    + `</div><div class="sound-cards">${cards}</div></section>`;
}

function chipsHtml(m: SoundViewModel): string {
  const chips = m.profile.contexts.map((c) => {
    const selected = c.id === m.contextId;
    const main = c.id === m.profile.defaultContext;
    return `<li class="sound-chip${selected ? ' is-selected' : ''}">${playButton(`use:${c.id}`, c.label)}`
      + `<button type="button" class="sound-chip-name" data-select="${e(c.id)}" aria-pressed="${selected}"${c.purpose ? ` title="${e(c.purpose)}"` : ''}><span class="sound-chip-label">${e(c.label)}</span>${main ? `<span class="sound-chip-main">${t('Main')}</span>` : ''}</button></li>`;
  }).join('');
  return `<ul class="sound-chips" aria-label="${e(t('Uses'))}">${chips}${m.readonly ? '' : `<li>${btn('data-add-use', t('Add a use'), { kind: 'ghost', glyph: icon('plus', { size: 16 }), cls: 'sound-add' })}</li>`}</ul>`;
}

function voiceHtml(m: SoundViewModel, c: SonicContextV1): string {
  const n = c.narration;
  const options = [`<option value="">${t('Choose a voice')}</option>`, ...m.voices.map((v) => `<option value="${e(v.id)}"${v.id === n.voice ? ' selected' : ''}>${e(`${v.name} (${v.lang})`)}</option>`)];
  if (n.voice && !m.voices.some((v) => v.id === n.voice)) options.push(`<option value="${e(n.voice)}" selected>${e(n.voice)}</option>`);
  const named = m.voices.find((v) => v.id === n.voice)?.name ?? n.voice;
  const value = named ? `${named} · ${speedText(n.speed)}` : t('No voice yet');
  const ro = m.readonly ? ' disabled' : '';
  const body = (m.speech ? '' : `<p class="sound-hint">${t('Speech is not available here. You can still listen to the music.')}</p>`)
    + `<div class="sound-grid"><label class="sound-field"><span class="sound-field-label">${t('Voice')}</span><select class="field-select" data-field="narration.voice"${ro}>${options.join('')}</select></label>`
    + `<div class="sound-sliders">${pillSliderHtml({ label: t('Speaking speed'), min: 0.5, max: 2, step: 0.05, value: n.speed, format: speedText, attrs: `data-field="narration.speed"${ro}` })}`
    + `${pillSliderHtml({ label: t('Music under the voice'), min: 0, max: 1, step: 0.05, value: n.bedVolume, format: percentText, attrs: `data-field="narration.bedVolume"${ro}` })}</div></div>`
    + `<div class="sound-row">${playButton(`voice:${c.id}`, t('the voice with the music'))}<span class="sound-row-label">${t('Hear the voice with the music')}</span></div>`
    + `<details class="sound-more" data-fold="more"${m.open.has('more') ? ' open' : ''}><summary>${t('More')}</summary><div class="sound-more-body">`
    + `${pillSliderHtml({ label: t('Dip while speaking'), min: 0, max: 1, step: 0.05, value: n.duck, format: percentText, attrs: `data-field="narration.duck"${ro}` })}`
    + `<label class="sound-field"><span class="sound-field-label">${t('Words to try')}</span><textarea class="field-input" data-sample rows="2" maxlength="600"${ro}>${e(m.sample)}</textarea><small class="sound-hint">${t('These words stay in this room.')}</small></label>`
    + field('pronunciations', t('Pronunciation'), n.pronunciations.map((p) => `${p.written} = ${p.spoken}`).join('\n'), t('One per line: written = spoken, for example Lolly = Lol-ee.'))
    + field('narration.guidance', t('Notes on the voice'), n.guidance)
    + '</div></details>';
  return fold('voice', t('Voice'), 'mic', value, body, m.open);
}

function notesHtml(m: SoundViewModel, c: SonicContextV1): string {
  const options = [`<option value="">${t('None')}</option>`, ...m.audio.map((a) => `<option value="${e(a.id)}"${a.id === c.signature.resource?.id ? ' selected' : ''}>${e(a.name)}</option>`)];
  if (c.signature.resource && !m.audio.some((a) => a.id === c.signature.resource?.id)) options.push(`<option value="${e(c.signature.resource.id)}" selected>${t('A file not on this device')}</option>`);
  const ro = m.readonly ? ' disabled' : '';
  const body = field('context.guidance', t('What to listen for'), c.guidance, '', 4)
    + `<div class="sound-grid"><label class="sound-field"><span class="sound-field-label">${t('Sound signature')}</span><select class="field-select" data-field="signature.resource"${ro}>${options.join('')}</select><small class="sound-hint">${t('A fixed opening or ending, as its own audio file. Place it in your sequence.')}</small></label>`
    + (c.signature.resource ? `<div class="sound-row">${playButton(`sig:${c.id}`, t('the signature'))}<span class="sound-row-label">${t('Hear the signature')}</span></div>` : '')
    + '</div>'
    + field('signature.guidance', t('How to use the signature'), c.signature.guidance)
    + (c.examples.length ? `<ul class="sound-list">${c.examples.map((x) => `<li><strong>${e(x.label)}</strong> ${e(x.note)}</li>`).join('')}</ul>` : '')
    + (c.requirements.length ? `<ul class="sound-list">${c.requirements.map((r) => `<li>${e(r.label)} <span class="chip">${e(r.requirement === 'required' ? t('Required') : t('Advice'))}</span></li>`).join('')}</ul><p class="sound-hint">${t('A required check this build cannot make stops new music for this use.')}</p>` : '');
  return fold('notes', t('Notes and signature'), 'document', c.signature.resource ? t('Signature set') : '', body, m.open);
}

function useHtml(m: SoundViewModel): string {
  const c = m.profile.contexts.find((x) => x.id === m.contextId)!;
  const main = c.id === m.profile.defaultContext;
  const head = m.renaming
    ? `<div class="sound-rename" data-rename-form><label class="sound-field"><span class="sound-field-label">${t('Name')}</span><input class="field-input" data-field="context.label" maxlength="80" value="${e(c.label)}"></label>`
      + `<label class="sound-field"><span class="sound-field-label">${t('What it is for')}</span><input class="field-input" data-field="context.purpose" maxlength="300" value="${e(c.purpose)}"></label>`
      + `${btn('data-rename-done', t('Done'))}</div>`
    : `<div class="sound-use-head"><div class="sound-use-text"><h4 class="sound-use-name">${e(c.label)}</h4>${c.purpose ? `<p class="sound-use-purpose">${e(c.purpose)}</p>` : ''}</div>`
      + (m.readonly ? '' : btn('data-rename', t('Rename'), { kind: 'ghost', glyph: icon('pen', { size: 16 }) }))
      + '</div>';
  const actions = m.readonly ? '' : `<div class="sound-use-actions">`
    + btn('data-edit-music', t('Edit in the music generator'), { kind: 'primary', glyph: icon('sliders', { size: 16 }) })
    + btn('data-another', t('Another tune'), { glyph: shuffleIconSvg(16) })
    + btn('data-project', t('Make a music project'))
    + (main ? '' : btn('data-make-main', t('Make main'), { kind: 'ghost' }))
    + (main || m.profile.contexts.length < 2 ? '' : btn('data-remove-use', t('Remove'), { kind: 'ghost' }))
    + '</div>';
  return `<div class="sound-use" data-use-panel>${head}<p class="sound-summary">${icon('music', { size: 16 })}<span>${e(soundSummary(m.playing(c)))}</span></p>${actions}${voiceHtml(m, c)}${notesHtml(m, c)}</div>`;
}

function detailsHtml(m: SoundViewModel): string {
  const p = m.profile;
  const ro = m.readonly;
  const character = ro
    ? [p.identity.character, p.identity.anchors, p.identity.avoid].filter(Boolean).map((x) => `<p>${e(x)}</p>`).join('') || `<p class="sound-hint">${t('No character notes yet.')}</p>`
    : field('identity.character', t('How it should feel'), p.identity.character, t('For example: warm and clear for a tutorial, brighter for a launch.'))
      + field('identity.anchors', t('What stays the same'), p.identity.anchors, t('Instruments, rhythms or a signature people should recognise.'))
      + field('identity.avoid', t('What to avoid'), p.identity.avoid);
  const reviewed = p.review.state === 'reviewed';
  const review = reviewed
    ? `<p>${e(tRaw('Reviewed by {name} on {date}', { name: p.review.state === 'reviewed' ? p.review.reviewer : '', date: p.review.state === 'reviewed' ? p.review.at.slice(0, 10) : '' }))}</p>${p.review.state === 'reviewed' ? `<p class="sound-hint">${e(p.review.notes)}</p>` : ''}`
    : `<p class="sound-hint">${t('Nobody has recorded a listening review of this sound yet.')}</p>`;
  const reviewForm = ro ? '' : m.reviewing
    ? `<div class="sound-review" data-review-form><label class="sound-field"><span class="sound-field-label">${t('Your name')}</span><input class="field-input" data-reviewer maxlength="160"></label>`
      + `<label class="sound-field"><span class="sound-field-label">${t('What you listened to and decided')}</span><textarea class="field-input" data-review-notes rows="3" maxlength="4000"></textarea></label>`
      + `<div class="sound-row">${btn('data-review-save', t('Record review'), { kind: 'primary' })}${btn('data-review-cancel', t('Cancel'), { kind: 'ghost' })}</div></div>`
    : btn('data-review', t('Record a listening review'));
  const body = `<h4 class="sound-sub">${t('Character')}</h4>${character}`
    + `<h4 class="sound-sub">${t('Listening review')}</h4>${review}${reviewForm}`
    + `<p class="sound-hint">${t('A review covers this version of the sound, not every tune made from this version. Any change makes the sound a draft again.')}</p>`
    + `<p class="sound-hint">${t('Projects made from a use keep this version of the sound. Your notes stay out of share links.')}</p>`;
  return fold('details', t('Details'), 'info', reviewed ? t('Reviewed') : t('Draft'), body, m.open, 3);
}

/** The save state and its two buttons, the same at the top of the room and at its end. */
const saveButtons = (m: SoundViewModel): string =>
  `<span class="sound-savebar" data-savebar${m.dirty ? '' : ' hidden'}>`
  + btn('data-discard', m.saved ? t('Discard changes') : t('Start over'), { kind: 'ghost' })
  + btn('data-save', t('Save sound'), { kind: 'primary' })
  + '</span>';

/**
 * The whole room. Saving lives in the room's own flow, never over it: beside the title
 * (the save state, what just happened, and Save sound while there are changes, where the
 * Rules room keeps its own action), and again at the room's end while there is something
 * to save or to say, so neither end of the page sends the person back to the other.
 */
export function soundRoomHtml(m: SoundViewModel): string {
  fieldsReadonly = m.readonly;
  const state = saveStateText(m);
  const bar = m.readonly
    ? `<span class="usage-badge">${t('Read-only')}</span>`
    : `<div class="sound-bar" data-bar${m.picked ? '' : ' hidden'}><div class="sound-bar-row"><span class="be-save-state sound-state" data-sound-state${state ? '' : ' hidden'}>${e(state)}</span>${saveButtons(m)}</div>`
      + '<p class="sound-status" role="status" aria-live="polite" data-sound-status></p></div>';
  const head = `<header class="sound-head"><div class="sound-head-text"><p class="start-eyebrow">${e(m.label)}</p>`
    + `<h2 class="sound-title">${t('Sound')}</h2>`
    + `<p class="sound-lede">${t('Music and a voice for your videos, decks and stories.')}</p></div>${bar}</header>`;
  const uses = m.picked || m.readonly
    ? `<section class="sound-section sound-uses" aria-labelledby="sound-uses-title" data-reveal><div class="sound-section-head sound-section-head--row"><h3 class="sound-section-title" id="sound-uses-title">${t('Where it plays')}</h3>`
      + segHtml('sound-listen', [{ id: 'music', label: t('Music') }, { id: 'voice', label: t('With narration') }], m.withVoice ? 'voice' : 'music', t('What to play'), { attr: 'data-listen', extraClass: 'sound-listen' })
      + `</div>${chipsHtml(m)}${useHtml(m)}</section>`
    : '';
  const details = m.picked || m.readonly ? `<div data-reveal>${detailsHtml(m)}</div>` : '';
  // The end of the room says the same as its top; only the top is a live region, so a screen reader hears it once.
  const end = m.readonly ? '' : `<div class="sound-end" data-endbar${m.dirty ? '' : ' hidden'}><span class="sound-end-text" data-endbar-text aria-hidden="true">${e(state)}</span>${saveButtons(m)}</div>`;
  return `${head}${m.readonly ? '' : directionsHtml(m)}${uses}${details}${end}`;
}

/** What the room says when it cannot show a sound. */
export const soundMessageHtml = (message: string): string =>
  `<header class="sound-head"><div class="sound-head-text"><h2 class="sound-title">${t('Sound')}</h2><p class="sound-lede">${e(message)}</p></div></header>`;
