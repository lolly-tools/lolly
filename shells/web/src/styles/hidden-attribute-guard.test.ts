// SPDX-License-Identifier: MPL-2.0
/**
 * `[hidden]` drift guard.
 *
 * A component that sets `display` on a class defeats `[hidden]` - the two
 * selectors tie on specificity (0,1,0), and base.css's `[hidden]` sits in the
 * `base` layer, below `primitives` / `chrome` / `views`, so the class wins on
 * layer rank no matter how the file loads. The app-wide fix is a single
 * `[hidden] { display: none !important }` in parts/a11y.css, which is imported
 * into the TOP layer.
 *
 * These tests assert the MECHANISM, not any rendered pixel:
 *   1. the rule exists, in a11y.css, with `!important`, at real specificity;
 *   2. a11y is still declared last in the layer order in app.css;
 *   3. a11y.css is still imported `layer(a11y)`;
 *   4. no sheet anywhere asks a `[hidden]` element to keep a `display` - the
 *      one thing the fix would break, and the reason `!important` is safe.
 *
 * Run directly:  node --test shells/web/src/styles/hidden-attribute-guard.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES_DIR = dirname(fileURLToPath(import.meta.url));   // src/styles/
const SRC_DIR = dirname(STYLES_DIR);                          // src/
const REPO = join(SRC_DIR, '..', '..', '..');                 // repo root

const A11Y = readFileSync(join(STYLES_DIR, 'parts', 'a11y.css'), 'utf8');
const APP = readFileSync(join(STYLES_DIR, 'app.css'), 'utf8');

/** Drop CSS block comments while preserving byte offsets (so line numbers hold). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkCss(p, out);
    else if (entry.name.endsWith('.css')) out.push(p);
  }
  return out;
}

test('a11y.css carries the app-wide `[hidden] { display: none !important }`', () => {
  const body = stripComments(A11Y);
  // Bare `[hidden]` selector - no class/element prefix, no :where() wrapper.
  const re = /(^|})\s*\[hidden\]\s*\{([^}]*)\}/;
  const m = body.match(re);
  assert.ok(
    m,
    'parts/a11y.css no longer contains a bare `[hidden] { … }` rule. It is the ONE ' +
    'place `hidden` is made to win app-wide (layer a11y is the top layer); without ' +
    'it every component that sets `display` on a class silently defeats the ' +
    'attribute and hidden markup keeps its box. Restore it, do not re-patch ' +
    'per-component `.foo[hidden]` rules.',
  );
  const decls = m![2] ?? '';
  assert.match(
    decls, /display\s*:\s*none\s*!important/,
    'the `[hidden]` rule in parts/a11y.css must declare `display: none !important`. ' +
    'The `!important` is load-bearing for two paths that outrank every cascade ' +
    'layer: UNLAYERED tool-template CSS inside #tool-canvas, and inline ' +
    '`el.style.display`. Layer rank alone does not cover those.',
  );
});

test('the `[hidden]` rule keeps its (0,1,0) specificity - not wrapped in :where()', () => {
  const body = stripComments(A11Y);
  assert.ok(
    !/:where\(\s*\[hidden\]\s*\)/.test(body),
    'the app-wide hidden rule was wrapped in :where(), dropping it to specificity 0. ' +
    'Then ANY element-level `!important` in this same layer beats it by accident. ' +
    'Keep the plain `[hidden]` selector so an override has to be deliberate.',
  );
});

test('a11y is still the last-declared cascade layer, and a11y.css is imported into it', () => {
  const decl = stripComments(APP).match(/@layer\s+([^;{]+);/);
  assert.ok(decl, 'app.css no longer declares the cascade layer order');
  const layers = (decl![1] ?? '').split(',').map(s => s.trim());
  assert.equal(
    layers[layers.length - 1], 'a11y',
    `\`a11y\` must stay LAST in the @layer order in app.css (found: ${layers.join(', ')}). ` +
    'The app-wide `[hidden]` fix lives in that layer; demoting it lets any later ' +
    'layer\'s `!important` display rule defeat the attribute again.',
  );
  assert.match(
    APP, /@import\s+'\.\/parts\/a11y\.css'\s+layer\(a11y\)/,
    "parts/a11y.css must stay imported as `layer(a11y)` - an unlayered or " +
    'differently-layered import moves the `[hidden]` fix out of the top layer.',
  );
});

test('no stylesheet asks a `[hidden]` element to keep a display (the fix would break it)', () => {
  const files = [...walkCss(SRC_DIR), ...walkCss(join(REPO, 'tools'))];
  assert.ok(files.length > 20, `only ${files.length} stylesheets found - the walk is broken`);

  const offenders: string[] = [];
  for (const f of files) {
    const body = stripComments(readFileSync(f, 'utf8'));
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(body))) {
      const sel = m[1] ?? '';
      if (!/\[hidden\]/.test(sel) || /:not\(\s*\[hidden\]\s*\)/.test(sel)) continue;
      for (const d of (m[2] ?? '').matchAll(/(?:^|;)\s*display\s*:\s*([^;!}]+)/g)) {
        const value = d[1] ?? '';
        if (/^\s*none\s*$/.test(value)) continue;
        const line = body.slice(0, m.index).split('\n').length;
        offenders.push(`${relative(REPO, f).split(sep).join('/')}:${line} - ${sel.trim()} { display: ${value.trim()} }`);
      }
    }
  }
  assert.deepEqual(
    offenders, [],
    'A rule wants a `[hidden]` element to keep a `display`, which the app-wide ' +
    '`[hidden] { display: none !important }` in parts/a11y.css now makes ' +
    'impossible. `hidden` means "not rendered and not in the accessibility ' +
    'tree" - use a class or a data-attribute for a flag that must stay laid out:\n  ' +
    offenders.join('\n  '),
  );

  // `hidden="until-found"` reveals via content-visibility, not display - the one
  // legitimate use of the attribute that `display: none !important` would break.
  const tsFiles = walkTs(SRC_DIR);
  const untilFound = tsFiles.filter(f => /hidden\s*=\s*["']until-found/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(
    untilFound.map(f => relative(REPO, f).split(sep).join('/')), [],
    '`hidden="until-found"` needs find-in-page to reveal the subtree, which relies ' +
    'on `content-visibility: hidden` - the `display: none !important` in ' +
    'parts/a11y.css defeats it. Exempt it there with ' +
    '`[hidden="until-found"] { content-visibility: hidden; display: revert !important }` ' +
    'before shipping this.',
  );
});

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkTs(p, out);
    else if (/\.ts$/.test(entry.name) && !entry.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
