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
  verifyToolFile,
} from '../engine/src/catalog-integrity.ts';

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
    tools.add(toolId);
  }
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
