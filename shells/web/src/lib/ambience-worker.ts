// SPDX-License-Identifier: MPL-2.0
/**
 * Ambience bake worker. Synthesising a bed is a few million samples of filtered
 * noise - measured in Chrome at 48 kHz: ~50 ms for the keyboard bed up to ~490 ms
 * for the café murmur (five modulated voice bands). On the main thread that is a
 * visible freeze at the exact moment someone clicks a layer on, so it runs here.
 * Pure compute: lib/ambience-dsp.ts is DOM-free, so it runs unchanged in worker
 * scope, and the channels come back as transferables (no copy).
 */
import { bakeAmbience, type AmbienceKind } from './ambience-dsp.ts';

interface BakeRequest { id: number; kind: AmbienceKind; sampleRate: number }

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's - narrowed so the transfer list is accepted
// under the shell's DOM lib typings (same shape as zzfxm-worker.ts).
const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

addEventListener('message', (e: MessageEvent<BakeRequest>) => {
  const { id, kind, sampleRate } = e.data;
  try {
    const channels = bakeAmbience(kind, sampleRate);
    post({ id, channels }, channels.map((c) => c.buffer));
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) }, []);
  }
});
