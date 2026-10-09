// SPDX-License-Identifier: MPL-2.0
//! Feature-only bounded stdio broker for the ordinary bundled GUI on an owned test identity.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    io::{BufRead, Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{
    ipc::{Invoke, InvokeBody},
    Manager, Runtime,
};

const PREFIX: &str = "tools.lolly.WebGpuProductQualification.r";
const COMMAND_LIMIT: usize = 1024 * 1024;
const REPLY_LIMIT: usize = 16 * 1024 * 1024;
const SOURCE_LIMIT: usize = 64 * 1024;
const DIAGNOSTIC_CONTROL_PREFIX: &str = "LOLLY_WEBGPU_PRODUCT_DIAGNOSTIC_CONTROL ";
const DIAGNOSTIC_PREFIX: &str = "LOLLY_WEBGPU_PRODUCT_NATIVE_DIAGNOSTIC ";
const DIAGNOSTIC_LIMIT: u8 = 8;

#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum Phase {
    NativeHandshake,
    OnboardingPoll,
    Csp,
    ProbeLoad,
    ToolWait,
    Corpus,
    Closing,
}

impl Phase {
    fn startup(self) -> bool {
        !matches!(self, Self::Corpus | Self::Closing)
    }
    fn rank(self) -> u8 {
        self as u8
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct DiagnosticControl {
    run_id: String,
    phase: Phase,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct Checkpoint {
    stage: &'static str,
    id: u64,
    elapsed_ms: u64,
}

struct DiagnosticState {
    started: Instant,
    phase: Phase,
    checkpoints: [Option<Checkpoint>; 4],
    last_snapshot_id: Option<u64>,
    emitted: u8,
    controls: u8,
}

impl DiagnosticState {
    fn elapsed_ms(&self) -> u64 {
        self.started
            .elapsed()
            .as_millis()
            .min(9_007_199_254_740_991) as u64
    }
    fn stale_snapshot(&mut self, run_id: &str, elapsed_ms: u64) -> Option<Value> {
        let intake = self.checkpoints[0]?;
        let replied = self.checkpoints[3].is_some_and(|reply| reply.id >= intake.id);
        if !self.phase.startup()
            || replied
            || elapsed_ms.saturating_sub(intake.elapsed_ms) < 5_000
            || self.last_snapshot_id == Some(intake.id)
            || self.emitted >= DIAGNOSTIC_LIMIT
        {
            return None;
        }
        self.last_snapshot_id = Some(intake.id);
        self.emitted += 1;
        Some(
            json!({ "event": "native-checkpoints", "runId": run_id, "phase": self.phase,
            "sequence": self.emitted, "elapsedMs": elapsed_ms,
            "checkpoints": self.checkpoints.iter().flatten().collect::<Vec<_>>() }),
        )
    }
}

struct Diagnostics {
    active: AtomicBool,
    state: Mutex<DiagnosticState>,
}

impl Diagnostics {
    fn new() -> Self {
        Self {
            active: AtomicBool::new(true),
            state: Mutex::new(DiagnosticState {
                started: Instant::now(),
                phase: Phase::NativeHandshake,
                checkpoints: [None; 4],
                last_snapshot_id: None,
                emitted: 0,
                controls: 0,
            }),
        }
    }
    fn control(&self, bytes: &[u8], run_id: &str) -> Result<(), &'static str> {
        if bytes.len() > 256 {
            return Err("Qualification diagnostic control exceeds its bound");
        }
        let control: DiagnosticControl = serde_json::from_slice(bytes)
            .map_err(|_| "Malformed qualification diagnostic control")?;
        if control.run_id != run_id {
            return Err("Qualification diagnostic run ID differs");
        }
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Qualification diagnostic state failed")?;
        if state.controls >= 16 || control.phase.rank() < state.phase.rank() {
            return Err("Qualification diagnostic phase or count differs");
        }
        state.controls += 1;
        state.phase = control.phase;
        self.active
            .store(control.phase.startup(), Ordering::Relaxed);
        Ok(())
    }
    fn checkpoint(&self, index: usize, id: u64) {
        if !self.active.load(Ordering::Relaxed) || !(1..=10_000).contains(&id) {
            return;
        }
        if let Ok(mut state) = self.state.lock() {
            if state.phase.startup() {
                state.checkpoints[index] = Some(Checkpoint {
                    stage: ["intake", "enqueued", "dequeued", "reply"][index],
                    id,
                    elapsed_ms: state.elapsed_ms(),
                });
            }
        }
    }
    fn watch(self: Arc<Self>, run_id: String) {
        std::thread::spawn(move || {
            for _ in 0..180 {
                std::thread::sleep(Duration::from_secs(1));
                if !self.active.load(Ordering::Relaxed) {
                    break;
                }
                let snapshot = self.state.try_lock().ok().and_then(|mut state| {
                    let elapsed = state.elapsed_ms();
                    state.stale_snapshot(&run_id, elapsed)
                });
                if let Some(snapshot) = snapshot {
                    let line = format!("{DIAGNOSTIC_PREFIX}{snapshot}\n");
                    if line.len() <= 2048 && self.active.load(Ordering::Relaxed) {
                        // A separate stream can report when original stdout or queue work stalls.
                        let mut output = std::io::stderr().lock();
                        let _ = output.write_all(line.as_bytes());
                        let _ = output.flush();
                    }
                }
            }
        });
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Command {
    id: u64,
    source: String,
    #[serde(default)]
    arg: Value,
    #[serde(default)]
    close: bool,
}

#[derive(Default)]
struct Queue {
    commands: VecDeque<Command>,
    inflight: Option<u64>,
    last: u64,
    ready: bool,
    failed: bool,
}

struct Broker {
    run_id: String,
    queue: Arc<Mutex<Queue>>,
    diagnostics: Arc<Diagnostics>,
}

fn run_id_valid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) {
                *byte == b'-'
            } else {
                byte.is_ascii_digit() || (b'a'..=b'f').contains(byte)
            }
        })
        && bytes[14] == b'4'
        && matches!(bytes[19], b'8' | b'9' | b'a' | b'b')
}

fn identity_valid(identifier: &str, run_id: &str) -> bool {
    run_id_valid(run_id) && identifier == format!("{PREFIX}{}", run_id.replace('-', ""))
}

fn app_url(value: &str) -> bool {
    tauri::Url::parse(value).is_ok_and(|url| {
        url.scheme() == "tauri"
            && url.host_str() == Some("localhost")
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none()
    })
}

fn authorize(
    label: &str,
    native_url: &str,
    run_id: &str,
    body: &Value,
    fields: &[&str],
) -> Result<(), &'static str> {
    let object = body
        .as_object()
        .ok_or("Qualification request must be an object")?;
    if label != "main" || !app_url(native_url) {
        return Err("Qualification belongs to the bundled main origin");
    }
    if object.keys().any(|key| !fields.contains(&key.as_str())) {
        return Err("Unknown qualification field");
    }
    if object.get("runId").and_then(Value::as_str) != Some(run_id) {
        return Err("Qualification run ID differs");
    }
    if !object
        .get("url")
        .and_then(Value::as_str)
        .is_some_and(app_url)
    {
        return Err("Qualification request origin differs");
    }
    Ok(())
}

fn command_valid(command: &Command, queue: &Queue) -> Result<(), &'static str> {
    if command.id != queue.last + 1 || command.id > 10_000 {
        return Err("Qualification command sequence differs");
    }
    if command.source.is_empty() || command.source.len() > SOURCE_LIMIT {
        return Err("Qualification source exceeds its bound");
    }
    if queue.failed || queue.inflight.is_some() || !queue.commands.is_empty() {
        return Err("Qualification already has a pending command");
    }
    Ok(())
}

fn emit(value: Value) {
    let mut output = std::io::stdout().lock();
    let _ = writeln!(output, "LOLLY_WEBGPU_PRODUCT {value}");
    let _ = output.flush();
}

pub fn prepare(identifier: &str, search_provider: bool) {
    let run_id = std::env::var("LOLLY_WEBGPU_PRODUCT_PROBE").unwrap_or_default();
    assert!(
        !search_provider && identity_valid(identifier, &run_id),
        "Product qualification needs its explicit separate GUI identity and run ID"
    );
    assert_eq!(
        std::env::var("LOLLY_WEBGPU_QUALIFICATION_BUILD").as_deref(),
        Ok("1"),
        "Product qualification must remain marked not for release"
    );
}

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let run_id = std::env::var("LOLLY_WEBGPU_PRODUCT_PROBE").unwrap_or_default();
    prepare(&app.config().identifier, false);
    let queue = Arc::new(Mutex::new(Queue::default()));
    let diagnostics = Arc::new(Diagnostics::new());
    diagnostics.clone().watch(run_id.clone());
    app.manage(Broker {
        run_id: run_id.clone(),
        queue: queue.clone(),
        diagnostics: diagnostics.clone(),
    });
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        let mut input = std::io::BufReader::new(std::io::stdin());
        loop {
            let mut bytes = Vec::new();
            let result = input
                .by_ref()
                .take((COMMAND_LIMIT + 1) as u64)
                .read_until(b'\n', &mut bytes);
            if matches!(result, Ok(0)) {
                handle.exit(0);
                break;
            }
            let result = result
                .map_err(|_| "Qualification input failed")
                .and_then(|_| {
                    if bytes.len() > COMMAND_LIMIT || bytes.last() != Some(&b'\n') {
                        return Err("Qualification input exceeds its bound");
                    }
                    if let Some(control) = bytes.strip_prefix(DIAGNOSTIC_CONTROL_PREFIX.as_bytes())
                    {
                        return diagnostics.control(control, &run_id);
                    }
                    let command: Command = serde_json::from_slice(&bytes)
                        .map_err(|_| "Malformed qualification command")?;
                    diagnostics.checkpoint(0, command.id);
                    let mut state = queue.lock().map_err(|_| "Qualification queue failed")?;
                    command_valid(&command, &state)?;
                    state.last = command.id;
                    state.commands.push_back(command);
                    diagnostics.checkpoint(1, state.last);
                    Ok(())
                });
            if let Err(error) = result {
                if let Ok(mut state) = queue.lock() {
                    state.failed = true;
                }
                emit(json!({ "event": "failure", "runId": run_id, "error": error }));
                handle.exit(1);
                break;
            }
        }
    });
    Ok(())
}

pub fn route<R: Runtime>(invoke: Invoke<R>) -> bool {
    let command = invoke.message.command().to_string();
    let fields: &[&str] = match command.as_str() {
        "webgpu_qualification_ready" => &["runId", "url", "secureContext"],
        "webgpu_qualification_next" => &["runId", "url"],
        "webgpu_qualification_reply" => &["runId", "url", "reply"],
        "webgpu_qualification_failure" => &["runId", "url", "error"],
        _ => {
            invoke
                .resolver
                .reject("Unknown product qualification command");
            return true;
        }
    };
    let InvokeBody::Json(body) = invoke.message.payload() else {
        invoke.resolver.reject("Qualification requires JSON");
        return true;
    };
    let webview = invoke.message.webview_ref();
    let broker = webview.state::<Broker>();
    let native_url = webview.url().map(|url| url.to_string()).unwrap_or_default();
    if let Err(error) = authorize(webview.label(), &native_url, &broker.run_id, body, fields) {
        invoke.resolver.reject(error);
        return true;
    }
    let Ok(mut state) = broker.queue.lock() else {
        invoke.resolver.reject("Qualification queue failed");
        return true;
    };
    let result: Result<Value, &str> = (|| {
        if state.failed {
            return Err("Qualification is closed after a failure");
        }
        match command.as_str() {
            "webgpu_qualification_ready" => {
                if state.ready || body.get("secureContext").and_then(Value::as_bool).is_none() {
                    return Err("Invalid qualification handshake");
                }
                state.ready = true;
                emit(
                    json!({ "event": "ready", "runId": broker.run_id, "url": body["url"],
                    "nativeUrl": native_url, "secureContext": body["secureContext"],
                    "runtime": tauri::webview_version().unwrap_or_else(|error| format!("unavailable: {error}")),
                    "identifier": webview.app_handle().config().identifier, "os": std::env::consts::OS, "architecture": std::env::consts::ARCH }),
                );
                Ok(Value::Null)
            }
            "webgpu_qualification_next" => {
                if !state.ready || state.inflight.is_some() {
                    return Err("Qualification receiver is not ready");
                }
                Ok(state.commands.pop_front().map_or(Value::Null, |command| {
                    state.inflight = Some(command.id);
                    broker.diagnostics.checkpoint(2, command.id);
                    json!({ "id": command.id, "source": command.source, "arg": command.arg, "close": command.close })
                }))
            }
            "webgpu_qualification_reply" => {
                let reply = body
                    .get("reply")
                    .and_then(Value::as_object)
                    .ok_or("Malformed qualification reply")?;
                if reply
                    .keys()
                    .any(|key| !["id", "value", "error", "stack"].contains(&key.as_str()))
                {
                    return Err("Unknown qualification reply field");
                }
                let id = reply
                    .get("id")
                    .and_then(Value::as_u64)
                    .ok_or("Missing qualification reply ID")?;
                if state.inflight != Some(id)
                    || serde_json::to_vec(reply)
                        .map_err(|_| "Invalid qualification reply")?
                        .len()
                        > REPLY_LIMIT
                {
                    return Err("Qualification reply sequence or bound differs");
                }
                state.inflight = None;
                emit(json!({ "event": "reply", "runId": broker.run_id, "reply": reply }));
                // Reaching this checkpoint means the original stdout write/flush returned.
                broker.diagnostics.checkpoint(3, id);
                Ok(Value::Null)
            }
            _ => {
                let error = body
                    .get("error")
                    .and_then(Value::as_str)
                    .ok_or("Missing qualification failure")?;
                if error.len() > 2048 {
                    return Err("Qualification failure exceeds its bound");
                }
                state.failed = true;
                emit(json!({ "event": "failure", "runId": broker.run_id, "error": error }));
                Ok(Value::Null)
            }
        }
    })();
    drop(state);
    match result {
        Ok(value) => invoke.resolver.resolve(value),
        Err(error) => invoke.resolver.reject(error),
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    const ID: &str = "4c3d9db0-f06e-4870-a75f-c4a2a1502bad";
    #[test]
    fn identity_and_origin_are_exact() {
        assert!(identity_valid(
            &format!("{PREFIX}{}", ID.replace('-', "")),
            ID
        ));
        assert!(!identity_valid("tools.lolly.Desktop", ID));
        let body = json!({ "runId": ID, "url": "tauri://localhost/t/qr-code" });
        assert!(authorize("main", "tauri://localhost/", ID, &body, &["runId", "url"]).is_ok());
        for url in [
            "http://127.0.0.1/",
            "https://localhost/",
            "tauri://remote/",
            "tauri://user@localhost/",
            "tauri://localhost:80/",
        ] {
            assert!(authorize("main", url, ID, &body, &["runId", "url"]).is_err());
            assert!(!app_url(url));
        }
        assert!(authorize(
            "presentation-controls",
            "tauri://localhost/",
            ID,
            &body,
            &["runId", "url"]
        )
        .is_err());
        assert!(authorize(
            "main",
            "tauri://localhost/",
            "different",
            &body,
            &["runId", "url"]
        )
        .is_err());
        assert!(authorize("main", "tauri://localhost/", ID, &body, &["runId"]).is_err());
    }
    #[test]
    fn commands_refuse_replays_unbounded_sources_and_overlap() {
        let mut queue = Queue::default();
        let mut command = Command {
            id: 1,
            source: "() => true".into(),
            arg: Value::Null,
            close: false,
        };
        assert!(command_valid(&command, &queue).is_ok());
        command.id = 2;
        assert!(command_valid(&command, &queue).is_err());
        command.id = 1;
        command.source = "a".repeat(SOURCE_LIMIT + 1);
        assert!(command_valid(&command, &queue).is_err());
        command.source = "() => true".into();
        queue.inflight = Some(1);
        assert!(command_valid(&command, &queue).is_err());
        assert!(serde_json::from_str::<Command>(
            "{\"id\":1,\"source\":\"() => true\",\"unknown\":true}"
        )
        .is_err());
        assert!(serde_json::from_str::<Command>(
            "{\"id\":1,\"source\":\"() => true\",\"phase\":\"tool-wait\"}"
        )
        .is_err());
    }
    #[test]
    fn diagnostic_controls_are_exact_bounded_and_do_not_consume_commands() {
        let diagnostics = Diagnostics::new();
        let control =
            |phase: &str| serde_json::to_vec(&json!({"runId": ID, "phase": phase})).unwrap();
        assert!(diagnostics.control(&control("tool-wait"), ID).is_ok());
        for bytes in [
            serde_json::to_vec(&json!({"runId": "another", "phase": "tool-wait"})).unwrap(),
            serde_json::to_vec(&json!({"runId": ID, "phase": "unknown"})).unwrap(),
            serde_json::to_vec(&json!({"runId": ID, "phase": "tool-wait", "arg": "private"}))
                .unwrap(),
            format!("{{\"runId\":\"{ID}\",\"runId\":\"{ID}\",\"phase\":\"tool-wait\"}}")
                .into_bytes(),
            vec![b' '; 257],
        ] {
            assert!(diagnostics.control(&bytes, ID).is_err());
        }
        assert!(diagnostics.control(&control("csp"), ID).is_err());
        for _ in 1..16 {
            assert!(diagnostics.control(&control("tool-wait"), ID).is_ok());
        }
        assert!(diagnostics.control(&control("tool-wait"), ID).is_err());
        let queue = Queue::default();
        let command = Command {
            id: 1,
            source: "() => true".into(),
            arg: Value::Null,
            close: false,
        };
        assert!(command_valid(&command, &queue).is_ok());
    }
    #[test]
    fn stale_native_snapshots_have_fixed_storage_one_per_id_and_eight_output_limit() {
        let diagnostics = Diagnostics::new();
        diagnostics.checkpoint(0, 61);
        diagnostics.checkpoint(1, 61);
        diagnostics.checkpoint(2, 60);
        diagnostics.checkpoint(3, 60);
        let mut state = diagnostics.state.lock().unwrap();
        state.phase = Phase::ToolWait;
        let intake_at = state.checkpoints[0].unwrap().elapsed_ms;
        assert!(state.stale_snapshot(ID, intake_at + 4999).is_none());
        let snapshot = state.stale_snapshot(ID, intake_at + 5000).unwrap();
        assert_eq!(snapshot["runId"], ID);
        assert_eq!(snapshot["phase"], "tool-wait");
        assert_eq!(snapshot["sequence"], 1);
        assert_eq!(snapshot["checkpoints"].as_array().unwrap().len(), 4);
        assert_eq!(snapshot["checkpoints"][0]["id"], 61);
        assert_eq!(snapshot["checkpoints"][3]["id"], 60);
        assert!(format!("{DIAGNOSTIC_PREFIX}{snapshot}\n").len() <= 2048);
        assert!(state.stale_snapshot(ID, intake_at + 9000).is_none());
        for id in 62..69 {
            state.checkpoints[0] = Some(Checkpoint {
                stage: "intake",
                id,
                elapsed_ms: 0,
            });
            assert!(state.stale_snapshot(ID, 9000).is_some());
        }
        state.checkpoints[0] = Some(Checkpoint {
            stage: "intake",
            id: 69,
            elapsed_ms: 0,
        });
        assert!(state.stale_snapshot(ID, 9000).is_none());
        assert_eq!(state.emitted, DIAGNOSTIC_LIMIT);
    }
    #[test]
    fn corpus_and_closing_disable_native_trace_without_queue_or_timing_changes() {
        let diagnostics = Diagnostics::new();
        diagnostics.checkpoint(0, 1);
        let control =
            |phase: &str| serde_json::to_vec(&json!({"runId": ID, "phase": phase})).unwrap();
        assert!(diagnostics.control(&control("corpus"), ID).is_ok());
        diagnostics.checkpoint(0, 2);
        let mut state = diagnostics.state.lock().unwrap();
        assert_eq!(state.checkpoints[0].unwrap().id, 1);
        assert!(state.stale_snapshot(ID, 10_000).is_none());
        drop(state);
        assert!(diagnostics.control(&control("tool-wait"), ID).is_err());
        assert!(diagnostics.control(&control("closing"), ID).is_ok());
        assert!(!diagnostics.active.load(Ordering::Relaxed));
    }
}
