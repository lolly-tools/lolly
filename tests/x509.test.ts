/**
 * x509.js contract tests: PEM codec, CA root generation, leaf issuance
 * (the c2pa-rs-compatible profile) and the external-signer embed path.
 * Run with: node --test tests/x509.test.ts
 *
 * The issued leaf is checked independently of the writer: a tiny in-file DER
 * walker pulls tbsCertificate + signatureValue out of the cert, the DER
 * ECDSA-Sig-Value is converted back to raw r||s, and WebCrypto verifies it
 * against the ROOT's public key — closing the chain-of-trust loop without
 * trusting any x509.js reader.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pemToDer, derToPem, generateCaRoot, issueLeafCert } from '../engine/src/x509.ts';
import { embedC2paInPdf, generateSigner } from '../engine/src/c2pa.ts';
import { parseCertificate, verifyC2pa } from '../engine/src/c2pa-verify.ts';

const te = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const bytesOf = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function concat(parts: Uint8Array[]) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ─── independent DER walker ───────────────────────────────────────────────────

interface Tlv { tag: number; start: number; contentStart: number; end: number; }

function derTlv(b: Uint8Array, i: number): Tlv {
  const tag = b[i]!;
  let len = b[i + 1]!;
  let j = i + 2;
  if (len & 0x80) {
    const k = len & 0x7f;
    len = 0;
    for (let x = 0; x < k; x++) len = len * 256 + b[j++]!;
  }
  return { tag, start: i, contentStart: j, end: j + len };
}

function derChildren(b: Uint8Array, tlv: Tlv): Tlv[] {
  const kids: Tlv[] = [];
  let i = tlv.contentStart;
  while (i < tlv.end) {
    const c = derTlv(b, i);
    kids.push(c);
    i = c.end;
  }
  assert.equal(i, tlv.end, 'DER children tile the container');
  return kids;
}

// Certificate = SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }.
// tbsCertificate children: [0] version, serial, sigAlg, issuer, validity,
// subject, SPKI, [3] extensions.
function certFields(cert: Uint8Array) {
  const top = derTlv(cert, 0);
  assert.equal(top.tag, 0x30);
  assert.equal(top.end, cert.length, 'certificate is a single SEQUENCE');
  const [tbs, sigAlg, sigVal] = derChildren(cert, top);
  const kids = derChildren(cert, tbs!);
  const shift = kids[0]!.tag === 0xa0 ? 1 : 0;
  const at = (n: number) => cert.slice(kids[shift + n]!.start, kids[shift + n]!.end);
  return { tbs: tbs!, sigAlg: sigAlg!, sigVal: sigVal!, issuerBytes: at(2), subjectBytes: at(4), spkiBytes: at(5) };
}

// signatureValue BIT STRING → DER ECDSA-Sig-Value → raw 64-byte r||s
// (strip INTEGER 0x00 pads, left-pad r/s to 32; skip the unused-bits byte).
function certSigToRaw(cert: Uint8Array, sigVal: Tlv) {
  assert.equal(sigVal.tag, 0x03, 'signatureValue is a BIT STRING');
  assert.equal(cert[sigVal.contentStart], 0, '0 unused bits');
  const seq = derTlv(cert, sigVal.contentStart + 1);
  assert.equal(seq.tag, 0x30, 'ECDSA-Sig-Value is a SEQUENCE');
  const halves = derChildren(cert, seq).map((tlv) => {
    assert.equal(tlv.tag, 0x02);
    let i = tlv.contentStart;
    while (i < tlv.end - 1 && cert[i] === 0) i++;
    const v = cert.slice(i, tlv.end);
    assert.ok(v.length <= 32, 'INTEGER fits P-256');
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  });
  assert.equal(halves.length, 2);
  return concat(halves);
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

// Minimal classic-xref PDF (catalog + pages + page) with correct offsets.
function buildTestPdf() {
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  const push = (s: string) => { offsets.push(out.length); out += s; };
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return bytesOf(out);
}

type CaRoot = Awaited<ReturnType<typeof generateCaRoot>>;

async function deviceKeyAndLeaf(root: CaRoot, extra: Partial<Parameters<typeof issueLeafCert>[0]> = {}) {
  const device = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  const spkiDer = new Uint8Array(await crypto.subtle.exportKey('spki', device.publicKey));
  const leaf = await issueLeafCert({
    caCertDer: root.certDer, caPrivateKey: root.pkcs8Der, spkiDer,
    email: 'andy@example.com', ...extra,
  });
  return { device, spkiDer, leaf };
}

const DAY = 24 * 3600 * 1000;

// ─── PEM ──────────────────────────────────────────────────────────────────────

test('PEM round-trips DER bytes with the right armour', () => {
  const der = crypto.getRandomValues(new Uint8Array(217)); // not a 48/64 multiple on purpose
  const pem = derToPem(der, 'CERTIFICATE');
  assert.ok(pem.startsWith('-----BEGIN CERTIFICATE-----\n'));
  assert.ok(pem.endsWith('-----END CERTIFICATE-----\n'));
  for (const line of pem.trim().split('\n').slice(1, -1)) {
    assert.ok(line.length <= 64 && /^[A-Za-z0-9+/=]+$/.test(line), `body line is base64, ≤64 chars: ${line}`);
  }
  assert.equal(hex(pemToDer(pem)), hex(der));
  // whitespace/label variations still decode
  assert.equal(hex(pemToDer(pem.replace(/\n/g, '\r\n'))), hex(der));
  assert.equal(hex(pemToDer(derToPem(der, 'PRIVATE KEY'))), hex(der));
  assert.throws(() => pemToDer('-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n'), /no PEM body/);
});

// ─── CA root ──────────────────────────────────────────────────────────────────

test('generateCaRoot: self-signed CA:TRUE root with subject, validity and usable key', async () => {
  const { certDer, pkcs8Der } = await generateCaRoot({ commonName: 'Test Root', organization: 'TestOrg', days: 30 });
  const cert = parseCertificate(certDer);
  assert.equal(cert.subject.commonName, 'Test Root');
  assert.equal(cert.subject.organization, 'TestOrg');
  assert.equal(cert.issuer.commonName, 'Test Root');
  assert.equal(cert.selfSigned, true);
  // validity: now − 60 s → +30 days (derTime truncates to whole seconds)
  assert.ok(Math.abs(cert.notBefore.getTime() - (Date.now() - 60_000)) < 5_000, 'notBefore ≈ now − 60 s');
  assert.ok(Math.abs(cert.notAfter.getTime() - cert.notBefore.getTime() - 30 * DAY) < 2_000, 'lifetime ≈ 30 days');
  // CA profile extensions, byte-exact: basicConstraints CA:TRUE critical,
  // keyUsage keyCertSign|cRLSign critical (bits 5+6 → 0x06, 1 unused bit)
  assert.ok(hex(certDer).includes('0603551d130101ff040530030101ff'), 'basicConstraints CA:TRUE, critical');
  assert.ok(hex(certDer).includes('0603551d0f0101ff040403020106'), 'keyUsage keyCertSign+cRLSign, critical');
  assert.ok(hex(certDer).includes('0603551d0e'), 'subjectKeyIdentifier present');
  // the root's own signature verifies with its own SPKI (self-signed)
  const f = certFields(certDer);
  const key = await crypto.subtle.importKey('spki', f.spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, certSigToRaw(certDer, f.sigVal), certDer.slice(f.tbs.start, f.tbs.end)),
    true, 'root signature verifies against its own key',
  );
  // the PKCS#8 key imports and signs
  const priv = await crypto.subtle.importKey('pkcs8', pkcs8Der as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  assert.equal(priv.type, 'private');
});

test('generateCaRoot defaults: Lolly CA / Lolly, ~10-year lifetime', async () => {
  const { certDer } = await generateCaRoot();
  const cert = parseCertificate(certDer);
  assert.equal(cert.subject.commonName, 'Lolly CA');
  assert.equal(cert.subject.organization, 'Lolly');
  assert.ok(Math.abs(cert.notAfter.getTime() - cert.notBefore.getTime() - 3650 * DAY) < 2_000);
});

// ─── leaf issuance ────────────────────────────────────────────────────────────

test('issueLeafCert: leaf parses, chains to the root, carries the c2pa-rs profile', async () => {
  const root = await generateCaRoot({ commonName: 'Lolly Root Test', organization: 'Lolly' });
  const { leaf, spkiDer } = await deviceKeyAndLeaf(root);
  const cert = parseCertificate(leaf);
  assert.equal(cert.subject.commonName, 'andy@example.com', 'CN defaults to the email');
  assert.equal(cert.subject.organization, 'Lolly');
  assert.equal(cert.issuer.commonName, 'Lolly Root Test');
  assert.equal(cert.selfSigned, false);
  assert.ok(Math.abs(cert.notAfter.getTime() - cert.notBefore.getTime() - 7 * DAY) < 2_000, 'default 7-day lifetime');

  const rf = certFields(root.certDer);
  const lf = certFields(leaf);
  // issuer Name bytes are the root's subject bytes VERBATIM — the byte-exact
  // comparison chain verification relies on
  assert.equal(hex(lf.issuerBytes), hex(rf.subjectBytes));
  // the leaf carries the device SPKI verbatim
  assert.equal(hex(lf.spkiBytes), hex(spkiDer));
  // leaf signature verifies with the ROOT's public key
  const rootKey = await crypto.subtle.importKey('spki', rf.spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, rootKey, certSigToRaw(leaf, lf.sigVal), leaf.slice(lf.tbs.start, lf.tbs.end)),
    true, 'leaf tbsCertificate is signed by the root key',
  );
  // ... and NOT with its own key (it is not self-signed)
  const leafKey = await crypto.subtle.importKey('spki', lf.spkiBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, leafKey, certSigToRaw(leaf, lf.sigVal), leaf.slice(lf.tbs.start, lf.tbs.end)),
    false,
  );

  const leafHex = hex(leaf);
  // c2pa-rs leaf profile: keyUsage digitalSignature critical + EKU emailProtection
  assert.ok(leafHex.includes('0603551d0f0101ff040403020780'), 'keyUsage digitalSignature, critical');
  assert.ok(leafHex.includes('0603551d25040c300a06082b06010505070304'), 'EKU emailProtection');
  assert.ok(leafHex.includes('0603551d0e'), 'SKI present');
  // AKI [0] keyid = SHA-1 of the ROOT's public key point
  const spkiTop = derTlv(rf.spkiBytes, 0);
  const [, bits] = derChildren(rf.spkiBytes, spkiTop);
  const rootKeyId = new Uint8Array(await crypto.subtle.digest('SHA-1', rf.spkiBytes.slice(bits!.contentStart + 1, bits!.end)));
  assert.ok(leafHex.includes('8014' + hex(rootKeyId)), 'AKI keyid = SHA-1 of the root key point');
  // SAN rfc822Name: [1] IMPLICIT IA5String (tag 0x81, primitive) = the email
  const san = concat([Uint8Array.of(0x81, 'andy@example.com'.length), te.encode('andy@example.com')]);
  assert.ok(leafHex.includes(hex(san)), 'SAN rfc822Name carries the email');
  assert.ok(leafHex.includes('0603551d11'), 'subjectAltName OID present');
});

test('issueLeafCert: notBefore/notAfter override days; CryptoKey CA key accepted', async () => {
  const root = await generateCaRoot({});
  const caKey = await crypto.subtle.importKey('pkcs8', root.pkcs8Der as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const device = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  const spkiDer = new Uint8Array(await crypto.subtle.exportKey('spki', device.publicKey));
  const leaf = await issueLeafCert({
    caCertDer: root.certDer, caPrivateKey: caKey, spkiDer,
    email: 'old@example.com', commonName: 'Old Cert', organization: 'Acme',
    notBefore: '2020-01-01T00:00:00Z', notAfter: '2020-01-08T00:00:00Z',
  });
  const cert = parseCertificate(leaf);
  assert.equal(cert.subject.commonName, 'Old Cert');
  assert.equal(cert.subject.organization, 'Acme');
  assert.equal(cert.notBefore.toISOString(), '2020-01-01T00:00:00.000Z');
  assert.equal(cert.notAfter.toISOString(), '2020-01-08T00:00:00.000Z');
});

// ─── external signer through the embedder ─────────────────────────────────────

test('embedC2paInPdf with a CA-issued external signer produces a valid credential', async () => {
  const root = await generateCaRoot({});
  const { device, leaf } = await deviceKeyAndLeaf(root);
  const pdf = buildTestPdf();
  const out = await embedC2paInPdf(pdf, {
    title: 'CA Signed', claimGenerator: 'LollyTest/1.0',
    signer: { privateKey: device.privateKey, certDer: leaf, chain: [leaf, root.certDer] },
  });
  // the two-pass layout survives a 2-cert chain: zero-option verify is green
  const report = await verifyC2pa(out);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks, null, 2));
  assert.equal(report.signer!.commonName, 'andy@example.com');
  assert.equal(report.signer!.organization, 'Lolly');
  assert.equal(report.signer!.selfSigned, false);
  assert.equal(report.signer!.alg, 'ES256');
});

test('embedC2paInPdf with a sign() callback signer (no CryptoKey handed over)', async () => {
  const root = await generateCaRoot({});
  const { device, leaf } = await deviceKeyAndLeaf(root);
  let calls = 0;
  const signer = {
    sign: async (bytes: Uint8Array) => {
      calls++;
      return new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, device.privateKey, bytes as BufferSource));
    },
    certDer: leaf,
    chain: [leaf, root.certDer],
  };
  const out = await embedC2paInPdf(buildTestPdf(), { title: 'Callback Signed', claimGenerator: 'LollyTest/1.0', signer });
  assert.ok(calls >= 2, 'sign() ran once per build pass');
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks, null, 2));
});

test('a sign() that returns the wrong length fails loud, not with corrupt output', async () => {
  const { certDer } = await generateSigner();
  await assert.rejects(
    embedC2paInPdf(buildTestPdf(), {
      title: 'x', claimGenerator: 'y',
      signer: { sign: async () => new Uint8Array(70), certDer },
    }),
    /64-byte/,
  );
});
