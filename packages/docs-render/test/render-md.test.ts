// SPDX-License-Identifier: MPL-2.0
// Golden + structural coverage for the shared markdown renderer entry point,
// mdToHtml (packages/docs-render/src/render.ts, re-exported from src/index.ts).
// The static /info build and the in-app docs view both render through this one
// function, so pinning its output guards both consumers against drift.
// Run: node --test packages/docs-render/test/render-md.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mdToHtml, type CredentialFacts, type DocsRenderContext } from '../src/index.ts';

// The same minimal in-memory context the M0b seam test uses (context.test.ts): every
// impure hook is a no-op so the pure block/inline pass is what the golden measures. t is
// the identity fallback, matching an untranslated English render.
function mockContext(overrides: Partial<DocsRenderContext> = {}): DocsRenderContext {
  let seq = 0;
  return {
    lang: 'en',
    htmlLang: 'en',
    t: (en) => en,
    docIcon: () => '',
    docLogo: () => '',
    docLogoBlock: () => '',
    nextCredId: () => `shot-cred-${++seq}`,
    localizedShot: () => null,
    darkShot: () => null,
    shotSize: () => null,
    credential: () => null,
    tryLink: () => null,
    showcase: () => null,
    art: () => null,
    ...overrides,
  };
}

test('a minimal document renders to the exact golden string', () => {
  const ctx = mockContext();
  const html = mdToHtml('# Hi\n\nA **bold** word.', ctx);
  // A true golden: heading id derived from the text, bold wrapped, joined by a newline.
  assert.equal(html, '<h1 id="hi">Hi</h1>\n<p>A <strong>bold</strong> word.</p>');
});

test('a fuller document emits every structural block', () => {
  const ctx = mockContext();
  const md = [
    '## Heading Two',
    '',
    'A paragraph with **bold** and *em* and an inline [link](https://example.com).',
    '',
    '- one',
    '- two',
    '',
    '1. first',
    '2. second',
    '',
    '| a | b |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '```js',
    'const x = 1;',
    '```',
    '',
    '> a quote line',
  ].join('\n');
  const html = mdToHtml(md, ctx);

  // Headings: an h2 carrying a stamped id.
  assert.match(html, /<h2 id="heading-two">Heading Two<\/h2>/);

  // Inline emphasis inside the paragraph.
  assert.ok(html.includes('<strong>bold</strong>'), 'bold -> <strong>');
  assert.ok(html.includes('<em>em</em>'), 'em -> <em>');

  // An external link opens in a new tab (target + rel), the label preserved.
  assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener">link<\/a>/);

  // Bullet + ordered lists.
  assert.match(html, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
  assert.match(html, /<ol>\n<li>first<\/li>\n<li>second<\/li>\n<\/ol>/);

  // A table inside the scroll wrapper, header cells in a thead, body cells in a tbody.
  assert.ok(html.includes('<div class="table-wrap"><table>'), 'table gets the scroll wrapper');
  assert.match(html, /<thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody>/);

  // A fenced code block, language stamped onto the <code>, content escaped/verbatim.
  assert.match(html, /<pre><code class="language-js">const x = 1;<\/code><\/pre>/);

  // A blockquote wraps its joined lines in a paragraph.
  assert.match(html, /<blockquote><p>a quote line<\/p><\/blockquote>/);
});

test('an internal (relative) link stays a same-tab link', () => {
  const ctx = mockContext();
  const html = mdToHtml('See the [guide](/info/quickstart.html).', ctx);
  // No target/rel for a non-http link - it must not open a new tab.
  assert.match(html, /<a href="\/info\/quickstart\.html">guide<\/a>/);
  assert.ok(!/target="_blank"/.test(html), 'internal links are not new-tab links');
});

test('markup metacharacters in prose are HTML-escaped', () => {
  const ctx = mockContext();
  const html = mdToHtml('Compare a < b && c > d in code.', ctx);
  // esc rewrites & < > (and only those) so the paragraph is safe to inject.
  assert.ok(html.includes('a &lt; b &amp;&amp; c &gt; d'), 'angle brackets and ampersands escaped');
});

test('diagram actions link to the served credential and the editable recipe', () => {
  const src = '/info/diagrams/document-model/example.svg';
  const facts: CredentialFacts = {
    signer: null, generator: 'Lolly', when: null, dimensions: null, ai: undefined,
    model: null, oversight: null, anat: null, recipe: null, src, canCopySource: true,
  };
  const html = mdToHtml(`![A diagram](${src})`, mockContext({
    docIcon: key => `<svg data-icon="${key}"></svg>`,
    shotSize: () => ({ w: 640, h: 400 }),
    credential: (file, opts) => {
      assert.equal(file, 'diagrams/document-model/example.svg');
      assert.equal(opts?.assetSrc, src);
      return facts;
    },
    tryLink: () => ({ route: '/#/tool/diagram-builder?source=text&dsl=A+-%3E+B' }),
  }));
  assert.match(html, /width="640" height="400"/);
  assert.ok(html.includes(`href="/#/verify?src=${encodeURIComponent(src)}"`));
  assert.match(html, /aria-label="Verify this diagram"/);
  assert.match(html, /data-icon="imprint"/);
  assert.match(html, /source=text&amp;dsl=A\+-%3E\+B/);
  assert.match(html, />Open this in Diagram Builder<\/a>/);
});

test('a diagram with no credential has no verify mark, even when it has a recipe', () => {
  const html = mdToHtml('![Diagram](/info/diagrams/example.svg)', mockContext({
    tryLink: () => ({ route: '/#/tool/diagram-builder' }),
  }));
  assert.ok(html.includes('Open this in Diagram Builder'));
  assert.ok(!html.includes('diagram-verify'));
  assert.equal(mdToHtml('![Diagram](/info/diagrams/example.svg)', mockContext()),
    '<p><img src="/info/diagrams/example.svg" alt="Diagram" loading="lazy"></p>');
});
