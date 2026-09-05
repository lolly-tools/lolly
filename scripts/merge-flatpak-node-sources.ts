// SPDX-License-Identifier: MPL-2.0
/** Merge flatpak-node-generator outputs without silently overwriting a dest. */

import { readFileSync, writeFileSync } from 'node:fs';

interface Source {
  dest?: string;
  'dest-filename'?: string;
  [key: string]: unknown;
}

export function mergeSources(groups: Source[][]): Source[] {
  const merged: Source[] = [];
  const byDest = new Map<string, string>();
  const anonymous = new Set<string>();
  for (const group of groups) {
    for (const source of group) {
      const encoded = JSON.stringify(source);
      if (!source.dest) {
        if (!anonymous.has(encoded)) {
          anonymous.add(encoded);
          merged.push(source);
        }
        continue;
      }
      // `shell` sources intentionally share a working directory (one per
      // architecture/tool); only downloaded file/archive payloads claim a
      // concrete output path.
      if (source.type === 'shell') {
        if (!anonymous.has(encoded)) {
          anonymous.add(encoded);
          merged.push(source);
        }
        continue;
      }
      const destination = source['dest-filename']
        ? `${source.dest}/${source['dest-filename']}`
        : source.dest;
      const previous = byDest.get(destination);
      if (previous && previous !== encoded) {
        throw new Error(`Conflicting Flatpak node sources write ${destination}`);
      }
      if (!previous) {
        byDest.set(destination, encoded);
        merged.push(source);
      }
    }
  }
  return merged;
}

function main(argv: string[]): void {
  if (argv.length < 3) {
    throw new Error('usage: merge-flatpak-node-sources <input...> <output>');
  }
  const output = argv.at(-1)!;
  const inputs = argv.slice(0, -1).map(path => {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(value)) throw new Error(`${path} is not a JSON source array`);
    return value as Source[];
  });
  writeFileSync(output, `${JSON.stringify(mergeSources(inputs), null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
