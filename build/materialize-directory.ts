// SPDX-License-Identifier: MPL-2.0
import { cpSync, realpathSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/** Profile views contain directory symlinks; deployed output must contain bytes. */
export function materializeDirectory(source: string, destination: string): void {
  const src = resolve(source), dst = resolve(destination);
  const realSource = realpathSync(src); // refuse an absent source before touching output
  const overlaps = (a: string, b: string): boolean => a === b || a.startsWith(b + sep) || b.startsWith(a + sep);
  if (overlaps(src, dst) || overlaps(realSource, dst)) throw new Error('Build source and destination must not overlap.');
  // This directory belongs to the build. Remove stale OUTPUT symlinks before
  // copying: cp's dereference option covers sources, and copying through an old
  // destination link can otherwise overwrite or unlink the original tool files.
  // rm removes the links themselves; it never walks their targets.
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, {
    recursive: true,
    dereference: true,
    // Force the JS copy path. Node's recursive native fast path has ignored
    // dereference on affected releases, including our Node 26.7 reproduction.
    // https://github.com/nodejs/node/issues/59168
    filter: () => true,
  });
}
