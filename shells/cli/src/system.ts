// SPDX-License-Identifier: MPL-2.0
/** Human and machine entry points for the shared terminal design-system store. */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../engine/src/canonical-json.ts';
import { basename, extname } from 'node:path';
import {
  assembleTokenSetFiles, coerceTokensDoc, createTokenSet, deriveBrandTokens,
  extractPenpotProject, extractSvgColors, readZip, summarizeTokensDoc,
  inspectTokenDocument, diffTokenDocuments, parseTokenSelection, generateTokenRecipe, mergeTokenDocuments, TOKEN_EXT,
} from '@lolly/engine';
import {
  activateNodeDesignSystem, activeNodeDesignSystem, addNodeDesignResources,
  createNodeDesignSystem, exportActiveDesignSystem, listNodeDesignSystems, markNodeStartSeen,
  writeNodeDesignSystemTokens,
} from '@lolly-tools/node-shell/design-systems';
import type { NodeDesignSystem } from '@lolly-tools/node-shell/design-systems';
import { resolveStateDir } from '@lolly-tools/node-shell/state-dir';
import { contextTokens } from '../../../engine/src/brand-context.ts';
import { checkBrandDesign } from '../../../engine/src/brand-check.ts';
import { brandCheckCatalog, designBrief } from '../../../engine/src/design-brief.ts';
import { checkDesignHouseRules } from '../../../engine/src/design-house-rules.ts';
import { brandSystemOf } from '../../../engine/src/brand-system.ts';
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

Design-system commands: lolly system status | list | use | import | add | export | inspect | diff | generate | sync
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
  const out = coerceTokensDoc(contextTokens(parsed));
  if (!out.doc) throw usageError(`This JSON has no readable token document${out.warnings[0] ? `: ${out.warnings[0]}` : '.'}`, 'NO_TOKENS');
  return { doc: out.doc, warnings: out.warnings, kind: out.source, bytes, resources: [] };
}

export async function startCli(json = false): Promise<void> {
  const result = await statusResult();
  // Machine orientation is read-only. A model asking for `start --json` must not
  // dismiss the human first-launch surface for the next interactive invocation.
  if (!json) await markNodeStartSeen();
  if (json) await emitResult({
    ...result,
    orientation: {
      readOnly: true,
      next: [
        { id: 'make-asset', kind: 'render', tool: 'qr-code', needs: [{ id: 'url', type: 'url' }], example: 'lolly qr-code --url=https://example.com --output=qr.svg' },
        { id: 'use-design-system', kind: 'system', command: ['lolly', 'system', 'init'], needs: [{ id: 'color', type: 'color' }] },
        { id: 'import-design-system', kind: 'system', command: ['lolly', 'system', 'import'], needs: [{ id: 'file', type: 'file' }] },
        { id: 'explore-tools', kind: 'discover', command: ['lolly', 'list', '--json'], needs: [] },
      ],
    },
    choices: ['colour', 'import', 'resources', 'tools'],
  });
  else await writeOut(`${START_TEXT}\n${humanStatus(result)}`);
}

/** Where the brief's token document came from: the `origin` key of `system context` and `system check`. */
export type BriefOrigin = { kind: 'file' } | { kind: 'terminal' } | { kind: 'profile'; profile: string; tokensAsset: string };

/**
 * The `designSystem` key of `system check` and of `lolly check` (CheckReportV1): one
 * shape for both, `{ origin, profile?, tokensAsset? }`.
 */
export function designSystemOf(origin: BriefOrigin): { origin: BriefOrigin['kind']; profile?: string; tokensAsset?: string } {
  return { origin: origin.kind, ...(origin.kind === 'profile' ? { profile: origin.profile, tokensAsset: origin.tokensAsset } : {}) };
}

/**
 * The token document `system context` and `system check` describe, by the render ladder:
 * `--file`, then the active terminal system, then the active content profile's head
 * tokens asset (the same choice the render bridge makes). `sync` and the other
 * token-editing actions never fall back to the profile: they write terminal state.
 */
export async function briefSource(flags: Flags): Promise<{ doc: unknown; origin: BriefOrigin | null; name?: string }> {
  if (flags.file) return { doc: (await importSystemTokens(flags.file)).doc, origin: { kind: 'file' } };
  const { readActiveDesignSystemTokens } = await import('@lolly-tools/node-shell/design-systems');
  const local = await readActiveDesignSystemTokens();
  if (local) return { doc: local, origin: { kind: 'terminal' } };
  const { readProfileTokenDocument } = await import('@lolly-tools/node-shell/design-brief');
  const profile = readProfileTokenDocument();
  if (!profile) return { doc: null, origin: null };
  return {
    doc: profile.doc,
    origin: { kind: 'profile', profile: profile.profile, tokensAsset: profile.tokensAsset },
    ...(profile.label ? { name: profile.label } : {}),
  };
}

export async function systemCli(positionals: string[], flags: Flags, json = false): Promise<void> {
  const action = positionals[0] ?? 'status';
  if (['inspect', 'diff', 'generate', 'sync'].includes(action)) {
    const { readActiveDesignSystemTokens } = await import('@lolly-tools/node-shell/design-systems');
    const initialSystem = flags.file ? null : await activeNodeDesignSystem();
    const local = flags.file ? (await importSystemTokens(flags.file)).doc : await readActiveDesignSystemTokens();
    if (!local) throw usageError('Import a design system or pass --file=tokens.json.', 'NO_TOKENS');
    const opts = { theme: flags.theme, selection: parseTokenSelection(flags._themes) };
    if (action === 'inspect') {
      const report = inspectTokenDocument(local, opts);
      const path = flags.token;
      const result = path ? { ...report, tokens: report.tokens.filter(t => t.path === path) } : report;
      await emit(result, JSON.stringify(result, null, 2) + '\n', json); return;
    }
    let candidate: Record<string, unknown>, conflicts: unknown[] = [];
    if (action === 'generate') {
      if (!flags.recipe) throw usageError('Pass --recipe=recipe.json with a registered recipe.', 'NO_RECIPE');
      candidate = generateTokenRecipe(local, JSON.parse(await readFile(flags.recipe, 'utf8')));
    } else {
      const path = positionals[1];
      if (!path) throw usageError('Pass the incoming token file.', 'NO_INCOMING_SOURCE');
      const incoming = (await importSystemTokens(path)).doc;
      if (action === 'diff') {
        const result = { scope: 'token-document', choices: opts.selection, changes: diffTokenDocuments(local, incoming, opts) };
        await emit(result, JSON.stringify(result, null, 2) + '\n', json); return;
      }
      if (!flags.base || !flags.revision) throw usageError('Sync needs --base=earlier-source.json and --revision=source-release-id.', 'NO_SOURCE_REVISION');
      const base = (await importSystemTokens(flags.base)).doc;
      const merged = mergeTokenDocuments(base, local, incoming); candidate = merged.document; conflicts = merged.conflicts;
      const extensions = (candidate.$extensions ?? {}) as Record<string, unknown>;
      candidate.$extensions = { ...extensions, [TOKEN_EXT]: { ...(extensions[TOKEN_EXT] as object ?? {}), upstream: { kind: 'file', revision: flags.revision, incomingSha256: createHash('sha256').update(canonicalJson(incoming)).digest('hex'), baseSha256: createHash('sha256').update(canonicalJson(base)).digest('hex'), ...(flags.source ? { source: flags.source } : {}) } } };
    }
    const changes = diffTokenDocuments(local, candidate, opts);
    if (flags.output) await writeFile(flags.output, JSON.stringify(candidate, null, 2) + '\n');
    if (flags.apply === '1') {
      if (flags.file) throw usageError('Use --output to save a candidate for an external file. Apply targets the active terminal system.', 'EXTERNAL_SOURCE');
      if (conflicts.length && flags['keep-local'] !== '1') throw usageError('Conflicts retain local values. Review the report, then pass --keep-local to apply that choice.', 'SOURCE_CONFLICTS');
      const active = await activeNodeDesignSystem();
      if (!active) throw usageError('No active terminal system can receive this candidate.', 'NO_TOKENS');
      // Recheck after async file reads so a concurrent system edit cannot be replaced.
      if (active.id !== initialSystem?.id || JSON.stringify(await readActiveDesignSystemTokens()) !== JSON.stringify(local)) throw usageError('The active source changed. Review again.', 'STALE_REVIEW');
      await writeNodeDesignSystemTokens({ id: active.id, tokens: candidate, source: active.source });
    }
    await emit({ scope: 'token-document', applied: flags.apply === '1', conflicts, changes, ...(flags.output ? { output: flags.output } : {}) }, JSON.stringify({ applied: flags.apply === '1', conflicts, changes }, null, 2) + '\n', json); return;
  }
  if (action === 'context' || action === 'check') {
    if (flags.file === '1' || flags.output === '1') throw usageError('--file and --output need a path.', 'MISSING_FLAG_VALUE');
    const { doc, origin, name } = await briefSource(flags);
    if (!doc) throw usageError('No design system is available: no terminal system is active and no content profile answers. Import a system or pass --file=design-context.json.', 'NO_TOKENS');
    // The profile's catalog facts (master, logos, icons, media, asset ids) describe the
    // profile's own design system only: a --file or terminal system gets them only when it
    // is that same token document, so another brand never inherits them.
    const { briefCatalogSummary, readBriefCatalogFor } = await import('@lolly-tools/node-shell/design-brief');
    const catalog = readBriefCatalogFor(origin?.kind, doc);
    const brief = designBrief(doc, catalog, { ...(name ? { name } : {}), theme: flags.theme });
    let result: unknown = { ...brief, origin, catalog: briefCatalogSummary(catalog) };
    if (action === 'check') {
      const path = positionals[1];
      if (!path) throw usageError('usage: lolly system check <design-inputs.json> [--file=design-context.json]', 'MISSING_ARGUMENT');
      const raw: unknown = JSON.parse(Buffer.from(await readSource(path)).toString('utf8'));
      const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      const values = record.values && typeof record.values === 'object' ? record.values as Record<string, unknown> : record;
      const boxes = Array.isArray(raw) ? raw : values.boxes;
      if (!Array.isArray(boxes)) throw usageError('Supply Design input values with a boxes array, or a compiled Design document.', 'NO_COMPOSITION');
      result = {
        ...checkBrandDesign(boxes, doc, { theme: flags.theme, ...brandCheckCatalog(catalog) }),
        // Every rule the brand states goes in, so a rule this build cannot check is listed
        // as unknown rather than silently passing.
        // A document with no frames sits on its canvas background (Design's default when unset).
        houseRules: checkDesignHouseRules(boxes, brandSystemOf(doc)?.rules ?? [], doc, { theme: flags.theme, catalog, background: values.background ?? '{color.semantic.surface}' }),
        designSystem: origin ? designSystemOf(origin) : null,
      };
    }
    const text = JSON.stringify(result, null, 2) + '\n';
    if (flags.output) { await writeFile(flags.output, text); await emit({ output: flags.output }, `Saved ${flags.output}.\n`, json); }
    else if (json) await emitResult(result);
    else await writeOut(text);
    return;
  }
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
  throw usageError(`Unknown system command “${action}”. Use status, list, init, import, add, export, context, check, inspect, diff, generate, sync, or use.`, 'UNKNOWN_COMMAND');
}
