// SPDX-License-Identifier: MPL-2.0
use std::{borrow::Cow, sync::{Arc, atomic::{AtomicBool, AtomicUsize, Ordering}}};
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

struct ProbeState { blocked: Arc<AtomicBool>, refused: Arc<AtomicUsize>, requests: Arc<AtomicUsize>, output: std::path::PathBuf }

#[tauri::command]
fn geometry_progress(stage: String) { println!("Geometry probe stage: {}", stage.chars().take(80).collect::<String>()); }

#[tauri::command]
fn geometry_block(blocked: bool, state: State<ProbeState>) { state.blocked.store(blocked, Ordering::SeqCst); }

#[tauri::command]
fn geometry_report(report: serde_json::Value, state: State<ProbeState>, app: tauri::AppHandle) -> Result<(), String> {
    let value = serde_json::json!({"report": report, "native": {"wasmRequests": state.requests.load(Ordering::SeqCst), "refusedRequests": state.refused.load(Ordering::SeqCst)}});
    let bytes = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
    if bytes.len() > 64 * 1024 * 1024 { return Err("Probe report exceeds its bound.".into()); }
    std::fs::write(&state.output, bytes).map_err(|e| e.to_string())?;
    app.exit(if report.get("error").is_some() { 1 } else { 0 });
    Ok(())
}

fn main() {
    let output = std::env::var_os("LOLLY_GEOMETRY_PROBE_REPORT").expect("Missing probe report path");
    let mode = std::env::var("LOLLY_GEOMETRY_PROBE_MODE").unwrap_or_else(|_| "qualification".into());
    assert!(["qualification", "forward", "reverse"].contains(&mode.as_str()), "Unknown probe mode");
    let state = ProbeState { blocked: Arc::new(AtomicBool::new(false)), refused: Arc::new(AtomicUsize::new(0)), requests: Arc::new(AtomicUsize::new(0)), output: output.into() };
    tauri::Builder::default().manage(state)
        .invoke_handler(tauri::generate_handler![geometry_block, geometry_report, geometry_progress])
        .setup(move |app| {
            let state = app.state::<ProbeState>();
            let blocked = state.blocked.clone(); let refused = state.refused.clone(); let requests = state.requests.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Lolly Geometry Qualification").incognito(true).inner_size(480.0, 160.0).focused(false)
                .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
                .initialization_script(format!("window.__geometryMode={};", serde_json::to_string(&mode)?))
                .on_web_resource_request(move |request, response| {
                    if request.uri().path().ends_with(".wasm") {
                        println!("Geometry probe WASM request: {}", request.uri().path());
                        requests.fetch_add(1, Ordering::SeqCst);
                        response.headers_mut().insert("cache-control", "no-store".parse().unwrap());
                        if blocked.load(Ordering::SeqCst) {
                            refused.fetch_add(1, Ordering::SeqCst);
                            *response.status_mut() = tauri::http::StatusCode::SERVICE_UNAVAILABLE;
                            *response.body_mut() = Cow::Borrowed(b"Deliberate geometry loading refusal");
                        }
                    }
                }).build()?;
            Ok(())
        }).run(tauri::generate_context!()).expect("Geometry probe runtime failed");
}
