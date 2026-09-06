// SPDX-License-Identifier: MPL-2.0
/**
 * Boot-path import-graph guard.
 *
 * scripts/check-bundle-budget.ts measures the built boot payload in CI and has
 * caught the same regression four times in six weeks: a leaf module gained a
 * static `import { x } from '@lolly/engine'`, the barrel dragged every codec
 * onto first paint, and the budget went red at build time - the last, most
 * expensive place to learn it. This test finds the same thing at commit time,
 * from source: it walks the STATIC import graph from the web entry (main.ts),
 * following relative imports and skipping `import()` and type-only imports,
 * and fails if any module on that walk imports the engine barrel or one of the
 * deliberately-lazied heavy modules. Deep, single-module engine imports
 * (`engine/src/inputs.ts`) stay allowed - they are what the diet replaced the
 * barrel with.
 *
 * If this fails: move the import behind `await import()` at its use site, or
 * import the one engine module you need by its file path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(SRC, 'main.ts');

/** Modules that must never be reachable by a static import from the entry. */
const FORBIDDEN: { name: string; test: (spec: string) => boolean }[] = [
  { name: 'the engine barrel (@lolly/engine)', test: (s) => s === '@lolly/engine' || /engine\/src\/index\.(ts|js)$/.test(s) },
  { name: 'handlebars', test: (s) => s === 'handlebars' || s.startsWith('handlebars/') },
  { name: 'ajv', test: (s) => s === 'ajv' || s.startsWith('ajv/') },
  { name: 'html2canvas', test: (s) => s === 'html2canvas' },
  { name: 'the C2PA read side', test: (s) => /engine\/src\/c2pa-(verify|extract|containers)\.(ts|js)$/.test(s) },
  { name: 'the render/export codecs', test: (s) => /engine\/src\/(pdf-map|design-map|pptx|emf|eps|dxf|psd-write)\.(ts|js)$/.test(s) },
];

/** Static, value-level import specifiers of one module (type-only and dynamic imports excluded). */
export function staticImports(source: string): string[] {
  const out: string[] = [];
  // Strip comments so a commented-out import is not a use.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  const re = /^\s*(import|export)\s+(type\s+)?([^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[2]) continue; // import type / export type
    const clause = m[3] ?? '';
    // `import { type A, type B } from` is type-only in effect; a mixed clause is a value import.
    if (m[1] === 'import' && clause && /^\{[^}]*\}\s+from\s+$/.test(clause)) {
      const names = clause.replace(/^\{|\}\s+from\s+$/g, '').split(',').map((n) => n.trim()).filter(Boolean);
      if (names.length && names.every((n) => n.startsWith('type '))) continue;
    }
    if (m[1] === 'export' && !clause) continue; // `export 'x'` is not a thing; guard anyway
    out.push(m[4]!);
  }
  return out;
}

function resolveRelative(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  const candidates = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, join(base, 'index.ts')];
  for (const c of candidates) if (existsSync(c) && /\.ts$/.test(c)) return c;
  return null;
}

export function walkBootPath(entry = ENTRY): { modules: string[]; offenders: { file: string; spec: string; why: string }[] } {
  const seen = new Set<string>();
  const offenders: { file: string; spec: string; why: string }[] = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const spec of staticImports(src)) {
      if (/\.(css|scss|svg|png|json)(\?.*)?$/.test(spec)) continue;
      const hit = FORBIDDEN.find((f) => f.test(spec));
      if (hit) offenders.push({ file: file.slice(SRC.length + 1), spec, why: hit.name });
      const next = resolveRelative(file, spec);
      if (next && next.startsWith(SRC)) queue.push(next);
    }
  }
  return { modules: [...seen].map((f) => f.slice(SRC.length + 1)).sort(), offenders };
}

test('the static import graph from main.ts never reaches the engine barrel or a lazied heavy module', () => {
  const { modules, offenders } = walkBootPath();
  assert.ok(modules.length > 20, `the walk found ${modules.length} boot-path modules - the entry or resolver moved?`);
  assert.deepEqual(
    offenders.map((o) => `${o.file} imports ${o.spec} (${o.why})`),
    [],
    'a static import on the boot path pulls a heavy chunk onto first paint - make it a dynamic import() at the use site, or import the single engine module you need by path',
  );
});

test('the extractor skips type-only and dynamic imports and keeps value imports', () => {
  const src = `
    import type { A } from './a.ts';
    import { type B, type C } from './b.ts';
    import { type D, e } from './d.ts';
    import x from '@lolly/engine';
    const y = await import('./lazy.ts');
    // import z from './commented.ts';
    export { q } from './q.ts';
  `;
  assert.deepEqual(staticImports(src), ['./d.ts', '@lolly/engine', './q.ts']);
});
