// SPDX-License-Identifier: MPL-2.0
/** host.fonts for the web shell: the engine's inspection and verified subsetting over the Skera worker. */
import type { FontsAPI } from '@lolly-tools/core/host-v1';
import { createFontsAPI } from '@lolly/engine';
import { SKERA_POLICY } from '@lolly-tools/node-shell/font-subset-wasm';
import { subsetFont } from './font-subset.ts';

export function createWebFontsAPI(): FontsAPI {
  return createFontsAPI({ policy: SKERA_POLICY, run: (sfnt, glyphs) => subsetFont(sfnt, glyphs) });
}
