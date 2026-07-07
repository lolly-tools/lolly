// SPDX-License-Identifier: MPL-2.0
/**
 * sign-credentialed-assets — mint the "Made with Lolly" Content Credentials
 * demo set for the catalog.
 *
 * Catalog assets normally carry only an SRI checksum; Content Credentials are
 * minted at export time. But verifying a credential is one of the first things
 * a new user wants to try — so this script bakes a real, signed C2PA manifest
 * into a small curated set of *styled* assets (the styling is a genuine Lolly
 * transform, which is exactly what "Made with Lolly" asserts), and registers
 * them as `suse/credentials/*` catalog entries. A user downloads one, drops it
 * into Verify (or `brand-tool validate`), and sees the "Made with Lolly" hero.
 *
 * Every rendition goes through the SAME engine paths the app uses:
 *   - icons        → applyIconTheme()  (bake the c1/c2 two-colour theme)
 *   - illustrations→ applyIconTheme()  (multi-colour → monochromeRecolor re-hue)
 *   - photos       → wrapRasterWithTreatment()  (duotone / greyscale wash → SVG)
 * then embedC2pa(bytes, 'svg', …) signs the result with the engine's on-device
 * self-signed key (integrity + the maker's claim — no CA identity, by design).
 * A ~10-year cert window keeps the shipped demo from ever reading "expired".
 *
 * Two identity tiers:
 *   - default (`npm run sign:credentials`) — the engine's on-device self-signed
 *     key. Verify shows "Made with Lolly" (integrity + the maker's claim), no CA.
 *   - `--ca` (`npm run sign:credentials:ca`) — mints ONE long-lived leaf from the
 *     Lolly CA root (CA_ROOT_KEY_PEM/CA_ROOT_CERT_PEM in env, e.g. via
 *     `--env-file=services/ca/.env`) for the `credentials@lolly.tools` identity,
 *     and signs the whole set with it. Verify then upgrades to "Made with Lolly —
 *     identity verified" against the root pinned in shells/web/src/ca-root.ts.
 *     HARD GUARD: refuses to sign unless the env root == that pinned root, so the
 *     assets can never ship as un-verifiable on lolly.tools. The leaf key is
 *     generated in-process and discarded; only the signature + public leaf ship.
 *
 * This is a ONE-SHOT generator, like `npm run previews` / the thumbnail build:
 * the signing key is fresh each run, so re-running rewrites the signatures.
 * Commit the generated SVGs together with the index. After running this, run
 * `npm run build:catalog` (fills the real checksum + size) then
 * `npm run validate:catalog`. Re-sign CA assets with the `:ca` variant — plain
 * `sign:credentials` would downgrade them to on-device (no identity).
 *
 * Usage:  node scripts/sign-credentialed-assets.ts            # on-device
 *         node --env-file=services/ca/.env \
 *              scripts/sign-credentialed-assets.ts --ca        # CA identity
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { applyIconTheme, parseIconThemesDoc } from '../engine/src/icon-theme.ts';
import { wrapRasterWithTreatment, parsePhotoTreatmentsDoc } from '../engine/src/photo-treatment.ts';
import { issueLeafCert, pemToDer } from '../engine/src/x509.ts';
import { ENGINE_VERSION } from '../engine/src/index.ts';

const USE_CA = process.argv.includes('--ca');
// --catalog also DELIVERS every other stampable asset: signs the real catalog
// file in place with a c2pa.published (not created) claim + its true author, so
// every official download verifies as "Delivered by Lolly" — never unknown.
const USE_CATALOG = process.argv.includes('--catalog');
const STAMPABLE = new Set(['png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'tiff', 'webp']);
// The catalog-signing identity (a lolly.tools address the CA vouches for — the
// same one .env.example ships as EMAIL_FROM). Shows in Verify as the signer.
const CA_IDENTITY = { email: 'credentials@lolly.tools', commonName: 'Lolly Content Credentials', organization: 'Lolly' };
const CA_LEAF_DAYS = 800;      // long enough that the shipped demo never reads "expired"
const SELF_SIGNED_DAYS = 3650; // on-device fallback window

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/assets/index.json');
const OUT_DIR_REL = 'catalog/assets/suse/credentials';
const OUT_URL_BASE = '/catalog/assets/suse/credentials';
const ID_PREFIX = 'suse/credentials/';
const ICON_THEMES_PATH = join(ROOT, 'catalog/assets/suse/palette/icon-themes.json');
const PHOTO_TREATMENTS_PATH = join(ROOT, 'catalog/assets/suse/palette/photo-treatments.json');

// ── the curated demo set ─────────────────────────────────────────────────────
// icons + illustrations name an icon-theme id (from icon-themes.json); photos
// name a photo-treatment id (from photo-treatments.json). Photos are chosen at
// run time (first few with known pixel dimensions) so the set never depends on
// a hand-typed photo id.
interface IconLikeSpec { baseId: string; style: string; out: string; name: string; noun: string; }
const ICON_SPECS: IconLikeSpec[] = [
  { baseId: 'suse/icons/ai',       style: 'ember',     out: 'icon-ai-ember',           name: 'AI Icon — Ember',        noun: 'icon' },
  { baseId: 'suse/icons/security', style: 'waterhole', out: 'icon-security-waterhole', name: 'Security Icon — Waterhole', noun: 'icon' },
  { baseId: 'suse/icons/network',  style: 'mint',      out: 'icon-network-mint',       name: 'Network Icon — Mint',    noun: 'icon' },
];
const ILLUSTRATION_SPECS: IconLikeSpec[] = [
  { baseId: 'suse/illustrations/ai-enterprise', style: 'waterhole', out: 'illustration-ai-enterprise-waterhole', name: 'AI for Enterprise — Waterhole', noun: 'illustration' },
  { baseId: 'suse/illustrations/cloud-native',  style: 'jungle',    out: 'illustration-cloud-native-jungle',    name: 'Cloud Native — Jungle',        noun: 'illustration' },
  { baseId: 'suse/illustrations/cybersecurity', style: 'pine',      out: 'illustration-cybersecurity-pine',     name: 'Cybersecurity — Pine',         noun: 'illustration' },
];
const PHOTO_TREATMENTS_FOR_SET = ['greyscale', 'pine', 'midnight'];  // one per chosen photo
const PHOTO_COUNT = PHOTO_TREATMENTS_FOR_SET.length;

// Lead id per family — seeded into defaultFavourites so the set greets first-run
// users. (Kept small; the rest live in their own catalog group.)
const FAVOURITE_LEADS = [
  ID_PREFIX + ICON_SPECS[0]!.out,
  ID_PREFIX + ILLUSTRATION_SPECS[0]!.out,
];

// ── types (only what we touch on the index) ──────────────────────────────────
interface AssetFormat { format: string; url: string; checksum?: string; size?: number; width?: number; height?: number; }
interface AssetEntry { id: string; name?: string; description?: string; type: string; version: string; tier: string; tags?: string[]; formats: AssetFormat[]; license?: string; }
interface AssetIndex { version: string; generatedAt: string; defaultFavourites?: string[]; assets: AssetEntry[]; }

const te = new TextEncoder();
const td = new TextDecoder();

function readAsset(url: string): Uint8Array {
  return readFileSync(join(ROOT, url.replace(/^\//, '')));
}

// Everything the embedder needs that's constant across the whole set: the
// ephemeral cert window (on-device tier) or a single CA-issued leaf signer.
interface SignerBundle { dates: { signedAt: Date; notBefore?: Date; notAfter?: Date }; signer?: { privateKey: CryptoKey; chain: Uint8Array[] }; identity?: string; }

const DAY = 24 * 3600 * 1000;

// The root the deployed app pins (shells/web/src/ca-root.ts) is what its
// on-device verifier trusts. Signing with any other root ships credentials that
// fail identity verification on lolly.tools — so we hard-stop on a mismatch.
function pinnedRootDer(): Uint8Array {
  const src = readFileSync(join(ROOT, 'shells/web/src/ca-root.ts'), 'utf8');
  const m = src.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!m) throw new Error('No CA root pinned in shells/web/src/ca-root.ts — cannot --ca sign.');
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
      + '  Run: node --env-file=services/ca/.env scripts/sign-credentialed-assets.ts --ca');
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

async function sign(svg: string, title: string, tool: string, sb: SignerBundle): Promise<Uint8Array> {
  return embedC2pa(te.encode(svg), 'svg', {
    title,
    // matches the export path's "<software> lolly.tools" so the verifier's
    // /\blolly\b/ test lights the "Made with Lolly" hero.
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
    environment: { tool, format: 'svg', surface: 'lolly.tools/catalog', engine: `Lolly ${ENGINE_VERSION}` },
    dates: sb.dates,
    ...(sb.signer ? { signer: sb.signer } : {}),
  });
}

function entryFor(id: string, name: string, description: string, out: string, tags: string[]): AssetEntry {
  return {
    id,
    name,
    description,
    type: 'vector',
    version: '1.0.0',
    tier: 'on-demand',
    tags: ['content-credentials', 'made-with-lolly', ...tags],
    // checksum + size are filled by scripts/checksum-assets.ts (npm run build:catalog).
    formats: [{ format: 'svg', url: `${OUT_URL_BASE}/${out}.svg`, checksum: 'sha256-PLACEHOLDER', size: 0 }],
    license: 'LicenseRef-SUSE-Proprietary',
  };
}

// The honest source of a delivered asset — its true author, recorded on the
// CreativeWork so Verify shows who actually made it (never claiming Lolly did).
function trueAuthor(a: AssetEntry): string {
  const hay = `${a.id} ${(a.tags ?? []).join(' ')} ${a.description ?? ''}`.toLowerCase();
  if (hay.includes('adobe')) return 'Adobe Stock (licensed)';
  if (hay.includes('shutterstock')) return 'Shutterstock (licensed)';
  if (hay.includes('premiumbeat')) return 'PremiumBeat (licensed)';
  if (hay.includes('stock')) return 'Licensed stock';
  return 'SUSE';
}

// Signing changes the bytes; bump the minor so id+format+version cache keys
// invalidate and every client re-fetches the credentialed asset.
function bumpMinor(v?: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? '');
  return m ? `${m[1]}.${Number(m[2]) + 1}.0` : '1.1.0';
}

// Cheap scan for the ASCII "c2pa" marker — present in both SVG (<c2pa:manifest)
// and JUMBF carriers (jpeg/png/…). Lets a re-run skip already-signed files
// instead of nesting a second manifest.
function hasC2pa(b: Uint8Array): boolean {
  for (let i = 0; i + 4 <= b.length; i++) {
    if (b[i] === 0x63 && b[i + 1] === 0x32 && b[i + 2] === 0x70 && b[i + 3] === 0x61) return true;
  }
  return false;
}

// Sign every OTHER stampable catalog asset in place as "delivered": an existing
// asset Lolly distributes, not authored — a c2pa.published claim under the same
// CA identity, with the true author recorded. Bumps each signed asset's version.
async function deliverCatalog(index: AssetIndex, sb: SignerBundle): Promise<void> {
  let signed = 0, already = 0, unstampable = 0, failed = 0;
  const skippedFormats: Record<string, number> = {};
  for (const a of index.assets) {
    if (a.id.startsWith(ID_PREFIX)) continue;   // the created "Made with Lolly" set
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
  console.log(`Not stampable (no C2PA container, left as-is): ${unstampable} — ${Object.entries(skippedFormats).map(([k, v]) => `${k}:${v}`).join(', ')}`);
}

async function main(): Promise<void> {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as AssetIndex;
  const byId = new Map(index.assets.map((a) => [a.id, a] as const));
  const iconThemes = parseIconThemesDoc(JSON.parse(readFileSync(ICON_THEMES_PATH, 'utf8')));
  const treatments = parsePhotoTreatmentsDoc(JSON.parse(readFileSync(PHOTO_TREATMENTS_PATH, 'utf8')));
  mkdirSync(join(ROOT, OUT_DIR_REL), { recursive: true });

  const signer = await buildSigner();
  console.log(USE_CA
    ? `Signing tier: CA identity — leaf for ${signer.identity}, ${CA_LEAF_DAYS}d, chains to pinned Lolly CA root`
    : 'Signing tier: on-device self-signed (no CA identity)');

  const newEntries: AssetEntry[] = [];
  const skipped: string[] = [];

  // Icons + illustrations — one styling path (applyIconTheme). Icons bake the
  // c1/c2 theme; multi-colour illustrations fall through to a monochrome re-hue.
  for (const spec of [...ICON_SPECS, ...ILLUSTRATION_SPECS]) {
    const base = byId.get(spec.baseId);
    const theme = iconThemes.find((t) => t.id === spec.style);
    if (!base || !theme) { skipped.push(`${spec.baseId} (${!base ? 'no such asset' : 'no theme ' + spec.style})`); continue; }
    const styled = applyIconTheme(td.decode(readAsset(base.formats[0]!.url)), theme);
    if (!styled) { skipped.push(`${spec.baseId} (not stylable)`); continue; }
    const tool = spec.noun === 'icon' ? `Icon theme · ${theme.label ?? theme.id}` : `Illustration recolour · ${theme.label ?? theme.id}`;
    const bytes = await sign(styled, spec.name, tool, signer);
    writeFileSync(join(ROOT, OUT_DIR_REL, `${spec.out}.svg`), bytes);
    const styleWord = spec.noun === 'icon' ? `themed in ${theme.label ?? theme.id}` : `re-hued in the ${theme.label ?? theme.id} brand tone`;
    newEntries.push(entryFor(
      ID_PREFIX + spec.out, spec.name,
      `SUSE ${spec.noun} ${styleWord}, exported with a “Made with Lolly” Content Credential. Download it and drop it into Verify to check the credential.`,
      spec.out, [spec.noun, 'themed'],
    ));
    console.log(`  ✓ ${ID_PREFIX + spec.out}  (${bytes.length.toLocaleString()} bytes)`);
  }

  // Photos — pick the first PHOTO_COUNT photo assets that carry pixel dims, then
  // bake a treatment into a self-contained SVG (embeds the JPEG as a data URI).
  const photoPool = index.assets
    .filter((a) => a.id.startsWith('suse/photos/') && a.type === 'raster')
    .map((a) => ({ a, f: a.formats.find((f) => f.format === 'jpg' && f.width && f.height) }))
    .filter((x): x is { a: AssetEntry; f: AssetFormat } => !!x.f)
    .sort((x, y) => x.a.id.localeCompare(y.a.id))
    .slice(0, PHOTO_COUNT);
  for (let i = 0; i < photoPool.length; i++) {
    const { a, f } = photoPool[i]!;
    const treatment = treatments.find((t) => t.id === PHOTO_TREATMENTS_FOR_SET[i]);
    if (!treatment) { skipped.push(`${a.id} (no treatment ${PHOTO_TREATMENTS_FOR_SET[i]})`); continue; }
    const href = `data:image/jpeg;base64,${Buffer.from(readAsset(f.url)).toString('base64')}`;
    const styled = wrapRasterWithTreatment({ href, width: f.width!, height: f.height!, treatment });
    const short = a.id.slice('suse/photos/'.length);
    const out = `photo-${short}-${treatment.id}`;
    const name = `${a.name ?? short} — ${treatment.label ?? treatment.id}`;
    const bytes = await sign(styled, name, `Photo treatment · ${treatment.label ?? treatment.id}`, signer);
    writeFileSync(join(ROOT, OUT_DIR_REL, `${out}.svg`), bytes);
    newEntries.push(entryFor(
      ID_PREFIX + out, name,
      `SUSE photo with the ${treatment.label ?? treatment.id} ${treatment.kind} treatment, exported with a “Made with Lolly” Content Credential. Download it and drop it into Verify to check the credential.`,
      out, ['photo', 'treated'],
    ));
    console.log(`  ✓ ${ID_PREFIX + out}  (${bytes.length.toLocaleString()} bytes)`);
  }

  // Patch the index: drop any prior suse/credentials/* (idempotent re-run), then
  // append the fresh set. Written with the same JSON.stringify(_, 2)+'\n' shape
  // checksum-assets.ts uses, so the diff is additions only.
  index.assets = index.assets.filter((a) => !a.id.startsWith(ID_PREFIX)).concat(newEntries);
  // Preserve existing non-credential favourites, drop any stale credential ones,
  // then seed the current leads (that actually got generated) — deduped.
  const built = new Set(newEntries.map((e) => e.id));
  const kept = (index.defaultFavourites ?? []).filter((id) => !id.startsWith(ID_PREFIX));
  index.defaultFavourites = [...new Set([...kept, ...FAVOURITE_LEADS.filter((id) => built.has(id))])];

  // Whole-catalog pass: deliver every other stampable asset in place.
  if (USE_CATALOG) await deliverCatalog(index, signer);

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');

  console.log(`\nSigned ${newEntries.length} credentialed assets → ${OUT_DIR_REL}`);
  if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
  console.log('Next: npm run build:catalog && npm run validate:catalog');
}

await main();
