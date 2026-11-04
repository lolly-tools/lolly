// SPDX-License-Identifier: MPL-2.0
//! Local packaged updater qualification. Compiled only with the explicit probe feature.
use std::path::PathBuf;
use std::sync::OnceLock;
static DIRECTORY: OnceLock<PathBuf> = OnceLock::new();
use tauri::{ipc::Invoke, Runtime};

fn directory() -> Result<PathBuf, String> {
    if let Some(path) = DIRECTORY.get() { return Ok(path.clone()); }
    let path = std::env::var_os("LOLLY_UPDATER_PROBE_DIR").ok_or("Missing updater probe directory")?;
    let path = PathBuf::from(path).canonicalize().map_err(|e| e.to_string())?;
    if !path.is_dir() { return Err("Probe directory is not a directory".into()); }
    Ok(path)
}

pub fn validate(context: &tauri::Context) {
    assert_eq!(context.config().identifier, "tools.lolly.UpdaterQualification");
    let updater = &context.config().plugins.0["updater"];
    let endpoints = updater["endpoints"].as_array().expect("local updater endpoints");
    assert_eq!(endpoints.len(), 1);
    let url = url::Url::parse(endpoints[0].as_str().unwrap()).unwrap();
    assert!(matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1")));
    assert_ne!(updater["pubkey"], "PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE");
    if let Some(path) = context.config().plugins.0.get("updaterProbe").and_then(|v| v["directory"].as_str()) {
        let path = PathBuf::from(path).canonicalize().expect("Probe directory");
        assert!(path.is_dir());
        let _ = DIRECTORY.set(path);
    }
    directory().expect("Updater probe evidence directory");
}

#[tauri::command]
fn updater_probe_poll() -> Result<Option<serde_json::Value>, String> {
    let command = directory()?.join("command.json");
    if !command.exists() { return Ok(None); }
    let bytes = std::fs::read(&command).map_err(|e| e.to_string())?;
    std::fs::remove_file(command).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn updater_probe_report<R: Runtime>(app: tauri::AppHandle<R>, mut value: serde_json::Value) -> Result<(), String> {
    value["processId"] = std::process::id().into();
    value["nativeVersion"] = app.package_info().version.to_string().into();
    let binary = tauri::utils::platform::current_exe().map_err(|e| e.to_string())?;
    let parent = binary.parent().ok_or("Missing executable parent")?;
    value["sidecarPresent"] = parent.join("lolly-cli").is_file().into();
    if cfg!(target_os = "macos") {
        value["extensionsPresent"] = parent.join("../PlugIns/LollyPreview.appex").is_dir().into();
    }
    let text = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
    let dir = directory()?;
    std::fs::write(dir.join("status.tmp"), text).map_err(|e| e.to_string())?;
    std::fs::rename(dir.join("status.tmp"), dir.join("status.json")).map_err(|e| e.to_string())
}

pub fn route<R: Runtime>(invoke: Invoke<R>) -> bool {
    let handler: fn(Invoke<R>) -> bool = tauri::generate_handler![updater_probe_poll, updater_probe_report];
    handler(invoke)
}
