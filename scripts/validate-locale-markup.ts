// SPDX-License-Identifier: MPL-2.0

/** Build-time XSS guard for translation strings that intentionally reach innerHTML. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeRoot = path.join(repoRoot, 'shells', 'web', 'src', 'locales');

const ALLOWED_TAGS = new Set([
  '<strong>', '</strong>', '<em>', '</em>', '<b>', '</b>', '<code>', '</code>', '<br>',
  '<span class="dash-lock-brand">',
  '<span class="plat-chip-flag is-static">',
  '<span class="star-inline" aria-hidden="true">',
  '</span>',
  '<a href="#/verify">',
  '<a href="https://c2pa.org" target="_blank" rel="noopener">',
  '<a href="https://contentauthenticity.org" target="_blank" rel="noopener">',
  '<a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">',
  '</a>',
]);

function tags(value: string): string[] {
  return [...value.matchAll(/<[^>]+>/g)].map((match) => match[0]);
}

export function validateLocaleCatalog(
  catalog: Record<string, unknown>,
  filename = '<catalog>',
): string[] {
  const errors: string[] = [];
  for (const [source, translated] of Object.entries(catalog)) {
    if (typeof translated !== 'string') {
      errors.push(`${filename}: ${JSON.stringify(source)} has a non-string translation`);
      continue;
    }
    const sourceTags = tags(source);
    const translatedTags = tags(translated);
    for (const tag of [...sourceTags, ...translatedTags]) {
      if (!ALLOWED_TAGS.has(tag)) errors.push(`${filename}: forbidden locale markup ${JSON.stringify(tag)} in ${JSON.stringify(source)}`);
    }
    if (JSON.stringify(translatedTags) !== JSON.stringify(sourceTags)) {
      errors.push(`${filename}: translation changed the source markup structure for ${JSON.stringify(source)}`);
    }
  }
  return errors;
}

function localeFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) found.push(...localeFiles(absolute));
    else if (entry.endsWith('.json')) found.push(absolute);
  }
  return found.sort();
}

function main(): void {
  const errors: string[] = [];
  const files = localeFiles(localeRoot);
  for (const filename of files) {
    const relative = path.relative(repoRoot, filename).replaceAll(path.sep, '/');
    let parsed: unknown;
    try { parsed = JSON.parse(readFileSync(filename, 'utf8')); }
    catch (error) {
      errors.push(`${relative}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push(`${relative}: locale must be a JSON object`);
      continue;
    }
    errors.push(...validateLocaleCatalog(parsed as Record<string, unknown>, relative));
  }
  if (errors.length) throw new Error(`Locale markup validation failed:\n- ${errors.join('\n- ')}`);
  console.log(`Locale markup validation passed (${files.length} catalogs).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
