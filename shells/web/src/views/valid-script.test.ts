// SPDX-License-Identifier: MPL-2.0
/**
 * The /verify Script panel (scriptHtml in valid.ts): a recorded action whose
 * `parameters` carry a `script` string is a synthetic voice declaring its
 * source text (the TTS credential written at creation - the machine-readable
 * EU AI Act Article 50 mark), and the panel must surface it faithfully:
 * Map-shaped parameters (our CBOR decoder) and plain objects (a foreign
 * report) both read, every interpolation escaped (the script is attacker-
 * controlled bytes out of a file), long scripts clamped behind an expand
 * button, and silence when no step recorded a script.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/valid-script.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
// valid.ts reads `window.__toolIndex` - same type-only augmentation trick as
// valid-appended.test.ts (nothing executes from sync.ts at runtime).
import type {} from '../catalog/sync.ts';
import { scriptHtml, previewKind } from './valid.ts';

const report = (over: Record<string, unknown>): any => ({
  found: true, state: 'valid', trusted: true, madeWithLolly: true, likelyMadeWithLolly: false,
  partsMadeWithLolly: false, delivered: false, format: 'mp4', checks: [],
  claim: { title: 't', format: 'f', claimGenerator: 'g', generatorInfo: null, instanceId: 'i', manifestLabel: 'm', actions: [] },
  ...over,
});

const ttsStep = (params: unknown): any => ({
  action: 'c2pa.created', when: '2026-08-02T00:00:00Z', softwareAgent: 'Lolly',
  digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  parameters: params,
});

test('Map-shaped parameters (our CBOR decoder) render script, recipe and copy button', () => {
  const params = new Map<string, unknown>([
    ['script', 'Hello from Lolly.'], ['voice', 'af_heart'], ['model', 'kokoro-82m-q8'], ['lang', 'en'],
  ]);
  const html = scriptHtml(report({ history: [ttsStep(params)] }));
  assert.ok(html.includes('Hello from Lolly.'), 'the script text shows');
  assert.ok(html.includes('af_heart') && html.includes('kokoro-82m-q8') && html.includes('>en<'), 'the recipe rows show');
  assert.ok(html.includes('data-script-copy'), 'copy affordance present');
  assert.ok(!html.includes('data-script-expand'), 'a short script needs no expand');
  assert.ok(!html.includes('is-clamped'));
});

test('plain-object parameters on claim.actions (no history) render too', () => {
  const r = report({});
  r.claim.actions = [ttsStep({ script: 'Object shaped.', voice: 'v' })];
  const html = scriptHtml(r);
  assert.ok(html.includes('Object shaped.'));
});

test('a hostile script is escaped at the sink', () => {
  const html = scriptHtml(report({ history: [ttsStep({ script: '<img src=x onerror=alert(1)> & "quotes"' })] }));
  assert.ok(!html.includes('<img'), 'markup in the script never reaches the DOM raw');
  assert.ok(html.includes('&lt;img'), 'it is escaped, not dropped');
});

test('a long script starts clamped with an expand button', () => {
  const html = scriptHtml(report({ history: [ttsStep({ script: Array.from({ length: 12 }, (_, i) => `Line ${i}.`).join('\n') })] }));
  assert.ok(html.includes('is-clamped'));
  assert.ok(html.includes('data-script-expand'));
});

test('no recorded script, non-string or empty script → no panel', () => {
  assert.equal(scriptHtml(report({})), '');
  assert.equal(scriptHtml(report({ history: [ttsStep(undefined)] })), '');
  assert.equal(scriptHtml(report({ history: [ttsStep({ script: 42 })] })), '');
  assert.equal(scriptHtml(report({ history: [ttsStep({ script: '   ' })] })), '');
});


// ── text/markdown uploads → AI-provenance path (plans/125) ───────────────────

test('a .txt / .md upload is a text preview even with no sniffed C2PA format', () => {
  // verifyC2pa returns format:null for a plain text/markdown file (no carrier), so
  // the AI-provenance analysis must key off the extension, not just the sniff.
  assert.equal(previewKind(null, 'notes.md'), 'text');
  assert.equal(previewKind(null, 'poem.txt'), 'text');
  assert.equal(previewKind(null, 'README.markdown'), 'text');
  // The sniffed C2PA text carriers still resolve to text.
  assert.equal(previewKind('text', 'x'), 'text');
  assert.equal(previewKind('code', 'x'), 'text');
  // A real non-text format wins over a misleading extension (a PNG named .md).
  assert.equal(previewKind('png', 'trick.md'), 'image');
  // A binary/unknown with no text extension stays 'none'.
  assert.equal(previewKind(null, 'thing.bin'), 'none');
});
