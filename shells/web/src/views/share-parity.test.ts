// SPDX-License-Identifier: MPL-2.0
/** Content settings share one encoder; workspace navigation stays in the address. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WORKSPACE_PARAMS } from '../lib/tool-url-state.ts';
import { encodeModelParam } from '../lib/url-budget.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { parseUrlState, RESERVED } from '../../../../engine/src/url-mode.ts';
import type { InputManifest, InputSpec } from '../../../../engine/src/inputs.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// tool.ts is an orchestrator plus feature modules under tool/ (2026-09-09 split)
const TOOL_TS = [readFileSync(join(HERE, 'tool.ts'), 'utf8'), ...readdirSync(join(HERE, 'tool')).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(HERE, 'tool', n), 'utf8'))].join('\n');

/** The source body of a top-level `function <name>(` - from its declaration to the
 *  first column-0 `\n}` (its own closing brace, since every nested closer is indented).
 *  One helper so the scans below stay in step across the export-param extraction. */
function fnBody(name: string): string {
  const start = TOOL_TS.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found - this guard needs updating`);
  const end = TOOL_TS.indexOf('\n}', start);
  assert.ok(end > start, `could not find the end of ${name}`);
  return TOOL_TS.slice(start, end);
}

test('address and Share read result controls through the same function', () => {
  assert.match(fnBody('syncUrl'), /collectExportParams\(actionsEl\)/);
  assert.match(fnBody('buildShareParams'), /collectExportParams\(exportScope\)/);
});

test('Share does not inherit workspace keys or a local session pointer', () => {
  const body = fnBody('buildShareParams');
  assert.doesNotMatch(body, /routeParams|urlFlags|location\.|copyWorkspaceParams/);
  for (const key of WORKSPACE_PARAMS) assert.doesNotMatch(body, new RegExp('parts\\.push\\([^\\n]*' + key + '='));
});

test('group:"export" inputs are not excluded from the Share link', () => {
  const body = fnBody('buildShareParams');
  // The original bug in one line: `if (group === 'export') continue;` skipped every
  // declared export-group input (transparentBg, convertPaths, a tool's own plate or
  // finish switches) even though syncUrl's input loop writes them.
  assert.ok(
    !/if\s*\(\s*group\s*===\s*'export'\s*\)\s*continue/.test(body),
    'buildShareParams skips group:"export" inputs again - those are ordinary declared '
    + 'model values that the address bar writes, so skipping them silently drops settings.',
  );
});

test('each toggle the Share link reads is guarded on the control existing', () => {
  const body = fnBody('collectExportParams'); // the imprint guard moved here with the export block
  // The per-format toggles are rendered only for formats that support them. Reading
  // `.checked` off a missing control yields undefined, which for an ON-BY-DEFAULT
  // setting like imprint looks like a deliberate opt-out - and would stamp
  // `imprint=0` onto every link from a format that has no imprint at all.
  assert.match(body, /const imprintEl = [^;]+;\s*\n\s*if \(imprintEl && !imprintEl\.checked\)/,
    'the imprint opt-out must check the control EXISTS before treating it as unchecked');
});

// Device-local dependencies must be reported when a content link excludes them.

test('buildShareParams records every content drop into a fidelity report', () => {
  const body = fnBody('buildShareParams');
  assert.match(body, /excludedAssets\.push\(/, 'a device-local asset drop must be recorded in the fidelity report');
  assert.match(body, /droppedScalars\.push\(/, 'legacy scalar status must remain visible in the report');
  assert.match(body, /droppedBlocks\.push\(/, 'legacy blocks status must remain visible in the report');
  assert.match(body, /faithful:\s*excludedAssets\.length === 0/, 'the fidelity verdict must be false when anything was dropped');
});

test('buildShareParams returns the parts array alongside the fidelity report', () => {
  const body = fnBody('buildShareParams');
  assert.match(body, /return \{ parts, fidelity \};/, 'buildShareParams must return { parts, fidelity }');
});

// Exercise the production content encoder against a real tool manifest.

const PALETTE_JSON = join(HERE, '../../../../community/color-palette/tool.json');
const PALETTE_MOUNTED = existsSync(PALETTE_JSON);
const SKIP_PALETTE = !PALETTE_MOUNTED && 'community/color-palette not mounted';
const paletteManifest: InputManifest = PALETTE_MOUNTED
  ? (JSON.parse(readFileSync(PALETTE_JSON, 'utf8')) as InputManifest)
  : { inputs: [] };
const inputById = (id: string): InputSpec =>
  (paletteManifest.inputs ?? []).find(i => i.id === id) as InputSpec;

function shareParam(input: InputSpec, value: unknown): string | null {
  const parts = encodeModelParam({ ...input, value, isDirty: true } as InputModelItem)
    .filter(part => part.status === 'kept').map(part => part.emit);
  return parts.length ? parts.join('&') : null;
}

test('color-palette Contrast inputs have urlKeys that do not collide with RESERVED', { skip: SKIP_PALETTE }, () => {
  for (const id of ['mode', 'bg', 'contrastCurve', 'lcTargets']) {
    const input = inputById(id);
    assert.ok(input, `manifest is missing the "${id}" input`);
    assert.ok(input.urlKey, `"${id}" must declare a compact urlKey`);
    assert.ok(!RESERVED.has(input.urlKey!), `urlKey "${input.urlKey}" collides with a RESERVED param`);
  }
  assert.deepEqual(
    ['mode', 'bg', 'contrastCurve', 'lcTargets'].map(id => inputById(id).urlKey),
    ['m', 'b', 'cc', 'lc'],
  );
});

test('color-palette Contrast inputs round-trip via urlKey', { skip: SKIP_PALETTE }, () => {
  const values: Record<string, string> = {
    seed: '#ff8800',
    mode: 'contrast',
    bg: '#1e293b',
    contrastCurve: 'text',
    lcTargets: '15,30,45,60,75,90',
  };

  const parts: string[] = [];
  for (const [id, value] of Object.entries(values)) {
    const input = inputById(id);
    assert.ok(shareParam(input, value), `${id} was dropped by the content encoder`);
    parts.push(shareParam(input, value)!);
  }

  const query = parts.join('&');
  // The compact aliases are what actually travel in the link.
  assert.match(query, /(^|&)m=contrast(&|$)/);
  assert.match(query, /(^|&)b=1e293b(&|$)/);
  assert.match(query, /(^|&)cc=text(&|$)/);
  assert.match(query, /(^|&)lc=/);

  const decoded = parseUrlState(query, paletteManifest).values;
  assert.equal(decoded.mode, 'contrast');
  assert.equal(decoded.bg, '#1e293b');          // '#' restored by the color coercion
  assert.equal(decoded.contrastCurve, 'text');
  assert.equal(decoded.lcTargets, '15,30,45,60,75,90');
  assert.equal(decoded.seed, '#ff8800');
});

test('color-palette Contrast inputs decode identically from their full id form', { skip: SKIP_PALETTE }, () => {
  // parseUrlState keys inputsByKey by BOTH id and urlKey, so a link written the
  // long way (mode=, bg=, contrastCurve=, lcTargets=) must reproduce the same model.
  const query = 'mode=contrast&bg=1e293b&contrastCurve=text&lcTargets=15,30,45,60,75,90&seed=ff8800';
  const decoded = parseUrlState(query, paletteManifest).values;
  assert.equal(decoded.mode, 'contrast');
  assert.equal(decoded.bg, '#1e293b');
  assert.equal(decoded.contrastCurve, 'text');
  assert.equal(decoded.lcTargets, '15,30,45,60,75,90');
  assert.equal(decoded.seed, '#ff8800');
});

test('color-palette retains a long custom contrast list in content links', { skip: SKIP_PALETTE }, () => {
  const long = Array.from({ length: 100 }, (_, i) => String(i)).join(',');
  const query = shareParam(inputById('lcTargets'), long);
  assert.ok(query);
  assert.equal(parseUrlState(query, paletteManifest).values.lcTargets, long);
});
