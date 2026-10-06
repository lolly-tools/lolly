// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileWebCss, WEB_CSS_LIMIT } from './design-web-css.ts';

test('page CSS supports selectors, nested appearance rules and custom properties', () => {
  const source = '#banner { display: none !important; } @media (min-width: 600px) { body { --ink: red; color: var(--ink); } }';
  assert.match(compileWebCss(source), /#banner\{display:none!important\}/);
  assert.match(compileWebCss(source), /--ink:red;color:var\(--ink\)/);
  assert.equal(compileWebCss(''), '');
});

test('network and executable CSS never reaches a shared page', () => {
  for (const source of [
    '@import "https://x.test/css";', '@\\69mport "https://x.test/css";',
    '@font-face { font-family: x; src: local(x); }',
    'body { background: url(https://x.test/a); }',
    'body { background: u\\72l(https://x.test/a); }',
    'body { background: image-set("https://x.test/a" 1x); }',
    'body { --photo: url(https://x.test/a); }',
    'body { behavior: url(x); }', 'body { width: expression(alert(1)); }',
  ]) assert.throws(() => compileWebCss(source), source);
});

test('unfinished and excessive page rules are refused', () => {
  assert.throws(() => compileWebCss('h1 { color: ; }'));
  assert.throws(() => compileWebCss(' '.repeat(WEB_CSS_LIMIT + 1)), /16 KB/);
});
