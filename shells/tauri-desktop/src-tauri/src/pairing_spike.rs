// SPDX-License-Identifier: MPL-2.0
//! SPIKE, plan 324 section 8: pairing the app with a home server by QR code.
//! NOT SHIPPED. This module is compiled only with `--features pairing-spike`;
//! a release or ordinary dev build contains none of it (lib.rs gates every use).
//!
//! The question it answers: can every request the web shell makes to a home
//! server that holds its OWN self-signed certificate go through a native client
//! that trusts exactly that one certificate, so the webview's loader, which does
//! not know the certificate, never talks to the server at all?
//!
//! Three pieces:
//!   1. A reqwest client whose rustls verifier accepts one end-entity
//!      certificate, identified by its SHA-256 fingerprint; no other is accepted. It
//!      still checks the handshake signature against that certificate's key, so
//!      presenting the (public) certificate without its private key fails. Plain
//!      http is refused at every entry point and on every redirect.
//!   2. The `lolly-instance` URI scheme. The webview loads
//!      `lolly-instance://localhost/<path>` (macOS, iOS, Linux) or
//!      `http://lolly-instance.localhost/<path>` (Windows, Android) for anything
//!      on the paired origin: fetch, <img>, CSS url(), fonts, media. The handler
//!      forwards the request through the pinned client, attaches the paired
//!      session cookie (the webview never holds it), follows redirects only
//!      within the paired origin and answers with the bytes.
//!   3. A WebSocket bridge: tungstenite over a rustls stream with the same
//!      verifier, with frames carried to the page over a Tauri channel.
//!
//! What this deliberately does not do: widen trust for any other host, accept
//! any certificate but the paired one, or fall back to plain http.

use std::collections::HashMap;
use std::io::ErrorKind;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, LazyLock, Mutex, RwLock};
use std::time::{Duration, Instant};

use reqwest::{redirect::Policy, Client, Method, Url};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::WebPkiSupportedAlgorithms;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{CertificateError, DigitallySignedStruct, SignatureScheme};
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{http, Runtime, UriSchemeContext, UriSchemeResponder};

/// The scheme name. Windows and Android see it as `http://lolly-instance.localhost`.
pub const SCHEME: &str = "lolly-instance";

const MAX_RESPONSE_BYTES: usize = 256 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;
const TIMEOUT: Duration = Duration::from_secs(60);

// ── The pinned verifier ─────────────────────────────────────────────────────

/// Accepts exactly one end-entity certificate. Hostname, issuer and validity
/// dates are not consulted: the fingerprint IS the identity, which is the point
/// of pairing a self-signed appliance. The handshake signature IS checked, with
/// the provider's own algorithms, so the private key must be present.
#[derive(Debug)]
pub struct PinnedVerifier {
    fingerprint: [u8; 32],
    algorithms: WebPkiSupportedAlgorithms,
}

impl PinnedVerifier {
    pub fn new(fingerprint: [u8; 32]) -> Self {
        Self { fingerprint, algorithms: rustls::crypto::ring::default_provider().signature_verification_algorithms }
    }
}

pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    let digest = ring::digest::digest(&ring::digest::SHA256, bytes);
    let mut out = [0u8; 32];
    out.copy_from_slice(digest.as_ref());
    out
}

fn same_32(a: &[u8; 32], b: &[u8; 32]) -> bool {
    // A fingerprint is not a secret, but there is no cost to comparing in full.
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

impl ServerCertVerifier for PinnedVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        if same_32(&sha256(end_entity.as_ref()), &self.fingerprint) {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure))
        }
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.algorithms)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.algorithms.supported_schemes()
    }
}

fn tls_config(fingerprint: [u8; 32], alpn: &[&[u8]]) -> Result<rustls::ClientConfig, String> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let mut config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|_| "TLS configuration failed.".to_string())?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(PinnedVerifier::new(fingerprint)))
        .with_no_client_auth();
    config.alpn_protocols = alpn.iter().map(|p| p.to_vec()).collect();
    Ok(config)
}

pub fn pinned_client(fingerprint: [u8; 32]) -> Result<Client, String> {
    Client::builder()
        .use_preconfigured_tls(tls_config(fingerprint, &[b"h2", b"http/1.1"])?)
        .https_only(true)
        .redirect(Policy::none())
        .no_proxy()
        .timeout(TIMEOUT)
        .user_agent("Lolly/1.0 pairing-spike (+https://lolly.tools)")
        .build()
        .map_err(|_| "The pinned HTTPS client could not be created.".to_string())
}

// ── Pairing input ───────────────────────────────────────────────────────────

/// `https://host[:port]` with nothing else: no path, query, fragment or userinfo.
pub fn parse_origin(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "The paired address is invalid.".to_string())?;
    if url.scheme() != "https" {
        return Err("A paired server must use https.".into());
    }
    if url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
        return Err("The paired address must be a plain https origin.".into());
    }
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return Err("The paired address must be an origin, without a path.".into());
    }
    Ok(url)
}

/// 64 hex digits (colons and spaces allowed, any case), `sha256:<hex>`, or the
/// 43-character unpadded base64url form a QR code carries.
pub fn parse_fingerprint(raw: &str) -> Result<[u8; 32], String> {
    let raw = raw.trim();
    let raw = raw.strip_prefix("sha256:").or_else(|| raw.strip_prefix("sha256/")).unwrap_or(raw);
    let hex: String = raw.chars().filter(|c| *c != ':' && !c.is_whitespace()).collect();
    if hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        let mut out = [0u8; 32];
        for (i, byte) in out.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).map_err(|_| "bad fingerprint".to_string())?;
        }
        return Ok(out);
    }
    if raw.len() == 43 {
        use base64::Engine as _;
        if let Ok(bytes) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(raw) {
            if let Ok(out) = <[u8; 32]>::try_from(bytes.as_slice()) {
                return Ok(out);
            }
        }
    }
    Err("The certificate fingerprint must be a SHA-256 digest.".into())
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// `lolly://pair?v=1&u=<https origin>&fp=<base64url sha256>&kid=<catalogue keyId>`,
/// the payload the appliance's QR code carries (proposed in the spike write-up).
pub struct PairingLink {
    pub origin: Url,
    pub fingerprint: [u8; 32],
    pub key_id: Option<String>,
}

pub fn parse_pairing_link(raw: &str) -> Result<PairingLink, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "The pairing code is not a link.".to_string())?;
    if url.scheme() != "lolly" || url.host_str() != Some("pair") {
        return Err("The pairing code is not a Lolly pairing link.".into());
    }
    let mut version = None;
    let mut origin = None;
    let mut fingerprint = None;
    let mut key_id = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "v" => version = Some(value.into_owned()),
            "u" => origin = Some(parse_origin(&value)?),
            "fp" => fingerprint = Some(parse_fingerprint(&value)?),
            "kid" => {
                if value.is_empty() || value.len() > 64 || !value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
                    return Err("The pairing code carries an invalid catalogue key id.".into());
                }
                key_id = Some(value.into_owned());
            }
            _ => {}
        }
    }
    if version.as_deref() != Some("1") {
        return Err("This pairing code needs a newer Lolly.".into());
    }
    Ok(PairingLink {
        origin: origin.ok_or("The pairing code has no address.")?,
        fingerprint: fingerprint.ok_or("The pairing code has no certificate fingerprint.")?,
        key_id,
    })
}

// ── Paired state ────────────────────────────────────────────────────────────

pub struct Paired {
    origin: Url,
    fingerprint: [u8; 32],
    key_id: Option<String>,
    client: Client,
    /// `lw_session=<value>`: the one cookie the paired origin issues. Held here,
    /// never in the webview, and attached only to requests to the paired origin.
    session: Mutex<Option<String>>,
}

static PAIRED: LazyLock<RwLock<Option<Arc<Paired>>>> = LazyLock::new(|| RwLock::new(None));

fn current() -> Option<Arc<Paired>> {
    PAIRED.read().ok().and_then(|g| g.clone())
}

fn origin_string(url: &Url) -> String {
    url.origin().ascii_serialization()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairState {
    origin: String,
    fingerprint: String,
    key_id: Option<String>,
    signed_in: bool,
    /// What the server answered at /api/v1/catalog/public-key during pairing
    /// (lolly #564's route): its keyId, so the page can compare it with the QR code.
    served_key_id: Option<String>,
    handshake_ms: Option<f64>,
    /// `LOLLY_PAIRING_SPIKE_BENCH=1`: the page runs the measurement harness.
    bench: bool,
    /// `LOLLY_PAIRING_SPIKE_TRACE=1`: the page forwards its console too.
    trace: bool,
}

fn state_of(paired: &Paired, served_key_id: Option<String>, handshake_ms: Option<f64>) -> PairState {
    PairState {
        origin: origin_string(&paired.origin),
        fingerprint: hex(&paired.fingerprint),
        key_id: paired.key_id.clone(),
        signed_in: paired.session.lock().map(|s| s.is_some()).unwrap_or(false),
        served_key_id,
        handshake_ms,
        bench: std::env::var("LOLLY_PAIRING_SPIKE_BENCH").is_ok_and(|v| v == "1"),
        trace: *TRACE,
    }
}

/// Explains a failed request without leaking internals. A fingerprint mismatch
/// is the one the person needs to hear about plainly.
fn describe(error: &reqwest::Error) -> String {
    if let Some(tls) = find_tls(error) {
        return describe_tls(tls);
    }
    if error.is_timeout() {
        return "The paired server did not answer in time.".into();
    }
    "The paired server could not be reached.".into()
}

/// The rustls error under reqwest, hyper and (nested) io::Error wrappers.
/// io::Error::source() skips the error it wraps, so each one is opened by hand.
fn find_tls<'a>(error: &'a (dyn std::error::Error + 'static)) -> Option<&'a rustls::Error> {
    let mut next: Option<&'a (dyn std::error::Error + 'static)> = Some(error);
    while let Some(err) = next {
        if let Some(tls) = err.downcast_ref::<rustls::Error>() {
            return Some(tls);
        }
        next = match err.downcast_ref::<std::io::Error>().and_then(|io| io.get_ref()) {
            Some(inner) => Some(inner as &(dyn std::error::Error + 'static)),
            None => err.source(),
        };
    }
    None
}

fn describe_tls(tls: &rustls::Error) -> String {
    if matches!(tls, rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure)) {
        return "This server's certificate does not match the one you paired with.".into();
    }
    format!("The secure connection failed ({tls}).")
}

async fn pair_inner(origin: Url, fingerprint: [u8; 32], key_id: Option<String>) -> Result<PairState, String> {
    let client = pinned_client(fingerprint)?;
    let paired = Arc::new(Paired { origin, fingerprint, key_id, client, session: Mutex::new(None) });
    // Prove the handshake before anything is stored: a wrong fingerprint fails here.
    let started = Instant::now();
    let probe = paired.origin.join("/api/v1/catalog/public-key").map_err(|_| "bad origin".to_string())?;
    let response = paired.client.get(probe).send().await.map_err(|e| describe(&e))?;
    let handshake_ms = started.elapsed().as_secs_f64() * 1000.0;
    let served_key_id = if response.status().is_success() {
        response.bytes().await.ok()
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .and_then(|v| v.get("keyId").and_then(|k| k.as_str()).map(str::to_string))
    } else {
        None
    };
    if let (Some(expected), Some(served)) = (&paired.key_id, &served_key_id) {
        if expected != served {
            return Err("The server's catalogue key does not match the pairing code.".into());
        }
    }
    let state = state_of(&paired, served_key_id, Some(handshake_ms));
    *PAIRED.write().map_err(|_| "pairing state poisoned".to_string())? = Some(paired);
    Ok(state)
}

/// Pair from a scanned `lolly://pair?...` link, or from origin + fingerprint.
#[tauri::command]
pub async fn pairing_spike_pair(link: Option<String>, origin: Option<String>, fingerprint: Option<String>) -> Result<PairState, String> {
    let (origin, fingerprint, key_id) = match (link, origin, fingerprint) {
        (Some(link), None, None) => {
            let parsed = parse_pairing_link(&link)?;
            (parsed.origin, parsed.fingerprint, parsed.key_id)
        }
        (None, Some(origin), Some(fingerprint)) => (parse_origin(&origin)?, parse_fingerprint(&fingerprint)?, None),
        _ => return Err("Pair with a pairing link, or with an address and a fingerprint.".into()),
    };
    pair_inner(origin, fingerprint, key_id).await
}

#[tauri::command]
pub fn pairing_spike_state() -> Option<PairState> {
    current().map(|p| state_of(&p, None, None))
}

#[tauri::command]
pub fn pairing_spike_unpair() {
    if let Ok(mut guard) = PAIRED.write() {
        *guard = None;
    }
}

/// The device-code sign-in returns `lw_session=<value>` in a JSON body; the page
/// hands the pair here so every scheme request (images included) carries the session.
#[tauri::command]
pub fn pairing_spike_set_session(cookie: Option<String>) -> Result<(), String> {
    let paired = current().ok_or("Not paired.")?;
    if let Some(c) = &cookie {
        if !valid_session_pair(c) {
            return Err("Not a session cookie pair.".into());
        }
    }
    *paired.session.lock().map_err(|_| "poisoned".to_string())? = cookie;
    Ok(())
}

fn valid_session_pair(c: &str) -> bool {
    c.strip_prefix("lw_session=").is_some_and(|v| !v.is_empty() && v.bytes().all(|b| b > 0x20 && b != b';' && b < 0x7f))
}

/// Spike-only: the harness prints its measurements through here so a run can be
/// read from the terminal that launched the app.
#[tauri::command]
pub fn pairing_spike_log(line: String) {
    println!("[pairing-spike] {}", line.chars().take(16 * 1024).collect::<String>());
}

/// Called once at startup: `LOLLY_PAIRING_SPIKE_LINK=lolly://pair?...` pairs the
/// app before the page loads (standing in for the camera scan).
pub fn pair_from_env() {
    let Ok(link) = std::env::var("LOLLY_PAIRING_SPIKE_LINK") else { return };
    tauri::async_runtime::block_on(async move {
        match parse_pairing_link(&link) {
            Ok(parsed) => match pair_inner(parsed.origin, parsed.fingerprint, parsed.key_id).await {
                Ok(state) => println!("[pairing-spike] paired {} handshake {:.1} ms servedKeyId {:?}", state.origin, state.handshake_ms.unwrap_or(0.0), state.served_key_id),
                Err(e) => println!("[pairing-spike] pairing refused: {e}"),
            },
            Err(e) => println!("[pairing-spike] pairing link refused: {e}"),
        }
    });
}

/// Bench only: the same GET returned over IPC as raw bytes (what an
/// invoke-based fetch shim would cost)...
#[tauri::command]
pub async fn pairing_spike_fetch_ipc(path: String) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(bench_get(&path).await?))
}

/// ...and as a JSON number array, the body encoding `remote_fetch` uses today.
#[tauri::command]
pub async fn pairing_spike_fetch_json(path: String) -> Result<Vec<u8>, String> {
    bench_get(&path).await
}

async fn bench_get(path: &str) -> Result<Vec<u8>, String> {
    let paired = current().ok_or("Not paired.")?;
    let url = paired.origin.join(path).map_err(|_| "Bad path.".to_string())?;
    if origin_string(&url) != origin_string(&paired.origin) {
        return Err("Bad path.".into());
    }
    let response = paired.client.get(url).send().await.map_err(|e| describe(&e))?;
    response.bytes().await.map(|b| b.to_vec()).map_err(|e| describe(&e))
}

/// The spike's commands, routed by name from `presentation_windows::main_commands`
/// so the shipped `generate_handler!` list is untouched.
pub fn route<R: Runtime>(invoke: tauri::ipc::Invoke<R>) -> bool {
    let handler: Box<dyn Fn(tauri::ipc::Invoke<R>) -> bool> = Box::new(tauri::generate_handler![
        pairing_spike_pair,
        pairing_spike_state,
        pairing_spike_unpair,
        pairing_spike_set_session,
        pairing_spike_log,
        pairing_spike_ws_open,
        pairing_spike_ws_send,
        pairing_spike_ws_close,
        pairing_spike_fetch_ipc,
        pairing_spike_fetch_json
    ]);
    handler(invoke)
}

// ── The scheme ──────────────────────────────────────────────────────────────

/// Origins of the app's own document. Only these may send a state-changing
/// request through the scheme: any other frame in the webview (a Design web-page
/// box, plan 288) would otherwise ride the paired session.
fn app_origin_allowed(origin: &str) -> bool {
    matches!(origin, "tauri://localhost" | "http://tauri.localhost" | "https://tauri.localhost")
        || (cfg!(debug_assertions) && (origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173"))
}

const FORWARD_REQUEST_HEADERS: &[&str] = &[
    "accept", "accept-language", "content-type", "range", "if-range", "if-none-match",
    "if-modified-since", "x-lolly-client", "x-requested-with", "idempotency-key",
];
const FORWARD_RESPONSE_HEADERS: &[&str] = &[
    "content-type", "cache-control", "etag", "last-modified", "content-range", "accept-ranges",
    "content-disposition", "content-language", "expires", "vary", "retry-after",
];

fn respond(status: u16, cors: Option<&str>, content_type: &str, body: Vec<u8>) -> http::Response<Vec<u8>> {
    let mut builder = http::Response::builder().status(status).header("content-type", content_type);
    if let Some(origin) = cors {
        builder = builder.header("access-control-allow-origin", origin).header("vary", "origin");
    }
    builder.body(body).unwrap_or_else(|_| http::Response::new(Vec::new()))
}

static TRACE: LazyLock<bool> = LazyLock::new(|| std::env::var("LOLLY_PAIRING_SPIKE_TRACE").is_ok_and(|v| v == "1"));

pub fn handle<R: Runtime>(_ctx: UriSchemeContext<'_, R>, request: http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    tauri::async_runtime::spawn(async move {
        let line = TRACE.then(|| format!(
            "{} {} origin={:?} body={}B",
            request.method(),
            request.uri(),
            request.headers().get("origin").and_then(|v| v.to_str().ok()).unwrap_or("-"),
            request.body().len()
        ));
        if let Some(line) = &line {
            println!("[pairing-spike] scheme start {line}");
        }
        let started = Instant::now();
        let response = proxy(request).await;
        if let Some(line) = line {
            println!("[pairing-spike] scheme {line} -> {} {}B {:.1} ms", response.status().as_u16(), response.body().len(), started.elapsed().as_secs_f64() * 1000.0);
        }
        responder.respond(response);
    });
}

async fn proxy(request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let started = Instant::now();
    let page_origin = request.headers().get("origin").and_then(|v| v.to_str().ok()).map(str::to_string);
    let cors = page_origin.as_deref().filter(|o| app_origin_allowed(o));
    let Some(paired) = current() else {
        return respond(503, cors, "text/plain", b"Not paired with a server.".to_vec());
    };
    let method = request.method().clone();

    // Preflight is answered here: nothing reaches the server.
    if method == http::Method::OPTIONS {
        let Some(origin) = cors else { return respond(403, None, "text/plain", Vec::new()) };
        let asked = request.headers().get("access-control-request-headers").and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
        return http::Response::builder()
            .status(204)
            .header("access-control-allow-origin", origin)
            .header("access-control-allow-methods", "GET, HEAD, POST, PUT, PATCH, DELETE")
            .header("access-control-allow-headers", asked)
            .header("access-control-allow-credentials", "true")
            .header("access-control-max-age", "600")
            .header("vary", "origin")
            .body(Vec::new())
            .unwrap();
    }
    // CSRF: the server cannot see the page's origin any more (the native client
    // sends none, like any native client), so the check moves here.
    let safe = matches!(method, http::Method::GET | http::Method::HEAD);
    if !safe && cors.is_none() {
        return respond(403, None, "text/plain", b"Only the app itself may change data on the paired server.".to_vec());
    }

    let path_and_query = request.uri().path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let Ok(mut url) = paired.origin.join(path_and_query) else {
        return respond(400, cors, "text/plain", b"Bad path.".to_vec());
    };
    if origin_string(&url) != origin_string(&paired.origin) {
        return respond(400, cors, "text/plain", b"Bad path.".to_vec());
    }
    let mut headers = reqwest::header::HeaderMap::new();
    for name in FORWARD_REQUEST_HEADERS {
        for value in request.headers().get_all(*name) {
            if let (Ok(n), Ok(v)) = (reqwest::header::HeaderName::from_bytes(name.as_bytes()), reqwest::header::HeaderValue::from_bytes(value.as_bytes())) {
                headers.append(n, v);
            }
        }
    }
    let mut method = Method::from_bytes(method.as_str().as_bytes()).unwrap_or(Method::GET);
    let mut body = request.into_body();
    let mut upstream_ms = 0.0;

    for hop in 0..=MAX_REDIRECTS {
        let mut builder = paired.client.request(method.clone(), url.clone()).headers(headers.clone());
        if let Some(cookie) = paired.session.lock().ok().and_then(|s| s.clone()) {
            builder = builder.header("cookie", cookie);
        }
        if !body.is_empty() {
            builder = builder.body(body.clone());
        }
        let hop_started = Instant::now();
        let mut response = match builder.send().await {
            Ok(r) => r,
            Err(e) => return respond(502, cors, "text/plain", describe(&e).into_bytes()),
        };
        absorb_cookies(&paired, response.headers());
        let status = response.status().as_u16();
        if matches!(status, 301 | 302 | 303 | 307 | 308) {
            let next = response.headers().get("location").and_then(|v| v.to_str().ok()).and_then(|l| url.join(l).ok());
            let Some(next) = next else { return respond(502, cors, "text/plain", b"Redirect without a destination.".to_vec()) };
            // Only within the paired origin. A hop to another host would leave the
            // pin; the spike refuses it (see the write-up: S3 offload on another host).
            if next.scheme() != "https" || origin_string(&next) != origin_string(&paired.origin) || hop == MAX_REDIRECTS {
                return respond(502, cors, "text/plain", b"The paired server redirected elsewhere; refused.".to_vec());
            }
            if status == 303 || ((status == 301 || status == 302) && method == Method::POST) {
                method = Method::GET;
                body.clear();
                headers.remove("content-type");
            }
            url = next;
            continue;
        }
        let mut out = http::Response::builder().status(status);
        for name in FORWARD_RESPONSE_HEADERS {
            for value in response.headers().get_all(*name) {
                out = out.header(*name, value.as_bytes());
            }
        }
        let mut bytes = Vec::with_capacity(response.content_length().unwrap_or(0).min(MAX_RESPONSE_BYTES as u64) as usize);
        loop {
            match response.chunk().await {
                Ok(Some(chunk)) => {
                    if bytes.len() + chunk.len() > MAX_RESPONSE_BYTES {
                        return respond(502, cors, "text/plain", b"Response too large.".to_vec());
                    }
                    bytes.extend_from_slice(&chunk);
                }
                Ok(None) => break,
                Err(e) => return respond(502, cors, "text/plain", describe(&e).into_bytes()),
            }
        }
        upstream_ms += hop_started.elapsed().as_secs_f64() * 1000.0;
        if let Some(origin) = cors {
            out = out
                .header("access-control-allow-origin", origin)
                .header("access-control-allow-credentials", "true")
                .header("access-control-expose-headers", "*");
        }
        let total_ms = started.elapsed().as_secs_f64() * 1000.0;
        out = out
            .header("x-pairing-spike-upstream-ms", format!("{upstream_ms:.2}"))
            .header("x-pairing-spike-native-ms", format!("{total_ms:.2}"));
        return out.body(bytes).unwrap_or_else(|_| http::Response::new(Vec::new()));
    }
    respond(502, cors, "text/plain", b"Too many redirects.".to_vec())
}

/// A one-origin cookie jar for the one cookie that matters.
fn absorb_cookies(paired: &Paired, headers: &reqwest::header::HeaderMap) {
    for value in headers.get_all("set-cookie") {
        let Ok(text) = value.to_str() else { continue };
        let pair = text.split(';').next().unwrap_or("").trim();
        if let Some(v) = pair.strip_prefix("lw_session=") {
            let cleared = v.is_empty() || text.to_ascii_lowercase().contains("max-age=0");
            if let Ok(mut s) = paired.session.lock() {
                *s = if cleared { None } else if valid_session_pair(pair) { Some(pair.to_string()) } else { s.clone() };
            }
        }
    }
}

// ── WebSocket bridge ────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SocketEvent {
    Open { protocol: String },
    Message { data: String },
    Close { code: u16, reason: String },
    Error { message: String },
}

enum Outgoing {
    Text(String),
    Close(u16, String),
}

static SOCKETS: LazyLock<Mutex<HashMap<u32, mpsc::Sender<Outgoing>>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT_SOCKET: AtomicU32 = AtomicU32::new(1);

/// Opens `wss://<paired origin><path>` through the pinned verifier. Frames reach
/// the page through `on_event`; `pairing_spike_ws_send` / `_close` go the other way.
#[tauri::command]
pub fn pairing_spike_ws_open(path: String, protocols: Vec<String>, on_event: Channel<SocketEvent>) -> Result<u32, String> {
    let paired = current().ok_or("Not paired.")?;
    if !path.starts_with('/') || path.len() > 2048 || protocols.len() > 8 {
        return Err("Bad socket path.".into());
    }
    let mut ws_url = paired.origin.join(&path).map_err(|_| "Bad socket path.".to_string())?;
    if origin_string(&ws_url) != origin_string(&paired.origin) {
        return Err("Bad socket path.".into());
    }
    ws_url.set_scheme("wss").map_err(|_| "Bad socket path.".to_string())?;
    let id = NEXT_SOCKET.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    SOCKETS.lock().map_err(|_| "poisoned".to_string())?.insert(id, tx);
    std::thread::spawn(move || {
        let result = run_socket(&paired, &ws_url, &protocols, &on_event, rx);
        if let Err(message) = result {
            let _ = on_event.send(SocketEvent::Error { message });
            let _ = on_event.send(SocketEvent::Close { code: 1006, reason: String::new() });
        }
        if let Ok(mut map) = SOCKETS.lock() {
            map.remove(&id);
        }
    });
    Ok(id)
}

#[tauri::command]
pub fn pairing_spike_ws_send(id: u32, data: String) -> Result<(), String> {
    let map = SOCKETS.lock().map_err(|_| "poisoned".to_string())?;
    map.get(&id).ok_or("Socket closed.")?.send(Outgoing::Text(data)).map_err(|_| "Socket closed.".into())
}

#[tauri::command]
pub fn pairing_spike_ws_close(id: u32, code: Option<u16>, reason: Option<String>) {
    if let Ok(map) = SOCKETS.lock() {
        if let Some(tx) = map.get(&id) {
            let _ = tx.send(Outgoing::Close(code.unwrap_or(1000), reason.unwrap_or_default()));
        }
    }
}

fn run_socket(
    paired: &Paired,
    url: &Url,
    protocols: &[String],
    events: &Channel<SocketEvent>,
    outgoing: mpsc::Receiver<Outgoing>,
) -> Result<(), String> {
    use tungstenite::client::IntoClientRequest;
    use tungstenite::Message;

    let host = url.host_str().ok_or("no host")?.to_string();
    let port = url.port_or_known_default().unwrap_or(443);
    let address = (host.as_str(), port).to_socket_addrs().map_err(|_| "The paired server's name could not be resolved.")?
        .next().ok_or("The paired server's name could not be resolved.")?;
    let tcp = TcpStream::connect_timeout(&address, Duration::from_secs(10)).map_err(|_| "The paired server could not be reached.")?;
    tcp.set_nodelay(true).ok();
    // A WebSocket upgrade is HTTP/1.1 only.
    let config = Arc::new(tls_config(paired.fingerprint, &[b"http/1.1"])?);
    let name = ServerName::try_from(host.clone()).map_err(|_| "bad host")?;
    let connection = rustls::ClientConnection::new(config, name).map_err(|_| "TLS setup failed.")?;
    let stream = rustls::StreamOwned::new(connection, tcp);

    let mut request = url.as_str().into_client_request().map_err(|_| "Bad socket request.")?;
    if !protocols.is_empty() {
        let joined = protocols.join(", ");
        request.headers_mut().insert("sec-websocket-protocol", joined.parse().map_err(|_| "Bad protocol list.")?);
    }
    if let Some(cookie) = paired.session.lock().ok().and_then(|s| s.clone()) {
        request.headers_mut().insert("cookie", cookie.parse().map_err(|_| "Bad cookie.")?);
    }
    let (mut socket, response) = tungstenite::client(request, stream).map_err(|e| match e {
        tungstenite::HandshakeError::Failure(tungstenite::Error::Io(io)) => {
            match find_tls(&io) {
                Some(tls) => describe_tls(tls),
                None => format!("The socket could not connect ({io})."),
            }
        }
        tungstenite::HandshakeError::Failure(tungstenite::Error::Http(r)) => format!("The server refused the socket ({}).", r.status()),
        other => format!("The socket handshake failed ({other})."),
    })?;
    let protocol = response.headers().get("sec-websocket-protocol").and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
    let _ = events.send(SocketEvent::Open { protocol });
    // The spike's socket is synchronous tungstenite (already in Cargo.lock), so one
    // thread alternates between a short blocking read and draining the page's
    // frames: an outgoing frame waits up to one poll interval. A product build
    // would split the stream on tokio (tokio-tungstenite, a new crate) instead.
    let poll_ms = std::env::var("LOLLY_PAIRING_SPIKE_WS_POLL_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(15u64).clamp(1, 100);
    socket.get_mut().sock.set_read_timeout(Some(Duration::from_millis(poll_ms))).ok();

    loop {
        // Drain the page's outgoing frames first.
        loop {
            match outgoing.try_recv() {
                Ok(Outgoing::Text(text)) => {
                    if let Err(e) = socket.send(Message::text(text)) {
                        return Err(format!("Send failed ({e})."));
                    }
                }
                Ok(Outgoing::Close(code, reason)) => {
                    let frame = tungstenite::protocol::CloseFrame { code: code.into(), reason: reason.clone().into() };
                    let _ = socket.close(Some(frame));
                    let _ = socket.flush();
                    let _ = events.send(SocketEvent::Close { code, reason });
                    return Ok(());
                }
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => {
                    let _ = socket.close(None);
                    return Ok(());
                }
            }
        }
        match socket.read() {
            Ok(Message::Text(text)) => { let _ = events.send(SocketEvent::Message { data: text.to_string() }); }
            Ok(Message::Binary(bytes)) => { let _ = events.send(SocketEvent::Message { data: String::from_utf8_lossy(&bytes).into_owned() }); }
            Ok(Message::Close(frame)) => {
                let (code, reason) = frame.map(|f| (u16::from(f.code), f.reason.to_string())).unwrap_or((1005, String::new()));
                let _ = events.send(SocketEvent::Close { code, reason });
                return Ok(());
            }
            Ok(_) => {}
            Err(tungstenite::Error::Io(e)) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {
                let _ = socket.flush();
            }
            Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => {
                let _ = events.send(SocketEvent::Close { code: 1006, reason: String::new() });
                return Ok(());
            }
            Err(e) => return Err(format!("The socket failed ({e})."))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Public certificates only: no private key is committed for these tests.
    const CERT_A_FINGERPRINT: &str = "171b7eb5b810f8dbde6ed29db1699baddc251ba045c63b836d8817385b142e9d";

    #[test]
    fn fingerprint_forms_parse_to_the_same_digest() {
        let hex_form = parse_fingerprint(CERT_A_FINGERPRINT).unwrap();
        let colons: String = CERT_A_FINGERPRINT.as_bytes().chunks(2).map(|c| std::str::from_utf8(c).unwrap().to_ascii_uppercase()).collect::<Vec<_>>().join(":");
        assert_eq!(parse_fingerprint(&colons).unwrap(), hex_form);
        assert_eq!(parse_fingerprint(&format!("sha256:{CERT_A_FINGERPRINT}")).unwrap(), hex_form);
        use base64::Engine as _;
        let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hex_form);
        assert_eq!(b64.len(), 43);
        assert_eq!(parse_fingerprint(&b64).unwrap(), hex_form);
        for bad in ["", "abcd", &CERT_A_FINGERPRINT[..62], "zz".repeat(32).as_str()] {
            assert!(parse_fingerprint(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn only_a_plain_https_origin_can_be_paired() {
        assert!(parse_origin("https://192.168.1.20:8443").is_ok());
        assert!(parse_origin("https://lolly.local").is_ok());
        for bad in [
            "http://192.168.1.20:8443",
            "ws://192.168.1.20",
            "https://user:pw@192.168.1.20",
            "https://192.168.1.20/app",
            "https://192.168.1.20/?x=1",
            "https://192.168.1.20/#x",
            "file:///etc/hosts",
        ] {
            assert!(parse_origin(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn pairing_link_round_trip_and_refusals() {
        use base64::Engine as _;
        let fp = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(parse_fingerprint(CERT_A_FINGERPRINT).unwrap());
        let link = format!("lolly://pair?v=1&u=https%3A%2F%2F192.168.50.60%3A8443&fp={fp}&kid=Y2C0hGUH57c4xU0tkmF2ffTJ1RQ1nc6FzW8hU89tR5o");
        let parsed = parse_pairing_link(&link).unwrap();
        assert_eq!(origin_string(&parsed.origin), "https://192.168.50.60:8443");
        assert_eq!(hex(&parsed.fingerprint), CERT_A_FINGERPRINT);
        assert_eq!(parsed.key_id.as_deref(), Some("Y2C0hGUH57c4xU0tkmF2ffTJ1RQ1nc6FzW8hU89tR5o"));
        assert!(parse_pairing_link(&link.replace("v=1", "v=2")).is_err());
        assert!(parse_pairing_link(&link.replace("https%3A", "http%3A")).is_err());
        assert!(parse_pairing_link(&link.replace(&fp, "abc")).is_err());
        assert!(parse_pairing_link(&link.replace("kid=Y2C0", "kid=%3Cscript%3E")).is_err());
        assert!(parse_pairing_link("https://pair?v=1").is_err());
    }

    #[test]
    fn the_verifier_accepts_only_the_pinned_certificate() {
        let fp = parse_fingerprint(CERT_A_FINGERPRINT).unwrap();
        let verifier = PinnedVerifier::new(fp);
        let name = ServerName::try_from("192.168.50.60").unwrap();
        // Any DER whose digest differs is refused, whatever it claims to be.
        let other = CertificateDer::from(vec![0x30, 0x03, 0x02, 0x01, 0x01]);
        let err = verifier.verify_server_cert(&other, &[], &name, &[], UnixTime::now()).unwrap_err();
        assert!(matches!(err, rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure)));
        // The handshake signature check is rustls's own (verify_tls1{2,3}_signature
        // with the provider's algorithms); DigitallySignedStruct cannot be built
        // outside rustls, so the live probe in the write-up exercises that leg.
        assert!(!verifier.supported_verify_schemes().is_empty());
    }

    #[test]
    fn only_the_app_document_may_change_data() {
        assert!(app_origin_allowed("tauri://localhost"));
        assert!(app_origin_allowed("http://tauri.localhost"));
        assert!(!app_origin_allowed("https://evil.example"));
        assert!(!app_origin_allowed("null"));
    }

    #[test]
    fn session_cookie_pairs_are_strict() {
        assert!(valid_session_pair("lw_session=abc.def-123"));
        for bad in ["lw_session=", "other=abc", "lw_session=a;b", "lw_session=a b"] {
            assert!(!valid_session_pair(bad), "{bad}");
        }
    }

    /// Live check against a running appliance. Ignored by default; run with
    /// `PAIRING_SPIKE_ORIGIN=https://<host>:<port> PAIRING_SPIKE_FP=<sha256 of the
    /// served certificate> PAIRING_SPIKE_WRONG_FP=<any other digest>
    /// cargo test --features pairing-spike --lib pairing_spike::tests::live -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn live_pinned_client_against_a_running_server() {
        let origin = parse_origin(&std::env::var("PAIRING_SPIKE_ORIGIN").unwrap()).unwrap();
        let right = parse_fingerprint(&std::env::var("PAIRING_SPIKE_FP").unwrap()).unwrap();
        let wrong = parse_fingerprint(&std::env::var("PAIRING_SPIKE_WRONG_FP").unwrap()).unwrap();
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let url = origin.join("/api/v1/catalog/public-key").unwrap();
            // The paired certificate: accepted.
            let client = pinned_client(right).unwrap();
            let started = Instant::now();
            let response = client.get(url.clone()).send().await.expect("pinned certificate accepted");
            println!("first request (TCP + TLS + HTTP) {:.2} ms, status {}", started.elapsed().as_secs_f64() * 1000.0, response.status());
            let mut warm = Vec::new();
            for _ in 0..50 {
                let t = Instant::now();
                let r = client.get(url.clone()).send().await.unwrap();
                let _ = r.bytes().await.unwrap();
                warm.push(t.elapsed().as_secs_f64() * 1000.0);
            }
            warm.sort_by(|a, b| a.partial_cmp(b).unwrap());
            println!("warm request median {:.2} ms p90 {:.2} ms", warm[25], warm[45]);
            // Any other certificate on the same address: refused, with the plain message.
            let err = pinned_client(wrong).unwrap().get(url.clone()).send().await.expect_err("wrong pin refused");
            assert_eq!(describe(&err), "This server's certificate does not match the one you paired with.");
            println!("wrong pin: {}", describe(&err));
            // Plain http on the same host and port: refused before any byte is sent.
            let mut http = url.clone();
            http.set_scheme("http").unwrap();
            assert!(pinned_client(right).unwrap().get(http).send().await.is_err());
        });
    }
}

