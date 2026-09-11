// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly validate <artifact> --rebuild <session.lolly>` - the reproducibility receipt.
 *
 * docs/reproducibility.md claims a Lolly artifact is the output of inputs you still hold.
 * This is the command that makes the claim checkable rather than argued: hand it a file
 * and the `.lolly` of the session that made it, and it renders the session again on THIS
 * machine and reports IDENTICAL or DIFFERENT - and, when different, which of the four
 * things that can move actually moved.
 *
 * ── SCOPE, AND WHY IT IS NARROW ──────────────────────────────────────────────
 * Only svg, emf, eps, dxf and csv are eligible. Those are exactly the formats
 * tests/cli-export-golden.test.ts byte-pins across a double render: they come out of the
 * engine's own emitters, so identical inputs give identical bytes. png/jpg/webp/pdf do
 * not, and never will - they are laid out and rasterised by a browser engine whose
 * version is part of the output (docs/determinism.md). Asking for one of those is a
 * refusal (exit 2), not an attempt: a comparison that cannot mean anything must not
 * produce a verdict that looks like it does.
 *
 * Provenance is forced OFF for the rebuild. A Content Credential is signed with a fresh
 * key at a fresh timestamp, so a stamped render is never byte-equal to itself; the same
 * reason the golden fixture renders bare. An SVG's credential block is stripped from the
 * DELIVERED file before comparing, so a stamped artifact still compares.
 *
 * ── THE REASON LADDER ────────────────────────────────────────────────────────
 * A bare "different" is useless, and a guessed reason is worse than none. Every reason
 * below is reported only when the check behind it could actually run, and all applicable
 * ones are listed rather than the first:
 *
 *   engine-version  the artifact's credential names an engine, and it is not this one
 *   tool-version    the tool version recorded in the artifact, the .lolly, and this
 *                   catalog do not agree
 *   font            a face the .lolly's receipt names cannot be resolved here, or
 *                   resolves to a different file
 *   content         the bytes differ and none of the above explains it - with the first
 *                   differing offset, because "somewhere" is not an answer
 */

import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { verifyC2pa, buildInputModel, serializeUrlState, ENGINE_VERSION } from '@lolly/engine';
import type { InputValue } from '../../../engine/src/inputs.ts';
import { readLollyFile, bundledToolFiles, sriSha256, stripSvgC2pa } from '@lolly-tools/node-shell/lolly-file';
import type { LollyFileContents, LollyFont } from '@lolly-tools/node-shell/lolly-file';
import { EXIT, usageError } from './exit-codes.ts';
import { useColor } from './output.ts';
import { loadToolOrThrow, readToolFile, runToolCli } from './run.ts';

/**
 * The formats a rebuild can honestly compare: the engine's own vector and data emitters,
 * proven byte-stable across a double render by tests/cli-export-golden.test.ts.
 */
export const REBUILDABLE_FORMATS = ['svg', 'emf', 'eps', 'dxf', 'csv'] as const;

/** One thing that moved. `code` is the stable machine handle; `detail` is prose. */
export interface RebuildReason {
  code: 'engine-version' | 'tool-version' | 'font' | 'content';
  detail: string;
}

export interface RebuildReport {
  artifact: string;
  session: string;
  format: string;
  tool: { id: string; version?: string };
  identical: boolean;
  bytes: { artifact: number; rebuilt: number };
  reasons: RebuildReason[];
  /** Byte offset of the first difference, after SVG credential stripping. -1 when equal. */
  firstDiff: number;
  /** Assets the session referenced. A rebuild resolves them from THIS machine's catalog,
   *  so a session leaning on carried bytes is a caveat on the comparison, not a reason. */
  assetRefs: number;
}

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

/**
 * Rebuild `artifactPath` from `lollyPath` and report. Returns the exit code:
 * 0 identical, 1 different, 2 the request could not be honoured.
 */
export async function rebuildCli(
  artifactPath: string,
  lollyPath: string,
  { json = false }: { json?: boolean } = {},
): Promise<number> {
  const tty = useColor(process.stdout);
  const paint = (code: string, s: string) => (tty ? code + s + RESET : s);
  const report = await rebuildSession(artifactPath, lollyPath);
  const exit = report.identical ? EXIT.OK : EXIT.FAILED;

  if (json) {
    const { emitResult } = await import('./envelope.ts');
    await emitResult(report, exit);
    return exit;
  }

  const head = report.identical
    ? paint(GREEN, '✓ IDENTICAL') + paint(DIM, ' - rebuilding the session reproduced these bytes exactly')
    : paint(RED, '✕ DIFFERENT') + paint(DIM, ' - rebuilding the session did not reproduce these bytes');
  process.stdout.write(`${paint(BOLD, artifactPath)}${paint(DIM, `  [${report.format}]`)}\n${head}\n`);
  process.stdout.write(paint(DIM, `  session    ${lollyPath} (${report.tool.id}${report.tool.version ? ` ${report.tool.version}` : ''})\n`));
  for (const r of report.reasons) process.stdout.write(`  ${paint(RED, '·')} ${r.code} ${paint(DIM, `- ${r.detail}`)}\n`);
  if (report.assetRefs) {
    process.stdout.write(paint(DIM,
      `  note: the session references ${report.assetRefs} asset(s); a rebuild resolves those from this machine's catalog, ` +
      'not from the copies carried in the .lolly.\n'));
  }
  return exit;
}

/**
 * The comparison itself, with no printing and no exit code - so the tests, and any other
 * surface that wants this answer, read the report rather than scraping stdout.
 */
export async function rebuildSession(artifactPath: string, lollyPath: string): Promise<RebuildReport> {
  const format = extname(artifactPath).replace(/^\./, '').toLowerCase();
  if (!(REBUILDABLE_FORMATS as readonly string[]).includes(format)) {
    // An honest refusal, with the reason and where the reason is written down. A raster
    // or PDF comparison would be a coin flip dressed as a proof.
    throw usageError(
      `--rebuild can only compare the byte-stable formats: ${REBUILDABLE_FORMATS.join(', ')}. ` +
      `"${basename(artifactPath)}" is ${format || 'unrecognised'}. Raster and PDF output is laid out and ` +
      'rasterised by a browser engine, so identical inputs do not give identical bytes across versions ' +
      '(see /info/determinism.html). Nothing was compared.',
      'FORMAT_NOT_REBUILDABLE',
    );
  }

  const artifact = new Uint8Array(await readFile(artifactPath).catch((e: Error) => {
    throw usageError(`cannot read "${artifactPath}" - ${e.message}`, 'INPUT_UNREADABLE');
  }));
  let pack: LollyFileContents;
  try {
    pack = readLollyFile(new Uint8Array(await readFile(lollyPath)));
  } catch (e) {
    throw usageError(`--rebuild: ${(e as Error).message}`, 'LOLLY_UNREADABLE');
  }

  const toolId = pack.manifest.tool.id;
  const bundled = bundledToolFiles(pack);
  // A carried tool renders against ITS OWN files: that is the version the session ran on,
  // and preferring the catalog's copy would silently compare against a different tool.
  const fetchFile = bundled
    ? async (path: string): Promise<string> => {
        const rel = path.startsWith(`${toolId}/`) ? path.slice(toolId.length + 1) : path;
        const bytes = bundled.get(rel);
        if (bytes) return Buffer.from(bytes).toString('utf8');
        return readToolFile(path);
      }
    : undefined;

  const tool = await loadToolOrThrow(toolId, fetchFile ?? readToolFile);
  const { params, assetRefs } = sessionToParams(tool.manifest, pack.session);

  const dir = await mkdtemp(join(tmpdir(), 'lolly-rebuild-'));
  let rebuilt: Uint8Array;
  try {
    const out = join(dir, `rebuild.${format}`);
    await runToolCli({
      toolId,
      // no-provenance is the whole reason this comparison can exist: a credential and the
      // imprint both embed a fresh timestamp.
      params: { ...params, 'no-provenance': '1' },
      outputPath: out,
      format,
      ...(fetchFile ? { fetchFile } : {}),
    });
    rebuilt = new Uint8Array(await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  // SVG only: the delivered file may carry a credential the rebuild deliberately did not
  // write. Strip it from BOTH sides so the comparison is of the document, not the signature.
  const [left, right] = format === 'svg'
    ? [Buffer.from(stripSvgC2pa(Buffer.from(artifact).toString('utf8')), 'utf8'),
       Buffer.from(stripSvgC2pa(Buffer.from(rebuilt).toString('utf8')), 'utf8')]
    : [Buffer.from(artifact), Buffer.from(rebuilt)];

  const identical = left.equals(right);
  const firstDiff = identical ? -1 : firstDifference(left, right);
  const reasons = identical ? [] : await collectReasons(artifact, pack, tool.manifest, left, right, firstDiff, format);

  return {
    artifact: artifactPath,
    session: lollyPath,
    format,
    tool: { id: toolId, ...(pack.manifest.tool.version ? { version: pack.manifest.tool.version } : {}) },
    identical,
    bytes: { artifact: artifact.length, rebuilt: rebuilt.length },
    reasons,
    firstDiff,
    assetRefs,
  };
}

/**
 * Session values → CLI params, through the engine's own serializer.
 *
 * The CLI is URL mode under a different transport, so the honest conversion is the one
 * the app uses: build the input model the session's values imply, then serialise it the
 * way the Share dialog would. Anything hand-rolled here would be a second encoder for
 * blocks, tables, vectors and colours.
 *
 * `__export_*` markers carry the export settings the session was saved with; they map onto
 * the same reserved params a link uses, so a physical-unit render rebuilds at its own size
 * rather than the tool's default.
 */
export function sessionToParams(
  manifest: Parameters<typeof buildInputModel>[0],
  session: Record<string, unknown>,
): { params: Record<string, string>; assetRefs: number } {
  const initial: Record<string, InputValue> = {};
  for (const [k, v] of Object.entries(session)) {
    if (!k.startsWith('__')) initial[k] = v as InputValue;
  }
  // Declared inputs, plus any SYNTHESISED one (transparentBg, convertPaths) the session
  // actually recorded. Serialising the synthetics unconditionally would put a param on
  // every rebuild that the tool never declared, which this shell rightly warns about.
  const declared = new Set((manifest.inputs ?? []).map(i => i.id));
  const model = buildInputModel(manifest, { initial }).filter(i => declared.has(i.id) || i.id in initial);
  const params = Object.fromEntries(new URLSearchParams(serializeUrlState(model)));

  const carry = (marker: string, param: string): void => {
    const v = session[marker];
    if (typeof v === 'string' && v.trim() && v !== '0') params[param] = v.trim();
    else if (typeof v === 'number' && v > 0) params[param] = String(v);
  };
  carry('__export_width', 'width');
  carry('__export_height', 'height');
  carry('__export_dpi', 'dpi');
  const unit = session.__export_unit;
  if (typeof unit === 'string' && unit && unit !== 'px') params.unit = unit;

  // An asset input the session names is resolved from this machine, never from the file.
  const assetRefs = (manifest.inputs ?? []).filter(
    i => i.type === 'asset' && initial[i.id] != null,
  ).length;
  return { params, assetRefs };
}

/**
 * Which of the things that can move actually moved. Every entry is a check that RAN;
 * a field the artifact does not carry produces no reason, because "I could not tell" and
 * "they match" are different answers.
 */
async function collectReasons(
  artifact: Uint8Array,
  pack: LollyFileContents,
  manifest: { version?: string | number },
  left: Buffer,
  right: Buffer,
  firstDiff: number,
  format: string,
): Promise<RebuildReason[]> {
  const reasons: RebuildReason[] = [];

  // (a) the engine. Read off the artifact's own credential, which is the only place the
  // delivered file records what rendered it. Absent for a bare or unstamped file.
  let env: Record<string, unknown> | null = null;
  try {
    const report = await verifyC2pa(artifact, {});
    const declared = report.claim?.generatorInfo?.version;
    if (typeof declared === 'string' && declared && declared !== ENGINE_VERSION) {
      reasons.push({ code: 'engine-version', detail: `the artifact was written by engine ${declared}; this is ${ENGINE_VERSION}` });
    }
    env = (report.environment ?? null) as Record<string, unknown> | null;
  } catch { /* no credential, or a format that carries none - nothing to compare */ }

  // (b) the tool. Three sources, any two of which can disagree: what the artifact
  // recorded, what the .lolly recorded, and what this catalog holds.
  const fromArtifact = typeof env?.toolVersion === 'string' ? env.toolVersion : null;
  const fromPack = pack.manifest.tool.version ?? null;
  const fromCatalog = manifest.version != null ? String(manifest.version) : null;
  const known = [
    ['the artifact', fromArtifact],
    ['the .lolly', fromPack],
    ['this catalog', fromCatalog],
  ].filter((p): p is [string, string] => typeof p[1] === 'string' && p[1] !== '');
  if (new Set(known.map(p => p[1])).size > 1) {
    reasons.push({
      code: 'tool-version',
      detail: `${pack.manifest.tool.id} version disagrees: ${known.map(([who, v]) => `${who} ${v}`).join(', ')}`,
    });
  }

  // (c) fonts. The receipt names source faces by family/weight/style plus the digest of
  // the whole file; a rebuild on a machine with a different file under that name is the
  // classic silent difference.
  for (const font of pack.manifest.fonts ?? []) {
    const reason = await checkFont(font);
    if (reason) reasons.push({ code: 'font', detail: reason });
  }

  // (d) the fallback, and only when nothing above explained it.
  if (!reasons.length) {
    reasons.push({ code: 'content', detail: `the rendered bytes differ from offset ${firstDiff}: ${diffHint(left, right, firstDiff, format)}` });
  }
  return reasons;
}

/** Can this machine produce the same face the receipt names? Null when it can. */
async function checkFont(font: LollyFont): Promise<string | null> {
  const name = `${font.family} ${font.weight}${font.style && font.style !== 'normal' ? ` ${font.style}` : ''}`;
  if (!font.file || !font.sha256) {
    // A face with no source file was drawn from whatever the rendering machine had
    // installed. That is not a difference we can measure, and claiming one would be a
    // reason we did not check.
    return null;
  }
  const local = await readShellFile(font.file);
  if (!local) return `${name} is not present on this machine (the session read it from ${font.file})`;
  if (sriSha256(local) !== font.sha256) return `${name} resolves here to a different file than the session used (${font.file})`;
  return null;
}

/** Read a shell-served font path (`/fonts/…`, `/catalog/…`) off this checkout. */
async function readShellFile(url: string): Promise<Uint8Array | null> {
  if (!url.startsWith('/')) return null;   // an absolute or blob URL is not ours to resolve
  const { repoRoot } = await import('@lolly-tools/node-shell/repo-root');
  const root = repoRoot();
  const candidates = url.startsWith('/catalog/')
    ? [join(root, url.slice(1))]
    : [join(root, 'shells', 'web', 'public', url.slice(1)), join(root, url.slice(1))];
  for (const p of candidates) {
    try { return new Uint8Array(await readFile(p)); } catch { /* try the next */ }
  }
  return null;
}

/** First index at which two buffers differ (or the shorter one's length). */
function firstDifference(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

/** A short, printable look at the divergence, so the offset is actionable. */
function diffHint(a: Buffer, b: Buffer, at: number, format: string): string {
  const from = Math.max(0, at - 20);
  const show = (buf: Buffer): string => {
    const slice = buf.subarray(from, from + 60);
    return format === 'emf'
      ? slice.toString('hex')
      : JSON.stringify(slice.toString('utf8')).slice(1, -1);
  };
  return `delivered "${show(a)}" vs rebuilt "${show(b)}"`;
}
