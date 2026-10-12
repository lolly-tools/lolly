// SPDX-License-Identifier: MPL-2.0
import type { ComparisonIdentity, ComparisonRequest, ComparisonSource } from '@lolly-tools/core/host-v1';
import { comparisonTableBytes, comparisonTableTextSource } from './compare-table-sources.ts';
import { comparisonDocumentBytes } from './compare-document-sources.ts';
export type ContentComparisonMode = 'text' | 'json' | 'yaml' | 'table' | 'document';
export type ContentComparisonOverride = 'document' | 'yaml' | 'text';
const MAX_BYTES = 2 * 1024 * 1024;
export const YAML_COMPARISON_NOTE = 'Compare one YAML 1.2 data document per side. Comments and formatting are not compared. Choose Text to review them.';
export function yamlComparisonFormats(formats: readonly (string | undefined)[]): boolean {
  const values = formats.map(format => format?.toLowerCase());
  return values.length === 2 && values.every(format => format && ['yaml', 'yml', 'json'].includes(format))
    && values.some(format => format === 'yaml' || format === 'yml');
}
/** Every entry point supplies the same selected semantic mode to the shared API. */
export function comparisonRequest(before: ComparisonSource, after: ComparisonSource, mode: ContentComparisonMode): ComparisonRequest {
  if (mode === 'yaml') return { version: 1, before, after, options: { mode: 'structure' } };
  return { version: 1, before, after };
}
/** YAML stays raw for the shared engine parser. JSON errors never expose snippets. */
export function comparisonTextSource(text: string, identity: ComparisonIdentity, mode: 'text' | 'json' | 'yaml' | 'table'): ComparisonSource {
  if (text.length > MAX_BYTES) throw new Error('Choose text up to 2 MiB per side.');
  if (mode === 'table') return comparisonTableTextSource(text, identity);
  if (mode === 'yaml') return { identity, content: { kind: 'yaml', text } };
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
  if (text.includes('\0')) throw new Error('This file contains binary data. Choose a text, JSON or YAML file.');
  return { ...comparisonTextSource(text, identity, mode), bytes };
}
