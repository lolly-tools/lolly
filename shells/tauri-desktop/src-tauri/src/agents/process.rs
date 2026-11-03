// SPDX-License-Identifier: MPL-2.0
//! One child process for device agents: no shell, a scrubbed environment, a deadline,
//! a cancel flag and capped output. Detection (version and help reads, the login
//! shell probe) and runs both come through here, so every process this feature starts
//! obeys the same limits.

use std::ffi::OsString;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// The only variables a child inherits. API keys, cloud credentials, tokens and every
/// other variable are dropped. HOME (USERPROFILE and APPDATA on Windows) stays so the
/// CLI finds its own sign-in; the proxy and certificate variables stay so it can reach
/// its provider from a managed network.
pub const ENV_ALLOW: &[&str] = &[
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LC_MESSAGES",
    "TZ",
    "TMPDIR",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
    "XDG_CACHE_HOME",
    "XDG_RUNTIME_DIR",
    // Linux keyrings answer on the session bus; the address is a socket path.
    "DBUS_SESSION_BUS_ADDRESS",
    // Where a CLI keeps its sign-in when the person moved it.
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "ALL_PROXY",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "NODE_EXTRA_CA_CERTS",
    // Windows: the profile, the system root and the temp folders.
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "PROGRAMDATA",
    "SystemRoot",
    "SystemDrive",
    "windir",
    "ComSpec",
    "PATHEXT",
    "TEMP",
    "TMP",
    "HOMEDRIVE",
    "HOMEPATH",
    "USERNAME",
];

/// The allowlisted subset of an environment. `lookup` is `std::env::var_os` in the
/// app and a fixed table in tests.
pub fn scrubbed_env(lookup: &dyn Fn(&str) -> Option<OsString>) -> Vec<(&'static str, OsString)> {
    ENV_ALLOW
        .iter()
        .filter_map(|key| lookup(key).filter(|value| !value.is_empty()).map(|value| (*key, value)))
        .collect()
}

/// A command with no inherited environment: the allowlist, the given PATH, and the
/// switches that keep a CLI from drawing colour or prompting.
pub fn command(program: &std::path::Path, path_env: &OsString) -> Command {
    let mut cmd = Command::new(program);
    cmd.env_clear();
    for (key, value) in scrubbed_env(&|key| std::env::var_os(key)) {
        cmd.env(key, value);
    }
    cmd.env("PATH", path_env);
    cmd.env("TERM", "dumb");
    cmd.env("NO_COLOR", "1");
    cmd.env("CI", "1");
    cmd
}

pub struct Limits {
    pub timeout: Duration,
    pub max_stdout: usize,
    pub max_stderr: usize,
}

#[derive(Debug, PartialEq)]
pub enum Ended {
    Exited(Option<i32>),
    TimedOut,
    Cancelled,
    TooLarge,
}

pub struct Captured {
    pub ended: Ended,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Collect one pipe into a shared buffer. Past `cap` the bytes are dropped and
/// `overflow` is raised, which ends the run when it is stdout.
fn collect(mut pipe: impl Read + Send + 'static, cap: usize, overflow: Option<Arc<AtomicBool>>) -> (Arc<Mutex<Vec<u8>>>, std::sync::mpsc::Receiver<()>) {
    let buf = Arc::new(Mutex::new(Vec::new()));
    let (done_tx, done_rx) = std::sync::mpsc::channel();
    let sink = buf.clone();
    std::thread::spawn(move || {
        let mut chunk = [0u8; 16 * 1024];
        loop {
            match pipe.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let Ok(mut held) = sink.lock() else { break };
                    let room = cap.saturating_sub(held.len());
                    held.extend_from_slice(&chunk[..n.min(room)]);
                    if n > room {
                        if let Some(flag) = &overflow {
                            flag.store(true, Ordering::SeqCst);
                            break;
                        }
                    }
                }
            }
        }
        let _ = done_tx.send(());
    });
    (buf, done_rx)
}

#[cfg(unix)]
fn isolate(cmd: &mut Command) {
    use std::os::unix::process::CommandExt;
    // Its own process group, so a cancel reaches the helpers a CLI starts too.
    cmd.process_group(0);
}

#[cfg(windows)]
fn isolate(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW: no console flashes up for a background process.
    cmd.creation_flags(0x0800_0000);
}

#[cfg(not(any(unix, windows)))]
fn isolate(_cmd: &mut Command) {}

/// Stop the child and, on unix, everything in its process group. Called only while
/// the child is unreaped, so its id cannot have been handed to another process.
fn stop(child: &mut Child) {
    #[cfg(unix)]
    {
        let group = child.id() as libc::pid_t;
        // SAFETY: kill(2) with a negative id signals that process group only.
        unsafe { libc::kill(-group, libc::SIGTERM) };
        let grace = Instant::now();
        while grace.elapsed() < Duration::from_millis(400) {
            if matches!(child.try_wait(), Ok(Some(_))) {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        // SAFETY: as above; a group with no members left answers ESRCH, which is fine.
        unsafe { libc::kill(-group, libc::SIGKILL) };
    }
    let _ = child.kill();
    let _ = child.wait();
}

/// Run to completion, deadline, cancel or overflow. `stdin` is written on its own
/// thread so a child that prints before it reads cannot deadlock the pipe.
pub fn run(mut cmd: Command, stdin: Option<Vec<u8>>, limits: &Limits, cancel: Option<&AtomicBool>) -> std::io::Result<Captured> {
    cmd.stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() });
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    isolate(&mut cmd);
    let mut child = cmd.spawn()?;
    if let (Some(bytes), Some(mut pipe)) = (stdin, child.stdin.take()) {
        std::thread::spawn(move || {
            let _ = pipe.write_all(&bytes);
            // Dropping the pipe closes it: the CLI sees the end of the prompt.
        });
    }
    let overflow = Arc::new(AtomicBool::new(false));
    let (out, out_done) = collect(child.stdout.take().expect("piped stdout"), limits.max_stdout, Some(overflow.clone()));
    let (err, err_done) = collect(child.stderr.take().expect("piped stderr"), limits.max_stderr, None);
    let start = Instant::now();
    let ended = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ended::Exited(status.code()),
            Ok(None) => {}
            Err(e) => {
                stop(&mut child);
                return Err(e);
            }
        }
        if overflow.load(Ordering::SeqCst) {
            stop(&mut child);
            break Ended::TooLarge;
        }
        if cancel.is_some_and(|flag| flag.load(Ordering::SeqCst)) {
            stop(&mut child);
            break Ended::Cancelled;
        }
        if start.elapsed() >= limits.timeout {
            stop(&mut child);
            break Ended::TimedOut;
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    // A helper that left the group can hold a pipe open; take what arrived and go.
    let _ = out_done.recv_timeout(Duration::from_secs(2));
    let _ = err_done.recv_timeout(Duration::from_millis(500));
    let take = |buf: &Arc<Mutex<Vec<u8>>>| buf.lock().map(|held| held.clone()).unwrap_or_default();
    // A child that exited just as it overflowed still handed back truncated output.
    let ended = if matches!(ended, Ended::Exited(_)) && overflow.load(Ordering::SeqCst) { Ended::TooLarge } else { ended };
    Ok(Captured { ended, stdout: take(&out), stderr: take(&err) })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sys_path() -> OsString {
        OsString::from("/usr/bin:/bin")
    }

    fn limits(ms: u64, out: usize) -> Limits {
        Limits { timeout: Duration::from_millis(ms), max_stdout: out, max_stderr: 4096 }
    }

    #[test]
    fn the_scrub_keeps_home_and_drops_keys_and_tokens() {
        let table: HashMap<&str, &str> = [
            ("HOME", "/Users/someone"),
            ("PATH", "/evil/bin"),
            ("ANTHROPIC_API_KEY", "sk-ant-secret"),
            ("OPENAI_API_KEY", "sk-secret"),
            ("GITHUB_TOKEN", "ghp_secret"),
            ("AWS_SECRET_ACCESS_KEY", "secret"),
            ("DYLD_INSERT_LIBRARIES", "/tmp/x.dylib"),
            ("LD_PRELOAD", "/tmp/x.so"),
            ("NODE_OPTIONS", "--require /tmp/x.js"),
            ("HTTPS_PROXY", "http://proxy:3128"),
        ]
        .into_iter()
        .collect();
        let kept = scrubbed_env(&|key| table.get(key).map(OsString::from));
        let names: Vec<&str> = kept.iter().map(|(k, _)| *k).collect();
        assert!(names.contains(&"HOME"));
        assert!(names.contains(&"HTTPS_PROXY"));
        for dropped in ["PATH", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "DYLD_INSERT_LIBRARIES", "LD_PRELOAD", "NODE_OPTIONS"] {
            assert!(!names.contains(&dropped), "{dropped} must not reach an agent process");
        }
    }

    #[test]
    fn the_allowlist_names_no_credential_variable() {
        for key in ENV_ALLOW {
            let upper = key.to_ascii_uppercase();
            for word in ["KEY", "TOKEN", "SECRET", "PASSWORD", "PRELOAD", "INSERT", "OPTIONS"] {
                assert!(!upper.contains(word), "{key} looks like a credential or injection variable");
            }
        }
    }

    #[test]
    fn a_child_sees_only_the_scrubbed_environment() {
        std::env::set_var("LOLLY_AGENT_TEST_SECRET", "should-not-pass");
        let cmd = command(std::path::Path::new("/usr/bin/env"), &sys_path());
        let got = run(cmd, None, &limits(5_000, 64 * 1024), None).unwrap();
        let text = String::from_utf8_lossy(&got.stdout);
        assert_eq!(got.ended, Ended::Exited(Some(0)));
        assert!(!text.contains("LOLLY_AGENT_TEST_SECRET"));
        assert!(text.contains("PATH=/usr/bin:/bin"));
        assert!(text.contains("TERM=dumb"));
    }

    #[test]
    fn the_prompt_arrives_on_stdin() {
        let cmd = command(std::path::Path::new("/bin/cat"), &sys_path());
        let got = run(cmd, Some(b"hello agent".to_vec()), &limits(5_000, 1024), None).unwrap();
        assert_eq!(got.stdout, b"hello agent");
    }

    #[test]
    fn the_deadline_stops_a_process_that_never_ends() {
        let mut cmd = command(std::path::Path::new("/bin/sleep"), &sys_path());
        cmd.arg("30");
        let start = Instant::now();
        let got = run(cmd, None, &limits(300, 1024), None).unwrap();
        assert_eq!(got.ended, Ended::TimedOut);
        assert!(start.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn the_deadline_reaches_helpers_in_the_process_group() {
        // The shell starts a helper and waits on it; stopping the group ends both.
        let mut cmd = command(std::path::Path::new("/bin/sh"), &sys_path());
        cmd.args(["-c", "sleep 30 & wait"]);
        let start = Instant::now();
        let got = run(cmd, None, &limits(300, 1024), None).unwrap();
        assert_eq!(got.ended, Ended::TimedOut);
        assert!(start.elapsed() < Duration::from_secs(5), "the helper held the pipe open");
    }

    #[test]
    fn output_past_the_cap_ends_the_run() {
        let cmd = command(std::path::Path::new("/usr/bin/yes"), &sys_path());
        let got = run(cmd, None, &limits(10_000, 64 * 1024), None).unwrap();
        assert_eq!(got.ended, Ended::TooLarge);
        assert!(got.stdout.len() <= 64 * 1024);
    }

    #[test]
    fn cancel_stops_the_run() {
        let flag = Arc::new(AtomicBool::new(false));
        let trip = flag.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(150));
            trip.store(true, Ordering::SeqCst);
        });
        let mut cmd = command(std::path::Path::new("/bin/sleep"), &sys_path());
        cmd.arg("30");
        let got = run(cmd, None, &limits(20_000, 1024), Some(&flag)).unwrap();
        assert_eq!(got.ended, Ended::Cancelled);
    }
}
