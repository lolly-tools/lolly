// SPDX-License-Identifier: MPL-2.0
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'integrations/chatgpt');
const manifest = JSON.parse(await readFile(path.join(source, '.codex-plugin/plugin.json'), 'utf8'));
const files: Record<string, Uint8Array> = {};
for (const name of ['.codex-plugin/plugin.json', '.mcp.json', 'README.md']) files[name] = new Uint8Array(await readFile(path.join(source, name)));
files['assets/icon.png'] = new Uint8Array(await readFile(path.join(root, 'shells/web/public/icons/icon-512.png')));
const output = path.resolve(process.argv[2] || path.join(root, 'plans', `lolly-plugin-${manifest.version}.zip`));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, zipSync(files, { level: 9 }));
console.log(`Plugin draft: ${output}`);
