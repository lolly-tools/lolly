// SPDX-License-Identifier: MPL-2.0
/** The Inspector's plain labelled rows: pure markup builders with no column state, so the column's own function stays small. */
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { opt } from './free-canvas-fields.ts';

export const textRow = (label: string, field: string, value: unknown, placeholder = ''): string =>
  `<label class="fc-row fc-insp-text"><span>${label}</span>`
  + `<input type="text" class="field-input" data-fld="${escape(field)}" data-kind="str" spellcheck="false"`
  + ` autocomplete="off" value="${escape(String(value ?? ''))}" placeholder="${escape(placeholder)}"></label>`;

export const toggleRow = (label: string, field: string, on: boolean): string =>
  `<label class="fc-row fc-row-toggle field-toggle"><span>${label}</span>`
  + `<input type="checkbox" class="field-check" data-fld="${escape(field)}" data-kind="bool"${on ? ' checked' : ''}></label>`;

export const selectRow = (label: string, field: string, choices: Array<[string, string]>, cur: unknown, mixed = false): string =>
  `<label class="fc-row"><span>${label}</span>`
  + `<select class="field-select field-select--sm" data-fld="${escape(field)}" data-kind="str">`
  + (mixed ? `<option value="" disabled selected>${t('Mixed')}</option>` : '')
  + choices.map(([v, l]) => opt(v, l, mixed ? null : cur)).join('') + '</select></label>';

export const readRow = (label: string, value: string): string =>
  `<div class="fc-row fc-insp-read"><span>${label}</span><b>${escape(value)}</b></div>`;

export const areaRow = (label: string, field: string, value: unknown, placeholder = ''): string =>
  `<label class="fc-insp-area"><span>${label}</span>`
  + `<textarea class="field-input" rows="4" data-fld="${escape(field)}" data-kind="str"`
  + ` placeholder="${escape(placeholder)}">${escape(String(value ?? ''))}</textarea></label>`;
