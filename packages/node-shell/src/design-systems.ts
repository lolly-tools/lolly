// SPDX-License-Identifier: MPL-2.0
/**
 * The terminal shells' shared, on-device design-system store.
 *
 * Web keeps the same idea in IndexedDB; Node gets plain, inspectable files under
 * the one shared LOLLY_STATE_DIR. The CLI and TUI both call this module, so a
 * colour started in one is immediately the active token document in the other.
 * Imported source files are retained beside the normalized tokens rather than
 * discarded: a mixed bag of fonts, marks and references can arrive in any order.
 */
import { createHash, randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { storeZip } from '@lolly/engine';
import { resolveStateDir } from './state-dir.ts';

const FORMAT = 1;
const INDEX_FILE = 'design-systems.json';

export interface NodeDesignResource {
  name: string;
  file: string;
  bytes: number;
  addedAt: string;
}

export interface NodeDesignSystem {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  source: { kind: 'colour' | 'file' | 'manual'; name?: string };
  /** Null for a resources-first workspace; renders keep using catalog defaults. */
  tokensFile: string | null;
  resources: NodeDesignResource[];
}

interface Registry {
  format: number;
  active: string | null;
  startSeen: boolean;
  systems: NodeDesignSystem[];
}

const emptyRegistry = (): Registry => ({ format: FORMAT, active: null, startSeen: false, systems: [] });
const rootDir = (): string => join(resolveStateDir().dir, 'design-systems');
const indexPath = (): string => join(resolveStateDir().dir, INDEX_FILE);

function safeRegistry(value: unknown): Registry {
  if (!value || typeof value !== 'object') return emptyRegistry();
  const v = value as Partial<Registry>;
  return {
    format: FORMAT,
    active: typeof v.active === 'string' ? v.active : null,
    startSeen: v.startSeen === true,
    systems: Array.isArray(v.systems)
      ? v.systems.filter((s): s is NodeDesignSystem => !!s && typeof s.id === 'string' && typeof s.label === 'string')
      : [],
  };
}

async function readRegistry(): Promise<Registry> {
  try { return safeRegistry(JSON.parse(await readFile(indexPath(), 'utf8'))); }
  catch { return emptyRegistry(); }
}

async function writeRegistry(registry: Registry): Promise<void> {
  const dir = resolveStateDir().dir;
  await mkdir(dir, { recursive: true });
  const target = indexPath();
  const tmp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(registry, null, 2) + '\n', { mode: 0o600 });
  await rename(tmp, target);
}

const slug = (value: string): string => value.toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design-system';

function nextId(label: string, registry: Registry): string {
  const base = slug(label);
  if (!registry.systems.some(s => s.id === base)) return base;
  let n = 2;
  while (registry.systems.some(s => s.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function listNodeDesignSystems(): Promise<{ active: string | null; systems: NodeDesignSystem[] }> {
  const registry = await readRegistry();
  return { active: registry.active, systems: registry.systems };
}

export async function activeNodeDesignSystem(): Promise<NodeDesignSystem | null> {
  const registry = await readRegistry();
  return registry.systems.find(s => s.id === registry.active) ?? null;
}

export async function readActiveDesignSystemTokens(): Promise<unknown | null> {
  const active = await activeNodeDesignSystem();
  if (!active?.tokensFile) return null;
  try { return JSON.parse(await readFile(join(resolveStateDir().dir, active.tokensFile), 'utf8')); }
  catch { return null; }
}

/** A portable, web-readable brand pack for the active Node-side system.
 * Unknown source material also travels in an additive `resources/` part; Node
 * readers restore it, while older/web readers still load the token head. */
export async function exportActiveDesignSystem(): Promise<{
  bytes: Uint8Array;
  filename: string;
  system: NodeDesignSystem;
}> {
  const system = await activeNodeDesignSystem();
  if (!system) throw new Error('No active design system to export.');
  const tokens = await readActiveDesignSystemTokens();
  if (!tokens) throw new Error('This system only has staged resources. Add a colour or import tokens before exporting it.');

  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
  const entries: Array<{ name: string; bytes: Uint8Array }> = [
    { name: 'tokens.json', bytes: encode(tokens) },
    { name: 'fonts.json', bytes: encode([]) },
    { name: 'logos.json', bytes: encode([]) },
    { name: 'prefs.json', bytes: encode({}) },
  ];
  const resourceRows: Array<NodeDesignResource & { archiveFile: string }> = [];
  for (const resource of system.resources) {
    try {
      const bytes = new Uint8Array(await readFile(join(resolveStateDir().dir, resource.file)));
      const archiveFile = `resources/${resource.name}`;
      entries.push({ name: archiveFile, bytes });
      resourceRows.push({ ...resource, archiveFile });
    } catch { /* a missing staged file cannot make the token pack unexportable */ }
  }
  entries.push({ name: 'resources.json', bytes: encode(resourceRows) });

  const integrity = Object.fromEntries(entries.map(entry => [
    entry.name,
    `sha256-${createHash('sha256').update(entry.bytes).digest('base64')}`,
  ]));
  const manifestEntry = { name: 'manifest.json', bytes: encode({
    format: 'lolly-brand', formatVersion: 3, minReader: 1, app: 'lolly-cli',
    exportedAt: new Date().toISOString(), label: system.label,
    counts: { tokens: true, fontFamilies: 0, fontFiles: 0, logos: 0, prefs: 0, versions: 0, frozen: 0, resources: resourceRows.length },
    integrity,
  }) };
  const readmeEntry = { name: 'lolly.txt', bytes: new TextEncoder().encode(
    `Lolly design system - ${system.label}\n\nOpen this .lolly file in Lolly. It contains the token head and ${resourceRows.length} retained resource${resourceRows.length === 1 ? '' : 's'}.\n`,
  ) };
  const safe = slug(system.label).replace(/(^|-)([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase());
  return {
    // The web intake reads the first entry for an instant, allocation-light
    // preflight. ZIP entry order is otherwise semantically irrelevant.
    bytes: storeZip([manifestEntry, readmeEntry, ...entries]),
    filename: `LollyBrand-${safe || 'MyDesignSystem'}-${new Date().toISOString().slice(0, 10)}.lolly`,
    system,
  };
}

export async function createNodeDesignSystem(input: {
  label: string;
  /** Null starts a resources-first workspace without overriding catalog tokens. */
  tokens: unknown | null;
  source?: NodeDesignSystem['source'];
}): Promise<NodeDesignSystem> {
  const registry = await readRegistry();
  const id = nextId(input.label, registry);
  const now = new Date().toISOString();
  const tokensFile = input.tokens === null ? null : `design-systems/${id}/tokens.json`;
  await mkdir(join(rootDir(), id), { recursive: true });
  if (tokensFile) await writeFile(join(resolveStateDir().dir, tokensFile), JSON.stringify(input.tokens, null, 2) + '\n', { mode: 0o600 });
  const record: NodeDesignSystem = {
    id, label: input.label.trim() || 'My design system', createdAt: now, updatedAt: now,
    source: input.source ?? { kind: 'manual' }, tokensFile, resources: [],
  };
  registry.systems.push(record);
  registry.active = id;
  registry.startSeen = true;
  await writeRegistry(registry);
  return record;
}

/** Give a resources-first workspace its token head without creating a second
 * system. Import/init callers use this only when tokensFile is still null. */
export async function writeNodeDesignSystemTokens(input: {
  id: string;
  tokens: unknown;
  source: NodeDesignSystem['source'];
  label?: string;
}): Promise<NodeDesignSystem> {
  const registry = await readRegistry();
  const record = registry.systems.find(s => s.id === input.id);
  if (!record) throw new Error(`There is no design system “${input.id}”.`);
  const rel = `design-systems/${record.id}/tokens.json`;
  await mkdir(join(rootDir(), record.id), { recursive: true });
  await writeFile(join(resolveStateDir().dir, rel), JSON.stringify(input.tokens, null, 2) + '\n', { mode: 0o600 });
  record.tokensFile = rel;
  record.source = input.source;
  if (input.label) record.label = input.label;
  record.updatedAt = new Date().toISOString();
  registry.active = record.id;
  registry.startSeen = true;
  await writeRegistry(registry);
  return record;
}

export async function activateNodeDesignSystem(id: string): Promise<NodeDesignSystem> {
  const registry = await readRegistry();
  const record = registry.systems.find(s => s.id === id);
  if (!record) throw new Error(`There is no design system “${id}” in ${indexPath()}.`);
  registry.active = id;
  registry.startSeen = true;
  await writeRegistry(registry);
  return record;
}

/** Keep arbitrary material with the active system. It is intentionally not
 * interpreted here; importers normalize what they understand and retain the
 * rest so a font/logo/reference never blocks a colour-first start. */
export async function addNodeDesignResources(
  resources: Array<{ name: string; bytes: Uint8Array }>,
): Promise<NodeDesignSystem> {
  const registry = await readRegistry();
  const record = registry.systems.find(s => s.id === registry.active);
  if (!record) throw new Error('No active design system. Start one with `lolly system init --color=#7c3aed`.');
  const dir = join(rootDir(), record.id, 'resources');
  await mkdir(dir, { recursive: true });
  for (const resource of resources) {
    const clean = basename(resource.name).replace(/[^a-zA-Z0-9._-]+/g, '-') || 'resource';
    let name = clean;
    let n = 2;
    while (record.resources.some(r => r.name === name)) {
      const dot = clean.lastIndexOf('.');
      name = dot > 0 ? `${clean.slice(0, dot)}-${n}${clean.slice(dot)}` : `${clean}-${n}`;
      n += 1;
    }
    const rel = `design-systems/${record.id}/resources/${name}`;
    await writeFile(join(resolveStateDir().dir, rel), resource.bytes, { mode: 0o600 });
    record.resources.push({ name, file: rel, bytes: resource.bytes.byteLength, addedAt: new Date().toISOString() });
  }
  record.updatedAt = new Date().toISOString();
  await writeRegistry(registry);
  return record;
}

export async function nodeStartSeen(): Promise<boolean> { return (await readRegistry()).startSeen; }

export async function markNodeStartSeen(): Promise<void> {
  const registry = await readRegistry();
  if (registry.startSeen) return;
  registry.startSeen = true;
  await writeRegistry(registry);
}
