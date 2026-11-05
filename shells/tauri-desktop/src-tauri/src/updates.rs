// SPDX-License-Identifier: MPL-2.0
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

#[derive(Default)]
pub struct UpdateExit {
    armed: AtomicBool,
    allowed: AtomicBool,
}

impl UpdateExit {
    fn protects_quit(&self) -> bool {
        self.armed.load(Ordering::SeqCst) && !self.allowed.load(Ordering::SeqCst)
    }

    #[cfg(feature = "updater-probe")]
    pub fn probe(&self) -> serde_json::Value {
        serde_json::json!({ "armed": self.armed.load(Ordering::SeqCst), "allowed": self.allowed.load(Ordering::SeqCst) })
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    interactive: bool,
    can_install: bool,
    reason: &'static str,
    version: String,
}

#[tauri::command]
pub fn updater_environment(app: tauri::AppHandle) -> Environment {
    let interactive = app.get_webview_window("main")
        .and_then(|w| w.is_visible().ok()).unwrap_or(false);
    let (can_install, reason) = install_support(&app);
    Environment { interactive, can_install, reason, version: app.package_info().version.to_string() }
}

fn install_support(app: &tauri::AppHandle) -> (bool, &'static str) {
    #[cfg(not(target_os = "linux"))]
    let _ = app;
    use tauri::utils::config::BundleType;
    #[cfg(target_os = "linux")]
    if std::env::var_os("FLATPAK_ID").is_some() || std::env::var_os("SNAP").is_some() {
        return (false, "managed");
    }
    match tauri::utils::platform::bundle_type() {
        Some(BundleType::App) if cfg!(target_arch = "aarch64") => (true, ""),
        Some(BundleType::AppImage) => {
            if appimage_writable(app) { (true, "") } else { (false, "read-only") }
        }
        Some(BundleType::Deb | BundleType::Rpm) => (true, ""),
        _ => (false, "unsupported"),
    }
}

#[cfg(target_os = "linux")]
fn appimage_writable(app: &tauri::AppHandle) -> bool {
    // Match the updater's original AppImage path, never its extracted executable.
    let env = app.env();
    replaceable_appimage(env.appimage.as_deref().map(std::path::Path::new))
}

#[cfg(target_os = "linux")]
fn replaceable_appimage(path: Option<&std::path::Path>) -> bool {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let Some(path) = path else { return false };
    if !path.is_absolute() || !path.is_file() { return false; }
    let Some(parent) = path.parent() else { return false };
    let Ok(parent) = CString::new(parent.as_os_str().as_bytes()) else { return false };
    // Replacement needs directory permissions and a writable mount, not just file mode bits.
    unsafe {
        let mut stat = std::mem::zeroed::<libc::statvfs>();
        libc::access(parent.as_ptr(), libc::W_OK | libc::X_OK) == 0
            && libc::statvfs(parent.as_ptr(), &mut stat) == 0
            && stat.f_flag & libc::ST_RDONLY == 0
    }
}
#[cfg(not(target_os = "linux"))]
fn appimage_writable(_app: &tauri::AppHandle) -> bool { false }

#[tauri::command]
pub fn updater_arm(state: tauri::State<UpdateExit>, armed: bool) {
    #[cfg(feature = "updater-probe")]
    eprintln!("[updater-probe] arm={armed} allowed={}", state.allowed.load(Ordering::SeqCst));
    state.armed.store(armed, Ordering::SeqCst);
}

#[tauri::command]
pub fn updater_finish(app: tauri::AppHandle, state: tauri::State<UpdateExit>, restart: bool) {
    #[cfg(feature = "updater-probe")]
    eprintln!("[updater-probe] finish restart={restart}");
    state.allowed.store(true, Ordering::SeqCst);
    if restart { app.restart(); } else { app.exit(0); }
}

#[tauri::command]
pub fn updater_focused(app: tauri::AppHandle) -> bool {
    app.webview_windows().values().any(|w| w.is_focused().unwrap_or(false))
}

/// Native quit and main-window close use one frontend save decision before exit.
pub fn handle(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    let state = app.state::<UpdateExit>();
    #[cfg(feature = "updater-probe")]
    if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit | tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::CloseRequested { .. }, .. }) {
        eprintln!("[updater-probe] exit event armed={} allowed={}", state.armed.load(Ordering::SeqCst), state.allowed.load(Ordering::SeqCst));
    }
    if !state.protects_quit() { return; }
    match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
            let _ = app.emit_to("main", "lolly-update-quit", ());
        }
        tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::CloseRequested { api, .. }, .. } if label == "main" => {
            api.prevent_close();
            let _ = app.emit_to("main", "lolly-update-quit", ());
        }
        _ => {}
    }
}

// AppKit can terminate directly without an ExitRequested event. Keep that
// decision pending until the frontend completes its save barrier.
#[cfg(target_os = "macos")]
pub fn install_native_quit_guard(app: &tauri::AppHandle) {
    use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
    use objc2::sel;
    use objc2_app_kit::{NSApplication, NSApplicationTerminateReply};
    use std::sync::OnceLock;
    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
    let _ = APP.set(app.clone());
    let Some(thread) = objc2::MainThreadMarker::new() else { return };
    let application = NSApplication::sharedApplication(thread);
    let Some(delegate) = application.delegate() else { return };
    let delegate: &AnyObject = delegate.as_ref();
    extern "C-unwind" fn should_terminate(_this: &AnyObject, _cmd: Sel, _sender: *mut AnyObject) -> NSApplicationTerminateReply {
        if let Some(app) = APP.get() {
            if app.state::<UpdateExit>().protects_quit() {
                let _ = app.emit_to("main", "lolly-update-quit", ());
                return NSApplicationTerminateReply::TerminateCancel;
            }
        }
        NSApplicationTerminateReply::TerminateNow
    }
    // SAFETY: the function matches Q@:@ (NSUInteger, self, selector, object),
    // and adds no instance state to the event loop's existing delegate class.
    let installed = unsafe {
        objc2::ffi::class_addMethod(
            delegate.class() as *const AnyClass as *mut AnyClass,
            sel!(applicationShouldTerminate:),
            std::mem::transmute::<extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) -> NSApplicationTerminateReply, Imp>(should_terminate),
            c"Q@:@".as_ptr(),
        )
    }.as_bool();
    #[cfg(feature = "updater-probe")]
    eprintln!("[updater-probe] AppKit quit guard installed={installed}");
    #[cfg(not(feature = "updater-probe"))]
    let _ = installed;
}

#[cfg(not(target_os = "macos"))]
pub fn install_native_quit_guard(_app: &tauri::AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quit_interception_requires_frontend_readiness_and_explicit_completion() {
        let state = UpdateExit::default();
        assert!(!state.armed.load(Ordering::SeqCst));
        assert!(!state.allowed.load(Ordering::SeqCst));
        assert!(!state.protects_quit());
        state.armed.store(true, Ordering::SeqCst);
        assert!(state.protects_quit());
        state.allowed.store(true, Ordering::SeqCst);
        assert!(!state.protects_quit());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn appimage_checks_the_original_directory_and_requires_path_evidence() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempfile::tempdir().unwrap();
        let original = directory.path().join("Lolly.AppImage");
        std::fs::write(&original, b"AppImage fixture").unwrap();
        assert!(replaceable_appimage(Some(&original)));
        assert!(!replaceable_appimage(None));
        assert!(!replaceable_appimage(Some(std::path::Path::new("relative.AppImage"))));
        assert!(!replaceable_appimage(Some(&directory.path().join("missing.AppImage"))));
        if unsafe { libc::geteuid() } != 0 {
            std::fs::set_permissions(directory.path(), std::fs::Permissions::from_mode(0o555)).unwrap();
            let writable = replaceable_appimage(Some(&original));
            std::fs::set_permissions(directory.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
            assert!(!writable);
        }
    }
}

/// Open only the trusted manual installation page in the system browser.
#[tauri::command]
pub fn updater_open_download() -> Result<(), String> {
    let program = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(program)
        .arg("https://lolly.tools/info/install.html")
        .spawn().map(|_| ()).map_err(|error| error.to_string())
}
