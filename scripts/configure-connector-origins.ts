#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConnectorOrigins } from '../packages/core/src/connector-origins.ts';

/** Render a deployment file without changing other policy directives or app bytes. */
export function configureDeploymentOrigins(text: string, raw: string): string {
  const origins = parseConnectorOrigins(raw);
  if (!/connect-src[ \t]+(?:'self'|'none')[^;\r\n]*;/.test(text)) throw new Error('Deployment file has no connection policy');
  return text.replace(/connect-src[ \t]+((?:'self'|'none')[^;\r\n]*);/g, (_match, sources: string) => {
    const existing = sources.trim().split(/\s+/);
    if (existing.some(source => source === 'https:' || source.includes('*'))) throw new Error('Deployment connection policy must use exact origins');
    return `connect-src ${[...new Set([...existing, ...origins])].join(' ')};`;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || process.argv.length !== 4) throw new Error('Usage: configure-connector-origins.ts INPUT OUTPUT');
  const text = readFileSync(input, 'utf8');
  const configured = configureDeploymentOrigins(text, process.env.VITE_CONNECTOR_ORIGINS ?? '');
  writeFileSync(output, configured, { mode: 0o644 });
}
