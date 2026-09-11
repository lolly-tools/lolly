// SPDX-License-Identifier: MPL-2.0
//! Loopback OAuth return leg (plans/129 WP4).
//!
//! Native apps must run provider sign-in in the SYSTEM browser (Google refuses
//! embedded webviews outright, and managed-account SSO policies often do too),
//! and the standard return path for a desktop app is RFC 8252's loopback
//! redirect: the app listens once on an ephemeral 127.0.0.1 port, the provider
//! redirects the browser there with `?code=…&state=…`, the app answers with a
//! tiny "return to Lolly" page and hands the query string to the JS side,
//! which owns state validation and the PKCE token exchange
//! (shells/web/src/lib/provider-auth.ts `loopbackVia`).
//!
//! Two commands because JS needs the PORT before it can build the authorize
//! URL: `oauth_listen` binds and returns the port; `oauth_wait` accepts one
//! request carrying a query string (anything else - favicon probes and the
//! like - gets a 404 and another wait) until the deadline. The listener is
//! single-shot and removed from the table the moment `oauth_wait` claims it;
//! an abandoned listen is reclaimed by the next `oauth_listen` call's sweep.
//! Loopback-only by construction: the bind is 127.0.0.1, never 0.0.0.0.
//!
//! `oauth_listen` takes an OPTIONAL list of preferred ports (plans/129 WP4b).
//! An ephemeral port is the RFC 8252 default and what most providers accept,
//! but a provider that matches the redirect URI exactly with no port wildcard
//! (LinkedIn) can only be given ports its registration already names - so the
//! list is tried in order and, if every one is taken, the call FAILS naming
//! them rather than falling back to a random port the provider would refuse.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::State;

/// Open listeners by port, claimed exactly once by `oauth_wait`.
#[derive(Default)]
pub struct OauthListeners(Mutex<HashMap<u16, TcpListener>>);

/// What the browser tab shows after the redirect lands. Deliberately plain and
/// self-contained (no assets, no scripts): its only job is "you can go back".
const RETURN_PAGE: &str = "<!doctype html><meta charset=\"utf-8\">\
<title>Lolly</title>\
<body style=\"font:15px system-ui,sans-serif;color:#444;display:grid;place-items:center;min-height:90vh;margin:0\">\
<p>\u{2705} Signed in \u{2014} you can close this tab and return to Lolly.</p>";

/** Open only a parsed HTTPS authorization URL in the system browser. This
 * narrow command replaces the generic shell plugin's `open` permission, so an
 * injected caller cannot ask Tauri to open a file, executable, or custom URI. */
#[tauri::command]
pub fn oauth_open(raw: String) -> Result<(), String> {
    let url = authorize_url(&raw)?;
    open_system_url(url.as_str())
}

fn authorize_url(raw: &str) -> Result<url::Url, String> {
    let url = url::Url::parse(raw).map_err(|_| "invalid authorization URL")?;
    if url.scheme() != "https" || url.host_str().is_none() {
        return Err("authorization URL must be https".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("authorization URL must not contain credentials".into());
    }
    Ok(url)
}

fn open_system_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = std::process::Command::new("rundll32");
        cmd.arg("url.dll,FileProtocolHandler");
        cmd
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    return Err("opening a system browser is unsupported on this platform".into());

    command
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("could not open system browser: {e}"))
}

#[tauri::command]
pub fn oauth_listen(ports: Option<Vec<u16>>, state: State<OauthListeners>) -> Result<u16, String> {
    let mut map = state.0.lock().map_err(|_| "listener table poisoned")?;
    // Reclaim abandoned listens (a cancelled sign-in never calls oauth_wait):
    // one interactive flow at a time is the honest model, so a fresh listen
    // sweeps the table rather than leaking sockets across attempts. It happens
    // BEFORE the bind, which matters once the ports are fixed: a leftover
    // socket of our own would otherwise read as "port in use" and burn through
    // the short registered list.
    map.clear();
    let listener = match ports.as_deref() {
        Some(preferred) if !preferred.is_empty() => bind_preferred(preferred)?,
        _ => TcpListener::bind("127.0.0.1:0").map_err(|e| format!("bind failed: {e}"))?,
    };
    let port = listener
        .local_addr()
        .map_err(|e| format!("no local addr: {e}"))?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("nonblocking failed: {e}"))?;
    map.insert(port, listener);
    Ok(port)
}

/// First free port from the caller's list. No silent fallback: a port the
/// provider's registration does not name is worse than an honest failure,
/// because the redirect would be refused after the user has already signed in.
fn bind_preferred(ports: &[u16]) -> Result<TcpListener, String> {
    for &port in ports {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) {
            return Ok(listener);
        }
    }
    let names = ports
        .iter()
        .map(u16::to_string)
        .collect::<Vec<_>>()
        .join(", ");
    Err(format!("ports {names} are all in use"))
}

#[tauri::command]
pub async fn oauth_wait(
    port: u16,
    timeout_ms: u64,
    state: State<'_, OauthListeners>,
) -> Result<String, String> {
    let listener = state
        .0
        .lock()
        .map_err(|_| "listener table poisoned")?
        .remove(&port)
        .ok_or("no listener on that port (oauth_listen first)")?;
    tauri::async_runtime::spawn_blocking(move || wait_for_return(listener, timeout_ms))
        .await
        .map_err(|e| format!("join failed: {e}"))?
}

/// Accept until a request with a query string arrives or the deadline passes.
fn wait_for_return(listener: TcpListener, timeout_ms: u64) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms.clamp(1_000, 600_000));
    loop {
        if Instant::now() >= deadline {
            return Err("sign-in timed out".into());
        }
        match listener.accept() {
            Ok((stream, _)) => {
                if let Some(query) = answer(stream) {
                    return Ok(query);
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("accept failed: {e}")),
        }
    }
}

/// Serve one connection. Returns the query string when the request carried
/// one; anything query-less (favicon and friends) gets a 404 so the browser
/// stops asking, and the wait continues.
fn answer(stream: TcpStream) -> Option<String> {
    stream
        .set_read_timeout(Some(Duration::from_millis(2_000)))
        .ok()?;
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    // "GET /oauth-return?code=…&state=… HTTP/1.1"
    let path = request_line.split_whitespace().nth(1)?;
    let query = path.split_once('?').map(|(_, q)| q.to_string());
    let mut stream = reader.into_inner();
    let body = if query.is_some() { RETURN_PAGE } else { "" };
    let status = if query.is_some() { "200 OK" } else { "404 Not Found" };
    let _ = stream.write_all(
        format!(
            "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .as_bytes(),
    );
    query
}

#[cfg(test)]
mod tests {
    use super::authorize_url;

    #[test]
    fn authorization_urls_are_https_without_embedded_credentials() {
        assert!(authorize_url("https://accounts.example.test/oauth?state=abc").is_ok());
        assert!(authorize_url("http://accounts.example.test/oauth").is_err());
        assert!(authorize_url("file:///tmp/secret").is_err());
        assert!(authorize_url("https://user:password@accounts.example.test/oauth").is_err());
        assert!(authorize_url("not a url").is_err());
    }
}
