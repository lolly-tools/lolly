// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly validate` prints Verify's six findings, over the REAL binary in a child process.
 *
 * What it pins, for a file another tool signed, a file with nothing in it and a file
 * whose metadata states a licence and a place:
 *   - the six labels print in the engine's fixed order, straight after the verdict,
 *     and a slot with nothing found still prints
 *   - every line the command printed before is still there, in the same order
 *   - exit codes are what they were: 0 for an intact credential, 5 for none
 *   - `--verbose` adds each finding's sentence, and `--json` adds a `findings` array
 *     beside the fields a script already reads
 *
 * Run with: node --test tests/verify-findings-cli.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FINDING_LABELS_IN_ORDER, SIGNED_PNG_PATH, labelPositions, licensedLocatedJpeg, plainJpeg } from './helpers/verify-findings-fixtures.ts';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'shells', 'cli', 'bin', 'lolly.ts');
const dir = await mkdtemp(join(tmpdir(), 'lolly-findings-cli-'));
after(() => rm(dir, { recursive: true, force: true }));
const PLAIN = join(dir, 'plain.jpg');
const LICENSED = join(dir, 'licensed.jpg');
await writeFile(PLAIN, plainJpeg());
await writeFile(LICENSED, licensedLocatedJpeg());

function validate(args: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((done, fail) => {
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', LOLLY_STATE_DIR: dir };
    delete env.LOLLY_TRUST_ANCHOR;
    delete env.DEBUG;
    const child = spawn(process.execPath, [BIN, 'validate', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
    child.on('error', fail);
    child.on('close', (code) => done({ code, out }));
  });
}

const isFinding = (line: string): boolean => FINDING_LABELS_IN_ORDER.some((label) => line.startsWith(`  ${label}: `));
const findingLines = (out: string): string[] => out.split('\n').filter(isFinding);
const otherLines = (out: string): string[] => out.split('\n').filter((line) => line && !isFinding(line));

test('a file another tool signed: six findings after the verdict, every earlier line kept', async () => {
  const { code, out } = await validate([SIGNED_PNG_PATH]);
  assert.equal(code, 0, 'an intact credential still exits 0');
  labelPositions(out);
  assert.deepEqual(findingLines(out), [
    '  Credential: Unchanged, signer not recognised (Signed)',
    '  Made with: c2patool 0.26.68 (Signed)',
    '  AI: Nothing declared',
    '  Licence: None recorded',
    '  Personal data: None found',
    '  Hidden content: None found',
  ]);
  const rest = otherLines(out);
  assert.match(rest.at(-1)!, /^ {2}Trust anchors: /);
  assert.deepEqual(rest.slice(0, -1), [
    `${SIGNED_PNG_PATH}  [png]`,
    '✓ Credential intact - signed on-device (integrity, not identity)',
    '  (fields below are self-asserted by whoever signed the file)',
    '  Title       c2patool cross-validation fixture',
    '  Made with   c2patool 0.26.68',
    '  Signer      c2patool cross-validation test signer',
    '  Issuer      Lolly Test Fixtures (self-signed)',
    '  Algorithm   ES256',
    '  Manifest    urn:c2pa:d500954c-8bce-461a-a615-3a7fa66ec63a',
    '  ✓ assertion.hashedURI.match  - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.hash.data',
    '  ✓ assertion.hashedURI.match  - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.thumbnail.claim',
    '  ✓ assertion.hashedURI.match  - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.actions.v2',
    '  ✓ claimSignature.validated  - claim signature valid',
    '  ✓ claimSignature.insideValidity  - signing certificate within its validity window',
    '  ✓ assertion.dataHash.match  - data hash valid',
    '  ℹ signingCredential.untrusted  - signing certificate untrusted - a self-signed certificate, which vouches only for itself (pin it as a trust anchor to verify the identity)',
  ], 'the lines this command printed before the findings are unchanged');
  // The findings sit between the verdict and the facts, not after the report.
  const lines = out.split('\n');
  assert.equal(lines.findIndex(isFinding), 2);
});

test('a file with nothing in it: all six slots still print, and the exit code is still 5', async () => {
  const { code, out } = await validate([PLAIN]);
  assert.equal(code, 5);
  assert.deepEqual(out.split('\n').filter(Boolean), [
    `${PLAIN}  [jpeg]`,
    '○ No Content Credentials found',
    '  no Content Credentials found',
    '  Credential: Not signed',
    '  Made with: Not identified',
    '  AI: Nothing declared',
    '  Licence: None recorded',
    '  Personal data: None found',
    '  Hidden content: None found',
  ]);
});

test('a licence and a place in the metadata are stated, never signed', async () => {
  const { code, out } = await validate([LICENSED]);
  assert.equal(code, 5, 'metadata never changes the credential exit code');
  assert.deepEqual(findingLines(out), [
    '  Credential: Not signed',
    '  Made with: TestCam (Stated in the file)',
    '  AI: Nothing declared',
    '  Licence: CC BY 4.0 (Stated in the file)',
    '  Personal data: Location recorded (Stated in the file)',
    '  Hidden content: None found',
  ]);
  assert.deepEqual(otherLines(out), [`${LICENSED}  [jpeg]`, '○ No Content Credentials found', '  no Content Credentials found']);
  assert.doesNotMatch(out, /%|royalty-free|cleared|legally safe|copyright verified/i);
});

test('--verbose prints each finding sentence under its line', async () => {
  const { code, out } = await validate([LICENSED, '--verbose']);
  assert.equal(code, 5);
  const lines = out.split('\n');
  const at = lines.indexOf('  Licence: CC BY 4.0 (Stated in the file)');
  assert.ok(at > 0);
  assert.equal(lines[at + 1], '    Declared terms: CC BY 4.0. Permission to reuse is not verified.');
  assert.equal(lines[lines.indexOf('  AI: Nothing declared') + 1], '    No AI declaration and no known AI packaging. No text was analysed.');
});

test('--json adds a findings array beside the fields a script already reads', async () => {
  const { code, out } = await validate([SIGNED_PNG_PATH, LICENSED, '--json']);
  assert.equal(code, 5, 'the worst file still decides the exit code');
  const doc = JSON.parse(out) as { result: { files: Array<Record<string, unknown>> } };
  const [signed, licensed] = doc.result.files;
  for (const record of [signed!, licensed!]) {
    for (const key of ['file', 'ok', 'verdict', 'resolved', 'report', 'metadata', 'anchors']) assert.ok(key in record, `${key} is still in the record`);
    const findings = record.findings as Array<Record<string, unknown>>;
    assert.deepEqual(findings.map((f) => f.id), ['credential', 'made-with', 'ai', 'licence', 'personal', 'hidden']);
    assert.deepEqual(findings.map((f) => f.label), [...FINDING_LABELS_IN_ORDER]);
    for (const f of findings) {
      assert.deepEqual(Object.keys(f), ['id', 'label', 'state', 'tone', 'strength', 'strengthLabel', 'word', 'detail', 'names', 'evidence']);
      assert.doesNotMatch(`${f.word} ${f.detail}`, /\{\w+\}/, 'placeholders are filled');
    }
  }
  assert.equal(signed!.verdict, 'credential-intact');
  assert.equal(licensed!.metadata, null, 'the file report still runs only under --metadata');
  const licence = (licensed!.findings as Array<Record<string, unknown>>)[3]!;
  assert.deepEqual({ state: licence.state, strength: licence.strength, word: licence.word }, { state: 'licence', strength: 'stated', word: 'CC BY 4.0' });
  assert.deepEqual(licence.evidence, [{ label: 'Rights', value: 'https://creativecommons.org/licenses/by/4.0/', source: 'XMP/RDF dc:rights', strength: 'stated' }]);
  const personal = (licensed!.findings as Array<Record<string, unknown>>)[4]!;
  assert.equal(personal.state, 'location');
  assert.equal(personal.detail, 'The file records where it was made: 37.8083, -122.4167.');
});
