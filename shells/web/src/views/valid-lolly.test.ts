// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lollyBlockHtml } from './valid-lolly.ts';

const base = { madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false };

test('no block for a file that records no Lolly export', () => {
  assert.equal(lollyBlockHtml({ ...base, environment: { tool: 'QR Code' } }), '');
});

test('the heading keeps the honest middle verdicts', () => {
  assert.match(lollyBlockHtml({ ...base, madeWithLolly: true }), /<span>Made with Lolly<\/span>/);
  assert.match(lollyBlockHtml({ ...base, likelyMadeWithLolly: true }), /<span>Likely made with Lolly<\/span>/);
  assert.match(lollyBlockHtml({ ...base, partsMadeWithLolly: true }), /<span>Parts made with Lolly<\/span>/);
});

test('a tool in this catalog links back to the tool, with the recorded version', () => {
  const html = lollyBlockHtml({ ...base, madeWithLolly: true, environment: { tool: 'QR Code', toolVersion: '2.4.0' } }, { tool: { toolId: 'qr-code', toolName: 'QR Code' } });
  assert.match(html, /href="#\/tool\/qr-code"/);
  assert.match(html, /2\.4\.0/);
  assert.doesNotMatch(html, /Not in this catalogue/);
});

test('a tool that is not in this catalog is named and offers the gallery', () => {
  const html = lollyBlockHtml({ ...base, madeWithLolly: true, environment: { tool: 'Event Banner' } });
  assert.match(html, /Event Banner/);
  assert.match(html, /Not in this catalogue\./);
  assert.match(html, /href="#\/tools"/);
});

test('rows appear only for what the record holds, and features link to their docs pages', () => {
  const bare = lollyBlockHtml({ ...base, madeWithLolly: true });
  assert.doesNotMatch(bare, /<dl/);
  assert.doesNotMatch(bare, /Lolly Imprint/);
  assert.match(bare, /what-verify-checks\.html/);
  const full = lollyBlockHtml({ ...base, madeWithLolly: true, ingredients: [{ rights: { license: 'CC-BY-4.0' } }, { rights: { license: 'OFL-1.1' } }, {}] }, { imprint: true });
  assert.match(full, /Lolly Imprint read from the pixels/);
  assert.match(full, /Credits for 2 sources/);
  assert.match(full, /creative-rights\.html/);
});

test('what a credential records is escaped', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const html = lollyBlockHtml({ ...base, madeWithLolly: true, environment: { tool: hostile, toolVersion: hostile } });
  assert.doesNotMatch(html, /<img/);
});
