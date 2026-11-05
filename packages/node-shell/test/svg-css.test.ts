// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { materializeSvgVariables } from '../src/svg-css.ts';

test('native SVG variables inherit wrappers, respect local overrides and keep function fallbacks intact', () => {
  const dom = new JSDOM(
    '<div style="--brand-primary:#30ba78;--lead:var(--brand-primary)"><svg xmlns="http://www.w3.org/2000/svg"><rect id="inherited" fill="var(--lead)"/><g style="--brand-primary:#00d5e5"><rect id="local" fill="var(--brand-primary)"/></g><rect id="fallback" fill="var(--missing, rgb(1, 2, 3))"/><rect id="unresolved" fill="var(--unknown)"/><rect id="style" style="fill:var(--lead)"/></svg></div>'
  );
  try {
    const svg = dom.window.document.querySelector('svg')!;
    materializeSvgVariables(svg);
    assert.equal(svg.querySelector('#inherited')?.getAttribute('fill'), '#30ba78');
    assert.equal(svg.querySelector('#local')?.getAttribute('fill'), '#00d5e5');
    assert.equal(svg.querySelector('#fallback')?.getAttribute('fill'), 'rgb(1, 2, 3)');
    assert.equal(svg.querySelector('#unresolved')?.getAttribute('fill'), 'var(--unknown)');
    assert.ok(svg.querySelector('#style')?.getAttribute('style')?.includes('#30ba78'));
  } finally {
    dom.window.close();
  }
});
