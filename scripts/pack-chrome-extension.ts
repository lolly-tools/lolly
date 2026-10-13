// SPDX-License-Identifier: MPL-2.0
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'shells/chrome-extension');
const FILES = ['manifest.json', 'policy.js', 'background.js', 'consent-flow.js', 'consent.html', 'consent.js', 'consent.css', 'content.js', 'inpage.js', 'LICENSE', 'icons/icon-16.png', 'icons/icon-48.png', 'icons/icon-128.png'];
const PRODUCTION_ORIGIN = 'https://lolly.tools';
const DEVELOPMENT_ORIGIN = 'http://localhost:5173';

interface Manifest {
  name: string;
  content_scripts: { matches: string[]; js: string[]; world?: string }[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  externally_connectable?: unknown;
  web_accessible_resources?: unknown;
}

export function assertProductionExtension(manifest: Manifest, policy: string): void {
  if (manifest.content_scripts.length !== 2 || manifest.content_scripts.some(entry => entry.matches.length !== 1 || entry.matches[0] !== `${PRODUCTION_ORIGIN}/*`)) {
    throw new Error('Production extension relay matches must use the exact production origin.');
  }
  if (policy.trim() !== `// SPDX-License-Identifier: MPL-2.0\nconst LOLLY_RELAY_ORIGINS = Object.freeze(['${PRODUCTION_ORIGIN}']);`) {
    throw new Error('Production extension relay policy must use the exact production origin.');
  }
  if (manifest.host_permissions?.length || manifest.externally_connectable || manifest.web_accessible_resources) {
    throw new Error('Production extension permissions and approval pages must stay scoped.');
  }
  if (JSON.stringify(manifest.optional_host_permissions) !== JSON.stringify(['http://*/*', 'https://*/*'])) {
    throw new Error('Site access must be optional and limited to HTTP pages.');
  }
}

export async function packChromeExtension(opts: { development?: boolean; outputDir?: string } = {}): Promise<string> {
  const manifest = JSON.parse(await readFile(join(SOURCE, 'manifest.json'), 'utf8')) as Manifest;
  const policy = await readFile(join(SOURCE, 'policy.js'), 'utf8');
  assertProductionExtension(manifest, policy);
  const output = opts.outputDir ?? join(ROOT, 'dist', opts.development ? 'chrome-extension-dev' : 'chrome-extension');
  await mkdir(output, { recursive: true });
  for (const file of FILES) {
    await mkdir(dirname(join(output, file)), { recursive: true });
    await cp(join(SOURCE, file), join(output, file));
  }
  if (opts.development) {
    manifest.name += ' (Development)';
    for (const entry of manifest.content_scripts) entry.matches.push(`${DEVELOPMENT_ORIGIN}/*`);
    await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(output, 'policy.js'), `// SPDX-License-Identifier: MPL-2.0\nconst LOLLY_RELAY_ORIGINS = Object.freeze(['${PRODUCTION_ORIGIN}', '${DEVELOPMENT_ORIGIN}']);\n`);
  }
  const entries: Record<string, Uint8Array> = {};
  for (const file of FILES) entries[file] = await readFile(join(output, file));
  const archive = `${output}.zip`;
  await writeFile(archive, zipSync(entries));
  return archive;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flags = process.argv.slice(2);
  if (flags.some(flag => flag !== '--dev') || flags.length > 1) throw new Error('Use pack:chrome-extension or pack:chrome-extension:dev.');
  console.log(await packChromeExtension({ development: flags.includes('--dev') }));
}
