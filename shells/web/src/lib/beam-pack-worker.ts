// SPDX-License-Identifier: MPL-2.0
/**
 * Beam pack hashing worker (plan 100 section 11.15a: "beam work stays off the main thread").
 *
 * Building a pack is one expensive step and a lot of cheap ones. The expensive step is
 * the SHA-256 over every file's bytes - a tag pack is tens of megabytes, and hashing it
 * on the main thread would stall the tab at exactly the moment a human is being shown a
 * "Send these 14 files?" sheet. Everything else the builder does (reading records,
 * shaping the manifest, slicing chunks on demand) is small or lazy, so this worker does
 * the one thing and nothing more.
 *
 * Why blobs, not bytes. A `Blob` structured-clones by HANDLE, so posting one here does
 * not copy its bytes across the boundary - the worker reads each blob and lets it go
 * before touching the next, which is what stops a 38 MB pack from being resident in the
 * renderer twice. Web Crypto has no streaming digest, so ONE item is materialised at a
 * time inside the worker; that is the memory profile section 11.15a asks for, and the reason
 * this is a loop rather than a `Promise.all`.
 *
 * The digest itself is `sriSha256` imported from the protocol - deliberately the very
 * same function the receiver verifies with, so a worker build and a main-thread
 * fallback build can never disagree about the same bytes, and a checksum computed here
 * compares equal to one `scripts/checksum-assets.ts` wrote for a catalog asset.
 *
 * Failure is not this file's problem: any throw is reported back and `hashBlobs()` in
 * `beam-pack.ts` hashes in place instead. A dead worker degrades a build's smoothness,
 * never its result.
 */

import { sriSha256 } from '../collab/beam-protocol.ts';

interface HashRequest {
  id: number;
  blobs: Blob[];
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload, not
// Window's (message, targetOrigin) one.
const post = postMessage as (message: unknown) => void;

addEventListener('message', (event: MessageEvent<HashRequest>) => {
  const { id, blobs } = event.data ?? ({} as HashRequest);
  void (async () => {
    try {
      const checksums: string[] = [];
      // Sequential on purpose - see the header. One item resident at a time.
      for (const blob of blobs ?? []) checksums.push(await sriSha256(new Uint8Array(await blob.arrayBuffer())));
      post({ id, checksums });
    } catch (err) {
      post({ id, error: err instanceof Error ? err.message : String(err) });
    }
  })();
});
