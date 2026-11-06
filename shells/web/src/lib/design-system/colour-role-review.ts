// SPDX-License-Identifier: MPL-2.0
/**
 * The words a file came with, in the review before anything applies (plans/352 R4). A row
 * per word: what the file calls the colour, the colour in each look, and what Lolly would
 * read it as. Every row can be renamed, read differently or turned off, and pressing the
 * review's own button is what applies them. Turning them all off, or choosing to install
 * without roles, installs the file exactly as it came.
 *
 * Pure strings over a small state, so the shape is asserted with no DOM. Every label and
 * description is the file's text: escaped, `dir="auto"`, and never a key on a plain object.
 */
import { readColourRoles } from '@lolly/engine';
import { t, tRaw } from '../../i18n.ts';
import { escape as esc } from '../../utils.ts';
import type { ColourRoleChoice, ColourRoleProposal, ColourRoleReading } from '../brand-propose.ts';
import { byNameLine, byNameWord, lookName, slotLine, slotWord } from './colour-roles-model.ts';

const READINGS: readonly ColourRoleReading[] = ['primary', 'secondary', 'surface', 'text', 'muted', 'edge'];

/** What the review starts from: every row on, as suggested. */
export const initialChoices = (proposal: ColourRoleProposal): ColourRoleChoice[] =>
  proposal.rows.map(row => ({ id: row.id, label: row.label, description: row.description, reads: row.reads, keep: true }));

/** Each slot takes one role: reading this row as a slot moves the slot here. */
export function chooseReading(choices: readonly ColourRoleChoice[], id: string, reads: ColourRoleReading | null): ColourRoleChoice[] {
  return choices.map((choice) => {
    if (choice.id === id) return { ...choice, reads };
    return reads && choice.reads === reads ? { ...choice, reads: null } : choice;
  });
}

/** Does anything in this review read as the lead colour, or does the file have one of its own? */
export const reviewHasLead = (proposal: ColourRoleProposal, choices: readonly ColourRoleChoice[]): boolean =>
  proposal.hasLead || !choices.some(choice => choice.keep) || choices.some(choice => choice.keep && choice.reads === 'primary');

const lineFor = (reads: ColourRoleReading | null): string => (reads ? slotLine(reads) : byNameLine());

/** One head for both columns where they sit side by side. A narrow card gives each row its own. */
const headRow = (): string => `<div class="ds-role-row ds-role-headrow" role="row"><span role="columnheader">${esc(t('Role'))}</span><span role="columnheader">${esc(t('Lolly reads this as'))}</span></div>`;

function rowHtml(proposal: ColourRoleProposal, choice: ColourRoleChoice): string {
  const row = proposal.rows.find(r => r.id === choice.id)!;
  const swatch = row.colours.map(c => `<i style="--crt-bg:${esc(c.hex || 'transparent')}" title="${esc(lookName({ id: c.mode, name: c.mode || 'light' }))}: ${esc(c.hex)}"></i>`).join('');
  const label = esc(choice.label);
  const options = READINGS.map(slot => `<option value="${slot}"${choice.reads === slot ? ' selected' : ''}>${esc(slotWord(slot))}</option>`).join('');
  const picker = row.fixed
    ? `<span class="ds-role-fixed">${esc(slotWord(row.id as ColourRoleReading))}</span>`
    : `<select class="field-select ds-role-reads" data-role-reads="${esc(row.id)}"${choice.keep ? '' : ' disabled'} aria-label="${esc(tRaw('What Lolly reads {role} as', { role: choice.label }))}">
        ${options}<option value=""${choice.reads ? '' : ' selected'}>${esc(byNameWord())}</option>
      </select>`;
  return `<div class="ds-role-row${choice.keep ? '' : ' is-off'}" role="row" data-role-row="${esc(row.id)}">
    <div class="ds-role-word" role="rowheader">
      <label class="ds-role-keep" title="${esc(t('Keep this as a colour role'))}"><input type="checkbox" class="field-check" data-role-keep="${esc(row.id)}"${choice.keep ? ' checked' : ''} aria-label="${esc(tRaw('Keep {role} as a colour role', { role: choice.label }))}"></label>
      <span class="crt-pair ds-role-pair" aria-hidden="true">${swatch}</span>
      <span class="ds-role-names">
        <input type="text" class="field-input" data-role-label="${esc(row.id)}" value="${label}" maxlength="80" dir="auto" autocomplete="off" spellcheck="false"${choice.keep ? '' : ' disabled'} aria-label="${esc(tRaw('Name of the colour role {role}', { role: choice.label }))}">
        <input type="text" class="field-input ds-role-about" data-role-about="${esc(row.id)}" value="${esc(choice.description)}" maxlength="600" dir="auto" autocomplete="off" placeholder="${esc(t('What is it for?'))}"${choice.keep ? '' : ' disabled'} aria-label="${esc(tRaw('What {role} is for', { role: choice.label }))}">
        <code class="ds-role-path" title="${esc(row.path)}">${esc(row.path)}</code>
      </span>
    </div>
    <div class="ds-role-reading" role="cell">
      <span class="ds-role-head" aria-hidden="true">${esc(t('Lolly reads this as'))}</span>
      ${picker}
      <p class="lp-help" data-role-line="${esc(row.id)}">${esc(lineFor(choice.reads))}</p>
    </div>
  </div>`;
}

/** The review's markup. Empty with nothing to review, so a file with no words shows no new step. */
export function colourRoleReviewHtml(proposal: ColourRoleProposal, choices: readonly ColourRoleChoice[]): string {
  if (!proposal.rows.length) return '';
  return `<div class="ds-role-review" data-colour-role-review>
    <p class="ds-roles-q">${esc(t('This file has its own words for its colours'))}</p>
    <p class="start-import-stats">${esc(t('Lolly suggests a role for each word from the words alone. Check them here: nothing changes until you apply.'))}</p>
    <div class="ds-role-table" role="table" aria-label="${esc(t('Colour roles'))}">${headRow()}${choices.map(choice => rowHtml(proposal, choice)).join('')}</div>
    ${proposal.left ? `<p class="start-import-stats">${esc(tRaw('{n} more words stay in the file as named colours.', { n: proposal.left }))}</p>` : ''}
    <p class="start-import-warn" data-role-needs-lead${reviewHasLead(proposal, choices) ? ' hidden' : ''}>${esc(t('Choose one to read as the lead colour, so tools have a colour to lead with.'))}</p>
  </div>`;
}

export interface ColourRoleReview {
  /** The rows as the person has left them. */
  choices(): ColourRoleChoice[];
}

/**
 * Wire the markup inside `root`. `onChange` fires after every edit, so a caller can repaint
 * a preview or enable its button. Listens on `root` alone, which is replaced with its
 * contents, so nothing outlives the card.
 */
export function wireColourRoleReview(root: HTMLElement, proposal: ColourRoleProposal, onChange: (choices: ColourRoleChoice[]) => void): ColourRoleReview {
  let choices = initialChoices(proposal);
  const repaint = (): void => {
    for (const choice of choices) {
      const row = root.querySelector<HTMLElement>(`[data-role-row="${CSS.escape(choice.id)}"]`);
      if (!row) continue;
      row.classList.toggle('is-off', !choice.keep);
      row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-role-label],[data-role-about],[data-role-reads]').forEach((el) => { el.disabled = !choice.keep; });
      const select = row.querySelector<HTMLSelectElement>('[data-role-reads]');
      if (select) select.value = choice.reads ?? '';
      const line = row.querySelector<HTMLElement>('[data-role-line]');
      if (line) line.textContent = lineFor(choice.reads);
    }
    const needs = root.querySelector<HTMLElement>('[data-role-needs-lead]');
    if (needs) needs.hidden = reviewHasLead(proposal, choices);
    onChange(choices);
  };
  root.addEventListener('input', (event) => {
    const el = event.target as HTMLInputElement;
    const id = el.dataset.roleLabel ?? el.dataset.roleAbout;
    if (id === undefined) return;
    const field = el.dataset.roleLabel !== undefined ? 'label' : 'description';
    choices = choices.map(choice => (choice.id === id ? { ...choice, [field]: el.value } : choice));
    onChange(choices);
  });
  root.addEventListener('change', (event) => {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    if (el.dataset.roleKeep !== undefined) {
      const id = el.dataset.roleKeep;
      choices = choices.map(choice => (choice.id === id ? { ...choice, keep: (el as HTMLInputElement).checked } : choice));
      repaint();
    } else if (el.dataset.roleReads !== undefined) {
      const id = el.dataset.roleReads;
      choices = chooseReading(choices, id, (el.value || null) as ColourRoleReading | null);
      repaint();
    }
  });
  return { choices: () => choices };
}

/**
 * What a file that states its own roles says, shown as written: its words, in its order,
 * and what Lolly reads each as. Empty for a file that declares none. Nothing here is a
 * suggestion, so nothing here is a control: the words are edited after the file is in,
 * in Colours.
 */
export function declaredRolesHtml(doc: unknown): string {
  let reading: ReturnType<typeof readColourRoles>;
  try { reading = readColourRoles(doc); } catch { return ''; }
  const roles = reading.roles.filter(role => role.declared);
  if (!roles.length) return '';
  const rows = roles.map((role) => {
    const slots = role.slots.filter((slot): slot is ColourRoleReading => (READINGS as readonly string[]).includes(slot));
    const reads = slots.length ? slots.map(slotWord).join(', ') : byNameWord();
    return `<div class="ds-role-row" role="row">
      <div class="ds-role-word" role="rowheader"><span class="ds-role-names"><strong dir="auto">${esc(role.label)}</strong>${role.description ? `<span class="lp-help" dir="auto">${esc(role.description)}</span>` : ''}</span></div>
      <div class="ds-role-reading" role="cell"><span class="ds-role-head" aria-hidden="true">${esc(t('Lolly reads this as'))}</span><span class="ds-role-fixed">${esc(reads)}</span></div>
    </div>`;
  }).join('');
  return `<div class="ds-role-review" data-colour-roles-declared>
    <p class="ds-roles-q">${esc(t('This file states its colour roles'))}</p>
    <p class="start-import-stats">${esc(t('They come in as written. You can change the words and readings in Colours.'))}</p>
    <div class="ds-role-table" role="table" aria-label="${esc(t('Colour roles'))}">${headRow()}${rows}</div>
  </div>`;
}
