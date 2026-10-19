// SPDX-License-Identifier: MPL-2.0
/** Pure bundle generation; Work selects and records the exact source revision. */
import { readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { DOCS_ROOT, readRegistry } from '../docs/navigation.ts';

export const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
export interface WorkBundle {
  files: Record<string, Buffer>;
  sourcePaths: Record<string, string>;
  manifestSha256: string;
}

export function buildWorkBundle(root = DOCS_ROOT): WorkBundle {
  const registry = readRegistry(root);
  const files: Record<string, Buffer> = {};
  const sourcePaths: Record<string, string> = {};
  const sourceFiles = new Map(Object.entries(registry.workImport.files).map(([path, entry]) => [path, 'docs/' + entry.source]));
  for (const page of registry.pages) if (page.work) sourceFiles.set(page.work.path, 'docs/' + page.src);
  for (const [path, source] of [...sourceFiles].sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/.test(path) || path.split('/').includes('..')) throw new Error(`Invalid bundle path: ${path}`);
    const absolute = resolve(root, source);
    const rel = relative(root, absolute);
    if (rel.startsWith('..' + sep) || rel === '..') throw new Error(`Source escapes the canonical checkout: ${source}`);
    files[path] = readFileSync(absolute);
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
