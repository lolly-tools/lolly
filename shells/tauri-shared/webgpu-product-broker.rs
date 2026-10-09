// SPDX-License-Identifier: MPL-2.0
//! Feature-only bounded stdio broker for the ordinary bundled GUI on an owned test identity.
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    io::{BufRead, Read, Write},
    sync::{Arc, Mutex},
};
use tauri::{
    ipc::{Invoke, InvokeBody},
    Manager, Runtime,
};

const PREFIX: &str = "tools.lolly.WebGpuProductQualification.r";
const COMMAND_LIMIT: usize = 1024 * 1024;
const REPLY_LIMIT: usize = 16 * 1024 * 1024;
const SOURCE_LIMIT: usize = 64 * 1024;

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
    app.manage(Broker {
        run_id: run_id.clone(),
        queue: queue.clone(),
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
                    let command: Command = serde_json::from_slice(&bytes)
                        .map_err(|_| "Malformed qualification command")?;
                    let mut state = queue.lock().map_err(|_| "Qualification queue failed")?;
                    command_valid(&command, &state)?;
                    state.last = command.id;
                    state.commands.push_back(command);
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
    }
}
