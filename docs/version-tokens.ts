// SPDX-License-Identifier: MPL-2.0
/**
 * Version tokens: a version number written once and read everywhere the docs state that version.
 *
 *   %work{version}     the Lolly Work release the docs describe (manifest.json workImport.version)
 *   %work{chart}       the Helm chart version of that release (manifest.json workImport.chart)
 *   %download{<id>}    the version of one packaged download, by its docs/site/downloads.json
 *                      tile id (the `version` field on that tile)
 *
 * Work install pages used to name 1.1.1 in 31 places after 1.1.2 shipped, and the install
 * page and the landing's "Get the app" rail each kept their own copy of the per-platform
 * versions. A token is expanded at build time (docs/build.ts, for every locale) and when the
 * Work bundle is generated (scripts/export-work-docs.ts), so a release bump is one edit.
 *
 * Tokens expand everywhere in a page, code blocks included: a version in a `helm install`
 * line drifts exactly like one in prose. An unknown kind or key throws instead of shipping
 * the token as literal text. Pure apart from readVersionFacts, which reads the two files.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOCS_ROOT, readRegistry } from './navigation.ts';

export interface VersionFacts {
  work: { version: string; chart: string };
  /** downloads.json tile id → version, for every tile that states one. */
  downloads: Record<string, string>;
}

/** A release version as the docs state it: 1.1.2, or 1.1.2-rc.1. */
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Every token the docs may carry. Kind and key are kept to plain identifiers. */
export const VERSION_TOKEN = /%(work|download)\{([a-z0-9][a-z0-9-]*)\}/g;

interface DownloadsFile { rows: Array<{ items: Array<{ id: string; version?: string }> }> }

export function readVersionFacts(root = DOCS_ROOT): VersionFacts {
  const { workImport } = readRegistry(root);
  const downloadsFile = JSON.parse(readFileSync(resolve(root, 'docs/site/downloads.json'), 'utf8')) as DownloadsFile;
  const downloads: Record<string, string> = {};
  for (const tile of downloadsFile.rows.flatMap(row => row.items)) {
    if (tile.version !== undefined) downloads[tile.id] = tile.version;
  }
  return checkVersionFacts({ work: { version: workImport.version, chart: workImport.chart }, downloads });
}

/** Refuses a fact that is not a version, so a typo fails here, not on a published page. */
export function checkVersionFacts(facts: VersionFacts): VersionFacts {
  const bad: string[] = [];
  for (const [key, value] of Object.entries(facts.work)) if (!VERSION.test(value ?? '')) bad.push(`workImport.${key} = ${JSON.stringify(value)}`);
  for (const [id, value] of Object.entries(facts.downloads)) if (!VERSION.test(value)) bad.push(`downloads.json ${id}.version = ${JSON.stringify(value)}`);
  if (bad.length) throw new Error(`Not a release version: ${bad.join(', ')}`);
  return facts;
}

/** The value a token stands for, or undefined when the kind or key is unknown. */
export function versionTokenValue(kind: string, key: string, facts: VersionFacts): string | undefined {
  if (kind === 'work') return key === 'version' || key === 'chart' ? facts.work[key] : undefined;
  if (kind === 'download') return Object.hasOwn(facts.downloads, key) ? facts.downloads[key] : undefined;
  return undefined;
}

/**
 * Replace every token in `md` with its version. `where` goes into the error, so a misspelt
 * `%download{macOS}` says which page carries the typo.
 */
export function expandVersionTokens(md: string, facts: VersionFacts, where = 'a docs page'): string {
  const unknown: string[] = [];
  const out = md.replace(VERSION_TOKEN, (token, kind: string, key: string) => {
    const value = versionTokenValue(kind, key, facts);
    if (value === undefined) { unknown.push(token); return token; }
    return value;
  });
  // A near miss (`%download{macOS}`, `%work{Version}`) does not match VERSION_TOKEN at all,
  // so look for the kinds with any brace content as well.
  for (const m of md.matchAll(/%(?:work|download)\{[^}\n]*\}/g)) {
    if (!new RegExp(`^${VERSION_TOKEN.source}$`).test(m[0])) unknown.push(m[0]);
  }
  if (unknown.length) {
    throw new Error(`${where}: unknown version token ${[...new Set(unknown)].join(', ')}. Known: %work{version}, %work{chart} and %download{<tile id>} for ${Object.keys(facts.downloads).join(', ')}.`);
  }
  return out;
}
