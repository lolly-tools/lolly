// SPDX-License-Identifier: MPL-2.0
use tauri::{WebviewUrl, WebviewWindowBuilder};

fn main() {
    let input = std::env::args().nth(1).expect("Missing isolated qualification URL");
    if input == "--runtime-info" {
        let version = tauri::webview_version().expect("Could not inspect the native webview runtime");
        println!("{}", serde_json::json!({ "version": version, "os": std::env::consts::OS, "architecture": std::env::consts::ARCH }));
        return;
    }
    let url = tauri::Url::parse(&input).expect("Invalid qualification URL");
    assert!(url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port().is_some(), "Only the local qualification collector is allowed");
    assert!(url.query_pairs().any(|(key, value)| key == "qualification" && !value.is_empty()), "Missing qualification page identity");
    tauri::Builder::default()
        .setup(move |app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Lolly WebGPU Qualification").incognito(true).inner_size(480.0, 160.0).focused(false)
                .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
                .build()?;
            Ok(())
        }).run(tauri::generate_context!()).expect("Native qualification runtime failed");
}
