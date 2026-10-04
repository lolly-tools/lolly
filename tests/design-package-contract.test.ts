// SPDX-License-Identifier: MPL-2.0
/**
 * The design package contract (plan 291, W8): schemas/design-package-v1.schema.json
 * against the TypeScript it mirrors in packages/core/src/design-package-v1.ts, in the
 * pattern tests/check-report-contract.test.ts sets. Each exported const array has one
 * named $defs entry holding its enum, compared in order; a maximal sample typed as
 * DesignPackageReportV1 uses exactly the keys the schema declares on every object.
 *
 * Run with: node --test "tests/design-package-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as contract from '../packages/core/src/design-package-v1.ts';
import * as core from '../packages/core/src/index.ts';
import type { DesignPackageReportV1 } from '../packages/core/src/design-package-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/design-package-v1.schema.json');
const DEFS = SCHEMA.$defs as Record<string, Json>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const HEX_A = 'a'.repeat(64);
const HEX_B = 'b'.repeat(64);

const FULL: DesignPackageReportV1 = {
  format: 'lolly-package',
  version: 1,
  output: '/tmp/deck.lolly',
  bytes: 4096,
  sha256: HEX_B,
  exportedAt: '2026-10-03T00:00:00.000Z',
  tool: { id: 'design', version: '1.41.0' },
  label: 'Quarterly review',
  filename: 'Quarterly review',
  size: { width: 1920, height: 1080, unit: 'px' },
  artboards: 2,
  layers: 12,
  expanded: true,
  media: [{ ref: `user/media/${HEX_A}`, sha256: HEX_A, mime: 'image/jpeg', bytes: 2048, origin: 'asset', keys: ['photo:title'], layers: ['s1-photo'] }],
  references: { profile: 'lolly-start', catalog: 2, unchecked: 0, external: 1, unknown: [{ ref: 'lolly/logo/gone', layers: ['s2-logo'] }] },
  missingMedia: [{ ref: 'photo:clock', layers: ['s2-photo'] }],
  unusedAssets: ['photo:spare'],
  warnings: [{ code: 'media.missing', message: 'photo:clock is written as a reference with no bytes (s2-photo).', path: '/boxes/7/image' }],
  readback: { ok: true, layers: 12, media: 1, label: 'Quarterly review', filename: 'Quarterly review' },
  next: ['lolly check deck.lolly'],
};

const MINIMAL: DesignPackageReportV1 = {
  format: 'lolly-package',
  version: 1,
  bytes: 512,
  sha256: HEX_B,
  exportedAt: '2026-10-03T00:00:00.000Z',
  tool: { id: 'design' },
  label: 'Design',
  filename: 'Design',
  size: null,
  artboards: 0,
  layers: 0,
  expanded: false,
  media: [],
  references: { catalog: 0, unchecked: 0, external: 0, unknown: [] },
  missingMedia: [],
  unusedAssets: [],
  warnings: [],
  readback: { ok: true, layers: 0, media: 0, label: 'Design', filename: 'Design' },
  next: [],
};

const PINNED: Array<[string, readonly unknown[], string]> = [
  ['DESIGN_PACKAGE_MEDIA_ORIGINS', contract.DESIGN_PACKAGE_MEDIA_ORIGINS, 'mediaOrigin'],
  ['DESIGN_PACKAGE_ERROR_CODES', contract.DESIGN_PACKAGE_ERROR_CODES, 'errorCode'],
  ['DESIGN_PACKAGE_WARNING_CODES', contract.DESIGN_PACKAGE_WARNING_CODES, 'warningCode'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(contract).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  assert.deepEqual(exportedArrays, PINNED.map(([n]) => n).sort(), 'every exported array has a schema home in this table');
});

test('the format and version are the module constants', () => {
  const props = SCHEMA.properties as Record<string, Json>;
  assert.equal(props.format!.const, contract.DESIGN_PACKAGE_FORMAT);
  assert.equal(props.version!.const, contract.DESIGN_PACKAGE_VERSION);
});

test('the maximal and minimal samples validate', () => {
  assert.equal(validate(FULL), true, JSON.stringify(validate.errors, null, 2));
  assert.equal(validate(MINIMAL), true, JSON.stringify(validate.errors, null, 2));
});

test('the maximal sample and the schema declare the same keys on every object', () => {
  const props = (node: Json): string[] => Object.keys(node.properties as Json).sort();
  const keys = (value: object): string[] => Object.keys(value).sort();
  const top = SCHEMA.properties as Record<string, Json>;
  assert.deepEqual(keys(FULL), props(SCHEMA));
  assert.deepEqual(keys(FULL.tool), props(top.tool!));
  assert.deepEqual(keys(FULL.size!), props(DEFS.size!));
  assert.deepEqual(keys(FULL.media[0]!), props(DEFS.media!));
  assert.deepEqual(keys(FULL.references), props(DEFS.references!));
  assert.deepEqual(keys(FULL.missingMedia[0]!), props(DEFS.missing!));
  assert.deepEqual(keys(FULL.warnings[0]!), props(DEFS.warning!));
  assert.deepEqual(keys(FULL.readback), props(DEFS.readback!));
});

test('malformed reports are refused', () => {
  const cases: Array<[string, unknown]> = [
    ['another tool', { ...clone(MINIMAL), tool: { id: 'document' } }],
    ['an upload ref that is not a hash', { ...clone(FULL), media: [{ ...FULL.media[0], ref: 'user/media/abc' }] }],
    ['an unknown media origin', { ...clone(FULL), media: [{ ...FULL.media[0], origin: 'url' }] }],
    ['an unknown warning code', { ...clone(FULL), warnings: [{ code: 'other', message: 'x' }] }],
    ['a readback that failed', { ...clone(FULL), readback: { ...FULL.readback, ok: false } }],
    ['an empty label', { ...clone(MINIMAL), label: '' }],
    ['an extra key', { ...clone(MINIMAL), extra: 1 }],
    ['a size in another unit', { ...clone(FULL), size: { width: 10, height: 10, unit: 'mm' } }],
  ];
  for (const [label, doc] of cases) assert.equal(validate(doc), false, `${label} should be refused`);
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(contract)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./design-package-v1'], './src/design-package-v1.ts');
  assert.equal(exportsMap['./schema/design-package-v1.schema.json'], './schema/design-package-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/design-package-v1.schema.json')));
  const nodeShell = readJson('packages/node-shell/package.json').exports as Record<string, string>;
  assert.equal(nodeShell['./design-lolly'], './src/design-lolly.ts');
});
