// SPDX-License-Identifier: MPL-2.0
import { THREE_MF_UPLOAD_LIMIT, threeMfThumbnail } from './three-mf.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

interface ModelUploadHost {
  assets: {
    get(id: string): Promise<AssetRef>;
    _uploadUserAsset(record: {
      id: string;
      type: 'model' | 'data';
      format: string;
      blob: Blob;
      version: string;
      meta: Record<string, unknown>;
    }): Promise<void>;
  };
}

/** Store mesh bytes for reusable sessions; other files continue through their importer. */
export async function tryStoreModelUpload(
  host: ModelUploadHost,
  file: File
): Promise<AssetRef | null> {
  if (
    !/\.(glb|stl|3mf)$/i.test(file.name) &&
    ![
      'model/gltf-binary',
      'model/3mf',
      'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    ].includes(file.type)
  )
    return null;
  const format =
    /\.3mf$/i.test(file.name) || /3mf|3dmanufacturing/.test(file.type)
      ? '3mf'
      : /\.stl$/i.test(file.name)
        ? 'stl'
        : 'glb';
  const limit = format === '3mf' ? THREE_MF_UPLOAD_LIMIT : 32 * 1024 * 1024;
  if (!file.size || file.size > limit)
    throw new Error(`Use a model between 1 byte and ${limit / 1024 / 1024} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const view = new DataView(bytes.buffer);
  if (format === 'glb') {
    if (
      bytes.length < 20 ||
      view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== bytes.length
    )
      throw new Error('Use a valid glTF 2.0 binary (.glb) file.');
  } else if (format === 'stl') {
    const binary = bytes.length >= 84 && 84 + view.getUint32(80, true) * 50 === bytes.length;
    const ascii =
      /^\s*solid\b/i.test(new TextDecoder().decode(bytes.subarray(0, 256))) &&
      /\bfacet\s+normal\b/i.test(new TextDecoder().decode(bytes.subarray(0, 4096)));
    if (!binary && !ascii) throw new Error('Use a binary or ASCII STL mesh.');
  }
  let posterUrl = '';
  if (format === '3mf') {
    let poster = threeMfThumbnail(bytes);
    try {
      const { renderStudioPoster } = await import('./studio3d/poster.ts');
      poster = await renderStudioPoster(
        {
          source: 'model',
          modelFormat: '3mf',
          modelAsset: { url: 'upload.3mf', name: file.name },
          materialMode: 'source',
          motion: 'still',
        },
        384,
        384,
        0,
        'preview',
        async () => bytes,
        undefined,
        new AbortController().signal
      );
    } catch {
      /* Oversized meshes and unavailable WebGL keep the package's plate image. */
    }
    if (poster)
      posterUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(poster!);
      });
  }
  const id = `user/upload/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
  await host.assets._uploadUserAsset({
    id,
    type: 'model',
    format,
    blob: file,
    version: '1.0.0',
    meta: {
      name: file.name,
      tags: ['3d', format],
      size: file.size,
      ...(posterUrl ? { posterUrl } : {}),
    },
  });
  return host.assets.get(id);
}

export const RADIANCE_UPLOAD_LIMIT = 64 * 1024 * 1024;

export const isRadianceAsset = (ref: { type: string; format?: string }): boolean =>
  ref.type === 'data' && (ref.format === 'hdr' || ref.format === 'exr');

/** Radiance .hdr starts with `#?`; OpenEXR starts with the magic 76 2f 31 01. */
export function radianceFormat(bytes: Uint8Array): 'hdr' | 'exr' | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x76 &&
    bytes[1] === 0x2f &&
    bytes[2] === 0x31 &&
    bytes[3] === 0x01
  )
    return 'exr';
  if (bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x3f) return 'hdr';
  return null;
}

/** Store an equirectangular radiance map as data bytes; display images never qualify. */
export async function tryStoreRadianceUpload(
  host: ModelUploadHost,
  file: File
): Promise<AssetRef | null> {
  const named = /\.(hdr|exr)$/i.test(file.name) || /radiance|x-exr|aces/i.test(file.type);
  if (!named) return null;
  if (!file.size || file.size > RADIANCE_UPLOAD_LIMIT)
    throw new Error('Use a radiance map between 1 byte and 64 MB.');
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format = radianceFormat(head);
  if (!format)
    throw new Error(
      'This file is not a Radiance .hdr or OpenEXR .exr map. A PNG or JPEG is a display image and cannot light a scene.'
    );
  const id = `user/upload/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`;
  await host.assets._uploadUserAsset({
    id,
    type: 'data',
    format,
    blob: file,
    version: '1.0.0',
    meta: {
      name: file.name,
      tags: ['3d', 'environment'],
      size: file.size,
      projection: 'equirectangular',
    },
  });
  return host.assets.get(id);
}
