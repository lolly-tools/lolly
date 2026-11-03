// SPDX-License-Identifier: MPL-2.0

package tools.lolly.fold

import android.app.Activity
import android.view.View
import android.webkit.WebView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.launch

/**
 * Reports the folding feature (hinge or fold) from Jetpack WindowManager.
 *
 * Every report goes to the Rust half through the stock Tauri listener
 * channel (event name "fold"), as { feature: {...} } or { feature: null }.
 * Rust converts it, drops repeats and emits `lolly://fold`. Collection follows
 * the activity lifecycle (STARTED), so nothing runs in the background, and a
 * resume re-reports the layout.
 */
@TauriPlugin
class LollyFoldPlugin(private val activity: Activity) : Plugin(activity) {
  private var webView: WebView? = null
  private var layout: WindowLayoutInfo? = null

  private val relayout = View.OnLayoutChangeListener { _, l, t, r, b, oldLeft, oldTop, oldRight, oldBottom ->
    // The web view moving or resizing (system bars, a navigation rail, split
    // screen) moves the fold relative to it even when the fold did not change.
    if (l != oldLeft || t != oldTop || r != oldRight || b != oldBottom) publish()
  }

  override fun load(webView: WebView) {
    this.webView = webView
    webView.addOnLayoutChangeListener(relayout)
    val owner = activity as? LifecycleOwner ?: return
    owner.lifecycleScope.launch {
      owner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        WindowInfoTracker.getOrCreate(activity).windowLayoutInfo(activity).collect { info ->
          layout = info
          publish()
        }
      }
    }
  }

  /** The first folding feature, or null for a cover screen or a non-foldable. */
  private fun feature(): FoldingFeature? =
    layout?.displayFeatures?.filterIsInstance<FoldingFeature>()?.firstOrNull()

  private fun publish() {
    // Before the first WindowLayoutInfo there is nothing to say.
    if (layout == null) return
    val report = feature()?.let { toReport(it) }
    val message = JSObject()
    if (report == null) {
      message.put("feature", org.json.JSONObject.NULL)
    } else {
      message.put("feature", report.toJson())
    }
    trigger("fold", message)
  }

  private fun toReport(feature: FoldingFeature): FoldReport {
    val where = IntArray(2)
    webView?.getLocationInWindow(where)
    val bounds = feature.bounds
    return FoldReport(
      state = feature.state.toString(),
      orientation = feature.orientation.toString(),
      occlusion = feature.occlusionType.toString(),
      isSeparating = feature.isSeparating,
      left = bounds.left,
      top = bounds.top,
      right = bounds.right,
      bottom = bounds.bottom,
      viewX = where[0],
      viewY = where[1],
      density = activity.resources.displayMetrics.density,
    )
  }

  private fun FoldReport.toJson(): JSObject =
    JSObject()
      .put("state", state)
      .put("orientation", orientation)
      .put("occlusion", occlusion)
      .put("isSeparating", isSeparating)
      .put("left", left)
      .put("top", top)
      .put("right", right)
      .put("bottom", bottom)
      .put("viewX", viewX)
      .put("viewY", viewY)
      .put("density", density.toDouble())
}
