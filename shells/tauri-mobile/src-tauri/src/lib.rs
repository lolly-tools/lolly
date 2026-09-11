mod site_fetch;
mod remote_fetch;

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, State};

const LOLLY_MIME: &str = "application/vnd.lolly+zip";
const MAX_OPEN_FILE_BYTES: u64 = 48 * 1024 * 1024;
const MAX_PENDING_FILES: usize = 4;

fn read_file_capped(path: &std::path::Path) -> std::io::Result<Vec<u8>> {
    use std::io::{Error, ErrorKind, Read};

    let file = std::fs::File::open(path)?;
    let meta = file.metadata()?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_OPEN_FILE_BYTES {
        return Err(Error::new(
            ErrorKind::InvalidData,
            "opened file is empty or too large",
        ));
    }
    // Keep the stream cap as well as the metadata check: a provider-backed file
    // can change between the stat and read, and must never grow the in-memory slot.
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    file.take(MAX_OPEN_FILE_BYTES + 1).read_to_end(&mut bytes)?;
    if bytes.is_empty() || bytes.len() as u64 > MAX_OPEN_FILE_BYTES {
        return Err(Error::new(
            ErrorKind::InvalidData,
            "opened file is empty or too large",
        ));
    }
    Ok(bytes)
}

#[cfg(target_os = "ios")]
fn read_opened_file(url: &tauri::Url, path: &std::path::Path) -> std::io::Result<Vec<u8>> {
    use objc2_foundation::{NSString, NSURL};

    // Files outside the app container arrive as security-scoped URLs. Take the
    // scope only for the synchronous read and release it before returning; files
    // copied into the app's own Inbox remain readable even when this returns false.
    let ns_url = NSURL::URLWithString(&NSString::from_str(url.as_str()));
    let scoped = ns_url
        .as_ref()
        .is_some_and(|url| unsafe { url.startAccessingSecurityScopedResource() });
    let result = read_file_capped(path);
    if scoped {
        if let Some(url) = ns_url.as_ref() {
            unsafe { url.stopAccessingSecurityScopedResource() };
        }
    }
    result
}

#[cfg(not(target_os = "ios"))]
fn read_opened_file(_url: &tauri::Url, path: &std::path::Path) -> std::io::Result<Vec<u8>> {
    read_file_capped(path)
}

/// One queued native happening, in the desktop shell's vocabulary
/// (desktop_integration.rs): `kind` is "deepLink" or "openFile" here.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileEvent {
    pub kind: String,
    pub value: String,
}

/// One file captured while iOS still grants access to the URL delivered by its
/// document-open callback. The browser takes it exactly once through
/// `mobile_take_open_file`; the bytes never become a broad filesystem grant.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileOpenedFile {
    pub name: String,
    pub mime: String,
    pub bytes: Vec<u8>,
}

/// The URLs iOS hands the running app (RunEvent::Opened): lolly:// links from
/// CFBundleURLTypes and file:// document opens from CFBundleDocumentTypes.
/// Android never reaches this queue: MainActivity stashes ACTION_VIEW links and
/// content documents on the LollyShare bridge, and the JS intake prefers that
/// bridge when it exists. Poll, not push - the house Rust->JS pattern, so an
/// event that arrives before the web shell boots is not lost.
pub struct MobileEvents {
    queue: Mutex<Vec<MobileEvent>>,
    files: Mutex<BTreeMap<u64, MobileOpenedFile>>,
    next_file: AtomicU64,
}

impl Default for MobileEvents {
    fn default() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
            files: Mutex::new(BTreeMap::new()),
            next_file: AtomicU64::new(1),
        }
    }
}

impl MobileEvents {
    fn push(&self, kind: &str, value: String) {
        if let Ok(mut q) = self.queue.lock() {
            // A never-polling webview must not grow this without bound.
            if q.len() > 64 {
                q.drain(0..32);
            }
            q.push(MobileEvent {
                kind: kind.into(),
                value,
            });
        }
    }

    /// Read an iOS-opened file immediately. With documents opened in place the
    /// URL may be security-scoped, so postponing the filesystem read until the
    /// webview polls can lose the OS-granted access. Only the bounded bytes and a
    /// small opaque token survive the callback.
    fn push_open_file(&self, url: &tauri::Url) {
        let Ok(path) = url.to_file_path() else { return };
        let Ok(bytes) = read_opened_file(url, &path) else {
            eprintln!(
                "[mobile] refusing unreadable, empty or oversized opened file: {}",
                path.display()
            );
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("shared file")
                .chars()
                .filter(|c| !c.is_control() && *c != '/' && *c != '\\')
                .take(160)
                .collect();
            self.push("openFileError", name);
            return;
        };
        let raw_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("shared.lolly");
        let name: String = raw_name
            .chars()
            .filter(|c| !c.is_control() && *c != '/' && *c != '\\')
            .take(160)
            .collect();
        let name = if name.is_empty() {
            "shared.lolly".into()
        } else {
            name
        };
        let mime = if path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lolly"))
        {
            LOLLY_MIME
        } else {
            "application/octet-stream"
        };
        let token = self.next_file.fetch_add(1, Ordering::Relaxed);
        if let Ok(mut files) = self.files.lock() {
            while files.len() >= MAX_PENDING_FILES {
                let Some(oldest) = files.keys().next().copied() else {
                    break;
                };
                files.remove(&oldest);
            }
            files.insert(
                token,
                MobileOpenedFile {
                    name,
                    mime: mime.into(),
                    bytes,
                },
            );
        } else {
            return;
        }
        self.push("openFile", token.to_string());
    }
}

#[tauri::command]
fn mobile_poll_events(events: State<'_, MobileEvents>) -> Vec<MobileEvent> {
    events
        .queue
        .lock()
        .map(|mut q| std::mem::take(&mut *q))
        .unwrap_or_default()
}

/// Take bytes for one OS-delivered document. Tokens only come from the native
/// event queue and are consumed on read, so this is not a general path reader.
#[tauri::command]
fn mobile_take_open_file(
    events: State<'_, MobileEvents>,
    token: String,
) -> Option<MobileOpenedFile> {
    let token = token.parse::<u64>().ok()?;
    events.files.lock().ok()?.remove(&token)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .manage(MobileEvents::default())
        // The website source for the Design System studio (plans/97 section 9)
        // was the first command of this shell's own, because it has to enforce
        // the first-party redirect rule and the byte caps itself; the deep-link
        // queue is the second. Remote HTTP is a bounded command rather than a
        // webview-visible plugin; everything else is fs or the shared bridge.
        .invoke_handler(tauri::generate_handler![
            site_fetch::site_fetch,
            remote_fetch::remote_fetch,
            mobile_poll_events,
            mobile_take_open_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building Lolly mobile")
        .run(|app, event| {
            // iOS delivers both a lolly:// link and a .lolly document open as
            // RunEvent::Opened. Capture document bytes inside this callback while
            // the security-scoped URL is live, then let the web shell take them
            // through the same chooser as a drop or Android content intent.
            // The cfg names macOS too so `cargo check` on a Mac compiles this arm;
            // the macOS app itself is the desktop shell, with its own handler.
            #[cfg(any(target_os = "ios", target_os = "macos"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                let events: State<'_, MobileEvents> = app.state();
                for u in urls {
                    match u.scheme() {
                        "lolly" => events.push("deepLink", u.as_str().to_string()),
                        "file" => events.push_open_file(u),
                        _ => {}
                    }
                }
            }
            #[cfg(not(any(target_os = "ios", target_os = "macos")))]
            let _ = (app, &event);
        });
}
