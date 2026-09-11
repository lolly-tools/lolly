// SPDX-License-Identifier: MPL-2.0
use std::path::{Path, PathBuf};

/// The bundled Node CLI (plans/202 WP1.3) is declared in `tauri.conf.json` as
/// `bundle.externalBin` plus a `cli-lib` resource directory, and `tauri_build::build()`
/// copies both on EVERY cargo build. A declared path that does not exist is a hard error
/// there, so without this a plain `cargo check` in a fresh checkout would fail with
/// `ResourcePathNotFound` and nothing would say why.
///
/// The sidecar is about 155 MB per target and is built by
/// `node scripts/build-cli-sidecar.ts --install` in the parent repo as a release step.
/// Nobody should pay that to run the tests. So when it has not been staged, put a
/// placeholder where the config points, and say so.
///
/// The placeholder is not a silent one. On unix it is a shell script that prints how to
/// build the real thing and exits 3 (UNAVAILABLE_HERE, the CLI's own code for "this
/// installation cannot do that"), so a dev build that forwards `Lolly list` gets a
/// sentence rather than a mystery. A real staged sidecar is never touched.
fn stage_sidecar_placeholder() {
    let Ok(target_triple) = std::env::var("TARGET") else { return };
    let src_tauri = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into()));

    // The payload directory. An empty one is fine for the resource walk; the placeholder
    // executable is what refuses, and it refuses before anything reads this.
    let payload = src_tauri.join("cli-lib");
    if !payload.is_dir() {
        let _ = std::fs::create_dir_all(&payload);
    }

    let suffix = if target_triple.contains("windows") { ".exe" } else { "" };
    let bin_dir = src_tauri.join("bin");
    let sidecar = bin_dir.join(format!("lolly-cli-{target_triple}{suffix}"));
    if sidecar.exists() {
        return;
    }
    let _ = std::fs::create_dir_all(&bin_dir);
    println!(
        "cargo:warning=no CLI sidecar staged for {target_triple}; using a placeholder. \
         Run `node scripts/build-cli-sidecar.ts --install` in the parent repo before a release build."
    );
    write_placeholder(&sidecar);
}

#[cfg(unix)]
fn write_placeholder(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let script = "#!/bin/sh\n\
        echo \"lolly: this build has no bundled CLI. Build it with\" >&2\n\
        echo \"  node scripts/build-cli-sidecar.ts --install\" >&2\n\
        echo \"in the Lolly checkout, then build the app again.\" >&2\n\
        exit 3\n";
    if std::fs::write(path, script).is_ok() {
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755));
    }
}

#[cfg(not(unix))]
fn write_placeholder(path: &Path) {
    // Windows will not run a script named .exe, so the placeholder is only a file that
    // lets the build proceed. The cargo warning above is the signal.
    let _ = std::fs::write(path, b"lolly: placeholder, run scripts/build-cli-sidecar.ts --install\n");
}

fn main() {
    stage_sidecar_placeholder();
    tauri_build::build()
}
