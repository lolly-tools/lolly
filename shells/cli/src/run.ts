// SPDX-License-Identifier: MPL-2.0
/**
 * CLI runner — the working implementation.
 *
 * Loads a tool from disk, runs the engine against a jsdom DOM, and writes the
 * exported file. This is the SAME engine path the web shell uses; only the
 * host bridge implementation differs. That's the URL-mode-as-CLI principle —
 * CLI is just a different transport, not a different render engine.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadTool, createRuntime, parseUrlState, expandQuery } from '@lolly/engine';
import type { LoadedTool, ToolFetchFile, Profile, RuntimeExportOpts, InputValue, InputFile } from '@lolly/engine';
import { createCliBridge } from './bridge.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export interface RunToolCliOpts {
  toolId: string;
  params: Record<string, string>;
  outputPath?: string;
  format?: string;
}

/** run.ts's own export-opts widening — password rides through to a browser-backed
 *  export bridge (Tauri) that supports PDF; RuntimeExportOpts (the tool-facing
 *  contract) carries no such field since the pure-node CLI never reaches it. */
interface CliExportOpts extends RuntimeExportOpts {
  password?: string;
}

export async function runToolCli(opts: RunToolCliOpts): Promise<void> {
  const { toolId, params, outputPath, format } = opts;
  // Lazy import — jsdom is heavy and we only need it when actually rendering.
  const jsdom = await import('jsdom');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  // Expose enough globals for the engine + Handlebars to work happily. jsdom's
  // DOMWindow is structurally close to but not identical to lib.dom's ambient
  // `Window & typeof globalThis` (it doesn't merge Node's own globals) — this is
  // a deliberate environment shim for third-party libraries that expect
  // `window`/`document`/`Element` to exist, not a real type mismatch.
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;

  const fetchFile: ToolFetchFile = async (path) => {
    const full = join(REPO_ROOT, 'tools', path);
    return readFile(full, 'utf8');
  };
  const resolveModuleUrl = (path: string): string => pathToFileURL(join(REPO_ROOT, 'tools', path)).href;

  const tool = await loadToolOrExit(toolId, fetchFile, resolveModuleUrl);

  // --profile=path.json pre-fills bindToProfile inputs from the user's profile
  // (the bridge serves it via host.profile.get). A missing/invalid file warns
  // and continues with an empty profile, so the render still runs.
  const profile = await readProfile(params.profile);
  const host = await createCliBridge({ dom, profile });

  // Expand a packed `z=…` param back into a plain query first — the CLI is URL mode
  // under a different transport, so a packed share link must run identically here
  // (`brand-tool layout-studio --z=1eJ…`). A no-op for ordinary readable params.
  const query = await expandQuery(new URLSearchParams(params).toString());
  const { values, format: paramFormat, width, height, unit, dpi, password } = parseUrlState(
    query,
    tool.manifest,
  );

  // File-typed inputs arrive as a filesystem path (--photo=./pic.jpg → an
  // {__file, path} ref from parseUrlState). The engine can't read files (it's
  // platform-agnostic), so the CLI loads the bytes here, into the same FileRef
  // shape the web picker produces — before createRuntime sees them.
  for (const input of tool.manifest.inputs ?? []) {
    if (input.type !== 'file') continue;
    const ref = values[input.id];
    const p = filePathRef(ref);
    if (!p) { delete values[input.id]; continue; }
    const abs = resolve(process.cwd(), p);
    const buf = await readFile(abs);
    const file: InputFile = {
      __file: true,
      name: basename(abs),
      mime: mimeForFile(abs),
      size: buf.length,
      bytes: new Uint8Array(buf),
      url: null,
    };
    values[input.id] = file;
  }

  // Transform-path tools (on-device utilities) produce their output via the
  // exportFile hook (bytes in → bytes out), not by rendering a DOM node. They
  // don't use a render format at all — short-circuit before the format checks.
  if (tool.manifest.hooks?.exportFile) {
    const runtime = await createRuntime(tool, host, values);
    const { bytes, filename } = await runtime.exportFile();
    const buf = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const dest = outputPath || (filename ? resolve(process.cwd(), filename) : null);
    if (dest) {
      await writeFile(dest, buf);
      process.stderr.write(`✓ Wrote ${buf.length} bytes to ${dest}\n`);
    } else {
      process.stdout.write(buf);
    }
    return;
  }

  // Format resolution mirrors URL mode: an explicit flag wins (--export= arrives
  // as `format`, --format= as `paramFormat`); otherwise infer it from the
  // --output extension; otherwise fall back to the tool's first declared format.
  const targetFormat =
    format ?? paramFormat ??
    (outputPath ? formatFromOutput(outputPath, tool.manifest.render.formats) : null) ??
    tool.manifest.render.formats[0];

  if (!targetFormat || !tool.manifest.render.formats.includes(targetFormat)) {
    throw new Error(
      `Tool "${toolId}" does not support format "${String(targetFormat)}". ` +
      `Supported: ${tool.manifest.render.formats.join(', ')}`,
    );
  }

  const runtime = await createRuntime(tool, host, values);

  // Set up the rendering DOM.
  const canvas = dom.window.document.getElementById('canvas');
  if (!canvas) throw new Error('CLI DOM setup failed: #canvas not found');
  canvas.innerHTML = runtime.getHydrated();

  // Pass through requested output dimensions. A physical unit (mm/cm/in/pt)
  // qualifies the value so the engine converts it for the format; px is the
  // default. (e.g. --width=210 --height=297 --unit=mm --export=svg → A4.)
  const u = unit || 'px';
  const qual = (v: number | null): string | number | undefined => (v && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
  const exportOpts: CliExportOpts = { width: qual(width), height: qual(height) };
  if (u !== 'px') exportOpts.dpi = dpi || 300;
  // --password= sets the standard PDF's open-password (basic lock). Only the
  // browser-backed export bridge (Tauri-bundled CLI) renders PDF; the pure-Node
  // CLI errors on the pdf format before this is used.
  if (targetFormat === 'pdf' && password) exportOpts.password = password;
  const blob = await runtime.export(canvas, targetFormat, exportOpts);
  const buf = Buffer.from(await blob.arrayBuffer());

  if (outputPath) {
    await writeFile(outputPath, buf);
    process.stderr.write(`✓ Wrote ${buf.length} bytes to ${outputPath}\n`);
  } else {
    process.stdout.write(buf);
  }
}

/** Narrow a parsed file-input value to its `{__file, path}` filesystem-path ref
 *  shape (see engine/src/url-mode.ts's 'file' case), or null for anything else. */
function filePathRef(value: InputValue | undefined): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const path = (value as Record<string, InputValue | undefined>).path;
  return typeof path === 'string' ? path : null;
}

// Load a tool, turning a missing tool dir (ENOENT on tool.json) into a clean
// message instead of leaking the internal absolute path + errno from readFile.
async function loadToolOrExit(toolId: string, fetchFile: ToolFetchFile, resolveModuleUrl: (path: string) => string): Promise<LoadedTool> {
  try {
    return await loadTool(toolId, fetchFile, { resolveModuleUrl });
  } catch (e) {
    if (e instanceof Error) {
      const err: NodeJS.ErrnoException = e;
      if (err.code === 'ENOENT') {
        process.stderr.write(`Tool not found: ${toolId}. Run with no args to list tools.\n`);
        process.exit(1);
      }
    }
    throw e;
  }
}

// Read + parse a --profile=path.json file into a profile object. A missing or
// malformed file is non-fatal: warn and return {} so the render still proceeds.
async function readProfile(profilePath: string | undefined): Promise<Profile> {
  if (!profilePath) return {};
  try {
    const raw = await readFile(resolve(process.cwd(), profilePath), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    // JSON trust boundary: a malformed/foreign profile file just degrades to {}
    // below rather than needing full schema validation here.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Profile) : {};
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Warning: could not load profile "${profilePath}" (${message}); continuing without it.\n`);
    return {};
  }
}

// Infer an export format from an --output filename's extension, but only when it
// names a format the tool actually declares — otherwise return null so the
// caller falls back to formats[0]. (.jpeg normalises to the canonical 'jpg'.)
function formatFromOutput(path: string, formats: string[]): string | null {
  const ext = extname(path).slice(1).toLowerCase();
  if (!ext) return null;
  const norm = ext === 'jpeg' ? 'jpg' : ext;
  return formats.includes(norm) ? norm : null;
}

// Extension → MIME for a file-typed input loaded from disk. The hook can read
// the real bytes; this is the declared type the FileRef carries (best-effort).
function mimeForFile(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.png':  return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif':  return 'image/gif';
    case '.svg':  return 'image/svg+xml';
    case '.heic': return 'image/heic';
    case '.tif': case '.tiff': return 'image/tiff';
    case '.pdf':  return 'application/pdf';
    case '.json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

export async function listToolsCli(): Promise<void> {
  const indexPath = join(REPO_ROOT, 'catalog', 'tools', 'index.json');
  const parsed: unknown = JSON.parse(await readFile(indexPath, 'utf8'));
  // JSON trust boundary: build-catalog-index.ts produced this file to this shape.
  const index = parsed as { tools: { id: string; status: string; description?: string; name: string }[] };
  process.stdout.write('Available tools:\n');
  for (const t of index.tools) {
    process.stdout.write(`  ${t.id.padEnd(20)} [${t.status}] ${t.description ?? t.name}\n`);
  }
}

export async function showToolInputsCli(toolId: string): Promise<void> {
  const fetchFile: ToolFetchFile = async (path) => {
    const full = join(REPO_ROOT, 'tools', path);
    return readFile(full, 'utf8');
  };
  const resolveModuleUrl = (path: string): string => pathToFileURL(join(REPO_ROOT, 'tools', path)).href;
  const tool = await loadToolOrExit(toolId, fetchFile, resolveModuleUrl);
  process.stdout.write(`${tool.manifest.name} (${tool.manifest.id} v${tool.manifest.version})\n`);
  process.stdout.write(`Status: ${tool.manifest.status}\n`);
  process.stdout.write(`Formats: ${tool.manifest.render.formats.join(', ')}\n\n`);
  process.stdout.write(`Inputs:\n`);
  for (const i of tool.manifest.inputs) {
    const req = i.required ? ' [required]' : '';
    const def = i.default !== undefined ? ` (default: ${JSON.stringify(i.default)})` : '';
    process.stdout.write(`  --${i.id}=<${i.type}>${req}${def}\n`);
    if (i.help) process.stdout.write(`      ${i.help}\n`);
  }
  process.stdout.write(`\nUsage:\n  brand-tool ${tool.manifest.id} --some-input=value --output=file.${tool.manifest.render.formats[0]}\n`);
}
