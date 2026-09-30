// SPDX-License-Identifier: MPL-2.0
/** Reports resolver coverage without rewriting imported token data. */
import { createTokenSet } from './tokens.ts';

export type TokenDiagnosticCode = 'json-pointer' | 'group-inheritance' | 'unresolved-value' | 'resolution-failed' | 'limit';
export interface TokenDiagnostic {
  code: TokenDiagnosticCode;
  /** JSON pointer for source features; a dotted token path for resolved values. */
  path: string;
  mode?: string;
}
export interface TokenCompatibility {
  format: 'lolly-token-compatibility';
  version: 1;
  diagnostics: TokenDiagnostic[];
  modes: { name: string; group: string | null }[];
  selections: { mode: string | null; tokens: number; unresolved: number }[];
  extensionNamespaces: string[];
  truncated: boolean;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const pointer = (v: string): string => v.replace(/~/g, '~0').replace(/\//g, '~1');

/** Bounded advisory diagnostics, not DTCG validation or an output conformance check. */
export function tokenCompatibility(doc: unknown): TokenCompatibility {
  const report: TokenCompatibility = { format: 'lolly-token-compatibility', version: 1, diagnostics: [], modes: [], selections: [], extensionNamespaces: [], truncated: false };
  const extensions = new Set<string>();
  const seen = new WeakSet<object>();
  let nodes = 0;
  let tokens = 0;
  const add = (code: TokenDiagnosticCode, path: string, mode?: string): void => {
    if (report.diagnostics.length < 100) report.diagnostics.push({ code, path, ...(mode ? { mode } : {}) });
    else report.truncated = true;
  };
  const walk = (value: unknown, path: string, depth: number): void => {
    if (++nodes > 20000 || depth > 48) { report.truncated = true; return; }
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) { report.truncated = true; return; }
    seen.add(value);
    if (record(value)) {
      if ('$value' in value) tokens++;
      if ('$ref' in value) add('json-pointer', `${path}/$ref`);
      if ('$extends' in value) add('group-inheritance', `${path}/$extends`);
      if (record(value.$extensions)) for (const key of Object.keys(value.$extensions)) extensions.add(key);
    }
    for (const [key, child] of Object.entries(value)) {
      // Extension payloads are opaque; their own reference syntax is not DTCG.
      if (key === '$extensions') continue;
      walk(child, `${path}/${pointer(key)}`, depth + 1);
      if (nodes > 20000) break;
    }
  };
  walk(doc, '', 0);
  report.extensionNamespaces = [...extensions].sort();
  const themes = record(doc) && Array.isArray(doc.$themes) ? doc.$themes : [];
  report.modes = themes.slice(0, 32).filter(record).map(v => ({ name: String(v.name ?? v.id ?? ''), group: typeof v.group === 'string' ? v.group : null }));
  if (themes.length > 32 || tokens > 2048) report.truncated = true;
  if (!report.truncated) {
    // Read the active selection as well as each named selection. Independent axes
    // compose through the existing resolver; these are not all axis combinations.
    for (const mode of [undefined, ...themes.slice(0, 32).filter(record).map(m => String(m.id ?? m.name ?? ''))]) {
      try {
        const set = createTokenSet(doc, { theme: mode });
        let unresolved = 0;
        for (const token of set.query()) {
          if (/\{[^{}]+\}|"\$ref"\s*:/.test(JSON.stringify(token.value) ?? '')) {
            unresolved++;
            add('unresolved-value', token.path, mode);
          }
        }
        report.selections.push({ mode: mode ?? null, tokens: set.size, unresolved });
      } catch { add('resolution-failed', '', mode); }
    }
  }
  if (report.truncated) add('limit', '');
  return report;
}
