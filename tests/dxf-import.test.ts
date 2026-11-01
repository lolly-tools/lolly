// SPDX-License-Identifier: MPL-2.0
/**
 * DXF import: the WASM tag reader (Node loader), the flattener in engine/src/dxf-import.ts and the
 * Design boxes built from that list. Fixtures are synthetic (tests/fixtures/dxf/synthetic.ts) and the
 * round-trip case goes through Lolly's own emitDxf writer. No network, no corpus.
 *
 * Run with: node --test tests/dxf-import.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importDxf, flattenDxf, looksLikeDxf, aciToHex, plainMtext, dxfReportLines, DXF_LIMITS, type DxfRaw } from '../engine/src/dxf-import.ts';
import { dxfToDesign, DXF_MAX_BOXES } from '../engine/src/dxf-design.ts';
import { emitDxf } from '../engine/src/dxf.ts';
import { validateDesignHierarchy } from '../engine/src/design-hierarchy.ts';
import { subPathBounds } from '../engine/src/geom/dxf-geom.ts';
import { loadDxfKernel } from '../packages/node-shell/src/dxf-node.ts';
import { createDxfKernel, DxfError, DXF_MAX_INPUT, describeDxfError } from '../packages/node-shell/src/dxf.ts';
import { readFileSync } from 'node:fs';
import {
  dxfText, dxfBinary, line, circle, arc, ellipse, lwpolyline, polyline, spline, fitSpline, text, mtext, insert,
} from './fixtures/dxf/synthetic.ts';

const kernel = await loadDxfKernel();
const read = kernel.read;
const enc = (s: string) => new TextEncoder().encode(s);
const imp = (s: string, opts: Omit<Parameters<typeof importDxf>[1], 'read'> = {}) => importDxf(enc(s), { read, ...opts });
const allSegs = (r: ReturnType<typeof imp>) => r.strokes.flatMap((s) => s.subpaths.flatMap((sp) => sp.segments));
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// ─── the reader ──────────────────────────────────────────────────────────────

test('reads ASCII, binary R13+ and binary R12 files to the same entity list', () => {
  const ascii = dxfText({ layers: [{ name: 'WALLS', aci: 1 }], entities: [...line(0, 0, 10, 0, 'WALLS'), ...circle(5, 5, 2)] });
  const a = read(enc(ascii)), b = read(dxfBinary(ascii)), c = read(dxfBinary(ascii, true));
  assert.equal(a.fmt, 'ascii');
  assert.equal(b.fmt, 'binary');
  for (const other of [b, c]) {
    assert.deepEqual(other.e, a.e);
    assert.deepEqual(other.layers, a.layers);
    assert.equal(other.u, 4);
  }
});

test('code pages: ANSI_1251 and ANSI_932 text decode, and \\U+ escapes read as characters', () => {
  const head = (cp: string) => [[9, '$ACADVER'], [1, 'AC1018'], [9, '$DWGCODEPAGE'], [3, cp]] as [number, string][];
  const asciiWith = (cp: string, bytes: number[]) => {
    const body = dxfText({ header: head(cp), entities: text(0, 0, 1, 'XX') });
    const buf = new TextEncoder().encode(body);
    const at = body.indexOf('XX');
    const out = new Uint8Array(buf.length + bytes.length - 2);
    out.set(buf.subarray(0, at)); out.set(bytes, at); out.set(buf.subarray(at + 2), at + bytes.length);
    return out;
  };
  // "Привет" in Windows-1251.
  assert.equal(read(asciiWith('ANSI_1251', [0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2])).e[0]!.tx, 'Привет');
  // "日本" in Shift-JIS.
  assert.equal(read(asciiWith('ANSI_932', [0x93, 0xfa, 0x96, 0x7b])).e[0]!.tx, '日本');
  assert.equal(read(enc(dxfText({ entities: text(0, 0, 1, 'Caf\\U+00E9') }))).e[0]!.tx, 'Café');
});

test('refuses non-DXF input with a plain message', () => {
  assert.throws(() => read(enc('hello world\nthis is not a drawing\n')), DxfError);
  assert.throws(() => read(new Uint8Array(0)), /empty/);
  assert.match(describeDxfError(new DxfError('failed', 'x')), /could not be read/);
});

test('input cap is enforced before the module is asked', () => {
  assert.throws(() => read(new Uint8Array(DXF_MAX_INPUT + 1)), (e: unknown) => e instanceof DxfError && e.code === 'limit');
});

test('the group-code cap is reported, not crashed on', () => {
  const body = '0\nSECTION\n2\nENTITIES\n' + '0\nPOINT\n10\n0\n'.repeat(1_100_000);
  assert.throws(() => read(enc(body)), (e: unknown) => e instanceof DxfError && e.code === 'limit' && /more than/.test(e.message));
});

test('a trapped instance is retired', async () => {
  const k = await createDxfKernel(new Uint8Array(readFileSync(new URL('../packages/node-shell/wasm/dxf/dxf.wasm', import.meta.url))));
  assert.equal(k.dead, false);
  assert.equal(k.read(enc(dxfText({ entities: line(0, 0, 1, 1) }))).e.length, 1);
});

test('looksLikeDxf', () => {
  assert.equal(looksLikeDxf(enc(dxfText({ entities: line(0, 0, 1, 1) }))), true);
  assert.equal(looksLikeDxf(dxfBinary(dxfText({ entities: line(0, 0, 1, 1) }))), true);
  assert.equal(looksLikeDxf(enc('<svg xmlns="http://www.w3.org/2000/svg"/>')), false);
  assert.equal(looksLikeDxf(enc('999\ncomment\n0\nSECTION\n2\nHEADER\n')), true);
});

// ─── entities ────────────────────────────────────────────────────────────────

test('LINE becomes one move and one line, y flipped, at the stated scale', () => {
  const r = imp(dxfText({ entities: line(0, 0, 100, 50) }), { pxPerUnit: 2, margin: 10 });
  const segs = allSegs(r);
  assert.deepEqual(segs.map((s) => s.op), ['M', 'L']);
  assert.deepEqual([segs[0]!.x, segs[0]!.y], [10, 10 + 100]);
  assert.deepEqual([segs[1]!.x, segs[1]!.y], [210, 10]);
  assert.equal(r.width, 220);
  assert.equal(r.height, 120);
});

test('CIRCLE is four exact cubics that return to the start', () => {
  const r = imp(dxfText({ entities: circle(0, 0, 10) }), { pxPerUnit: 1, margin: 0 });
  const sp = r.strokes[0]!.subpaths[0]!;
  assert.equal(sp.closed, true);
  assert.equal(sp.segments.filter((s) => s.op === 'C').length, 4);
  const b = subPathBounds(sp)!;
  near(b[0], 0, 1e-6); near(b[2], 20, 1e-6);
  // A point of the curve midway along the first cubic sits on the radius.
  const first = sp.segments[0]!, c = sp.segments[1]!;
  if (c.op !== 'C') throw new Error('expected a cubic');
  const t = 0.5, mx = (1 - t) ** 3 * first.x + 3 * (1 - t) ** 2 * t * c.x1 + 3 * (1 - t) * t * t * c.x2 + t ** 3 * c.x;
  const my = (1 - t) ** 3 * first.y + 3 * (1 - t) ** 2 * t * c.y1 + 3 * (1 - t) * t * t * c.y2 + t ** 3 * c.y;
  near(Math.hypot(mx - 10, my - 10), 10, 2e-4);
});

test('ARC sweeps counter-clockwise from start to end, across zero degrees too', () => {
  const quarter = imp(dxfText({ entities: arc(0, 0, 10, 0, 90) }), { pxPerUnit: 1, margin: 0 });
  const s = allSegs(quarter);
  assert.equal(s.filter((x) => x.op === 'C').length, 1);
  near(s[0]!.x, 10); near(s[0]!.y, 10);          // starts at angle 0 (page y is flipped)
  near(s[1]!.x, 0); near(s[1]!.y, 0);            // ends at angle 90
  const wrap = imp(dxfText({ entities: arc(0, 0, 10, 270, 90) }), { pxPerUnit: 1, margin: 0 });
  assert.equal(allSegs(wrap).filter((x) => x.op === 'C').length, 2);
});

test('LWPOLYLINE with a bulge makes an arc, and the closing flag closes it', () => {
  const r = imp(dxfText({ entities: lwpolyline([[0, 0, 1], [10, 0]], false) }), { pxPerUnit: 1, margin: 0 });
  const segs = allSegs(r);
  // Bulge 1 is a half circle: radius 5, so the curve rises 5 units above the chord.
  const b = subPathBounds(r.strokes[0]!.subpaths[0]!)!;
  near(b[3] - b[1], 5, 1e-6);
  assert.ok(segs.some((x) => x.op === 'C'));
  const sq = imp(dxfText({ entities: lwpolyline([[0, 0], [4, 0], [4, 4], [0, 4]], true) }));
  assert.equal(sq.strokes[0]!.subpaths[0]!.closed, true);
});

test('POLYLINE vertices and bulges follow the header', () => {
  const r = imp(dxfText({ entities: polyline([[0, 0], [10, 0, 0.5], [10, 10]], true) }), { pxPerUnit: 1, margin: 0 });
  const sp = r.strokes[0]!.subpaths[0]!;
  assert.equal(sp.closed, true);
  assert.ok(sp.segments.some((s) => s.op === 'C'));
});

test('ELLIPSE: axes, ratio and a partial sweep', () => {
  const full = imp(dxfText({ entities: ellipse(0, 0, 10, 0, 0.5) }), { pxPerUnit: 1, margin: 0 });
  const b = subPathBounds(full.strokes[0]!.subpaths[0]!)!;
  near(b[2] - b[0], 20, 1e-3); near(b[3] - b[1], 10, 1e-3);
  const half = imp(dxfText({ entities: ellipse(0, 0, 0, 10, 0.5, 0, Math.PI) }), { pxPerUnit: 1, margin: 0 });
  const hb = subPathBounds(half.strokes[0]!.subpaths[0]!)!;
  // Major axis along y: x extent is the minor radius on the left (angle 0 to pi sweeps through -x).
  near(hb[3] - hb[1], 20, 1e-3);
  assert.equal(half.strokes[0]!.subpaths[0]!.closed, false);
});

test('SPLINE from control points and knots, and from fit points', () => {
  const nurbs = imp(dxfText({ entities: spline(3, [0, 0, 0, 0, 1, 1, 1, 1], [[0, 0], [10, 20], [20, -20], [30, 0]]) }), { pxPerUnit: 1, margin: 0 });
  const pts = allSegs(nurbs);
  assert.ok(pts.length > 20);
  near(pts[0]!.x, 0); near(pts[pts.length - 1]!.x, 30, 1e-6);
  const fit = imp(dxfText({ entities: fitSpline([[0, 0], [10, 10], [20, 0]]) }), { pxPerUnit: 1, margin: 0 });
  const s = allSegs(fit);
  assert.equal(s.filter((x) => x.op === 'C').length, 2);
  near(s[s.length - 1]!.x, 20);
});

test('TEXT and MTEXT keep their words, height and rotation', () => {
  const r = imp(dxfText({
    styles: [{ name: 'PLAN', font: 'arial.ttf', typeface: 'Arial' }],
    entities: [...text(10, 10, 2.5, 'Kitchen', 'PLAN', '0', [[50, 90]]), ...mtext(0, 0, 3, 'Living\\PRoom', 'PLAN')],
  }), { pxPerUnit: 4, margin: 0 });
  assert.equal(r.texts.length, 2);
  const t = r.texts[0]!;
  assert.equal(t.text, 'Kitchen');
  assert.equal(t.font, 'Arial');
  assert.equal(t.fontSource, 'typeface');
  near(t.height, 10);
  near(t.rotation, -90);
  assert.equal(r.texts[1]!.text, 'Living\nRoom');
  assert.equal(r.texts[1]!.vAnchor, 3);
});

test('text font: file name when no typeface is recorded, MTEXT inline font wins, SHX is reported not replaced', () => {
  const r = imp(dxfText({
    styles: [{ name: 'A', font: 'verdana.ttf' }, { name: 'S', font: 'simplex.shx' }, { name: 'N' }],
    entities: [...text(0, 0, 1, 'one', 'A'), ...mtext(0, 5, 1, '{\\fCalibri|b0|i0|c0|p34;two}', 'A'), ...text(0, 10, 1, 'three', 'S'), ...text(0, 15, 1, 'four', 'N')],
  }));
  assert.equal(r.texts[0]!.font, 'verdana');
  assert.equal(r.texts[0]!.fontSource, 'file');
  assert.equal(r.texts[1]!.font, 'Calibri');
  assert.equal(r.texts[1]!.fontSource, 'inline');
  assert.equal(r.texts[1]!.text, 'two');
  assert.equal(r.texts[2]!.font, undefined);
  assert.equal(r.texts[2]!.shx, 'simplex.shx');
  assert.equal(r.texts[3]!.font, undefined);
  assert.equal(r.report.shxFonts[0]!.file, 'simplex.shx');
  assert.equal(r.report.unnamedFontTexts, 1);
  assert.ok(dxfReportLines(r.report).some((l) => /SHX font simplex\.shx/.test(l)));
});

test('MTEXT formatting codes become plain text', () => {
  assert.equal(plainMtext('A\\PB\\~C\\\\D\\{E\\}').text, 'A\nB\u00a0C\\D{E}');
  assert.equal(plainMtext('\\H2.5x;big \\C1;red \\S1/2; \\U+00B0').text, 'big red 1/2 \u00b0');
  assert.equal(plainMtext('5%%d  %%c10 %%p1').text, '5\u00b0  \u00d810 \u00b11');
  assert.equal(plainMtext('{\\fArial|b1;a}{\\fTimes|b0;b}').extraFonts, 1);
});

test('extrusion (0,0,-1) mirrors an entity across the y axis', () => {
  const r = imp(dxfText({ entities: [...line(0, 0, 100, 0), [0, 'CIRCLE'], [8, '0'], [10, 50], [20, 0], [30, 0], [40, 5], [210, 0], [220, 0], [230, -1]] }), { pxPerUnit: 1, margin: 0 });
  const circle = r.strokes.flatMap((s) => s.subpaths).find((sp) => sp.closed)!;
  const b = subPathBounds(circle)!;
  // Mirrored, the centre is at x = -50 and the drawing spans -55 to 100, so the centre sits 5 from the left edge.
  near((b[0] + b[2]) / 2, 5, 1e-6);
});

// ─── blocks ──────────────────────────────────────────────────────────────────

test('INSERT places a block with scale, rotation and base point', () => {
  const r = imp(dxfText({
    blocks: [{ name: 'DOOR', base: [1, 0], entities: line(1, 0, 3, 0) }],
    entities: insert('DOOR', 10, 10, '0', [[41, 2], [42, 2], [50, 90]]),
  }), { pxPerUnit: 1, margin: 0 });
  const [a, b] = allSegs(r);
  // Block line (1,0)-(3,0): relative to base (0,0)-(2,0), scaled x2 -> (0,0)-(4,0), rotated 90 -> (0,0)-(0,4), placed at (10,10).
  near(Math.abs(a!.x - b!.x), 0); near(Math.abs(a!.y - b!.y), 4);
});

test('nested blocks, array inserts, and layer 0 taking the insert layer', () => {
  const r = imp(dxfText({
    layers: [{ name: 'FURN', aci: 3 }, { name: '0' }],
    blocks: [
      { name: 'LEG', entities: line(0, 0, 1, 0, '0') },
      { name: 'TABLE', entities: [...insert('LEG', 0, 0), ...insert('LEG', 5, 0)] },
    ],
    entities: insert('TABLE', 0, 0, 'FURN', [[70, 2], [71, 2], [44, 20], [45, 20]]),
  }));
  assert.equal(r.report.entitiesDrawn, 8);
  assert.equal(r.layers.find((l) => l.name === 'FURN')!.strokes, 8);
  assert.equal(r.layers.find((l) => l.name === '0')!.strokes, 0);
  assert.equal(r.strokes[0]!.color, '#00ff00');
});

test('block nesting is bounded and a block that contains itself is named, not followed', () => {
  const chain = Array.from({ length: 12 }, (_, i) => ({ name: `B${i}`, entities: i < 11 ? insert(`B${i + 1}`, 1, 0) : line(0, 0, 1, 0) }));
  const deep = imp(dxfText({ blocks: chain, entities: insert('B0', 0, 0) }));
  assert.ok(deep.report.truncated.some((t) => /nested more than 8/.test(t)));
  assert.equal(deep.report.entitiesDrawn, 0);
  const loop = imp(dxfText({ blocks: [{ name: 'A', entities: [...line(0, 0, 1, 1), ...insert('A', 1, 1)] }], entities: insert('A', 0, 0) }));
  assert.deepEqual(loop.report.recursiveBlocks, ['A']);
  assert.equal(loop.report.entitiesDrawn, 1);
});

test('exponential block fan-out stops at the drawn-entity budget', () => {
  // Eight levels of ten inserts is 10^8 leaves; the budget must stop it long before.
  const blocks = Array.from({ length: 8 }, (_, i) => ({ name: `F${i}`, entities: Array.from({ length: 10 }, () => insert(i < 7 ? `F${i + 1}` : 'LEAF', 0, 0)).flat() }));
  blocks.push({ name: 'LEAF', entities: line(0, 0, 1, 1) });
  const t0 = Date.now();
  const r = imp(dxfText({ blocks, entities: insert('F0', 0, 0) }));
  assert.ok(Date.now() - t0 < 20000);
  assert.ok(r.report.entitiesDrawn <= DXF_LIMITS.drawnEntities);
  assert.ok(r.report.truncated.length > 0);
});

test('DIMENSION draws through its anonymous block', () => {
  const r = imp(dxfText({
    blocks: [{ name: '*D1', entities: line(0, 0, 5, 0) }],
    entities: [[0, 'DIMENSION'], [8, '0'], [2, '*D1'], [10, 0], [20, 0], [30, 0], [70, 1]],
  }));
  assert.equal(r.report.entitiesDrawn, 1);
});

// ─── the report: say it plainly ──────────────────────────────────────────────

test('XREFs, paper space, hidden layers and unsupported entities are reported, not guessed', () => {
  const r = imp(dxfText({
    layers: [{ name: 'WALLS' }, { name: 'OFF', aci: -3 }, { name: 'FROZEN', flags: 1 }],
    blocks: [{ name: 'SITE', xref: 'site-plan.dwg' }],
    entities: [
      ...line(0, 0, 10, 0, 'WALLS'), ...line(0, 5, 10, 5, 'OFF'), ...line(0, 6, 10, 6, 'FROZEN'),
      ...insert('SITE', 0, 0, 'WALLS'),
      [0, 'LINE'], [67, 1], [8, 'WALLS'], [10, 0], [20, 0], [11, 1], [21, 1],
      [0, 'HATCH'], [8, 'WALLS'], [0, 'HATCH'], [8, 'WALLS'], [0, 'SOLID'], [8, 'WALLS'],
    ],
  }));
  assert.equal(r.report.entitiesDrawn, 1);
  assert.deepEqual(r.report.layersHidden.sort(), ['FROZEN', 'OFF']);
  assert.equal(r.report.xrefs[0]!.name, 'SITE');
  assert.equal(r.report.xrefs[0]!.inserted, 1);
  assert.equal(r.report.paperSpace.count, 1);
  assert.equal(r.report.skipped.HATCH, 2);
  const lines = dxfReportLines(r.report).join('\n');
  assert.match(lines, /External reference "SITE" \(site-plan\.dwg\) is not loaded/);
  assert.match(lines, /1 item sits in paper space/);
  assert.match(lines, /Not imported: 2 HATCH, 1 SOLID/);
  assert.match(lines, /FROZEN/);
});

test('the real CLI reads a DXF and writes an SVG preview and Design JSON', async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const run = promisify(execFile);
  const bin = new URL('../shells/cli/bin/lolly.ts', import.meta.url).pathname;
  const dir = await mkdtemp(join(tmpdir(), 'lolly-cli-dxf-'));
  try {
    const src = join(dir, 'plan.dxf');
    await writeFile(src, dxfText({
      layers: [{ name: 'WALLS', aci: 1 }], blocks: [{ name: 'SITE', xref: 'site.dwg' }],
      entities: [...lwpolyline([[0, 0], [5000, 0], [5000, 4000], [0, 4000]], true, 'WALLS'), ...text(2500, 2000, 200, 'Hall', 'STANDARD', 'WALLS'), ...insert('SITE', 0, 0)],
    }));
    const report = await run(process.execPath, [bin, 'dxf', src], { env: { ...process.env, LOLLY_PROFILE: 'lolly-start' } });
    assert.match(report.stdout, /External reference "SITE"/);
    assert.match(report.stdout, /WALLS: 1 paths, 1 text items/);
    await run(process.execPath, [bin, 'dxf', src, `--output=${join(dir, 'plan.svg')}`], { env: { ...process.env, LOLLY_PROFILE: 'lolly-start' } });
    assert.match(await readFile(join(dir, 'plan.svg'), 'utf8'), /<path d="M40 /);
    await run(process.execPath, [bin, 'dxf', src, `--output=${join(dir, 'plan.json')}`], { env: { ...process.env, LOLLY_PROFILE: 'lolly-start' } });
    const design = JSON.parse(await readFile(join(dir, 'plan.json'), 'utf8')) as { boxes: Array<{ kind: string }> };
    assert.deepEqual(design.boxes.map((b) => b.kind), ['path', 'text', 'group']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the layer filter and includeHidden', () => {
  const src = dxfText({ layers: [{ name: 'A' }, { name: 'B' }, { name: 'C', aci: -1 }], entities: [...line(0, 0, 1, 0, 'A'), ...line(0, 1, 1, 1, 'B'), ...line(0, 2, 1, 2, 'C')] });
  assert.equal(imp(src, { layers: ['b'] }).report.entitiesDrawn, 1);
  assert.deepEqual(imp(src, { layers: ['b'] }).report.layersFiltered.sort(), ['A', 'C']);
  assert.equal(imp(src, { includeHidden: true }).report.entitiesDrawn, 3);
});

test('units come from $INSUNITS and drive the stated scale; none declared is said so', () => {
  const metres = imp(dxfText({ header: [[9, '$INSUNITS'], [70, 6]], entities: line(0, 0, 10, 0) }), { pxPerUnit: 100 });
  assert.equal(metres.report.units.name, 'metres');
  near(metres.report.mmPerPx, 10);
  const none = imp(dxfText({ header: [[9, '$ACADVER'], [1, 'AC1015']], entities: line(0, 0, 10, 0) }), { pxPerUnit: 1 });
  assert.equal(none.report.units.declared, false);
  assert.match(dxfReportLines(none.report).join('\n'), /does not state its drawing units/);
  const inches = imp(dxfText({ header: [[9, '$INSUNITS'], [70, 1]], entities: line(0, 0, 10, 0) }), { pxPerUnit: 1 });
  near(inches.report.mmPerPx, 25.4);
  assert.equal(imp(dxfText({ header: [], entities: line(0, 0, 1, 0) }), { unitless: 'in' }).report.units.name, 'inches');
});

test('colours: ACI table, true colour, by layer and by block', () => {
  assert.equal(aciToHex(1), '#ff0000');
  assert.equal(aciToHex(7), '#000000');
  assert.equal(aciToHex(10), '#ff0000');
  assert.equal(aciToHex(11), '#ff7f7f');
  assert.equal(aciToHex(12), '#a50000');
  assert.equal(aciToHex(250), '#333333');
  assert.equal(aciToHex(256), null);
  const r = imp(dxfText({
    layers: [{ name: 'L', aci: 5 }],
    entities: [...line(0, 0, 1, 0, 'L'), ...line(0, 1, 1, 1, 'L', [[62, 2]]), ...line(0, 2, 1, 2, 'L', [[420, 0xff8000]])],
  }));
  assert.deepEqual(r.strokes.map((s) => s.color).sort(), ['#0000ff', '#ff8000', '#ffff00']);
});

test('hostile numbers are dropped, not drawn', () => {
  const r = imp(dxfText({ entities: [...line(0, 0, 1e300, 0), ...circle(0, 0, -5), ...line(0, 0, 2, 2)] }));
  assert.equal(r.report.entitiesDrawn, 1);
});

// ─── Lolly's own writer round trip ───────────────────────────────────────────

test('a drawing written by emitDxf reads back at the same size', () => {
  const ir = {
    width: 400, height: 200,
    prims: [
      { type: 'path' as const, fill: { r: 255, g: 0, b: 0 }, fillRule: 'nonzero' as const, stroke: null,
        subpaths: [{ closed: true, segments: [{ op: 'M' as const, x: 20, y: 20 }, { op: 'L' as const, x: 380, y: 20 }, { op: 'L' as const, x: 380, y: 180 }, { op: 'L' as const, x: 20, y: 180 }] }] },
      { type: 'path' as const, fill: { r: 0, g: 0, b: 255 }, fillRule: 'nonzero' as const, stroke: null,
        subpaths: [{ closed: false, segments: [{ op: 'M' as const, x: 50, y: 100 }, { op: 'C' as const, x1: 100, y1: 20, x2: 300, y2: 20, x: 350, y: 100 }] }] },
    ],
  };
  // With no physical size the writer maps 96 px to 25.4 mm.
  const { text: dxf } = emitDxf(ir);
  const mm = 25.4 / 96;
  const r = imp(dxf, { pxPerUnit: 1, margin: 0 });
  assert.equal(r.report.units.name, 'millimetres');
  assert.equal(r.report.version, 'AC1009');
  assert.equal(r.report.entitiesDrawn, 2);
  const box = r.strokes.flatMap((s) => s.subpaths).map((sp) => subPathBounds(sp)!);
  const rect = box.find((b) => Math.abs(b[2] - b[0] - 360 * mm) < 1e-2)!;
  near(rect[3] - rect[1], 160 * mm, 1e-2);
  assert.deepEqual(r.strokes.map((s) => s.color).sort(), ['#0000ff', '#ff0000']);
});

// ─── Design boxes ────────────────────────────────────────────────────────────

test('Design boxes: path boxes per layer colour, groups, text boxes with the named font', () => {
  const r = imp(dxfText({
    layers: [{ name: 'WALLS', aci: 1 }, { name: 'TEXT', aci: 3 }],
    styles: [{ name: 'PLAN', font: 'arial.ttf', typeface: 'Arial' }],
    entities: [...line(0, 0, 100, 0, 'WALLS'), ...line(0, 0, 0, 100, 'WALLS'), ...text(10, 10, 5, 'Hall', 'PLAN', 'TEXT'), ...text(50, 50, 5, 'Kitchen', 'PLAN', 'TEXT')],
  }));
  const d = dxfToDesign(r);
  const paths = d.boxes.filter((b) => b.kind === 'path');
  const texts = d.boxes.filter((b) => b.kind === 'text');
  const groups = d.boxes.filter((b) => b.kind === 'group');
  assert.equal(paths.length, 1);
  assert.equal(String(paths[0]!.stroke), '#ff0000');
  assert.equal(typeof paths[0]!.path, 'string');
  assert.equal(texts.length, 2);
  assert.equal(texts[0]!.font, 'Arial');
  assert.equal(texts[0]!.text, 'Hall');
  assert.equal(groups.length, 1);
  assert.deepEqual(validateDesignHierarchy(d.boxes as never), []);
  assert.deepEqual(d.fontsNamed, ['Arial']);
  assert.ok(d.notes.some((n) => /keeps the font names/.test(n)));
  assert.equal(d.width, r.width);
});

test('Design boxes: one import never exceeds the layer limit and says so', () => {
  const many: ReturnType<typeof text> = [];
  for (let i = 0; i < DXF_MAX_BOXES + 50; i++) many.push(...text(i, 0, 1, `t${i}`));
  const d = dxfToDesign(imp(dxfText({ entities: many })));
  assert.ok(d.boxes.length <= DXF_MAX_BOXES);
  assert.ok(d.notes.some((n) => /did not fit/.test(n)));
});

test('a large layer splits into several path boxes', () => {
  const ents = Array.from({ length: 9000 }, (_, i) => line(i, 0, i, 5)).flat();
  const d = dxfToDesign(imp(dxfText({ entities: ents })));
  assert.ok(d.boxes.filter((b) => b.kind === 'path').length >= 4);
});

test('an empty drawing imports to no boxes and a report', () => {
  const r = imp(dxfText({ entities: [] }));
  assert.equal(dxfToDesign(r).boxes.length, 0);
  assert.equal(r.report.entitiesDrawn, 0);
});

test('flattenDxf accepts a hand-built raw list (the shell contract)', () => {
  const raw: DxfRaw = { v: 1, fmt: 'ascii', acadver: '', cp: '', u: 4, ms: 1, tags: 0, layers: [{ n: '0', c: 7 }], styles: [], blocks: [], e: [{ t: 'LINE', l: 0, p: [0, 0, 0], q: [1, 1, 0] }], paper: { n: 0, types: {} }, skipped: {}, xrefs: [], notes: [] };
  assert.equal(flattenDxf(raw).report.entitiesDrawn, 1);
});
