// SPDX-License-Identifier: MPL-2.0
/**
 * Code a device needs once it is offline, loaded while it can still be fetched.
 *
 * A build's chunks reach the device the first time something imports them, so a chunk
 * first needed offline is a 503, and the shell answers that by replacing the view with
 * "this page needs a quick refresh". Opening a tool used to bring all of these in by
 * accident: it drew a specimen of the emoji set and wrote the set into the uploads. It
 * does neither now, so this is that side effect on purpose, away from the tool opening.
 *
 * Without the first group the first emoji typed on a plane loses the page. The others
 * serve a person's first catalog file, first upload and first change made offline.
 */
export function warmOfflineCode(): Promise<unknown> {
  return Promise.allSettled([
    // Every module the runtime's emoji pass imports (engine/src/runtime.ts).
    import('../../../../engine/src/emoji-segment.ts'),
    import('../../../../engine/src/emoji-pack.ts'),
    import('../../../../engine/src/emoji-dom.ts'),
    import('../../../../engine/src/emoji-svg-text.ts'),
    // A catalog file's read, and an upload's write.
    import('./catalog-history.ts'),
    import('./asset-history.ts'),
    import('./version-assets-write.ts'),
    import('../../../../engine/src/c2pa-verify.ts'),
    // The first local change arms the sync scheduler, which imports these.
    import('../lib/sync-engine.ts'),
    import('../lib/backup-sessions.ts'),
  ]);
}
