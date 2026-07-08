/**
 * Unit + cross-container equivalence tests for engine/src/brand-import.ts —
 * the container-extraction layer that reassembles a Penpot/Tokens-Studio
 * token document out of the three shapes Penpot exports it in (monolithic
 * tokens.json, one-file-per-set, .penpot project zip).
 *
 * Run with: node --test tests/brand-import.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  coerceTokensDoc,
  assembleTokenSetFiles,
  extractPenpotProject,
  summarizeTokensDoc,
} from '../engine/src/brand-import.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Real Penpot export samples live outside the repo (not checked in — see the
// task that added this suite); CI and other machines won't have them.
const MATERIALS_DIR = '/Users/andy/Desktop/penpot-start';
const SKIP_MATERIALS = !existsSync(MATERIALS_DIR) && 'penpot-start example materials not on this machine';

// ── coerceTokensDoc ─────────────────────────────────────────────────────────

test('coerceTokensDoc: a Tokens-Studio doc ($themes + $metadata, 2 sets) is source "tokens-studio"', () => {
  const doc = {
    global: { color: { brand: { $value: '#ff0000', $type: 'color' } } },
    dark: { color: { brand: { $value: '#880000', $type: 'color' } } },
    $themes: [{ name: 'Light', selectedTokenSets: { global: 'enabled' } }],
    $metadata: { tokenSetOrder: ['global', 'dark'] },
  };
  const r = coerceTokensDoc(doc);
  assert.equal(r.source, 'tokens-studio');
  assert.equal(r.doc, doc);
  assert.deepEqual(r.warnings, []);
});

test('coerceTokensDoc: a plain DTCG group doc (no $themes/$metadata) is source "dtcg"', () => {
  const doc = { color: { brand: { $value: '#ff0000', $type: 'color' } } };
  const r = coerceTokensDoc(doc);
  assert.equal(r.source, 'dtcg');
  assert.equal(r.doc, doc);
  assert.deepEqual(r.warnings, []);
});

test('coerceTokensDoc: non-object input → doc null + a typed warning', () => {
  for (const [input, expectedType] of [
    [null, 'null'],
    [[1, 2], 'an array'],
    ['nope', 'a string'],
    [42, 'a number'],
  ] as const) {
    const r = coerceTokensDoc(input);
    assert.equal(r.doc, null);
    assert.equal(r.warnings.length, 1);
    assert.ok(r.warnings[0]!.includes(expectedType), `expected warning to mention ${expectedType}, got: ${r.warnings[0]}`);
  }
});

// ── assembleTokenSetFiles ────────────────────────────────────────────────────

test('assembleTokenSetFiles: reassembles set names (incl. "/" subdir names), lifts $themes/$metadata, warns on a stray non-json key', () => {
  const files: Record<string, unknown> = {
    'Foundations.json': { color: { brand: { $value: '#ff0000', $type: 'color' } } },
    'Color theme/Muted.json': { accent: { $value: '#00ff00', $type: 'color' } },
    '$themes.json': [{ name: 'Light', selectedTokenSets: { Foundations: 'enabled' } }],
    '$metadata.json': { tokenSetOrder: ['Foundations', 'Color theme/Muted'] },
    'readme.txt': 'not json',
  };
  const r = assembleTokenSetFiles(files);
  assert.equal(r.source, 'token-set-files');
  assert.ok(r.doc);
  assert.deepEqual(Object.keys(r.doc!).sort(), ['$metadata', '$themes', 'Color theme/Muted', 'Foundations']);
  assert.deepEqual(r.doc!['Color theme/Muted'], files['Color theme/Muted.json']);
  assert.deepEqual(r.doc!.$themes, files['$themes.json']);
  assert.deepEqual(r.doc!.$metadata, files['$metadata.json']);
  assert.equal(r.warnings.length, 1);
  assert.ok(r.warnings[0]!.includes('readme.txt'));
});

test('assembleTokenSetFiles: malformed $metadata/$themes bodies are warned + ignored, not fatal', () => {
  const r = assembleTokenSetFiles({
    'Foundations.json': { color: { $value: '#fff', $type: 'color' } },
    '$metadata.json': ['not', 'an', 'object'],
    '$themes.json': { not: 'an array' },
  });
  assert.ok(r.doc);
  assert.equal('$metadata' in r.doc!, false);
  assert.equal('$themes' in r.doc!, false);
  assert.equal(r.warnings.length, 2);
});

test('assembleTokenSetFiles: zero usable sets → doc null even if $themes/$metadata parsed', () => {
  const r = assembleTokenSetFiles({
    '$themes.json': [{ name: 'Light' }],
    '$metadata.json': { tokenSetOrder: [] },
  });
  assert.equal(r.doc, null);
  assert.ok(r.warnings.some(w => w.includes('no token set files')));
});

test('assembleTokenSetFiles: a non-object set body is skipped with a warning', () => {
  const r = assembleTokenSetFiles({
    'Foundations.json': { color: { $value: '#fff', $type: 'color' } },
    'Bad.json': 'not an object',
  });
  assert.ok(r.doc);
  assert.equal('Bad' in r.doc!, false);
  assert.ok(r.warnings.some(w => w.includes('Bad.json')));
});

// ── extractPenpotProject ─────────────────────────────────────────────────────

const enc = new TextEncoder();
const jsonBytes = (v: unknown) => enc.encode(JSON.stringify(v));

test('extractPenpotProject: manifest + files/<id>/tokens.json → doc extracted, no warnings', () => {
  const doc = { global: { color: { brand: { $value: '#123456', $type: 'color' } } } };
  const entries: Record<string, Uint8Array> = {
    'manifest.json': jsonBytes({ type: 'penpot/export-files', files: [{ id: 'abc', features: ['design-tokens/v1'] }] }),
    'files/abc/tokens.json': jsonBytes(doc),
  };
  const r = extractPenpotProject(entries);
  assert.equal(r.source, 'penpot-project');
  // {...r.doc}: the merge accumulator is deliberately null-prototype (a set
  // named "__proto__" must stay an own key) — compare content, not prototype.
  assert.deepEqual({ ...r.doc }, doc);
  assert.deepEqual(r.warnings, []);
});

test('extractPenpotProject: missing manifest falls back to a sorted files/*/tokens.json scan, with a warning', () => {
  const entries: Record<string, Uint8Array> = {
    'files/zzz/tokens.json': jsonBytes({ shared: { $value: 'from-zzz', $type: 'string' }, b: { $value: '2', $type: 'string' } }),
    'files/aaa/tokens.json': jsonBytes({ shared: { $value: 'from-aaa', $type: 'string' }, a: { $value: '1', $type: 'string' } }),
  };
  const r = extractPenpotProject(entries);
  assert.ok(r.doc);
  // Both files visited (disjoint keys merge) …
  assert.deepEqual(Object.keys(r.doc!).sort(), ['a', 'b', 'shared']);
  // … and the COLLIDING key pins the scan order: aaa sorts first, later zzz
  // wins. Reversing (or dropping) the sort would flip this to 'from-aaa'.
  assert.deepEqual(r.doc!.shared, { $value: 'from-zzz', $type: 'string' });
  assert.ok(r.warnings.some(w => w.includes('collides with an earlier file')));
  assert.ok(r.warnings.some(w => w.includes('manifest.json missing or unparseable')));
});

test('extractPenpotProject: an empty first $themes/[]-$metadata must not shadow a later file\'s real ones', () => {
  // Penpot writes `$themes: []` alongside real sets — presence isn't usefulness.
  const realThemes = [{ name: 'Light', group: 'Mode', selectedTokenSets: { Base: 'enabled' } }];
  const entries: Record<string, Uint8Array> = {
    'manifest.json': jsonBytes({ type: 'penpot/export-files', files: [{ id: 'first' }, { id: 'second' }] }),
    'files/first/tokens.json': jsonBytes({ $themes: [], $metadata: {}, Base: { color: { $value: '#123123', $type: 'color' } } }),
    'files/second/tokens.json': jsonBytes({ $themes: realThemes, $metadata: { tokenSetOrder: ['Base'] }, Extra: { x: { $value: '1', $type: 'string' } } }),
  };
  const r = extractPenpotProject(entries);
  assert.ok(r.doc);
  assert.deepEqual(r.doc!.$themes, realThemes);
  assert.deepEqual(r.doc!.$metadata, { tokenSetOrder: ['Base'] });
  assert.deepEqual(r.warnings, []); // adopting over an empty block is not a conflict
});

test('a set legitimately named "__proto__" survives both containers as an own key', () => {
  // JSON.parse creates "__proto__" as an own key; a plain-object accumulator
  // would swallow it via the prototype setter (and silently corrupt the doc).
  const body = { color: { $value: '#abcdef', $type: 'color' } };
  const fromFiles = assembleTokenSetFiles({ '__proto__.json': body, 'Real.json': body });
  assert.ok(fromFiles.doc);
  assert.ok(Object.hasOwn(fromFiles.doc!, '__proto__'), 'set "__proto__" kept as an own key (set-files)');
  assert.deepEqual(fromFiles.warnings, []);

  const entries: Record<string, Uint8Array> = {
    'manifest.json': jsonBytes({ type: 'penpot/export-files', files: [{ id: 'a' }, { id: 'b' }] }),
    'files/a/tokens.json': jsonBytes({ Real: body }),
    'files/b/tokens.json': enc.encode('{"__proto__": {"color": {"$value": "#abcdef", "$type": "color"}}}'),
  };
  const merged = extractPenpotProject(entries);
  assert.ok(merged.doc);
  assert.ok(Object.hasOwn(merged.doc!, '__proto__'), 'set "__proto__" kept as an own key (penpot merge)');
});

test('extractPenpotProject: two files colliding on a set key → later file wins + a warning', () => {
  const entries: Record<string, Uint8Array> = {
    'manifest.json': jsonBytes({
      type: 'penpot/export-files',
      files: [{ id: 'first' }, { id: 'second' }],
    }),
    'files/first/tokens.json': jsonBytes({ shared: { $value: '#111111', $type: 'color' } }),
    'files/second/tokens.json': jsonBytes({ shared: { $value: '#222222', $type: 'color' } }),
  };
  const r = extractPenpotProject(entries);
  assert.ok(r.doc);
  assert.deepEqual(r.doc!.shared, { $value: '#222222', $type: 'color' }); // later ("second") wins
  assert.ok(r.warnings.some(w => w.includes('collides with an earlier file')));
});

test('extractPenpotProject: zero tokens.json anywhere → doc null + warning', () => {
  const entries: Record<string, Uint8Array> = {
    'manifest.json': jsonBytes({ type: 'penpot/export-files', files: [{ id: 'abc' }] }),
    'files/abc/page.json': jsonBytes({ irrelevant: true }),
  };
  const r = extractPenpotProject(entries);
  assert.equal(r.doc, null);
  assert.ok(r.warnings.some(w => w.includes('no tokens.json found')));
});

// ── summarizeTokensDoc ───────────────────────────────────────────────────────

test('summarizeTokensDoc: counts tokens + colors on a tiny doc with an alias', () => {
  const doc = {
    color: {
      brand: { $value: '#ff0000', $type: 'color' },
      accent: { $value: '#00ff00', $type: 'color' },
      link: { $value: '{color.brand}', $type: 'color' }, // alias resolves to a color too
    },
    spacing: { small: { $value: '4px', $type: 'dimension' } },
  };
  const s = summarizeTokensDoc(doc);
  assert.equal(s.tokenCount, 4);
  assert.equal(s.colorCount, 3);
  assert.deepEqual(s.sets, []); // no $themes → implicit single set, sets stays []
  assert.deepEqual(s.themes, []);
});

// ── cross-container equivalence against real Penpot export materials ────────

test('cross-container equivalence: all available real sources agree', { skip: SKIP_MATERIALS }, async () => {
  const results: { label: string; r: ReturnType<typeof coerceTokensDoc> }[] = [];

  // 1. Monolithic tokens.json
  const monoPath = join(MATERIALS_DIR, 'tokens.json');
  if (existsSync(monoPath)) {
    const json = JSON.parse(readFileSync(monoPath, 'utf8'));
    results.push({ label: 'tokens.json', r: coerceTokensDoc(json) });
  }

  // 2. One-file-per-set directory
  const multiDir = join(MATERIALS_DIR, 'tokens-multiple-files');
  if (existsSync(multiDir)) {
    const files: Record<string, unknown> = {};
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, rel);
        else if (entry.name.endsWith('.json')) files[rel] = JSON.parse(readFileSync(full, 'utf8'));
      }
    };
    walk(multiDir, '');
    results.push({ label: 'tokens-multiple-files', r: assembleTokenSetFiles(files) });
  }

  // 3. .penpot project zip (fflate unzipSync)
  const penpotPath = join(MATERIALS_DIR, 'TokensPenpotProject.penpot');
  if (existsSync(penpotPath)) {
    let unzipSync: typeof import('fflate').unzipSync;
    try {
      ({ unzipSync } = await import('fflate'));
    } catch (e) {
      assert.fail(`fflate import failed (expected to be hoisted to root node_modules): ${e}`);
    }
    const bytes = readFileSync(penpotPath);
    const entries = unzipSync(new Uint8Array(bytes));
    results.push({ label: 'TokensPenpotProject.penpot', r: extractPenpotProject(entries) });
  }

  assert.ok(results.length >= 2, 'expected at least two real-material sources to be present');

  for (const { label, r } of results) {
    assert.ok(r.doc, `${label}: doc should not be null`);
    assert.deepEqual(r.warnings, [], `${label}: expected no warnings, got ${JSON.stringify(r.warnings)}`);
  }

  const setKeySets = results.map(({ label, r }) => ({
    label,
    keys: Object.keys(r.doc as Record<string, unknown>).filter(k => !k.startsWith('$')).sort(),
  }));
  const first = setKeySets[0]!;
  for (const other of setKeySets.slice(1)) {
    assert.deepEqual(other.keys, first.keys, `${other.label} set-name keys should match ${first.label}'s`);
  }

  const summaries = results.map(({ label, r }) => ({ label, s: summarizeTokensDoc(r.doc) }));
  const firstSummary = summaries[0]!;
  assert.ok(firstSummary.s.colorCount > 0, 'expected at least one color token in the real materials');
  for (const other of summaries.slice(1)) {
    assert.equal(other.s.tokenCount, firstSummary.s.tokenCount, `${other.label} tokenCount should match ${firstSummary.label}'s`);
    assert.equal(other.s.colorCount, firstSummary.s.colorCount, `${other.label} colorCount should match ${firstSummary.label}'s`);
  }
});
