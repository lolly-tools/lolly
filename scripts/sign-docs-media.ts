// SPDX-License-Identifier: MPL-2.0
/**
 * sign-docs-media - renew the Content Credential on a served /info media file
 * without touching its image data.
 *
 * WHY. Some /info images were signed with a short-lived on-device key. Once that
 * certificate lapses, Verify reads "Credential expired" on a file that never
 * changed. Their source images are not in this repository, so a fresh export is
 * not possible: the only honest fix is a new signature over the same image data.
 *
 * WHAT ONE RUN DOES, per named file:
 *   1. Refuses unless the existing credential still binds the current bytes. Every
 *      check must pass apart from the certificate window and the untrusted-key
 *      marker. Re-signing a file that changed after signing would hide the change.
 *   2. Carries the whole existing manifest store forward as the parentOf
 *      ingredient (the pattern in scripts/resize-mascots.ts), so the earlier chain
 *      stays readable and independently verifiable. The engine copies the
 *      ingredient's AI source type (trainedAlgorithmicMedia) onto the new
 *      c2pa.opened step, so the new active manifest declares the AI origin itself.
 *   3. Records a c2pa.published step, never c2pa.created. Lolly is publishing an
 *      existing file here, not making one. Verify presents an intact, CA-verified
 *      published claim as "Delivered by Lolly", which says Lolly did not create
 *      the file; the history under that hero still shows who generated the image.
 *   4. Embeds through the engine's embedC2pa. For WebP the RIFF placer removes the
 *      old C2PA chunk and appends the new one; every other chunk is copied as is.
 *      Before writing, the script compares those chunks byte for byte, then decodes
 *      both versions with sharp and compares the RGBA.
 *   5. Verifies the result with verifyC2pa and resolveVerdict against the engine's
 *      default anchors plus the Lolly root, and writes nothing unless the verdict
 *      is "delivered" (intact and CA-verified) and any AI declaration the old
 *      credential made is still surfaced.
 *
 * SIGNER. One leaf minted from the Lolly CA root, as
 * scripts/sign-credentialed-assets.ts --ca mints it: CA_ROOT_KEY_PEM and
 * CA_ROOT_CERT_PEM come from the environment that scripts/run-private-ca.ts loads,
 * the run stops unless that root matches the one pinned in shells/web/src/ca-root.ts,
 * and the leaf key is generated in this process and never stored. Nothing here
 * prints a key or certificate.
 *
 * Usage:
 *   node scripts/run-private-ca.ts sign-docs-media            # the reviewed file list
 *   node scripts/run-private-ca.ts sign-docs-media --check    # sign in memory, verify, write nothing
 *
 * Only formats with a checked container path are accepted (WebP today). Widen
 * SUPPORTED only together with a container comparison for the new format.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { embedC2pa } from '../engine/src/c2pa-containers.ts';
import { extractC2paStore, prepareC2paIngredientFromStore } from '../engine/src/c2pa-extract.ts';
import { verifyC2pa, type C2paReport } from '../engine/src/c2pa-verify.ts';
import { C2PA_CHECK, defaultTrustAnchors, resolveVerdict } from '../engine/src/c2pa-verdict.ts';
import { C2PA_SPEC_VERSION } from '../engine/src/c2pa.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { issueLeafCert, pemToDer } from '../engine/src/x509.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INFO_DIR = join(ROOT, 'shells/web/public/info');

// The catalog-signing identity, the same one sign-credentialed-assets.ts uses.
const CA_IDENTITY = {
  email: 'credentials@lolly.tools',
  commonName: 'Lolly Content Credentials',
  organization: 'Lolly',
};
// Same window as sign-credentialed-assets.ts: long enough that a served file does
// not read "expired" again for years.
const CA_LEAF_DAYS = 800;
const DAY = 24 * 3600 * 1000;

const SUPPORTED = new Set(['webp']);

// The two checks a renewal may find failing on the old credential. Anything else
// means the bytes or the claim no longer verify, and the run refuses.
const RENEWABLE = new Set<string>([C2PA_CHECK.signingCredentialExpired, C2PA_CHECK.signingCredentialUntrusted]);

interface CaSigner {
  signedAt: Date;
  signer: { privateKey: CryptoKey; chain: Uint8Array[] };
}

const fingerprint = (der: Uint8Array): string => createHash('sha256').update(der).digest('hex');

function pinnedRootDer(): Uint8Array {
  const src = readFileSync(join(ROOT, 'shells/web/src/ca-root.ts'), 'utf8');
  const m = src.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!m) throw new Error('No CA root pinned in shells/web/src/ca-root.ts - cannot CA-sign.');
  return pemToDer(m[0]);
}

async function mintCaLeaf(): Promise<CaSigner> {
  const certPem = process.env.CA_ROOT_CERT_PEM;
  const keyPem = process.env.CA_ROOT_KEY_PEM;
  if (!certPem || !keyPem) {
    throw new Error(
      'sign-docs-media needs CA_ROOT_CERT_PEM and CA_ROOT_KEY_PEM in the environment.\n' +
        '  Run: node scripts/run-private-ca.ts sign-docs-media'
    );
  }
  const caCertDer = pemToDer(certPem);
  if (fingerprint(caCertDer) !== fingerprint(pinnedRootDer())) {
    throw new Error(
      'CA_ROOT_CERT_PEM does NOT match the root pinned in shells/web/src/ca-root.ts.\n' +
        '  Signing with it would produce credentials that fail identity verification in the app. Aborting.'
    );
  }
  const now = Date.now();
  const notBefore = new Date(now - 60_000);
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const spkiDer = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const leafDer = await issueLeafCert({
    caCertDer,
    caPrivateKey: pemToDer(keyPem),
    spkiDer,
    ...CA_IDENTITY,
    notBefore,
    notAfter: new Date(now + CA_LEAF_DAYS * DAY),
  });
  return { signedAt: notBefore, signer: { privateKey: pair.privateKey, chain: [leafDer] } };
}

/** Every top-level RIFF chunk except C2PA, as [fourcc, payload] pairs. */
function riffChunksWithoutC2pa(b: Uint8Array): Array<[string, Uint8Array]> {
  const fourcc = (o: number): string => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  if (b.length < 12 || fourcc(0) !== 'RIFF') throw new Error('not a RIFF container');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Array<[string, Uint8Array]> = [['form', b.subarray(8, 12)]];
  for (let i = 12; i + 8 <= b.length; ) {
    const size = dv.getUint32(i + 4, true);
    const end = i + 8 + size;
    if (end > b.length) throw new Error(`malformed RIFF chunk at ${i}`);
    if (fourcc(i) !== 'C2PA') out.push([fourcc(i), b.subarray(i + 8, end)]);
    i = end + (size & 1);
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
}

function assertSameContainerContent(before: Uint8Array, after: Uint8Array): void {
  const a = riffChunksWithoutC2pa(before);
  const b = riffChunksWithoutC2pa(after);
  if (a.length !== b.length) throw new Error(`chunk count changed (${a.length} -> ${b.length})`);
  a.forEach(([tag, data], i) => {
    const [tagB, dataB] = b[i]!;
    if (tag !== tagB || !sameBytes(data, dataB)) throw new Error(`chunk ${i} (${tag}) changed`);
  });
}

async function decodedRgbaSha256(bytes: Uint8Array): Promise<string> {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return `${info.width}x${info.height}:${createHash('sha256').update(data).digest('hex')}`;
}

const day = (iso?: string): string => (iso ? iso.slice(0, 10) : 'an unrecorded date');

/** The free-text note on the c2pa.published step: what changed and why. */
function publishedNote(prev: C2paReport): string {
  const notAfter = prev.signer?.notAfter;
  const lapsed = !!notAfter && Date.parse(notAfter) < Date.now();
  const prior = lapsed
    ? `The previous credential's signing certificate expired on ${day(notAfter)}.`
    : `The previous credential's signing certificate was valid until ${day(notAfter)}.`;
  return `Re-signed for the Lolly documentation under a Lolly CA certificate. The image data is unchanged. ${prior}`;
}

function verdictLine(r: C2paReport): string {
  const v = resolveVerdict(r);
  const who = r.signer?.identity?.email ?? r.signer?.commonName ?? 'unknown signer';
  return `${v.state}/${v.tone} · ${who} · valid until ${day(r.signer?.notAfter)}${r.aiGenerated ? ` · AI ${r.aiGenerated.kind}` : ''}`;
}

async function renew(path: string, ca: CaSigner, check: boolean): Promise<void> {
  const rel = relative(ROOT, path);
  if (!path.startsWith(INFO_DIR + sep)) throw new Error(`${rel}: not under shells/web/public/info`);
  const before = new Uint8Array(readFileSync(path));
  const ex = extractC2paStore(before);
  if (!ex) throw new Error(`${rel}: no C2PA store - there is no credential to renew`);
  if (!SUPPORTED.has(ex.format)) throw new Error(`${rel}: ${ex.format} is not supported yet (supported: ${[...SUPPORTED].join(', ')})`);

  const anchors = defaultTrustAnchors({ includeLollyRoot: true });
  const prev = await verifyC2pa(before, { trustAnchors: anchors });
  const blocking = prev.checks.filter((c) => !c.ok && !RENEWABLE.has(c.code));
  if (prev.state === 'none' || blocking.length) {
    throw new Error(`${rel}: the existing credential does not verify against these bytes (${blocking.map((c) => c.code).join(', ') || prev.state}) - refusing to re-sign`);
  }

  const ingredient = prepareC2paIngredientFromStore(ex.store, ex.format);
  if (!ingredient) throw new Error(`${rel}: could not prepare the existing credential as an ingredient`);
  // The ingredient is the served file itself, so name it by its file name rather
  // than by the old claim's title.
  ingredient.title = basename(path);

  const after = await embedC2pa(before, ex.format, {
    title: basename(path),
    generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
    specVersion: C2PA_SPEC_VERSION,
    environment: { role: 'documentation media', surface: 'lolly.tools/info', engine: `Lolly ${ENGINE_VERSION}` },
    actions: [{ action: 'c2pa.published', description: publishedNote(prev) }],
    ingredients: [ingredient],
    dates: { signedAt: ca.signedAt },
    signer: ca.signer,
  });

  assertSameContainerContent(before, after);
  const [pxBefore, pxAfter] = await Promise.all([decodedRgbaSha256(before), decodedRgbaSha256(after)]);
  if (pxBefore !== pxAfter) throw new Error(`${rel}: decoded pixels differ after embedding - refusing to write`);

  const next = await verifyC2pa(after, { trustAnchors: anchors });
  const verdict = resolveVerdict(next);
  if (verdict.state !== 'delivered' || !verdict.trusted) {
    throw new Error(`${rel}: the renewed credential resolves to ${verdict.state}, not an intact CA-verified delivery - refusing to write`);
  }
  if (prev.aiGenerated && next.aiGenerated?.kind !== prev.aiGenerated.kind) {
    throw new Error(`${rel}: the renewed credential no longer surfaces the AI-generated declaration - refusing to write`);
  }

  if (!check) writeFileSync(path, after);
  console.log(`  ${check ? '~' : '✓'} ${rel}`);
  console.log(`      before: ${verdictLine(prev)}`);
  console.log(`      after:  ${verdictLine(next)}`);
  console.log(`      pixels: ${pxAfter} (unchanged), ${before.length} -> ${after.length} bytes`);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const check = argv.includes('--check');
  const files = argv.filter((a) => !a.startsWith('--')).map((f) => resolve(ROOT, f));
  if (!files.length) throw new Error('usage: sign-docs-media.ts <shells/web/public/info/file> [...] [--check]');
  const ca = await mintCaLeaf();
  console.log(`Signing tier: CA identity - leaf for ${CA_IDENTITY.email}, ${CA_LEAF_DAYS}d, chains to the pinned Lolly CA root${check ? ' (check only, nothing written)' : ''}`);
  for (const f of files) await renew(f, ca, check);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
