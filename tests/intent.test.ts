// SPDX-License-Identifier: MPL-2.0
/**
 * Visual intent (plan 350 W4): the parser, the resolver's order, determinism, the prompt
 * flow, the kept-apart kinds of value and the curated manifests. The resolver is pure, so
 * these run with no browser and no render. `tests/intent-cli.test.ts` covers the verb.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import {
  INTENT_FREE_TEXT_FIELDS,
  INTENT_LIMITS,
  INTENT_PURPOSES,
  INTENT_PURPOSE_MEANINGS,
  INTENT_ROLES,
  INTENT_SURFACES,
  type IntentToolFactsV1,
} from '../packages/core/src/intent-v1.ts';
import {
  INTENTS_ENGINE_FLOOR,
  INTENT_RULES_VERSION,
  IntentInvalidError,
  checkToolIntents,
  parseVisualIntent,
  resolveIntent,
} from '../engine/src/intent.ts';
import { readToolManifest, toolDirs } from '../packages/node-shell/src/content-roots.ts';

const json = (rel: string) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
const ajv = new (Ajv as unknown as new (opts: object) => { compile(schema: object): ((data: unknown) => boolean) & { errors?: unknown } })({ allErrors: true, strict: false });
const validRequest = ajv.compile(json('schemas/visual-intent-v1.schema.json'));
const validAnswer = ajv.compile(json('schemas/intent-resolution-v1.schema.json'));

const manifests = (): IntentToolFactsV1[] =>
  [...toolDirs().keys()].map((id) => readToolManifest(id) as IntentToolFactsV1).filter((m) => m.intents?.length);

const tool = (over: Partial<IntentToolFactsV1> & { id: string }): IntentToolFactsV1 => ({
  version: '1.0.0',
  inputs: [{ id: 'heading', type: 'text' }, { id: 'body', type: 'longtext' }],
  render: { width: 1080, height: 1080, formats: ['png', 'pdf'] },
  intents: [{ purpose: 'promote' }],
  ...over,
});

const ask = (extra: Record<string, unknown> = {}) => ({ version: 1, purpose: 'promote', surfaces: [{ id: 'social-square' }], ...extra });

function refusedWith(value: unknown, code: string): void {
  const parsed = parseVisualIntent(value);
  assert.equal(parsed.ok, false, `expected ${code}`);
  if (!parsed.ok) assert.ok(parsed.errors.some((e) => e.code === code), JSON.stringify(parsed.errors));
}

test('the role vocabulary and the registry in schemas/canonical-inputs.json are one list', () => {
  const { roles } = json('schemas/canonical-inputs.json');
  assert.deepEqual(Object.keys(roles).sort(), Object.keys(INTENT_ROLES).sort());
  for (const [role, spec] of Object.entries(roles as Record<string, { accepts: string[] }>)) {
    assert.deepEqual(spec.accepts, INTENT_ROLES[role], role);
  }
});

test('the schemas name the same purposes, roles and surfaces as the constants', () => {
  const request = json('schemas/visual-intent-v1.schema.json');
  assert.deepEqual(request.properties.purpose.enum, [...INTENT_PURPOSES]);
  assert.deepEqual(request.properties.content.propertyNames.enum, Object.keys(INTENT_ROLES));
  assert.deepEqual(request.$defs.surface.oneOf[0].properties.id.enum, INTENT_SURFACES.map((s) => s.id));
  assert.equal(request.properties.prompt.maxLength, INTENT_LIMITS.promptChars);
  assert.deepEqual(json('schemas/tool.schema.json').properties.intents.items.properties.purpose.enum, [...INTENT_PURPOSES]);
  assert.deepEqual(json('schemas/intent-resolution-v1.schema.json').$defs.purpose.enum, [...INTENT_PURPOSES]);
});

test('every purpose has a meaning and at least one real tool, so none is a promise nothing keeps', () => {
  const tools = manifests();
  for (const purpose of INTENT_PURPOSES) {
    assert.ok(INTENT_PURPOSE_MEANINGS[purpose], purpose);
    assert.ok(tools.some((t) => t.intents!.some((i) => i.purpose === purpose)), `no tool declares ${purpose}`);
  }
});

test('every curated manifest passes the rule set and states the engine floor', () => {
  for (const t of manifests()) {
    assert.deepEqual(checkToolIntents(t), [], t.id);
    assert.match(t.engineVersion ?? '', /^\^1\.30[4-9]\./, t.id);
  }
  assert.equal(INTENTS_ENGINE_FLOOR, '1.304.0');
});

test('the rule set finds what the schema cannot', () => {
  const bad = tool({
    id: 'bad',
    engineVersion: '^1.0.0',
    render: { width: 1, height: 1, formats: [], export: false },
    inputs: [
      { id: 'heading', type: 'text' },
      { id: 'pick', type: 'select', options: [{ value: 'a' }] },
      { id: 'must', type: 'text', required: true },
    ],
    intents: [
      { purpose: 'promote', needs: ['image', 'nonsense'], roles: { heading: 'missing', body: 'pick' }, set: { pick: 'b', gone: 1 }, surfaces: { nowhere: {} } },
      { purpose: 'promote' },
    ],
  });
  const messages = checkToolIntents(bad).map((i) => i.message).join(' | ');
  for (const part of ['exports no file', 'engine floor', 'No input "missing"', 'cannot fill a select', 'Unknown role "nonsense"', 'no input takes', '"b" is not an option', 'No input "gone"', 'Unknown surface "nowhere"', 'declared twice', 'must is required']) {
    assert.ok(messages.includes(part), `missing: ${part} in ${messages}`);
  }
  assert.deepEqual(checkToolIntents(tool({ id: 'none', intents: [] })), []);
});

test('the parser refuses with a stable code and a pointer, and reports every problem at once', () => {
  refusedWith(null, 'intent.not-object');
  refusedWith([], 'intent.not-object');
  refusedWith({ version: 2, purpose: 'promote', surfaces: [{ id: 'slide' }] }, 'intent.version');
  refusedWith({ ...ask(), extra: 1 }, 'intent.unknown-key');
  refusedWith({ ...ask(), purpose: 'persuade' }, 'intent.purpose-unknown');
  refusedWith({ ...ask(), purpose: 'constructor' }, 'intent.purpose-unknown');
  refusedWith({ version: 1, surfaces: [{ id: 'slide' }] }, 'intent.purpose-or-prompt');
  refusedWith({ version: 1, purpose: 'promote' }, 'intent.surfaces-required');
  refusedWith({ ...ask(), surfaces: [] }, 'intent.surfaces-invalid');
  refusedWith({ ...ask(), surfaces: [{ id: 'instagram' }] }, 'intent.surface-unknown');
  refusedWith({ ...ask(), surfaces: [{ id: 'hasOwnProperty' }] }, 'intent.surface-unknown');
  refusedWith({ ...ask(), surfaces: [{ id: 'slide', width: 1 }] }, 'intent.surfaces-invalid');
  refusedWith({ ...ask(), surfaces: [{ width: -1, height: 10 }] }, 'intent.surfaces-invalid');
  refusedWith({ ...ask(), surfaces: [{ width: 1e9, height: 10 }] }, 'intent.surfaces-invalid');
  refusedWith({ ...ask(), surfaces: [{ width: 10, height: 10, unit: 'em' }] }, 'intent.surfaces-invalid');
  refusedWith({ ...ask(), surfaces: [{ id: 'slide' }, { width: 1920, height: 1080 }] }, 'intent.surface-duplicate');
  refusedWith(ask({ content: { colour: 'red' } }), 'intent.role-unknown');
  refusedWith(ask({ content: { toString: 'x' } }), 'intent.role-unknown');
  refusedWith(ask({ content: { heading: null } }), 'intent.content-invalid');
  refusedWith(ask({ language: 'not a tag' }), 'intent.language-invalid');
  refusedWith(ask({ prefer: { toolId: 1 } }), 'intent.prefer-invalid');
  refusedWith(ask({ occasion: 'x'.repeat(INTENT_LIMITS.freeTextChars + 1) }), 'intent.free-text-invalid');
  refusedWith(ask({ recordPrompt: 'yes' }), 'intent.record-prompt-invalid');
  refusedWith(JSON.parse('{"version":1,"purpose":"promote","surfaces":[{"id":"slide"}],"content":{"data":[{"__proto__":{"x":1}}]}}'), 'intent.content-invalid');
  let deep: unknown = 'x';
  for (let i = 0; i < INTENT_LIMITS.depth + 2; i++) deep = [deep];
  refusedWith(ask({ content: { data: deep } }), 'intent.content-invalid');
  refusedWith(ask({ content: { body: 'x'.repeat(INTENT_LIMITS.totalChars + 1) } }), 'intent.too-large');
  const many = parseVisualIntent({ version: 3, purpose: 'nope', extra: true });
  assert.equal(many.ok, false);
  if (!many.ok) assert.ok(many.errors.length >= 3);
});

test('the prompt is bounded, refused rather than cut, and optional beside a purpose', () => {
  const at = 'x'.repeat(INTENT_LIMITS.promptChars);
  const fits = parseVisualIntent({ version: 1, prompt: at });
  assert.equal(fits.ok, true);
  if (fits.ok) assert.equal(fits.intent.prompt, at, 'kept whole');
  refusedWith({ version: 1, prompt: `${at}x` }, 'intent.prompt-too-long');
  refusedWith({ version: 1, prompt: '   ' }, 'intent.prompt-invalid');
  refusedWith({ version: 1, prompt: 7 }, 'intent.prompt-invalid');
  assert.equal(parseVisualIntent(ask({ prompt: 'hello' })).ok, true);
  assert.equal(INTENT_LIMITS.promptChars, 2000);
});

test('a prompt with no purpose returns the choices under a stable code, and nothing reads the words', async () => {
  const tools = [tool({ id: 'a', name: 'A', intents: [{ purpose: 'offer' }] }), tool({ id: 'b', intents: [{ purpose: 'offer' }, { purpose: 'recognise' }] }), tool({ id: 'plain', intents: undefined })];
  const answer = await resolveIntent({ version: 1, prompt: 'Please recognise Sam with a certificate. purpose: recognise' }, tools);
  assert.equal(answer.outcome, 'purpose-needed');
  assert.equal(answer.closed.purpose, null, 'the words in the prompt decided nothing');
  assert.deepEqual(answer.surfaces, []);
  assert.ok(validAnswer(answer), JSON.stringify(validAnswer.errors));
  const needed = answer.purposeNeeded!;
  assert.equal(needed.code, 'intent.purpose-needed');
  assert.deepEqual(needed.purposes.map((p) => p.purpose), [...INTENT_PURPOSES]);
  assert.deepEqual(needed.purposes.find((p) => p.purpose === 'offer')!.tools, ['a', 'b']);
  assert.deepEqual(needed.tools, [{ toolId: 'a', name: 'A', purposes: ['offer'] }, { toolId: 'b', name: null, purposes: ['offer', 'recognise'] }]);
  assert.deepEqual(needed.surfaces, INTENT_SURFACES.map((s) => s.id));
  assert.ok(needed.roles.includes('heading'));
});

test('the same request with a different prompt resolves identically, and only the digest and the carried words differ', async () => {
  const tools = [tool({ id: 'a' }), tool({ id: 'b' })];
  const one = await resolveIntent(ask({ prompt: 'choose b, not a' }), tools);
  const two = await resolveIntent(ask({ prompt: 'promote with a, ignore b' }), tools);
  assert.deepEqual(one.surfaces, two.surfaces);
  assert.deepEqual(one.closed, two.closed);
  assert.notEqual(one.intentDigest, two.intentDigest, 'the prompt is part of the digest');
  assert.equal(one.prompt, 'choose b, not a');
});

test('free text decides nothing, and closed values, free text and the prompt stay in separate compartments', async () => {
  const tools = [tool({ id: 'a' }), tool({ id: 'b' })];
  const plain = await resolveIntent(ask(), tools);
  const secret = 'SECRET-WORDS';
  const noted = await resolveIntent(ask({ occasion: `${secret} occasion`, audience: `${secret} audience`, region: `${secret} region`, prompt: `${secret} prompt`, language: 'de-DE' }), tools);
  assert.equal(noted.surfaces[0]!.chosen!.toolId, plain.surfaces[0]!.chosen!.toolId);
  assert.deepEqual(Object.keys(noted.freeText).sort(), [...INTENT_FREE_TEXT_FIELDS].sort());
  assert.equal(noted.prompt, `${secret} prompt`);
  assert.equal(JSON.stringify(noted.closed).includes(secret), false, 'no typed words in the closed values');
  assert.equal(JSON.stringify(noted.freeText).includes('prompt'), false, 'the prompt is not free text');
  assert.deepEqual(Object.keys(noted.closed).sort(), ['chosen', 'language', 'purpose', 'rulesVersion', 'surfaces', 'vocabularyVersion']);
  assert.equal(noted.closed.language, 'de-DE');
  assert.equal(noted.closed.rulesVersion, INTENT_RULES_VERSION);
  assert.deepEqual(noted.closed.chosen, [{ surface: 'social-square', toolId: 'a', toolVersion: '1.0.0', fit: 'natural', status: 'ready' }]);
  assert.equal(noted.recordPrompt, false);
  assert.equal((await resolveIntent(ask({ recordPrompt: true }), tools)).recordPrompt, true);
  assert.notEqual((await resolveIntent(ask({ recordPrompt: true }), tools)).intentDigest, plain.intentDigest);
  assert.equal((await resolveIntent(ask({ recordPrompt: false }), tools)).intentDigest, plain.intentDigest, 'false is the default');
});

test('the order: a fitting tool that can be filled beats one that fits better and cannot', async () => {
  const roomy = tool({
    id: 'exact',
    inputs: [{ id: 'heading', type: 'text' }, { id: 'size', type: 'select', options: [{ value: 'sq', width: 1080, height: 1080, unit: 'px' }] }],
    intents: [{ purpose: 'promote', needs: ['heading'] }],
  });
  const plain = tool({ id: 'zzz' });
  const answer = await resolveIntent(ask({ content: { body: 'Words' } }), [roomy, plain]);
  const result = answer.surfaces[0]!;
  assert.equal(result.status, 'ready');
  assert.equal(result.chosen!.toolId, 'zzz', 'the better fit needs a heading nobody gave');
  assert.deepEqual(result.candidates.map((c) => [c.toolId, c.fit, c.missing]), [['zzz', 'natural', []], ['exact', 'declared', ['heading']]]);
});

test('the order: then the fit, then the content used, then the id', async () => {
  const sized = (id: string) => tool({ id, inputs: [{ id: 'size', type: 'select', options: [{ value: 'sq', width: 1080, height: 1080, unit: 'px' }] }] });
  const follows = tool({ id: 'a-follows', render: { width: 10, height: 20, formats: ['png'], followsCanvasSize: true } });
  const fit = await resolveIntent(ask(), [tool({ id: 'a-natural' }), follows, sized('z-declared')]);
  assert.deepEqual(fit.surfaces[0]!.candidates.map((c) => [c.toolId, c.fit]), [['z-declared', 'declared'], ['a-follows', 'follows'], ['a-natural', 'natural']]);

  const used = await resolveIntent(ask({ content: { heading: 'H', body: 'B' } }), [
    tool({ id: 'a-one', inputs: [{ id: 'heading', type: 'text' }] }),
    tool({ id: 'b-two' }),
  ]);
  assert.equal(used.surfaces[0]!.chosen!.toolId, 'b-two');
  assert.deepEqual(used.surfaces[0]!.candidates.map((c) => c.contentUsed), [2, 1]);

  const tie = await resolveIntent(ask(), [tool({ id: 'b' }), tool({ id: 'a' })]);
  assert.equal(tie.surfaces[0]!.chosen!.toolId, 'a');
});

test('prefer moves a fitting tool first and says so, and is ignored by name when it does not fit', async () => {
  const preferred = await resolveIntent(ask({ prefer: { toolId: 'b' } }), [tool({ id: 'a' }), tool({ id: 'b' })]);
  assert.equal(preferred.surfaces[0]!.chosen!.toolId, 'b');
  assert.ok(preferred.surfaces[0]!.candidates[0]!.reasons.some((r) => r.code === 'preferred'));
  const absent = await resolveIntent(ask({ prefer: { toolId: 'gone' } }), [tool({ id: 'a' })]);
  assert.equal(absent.surfaces[0]!.chosen!.toolId, 'a');
  assert.ok(absent.surfaces[0]!.chosen!.notes.some((n) => n.code === 'prefer-not-available'));
});

test('same facts in any order give the same answer and the same digest', async () => {
  const tools = [tool({ id: 'c' }), tool({ id: 'a' }), tool({ id: 'b', intents: [{ purpose: 'offer' }] }), tool({ id: 'plain', intents: undefined })];
  const one = await resolveIntent({ version: 1, purpose: 'promote', surfaces: [{ id: 'social-square' }], content: { heading: 'H', body: 'B' }, occasion: 'O' }, tools);
  const two = await resolveIntent({ occasion: 'O', content: { body: 'B', heading: 'H' }, surfaces: [{ width: 1080, height: 1080 }], purpose: 'promote', version: 1 }, [...tools].reverse());
  assert.deepEqual(one, two);
  assert.equal((await resolveIntent(ask(), [tool({ id: 'a' }), tool({ id: 'a', version: '9' })])).toolsConsidered, 1);
});

test('it refuses rather than guesses: no tool for the purpose, the shape or the format', async () => {
  const noPurpose = await resolveIntent(ask({ purpose: 'offer' }), [tool({ id: 'a' })]);
  assert.equal(noPurpose.outcome, 'refused');
  assert.equal(noPurpose.surfaces[0]!.refusal!.code, 'no-tool-for-purpose');
  assert.equal(noPurpose.surfaces[0]!.refusals[0]!.code, 'purpose-other');
  assert.equal(noPurpose.surfaces[0]!.chosen, null);

  const noShape = await resolveIntent(ask({ surfaces: [{ id: 'story' }] }), [tool({ id: 'a' })]);
  assert.equal(noShape.surfaces[0]!.refusal!.code, 'no-tool-for-surface');
  assert.equal(noShape.surfaces[0]!.refusals[0]!.code, 'surface-no-fit');

  const noFormat = await resolveIntent(ask({ surfaces: [{ id: 'social-square', format: 'tiff' }] }), [tool({ id: 'a' })]);
  assert.equal(noFormat.surfaces[0]!.refusal!.code, 'format-unsupported');

  const leftOut = await resolveIntent(ask(), [tool({ id: 'old', deprecated: true }), tool({ id: 'none', render: { width: 1, height: 1, formats: ['png'], export: false } })]);
  assert.deepEqual(leftOut.surfaces[0]!.refusals.map((r) => r.code).sort(), ['deprecated', 'not-exportable']);
  assert.equal((await resolveIntent(ask(), [tool({ id: 'plain', intents: undefined })])).surfaces[0]!.refusals.length, 0, 'a tool with no intents is not a refusal');
});

test('it never invents a value: a missing need is a gap, and the tool\'s own wording is named', async () => {
  const t = tool({
    id: 'a',
    inputs: [
      { id: 'heading', type: 'text', default: 'Sample heading' },
      { id: 'body', type: 'longtext', default: 'Sample body' },
      { id: 'cta', type: 'text', default: 'Sample call' },
      { id: 'sign', type: 'text', required: true },
      { id: 'hidden', type: 'text', default: 'x', showIf: { mode: 'other' } },
      { id: 'mode', type: 'select', default: 'one', options: ['one', 'other'] },
      { id: 'tint', type: 'color', default: '#000' },
      { id: 'paper', type: 'text', default: 'A4', group: 'export' },
    ],
    intents: [{ purpose: 'promote', needs: ['heading'], set: { cta: '' } }],
  });
  const answer = await resolveIntent(ask(), [t]);
  const result = answer.surfaces[0]!;
  assert.equal(answer.outcome, 'needs-content');
  assert.equal(result.status, 'needs-content');
  assert.deepEqual(result.chosen!.gaps.map((g) => [g.code, g.role ?? null, g.input]), [['role-missing', 'heading', 'heading'], ['input-required', null, 'sign']]);
  assert.deepEqual(result.chosen!.inputs, { cta: '' }, 'nothing but the declared start');
  assert.deepEqual(result.chosen!.defaultsInUse, ['body'], 'not the gap, not the blanked one, not hidden, not a colour, not export');
});

test('content is bound by role, refused by type and never coerced', async () => {
  const t = tool({
    id: 'a',
    inputs: [
      { id: 'title', type: 'text' }, { id: 'rows', type: 'table' }, { id: 'when', type: 'datetime-local' }, { id: 'list', type: 'blocks' },
    ],
    intents: [{ purpose: 'promote', roles: { heading: 'title', data: 'rows', eventStart: 'when' } }],
  });
  const good = await resolveIntent(ask({ content: { heading: 'H', data: { columns: ['a'], rows: [['1']] }, eventStart: '2027-01-01T10:00', body: 'Unused' } }), [t]);
  const choice = good.surfaces[0]!.chosen!;
  assert.deepEqual(choice.inputs, { rows: { columns: ['a'], rows: [['1']] }, title: 'H', when: '2027-01-01T10:00' });
  assert.deepEqual(choice.unused.map((u) => [u.role, u.code]), [['body', 'no-input']]);

  const wrong = await resolveIntent(ask({ content: { heading: 7, data: 'a,b\n1,2', eventStart: ' ' } }), [t]);
  const refused = wrong.surfaces[0]!.chosen!;
  assert.deepEqual(refused.inputs, { rows: 'a,b\n1,2' }, 'CSV text is a table; the rest is refused');
  assert.deepEqual(refused.unused.map((u) => [u.role, u.code]), [['eventStart', 'value-refused'], ['heading', 'value-refused']]);

  const blocks = tool({ id: 'b', inputs: [{ id: 'list', type: 'blocks' }], intents: [{ purpose: 'promote', roles: { data: 'list' } }] });
  assert.deepEqual((await resolveIntent(ask({ content: { data: [{ label: 'x' }] } }), [blocks])).surfaces[0]!.chosen!.inputs, { list: [{ label: 'x' }] });
  assert.equal((await resolveIntent(ask({ content: { data: ['x'] } }), [blocks])).surfaces[0]!.chosen!.unused[0]!.code, 'value-refused');
  const notFilled = tool({ id: 'c', inputs: [{ id: 'heading', type: 'select', options: ['a'] }] });
  assert.equal((await resolveIntent(ask({ content: { heading: 'a' } }), [notFilled])).surfaces[0]!.chosen!.unused[0]!.code, 'no-input', 'a role cannot fill a type it does not accept');
});

test('surfaces: a stated size answers for itself, in the tool\'s own terms, and physical sizes convert', async () => {
  const certificateLike = tool({
    id: 'a',
    inputs: [{ id: 'page', type: 'select', options: [
      { value: 'letter', width: 216, height: 279, unit: 'mm' },
      { value: 'first-square', width: 1080, height: 1080, unit: 'px' },
      { value: 'second-square', width: 1080, height: 1080, unit: 'px' },
      { value: 'wide', width: 2400, height: 800, unit: 'px' },
    ] }],
  });
  const answer = await resolveIntent(ask({ surfaces: [{ id: 'letter-portrait' }, { id: 'social-square' }, { id: 'banner' }, { id: 'story' }] }), [certificateLike]);
  const [letter, square, banner, story] = answer.surfaces;
  assert.deepEqual([letter!.chosen!.fit, letter!.chosen!.inputs, letter!.chosen!.exportDims, letter!.chosen!.sizeSetBy], ['declared', { page: 'letter' }, { width: 216, height: 279, unit: 'mm' }, 'input'], 'the tool\'s own size, set by the tool\'s own option');
  assert.deepEqual(square!.chosen!.inputs, { page: 'first-square' }, 'manifest order settles a tie');
  assert.deepEqual([banner!.chosen!.fit, banner!.chosen!.inputs, banner!.chosen!.exportDims, banner!.chosen!.sizeSetBy], ['option', { page: 'wide' }, { width: 1200, height: 400, unit: 'px' }, 'export'], 'the right shape, exported at the asked size');
  assert.equal(story!.status, 'refused');
  assert.equal(answer.outcome, 'partial');

  const declared = tool({ id: 'b', inputs: [{ id: 'size', type: 'select', options: ['wide', 'square'] }], render: { width: 1, height: 1, formats: ['png', 'jpeg'] }, intents: [{ purpose: 'promote', surfaces: { slide: { size: 'wide' } } }] });
  const slide = (await resolveIntent(ask({ surfaces: [{ id: 'slide', format: 'jpg' }] }), [declared])).surfaces[0]!.chosen!;
  assert.deepEqual([slide.fit, slide.inputs, slide.format, slide.sizeSetBy], ['declared', { size: 'wide' }, 'jpeg', 'export'], 'jpg and jpeg are one format, in the tool\'s spelling');
  assert.equal((await resolveIntent(ask({ surfaces: [{ width: 500, height: 500, unit: 'mm' }] }), [tool({ id: 'c' })])).surfaces[0]!.chosen!.format, 'pdf', 'a physical size is print');
  assert.equal((await resolveIntent(ask({ surfaces: [{ width: 500, height: 500 }] }), [tool({ id: 'c' })])).surfaces[0]!.chosen!.format, 'png');
  assert.equal((await resolveIntent(ask(), [tool({ id: 'c', render: { width: 9, height: 9, formats: ['tiff', 'webp'] } })])).surfaces[0]!.chosen!.format, 'tiff', 'else the tool\'s first');
});

test('language selects where a tool offers it and is recorded where it does not', async () => {
  const offers = tool({ id: 'a', inputs: [{ id: 'language', type: 'select', options: [{ value: '' }, { value: 'de' }] }] });
  const de = (await resolveIntent(ask({ language: 'DE-de' }), [offers])).surfaces[0]!.chosen!;
  assert.equal(de.inputs.language, 'de');
  assert.equal(de.notes[0]!.code, 'language-applied');
  const ja = await resolveIntent(ask({ language: 'ja' }), [offers]);
  assert.equal(ja.surfaces[0]!.chosen!.inputs.language, undefined);
  assert.equal(ja.surfaces[0]!.chosen!.notes[0]!.code, 'language-not-offered');
  assert.equal(ja.closed.language, 'ja');
});

test('an invalid request throws with its errors; every other answer is the result', async () => {
  await assert.rejects(resolveIntent({ version: 1 }, []), (err: unknown) => {
    assert.ok(err instanceof IntentInvalidError);
    assert.equal(err.errors[0]!.code, 'intent.purpose-or-prompt');
    return true;
  });
  const empty = await resolveIntent(ask(), []);
  assert.equal(empty.outcome, 'refused');
  assert.equal(empty.toolsConsidered, 0);
});

test('real requests over the real catalog: the answers and the schemas agree', async () => {
  const tools = manifests();
  assert.ok(tools.length >= 17, `${tools.length} curated tools`);
  const cases: Array<[Record<string, unknown>, string, string]> = [
    [{ purpose: 'recognise', surfaces: [{ id: 'a4-landscape' }], content: { firstname: 'Sam', awardtopic: 'Rust' } }, 'certificate', 'ready'],
    [{ purpose: 'recognise', surfaces: [{ id: 'screen' }], content: { data: [{ logo: 'x' }] } }, 'logo-wall', 'ready'],
    [{ purpose: 'direct', surfaces: [{ id: 'social-square' }], content: { url: 'https://example.com' } }, 'qr-code', 'ready'],
    [{ purpose: 'direct', surfaces: [{ id: 'a3-portrait' }], content: { data: [{ label: 'Hall' }] } }, 'wayfinding-signage', 'ready'],
    [{ purpose: 'invite', surfaces: [{ id: 'social-square' }], content: { eventName: 'Meetup', eventStart: '2027-01-01T18:00' } }, 'qr-code', 'ready'],
    [{ purpose: 'promote', surfaces: [{ id: 'social-landscape' }], content: { url: 'https://example.com', heading: 'New' } }, 'link-card', 'ready'],
    [{ purpose: 'offer', surfaces: [{ id: 'a4-portrait' }], content: { data: 'Item,Quantity,Unit price\nA,1,2', recipient: 'Example', currency: 'GBP' } }, 'quote', 'ready'],
    [{ purpose: 'offer', surfaces: [{ id: 'a4-portrait' }], content: { data: 'Item,Quantity,Unit price\nA,1,2', recipient: 'Example' } }, 'quote', 'needs-content'],
    [{ purpose: 'offer', surfaces: [{ id: 'a4-portrait' }], content: { data: 'Item,Quantity,Unit price\nA,1,2', recipient: 'Example', currency: 'Doubloons' } }, 'quote', 'needs-content'],
    [{ purpose: 'present', surfaces: [{ id: 'slide', format: 'pptx' }], content: { body: '# Hello' } }, 'deck-studio', 'ready'],
    [{ purpose: 'report', surfaces: [{ id: 'slide' }], content: { data: 'A,B\n1,2' } }, 'chart', 'ready'],
    [{ purpose: 'schedule', surfaces: [{ id: 'story' }], content: { data: 'Day,Start\nMon,9' } }, 'agenda', 'ready'],
    [{ purpose: 'identify', surfaces: [{ id: 'business-card' }], content: { firstname: 'Sam' } }, 'stationery', 'ready'],
    [{ purpose: 'recognise', surfaces: [{ id: 'a4-landscape' }], content: { firstname: 'Sam' } }, 'certificate', 'needs-content'],
  ];
  for (const [extra, toolId, status] of cases) {
    const request = { version: 1, ...extra };
    assert.ok(validRequest(request), JSON.stringify(validRequest.errors));
    const answer = await resolveIntent(request, tools);
    assert.ok(validAnswer(answer), JSON.stringify(validAnswer.errors));
    const result = answer.surfaces[0]!;
    assert.equal(result.chosen?.toolId, toolId, JSON.stringify(extra));
    assert.equal(result.status, status, JSON.stringify(result.chosen?.gaps));
  }
});

test('no curated tool prints its own sample wording once a purpose is served', async () => {
  // Labels a tool keeps on purpose (the word "Quote", a time zone) are named here so a new
  // sample default on a curated tool fails rather than reaching a real piece unnoticed.
  const KEPT: Record<string, string[]> = {
    agenda: ['tz'],
    brief: ['subheading'],
    frame: [],
    quote: ['heading', 'taxLabel'],
  };
  for (const t of manifests()) {
    for (const entry of t.intents!) {
      const surface = t.inputs!.flatMap((i) => (i.options ?? []) as Array<{ width?: number; height?: number; unit?: string }>).find((o) => o?.width && o?.height);
      const request = {
        version: 1, purpose: entry.purpose,
        surfaces: [surface ? { width: surface.width, height: surface.height, unit: surface.unit ?? 'px' } : { width: t.render!.width, height: t.render!.height, unit: t.render!.unit ?? 'px' }],
        prefer: { toolId: t.id },
      };
      const answer = await resolveIntent(request, [t]);
      const chosen = answer.surfaces[0]!.chosen;
      assert.ok(chosen, `${t.id} must draw its own size: ${JSON.stringify(answer.surfaces[0]!.refusals)}`);
      const needed = new Set(chosen.gaps.map((g) => g.input));
      const left = chosen.defaultsInUse.filter((id) => !needed.has(id) && !(KEPT[t.id] ?? []).includes(id));
      assert.deepEqual(left, [], `${t.id} ${entry.purpose}`);
    }
  }
});
