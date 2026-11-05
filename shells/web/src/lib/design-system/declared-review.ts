// SPDX-License-Identifier: MPL-2.0
/**
 * The parts of the Try these colours review that only a declaring source has: the
 * words it came with, what could not be taken as written, and the publisher's usage
 * statement. All of it is someone else's text, so it is set with `textContent` and
 * goes no further than this card unless the person keeps the words.
 */
import { t, tRaw } from '../../i18n.ts';
import type { DeclaredDraftSkill, DeclaredRead, DeclaredSource } from './sources/declared.ts';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Why a source could not be read, in one sentence. */
export function declaredRefusal(read: Extract<DeclaredRead, { ok: false }>, label: string): string {
  switch (read.reason) {
    case 'too-large': return tRaw('{filename} is too large to read.', { filename: label });
    case 'not-a-page': return tRaw('{filename} has no brand.json, so it is not a brand page folder.', { filename: label });
    case 'digest': return tRaw('A file in {filename} does not match its record in brand.json, so nothing was read: {file}', { filename: label, file: read.detail ?? '' });
    case 'unsafe-path': return tRaw('{filename} lists a file outside its own folder, so nothing was read.', { filename: label });
    case 'no-tokens': return tRaw('{filename} states no tokens Lolly can read.', { filename: label });
    default: return tRaw('{filename} could not be read as a DESIGN.md: {reason}', { filename: label, reason: read.detail ?? '' });
  }
}

export interface DeclaredReviewNodes {
  /** Beside the Apply button: the choice to keep the words. */
  controls: HTMLElement[];
  /** Inside the card's details. */
  details: HTMLElement[];
  /** The draft to keep, when the person left the tick on. */
  keepDraft(): DeclaredDraftSkill | null;
}

export function declaredReviewNodes(source: DeclaredSource, asWritten: boolean): DeclaredReviewNodes {
  const controls: HTMLElement[] = [];
  const details: HTMLElement[] = [];
  if (!asWritten) controls.push(node('p', 'ds-src-stage-note', t('This source does not say which colour is main, background or text, so choose one here.')));
  if (source.files.logos || source.files.fonts) {
    controls.push(node('p', 'ds-src-stage-note', t('Logos and fonts stay in the folder. This adds its tokens.')));
  }

  let box: HTMLInputElement | null = null;
  const draft = source.draftSkill;
  if (draft) {
    const wrap = node('div', 'ds-declared-keep');
    const label = node('label', 'field-toggle');
    box = node('input', 'field-check');
    box.type = 'checkbox';
    box.checked = true;
    box.dataset.declaredKeep = '';
    label.append(box, node('span', '', t('Keep this source’s words as a draft brand skill')));
    const read = node('details', 'ds-reference-details');
    read.append(node('summary', '', t('Read the words first')));
    read.append(node('p', 'ds-src-stage-note', t('Someone else wrote these. A draft stays internal until you change that.')));
    read.append(node('pre', 'ds-declared-prose', source.prose));
    wrap.append(label, read);
    controls.push(wrap);
  }

  if (source.usage) {
    details.push(node('p', 'ds-src-stage-note', t('The publisher’s own words on usage:')));
    if (source.usage.statement) details.push(node('p', 'ds-declared-usage', source.usage.statement));
    if (source.usage.contact) details.push(node('p', 'ds-declared-usage', tRaw('Contact: {contact}', { contact: source.usage.contact })));
  }
  if (source.findings.length) {
    details.push(node('p', 'ds-src-stage-note', t('What could not be taken as written:')));
    const list = node('ul', '');
    for (const finding of source.findings.slice(0, 40)) list.append(node('li', '', finding));
    details.push(list);
  }
  return { controls, details, keepDraft: () => (box?.checked && draft ? draft : null) };
}
