// SPDX-License-Identifier: MPL-2.0
/**
 * The design compose contract (plan 291, W6): schemas/design-compose-v1.schema.json
 * against the TypeScript it mirrors in packages/core/src/design-compose-v1.ts, and
 * against what the engine's composeDesignSlides and composeArchetypeCatalog give.
 *
 * Same pattern as the package and authoring contract tests: each exported const array
 * is compared with its $defs enum element by element, maximal and minimal samples
 * validate and declare exactly the schema's keys, and malformed shapes are refused.
 *
 * Run with: node --test "tests/design-compose-contract.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import * as contract from '../packages/core/src/design-compose-v1.ts';
import * as core from '../packages/core/src/index.ts';
import type { ComposeArchetypeV1, ComposeReportV1, DesignComposeSpecV1 } from '../packages/core/src/design-compose-v1.ts';
import { composeArchetypeCatalog, composeDesignSlides } from '../engine/src/design-compose.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Json = Record<string, unknown>;
const readJson = (rel: string): Json => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;

const SCHEMA = readJson('schemas/design-compose-v1.schema.json');
const DEFS = SCHEMA.$defs as Record<string, Json>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const ajv = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false });
const validate = ajv.compile(SCHEMA);
const ok = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), true, `${label}: ${JSON.stringify(validate.errors, null, 2)}`);
};
const refused = (doc: unknown, label: string): void => {
  assert.equal(validate(doc), false, `${label} should be refused`);
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const SPEC: DesignComposeSpecV1 = {
  size: { width: 1920, height: 1080 },
  theme: 'light',
  themes: ['light', 'dark'],
  footer: 'Harbour notes',
  pageNumbers: true,
  transition: 'fade',
  gap: 160,
  $styles: { eyebrow: { basedOn: 'label', fontSize: 28 } },
  furniture: { omit: ['bar'], footer: 'Harbour notes', logo: 'auto' },
  emphasis: 'accent',
  case: 'sentence',
  slides: [
    {
      archetype: 'title',
      id: 'cover',
      name: 'Cover',
      ground: 'dark',
      source: 1,
      slots: { title: { from: 'o1', join: ': ', case: 'keep', emphasis: 'bold' }, subtitle: { from: 'o2', para: 0, $style: 'subtitle', fg: '#ffffff', y: 600 } },
      cells: [],
      notes: true,
      furniture: { omit: ['page-number'], footer: 'Opening', logo: 'mono' },
      under: [{ kind: 'image', image: 'photo:cover', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' }],
      over: [{ $style: 'eyebrow', text: 'CHAPTER ONE', x: 65, y: 200, w: 600, h: 40 }],
      intent: 'A cover over the harbour photo.',
      emphasis: 'keep',
      case: 'keep',
    },
    { archetype: 'flow-cards-4-2', cells: [{ label: 'North', body: 'Cold' }, { body: 'Warm' }], slots: { title: null, 'body#3': '' }, notes: null },
    { archetype: 'closing-thanks', notes: 'Thank everyone.' },
  ],
};

const REPORT: ComposeReportV1 = {
  format: 'lolly-compose',
  version: 1,
  master: { id: 'lolly/slides/neutral', version: '1.3.0', origin: 'neutral' },
  size: { width: 1920, height: 1080 },
  slides: [{
    index: 0, id: 's01', archetype: 'agenda-dark', requested: 'agenda', ground: 'dark',
    filled: ['title', 'body'], dropped: ['body#2'], furniture: ['footer-on-dark', 'page-number-on-dark'], notes: true,
    fit: [{ layerId: 's01.body', lines: 4, overflow: false, fontSize: 36, shrunk: true }],
  }],
  notes: [
    { path: '/slides/0/archetype', code: 'compose.dark.none', message: 'Archetype "title" has no dark twin.' },
    { path: '/slides/0/over/0', code: 'authoring.fg.derived', message: '1 text row took black or white by contrast.' },
  ],
};

const MINIMAL_REPORT: ComposeReportV1 = {
  format: 'lolly-compose', version: 1, master: { id: 'm', version: '', origin: 'flag' }, size: { width: 10, height: 10 }, slides: [], notes: [],
};

const ARCHETYPE: ComposeArchetypeV1 = {
  id: 'columns-2', name: 'Two columns', dark: 'columns-2-dark', ground: 'light',
  slots: [{ key: 'label', role: 'label', kind: 'text', optional: true, box: { x: 44, y: 150, w: 580, h: 60 } }],
  cells: 2, useWhen: 'two columns, compare',
};

const PINNED: Array<[string, readonly unknown[], string]> = [
  ['DESIGN_COMPOSE_GROUNDS', contract.DESIGN_COMPOSE_GROUNDS, 'ground'],
  ['DESIGN_COMPOSE_MASTER_ORIGINS', contract.DESIGN_COMPOSE_MASTER_ORIGINS, 'masterOrigin'],
  ['DESIGN_COMPOSE_LOGO_MODES', contract.DESIGN_COMPOSE_LOGO_MODES, 'logoMode'],
  ['DESIGN_COMPOSE_SLOT_KINDS', contract.DESIGN_COMPOSE_SLOT_KINDS, 'slotKind'],
  ['DESIGN_COMPOSE_RESERVED_FIELDS', contract.DESIGN_COMPOSE_RESERVED_FIELDS, 'reservedField'],
  ['DESIGN_COMPOSE_NOTE_CODES', contract.DESIGN_COMPOSE_NOTE_CODES, 'noteCode'],
  ['DESIGN_COMPOSE_EMPHASIS_MODES', contract.DESIGN_COMPOSE_EMPHASIS_MODES, 'emphasis'],
  ['DESIGN_COMPOSE_CASES', contract.DESIGN_COMPOSE_CASES, 'textCase'],
  ['DESIGN_COMPOSE_TRANSITIONS', contract.DESIGN_COMPOSE_TRANSITIONS, 'transition'],
];

test('every exported vocabulary matches its schema enum element by element', () => {
  for (const [name, values, def] of PINNED) {
    assert.ok(DEFS[def], `$defs.${def} exists for ${name}`);
    assert.deepEqual(DEFS[def]!.enum, [...values], `${name} and $defs.${def}.enum agree in order`);
  }
  const exportedArrays = Object.entries(contract).filter(([, v]) => Array.isArray(v)).map(([k]) => k).sort();
  assert.deepEqual(exportedArrays, PINNED.map(([n]) => n).sort(), 'every exported array has a schema home in this table');
});

test('the format, version and limits are the module constants', () => {
  const report = DEFS.report!.properties as Record<string, Json>;
  assert.equal(report.format!.const, contract.DESIGN_COMPOSE_FORMAT);
  assert.equal(report.version!.const, contract.DESIGN_COMPOSE_VERSION);
  const spec = DEFS.spec!.properties as Record<string, Json>;
  assert.equal(spec.slides!.maxItems, contract.DESIGN_COMPOSE_MAX_SLIDES);
});

test('the samples validate, and declare exactly the keys the schema does', () => {
  ok(SPEC, 'the maximal spec');
  ok({ slides: [{ archetype: 'content' }] }, 'the minimal spec');
  ok(REPORT, 'the maximal report');
  ok(MINIMAL_REPORT, 'the minimal report');
  ok([ARCHETYPE], 'a catalogue');
  const props = (node: Json): string[] => Object.keys(node.properties as Json).sort();
  const keys = (value: object): string[] => Object.keys(value).sort();
  assert.deepEqual(keys(SPEC), props(DEFS.spec!));
  assert.deepEqual(keys(SPEC.slides[0]!), props(DEFS.slide!));
  assert.deepEqual(keys(SPEC.slides[0]!.furniture!), props(DEFS.furniture!));
  assert.deepEqual(keys(SPEC.furniture!), props(DEFS.furniture!));
  assert.deepEqual(keys(REPORT), props(DEFS.report!));
  assert.deepEqual(keys(REPORT.slides[0]!), props(DEFS.reportSlide!));
  assert.deepEqual(keys(REPORT.slides[0]!.fit![0]!), props(DEFS.fit!));
  assert.deepEqual(keys(REPORT.notes[0]!), props(DEFS.note!));
  assert.deepEqual(keys(ARCHETYPE), props(DEFS.archetype!));
  assert.deepEqual(keys(ARCHETYPE.slots[0]!), props(DEFS.archetypeSlot!));
});

test('malformed specs and reports are refused', () => {
  const slide = (over: Json): unknown => ({ slides: [{ archetype: 'content', ...over }] });
  const cases: Array<[string, unknown]> = [
    ['no slides', { slides: [] }],
    ['an unknown spec key', { ...clone(SPEC), colour: 'red' }],
    ['an unknown slide key', slide({ titel: 'x' })],
    ['a slot key that is not a role', slide({ slots: { Title: 'x' } })],
    ['slot ordinal 0', slide({ slots: { 'body#0': 'x' } })],
    ['a reserved slot field', slide({ slots: { title: { text: 'x', role: 'body' } } })],
    ['another authoring key on a slot', slide({ slots: { title: { text: 'x', $in: 's01' } } })],
    ['text and image together', slide({ slots: { title: { text: 'x', image: 'y' } } })],
    ['para with no from', slide({ slots: { title: { text: 'x', para: 1 } } })],
    ['join with no from', slide({ slots: { title: { text: 'x', join: ': ' } } })],
    ['an unknown emphasis', slide({ emphasis: 'italic' })],
    ['an unknown case', { slides: [{ archetype: 'content' }], case: 'title' }],
    ['an unknown deck furniture key', { slides: [{ archetype: 'content' }], furniture: { hide: ['logo'] } }],
    ['a source of 0', slide({ source: 0 })],
    ['notes false', slide({ notes: false })],
    ['an unknown ground', slide({ ground: 'dim' })],
    ['an unknown logo mode', slide({ furniture: { logo: 'big' } })],
    ['a size of 0', { size: { width: 0, height: 10 }, slides: [{ archetype: 'content' }] }],
    ['a size under 1 px', { size: { width: 0.4, height: 10 }, slides: [{ archetype: 'content' }] }],
    ['a slot of overrides alone', slide({ slots: { title: { fontSize: 40 } } })],
    ['an empty transition', { slides: [{ archetype: 'content' }], transition: '' }],
    ['a transition Design does not have', { slides: [{ archetype: 'content' }], transition: 'Fade' }],
    ['a gap past the cap', { slides: [{ archetype: 'content' }], gap: 1e308 }],
    ['a report in another format', { ...clone(MINIMAL_REPORT), format: 'lolly-check' }],
    ['an unknown master origin', { ...clone(MINIMAL_REPORT), master: { id: 'm', version: '', origin: 'web' } }],
    ['an unknown note code', { ...clone(MINIMAL_REPORT), notes: [{ path: '', code: 'other', message: 'x' }] }],
    ['an extra report key', { ...clone(MINIMAL_REPORT), extra: 1 }],
  ];
  for (const [label, doc] of cases) refused(doc, label);
  // para with join is allowed: the picked paragraphs' lines run into one (plan 291 M4).
  ok({ slides: [{ archetype: 'content', slots: { subtitle: { from: 'o1', para: [1, 2], join: ' ' } } }] }, 'para and join together');
});

test('what the engine composes and lists validates', () => {
  const ctx = { master: neutralSlideMaster(), masterOrigin: 'neutral' as const, resolveToken: (): undefined => undefined };
  const { report, edits } = composeDesignSlides({
    theme: 'dark',
    slides: [
      { archetype: 'agenda', slots: { title: 'Agenda', body: '1. Tides' } },
      { archetype: 'title', slots: { title: 'x' }, over: [{ text: 'eyebrow', x: 0, y: 0, w: 100, h: 20 }] },
      { archetype: 'flow-cards-3-3', cells: [{ body: 'a' }] },
    ],
  }, ctx);
  ok(report, 'a composed report');
  assert.deepEqual(edits, []);
  const catalog = composeArchetypeCatalog(neutralSlideMaster());
  ok(catalog, 'the neutral catalogue');
  ok(SPEC, 'the maximal spec');
});

test('the core barrel and the package exports carry the contract', () => {
  for (const [name, value] of Object.entries(contract)) {
    assert.equal((core as Record<string, unknown>)[name], value, `@lolly-tools/core re-exports ${name}`);
  }
  const exportsMap = readJson('packages/core/package.json').exports as Record<string, string>;
  assert.equal(exportsMap['./design-compose-v1'], './src/design-compose-v1.ts');
  assert.equal(exportsMap['./schema/design-compose-v1.schema.json'], './schema/design-compose-v1.schema.json');
  assert.ok(existsSync(join(ROOT, 'packages/core/schema/design-compose-v1.schema.json')));
  assert.equal(contract.DESIGN_COMPOSE_DEFAULT_WIDTH, 1920);
  assert.equal(contract.DESIGN_COMPOSE_DEFAULT_HEIGHT, 1080);
  assert.equal(contract.DESIGN_COMPOSE_DEFAULT_GAP, 160);
});

test('a spec the schema refuses is one the engine refuses, and the transitions are Design\'s own', () => {
  const ctx = { master: neutralSlideMaster(), masterOrigin: 'neutral' as const, resolveToken: (): undefined => undefined };
  const specs: Array<[string, unknown, RegExp]> = [
    ['a size under 1 px', { size: { width: 0.4, height: 10 }, slides: [{ archetype: 'content' }] }, /^Error: \/size\/width/],
    ['a slot of overrides alone', { slides: [{ archetype: 'content', slots: { title: { fontSize: 40 } } }] }, /\/slides\/0\/slots\/title: give text, image or from/],
    ['an empty transition', { slides: [{ archetype: 'content' }], transition: '' }, /^Error: \/transition/],
    ['a transition Design does not have', { slides: [{ archetype: 'content' }], transition: 'Fade' }, /^Error: \/transition/],
    ['a gap past the cap', { slides: [{ archetype: 'content' }], gap: 1e308 }, /^Error: \/gap/],
  ];
  for (const [label, spec, re] of specs) {
    refused(spec, label);
    assert.throws(() => composeDesignSlides(spec as DesignComposeSpecV1, ctx), re, label);
  }
  // Design's transition input is a select: any other value would be swapped for its default without a word.
  const tool = readJson('community/design/tool.json') as { inputs: Array<{ id: string; options?: Array<{ value: string }> }> };
  const input = tool.inputs.find((i) => i.id === 'transition');
  assert.deepEqual(input?.options?.map((o) => o.value), [...contract.DESIGN_COMPOSE_TRANSITIONS]);
  for (const transition of contract.DESIGN_COMPOSE_TRANSITIONS) {
    ok({ slides: [{ archetype: 'content' }], transition }, transition);
    assert.equal(composeDesignSlides({ slides: [{ archetype: 'content' }], transition }, ctx).document.transition, transition);
  }
});
