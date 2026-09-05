// SPDX-License-Identifier: MPL-2.0
/** Stable, transport-neutral document/compiler verbs. */
import type { HostV1 } from './bridge/host-v1.ts';
import type { InputModelItem, InputSpec, InputValue } from './inputs.ts';
import { modelToValues } from './inputs.ts';
import type { LoadedTool, ToolManifest } from './loader.ts';
import { createRuntime } from './runtime.ts';
import { validateManifest, type ValidationIssue } from './validate.ts';
import { parseUrlState } from './url-mode.ts';
import { parseDimension, toPixels } from './units.ts';
import { storeZip } from './zip.ts';
import { stripMetadata } from './strip-metadata.ts';
import { extractFileMetadata } from './file-metadata.ts';

export const DOCUMENT_API_VERSION = '1.0.0';
export interface CompiledDocument { apiVersion: typeof DOCUMENT_API_VERSION; toolId: string; toolVersion: string; designVersion?: string; manifest: ToolManifest; model: InputModelItem[]; values: Record<string, unknown>; tokens?: Record<string, unknown>; hydrated: string; styles: string | null }
export interface CompileResult { document: CompiledDocument; model: InputModelItem[]; warnings: string[]; designVersion?: string }

export async function compileDocument(tool: LoadedTool, inputs: Record<string, InputValue>, opts: { host: HostV1; designVersion?: string }): Promise<CompileResult> {
  const runtime = await createRuntime(tool, opts.host, inputs);
  try {
    const model = runtime.getModel();
    const warnings = [...runtime.hookErrors.map((e) => `${e.hook}: ${e.message}`), ...runtime.droppedAssets.map((a) => `asset ${a.id} for ${a.inputId} was not resolved`)];
    const tokens = tokenValuesFromModel(model);
    const document: CompiledDocument = { apiVersion: DOCUMENT_API_VERSION, toolId: tool.manifest.id, toolVersion: tool.manifest.version, ...(opts.designVersion ? { designVersion: opts.designVersion } : {}), manifest: tool.manifest, model, values: modelToValues(model), ...(Object.keys(tokens).length ? { tokens } : {}), hydrated: runtime.getHydrated(), styles: runtime.styles };
    return { document, model, warnings, ...(opts.designVersion ? { designVersion: opts.designVersion } : {}) };
  } finally { runtime.destroy(); }
}

export type ValidationTarget = { kind: 'manifest'; value: unknown } | { kind: 'inputs'; manifest: ToolManifest; value: Record<string, unknown> } | { kind: 'recipe'; manifest: ToolManifest; value: string } | { kind: 'document'; value: unknown };
export interface DocumentValidationResult { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] }
export function validateDocument(target: ValidationTarget): DocumentValidationResult {
  if (target.kind === 'manifest') { const r = validateManifest(target.value); return { ok: r.valid, errors: r.errors, warnings: [] }; }
  if (target.kind === 'recipe') { try { parseUrlState(target.value, target.manifest); return valid(); } catch (e) { return invalid('/', e); } }
  if (target.kind === 'document') {
    const v = target.value as Partial<CompiledDocument> | null; const errors: ValidationIssue[] = [];
    if (!v || typeof v !== 'object') errors.push({ path: '/', message: 'document must be an object' });
    else { if (typeof v.toolId !== 'string') errors.push({ path: '/toolId', message: 'must be a string' }); if (!Array.isArray(v.model)) errors.push({ path: '/model', message: 'must be an array' }); if (typeof v.hydrated !== 'string') errors.push({ path: '/hydrated', message: 'must be a string' }); }
    return { ok: !errors.length, errors, warnings: [] };
  }
  const known = new Set((target.manifest.inputs ?? []).map((i) => i.id));
  const errors = Object.keys(target.value).filter((k) => !known.has(k)).map((k) => ({ path: `/${k}`, message: 'unknown input' }));
  for (const input of target.manifest.inputs ?? []) {
    const value = target.value[input.id];
    if (value === undefined) {
      if ((input as InputSpec & { required?: boolean }).required) errors.push({ path: `/${input.id}`, message: 'is required' });
      continue;
    }
    validateInputValue(input, value, `/${input.id}`, errors);
  }
  return { ok: !errors.length, errors, warnings: [] };
}
const valid = (): DocumentValidationResult => ({ ok: true, errors: [], warnings: [] });
const invalid = (path: string, e: unknown): DocumentValidationResult => ({ ok: false, errors: [{ path, message: e instanceof Error ? e.message : String(e) }], warnings: [] });

export function documentSchema(tool: LoadedTool | ToolManifest): Record<string, unknown> {
  const manifest = 'manifest' in tool ? tool.manifest : tool; const properties: Record<string, unknown> = {}; const required: string[] = [];
  for (const input of manifest.inputs ?? []) { properties[input.id] = inputSchema(input); if ((input as InputSpec & { required?: boolean }).required) required.push(input.id); }
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', title: manifest.name, type: 'object', properties, additionalProperties: false, ...(required.length ? { required } : {}) };
}
function inputSchema(input: InputSpec): Record<string, unknown> {
  const base = { title: input.label ?? input.id, ...(input.help ? { description: input.help } : {}) };
  if (input.type === 'number') return { ...base, type: 'number', ...(input.min !== undefined ? { minimum: input.min } : {}), ...(input.max !== undefined ? { maximum: input.max } : {}), ...(input.default !== undefined ? { default: input.default } : {}) };
  if (input.type === 'boolean') return { ...base, type: 'boolean' };
  if (input.type === 'blocks') {
    const fields = (input.fields ?? []).map((field) => ({ ...field, type: field.type ?? 'text', label: field.label ?? field.id })) as InputSpec[];
    return { ...base, type: 'array', items: { type: 'object', properties: Object.fromEntries(fields.map((field) => [field.id, inputSchema(field)])), additionalProperties: false } };
  }
  if (input.type === 'vector') return { ...base, type: 'object', properties: Object.fromEntries((input.fields ?? []).map((field) => [field.id, { type: 'number', ...(field.min !== undefined ? { minimum: field.min } : {}), ...(field.max !== undefined ? { maximum: field.max } : {}) }])), additionalProperties: false };
  if (input.type === 'table') return { ...base, type: 'object', required: ['columns', 'rows'], properties: { columns: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, additionalProperties: false };
  if (input.type === 'asset') return { ...base, anyOf: [{ type: 'string', description: 'Catalog id, URL, or provider:// reference' }, { type: 'object' }, { type: 'null' }] };
  if (input.type === 'file') return { ...base, anyOf: [{ type: 'object' }, ...(input.multiple ? [{ type: 'array', items: { type: 'object' } }] : []), { type: 'null' }] };
  if (input.type === 'color') return { ...base, anyOf: [{ type: 'string' }, { type: 'object', properties: { ref: { type: 'string' }, value: { type: 'string' } }, required: ['ref'], additionalProperties: false }], ...(input.default !== undefined ? { default: input.default } : {}) };
  return { ...base, type: 'string', ...(input.default !== undefined ? { default: input.default } : {}), ...(input.minLength !== undefined ? { minLength: input.minLength } : {}), ...(input.maxLength !== undefined ? { maxLength: input.maxLength } : {}), ...(input.pattern ? { pattern: input.pattern } : {}), ...(input.options?.length ? { enum: input.options.map((o) => o.value) } : {}) };
}

function validateInputValue(input: InputSpec, value: unknown, path: string, errors: ValidationIssue[]): void {
  const object = Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const expected = input.type === 'number' ? 'number' : input.type === 'boolean' ? 'boolean' : input.type === 'blocks' ? 'array' : input.type === 'table' || input.type === 'vector' ? 'object' : input.type === 'asset' ? 'asset' : input.type === 'file' ? 'file' : input.type === 'color' ? 'color' : 'string';
  const matches = expected === 'array' ? Array.isArray(value)
    : expected === 'object' ? object
    : expected === 'asset' ? value === null || typeof value === 'string' || object
    : expected === 'file' ? value === null || object || (input.multiple === true && Array.isArray(value))
    : expected === 'color' ? typeof value === 'string' || object
    : typeof value === expected;
  if (!matches) { errors.push({ path, message: `must be ${expected}` }); return; }
  if (typeof value === 'number') {
    if (input.min !== undefined && value < input.min) errors.push({ path, message: `must be >= ${input.min}` });
    if (input.max !== undefined && value > input.max) errors.push({ path, message: `must be <= ${input.max}` });
  }
  if (typeof value === 'string') {
    if (input.minLength !== undefined && value.length < input.minLength) errors.push({ path, message: `must contain at least ${input.minLength} characters` });
    if (input.maxLength !== undefined && value.length > input.maxLength) errors.push({ path, message: `must contain at most ${input.maxLength} characters` });
    if (input.pattern) { try { if (!new RegExp(input.pattern).test(value)) errors.push({ path, message: `must match ${input.pattern}` }); } catch { errors.push({ path, message: 'manifest pattern is invalid' }); } }
    if (input.options?.length && !input.options.some((option) => option.value === value)) errors.push({ path, message: 'must be one of the declared options' });
  }
  if (input.type === 'blocks' && Array.isArray(value)) {
    const fields = new Map((input.fields ?? []).map((field) => [field.id, { ...field, type: field.type ?? 'text' } as InputSpec]));
    value.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) { errors.push({ path: `${path}/${index}`, message: 'must be an object' }); return; }
      for (const [key, item] of Object.entries(row)) {
        const field = fields.get(key);
        if (!field) errors.push({ path: `${path}/${index}/${key}`, message: 'unknown field' });
        else validateInputValue(field, item, `${path}/${index}/${key}`, errors);
      }
    });
  }
}

export interface DocumentInspection { toolId: string; toolVersion: string; inputs: string[]; assets: string[]; bytes: number; designVersion?: string }
export interface BytesInspection { bytes: number; metadata: ReturnType<typeof extractFileMetadata> }
export function inspectDocument(doc: CompiledDocument): DocumentInspection;
export function inspectDocument(doc: Uint8Array): BytesInspection;
export function inspectDocument(doc: CompiledDocument | Uint8Array): DocumentInspection | BytesInspection {
  if (doc instanceof Uint8Array) return { bytes: doc.byteLength, metadata: extractFileMetadata(doc) };
  const assets = doc.model.flatMap(collectModelAssetIds); return { toolId: doc.toolId, toolVersion: doc.toolVersion, inputs: doc.model.map((i) => i.id), assets: [...new Set(assets)].sort(), bytes: new TextEncoder().encode(doc.hydrated).byteLength, ...(doc.designVersion ? { designVersion: doc.designVersion } : {}) };
}
function assetIds(value: unknown): string[] { if (typeof value === 'string') return [value]; if (!value || typeof value !== 'object') return []; if ('id' in value && typeof (value as { id?: unknown }).id === 'string') return [(value as { id: string }).id]; return []; }
function collectModelAssetIds(input: InputModelItem): string[] {
  if (input.type === 'asset') return assetIds(input.value);
  if (input.type !== 'blocks' || !Array.isArray(input.value)) return [];
  const fields = (input.fields ?? []).filter((field) => field.type === 'asset');
  return input.value.flatMap((row) => row && typeof row === 'object' && !Array.isArray(row) ? fields.flatMap((field) => assetIds((row as Record<string, unknown>)[field.id])) : []);
}

export interface ChangeSet { added: string[]; changed: string[]; removed: string[] }
export interface DocumentDiff { inputs: ChangeSet; boxes: ChangeSet; tokens: ChangeSet; assets: ChangeSet; designVersion: ChangeSet }
export function diffDocuments(a: CompiledDocument | string, b: CompiledDocument | string): DocumentDiff {
  if (typeof a === 'string' && typeof b === 'string') return { inputs: diffRecords(params(a), params(b)), boxes: empty(), tokens: empty(), assets: empty(), designVersion: empty() };
  if (typeof a === 'string' || typeof b === 'string') throw new TypeError('diff operands must have the same kind');
  return { inputs: diffRecords(a.values, b.values), boxes: diffRecords(ids(a.hydrated), ids(b.hydrated)), tokens: diffRecords(tokenValues(a), tokenValues(b)), assets: diffRecords(asSet(inspectDocument(a).assets), asSet(inspectDocument(b).assets)), designVersion: diffRecords(a.designVersion ? { version: a.designVersion } : {}, b.designVersion ? { version: b.designVersion } : {}) };
}
const empty = (): ChangeSet => ({ added: [], changed: [], removed: [] });
const params = (s: string): Record<string, unknown> => Object.fromEntries(new URLSearchParams(s.replace(/^.*\?/, '')));
const ids = (s: string): Record<string, unknown> => Object.fromEntries([...s.matchAll(/<[^>]+\bid=["']([^"']+)["'][^>]*>/g)].map((m) => [m[1]!, m[0]!.replace(/\s+/g, ' ')]));
const asSet = (a: string[]): Record<string, unknown> => Object.fromEntries(a.map((x) => [x, true]));
const tokenValues = (doc: CompiledDocument): Record<string, unknown> => {
  const value = doc.tokens;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
};
function tokenValuesFromModel(model: InputModelItem[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && typeof (value as { ref?: unknown }).ref === 'string') {
      out[path] = { ref: (value as { ref: string }).ref, value: (value as { value?: unknown }).value };
      return;
    }
    for (const [key, item] of Object.entries(value)) walk(item, `${path}/${key}`);
  };
  for (const input of model) walk(input.value, input.id);
  return out;
}
function semanticJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(semanticJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${semanticJson(record[key])}`).join(',')}}`;
}
function diffRecords(a: Record<string, unknown>, b: Record<string, unknown>): ChangeSet { const ak = new Set(Object.keys(a)); const bk = new Set(Object.keys(b)); return { added: [...bk].filter((k) => !ak.has(k)).sort(), removed: [...ak].filter((k) => !bk.has(k)).sort(), changed: [...ak].filter((k) => bk.has(k) && semanticJson(a[k]) !== semanticJson(b[k])).sort() }; }

export interface DocumentMeasurement { width: number; height: number; unit: string; dpi: number; boxes: number; assets: Array<{ id: string; bytes?: number }>; bytes: number; assetBytes: number; gamut?: string }
export function measureDocument(doc: CompiledDocument, opts: { width?: number | string; height?: number | string; unit?: string; dpi?: number; gamut?: string } = {}): DocumentMeasurement {
  const dpi = opts.dpi ?? 96; const unit = opts.unit ?? 'px'; const info = inspectDocument(doc);
  const pixels = (value: number | string): number => { const dim = parseDimension(value, unit); return dim ? toPixels(dim, dpi) : 0; };
  const weights = new Map<string, number>();
  for (const input of doc.model) collectModelAssetWeights(input, weights);
  const assets = info.assets.map((id) => weights.has(id) ? { id, bytes: weights.get(id)! } : { id });
  return { width: pixels(opts.width ?? doc.manifest.render.width ?? 0), height: pixels(opts.height ?? doc.manifest.render.height ?? 0), unit, dpi, boxes: Object.keys(ids(doc.hydrated)).length, assets, bytes: info.bytes, assetBytes: [...weights.values()].reduce((sum, n) => sum + n, 0), ...(opts.gamut ? { gamut: opts.gamut } : {}) };
}
function collectModelAssetWeights(input: InputModelItem, out: Map<string, number>): void {
  const weigh = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const ref = value as { id?: unknown; url?: unknown; meta?: { bytes?: unknown } };
    if (typeof ref.id !== 'string') return;
    let bytes = typeof ref.meta?.bytes === 'number' ? ref.meta.bytes : undefined;
    if (bytes === undefined && typeof ref.url === 'string') {
      const match = /^data:[^,]*;base64,(.*)$/s.exec(ref.url);
      if (match) bytes = Math.floor(match[1]!.length * 3 / 4) - (match[1]!.endsWith('==') ? 2 : match[1]!.endsWith('=') ? 1 : 0);
    }
    if (bytes !== undefined) out.set(ref.id, bytes);
  };
  if (input.type === 'asset') weigh(input.value);
  else if (input.type === 'blocks' && Array.isArray(input.value)) {
    const fields = (input.fields ?? []).filter((field) => field.type === 'asset');
    for (const row of input.value) if (row && typeof row === 'object' && !Array.isArray(row)) for (const field of fields) weigh((row as Record<string, unknown>)[field.id]);
  }
}

export interface OptimizeStage<T> { name: string; transform(value: T): T | Promise<T> }
export async function optimizeDocument<T>(value: T, opts: { stages?: OptimizeStage<T>[]; format?: 'jpeg' | 'png' | 'svg'; strip?: boolean } = {}): Promise<{ value: T; savedBytes: number; stages: string[] }> {
  const before = byteLength(value); let current = value; const ran: string[] = [];
  const stages = [...(opts.stages ?? [])];
  if (value instanceof Uint8Array && opts.format && opts.strip !== false) stages.unshift({ name: 'strip-metadata', transform: (bytes) => stripMetadata(bytes as Uint8Array, opts.format!) as T });
  for (const stage of stages) { current = await stage.transform(current); ran.push(stage.name); }
  return { value: current, savedBytes: Math.max(0, before - byteLength(current)), stages: ran };
}
const byteLength = (v: unknown): number => v instanceof Uint8Array ? v.byteLength : new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v)).byteLength;
export async function packageDocument(input: unknown, opts: { kind?: 'lolly' | 'brand' | 'instance'; writer?: (input: unknown) => Uint8Array | Promise<Uint8Array> } = {}): Promise<{ bytes: Uint8Array; manifest: Record<string, unknown> }> {
  const kind = opts.kind ?? 'lolly';
  if (opts.writer) return { bytes: await opts.writer(input), manifest: { apiVersion: DOCUMENT_API_VERSION, kind } };
  if (kind !== 'lolly') throw new Error(`${kind} packaging requires the shell's existing pack writer`);
  const doc = input as Partial<CompiledDocument> | null;
  const manifest = {
    format: 'lolly-share', formatVersion: 1, minReader: 1, app: `Lolly engine ${DOCUMENT_API_VERSION}`,
    kind: 'session', tool: { id: doc?.toolId ?? 'document', ...(doc?.toolVersion ? { version: doc.toolVersion } : {}) },
    exportedAt: new Date().toISOString(), counts: { assets: 0, byReference: doc ? inspectDocument(doc as CompiledDocument).assets.length : 0, bytes: 0 }, creator: null, assets: [], documentApiVersion: DOCUMENT_API_VERSION,
  };
  const encode = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const bytes = storeZip([{ name: 'session.json', bytes: encode(input ?? null) }, { name: 'manifest.json', bytes: encode(manifest) }, { name: 'README.txt', bytes: encode('Lolly share file. Open it with Lolly.\n') }]);
  return { bytes, manifest };
}
export async function renderDocument<T>(render: () => Promise<T>): Promise<T> { return render(); }

// Short verb spellings are the transport-neutral public vocabulary. The longer
// names remain for discoverability and backwards compatibility with the first
// plan-189 prerelease.
export { compileDocument as compile, validateDocument as validate, inspectDocument as inspect, diffDocuments as diff, measureDocument as measure, optimizeDocument as optimize, packageDocument as package, renderDocument as render };
