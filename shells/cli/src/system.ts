// SPDX-License-Identifier: MPL-2.0
/** Human and machine entry points for the shared terminal design-system store. */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import {
  assembleTokenSetFiles, coerceTokensDoc, createTokenSet, deriveBrandTokens,
  extractPenpotProject, extractSvgColors, readZip, summarizeTokensDoc,
} from '@lolly/engine';
import {
  activateNodeDesignSystem, activeNodeDesignSystem, addNodeDesignResources,
  createNodeDesignSystem, exportActiveDesignSystem, listNodeDesignSystems, markNodeStartSeen,
  writeNodeDesignSystemTokens,
} from '@lolly-tools/node-shell/design-systems';
import type { NodeDesignSystem } from '@lolly-tools/node-shell/design-systems';
import { resolveStateDir } from '@lolly-tools/node-shell/state-dir';
import { emitResult } from './envelope.ts';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

export const START_TEXT = `Lolly

Start with what you have. Setup is optional, and each source can be added later.

  One colour       lolly system init --color=#7c3aed --name="My system"
  .lolly or tokens lolly system import ./brand.lolly
  More resources   lolly system add ./logo.svg ./font.woff2
  Explore first    lolly list
  Make something   lolly qr-code --url=https://example.com --output=qr.svg

Design-system commands: lolly system status | list | use | import | add | export
`;

type Flags = Record<string, string>;
type SystemResult = {
  active: NodeDesignSystem | null;
  systems: NodeDesignSystem[];
  stateDir: string;
  summary: { tokens: number; colours: number; themes: number; resources: number } | null;
};

async function statusResult(): Promise<SystemResult> {
  const registry = await listNodeDesignSystems();
  const active = registry.systems.find(s => s.id === registry.active) ?? null;
  let summary: SystemResult['summary'] = null;
  if (active) {
    summary = { tokens: 0, colours: 0, themes: 0, resources: active.resources.length };
    const { readActiveDesignSystemTokens } = await import('@lolly-tools/node-shell/design-systems');
    const doc = await readActiveDesignSystemTokens();
    if (doc) {
      try {
        const s = summarizeTokensDoc(doc);
        summary = { tokens: s.tokenCount, colours: s.colorCount, themes: s.themes.length, resources: active.resources.length };
      } catch { /* the resources-first summary above remains honest */ }
    }
  }
  return { active, systems: registry.systems, stateDir: resolveStateDir().dir, summary };
}

function humanStatus(result: SystemResult): string {
  if (!result.active) return 'No terminal design system is active.\n'
    + 'Start with `lolly system init --color=#7c3aed`, import a .lolly/tokens file, or keep exploring.\n'
    + `State: ${result.stateDir}\n`;
  const s = result.summary;
  return `${result.active.label}  (${result.active.id})\n`
    + `${s?.colours ?? 0} colours · ${s?.tokens ?? 0} tokens · ${s?.themes ?? 0} themes · ${s?.resources ?? 0} resources\n`
    + `Source: ${result.active.source.kind}${result.active.source.name ? ` · ${result.active.source.name}` : ''}\n`
    + `State: ${result.stateDir}\n`
    + `Updated: ${result.active.updatedAt}\n`;
}

async function emit(value: unknown, human: string, json: boolean): Promise<void> {
  if (json) await emitResult(value);
  else await writeOut(human);
}

/** A resources-first workspace is the same system, merely gaining its first
 * token head. Otherwise a new import is a new switchable system. */
async function createOrFill(label: string, tokens: Record<string, unknown>, source: NodeDesignSystem['source']): Promise<NodeDesignSystem> {
  const active = await activeNodeDesignSystem();
  return active && !active.tokensFile
    ? writeNodeDesignSystemTokens({ id: active.id, tokens, source, label })
    : createNodeDesignSystem({ label, tokens, source });
}

type ImportedResource = { name: string; bytes: Uint8Array };

function decodedEntries(bytes: Uint8Array): { files: Record<string, Uint8Array>; manifest: Record<string, unknown> | null } {
  const files: Record<string, Uint8Array> = Object.create(null);
  for (const entry of readZip(bytes)) files[entry.name] = entry.bytes;
  let manifest: Record<string, unknown> | null = null;
  try {
    const raw = files['manifest.json'];
    const parsed: unknown = raw ? JSON.parse(Buffer.from(raw).toString('utf8')) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manifest = parsed as Record<string, unknown>;
  } catch { /* a generic token-set zip does not owe a manifest */ }
  const integrity = manifest?.integrity;
  if (integrity && typeof integrity === 'object' && !Array.isArray(integrity)) {
    for (const [path, expected] of Object.entries(integrity as Record<string, unknown>)) {
      const part = files[path];
      if (!part) throw usageError(`This design-system file is incomplete: ${path} is missing.`, 'CORRUPT_SYSTEM_FILE');
      const actual = `sha256-${createHash('sha256').update(part).digest('base64')}`;
      if (typeof expected !== 'string' || actual !== expected) {
        throw usageError(`This design-system file appears corrupted: ${path} failed its integrity check.`, 'CORRUPT_SYSTEM_FILE');
      }
    }
  }
  return { files, manifest };
}

function parseJsonPart(files: Record<string, Uint8Array>, path: string): unknown | null {
  const raw = files[path];
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw).toString('utf8')); } catch { return null; }
}

function embeddedResources(files: Record<string, Uint8Array>): ImportedResource[] {
  const paths = new Set<string>();
  const resources = parseJsonPart(files, 'resources.json');
  if (Array.isArray(resources)) for (const row of resources) {
    if (row && typeof row === 'object') {
      const path = (row as { archiveFile?: unknown; file?: unknown }).archiveFile
        ?? (row as { file?: unknown }).file;
      if (typeof path === 'string') paths.add(path);
    }
  }
  for (const index of ['fonts.json', 'logos.json']) {
    const rows = parseJsonPart(files, index);
    if (Array.isArray(rows)) for (const row of rows) {
      const path = row && typeof row === 'object' ? (row as { file?: unknown }).file : null;
      if (typeof path === 'string') paths.add(path);
    }
  }
  return [...paths].flatMap(path => files[path] ? [{ name: basename(path), bytes: files[path]! }] : []);
}

function tokensFromArchive(bytes: Uint8Array): { doc: Record<string, unknown>; warnings: string[]; kind: string; resources: ImportedResource[]; label?: string } {
  const { files, manifest } = decodedEntries(bytes);
  const format = typeof manifest?.format === 'string' ? manifest.format : '';
  const label = typeof manifest?.label === 'string' && manifest.label.trim() ? manifest.label.trim() : undefined;
  if (format === 'lolly-brand') {
    const out = coerceTokensDoc(parseJsonPart(files, 'tokens.json'));
    if (!out.doc) throw usageError('This brand .lolly carries no readable tokens.json.', 'NO_TOKENS');
    return { doc: out.doc, warnings: out.warnings, kind: 'lolly-brand', resources: embeddedResources(files), ...(label ? { label } : {}) };
  }
  if (format === 'lolly-share') {
    const out = coerceTokensDoc(parseJsonPart(files, 'design-system.json'));
    if (!out.doc) throw usageError('This shared .lolly has no embedded design system. Open it as a project in the desktop or web app.', 'NO_DESIGN_SYSTEM');
    return { doc: out.doc, warnings: out.warnings, kind: 'lolly-share', resources: [] };
  }
  if (manifest?.type === 'penpot/export-files') {
    const out = extractPenpotProject(files);
    if (!out.doc) throw usageError(`This Penpot file has no readable tokens${out.warnings[0] ? `: ${out.warnings[0]}` : '.'}`, 'NO_TOKENS');
    return { doc: out.doc, warnings: out.warnings, kind: 'penpot', resources: [] };
  }
  const parsed: Record<string, unknown> = Object.create(null);
  for (const [name, raw] of Object.entries(files)) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    try { parsed[name] = JSON.parse(Buffer.from(raw).toString('utf8')); } catch { /* warning comes from the resulting empty set */ }
  }
  const out = assembleTokenSetFiles(parsed);
  if (!out.doc) throw usageError(`This archive has no readable token sets${out.warnings[0] ? `: ${out.warnings[0]}` : '.'}`, 'NO_TOKENS');
  return { doc: out.doc, warnings: out.warnings, kind: 'token-set-files', resources: [] };
}

const MAX_SOURCE_BYTES = 256 * 1024 * 1024;
async function readSource(path: string): Promise<Uint8Array> {
  const info = await stat(path);
  if (!info.isFile()) throw usageError(`${path} is not a file.`, 'BAD_SYSTEM_FILE');
  if (info.size > MAX_SOURCE_BYTES) throw usageError(`${basename(path)} is larger than the 256 MB local import limit.`, 'SYSTEM_FILE_TOO_LARGE');
  return new Uint8Array(await readFile(path));
}

export async function importSystemTokens(path: string): Promise<{ doc: Record<string, unknown>; warnings: string[]; kind: string; bytes: Uint8Array; resources: ImportedResource[]; label?: string }> {
  const bytes = await readSource(path);
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (zip) return { ...tokensFromArchive(bytes), bytes };
  if (extname(path).toLowerCase() === '.svg') {
    const colours = extractSvgColors(Buffer.from(bytes).toString('utf8'));
    if (!colours.length) throw usageError('This SVG contains no readable colour. Add it after starting a system with `lolly system add`.', 'NO_COLOUR');
    return { doc: deriveBrandTokens({ primary: colours[0]!, name: basename(path, extname(path)) }), warnings: [], kind: 'svg', bytes, resources: [] };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch { throw usageError('The import is neither a readable .lolly/archive, SVG, nor JSON token document.', 'BAD_SYSTEM_FILE'); }
  const out = coerceTokensDoc(parsed);
  if (!out.doc) throw usageError(`This JSON has no readable token document${out.warnings[0] ? `: ${out.warnings[0]}` : '.'}`, 'NO_TOKENS');
  return { doc: out.doc, warnings: out.warnings, kind: out.source, bytes, resources: [] };
}

export async function startCli(json = false): Promise<void> {
  const result = await statusResult();
  await markNodeStartSeen();
  if (json) await emitResult({ ...result, choices: ['colour', 'import', 'resources', 'tools'] });
  else await writeOut(`${START_TEXT}\n${humanStatus(result)}`);
}

export async function systemCli(positionals: string[], flags: Flags, json = false): Promise<void> {
  const action = positionals[0] ?? 'status';
  if (action === 'status') {
    const result = await statusResult();
    await emit(result, humanStatus(result), json);
    return;
  }
  if (action === 'list') {
    const result = await statusResult();
    const human = result.systems.length
      ? result.systems.map(s => `${s.id === result.active?.id ? '●' : '○'} ${s.label}  ${s.id}`).join('\n') + '\n'
      : 'No terminal design systems yet.\n';
    await emit(result.systems.map(s => ({ ...s, active: s.id === result.active?.id })), human, json);
    return;
  }
  if (action === 'init') {
    const color = flags.color;
    if (!color || color === '1') throw usageError('usage: lolly system init --color=<css-colour> [--name="My system"]', 'MISSING_ARGUMENT');
    if (flags.name === '1') throw usageError('--name needs a value.', 'MISSING_FLAG_VALUE');
    const current = await activeNodeDesignSystem();
    const label = flags.name || (current && !current.tokensFile ? current.label : 'My design system');
    let doc: Record<string, unknown>;
    try { doc = deriveBrandTokens({ primary: color, name: label }); }
    catch { throw usageError(`Could not read ${JSON.stringify(color)} as a colour. Try #7c3aed, rgb(124 58 237), or oklch(54% .25 293).`, 'BAD_COLOUR'); }
    const record = await createOrFill(label, doc, { kind: 'colour', name: color });
    const result = await statusResult();
    await emit(result, `Created ${record.label} from ${color}. It is active now.\n${humanStatus(result)}`, json);
    return;
  }
  if (action === 'import') {
    const path = positionals[1];
    if (!path) throw usageError('usage: lolly system import <brand.lolly|tokens.json|project.penpot|mark.svg> [--name=…]', 'MISSING_ARGUMENT');
    const imported = await importSystemTokens(path);
    // Validate resolution now; accepting an object that cannot become a token set
    // only moves the error to the first render, where it is much harder to connect.
    createTokenSet(imported.doc);
    if (flags.name === '1') throw usageError('--name needs a value.', 'MISSING_FLAG_VALUE');
    const label = flags.name || imported.label || basename(path, extname(path));
    const record = await createOrFill(label, imported.doc, { kind: 'file', name: basename(path) });
    // A Lolly pack can carry its original fonts/logos/staged references. Restore
    // those individually; a plain JSON/SVG/token zip keeps its source file so no
    // material disappears merely because it was also understood.
    await addNodeDesignResources(imported.resources.length
      ? imported.resources
      : [{ name: basename(path), bytes: imported.bytes }]);
    const result = await statusResult();
    await emit({ ...result, importedAs: imported.kind, warnings: imported.warnings },
      `Imported ${basename(path)} as ${record.label}. It is active now.${imported.warnings.length ? `\n${imported.warnings.map(w => `Note: ${w}`).join('\n')}` : ''}\n${humanStatus(result)}`, json);
    return;
  }
  if (action === 'add') {
    const paths = positionals.slice(1);
    if (!paths.length) throw usageError('usage: lolly system add <logo.svg|font.woff2|reference.pdf…>', 'MISSING_ARGUMENT');
    if (flags.name === '1') throw usageError('--name needs a value.', 'MISSING_FLAG_VALUE');
    const resources = await Promise.all(paths.map(async path => ({ name: basename(path), bytes: await readSource(path) })));
    if (!(await activeNodeDesignSystem())) {
      await createNodeDesignSystem({ label: flags.name && flags.name !== '1' ? flags.name : 'My design system', tokens: null, source: { kind: 'manual' } });
    }
    const record = await addNodeDesignResources(resources);
    const result = await statusResult();
    await emit(result, `Added ${resources.length} resource${resources.length === 1 ? '' : 's'} to ${record.label}.\n${humanStatus(result)}`, json);
    return;
  }
  if (action === 'export') {
    const packed = await exportActiveDesignSystem();
    if (flags.output === '1') throw usageError('--output needs a value.', 'MISSING_FLAG_VALUE');
    const output = flags.output || packed.filename;
    await writeFile(output, packed.bytes);
    const result = await statusResult();
    await emit({ ...result, output, bytes: packed.bytes.byteLength },
      `Exported ${packed.system.label} to ${output} (${packed.bytes.byteLength} bytes).\n`, json);
    return;
  }
  if (action === 'use') {
    const id = positionals[1];
    if (!id) throw usageError('usage: lolly system use <id>', 'MISSING_ARGUMENT');
    const record = await activateNodeDesignSystem(id);
    const result = await statusResult();
    await emit(result, `Now using ${record.label}.\n${humanStatus(result)}`, json);
    return;
  }
  throw usageError(`Unknown system command “${action}”. Use status, list, init, import, add, export, or use.`, 'UNKNOWN_COMMAND');
}
