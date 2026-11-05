// SPDX-License-Identifier: MPL-2.0

package tools.lolly.fold

/**
 * What the plugin reports for one folding feature, in the units Android
 * gives: window pixels. The Rust side (fold.rs) converts it to CSS pixels
 * relative to the web view, validates it and emits it, so this class carries
 * no conversion logic.
 */
data class FoldReport(
  /** FoldingFeature.State.toString(): FLAT or HALF_OPENED. */
  val state: String,
  /** FoldingFeature.Orientation.toString(): VERTICAL or HORIZONTAL. */
  val orientation: String,
  /** FoldingFeature.OcclusionType.toString(): NONE or FULL. */
  val occlusion: String,
  val isSeparating: Boolean,
  /** FoldingFeature.bounds, in window pixels. */
  val left: Int,
  val top: Int,
  val right: Int,
  val bottom: Int,
  /** Where the web view sits in the window, in pixels. */
  val viewX: Int,
  val viewY: Int,
  /** Pixels per CSS pixel. */
  val density: Float,
)
