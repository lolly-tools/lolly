/**
 * C2PA manifest builder + PDF embedder contract tests.
 * Run with: node --test tests/c2pa.test.js
 *
 * Every layer of the container is re-read independently of the builder:
 * hand-computed CBOR byte vectors, a from-scratch JUMBF box walker, a DER
 * walker over the self-signed cert, a hand-built COSE Sig_structure verified
 * with WebCrypto, and — the loop-closer — the hard-binding hash recomputed
 * from the embedder's own PDF output per its own exclusion ranges.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildC2paManifest, embedC2paInPdf, generateSigner, encodeCbor, CborTag } from '../engine/src/c2pa.js';

const te = new TextEncoder();
const td = new TextDecoder();
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', b));

function concat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const binOf = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
const bytesOf = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

// ─── independent CBOR decoder (definite lengths only) ─────────────────────────

function decodeItem(b, i) {
  const ib = b[i++];
  const major = ib >> 5;
  let n = ib & 0x1f;
  if (n === 24) { n = b[i]; i += 1; }
  else if (n === 25) { n = (b[i] << 8) | b[i + 1]; i += 2; }
  else if (n === 26) { n = b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]); i += 4; }
  else if (n === 27) { n = Number(new DataView(b.buffer, b.byteOffset + i, 8).getBigUint64(0)); i += 8; }
  else if (n > 27) throw new Error('cbor test decoder: indefinite/reserved head');
  switch (major) {
    case 0: return [n, i];
    case 1: return [-1 - n, i];
    case 2: return [b.slice(i, i + n), i + n];
    case 3: return [td.decode(b.slice(i, i + n)), i + n];
    case 4: {
      const a = [];
      for (let k = 0; k < n; k++) { const [v, j] = decodeItem(b, i); a.push(v); i = j; }
      return [a, i];
    }
    case 5: {
      const m = new Map();
      for (let k = 0; k < n; k++) {
        const [key, j] = decodeItem(b, i);
        const [v, j2] = decodeItem(b, j);
        m.set(key, v);
        i = j2;
      }
      return [m, i];
    }
    case 6: { const [v, j] = decodeItem(b, i); return [{ tag: n, value: v }, j]; }
    default: return [n === 20 ? false : n === 21 ? true : n === 22 ? null : n, i];
  }
}

function decodeCbor(bytes) {
  const [v, end] = decodeItem(bytes, 0);
  assert.equal(end, bytes.length, 'cbor: trailing bytes after single item');
  return v;
}

// ─── independent JUMBF walker ─────────────────────────────────────────────────

// Boxes must tile [start,end) exactly — the walker asserts it.
function walkBoxes(bytes, start, end) {
  const boxes = [];
  let i = start;
  while (i < end) {
    const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(i);
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    assert.ok(len >= 8 && i + len <= end, `box ${type} overruns its container`);
    boxes.push({ type, start: i, payloadStart: i + 8, end: i + len });
    i += len;
  }
  assert.equal(i, end, 'boxes tile the container exactly');
  return boxes;
}

function parseSuperbox(bytes, box) {
  assert.equal(box.type, 'jumb');
  const kids = walkBoxes(bytes, box.payloadStart, box.end);
  assert.equal(kids[0].type, 'jumd', 'first child of a superbox is the description box');
  const uuid = hex(bytes.slice(kids[0].payloadStart, kids[0].payloadStart + 16));
  const toggles = bytes[kids[0].payloadStart + 16];
  assert.ok(toggles & 0x02, 'jumd label toggle set');
  const rest = bytes.slice(kids[0].payloadStart + 17, kids[0].end);
  const nul = rest.indexOf(0);
  assert.ok(nul >= 0, 'jumd label is NUL-terminated');
  return { uuid, label: td.decode(rest.slice(0, nul)), children: kids.slice(1), box };
}

const JUMBF_SUFFIX = '00110010800000aa00389b71';
const uuidOf = (fourcc) => hex(te.encode(fourcc)) + JUMBF_SUFFIX;

function storeParts(store) {
  const [storeBox] = walkBoxes(store, 0, store.length);
  const s = parseSuperbox(store, storeBox);
  const manifest = parseSuperbox(store, s.children[0]);
  const [assertionStore, claim, signature] = manifest.children.map((c) => parseSuperbox(store, c));
  const [actions, hashData] = assertionStore.children.map((c) => parseSuperbox(store, c));
  const contentOf = (sub) => store.slice(sub.children[0].payloadStart, sub.children[0].end);
  return { store: s, manifest, assertionStore, claim, signature, actions, hashData, contentOf };
}

// ─── independent DER walker ───────────────────────────────────────────────────

function derTlv(b, i) {
  const tag = b[i];
  let len = b[i + 1];
  let j = i + 2;
  if (len & 0x80) {
    const k = len & 0x7f;
    len = 0;
    for (let x = 0; x < k; x++) len = len * 256 + b[j++];
  }
  return { tag, start: i, contentStart: j, end: j + len };
}

function derChildren(b, tlv) {
  const kids = [];
  let i = tlv.contentStart;
  while (i < tlv.end) {
    const c = derTlv(b, i);
    kids.push(c);
    i = c.end;
  }
  assert.equal(i, tlv.end, 'DER children tile the container');
  return kids;
}

// COSE decode + verify: reconstruct the detached-payload Sig_structure by
// hand (not via the module's encoder) and check ES256 with the SPKI pulled
// out of the x5chain certificate. Returns the decoded claim map.
async function verifyCose(store) {
  const p = storeParts(store);
  const claimBytes = p.contentOf(p.claim);
  const cose = decodeCbor(p.contentOf(p.signature));
  assert.equal(cose.tag, 18, 'COSE_Sign1_Tagged');
  const [protBytes, unprotected, payload, sigRaw] = cose.value;
  assert.equal(payload, null, 'payload is detached');
  assert.ok(unprotected instanceof Map);
  assert.equal(sigRaw.length, 64, 'raw r||s, not DER');
  const prot = decodeCbor(protBytes);
  assert.equal(prot.get(1), -7, 'alg ES256');
  const chain = prot.get(33);
  assert.ok(Array.isArray(chain) && chain.length === 1, 'x5chain carries one cert');
  const cert = chain[0];
  const tbs = derChildren(cert, derTlv(cert, 0))[0];
  const spkiTlv = derChildren(cert, tbs)[6];
  const key = await crypto.subtle.importKey(
    'spki', cert.slice(spkiTlv.start, spkiTlv.end),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  const bstrHead = (n) =>
    n < 24 ? Uint8Array.of(0x40 + n) : n < 0x100 ? Uint8Array.of(0x58, n) : Uint8Array.of(0x59, n >> 8, n & 0xff);
  const sigStructure = concat([
    Uint8Array.of(0x84, 0x6a), te.encode('Signature1'),
    bstrHead(protBytes.length), protBytes,
    Uint8Array.of(0x40),
    bstrHead(claimBytes.length), claimBytes,
  ]);
  assert.equal(
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigRaw, sigStructure),
    true, 'COSE_Sign1 signature verifies',
  );
  return decodeCbor(claimBytes);
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

const DATES = {
  notBefore: '2026-01-01T00:00:00Z',
  notAfter: '2027-01-01T00:00:00Z',
  signedAt: '2026-07-02T12:00:00Z',
};

const fixture = buildC2paManifest({
  title: 'Fixture Asset',
  claimGenerator: 'LollyTest/1.0',
  format: 'application/pdf',
  assetHash: { exclusions: [{ start: 100, length: 200 }], hash: new Uint8Array(32).fill(7), pad: new Uint8Array(4) },
  dates: DATES,
});

// Minimal classic-xref PDF (catalog + pages + page) with correct offsets.
function buildTestPdf({ withNames = false } = {}) {
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [];
  const push = (s) => { offsets.push(out.length); out += s; };
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R${withNames ? ' /Names << /Dests << /Names [] >> >>' : ''} >>\nendobj\n`);
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return { bytes: bytesOf(out), startxref: xrefOff };
}

// ─── CBOR ─────────────────────────────────────────────────────────────────────

test('CBOR encoder matches hand-computed byte vectors', () => {
  const eq = (v, expected) => assert.equal(hex(encodeCbor(v)), expected);
  // unsigned ints across every head width
  eq(0, '00'); eq(23, '17'); eq(24, '1818'); eq(255, '18ff');
  eq(256, '190100'); eq(65535, '19ffff'); eq(65536, '1a00010000');
  eq(4294967295, '1affffffff'); eq(4294967296, '1b0000000100000000');
  // negatives (ES256 alg = -7 lives here)
  eq(-1, '20'); eq(-7, '26'); eq(-24, '37'); eq(-25, '3818');
  // strings / bytes
  eq('', '60'); eq('IETF', '6449455446');
  eq(new Uint8Array(0), '40'); eq(new Uint8Array([1, 2, 3, 4]), '4401020304');
  // containers
  eq([], '80'); eq([1, [2, 3]], '8201820203');
  eq(new Map(), 'a0');
  eq(new Map([[1, 2], [3, new Uint8Array([0xaa, 0xbb])]]), 'a201020342aabb');
  eq({ a: 1 }, 'a1616101');
  // tags + simple values
  eq(new CborTag(18, []), 'd280');
  eq(true, 'f5'); eq(false, 'f4'); eq(null, 'f6');
  assert.throws(() => encodeCbor(1.5), /safe integers/);
});

test('CBOR round-trips through an independent decoder', () => {
  const value = new Map([
    ['s', 'tëxt'],
    ['n', -1234],
    ['b', new Uint8Array([1, 2, 3])],
    ['a', [true, false, null, 42]],
    ['m', new Map([[1, 'one']])],
  ]);
  const back = decodeCbor(encodeCbor(value));
  assert.equal(back.get('s'), 'tëxt');
  assert.equal(back.get('n'), -1234);
  assert.equal(hex(back.get('b')), '010203');
  assert.deepEqual(back.get('a'), [true, false, null, 42]);
  assert.equal(back.get('m').get(1), 'one');
});

// ─── JUMBF ────────────────────────────────────────────────────────────────────

test('JUMBF store: superbox/description structure, C2PA UUIDs and labels', async () => {
  const store = await fixture;
  const p = storeParts(store);
  assert.equal(p.store.uuid, uuidOf('c2pa'));
  assert.equal(p.store.label, 'c2pa');
  assert.equal(p.store.children.length, 1, 'store holds one manifest');
  assert.equal(p.manifest.uuid, uuidOf('c2ma'));
  assert.match(p.manifest.label, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(p.assertionStore.uuid, uuidOf('c2as'));
  assert.equal(p.assertionStore.label, 'c2pa.assertions');
  assert.equal(p.claim.uuid, uuidOf('c2cl'));
  assert.equal(p.claim.label, 'c2pa.claim');
  assert.equal(p.signature.uuid, uuidOf('c2cs'));
  assert.equal(p.signature.label, 'c2pa.signature');
  // CBOR assertions: jumd carries the CBOR content-type UUID, content box type 'cbor'
  for (const sub of [p.actions, p.hashData, p.claim, p.signature]) {
    assert.equal(sub.children.length, 1);
    assert.equal(sub.children[0].type, 'cbor');
  }
  assert.equal(p.actions.uuid, uuidOf('cbor'));
  assert.equal(p.actions.label, 'c2pa.actions');
  assert.equal(p.hashData.uuid, uuidOf('cbor'));
  assert.equal(p.hashData.label, 'c2pa.hash.data');

  const actions = decodeCbor(p.contentOf(p.actions)).get('actions');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].get('action'), 'c2pa.created');
  assert.equal(actions[0].get('softwareAgent'), 'LollyTest/1.0');
  assert.equal(actions[0].get('when'), '2026-07-02T12:00:00Z');

  const hd = decodeCbor(p.contentOf(p.hashData));
  assert.equal(hd.get('name'), 'jumbf manifest');
  assert.equal(hd.get('alg'), 'sha256');
  assert.equal(hd.get('exclusions')[0].get('start'), 100);
  assert.equal(hd.get('exclusions')[0].get('length'), 200);
  assert.equal(hd.get('hash').length, 32);
  assert.equal(hd.get('pad').length, 4);
});

// ─── COSE + claim ─────────────────────────────────────────────────────────────

test('COSE_Sign1 verifies; claim hashed-URIs match sha256 of assertion boxes', async () => {
  const store = await fixture;
  const claim = await verifyCose(store);
  assert.equal(claim.get('dc:title'), 'Fixture Asset');
  assert.equal(claim.get('dc:format'), 'application/pdf');
  assert.equal(claim.get('claim_generator'), 'LollyTest/1.0');
  assert.equal(claim.get('signature'), 'self#jumbf=c2pa.signature');
  assert.equal(claim.get('alg'), 'sha256');
  assert.match(claim.get('instanceID'), /^urn:uuid:/);
  const refs = claim.get('assertions');
  assert.equal(refs[0].get('url'), 'self#jumbf=c2pa.assertions/c2pa.actions');
  assert.equal(refs[1].get('url'), 'self#jumbf=c2pa.assertions/c2pa.hash.data');
  const p = storeParts(store);
  for (const [i, sub] of [p.actions, p.hashData].entries()) {
    const boxBytes = store.slice(sub.box.start, sub.box.end); // whole superbox, header included
    assert.equal(hex(refs[i].get('hash')), hex(await sha256(boxBytes)), `hashed URI ${i} covers the assertion superbox`);
  }
});

// ─── X.509 ────────────────────────────────────────────────────────────────────

test('self-signed certificate DER parses structurally', async () => {
  const { certDer: cert } = await generateSigner(DATES);
  const top = derTlv(cert, 0);
  assert.equal(top.tag, 0x30);
  assert.equal(top.end, cert.length, 'certificate is a single SEQUENCE');
  const [tbs, sigAlg, sigVal] = derChildren(cert, top);
  assert.equal(tbs.tag, 0x30);
  assert.equal(sigAlg.tag, 0x30);
  assert.equal(sigVal.tag, 0x03, 'signatureValue is a BIT STRING');
  // tbsCertificate: [0] version, serial, sigAlg, issuer, validity, subject, SPKI, [3] extensions
  const kids = derChildren(cert, tbs);
  assert.deepEqual(kids.map((k) => k.tag), [0xa0, 0x02, 0x30, 0x30, 0x30, 0x30, 0x30, 0xa3]);
  const version = derTlv(cert, kids[0].contentStart);
  assert.equal(version.tag, 0x02);
  assert.equal(cert[version.contentStart], 2, 'version v3');
  assert.ok(kids[1].end - kids[1].contentStart >= 8, 'serial has substance');
  assert.equal(cert[kids[1].contentStart] & 0x80, 0, 'serial is positive');
  // issuer == subject (self-signed), CN present
  assert.equal(hex(cert.slice(kids[3].start, kids[3].end)), hex(cert.slice(kids[5].start, kids[5].end)));
  assert.ok(binOf(cert.slice(kids[3].start, kids[3].end)).includes('Lolly On-Device Credential'));
  // validity: UTCTime pair with the caller's dates
  const [nb, na] = derChildren(cert, kids[4]);
  assert.equal(nb.tag, 0x17);
  assert.equal(na.tag, 0x17);
  assert.equal(binOf(cert.slice(nb.contentStart, nb.end)), '260101000000Z');
  assert.equal(binOf(cert.slice(na.contentStart, na.end)), '270101000000Z');
  // SPKI advertises id-ecPublicKey + P-256; signatureAlgorithm is ecdsa-with-SHA256
  const spkiHex = hex(cert.slice(kids[6].start, kids[6].end));
  assert.ok(spkiHex.includes('2a8648ce3d0201'), 'id-ecPublicKey');
  assert.ok(spkiHex.includes('2a8648ce3d030107'), 'prime256v1');
  assert.ok(hex(cert.slice(sigAlg.start, sigAlg.end)).includes('2a8648ce3d040302'), 'ecdsa-with-SHA256');
  // signatureValue holds a DER ECDSA-Sig-Value (SEQUENCE of two INTEGERs)
  const sig = derTlv(cert, sigVal.contentStart + 1); // skip unused-bits byte
  assert.equal(sig.tag, 0x30);
  assert.deepEqual(derChildren(cert, sig).map((k) => k.tag), [0x02, 0x02]);
});

test('manifest length is deterministic across differing hash bytes', async () => {
  const signer = await generateSigner(DATES);
  const mk = (fill) => buildC2paManifest({
    title: 'T', claimGenerator: 'G', dates: DATES, signer,
    assetHash: { exclusions: [{ start: 12345, length: 2222 }], hash: new Uint8Array(32).fill(fill), pad: new Uint8Array(8) },
  });
  const [a, b] = [await mk(0), await mk(255)];
  assert.equal(a.length, b.length);
});

// ─── PDF embedding ────────────────────────────────────────────────────────────

test('embedC2paInPdf appends a verifiable incremental update', async () => {
  const pdf = buildTestPdf();
  const out = await embedC2paInPdf(pdf.bytes, { title: 'Embedded Asset', claimGenerator: 'LollyTest/1.0', dates: DATES });

  // (i) original bytes are a byte-identical prefix
  assert.ok(out.length > pdf.bytes.length);
  assert.equal(Buffer.compare(Buffer.from(out.subarray(0, pdf.bytes.length)), Buffer.from(pdf.bytes)), 0);

  const tail = binOf(out.subarray(pdf.bytes.length));
  // (ii) new trailer's /Prev points at the ORIGINAL startxref offset
  assert.match(tail, new RegExp(`/Prev ${pdf.startxref}[^0-9]`));
  // (iii) attachment plumbing appears in the update
  for (const marker of ['(manifest.c2pa)', '/C2PA_Manifest', '/AF', '/EmbeddedFiles', '/Filespec', '/Type /EmbeddedFile']) {
    assert.ok(tail.includes(marker), `update contains ${marker}`);
  }
  assert.ok(!binOf(pdf.bytes).includes('/AF'), 'markers are new, not inherited');
  // the update's startxref points at its own xref keyword
  const sx = /startxref\n(\d+)\n%%EOF\n$/.exec(tail);
  assert.ok(sx, 'update ends with startxref + %%EOF');
  assert.equal(binOf(out.subarray(+sx[1], +sx[1] + 4)), 'xref');

  // locate the manifest through the EmbeddedFile stream, as a reader would
  const efIdx = tail.indexOf('/Type /EmbeddedFile');
  const mLen = +/\/Length (\d+)/.exec(tail.slice(efIdx, efIdx + 160))[1];
  const sIdx = pdf.bytes.length + tail.indexOf('stream\n', efIdx) + 'stream\n'.length;
  const manifest = out.slice(sIdx, sIdx + mLen);
  assert.equal(binOf(out.subarray(sIdx + mLen, sIdx + mLen + 11)), '\nendstream\n');

  // (iv) decode the embedded manifest's own hash.data and recompute the hard
  // binding over the final file with the exclusion range OMITTED
  const p = storeParts(manifest);
  const hd = decodeCbor(p.contentOf(p.hashData));
  const ex = hd.get('exclusions');
  assert.equal(ex.length, 1);
  assert.equal(ex[0].get('start'), sIdx, 'exclusion starts at the manifest bytes');
  assert.equal(ex[0].get('length'), mLen, 'exclusion covers exactly the manifest');
  assert.equal(hd.get('name'), 'jumbf manifest');
  assert.equal(hd.get('alg'), 'sha256');
  const hashInput = concat([out.subarray(0, sIdx), out.subarray(sIdx + mLen)]);
  assert.equal(hex(hd.get('hash')), hex(await sha256(hashInput)), 'hard-binding hash closes the loop');

  // the embedded manifest's COSE signature still verifies
  const claim = await verifyCose(manifest);
  assert.equal(claim.get('dc:title'), 'Embedded Asset');
  assert.equal(claim.get('dc:format'), 'application/pdf');
});

test('embedC2paInPdf merges into an existing inline /Names dict', async () => {
  const pdf = buildTestPdf({ withNames: true });
  const out = await embedC2paInPdf(pdf.bytes, { title: 'Merged', claimGenerator: 'LollyTest/1.0', dates: DATES });
  assert.equal(Buffer.compare(Buffer.from(out.subarray(0, pdf.bytes.length)), Buffer.from(pdf.bytes)), 0);
  const tail = binOf(out.subarray(pdf.bytes.length));
  const cat = /1 0 obj\n(<<[\s\S]*?)\nendobj/.exec(tail)[1];
  assert.ok(cat.includes('/Dests'), 'pre-existing name tree kept');
  assert.ok(cat.includes('/EmbeddedFiles << /Names [(manifest.c2pa)'), 'EmbeddedFiles injected');
  assert.equal(cat.match(/\/EmbeddedFiles/g).length, 1);
  assert.ok(cat.includes('/AF ['));
});

test('cross-reference stream PDFs are rejected with a clear error', async () => {
  const src = '%PDF-1.5\n5 0 obj\n<< /Type /XRef /W [1 2 1] >>\nstream\nxx\nendstream\nendobj\nstartxref\n9\n%%EOF\n';
  await assert.rejects(
    embedC2paInPdf(bytesOf(src), { title: 'x', claimGenerator: 'y', dates: DATES }),
    /cross-reference stream/,
  );
});

test('non-PDF input is rejected', async () => {
  await assert.rejects(embedC2paInPdf(te.encode('hello'), { title: 'x', claimGenerator: 'y' }), /not a PDF/);
});

// ─── external validators (best-effort, only when installed) ───────────────────

const which = (tool) => spawnSync('which', [tool], { encoding: 'utf8' }).status === 0;

test('qpdf --check accepts the incremental update', { skip: !which('qpdf') && 'qpdf not installed' }, async (t) => {
  const pdf = buildTestPdf();
  const out = await embedC2paInPdf(pdf.bytes, { title: 'qpdf check', claimGenerator: 'LollyTest/1.0', dates: DATES });
  const file = join(mkdtempSync(join(tmpdir(), 'c2pa-')), 'embedded.pdf');
  writeFileSync(file, out);
  const res = spawnSync('qpdf', ['--check', file], { encoding: 'utf8' });
  t.diagnostic(('qpdf --check: ' + (res.stdout || '') + (res.stderr || '')).trim());
  // qpdf exits 0 = clean, 3 = warnings only, 2 = errors. Warnings are ok.
  assert.ok(res.status === 0 || res.status === 3, `qpdf reported errors (exit ${res.status}):\n${res.stdout}${res.stderr}`);
});

test('c2patool parses the manifest store', { skip: !which('c2patool') && 'c2patool not installed' }, async (t) => {
  const pdf = buildTestPdf();
  const out = await embedC2paInPdf(pdf.bytes, { title: 'c2patool check', claimGenerator: 'LollyTest/1.0', dates: DATES });
  const file = join(mkdtempSync(join(tmpdir(), 'c2pa-')), 'embedded.pdf');
  writeFileSync(file, out);
  const res = spawnSync('c2patool', [file], { encoding: 'utf8' });
  const text = ((res.stdout || '') + (res.stderr || '')).trim();
  t.diagnostic(`c2patool exit ${res.status}: ${text}`);
  // Trust/validation errors are EXPECTED (ephemeral self-signed signer); only
  // structural parsing matters. Skip when this c2patool build lacks PDF read
  // support rather than fail the suite.
  if (res.status !== 0 && /not supported|unsupported|could not parse.*format/i.test(text)) {
    t.skip('this c2patool build cannot read PDFs');
    return;
  }
  assert.ok(res.status === 0 || /manifest|claim/i.test(text), `c2patool did not parse the manifest store: ${text}`);
});
