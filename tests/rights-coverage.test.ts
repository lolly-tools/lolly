// SPDX-License-Identifier: MPL-2.0
/**
 * The rights coverage register (scripts/data/rights-coverage.json, plan 253
 * Phase 0) stays whole and honest.
 *
 * Whole: every export format, every format the public register lists, every
 * drop route, every web file that hands bytes to a download, share or clipboard,
 * every Send driver and every file that builds a provenance ingredient or
 * evaluates rights must be registered. Each set is read from the code itself,
 * so a new format or delivery path fails here until someone records what it
 * carries.
 *
 * Honest: a status that claims something must point at a test that proves the
 * claim, a format claimed as covered must be one the bridge stamps, and a
 * package claimed as metadata-only must read its own credits back. Nothing here
 * can raise a status; when in doubt the answer is not-assessed.
 *
 * Run: node --test tests/rights-coverage.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C2PA_FORMATS } from '../engine/src/c2pa-containers.ts';

type Status = 'covered' | 'metadata-only' | 'credential-only' | 'raw-utility' | 'not-assessed' | 'by-format';
type Evidence = string | Array<{ file: string; test: string }>;
interface PathEntry {
  id: string; kind: 'delivery' | 'import' | 'census'; title: string; status: Status;
  byFormat?: string; code: string[]; evidence?: Evidence; routes?: string[]; note: string;
}
interface FormatEntry { status: Status; code?: string[]; evidence?: Evidence; note?: string }
interface Register {
  statuses: Record<string, string>;
  library: { files: string[] };
  evidenceSets: Record<string, Array<{ file: string; test: string }>>;
  paths: PathEntry[];
  exportFormats: Record<string, FormatEntry>;
  formats: Record<string, { import?: string[]; delivery?: string[] }>;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const REGISTER_FILE = 'scripts/data/rights-coverage.json';
const register = JSON.parse(read(REGISTER_FILE)) as Register;
const HOW = `Register it in ${REGISTER_FILE} with an honest status (see the file's _note); when in doubt it is not-assessed.`;

const STATUSES = new Set<Status>(['covered', 'metadata-only', 'credential-only', 'raw-utility', 'not-assessed']);
const CLAIMS = new Set<Status>(['covered', 'metadata-only', 'credential-only']);
const pathById = new Map(register.paths.map(entry => [entry.id, entry]));
const registeredCode = new Set([
  ...register.paths.flatMap(entry => entry.code),
  ...Object.values(register.exportFormats).flatMap(entry => entry.code ?? []),
]);

/** The body of a top-level function, from its signature to the first closing brace at column 0. */
function functionBody(file: string, signature: string): string {
  const src = read(file);
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `${file} no longer declares "${signature}"; update the extractor in this test`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end < 0 ? undefined : end);
}

/** Every quoted string a pattern captures, with a floor so a broken parse fails loudly. */
function captures(text: string, pattern: RegExp, floor: number, what: string): string[] {
  const found = [...text.matchAll(pattern)].map(match => match[1]!);
  assert.ok(found.length >= floor, `found ${found.length} ${what}, expected at least ${floor}; the source moved, so update the extractor in this test`);
  return found;
}

/** Source files under a directory, as repo-relative paths, tests and declarations left out. */
function sourceFiles(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return (readdirSync(join(ROOT, dir), { recursive: true }) as string[])
    .filter(rel => rel.endsWith('.ts') && !rel.endsWith('.test.ts') && !rel.endsWith('.d.ts') && !rel.split('/').includes('node_modules'))
    .map(rel => `${dir}/${rel}`)
    .sort();
}

function evidenceOf(entry: { evidence?: Evidence }): Array<{ file: string; test: string }> {
  if (entry.evidence === undefined) return [];
  if (typeof entry.evidence === 'string') {
    const set = register.evidenceSets[entry.evidence];
    assert.ok(set, `evidence set "${entry.evidence}" is not defined in evidenceSets`);
    return set;
  }
  return entry.evidence;
}

/** Every export format a tool can declare, the web bridge can dispatch or a host can write. */
function exportFormatUniverse(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (format: string, source: string): void => { out.set(format, [...(out.get(format) ?? []), source]); };
  const schema = JSON.parse(read('schemas/tool.schema.json')) as { properties: { render: { properties: { formats: { items: { enum: string[] } } } } } };
  for (const format of schema.properties.render.properties.formats.items.enum) add(format, 'schemas/tool.schema.json render.formats');
  const dispatch = functionBody('shells/web/src/bridge/export.ts', 'async function renderFormatDispatch(');
  for (const format of captures(dispatch, /case '([^']+)':/g, 40, 'web export cases')) add(format, 'renderFormatDispatch');
  const node = /export const NODE_FORMATS = \[([^\]]*)\]/.exec(read('packages/node-shell/src/raster.ts'))?.[1] ?? '';
  for (const format of captures(node, /'([^']+)'/g, 10, 'NODE_FORMATS entries')) add(format, 'NODE_FORMATS');
  const union = /export type ExportFormat =([\s\S]*?);/.exec(read('packages/core/src/host-v1/export.ts'))?.[1] ?? '';
  for (const format of captures(union.replace(/\/\/.*$/gm, ''), /'([^']+)'/g, 15, 'ExportFormat members')) add(format, 'ExportFormat');
  return out;
}

test('every status is from the vocabulary, every id is unique and every id starts with its kind', () => {
  for (const status of STATUSES) assert.ok(register.statuses[status], `the statuses block defines ${status}`);
  assert.equal(pathById.size, register.paths.length, 'path ids are unique');
  for (const entry of register.paths) {
    assert.ok(STATUSES.has(entry.status) || entry.status === 'by-format', `${entry.id}: unknown status ${entry.status}`);
    assert.ok(['delivery', 'import', 'census'].includes(entry.kind), `${entry.id}: unknown kind ${entry.kind}`);
    assert.ok(entry.id.startsWith(`${entry.kind}.`), `${entry.id}: the id starts with its kind`);
    assert.ok(entry.title?.trim(), `${entry.id}: has a title`);
    assert.ok(entry.note?.trim(), `${entry.id}: says what is known in a note`);
    assert.ok(entry.code.length > 0, `${entry.id}: lists the code that implements the path`);
    if (entry.routes) assert.equal(entry.kind, 'import', `${entry.id}: only an import path takes drop routes`);
    if (entry.status === 'by-format') assert.equal(entry.byFormat, 'exportFormats', `${entry.id}: a by-format status points at the per-format table`);
    else assert.equal(entry.byFormat, undefined, `${entry.id}: byFormat only goes with a by-format status`);
  }
  for (const [format, entry] of Object.entries(register.exportFormats)) {
    assert.ok(STATUSES.has(entry.status), `exportFormats.${format}: unknown status ${entry.status}`);
    if (entry.status !== 'covered') assert.ok(entry.note?.trim(), `exportFormats.${format}: says what is known in a note`);
  }
});

test('every code path exists, so the register cannot point at a deleted file', () => {
  const missing = [...registeredCode, ...register.library.files].filter(rel => !existsSync(join(ROOT, rel)));
  assert.deepEqual(missing, [], 'these registered files no longer exist; move the entry to where the code went');
});

test('a status that claims something points at a test that proves the claim', (t) => {
  const entries: Array<[string, { status: Status; evidence?: Evidence }]> = [
    ...register.paths.map(entry => [entry.id, entry] as [string, PathEntry]),
    ...Object.entries(register.exportFormats).map(([format, entry]) => [`exportFormats.${format}`, entry] as [string, FormatEntry]),
  ];
  const counts = new Map<string, number>();
  for (const [id, entry] of entries) {
    counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
    const evidence = evidenceOf(entry);
    if (CLAIMS.has(entry.status)) assert.ok(evidence.length > 0, `${id} claims ${entry.status} and gives no test`);
    for (const item of evidence) {
      assert.ok(existsSync(join(ROOT, item.file)), `${id}: evidence file ${item.file} does not exist`);
      // A title with an apostrophe is written escaped inside a quoted test name.
      const src = read(item.file).replace(/\\'/g, "'");
      assert.ok(src.includes(item.test), `${id}: ${item.file} has no test named "${item.test}"`);
    }
  }
  t.diagnostic(`statuses: ${[...counts].sort().map(([status, n]) => `${status} ${n}`).join(', ')}`);
});

test('every export format a tool can declare, the web bridge can dispatch or a host can write is registered', () => {
  const universe = exportFormatUniverse();
  const unregistered = [...universe].filter(([format]) => !register.exportFormats[format]).map(([format, from]) => `${format} (${from.join(', ')})`);
  assert.deepEqual(unregistered, [], `new export formats with no rights coverage entry. ${HOW}`);
  const stale = Object.keys(register.exportFormats).filter(format => !universe.has(format));
  assert.deepEqual(stale, [], 'these exportFormats entries name a format nothing declares or writes any more');
});

test('a format registered as covered is one the export bridge actually stamps', () => {
  // renderPreparedFormat stamps an animated WebP as a WebP, an animated SVG as an
  // SVG and Opus as its WebM container; every other format stamps under its own name.
  const stampKey: Record<string, string> = { 'webp-anim': 'webp', 'svg-anim': 'svg', opus: 'webm' };
  const stampable = new Set<string>(C2PA_FORMATS);
  const overclaimed = Object.entries(register.exportFormats)
    .filter(([format, entry]) => entry.status === 'covered' && !stampable.has(stampKey[format] ?? format))
    .map(([format]) => format);
  assert.deepEqual(overclaimed, [], 'covered means a Content Credential is written and read back; these formats are not in C2PA_FORMATS');
  assert.equal(pathById.get('delivery.tool-export')?.status, 'by-format', 'the tool export route defers to the per-format table');
});

test('a package format registered as metadata-only reads its own credits back', () => {
  for (const [format, entry] of Object.entries(register.exportFormats)) {
    if (entry.status !== 'metadata-only') continue;
    assert.ok(entry.code?.length, `exportFormats.${format}: lists the writer`);
    assert.ok(entry.code!.some(file => read(file).includes('checkCompanionReadback(')),
      `exportFormats.${format}: none of ${entry.code!.join(', ')} reads the package credits back`);
  }
});

test('every format in the public format register is registered in each direction it supports', () => {
  const catalog = JSON.parse(read('docs/site/formats-catalog.json')) as { formats: Array<{ token: string; dir: 'in' | 'out' | 'both' }> };
  const tokens = new Map(catalog.formats.map(format => [format.token, format.dir]));
  assert.deepEqual([...tokens.keys()].filter(token => !register.formats[token]), [], `formats-catalog.json lists formats the rights register does not. ${HOW}`);
  assert.deepEqual(Object.keys(register.formats).filter(token => !tokens.has(token)), [], 'these formats entries name a token formats-catalog.json no longer lists');
  for (const [token, dir] of tokens) {
    const entry = register.formats[token]!;
    assert.equal(Boolean(entry.import?.length), dir !== 'out', `${token} (${dir}): lists an import path exactly when Lolly reads it`);
    assert.equal(Boolean(entry.delivery?.length), dir !== 'in', `${token} (${dir}): lists a delivery exactly when Lolly writes it`);
    for (const ref of entry.import ?? []) assert.equal(pathById.get(ref)?.kind, 'import', `${token}: ${ref} is not a registered import path`);
    for (const ref of entry.delivery ?? []) {
      if (ref.startsWith('export:')) assert.ok(register.exportFormats[ref.slice(7)], `${token}: ${ref} is not in exportFormats`);
      else assert.equal(pathById.get(ref)?.kind, 'delivery', `${token}: ${ref} is not a registered delivery path`);
    }
  }
});

test('every drop route is an import path, exactly once', () => {
  const routes = [
    ...captures(functionBody('shells/web/src/lib/drop-router.ts', 'export function dropChooserChoices('), /\bid: '([a-z-]+)'/g, 15, 'drop chooser routes'),
    ...captures(functionBody('shells/web/src/lib/drop-router.ts', 'export function lollyIntakeChoices('), /\bid: '([a-z-]+)'/g, 4, '.lolly intake routes'),
  ];
  const universe = new Set(routes);
  const owners = new Map<string, string[]>();
  for (const entry of register.paths) for (const route of entry.routes ?? []) owners.set(route, [...(owners.get(route) ?? []), entry.id]);
  assert.deepEqual([...universe].filter(route => !owners.has(route)).sort(), [], `drop routes with no import path. ${HOW}`);
  assert.deepEqual([...owners.keys()].filter(route => !universe.has(route)).sort(), [], 'these routes are no longer offered by the drop router');
  assert.deepEqual([...owners].filter(([, ids]) => ids.length > 1), [], 'a drop route belongs to one import path');
});

test('every web file that hands bytes to a download, share or clipboard is a registered path', () => {
  const DELIVERS = /\bexport\.download\(|\bsaveBlob\(|\banchorSave(?:Url)?\(|\bdeliverFile\(|\bshareFile\(|new ClipboardItem\(|navigator\.share\(/;
  const delivering = sourceFiles('shells/web/src').filter(file => DELIVERS.test(read(file)));
  assert.ok(delivering.length >= 40, `found only ${delivering.length} delivering files; the scan has broken`);
  const deliveryCode = new Set(register.paths.filter(entry => entry.kind === 'delivery').flatMap(entry => entry.code));
  assert.deepEqual(delivering.filter(file => !deliveryCode.has(file)), [], `these files deliver bytes and no delivery path lists them. ${HOW}`);
});

test('every built-in Send driver is registered as a delivery path', () => {
  const body = functionBody('shells/web/src/lib/send-targets-builtin.ts', 'export async function registerBuiltinSendTargets(');
  const drivers = captures(body, /import\('\.\/([^']+)'\)/g, 5, 'Send drivers').map(name => `shells/web/src/lib/${name}`);
  const deliveryCode = new Set(register.paths.filter(entry => entry.kind === 'delivery').flatMap(entry => entry.code));
  assert.deepEqual(drivers.filter(file => !deliveryCode.has(file)), [], `these Send drivers have no delivery path. ${HOW}`);
});

test('every file that builds a provenance ingredient or evaluates rights is registered', () => {
  const CENSUS = /_ingredientSink|_sourceIngredientSink|prepareC2paIngredient(?:FromStore)?\(|emojiWorksAndUses\(|sourceIngredientsFor\(|evaluateCreativeUses\(|checkAttributionReadback\(|checkCompanionReadback\(|attributionCompanion\(/;
  const packages = readdirSync(join(ROOT, 'packages')).map(name => `packages/${name}/src`);
  const roots = ['engine/src', 'shells/web/src', 'shells/cli/src', 'shells/tui/src', 'services/mcp/src', ...packages];
  const library = new Set(register.library.files);
  const found = roots.flatMap(sourceFiles).filter(file => !library.has(file) && CENSUS.test(read(file)));
  assert.ok(found.length >= 15, `found only ${found.length} census files; the scan has broken`);
  assert.deepEqual(found.filter(file => !registeredCode.has(file)), [], `these files collect sources or evaluate rights and no path lists them. ${HOW}`);
});
