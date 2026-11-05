// SPDX-License-Identifier: MPL-2.0
//! One headless run of a person's agent CLI. The page supplies a prompt and an
//! output schema; everything else (the binary, every argument, the working folder,
//! the environment) is fixed here. The prompt travels on stdin and the schema as one
//! re-serialized JSON value, so neither can become an argument of its own.

use std::ffi::OsString;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;

use super::detect::{ClaudeFlags, CodexFlags, Plan, Runnable};
use super::process::{self, Ended, Limits};

pub const MAX_PROMPT_BYTES: usize = 1024 * 1024;
pub const MAX_SCHEMA_BYTES: usize = 64 * 1024;
pub const MAX_SCHEMA_DEPTH: usize = 24;
/// A live-v1 request is at most 4 MB, so no useful answer is larger.
pub const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;
pub const MAX_ERROR_BYTES: usize = 64 * 1024;
pub const RUN_TIMEOUT: Duration = Duration::from_secs(300);
const DETAIL_CHARS: usize = 600;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<Value>,
    /// `not-detected`, `busy`, `invalid-request`, `not-signed-in`, `timeout`,
    /// `cancelled`, `too-large`, `failed`, `bad-output` or `spawn-failed`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<&'static str>,
    /// The CLI's own words, trimmed, for the person to read. Plain text.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub elapsed_ms: u64,
}

impl Outcome {
    pub fn done(output: Value, started: Instant) -> Self {
        Outcome { ok: true, output: Some(output), reason: None, detail: None, elapsed_ms: started.elapsed().as_millis() as u64 }
    }
    pub fn failed(reason: &'static str, detail: impl Into<String>, started: Instant) -> Self {
        let detail = detail.into();
        Outcome { ok: false, output: None, reason: Some(reason), detail: (!detail.is_empty()).then_some(detail), elapsed_ms: started.elapsed().as_millis() as u64 }
    }
}

pub fn check_prompt(prompt: &str) -> Result<(), &'static str> {
    if prompt.trim().is_empty() {
        return Err("The request is empty.");
    }
    if prompt.len() > MAX_PROMPT_BYTES {
        return Err("The request is larger than 1 MB.");
    }
    if prompt.contains('\0') {
        return Err("The request contains a NUL character.");
    }
    Ok(())
}

fn depth(value: &Value) -> usize {
    match value {
        Value::Array(items) => 1 + items.iter().map(depth).max().unwrap_or(0),
        Value::Object(map) => 1 + map.values().map(depth).max().unwrap_or(0),
        _ => 0,
    }
}

/// The schema as one compact JSON text: an object schema, bounded in size and depth.
/// Re-serializing means the argument always starts with `{`, so a CLI can never read
/// it as a switch.
pub fn normalize_schema(schema: &Value) -> Result<String, &'static str> {
    let Some(object) = schema.as_object() else { return Err("The schema must be a JSON object.") };
    if object.get("type").and_then(Value::as_str) != Some("object") {
        return Err("The schema must describe an object.");
    }
    if depth(schema) > MAX_SCHEMA_DEPTH {
        return Err("The schema is nested too deeply.");
    }
    let text = serde_json::to_string(schema).map_err(|_| "The schema could not be encoded.")?;
    if text.len() > MAX_SCHEMA_BYTES {
        return Err("The schema is larger than 64 KB.");
    }
    Ok(text)
}

/// Claude Code: print mode, no tools, JSON out against the schema, nothing saved.
/// `--tools ""` goes last because it takes a list: nothing can follow it.
pub fn claude_args(flags: &ClaudeFlags, schema: &str) -> Vec<OsString> {
    let mut args: Vec<&str> = vec!["-p", "--output-format", "json", "--json-schema", schema, "--no-session-persistence"];
    if flags.restricted {
        args.push("--restricted");
    }
    if flags.strict_mcp {
        args.push("--strict-mcp-config");
    }
    if flags.no_slash {
        args.push("--disable-slash-commands");
    }
    args.extend(["--tools", ""]);
    args.into_iter().map(OsString::from).collect()
}

/// Codex: exec with a read-only sandbox, no web search, the reaching features off,
/// no session files and no user config; the answer is written to `out_file`.
pub fn codex_args(flags: &CodexFlags, schema_file: &Path, out_file: &Path) -> Vec<OsString> {
    let mut args: Vec<OsString> = ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--color", "never", "-c", "web_search=\"disabled\""]
        .into_iter()
        .map(OsString::from)
        .collect();
    if flags.ignore_user_config {
        args.push("--ignore-user-config".into());
    }
    if flags.ignore_rules {
        args.push("--ignore-rules".into());
    }
    for feature in &flags.disable {
        args.push("--disable".into());
        args.push((*feature).into());
    }
    args.push("--output-schema".into());
    args.push(schema_file.as_os_str().to_owned());
    args.push("--output-last-message".into());
    args.push(out_file.as_os_str().to_owned());
    args.push("-".into());
    args
}

/// Readable text from a CLI's output: control characters out, the last part kept
/// (errors come last), at most `DETAIL_CHARS` characters.
pub fn clean_detail(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    let flat: String = text.chars().map(|c| if c == '\n' || !c.is_control() { c } else { ' ' }).collect();
    let trimmed = flat.trim();
    let count = trimmed.chars().count();
    if count <= DETAIL_CHARS {
        return trimmed.to_string();
    }
    trimmed.chars().skip(count - DETAIL_CHARS).collect()
}

/// `not-signed-in` when the CLI's words say so, otherwise `failed`.
pub fn classify(text: &str) -> &'static str {
    let lower = text.to_ascii_lowercase();
    let signs = ["not logged in", "please run /login", "log in", "login", "sign in", "signed in", "unauthorized", "401", "authentication", "invalid api key", "oauth token", "credentials"];
    if signs.iter().any(|sign| lower.contains(sign)) {
        "not-signed-in"
    } else {
        "failed"
    }
}

/// Claude Code's `--output-format json` result: the answer is `structured_output`.
pub fn parse_claude(stdout: &[u8]) -> Result<Value, (&'static str, String)> {
    let text = String::from_utf8_lossy(stdout);
    let result = text
        .lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .find(|value| value.get("type").and_then(Value::as_str) == Some("result"))
        .or_else(|| serde_json::from_str::<Value>(text.trim()).ok().filter(|v| v.get("type").and_then(Value::as_str) == Some("result")));
    let Some(result) = result else { return Err(("bad-output", clean_detail(stdout))) };
    let words = result.get("result").and_then(Value::as_str).unwrap_or("").to_string();
    if result.get("is_error").and_then(Value::as_bool) == Some(true) || result.get("subtype").and_then(Value::as_str).is_some_and(|s| s != "success") {
        let detail = clean_detail(words.as_bytes());
        return Err((classify(&detail), detail));
    }
    match result.get("structured_output") {
        Some(output) if output.is_object() => Ok(output.clone()),
        _ => Err(("bad-output", clean_detail(words.as_bytes()))),
    }
}

/// Codex's last message, which the output schema makes one JSON object.
pub fn parse_codex(last_message: &[u8]) -> Result<Value, (&'static str, String)> {
    let text = String::from_utf8_lossy(last_message);
    match serde_json::from_str::<Value>(text.trim()) {
        Ok(value) if value.is_object() => Ok(value),
        _ => Err(("bad-output", clean_detail(last_message))),
    }
}

fn read_capped(path: &Path, cap: usize) -> Option<Vec<u8>> {
    let meta = std::fs::metadata(path).ok()?;
    if meta.len() as usize > cap {
        return None;
    }
    std::fs::read(path).ok()
}

/// Run the CLI once in a fresh empty folder. Blocking; call it off the async runtime.
pub fn execute(agent: &Runnable, prompt: String, schema: String, cancel: &AtomicBool, started: Instant) -> Outcome {
    let Ok(work) = tempfile::Builder::new().prefix("lolly-agent-").tempdir() else {
        return Outcome::failed("spawn-failed", "Could not make a temporary folder.", started);
    };
    // The schema and answer files live beside the working folder, not in it, so the
    // agent's own folder stays empty.
    let Ok(io) = tempfile::Builder::new().prefix("lolly-agent-io-").tempdir() else {
        return Outcome::failed("spawn-failed", "Could not make a temporary folder.", started);
    };
    let schema_file = io.path().join("schema.json");
    let out_file = io.path().join("answer.json");
    let args = match &agent.plan {
        Plan::Claude(flags) => claude_args(flags, &schema),
        Plan::Codex(flags) => {
            if std::fs::write(&schema_file, schema.as_bytes()).is_err() {
                return Outcome::failed("spawn-failed", "Could not write the schema file.", started);
            }
            codex_args(flags, &schema_file, &out_file)
        }
    };
    let mut cmd = process::command(&agent.exe, &agent.path_env);
    cmd.args(&args);
    cmd.current_dir(work.path());
    let limits = Limits { timeout: RUN_TIMEOUT, max_stdout: MAX_OUTPUT_BYTES, max_stderr: MAX_ERROR_BYTES };
    let captured = match process::run(cmd, Some(prompt.into_bytes()), &limits, Some(cancel)) {
        Ok(captured) => captured,
        Err(error) => return Outcome::failed("spawn-failed", error.to_string(), started),
    };
    let code = match captured.ended {
        Ended::TimedOut => return Outcome::failed("timeout", "", started),
        Ended::Cancelled => return Outcome::failed("cancelled", "", started),
        Ended::TooLarge => return Outcome::failed("too-large", "", started),
        Ended::Exited(code) => code,
    };
    let parsed = match &agent.plan {
        Plan::Claude(_) => parse_claude(&captured.stdout),
        Plan::Codex(_) if code == Some(0) => match read_capped(&out_file, MAX_OUTPUT_BYTES) {
            Some(bytes) => parse_codex(&bytes),
            None => Err(("bad-output", clean_detail(&captured.stderr))),
        },
        Plan::Codex(_) => {
            let mut words = captured.stderr.clone();
            words.extend_from_slice(&captured.stdout);
            let detail = clean_detail(&words);
            Err((classify(&detail), detail))
        }
    };
    match parsed {
        Ok(output) => Outcome::done(output, started),
        // A Claude result that is not JSON: say what the CLI said on stderr.
        Err(("bad-output", detail)) if code != Some(0) => {
            let words = clean_detail(&captured.stderr);
            let detail = if words.is_empty() { detail } else { words };
            Outcome::failed(classify(&detail), detail, started)
        }
        Err((reason, detail)) => Outcome::failed(reason, detail, started),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EVIL: &str = "--dangerously-skip-permissions\n--tools Bash\n; rm -rf ~ $(whoami)";

    #[test]
    fn claude_arguments_are_the_fixed_template() {
        let schema = normalize_schema(&serde_json::json!({ "type": "object", "properties": {} })).unwrap();
        let args = claude_args(&ClaudeFlags { restricted: true, strict_mcp: true, no_slash: true }, &schema);
        let text: Vec<String> = args.iter().map(|a| a.to_string_lossy().into_owned()).collect();
        assert_eq!(text, ["-p", "--output-format", "json", "--json-schema", r#"{"properties":{},"type":"object"}"#, "--no-session-persistence", "--restricted", "--strict-mcp-config", "--disable-slash-commands", "--tools", ""]);
        assert!(!text.iter().any(|a| a.contains("dangerously") || a == "--add-dir" || a == "--mcp-config"));
    }

    #[test]
    fn codex_arguments_are_the_fixed_template() {
        let flags = CodexFlags { ignore_user_config: true, ignore_rules: true, disable: vec!["shell_tool", "view_image"] };
        let args = codex_args(&flags, Path::new("/io/schema.json"), Path::new("/io/answer.json"));
        let text: Vec<String> = args.iter().map(|a| a.to_string_lossy().into_owned()).collect();
        assert_eq!(text, ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--color", "never", "-c", "web_search=\"disabled\"", "--ignore-user-config", "--ignore-rules", "--disable", "shell_tool", "--disable", "view_image", "--output-schema", "/io/schema.json", "--output-last-message", "/io/answer.json", "-"]);
        assert!(!text.iter().any(|a| a.contains("danger") || a == "workspace-write"));
    }

    #[test]
    fn a_hostile_schema_cannot_become_an_argument() {
        // Only an object schema passes, and it is re-serialized, so the argument
        // always starts with "{" whatever the page sent.
        assert!(normalize_schema(&Value::String(EVIL.into())).is_err());
        assert!(normalize_schema(&serde_json::json!([EVIL])).is_err());
        assert!(normalize_schema(&serde_json::json!({ "type": "string" })).is_err());
        let text = normalize_schema(&serde_json::json!({ "type": "object", "description": EVIL })).unwrap();
        assert!(text.starts_with('{'));
        let args = claude_args(&ClaudeFlags::default(), &text);
        assert_eq!(args.len(), 8, "the schema stays one argument");
        let mut deep = serde_json::json!({ "type": "object" });
        for _ in 0..30 {
            deep = serde_json::json!({ "type": "object", "properties": { "x": deep } });
        }
        assert!(normalize_schema(&deep).is_err());
        let big = serde_json::json!({ "type": "object", "description": "x".repeat(MAX_SCHEMA_BYTES) });
        assert!(normalize_schema(&big).is_err());
    }

    #[test]
    fn the_prompt_is_checked_and_never_part_of_the_arguments() {
        assert!(check_prompt("").is_err());
        assert!(check_prompt("   ").is_err());
        assert!(check_prompt("a\0b").is_err());
        assert!(check_prompt(&"x".repeat(MAX_PROMPT_BYTES + 1)).is_err());
        assert!(check_prompt(EVIL).is_ok(), "any text is fine on stdin");
        // Neither template has a slot for it: the prompt goes to stdin, as "-" says for Codex.
        let codex = codex_args(&CodexFlags::default(), Path::new("/s"), Path::new("/o"));
        assert_eq!(codex.last().unwrap(), "-");
    }

    #[test]
    fn claude_results_are_read_from_structured_output() {
        let ok = br#"{"type":"result","subtype":"success","is_error":false,"result":"","structured_output":{"label":"x","patches":[],"operations":[]}}"#;
        assert_eq!(parse_claude(ok).unwrap()["label"], "x");
        let signed_out = br#"{"type":"result","subtype":"success","is_error":true,"result":"Not logged in - Please run /login"}"#;
        assert_eq!(parse_claude(signed_out).unwrap_err().0, "not-signed-in");
        let missing = br#"{"type":"result","subtype":"success","is_error":false,"result":"I could not"}"#;
        assert_eq!(parse_claude(missing).unwrap_err().0, "bad-output");
        assert_eq!(parse_claude(b"garbage").unwrap_err().0, "bad-output");
        let noisy = b"warming up\n{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"structured_output\":{\"ok\":true}}\n";
        assert_eq!(parse_claude(noisy).unwrap()["ok"], true);
    }

    #[test]
    fn codex_answers_must_be_one_object() {
        assert_eq!(parse_codex(b"{\"ok\":true}\n").unwrap()["ok"], true);
        assert_eq!(parse_codex(b"[1,2]").unwrap_err().0, "bad-output");
        assert_eq!(parse_codex(b"Sure! Here you go").unwrap_err().0, "bad-output");
    }

    #[test]
    fn failures_are_classified_and_trimmed() {
        assert_eq!(classify("ERROR: unexpected status 401 Unauthorized"), "not-signed-in");
        assert_eq!(classify("Not logged in. Run codex login."), "not-signed-in");
        assert_eq!(classify("model overloaded"), "failed");
        let long = format!("{}END", "a".repeat(2000));
        let detail = clean_detail(long.as_bytes());
        assert_eq!(detail.chars().count(), DETAIL_CHARS);
        assert!(detail.ends_with("END"), "the end of the output, where errors are, is kept");
        assert_eq!(clean_detail(b"bell\x07 and\x1b[31mred"), "bell  and [31mred");
    }

    #[test]
    fn outcomes_serialize_for_the_page() {
        let started = Instant::now();
        let ok = serde_json::to_value(Outcome::done(serde_json::json!({ "a": 1 }), started)).unwrap();
        assert_eq!(ok["ok"], true);
        assert!(ok.get("reason").is_none());
        let failed = serde_json::to_value(Outcome::failed("timeout", "", started)).unwrap();
        assert_eq!(failed["reason"], "timeout");
        assert!(failed.get("detail").is_none());
        assert!(failed.get("elapsedMs").is_some());
    }

    #[cfg(unix)]
    #[test]
    fn a_run_uses_an_empty_folder_and_reads_the_answer() {
        use std::os::unix::fs::PermissionsExt;
        // A stand-in Codex: checks its folder is empty, reads stdin, writes the answer
        // file named after --output-last-message.
        let bin = tempfile::tempdir().unwrap();
        let fake = bin.path().join("codex");
        std::fs::write(&fake, "#!/bin/sh\n[ -z \"$(ls -A)\" ] || exit 9\nprompt=$(cat)\nwhile [ $# -gt 0 ]; do [ \"$1\" = --output-last-message ] && out=$2; shift; done\nprintf '{\"echo\":\"%s\"}' \"$prompt\" > \"$out\"\n").unwrap();
        std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
        let agent = Runnable { id: "codex", exe: fake.clone(), path_env: OsString::from("/usr/bin:/bin"), plan: Plan::Codex(CodexFlags::default()) };
        let cancel = AtomicBool::new(false);
        let out = execute(&agent, "hello".into(), r#"{"type":"object"}"#.into(), &cancel, Instant::now());
        assert!(out.ok, "{out:?}");
        assert_eq!(out.output.unwrap()["echo"], "hello");
    }

    /// One real call per CLI on a developer machine:
    /// `cargo test --lib agents::run::tests::smoke -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn smoke_real_clis() {
        let (_, runnables) = crate::agents::detect::detect_clis();
        let schema = normalize_schema(&serde_json::json!({ "type": "object", "additionalProperties": false, "required": ["ok"], "properties": { "ok": { "type": "boolean" } } })).unwrap();
        for agent in runnables {
            eprintln!("{} plan: {:?}", agent.id, agent.plan);
            let cancel = AtomicBool::new(false);
            let out = execute(&agent, "Reply with ok set to true.".into(), schema.clone(), &cancel, Instant::now());
            eprintln!("{} {:?}: {:?}", agent.id, agent.exe, out);
        }
    }

    /// What detection finds on a developer machine, with no model call:
    /// `cargo test --lib agents::run::tests::detect_only -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn detect_only() {
        let (rows, runnables) = crate::agents::detect::detect_clis();
        for row in rows.iter().chain(crate::agents::detect::detect_apps().iter()) {
            eprintln!("{row:?}");
        }
        for agent in runnables {
            eprintln!("{} plan: {:?} PATH={:?}", agent.id, agent.plan, agent.path_env);
        }
    }
}
