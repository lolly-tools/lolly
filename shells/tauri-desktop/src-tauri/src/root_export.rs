// SPDX-License-Identifier: MPL-2.0
//! Materialise the app's embedded `tools/` and `catalog/` as a content root on disk
//! (plans/202 WP1.3).
//!
//! The desktop app EMBEDS its content: `frontendDist` is `../dist`, and the vite config's
//! embed step puts `tools/` and `catalog/` in there, so both live inside the binary and
//! are served to the webview by the asset protocol. The bundled Node CLI cannot read
//! them that way. It resolves content from a directory holding `catalog/tools/index.json`
//! (packages/node-shell/src/repo-root.ts), and it is a separate process with no asset
//! protocol.
//!
//! Shipping a second copy as bundle resources was the obvious answer and is the wrong
//! one: the embedded content already sits near the ~2 GB `ar` archive-offset limit the
//! rlib runs into (see the pruneEmbeddedDownloads note in shells/tauri-desktop/
//! vite.config.js), and a second copy of a 100 MB catalog buys nothing but risk.
//!
//! So the app writes the root out of itself, once per version, into its own data
//! directory, and the sidecar reads it from there. `og/` and `previews/` are skipped:
//! they are gallery and social-card imagery, nothing a render needs, and they are the
//! two biggest directories in a catalog.
//!
//! The hidden `--export-root <dir>` mode does the same thing to a directory of your
//! choosing, for a packager or for looking at what actually shipped.

use std::path::{Path, PathBuf};

use tauri::{Context, Runtime};

/// Asset keys under these prefixes become files in the exported root.
const INCLUDED: [&str; 2] = ["/tools/", "/catalog/"];

/// Skipped: gallery previews and social cards. Both are display imagery the CLI never
/// reads, and together they are most of a catalog's bytes.
const EXCLUDED: [&str; 2] = ["/catalog/og/", "/catalog/previews/"];

/// The marker every Node shell looks for. Written last, and the export is renamed into
/// place as a whole, so a half-written root can never answer "yes, I have content".
const MARKER: &str = "catalog/tools/index.json";

/// Is this asset key part of the content root?
pub fn is_root_asset(key: &str) -> bool {
    INCLUDED.iter().any(|p| key.starts_with(p)) && !EXCLUDED.iter().any(|p| key.starts_with(p))
}

/// The app's own data directory, computed without an `AppHandle` because this runs before
/// (and instead of) building the app. Same rule `tauri::path::PathResolver::app_data_dir`
/// uses, so the CLI root sits beside `saved-state/` rather than in a second home.
pub fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    Some(data_base()?.join(identifier))
}

/// The per-user data base, one definition per platform so no `cfg` block has to double as
/// a function's tail expression.
#[cfg(target_os = "macos")]
fn data_base() -> Option<PathBuf> {
    Some(PathBuf::from(std::env::var_os("HOME")?).join("Library/Application Support"))
}

#[cfg(target_os = "windows")]
fn data_base() -> Option<PathBuf> {
    Some(PathBuf::from(std::env::var_os("APPDATA")?))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn data_base() -> Option<PathBuf> {
    if let Some(data) = std::env::var_os("XDG_DATA_HOME").filter(|v| !v.is_empty()) {
        return Some(PathBuf::from(data));
    }
    Some(PathBuf::from(std::env::var_os("HOME")?).join(".local/share"))
}

/// Where this app version's exported root lives.
pub fn versioned_root<R: Runtime>(context: &Context<R>) -> Option<PathBuf> {
    let identifier = &context.config().identifier;
    let version = context.package_info().version.to_string();
    Some(app_data_dir(identifier)?.join("root").join(version))
}

/// Does `dir` already hold a usable root?
pub fn is_populated(dir: &Path) -> bool {
    dir.join(MARKER).is_file()
}

/// Write every content asset into `dir`. Returns how many files and bytes were written.
///
/// `assets.get()` is used rather than the bytes `assets.iter()` yields: with tauri's
/// default `compression` feature every embedded asset is stored brotli-compressed, and
/// only `get` decompresses. Iterating for the KEYS and fetching each one is the pairing
/// that gives real file contents.
pub fn export_to<R: Runtime>(context: &Context<R>, dir: &Path) -> std::io::Result<(usize, u64)> {
    let assets = context.assets();
    let keys: Vec<String> = assets
        .iter()
        .map(|(key, _)| key.into_owned())
        .filter(|key| is_root_asset(key))
        .collect();

    let mut files = 0usize;
    let mut bytes = 0u64;
    for key in keys {
        let asset_key: tauri::utils::assets::AssetKey = key.as_str().into();
        let Some(content) = assets.get(&asset_key) else { continue };
        // The key is an absolute asset path ("/catalog/tools/index.json"); strip the
        // leading slash so it joins onto `dir` instead of replacing it.
        let target = dir.join(key.trim_start_matches('/'));
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&target, &content[..])?;
        files += 1;
        bytes += content.len() as u64;
    }
    Ok((files, bytes))
}

/// Export into a staging directory and rename it into place, so another process either
/// sees no root or sees a complete one. A rename that loses the race (someone else got
/// there first) is not an error: their root is as good as ours.
fn export_atomically<R: Runtime>(context: &Context<R>, final_dir: &Path) -> std::io::Result<()> {
    let parent = final_dir.parent().unwrap_or(final_dir);
    std::fs::create_dir_all(parent)?;
    let staging = parent.join(format!(".staging-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&staging);
    std::fs::create_dir_all(&staging)?;

    let result = export_to(context, &staging);
    if result.is_err() {
        let _ = std::fs::remove_dir_all(&staging);
        return result.map(|_| ());
    }
    if std::fs::rename(&staging, final_dir).is_err() {
        let _ = std::fs::remove_dir_all(&staging);
        if !is_populated(final_dir) {
            return Err(std::io::Error::other(format!(
                "could not put the exported content root in place at {}",
                final_dir.display()
            )));
        }
    }
    Ok(())
}

/// The content root the sidecar should use, exporting it first if this version has not
/// been exported yet. `None` when there is no data directory to write into or the export
/// failed, in which case the caller runs the sidecar with no root and the CLI prints its
/// own three-ways-to-get-one message.
pub fn ensure_root<R: Runtime>(context: &Context<R>) -> Option<PathBuf> {
    let dir = versioned_root(context)?;
    if is_populated(&dir) {
        return Some(dir);
    }
    match export_atomically(context, &dir) {
        Ok(()) if is_populated(&dir) => Some(dir),
        Ok(()) => None,
        Err(e) => {
            eprintln!("lolly: could not write the bundled tools to {}: {e}", dir.display());
            None
        }
    }
}

/// `Lolly --export-root <dir>`: write the embedded content root where asked, then exit.
/// Hidden, and not in `--help`: it exists for a packager, and for reading what shipped.
pub fn run_export<R: Runtime>(context: &Context<R>, dir: String) -> ! {
    let target = PathBuf::from(&dir);
    match export_to(context, &target) {
        Ok((files, bytes)) => {
            eprintln!(
                "lolly: wrote {files} files ({:.1} MB) to {}",
                bytes as f64 / 1024.0 / 1024.0,
                target.display()
            );
            if !is_populated(&target) {
                eprintln!("lolly: {MARKER} is missing - this build embeds no catalog");
                std::process::exit(1);
            }
            std::process::exit(0);
        }
        Err(e) => {
            eprintln!("lolly: could not write to {}: {e}", target.display());
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tools_and_catalog_are_the_root_and_nothing_else_is() {
        assert!(is_root_asset("/tools/qr-code/tool.json"));
        assert!(is_root_asset("/catalog/tools/index.json"));
        assert!(is_root_asset("/catalog/assets/index.json"));
        // The web shell's own build output is not content.
        assert!(!is_root_asset("/index.html"));
        assert!(!is_root_asset("/assets/main-abc123.js"));
        // A path that merely CONTAINS the word is not under it.
        assert!(!is_root_asset("/info/tools.html"));
    }

    #[test]
    fn gallery_imagery_is_left_behind() {
        assert!(!is_root_asset("/catalog/og/chart.png"));
        assert!(!is_root_asset("/catalog/previews/chart.svg"));
    }

    #[test]
    fn the_marker_is_the_one_every_node_shell_looks_for() {
        // packages/node-shell/src/repo-root.ts hasCatalogMarker(). If that moves, an
        // exported root stops being recognised and the sidecar refuses with exit 3.
        assert_eq!(MARKER, "catalog/tools/index.json");
    }
}
