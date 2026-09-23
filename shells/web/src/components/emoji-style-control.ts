// SPDX-License-Identifier: MPL-2.0
/**
 * The one emoji control - pick a set, pick how the brand treats it.
 *
 * Three surfaces mount this and there is only ever one of it: the tool sidebar's
 * Emoji section, the design tool's document dock and the profile page. Two modes,
 * one control:
 *
 *  • `document` edits a DOCUMENT's style. The brand in force supplies the palette
 *    (host.tokens.colors()), and the emitted style PINS what it resolved, so the
 *    file keeps the colours it was drawn with even if the brand later moves.
 *  • `preference` edits the person's seed for new work. It emits the set, the mode
 *    and the strength only - no colours, because a seed has no brand yet.
 *
 * Everything the control emits is built by the engine's own `parseEmojiParams`,
 * the same function a `?emoji=` link and a `--emoji=` CLI flag go through. That
 * is deliberate: a set chosen here and a set named in a link cannot drift, and
 * the control never has to know what a treatment is made of.
 *
 * The specimen row is drawn by the CALLER (`opts.specimen`), which runs the
 * runtime's own DOM pass over a scratch element. There is no second renderer here
 * and no native emoji font anywhere: a set nobody has chosen, and a glyph a set
 * does not carry, both end at the engine's neutral placeholder.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiPreferenceV1, EmojiSetInfoV1, EmojiStyleV1, EmojiTreatmentModeV1 } from '@lolly-tools/core/emoji-v1';
import { parseEmojiParams } from '../../../../engine/src/emoji-style.ts';
import type { EmojiPaletteEntry } from '../../../../engine/src/emoji-style.ts';
import { licenceProfile, normaliseLicence } from '../../../../engine/src/rights-profiles.ts';
import { escape as escapeText } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import './emoji-style-control.css';
import { mountEmojiCredits } from './emoji-credits.ts';
import { mountEmojiPackCreate } from './emoji-pack-create.ts';
import { mountEmojiPackImport, mountEmojiPackExport } from './emoji-pack-import.ts';
import { mountEmojiFallbacks } from './emoji-fallbacks.ts';

/** The five characters the specimen row shows. Kept as escapes so this file carries no literal emoji. */
export const EMOJI_SPECIMEN = '\u{1F600}\u{1F60D}\u{1F914}\u{1F60E}\u2764\uFE0F';

/** One row of the treatment control. `Off` is the untouched artwork; `Full` is a straight snap. */
interface FxChoice {
  id: string;
  /** A function, not a string, so each label is a literal `t('...')` call site the
   *  translation extractor can find (scripts/translate.ts scans for those). */
  label: () => string;
  mode: EmojiTreatmentModeV1;
  strengthBps: number;
}

/** The `emojifx` param a choice writes, before any protection suffix. */
const fxParam = (choice: FxChoice): string =>
  choice.mode === 'influence' ? `influence:${choice.strengthBps}` : choice.mode;

/**
 * The Audiogram vocabulary, for the same reason and with the same values: a
 * person choosing how far a picture is pulled toward the brand should meet one
 * scale across the app, not a basis-point box in one place and four words in
 * another. Mono and Duotone join it as two more answers to the same question.
 */
const FX_CHOICES: FxChoice[] = [
  { id: 'off', label: () => t('Off'), mode: 'original', strengthBps: 0 },
  { id: 'subtle', label: () => t('Subtle'), mode: 'influence', strengthBps: 2500 },
  { id: 'strong', label: () => t('Strong'), mode: 'influence', strengthBps: 6500 },
  { id: 'full', label: () => t('Full'), mode: 'snap', strengthBps: 10000 },
  { id: 'mono', label: () => t('Mono'), mode: 'mono', strengthBps: 10000 },
  { id: 'duotone', label: () => t('Duotone'), mode: 'duotone', strengthBps: 10000 },
];

/** One id per mount, so two of these in one document never share a label node. */
let mountSeq = 0;

/** The treatment ids are this file's own fixed list, so no escaping is needed. */
const fxSelector = (id: string): string => `[data-emoji-fx="${id}"]`;

export type EmojiControlMode = 'document' | 'preference';
export type EmojiControlValue = EmojiStyleV1 | EmojiPreferenceV1 | null;

export interface EmojiStyleControlOpts {
  credits?(): string;
  host: HostV1;
  mode: EmojiControlMode;
  value: EmojiControlValue;
  onChange(next: EmojiControlValue): void;
  /** Draw the five specimen characters with this style and hand back the markup. */
  specimen?: (style: EmojiStyleV1) => Promise<string>;
  /** The sets and the brand colours, when the caller has already read them.
   *  Additive: without them the control asks the host itself, which is what the
   *  profile page does. A caller that has them (the tool sidebar seeds from the
   *  same listing) passes them so one mount makes one catalog query, and so the
   *  control is usable the moment it is on screen rather than a tick later. */
  sets?: readonly EmojiSetInfoV1[];
  palette?: readonly EmojiPaletteEntry[];
  /** The tighter density the design inspector column uses: an inline label beside
   *  a small select, rather than an eyebrow stacked over a full-size one. */
  compact?: boolean;
  compactManagement?: boolean;
}

export interface EmojiStyleControl {
  update(value: EmojiControlValue): void;
  destroy(): void;
}

const isStyle = (value: EmojiControlValue): value is EmojiStyleV1 =>
  !!value && typeof value === 'object' && 'primary' in value;

/** `id@version` for the set a value names, or '' when it names none. */
function setKeyOf(value: EmojiControlValue): string {
  if (!value) return '';
  const pin = isStyle(value) ? value.primary : value.pin;
  return `${pin.id}@${pin.pin.version}`;
}

/** Which treatment row a value sits on. An influence strength nobody offers reads as the nearer of the two. */
function fxIdOf(value: EmojiControlValue): string {
  if (!value) return 'off';
  const mode = isStyle(value) ? value.treatment.mode : value.mode;
  const strength = isStyle(value) ? value.treatment.strengthBps : value.strengthBps;
  if (mode === 'snap') return 'full';
  if (mode === 'mono' || mode === 'duotone') return mode;
  if (mode === 'influence') return strength < 4500 ? 'subtle' : 'strong';
  return 'off';
}

/** Protection is on unless a style explicitly turned all three off. */
function protectOf(value: EmojiControlValue): boolean {
  if (!isStyle(value)) return true;
  const protect = 'protect' in value.treatment ? value.treatment.protect : undefined;
  if (!protect) return true;
  return Boolean(protect.skinTones || protect.flags || protect.custom);
}

/**
 * The licence as a person reads it. The engine's own normaliser answers, so a
 * catalog spelling (`CC-BY-SA-4.0`) and a credit line say the same name, and a
 * declaration nothing recognises is shown in the set's own words rather than
 * dressed up as something known.
 */
function licenceName(declaration: string): string {
  const normalised = normaliseLicence(declaration);
  const profile = normalised.id ? licenceProfile(normalised.id) : null;
  return profile?.name ?? normalised.id ?? declaration;
}

/** True when the chosen set's licence carries ShareAlike, from the reviewed profile and never from the name. */
function isShareAlike(info: EmojiSetInfoV1 | undefined): boolean {
  if (!info) return false;
  const normalised = normaliseLicence(info.license);
  return Boolean(normalised.id && licenceProfile(normalised.id)?.shareAlike);
}

/** The licence and size line under a set, so a choice is made with its terms in view. */
function setLabel(info: EmojiSetInfoV1): string {
  const glyphs = t('{n} glyphs', { n: info.glyphs });
  return `${info.label}, ${glyphs}, ${licenceName(info.license)}`;
}

export function mountEmojiStyleControl(container: HTMLElement, opts: EmojiStyleControlOpts): EmojiStyleControl {
  let value = opts.value;
  let sets: readonly EmojiSetInfoV1[] = opts.sets ?? [];
  let palette: readonly EmojiPaletteEntry[] = opts.palette ?? [];
  let destroyed = false;
  // Bumped on every render, so a specimen that arrives after the next choice is dropped.
  let gen = 0;

  const el = document.createElement('div');
  el.className = opts.compact ? 'emoji-style emoji-style--compact' : 'emoji-style';
  const rowClass = opts.compact ? 'field-row field-row--inline' : 'field-row';
  const selectClass = opts.compact ? 'field-select field-select--sm' : 'field-select';
  const fxLabelId = `emoji-fx-label-${++mountSeq}`;
  container.appendChild(el);

  /**
   * A change rewrites the whole panel, which destroys the very control being
   * operated and drops focus to <body>. The way the sidebar solves it (by-id
   * restore in tool-inputs.ts) is the way it is solved here: remember which
   * control had the keyboard, then hand it back to the node that replaced it.
   */
  function focusKey(): string | null {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !el.contains(active)) return null;
    if (active.hasAttribute('data-emoji-set')) return '[data-emoji-set]';
    if (active.hasAttribute('data-emoji-protect')) return '[data-emoji-protect]';
    const fx = active.getAttribute('data-emoji-fx');
    return fx && FX_CHOICES.some(choice => choice.id === fx) ? fxSelector(fx) : null;
  }

  function restoreFocus(key: string | null): void {
    if (!key) return;
    const next = el.querySelector<HTMLElement>(key);
    // The checked option is the only one in the tab order, so a keyboard move to
    // another option reaches a button that is now tabindex -1. focus() still
    // works on it, and the next render makes it the checked one.
    next?.focus();
  }

  function emit(setKey: string, fxId: string, protect: boolean, focus?: string): void {
    if (!setKey) {
      value = null;
      opts.onChange(null);
      render(focus);
      return;
    }
    const choice = FX_CHOICES.find(c => c.id === fxId) ?? FX_CHOICES[0]!;
    const base = fxParam(choice);
    // `original` has no colours and no protection to spell, so it never takes the suffix.
    const emojifx = base === 'original' || protect ? base : `${base},unprotected`;
    // A preference stores no colours, so it asks the parser for the set only. The
    // mode and the strength come straight off the row the person clicked, which is
    // also what a document mode's parsed treatment would have echoed back.
    const wanted = opts.mode === 'document' ? emojifx : '';
    const pinnedPalette = isStyle(value) && fxIdOf(value) === fxId && 'palette' in value.treatment ? value.treatment.palette : palette;
    const parsed = parseEmojiParams({ emoji: setKey, emojifx: wanted }, sets, pinnedPalette);
    if (!parsed.pin) {
      value = null;
      opts.onChange(null);
      render(focus);
      return;
    }
    const treatment = parsed.treatment ?? { mode: 'original' as const, strengthBps: 0 as const };
    value = opts.mode === 'document'
      ? { schemaVersion: 1, primary: parsed.pin, fallbacks: isStyle(value) ? value.fallbacks.filter(pin => pin.id !== parsed.pin!.id) : [], metricsPolicy: 'inline-em-v1', treatment }
      : { pin: parsed.pin, mode: choice.mode, strengthBps: choice.strengthBps };
    opts.onChange(value);
    render(focus);
  }

  let managementOpen = false;
  function render(focus?: string): void {
    if (destroyed) return;
    const mine = ++gen;
    const keyboard = focus ?? focusKey();
    const setKey = setKeyOf(value);
    const fxId = fxIdOf(value);
    const protect = protectOf(value);
    const absent = setKey && !sets.some(info => `${info.pin.id}@${info.pin.pin.version}` === setKey);
    const options = [
      ...(absent ? [`<option value="${escapeText(setKey)}" selected>${escapeText(setKey)} (${t('Unavailable')})</option>`] : []),
      `<option value=""${setKey ? '' : ' selected'}>${escapeText(t('Choose an emoji set'))}</option>`,
      ...sets.map(info => {
        const key = `${info.pin.id}@${info.pin.pin.version}`;
        return `<option value="${escapeText(key)}"${key === setKey ? ' selected' : ''}>${escapeText(setLabel(info))}</option>`;
      }),
    ].join('');
    const fxButtons = FX_CHOICES.map(choice => {
      const on = choice.id === fxId;
      return `<button type="button" role="radio" class="badge-select-opt${on ? ' is-on' : ''}"`
        + ` data-emoji-fx="${escapeText(choice.id)}" aria-checked="${on ? 'true' : 'false'}" tabindex="${on ? '0' : '-1'}">`
        + `<span class="badge-select-label">${escapeText(choice.label())}</span></button>`;
    }).join('');
    const specimenRow = opts.mode === 'document'
      ? `<div class="emoji-style-specimen" data-emoji-specimen role="img" aria-label="${escapeText(tRaw('How this set draws five emoji'))}"></div>`
      : '';
    // The treatment and the protection switch only make sense once a set is chosen:
    // there is nothing to treat and nothing to protect until then.
    const chosen = Boolean(setKey);
    // Protection is a property of a DOCUMENT's treatment, and only a document has
    // colours to protect anything from. A preference carries no protection field
    // at all, so offering the switch there showed a tick that did nothing and came
    // straight back on.
    const protectRow = chosen && opts.mode === 'document'
      ? `<label class="field-toggle">
        <input type="checkbox" class="field-check" data-emoji-protect${protect ? ' checked' : ''}>
        <span>${t('Keep skin tones and flags')}</span>
      </label>`
      : '';
    // A treatment that is not `original` recolours the artwork, and the engine
    // records recoloured ShareAlike artwork as an adaptation under a named rule
    // (`adaptation-operations-v1`). The note says exactly that, because whether a
    // particular combination is legally an adaptation can turn on the licence,
    // the jurisdiction and the treatment (plan 253 section 3.3), and this is a
    // recorded classification rather than a ruling. It is said where the choice
    // is made, once, and stops there: the licence for a shared adaptation is
    // chosen in the export panel, and nothing here takes the treatment away.
    const treatment = FX_CHOICES.find(choice => choice.id === fxId);
    const shareAlikeNote = chosen && treatment && treatment.mode !== 'original' && isShareAlike(sets.find(info => `${info.pin.id}@${info.pin.pin.version}` === setKey))
      ? `<p class="emoji-style-note" data-emoji-sa-note>${t('Lolly records recoloured artwork from this set as an adaptation. If you share it, the export panel will ask you to choose a compatible licence.')}</p>`
      : '';
    el.innerHTML = `
      <label class="${rowClass}">
        <span class="field-label">${t('Emoji set')}</span>
        <select class="${selectClass}" data-emoji-set>${options}</select>
      </label>
      ${specimenRow}
      ${chosen ? `
      <div class="${rowClass}">
        <span class="field-label" id="${fxLabelId}">${t('Palette influence')}</span>
        <div class="badge-select badge-select--segmented" role="radiogroup" data-emoji-fx-group aria-labelledby="${fxLabelId}">${fxButtons}</div>
      </div>
      ${shareAlikeNote}
      ${protectRow}
      <p class="emoji-style-note">${t('Emoji are drawn from the set you choose, so every device shows the same artwork. The set\'s licence is recorded with exports that can carry it.')}</p>
      ` : `<p class="emoji-style-note">${t('Until you choose a set, emoji in your text are drawn as a plain placeholder rather than this machine\'s own emoji font.')}</p>`}
    `;
    if (opts.mode === 'document' && isStyle(value)) {
      mountEmojiFallbacks(el, value, sets, next => { value = next; opts.onChange(next); render(); });
    }
    if (opts.host.emoji) mountEmojiPackImport(el, opts.host.emoji, info => {
      sets = [...sets.filter(set => JSON.stringify(set.pin) !== JSON.stringify(info.pin)), info];
      emit(`${info.pin.id}@${info.pin.pin.version}`, fxIdOf(value), protectOf(value));
    });
    if (opts.host.emoji) mountEmojiPackCreate(el, opts.host.emoji, info => {
      sets = [...sets, info]; emit(`${info.pin.id}@${info.pin.pin.version}`, fxIdOf(value), protectOf(value));
    });
    mountEmojiPackExport(el, opts.host, isStyle(value) ? value : null);
    if (opts.credits) mountEmojiCredits(el,opts.host,opts.credits);
    if (opts.compactManagement) {
      const details = document.createElement('details');
      // The panel primitive's own disclosure (styles/parts/panel.css). A compact
      // mount sits inside a panel column, and a bare <details> with the native
      // triangle marker was a third fold idiom in a column that already has two.
      details.className = 'lp-details';
      details.open = managementOpen;
      details.dataset.emojiManage = '';
      details.addEventListener('toggle', () => { managementOpen = details.open; });
      const summary = document.createElement('summary');
      const word = document.createElement('span');
      word.textContent = t('Manage emoji sets');
      const caret = document.createElement('i');
      caret.className = 'lp-caret';
      caret.setAttribute('aria-hidden', 'true');
      summary.append(word, caret);
      details.append(summary);
      const specimen = el.querySelector('[data-emoji-specimen]');
      specimen?.remove();
      while (el.firstChild) details.append(el.firstChild);
      const label = document.createElement('p');
      label.className = 'emoji-style-summary';
      const selected = sets.find(info => `${info.pin.id}@${info.pin.pin.version}` === setKey);
      label.textContent = `${selected ? selected.label : t('No emoji set')} · ${treatment?.mode === 'original' ? t('Original') : treatment?.label() ?? t('Original')}`;
      el.append(label);
      if (specimen) el.append(specimen);
      el.append(details);
    }
    restoreFocus(keyboard);
    if (opts.mode === 'document' && opts.specimen && isStyle(value)) {
      const target = el.querySelector('[data-emoji-specimen]');
      const style = value;
      void opts.specimen(style).then(html => {
        if (destroyed || mine !== gen || !target) return;
        target.innerHTML = html;
      }).catch(() => { /* a specimen is a nicety - never take the panel down for one */ });
    }
  }

  function onInput(e: Event): void {
    const target = e.target as HTMLElement | null;
    const select = target?.closest<HTMLSelectElement>('[data-emoji-set]');
    if (select) { emit(select.value, fxIdOf(value), protectOf(value)); return; }
    const protect = target?.closest<HTMLInputElement>('[data-emoji-protect]');
    if (protect) emit(setKeyOf(value), fxIdOf(value), protect.checked);
  }

  /** Pick a treatment and leave the keyboard on the option that is now checked. */
  function pickFx(id: string): void {
    emit(setKeyOf(value), id, protectOf(value), fxSelector(id));
  }

  function onClick(e: Event): void {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-emoji-fx]');
    if (!btn) return;
    pickFx(btn.dataset.emojiFx ?? 'off');
  }

  /**
   * The ARIA radiogroup keys, the same set the sidebar's own segmented control
   * answers (views/tool-inputs.ts). Without them the roving tabindex is a trap:
   * only the checked option is reachable, and no key changes it.
   */
  function onKeyDown(e: Event): void {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-emoji-fx]');
    if (!btn) return;
    const key = (e as KeyboardEvent).key;
    const index = FX_CHOICES.findIndex(choice => choice.id === btn.dataset.emojiFx);
    if (index < 0) return;
    let next = -1;
    if (key === 'ArrowDown' || key === 'ArrowRight') next = (index + 1) % FX_CHOICES.length;
    else if (key === 'ArrowUp' || key === 'ArrowLeft') next = (index - 1 + FX_CHOICES.length) % FX_CHOICES.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = FX_CHOICES.length - 1;
    else if (key === ' ' || key === 'Enter') {
      e.preventDefault();
      pickFx(FX_CHOICES[index]!.id);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    pickFx(FX_CHOICES[next]!.id);
  }

  el.addEventListener('change', onInput);
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKeyDown);
  render();

  // The listing and the palette both arrive late, so the control renders its empty
  // state first and fills in. A host with no emoji API lists nothing, which is the
  // honest answer: there are no sets on this device. A caller that already read
  // both skips this entirely.
  if (!opts.sets) void (async () => {
    const [listed, colours] = await Promise.all([
      opts.host.emoji ? opts.host.emoji.sets().catch(() => [] as EmojiSetInfoV1[]) : Promise.resolve([] as EmojiSetInfoV1[]),
      opts.mode === 'document' && opts.host.tokens
        ? opts.host.tokens.colors().catch(() => []).then(list => list.map(swatch => ({ id: swatch.ref, hex: swatch.value })))
        : Promise.resolve([] as EmojiPaletteEntry[]),
    ]);
    if (destroyed) return;
    sets = listed;
    palette = colours;
    render();
  })();

  return {
    update(next: EmojiControlValue): void {
      value = next;
      render();
    },
    destroy(): void {
      destroyed = true;
      el.removeEventListener('change', onInput);
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKeyDown);
      el.remove();
    },
  };
}
