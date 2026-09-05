// SPDX-License-Identifier: MPL-2.0

import type { LiftResult } from './capture.ts';

export interface LiftAPI {
  /**
   * Lift an SVG - named by URL (a catalog/library asset, an uploaded `blob:`, or a
   * `data:` URL) - into its own layers. The shell fetches + sanitises the markup through
   * its one untrusted-SVG path, then runs the engine's `enumerateSvgLayers`. Returns the
   * layers in paint order as standalone SVG documents + their ink boxes, and the source
   * viewBox. A source that is not an SVG, or has fewer than two layers, comes back with
   * `layers: []` (the caller then treats the shot as a single plane) - this method never
   * throws on "nothing to lift", only on a fetch/parse failure the caller should surface.
   */
  svg(source: string): Promise<LiftResult>;
}
