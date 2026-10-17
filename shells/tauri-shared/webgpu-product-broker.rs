// SPDX-License-Identifier: MPL-2.0
//! Feature-only bounded broker for the ordinary bundled GUI on an owned test identity.
//! Commands arrive on stdin on desktop and through a file inbox on iOS; replies go to stdout.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    io::{BufRead, Read, Write},
    path::PathBuf,
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
const GUEST_DIAGNOSTIC_PREFIX: &str = "LOLLY_WEBGPU_PRODUCT_GUEST_DIAGNOSTIC ";
const OBSERVATION_SOURCE: &str = "window.__lollyProductQualification?.observe(1);";
const INBOX_DIRECTORY: &str = "webgpu-product-commands";
const INBOX_ENTRY_LIMIT: usize = 64;
const INBOX_POLL: Duration = Duration::from_millis(50);
// 10,000 commands plus at most 16 diagnostic controls.
const INBOX_SEQUENCE_LIMIT: u64 = 10_016;

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct GuestState {
    stage: GuestStage,
    last_command_id: Option<u64>,
    visibility: Visibility,
    has_focus: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum GuestStage {
    ReadyAwait,
    BeforeNext,
    AfterNext,
    BeforeEvaluate,
    AfterEvaluate,
    BeforeReply,
    AfterReply,
    BeforeIdle,
    AfterIdle,
    Stopped,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Visibility {
    Visible,
    Hidden,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GuestObservation {
    sequence: u8,
    state: GuestState,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Observation {
    Unrequested,
    Requested(u64),
    Finished,
}

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
    observation: Observation,
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
                observation: Observation::Unrequested,
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
        if !control.phase.startup() {
            state.observation = Observation::Finished;
        }
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
    fn guest_emit(state: &DiagnosticState, run_id: &str, status: &str, guest: Option<&GuestState>) {
        let mut row = json!({ "event": "guest-await-state", "runId": run_id, "phase": state.phase,
            "sequence": if status == "requested" { 1 } else { 2 }, "elapsedMs": state.elapsed_ms(), "status": status });
        if let Some(guest) = guest {
            row["state"] = json!(guest);
        }
        let line = format!("{GUEST_DIAGNOSTIC_PREFIX}{row}\n");
        if line.len() <= 1024 {
            let mut output = std::io::stderr().lock();
            let _ = output.write_all(line.as_bytes());
            let _ = output.flush();
        }
    }
    fn request_observation(&self, run_id: &str) -> bool {
        let Ok(mut state) = self.state.lock() else {
            return false;
        };
        if !state.phase.startup() || state.observation != Observation::Unrequested {
            return false;
        }
        let Some(intake) = state.checkpoints[0] else {
            return false;
        };
        if state.last_snapshot_id != Some(intake.id)
            || state.checkpoints[3].is_some_and(|reply| reply.id >= intake.id)
        {
            return false;
        }
        state.observation = Observation::Requested(intake.id);
        Self::guest_emit(&state, run_id, "requested", None);
        true
    }
    fn observation(&self, body: &Value, run_id: &str) -> Result<(), &'static str> {
        if serde_json::to_vec(body)
            .map_err(|_| "Malformed guest observation")?
            .len()
            > 512
        {
            return Err("Guest observation exceeds its bound");
        }
        if body
            .get("state")
            .and_then(Value::as_object)
            .is_none_or(|state| state.len() != 4 || !state.contains_key("lastCommandId"))
        {
            return Err("Malformed guest observation");
        }
        let mut payload = body.clone();
        let object = payload
            .as_object_mut()
            .ok_or("Malformed guest observation")?;
        object.remove("runId");
        object.remove("url");
        let observation: GuestObservation =
            serde_json::from_value(payload).map_err(|_| "Malformed guest observation")?;
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Qualification diagnostic state failed")?;
        let Observation::Requested(maximum_id) = state.observation else {
            return Err("Guest observation was not requested or repeated");
        };
        if !state.phase.startup()
            || observation.sequence != 1
            || observation
                .state
                .last_command_id
                .is_some_and(|id| !(1..=maximum_id).contains(&id))
        {
            return Err("Guest observation phase, sequence or command differs");
        }
        state.observation = Observation::Finished;
        Self::guest_emit(&state, run_id, "observed", Some(&observation.state));
        Ok(())
    }
    fn observation_eval_failed(&self, run_id: &str) {
        if let Ok(mut state) = self.state.lock() {
            if state.phase.startup() && matches!(state.observation, Observation::Requested(_)) {
                state.observation = Observation::Finished;
                Self::guest_emit(&state, run_id, "eval-error", None);
            }
        }
    }
    fn watch(self: Arc<Self>, run_id: String, handle: tauri::AppHandle) {
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
                    if let Ok(state) = self.state.lock() {
                        if line.len() <= 2048 && state.phase.startup() {
                            // A separate stream can report when original stdout or queue work stalls.
                            let mut output = std::io::stderr().lock();
                            let _ = output.write_all(line.as_bytes());
                            let _ = output.flush();
                        }
                    }
                    if self.request_observation(&run_id) {
                        // Only the first stale startup snapshot schedules this fixed independent eval.
                        let result = handle
                            .get_webview_window("main")
                            .ok_or(())
                            .and_then(|window| window.eval(OBSERVATION_SOURCE).map_err(|_| ()));
                        if result.is_err() {
                            self.observation_eval_failed(&run_id);
                        }
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

/// One line from either transport: a diagnostic control or the next command.
fn intake(
    bytes: &[u8],
    diagnostics: &Diagnostics,
    queue: &Mutex<Queue>,
    run_id: &str,
) -> Result<(), &'static str> {
    if bytes.len() > COMMAND_LIMIT || bytes.last() != Some(&b'\n') {
        return Err("Qualification input exceeds its bound");
    }
    if let Some(control) = bytes.strip_prefix(DIAGNOSTIC_CONTROL_PREFIX.as_bytes()) {
        return diagnostics.control(control, run_id);
    }
    let command: Command =
        serde_json::from_slice(bytes).map_err(|_| "Malformed qualification command")?;
    diagnostics.checkpoint(0, command.id);
    let mut state = queue.lock().map_err(|_| "Qualification queue failed")?;
    command_valid(&command, &state)?;
    state.last = command.id;
    state.commands.push_back(command);
    diagnostics.checkpoint(1, state.last);
    Ok(())
}

/// iOS starts the app with /dev/null as stdin, so there each line arrives as one file
/// in the app's own temporary directory. The host copies it with `devicectl device copy
/// to --domain-type appDataContainer` to `tmp/webgpu-product-commands/<sequence>-<bytes>.line`,
/// numbering lines from 1 for each launch. Opening the inbox removes lines an earlier,
/// terminated launch never read, so the host writes nothing before the ready event. The
/// byte count lets the reader wait for a copy still in progress instead of parsing part of it.
struct Inbox {
    directory: PathBuf,
    next: u64,
}

/// `None` for a name that is not a line entry, such as a transfer's temporary file.
fn inbox_entry(name: &str) -> Option<Result<(u64, usize), &'static str>> {
    let (sequence, bytes) = name.strip_suffix(".line")?.split_once('-')?;
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit());
    if !digits(sequence) || !digits(bytes) {
        return None;
    }
    let parsed = sequence
        .parse::<u64>()
        .ok()
        .zip(bytes.parse::<usize>().ok());
    Some(
        parsed
            .filter(|&(sequence, bytes)| {
                name == format!("{sequence}-{bytes}.line")
                    && (1..=INBOX_SEQUENCE_LIMIT).contains(&sequence)
                    && (1..=COMMAND_LIMIT).contains(&bytes)
            })
            .ok_or("Qualification inbox entry name or bound differs"),
    )
}

impl Inbox {
    fn open(directory: PathBuf) -> Result<Self, &'static str> {
        std::fs::create_dir_all(&directory).map_err(|_| "Qualification inbox failed")?;
        if !std::fs::symlink_metadata(&directory).is_ok_and(|meta| meta.is_dir()) {
            return Err("Qualification inbox must be a directory");
        }
        let inbox = Self { directory, next: 1 };
        for (_, _, path) in inbox.entries()? {
            std::fs::remove_file(path).map_err(|_| "Qualification inbox failed")?;
        }
        Ok(inbox)
    }
    fn entries(&self) -> Result<Vec<(u64, usize, PathBuf)>, &'static str> {
        let mut entries = Vec::new();
        let listing =
            std::fs::read_dir(&self.directory).map_err(|_| "Qualification inbox failed")?;
        for (count, entry) in listing.enumerate() {
            let entry = entry.map_err(|_| "Qualification inbox failed")?;
            if count >= INBOX_ENTRY_LIMIT {
                return Err("Qualification inbox exceeds its bound");
            }
            let Some(parsed) = entry.file_name().to_str().and_then(inbox_entry) else {
                continue;
            };
            let (sequence, bytes) = parsed?;
            if !entry.file_type().is_ok_and(|kind| kind.is_file()) {
                return Err("Qualification inbox entry must be a file");
            }
            entries.push((sequence, bytes, entry.path()));
        }
        Ok(entries)
    }
    /// The next complete line, or `None` while it has not fully arrived.
    fn poll(&mut self) -> Result<Option<Vec<u8>>, &'static str> {
        let mut found = None;
        for (sequence, bytes, path) in self.entries()? {
            if sequence < self.next || (sequence == self.next && found.is_some()) {
                return Err("Qualification inbox sequence differs");
            }
            if sequence == self.next {
                found = Some((bytes, path));
            }
        }
        let Some((bytes, path)) = found else {
            return Ok(None);
        };
        let mut line = Vec::with_capacity(bytes);
        std::fs::File::open(&path)
            .and_then(|file| file.take(bytes as u64 + 1).read_to_end(&mut line))
            .map_err(|_| "Qualification inbox failed")?;
        if line.len() > bytes {
            return Err("Qualification input exceeds its bound");
        }
        // A copy in progress is short, or still holds unwritten zero bytes before its newline.
        if line.len() < bytes || line.last() != Some(&b'\n') || line.contains(&0) {
            return Ok(None);
        }
        std::fs::remove_file(&path).map_err(|_| "Qualification inbox failed")?;
        self.next += 1;
        Ok(Some(line))
    }
}

enum Input {
    Stream(Box<dyn BufRead + Send>),
    Inbox(Inbox),
}

impl Input {
    /// The next line, or `None` once a stream closes. The inbox never closes.
    fn next_line(&mut self) -> Result<Option<Vec<u8>>, &'static str> {
        match self {
            Self::Stream(input) => {
                let mut bytes = Vec::new();
                match input
                    .by_ref()
                    .take((COMMAND_LIMIT + 1) as u64)
                    .read_until(b'\n', &mut bytes)
                {
                    Ok(0) => Ok(None),
                    Ok(_) => Ok(Some(bytes)),
                    Err(_) => Err("Qualification input failed"),
                }
            }
            Self::Inbox(inbox) => loop {
                if let Some(line) = inbox.poll()? {
                    return Ok(Some(line));
                }
                std::thread::sleep(INBOX_POLL);
            },
        }
    }
}

fn command_input() -> Result<Input, &'static str> {
    if cfg!(target_os = "ios") {
        Inbox::open(std::env::temp_dir().join(INBOX_DIRECTORY)).map(Input::Inbox)
    } else {
        Ok(Input::Stream(Box::new(std::io::BufReader::new(
            std::io::stdin(),
        ))))
    }
}

impl Broker {
    /// The first refused exit closes qualification with a failure the host can read.
    fn refuse_exit(&self, code: Option<i32>) -> Option<Value> {
        let mut state = self.queue.lock().ok()?;
        if state.failed {
            return None;
        }
        state.failed = true;
        let error = match code {
            Some(code) => format!("Qualification refused an iOS exit request with code {code}"),
            None => "Qualification refused an iOS exit request after its last window closed".into(),
        };
        Some(json!({ "event": "failure", "runId": self.run_id, "error": error }))
    }
}

/// iOS apps never quit themselves, and tao 0.37.1 drops its iOS AppState on
/// ControlFlow::Exit, so the next run-loop observer aborts the app. Plugins see each
/// run event before the shell's own handler, so this guard refuses every exit request
/// on iOS without changes to the shell.
fn exit_guard<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("webgpu-product-exit-guard")
        .on_event(|app, event| {
            if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
                api.prevent_exit();
                if let Some(row) = app
                    .try_state::<Broker>()
                    .and_then(|broker| broker.refuse_exit(*code))
                {
                    emit(row);
                }
            }
        })
        .build()
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
    diagnostics
        .clone()
        .watch(run_id.clone(), app.handle().clone());
    app.manage(Broker {
        run_id: run_id.clone(),
        queue: queue.clone(),
        diagnostics: diagnostics.clone(),
    });
    if cfg!(target_os = "ios") {
        app.handle().plugin(exit_guard())?;
    }
    // Opened here, before any window exists, so stale inbox lines are gone before the
    // page can report ready.
    let mut input = command_input();
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        // On iOS the reader reports why it stopped and leaves the app running instead
        // of exiting; exit_guard explains why an iOS exit aborts the app.
        #[cfg(target_os = "ios")]
        let _ = &handle;
        loop {
            let line = match input
                .as_mut()
                .map_err(|error| *error)
                .and_then(Input::next_line)
            {
                Ok(Some(line)) => Ok(line),
                Ok(None) => {
                    #[cfg(target_os = "ios")]
                    emit(json!({ "event": "failure", "runId": run_id, "error": "Qualification input closed" }));
                    #[cfg(not(target_os = "ios"))]
                    handle.exit(0);
                    break;
                }
                Err(error) => Err(error),
            };
            let result = line.and_then(|line| intake(&line, &diagnostics, &queue, &run_id));
            if let Err(error) = result {
                if let Ok(mut state) = queue.lock() {
                    state.failed = true;
                }
                emit(json!({ "event": "failure", "runId": run_id, "error": error }));
                #[cfg(not(target_os = "ios"))]
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
        "webgpu_qualification_observation" => &["runId", "url", "sequence", "state"],
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
    if command == "webgpu_qualification_observation" {
        match broker.diagnostics.observation(body, &broker.run_id) {
            Ok(()) => invoke.resolver.resolve(Value::Null),
            Err(error) => invoke.resolver.reject(error),
        }
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
    #[test]
    fn guest_observation_is_one_use_bounded_and_independent_of_command_queue() {
        let diagnostics = Diagnostics::new();
        let body = json!({ "runId": ID, "url": "tauri://localhost/", "sequence": 1,
            "state": { "stage": "before-reply", "lastCommandId": 59, "visibility": "hidden", "hasFocus": false } });
        assert!(diagnostics.observation(&body, ID).is_err());
        diagnostics.checkpoint(0, 60);
        assert!(!diagnostics.request_observation(ID));
        let mut state = diagnostics.state.lock().unwrap();
        let elapsed = state.checkpoints[0].unwrap().elapsed_ms + 5000;
        assert!(state.stale_snapshot(ID, elapsed).is_some());
        drop(state);
        assert!(diagnostics.request_observation(ID));
        assert!(!diagnostics.request_observation(ID));
        for patch in [
            json!({ "stage": "arbitrary-source", "lastCommandId": 59, "visibility": "hidden", "hasFocus": false }),
            json!({ "stage": "before-reply", "lastCommandId": 61, "visibility": "hidden", "hasFocus": false }),
            json!({ "stage": "before-reply", "lastCommandId": 0, "visibility": "hidden", "hasFocus": false }),
            json!({ "stage": "before-reply", "visibility": "hidden", "hasFocus": false }),
            json!({ "stage": "before-reply", "lastCommandId": 59, "visibility": "hidden", "hasFocus": false, "args": "private" }),
            json!({ "stage": "before-reply", "lastCommandId": 59, "visibility": "unknown", "hasFocus": false }),
        ] {
            let mut changed = body.clone();
            changed["state"] = patch;
            assert!(diagnostics.observation(&changed, ID).is_err());
        }
        let mut changed = body.clone();
        changed["sequence"] = json!(2);
        assert!(diagnostics.observation(&changed, ID).is_err());
        changed["sequence"] = json!(1);
        changed["extra"] = json!("x".repeat(513));
        assert!(diagnostics.observation(&changed, ID).is_err());
        assert!(diagnostics.observation(&body, ID).is_ok());
        assert!(diagnostics.observation(&body, ID).is_err());
        assert!(!diagnostics.request_observation(ID));
        let queue = Queue::default();
        assert!(command_valid(
            &Command {
                id: 1,
                source: "() => true".into(),
                arg: Value::Null,
                close: false
            },
            &queue
        )
        .is_ok());
    }
    #[test]
    fn corpus_disables_pending_guest_observation_without_another_eval() {
        let diagnostics = Diagnostics::new();
        diagnostics.checkpoint(0, 1);
        let mut state = diagnostics.state.lock().unwrap();
        let elapsed = state.checkpoints[0].unwrap().elapsed_ms + 5000;
        assert!(state.stale_snapshot(ID, elapsed).is_some());
        drop(state);
        assert!(diagnostics.request_observation(ID));
        assert!(diagnostics
            .control(
                &serde_json::to_vec(&json!({ "runId": ID, "phase": "corpus" })).unwrap(),
                ID
            )
            .is_ok());
        assert!(diagnostics.observation(&json!({ "runId": ID, "url": "tauri://localhost/", "sequence": 1,
            "state": { "stage": "before-next", "lastCommandId": null, "visibility": "visible", "hasFocus": true } }), ID).is_err());
        diagnostics.observation_eval_failed(ID);
        assert!(!diagnostics.request_observation(ID));
        assert!(diagnostics.state.lock().unwrap().observation == Observation::Finished);
    }

    struct Scratch(PathBuf);
    impl Scratch {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir()
                .join(format!("lolly-webgpu-broker-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&path);
            Self(path)
        }
        fn write(&self, name: &str, bytes: &[u8]) {
            std::fs::write(self.0.join(name), bytes).unwrap();
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    const COMMAND_LINE: &[u8] = b"{\"id\":1,\"source\":\"() => true\"}\n";
    fn control_line(phase: &str) -> Vec<u8> {
        format!("{DIAGNOSTIC_CONTROL_PREFIX}{{\"runId\":\"{ID}\",\"phase\":\"{phase}\"}}\n")
            .into_bytes()
    }
    fn entry(sequence: u64, bytes: &[u8]) -> String {
        format!("{sequence}-{}.line", bytes.len())
    }

    #[test]
    fn inbox_delivers_complete_lines_in_order_exactly_once() {
        let scratch = Scratch::new("order");
        let mut inbox = Inbox::open(scratch.0.clone()).unwrap();
        let control = control_line("tool-wait");
        scratch.write(&entry(2, COMMAND_LINE), COMMAND_LINE);
        assert!(inbox.poll().unwrap().is_none());
        scratch.write(&entry(1, &control), &control);
        assert_eq!(inbox.poll().unwrap().unwrap(), control);
        assert!(!scratch.0.join(entry(1, &control)).exists());
        assert_eq!(inbox.poll().unwrap().unwrap(), COMMAND_LINE);
        assert!(inbox.poll().unwrap().is_none());
        assert_eq!(std::fs::read_dir(&scratch.0).unwrap().count(), 0);
        scratch.write(&entry(2, COMMAND_LINE), COMMAND_LINE);
        assert!(inbox.poll().is_err());
    }
    #[test]
    fn inbox_waits_for_a_copy_in_progress_and_ignores_transfer_files() {
        let scratch = Scratch::new("partial");
        let mut inbox = Inbox::open(scratch.0.clone()).unwrap();
        let name = entry(1, COMMAND_LINE);
        scratch.write(&format!("{name}.partial"), COMMAND_LINE);
        scratch.write(&format!(".{name}"), COMMAND_LINE);
        assert!(inbox.poll().unwrap().is_none());
        scratch.write(&name, &COMMAND_LINE[..10]);
        assert!(inbox.poll().unwrap().is_none());
        let mut preallocated = COMMAND_LINE.to_vec();
        preallocated[12..20].fill(0);
        scratch.write(&name, &preallocated);
        assert!(inbox.poll().unwrap().is_none());
        let mut unterminated = COMMAND_LINE.to_vec();
        *unterminated.last_mut().unwrap() = b' ';
        scratch.write(&name, &unterminated);
        assert!(inbox.poll().unwrap().is_none());
        scratch.write(&name, COMMAND_LINE);
        assert_eq!(inbox.poll().unwrap().unwrap(), COMMAND_LINE);
        scratch.write(
            &entry(2, COMMAND_LINE),
            &[COMMAND_LINE, b"\n".as_slice()].concat(),
        );
        assert!(inbox.poll().is_err());
    }
    #[test]
    fn inbox_refuses_unbounded_ambiguous_and_irregular_entries() {
        let oversized = format!("1-{}.line", COMMAND_LIMIT + 1);
        let beyond = format!("{}-5.line", INBOX_SEQUENCE_LIMIT + 1);
        for (index, names) in [
            vec!["0-5.line"],
            vec!["01-5.line"],
            vec!["1-05.line"],
            vec!["1-0.line"],
            vec![oversized.as_str()],
            vec![beyond.as_str()],
            vec!["99999999999999999999999-5.line"],
            vec!["1-5.line", "1-6.line"],
        ]
        .into_iter()
        .enumerate()
        {
            let scratch = Scratch::new(&format!("refuse-{index}"));
            let mut inbox = Inbox::open(scratch.0.clone()).unwrap();
            for name in names {
                scratch.write(name, b"line\n");
            }
            assert!(inbox.poll().is_err());
        }
        for name in [
            "notes.txt",
            "1-5.lines",
            "a-5.line",
            "1-.line",
            "-5.line",
            "1-5",
        ] {
            assert!(inbox_entry(name).is_none());
        }
        assert_eq!(
            inbox_entry("10016-1048576.line"),
            Some(Ok((10_016, COMMAND_LIMIT)))
        );
        let scratch = Scratch::new("directory-entry");
        let mut inbox = Inbox::open(scratch.0.clone()).unwrap();
        std::fs::create_dir(scratch.0.join("1-5.line")).unwrap();
        assert!(inbox.poll().is_err());
        let scratch = Scratch::new("crowded");
        let mut inbox = Inbox::open(scratch.0.clone()).unwrap();
        for index in 0..INBOX_ENTRY_LIMIT {
            scratch.write(&format!("transfer-{index}"), b"");
        }
        assert!(inbox.poll().unwrap().is_none());
        scratch.write("transfer-extra", b"");
        assert!(inbox.poll().is_err());
    }
    #[test]
    fn opening_the_inbox_removes_only_lines_an_earlier_launch_left() {
        let scratch = Scratch::new("stale");
        std::fs::create_dir_all(&scratch.0).unwrap();
        scratch.write(&entry(3, COMMAND_LINE), COMMAND_LINE);
        scratch.write(&entry(1, COMMAND_LINE), COMMAND_LINE);
        scratch.write("notes.txt", b"kept");
        let mut inbox = Inbox::open(scratch.0.clone()).unwrap();
        assert!(!scratch.0.join(entry(3, COMMAND_LINE)).exists());
        assert!(!scratch.0.join(entry(1, COMMAND_LINE)).exists());
        assert!(scratch.0.join("notes.txt").exists());
        assert!(inbox.poll().unwrap().is_none());
        #[cfg(unix)]
        {
            let link = Scratch::new("stale-link");
            std::os::unix::fs::symlink(&scratch.0, &link.0).unwrap();
            assert!(Inbox::open(link.0.clone()).is_err());
            let _ = std::fs::remove_file(&link.0);
        }
    }
    #[test]
    fn both_transports_share_one_bounded_intake() {
        let control = control_line("tool-wait");
        let scratch = Scratch::new("intake");
        let inbox = Inbox::open(scratch.0.clone()).unwrap();
        scratch.write(&entry(1, &control), &control);
        scratch.write(&entry(2, COMMAND_LINE), COMMAND_LINE);
        let stream = std::io::Cursor::new([control.as_slice(), COMMAND_LINE].concat());
        for mut input in [Input::Stream(Box::new(stream)), Input::Inbox(inbox)] {
            let diagnostics = Diagnostics::new();
            let queue = Mutex::new(Queue::default());
            for _ in 0..2 {
                let line = input.next_line().unwrap().unwrap();
                assert!(intake(&line, &diagnostics, &queue, ID).is_ok());
            }
            assert!(diagnostics.state.lock().unwrap().phase == Phase::ToolWait);
            let state = queue.lock().unwrap();
            assert_eq!((state.last, state.commands.len()), (1, 1));
        }
        let mut closed = Input::Stream(Box::new(std::io::Cursor::new(Vec::new())));
        assert!(closed.next_line().unwrap().is_none());
        let mut unbounded = Input::Stream(Box::new(std::io::Cursor::new(vec![
            b'x';
            COMMAND_LIMIT + 2
        ])));
        let line = unbounded.next_line().unwrap().unwrap();
        assert_eq!(line.len(), COMMAND_LIMIT + 1);
        let (diagnostics, queue) = (Diagnostics::new(), Mutex::new(Queue::default()));
        assert!(intake(&line, &diagnostics, &queue, ID).is_err());
        assert!(intake(&COMMAND_LINE[..10], &diagnostics, &queue, ID).is_err());
        assert!(queue.lock().unwrap().commands.is_empty());
    }
    #[test]
    fn a_refused_exit_closes_qualification_once_with_a_readable_failure() {
        let broker = |run_id: &str| Broker {
            run_id: run_id.into(),
            queue: Arc::new(Mutex::new(Queue::default())),
            diagnostics: Arc::new(Diagnostics::new()),
        };
        let requested = broker(ID);
        let row = requested.refuse_exit(Some(0)).unwrap();
        assert_eq!(
            row,
            json!({ "event": "failure", "runId": ID,
                "error": "Qualification refused an iOS exit request with code 0" })
        );
        assert!(requested.refuse_exit(None).is_none());
        assert!(requested.refuse_exit(Some(1)).is_none());
        let state = requested.queue.lock().unwrap();
        assert!(state.failed);
        let command = serde_json::from_slice::<Command>(COMMAND_LINE).unwrap();
        assert!(command_valid(&command, &state).is_err());
        drop(state);
        let closed = broker(ID).refuse_exit(None).unwrap();
        assert_eq!(
            closed["error"],
            "Qualification refused an iOS exit request after its last window closed"
        );
        assert!(broker(ID).refuse_exit(Some(i32::MIN)).unwrap()["error"]
            .as_str()
            .is_some_and(|error| error.len() <= 2048));
    }
}
