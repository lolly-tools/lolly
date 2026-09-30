// SPDX-License-Identifier: MPL-2.0
/** Retained token provenance, reference diagnostics and semantic change impact. */
import type { TokenInspection, TokenResolveOptions, TokenSource, TokenTrace } from './bridge/host-v1.ts';
import { aliasPath, createTokenSet, isAlias } from './tokens.ts';
import { resolveTokenSelection, tokenSetNames } from './token-selection.ts';
import { canonicalJson } from './canonical-json.ts';
import { tokenReferenceUses } from './token-composite.ts';
import { brandSystemOf } from './brand-system.ts';

type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const pointer = (s: string): string => s.replaceAll('~', '~0').replaceAll('/', '~1');
export const TOKEN_INSPECTION_LIMIT = 20000;

/** Sidecar evidence. Retained definitions are never rewritten to resolved values. */
export function inspectTokenDocument(doc: unknown, opts: TokenResolveOptions = {}): TokenInspection {
  const selection = resolveTokenSelection(doc, opts);
  const d = record(doc) ? doc : {};
  const definitions = new Map<string, TokenSource[]>();
  const diagnostics = [...selection.diagnostics];
  let nodes = 0;
  let truncated = selection.diagnostics.some(i => i.code === 'limit');
  function walk(node: unknown, type: string | null, path: string, location: string, set: string | null, depth: number): void {
    if (!record(node)) return;
    if (depth > 48) { truncated = true; return; }
    const inherited = typeof node.$type === 'string' ? node.$type : type;
    if ('$ref' in node || '$extends' in node) diagnostics.push({ code: 'unsupported', path, message: 'JSON Pointer references and group inheritance are retained but not resolved.' });
    for (const [key, child] of Object.entries(node)) {
      if (++nodes > TOKEN_INSPECTION_LIMIT) { truncated = true; return; }
      if (key.startsWith('$') || !record(child)) continue;
      const p = path ? `${path}.${key}` : key;
      const loc = `${location}/${pointer(key)}`;
      if ('$value' in child) {
        const sources = definitions.get(p) ?? [];
        sources.push({ set, location: loc, type: typeof child.$type === 'string' ? child.$type : inherited, value: structuredClone(child.$value), active: set === null || selection.sets.includes(set), ...(typeof child.$description === 'string' ? { description: child.$description } : {}), ...(record(child.$extensions) ? { extensions: structuredClone(child.$extensions) } : {}) });
        definitions.set(p, sources);
        if ('$ref' in child) diagnostics.push({ code: 'unsupported', path: p, message: 'JSON Pointer references are retained but not resolved.' });
      } else walk(child, inherited, p, loc, set, depth + 1);
    }
  }
  const sets = tokenSetNames(d);
  if (sets) for (const set of sets) walk(d[set], null, '', `/${pointer(set)}`, set, 0);
  else walk(d, null, '', '', null, 0);
  const resolved = createTokenSet(d, opts);
  const references = (value: unknown): string[] => {
    const out = new Set<string>();
    let count = 0;
    function visit(v: unknown, depth: number): void {
      if (++count > 4096 || depth > 32) { truncated = true; return; }
      if (isAlias(v)) out.add(aliasPath(v)!);
      else if (Array.isArray(v)) v.forEach(x => { visit(x, depth + 1); });
      else if (record(v)) for (const [k, x] of Object.entries(v)) if (!k.startsWith('$')) visit(x, depth + 1);
    }
    visit(value, 0);
    return [...out];
  };
  const tokens: TokenTrace[] = [...definitions].map(([path, candidates]) => {
    candidates.sort((a, b) => selection.sets.indexOf(a.set ?? '') - selection.sets.indexOf(b.set ?? ''));
    const source = candidates.filter(c => c.active).at(-1) ?? null;
    const entry = resolved.get(path);
    return { path, type: entry?.type ?? source?.type ?? candidates[0]?.type ?? null, authored: source?.value, resolved: structuredClone(entry?.value), source, candidates, references: references(source?.value), usedBy: [], diagnostics: [] };
  });
  const byPath = new Map(tokens.map(t => [t.path, t]));
  const vocabulary = brandSystemOf(d);
  if (vocabulary) {
    let declaredEdges = 0;
    for (const role of vocabulary.roles) {
      const bindings = vocabulary.bindings.filter(binding => binding.roleId === role.id).map(binding => ({ id: binding.id, ...binding.consumer, ...(binding.modes ? { modes: [...binding.modes] } : {}) }));
      for (const path of new Set(role.resources.filter(resource => resource.type === 'token').map(resource => resource.path))) {
        if (++declaredEdges > TOKEN_INSPECTION_LIMIT) { truncated = true; break; }
        const token = byPath.get(path);
        if (token) {
          token.declaredConsumers ??= [];
          token.declaredConsumers.push({ roleId: role.id, label: role.label, bindings });
        }
        else diagnostics.push({ code: 'missing', path, message: `Declared role ${role.label} refers to missing token ${path}.` });
      }
      if (declaredEdges > TOKEN_INSPECTION_LIMIT) break;
    }
  }
  for (const token of tokens) for (const target of token.references) {
    const ref = byPath.get(target);
    if (ref?.source) {
      ref.usedBy.push(token.path);
    } else token.diagnostics.push({ code: 'missing', path: token.path, message: `Reference ${target} has no active definition.` });
  }
  for (const token of tokens) for (const use of tokenReferenceUses(token.authored, token.type)) {
    const actual = byPath.get(use.path)?.type;
    if (use.type && actual && use.type !== actual) token.diagnostics.push({ code: 'type', path: token.path, message: `Expected ${use.type}, but ${use.path} is ${actual}.` });
  }
  // Iterative colour marking avoids recursion overflow on long source chains.
  const done = new Set<string>();
  for (const token of tokens) {
    if (done.has(token.path)) continue;
    const visiting = new Set<string>();
    const stack: { path: string; exit: boolean }[] = [{ path: token.path, exit: false }];
    let edges = 0;
    while (stack.length) {
      const item = stack.pop()!;
      if (item.exit) { visiting.delete(item.path); done.add(item.path); continue; }
      if (visiting.has(item.path)) {
        const t = byPath.get(item.path)!;
        t.diagnostics.push({ code: 'cycle', path: t.path, message: 'This reference chain contains a cycle.' });
        continue;
      }
      if (done.has(item.path)) continue;
      if (++edges > TOKEN_INSPECTION_LIMIT) { truncated = true; break; }
      visiting.add(item.path);
      stack.push({ path: item.path, exit: true });
      for (const ref of byPath.get(item.path)?.references ?? []) if (byPath.has(ref)) stack.push({ path: ref, exit: false });
    }
  }
  if (truncated) diagnostics.push({ code: 'limit', path: '', message: 'Inspection reached a scan limit. Usage counts and results are incomplete.' });
  return { selection, tokens, diagnostics, truncated, scope: 'token-document' };
}

export interface TokenImpact {
  path: string;
  kind: 'added' | 'removed' | 'authored' | 'resolved';
  before: unknown;
  after: unknown;
}

/** Reports indirect alias changes as well as edits to their definitions. */
export function diffTokenDocuments(before: unknown, after: unknown, opts: TokenResolveOptions = {}, afterOpts: TokenResolveOptions = opts): TokenImpact[] {
  const a = new Map(inspectTokenDocument(before, opts).tokens.map(t => [t.path, t]));
  const b = new Map(inspectTokenDocument(after, afterOpts).tokens.map(t => [t.path, t]));
  const changes: TokenImpact[] = [];
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    const old = a.get(path), next = b.get(path);
    const authored = canonicalJson(old?.candidates) !== canonicalJson(next?.candidates);
    const effective = canonicalJson([old?.type, old?.resolved]) !== canonicalJson([next?.type, next?.resolved]);
    if (!old || !next || authored || effective) changes.push({ path, kind: !old ? 'added' : !next ? 'removed' : authored ? 'authored' : 'resolved', before: old?.resolved, after: next?.resolved });
  }
  return changes;
}
