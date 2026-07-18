/**
 * deck-builder "Style" section + extended markdown contract tests.
 *
 * Run with: node --test "tests/deck-builder-style.test.ts"  (or via npm test)
 * No test framework — node:test built-in.
 *
 * Loads the REAL community tool from disk and drives it through the engine, so these
 * guard the actual render of:
 *   • the two new markdown blocks — fenced code (``` … ```) and blockquotes (> …),
 *     in BOTH slide modes (layout sl-* classes / freeform bare tags);
 *   • the per-element size/weight overrides → `--ds-<el>-*` custom properties on the
 *     deck root (only non-default values emitted; a scale is a ratio, not a px size);
 *   • the raw-CSS escape hatch → a `.slides { … }`-wrapped <style>, with `</style>`
 *     and `@import` neutralised.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

const SKIP = !existsSync(join(TOOLS_DIR, 'deck-builder/tool.json'))
  && 'deck-builder tool view not built (run npm run profile)';

const tool: any = SKIP ? null : await loadTool('deck-builder', fetchFile);

function makeHost() {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id }) },
    log: () => {},
  } as any;
}

// initial state maps input id → value, so a whole deck AND top-level Style inputs can
// be seeded in one object.
async function mount(state: Record<string, unknown>) {
  const rt = await createRuntime(tool, makeHost(), state as never);
  return { rt, html: rt.getHydrated() as string };
}

// ── extended markdown: fenced code + blockquote ────────────────────────────────

test('layout body: fenced code block → <pre class="sl-pre"><code>, content literal', { skip: SKIP }, async () => {
  const content = [
    '# T',
    '',
    '```',
    '# not a heading',
    '- not a bullet',
    'a **not bold** b',
    '```',
    '',
    'after',
  ].join('\n');
  const { rt, html } = await mount({ deck: [{ content }] });
  assert.deepEqual(rt.hookErrors, [], 'no hook errors');
  assert.match(html, /<pre class="sl-pre"><code># not a heading\n- not a bullet\na \*\*not bold\*\* b<\/code><\/pre>/,
    'code content is literal — no heading/bullet/bold parsing inside the fence');
  // The paragraph after the closing fence still renders (fence closed correctly).
  assert.match(html, /<p class="sl-p">after<\/p>/);
});

test('SECURITY: html inside a fenced code block is escaped, never a live tag', { skip: SKIP }, async () => {
  const content = ['# T', '', '```', '<img src=x onerror=alert(1)>', '```'].join('\n');
  const { html } = await mount({ deck: [{ content }] });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/, 'escaped in the code block');
  assert.doesNotMatch(html, /<img src=x onerror/, 'no executable <img>');
});

test('layout body: blockquote → <blockquote class="sl-quote"> with inline md', { skip: SKIP }, async () => {
  const content = ['# T', '', '> a **bold** quote', '> second line', '', 'body'].join('\n');
  const { rt, html } = await mount({ deck: [{ content }] });
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /<blockquote class="sl-quote">a <strong>bold<\/strong> quote<br>second line<\/blockquote>/);
});

test('freeform box: same parser emits bare <pre>/<code> and <blockquote>', { skip: SKIP }, async () => {
  const boxes = [{
    kind: 'text', x: 100, y: 100, w: 900, h: 700,
    text: ['```', 'code line', '```', '', '> quoted'].join('\n'),
  }];
  const { rt, html } = await mount({ deck: [{ mode: 'freeform', boxes }] });
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /<pre><code>code line<\/code><\/pre>/, 'bare-tag code block');
  assert.match(html, /<blockquote>quoted<\/blockquote>/, 'bare-tag blockquote');
});

test('an unterminated code fence still renders (consumes to EOF, no throw)', { skip: SKIP }, async () => {
  const content = ['# T', '', '```', 'runaway', 'more'].join('\n');
  const { rt, html } = await mount({ deck: [{ content }] });
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /<pre class="sl-pre"><code>runaway\nmore<\/code><\/pre>/);
});

// ── per-element size / weight / font overrides → --ds-* custom properties ───────

test('an untouched deck emits NO --ds-* custom properties', { skip: SKIP }, async () => {
  const { html } = await mount({ deck: [{ content: '# T' }] });
  assert.doesNotMatch(html, /--ds-/, 'defaults stay unset so the deck computes as before');
});

test('an element is only emitted when its chip (<el>On) is on', { skip: SKIP }, async () => {
  // Values set but the chip is OFF → nothing applies (the chip is the on/off switch).
  const off = await mount({ deck: [{ content: '# T' }], h1Size: 130, h1Weight: '700' });
  assert.doesNotMatch(off.html, /--ds-h1-/, 'chip off → no h1 override, even with values set');
  // Same values, chip ON → they apply.
  const on = await mount({ deck: [{ content: '# T' }], h1On: true, h1Size: 130, h1Weight: '700' });
  assert.match(on.html, /--ds-h1-scale:1\.3;/);
  assert.match(on.html, /--ds-h1-weight:700;/);
});

test('size % becomes a ratio scale var; weight becomes a weight var', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    deck: [{ content: '# T' }],
    h2On: true, h1On: true, tableOn: true, codeOn: true,
    h2Size: 150, h1Weight: '800', tableSize: 50, codeWeight: '500',
  });
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /--ds-h2-scale:1\.5;/, '150% → 1.5');
  assert.match(html, /--ds-h1-weight:800;/);
  assert.match(html, /--ds-table-scale:0\.5;/, '50% → 0.5');
  assert.match(html, /--ds-code-weight:500;/);
  // A size left at 100 and a weight left at Default emit nothing (chip on, value default).
  assert.doesNotMatch(html, /--ds-h2-weight/, 'untouched h2 weight stays unset');
  assert.doesNotMatch(html, /--ds-h1-scale/, 'untouched h1 size stays unset');
});

test('the full 100–900 weight scale is accepted (Thin … Black)', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    deck: [{ content: '# T' }],
    h1On: true, h2On: true, h3On: true,
    h1Weight: '100', h2Weight: '200', h3Weight: '900',
  });
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /--ds-h1-weight:100;/, 'Thin');
  assert.match(html, /--ds-h2-weight:200;/, 'Extra Light');
  assert.match(html, /--ds-h3-weight:900;/, 'Black');
});

test('size is clamped to 25–300%; a bogus weight is ignored', { skip: SKIP }, async () => {
  const { html } = await mount({
    deck: [{ content: '# T' }],
    ulOn: true, olOn: true, quoteOn: true,
    ulSize: 9000, olSize: 1, quoteWeight: 'heaviest',
  });
  assert.match(html, /--ds-ul-scale:3;/, '9000% clamps to 300% → 3');
  assert.match(html, /--ds-ol-scale:0\.25;/, '1% clamps to 25% → 0.25');
  assert.doesNotMatch(html, /--ds-quote-weight/, 'an out-of-range weight is dropped, not emitted');
});

test('a brand font → a quoted --ds-*-family with a sensible fallback baked in', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    deck: [{ content: '# T' }],
    h1On: true, codeOn: true,
    h1Font: 'Poppins', codeFont: 'JetBrains Mono',
  });
  assert.deepEqual(rt.hookErrors, []);
  // A text element falls back to the brand font; code falls back to the mono stack.
  assert.match(html, /--ds-h1-family:'Poppins', var\(--font-brand[^;]*;/);
  assert.match(html, /--ds-code-family:'JetBrains Mono', ui-monospace[^;]*;/);
});

test('SECURITY: a hostile font name is stripped of style-breakout characters', { skip: SKIP }, async () => {
  const { html } = await mount({
    deck: [{ content: '# T' }],
    h1On: true, h1Font: "Evil'; } body { color:red } .x{",
  });
  const m = html.match(/--ds-h1-family:'([^']*)'/);
  assert.ok(m, 'family var is still emitted');
  const val = m?.[1] ?? '';
  assert.doesNotMatch(val, /[;{}'"]/, 'no quote / semicolon / brace survives inside the value');
  assert.match(val, /^Evil/, 'the benign leading text is kept');
  assert.doesNotMatch(html, /body \{ color:red \}/, 'no injected rule reaches the output');
});

// ── raw custom CSS ─────────────────────────────────────────────────────────────

test('custom CSS is wrapped in .slides { … } and emitted as a <style>', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    deck: [{ content: '# T' }],
    customCss: 'h1 { color: red; }',
  });
  assert.deepEqual(rt.hookErrors, []);
  assert.match(html, /<style>\.slides \{\nh1 \{ color: red; \}\n\}<\/style>/);
});

test('an empty custom CSS box emits no extra <style>', { skip: SKIP }, async () => {
  const { html } = await mount({ deck: [{ content: '# T' }], customCss: '   ' });
  // Only the animation <style> (+ nothing else) — the .slides wrapper never appears.
  assert.doesNotMatch(html, /<style>\.slides \{/);
});

test('SECURITY: custom CSS cannot close the <style> element or @import', { skip: SKIP }, async () => {
  const { html } = await mount({
    deck: [{ content: '# T' }],
    customCss: '</style><script>alert(1)</script> @import url(evil.css); h1{color:blue}',
  });
  assert.doesNotMatch(html, /<\/style><script>/, 'the </style> breakout is neutralised');
  assert.doesNotMatch(html, /@import/, 'the @import is stripped');
  assert.match(html, /h1\{color:blue\}/, 'the benign rule survives');
});
