// SPDX-License-Identifier: MPL-2.0
/**
 * Keep encoded-string refusal cases separate from unrelated SVG and evaluation
 * fixtures. Combining them in one source file triggered ClamAV's SVG-phishing
 * signature during OBS source scans. The literal inputs and assertions remain
 * intact; these strings are inspected by the lint, never executed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintArtSource, normalizeForLint, ART_BUDGETS } from '../scripts/sign-docs-art.ts';
import { C2PA_FRAGMENT_PROFILE } from '../engine/src/c2pa-containers.ts';

test('lint: obfuscation the normalizer undoes, and the global aliases it cannot', () => {
  // `window['fe'+'tch']` was refused three ways; `String.fromCharCode(...)` plus
  // `document.defaultView` - the same call, one layer further out - signed clean.
  const src = '<div class=a2></div>\n<script>\n(function () {\n'
    + '  var w = document.defaultView;\n'
    + '  var n = String.fromCharCode(102, 101, 116, 99, 104);\n'
    + '  w[n](\'/log?d=\' + document.title);\n})();\n</script>\n';
  const v = lintArtSource(src, {
    file: 'x', kind: 'masthead', format: C2PA_FRAGMENT_PROFILE.format, budget: ART_BUDGETS.masthead,
  });
  const rules = new Set(v.map((violation) => violation.rule));
  assert.ok(rules.has('network'), 'the char-code fetch is decoded and refused');
  assert.ok(rules.has('dynamic-code'), 'and the window alias is a violation in its own right');
  assert.equal(normalizeForLint('String.fromCharCode(102,101,116,99,104)'), 'fetch');
  assert.equal(normalizeForLint('String.fromCodePoint(0x66)'), 'String.fromCodePoint(0x66)', 'only literal decimals are decoded - nothing is guessed');
});
