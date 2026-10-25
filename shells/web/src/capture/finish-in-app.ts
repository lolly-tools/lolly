// SPDX-License-Identifier: MPL-2.0
/**
 * Finish a page walk inside the Lolly app, for the shells whose capture runs in a
 * browser the app drives rather than in Node: the desktop app (headless Chrome
 * over its own DevTools connection) and the web app with the Chrome extension.
 *
 * The shell hands over what it read out of the captured tab: the walk, a
 * screenshot of the same moment, and the bytes of the pictures, stylesheets and
 * font files the walk named, from the tab's own cache. This inlines the pictures,
 * outlines the text with the app's own text shaper (packages/node-shell/src/
 * page-text.ts, the same choice of face the CLI makes), fills the region boxes from
 * the screenshot and scores the result. The caller decides whether the score is
 * good enough to keep.
 */
import { outlinePageText, type PageTextFonts, type PageTextRun } from '@lolly-tools/node-shell/page-text';
import type { TextAPI } from '@lolly-tools/core/host-v1';
import { finishPageVector } from './page-finish.ts';

/** What a capturing shell read out of the tab (see PageWalkResult for `walk`). */
export interface WalkCapture {
  walk: {
    svg: string;
    width: number;
    height: number;
    warnings: string[];
    unresolved: string[];
    text: { runs: PageTextRun[]; fonts: PageTextFonts };
  };
  /** PNG of the viewport at the moment of the walk, base64. */
  shot: string;
  /** Screenshot pixels per CSS px. */
  scale: number;
  /** Bytes from the tab's cache, by URL: base64 plus the type the tab recorded. */
  resources: Record<string, { base64: string; mime: string }>;
}

export interface FinishedCapture {
  svg: string;
  width: number;
  height: number;
  /** Share of coarse cells that differ from the screenshot, in [0,1]. */
  distance: number;
  warnings: string[];
  stats: { resolved: number; unresolved: number; outlined: number; textKept: number; regions: number; dropped: number };
}

const xmlAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function bytesOf(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function finishWalkCapture(cap: WalkCapture, text: Pick<TextAPI, 'toPath'>): Promise<FinishedCapture> {
  const warnings = [...cap.walk.warnings];
  let svg = cap.walk.svg;

  // Pictures the page could not hand over, from the tab's cache.
  let resolved = 0;
  const missing: string[] = [];
  for (const url of cap.walk.unresolved) {
    const r = cap.resources[url];
    if (r && /^image\//.test(r.mime)) {
      svg = svg.split(`href="${xmlAttr(url)}"`).join(`href="data:${r.mime};base64,${r.base64}"`);
      resolved++;
    } else missing.push(url);
  }
  if (missing.length) warnings.push(`${missing.length} image(s) could not be read from the page`);

  // Text, outlined from the faces the page loaded. The shaper reads its font from a
  // URL, so each decoded face gets a blob URL for the length of this call.
  const blobs: string[] = [];
  try {
    const out = await outlinePageText(svg, cap.walk.text.runs, cap.walk.text.fonts, {
      fontBytes: async (url) => (cap.resources[url] ? bytesOf(cap.resources[url]!.base64) : null),
      sheetText: async (url) => (cap.resources[url] ? new TextDecoder().decode(bytesOf(cap.resources[url]!.base64)) : null),
      fontUrl: async (sfnt) => {
        const url = URL.createObjectURL(new Blob([sfnt as BlobPart], { type: 'font/ttf' }));
        blobs.push(url);
        return url;
      },
      toPath: (o) => text.toPath(o),
    });
    if (out.unreadable.length) warnings.push(`${out.unreadable.length} font file(s) could not be read; their text stays as text`);
    const fin = await finishPageVector({ svg: out.svg, shot: cap.shot, scale: cap.scale, score: true });
    return {
      svg: fin.svg,
      width: cap.walk.width,
      height: cap.walk.height,
      distance: fin.distance ?? 1,
      warnings,
      stats: { resolved, unresolved: missing.length, outlined: out.outlined, textKept: out.kept, regions: fin.filled, dropped: fin.dropped },
    };
  } finally {
    for (const url of blobs) URL.revokeObjectURL(url);
  }
}
