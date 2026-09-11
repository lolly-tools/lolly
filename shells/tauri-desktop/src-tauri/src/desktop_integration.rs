// SPDX-License-Identifier: MPL-2.0
//! Linux desktop integration (plans/174): XDG portals, the clipboard-lens tray,
//! single-instance argv routing, a hot-folder watcher, and the D-Bus surfaces
//! (GNOME Shell search, KRunner, org.lolly.Desktop1).
//!
//! Rust->JS follows the house POLL pattern (nearby.rs precedent - no event
//! plumbing exists in this codebase): everything that happens natively lands in
//! one `DesktopEvents` queue, and the web side drains it via
//! `desktop_poll_events` every 1200ms (shells/web/src/lib/linux-desktop-boot.ts).
//!
//! Portal calls (colour picker, wallpaper, accent) are Linux-only; on other
//! platforms - and on Linux sessions with no xdg-desktop-portal - the commands
//! return Err("unsupported"), which the TS side treats as feature-absent, never
//! as a failure to show the user.

use std::collections::{HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

/// One queued native happening. `kind` is the plan-174 contract vocabulary:
/// "openFile" | "openUtilityFile" | "deepLink" | "hotfolderFile" | "navigate".
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEvent {
    pub kind: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

/// The queue the webview polls, plus the custody set for file reads: the
/// webview's fs scope is deliberately narrow (appdata + downloads), so a file
/// the OS hands us by path (double-clicked .lolly in ~/Documents, a hot-folder
/// arrival) is served back through `desktop_read_file`, which only ever reads
/// paths THIS module queued. That keeps "the app can open what you opened"
/// without granting "the webview can read your home directory".
#[derive(Default)]
pub struct DesktopEvents {
    queue: Mutex<Vec<DesktopEvent>>,
    delivered_paths: Mutex<HashSet<PathBuf>>,
}

impl DesktopEvents {
    fn push(&self, kind: &str, value: String) {
        if let Ok(mut q) = self.queue.lock() {
            // A stuck (never-polling) webview must not grow memory without
            // bound from a chatty hot folder; the newest events win.
            if q.len() > 256 {
                q.drain(0..128);
            }
            q.push(DesktopEvent { kind: kind.into(), value, target: None });
        }
    }

    fn push_path(&self, kind: &str, path: PathBuf) {
        if let Ok(mut p) = self.delivered_paths.lock() {
            p.insert(path.clone());
        }
        self.push(kind, path.to_string_lossy().into_owned());
    }

    fn push_target_path(&self, kind: &str, path: PathBuf, target: &str) {
        if let Ok(mut p) = self.delivered_paths.lock() {
            p.insert(path.clone());
        }
        if let Ok(mut q) = self.queue.lock() {
            if q.len() > 256 {
                q.drain(0..128);
            }
            q.push(DesktopEvent {
                kind: kind.into(),
                value: path.to_string_lossy().into_owned(),
                target: Some(target.into()),
            });
        }
    }
}

/// The live hot-folder watcher, replaced wholesale on every `desktop_hotfolder_set`.
#[derive(Default)]
pub struct HotFolder(Mutex<Option<notify::RecommendedWatcher>>);

/// Recently written exports which the webview may ask the OS to reveal. Keeping
/// this allowlist native means a compromised page cannot use the reveal command
/// as an arbitrary filesystem navigator.
#[derive(Default)]
pub struct RecentExports(Mutex<VecDeque<PathBuf>>);

// ── argv routing (single-instance + first launch) ────────────────────────────

/// Classify launch arguments into events. Both the first process and every
/// forwarded second-instance argv go through here, so "double-click a .lolly"
/// and "click a lolly:// link" behave identically however the app was started.
pub fn classify_argv(app: &AppHandle, argv: &[String]) {
    let events: State<'_, DesktopEvents> = app.state();
    // Dolphin service-menu verbs use one deliberately narrow internal flag.
    // Reject every unknown target instead of turning an arbitrary argv string
    // into a route. The file still has to exist and enters delivered_paths below.
    let utility = utility_target(argv);
    for arg in argv {
        if arg.starts_with("--open-with=") || arg == "--search-provider" {
            continue;
        }
        if arg.starts_with("lolly://") {
            events.push("deepLink", arg.clone());
            continue;
        }
        // Anything that names an existing file is an open request; the web
        // side sniffs the flavour (.lolly share/brand vs image vs pdf) exactly
        // as it does for a drag-drop.
        let path = PathBuf::from(arg);
        if path.is_file() {
            let path = path.canonicalize().unwrap_or(path);
            if let Some(target) = utility {
                events.push_target_path("openUtilityFile", path, target);
            } else {
                events.push_path("openFile", path);
            }
        }
    }
    focus_main(app);
}

fn utility_target(argv: &[String]) -> Option<&str> {
    argv.iter().find_map(|arg| {
        let target = arg.strip_prefix("--open-with=")?;
        matches!(target, "strip-data" | "convert" | "redact").then_some(target)
    })
}

/// What one OS-delivered URL means to the queue: a lolly:// deep link, or a file
/// the person opened. Pure, so the mapping has a test without an AppHandle.
#[derive(Debug, PartialEq)]
pub enum Opened {
    DeepLink(String),
    OpenFile(PathBuf),
}

pub fn opened_event(url: &url::Url) -> Option<Opened> {
    match url.scheme() {
        "lolly" => Some(Opened::DeepLink(url.as_str().to_string())),
        "file" => url
            .to_file_path()
            .ok()
            .filter(|p| p.is_file())
            .map(Opened::OpenFile),
        _ => None,
    }
}

/// The Apple-Event twin of classify_argv: macOS delivers a lolly:// click and a
/// double-clicked .lolly as RunEvent::Opened URLs (lib.rs), never as argv. Same
/// queue, same events, so the web side never learns which platform it is on.
pub fn classify_opened(app: &AppHandle, urls: &[url::Url]) {
    let events: State<'_, DesktopEvents> = app.state();
    for url in urls {
        match opened_event(url) {
            Some(Opened::DeepLink(link)) => events.push("deepLink", link),
            Some(Opened::OpenFile(path)) => {
                let canon = path.canonicalize().unwrap_or(path);
                events.push_path("openFile", canon);
            }
            None => {}
        }
    }
    focus_main(app);
}

pub fn focus_main(app: &AppHandle) {
    ensure_tray(app);
    if let Some(win) = app.webview_windows().values().next() {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

// ── the poll commands (the whole Rust->JS surface) ───────────────────────────

#[tauri::command]
pub fn desktop_poll_events(events: State<'_, DesktopEvents>) -> Vec<DesktopEvent> {
    events.queue.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default()
}

/// Serve a file the OS delivered by path (see DesktopEvents doc). Refuses any
/// path that never travelled through the event queue.
#[tauri::command]
pub fn desktop_read_file(events: State<'_, DesktopEvents>, path: String) -> Result<Vec<u8>, String> {
    let p = PathBuf::from(&path);
    let allowed = events
        .delivered_paths
        .lock()
        .map(|s| s.contains(&p))
        .unwrap_or(false);
    if !allowed {
        return Err("path was not delivered by the desktop".into());
    }
    std::fs::read(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn desktop_note_export(exports: State<'_, RecentExports>, path: String) -> Result<(), String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("saved export is unavailable: {e}"))?;
    if !path.is_file() {
        return Err("saved export is not a file".into());
    }
    let mut recent = exports.0.lock().map_err(|e| e.to_string())?;
    recent.retain(|p| p != &path);
    recent.push_back(path);
    while recent.len() > 32 {
        recent.pop_front();
    }
    Ok(())
}

#[tauri::command]
pub fn desktop_reveal_export(exports: State<'_, RecentExports>, path: String) -> Result<(), String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("saved export is unavailable: {e}"))?;
    let allowed = exports
        .0
        .lock()
        .map(|recent| recent.contains(&path))
        .unwrap_or(false);
    if !allowed {
        return Err("that path was not written by this Lolly session".into());
    }
    reveal_file(&path)
}

#[cfg(target_os = "macos")]
fn reveal_file(path: &std::path::Path) -> Result<(), String> {
    let status = std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .status()
        .map_err(|e| e.to_string())?;
    status
        .success()
        .then_some(())
        .ok_or_else(|| "Finder could not reveal the export".into())
}

#[cfg(target_os = "linux")]
fn reveal_file(path: &std::path::Path) -> Result<(), String> {
    let uri = url::Url::from_file_path(path).map_err(|_| "could not form the export URI")?;
    let shown = std::process::Command::new("dbus-send")
        .args([
            "--session",
            "--dest=org.freedesktop.FileManager1",
            "--type=method_call",
            "/org/freedesktop/FileManager1",
            "org.freedesktop.FileManager1.ShowItems",
        ])
        .arg(format!("array:string:{uri}"))
        .arg("string:")
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if shown {
        return Ok(());
    }
    let parent = path.parent().ok_or("export has no parent folder")?;
    std::process::Command::new("xdg-open")
        .arg(parent)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Files could not reveal the export: {e}"))
}

#[cfg(windows)]
fn reveal_file(path: &std::path::Path) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
fn reveal_file(_path: &std::path::Path) -> Result<(), String> {
    Err("revealing exports is not supported on this platform".into())
}

// ── portals (Linux) ──────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn to_hex(c: &ashpd::desktop::Color) -> String {
    let ch = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
    format!("#{:02X}{:02X}{:02X}", ch(c.red()), ch(c.green()), ch(c.blue()))
}

#[tauri::command]
pub async fn desktop_pick_color() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let color = ashpd::desktop::Color::pick()
            .send()
            .await
            .map_err(|e| e.to_string())?
            .response()
            .map_err(|e| e.to_string())?;
        return Ok(to_hex(&color));
    }
    #[cfg(not(target_os = "linux"))]
    Err("unsupported".into())
}

#[tauri::command]
pub async fn desktop_set_wallpaper(path: String, target: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use ashpd::desktop::wallpaper::{SetOn, WallpaperRequest};
        let set_on = match target.as_str() {
            "lockscreen" => SetOn::Lockscreen,
            "both" => SetOn::Both,
            _ => SetOn::Background,
        };
        let uri = url::Url::from_file_path(&path)
            .map_err(|_| format!("not an absolute file path: {path}"))?;
        let uri = ashpd::Uri::parse(uri.as_str()).map_err(|e| e.to_string())?;
        // show_preview(true): the PORTAL confirms with the user - the app never
        // changes someone's desktop silently.
        WallpaperRequest::default()
            .set_on(set_on)
            .show_preview(true)
            .build_uri(&uri)
            .await
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (path, target);
        Err("unsupported".into())
    }
}

/// Wallpaper straight from export bytes: the send driver hands us the rendered
/// image, we stage it in the app cache dir (portals need a file/uri) and ask
/// the portal - which previews and confirms with the user - to set it.
#[tauri::command]
pub async fn desktop_set_wallpaper_bytes(
    app: AppHandle,
    bytes: Vec<u8>,
    ext: String,
    target: String,
) -> Result<(), String> {
    let safe_ext = match ext.as_str() {
        "png" | "jpg" | "jpeg" | "webp" => ext.as_str(),
        _ => "png",
    };
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("wallpaper.{safe_ext}"));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    desktop_set_wallpaper(path.to_string_lossy().into_owned(), target).await
}

#[tauri::command]
pub async fn desktop_read_accent() -> Result<Option<String>, String> {
    #[cfg(target_os = "linux")]
    {
        let settings = match ashpd::desktop::settings::Settings::new().await {
            Ok(s) => s,
            Err(_) => return Ok(None), // no portal = no accent, not an error
        };
        return Ok(settings.accent_color().await.ok().map(|c| to_hex(&c)));
    }
    #[cfg(not(target_os = "linux"))]
    Ok(None)
}

// ── clipboard (tray only, one-shot reads) ────────────────────────────────────

/// One-shot clipboard read, called from exactly one place: a click on a
/// clipboard-lens tray item (setup_tray below). This module deliberately has NO
/// clipboard watcher, so nothing is observed that the user did not just ask
/// about. That is the privacy stance, not an implementation shortcut.
///
/// It is NOT a `#[tauri::command]`. It was one, registered in lib.rs's
/// invoke_handler, with no JS caller anywhere in the tree - a webview-reachable
/// clipboard read that nothing used. The tray calls this function directly on
/// the Rust side, so the IPC surface bought nothing and was removed (plans/202
/// WP4.1). A future lens UI button would re-add the attribute and the
/// registration together.
pub fn desktop_clipboard_read() -> Result<String, String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.get_text().map_err(|e| e.to_string())
}

// ── hot folder ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn desktop_hotfolder_set(
    app: AppHandle,
    hot: State<'_, HotFolder>,
    path: Option<String>,
) -> Result<(), String> {
    use notify::Watcher;
    let mut slot = hot.0.lock().map_err(|e| e.to_string())?;
    // Dropping the previous watcher stops it; replacement is wholesale.
    *slot = None;
    let Some(path) = path else { return Ok(()) };
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("not a directory: {path}"));
    }
    let handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        // Create + moved-into cover "a file arrived" across file managers,
        // browsers (rename-into-place) and `mv`.
        let arrived = matches!(
            event.kind,
            notify::EventKind::Create(_)
                | notify::EventKind::Modify(notify::event::ModifyKind::Name(
                    notify::event::RenameMode::To
                ))
        );
        if !arrived {
            return;
        }
        let events: State<'_, DesktopEvents> = handle.state();
        for p in event.paths {
            if p.is_file() {
                events.push_path("hotfolderFile", p);
            }
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(&dir, notify::RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    *slot = Some(watcher);
    Ok(())
}

// ── the clipboard-lens tray ──────────────────────────────────────────────────

static TRAY_READY: AtomicBool = AtomicBool::new(false);

/// Build the tray at most once, and only when Lolly becomes a visible app. A
/// D-Bus provider query therefore remains invisible; activating a result (or a
/// later ordinary second-instance launch) promotes the same process and adds
/// the normal tray. A failed optional tray may be retried on the next promotion.
pub fn ensure_tray(app: &AppHandle) {
    if TRAY_READY
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return;
    }
    // catch_unwind, not just `if let Err`: libappindicator-sys panics from a lazy
    // dlopen when libayatana-appindicator3 is absent. A tray is a nicety and must
    // never be the reason the app fails to open.
    let tray = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| setup_tray(app)));
    match tray {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            TRAY_READY.store(false, Ordering::Release);
            eprintln!("[desktop] tray unavailable: {e}");
        }
        Err(_) => {
            TRAY_READY.store(false, Ordering::Release);
            eprintln!(
                "[desktop] tray unavailable: the appindicator library could not be loaded"
            );
        }
    }
}

/// A static menu whose items classify the clipboard AT CLICK TIME (one gesture,
/// one read - see desktop_clipboard_read's doc). Building the menu contents
/// from the clipboard at open time would read it on every hover; the static
/// shape trades a little polish for never touching the clipboard uninvited.
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;

    let qr = MenuItemBuilder::with_id("lens-qr", "QR code from clipboard").build(app)?;
    let color = MenuItemBuilder::with_id("lens-color", "Colour Lab from clipboard").build(app)?;
    let open = MenuItemBuilder::with_id("open", "Open Lolly").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&qr, &color, &open, &quit])
        .build()?;

    TrayIconBuilder::with_id("lolly-tray")
        .icon(app.default_window_icon().cloned().ok_or(tauri::Error::WindowNotFound)?)
        .tooltip("Lolly")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let nav = |route: String| {
                let events: State<'_, DesktopEvents> = app.state();
                events.push("navigate", route);
                focus_main(app);
            };
            match event.id().as_ref() {
                "open" => focus_main(app),
                "quit" => app.exit(0),
                "lens-qr" => {
                    let text = desktop_clipboard_read().unwrap_or_default();
                    let text = text.trim();
                    if text.is_empty() {
                        focus_main(app);
                    } else {
                        nav(format!(
                            "#/tool/qr-code?url={}",
                            urlencode(&text.chars().take(2000).collect::<String>())
                        ));
                    }
                }
                "lens-color" => {
                    let text = desktop_clipboard_read().unwrap_or_default();
                    let t = text.trim();
                    let is_hex = t.starts_with('#')
                        && matches!(t.len(), 4 | 5 | 7 | 9)
                        && t[1..].chars().all(|c| c.is_ascii_hexdigit());
                    if is_hex {
                        nav(format!("#/lab?c={}", urlencode(t)));
                    } else {
                        nav("#/lab".into());
                    }
                }
                _ => {}
            }
        })
        .build(app)?;
    Ok(())
}

/// Minimal percent-encoding for hash-route query values - std-only on purpose
/// (the full URL grammar lives web-side in engine url-mode; this only has to
/// keep `#`, `&`, `%`, `+` and spaces from breaking the hash route).
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

// ── D-Bus: GNOME Shell search, KRunner, org.lolly.Desktop1 (Linux only) ──────

#[cfg(target_os = "linux")]
pub mod dbus {
    use super::{focus_main, urlencode, DesktopEvents};
    use std::collections::HashMap;
    use tauri::{AppHandle, Manager, State};

    /// One searchable tool row, parsed from the catalog index EMBEDDED in the
    /// binary (frontendDist catalog/tools/index.json - the neutral/lolly-start
    /// set unless a profile build embedded more). Matching vocabulary mirrors
    /// the in-app provider (lib/search/providers/tools.ts): name 3, tags 2,
    /// id 2, description 1.
    #[derive(Clone)]
    struct ToolRow {
        id: String,
        name: String,
        description: String,
        haystacks: Vec<(String, u32)>,
    }

    #[derive(Clone)]
    pub struct Index(std::sync::Arc<Vec<ToolRow>>);

    impl Index {
        pub fn load(app: &AppHandle) -> Self {
            let rows = app
                .asset_resolver()
                .get("catalog/tools/index.json".into())
                .and_then(|asset| serde_json::from_slice::<serde_json::Value>(&asset.bytes()).ok())
                .and_then(|v| v.get("tools").cloned())
                .and_then(|t| t.as_array().cloned())
                .map(|tools| {
                    tools
                        .iter()
                        .filter_map(|t| {
                            let s = |k: &str| {
                                t.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string()
                            };
                            if t.get("listed").and_then(|v| v.as_bool()) == Some(false) {
                                return None;
                            }
                            let id = s("id");
                            if id.is_empty() {
                                return None;
                            }
                            let name = s("name");
                            let description = s("description");
                            let tags = t
                                .get("tags")
                                .and_then(|v| v.as_array())
                                .map(|a| {
                                    a.iter()
                                        .filter_map(|x| x.as_str())
                                        .collect::<Vec<_>>()
                                        .join(" ")
                                })
                                .unwrap_or_default();
                            let haystacks = vec![
                                (name.to_lowercase(), 3),
                                (tags.to_lowercase(), 2),
                                (id.to_lowercase(), 2),
                                (description.to_lowercase(), 1),
                            ];
                            Some(ToolRow { id, name, description, haystacks })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Index(std::sync::Arc::new(rows))
        }

        fn matches(&self, terms: &[String], limit: usize) -> Vec<&ToolRow> {
            let terms: Vec<String> = terms
                .iter()
                .map(|t| t.to_lowercase())
                .filter(|t| !t.is_empty())
                .collect();
            if terms.is_empty() {
                return Vec::new();
            }
            let mut scored: Vec<(u32, &ToolRow)> = self
                .0
                .iter()
                .filter_map(|row| {
                    let mut score = 0u32;
                    for term in &terms {
                        let s: u32 = row
                            .haystacks
                            .iter()
                            .filter(|(hay, _)| hay.contains(term.as_str()))
                            .map(|(_, w)| *w)
                            .sum();
                        if s == 0 {
                            return None; // every term must hit somewhere
                        }
                        score += s;
                    }
                    Some((score, row))
                })
                .collect();
            scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.id.cmp(&b.1.id)));
            scored.into_iter().take(limit).map(|(_, r)| r).collect()
        }
    }

    fn activate(app: &AppHandle, tool_id: &str) {
        let events: State<'_, DesktopEvents> = app.state();
        events.push("navigate", format!("#/tool/{tool_id}"));
        focus_main(app);
    }

    /// org.gnome.Shell.SearchProvider2 - result ids ARE tool ids.
    struct GnomeSearch {
        app: AppHandle,
        index: Index,
    }

    #[zbus::interface(name = "org.gnome.Shell.SearchProvider2")]
    impl GnomeSearch {
        fn get_initial_result_set(&self, terms: Vec<String>) -> Vec<String> {
            self.index.matches(&terms, 8).iter().map(|r| r.id.clone()).collect()
        }
        fn get_subsearch_result_set(
            &self,
            _previous: Vec<String>,
            terms: Vec<String>,
        ) -> Vec<String> {
            self.index.matches(&terms, 8).iter().map(|r| r.id.clone()).collect()
        }
        fn get_result_metas(
            &self,
            ids: Vec<String>,
        ) -> Vec<HashMap<String, zbus::zvariant::OwnedValue>> {
            ids.iter()
                .filter_map(|id| self.index.0.iter().find(|r| &r.id == id))
                .map(|row| {
                    let mut m: HashMap<String, zbus::zvariant::OwnedValue> = HashMap::new();
                    let put = |m: &mut HashMap<_, zbus::zvariant::OwnedValue>,
                               k: &str,
                               v: &str| {
                        m.insert(
                            k.to_string(),
                            zbus::zvariant::Value::from(v.to_string()).try_into().unwrap(),
                        );
                    };
                    put(&mut m, "id", &row.id);
                    put(&mut m, "name", &row.name);
                    put(&mut m, "description", &row.description);
                    put(&mut m, "gicon", "tools.lolly.Desktop");
                    m
                })
                .collect()
        }
        fn activate_result(&self, id: String, _terms: Vec<String>, _timestamp: u32) {
            activate(&self.app, &id);
        }
        fn launch_search(&self, terms: Vec<String>, _timestamp: u32) {
            let query = terms.join(" ");
            if !query.trim().is_empty() {
                let events: State<'_, DesktopEvents> = self.app.state();
                events.push("navigate", format!("#/?q={}", urlencode(query.trim())));
            }
            focus_main(&self.app);
        }
    }

    /// org.kde.krunner1 - the same matcher for Plasma. `type` 100 = exact-ish
    /// match band, relevance from our weights normalised to 0..1.
    struct KRunner {
        app: AppHandle,
        index: Index,
    }

    type KMatch = (String, String, String, i32, f64, HashMap<String, zbus::zvariant::OwnedValue>);

    #[zbus::interface(name = "org.kde.krunner1")]
    impl KRunner {
        #[zbus(name = "Match")]
        fn match_(&self, query: String) -> Vec<KMatch> {
            let terms: Vec<String> = query.split_whitespace().map(String::from).collect();
            self.index
                .matches(&terms, 8)
                .iter()
                .map(|r| {
                    (
                        r.id.clone(),
                        format!("Lolly: {}", r.name),
                        "tools.lolly.Desktop".to_string(),
                        100,
                        0.8,
                        HashMap::new(),
                    )
                })
                .collect()
        }
        fn actions(&self) -> Vec<(String, String, String)> {
            Vec::new()
        }
        fn run(&self, match_id: String, _action_id: String) {
            activate(&self.app, &match_id);
        }
    }

    /// org.lolly.Desktop1 - external automation. Render produces a real file: it
    /// runs this executable's own CLI mode, which owns the off-screen WebView and
    /// the cli_write path, and waits for the render to finish. A separate process
    /// rather than an in-process job because this interface is served from the GUI,
    /// whose visible window already holds the label an off-screen render needs.
    /// Callers wanting bytes back on one warm connection use the loopback endpoint
    /// (`Lolly --render-server`, render_server.rs) instead. D-Bus calls here are
    /// handled serially, so only one render runs through this interface at a time.
    struct Desktop1 {
        app: AppHandle,
    }

    #[zbus::interface(name = "org.lolly.Desktop1")]
    impl Desktop1 {
        fn activate(&self) {
            focus_main(&self.app);
        }
        fn show_tool(&self, id: String) {
            activate(&self.app, &id);
        }
        fn render(&self, tool_url: String, out_path: String) -> String {
            match crate::render_server::render_via_child(&tool_url, &out_path) {
                // The file is on disk before this returns, so a caller can read it
                // the moment the method answers.
                Ok(()) => format!("written:{}", out_path.trim()),
                Err(e) => format!("error:{e}"),
            }
        }
    }

    /// Own both bus names and serve the three interfaces. Failure is logged and
    /// swallowed: a session without a bus (containers, exotic setups) must not
    /// take the app down with it.
    pub fn serve(app: AppHandle) {
        let index = Index::load(&app);
        tauri::async_runtime::spawn(async move {
            let search = GnomeSearch { app: app.clone(), index: index.clone() };
            let krunner = KRunner { app: app.clone(), index };
            let desktop1 = Desktop1 { app: app.clone() };
            let build = zbus::connection::Builder::session()
                .and_then(|b| b.name("tools.lolly.Desktop.SearchProvider"))
                .and_then(|b| b.serve_at("/tools/lolly/Desktop/SearchProvider", search))
                .and_then(|b| b.serve_at("/tools/lolly/Desktop/SearchProvider", krunner));
            match build {
                Ok(b) => match b.build().await {
                    Ok(conn) => {
                        // Second well-known name on the same connection.
                        let served = conn
                            .object_server()
                            .at("/org/lolly/Desktop1", desktop1)
                            .await
                            .is_ok();
                        let named =
                            conn.request_name("org.lolly.Desktop1").await.is_ok();
                        if !(served && named) {
                            eprintln!("[desktop] org.lolly.Desktop1 not fully served");
                        }
                        // Keep the connection alive for the app's lifetime.
                        std::mem::forget(conn);
                    }
                    Err(e) => eprintln!("[desktop] dbus unavailable: {e}"),
                },
                Err(e) => eprintln!("[desktop] dbus setup failed: {e}"),
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opened_event_maps_the_scheme_and_real_files_only() {
        let link = url::Url::parse("lolly://tool/qr-code?url=x").unwrap();
        assert_eq!(
            opened_event(&link),
            Some(Opened::DeepLink("lolly://tool/qr-code?url=x".into()))
        );
        // Only the scheme is a deep link - an https link is not routed.
        let https = url::Url::parse("https://lolly.tools/t/qr-code").unwrap();
        assert_eq!(opened_event(&https), None);
        // A file URL must name a file that exists; a missing path is not an open.
        let dir = std::env::temp_dir().join(format!("lolly-opened-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("x.lolly");
        std::fs::write(&file, b"PK").unwrap();
        let file_url = url::Url::from_file_path(&file).unwrap();
        assert_eq!(opened_event(&file_url), Some(Opened::OpenFile(file.clone())));
        let missing = url::Url::from_file_path(dir.join("missing.lolly")).unwrap();
        assert_eq!(opened_event(&missing), None);
        let dir_url = url::Url::from_file_path(&dir).unwrap();
        assert_eq!(opened_event(&dir_url), None, "a directory is not a file open");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn utility_targets_are_an_explicit_allowlist() {
        let args = vec!["--open-with=redact".into(), "/tmp/private.pdf".into()];
        assert_eq!(utility_target(&args), Some("redact"));
        let bad = vec!["--open-with=../tool/evil".into(), "/tmp/x".into()];
        assert_eq!(utility_target(&bad), None);
    }
}
