// SPDX-License-Identifier: MPL-2.0
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../engine/src/canonical-json.ts';
import type { CatalogSignatureEnvelope } from '../engine/src/catalog-integrity.ts';

const RECEIPT = 'release-frontend.sig.json';
const TARGETS = ['web', 'tauri-desktop', 'tauri-mobile'];
interface FrontendReceipt {
  kind: 'lolly-release-frontend';
  version: 1;
  source: string;
  target: string;
  profile: string;
  files: Record<string, string>;
  signature?: string;
}

function fileDigests(root: string): Record<string, string> {
  const files: Record<string, string> = Object.create(null);
  let count = 0;
  const walk = (directory: string, prefix: string, depth: number): void => {
    if (depth > 32) throw new Error('The frontend directory is too deep.');
    for (const name of readdirSync(directory).sort()) {
      if (!prefix && name === RECEIPT) continue;
      const path = prefix + name;
      if (++count > 100000 || /[\\\p{Cc}]/u.test(path)) throw new Error('The frontend directory is invalid.');
      const file = join(directory, name), state = lstatSync(file);
      if (state.isSymbolicLink()) throw new Error('Frontend files must not be symbolic links.');
      if (state.isDirectory()) walk(file, path + '/', depth + 1);
      else if (state.isFile()) files[path] = createHash('sha256').update(readFileSync(file)).digest('hex');
      else throw new Error('The frontend contains a non-regular file.');
    }
  };
  walk(root, '', 0);
  if (!files['index.html'] || !files['catalog/tools/index.sig.json']) throw new Error('The signed frontend is incomplete.');
  return files;
}

function publicKey(material: string) {
  const jwk = JSON.parse(material);
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y || jwk.d !== undefined) throw new Error('A public P-256 pin is required.');
  return { jwk, key: createPublicKey({ key: jwk, format: 'jwk' }) };
}

export function writeFrontendReceipt(root: string, source: string, target: string, profile: string, privateMaterial: string, publicMaterial: string): void {
  if (!/^[a-f0-9]{40}$/.test(source) || !TARGETS.includes(target) || !profile) throw new Error('The frontend source, target or profile is invalid.');
  const privateKey = privateMaterial.trim().startsWith('{')
    ? createPrivateKey({ key: JSON.parse(privateMaterial), format: 'jwk' }) : createPrivateKey(privateMaterial);
  const pin = publicKey(publicMaterial);
  const actual = createPublicKey(privateKey).export({ format: 'jwk' });
  if ((['kty', 'crv', 'x', 'y'] as const).some(field => actual[field] !== pin.jwk[field])) throw new Error('The signing identity differs from the public pin.');
  const receipt: FrontendReceipt = { kind: 'lolly-release-frontend', version: 1, source, target, profile, files: fileDigests(root) };
  receipt.signature = sign('sha256', Buffer.from(canonicalJson(receipt)), privateKey).toString('base64');
  writeFileSync(join(root, RECEIPT), JSON.stringify(receipt, null, 2) + '\n');
}

export function verifyFrontendReceipt(root: string, source: string, target: string, profile: string, publicMaterial: string): void {
  const receipt = JSON.parse(readFileSync(join(root, RECEIPT), 'utf8')) as FrontendReceipt;
  const { signature, ...body } = receipt;
  if (receipt.kind !== 'lolly-release-frontend' || receipt.version !== 1 || receipt.source !== source || receipt.target !== target || receipt.profile !== profile ||
    typeof signature !== 'string' || !verify('sha256', Buffer.from(canonicalJson(body)), publicKey(publicMaterial).key, Buffer.from(signature, 'base64'))) {
    throw new Error('The frontend signature does not match this source, target and profile.');
  }
  if (canonicalJson(receipt.files) !== canonicalJson(fileDigests(root))) throw new Error('The frontend bytes differ from the signed artifact.');
}

export function checkoutSource(root: string): string {
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, env: { PATH: process.env.PATH }, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(source) || process.env.GITHUB_SHA && process.env.GITHUB_SHA !== source) throw new Error('The checkout differs from the workflow source.');
  return source;
}

export async function verifySignedSourceCatalog(publicMaterial: string): Promise<void> {
  const { catalogFile, readToolManifestText, toolFile } = await import('../packages/node-shell/src/content-roots.ts');
  const { importSpkiOrJwkPublicKey, verifyCatalogEnvelope, verifyToolFile } = await import('../engine/src/catalog-integrity.ts');
  const envelope = JSON.parse(readFileSync(catalogFile('tools/index.sig.json'), 'utf8')) as CatalogSignatureEnvelope;
  const pin = await importSpkiOrJwkPublicKey(publicMaterial);
  if (!(await verifyCatalogEnvelope(envelope, readFileSync(catalogFile('tools/index.json')), pin)).ok) throw new Error('The source catalog does not match the public pin.');
  for (const path of Object.keys(envelope.files)) {
    const slash = path.indexOf('/'), id = path.slice(0, slash), filename = path.slice(slash + 1);
    const file = toolFile(id, filename);
    if (!file) throw new Error('A signed source file is missing.');
    const bytes = filename === 'tool.json' ? new TextEncoder().encode(readToolManifestText(id)) : readFileSync(file);
    if (!(await verifyToolFile(envelope, id, filename, bytes)).ok) throw new Error('The source files differ from the signed catalog.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const verifyOnly = args[0] === '--verify';
    const [target, directory] = verifyOnly ? args.slice(1) : args;
    const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
    if (!target || !directory || (verifyOnly ? args.length !== 3 : args.length !== 2)) throw new Error();
    if (verifyOnly) {
      const source = process.env.LOLLY_RELEASE_SOURCE ?? checkoutSource(root);
      if (!/^[a-f0-9]{40}$/.test(source) || !TARGETS.includes(target)) throw new Error();
      verifyFrontendReceipt(resolve(directory), source, target, process.env.LOLLY_PROFILE ?? 'lolly-start', process.env.VITE_CATALOG_PUBLIC_KEY_JWK ?? '');
    } else {
      writeFrontendReceipt(resolve(directory), checkoutSource(root), target, process.env.LOLLY_PROFILE ?? 'lolly-start',
        process.env.LOLLY_CATALOG_SIGNING_KEY ?? '', process.env.VITE_CATALOG_PUBLIC_KEY_JWK ?? '');
    }
  } catch {
    console.error('Frontend verification or signing failed: check the source, target, public pin and artifact files.');
    process.exitCode = 1;
  }
}
