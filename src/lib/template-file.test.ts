// SPDX-License-Identifier: MPL-2.0
/** lib/template-file.ts - a user template in the shipped file shape. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { templateFileFromUserTemplate, templateFileJson, templateFileName, templateFileSlug } from './template-file.ts';
import type { UserTemplate } from './user-templates.ts';

test('templateFileSlug: filename-safe ids, accents folded, never empty', () => {
  assert.equal(templateFileSlug('Quarterly Poster'), 'quarterly-poster');
  assert.equal(templateFileSlug('  Café  Menu -- v2!! '), 'cafe-menu-v2');
  assert.equal(templateFileSlug('___'), 'template');
  assert.equal(templateFileSlug(''), 'template');
  assert.equal(templateFileSlug('x'.repeat(100)).length, 64);
  assert.match(templateFileSlug('Trailing-'), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('templateFileFromUserTemplate: id == slug, description only when set, values verbatim', () => {
  const tpl: UserTemplate = {
    id: 'u1', toolId: 'qr-code', name: 'Wi-Fi card', values: { url: 'x', __export_format: 'svg' },
    createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z',
  };
  assert.deepEqual(templateFileFromUserTemplate(tpl), { id: 'wi-fi-card', name: 'Wi-Fi card', values: { url: 'x', __export_format: 'svg' } });
  assert.deepEqual(templateFileFromUserTemplate({ ...tpl, description: 'For the office' }).description, 'For the office');
  assert.equal(templateFileName(tpl), 'qr-code-wi-fi-card.json');
  const json = templateFileJson(tpl);
  assert.ok(json.endsWith('\n'));
  assert.equal(JSON.parse(json).id, 'wi-fi-card');
});
