// SPDX-License-Identifier: MPL-2.0
/**
 * Fixture design systems for docs screenshots (`system=<name>` on a recipe).
 *
 * Captures pin the lolly-demo profile, so a shot of the studio shows whatever Lolly Demo
 * holds today. Two kinds of shot cannot live with that: a room as it first opens, before
 * anything is chosen (Lolly Demo has logos and faces of its own), and colour roles on a
 * system that declares them, which should not change each time a shipped brand changes
 * its words. Such a recipe asks for a fixture instead, and the pipeline installs the
 * fixture as the active design system before the shot's route loads.
 *
 * The fixtures are listed in scripts/data/shot-systems.json: a token file in this
 * repository, the label the system gets, and token groups to leave out. Only public
 * material belongs there, because every shot is published (tests/docs-shot-systems.test.ts).
 */
import { readFileSync } from 'node:fs';
import { join, normalize, relative, isAbsolute } from 'node:path';

export interface ShotSystemEntry {
  /** Repository-relative path to a DTCG token document. */
  file: string;
  /** The design system's name in the studio's bar. */
  label: string;
  /** Dotted token paths to drop before the install, such as `base.asset`. */
  omit?: string[];
  /** One line for the reader of the registry. */
  about?: string;
}

export const SHOT_SYSTEMS_FILE = 'scripts/data/shot-systems.json';

/** The registry, by fixture name. */
export function readShotSystems(root: string): Record<string, ShotSystemEntry> {
  const raw = JSON.parse(readFileSync(join(root, SHOT_SYSTEMS_FILE), 'utf-8')) as { systems?: Record<string, ShotSystemEntry> };
  return raw.systems ?? {};
}

/** A copy of `doc` without the groups at the dotted `paths`. */
export function omitTokenPaths(doc: Record<string, unknown>, paths: readonly string[]): Record<string, unknown> {
  const out = structuredClone(doc);
  for (const path of paths) {
    const keys = path.split('.');
    let node: unknown = out;
    for (const key of keys.slice(0, -1)) {
      node = node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
    }
    if (node && typeof node === 'object') delete (node as Record<string, unknown>)[keys[keys.length - 1]!];
  }
  return out;
}

/**
 * The token document and label a `system=<name>` recipe installs. Throws, listing the
 * fixtures there are, when the name is not listed, and refuses a file outside the
 * repository or in the private brand pack.
 */
export function shotSystem(root: string, name: string): { doc: Record<string, unknown>; label: string } {
  const systems = readShotSystems(root);
  const entry = Object.hasOwn(systems, name) ? systems[name] : undefined;
  if (!entry) throw new Error(`system=${name} is not a fixture design system. Known: ${Object.keys(systems).join(', ')} (${SHOT_SYSTEMS_FILE})`);
  const rel = normalize(entry.file);
  if (isAbsolute(rel) || rel.startsWith('..') || relative('brands/suse', rel).split(/[\\/]/)[0] !== '..') {
    throw new Error(`system=${name}: ${entry.file} must be a public file inside this repository`);
  }
  const doc = JSON.parse(readFileSync(join(root, rel), 'utf-8')) as unknown;
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(`system=${name}: ${entry.file} is not a token document`);
  return { doc: omitTokenPaths(doc as Record<string, unknown>, entry.omit ?? []), label: entry.label };
}
