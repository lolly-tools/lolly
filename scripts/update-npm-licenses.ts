#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Refresh exact-version registry licenses, including optional packages for other OSes. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = join(root, 'security/npm-licenses.json');
const previous: Record<string, string> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const licenses: Record<string, string> = {};
const keys = new Set<string>();
for (const filename of process.argv.length > 2 ? process.argv.slice(2) : ['pnpm-lock.yaml']) {
  const lock = parse(readFileSync(join(root, filename), 'utf8')) as { lockfileVersion: string; packages?: Record<string, unknown> };
  if (String(lock.lockfileVersion) !== '9.0') throw new Error(`Unsupported pnpm lockfile: ${filename}`);
  for (const key of Object.keys(lock.packages ?? {})) keys.add(key);
}
for (const key of [...keys].sort()) {
  if (previous[key]) { licenses[key] = previous[key]; continue; }
  const license: unknown = JSON.parse(execFileSync('pnpm', ['view', key, 'license', '--json'], { cwd: root, encoding: 'utf8' }));
  if (typeof license !== 'string' || !license) throw new Error(`No registry license for ${key}; review its package before adding license metadata.`);
  licenses[key] = license;
}
mkdirSync(dirname(cacheFile), { recursive: true });
writeFileSync(cacheFile, `${JSON.stringify(licenses, null, 2)}\n`);
console.log(`Recorded licenses for ${keys.size} locked packages.`);
