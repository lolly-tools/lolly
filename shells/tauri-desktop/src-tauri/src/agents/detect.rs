// SPDX-License-Identifier: MPL-2.0
//! What is installed: agent CLIs from a fixed list, agent apps by bundle id, install
//! path or desktop entry, and local model servers on loopback. Nothing here reads a
//! credential file, and nothing is sent anywhere: the only network requests go to
//! 127.0.0.1.

use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;

use super::process::{self, Ended, Limits};

/// One CLI Lolly looks for. Only `runs` CLIs have a run template; the others are
/// listed so the person can see what Lolly found.
pub struct CliSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub binary: &'static str,
    pub runs: bool,
}

pub const CLIS: &[CliSpec] = &[
    CliSpec { id: "claude", label: "Claude Code", binary: "claude", runs: true },
    CliSpec { id: "codex", label: "Codex", binary: "codex", runs: true },
    CliSpec { id: "gemini", label: "Gemini CLI", binary: "gemini", runs: false },
    CliSpec { id: "copilot", label: "GitHub Copilot CLI", binary: "copilot", runs: false },
];

/// One agent app. macOS ids were read from installed bundles where available
/// (Claude, Codex and Visual Studio Code); the rest are the vendors' published ids.
pub struct AppSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub mac_bundle_ids: &'static [&'static str],
    /// (environment variable holding a base folder, path below it).
    pub windows_paths: &'static [(&'static str, &'static str)],
    /// Executable names registered under App Paths.
    pub windows_app_paths: &'static [&'static str],
    pub linux_desktop_ids: &'static [&'static str],
}

pub const APPS: &[AppSpec] = &[
    AppSpec {
        id: "claude-app",
        label: "Claude",
        mac_bundle_ids: &["com.anthropic.claudefordesktop"],
        windows_paths: &[("LOCALAPPDATA", "AnthropicClaude\\claude.exe")],
        windows_app_paths: &["claude.exe"],
        linux_desktop_ids: &[],
    },
    AppSpec {
        id: "chatgpt-app",
        label: "ChatGPT",
        mac_bundle_ids: &["com.openai.chat"],
        windows_paths: &[],
        windows_app_paths: &["ChatGPT.exe"],
        linux_desktop_ids: &[],
    },
    AppSpec {
        id: "codex-app",
        label: "Codex",
        mac_bundle_ids: &["com.openai.codex"],
        windows_paths: &[],
        windows_app_paths: &["Codex.exe"],
        linux_desktop_ids: &[],
    },
    AppSpec {
        id: "cursor",
        label: "Cursor",
        mac_bundle_ids: &["com.todesktop.230313mzl4w4u92"],
        windows_paths: &[("LOCALAPPDATA", "Programs\\cursor\\Cursor.exe")],
        windows_app_paths: &["Cursor.exe"],
        linux_desktop_ids: &["cursor.desktop", "co.anysphere.cursor.desktop"],
    },
    AppSpec {
        id: "vscode",
        label: "Visual Studio Code",
        mac_bundle_ids: &["com.microsoft.VSCode"],
        windows_paths: &[
            ("LOCALAPPDATA", "Programs\\Microsoft VS Code\\Code.exe"),
            ("ProgramFiles", "Microsoft VS Code\\Code.exe"),
        ],
        windows_app_paths: &["Code.exe"],
        linux_desktop_ids: &["code.desktop", "com.visualstudio.code.desktop", "code_code.desktop"],
    },
    AppSpec {
        id: "lm-studio",
        label: "LM Studio",
        mac_bundle_ids: &["ai.elementlabs.lmstudio"],
        windows_paths: &[("LOCALAPPDATA", "Programs\\LM Studio\\LM Studio.exe")],
        windows_app_paths: &["LM Studio.exe"],
        linux_desktop_ids: &["lm-studio.desktop", "lmstudio.desktop"],
    },
    AppSpec {
        id: "ollama-app",
        label: "Ollama",
        mac_bundle_ids: &["com.electron.ollama"],
        windows_paths: &[("LOCALAPPDATA", "Programs\\Ollama\\ollama app.exe")],
        windows_app_paths: &[],
        linux_desktop_ids: &[],
    },
];

/// One row of the detection result, as the page sees it.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Detected {
    pub id: &'static str,
    /// `cli`, `app` or `local-model`.
    pub kind: &'static str,
    pub label: &'static str,
    pub path: String,
    pub version: Option<String>,
    pub runnable: bool,
    /// Why a found agent cannot run: `detect-only`, `update`, `batch-shim`,
    /// `unsafe-location` or `later`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<&'static str>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub models: Vec<String>,
}

/// Optional hardening switches the installed Claude Code offers, read from its help.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ClaudeFlags {
    pub restricted: bool,
    pub strict_mcp: bool,
    pub no_slash: bool,
}

/// What the installed Codex offers: which config files it can skip and which of the
/// features Lolly turns off exist in this version (naming an unknown one is an error).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CodexFlags {
    pub ignore_user_config: bool,
    pub ignore_rules: bool,
    pub disable: Vec<&'static str>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Plan {
    Claude(ClaudeFlags),
    Codex(CodexFlags),
}

/// A CLI Lolly may run: the binary detection resolved, the PATH its child gets, and
/// the template its arguments come from. The page never supplies any of these.
#[derive(Clone, Debug)]
pub struct Runnable {
    pub id: &'static str,
    pub exe: PathBuf,
    pub path_env: OsString,
    pub plan: Plan,
}

/// Codex features that reach outside the prompt: commands, images on disk, apps,
/// plugins, browsers, image generation and hooks.
pub const CODEX_DISABLE: &[&str] = &[
    "shell_tool",
    "unified_exec",
    "view_image",
    "apps",
    "plugins",
    "browser_use",
    "computer_use",
    "image_generation",
    "in_app_browser",
    "hooks",
];

const PROBE_BEGIN: &str = "__LOLLY_AGENTS_BEGIN__";
const PROBE_END: &str = "__LOLLY_AGENTS_END__";
const PROBE_TIMEOUT: Duration = Duration::from_secs(6);
const READ_TIMEOUT: Duration = Duration::from_secs(6);
const SYSTEM_PATH: &str = "/usr/bin:/bin:/usr/sbin:/sbin";

// ── pure parts ────────────────────────────────────────────────────────────────

/// The first version-looking token in a `--version` line, capped at 40 characters.
pub fn parse_version(text: &str) -> Option<String> {
    for token in text.split(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == ',') {
        let token = token.trim_start_matches(['v', 'V']);
        let mut parts = token.split('.');
        let major = parts.next().unwrap_or("");
        let minor = parts.next().unwrap_or("");
        let numeric = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit());
        let minor_digits: String = minor.chars().take_while(|c| c.is_ascii_digit()).collect();
        if numeric(major) && !minor_digits.is_empty() {
            let clean: String = token
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '+'))
                .take(40)
                .collect();
            return Some(clean);
        }
    }
    None
}

fn has_flag(help: &str, flag: &str) -> bool {
    help.split(|c: char| c.is_whitespace() || c == ',' || c == '[' || c == ']' || c == '=')
        .any(|word| word == flag)
}

/// The switches Lolly needs from Claude Code, or None when this version lacks one.
pub fn claude_flags(help: &str) -> Option<ClaudeFlags> {
    let required = ["--print", "--output-format", "--json-schema", "--tools", "--no-session-persistence"];
    if !required.iter().all(|flag| has_flag(help, flag)) {
        return None;
    }
    Some(ClaudeFlags {
        restricted: has_flag(help, "--restricted"),
        strict_mcp: has_flag(help, "--strict-mcp-config"),
        no_slash: has_flag(help, "--disable-slash-commands"),
    })
}

/// Feature names from `codex features list`, leaving out removed ones.
pub fn codex_features(list: &str) -> Vec<String> {
    list.lines()
        .filter_map(|line| {
            let mut cols = line.split_whitespace();
            let name = cols.next()?;
            let rest: Vec<&str> = cols.collect();
            let removed = rest.contains(&"removed");
            let valid = name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
            (valid && !removed && !rest.is_empty()).then(|| name.to_string())
        })
        .collect()
}

/// The switches Lolly needs from `codex exec`, or None when this version lacks one.
pub fn codex_flags(exec_help: &str, features: &[String]) -> Option<CodexFlags> {
    let required = ["--sandbox", "--skip-git-repo-check", "--ephemeral", "--output-schema", "--output-last-message"];
    if !required.iter().all(|flag| has_flag(exec_help, flag)) {
        return None;
    }
    Some(CodexFlags {
        ignore_user_config: has_flag(exec_help, "--ignore-user-config"),
        ignore_rules: has_flag(exec_help, "--ignore-rules"),
        disable: CODEX_DISABLE.iter().copied().filter(|name| features.iter().any(|f| f == name)).collect(),
    })
}

/// The login-shell script: PATH, then `command -v` for each fixed name, between
/// markers so whatever the person's dotfiles print is ignored. Only `printf`,
/// `command -v` and `;`, which zsh, bash, sh, dash, ksh and fish all read alike.
pub fn probe_script() -> String {
    let mut script = format!("printf '%s\\n' '{PROBE_BEGIN}'; printf 'path\\t%s\\n' \"$PATH\"; ");
    for spec in CLIS {
        script.push_str(&format!("printf 'bin\\t{0}\\t'; command -v {0}; printf '\\n'; ", spec.binary));
    }
    script.push_str(&format!("printf '%s\\n' '{PROBE_END}'"));
    script
}

#[derive(Debug, Default, PartialEq)]
pub struct Probe {
    pub path: Option<String>,
    pub found: HashMap<String, PathBuf>,
}

/// Read the probe's output. Only lines between the markers count, only known names
/// are kept, and only absolute paths (an alias or function prints something else).
pub fn parse_probe(output: &str) -> Probe {
    let mut probe = Probe::default();
    let Some(start) = output.find(PROBE_BEGIN) else { return probe };
    let body = &output[start + PROBE_BEGIN.len()..];
    let body = body.split(PROBE_END).next().unwrap_or("");
    for line in body.lines() {
        let mut cols = line.splitn(3, '\t');
        match (cols.next(), cols.next(), cols.next()) {
            (Some("path"), Some(value), None) if !value.is_empty() => probe.path = Some(value.to_string()),
            (Some("bin"), Some(name), Some(value)) => {
                let value = value.trim();
                if CLIS.iter().any(|spec| spec.binary == name) && value.starts_with('/') {
                    probe.found.insert(name.to_string(), PathBuf::from(value));
                }
            }
            _ => {}
        }
    }
    probe
}

/// Where the CLIs install on macOS and Linux, after the login shell's answer.
pub fn unix_known_dirs(home: Option<&Path>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = home {
        for rel in [".local/bin", ".claude/local", ".npm-global/bin", ".bun/bin", ".volta/bin", ".yarn/bin", "Library/pnpm", ".local/share/pnpm"] {
            dirs.push(home.join(rel));
        }
        // nvm keeps one bin folder per Node version; newest name first.
        if let Ok(entries) = std::fs::read_dir(home.join(".nvm/versions/node")) {
            let mut versions: Vec<PathBuf> = entries.flatten().take(64).map(|e| e.path().join("bin")).collect();
            versions.sort();
            versions.reverse();
            dirs.extend(versions);
        }
    }
    for abs in ["/opt/homebrew/bin", "/usr/local/bin", "/home/linuxbrew/.linuxbrew/bin", "/usr/bin", "/snap/bin"] {
        dirs.push(PathBuf::from(abs));
    }
    dirs
}

/// Where the CLIs install on Windows, before the app's own PATH.
pub fn windows_known_dirs(env: &dyn Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let base = |key: &str, rel: &str| env(key).map(|b| PathBuf::from(b).join(rel));
    dirs.extend(base("USERPROFILE", ".local\\bin"));
    dirs.extend(base("LOCALAPPDATA", "Microsoft\\WinGet\\Links"));
    dirs.extend(base("USERPROFILE", ".bun\\bin"));
    dirs.extend(base("APPDATA", "npm"));
    dirs
}

/// File names to try for one binary. Windows tries the .exe first; a .cmd or .bat
/// shim is found but not run (see `batch_shim`).
pub fn candidate_names(binary: &str, windows: bool) -> Vec<String> {
    if windows {
        vec![format!("{binary}.exe"), format!("{binary}.cmd"), format!("{binary}.bat")]
    } else {
        vec![binary.to_string()]
    }
}

/// A Windows batch file runs through cmd.exe, whose quoting cannot carry a JSON
/// argument safely, so it is never started.
pub fn batch_shim(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
}

/// True for paths in a temporary folder, where terminal apps put per-session shims.
pub fn in_temp(path: &Path, tmp: &Path) -> bool {
    let tmp_real = std::fs::canonicalize(tmp).unwrap_or_else(|_| tmp.to_path_buf());
    path.starts_with(tmp)
        || path.starts_with(&tmp_real)
        || ["/tmp", "/private/tmp", "/var/folders", "/private/var/folders", "/var/tmp"]
            .iter()
            .any(|root| path.starts_with(root))
}

/// Why a binary must not be started, or None when it may. On unix no other user
/// may be able to replace it: the file is executable and not world-writable, and no
/// folder above it is world-writable, unless it is a sticky shared folder (such as
/// /tmp) whose entry below is owned by this user or root.
#[cfg(unix)]
pub fn unsafe_location(real: &Path) -> Option<&'static str> {
    use std::os::unix::fs::MetadataExt;
    let Ok(meta) = std::fs::metadata(real) else { return Some("unreadable") };
    if !meta.is_file() {
        return Some("not-a-file");
    }
    if meta.mode() & 0o111 == 0 {
        return Some("not-executable");
    }
    if meta.mode() & 0o002 != 0 {
        return Some("world-writable");
    }
    // SAFETY: getuid has no preconditions and cannot fail.
    let uid = unsafe { libc::getuid() };
    let mut below: &Path = real;
    for dir in real.ancestors().skip(1) {
        let Ok(m) = std::fs::metadata(dir) else { return Some("unreadable") };
        if m.mode() & 0o002 != 0 {
            if m.mode() & 0o1000 == 0 {
                return Some("world-writable-folder");
            }
            let Ok(entry) = std::fs::symlink_metadata(below) else { return Some("unreadable") };
            if entry.uid() != uid && entry.uid() != 0 {
                return Some("shared-folder");
            }
        }
        below = dir;
    }
    None
}

#[cfg(not(unix))]
pub fn unsafe_location(real: &Path) -> Option<&'static str> {
    match std::fs::metadata(real) {
        Ok(meta) if meta.is_file() => None,
        Ok(_) => Some("not-a-file"),
        Err(_) => Some("unreadable"),
    }
}

#[cfg(unix)]
fn dir_world_writable(dir: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    std::fs::metadata(dir).map(|m| m.mode() & 0o002 != 0).unwrap_or(true)
}

#[cfg(not(unix))]
fn dir_world_writable(_dir: &Path) -> bool {
    false
}

/// The PATH a CLI's process gets: its own folders (a Node CLI needs the `node` beside
/// it), then the login shell's PATH without temporary or world-writable folders, then
/// the system folders.
pub fn child_path(original: &Path, real: &Path, shell_path: Option<&str>, windows: bool, tmp: &Path) -> OsString {
    let sep = if windows { ';' } else { ':' };
    let mut dirs: Vec<PathBuf> = Vec::new();
    for exe in [original, real] {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.to_path_buf());
        }
    }
    for entry in shell_path.unwrap_or("").split(sep) {
        let dir = PathBuf::from(entry);
        if dir.is_absolute() && !in_temp(&dir, tmp) && !dir_world_writable(&dir) {
            dirs.push(dir);
        }
    }
    if windows {
        if let Some(root) = std::env::var_os("SystemRoot") {
            dirs.push(PathBuf::from(&root).join("System32"));
            dirs.push(PathBuf::from(root));
        }
    } else {
        for d in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
            dirs.push(PathBuf::from(d));
        }
    }
    let mut seen = Vec::new();
    for dir in dirs {
        if !seen.contains(&dir) && seen.len() < 64 {
            seen.push(dir);
        }
    }
    let joined: Vec<String> = seen.iter().map(|d| d.to_string_lossy().into_owned()).collect();
    OsString::from(joined.join(&sep.to_string()))
}

#[derive(Debug, PartialEq)]
pub struct Resolved {
    pub original: PathBuf,
    pub real: PathBuf,
    /// Set when the only binary found cannot run (`batch-shim`, `unsafe-location`).
    pub problem: Option<&'static str>,
}

/// Choose one binary. The login shell's answer comes first unless it is a temporary
/// shim, then the known install folders, then the shim. The first usable file wins;
/// a file that was found but cannot run is reported only when nothing better exists.
pub fn resolve(binary: &str, shell_answer: Option<&Path>, known: &[PathBuf], windows: bool, tmp: &Path) -> Option<Resolved> {
    let mut order: Vec<PathBuf> = Vec::new();
    let shim = shell_answer.filter(|p| in_temp(p, tmp));
    if let Some(answer) = shell_answer.filter(|p| !in_temp(p, tmp)) {
        order.push(answer.to_path_buf());
    }
    for dir in known {
        for name in candidate_names(binary, windows) {
            order.push(dir.join(name));
        }
    }
    if let Some(answer) = shim {
        order.push(answer.to_path_buf());
    }
    let mut fallback: Option<Resolved> = None;
    for original in order {
        let Ok(real) = std::fs::canonicalize(&original) else { continue };
        if !real.is_file() {
            continue;
        }
        let problem = if windows && batch_shim(&real) { Some("batch-shim") } else { unsafe_location(&real).map(|_| "unsafe-location") };
        if problem.is_none() {
            return Some(Resolved { original, real, problem: None });
        }
        if fallback.is_none() {
            fallback = Some(Resolved { original, real, problem });
        }
    }
    fallback
}

/// The Default value of an App Paths key, from `reg query ... /ve` output.
pub fn parse_reg_default(out: &str, env: &dyn Fn(&str) -> Option<OsString>) -> Option<PathBuf> {
    for line in out.lines() {
        let trimmed = line.trim();
        for kind in ["REG_EXPAND_SZ", "REG_SZ"] {
            if let Some(index) = trimmed.find(kind) {
                let value = trimmed[index + kind.len()..].trim().trim_matches('"');
                if value.is_empty() {
                    return None;
                }
                let expanded = if kind == "REG_EXPAND_SZ" { expand_percent(value, env) } else { value.to_string() };
                return Some(PathBuf::from(expanded));
            }
        }
    }
    None
}

fn expand_percent(value: &str, env: &dyn Fn(&str) -> Option<OsString>) -> String {
    let mut out = String::new();
    let mut rest = value;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let name = &after[..end];
                match env(name) {
                    Some(v) => out.push_str(&v.to_string_lossy()),
                    None => {
                        out.push('%');
                        out.push_str(name);
                        out.push('%');
                    }
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push_str(&rest[start..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

/// True for an application entry that is shown to people and has a command.
pub fn desktop_entry_usable(text: &str) -> bool {
    let mut in_entry = false;
    let mut exec = false;
    let mut hidden = false;
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
            continue;
        }
        if !in_entry {
            continue;
        }
        if line.starts_with("Exec=") && line.len() > 5 {
            exec = true;
        }
        if line == "Hidden=true" || line == "NoDisplay=true" {
            hidden = true;
        }
    }
    exec && !hidden
}

/// Printable, single-line, at most `max` characters: names from a local server are
/// shown as text and nothing else.
pub fn clean_label(value: &str, max: usize) -> String {
    value.chars().filter(|c| !c.is_control()).take(max).collect::<String>().trim().to_string()
}

pub fn ollama_models(value: &serde_json::Value) -> Vec<String> {
    names(value.get("models"), "name")
}

pub fn openai_models(value: &serde_json::Value) -> Vec<String> {
    names(value.get("data"), "id")
}

fn names(list: Option<&serde_json::Value>, key: &str) -> Vec<String> {
    list.and_then(|v| v.as_array())
        .map(|items| {
            items.iter()
                .filter_map(|item| item.get(key)?.as_str())
                .map(|name| clean_label(name, 80))
                .filter(|name| !name.is_empty())
                .take(50)
                .collect()
        })
        .unwrap_or_default()
}

// Called from the macOS scan only (and the tests).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn app_for_bundle(bundle_id: &str) -> Option<&'static AppSpec> {
    APPS.iter().find(|app| app.mac_bundle_ids.contains(&bundle_id))
}

/// Install paths to look at for one app on Windows.
pub fn windows_app_candidates(app: &AppSpec, env: &dyn Fn(&str) -> Option<OsString>) -> Vec<PathBuf> {
    app.windows_paths.iter().filter_map(|(key, rel)| env(key).map(|base| PathBuf::from(base).join(rel))).collect()
}

/// Folders holding desktop entries on Linux.
pub fn linux_desktop_dirs(home: Option<&Path>, xdg_data_home: Option<&Path>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    match (xdg_data_home, home) {
        (Some(xdg), _) => dirs.push(xdg.join("applications")),
        (None, Some(home)) => dirs.push(home.join(".local/share/applications")),
        _ => {}
    }
    if let Some(home) = home {
        dirs.push(home.join(".local/share/flatpak/exports/share/applications"));
    }
    for abs in ["/usr/share/applications", "/usr/local/share/applications", "/var/lib/flatpak/exports/share/applications", "/var/lib/snapd/desktop/applications"] {
        dirs.push(PathBuf::from(abs));
    }
    dirs
}

// ── the impure parts ──────────────────────────────────────────────────────────

fn read_text(exe: &Path, args: &[&str], path_env: &OsString, cap: usize, timeout: Duration) -> Option<String> {
    let mut cmd = process::command(exe, path_env);
    cmd.args(args);
    if let Ok(dir) = tempfile::tempdir() {
        cmd.current_dir(dir.path());
        let got = process::run(cmd, None, &Limits { timeout, max_stdout: cap, max_stderr: 16 * 1024 }, None).ok()?;
        drop(dir);
        if !matches!(got.ended, Ended::Exited(_)) {
            return None;
        }
        let mut text = String::from_utf8_lossy(&got.stdout).into_owned();
        if text.trim().is_empty() {
            text = String::from_utf8_lossy(&got.stderr).into_owned();
        }
        return Some(text);
    }
    None
}

/// The person's login shell, when it is one the probe script is written for.
fn login_shell() -> Option<PathBuf> {
    let shell = std::env::var_os("SHELL").map(PathBuf::from).or_else(|| cfg!(target_os = "macos").then(|| PathBuf::from("/bin/zsh")))?;
    let name = shell.file_name()?.to_str()?.to_string();
    let known = ["zsh", "bash", "sh", "dash", "ksh", "fish"].contains(&name.as_str());
    (shell.is_absolute() && shell.is_file() && known && unsafe_location(&std::fs::canonicalize(&shell).ok()?).is_none()).then_some(shell)
}

fn probe_login_shell() -> Probe {
    let Some(shell) = login_shell() else { return Probe::default() };
    let script = probe_script();
    read_text(&shell, &["-l", "-c", &script], &OsString::from(SYSTEM_PATH), 64 * 1024, PROBE_TIMEOUT)
        .map(|text| parse_probe(&text))
        .unwrap_or_default()
}

fn detect_one(spec: &'static CliSpec, probe: &Probe, known: &[PathBuf], windows: bool, tmp: &Path, shell_path: Option<&str>) -> Option<(Detected, Option<Runnable>)> {
    let resolved = resolve(spec.binary, probe.found.get(spec.binary).map(|p| p.as_path()), known, windows, tmp)?;
    let path_env = child_path(&resolved.original, &resolved.real, shell_path, windows, tmp);
    let mut row = Detected {
        id: spec.id,
        kind: "cli",
        label: spec.label,
        path: resolved.real.to_string_lossy().into_owned(),
        version: None,
        runnable: false,
        note: resolved.problem,
        models: Vec::new(),
    };
    if resolved.problem.is_some() {
        return Some((row, None));
    }
    row.version = read_text(&resolved.real, &["--version"], &path_env, 4 * 1024, READ_TIMEOUT).and_then(|t| parse_version(&t));
    if !spec.runs {
        row.note = Some("detect-only");
        return Some((row, None));
    }
    let plan = match spec.id {
        "claude" => read_text(&resolved.real, &["--help"], &path_env, 128 * 1024, READ_TIMEOUT)
            .and_then(|help| claude_flags(&help))
            .map(Plan::Claude),
        "codex" => {
            let help = read_text(&resolved.real, &["exec", "--help"], &path_env, 128 * 1024, READ_TIMEOUT);
            let features = read_text(&resolved.real, &["features", "list"], &path_env, 64 * 1024, READ_TIMEOUT)
                .map(|list| codex_features(&list))
                .unwrap_or_default();
            help.and_then(|help| codex_flags(&help, &features)).map(Plan::Codex)
        }
        _ => None,
    };
    let Some(plan) = plan else {
        row.note = Some("update");
        return Some((row, None));
    };
    row.runnable = true;
    let runnable = Runnable { id: spec.id, exe: resolved.real.clone(), path_env, plan };
    Some((row, Some(runnable)))
}

/// Every CLI on the fixed list, checked in parallel.
pub fn detect_clis() -> (Vec<Detected>, Vec<Runnable>) {
    let windows = cfg!(windows);
    let tmp = std::env::temp_dir();
    let home = std::env::var_os(if windows { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
    let (probe, known) = if windows {
        let mut known = windows_known_dirs(&|key| std::env::var_os(key));
        if let Some(path) = std::env::var_os("PATH") {
            known.extend(std::env::split_paths(&path).filter(|d| d.is_absolute()).take(64));
        }
        let probe = Probe { path: std::env::var("PATH").ok(), found: HashMap::new() };
        (probe, known)
    } else {
        (probe_login_shell(), unix_known_dirs(home.as_deref()))
    };
    let shell_path = probe.path.clone();
    let probe = std::sync::Arc::new(probe);
    let known = std::sync::Arc::new(known);
    let handles: Vec<_> = CLIS
        .iter()
        .map(|spec| {
            let (probe, known, tmp, shell_path) = (probe.clone(), known.clone(), tmp.clone(), shell_path.clone());
            std::thread::spawn(move || detect_one(spec, &probe, &known, windows, &tmp, shell_path.as_deref()))
        })
        .collect();
    let mut rows = Vec::new();
    let mut runnables = Vec::new();
    for handle in handles {
        if let Ok(Some((row, runnable))) = handle.join() {
            rows.push(row);
            runnables.extend(runnable);
        }
    }
    (rows, runnables)
}

fn app_row(app: &'static AppSpec, path: &Path, version: Option<String>) -> Detected {
    Detected {
        id: app.id,
        kind: "app",
        label: app.label,
        path: path.to_string_lossy().into_owned(),
        version,
        runnable: false,
        note: None,
        models: Vec::new(),
    }
}

#[cfg(target_os = "macos")]
fn mac_apps(home: Option<&Path>) -> Vec<Detected> {
    let mut dirs = vec![PathBuf::from("/Applications")];
    if let Some(home) = home {
        dirs.push(home.join("Applications"));
    }
    let mut rows: Vec<Detected> = Vec::new();
    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten().take(4000) {
            let bundle = entry.path();
            if bundle.extension().and_then(|e| e.to_str()) != Some("app") {
                continue;
            }
            let info = bundle.join("Contents/Info.plist");
            if std::fs::metadata(&info).map(|m| m.len() > 1024 * 1024).unwrap_or(true) {
                continue;
            }
            let Ok(value) = plist::Value::from_file(&info) else { continue };
            let Some(dict) = value.as_dictionary() else { continue };
            let Some(id) = dict.get("CFBundleIdentifier").and_then(|v| v.as_string()) else { continue };
            let Some(app) = app_for_bundle(id) else { continue };
            if rows.iter().any(|row| row.id == app.id) {
                continue;
            }
            let version = dict.get("CFBundleShortVersionString").and_then(|v| v.as_string()).and_then(parse_version);
            rows.push(app_row(app, &bundle, version));
        }
    }
    rows
}

#[cfg(not(target_os = "macos"))]
fn mac_apps(_home: Option<&Path>) -> Vec<Detected> {
    Vec::new()
}

fn windows_app_path(name: &str) -> Option<PathBuf> {
    let root = std::env::var_os("SystemRoot").map(PathBuf::from)?;
    let reg = root.join("System32").join("reg.exe");
    let path_env = OsString::from(root.join("System32").as_os_str());
    for hive in ["HKCU", "HKLM"] {
        let key = format!("{hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{name}");
        if let Some(text) = read_text(&reg, &["query", &key, "/ve"], &path_env, 16 * 1024, Duration::from_secs(3)) {
            if let Some(path) = parse_reg_default(&text, &|k| std::env::var_os(k)) {
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    }
    None
}

fn windows_apps() -> Vec<Detected> {
    let env = |key: &str| std::env::var_os(key);
    APPS.iter()
        .filter_map(|app| {
            windows_app_candidates(app, &env)
                .into_iter()
                .find(|path| path.is_file())
                .or_else(|| app.windows_app_paths.iter().find_map(|name| windows_app_path(name)))
                .map(|path| app_row(app, &path, None))
        })
        .collect()
}

fn linux_apps(home: Option<&Path>) -> Vec<Detected> {
    let xdg = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).filter(|p| p.is_absolute());
    let dirs = linux_desktop_dirs(home, xdg.as_deref());
    APPS.iter()
        .filter_map(|app| {
            app.linux_desktop_ids.iter().find_map(|id| {
                dirs.iter().map(|dir| dir.join(id)).find(|path| {
                    std::fs::metadata(path).map(|m| m.is_file() && m.len() <= 64 * 1024).unwrap_or(false)
                        && std::fs::read_to_string(path).map(|text| desktop_entry_usable(&text)).unwrap_or(false)
                })
            })
            .map(|path| app_row(app, &path, None))
        })
        .collect()
}

pub fn detect_apps() -> Vec<Detected> {
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
    if cfg!(target_os = "macos") {
        mac_apps(home.as_deref())
    } else if cfg!(windows) {
        windows_apps()
    } else {
        linux_apps(home.as_deref())
    }
}

async fn loopback_json(client: &reqwest::Client, url: &str) -> Option<serde_json::Value> {
    let mut response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.ok()? {
        if body.len() + chunk.len() > 256 * 1024 {
            return None;
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body).ok()
}

/// Ollama and the LM Studio server, on loopback only, with short timeouts.
pub async fn detect_local_models() -> Vec<Detected> {
    let Ok(client) = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_millis(400))
        .timeout(Duration::from_millis(1500))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    else {
        return Vec::new();
    };
    // The three requests run side by side, so a server that accepts and never answers
    // costs one timeout, not three.
    let ask = |url: &'static str| {
        let client = client.clone();
        tauri::async_runtime::spawn(async move { loopback_json(&client, url).await })
    };
    let (tags, version, lm) = (
        ask("http://127.0.0.1:11434/api/tags"),
        ask("http://127.0.0.1:11434/api/version"),
        ask("http://127.0.0.1:1234/v1/models"),
    );
    let (tags, version, lm) = (tags.await.ok().flatten(), version.await.ok().flatten(), lm.await.ok().flatten());
    let mut rows = Vec::new();
    if let Some(tags) = tags {
        rows.push(Detected {
            id: "ollama",
            kind: "local-model",
            label: "Ollama",
            path: "http://127.0.0.1:11434".into(),
            version: version.as_ref().and_then(|v| v.get("version")?.as_str()).and_then(parse_version),
            runnable: false,
            note: Some("later"),
            models: ollama_models(&tags),
        });
    }
    if let Some(lm) = lm {
        rows.push(Detected {
            id: "lm-studio-server",
            kind: "local-model",
            label: "LM Studio",
            path: "http://127.0.0.1:1234".into(),
            version: None,
            runnable: false,
            note: Some("later"),
            models: openai_models(&lm),
        });
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_are_read_from_each_cli_s_own_wording() {
        assert_eq!(parse_version("2.1.317 (Claude Code)\n").as_deref(), Some("2.1.317"));
        assert_eq!(parse_version("codex-cli 0.164.0").as_deref(), Some("0.164.0"));
        assert_eq!(parse_version("0.12.0-nightly.20251101.abc").as_deref(), Some("0.12.0-nightly.20251101.abc"));
        assert_eq!(parse_version("GitHub Copilot CLI v1.0.4").as_deref(), Some("1.0.4"));
        assert_eq!(parse_version("no version here"), None);
        assert_eq!(parse_version("").as_deref(), None);
        let long = format!("1.{}", "9".repeat(100));
        assert_eq!(parse_version(&long).map(|v| v.len()), Some(40));
    }

    #[test]
    fn claude_flags_need_every_required_switch() {
        let help = "  -p, --print   Print\n  --output-format <format>\n  --json-schema <schema>\n  --tools <tools...>\n  --no-session-persistence\n  --restricted   Restricted mode\n  --strict-mcp-config\n";
        assert_eq!(claude_flags(help), Some(ClaudeFlags { restricted: true, strict_mcp: true, no_slash: false }));
        assert_eq!(claude_flags(&help.replace("--json-schema", "--other")), None);
        // A flag named only inside another word does not count.
        assert!(!has_flag("--restricted-mode", "--restricted"));
    }

    #[test]
    fn codex_disables_only_features_this_version_knows() {
        let list = "shell_tool  stable  true\nview_image stable true\napply_patch_freeform removed false\nhooks stable true\n";
        let features = codex_features(list);
        assert_eq!(features, vec!["shell_tool", "view_image", "hooks"]);
        let help = "--sandbox <MODE>\n--skip-git-repo-check\n--ephemeral\n--ignore-user-config\n--output-schema <FILE>\n-o, --output-last-message <FILE>\n";
        let flags = codex_flags(help, &features).unwrap();
        assert!(flags.ignore_user_config);
        assert!(!flags.ignore_rules);
        assert_eq!(flags.disable, vec!["shell_tool", "view_image", "hooks"]);
        assert_eq!(codex_flags(&help.replace("--ephemeral", ""), &features), None);
    }

    #[test]
    fn the_probe_reads_only_marked_absolute_paths_for_known_names() {
        let out = "Welcome to my shell\nbin\tclaude\t/evil/claude\n__LOLLY_AGENTS_BEGIN__\npath\t/usr/bin:/opt/homebrew/bin\nbin\tclaude\t/Users/a/.local/bin/claude\n\nbin\tcodex\talias codex='rm -rf'\nbin\tgemini\t\nbin\trm\t/bin/rm\n__LOLLY_AGENTS_END__\nbin\tcopilot\t/late/copilot\n";
        let probe = parse_probe(out);
        assert_eq!(probe.path.as_deref(), Some("/usr/bin:/opt/homebrew/bin"));
        assert_eq!(probe.found.get("claude"), Some(&PathBuf::from("/Users/a/.local/bin/claude")));
        assert!(!probe.found.contains_key("codex"), "an alias is not a path");
        assert!(!probe.found.contains_key("gemini"));
        assert!(!probe.found.contains_key("rm"), "only names on the fixed list");
        assert!(!probe.found.contains_key("copilot"), "nothing after the end marker");
        assert_eq!(parse_probe("no markers at all"), Probe::default());
    }

    #[test]
    fn the_probe_script_names_only_the_fixed_list() {
        let script = probe_script();
        for spec in CLIS {
            assert!(script.contains(&format!("command -v {}", spec.binary)));
        }
        assert_eq!(script.matches("command -v").count(), CLIS.len());
        assert!(!script.contains('`') && !script.contains("$("), "no command substitution");
    }

    #[test]
    fn windows_never_runs_a_batch_shim_and_prefers_the_exe() {
        assert_eq!(candidate_names("codex", true), vec!["codex.exe", "codex.cmd", "codex.bat"]);
        assert_eq!(candidate_names("codex", false), vec!["codex"]);
        assert!(batch_shim(Path::new("C:\\npm\\codex.cmd")));
        assert!(batch_shim(Path::new("C:\\npm\\codex.BAT")));
        assert!(!batch_shim(Path::new("C:\\bin\\codex.exe")));
    }

    #[test]
    fn app_paths_and_desktop_entries_are_parsed_strictly() {
        let env = |key: &str| (key == "LOCALAPPDATA").then(|| OsString::from("C:\\Users\\a\\AppData\\Local"));
        let out = "\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Code.exe\r\n    (Default)    REG_EXPAND_SZ    \"%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe\"\r\n";
        assert_eq!(parse_reg_default(out, &env), Some(PathBuf::from("C:\\Users\\a\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe")));
        assert_eq!(parse_reg_default("ERROR: The system was unable to find the specified registry key or value.", &env), None);
        let vscode = APPS.iter().find(|a| a.id == "vscode").unwrap();
        assert_eq!(windows_app_candidates(vscode, &env), vec![PathBuf::from("C:\\Users\\a\\AppData\\Local").join("Programs\\Microsoft VS Code\\Code.exe")]);
        assert!(desktop_entry_usable("[Desktop Entry]\nName=Code\nExec=/usr/share/code/code %F\n"));
        assert!(!desktop_entry_usable("[Desktop Entry]\nExec=code\nNoDisplay=true\n"));
        assert!(!desktop_entry_usable("[Desktop Action new]\nExec=code --new\n"));
    }

    #[test]
    fn bundle_ids_match_only_the_allowlist() {
        assert_eq!(app_for_bundle("com.anthropic.claudefordesktop").map(|a| a.id), Some("claude-app"));
        assert_eq!(app_for_bundle("com.openai.codex").map(|a| a.id), Some("codex-app"));
        assert_eq!(app_for_bundle("com.microsoft.VSCode").map(|a| a.id), Some("vscode"));
        assert!(app_for_bundle("com.example.claude").is_none());
    }

    #[test]
    fn local_model_names_are_cleaned_and_capped() {
        let tags = serde_json::json!({ "models": [{ "name": "llama3:latest" }, { "name": "bad\u{0007}\nname" }, { "nope": 1 }] });
        assert_eq!(ollama_models(&tags), vec!["llama3:latest", "badname"]);
        let many: Vec<_> = (0..80).map(|i| serde_json::json!({ "id": format!("m{i}") })).collect();
        assert_eq!(openai_models(&serde_json::json!({ "data": many })).len(), 50);
        assert_eq!(clean_label(&"x".repeat(200), 80).len(), 80);
    }

    #[cfg(unix)]
    mod unix_files {
        use super::super::*;
        use std::os::unix::fs::PermissionsExt;

        fn exe(path: &Path) {
            std::fs::write(path, "#!/bin/sh\necho 1.2.3\n").unwrap();
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }

        #[test]
        fn a_binary_another_user_could_replace_is_refused() {
            let root = tempfile::tempdir().unwrap();
            let open = root.path().join("open");
            std::fs::create_dir(&open).unwrap();
            std::fs::set_permissions(&open, std::fs::Permissions::from_mode(0o777)).unwrap();
            let planted = open.join("claude");
            exe(&planted);
            assert_eq!(unsafe_location(&planted), Some("world-writable-folder"));

            let sticky = root.path().join("sticky");
            std::fs::create_dir(&sticky).unwrap();
            std::fs::set_permissions(&sticky, std::fs::Permissions::from_mode(0o1777)).unwrap();
            let mine = sticky.join("mine");
            std::fs::create_dir(&mine).unwrap();
            let ok = mine.join("claude");
            exe(&ok);
            assert_eq!(unsafe_location(&ok), None, "an entry this user owns below a sticky folder is fine");

            let writable = root.path().join("claude-ww");
            exe(&writable);
            std::fs::set_permissions(&writable, std::fs::Permissions::from_mode(0o777)).unwrap();
            assert_eq!(unsafe_location(&writable), Some("world-writable"));

            let plain = root.path().join("notes");
            std::fs::write(&plain, "x").unwrap();
            assert_eq!(unsafe_location(&plain), Some("not-executable"));
        }

        #[test]
        fn resolution_prefers_a_real_install_over_a_temporary_shim() {
            let tmp = tempfile::tempdir().unwrap();
            let shim_dir = tmp.path().join("cmux-cli-shims/abc");
            std::fs::create_dir_all(&shim_dir).unwrap();
            let shim = shim_dir.join("claude");
            exe(&shim);
            let home = tempfile::tempdir().unwrap();
            let bin = home.path().join(".local/bin");
            std::fs::create_dir_all(&bin).unwrap();
            exe(&bin.join("claude"));
            let known = unix_known_dirs(Some(home.path()));
            let got = resolve("claude", Some(&shim), &known, false, tmp.path()).unwrap();
            assert_eq!(got.real, std::fs::canonicalize(bin.join("claude")).unwrap());
            assert_eq!(got.problem, None);
            // With no real install, the shim is still used.
            std::fs::remove_file(bin.join("claude")).unwrap();
            let got = resolve("claude", Some(&shim), &known, false, tmp.path()).unwrap();
            assert_eq!(got.real, std::fs::canonicalize(&shim).unwrap());
            assert_eq!(resolve("claude", None, &[], false, tmp.path()), None);
        }

        #[test]
        fn the_child_path_keeps_the_cli_s_folders_and_drops_temporary_ones() {
            let tmp = tempfile::tempdir().unwrap();
            let shim_dir = tmp.path().join("shims");
            std::fs::create_dir_all(&shim_dir).unwrap();
            let shell_path = format!("{}:/opt/homebrew/bin:relative/bin:/usr/bin", shim_dir.display());
            let path = child_path(Path::new("/Users/a/.nvm/versions/node/v22/bin/codex"), Path::new("/Users/a/.nvm/versions/node/v22/lib/node_modules/@openai/codex/bin/codex.js"), Some(&shell_path), false, tmp.path());
            let parts: Vec<String> = path.to_string_lossy().split(':').map(String::from).collect();
            assert_eq!(parts[0], "/Users/a/.nvm/versions/node/v22/bin", "node beside the CLI comes first");
            assert!(!parts.iter().any(|p| p.contains("shims")), "temporary folders are dropped");
            assert!(!parts.iter().any(|p| p == "relative/bin"), "relative entries are dropped");
            assert!(parts.contains(&"/usr/bin".to_string()));
            assert_eq!(parts.iter().filter(|p| *p == "/usr/bin").count(), 1, "no duplicates");
        }
    }
}
