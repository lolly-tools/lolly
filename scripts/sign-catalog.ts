#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog signer.
 *
 * Run as: node scripts/sign-catalog.ts
 *
 * Produces `catalog/tools/index.sig.json` - the signed integrity envelope the
 * engine verifies at runtime before executing any tool code (see
 * engine/src/catalog-integrity.ts for the envelope format and
 * engine/src/loader.ts `LoadToolOpts.integrity` for enforcement). It hashes
 * every tool file the loader can fetch (tool.json, template.html, styles.css,
 * hooks.js, template.{ics,vcf,csv,md}, plus each i18n/<lang>.json sidecar the
 * tool ships) plus the exact bytes of catalog/tools/index.json, then signs the
 * canonical-JSON envelope with ECDSA P-256/SHA-256.
 *
 * Signing is a DEPLOYMENT decision: this script is never part of
 * build:catalog, and no key lives in the repo. Key sources, in order:
 *   --keyfile <path>                   PKCS8 PEM or JWK JSON file
 *   LOLLY_CATALOG_SIGNING_KEY          same content, via env (CI/KMS-injected)
 *
 * Other flags:
 *   --gen-key            generate a fresh P-256 keypair into keys/ (git-ignored;
 *                        private PKCS8 PEM + public JWK), print the public JWK
 *                        to pin in the deployment, and exit. Refuses to
 *                        overwrite an existing key.
 *   --tools <dir>        tools directory, plain (non-overlay) layout - overrides the
 *                        active profile's resolved tool packs entirely
 *                        (default: resolved from profiles.json via content-roots)
 *   --index <path>       tool index to bind     (default: the active profile's catalog/tools/index.json)
 *   --out <path>         envelope destination   (default: sibling index.sig.json of --index)
 *   --materialize        publish immutable URLs in an extracted build
 *   --previous-envelope <path> carry a verified published sequence floor
 *   --retain <build>     retain a reviewed previous immutable inventory
 *   --expires-at <ISO>   optional expiry; omitted catalogs work offline indefinitely
 *
 * Deterministic apart from signedAt + signature (ECDSA is randomised); re-run
 * after any tool or index change, BEFORE deploying - a stale envelope makes
 * every changed tool fail closed on clients that pin the key.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson, sha256Hex, jwkThumbprint, signCatalogEnvelope,
  importSpkiOrJwkPublicKey, verifyCatalogEnvelope,
  CATALOG_SIG_ALG, CATALOG_SIGNED_TOOL_FILES, CATALOG_SIGNED_I18N_SIDECAR,
  CATALOG_SIGNED_TEMPLATE_FILE, verifyEnvelopeSignature,
} from '../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope, UnsignedCatalogEnvelope } from '../engine/src/catalog-integrity.ts';
import { pemToDer, derToPem } from '../engine/src/x509.ts';
import {
  catalogFile, listToolFiles, readToolManifestText, toolDirs, toolFile,
} from '@lolly-tools/node-shell/content-roots';

import { catalogPublicResources, catalogToolFiles, materializeCatalogDelivery, publishCatalogIndexes, retainCatalogDelivery } from './materialize-catalog-delivery.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = join(ROOT, 'keys');
const subtle = globalThis.crypto.subtle;
const EC_P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;

interface Args {
  genKey: boolean;
  keyfile: string | null;
  /** A plain (non-overlay) tools directory, only when --tools is passed explicitly.
   *  null means "resolve the active profile's tool packs via content-roots". */
  toolsDir: string | null;
  indexPath: string;
  outPath: string | null;
  materialize: boolean;
  previousEnvelope: string | null;
  retain: string | null;
  expiresAt: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    genKey: false,
    keyfile: null,
    toolsDir: null,
    indexPath: catalogFile('tools/index.json'),
    outPath: null,
    materialize: false,
    previousEnvelope: null,
    retain: null,
    expiresAt: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (!v) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (flag === '--gen-key') args.genKey = true;
    else if (flag === '--keyfile') args.keyfile = resolve(next());
    else if (flag === '--tools') args.toolsDir = resolve(next());
    else if (flag === '--index') args.indexPath = resolve(next());
    else if (flag === '--out') args.outPath = resolve(next());
    else if (flag === '--materialize') args.materialize = true;
    else if (flag === '--previous-envelope') args.previousEnvelope = resolve(next());
    else if (flag === '--retain') args.retain = resolve(next());
    else if (flag === '--expires-at') {
      args.expiresAt = next();
      if (!Number.isFinite(Date.parse(args.expiresAt)) || Date.parse(args.expiresAt) <= Date.now()) throw new Error('--expires-at must be a future ISO timestamp');
    }
    else throw new Error(`unknown flag ${flag}`);
  }
  return args;
}

async function genKey(): Promise<void> {
  const privPath = join(KEYS_DIR, 'catalog-signing.key.pem');
  const pubPath = join(KEYS_DIR, 'catalog-signing.pub.jwk.json');
  if (existsSync(privPath)) {
    console.error(`✗ refusing to overwrite existing key: ${privPath}`);
    console.error('  Move or delete it first if you really mean to rotate.');
    process.exit(1);
  }
  const pair = await subtle.generateKey(EC_P256, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  const pubJwk = await subtle.exportKey('jwk', pair.publicKey);
  mkdirSync(KEYS_DIR, { recursive: true });
  writeFileSync(privPath, derToPem(pkcs8, 'PRIVATE KEY'), { mode: 0o600 });
  writeFileSync(pubPath, JSON.stringify(pubJwk, null, 2) + '\n');
  const keyId = await jwkThumbprint(pubJwk);
  console.log(`✓ wrote private key  ${privPath}  (git-ignored - NEVER commit it)`);
  console.log(`✓ wrote public JWK   ${pubPath}`);
  console.log(`  keyId (RFC 7638 thumbprint): ${keyId}`);
  console.log('\nPin this public JWK in the deployment (e.g. VITE_CATALOG_PUBLIC_KEY_JWK):');
  console.log(canonicalJson(pubJwk));
}

/** PKCS8 PEM or JWK JSON → an ECDSA P-256 signing key (extractable, so the
 *  public half - and therefore the keyId - can be derived from it). */
async function importPrivateKey(material: string): Promise<CryptoKey> {
  const trimmed = material.trim();
  if (trimmed.startsWith('{')) {
    return subtle.importKey('jwk', JSON.parse(trimmed) as JsonWebKey, EC_P256, true, ['sign']);
  }
  const pkcs8 = pemToDer(trimmed);
  return subtle.importKey('pkcs8', pkcs8.buffer as ArrayBuffer, EC_P256, true, ['sign']);
}

function loadKeyMaterial(args: Args): string {
  if (args.keyfile) return readFileSync(args.keyfile, 'utf8');
  const fromEnv = process.env.LOLLY_CATALOG_SIGNING_KEY;
  if (fromEnv) return fromEnv;
  const defaultKey = join(KEYS_DIR, 'catalog-signing.key.pem');
  if (existsSync(defaultKey)) return readFileSync(defaultKey, 'utf8');
  console.error('✗ no signing key. Provide one of:');
  console.error('    --keyfile <path>                (PKCS8 PEM or JWK JSON)');
  console.error('    LOLLY_CATALOG_SIGNING_KEY=…     (same content via env)');
  console.error(`    ${defaultKey}                   (from --gen-key)`);
  console.error('  or generate a fresh keypair: node scripts/sign-catalog.ts --gen-key');
  process.exit(1);
}

/** Tool ids = directories under toolsDir that contain a tool.json. */
function listToolIds(toolsDir: string): string[] {
  return readdirSync(toolsDir)
    .filter(name => {
      const dir = join(toolsDir, name);
      return /^[a-z0-9][a-z0-9-]*$/i.test(name) && statSync(dir).isDirectory() && existsSync(join(dir, 'tool.json'));
    })
    .sort();
}

async function signedToolFiles(args: Args): Promise<{ files: Record<string, string>; toolIds: string[] }> {
  const files: Record<string, string> = {};
  let toolIds: string[];
  if (args.toolsDir) {
    // Explicit --tools: a plain, non-overlay directory (the shape a materialized
    // dist tree or a test fixture uses) - read straight off disk, as before.
    const toolsDir = args.toolsDir;
    toolIds = listToolIds(toolsDir);
    for (const id of toolIds) {
      for (const filename of CATALOG_SIGNED_TOOL_FILES) {
        const path = join(toolsDir, id, filename);
        if (!existsSync(path)) continue;
        files[`${id}/${filename}`] = await sha256Hex(readFileSync(path));
      }
      // i18n sidecars are per-language and optional per tool - enumerate whatever
      // exists (sorted for a deterministic envelope) rather than a fixed list.
      // Without these digests a signed catalog forces every tool back to English
      // (loader.ts drops any overlay it can't verify).
      const i18nDir = join(toolsDir, id, 'i18n');
      if (existsSync(i18nDir) && statSync(i18nDir).isDirectory()) {
        for (const name of readdirSync(i18nDir).sort()) {
          if (!CATALOG_SIGNED_I18N_SIDECAR.test(`i18n/${name}`)) continue;
          files[`${id}/i18n/${name}`] = await sha256Hex(readFileSync(join(i18nDir, name)));
        }
      }
      // Starter templates, enumerated the same way and for the same reason: optional,
      // per tool, and any number of them. Their `values` decide what a new document
      // opens as, so leaving them out of the envelope leaves the one file a hostile
      // catalog could rewrite while every signed file still verified.
      const templatesDir = join(toolsDir, id, 'templates');
      if (!existsSync(templatesDir) || !statSync(templatesDir).isDirectory()) continue;
      for (const name of readdirSync(templatesDir).sort()) {
        if (!CATALOG_SIGNED_TEMPLATE_FILE.test(`templates/${name}`)) continue;
        files[`${id}/templates/${name}`] = await sha256Hex(readFileSync(join(templatesDir, name)));
      }
    }
  } else {
    // No --tools: resolve the active profile's tool packs through content-roots,
    // overlay-aware (a brand tool.json may `extends: "community"` and carry only
    // the files that differ - listToolFiles/toolFile apply that union, the same
    // one scripts/use-profile.ts used to bake into the tools/ view).
    toolIds = [...toolDirs().keys()].sort();
    for (const id of toolIds) {
      for (const filename of CATALOG_SIGNED_TOOL_FILES) {
        const path = toolFile(id, filename);
        if (!path) continue;
        // tool.json is hashed as the COMPOSED manifest text, not as the bytes on
        // disk: an overlay's file still carries its `extends` member, and dist,
        // the dev server and readToolText all serve the stripped form. Hashing
        // the raw overlay would sign a manifest no client ever receives, and a
        // release build would then fail its own verify-release-catalog step.
        const bytes = filename === 'tool.json'
          ? new TextEncoder().encode(readToolManifestText(id))
          : readFileSync(path);
        files[`${id}/${filename}`] = await sha256Hex(bytes);
      }
      for (const rel of listToolFiles(id)) {
        const signed = (rel.startsWith('i18n/') && CATALOG_SIGNED_I18N_SIDECAR.test(rel))
          || (rel.startsWith('templates/') && CATALOG_SIGNED_TEMPLATE_FILE.test(rel));
        if (!signed) continue;
        const path = toolFile(id, rel);
        if (!path) continue;
        files[`${id}/${rel}`] = await sha256Hex(readFileSync(path));
      }
    }
  }

  if (args.toolsDir) Object.assign(files, catalogToolFiles(args.toolsDir));
  else for (const id of toolIds) for (const rel of listToolFiles(id)) {
    if (rel === 'tool.json' || (rel.startsWith('i18n/') && !CATALOG_SIGNED_I18N_SIDECAR.test(rel)) || (rel.startsWith('templates/') && !CATALOG_SIGNED_TEMPLATE_FILE.test(rel))) continue;
    const path = toolFile(id, rel);
    if (path) files[`${id}/${rel}`] = await sha256Hex(readFileSync(path));
  }
  return { files, toolIds };
}

async function run(args: Args): Promise<void> {
  const privateKey = await importPrivateKey(loadKeyMaterial(args));
  // Public half from the private JWK: same x/y, minus d - gives the RFC 7638 keyId
  // and lets the script self-verify what it just signed.
  const privJwk = await subtle.exportKey('jwk', privateKey);
  const pubJwk: JsonWebKey = { kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y };
  const keyId = await jwkThumbprint(pubJwk);

  if (!existsSync(args.indexPath)) {
    console.error(`✗ tool index not found: ${args.indexPath} - run pnpm run build:catalog first`);
    process.exit(1);
  }
  const outPath = args.outPath ?? join(dirname(args.indexPath), 'index.sig.json');
  const buildRoot = resolve(dirname(args.indexPath), '../..');
  if (args.materialize && (!args.toolsDir || args.toolsDir !== join(buildRoot, 'tools') || args.indexPath !== join(buildRoot, 'catalog/tools/index.json'))) throw new Error('--materialize requires an explicit extracted build tools/index layout');
  if (args.retain && !args.materialize) throw new Error('--retain requires --materialize');
  const retained = args.retain ? retainCatalogDelivery(buildRoot, args.retain) : [];
  const materialized = args.materialize ? await materializeCatalogDelivery(buildRoot) : null;
  const indexBytes = readFileSync(args.indexPath);
  const indexHash = await sha256Hex(indexBytes);

  const { files, toolIds } = await signedToolFiles(args);
  const resources = catalogPublicResources(buildRoot);
  // A prior envelope is verified against the signing identity before its sequence is used.
  // Clean release worktrees must provide --previous-envelope to carry the published floor.
  const previousPath = args.previousEnvelope ?? (existsSync(outPath) ? outPath : null);
  let seq = 1;
  if (previousPath) {
    const previous = JSON.parse(readFileSync(previousPath, 'utf8')) as CatalogSignatureEnvelope;
    const verification = await verifyEnvelopeSignature(previous, await importSpkiOrJwkPublicKey(pubJwk));
    if (!verification.ok) throw new Error('Previous catalog envelope did not verify against the signing identity');
    seq = (previous.seq ?? 0) + 1;
    if (!Number.isSafeInteger(seq)) throw new Error('Catalog sequence exhausted');
  }
  const assetPath = join(dirname(args.indexPath), '../assets/index.json');
  const slimPath = join(dirname(args.indexPath), 'index.slim.json');
  const unsigned: UnsignedCatalogEnvelope = {
    alg: CATALOG_SIG_ALG,
    keyId,
    signedAt: new Date().toISOString(),
    indexHash,
    files, resources,
    seq,
    ...(args.expiresAt ? { expiresAt: args.expiresAt } : {}),
    ...(existsSync(assetPath) ? { assetIndexHash: await sha256Hex(readFileSync(assetPath)) } : {}),
    ...(existsSync(slimPath) ? { slimHash: await sha256Hex(readFileSync(slimPath)) } : {}),
    ...(materialized ? { toolDirs: materialized.toolDirs } : {}),
  };
  const envelope = await signCatalogEnvelope(unsigned, privateKey);

  // Self-check with the verifier the clients run, so a bad envelope can never ship.
  // When the deployment supplies its runtime pin, verify against THAT key rather
  // than only the public half we just derived. A mismatched private/public pair
  // would otherwise build successfully and make every released client fail closed.
  let publicKey = await importSpkiOrJwkPublicKey(pubJwk);
  const configuredPublicMaterial = process.env.VITE_CATALOG_PUBLIC_KEY_JWK?.trim();
  if (configuredPublicMaterial) {
    publicKey = await importSpkiOrJwkPublicKey(configuredPublicMaterial);
    const configuredJwk = await subtle.exportKey('jwk', publicKey);
    const configuredKeyId = await jwkThumbprint(configuredJwk);
    if (configuredKeyId !== keyId) {
      throw new Error(
        `catalog signing key does not match VITE_CATALOG_PUBLIC_KEY_JWK ` +
        `(signing keyId ${keyId}, configured keyId ${configuredKeyId})`,
      );
    }
  }
  const check = await verifyCatalogEnvelope(envelope, indexBytes, publicKey);
  if (!check.ok) {
    console.error(`✗ self-verification failed: ${check.reason}`);
    process.exit(1);
  }

  if (args.materialize) publishCatalogIndexes(buildRoot, envelope, [...retained, ...(materialized?.files ?? [])]);
  writeFileSync(outPath, JSON.stringify(envelope, null, 2) + '\n');
  console.log(`✓ signed ${toolIds.length} tools (${Object.keys(files).length} files) + index`);
  console.log(`  keyId: ${keyId}`);
  console.log(`  wrote: ${outPath}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.genKey) {
  await genKey();
} else {
  await run(args);
}
