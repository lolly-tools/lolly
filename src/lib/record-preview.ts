// SPDX-License-Identifier: MPL-2.0
// Shell-internal side channel for the live record self-view.
//
// The engine bridge is deliberately DOM-free - it never sees a MediaStream or <video>
// (see host-v1.ts), so the recording self-view can't flow through it. Both the recorder
// bridge (recorder.ts, which owns the capture MediaStream) and the tool view (tool.ts,
// which shows the framing UI) live in the web shell, so they rendezvous here instead:
// recorder.ts publishes its live video stream while a video take is running, and the
// tool view subscribes to mirror it into a <video> so the user still sees themselves
// during the take (the framing viewfinder is torn down when the recorder opens its own
// stream). Audio-only recordings never publish a stream.

type PreviewCb = (stream: MediaStream | null) => void;

const subs = new Set<PreviewCb>();
let current: MediaStream | null = null;
let latestClaim = 0;
let currentOwner: number | null = null;

/** Reserve before asking for permission. A late older acquisition cannot replace a
 * newer preview, and releasing an older session cannot end the newer session's UI. */
export function claimRecordPreview(): (stream: MediaStream | null) => void {
  const owner = ++latestClaim;
  return (stream) => {
    if (stream ? owner !== latestClaim : owner !== currentOwner) return;
    currentOwner = stream ? owner : null;
    current = stream;
    for (const cb of [...subs]) { try { cb(stream); } catch { /* a bad subscriber must not break capture */ } }
  };
}

/** Tool view → observe the current record preview stream. Fires immediately with the
 *  current value; returns an unsubscribe. */
export function subscribeRecordPreview(cb: PreviewCb): () => void {
  subs.add(cb);
  cb(current);
  return () => { subs.delete(cb); };
}
