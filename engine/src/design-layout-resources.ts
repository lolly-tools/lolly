// SPDX-License-Identifier: MPL-2.0
/** Font role names for layout measurement, matching the canvas's brand font variables. */
import type { TokenSet, TokensAPI } from '@lolly-tools/core/host-v1';
import type { TextMeasureFontsV1 } from '@lolly-tools/core/text-measure-v1';
import {
  measureDesignText,
  TEXT_MEASURE_DEFAULT_FONTS,
  textMeasureSpecOfRow,
  type TextShaperV1,
} from './design-text-measure.ts';
import type { LayoutMeasure } from './design-layout.ts';

const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

/** The canvas accepts a plain family string or an ordered DTCG family array. */
export function designLayoutFontFamily(value: unknown): string | undefined {
  for (const name of Array.isArray(value) ? value : [value]) {
    if (typeof name !== 'string' || name.trim().startsWith('{')) continue;
    const family = name
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim();
    if (FAMILY.test(family)) return family;
  }
  return undefined;
}

/** Resolve all slots from one token set, so a brand change cannot mix two reads. */
export function designLayoutFontsOf(set?: TokenSet): TextMeasureFontsV1 {
  const fonts: TextMeasureFontsV1 = { ...TEXT_MEASURE_DEFAULT_FONTS };
  for (const slot of ['brand', 'mono', 'display', 'italic'] as const) {
    const family = set?.has(`font.${slot}`)
      ? designLayoutFontFamily(set.resolve(`font.${slot}`))
      : undefined;
    if (family) fonts[slot] = family;
  }
  return fonts;
}

export async function resolveDesignLayoutFonts(tokens?: TokensAPI): Promise<TextMeasureFontsV1> {
  return designLayoutFontsOf(tokens ? await tokens.get() : undefined);
}

/** Only successful measurements are retained, within both an entry and a key byte budget. */
export function createDesignLayoutMeasurer(
  shaper: TextShaperV1,
  fonts: TextMeasureFontsV1,
  resourceRevision: string,
  keyByteBudget = 4 * 1024 * 1024
): LayoutMeasure {
  const cache = new Map<string, { width: number; height: number }>();
  let keyBytes = 0;
  return async (row, width) => {
    const spec = textMeasureSpecOfRow({ ...row, w: width }, fonts);
    delete spec.height;
    const key = JSON.stringify([resourceRevision, spec]),
      bytes = key.length * 2;
    const hit = cache.get(key);
    if (hit) return hit;
    const measured = await measureDesignText(spec, shaper);
    if (measured.uncovered?.length)
      throw new Error(`The layout font cannot draw ${measured.uncovered.join(', ')}.`);
    const result = {
      width: Math.max(0, ...measured.lines.map((line) => line.width)) + 2 * measured.pad,
      height: measured.height,
    };
    const concurrent = cache.get(key);
    if (concurrent) return concurrent;
    if (bytes <= keyByteBudget) {
      while (cache.size && (cache.size >= 512 || keyBytes + bytes > keyByteBudget)) {
        const oldest = cache.keys().next().value!;
        keyBytes -= oldest.length * 2;
        cache.delete(oldest);
      }
      cache.set(key, result);
      keyBytes += bytes;
    }
    return result;
  };
}
