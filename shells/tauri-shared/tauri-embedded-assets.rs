// SPDX-License-Identifier: MPL-2.0
//! Preserve embedded bytes while correcting one proven module MIME false positive.
#[path = "embedded-js-mime.rs"]
mod mime;

pub fn correct(
    request: tauri::http::Request<Vec<u8>>,
    response: &mut tauri::http::Response<std::borrow::Cow<'static, [u8]>>,
) {
    let uri = request.uri();
    if mime::is_pdf_sniffed_module(
        uri.scheme_str(),
        uri.authority().map(|value| value.as_str()),
        uri.path(),
        response.status().as_u16(),
        response
            .headers()
            .get(tauri::http::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok()),
        response.body().as_ref(),
    ) {
        response.headers_mut().insert(
            tauri::http::header::CONTENT_TYPE,
            tauri::http::HeaderValue::from_static("text/javascript"),
        );
    }
}
