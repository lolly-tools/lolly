// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { LOLLY_MARK_SVG } from './lolly-mark.ts';

test('both authored logo variants survive HTML insertion with gradients and spin layers intact', () => {
  const doc = new JSDOM(`<body>${LOLLY_MARK_SVG}</body>`).window.document;
  assert.equal(doc.querySelectorAll('svg').length, 1);
  assert.equal(doc.querySelector('style, metadata, script'), null);
  const ids = new Set([...doc.querySelectorAll('[id]')].map(el => el.id));
  assert.equal(ids.size, doc.querySelectorAll('[id]').length, 'variant IDs cannot collide');
  for (const name of ['primary', 'reverse']) {
    const variant = doc.querySelector(`.lolly-mark__${name}`)!;
    assert.ok(variant.querySelectorAll('path').length > 10, 'artwork must not be swallowed by a style element');
    assert.equal(variant.querySelectorAll('[class^="lolly-mark__spin-"]').length, 3);
    assert.ok(variant.querySelectorAll('radialGradient, linearGradient').length > 10);
    for (const el of variant.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) {
        for (const match of attr.value.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(match[1]!), `missing paint ${match[1]}`);
        if (attr.name === 'href') assert.ok(ids.has(attr.value.slice(1)), `missing gradient ${attr.value}`);
      }
    }
  }
  for (const [name, blend] of [['primary', 'multiply'], ['reverse', 'screen']]) {
    const spiral = [...doc.querySelectorAll(`.lolly-mark__${name} path`)].find(el => el.getAttribute('fill')?.startsWith('var('));
    assert.ok(spiral);
    assert.ok(spiral.getAttribute('style')?.includes(blend!));
  }
});
