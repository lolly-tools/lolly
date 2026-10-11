// SPDX-License-Identifier: MPL-2.0
/** Runtime URL resolution after the engine verifies the original tool source. */
import { toolDirectoryPath } from '../../../../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../../../../engine/src/catalog-integrity.ts';

/** Strings assembled by scripts, workers and import() share the signed directory prefix. */
export function resolveVerifiedToolReferences(text: string, envelope: CatalogSignatureEnvelope,
  instancePath: (path: string) => string = path => path): string {
  return text.replace(/(?<![a-z0-9./:-])(https?:\/\/[^/\s"'<>]+)?\/tools\/([a-z0-9][a-z0-9-]*)\//gi,
    (source, origin: string | undefined, id: string) => {
      if (!envelope.toolDirs?.[id]) return source;
      const target = instancePath(toolDirectoryPath(envelope, id));
      if (origin && new URL(origin).origin !== new URL(target, globalThis.location?.origin ?? 'http://localhost').origin) return source;
      return target + '/';
    });
}
