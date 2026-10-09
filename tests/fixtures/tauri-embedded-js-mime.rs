// SPDX-License-Identifier: MPL-2.0
//! Link against the frozen native target's Tauri crates with rustc --test.
//! LOLLY_MIME_REPRO_MODULE must name the retained failing compiled module.
#[path = "../../shells/tauri-shared/tauri-embedded-assets.rs"]
mod embedded_assets;

use std::borrow::Cow;
use tauri::http::{header::CONTENT_TYPE, Request, Response};

// Typecheck the public callback against the actual locked Tauri builder API.
#[allow(dead_code)]
fn configured_window<M: tauri::Manager<tauri::Wry>>(
    manager: &M,
    config: &tauri::utils::config::WindowConfig,
) -> tauri::Result<()> {
    let _builder = tauri::WebviewWindowBuilder::from_config(manager, config)?
        .on_web_resource_request(embedded_assets::correct);
    Ok(())
}

fn correct(uri: &str, body: Vec<u8>, status: u16) -> Response<Cow<'static, [u8]>> {
    let mime = tauri_utils::mime_type::MimeType::parse(&body, "/_app/main.js");
    let request = Request::builder().uri(uri).body(Vec::new()).unwrap();
    let mut response = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, mime)
        .header(
            "Content-Security-Policy",
            "default-src 'self'; object-src 'none'",
        )
        .header("X-Qualification-Receipt", "unchanged")
        .body(Cow::Owned(body))
        .unwrap();
    embedded_assets::correct(request, &mut response);
    response
}

#[test]
fn frozen_compiled_module_uses_original_bytes_and_only_changes_mime() {
    let path =
        std::env::var("LOLLY_MIME_REPRO_MODULE").expect("provide the retained compiled module");
    let body = std::fs::read(path).unwrap();
    assert_eq!(body.len(), 2023);
    assert_eq!(
        body.windows(5).position(|bytes| bytes == b"%PDF-"),
        Some(826)
    );
    assert_eq!(
        tauri_utils::mime_type::MimeType::parse(&body, "/_app/asset-viewer-source-CnTEdJa3.js"),
        "application/pdf"
    );
    for origin in [
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ] {
        let response = correct(
            &format!("{origin}/_app/asset-viewer-source-CnTEdJa3.js?v=source"),
            body.clone(),
            200,
        );
        assert_eq!(response.headers()[CONTENT_TYPE], "text/javascript");
        assert_eq!(
            response.headers()["Content-Security-Policy"],
            "default-src 'self'; object-src 'none'"
        );
        assert_eq!(response.headers()["X-Qualification-Receipt"], "unchanged");
        assert_eq!(response.status().as_u16(), 200);
        assert_eq!(response.body().as_ref(), body.as_slice());
    }
}

#[test]
fn sniffed_html_fallback_and_actual_pdf_are_preserved() {
    for body in [
        b"<!doctype html><html><script>const signature='%PDF-';</script></html>".as_slice(),
        b"%PDF-1.7\nactual document".as_slice(),
    ] {
        let response = correct("tauri://localhost/_app/missing.js", body.to_vec(), 200);
        assert_eq!(response.headers()[CONTENT_TYPE], "application/pdf");
        assert_eq!(response.body().as_ref(), body);
    }
    let script = b"import{read}from'./source.js';const signature='%PDF-';";
    let response = correct("tauri://localhost/_app/main.js", script.to_vec(), 404);
    assert_eq!(response.headers()[CONTENT_TYPE], "application/pdf");
    assert_eq!(response.status().as_u16(), 404);
}

#[test]
fn parsed_uri_excludes_credentials_ports_and_external_origins() {
    let script = b"import{read}from'./source.js';const signature='%PDF-';";
    for uri in [
        "tauri://user@localhost/_app/main.js",
        "tauri://localhost:80/_app/main.js",
        "https://tauri.localhost:443/_app/main.js",
        "https://tauri.localhost.example.com/_app/main.js",
        "https://example.com/_app/main.js",
        "tauri://localhost/_app/main%2ejs",
        "tauri://localhost/_app/../main.js",
        "tauri://localhost/catalog/main.js",
        "tauri://localhost/_app/main.pdf",
    ] {
        let response = correct(uri, script.to_vec(), 200);
        assert_eq!(response.headers()[CONTENT_TYPE], "application/pdf", "{uri}");
        assert_eq!(response.body().as_ref(), script);
    }
}
