//! Page capture - the engine `capture` capability fulfilled natively.
//!
//! The web shell can't screenshot a cross-origin URL (a browser page can't read
//! pixels it doesn't own). The desktop shell can, because it drives a headless
//! Chrome over the DevTools Protocol - capturing with full authority, outside any
//! page sandbox. We deliberately use headless Chrome rather than the app's own
//! WKWebView/WebView2: Tauri v2 has no stable API to screenshot arbitrary content
//! with viewport/scroll control.
//!
//! Two commands, one navigation path:
//!   • capture_page      - raster. Page.captureScreenshot with a DOCUMENT-space
//!                         clip: scroll depth + crop insets + an optional range
//!                         extension (the tall strip a scroll video pans over)
//!                         all resolve into one clip rect.
//!   • capture_page_pdf  - vector. Page.printToPDF under `screen` media
//!                         emulation: a TRUE vector print of the page (text,
//!                         boxes, paths) sized to the viewport width and the
//!                         full page height. The JS bridge converts PDF → SVG
//!                         (the engine's pdf-map/pdf-svg path) and windows it.
//!
//! Clip semantics (probed, Chromium ≥ 120): with captureBeyondViewport: true the
//! clip rect is relative to the DOCUMENT, not the scrolled viewport - so scroll
//! depth must land in clip.y, not in window.scrollTo (an earlier version scrolled
//! and clipped at y=0, which silently framed the page top at every depth). We
//! still scroll to the target first, but only so lazy-loaded content near the
//! framed region has a chance to hydrate before the settle wait.
//!
//! Requires a Chrome/Chromium install. CDP returns both formats base64-encoded;
//! the JS override wraps them in AssetRefs.
//!
//! Note on SSRF: this is a tool the user runs locally, so capturing localhost / a
//! private dev server is a *feature*, not a risk - we only reject non-http(s)
//! schemes (no file://, chrome://). The SSRF hardening belongs to the deferred
//! server-side render service, where an attacker could choose the URL.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use headless_chrome::protocol::cdp::{Emulation, Page};
use headless_chrome::{Browser, LaunchOptions, Tab};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// Ceiling on any captured strip, in CSS px - stays comfortably under Chrome's
/// 16384-px texture limit at dpr 1 and bounds the base64 IPC payload. The range
/// extension shrinks first; the framed viewport itself is never truncated.
const MAX_CLIP_H: f64 = 12000.0;

/// Ceiling on the printed page height, in CSS px. The hard PDF limit is 14400
/// *points* per side; paper_height is CSS-px/96 inches ⇒ px·0.75 points, so
/// 19200 px = 14400 pt is the true maximum single page. Real pages never reach
/// it; beyond it we clamp (and content past the cap is unavailable - signalled
/// by page_height being the clamped value the bridge windows against).
const MAX_PDF_H: f64 = 19200.0;

#[derive(Deserialize, Default, Clone, Copy)]
#[serde(rename_all = "camelCase", default)]
pub struct CropSpec {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSpec {
    pub url: String,
    pub width: u32,
    /// Viewport/capture height in px. Defaults to a 16:9 box if omitted.
    pub height: Option<u32>,
    /// 0..1 fraction of the scrollable height, or a px offset when > 1.
    pub scroll_depth: Option<f64>,
    /// Extend the capture down to this scroll position (same semantics as
    /// scroll_depth) - the strip a scroll video pans over. ≤ scroll_depth ⇒ none.
    pub range_to: Option<f64>,
    /// Settle time after load (and after scrolling) before the shot.
    pub wait_ms: Option<u64>,
    /// Device pixel ratio - renders the clip at this scale for a crisp raster.
    pub dpr: Option<f64>,
    /// Custom CSS injected before the shot (userstyles-style, additive).
    pub css: Option<String>,
    /// Trim insets, each a 0..0.9 fraction of the framed viewport box.
    pub crop: Option<CropSpec>,
}

/// What the raster command hands back: the shot plus the geometry the tool needs
/// to composite it (the cropped frame box, the pan strip, the page itself).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResult {
    /// Base64 PNG, as CDP returned it.
    pub data: String,
    /// Captured box in CSS px - crop applied, range extension included.
    pub width: u32,
    pub height: u32,
    /// The cropped viewport height alone (the pan window; height − frameHeight
    /// is the pan distance a scroll clip travels).
    pub frame_height: u32,
    /// Page geometry at capture time, CSS px.
    pub page_width: f64,
    pub page_height: f64,
    /// The resolved scroll offset the frame starts at (document space).
    pub scroll_y: f64,
}

/// What the vector command hands back: a full-page vector PDF + the screen-space
/// geometry the JS bridge windows it with.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorResult {
    /// Base64 PDF, as CDP returned it.
    pub data: String,
    /// Page geometry at capture time, CSS px (the printed height may be capped
    /// at MAX_PDF_H; page_height reports the capped value actually printed).
    pub page_width: f64,
    pub page_height: f64,
}

/// The optional live "sign-in" browser, shared by every capture so an authenticated
/// session the user set up in the visible window is RIDDEN by the (otherwise headless)
/// screenshots. Tauri-managed state; `None` until the user opens a sign-in window,
/// `None` again after Clear.
///
/// One live Chrome, reused - captures open a BACKGROUND tab in it (same live cookie
/// jar; no profile-lock, and none of the kill/flush race that closing a separate
/// browser between sign-in and capture would incur). When no window is live, a capture
/// falls back to a fresh headless browser: on the persistent profile IFF the user has
/// signed in at least once (the `signin_marker`), so an earlier session still applies -
/// otherwise on a throwaway temp profile, exactly as before this feature (stateless, so
/// an ordinary public-page shot never accretes cookies in the shared profile).
///
/// `active` mirrors `browser.is_some()` as a lock-free flag so the status query never
/// contends with a 30 s capture that is holding `browser`.
#[derive(Default, Clone)]
pub struct CaptureSession {
    browser: Arc<Mutex<Option<Browser>>>,
    active: Arc<AtomicBool>,
}

impl CaptureSession {
    fn lock(&self) -> std::sync::MutexGuard<'_, Option<Browser>> {
        // A capture panic must never wedge every later capture: recover the guard.
        self.browser.lock().unwrap_or_else(|p| p.into_inner())
    }
}

/// Where the persistent Chrome profile lives (under the app data dir, so it survives
/// restarts). Does NOT create it - the status check must not materialise an empty dir.
fn capture_profile_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?
        .join("capture-profile"))
}

/// The persistent profile, created if absent - cookies/session a sign-in window writes
/// here are reused by later shots.
fn capture_profile_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = capture_profile_path(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create capture profile dir: {e}"))?;
    Ok(dir)
}

/// A marker written the first time the user opens a sign-in window. Its presence is the
/// authoritative "there are saved sign-ins" signal - separate from the in-memory
/// `active` flag (which only tracks a LIVE window) so the status chip and Clear button
/// stay truthful after the window is closed or the app restarts. Removed with the
/// profile by Clear.
fn signin_marker(profile: &Path) -> PathBuf {
    profile.join(".lolly-signed-in")
}

/// Has the user signed in at least once (a saved session persists on disk)?
fn has_saved_signin(app: &AppHandle) -> bool {
    capture_profile_path(app).is_ok_and(|p| signin_marker(&p).exists())
}

/// Is the persistent profile currently held by a LIVE Chrome? Chrome writes a
/// `SingletonLock` symlink (`<host>-<pid>`); while the holder runs, a SECOND Chrome
/// launched on the same `--user-data-dir` cannot get the lock, exits without publishing
/// its DevTools port, and `Browser::new` then HANGS waiting for it (observed: a capture
/// blocks for the whole beforeExport budget). We only ever launch a fresh browser on the
/// profile from the headless fallback (the live sign-in window is ridden via new_tab
/// instead), so testing the lock there lets that case fail FAST with a clear message
/// rather than hang. A stale/absent lock - which Chrome cleans up itself on the next
/// real launch - reads as free.
fn profile_locked(profile: &Path) -> bool {
    let Ok(target) = std::fs::read_link(profile.join("SingletonLock")) else {
        return false; // no lock → free
    };
    let Some(pid) = target
        .to_str()
        .and_then(|s| s.rsplit('-').next())
        .and_then(|p| p.parse::<u32>().ok())
    else {
        return false; // unparseable lock → treat as free, let Chrome sort it out
    };
    // `kill -0` probes existence without delivering a signal: success ⇒ holder alive.
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

#[tauri::command]
pub async fn capture_page(
    app: AppHandle,
    session: State<'_, CaptureSession>,
    spec: CaptureSpec,
) -> Result<CaptureResult, String> {
    let profile = capture_profile_dir(&app)?;
    let session = (*session).clone();
    // headless_chrome is blocking; keep it off the async runtime's threads.
    tauri::async_runtime::spawn_blocking(move || capture_blocking(&session, &profile, spec))
        .await
        .map_err(|e| format!("capture task panicked: {e}"))?
}

#[tauri::command]
pub async fn capture_page_pdf(
    app: AppHandle,
    session: State<'_, CaptureSession>,
    spec: CaptureSpec,
) -> Result<VectorResult, String> {
    let profile = capture_profile_dir(&app)?;
    let session = (*session).clone();
    tauri::async_runtime::spawn_blocking(move || capture_pdf_blocking(&session, &profile, spec))
        .await
        .map_err(|e| format!("capture task panicked: {e}"))?
}

/// Open (or raise) a VISIBLE Chrome window on the shared persistent profile, at `url`,
/// so the user can sign in / accept cookies / set up the view. Everything they do there
/// is written to the profile and ridden by later captures. GUI-only.
#[tauri::command]
pub async fn capture_signin_open(
    app: AppHandle,
    session: State<'_, CaptureSession>,
    url: String,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Only http(s) URLs can be opened for sign-in.".into());
    }
    let profile = capture_profile_dir(&app)?;
    let session = (*session).clone();
    let w = width.unwrap_or(1280).clamp(320, 3840);
    let h = height.unwrap_or(900).clamp(320, 2400);
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let mut guard = session.lock();
        // Open a tab for the login page. new_tab() is a round-trip to Chrome, so it
        // doubles as the liveness probe: reuse the live session browser when it
        // answers, else (no browser, or the user closed the window) relaunch once.
        let tab = match guard.as_ref().map(|b| b.new_tab()) {
            Some(Ok(tab)) => tab,
            _ => {
                let browser = launch_signin_browser(&profile, w, h)?;
                let tab = browser.new_tab().map_err(|e| format!("sign-in tab: {e}"))?;
                *guard = Some(browser);
                session.active.store(true, Ordering::Relaxed);
                tab
            }
        };
        // Record that saved sign-ins now exist, so the status chip + Clear button
        // survive closing this window (the auth lives on disk, not in this handle).
        let _ = std::fs::write(signin_marker(&profile), b"1");
        tab.navigate_to(&url).map_err(|e| format!("navigate: {e}"))?;
        let _ = tab.bring_to_front();
        Ok(())
    })
    .await
    .map_err(|e| format!("sign-in task panicked: {e}"))?
}

/// Whether the user has a saved session captures will ride - a LIVE sign-in window OR a
/// persisted profile from an earlier sign-in (the marker on disk). Drives the tool's
/// "Signed-in session active" chip and whether Clear is offered. The atomic read is
/// lock-free; the marker check is a single stat - neither blocks behind a capture.
#[tauri::command]
pub fn capture_session_active(app: AppHandle, session: State<'_, CaptureSession>) -> bool {
    session.active.load(Ordering::Relaxed) || has_saved_signin(&app)
}

/// Close the live session browser and DELETE the persistent profile - a full sign-out
/// wiping every stored cookie/site datum. GUI-only.
#[tauri::command]
pub async fn capture_clear_session(
    app: AppHandle,
    session: State<'_, CaptureSession>,
) -> Result<(), String> {
    let profile = capture_profile_path(&app)?;
    let session = (*session).clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        // Hold the lock across the whole wipe so no capture (which also takes the lock
        // before touching the profile) can launch Chrome on it mid-deletion.
        let mut guard = session.lock();
        *guard = None; // Drop → Chrome is killed, releasing the profile lock.
        session.active.store(false, Ordering::Relaxed);
        // Let the process exit and unlock the profile before removing its files.
        std::thread::sleep(Duration::from_millis(300));
        if profile.exists() {
            std::fs::remove_dir_all(&profile).map_err(|e| format!("clear session: {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("clear task panicked: {e}"))?
}

/// A VISIBLE Chrome on the persistent profile - the sign-in window.
fn launch_signin_browser(profile: &Path, w: u32, h: u32) -> Result<Browser, String> {
    let launch = LaunchOptions::default_builder()
        .headless(false)
        .user_data_dir(Some(profile.to_path_buf()))
        .window_size(Some((w, h)))
        .build()
        .map_err(|e| format!("sign-in launch options: {e}"))?;
    Browser::new(launch).map_err(|e| format!("open sign-in browser: {e}"))
}

/// Run `f` against a tab navigated + styled per `spec` - in the LIVE session browser
/// (a background tab, riding the authenticated session) when one is up, else a fresh
/// headless browser on the persistent profile. Serialised on the session lock for its
/// whole duration (one capture at a time), which also keeps the shared cookie jar
/// consistent. A session browser the user has since closed is dropped and the capture
/// falls back to the headless path rather than failing.
fn with_capture_tab<T>(
    session: &CaptureSession,
    profile: &Path,
    spec: &CaptureSpec,
    height: u32,
    f: impl FnOnce(&Tab) -> Result<T, String>,
) -> Result<T, String> {
    valid_http_url(&spec.url)?;
    let mut guard = session.lock();
    // 1. A LIVE sign-in window? Ride it - a background tab shares its live cookie jar.
    if guard.is_some() {
        match guard.as_ref().unwrap().new_tab() {
            Ok(tab) => {
                tab.set_default_timeout(Duration::from_secs(30));
                // Size the capture tab to the request WITHOUT resizing the visible
                // sign-in window, so a 1280-wide shot lays out at 1280 regardless.
                set_viewport(&tab, spec.width, height);
                let out = prepare_tab(&tab, spec).and_then(|()| {
                    // A backgrounded tab in a headful window has no live compositor
                    // surface, so `captureScreenshot { from_surface: true }` would grab a
                    // blank/stale frame. Foreground it for the shot (printToPDF re-lays-out
                    // and does not care); the tab is closed again immediately after.
                    let _ = tab.bring_to_front();
                    f(&tab)
                });
                let _ = tab.close(false);
                return out;
            }
            // new_tab fails when the session browser has gone (window closed / crashed):
            // drop it, clear the flag, and fall through.
            Err(_) => {
                *guard = None;
                session.active.store(false, Ordering::Relaxed);
            }
        }
    }
    // 2. No live window. If the user has SAVED sign-ins, capture headless on the shared
    //    persistent profile - keeping the lock held so no second Chrome opens the same
    //    `--user-data-dir` at once (Chrome refuses a locked profile). If they have not
    //    signed in, keep the pre-feature behaviour EXACTLY: a throwaway temp profile per
    //    launch (stateless, and safe to run concurrently - so release the lock first).
    if signin_marker(profile).exists() {
        // Fail fast on a locked profile (an orphaned capture, or the sign-in window
        // still open in another process) - launching a second Chrome on it would hang.
        if profile_locked(profile) {
            return Err(
                "The saved sign-in is in use by an open browser window. Close the \
                 sign-in window, then capture again."
                    .into(),
            );
        }
        let (_browser, tab) = open_page(spec, height, Some(profile))?;
        return f(&tab); // lock held across the whole capture
    }
    drop(guard);
    let (_browser, tab) = open_page(spec, height, None)?;
    f(&tab)
}

/// Override the tab's viewport metrics (no visible-window resize) so a background
/// capture tab lays the page out at the requested size. Best-effort.
///
/// `device_scale_factor` is fixed at 1 to MATCH the fresh-headless path (which never
/// sets a DSF): the export dpr is applied downstream by the screenshot `clip.scale`
/// (raster) - NOT by the layout DSF. Setting DSF = dpr here would both double-scale the
/// PNG and make the page render at a different `devicePixelRatio` (different
/// srcset/media-query branches) than a headless shot of the same spec.
fn set_viewport(tab: &Tab, width: u32, height: u32) {
    let _ = tab.call_method(Emulation::SetDeviceMetricsOverride {
        width,
        height,
        device_scale_factor: 1.0,
        mobile: false,
        scale: None,
        screen_width: None,
        screen_height: None,
        position_x: None,
        position_y: None,
        dont_set_visible_size: Some(true),
        screen_orientation: None,
        viewport: None,
        display_feature: None,
        device_posture: None,
    });
}

// ── shared navigation path ──────────────────────────────────────────────────────

fn valid_http_url(url: &str) -> Result<(), String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        Ok(())
    } else {
        Err("Only http(s) URLs can be captured.".into())
    }
}

/// Launch a fresh HEADLESS browser, open + navigate a tab, inject the userstyle. The
/// browser must outlive the tab. `profile` binds the launch to the persistent capture
/// profile (so a sign-in from an earlier run applies); `None` keeps the old throwaway
/// temp profile.
fn open_page(
    spec: &CaptureSpec,
    height: u32,
    profile: Option<&Path>,
) -> Result<(Browser, Arc<Tab>), String> {
    valid_http_url(&spec.url)?;

    let mut builder = LaunchOptions::default_builder();
    builder.window_size(Some((spec.width, height)));
    if let Some(dir) = profile {
        builder.user_data_dir(Some(dir.to_path_buf()));
    }
    let launch = builder.build().map_err(|e| format!("launch options: {e}"))?;

    let browser = Browser::new(launch).map_err(|e| format!("launch chrome: {e}"))?;
    let tab = browser.new_tab().map_err(|e| format!("new tab: {e}"))?;
    tab.set_default_timeout(Duration::from_secs(30));
    prepare_tab(&tab, spec)?;
    Ok((browser, tab))
}

/// Navigate a tab to `spec.url`, wait for load, and inject the custom CSS. Shared by
/// the fresh-browser and live-session capture paths so both style the page identically.
fn prepare_tab(tab: &Tab, spec: &CaptureSpec) -> Result<(), String> {
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

    Ok(())
}

/// Page geometry, measured in the page itself (CSS px).
fn measure(tab: &Tab) -> (f64, f64, f64) {
    let js = "JSON.stringify({pw: document.documentElement.scrollWidth, ph: Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement.scrollHeight), vh: window.innerHeight})";
    let fallback = (0.0, 0.0, 0.0);
    let Ok(obj) = tab.evaluate(js, false) else { return fallback };
    let Some(serde_json::Value::String(s)) = obj.value else { return fallback };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) else { return fallback };
    let n = |k: &str| v.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0);
    (n("pw"), n("ph"), n("vh"))
}

/// A scroll position: 0..1 ⇒ fraction of the scrollable height, > 1 ⇒ px offset.
/// Clamped into the page's real scroll range.
fn resolve_scroll(depth: f64, page_h: f64, viewport_h: f64) -> f64 {
    let max = (page_h - viewport_h).max(0.0);
    let px = if depth <= 1.0 { depth.max(0.0) * max } else { depth };
    px.clamp(0.0, max)
}

fn clamp_inset(v: f64) -> f64 {
    if v.is_finite() { v.clamp(0.0, 0.9) } else { 0.0 }
}

fn capture_blocking(
    session: &CaptureSession,
    profile: &Path,
    spec: CaptureSpec,
) -> Result<CaptureResult, String> {
    let vh = spec.height.unwrap_or((spec.width * 9 / 16).max(1)).max(1);
    with_capture_tab(session, profile, &spec, vh, |tab| run_raster(tab, &spec))
}

/// Measure the page, resolve the framed clip (scroll depth + crop + range), and grab
/// the PNG. Runs on a prepared tab from either capture path.
fn run_raster(tab: &Tab, spec: &CaptureSpec) -> Result<CaptureResult, String> {
    let vw = spec.width.max(1) as f64;
    let vh = spec.height.unwrap_or((spec.width * 9 / 16).max(1)).max(1) as f64;
    let scale = spec.dpr.filter(|d| *d > 0.0).unwrap_or(1.0);

    let (pw, ph, real_vh) = measure(tab);
    // The window was launched at the requested size, but measure the truth (the
    // headless window may quantise) and fall back to the request when blocked.
    let vh = if real_vh > 0.0 { real_vh } else { vh };
    let ph = if ph > 0.0 { ph } else { vh };

    let from = resolve_scroll(spec.scroll_depth.unwrap_or(0.0), ph, vh);
    let extra = spec
        .range_to
        .map(|t| (resolve_scroll(t, ph, vh) - from).max(0.0))
        .unwrap_or(0.0);

    // Scroll to the framed region - NOT for framing (the clip below is document-
    // space), but so lazy-loaded content near it hydrates before the settle.
    if from > 0.0 {
        let _ = tab.evaluate(&format!("window.scrollTo(0, {from});"), false);
    }
    std::thread::sleep(Duration::from_millis(spec.wait_ms.unwrap_or(500)));

    // Crop insets frame a window inside the viewport box; the range extension
    // stretches that window down the page. All document-space.
    let c = spec.crop.unwrap_or_default();
    let (l, r, t, b) = (clamp_inset(c.left), clamp_inset(c.right), clamp_inset(c.top), clamp_inset(c.bottom));
    let frame_w = (vw * (1.0 - l - r)).max(1.0);
    let frame_h = (vh * (1.0 - t - b)).max(1.0);
    // Chrome rejects clips past the page edge; also bound the strip (texture +
    // IPC ceilings - at high dpr the texture limit is the binding one).
    let max_h = MAX_CLIP_H.min(16000.0 / scale);
    let x = vw * l;
    let y = (from + vh * t).min((ph - frame_h).max(0.0));
    let h = (frame_h + extra).min(max_h).min((ph - y).max(frame_h));

    let shot = tab
        .call_method(Page::CaptureScreenshot {
            format: Some(Page::CaptureScreenshotFormatOption::Png),
            quality: None,
            clip: Some(Page::Viewport {
                x,
                y,
                width: frame_w,
                height: h,
                scale,
            }),
            from_surface: Some(true),
            capture_beyond_viewport: Some(true),
            optimize_for_speed: None,
        })
        .map_err(|e| format!("screenshot: {e}"))?;

    Ok(CaptureResult {
        data: shot.data,
        width: frame_w.round() as u32,
        height: h.round() as u32,
        frame_height: frame_h.round().min(h.round()) as u32,
        page_width: pw,
        page_height: ph,
        scroll_y: y,
    })
}

fn capture_pdf_blocking(
    session: &CaptureSession,
    profile: &Path,
    spec: CaptureSpec,
) -> Result<VectorResult, String> {
    let vh = spec.height.unwrap_or((spec.width * 9 / 16).max(1)).max(1);
    with_capture_tab(session, profile, &spec, vh, |tab| run_pdf(tab, &spec))
}

/// Print the page to a vector PDF (screen media, full-page). Runs on a prepared tab
/// from either capture path.
fn run_pdf(tab: &Tab, spec: &CaptureSpec) -> Result<VectorResult, String> {
    let vw = spec.width.max(1) as f64;
    let vh = spec.height.unwrap_or((spec.width * 9 / 16).max(1)).max(1);

    // Print with SCREEN styles - without this, @media print rules (and Chrome's
    // print defaults) restyle the page and the "screenshot" stops looking like
    // the site. Set after load: printToPDF re-lays-out against the emulation.
    let _ = tab.call_method(Emulation::SetEmulatedMedia {
        media: Some("screen".into()),
        features: None,
    });

    // Lazy-load hydration for the whole document: walk the page once, then
    // return to the top so position:fixed chrome prints in its resting place.
    // This walk GROWS pages whose below-the-fold images are loading="lazy" with
    // no reserved size, so we measure AFTER it - measuring before would size the
    // paper to the pre-hydration height and printToPDF would drop the grown tail.
    let _ = tab.evaluate("window.scrollTo(0, document.body ? document.body.scrollHeight : 0);", false);
    std::thread::sleep(Duration::from_millis(150));
    let _ = tab.evaluate("window.scrollTo(0, 0);", false);
    std::thread::sleep(Duration::from_millis(spec.wait_ms.unwrap_or(500)));

    let (pw, ph, _vh) = measure(tab);
    let ph = if ph > 0.0 { ph.min(MAX_PDF_H) } else { f64::from(vh) };

    // One tall page, paper sized to the viewport width × the full page height
    // (96 CSS px per inch), zero margins, backgrounds on. Vector out.
    let printed = tab
        .call_method(Page::PrintToPDF {
            print_background: Some(true),
            scale: Some(1.0),
            paper_width: Some(vw / 96.0),
            paper_height: Some(ph / 96.0),
            margin_top: Some(0.0),
            margin_bottom: Some(0.0),
            margin_left: Some(0.0),
            margin_right: Some(0.0),
            page_ranges: Some("1".into()),
            ..Default::default()
        })
        .map_err(|e| format!("print to pdf: {e}"))?;

    Ok(VectorResult {
        data: printed.data,
        page_width: pw,
        page_height: ph,
    })
}
