#!/usr/bin/env node
/**
 * Catalog signer.
 *
 * Run as: node scripts/sign-catalog.ts
 *
 * Produces `catalog/tools/index.sig.json` — the signed integrity envelope the
 * engine verifies at runtime before executing any tool code (see
 * engine/src/catalog-integrity.ts for the envelope format and
 * engine/src/loader.ts `LoadToolOpts.integrity` for enforcement). It hashes
 * every tool file the loader can fetch (tool.json, template.html, styles.css,
 * hooks.js, template.{ics,vcf,csv,md}) plus the exact bytes of
 * catalog/tools/index.json, then signs the canonical-JSON envelope with
 * ECDSA P-256/SHA-256.
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
 *   --tools <dir>        tools directory        (default: <repo>/tools)
 *   --index <path>       tool index to bind     (default: <repo>/catalog/tools/index.json)
 *   --out <path>         envelope destination   (default: sibling index.sig.json of --index)
 *
 * Deterministic apart from signedAt + signature (ECDSA is randomised); re-run
 * after any tool or index change, BEFORE deploying — a stale envelope makes
 * every changed tool fail closed on clients that pin the key.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson, sha256Hex, jwkThumbprint, signCatalogEnvelope,
  importSpkiOrJwkPublicKey, verifyCatalogEnvelope,
  CATALOG_SIG_ALG, CATALOG_SIGNED_TOOL_FILES,
} from '../engine/src/catalog-integrity.ts';
import type { UnsignedCatalogEnvelope } from '../engine/src/catalog-integrity.ts';
import { pemToDer, derToPem } from '../engine/src/x509.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = join(ROOT, 'keys');
const subtle = globalThis.crypto.subtle;
const EC_P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;

interface Args {
  genKey: boolean;
  keyfile: string | null;
  toolsDir: string;
  indexPath: string;
  outPath: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    genKey: false,
    keyfile: null,
    toolsDir: join(ROOT, 'tools'),
    indexPath: join(ROOT, 'catalog/tools/index.json'),
    outPath: null,
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
  console.log(`✓ wrote private key  ${privPath}  (git-ignored — NEVER commit it)`);
  console.log(`✓ wrote public JWK   ${pubPath}`);
  console.log(`  keyId (RFC 7638 thumbprint): ${keyId}`);
  console.log('\nPin this public JWK in the deployment (e.g. VITE_CATALOG_PUBLIC_KEY_JWK):');
  console.log(canonicalJson(pubJwk));
}

/** PKCS8 PEM or JWK JSON → an ECDSA P-256 signing key (extractable, so the
 *  public half — and therefore the keyId — can be derived from it). */
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
      return statSync(dir).isDirectory() && existsSync(join(dir, 'tool.json'));
    })
    .sort();
}

async function run(args: Args): Promise<void> {
  const privateKey = await importPrivateKey(loadKeyMaterial(args));
  // Public half from the private JWK: same x/y, minus d — gives the RFC 7638 keyId
  // and lets the script self-verify what it just signed.
  const privJwk = await subtle.exportKey('jwk', privateKey);
  const pubJwk: JsonWebKey = { kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y };
  const keyId = await jwkThumbprint(pubJwk);

  if (!existsSync(args.indexPath)) {
    console.error(`✗ tool index not found: ${args.indexPath} — run npm run build:catalog first`);
    process.exit(1);
  }
  const indexBytes = readFileSync(args.indexPath);
  const indexHash = await sha256Hex(indexBytes);

  const files: Record<string, string> = {};
  const toolIds = listToolIds(args.toolsDir);
  for (const id of toolIds) {
    for (const filename of CATALOG_SIGNED_TOOL_FILES) {
      const path = join(args.toolsDir, id, filename);
      if (!existsSync(path)) continue;
      files[`${id}/${filename}`] = await sha256Hex(readFileSync(path));
    }
  }

  const unsigned: UnsignedCatalogEnvelope = {
    alg: CATALOG_SIG_ALG,
    keyId,
    signedAt: new Date().toISOString(),
    indexHash,
    files,
  };
  const envelope = await signCatalogEnvelope(unsigned, privateKey);

  // Self-check with the verifier the clients run, so a bad envelope can never ship.
  const publicKey = await importSpkiOrJwkPublicKey(pubJwk);
  const check = await verifyCatalogEnvelope(envelope, indexBytes, publicKey);
  if (!check.ok) {
    console.error(`✗ self-verification failed: ${check.reason}`);
    process.exit(1);
  }

  const outPath = args.outPath ?? join(dirname(args.indexPath), 'index.sig.json');
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
