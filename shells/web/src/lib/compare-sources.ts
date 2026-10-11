// SPDX-License-Identifier: MPL-2.0
import type { ComparisonIdentity, ComparisonSource } from '@lolly-tools/core/host-v1';
import { comparisonTableBytes, comparisonTableTextSource } from './compare-table-sources.ts';
import { comparisonDocumentBytes } from './compare-document-sources.ts';
export type ContentComparisonMode = 'text' | 'json' | 'table' | 'document';
const MAX_BYTES = 2 * 1024 * 1024;
/** Parsing is local and data-only. Parser messages/snippets are never surfaced. */
export function comparisonTextSource(text: string, identity: ComparisonIdentity, mode: 'text' | 'json' | 'table'): ComparisonSource {
  if (text.length > MAX_BYTES) throw new Error('Choose text up to 2 MiB per side.');
  if (mode === 'table') return comparisonTableTextSource(text, identity);
  if (mode === 'text') return { identity, content: { kind: 'text', text } };
  try { return { identity, content: { kind: 'structure', value: JSON.parse(text) } }; }
  catch { throw new Error('This side is not valid JSON. Correct it or choose Text mode.'); }
}
export async function comparisonFileSource(file: File, mode: ContentComparisonMode, signal?: AbortSignal): Promise<ComparisonSource> {
  if (file.size > (mode === 'table' || mode === 'document' ? 32 * 1024 * 1024 : MAX_BYTES)) throw new Error(mode === 'table' || mode === 'document' ? 'Choose files up to 32 MiB per side.' : 'Choose files up to 2 MiB per side.');
  signal?.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  const identity: ComparisonIdentity = { id: crypto.randomUUID(), kind: 'file', label: file.name };
  const format = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (mode === 'document') return comparisonDocumentBytes(bytes, identity, format, signal);
  if (mode === 'table') {
    if (!['csv', 'tsv', 'xlsx'].includes(format)) throw new Error('Choose an XLSX, CSV or TSV table.');
    return comparisonTableBytes(bytes, identity, format, signal);
  }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('This file is not UTF-8 text. For images or PDFs, choose Images / PDF pages.'); }
  if (text.includes('\0')) throw new Error('This file contains binary data. Choose a text or JSON file.');
  return { ...comparisonTextSource(text, identity, mode), bytes };
}
