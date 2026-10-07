// SPDX-License-Identifier: MPL-2.0
/** Read a geometry kernel from the package, or from the repository root when this code runs inside a bundle. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function readGeometryWasm(name: 'geometry-clip.wasm' | 'geometry-fit-portable.wasm'): Promise<Uint8Array<ArrayBuffer>> {
  const adjacent = fileURLToPath(new URL(`../wasm/geometry-kernel/${name}`, import.meta.url));
  if (existsSync(adjacent)) return readFile(adjacent);
  // A bundled function (api/mcp) sits elsewhere; its included files keep the package layout.
  for (let dir = dirname(adjacent); ; dir = dirname(dir)) {
    const candidate = join(dir, 'packages/node-shell/wasm/geometry-kernel', name);
    if (existsSync(candidate)) return readFile(candidate);
    if (dirname(dir) === dir) break;
  }
  throw new Error(`The geometry kernel ${name} is not installed.`);
}
