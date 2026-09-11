// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the TUI's trust-anchor assembly (trust-anchors.ts). This is the
 * module that stopped the TUI verifying the SAME bytes as untrusted while the CLI
 * (`--trust-anchor=root.pem`) called them trusted, so the cases below pin the parts a
 * wrong verdict would hinge on: which paths are pinned, that the vendored C2PA list is
 * always present, that the Lolly root IS pinned (matching the CLI validator), and that a
 * broken PEM is reported rather than silently costing the user their other anchors.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { defaultTrustAnchors } from '../../../engine/src/c2pa-verdict.ts';
import { anchorPaths, loadTrustAnchors, describeAnchors } from './trust-anchors.ts';

const DIR = await mkdtemp(join(tmpdir(), 'lolly-tui-anchors-'));
process.on('exit', () => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* best effort */ } });

// A PEM body only has to be valid base64 to reach pemToDer; nothing here verifies a
// signature, so a stub certificate is enough to exercise the assembly path.
const PEM = '-----BEGIN CERTIFICATE-----\nMIIBAgIBAA==\n-----END CERTIFICATE-----\n';
const good = join(DIR, 'corp-root.pem');
const second = join(DIR, 'partner-root.pem');
const empty = join(DIR, 'empty.pem');
await writeFile(good, PEM);
await writeFile(second, PEM);
await writeFile(empty, '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n');

const VENDORED = defaultTrustAnchors({ includeLollyRoot: false }).length;
// The built-in set this shell actually verifies against: the vendored C2PA
// known-certificate list PLUS the Lolly CA root, pinned on every surface as of
// plans/73-cli-ga-contract.md section 12 O1 (Andy, 2026-08-01).
const BUILTIN = VENDORED + 1;

test('anchorPaths reads the env var as a PATH-style list', () => {
  assert.deepEqual(anchorPaths(['/a.pem', '/b.pem'].join(delimiter), null), [
    { path: '/a.pem', from: 'env' },
    { path: '/b.pem', from: 'env' },
  ]);
});

test('anchorPaths reads the profile record as a string or an array', () => {
  assert.deepEqual(anchorPaths(undefined, { trustAnchors: '/p.pem' }), [{ path: '/p.pem', from: 'profile' }]);
  assert.deepEqual(anchorPaths(undefined, { trustAnchors: ['/x.pem', '/y.pem'] }), [
    { path: '/x.pem', from: 'profile' },
    { path: '/y.pem', from: 'profile' },
  ]);
});

test('anchorPaths puts env first and de-duplicates across both sources', () => {
  assert.deepEqual(anchorPaths('/shared.pem', { trustAnchors: ['/shared.pem', '/only-profile.pem'].join(delimiter) }), [
    { path: '/shared.pem', from: 'env' },
    { path: '/only-profile.pem', from: 'profile' },
  ]);
});

test('anchorPaths ignores blanks, whitespace and a non-string profile value', () => {
  assert.deepEqual(anchorPaths('  ', null), []);
  assert.deepEqual(anchorPaths(undefined, {}), []);
  assert.deepEqual(anchorPaths(undefined, { trustAnchors: 42 }), []);
  assert.deepEqual(anchorPaths(`${delimiter} /a.pem ${delimiter}`, null), [{ path: '/a.pem', from: 'env' }]);
});

test('with nothing pinned the anchor set is the vendored C2PA list plus the Lolly root', async () => {
  const r = await loadTrustAnchors(undefined, {});
  assert.equal(r.anchors.length, BUILTIN);
  assert.deepEqual(r.loaded, []);
  assert.deepEqual(r.failed, []);
});

test('the Lolly CA root IS pinned here, matching the CLI validator (contract section 12 O1)', async () => {
  // It used to be excluded on both terminal surfaces, so a Lolly-CA-signed export read
  // "Verified" in the browser and plain "Credential intact" here. One word, one meaning.
  const r = await loadTrustAnchors(undefined, {});
  assert.equal(r.lollyRoot, true);
  assert.deepEqual(r.anchors, defaultTrustAnchors({ includeLollyRoot: true }));
});

test('a pinned PEM is added on top of the built-in set', async () => {
  const r = await loadTrustAnchors(good, {});
  assert.equal(r.anchors.length, BUILTIN + 1);
  assert.deepEqual(r.loaded, [{ path: good, from: 'env' }]);
  assert.equal(r.vendored, VENDORED);
});

test('env and profile anchors are both pinned, in that order', async () => {
  const r = await loadTrustAnchors(good, { trustAnchors: second });
  assert.deepEqual(r.loaded.map(s => s.from), ['env', 'profile']);
  assert.equal(r.anchors.length, BUILTIN + 2);
});

test('a missing PEM is reported, not silently dropped', async () => {
  const r = await loadTrustAnchors(join(DIR, 'nope.pem'), {});
  assert.equal(r.loaded.length, 0);
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0]!.from, 'env');
  assert.match(r.failed[0]!.reason, /ENOENT|no such file/i);
});

test('one unparseable PEM does not cost the user their other anchors', async () => {
  const r = await loadTrustAnchors([empty, good].join(delimiter), {});
  assert.deepEqual(r.loaded.map(s => s.path), [good]);
  assert.deepEqual(r.failed.map(s => s.path), [empty]);
  assert.equal(r.anchors.length, BUILTIN + 1);
});

test('describeAnchors names the set, the pinned roots and the Lolly-root policy', async () => {
  const r = await loadTrustAnchors(good, {});
  const lines = describeAnchors(r).map(l => l.text);
  assert.ok(lines[0]!.includes(`C2PA known-certificate list (${VENDORED})`), String(lines[0]));
  assert.ok(lines[0]!.includes('corp-root.pem (LOLLY_TRUST_ANCHOR)'), String(lines[0]));
  assert.ok(lines[0]!.includes('· Lolly CA root'), String(lines[0]));
  assert.ok(!lines[0]!.includes('NOT pinned'), String(lines[0]));
  assert.ok(describeAnchors(r).every(l => !l.warn));
});

test('describeAnchors explains an untrusted-by-design verdict when nothing is pinned', async () => {
  const r = await loadTrustAnchors(undefined, {});
  const lines = describeAnchors(r);
  assert.ok(lines[0]!.text.includes('pinned: none'));
  assert.ok(lines.some(l => l.text.includes('LOLLY_TRUST_ANCHOR')));
});

test('describeAnchors flags a failed anchor as a warning line', async () => {
  const r = await loadTrustAnchors(join(DIR, 'nope.pem'), {});
  const warn = describeAnchors(r).filter(l => l.warn);
  assert.equal(warn.length, 1);
  assert.match(warn[0]!.text, /Trust anchor not loaded: .*nope\.pem \(env\)/);
});

test('a profile-sourced anchor is labelled as coming from the profile', async () => {
  const r = await loadTrustAnchors(undefined, { trustAnchors: good });
  assert.ok(describeAnchors(r)[0]!.text.includes('corp-root.pem (profile)'));
});
