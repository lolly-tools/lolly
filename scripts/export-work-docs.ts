// SPDX-License-Identifier: MPL-2.0
/**
 * Pure bundle generation; Work selects and records the exact source revision.
 *
 * lolly-work's scripts/sync-docs-bundle.ts imports buildWorkBundle from the selected Lolly
 * checkout and writes what it returns. Every Markdown guide goes through lowerForConsole
 * (docs/work-console.ts) on the way, so the console, which renders no `:::` fences, pills or
 * comments, gets plain Markdown, and version tokens arrive as the versions they stand for.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { DOCS_ROOT, readRegistry } from '../docs/navigation.ts';
import { readVersionFacts } from '../docs/version-tokens.ts';
import { lowerForConsole } from '../docs/work-console.ts';

export const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
export interface WorkBundle {
  files: Record<string, Buffer>;
  sourcePaths: Record<string, string>;
  manifestSha256: string;
}

export function buildWorkBundle(root = DOCS_ROOT): WorkBundle {
  const registry = readRegistry(root);
  const facts = readVersionFacts(root);
  // A figure is linked where the site serves its signed file (docs/build.ts copies the bank
  // to /info/figures/ byte for byte), preferring the SVG when both exist, as the site does.
  const figureUrl = (id: string): string | null => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return null;
    const file = ['svg', 'html'].map(ext => `${id}.${ext}`).find(name => existsSync(resolve(root, 'docs/figures', name)));
    return file ? `${registry.canonical}/figures/${file}` : null;
  };
  const files: Record<string, Buffer> = {};
  const sourcePaths: Record<string, string> = {};
  const sourceFiles = new Map(Object.entries(registry.workImport.files).map(([path, entry]) => [path, 'docs/' + entry.source]));
  for (const page of registry.pages) if (page.work) sourceFiles.set(page.work.path, 'docs/' + page.src);
  for (const [path, source] of [...sourceFiles].sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/.test(path) || path.split('/').includes('..')) throw new Error(`Invalid bundle path: ${path}`);
    const absolute = resolve(root, source);
    const rel = relative(root, absolute);
    if (rel.startsWith('..' + sep) || rel === '..') throw new Error(`Source escapes the canonical checkout: ${source}`);
    const bytes = readFileSync(absolute);
    files[path] = path.endsWith('.md')
      ? Buffer.from(lowerForConsole(bytes.toString('utf8'), { facts, figureUrl, where: source }))
      : bytes;
    sourcePaths[path] = source;
  }
  const icons: Record<string, string> = { start: 'overview', create: 'docs', build: 'docs', manage: 'instance', operate: 'audit', trust: 'instance' };
  const manifest = {
    version: 1,
    title: 'Lolly Work documentation',
    canonical: registry.canonical,
    note: 'Generated from the canonical Lolly documentation. Edit the source at https://lolly.tools/info; docs-pin.json records this release-matched bundle.',
    oss: { label: 'All Lolly documentation', path: '/info/', note: 'The complete Lolly and Work documentation lives at https://lolly.tools/info.' },
    sections: registry.sections.flatMap(section => {
      const pages = registry.pages.filter(p => p.work && p.section === section.id);
      return pages.length ? [{ id: section.id, icon: icons[section.id], title: section.title, docs: pages.map(page => ({
        slug: page.work!.slug, path: page.work!.path, title: page.title, summary: page.description ?? '',
      })) }] : [];
    }),
  };
  files['docs.json'] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  sourcePaths['docs.json'] = 'docs/manifest.json';
  files['README.md'] = Buffer.from(`# Lolly Work packaged documentation

The complete documentation lives at <https://lolly.tools/info>. These generated guides are bundled for the console at \`/admin#/docs\` and offline installations. Existing console slugs and relative guide links remain available.

Edit the [canonical source](https://github.com/lolly-tools/lolly/tree/main/docs/work), then follow the [bundle update instructions](https://github.com/lolly-tools/lolly/blob/main/docs/work/README.md). Do not edit this generated copy. The repository's \`docs-pin.json\` records the selected canonical commit and all file hashes; run \`pnpm run verify:docs-pin\` to verify the bundle. Keep the selected documentation appropriate for the Work release.

` + manifest.sections.map(section => `## ${section.title}\n\n` + section.docs.map(page => `- [${page.title}](${page.path})`).join('\n')).join('\n\n') + '\n\nWork prose and screenshot credentials retain MPL-2.0 and any third-party notices. See [LICENSE](LICENSE).\n');
  sourcePaths['README.md'] = 'scripts/export-work-docs.ts';
  return { files, sourcePaths, manifestSha256: sha256(readFileSync(resolve(root, 'docs/manifest.json'))) };
}
