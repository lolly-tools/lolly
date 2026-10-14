#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Verify the catalog and every signed tool file from an extracted release. */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogSignatureEnvelope } from '../engine/src/catalog-integrity.ts';
import {
  importSpkiOrJwkPublicKey,
  verifyCatalogEnvelope,
  verifyToolFile, sha256Hex, catalogIndexPath, toolDirectoryHash, toolDirectoryPath,
} from '../engine/src/catalog-integrity.ts';

/** Signed metadata never substitutes for checking the actual published originals. */
function verifyAssetBytes(root: string, text: string): void {
  const index = JSON.parse(text) as { assets?: Array<{ formats?: Array<{ url: string; checksum: string }>; locales?: Record<string, Array<{ url: string; checksum: string }>> }> };
  if (!Array.isArray(index.assets)) throw new Error('Signed asset index has no assets list');
  for (const asset of index.assets) for (const format of [...(asset.formats ?? []), ...Object.values(asset.locales ?? {}).flat()]) {
    if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(format.checksum)) throw new Error('Asset format has no SHA-256 checksum');
    if (!format.url.startsWith('/catalog/')) continue;
    if (/[\\%?#\p{White_Space}\p{Cc}]/u.test(format.url) || format.url.slice(1).split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe asset URL');
    const bytes = readFileSync(contained(root, format.url.slice(1)));
    const actual = 'sha256-' + createHash('sha256').update(bytes).digest('base64');
    if (actual !== format.checksum) throw new Error('A catalog asset does not match its checksum');
  }
}

function contained(root: string, path: string): string {
  const absolute = realpathSync(resolve(root, path));
  const rel = relative(root, absolute);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error('Release file escapes its root');
  return absolute;
}

export async function verifyReleaseCatalog(
  directory: string,
  publicMaterial: string
): Promise<{
  verified: true;
  files: number;
  tools: number;
  indexSha256: string;
  keyId: string;
}> {
  const root = realpathSync(directory);
  const jwk = JSON.parse(publicMaterial) as JsonWebKey;
  if (jwk?.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y || jwk.d !== undefined) {
    throw new Error('Expected a public P-256 JWK without private material');
  }
  const publicKey = await importSpkiOrJwkPublicKey(jwk);
  const envelope = JSON.parse(
    readFileSync(contained(root, 'catalog/tools/index.sig.json'), 'utf8')
  ) as CatalogSignatureEnvelope;
  const index = readFileSync(contained(root, 'catalog/tools/index.json'));
  const verified = await verifyCatalogEnvelope(envelope, index, publicKey);
  if (!verified.ok) throw new Error('Release catalog signature or index digest did not verify');
  for (const [digest, kind, path] of [
    [envelope.indexHash, 'tools', 'catalog/tools/index.json'],
    [envelope.assetIndexHash, 'assets', 'catalog/assets/index.json'],
    [envelope.slimHash, 'slim', 'catalog/tools/index.slim.json'],
  ] as const) {
    if (!digest) continue;
    const bytes = readFileSync(contained(root, path));
    if (await sha256Hex(bytes) !== digest) throw new Error('A catalog index does not match its signed digest');
    // Hash URLs are required for materialized releases, legacy envelopes remain valid.
    if (envelope.toolDirs && await sha256Hex(readFileSync(contained(root, catalogIndexPath(digest, kind).slice(1)))) !== digest) throw new Error('A hash-addressed catalog index did not verify');
  }
  const paths = Object.keys(envelope.files);
  if (paths.length === 0) throw new Error('Release catalog contains no signed tool files');
  const tools = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    if (
      parts.length < 2 ||
      parts.some((p) => !p || p === '.' || p === '..') ||
      path.includes('\\')
    ) {
      throw new Error('Unsafe signed tool path');
    }
    const toolId = parts[0]!;
    const filename = parts.slice(1).join('/');
    const bytes = readFileSync(contained(root, `tools/${path}`));
    const result = await verifyToolFile(envelope, toolId, filename, bytes);
    if (!result.ok) throw new Error('A signed tool file did not verify');
    if (envelope.toolDirs?.[toolId]) {
      const addressed = readFileSync(contained(root, `${toolDirectoryPath(envelope, toolId).slice(1)}/${filename}`));
      if (!(await verifyToolFile(envelope, toolId, filename, addressed)).ok) throw new Error('A hash-addressed tool file did not verify');
    }
    tools.add(toolId);
  }
  for (const [id, digest] of Object.entries(envelope.toolDirs ?? {})) {
    if (await toolDirectoryHash(envelope.files, id) !== digest) throw new Error('A tool directory does not match its signed identity');
  }
  for (const [path, digest] of Object.entries(envelope.resources ?? {})) {
    if (!/^\/(?:catalog\/(?:previews|og)|info\/shots)\//.test(path) || !/^[0-9a-f]{64}$/.test(digest)
      || await sha256Hex(readFileSync(contained(root, path.slice(1)))) !== digest) throw new Error('A public resource did not verify');
  }
  if (envelope.assetIndexHash) verifyAssetBytes(root, readFileSync(contained(root, 'catalog/assets/index.json'), 'utf8'));
  return {
    verified: true,
    files: paths.length,
    tools: tools.size,
    indexSha256: createHash('sha256').update(index).digest('hex'),
    keyId: envelope.keyId,
  };
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  if (args.includes('--help')) {
    console.log(
      'Usage: node scripts/verify-release-catalog.ts --root extracted-dist [--public-key public.jwk.json]\nWithout --public-key, reads VITE_CATALOG_PUBLIC_KEY_JWK from the build environment.'
    );
    return 0;
  }
  const values = new Map<string, string>();
  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (
        !['--root', '--public-key'].includes(arg) ||
        values.has(arg) ||
        !args[i + 1] ||
        args[i + 1]!.startsWith('--')
      )
        throw new Error();
      values.set(arg, args[++i]!);
    }
    if (!values.has('--root')) throw new Error();
    const publicMaterial = values.has('--public-key')
      ? readFileSync(values.get('--public-key')!, 'utf8')
      : process.env.VITE_CATALOG_PUBLIC_KEY_JWK;
    if (!publicMaterial) throw new Error();
    console.log(
      JSON.stringify(await verifyReleaseCatalog(values.get('--root')!, publicMaterial), null, 2)
    );
    return 0;
  } catch {
    console.error(
      'Release verification failed: check the public pin, signature, index and signed files. No key material or input contents are logged.'
    );
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main();
