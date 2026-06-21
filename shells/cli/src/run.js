/**
 * CLI runner — the working implementation.
 *
 * Loads a tool from disk, runs the engine against a jsdom DOM, and writes the
 * exported file. This is the SAME engine path the web shell uses; only the
 * host bridge implementation differs. That's the URL-mode-as-CLI principle —
 * CLI is just a different transport, not a different render engine.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTool, createRuntime, parseUrlState } from '@lolly/engine';
import { createCliBridge } from './bridge.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export async function runToolCli({ toolId, params, outputPath, format }) {
  // Lazy import — jsdom is heavy and we only need it when actually rendering.
  const jsdom = await import('jsdom');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  // Expose enough globals for the engine + Handlebars to work happily.
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;

  const fetchFile = async (path) => {
    const full = join(REPO_ROOT, 'tools', path);
    return readFile(full, 'utf8');
  };

  const tool = await loadTool(toolId, fetchFile);
  const host = await createCliBridge({ dom });

  const { values, export: paramExport, width, height, unit, dpi } = parseUrlState(
    new URLSearchParams(params).toString(),
    tool.manifest,
  );
  const targetFormat = format ?? paramExport ?? tool.manifest.render.formats[0];

  if (!tool.manifest.render.formats.includes(targetFormat)) {
    throw new Error(
      `Tool "${toolId}" does not support format "${targetFormat}". ` +
      `Supported: ${tool.manifest.render.formats.join(', ')}`,
    );
  }

  const runtime = await createRuntime(tool, host, values);

  // Set up the rendering DOM.
  const canvas = dom.window.document.getElementById('canvas');
  canvas.innerHTML = runtime.getHydrated();

  // Pass through requested output dimensions. A physical unit (mm/cm/in/pt)
  // qualifies the value so the engine converts it for the format; px is the
  // default. (e.g. --width=210 --height=297 --unit=mm --export=svg → A4.)
  const u = unit || 'px';
  const qual = (v) => (v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
  const exportOpts = { width: qual(width), height: qual(height) };
  if (u !== 'px') exportOpts.dpi = dpi || 300;
  const blob = await runtime.export(canvas, targetFormat, exportOpts);
  const buf = Buffer.from(await blob.arrayBuffer());

  if (outputPath) {
    await writeFile(outputPath, buf);
    process.stderr.write(`✓ Wrote ${buf.length} bytes to ${outputPath}\n`);
  } else {
    process.stdout.write(buf);
  }
}

export async function listToolsCli() {
  const indexPath = join(REPO_ROOT, 'catalog', 'tools', 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  process.stdout.write('Available tools:\n');
  for (const t of index.tools) {
    process.stdout.write(`  ${t.id.padEnd(20)} [${t.status}] ${t.description ?? t.name}\n`);
  }
}

export async function showToolInputsCli(toolId) {
  const fetchFile = async (path) => {
    const full = join(REPO_ROOT, 'tools', path);
    return readFile(full, 'utf8');
  };
  const tool = await loadTool(toolId, fetchFile);
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
