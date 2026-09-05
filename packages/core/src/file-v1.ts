// SPDX-License-Identifier: MPL-2.0
/** Portable file facts and operation receipts. Bytes and access stay with the host. */
export const FILE_CONTRACT_VERSION = 1 as const;

export interface FileFactsV1 {
  name: string;
  format: string;
  /** Whether the input format came from bytes or only the supplied name/type. */
  formatSource?: 'detected' | 'declared';
  mime: string;
  size: number;
  /** Hex SHA-256 of these exact bytes, not a logical asset ID. */
  sha256?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  pages?: number;
}

export interface FileReferenceV1 {
  id: string;
  version?: string;
  role: 'original' | 'working' | 'preview' | 'extracted' | 'output';
  facts: FileFactsV1;
  /** A source relation carries no URL, credential or implicit permission. */
  derivedFrom?: { id: string; version?: string; sha256?: string };
}

export interface FileOperationFindingV1 {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface FileOperationReportV1 {
  version: typeof FILE_CONTRACT_VERSION;
  operation: string;
  state: 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';
  inputs: FileFactsV1[];
  outputs: FileFactsV1[];
  options: Record<string, string | number | boolean>;
  changes: string[];
  findings: FileOperationFindingV1[];
  metadata: 'preserved' | 'removed' | 'changed' | 'not-checked';
  /** Location of processing, not a promise of an offline model or codec. */
  execution: 'device' | 'instance';
}

/** One portable basename. Directory layout is a separate, host-authorized choice. */
export function safeFileName(name: string, fallback = 'file'): string {
  const clean = (value: string): string => value.normalize('NFC').replace(/\\/g, '/')
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what a safe file name must shed
    .split('/').pop()!.replace(/[\u0000-\u001f\u007f-\u009f<>:"|?*]/g, '-')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '').trim().replace(/[. ]+$/, '');
  let base = clean(name) || clean(fallback) || 'file';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `_${base}`;
  // Bound UTF-8 bytes, including multi-byte names on native filesystems.
  const encoder = new TextEncoder();
  if (encoder.encode(base).length > 220) {
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 && base.length - dot <= 16 ? base.slice(dot) : '';
    const chars = [...(ext ? base.slice(0, dot) : base)];
    while (chars.length && encoder.encode(chars.join('') + ext).length > 220) chars.pop();
    base = chars.join('') + ext;
  }
  return base;
}

/** The returned name is reserved immediately, including generated suffixes. */
export function allocateFileName(name: string, reserved: Set<string>): string {
  const base = safeFileName(name);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let candidate = base;
  for (let n = 2; reserved.has(candidate.normalize('NFC').toLowerCase()); n++) {
    candidate = `${stem}-${n}${ext}`;
  }
  reserved.add(candidate.normalize('NFC').toLowerCase());
  return candidate;
}

/** Accept the two existing checksum spellings without changing asset identities. */
export function normalizeSha256(value: string): string | null {
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = 0, count = 0, hex = '';
  for (const char of value.slice(7, -1)) {
    bits = (bits << 6) | alphabet.indexOf(char); count += 6;
    if (count >= 8) {
      count -= 8;
      hex += ((bits >>> count) & 255).toString(16).padStart(2, '0');
    }
  }
  return hex.length === 64 && (bits & ((1 << count) - 1)) === 0 ? hex : null;
}
