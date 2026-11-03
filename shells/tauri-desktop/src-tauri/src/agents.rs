// SPDX-License-Identifier: MPL-2.0
//! Device agents without local MCP: Lolly finds the agent CLIs, agent apps and local
//! model servers on this device and runs a CLI headless as the model behind "Ask an
//! agent". Three commands, GUI only, main window only (presentation_windows.rs):
//!
//!   - `agents_detect` checks a fixed list and caches what can run. It runs when the
//!     person opens the panel, and sends nothing anywhere.
//!   - `agents_run` takes `{agentId, prompt, schema}`. The binary comes from that
//!     cache and every argument from a fixed per-agent template (agents/run.rs): no
//!     shell, the prompt on stdin, a fresh empty folder, an allowlisted environment,
//!     a deadline, one run at a time and capped output. The CLI runs with no tools.
//!   - `agents_cancel` stops the current run and the helpers it started.
//!
//! The page decides whether the feature is allowed (the `agents` AI capability) and
//! applies the answer through its live-v1 session, so every change is an ordinary
//! undoable history step.

mod detect;
mod process;
mod run;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub use detect::Detected;
use detect::Runnable;
pub use run::Outcome;

static CACHE: Mutex<Vec<Runnable>> = Mutex::new(Vec::new());
static ACTIVE: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);
static DETECTING: Mutex<()> = Mutex::new(());

/// The cached CLI for an id, only if the fixed list says it runs. The page names an
/// agent; it can never name a path.
fn runnable(id: &str, cache: &[Runnable]) -> Option<Runnable> {
    detect::CLIS.iter().find(|spec| spec.id == id && spec.runs)?;
    cache.iter().find(|agent| agent.id == id).cloned()
}

/// Frees the run slot however the run ends.
struct Slot;
impl Drop for Slot {
    fn drop(&mut self) {
        if let Ok(mut active) = ACTIVE.lock() {
            *active = None;
        }
    }
}

#[tauri::command]
pub async fn agents_detect() -> Result<Vec<Detected>, String> {
    let blocking = tauri::async_runtime::spawn_blocking(|| {
        let _one_at_a_time = DETECTING.lock();
        let (mut rows, runnables) = detect::detect_clis();
        rows.extend(detect::detect_apps());
        (rows, runnables)
    });
    let models = detect::detect_local_models().await;
    let (mut rows, runnables) = blocking.await.map_err(|e| e.to_string())?;
    if let Ok(mut cache) = CACHE.lock() {
        *cache = runnables;
    }
    rows.extend(models);
    Ok(rows)
}

#[tauri::command]
pub async fn agents_run(agent_id: String, prompt: String, schema: serde_json::Value) -> Result<Outcome, String> {
    let started = Instant::now();
    if let Err(reason) = run::check_prompt(&prompt) {
        return Ok(Outcome::failed("invalid-request", reason, started));
    }
    let schema = match run::normalize_schema(&schema) {
        Ok(text) => text,
        Err(reason) => return Ok(Outcome::failed("invalid-request", reason, started)),
    };
    let cached = CACHE.lock().map(|cache| runnable(&agent_id, &cache)).unwrap_or(None);
    let Some(agent) = cached else {
        return Ok(Outcome::failed("not-detected", "", started));
    };
    // The file may have changed since detection; check it again before starting it.
    if detect::unsafe_location(&agent.exe).is_some() {
        return Ok(Outcome::failed("not-detected", "", started));
    }
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let Ok(mut active) = ACTIVE.lock() else { return Err("The run lock is unavailable.".into()) };
        if active.is_some() {
            return Ok(Outcome::failed("busy", "", started));
        }
        *active = Some(cancel.clone());
    }
    let slot = Slot;
    let outcome = tauri::async_runtime::spawn_blocking(move || run::execute(&agent, prompt, schema, &cancel, started))
        .await
        .map_err(|e| e.to_string());
    drop(slot);
    outcome
}

#[tauri::command]
pub fn agents_cancel() -> bool {
    match ACTIVE.lock().ok().and_then(|active| active.clone()) {
        Some(flag) => {
            flag.store(true, Ordering::SeqCst);
            true
        }
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use detect::{ClaudeFlags, Plan};
    use std::ffi::OsString;
    use std::path::PathBuf;

    fn cached(id: &'static str) -> Runnable {
        Runnable { id, exe: PathBuf::from("/opt/agent"), path_env: OsString::from("/usr/bin"), plan: Plan::Claude(ClaudeFlags::default()) }
    }

    #[test]
    fn only_cached_runnable_ids_resolve() {
        let cache = vec![cached("claude"), cached("gemini")];
        assert_eq!(runnable("claude", &cache).map(|a| a.exe), Some(PathBuf::from("/opt/agent")));
        assert!(runnable("codex", &cache).is_none(), "not detected in this session");
        assert!(runnable("gemini", &cache).is_none(), "detected, but has no run template");
        assert!(runnable("/bin/sh", &cache).is_none());
        assert!(runnable("../claude", &cache).is_none());
    }

    #[test]
    fn cancel_without_a_run_is_a_no_op() {
        assert!(!agents_cancel());
    }

    #[test]
    fn the_commands_take_no_path_or_argument_from_the_page() {
        // The run command's whole input is these three names; there is no path, flag,
        // working folder, environment or timeout parameter for the page to fill.
        let source = include_str!("agents.rs");
        let signature = source.split("pub async fn agents_run(").nth(1).unwrap().split(')').next().unwrap();
        assert_eq!(signature, "agent_id: String, prompt: String, schema: serde_json::Value");
    }

    #[test]
    fn the_desktop_registers_the_commands_in_the_gui_only() {
        let lib = include_str!("lib.rs");
        for command in ["agents::agents_detect", "agents::agents_run", "agents::agents_cancel"] {
            assert!(lib.contains(command), "{command} is registered for the main window");
        }
        for headless in [include_str!("cli.rs"), include_str!("render_server.rs")] {
            assert!(!headless.contains("agents_"), "a headless render never starts an agent");
        }
    }
}
