package tools.lolly.mobile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

class MainActivity : TauriActivity() {
  private class PendingShare(val name: String, val mime: String, val bytes: ByteArray)

  // Single inbound-share slot, latest wins. Written on a reader thread, read from the
  // WebView's JavaBridge thread - volatile store publishes the fully-built PendingShare.
  @Volatile private var pendingShare: PendingShare? = null
  // Single inbound App-Link slot (ACTION_VIEW https://lolly.tools/t/…), latest wins,
  // consumed on read - the same cold-poll + warm-event pattern as the share slot.
  @Volatile private var pendingLink: String? = null
  @Volatile private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Hardware/gesture Back walks the WEB layer first: the shell pushes one
    // same-URL history entry per open overlay (components/modal.ts +
    // lib/overlay-back.ts), so canGoBack() is true while a dialog or menu is up
    // and goBack() fires the popstate that closes just that overlay; with none
    // open it walks the in-app route history. TauriActivity's default never
    // consults WebView history, which made every Back press exit the app.
    // Registered after super.onCreate so this callback outranks any default
    // (dispatcher order is last-in-first-served); at the true history root it
    // steps aside and the system default (exit) runs.
    onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val wv = webView
        if (wv != null && wv.canGoBack()) {
          wv.goBack()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
          isEnabled = true
        }
      }
    })
    // Only ingest on a genuinely fresh launch. setIntent() below only clears
    // in-process state - after a process death (Android reclaiming memory while
    // backgrounded), the system redelivers its own persisted launch Intent, which
    // is still the ORIGINAL ACTION_SEND, and would otherwise resurrect an
    // already-handled share out of nowhere. onNewIntent (live delivery while the
    // activity is already running) is unaffected - it has no such guard.
    if (savedInstanceState == null) {
      ingestShareIntent(intent)
      ingestViewIntent(intent)
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    ingestShareIntent(intent)
    ingestViewIntent(intent)
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    // The export bridge override (bridge-overrides/export.js) calls this after saving a
    // file so the user gets the OS share sheet instead of hunting for the app-private
    // Downloads dir. Exposed to every script in the WebView, so it only ever shares
    // files it can prove live under our own export root - nothing else.
    webView.addJavascriptInterface(ShareBridge(), "LollyShare")
  }

  /** Inbound ACTION_SEND / ACTION_SEND_MULTIPLE: stash the shared file for the JS side. */
  private fun ingestShareIntent(intent: Intent?) {
    val action = intent?.action ?: return
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return
    // Consume the intent so an activity recreate doesn't re-ingest the same share.
    setIntent(Intent(this, javaClass))
    val uri: Uri?
    if (action == Intent.ACTION_SEND_MULTIPLE) {
      val uris = if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION") intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
      }
      if ((uris?.size ?: 0) > 1) {
        Toast.makeText(this, "Lolly imports one file at a time - using the first", Toast.LENGTH_LONG).show()
      }
      uri = uris?.firstOrNull()
    } else {
      uri = if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
      }
    }
    // Files only in v1 (EXTRA_TEXT-only shares ignored); content:// only - a file:// Uri
    // from another app could point into our own private storage.
    if (uri == null || uri.scheme != "content") return
    stashInboundFile(uri, intent.type)
  }

  /** Read one provider-backed document into the same bounded slot used by the
   *  Android share target. ACTION_SEND and an ACTION_VIEW from Files therefore
   *  reach one JS intake and one universal Lolly chooser. */
  private fun stashInboundFile(uri: Uri, intentType: String?) {
    Thread {
      val name = shareDisplayName(uri)
      val mime = shareMime(intentType, uri)
      val bytes = readShareCapped(uri) ?: return@Thread
      pendingShare = PendingShare(name, mime, bytes)
      // Warm delivery; when the WebView doesn't exist yet the cold-start poll covers it.
      val wv = webView ?: return@Thread
      runOnUiThread {
        wv.evaluateJavascript("window.dispatchEvent(new Event('lolly-share-target'))", null)
      }
    }.start()
  }

  /** Inbound ACTION_VIEW: provider-backed .lolly documents from Files use the
   *  share-target byte slot; https App Links and lolly:// deep links use the URL
   *  slot. Both keep the same latest-wins + cold-poll/warm-event pattern.
   *  Defensive re-checks even though the manifest filters already scope them. */
  private fun ingestViewIntent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_VIEW) return
    val uri = intent.data ?: return
    if (uri.scheme == "content") {
      // Consume before starting the reader so an activity recreation cannot
      // re-import the same document while the stream is in flight.
      setIntent(Intent(this, javaClass))
      stashInboundFile(uri, intent.type)
      return
    }
    if (uri.scheme != "https" && uri.scheme != "http" && uri.scheme != "lolly") return
    val url = uri.toString()
    if (url.length > MAX_LINK_CHARS) return
    // Consume so an activity recreate doesn't re-open the same link.
    setIntent(Intent(this, javaClass))
    pendingLink = url
    val wv = webView ?: return
    runOnUiThread {
      wv.evaluateJavascript("window.dispatchEvent(new Event('lolly-deep-link'))", null)
    }
  }

  private fun shareDisplayName(uri: Uri): String {
    var name: String? = null
    try {
      contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst() && !c.isNull(0)) name = c.getString(0)
      }
    } catch (e: Exception) {
      // fall through to Uri-derived name
    }
    val raw = name ?: uri.lastPathSegment ?: "shared-file"
    // Provider-controlled string: strip path separators and control chars before it
    // travels anywhere near a filename.
    return raw.replace(Regex("[\\\\/\\x00-\\x1f]"), "_").trim().take(160).ifBlank { "shared-file" }
  }

  private fun shareMime(intentType: String?, uri: Uri): String {
    val resolved = intentType?.takeIf { it.isNotBlank() && !it.contains('*') }
      ?: try { contentResolver.getType(uri) } catch (e: Exception) { null }
      ?: "application/octet-stream"
    return if (Regex("^[\\w.+-]+/[\\w.+-]+$").matches(resolved)) resolved else "application/octet-stream"
  }

  /** Reads the stream fully, aborting mid-stream once the cap is exceeded (never buffer-then-check). */
  private fun readShareCapped(uri: Uri): ByteArray? {
    return try {
      contentResolver.openInputStream(uri)?.use { input ->
        val out = ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
          val n = input.read(buf)
          if (n < 0) break
          total += n
          if (total > MAX_SHARE_BYTES) {
            runOnUiThread {
              Toast.makeText(this, "File is too large to share to Lolly (48 MB max)", Toast.LENGTH_LONG).show()
            }
            return null
          }
          out.write(buf, 0, n)
        }
        out.toByteArray()
      }
    } catch (e: Exception) {
      null
    }
  }

  inner class ShareBridge {
    /**
     * Share a previously exported file via ACTION_SEND. `relPath` is relative to the
     * export root - getExternalFilesDir(null)/Download, the exact directory
     * tauri-plugin-fs BaseDirectory.Download resolves to on Android - and must stay
     * inside it (canonical-path containment; symlinks and ../ both fail closed).
     * Returns false when the file is missing/out-of-root so the JS side can fall
     * back to its saved-toast message.
     */
    @JavascriptInterface
    fun shareFile(relPath: String, mime: String, title: String): Boolean {
      return try {
        val root = File(getExternalFilesDir(null), "Download").canonicalFile
        val target = File(root, relPath).canonicalFile
        if (!target.path.startsWith(root.path + File.separator) || !target.isFile) return false
        val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", target)
        val safeMime = if (Regex("^[\\w.+-]+/[\\w.+-]+$").matches(mime)) mime else "application/octet-stream"
        val send = Intent(Intent.ACTION_SEND).apply {
          type = safeMime
          putExtra(Intent.EXTRA_STREAM, uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, title.take(120).ifBlank { target.name })
        runOnUiThread { startActivity(chooser) }
        true
      } catch (e: Exception) {
        false
      }
    }

    /** Pending inbound share as {"name","mime","size","chunks"} JSON, or '' when none. */
    @JavascriptInterface
    fun sharedFilePoll(): String {
      val p = pendingShare ?: return ""
      val chunks = (p.bytes.size + SHARE_CHUNK - 1) / SHARE_CHUNK
      return JSONObject()
        .put("name", p.name)
        .put("mime", p.mime)
        .put("size", p.bytes.size)
        .put("chunks", chunks)
        .toString()
    }

    /** Base64 (NO_WRAP) of the i-th 1 MiB raw slice, or '' out of range. */
    @JavascriptInterface
    fun sharedFileChunk(i: Int): String {
      val p = pendingShare ?: return ""
      val start = i.toLong() * SHARE_CHUNK
      if (i < 0 || start >= p.bytes.size) return ""
      val len = minOf(SHARE_CHUNK.toLong(), p.bytes.size - start).toInt()
      return Base64.encodeToString(p.bytes, start.toInt(), len, Base64.NO_WRAP)
    }

    @JavascriptInterface
    fun sharedFileConsumed() {
      pendingShare = null
    }

    /** Pending inbound App-Link URL, consumed on read ('' when none). A URL is small,
     *  so no chunk protocol - one string, one call. */
    @JavascriptInterface
    fun pendingDeepLink(): String {
      val link = pendingLink ?: return ""
      pendingLink = null
      return link
    }
  }

  companion object {
    private const val MAX_SHARE_BYTES = 48L * 1024 * 1024
    private const val SHARE_CHUNK = 1024 * 1024
    // Generous vs the engine's 4096 URL cap - a packed z link plus headroom.
    private const val MAX_LINK_CHARS = 8192
  }
}
