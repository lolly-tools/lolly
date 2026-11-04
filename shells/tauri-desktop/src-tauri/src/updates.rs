// SPDX-License-Identifier: MPL-2.0
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

#[derive(Default)]
pub struct UpdateExit {
    armed: AtomicBool,
    allowed: AtomicBool,
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
    let (can_install, reason) = install_support();
    Environment { interactive, can_install, reason, version: app.package_info().version.to_string() }
}

fn install_support() -> (bool, &'static str) {
    use tauri::utils::config::BundleType;
    #[cfg(target_os = "linux")]
    if std::env::var_os("FLATPAK_ID").is_some() || std::env::var_os("SNAP").is_some() {
        return (false, "managed");
    }
    match tauri::utils::platform::bundle_type() {
        Some(BundleType::App) if cfg!(target_arch = "aarch64") => (true, ""),
        Some(BundleType::AppImage) => {
            if appimage_writable() { (true, "") } else { (false, "read-only") }
        }
        Some(BundleType::Deb | BundleType::Rpm) => (true, ""),
        _ => (false, "unsupported"),
    }
}

#[cfg(target_os = "linux")]
fn appimage_writable() -> bool {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let Ok(exe) = tauri::utils::platform::current_exe() else { return false };
    let Some(parent) = exe.parent() else { return false };
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
fn appimage_writable() -> bool { false }

#[tauri::command]
pub fn updater_arm(state: tauri::State<UpdateExit>, armed: bool) {
    state.armed.store(armed, Ordering::SeqCst);
}

#[tauri::command]
pub fn updater_finish(app: tauri::AppHandle, state: tauri::State<UpdateExit>, restart: bool) {
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
    if !state.armed.load(Ordering::SeqCst) || state.allowed.load(Ordering::SeqCst) { return; }
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quit_interception_requires_frontend_readiness_and_explicit_completion() {
        let state = UpdateExit::default();
        assert!(!state.armed.load(Ordering::SeqCst));
        assert!(!state.allowed.load(Ordering::SeqCst));
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
