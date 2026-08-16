// SPDX-License-Identifier: MPL-2.0
/**
 * Enrolled signing identities for the terminal shells
 * (packages/node-shell/src/signing-identity.ts).
 *
 * THE ASSERTION THIS FILE EXISTS FOR is `trusted end to end`: a real P-256 key pair
 * and a real certificate chain are minted here (Node's WebCrypto plus the repo's own
 * DER/X.509 writers in engine/src/x509.ts - no openssl subprocess, so this runs the
 * same on every machine), a real SVG export is signed with them through the exact call
 * shells/cli/src/run.ts makes, and the resulting file is read back by the real verifier
 * with that root pinned. It must come out `signingCredential.trusted` with the signer's
 * email surfaced. Contract §12 O1 recorded that this was the one thing the trust-anchor
 * round could NOT verify, because it had no way to produce a file signed by an identity.
 * Now it can.
 *
 * Everything else here is the refusal surface: every misconfiguration must be caught at
 * setup, with a message that says which one it is, and NO message may ever contain a
 * byte of key material (asserted against the real key, on every failure path).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrivateKey } from 'node:crypto';

import {
  generateCaRoot, issueLeafCert, derToPem, pemToDer,
  embedC2pa, verifyC2pa, resolveVerdict, C2PA_CHECK, defaultTrustAnchors, extractC2paStore,
} from '../engine/src/index.ts';
import { buildExportC2paOpts } from '../packages/node-shell/src/c2pa-opts.ts';
import {
  resolveSigningIdentity, describeIdentity, SigningIdentityError, SIGN_ENV,
} from '../packages/node-shell/src/signing-identity.ts';

const subtle = globalThis.crypto.subtle;
const DAY = 86_400_000;

// ─── fixtures: a real CA, a real leaf, real key files ─────────────────────────

interface Pair { pkcs8Pem: string; spkiDer: Uint8Array; }

async function keyPair(namedCurve = 'P-256'): Promise<Pair> {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve }, true, ['sign', 'verify']) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey));
  const spki = new Uint8Array(await subtle.exportKey('spki', kp.publicKey));
  return { pkcs8Pem: derToPem(pkcs8, 'PRIVATE KEY'), spkiDer: spki };
}

interface Ca { certDer: Uint8Array; certPem: string; pkcs8Der: Uint8Array; }

async function makeCa(commonName = 'Test Signing CA'): Promise<Ca> {
  const root = await generateCaRoot({ commonName, organization: 'Lolly Test' });
  return { certDer: root.certDer, certPem: derToPem(root.certDer, 'CERTIFICATE'), pkcs8Der: root.pkcs8Der };
}

async function leafFor(ca: Ca, pair: Pair, opts: { email?: string; notBefore?: Date; notAfter?: Date } = {}): Promise<Uint8Array> {
  return issueLeafCert({
    caCertDer: ca.certDer, caPrivateKey: ca.pkcs8Der, spkiDer: pair.spkiDer,
    email: opts.email ?? 'ci@example.test', organization: 'Lolly Test',
    ...(opts.notBefore ? { notBefore: opts.notBefore } : {}),
    ...(opts.notAfter ? { notAfter: opts.notAfter } : {}),
  });
}

/** A temp dir that cleans itself up when the callback returns. */
async function withDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-sign-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Write key + chain files and resolve the identity from them. */
async function identityFrom(dir: string, keyPem: string, chainPems: string[], extra: Record<string, unknown> = {}) {
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'chain.pem');
  await writeFile(keyPath, keyPem);
  await writeFile(certPath, chainPems.join(''));
  return resolveSigningIdentity({ keyPath, certPath, env: {}, ...extra });
}

// The minimal real SVG the sign/verify round-trip runs on. SVG is the CLI's one
// DOM-free C2PA-capable format, so this is the byte path a plain `lolly qr-code
// --export=svg` takes.
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#0c322c"/></svg>';
const MODEL = [{ id: 'url', type: 'text', value: 'https://lolly.tools' }] as never;

// ─── the proof ────────────────────────────────────────────────────────────────

test('an enrolled identity signs a real export and it reads TRUSTED against the pinned root', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    const leafDer = await leafFor(ca, pair, { email: 'release-bot@example.test' });

    const id = await identityFrom(dir, pair.pkcs8Pem, [derToPem(leafDer, 'CERTIFICATE'), ca.certPem]);
    assert.ok(id, 'identity resolved');
    assert.equal(id.email, 'release-bot@example.test');
    assert.equal(id.chainLength, 2);
    assert.deepEqual(id.warnings, [], 'a chain ending at a self-signed root warns about nothing');

    // The exact call shells/cli/src/run.ts makes for a Node-tier export.
    const signed = await embedC2pa(new TextEncoder().encode(SVG), 'svg', buildExportC2paOpts({
      surface: 'cli', manifest: { id: 'qr-code', name: 'QR Code' }, model: MODEL, format: 'svg',
      signer: id.signer, signerValidity: { notBefore: id.notBefore, notAfter: id.notAfter },
    }));

    // 1. The manifest carries the x5chain - both certificates, verbatim. (SVG carries
    //    the JUMBF store base64-encoded, so the check is against the EXTRACTED store,
    //    not the file bytes.)
    const bytes = new Uint8Array(signed);
    const store = extractC2paStore(bytes);
    assert.ok(store, 'the SVG carries a readable C2PA store');
    assert.ok(indexOfBytes(store.store, leafDer) >= 0, 'the leaf certificate is in the x5chain');
    assert.ok(indexOfBytes(store.store, ca.certDer) >= 0, 'the issuing root is in the x5chain alongside it');

    // 2. Verified with the root pinned: trusted, with the identity surfaced.
    const trusted = await verifyC2pa(bytes, { trustAnchors: [ca.certDer] });
    assert.equal(trusted.signer?.identity?.email, 'release-bot@example.test');
    assert.ok(
      trusted.checks.some(c => c.code === C2PA_CHECK.signingCredentialTrusted && c.ok),
      `expected signingCredential.trusted; got ${JSON.stringify(trusted.checks.map(c => [c.code, c.ok]))}`,
    );
    assert.equal(resolveVerdict(trusted).trusted, true, 'the shared verdict resolver agrees');

    // 3. The SAME bytes, verified without that root, are honestly untrusted. This is
    //    the control: without it "trusted" could just mean the verifier is lax.
    const bare = await verifyC2pa(bytes, { trustAnchors: [] });
    assert.equal(bare.signer?.identity, undefined);
    assert.equal(resolveVerdict(bare).trusted, false);

    // 4. The default terminal anchor set (contract §12 O1: Lolly root + vendored list)
    //    does NOT trust a stranger's CA. Pinning is what makes this work, and the
    //    default is not a blanket yes.
    const defaults = await verifyC2pa(bytes, { trustAnchors: defaultTrustAnchors() });
    assert.equal(resolveVerdict(defaults).trusted, false);
  });
});

test('with no identity configured the resolver returns null (the ephemeral path is untouched)', async () => {
  assert.equal(await resolveSigningIdentity({ env: {} }), null);
  assert.equal(await resolveSigningIdentity({ env: { LOLLY_ROOT: '/tmp' } }), null);
});

test('an unsigned-identity export still verifies as an anonymous credential', async () => {
  // The additive guarantee, asserted rather than assumed: the same call with no signer
  // produces a file whose credential is intact and whose signer is nobody.
  const signed = await embedC2pa(new TextEncoder().encode(SVG), 'svg', buildExportC2paOpts({
    surface: 'cli', manifest: { id: 'qr-code' }, model: MODEL, format: 'svg',
  }));
  const report = await verifyC2pa(new Uint8Array(signed), { trustAnchors: [] });
  assert.equal(report.signer?.selfSigned, true);
  assert.equal(report.signer?.identity, undefined);
});

// ─── sources: flags, env paths, env PEM ───────────────────────────────────────

test('the identity can come from env paths or from inline env PEM (the CI secret-store path)', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    const leafPem = derToPem(await leafFor(ca, pair), 'CERTIFICATE');
    const keyPath = join(dir, 'k.pem');
    const certPath = join(dir, 'c.pem');
    await writeFile(keyPath, pair.pkcs8Pem);
    await writeFile(certPath, leafPem + ca.certPem);

    const viaPaths = await resolveSigningIdentity({ env: { [SIGN_ENV.key]: keyPath, [SIGN_ENV.cert]: certPath } });
    assert.equal(viaPaths?.keySource, keyPath);

    const viaPem = await resolveSigningIdentity({ env: { [SIGN_ENV.keyPem]: pair.pkcs8Pem, [SIGN_ENV.certPem]: leafPem + ca.certPem } });
    assert.equal(viaPem?.keySource, `$${SIGN_ENV.keyPem}`, 'the source names the VARIABLE, never its contents');
    assert.equal(viaPem?.chainLength, 2);

    // Flag beats environment (contract §1.5: flag > env > default).
    const both = await resolveSigningIdentity({ keyPath, certPath, env: { [SIGN_ENV.keyPem]: 'nonsense', [SIGN_ENV.certPem]: 'nonsense' } });
    assert.equal(both?.keySource, keyPath);
  });
});

test('describeIdentity is a one-line summary of certificate facts only', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    const id = await identityFrom(dir, pair.pkcs8Pem, [derToPem(await leafFor(ca, pair, { email: 'a@b.test' }), 'CERTIFICATE'), ca.certPem]);
    const line = describeIdentity(id!);
    assert.match(line, /^Signing as a@b\.test \(Lolly Test\) · 2 certificates in the chain · valid until /);
    assert.equal(line.includes('\n'), false);
  });
});

// ─── refusals ─────────────────────────────────────────────────────────────────

/** Run `fn`, assert it threw a SigningIdentityError with `code`, return the message. */
async function refusal(code: string, fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    assert.fail(`expected ${code}, but nothing was thrown`);
  } catch (e) {
    if (!(e instanceof SigningIdentityError)) throw e;
    assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
    return e.message;
  }
}

test('half a configuration is a refusal, never a silent fall back to the anonymous signer', async () => {
  const key = await refusal('SIGN_IDENTITY_INCOMPLETE', () => resolveSigningIdentity({ keyPath: '/nope/k.pem', env: {} }));
  assert.match(key, /--sign-cert/);
  const cert = await refusal('SIGN_IDENTITY_INCOMPLETE', () => resolveSigningIdentity({ certPath: '/nope/c.pem', env: {} }));
  assert.match(cert, /--sign-key/);
});

test('an unreadable key or chain path names the flag and the path', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    await writeFile(join(dir, 'c.pem'), derToPem(await leafFor(ca, pair), 'CERTIFICATE'));
    const missing = join(dir, 'absent.pem');

    const k = await refusal('SIGN_KEY_UNREADABLE', () => resolveSigningIdentity({ keyPath: missing, certPath: join(dir, 'c.pem'), env: {} }));
    assert.match(k, /--sign-key: cannot read/);
    assert.ok(k.includes(missing));

    await writeFile(join(dir, 'k.pem'), pair.pkcs8Pem);
    const c = await refusal('SIGN_CERT_UNREADABLE', () => resolveSigningIdentity({ keyPath: join(dir, 'k.pem'), certPath: missing, env: {} }));
    assert.match(c, /--sign-cert: cannot read/);
  });
});

test('a file that is not a key, and a file that is not a certificate, are each named', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    const leafPem = derToPem(await leafFor(ca, pair), 'CERTIFICATE');

    const notKey = await refusal('SIGN_KEY_UNREADABLE', () => identityFrom(dir, 'this is not a key at all\n', [leafPem]));
    assert.match(notKey, /Cannot read the signing key/);
    assert.match(notKey, /PKCS#8/);

    const notCert = await refusal('SIGN_CERT_UNREADABLE', () => identityFrom(dir, pair.pkcs8Pem, ['just some text\n']));
    assert.match(notCert, /contains no certificate/);
  });
});

test('a key that does not match its certificate is caught at SETUP, not by the recipient', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const enrolled = await keyPair();
    const other = await keyPair();
    // The classic misconfiguration: the certificate from one enrolment, the key from
    // another. Both files are individually perfect.
    const leafPem = derToPem(await leafFor(ca, enrolled), 'CERTIFICATE');
    const msg = await refusal('SIGN_KEY_CERT_MISMATCH', () => identityFrom(dir, other.pkcs8Pem, [leafPem, ca.certPem]));
    assert.match(msg, /does not match the leaf certificate/);
    assert.match(msg, /LEAF certificate first/);
  });
});

test('an expired or not-yet-valid certificate is refused before anything is written', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();

    const expired = await leafFor(ca, pair, { notBefore: new Date(Date.now() - 40 * DAY), notAfter: new Date(Date.now() - 10 * DAY) });
    const e = await refusal('SIGN_CERT_EXPIRED', () => identityFrom(dir, pair.pkcs8Pem, [derToPem(expired, 'CERTIFICATE'), ca.certPem]));
    assert.match(e, /expired at \d{4}-/);

    const future = await leafFor(ca, pair, { notBefore: new Date(Date.now() + 10 * DAY), notAfter: new Date(Date.now() + 40 * DAY) });
    const f = await refusal('SIGN_CERT_NOT_YET_VALID', () => identityFrom(dir, pair.pkcs8Pem, [derToPem(future, 'CERTIFICATE'), ca.certPem]));
    assert.match(f, /not valid yet/);
  });
});

test('a chain in the wrong order is refused, and a chain missing its root only warns', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa('Ordering CA');
    const pair = await keyPair();
    const leafPem = derToPem(await leafFor(ca, pair), 'CERTIFICATE');

    // A chain whose second certificate did not issue the first: the leaf is right, the
    // issuer appended after it is somebody else's root. Links nowhere.
    const strangerCa = await makeCa('Unrelated CA');
    const msg = await refusal('SIGN_CHAIN_ORDER', () => identityFrom(dir, pair.pkcs8Pem, [leafPem, strangerCa.certPem]));
    assert.match(msg, /does not link/);
    assert.match(msg, /leaf first/);

    // Root first, leaf second - the reversal - is caught one check EARLIER, by the
    // key/certificate match (position 0 is not the leaf, so the key does not match it).
    // Different code, and its message carries the same "LEAF certificate first" fix.
    const reversed = await refusal('SIGN_KEY_CERT_MISMATCH', () => identityFrom(dir, pair.pkcs8Pem, [ca.certPem, leafPem]));
    assert.match(reversed, /LEAF certificate first/);

    // Leaf alone: legitimate (the verifier may pin the issuer itself), so it loads,
    // but it is the commonest reason a signed file still reads untrusted.
    const idOnly = await identityFrom(dir, pair.pkcs8Pem, [leafPem]);
    assert.equal(idOnly?.chainLength, 1);
    assert.equal(idOnly?.warnings.length, 1);
    assert.match(idOnly!.warnings[0]!, /not self-signed/);
  });
});

test('a key that is not P-256 is refused by name rather than failing at export time', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const p384 = await keyPair('P-384');
    // Any certificate will do - the algorithm gate fires before the match check.
    const p256 = await keyPair();
    const leafPem = derToPem(await leafFor(ca, p256), 'CERTIFICATE');
    const msg = await refusal('SIGN_ALG_UNSUPPORTED', () => identityFrom(dir, p384.pkcs8Pem, [leafPem]));
    assert.match(msg, /EC secp384r1|EC P-384|EC .*384/);
    assert.match(msg, /ES256/);
  });
});

// ─── passphrases ──────────────────────────────────────────────────────────────

/** Re-export the key as an encrypted PKCS#8 PEM. */
function encryptKey(pkcs8Pem: string, passphrase: string): string {
  return createPrivateKey(pkcs8Pem).export({
    type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase,
  }) as string;
}

test('an encrypted key: env passphrase works, a wrong one and a missing one are distinct refusals', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    const leafPem = derToPem(await leafFor(ca, pair), 'CERTIFICATE');
    const enc = encryptKey(pair.pkcs8Pem, 'correct horse battery staple');

    const ok = await identityFrom(dir, enc, [leafPem, ca.certPem], { env: { [SIGN_ENV.password]: 'correct horse battery staple' } });
    assert.equal(ok?.chainLength, 2);

    const wrong = await refusal('SIGN_KEY_PASSWORD_WRONG', () => identityFrom(dir, enc, [leafPem, ca.certPem], { env: { [SIGN_ENV.password]: 'wrong' } }));
    assert.match(wrong, /passphrase .* is wrong/);

    // No env var, no prompt available (a pipeline). It must refuse, not hang.
    const missing = await refusal('SIGN_KEY_PASSWORD_REQUIRED', () => identityFrom(dir, enc, [leafPem, ca.certPem]));
    assert.match(missing, /LOLLY_SIGN_KEY_PASSWORD/);
    assert.match(missing, /visible in `ps`/);

    // The prompt is consulted only when there is one, and its answer is used.
    let prompted = 0;
    const viaPrompt = await identityFrom(dir, enc, [leafPem, ca.certPem], {
      promptPassword: async () => { prompted++; return 'correct horse battery staple'; },
    });
    assert.equal(prompted, 1);
    assert.equal(viaPrompt?.chainLength, 2);
  });
});

// ─── the rule that outranks all of them ───────────────────────────────────────

test('NO error message ever contains key material', async () => {
  await withDir(async (dir) => {
    const ca = await makeCa();
    const pair = await keyPair();
    const other = await keyPair();
    const leafPem = derToPem(await leafFor(ca, pair), 'CERTIFICATE');
    const PASS = 'a-passphrase-that-must-never-be-echoed';
    const enc = encryptKey(pair.pkcs8Pem, PASS);

    // Every secret this feature can hold: the PKCS#8 base64 body (whole and in 24-char
    // slices, so a truncated echo is caught too), the encrypted PEM's body, and the
    // passphrase.
    const body = pair.pkcs8Pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const encBody = enc.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const secrets = [body, encBody, PASS, ...sliceEvery(body, 24), ...sliceEvery(encBody, 24)];

    const messages: string[] = [];
    const collect = async (fn: () => Promise<unknown>): Promise<void> => {
      try { await fn(); } catch (e) { messages.push(String((e as Error).message)); messages.push(String((e as Error).stack ?? '')); }
    };

    await collect(() => identityFrom(dir, pair.pkcs8Pem, ['not a certificate']));
    await collect(() => identityFrom(dir, other.pkcs8Pem, [leafPem, ca.certPem]));
    await collect(() => identityFrom(dir, enc, [leafPem, ca.certPem]));
    await collect(() => identityFrom(dir, enc, [leafPem, ca.certPem], { env: { [SIGN_ENV.password]: PASS + 'x' } }));
    await collect(() => identityFrom(dir, 'garbage', [leafPem]));
    await collect(() => identityFrom(dir, pair.pkcs8Pem, [ca.certPem, leafPem]));
    await collect(() => resolveSigningIdentity({ env: { [SIGN_ENV.keyPem]: pair.pkcs8Pem, [SIGN_ENV.certPem]: 'nope' } }));

    assert.ok(messages.length >= 7, `expected every path to throw; got ${messages.length / 2}`);
    for (const m of messages) {
      for (const s of secrets) {
        assert.equal(m.includes(s), false, `an error message leaked key material: ${m.slice(0, 200)}`);
      }
    }
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function sliceEvery(s: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

/** Byte-subsequence search - proves the certificate DER rides in the file verbatim. */
function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// Referenced so an unused-import lint never removes the PEM reader the fixtures rely
// on indirectly through issueLeafCert's DER inputs.
void pemToDer;
