// SPDX-License-Identifier: MPL-2.0
/**
 * `host.viz` - what a tool can ask about the MilkDrop visualizer.
 *
 * Deliberately NOT a mounting API. A tool is data: it has no element to hand us and no
 * business holding a WebGL context, so the surface it actually renders is a
 * `[data-lolly-viz]` placeholder that lib/viz-tool-mount.ts enhances after each paint.
 * What a tool genuinely can't work out for itself is (a) whether this shell can run a
 * visualizer at all, so it can choose a fallback style, and (b) WHO WROTE the preset it
 * is about to show - which is the whole point of shipping the artist presets. Both are
 * answered here.
 *
 * Progressive enhancement, not a capability: `isAvailable()` false (no WebGL2, a
 * headless CLI render) means the tool draws its ordinary canvas style, never that it
 * refuses to render.
 */
import type { VizAPI, VizPresetInfo } from '@lolly-tools/core/host-v1';
import { vizSupported } from '../lib/viz-support.ts';

export type { VizAPI, VizPresetInfo };

export function createVizAPI(): VizAPI {
  let cache: Promise<VizPresetInfo[]> | null = null;
  return {
    isAvailable: () => vizSupported(),
    presets(): Promise<VizPresetInfo[]> {
      // Memoised, and both halves are dynamic: the preset registry pulls in the whole
      // GLSL builder and the artist index costs a fetch, neither of which should land
      // in the boot chunk for a tool nobody has opened.
      cache ??= (async () => {
        const [{ VIZ_PRESETS }, { stockPresetIndex }] = await Promise.all([
          import('../lib/viz-presets.ts'),
          import('../lib/viz-stock.ts'),
        ]);
        const ours = VIZ_PRESETS.map((d) => ({ id: d.id, name: d.name, author: 'Lolly', calm: d.calm }));
        const stock = (await stockPresetIndex()).map((s) => ({
          id: `stock:${s.id}`,
          name: s.name,
          author: s.author,
          calm: false,
        }));
        return [...ours, ...stock];
      })().catch(() => []);
      return cache;
    },
  };
}
