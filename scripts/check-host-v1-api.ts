// SPDX-License-Identifier: MPL-2.0
/** Snapshot the public HostV1 declaration surface after its capability split. */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(REPO, 'packages', 'core', 'src', 'host-v1');
const SNAPSHOT = path.join(REPO, 'security', 'host-v1-api.json');

interface ApiEntry { module: string; kind: string; sha256: string }
interface ApiSnapshot { schemaVersion: 1; barrel: string; entries: Record<string, ApiEntry> }

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function declarationName(statement: ts.Statement): string | null {
  const declaration = statement as ts.Statement & { name?: ts.Node };
  if (declaration.name && ts.isIdentifier(declaration.name)) return declaration.name.text;
  if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
    const name = statement.declarationList.declarations[0]!.name;
    if (ts.isIdentifier(name)) return name.text;
  }
  return null;
}

export function snapshot(): ApiSnapshot {
  const entries: Record<string, ApiEntry> = {};
  for (const module of readdirSync(SOURCE).filter((file) => file.endsWith('.ts')).sort()) {
    const text = readFileSync(path.join(SOURCE, module), 'utf8');
    const source = ts.createSourceFile(module, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of source.statements) {
      const name = declarationName(statement);
      if (!name) continue;
      if (entries[name]) throw new Error(`duplicate HostV1 export: ${name}`);
      const signature = statement.getText(source).replace(/\s+/g, ' ').trim();
      entries[name] = { module, kind: ts.SyntaxKind[statement.kind], sha256: digest(signature) };
    }
  }
  return { schemaVersion: 1, barrel: 'packages/core/src/host-v1.ts', entries };
}

export function main(argv = process.argv.slice(2)): number {
  const current = snapshot();
  if (argv.includes('--write')) {
    writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`HostV1 API snapshot: wrote ${Object.keys(current.entries).length} declarations`);
    return 0;
  }
  const expected = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as ApiSnapshot;
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    const currentNames = new Set(Object.keys(current.entries));
    const expectedNames = new Set(Object.keys(expected.entries));
    const added = [...currentNames].filter((name) => !expectedNames.has(name));
    const removed = [...expectedNames].filter((name) => !currentNames.has(name));
    const changed = [...currentNames].filter((name) => expected.entries[name] && expected.entries[name]!.sha256 !== current.entries[name]!.sha256);
    console.error(`HostV1 API drift: added=${added.join(', ') || '-'} removed=${removed.join(', ') || '-'} changed=${changed.join(', ') || '-'}`);
    console.error('Review compatibility and engine minor version, then run npm run build:host-v1-api.');
    return 1;
  }
  console.log(`HostV1 API snapshot: ${Object.keys(current.entries).length} declarations match`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
