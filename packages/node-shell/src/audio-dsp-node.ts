// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createAudioDspKernel, type AudioDspKernel } from './audio-dsp.ts';

let pending: Promise<AudioDspKernel> | undefined;
/** Load the audio module once per process. */
export function loadAudioDspKernel(): Promise<AudioDspKernel> {
  pending ??= readFile(new URL('../wasm/audio-dsp/audio-dsp.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/audio-dsp/audio-dsp.wasm'));
    })
    .then(bytes => createAudioDspKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
