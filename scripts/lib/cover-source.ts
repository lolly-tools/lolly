// SPDX-License-Identifier: MPL-2.0
/**
 * What a gallery cover bake was drawn from, in a form a plain script can read again.
 *
 * A baked cover reaches only a visitor whose context hash matches the bake
 * (shells/web/src/lib/gallery-covers.ts). That hash takes in every resolved token, so one
 * edit to a token document retires every baked file at once, and nothing in the
 * repository shows that happened: the gallery falls back to live renders and looks the
 * same, only slower. The fingerprint here is the part of that context a script can see,
 * the checksum of each token document in the asset index. The bake records the value and
 * validate-catalog compares, so a retired bake fails a check.
 *
 * The manifest holds the value as `source.fingerprint`. It is not called `tokens`: a key
 * with that word beside a hex string reads as a credential to the secret scanner
 * (gitleaks generic-api-key), which fails the history scan for a hash that is no secret.
 */
import { createHash } from 'node:crypto';

interface IndexedAsset { id?: string; type?: string; formats?: Array<{ checksum?: string }> }

export function coverSourceFingerprint(assets: readonly IndexedAsset[]): string {
  const rows = assets
    .filter((a) => a.type === 'tokens' && typeof a.id === 'string')
    .map((a) => `${a.id}\t${(a.formats ?? []).map((f) => f.checksum ?? '').join(',')}`)
    .sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 32);
}
