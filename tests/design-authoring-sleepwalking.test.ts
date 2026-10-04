// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 W5 acceptance on the delivered Sleepwalking deck (private, gated).
 *
 * The whole light deck, written as one Design authoring document (artboard
 * coordinates, named text styles, paths in px and the layout macros), must lower to
 * the delivered rows, and one package call must carry it to the delivered session.
 * The inputs are private, so every path comes from the environment:
 *
 *   - LOLLY_AUTHOR_SLEEPWALKING: the authoring document (light.author.json);
 *   - LOLLY_CHECK_DELIVERED: the folder holding the delivered light.lolly.boxes.json;
 *   - LOLLY_CHECK_SLEEPWALKING: the folder holding the delivered
 *     "Sleepwalking SUSE light.lolly" package (the second test only).
 *
 * The text styles resolve against the suse profile's design brief, so the brand must
 * be checked out as well. "The same document" is tests/helpers/design-rows-equal.ts.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { designBrief } from '../engine/src/design-brief.ts';
import { expandDesignAuthoringDocument } from '../engine/src/design-authoring.ts';
import { readProfileBriefCatalog, readProfileTokenDocument } from '../packages/node-shell/src/design-brief.ts';
import { designRowsProblems } from './helpers/design-rows-equal.ts';

type Row = Record<string, unknown>;

const AUTHOR = (process.env.LOLLY_AUTHOR_SLEEPWALKING ?? '').trim();
const DELIVERED = (process.env.LOLLY_CHECK_DELIVERED ?? '').trim();
const PACKAGES = (process.env.LOLLY_CHECK_SLEEPWALKING ?? '').trim();
const LABEL = 'Sleepwalking SUSE light';
const PROFILE = 'suse';

const haveAuthor = !!AUTHOR && existsSync(AUTHOR);
const haveRows = !!DELIVERED && existsSync(join(DELIVERED, 'light.lolly.boxes.json'));
const havePackage = !!PACKAGES && existsSync(join(PACKAGES, `${LABEL}.lolly`));
const haveBrand = (): boolean => {
  try {
    return readProfileTokenDocument({ profile: PROFILE }) !== null;
  } catch {
    return false;
  }
};
const BRAND_SKIP = 'brands/suse is not checked out, so the suse profile cannot be resolved here';
const rowsSkip = !haveAuthor || !haveRows
  ? 'the private Sleepwalking authoring fixture is not on this machine (set LOLLY_AUTHOR_SLEEPWALKING and LOLLY_CHECK_DELIVERED)'
  : haveBrand() ? false : BRAND_SKIP;
const packageSkip = !haveAuthor || !havePackage
  ? 'the private Sleepwalking authoring fixture is not on this machine (set LOLLY_AUTHOR_SLEEPWALKING and LOLLY_CHECK_SLEEPWALKING)'
  : haveBrand() ? false : BRAND_SKIP;

/** The suse brief in its light theme, the base layer of the document's text styles. */
function suseBrief(): unknown {
  const tokens = readProfileTokenDocument({ profile: PROFILE });
  assert.ok(tokens, 'the suse token document resolves');
  return designBrief(tokens.doc, readProfileBriefCatalog({ profile: PROFILE }), { theme: 'light' });
}

/**
 * Keys that restate what the expansion already does, or that only a lowering should
 * write. A zero-compensation document carries none of them anywhere: on a row, a
 * macro template, an item override, a divider or a named style.
 */
const AGENT_DEFAULTS: Readonly<Record<string, unknown>> = { align: 'left', valign: 'top', pad: 0, font: 'sans', shape: 'rect', rot: 0, fit: 'contain', imgpos: 'center' };
const LOWERED_ONLY = new Set(['frame', 'path', 'z', 'role', 'group', 'master']);

function compensation(value: unknown, pointer = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => compensation(v, `${pointer}/${i}`));
  if (!value || typeof value !== 'object') return [];
  const hits: string[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (key === 'notes' || key === 'text') continue;
    if (LOWERED_ONLY.has(key)) hits.push(`${pointer}/${key}`);
    if (Object.hasOwn(AGENT_DEFAULTS, key) && v === AGENT_DEFAULTS[key]) hits.push(`${pointer}/${key}=${JSON.stringify(v)}`);
    hits.push(...compensation(v, `${pointer}/${key}`));
  }
  return hits;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const boxesOf = (values: Row): Row[] => (typeof values.boxes === 'string' ? JSON.parse(values.boxes) : values.boxes) as Row[];

test('the Sleepwalking light deck, authored with no compensation, lowers to the delivered rows', { skip: rowsSkip }, () => {
  const doc = readJson(AUTHOR);
  assert.deepEqual(compensation(doc), [], 'the authoring document restates no default and writes no lowered-only key');
  const golden = readJson(join(DELIVERED, 'light.lolly.boxes.json')) as Row[];
  const out = expandDesignAuthoringDocument(doc, { brief: suseBrief() });
  assert.equal(out.expanded, true);
  assert.deepEqual(out.notes, [], 'every text row has a colour from a style or the theme, every path its heads');
  assert.equal(out.rows.length, golden.length);
  assert.equal(out.rows.filter((r) => r.kind === 'frame').length, 16);
  assert.deepEqual(designRowsProblems(golden, out.rows), [], 'the expansion is the delivered document');
  // A path the expansion writes sits on a whole-pixel box, so the renderer's rounding of
  // the box never moves the curve (the delivered rows hold sub-pixel path boxes, which
  // the comparator reads by their decoded geometry instead).
  for (const row of out.rows.filter((r) => r.kind === 'path')) {
    assert.ok(['x', 'y', 'w', 'h'].every((k) => Number.isInteger(row[k])), `${String(row.id)} has a whole-pixel box`);
  }
  // Everything the document did not author passes through: the top-level inputs stay.
  assert.equal((out.values as Row).transition, 'fade');
});

test('one package call carries the authored Sleepwalking deck to the delivered session, media and findings', { skip: packageSkip, timeout: 180_000 }, async () => {
  const { packageDesign } = await import('../packages/node-shell/src/design-lolly.ts');
  const { readLollyFile } = await import('../packages/node-shell/src/lolly-file.ts');
  const { checkFile } = await import('../packages/node-shell/src/check.ts');
  const deliveredBytes = new Uint8Array(readFileSync(join(PACKAGES, `${LABEL}.lolly`)));
  const delivered = readLollyFile(deliveredBytes);
  const deliveredValues = delivered.session as unknown as Row;
  const deliveredBoxes = boxesOf((deliveredValues.values ?? deliveredValues) as Row);
  const doc = readJson(AUTHOR) as Row;

  // The pictures: each placeholder in the document, keyed to the bytes the delivered
  // package carries for the same layer.
  const placeholders = new Map<string, string>();
  for (const row of (doc.boxes as Row[]).filter((r) => typeof r.image === 'string' && String(r.image).startsWith('photo:'))) placeholders.set(String(row.image), String(row.id));
  assert.equal(placeholders.size, 3, 'three photographs');
  const uploads = new Map([...delivered.files.entries()].filter(([path]) => path.startsWith('assets/uploads/')));
  const assets = [...placeholders].map(([key, layerId]) => {
    const image = deliveredBoxes.find((r) => r.id === layerId)?.image as { id?: string } | undefined;
    const sha = String(image?.id ?? '').replace('user/media/', '');
    const entry = [...uploads].find(([path]) => path.includes(sha));
    assert.ok(entry, `${key}: the delivered package carries its picture`);
    return { key, bytes: entry[1], name: entry[0].split('/').pop() };
  });

  const catalog = readProfileBriefCatalog({ profile: PROFILE });
  assert.ok(catalog);
  const { bytes, report } = await packageDesign(doc, { assets, label: LABEL, brief: suseBrief(), catalog, exportedAt: '2026-10-03T00:00:00.000Z' });
  assert.equal(report.readback.ok, true);
  assert.deepEqual(report.missingMedia, []);
  assert.deepEqual(report.references.unknown, []);

  const mine = readLollyFile(bytes);
  const mineValues = mine.session as unknown as Row;
  const values = (mineValues.values ?? mineValues) as Row;
  assert.deepEqual(designRowsProblems(deliveredBoxes, boxesOf(values)), [], 'the session boxes are the delivered ones');
  const others = (v: Row): Row => Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'boxes' && k !== '__export_filename'));
  assert.deepEqual(others(values), others((deliveredValues.values ?? deliveredValues) as Row), 'the same session values');
  assert.equal(values.__export_filename, LABEL, 'the label names the file');
  const sha = (files: Map<string, Uint8Array>): string[] =>
    [...files].filter(([path]) => path.startsWith('assets/uploads/')).map(([, b]) => createHash('sha256').update(b).digest('hex')).sort();
  assert.deepEqual(sha(mine.files), sha(delivered.files), 'the same three pictures');

  const tokens = readProfileTokenDocument({ profile: PROFILE })!;
  const checkOpts = {
    browser: 'off' as const,
    designSystem: { doc: tokens.doc, origin: 'profile' as const, profile: tokens.profile, tokensAsset: tokens.tokensAsset },
    catalog,
  };
  const ours = await checkFile(bytes, `${LABEL}.lolly`, checkOpts);
  const theirs = await checkFile(deliveredBytes, `${LABEL}.lolly`, checkOpts);
  assert.equal(ours.summary.error, 0);
  const key = (f: { code: string; severity: string; layerId?: string }): string => `${f.severity} ${f.code} ${f.layerId ?? ''}`;
  assert.deepEqual(ours.findings.map(key).sort(), theirs.findings.map(key).sort(), 'the same findings as the delivered file');
  assert.deepEqual(ours.summary, theirs.summary);
});
