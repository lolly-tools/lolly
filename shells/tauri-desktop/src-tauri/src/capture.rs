//! Page capture — the engine `capture` capability fulfilled natively.
//!
//! The web shell can't screenshot a cross-origin URL (a browser page can't read
//! pixels it doesn't own). The desktop shell can, because it drives a headless
//! Chrome over the DevTools Protocol — capturing with full authority, outside any
//! page sandbox. We deliberately use headless Chrome rather than the app's own
//! WKWebView/WebView2: Tauri v2 has no stable API to screenshot arbitrary content
//! with viewport/scroll control.
//!
//! Export dimensions are the source of truth: we capture exactly `width × height`
//! at device-pixel-ratio `dpr`. A "full page" is just a tall height — captureBeyond-
//! Viewport pulls in content below the initial fold. Requires a Chrome/Chromium
//! install. Returns the PNG as base64 (CDP already encodes it); the JS override
//! wraps it in a data-URL AssetRef.
//!
//! Note on SSRF: this is a tool the user runs locally, so capturing localhost / a
//! private dev server is a *feature*, not a risk — we only reject non-http(s)
//! schemes (no file://, chrome://). The SSRF hardening belongs to the deferred
//! server-side render service, where an attacker could choose the URL.

use std::time::Duration;

use headless_chrome::protocol::cdp::Page;
use headless_chrome::{Browser, LaunchOptions};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSpec {
    pub url: String,
    pub width: u32,
    /// Viewport/capture height in px. Defaults to a 16:9 box if omitted.
    pub height: Option<u32>,
    /// 0..1 fraction of the scrollable height, or a px offset when > 1.
    pub scroll_depth: Option<f64>,
    /// Settle time after load (and after scrolling) before the shot.
    pub wait_ms: Option<u64>,
    /// Device pixel ratio — renders the clip at this scale for a crisp raster.
    pub dpr: Option<f64>,
    /// Custom CSS injected before the shot (userstyles-style, additive).
    pub css: Option<String>,
}

#[tauri::command]
pub async fn capture_page(spec: CaptureSpec) -> Result<String, String> {
    // headless_chrome is blocking; keep it off the async runtime's threads.
    tauri::async_runtime::spawn_blocking(move || capture_blocking(spec))
        .await
        .map_err(|e| format!("capture task panicked: {e}"))?
}

fn capture_blocking(spec: CaptureSpec) -> Result<String, String> {
    if !(spec.url.starts_with("http://") || spec.url.starts_with("https://")) {
        return Err("Only http(s) URLs can be captured.".into());
    }

    // Export dimensions are the source of truth — capture exactly width × height.
    let height = spec.height.unwrap_or((spec.width * 9 / 16).max(1)).max(1);
    let scale = spec.dpr.filter(|d| *d > 0.0).unwrap_or(1.0);

    let launch = LaunchOptions::default_builder()
        .window_size(Some((spec.width, height)))
        .build()
        .map_err(|e| format!("launch options: {e}"))?;

    let browser = Browser::new(launch).map_err(|e| format!("launch chrome: {e}"))?;
    let tab = browser.new_tab().map_err(|e| format!("new tab: {e}"))?;
    tab.set_default_timeout(Duration::from_secs(30));

    tab.navigate_to(&spec.url)
        .map_err(|e| format!("navigate: {e}"))?;
    tab.wait_until_navigated()
        .map_err(|e| format!("load: {e}"))?;

    // Inject custom CSS as a <style> appended to the document, so it layers over
    // the page's own rules by source order (userstyles-style, additive). Done
    // before scroll/settle so the page reflows and settles with it applied.
    if let Some(css) = spec.css.as_deref() {
        let css = css.trim();
        if !css.is_empty() {
            // serde_json produces a safe, fully-escaped JS string literal.
            let literal = serde_json::to_string(css).unwrap_or_else(|_| "\"\"".into());
            let js = format!(
                "(function(){{var s=document.createElement('style');s.setAttribute('data-lolly-userstyle','');s.textContent={literal};(document.head||document.documentElement).appendChild(s);}})();"
            );
            let _ = tab.evaluate(&js, false);
        }
    }

    // Scroll before capturing (fraction of scrollable height, or a px offset > 1).
    if let Some(depth) = spec.scroll_depth {
        if depth > 0.0 {
            let js = if depth <= 1.0 {
                format!("window.scrollTo(0, (document.body.scrollHeight - window.innerHeight) * {depth});")
            } else {
                format!("window.scrollTo(0, {depth});")
            };
            let _ = tab.evaluate(&js, false);
        }
    }

    std::thread::sleep(Duration::from_millis(spec.wait_ms.unwrap_or(500)));

    // Drive Page.captureScreenshot directly so we can set captureBeyondViewport
    // (so a tall height captures content below the fold) and the clip scale (DPR).
    // CDP returns the PNG already base64-encoded.
    let shot = tab
        .call_method(Page::CaptureScreenshot {
            format: Some(Page::CaptureScreenshotFormatOption::Png),
            quality: None,
            clip: Some(Page::Viewport {
                x: 0.0,
                y: 0.0,
                width: spec.width as f64,
                height: height as f64,
                scale,
            }),
            from_surface: Some(true),
            capture_beyond_viewport: Some(true),
            optimize_for_speed: None,
        })
        .map_err(|e| format!("screenshot: {e}"))?;

    Ok(shot.data)
}
