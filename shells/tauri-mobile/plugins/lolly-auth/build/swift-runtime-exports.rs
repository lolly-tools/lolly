// SPDX-License-Identifier: MPL-2.0
// Xcode 27 SwiftPM makes SwiftRs' dependency C exports local. swift-rs 1.0.8
// repairs the top-level package only. This plugin owns exactly one runtime copy;
// restore its four upstream exports without touching another Cargo build output.
use std::{
    collections::BTreeMap,
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const EXPORTS: [&str; 4] = [
    "_retain_object",
    "_release_object",
    "_data_from_bytes",
    "_string_from_bytes",
];
const PACKAGE: &str = "tauri-plugin-lolly-auth";
const MAX_ARCHIVE: usize = 64 * 1024 * 1024;
type Result<T> = std::result::Result<T, String>;

fn stop_owned_tool(child: &mut Child) {
    #[cfg(unix)]
    {
        extern "C" {
            fn kill(pid: i32, signal: i32) -> i32;
        }
        // Each tool gets a new process group at spawn. A wrapper's descendants
        // belong to that owned group, including writers holding stdout open.
        if let Ok(pid) = i32::try_from(child.id()) {
            unsafe {
                kill(-pid, 9);
            }
        }
    }
    let _ = child.kill();
    for _ in 0..20 {
        if matches!(child.try_wait(), Ok(Some(_))) {
            break;
        }
        thread::sleep(Duration::from_millis(10));
    }
}

// Keep command output bounded, including failures; no environment or argument
// dump. These tools never run a product, compiler build or package resolver.
fn run(program: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let mut command = Command::new(program);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| format!("cannot start {}", program.display()))?;
    let Some(stdout) = child.stdout.take() else {
        stop_owned_tool(&mut child);
        return Err("missing tool stdout".into());
    };
    let (sender, receiver) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let result = (|| {
            let mut retained = Vec::new();
            let mut pipe = stdout;
            let mut bytes = [0; 8192];
            let mut overflow = false;
            loop {
                let count = pipe
                    .read(&mut bytes)
                    .map_err(|_| "cannot read tool stdout")?;
                if count == 0 {
                    break;
                }
                if retained.len() + count <= 1024 * 1024 {
                    retained.extend_from_slice(&bytes[..count]);
                } else {
                    overflow = true;
                }
            }
            if overflow {
                Err("tool stdout exceeds 1 MiB")
            } else {
                Ok(retained)
            }
        })();
        let _ = sender.send(result);
    });
    let deadline = Instant::now() + Duration::from_secs(20);
    let status = loop {
        match child.try_wait() {
            Err(_) => {
                stop_owned_tool(&mut child);
                return Err("cannot wait for tool".into());
            }
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                stop_owned_tool(&mut child);
                return Err(format!("{} exceeded 20 seconds", program.display()));
            }
            Ok(None) => thread::sleep(Duration::from_millis(10)),
        }
    };
    if !status.success() {
        stop_owned_tool(&mut child);
        return Err(format!("{} failed with {status}", program.display()));
    }
    let bytes = match receiver.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
        Ok(Ok(bytes)) => bytes,
        Ok(Err(error)) => {
            stop_owned_tool(&mut child);
            return Err(error.into());
        }
        Err(_) => {
            stop_owned_tool(&mut child);
            return Err(format!("{} stdout exceeded 20 seconds", program.display()));
        }
    };
    Ok(bytes)
}

pub fn bounded_archive_read(path: &Path) -> Result<Vec<u8>> {
    let file = fs::File::open(path).map_err(|_| "cannot open owned Swift artifact")?;
    let metadata = file
        .metadata()
        .map_err(|_| "cannot inspect owned Swift artifact")?;
    if !metadata.is_file() || metadata.len() > MAX_ARCHIVE as u64 {
        return Err("owned Swift artifact is not a regular file within 64 MiB".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_ARCHIVE as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "cannot read owned Swift artifact")?;
    if bytes.len() > MAX_ARCHIVE {
        return Err("owned Swift artifact grew beyond 64 MiB".into());
    }
    Ok(bytes)
}

pub fn archive_members(bytes: &[u8]) -> Result<BTreeMap<String, Vec<u8>>> {
    if bytes.len() > MAX_ARCHIVE || !bytes.starts_with(b"!<arch>\n") {
        return Err("invalid or oversized Swift archive".into());
    }
    let mut offset = 8;
    let mut members = BTreeMap::new();
    let mut count = 0;
    while offset < bytes.len() {
        count += 1;
        if count > 128 || bytes.len() - offset < 60 {
            return Err("invalid Swift archive member count/header".into());
        }
        let h = &bytes[offset..offset + 60];
        if &h[58..] != b"`\n" {
            return Err("invalid Swift archive header".into());
        }
        let size = std::str::from_utf8(&h[48..58])
            .map_err(|_| "invalid member size")?
            .trim()
            .parse::<usize>()
            .map_err(|_| "invalid member size")?;
        offset += 60;
        if size > bytes.len() - offset {
            return Err("truncated Swift archive member".into());
        }
        let mut data = &bytes[offset..offset + size];
        let raw_name = std::str::from_utf8(&h[..16])
            .map_err(|_| "invalid member name")?
            .trim();
        let name = if let Some(len) = raw_name.strip_prefix("#1/") {
            let n = len
                .parse::<usize>()
                .map_err(|_| "invalid BSD member name")?;
            if n > 256 || n > data.len() {
                return Err("invalid BSD member name length".into());
            }
            let name = std::str::from_utf8(&data[..n])
                .map_err(|_| "invalid BSD member name")?
                .trim_end_matches('\0')
                .to_string();
            data = &data[n..];
            name
        } else {
            raw_name.trim_end_matches('/').to_string()
        };
        if name.starts_with("__.SYMDEF") || raw_name == "/" { /* archive index is regenerated */
        } else {
            if name.is_empty()
                || !name.ends_with(".o")
                || name.contains(['/', '\\'])
                || !name.is_ascii()
            {
                return Err("unexpected Swift archive member".into());
            }
            if members.insert(name, data.to_vec()).is_some() {
                return Err("duplicate Swift archive object member".into());
            }
        }
        offset += size;
        if size % 2 != 0 {
            if bytes.get(offset) != Some(&b'\n') {
                return Err("invalid Swift archive padding".into());
            }
            offset += 1;
        }
    }
    if !members.contains_key("SwiftRs.o") {
        return Err("Swift archive has no single SwiftRs.o runtime member".into());
    }
    Ok(members)
}

pub fn runtime_symbols(nm: &str) -> Result<BTreeMap<String, char>> {
    let mut found = BTreeMap::new();
    for line in nm.lines() {
        let columns: Vec<_> = line.split_whitespace().collect();
        let Some(name) = columns.last() else {
            continue;
        };
        if !EXPORTS.contains(name) {
            continue;
        }
        if columns.len() != 3
            || !columns[0].chars().all(|c| c.is_ascii_hexdigit())
            || !matches!(columns[1], "T" | "t")
        {
            return Err("SwiftRs runtime export has an unexpected symbol definition".into());
        }
        if found
            .insert((*name).to_string(), columns[1].chars().next().unwrap())
            .is_some()
        {
            return Err("duplicate SwiftRs runtime export".into());
        }
    }
    if found.len() != EXPORTS.len() {
        return Err("SwiftRs runtime does not define all four upstream C exports".into());
    }
    Ok(found)
}

pub fn verify_member_readback(
    before: &BTreeMap<String, Vec<u8>>,
    after: &BTreeMap<String, Vec<u8>>,
) -> Result<()> {
    if before.keys().ne(after.keys()) {
        return Err("Swift archive object membership changed".into());
    }
    for (name, bytes) in before {
        if name != "SwiftRs.o" && after.get(name) != Some(bytes) {
            return Err("unrelated Swift archive object changed".into());
        }
    }
    Ok(())
}

pub fn find_archive(out: &Path, debug: bool, simulator: bool) -> Result<PathBuf> {
    let owner = out.canonicalize().map_err(|_| "OUT_DIR is unavailable")?;
    let root = owner.join("swift-rs").join(PACKAGE);
    let profile = if debug { "debug" } else { "release" };
    let sdk = if simulator {
        "iphonesimulator"
    } else {
        "iphoneos"
    };
    let file = format!("lib{PACKAGE}.a");
    let arch = if env::consts::ARCH == "aarch64" {
        "arm64"
    } else {
        env::consts::ARCH
    };
    let mut candidates = vec![
        root.join(profile).join(&file),
        root.join(format!("{arch}-apple-macosx"))
            .join(profile)
            .join(&file),
    ];
    for products in [root.join("Products"), root.join("out/Products")] {
        if products.exists() {
            for entry in
                fs::read_dir(products).map_err(|_| "cannot inspect owned Swift products")?
            {
                let entry = entry.map_err(|_| "cannot inspect owned Swift product")?;
                if entry
                    .file_name()
                    .to_string_lossy()
                    .eq_ignore_ascii_case(&format!("{profile}-{sdk}"))
                {
                    candidates.push(entry.path().join(&file));
                }
            }
        }
    }
    let mut existing = Vec::new();
    for path in candidates {
        if !path.exists() {
            continue;
        }
        let real = path
            .canonicalize()
            .map_err(|_| "cannot resolve Swift archive")?;
        if !real.starts_with(&owner) || !real.is_file() {
            return Err("Swift archive escapes its own OUT_DIR".into());
        }
        if !existing.contains(&real) {
            existing.push(real);
        }
    }
    if existing.len() != 1 {
        return Err("expected one owned Swift archive for this debug/release iOS SDK; pinned Swift package build must complete first".into());
    }
    Ok(existing.remove(0))
}

fn text(bytes: Vec<u8>) -> Result<String> {
    String::from_utf8(bytes).map_err(|_| "tool output is not UTF-8".into())
}
fn arg(path: &Path) -> Result<&str> {
    path.to_str().ok_or_else(|| "tool path is not UTF-8".into())
}

fn selected_objcopy() -> Result<PathBuf> {
    let rustc =
        PathBuf::from(env::var_os("RUSTC").ok_or("Cargo did not provide its selected RUSTC")?);
    if !rustc.is_absolute() {
        return Err("selected RUSTC must be absolute".into());
    }
    let sysroot = text(run(&rustc, &["--print", "sysroot"])?)?;
    let sysroot = PathBuf::from(sysroot.trim())
        .canonicalize()
        .map_err(|_| "selected rustc sysroot is unavailable")?;
    let version = text(run(&rustc, &["--version", "--verbose"])?)?;
    let host = version
        .lines()
        .find_map(|line| line.strip_prefix("host: "))
        .ok_or("selected rustc has no host identity")?;
    if !matches!(host, "aarch64-apple-darwin" | "x86_64-apple-darwin") {
        return Err("Swift runtime repair requires the selected Apple host compiler".into());
    }
    let bin = sysroot
        .join("lib/rustlib")
        .join(host)
        .join("bin")
        .canonicalize()
        .map_err(|_| "selected Rust toolchain needs llvm-tools")?;
    if !bin.starts_with(&sysroot) {
        return Err("LLVM tools bin escapes the selected Rust sysroot".into());
    }
    let tool = bin
        .join("llvm-objcopy")
        .canonicalize()
        .map_err(|_| "selected Rust toolchain needs llvm-tools (llvm-objcopy)")?;
    if tool.parent() != Some(bin.as_path()) || !tool.is_file() {
        return Err("llvm-objcopy escapes the selected Rust toolchain bin directory".into());
    }
    let version = run(&tool, &["--version"])?;
    if version.len() > 4096
        || !version
            .iter()
            .all(|b| b.is_ascii_graphic() || matches!(b, b' ' | b'\n' | b'\r' | b'\t'))
        || !text(version)?.contains("LLVM version")
    {
        return Err("selected llvm-objcopy has an invalid version response".into());
    }
    Ok(tool)
}

pub struct Scratch(PathBuf);
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub fn acquire_scratch(path: PathBuf) -> Result<Scratch> {
    fs::create_dir(&path).map_err(|_| "cannot create owned Swift runtime scratch")?;
    Ok(Scratch(path))
}

pub fn repair_archive(archive: &Path, out: &Path, objcopy: &Path) -> Result<()> {
    let owner = out.canonicalize().map_err(|_| "OUT_DIR is unavailable")?;
    let archive = archive
        .canonicalize()
        .map_err(|_| "Swift archive is unavailable")?;
    if !archive.starts_with(&owner) {
        return Err("Swift archive escapes its own OUT_DIR".into());
    }
    let original = bounded_archive_read(&archive)?;
    let before = archive_members(&original)?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "invalid scratch clock")?
        .as_nanos();
    let scratch =
        acquire_scratch(owner.join(format!(".lolly-swiftrs-{}-{nonce}", std::process::id())))?;
    let member = scratch.0.join("SwiftRs.o");
    fs::write(&member, &before["SwiftRs.o"])
        .map_err(|_| "cannot write owned Swift runtime member")?;
    let symbols = runtime_symbols(&text(run(Path::new("/usr/bin/nm"), &[arg(&member)?])?)?)?;
    if symbols.values().all(|kind| *kind == 'T') {
        return Ok(());
    }
    let modified = scratch.0.join("modified.o");
    let flags: Vec<_> = symbols
        .iter()
        .filter(|(_, kind)| **kind == 't')
        .map(|(name, _)| format!("--globalize-symbol={name}"))
        .collect();
    let mut args: Vec<_> = flags.iter().map(String::as_str).collect();
    args.extend([arg(&member)?, arg(&modified)?]);
    run(objcopy, &args)?;
    let globals = runtime_symbols(&text(run(Path::new("/usr/bin/nm"), &[arg(&modified)?])?)?)?;
    if globals.values().any(|kind| *kind != 'T') {
        return Err("llvm-objcopy did not restore all four runtime exports".into());
    }
    fs::rename(&modified, &member).map_err(|_| "cannot stage repaired Swift runtime member")?;
    let candidate = scratch.0.join("repaired.a");
    fs::write(&candidate, &original).map_err(|_| "cannot stage owned Swift archive")?;
    run(
        Path::new("/usr/bin/ar"),
        &["r", arg(&candidate)?, arg(&member)?],
    )?;
    run(Path::new("/usr/bin/ranlib"), &[arg(&candidate)?])?;
    let after = archive_members(&bounded_archive_read(&candidate)?)?;
    verify_member_readback(&before, &after)?;
    if after["SwiftRs.o"] != bounded_archive_read(&member)? {
        return Err("repaired archive runtime member does not match verified object".into());
    }
    let globals = runtime_symbols(&text(run(Path::new("/usr/bin/nm"), &[arg(&candidate)?])?)?)?;
    if globals.values().any(|kind| *kind != 'T') {
        return Err("repaired archive exports failed readback".into());
    }
    if bounded_archive_read(&archive)? != original {
        return Err("owned Swift archive changed during export repair".into());
    }
    fs::rename(&candidate, &archive)
        .map_err(|_| "cannot atomically replace owned Swift archive")?;
    println!("cargo:warning=restored four upstream SwiftRs runtime C exports in the owned iOS auth-plugin archive");
    Ok(())
}

pub fn repair_from_env() -> Result<()> {
    let target = env::var("TARGET").map_err(|_| "Cargo did not provide TARGET")?;
    if !matches!(
        target.as_str(),
        "aarch64-apple-ios" | "aarch64-apple-ios-sim" | "x86_64-apple-ios"
    ) {
        return Ok(());
    }
    if env::var("CARGO_PKG_NAME").as_deref() != Ok(PACKAGE) {
        return Err("Swift runtime repair must run in its owning auth plugin".into());
    }
    let debug = match env::var("DEBUG").as_deref() {
        Ok("true") => true,
        Ok("false") => false,
        _ => return Err("Cargo DEBUG must be true or false".into()),
    };
    let out = PathBuf::from(env::var_os("OUT_DIR").ok_or("Cargo did not provide OUT_DIR")?);
    if !out.is_absolute() {
        return Err("OUT_DIR must be absolute".into());
    }
    let archive = find_archive(&out, debug, target != "aarch64-apple-ios")?;
    repair_archive(&archive, &out, &selected_objcopy()?)
}
