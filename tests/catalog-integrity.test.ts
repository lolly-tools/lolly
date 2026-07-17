/**
 * Catalog signing + runtime integrity contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in.
 *
 * Exercises the whole trust chain in memory with an ephemeral P-256 keypair:
 * canonical JSON determinism, sign → verify roundtrip, tamper detection on
 * tool files / index bytes / envelope fields, and — the part that matters —
 * loadTool refusing to return a tool whose fetched bytes don't match the
 * signed digest map (fail CLOSED: tampered hooks.js, stripped-but-signed
 * hooks.js, unsigned extra files, module hooks). The unsigned path must keep
 * working exactly as before, with a single console warning per process.
 *
 * i18n sidecars (i18n/<lang>.json) are signed too, with a softer failure mode:
 * an unverifiable overlay is dropped (tool loads in English), never applied,
 * and never fails the tool — including under an old pre-sidecar envelope.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import {
  canonicalJson, sha256Hex, jwkThumbprint, importSpkiOrJwkPublicKey,
  signCatalogEnvelope, verifyEnvelopeSignature, verifyCatalogEnvelope, verifyToolFile,
  CATALOG_SIG_ALG,
} from '../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../engine/src/catalog-integrity.ts';
import { loadTool, ToolLoadError } from '../engine/src/loader.ts';
import { derToPem } from '../engine/src/x509.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

// One ephemeral signing keypair for the whole file.
const { privateKey, publicKey } = await subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
);

// ─── a tiny in-memory catalog ─────────────────────────────────────────────────

const MANIFEST = {
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  engineVersion: '^1.0.0',
  status: 'official',
  render: { width: 10, height: 10, formats: ['svg'] },
  inputs: [{ id: 'title', type: 'text', default: 'hi' }],
  hooks: { onInit: true },
};

const TOOL_FILES: Record<string, string> = {
  'demo/tool.json': JSON.stringify(MANIFEST),
  'demo/template.html': '<div class="demo">{{title}}</div>',
  'demo/styles.css': '.demo { color: rebeccapurple; }',
  'demo/hooks.js': 'return { onInit() { return { title: "hooked" }; } };',
};

const INDEX_BYTES = te.encode(JSON.stringify({ version: '1', tools: [{ id: 'demo' }] }));

// A German sidecar + the same catalog with it present, for the i18n tests.
const SIDECAR_DE = JSON.stringify({ name: 'Démo', 'inputs.title.label': 'Titel' });
const TOOL_FILES_I18N: Record<string, string> = {
  ...TOOL_FILES,
  'demo/i18n/de.json': SIDECAR_DE,
};

/** Sign an envelope over the given files + index (defaults to the fixtures). */
async function makeEnvelope(
  files: Record<string, string> = TOOL_FILES,
  indexBytes: Uint8Array = INDEX_BYTES,
): Promise<CatalogSignatureEnvelope> {
  const map: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    map[path] = await sha256Hex(te.encode(text));
  }
  return signCatalogEnvelope({
    alg: CATALOG_SIG_ALG,
    keyId: await jwkThumbprint(await subtle.exportKey('jwk', publicKey)),
    signedAt: '2026-07-08T00:00:00.000Z',
    indexHash: await sha256Hex(indexBytes),
    files: map,
  }, privateKey);
}

/** A loader fetchFile serving the given in-memory files (missing → throws). */
function makeFetchFile(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    const text = files[path];
    if (text === undefined) throw new Error(`404: ${path}`);
    return text;
  };
}

// ─── canonical JSON ───────────────────────────────────────────────────────────

test('canonicalJson is stable under key reordering, recursively', () => {
  const a = { b: 1, a: { d: [1, { z: 0, y: null }], c: 'x' } };
  const b = { a: { c: 'x', d: [1, { y: null, z: 0 }] }, b: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(canonicalJson(a), '{"a":{"c":"x","d":[1,{"y":null,"z":0}]},"b":1}');
});

test('canonicalJson emits no whitespace and drops undefined members', () => {
  assert.equal(canonicalJson({ b: undefined, a: 1 }), '{"a":1}');
  assert.equal(canonicalJson([1, 'two', true, null]), '[1,"two",true,null]');
  assert.equal(canonicalJson('a "quote"'), '"a \\"quote\\""');
});

// ─── sign → verify roundtrip ──────────────────────────────────────────────────

test('signed envelope verifies against the index bytes and public key', async () => {
  const envelope = await makeEnvelope();
  const result = await verifyCatalogEnvelope(envelope, INDEX_BYTES, publicKey);
  assert.deepEqual(result, { ok: true });
});

test('every signed tool file verifies; a single flipped byte fails', async () => {
  const envelope = await makeEnvelope();
  for (const [path, text] of Object.entries(TOOL_FILES)) {
    const [toolId, filename] = path.split('/') as [string, string];
    const ok = await verifyToolFile(envelope, toolId, filename, te.encode(text));
    assert.equal(ok.ok, true, path);
  }
  const tampered = TOOL_FILES['demo/hooks.js']!.replace('hooked', 'hackEd');
  const bad = await verifyToolFile(envelope, 'demo', 'hooks.js', te.encode(tampered));
  assert.equal(bad.ok, false);
  assert.match(bad.reason!, /demo\/hooks\.js.*signed digest/);
});

test('tampered index bytes fail the envelope check', async () => {
  const envelope = await makeEnvelope();
  const tampered = te.encode(JSON.stringify({ version: '1', tools: [{ id: 'evil' }] }));
  const result = await verifyCatalogEnvelope(envelope, tampered, publicKey);
  assert.equal(result.ok, false);
  assert.match(result.reason!, /signed hash/);
});

test('a file absent from the signed map fails (no unsigned extras)', async () => {
  const envelope = await makeEnvelope();
  const result = await verifyToolFile(envelope, 'demo', 'template.ics', te.encode('BEGIN:VCALENDAR'));
  assert.equal(result.ok, false);
  assert.match(result.reason!, /not in the signed catalog/);
});

test('editing any envelope field after signing breaks the signature', async () => {
  const envelope = await makeEnvelope();
  const cases: CatalogSignatureEnvelope[] = [
    { ...envelope, signedAt: '2027-01-01T00:00:00.000Z' },
    { ...envelope, files: { ...envelope.files, 'evil/hooks.js': envelope.files['demo/hooks.js']! } },
    { ...envelope, extra: 'field' } as CatalogSignatureEnvelope,
  ];
  for (const tampered of cases) {
    const result = await verifyEnvelopeSignature(tampered, publicKey);
    assert.equal(result.ok, false);
    assert.match(result.reason!, /does not verify/);
  }
  // …and the untouched envelope still passes with the same verifier.
  assert.equal((await verifyEnvelopeSignature(envelope, publicKey)).ok, true);
});

test('an envelope signed by a different key is rejected', async () => {
  const other = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const envelope = await makeEnvelope();
  const result = await verifyCatalogEnvelope(envelope, INDEX_BYTES, other.publicKey);
  assert.equal(result.ok, false);
});

test('public key imports from JWK object, JWK string and SPKI PEM alike', async () => {
  const jwk = await subtle.exportKey('jwk', publicKey);
  const spkiPem = derToPem(new Uint8Array(await subtle.exportKey('spki', publicKey)), 'PUBLIC KEY');
  const envelope = await makeEnvelope();
  for (const form of [jwk, JSON.stringify(jwk), spkiPem]) {
    const imported = await importSpkiOrJwkPublicKey(form);
    assert.equal((await verifyCatalogEnvelope(envelope, INDEX_BYTES, imported)).ok, true);
  }
});

// ─── loader enforcement (the runtime gate) ────────────────────────────────────

test('loadTool succeeds with integrity when every byte matches', async () => {
  const envelope = await makeEnvelope();
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES), { integrity: { envelope, publicKey } });
  assert.equal(tool.manifest.id, 'demo');
  assert.equal(tool.hooksSource, TOOL_FILES['demo/hooks.js']);
  assert.equal(tool.styles, TOOL_FILES['demo/styles.css']);
});

test('loadTool refuses a tampered hooks.js (hard error, before any execution)', async () => {
  const envelope = await makeEnvelope();
  const files = { ...TOOL_FILES, 'demo/hooks.js': 'return { onInit() { return { title: "evil" }; } };' };
  await assert.rejects(
    loadTool('demo', makeFetchFile(files), { integrity: { envelope, publicKey } }),
    (e: unknown) => e instanceof ToolLoadError && /catalog integrity.*hooks\.js/.test(e.message),
  );
});

test('loadTool refuses when a signed hooks.js fails to fetch (no silent strip)', async () => {
  const envelope = await makeEnvelope();
  const { 'demo/hooks.js': _stripped, ...files } = TOOL_FILES;
  await assert.rejects(
    loadTool('demo', makeFetchFile(files), { integrity: { envelope, publicKey } }),
    (e: unknown) => e instanceof ToolLoadError && /signed in the catalog but failed to load/.test(e.message),
  );
});

test('loadTool refuses a fetched file the catalog never signed', async () => {
  const { 'demo/styles.css': _unsigned, ...signedSubset } = TOOL_FILES;
  const envelope = await makeEnvelope(signedSubset);
  await assert.rejects(
    loadTool('demo', makeFetchFile(TOOL_FILES), { integrity: { envelope, publicKey } }),
    (e: unknown) => e instanceof ToolLoadError && /styles\.css.*not in the signed catalog/.test(e.message),
  );
});

test('loadTool refuses a tampered manifest before trusting anything it declares', async () => {
  const envelope = await makeEnvelope();
  const files = { ...TOOL_FILES, 'demo/tool.json': JSON.stringify({ ...MANIFEST, name: 'Demo ' }) };
  await assert.rejects(
    loadTool('demo', makeFetchFile(files), { integrity: { envelope, publicKey } }),
    (e: unknown) => e instanceof ToolLoadError && /tool\.json/.test(e.message),
  );
});

// NOTE: the loader also refuses `hooks.module` tools under integrity (their
// imported bytes never pass through loadTool, so digests can't cover them) —
// untestable through loadTool today because schemas/tool.schema.json doesn't
// yet admit `hooks.module`; the guard is defense-in-depth for when it does.

test('a rejected envelope poisons every load that presents it', async () => {
  const envelope = await makeEnvelope();
  const forged = { ...envelope, keyId: 'someone-else' };
  for (const toolId of ['demo', 'demo']) { // twice: the cached verdict must stay closed
    await assert.rejects(
      loadTool(toolId, makeFetchFile(TOOL_FILES), { integrity: { envelope: forged, publicKey } }),
      (e: unknown) => e instanceof ToolLoadError && /envelope rejected/.test(e.message),
    );
  }
});

test('unsigned path still loads, warning exactly once per process', async () => {
  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')); };
  try {
    const first = await loadTool('demo', makeFetchFile(TOOL_FILES));
    const second = await loadTool('demo', makeFetchFile(TOOL_FILES));
    assert.equal(first.hooksSource, TOOL_FILES['demo/hooks.js']);
    assert.equal(second.manifest.id, 'demo');
  } finally {
    console.warn = realWarn;
  }
  const integrityWarnings = warnings.filter(w => w.includes('unsigned catalog'));
  assert.equal(integrityWarnings.length, 1);
});

// ─── i18n sidecars under a signed catalog ─────────────────────────────────────
// (These stay AFTER the once-per-process warning test above: its unsigned
// loadTool call must be the first one the process makes.)

test('a signed i18n sidecar verifies and its translations apply', async () => {
  const envelope = await makeEnvelope(TOOL_FILES_I18N);
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES_I18N), {
    integrity: { envelope, publicKey }, lang: 'de',
  });
  assert.equal(tool.manifest.name, 'Démo');
  assert.equal((tool.manifest.inputs[0] as { label?: string }).label, 'Titel');
});

test('a tampered sidecar is dropped — tool loads in English, no throw', async () => {
  const envelope = await makeEnvelope(TOOL_FILES_I18N);
  const files = { ...TOOL_FILES_I18N, 'demo/i18n/de.json': JSON.stringify({ name: 'Böse' }) };
  const tool = await loadTool('demo', makeFetchFile(files), {
    integrity: { envelope, publicKey }, lang: 'de',
  });
  assert.equal(tool.manifest.name, 'Demo');
});

test('an envelope signed before sidecars existed loads in English (compat, no throw)', async () => {
  const envelope = await makeEnvelope(TOOL_FILES); // no demo/i18n/de.json digest
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES_I18N), {
    integrity: { envelope, publicKey }, lang: 'de',
  });
  assert.equal(tool.manifest.name, 'Demo');
});

test('a signed-but-stripped sidecar downgrades to English, never fails the tool', async () => {
  const envelope = await makeEnvelope(TOOL_FILES_I18N);
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES), { // sidecar 404s
    integrity: { envelope, publicKey }, lang: 'de',
  });
  assert.equal(tool.manifest.name, 'Demo');
});

test('a no-sidecar tool with a lang set signs and loads exactly as before', async () => {
  const envelope = await makeEnvelope();
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES), {
    integrity: { envelope, publicKey }, lang: 'de',
  });
  assert.equal(tool.manifest.name, 'Demo');
  assert.equal(tool.hooksSource, TOOL_FILES['demo/hooks.js']);
});

test('unsigned path still applies a sidecar overlay (unchanged behavior)', async () => {
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES_I18N), { lang: 'de' });
  assert.equal(tool.manifest.name, 'Démo');
});

test('sign-catalog.ts digests i18n sidecars into the envelope (end to end)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-sign-'));
  const toolDir = join(dir, 'tools', 'demo');
  mkdirSync(join(toolDir, 'i18n'), { recursive: true });
  for (const [path, text] of Object.entries(TOOL_FILES_I18N)) {
    writeFileSync(join(dir, 'tools', path), text);
  }
  writeFileSync(join(toolDir, 'i18n', 'README.txt'), 'not a sidecar'); // must NOT be signed
  const indexPath = join(dir, 'index.json');
  writeFileSync(indexPath, Buffer.from(INDEX_BYTES));
  const keyPath = join(dir, 'key.jwk.json');
  writeFileSync(keyPath, JSON.stringify(await subtle.exportKey('jwk', privateKey)));
  const outPath = join(dir, 'index.sig.json');
  execFileSync(process.execPath, [
    join(ROOT, 'scripts/sign-catalog.ts'),
    '--keyfile', keyPath, '--tools', join(dir, 'tools'), '--index', indexPath, '--out', outPath,
  ], { stdio: 'pipe' });
  const envelope = JSON.parse(readFileSync(outPath, 'utf8')) as CatalogSignatureEnvelope;
  assert.ok(envelope.files['demo/i18n/de.json'], 'sidecar digest missing from envelope');
  assert.equal(envelope.files['demo/i18n/README.txt'], undefined);
  assert.equal((await verifyCatalogEnvelope(envelope, INDEX_BYTES, publicKey)).ok, true);
  // The envelope the script wrote drives the loader: translations apply.
  const tool = await loadTool('demo', makeFetchFile(TOOL_FILES_I18N), {
    integrity: { envelope, publicKey }, lang: 'de',
  });
  assert.equal(tool.manifest.name, 'Démo');
});
