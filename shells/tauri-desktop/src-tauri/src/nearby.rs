//! Nearby discovery - the desktop half of plans/110 section 3.
//!
//! A PWA cannot see other devices on a network; a Tauri process can. This module
//! advertises the running app over mDNS/DNS-SD (`_lolly._tcp.local.`) and browses
//! for other Lolly devices, so the collab ceremony can hand an invite to a peer by
//! TAPPING A NAME instead of scanning a QR. It is the transport of the invite only -
//! the ceremony's matching plates still authenticate every pairing (plan 100 section 11.23),
//! because mDNS is unauthenticated and anyone on a café network can advertise any
//! name. "Discoverable" is never "trusted", and nothing here weakens the ceremony.
//!
//! WHAT CROSSES THE WIRE, AND WHAT DOES NOT
//!   • mDNS advert: service `_lolly._tcp.local.`, a per-window RANDOM instance name
//!     (a stable one would be a cross-network tracking beacon), and a TXT record of
//!     exactly `v`/`n` (chosen display name, ≤ NAME_CAP)/`k` (device kind). No email,
//!     no profile identity, no stable id (plan 100 section 11.23).
//!   • Invite exchange: a single length-prefixed JSON frame each way over a
//!     short-lived TCP connection to the advertised port - `invite {token}` in,
//!     `reply {token}` or `decline` back. The tokens are the SAME opaque blobs a QR
//!     carries today; this module never inspects them. It is NOT a data transport
//!     (that is the native socket transport of plans/110 section 4, a later wave) and it
//!     carries exactly one message each way before closing.
//!
//! UNTRUSTED INPUT
//! Every byte here arrives from a stranger on a LAN. The frame reader caps the
//! length before allocating; the message parser caps every field and rejects any
//! unknown shape; the browse side clamps names and the peer count. The hostile
//! surface lives in the pure `frame`/`message`/`txt` helpers below, which are unit
//! tested; the socket and mDNS glue around them holds no parsing of its own.
//!
//! POLL-BASED BRIDGE
//! The JS side (shells/web/src/lib/nearby-boot.ts) drives everything over `invoke`
//! and reads state with `nearby_poll` - no Tauri events, so the JS↔Rust contract is
//! trivially testable with a fake invoke. This module keeps the peer set and the
//! pending inbound invites in one `Mutex`; `nearby_poll` snapshots it.
//!
//! GUI ONLY. Registered in `run_gui` (lib.rs), never in the headless CLI handler: a
//! `Lolly run <tool>` render has no business advertising on a network.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;

/// DNS-SD service type. The trailing dot + `local.` domain is the DNS-SD convention.
const SERVICE_TYPE: &str = "_lolly._tcp.local.";
/// Chosen display name ceiling - both what we advertise and what we accept.
const NAME_CAP: usize = 32;
/// One control frame ceiling (matches the beam control-frame cap on the JS side).
const MAX_FRAME_BYTES: usize = 128 * 1024;
/// The most peers we will ever hold, so a flooded network cannot grow the map without
/// bound. Beyond this, new peers are ignored until some age out.
const MAX_PEERS: usize = 128;
/// How long a held inbound connection waits for the human to accept/decline before the
/// handler drops it (the initiator then sees EOF and reports a timeout).
const INVITE_DECISION_TIMEOUT: Duration = Duration::from_secs(180);
/// Read timeout for a single frame - a peer that opens a socket and stalls must not
/// pin a handler thread.
const FRAME_READ_TIMEOUT: Duration = Duration::from_secs(30);
/// Connect timeout when we initiate an exchange to a discovered peer.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
/// How long a minted invite stays valid (plans/110 section 5, Andy 2026-08-13: invite expiry).
/// The exchange is LIVE (the peer connected just now), so this is short - it bounds the
/// window a captured invite frame could be replayed within.
const INVITE_TTL_MS: u64 = 2 * 60_000;
/// Clock-skew tolerance either side of the expiry check.
const CLOCK_SKEW_MS: u64 = 30_000;
/// Bounded memory of nonces already honoured, so a captured invite cannot be replayed
/// (single-use, Andy 2026-08-13). Human-paced, so a modest ring is ample.
const MAX_SEEN_NONCES: usize = 4096;
/// A nonce is a short random token; anything longer is hostile.
const MAX_NONCE_CHARS: usize = 128;
/// Cap on invites awaiting a human decision at once. A person handles a couple at a time;
/// this bounds the invite Vec, the handler-thread count, and the `nearby_poll` payload so a
/// LAN flood cannot exhaust memory/threads or amplify per-poll (review finding #4/#6).
const MAX_PENDING_INVITES: usize = 32;
/// An invite token is a ceremony blob (a few KB at most). Far below MAX_FRAME_BYTES so a
/// flood cannot pin 128 KiB per pending invite.
const MAX_INVITE_TOKEN_BYTES: usize = 16 * 1024;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Is an invite still in its validity window? Rejects an expired stamp (past `exp`, with
/// skew) AND an absurd far-future one (a peer cannot mint a never-expiring invite).
fn invite_fresh(exp: u64, now: u64) -> bool {
    now <= exp.saturating_add(CLOCK_SKEW_MS) && exp <= now + INVITE_TTL_MS + CLOCK_SKEW_MS
}

// ── shared state ─────────────────────────────────────────────────────────────

/// A peer we can currently see. `id` (the mDNS fullname) is the opaque handle the JS
/// side passes back to `nearby_exchange_invite`; `addr`/`port` are how we reach it.
struct Peer {
    name: String,
    kind: char, // 'd' desktop | 'm' mobile
    addr: std::net::IpAddr,
    port: u16,
    /// The peer's native-transport listener port (TXT `t`), or 0 if it offers none
    /// (plans/110 section 4). Used by native_transport::native_connect via resolve_transport.
    transport_port: u16,
}

/// An inbound invite whose TCP connection a handler thread is holding open, waiting
/// for the human's decision. `respond` carries the reply/decline back to that thread.
struct PendingInvite {
    exchange_id: String,
    from_name: String,
    token: String,
    respond: Sender<Response>,
}

enum Response {
    Reply(String),
    Decline,
}

#[derive(Default)]
struct NearbyState {
    daemon: Option<ServiceDaemon>,
    advertising: bool,
    my_instance: Option<String>, // to skip our own advert in the browse stream
    my_name: String,
    browsing: bool,
    listener_port: Option<u16>,
    peers: HashMap<String, Peer>,
    invites: Vec<PendingInvite>,
    /// Nonces of invites already honoured (single-use anti-replay, bounded ring).
    seen_nonces: std::collections::VecDeque<String>,
}

impl NearbyState {
    /// Whether a new inbound invite may be admitted right now: we are advertising AND
    /// under the pending-invite cap. The nonce check is separate (`accept_nonce` mutates).
    fn can_admit_invite(&self) -> bool {
        self.advertising && self.invites.len() < MAX_PENDING_INVITES
    }

    /// Record a nonce as used; returns false if it was already seen (a replay).
    fn accept_nonce(&mut self, nonce: &str) -> bool {
        if self.seen_nonces.iter().any(|n| n == nonce) {
            return false;
        }
        if self.seen_nonces.len() >= MAX_SEEN_NONCES {
            self.seen_nonces.pop_front();
        }
        self.seen_nonces.push_back(nonce.to_string());
        true
    }
}

fn state() -> &'static Mutex<NearbyState> {
    static STATE: OnceLock<Mutex<NearbyState>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(NearbyState::default()))
}

/// The one shared daemon (registered lazily). mDNS uses a background thread + channels,
/// so one daemon serves both advertise and browse.
fn ensure_daemon(st: &mut NearbyState) -> Result<ServiceDaemon, String> {
    if let Some(d) = &st.daemon {
        return Ok(d.clone());
    }
    let d = ServiceDaemon::new().map_err(|e| format!("mDNS unavailable: {e}"))?;
    st.daemon = Some(d.clone());
    Ok(d)
}

// ── serializable poll snapshot ───────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PeerOut {
    id: String,
    name: String,
    kind: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InviteOut {
    exchange_id: String,
    from_name: String,
    token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollOut {
    peers: Vec<PeerOut>,
    invites: Vec<InviteOut>,
}

// ── commands ─────────────────────────────────────────────────────────────────

/// Start advertising this device under `name`. Regenerates a random instance name
/// each call (rotation - no stable beacon), and starts the invite listener if it is
/// not already up. Idempotent enough: re-advertises with the new name.
#[tauri::command]
pub fn nearby_set_visible(name: String) -> Result<(), String> {
    let name = clamp_name(&name);
    let mut st = state().lock().map_err(|_| "nearby state poisoned")?;

    // Ensure the invite listener is up and we know its port.
    let port = match st.listener_port {
        Some(p) => p,
        None => {
            let p = start_listener()?;
            st.listener_port = Some(p);
            p
        }
    };

    let daemon = ensure_daemon(&mut st)?;

    // Retire any prior advert before publishing a fresh instance name.
    if let (true, Some(prev)) = (st.advertising, st.my_instance.clone()) {
        let _ = daemon.unregister(&full_name(&prev));
    }

    // Bring up the native-transport listener too, and advertise its port in TXT `t`, so a
    // peer that discovers us can open the Noise socket (plans/110 section 4).
    let transport_port = crate::native_transport::ensure_transport_listener().unwrap_or(0);

    let instance = gen_instance_name();
    let host = format!("{instance}.local.");
    let props = txt_props(&name, transport_port);
    let info = ServiceInfo::new(SERVICE_TYPE, &instance, &host, "", port, &props[..])
        .map_err(|e| format!("Could not build the advert: {e}"))?
        .enable_addr_auto();
    daemon
        .register(info)
        .map_err(|e| format!("Could not start advertising: {e}"))?;

    st.advertising = true;
    st.my_instance = Some(instance);
    st.my_name = name;
    Ok(())
}

/// Stop advertising. The invite listener stays up only while advertising, so this
/// also lets it wind down (a new `set_visible` restarts it).
#[tauri::command]
pub fn nearby_hide() -> Result<(), String> {
    let mut st = state().lock().map_err(|_| "nearby state poisoned")?;
    if let (Some(daemon), Some(instance)) = (st.daemon.clone(), st.my_instance.clone()) {
        let _ = daemon.unregister(&full_name(&instance));
    }
    st.advertising = false;
    st.my_instance = None;
    Ok(())
}

/// Start or stop browsing for peers. Browsing is independent of advertising (you can
/// look without being seen - plan 110 section 3.1).
#[tauri::command]
pub fn nearby_browse(on: bool) -> Result<(), String> {
    let mut st = state().lock().map_err(|_| "nearby state poisoned")?;
    if on {
        if st.browsing {
            return Ok(());
        }
        let daemon = ensure_daemon(&mut st)?;
        let rx = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("Could not start browsing: {e}"))?;
        st.browsing = true;
        // A background thread folds resolve/remove events into the shared peer map.
        std::thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => absorb_resolved(&info),
                    ServiceEvent::ServiceRemoved(_ty, fullname) => {
                        if let Ok(mut st) = state().lock() {
                            st.peers.remove(&fullname);
                        }
                    }
                    _ => {}
                }
                // Stop the moment browsing is turned off.
                if let Ok(st) = state().lock() {
                    if !st.browsing {
                        break;
                    }
                }
            }
        });
    } else {
        st.browsing = false;
        st.peers.clear();
        if let Some(daemon) = &st.daemon {
            let _ = daemon.stop_browse(SERVICE_TYPE);
        }
    }
    Ok(())
}

/// The current peer set + any inbound invites waiting for a decision.
#[tauri::command]
pub fn nearby_poll() -> Result<PollOut, String> {
    let st = state().lock().map_err(|_| "nearby state poisoned")?;
    let peers = st
        .peers
        .iter()
        .map(|(id, p)| PeerOut {
            id: id.clone(),
            name: p.name.clone(),
            kind: if p.kind == 'm' { "mobile" } else { "desktop" },
        })
        .collect();
    let invites = st
        .invites
        .iter()
        .map(|i| InviteOut {
            exchange_id: i.exchange_id.clone(),
            from_name: i.from_name.clone(),
            token: i.token.clone(),
        })
        .collect();
    Ok(PollOut { peers, invites })
}

/// Hand our invite token to a discovered peer and return their reply token. Blocks on
/// the socket, so it runs off the main thread; a decline or timeout is an error.
#[tauri::command]
pub async fn nearby_exchange_invite(peer_id: String, token: String) -> Result<String, String> {
    if token.len() > MAX_FRAME_BYTES {
        return Err("That invite is too large to send.".into());
    }
    let (addr, port) = {
        let st = state().lock().map_err(|_| "nearby state poisoned")?;
        let p = st.peers.get(&peer_id).ok_or("That device is no longer nearby.")?;
        (p.addr, p.port)
    };
    // The socket work is blocking; keep it off the async worker.
    tauri::async_runtime::spawn_blocking(move || exchange_blocking(addr, port, &token))
        .await
        .map_err(|e| format!("Nearby exchange failed to run: {e}"))?
}

/// Answer an inbound invite with our reply token.
#[tauri::command]
pub fn nearby_send_reply(exchange_id: String, token: String) -> Result<(), String> {
    complete_invite(&exchange_id, Response::Reply(token))
}

/// Refuse an inbound invite.
#[tauri::command]
pub fn nearby_decline(exchange_id: String) -> Result<(), String> {
    complete_invite(&exchange_id, Response::Decline)
}

fn complete_invite(exchange_id: &str, resp: Response) -> Result<(), String> {
    let mut st = state().lock().map_err(|_| "nearby state poisoned")?;
    if let Some(pos) = st.invites.iter().position(|i| i.exchange_id == exchange_id) {
        let pending = st.invites.remove(pos);
        // The handler thread may already have timed out; a failed send is harmless.
        let _ = pending.respond.send(resp);
        Ok(())
    } else {
        // Already answered or timed out - treat as a no-op rather than an error.
        Ok(())
    }
}

// ── browse folding ───────────────────────────────────────────────────────────

fn absorb_resolved(info: &ServiceInfo) {
    let fullname = info.get_fullname().to_string();
    let Ok(mut st) = state().lock() else { return };
    // Never list ourselves.
    if let Some(mine) = &st.my_instance {
        if fullname == full_name(mine) {
            return;
        }
    }
    if st.peers.len() >= MAX_PEERS && !st.peers.contains_key(&fullname) {
        return;
    }
    let name = info
        .get_property_val_str("n")
        .map(clamp_name)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Someone".to_string());
    let kind = info
        .get_property_val_str("k")
        .and_then(|s| s.chars().next())
        .filter(|c| *c == 'd' || *c == 'm')
        .unwrap_or('d');
    let Some(addr) = info.get_addresses().iter().copied().next() else {
        return; // no address yet - a later event will carry one
    };
    let transport_port = info
        .get_property_val_str("t")
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(0);
    st.peers.insert(
        fullname,
        Peer {
            name,
            kind,
            addr,
            port: info.get_port(),
            transport_port,
        },
    );
}

// ── the invite listener ──────────────────────────────────────────────────────

/// Bind an ephemeral TCP port and accept invite connections on a background thread.
/// Each connection is handled on its own short-lived thread so the human's decision
/// time never blocks the accept loop. Returns the bound port to advertise.
fn start_listener() -> Result<u16, String> {
    // Bind all interfaces on an OS-chosen port; mDNS advertises this port with our
    // auto-detected addresses.
    let listener = TcpListener::bind(("0.0.0.0", 0))
        .map_err(|e| format!("Could not open a nearby port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Could not read the nearby port: {e}"))?
        .port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            std::thread::spawn(move || handle_invite_conn(stream));
        }
    });
    Ok(port)
}

fn handle_invite_conn(mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(FRAME_READ_TIMEOUT));
    let bytes = match read_frame(&mut stream) {
        Ok(b) => b,
        Err(_) => return, // unreadable/oversized/stalled - drop it
    };
    let (token, exp, nonce) = match parse_message(&bytes) {
        Ok(Message::Invite { token, exp, nonce }) => (token, exp, nonce),
        _ => return, // only an invite is valid as the first frame
    };
    // Reject a stale invite (expiry) or an oversized token before taking any resources.
    if !invite_fresh(exp, now_ms()) || token.len() > MAX_INVITE_TOKEN_BYTES {
        return;
    }

    // Everything under ONE lock: only accept while discoverable, only under the pending-
    // invite cap (DoS bound), and only ONCE per nonce (single-use anti-replay). The
    // channel is minted first so the whole admission decides in a single critical section.
    let (tx, rx) = channel::<Response>();
    let exchange_id = gen_token(12);
    {
        let Ok(mut st) = state().lock() else { return };
        // Fail closed if not advertising or the pending-invite cap is reached (DoS bound).
        if !st.can_admit_invite() {
            return;
        }
        if !st.accept_nonce(&nonce) {
            return; // a replayed invite frame - drop it silently
        }
        // The peer's name is unknown here (the invite frame carries only the token -
        // identity is chosen on the peer's advert, which we don't correlate to this
        // socket). The ceremony's accept card shows the token's own name; "Someone" is
        // the honest placeholder until the pair is live.
        st.invites.push(PendingInvite {
            exchange_id: exchange_id.clone(),
            from_name: "Someone".to_string(),
            token,
            respond: tx,
        });
    }

    let outcome = rx.recv_timeout(INVITE_DECISION_TIMEOUT);
    // Whatever happened, this invite is no longer pending.
    if let Ok(mut st) = state().lock() {
        st.invites.retain(|i| i.exchange_id != exchange_id);
    }
    match outcome {
        Ok(Response::Reply(reply)) => {
            let _ = write_frame(&mut stream, &encode_reply(&reply));
        }
        Ok(Response::Decline) => {
            let _ = write_frame(&mut stream, &encode_decline());
        }
        Err(_) => { /* timed out - dropping the stream signals the initiator */ }
    }
}

/// Connect to a peer, send our invite, and read their reply. Blocking.
fn exchange_blocking(addr: std::net::IpAddr, port: u16, token: &str) -> Result<String, String> {
    let sock = std::net::SocketAddr::new(addr, port);
    let mut stream = TcpStream::connect_timeout(&sock, CONNECT_TIMEOUT)
        .map_err(|_| "Could not reach that device. It may have gone away.".to_string())?;
    stream
        .set_read_timeout(Some(INVITE_DECISION_TIMEOUT))
        .map_err(|e| format!("{e}"))?;
    // Mint a fresh single-use nonce + expiry for this invite (plans/110 section 5).
    let exp = now_ms() + INVITE_TTL_MS;
    let nonce = gen_token(16);
    write_frame(&mut stream, &encode_invite(token, exp, &nonce))
        .map_err(|_| "Could not send the invite.".to_string())?;
    let bytes = read_frame(&mut stream)
        .map_err(|_| "No answer from that device.".to_string())?;
    match parse_message(&bytes)? {
        Message::Reply(t) => Ok(t),
        Message::Decline => Err("They declined.".into()),
        Message::Invite { .. } => Err("That device answered with the wrong message.".into()),
    }
}

// ── pure wire helpers (unit tested) ──────────────────────────────────────────

/// The messages that cross an invite exchange. Nothing else is a valid frame. An invite
/// carries an expiry (`exp`, epoch ms) and a single-use `nonce` (plans/110 section 5).
#[derive(Debug, PartialEq)]
enum Message {
    Invite { token: String, exp: u64, nonce: String },
    Reply(String),
    Decline,
}

/// Read one length-prefixed frame: 4-byte big-endian length (capped BEFORE the body
/// is allocated), then exactly that many bytes.
fn read_frame(stream: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).map_err(|e| format!("{e}"))?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len == 0 || len > MAX_FRAME_BYTES {
        return Err("frame length out of range".into());
    }
    let mut body = vec![0u8; len];
    stream.read_exact(&mut body).map_err(|e| format!("{e}"))?;
    Ok(body)
}

fn write_frame(stream: &mut impl Write, body: &[u8]) -> Result<(), String> {
    if body.len() > MAX_FRAME_BYTES {
        return Err("frame too large".into());
    }
    let len = (body.len() as u32).to_be_bytes();
    stream.write_all(&len).map_err(|e| format!("{e}"))?;
    stream.write_all(body).map_err(|e| format!("{e}"))?;
    stream.flush().map_err(|e| format!("{e}"))?;
    Ok(())
}

fn encode_invite(token: &str, exp: u64, nonce: &str) -> Vec<u8> {
    let mut s = String::from("{\"v\":1,\"kind\":\"invite\",\"token\":\"");
    json_escape_into(token, &mut s);
    s.push_str("\",\"exp\":");
    s.push_str(&exp.to_string());
    s.push_str(",\"nonce\":\"");
    json_escape_into(nonce, &mut s);
    s.push_str("\"}");
    s.into_bytes()
}
fn encode_reply(token: &str) -> Vec<u8> {
    encode_message("reply", Some(token))
}
fn encode_decline() -> Vec<u8> {
    encode_message("decline", None)
}

fn encode_message(kind: &str, token: Option<&str>) -> Vec<u8> {
    // Small enough to build by hand; serde_json::json! would pull the macro but this
    // is one shape. Tokens are JSON-string-escaped.
    let mut s = format!("{{\"v\":1,\"kind\":\"{kind}\"");
    if let Some(t) = token {
        s.push_str(",\"token\":\"");
        json_escape_into(t, &mut s);
        s.push('"');
    }
    s.push('}');
    s.into_bytes()
}

fn json_escape_into(s: &str, out: &mut String) {
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
}

/// Parse and validate one inbound message. Strict: version must be 1, the kind must be
/// known, and a token (present + capped) is required for invite/reply and absent-or-
/// ignored for decline.
fn parse_message(bytes: &[u8]) -> Result<Message, String> {
    if bytes.len() > MAX_FRAME_BYTES {
        return Err("message too large".into());
    }
    #[derive(serde::Deserialize)]
    struct Wire {
        v: u32,
        kind: String,
        token: Option<String>,
        exp: Option<u64>,
        nonce: Option<String>,
    }
    let w: Wire = serde_json::from_slice(bytes).map_err(|_| "unparseable message".to_string())?;
    if w.v != 1 {
        return Err("unsupported message version".into());
    }
    let token_ok = |t: Option<String>| -> Result<String, String> {
        let t = t.ok_or("missing token")?;
        if t.is_empty() || t.len() > MAX_FRAME_BYTES {
            return Err("token out of range".into());
        }
        Ok(t)
    };
    match w.kind.as_str() {
        "invite" => {
            let nonce = w.nonce.ok_or("missing nonce")?;
            if nonce.is_empty() || nonce.len() > MAX_NONCE_CHARS {
                return Err("nonce out of range".into());
            }
            Ok(Message::Invite {
                token: token_ok(w.token)?,
                exp: w.exp.ok_or("missing exp")?,
                nonce,
            })
        }
        "reply" => Ok(Message::Reply(token_ok(w.token)?)),
        "decline" => Ok(Message::Decline),
        _ => Err("unknown message kind".into()),
    }
}

/// TXT properties for our advert. `v` protocol version, `n` chosen name, `k` kind.
fn txt_props(name: &str, transport_port: u16) -> Vec<(String, String)> {
    vec![
        ("v".to_string(), "1".to_string()),
        ("n".to_string(), clamp_name(name)),
        ("k".to_string(), "d".to_string()),
        // The native-transport listener port (plans/110 section 4), so a peer can open the
        // Noise socket after discovering us. 0 ⇒ no native transport offered.
        ("t".to_string(), transport_port.to_string()),
    ]
}

/// Resolve a discovered peer to its native-transport address, for native_connect. Returns
/// None if the peer is gone or advertises no transport port (`t` = 0). The address came
/// from an mDNS advert; `native_transport::connect` additionally requires it be private.
pub fn resolve_transport(peer_id: &str) -> Option<(std::net::IpAddr, u16)> {
    let st = state().lock().ok()?;
    let p = st.peers.get(peer_id)?;
    if p.transport_port == 0 {
        return None;
    }
    Some((p.addr, p.transport_port))
}

fn clamp_name(name: &str) -> String {
    name.trim().chars().take(NAME_CAP).collect()
}

/// A random instance label, rotated every window so it is not a tracking beacon. Not a
/// security token - just an unpredictable-enough DNS-SD instance name - so it is mixed
/// from the wall clock + a monotonic counter rather than a crypto RNG.
fn gen_instance_name() -> String {
    format!("lolly-{}", gen_token(10))
}

fn gen_token(chars: usize) -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    const ALPHABET: &[u8; 32] = b"abcdefghijklmnopqrstuvwxyz234567";
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let seed = nanos ^ (COUNTER.fetch_add(0x9E37_79B9_7F4A_7C15, Ordering::Relaxed));
    // A small xorshift walk over the seed gives a spread of base32 chars.
    let mut x = seed | 1;
    let mut out = String::with_capacity(chars);
    for _ in 0..chars {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        out.push(ALPHABET[(x % 32) as usize] as char);
    }
    out
}

/// The DNS-SD fullname for one of our own instance labels, used to unregister and to
/// skip our own advert in the browse stream.
fn full_name(instance: &str) -> String {
    format!("{instance}.{SERVICE_TYPE}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn frame_round_trips() {
        let mut buf: Vec<u8> = Vec::new();
        write_frame(&mut buf, b"hello nearby").unwrap();
        let mut cur = Cursor::new(buf);
        assert_eq!(read_frame(&mut cur).unwrap(), b"hello nearby");
    }

    #[test]
    fn frame_rejects_zero_and_oversize_length() {
        // length 0
        let mut cur = Cursor::new(vec![0, 0, 0, 0]);
        assert!(read_frame(&mut cur).is_err());
        // length just past the cap, with no body - must refuse on the length alone,
        // before trying to read the body.
        let big = (MAX_FRAME_BYTES as u32 + 1).to_be_bytes();
        let mut cur = Cursor::new(big.to_vec());
        assert!(read_frame(&mut cur).is_err());
    }

    #[test]
    fn frame_rejects_truncated_body() {
        // declares 8 bytes, provides 3
        let mut bytes = 8u32.to_be_bytes().to_vec();
        bytes.extend_from_slice(b"abc");
        let mut cur = Cursor::new(bytes);
        assert!(read_frame(&mut cur).is_err());
    }

    #[test]
    fn message_round_trips_all_kinds() {
        assert_eq!(
            parse_message(&encode_invite("tok-A", 1234, "n0nce")).unwrap(),
            Message::Invite { token: "tok-A".into(), exp: 1234, nonce: "n0nce".into() }
        );
        assert_eq!(
            parse_message(&encode_reply("tok-B")).unwrap(),
            Message::Reply("tok-B".into())
        );
        assert_eq!(parse_message(&encode_decline()).unwrap(), Message::Decline);
    }

    #[test]
    fn message_escapes_and_survives_tricky_tokens() {
        let tricky = "a\"b\\c\nd\te";
        let round = parse_message(&encode_invite(tricky, 99, "nnn")).unwrap();
        assert_eq!(round, Message::Invite { token: tricky.into(), exp: 99, nonce: "nnn".into() });
    }

    #[test]
    fn message_rejects_bad_shapes() {
        assert!(parse_message(b"not json").is_err());
        assert!(parse_message(br#"{"v":2,"kind":"invite","token":"x","exp":1,"nonce":"n"}"#).is_err()); // version
        assert!(parse_message(br#"{"v":1,"kind":"invite","exp":1,"nonce":"n"}"#).is_err()); // missing token
        assert!(parse_message(br#"{"v":1,"kind":"invite","token":"","exp":1,"nonce":"n"}"#).is_err()); // empty token
        assert!(parse_message(br#"{"v":1,"kind":"invite","token":"x","nonce":"n"}"#).is_err()); // missing exp
        assert!(parse_message(br#"{"v":1,"kind":"invite","token":"x","exp":1}"#).is_err()); // missing nonce
        assert!(parse_message(br#"{"v":1,"kind":"invite","token":"x","exp":1,"nonce":""}"#).is_err()); // empty nonce
        assert!(parse_message(br#"{"v":1,"kind":"nope","token":"x"}"#).is_err()); // unknown kind
    }

    #[test]
    fn invite_freshness_bounds_both_directions() {
        let now = 1_000_000u64;
        assert!(invite_fresh(now, now), "an invite that expires now is fresh");
        assert!(invite_fresh(now + INVITE_TTL_MS, now), "a full-TTL invite is fresh");
        assert!(!invite_fresh(now - CLOCK_SKEW_MS - 1, now), "past its expiry + skew is stale");
        assert!(
            !invite_fresh(now + INVITE_TTL_MS + 2 * CLOCK_SKEW_MS, now),
            "an absurd far-future expiry is refused (no never-expiring invite)"
        );
    }

    #[test]
    fn nonce_is_single_use() {
        let mut st = NearbyState::default();
        assert!(st.accept_nonce("abc"), "first use accepted");
        assert!(!st.accept_nonce("abc"), "a replay is refused");
        assert!(st.accept_nonce("def"), "a different nonce is accepted");
    }

    #[test]
    fn invites_are_capped_and_gated_on_advertising() {
        let mut st = NearbyState::default();
        assert!(!st.can_admit_invite(), "not advertising ⇒ no admission");
        st.advertising = true;
        assert!(st.can_admit_invite());
        // Fill to the cap with placeholder pending invites.
        for i in 0..MAX_PENDING_INVITES {
            let (tx, _rx) = channel::<Response>();
            st.invites.push(PendingInvite {
                exchange_id: format!("x{i}"),
                from_name: "n".into(),
                token: "t".into(),
                respond: tx,
            });
        }
        assert!(!st.can_admit_invite(), "at the cap ⇒ fail closed");
        assert_eq!(st.invites.len(), MAX_PENDING_INVITES);
        assert!(MAX_INVITE_TOKEN_BYTES < MAX_FRAME_BYTES, "invite token ceiling is well below the frame cap");
    }

    #[test]
    fn nonce_ring_is_bounded() {
        let mut st = NearbyState::default();
        for i in 0..(MAX_SEEN_NONCES + 10) {
            assert!(st.accept_nonce(&format!("n{i}")));
        }
        assert!(st.seen_nonces.len() <= MAX_SEEN_NONCES, "the ring never grows past its cap");
    }

    #[test]
    fn name_is_clamped_and_trimmed() {
        assert_eq!(clamp_name("  Andy  "), "Andy");
        let long: String = "x".repeat(100);
        assert_eq!(clamp_name(&long).chars().count(), NAME_CAP);
    }

    #[test]
    fn txt_props_carry_v_n_k_t() {
        let props = txt_props("Priya", 5555);
        let keys: Vec<&str> = props.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(keys, vec!["v", "n", "k", "t"]);
        assert_eq!(props[1].1, "Priya");
        assert_eq!(props[3].1, "5555", "the transport port rides TXT t");
    }

    #[test]
    fn instance_names_rotate_and_are_well_formed() {
        let a = gen_instance_name();
        let b = gen_instance_name();
        assert!(a.starts_with("lolly-"));
        assert_eq!(a.len(), "lolly-".len() + 10);
        assert_ne!(a, b, "two consecutive names must differ");
        assert!(a[6..].bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
    }
}
