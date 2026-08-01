// SPDX-License-Identifier: MPL-2.0
/**
 * Enrolled signing identities for the terminal shells — load an operator's own
 * private key + certificate chain and hand `embedC2pa` a real {@link C2paSigner}
 * instead of the ephemeral self-signed one.
 *
 * WHY THIS EXISTS. Every CLI export until now was signed by a fresh, anonymous,
 * self-signed on-device certificate, so it read `signingCredential.untrusted` no
 * matter which roots the verifier pinned. Contract §12 O1 made the terminal pin
 * the Lolly CA root by default, which is only a meaningful decision for files
 * signed by an identity that chains somewhere. This module is that identity.
 *
 * THE RULES IT ENFORCES, all of them security-relevant:
 *
 *  • KEY MATERIAL NEVER COMES FROM ARGV. The caller passes a FILE PATH, or PEM
 *    text out of an environment variable. `ps` shows every argument of every
 *    process on the machine to every user on it, shell history keeps a copy, and
 *    CI logs the command line. A path is not a secret; a key is.
 *
 *  • THE KEY AND THE CERTIFICATE MUST MATCH, checked here at setup time. The
 *    classic misconfiguration is a key from one enrolment and a certificate from
 *    another: the file signs fine, the manifest carries an x5chain whose leaf
 *    public key cannot verify the signature, and the mismatch is only discovered
 *    by the recipient. We derive the public key from the private key and compare
 *    it byte-for-byte with the leaf's SubjectPublicKeyInfo. Mismatch is a refusal.
 *
 *  • NOTHING HERE EVER PRINTS KEY MATERIAL. Every error message names the SOURCE
 *    (a path, or an environment variable's NAME) and the failure, never a byte of
 *    the key. `tests/cli-signing-identity.test.ts` asserts that for every failure
 *    path, against a real key.
 *
 *  • THE KEY IS IMPORTED NON-EXTRACTABLE. The WebCrypto handle handed to the
 *    engine cannot be exported back out, so a tool hook that gets hold of the
 *    signer object still cannot read the key.
 *
 * ZEROING, HONESTLY. The file bytes and the decoded PKCS#8 both live in Buffers
 * we overwrite with zeros as soon as the key is imported, and the PEM is never
 * converted to a JS string (`Buffer.includes` does the sniffing) precisely
 * because a string cannot be zeroed. What CANNOT be guaranteed on this platform:
 * Node's `KeyObject` keeps its own copy in OpenSSL-managed memory with no public
 * "wipe" call, V8 may have copied any of these buffers during a GC compaction,
 * and the OS may have paged them to swap. Zeroing here shortens the window; it
 * does not close it. If that window matters to your threat model, the key wants
 * an HSM/KMS, not a file.
 *
 * DELIBERATELY NOT SUPPORTED: PKCS#12 / .p12. Node has no built-in PKCS#12
 * reader (`crypto.createPrivateKey` refuses it and WebCrypto has no such format),
 * so supporting the single-file bundle most CAs hand out would mean adding a
 * full ASN.1 + PKCS#12 dependency to a package that has none. `openssl pkcs12
 * -in id.p12 -nocerts -out key.pem` plus `-clcerts -nokeys -out cert.pem` is a
 * two-command conversion the operator runs once; docs/cli-signing.md gives it
 * verbatim. Reconsider only if the engine ever needs an ASN.1 library anyway.
 *
 * PURE-ish: filesystem reads and `node:crypto`, no CLI vocabulary. What a shell
 * does with a `SigningIdentityError` (exit code, envelope shape) stays per-shell,
 * the same split `trust-anchors.ts` draws.
 */

import { readFile } from 'node:fs/promises';
import { createPrivateKey, createPublicKey, webcrypto } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { parseCertificate, signedBy } from '@lolly/engine';
// The same `~` rule --trust-anchor uses. A shell does NOT expand a tilde after `=` in
// `--sign-key=~/.config/…`, so without this the documented path silently ENOENTs.
import { expandHome } from './trust-anchors.ts';
import type { C2paSigner, ParsedCertificate } from '@lolly/engine';

/** Environment variables this module reads. Frozen in plans/cli-ga-contract.md §1.5. */
export const SIGN_ENV = {
  /** Path to the PKCS#8 (or SEC1) private key file. */
  key: 'LOLLY_SIGN_KEY',
  /** Path to the PEM certificate chain file, leaf first. */
  cert: 'LOLLY_SIGN_CERT',
  /** The private key's PEM text itself, for CI secret stores with no filesystem. */
  keyPem: 'LOLLY_SIGN_KEY_PEM',
  /** The certificate chain's PEM text itself. */
  certPem: 'LOLLY_SIGN_CERT_PEM',
  /** Passphrase for an encrypted private key. */
  password: 'LOLLY_SIGN_KEY_PASSWORD',
} as const;

/**
 * A failure to configure an identity. `code` is the STABLE machine handle a shell
 * maps to an exit code and puts in its JSON envelope; the message is human text we
 * reserve the right to reword. NEITHER ever contains key material.
 */
export class SigningIdentityError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SigningIdentityError';
    this.code = code;
  }
}

export interface SigningIdentityInput {
  /** `--sign-key=<path>`. Wins over both environment forms. */
  keyPath?: string;
  /** `--sign-cert=<path>`. Wins over both environment forms. */
  certPath?: string;
  /** Passphrase, from an env var or an interactive prompt. NEVER from argv. */
  password?: string;
  /**
   * Called when the key is encrypted and no passphrase was supplied any other
   * way. The shell owns this (TTY detection, echo suppression); returning
   * undefined means "no passphrase available", which is a clean refusal.
   */
  promptPassword?: () => Promise<string | undefined>;
  /** Environment to read. Defaults to `process.env`; injectable for tests. */
  env?: Record<string, string | undefined>;
}

/** A loaded, validated identity. Carries facts about the certificate, never the key. */
export interface SigningIdentity {
  /** Ready for `embedC2pa`'s `signer` option: non-extractable key + x5chain. */
  signer: C2paSigner;
  /** Leaf subject CN, if it has one. */
  commonName?: string;
  /** Leaf subject O, if it has one. */
  organization?: string;
  /** First SAN rfc822Name — what a verifier reports as the signer's identity. */
  email?: string;
  notBefore: Date;
  notAfter: Date;
  /** Number of certificates in the x5chain (leaf included). */
  chainLength: number;
  /** Where the key came from, for a human log line. A path or an env var NAME. */
  keySource: string;
  /** Where the chain came from. A path or an env var NAME. */
  certSource: string;
  /**
   * Non-fatal observations worth printing. Today the only one: a chain that ends
   * at a certificate which is not self-signed, i.e. the issuing root is not
   * included. That is legitimate (the verifier may pin exactly that issuer) so it
   * is not a refusal, but it is the most common reason a file that "signed fine"
   * still reads untrusted.
   */
  warnings: string[];
}

// ─── PEM handling ─────────────────────────────────────────────────────────────

const PEM_CERT = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;

/**
 * Split a PEM bundle into DER certificates, in file order. A file that is not PEM
 * at all but starts with an ASN.1 SEQUENCE tag is accepted as a single DER cert.
 */
function readCertChain(bytes: Buffer, source: string): Uint8Array[] {
  const text = bytes.toString('latin1');
  const out: Uint8Array[] = [];
  PEM_CERT.lastIndex = 0;
  for (let m = PEM_CERT.exec(text); m; m = PEM_CERT.exec(text)) {
    const b64 = m[1]!.replace(/\s+/g, '');
    try { out.push(new Uint8Array(Buffer.from(b64, 'base64'))); }
    catch { throw new SigningIdentityError(`--sign-cert: ${source} contains a CERTIFICATE block that is not valid base64.`, 'SIGN_CERT_UNREADABLE'); }
  }
  if (out.length) return out;
  if (bytes.length > 1 && bytes[0] === 0x30) return [new Uint8Array(bytes)];
  throw new SigningIdentityError(
    `--sign-cert: ${source} contains no certificate. Expected one or more "-----BEGIN CERTIFICATE-----" PEM blocks (leaf first), or a single DER certificate.`,
    'SIGN_CERT_UNREADABLE',
  );
}

// ─── key handling ─────────────────────────────────────────────────────────────

// Node reports a wrong passphrase through OpenSSL's decrypt errors rather than a
// typed exception. Keyed on OpenSSL's own strings, not ours, so the classification
// survives a reworded Node error.
const BAD_PASSPHRASE = /bad decrypt|wrong final block length|DECRYPT|mac verify failure/i;

/**
 * Import the private key with `node:crypto` (which, unlike WebCrypto, can read an
 * ENCRYPTED PKCS#8 and a legacy SEC1 EC key), then hand WebCrypto an unencrypted
 * PKCS#8 and zero it. The returned KeyObject is used only to derive the public key
 * for the match check.
 */
async function importPrivateKey(
  bytes: Buffer,
  source: string,
  input: SigningIdentityInput,
  env: Record<string, string | undefined>,
): Promise<{ cryptoKey: CryptoKey; keyObject: KeyObject }> {
  // Sniff on BYTES, never on a decoded string: a JS string of the key could not be
  // zeroed afterwards and would outlive this function inside V8's heap.
  const isDer = bytes.length > 1 && bytes[0] === 0x30 && !bytes.includes('-----BEGIN');
  const encrypted = bytes.includes('ENCRYPTED') || bytes.includes('Proc-Type: 4,ENCRYPTED');

  let passphrase = input.password ?? env[SIGN_ENV.password] ?? undefined;
  if (encrypted && !passphrase && input.promptPassword) passphrase = await input.promptPassword();
  if (encrypted && !passphrase) {
    throw new SigningIdentityError(
      `The signing key at ${source} is passphrase-protected and no passphrase was available. ` +
      `Set $${SIGN_ENV.password} (a CI secret store is the right home for it), or run this from a terminal so it can be typed. ` +
      'There is deliberately no --sign-key-password flag: an argument is visible in `ps` to every user on this machine.',
      'SIGN_KEY_PASSWORD_REQUIRED',
    );
  }

  let keyObject: KeyObject;
  try {
    keyObject = createPrivateKey(
      isDer
        ? { key: bytes, format: 'der', type: 'pkcs8' }
        : { key: bytes, format: 'pem', ...(passphrase ? { passphrase } : {}) },
    );
  } catch (e) {
    const msg = (e as Error).message || '';
    if (encrypted && BAD_PASSPHRASE.test(msg)) {
      throw new SigningIdentityError(
        `The passphrase for the signing key at ${source} is wrong (the key did not decrypt).`,
        'SIGN_KEY_PASSWORD_WRONG',
      );
    }
    // OpenSSL's own diagnostic ("unsupported", "no start line") is useful and
    // echoes nothing of the input; it is the only part of `e` we forward.
    throw new SigningIdentityError(
      `Cannot read the signing key at ${source}: ${firstLine(msg) || 'not a private key'}. ` +
      'Expected an unencrypted or passphrase-protected PKCS#8 PEM (-----BEGIN PRIVATE KEY----- / -----BEGIN ENCRYPTED PRIVATE KEY-----), a SEC1 EC PEM, or a PKCS#8 DER file.',
      'SIGN_KEY_UNREADABLE',
    );
  }

  // ES256 / P-256 only, because that is the one COSE algorithm the C2PA writer
  // emits (see coseSign1Detached in engine/src/c2pa.ts, which hard-fails on any
  // signature that is not a raw 64-byte r||s). Refusing here is the difference
  // between a clear setup error and an unexplained export failure.
  const curve = (keyObject.asymmetricKeyDetails as { namedCurve?: string } | undefined)?.namedCurve;
  if (keyObject.asymmetricKeyType !== 'ec' || curve !== 'prime256v1') {
    const got = keyObject.asymmetricKeyType === 'ec' ? `EC ${curve ?? 'unknown curve'}` : String(keyObject.asymmetricKeyType ?? 'unknown');
    throw new SigningIdentityError(
      `The signing key at ${source} is ${got}. Content Credentials are signed with ES256, so the key must be EC P-256 (prime256v1). Enrol or issue a P-256 key.`,
      'SIGN_ALG_UNSUPPORTED',
    );
  }

  const pkcs8 = keyObject.export({ format: 'der', type: 'pkcs8' }) as Buffer;
  // A copy, because WebCrypto's typed signature wants an ArrayBuffer-backed view and a
  // Node Buffer may sit on a shared pool. Both are zeroed below.
  const view = new Uint8Array(pkcs8);
  try {
    // extractable: false — the engine only ever calls subtle.sign with this, and a
    // tool hook that reaches the signer object still cannot read the key back out.
    const cryptoKey = await webcrypto.subtle.importKey(
      'pkcs8', view, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
    ) as unknown as CryptoKey;
    return { cryptoKey, keyObject };
  } finally {
    view.fill(0);
    pkcs8.fill(0);
  }
}

const firstLine = (s: string): string => String(s).split('\n')[0]!.trim();

// ─── the whole check ──────────────────────────────────────────────────────────

/**
 * Resolve a signing identity from flags + environment, or `null` when none is
 * configured (which keeps today's ephemeral-signer behaviour exactly).
 *
 * Precedence, matching the contract's flag > env rule: `--sign-key`/`--sign-cert`
 * win over `$LOLLY_SIGN_KEY`/`$LOLLY_SIGN_CERT`, which win over the inline
 * `$LOLLY_SIGN_KEY_PEM`/`$LOLLY_SIGN_CERT_PEM`.
 *
 * Everything that can be wrong is checked here, at setup, rather than left to
 * produce a file nobody can verify: unreadable key, wrong passphrase, unsupported
 * algorithm, unreadable chain, key/certificate mismatch, a certificate outside its
 * validity window, and a chain whose order does not link.
 */
export async function resolveSigningIdentity(input: SigningIdentityInput = {}): Promise<SigningIdentity | null> {
  const env = input.env ?? process.env;
  const keyPath = input.keyPath ?? env[SIGN_ENV.key];
  const certPath = input.certPath ?? env[SIGN_ENV.cert];
  const keyPem = env[SIGN_ENV.keyPem];
  const certPem = env[SIGN_ENV.certPem];

  const haveKey = Boolean(keyPath || keyPem);
  const haveCert = Boolean(certPath || certPem);
  if (!haveKey && !haveCert) return null;
  if (!haveKey || !haveCert) {
    // Half a configuration must never silently fall back to the anonymous signer:
    // the operator asked for an identity and would get an untrusted file believing
    // otherwise.
    throw new SigningIdentityError(
      haveKey
        ? `A signing key was configured but no certificate chain. Add --sign-cert=<chain.pem> (or $${SIGN_ENV.cert} / $${SIGN_ENV.certPem}). A key alone cannot produce a verifiable credential.`
        : `A signing certificate was configured but no private key. Add --sign-key=<key.pem> (or $${SIGN_ENV.key} / $${SIGN_ENV.keyPem}).`,
      'SIGN_IDENTITY_INCOMPLETE',
    );
  }

  const keySource = keyPath ? keyPath : `$${SIGN_ENV.keyPem}`;
  const certSource = certPath ? certPath : `$${SIGN_ENV.certPem}`;

  const keyBytes = keyPath ? await readSecret(keyPath, 'SIGN_KEY_UNREADABLE', '--sign-key') : Buffer.from(keyPem!, 'utf8');
  let certBytes: Buffer;
  try {
    certBytes = certPath ? await readSecret(certPath, 'SIGN_CERT_UNREADABLE', '--sign-cert') : Buffer.from(certPem!, 'utf8');
  } catch (e) { keyBytes.fill(0); throw e; }

  let cryptoKey: CryptoKey;
  let keyObject: KeyObject;
  try {
    ({ cryptoKey, keyObject } = await importPrivateKey(keyBytes, keySource, input, env));
  } finally {
    // Whatever happened, the file bytes stop existing in this process's heap here.
    // (See the module header on what zeroing can and cannot promise.)
    keyBytes.fill(0);
  }

  const chain = readCertChain(certBytes, certSource);
  const parsed: ParsedCertificate[] = chain.map((der, i) => {
    try { return parseCertificate(der); }
    catch { throw new SigningIdentityError(`--sign-cert: certificate ${i + 1} of ${chain.length} in ${certSource} is not a readable X.509 certificate.`, 'SIGN_CERT_UNREADABLE'); }
  });
  const leaf = parsed[0]!;

  // THE MATCH CHECK. The public key derived from the private key must be the leaf's
  // SubjectPublicKeyInfo, byte for byte. Without this a mismatched pair produces a
  // perfectly well-formed manifest that no verifier on earth can validate.
  // `createPublicKey` accepts a KeyObject at runtime (that is the whole point of the
  // overload); the bundled @types/node union omits it, hence the cast. Deriving it from
  // the KeyObject rather than re-exporting a PEM matters: a PEM would be an
  // unencrypted JS string of the private key that could never be zeroed.
  const derivedSpki = new Uint8Array(
    createPublicKey(keyObject as unknown as Parameters<typeof createPublicKey>[0]).export({ format: 'der', type: 'spki' }) as Buffer,
  );
  if (!sameBytes(derivedSpki, leaf.spki)) {
    throw new SigningIdentityError(
      `The signing key at ${keySource} does not match the leaf certificate in ${certSource}: the key's public half is not the certificate's subject public key. ` +
      'They are from different enrolments. Re-export the pair together, and make sure the chain file has the LEAF certificate first.',
      'SIGN_KEY_CERT_MISMATCH',
    );
  }

  // Validity window, checked against this machine's clock. An expired certificate
  // still signs, and the file still hashes; it simply reads "Credential expired"
  // for its whole life, which is not what anyone configuring an identity wants.
  const now = Date.now();
  if (now < leaf.notBefore.getTime()) {
    throw new SigningIdentityError(
      `The signing certificate in ${certSource} is not valid yet: it starts at ${leaf.notBefore.toISOString()} and this machine's clock reads ${new Date(now).toISOString()}. Check the system clock, or wait.`,
      'SIGN_CERT_NOT_YET_VALID',
    );
  }
  if (now > leaf.notAfter.getTime()) {
    throw new SigningIdentityError(
      `The signing certificate in ${certSource} expired at ${leaf.notAfter.toISOString()}. Everything signed with it would read "Credential expired" from the moment it was written. Renew or re-enrol the certificate.`,
      'SIGN_CERT_EXPIRED',
    );
  }

  // Chain ORDER. x5chain is leaf first, each certificate issued by the next. A chain
  // assembled in the wrong order verifies nowhere, and "it's in the file" is exactly
  // the kind of thing that looks fine until a recipient checks it.
  for (let i = 1; i < parsed.length; i++) {
    if (!(await signedBy(parsed[i - 1]!, parsed[i]!))) {
      throw new SigningIdentityError(
        `The certificate chain in ${certSource} does not link: certificate ${i + 1} (${describe(parsed[i]!)}) did not issue certificate ${i} (${describe(parsed[i - 1]!)}). ` +
        'A chain is ordered leaf first, then each issuer in turn. Concatenate them in that order.',
        'SIGN_CHAIN_ORDER',
      );
    }
  }

  const warnings: string[] = [];
  const last = parsed[parsed.length - 1]!;
  if (!last.selfSigned) {
    warnings.push(
      `the chain in ${certSource} stops at ${describe(last)}, which is not self-signed, so its issuing root is not included. ` +
      'That verifies only for a recipient who pins exactly that issuer. Append the issuing certificates if you want the chain to reach a root on its own.',
    );
  }

  return {
    signer: { privateKey: cryptoKey, certDer: chain[0]!, chain },
    ...(leaf.subject.commonName ? { commonName: leaf.subject.commonName } : {}),
    ...(leaf.subject.organization ? { organization: leaf.subject.organization } : {}),
    ...(leaf.sanEmails[0] ? { email: leaf.sanEmails[0] } : {}),
    notBefore: leaf.notBefore,
    notAfter: leaf.notAfter,
    chainLength: chain.length,
    keySource,
    certSource,
    warnings,
  };
}

/** One line naming a certificate, for an error message. Public data only. */
function describe(c: ParsedCertificate): string {
  return c.subject.commonName || c.subject.organization || 'an unnamed certificate';
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Read a file, turning the OS error into a SigningIdentityError naming the flag. */
async function readSecret(path: string, code: string, flag: string): Promise<Buffer> {
  try { return await readFile(expandHome(path)); }
  catch (e) {
    throw new SigningIdentityError(`${flag}: cannot read "${path}" (${firstLine((e as Error).message)}).`, code);
  }
}

/**
 * A one-line human summary of a loaded identity. Certificate facts only — this is
 * printed to stderr on every signed run, and it must stay printable in a CI log.
 */
export function describeIdentity(id: SigningIdentity): string {
  const who = id.email || id.commonName || 'an unnamed subject';
  const org = id.organization ? ` (${id.organization})` : '';
  return `Signing as ${who}${org} · ${id.chainLength} certificate${id.chainLength === 1 ? '' : 's'} in the chain · valid until ${id.notAfter.toISOString()}`;
}
