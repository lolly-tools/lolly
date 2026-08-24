// SPDX-License-Identifier: MPL-2.0
/**
 * Certificate (community/certificate) - wording, ids and page-size contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine with the shared base host, so this guards the shipped
 * behaviour rather than a fixture.
 *
 * What is pinned here:
 *  - the four `certKind` values each write their own title AND citation line,
 *    and a typed heading overrides the title without touching the citation;
 *  - the recipient is `firstname` + `lastname` and the date is `awarddate` -
 *    the shared ids that make a roster CSV work in the batch grid - and every
 *    one of them reaches the sheet;
 *  - each page-size option carries a TRUE physical size (A4 in mm, Letter in
 *    inches) and the sheet geometry follows it;
 *  - every example, template and preset seed hydrates with no error note;
 *  - no input id or urlKey collides with a reserved URL parameter.
 *
 * Run with: node --test tests/certificate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// certificate ships in the PUBLIC community pack. Load from the SOURCE pack,
// not the gitignored tools/ profile view, so the suite is profile-independent:
// skip only when community/ is not checked out (a clone without submodules);
// with it present, a missing tool dir means a rename or delete and must fail.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'certificate');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')),
    'community/certificate/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('certificate', fetchFile);

const readJson = async (rel: string) => JSON.parse(await fetchFile(join('certificate', rel)));

async function mount(initialState: Record<string, any> = {}) {
  const rt = await createRuntime(tool, baseHost(), initialState);
  return { rt, html: rt.getHydrated() as string };
}

// ── Wording follows the kind ────────────────────────────────────────────────

const KIND_WORDING: Array<[string, string, string]> = [
  ['completion', 'Certificate of Completion', 'has successfully completed'],
  ['achievement', 'Certificate of Achievement', 'is recognised for achievement in'],
  ['award', 'Certificate of Award', 'is hereby awarded'],
  ['appreciation', 'Certificate of Appreciation', 'in appreciation of'],
];

test('each kind writes its own title and citation line', { skip: SKIP }, async () => {
  for (const [kind, title, cite] of KIND_WORDING) {
    const { rt, html } = await mount({ certKind: kind, heading: '' });
    assert.equal(rt.getHydratedString('{{titleText}}'), title, `${kind}: title`);
    assert.equal(rt.getHydratedString('{{citeText}}'), cite, `${kind}: citation`);
    assert.ok(html.includes(title), `${kind}: the title has to reach the sheet`);
    assert.ok(html.includes(cite), `${kind}: the citation has to reach the sheet`);
  }
});

test('a typed heading replaces the title and leaves the citation alone', { skip: SKIP }, async () => {
  const { rt } = await mount({ certKind: 'award', heading: 'Team of the Year' });
  assert.equal(rt.getHydratedString('{{titleText}}'), 'Team of the Year');
  assert.equal(rt.getHydratedString('{{citeText}}'), 'is hereby awarded',
    'the citation is grammar, not branding - it keeps following the kind');
});

test('an unknown kind falls back to completion rather than blanking the sheet', { skip: SKIP }, async () => {
  for (const kind of ['nonsense', 'constructor', '__proto__']) {
    // The last two are the prototype-key leak: a lookup on a plain object
    // literal finds an inherited member and would lay out a NaN sheet.
    const { rt } = await mount({ certKind: kind, heading: '' });
    assert.equal(rt.getHydratedString('{{titleText}}'), 'Certificate of Completion', kind);
    assert.equal(rt.getHydratedString('{{error}}'), '', kind);
  }
  for (const size of ['nonsense', 'constructor', '__proto__']) {
    const { rt } = await mount({ pageSize: size });
    assert.equal(Number(rt.getHydratedString('{{pageW}}')), 1123, `${size} falls back to A4 landscape`);
  }
});

// ── The shared ids reach the sheet ──────────────────────────────────────────

test('firstname, lastname, course and awarddate all print', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    firstname: 'Ada',
    lastname: 'Lovelace',
    course: 'Analytical Engine Programming',
    awarddate: '2026-11-07',
    presenter: 'Charles Babbage',
    presenterTitle: 'Head of Engines',
    company: 'Northwind Institute',
    serial: 'No. 2026-0001',
  });
  assert.equal(rt.getHydratedString('{{recipientName}}'), 'Ada Lovelace');
  assert.equal(rt.getHydratedString('{{dateText}}'), '7 November 2026',
    'a date input arrives as YYYY-MM-DD and prints in full');
  for (const text of ['Ada Lovelace', 'Analytical Engine Programming', '7 November 2026',
    'Charles Babbage', 'Head of Engines', 'Northwind Institute', 'No. 2026-0001']) {
    assert.ok(html.includes(text), `"${text}" has to reach the sheet`);
  }
});

test('a half-filled name still reads, and an empty signature drops its column', { skip: SKIP }, async () => {
  const { rt, html } = await mount({ firstname: 'Prince', lastname: '', presenter: '' });
  assert.equal(rt.getHydratedString('{{recipientName}}'), 'Prince', 'no trailing space');
  assert.equal(rt.getHydratedString('{{hasPresenter}}'), 'false');
  assert.equal((html.match(/ct-sign-col/g) ?? []).length, 1, 'the date column stays, the signature goes');
});

test('a date the user typed as words passes straight through', { skip: SKIP }, async () => {
  const { rt } = await mount({ awarddate: 'Spring 2026' });
  assert.equal(rt.getHydratedString('{{dateText}}'), 'Spring 2026');
});

test('an empty reference prints nothing - the tool never invents one', { skip: SKIP }, async () => {
  const { rt, html } = await mount({ serial: '' });
  assert.equal(rt.getHydratedString('{{serialText}}'), '');
  assert.ok(!html.includes('ct-serial'), 'no reference line at all when the field is empty');
});

// ── Page sizes carry true units ─────────────────────────────────────────────

test('every page-size option declares a real export size, and the sheet follows it', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  const sizes = manifest.inputs.find((i: { id: string }) => i.id === 'pageSize');
  assert.ok(sizes, 'the tool ships a page-size select');

  const expected: Record<string, { w: number; h: number; unit: string; px: [number, number] }> = {
    // A4 landscape and US Letter landscape are physical sizes, not pixel ones:
    // the export bar has to hand the PDF bridge mm and inches, or the printed
    // page is only approximately the page it claims to be.
    'a4-landscape': { w: 297, h: 210, unit: 'mm', px: [1123, 794] },
    'letter-landscape': { w: 11, h: 8.5, unit: 'in', px: [1056, 816] },
    screen: { w: 1600, h: 1131, unit: 'px', px: [1600, 1131] },
  };

  for (const opt of sizes.options) {
    const want = expected[opt.value];
    assert.ok(want, `unexpected page size "${opt.value}" - add it to this test`);
    assert.equal(opt.width, want.w, `${opt.value}: width`);
    assert.equal(opt.height, want.h, `${opt.value}: height`);
    assert.equal(opt.unit, want.unit, `${opt.value}: unit`);
    assert.ok(want.h < want.w, `${opt.value}: the sheet is landscape`);

    const { rt, html } = await mount({ pageSize: opt.value });
    assert.equal(Number(rt.getHydratedString('{{pageW}}')), want.px[0], `${opt.value}: page width in px`);
    assert.equal(Number(rt.getHydratedString('{{pageH}}')), want.px[1], `${opt.value}: page height in px`);
    // The border layer's viewBox is the page in a 1000-wide space, so the rules
    // keep the sheet's proportion instead of stretching with it.
    const vbH = Number(rt.getHydratedString('{{vbH}}'));
    assert.equal(vbH, Math.round(want.px[1] / want.px[0] * 1000), `${opt.value}: border viewBox height`);
    assert.ok(html.includes(`viewBox="0 0 1000 ${vbH}"`), `${opt.value}: the viewBox reaches the markup`);
  }

  const a4 = expected['a4-landscape']!;
  assert.equal(manifest.render.width, a4.px[0], 'the canvas opens at A4 landscape');
  assert.equal(manifest.render.height, a4.px[1]);
  assert.deepEqual(manifest.render.formats, ['pdf', 'pdf-cmyk', 'svg', 'png']);
  assert.equal(manifest.render.printMarks, true, 'a certificate is print intent');
});

// ── Ids: the batch contract ─────────────────────────────────────────────────

// engine/src/url-mode.ts RESERVED. An input carrying one of these names would
// collide with an export parameter in a shared link.
const RESERVED = new Set([
  'format', 'export', 'copy', 'full', 'options', 'slot', 'output', 'filename',
  '_v', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'bleed', 'marks', 'cuts',
  'c2pa', 'imprint', 'durable', 'hdr', 'depth', 'password', 'profile',
  'nostage', 'lang', 'z', 'zx',
]);

test('no input id or urlKey collides with a reserved URL parameter', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  for (const input of manifest.inputs) {
    assert.ok(!RESERVED.has(input.id), `input id "${input.id}" is a reserved URL parameter`);
    if (input.urlKey) {
      assert.ok(!RESERVED.has(input.urlKey), `urlKey "${input.urlKey}" is a reserved URL parameter`);
    }
  }
});

test('the roster ids are spelled exactly as the batch grid merges them', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  const byId = new Map<string, any>(manifest.inputs.map((i: { id: string }) => [i.id, i]));
  // Canonical (schemas/canonical-inputs.json + the plans/147 merge contract):
  // one byte-identical id per concept, or the batch grid shows two columns.
  for (const id of ['firstname', 'lastname', 'company', 'heading', 'color', 'background']) {
    assert.ok(byId.has(id), `canonical id "${id}" is missing`);
  }
  assert.equal(byId.get('firstname').bindToProfile, 'firstname');
  assert.equal(byId.get('lastname').bindToProfile, 'lastname');
  // course / awarddate are the two ids this tool proposes as shared (plan 147
  // rev 2, awaiting Andy). Pinned so a rename before release is a deliberate
  // edit here, not a silent drift.
  assert.equal(byId.get('course').type, 'text');
  assert.equal(byId.get('awarddate').type, 'date');
  assert.deepEqual(manifest.render.filenameFrom, ['firstname', 'lastname', 'course'],
    'a batch row names its own file from the person and what it is for');
});

// ── Seeds: every shipped starting point has to mount and paint ──────────────

test('every example, template and preset seed hydrates with no error note', { skip: SKIP }, async () => {
  const seeds: Array<[string, Record<string, unknown>]> = [];

  const manifest = await readJson('tool.json');
  assert.ok(manifest.examples.length >= 3, 'the gallery needs at least three looks');
  for (const ex of manifest.examples) seeds.push([`example "${ex.label}"`, ex.values]);

  const files = readdirSync(join(PKG, 'templates')).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 2, 'the tool ships at least two starting templates');
  for (const file of files) {
    const t = await readJson(join('templates', file));
    assert.equal(t.id, file.replace(/\.json$/, ''), `${file}: template id must match its basename`);
    seeds.push([`template "${t.id}"`, t.values]);
    for (const p of t.presets ?? []) {
      // A preset is a values OVERLAY on its template base, which is how the
      // shell's chooser applies it.
      seeds.push([`preset "${t.id}/${p.id}"`, { ...t.values, ...p.values }]);
    }
  }

  const declared = new Set<string>(manifest.inputs.map((i: { id: string }) => i.id));
  for (const [label, values] of seeds) {
    for (const key of Object.keys(values)) {
      assert.ok(declared.has(key), `${label} sets "${key}", which is not a declared input`);
    }
    const { rt, html } = await mount(values);
    assert.equal(rt.getHydratedString('{{error}}'), '', `${label} must not land on the error note`);
    assert.ok(rt.getHydratedString('{{titleText}}').length > 0, `${label} needs a title`);
    assert.ok(rt.getHydratedString('{{recipientName}}').length > 0, `${label} needs a recipient`);
    assert.ok(rt.getHydratedString('{{courseText}}').length > 0, `${label} needs finished sample content`);
    assert.ok(!html.includes('{color.'), `${label} leaked a token alias into the render`);
    assert.equal((html.match(/--ct-[a-z-]+:(;|")/g) ?? []).length, 0, `${label} left a custom property empty`);
  }
});

// ── The sheet itself ────────────────────────────────────────────────────────

test('the border is plain SVG geometry, not a CSS border-image', { skip: SKIP }, async () => {
  const template = await fetchFile(join('certificate', 'template.html'));
  const css = await fetchFile(join('certificate', 'styles.css'));
  const { html } = await mount();
  assert.match(html, /<svg class="ct-frame"/, 'the rules render as an svg layer');
  assert.equal((html.match(/<rect /g) ?? []).length, 2, 'an outer and an inner rule');
  for (const [what, src] of [['template', template], ['styles', css]] as const) {
    assert.ok(!/border-image/.test(src), `${what} must not reach for border-image - the vector export cannot recover it`);
  }
  // Fonts follow the active brand: no family is ever hardcoded outside a
  // var() fallback stack.
  assert.match(css, /var\(--font-brand,/);
  assert.match(css, /var\(--font-mono,/);
  const families = css.match(/font-family:[^;]+/g) ?? [];
  assert.ok(families.length >= 2, 'the sheet sets a text face and a mono face');
  for (const decl of families) {
    assert.match(decl, /^font-family:\s*var\(--font-(brand|mono),/,
      'every font-family goes through a brand variable, with a fallback stack behind it');
  }
});

// Nothing here has been opened in a browser, so the sheet's vertical budget is
// checked by arithmetic instead: every block in the stack is a multiple of the
// same layout unit, and the shortest sheet (A4 landscape) is 707 of them tall.
// If a future edit grows the type past the slack, the signature row is pushed
// through the border rule - this is the test that notices.
test('the stack fits inside the shortest sheet with room for a wrapped line', { skip: SKIP }, async () => {
  const css = await fetchFile(join('certificate', 'styles.css'));

  // Units out of one declaration of a class block, e.g. ".ct-title { … }".
  function block(cls: string): { top: number; line: number } {
    const m = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(m, `styles.css no longer declares .${cls}`);
    const body = m![1]!;
    const num = (prop: string): number => {
      const d = new RegExp(`(?:^|;|\\{)\\s*${prop}:\\s*calc\\(([\\d.]+)\\s*\\*`).exec(body);
      return d ? Number(d[1]) : 0;
    };
    const size = num('font-size') || num('height');   // a rule is a height, not a type size
    const lh = Number(/line-height:\s*([\d.]+)/.exec(body)?.[1] ?? 1);
    return { top: num('margin') + num('margin-top') + num('padding-top'), line: size * lh };
  }

  const pad = Number(/\.ct-body\s*\{[^}]*padding:\s*calc\(([\d.]+)\s*\*/.exec(css)?.[1]);
  assert.ok(pad > 0, 'the body still declares a padding in layout units');

  // A4 landscape: 794 px tall over a 1123 px page = 707 units.
  const sheet = Math.round(794 / 1123 * 1000);
  const inner = sheet - 2 * pad;

  const logo = block('ct-logo');
  const gap = Number(/\.ct-issuer\s*\{[^}]*gap:\s*calc\(([\d.]+)\s*\*/.exec(css)?.[1] ?? 0);
  const stack = ['ct-company', 'ct-title', 'ct-lead', 'ct-name', 'ct-name-rule', 'ct-cite',
    'ct-course', 'ct-sign', 'ct-sign-rule', 'ct-sign-value', 'ct-sign-label', 'ct-serial'];
  // The name and course sizes are the hook's largest step, which is what the
  // fallback in the var() reference has to be.
  const stepped: Record<string, number> = { 'ct-name': 68 * 1.08, 'ct-course': 32 * 1.2 };
  assert.match(css, /var\(--ct-name-size, 68\)/);
  assert.match(css, /var\(--ct-course-size, 32\)/);

  let used = logo.line + gap;
  for (const cls of stack) {
    const b = block(cls);
    used += b.top + (stepped[cls] ?? b.line);
  }

  assert.ok(used <= inner, `the stack is ${Math.round(used)} units tall inside ${inner} - it no longer fits A4 landscape`);
  // Slack for one wrapped course line, so a long course title costs nothing.
  assert.ok(inner - used >= 32 * 1.2,
    `only ${Math.round(inner - used)} units of slack - a wrapped course line would push the signature row through the rule`);
});

test('a long recipient name steps down instead of wrapping twice', { skip: SKIP }, async () => {
  const short = await mount({ firstname: 'Ana', lastname: 'Kovač' });
  const long = await mount({ firstname: 'Maximiliana', lastname: 'Fitzwilliam-Harrington' });
  const s = Number(short.rt.getHydratedString('{{nameSizeU}}'));
  const l = Number(long.rt.getHydratedString('{{nameSizeU}}'));
  assert.equal(s, 68, 'a short name gets the full size');
  assert.ok(l < s, 'a long name steps down');
  assert.ok(long.html.includes(`--ct-name-size:${l}`), 'the step reaches the markup');
});

// Defect: the size steps were three character-count buckets that bottomed out at
// 46 units, and the manifest lets each half of the name run to 60 characters. A
// 120-character name at 46 units wraps to three display-size lines and pushes the
// signature row through the border rule - the exact failure the step exists to
// prevent. The rule is now a width fit against the name box.
test('a name is sized to fit, right up to the manifest maximum', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  const cap = (id: string) => manifest.inputs.find((i: { id: string }) => i.id === id).maxLength as number;
  // 800 units of usable width: the sheet is 1000 wide and .ct-body takes 100 a side.
  const FITS = (chars: number, size: number) => 0.52 * chars * size <= 800;

  for (const chars of [1, 9, 22, 34, 50, 60, cap('firstname') + 1 + cap('lastname')]) {
    const first = 'M'.repeat(Math.max(1, Math.min(chars, cap('firstname'))));
    const last = chars > first.length ? 'x'.repeat(chars - first.length - 1) : '';
    const { rt } = await mount({ firstname: first, lastname: last });
    const size = Number(rt.getHydratedString('{{nameSizeU}}'));
    const name = rt.getHydratedString('{{recipientName}}');
    const lines = Math.ceil((0.52 * name.length * size) / 800);
    assert.ok(size >= 24 && size <= 68, `${name.length} chars: ${size} is outside the clamp`);
    if (name.length <= 60) {
      assert.ok(FITS(name.length, size), `${name.length} chars at ${size} units wraps past the name box`);
    }
    // Past that the floor bites - 24 units is the smallest a recipient's name is
    // allowed to be printed - so the longest name the sidebar can type takes a
    // second line at 26 units of height, inside the slack the budget test above
    // measures. What must never come back is a third line.
    assert.ok(lines <= 2, `${name.length} chars at ${size} units takes ${lines} lines`);
  }
});

// Defect: the layout unit used to be an absolute px value the hook computed from
// the page size and the template wrote into the inline style. The canvas previews
// a bigger sheet scaled down (1600 px of screen sheet is shown at 1123), so the
// copy was laid out for a box 42% wider than the one it was painted in, while the
// border layer - a viewBox - scaled correctly and the two drifted apart.
test('the layout unit is read off the sheet, not off the page size', { skip: SKIP }, async () => {
  const css = await fetchFile(join('certificate', 'styles.css'));
  assert.match(css, /\.ct-root\s*\{[^}]*container-type:\s*size/,
    'the sheet has to be a size container for its own layout unit to resolve');
  assert.match(css, /--ct-u:\s*0\.1cqw/,
    'one layout unit is a thousandth of the sheet\'s own width');

  for (const size of ['a4-landscape', 'letter-landscape', 'screen']) {
    const { html } = await mount({ pageSize: size });
    assert.ok(!/--ct-u\s*:/.test(html),
      `${size}: the markup must not pin the layout unit to a pixel size`);
  }
});

// Defect: hex() took #rgb and #rrggbb only. engine colorToHex hands a colour
// input #rrggbbaa whenever the brand token behind it carries an alpha, so such a
// brand was silently repainted in this tool's own literal fallbacks.
test('a brand colour with an alpha still paints the sheet', { skip: SKIP }, async () => {
  const { rt } = await mount({ color: '#11223344', background: '#aabbccdd', accent: '#0f0f' });
  assert.equal(rt.getHydratedString('{{inkColor}}'), '#112233', 'the alpha is dropped, the colour is kept');
  assert.equal(rt.getHydratedString('{{paperColor}}'), '#aabbcc');
  assert.equal(rt.getHydratedString('{{accentColor}}'), '#00ff00', '#rgba shorthand expands');

  // Anything that is not a colour at all still takes the literal fallback, so a
  // brand with no tokens cannot paint a transparent sheet.
  const junk = await mount({ color: 'not-a-colour', background: '', accent: '{color.semantic.primary}' });
  assert.equal(junk.rt.getHydratedString('{{inkColor}}'), '#1f2933');
  assert.equal(junk.rt.getHydratedString('{{paperColor}}'), '#faf8f4');
  assert.equal(junk.rt.getHydratedString('{{accentColor}}'), '#8a6a2b');
});

test('the brand logo is discovered by tag, and the issuer line stands in without one', { skip: SKIP }, async () => {
  // The shared base host has no assets.query, which is exactly the shell that
  // ships no brand logo: the sheet falls back to the issuer line.
  const { rt, html } = await mount({ company: 'Riverside Library' });
  assert.equal(rt.getHydratedString('{{hasLogo}}'), 'false');
  assert.ok(!html.includes('<img'), 'no logo element when the brand has none');
  assert.ok(html.includes('Riverside Library'), 'the issuer line carries the lockup instead');

  const queried: Array<{ tags: string[] }> = [];
  const host = baseHost({
    assets: {
      get: async (id: string) => ({ id, url: 'asset:' + id }),
      query: async (q: { tags: string[] }) => {
        queried.push(q);
        return [{ id: 'brand/logo/horizontal', url: 'asset:brand/logo/horizontal' }];
      },
    },
  });
  const rt2 = await createRuntime(tool, host, { background: '#ffffff' });
  assert.equal(rt2.getHydratedString('{{logoUrl}}'), 'asset:brand/logo/horizontal');
  assert.ok((rt2.getHydrated() as string).includes('<img class="ct-logo"'));
  assert.deepEqual(queried[0]?.tags, ['logo', 'on-light', 'horizontal'],
    'a light paper asks for the on-light lockup');
});
