// Cross-validator conformance, the OTHER direction from c2pa-c2patool-conformance.test.ts:
// that suite proves Lolly's WRITER validates in c2patool; this proves Lolly's READER
// (verifyC2pa) correctly parses a manifest it never wrote — a genuinely independent CBOR/
// COSE/JUMBF/X.509 encoder (c2pa-rs, via the c2patool CLI), not Lolly's own round-trip.
// Interop bugs in either encoder's byte-level choices (box ordering, padding, CBOR map key
// order, …) would only surface against a FOREIGN producer — a self-round-trip can't catch
// them. Ungated: the fixture is a committed binary, so this runs on every `npm test` with
// no c2patool dependency at test time (unlike the sibling suite, which needs c2patool on
// PATH to exercise the write→validate direction).
//
// Fixture: tests/fixtures/c2patool-signed.png — a 16x16 PNG, C2PA-signed by c2patool
// 0.26.68 (c2pa-rs 0.89.0) with a throwaway ES256 self-signed test certificate (never used
// to protect anything real; not committed — regenerate with the recipe below if the
// fixture ever needs refreshing).
//
// Regeneration recipe:
//   openssl ecparam -name prime256v1 -genkey -noout -out test_private.key
//   openssl req -new -x509 -key test_private.key -out test_certs.pem -days 3650 \
//     -subj "/O=Lolly Test Fixtures/CN=c2patool cross-validation test signer" \
//     -addext "basicConstraints=critical,CA:FALSE" \
//     -addext "keyUsage=critical,digitalSignature,nonRepudiation" \
//     -addext "extendedKeyUsage=critical,emailProtection"
//   # manifest.json: { claim_generator, title, format: "image/png", alg: "es256",
//   #   sign_cert: "test_certs.pem", private_key: "test_private.key",
//   #   thumbnail: { format: "image/png", identifier: "<a small host png>" },
//   #   assertions: [{ label: "c2pa.actions", data: { actions: [{ action: "c2pa.created" }] } }] }
//   # `--create empty` is REQUIRED: without it c2patool auto-adds a parentOf ingredient
//   # whose auto-generated thumbnail balloons the file by ~600KB regardless of source size.
//   c2patool <host.png> -m manifest.json --create empty -o c2patool-signed.png --force
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyC2pa } from '../engine/src/index.ts';

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/c2patool-signed.png', import.meta.url)));

test('verifyC2pa reads a c2patool/c2pa-rs-produced manifest correctly (foreign producer, not a Lolly round-trip)', async () => {
  const report = await verifyC2pa(new Uint8Array(FIXTURE));

  assert.equal(report.found, true);
  assert.equal(report.state, 'valid', 'the hard binding + claim signature must check out against a manifest Lolly never wrote');
  assert.equal(report.trusted, false, 'the test cert is self-signed and not in any trust anchor list Lolly pins');
  assert.equal(report.madeWithLolly, false);

  // The claim generator proves this really is foreign-produced, not an accidental
  // self-round-trip fixture.
  assert.equal(report.claim?.generatorInfo?.name, 'c2patool');
  assert.equal(report.claim?.title, 'c2patool cross-validation fixture');

  assert.equal(report.signer?.selfSigned, true);
  assert.equal(report.signer?.commonName, 'c2patool cross-validation test signer');
  assert.equal(report.signer?.organization, 'Lolly Test Fixtures');
  assert.equal(report.signer?.alg, 'ES256');

  // Every real check must pass; the only failure is the always-expected untrusted marker
  // for a self-signed key (the designed posture, not damage — see valid-verdict.ts's
  // isExpectedRow / STATE_COPY.valid).
  const fails = report.checks.filter((c) => !c.ok);
  assert.deepEqual(fails.map((c) => c.code), ['signingCredential.untrusted']);
  assert.ok(report.checks.some((c) => c.ok && c.code === 'claimSignature.validated'));
  assert.ok(report.checks.some((c) => c.ok && c.code === 'assertion.dataHash.match'));

  assert.deepEqual(report.history?.map((h) => h.action), ['c2pa.created']);
});
