// SPDX-License-Identifier: MPL-2.0
import type { ComparisonIdentity, ComparisonSource } from '@lolly-tools/core/host-v1';
const MAX_BYTES = 2 * 1024 * 1024;
/** Parsing is local and data-only. Parser messages/snippets are never surfaced. */
export function comparisonTextSource(text: string, identity: ComparisonIdentity, mode: 'text' | 'json'): ComparisonSource {
  if (text.length > MAX_BYTES) throw new Error('Choose text up to 2 MiB per side.');
  if (mode === 'text') return { identity, content: { kind: 'text', text } };
  try { return { identity, content: { kind: 'structure', value: JSON.parse(text) } }; }
  catch { throw new Error('This side is not valid JSON. Correct it or choose Text mode.'); }
}
export async function comparisonFileSource(file: File, mode: 'text' | 'json', signal?: AbortSignal): Promise<ComparisonSource> {
  if (file.size > MAX_BYTES) throw new Error('Choose files up to 2 MiB per side.');
  signal?.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('This file is not UTF-8 text. For images or PDFs, choose Images / PDF pages.'); }
  if (text.includes('\0')) throw new Error('This file contains binary data. Choose a text or JSON file.');
  return { ...comparisonTextSource(text, { id: crypto.randomUUID(), kind: 'file', label: file.name }, mode), bytes };
}
