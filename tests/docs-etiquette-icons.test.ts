// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly Demo's two-tone Etiquette icons as doc icons (docs/etiquette-icons.ts): each file's
 * two classes become fills on --eti-accent and --eti-base, which the docs stylesheet sets
 * per theme, and every `eti-<slug>` a page uses is registered.
 *
 * Run directly: node --test tests/docs-etiquette-icons.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ETIQUETTE_DOC_ICONS, etiquetteDocIcons, themedEtiquetteSvg } from '../docs/etiquette-icons.ts';
import { createIconSprite } from '../docs/icon-sprite.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const BUILD_TS = readFileSync(join(ROOT, 'docs/build.ts'), 'utf8');

test('an icon file is repainted from the two theme properties and keeps its drawing', () => {
  const file = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><style>.c1{fill:#50c369}.c2{fill:#033633}</style></defs><path class="c1" d="M1 1h2"/><path class="c2" d="M4 4h2"/></svg>';
  const svg = themedEtiquetteSvg(file);
  assert.equal(svg, '<svg viewBox="0 0 24 24" class="eti" aria-hidden="true"><path style="fill:var(--eti-accent,#50c369)" d="M1 1h2"/><path style="fill:var(--eti-base,#033633)" d="M4 4h2"/></svg>');
  assert.ok(!svg.includes('<style'), 'the fixed fills leave with the stylesheet');
});

test('a file without the two-class shape is refused, not drawn in one colour', () => {
  assert.throws(() => themedEtiquetteSvg('<svg viewBox="0 0 24 24"><path d="M1 1h2"/></svg>'), /c1 and c2/);
  assert.throws(() => themedEtiquetteSvg('<svg viewBox="0 0 24 24"><path class="c1" d="M1 1"/><path class="c2" id="x" d="M2 2"/></svg>'), /c1 and c2/);
  assert.throws(() => themedEtiquetteSvg('<svg viewBox="0 0 32 32"><path class="c1"/><path class="c2"/></svg>'), /24 by 24/);
});

test('every registered icon reads from the brand pack and shares through the sprite', () => {
  const icons = etiquetteDocIcons();
  assert.equal(Object.keys(icons).length, ETIQUETTE_DOC_ICONS.length);
  const sprite = createIconSprite(icons);
  for (const slug of ETIQUETTE_DOC_ICONS) {
    const svg = icons[`eti-${slug}`]!;
    assert.match(svg, /var\(--eti-accent/, slug);
    assert.match(svg, /var\(--eti-base/, slug);
    assert.ok(sprite.svg.includes(`<symbol id="eti-${slug}"`), `${slug} joins the shared sprite`);
  }
  assert.match(BUILD_TS, /Object\.assign\(DOC_ICONS, etiquetteDocIcons\(\)\)/, 'the docs build registers the icons');
});

test('the stylesheet sets both properties for the light theme and for dark and brand', () => {
  assert.match(BUILD_TS, /:root,\[data-theme="light"\]\{--eti-accent:[^;]+;--eti-base:[^}]+\}/);
  assert.match(BUILD_TS, /\[data-theme="dark"\],\[data-theme="brand"\]\{--eti-accent:[^;]+;--eti-base:[^}]+\}/);
});

test('every eti- icon an English page asks for is registered', () => {
  const registered = new Set(ETIQUETTE_DOC_ICONS.map(slug => `eti-${slug}`));
  const sources = [
    ...readdirSync(join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => join(ROOT, 'docs', f)),
    ...readdirSync(join(ROOT, 'docs/work')).filter(f => f.endsWith('.md')).map(f => join(ROOT, 'docs/work', f)),
  ];
  const used = new Set<string>();
  for (const file of sources) {
    const md = readFileSync(file, 'utf8');
    for (const m of md.matchAll(/<!--i:(eti-[a-z-]+)-->|^::: intro (eti-[a-z-]+)\s*$/gm)) used.add((m[1] ?? m[2])!);
  }
  assert.ok(used.size > 0, 'the partner pages use Etiquette icons');
  for (const key of used) assert.ok(registered.has(key), `${key} is used but not in ETIQUETTE_DOC_ICONS`);
});
