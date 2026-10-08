// SPDX-License-Identifier: MPL-2.0
import type { DrawStrikeMetrics } from '../../../../engine/src/design-draw.ts';

// Drawing borrows the text implementation's cached font facts without adding a
// tool-facing capability or importing the font engine into the export walker.
const strikeProviders = new WeakMap<object, DrawStrikeMetrics>();

export function registerTextStrikeMetrics(text: object, provider: DrawStrikeMetrics): void {
  strikeProviders.set(text, provider);
}

export function textStrikeMetrics(text: object): DrawStrikeMetrics | undefined {
  return strikeProviders.get(text);
}

export function registerLazyTextStrikeMetrics(text: object, load: () => Promise<object>): void {
  registerTextStrikeMetrics(text, async (font, variations) => textStrikeMetrics(await load())?.(font, variations) ?? null);
}
