// SPDX-License-Identifier: MPL-2.0
/**
 * Print Sheet (community/print-sheet) - imposition contract.
 *
 * Loads the REAL tool from the community pack (manifest + template + hooks) and
 * drives it through the engine, because the promise here is arithmetic: a cell
 * has to land on an exact millimetre position or the printed sheet is wrong.
 * The template's <svg> viewBox is in millimetres, so every coordinate parsed
 * back out of the hydrated markup IS the print measurement.
 *
 * What is pinned:
 *   - cell rectangles and crop-mark positions for A4, 2 x 2, gap 5, margin 10;
 *   - the 40-cell cap (and that it says so rather than silently dropping);
 *   - spacing that cannot fit is trimmed, never turned into a negative box;
 *   - artwork arrives through the END-USER compose path (a pasted Lolly tool
 *     link in the asset slot, incl. straight off a URL param) and is composed
 *     ONCE for the whole sheet;
 *   - every example, template and preset seed hydrates with no hook error.
 *
 * Run with: node --test tests/print-sheet.test.ts
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

// print-sheet ships in the PUBLIC community pack. Load from the SOURCE pack, not
// the gitignored tools/ profile view, so the suite is profile-independent: skip
// only when community/ isn't checked out (a clone without submodules); with it
// present, a missing tool dir means a rename/delete and must FAIL loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'print-sheet', 'tool.json')),
    'community/print-sheet/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('print-sheet', fetchFile);

// A Lolly tool link of the shape a user pastes into the picker (the Share
// dialog's embed form). qr-code is community, so it exists under every profile.
const TOOL_LINK = 'https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Flolly.tools';

/** A host whose compose bridge renders any tool link to a fixed blob URL. */
function composeHost(calls: string[] = []): any {
  return baseHost({
    compose: {
      async renderUrl(url: string) {
        calls.push(url);
        return { source: 'remote', id: url, type: 'vector', format: 'svg', url: 'blob:composed-art' };
      },
    },
  });
}

async function mount(values: Record<string, unknown>, host: any = baseHost()) {
  const rt = await createRuntime(tool, host, values as any);
  return { rt, html: rt.getHydrated() as string };
}

/** The numeric attributes this suite reads back off a shape. NaN when absent. */
interface Shape {
  x: number; y: number; width: number; height: number; rx: number;
  x1: number; y1: number; x2: number; y2: number;
}

// Pull every attribute set off the tags matching `re` out of the hydrated SVG.
function attrs(html: string, re: RegExp): Shape[] {
  const out: Shape[] = [];
  for (const m of html.matchAll(re)) {
    const rec: Record<string, number> = {};
    // The leading \s matters: without it "width" also matches inside
    // stroke-width and the cell box comes back as the hairline.
    for (const a of m[0].matchAll(/\s([a-z0-9]+)="([-0-9.]+)"/g)) rec[a[1]!] = Number(a[2]);
    out.push(rec as unknown as Shape);
  }
  return out;
}

const cellRects = (html: string) => attrs(html, /<rect class="ps-empty"[^>]*>/g);
const cutRects = (html: string) => attrs(html, /<rect class="ps-cut"[^>]*>/g);
const tickLines = (html: string) => attrs(html, /<line class="ps-tick"[^>]*>/g);

describe('print-sheet geometry', { skip: SKIP }, () => {
  test('A4 2 x 2, gap 5, margin 10 puts every cell on its millimetre', async () => {
    const { html } = await mount({ sheet: 'a4', rows: 2, cols: 2, gap: 5, margin: 10 });

    // The viewBox IS the sheet, in millimetres.
    assert.match(html, /viewBox="0 0 210 297"/);

    // (210 - 2*10 - 5) / 2 = 92.5 wide; (297 - 2*10 - 5) / 2 = 136 tall.
    const cells = cellRects(html);
    assert.equal(cells.length, 4);
    const boxes = cells.map(c => [c.x, c.y, c.width, c.height]);
    // Cell pitch is cell + gap: 10, 10 + 92.5 + 5 = 107.5 across; 10, 151 down.
    assert.deepEqual(boxes, [
      [10, 10, 92.5, 136],
      [107.5, 10, 92.5, 136],
      [10, 151, 92.5, 136],
      [107.5, 151, 92.5, 136],
    ]);
    // The grid fills the sheet inside its margins, to the millimetre.
    const last = cells[3]!;
    assert.equal(last.x + last.width, 200);
    assert.equal(last.y + last.height, 287);
  });

  test('crop marks sit in the margin, off every cell edge', async () => {
    const { html } = await mount({ sheet: 'a4', rows: 2, cols: 2, gap: 5, margin: 10 });
    const ticks = tickLines(html);

    // 2 columns x 2 edges x (top + bottom) + 2 rows x 2 edges x (left + right).
    assert.equal(ticks.length, 16);

    // Marks are 4 mm long, held 1.5 mm off the trim edge (margin 10 leaves room
    // for both), so a top mark runs y 4.5 -> 8.5 and a bottom one 288.5 -> 292.5.
    const vertical = ticks.filter(t => t.x1 === t.x2);
    const horizontal = ticks.filter(t => t.y1 === t.y2);
    assert.equal(vertical.length, 8);
    assert.equal(horizontal.length, 8);

    const topXs = vertical.filter(t => t.y1 === 4.5 && t.y2 === 8.5).map(t => t.x1).sort((a, b) => a - b);
    const bottomXs = vertical.filter(t => t.y1 === 288.5 && t.y2 === 292.5).map(t => t.x1).sort((a, b) => a - b);
    assert.deepEqual(topXs, [10, 102.5, 107.5, 200]);
    assert.deepEqual(bottomXs, [10, 102.5, 107.5, 200]);

    const leftYs = horizontal.filter(t => t.x1 === 4.5 && t.x2 === 8.5).map(t => t.y1).sort((a, b) => a - b);
    const rightYs = horizontal.filter(t => t.x1 === 201.5 && t.x2 === 205.5).map(t => t.y1).sort((a, b) => a - b);
    assert.deepEqual(leftYs, [10, 146, 151, 287]);
    assert.deepEqual(rightYs, [10, 146, 151, 287]);

    // No mark may cross into a cell: every vertical mark ends at or before the
    // top trim line, or starts at or after the bottom one.
    for (const t of vertical) assert.ok(t.y2 <= 10 || t.y1 >= 287, `mark at x=${t.x1} runs over the artwork`);
    for (const t of horizontal) assert.ok(t.x2 <= 10 || t.x1 >= 200, `mark at y=${t.y1} runs over the artwork`);
  });

  test('crop marks switch off, and a marginless sheet says why they cannot show', async () => {
    const off = await mount({ sheet: 'a4', rows: 2, cols: 2, ticks: false });
    assert.equal(tickLines(off.html).length, 0);

    const flush = await mount({ sheet: 'a4', rows: 2, cols: 2, margin: 0, ticks: true });
    assert.equal(tickLines(flush.html).length, 0);
    const note = flush.rt.getHydratedString('{{note}}') as string;
    assert.match(note, /margin/i);
  });

  test('round-rect adds a die line per cell; straight cut does not', async () => {
    const round = await mount({ sheet: 'a4', rows: 3, cols: 3, gap: 6, margin: 12, tickShape: 'round-rect' });
    const cuts = cutRects(round.html);
    assert.equal(cuts.length, 9);
    // Radius is 12% of the short cell edge, capped at 5 mm and floored at 1 mm.
    const cell = cellRects(round.html)[0]!;
    const expected = Math.min(5, Math.max(1, Math.min(cell.width, cell.height) * 0.12));
    assert.ok(Math.abs(cuts[0]!.rx - expected) < 0.01, `die-line radius ${cuts[0]!.rx} should be ${expected}`);

    const straight = await mount({ sheet: 'a4', rows: 3, cols: 3, tickShape: 'rect' });
    assert.equal(cutRects(straight.html).length, 0);
  });

  test('each sheet size drives its own viewBox', async () => {
    for (const [sheet, box] of [
      ['a4', '0 0 210 297'], ['a4l', '0 0 297 210'],
      ['letter', '0 0 215.9 279.4'], ['a3', '0 0 297 420'],
    ] as const) {
      const { html } = await mount({ sheet });
      assert.match(html, new RegExp(`viewBox="${box}"`), `${sheet} viewBox`);
    }
  });
});

describe('print-sheet limits', { skip: SKIP }, () => {
  test('the sheet caps at 40 cells and says what it dropped', async () => {
    const { rt, html } = await mount({ sheet: 'a4', rows: 10, cols: 10, gap: 2, margin: 8 });
    assert.equal(cellRects(html).length, 40);
    assert.equal(rt.getHydratedString('{{rowsOut}}'), '4');
    const note = rt.getHydratedString('{{note}}') as string;
    assert.match(note, /40/);
    assert.match(note, /second sheet/i);
  });

  test('spacing that cannot fit is trimmed, never a negative box', async () => {
    // 10 columns with a 30 mm gap and a 30 mm margin asks for 330 mm of A4's 210.
    const { rt, html } = await mount({ sheet: 'a4', rows: 4, cols: 10, gap: 30, margin: 30 });
    const cells = cellRects(html);
    assert.equal(cells.length, 40);
    for (const c of cells) {
      assert.ok(c.width > 0 && c.height > 0, 'a cell came out with no area');
      assert.ok(c.x >= 0 && c.y >= 0, 'a cell came out off the sheet');
      assert.ok(c.x + c.width <= 210.001 && c.y + c.height <= 297.001, 'a cell ran off the sheet');
    }
    assert.match(rt.getHydratedString('{{note}}') as string, /trimmed/i);
  });

  test('out-of-range values from a URL fall back rather than break the grid', async () => {
    const { html } = await mount({ rows: -3, cols: 999, gap: -10, margin: 500 });
    const cells = cellRects(html);
    assert.ok(cells.length >= 1 && cells.length <= 40, `nonsense input produced ${cells.length} cells`);
    for (const c of cells) assert.ok(c.width > 0 && c.height > 0);
  });
});

describe('print-sheet hardening', { skip: SKIP }, () => {
  test('an Object.prototype key as the sheet name falls back to A4', async () => {
    // A URL param bypasses the engine's select whitelist (`constrain` runs from
    // updateInput only, see engine/src/preflight.ts), so the hook is the guard.
    // A plain object lookup is truthy for these four and used to paint NaN.
    for (const sheet of ['constructor', '__proto__', 'toString', 'valueOf']) {
      const { rt, html } = await mount({ sheet });
      assert.match(html, /viewBox="0 0 210 297"/, `sheet=${sheet} lost its page size`);
      assert.doesNotMatch(html, /NaN|undefined/, `sheet=${sheet} leaked a bad number into the sheet`);
      assert.match(rt.getHydratedString('{{summary}}') as string, /^A4 portrait/, `sheet=${sheet} summary`);
      assert.equal(cellRects(html).length, 4);
    }
    // An unknown-but-harmless value takes the same fallback.
    assert.match((await mount({ sheet: 'zzz' })).html, /viewBox="0 0 210 297"/);
  });

  test('a hook error is shown, and is cleared by the next good input', async () => {
    // Hook patches ACCUMULATE into extras, so a run that omits `error` leaves the
    // previous message standing. A circular value reaches the model because
    // initial values skip `constrain`, and it makes the memo key throw.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const { rt, html } = await mount({ ticks: circular });
    assert.match(rt.getHydratedString('{{error}}') as string, /Could not lay out this sheet/);
    // The message needs a page to paint on, so the error state still carries A4.
    assert.match(html, /viewBox="0 0 210 297"/);

    await rt.setInput('ticks', true);
    assert.equal(rt.getHydratedString('{{error}}'), '', 'the error stuck after the input was fixed');
    assert.equal(cellRects(rt.getHydrated() as string).length, 4);
  });

  test('the die line is independent of the crop marks', async () => {
    // `showIf: { ticks: true }` on tickShape hid the control whenever marks were
    // off, while the hook still drew the die lines - an unreachable live state.
    const shape = (tool.manifest.inputs as Array<Record<string, unknown>>).find(i => i.id === 'tickShape')!;
    assert.equal(shape.showIf, undefined, 'the cut shape must stay reachable with crop marks off');

    const { html } = await mount({ sheet: 'a4', rows: 2, cols: 2, ticks: false, tickShape: 'round-rect' });
    assert.equal(tickLines(html).length, 0);
    assert.equal(cutRects(html).length, 4);
  });

  test('the sheet does not declare print intent to the export bar', async () => {
    // The sheet draws its own marks INSIDE the page. render.printMarks: true would
    // default the engine's print-finishing card ON for pdf/svg, and those marks sit
    // in a band BEYOND the trim - so an "A4" download would come out bigger than A4
    // with two sets of marks. The card stays offered (pdf is a format), just off.
    const r = tool.manifest.render as Record<string, unknown>;
    assert.equal(r.printMarks, undefined);
    assert.ok((r.formats as string[]).includes('pdf'));
  });

  test('the accessible summary reports the rows actually laid out', async () => {
    const capped = await mount({ rows: 10, cols: 10 });
    assert.equal(cellRects(capped.html).length, 40);
    // 10 x 10 is capped to 4 x 10, and the label has to say 4 - not the asked-for 10.
    assert.equal(capped.rt.getHydratedString(tool.manifest.a11yLabel),
      'Print sheet, 4 rows by 10 columns of the same artwork');
    assert.match(capped.html, /aria-label="Print sheet, 4 rows by 10 columns"/);
  });
});

describe('print-sheet artwork', { skip: SKIP }, () => {
  test('a pasted Lolly tool link fills every cell, composed once', async () => {
    const calls: string[] = [];
    const { html } = await mount(
      { sheet: 'a4', rows: 2, cols: 2, image: { source: 'remote', id: TOOL_LINK, _unresolved: true } },
      composeHost(calls),
    );
    // One child render for the whole sheet - imposition repeats the SAME artwork.
    assert.deepEqual(calls, [TOOL_LINK]);
    const images = html.match(/<image [^>]*>/g) ?? [];
    assert.equal(images.length, 4);
    for (const img of images) assert.match(img, /href="blob:composed-art"/);
    // With artwork placed there is no empty-cell outline and no hint left.
    assert.equal(cellRects(html).length, 0);
    assert.doesNotMatch(html, /Paste a Lolly tool link/);
  });

  test('the same link arrives through a URL param', async () => {
    const calls: string[] = [];
    const state = parseUrlState(`image=${encodeURIComponent(TOOL_LINK)}&rows=2&cols=3`, tool.manifest);
    const { html } = await mount(state.values as Record<string, unknown>, composeHost(calls));
    assert.deepEqual(calls, [TOOL_LINK]);
    assert.equal((html.match(/<image [^>]*>/g) ?? []).length, 6);
  });

  test('a shell with no compose bridge still renders the grid and says what to do', async () => {
    const { html } = await mount(
      { sheet: 'a4', rows: 2, cols: 2, image: { source: 'remote', id: TOOL_LINK, _unresolved: true } },
      baseHost(),
    );
    assert.equal(html.includes('<image '), false);
    assert.equal(cellRects(html).length, 4);
    assert.match(html, /Paste a Lolly tool link/);
  });
});

describe('print-sheet seeds', { skip: SKIP }, () => {
  function seeds(): Array<{ label: string; values: Record<string, unknown> }> {
    const out: Array<{ label: string; values: Record<string, unknown> }> = [];
    for (const ex of (tool.manifest.examples ?? []) as Array<{ label: string; values: Record<string, unknown> }>) {
      out.push({ label: `example ${ex.label}`, values: ex.values });
    }
    const dir = join(COMMUNITY, 'print-sheet', 'templates');
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue;
      const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      out.push({ label: `template ${t.id}`, values: t.values });
      for (const p of t.presets ?? []) {
        out.push({ label: `template ${t.id} preset ${p.id}`, values: { ...t.values, ...p.values } });
      }
    }
    return out;
  }

  test('every example, template and preset seed hydrates', async () => {
    const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));
    const list = seeds();
    assert.ok(list.length >= 3 + 2, 'the seed sweep found nothing to check');

    for (const { label, values } of list) {
      for (const key of Object.keys(values)) {
        assert.ok(ids.has(key), `${label} seeds "${key}", which is not an input`);
      }
      const { rt, html } = await mount(values, composeHost());
      assert.equal(rt.getHydratedString('{{error}}'), '', `${label} surfaced a hook error`);
      assert.match(html, /<svg class="ps-svg"/, `${label} did not render a sheet`);
      const wanted = Number(values.rows ?? 2) * Number(values.cols ?? 2);
      assert.equal(cellRects(html).length, Math.min(40, wanted), `${label} laid out the wrong cell count`);
      if (values.tickShape === 'round-rect') {
        assert.equal(cutRects(html).length, Math.min(40, wanted), `${label} lost its die lines`);
      }
    }
  });

  test('ten cells mount inside the interactive budget', async () => {
    // Imposition composes ONCE and repeats the placement, so cell count is
    // template work, not render work. Recorded so a regression is visible.
    const t0 = performance.now();
    await mount({ sheet: 'a4', rows: 5, cols: 2, image: { source: 'remote', id: TOOL_LINK, _unresolved: true } }, composeHost());
    const ms = performance.now() - t0;
    console.log(`  10-cell mount: ${ms.toFixed(1)} ms`);
    assert.ok(ms < 2000, `a 10-cell mount took ${ms.toFixed(0)} ms, past the onInput hook budget`);
  });
});
