// SPDX-License-Identifier: MPL-2.0
/** Bounded local document scopes and source-range edits for preparation jobs. */
import { isMap, isSeq, isScalar, isAlias, parseAllDocuments } from 'yaml';
import type { PreparationRule, PreparationScope } from '@lolly-tools/core/host-v1';
import { readZipMembers, decodeZipMember, storeZipMembers, storeZip, type ZipRawMember } from './zip.ts';
import { PREPARE_MAX_TEXT, sensitiveField } from './prepare-text.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
export const PREPARE_MAX_BYTES = 32 * 1024 * 1024;
export const PREPARE_MAX_TOTAL = 64 * 1024 * 1024;
export const PREPARE_MAX_SCOPES = 300;
export interface PreparationUnit {
  id: string; scopeId: string; text: string; field?: string; location: string; line: number;
}
export interface PreparationDocument {
  scope: PreparationScope;
  children: PreparationDocument[];
  units: PreparationUnit[];
  write(values: Map<string, string>, remove: Set<string>): Uint8Array;
}
export interface PreparationBudget { scopes: number; expanded: number; units: number }

function decodeText(bytes: Uint8Array): string | undefined {
  if (bytes.length > PREPARE_MAX_TEXT) return undefined;
  try { const text = decoder.decode(bytes); for (const c of text) { const code = c.charCodeAt(0); if (code < 32 && ![9, 10, 12, 13].includes(code)) return undefined; } return text; }
  catch { return undefined; }
}
function base64Text(value: string): string | undefined {
  try { return decodeText(Uint8Array.from(atob(value), c => c.charCodeAt(0))); } catch { return undefined; }
}
function encodeBase64(value: string): string {
  let binary = '';
  for (const b of encoder.encode(value)) binary += String.fromCharCode(b);
  return btoa(binary);
}
function scalarText(value: unknown): string | undefined {
  return ['string', 'number', 'bigint', 'boolean'].includes(typeof value) ? String(value) : undefined;
}

/** Parse without evaluating tags, aliases, source actions or external references. */
function textDocument(doc: PreparationDocument, bytes: Uint8Array, text: string, structured: boolean, json: boolean, rules: PreparationRule[], budget: PreparationBudget): void {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (offset: number): number => { let low = 0, high = lineStarts.length; while (low < high) { const mid = (low + high) >>> 1; if (lineStarts[mid]! <= offset) low = mid + 1; else high = mid; } return low; };
  const edits: { id: string; start: number; end: number; encode: (value: string) => string }[] = [];
  const add = (value: string, start: number, end: number, location: string, field: string | undefined, encode: (s: string) => string): void => {
    if (value.length > PREPARE_MAX_TEXT || ++budget.units > 20000) { doc.scope.status = 'partial'; return; }
    const id = `${doc.scope.id}:u${doc.units.length}`;
    doc.units.push({ id, scopeId: doc.scope.id, text: value, field, location, line: lineAt(start) });
    edits.push({ id, start, end, encode });
  };
  if (!structured) add(text, 0, text.length, 'Text', undefined, s => s);
  else {
    if (json) JSON.parse(text); // Strict JSON grammar; preserve original numbers/formatting below.
    const documents = parseAllDocuments(text, { prettyErrors: false, logLevel: 'silent', strict: true, uniqueKeys: true, intAsBigInt: true, stringKeys: true });
    if (!documents.length || documents.some(d => d.errors.length)) throw new Error('Could not parse structured text.');
    const ranges: [number, number][] = [];
    type Entry = { node: unknown; path: string; field?: string; base64?: boolean; depth: number };
    const queue: Entry[] = documents.map((d, i) => ({ node: d.contents, path: documents.length > 1 ? `Document ${i + 1}` : '$', depth: 0 }));
    let visited = 0;
    for (const d of documents) if (d.warnings.length) {
      doc.scope.status = 'partial'; doc.scope.limitations.push('Some YAML tags or directives are unsupported; values are inspected without executing them.');
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (++visited > 20000) { doc.scope.status = 'partial'; doc.scope.limitations.push('The structured node limit was reached.'); break; }
      const { node, path, field, base64, depth } = queue[cursor]!;
      if (depth > 64) { doc.scope.status = 'partial'; doc.scope.limitations.push('Nested content beyond 64 levels was not inspected.'); continue; }
      if (isAlias(node)) { doc.scope.status = 'partial'; doc.scope.limitations.push('YAML aliases are inspected at their anchors; sensitive field context at alias uses is not inspected.'); continue; }
      if (isMap(node)) {
        const named = node.items.find(p => isScalar(p.key) && p.key.value === 'name');
        const context = named && isScalar(named.value) ? scalarText(named.value.value) : undefined;
        const encoded = node.items.some(p => isScalar(p.key) && p.key.value === 'encoding' && isScalar(p.value) && p.value.value === 'base64');
        for (const pair of node.items) {
          const key = isScalar(pair.key) ? String(pair.key.value) : '?';
          queue.push({ node: pair.key, path: `${path} (key)`, depth: depth + 1 });
          queue.push({ node: pair.value, path: `${path}.${key}`, field: key === 'value' && path.includes('.cookies[') ? 'cookie' : key === 'value' && context ? context : key, base64: encoded && key === 'text', depth: depth + 1 });
        }
      } else if (isSeq(node)) node.items.forEach((item, i) => { queue.push({ node: item, path: `${path}[${i}]`, field, depth: depth + 1 }); });
      else if (isScalar(node) && node.range) {
        const [start, end] = node.range;
        ranges.push([start, end]);
        const value = scalarText(node.value);
        if (value === undefined) continue;
        const raw = text.slice(start, end);
        const suffix = /\r?\n$/.exec(raw)?.[0] ?? '';
        const encode = (v: string): string => JSON.stringify(v) + suffix;
        if (base64) {
          const decoded = base64Text(value);
          if (decoded === undefined) { doc.scope.status = 'partial'; doc.scope.limitations.push('A base64 body is binary, invalid or too large to inspect.'); }
          else add(decoded, start, end, `${path} (decoded body)`, undefined, v => encode(encodeBase64(v)));
        } else add(value, start, end, path, field && sensitiveField(field, rules) ? field : undefined, encode);
      }
    }
    // YAML comments can carry secrets too. Match only outside parsed scalar ranges.
    if (!json) {
      ranges.sort((a, b) => a[0] - b[0]);
      let range = 0;
      for (let offset = text.indexOf('#'); offset >= 0;) {
        while (range < ranges.length && ranges[range]![1] <= offset) range++;
        if (range < ranges.length && ranges[range]![0] <= offset) { offset = text.indexOf('#', ranges[range]![1]); continue; }
        const newline = text.indexOf('\n', offset), end = newline < 0 ? text.length : newline;
        add(text.slice(offset, end), offset, end, 'Comment', undefined, s => s);
        offset = text.indexOf('#', end);
      }
    }
  }
  doc.write = values => {
    let result = text, changed = false;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      const value = values.get(edit.id);
      if (value !== undefined) { result = result.slice(0, edit.start) + edit.encode(value) + result.slice(edit.end); changed = true; }
    }
    if (!changed) return bytes;
    if (json) JSON.parse(result);
    if (structured && parseAllDocuments(result, { prettyErrors: false, logLevel: 'silent' }).some(d => d.errors.length)) throw new Error('A replacement would make the structured file invalid. Adjust the replacement.');
    return encoder.encode(result);
  };
}

export function openPreparationDocument(bytes: Uint8Array, name: string, sourceId: string, id: string, rules: PreparationRule[], budget: PreparationBudget, depth = 0, counted = false): PreparationDocument {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const scope: PreparationScope = { id, sourceId, path: name, format: 'unknown', status: 'uninspected', limitations: [] };
  const doc: PreparationDocument = { scope, children: [], units: [], write: () => bytes };
  if (!counted && ++budget.scopes > PREPARE_MAX_SCOPES) { scope.limitations.push('The 300-member inspection limit was reached.'); return doc; }
  if (bytes.length > PREPARE_MAX_BYTES) { scope.limitations.push('This file exceeds the 32 MiB preparation limit.'); return doc; }
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && (ext === 'zip' || ext === '');
  if (zip) {
    scope.format = 'zip';
    if (depth >= 3) { scope.limitations.push('Archives deeper than three levels are retained without inspection.'); return doc; }
    let members: ZipRawMember[];
    try { members = readZipMembers(bytes, { maxInputBytes: PREPARE_MAX_BYTES, maxEntries: PREPARE_MAX_SCOPES, maxEntryBytes: PREPARE_MAX_TOTAL, maxTotalBytes: PREPARE_MAX_TOTAL }); }
    catch { scope.limitations.push('This archive is malformed, unsupported or exceeds the expansion limits. Its original bytes are available unchanged.'); return doc; }
    if (new Set(members.map(m => m.name)).size !== members.length) { scope.limitations.push('Duplicate archive member names prevent a reliable selective rewrite.'); return doc; }
    if (budget.scopes + members.length > PREPARE_MAX_SCOPES) { scope.limitations.push('The global 300-member inspection limit was reached. This archive is retained without member inspection.'); return doc; }
    budget.scopes += members.length;
    scope.status = 'partial';
    scope.limitations.push('Member names and archive comments are not inspected. Rebuilding removes archive comments and empty directory records.');
    for (const [index, member] of members.entries()) {
      const childId = `${id}:m${index}`;
      budget.expanded += member.size;
      const reason = member.flags & 1 ? 'Encrypted member; retained without decryption.'
        : ![0, 8].includes(member.method) ? 'Unsupported archive compression; member retained.'
        : budget.expanded > PREPARE_MAX_TOTAL ? 'The 64 MiB expansion budget was reached.'
        : member.size > PREPARE_MAX_BYTES ? 'Member exceeds the 32 MiB preparation limit.' : '';
      if (reason) doc.children.push({ scope: { id: childId, sourceId, path: `${name}/${member.name}`, format: 'unknown', status: 'uninspected', limitations: [reason] }, children: [], units: [], write: () => new Uint8Array() });
      else {
        try { doc.children.push(openPreparationDocument(decodeZipMember(member), `${name}/${member.name}`, sourceId, childId, rules, budget, depth + 1, true)); }
        catch { doc.children.push({ scope: { id: childId, sourceId, path: `${name}/${member.name}`, format: 'unknown', status: 'uninspected', limitations: ['Member could not be decoded; retained unchanged.'] }, children: [], units: [], write: () => new Uint8Array() }); }
      }
    }
    doc.write = (values, remove) => {
      let changed = false;
      const kept: ZipRawMember[] = [];
      doc.children.forEach((child, i) => {
        const member = members[i]!;
        if (remove.has(child.scope.id)) { changed = true; return; }
        const affected = [...values.keys(), ...remove].some(key => key.startsWith(`${child.scope.id}:`));
        if (!affected) { kept.push(member); return; }
        const output = child.write(values, remove);
        kept.push(readZipMembers(storeZip([{ name: member.name, bytes: output }]))[0]!); changed = true;
      });
      return changed ? storeZipMembers(kept) : bytes;
    };
    return doc;
  }
  if (['pdf', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'docx', 'pptx', 'xlsx', 'mp3', 'wav', 'mp4'].includes(ext)) {
    scope.format = ext;
    scope.limitations.push(['pdf', 'png', 'jpg', 'jpeg', 'svg'].includes(ext) ? 'Use Strip Hidden Data for metadata or Redact for visible content. This file is retained until you choose that operation.' : 'This binary format is not inspected here; its bytes are retained unchanged.');
    return doc;
  }
  const text = decodeText(bytes);
  if (text === undefined) { scope.limitations.push('Binary, non-UTF-8 or larger than 1 MiB: retained without text inspection.'); return doc; }
  scope.status = 'inspected';
  const json = ['json', 'har', 'jsonl', 'ndjson'].includes(ext);
  const structured = json || ['yml', 'yaml'].includes(ext);
  scope.format = json ? ext : structured ? 'yaml' : 'text';
  if (budget.units >= 20000) { scope.status = 'uninspected'; scope.limitations.push('The structured value budget was reached.'); return doc; }
  try { textDocument(doc, bytes, text, structured, json, rules, budget); }
  catch { doc.units = []; doc.write = () => bytes; scope.status = 'uninspected'; scope.limitations.push('Structured text could not be parsed reliably. Keep the original or inspect a plain-text copy.'); }
  if (doc.scope.status === 'partial') scope.limitations = [...new Set([...scope.limitations, 'Some structured content was not inspected.'])];
  return doc;
}

export function preparationDocuments(roots: PreparationDocument[]): PreparationDocument[] {
  const all: PreparationDocument[] = [], queue = [...roots];
  while (queue.length) { const doc = queue.shift()!; all.push(doc); queue.push(...doc.children); }
  return all;
}
