//! Native LAN socket transport - the Noise-over-TCP collab transport (plans/110 section 4,
//! `plans/110-work/n2-design.md`), for the case WebRTC is absent (Linux webkitgtk) or a
//! power user forces LAN. All seven commands (`native_connect`, `native_send`,
//! `native_recv`, `native_plate`, `native_close`, `native_poll_inbound`, `native_adopt`)
//! are registered in `lib.rs`'s invoke handler and called from the JS side in
//! `shells/web/src/collab/native-transport.ts`.
//!
//! `#![allow(dead_code)]` below is NOT about unregistered commands (there are none) - it
//! covers a handful of building-block functions (`build_initiator`, `build_responder`,
//! `read_frame`, `NativeSession::send`/`recv`) that only this module's own tests call
//! directly. Production code reaches the same logic through `session_send`/`session_recv`,
//! which hold the session-table lock these methods do not. Verified 2026-09-05: removing
//! the attribute and running `cargo check --lib` produces exactly those four warnings.
//!
//! SECURITY DECISIONS BAKED IN (Andy, 2026-08-13):
//!   • The socket-open is **nearby-only + private-range**. `is_private_addr` is the
//!     gate: the transport connects ONLY to an address discovered via mDNS (never an
//!     attacker-authored token - the QR native-invite path was removed) AND only when
//!     that address is private/link-local/loopback. A discovered address outside those
//!     ranges is refused, so a poisoned advert cannot point the socket at a public or
//!     internal-service host.
//!   • Invite **expiry + single-use nonce** live on the nearby invite exchange
//!     (`nearby.rs`), not here - this module is reached only after that exchange.
//!
//! CRYPTO: Noise `XX_25519_ChaChaPoly_BLAKE2s` via `snow` (pure-Rust resolver, no C dep,
//! so it cross-compiles to Linux/Windows/macOS and later the Android NDK unchanged).
//!   • Per-connection ephemeral static keypair - never persisted; the pairing IS the
//!     trust event, exactly like the per-session DTLS cert on the WebRTC path.
//!   • The SAS plate is derived on the JS side from the handshake hash `h`
//!     (`derivePlateFromTranscript`, plate.ts) and `handshake_hash()` surfaces `h`.
//!     IMPORTANT (review finding #1): a bare XX handshake hash is NOT a safe SAS input -
//!     the initiator picks its static key in the last message, so a MITM could grind it to
//!     force a matching 6-char plate (~2^29 work). The STATIC-KEY COMMITMENT in
//!     `run_initiator`/`run_responder` removes that freedom (the initiator is bound to its
//!     static before it sees the peer's ephemeral), which is what makes equal plates mean
//!     one unbroken handshake here. Do not remove the commitment.
//!
//! FRAME GRAMMAR (post-handshake): `u32 BE length || ciphertext`, where the ciphertext is
//! the Noise transport message over `lane_byte || plaintext`. The lane is the FIRST byte
//! of the ENCRYPTED payload - inside the AEAD, so a network attacker can neither read it
//! nor flip a frame from one lane to another (stronger than a cleartext lane prefix, and
//! what `snow`'s transport API supports without exposing associated data).

#![allow(dead_code)] // test-only helpers; see the module doc comment above.

use std::io::{Read, Write};
use std::net::IpAddr;

use snow::{Builder, HandshakeState, TransportState};

/// The one Noise suite; no negotiation (an unparseable handshake is a teardown).
const NOISE_PARAMS: &str = "Noise_XX_25519_ChaChaPoly_BLAKE2s";
/// Ciphertext frame ceiling: a 64 KiB beam chunk + the lane byte + AEAD tag + slack.
const MAX_FRAME_BYTES: usize = 80 * 1024;
/// A handshake message is small; anything larger is hostile and a teardown.
const MAX_HANDSHAKE_BYTES: usize = 4 * 1024;

/// The three lanes the transport carries - the same set the RTC transport exposes
/// (`rtc-transport.ts` `LANES`). Byte value rides inside the encrypted payload.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lane {
    Ops = 1,
    Presence = 2,
    Beam = 3,
}

impl Lane {
    fn from_byte(b: u8) -> Option<Lane> {
        match b {
            1 => Some(Lane::Ops),
            2 => Some(Lane::Presence),
            3 => Some(Lane::Beam),
            _ => None, // 0 reserved; unknown ⇒ caller drops the frame
        }
    }
}

// ── address policy: nearby-only is enforced by the caller (only a discovered address is
//    ever passed here); this is the private-range half of the decision ────────────────

/// May the transport open a socket to this address? Private, link-local, loopback and
/// IPv6 unique-local only. A discovered address outside these is refused - a poisoned
/// mDNS advert cannot aim the connect at a public or internal-service host.
pub fn is_private_addr(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_private()            // 10/8, 172.16/12, 192.168/16
                || v4.is_loopback()    // 127/8
                || v4.is_link_local()  // 169.254/16
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()                       // ::1
                || (v6.segments()[0] & 0xffc0) == 0xfe80 // fe80::/10 link-local
                || (v6.segments()[0] & 0xfe00) == 0xfc00 // fc00::/7 unique-local
        }
    }
}

// ── handshake ────────────────────────────────────────────────────────────────────────

/// Build an XX initiator with a fresh ephemeral static key.
pub fn build_initiator() -> Result<HandshakeState, String> {
    let builder = Builder::new(NOISE_PARAMS.parse().map_err(|e| format!("noise params: {e}"))?);
    let keypair = builder.generate_keypair().map_err(|e| format!("noise keypair: {e}"))?;
    Builder::new(NOISE_PARAMS.parse().map_err(|e| format!("noise params: {e}"))?)
        .local_private_key(&keypair.private)
        .build_initiator()
        .map_err(|e| format!("noise initiator: {e}"))
}

/// Build an XX responder with a fresh ephemeral static key.
pub fn build_responder() -> Result<HandshakeState, String> {
    let builder = Builder::new(NOISE_PARAMS.parse().map_err(|e| format!("noise params: {e}"))?);
    let keypair = builder.generate_keypair().map_err(|e| format!("noise keypair: {e}"))?;
    Builder::new(NOISE_PARAMS.parse().map_err(|e| format!("noise params: {e}"))?)
        .local_private_key(&keypair.private)
        .build_responder()
        .map_err(|e| format!("noise responder: {e}"))
}

/// The handshake hash `h` after the handshake completes - the SAS plate's input. Both
/// peers compute the same value; a MITM's two legs diverge.
pub fn handshake_hash(hs: &HandshakeState) -> Vec<u8> {
    hs.get_handshake_hash().to_vec()
}

/// Read one handshake message (length-prefixed, capped) from the stream into `buf`.
fn read_handshake_frame(stream: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut len = [0u8; 4];
    stream.read_exact(&mut len).map_err(|e| format!("{e}"))?;
    let n = u32::from_be_bytes(len) as usize;
    if n == 0 || n > MAX_HANDSHAKE_BYTES {
        return Err("handshake frame length out of range".into());
    }
    let mut body = vec![0u8; n];
    stream.read_exact(&mut body).map_err(|e| format!("{e}"))?;
    Ok(body)
}

fn write_len_prefixed(stream: &mut impl Write, body: &[u8]) -> Result<(), String> {
    stream.write_all(&(body.len() as u32).to_be_bytes()).map_err(|e| format!("{e}"))?;
    stream.write_all(body).map_err(|e| format!("{e}"))?;
    stream.flush().map_err(|e| format!("{e}"))?;
    Ok(())
}

// ── framed transport (post-handshake) ─────────────────────────────────────────────────

/// Encrypt one application frame: `u32 BE length || Noise(lane || plaintext)`.
pub fn encode_frame(tx: &mut TransportState, lane: Lane, plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let mut inner = Vec::with_capacity(plaintext.len() + 1);
    inner.push(lane as u8);
    inner.extend_from_slice(plaintext);
    let mut ct = vec![0u8; inner.len() + 16]; // + ChaChaPoly tag
    let n = tx.write_message(&inner, &mut ct).map_err(|e| format!("noise encrypt: {e}"))?;
    ct.truncate(n);
    if ct.len() > MAX_FRAME_BYTES {
        return Err("frame exceeds cap".into());
    }
    let mut out = Vec::with_capacity(4 + ct.len());
    out.extend_from_slice(&(ct.len() as u32).to_be_bytes());
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Read one raw ciphertext frame off the stream (`u32 BE length || ciphertext`), capped
/// before allocation. Split from the decrypt so a reader thread can block on the SOCKET
/// without holding the transport-state lock (see the session registry).
fn read_raw_frame(stream: &mut impl Read) -> Result<Vec<u8>, String> {
    let mut len = [0u8; 4];
    stream.read_exact(&mut len).map_err(|e| format!("{e}"))?;
    let n = u32::from_be_bytes(len) as usize;
    if n == 0 || n > MAX_FRAME_BYTES {
        return Err("frame length out of range".into());
    }
    let mut ct = vec![0u8; n];
    stream.read_exact(&mut ct).map_err(|e| format!("{e}"))?;
    Ok(ct)
}

/// Decrypt one ciphertext frame. A first plaintext byte that is not a known lane is a
/// protocol violation (teardown), never a silently mis-routed frame.
fn decrypt_frame(tx: &mut TransportState, ct: &[u8]) -> Result<(Lane, Vec<u8>), String> {
    let mut pt = vec![0u8; ct.len()]; // plaintext is shorter than ciphertext; a safe bound
    let m = tx.read_message(ct, &mut pt).map_err(|e| format!("noise decrypt: {e}"))?;
    pt.truncate(m);
    let lane = pt.first().copied().and_then(Lane::from_byte).ok_or("unknown lane byte")?;
    Ok((lane, pt[1..].to_vec()))
}

/// Read + decrypt one application frame from the stream. Returns the lane and plaintext.
pub fn read_frame(stream: &mut impl Read, tx: &mut TransportState) -> Result<(Lane, Vec<u8>), String> {
    let ct = read_raw_frame(stream)?;
    decrypt_frame(tx, &ct)
}

// ── the connection lifecycle: connect / accept + a live framed session ────────────────

use std::net::{SocketAddr, TcpListener, TcpStream};
use std::time::Duration;

/// Connect timeout for the transport socket (matches the invite exchange).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
/// X25519 static public key length - the size of the initiator's up-front commitment.
const STATIC_KEY_LEN: usize = 32;
/// Bound on a single handshake exchange, so a stalled peer cannot pin the connect.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);

/// A live native transport: the socket, the AEAD transport state, and the handshake hash
/// `h` the plate is derived from. `send`/`recv` frame one lane message each.
pub struct NativeSession {
    stream: TcpStream,
    tx: TransportState,
    handshake_hash: Vec<u8>,
}

impl NativeSession {
    /// The handshake hash `h` - the SAS plate's input (both peers hold the same value).
    pub fn handshake_hash(&self) -> &[u8] {
        &self.handshake_hash
    }

    pub fn send(&mut self, lane: Lane, plaintext: &[u8]) -> Result<(), String> {
        let framed = encode_frame(&mut self.tx, lane, plaintext)?;
        write_len_prefixed_raw(&mut self.stream, &framed)
    }

    pub fn recv(&mut self) -> Result<(Lane, Vec<u8>), String> {
        read_frame(&mut self.stream, &mut self.tx)
    }
}

/// `encode_frame` already length-prefixes its output; write it straight to the socket.
fn write_len_prefixed_raw(stream: &mut TcpStream, framed: &[u8]) -> Result<(), String> {
    stream.write_all(framed).map_err(|e| format!("{e}"))?;
    stream.flush().map_err(|e| format!("{e}"))
}

fn noise_params() -> Result<snow::params::NoiseParams, String> {
    NOISE_PARAMS.parse().map_err(|e| format!("noise params: {e}"))
}

/// Run the XX handshake as the initiator over an established stream, then return a live
/// session. The three XX messages are length-prefixed like everything else on the wire.
///
/// STATIC-KEY COMMITMENT (review finding #1). Plain XX lets the initiator choose its static
/// key in the LAST message, after seeing the responder's ephemeral - so a MITM could grind
/// that static offline to force a matching 6-char SAS plate (~2^29 work, feasible in the
/// handshake window). We remove that freedom: send our per-connection static PUBLIC key
/// FIRST, before the handshake, and bind it into the transcript as the Noise prologue. We
/// are now committed to it before we ever see the responder's ephemeral, so there is nothing
/// left to grind; the responder verifies the handshake's authenticated static equals what we
/// committed. The static is a fresh per-connection key (no long-term identity), so sending it
/// early leaks nothing linkable.
fn run_initiator(mut stream: TcpStream) -> Result<NativeSession, String> {
    stream.set_read_timeout(Some(HANDSHAKE_TIMEOUT)).map_err(|e| format!("{e}"))?;
    let kp = Builder::new(noise_params()?).generate_keypair().map_err(|e| format!("keypair: {e}"))?;
    // Commit: send our static public key up front and bind it as the prologue.
    write_len_prefixed(&mut stream, &kp.public)?;
    let mut hs = Builder::new(noise_params()?)
        .prologue(&kp.public)
        .local_private_key(&kp.private)
        .build_initiator()
        .map_err(|e| format!("initiator: {e}"))?;
    let mut buf = [0u8; 1024];

    // -> e
    let n = hs.write_message(&[], &mut buf).map_err(|e| format!("hs1: {e}"))?;
    write_len_prefixed(&mut stream, &buf[..n])?;
    // <- e, ee, s, es
    let msg = read_handshake_frame(&mut stream)?;
    hs.read_message(&msg, &mut buf).map_err(|e| format!("hs2: {e}"))?;
    // -> s, se
    let n = hs.write_message(&[], &mut buf).map_err(|e| format!("hs3: {e}"))?;
    write_len_prefixed(&mut stream, &buf[..n])?;

    finish_session(stream, hs)
}

/// Run the XX handshake as the responder over an accepted stream, verifying the initiator's
/// up-front static-key commitment (see `run_initiator`).
fn run_responder(mut stream: TcpStream) -> Result<NativeSession, String> {
    stream.set_read_timeout(Some(HANDSHAKE_TIMEOUT)).map_err(|e| format!("{e}"))?;
    // Read the initiator's committed static public key first, and bind it as the prologue -
    // a tampered commitment then yields a different transcript hash and the handshake fails.
    let committed = read_handshake_frame(&mut stream)?;
    if committed.len() != STATIC_KEY_LEN {
        return Err("invalid static commitment".into());
    }
    let kp = Builder::new(noise_params()?).generate_keypair().map_err(|e| format!("keypair: {e}"))?;
    let mut hs = Builder::new(noise_params()?)
        .prologue(&committed)
        .local_private_key(&kp.private)
        .build_responder()
        .map_err(|e| format!("responder: {e}"))?;
    let mut buf = [0u8; 1024];

    // <- e
    let msg = read_handshake_frame(&mut stream)?;
    hs.read_message(&msg, &mut buf).map_err(|e| format!("hs1: {e}"))?;
    // -> e, ee, s, es
    let n = hs.write_message(&[], &mut buf).map_err(|e| format!("hs2: {e}"))?;
    write_len_prefixed(&mut stream, &buf[..n])?;
    // <- s, se
    let msg = read_handshake_frame(&mut stream)?;
    hs.read_message(&msg, &mut buf).map_err(|e| format!("hs3: {e}"))?;

    // Verify the handshake-authenticated initiator static equals the up-front commitment.
    // A MITM that committed one static then used another to grind a matching plate fails here.
    let remote = hs.get_remote_static().ok_or("no remote static after handshake")?;
    if remote != committed.as_slice() {
        return Err("static commitment mismatch".into());
    }

    finish_session(stream, hs)
}

fn finish_session(stream: TcpStream, hs: HandshakeState) -> Result<NativeSession, String> {
    let handshake_hash = handshake_hash(&hs);
    let tx = hs.into_transport_mode().map_err(|e| format!("transport mode: {e}"))?;
    Ok(NativeSession { stream, tx, handshake_hash })
}

/// Connect to a discovered peer and complete the handshake. **The socket-open is gated on
/// `is_private_addr`** (plans/110 section 5, Andy 2026-08-13): the address comes from an mDNS
/// advert, and must additionally be private/link-local/loopback, so a poisoned advert can
/// never aim the connect at a public or internal-service host.
pub fn connect(addr: IpAddr, port: u16) -> Result<NativeSession, String> {
    if !is_private_addr(addr) {
        return Err("refusing to connect to a non-private address".into());
    }
    let sock = SocketAddr::new(addr, port);
    let stream = TcpStream::connect_timeout(&sock, CONNECT_TIMEOUT)
        .map_err(|_| "could not reach that device".to_string())?;
    run_initiator(stream)
}

/// Complete the handshake on an accepted inbound stream (the responder side).
pub fn accept(stream: TcpStream) -> Result<NativeSession, String> {
    run_responder(stream)
}

// ── the session registry: live sessions reachable from JS over poll-based commands ────
//
// A registered session runs a READER THREAD that blocks on the socket and drains decrypted
// frames into an inbox the JS side polls (the nearby.rs pattern). The concurrency rules
// that keep it deadlock-free:
//   • the reader blocks on the SOCKET, never on the transport-state lock - it reads raw
//     ciphertext first (no lock), then takes the lock only to decrypt (`read_raw_frame` +
//     `decrypt_frame` are split for exactly this);
//   • every op clones the Arcs it needs out from under the registry lock and RELEASES the
//     registry lock before any socket I/O, so a blocking send never stalls other sessions.

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};

/// Reliable-lane (ops+beam) inbox depth at which the reader STOPS reading the socket and
/// waits - so TCP flow-control backpressures the sender rather than us silently dropping a
/// reliable frame (review finding #3). Bounds memory too.
const MAX_INBOX_RELIABLE: usize = 1024;
/// Presence is lossy/unordered; past this the OLDEST presence frame is dropped (never a
/// reliable one).
const MAX_INBOX_LOSSY: usize = 256;
/// Cap on concurrent live sessions so an attacker completing unauthenticated handshakes on
/// the transport listener cannot grow the registry + reader threads without bound (#5).
const MAX_SESSIONS: usize = 64;
/// An INBOUND session the local JS never adopts (an attacker's, or an abandoned pairing) is
/// reaped this long after it was accepted. A real pairing is adopted within the ceremony,
/// far sooner; an idle-but-adopted session is never reaped (a quiet collab is legitimate).
const ADOPT_TIMEOUT_MS: u64 = 30_000;
/// A blocked write cannot hang unbounded (paired with close's socket shutdown).
const WRITE_TIMEOUT: Duration = Duration::from_secs(20);

/// Two lanes' worth of pending inbound frames. Reliable (ops/beam) is never dropped -
/// backpressured; lossy (presence) is drop-oldest.
#[derive(Default)]
struct Inbox {
    reliable: VecDeque<(Lane, Vec<u8>)>,
    lossy: VecDeque<Vec<u8>>,
}

struct SessionEntry {
    tx: Arc<Mutex<TransportState>>,
    write: Arc<Mutex<TcpStream>>,
    /// A dedicated socket handle for close(): `shutdown(&self)` needs no lock, so close can
    /// unblock a reader (or a stalled write) WITHOUT contending the write Mutex (#2).
    shutdown_handle: TcpStream,
    inbox: Arc<(Mutex<Inbox>, Condvar)>,
    alive: Arc<AtomicBool>,
    handshake_hash: Vec<u8>,
    /// False for an inbound (listener) session until JS adopts it; true for an outbound
    /// (native_connect) session from birth. Unadopted + stale ⇒ reaped.
    adopted: bool,
    created_ms: u64,
}

fn registry() -> &'static Mutex<HashMap<String, SessionEntry>> {
    static REG: OnceLock<Mutex<HashMap<String, SessionEntry>>> = OnceLock::new();
    REG.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn new_session_id() -> String {
    static N: AtomicU64 = AtomicU64::new(0);
    format!("ns-{:x}-{:x}", now_ms(), N.fetch_add(1, Ordering::Relaxed))
}

/// Register a live session, spawn its reader thread, and return the session id JS uses.
/// `adopted` is true for an outbound session (native_connect returns the id straight to JS)
/// and false for an inbound one (the listener; JS learns it via native_poll_inbound + adopts).
pub fn register(session: NativeSession, adopted: bool) -> Result<String, String> {
    let mut read_half = session.stream.try_clone().map_err(|e| format!("clone stream: {e}"))?;
    read_half.set_read_timeout(None).ok(); // the reader blocks on frames; close unblocks it
    let shutdown_handle = session.stream.try_clone().map_err(|e| format!("clone stream: {e}"))?;
    session.stream.set_write_timeout(Some(WRITE_TIMEOUT)).ok();

    let tx = Arc::new(Mutex::new(session.tx));
    let write = Arc::new(Mutex::new(session.stream));
    let inbox: Arc<(Mutex<Inbox>, Condvar)> = Arc::new((Mutex::new(Inbox::default()), Condvar::new()));
    let alive = Arc::new(AtomicBool::new(true));

    {
        let tx = Arc::clone(&tx);
        let inbox = Arc::clone(&inbox);
        let alive = Arc::clone(&alive);
        std::thread::spawn(move || {
            let (lock, cvar) = &*inbox;
            while alive.load(Ordering::Relaxed) {
                // Block on the socket WITHOUT the tx lock.
                let ct = match read_raw_frame(&mut read_half) {
                    Ok(c) => c,
                    Err(_) => break, // EOF / closed / peer gone
                };
                let (lane, payload) = match tx.lock() {
                    Ok(mut t) => match decrypt_frame(&mut t, &ct) {
                        Ok(f) => f,
                        Err(_) => break, // AEAD failure = teardown
                    },
                    Err(_) => break,
                };
                let Ok(mut ib) = lock.lock() else { break };
                if lane == Lane::Presence {
                    if ib.lossy.len() >= MAX_INBOX_LOSSY {
                        ib.lossy.pop_front();
                    }
                    ib.lossy.push_back(payload);
                } else {
                    // Reliable: WAIT for room rather than drop (backpressure → TCP throttles
                    // the sender). The condvar wait releases the lock, so session_recv can
                    // drain and notify; the timeout lets us re-check `alive` for close.
                    while ib.reliable.len() >= MAX_INBOX_RELIABLE && alive.load(Ordering::Relaxed) {
                        ib = match cvar.wait_timeout(ib, Duration::from_millis(250)) {
                            Ok((g, _)) => g,
                            Err(_) => return,
                        };
                    }
                    if !alive.load(Ordering::Relaxed) {
                        break;
                    }
                    ib.reliable.push_back((lane, payload));
                }
            }
            alive.store(false, Ordering::Relaxed);
        });
    }

    let id = new_session_id();
    let mut reg = registry().lock().map_err(|_| "registry poisoned".to_string())?;
    if reg.len() >= MAX_SESSIONS {
        // Fail closed. `session`'s stream drops here, closing the socket and ending the
        // reader we just spawned (its next read errors).
        alive.store(false, Ordering::Relaxed);
        let _ = shutdown_handle.shutdown(std::net::Shutdown::Both);
        return Err("too many native sessions".into());
    }
    reg.insert(
        id.clone(),
        SessionEntry {
            tx,
            write,
            shutdown_handle,
            inbox,
            alive,
            handshake_hash: session.handshake_hash,
            adopted,
            created_ms: now_ms(),
        },
    );
    Ok(id)
}

/// Grab the Arcs a session op needs, releasing the registry lock immediately.
fn session_arcs(id: &str) -> Result<(Arc<Mutex<TransportState>>, Arc<Mutex<TcpStream>>, Arc<AtomicBool>), String> {
    let reg = registry().lock().map_err(|_| "registry poisoned".to_string())?;
    let e = reg.get(id).ok_or("no such session")?;
    Ok((Arc::clone(&e.tx), Arc::clone(&e.write), Arc::clone(&e.alive)))
}

pub fn session_send(id: &str, lane: Lane, plaintext: &[u8]) -> Result<(), String> {
    let (tx, write, alive) = session_arcs(id)?; // registry lock already released
    if !alive.load(Ordering::Relaxed) {
        return Err("session closed".into());
    }
    let framed = {
        let mut t = tx.lock().map_err(|_| "tx poisoned".to_string())?;
        encode_frame(&mut t, lane, plaintext)?
    };
    let mut w = write.lock().map_err(|_| "write poisoned".to_string())?;
    write_len_prefixed_raw(&mut w, &framed)
}

pub fn session_recv(id: &str) -> Result<Vec<(Lane, Vec<u8>)>, String> {
    let inbox = {
        let reg = registry().lock().map_err(|_| "registry poisoned".to_string())?;
        Arc::clone(&reg.get(id).ok_or("no such session")?.inbox)
    };
    let (lock, cvar) = &*inbox;
    let out = {
        let mut ib = lock.lock().map_err(|_| "inbox poisoned".to_string())?;
        // Reliable frames first, in arrival order (per-lane order preserved); then the
        // lossy presence frames.
        let mut out: Vec<(Lane, Vec<u8>)> = ib.reliable.drain(..).collect();
        out.extend(ib.lossy.drain(..).map(|p| (Lane::Presence, p)));
        out
    };
    // Wake a reader that was blocked because the reliable queue was full.
    cvar.notify_all();
    Ok(out)
}

/// The handshake hash `h` for a session - the plate input (`derivePlateFromTranscript`).
pub fn session_plate(id: &str) -> Option<Vec<u8>> {
    registry().lock().ok()?.get(id).map(|e| e.handshake_hash.clone())
}

/// Shut a removed entry down OUTSIDE the registry lock: mark dead, shutdown the socket via
/// the dedicated handle (no write-lock contention), and wake any condvar-blocked reader.
fn teardown(entry: &SessionEntry) {
    entry.alive.store(false, Ordering::Relaxed);
    let _ = entry.shutdown_handle.shutdown(std::net::Shutdown::Both);
    let (_lock, cvar) = &*entry.inbox;
    cvar.notify_all();
}

pub fn session_close(id: &str) {
    // Remove under the registry lock, then act on the removed entry with the lock RELEASED,
    // so close never blocks on (or holds) a per-session lock while holding the registry lock
    // - a single stalled peer can no longer wedge every session (#2).
    let entry = match registry().lock() {
        Ok(mut reg) => reg.remove(id),
        Err(_) => return,
    };
    if let Some(entry) = entry {
        teardown(&entry);
    }
}

/// Mark an inbound session adopted, so the reaper leaves it alone (JS claims its pairing).
pub fn adopt_session(id: &str) -> bool {
    match registry().lock() {
        Ok(mut reg) => match reg.get_mut(id) {
            Some(e) => { e.adopted = true; true }
            None => false,
        },
        Err(_) => false,
    }
}

/// Drop unadopted inbound sessions older than ADOPT_TIMEOUT_MS (an attacker's, or an
/// abandoned pairing). Shutdown happens outside the registry lock.
fn reap_unadopted() {
    let now = now_ms();
    let stale: Vec<SessionEntry> = {
        let Ok(mut reg) = registry().lock() else { return };
        let ids: Vec<String> = reg
            .iter()
            .filter(|(_, e)| !e.adopted && now.saturating_sub(e.created_ms) > ADOPT_TIMEOUT_MS)
            .map(|(id, _)| id.clone())
            .collect();
        ids.into_iter().filter_map(|id| reg.remove(&id)).collect()
    };
    for e in &stale {
        teardown(e);
    }
}

/// Unadopted inbound sessions (id + plate hash) the local JS may claim. Reaps stale ones
/// each call (JS polls this during a ceremony).
fn list_unadopted() -> Vec<(String, Vec<u8>)> {
    reap_unadopted();
    let Ok(reg) = registry().lock() else { return Vec::new() };
    reg.iter()
        .filter(|(_, e)| !e.adopted)
        .map(|(id, e)| (id.clone(), e.handshake_hash.clone()))
        .collect()
}

// ── the responder listener ────────────────────────────────────────────────────────────
//
// Binds its own TCP port (advertised in the nearby TXT as `t`), and registers each
// inbound pairing as a session. Runs only while nearby advertising is up.

fn transport_listener() -> &'static Mutex<Option<u16>> {
    static PORT: OnceLock<Mutex<Option<u16>>> = OnceLock::new();
    PORT.get_or_init(|| Mutex::new(None))
}

/// Start the transport listener if it is not already up; returns its port to advertise.
pub fn ensure_transport_listener() -> Result<u16, String> {
    let mut slot = transport_listener().lock().map_err(|_| "listener state poisoned".to_string())?;
    if let Some(p) = *slot {
        return Ok(p);
    }
    let listener = TcpListener::bind(("0.0.0.0", 0)).map_err(|e| format!("bind transport port: {e}"))?;
    let port = listener.local_addr().map_err(|e| format!("{e}"))?.port();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            // One short-lived thread per pairing: handshake (responder) then register.
            std::thread::spawn(move || {
                if let Ok(session) = accept(stream) {
                    // Inbound ⇒ unadopted: JS learns of it via native_poll_inbound and
                    // adopts the one matching the ceremony; unclaimed ones are reaped (#5).
                    let _ = register(session, false);
                }
            });
        }
    });
    *slot = Some(port);
    Ok(port)
}

// ── base64 for the JS↔Rust command boundary (bytes ride as strings, like site_fetch) ──

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for c in bytes.chunks(3) {
        let n = (u32::from(c[0]) << 16)
            | (u32::from(*c.get(1).unwrap_or(&0)) << 8)
            | u32::from(*c.get(2).unwrap_or(&0));
        out.push(B64[(n >> 18 & 63) as usize] as char);
        out.push(B64[(n >> 12 & 63) as usize] as char);
        out.push(if c.len() > 1 { B64[(n >> 6 & 63) as usize] as char } else { '=' });
        out.push(if c.len() > 2 { B64[(n & 63) as usize] as char } else { '=' });
    }
    out
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    let val = |c: u8| -> Option<u32> {
        match c {
            b'A'..=b'Z' => Some((c - b'A') as u32),
            b'a'..=b'z' => Some((c - b'a' + 26) as u32),
            b'0'..=b'9' => Some((c - b'0' + 52) as u32),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    };
    let clean: Vec<u8> = s.bytes().filter(|&c| c != b'=' && !c.is_ascii_whitespace()).collect();
    let mut out = Vec::with_capacity(clean.len() / 4 * 3);
    for chunk in clean.chunks(4) {
        let mut n = 0u32;
        let mut bits = 0;
        for &c in chunk {
            n = (n << 6) | val(c).ok_or("invalid base64")?;
            bits += 6;
        }
        // Emit the whole bytes this chunk produced (2 chars→1 byte, 3→2, 4→3).
        let bytes = bits / 8;
        n <<= 24 - bits; // left-align
        for i in 0..bytes {
            out.push((n >> (16 - i * 8)) as u8);
        }
    }
    Ok(out)
}

// ── Tauri commands (the JS native transport driver drives these, poll-based) ──────────

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeConnected {
    session_id: String,
    /// The handshake hash `h`, hex - the JS side feeds it to derivePlateFromTranscript.
    plate_hex: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFrame {
    /// 'ops' | 'presence' | 'beam'
    lane: &'static str,
    /// base64 of the plaintext.
    data: String,
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn lane_name(lane: Lane) -> &'static str {
    match lane {
        Lane::Ops => "ops",
        Lane::Presence => "presence",
        Lane::Beam => "beam",
    }
}

fn lane_from_name(name: &str) -> Result<Lane, String> {
    match name {
        "ops" => Ok(Lane::Ops),
        "presence" => Ok(Lane::Presence),
        "beam" => Ok(Lane::Beam),
        _ => Err("unknown lane".into()),
    }
}

/// Connect to a nearby-discovered peer over the native transport and complete the
/// handshake. `peer_id` is resolved to an address by the nearby module (an mDNS-discovered
/// address, private-range checked inside `connect`). Returns the session id + plate input.
#[tauri::command]
pub fn native_connect(peer_id: String) -> Result<NativeConnected, String> {
    let (addr, port) = crate::nearby::resolve_transport(&peer_id).ok_or("that device is not nearby")?;
    let session = connect(addr, port)?;
    let plate_hex = hex(session.handshake_hash());
    let session_id = register(session, true)?; // outbound ⇒ adopted (JS gets the id now)
    Ok(NativeConnected { session_id, plate_hex })
}

#[tauri::command]
pub fn native_send(session_id: String, lane: String, data: String) -> Result<(), String> {
    let lane = lane_from_name(&lane)?;
    let bytes = base64_decode(&data)?;
    session_send(&session_id, lane, &bytes)
}

#[tauri::command]
pub fn native_recv(session_id: String) -> Result<Vec<NativeFrame>, String> {
    let frames = session_recv(&session_id)?;
    Ok(frames
        .into_iter()
        .map(|(lane, bytes)| NativeFrame { lane: lane_name(lane), data: base64_encode(&bytes) })
        .collect())
}

#[tauri::command]
pub fn native_plate(session_id: String) -> Option<String> {
    session_plate(&session_id).map(|h| hex(&h))
}

#[tauri::command]
pub fn native_close(session_id: String) {
    session_close(&session_id);
}

/// Inbound sessions awaiting adoption - the responder JS polls this during a ceremony and
/// adopts the one whose plate matches the pairing. Each element is {sessionId, plateHex}.
#[tauri::command]
pub fn native_poll_inbound() -> Vec<NativeConnected> {
    list_unadopted()
        .into_iter()
        .map(|(session_id, h)| NativeConnected { session_id, plate_hex: hex(&h) })
        .collect()
}

/// Claim an inbound session so the reaper leaves it alone.
#[tauri::command]
pub fn native_adopt(session_id: String) -> bool {
    adopt_session(&session_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::net::{Ipv4Addr, Ipv6Addr, TcpListener};

    /// Drive a full XX handshake in memory (no socket) and return both transport states,
    /// plus each side's handshake hash.
    fn handshake_pair() -> (TransportState, TransportState, Vec<u8>, Vec<u8>) {
        let mut ini = build_initiator().unwrap();
        let mut res = build_responder().unwrap();
        let mut buf = [0u8; 1024];

        // XX: -> e ; <- e, ee, s, es ; -> s, se
        let n = ini.write_message(&[], &mut buf).unwrap();
        let mut rbuf = [0u8; 1024];
        res.read_message(&buf[..n], &mut rbuf).unwrap();

        let n = res.write_message(&[], &mut buf).unwrap();
        ini.read_message(&buf[..n], &mut rbuf).unwrap();

        let n = ini.write_message(&[], &mut buf).unwrap();
        res.read_message(&buf[..n], &mut rbuf).unwrap();

        let hi = handshake_hash(&ini);
        let hr = handshake_hash(&res);
        (ini.into_transport_mode().unwrap(), res.into_transport_mode().unwrap(), hi, hr)
    }

    #[test]
    fn handshake_completes_and_both_sides_agree_on_h() {
        let (_ti, _tr, hi, hr) = handshake_pair();
        assert_eq!(hi.len(), 32, "BLAKE2s handshake hash is 32 bytes");
        assert_eq!(hi, hr, "both peers must compute the same handshake hash (the plate input)");
    }

    #[test]
    fn frames_round_trip_through_the_transport_on_every_lane() {
        let (mut ti, mut tr, _, _) = handshake_pair();
        for (lane, payload) in [
            (Lane::Ops, b"an op".as_slice()),
            (Lane::Presence, b"cursor".as_slice()),
            (Lane::Beam, b"chunk-bytes".as_slice()),
        ] {
            let framed = encode_frame(&mut ti, lane, payload).unwrap();
            let mut cur = Cursor::new(framed);
            let (got_lane, got) = read_frame(&mut cur, &mut tr).unwrap();
            assert_eq!(got_lane, lane);
            assert_eq!(got, payload);
        }
    }

    #[test]
    fn a_flipped_ciphertext_byte_fails_the_aead_rather_than_mis_routing() {
        let (mut ti, mut tr, _, _) = handshake_pair();
        let mut framed = encode_frame(&mut ti, Lane::Beam, b"secret").unwrap();
        // Flip a byte inside the ciphertext (past the 4-byte length prefix).
        framed[5] ^= 0x01;
        let mut cur = Cursor::new(framed);
        assert!(read_frame(&mut cur, &mut tr).is_err(), "a tampered frame must not decrypt");
    }

    #[test]
    fn frame_length_is_bounded_before_allocation() {
        let (_ti, mut tr, _, _) = handshake_pair();
        // A length just past the cap, no body - must refuse on the length alone.
        let big = ((MAX_FRAME_BYTES as u32) + 1).to_be_bytes();
        let mut cur = Cursor::new(big.to_vec());
        assert!(read_frame(&mut cur, &mut tr).is_err());
    }

    #[test]
    fn end_to_end_over_a_real_localhost_socket() {
        // A full pairing over two real TCP sockets on 127.0.0.1: connect → XX handshake →
        // a frame each way. Proves the whole native path, not just the crypto primitives.
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();

        let responder = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut sess = accept(stream).unwrap();
            let (lane, msg) = sess.recv().unwrap();
            assert_eq!(lane, Lane::Ops);
            assert_eq!(msg, b"hello from initiator");
            sess.send(Lane::Presence, b"hello from responder").unwrap();
            sess.handshake_hash().to_vec()
        });

        // 127.0.0.1 is loopback ⇒ is_private_addr passes; connect completes the handshake.
        let mut initiator = connect(IpAddr::V4(Ipv4Addr::LOCALHOST), port).unwrap();
        initiator.send(Lane::Ops, b"hello from initiator").unwrap();
        let (lane, msg) = initiator.recv().unwrap();
        assert_eq!(lane, Lane::Presence);
        assert_eq!(msg, b"hello from responder");

        let responder_h = responder.join().unwrap();
        assert_eq!(
            initiator.handshake_hash(),
            &responder_h[..],
            "both peers must agree on h (the plate input) after a real handshake",
        );
    }

    /// Poll a session's inbox until a frame arrives (the reader thread fills it
    /// asynchronously) or a bounded number of tries elapses.
    fn poll_recv(id: &str) -> Vec<(Lane, Vec<u8>)> {
        for _ in 0..200 {
            let got = session_recv(id).unwrap();
            if !got.is_empty() {
                return got;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        Vec::new()
    }

    #[test]
    fn registry_routes_frames_between_two_registered_sessions() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let acc = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            accept(stream).unwrap()
        });
        let initiator = connect(IpAddr::V4(Ipv4Addr::LOCALHOST), port).unwrap();
        let responder = acc.join().unwrap();

        // Both peers agree on the plate input before registration consumes the sessions.
        assert_eq!(initiator.handshake_hash(), responder.handshake_hash());

        let id_i = register(initiator, true).unwrap();
        let id_r = register(responder, true).unwrap();

        // A frame each way, delivered through the reader threads + inbox.
        session_send(&id_i, Lane::Ops, b"from initiator").unwrap();
        assert_eq!(poll_recv(&id_r), vec![(Lane::Ops, b"from initiator".to_vec())]);
        session_send(&id_r, Lane::Beam, b"from responder").unwrap();
        assert_eq!(poll_recv(&id_i), vec![(Lane::Beam, b"from responder".to_vec())]);

        // The plate material is reachable by session id and agrees on both sides.
        assert_eq!(session_plate(&id_i), session_plate(&id_r));
        assert!(session_plate(&id_i).is_some());

        // Closing one side unblocks its reader and drops the entry.
        session_close(&id_i);
        session_close(&id_r);
        assert!(session_plate(&id_i).is_none(), "a closed session is gone from the registry");
        assert!(session_send(&id_r, Lane::Ops, b"x").is_err(), "sending on a closed session errors");
    }

    /// Gather up to `n` frames across polls (frames arrive asynchronously via the reader).
    fn gather(id: &str, n: usize) -> Vec<(Lane, Vec<u8>)> {
        let mut out = Vec::new();
        for _ in 0..400 {
            out.extend(session_recv(id).unwrap());
            if out.len() >= n {
                break;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        out
    }

    fn paired_ids() -> (String, String) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let acc = std::thread::spawn(move || accept(listener.accept().unwrap().0).unwrap());
        let initiator = connect(IpAddr::V4(Ipv4Addr::LOCALHOST), port).unwrap();
        let responder = acc.join().unwrap();
        (register(initiator, true).unwrap(), register(responder, false).unwrap())
    }

    #[test]
    fn all_three_lanes_route_through_recv() {
        let (id_i, id_r) = paired_ids();
        // Adopt the inbound responder so the reaper leaves it alone during the test.
        assert!(adopt_session(&id_r));
        session_send(&id_i, Lane::Ops, b"o1").unwrap();
        session_send(&id_i, Lane::Beam, b"b1").unwrap();
        session_send(&id_i, Lane::Presence, b"p1").unwrap();
        let got = gather(&id_r, 3);
        assert!(got.iter().any(|(l, d)| *l == Lane::Ops && d == b"o1"), "ops delivered");
        assert!(got.iter().any(|(l, d)| *l == Lane::Beam && d == b"b1"), "beam (reliable) delivered");
        assert!(got.iter().any(|(l, d)| *l == Lane::Presence && d == b"p1"), "presence delivered");
        session_close(&id_i);
        session_close(&id_r);
    }

    #[test]
    fn presence_is_lossy_but_reliable_is_never_dropped() {
        let (id_i, id_r) = paired_ids();
        assert!(adopt_session(&id_r));
        // Flood presence past its cap, plus one reliable ops frame.
        for i in 0..(MAX_INBOX_LOSSY + 50) {
            session_send(&id_i, Lane::Presence, format!("p{i}").as_bytes()).unwrap();
        }
        session_send(&id_i, Lane::Ops, b"survivor").unwrap();
        // Give the reader time to drain the socket into the inbox.
        std::thread::sleep(Duration::from_millis(80));
        let got = gather(&id_r, 1);
        let presence = got.iter().filter(|(l, _)| *l == Lane::Presence).count();
        assert!(presence <= MAX_INBOX_LOSSY, "presence is bounded (drop-oldest): {presence}");
        assert!(got.iter().any(|(l, d)| *l == Lane::Ops && d == b"survivor"), "the reliable ops frame is never dropped");
        session_close(&id_i);
        session_close(&id_r);
    }

    #[test]
    fn inbound_sessions_are_unadopted_then_claimable() {
        let (id_i, id_r) = paired_ids(); // id_r registered unadopted (false)
        let unadopted: Vec<String> = list_unadopted().into_iter().map(|(id, _)| id).collect();
        assert!(unadopted.contains(&id_r), "an inbound session is listed for adoption");
        assert!(!unadopted.contains(&id_i), "the outbound session is adopted from birth");
        assert!(adopt_session(&id_r));
        let after: Vec<String> = list_unadopted().into_iter().map(|(id, _)| id).collect();
        assert!(!after.contains(&id_r), "an adopted session no longer awaits adoption");
        session_close(&id_i);
        session_close(&id_r);
    }

    #[test]
    fn base64_round_trips_including_binary() {
        for case in [
            b"".as_slice(),
            b"f",
            b"fo",
            b"foo",
            b"foob",
            &[0u8, 255, 128, 1, 2, 3],
        ] {
            assert_eq!(base64_decode(&base64_encode(case)).unwrap(), case);
        }
        // Known RFC 4648 vectors.
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64_decode("Zm9vYmFy").unwrap(), b"foobar");
    }

    #[test]
    fn responder_rejects_a_static_commitment_mismatch() {
        // A MITM's grinding attack commits one static then authenticates with another (the
        // one it ground to hit a target plate). The responder must reject that - this is the
        // check that closes finding #1.
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let acc = std::thread::spawn(move || accept(listener.accept().unwrap().0));

        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let kp_committed = Builder::new(noise_params().unwrap()).generate_keypair().unwrap();
        let kp_actual = Builder::new(noise_params().unwrap()).generate_keypair().unwrap();
        // Commit one static...
        write_len_prefixed(&mut stream, &kp_committed.public).unwrap();
        // ...but run the handshake with a DIFFERENT static (prologue matches the commitment
        // so the transcript agrees; only the authenticated static differs).
        let mut hs = Builder::new(noise_params().unwrap())
            .prologue(&kp_committed.public)
            .local_private_key(&kp_actual.private)
            .build_initiator()
            .unwrap();
        let mut buf = [0u8; 1024];
        let n = hs.write_message(&[], &mut buf).unwrap();
        write_len_prefixed(&mut stream, &buf[..n]).unwrap();
        let msg = read_handshake_frame(&mut stream).unwrap();
        hs.read_message(&msg, &mut buf).unwrap();
        let n = hs.write_message(&[], &mut buf).unwrap();
        write_len_prefixed(&mut stream, &buf[..n]).unwrap();

        match acc.join().unwrap() {
            Err(e) => assert!(e.contains("commitment mismatch"), "wrong rejection: {e}"),
            Ok(_) => panic!("responder accepted a static-commitment mismatch (grinding attack)"),
        }
    }

    #[test]
    fn connect_refuses_a_non_private_address() {
        // Never opens a socket to a public address, whatever the port. (No connection is
        // attempted - the guard is before connect - so this does not touch the network.)
        match connect("8.8.8.8".parse().unwrap(), 9) {
            Err(e) => assert!(e.contains("non-private"), "wrong refusal reason: {e}"),
            Ok(_) => panic!("a public address must be refused before any connect"),
        }
    }

    #[test]
    fn private_ranges_are_allowed_public_is_refused() {
        // allowed
        for ip in [
            "10.0.0.5", "172.16.4.4", "192.168.1.2", "127.0.0.1", "169.254.10.10",
        ] {
            assert!(is_private_addr(ip.parse().unwrap()), "{ip} should be allowed");
        }
        // refused
        for ip in ["8.8.8.8", "1.1.1.1", "203.0.113.9", "172.32.0.1", "11.0.0.1"] {
            assert!(!is_private_addr(ip.parse().unwrap()), "{ip} should be refused");
        }
        // v6
        assert!(is_private_addr(IpAddr::V6(Ipv6Addr::LOCALHOST)));
        assert!(is_private_addr("fe80::1".parse().unwrap()));
        assert!(is_private_addr("fc00::1".parse().unwrap()));
        assert!(!is_private_addr("2606:4700::1111".parse().unwrap()));
        // sanity that the v4 boundary logic is exact
        assert!(!is_private_addr(IpAddr::V4(Ipv4Addr::new(172, 15, 255, 255))));
        assert!(is_private_addr(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 0))));
    }
}
