// SPDX-License-Identifier: MPL-2.0
//! The render endpoint (plans/202 WP2.1).
//!
//! `Lolly --render-server` starts the desktop app with no visible window and one
//! loopback TCP listener. A caller sends a job, the app renders it through the
//! SAME off-screen WebView path `Lolly run <tool>` uses (cli.rs owns the window
//! builder and the init script; this module calls it), and the finished bytes go
//! back on the same connection.
//!
//! Why a server and not one process per render: the Node shells' full-fidelity
//! tier used to mean a Chromium download plus `npm run build:web`. A person who
//! already installed the app has both, in one place. A running endpoint lets
//! `lolly`, `lolly tui` and the MCP service reach it by address instead of by
//! guessing at an install layout, and the app stays warm between jobs.
//!
//! ADDRESS AND TOKEN. The listener binds `127.0.0.1:0`, so the operating system
//! picks a free port and no other machine can reach it. Port, a per-launch token,
//! the process id and the app version are written to `render.json` in the app's
//! data directory (`packages/node-shell/src/state-dir.ts` derives the same path in
//! Node), mode 0600 on unix, and the file is removed when the process exits. Every
//! request carries the token; a wrong one is refused and the connection closed.
//! A non-loopback peer is refused before its bytes are read.
//!
//! PROTOCOL. `u32` big-endian length, then that many bytes of JSON. One request
//! frame in, one reply frame out, then the connection closes. The house pattern
//! from native_transport.rs, without the Noise layer: this socket never leaves the
//! machine and the token is the whole of its authentication. No new crate.
//!
//! ONE JOB AT A TIME. The accept loop is a single thread and finishes each
//! connection before taking the next, so exactly one off-screen window exists at
//! any moment. A second caller waits rather than racing for the window label.

use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

/// Largest request frame we will read. A job is a URL and a handful of short
/// strings; anything past this is a mistake or hostile, and it is refused before
/// a single byte is allocated for it.
const MAX_REQUEST_BYTES: u32 = 1 << 20;

/// How long a connection may sit idle mid-request before we drop it. Short: the
/// client writes its one frame immediately or it is not a client.
const SOCKET_TIMEOUT: Duration = Duration::from_secs(30);

/// How long the server stays up with nothing to do. A caller that launched it for
/// one render should not leave a process behind for the rest of the session.
/// `LOLLY_RENDER_IDLE=<seconds>` overrides it; `0` means never exit on idle.
fn idle_secs() -> u64 {
    std::env::var("LOLLY_RENDER_IDLE")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(900)
}

/// The advert file, remembered so both the ordinary exit and the idle exit can
/// remove it. Set once, in `setup`.
static ADVERT: OnceLock<PathBuf> = OnceLock::new();

/// Milliseconds since the epoch at the last accepted connection. The idle watchdog
/// reads it; the accept loop writes it.
static LAST_ACTIVITY: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// ── the active job ───────────────────────────────────────────────────────────

/// What a finished render produced.
pub enum Outcome {
    /// No `outPath` was given, so the bytes travel in the reply.
    Bytes { bytes: Vec<u8>, filename: Option<String> },
    /// An `outPath` was given and the bytes were written there.
    Wrote { path: String, size: usize },
    /// The render failed. The sentence is the caller's whole explanation.
    Failed(String),
}

struct ActiveJob {
    /// Where `cli_write` should put the bytes, when the caller named a path.
    output: Option<String>,
    bytes: Option<Vec<u8>>,
    filename: Option<String>,
    written: Option<(String, usize)>,
    tx: Sender<Outcome>,
    /// True once an outcome has been sent, so a late second `cli_done` is dropped.
    finished: bool,
}

/// The one render slot, held as Tauri managed state. `None` means idle.
#[derive(Default)]
pub struct RenderSlot {
    active: Mutex<Option<ActiveJob>>,
}

/// Deliver an outcome for the active job, exactly once.
fn finish(slot: &RenderSlot, outcome: Outcome) {
    let Ok(mut guard) = slot.active.lock() else { return };
    let Some(job) = guard.as_mut() else { return };
    if job.finished {
        return;
    }
    job.finished = true;
    // The receiver may already have timed out and gone; that is not an error here.
    let _ = job.tx.send(outcome);
}

// ── the four commands the web shell's export override calls ──────────────────
//
// Same names as cli.rs's, because the page side (bridge-overrides/export.ts) sees
// `window.__LOLLY_CLI__` and invokes `cli_write` / `cli_done` / `cli_fail` /
// `cli_log` by name. The difference is what they do with the result: cli.rs exits
// the process, and these hand the outcome to the waiting connection so the server
// can take the next job.

/// Receive the finished export bytes. With an `outPath` they are written straight
/// there; without one they are held for the reply frame.
#[tauri::command]
fn cli_write(slot: tauri::State<'_, RenderSlot>, bytes: Vec<u8>, filename: Option<String>) -> Result<(), String> {
    let mut guard = slot.active.lock().map_err(|_| "render slot unavailable".to_string())?;
    let Some(job) = guard.as_mut() else {
        return Err("no render job is active".into());
    };
    match job.output.clone() {
        Some(path) => {
            let n = bytes.len();
            std::fs::write(&path, &bytes).map_err(|e| format!("could not write {path}: {e}"))?;
            job.written = Some((path, n));
        }
        None => {
            job.filename = filename;
            job.bytes = Some(bytes);
        }
    }
    Ok(())
}

/// The render finished. Turn whatever `cli_write` left behind into an outcome.
#[tauri::command]
fn cli_done(slot: tauri::State<'_, RenderSlot>) {
    let outcome = {
        let Ok(mut guard) = slot.active.lock() else { return };
        let Some(job) = guard.as_mut() else { return };
        match (job.written.take(), job.bytes.take()) {
            (Some((path, size)), _) => Outcome::Wrote { path, size },
            (None, Some(bytes)) => Outcome::Bytes { bytes, filename: job.filename.take() },
            (None, None) => Outcome::Failed("the render finished without producing any bytes".into()),
        }
    };
    finish(&slot, outcome);
}

/// The render failed. The page's own sentence is what the caller reads.
#[tauri::command]
fn cli_fail(slot: tauri::State<'_, RenderSlot>, message: String) {
    finish(&slot, Outcome::Failed(message));
}

/// Page-side diagnostics go to this process's stderr, as they do in `Lolly run`.
#[tauri::command]
fn cli_log(level: String, msg: String) {
    eprintln!("lolly[{level}]: {msg}");
}

// ── frames ───────────────────────────────────────────────────────────────────

/// Read one length-prefixed frame. The length is checked against `max` BEFORE the
/// buffer is allocated, so a hostile header cannot ask for a gigabyte.
pub fn read_frame(stream: &mut impl Read, max: u32) -> Result<Vec<u8>, String> {
    let mut header = [0u8; 4];
    stream.read_exact(&mut header).map_err(|e| format!("could not read the frame length: {e}"))?;
    let len = u32::from_be_bytes(header);
    if len == 0 {
        return Err("an empty frame is not a request".into());
    }
    if len > max {
        return Err(format!("frame of {len} bytes is over the {max}-byte limit"));
    }
    let mut body = vec![0u8; len as usize];
    stream.read_exact(&mut body).map_err(|e| format!("could not read the frame body: {e}"))?;
    Ok(body)
}

/// Write one length-prefixed frame.
pub fn write_frame(stream: &mut impl Write, payload: &[u8]) -> Result<(), String> {
    let len = u32::try_from(payload.len()).map_err(|_| "reply is too large to frame".to_string())?;
    stream.write_all(&len.to_be_bytes()).map_err(|e| format!("could not write the frame length: {e}"))?;
    stream.write_all(payload).map_err(|e| format!("could not write the frame body: {e}"))?;
    stream.flush().map_err(|e| format!("could not flush the frame: {e}"))?;
    Ok(())
}

// ── token and peer ───────────────────────────────────────────────────────────

/// A fresh per-launch token: 32 hex characters from the operating system's random
/// source. It lives only in the advert file and in memory, and dies with the process.
fn fresh_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Compare in constant time for the given length, so a wrong token tells the caller
/// nothing about how much of it was right.
pub fn token_matches(expected: &str, given: &str) -> bool {
    let a = expected.as_bytes();
    let b = given.as_bytes();
    if a.is_empty() || a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for i in 0..a.len() {
        diff |= a[i] ^ b[i];
    }
    diff == 0
}

/// May this peer talk to the render endpoint? Loopback only. The bind is already
/// `127.0.0.1`, so this is the second lock on the same door: a future bind change
/// cannot quietly open the endpoint to the network without this check failing too.
pub fn peer_allowed(ip: IpAddr) -> bool {
    ip.is_loopback()
}

// ── base64 ───────────────────────────────────────────────────────────────────

/// Standard base64 with padding, for the bytes carried inside a JSON reply. Written
/// out here rather than adding a crate: the whole alphabet is 64 characters and the
/// Node side decodes it with `Buffer.from(value, 'base64')`.
pub fn base64(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(ALPHABET[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { ALPHABET[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { ALPHABET[n as usize & 63] as char } else { '=' });
    }
    out
}

// ── the request ──────────────────────────────────────────────────────────────

/// One job, as it arrives on the wire.
#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Request {
    pub token: String,
    /// `render` (the default) or `ping`.
    pub op: Option<String>,
    /// A full tool link. Everything cli.rs's own argument parser accepts.
    pub tool_url: Option<String>,
    /// The other spelling: a bare tool id plus a URL-mode query.
    pub tool_id: Option<String>,
    pub query: Option<String>,
    /// Export format (png, svg, pdf, mp4, …). Absent means the tool's first.
    pub format: Option<String>,
    /// Extra inputs and reserved export params (width, height, unit, dpi, bleed,
    /// marks, imprint, durable, c2pa, …) as plain, unencoded values. They override
    /// anything the query already carried, which is the CLI's own last-wins rule.
    pub params: Option<std::collections::BTreeMap<String, String>>,
    /// Write the bytes here instead of returning them in the reply.
    pub out_path: Option<String>,
}

/// Is this a parameter name we are willing to spell as a `--flag`? Letters, digits
/// and the three separators the URL contract already uses. A name outside that set
/// could smuggle a second flag into the argument list.
fn safe_param_key(key: &str) -> bool {
    !key.is_empty()
        && key.chars().next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

/// Turn a request into the argument list `cli::classify` reads.
///
/// The point of going through argv is that there is then exactly ONE parser for a
/// tool link in this binary. `Lolly run <link> --format=png` and a render job with
/// the same link produce the same `CliJob`, so the URL contract cannot mean two
/// things depending on which door the caller used.
pub fn job_argv(req: &Request) -> Result<Vec<String>, String> {
    let spec = match (req.tool_url.as_deref(), req.tool_id.as_deref()) {
        (Some(url), _) if !url.trim().is_empty() => url.trim().to_string(),
        (_, Some(id)) if !id.trim().is_empty() => match req.query.as_deref().map(str::trim) {
            Some(q) if !q.is_empty() => format!("{}?{}", id.trim(), q.trim_start_matches('?')),
            _ => id.trim().to_string(),
        },
        _ => return Err("a render job needs toolUrl, or toolId with an optional query".into()),
    };

    let mut argv = vec!["run".to_string(), spec];
    for (key, value) in req.params.iter().flatten() {
        if !safe_param_key(key) {
            return Err(format!("\"{key}\" is not a usable parameter name"));
        }
        argv.push(format!("--{key}={value}"));
    }
    if let Some(format) = req.format.as_deref().map(str::trim).filter(|f| !f.is_empty()) {
        argv.push(format!("--format={format}"));
    }
    if let Some(out) = req.out_path.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        if out == "-" {
            return Err("a render job cannot write to stdout; leave outPath out to get the bytes back".into());
        }
        argv.push(format!("--output={out}"));
    }
    Ok(argv)
}

/// Answer one request. Pure apart from the renderer it is handed, so a test can
/// drive the whole frame protocol over a real socket with no Tauri app in the way.
pub fn answer(
    frame: &[u8],
    token: &str,
    version: &str,
    render: &mut dyn FnMut(crate::cli::CliJob) -> Outcome,
) -> Vec<u8> {
    let request: Request = match serde_json::from_slice(frame) {
        Ok(r) => r,
        Err(e) => return error_reply(&format!("could not read the request: {e}")),
    };
    if !token_matches(token, &request.token) {
        return error_reply("wrong or missing token");
    }
    if request.op.as_deref().unwrap_or("render") == "ping" {
        return json_reply(&serde_json::json!({
            "ok": true, "pong": true, "version": version, "pid": std::process::id(),
        }));
    }
    let argv = match job_argv(&request) {
        Ok(a) => a,
        Err(e) => return error_reply(&e),
    };
    let job = match crate::cli::classify(&argv) {
        crate::cli::Mode::Cli(job) => job,
        crate::cli::Mode::UsageError(m) => return error_reply(&m),
        _ => return error_reply("that job does not name a tool to render"),
    };
    if job.stdout {
        return error_reply("a render job cannot write to stdout");
    }
    match render(job) {
        Outcome::Bytes { bytes, filename } => json_reply(&serde_json::json!({
            "ok": true, "size": bytes.len(), "filename": filename, "bytes": base64(&bytes),
        })),
        Outcome::Wrote { path, size } => json_reply(&serde_json::json!({
            "ok": true, "size": size, "path": path,
        })),
        Outcome::Failed(message) => error_reply(&message),
    }
}

fn json_reply(value: &serde_json::Value) -> Vec<u8> {
    serde_json::to_vec(value).unwrap_or_else(|_| br#"{"ok":false,"error":"could not encode the reply"}"#.to_vec())
}

fn error_reply(message: &str) -> Vec<u8> {
    json_reply(&serde_json::json!({ "ok": false, "error": message }))
}

// ── the advert file ──────────────────────────────────────────────────────────

/// `render.json` in the app's data directory. The Node side derives the same path
/// from the bundle identifier (packages/node-shell/src/state-dir.ts).
fn advert_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("no app data directory: {e}"))?;
    Ok(dir.join("render.json"))
}

/// What a caller needs to reach this server, and enough to tell a live advert from
/// one a crashed process left behind.
pub fn advert_json(port: u16, token: &str, version: &str) -> serde_json::Value {
    serde_json::json!({
        "port": port,
        "token": token,
        "pid": std::process::id(),
        "version": version,
    })
}

fn write_advert(path: &std::path::Path, port: u16, token: &str, version: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("could not create {}: {e}", parent.display()))?;
    }
    let body = serde_json::to_vec_pretty(&advert_json(port, token, version))
        .map_err(|e| format!("could not encode {}: {e}", path.display()))?;
    std::fs::write(path, body).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    // The token is a credential for this machine's own renderer. Nobody else's
    // account needs to read it.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Remove the advert. Called on the ordinary exit and on the idle exit, so a dead
/// server never leaves an address behind for a caller to time out against.
fn clear_advert() {
    if let Some(path) = ADVERT.get() {
        let _ = std::fs::remove_file(path);
    }
}

// ── running a job ────────────────────────────────────────────────────────────

fn run_job(app: &AppHandle, job: crate::cli::CliJob) -> Outcome {
    let (tx, rx) = channel::<Outcome>();
    {
        let slot = app.state::<RenderSlot>();
        let Ok(mut guard) = slot.active.lock() else {
            return Outcome::Failed("the render slot is unavailable".into());
        };
        if guard.is_some() {
            return Outcome::Failed("another render is already running".into());
        }
        *guard = Some(ActiveJob {
            output: job.output.clone(),
            bytes: None,
            filename: None,
            written: None,
            tx,
            finished: false,
        });
    }

    // Window creation belongs to the main thread on macOS and Windows, and this is
    // the accept thread. `run_on_main_thread` queues it there.
    let opened = {
        let handle = app.clone();
        let job = job.clone();
        app.run_on_main_thread(move || {
            if let Err(e) = crate::cli::build_offscreen_window(&handle, &job) {
                finish(&handle.state::<RenderSlot>(), Outcome::Failed(format!("could not open the render window: {e}")));
            }
        })
    };
    if let Err(e) = opened {
        clear_slot(app);
        return Outcome::Failed(format!("could not reach the main thread: {e}"));
    }

    let budget = crate::cli::watchdog_secs();
    let outcome = rx.recv_timeout(Duration::from_secs(budget)).unwrap_or_else(|_| {
        Outcome::Failed(format!(
            "the render did not finish within {budget}s. Set LOLLY_RENDER_IDLE aside and raise LOLLY_CLI_TIMEOUT to give it longer."
        ))
    });
    close_render_window(app);
    clear_slot(app);
    outcome
}

fn clear_slot(app: &AppHandle) {
    if let Ok(mut guard) = app.state::<RenderSlot>().active.lock() {
        *guard = None;
    }
}

/// Destroy the off-screen window and wait for its label to come free, so the next
/// job can build a window under the same label (and therefore the same capability
/// grant). Bounded: a label that never frees fails the NEXT job with a message
/// rather than hanging this one.
fn close_render_window(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(window) = handle.get_webview_window(crate::cli::WINDOW_LABEL) {
            let _ = window.destroy();
        }
    });
    let deadline = Instant::now() + Duration::from_secs(5);
    while app.get_webview_window(crate::cli::WINDOW_LABEL).is_some() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(25));
    }
}

// ── the accept loop ──────────────────────────────────────────────────────────

fn serve(app: AppHandle, listener: TcpListener, token: String, version: String) {
    for incoming in listener.incoming() {
        let Ok(stream) = incoming else { continue };
        LAST_ACTIVITY.store(now_ms(), Ordering::Relaxed);
        let allowed = stream.peer_addr().map(|a| peer_allowed(a.ip())).unwrap_or(false);
        if !allowed {
            let _ = stream.shutdown(std::net::Shutdown::Both);
            continue;
        }
        handle_connection(&app, stream, &token, &version);
        LAST_ACTIVITY.store(now_ms(), Ordering::Relaxed);
    }
}

fn handle_connection(app: &AppHandle, mut stream: TcpStream, token: &str, version: &str) {
    let _ = stream.set_read_timeout(Some(SOCKET_TIMEOUT));
    let _ = stream.set_write_timeout(Some(SOCKET_TIMEOUT));
    let frame = match read_frame(&mut stream, MAX_REQUEST_BYTES) {
        Ok(f) => f,
        Err(e) => {
            let _ = write_frame(&mut stream, &error_reply(&e));
            return;
        }
    };
    let mut render = |job: crate::cli::CliJob| run_job(app, job);
    let reply = answer(&frame, token, version, &mut render);
    let _ = write_frame(&mut stream, &reply);
}

/// Exit once nothing has used the endpoint for a while, so a caller that launched
/// the app for one render does not leave a process running for the session.
fn start_idle_watchdog() {
    let secs = idle_secs();
    if secs == 0 {
        return;
    }
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(15));
        let idle_ms = now_ms().saturating_sub(LAST_ACTIVITY.load(Ordering::Relaxed));
        if idle_ms >= secs * 1000 {
            eprintln!("lolly: render server idle for {secs}s, exiting");
            clear_advert();
            std::process::exit(0);
        }
    });
}

// ── entry point ──────────────────────────────────────────────────────────────

/// Run the app as a render endpoint. Never returns.
pub fn run(mut context: tauri::Context) {
    // No window is declared, so nothing visible is ever created. Each job builds
    // its own off-screen window and destroys it again.
    context.config_mut().app.windows.clear();
    let version = context.package_info().version.to_string();
    let advert_version = version.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .manage(RenderSlot::default())
        // The url-shot tool calls host.capture mid-render, so the capture commands
        // travel with the render path here for the same reason cli.rs registers them.
        .manage(crate::capture::CaptureSession::default())
        .invoke_handler(tauri::generate_handler![
            crate::capture::capture_page,
            crate::capture::capture_page_pdf,
            cli_write,
            cli_done,
            cli_fail,
            cli_log
        ])
        .setup(move |app| {
            // No dock icon and no menu bar: this launch has no user interface.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            let listener = TcpListener::bind(("127.0.0.1", 0))?;
            let port = listener.local_addr()?.port();
            let token = fresh_token();
            let path = advert_path(&handle).map_err(std::io::Error::other)?;
            write_advert(&path, port, &token, &advert_version).map_err(std::io::Error::other)?;
            let _ = ADVERT.set(path.clone());
            LAST_ACTIVITY.store(now_ms(), Ordering::Relaxed);
            start_idle_watchdog();
            eprintln!("lolly: render server listening on 127.0.0.1:{port} ({})", path.display());
            let served_version = advert_version.clone();
            std::thread::spawn(move || serve(handle, listener, token, served_version));
            Ok(())
        })
        .build(context)
        .expect("error while running Lolly desktop (render server)")
        .run(|_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                clear_advert();
            }
        });
}

// ── the child-process renderer, for the D-Bus entry point ────────────────────

/// Render by running this executable's own CLI mode once, then wait for the file.
///
/// The Linux `org.lolly.Desktop1.Render` method is served from inside the GUI
/// process, whose window already owns the label the off-screen render needs. So
/// that caller gets a separate process rather than an in-process job. It is the
/// same code either way: the child runs `cli::run_cli`.
///
/// Only the Linux D-Bus interface calls it, so on the other platforms it compiles
/// with no caller. Kept unconditional rather than cfg-gated: the logic is portable
/// and a Windows or macOS automation entry point would use it unchanged.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn render_via_child(tool_url: &str, out_path: &str) -> Result<(), String> {
    if tool_url.trim().is_empty() || out_path.trim().is_empty() {
        return Err("a render needs a tool URL and an output path".into());
    }
    if out_path.trim() == "-" {
        return Err("a render cannot write to stdout here".into());
    }
    let executable = std::env::current_exe().map_err(|e| format!("could not resolve the Lolly executable: {e}"))?;
    let mut child = std::process::Command::new(executable)
        .arg(tool_url)
        .arg(format!("--output={out_path}"))
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start the renderer: {e}"))?;

    // `Command::status` cannot be bounded, and a stuck render must not hold the bus
    // handler open for the life of the app. Poll, then kill.
    let deadline = Instant::now() + Duration::from_secs(crate::cli::watchdog_secs() + 15);
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return Ok(()),
            Ok(Some(status)) => return Err(format!("the renderer exited {}", status.code().unwrap_or(1))),
            Ok(None) => {}
            Err(e) => return Err(format!("could not wait for the renderer: {e}")),
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            return Err("the renderer ran out of time".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::net::Ipv4Addr;

    fn request(value: serde_json::Value) -> Vec<u8> {
        serde_json::to_vec(&value).unwrap()
    }

    fn parse(reply: &[u8]) -> serde_json::Value {
        serde_json::from_slice(reply).expect("the reply is JSON")
    }

    /// A renderer that refuses everything, for the paths that must never reach one.
    fn never_renders() -> impl FnMut(crate::cli::CliJob) -> Outcome {
        |_job| panic!("this request must be refused before it reaches the renderer")
    }

    #[test]
    fn frames_round_trip_and_a_long_header_is_refused_before_allocation() {
        let mut buffer: Vec<u8> = Vec::new();
        write_frame(&mut buffer, b"{\"ok\":true}").unwrap();
        assert_eq!(&buffer[..4], &11u32.to_be_bytes());
        let mut cursor = Cursor::new(buffer);
        assert_eq!(read_frame(&mut cursor, MAX_REQUEST_BYTES).unwrap(), b"{\"ok\":true}");

        // A header claiming a gigabyte is refused, and nothing that size is allocated.
        let mut huge = Cursor::new((1u32 << 30).to_be_bytes().to_vec());
        assert!(read_frame(&mut huge, MAX_REQUEST_BYTES).is_err());
        // So is a zero-length frame.
        let mut empty = Cursor::new(0u32.to_be_bytes().to_vec());
        assert!(read_frame(&mut empty, MAX_REQUEST_BYTES).is_err());
    }

    #[test]
    fn a_wrong_token_is_refused_and_never_reaches_the_renderer() {
        let frame = request(serde_json::json!({ "token": "0000", "toolUrl": "qr-code" }));
        let reply = parse(&answer(&frame, "abcd", "1.0.0", &mut never_renders()));
        assert_eq!(reply["ok"], serde_json::json!(false));
        assert_eq!(reply["error"], serde_json::json!("wrong or missing token"));

        // A missing token, an empty one and a prefix of the real one are all refused.
        for given in ["", "abc", "abcde", "ABCD"] {
            let frame = request(serde_json::json!({ "token": given, "toolUrl": "qr-code" }));
            assert_eq!(parse(&answer(&frame, "abcd", "1.0.0", &mut never_renders()))["ok"], serde_json::json!(false));
        }
        assert!(!token_matches("", ""), "an empty server token must never match");
        assert!(token_matches("abcd", "abcd"));
    }

    #[test]
    fn only_loopback_peers_are_allowed() {
        assert!(peer_allowed(IpAddr::V4(Ipv4Addr::LOCALHOST)));
        assert!(peer_allowed("::1".parse().unwrap()));
        assert!(!peer_allowed(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 20))));
        assert!(!peer_allowed(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
        assert!(!peer_allowed(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))));
    }

    #[test]
    fn a_job_becomes_the_same_cli_job_a_command_line_would_produce() {
        let req: Request = serde_json::from_value(serde_json::json!({
            "token": "t",
            "toolUrl": "https://lolly.tools/#/tool/qr-code?url=https%3A%2F%2Fsuse.com&export=1",
            "format": "png",
            "params": { "width": "800", "dpi": "300" },
        }))
        .unwrap();
        let argv = job_argv(&req).unwrap();
        assert_eq!(argv[0], "run");
        assert!(argv.contains(&"--width=800".to_string()));
        assert!(argv.contains(&"--format=png".to_string()));
        match crate::cli::classify(&argv) {
            crate::cli::Mode::Cli(job) => {
                assert_eq!(job.tool_id, "qr-code");
                assert!(job.query.contains("format=png"), "{}", job.query);
                assert!(job.query.contains("width=800"), "{}", job.query);
                assert!(job.query.contains("export=1"), "{}", job.query);
                assert!(job.output.is_none(), "no outPath means the bytes come back in the reply");
            }
            _ => panic!("a tool link must classify as a render"),
        }
    }

    #[test]
    fn the_other_spelling_of_a_job_is_a_tool_id_and_a_query() {
        let req: Request = serde_json::from_value(serde_json::json!({
            "token": "t", "toolId": "qr-code", "query": "url=x&export=1", "outPath": "/tmp/out.svg",
        }))
        .unwrap();
        let argv = job_argv(&req).unwrap();
        assert_eq!(argv, vec!["run", "qr-code?url=x&export=1", "--output=/tmp/out.svg"]);
    }

    #[test]
    fn a_job_with_no_tool_or_a_hostile_parameter_name_is_refused() {
        let empty: Request = serde_json::from_value(serde_json::json!({ "token": "t" })).unwrap();
        assert!(job_argv(&empty).is_err());

        let smuggled: Request = serde_json::from_value(serde_json::json!({
            "token": "t", "toolId": "qr-code", "params": { "url=x --output": "/etc/passwd" },
        }))
        .unwrap();
        assert!(job_argv(&smuggled).is_err(), "a flag cannot be hidden inside a parameter name");

        let stdout: Request = serde_json::from_value(serde_json::json!({
            "token": "t", "toolId": "qr-code", "outPath": "-",
        }))
        .unwrap();
        assert!(job_argv(&stdout).is_err(), "the reply is the only channel here");
    }

    #[test]
    fn ping_answers_without_rendering() {
        let frame = request(serde_json::json!({ "token": "abcd", "op": "ping" }));
        let reply = parse(&answer(&frame, "abcd", "9.9.9", &mut never_renders()));
        assert_eq!(reply["ok"], serde_json::json!(true));
        assert_eq!(reply["pong"], serde_json::json!(true));
        assert_eq!(reply["version"], serde_json::json!("9.9.9"));
    }

    #[test]
    fn base64_matches_the_standard_vectors() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foob"), "Zm9vYg==");
        assert_eq!(base64(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64(&[0u8, 255, 128]), "AP+A");
    }

    #[test]
    fn the_advert_names_the_port_token_process_and_version() {
        let advert = advert_json(51234, "deadbeef", "1.0.6");
        assert_eq!(advert["port"], serde_json::json!(51234));
        assert_eq!(advert["token"], serde_json::json!("deadbeef"));
        assert_eq!(advert["version"], serde_json::json!("1.0.6"));
        assert_eq!(advert["pid"], serde_json::json!(std::process::id()));
    }

    /// The whole protocol over a real loopback socket: a framed request in, a framed
    /// reply out, the bytes base64 in the reply, and a bad token refused on the same
    /// listener. Nothing here builds a Tauri app; the renderer is a closure.
    #[test]
    fn the_frame_protocol_works_over_a_real_localhost_socket() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            for _ in 0..3 {
                let (mut stream, peer) = listener.accept().unwrap();
                if !peer_allowed(peer.ip()) {
                    let _ = stream.shutdown(std::net::Shutdown::Both);
                    continue;
                }
                let frame = read_frame(&mut stream, MAX_REQUEST_BYTES).unwrap();
                let mut render = |job: crate::cli::CliJob| Outcome::Bytes {
                    bytes: format!("rendered {}", job.tool_id).into_bytes(),
                    filename: Some(format!("{}.svg", job.tool_id)),
                };
                let reply = answer(&frame, "s3cret", "1.0.6", &mut render);
                write_frame(&mut stream, &reply).unwrap();
            }
        });

        let call = |body: serde_json::Value| -> serde_json::Value {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
            write_frame(&mut stream, &serde_json::to_vec(&body).unwrap()).unwrap();
            parse(&read_frame(&mut stream, 8 * 1024 * 1024).unwrap())
        };

        let pong = call(serde_json::json!({ "token": "s3cret", "op": "ping" }));
        assert_eq!(pong["pong"], serde_json::json!(true));

        let rendered = call(serde_json::json!({
            "token": "s3cret", "toolId": "qr-code", "query": "url=x", "format": "svg",
        }));
        assert_eq!(rendered["ok"], serde_json::json!(true));
        assert_eq!(rendered["bytes"], serde_json::json!(base64(b"rendered qr-code")));
        assert_eq!(rendered["filename"], serde_json::json!("qr-code.svg"));

        let refused = call(serde_json::json!({ "token": "guess", "toolId": "qr-code" }));
        assert_eq!(refused["ok"], serde_json::json!(false));

        server.join().unwrap();
    }
}
