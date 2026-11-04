// SPDX-License-Identifier: MPL-2.0
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareUpdates } from './build-latest-json.ts';
import { assertUpdaterSource } from './update-artifacts.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const path = process.argv[2];
if (!path) throw new Error('Choose promotion.json');
const plan = JSON.parse(readFileSync(path, 'utf8'));
if (!Array.isArray(plan.artifacts) || !plan.artifacts.length) throw new Error('Missing artifacts');
const config = JSON.parse(readFileSync(resolve(root, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), 'utf8'));
assertUpdaterSource(plan.source, root);
const first = Object.values(plan.manifests)[0] as { notes: string; pub_date: string };
const result = prepareUpdates({ config, receipt: { version: plan.version, source: plan.source, artifacts: plan.artifacts },
  artifacts: dirname(plan.artifacts[0].path), targets: plan.artifacts.map((row: { target: string }) => row.target), notes: first.notes, date: first.pub_date });
if (JSON.stringify(result) !== JSON.stringify(plan)) throw new Error('Promotion differs from verified candidate');
console.log('Promotion inputs verified.');
