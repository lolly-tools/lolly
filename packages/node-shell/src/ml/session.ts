// SPDX-License-Identifier: MPL-2.0
/**
 * Shared plumbing for the Node on-device ML utilities (plans/183 WS2).
 *
 * The web shell runs these models in a Worker over onnxruntime-web, reading the
 * weights out of IndexedDB. Node has neither, so this module supplies the three
 * pieces every family needs and nothing else:
 *
 *   1. WHERE THE WEIGHTS ARE. One precedence, shared by every family and by the
 *      `lolly models` subcommand: `LOLLY_MODELS_DIR` › the repo's own
 *      `shells/web/public/models` › `~/.cache/lolly/models`. The first candidate
 *      that exists on disk wins; when none does, the repo path is still reported
 *      so a refusal can name a real place.
 *   2. HOW A SESSION IS MADE. onnxruntime-node, CPU execution provider, one
 *      memoised session per file. `LOLLY_ORT_EP=coreml` opts into the CoreML
 *      provider on macOS (opt-in, never a default: it silently changes numeric
 *      output on some graphs, and the CPU path is the one the web shell's WASM
 *      kernels match).
 *   3. HOW PIXELS GET IN AND OUT. sharp decodes to straight-alpha RGBA8 and
 *      encodes back to PNG - the exact `UpscaleFrame`/`MatteFrame`/`OcrFrame`
 *      shape the contract defines, so a Node caller never touches a tensor
 *      either.
 *
 * ATTACHMENT IS CONDITIONAL, exactly like `host.images`: `isOrtAvailable()` and
 * `isSharpAvailable()` are synchronous `require.resolve` probes, and every
 * `createNode*API` returns null when its runtime is missing (a lean install, or
 * the esbuild-bundled Vercel MCP function where bare specifiers stay external).
 * A shell then leaves the member undefined, which is what the contract's
 * feature-detection expects, rather than an API that throws on every call.
 *
 * MODELS ARE NEVER FETCHED HERE. A missing model is a refusal that names the
 * exact `lolly models fetch <family>` command and the download size, so a person
 * decides whether those bytes move. No background downloads, ever.
 */
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { modelsDirCandidates, resolveExistingModelsDir } from '../models-dir.ts';

// ── Where the weights live ───────────────────────────────────────────────────

/** A model family directory name under the models root. */
export type ModelFamily = 'upscale' | 'matte' | 'ocr' | 'ai-detect' | 'reword' | 'depth' | 'embed' | 'kokoro' | 'whisper' | 'trustmark';

// The rungs themselves are in packages/node-shell/src/models-dir.ts, shared with
// `host.speech` and with `lolly models`, so the terminal cannot look for weights
// in one place and write them to another.
export { modelsDirCandidates };

/**
 * The models root for a READ: the first candidate that is a directory, else the
 * repo's own staging path. Never creates anything - resolution is a read, and
 * the download that would fill it is a separate, consented step.
 */
export function resolveModelsDir(env: NodeJS.ProcessEnv = process.env): string {
  return resolveExistingModelsDir(env);
}

/** The directory one family's files sit in (`<root>/<family>`). */
export function familyDir(family: ModelFamily, env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveModelsDir(env), family);
}

/** Absolute path of one file inside a family (`onnx/model.onnx` nests fine). */
export function modelPath(family: ModelFamily, file: string, env: NodeJS.ProcessEnv = process.env): string {
  return join(familyDir(family, env), ...file.split('/'));
}

/** Is one model file on disk right now? Never downloads, never throws. */
export function modelFileExists(family: ModelFamily, file: string, env: NodeJS.ProcessEnv = process.env): boolean {
  try { return statSync(modelPath(family, file, env)).isFile(); } catch { return false; }
}

/** Are all of a model's files on disk? The `cached()` answer for every family. */
export function modelFilesExist(family: ModelFamily, files: readonly string[], env: NodeJS.ProcessEnv = process.env): boolean {
  return files.length > 0 && files.every((f) => modelFileExists(family, f, env));
}

/** Human-readable size for a refusal line. Binary units, one decimal over 1 MB. */
export function formatBytes(bytes: number): string {
  if (!(bytes > 0)) return 'an unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** Thrown when a run is asked for and the weights are not on this machine. */
export class ModelNotInstalledError extends Error {
  readonly family: ModelFamily;
  readonly model: string;
  readonly approxBytes: number;
  constructor(message: string, family: ModelFamily, model: string, approxBytes: number) {
    super(message);
    this.name = 'ModelNotInstalledError';
    this.family = family;
    this.model = model;
    this.approxBytes = approxBytes;
  }
}

/**
 * The one refusal. It names the model, the size of the download, the command
 * that would fetch it and the directory that was searched, so the next step is
 * never a guess. `lolly models fetch` is named in text only: the subcommand is
 * WS1's, and this module must not depend on it.
 */
export function refuseMissing(
  family: ModelFamily, model: string, approxBytes: number, env: NodeJS.ProcessEnv = process.env,
): never {
  throw new ModelNotInstalledError(
    `The ${model} model is not on this machine. Run \`lolly models fetch ${family}\` to download it (${formatBytes(approxBytes)}), `
    + `or point LOLLY_MODELS_DIR at a directory that already has it. Looked in ${familyDir(family, env)}.`,
    family, model, approxBytes,
  );
}

/** A DOMException-shaped AbortError, so `err.name === 'AbortError'` works the
 *  way it does on the web path (Node has DOMException as a global since 17). */
export function abortError(message = 'The run was aborted.'): Error {
  try { return new DOMException(message, 'AbortError'); }
  catch { return Object.assign(new Error(message), { name: 'AbortError' }); }
}

/** Throw promptly when a caller's signal has fired. The only safe preemption
 *  point: an inference already inside ORT cannot be interrupted. */
export function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

// ── onnxruntime-node ─────────────────────────────────────────────────────────

/** The slice of onnxruntime-node this package uses. Typed locally on purpose:
 *  the runtime is optional, so its types must never be a build requirement
 *  (the `SharpLike` idiom from images.ts). */
export interface OrtTensorLike {
  readonly data: unknown;
  readonly dims: readonly number[];
}
export interface OrtSessionLike {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensorLike>>;
  release?(): Promise<void>;
}
export interface OrtLike {
  Tensor: new (type: string, data: Float32Array | Int32Array | BigInt64Array, dims: readonly number[]) => unknown;
  InferenceSession: {
    create(path: string | Uint8Array, opts?: Record<string, unknown>): Promise<OrtSessionLike>;
  };
}

const require_ = createRequire(import.meta.url);

/** Test seam: force the three availability answers, so the conditional-attach
 *  path can be exercised on a machine that HAS the runtimes. Pass null to go
 *  back to real resolution. Nothing in the shipping shells calls this. */
export interface RuntimeProbeOverrides {
  ort?: boolean;
  sharp?: boolean;
  transformers?: boolean;
}
let probeOverrides: RuntimeProbeOverrides | null = null;
export function setRuntimeProbes(overrides: RuntimeProbeOverrides | null): void {
  probeOverrides = overrides;
}

function resolves(specifier: string): boolean {
  try { require_.resolve(specifier); return true; } catch { return false; }
}

/** True when onnxruntime-node is installed and loadable here. Sync + cheap. */
export function isOrtAvailable(): boolean {
  return probeOverrides?.ort ?? resolves('onnxruntime-node');
}

/** True when sharp is installed and loadable here. Sync + cheap. */
export function isSharpAvailable(): boolean {
  return probeOverrides?.sharp ?? resolves('sharp');
}

/** True when transformers.js is installed (the ai-detect + reword tiers). */
export function isTransformersAvailable(): boolean {
  return probeOverrides?.transformers ?? resolves('@huggingface/transformers');
}

let ortModule: Promise<OrtLike> | null = null;
/** Import onnxruntime-node once, lazily. */
export function loadOrt(): Promise<OrtLike> {
  ortModule ??= import('onnxruntime-node').then((m) => ((m as { default?: unknown }).default ?? m) as OrtLike);
  return ortModule;
}

/**
 * The execution providers to ask for. CPU by default because it is what the web
 * shell's WASM kernels match numerically and what every graph on the roster is
 * verified against; `LOLLY_ORT_EP=coreml` prepends CoreML for a person who wants
 * the speed and accepts the difference.
 */
export function executionProviders(env: NodeJS.ProcessEnv = process.env): string[] {
  const want = env.LOLLY_ORT_EP?.trim().toLowerCase();
  if (want === 'coreml') return ['coreml', 'cpu'];
  if (want === 'cuda') return ['cuda', 'cpu'];
  return ['cpu'];
}

/**
 * How many threads one session may use. Unset means onnxruntime's own default
 * (every core). `LOLLY_ORT_THREADS=1` runs each graph on the calling thread with
 * no pool at all: slower, but the cost is predictable on a shared box, and on
 * macOS it avoids an exit-time abort in onnxruntime-node 1.29 where a pool thread
 * outlives the runtime's logging mutex (`recursive_mutex lock failed`). The test
 * suite sets it for exactly that reason. Anything that is not a whole number from
 * 1 to 256 is ignored, so a typo falls back to the default rather than to zero.
 */
export function sessionThreads(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const raw = env.LOLLY_ORT_THREADS?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 256 ? n : undefined;
}

/**
 * The same thread cap, in the shape transformers.js takes on `from_pretrained` and
 * `pipeline` (`session_options` goes straight to onnxruntime). Empty when the knob
 * is unset, so a spread leaves the call as it was.
 */
export function transformersSessionOptions(env: NodeJS.ProcessEnv = process.env): {
  session_options?: { intraOpNumThreads: number; interOpNumThreads: number };
} {
  const threads = sessionThreads(env);
  return threads ? { session_options: { intraOpNumThreads: threads, interOpNumThreads: threads } } : {};
}

const sessions = new Map<string, Promise<OrtSessionLike>>();

/** Load one ONNX file into a memoised session. The path is the cache key, so two
 *  callers of the same model share one resident graph. */
export function createSession(path: string, env: NodeJS.ProcessEnv = process.env): Promise<OrtSessionLike> {
  const threads = sessionThreads(env);
  const key = `${path}\u0000${executionProviders(env).join(',')}|${threads ?? ''}`;
  let entry = sessions.get(key);
  if (entry) return entry;
  entry = (async (): Promise<OrtSessionLike> => {
    const ort = await loadOrt();
    const opts: Record<string, unknown> = { executionProviders: executionProviders(env) };
    if (threads) { opts.intraOpNumThreads = threads; opts.interOpNumThreads = threads; }
    return ort.InferenceSession.create(path, opts);
  })();
  sessions.set(key, entry);
  void entry.catch(() => { sessions.delete(key); });
  return entry;
}

/** Drop every resident session (used by tests and long-lived hosts). */
export async function releaseSessions(): Promise<void> {
  const all = [...sessions.values()];
  sessions.clear();
  for (const p of all) {
    try { await (await p).release?.(); } catch { /* a session that never loaded needs no release */ }
  }
}

/** The first output tensor of a run (every graph on these rosters has one). */
export function firstOutput(out: Record<string, OrtTensorLike>, name?: string): OrtTensorLike {
  const picked = (name ? out[name] : undefined) ?? Object.values(out)[0];
  if (!picked) throw new Error('The model returned no output.');
  return picked;
}

/** A tensor's numeric payload as a Float32Array view (never a copy when it
 *  already is one). Guards the int/double outputs a converted graph can emit. */
export function tensorFloats(t: OrtTensorLike): Float32Array {
  const d = t.data;
  if (d instanceof Float32Array) return d;
  if (ArrayBuffer.isView(d)) {
    const view = d as unknown as ArrayLike<number>;
    const out = new Float32Array(view.length);
    for (let i = 0; i < view.length; i++) out[i] = Number(view[i]);
    return out;
  }
  throw new Error('The model output is not numeric.');
}

// ── Pixels: sharp <-> straight-alpha RGBA8 ───────────────────────────────────

/** The plain pixel frame every ML contract in host-v1 uses. */
export interface RgbaFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, straight alpha, length = width * height * 4. */
  data: Uint8ClampedArray;
}

interface SharpLike {
  metadata(): Promise<{ width?: number; height?: number }>;
  ensureAlpha(): SharpLike;
  raw(): SharpLike;
  resize(opts: Record<string, unknown>): SharpLike;
  png(opts?: Record<string, unknown>): SharpLike;
  toBuffer(opts?: { resolveWithObject?: boolean }): Promise<Buffer | { data: Buffer; info: { width: number; height: number } }>;
}
type SharpFactory = (input?: Buffer | Uint8Array | string, opts?: Record<string, unknown>) => SharpLike;

let sharpModule: Promise<SharpFactory> | null = null;
function loadSharp(): Promise<SharpFactory> {
  sharpModule ??= import('sharp').then((m) => ((m as { default?: unknown }).default ?? m) as unknown as SharpFactory);
  return sharpModule;
}

function asBuffer(input: Uint8Array | Buffer): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

/** Decode any image sharp reads (PNG/JPEG/WebP/AVIF/HEIC/TIFF/GIF) into
 *  straight-alpha RGBA8. Alpha is always present, so a frame's length is exact. */
export async function decodeRgba(input: Uint8Array | Buffer | string): Promise<RgbaFrame> {
  const sharp = await loadSharp();
  const img = typeof input === 'string' ? sharp(input) : sharp(asBuffer(input));
  const res = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = res as { data: Buffer; info: { width: number; height: number } };
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

/** Encode a straight-alpha RGBA8 frame as a PNG. */
export async function encodeRgbaPng(frame: RgbaFrame): Promise<Buffer> {
  const sharp = await loadSharp();
  const buf = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
  const out = await sharp(buf, { raw: { width: frame.width, height: frame.height, channels: 4 } }).png().toBuffer();
  return out as Buffer;
}

/**
 * Resample a frame to an exact width x height. `fit: 'fill'` on purpose: every
 * caller has already decided the geometry (the letterbox plan, the work size,
 * the model's square), so sharp must not re-derive it. `kernel: 'lanczos3'` is
 * the closest match to the browser's high-quality canvas downscale.
 */
export async function resizeRgba(frame: RgbaFrame, width: number, height: number): Promise<RgbaFrame> {
  if (width === frame.width && height === frame.height) return frame;
  const sharp = await loadSharp();
  const buf = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
  const res = await sharp(buf, { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .resize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = res as { data: Buffer; info: { width: number; height: number } };
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

/** Crop a source-pixel rectangle out of a frame and resample it to w x h - the
 *  OCR line crop and the face crop, without a canvas. Clamped to the source. */
export async function cropResizeRgba(
  frame: RgbaFrame, sx: number, sy: number, sw: number, sh: number, width: number, height: number,
): Promise<RgbaFrame> {
  const x = Math.max(0, Math.min(frame.width - 1, Math.round(sx)));
  const y = Math.max(0, Math.min(frame.height - 1, Math.round(sy)));
  const w = Math.max(1, Math.min(frame.width - x, Math.round(sw)));
  const h = Math.max(1, Math.min(frame.height - y, Math.round(sh)));
  const cropped = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * frame.width + x) * 4;
    cropped.set(frame.data.subarray(from, from + w * 4), row * w * 4);
  }
  return resizeRgba({ width: w, height: h, data: cropped }, width, height);
}

/** A blank opaque-black frame of the given size - the letterbox ground. */
export function blackFrame(width: number, height: number): RgbaFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

/** Paste `src` into `dst` at (x, y), clipped to the destination. */
export function pasteFrame(dst: RgbaFrame, src: RgbaFrame, x: number, y: number): void {
  for (let row = 0; row < src.height; row++) {
    const dy = y + row;
    if (dy < 0 || dy >= dst.height) continue;
    const w = Math.min(src.width, dst.width - x);
    if (w <= 0) continue;
    dst.data.set(src.data.subarray(row * src.width * 4, row * src.width * 4 + w * 4), (dy * dst.width + x) * 4);
  }
}

/** Rough usable working-set budget in bytes: a quarter of the machine's RAM.
 *  The Node twin of the web runners' `deviceMemoryGb()` estimate. */
export function deviceMemoryGb(): number {
  try {
    // node:os is already imported for homedir; totalmem answers the RAM question.
    const os = require_('node:os') as { totalmem(): number };
    const gb = os.totalmem() / 1024 ** 3;
    return gb > 0 ? gb : 4;
  } catch { return 4; }
}

/** Does this machine have the ORT runtime AND sharp? The gate every pixel
 *  family's `createNode*API` checks before returning an implementation. */
export function pixelMlAvailable(): boolean {
  return isOrtAvailable() && isSharpAvailable();
}

/** The models root as a diagnostic line, for `--verbose` and refusals. */
export function modelsDirNote(env: NodeJS.ProcessEnv = process.env): string {
  const dir = resolveModelsDir(env);
  return `${dir}${existsSync(dir) ? '' : ' (not present)'}`;
}
