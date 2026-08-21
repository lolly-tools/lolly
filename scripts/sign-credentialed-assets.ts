// SPDX-License-Identifier: MPL-2.0
/**
 * sign-credentialed-assets - stamp every stampable SUSE catalog asset in place as
 * "Delivered by Lolly": a c2pa.published (NOT created) claim under the Lolly CA
 * identity, recording each asset's TRUE author (Adobe Stock / SUSE / …). So every
 * official catalog download verifies as "Delivered by Lolly · Produced by <author>"
 * rather than reading as unknown/unsigned - and never as a false "Made with Lolly"
 * (that hero needs a c2pa.created action, which a delivered asset deliberately lacks).
 *
 * HISTORY: this script also used to MINT a small curated "Made with Lolly" demo set
 * under `suse/credentials/*` (styled icons/illustrations/photos with a real signed
 * manifest baked in, for a download-and-verify onboarding moment). That demo set was
 * retired 2026-08-16; only the whole-catalog delivery pass remains. main() also strips
 * any lingering `suse/credentials/*` entry from the index so it can never re-list a file
 * that no longer exists on disk.
 *
 * Two identity tiers:
 *   - default (on-device) - the engine's self-signed key (integrity + the maker's claim,
 *     no CA identity).
 *   - `--ca` - mints ONE long-lived leaf from the Lolly CA root (CA_ROOT_KEY_PEM /
 *     CA_ROOT_CERT_PEM in env, e.g. via `--env-file=services/ca/.env`) and signs the whole
 *     set with it. Verify then shows "identity verified" against the root pinned in
 *     shells/web/src/ca-root.ts. HARD GUARD: refuses to sign unless the env root == that
 *     pinned root, so an asset can never ship un-verifiable on lolly.tools. The leaf key is
 *     generated in-process and discarded; only the signature + public leaf ship.
 *
 * ONE-SHOT, like `npm run previews`: the signing key is fresh each run, so it signs only
 * assets that are NOT already signed (a byte-scan for the c2pa marker skips them) and bumps
 * each newly-signed asset's version so client caches invalidate. Commit the signed bytes
 * with the index, then `npm run build:catalog` (refills checksum + size) and
 * `npm run validate:catalog`.
 *
 * Usage:  node --env-file=services/ca/.env \
 *              scripts/sign-credentialed-assets.ts --ca --catalog   # CA identity (shipped)
 *         node scripts/sign-credentialed-assets.ts --catalog        # on-device fallback
 *         node scripts/sign-credentialed-assets.ts                  # index cleanup only (no-op)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { issueLeafCert, pemToDer } from '../engine/src/x509.ts';
import { ENGINE_VERSION } from '../engine/src/index.ts';

const USE_CA = process.argv.includes('--ca');
// --catalog DELIVERS every stampable asset: signs the real catalog file in place. Kept as an
// explicit opt-in so a bare invocation is a no-op dry run (index cleanup only), never an
// accidental rewrite of the whole catalog.
const USE_CATALOG = process.argv.includes('--catalog');
const STAMPABLE = new Set(['png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'tiff', 'webp']);
// The catalog-signing identity (a lolly.tools address the CA vouches for). Shows in Verify.
const CA_IDENTITY = { email: 'credentials@lolly.tools', commonName: 'Lolly Content Credentials', organization: 'Lolly' };
const CA_LEAF_DAYS = 800;      // long enough that a shipped asset never reads "expired"
const SELF_SIGNED_DAYS = 3650; // on-device fallback window

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/assets/index.json');
// The id prefix of the retired "Made with Lolly" demo set. deliverCatalog skips it (defensive),
// and main() strips any lingering entry so the index never re-lists a deleted file.
const ID_PREFIX = 'suse/credentials/';

// ── types (only what we touch on the index) ──────────────────────────────────
interface AssetFormat { format: string; url: string; checksum?: string; size?: number; width?: number; height?: number; }
interface AssetEntry { id: string; name?: string; description?: string; type: string; version: string; tier: string; tags?: string[]; formats: AssetFormat[]; license?: string; }
interface AssetIndex { version: string; generatedAt: string; defaultFavourites?: string[]; defaultHiddenTools?: string[]; assets: AssetEntry[]; }

// Everything the embedder needs that's constant across the whole set: the ephemeral cert
// window (on-device tier) or a single CA-issued leaf signer.
interface SignerBundle { dates: { signedAt: Date; notBefore?: Date; notAfter?: Date }; signer?: { privateKey: CryptoKey; chain: Uint8Array[] }; identity?: string; }

const DAY = 24 * 3600 * 1000;

// The root the deployed app pins (shells/web/src/ca-root.ts) is what its on-device verifier
// trusts. Signing with any other root ships credentials that fail identity verification on
// lolly.tools - so we hard-stop on a mismatch.
function pinnedRootDer(): Uint8Array {
  const src = readFileSync(join(ROOT, 'shells/web/src/ca-root.ts'), 'utf8');
  const m = src.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!m) throw new Error('No CA root pinned in shells/web/src/ca-root.ts - cannot --ca sign.');
  return pemToDer(m[0]);
}
const fingerprint = (der: Uint8Array): string => createHash('sha256').update(der).digest('hex');

async function buildSigner(): Promise<SignerBundle> {
  const now = Date.now();
  const notBefore = new Date(now - 60_000);
  if (!USE_CA) return { dates: { signedAt: notBefore, notBefore, notAfter: new Date(now + SELF_SIGNED_DAYS * DAY) } };

  const certPem = process.env.CA_ROOT_CERT_PEM;
  const keyPem = process.env.CA_ROOT_KEY_PEM;
  if (!certPem || !keyPem) {
    throw new Error('--ca needs CA_ROOT_CERT_PEM and CA_ROOT_KEY_PEM in the environment.\n'
      + '  Run: node --env-file=services/ca/.env scripts/sign-credentialed-assets.ts --ca --catalog');
  }
  const caCertDer = pemToDer(certPem);
  if (fingerprint(caCertDer) !== fingerprint(pinnedRootDer())) {
    throw new Error('CA_ROOT_CERT_PEM does NOT match the root pinned in shells/web/src/ca-root.ts.\n'
      + '  Signing with it would produce credentials that fail identity verification in the app. Aborting.');
  }
  const notAfter = new Date(now + CA_LEAF_DAYS * DAY);
  // One leaf for the whole set. Key generated here, used to sign, never persisted.
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const spkiDer = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const leafDer = await issueLeafCert({ caCertDer, caPrivateKey: pemToDer(keyPem), spkiDer, ...CA_IDENTITY, notBefore, notAfter });
  return { dates: { signedAt: notBefore }, signer: { privateKey: pair.privateKey, chain: [leafDer] }, identity: CA_IDENTITY.email };
}

// The honest source of a delivered asset - its true author, recorded on the CreativeWork so
// Verify shows who actually made it (never claiming Lolly did).
function trueAuthor(a: AssetEntry): string {
  const hay = `${a.id} ${(a.tags ?? []).join(' ')} ${a.description ?? ''}`.toLowerCase();
  if (hay.includes('adobe')) return 'Adobe Stock (licensed)';
  if (hay.includes('shutterstock')) return 'Shutterstock (licensed)';
  if (hay.includes('premiumbeat')) return 'PremiumBeat (licensed)';
  if (hay.includes('stock')) return 'Licensed stock';
  return 'SUSE';
}

// Signing changes the bytes; bump the minor so id+format+version cache keys invalidate and
// every client re-fetches the delivered asset.
function bumpMinor(v?: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? '');
  return m ? `${m[1]}.${Number(m[2]) + 1}.0` : '1.1.0';
}

// Cheap scan for the ASCII "c2pa" marker - present in both SVG (<c2pa:manifest) and JUMBF
// carriers (jpeg/png/…). Lets a re-run skip already-signed files instead of nesting a second
// manifest.
function hasC2pa(b: Uint8Array): boolean {
  for (let i = 0; i + 4 <= b.length; i++) {
    if (b[i] === 0x63 && b[i + 1] === 0x32 && b[i + 2] === 0x70 && b[i + 3] === 0x61) return true;
  }
  return false;
}

// Sign every stampable catalog asset in place as "delivered": an existing asset Lolly
// distributes, not authored - a c2pa.published claim under the same CA identity, with the true
// author recorded. Bumps each signed asset's version.
async function deliverCatalog(index: AssetIndex, sb: SignerBundle): Promise<void> {
  let signed = 0, already = 0, unstampable = 0, failed = 0;
  const skippedFormats: Record<string, number> = {};
  for (const a of index.assets) {
    if (a.id.startsWith(ID_PREFIX)) continue;   // the retired "Made with Lolly" demo set
    const f = a.formats[0];
    const fmt = (f?.format ?? '').toLowerCase();
    if (!f || !STAMPABLE.has(fmt)) { unstampable++; skippedFormats[fmt || '?'] = (skippedFormats[fmt || '?'] ?? 0) + 1; continue; }
    const path = join(ROOT, f.url.replace(/^\//, ''));
    const bytes = readFileSync(path);
    if (hasC2pa(bytes)) { already++; continue; }
    try {
      const out = await embedC2pa(new Uint8Array(bytes), fmt, {
        title: a.name ?? a.id.split('/').pop(),
        claimGenerator: 'Lolly lolly.tools',
        generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
        author: { name: trueAuthor(a) },
        environment: { role: 'official catalog', surface: 'lolly.tools/catalog', engine: `Lolly ${ENGINE_VERSION}` },
        authorship: 'delivered',
        dates: sb.dates,
        ...(sb.signer ? { signer: sb.signer } : {}),
      });
      writeFileSync(path, out);
      a.version = bumpMinor(a.version);  // checksum/size refilled by build:catalog
      signed++;
    } catch (err) {
      failed++;
      console.log(`  ✗ ${a.id} (${fmt}): ${(err as Error).message}`);
    }
  }
  console.log(`Delivered: signed ${signed} in place · ${already} already signed · ${failed} failed`);
  console.log(`Not stampable (no C2PA container, left as-is): ${unstampable} - ${Object.entries(skippedFormats).map(([k, v]) => `${k}:${v}`).join(', ')}`);
}

async function main(): Promise<void> {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as AssetIndex;

  // Strip any lingering demo-set entries (the retired suse/credentials/* set) so the index
  // never lists a file that no longer exists on disk. Idempotent - normally a no-op.
  const before = index.assets.length;
  index.assets = index.assets.filter((a) => !a.id.startsWith(ID_PREFIX));
  if (index.defaultFavourites) index.defaultFavourites = index.defaultFavourites.filter((id) => !id.startsWith(ID_PREFIX));
  const stripped = before - index.assets.length;
  if (stripped) console.log(`Stripped ${stripped} stale ${ID_PREFIX}* entr${stripped === 1 ? 'y' : 'ies'} from the index.`);

  if (!USE_CATALOG) {
    console.log('Nothing to deliver (pass --catalog to sign every stampable asset). Index cleanup only.');
    if (stripped) writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
    return;
  }

  const signer = await buildSigner();
  console.log(USE_CA
    ? `Signing tier: CA identity - leaf for ${signer.identity}, ${CA_LEAF_DAYS}d, chains to pinned Lolly CA root`
    : 'Signing tier: on-device self-signed (no CA identity)');

  await deliverCatalog(index, signer);
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log('Next: npm run build:catalog && npm run validate:catalog');
}

await main();
