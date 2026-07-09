/**
 * C2PA verifier contract tests — the read side of the c2pa.js writer.
 * Run with: node --test tests/c2pa-verify.test.ts
 *
 * The fixture is the embedder's own output (a stamped minimal classic-xref
 * PDF), so these tests close the loop writer → file → verifier. Tampering is
 * byte-flips at known offsets: outside the manifest (hard-binding must fail),
 * inside an assertion (hashed URI must fail), inside the claim (signature must
 * fail) — each leaving every OTHER check intact, which pins down that the
 * verifier attributes damage to the right layer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedC2paInPdf, embedC2pa, encodeCbor } from '../engine/src/c2pa.ts';
import { verifyC2pa, extractC2paFromPdf, decodeCbor, parseC2paStore, sniffFormat, prepareC2paIngredient } from '../engine/src/c2pa-verify.ts';

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

// Default dates (now ± 1 year) so the validity-window check is exercised as a
// pass without a wall-clock time bomb; expiry gets its own explicit fixture.
const stamped = embedC2paInPdf(buildTestPdf(), {
  title: 'Fixture Asset',
  claimGenerator: 'LollyTest/1.0',
});

const codesOf = (report: any): string[] => report.checks.map((c: any) => `${c.code}:${c.ok ? 'ok' : 'fail'}`);
const check = (report: any, code: string): any => report.checks.find((c: any) => c.code === code);

test('verifies the embedder\'s own output: valid, untrusted, facts intact', async () => {
  const report: any = await verifyC2pa(await stamped);
  assert.equal(report.found, true);
  assert.equal(report.state, 'valid');
  assert.equal(report.trusted, false);
  // every check passes except the always-present untrusted marker
  for (const c of report.checks) {
    assert.equal(c.ok, c.code !== 'signingCredential.untrusted', `${c.code}: ${c.explanation}`);
  }
  assert.ok(check(report, 'claimSignature.validated'));
  assert.ok(check(report, 'assertion.dataHash.match'));
  assert.equal(report.checks.filter((c: any) => c.code === 'assertion.hashedURI.match').length, 2);

  assert.equal(report.claim.title, 'Fixture Asset');
  // v2 claim: no dc:format / claim_generator string — the generator identity is
  // surfaced from the required claim_generator_info map instead.
  assert.equal(report.claim.format, undefined);
  assert.equal(report.claim.claimGenerator, undefined);
  assert.equal(report.claim.generatorInfo?.name, 'LollyTest/1.0');
  assert.match(report.claim.manifestLabel, /^urn:uuid:/);
  assert.equal(report.claim.actions[0].action, 'c2pa.created');
  assert.equal(report.claim.actions[0].softwareAgent, 'LollyTest/1.0');

  assert.equal(report.signer.commonName, 'Lolly On-Device Credential');
  assert.equal(report.signer.organization, 'Lolly');
  assert.equal(report.signer.selfSigned, true);
  assert.equal(report.signer.alg, 'ES256');
});

test('surfaces the enriched tools.lolly.export environment (date, dimensions, nested inputs digest)', async () => {
  const withEnv = await embedC2paInPdf(buildTestPdf(), {
    title: 'Enriched Asset',
    claimGenerator: 'LollyTest/1.0',
    environment: {
      tool: 'Layout Studio', format: 'pdf', surface: 'web', engine: 'Chromium 149', os: 'macOS',
      date: '2026-07-08T11:14:40.000Z', dimensions: '1080 × 1080 px',
      // Nested map — dropped by the flat scalar reader, lifted separately as the
      // input digest; a non-string value must be filtered out defensively.
      inputs: { color: '#ffffff', headline: 'short text here', bogus: 42 as unknown as string },
    },
  });
  const report: any = await verifyC2pa(withEnv);
  assert.equal(report.state, 'valid');
  assert.equal(report.environment.tool, 'Layout Studio');
  assert.equal(report.environment.date, '2026-07-08T11:14:40.000Z');
  assert.equal(report.environment.dimensions, '1080 × 1080 px');
  assert.deepEqual(report.environment.inputs, { color: '#ffffff', headline: 'short text here' });
});

test('a PDF without credentials → found:false, state none', async () => {
  const report: any = await verifyC2pa(buildTestPdf());
  assert.equal(report.found, false);
  assert.equal(report.state, 'none');
  assert.match(report.reason, /no Content Credentials/);
});

test('junk bytes → unrecognised container, no credential invented', async () => {
  const report: any = await verifyC2pa(bytesOf('definitely not any container we know'));
  assert.equal(report.found, false);
  assert.equal(report.state, 'none');
  assert.equal(report.format, null);
  assert.match(report.reason, /unrecognised file format/);
});

test('magic bytes with a broken body → found-but-unreadable, honestly invalid', async () => {
  // Starts with the GIF magic, so it sniffs as gif — and then fails to parse.
  const report: any = await verifyC2pa(bytesOf('GIF89a definitely not a real gif'));
  assert.equal(report.format, 'gif');
  assert.equal(report.state, 'invalid');
  assert.equal(report.checks[0].code, 'credential.unreadable');
});

test('extraction: stream offset agrees with the hard-binding exclusion', async () => {
  const pdf = await stamped;
  const extracted = extractC2paFromPdf(pdf)!;
  const { manifest, start } = extracted;
  const parts = parseC2paStore(manifest);
  const hd: any = decodeCbor(parts.assertions.find((a: any) => a.label === 'c2pa.hash.data')!.content);
  assert.equal(hd.get('exclusions')[0].get('start'), start);
  assert.equal(hd.get('exclusions')[0].get('length'), manifest.length);
});

test('tamper OUTSIDE the manifest → only the hard binding fails', async () => {
  const pdf = (await stamped).slice();
  const mi = binOf(pdf).indexOf('MediaBox') + 1; // original PDF bytes, excluded from nothing
  pdf[mi] = pdf[mi]! ^ 0x01;
  const report: any = await verifyC2pa(pdf);
  assert.equal(report.state, 'invalid');
  assert.equal(check(report, 'assertion.dataHash.mismatch').ok, false);
  assert.ok(check(report, 'claimSignature.validated').ok, 'claim signature must survive content tamper');
  assert.equal(report.checks.filter((c: any) => c.code === 'assertion.hashedURI.match').length, 2);
});

test('tamper INSIDE an assertion → its hashed URI fails, binding+signature hold', async () => {
  const pdf = (await stamped).slice();
  // first 'LollyTest' hit = softwareAgent inside the actions assertion CBOR
  // (the second lives in the claim); the manifest bytes are excluded from the
  // hard binding, so only the assertion's hashed URI may fail.
  const li = binOf(pdf).indexOf('LollyTest') + 2;
  pdf[li] = pdf[li]! ^ 0x01;
  const report: any = await verifyC2pa(pdf);
  assert.equal(report.state, 'invalid');
  const uriChecks = report.checks.filter((c: any) => c.code.startsWith('assertion.hashedURI'));
  assert.deepEqual(uriChecks.map((c: any) => c.ok), [false, true]);
  assert.ok(check(report, 'claimSignature.validated').ok);
  assert.ok(check(report, 'assertion.dataHash.match').ok);
});

test('tamper INSIDE the claim → signature fails, assertions + binding hold', async () => {
  const pdf = (await stamped).slice();
  const fi = binOf(pdf).indexOf('Fixture Asset') + 1; // dc:title lives only in the claim
  pdf[fi] = pdf[fi]! ^ 0x01;
  const report: any = await verifyC2pa(pdf);
  assert.equal(report.state, 'invalid');
  assert.equal(check(report, 'claimSignature.mismatch').ok, false);
  assert.equal(report.checks.filter((c: any) => c.code === 'assertion.hashedURI.match').length, 2);
  assert.ok(check(report, 'assertion.dataHash.match').ok);
});

test('an expired signer is reported (and only that)', async () => {
  const old = await embedC2paInPdf(buildTestPdf(), {
    title: 'Old Asset',
    claimGenerator: 'LollyTest/1.0',
    dates: { notBefore: '2020-01-01T00:00:00Z', notAfter: '2021-01-01T00:00:00Z', signedAt: '2020-06-01T00:00:00Z' },
  });
  const report: any = await verifyC2pa(old);
  assert.equal(report.state, 'invalid');
  assert.equal(check(report, 'signingCredential.expired').ok, false);
  assert.ok(check(report, 'claimSignature.validated').ok, 'signature math is independent of the validity window');
  assert.ok(check(report, 'assertion.dataHash.match').ok);
});

test('decodeCbor round-trips the writer\'s encoder', () => {
  const value = new Map<unknown, unknown>([
    ['s', 'tëxt'], ['n', -1234], ['b', new Uint8Array([1, 2, 3])],
    ['a', [true, false, null, 42]], ['m', new Map([[1, 'one']])],
  ]);
  const back: any = decodeCbor(encodeCbor(value));
  assert.equal(back.get('s'), 'tëxt');
  assert.equal(back.get('n'), -1234);
  assert.deepEqual(Array.from(back.get('b')), [1, 2, 3]);
  assert.deepEqual(back.get('a'), [true, false, null, 42]);
  assert.equal(back.get('m').get(1), 'one');
});

test('decodeCbor reads the wild forms foreign manifests use', () => {
  // indefinite array [1, 2] and indefinite map {1: "a"}
  assert.deepEqual(decodeCbor(Uint8Array.of(0x9f, 0x01, 0x02, 0xff)), [1, 2]);
  assert.equal((decodeCbor(Uint8Array.of(0xbf, 0x01, 0x61, 0x61, 0xff)) as Map<unknown, unknown>).get(1), 'a');
  // indefinite text: "ab" as two chunks
  assert.equal(decodeCbor(Uint8Array.of(0x7f, 0x61, 0x61, 0x61, 0x62, 0xff)), 'ab');
  // floats: half 1.0, single 0.5, double -4.1
  assert.equal(decodeCbor(Uint8Array.of(0xf9, 0x3c, 0x00)), 1);
  assert.equal(decodeCbor(Uint8Array.of(0xfa, 0x3f, 0x00, 0x00, 0x00)), 0.5);
  assert.equal(decodeCbor(Uint8Array.of(0xfb, 0xc0, 0x10, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66)), -4.1);
  assert.throws(() => decodeCbor(Uint8Array.of(0x1c)), /reserved length/);
});

// ── authorship: "delivered" vs "created" ─────────────────────────────────────
// A delivered asset names Lolly as the deliverer but carries a c2pa.published
// action (no creation) — it must never read as authored by Lolly.
const stampedDelivered = embedC2paInPdf(buildTestPdf(), { title: 'Delivered Asset', claimGenerator: 'Lolly', authorship: 'delivered' });
const stampedCreatedLolly = embedC2paInPdf(buildTestPdf(), { title: 'Created Asset', claimGenerator: 'Lolly', authorship: 'created' });

test('authorship "delivered" → c2pa.published, delivered=true, madeWithLolly=false', async () => {
  const r: any = await verifyC2pa(await stampedDelivered);
  assert.equal(r.state, 'valid');
  assert.equal(r.claim.actions[0].action, 'c2pa.published');
  assert.equal(r.claim.actions[0].softwareAgent, 'Lolly');
  assert.equal(r.delivered, true);
  assert.equal(r.madeWithLolly, false, 'a delivered Lolly-named asset must NOT read as made-with-lolly');
});

test('authorship "created" with a Lolly generator → madeWithLolly=true, delivered=false', async () => {
  const r: any = await verifyC2pa(await stampedCreatedLolly);
  assert.equal(r.state, 'valid');
  assert.equal(r.claim.actions[0].action, 'c2pa.created');
  assert.equal(r.madeWithLolly, true);
  assert.equal(r.delivered, false);
});

// v2 records the human author in a CAWG metadata assertion (dc:creator); the
// verifier reads it back into report.author for the "Produced by" line. (The
// strict c2pa.metadata assertion forbids creator fields — see c2pa.ts.)
test('author profile → cawg.metadata dc:creator → report.author round-trips', async () => {
  const pdf = await embedC2paInPdf(buildTestPdf(), {
    title: 'Authored Asset', claimGenerator: 'Lolly', author: { name: 'Andy Fitzsimon' },
  });
  const r: any = await verifyC2pa(pdf);
  assert.equal(r.state, 'valid', 'the CAWG metadata assertion must not break validity');
  assert.deepEqual(r.author, { name: 'Andy Fitzsimon' });
  // The assertion is referenced + hashed like any other (no unverified assertion).
  assert.ok(r.checks.some((c: any) => c.ok && c.code === 'assertion.hashedURI.match'));
  assert.ok(!r.checks.some((c: any) => !c.ok && c.code === 'assertion.hashedURI.mismatch'));
});

// The manifest profile a catalog "modified download" writes (web shell
// downloadSigned → stampDerivedC2pa): custom edit actions with NO c2pa.created
// — the engine prepends c2pa.opened for the preserved source ingredient — plus
// the transform detail under tools.lolly.export. The chain must verify, the
// source's AI origin must propagate onto the new active manifest, and the
// history must span BOTH manifests (the AI creation and the Lolly edits).
test('derived download: edit actions + AI-source ingredient → valid, chained, AI flag propagated', async () => {
  const svgOf = (fill: string): Uint8Array => Uint8Array.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${fill}"/></svg>`,
    (c) => c.charCodeAt(0) & 0xff,
  );
  // The "uploaded AI image": its own credential declares trainedAlgorithmicMedia.
  const aiSource = await embedC2pa(svgOf('#0c322c'), 'svg', {
    title: 'AI artwork',
    claimGenerator: 'SomeImageModel/1.0',
    actions: [{ action: 'c2pa.created', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' }],
  });
  const ingredient = prepareC2paIngredient(aiSource);
  assert.ok(ingredient, 'source credential reads back as an ingredient');

  // The "colour-washed download": different bytes, Lolly-signed edit history.
  const derived = await embedC2pa(svgOf('#90ebcd'), 'svg', {
    title: 'photo.svg',
    claimGenerator: 'Lolly lolly.tools',
    environment: { tool: 'Catalog', format: 'svg', inputs: { asset: 'user/photo', treatment: 'Forest' } },
    actions: [
      { action: 'c2pa.color_adjustments', description: "Applied the 'Forest' colour treatment" },
      { action: 'c2pa.converted', description: 'Rendered to SVG' },
    ],
    ingredients: [ingredient!],
  });

  const r: any = await verifyC2pa(derived);
  assert.equal(r.state, 'valid', `chained manifest verifies (${r.reason ?? ''})`);
  // Engine-prepended opened step first, then the shell's edit steps verbatim.
  assert.equal(r.claim.actions[0].action, 'c2pa.opened');
  assert.deepEqual(
    r.claim.actions.slice(1).map((a: any) => a.action),
    ['c2pa.color_adjustments', 'c2pa.converted'],
  );
  assert.equal(r.claim.actions[1].description, "Applied the 'Forest' colour treatment");
  // The AI origin fires from the NEW manifest's own signed actions.
  assert.equal(r.aiGenerated?.kind, 'generated');
  // History walks the whole store: the source's creation AND this edit round.
  const historyActions = (r.history ?? []).map((s: any) => s.action);
  assert.ok(historyActions.includes('c2pa.created'), 'source manifest creation in the chain');
  assert.ok(historyActions.includes('c2pa.color_adjustments'), 'the Lolly edit in the chain');
  // Transform detail rides the tools.lolly.export assertion.
  assert.equal(r.environment?.tool, 'Catalog');
  assert.equal(r.environment?.inputs?.treatment, 'Forest');
});
