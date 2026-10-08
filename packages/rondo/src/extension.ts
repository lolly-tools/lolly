// SPDX-License-Identifier: MPL-2.0
/**
 * Rondocode, declared in the document model's extension shape.
 *
 * docs/spec/document-model/09-extensions.md drafts `ExtensionDeclarationV1` and
 * names "unfamiliar media" as the check that keeps the extension boundary honest.
 * A song whose audio is computed from code is that case, so it is declared here in
 * the draft's own fields. The chapter keeps the type itself out of packages/core
 * until its fixtures exist, so this is data in the draft's shape, not a type yet.
 */
import { RONDO_LIMITS } from './limits.ts';

/** The upstream commit packages/rondo/upstream was taken from (UPSTREAM.md). */
export const UPSTREAM_COMMIT = 'fbbf6512df37501308ab6a738b2e00fc183dd5ec';
/** Lolly's adapter revision on top of that commit. Raise it when a patch or the wire format changes. */
export const ADAPTER_REVISION = 1;

export const RONDO_EXTENSION = Object.freeze({
  namespace: 'rondocode',
  publisher: 'rondocode by Vijay Pemmaraju (MIT); Lolly adapter',
  version: `${UPSTREAM_COMMIT.slice(0, 12)}+lolly.${ADAPTER_REVISION}`,
  schemas: [{ record: 'RondoSourceV1', schemaVersion: 1, file: '.rondo.json' }],
  dependencies: {
    // A song asset reads its own bytes and nothing else in the document.
    rows: ['the asset bytes'],
    collections: [],
    global: ['the requested seconds'],
  },
  stages: ['inspect', 'evaluate', 'render'],
  execution: {
    // The song's code. The DSP that reads the staged data runs no song code.
    code: ['vm'],
  },
  powers: [] as string[],
  outputs: [
    {
      target: 'audio',
      channels: 2,
      sampleRate: RONDO_LIMITS.sampleRate,
      maxSeconds: RONDO_LIMITS.maxSeconds,
      means: 'stereo PCM; parts the render cannot play are named, never silently dropped',
    },
  ],
  compatibility: { record: 'RondoSourceV1 schemaVersion 1', upstreamImport: 'rondocode reads name and code from the same file' },
});
