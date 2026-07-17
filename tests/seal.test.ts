// SPDX-License-Identifier: MPL-2.0
/**
 * SEAL (hackerfactor) signature verifier contract tests.
 * Run with: node --test tests/seal.test.ts
 *
 * HONESTY — this is a REAL crypto round-trip, not a mock:
 *   The independent source of truth is WebCrypto itself. Each fixture generates
 *   a genuine ECDSA / RSA key pair, builds a byte buffer with a real SEAL record
 *   over known ranges, and SIGNS the assembled message with the PRIVATE key
 *   using standard `crypto.subtle.sign`. The verifier under test then has to
 *   validate that signature with the PUBLIC key. Because the signing is done by
 *   an oracle the verifier has no hand in, a passing test means the verifier's
 *   parse → range-assembly → digest → verify chain matches real cryptography,
 *   not its own output. Tampering a covered byte must flip it to invalid.
 *
 *   The signature value region is EXCLUDED from the signed bytes (default
 *   b=F~S,s~f), so the fixture signs a placeholder-length record, then writes
 *   the real (differently-sized) signature into the excluded value slot — the
 *   assembled message is invariant to that slot, exactly as the format intends.
 *
 * UNVERIFIED here (documented, not claimed): behaviour against Wael Krawetz's
 * REAL published SEAL sample files, and against LIVE DNS / DNS-over-HTTPS — no
 * sample files and no network in this environment. The crypto round-trip below
 * is what is proven; the real-file + DoH path is exercised only in the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifySeal, parseSealRecord, parseSealRecords, computeSealDigest, assembleSealMessage,
  resolveRanges, verifySealSignature, importSealKey,
  type SealRecord,
} from '../engine/src/seal.ts';
import { ecdsaRawToDer } from '../engine/src/x509.ts';

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

const WEBCRYPTO_HASH: Record<string, string> = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' };
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

interface FixtureOpts {
  keyAlg?: 'ec' | 'rsa';
  da?: 'sha256' | 'sha384' | 'sha512';
  curve?: 'P-256' | 'P-384' | 'P-521';
  id?: string | null;
  timestamp?: string | null;   // present → date sf
  inlinePk?: boolean;
  b?: string | null;           // custom byte range spec
}

interface Fixture {
  bytes: Uint8Array;
  spki: Uint8Array;
  domain: string;
  record: SealRecord;
}

// Build a genuinely SEAL-signed file. Signs with a real private key over the
// assembled ranges (basic) or utf8(DATE:ID:)||digest1 (extended).
async function buildSealedFile(opts: FixtureOpts = {}): Promise<Fixture> {
  const keyAlg = opts.keyAlg ?? 'ec';
  const da = opts.da ?? 'sha256';
  const hash = WEBCRYPTO_HASH[da]!;
  const domain = 'example.com';

  const pair = keyAlg === 'ec'
    ? await subtle.generateKey({ name: 'ECDSA', namedCurve: opts.curve ?? 'P-256' }, true, ['sign', 'verify'])
    : await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await subtle.exportKey('spki', (pair as CryptoKeyPair).publicKey));
  const priv = (pair as CryptoKeyPair).privateKey;

  // Arbitrary container bytes around the record (like PNG/JPEG payload + trailer).
  const prefix = concat(te.encode('\x89PNG\r\n\x1a\n'), new Uint8Array([0, 1, 2, 3, 255, 254, 253]), te.encode('some image data goes here '));
  const suffix = concat(te.encode(' and some trailing bytes after the record'), new Uint8Array([9, 8, 7, 6]));

  const attrs: string[] = [`seal="1"`, `ka="${keyAlg}"`, `da="${da}"`, `d="${domain}"`];
  if (opts.b) attrs.push(`b="${opts.b}"`);
  if (opts.id) attrs.push(`id="${opts.id}"`);
  if (opts.timestamp) attrs.push(`sf="date:base64"`);
  if (opts.inlinePk) attrs.push(`pk="${b64(spki)}"`);
  const valuePrefix = opts.timestamp ? `${opts.timestamp}:` : '';

  // Placeholder record (value length differs from the real signature — that's
  // fine: the value region is excluded from the signed bytes).
  const mkRecord = (value: string): Uint8Array =>
    te.encode(`<seal ${attrs.join(' ')} s="${valuePrefix}${value}"/>`);

  let file = concat(prefix, mkRecord('PLACEHOLDER'), suffix);
  const rec0 = parseSealRecord(file);
  assert.ok(rec0, 'placeholder record must parse');
  assert.ok(rec0!.ranges, 'ranges must resolve');

  // Assemble exactly what the signer signs.
  const rangeMsg = assembleSealMessage(file, rec0!.ranges!);
  let message: Uint8Array;
  if (opts.id || opts.timestamp) {
    const digest1 = new Uint8Array(await subtle.digest(hash, rangeMsg as BufferSource));
    let prepend = '';
    if (opts.timestamp) prepend += `${opts.timestamp}:`;
    if (opts.id) prepend += `${opts.id}:`;
    message = concat(te.encode(prepend), digest1);
  } else {
    message = rangeMsg;
  }

  let sigBytes: Uint8Array;
  if (keyAlg === 'ec') {
    const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash }, priv, message as BufferSource));
    sigBytes = ecdsaRawToDer(raw); // SEAL stores EC signatures as ASN.1/DER
  } else {
    sigBytes = new Uint8Array(await subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, priv, message as BufferSource));
  }

  // Rebuild with the real signature. Message is invariant to the value slot.
  file = concat(prefix, mkRecord(b64(sigBytes)), suffix);
  const record = parseSealRecord(file)!;
  return { bytes: file, spki, domain, record };
}

// ─── the crypto round-trip (the real, independent-oracle proof) ───────────────

test('ECDSA P-256 basic: a genuine SEAL signature verifies', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec' });
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.found, true);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.domain, 'example.com');
  assert.equal(r.keyAlg, 'ec');
  assert.equal(r.digestAlg, 'SHA-256');
  assert.equal(r.coversWholeFile, true);
  assert.equal(r.keySource, 'dns');
});

test('RSA basic: a genuine SEAL signature verifies', async () => {
  const f = await buildSealedFile({ keyAlg: 'rsa' });
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.keyAlg, 'rsa');
  assert.equal(r.coversWholeFile, true);
});

test('ECDSA P-384 with sha384 verifies (curve + digest read from the key/record)', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec', curve: 'P-384', da: 'sha384' });
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.digestAlg, 'SHA-384');
});

test('extended chain: id + date double-digest verifies', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec', id: 'user123', timestamp: '20240326164401.50' });
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.signerId, 'user123');
  assert.equal(r.timestamp, '20240326164401.50');
});

test('extended chain: date-only (no id) double-digest verifies', async () => {
  const f = await buildSealedFile({ keyAlg: 'rsa', timestamp: '20240326164401' });
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.timestamp, '20240326164401');
});

test('inline pk= verifies fully offline (no resolver)', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec', inlinePk: true });
  const r = await verifySeal(f.bytes); // no resolveKey at all
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.keySource, 'inline');
});

// ─── tamper detection (integrity is what SEAL proves) ────────────────────────

test('tampering a covered byte invalidates the signature', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec' });
  f.bytes[10] = (f.bytes[10]! ^ 0xff) & 0xff; // inside the prefix — a covered byte
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.found, true);
  assert.equal(r.valid, false);
});

test('tampering a signed record attribute (domain text) invalidates it', async () => {
  const f = await buildSealedFile({ keyAlg: 'rsa' });
  // Flip one byte inside the record's d="example.com" (covered by [F~S]).
  const bin = Buffer.from(f.bytes).toString('latin1');
  const at = bin.indexOf('example.com');
  assert.ok(at > 0);
  f.bytes[at] = te.encode('X')[0]!;
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, false);
});

test('a wrong key fails to verify (no false positive)', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec' });
  const other = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const otherSpki = new Uint8Array(await subtle.exportKey('spki', (other as CryptoKeyPair).publicKey));
  const r = await verifySeal(f.bytes, () => otherSpki);
  assert.equal(r.valid, false);
});

// ─── absence + honesty (never render "clean") ────────────────────────────────

test('a file with no SEAL record returns found:false', async () => {
  const bytes = concat(te.encode('\x89PNG\r\n\x1a\n'), new Uint8Array(200).fill(7));
  const r = await verifySeal(bytes, () => new Uint8Array(0));
  assert.equal(r.found, false);
  assert.equal(r.valid, false);
  assert.equal(r.recordCount, 0);
});

test('found but no key published → found:true, valid:false, honest reason', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec' });
  const r = await verifySeal(f.bytes, () => null); // resolver finds nothing
  assert.equal(r.found, true);
  assert.equal(r.valid, false);
  assert.match(r.reason, /no public key/i);
});

test('da=sha224 is refused (WebCrypto has no SHA-224)', async () => {
  // Hand-built record — cannot be WebCrypto-signed with SHA-224, and shouldn't be.
  const rec = te.encode('<seal seal="1" ka="rsa" da="sha224" d="example.com" s="AAAA"/>');
  const bytes = concat(te.encode('data'), rec, te.encode('tail'));
  const r = await verifySeal(bytes, () => new Uint8Array(100));
  assert.equal(r.found, true);
  assert.equal(r.valid, false);
  assert.match(r.reason, /sha-?224/i);
});

test('an unsupported key algorithm (ed25519) is reported, not crashed', async () => {
  const rec = te.encode('<seal seal="1" ka="ed25519" da="sha256" d="example.com" s="AAAA"/>');
  const bytes = concat(te.encode('data'), rec, te.encode('tail'));
  const r = await verifySeal(bytes, () => new Uint8Array(100));
  assert.equal(r.found, true);
  assert.equal(r.valid, false);
  assert.match(r.reason, /unsupported key algorithm|ed25519/i);
});

// ─── parseSealRecord unit tests ──────────────────────────────────────────────

test('parseSealRecord reads fields and the exact signature-value offsets', () => {
  const prefix = te.encode('HELLO-PREFIX-');
  const value = 'QUJDRA=='; // arbitrary base64
  const rec = te.encode(`<seal seal="1" ka="ec" da="sha512" d="lolly.tools" uid="u7" kv="3" s="${value}"/>`);
  const suffix = te.encode('-TRAILER');
  const bytes = concat(prefix, rec, suffix);

  const parsed = parseSealRecord(bytes)!;
  assert.ok(parsed);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.domain, 'lolly.tools');
  assert.equal(parsed.keyAlg, 'ec');
  assert.equal(parsed.digestAlg, 'SHA-512');
  assert.equal(parsed.digestAlgRaw, 'sha512');
  assert.equal(parsed.uid, 'u7');
  assert.equal(parsed.keyVersion, '3');
  assert.equal(parsed.byteRangeSpec, 'F~S,s~f');
  // The offsets must bracket EXACTLY the base64 value bytes in the file.
  const slice = Buffer.from(bytes.subarray(parsed.sigValueStart, parsed.sigValueEnd)).toString('latin1');
  assert.equal(slice, value);
});

test('parseSealRecord applies documented defaults (da, uid, kv, sf, b)', () => {
  const bytes = te.encode('<seal seal="1" ka="rsa" d="x.com" s="AA"/>');
  const p = parseSealRecord(bytes)!;
  assert.equal(p.digestAlg, 'SHA-256');
  assert.equal(p.uid, '');
  assert.equal(p.keyVersion, '1');
  assert.equal(p.sigFormat, 'base64');
  assert.equal(p.byteRangeSpec, 'F~S,s~f');
  assert.equal(p.id, null);
});

test('parseSealRecord returns null when required fields are missing', () => {
  assert.equal(parseSealRecord(te.encode('<seal seal="1" ka="ec" s="AA"/>')), null); // no d=
  assert.equal(parseSealRecord(te.encode('nothing to see here, no record')), null);
});

test('parseSealRecords finds multiple records', () => {
  const bytes = te.encode(
    'aaa<seal seal="1" ka="ec" da="sha256" d="one.com" s="AAAA"/>bbb' +
    '<seal seal="1" ka="rsa" da="sha256" d="two.com" s="BBBB"/>ccc',
  );
  const all = parseSealRecords(bytes);
  assert.equal(all.length, 2);
  assert.equal(all[0]!.domain, 'one.com');
  assert.equal(all[1]!.domain, 'two.com');
});

test('parseSealRecords handles the PI wrapper and entity-encoded values', () => {
  const pi = parseSealRecord(te.encode('<?seal seal="1" ka="ec" da="sha256" d="pi.com" s="AAAA"?>'))!;
  assert.equal(pi.domain, 'pi.com');
  const xmp = parseSealRecord(te.encode('&lt;seal seal=&quot;1&quot; ka=&quot;rsa&quot; da=&quot;sha256&quot; d=&quot;xmp.com&quot; s=&quot;AAAA&quot;/&gt;'))!;
  assert.equal(xmp.domain, 'xmp.com');
});

test('parseSealRecords never throws on hostile / truncated input', () => {
  const nasty = [
    te.encode('<seal '),
    te.encode('<seal seal="1"'),
    new Uint8Array(300).fill(0x3c), // "<<<<<..."
    concat(te.encode('<seal seal="1" ka="ec" d="a" s="'), new Uint8Array(50).fill(0x22)),
  ];
  for (const n of nasty) assert.doesNotThrow(() => parseSealRecords(n));
});

// ─── computeSealDigest / assembleSealMessage / resolveRanges units ───────────

test('resolveRanges resolves markers, offsets, and the default', () => {
  const ctx = { F: 0, f: 100, S: 40, s: 60, P: -1, p: -1 };
  assert.deepEqual(resolveRanges('F~S,s~f', ctx), [{ start: 0, stop: 40 }, { start: 60, stop: 100 }]);
  assert.deepEqual(resolveRanges('F~S,s+4~f', ctx), [{ start: 0, stop: 40 }, { start: 64, stop: 100 }]);
  assert.deepEqual(resolveRanges('F+4~S', ctx), [{ start: 4, stop: 40 }]);
});

test('resolveRanges rejects out-of-bounds and unresolved markers', () => {
  const ctx = { F: 0, f: 100, S: 40, s: 60, P: -1, p: -1 };
  assert.throws(() => resolveRanges('F~200', ctx), /out of bounds/);
  assert.throws(() => resolveRanges('s~S', ctx), /out of bounds/); // stop < start
  assert.throws(() => resolveRanges('P~p', ctx), /unresolved marker/); // no previous sig
});

test('assembleSealMessage concatenates the covered ranges exactly', () => {
  const bytes = Uint8Array.from({ length: 20 }, (_, i) => i);
  const msg = assembleSealMessage(bytes, [{ start: 0, stop: 4 }, { start: 10, stop: 14 }]);
  assert.deepEqual([...msg], [0, 1, 2, 3, 10, 11, 12, 13]);
});

test('computeSealDigest equals SHA of the assembled ranges (independent check)', async () => {
  const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff);
  const ranges = [{ start: 0, stop: 20 }, { start: 40, stop: 64 }];
  const got = await computeSealDigest(bytes, ranges, 'SHA-256');
  const manual = new Uint8Array(await subtle.digest('SHA-256', assembleSealMessage(bytes, ranges) as BufferSource));
  assert.deepEqual([...got], [...manual]);
});

// ─── verifySealSignature (the primitive, against an oracle signature) ────────

test('verifySealSignature validates a raw WebCrypto ECDSA signature (DER in, converted)', async () => {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const message = te.encode('the exact bytes WebCrypto hashes');
  const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, message as BufferSource));
  const der = ecdsaRawToDer(raw);
  const key = await importSealKey(spki, 'ec', 'SHA-256');
  assert.equal(await verifySealSignature(message, der, key, 'ec', 'SHA-256'), true);
  // Tamper the message → must fail.
  const bad = te.encode('the exact bytes WebCrypto hashed?');
  assert.equal(await verifySealSignature(bad, der, key, 'ec', 'SHA-256'), false);
});

test('verifySealSignature validates a WebCrypto RSA PKCS#1 v1.5 signature', async () => {
  const pair = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const message = te.encode('rsa message');
  const sig = new Uint8Array(await subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, pair.privateKey, message as BufferSource));
  const key = await importSealKey(spki, 'rsa', 'SHA-256');
  assert.equal(await verifySealSignature(message, sig, key, 'rsa', 'SHA-256'), true);
});

// ─── coversWholeFile honesty ─────────────────────────────────────────────────

test('a partial byte range verifies but is flagged as NOT whole-file coverage', async () => {
  const f = await buildSealedFile({ keyAlg: 'ec', b: 'F~S' }); // only the prefix + record head
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.coversWholeFile, false);
});

test('PNG-style trailing-checksum range (s+4~f) still counts as whole-file coverage', async () => {
  // Sign over F~S,s+4~f: the 4 bytes right after the value are also skipped, but
  // the signature still protects the whole file save the value + its checksum.
  const f = await buildSealedFile({ keyAlg: 'ec', b: 'F~S,s+4~f' });
  const r = await verifySeal(f.bytes, () => f.spki);
  assert.equal(r.valid, true, r.reason);
  assert.equal(r.coversWholeFile, true);
});
