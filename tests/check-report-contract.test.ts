// SPDX-License-Identifier: MPL-2.0
/**
 * The check report contract (plan 291, W1): schemas/check-report-v1.schema.json
 * against the TypeScript it mirrors in packages/core/src/check-v1.ts.
 *
 * The rebrand contract test sets the pattern this file follows. Each exported
 * const array has one named $defs entry holding its enum, compared element by
 * element and in order. The outcome to exit-code pairing is held twice (the
 * CHECK_OUTCOME_EXIT_CODES table and the schema's if/then rules) and compared
 * here. A maximal sample typed as CheckReportV1 carries every optional field, and
 * each object in it must use exactly the keys the schema declares for that
 * object, so a field added on one side only fails here.
 *
 * Run with: node --test "tests/check-report-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as check from '../packages/core/src/check-v1.ts';
import * as core from '../packages/core/src/index.ts';
import { SEVERITY_RANK } from '../packages/core/src/preflight.ts';
import type { CheckFamily, CheckFindingV1, CheckReportV1 } from '../packages/core/src/check-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/check-report-v1.schema.json');
const DEFS = SCHEMA.$defs as Record<string, Json>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ok = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), true, `${label}: ${JSON.stringify(validate.errors, null, 2)}`);
};
const refused = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), false, `${label} should be refused`);
};

const ZERO = { error: 0, warn: 0, info: 0 };

/** A finding with every optional field, from the brand house rules. */
const FULL_FINDING: CheckFindingV1 = {
  code: 'brand.rule.headline-weight',
  family: 'brand',
  severity: 'warn',
  message: 'Headline weight is 700; the brand sets 500.',
  needs: 'review',
  path: '/boxes/3/fontWeight',
  layerId: 'title-1',
  artboardId: 'slide-1',
  page: '1',
  box: { x: 96, y: 120, width: 1200, height: 140 },
  evidence: { value: 700, expected: 500, rule: 'headline-weight', checked: true, theme: null },
  suggestion: 'Set the headline weight to 500.',
  fix: { layerId: 'title-1', field: 'fontWeight', before: 700, after: 500 },
  // 1.244 (plan 291 W4): the theme a multi-theme check found it in.
  theme: 'dark',
  origin: { checker: 'house-rules', id: 'headline-weight', method: 'source-geometry', confidence: 1, contribution: 'specific-artifact' },
};

const MINIMAL_FINDING: CheckFindingV1 = {
  code: 'design.text.overflow',
  family: 'render',
  severity: 'warn',
  message: 'Text does not fit its box.',
  origin: { checker: 'mounted-audit', id: 'design.text.overflow' },
};

const INFO_FINDING: CheckFindingV1 = {
  code: 'verify.eyebrow-heading',
  family: 'verify',
  severity: 'info',
  message: 'A small label sits above a heading.',
  origin: { checker: 'forensic', id: 'eyebrow-heading', method: 'source-geometry', confidence: 0.4, contribution: 'weak-clue' },
};

/** Every optional field present, as a review outcome. */
const FULL: CheckReportV1 = {
  format: 'lolly-check',
  version: 1,
  input: { kind: 'lolly', name: 'deck.lolly', sha256: 'a'.repeat(64), artboards: 16, pages: 16 },
  outcome: 'review',
  exitCode: 5,
  strict: false,
  families: {
    structure: { state: 'ran', ...ZERO },
    render: { state: 'ran', error: 0, warn: 1, info: 0 },
    brand: { state: 'ran', error: 0, warn: 1, info: 0 },
    verify: { state: 'ran', reason: 'OCR off', error: 0, warn: 0, info: 1 },
    fidelity: { state: 'ran', ...ZERO },
  },
  summary: { error: 0, warn: 2, info: 1 },
  findings: [FULL_FINDING, MINIMAL_FINDING, INFO_FINDING],
  fidelity: {
    slides: { source: 16, result: 16 },
    missingStrings: [],
    editedStrings: [{ source: 'Colour Palette', result: 'Colour palette' }],
    notes: { carried: 5, missing: 0 },
    excepted: [
      { slide: 3, source: 'Colour Palette', result: 'Colour palette', reason: 'Sentence case for titles' },
      { slide: 9, source: 'Draft footnote', reason: 'Dropped on purpose' },
    ],
  },
  designSystem: { profile: 'lolly-start', origin: 'profile', tokensAsset: 'lolly-start/tokens/brand' },
};

/** The smallest report: a clean design document with the brand family unavailable. */
const MINIMAL: CheckReportV1 = {
  format: 'lolly-check',
  version: 1,
  input: { kind: 'design' },
  outcome: 'clean',
  exitCode: 0,
  strict: true,
  families: {
    structure: { state: 'ran', ...ZERO },
    render: { state: 'unavailable', reason: 'The browser tier is not installed.', ...ZERO },
    brand: { state: 'unavailable', reason: 'No design system resolved.', ...ZERO },
    verify: { state: 'ran', ...ZERO },
    fidelity: { state: 'skipped', reason: 'No --source given.', ...ZERO },
  },
  summary: { ...ZERO },
  findings: [],
  designSystem: null,
};

/** Each exported const array beside the $defs entry that holds its enum. */
const PINNED: Array<[string, readonly unknown[], string]> = [
  ['CHECK_FAMILIES', check.CHECK_FAMILIES, 'family'],
  ['CHECK_FAMILY_STATES', check.CHECK_FAMILY_STATES, 'familyState'],
  ['CHECK_CHECKERS', check.CHECK_CHECKERS, 'checker'],
  ['CHECK_FINDING_NEEDS', check.CHECK_FINDING_NEEDS, 'findingNeeds'],
  ['CHECK_OUTCOMES', check.CHECK_OUTCOMES, 'outcome'],
  ['CHECK_EXIT_CODES', check.CHECK_EXIT_CODES, 'exitCode'],
  ['CHECK_INPUT_KINDS', check.CHECK_INPUT_KINDS, 'inputKind'],
  ['CHECK_DESIGN_SYSTEM_ORIGINS', check.CHECK_DESIGN_SYSTEM_ORIGINS, 'designSystemOrigin'],
  ['preflight Severity (SEVERITY_RANK keys)', Object.keys(SEVERITY_RANK), 'severity'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(check).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  const pinnedNames = PINNED.map(([n]) => n).filter((n) => n.startsWith('CHECK_')).sort();
  assert.deepEqual(exportedArrays, pinnedNames, 'every exported array has a schema home in this table');
});

test('the format, version and code pattern are the module constants', () => {
  const props = SCHEMA.properties as Record<string, Json>;
  assert.equal(props.format!.const, check.CHECK_FORMAT);
  assert.equal(props.version!.const, check.CHECK_FORMAT_VERSION);
  assert.equal(DEFS.code!.pattern, check.CHECK_CODE_PATTERN);
  const families = props.families as { required: string[]; properties: Json };
  assert.deepEqual(families.required, [...check.CHECK_FAMILIES]);
  assert.deepEqual(Object.keys(families.properties), [...check.CHECK_FAMILIES]);
});

test('the outcome to exit-code pairing is the same table in the module and the schema', () => {
  const rules = SCHEMA.allOf as Array<{ if: { properties: { outcome: { const: string } } }; then: { properties: { exitCode: Json } } }>;
  const fromSchema = Object.fromEntries(rules.map((r) => {
    const exit = r.then.properties.exitCode;
    return [r.if.properties.outcome.const, 'const' in exit ? [exit.const] : (exit.enum as number[])];
  }));
  assert.deepEqual(fromSchema, Object.fromEntries(Object.entries(check.CHECK_OUTCOME_EXIT_CODES).map(([k, v]) => [k, [...v]])));
  assert.deepEqual(Object.keys(fromSchema).sort(), [...check.CHECK_OUTCOMES].sort(), 'every outcome has a rule');
  const reachable = Object.values(check.CHECK_OUTCOME_EXIT_CODES).flat().sort();
  assert.deepEqual(reachable, [...check.CHECK_EXIT_CODES], 'every exit code belongs to exactly one outcome');
  assert.deepEqual(Object.values(check.CHECK_EXIT).sort(), [...check.CHECK_EXIT_CODES], 'CHECK_EXIT gives each code one meaning');
  for (const outcome of check.CHECK_OUTCOMES) {
    for (const exitCode of check.CHECK_EXIT_CODES) {
      const doc = { ...clone(MINIMAL), outcome, exitCode };
      const allowed = check.CHECK_OUTCOME_EXIT_CODES[outcome].includes(exitCode);
      assert.equal(validate(doc), allowed, `${outcome} with exit ${exitCode}`);
    }
  }
});

test('the maximal and minimal samples validate', () => {
  ok(FULL, 'maximal');
  ok(MINIMAL, 'minimal');
  const withoutSystem: Partial<CheckReportV1> = clone(MINIMAL);
  delete withoutSystem.designSystem;
  ok(withoutSystem, 'designSystem left out');
});

/** Every object in the maximal sample uses exactly the keys the schema declares for that object. */
test('the maximal sample and the schema declare the same keys on every object', () => {
  const props = (node: Json): string[] => Object.keys(node.properties as Json).sort();
  const keys = (value: object): string[] => Object.keys(value).sort();
  const top = SCHEMA.properties as Record<string, Json>;
  assert.deepEqual(keys(FULL), props(SCHEMA));
  assert.deepEqual(keys(FULL.input), props(top.input!));
  assert.deepEqual(keys(FULL.fidelity!), props(top.fidelity!));
  assert.deepEqual(keys(FULL.fidelity!.excepted![0]!), props(DEFS.fidelityExcepted!));
  assert.deepEqual(keys(FULL.designSystem!), props((top.designSystem!.oneOf as Json[])[1]!));
  assert.deepEqual(keys(FULL.summary), props(DEFS.counts!));
  assert.deepEqual(keys(FULL.families.verify), props(DEFS.familyStatus!));
  assert.deepEqual(keys(FULL_FINDING), props(DEFS.finding!));
  assert.deepEqual(keys(FULL_FINDING.box!), props(DEFS.box!));
  assert.deepEqual(keys(FULL_FINDING.fix!), props(DEFS.fix!));
  assert.deepEqual(keys(FULL_FINDING.origin), props(DEFS.origin!));
});

test('the summary is the sum over the families and the tally of the findings', () => {
  for (const [label, report] of [['maximal', FULL], ['minimal', MINIMAL]] as const) {
    const sum = { ...ZERO };
    for (const family of check.CHECK_FAMILIES) {
      for (const level of ['error', 'warn', 'info'] as const) sum[level] += report.families[family][level];
    }
    assert.deepEqual(sum, report.summary, `${label}: families add up to the summary`);
    const tally = { ...ZERO };
    const perFamily = Object.fromEntries(check.CHECK_FAMILIES.map((f) => [f, { ...ZERO }])) as Record<CheckFamily, typeof ZERO>;
    for (const finding of report.findings) {
      tally[finding.severity] += 1;
      perFamily[finding.family][finding.severity] += 1;
    }
    assert.deepEqual(tally, report.summary, `${label}: findings tally to the summary`);
    for (const family of check.CHECK_FAMILIES) {
      const { error, warn, info } = report.families[family];
      assert.deepEqual({ error, warn, info }, perFamily[family], `${label}: ${family} counts its own findings`);
    }
  }
});

test('finding codes are lower case, dotted and at least two parts', () => {
  const pattern = new RegExp(check.CHECK_CODE_PATTERN);
  for (const code of ['design.text.overflow', 'design.text.contrast-low', 'design.font.unembeddable', 'brand.rule.headline-weight',
    'verify.eyebrow-heading', 'verify.decorative-numbering', 'fidelity.text.missing', 'fidelity.notes.missing', 'design.layer.id-duplicate']) {
    assert.ok(pattern.test(code), code);
    ok({ ...clone(FULL), findings: [{ ...FULL_FINDING, code }] }, code);
  }
  for (const code of ['overflow', 'Design.text', 'design..text', 'design.text.', '.design', 'design text', 'design/text']) {
    assert.equal(pattern.test(code), false, code);
    refused({ ...clone(FULL), findings: [{ ...FULL_FINDING, code }] }, code);
  }
});

test('malformed reports are refused', () => {
  const families = (): Json => clone(FULL.families) as unknown as Json;
  const finding = (patch: Json): Json => ({ ...clone(FULL_FINDING), ...patch });
  const cases: Array<[string, unknown]> = [
    ['wrong format', { ...clone(FULL), format: 'lolly-preflight' }],
    ['wrong version', { ...clone(FULL), version: 2 }],
    ['unknown top-level key', { ...clone(FULL), extra: true }],
    ['a family left out', { ...clone(FULL), families: (() => { const f = families(); delete f.fidelity; return f; })() }],
    ['an unknown family', { ...clone(FULL), families: { ...families(), accessibility: { state: 'ran', ...ZERO } } }],
    ['an unknown family state', { ...clone(FULL), families: { ...families(), render: { state: 'crashed', ...ZERO } } }],
    ['a negative count', { ...clone(FULL), summary: { error: -1, warn: 2, info: 1 } }],
    ['a fractional count', { ...clone(FULL), summary: { error: 0.5, warn: 2, info: 1 } }],
    ['an unknown input kind', { ...clone(FULL), input: { kind: 'docx' } }],
    ['an upper-case sha256', { ...clone(FULL), input: { kind: 'lolly', sha256: 'A'.repeat(64) } }],
    ['severity spelt warning', { ...clone(FULL), findings: [finding({ severity: 'warning' })] }],
    ['an unknown family on a finding', { ...clone(FULL), findings: [finding({ family: 'accessibility' })] }],
    ['an unknown needs', { ...clone(FULL), findings: [finding({ needs: 'human' })] }],
    ['a path that is not a pointer', { ...clone(FULL), findings: [finding({ path: 'boxes/3' })] }],
    ['an empty message', { ...clone(FULL), findings: [finding({ message: '' })] }],
    ['no origin', { ...clone(FULL), findings: [(() => { const f = finding({}); delete f.origin; return f; })()] }],
    ['an unknown checker', { ...clone(FULL), findings: [finding({ origin: { checker: 'ocr', id: 'x' } })] }],
    ['confidence above 1', { ...clone(FULL), findings: [finding({ origin: { checker: 'forensic', id: 'x', confidence: 1.5 } })] }],
    ['a fix without before', { ...clone(FULL), findings: [finding({ fix: { layerId: 'a', field: 'b', after: 1 } })] }],
    ['nested evidence', { ...clone(FULL), findings: [finding({ evidence: { nested: { a: 1 } } })] }],
    ['a box with negative width', { ...clone(FULL), findings: [finding({ box: { x: 0, y: 0, width: -1, height: 1 } })] }],
    ['an unknown design-system origin', { ...clone(FULL), designSystem: { origin: 'catalog' } }],
    ['fidelity without notes', { ...clone(FULL), fidelity: { slides: { source: 1, result: 1 }, missingStrings: [], editedStrings: [] } }],
    ['an excepted string without a reason', { ...clone(FULL), fidelity: { ...clone(FULL).fidelity, excepted: [{ slide: 1, source: 'A' }] } }],
    ['an excepted string with an empty reason', { ...clone(FULL), fidelity: { ...clone(FULL).fidelity, excepted: [{ slide: 1, source: 'A', reason: '' }] } }],
    ['an excepted string with an unknown key', { ...clone(FULL), fidelity: { ...clone(FULL).fidelity, excepted: [{ slide: 1, source: 'A', reason: 'r', passed: true }] } }],
  ];
  for (const [label, doc] of cases) refused(doc, label);
});

test('a fix records an unset field as null and keeps any JSON value', () => {
  ok({ ...clone(FULL), findings: [{ ...FULL_FINDING, fix: { layerId: 'a', field: 'color', before: null, after: '#30ba78' } }] }, 'null before');
  ok({ ...clone(FULL), findings: [{ ...FULL_FINDING, fix: { layerId: 'a', field: 'font', before: { family: 'A' }, after: ['B'] } }] }, 'structured values');
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(check)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./check-v1'], './src/check-v1.ts');
  assert.equal(exportsMap['./schema/check-report-v1.schema.json'], './schema/check-report-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/check-report-v1.schema.json')));
});
