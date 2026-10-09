// SPDX-License-Identifier: MPL-2.0
//! Guard for Tauri's PDF content sniffing of embedded JavaScript modules.

pub fn is_pdf_sniffed_module(
    scheme: Option<&str>,
    authority: Option<&str>,
    path: &str,
    status: u16,
    content_type: Option<&str>,
    body: &[u8],
) -> bool {
    if status != 200
        || content_type != Some("application/pdf")
        || !matches!(
            (scheme, authority),
            (Some("tauri"), Some("localhost")) | (Some("http" | "https"), Some("tauri.localhost"))
        )
    {
        return false;
    }
    let Some(file) = path.strip_prefix("/_app/") else {
        return false;
    };
    let Some(stem) = file
        .strip_suffix(".js")
        .or_else(|| file.strip_suffix(".mjs"))
    else {
        return false;
    };
    if stem.is_empty()
        || !stem
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        || !body[..body.len().min(1024)]
            .windows(4)
            .any(|bytes| bytes == b"%PDF")
    {
        return false;
    }
    let Ok(script) = std::str::from_utf8(body) else {
        return false;
    };
    let script = script
        .strip_prefix('\u{feff}')
        .unwrap_or(script)
        .trim_start_matches(|character: char| character.is_ascii_whitespace());
    // The bundled module must start with a JavaScript declaration. HTML from a
    // missing-resource fallback and actual PDF headers retain their original MIME.
    ["import", "export", "const", "let", "var", "function"]
        .iter()
        .any(|token| {
            script.strip_prefix(token).is_some_and(|rest| {
                rest.as_bytes().first().is_some_and(|byte| {
                    byte.is_ascii_whitespace() || matches!(byte, b'{' | b'(' | b'*' | b'\'' | b'"')
                })
            })
        })
}

#[cfg(test)]
mod tests {
    use super::is_pdf_sniffed_module;

    const SCRIPT: &[u8] = b"import{read}from'./source.js';const signature='%PDF-';export{read};";

    fn accepts(scheme: Option<&str>, authority: Option<&str>, path: &str) -> bool {
        is_pdf_sniffed_module(
            scheme,
            authority,
            path,
            200,
            Some("application/pdf"),
            SCRIPT,
        )
    }

    #[test]
    fn accepts_only_owned_native_origins_and_canonical_modules() {
        for (scheme, authority) in [
            ("tauri", "localhost"),
            ("http", "tauri.localhost"),
            ("https", "tauri.localhost"),
        ] {
            for path in [
                "/_app/asset-viewer-source-CnTEdJa3.js",
                "/_app/worker_01.mjs",
            ] {
                assert!(accepts(Some(scheme), Some(authority), path));
            }
        }
        for (scheme, authority) in [
            ("https", "localhost"),
            ("tauri", "tauri.localhost"),
            ("file", "localhost"),
            ("https", "example.com"),
            ("https", "tauri.localhost.example.com"),
            ("https", "user@tauri.localhost"),
            ("tauri", "user@localhost"),
            ("http", "tauri.localhost:80"),
            ("https", "tauri.localhost:443"),
            ("tauri", "localhost:80"),
            ("tauri", "LOCALHOST"),
        ] {
            assert!(!accepts(Some(scheme), Some(authority), "/_app/main.js"));
        }
        assert!(!accepts(None, Some("localhost"), "/_app/main.js"));
        assert!(!accepts(Some("tauri"), None, "/_app/main.js"));
    }

    #[test]
    fn rejects_assets_traversal_and_encoded_path_variants() {
        for path in [
            "/_app/.js",
            "/_app/main.JS",
            "/_app/main.js/",
            "/_app/main.js#part",
            "/_app/main.js?other",
            "/_app/nested/main.js",
            "/_app/../main.js",
            "/_app/main%2ejs",
            "/_app/%2e%2e/main.js",
            "/_app/main\\other.js",
            "/_app/main.extra.js",
            "//_app/main.js",
            "/_app/é.js",
            "/main.js",
            "/catalog/main.js",
            "/user-assets/main.js",
            "/_app/main.css",
            "/_app/main.pdf",
            "/_app/main.wasm",
            "/_app/index.html",
        ] {
            assert!(!accepts(Some("tauri"), Some("localhost"), path), "{path}");
        }
    }

    #[test]
    fn preserves_status_mime_and_non_script_bodies() {
        for status in [201, 204, 301, 304, 400, 404, 500] {
            assert!(!is_pdf_sniffed_module(
                Some("tauri"),
                Some("localhost"),
                "/_app/main.js",
                status,
                Some("application/pdf"),
                SCRIPT
            ));
        }
        for mime in [
            None,
            Some("text/html"),
            Some("text/javascript"),
            Some("text/css"),
            Some("application/wasm"),
            Some("application/pdf; charset=utf-8"),
        ] {
            assert!(!is_pdf_sniffed_module(
                Some("tauri"),
                Some("localhost"),
                "/_app/main.js",
                200,
                mime,
                SCRIPT
            ));
        }
        for body in [
            b"%PDF-1.7\nactual document".as_slice(),
            b"junk before a PDF header\n%PDF-1.7".as_slice(),
            b"<!doctype html><script>const signature='%PDF-';</script>".as_slice(),
            b"<html>missing resource %PDF</html>".as_slice(),
            b"imported PDF %PDF".as_slice(),
            b"import{read}from'./source.js';".as_slice(),
            b"import '%PDF';\xff".as_slice(),
            b"".as_slice(),
        ] {
            assert!(!is_pdf_sniffed_module(
                Some("tauri"),
                Some("localhost"),
                "/_app/main.js",
                200,
                Some("application/pdf"),
                body
            ));
        }
        let late_signature = format!("const padding='{}%PDF';", " ".repeat(1024));
        assert!(!is_pdf_sniffed_module(
            Some("tauri"),
            Some("localhost"),
            "/_app/main.js",
            200,
            Some("application/pdf"),
            late_signature.as_bytes()
        ));
        assert!(is_pdf_sniffed_module(
            Some("tauri"),
            Some("localhost"),
            "/_app/main.js",
            200,
            Some("application/pdf"),
            b"\xef\xbb\xbf \nconst signature='%PDF';"
        ));
    }
}
