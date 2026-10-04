// SPDX-License-Identifier: MPL-2.0
//! The live agent listener (plans/289 D1).
//!
//! With **Allow AI control** on, an AI agent on this computer (through Lolly's local
//! MCP server) can work in the Design document open in the app, while the person
//! watches. This module is the transport only: every request is handed to the page,
//! whose `live-v1` session (shells/web/src/lib/live-agent.ts) decides what is allowed
//! and makes each edit one ordinary, undoable history step.
//!
//! ADDRESS AND TOKEN. As render_server.rs: `127.0.0.1:0`, a fresh token, and an
//! advert, `live.json` (port, token, pid, version), mode 0600 on unix, in the app
//! data directory. The file exists only while the listener does; turning the setting
//! off or quitting removes it. A non-loopback peer is refused before a byte is read.
//!
//! PROTOCOL. One length-prefixed frame in, `{ "token": "...", "request": <live-v1
//! request> }`, one frame out, the page's JSON-RPC reply, then the connection
//! closes. A wrong token, a frame that is not JSON, or no Design document to answer
//! gets a JSON-RPC error without reaching the page.
//!
//! THE PAGE SIDE. The page long-polls `live_next` while a Design document is open
//! and answers with `live_reply`. When nothing has polled for a few seconds the
//! listener answers at once that no document is open, rather than holding the agent
//! for the whole reply timeout.

use std::collections::{HashMap, VecDeque};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::render_server::{fresh_token, peer_allowed, read_frame, token_matches, write_advert, write_frame};

/// A live-v1 request is at most 4 MB; the token and wrapper add little.
const MAX_FRAME_BYTES: u32 = 4 * 1024 * 1024 + 64 * 1024;
/// How long one request may take in the page (a look renders an export).
const REPLY_TIMEOUT: Duration = Duration::from_secs(60);
/// How long a connection may sit before its frame arrives.
const SOCKET_TIMEOUT: Duration = Duration::from_secs(30);
/// No poll for this long means no Design document is open to answer.
const POLL_GRACE_MS: u64 = 3_000;

/// JSON-RPC error codes, as packages/core/src/live-v1.ts names them.
const ERR_BAD_REQUEST: i64 = -32600;
const ERR_NOT_READY: i64 = -32001;

struct Running {
    port: u16,
    stop: Arc<AtomicBool>,
    advert: PathBuf,
}

static RUNNING: Mutex<Option<Running>> = Mutex::new(None);
static INBOX: Mutex<VecDeque<(u64, String)>> = Mutex::new(VecDeque::new());
static INBOX_READY: Condvar = Condvar::new();
static WAITING: Mutex<Option<HashMap<u64, Sender<String>>>> = Mutex::new(None);
static SEQ: AtomicU64 = AtomicU64::new(0);
static POLLERS: AtomicUsize = AtomicUsize::new(0);
static LAST_POLL_MS: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// A JSON-RPC error reply, for answers the page never sees.
pub fn error_reply(id: &serde_json::Value, code: i64, message: &str) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }))
        .unwrap_or_else(|_| br#"{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"could not encode the reply"}}"#.to_vec())
}

/// Answer one frame: check it, then hand the request to `forward`, which returns the
/// page's reply text or None when the page did not answer. Pure, so the rules are
/// tested without a window.
pub fn answer(frame: &[u8], token: &str, page_present: bool, forward: &mut dyn FnMut(String) -> Option<String>) -> Vec<u8> {
    let value: serde_json::Value = match serde_json::from_slice(frame) {
        Ok(v) => v,
        Err(_) => return error_reply(&serde_json::Value::Null, ERR_BAD_REQUEST, "The frame is not JSON."),
    };
    let given = value.get("token").and_then(|t| t.as_str()).unwrap_or("");
    if !token_matches(token, given) {
        return error_reply(&serde_json::Value::Null, ERR_BAD_REQUEST, "Wrong token. Read live.json again.");
    }
    let Some(request) = value.get("request").filter(|r| r.is_object()) else {
        return error_reply(&serde_json::Value::Null, ERR_BAD_REQUEST, "The frame has no request.");
    };
    let id = request.get("id").cloned().unwrap_or(serde_json::Value::Null);
    if !page_present {
        return error_reply(&id, ERR_NOT_READY, "No Design document is open in Lolly. Ask the person to open one.");
    }
    match forward(request.to_string()) {
        Some(reply) => reply.into_bytes(),
        None => error_reply(&id, ERR_NOT_READY, "Lolly did not answer in time. Check that the Design document is still open."),
    }
}

fn page_present() -> bool {
    POLLERS.load(Ordering::SeqCst) > 0 || now_ms().saturating_sub(LAST_POLL_MS.load(Ordering::SeqCst)) < POLL_GRACE_MS
}

/// Queue a request for the page and wait for its reply.
fn forward_to_page(text: String) -> Option<String> {
    let seq = SEQ.fetch_add(1, Ordering::SeqCst) + 1;
    let (tx, rx) = channel();
    WAITING.lock().ok()?.get_or_insert_with(HashMap::new).insert(seq, tx);
    if let Ok(mut inbox) = INBOX.lock() {
        inbox.push_back((seq, text));
        INBOX_READY.notify_all();
    }
    let reply = rx.recv_timeout(REPLY_TIMEOUT).ok();
    if reply.is_none() {
        if let Ok(mut waiting) = WAITING.lock() {
            waiting.get_or_insert_with(HashMap::new).remove(&seq);
        }
        if let Ok(mut inbox) = INBOX.lock() {
            inbox.retain(|(s, _)| *s != seq);
        }
    }
    reply
}

fn handle_connection(mut stream: TcpStream, token: &str) {
    let _ = stream.set_read_timeout(Some(SOCKET_TIMEOUT));
    let _ = stream.set_write_timeout(Some(REPLY_TIMEOUT));
    let reply = match read_frame(&mut stream, MAX_FRAME_BYTES) {
        Ok(frame) => answer(&frame, token, page_present(), &mut forward_to_page),
        Err(e) => error_reply(&serde_json::Value::Null, ERR_BAD_REQUEST, &e),
    };
    let _ = write_frame(&mut stream, &reply);
}

fn serve(listener: TcpListener, token: String, stop: Arc<AtomicBool>) {
    for incoming in listener.incoming() {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        let Ok(stream) = incoming else { continue };
        let allowed = stream.peer_addr().map(|a| peer_allowed(a.ip())).unwrap_or(false);
        if !allowed {
            let _ = stream.shutdown(std::net::Shutdown::Both);
            continue;
        }
        let token = token.clone();
        // One thread per connection, so a slow look does not hold up the next request.
        std::thread::spawn(move || handle_connection(stream, &token));
    }
}

fn advert_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("no app data directory: {e}"))?;
    Ok(dir.join("live.json"))
}

fn stop_running() {
    let Some(running) = RUNNING.lock().ok().and_then(|mut r| r.take()) else { return };
    running.stop.store(true, Ordering::SeqCst);
    let _ = std::fs::remove_file(&running.advert);
    // Wake the blocking accept so the loop sees the stop flag and drops the listener.
    let _ = TcpStream::connect(("127.0.0.1", running.port));
}

/// Remove the advert on exit, so a quit app never leaves an address behind.
pub fn shutdown() {
    stop_running();
}

// ── the three commands the page calls ────────────────────────────────────────

/// Turn the listener on or off. Returns the port while on.
#[tauri::command]
pub fn live_set(app: AppHandle, on: bool) -> Result<Option<u16>, String> {
    if !on {
        stop_running();
        return Ok(None);
    }
    let mut running = RUNNING.lock().map_err(|_| "the live listener state is poisoned".to_string())?;
    if let Some(r) = running.as_ref() {
        return Ok(Some(r.port));
    }
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("could not listen on loopback: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let token = fresh_token();
    let advert = advert_path(&app)?;
    write_advert(&advert, port, &token, &app.package_info().version.to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = stop.clone();
    std::thread::spawn(move || serve(listener, token, thread_stop));
    *running = Some(Running { port, stop, advert });
    Ok(Some(port))
}

#[derive(serde::Serialize)]
pub struct LiveRequest {
    seq: u64,
    text: String,
}

/// The next request for the page, waiting up to `timeout_ms` (at most 25 s) for one.
#[tauri::command]
pub async fn live_next(timeout_ms: u64) -> Option<LiveRequest> {
    let wait = Duration::from_millis(timeout_ms.min(25_000));
    tauri::async_runtime::spawn_blocking(move || {
        POLLERS.fetch_add(1, Ordering::SeqCst);
        LAST_POLL_MS.store(now_ms(), Ordering::SeqCst);
        let next = INBOX.lock().ok().and_then(|inbox| {
            let (mut inbox, _) = INBOX_READY.wait_timeout_while(inbox, wait, |q| q.is_empty()).ok()?;
            inbox.pop_front()
        });
        LAST_POLL_MS.store(now_ms(), Ordering::SeqCst);
        POLLERS.fetch_sub(1, Ordering::SeqCst);
        next.map(|(seq, text)| LiveRequest { seq, text })
    })
    .await
    .ok()
    .flatten()
}

/// The page's reply to request `seq`.
#[tauri::command]
pub fn live_reply(seq: u64, text: String) {
    let sender = WAITING.lock().ok().and_then(|mut w| w.get_or_insert_with(HashMap::new).remove(&seq));
    if let Some(sender) = sender {
        let _ = sender.send(text);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(token: &str, request: serde_json::Value) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({ "token": token, "request": request })).unwrap()
    }
    fn parse(reply: &[u8]) -> serde_json::Value {
        serde_json::from_slice(reply).unwrap()
    }
    fn hello() -> serde_json::Value {
        serde_json::json!({ "jsonrpc": "2.0", "id": 7, "method": "hello" })
    }

    #[test]
    fn a_wrong_token_never_reaches_the_page() {
        let mut reached = false;
        let reply = parse(&answer(&frame("nope", hello()), "secret", true, &mut |_| { reached = true; Some("{}".into()) }));
        assert!(!reached);
        assert_eq!(reply["error"]["code"], ERR_BAD_REQUEST);
    }

    #[test]
    fn the_request_goes_to_the_page_and_its_reply_comes_back_as_is() {
        let mut seen = String::new();
        let reply = answer(&frame("secret", hello()), "secret", true, &mut |text| { seen = text; Some(r#"{"jsonrpc":"2.0","id":7,"result":{}}"#.into()) });
        assert!(seen.contains("\"method\":\"hello\""));
        assert_eq!(parse(&reply)["id"], 7);
    }

    #[test]
    fn with_no_document_open_the_agent_hears_so_at_once() {
        let reply = parse(&answer(&frame("secret", hello()), "secret", false, &mut |_| panic!("not forwarded")));
        assert_eq!(reply["error"]["code"], ERR_NOT_READY);
        assert_eq!(reply["id"], 7);
    }

    #[test]
    fn junk_and_missing_requests_are_refused() {
        assert_eq!(parse(&answer(b"not json", "secret", true, &mut |_| None))["error"]["code"], ERR_BAD_REQUEST);
        let no_request = serde_json::to_vec(&serde_json::json!({ "token": "secret" })).unwrap();
        assert_eq!(parse(&answer(&no_request, "secret", true, &mut |_| None))["error"]["code"], ERR_BAD_REQUEST);
        let timed_out = parse(&answer(&frame("secret", hello()), "secret", true, &mut |_| None));
        assert_eq!(timed_out["error"]["code"], ERR_NOT_READY);
    }
}
