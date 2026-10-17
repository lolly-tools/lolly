// SPDX-License-Identifier: MPL-2.0
/** Public probe samples derived from a live signed catalog. Requests never carry credentials. */
import { createHash } from 'node:crypto';
import { catalogEnvelopeShape, catalogFreshness, catalogIndexPath, importSpkiOrJwkPublicKey, verifyEnvelopeSignature } from '../../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../../engine/src/catalog-integrity.ts';
import type { ProbeSample } from '../edge-probe.ts';

export interface CatalogSampleOptions { rotation?: number; tools?: number; resources?: number; assets?: number }
export interface CatalogDerivation {
  origin: string; path: string; cls: 'public-revalidate'; method: 'GET'; kind: 'catalog-derivation';
  catalog?: { keyId: string; signedAt: string; seq?: number; signature: 'verified' | 'unchecked' | 'refused'; rotation: number; samples: number };
  observations: Array<{ reader: number; coding: string; status?: number; failures: string[] }>;
  passed: boolean;
}
interface AssetSample { url: string; sha256: string; size: number }

const SIGNATURE_PATH = '/catalog/tools/index.sig.json';
const MAX_INDEX_BYTES = 16 * 1024 * 1024;
const MAX_ASSET_SAMPLE_BYTES = 8 * 1024 * 1024;
const HASHED = /\.([0-9a-f]{16})(\.[a-z0-9]{1,12})$/i;
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const byKey = <T>(key: (item: T) => string) => (a: T, b: T): number => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
const safeCatalogPath = (path: string): boolean => path.startsWith('/catalog/') && path.length <= 1024
  && !/[\\%?#\p{White_Space}\p{Cc}]/u.test(path) && path.slice(1).split('/').every(part => !!part && part !== '.' && part !== '..');

/** A stable daily window over sorted entries; successive rotations cover every entry. */
export function rotatingWindow<T>(items: readonly T[], count: number, rotation: number): T[] {
  if (!items.length || count <= 0) return [];
  const size = Math.min(count, items.length), start = ((rotation * size) % items.length + items.length) % items.length;
  return Array.from({ length: size }, (_, i) => items[(start + i) % items.length]!);
}

/** A 16-hex address matching no signed digest, so a 200 there is a fallback, not a file. */
export function absentHash16(known: Iterable<string>): string {
  const prefixes = new Set([...known].map(value => value.slice(0, 16)));
  const free = [...'0123456789abcdef'].map(c => c.repeat(16)).find(value => !prefixes.has(value));
  if (!free) throw new Error('No absent probe address is available');
  return free;
}

/** Content-addressed originals whose full sha256 comes from the signed asset index. */
function assetSamples(index: unknown): AssetSample[] {
  const assets = (index as { assets?: unknown } | undefined)?.assets;
  if (!Array.isArray(assets)) return [];
  const found = new Map<string, AssetSample>();
  for (const asset of assets as Array<{ formats?: unknown; locales?: unknown }>) {
    const locales = asset?.locales && typeof asset.locales === 'object' ? Object.values(asset.locales as Record<string, unknown>) : [];
    for (const input of [asset?.formats, ...locales].flatMap(list => (Array.isArray(list) ? list : []))) {
      const format = input as { url?: unknown; checksum?: unknown; size?: unknown };
      if (typeof format?.url !== 'string' || typeof format.checksum !== 'string' || !Number.isSafeInteger(format.size) || !safeCatalogPath(format.url)) continue;
      const match = /^sha256-([A-Za-z0-9+/]{43}=)$/.exec(format.checksum), digest = match ? Buffer.from(match[1]!, 'base64').toString('hex') : '';
      if (digest.length !== 64 || HASHED.exec(format.url)?.[1] !== digest.slice(0, 16)) continue;
      found.set(format.url, { url: format.url, sha256: digest, size: format.size as number });
    }
  }
  return [...found.values()].sort(byKey(item => item.url));
}

/**
 * Samples for one public catalog: the signature and index pair, rotating tool,
 * preview and asset files at their hashed addresses with their legacy names
 * revalidated, and a missing address in each hashed family.
 */
export function catalogProbeSamples(origin: string, envelope: CatalogSignatureEnvelope, assetIndex?: unknown, options: CatalogSampleOptions = {}): ProbeSample[] {
  const rotation = options.rotation ?? 0;
  const immutable = { origin, cls: 'public-immutable' as const, checkConditional: true, requireStrongETag: true };
  const revalidate = { origin, cls: 'public-revalidate' as const, checkConditional: true, requireStrongETag: true };
  const missing = { origin, cls: 'public-immutable' as const, status: 404 };
  const samples: ProbeSample[] = [{ ...revalidate, path: SIGNATURE_PATH, compress: true }];
  for (const [hash, kind, legacy] of [[envelope.indexHash, 'tools', '/catalog/tools/index.json'], [envelope.assetIndexHash, 'assets', '/catalog/assets/index.json'], [envelope.slimHash, 'slim', '/catalog/tools/index.slim.json']] as const) {
    if (hash) samples.push({ ...immutable, path: catalogIndexPath(hash, kind), sha256: hash, compress: true }, { ...revalidate, path: legacy, sha256: hash, compress: true });
  }
  const tools = Object.entries(envelope.toolDirs ?? {}).filter(([id]) => typeof envelope.files[`${id}/tool.json`] === 'string').sort(byKey(([id]) => id));
  const pickedTools = rotatingWindow(tools, options.tools ?? 4, rotation);
  for (const [id, dir] of pickedTools) {
    const sha256 = envelope.files[`${id}/tool.json`]!;
    samples.push({ ...immutable, path: `/tools/${id}@${dir.slice(0, 16)}/tool.json`, sha256, compress: true }, { ...revalidate, path: `/tools/${id}/tool.json`, sha256, compress: true });
  }
  const resources = Object.entries(envelope.resources ?? {}).filter(([path, hash]) => HASHED.exec(path)?.[1] === hash.slice(0, 16)).sort(byKey(([path]) => path));
  const pickedResources = rotatingWindow(resources, options.resources ?? 3, rotation);
  for (const [path, sha256] of pickedResources) {
    samples.push({ ...immutable, path, sha256 });
    const legacy = path.replace(HASHED, '$2');
    // Unhashed names stay for old references and must revalidate to the same bytes.
    if (envelope.resources?.[legacy] === sha256) samples.push({ ...revalidate, path: legacy, sha256 });
  }
  const assets = assetSamples(assetIndex).filter(asset => asset.size <= MAX_ASSET_SAMPLE_BYTES);
  const pickedAssets = rotatingWindow(assets, options.assets ?? 3, rotation);
  for (const asset of pickedAssets) samples.push({ ...immutable, path: asset.url, sha256: asset.sha256, size: asset.size });
  const absent = absentHash16([envelope.indexHash, envelope.assetIndexHash ?? '', envelope.slimHash ?? '', ...Object.values(envelope.toolDirs ?? {}),
    ...Object.values(envelope.resources ?? {}), ...assetSamples(assetIndex).map(asset => asset.sha256)].filter(Boolean));
  samples.push({ ...missing, path: `/catalog/tools/index.${absent}.json` });
  if (pickedTools[0]) samples.push({ ...missing, path: `/tools/${pickedTools[0][0]}@${absent}/tool.json` });
  if (pickedResources[0]) samples.push({ ...missing, path: pickedResources[0][0].replace(HASHED, `.${absent}$2`) });
  if (pickedAssets[0]) samples.push({ ...missing, path: pickedAssets[0].url.replace(HASHED, `.${absent}$2`) });
  return samples;
}

/**
 * Whether a derived sample checks everything a planned one at the same URL does.
 * A reviewed sample with a credential, range, C2PA, CORS or age check, or with a
 * different expectation, runs alongside the derived one instead of being dropped.
 */
export function derivedSampleCovers(planned: ProbeSample, derived: ProbeSample): boolean {
  if (planned.credentialEnv || planned.checkRange || planned.stripC2pa || planned.requireCors || planned.boundedAgeSec !== undefined) return false;
  if ((['compress', 'checkConditional', 'requireStrongETag'] as const).some(check => planned[check] && !derived[check])) return false;
  return planned.cls === derived.cls && (planned.status ?? 200) === (derived.status ?? 200) && (planned.method ?? 'GET') === (derived.method ?? 'GET')
    && (planned.sha256 ?? derived.sha256) === derived.sha256 && (planned.size ?? derived.size) === derived.size;
}

/** Bounded so a dishonest Content-Length cannot make derivation unbounded. */
async function boundedBytes(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_INDEX_BYTES) throw new Error('Catalog index exceeds the probe limit');
      chunks.push(item.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/**
 * Fetch the public signature, verify it against the pinned key when one is
 * configured, read the hashed asset index it names and derive samples. A
 * private or scoped catalog yields no samples: those belong to private probes.
 */
export async function deriveCatalogSamples(origin: string, options: CatalogSampleOptions & { publicKey?: string; fetcher?: typeof fetch; now?: number } = {}): Promise<{ samples: ProbeSample[]; result: CatalogDerivation }> {
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now();
  const rotation = options.rotation ?? Math.floor(now / 86_400_000);
  const failures: string[] = [];
  let status: number | undefined, samples: ProbeSample[] = [], catalog: CatalogDerivation['catalog'];
  const get = async (path: string): Promise<{ status: number; bytes?: Uint8Array }> => {
    const response = await fetcher(new URL(path, origin), { method: 'GET', headers: { 'Accept-Encoding': 'identity' }, credentials: 'omit', redirect: 'manual', signal: AbortSignal.timeout(30_000), cache: 'no-cache' });
    if (response.status !== 200) { await response.body?.cancel(); return { status: response.status }; }
    return { status: response.status, bytes: await boundedBytes(response) };
  };
  try {
    const signature = await get(SIGNATURE_PATH);
    status = signature.status;
    if (!signature.bytes) failures.push([401, 403].includes(signature.status) ? 'catalog-not-public' : 'catalog-signature-status');
    else {
      const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(signature.bytes)) as CatalogSignatureEnvelope;
      if (!catalogEnvelopeShape(envelope).ok || typeof envelope.keyId !== 'string' || typeof envelope.signature !== 'string') failures.push('catalog-envelope-shape');
      else if (envelope.catalogScope !== undefined) failures.push('catalog-not-public');
      else {
        let checked: 'verified' | 'unchecked' | 'refused' = 'unchecked', key: CryptoKey | undefined;
        try { key = options.publicKey ? await importSpkiOrJwkPublicKey(options.publicKey) : undefined; } catch { failures.push('catalog-key'); }
        if (!options.publicKey) failures.push('catalog-signature-unchecked');
        else if (key && (await verifyEnvelopeSignature(envelope, key)).ok) checked = 'verified';
        else { checked = 'refused'; failures.push('catalog-signature'); }
        if (!catalogFreshness(envelope, null, now).ok) failures.push('catalog-expired');
        let assetIndex: unknown;
        if (envelope.assetIndexHash && !failures.includes('catalog-signature')) {
          const assets = await get(catalogIndexPath(envelope.assetIndexHash, 'assets'));
          if (assets.bytes && sha(assets.bytes) === envelope.assetIndexHash) assetIndex = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(assets.bytes));
          else failures.push('catalog-asset-index');
        }
        // A forged envelope must not choose what the probe expects.
        if (!failures.includes('catalog-signature')) samples = catalogProbeSamples(origin, envelope, assetIndex, { ...options, rotation });
        catalog = { keyId: envelope.keyId, signedAt: envelope.signedAt, ...(envelope.seq !== undefined ? { seq: envelope.seq } : {}), signature: checked, rotation, samples: samples.length };
      }
    }
  } catch { failures.push('catalog-derivation-failed'); }
  return {
    samples,
    result: { origin: new URL(origin).origin, path: SIGNATURE_PATH, cls: 'public-revalidate', method: 'GET', kind: 'catalog-derivation', ...(catalog ? { catalog } : {}),
      observations: [{ reader: 0, coding: 'identity', ...(status !== undefined ? { status } : {}), failures }], passed: failures.length === 0 },
  };
}
