#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DOCS_ROOT, documentationReadme, navigationBlocks, readRegistry } from '../docs/navigation.ts';

export function syncDocsNavigation(root = DOCS_ROOT, check = false): void {
  const registry = readRegistry(root);
  const path = resolve(root, 'docs/build.ts');
  const original = readFileSync(path, 'utf8');
  let generated = original;
  for (const [name, declaration] of Object.entries(navigationBlocks(registry))) {
    const start = `// BEGIN GENERATED DOCS ${name}`;
    const end = `// END GENERATED DOCS ${name}`;
    const first = generated.indexOf(start + '\n');
    const last = generated.indexOf(end + '\n', first);
    if (first < 0 || last < first || generated.indexOf(start + '\n', first + start.length) >= 0) throw new Error(`Missing or duplicate generated docs block: ${name}`);
    generated = generated.slice(0, first) + start + '\n' + declaration + '\n' + end + generated.slice(last + end.length);
  }
  const readmePath = resolve(root, 'docs/README.md');
  const readme = documentationReadme(registry);
  if (check) {
    if (generated !== original || readFileSync(readmePath, 'utf8') !== readme) throw new Error('Documentation navigation is stale. Run node scripts/sync-docs-navigation.ts and commit the generated index.');
  } else {
    if (generated !== original) writeFileSync(path, generated);
    if (readFileSync(readmePath, 'utf8') !== readme) writeFileSync(readmePath, readme);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  syncDocsNavigation(DOCS_ROOT, process.argv.includes('--check'));
  console.log(`Documentation manifest ${process.argv.includes('--check') ? 'matches' : 'generated'} the public navigation and repository index.`);
}
