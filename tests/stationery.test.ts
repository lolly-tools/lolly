// SPDX-License-Identifier: MPL-2.0
/**
 * Stationery (community/stationery) - print-trim and identity contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine, so this guards the shipped tool rather than a fixture.
 *
 * What the tool promises, and what is checked here:
 *
 *  1. Every piece is a real print trim. The `piece` select carries width /
 *     height / unit per option, which is what the web shell reads to set the
 *     export size (shells/web/src/views/export-size.ts, imported here so the
 *     discovery rule is the real one, not a copy). The numbers are re-measured
 *     through engine/src/units.ts: an 85 x 55 mm card is a 240.94 x 155.91 pt
 *     PDF page, A4 is 595.28 x 841.89 pt, and A4 at 300 DPI is 2480 x 3508 px.
 *  2. The hook's own piece table agrees with the manifest - each render stamps
 *     data-trim-w / -h / -unit on the root, so a drift between the two shows up
 *     in the markup instead of silently exporting the wrong page size.
 *  3. The canonical ids (firstname / lastname / jobTitle / email / phone /
 *     company / url) pre-fill from the profile and reach the render, which is
 *     what makes a whole-team card run work through /batch.
 *  4. Every example, template and preset seed hydrates with no hook error.
 *  5. render.width/height stands for the DEFAULT piece. It is the fallback the
 *     CLI rasterises at (packages/node-shell pxDims) and the aspect the gallery
 *     sizes the info-modal preview to, so a card tool declaring an A4 portrait
 *     canvas lies in both places.
 *  6. The regressions this suite was extended for: a brand colour carrying
 *     alpha survives, the ink on the card's accent field is the higher-contrast
 *     of the two, an opposite-polarity lockup is refused, and a letter pasted
 *     with CRLF line endings sets exactly as the same letter with LF.
 *
 * Run with: node --test tests/stationery.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { toPoints, toPixels } from '../engine/src/units.ts';
import { exportSizeDriver } from '../shells/web/src/views/export-size.ts';
import { baseHost } from './helpers/host.ts';

// The tool ships in the PUBLIC community pack. Load from the SOURCE pack, not
// the gitignored tools/ profile view, so the suite is profile-independent: skip
// only when community/ isn't checked out (a clone without submodules); with it
// present, a missing tool dir means a rename/delete and must FAIL loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const TOOL_DIR = join(COMMUNITY, 'stationery');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
    'community/stationery/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('stationery', fetchFile);

// The trims this tool exists to produce, in millimetres.
const EXPECTED = {
  'business-card-front': { width: 85, height: 55, unit: 'mm' },
  'business-card-back': { width: 85, height: 55, unit: 'mm' },
  letterhead: { width: 210, height: 297, unit: 'mm' },
  'comp-slip': { width: 210, height: 99, unit: 'mm' },
};

async function mount(values: Record<string, any>, profile: Record<string, unknown> = {}) {
  const host = baseHost({ profile: { get: async () => profile } });
  const rt = await createRuntime(tool, host, values);
  return { rt, html: rt.getHydrated() as string };
}

// mm → pt, rounded to two places, so a failure reads as a page size.
const pt = (mm: number) => Math.round(toPoints({ value: mm, unit: 'mm' }) * 100) / 100;

test('the piece select is the export-size driver, with a real trim per option', { skip: SKIP }, () => {
  const driver = exportSizeDriver(tool.manifest);
  assert.ok(driver, 'no select carries width/height - the shell would export at the canvas size');
  // The FIRST qualifying select wins in the shell, so it has to be this one.
  assert.equal(driver!.id, 'piece');
  assert.deepEqual(driver!.dims, EXPECTED);
});

test('each trim converts to the print size the piece is named for', { skip: SKIP }, () => {
  const driver = exportSizeDriver(tool.manifest)!;

  // Business card: 85 x 55 mm is 240.94 x 155.91 pt - a true card-sized PDF page.
  const card = driver.dims['business-card-front']!;
  assert.equal(pt(card.width), 240.94);
  assert.equal(pt(card.height), 155.91);

  // Letterhead: A4 to the point, and 2480 x 3508 px at 300 DPI.
  const a4 = driver.dims.letterhead!;
  assert.equal(pt(a4.width), 595.28);
  assert.equal(pt(a4.height), 841.89);
  assert.equal(toPixels({ value: a4.width, unit: 'mm' }, 300), 2480);
  assert.equal(toPixels({ value: a4.height, unit: 'mm' }, 300), 3508);

  // Compliments slip: DL, one third of an A4 sheet across the short edge.
  const dl = driver.dims['comp-slip']!;
  assert.equal(pt(dl.width), 595.28);
  assert.equal(Math.round(pt(dl.height)), 281);
  assert.ok(Math.abs(dl.height * 3 - 297) < 0.5, 'a DL slip is A4 in three');
});

test('the render canvas is the default piece, not some other page', { skip: SKIP }, () => {
  // render.width/height is the tool's INTENDED output canvas: the CLI rasterises
  // at it when no --width is given (packages/node-shell/src/raster.ts pxDims), the
  // gallery prints it as "W × H px" and sets the info-modal preview's aspect-ratio
  // from it. A landscape card tool that declared A4 portrait got all three wrong.
  const { width: rw, height: rh } = tool.manifest.render;
  const dflt = tool.manifest.inputs.find((i: any) => i.id === 'piece').default;
  const trim = EXPECTED[dflt as keyof typeof EXPECTED];
  assert.ok(trim, `the default piece "${dflt}" is not one of the declared trims`);
  assert.equal(rw / rh, trim.width / trim.height,
    `render ${rw}x${rh} is not the shape of the default piece (${trim.width}x${trim.height} ${trim.unit})`);
});

test('every piece renders the trim it declares', { skip: SKIP }, async () => {
  for (const [piece, dims] of Object.entries(EXPECTED)) {
    const { rt, html } = await mount({ piece });
    assert.equal(rt.getHydratedString('{{error}}'), '', `${piece}: hook reported an error`);
    // The hook's own piece table, stamped on the root - it must agree with the
    // manifest option the shell exports at.
    assert.match(html, new RegExp(`data-trim-w="${dims.width}"`), `${piece}: wrong trim width in the render`);
    assert.match(html, new RegExp(`data-trim-h="${dims.height}"`), `${piece}: wrong trim height in the render`);
    assert.match(html, /data-trim-unit="mm"/, `${piece}: trim unit is not mm`);
    assert.match(html, /class="st-piece st-(card|letterhead|slip)/, `${piece}: no piece root`);
  }
});

test('an unknown piece falls back to the card rather than rendering nothing', { skip: SKIP }, async () => {
  const { rt, html } = await mount({ piece: 'not-a-piece' });
  assert.equal(rt.getHydratedString('{{error}}'), '');
  assert.match(html, /data-trim-w="85"/);
  assert.match(html, /data-trim-h="55"/);
});

test('canonical ids pre-fill from the profile and reach the card', { skip: SKIP }, async () => {
  // Exactly the profile fields the manifest binds to (Profile in
  // packages/core/src/host-v1.ts), seeded as a shell would supply them.
  const profile = {
    firstname: 'Ada',
    lastname: 'Fournier',
    email: 'ada@example.org',
    phone: '+33 1 99 00 12 34',
  };
  const { rt, html } = await mount({ piece: 'business-card-front', jobTitle: 'Typographer', company: 'Rue Verte', url: 'rueverte.fr' }, profile);

  assert.equal(rt.getHydratedString('{{fullName}}'), 'Ada Fournier');
  for (const value of ['Ada Fournier', 'Typographer', 'ada@example.org', '+33 1 99 00 12 34', 'rueverte.fr']) {
    assert.ok(html.includes(value), `card is missing ${value}`);
  }
  // No logo asset resolves through the stub host, so the company stands in as
  // the wordmark - the documented graceful fallback.
  assert.match(html, /class="st-wordmark">Rue Verte</);
});

test('a brand logo asset is used in place of the wordmark', { skip: SKIP }, async () => {
  const queried: unknown[] = [];
  const host = baseHost({
    assets: {
      get: async (id: string) => ({ id, url: 'asset:' + id }),
      query: async (filter: unknown) => {
        queried.push(filter);
        return [{ id: 'brand/logo/wide', url: 'asset:brand/logo/wide' }];
      },
    },
  });
  const rt = await createRuntime(tool, host, { piece: 'business-card-front' });
  const html = rt.getHydrated() as string;

  assert.ok(!html.includes('st-wordmark'), 'wordmark rendered even though a logo resolved');
  assert.match(html, /<img class="st-logo" src="asset:brand\/logo\/wide"/);
  // Discovered by tag, never by a hardcoded brand asset id.
  assert.deepEqual(queried[0], { type: 'vector', tags: ['logo', 'on-light', 'horizontal'] });

  // A dark surface asks for the on-dark lockup instead (the card back prints on
  // the accent field, so it is the accent's luminance that decides).
  const rt2 = await createRuntime(tool, host, { piece: 'business-card-back', accent: '#14181b' });
  rt2.getHydrated();
  assert.deepEqual(queried[queried.length - 1], { type: 'vector', tags: ['logo', 'on-dark', 'horizontal'] });
});

// WCAG contrast of two opaque #rrggbb colours - the measure the card back's ink
// choice has to win on, computed here independently of the hook.
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const ch = [1, 3, 5].map(i => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

test('the ink on the card back is whichever of the two reads on the accent', { skip: SKIP }, async () => {
  // The back prints on the accent field, so the ink is chosen, not given. It used
  // to be a luminance threshold at 0.5, which is nowhere near where white stops
  // beating near-black (about 0.19): every mid tone got white at ~2.8:1. The rule
  // pinned here is the outcome, not the number - the chosen ink must be the one
  // with the higher measured contrast.
  const accents = ['#999999', '#b0b0b0', '#6699cc', '#7fd1b9', '#ffd400', '#1f5f52', '#8a5a2b', '#14181b', '#ffffff', '#000000'];
  for (const accent of accents) {
    const { rt } = await mount({ piece: 'business-card-back', accent });
    const ink = rt.getHydratedString('{{inkColor}}');
    const other = ink === '#ffffff' ? '#111417' : '#ffffff';
    assert.ok(contrast(ink, accent) >= contrast(other, accent),
      `accent ${accent}: picked ${ink} at ${contrast(ink, accent).toFixed(2)}:1 over ${other} at ${contrast(other, accent).toFixed(2)}:1`);
    assert.ok(contrast(ink, accent) >= 4.5, `accent ${accent}: best ink is only ${contrast(ink, accent).toFixed(2)}:1`);
  }
});

test('a brand colour that carries alpha keeps its hue', { skip: SKIP }, async () => {
  // A token with alpha below 1 resolves to an EIGHT-digit hex (engine tokens.ts
  // rgbaToHex). Refusing it silently swapped the brand's own ink for the tool's
  // literal fallback, which is the one outcome a brand tool must not have.
  const tokens = {
    get: async () => ({
      resolve: (ref: string) => ({
        '{color.semantic.text}': { components: [0.1, 0.1, 0.1], alpha: 0.9 },
        '{color.semantic.surface}': '#fffdf7',
        '{color.semantic.primary}': '#0c6b4f',
      })[ref],
    }),
  };
  const rt = await createRuntime(tool, baseHost({ tokens }), { piece: 'business-card-front' });
  rt.getHydrated();
  assert.equal(rt.getHydratedString('{{inkColor}}'), '#1a1a1a');
  assert.equal(rt.getHydratedString('{{paperColor}}'), '#fffdf7');
  // An 8-digit value typed straight into the input takes the same road.
  const direct = await mount({ piece: 'business-card-front', color: '#AABBCCDD' });
  assert.equal(direct.rt.getHydratedString('{{inkColor}}'), '#aabbcc');
});

test('a lockup for the wrong surface is refused, an untagged one is not', { skip: SKIP }, async () => {
  // The last discovery pass drops the polarity tag, because a brand may ship a
  // single untagged lockup (lolly/logo/primary carries no on-light). It must not
  // thereby hand a REVERSED lockup to a light surface: white artwork on white
  // paper prints nothing, and the wordmark it displaced was legible.
  const withLogos = (assets: Array<{ id: string; url: string; meta: { tags: string[] } }>) =>
    baseHost({
      assets: {
        get: async (id: string) => ({ id, url: 'asset:' + id }),
        query: async (f: { tags?: string[] }) =>
          assets.filter(a => (f.tags ?? []).every(t => a.meta.tags.includes(t))),
      },
    });
  const reverseOnly = [{ id: 'b/logo/rev', url: 'asset:rev', meta: { tags: ['logo', 'on-dark'] } }];
  const untagged = [{ id: 'b/logo/primary', url: 'asset:primary', meta: { tags: ['logo', 'mark'] } }];

  const light = await createRuntime(tool, withLogos(reverseOnly), { piece: 'business-card-front' });
  light.getHydrated();
  assert.equal(light.getHydratedString('{{logoUrl}}'), '', 'a reversed lockup was placed on white paper');
  assert.match(light.getHydrated() as string, /class="st-wordmark"/);

  // The same brand on a dark field: the reversed lockup is exactly right there.
  const dark = await createRuntime(tool, withLogos(reverseOnly), { piece: 'business-card-back', accent: '#14181b' });
  dark.getHydrated();
  assert.equal(dark.getHydratedString('{{logoUrl}}'), 'asset:rev');

  // An untagged lockup still reaches both surfaces (the lolly-start case).
  for (const piece of ['business-card-front', 'business-card-back']) {
    const rt = await createRuntime(tool, withLogos(untagged), { piece });
    rt.getHydrated();
    assert.equal(rt.getHydratedString('{{logoUrl}}'), 'asset:primary', `${piece}: untagged lockup dropped`);
  }
});

test('a letter pasted with CRLF sets exactly as one with LF', { skip: SKIP }, async () => {
  // The markdown helper splits blocks on /\n{2,}/ and lines on '\n', so a stray
  // \r between two newlines collapsed every paragraph break and bullet list into
  // one run of <br>. Anything drafted in Word or Outlook arrives that way, which
  // for a letterhead is most letters.
  const lf = 'Dear Sam,\n\nTwo things:\n\n- the sign is shorter\n- the small print moves\n\nWith thanks,';
  const bodyOf = (html: string) => html.match(/<div class="st-body">[\s\S]*?<\/div>/)![0];

  const base = bodyOf((await mount({ piece: 'letterhead', body: lf })).html);
  assert.match(base, /<ul><li>/, 'the LF baseline itself lost its list');
  assert.equal((base.match(/<p>/g) ?? []).length, 3);

  for (const [name, text] of [['CRLF', lf.replace(/\n/g, '\r\n')], ['CR', lf.replace(/\n/g, '\r')]] as const) {
    const got = bodyOf((await mount({ piece: 'letterhead', body: text })).html);
    assert.equal(got, base, `${name} line endings set differently from LF`);
  }

  // Trailing whitespace before the break is the same trap one step along.
  const padded = bodyOf((await mount({ piece: 'letterhead', body: 'A  \r\n\r\n- x  \r\n- y  ' })).html);
  assert.equal(padded, '<div class="st-body"><p>A</p><ul><li>x</li><li>y</li></ul></div>');
});

test('every example seed hydrates', { skip: SKIP }, async () => {
  const examples = tool.manifest.examples ?? [];
  assert.ok(examples.length >= 3, 'the gallery wants three or four looks');
  for (const ex of examples) {
    const { rt, html } = await mount(ex.values);
    assert.equal(rt.getHydratedString('{{error}}'), '', `example "${ex.label}" reported an error`);
    assert.ok(html.includes('st-piece'), `example "${ex.label}" rendered nothing`);
  }
});

test('every template and preset seed hydrates', { skip: SKIP }, async () => {
  const dir = join(TOOL_DIR, 'templates');
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 3, 'expected a template per piece');

  for (const file of files) {
    const tpl = JSON.parse(await readFile(join(dir, file), 'utf8'));
    assert.equal(tpl.id, file.replace(/\.json$/, ''), `${file}: id must match the basename`);

    const { rt, html } = await mount(tpl.values);
    assert.equal(rt.getHydratedString('{{error}}'), '', `${file}: template seed reported an error`);
    assert.ok(html.includes('st-piece'), `${file}: template seed rendered nothing`);

    for (const preset of tpl.presets ?? []) {
      // A preset is a shallow overlay on the template's own values.
      const seeded = { ...tpl.values, ...preset.values };
      const run = await mount(seeded);
      assert.equal(run.rt.getHydratedString('{{error}}'), '', `${file}/${preset.id}: preset reported an error`);
      assert.ok(run.html.includes('st-piece'), `${file}/${preset.id}: preset rendered nothing`);
    }
  }
});
