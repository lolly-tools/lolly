// SPDX-License-Identifier: MPL-2.0
/**
 * Regenerate shells/web/models-manifest.json - the committed listing of every
 * served file under shells/web/public/models (url + size, sorted by url).
 *
 * Why it exists: the Vercel app deploys exclude the ~1.2 GB models tree from
 * their upload (.vercelignore) and serve /models/** through a rewrite to the
 * static model-host project (deploy/models-host/). That means the Vercel build
 * never has the files on disk, so the precache plugin's dist scan cannot list
 * them - and precache.json is where the offline download manager and the
 * desktop models-welcome sheet read model URLs and sizes from. This file fills
 * exactly those entries at build time (see mergeModelsManifest in
 * shells/web/vite.config.js); a build that HAS the files on disk keeps its
 * scanned truth and this listing is ignored for any url the scan already saw.
 *
 * Run it - and redeploy deploy/models-host/ - whenever a model file is
 * promoted, replaced, or retired. The .candidates staging dirs are skipped,
 * matching what the model host serves and what vite would have copied.
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const modelsDir = resolve(repoRoot, 'shells/web/public/models');
const outFile = resolve(repoRoot, 'shells/web/models-manifest.json');

interface Entry { url: string; size: number }

function walk(dir: string): Entry[] {
  const out: Entry[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .candidates staging + dotfiles
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) {
      const rel = relative(modelsDir, full).split(sep).join('/');
      out.push({ url: `/models/${rel}`, size: statSync(full).size });
    }
  }
  return out;
}

const files = walk(modelsDir).sort((a, b) => a.url.localeCompare(b.url));
writeFileSync(outFile, `${JSON.stringify(files, null, 1)}\n`);
const mb = (files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(0);
console.log(`wrote ${relative(repoRoot, outFile)}: ${files.length} files, ${mb} MB listed`);
