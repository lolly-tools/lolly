// SPDX-License-Identifier: MPL-2.0
/**
 * The UI-copy vernacular ratchet: t()/tRaw() literals in the web shell and the
 * copy fields of every tool manifest carry no NEW em dashes or claudism
 * phrases; a per-file baseline only goes down (scripts/check-ui-copy-vernacular.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drift, uiLiterals, manifestCopy } from '../scripts/check-ui-copy-vernacular.ts';

test('the literal extractors read what a person sees', () => {
  assert.deepEqual(uiLiterals(`x(t('Save'), tRaw("It\\'s {n}"), t('Search the catalogue…'))`), ['Save', "It's {n}", 'Search the catalogue…']);
  assert.deepEqual(manifestCopy({ name: 'QR', inputs: [{ id: 'a', label: 'URL', help: 'Paste', options: [{ value: 'x', label: 'Ex' }] }], tags: ['not copy'] }), ['QR', 'URL', 'Paste', 'Ex']);
});

test('ui copy carries no new em dashes or claudism phrases (ratchet only goes down)', () => {
  const d = drift();
  const lines = [
    ...d.over.map(x => `${x.file}: rose ${x.was} → ${x.now}`),
    ...d.fresh.map(x => `${x.file}: new file with ${x.now} finding(s)`),
    ...d.under.map(x => `${x.file}: improved ${x.was} → ${x.now} (run --write to lock)`),
  ];
  assert.deepEqual(lines, [], 'ui-copy vernacular ratchet drifted - see scripts/check-ui-copy-vernacular.ts');
});
