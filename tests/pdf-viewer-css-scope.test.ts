// SPDX-License-Identifier: MPL-2.0
// PDF.js's viewer stylesheet stays inside the PDF viewer (scripts/vite-pdf-assets.ts).
//
// Imported as it ships, pdf_viewer.css styles bare class names (`.sidebar`,
// `.dialog`, `.toggle-button`) and sets `color-scheme: light dark` on `:root`.
// The first PDF preview in a session put all of it on the whole app: the tool
// sidebar took PDF.js's panel colour (#23222b on a computer in dark mode) under
// Lolly's dark ink, and the root colour scheme followed the computer instead of
// the app theme. These tests hold the scoping against the real file, so a
// PDF.js update that adds a new kind of global rule fails here first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PDF_JS_ROOT_VARS, PDF_VIEWER_SCOPE, pdfViewerCssScope, scopePdfViewerCss } from '../scripts/vite-pdf-assets.ts';

const repo = fileURLToPath(new URL('..', import.meta.url));
const requireRoot = createRequire(new URL('../scripts/', import.meta.url));
const shipped = readFileSync(requireRoot.resolve('pdfjs-dist/web/pdf_viewer.css'), 'utf8');

/** The slice of lightningcss this test calls. */
interface CssMinifier {
  transform(opts: { filename: string; code: Uint8Array; minify: boolean; targets: Record<string, number> }): { code: Uint8Array; warnings: unknown[] };
}

/** Vite's own CSS minifier, the one that unnests the scoped sheet in a build. */
function lightningcss(): CssMinifier | null {
  try {
    const viteEntry = createRequire(new URL('../shells/web/', import.meta.url)).resolve('vite');
    return createRequire(viteEntry)('lightningcss');
  } catch { return null; }
}

/** Every selector of every style rule in a minified sheet, split at top-level commas. */
function selectors(css: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') {
      const head = buf.trim();
      if (head && !head.startsWith('@')) {
        let depth = 0, part = '';
        for (const c of head) {
          if (c === '(') depth++;
          if (c === ')') depth--;
          if (c === ',' && depth === 0) { out.push(part.trim()); part = ''; } else part += c;
        }
        out.push(part.trim());
      }
      buf = '';
    } else if (ch === '}' || ch === ';') buf = '';
    else buf += ch;
  }
  return out.filter(Boolean);
}

test('the shipped PDF.js sheet does carry the global rules this guards against', () => {
  // If PDF.js stops shipping these, the scoping is still harmless, but this test
  // is the record of why it exists.
  assert.match(shipped, /^\.sidebar \{/m);
  assert.match(shipped, /^:root \{\n {2}color-scheme: light dark;/m);
});

test('scoping rewrites every :root and every light dark colour scheme', () => {
  const out = scopePdfViewerCss(shipped);
  assert.ok(out.startsWith(`${PDF_VIEWER_SCOPE} {\n`));
  // One block stays on the document root, after the scoped sheet, holding only
  // the variables PDF.js's own JavaScript reads or writes there, at their shipped values.
  const at = out.lastIndexOf('\n:root {');
  assert.ok(at > 0, 'the root block follows the scoped sheet');
  const scoped = out.slice(0, at);
  const rootBlock = out.slice(at).trim();
  assert.doesNotMatch(scoped, /:root\b/);
  for (const name of PDF_JS_ROOT_VARS) {
    const shippedDecl = new RegExp(`^\\s*(${name}\\s*:[^;]*;)`, 'm').exec(shipped)?.[1];
    assert.ok(shippedDecl, `PDF.js still declares ${name}`);
    assert.ok(rootBlock.includes(shippedDecl), `${name} stays on :root as shipped`);
    assert.ok(!scoped.includes(`${name}:`), `${name} is not redeclared on the viewer, where it would hide what PDF.js writes on <html>`);
  }
  assert.equal(rootBlock.split('\n').length, PDF_JS_ROOT_VARS.length + 2);
  assert.doesNotMatch(out, /color-scheme:\s*light\s+dark/);
  // The text and annotation layers keep their own fixed scheme: page content is light.
  assert.match(scoped, /color-scheme: only light;/);
});

test('a :root the rewrite does not recognise fails loudly', () => {
  assert.throws(() => scopePdfViewerCss('.a { color: red; }\nhtml:root .b { color: blue; }\n'), /:root selector on line 2/);
});

test('after the build unnests it, every PDF.js rule sits inside the viewer, bar one block of its own variables', (t) => {
  const lc = lightningcss();
  if (!lc) { t.skip('lightningcss is not resolvable through vite here'); return; }
  const { code, warnings } = lc.transform({
    filename: 'pdf_viewer.css',
    code: Buffer.from(scopePdfViewerCss(shipped)),
    minify: true,
    // Vite's default build target predates CSS nesting, so the build flattens the nesting.
    targets: { chrome: 107 << 16, safari: 16 << 16, firefox: 104 << 16 },
  });
  assert.deepEqual(warnings, []);
  const css = code.toString();
  const all = selectors(css);
  assert.ok(all.length > 500, `expected the whole sheet, read ${all.length} selectors`);
  const outside = all.filter((s) => !s.includes(PDF_VIEWER_SCOPE));
  assert.deepEqual(outside, [':root'], 'every selector but the one root block is inside the viewer scope');
  // That root block sets PDF.js's own variables and nothing else: no colour
  // scheme, no property a Lolly element could pick up.
  const rootRules = [...css.matchAll(/(?:^|})\s*:root\{([^}]*)\}/g)].map((m) => m[1]!);
  assert.equal(rootRules.length, 1);
  const props = rootRules[0]!.split(';').filter(Boolean).map((d) => d.slice(0, d.indexOf(':')).trim());
  assert.deepEqual(props.sort(), [...PDF_JS_ROOT_VARS].sort());
  // Nothing addresses Lolly's own tool sidebar any more.
  assert.ok(!all.some((s) => /^\.sidebar\b/.test(s)));
});

test('the Vite plugin rewrites only the PDF.js viewer sheet', () => {
  const plugin = pdfViewerCssScope();
  assert.equal(plugin.enforce, 'pre');
  const transform = plugin.transform as (code: string, id: string) => { code: string } | null;
  const id = `${repo}node_modules/.pnpm/pdfjs-dist@6.4.299/node_modules/pdfjs-dist/web/pdf_viewer.css`;
  assert.ok(transform(':root { --x: 1; }', id)?.code.startsWith(`${PDF_VIEWER_SCOPE} {`));
  assert.ok(transform(':root { --x: 1; }', `${id}?direct`)?.code.startsWith(`${PDF_VIEWER_SCOPE} {`));
  assert.ok(transform(':root { --x: 1; }', `${id}?t=1731000000000`)?.code.startsWith(`${PDF_VIEWER_SCOPE} {`));
  assert.equal(transform(':root { --x: 1; }', `${repo}shells/web/src/styles/tokens.css`), null);
  // `?raw` and `?url` arrive as JavaScript modules, which are not CSS to rewrite.
  assert.equal(transform('export default ":root{}"', `${id}?raw`), null);
  assert.equal(transform('export default "/x.css"', `${id}?url`), null);
});

test('the viewer hands PDF.js a container carrying the scope class', () => {
  const source = readFileSync(new URL('../shells/web/src/components/pdf-asset-viewer.ts', import.meta.url), 'utf8');
  const cls = PDF_VIEWER_SCOPE.slice(1);
  assert.match(source, new RegExp(`container\\.className = '${cls}'`));
  assert.match(source, /new PDFViewer\(\{ container,/);
});
