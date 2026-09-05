// SPDX-License-Identifier: MPL-2.0
/**
 * sign-inline-logos - bake Content Credentials into the brand logos a tool
 * inlines as `data:` URIs, and sync the base64 back into its hooks.js.
 *
 * WHY this exists. `email-signature` embeds its wordmark as a base64 PNG so the
 * pasted signature is self-contained (email clients don't fetch tool-relative
 * assets). That PNG never passes through the export bridge, so it never gets the
 * credential every other Lolly-delivered asset carries - and the signature's own
 * `html` output has no container that could hold one either (C2PA embedding is
 * container-gated: see engine C2PA_FORMATS). Signing the inlined PNG itself is
 * the only place provenance can live on the pasted path: pull the logo out of a
 * received signature, drop it into Verify, and it reads as a SUSE asset delivered
 * by Lolly.
 *
 * IDENTITY - read this before changing the claim. The signature is made with
 * Lolly's own CA identity (`credentials@lolly.tools`), exactly like every other
 * delivered catalog asset; SUSE is recorded as the `author` of the CreativeWork
 * with `authorship: 'delivered'`. That is the honest shape and the only one
 * available: we hold no SUSE-issued signing certificate, and minting a leaf that
 * *claimed* to be SUSE would assert an identity we cannot back. "Signed as SUSE"
 * means "authored by SUSE, delivered and signed by Lolly", never "signed by SUSE".
 *
 * The masters (`suse.png` / `suse-grey.png` beside hooks.js) are signed IN PLACE,
 * mirroring scripts/sign-credentialed-assets.ts `deliverCatalog`. Already-signed
 * masters are skipped, so a re-run is a no-op and diffs stay quiet - a fresh leaf
 * key each run would otherwise rewrite every signature. Pass --force to re-sign
 * from `--from <dir>` unsigned originals.
 *
 * There is deliberately NO pixel imprint here. The Lolly imprint is a block-DCT
 * mark calibrated for photos; on a 204x38 mostly-flat wordmark it clears its own
 * size-adjusted detection floor by only ~1.07x, and dies to a JPEG re-encode
 * (0.93x) or any resize (0.15x) - measured, see the tool's notes. The only case
 * it survives is a byte-identical PNG, which is precisely the case where the C2PA
 * credential already verifies. Adding it would perturb a brand mark for a signal
 * that reads "present" only when it is redundant.
 *
 * Usage:
 *   npm run sign:signature-logos                                             # CA identity
 *   node scripts/sign-inline-logos.ts --self                                 # on-device key
 *   node scripts/run-private-ca.ts sign-logos --force --from /tmp/originals
 *
 * After running: `npm run build:catalog && npm run validate:catalog`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, embedC2pa, extractC2paStore } from '../engine/src/index.ts';
import { issueLeafCert, pemToDer } from '../engine/src/x509.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The tool whose hooks.js inlines the logos, and the master files it inlines.
// `varName` is the hooks.js `var` holding that master's data URI.
const TARGET = {
  hooks: 'brands/suse/tools/email-signature/hooks.js',
  logos: [
    { file: 'suse.png', varName: 'LOGO_STANDARD', title: 'SUSE wordmark' },
    { file: 'suse-grey.png', varName: 'LOGO_GREY', title: 'SUSE wordmark (grey)' },
  ],
};

const AUTHOR = 'SUSE';
const CA_IDENTITY = {
  email: 'credentials@lolly.tools',
  commonName: 'Lolly Content Credentials',
  organization: 'Lolly',
};
const CA_LEAF_DAYS = 800; // long enough that a shipped signature never reads "expired"
const SELF_SIGNED_DAYS = 3650; // on-device fallback window
const DAY = 24 * 3600 * 1000;

const USE_SELF = process.argv.includes('--self');
const FORCE = process.argv.includes('--force');
const FROM = (() => {
  const i = process.argv.indexOf('--from');
  return i > 0 ? process.argv[i + 1] : undefined;
})();

interface SignerBundle {
  dates: { signedAt: Date; notBefore?: Date; notAfter?: Date };
  signer?: { privateKey: CryptoKey; chain: Uint8Array[] };
  identity?: string;
}

const fingerprint = (der: Uint8Array): string => createHash('sha256').update(der).digest('hex');

/** The root the deployed app pins - signing with any other ships un-verifiable credentials. */
function pinnedRootDer(): Uint8Array {
  const src = readFileSync(join(ROOT, 'shells/web/src/ca-root.ts'), 'utf8');
  const m = src.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!m) throw new Error('No CA root pinned in shells/web/src/ca-root.ts - cannot CA-sign.');
  return pemToDer(m[0]);
}

async function buildSigner(): Promise<SignerBundle> {
  const now = Date.now();
  const notBefore = new Date(now - 60_000);
  if (USE_SELF)
    return {
      dates: { signedAt: notBefore, notBefore, notAfter: new Date(now + SELF_SIGNED_DAYS * DAY) },
    };

  const certPem = process.env.CA_ROOT_CERT_PEM;
  const keyPem = process.env.CA_ROOT_KEY_PEM;
  if (!certPem || !keyPem) {
    throw new Error(
      'CA signing needs CA_ROOT_CERT_PEM and CA_ROOT_KEY_PEM in the environment.\n' +
        '  Run: npm run sign:signature-logos\n' +
        '  (or pass --self for the untrusted on-device key)'
    );
  }
  const caCertDer = pemToDer(certPem);
  if (fingerprint(caCertDer) !== fingerprint(pinnedRootDer())) {
    throw new Error(
      'CA_ROOT_CERT_PEM does NOT match the root pinned in shells/web/src/ca-root.ts.\n' +
        '  Signing with it would produce credentials that fail identity verification in the app. Aborting.'
    );
  }
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
  return {
    dates: { signedAt: notBefore },
    signer: { privateKey: pair.privateKey, chain: [leafDer] },
    identity: CA_IDENTITY.email,
  };
}

const toBase64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');

/** Rewrite `var <NAME> = 'data:image/png;base64,…'` in place, preserving layout. */
function patchHooks(src: string, varName: string, b64: string): string {
  const re = new RegExp(`(var\\s+${varName}\\s*=\\s*)'data:image/png;base64,[A-Za-z0-9+/=]+'`);
  if (!re.test(src))
    throw new Error(`hooks.js has no \`var ${varName} = 'data:image/png;base64,…'\` to patch.`);
  return src.replace(re, (_m, lead: string) => `${lead}'data:image/png;base64,${b64}'`);
}

async function main(): Promise<void> {
  const sb = await buildSigner();
  console.log(
    sb.signer
      ? `Signing tier: CA identity - leaf for ${sb.identity}, ${CA_LEAF_DAYS}d, chains to the pinned Lolly CA root`
      : 'Signing tier: on-device self-signed key (NOT identity-verified - pass no --self for the CA tier)'
  );
  console.log(
    `Claim: author "${AUTHOR}", authorship "delivered", generator Lolly ${ENGINE_VERSION}\n`
  );

  const hooksPath = join(ROOT, TARGET.hooks);
  if (!existsSync(hooksPath)) {
    throw new Error(
      `${TARGET.hooks} is missing - mount the private brand pack first:\n` +
        '  git submodule update --init --checkout brands/suse'
    );
  }
  const toolDir = dirname(hooksPath);
  let hooks = readFileSync(hooksPath, 'utf8');
  let signed = 0,
    skipped = 0;

  for (const logo of TARGET.logos) {
    const masterPath = join(toolDir, logo.file);
    const source = FORCE && FROM ? join(resolve(FROM), basename(logo.file)) : masterPath;
    const bytes = new Uint8Array(readFileSync(source));

    if (extractC2paStore(bytes)) {
      if (!FORCE) {
        console.log(`  ${logo.file}: already credentialed - skipped (--force to re-sign)`);
        // Still resync hooks.js, so a hand-edited base64 can never drift from the master.
        hooks = patchHooks(hooks, logo.varName, toBase64(bytes));
        skipped++;
        continue;
      }
      throw new Error(
        `${source} already carries a credential; --force needs --from <dir> of UNSIGNED originals ` +
          '(re-signing a signed file would nest a second manifest).'
      );
    }

    const signedBytes = await embedC2pa(bytes, 'png', {
      title: logo.title,
      // Matches the export path's "<software> lolly.tools" so the verifier's
      // /\blolly\b/ test lights the Made-with-Lolly hero.
      claimGenerator: 'Lolly lolly.tools',
      generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
      author: { name: AUTHOR },
      authorship: 'delivered',
      environment: {
        tool: 'email-signature',
        format: 'png',
        surface: 'lolly.tools/tools/email-signature',
        engine: `Lolly ${ENGINE_VERSION}`,
      },
      dates: sb.dates,
      ...(sb.signer ? { signer: sb.signer } : {}),
    });
    writeFileSync(masterPath, signedBytes);
    hooks = patchHooks(hooks, logo.varName, toBase64(signedBytes));
    signed++;
    const b64 = Math.ceil(signedBytes.length / 3) * 4;
    console.log(
      `  ${logo.file}: signed - ${bytes.length} → ${signedBytes.length} B  (inlined base64 ${b64} B)`
    );
  }

  writeFileSync(hooksPath, hooks);
  console.log(`\n✓ ${signed} signed, ${skipped} already credentialed - ${TARGET.hooks} resynced`);
  console.log('  Next: npm run build:catalog && npm run validate:catalog');
}

await main();
