// SPDX-License-Identifier: MPL-2.0

// ─── MilkDrop visualisation (optional, v1.72) ─────────────────────────────────

export interface VizAPI {
  /** Synchronous, so a hook can branch on it before deciding what to analyse. */
  isAvailable(): boolean;
  /** Ours first, then the artist pack (empty when it isn't staged in this build). */
  presets(): Promise<VizPresetInfo[]>;
}

/**
 * A preset the visualiser can run, with the attribution a credit line needs.
 * Artist presets are prefixed `stock:`.
 */
export interface VizPresetInfo {
  id: string;
  name: string;
  /**
   * Who authored it. Twenty years of MilkDrop craft ships alongside our own
   * presets, and a tool showing one is expected to say whose it is - so credit
   * only a preset the shell CONFIRMS it has: naming an artist whose work is not
   * on screen (a pack that isn't staged falls back to a brand-native preset) is
   * worse than crediting nobody.
   */
  author: string;
  /** Safe to offer under prefers-reduced-motion. */
  calm: boolean;
}
