/**
 * Engine contract tests.
 *
 * Run with: node --test tests/engine.test.js
 * No test framework — uses node:test built-in.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../engine/src/validate.ts';
import { parseUrlState, serializeUrlState, RESERVED } from '../engine/src/url-mode.ts';
import { buildInputModel, updateInput, modelToValues } from '../engine/src/inputs.ts';
import { hydrate, annotateTemplate } from '../engine/src/template.ts';
import { createRuntime } from '../engine/src/runtime.ts';

// ─── validate ──────────────────────────────────────────────────────────────

test('validate: accepts a well-formed minimal manifest', () => {
  const manifest: any = {
    id: 'test-tool',
    name: 'Test',
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'official',
    render: { width: 800, height: 600, formats: ['png'] },
    inputs: [],
  };
  const { valid, errors } = validateManifest(manifest);
  assert.equal(valid, true, JSON.stringify(errors));
});

test('validate: rejects manifest missing required fields', () => {
  const { valid, errors } = validateManifest({ id: 'x' });
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test('validate: rejects invalid id format', () => {
  const manifest: any = {
    id: 'Bad ID With Spaces',
    name: 'X',
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'official',
    render: { width: 1, height: 1, formats: ['png'] },
    inputs: [],
  };
  const { valid } = validateManifest(manifest);
  assert.equal(valid, false);
});

test('validate: rejects unknown status', () => {
  const manifest: any = {
    id: 'x',
    name: 'X',
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'made-up-status',
    render: { width: 1, height: 1, formats: ['png'] },
    inputs: [],
  };
  const { valid } = validateManifest(manifest);
  assert.equal(valid, false);
});

// ─── url-mode ───────────────────────────────────────────────────────────────

const SAMPLE_MANIFEST: any = {
  inputs: [
    { id: 'heading', type: 'text' },
    { id: 'count', type: 'number' },
    { id: 'enabled', type: 'boolean' },
    { id: 'logo', type: 'asset' },
  ],
};

test('url-mode: parses text, number, boolean, asset', () => {
  const { values }: any = parseUrlState(
    'heading=Hello&count=42&enabled=1&logo=suse/logo/primary',
    SAMPLE_MANIFEST,
  );
  assert.equal(values.heading, 'Hello');
  assert.equal(values.count, 42);
  assert.equal(values.enabled, true);
  assert.deepEqual(values.logo, { source: 'library', id: 'suse/logo/primary', _unresolved: true });
});

test('url-mode: ignores unknown params (forward-compat)', () => {
  const { values }: any = parseUrlState('heading=Hi&unknownParam=ignore', SAMPLE_MANIFEST);
  assert.equal(values.heading, 'Hi');
  assert.equal(values.unknownParam, undefined);
});

test('url-mode: reserved params extracted separately', () => {
  // `format` carries the output format; `export` is a presence flag that
  // triggers an immediate download. They are distinct reserved params and
  // never leak into `values`.
  const state = parseUrlState('heading=Hi&format=png&export&slot=my-save', SAMPLE_MANIFEST);
  assert.equal(state.values.heading, 'Hi');
  assert.equal(state.values.export, undefined);
  assert.equal(state.format, 'png');
  assert.equal(state.export, true);
  assert.equal(state.slot, 'my-save');
});

test('url-mode: width/height/unit/dpi extracted; junk unit ignored', () => {
  const s = parseUrlState('heading=Hi&w=210&h=297&unit=mm&dpi=300', SAMPLE_MANIFEST);
  assert.equal(s.width, 210);
  assert.equal(s.height, 297);
  assert.equal(s.unit, 'mm');
  assert.equal(s.dpi, 300);
  assert.equal(s.values.unit, undefined); // reserved — never a value
  // Invalid unit → null (caller falls back to px); long form width=/height= work too.
  const s2 = parseUrlState('width=800&height=600&unit=furlong', SAMPLE_MANIFEST);
  assert.equal(s2.width, 800);
  assert.equal(s2.unit, null);
});

test('url-mode: serialize emits unit/dpi/w/h, omits px', () => {
  const qs = serializeUrlState([], { width: 210, height: 297, unit: 'mm', dpi: 300 });
  const p = new URLSearchParams(qs);
  assert.equal(p.get('w'), '210');
  assert.equal(p.get('h'), '297');
  assert.equal(p.get('unit'), 'mm');
  assert.equal(p.get('dpi'), '300');
  // px is the default — not emitted.
  assert.equal(new URLSearchParams(serializeUrlState([], { unit: 'px' })).has('unit'), false);
});

test('url-mode: profile is a reserved export param', () => {
  // The CMYK press condition for pdf-cmyk rides as a reserved `profile` param —
  // extracted, never leaked into values, and round-trips through serialize.
  const s = parseUrlState('heading=Hi&format=pdf-cmyk&profile=swop', SAMPLE_MANIFEST);
  assert.equal(s.profile, 'swop');
  assert.equal(s.values.profile, undefined);          // reserved — never a value
  assert.equal(parseUrlState('heading=Hi', SAMPLE_MANIFEST).profile, null);
  const qs = serializeUrlState([], { profile: 'fogra51' });
  assert.equal(new URLSearchParams(qs).get('profile'), 'fogra51');
});

test('url-mode: RESERVED set matches the documented reserved-param list', () => {
  // Mirrors the header doc-comment in engine/src/url-mode.js AND the table in
  // docs/url-mode.md. The docs aren't programmatically importable, so this inline
  // list is the guard: if you add/remove a reserved param, update all three.
  const documented = [
    'format', 'export', 'copy', 'full', 'options', 'slot', 'output', 'filename',
    '_v', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'profile', 'password',
    'bleed', 'marks', 'c2pa', 'nostage', 'z', 'zx',
  ];
  assert.deepEqual([...RESERVED].sort(), [...documented].sort());
});

test('url-mode: c2pa param — on/off + lifetime parse', () => {
  const tool = { inputs: [], render: {} };
  // Absent → null so callers fall back to the tool's render.c2pa default.
  assert.equal(parseUrlState('', tool).c2pa, null);
  // A valid lifetime turns it on with that many days.
  assert.deepEqual(parseUrlState('c2pa=90', tool).c2pa, { on: true, days: 90 });
  assert.deepEqual(parseUrlState('c2pa=30', tool).c2pa, { on: true, days: 30 });
  // Bare/1 → on at the default (days null = "use the shell/CA default").
  assert.deepEqual(parseUrlState('c2pa=1', tool).c2pa, { on: true, days: null });
  assert.deepEqual(parseUrlState('c2pa=', tool).c2pa, { on: true, days: null });
  // Off-menu lifetime is on-but-defaulted, never a rogue window.
  assert.deepEqual(parseUrlState('c2pa=999', tool).c2pa, { on: true, days: null });
  // Explicit off overrides a render.c2pa default.
  assert.deepEqual(parseUrlState('c2pa=off', tool).c2pa, { on: false, days: null });
  assert.deepEqual(parseUrlState('c2pa=0', tool).c2pa, { on: false, days: null });
  // c2pa is reserved — never mistaken for a tool input.
  assert.equal('c2pa' in parseUrlState('c2pa=90', tool).values, false);
});

test('url-mode: c2pa param serialize round-trip', () => {
  assert.equal(serializeUrlState([], { c2pa: true, c2paDays: 90 }), 'c2pa=90');
  assert.equal(serializeUrlState([], { c2pa: true }), 'c2pa=1');            // on, default lifetime
  assert.equal(serializeUrlState([], { c2pa: true, c2paDays: 12 }), 'c2pa=1'); // off-menu → default marker
  assert.equal(serializeUrlState([], { c2pa: false }), 'c2pa=off');
  assert.equal(serializeUrlState([], {}), '');                              // absent → nothing
});

test('url-mode: compact blocks fold a raw comma into the last field (no shift)', () => {
  // The compact encoder percent-encodes ',' inside values, so a raw comma only
  // appears in a hand-edited URL. It must corrupt at most the LAST field rather
  // than shifting every field after it (and the tail is absorbed, never dropped).
  const manifest: any = { inputs: [{ id: 'rows', type: 'blocks', fields: [
    { id: 'a', type: 'text' }, { id: 'b', type: 'text' },
  ] }] };
  const { values }: any = parseUrlState('rows=x,y,z', manifest);
  assert.equal(values.rows.length, 1);
  assert.equal(values.rows[0].a, 'x');
  assert.equal(values.rows[0].b, 'y,z'); // overflow folded into the last field
});

test('url-mode: the compact block form cannot carry a ~ separator (why the encoder bails to JSON)', () => {
  // URLSearchParams percent-decodes the whole param value BEFORE decodeBlocksCompact
  // splits it, so a '~' can never be escaped into a compact value: even '%7E'
  // decodes to '~' first and then splits. This documents the hazard — the shell's
  // encodeBlocksCompact detects a separator-bearing value and falls back to the
  // lossless JSON form (asserted below) rather than emitting a corrupt compact link.
  const manifest: any = { inputs: [{ id: 'rows', type: 'blocks', fields: [
    { id: 'a', type: 'text' }, { id: 'b', type: 'text' },
  ] }] };
  // Escaping does NOT help: %7E is decoded to '~' by URLSearchParams, then split.
  assert.equal((parseUrlState('rows=Q1%7EQ2,5', manifest).values as any).rows.length, 2);
});

test('url-mode: a block value containing a ~ round-trips losslessly via the JSON form', () => {
  // The JSON block form (what encodeBlocksCompact bails to) is fully percent-encoded
  // as one param value, so URLSearchParams reverses it exactly and JSON.parse restores
  // the literal '~'. This is the safe path a tilde-bearing imported row takes.
  const manifest: any = { inputs: [{ id: 'rows', type: 'blocks', fields: [
    { id: 'a', type: 'text' }, { id: 'b', type: 'text' },
  ] }] };
  const query = new URLSearchParams({ rows: JSON.stringify([{ a: 'Q1~Q2', b: '5' }]) }).toString();
  const { values }: any = parseUrlState(query, manifest);
  assert.equal(values.rows.length, 1, 'stays a single block');
  assert.equal(values.rows[0].a, 'Q1~Q2');
  assert.equal(values.rows[0].b, '5');
});

test('url-mode: round-trips', () => {
  const model = [
    { id: 'heading', type: 'text', value: 'Hi there' },
    { id: 'count', type: 'number', value: 5 },
    { id: 'enabled', type: 'boolean', value: true },
    { id: 'logo', type: 'asset', value: { source: 'library', id: 'suse/logo/primary' } },
  ];
  const serialized = serializeUrlState(model);
  const { values }: any = parseUrlState(serialized, SAMPLE_MANIFEST);
  assert.equal(values.heading, 'Hi there');
  assert.equal(values.count, 5);
  assert.equal(values.enabled, true);
  assert.equal(values.logo.id, 'suse/logo/primary');
});

// ─── inputs ─────────────────────────────────────────────────────────────────

test('inputs: defaults applied when no initial value', () => {
  const manifest: any = {
    inputs: [
      { id: 'name', type: 'text', default: 'Anon' },
      { id: 'count', type: 'number', default: 10 },
    ],
  };
  const model: any = buildInputModel(manifest);
  assert.equal(model[0].value, 'Anon');
  assert.equal(model[1].value, 10);
});

test('inputs: bindToProfile pulls from profile', () => {
  const manifest: any = {
    inputs: [{ id: 'name', type: 'text', bindToProfile: 'firstname' }],
  };
  const model: any = buildInputModel(manifest, { profile: { firstname: 'Geeko' } });
  assert.equal(model[0].value, 'Geeko');
});

test('inputs: initial values override defaults and profile', () => {
  const manifest: any = {
    inputs: [{ id: 'name', type: 'text', default: 'Anon', bindToProfile: 'firstname' }],
  };
  const model: any = buildInputModel(manifest, {
    profile: { firstname: 'Geeko' },
    initial: { name: 'OverrideValue' },
  });
  assert.equal(model[0].value, 'OverrideValue');
  assert.equal(model[0].isDirty, true);
});

test('inputs: number constraints clamp to min/max on update', () => {
  const manifest: any = { inputs: [{ id: 'opacity', type: 'number', min: 0, max: 100 }] };
  let model: any = buildInputModel(manifest);
  model = updateInput(model, 'opacity', 150);
  assert.equal(model[0].value, 100);
  model = updateInput(model, 'opacity', -50);
  assert.equal(model[0].value, 0);
});

test('inputs: text maxLength truncates on update', () => {
  const manifest: any = { inputs: [{ id: 'name', type: 'text', maxLength: 5 }] };
  let model: any = buildInputModel(manifest);
  model = updateInput(model, 'name', 'TooLongValue');
  assert.equal(model[0].value, 'TooLo');
});

test('inputs: convertPaths toggle is auto-injected for vector-format tools', () => {
  const model: any = buildInputModel({ render: { formats: ['png', 'svg'] }, inputs: [{ id: 'name', type: 'text' }] });
  const cp = model.find((i: any) => i.id === 'convertPaths');
  assert.ok(cp, 'convertPaths injected when svg is a format');
  assert.equal(cp.value, true);
  assert.equal(cp.group, 'export');
  assert.equal(cp.control, 'checkbox');
  // pdf and pdf-cmyk also count as vector formats.
  assert.ok(buildInputModel({ render: { formats: ['pdf'] }, inputs: [] }).some(i => i.id === 'convertPaths'));
  assert.ok(buildInputModel({ render: { formats: ['pdf-cmyk'] }, inputs: [] }).some(i => i.id === 'convertPaths'));
});

test('inputs: convertPaths absent for raster-only tools; opt-out + no-clobber honoured', () => {
  // Raster-only tool → no toggle.
  assert.ok(!buildInputModel({ render: { formats: ['png', 'jpg'] }, inputs: [] }).some(i => i.id === 'convertPaths'));
  // render.convertPaths:false suppresses the toggle entirely even for a vector
  // format (e.g. capture tools, where text-outlining doesn't apply).
  assert.ok(!buildInputModel({ render: { formats: ['svg'], convertPaths: false }, inputs: [] }).some(i => i.id === 'convertPaths'));
  // A tool declaring its own convertPaths input is not double-injected.
  const declared: any = buildInputModel({ render: { formats: ['svg'] }, inputs: [{ id: 'convertPaths', type: 'boolean', default: false, label: 'Mine' }] })
    .filter(i => i.id === 'convertPaths');
  assert.equal(declared.length, 1);
  assert.equal(declared[0].label, 'Mine');
});

test('inputs: pickControl chooses widget by type and hints', () => {
  const manifest: any = {
    inputs: [
      { id: 'a', type: 'text' },
      { id: 'b', type: 'longtext' },
      { id: 'c', type: 'number', display: 'slider' },
      { id: 'd', type: 'color', palette: 'suse/palette/brand-core' },
      { id: 'e', type: 'color' },
      { id: 'f', type: 'asset' },
    ],
  };
  const model: any = buildInputModel(manifest);
  assert.equal(model[0].control, 'text-input');
  assert.equal(model[1].control, 'textarea');
  assert.equal(model[2].control, 'slider');
  assert.equal(model[3].control, 'palette-picker');
  assert.equal(model[4].control, 'color-picker');
  assert.equal(model[5].control, 'asset-picker');
});

test('inputs: modelToValues produces a flat object for template hydration', () => {
  const model: any = [
    { id: 'a', value: 'one' },
    { id: 'b', value: 2 },
  ];
  assert.deepEqual(modelToValues(model), { a: 'one', b: 2 });
});

// ─── template ──────────────────────────────────────────────────────────────

test('template: hydrates simple variables', () => {
  const out = hydrate('<p>{{name}}</p>', { name: 'Geeko' });
  assert.equal(out, '<p>Geeko</p>');
});

test('template: escapes HTML by default (XSS guard)', () => {
  const out = hydrate('<p>{{name}}</p>', { name: '<script>alert(1)</script>' });
  assert.equal(out.includes('<script>'), false);
  assert.equal(out.includes('&lt;script&gt;'), true);
});

test('template: triple-stache allows trusted raw HTML', () => {
  const out = hydrate('<div>{{{html}}}</div>', { html: '<em>ok</em>' });
  assert.equal(out, '<div><em>ok</em></div>');
});

test('template: asset helper returns the url', () => {
  const out = hydrate('<img src="{{asset logo}}">', {
    logo: { url: 'blob:abc', width: 200 },
  });
  assert.equal(out, '<img src="blob:abc">');
});

test('template: media helper emits <img> for a still raster/vector', () => {
  assert.equal(
    hydrate('{{media logo}}', { logo: { type: 'raster', url: 'blob:abc', meta: { name: 'Logo' } } }),
    '<img src="blob:abc" alt="Logo">',
  );
});

test('template: media helper emits an autoplaying <video> for a video asset', () => {
  const out = hydrate('{{media clip}}', { clip: { id: 'user/clip', type: 'video', url: 'blob:vid' } });
  assert.equal(out, '<video src="blob:vid" data-video-key="user/clip" autoplay loop muted playsinline></video>');
});

test('template: media helper honours playback options and a poster', () => {
  const out = hydrate('{{media clip controls=true loop=false autoplay=false}}', {
    clip: { id: 'user/clip', type: 'video', url: 'blob:vid', meta: { posterUrl: 'blob:poster' } },
  });
  assert.equal(out, '<video src="blob:vid" data-video-key="user/clip" poster="blob:poster" muted controls playsinline></video>');
});

test('template: media helper emits a lottie marker div', () => {
  const out = hydrate('{{media anim}}', { anim: { type: 'lottie', url: 'blob:json' } });
  assert.equal(out, '<div data-lottie-src="blob:json" data-lottie-loop="1" data-lottie-autoplay="1" data-lottie-fit="contain"></div>');
});

test('template: media helper escapes every interpolated attribute (no XSS)', () => {
  const out = hydrate('{{media clip}}', {
    clip: { type: 'video', url: 'blob:v"><script>alert(1)</script>' },
  });
  assert.ok(!out.includes('<script>'), 'raw script must not survive');
  assert.ok(out.includes('&quot;&gt;&lt;script&gt;'), 'quotes/brackets are escaped');
});

test('template: media helper is empty for a ref with no url', () => {
  assert.equal(hydrate('{{media logo}}', { logo: { type: 'raster' } }), '');
  assert.equal(hydrate('{{media logo}}', {}), '');
});

test('template: markdown does bold, italic, strikethrough and paragraphs', () => {
  assert.equal(hydrate('{{{markdown t}}}', { t: '**b** and *i*' }),
    '<p><strong>b</strong> and <em>i</em></p>');
  assert.equal(hydrate('{{{markdown t}}}', { t: '~~gone~~' }), '<p><del>gone</del></p>');
  assert.equal(hydrate('{{{markdown t}}}', { t: '~~**both**~~' }),
    '<p><del><strong>both</strong></del></p>');
  assert.equal(hydrate('{{{markdown t}}}', { t: 'a\n\nb' }), '<p>a</p><p>b</p>');
});

test('template: markdown renders bullet lists; lone * stays literal', () => {
  assert.equal(hydrate('{{{markdown t}}}', { t: '- one\n- **two**' }),
    '<ul><li>one</li><li><strong>two</strong></li></ul>');
  assert.equal(hydrate('{{{markdown t}}}', { t: '* a\n* b' }),
    '<ul><li>a</li><li>b</li></ul>');
  // A non-list paragraph with a stray asterisk is not turned into a list/italic.
  assert.equal(hydrate('{{{markdown t}}}', { t: 'cost is 5 * 3' }), '<p>cost is 5 * 3</p>');
});

test('template: markdown renders numbered lists (numbers baked, normalised to 1..n)', () => {
  assert.equal(hydrate('{{{markdown t}}}', { t: '1. one\n2. **two**' }),
    '<ol style="list-style:none"><li><span class="md-index">1.</span> one</li>' +
    '<li><span class="md-index">2.</span> <strong>two</strong></li></ol>');
  // "N)" markers work too, and the list always renumbers from 1.
  assert.equal(hydrate('{{{markdown t}}}', { t: '3) a\n4) b' }),
    '<ol style="list-style:none"><li><span class="md-index">1.</span> a</li>' +
    '<li><span class="md-index">2.</span> b</li></ol>');
  // A decimal mid-number (no space after the dot) is not a list marker.
  assert.equal(hydrate('{{{markdown t}}}', { t: '3.5 million' }), '<p>3.5 million</p>');
});

test('template: markdown renders # headings and splits body beneath them', () => {
  assert.equal(hydrate('{{{markdown t}}}', { t: '# Big' }), '<h1>Big</h1>');
  assert.equal(hydrate('{{{markdown t}}}', { t: '### *small*' }), '<h3><em>small</em></h3>');
  // Six levels max; a seventh hash falls back to a paragraph.
  assert.equal(hydrate('{{{markdown t}}}', { t: '###### deep' }), '<h6>deep</h6>');
  assert.equal(hydrate('{{{markdown t}}}', { t: '####### too deep' }), '<p>####### too deep</p>');
  // A heading directly above body text (no blank line) still becomes its own block.
  assert.equal(hydrate('{{{markdown t}}}', { t: '## Title\nBody text' }),
    '<h2>Title</h2><p>Body text</p>');
  // A heading followed by a bullet list, one block, no blank line.
  assert.equal(hydrate('{{{markdown t}}}', { t: '# Head\n- a\n- b' }),
    '<h1>Head</h1><ul><li>a</li><li>b</li></ul>');
});

test('template: data-format helpers (icsStamp, rfcText, csvCell) with raw hydration', () => {
  const raw = (src: string, values: any) => hydrate(src, values, { raw: true });
  // icsStamp: datetime-local / date → iCalendar basic form
  assert.equal(raw('{{icsStamp t}}', { t: '2026-09-15T14:30' }), '20260915T143000');
  assert.equal(raw('{{icsStamp t}}', { t: '2026-09-15' }), '20260915');
  assert.equal(raw('{{icsStamp t}}', { t: '' }), '');
  // rfcText: escape iCalendar/vCard text (backslash, ';', ',', newline)
  assert.equal(raw('{{rfcText t}}', { t: 'Designer, Brand; SUSE' }), 'Designer\\, Brand\\; SUSE');
  // csvCell: RFC 4180 — quote only when needed, doubling embedded quotes
  assert.equal(raw('{{csvCell t}}', { t: 'plain' }), 'plain');
  assert.equal(raw('{{csvCell t}}', { t: 'a,b' }), '"a,b"');
  assert.equal(raw('{{csvCell t}}', { t: 'say "hi"' }), '"say ""hi"""');
  // raw mode must NOT HTML-escape — a vCard EMAIL with & stays verbatim
  assert.equal(raw('EMAIL:{{t}}', { t: 'a&b@x.com' }), 'EMAIL:a&b@x.com');
  // default (HTML) mode still escapes, unchanged
  assert.equal(hydrate('{{t}}', { t: 'a&b' }), 'a&amp;b');
});

test('template: markdown direction markers become arrow bullets; lone marker stays literal', () => {
  // "> " at line start → list item tagged for an arrow marker.
  assert.equal(hydrate('{{{markdown t}}}', { t: '> one\n> **two**' }),
    '<ul><li class="md-arrow">one</li><li class="md-arrow"><strong>two</strong></li></ul>');
  // The other three directions each get their own per-direction class.
  assert.equal(hydrate('{{{markdown t}}}', { t: '< left\n^ up\nv down' }),
    '<ul><li class="md-arrow-left">left</li><li class="md-arrow-up">up</li><li class="md-arrow-down">down</li></ul>');
  // Mixed markers in one block: each item keeps its own marker style.
  assert.equal(hydrate('{{{markdown t}}}', { t: '- a\n> b\n< c' }),
    '<ul><li>a</li><li class="md-arrow">b</li><li class="md-arrow-left">c</li></ul>');
  // A marker mid-line, or without a trailing space, is not a bullet — it stays
  // literal text (HTML-escaped), exactly like a stray "*".
  assert.equal(hydrate('{{{markdown t}}}', { t: 'a > b' }), '<p>a &gt; b</p>');
  assert.equal(hydrate('{{{markdown t}}}', { t: '>nospace' }), '<p>&gt;nospace</p>');
  assert.equal(hydrate('{{{markdown t}}}', { t: 'a < b' }), '<p>a &lt; b</p>');
});

test('template: arrow helper swaps a leading direction marker for its glyph', () => {
  // Single-line counterpart to the markdown arrow bullet: leading "> " → "→ ".
  assert.equal(hydrate('{{arrow t}}', { t: '> Get started' }), '→ Get started');
  // The other three directions map to their own glyphs.
  assert.equal(hydrate('{{arrow t}}', { t: '< Back' }), '← Back');
  assert.equal(hydrate('{{arrow t}}', { t: '^ Up' }), '↑ Up');
  assert.equal(hydrate('{{arrow t}}', { t: 'v Down' }), '↓ Down');
  // Leading whitespace before the marker is tolerated, like the bullet regex.
  assert.equal(hydrate('{{arrow t}}', { t: '  > Go' }), '→ Go');
  // A marker mid-text, or without a trailing space, is left literal (HTML-escaped).
  assert.equal(hydrate('{{arrow t}}', { t: 'a > b' }), 'a &gt; b');
  assert.equal(hydrate('{{arrow t}}', { t: '>nospace' }), '&gt;nospace');
  assert.equal(hydrate('{{arrow t}}', { t: 'a < b' }), 'a &lt; b');
  // No marker → unchanged; the rest of the label is still escaped like {{x}}.
  assert.equal(hydrate('{{arrow t}}', { t: 'Buy & go' }), 'Buy &amp; go');
  // A bare "v" word is left alone — only "v" + space at the very start rewrites.
  assert.equal(hydrate('{{arrow t}}', { t: 'very nice' }), 'very nice');
});

test('annotateTemplate: annotates text refs, skips attrs and <style>/<script> bodies', () => {
  // A stray "<"/">" inside a <style> (CSS comment) or <script> (JS operator) must
  // not desync the tag scanner and suppress annotation of the markup after it.
  const src = [
    '<style>/* markers: ">" and "<" */ .x { a: b; }</style>',
    '<h1>{{heading}}</h1>',
    '<img src="{{asset photo}}" alt="a > b">',
    '<script>for (var i = 0; i < 3; i++) { if (i > 1) {} }</script>',
    '<p>{{body}}</p>',
  ].join('\n');
  const out = annotateTemplate(src, ['heading', 'photo', 'body']);
  // Text refs both before AND after the raw-text elements are annotated.
  assert.ok(out.includes('<!-- ci:heading -->{{heading}}<!-- /ci:heading -->'));
  assert.ok(out.includes('<!-- ci:body -->{{body}}<!-- /ci:body -->'));
  // Refs in attributes are never annotated; raw element bodies survive verbatim.
  assert.ok(!out.includes('ci:photo'));
  assert.ok(out.includes('i < 3') && out.includes('">" and "<"'));
});

test('template: asset helper field access', () => {
  const out = hydrate('<img width="{{asset logo "width"}}">', {
    logo: { url: 'blob:abc', width: 200 },
  });
  assert.equal(out, '<img width="200">');
});

test('template: missing values render empty in if-blocks', () => {
  const out = hydrate(
    '{{#if text}}<h1>{{text}}</h1>{{else}}<p>empty</p>{{/if}}',
    {},
  );
  assert.equal(out, '<p>empty</p>');
});

// ─── typed blocks (color-block style) ────────────────────────────────────────
// Blocks whose sub-fields carry a type (select/asset/number/color), a typed
// add-menu discriminator, and per-type visibility. These power color-block.

const TYPED_BLOCKS_MANIFEST: any = {
  inputs: [
    {
      id: 'blocks',
      type: 'blocks',
      addMenu: { field: 'kind', label: 'Add block' },
      fields: [
        { id: 'kind', type: 'select', options: [{ value: 'heading' }, { value: 'blank', repeatable: true }] },
        { id: 'text', type: 'text', showFor: ['heading'] },
        { id: 'bgColor', type: 'color' },
        { id: 'img', type: 'asset', assetType: 'raster', allowUpload: true },
        { id: 'scale', type: 'number', display: 'slider', min: 0.3, max: 2.5, default: 1 },
      ],
    },
  ],
};

test('validate: accepts typed blocks (addMenu, select/asset/number/showFor)', () => {
  const manifest: any = {
    id: 'typed-blocks', name: 'TB', version: '1.0.0', engineVersion: '^1.0.0',
    status: 'official', render: { width: 800, height: 600, formats: ['png'] },
    ...TYPED_BLOCKS_MANIFEST,
  };
  const { valid, errors } = validateManifest(manifest);
  assert.equal(valid, true, JSON.stringify(errors));
});

test('url-mode: decodes typed block sub-fields (asset→ref, color→#, number)', () => {
  // One row: kind,text,bgColor,img,scale — the asset id's "/" arrives as %2F.
  const { values }: any = parseUrlState('blocks=heading,Hi,30ba78,suse%2Flogo%2Fprimary,1.5', TYPED_BLOCKS_MANIFEST);
  const row = values.blocks[0];
  assert.equal(row.kind, 'heading');
  assert.equal(row.text, 'Hi');
  assert.equal(row.bgColor, '#30ba78');                 // # restored for color fields
  assert.deepEqual(row.img, { source: 'library', id: 'suse/logo/primary', _unresolved: true });
  assert.equal(row.scale, '1.5');
});

test('url-mode: empty asset sub-field decodes to null (no phantom ref)', () => {
  const { values }: any = parseUrlState('blocks=blank,,0c322c,,1', TYPED_BLOCKS_MANIFEST);
  assert.equal(values.blocks[0].img, null);
});

test('template: each + lookup + eq render typed blocks with parent class', () => {
  const tpl =
    '{{#each blocks}}<i class="{{kind}}-block" style="color:{{lookup ../fg @index}}">' +
    '{{#if (eq kind "heading")}}{{this.text}}{{/if}}</i>{{/each}}';
  const out = hydrate(tpl, {
    blocks: [{ kind: 'heading', text: 'Hi' }, { kind: 'blank' }],
    fg: ['#ffffff', '#0c322c'],
  });
  assert.match(out, /class="heading-block" style="color:#ffffff"/);
  assert.match(out, /heading-block[^>]*>Hi</);
  assert.match(out, /class="blank-block" style="color:#0c322c"></);  // blank → no text
});

test('runtime: resolves asset sub-fields inside blocks (CLI/URL parity)', async () => {
  const tool: any = {
    manifest: {
      id: 'cb', name: 'CB', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 100, height: 100, formats: ['png'] },
      inputs: [{
        id: 'blocks', type: 'blocks', fields: [
          { id: 'kind', type: 'select', options: [{ value: 'a' }] },
          { id: 'img', type: 'asset', assetType: 'raster' },
        ],
      }],
    },
    template: '{{#each blocks}}[{{asset this.img}}]{{/each}}',
  };
  const fetched: any[] = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    assets: { get: async (id: any) => { fetched.push(id); return { id, url: 'blob:' + id }; } },
    log: () => {},
  };
  const rt = await createRuntime(tool, host, {
    blocks: [
      { kind: 'a', img: { source: 'library', id: 'suse/logo/primary', _unresolved: true } },
      { kind: 'a', img: null },
    ],
  });
  const val: any = rt.getModel().find((i: any) => i.id === 'blocks')!.value;
  assert.equal(val[0].img.url, 'blob:suse/logo/primary');   // resolved
  assert.equal(val[1].img, null);                            // left alone
  assert.deepEqual(fetched, ['suse/logo/primary']);          // only the real ref fetched
  assert.match(rt.getHydrated(), /\[blob:suse\/logo\/primary\]\[\]/);  // template sees the url
});
