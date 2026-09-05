// SPDX-License-Identifier: MPL-2.0

/**
 * Cross-check the human parser inventory against an owned, expiring assurance
 * register and the fuzz harness's actual ALL_TARGETS list.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ParserWaiver {
  owner: string;
  expires: string;
  reason: string;
}

export interface ParserAssuranceEntry {
  fuzzTargets?: string[];
  waiver?: ParserWaiver;
  details: ParserInventoryDetails;
}

export interface ParserInventoryDetails {
  inputSource: string;
  bounds: string;
  directTests: string;
  fuzzCoverage: string;
  notes: string;
}

export interface ParserAssuranceRegistry {
  version: 1;
  inventory: 'docs/parser-inventory.md';
  parsers: Record<string, ParserAssuranceEntry>;
}

export interface InventoryEntry {
  id: string;
  source: string;
  fuzzTargets: string[];
  details: ParserInventoryDetails;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function markdownCells(line: string): string[] {
  // A table cell can contain an escaped pipe (the PPTX Record<...> type does).
  const escapedPipe = '\u0000escaped-pipe\u0000';
  return line
    .replaceAll('\\|', escapedPipe)
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.replaceAll(escapedPipe, '|').trim());
}

export function registeredFuzzTargets(source: string): Set<string> {
  const names = new Map<string, string>();
  for (const match of source.matchAll(/export const\s+(\w+Target):\s*FuzzTarget\s*=\s*\{\s*name:\s*'([^']+)'/g)) {
    names.set(match[1]!, match[2]!);
  }
  const list = source.match(/export const\s+ALL_TARGETS:\s*FuzzTarget\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!list) throw new Error('tests/fuzz/targets.ts has no readable ALL_TARGETS declaration');
  const targets = new Set<string>();
  for (const match of list[1]!.matchAll(/\b(\w+Target)\b/g)) {
    const name = names.get(match[1]!);
    if (!name) throw new Error(`ALL_TARGETS references ${match[1]} without a named FuzzTarget declaration`);
    targets.add(name);
  }
  if (targets.size !== [...list[1]!.matchAll(/\b(\w+Target)\b/g)].length) {
    throw new Error('ALL_TARGETS contains a duplicate target');
  }
  return targets;
}

export function parseParserInventory(markdown: string, availableTargets: Set<string>): InventoryEntry[] {
  const section = markdown.split('## The parsers\n')[1]?.split('\n## ')[0];
  if (!section) throw new Error('docs/parser-inventory.md has no "The parsers" table');
  const entries: InventoryEntry[] = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = markdownCells(line);
    if (cells.length !== 6) throw new Error(`malformed parser inventory row: ${line.slice(0, 100)}`);
    const id = cells[0]!.replaceAll('`', '');
    const source = id.split(' (', 1)[0]!;
    const fuzzTargets = cells[4]!.startsWith('none')
      ? []
      : [...cells[4]!.matchAll(/`([^`]+)`/g)]
        .map((match) => match[1]!)
        .filter((name) => availableTargets.has(name));
    entries.push({
      id,
      source,
      fuzzTargets: [...new Set(fuzzTargets)].sort(),
      details: {
        inputSource: cells[1]!,
        bounds: cells[2]!,
        directTests: cells[3]!,
        fuzzCoverage: cells[4]!,
        notes: cells[5]!,
      },
    });
  }
  if (!entries.length) throw new Error('parser inventory table is empty');
  return entries;
}

export function validateParserAssurance(options: {
  inventoryMarkdown: string;
  fuzzSource: string;
  registry: ParserAssuranceRegistry;
  sourceExists?: (source: string) => boolean;
  now?: Date;
}): string[] {
  const errors: string[] = [];
  const targets = registeredFuzzTargets(options.fuzzSource);
  const inventory = parseParserInventory(options.inventoryMarkdown, targets);
  const inventoryIds = new Set(inventory.map((entry) => entry.id));
  const registryIds = new Set(Object.keys(options.registry.parsers));
  if (options.registry.version !== 1) errors.push(`unsupported registry version ${String(options.registry.version)}`);
  if (options.registry.inventory !== 'docs/parser-inventory.md') errors.push('registry inventory path is not canonical');

  for (const entry of inventory) {
    if (options.sourceExists && !options.sourceExists(entry.source)) errors.push(`${entry.id}: source does not exist`);
    const assurance = options.registry.parsers[entry.id];
    if (!assurance) {
      errors.push(`${entry.id}: missing from security/parser-assurance.json`);
      continue;
    }
    const declared = [...new Set(assurance.fuzzTargets ?? [])].sort();
    if (declared.join('\0') !== entry.fuzzTargets.join('\0')) {
      errors.push(
        `${entry.id}: fuzz mapping drift (inventory: ${entry.fuzzTargets.join(', ') || 'none'}; register: ${declared.join(', ') || 'none'})`,
      );
    }
    for (const target of declared) if (!targets.has(target)) errors.push(`${entry.id}: unknown fuzz target ${target}`);
    for (const field of ['inputSource', 'bounds', 'directTests', 'fuzzCoverage', 'notes'] as const) {
      if (!assurance.details?.[field]?.trim()) {
        errors.push(`${entry.id}: registry has no ${field} detail`);
      } else if (assurance.details[field] !== entry.details[field]) {
        errors.push(`${entry.id}: generated ${field} detail drift`);
      }
    }

    if (declared.length) {
      if (assurance.waiver) errors.push(`${entry.id}: fuzzed parser must not retain a waiver`);
      continue;
    }
    const waiver = assurance.waiver;
    if (!waiver) {
      errors.push(`${entry.id}: unfuzzed parser needs an owned, expiring waiver`);
      continue;
    }
    if (waiver.owner.trim().length < 2) errors.push(`${entry.id}: waiver has no owner`);
    if (waiver.reason.trim().length < 20) errors.push(`${entry.id}: waiver reason is not actionable`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(waiver.expires)) {
      errors.push(`${entry.id}: waiver expiry must be YYYY-MM-DD`);
    } else {
      const expiry = Date.parse(`${waiver.expires}T23:59:59Z`);
      if (!Number.isFinite(expiry) || expiry < (options.now ?? new Date()).getTime()) {
        errors.push(`${entry.id}: waiver expired on ${waiver.expires}`);
      }
    }
  }
  for (const id of registryIds) if (!inventoryIds.has(id)) errors.push(`${id}: stale registry entry is not in the parser inventory`);
  return errors;
}

function main(): void {
  const inventoryPath = path.join(repoRoot, 'docs', 'parser-inventory.md');
  const fuzzPath = path.join(repoRoot, 'tests', 'fuzz', 'targets.ts');
  const registryPath = path.join(repoRoot, 'security', 'parser-assurance.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as ParserAssuranceRegistry;
  const errors = validateParserAssurance({
    inventoryMarkdown: readFileSync(inventoryPath, 'utf8'),
    fuzzSource: readFileSync(fuzzPath, 'utf8'),
    registry,
    sourceExists: (source) => existsSync(path.join(repoRoot, source)),
  });
  if (errors.length) throw new Error(`Parser assurance failed:\n- ${errors.join('\n- ')}`);
  const inventory = parseParserInventory(readFileSync(inventoryPath, 'utf8'), registeredFuzzTargets(readFileSync(fuzzPath, 'utf8')));
  const fuzzed = inventory.filter((entry) => entry.fuzzTargets.length).length;
  console.log(`Parser assurance passed (${inventory.length} parsers: ${fuzzed} fuzzed, ${inventory.length - fuzzed} owned waivers).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
