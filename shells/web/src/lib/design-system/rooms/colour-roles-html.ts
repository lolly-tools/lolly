// SPDX-License-Identifier: MPL-2.0
/**
 * The Colour roles table as markup (plans/352 R2): pure string builders over the model,
 * so its shape is asserted with no DOM. `rooms/colour-roles.ts` wires this markup.
 *
 * One markup at every width. A container query decides between four columns and a stacked
 * card, and either way light and dark sit side by side. It is a table in the
 * accessibility tree at both, through explicit roles, because a real `<table>` loses its
 * semantics once it is laid out as a grid.
 *
 * Every label and description is the file's text: escaped here, `dir="auto"` so Arabic
 * and Hebrew read correctly, and never used as a key. Every control carries
 * `data-crt-focus`, which is what lets focus come back after a repaint.
 */
import { t, tRaw } from '../../../i18n.ts';
import { escape as esc } from '../../../utils.ts';
import { icon } from '../../icons.ts';
import { BINDABLE_COLOUR_SLOTS, MAX_ROLE_DESCRIPTION, MAX_ROLE_LABEL, STARTING_POINTS, byNameLine, byNameWord, parseRoleWords, readingOption, sameAsWords, slotLine, slotWord, suggestedReadings } from '../colour-roles-model.ts';
import type { ColourRolesModel, RemovalExplanation, RoleTableRow, RoleValueCell, SlotId } from '../colour-roles-model.ts';
import { apcaParts } from '../roles.ts';
import type { RoleSwatchOption } from '../roles.ts';
import { swatchGroupsHtml } from '../role-chips.ts';

/** What the room is in the middle of. None of this is ever written to the document. */
export interface RoomUi {
  /** The starting points are open, holding this text. */
  starting: string | null;
  /** The add field is open. */
  adding: boolean;
  /** The removal explanation under one row. */
  removing: { key: string; label: string; explanation: RemovalExplanation; plain: boolean } | null;
  /** The last refusal, shown under the row or field that was refused. */
  notice: { key: string; text: string } | null;
}

export const emptyUi = (): RoomUi => ({ starting: null, adding: false, removing: null, notice: null });

const noticeHtml = (ui: RoomUi, key: string): string =>
  (ui.notice?.key === key ? `<p class="lp-help crt-notice" role="alert">${esc(ui.notice.text)}</p>` : '');

/** Whether text reads on this colour, and a mark where someone stated their own text colour. */
function metaHtml(cell: RoleValueCell): string {
  const bits: string[] = [];
  if (cell.reading) bits.push(`<span class="be-role-apca${cell.reading.weak ? ' is-weak' : ''}" title="${esc(cell.reading.title)}">${esc(cell.reading.text)}</span>`);
  if (cell.onWord) bits.push(`<span class="crt-stated" title="${esc(cell.onTitle)}">${esc(cell.onWord)}</span>`);
  const copied = cell.copied ? `<span class="lp-sec-flag crt-copied" title="${esc(cell.copied)}">${esc(t('Copied'))}</span>` : '';
  return bits.length || copied ? `<span class="crt-meta">${bits.join('<span class="crt-dot" aria-hidden="true">·</span>')}${copied}</span>` : '';
}

/** What a cell says it holds. "Same as light" is a state of its own, not a value. */
const cellText = (cell: RoleValueCell): string =>
  (cell.sameAs ? sameAsWords(cell.sameAs) : cell.text || t('No colour here'));

function chipHtml(cell: RoleValueCell): string {
  return `<i class="crt-chip" style="--crt-bg:${esc(cell.chipBg || 'transparent')};--crt-fg:${esc(cell.chipFg || 'currentColor')}" aria-hidden="true">Aa</i>`;
}

function valueCellHtml(model: ColourRolesModel, row: RoleTableRow, cell: RoleValueCell): string {
  const text = cellText(cell);
  const look = `<span class="crt-look" aria-hidden="true">${esc(cell.modeName)}</span>`;
  const value = model.editable
    ? `<button type="button" class="lp-swatch crt-value" data-crt-value="${esc(row.key)}" data-crt-mode="${esc(cell.mode)}" data-crt-focus="value:${esc(row.key)}:${esc(cell.mode)}"
        aria-haspopup="dialog" aria-label="${esc(tRaw('{role}, {look}: {value}. Choose a colour', { role: row.label, look: cell.modeName, value: text }))}" title="${esc(text)}">${chipHtml(cell)}<span>${esc(text)}</span></button>`
    : `<span class="crt-value crt-value--read" title="${esc(text)}">${chipHtml(cell)}<span>${esc(text)}</span></span>`;
  return `<div class="crt-cell" role="cell">${look}${value}${metaHtml(cell)}</div>`;
}

function roleCellHtml(model: ColourRolesModel, row: RoleTableRow, ui: RoomUi): string {
  if (!model.editable) {
    return `<div class="crt-role" role="rowheader">
      <strong class="crt-name crt-name--read" dir="auto">${esc(row.label)}</strong>
      ${row.description ? `<p class="crt-desc crt-desc--read" dir="auto">${esc(row.description)}</p>` : ''}
    </div>`;
  }
  const grip = row.shipped ? '' : `<button type="button" class="lp-iconbtn crt-grip" data-reorder-handle data-crt-focus="grip:${esc(row.key)}" aria-pressed="false"
      aria-label="${esc(tRaw('Reorder {role}', { role: row.label }))}" title="${esc(t('Drag to reorder. Or press Space, use the arrow keys, then press Space to drop.'))}">${icon('grip', { size: 14, filled: true })}</button>`;
  const remove = row.shipped ? '' : `<button type="button" class="lp-iconbtn crt-remove" data-crt-remove="${esc(row.key)}" data-crt-focus="remove:${esc(row.key)}"
      aria-label="${esc(tRaw('Remove {role}', { role: row.label }))}" title="${esc(tRaw('Remove {role}', { role: row.label }))}">${icon('trash', { size: 14 })}</button>`;
  return `<div class="crt-role" role="rowheader">
    <div class="crt-name-row">${grip}
      <input type="text" class="field-input crt-name" data-crt-name="${esc(row.key)}" data-crt-focus="name:${esc(row.key)}" value="${esc(row.label)}" maxlength="${MAX_ROLE_LABEL}" dir="auto"
        title="${esc(row.label)}" autocomplete="off" spellcheck="false" aria-label="${esc(tRaw('Name of the colour role {role}', { role: row.label }))}">
      ${remove}
    </div>
    ${row.shipped ? '' : `<textarea class="crt-desc" data-crt-desc="${esc(row.key)}" data-crt-focus="desc:${esc(row.key)}" rows="1" maxlength="${MAX_ROLE_DESCRIPTION}" dir="auto"
        placeholder="${esc(t('What is it for?'))}" aria-label="${esc(tRaw('What {role} is for', { role: row.label }))}">${esc(row.description)}</textarea>`}
    ${noticeHtml(ui, `name:${row.key}`)}
  </div>`;
}

/** The answer to "how does Lolly read this?". Only a role that can move gets a control. */
function readsCellHtml(model: ColourRolesModel, row: RoleTableRow, ui: RoomUi): string {
  const first = row.slots[0];
  const word = first ? slotWord(first) : byNameWord();
  const line = first ? slotLine(first) : byNameLine();
  const look = `<span class="crt-look" aria-hidden="true">${esc(t('Lolly reads this as'))}</span>`;
  const fixedRead = !model.editable || row.shipped || row.fixed;
  const control = fixedRead
    ? `<span class="crt-reads-word">${esc(word)}</span>`
    : `<select class="field-select crt-reads-pick" data-crt-reads="${esc(row.key)}" data-crt-focus="reads:${esc(row.key)}" aria-label="${esc(tRaw('What Lolly reads {role} as', { role: row.label }))}">
        ${BINDABLE_COLOUR_SLOTS.map((slot) => {
          const option = readingOption(model, row, slot as SlotId);
          return `<option value="${esc(slot)}"${first === slot ? ' selected' : ''}${option.disabled ? ' disabled' : ''}>${esc(option.label)}</option>`;
        }).join('')}
        <option value=""${first ? '' : ' selected'}>${esc(byNameWord())}</option>
      </select>`;
  const also = row.slots.slice(1).map(slot => `<p class="lp-help crt-also">${esc(tRaw('Also {slot}', { slot: slotWord(slot) }))}${model.editable && !fixedRead
    ? ` <button type="button" class="crt-link" data-crt-letgo="${esc(slot)}" data-crt-role="${esc(row.key)}" data-crt-focus="letgo:${esc(row.key)}:${esc(slot)}">${esc(t('Let go'))}</button>` : ''}</p>`).join('');
  const unwritten = row.unwritten.map(slot => `<p class="lp-help crt-notice">${esc(tRaw('The file says this fills {slot}, but the colours do not link here yet.', { slot: slotWord(slot) }))}${model.editable
    ? ` <button type="button" class="crt-link" data-crt-link="${esc(slot)}" data-crt-role="${esc(row.key)}" data-crt-focus="link:${esc(row.key)}:${esc(slot)}">${esc(t('Link them'))}</button>` : ''}</p>`).join('');
  return `<div class="crt-reads" role="cell">${look}${control}<p class="lp-help">${esc(line)}</p>${also}${unwritten}${noticeHtml(ui, `reads:${row.key}`)}</div>`;
}

function removalHtml(ui: RoomUi, row: RoleTableRow): string {
  const r = ui.removing;
  if (!r || r.key !== row.key) return '';
  const { explanation: e, label } = r;
  const go = e.blocked ? '' : e.releases
    ? `<button type="button" class="be-btn be-btn--sm" data-crt-remove-go="release" data-crt-focus="remove-go">${esc(t('Remove and keep those colours'))}</button>`
    : `<button type="button" class="be-btn be-btn--sm" data-crt-remove-go="plain" data-crt-focus="remove-go">${esc(tRaw('Remove {role}', { role: label }))}</button>`;
  return `<div class="lp-status crt-removal" data-status="danger" role="cell" aria-label="${esc(tRaw('Remove {role}', { role: label }))}" data-crt-panel="removal"><div class="lp-status-copy">
    ${e.uses.length ? `<ul class="crt-removal-uses">${e.uses.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
    <span class="crt-removal-note">${esc(e.unseen)}</span>
    <div class="crt-removal-actions">${go}<button type="button" class="be-btn be-btn--sm" data-crt-remove-cancel data-crt-focus="remove-cancel">${esc(tRaw('Keep {role}', { role: label }))}</button></div>
  </div></div>`;
}

function rowHtml(model: ColourRolesModel, row: RoleTableRow, ui: RoomUi): string {
  return `<div class="crt-row" role="row" ${row.shipped ? '' : `data-reorder-row="${esc(row.key)}" `}data-crt-row="${esc(row.key)}">
    ${roleCellHtml(model, row, ui)}
    ${row.cells.map(cell => valueCellHtml(model, row, cell)).join('')}
    ${readsCellHtml(model, row, ui)}
    ${removalHtml(ui, row)}
  </div>`;
}

/** Two small halves, one colour per look, so a slot's whole story fits one chip. */
const pairHtml = (colours: ReadonlyArray<{ modeName: string; hex: string }>): string =>
  `<span class="crt-pair" aria-hidden="true">${colours.map(c => `<i style="--crt-bg:${esc(c.hex || 'transparent')}"></i>`).join('')}</span>`;

const pairWords = (colours: ReadonlyArray<{ modeName: string; hex: string }>): string =>
  colours.map(c => `${c.modeName} ${c.hex || t('No colour here')}`).join(', ');

function unfilledHtml(model: ColourRolesModel): string {
  if (!model.unfilled.length) return '';
  return `<div class="crt-unfilled">
    <p class="lp-help">${esc(t('No role fills these, so they stay as the design system defines them.'))}</p>
    <ul class="crt-unfilled-list">${model.unfilled.map(u => `<li title="${esc(u.line)}">${pairHtml(u.colours)}<span>${esc(u.word)}</span><span class="visually-hidden">${esc(pairWords(u.colours))}</span></li>`).join('')}</ul>
  </div>`;
}

function handWrittenHtml(model: ColourRolesModel, ui: RoomUi): string {
  if (!model.handWritten.length && !model.unusable.length) return '';
  const named = model.handWritten.map(colour => `<li class="crt-token">
      ${pairHtml(colour.colours)}
      ${model.editable
        ? `<input type="text" class="field-input crt-token-name" data-crt-token-word="${esc(colour.id)}" data-crt-focus="token:${esc(colour.id)}" value="${esc(colour.label)}" maxlength="${MAX_ROLE_LABEL}" dir="auto" autocomplete="off" spellcheck="false"
            aria-label="${esc(tRaw('Name for the colour {token}', { token: colour.id }))}">
          <button type="button" class="be-btn be-btn--sm" data-crt-name-token="${esc(colour.id)}" data-crt-focus="token-go:${esc(colour.id)}">${esc(t('Make a role'))}</button>`
        : `<span>${esc(colour.label)}</span>`}
      <code class="crt-token-id">${esc(colour.id)}</code>
      ${noticeHtml(ui, `token:${colour.id}`)}
    </li>`).join('');
  const unusable = model.unusable.map(id => `<li class="crt-token crt-token--unusable"><code class="crt-token-id">${esc(id)}</code><span class="lp-help">${esc(t('A name with digits cannot be a role, so this stays in the file and keeps working by its path.'))}</span></li>`).join('');
  return `<div class="crt-tokens">
    <p class="lp-subhead">${esc(t('In this file, with no role yet'))}</p>
    <ul class="crt-token-list">${named}${unusable}</ul>
  </div>`;
}

function issuesHtml(model: ColourRolesModel): string {
  if (!model.issues.length) return '';
  return `<details class="lp-details crt-issues"><summary><span>${esc(model.issues.length === 1 ? t('1 thing to check in this file') : tRaw('{n} things to check in this file', { n: model.issues.length }))}</span><i class="lp-caret" aria-hidden="true"></i></summary>
    <ul class="crt-removal-uses">${model.issues.map(line => `<li>${esc(line)}</li>`).join('')}</ul></details>`;
}

/** The words someone is about to use, each with the reading Lolly would give. */
export function startPreviewHtml(text: string): string {
  const words = parseRoleWords(text);
  if (!words.length) return '';
  return suggestedReadings(words).map(({ word, slot }) =>
    `<li><span class="crt-start-word" dir="auto">${esc(word)}</span><span class="crt-start-read">${esc(slot ? slotWord(slot) : byNameWord())}</span></li>`).join('');
}

function startingHtml(ui: RoomUi): string {
  if (ui.starting === null) return '';
  return `<div class="crt-start" data-crt-panel="start" role="group" aria-label="${esc(t('Colour roles in this design system\'s words'))}">
    <p class="crt-start-lead">${esc(t('Use the words this design system uses. Tools keep drawing the same colours.'))}</p>
    <div class="crt-start-picks">
      ${STARTING_POINTS.map((words, i) => `<button type="button" class="be-btn be-btn--sm" data-crt-seed="${i}" data-crt-focus="seed:${i}">${esc(words.join(', '))}</button>`).join('')}
    </div>
    <label class="crt-start-field"><span class="lp-label">${esc(t('Or type the words, separated by commas'))}</span>
      <input type="text" class="field-input" data-crt-words data-crt-focus="words" value="${esc(ui.starting)}" dir="auto" autocomplete="off" spellcheck="false"></label>
    <ul class="crt-start-preview" data-crt-start-preview>${startPreviewHtml(ui.starting)}</ul>
    ${noticeHtml(ui, 'start')}
    <div class="crt-start-actions">
      <button type="button" class="be-cta be-btn--sm" data-crt-start-use data-crt-focus="start-use">${esc(t('Use these words'))}</button>
      <button type="button" class="be-btn be-btn--sm" data-crt-start-cancel data-crt-focus="start-cancel">${esc(t('Cancel'))}</button>
    </div>
  </div>`;
}

function addHtml(model: ColourRolesModel, ui: RoomUi): string {
  if (!model.editable) return '';
  const opens = model.state === 'declared' ? 'data-crt-add' : 'data-crt-start-open';
  const button = `<button type="button" class="be-add crt-add" ${opens} data-crt-focus="add" aria-expanded="${ui.starting !== null || ui.adding}">${esc(t('+ Add a role'))}</button>`;
  if (ui.starting !== null) return startingHtml(ui);
  if (!ui.adding) return button;
  return `<div class="crt-adding" data-crt-panel="add">
    <input type="text" class="field-input" data-crt-add-word data-crt-focus="add-word" maxlength="${MAX_ROLE_LABEL}" dir="auto" autocomplete="off" spellcheck="false" placeholder="${esc(t('Name, in this design system\'s words'))}" aria-label="${esc(t('Name of the new colour role'))}">
    <button type="button" class="be-cta be-btn--sm" data-crt-add-go data-crt-focus="add-go">${esc(t('Add'))}</button>
    <button type="button" class="be-btn be-btn--sm" data-crt-add-cancel data-crt-focus="add-cancel">${esc(t('Cancel'))}</button>
    ${noticeHtml(ui, 'add')}
  </div>`;
}

/** The whole room. */
export function roomHtml(model: ColourRolesModel, ui: RoomUi): string {
  const refusal = model.refusal ? `<div class="lp-status" role="status" data-status="danger"><div class="lp-status-copy"><span>${esc(model.refusal)}</span></div></div>` : '';
  const heads = model.modes.map(m => `<span role="columnheader" class="lp-label">${esc(m.name)}</span>`).join('');
  // Explained once, so no cell repeats the sentence.
  const ink = model.rows.some(row => row.cells.some(cell => cell.onOrigin === 'surface'));
  const caption = `${t('Aa shows the text Lolly picks to sit on each colour.')}${ink ? ` ${t('A colour used as text shows on the background instead.')}` : ''}`;
  return `${refusal}
    <p class="lp-help crt-caption">${esc(caption)}</p>
    <div class="crt-table" role="table" aria-label="${esc(t('Colour roles'))}" style="--crt-looks:${model.modes.length}">
      <div class="crt-head" role="row">
        <span role="columnheader" class="lp-label">${esc(t('Role'))}</span>${heads}<span role="columnheader" class="lp-label">${esc(t('Lolly reads this as'))}</span>
      </div>
      <div class="crt-rows" role="rowgroup">${model.rows.map(row => rowHtml(model, row, ui)).join('')}</div>
    </div>
    ${addHtml(model, ui)}
    ${unfilledHtml(model)}
    ${handWrittenHtml(model, ui)}
    ${issuesHtml(model)}`;
}

/** The colourways as a chooser, for a read-only view that has no Colourways row of its own. */
export function viewChipsHtml(leads: ReadonlyArray<{ id: string; name: string; canonical: boolean; hex: string }>, current: string | null): string {
  if (leads.length < 2) return '';
  return `<div class="be-leads-row" role="group" aria-label="${esc(t('Colourways'))}">${leads.map(lead => `<button type="button" class="be-lead" data-crt-view="${esc(lead.id)}" data-crt-focus="view:${esc(lead.id)}" aria-pressed="${lead.id === current}">
      <span class="be-lead-dot" style="background:${esc(lead.hex)}"></span><span class="be-lead-name">${esc(lead.name)}</span>${lead.canonical ? `<span class="be-lead-badge">${esc(t('Default'))}</span>` : ''}</button>`).join('')}</div>`;
}

export interface ValuePicker {
  title: string;
  caption: string;
  cell: RoleValueCell;
  /** Can this look follow another, and which: null where it cannot. */
  sameAs: { label: string; pressed: boolean } | null;
  options: RoleSwatchOption[];
  current: string;
}

/** The picker for one value: its state, the palette, and the colour on top. */
export function valuePickerHtml(p: ValuePicker): string {
  // A tooltip is out of reach on a phone, so the panel spells out what the cell only hints at.
  const says = p.cell.onOrigin === 'stated' ? t('The file states the text colour on this one.')
    : p.cell.onOrigin === 'derived' ? t('Lolly picks the text colour on this one and keeps it current.') : '';
  const on = p.cell.reading
    ? `<p class="crt-pick-on"><i class="crt-chip" style="--crt-bg:${esc(p.cell.chipBg)};--crt-fg:${esc(p.cell.chipFg)}" aria-hidden="true">Aa</i><span><span class="be-role-apca${p.cell.reading.weak ? ' is-weak' : ''}">${esc(p.cell.reading.text)}.</span> ${esc(says)} ${esc(p.cell.reading.title)}</span></p>`
    : '';
  const copied = p.cell.copied
    ? `<div class="lp-status crt-pick-copied"><div class="lp-status-copy"><span>${esc(p.cell.copied)}</span><button type="button" class="be-btn be-btn--sm" data-crt-keep>${esc(t('Keep this colour'))}</button></div></div>`
    : '';
  const same = p.sameAs ? `<button type="button" class="be-btn be-btn--sm crt-pick-same" data-crt-same aria-pressed="${p.sameAs.pressed}">${esc(p.sameAs.label)}</button>` : '';
  return `<div class="be-rolepick-head">
      <span class="be-rolepick-title">${esc(p.title)}</span>
      <span class="be-rolepick-cap" data-be-rolepick-cap aria-live="polite">${esc(p.caption)}</span>
    </div>
    ${copied}${same}
    ${swatchGroupsHtml(p.options, p.current)}
    <div class="crt-pick-field" data-crt-field></div>
    ${on}`;
}
