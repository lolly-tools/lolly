// SPDX-License-Identifier: MPL-2.0
/**
 * Contract guard: the Share link must carry what the address bar carries.
 *
 * `syncUrl` writes the live export settings into the address bar; `buildShareParams`
 * builds the copied link. They are two independent readers of the same DOM controls,
 * and they had silently drifted: the Share button dropped `hdr`, `imprint=0`,
 * `durable`, `nostage` and every `group:"export"` input while the URL bar was
 * displaying exactly those settings to the user. Someone copying a link got a
 * different file than the one they were looking at, with no indication anything
 * had been lost.
 *
 * A unit test is impractical here - `buildShareParams` is private to a 3k-line
 * DOM-coupled view - so this scans the real source, in the house style of
 * `a11y-prefs-contract.test.ts` (which scans real stylesheets) and
 * `docs-shots-vector.test.ts` (which scans real recipes). It cannot prove the two
 * agree at RUNTIME; it proves neither one grew a parameter the other never heard
 * of, which is the drift that actually happened.
 *
 * When you add an export setting: write it in BOTH places, or add it to
 * SHARE_EXEMPT below with a reason. An exemption is a deliberate product decision
 * ("this must not travel in a link"), never a shortcut.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

/**
 * Params the address bar writes but a shared link deliberately must NOT carry.
 * Each needs a reason. Empty today: everything syncUrl writes is shareable, and
 * `password` is intentionally shared (a standard-tier PDF lock travels with the
 * link by design - documented at its call site).
 */
const SHARE_EXEMPT: Record<string, string> = {};

/** The params `syncUrl` writes to the address bar. */
function syncUrlParams(): Set<string> {
  // `dirtyParams.has('x')` gates every branch that writes a param, so it is the
  // most reliable enumeration of what syncUrl can emit.
  const found = [...TOOL_TS.matchAll(/dirtyParams\.has\('([a-z_]+)'\)/g)].map(m => m[1]!);
  return new Set(found);
}

/** The export params the Share link pushes. These now live in collectExportParams
 *  (extracted from buildShareParams so the URL-budget gauge reads the same DOM once);
 *  the model-input pushes never appeared here (they use a dynamic `${key}`). */
function shareParams(): Set<string> {
  const body = fnBody('collectExportParams');
  const out = new Set<string>();
  // Both encodings used in the body: `parts.push(\`name=...\`)` and the bare
  // presence flag `parts.push('name')` / `parts.push('name=0')`.
  for (const m of body.matchAll(/parts\.push\(\s*`([a-z_]+)=/g)) out.add(m[1]!);
  for (const m of body.matchAll(/parts\.push\('([a-z_]+)(?:=[^']*)?'\)/g)) out.add(m[1]!);
  return out;
}

test('every export setting the address bar writes is also carried by the Share link', () => {
  const bar = syncUrlParams();
  const share = shareParams();
  assert.ok(bar.size >= 10, `expected syncUrl to write many params, found ${bar.size} - the scan probably broke`);

  const missing = [...bar].filter(p => !share.has(p) && !(p in SHARE_EXEMPT)).sort();
  assert.deepEqual(missing, [], `Share link drops ${missing.join(', ')} - settings the address bar shows the user. `
    + 'Add them to buildShareParams, or list them in SHARE_EXEMPT with a reason.');
});

test('the Share link does not invent params the address bar never writes', () => {
  const bar = syncUrlParams();
  const share = shareParams();
  // The reverse direction: a param only the share link knows about is just as much
  // a drift, and means the address bar is the one under-reporting.
  const extra = [...share].filter(p => !bar.has(p)).sort();
  assert.deepEqual(extra, [], `Share link carries ${extra.join(', ')} which syncUrl never writes - `
    + 'the address bar is under-reporting, or the share builder is guessing.');
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

// ─── fidelity: every content drop is RECORDED, never silent ────────────────────
//
// buildShareParams deliberately drops what a URL can't carry - device-local
// (user/*) images, scalars past the 150-char cap, and blocks past the 8000-char
// cap. Before Wave 1 those drops were SILENT: a design "after many edits" shared a
// link that opened with its content missing and no warning. The Share dialog now
// renders a verdict from a `ShareFidelity` report; these guard that the builder
// actually fills that report at every drop site, so a future drop that forgets to
// record it can't re-introduce the silent-loss bug.

test('buildShareParams records every content drop into a fidelity report', () => {
  const body = fnBody('buildShareParams');
  assert.match(body, /excludedAssets\.push\(/, 'a device-local asset drop must be recorded in the fidelity report');
  assert.match(body, /droppedScalars\.push\(/, 'an over-cap scalar drop must be recorded in the fidelity report');
  assert.match(body, /droppedBlocks\.push\(/, 'an over-cap blocks drop must be recorded in the fidelity report');
  assert.match(body, /faithful:\s*excludedAssets\.length === 0/, 'the fidelity verdict must be false when anything was dropped');
});

test('buildShareParams returns the parts array alongside the fidelity report', () => {
  const body = fnBody('buildShareParams');
  assert.match(body, /return \{ parts, fidelity \};/, 'buildShareParams must return { parts, fidelity }');
});

// ─── tool-input URL parity: color-palette Contrast mode (m/b/cc/lc) ────────────
//
// The share link writes a tool's inputs by their compact `urlKey` (buildShareParams:
// `key = input.urlKey ?? id`, hex colours stripped of '#', scalars over 150 chars
// dropped), and the engine's `parseUrlState` reads them back keyed by EITHER the id
// or the urlKey. Palette Lab's Contrast-mode inputs (mode→m, bg→b, contrastCurve→cc,
// lcTargets→lc) are new URL surface, so pin that they encode under the 150-char cap
// and decode back to the same model through both key forms - the CLI/web parity the
// url-mode contract exists to guarantee.

const PALETTE_JSON = join(HERE, '../../../../community/color-palette/tool.json');
const PALETTE_MOUNTED = existsSync(PALETTE_JSON);
const SKIP_PALETTE = !PALETTE_MOUNTED && 'community/color-palette not mounted';
const paletteManifest: InputManifest = PALETTE_MOUNTED
  ? (JSON.parse(readFileSync(PALETTE_JSON, 'utf8')) as InputManifest)
  : { inputs: [] };
const inputById = (id: string): InputSpec =>
  (paletteManifest.inputs ?? []).find(i => i.id === id) as InputSpec;

// The 150-char scalar cap enforced by buildShareParams (shells/web/src/views/tool.ts).
const SCALAR_CAP = 150;

/** The pre-encode string buildShareParams would write for a scalar input, or null
 *  when it would be skipped (empty / default / a boolean false / past the cap). */
function shareScalar(input: InputSpec, value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean' && !value) return null;
  const def = (input as { default?: unknown }).default;
  if (def != null && input.type !== 'asset' && String(value) === String(def)) return null;
  const str = String(value); // token-colour ({ ref }) branch is source-scanned above, not here
  if (str.length > SCALAR_CAP) return null;
  return str;
}

/** Mirror buildShareParams' key + hex-strip encoding for one scalar input. */
function shareParam(input: InputSpec, value: unknown): string | null {
  const raw = shareScalar(input, value);
  if (raw == null) return null;
  const key = input.urlKey ?? input.id;
  const str = input.type === 'color' && raw.startsWith('#') ? raw.slice(1) : raw;
  return `${encodeURIComponent(key)}=${encodeURIComponent(str)}`;
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

test('color-palette Contrast inputs encode under the 150-char cap and round-trip via urlKey', { skip: SKIP_PALETTE }, () => {
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
    // Every value here is off-default, so each must produce a param within the cap.
    const raw = shareScalar(input, value);
    assert.ok(raw != null, `${id} was dropped by the share encoder`);
    assert.ok(raw.length <= SCALAR_CAP, `${id} scalar "${raw}" exceeds the ${SCALAR_CAP}-char cap`);
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

test('color-palette: an lcTargets over the 150-char cap is dropped, not shared', { skip: SKIP_PALETTE }, () => {
  // A pathological custom list past the scalar cap must not ride in the link (it would
  // bloat every URL); the share encoder skips it, so a shared link falls back to default.
  const long = Array.from({ length: 60 }, (_, i) => String(i)).join(','); // > 150 chars
  assert.ok(long.length > SCALAR_CAP);
  assert.equal(shareParam(inputById('lcTargets'), long), null, 'over-cap lcTargets must be dropped');
});
