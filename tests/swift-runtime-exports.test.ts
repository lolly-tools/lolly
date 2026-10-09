import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const helper = path.join(
  root,
  'shells/tauri-mobile/plugins/lolly-auth/build/swift-runtime-exports.rs'
);

test('the native Swift runtime guards reject ambiguous exports, archive changes and foreign outputs', () => {
  const evidence = path.join(root, 'plans/295-validation/swift-runtime-exports-tests');
  mkdirSync(evidence, { recursive: true });
  const scratch = mkdtempSync(path.join(evidence, 'guards-'));
  try {
    const source = path.join(scratch, 'guards.rs');
    const binary = path.join(scratch, process.platform === 'win32' ? 'guards.exe' : 'guards');
    writeFileSync(
      source,
      `#[path = ${JSON.stringify(helper)}] mod exports;
use std::{collections::BTreeMap, fs, path::PathBuf};
fn archive(members: &[(&str, &[u8])]) -> Vec<u8> {
  let mut bytes = b"!<arch>\\n".to_vec();
  for (name, body) in members {
    let header = format!("{:<16}{:<12}{:<6}{:<6}{:<8}{:<10}\u0060\\n", format!("{name}/"), 0, 0, 0, "100644", body.len());
    assert_eq!(header.len(), 60);
    bytes.extend(header.bytes()); bytes.extend_from_slice(body);
    if body.len() % 2 != 0 { bytes.push(b'\\n'); }
  }
  bytes
}
fn symbols(kind: &str) -> String {
  ["_retain_object", "_release_object", "_data_from_bytes", "_string_from_bytes"]
    .iter().map(|name| format!("0000000000000000 {kind} {name}\\n")).collect()
}
fn owner(name: &str) -> PathBuf {
  let p = PathBuf::from(std::env::var_os("LOLLY_SWIFT_TEST_ROOT").unwrap()).join(name);
  fs::create_dir_all(&p).unwrap(); p
}
#[test] fn archive_bounds_and_unique_runtime() {
  let valid = archive(&[("SwiftRs.o", b"runtime"), ("Tauri.o", b"unchanged")]);
  let rows = exports::archive_members(&valid).unwrap();
  assert_eq!(rows["SwiftRs.o"], b"runtime");
  assert!(exports::archive_members(b"bad archive").is_err());
  assert!(exports::archive_members(&valid[..valid.len()-1]).is_err());
  assert!(exports::archive_members(&archive(&[("SwiftRs.o", b"a"), ("SwiftRs.o", b"b")])).is_err());
  assert!(exports::archive_members(&archive(&[("Tauri.o", b"no runtime")])).is_err());
  assert!(exports::archive_members(&archive(&[("SwiftRs.o", b"a"), ("../foreign.o", b"b")])).is_err());
  let mut broken = valid.clone(); broken[66] = b'x'; assert!(exports::archive_members(&broken).is_err());
}
#[test] fn exact_four_symbols_no_duplicates_or_undefined_stubs() {
  assert_eq!(exports::runtime_symbols(&symbols("t")).unwrap().len(), 4);
  assert!(exports::runtime_symbols(&symbols("T")).unwrap().values().all(|v| *v == 'T'));
  assert!(exports::runtime_symbols(&symbols("t").replace("_data_from_bytes", "_unrelated")).is_err());
  assert!(exports::runtime_symbols(&(symbols("t") + "0000000000000000 t _retain_object\\n")).is_err());
  assert!(exports::runtime_symbols(&symbols("U")).is_err());
  assert!(exports::runtime_symbols(&symbols("D")).is_err());
  assert!(exports::runtime_symbols(&symbols("t").replace("0000000000000000", "NOT_AN_ADDRESS")).is_err());
}
#[test] fn every_unrelated_object_must_be_byte_identical() {
  let before = BTreeMap::from([("SwiftRs.o".into(), b"original".to_vec()), ("Tauri.o".into(), b"fixed".to_vec())]);
  let mut after = before.clone(); after.insert("SwiftRs.o".into(), b"repaired".to_vec());
  exports::verify_member_readback(&before, &after).unwrap();
  after.insert("Tauri.o".into(), b"changed".to_vec()); assert!(exports::verify_member_readback(&before, &after).is_err());
  after = before.clone(); after.remove("Tauri.o"); assert!(exports::verify_member_readback(&before, &after).is_err());
  after = before.clone(); after.insert("extra.o".into(), vec![1]); assert!(exports::verify_member_readback(&before, &after).is_err());
}
#[test] fn all_four_profile_sdk_combinations_are_exact() {
  for debug in [true, false] { for simulator in [true, false] {
    let out = owner(&format!("profile-{debug}-{simulator}"));
    let profile = if debug { "Debug" } else { "Release" };
    let sdk = if simulator { "iphonesimulator" } else { "iphoneos" };
    let p = out.join(format!("swift-rs/tauri-plugin-lolly-auth/out/Products/{profile}-{sdk}"));
    fs::create_dir_all(&p).unwrap(); let p = p.join("libtauri-plugin-lolly-auth.a"); fs::write(&p, b"fixture").unwrap();
    assert_eq!(exports::find_archive(&out, debug, simulator).unwrap(), p.canonicalize().unwrap());
    assert!(exports::find_archive(&out, debug, !simulator).is_err());
    assert!(exports::find_archive(&out, !debug, simulator).is_err());
  }}
}
#[test] fn artifact_read_is_bounded_before_allocation() {
  let root = owner("read-bound"); let p = root.join("oversized.a");
  fs::File::create(&p).unwrap().set_len(64 * 1024 * 1024 + 1).unwrap();
  assert!(exports::bounded_archive_read(&p).unwrap_err().contains("within 64 MiB"));
  assert!(exports::bounded_archive_read(&root).is_err());
  fs::write(&p, b"small artifact").unwrap(); assert_eq!(exports::bounded_archive_read(&p).unwrap(), b"small artifact");
}
#[test] fn scratch_collision_does_not_acquire_or_delete_prior_contents() {
  let existing = owner("scratch-collision"); let sentinel = existing.join("keep"); fs::write(&sentinel, b"original").unwrap();
  assert!(exports::acquire_scratch(existing.clone()).is_err()); assert_eq!(fs::read(&sentinel).unwrap(), b"original");
  let fresh = existing.join("fresh"); let owned = exports::acquire_scratch(fresh.clone()).unwrap(); assert!(fresh.is_dir());
  drop(owned); assert!(!fresh.exists()); assert_eq!(fs::read(&sentinel).unwrap(), b"original");
}
#[test] fn no_archive_and_multiple_archive_owners_are_refused() {
  let out = owner("ambiguous"); assert!(exports::find_archive(&out, false, false).is_err());
  for rel in ["release", "out/Products/Release-iphoneos"] {
    let p = out.join("swift-rs/tauri-plugin-lolly-auth").join(rel); fs::create_dir_all(&p).unwrap();
    fs::write(p.join("libtauri-plugin-lolly-auth.a"), b"fixture").unwrap();
  }
  assert!(exports::find_archive(&out, false, false).is_err());
}
#[test] fn pinned_legacy_host_architecture_mapping_is_preserved() {
  let out = owner("legacy"); let arch = if std::env::consts::ARCH == "aarch64" { "arm64" } else { std::env::consts::ARCH };
  let p = out.join(format!("swift-rs/tauri-plugin-lolly-auth/{arch}-apple-macosx/debug")); fs::create_dir_all(&p).unwrap();
  let archive = p.join("libtauri-plugin-lolly-auth.a"); fs::write(&archive, b"fixture").unwrap();
  assert_eq!(exports::find_archive(&out, true, true).unwrap(), archive.canonicalize().unwrap());
}
#[cfg(unix)] #[test] fn release_symlink_deduplicates_but_foreign_symlink_fails() {
  use std::os::unix::fs::symlink;
  let out = owner("symlink"); let product = out.join("swift-rs/tauri-plugin-lolly-auth/out/Products/Release-iphoneos");
  fs::create_dir_all(&product).unwrap(); let archive = product.join("libtauri-plugin-lolly-auth.a"); fs::write(&archive, b"fixture").unwrap();
  let alias = out.join("swift-rs/tauri-plugin-lolly-auth/release"); symlink(&product, &alias).unwrap();
  assert_eq!(exports::find_archive(&out, false, false).unwrap(), archive.canonicalize().unwrap());
  fs::remove_file(alias.join("libtauri-plugin-lolly-auth.a")).unwrap();
  let foreign = owner("foreign").join("foreign.a"); fs::write(&foreign, b"fixture").unwrap(); symlink(foreign, &archive).unwrap();
  assert!(exports::find_archive(&out, false, false).is_err());
}
#[test] fn target_and_owner_are_required_before_tool_or_archive_mutation() {
  std::env::set_var("TARGET", "aarch64-linux-android"); exports::repair_from_env().unwrap();
  std::env::set_var("TARGET", "aarch64-apple-ios"); std::env::set_var("CARGO_PKG_NAME", "foreign-package");
  assert!(exports::repair_from_env().unwrap_err().contains("owning auth plugin"));
  std::env::set_var("CARGO_PKG_NAME", "tauri-plugin-lolly-auth"); std::env::set_var("DEBUG", "1");
  assert!(exports::repair_from_env().unwrap_err().contains("DEBUG"));
}
#[cfg(unix)] #[test] fn selected_compiler_tools_fail_before_any_archive_change() {
  use std::os::unix::fs::{PermissionsExt, symlink};
  for (mode, expected) in [("missing", "needs llvm-tools"), ("nonexec", "cannot start"), ("failing", "failed with"), ("invalid", "invalid version"), ("foreign", "escapes the selected"), ("holds-pipe", "stdout exceeded 20 seconds"), ("failed-descendant", "failed with")] {
    let out = owner(mode); let p = out.join("swift-rs/tauri-plugin-lolly-auth/release"); fs::create_dir_all(&p).unwrap();
    let archive = p.join("libtauri-plugin-lolly-auth.a"); let original = b"not yet inspected"; fs::write(&archive, original).unwrap();
    let sysroot = out.join("mock-toolchain"); let bin = sysroot.join("lib/rustlib/aarch64-apple-darwin/bin"); fs::create_dir_all(&bin).unwrap();
    let rustc = out.join("mock-rustc");
    fs::write(&rustc, format!("#!/bin/sh\\ncase \\"$*\\" in\\n  '--print sysroot') printf '%s\\\\n' '{}' ;;\\n  '--version --verbose') printf 'host: aarch64-apple-darwin\\\\n' ;;\\n  *) exit 9 ;;\\nesac\\n", sysroot.display())).unwrap();
    if mode == "holds-pipe" || mode == "failed-descendant" {
      let redirect = if mode == "failed-descendant" { " >/dev/null 2>&1" } else { "" };
      let code = if mode == "failed-descendant" { 7 } else { 0 };
      fs::write(&rustc, format!("#!/bin/sh\\nsleep 60{redirect} &\\nprintf '%s\\\\n' \\"$!\\" > '{}'\\nexit {code}\\n", out.join("owned-child.pid").display())).unwrap();
    }
    fs::set_permissions(&rustc, fs::Permissions::from_mode(0o700)).unwrap();
    let tool = bin.join("llvm-objcopy");
    if mode == "foreign" {
      let foreign = out.join("foreign-tool"); fs::write(&foreign, "#!/bin/sh\\nexit 0\\n").unwrap(); symlink(foreign, &tool).unwrap();
    } else if mode != "missing" {
      fs::write(&tool, if mode == "failing" { "#!/bin/sh\\nexit 7\\n" } else { "#!/bin/sh\\nprintf 'invalid tool\\\\n'\\n" }).unwrap();
      if mode != "nonexec" { fs::set_permissions(&tool, fs::Permissions::from_mode(0o700)).unwrap(); }
    }
    std::env::set_var("TARGET", "aarch64-apple-ios"); std::env::set_var("CARGO_PKG_NAME", "tauri-plugin-lolly-auth");
    std::env::set_var("DEBUG", "false"); std::env::set_var("OUT_DIR", &out); std::env::set_var("RUSTC", &rustc);
    let started = std::time::Instant::now();
    let error = exports::repair_from_env().unwrap_err(); assert!(error.contains(expected), "{mode}: {error}");
    assert!(started.elapsed() < std::time::Duration::from_secs(25));
    if mode == "holds-pipe" || mode == "failed-descendant" {
      let pid = fs::read_to_string(out.join("owned-child.pid")).unwrap();
      let status = std::process::Command::new("/bin/ps").args(["-p", pid.trim(), "-o", "stat="]).output().unwrap();
      let state = String::from_utf8(status.stdout).unwrap(); assert!(state.trim().is_empty() || state.trim().starts_with('Z'), "owned child still running");
    }
    assert_eq!(fs::read(&archive).unwrap(), original);
    assert!(!fs::read_dir(&out).unwrap().any(|entry| entry.unwrap().file_name().to_string_lossy().starts_with(".lolly-swiftrs-")));
  }
}
`
    );
    const env = { ...process.env, LOLLY_SWIFT_TEST_ROOT: path.join(scratch, 'fixtures') };
    const compile = spawnSync(
      process.env.RUSTC || 'rustc',
      ['--edition=2021', '--test', source, '-o', binary],
      {
        env,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 256 * 1024,
      }
    );
    assert.equal(
      compile.status,
      0,
      compile.stderr || compile.error?.message || 'native guard compiler failed'
    );
    const run = spawnSync(binary, ['--test-threads=1'], {
      env,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 256 * 1024,
    });
    assert.equal(
      run.status,
      0,
      run.stdout + run.stderr || run.error?.message || 'native guard fixture failed'
    );
    assert.match(run.stdout, /0 failed/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
