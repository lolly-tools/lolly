// SPDX-License-Identifier: MPL-2.0
/**
 * Certificate (community/certificate) - wording, ids, sizes, colourways, fit,
 * motion and print language.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine with the shared base host, so this guards the shipped
 * behaviour rather than a fixture.
 *
 * What is pinned here:
 *  - the four `certKind` values each write their own title AND citation line,
 *    and a typed heading overrides the title without touching the citation;
 *  - the recipient is `firstname` + `lastname` and the date is `awarddate`, the
 *    shared ids that make a roster CSV work in the batch grid;
 *  - every size option carries a TRUE export size (A4 in mm, Letter in inches,
 *    screen and social sizes in px) and falls in the proportion band styles.css
 *    lays it out for;
 *  - the palette comes from the colourway: switching it live recolours each style
 *    the way a fresh mount in that colourway does, overrides win, and a pale lead
 *    hands its job to a colour that reads;
 *  - names and course lines are fitted to their box, CJK counted full width;
 *  - the motion presets settle, are frame exact and never touch a still export;
 *  - the printed wording and the date follow the print language, with a clean
 *    English fallback, right to left for Arabic, and a language per batch row.
 *
 * Run with: node --test tests/certificate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseBatchCsv } from '../engine/src/batch.ts';
import { baseHost } from './helpers/host.ts';

// certificate ships in the PUBLIC community pack. Load from the SOURCE pack, not through
// the content resolver, so the suite is profile-independent: skip only when community/ is
// not checked out; with it present, a missing tool dir means a rename or delete and must
// fail.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'certificate');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')),
    'community/certificate/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('certificate', fetchFile);

const readJson = async (rel: string) => JSON.parse(await fetchFile(join('certificate', rel)));

async function mount(initialState: Record<string, any> = {}, host: any = baseHost()) {
  const rt = await createRuntime(tool, host, initialState);
  return { rt, html: rt.getHydrated() as string };
}

/** One custom property off the sheet's root style. */
function cssVar(html: string, name: string): string {
  return (new RegExp(`--${name}:([^;"]+)`).exec(html)?.[1] ?? '').trim().toLowerCase();
}

/** The hook's own helpers, for the arithmetic tests. */
function hookHelpers(source: string = tool.hooksSource): any {
  return new Function('host', `${source}\nreturn { emWidth, fitName, fitCourse, boxes, shapeOf, paletteFor, contrast, ornaments, confettiPieces, fmtDate, textDir, ctPrintLang, CT_PRINTED, CT_TEXT, SHAPES, PAGES };`)(baseHost());
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

test('an unknown kind, style, motion or size falls back rather than blanking the sheet', { skip: SKIP }, async () => {
  for (const bad of ['nonsense', 'constructor', '__proto__']) {
    // The last two are the prototype-key leak: a lookup on a plain object
    // literal finds an inherited member and would lay out a NaN sheet.
    const { rt } = await mount({ certKind: bad, heading: '', style: bad, motion: bad, pageSize: bad, language: bad });
    assert.equal(rt.getHydratedString('{{titleText}}'), 'Certificate of Completion', bad);
    assert.equal(rt.getHydratedString('{{error}}'), '', bad);
    assert.equal(rt.getHydratedString('{{style}}'), 'classic', bad);
    assert.equal(rt.getHydratedString('{{motion}}'), 'none', bad);
    assert.equal(Number(rt.getHydratedString('{{pageW}}')), 1123, `${bad} falls back to A4 landscape`);
  }
});

// ── The shared ids reach the sheet ──────────────────────────────────────────

test('firstname, lastname, awardtopic and awarddate all print', { skip: SKIP }, async () => {
  const { rt, html } = await mount({
    firstname: 'Ada',
    lastname: 'Lovelace',
    awardtopic: 'Analytical Engine Programming',
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
  assert.equal((html.match(/class="ct-sign-col /g) ?? []).length, 1, 'the date column stays, the signature goes');
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

// ── Sizes carry true units and pick a layout ────────────────────────────────

test('every size option declares a real export size, and the sheet follows its proportion', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  const sizes = manifest.inputs.find((i: { id: string }) => i.id === 'pageSize');
  assert.ok(sizes, 'the tool ships a size select');

  const expected: Record<string, { w: number; h: number; unit: string; px: [number, number]; shape: string }> = {
    // Print sizes are physical, not pixel ones: the export bar has to hand the
    // PDF bridge mm and inches, or the printed page is only approximately the
    // page it claims to be.
    'a4-landscape': { w: 297, h: 210, unit: 'mm', px: [1123, 794], shape: 'land' },
    'a4-portrait': { w: 210, h: 297, unit: 'mm', px: [794, 1123], shape: 'tall' },
    'letter-landscape': { w: 11, h: 8.5, unit: 'in', px: [1056, 816], shape: 'land' },
    'letter-portrait': { w: 8.5, h: 11, unit: 'in', px: [816, 1056], shape: 'tall' },
    screen: { w: 1600, h: 1131, unit: 'px', px: [1600, 1131], shape: 'land' },
    slide: { w: 1920, h: 1080, unit: 'px', px: [1920, 1080], shape: 'land' },
    'social-landscape': { w: 1200, h: 628, unit: 'px', px: [1200, 628], shape: 'land' },
    'social-square': { w: 1080, h: 1080, unit: 'px', px: [1080, 1080], shape: 'square' },
    'social-portrait': { w: 1080, h: 1350, unit: 'px', px: [1080, 1350], shape: 'tall' },
    story: { w: 1080, h: 1920, unit: 'px', px: [1080, 1920], shape: 'story' },
    banner: { w: 1200, h: 400, unit: 'px', px: [1200, 400], shape: 'wide' },
  };
  assert.deepEqual(sizes.options.map((o: { value: string }) => o.value), Object.keys(expected),
    'every size is listed here, in the order the select offers them');

  for (const opt of sizes.options) {
    const want = expected[opt.value]!;
    assert.equal(opt.width, want.w, `${opt.value}: width`);
    assert.equal(opt.height, want.h, `${opt.value}: height`);
    assert.equal(opt.unit, want.unit, `${opt.value}: unit`);
    const { rt } = await mount({ pageSize: opt.value });
    assert.equal(Number(rt.getHydratedString('{{pageW}}')), want.px[0], `${opt.value}: page width in px`);
    assert.equal(Number(rt.getHydratedString('{{pageH}}')), want.px[1], `${opt.value}: page height in px`);
    assert.equal(rt.getHydratedString('{{shape}}'), want.shape, `${opt.value}: proportion band`);
  }

  // The hook's proportion bands are the stylesheet's container queries.
  const css = await fetchFile(join('certificate', 'styles.css'));
  const H = hookHelpers();
  const bands = Object.fromEntries(H.SHAPES.map((s: { id: string; h: number }) => [s.id, s.h]));
  assert.match(css, /--ct-u: min\(0\.1cqw, calc\(100cqh \/ 707\)\)/, 'landscape is the default band');
  assert.match(css, new RegExp(`max-aspect-ratio: 1199/1000\\)[^}]*100cqh / ${bands.square}\\)`), 'square band');
  assert.match(css, new RegExp(`max-aspect-ratio: 899/1000\\)[^}]*100cqh / ${bands.tall}\\)`), 'portrait band');
  assert.match(css, new RegExp(`max-aspect-ratio: 659/1000\\)[^}]*100cqh / ${bands.story}\\)`), 'story band');
  assert.match(css, new RegExp(`min-aspect-ratio: 23/10\\)[^}]*100cqh / ${bands.wide}\\)`), 'banner band');
  assert.deepEqual(H.SHAPES.map((s: { min: number }) => s.min), [2.3, 1.2, 0.9, 0.66, 0]);

  const a4 = expected['a4-landscape']!;
  assert.equal(manifest.render.width, a4.px[0], 'the canvas opens at A4 landscape');
  assert.equal(manifest.render.height, a4.px[1]);
  // Print first, then raster, then the motion formats. Pinned exactly, so a
  // format cannot come or go without this list changing in step.
  assert.deepEqual(manifest.render.formats,
    ['pdf', 'pdf-cmyk', 'svg', 'penpot', 'png', 'jpg', 'webp', 'tiff', 'cmyk-tiff', 'mp4', 'webm', 'gif', 'apng', 'webp-anim']);
  assert.deepEqual(manifest.render.video, { wait: 0, duration: 6 });
  assert.equal(manifest.render.printMarks, true, 'a certificate is print intent');
});

test('a typed size of another proportion sizes the type for the canvas, a preset keeps its own', { skip: SKIP }, async () => {
  assert.equal(tool.manifest.render.followsCanvasSize, true, 'the engine re-runs the sheet when the size changes');
  const read = (rt: any) => [Number(rt.getHydratedString('{{pageW}}')), Number(rt.getHydratedString('{{pageH}}')), rt.getHydratedString('{{shape}}')];
  // A4 landscape picked, a story typed in the export bar: the container queries lay
  // the sheet out as a story, and the name and course are sized for that sheet.
  const typed = await createRuntime(tool, baseHost(), { pageSize: 'a4-landscape', firstname: 'Ana', lastname: 'Kovac' }, { canvasSize: { width: 1080, height: 1920 } });
  assert.deepEqual(read(typed), [1080, 1920, 'story']);
  // The preset again, as the export bar hands it over (A4 in CSS px): the preset's own px.
  await typed.setCanvasSize({ width: 297 * 96 / 25.4, height: 210 * 96 / 25.4 });
  assert.deepEqual(read(typed), [1123, 794, 'land']);
  // The same proportion at another scale is the preset, and so is the manifest's own
  // size, the canvas a render with no size asked for gets.
  await typed.setCanvasSize({ width: 2246, height: 1588 });
  assert.deepEqual(read(typed), [1123, 794, 'land']);
  for (const [pageSize, want] of [['story', [1080, 1920, 'story']], ['banner', [1200, 400, 'wide']]] as const) {
    const { rt } = await mount({ pageSize });
    assert.deepEqual(read(rt), want, `${pageSize} at the manifest's canvas keeps its preset`);
  }
  // A sheet drawn at its preset is the sheet 1.1.0 drew: the hydrated markup matches
  // a mount that was never told a canvas size.
  const plain = await mount({ pageSize: 'social-square', firstname: 'Ana' });
  const told = await createRuntime(tool, baseHost(), { pageSize: 'social-square', firstname: 'Ana' }, { canvasSize: { width: 1080, height: 1080 } });
  assert.equal(told.getHydrated(), plain.html);
});

test('the layout unit is read off the sheet, never pinned in the markup', { skip: SKIP }, async () => {
  const css = await fetchFile(join('certificate', 'styles.css'));
  assert.match(css, /\.ct-root\s*\{[^}]*container-type:\s*size/,
    'the sheet has to be a size container for its own layout unit to resolve');
  // Declared on the layers, never on the container: container units on the
  // container itself would measure its parent.
  assert.doesNotMatch(/\.ct-root\s*\{([^}]*)\}/.exec(css)![1]!, /--ct-u/);
  for (const size of ['a4-landscape', 'story', 'banner']) {
    const { html } = await mount({ pageSize: size });
    assert.ok(!/--ct-u\s*:/.test(html), `${size}: the markup must not pin the layout unit to a pixel size`);
  }
});

// ── Ids: the batch contract ─────────────────────────────────────────────────

// engine/src/url-mode.ts RESERVED. An input carrying one of these names would
// collide with an export parameter in a shared link.
const RESERVED = new Set([
  'format', 'export', 'copy', 'full', 'options', 'slot', 'output', 'filename',
  '_v', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'bleed', 'marks', 'cuts',
  'c2pa', 'imprint', 'durable', 'hdr', 'depth', 'password', 'profile',
  'nostage', 'lang', 'z', 'zx', 's', 'fps', 'seconds', 'wait', 'template', 'preset',
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
  // awardtopic / awarddate are the two ids this tool shares (plan 147 rev 2;
  // ratified by Andy 2026-08-25). Pinned so a future rename has to be changed
  // here too, never drifting silently.
  assert.equal(byId.get('awardtopic').type, 'text');
  assert.equal(byId.get('awarddate').type, 'date');
  assert.deepEqual(manifest.render.filenameFrom, ['firstname', 'lastname', 'awardtopic'],
    'a batch row names its own file from the person and what it is for');
});

test('the inputs read in the order a certificate is filled in', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  assert.deepEqual(manifest.inputs.map((i: { id: string }) => i.id), [
    'certKind', 'firstname', 'lastname', 'awardtopic', 'awarddate', 'style', 'pageSize', 'motion',
    'presenter', 'presenterTitle',
    'company', 'brandLogo', 'logoStyle', 'seal', 'serial',
    'accent', 'color', 'background',
    'language', 'heading',
  ]);
  for (const id of ['accent', 'color', 'background']) {
    assert.equal(manifest.inputs.find((i: { id: string }) => i.id === id).default, '',
      `${id} starts empty, so the colourway decides until the person picks a colour`);
  }
  for (const [section, icon] of Object.entries(manifest.render.sectionIcons)) {
    assert.ok(manifest.inputs.some((i: { section?: string }) => i.section === section), `${section} (${icon}) is a used section`);
  }
});

// ── Seeds: every shipped starting point has to mount and paint ──────────────

test('every example, template and preset seed hydrates with no error note', { skip: SKIP }, async () => {
  const seeds: Array<[string, Record<string, unknown>]> = [];

  const manifest = await readJson('tool.json');
  assert.ok(manifest.examples.length >= 4, 'the gallery shows every style');
  assert.deepEqual([...new Set(manifest.examples.map((e: any) => e.values.style))].sort(),
    ['celebration', 'classic', 'minimal', 'modern']);
  for (const ex of manifest.examples) seeds.push([`example "${ex.label}"`, ex.values]);

  const files = readdirSync(join(PKG, 'templates')).filter(f => f.endsWith('.json')).sort();
  assert.deepEqual(files, ['award.json', 'completion.json', 'share.json']);
  for (const file of files) {
    const t = await readJson(join('templates', file));
    assert.equal(t.id, file.replace(/\.json$/, ''), `${file}: template id must match its basename`);
    seeds.push([`template "${t.id}"`, t.values]);
    for (const p of t.presets ?? []) {
      // A preset is a values OVERLAY on its template base, which is how the
      // shell's chooser applies a preset.
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

test('frames, panels and ornaments are plain boxes, and type follows the design system', { skip: SKIP }, async () => {
  const template = await fetchFile(join('certificate', 'template.html'));
  const css = await fetchFile(join('certificate', 'styles.css'));
  const classic = (await mount({ style: 'classic' })).html;
  assert.equal((classic.match(/class="ct-bar /g) ?? []).length, 8, 'an outer and an inner rule, four sides each');
  assert.equal((classic.match(/class="ct-corner /g) ?? []).length, 4);
  assert.equal(((await mount({ style: 'minimal' })).html.match(/class="ct-bar /g) ?? []).length, 0, 'Minimal has no frame');
  assert.match((await mount({ style: 'modern' })).html, /class="ct-panel"/);
  for (const [what, src] of [['template', template], ['styles', css]] as const) {
    assert.ok(!/border-image/.test(src), `${what} must not reach for border-image - the vector export cannot recover it`);
  }
  // Fonts follow the active design system: no family is ever hardcoded outside
  // a var() fallback stack.
  const families = css.match(/font(?:-family)?:[^;]+/g) ?? [];
  assert.ok(families.length >= 4);
  for (const decl of families) {
    if (decl.startsWith('font-family')) {
      assert.match(decl, /^font-family:\s*var\(--font-(brand|display|mono),/,
        'every font-family goes through a design system variable, with a fallback stack behind it');
    } else {
      assert.match(decl, /var\(--font-brand,/, 'the font shorthand goes through the brand face too');
    }
  }
  // No colour is decided by the stylesheet: each one is a hook-resolved custom
  // property with the hook's own literal as its fallback.
  // The play button is preview chrome (data-export-hide), not part of the sheet.
  const sheetCss = css.slice(0, css.indexOf('/* The replay button'));
  for (const m of sheetCss.matchAll(/(?:^|[;{\s])(color|background|background-color|border-color):\s*([^;]+);/g)) {
    const value = m[2]!;
    if (/transparent|currentColor|linear-gradient/.test(value)) continue;
    assert.match(value, /var\(--ct-|var\(--c\)/, `${m[1]}: ${value} is a hard-coded colour`);
  }
});

// ── Colour from the colourway ───────────────────────────────────────────────

const LEADS: Record<string, Record<string, string>> = {
  spearmint: { primary: '#033633', 'on-primary': '#ffffff', secondary: '#008657' },
  spring: { primary: '#da1889', 'on-primary': '#ffffff', secondary: '#818e44' },
  morning: { primary: '#c55123', 'on-primary': '#ffffff', secondary: '#1a85c4' },
  wattle: { primary: '#fdec9e', 'on-primary': '#09141a', secondary: '#008657' },
};

function colourwayHost(extra: Record<string, unknown> = {}) {
  const tokens = {
    resolve: async (ref: string, opts: { selection?: Record<string, string> } = {}) => {
      const lead = LEADS[opts.selection?.colourway ?? 'spearmint']!;
      const path = ref.replace(/[{}]/g, '');
      const semantic: Record<string, string> = {
        'color.semantic.primary': lead.primary!,
        'color.semantic.on-primary': lead['on-primary']!,
        'color.semantic.secondary': lead.secondary!,
        'color.semantic.surface': '#ffffff',
        'color.semantic.text': '#09141a',
        'color.semantic.muted': '#373e44',
        'color.semantic.edge': '#99a0a4',
      };
      return semantic[path] ?? '';
    },
    colors: async () => [],
    get: async () => ({}),
  };
  return baseHost({ tokens, ...extra });
}

test('a colourway switch recolours every style the way a fresh mount does', { skip: SKIP }, async () => {
  const expectations: Array<[string, string, (lead: Record<string, string>) => string]> = [
    ['classic', 'ct-accent', (l) => l.primary!],
    ['minimal', 'ct-accent', (l) => l.primary!],
    ['modern', 'ct-panel', (l) => l.primary!],
    ['celebration', 'ct-paper', (l) => l.primary!],
    ['celebration', 'ct-ink', (l) => l['on-primary']!],
  ];
  for (const [style, prop, want] of expectations) {
    const live = await createRuntime(tool, colourwayHost(), { style });
    assert.equal(cssVar(live.getHydrated() as string, prop), want(LEADS.spearmint!), `${style}: --${prop} follows the canonical lead`);
    await live.setTokenSelection({ colourway: 'spring' });
    assert.equal(cssVar(live.getHydrated() as string, prop), want(LEADS.spring!), `${style}: --${prop} follows the Spring lead`);
    const fresh = await createRuntime(tool, colourwayHost(), { style }, { tokenSelection: { colourway: 'spring' } });
    assert.equal(live.getHydrated(), fresh.getHydrated(), `${style}: a live switch draws what a fresh mount in Spring draws`);
  }
});

test('Ink, Paper and Accent override the colourway, and a pale lead hands its job on', { skip: SKIP }, async () => {
  const classic = await createRuntime(tool, colourwayHost(), { style: 'classic', accent: '#123456', background: '#fefefe', color: '#202020' });
  const html = classic.getHydrated() as string;
  assert.equal(cssVar(html, 'ct-accent'), '#123456');
  assert.equal(cssVar(html, 'ct-paper'), '#fefefe');
  assert.equal(cssVar(html, 'ct-ink'), '#202020');
  await classic.setTokenSelection({ colourway: 'spring' });
  assert.equal(cssVar(classic.getHydrated() as string, 'ct-accent'), '#123456', 'an override survives a colourway switch');
  const modern = await createRuntime(tool, colourwayHost(), { style: 'modern', accent: '#123456' });
  assert.equal(cssVar(modern.getHydrated() as string, 'ct-panel'), '#123456', 'in Modern the accent colours the panel');

  // Wattle is a pale yellow: as a name on white it would not read, so Classic
  // takes the partner, and every chosen pairing reaches its contrast floor.
  const H = hookHelpers();
  const pale = await createRuntime(tool, colourwayHost(), { style: 'classic' }, { tokenSelection: { colourway: 'wattle' } });
  const accent = cssVar(pale.getHydrated() as string, 'ct-accent');
  assert.equal(accent, LEADS.wattle!.secondary);
  for (const style of ['classic', 'modern', 'minimal', 'celebration']) {
    for (const lead of Object.values(LEADS)) {
      const t = { lead: lead.primary, onLead: lead['on-primary'], partner: lead.secondary, surface: '#ffffff', text: '#09141a', muted: '#373e44', edge: '#99a0a4', family: [] };
      const p = H.paletteFor(style, t, {}, 'land');
      assert.ok(H.contrast(p.ink, p.paper) >= 4.5, `${style} on ${lead.primary}: wording reads`);
      if (style !== 'modern') assert.ok(H.contrast(p.accent, p.paper) >= (style === 'celebration' ? 1.5 : 3), `${style} on ${lead.primary}: accent reads`);
      assert.ok(H.contrast(p.panelInk, p.panel) >= 3, `${style} on ${lead.primary}: panel wording reads`);
      assert.ok(H.contrast(p.sealInk, p.seal) >= 2.5, `${style} on ${lead.primary}: the seal's mark reads`);
    }
  }
});

test('the logo version follows the ground it sits on', { skip: SKIP }, async () => {
  const asked: string[] = [];
  const host = colourwayHost({ assets: { get: async (id: string) => ({ id, url: 'asset:' + id }) } });
  const resolve = host.tokens.resolve;
  host.tokens.resolve = async (ref: string, opts: any) => {
    if (ref.startsWith('{asset.logo.')) { asked.push(ref.slice(12, -1)); return 'logo/' + ref.slice(12, -1); }
    return resolve(ref, opts);
  };
  const first = async (values: Record<string, string>) => { asked.length = 0; await createRuntime(tool, host, values); return asked[0]; };
  assert.equal(await first({ style: 'classic' }), 'horizontal-primary', 'full colour on white paper');
  assert.equal(await first({ style: 'modern' }), 'horizontal-mono-reverse', 'one colour, reversed, on a dark panel');
  assert.equal(await first({ style: 'celebration' }), 'horizontal-mono-reverse', 'one colour, reversed, on a dark lead');
  assert.equal(await first({ style: 'modern', logoStyle: 'colour' }), 'horizontal-primary-reverse', 'full colour when asked');
  assert.equal(await first({ style: 'classic', logoStyle: 'mono' }), 'horizontal-mono', 'one colour when asked');
});

// ── Fit ─────────────────────────────────────────────────────────────────────

test('a name is sized to fit its box in every style and shape, CJK counted full width', { skip: SKIP }, async () => {
  const H = hookHelpers();
  const manifest = await readJson('tool.json');
  const cap = (id: string) => manifest.inputs.find((i: { id: string }) => i.id === id).maxLength as number;
  assert.ok(H.emWidth('山田花子') > H.emWidth('Anna') * 1.6, 'four ideographs are wider than four Latin letters');
  assert.ok(H.emWidth('WWWW') > H.emWidth('iiii'), 'wide capitals count wider than narrow letters');
  const names = ['Ana Kovač', 'Maximiliana Fitzwilliam-Harrington', '欧阳娜娜子美智子惠理香', 'فاطمة الزهراء بنت عبد الرحمن',
    'M'.repeat(cap('firstname')) + ' ' + 'x'.repeat(cap('lastname'))];
  for (const style of ['classic', 'modern', 'minimal', 'celebration']) {
    for (const shape of H.SHAPES) {
      const box = H.boxes(style, shape.id, 1000);
      for (const name of names) {
        const fit = H.fitName(name, box);
        assert.ok(fit.size <= box.nameMax, `${style}/${shape.id}: ${name.slice(0, 12)} is at most the display size`);
        assert.ok(fit.size >= Math.round(box.nameMax * 0.32), `${style}/${shape.id}: never smaller than a third of it`);
        assert.ok(fit.lines === 1 || fit.lines === 2);
        if (name.length <= 40) {
          assert.ok(H.emWidth(name) * fit.size <= box.width * fit.lines * 1.12 + 1,
            `${style}/${shape.id}: "${name}" at ${fit.size} units fits ${fit.lines} line(s) of ${box.width}`);
        }
      }
    }
  }
  const short = await mount({ firstname: 'Ana', lastname: 'Kovač' });
  const long = await mount({ firstname: 'Maximiliana Alexandra', lastname: 'Fitzwilliam-Harrington de la Cruz' });
  assert.equal(Number(short.rt.getHydratedString('{{nameSizeU}}')), 68, 'a short name gets the full display size');
  assert.equal(Number(long.rt.getHydratedString('{{nameLines}}')), 2, 'a long name takes a second, balanced line');
  assert.ok(long.html.includes('--ct-name-lines:2'), 'the line budget reaches the markup for the measured fit');
});

test('a long course title wraps within its line budget, and the template measures the rest', { skip: SKIP }, async () => {
  const H = hookHelpers();
  const course = 'Advanced Certificate in Cloud Native Platform Engineering, Site Reliability Practice and Observability at Scale';
  const land = H.boxes('classic', 'land', 1000);
  const size = H.fitCourse(course, land);
  assert.ok(size < land.courseMax && size >= Math.round(land.courseMax * 0.55), `${size} steps down from ${land.courseMax}`);
  assert.ok(H.emWidth(course) * size <= land.width * land.courseLines * 1.15 + 1);
  assert.equal(H.fitCourse('Container Fundamentals', land), land.courseMax, 'a short course keeps the full size');
  const template = await fetchFile(join('certificate', 'template.html'));
  assert.match(template, /fit\(parts\.name, '--ct-name-size', '--ct-name-lines'\)/, 'the laid-out name is measured');
  assert.match(template, /fit\(parts\.course, '--ct-course-size', '--ct-course-lines'\)/, 'and the course');
});

// ── Motion ──────────────────────────────────────────────────────────────────

const templateSource = SKIP ? '' : await fetchFile(join('certificate', 'template.html'));
const motionSource = templateSource.slice(templateSource.indexOf('// ct-motion-start'), templateSource.indexOf('// ct-motion-end'));
const motion: any = vm.createContext({ Math });
if (!SKIP) vm.runInContext(motionSource, motion);
const PARTS = ['frame', 'panel', 'ornaments', 'issuer', 'title', 'lead', 'name', 'rule', 'cite', 'course', 'sign', 'seal', 'serial'];

test('every motion preset is offered, settles by its end and stages its parts', { skip: SKIP }, async () => {
  const manifest = await readJson('tool.json');
  const offered = manifest.inputs.find((i: { id: string }) => i.id === 'motion').options.map((o: { value: string }) => o.value);
  const presets = Object.keys(motion.CT_MOTIONS);
  assert.deepEqual(offered, ['none', ...presets], 'None first (print), then every preset, and nothing else');
  assert.equal(manifest.inputs.find((i: { id: string }) => i.id === 'motion').default, 'none');
  const rest = { ...motion.CT_REST };
  for (const preset of presets) {
    const m = motion.CT_MOTIONS[preset];
    assert.ok(m.end <= manifest.render.video.duration, `${preset} finishes inside the default clip`);
    for (const part of PARTS) {
      assert.deepEqual({ ...motion.ctPose(preset, m.end, part) }, rest, `${preset}: ${part} rests at the end`);
    }
    assert.ok(motion.ctPose(preset, 0, 'name').o < 0.01, `${preset}: the name is not there at the first frame`);
    // The title arrives before the name, and the seal last of the three.
    const startOf = (part: string) => m.steps.find((s: any[]) => s[0] === part)[1];
    assert.ok(startOf('title') < startOf('name') && startOf('name') < startOf('seal'), `${preset}: staged`);
  }
  assert.deepEqual({ ...motion.ctPose('none', 0, 'name') }, rest, 'None never moves');
  // The seal stamps: larger than life, then a small overshoot, then at rest.
  assert.ok(motion.ctPose('reveal', 2.62, 'seal').s > 1.5);
  assert.ok([0.7, 0.75, 0.8].some((p) => motion.ctEffect('stamp', p).s < 1), 'the stamp overshoots');
  // Confetti is only in the air after the seal stamps, and has fallen by the end.
  const c = [50, 0.2, 2, 3, 1, 300, 10];
  assert.equal(motion.ctConfetto('confetti', 2.5, c), null);
  assert.ok(motion.ctConfetto('confetti', 3.6, c));
  assert.equal(motion.ctConfetto('confetti', 5.8, c), null);
  assert.equal(motion.ctConfetto('reveal', 3.6, c), null, 'only the Confetti preset throws any');
  assert.ok(motion.ctSheen('shimmer', 4) >= 0 && motion.ctSheen('reveal', 4) < 0, 'only the shimmer preset shines');
});

test('a clip shorter than the motion plays it faster and still ends finished', { skip: SKIP }, () => {
  assert.equal(motion.ctScene('reveal', 1.5, 6), 1.5, 'a long enough clip keeps the preset pace');
  assert.equal(motion.ctScene('reveal', 1.5, 0), 1.5, 'the live preview passes no clip');
  const end = motion.CT_MOTIONS.confetti.end;
  assert.ok(motion.ctScene('confetti', 2.75, 3) >= end, 'the last frame of a 3 second clip is past the end');
});

/** The hydrated sheet in jsdom with its own script running, as a browser runs the page. */
async function liveSheet(values: Record<string, unknown>) {
  const { html } = await mount(values);
  const dom = new JSDOM(`<!doctype html><body><div id="stage">${html}</div></body>`, { runScripts: 'dangerously', pretendToBeVisual: true } as never);
  const doc = dom.window.document;
  const clock: any = doc.querySelector('.ct-clock');
  // Normalised, because clearing a property re-serialises the attribute.
  const styles = () => Array.from(doc.querySelectorAll('.ct-root *'))
    .map((el: any) => (el.getAttribute('style') || '').replace(/\s+/g, '').replace(/;$/, '')).join('|');
  return { dom, doc, clock, styles };
}

test('motion is frame exact: a frame depends on its time alone, and a still is the finished sheet', { skip: SKIP }, async () => {
  for (const preset of ['fade', 'reveal', 'shimmer', 'confetti']) {
    const a = await liveSheet({ style: 'celebration', motion: preset });
    assert.equal(typeof a.clock?.__lollyFrameRender, 'function', `${preset}: the export clock is registered`);
    const settled = a.styles();
    // An export asks for frames in order; a seek can go backwards. Either way
    // the same time paints the same frame.
    a.clock.__lollyFrameRender(0.9, 6);
    a.clock.__lollyFrameRender(0.3, 6);
    const backwards = a.styles();
    const b = await liveSheet({ style: 'celebration', motion: preset });
    b.clock.__lollyFrameRender(0.3, 6);
    assert.equal(backwards, b.styles(), `${preset}: frame 0.3 is the same however it was reached`);
    assert.notEqual(backwards, settled, `${preset}: frame 0.3 is mid-motion`);
    // A still export (no clip length) settles every part back to the print pose.
    a.clock.__lollyFrameRender(0);
    assert.equal(a.styles(), settled, `${preset}: a still is the finished certificate`);
    a.dom.window.close();
    b.dom.window.close();
  }
  const none = await liveSheet({ motion: 'none' });
  assert.equal(none.clock, null, 'None registers no clock, so print exports are untouched');
  none.dom.window.close();
});

test('the live preview never plays outside the tool view', { skip: SKIP }, async () => {
  const sheet = await liveSheet({ motion: 'reveal' });
  // Off the tool view (batch, multi-edit, a thumbnail) nothing autoplays.
  assert.equal(sheet.doc.querySelector('.ct-name')!.getAttribute('style'), null);
  assert.ok(sheet.doc.querySelector('.ct-play[data-export-hide]'), 'the play button never reaches a file');
  sheet.dom.window.close();
});

// ── Print language ──────────────────────────────────────────────────────────

// Test fixtures only: the shipped table is filled by a reviewed translation
// pass. These prove the mechanism, not the wording.
const FIXTURE_TEXT = {
  de: { 'Certificate of Completion': 'Teilnahmebescheinigung', 'This is to certify that': 'Hiermit wird bescheinigt, dass', 'has successfully completed': 'erfolgreich abgeschlossen hat', Date: 'Datum' },
  ja: { 'Certificate of Completion': '修了証', 'This is to certify that': '以下の者が', 'has successfully completed': 'を修了したことを証します', Date: '日付' },
  ar: { 'Certificate of Completion': 'شهادة إتمام', 'This is to certify that': 'نشهد بأن', 'has successfully completed': 'قد أتمّ بنجاح', Date: 'التاريخ' },
};
// Swap the shipped table for a given one, so the mechanism is tested apart from the wording.
function withTable(table: object): any {
  const hooksSource = tool.hooksSource.replace(/var CT_TEXT = [\s\S]*?;\nvar CT_PRINTED/, `var CT_TEXT = ${JSON.stringify(table)};\nvar CT_PRINTED`);
  assert.notEqual(hooksSource, tool.hooksSource, 'the printed-text table was found and replaced');
  return { ...tool, hooksSource };
}
const translated: any = SKIP ? null : withTable(FIXTURE_TEXT);
const untranslated: any = SKIP ? null : withTable({});

test('the shipped table covers every language and printed string, and a missing language falls back to English', { skip: SKIP }, async () => {
  const H = hookHelpers();
  const langs = Object.keys(H.CT_TEXT);
  assert.equal(langs.length, 26, 'all 26 app languages are translated');
  for (const lang of langs) for (const en of H.CT_PRINTED) assert.ok(H.CT_TEXT[lang][en], `${lang}: "${en}"`);
  for (const lang of ['de', 'ja', 'ar']) {
    const rt = await createRuntime(untranslated, baseHost(), { language: lang, awarddate: '2026-06-18' });
    assert.equal(rt.getHydratedString('{{titleText}}'), 'Certificate of Completion', `${lang}: English wording`);
    assert.equal(rt.getHydratedString('{{dateText}}'), '18 June 2026', `${lang}: and an English date to match`);
    assert.equal(rt.getHydratedString('{{dir}}'), 'ltr');
  }
  const hooks = await fetchFile(join('certificate', 'hooks.js'));
  const printed = new Set<string>(H.CT_PRINTED);
  for (const m of hooks.matchAll(/ctText\('([^']+)'/g)) assert.ok(printed.has(m[1]!), `"${m[1]}" is listed for translation`);
  for (const kind of ['Completion', 'Achievement', 'Award', 'Appreciation']) assert.ok(printed.has(`Certificate of ${kind}`));
});

test('a certificate prints in de, ja and ar with translated wording and a localised date', { skip: SKIP }, async () => {
  const cases: Array<[string, string, RegExp, string]> = [
    ['de', 'Teilnahmebescheinigung', /^18\. Juni 2026$/, 'ltr'],
    ['ja', '修了証', /^2026年6月18日$/, 'ltr'],
    ['ar', 'شهادة إتمام', /2026/, 'rtl'],
  ];
  for (const [lang, title, date, dir] of cases) {
    const rt = await createRuntime(translated, baseHost(), { language: lang, awarddate: '2026-06-18' });
    const html = rt.getHydrated() as string;
    assert.equal(rt.getHydratedString('{{titleText}}'), title, `${lang}: title`);
    assert.match(rt.getHydratedString('{{dateText}}'), date, `${lang}: date`);
    assert.equal(rt.getHydratedString('{{dir}}'), dir, `${lang}: direction`);
    assert.match(html, new RegExp(`dir="${dir}"`));
    assert.ok(html.includes(FIXTURE_TEXT[lang as 'de'].Date), `${lang}: the date label`);
    // Wording the table does not hold yet stays English, never blank.
    const award = await createRuntime(translated, baseHost(), { language: lang, certKind: 'award' });
    assert.equal(award.getHydratedString('{{citeText}}'), 'is hereby awarded');
  }
  // The language follows the app's render language unless the input sets one.
  const app = await loadTool('certificate', fetchFile, { lang: 'de' });
  const appTranslated = { ...app, hooksSource: translated.hooksSource };
  const follow = await createRuntime(appTranslated, baseHost(), {});
  assert.equal(follow.getHydratedString('{{titleText}}'), 'Teilnahmebescheinigung', 'App language follows the app');
  const own = await createRuntime(appTranslated, baseHost(), { language: 'en' });
  assert.equal(own.getHydratedString('{{titleText}}'), 'Certificate of Completion', 'an explicit language wins');
  assert.equal(own.getHydratedString('{{dateText}}'), '18 June 2026');
});

test('a bulk CSV with mixed languages prints each row in its own language', { skip: SKIP }, async () => {
  const csv = [
    'toolId,firstname,lastname,awarddate,language',
    'certificate,Lena,Fischer,2026-07-24,de',
    'certificate,花子,山田,2026-07-24,ja',
    'certificate,فاطمة,الزهراء,2026-07-24,ar',
    'certificate,Sam,Oyelaran,2026-07-24,',
  ].join('\n');
  const rows = parseBatchCsv(csv);
  assert.equal(rows.length, 4);
  const titles: string[] = [];
  const dirs: string[] = [];
  for (const row of rows) {
    const rt = await createRuntime(translated, baseHost(), row.params);
    titles.push(rt.getHydratedString('{{titleText}}'));
    dirs.push(rt.getHydratedString('{{dir}}'));
    assert.ok((rt.getHydrated() as string).includes(row.params.firstname!), 'the row\'s own name prints');
  }
  assert.deepEqual(titles, ['Teilnahmebescheinigung', '修了証', 'شهادة إتمام', 'Certificate of Completion']);
  assert.deepEqual(dirs, ['ltr', 'ltr', 'rtl', 'ltr']);
});

// ── Colours and logos, kept from 1.0 ────────────────────────────────────────

// Defect: hex() took #rgb and #rrggbb only. engine colorToHex hands a colour
// input #rrggbbaa whenever the brand token behind it carries an alpha, so such a
// brand was silently repainted in this tool's own literal fallbacks.
test('a colour with an alpha still paints the sheet', { skip: SKIP }, async () => {
  const { rt } = await mount({ color: '#11223344', background: '#aabbccdd', accent: '#0f0f' });
  assert.equal(rt.getHydratedString('{{inkColor}}'), '#112233', 'the alpha is dropped, the colour is kept');
  assert.equal(rt.getHydratedString('{{paperColor}}'), '#aabbcc');
  assert.equal(rt.getHydratedString('{{accentColor}}'), '#00ff00', '#rgba shorthand expands');

  // Anything that is not a colour at all takes the design system, and with no
  // design system the literal fallbacks, so a sheet is never transparent.
  const junk = await mount({ color: 'not-a-colour', background: '', accent: '{color.semantic.primary}' });
  assert.equal(junk.rt.getHydratedString('{{inkColor}}'), '#1f2933');
  assert.equal(junk.rt.getHydratedString('{{paperColor}}'), '#faf8f4');
  assert.equal(junk.rt.getHydratedString('{{accentColor}}'), '#8a6a2b');
});

test('the brand logo follows its declared slot and the issuer line stands in without one', { skip: SKIP }, async () => {
  const { rt, html } = await mount({ company: 'Riverside Library' });
  assert.equal(rt.getHydratedString('{{hasLogo}}'), 'false');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Riverside Library'));
  const resolved: string[] = [];
  const host = baseHost({
    tokens: { resolve: async (ref: string) => { resolved.push(ref); return ref.startsWith('{asset.logo.') ? 'brand/logo/horizontal' : ''; } },
    assets: {
      get: async (id: string) => ({ id, url: 'asset:' + id }),
      query: async () => { assert.fail('must not search unrelated catalogue marks'); },
    },
  });
  const branded = await createRuntime(tool, host, { company: 'Riverside Library' });
  assert.equal(branded.getHydratedString('{{logoUrl}}'), 'asset:brand/logo/horizontal');
  assert.ok(resolved.includes('{asset.logo.horizontal-primary}'));
});
