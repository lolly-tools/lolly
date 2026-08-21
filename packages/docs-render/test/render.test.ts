// SPDX-License-Identifier: MPL-2.0
// Unit tests for the shared docs render layer. The static site's byte-identical
// build is the integration oracle; these pin the individual behaviours (and the
// landmines) so a future edit can't drift one consumer from the other.
// Run: node --test packages/docs-render/test/render.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc,
  stripFrontMatter,
  unwrapFigureFences,
  unwrapProvenanceMarkers,
  stripLogoMarkers,
  commentStandaloneProvenanceLines,
  mdDescription,
} from '../src/index.ts';

test('esc escapes ONLY & < > - never quotes (the 5-char escaper landmine)', () => {
  assert.equal(esc('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  // Quotes and apostrophes MUST pass through unchanged: a 5-char escaper would
  // re-encode every one and re-sign every C2PA page seal.
  assert.equal(esc(`"double" 'single'`), `"double" 'single'`);
  assert.equal(esc('<script>'), '&lt;script&gt;');
});

test('stripFrontMatter removes a leading YAML block, else passes through', () => {
  assert.equal(stripFrontMatter('---\ntitle: x\n---\nBody'), 'Body');
  assert.equal(stripFrontMatter('No front matter'), 'No front matter');
  // A `---` that is not a leading fence (a horizontal rule mid-doc) is untouched.
  assert.equal(stripFrontMatter('Intro\n\n---\n\nMore'), 'Intro\n\n---\n\nMore');
});

test('unwrapFigureFences collapses a figure fence to its caption, dropping the id', () => {
  assert.equal(
    unwrapFigureFences('::: figure trust-chain\nThe caption.\n:::\n').trim(),
    'The caption.',
  );
});

test('unwrapProvenanceMarkers strips one and nested pill markers', () => {
  assert.equal(unwrapProvenanceMarkers('%file{a.webp}'), 'a.webp');
  assert.equal(unwrapProvenanceMarkers('%sig{signed by %entity{Google LLC}}'), 'signed by Google LLC');
});

test('stripLogoMarkers removes inline and block technology marks', () => {
  assert.equal(stripLogoMarkers('Run <!--l:helm--> it'), 'Run  it');
  assert.equal(stripLogoMarkers('<!--lb:kubernetes helm-->\nNext'), 'Next');
});

test('commentStandaloneProvenanceLines HTML-comments a standalone credential line', () => {
  const out = commentStandaloneProvenanceLines('%file{a.webp} %entity{Lolly}');
  assert.equal(out, '<!-- a.webp Lolly -->');
  // An ordinary prose line is untouched.
  assert.equal(commentStandaloneProvenanceLines('Just prose.'), 'Just prose.');
});

test('mdDescription takes the first real body sentence, skipping chrome', () => {
  const md = '# Heading\n\n> a quote\n\nThe first real sentence here. And a second.';
  assert.equal(mdDescription(md), 'The first real sentence here.');
  // Comments are invisible (favourites.md multi-paragraph note regression).
  assert.equal(mdDescription('<!--\nnote\n\nsecond para\n-->\n\nReal sentence.'), 'Real sentence.');
});
