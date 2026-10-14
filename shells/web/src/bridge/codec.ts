// SPDX-License-Identifier: MPL-2.0
import { installToolByteVerification } from '../catalog/tool-bytes.ts';
import type { CodecAPI, AssetsAPI } from '@lolly-tools/core/host-v1';
import { createDeepCodec } from '../../../../engine/src/deep-codec-api.ts';
import { createRasterAPI } from './raster.ts';
import { runJxl } from './jxl.ts';
export function createCodecAPI(assets?: Pick<AssetsAPI, 'bytes'>): CodecAPI {
  return createDeepCodec({
    jxl: request => runJxl(request),
    async bytes(source) {
      if (source instanceof Uint8Array) return source;
      if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
      if (typeof source !== 'string') {
        if (!assets) throw new Error('Original asset access is unavailable.');
        return assets.bytes!(source);
      }
      installToolByteVerification();
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Could not read HDR source (${response.status}).`);
      return new Uint8Array(await response.arrayBuffer());
    },
    async sdr(bytes) {
      const bitmap = await createRasterAPI().decode(bytes);
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('SDR pixel decoding is unavailable.');
        ctx.drawImage(bitmap, 0, 0);
        return { width: bitmap.width, height: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
      } finally { bitmap.close(); }
    },
  });
}
