// SPDX-License-Identifier: MPL-2.0
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const start = '// BEGIN GENERATED DIAGRAM VISUALS';
const end = '// END GENERATED DIAGRAM VISUALS';
export function buildDiagramHooks(): string {
  const directory = resolve(root, 'community/diagram-builder');
  const current = readFileSync(resolve(directory, 'hooks.js'), 'utf8');
  const helpers = ['appearance', 'text', 'routing', 'paint'].map(name =>
    readFileSync(resolve(directory, `source/${name}.js`), 'utf8').replace(/^export /gm, '').trimEnd()).join('\n\n');
  const generated = `${start}\n// Edit source/*.js, then run pnpm run build:diagram-hooks.\n${helpers}\n${end}\n`;
  const a = current.indexOf(start);
  if (a < 0) return `${current.trimEnd()}\n\n${generated}`;
  const b = current.indexOf(end, a);
  if (b < 0) throw new Error('Unterminated generated diagram helpers');
  return current.slice(0, a) + generated + current.slice(b + end.length).replace(/^\n/, '');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(root, 'community/diagram-builder/hooks.js');
  const built = buildDiagramHooks();
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== built) throw new Error('Run pnpm run build:diagram-hooks');
  } else writeFileSync(file, built);
}
