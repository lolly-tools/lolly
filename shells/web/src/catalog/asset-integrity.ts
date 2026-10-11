// SPDX-License-Identifier: MPL-2.0
/** Signed provider metadata does not attest to the bytes returned by its proxy. */
export type AssetFormatIntegrity =
  | { kind: 'content'; checksum: string }
  | { kind: 'provider-reference' }
  | { kind: 'invalid'; reason: string };

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const segment = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,255}$/.test(value);
const invalid = (): AssetFormatIntegrity => ({ kind: 'invalid', reason: 'a signed asset format has no SHA-256 checksum' });

/** Call only after verifying the signature and the exact asset-index digest. */
export function assetFormatIntegrity(asset: unknown, format: unknown, catalogScope?: string): AssetFormatIntegrity {
  if (!record(format)) return invalid();
  if (format.checksum !== undefined) {
    // The final base64 digit must have zero padding bits for a 32-byte digest.
    return typeof format.checksum === 'string' && /^sha256-[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(format.checksum)
      ? { kind: 'content', checksum: format.checksum } : invalid();
  }
  if (!catalogScope || !/^[0-9a-f]{64}$/.test(catalogScope) || !record(asset)
    || !segment(asset.provider) || typeof asset.id !== 'string'
    || typeof asset.version !== 'string' || !/^[0-9a-f]{16}$/.test(asset.version)
    || typeof format.url !== 'string') return invalid();
  const identity = asset.id.split('/');
  if (identity.length !== 3 || identity[0] !== 'ext' || identity[1] !== asset.provider || !segment(identity[2])) return invalid();
  const prefix = `/catalog/${asset.id}/`;
  if (!format.url.startsWith(prefix) || !segment(format.url.slice(prefix.length))) return invalid();
  return { kind: 'provider-reference' };
}

/** Local formats need byte hashes; scoped provider rows need a matching proxy identity. */
export function assetIndexIntegrity(index: unknown, catalogScope?: string): string | undefined {
  if (!record(index) || !Array.isArray(index.assets)) return 'the signed asset index has no assets list';
  for (const asset of index.assets) {
    if (!record(asset) || (asset.formats !== undefined && !Array.isArray(asset.formats))
      || (asset.locales !== undefined && !record(asset.locales))) return 'the signed asset formats are invalid';
    const localized = Object.values(asset.locales ?? {});
    if (localized.some(formats => !Array.isArray(formats))) return 'the signed asset formats are invalid';
    for (const format of [...(asset.formats ?? []), ...localized.flat()]) {
      const integrity = assetFormatIntegrity(asset, format, catalogScope);
      if (integrity.kind === 'invalid') return integrity.reason;
    }
  }
  return undefined;
}
