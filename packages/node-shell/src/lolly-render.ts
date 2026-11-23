// SPDX-License-Identifier: MPL-2.0
/**
 * The `lolly-render` Node addon, found if present (plan 371, M3b slice 3).
 *
 * `lolly-render` is the Rust crate in crates/lolly-render that draws a Design page's
 * drawing operations (`DesignDrawPage`) to pixels, or refuses the page with named
 * reasons; crates/lolly-render-node is its Node binding. This module finds a built
 * binding and makes the calls. Nothing here throws: importing the module loads nothing, and a
 * missing or unusable binding is reported as `absent` with the reason, the same shape a
 * refusal has, so a caller falls back to another route without a try block.
 *
 * Where the binding is looked for, in order:
 * - `LOLLY_RENDER_ADDON`: a path to a built binding (`.node`, or the library cargo
 *   writes). When set, only this path is tried, so a test can name an absent one.
 * - the `@lolly-tools/render` package, which picks its platform package itself, as
 *   `@resvg/resvg-js` does. Nothing installs that package yet: it is published to npm
 *   at a release (.github/workflows/publish-lolly-render.yml) and then listed in this
 *   package's optionalDependencies.
 * - a release build in this checkout (`cargo build --release` in crates/lolly-render-node).
 *
 * No route calls this unless `LOLLY_DESIGN_RASTER=lolly-render` asks for it
 * (design-still.ts).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';

/** The environment variable naming a built binding to load instead of looking for one. */
export const LOLLY_RENDER_ADDON_ENV = 'LOLLY_RENDER_ADDON';

/** The envelope the crate reads (crates/lolly-render/src/input.rs). */
export const LOLLY_RENDER_INPUT_FORMAT = 'lolly-render-input';
export const LOLLY_RENDER_INPUT_VERSION = 1;

/** One reason a page was not drawn, with the crate's stable code. `absent` and `unusable` are this module's own. */
export interface LollyRenderRefusal { code: string; id: string; detail: string }

/** A page drawn, or the first reason it was not and every reason in order. */
export type LollyRenderResult =
  | { ok: true; png: Uint8Array }
  | { ok: false; code: string; detail: string; refusals: LollyRenderRefusal[] };

export type LollyRenderRgbaResult =
  | { ok: true; rgba: Uint8Array; width: number; height: number }
  | { ok: false; code: string; detail: string; refusals: LollyRenderRefusal[] };

/** Whether a binding is here, where it came from and the renderer it records. */
export type LollyRenderState =
  | { present: true; from: string; renderer: string }
  | { present: false; reason: string };

/** What the binding returns (crates/lolly-render-node/src/lib.rs `RenderResult`). */
export interface RawResult {
  ok: boolean;
  png?: Uint8Array; rgba?: Uint8Array; width?: number; height?: number;
  code?: string; detail?: string; refusals?: LollyRenderRefusal[];
}

export interface LollyRenderBinding {
  renderer(): string;
  refusalCodes(): string[];
  admit(input: string | Uint8Array): RawResult;
  renderPng(input: string | Uint8Array): RawResult;
  renderRgba(input: string | Uint8Array): RawResult;
  renderPngAsync(input: string | Uint8Array): Promise<RawResult>;
  renderRgbaAsync(input: string | Uint8Array): Promise<RawResult>;
  encodePng(rgba: Uint8Array, width: number, height: number): RawResult;
  encodePngAsync(rgba: Uint8Array, width: number, height: number): Promise<RawResult>;
}

const FUNCTIONS = ['renderer', 'refusalCodes', 'admit', 'renderPng', 'renderRgba', 'renderPngAsync', 'renderRgbaAsync', 'encodePng', 'encodePngAsync'] as const;

/** The library cargo writes for the binding on this platform. */
function cargoLibrary(): string {
  if (process.platform === 'win32') return 'lolly_render_node.dll';
  return process.platform === 'darwin' ? 'liblolly_render_node.dylib' : 'liblolly_render_node.so';
}

/** Checks a loaded module is this binding, so a stray library is reported, not called. */
function asBinding(exports: unknown, from: string): { binding: LollyRenderBinding; renderer: string } | { reason: string } {
  const candidate = exports as Partial<Record<(typeof FUNCTIONS)[number], unknown>> | null;
  const missing = FUNCTIONS.filter((name) => typeof candidate?.[name] !== 'function');
  if (missing.length) return { reason: `${from} is not the lolly-render binding (no ${missing.join(', ')})` };
  let renderer: unknown;
  try { renderer = (candidate as LollyRenderBinding).renderer(); } catch (error) { return { reason: `${from} did not name its renderer (${message(error)})` }; }
  if (typeof renderer !== 'string' || !renderer.startsWith('lolly-render-')) return { reason: `${from} names an unknown renderer (${String(renderer)})` };
  return { binding: candidate as LollyRenderBinding, renderer };
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

/** Loads a library file as a Node addon; any file name works, so cargo's own output loads unrenamed. */
function loadFile(path: string): { binding: LollyRenderBinding; renderer: string } | { reason: string } {
  if (!existsSync(path)) return { reason: `${path} does not exist` };
  const module = { exports: {} as unknown };
  try {
    process.dlopen(module as unknown as NodeJS.Module, path);
  } catch (error) {
    return { reason: `${path} could not be loaded (${message(error)})` };
  }
  return asBinding(module.exports, path);
}

const loaded = new Map<string, { binding: LollyRenderBinding; renderer: string; from: string } | { reason: string }>();

/** Finds the binding once per `LOLLY_RENDER_ADDON` value; never throws. */
function find(env: Record<string, string | undefined>): { binding: LollyRenderBinding; renderer: string; from: string } | { reason: string } {
  const named = env[LOLLY_RENDER_ADDON_ENV]?.trim() ?? '';
  const known = loaded.get(named);
  if (known) return known;
  let found: { binding: LollyRenderBinding; renderer: string; from: string } | { reason: string };
  if (named) {
    const result = loadFile(named);
    found = 'binding' in result ? { ...result, from: named } : { reason: `${LOLLY_RENDER_ADDON_ENV} names a binding that is not usable: ${result.reason}` };
  } else {
    const tried: string[] = [];
    found = { reason: '' };
    try {
      const result = asBinding(createRequire(import.meta.url)('@lolly-tools/render'), '@lolly-tools/render');
      if ('binding' in result) found = { ...result, from: '@lolly-tools/render' };
      else tried.push(result.reason);
    } catch (error) {
      tried.push(`@lolly-tools/render is not installed (${message(error)})`);
    }
    if (!('binding' in found)) {
      let local: string | null = null;
      try { local = join(repoRoot(), 'crates', 'lolly-render-node', 'target', 'release', cargoLibrary()); } catch { /* not a checkout */ }
      const result = local ? loadFile(local) : { reason: 'this is not a Lolly checkout, so there is no local build' };
      if ('binding' in result) found = { ...result, from: local! };
      else tried.push(result.reason);
    }
    if (!('binding' in found)) found = { reason: `the lolly-render addon is not installed here: ${tried.join('; ')}` };
  }
  loaded.set(named, found);
  return found;
}

/** Whether the binding is here. Loads it the first time; never throws. */
export function lollyRenderState(env: Record<string, string | undefined> = process.env): LollyRenderState {
  const found = find(env);
  return 'binding' in found ? { present: true, from: found.from, renderer: found.renderer } : { present: false, reason: found.reason };
}

/**
 * The binding itself, for a caller that needs its synchronous calls (the fuzz harness
 * and the tests), or null when it is absent. Routes use `renderDesignPage`.
 */
export function lollyRenderBinding(env: Record<string, string | undefined> = process.env): LollyRenderBinding | null {
  const found = find(env);
  return 'binding' in found ? found.binding : null;
}

function refusalOf(raw: RawResult | null, fallback: { code: string; detail: string }): { ok: false; code: string; detail: string; refusals: LollyRenderRefusal[] } {
  const refusals = Array.isArray(raw?.refusals) && raw.refusals.length ? raw.refusals.map((r) => ({ code: String(r.code), id: String(r.id ?? ''), detail: String(r.detail ?? '') })) : [{ code: fallback.code, id: '', detail: fallback.detail }];
  return { ok: false, code: refusals[0]!.code, detail: refusals[0]!.detail, refusals };
}

const absent = (reason: string) => refusalOf(null, { code: 'absent', detail: reason });

type Envelope = string | Uint8Array | LollyRenderEnvelope;

function inputOf(envelope: Envelope): string | Uint8Array {
  if (typeof envelope === 'string') return envelope;
  if (envelope instanceof Uint8Array) return Buffer.isBuffer(envelope) ? envelope : Buffer.from(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  return JSON.stringify(envelope);
}

async function call(kind: 'png' | 'rgba', envelope: Envelope, env: Record<string, string | undefined>): Promise<RawResult | { ok: false; code: string; detail: string; refusals: LollyRenderRefusal[] }> {
  const found = find(env);
  if (!('binding' in found)) return absent(found.reason);
  let input: string | Uint8Array;
  try { input = inputOf(envelope); } catch (error) { return refusalOf(null, { code: 'input-json', detail: `the envelope could not be written as JSON (${message(error)})` }); }
  try {
    return await (kind === 'png' ? found.binding.renderPngAsync(input) : found.binding.renderRgbaAsync(input));
  } catch (error) {
    // Only a wrong argument type reaches here; the binding returns every refusal as a value.
    return refusalOf(null, { code: 'unusable', detail: `the binding did not take the envelope (${message(error)})` });
  }
}

/**
 * Draw a page to a PNG with the crate's own encoder (adaptive filters, a pHYs chunk for
 * the output's resolution, nothing else). The work runs on the libuv thread pool.
 */
export async function renderDesignPage(envelope: Envelope, env: Record<string, string | undefined> = process.env): Promise<LollyRenderResult> {
  const raw = await call('png', envelope, env);
  if (raw.ok && 'png' in raw && raw.png instanceof Uint8Array) return { ok: true, png: raw.png };
  return refusalOf(raw.ok ? null : raw as RawResult, { code: 'unusable', detail: 'the binding returned no PNG' });
}

/** Draw a page to straight RGBA8 rows, for a caller that finishes the PNG itself. */
export async function renderDesignPageRgba(envelope: Envelope, env: Record<string, string | undefined> = process.env): Promise<LollyRenderRgbaResult> {
  const raw = await call('rgba', envelope, env);
  if (raw.ok && 'rgba' in raw && raw.rgba instanceof Uint8Array && typeof raw.width === 'number' && typeof raw.height === 'number' && raw.rgba.length === raw.width * raw.height * 4) {
    return { ok: true, rgba: raw.rgba, width: raw.width, height: raw.height };
  }
  return refusalOf(raw.ok ? null : raw as RawResult, { code: 'unusable', detail: 'the binding returned no pixels of the size it named' });
}

/**
 * Straight RGBA8 rows encoded as a PNG by the crate's encoder, with no resolution chunk,
 * on the thread pool: for the route that changes the drawn pixels (the Lolly Imprint)
 * before it finishes the file. Several times quicker than the engine's JavaScript packer
 * on the same pixels (plan 371 evidence). Null when the binding is absent or refuses.
 */
export async function encodeDesignPng(rgba: Uint8Array, width: number, height: number, env: Record<string, string | undefined> = process.env): Promise<Uint8Array | null> {
  const found = find(env);
  if (!('binding' in found)) return null;
  try {
    const raw = await found.binding.encodePngAsync(Buffer.isBuffer(rgba) ? rgba : Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height);
    return raw.ok && raw.png instanceof Uint8Array ? raw.png : null;
  } catch {
    return null;
  }
}

/** The envelope, in the shape the crate's serde types read. `page` is the engine's `DesignDrawPage`. */
export interface LollyRenderEnvelope {
  format: typeof LOLLY_RENDER_INPUT_FORMAT;
  version: typeof LOLLY_RENDER_INPUT_VERSION;
  drawVersion: number;
  output: { width: number; height: number; dpi?: number };
  page: unknown;
  resources: Array<{ ref: string; type: string; data: string }>;
}

/**
 * One compiled page (engine `designPageDrawing`) in the crate's envelope, drawn at
 * `output`: the page's pictures go in as base64 resources under the refs the
 * operations name.
 */
export function lollyRenderEnvelope(
  drawing: { page: { version: number }; pictures: ReadonlyMap<string, { bytes: Uint8Array; mime: string }> },
  output: { width: number; height: number; dpi?: number },
): LollyRenderEnvelope {
  return {
    format: LOLLY_RENDER_INPUT_FORMAT,
    version: LOLLY_RENDER_INPUT_VERSION,
    drawVersion: drawing.page.version,
    output: { width: output.width, height: output.height, ...(output.dpi ? { dpi: output.dpi } : {}) },
    page: drawing.page,
    resources: [...drawing.pictures].map(([ref, picture]) => ({ ref, type: picture.mime, data: Buffer.from(picture.bytes).toString('base64') })),
  };
}
