// SPDX-License-Identifier: MPL-2.0
/**
 * Contrast Checker (community/contrast-check) - readability + simulation contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine, with a host whose `color` bridge is the actual
 * makeColorApi() every shell attaches. The point of each test is that the
 * tool's own numbers agree with the engine's, measured independently:
 *
 *  - the WCAG ratio equals engine contrastRatio, the Lc equals apcaContrast;
 *  - the level flags follow the published bars at both text sizes;
 *  - the simulated hexes equal engine simulateCvdHex / toGrayscaleHex (the
 *    hook carries the shared `cvd` region, a copy of the same matrices, so a
 *    drift between the two shows up here);
 *  - palette mode turns 3 brand swatches into a 3x3 matrix;
 *  - a shell with no host.color still renders, on the local WCAG fallback.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/contrast-check.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeColorApi, apcaContrast, apcaVerdict } from '../engine/src/color-tools.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { simulateCvdHex, toGrayscaleHex, type CvdType } from '../engine/src/color-vision.ts';
import { baseHost } from './helpers/host.ts';

// contrast-check ships in the PUBLIC community pack. Load from the SOURCE pack,
// not the gitignored tools/ profile view, so the suite is profile-independent:
// skip only when community/ isn't checked out (a clone without submodules).
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'contrast-check', 'tool.json')),
    'community/contrast-check/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('contrast-check', fetchFile);

type HostOpts = {
  color?: boolean;
  swatches?: Array<{ name: string; value: string }>;
  /** Make host.color.contrast throw, to drive the hook's failure path. */
  breakColor?: boolean;
};

function makeHost(opts: HostOpts = {}): any {
  const over: Record<string, unknown> = {};
  if (opts.breakColor) {
    over.color = { ...makeColorApi(), contrast: () => { throw new Error('boom'); } };
  } else if (opts.color !== false) over.color = makeColorApi();
  if (opts.swatches) {
    over.tokens = {
      colors: async () => opts.swatches!.map((s, i) => ({
        ref: `{color.brand.c${i}}`, path: `color.brand.c${i}`, name: s.name,
        group: 'Brand', value: s.value, description: null, cmyk: null, spot: null,
      })),
      get: async () => ({}),
      resolve: async () => null,
      themes: async () => [],
    };
  }
  return baseHost(over);
}

async function mount(state: Record<string, any>, opts: HostOpts = {}) {
  return createRuntime(tool, makeHost(opts), state);
}

// Read one hook extra as text. The extras are the tool's data surface; probing
// them pins the numbers rather than the SVG's attribute order.
function extra(rt: any, name: string): string {
  return rt.getHydratedString(`{{${name}}}`) as string;
}

// Split an "{{#each}}"-joined probe into records.
function rows(probe: string, keys: string[]): Array<Record<string, string>> {
  return probe.split(';').filter(Boolean).map((r) => {
    const parts = r.split('|');
    const out: Record<string, string> = {};
    keys.forEach((k, i) => { out[k] = parts[i] ?? ''; });
    return out;
  });
}

test('pair mode: the ratio is the engine contrast ratio and Lc is the engine APCA', { skip: SKIP }, async () => {
  for (const [fg, bg] of [['#767676', '#ffffff'], ['#14171a', '#f7f7f5'], ['#ffffff', '#2453ff']]) {
    const rt = await mount({ color: fg, background: bg, mode: 'pair', textSize: 'normal' });
    assert.equal(extra(rt, 'ratioValue'), contrastRatio(fg!, bg!).toFixed(2),
      `${fg} on ${bg}: the sheet's ratio must equal the engine's`);
    assert.equal(extra(rt, 'lcValue'), String(Math.round(Math.abs(apcaContrast(fg!, bg!)))),
      `${fg} on ${bg}: the sheet's Lc must equal the engine's APCA magnitude`);
    // The band is named from the Lc magnitude, never left blank when Lc is known.
    assert.notEqual(extra(rt, 'band').trim(), '');
  }
});

test('pair mode: the WCAG cells follow the bars at both text sizes', { skip: SKIP }, async () => {
  // #767676 on white is 4.54:1 - the classic "AA normal, not AAA" pair. At large
  // text the same ratio clears AAA (4.5), which is the whole point of the switch.
  const probe = (rt: any) => rows(
    rt.getHydratedString('{{#each checks}}{{key}}|{{pass}};{{/each}}') as string, ['key', 'pass'],
  ).reduce((m: Record<string, string>, r) => { m[r.key!] = r.pass!; return m; }, {});

  const normal = probe(await mount({ color: '#767676', background: '#ffffff', textSize: 'normal' }));
  assert.deepEqual(normal, {
    'aa-normal': 'true', 'aaa-normal': 'false', 'aa-large': 'true', 'aaa-large': 'true', ui: 'true',
  });

  const large = probe(await mount({ color: '#767676', background: '#ffffff', textSize: 'large' }));
  assert.deepEqual(large, normal, 'the cells state the bars, so they do not move with the size switch');
  // Only the verdict follows the chosen size.
  const rtLarge = await mount({ color: '#767676', background: '#ffffff', textSize: 'large' });
  assert.equal(extra(rtLarge, 'verdict'), 'Large text: AAA');
  const rtNormal = await mount({ color: '#767676', background: '#ffffff', textSize: 'normal' });
  assert.equal(extra(rtNormal, 'verdict'), 'Normal text: AA');

  // A pair under every bar reports Fail, not a soft pass.
  const weak = await mount({ color: '#d8d8d8', background: '#ffffff', textSize: 'normal' });
  assert.equal(extra(weak, 'verdict'), 'Normal text: Fail');
});

test('the simulated pairs are byte-identical to the engine CVD model', { skip: SKIP }, async () => {
  const bg = '#ffffff';
  const types: Record<string, CvdType> = { protan: 'protan', deutan: 'deutan', tritan: 'tritan' };

  // EXACT, not near: the shared `cvd` region carries the same matrices, the same
  // no-linearisation convention and the same clamp-then-round, so the two agree
  // bit for bit. A tolerance here would hide the drift this test exists to catch.
  const near = (got: string, want: string, what: string) => {
    assert.equal(got, want, `${what}: the hook's hex must equal the engine's exactly`);
  };

  for (const fg of ['#2453ff', '#c2410c', '#16a34a', '#767676', '#000000', '#ffffff']) {
    const rt = await mount({ color: fg, background: bg, mode: 'pair' });
    const sims = rows(
      rt.getHydratedString('{{#each sims}}{{key}}|{{fg}}|{{bg}}|{{ratioText}};{{/each}}') as string,
      ['key', 'fg', 'bg', 'ratio'],
    );
    assert.equal(sims.length, 5, 'normal + three dichromacies + greyscale');

    const byKey = Object.fromEntries(sims.map((s) => [s.key, s]));
    assert.equal(byKey.normal!.fg, fg, 'the normal-vision tile is the untouched pair');
    assert.equal(byKey.normal!.bg, bg);

    for (const key of Object.keys(types)) {
      near(byKey[key]!.fg!, simulateCvdHex(fg, types[key]!, 1)!, `${fg} ${key} foreground`);
      near(byKey[key]!.bg!, simulateCvdHex(bg, types[key]!, 1)!, `${bg} ${key} background`);
    }
    near(byKey.grey!.fg!, toGrayscaleHex(fg)!, `${fg} greyscale foreground`);
    near(byKey.grey!.bg!, toGrayscaleHex(bg)!, `${bg} greyscale background`);

    // Each tile carries its OWN recomputed ratio, not the normal-vision one.
    for (const s of sims) {
      assert.equal(s.ratio, contrastRatio(s.fg!, s.bg!).toFixed(2) + ':1',
        `${s.key}: the tile's ratio must be measured on the simulated colours`);
    }
  }
});

test('palette mode: three brand swatches produce a 3x3 matrix with the right ratios', { skip: SKIP }, async () => {
  const swatches = [
    { name: 'Jungle', value: '#0c322c' },
    { name: 'Mint', value: '#90ebcd' },
    { name: 'Paper', value: '#f7f7f5' },
  ];
  const rt = await mount({ color: '#14171a', background: '#ffffff', mode: 'palette' }, { swatches });

  assert.equal(extra(rt, 'isPalette'), 'true');
  const cells = rows(
    rt.getHydratedString('{{#each cells}}{{fg}}|{{bg}}|{{ratioText}}|{{level}};{{/each}}') as string,
    ['fg', 'bg', 'ratio', 'level'],
  );
  assert.equal(cells.length, 9, 'every foreground against every background');

  let i = 0;
  for (const row of swatches) {
    for (const col of swatches) {
      const cell = cells[i++]!;
      assert.equal(cell.fg, row.value, 'rows are the foreground, in swatch order');
      assert.equal(cell.bg, col.value, 'columns are the background, in swatch order');
      assert.equal(cell.ratio, contrastRatio(row.value, col.value).toFixed(2) + ':1');
    }
  }
  // A colour on itself is 1:1 and must be marked as failing, never left blank.
  assert.ok(cells.filter((c) => c.fg === c.bg).every((c) => c.ratio === '1.00:1' && c.level === 'Fail'));

  // The row and column headers name the swatches.
  const heads = rt.getHydratedString('{{#each rowHeads}}{{name}},{{/each}}') as string;
  assert.equal(heads, 'Jungle,Mint,Paper,');

  // No brand tokens at all: palette mode degrades to the pair sheet with a note.
  const bare = await mount({ color: '#14171a', background: '#ffffff', mode: 'palette' });
  assert.equal(extra(bare, 'isPalette'), 'false');
  assert.match(extra(bare, 'note'), /no colour tokens/);
  assert.equal(extra(bare, 'error'), '');
});

// The verdict chips (Andy, 2026-08-24: "make the fail more obvious"): a solid
// fill with white ink and a tick or cross, on every matrix cell, check row,
// vision tile and the sample panel. The fill is fixed by level, never by the
// pair under test, so a fail is a fail from across the room.
const CHIP = { pass: '#137333', warn: '#b45309', fail: '#b3261e', ink: '#ffffff' };
const TICK = 'M3 9.5 L7 13.5 L15 4.5';
const CROSS = 'M4 4 L14 14 M14 4 L4 14';

test('every verdict is a solid chip: crosses on fails, ticks on passes, ink that contrasts', { skip: SKIP }, async () => {
  for (const fill of [CHIP.pass, CHIP.warn, CHIP.fail]) {
    assert.ok(contrastRatio(CHIP.ink, fill) >= 4.5, `white ink on the ${fill} chip must itself pass AA`);
  }

  const swatches = [
    { name: 'Jungle', value: '#0c322c' },
    { name: 'Mint', value: '#90ebcd' },
    { name: 'Mid', value: '#6f6f6f' },
    { name: 'Paper', value: '#f7f7f5' },
  ];
  const rt = await mount({ color: '#14171a', background: '#ffffff', mode: 'palette' }, { swatches });
  const cells = rows(
    rt.getHydratedString('{{#each cells}}{{level}}|{{chipFill}}|{{chipMark}}|{{chipWord}}|{{chipInk}};{{/each}}') as string,
    ['level', 'fill', 'mark', 'word', 'ink'],
  );
  assert.equal(cells.length, 16);
  const seen = new Set<string>();
  for (const c of cells) {
    seen.add(c.level!);
    assert.equal(c.ink, CHIP.ink);
    if (c.level === 'AAA' || c.level === 'AA') {
      assert.equal(c.fill, CHIP.pass, `${c.level} is a green chip`);
      assert.equal(c.mark, TICK);
      assert.equal(c.word, c.level);
    } else if (c.level === 'UI') {
      assert.equal(c.fill, CHIP.warn, 'UI-only is an amber chip: fine for borders, not for the text judged');
      assert.equal(c.mark, CROSS);
      assert.equal(c.word, 'UI only');
    } else {
      assert.equal(c.level, 'Fail');
      assert.equal(c.fill, CHIP.fail, 'a fail is a solid red chip');
      assert.equal(c.mark, CROSS);
      assert.equal(c.word, 'Fail');
    }
  }
  assert.ok(seen.has('Fail') && seen.has('AAA'), 'the fixture must exercise both ends');

  // The five check rows and the five vision tiles carry the same chip fields.
  const checks = rows(rt.getHydratedString('{{#each checks}}{{pass}}|{{chipFill}}|{{chipWord}};{{/each}}') as string, ['pass', 'fill', 'word']);
  assert.equal(checks.length, 5);
  for (const c of checks) {
    assert.equal(c.fill, c.pass === 'true' ? CHIP.pass : CHIP.fail);
    assert.equal(c.word, c.pass === 'true' ? 'Pass' : 'Fail');
  }
  const sims = rows(rt.getHydratedString('{{#each sims}}{{level}}|{{chipWord}};{{/each}}') as string, ['level', 'word']);
  assert.equal(sims.length, 5);
  assert.ok(sims.every((s) => s.word && s.word.length > 0));
  assert.equal(extra(rt, 'verdictChip.chipWord'), 'AAA', '#14171a on white is AAA, and the sample panel says so in a chip');
  assert.equal(extra(rt, 'verdictChip.chipFill'), CHIP.pass);
});

test('the matrix chips stay inside their cells at the 12-swatch cap', { skip: SKIP }, async () => {
  const swatches = Array.from({ length: 12 }, (_, i) => {
    const v = Math.round((i / 11) * 255).toString(16).padStart(2, '0');
    return { name: `Step ${i}`, value: `#${v}${v}${v}` };
  });
  const rt = await mount({ color: '#14171a', background: '#ffffff', mode: 'palette' }, { swatches });
  const cells = rows(
    rt.getHydratedString('{{#each cells}}{{x}}|{{y}}|{{w}}|{{h}}|{{chipX}}|{{chipY}}|{{chipW}}|{{chipH}}|{{ratioY}};{{/each}}') as string,
    ['x', 'y', 'w', 'h', 'cx', 'cy', 'cw', 'ch', 'ratioY'],
  ).map((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)])));
  assert.equal(cells.length, 144);
  for (const c of cells) {
    assert.ok(c.cx! >= c.x! && c.cx! + c.cw! <= c.x! + c.w!, `chip overflows its cell horizontally: ${JSON.stringify(c)}`);
    assert.ok(c.cy! + c.ch! <= c.y! + c.h!, `chip overflows its cell vertically: ${JSON.stringify(c)}`);
    assert.ok(c.cy! > c.ratioY!, 'the chip sits below the ratio line');
    assert.ok(c.ch! >= 14, 'the chip is never too small to read');
  }
});

test('a shell with no host.color still renders on the local WCAG fallback', { skip: SKIP }, async () => {
  const rt = await mount({ color: '#767676', background: '#ffffff', mode: 'pair' }, { color: false });
  assert.equal(extra(rt, 'ratioValue'), contrastRatio('#767676', '#ffffff').toFixed(2),
    'the local fallback is the same WCAG formula, not an approximation');
  assert.equal(extra(rt, 'lcValue'), '', 'there is no local APCA, so Lc is omitted rather than invented');
  assert.equal(extra(rt, 'lcText'), 'Lc not available');
  assert.equal(extra(rt, 'error'), '', 'a missing optional API is not an error');
  assert.match(rt.getHydrated() as string, /class="cx-svg"/, 'the sheet still rendered');
});

test('the CSV carries one row per checked pair, with the documented columns', { skip: SKIP }, async () => {
  const exportHost = (over: HostOpts = {}) => {
    const h = makeHost(over);
    h.export = {
      render: async (_n: unknown, _f: string, opts: any) =>
        new Blob([opts.dataText ?? ''], { type: opts.dataMime ?? 'text/plain' }),
    };
    return h;
  };

  const rt = await createRuntime(tool, exportHost(), { color: '#767676', background: '#ffffff', mode: 'pair' });
  const text = await (await rt.export({}, 'csv', { embedMeta: false })).text();
  const lines = text.trim().split('\n');
  assert.equal(lines[0], 'fg,bg,ratio,level,lc,band');
  assert.equal(lines.length, 6, 'the header plus the five vision rows');
  for (const line of lines.slice(1)) {
    // The band column can carry a comma, so it is quoted by csvCell; count the
    // fields before it and check the pair columns are real values.
    const parts = line.split(',');
    assert.match(parts[0]!, /^#[0-9a-f]{6}$/);
    assert.match(parts[1]!, /^#[0-9a-f]{6}$/);
    assert.match(parts[2]!, /^\d+\.\d\d$/);
    assert.match(parts[3]!, /^(AAA|AA|UI|Fail)$/);
    assert.match(parts[4]!, /^\d+$/);
  }

  // Palette mode writes the whole matrix out instead.
  const rt2 = await createRuntime(
    tool,
    exportHost({ swatches: [{ name: 'A', value: '#000000' }, { name: 'B', value: '#ffffff' }] }),
    { color: '#14171a', background: '#ffffff', mode: 'palette' },
  );
  const csv2 = (await (await rt2.export({}, 'csv', { embedMeta: false })).text()).trim().split('\n');
  assert.equal(csv2.length, 5, 'the header plus 2x2 cells');
});

test('the APCA band is worded exactly as the engine words it', { skip: SKIP }, async () => {
  // engine/src/color-tools.ts owns APCA_BANDS so every surface showing an Lc says
  // the same thing. A tool that reworded a band, or invented one below Lc 30,
  // would be telling people a pair is usable where APCA says it is not.
  const pairs = [
    ['#000000', '#ffffff'], // Lc 106, top band
    ['#5a5a5a', '#ffffff'], // Lc 84
    ['#767676', '#ffffff'], // Lc 72
    ['#a0a0a0', '#ffffff'], // Lc 51
    ['#b8b8b8', '#ffffff'], // Lc 40
    ['#e8e8e8', '#ffffff'], // Lc 11, under every band
    ['#ffffff', '#111111'], // reverse polarity: the sign never shifts the band
  ];
  const seen = new Set<string>();
  for (const [fg, bg] of pairs) {
    const rt = await mount({ color: fg, background: bg, mode: 'pair' });
    const want = apcaVerdict(fg!, bg!)!.label;
    assert.equal(extra(rt, 'band'), want, `${fg} on ${bg}: band wording must match the engine's`);
    seen.add(want);
  }
  assert.ok(seen.size >= 5, 'the sample spans most of the band table, not one band repeated');

  // With no host.color there is no Lc, so the band line must not repeat the word
  // APCA: the template already prints "APCA: " in front of it.
  const bare = await mount({ color: '#767676', background: '#ffffff' }, { color: false });
  assert.equal(extra(bare, 'band'), 'not available on this shell');
});

test('a failing hook shows the reason and paints no empty fill', { skip: SKIP }, async () => {
  const rt = await mount({ color: '#767676', background: '#ffffff', mode: 'pair' }, { breakColor: true });
  assert.match(extra(rt, 'error'), /boom/, 'the failure is reported, not thrown');
  const html = rt.getHydrated() as string;
  assert.match(html, /Could not check this pair/);
  // The pair panels fill from the fgHex/bgHex extras, which the error result has
  // no values for. fill="" is an invalid attribute, so it paints solid black over
  // the error text - the sheet must skip those panels entirely instead.
  assert.doesNotMatch(html, /fill=""/, 'no element may be left with an empty fill');
  assert.doesNotMatch(html, /Primary action/, 'the sample panel is skipped on the error path');
});

test('every template seed, preset overlay and example hydrates cleanly', { skip: SKIP }, async () => {
  const swatches = [
    { name: 'Jungle', value: '#0c322c' },
    { name: 'Mint', value: '#90ebcd' },
    { name: 'Paper', value: '#f7f7f5' },
  ];

  const check = async (what: string, values: Record<string, unknown>) => {
    for (const opts of [{}, { swatches }]) {
      const rt = await mount(values, opts);
      assert.equal(extra(rt, 'error'), '', `${what}: hydrated with an error extra`);
      const html = rt.getHydrated() as string;
      assert.match(html, /class="cx-svg"/, `${what}: rendered no sheet`);
      assert.doesNotMatch(html, /fill=""/, `${what}: left an element with an empty fill`);
      // An unresolved {{extra}} would leave the literal braces in the markup.
      assert.doesNotMatch(html, /\{\{/, `${what}: the template referenced something the hook never set`);
    }
  };

  const dir = join(COMMUNITY, 'contrast-check', 'templates');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 2, 'the tool ships its "New from template" seeds');
  for (const file of files) {
    const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    await check(`template ${t.id}`, t.values);
    for (const p of t.presets ?? []) {
      // A preset is an overlay merged over the template base, preset wins.
      await check(`template ${t.id} preset ${p.id}`, { ...t.values, ...p.values });
    }
  }

  const examples = tool.manifest.examples ?? [];
  assert.ok(examples.length >= 3, 'a new tool ships at least three examples');
  for (const ex of examples) await check(`example "${ex.label}"`, ex.values);
});
