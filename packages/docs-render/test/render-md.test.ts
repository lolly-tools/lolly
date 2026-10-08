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
  assert.match(html, /<div class="doc-code" data-label="JavaScript" data-copy=""><div class="doc-code-bar" data-label="JavaScript"><\/div><pre tabindex="0" role="group" aria-label="JavaScript"><code class="language-js">const x = 1;<\/code><\/pre><\/div>/);

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

test('a GitHub-style same-page anchor resolves to the heading id this renderer emits', () => {
  const ctx = mockContext();
  // GitHub slugs "Licensing & structure" as licensing--structure; headingId collapses
  // hyphen runs, so the README link has to arrive as #licensing-structure on /info.
  const html = mdToHtml('See [Licensing & structure](#licensing--structure).\n\n## Licensing & structure', ctx);
  assert.match(html, /<a href="#licensing-structure">/);
  assert.match(html, /<h2 id="licensing-structure"/);
  // Only same-page anchors change: a path keeps its hyphens.
  assert.match(mdToHtml('[x](/info/a--b.html#c--d)', ctx), /href="\/info\/a--b\.html#c--d"/);
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

test('a diagram with a dark twin ships both files, each with its own size', () => {
  const html = mdToHtml('![Diagram](/info/diagrams/set/example.svg)', mockContext({
    tryLink: () => ({ route: '/#/tool/diagram-builder' }),
    shotSize: file => (file.endsWith('.dark.svg') ? { w: 500, h: 300 } : { w: 640, h: 400 }),
    diagramDark: file => file.replace(/\.svg$/, '.dark.svg'),
  }));
  assert.match(html, /class="docs-diagram docs-diagram--dual"><img src="\/info\/diagrams\/set\/example\.svg" width="640" height="400"/);
  assert.match(html, /<img class="diagram-alt" src="\/info\/diagrams\/set\/example\.dark\.svg" width="500" height="300" alt="Diagram"/);
  const plain = mdToHtml('![Diagram](/info/diagrams/set/example.svg)', mockContext({ tryLink: () => ({ route: '/#/tool/diagram-builder' }) }));
  assert.ok(!plain.includes('diagram-alt') && !plain.includes('docs-diagram--dual'), 'no twin, no second image');
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

test('a code sample set in under a list item renders as code inside that item', () => {
  const ctx = mockContext();
  const md = '- Use the CLI:\n\n  ```bash\n  pnpm run cli qr-code \\\n    --export=svg\n  ```\n\n- Next item';
  const html = mdToHtml(md, ctx);
  // The item's own indent comes off; the continuation keeps its relative indent, byte for byte.
  assert.match(html, /<li>Use the CLI:<div class="doc-code" data-label="Terminal" data-copy="shell"><div class="doc-code-bar" data-label="Terminal"><\/div><pre tabindex="0" role="group" aria-label="Terminal"><code class="language-bash">pnpm run cli qr-code \\\n {2}--export=svg<\/code><\/pre><\/div><\/li>/);
  assert.ok(!/``<code>/.test(html), 'the fence is no longer read as inline code in a paragraph');
});

test('a numbered list that resumes after a code sample keeps its number', () => {
  const ctx = mockContext();
  const html = mdToHtml('1. Generate the root:\n\n   ```bash\n   make root\n   ```\n\n2. Sign the leaf.', ctx);
  assert.match(html, /<ol>\n<li>Generate the root:<div class="doc-code"[^>]*><div class="doc-code-bar"[^>]*><\/div><pre[^>]*><code class="language-bash">make root<\/code><\/pre><\/div><\/li>\n<\/ol>/);
  assert.match(html, /<ol start="2">\n<li>Sign the leaf\.<\/li>/);
});

test('an unindented fence still closes only at an unindented fence line', () => {
  const ctx = mockContext();
  const html = mdToHtml('```md\n- item\n  ```js\n  x\n  ```\n```', ctx);
  assert.match(html, /<pre tabindex="0" role="group" aria-label="Markdown"><code class="language-md">- item\n {2}```js\n {2}x\n {2}```<\/code><\/pre>/);
});

test('a code block carries its label as data only, so the page text is unchanged', () => {
  const ctx = mockContext();
  const html = mdToHtml('```bash\npnpm install\n```\n\n```text\noutput line\n```\n\n```bash no-copy wrap\nlong line\n```', ctx);
  assert.match(html, /<div class="doc-code" data-label="Terminal" data-copy="shell"><div class="doc-code-bar" data-label="Terminal"><\/div>/);
  assert.match(html, /<div class="doc-code" data-label="Text"><div class="doc-code-bar"/, 'plain text is read, not copied');
  assert.match(html, /<div class="doc-code" data-label="Terminal" data-wrap="">/, 'no-copy drops Copy; wrap is carried');
  // Stripping tags leaves exactly the code: the bar adds no words to search or the model index.
  assert.equal(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), 'pnpm install output line long line');
});

test('a narrate-skip fence keeps its bare element for the page that sets it as an inscription', () => {
  const html = mdToHtml('```narrate-skip\nWords\n```', mockContext());
  assert.equal(html, '<pre><code class="language-narrate-skip">Words</code></pre>');
});

test('a wrapping block holds each argument together, so a flag never splits after its hyphens', () => {
  const html = mdToHtml('```bash wrap\npnpm run cli qr-code --url=https://example.com --output=qr.svg\n```', mockContext());
  assert.match(html, /<span class="doc-code-token">--url=https:\/\/example\.com<\/span> <span class="doc-code-token">--output=qr\.svg<\/span>/);
  assert.equal(html.replace(/<[^>]+>/g, ''), 'pnpm run cli qr-code --url=https://example.com --output=qr.svg', 'the text is unchanged');
});

test('an unlabelled fence reads as plain text: labelled Code, no Copy', () => {
  const html = mdToHtml('```\nsrc/\n  index.ts\n```', mockContext());
  assert.match(html, /<div class="doc-code" data-label="Code"><div class="doc-code-bar"/);
  assert.ok(!/data-copy/.test(html));
});
