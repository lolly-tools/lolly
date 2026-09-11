// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mp4BeforeWebm,
  packageFormatChoice,
  packageOptionsHtml,
} from './export-package-options.ts';

test('package formats are added only when a useful inner render exists', () => {
  assert.deepEqual(packageFormatChoice(['svg', 'png']), {
    formats: ['svg', 'png', 'rpm', 'tar.gz'],
    innerFormat: 'svg',
    enabled: true,
  });
  assert.deepEqual(packageFormatChoice(['mp4']), {
    formats: ['mp4'],
    innerFormat: '',
    enabled: false,
  });
});

test('MP4 precedes WebM without disturbing the other formats', () => {
  assert.deepEqual(mp4BeforeWebm(['svg', 'webm', 'png', 'mp4']), ['svg', 'mp4', 'webm', 'png']);
});

test('package metadata uses the shared field components', () => {
  const html = packageOptionsHtml(true, 'rpm', 'design');

  assert.match(html, /class="section-card export-pkg"/);
  assert.equal((html.match(/class="field-row/g) ?? []).length, 4);
  assert.equal((html.match(/class="field-label"/g) ?? []).length, 4);
  assert.equal((html.match(/class="field-input field-input--mono"/g) ?? []).length, 4);
  assert.match(html, /class="export-pkg-grid"/);
  assert.match(html, /class="section-card__hint"/);
  assert.doesNotMatch(html, /style="[^"]*(?:width|gap|flex-direction)/);
});

test('package metadata is absent when package export is unavailable', () => {
  assert.equal(packageOptionsHtml(false, 'png', 'design'), '');
});
