// Cross-validator conformance: prove Lolly's C2PA output (the honest multi-action
// history AND the multi-manifest ingredient-preservation store) validates in the
// reference implementation, not just Lolly's own verifier. Runs the `c2patool`
// CLI (github.com/contentauth/c2pa-rs) over freshly-embedded PNGs and asserts
// validation_state === 'Valid' with no status beyond the expected self-signed
// `signingCredential.untrusted` markers (an ephemeral on-device key is untrusted
// by design; a CA signer or pinned trust list clears those).
//
// SKIPS cleanly when c2patool isn't on PATH — so `npm test` stays green on a
// machine without it. Install locally with `brew install c2patool` (or
// `cargo install c2patool`) to exercise it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { embedC2pa, exportActionSteps, prepareC2paIngredient } from '../engine/src/index.ts';

const AI_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
const hasC2patool = spawnSync('c2patool', ['--version']).status === 0;
const HOST_PNG = readFileSync(fileURLToPath(new URL('../shells/web/public/icons/icon-192.png', import.meta.url)));
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };
const GEN = { name: 'Lolly', version: 'test' };

// Run c2patool over the bytes; return its verdict + any non-trust status codes.
function c2paVerdict(bytes: Uint8Array): { state: string; beyondTrust: string[] } {
  const file = join(mkdtempSync(join(tmpdir(), 'lolly-c2pa-')), 'out.png');
  writeFileSync(file, bytes);
  const r = spawnSync('c2patool', [file], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  assert.equal(r.status, 0, `c2patool exited ${r.status}: ${r.stderr}`);
  const report = JSON.parse(r.stdout) as { validation_state?: string; validation_status?: { code: string }[] };
  const beyondTrust = (report.validation_status ?? [])
    .map((s) => s.code)
    .filter((code) => code !== 'signingCredential.untrusted');
  return { state: report.validation_state ?? '(none)', beyondTrust };
}

test('Tier-1: honest multi-action manifest validates in c2patool', { skip: !hasC2patool && 'c2patool not installed' }, async () => {
  const out = await embedC2pa(new Uint8Array(HOST_PNG), 'png', {
    claimGenerator: 'Lolly lolly.tools', generatorInfo: GEN,
    actions: exportActionSteps('png', { cmyk: true, paletteColors: 3, marks: ['3mm bleed', 'crop marks'], watermarked: true, imprint: true, audio: true }),
    dates: DATES,
  });
  const { state, beyondTrust } = c2paVerdict(out);
  assert.equal(state, 'Valid');
  assert.deepEqual(beyondTrust, [], `unexpected c2patool statuses: ${beyondTrust.join(', ')}`);
});

test('Tier-1: a live-capture + text-added manifest validates in c2patool', { skip: !hasC2patool && 'c2patool not installed' }, async () => {
  // A recorder-style export: created essence captured from camera+mic (IPTC
  // digitalCapture), text placed over it, encoded to a raster. Proves the new
  // capture source type and the c2pa.edited "Added text" step are spec-clean.
  const out = await embedC2pa(new Uint8Array(HOST_PNG), 'png', {
    claimGenerator: 'Lolly lolly.tools', generatorInfo: GEN,
    actions: exportActionSteps('png', {
      capture: { camera: true, microphone: true },
      textAdded: true, textSample: 'BREAKING: live on the scene',
    }),
    dates: DATES,
  });
  const { state, beyondTrust } = c2paVerdict(out);
  assert.equal(state, 'Valid');
  assert.deepEqual(beyondTrust, [], `unexpected c2patool statuses: ${beyondTrust.join(', ')}`);
});

test('Ingredient preservation: multi-manifest store validates in c2patool', { skip: !hasC2patool && 'c2patool not installed' }, async () => {
  // A synthetic AI-generated source — a credential whose created action is
  // trainedAlgorithmicMedia — so the test is self-contained (no external fixture).
  const aiSource = await embedC2pa(new Uint8Array(HOST_PNG), 'png', {
    claimGenerator: 'Some AI Model', generatorInfo: { name: 'Some AI Model', version: 'test' },
    actions: [{ action: 'c2pa.created', digitalSourceType: AI_SOURCE_TYPE }],
    dates: DATES,
  });
  const ingredient = prepareC2paIngredient(aiSource);
  assert.ok(ingredient, 'prepareC2paIngredient should read the source credential');
  assert.equal(ingredient!.digitalSourceType, AI_SOURCE_TYPE, 'AI source type should be detected');

  const out = await embedC2pa(new Uint8Array(HOST_PNG), 'png', {
    title: 'Composite', claimGenerator: 'Lolly lolly.tools', generatorInfo: GEN,
    actions: exportActionSteps('png', {}), ingredients: [ingredient!],
    dates: DATES,
  });
  const { state, beyondTrust } = c2paVerdict(out);
  assert.equal(state, 'Valid', 'the multi-manifest ingredient store must validate');
  assert.deepEqual(beyondTrust, [], `unexpected c2patool statuses: ${beyondTrust.join(', ')}`);
});
