/**
 * C2PA verdict-unification contract tests — engine/src/c2pa-verdict.ts, the
 * single source of truth for check codes, flags→verdict resolution, and
 * trust-anchor assembly. Run with: node --test tests/c2pa-verdict.test.ts
 *
 * Three layers:
 *  1. C2PA_CHECK drift guard — the values must equal the legacy literal
 *     strings BYTE-FOR-BYTE (the web /valid scorecard, saved JSON reports and
 *     the contract tests all string-match them).
 *  2. resolveVerdict over synthetic reports — every state/tone branch of the
 *     reference ladder (the web view's resolveState + stateTone semantics),
 *     including the defence-in-depth gates and the parts-is-a-flag-not-a-rung
 *     rule.
 *  3. The REAL writer→verifier round-trip (same fixtures as
 *     tests/c2pa-verify.test.ts / c2pa-trust.test.ts) so the constants and the
 *     report shape are exercised against reality, not just synthetic objects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  C2PA_CHECK, isExpiredOnly, resolveVerdict, defaultTrustAnchors,
  c2paTrustAnchors, LOLLY_CA_ROOT_PEM, pemToDer, derToPem,
  verifyC2pa, embedC2paInPdf, generateCaRoot, issueLeafCert,
} from '../engine/src/index.ts';
import type { C2paVerdictInput } from '../engine/src/index.ts';

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

// ─── 1. Check-code constants: the legacy strings, byte-for-byte ──────────────

test('C2PA_CHECK values equal the exact legacy check-code strings', () => {
  assert.deepEqual(C2PA_CHECK, {
    credentialUnreadable: 'credential.unreadable',
    assertionHashedUriMatch: 'assertion.hashedURI.match',
    assertionHashedUriMismatch: 'assertion.hashedURI.mismatch',
    assertionMissing: 'assertion.missing',
    claimSignatureValidated: 'claimSignature.validated',
    claimSignatureMismatch: 'claimSignature.mismatch',
    claimSignatureInsideValidity: 'claimSignature.insideValidity',
    signingCredentialExpired: 'signingCredential.expired',
    signingCredentialTrusted: 'signingCredential.trusted',
    signingCredentialUntrusted: 'signingCredential.untrusted',
    assertionDataHashMatch: 'assertion.dataHash.match',
    assertionDataHashMismatch: 'assertion.dataHash.mismatch',
    assertionBmffHashMatch: 'assertion.bmffHash.match',
    assertionBmffHashMismatch: 'assertion.bmffHash.mismatch',
  });
});

// ─── 2. resolveVerdict over synthetic reports — every branch ─────────────────

const chk = (code: string, ok: boolean) => ({ code, ok, explanation: code });
// The standard intact rows an on-device (untrusted) export produces.
const INTACT_ROWS = [
  chk(C2PA_CHECK.assertionHashedUriMatch, true),
  chk(C2PA_CHECK.claimSignatureValidated, true),
  chk(C2PA_CHECK.claimSignatureInsideValidity, true),
  chk(C2PA_CHECK.assertionDataHashMatch, true),
  chk(C2PA_CHECK.signingCredentialUntrusted, false),
];
const rpt = (over: Partial<C2paVerdictInput> = {}): C2paVerdictInput => ({
  state: 'valid', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false,
  partsMadeWithLolly: false, delivered: false, checks: INTACT_ROWS, ...over,
});

test('all-pass, unanchored → valid/good (untrusted marker always excluded)', () => {
  const v = resolveVerdict(rpt());
  assert.equal(v.state, 'valid');
  assert.equal(v.tone, 'good');
  assert.equal(v.trusted, false);
  assert.equal(v.expiredOnly, false);
  assert.equal(v.identity, null);
});

test('madeWithLolly wins outright → lolly/good', () => {
  const v = resolveVerdict(rpt({ madeWithLolly: true }));
  assert.equal(v.state, 'lolly');
  assert.equal(v.tone, 'good');
  assert.equal(v.madeWithLolly, true);
});

test('trusted (anchored, intact) → trusted/good, identity passed through', () => {
  const identity = { email: 'maker@example.com', issuer: 'Lolly CA' };
  const v = resolveVerdict(rpt({
    trusted: true,
    checks: [chk(C2PA_CHECK.claimSignatureValidated, true), chk(C2PA_CHECK.assertionDataHashMatch, true), chk(C2PA_CHECK.signingCredentialTrusted, true)],
    signer: { identity },
  }));
  assert.equal(v.state, 'trusted');
  assert.equal(v.tone, 'good');
  assert.equal(v.trusted, true);
  assert.deepEqual(v.identity, identity);
});

test('trusted + delivered → delivered/good; delivered WITHOUT trusted stays valid', () => {
  assert.equal(resolveVerdict(rpt({ trusted: true, delivered: true })).state, 'delivered');
  assert.equal(resolveVerdict(rpt({ trusted: true, delivered: true })).tone, 'good');
  // The web ladder gates delivered on trusted — an unanchored published asset
  // is just an intact credential.
  const unanchored = resolveVerdict(rpt({ delivered: true }));
  assert.equal(unanchored.state, 'valid');
  assert.equal(unanchored.delivered, true, 'the flag still surfaces for renderers');
});

test('defence in depth: trusted flag on a broken report never outranks the failure', () => {
  const v = resolveVerdict(rpt({
    trusted: true, state: 'invalid',
    checks: [...INTACT_ROWS.slice(0, 3), chk(C2PA_CHECK.assertionDataHashMismatch, false)],
  }));
  assert.equal(v.state, 'invalid');
  assert.equal(v.tone, 'bad');
  assert.equal(v.trusted, false, 'the re-gated trusted flag drops with the state');
});

test('hard-binding failure (no Lolly claim) → invalid/bad', () => {
  const v = resolveVerdict(rpt({
    state: 'invalid',
    checks: [...INTACT_ROWS.slice(0, 3), chk(C2PA_CHECK.assertionDataHashMismatch, false), chk(C2PA_CHECK.signingCredentialUntrusted, false)],
  }));
  assert.equal(v.state, 'invalid');
  assert.equal(v.tone, 'bad');
});

test('likelyMadeWithLolly on an invalid report → likelyLolly/warn', () => {
  const v = resolveVerdict(rpt({
    state: 'invalid', likelyMadeWithLolly: true,
    checks: [...INTACT_ROWS.slice(0, 3), chk(C2PA_CHECK.assertionDataHashMismatch, false), chk(C2PA_CHECK.signingCredentialUntrusted, false)],
  }));
  assert.equal(v.state, 'likelyLolly');
  assert.equal(v.tone, 'warn');
});

test('expired-only → expired/warn (bytes intact, never "modified after signing")', () => {
  const checks = [
    chk(C2PA_CHECK.assertionHashedUriMatch, true),
    chk(C2PA_CHECK.claimSignatureValidated, true),
    chk(C2PA_CHECK.signingCredentialExpired, false),
    chk(C2PA_CHECK.assertionDataHashMatch, true),
    chk(C2PA_CHECK.signingCredentialUntrusted, false),
  ];
  const v = resolveVerdict(rpt({ state: 'invalid', checks }));
  assert.equal(v.state, 'expired');
  assert.equal(v.tone, 'warn');
  assert.equal(v.expiredOnly, true);
  assert.equal(isExpiredOnly({ checks }), true, 'untrusted marker excluded from the fail count');
});

test('expired PLUS another failure is NOT expired-only → invalid/bad', () => {
  const checks = [
    chk(C2PA_CHECK.signingCredentialExpired, false),
    chk(C2PA_CHECK.assertionDataHashMismatch, false),
    chk(C2PA_CHECK.signingCredentialUntrusted, false),
  ];
  assert.equal(isExpiredOnly({ checks }), false);
  const v = resolveVerdict(rpt({ state: 'invalid', checks }));
  assert.equal(v.state, 'invalid');
  assert.equal(v.tone, 'bad');
});

test('partsMadeWithLolly is a FLAG, never a rung: state stays valid (or trusted)', () => {
  // Reference (web hero) semantics: parts surfaces as a scorecard pip only.
  // The CLI deliberately elevates this flag to its headline — that divergence
  // lives at the CLI call site, not here.
  const parts = resolveVerdict(rpt({ partsMadeWithLolly: true }));
  assert.equal(parts.state, 'valid');
  assert.equal(parts.partsMadeWithLolly, true);
  const trustedParts = resolveVerdict(rpt({ partsMadeWithLolly: true, trusted: true }));
  assert.equal(trustedParts.state, 'trusted', 'anchored parts file resolves trusted (web: "Verified")');
  assert.equal(trustedParts.partsMadeWithLolly, true);
});

test('none → none/none; an unexpected state value degrades to none', () => {
  const v = resolveVerdict(rpt({ state: 'none', checks: [] }));
  assert.equal(v.state, 'none');
  assert.equal(v.tone, 'none');
  const weird = resolveVerdict(rpt({ state: 'garbled' as never, checks: [] }));
  assert.equal(weird.state, 'none', 'mirrors the web view STATE_COPY[state] ?? none fallback');
});

// ─── 3. The real writer→verifier round-trip ──────────────────────────────────

test('round-trip: Lolly-created export → lolly/good; its codes are all C2PA_CHECK values', async () => {
  const stamped = await embedC2paInPdf(buildTestPdf(), { title: 'Made Here', claimGenerator: 'Lolly' });
  const report = await verifyC2pa(stamped);
  const v = resolveVerdict(report);
  assert.equal(v.state, 'lolly');
  assert.equal(v.tone, 'good');
  // Every emitted code comes from the shared map — constants meet reality.
  const known = new Set<string>(Object.values(C2PA_CHECK));
  for (const c of report.checks) assert.ok(known.has(c.code), `unknown check code ${c.code}`);
});

test('round-trip: re-saved Lolly export (tamper outside the manifest) → likelyLolly/warn', async () => {
  const pdf = (await embedC2paInPdf(buildTestPdf(), { title: 'Made Here', claimGenerator: 'Lolly' })).slice();
  const mi = binOf(pdf).indexOf('MediaBox') + 1; // original PDF bytes, excluded from nothing
  pdf[mi] = pdf[mi]! ^ 0x01;
  const v = resolveVerdict(await verifyC2pa(pdf));
  assert.equal(v.state, 'likelyLolly');
  assert.equal(v.tone, 'warn');
  assert.equal(v.likelyMadeWithLolly, true);
});

test('round-trip: non-Lolly generator → valid/good intact, invalid/bad when tampered', async () => {
  // NB 'LollyTest/1.0' does NOT claim Lolly (\blolly\b word boundary), so this
  // is the plain on-device integrity case.
  const stamped = await embedC2paInPdf(buildTestPdf(), { title: 'Foreign', claimGenerator: 'SomeTool/1.0' });
  assert.equal(resolveVerdict(await verifyC2pa(stamped)).state, 'valid');
  const pdf = stamped.slice();
  const mi = binOf(pdf).indexOf('MediaBox') + 1;
  pdf[mi] = pdf[mi]! ^ 0x01;
  const v = resolveVerdict(await verifyC2pa(pdf));
  assert.equal(v.state, 'invalid');
  assert.equal(v.tone, 'bad');
});

test('round-trip: lapsed certificate, bytes untouched → expired/warn', async () => {
  const old = await embedC2paInPdf(buildTestPdf(), {
    title: 'Old Asset', claimGenerator: 'SomeTool/1.0',
    dates: { notBefore: '2020-01-01T00:00:00Z', notAfter: '2021-01-01T00:00:00Z', signedAt: '2020-06-01T00:00:00Z' },
  });
  const report = await verifyC2pa(old);
  assert.equal(isExpiredOnly(report), true);
  const v = resolveVerdict(report);
  assert.equal(v.state, 'expired');
  assert.equal(v.tone, 'warn');
});

test('round-trip: no credential at all → none/none', async () => {
  const v = resolveVerdict(await verifyC2pa(buildTestPdf()));
  assert.equal(v.state, 'none');
  assert.equal(v.tone, 'none');
});

test('round-trip: pinned-anchor chain → trusted; published under it → delivered', async () => {
  const root = await generateCaRoot({ commonName: 'Verdict Test Root', organization: 'Lolly', days: 3650 });
  const device = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const deviceSpki = new Uint8Array(await subtle.exportKey('spki', device.publicKey));
  const leafDer = await issueLeafCert({
    caCertDer: root.certDer, caPrivateKey: root.pkcs8Der,
    spkiDer: deviceSpki, email: 'verdict@example.com', days: 30,
  });
  const signer = { privateKey: device.privateKey, certDer: leafDer, chain: [leafDer, root.certDer] };
  const anchors = [root.certDer];

  const created = await embedC2paInPdf(buildTestPdf(), { title: 'Anchored', claimGenerator: 'SomeTool/1.0', signer });
  const vTrusted = resolveVerdict(await verifyC2pa(created, { trustAnchors: anchors }));
  assert.equal(vTrusted.state, 'trusted');
  assert.equal(vTrusted.tone, 'good');
  assert.equal(vTrusted.identity?.email, 'verdict@example.com');

  const published = await embedC2paInPdf(buildTestPdf(), { title: 'Official', claimGenerator: 'Lolly', authorship: 'delivered', signer });
  const vDelivered = resolveVerdict(await verifyC2pa(published, { trustAnchors: anchors }));
  assert.equal(vDelivered.state, 'delivered');
  assert.equal(vDelivered.tone, 'good');
  assert.equal(vDelivered.madeWithLolly, false, 'delivered, never authored');
});

// ─── defaultTrustAnchors — the per-surface assembly, made explicit ────────────

test('defaultTrustAnchors: vendored-only (CLI flagless / MCP policy) equals c2paTrustAnchors()', () => {
  const vendored = c2paTrustAnchors();
  assert.deepEqual(defaultTrustAnchors({ includeLollyRoot: false }), vendored);
  assert.deepEqual(defaultTrustAnchors(), vendored, 'includeLollyRoot defaults off');
  assert.notEqual(defaultTrustAnchors(), vendored, 'a fresh array each call — never the cache itself');
});

test('defaultTrustAnchors: includeLollyRoot prepends the Lolly root (web /valid policy)', () => {
  const anchors = defaultTrustAnchors({ includeLollyRoot: true });
  assert.equal(anchors.length, c2paTrustAnchors().length + 1);
  assert.deepEqual(anchors[0], pemToDer(LOLLY_CA_ROOT_PEM), 'Lolly root first, exactly as /valid builds it');
});

test('defaultTrustAnchors: extra PEMs (CLI --trust-anchor) append after the vendored list', async () => {
  const root = await generateCaRoot({ commonName: 'Extra Root', organization: 'Test', days: 365 });
  const anchors = defaultTrustAnchors({ includeLollyRoot: false, extra: [derToPem(root.certDer, 'CERTIFICATE')] });
  assert.equal(anchors.length, c2paTrustAnchors().length + 1);
  assert.deepEqual(anchors[anchors.length - 1], root.certDer);
  // Parity with the CLI's old inline pemToDer: a bodyless PEM throws (a
  // lenient-but-nonempty body is passed through to never-match, exactly as before).
  assert.throws(() => defaultTrustAnchors({ extra: [''] }), /no PEM body/);
});

test('LOLLY_CA_ROOT_PEM matches the web shell copy (drift guard until /valid adopts the engine home)', () => {
  const webCaRoot = readFileSync(new URL('../shells/web/src/ca-root.ts', import.meta.url), 'utf8');
  const pemOf = (s: string): string | undefined =>
    s.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0];
  assert.ok(pemOf(LOLLY_CA_ROOT_PEM), 'engine copy carries a certificate block');
  assert.equal(pemOf(LOLLY_CA_ROOT_PEM), pemOf(webCaRoot), 'engine and shells/web/src/ca-root.ts must stay byte-identical');
});
