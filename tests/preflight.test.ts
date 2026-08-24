// SPDX-License-Identifier: MPL-2.0
/**
 * Preflight rules - engine/src/preflight.ts.
 *
 * Every check is exercised BOTH ways: firing when its trigger is present, and
 * staying silent when it is not. A check that only ever gets a positive test
 * quietly becomes "always fires" the first time someone loosens a guard.
 *
 * Three properties get their own section at the end, because they are the whole
 * point of the module rather than any single check:
 *   - the gap invariant (needs => info, and no count),
 *   - the refusals being present rather than absent,
 *   - totality: hostile and malformed jobs degrade, they never throw.
 *
 * Run with: node --test tests/preflight.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  preflight,
  PRINT_MARK_FORMATS, SEPARATING_FORMATS, SPOT_PLATE_FORMATS, KNOWN_FINISHES,
  DEPTH_FORMATS, RASTER_FORMATS,
} from '../engine/src/preflight.ts';
import { KNOWN_FINISH_KINDS } from '@lolly-tools/core';
import { CMYK_CONDITIONS } from '../engine/src/color.ts';
import type {
  PreflightJob, PreflightReport, PreflightInput, PreflightSwatch, Finding,
} from '../engine/src/preflight.ts';

// ─── fixtures ───────────────────────────────────────────────────────────────

const px = (value: number) => ({ value, unit: 'px' as const });
const mm = (value: number) => ({ value, unit: 'mm' as const });

const baseJob = (): PreflightJob => ({
  source: 'test',
  manifest: { id: 'test-tool', render: { formats: ['png', 'pdf', 'pdf-cmyk', 'cmyk-tiff', 'eps-cmyk', 'mp4'] } },
  model: [],
  modelPhase: 'post-init',
  settings: {
    format: 'png',
    size: { width: px(1080), height: px(1080), dpi: 96, declaredBy: 'url', unitDeclared: true },
    bleed: { known: true, value: null },
    marks: { known: true, value: null },
    pressProfile: { known: true, value: null },
  },
  palette: { known: false, why: 'not-resolved' },
  stage: { known: false, why: 'needs-mount' },
});

/** Deep-ish merge for the two levels the fixtures actually vary. */
type JobOver = Omit<Partial<PreflightJob>, 'settings' | 'manifest'> & {
  settings?: Partial<PreflightJob['settings']>;
  manifest?: PreflightJob['manifest'];
};
const job = (over: JobOver): PreflightJob => {
  const b = baseJob();
  return {
    ...b, ...over,
    manifest: { ...b.manifest, ...(over.manifest ?? {}) },
    settings: { ...b.settings, ...(over.settings ?? {}) },
  } as PreflightJob;
};

const ids = (r: PreflightReport): string[] => r.findings.map(f => f.id);
const has = (r: PreflightReport, id: string): boolean => ids(r).includes(id);
const all = (r: PreflightReport, id: string): Finding[] => r.findings.filter(f => f.id === id);
const one = (r: PreflightReport, id: string): Finding => {
  const m = all(r, id);
  assert.equal(m.length, 1, `expected exactly one ${id}, got ${m.length}`);
  return m[0] as Finding;
};

const swatch = (name: string, spotName: string, finish?: string): PreflightSwatch =>
  ({ path: `brand.color.${name}`, name, spot: { name: spotName, ...(finish ? { finish } : {}) } });

const input = (o: Partial<PreflightInput> & { id: string; type: PreflightInput['type'] }): PreflightInput =>
  ({ value: null, ...o } as PreflightInput);

// ─── (A) the correctness fix: a declared finish is not an ink ───────────────

test('finish: pdf-cmyk emits a declared finish as its own OVERPRINTING named plate (info)', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
  }));
  const f = one(r, 'print.finish-separates-as-ink');
  assert.equal(f.severity, 'info', 'the finish now overprints, so this is a handoff heads-up not an error');
  assert.equal(f.evidence?.overprint, true);
  assert.equal(f.evidence?.finish, 'foil');
  assert.equal(f.evidence?.spotName, 'Gold');
  assert.equal(f.evidence?.format, 'pdf-cmyk');
  assert.ok(!f.message.includes('knocks out'), 'the finish no longer knocks out');
  assert.ok(!f.message.includes('\u2014'), 'no em-dashes in finding copy');
  assert.ok(!/[$£€¥]/.test(f.message), 'no currency anywhere in preflight');
  // The sibling finding is for the OTHER failure mode and must not double up.
  assert.equal(has(r, 'print.finish-flattened-into-process'), false);
});

test('finish: cmyk-tiff and eps-cmyk flatten it into the process build (error)', () => {
  for (const format of ['cmyk-tiff', 'eps-cmyk']) {
    const r = preflight(job({
      settings: { format },
      palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
    }));
    const f = one(r, 'print.finish-flattened-into-process');
    assert.equal(f.severity, 'error');
    assert.equal(has(r, 'print.finish-separates-as-ink'), false);
  }
});

test('finish: one finding per finish ink, not one per job', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil'), swatch('Die', 'Die', 'cut')] },
  }));
  assert.equal(all(r, 'print.finish-separates-as-ink').length, 2);
});

test('finish: an ordinary spot with no finish never triggers the finish findings', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [swatch('Brand Red', 'PANTONE 186 C')] },
  }));
  assert.equal(has(r, 'print.finish-separates-as-ink'), false);
  assert.equal(has(r, 'print.finish-flattened-into-process'), false);
  assert.equal(has(r, 'print.finish-unknown-kind'), false);
});

test('finish: a non-separating format raises neither finish error', () => {
  for (const format of ['png', 'pdf', 'svg']) {
    const r = preflight(job({
      settings: { format },
      palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
    }));
    assert.equal(has(r, 'print.finish-separates-as-ink'), false, format);
    assert.equal(has(r, 'print.finish-flattened-into-process'), false, format);
  }
});

test('finish: an unrecognised finish is reported, never dropped (the union is open)', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [swatch('Letterpress', 'Deep Impress', 'letterpress')] },
  }));
  const f = one(r, 'print.finish-unknown-kind');
  assert.equal(f.severity, 'info');
  assert.equal(f.evidence?.finish, 'letterpress');
  // The ink is still counted as a finish plate and still raises the ink error.
  assert.equal(has(r, 'print.finish-separates-as-ink'), true);
  assert.equal(has(r, 'plates.finish-ceiling'), true);
});

test('finish: every canonical spelling is recognised', () => {
  for (const finish of KNOWN_FINISHES) {
    const r = preflight(job({
      settings: { format: 'pdf-cmyk' },
      palette: { known: true, value: [swatch('X', 'X', finish)] },
    }));
    assert.equal(has(r, 'print.finish-unknown-kind'), false, finish);
  }
});

// ─── settings coherence ─────────────────────────────────────────────────────

test('format-not-offered fires only for a format the manifest does not list', () => {
  const bad = preflight(job({ manifest: { id: 't', render: { formats: ['png', 'svg'] } }, settings: { format: 'pdf' } }));
  const f = one(bad, 'settings.format-not-offered');
  assert.equal(f.severity, 'error');
  assert.match(f.message, /png, svg/);

  const good = preflight(job({ manifest: { id: 't', render: { formats: ['png', 'svg'] } }, settings: { format: 'svg' } }));
  assert.equal(has(good, 'settings.format-not-offered'), false);

  // No declared list = no claim. Silence, not an error.
  const none = preflight(job({ manifest: { id: 't', render: {} }, settings: { format: 'pdf' } }));
  assert.equal(has(none, 'settings.format-not-offered'), false);
});

test('print marks on a non-print format warn; on a print format they do not', () => {
  const marks = { known: true as const, value: { crop: true } };
  const off = preflight(job({ settings: { format: 'png', marks } }));
  assert.equal(one(off, 'settings.print-marks-on-non-print-format').severity, 'warn');

  for (const format of PRINT_MARK_FORMATS) {
    const on = preflight(job({ settings: { format, marks } }));
    assert.equal(has(on, 'settings.print-marks-on-non-print-format'), false, format);
  }
  // All-false flags are not "set".
  const inert = preflight(job({ settings: { format: 'png', marks: { known: true, value: { crop: false } } } }));
  assert.equal(has(inert, 'settings.print-marks-on-non-print-format'), false);
});

test('a bleed with a real value also counts as marks being set', () => {
  const r = preflight(job({ settings: { format: 'png', bleed: { known: true, value: mm(3) } } }));
  const f = one(r, 'settings.print-marks-on-non-print-format');
  assert.equal(f.evidence?.bleedSet, true);
});

test('press profile warns only off a separating format, and never for none', () => {
  const r = preflight(job({ settings: { format: 'png', pressProfile: { known: true, value: 'fogra39' } } }));
  assert.equal(one(r, 'settings.press-profile-on-non-separating-format').severity, 'warn');

  for (const format of SEPARATING_FORMATS) {
    const ok = preflight(job({ settings: { format, pressProfile: { known: true, value: 'fogra39' } } }));
    assert.equal(has(ok, 'settings.press-profile-on-non-separating-format'), false, format);
  }
  for (const value of [null, '', 'none']) {
    const quiet = preflight(job({ settings: { format: 'png', pressProfile: { known: true, value } } }));
    assert.equal(has(quiet, 'settings.press-profile-on-non-separating-format'), false, String(value));
  }
  const unknown = preflight(job({ settings: { format: 'png', pressProfile: { known: false, why: 'not-carried' } } }));
  assert.equal(has(unknown, 'settings.press-profile-on-non-separating-format'), false);
});

test('hdr and durable warn only on formats that cannot carry them', () => {
  assert.equal(has(preflight(job({ settings: { format: 'svg', hdr: true } })), 'settings.hdr-on-unsupported-format'), true);
  assert.equal(has(preflight(job({ settings: { format: 'png', hdr: true } })), 'settings.hdr-on-unsupported-format'), false);
  assert.equal(has(preflight(job({ settings: { format: 'png' } })), 'settings.hdr-on-unsupported-format'), false);

  assert.equal(has(preflight(job({ settings: { format: 'pdf', durable: true } })), 'settings.durable-on-unsupported-format'), true);
  assert.equal(has(preflight(job({ settings: { format: 'webp', durable: true } })), 'settings.durable-on-unsupported-format'), false);
});

test("aspect guard uses the tool's own message, and stays quiet inside the range", () => {
  const aspectWarning = { min: 0.8, max: 1.25, message: 'This tool wants a squarish canvas.' };
  const wide = preflight(job({
    manifest: { id: 't', render: { aspectWarning } },
    settings: { format: 'png', size: { width: px(2000), height: px(500), dpi: 96, declaredBy: 'url', unitDeclared: true } },
  }));
  const f = one(wide, 'settings.aspect-guard');
  assert.equal(f.message, aspectWarning.message);
  assert.equal(f.severity, 'warn');

  const square = preflight(job({ manifest: { id: 't', render: { aspectWarning } } }));
  assert.equal(has(square, 'settings.aspect-guard'), false);
});

// ─── declared input coherence ───────────────────────────────────────────────

test('required-blank fires for each empty required input only', () => {
  const r = preflight(job({
    model: [
      input({ id: 'title', type: 'text', label: 'Title', required: true, value: '' }),
      input({ id: 'sub', type: 'text', label: 'Subtitle', required: true, value: 'set' }),
      input({ id: 'opt', type: 'text', label: 'Optional', value: '' }),
      input({ id: 'list', type: 'blocks', label: 'Rows', required: true, value: [] }),
    ],
  }));
  const fired = all(r, 'input.required-blank').map(f => f.inputId);
  assert.deepEqual(fired.sort(), ['list', 'title']);
  assert.equal(all(r, 'input.required-blank')[0]?.severity, 'warn');
});

test('number-out-of-range reports the clamp the interface would apply', () => {
  const r = preflight(job({
    model: [
      input({ id: 'size', type: 'number', label: 'Size', min: 10, max: 100, value: 400 }),
      input({ id: 'ok', type: 'number', label: 'Fine', min: 0, max: 10, value: 5 }),
      input({ id: 'free', type: 'number', label: 'Free', value: 99999 }),
    ],
  }));
  const f = one(r, 'input.number-out-of-range');
  assert.equal(f.inputId, 'size');
  assert.equal(f.evidence?.clamped, 100);
  assert.match(f.message, /cannot be reproduced from the interface/);
});

test('number-out-of-range handles a one-sided range', () => {
  const r = preflight(job({ model: [input({ id: 'n', type: 'number', min: 1, value: 0 })] }));
  assert.equal(one(r, 'input.number-out-of-range').evidence?.clamped, 1);
});

test('text-over-maxlength counts characters against the declared limit', () => {
  const r = preflight(job({
    model: [
      input({ id: 'a', type: 'text', label: 'A', maxLength: 5, value: 'abcdefgh' }),
      input({ id: 'b', type: 'longtext', label: 'B', maxLength: 100, value: 'short' }),
    ],
  }));
  const f = one(r, 'input.text-over-maxlength');
  assert.equal(f.inputId, 'a');
  assert.equal(f.evidence?.length, 8);
});

test('select-value-unknown fires for an off-list value, not a blank, not a brandFonts select', () => {
  const options = [{ value: 'a' }, { value: 'b' }];
  const r = preflight(job({
    model: [
      input({ id: 's1', type: 'select', label: 'S1', options, value: 'z' }),
      input({ id: 's2', type: 'select', label: 'S2', options, value: 'a' }),
      input({ id: 's3', type: 'select', label: 'S3', options, value: '' }),
      input({ id: 's4', type: 'select', label: 'S4', options, brandFonts: true, value: 'Comic Sans' }),
    ],
  }));
  const fired = all(r, 'input.select-value-unknown').map(f => f.inputId);
  assert.deepEqual(fired, ['s1']);
});

test('vector-clamped needs rawInitial, and is simply not emitted without it', () => {
  const model = [input({
    id: 'pos', type: 'vector', label: 'Position',
    fields: [{ id: 'x', min: 0, max: 100 }, { id: 'y', min: 0, max: 100 }],
    value: { x: 100, y: 50 },
  })];
  const withRaw = preflight(job({ model, rawInitial: { pos: { x: 400, y: 50 } } }));
  const f = one(withRaw, 'input.vector-clamped');
  assert.equal(f.evidence?.raw, 400);
  assert.equal(f.evidence?.clamped, 100);
  assert.equal(f.evidence?.field, 'x');

  const withoutRaw = preflight(job({ model }));
  assert.equal(has(withoutRaw, 'input.vector-clamped'), false);

  const inRange = preflight(job({ model, rawInitial: { pos: { x: 40, y: 50 } } }));
  assert.equal(has(inRange, 'input.vector-clamped'), false);
});

// ─── print geometry ─────────────────────────────────────────────────────────

test('no-bleed warns on a print format when bleed is explicitly zero or none', () => {
  for (const value of [null, px(0)]) {
    const r = preflight(job({ settings: { format: 'pdf-cmyk', bleed: { known: true, value } } }));
    assert.equal(one(r, 'print.no-bleed').severity, 'warn');
  }
  const set = preflight(job({ settings: { format: 'pdf-cmyk', bleed: { known: true, value: mm(3) } } }));
  assert.equal(has(set, 'print.no-bleed'), false);
  const raster = preflight(job({ settings: { format: 'png', bleed: { known: true, value: null } } }));
  assert.equal(has(raster, 'print.no-bleed'), false);
});

test('no-bleed needs PRINT INTENT, not just a format that accepts bleed', () => {
  // The routine case: a plain PDF at a pixel size is a screen document, and it is
  // the DEFAULT export of six shipping tools. Warning on it would make the card
  // read "1 to fix" out of the box and `--strict` exit 1 as the normal state.
  const plain = preflight(job({ settings: { format: 'pdf', bleed: { known: true, value: null } } }));
  assert.equal(has(plain, 'print.no-bleed'), false);

  // Any one of the three intent signals brings it back.
  const separating = preflight(job({ settings: { format: 'pdf-cmyk', bleed: { known: true, value: null } } }));
  assert.equal(has(separating, 'print.no-bleed'), true, 'a separating format is print intent');

  const marked = preflight(job({
    settings: { format: 'pdf', bleed: { known: true, value: null }, marks: { known: true, value: { crop: true } } },
  }));
  assert.equal(has(marked, 'print.no-bleed'), true, 'marks on is print intent');

  const physical = preflight(job({
    settings: {
      format: 'pdf', bleed: { known: true, value: null },
      size: { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'url', unitDeclared: true },
    },
  }));
  assert.equal(has(physical, 'print.no-bleed'), true, 'a declared physical trim is print intent');
});

test('an uncarried bleed is a named gap carrying its own reason, never a zero', () => {
  const r = preflight(job({ settings: { format: 'pdf', bleed: { known: false, why: 'not-carried' } } }));
  const f = one(r, 'print.bleed-unknown');
  assert.equal(f.severity, 'info');
  assert.equal(f.needs, 'not-carried');
  assert.equal(f.count, undefined);
  assert.match(f.message, /Zero has not been assumed/);
  // and the zero-bleed warning must NOT also fire off the same absent setting
  assert.equal(has(r, 'print.no-bleed'), false);
});

test('a pixel page on a print format reports pixels and refuses an area', () => {
  const r = preflight(job({ settings: { format: 'pdf' } }));
  const f = one(r, 'print.trim-not-physical');
  assert.equal(f.needs, 'not-set');
  assert.equal(f.count, undefined, 'a gap never carries a count');
  assert.equal(has(r, 'print.geometry'), false);
  assert.equal(r.counts.some(c => c.kind === 'area'), false);
});

test('print.geometry emits trim, bleed and media areas, each naming its box', () => {
  const r = preflight(job({
    settings: {
      format: 'pdf',
      size: { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'size-select', unitDeclared: true },
      bleed: { known: true, value: mm(3) },
      marks: { known: true, value: { crop: true } },
    },
  }));
  const boxes = all(r, 'print.geometry').map(f => f.count?.box);
  assert.deepEqual(boxes, ['trim', 'bleed', 'media']);
  for (const f of all(r, 'print.geometry')) {
    assert.equal(f.count?.kind, 'area');
    assert.equal(f.count?.unit, 'm2-sheet', 'area through the press is never a bare m2');
    assert.equal(f.count?.bound, 'exact');
  }
  const areas = all(r, 'print.geometry').map(f => f.count?.value as number);
  assert.ok(areas[0] && areas[1] && areas[2]);
  assert.ok(areas[0] < areas[1] && areas[1] < areas[2], 'trim < bleed < media');
  // A4 trim is 0.210 x 0.297 = 0.06237 m2.
  assert.ok(Math.abs(areas[0] - 0.06237) < 0.0005, `trim area ${areas[0]}`);
});

test('a fabricated unit is refused: unitDeclared false suppresses the area', () => {
  const r = preflight(job({
    settings: {
      format: 'pdf',
      // The battlecards trap: a size-select option carrying 1200x900 and NO unit,
      // which the web driver would default to mm (1.2 x 0.9 metres).
      size: { width: mm(1200), height: mm(900), dpi: 300, declaredBy: 'size-select', unitDeclared: false },
      bleed: { known: true, value: mm(3) },
      marks: { known: true, value: { crop: true } },
    },
  }));
  assert.equal(has(r, 'print.geometry'), false);
  assert.equal(has(r, 'print.trim-not-physical'), true);
});

test('print.geometry is withheld while bleed or marks are unknown', () => {
  const size = { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'url' as const, unitDeclared: true };
  const noBleed = preflight(job({ settings: { format: 'pdf', size, bleed: { known: false, why: 'not-carried' } } }));
  assert.equal(has(noBleed, 'print.geometry'), false);
  const noMarks = preflight(job({ settings: { format: 'pdf', size, marks: { known: false, why: 'not-carried' } } }));
  assert.equal(has(noMarks, 'print.geometry'), false);
});

// ─── counts ─────────────────────────────────────────────────────────────────

test('paginate page count is exact post-init and a ceiling from the declared model', () => {
  const model = [input({
    id: 'rows', type: 'table', label: 'Cards',
    value: { columns: ['a'], rows: [['1'], ['2'], ['3']] },
  })];
  const manifest = { id: 't', render: { paginate: { source: 'rows' } } };

  const post = preflight(job({ manifest, model, modelPhase: 'post-init' }));
  const f = one(post, 'count.pages.paginate');
  assert.equal(f.count?.value, 3);
  assert.equal(f.count?.bound, 'exact');
  assert.equal(f.count?.basis, 'manifest.render.paginate');

  const declared = preflight(job({ manifest, model, modelPhase: 'declared' }));
  assert.equal(one(declared, 'count.pages.paginate').count?.bound, 'ceiling');
});

test('paginate is silent when the named input is missing or not a table', () => {
  const manifest = { id: 't', render: { paginate: { source: 'rows' } } };
  assert.equal(has(preflight(job({ manifest, model: [] })), 'count.pages.paginate'), false);
  assert.equal(has(preflight(job({ manifest, model: [input({ id: 'rows', type: 'text', value: 'x' })] })), 'count.pages.paginate'), false);
});

test('render.pages applies the declared clamp, not the typed value', () => {
  const manifest = { id: 't', render: { pages: { count: 'n', width: 'w', height: 'h', min: 1, max: 6 } } };
  const over = preflight(job({ manifest, model: [input({ id: 'n', type: 'number', value: 99 })] }));
  assert.equal(one(over, 'count.pages.pages').count?.value, 6);
  const under = preflight(job({ manifest, model: [input({ id: 'n', type: 'number', value: 0 })] }));
  assert.equal(one(under, 'count.pages.pages').count?.value, 1);
  const fine = preflight(job({ manifest, model: [input({ id: 'n', type: 'number', value: 3 })] }));
  assert.equal(one(fine, 'count.pages.pages').count?.value, 3);
});

test('pages-unknown is a mount gap, gated to formats that have pages at all', () => {
  const pdf = preflight(job({ settings: { format: 'pdf' } }));
  const f = one(pdf, 'count.pages.unknown');
  assert.equal(f.needs, 'needs-mount');
  assert.equal(f.severity, 'info');

  assert.equal(has(preflight(job({ settings: { format: 'png' } })), 'count.pages.unknown'), false);
  // A MOUNTED stage that carries no page boxes has answered nothing about pages,
  // so the gap still stands - it just stops blaming the mount.
  const mounted = preflight(job({ settings: { format: 'pdf' }, stage: { known: true, value: { isSequence: false } } }));
  assert.equal(one(mounted, 'count.pages.unknown').needs, 'not-set');
  const declaresPages = preflight(job({
    manifest: { id: 't', render: { pages: { count: 'n' } } },
    settings: { format: 'pdf' },
  }));
  assert.equal(has(declaresPages, 'count.pages.unknown'), false);
});

test('raster pixel count scales a physical size by DPI', () => {
  const r = preflight(job({
    settings: { format: 'png', size: { width: mm(25.4), height: mm(25.4), dpi: 300, declaredBy: 'url', unitDeclared: true } },
  }));
  const f = one(r, 'count.raster-pixels');
  assert.equal(f.count?.value, 300 * 300);
  assert.equal(f.count?.unit, 'px');
  assert.equal(f.count?.bound, 'exact');
});

test('a declared clip duration is a ceiling, and only on a motion format', () => {
  const manifest = { id: 't', render: { video: { duration: 8 } } };
  const mp4 = preflight(job({ manifest, settings: { format: 'mp4' } }));
  const f = one(mp4, 'count.video-duration-declared');
  assert.equal(f.count?.bound, 'ceiling');
  assert.match(f.message, /measured after it runs/);
  assert.equal(has(preflight(job({ manifest, settings: { format: 'png' } })), 'count.video-duration-declared'), false);
});

// ─── plates ─────────────────────────────────────────────────────────────────

test('four process plates are a ceiling on every separating format, and absent elsewhere', () => {
  for (const format of SEPARATING_FORMATS) {
    const f = one(preflight(job({ settings: { format } })), 'plates.process');
    assert.equal(f.count?.value, 4);
    assert.equal(f.count?.bound, 'ceiling');
  }
  assert.equal(has(preflight(job({ settings: { format: 'png' } })), 'plates.process'), false);
});

test('spot and finish ceilings count distinct ink names, separately', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: {
      known: true,
      value: [
        swatch('Red', 'PANTONE 186 C'),
        swatch('Red tint', 'PANTONE 186 C'),   // same ink, one plate
        swatch('Blue', 'PANTONE 300 C'),
        swatch('Gold', 'Gold', 'foil'),
        swatch('Varnish', 'Gloss', 'spot-uv'),
      ],
    },
  }));
  assert.equal(one(r, 'plates.spot-ceiling').count?.value, 2);
  assert.equal(one(r, 'plates.spot-ceiling').count?.bound, 'ceiling');
  assert.equal(one(r, 'plates.finish-ceiling').count?.value, 2);
  assert.equal(one(r, 'plates.finish-ceiling').count?.basis, 'palette.spot.finish');
  assert.equal(has(r, 'plates.no-spots-declared'), false);
});

test('a brand with no spots says so, and does not report the number zero', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [{ path: 'brand.color.red', name: 'Red', spot: null }] },
  }));
  const f = one(r, 'plates.no-spots-declared');
  assert.equal(f.needs, 'not-set');
  assert.equal(f.count, undefined);
  assert.equal(has(r, 'plates.spot-ceiling'), false);
  assert.equal(r.counts.some(c => c.kind === 'spotPlates'), false);
});

test('an unresolved palette withholds the ceiling rather than defaulting it', () => {
  const r = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: { known: false, why: 'not-resolved' } }));
  const f = one(r, 'plates.palette-unresolved');
  assert.equal(f.needs, 'not-resolved');
  assert.equal(has(r, 'plates.spot-ceiling'), false);
  assert.equal(has(r, 'plates.no-spots-declared'), false);
});

test('plate findings stay off non-separating formats', () => {
  const r = preflight(job({ settings: { format: 'png' }, palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] } }));
  for (const id of ['plates.process', 'plates.spot-ceiling', 'plates.finish-ceiling', 'plates.no-spots-declared', 'plates.palette-unresolved']) {
    assert.equal(has(r, id), false, id);
  }
});

// ─── cuts: three-way, only one term of it static ────────────────────────────

test('cuts headless is a mount gap counted as one file, not a multiplier', () => {
  const r = preflight(job({ settings: { format: 'png', cuts: 12 } }));
  const f = one(r, 'count.cuts-needs-stage');
  assert.equal(f.needs, 'needs-mount');
  assert.equal(f.count, undefined);
  assert.equal(r.counts.some(c => c.kind === 'outputFiles'), false);
  assert.equal(has(r, 'count.cuts-applies'), false);
});

test('cuts on a mounted still stage is inert and counts one output file', () => {
  const r = preflight(job({
    settings: { format: 'png', cuts: 12 },
    stage: { known: true, value: { isSequence: false } },
  }));
  const f = one(r, 'count.cuts-inert');
  assert.equal(f.count?.value, 1);
  assert.match(f.message, /not a timed composition/);
});

test('cuts on a timed stage with a non-contact-sheet format is inert for the format reason', () => {
  const r = preflight(job({
    settings: { format: 'mp4', cuts: 12 },
    stage: { known: true, value: { isSequence: true } },
  }));
  assert.match(one(r, 'count.cuts-inert').message, /no contact sheet/);
});

test('cuts on a timed stage with a still format is one ZIP, not N downloads', () => {
  const r = preflight(job({
    settings: { format: 'png', cuts: 12 },
    stage: { known: true, value: { isSequence: true } },
  }));
  const f = one(r, 'count.cuts-applies');
  assert.equal(f.count?.kind, 'outputFiles');
  assert.equal(f.count?.value, 1, 'the user receives one ZIP, not twelve files');
  assert.equal(f.count?.bound, 'exact');
  assert.match(f.message, /12 frames/);
  assert.match(f.message, /one ZIP/);
  assert.equal(has(r, 'count.cuts-inert'), false);
});

test('cuts on a PDF contact sheet counts PAGES, and still one file', () => {
  const r = preflight(job({
    settings: { format: 'pdf', cuts: 8 },
    stage: { known: true, value: { isSequence: true } },
  }));
  const both = all(r, 'count.cuts-applies');
  assert.equal(both.length, 2);
  const files = both.find(f => f.count?.kind === 'outputFiles');
  const pages = both.find(f => f.count?.kind === 'pages');
  assert.equal(files?.count?.value, 1);
  assert.equal(pages?.count?.value, 8);
  assert.equal(pages?.count?.unit, 'page');
});

test('cuts=1 says nothing at all', () => {
  const r = preflight(job({ settings: { format: 'png', cuts: 1 }, stage: { known: true, value: { isSequence: true } } }));
  for (const id of ['count.cuts-needs-stage', 'count.cuts-inert', 'count.cuts-applies']) {
    assert.equal(has(r, id), false, id);
  }
});

// ─── export behaviour ───────────────────────────────────────────────────────

test('an experimental tool declares its forced watermark', () => {
  const r = preflight(job({ manifest: { id: 't', status: 'experimental' } }));
  assert.equal(one(r, 'export.experimental-watermark').severity, 'info');
  assert.equal(has(preflight(job({ manifest: { id: 't', status: 'official' } })), 'export.experimental-watermark'), false);
});

// ─── refusals: present in the report, not missing from it ───────────────────

test('a separating format refuses ink coverage and the exact plate set', () => {
  const r = preflight(job({ settings: { format: 'pdf-cmyk' } }));
  assert.equal(one(r, 'refuse.ink-coverage').needs, 'needs-render');
  assert.equal(one(r, 'refuse.exact-separation').needs, 'needs-render');
  const png = preflight(job({ settings: { format: 'png' } }));
  assert.equal(has(png, 'refuse.ink-coverage'), false);
  assert.equal(has(png, 'refuse.exact-separation'), false);
});

test('covered finish area is refused only once a finish is actually declared', () => {
  const withFinish = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
  }));
  assert.equal(one(withFinish, 'refuse.finish-covered-area').needs, 'not-computable');
  const without = preflight(job({ settings: { format: 'pdf-cmyk' } }));
  assert.equal(has(without, 'refuse.finish-covered-area'), false);
});

test('output file size is always refused; render time and frames only for motion', () => {
  assert.equal(has(preflight(job({})), 'refuse.output-file-size'), true);
  const mp4 = preflight(job({ settings: { format: 'mp4' } }));
  assert.equal(one(mp4, 'refuse.render-time').needs, 'not-computable');
  assert.equal(one(mp4, 'refuse.video-frames').needs, 'needs-render');
  assert.equal(one(mp4, 'refuse.sequence-duration').needs, 'needs-mount');
  const png = preflight(job({ settings: { format: 'png' } }));
  assert.equal(has(png, 'refuse.render-time'), false);
  assert.equal(has(png, 'refuse.video-frames'), false);
  assert.equal(has(png, 'refuse.sequence-duration'), false);
});

test('a manifest-only size on a print format refuses to invent a trim', () => {
  const r = preflight(job({
    settings: {
      format: 'pdf',
      size: { width: px(1200), height: px(900), dpi: 300, declaredBy: 'manifest', unitDeclared: false },
    },
  }));
  const f = one(r, 'refuse.trim-when-unset');
  assert.equal(f.needs, 'not-set');
  assert.match(f.message, /not converting/);
  const declared = preflight(job({ settings: { format: 'pdf' } }));
  assert.equal(has(declared, 'refuse.trim-when-unset'), false);
});

test('press sheets are never counted, in any job', () => {
  const jobs = [
    job({}),
    job({ settings: { format: 'pdf-cmyk' } }),
    job({ settings: { format: 'pdf', size: { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'url', unitDeclared: true }, bleed: { known: true, value: mm(3) }, marks: { known: true, value: { crop: true } } } }),
  ];
  for (const j of jobs) {
    const r = preflight(j);
    assert.equal(r.counts.some(c => c.kind === 'sheets'), false);
  }
});

// ─── report-level invariants ────────────────────────────────────────────────

test('a gap is always info-severity and never carries a count', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk', cuts: 4, bleed: { known: false, why: 'not-carried' } },
    palette: { known: false, why: 'not-resolved' },
  }));
  assert.ok(r.gaps.length > 0, 'expected gaps in this job');
  for (const g of r.gaps) {
    assert.equal(g.severity, 'info', g.id);
    assert.equal(g.count, undefined, g.id);
    assert.ok(g.needs, g.id);
  }
  // and `gaps` is exactly the needs-bearing subset of `findings`
  assert.deepEqual(r.gaps.map(g => g.id), r.findings.filter(f => f.needs).map(f => f.id));
});

test('findings are severity-ordered: every error, then every warning, then info', () => {
  const r = preflight(job({
    manifest: { id: 't', render: { formats: ['png'] } },
    settings: { format: 'pdf-cmyk', hdr: true },
    model: [input({ id: 'n', type: 'number', label: 'N', min: 0, max: 1, value: 9 })],
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
  }));
  const rank = { error: 0, warn: 1, info: 2 } as const;
  const seq = r.findings.map(f => rank[f.severity]);
  assert.deepEqual([...seq].sort((a, b) => a - b), seq, 'not severity-ordered');
  assert.ok(seq.includes(0) && seq.includes(1) && seq.includes(2), 'wanted all three levels present');
});

test('the report carries its format discriminator, the engine version, and the job', () => {
  const r = preflight(job({ settings: { format: 'PDF-CMYK' }, rowIndex: 4 }));
  assert.equal(r.$format, 'lolly-preflight');
  assert.equal(r.formatVersion, 1);
  assert.match(r.engine, /^\d+\.\d+\.\d+$/);
  assert.equal(r.job.toolId, 'test-tool');
  assert.equal(r.job.format, 'pdf-cmyk', 'the format is normalised once, at the top');
  assert.equal(r.job.rowIndex, 4);
  assert.ok(r.findings.every(f => f.rowIndex === 4), 'every finding carries the row it belongs to');
});

test('counts are deduplicated by kind, box and basis', () => {
  const r = preflight(job({
    settings: {
      format: 'pdf',
      size: { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'url', unitDeclared: true },
      bleed: { known: true, value: mm(3) },
      marks: { known: true, value: { crop: true } },
    },
  }));
  const keys = r.counts.map(c => `${c.kind}|${c.box ?? ''}|${c.basis}`);
  assert.equal(new Set(keys).size, keys.length, 'duplicate count keys in the summary');
  // and every count in the summary is one a finding actually carries
  for (const c of r.counts) assert.ok(r.findings.some(f => f.count === c));
});

test('no finding, anywhere, contains a currency symbol or the word cost', () => {
  const jobs = [
    job({}),
    job({ settings: { format: 'pdf-cmyk', cuts: 6, hdr: true, durable: true }, palette: { known: true, value: [swatch('Gold', 'Gold', 'foil'), swatch('Red', 'PANTONE 186 C')] } }),
    job({ settings: { format: 'mp4' }, manifest: { id: 't', render: { video: { duration: 6 } } } }),
  ];
  for (const j of jobs) {
    for (const f of preflight(j).findings) {
      assert.ok(!/[$£€¥]/.test(f.message), `currency in ${f.id}`);
      // "frame rate" is a real quantity, so `rate` alone is not the tell; the
      // money vocabulary is.
      assert.ok(!/\b(cost|price|pricing|quote|budget|invoice|currency|rate card)\b/i.test(f.message),
        `money vocabulary in ${f.id}: ${f.message}`);
      assert.ok(!f.message.includes('\u2014'), `em-dash in ${f.id}`);
    }
  }
});

// ─── totality: hostile input degrades, it never throws ──────────────────────

test('preflight is total: garbage jobs produce a report rather than an exception', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const hostile: unknown[] = [
    undefined, null, 0, 'nope', [], {},
    { manifest: null, settings: null, palette: null, stage: null },
    { manifest: { render: { formats: 'png' } }, settings: { format: 42 }, palette: { known: true, value: 'not an array' }, stage: { known: true, value: null } },
    { manifest: { id: 7, status: 3 }, settings: { format: 'pdf-cmyk', size: 'A4', bleed: { known: true, value: 'thick' }, marks: { known: true, value: 5 }, cuts: NaN }, palette: { known: true, value: [null, 3, { spot: {} }, { spot: { name: '' } }] }, stage: { known: false } },
    { manifest: { render: { paginate: { source: 'x' }, pages: { count: 'y', min: 'a', max: 'b' } } }, model: 'not an array', settings: { format: 'pdf' }, palette: { known: 'maybe' }, stage: {} },
    { manifest: {}, model: [null, 3, { id: 'a' }, { id: 'b', type: 'number', min: 'x', value: 'y' }], settings: { format: 'png', size: { width: { value: NaN, unit: 'mm' }, height: null, dpi: 'lots' } }, rawInitial: 'no', palette: { known: false, why: 'nope' }, stage: { known: false, why: 'nope' } },
  ];
  for (const h of hostile) {
    const r = preflight(h as any);
    assert.equal(r.$format, 'lolly-preflight');
    assert.equal(r.formatVersion, 1);
    assert.ok(Array.isArray(r.findings));
    assert.ok(Array.isArray(r.counts));
    assert.ok(Array.isArray(r.gaps));
    assert.equal(typeof r.job.toolId, 'string');
    assert.equal(typeof r.job.format, 'string');
    // the invariants hold even on rubbish
    for (const g of r.gaps) { assert.equal(g.severity, 'info'); assert.equal(g.count, undefined); }
    for (const c of r.counts) assert.equal(typeof c.value, 'number');
  }
});

test('a self-referential value does not hang or throw a check', () => {
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  const r = preflight(job({
    model: [input({ id: 'weird', type: 'vector', fields: [{ id: 'x', min: 0, max: 1 }], value: loop as never })],
    rawInitial: { weird: loop },
  }));
  assert.equal(r.$format, 'lolly-preflight');
});

test('one broken check does not take the report down with it', () => {
  // A palette that throws on iteration: the finish checks read it, everything
  // else must still be reported.
  const exploding = {
    known: true,
    get value(): PreflightSwatch[] { throw new Error('boom'); },
  };
  const r = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: exploding as never }));
  assert.equal(has(r, 'plates.process'), true, 'unrelated checks survive');
  assert.equal(has(r, 'print.finish-separates-as-ink'), false);
});

test('the report is JSON round-trippable', () => {
  const r = preflight(job({
    settings: { format: 'pdf-cmyk', cuts: 3 },
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
  }));
  const back = JSON.parse(JSON.stringify(r)) as PreflightReport;
  assert.deepEqual(back.findings.map(f => f.id), ids(r));
  assert.equal(back.gaps.length, r.gaps.length);
});

// ─── the format tables the shells must share ────────────────────────────────

test('the spot-plate format set is a subset of the separating set', () => {
  for (const f of SPOT_PLATE_FORMATS) assert.ok(SEPARATING_FORMATS.has(f), f);
});

test('the recognised finish set is the contract list, not a hand copy', () => {
  assert.deepEqual([...KNOWN_FINISHES].sort(), [...KNOWN_FINISH_KINDS].sort(),
    'KNOWN_FINISHES must be built from KNOWN_FINISH_KINDS so the two cannot drift');
});

test('a deep-pixel format is never refused as "not offered"', () => {
  // run.ts admits exr/hdr for ANY tool (plans/61-deeprichpixels.md section 10 rules out
  // per-tool depth declarations), so preflight refusing them would block a
  // legitimate render behind a CI gate built on `lolly preflight`.
  for (const fmt of DEPTH_FORMATS) {
    const r = preflight(job({
      manifest: { id: 't', render: { formats: ['png', 'svg'] } },
      settings: { format: fmt },
    }));
    assert.equal(has(r, 'settings.format-not-offered'), false, fmt);
  }
  // and the gate still holds for an ordinary unoffered format
  const nope = preflight(job({ manifest: { id: 't', render: { formats: ['png'] } }, settings: { format: 'dxf' } }));
  assert.equal(one(nope, 'settings.format-not-offered').severity, 'error');
});

// ─── counts that must not be asserted about the wrong output ────────────────

test('a pixel count is only claimed for a format that has pixels', () => {
  for (const fmt of ['png', 'tiff', 'exr']) {
    assert.equal(has(preflight(job({ settings: { format: fmt } })), 'count.raster-pixels'), true, fmt);
  }
  for (const fmt of ['svg', 'pdf', 'pdf-cmyk', 'eps-cmyk', 'csv', 'md', 'ics', 'html', 'webm', 'mp4']) {
    assert.equal(has(preflight(job({ settings: { format: fmt } })), 'count.raster-pixels'), false, fmt);
  }
  for (const fmt of RASTER_FORMATS) assert.ok(typeof fmt === 'string' && fmt.length > 0);
});

test('a px size does not claim a DPI it was not computed at', () => {
  const inPx = one(preflight(job({ settings: { format: 'png' } })), 'count.raster-pixels');
  assert.ok(!/DPI/.test(inPx.message), inPx.message);
  assert.equal(inPx.evidence?.dpi, null);
  const physical = one(preflight(job({
    settings: { format: 'png', size: { width: mm(25.4), height: mm(25.4), dpi: 300, declaredBy: 'url', unitDeclared: true } },
  })), 'count.raster-pixels');
  assert.match(physical.message, /at 300 DPI/);
});

// ─── a half-declared physical size is a gap, never a zero area ──────────────

test('one declared dimension produces a named gap and no area at all', () => {
  const r = preflight(job({
    settings: {
      format: 'pdf',
      size: { width: mm(210), height: mm(0), dpi: 300, declaredBy: 'url', unitDeclared: true },
      bleed: { known: true, value: mm(3) },
      marks: { known: true, value: { crop: true } },
    },
  }));
  const f = one(r, 'print.trim-partially-declared');
  assert.equal(f.needs, 'not-set');
  assert.equal(f.count, undefined);
  assert.match(f.message, /Only the width was set/);
  assert.equal(has(r, 'print.geometry'), false, 'no geometry off a zero dimension');
  assert.equal(r.counts.some(c => c.kind === 'area'), false, 'a 0 m2 area is an invented number');
  assert.equal(has(r, 'print.trim-not-physical'), false, 'the partial gap owns this case');
});

// ─── facts the stage already knows ──────────────────────────────────────────

test('a mounted stage with page boxes reports the count it measured', () => {
  const r = preflight(job({
    settings: { format: 'pdf' },
    stage: { known: true, value: { isSequence: false, pageBoxes: 7 } },
  }));
  const f = one(r, 'count.pages.stage');
  assert.equal(f.count?.value, 7);
  assert.equal(f.count?.bound, 'exact');
  assert.equal(f.count?.basis, 'stage.pageBoxes');
  assert.equal(has(r, 'count.pages.unknown'), false, 'answered, so no gap');
  // a declared page count is better evidence and wins
  const declared = preflight(job({
    manifest: { id: 't', render: { paginate: { source: 'rows' } } },
    settings: { format: 'pdf' },
    stage: { known: true, value: { isSequence: false, pageBoxes: 7 } },
  }));
  assert.equal(has(declared, 'count.pages.stage'), false);
});

test('a still export of a multi-board stage says it fans out, one file per artboard', () => {
  // plans/141 follow-up: the panel's single width×height must never imply one file
  // when a Design doc's artboards each export separately.
  const r = preflight(job({
    settings: { format: 'png' },
    stage: { known: true, value: { isSequence: false, pageBoxes: 3 } },
  }));
  const f = one(r, 'count.artboard-fanout');
  assert.match(f.message, /3 artboards export as 3 separate PNG files/);
  assert.match(f.message, /the size shown is the active artboard's/);
  // One board is one file - nothing to explain.
  const single = preflight(job({
    settings: { format: 'png' },
    stage: { known: true, value: { isSequence: false, pageBoxes: 1 } },
  }));
  assert.equal(has(single, 'count.artboard-fanout'), false);
  // Paged formats carry the page count instead; the fan-out line is stills-only.
  const pdf = preflight(job({
    settings: { format: 'pdf' },
    stage: { known: true, value: { isSequence: false, pageBoxes: 3 } },
  }));
  assert.equal(has(pdf, 'count.artboard-fanout'), false);
});

test('a mounted timeline reports its length instead of being collected and dropped', () => {
  const r = preflight(job({
    settings: { format: 'webm' },
    stage: { known: true, value: { isSequence: true, durationMs: 4500 } },
  }));
  const f = one(r, 'count.sequence-duration');
  assert.equal(f.count?.value, 4.5);
  assert.equal(f.count?.unit, 's');
  assert.equal(f.count?.basis, 'stage.durationMs');
  const none = preflight(job({ settings: { format: 'webm' }, stage: { known: true, value: { isSequence: true, durationMs: null } } }));
  assert.equal(has(none, 'count.sequence-duration'), false);
  // Gated exactly as its sibling refusal is: a still export nobody asked to cut
  // is not a job the timeline length is about.
  const still = preflight(job({ settings: { format: 'png' }, stage: { known: true, value: { isSequence: true, durationMs: 4500 } } }));
  assert.equal(has(still, 'count.sequence-duration'), false);
  const cut = preflight(job({ settings: { format: 'png', cuts: 6 }, stage: { known: true, value: { isSequence: true, durationMs: 4500 } } }));
  assert.equal(has(cut, 'count.sequence-duration'), true);
});

// ─── the finish findings describe the SHIPPED exporter ──────────────────────

test('finish findings split: pdf-cmyk overprints (info), cmyk-tiff still flattens (error)', () => {
  const pdf = preflight(job({
    settings: { format: 'pdf-cmyk' },
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
  }));
  const tiff = preflight(job({
    settings: { format: 'cmyk-tiff' },
    palette: { known: true, value: [swatch('Gold', 'Gold', 'foil')] },
  }));
  // pdf-cmyk: the finish is its own OVERPRINTING plate now - no longer a knockout defect.
  const fp = one(pdf, 'print.finish-separates-as-ink');
  assert.equal(fp.evidence?.overprint, true);
  assert.equal(fp.severity, 'info');
  assert.match(fp.message, /overprint/);
  assert.ok(!/knocks out/.test(fp.message), fp.message);
  // cmyk-tiff: no /Separation object, so it genuinely flattens and does NOT overprint.
  const ft = one(tiff, 'print.finish-flattened-into-process');
  assert.equal(ft.evidence?.overprint, false);
  assert.equal(ft.severity, 'error');
  assert.match(ft.message, /not overprinted/);
  assert.match(ft.message, /solid black/);
});

// ─── the artifact carries what qualifies it ─────────────────────────────────

test('the report echoes the collection context, not just the tool and format', () => {
  const r = preflight(job({
    source: 'cli',
    modelPhase: 'declared',
    settings: {
      format: 'pdf-cmyk',
      size: { width: mm(210), height: mm(297), dpi: 300, declaredBy: 'url', unitDeclared: true },
      bleed: { known: true, value: mm(3) },
      marks: { known: false, why: 'not-carried' },
      pressProfile: { known: true, value: 'fogra39' },
    },
  }));
  assert.equal(r.job.source, 'cli');
  assert.equal(r.job.modelPhase, 'declared');
  assert.equal(r.job.stageMounted, false);
  assert.equal(r.job.paletteResolved, false);
  assert.equal(r.job.settings.format, 'pdf-cmyk');
  assert.deepEqual(r.job.settings.size.width, { value: 210, unit: 'mm' });
  assert.equal(r.job.settings.size.declaredBy, 'url');
  assert.equal(r.job.settings.size.unitDeclared, true);
  assert.equal(r.job.settings.bleed.known && r.job.settings.bleed.value?.value, 3);
  assert.equal(r.job.settings.marks.known, false);
  assert.equal(r.job.settings.pressProfile.known && r.job.settings.pressProfile.value, 'fogra39');
  // and it survives a JSON round trip, because the artifact is the copy that travels
  const back = JSON.parse(JSON.stringify(r)) as PreflightReport;
  assert.deepEqual(back.job, JSON.parse(JSON.stringify(r.job)));
});

// ─── Effective DPI at print size ─────────────────────────────────────────────

const ev = (f: Finding): Record<string, unknown> => f.evidence as Record<string, unknown>;
const physSize = (w: number, h: number, dpi: number) =>
  ({ width: mm(w), height: mm(h), dpi, declaredBy: 'url' as const, unitDeclared: true });

test('effective-dpi: warns on a raster at a physical trim below the offset floor', () => {
  const r = preflight(job({ settings: { format: 'png', size: physSize(210, 297, 150) } }));
  const f = one(r, 'print.effective-dpi');
  assert.equal(f.severity, 'warn');
  assert.equal(ev(f).intent, 'offset');
  assert.equal(ev(f).floor, 250);
  assert.match(f.message, /150 DPI/);
  assert.match(f.message, /soft/);
});

test('effective-dpi: hard wording below the 150 floor', () => {
  const r = preflight(job({ settings: { format: 'png', size: physSize(210, 297, 96) } }));
  assert.match(one(r, 'print.effective-dpi').message, /150 DPI floor/);
});

test('effective-dpi: silent at 300 DPI, on a px size, and on vector formats', () => {
  const ok = preflight(job({ settings: { format: 'png', size: physSize(210, 297, 300) } }));
  assert.equal(has(ok, 'print.effective-dpi'), false);
  const pxSize = preflight(job({ settings: { format: 'png', size: { width: px(600), height: px(800), dpi: 96, declaredBy: 'url', unitDeclared: true } } }));
  assert.equal(has(pxSize, 'print.effective-dpi'), false, 'px is not a physical trim');
  const svg = preflight(job({ manifest: { id: 't', render: { formats: ['svg'] } }, settings: { format: 'svg', size: physSize(210, 297, 96) } }));
  assert.equal(has(svg, 'print.effective-dpi'), false, 'vector output has no DPI');
});

test('effective-dpi: large-format intent tolerates 72-150 DPI', () => {
  const inside = preflight(job({ settings: { format: 'png', size: physSize(900, 600, 100) } }));
  assert.equal(has(inside, 'print.effective-dpi'), false, '100 DPI is fine at 900mm viewed at distance');
  const below = preflight(job({ settings: { format: 'png', size: physSize(900, 600, 60) } }));
  assert.match(one(below, 'print.effective-dpi').message, /Large-format/);
});

test('image-effective-dpi: warns for a low-res placed image, silent for a high-res one', () => {
  const stageWith = (naturalW: number) => ({
    known: true as const,
    value: { isSequence: false, canvasCssW: 800, rasterImages: [{ label: 'logo.png', naturalW, naturalH: naturalW, boxCssW: 800, boxCssH: 800 }] },
  });
  // 400 px across 210mm (8.27 in) ≈ 48 DPI - soft.
  const low = preflight(job({ settings: { format: 'png', size: physSize(210, 210, 300) }, stage: stageWith(400) }));
  const f = one(low, 'print.image-effective-dpi');
  assert.equal(f.severity, 'warn');
  assert.ok((ev(f).effectiveDpi as number) < 60);
  assert.match(f.message, /logo\.png/);
  // 2500 px across the same 210mm ≈ 302 DPI - fine.
  const high = preflight(job({ settings: { format: 'png', size: physSize(210, 210, 300) }, stage: stageWith(2500) }));
  assert.equal(has(high, 'print.image-effective-dpi'), false);
});

test('image-effective-dpi: withheld on a multi-page stage (one canvas width, many pages)', () => {
  const r = preflight(job({
    settings: { format: 'pdf', size: physSize(210, 297, 300) },
    stage: { known: true, value: { isSequence: false, pageBoxes: 2, canvasCssW: 800, rasterImages: [{ label: 'x', naturalW: 80, naturalH: 80, boxCssW: 800, boxCssH: 800 }] } },
  }));
  assert.equal(has(r, 'print.image-effective-dpi'), false);
});

test('image-dpi-needs-stage: the honest gap fires only headless, at a physical trim', () => {
  const headless = preflight(job({ settings: { format: 'png', size: physSize(210, 297, 300) }, stage: { known: false, why: 'needs-mount' } }));
  const f = one(headless, 'print.image-dpi-needs-stage');
  assert.equal(f.severity, 'info');
  assert.equal(f.needs, 'needs-mount');
  const mounted = preflight(job({ settings: { format: 'png', size: physSize(210, 297, 300) }, stage: { known: true, value: { isSequence: false, canvasCssW: 800, rasterImages: [] } } }));
  assert.equal(has(mounted, 'print.image-dpi-needs-stage'), false);
});

// ─── Total ink coverage (TAC) ────────────────────────────────────────────────

const solid = (name: string, over: { cmyk?: number[]; hex?: string } = {}): PreflightSwatch =>
  ({ path: `brand.color.${name}`, name, spot: null, ...over });
const paletteOf = (...sw: PreflightSwatch[]): PreflightJob['palette'] => ({ known: true, value: sw });

test('palette TAC: reports the heaviest brand solid and the condition limit', () => {
  const r = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: paletteOf(solid('Light', { cmyk: [20, 20, 20, 20] }), solid('Heavy', { cmyk: [80, 70, 60, 90] })) }));
  const f = one(r, 'count.ink-coverage-palette');
  assert.equal(f.count?.value, 300);
  assert.equal(f.count?.kind, 'inkCoverage');
  assert.equal(f.count?.unit, 'pct');
  assert.equal(ev(f).limit, 330);   // default fogra39
  assert.match(f.message, /solid fills only/);
  assert.equal(has(r, 'print.ink-over-tac'), false);
});

test('palette TAC: warns when a solid exceeds the condition limit', () => {
  const r = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: paletteOf(solid('Registration', { cmyk: [90, 90, 90, 90] })) }));
  const w = one(r, 'print.ink-over-tac');
  assert.equal(w.severity, 'warn');
  assert.equal(ev(w).over, 30);      // 360 − 330
  assert.equal(has(r, 'count.ink-coverage-palette'), true);
});

test('palette TAC: honours the chosen press condition', () => {
  const heavy = solid('X', { cmyk: [80, 80, 80, 70] });   // 310
  const f51 = preflight(job({ settings: { format: 'pdf-cmyk', pressProfile: { known: true, value: 'fogra51' } }, palette: paletteOf(heavy) }));
  assert.equal(has(f51, 'print.ink-over-tac'), true, '310 > fogra51 300');
  const f39 = preflight(job({ settings: { format: 'pdf-cmyk', pressProfile: { known: true, value: 'fogra39' } }, palette: paletteOf(heavy) }));
  assert.equal(has(f39, 'print.ink-over-tac'), false, '310 < fogra39 330');
});

test('palette TAC: derives from hex when a swatch carries no cmyk lock', () => {
  const r = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: paletteOf(solid('Navy', { hex: '#003366' })) }));
  // #003366 → rgbToCmyk → C100 M50 Y0 K60 = 210
  assert.equal(one(r, 'count.ink-coverage-palette').count?.value, 210);
});

test('palette TAC: excludes finish swatches (their build is the finish mask, not a solid)', () => {
  const r = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: { known: true, value: [swatch('gold', 'Gold', 'foil'), solid('Ink', { cmyk: [10, 10, 10, 10] })] } }));
  assert.equal(one(r, 'count.ink-coverage-palette').count?.value, 40);
});

test('palette TAC: absent on non-separating formats and when the palette is unresolved', () => {
  const png = preflight(job({ settings: { format: 'png' }, palette: paletteOf(solid('X', { cmyk: [90, 90, 90, 90] })) }));
  assert.equal(has(png, 'count.ink-coverage-palette'), false);
  const unresolved = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: { known: false, why: 'not-resolved' } }));
  assert.equal(has(unresolved, 'count.ink-coverage-palette'), false);
  assert.equal(has(unresolved, 'refuse.ink-coverage'), true, 'the rendered-content gap still stands');
});

test('rich black: flagged for a K-heavy solid with real CMY, not for pure K', () => {
  const pure = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: paletteOf(solid('K', { cmyk: [0, 0, 0, 100] })) }));
  assert.equal(has(pure, 'print.rich-black'), false);
  const rich = preflight(job({ settings: { format: 'pdf-cmyk' }, palette: paletteOf(solid('RichBlack', { cmyk: [40, 30, 30, 100] })) }));
  const f = one(rich, 'print.rich-black');
  assert.equal(f.severity, 'info');
  assert.equal(ev(f).k, 100);
});

test('every CMYK condition declares a TAC limit in the documented 260-360 band', () => {
  for (const [name, cond] of Object.entries(CMYK_CONDITIONS)) {
    assert.ok(Number.isInteger(cond.tac) && cond.tac >= 260 && cond.tac <= 360, `${name} tac ${cond.tac}`);
  }
});
