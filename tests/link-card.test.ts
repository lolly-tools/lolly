// SPDX-License-Identifier: MPL-2.0
/**
 * Link Card (community/link-card) - share-card contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine, so this guards the shipped tool rather than a fixture.
 *
 * What the tool promises, and what is checked here:
 *
 *  1. The `layout` select is the export-size driver: each option carries the
 *     size its platform wants (Open Graph 1200 x 630, square 1080, summary
 *     1200 x 600), discovered by the shell's own rule
 *     (shells/web/src/views/export-size.ts, imported rather than copied), and
 *     the hook's table agrees with the manifest because each render stamps
 *     data-card-w / -h / -unit on the root.
 *  2. The address is printed the way a reader says it: no protocol, no
 *     credentials, no path, no leading www.
 *  3. The thumbnail is framed by the plans/148 recipe - object-fit: cover,
 *     object-position from X / Y, and a scale about that same point.
 *  4. An empty thumbnail slot draws a designed monogram panel. Never a broken
 *     image element.
 *  5. The tool adds NO network surface: no `network` block, no capabilities,
 *     no authored `composes`. The live-screenshot path is the asset picker's
 *     paste-a-Lolly-link route, which the runtime owns.
 *  6. Every example, template and preset seed hydrates with no hook error.
 *
 * Run with: node --test tests/link-card.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { exportSizeDriver } from '../shells/web/src/views/export-size.ts';
import { baseHost } from './helpers/host.ts';

// Load from the SOURCE pack, not the gitignored tools/ profile view, so the
// suite is profile-independent: skip only when community/ is not checked out
// (a clone without submodules); with it present, a missing tool dir means a
// rename or a delete and must FAIL loudly.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMUNITY = join(ROOT, 'community');
const TOOL_DIR = join(COMMUNITY, 'link-card');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
    'community/link-card/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('link-card', fetchFile);

// The three sizes this tool exists to produce, in CSS pixels.
const EXPECTED = {
  'og-horizontal': { width: 1200, height: 630, unit: 'px' },
  square: { width: 1080, height: 1080, unit: 'px' },
  'twitter-summary': { width: 1200, height: 600, unit: 'px' },
};

async function mount(values: Record<string, any>, host: any = baseHost()) {
  const rt = await createRuntime(tool, host, values);
  return { rt, html: rt.getHydrated() as string };
}

test('the layout select is the export-size driver, with a real size per option', { skip: SKIP }, () => {
  const driver = exportSizeDriver(tool.manifest);
  assert.ok(driver, 'no select carries width/height - the shell would export at the canvas size');
  // The FIRST qualifying select wins in the shell, so it has to be this one.
  assert.equal(driver!.id, 'layout');
  assert.deepEqual(driver!.dims, EXPECTED);
});

test('the render canvas is the default layout, not some other shape', { skip: SKIP }, () => {
  // render.width/height is what the CLI rasterises at with no --width, and the
  // aspect the gallery sizes the info-modal preview to.
  const { width: rw, height: rh } = tool.manifest.render;
  const dflt = tool.manifest.inputs.find((i: any) => i.id === 'layout').default;
  const size = EXPECTED[dflt as keyof typeof EXPECTED];
  assert.ok(size, `the default layout "${dflt}" is not one of the declared sizes`);
  assert.equal(rw / rh, size.width / size.height,
    `render ${rw}x${rh} is not the shape of the default layout (${size.width}x${size.height})`);
});

test('every layout renders the size it declares', { skip: SKIP }, async () => {
  for (const [layout, size] of Object.entries(EXPECTED)) {
    const { rt, html } = await mount({ layout });
    assert.equal(rt.getHydratedString('{{error}}'), '', `${layout}: hook reported an error`);
    assert.match(html, new RegExp(`data-card-w="${size.width}"`), `${layout}: wrong card width in the render`);
    assert.match(html, new RegExp(`data-card-h="${size.height}"`), `${layout}: wrong card height in the render`);
    assert.match(html, /data-card-unit="px"/, `${layout}: card unit is not px`);
  }
});

test('an unknown layout falls back to the Open Graph card', { skip: SKIP }, async () => {
  const { rt, html } = await mount({ layout: 'not-a-layout' });
  assert.equal(rt.getHydratedString('{{error}}'), '');
  assert.match(html, /data-card-w="1200"/);
  assert.match(html, /data-card-h="630"/);
});

test('the address is printed protocol-less, with the path trimmed off', { skip: SKIP }, async () => {
  const cases: Array<[string, string]> = [
    ['https://atlasfield.io/notes/quiet-interfaces', 'atlasfield.io'],
    ['http://www.example.com/', 'example.com'],
    ['atlasfield.io/notes', 'atlasfield.io'],
    ['https://user:pw@internal.example.org/a?b=1#c', 'internal.example.org'],
    ['HTTPS://LOLLY.Tools', 'lolly.tools'],
    // The port stays: localhost without :3000 is a different machine.
    ['http://localhost:3000/preview', 'localhost:3000'],
    // Only the LEADING www goes; a real sub-domain called www keeps its place.
    ['https://sub.www.example.com/x', 'sub.www.example.com'],
    ['https://example.com.', 'example.com'],
    ['   https://atlasfield.io   ', 'atlasfield.io'],
    // Protocol-relative, the form people copy out of page source. Splitting on
    // "/" before the scheme is stripped would leave nothing at all here.
    ['//example.com/x', 'example.com'],
    ['//www.example.com', 'example.com'],
    ['', ''],
  ];
  for (const [raw, want] of cases) {
    const { rt } = await mount({ url: raw });
    assert.equal(rt.getHydratedString('{{hostDisplay}}'), want, `url ${JSON.stringify(raw)}`);
  }

  // And it reaches the chip, beside the site's initial.
  const { html } = await mount({ url: 'https://www.atlasfield.io/notes', siteName: 'Atlas Field' });
  assert.match(html, /<span class="lc-host">atlasfield\.io<\/span>/);
  assert.match(html, /<span class="lc-favicon">A<\/span>/);
  assert.ok(!html.includes('https://'), 'the protocol was printed on the card');
});

test('the chip is dropped rather than printed empty', { skip: SKIP }, async () => {
  const { html } = await mount({ url: '', siteName: '' });
  assert.ok(!html.includes('lc-chip'), 'an empty chip was rendered');
  // The monogram still has something to say on the placeholder panel.
  assert.match(html, /<span class="lc-placeholder-mark">·<\/span>/);
});

test('the monogram is the initial in any script, not only Latin', { skip: SKIP }, async () => {
  // An ASCII-only match printed the missing-value dot for a perfectly good
  // name, which reads on the card as a render fault.
  const mark = async (values: Record<string, unknown>) =>
    (await mount(values)).rt.getHydratedString('{{monogram}}');

  assert.equal(await mark({ siteName: 'Atlas Field' }), 'A');
  assert.equal(await mark({ siteName: 'ателье', url: '' }), 'А');
  assert.equal(await mark({ siteName: '日本語', url: '' }), '日');
  assert.equal(await mark({ siteName: 'مرحبا', url: '' }), 'م');
  // Punctuation is skipped in favour of the first real character.
  assert.equal(await mark({ siteName: '"quoted"', url: '' }), 'Q');
  // Nothing to say in either field: the dot, not an empty chip.
  assert.equal(await mark({ siteName: '---', url: '' }), '·');
  // The address is the second source, still without an ASCII rule.
  assert.equal(await mark({ siteName: '', url: 'https://пример.рф/x' }), 'П');
});

test('the a11y summary never reads back an empty half', { skip: SKIP }, async () => {
  // manifest.a11yLabel is the canvas's whole accessible name. The `default`
  // helper is `??`, so it keeps an empty string - the fallbacks have to come
  // from the hook or a cleared field renders as "Link card for : ".
  const label = tool.manifest.a11yLabel as string;
  const say = async (values: Record<string, unknown>) =>
    (await mount(values)).rt.getHydratedString(label);

  assert.equal(await say({ siteName: 'Atlas Field', heading: 'Quiet interfaces' }),
    'Link card for Atlas Field: Quiet interfaces');
  // No site name: the address stands in for it.
  assert.equal(await say({ siteName: '', url: 'https://atlasfield.io/x', heading: 'Quiet interfaces' }),
    'Link card for atlasfield.io: Quiet interfaces');
  // Neither, and no title either.
  assert.equal(await say({ siteName: '', url: '', heading: '' }),
    'Link card for a link: an untitled page');
});

test('the thumbnail is framed by the plans/148 recipe', { skip: SKIP }, async () => {
  const style = async (imageFraming: unknown) =>
    (await mount({ imageFraming })).rt.getHydratedString('{{framingStyle}}');

  assert.equal(await style(undefined),
    'object-fit:cover;object-position:50% 50%;transform:scale(calc(100 / 100));transform-origin:50% 50%');
  assert.equal(await style({ zoom: 180, x: 20, y: 75 }),
    'object-fit:cover;object-position:20% 75%;transform:scale(calc(180 / 100));transform-origin:20% 75%');

  // Out-of-range and junk values clamp to the declared field ranges rather than
  // emitting a style the browser drops on the floor.
  assert.equal(await style({ zoom: 9000, x: -50, y: 'nope' }),
    'object-fit:cover;object-position:0% 50%;transform:scale(calc(400 / 100));transform-origin:0% 50%');

  // The vector input's own defaults must be the same three numbers, or the
  // control and the render disagree the moment someone touches one field.
  const fields = tool.manifest.inputs.find((i: any) => i.id === 'imageFraming').fields;
  assert.deepEqual(fields.map((f: any) => [f.id, f.default, f.min, f.max]),
    [['zoom', 100, 100, 400], ['x', 50, 0, 100], ['y', 50, 0, 100]]);
});

test('a picked thumbnail is placed with that style, and nothing else is', { skip: SKIP }, async () => {
  const { html } = await mount({ image: { id: 'demo/shot' }, imageFraming: { zoom: 150, x: 10, y: 90 } });
  assert.match(html, /<img class="lc-thumb" src="asset:demo\/shot" alt="" style="object-fit:cover;object-position:10% 90%;transform:scale\(calc\(150 \/ 100\)\);transform-origin:10% 90%">/);
  assert.ok(!html.includes('lc-placeholder'), 'the placeholder rendered on top of a real thumbnail');
});

test('an empty thumbnail slot draws the monogram panel, not a broken image', { skip: SKIP }, async () => {
  for (const thumb of [undefined, '', null]) {
    const { rt, html } = await mount({ image: thumb, siteName: 'Atlas Field' });
    assert.equal(rt.getHydratedString('{{error}}'), '', `thumb ${JSON.stringify(thumb)}: hook reported an error`);
    assert.equal(rt.getHydratedString('{{hasThumb}}'), 'false');
    assert.match(html, /<div class="lc-placeholder"/, `thumb ${JSON.stringify(thumb)}: no placeholder panel`);
    assert.match(html, /<span class="lc-placeholder-mark">A<\/span>/);
    assert.ok(!/<img class="lc-thumb"/.test(html), 'an empty slot produced an image element');
  }
});

test('the tool adds no network surface of its own', { skip: SKIP }, () => {
  // The live-screenshot thumb is the asset picker's paste-a-Lolly-link path,
  // which the runtime owns (host.compose.renderUrl). The tool itself never
  // fetches the page: community/url-shot has no title/description extraction
  // to reuse, so the title and the description are typed in.
  const m = tool.manifest;
  assert.equal(m.network, undefined, 'a network allowlist appeared - the card fetches nothing');
  assert.equal(m.capabilities, undefined, 'a capability was declared - the card must run on every shell');
  assert.equal(m.composes, undefined, 'an authored composes entry appeared - the picker path needs none');

  const thumb = m.inputs.find((i: any) => i.id === 'image');
  assert.equal(thumb.type, 'asset');
  assert.equal(thumb.assetType, 'image');
  assert.equal(thumb.allowUpload, true);
  assert.match(thumb.help, /URL Capture link/, 'the help must point at the paste-a-link path');
});

test('the canonical ids keep their canonical types', { skip: SKIP }, async () => {
  // A divergent type here breaks the /batch merge contract (one column across
  // tools) and only warns in the catalog validator, so pin it.
  const canonical = JSON.parse(await readFile(join(ROOT, 'schemas', 'canonical-inputs.json'), 'utf8')).inputs;
  const used = ['url', 'heading', 'body', 'color', 'background', 'image', 'imageFraming'];
  for (const id of used) {
    const declared = tool.manifest.inputs.find((i: any) => i.id === id);
    assert.ok(declared, `${id} is missing - the tool promised the canonical id`);
    const want = canonical[id];
    if (want) assert.equal(declared.type, want.type, `${id}: type diverges from the canonical registry`);
  }
  // `url` is canonical but not in the registry table; it is a URL contract all
  // the same, and the field people paste into.
  assert.equal(tool.manifest.inputs.find((i: any) => i.id === 'url').type, 'url');
});

test('every example seed hydrates', { skip: SKIP }, async () => {
  const examples = tool.manifest.examples ?? [];
  assert.ok(examples.length >= 3, 'the gallery wants three or four looks');
  for (const ex of examples) {
    const { rt, html } = await mount(ex.values);
    assert.equal(rt.getHydratedString('{{error}}'), '', `example "${ex.label}" reported an error`);
    assert.ok(html.includes('lc-card'), `example "${ex.label}" rendered nothing`);
  }
});

test('every template and preset seed hydrates', { skip: SKIP }, async () => {
  const dir = join(TOOL_DIR, 'templates');
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 2, 'expected the og and square templates');

  for (const file of files) {
    const tpl = JSON.parse(await readFile(join(dir, file), 'utf8'));
    assert.equal(tpl.id, file.replace(/\.json$/, ''), `${file}: id must match the basename`);

    const { rt, html } = await mount(tpl.values);
    assert.equal(rt.getHydratedString('{{error}}'), '', `${file}: template seed reported an error`);
    assert.ok(html.includes('lc-card'), `${file}: template seed rendered nothing`);

    for (const preset of tpl.presets ?? []) {
      // A preset is a shallow overlay on the template's own values.
      const run = await mount({ ...tpl.values, ...preset.values });
      assert.equal(run.rt.getHydratedString('{{error}}'), '', `${file}/${preset.id}: preset reported an error`);
      assert.ok(run.html.includes('lc-card'), `${file}/${preset.id}: preset rendered nothing`);
    }
  }
});

test('every clip budget is a whole number of lines, and long words wrap', { skip: SKIP }, async () => {
  const css = await readFile(join(TOOL_DIR, 'styles.css'), 'utf8');

  // Overlong copy is clipped by max-height. A budget that is not an exact
  // multiple of its line-height cuts through the next line's ascenders and
  // leaves a sliver of type along the edge of an exported card.
  // Rules as [last selector token, body]; a nested rule (".lc-square .lc-desc")
  // inherits the line-height its base rule (".lc-desc") declares.
  const rules: Array<[string, string]> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const tokens = (m[1] ?? '').trim().split(/\s+/);
    rules.push([tokens[tokens.length - 1] ?? '', m[2] ?? '']);
  }

  const lineHeights: Record<string, number> = {};
  for (const [cls, body] of rules) {
    const lh = /line-height:\s*([\d.]+)\s*;/.exec(body);
    if (lh) lineHeights[cls] = Number(lh[1]);
  }
  assert.ok(Object.keys(lineHeights).length >= 4, 'no line-heights parsed - the scan is broken, not the sheet');

  let checked = 0;
  for (const [cls, body] of rules) {
    const max = /max-height:\s*([\d.]+)em\s*;/.exec(body);
    if (!max) continue;
    const lh = lineHeights[cls];
    assert.ok(lh, `${cls} clips with max-height but declares no line-height of its own`);
    const lines = Number(max[1]) / lh;
    assert.ok(Math.abs(lines - Math.round(lines)) < 1e-6 && Math.round(lines) >= 1,
      `${cls}: max-height ${max[1]}em over line-height ${lh} is ${lines.toFixed(2)} lines, so the clip cuts mid-glyph`);
    checked++;
  }
  assert.ok(checked >= 6, `expected the six clip budgets, scanned ${checked}`);

  // A pasted address as a title is one unbreakable word; without this it runs
  // past its column and is cut off mid-word by the text block's overflow.
  assert.match(css, /\.lc-card\s*\{[^}]*overflow-wrap:\s*anywhere/,
    'the card must let an unbreakable word wrap - the property is inherited, so once is enough');
});

test('a brand lockup is discovered by tag, and the wrong polarity is refused', { skip: SKIP }, async () => {
  const withLogos = (assets: Array<{ id: string; url: string; meta: { tags: string[] } }>) =>
    baseHost({
      assets: {
        get: async (id: string) => ({ id, url: 'asset:' + id }),
        query: async (f: { tags?: string[] }) =>
          assets.filter(a => (f.tags ?? []).every(t => a.meta.tags.includes(t))),
      },
    });
  const wide = [{ id: 'b/logo/wide', url: 'asset:b/logo/wide', meta: { tags: ['logo', 'on-light', 'horizontal'] } }];
  const reverseOnly = [{ id: 'b/logo/rev', url: 'asset:rev', meta: { tags: ['logo', 'on-dark'] } }];

  const light = await mount({ background: '#ffffff' }, withLogos(wide));
  assert.match(light.html, /<img class="lc-logo" src="asset:b\/logo\/wide"/);

  // White artwork on a white card shows nothing, so the reversed lockup is
  // refused there and taken on the dark card.
  const refused = await mount({ background: '#ffffff' }, withLogos(reverseOnly));
  assert.equal(refused.rt.getHydratedString('{{logoUrl}}'), '');
  const dark = await mount({ background: '#14181b' }, withLogos(reverseOnly));
  assert.equal(dark.rt.getHydratedString('{{logoUrl}}'), 'asset:rev');
});
