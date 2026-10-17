// SPDX-License-Identifier: MPL-2.0
/**
 * `host.fonts` for the Node shells (CLI, TUI, MCP): the engine's inspection and
 * verified subsetting over the committed Skera WASM, read off disk with no
 * network. Each subset gets a fresh instance, so its linear memory is released
 * afterwards, as the browser worker does by terminating.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFontsAPI } from '@lolly/engine';
import type { FontsAPI } from '@lolly-tools/core/host-v1';
import { SKERA_POLICY, isSkeraWasm, subsetWithSkera } from './font-subset-wasm.ts';

let compiled: Promise<WebAssembly.Module> | undefined;

/** Beside this module in the repository; bundled functions keep the package's WASM under their content root. */
function skeraPath(): string {
  const adjacent = fileURLToPath(new URL('../wasm/skera/skera.wasm', import.meta.url));
  if (existsSync(adjacent)) return adjacent;
  for (let dir = dirname(adjacent); dirname(dir) !== dir; dir = dirname(dir)) {
    const candidate = join(dir, 'packages/node-shell/wasm/skera/skera.wasm');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('The font subset runtime is not installed.');
}

function skeraModule(): Promise<WebAssembly.Module> {
  compiled ??= Promise.resolve().then(() => readFile(skeraPath()))
    .then((bytes) => WebAssembly.compile(bytes))
    .catch((error: unknown) => { compiled = undefined; throw error; });
  return compiled;
}

export function createNodeFontsAPI(): FontsAPI {
  return createFontsAPI({
    policy: SKERA_POLICY,
    async run(sfnt, glyphs) {
      const instance = await WebAssembly.instantiate(await skeraModule());
      if (!isSkeraWasm(instance.exports)) throw new Error('Font subset runtime is incompatible');
      return subsetWithSkera(instance.exports, sfnt, glyphs);
    },
  });
}
