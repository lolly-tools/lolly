// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { LearningTarget } from '@lolly-tools/core/learning-v1';
import { newLearningModule } from '../../../../../engine/src/learning/module.ts';
import { destinationTarget, exportMarkup, presetNotice } from './shared.ts';

const view = (step: number, destination: string, target: LearningTarget) =>
  new JSDOM(
    `<div>${exportMarkup({
      module: newLearningModule('course-1', 'Product introduction'),
      target,
      destination,
      maxMB: 0,
      step,
      active: false,
      checking: false,
      saving: false,
      saved: false,
      original: false,
      ready: true,
      bytes: 1000,
      note: '',
      message: '',
      tone: 'info',
    })}</div>`
  ).window.document;

test('the destination step offers a searchable LMS list with Other LMS', () => {
  const doc = view(0, '', 'scorm12');
  const input = doc.querySelector<HTMLInputElement>('[data-delivery-name]')!;
  const list = doc.getElementById(input.getAttribute('list')!)!;
  const names = [...list.querySelectorAll('option')].map((o) => o.getAttribute('value'));
  assert.ok(names.includes('Litmos'));
  assert.ok(names.includes('Moodle'));
  assert.deepEqual(names.slice(-2), ['Website', 'Other LMS']);
  assert.equal(input.closest('label')!.textContent!.trim(), 'LMS or website');
  // The exact standard stays available beside the LMS choice.
  const select = doc.querySelector<HTMLSelectElement>('[data-delivery-target]')!;
  assert.equal(select.closest('label')!.firstChild!.textContent, 'Delivery format');
  assert.equal(select.value, 'scorm12');
});

test('no built-in LMS choice shows Tested without evidence', () => {
  for (const [name, target] of [
    ['', 'scorm12'],
    ['Other LMS', 'scorm12'],
    ['Litmos', 'scorm12'],
    ['Moodle', 'scorm12'],
    ['Moodle', 'scorm2004'],
    ['Website', 'static'],
    ['An unlisted LMS', 'cmi5'],
  ] as const) {
    const doc = view(0, name, target);
    const box = doc.querySelector<HTMLElement>('[data-delivery-preset]')!;
    assert.equal(box.dataset.tone, 'info', name);
    assert.equal(doc.querySelector('[data-delivery-preset-label]')!.textContent, 'Standard target');
    assert.equal(
      doc.querySelector('[data-delivery-preset-detail]')!.textContent,
      target === 'static' ? 'This website has not been tested.' : 'This LMS has not been tested.'
    );
    assert.doesNotMatch(doc.body.textContent!, /\bTested\b/);
  }
});

test('the in-place notice matches the rendered one', () => {
  const doc = view(0, 'Moodle', 'scorm12');
  const notice = presetNotice('Moodle', 'scorm12');
  assert.equal(notice.preset.id, 'moodle-scorm12');
  assert.equal(doc.querySelector('[data-delivery-format]')!.textContent, notice.format);
  assert.equal(
    doc.querySelector<HTMLInputElement>('[data-delivery-limit]')!.placeholder,
    notice.limit
  );
  assert.equal(notice.limit, 'No limit supplied');
});

test('a name that matches a preset only part way gives the starting format back', () => {
  for (const [typed, start, prefix, midway] of [
    ['Moodle Workplace', 'scorm2004', 'Moodle', 'scorm12'],
    ['Website builder', 'scorm12', 'Website', 'static'],
  ] as const) {
    const doc = view(0, '', start);
    const root = doc.body.firstElementChild as HTMLElement;
    const input = doc.querySelector<HTMLInputElement>('[data-delivery-name]')!;
    const focus = (type: string) =>
      input.dispatchEvent(new doc.defaultView!.FocusEvent(type, { bubbles: true }));
    let target: LearningTarget = start;
    const resolve = destinationTarget(root, () => target);
    focus('focusin');
    const seen = new Map<string, LearningTarget>();
    // One resolution per keystroke, the way the input handler runs.
    for (let i = 1; i <= typed.length; i++) {
      target = resolve(typed.slice(0, i));
      seen.set(typed.slice(0, i), target);
    }
    assert.equal(seen.get(prefix), midway, `${prefix} selects its preset's format`);
    assert.equal(target, start, `${typed} keeps the format chosen before typing`);
    // The change event that follows the last keystroke resolves to the same format.
    focus('focusout');
    assert.equal(resolve(typed), start);
  }

  // A listed name still selects its preset, and the next edit starts from that format.
  const doc = view(0, '', 'scorm2004');
  const input = doc.querySelector<HTMLInputElement>('[data-delivery-name]')!;
  let target: LearningTarget = 'scorm2004';
  const resolve = destinationTarget(doc.body.firstElementChild as HTMLElement, () => target);
  input.dispatchEvent(new doc.defaultView!.FocusEvent('focusin', { bubbles: true }));
  for (const value of ['M', 'Mo', 'Moodle']) target = resolve(value);
  assert.equal(target, 'scorm12');
  input.dispatchEvent(new doc.defaultView!.FocusEvent('focusout', { bubbles: true }));
  input.dispatchEvent(new doc.defaultView!.FocusEvent('focusin', { bubbles: true }));
  assert.equal(resolve('Moodle Workplace'), 'scorm12');
});

test('review and handoff carry the preset status and its import instructions', () => {
  const review = view(1, 'Moodle', 'scorm12');
  const terms = [...review.querySelectorAll('dt')].map((dt) => dt.textContent);
  const compatibility = review.querySelectorAll('dd')[terms.indexOf('Compatibility')]!;
  assert.equal(compatibility.textContent, 'Standard target. This LMS has not been tested.');

  const handoff = view(2, 'Moodle', 'scorm12').querySelector('.learning-handoff')!;
  assert.equal(handoff.querySelector('h3')!.textContent, 'Import into Moodle');
  assert.match(handoff.textContent!, /add a SCORM package activity/);
  const link = handoff.querySelector<HTMLAnchorElement>('a')!;
  assert.equal(link.getAttribute('href'), 'https://docs.moodle.org/502/en/SCORM_FAQ');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(link.textContent, 'Moodle documentation');

  const generic = view(2, 'An unlisted LMS', 'scorm12').querySelector('.learning-handoff')!;
  assert.equal(generic.querySelector('h3')!.textContent, 'Import into your LMS');
  assert.equal(generic.querySelector('a'), null);
});
