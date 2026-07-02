// SPDX-License-Identifier: MPL-2.0
/**
 * ZIP bundle — several of the tool's render formats in one archive. The shell
 * passes opts.bundleFormats (visual formats only — data/video are excluded).
 * Each entry renders through the registry on the already-snapshotted node (the
 * outer render() applied the watermark once), then is zipped.
 */

import { zipSync } from 'fflate';
import type { FormatAdapter, RenderContext } from './types.ts';

export const zipAdapter: FormatAdapter = {
  formats: ['zip'],
  async render(ctx: RenderContext): Promise<Blob> {
    const { opts } = ctx;
    const base = (opts.filename || 'export').replace(/\.[a-z0-9]+$/i, '') || 'export';
    const files: Record<string, Uint8Array> = {};
    for (const f of (opts.bundleFormats ?? []).filter(x => x !== 'zip')) {
      const blob = await ctx.renderFormat(f, opts);
      const name = f === 'pdf-cmyk' ? `${base}-print.pdf` : `${base}.${f === 'jpeg' ? 'jpg' : f}`;
      files[name] = new Uint8Array(await blob.arrayBuffer());
    }
    return new Blob([zipSync(files)], { type: 'application/zip' });
  },
};
