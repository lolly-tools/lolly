// SPDX-License-Identifier: MPL-2.0
/**
 * Which theme choices change what a tool draws (lib/theme-relevance.ts, plans/319
 * decision 9). The Design system section offers light and dark, a colourway or any
 * other group only when switching it changes the colours this tool resolves. These
 * tests pin what counts as a read, which way every doubt falls (towards showing),
 * and the answer for real community tools against the public Lolly Start system.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/theme-relevance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { tokenColorVar } from '../../../../engine/src/color-face.ts';
import { addColourway, liftToColourways } from '../../../../engine/src/colourway.ts';
import { documentThemeGroups } from './document-theme.ts';
import {
  brandVarPath, optionsChangeOutput, sourceTokenUsage, tokenFingerprint, tokenUsageKey, toolTokenUsage, valueTokenUsage,
  type ToolSources, type ToolTokenUsage,
} from './theme-relevance.ts';

const START = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));

/** Lolly Start with a canonical colourway (`main`) and Persimmon. */
function colourwayDoc(): Record<string, unknown> {
  const lifted = liftToColourways(START, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  return added.doc;
}

/** A fresh sources object each time: the source reading is cached per object. */
const tool = (parts: ToolSources): ToolSources => ({ template: '', styles: null, hooksSource: null, hooksUrl: null, ...parts });
const reads = (usage: ToolTokenUsage): { paths: string[]; prefixes: string[] } => ({ paths: usage.paths, prefixes: usage.prefixes });

test('a canvas variable names the token it is painted from', () => {
  assert.equal(brandVarPath('primary'), 'color.semantic.primary');
  assert.equal(brandVarPath('on-primary'), 'color.semantic.on-primary');
  const linked = tokenColorVar('{color.ramp.primary.5}').slice('--brand-'.length);
  assert.equal(brandVarPath(linked), 'color.ramp.primary.5', 'the linked form decodes to its path');
  assert.equal(brandVarPath('token-zz'), null);
  assert.equal(brandVarPath('token-abc'), null, 'an odd number of hex digits is no path');
});

test('markup and styles read the canvas variables they name, and nothing else', () => {
  const usage = sourceTokenUsage(tool({
    template: '<div style="color: var(--brand-text, #111)">{{title}}</div>',
    styles: `.card { background: var(--brand-surface); border-color: var(${tokenColorVar('{color.ramp.neutral.3}')}); }`,
  }));
  assert.deepEqual(reads(usage), { paths: ['color.ramp.neutral.3', 'color.semantic.surface', 'color.semantic.text'], prefixes: [] });
  assert.equal(usage.all, false);
  assert.deepEqual(reads(sourceTokenUsage(tool({ template: '<p>{{text}}</p>', styles: '.p { color: #222; }' }))), { paths: [], prefixes: [] });
});

test('hooks that only resolve read what their strings name, whole or by a fixed start', () => {
  const usage = sourceTokenUsage(tool({ hooksSource: [
    "async function onInit() {",
    "  if (!host.tokens || !host.tokens.resolve) return {};",
    "  const font = await host.tokens.resolve('{font.brand}');",
    "  const ref = big ? '{font.mono}' : 'color.semantic.text';",
    "  const id = await host.tokens.resolve(ref);",
    "  const logo = await host.tokens.resolve('{asset.logo.' + variant + '}');",
    "  if (id.indexOf('{') !== -1) return {};",
    "  const json = '{\"a\":1}';",
    "  return { font, logo };",
    "}",
  ].join('\n') }));
  assert.equal(usage.all, false, "a lone '{' in a check and a JSON string are not references");
  assert.deepEqual(reads(usage), { paths: ['color.semantic.text', 'font.brand', 'font.mono'], prefixes: ['asset.logo.'] });
});

test('every way a hook can read beyond its own strings counts as reading everything', () => {
  const all = (hooksSource: string, why: string): void => {
    assert.equal(sourceTokenUsage(tool({ hooksSource })).all, true, why);
  };
  all('const swatches = await host.tokens.colors();', 'the colour list');
  all('const set = await host.tokens.get();', 'the token set');
  all("const v = await host.tokens.resolve('{' + path + '}');", 'a reference built from nothing fixed');
  all(`const v = await host.tokens.resolve(\`{\${path}}\`);`, 'the same, as a template string');
  all('const t = host.tokens; await t.resolve(x);', 'the tokens handed on whole');
  all('paint(host.tokens);', 'the tokens passed to a helper');
  all("el.style.setProperty('--brand-' + slot, v);", 'a canvas variable named at run time');
  assert.equal(sourceTokenUsage(tool({ hooksSource: 'export function onInit() {}', hooksUrl: null })).all, false);
  assert.equal(sourceTokenUsage(tool({ hooksSource: null, hooksUrl: '/tools/x/hooks.mjs' })).all, true, 'module hooks cannot be read');
  assert.equal(sourceTokenUsage(tool({ manifest: { composes: [{ id: 'logo', tool: 'qr-code' }] } })).all, true, 'a composed tool draws in the choice too');
  assert.equal(sourceTokenUsage(tool({ template: '<img src="https://lolly.tools/tool/qr-code.svg?url=x">' })).all, true, 'so does a tool link in the markup');
  // A hook that builds CSS from '{' but never reads a token adds nothing.
  assert.deepEqual(reads(sourceTokenUsage(tool({ hooksSource: "css += sel + '{' + rule + '}';" }))), { paths: [], prefixes: [] });
});

test('input values read the references they link, the variables they hold, and a treated picture any choice', () => {
  const linked = valueTokenUsage([
    { ref: '{color.semantic.primary}', value: '#1d1d1d' },
    [{ label: 'a', fill: '#fff', tokenLinks: JSON.stringify({ fill: { ref: '{color.ramp.neutral.2}', value: '#fff' } }) }],
    'var(--brand-secondary)',
    'Hello {name}, plain text',
    '#ff0000',
  ]);
  assert.deepEqual(reads(linked), { paths: ['color.ramp.neutral.2', 'color.semantic.primary', 'color.semantic.secondary', 'name'], prefixes: [] },
    'an unknown reference such as {name} resolves to nothing in every option, so it never shows a control');
  assert.equal(valueTokenUsage(['user/upload/123?treatment=warm']).any, true);
  assert.equal(valueTokenUsage(['https://lolly.tools/tool/chart.svg?type=bar']).all, true);
  assert.deepEqual(reads(valueTokenUsage(['#112233', 3, true, null])), { paths: [], prefixes: [] });
});

test('a tool reads its sources and its values together, and the key changes only with the reads', () => {
  const sources = tool({ template: '<b style="color:var(--brand-text)"></b>' });
  const plain = toolTokenUsage(sources, [{ value: '#123456' }]);
  const linked = toolTokenUsage(sources, [{ value: { ref: '{color.semantic.primary}', value: '#1d1d1d' } }]);
  assert.deepEqual(plain.paths, ['color.semantic.text']);
  assert.deepEqual(linked.paths, ['color.semantic.primary', 'color.semantic.text']);
  assert.equal(tokenUsageKey(plain), tokenUsageKey(toolTokenUsage(sources, [{ value: '#654321' }])));
  assert.notEqual(tokenUsageKey(plain), tokenUsageKey(linked));
  assert.equal(tokenUsageKey(null), 'none');
});

test('options change the output only when a read resolves differently between them', () => {
  const setFor = (option: string) => createTokenSet(START, { selection: { '': option } });
  const usage = (paths: string[], extra: Partial<ToolTokenUsage> = {}): ToolTokenUsage => ({ paths, prefixes: [], all: false, any: false, ...extra });
  assert.equal(optionsChangeOutput(['light', 'dark'], usage(['color.semantic.primary']), setFor), true);
  assert.equal(optionsChangeOutput(['light', 'dark'], usage([]), setFor), false, 'a tool that reads nothing');
  assert.equal(optionsChangeOutput(['light', 'dark'], usage(['color.ramp.neutral.3', 'font.brand']), setFor), false,
    'the neutral ramp and the brand face are the same in both looks');
  assert.equal(optionsChangeOutput(['light', 'dark'], usage([], { prefixes: ['asset.logo.'] }), setFor), false, 'so are the logos');
  assert.equal(optionsChangeOutput(['light', 'dark'], usage([], { all: true }), setFor), true, 'reading everything sees the semantic slots move');
  assert.equal(optionsChangeOutput(['light', 'dark'], usage([], { any: true }), setFor), true);
  assert.equal(optionsChangeOutput(['light'], usage(['color.semantic.primary']), setFor), false, 'one option is no choice');
  assert.equal(tokenFingerprint(setFor('light'), usage(['color.ramp.neutral.3'])), tokenFingerprint(setFor('dark'), usage(['color.ramp.neutral.3'])));
});

test('with colourways, each group is offered only for the tools whose reads it moves', () => {
  const doc = colourwayDoc();
  const groups = (paths: string[]) => documentThemeGroups(doc, undefined, { usage: { paths, prefixes: [], all: false, any: false } }).map((g) => g.kind);
  assert.deepEqual(groups(['color.semantic.primary']), ['colourway', 'mode'], 'the lead moves with both');
  assert.deepEqual(groups(['color.semantic.surface']), ['mode'], 'a colourway re-points the lead, not the surface');
  assert.deepEqual(groups(['color.ramp.neutral.3']), [], 'nothing this tool reads moves');
  assert.deepEqual(groups([]), []);
  // In dark, Persimmon still moves the lead, so the dots stay.
  assert.deepEqual(documentThemeGroups(doc, { '': 'dark', colourway: 'main' }, { usage: { paths: ['color.semantic.primary'], prefixes: [], all: false, any: false } }).map((g) => g.kind), ['colourway', 'mode']);
});

test('real community tools: a utility that draws no design-system colour shows nothing, a branded tool shows both', () => {
  const doc = colourwayDoc();
  const community = (id: string): ToolSources & { inputs: Array<{ default?: unknown }> } => {
    const dir = new URL(`../../../../community/${id}/`, import.meta.url);
    const read = (file: string): string | null => (existsSync(new URL(file, dir)) ? readFileSync(new URL(file, dir), 'utf8') : null);
    const manifest = JSON.parse(read('tool.json')!);
    // The files the engine loader reads (presentation.js only for a portable render).
    return {
      manifest, template: read('template.html'), styles: read('styles.css'), hooksSource: read('hooks.js'), hooksUrl: null,
      presentationSource: manifest.render?.portable ? read('presentation.js') : null, inputs: manifest.inputs ?? [],
    };
  };
  const offered = (id: string): Array<string | null> => {
    const t = community(id);
    const usage = toolTokenUsage(t, t.inputs.map((input) => ({ value: input.default })));
    return documentThemeGroups(doc, undefined, { usage }).map((g) => g.kind);
  };
  assert.deepEqual(offered('strip-data'), [], 'Strip Data removes metadata and draws no colour');
  assert.deepEqual(offered('prompt-card'), [], 'Prompt Card draws in its own fixed colours');
  assert.deepEqual(offered('qr-code'), ['colourway', 'mode']);
  assert.deepEqual(offered('snippet'), ['colourway', 'mode'], 'Snippet reads the lead in its portable presentation');
  assert.deepEqual(offered('wordmark'), ['mode'], 'Wordmark draws in the text colour, which a colourway leaves alone');
});
