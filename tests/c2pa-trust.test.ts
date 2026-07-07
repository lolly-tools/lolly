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
import { verifyC2pa, parseCertificate } from '../engine/src/c2pa-verify.ts';

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
