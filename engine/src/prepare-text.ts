// SPDX-License-Identifier: MPL-2.0
/** Credential and personal-data suggestions with bounded declarative rules. */
import type { PreparationRule } from '@lolly-tools/core/host-v1';
import { piiFindings } from './prepare-pii.ts';

export interface PrivateSpan {
  start: number;
  end: number;
  value: string;
  category: string;
  label: string;
  rule: string;
  uncertain: boolean;
  encoding?: 'url';
}
export const PREPARE_MAX_TEXT = 1024 * 1024;
export const PREPARE_MAX_FINDINGS = 2000;
export const PREPARE_MAX_RULES = 100;
const FIELD = /^(?:password|passwd|pwd|secret|clientsecret|apikey|accesskey|secretkey|privatekey|token|accesstoken|refreshtoken|idtoken|authorization|proxyauthorization|cookie|setcookie|session|sessionid|sessiontoken|credential|credentials)$/i;
export function sensitiveField(field: string, rules: PreparationRule[]): boolean {
  const normalized = field.replace(/[-_\s]/g, '');
  return FIELD.test(normalized) || rules.some(r => r.kind === 'field' && r.value.toLowerCase() === field.toLowerCase());
}
export function validatePreparationRules(rules: PreparationRule[]): PreparationRule[] {
  if (!Array.isArray(rules) || rules.length > PREPARE_MAX_RULES) throw new Error('Use at most 100 local rules.');
  const ids = new Set<string>();
  return rules.map(r => {
    if (!r || !['field', 'literal'].includes(r.kind) || typeof r.value !== 'string' || !r.value.trim() || r.value.length > 256
      || typeof r.label !== 'string' || r.label.length > 80 || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(r.id) || ids.has(r.id)) throw new Error('A local rule is invalid. Use a field name or literal value, up to 256 characters.');
    ids.add(r.id); return { id: r.id, kind: r.kind, value: r.value, label: r.label };
  });
}

/** Suggestions only. No remote validation, arbitrary expressions or logging. */
export function inspectPrivateText(text: string, rules: PreparationRule[] = [], field?: string): { spans: PrivateSpan[]; truncated: boolean } {
  if (text.length > PREPARE_MAX_TEXT) throw new Error('Text inspection is limited to 1 MiB per value.');
  const spans: PrivateSpan[] = [];
  let truncated = false;
  const add = (start: number, end: number, category: string, label: string, rule: string, uncertain = false, encoding?: 'url'): void => {
    if (end <= start || spans.some(s => start < s.end && s.start < end)) return;
    if (spans.length >= PREPARE_MAX_FINDINGS) { truncated = true; return; }
    let value = text.slice(start, end);
    if (encoding) { try { value = decodeURIComponent(value.replace(/\+/g, ' ')); } catch { /* Literal encoded text remains inspectable. */ } }
    spans.push({ start, end, value, category, label, rule, uncertain, ...(encoding ? { encoding } : {}) });
  };
  // Field context is stronger than a guess over its contents. Keep auth scheme.
  if (field && sensitiveField(field, rules) && text.trim()) {
    const prefix = /^(?:Bearer|Basic)\s+/i.exec(text)?.[0].length ?? 0;
    add(prefix, text.length, 'credential', 'Sensitive field', 'sensitive-field');
    return { spans, truncated };
  }
  const match = (pattern: RegExp, category: string, label: string, rule: string): void => {
    for (const m of text.matchAll(pattern)) {
      add(m.index!, m.index! + m[0].length, category, label, rule);
      if (truncated) break;
    }
  };
  match(/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----|$)/g, 'credential', 'Private key', 'private-key');
  match(/\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{20,255}|xox[baprs]-[A-Za-z0-9-]{12,255})\b/g, 'credential', 'Credential-shaped value', 'credential-shape');
  match(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, 'credential', 'Signed token', 'jwt');
  for (const m of text.matchAll(/\b(?:Bearer|Basic)\s+([A-Za-z0-9_+./=-]{4,})/gi)) add(m.index! + m[0].length - m[1]!.length, m.index! + m[0].length, 'credential', 'Authorization value', 'authorization');
  // Config/log assignments and URL/query bodies. The surrounding syntax stays put.
  const assignments = /(?:^|[\s?&;,{])["']?([\w-]{1,80})["']?\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s&,;}\r\n]+))/g;
  for (;;) {
    const m = assignments.exec(text); if (!m) break;
    if (!sensitiveField(m[1]!, rules)) { assignments.lastIndex = m.index + 1; continue; }
    const v = m[2] ?? m[3] ?? m[4] ?? '';
    if (!v) continue;
    const offset = m[0].lastIndexOf(v);
    add(m.index! + offset, m.index! + offset + v.length, 'credential', 'Sensitive assignment', 'assignment', false, /[?&=]/.test(m[0]) && /%[0-9a-f]{2}/i.test(v) ? 'url' : undefined);
  }
  // Decode individual query values locally. Preserve URL encoding on rewrite;
  // do not resolve a URL or inspect another resource named by it.
  for (const query of text.matchAll(/[?&][^=&#\s]{1,80}=([^&#\s]+)/g)) {
    const raw = query[1]!;
    let decoded: string;
    try { decoded = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { continue; }
    const personal = piiFindings(decoded).find(f => f.kind);
    const custom = rules.find(r => r.kind === 'literal' && decoded.includes(r.value));
    if (!personal && !custom) continue;
    const start = query.index! + query[0].length - raw.length;
    add(start, start + raw.length, personal?.kind ?? 'custom', 'Query parameter value', personal ? `pii-${personal.kind}` : custom!.id, personal?.maybe ?? false, 'url');
  }
  for (const rule of rules) if (rule.kind === 'literal') {
    for (let offset = text.indexOf(rule.value); offset >= 0; offset = text.indexOf(rule.value, offset + rule.value.length)) {
      add(offset, offset + rule.value.length, 'custom', rule.label || 'Your value', rule.id);
      if (truncated) break;
    }
  }
  // Same bounded personal-data patterns as Redact; checked against the canonical helper.
  for (const hit of piiFindings(text)) {
    add(hit.start, hit.end, hit.kind, hit.label ?? hit.kind, `pii-${hit.kind}`, hit.maybe);
    if (truncated) break;
  }
  return { spans: spans.sort((a, b) => a.start - b.start), truncated };
}

export function replacePrivateSpans(text: string, edits: { span: PrivateSpan; replacement: string }[]): string {
  let result = text;
  for (const { span, replacement } of [...edits].sort((a, b) => b.span.start - a.span.start)) {
    result = result.slice(0, span.start) + (span.encoding === 'url' ? encodeURIComponent(replacement) : replacement) + result.slice(span.end);
  }
  return result;
}
