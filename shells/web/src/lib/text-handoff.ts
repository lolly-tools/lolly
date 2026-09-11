// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { navigateTo } from '../nav.ts';
import { syntaxLanguageForFile } from './syntax-preview.ts';
export interface TextSource {
  assetId?: string;
  name?: string;
  format?: string;
  version?: string;
  digest?: string;
  writable?: boolean;
  folderId?: string;
  origin?: string;
  aiGenerated?: string;
  aiEdited?: boolean;
}
export interface TextHandoff {
  text: string;
  source: TextSource;
  language?: string;
}
let pending: TextHandoff | null = null;
export function takeTextHandoff(): TextHandoff | null {
  const value = pending;
  pending = null;
  return value;
}
export function openTextHandoff(value: TextHandoff): void {
  pending = value;
  navigateTo(`#/tool/text-helper?slot=text-${crypto.randomUUID()}`);
}
export function wireTextHandoffs(root: HTMLElement, afterCleanup?: () => void): () => void {
  const onClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-open-text]') : null;
    if (!button || !root.contains(button)) return;
    openTextHandoff({
      text: button.dataset.openText ?? '',
      source: { name: 'verified-text.txt', origin: 'Verify' },
    });
  };
  root.addEventListener('click', onClick);
  return () => {
    root.removeEventListener('click', onClick);
    afterCleanup?.();
  };
}
export const textAssetSupported = (ref: AssetRef): boolean =>
  ref.type === 'text' ||
  (ref.type === 'data' && ['csv', 'tsv', 'json', 'jsonl'].includes(String(ref.format)));
export async function textDigest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function readTextAsset(
  host: HostV1,
  ref: AssetRef,
  folderId?: string
): Promise<TextHandoff> {
  if (!textAssetSupported(ref)) throw new Error('Choose a text or code asset.');
  const bytes = host.assets.bytes
    ? await host.assets.bytes(ref)
    : new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Open a text excerpt of 4 MiB or less.');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (text.includes('\u0000')) throw new Error('This file contains binary data.');
  const name = String(ref.meta?.name ?? ref.id.split('/').pop() ?? 'text.txt');
  return {
    text,
    language: syntaxLanguageForFile(name.includes('.') ? name : `file.${ref.format}`),
    source: {
      assetId: ref.id,
      name,
      format: String(ref.format ?? 'txt'),
      version: String(ref.version ?? ''),
      digest: await textDigest(text),
      writable: ref.source === 'user',
      folderId,
      origin: folderId ? 'Projects' : 'Catalog',
      aiGenerated: typeof ref.meta?.aiGenerated === 'string' ? ref.meta.aiGenerated : undefined,
    },
  };
}
export async function openAssetInText(
  host: HostV1,
  ref: AssetRef,
  folderId?: string
): Promise<void> {
  openTextHandoff(await readTextAsset(host, ref, folderId));
}
