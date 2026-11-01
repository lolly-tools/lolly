// SPDX-License-Identifier: MPL-2.0
//! Crash-safe document writes for both Tauri shells.
//!
//! A save that is interrupted (a crash, a power cut, a killed process) must
//! leave the previous document whole, never a truncated one. The write goes to a
//! temporary file beside the destination, is flushed to the disk, is renamed over
//! the destination, and the folder is flushed so the rename itself survives.
//!
//! On macOS and iOS `File::sync_all` already issues `F_FULLFSYNC`, which is the
//! flush that really reaches the platter or flash (a plain `fsync` does not).
//!
//! The ordering and the fault seam follow the same idea as the storytold
//! `atomic` crate (MIT OR Apache-2.0); no code is copied from it.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// Folder, under the app data directory, that holds documents, slots and the
/// migration marker. Nothing outside it can be written through the command.
const DOCUMENT_DIR: &str = "saved-state";
const MAX_DOCUMENT_BYTES: usize = 256 * 1024 * 1024;
/// Windows sharing violations (a virus scanner or indexer briefly holding the
/// file) are retried with a doubling wait, each wait capped at this.
const RENAME_BACKOFF_CAP: Duration = Duration::from_millis(200);
const RENAME_ATTEMPTS: u32 = 8;

/// The steps of a save, in order. A test fault is raised just before a step.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Step {
    WriteTemp,
    SyncTemp,
    Rename,
    SyncDir,
}

/// Fault-injection seam: production uses `NoFaults`, tests fail a chosen step.
pub(crate) trait Faults {
    fn before(&self, step: Step) -> io::Result<()>;
}

pub(crate) struct NoFaults;
impl Faults for NoFaults {
    fn before(&self, _step: Step) -> io::Result<()> {
        Ok(())
    }
}

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

fn temp_path_for(path: &Path) -> io::Result<PathBuf> {
    let name = path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "the destination has no file name"))?;
    let mut temp = name.to_os_string();
    temp.push(format!(
        ".{}-{}.tmp",
        std::process::id(),
        TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    Ok(path.with_file_name(temp))
}

fn is_sharing_violation(error: &io::Error) -> bool {
    // ERROR_SHARING_VIOLATION (32) and ERROR_LOCK_VIOLATION (33).
    matches!(error.raw_os_error(), Some(32) | Some(33))
}

/// Run `rename`, retrying sharing violations with a capped doubling backoff.
/// Other errors fail at once. `pause` is injectable so tests do not sleep.
fn rename_with_retry(
    mut rename: impl FnMut() -> io::Result<()>,
    retryable: impl Fn(&io::Error) -> bool,
    mut pause: impl FnMut(Duration),
) -> io::Result<()> {
    let mut wait = Duration::from_millis(10);
    let mut attempt = 1;
    loop {
        match rename() {
            Ok(()) => return Ok(()),
            Err(error) if attempt < RENAME_ATTEMPTS && retryable(&error) => {
                pause(wait);
                wait = (wait * 2).min(RENAME_BACKOFF_CAP);
                attempt += 1;
            }
            Err(error) => return Err(error),
        }
    }
}

fn sync_directory(dir: &Path) -> io::Result<()> {
    // Windows cannot open a folder as a file; its rename is already durable
    // enough for this use, so the folder flush is a unix step.
    #[cfg(unix)]
    {
        File::open(dir)?.sync_all()
    }
    #[cfg(not(unix))]
    {
        let _ = dir;
        Ok(())
    }
}

fn write_temp(temp: &Path, bytes: &[u8], faults: &dyn Faults) -> io::Result<()> {
    // Default permissions, as the fs plugin's own writeTextFile created these
    // files, so a document keeps the mode it always had. create_new refuses to
    // reuse or follow anything already at the temporary name.
    let mut file = OpenOptions::new().write(true).create_new(true).open(temp)?;
    faults.before(Step::WriteTemp)?;
    file.write_all(bytes)?;
    faults.before(Step::SyncTemp)?;
    file.sync_all()
}

/// Replace `path` with `bytes` so that it is always either the old or the new
/// content. On any failure the temporary file is removed and the previous
/// document is left as it was.
pub(crate) fn write_atomic_with(path: &Path, bytes: &[u8], faults: &dyn Faults) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "the destination has no folder"))?;
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if !metadata.is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "the destination is not a regular file",
            ));
        }
    }
    let temp = temp_path_for(path)?;
    let result = (|| {
        write_temp(&temp, bytes, faults)?;
        faults.before(Step::Rename)?;
        rename_with_retry(
            || fs::rename(&temp, path),
            is_sharing_violation,
            std::thread::sleep,
        )?;
        // The new document is in place. A failed folder flush no longer risks
        // the content, so it must not undo or hide the save.
        let _ = faults.before(Step::SyncDir).and_then(|()| sync_directory(parent));
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    write_atomic_with(path, bytes, &NoFaults)
}

/// A save in flight from another window is younger than this, so the startup
/// sweep never touches it.
const STALE_TEMP_AGE: Duration = Duration::from_secs(60);

/// True only for the exact names `temp_path_for` makes: a `.json` or `.marker`
/// file name, then `.<pid>-<counter>.tmp`.
fn is_writer_temp_name(name: &str) -> bool {
    let Some(stem) = name.strip_suffix(".tmp") else { return false };
    let Some((target, tag)) = stem.rsplit_once('.') else { return false };
    let Some((pid, count)) = tag.split_once('-') else { return false };
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    digits(pid) && digits(count) && (target.ends_with(".json") || target.ends_with(".marker"))
}

/// Remove temp files a hard kill left in `dir`, if older than `grace`.
/// Returns how many were removed. Every other file is left alone.
pub(crate) fn sweep_stale_temps_in(dir: &Path, grace: Duration) -> usize {
    let Ok(entries) = fs::read_dir(dir) else { return 0 };
    let mut removed = 0;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if !is_writer_temp_name(name) {
            continue;
        }
        let Ok(metadata) = fs::symlink_metadata(entry.path()) else { continue };
        let old_enough = metadata
            .modified()
            .ok()
            .and_then(|m| m.elapsed().ok())
            .is_some_and(|age| age >= grace);
        if metadata.is_file() && old_enough && fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        }
    }
    removed
}

/// Startup sweep of `<app data>/saved-state`, run before the page's first read.
pub(crate) fn sweep_stale_temps<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    use tauri::Manager;
    if let Ok(base) = app.path().app_data_dir() {
        sweep_stale_temps_in(&base.join(DOCUMENT_DIR), STALE_TEMP_AGE);
    }
}

/// Resolve a path the page sent (relative to the app data folder) to a file
/// inside `saved-state/`, refusing anything that could land elsewhere.
pub(crate) fn resolve_document_path(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut parts = Vec::new();
    for component in Path::new(relative).components() {
        match component {
            Component::Normal(part) => parts.push(part),
            _ => return Err("Documents are saved by a path inside the app folder.".into()),
        }
    }
    if parts.len() != 2 || parts[0] != DOCUMENT_DIR {
        return Err("Documents are saved only in the saved-state folder.".into());
    }
    let name = parts[1].to_string_lossy();
    if name.ends_with(".tmp") || name.contains(['\\', '/', ':']) {
        return Err("That document name is not allowed.".into());
    }
    Ok(base.join(DOCUMENT_DIR).join(parts[1]))
}

/// Save one document, slot or migration file atomically. `path` is relative to
/// the app data folder, as for the fs plugin calls beside it.
#[tauri::command]
pub(crate) async fn write_document_atomic<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
    contents: String,
) -> Result<(), String> {
    use tauri::Manager;
    if contents.len() > MAX_DOCUMENT_BYTES {
        return Err("That document is too large to save.".into());
    }
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?;
    let target = resolve_document_path(&base, &path)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        write_atomic(&target, contents.as_bytes()).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    struct FailAt(Step);
    impl Faults for FailAt {
        fn before(&self, step: Step) -> io::Result<()> {
            if step == self.0 {
                Err(io::Error::new(io::ErrorKind::Other, "injected fault"))
            } else {
                Ok(())
            }
        }
    }

    /// A scratch folder removed on drop (std only, so the mobile crate needs no
    /// extra dev-dependency).
    struct TestDir(PathBuf);
    impl TestDir {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!(
                "lolly-atomic-{}-{}",
                std::process::id(),
                TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&dir).unwrap();
            TestDir(dir)
        }
        fn path(&self) -> &Path {
            &self.0
        }
    }
    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn names(dir: &Path) -> Vec<String> {
        let mut out: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        out.sort();
        out
    }

    #[test]
    fn writes_a_new_and_a_replacement_document() {
        let dir = TestDir::new();
        let path = dir.path().join("a.json");
        write_atomic(&path, b"one").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"one");
        write_atomic(&path, b"two").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"two");
        assert_eq!(names(dir.path()), ["a.json"]);
    }

    #[test]
    fn a_failure_at_any_step_before_the_rename_keeps_the_old_document() {
        for step in [Step::WriteTemp, Step::SyncTemp, Step::Rename] {
            let dir = TestDir::new();
            let path = dir.path().join("a.json");
            fs::write(&path, b"previous").unwrap();
            assert!(write_atomic_with(&path, b"replacement", &FailAt(step)).is_err());
            assert_eq!(fs::read(&path).unwrap(), b"previous", "{step:?}");
            assert_eq!(names(dir.path()), ["a.json"], "temp left after {step:?}");
        }
    }

    #[test]
    fn a_failed_first_save_leaves_nothing_behind() {
        let dir = TestDir::new();
        let path = dir.path().join("a.json");
        assert!(write_atomic_with(&path, b"x", &FailAt(Step::Rename)).is_err());
        assert!(names(dir.path()).is_empty());
    }

    #[test]
    fn a_failed_folder_flush_does_not_undo_the_save() {
        let dir = TestDir::new();
        let path = dir.path().join("a.json");
        fs::write(&path, b"previous").unwrap();
        write_atomic_with(&path, b"replacement", &FailAt(Step::SyncDir)).unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"replacement");
        assert_eq!(names(dir.path()), ["a.json"]);
    }

    #[test]
    fn refuses_a_directory_destination() {
        let dir = TestDir::new();
        let path = dir.path().join("a.json");
        fs::create_dir(&path).unwrap();
        assert!(write_atomic(&path, b"x").is_err());
        assert_eq!(names(dir.path()), ["a.json"]);
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_symlink_destination_and_leaves_its_target_alone() {
        let dir = TestDir::new();
        let target = dir.path().join("target");
        fs::write(&target, b"keep").unwrap();
        let link = dir.path().join("a.json");
        std::os::unix::fs::symlink(&target, &link).unwrap();
        assert!(write_atomic(&link, b"x").is_err());
        assert_eq!(fs::read(&target).unwrap(), b"keep");
    }

    #[test]
    fn retries_sharing_violations_with_a_capped_backoff() {
        let calls = Cell::new(0);
        let mut waits = Vec::new();
        let result = rename_with_retry(
            || {
                calls.set(calls.get() + 1);
                if calls.get() < 7 {
                    Err(io::Error::from_raw_os_error(32))
                } else {
                    Ok(())
                }
            },
            is_sharing_violation,
            |wait| waits.push(wait),
        );
        assert!(result.is_ok());
        assert_eq!(waits.len(), 6);
        assert!(waits.iter().all(|w| *w <= RENAME_BACKOFF_CAP));
        assert_eq!(*waits.last().unwrap(), RENAME_BACKOFF_CAP);
    }

    #[test]
    fn does_not_retry_other_errors_and_gives_up_eventually() {
        let calls = Cell::new(0);
        let other = rename_with_retry(
            || {
                calls.set(calls.get() + 1);
                Err(io::Error::from_raw_os_error(2))
            },
            is_sharing_violation,
            |_| {},
        );
        assert!(other.is_err());
        assert_eq!(calls.get(), 1);
        calls.set(0);
        let stuck = rename_with_retry(
            || {
                calls.set(calls.get() + 1);
                Err(io::Error::from_raw_os_error(33))
            },
            is_sharing_violation,
            |_| {},
        );
        assert!(stuck.is_err());
        assert_eq!(calls.get(), RENAME_ATTEMPTS);
    }

    #[test]
    fn sweep_removes_only_stale_writer_temps() {
        let dir = TestDir::new();
        let keep = [
            "a.json",
            "slotname-v1.marker",
            "a.json.tmp",
            "a.json.12-x.tmp",
            "a.txt.12-3.tmp",
            "a.json.12-3.tmp.bak",
        ];
        for name in keep {
            fs::write(dir.path().join(name), b"x").unwrap();
        }
        fs::write(dir.path().join("a.json.12-3.tmp"), b"x").unwrap();
        fs::write(dir.path().join("slotname-v1.marker.4-5.tmp"), b"x").unwrap();
        // Fresh temps are kept: a save may be in flight.
        assert_eq!(sweep_stale_temps_in(dir.path(), Duration::from_secs(3600)), 0);
        assert!(dir.path().join("a.json.12-3.tmp").exists());
        // With no grace period the matching temps go and nothing else does.
        assert_eq!(sweep_stale_temps_in(dir.path(), Duration::ZERO), 2);
        assert_eq!(names(dir.path()).len(), keep.len());
        for name in keep {
            assert!(dir.path().join(name).exists(), "{name}");
        }
    }

    #[test]
    fn only_saved_state_files_resolve() {
        let base = Path::new("/data");
        assert_eq!(
            resolve_document_path(base, "saved-state/Q3%20Report.json").unwrap(),
            base.join("saved-state").join("Q3%20Report.json")
        );
        assert!(resolve_document_path(base, "saved-state/slotname-v1.marker").is_ok());
        for bad in [
            "",
            "saved-state",
            "saved-state/",
            "/etc/passwd",
            "../x.json",
            "saved-state/../x.json",
            "saved-state/sub/x.json",
            "pack-store/x.json",
            "saved-state/x.json.tmp",
            "other/x.json",
        ] {
            assert!(resolve_document_path(base, bad).is_err(), "{bad}");
        }
    }
}
