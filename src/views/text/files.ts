// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { FolderHost } from '../../folders.ts';
import {
  readTextAsset,
  textDigest,
  type TextHandoff,
  type TextSource,
} from '../../lib/text-handoff.ts';
import { syntaxLanguageForFile } from '../../lib/syntax-preview.ts';
export async function readTextFile(file: File): Promise<TextHandoff> {
  if (file.size > 4 * 1024 * 1024) throw new Error('Open a text excerpt of 4 MiB or less.');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    await file.arrayBuffer()
  );
  if (text.includes('\u0000')) throw new Error('This file contains binary data.');
  return {
    text,
    source: { name: file.name, format: file.name.split('.').pop() ?? 'txt', origin: 'File' },
    language: syntaxLanguageForFile(file.name),
  };
}
export async function saveTextAsset(
  host: HostV1,
  text: string,
  source: TextSource,
  name: string,
  replace: boolean
): Promise<TextSource> {
  const { storeUserUpload, replaceUserUpload } = await import('../picker.ts');
  if (replace) {
    if (!source.assetId || !source.writable)
      throw new Error('This source is read-only. Save a copy instead.');
    const current = await readTextAsset(host, await host.assets.get(source.assetId));
    if (current.source.digest !== source.digest)
      throw new Error(
        'The source has changed since you opened it. Save a copy to keep both versions.'
      );
  }
  const file = new File([text], name, {
    type: /\.(md|markdown)$/i.test(name) ? 'text/markdown' : 'text/plain',
  });
  const ref = replace
    ? await replaceUserUpload(
        host as Parameters<typeof replaceUserUpload>[0],
        source.assetId!,
        file
      )
    : await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file, {
        skipDupCheck: true,
      });
  const assets = host.assets as HostV1['assets'] & {
    _updateUserAssetMeta?: (
      id: string,
      meta: Record<string, unknown>,
      patch: { aiGenerated?: 'partial' | 'full' | null }
    ) => Promise<void>;
  };
  if (source.aiEdited || source.aiGenerated) {
    await assets._updateUserAssetMeta?.(
      ref.id,
      { ...ref.meta, textSource: source.assetId ?? source.origin, aiOriginsDeclared: true },
      {
        aiGenerated: source.aiEdited
          ? 'partial'
          : source.aiGenerated === 'full'
            ? 'full'
            : 'partial',
      }
    );
  }
  if (!replace && source.folderId) {
    const { createFolderStore } = await import('../../folders.ts');
    const profile = host.profile as HostV1['profile'] & Partial<FolderHost['profile']>;
    if (!profile.set) throw new Error('This shell cannot save project membership.');
    const setProfile = profile.set.bind(profile);
    await createFolderStore({
      profile: { get: () => profile.get(), set: setProfile },
      state: host.state,
      assets: {
        _listUserAssets: async () =>
          (await host.assets.query({ includeDeprecated: true })).filter(
            (asset) => asset.source === 'user'
          ),
        _listCatalogAssetIds: async () =>
          (await host.assets.query({ includeDeprecated: true }))
            .filter((asset) => asset.source !== 'user')
            .map((asset) => asset.id),
      },
    }).addItem(source.folderId, { type: 'image', ref: ref.id });
  }
  return {
    ...source,
    assetId: ref.id,
    name,
    format: String(ref.format ?? source.format ?? 'txt'),
    version: String(ref.version ?? ''),
    digest: await textDigest(text),
    writable: true,
  };
}
