/**
 * Trust-anchor verification contract tests — the identity path of
 * verifyC2pa(bytes, { trustAnchors }). Run with:
 *   node --test tests/c2pa-trust.test.ts
 *
 * The fixture chain is real: generateCaRoot mints a root, issueLeafCert binds
 * a non-extractable device key to an email, embedC2paInPdf signs with the
 * external signer, and the verifier must upgrade signingCredential.untrusted
 * to signingCredential.trusted ONLY when the pinned anchor actually issued
 * the chain. The zero-options path is pinned as a regression (byte-identical
 * report semantics), and the intermediate path is pinned in both directions:
 * a hand-built CA:TRUE intermediate verifies, while an issued leaf reused as
 * an "intermediate" (basicConstraints absent = CA:false) must NOT — otherwise
 * any credential holder could vouch for a forged identity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateCaRoot, issueLeafCert,
  der, derSeq, derSet, derOctet, derUint, derOid, derTime, ecdsaRawToDer,
} from '../engine/src/x509.ts';
import { embedC2paInPdf } from '../engine/src/c2pa.ts';
import { verifyC2pa, parseCertificate, signedBy } from '../engine/src/c2pa-verify.ts';
import { c2paTrustAnchors } from '../engine/src/c2pa-trust.ts';

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const binOf = (bytes: Uint8Array): string => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

// Minimal classic-xref PDF (catalog + pages + page) with correct offsets.
function buildTestPdf(): Uint8Array {
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  const push = (s: string): void => { offsets.push(out.length); out += s; };
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return bytesOf(out);
}

const check = (report: any, code: string): any => report.checks.find((c: any) => c.code === code);

// ─── fixtures: root → leaf → stamped PDF ──────────────────────────────────────

const root = await generateCaRoot({ commonName: 'Lolly Test Root', organization: 'Lolly', days: 3650 });

// Device key exactly as the web shell would hold it: non-extractable private
// key (the public half is always exportable — that's all issuance needs).
const device = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const deviceSpki = new Uint8Array(await subtle.exportKey('spki', device.publicKey));

const leafDer = await issueLeafCert({
  caCertDer: root.certDer,
  caPrivateKey: root.pkcs8Der,
  spkiDer: deviceSpki,
  email: 'test@example.com',
  days: 30,
});

const stamped = await embedC2paInPdf(buildTestPdf(), {
  title: 'Trust Fixture',
  claimGenerator: 'LollyTest/1.0',
  signer: { privateKey: device.privateKey, certDer: leafDer, chain: [leafDer, root.certDer] },
});

test('pinned anchor: chain verifies → trusted, identity email, no untrusted row', async () => {
  const report: any = await verifyC2pa(stamped, { trustAnchors: [root.certDer] });
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, true);
  const trusted = check(report, 'signingCredential.trusted');
  assert.ok(trusted, 'trusted row present');
  assert.equal(trusted.ok, true);
  assert.match(trusted.explanation, /verified identity: test@example\.com/);
  assert.equal(check(report, 'signingCredential.untrusted'), undefined, 'untrusted row replaced');
  assert.equal(report.signer.identity.email, 'test@example.com');
  assert.equal(report.signer.identity.issuer, 'Lolly Test Root');
  assert.equal(report.signer.selfSigned, false);
});

test('no options: zero-options path unchanged — untrusted info row, valid state', async () => {
  const report: any = await verifyC2pa(stamped);
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, false);
  const untrusted = check(report, 'signingCredential.untrusted');
  assert.ok(untrusted, 'untrusted row present');
  assert.equal(untrusted.ok, false);
  assert.match(untrusted.explanation, /ephemeral on-device key/);
  assert.equal(check(report, 'signingCredential.trusted'), undefined);
  assert.equal(report.signer.identity, undefined);
});

test('wrong anchor: an unrelated root pins nothing → untrusted as before', async () => {
  const stranger = await generateCaRoot({ commonName: 'Stranger Root', organization: 'Elsewhere' });
  const report: any = await verifyC2pa(stamped, { trustAnchors: [stranger.certDer] });
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, false);
  assert.ok(check(report, 'signingCredential.untrusted'));
  assert.equal(check(report, 'signingCredential.trusted'), undefined);
  assert.equal(report.signer.identity, undefined);
});

test('expired leaf: anchored identity surfaced, but trusted stays false', async () => {
  const expiredLeaf = await issueLeafCert({
    caCertDer: root.certDer,
    caPrivateKey: root.pkcs8Der,
    spkiDer: deviceSpki,
    email: 'test@example.com',
    notBefore: '2020-01-01T00:00:00Z',
    notAfter: '2020-02-01T00:00:00Z',
  });
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Expired Fixture',
    claimGenerator: 'LollyTest/1.0',
    signer: { privateKey: device.privateKey, certDer: expiredLeaf, chain: [expiredLeaf, root.certDer] },
  });
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(report.trusted, false, 'no TSA: an expired cert cannot prove signing time');
  assert.equal(report.signer.identity.email, 'test@example.com', 'identity WAS CA-verified — still surfaced');
  assert.equal(check(report, 'signingCredential.expired').ok, false);
  const trusted = check(report, 'signingCredential.trusted');
  assert.equal(trusted.ok, true);
  assert.match(trusted.explanation, /has since expired; signing time cannot be proven/);
  assert.equal(check(report, 'signingCredential.untrusted'), undefined);
  assert.equal(report.state, 'invalid', 'the expired fail counts against integrity, as today');
});

test('tamper outside the manifest → invalid regardless of anchors', async () => {
  const pdf = stamped.slice();
  const i = binOf(pdf).indexOf('MediaBox') + 1;
  pdf[i] = pdf[i]! ^ 0x01;
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(report.state, 'invalid');
  assert.equal(check(report, 'assertion.dataHash.mismatch').ok, false);
});

// ─── public-leaf replay (the forgery the whole scheme must stop) ────────────────
// A victim's leaf certificate is PUBLIC — it ships in the x5chain of every file
// they credential. An attacker who has only that public cert (never the victim's
// non-extractable key) must not be able to produce a "trusted — signed by victim"
// verdict. Two variants: forge a fresh claim signed with the attacker's own key,
// or lift the victim's genuine signature onto tampered bytes.

test('public-leaf replay: attacker signs with their OWN key but embeds the victim leaf → NOT trusted, NO identity', async () => {
  // The attacker owns a different key; they paste the victim's public leafDer as
  // the x5chain cert. They cannot sign under the victim's key, so the COSE claim
  // signature is made with the attacker key — it will not verify against the leaf.
  const attacker = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const forged = await embedC2paInPdf(buildTestPdf(), {
    title: 'Forged', claimGenerator: 'Attacker/1.0',
    signer: { privateKey: attacker.privateKey, certDer: leafDer, chain: [leafDer, root.certDer] },
  });
  const report: any = await verifyC2pa(forged, { trustAnchors: [root.certDer] });
  assert.equal(report.trusted, false, 'a signature not made by the leaf key must never be trusted');
  assert.equal(report.signer?.identity, undefined, 'no verified identity surfaced from a public-cert replay');
  assert.equal(check(report, 'claimSignature.mismatch')?.ok, false, 'the claim signature fails to verify');
  assert.equal(check(report, 'signingCredential.trusted'), undefined, 'no trusted row');
  assert.equal(report.state, 'invalid');
});

test('lifted signature: victim genuine credential, bytes tampered → NOT trusted, NO identity', async () => {
  // The victim's own valid file, with content changed after signing. The claim
  // signature still verifies (the signed claim is untouched) but the hard binding
  // no longer matches — trust must be withheld, not granted on the intact sig.
  const pdf = stamped.slice();
  const i = binOf(pdf).indexOf('MediaBox') + 1;
  pdf[i] = pdf[i]! ^ 0x01; // change bytes outside the manifest
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(check(report, 'assertion.dataHash.mismatch')?.ok, false, 'binding broke');
  assert.equal(report.trusted, false, 'a valid signature over stale content is not trust for this content');
  assert.equal(report.signer?.identity, undefined, 'no verified identity on a broken binding');
  assert.equal(report.state, 'invalid');
});

// ─── intermediate chain ───────────────────────────────────────────────────────
// issueLeafCert can only mint end-entity (CA:false) certs, so the CA:TRUE
// intermediate is hand-built from the exported DER writers and signed by the
// root — the exact shape a future generateCaIntermediate would emit.

async function buildIntermediate(commonName: string): Promise<{ certDer: Uint8Array; privateKey: CryptoKey }> {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const name = derSeq(
    derSet(derSeq(derOid('2.5.4.10'), der(0x0c, te.encode('Lolly')))), // organizationName
    derSet(derSeq(derOid('2.5.4.3'), der(0x0c, te.encode(commonName)))), // commonName
  );
  const extensions = derSeq(
    derSeq(derOid('2.5.29.19'), der(0x01, Uint8Array.of(0xff)), derOctet(derSeq(der(0x01, Uint8Array.of(0xff))))), // basicConstraints: CA:TRUE, critical
    derSeq(derOid('2.5.29.15'), der(0x01, Uint8Array.of(0xff)), derOctet(der(0x03, Uint8Array.of(1, 0x06)))), // keyUsage: keyCertSign | cRLSign, critical
  );
  const tbs = derSeq(
    der(0xa0, derUint(Uint8Array.of(2))), // [0] version: v3
    derUint(Uint8Array.of(0x42)),
    derSeq(derOid('1.2.840.10045.4.3.2')), // ecdsa-with-SHA256
    parseCertificate(root.certDer).subjectBytes, // issuer = root subject, verbatim
    derSeq(derTime(new Date(Date.now() - 60_000)), derTime(new Date(Date.now() + 30 * 864e5))),
    name,
    spki,
    der(0xa3, extensions),
  );
  const rootKey = await subtle.importKey('pkcs8', root.pkcs8Der as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, rootKey, tbs as BufferSource));
  const certDer = derSeq(tbs, derSeq(derOid('1.2.840.10045.4.3.2')), der(0x03, Uint8Array.of(0), ecdsaRawToDer(raw)));
  return { certDer, privateKey: pair.privateKey };
}

test('one intermediate: leaf ← CA:TRUE intermediate ← anchored root → trusted', async () => {
  const mid = await buildIntermediate('Lolly Test Intermediate');
  const dev2 = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const leaf2 = await issueLeafCert({
    caCertDer: mid.certDer,
    caPrivateKey: mid.privateKey,
    spkiDer: new Uint8Array(await subtle.exportKey('spki', dev2.publicKey)),
    email: 'via-mid@example.com',
    days: 30,
  });
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Intermediate Fixture',
    claimGenerator: 'LollyTest/1.0',
    signer: { privateKey: dev2.privateKey, certDer: leaf2, chain: [leaf2, mid.certDer, root.certDer] },
  });
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, true);
  assert.equal(report.signer.identity.email, 'via-mid@example.com');
  assert.match(check(report, 'signingCredential.trusted').explanation, /via-mid@example\.com/);
});

test('forged intermediate: an issued LEAF cannot vouch for another identity', async () => {
  // The holder of a perfectly valid leaf tries to act as a CA: they "issue" a
  // cert claiming someone else's email, signed with their own device key, and
  // present [fake, their-leaf, root]. basicConstraints on the leaf is absent
  // (CA:false), so the chain must be rejected — not crash, just untrusted.
  const attacker = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const fake = await issueLeafCert({
    caCertDer: leafDer, // the legitimate leaf as "issuer"
    caPrivateKey: device.privateKey, // its actual key — signatures WILL verify
    spkiDer: new Uint8Array(await subtle.exportKey('spki', attacker.publicKey)),
    email: 'victim@example.com',
    days: 30,
  });
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Forgery Fixture',
    claimGenerator: 'LollyTest/1.0',
    signer: { privateKey: attacker.privateKey, certDer: fake, chain: [fake, leafDer, root.certDer] },
  });
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(report.trusted, false);
  assert.equal(report.signer.identity, undefined);
  assert.ok(check(report, 'signingCredential.untrusted'));
  assert.equal(check(report, 'signingCredential.trusted'), undefined);
});

test('hostile chain garbage never crashes verification', async () => {
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Garbage Chain Fixture',
    claimGenerator: 'LollyTest/1.0',
    signer: {
      privateKey: device.privateKey,
      certDer: leafDer,
      chain: [leafDer, bytesOf('not a certificate at all')],
    },
  });
  // A junk anchor is quietly skipped; the unrelated (but well-formed) root
  // fails the direct step and then hits the garbage chain[1], whose parse
  // failure must degrade to no-match — before the real anchor finally wins.
  const stranger = await generateCaRoot({ commonName: 'Unrelated Root' });
  const report: any = await verifyC2pa(pdf, { trustAnchors: [bytesOf('junk anchor'), stranger.certDer, root.certDer] });
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, true);
  assert.equal(report.signer.identity.email, 'test@example.com');
});

// Guards the vendored C2PA trust list (engine/src/c2pa-trust.ts): it must parse
// cleanly and carry the Google C2PA root Gemini chains to — the anchor that
// makes real "Nano Banana" images read as trusted rather than merely valid.
test('vendored c2paTrustAnchors() union both lists and dedup', async () => {
  const anchors = c2paTrustAnchors();
  assert.ok(anchors.length >= 45, `expected the unioned trust list, got ${anchors.length}`);
  const names = anchors.map((der) => { try { const c = parseCertificate(der); return c.subject.commonName || c.subject.organization; } catch { return null; } });
  assert.ok(names.includes('Google C2PA Root CA G3'), 'Gemini root anchor present');
  // A representative from the FROZEN CAI list (would be dropped by official-only)…
  assert.ok(names.includes('Adobe Root CA G2'), 'frozen-CAI Adobe root present');
  // …and one only on the OFFICIAL conformance list.
  assert.ok(names.some((n) => /DigiCert.*C2PA/i.test(n || '')), 'official-list DigiCert-for-C2PA root present');
  // Every entry is a parseable certificate (no corrupt PEM block survived).
  assert.equal(names.filter((c) => c === null).length, 0, 'all anchors parse');
  // Deduped: no two anchors share a DER fingerprint.
  const fps = anchors.map((d) => Array.from(d).join(','));
  assert.equal(new Set(fps).size, fps.length, 'no duplicate anchors');
});

// The guardrail: a cert may CLAIM any organisation in its subject, but a name is
// never proof. An attacker signs a fully valid credential (real COSE signature,
// intact hard binding) with their OWN key under a self-made root that claims
// O="OpenAI" — and verifies it against the REAL vendored anchors. It must read
// intact-but-UNTRUSTED: no chain to a pinned anchor → no identity, no trust.
test('impersonation: a cert claiming O=OpenAI that chains to no pinned anchor is NEVER trusted', async () => {
  const spoofRoot = await generateCaRoot({ commonName: 'OpenAI', organization: 'OpenAI', days: 3650 });
  const dev = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const spoofLeaf = await issueLeafCert({
    caCertDer: spoofRoot.certDer,
    caPrivateKey: spoofRoot.pkcs8Der,
    spkiDer: new Uint8Array(await subtle.exportKey('spki', dev.publicKey)),
    email: 'contact@openai.com',
    commonName: 'OpenAI',
    organization: 'OpenAI',
    days: 30,
  });
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Totally Real OpenAI Image',
    claimGenerator: 'OpenAI/1.0',
    signer: { privateKey: dev.privateKey, certDer: spoofLeaf, chain: [spoofLeaf, spoofRoot.certDer] },
  });
  const report: any = await verifyC2pa(pdf, { trustAnchors: c2paTrustAnchors() });
  assert.equal(report.state, 'valid', 'the bytes match what was signed — it IS intact');
  assert.equal(report.trusted, false, 'claiming O=OpenAI must not confer trust without a real chain');
  assert.equal(report.signer?.identity, undefined, 'no CA-verified identity for an unanchored signer');
  assert.ok(check(report, 'signingCredential.untrusted'), 'the untrusted marker is present');
});

// Real-data proof that chain-step verification spans every algorithm C2PA CAs
// use: a self-signed root signs its OWN tbsCertificate, so signedBy(root, root)
// must hold for each self-signed vendored anchor. Exercises ECDSA (Google,
// camera makers), RSA PKCS#1 v1.5 (Adobe, Microsoft, Truepic, Pinterest) and
// Ed25519 (Trufo) against genuine certificates — the RSA/Ed25519 paths have no
// other coverage (the round-trip fixtures are all ECDSA).
test('every self-signed trust anchor verifies its own signature (ECDSA + RSA + Ed25519)', async () => {
  const schemes = new Set<string>();
  let selfSigned = 0;
  for (const der of c2paTrustAnchors()) {
    let cert;
    try { cert = parseCertificate(der); } catch { continue; }
    if (!cert.selfSigned) continue;   // intermediates/timestamp CAs verify against their parent, not themselves
    selfSigned++;
    assert.equal(await signedBy(cert, cert), true,
      `self-signed anchor ${cert.subject.commonName || cert.subject.organization} did not verify its own signature`);
    if (cert.sigAlg) schemes.add(cert.sigAlg.scheme);
  }
  assert.ok(selfSigned >= 15, `expected many self-signed roots, got ${selfSigned}`);
  // The whole point: more than one algorithm family is actually verified.
  assert.ok(schemes.has('ecdsa'), 'an ECDSA root was verified');
  assert.ok(schemes.has('rsa'), 'an RSA (PKCS#1 v1.5) root was verified');
  assert.ok(schemes.has('ed25519'), 'the Ed25519 (Trufo) root was verified');
});

// A tampered anchor must NOT self-verify — flipping a tbsCertificate byte breaks
// the signature. Guards against a chain step that accepts anything.
test('a tampered self-signed anchor fails its own signature check', async () => {
  const der = c2paTrustAnchors().find((d) => { try { return parseCertificate(d).selfSigned; } catch { return false; } })!;
  const bent = der.slice();
  bent[40] = bent[40]! ^ 0xff;   // corrupt a tbsCertificate byte
  const cert = parseCertificate(bent);
  assert.equal(await signedBy(cert, cert), false, 'a corrupted anchor must not verify');
});

// Arbitrary-depth chains: leaf ← intermediate2 ← intermediate1 ← anchored root.
// Real Adobe/Microsoft/OpenAI chains carry more than one intermediate, so the
// walk must climb further than depth-1.
test('two intermediates: leaf ← CA:TRUE mid2 ← CA:TRUE mid1 ← anchored root → trusted', async () => {
  const rootKey = await subtle.importKey('pkcs8', root.pkcs8Der as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const caUnder = async (parentSubjectBytes: Uint8Array, parentKey: CryptoKey, cn: string, serial: number) => {
    const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
    const name = derSeq(
      derSet(derSeq(derOid('2.5.4.10'), der(0x0c, te.encode('Lolly')))),
      derSet(derSeq(derOid('2.5.4.3'), der(0x0c, te.encode(cn)))),
    );
    const extensions = derSeq(
      derSeq(derOid('2.5.29.19'), der(0x01, Uint8Array.of(0xff)), derOctet(derSeq(der(0x01, Uint8Array.of(0xff))))), // CA:TRUE
      derSeq(derOid('2.5.29.15'), der(0x01, Uint8Array.of(0xff)), derOctet(der(0x03, Uint8Array.of(1, 0x06)))),       // keyCertSign
    );
    const tbs = derSeq(
      der(0xa0, derUint(Uint8Array.of(2))),
      derUint(Uint8Array.of(serial)),
      derSeq(derOid('1.2.840.10045.4.3.2')),
      parentSubjectBytes,
      derSeq(derTime(new Date(Date.now() - 60_000)), derTime(new Date(Date.now() + 30 * 864e5))),
      name, spki, der(0xa3, extensions),
    );
    const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, parentKey, tbs as BufferSource));
    const certDer = derSeq(tbs, derSeq(derOid('1.2.840.10045.4.3.2')), der(0x03, Uint8Array.of(0), ecdsaRawToDer(raw)));
    return { certDer, privateKey: pair.privateKey, subjectBytes: parseCertificate(certDer).subjectBytes };
  };
  const mid1 = await caUnder(parseCertificate(root.certDer).subjectBytes, rootKey, 'Lolly Deep Intermediate 1', 0x51);
  const mid2 = await caUnder(mid1.subjectBytes, mid1.privateKey, 'Lolly Deep Intermediate 2', 0x52);
  const dev = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const leaf = await issueLeafCert({
    caCertDer: mid2.certDer,
    caPrivateKey: mid2.privateKey,
    spkiDer: new Uint8Array(await subtle.exportKey('spki', dev.publicKey)),
    email: 'deep@example.com',
    days: 30,
  });
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Deep Chain Fixture',
    claimGenerator: 'LollyTest/1.0',
    signer: { privateKey: dev.privateKey, certDer: leaf, chain: [leaf, mid2.certDer, mid1.certDer, root.certDer] },
  });
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, true, 'a leaf two intermediates below the anchor must still chain');
  assert.equal(report.signer.identity.email, 'deep@example.com');
});

// DoS regression: a hostile x5chain padded with a large pile of same-DN CA
// certs must neither hang (the walk is capped, not O(n²)) nor break a genuine
// chain buried in the pile. leaf ← mid ← anchored root, with 200 copies of the
// intermediate stuffed in between. Completing at all proves the bound.
test('padded x5chain (200 same-DN CA certs) stays bounded and still verifies the real chain', async () => {
  const mid = await buildIntermediate('Lolly Padded Intermediate');
  const dev = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const leaf = await issueLeafCert({
    caCertDer: mid.certDer,
    caPrivateKey: mid.privateKey,
    spkiDer: new Uint8Array(await subtle.exportKey('spki', dev.publicKey)),
    email: 'padded@example.com',
    days: 30,
  });
  const flood = Array.from({ length: 200 }, () => mid.certDer); // same DN + key, all CA:TRUE
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Padded Fixture',
    claimGenerator: 'LollyTest/1.0',
    signer: { privateKey: dev.privateKey, certDer: leaf, chain: [leaf, mid.certDer, ...flood, root.certDer] },
  });
  const report: any = await verifyC2pa(pdf, { trustAnchors: [root.certDer] });
  assert.equal(report.trusted, true, 'the genuine leaf←mid←root chain still verifies despite the flood');
});
