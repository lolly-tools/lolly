// SPDX-License-Identifier: MPL-2.0

//! Fold signal for the Lolly mobile app (plan 345, phase P4).
//!
//! On Android, `LollyFoldPlugin.kt` collects Jetpack WindowManager's
//! `WindowLayoutInfo` and reports the folding feature. This crate converts the
//! report to the page payload (`fold.rs`), keeps the latest one, emits it as
//! the `lolly://fold` event and answers the `current` command. iOS and desktop
//! have no native half: there is no known fold API on iOS, so `current`
//! answers null and nothing is emitted.

mod fold;

use std::sync::Mutex;

pub use fold::{FoldBounds, FoldOcclusion, FoldOrientation, FoldPayload, FoldState};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

/// Name of the event the page listens for.
pub const FOLD_EVENT: &str = "lolly://fold";

/// The latest conversion. The outer `None` means nothing has been reported
/// yet; `Some(None)` means "reported: no folding feature".
#[derive(Default)]
struct LastFold {
    latest: Mutex<Option<Option<FoldPayload>>>,
}

impl LastFold {
    /// Stores a report and says whether it should be emitted: the first report
    /// always is, later ones only when they differ from the last.
    #[cfg_attr(not(target_os = "android"), allow(dead_code))]
    fn record(&self, next: Option<FoldPayload>) -> bool {
        let mut latest = self.latest.lock().unwrap_or_else(|e| e.into_inner());
        if *latest == Some(next) {
            return false;
        }
        *latest = Some(next);
        true
    }

    fn current(&self) -> Option<FoldPayload> {
        let latest = self.latest.lock().unwrap_or_else(|e| e.into_inner());
        (*latest).flatten()
    }
}

/// The latest fold payload, or null when folded to the cover screen, when the
/// device is not a foldable, or on a platform with no fold API.
#[tauri::command]
fn current(state: State<'_, LastFold>) -> Option<FoldPayload> {
    state.current()
}

#[cfg(target_os = "android")]
fn listen<R: Runtime>(
    app: &AppHandle<R>,
    api: tauri::plugin::PluginApi<R, ()>,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::ipc::{Channel, InvokeResponseBody};
    use tauri::Emitter;

    let handle = api.register_android_plugin("tools.lolly.fold", "LollyFoldPlugin")?;
    let sink = app.clone();
    let channel = Channel::<serde_json::Value>::new(move |body: InvokeResponseBody| {
        let Ok(report) = body.deserialize::<fold::RawReport>() else {
            return Ok(());
        };
        let payload = fold::to_payload(&report);
        if sink.state::<LastFold>().record(payload) {
            sink.emit(FOLD_EVENT, payload)?;
        }
        Ok(())
    });
    // `registerListener` is the stock Tauri plugin command: later changes
    // arrive on the channel.
    handle.run_mobile_plugin::<()>(
        "registerListener",
        serde_json::json!({ "event": "fold", "handler": channel }),
    )?;
    Ok(())
}

#[cfg(not(target_os = "android"))]
fn listen<R: Runtime>(
    _app: &AppHandle<R>,
    _api: tauri::plugin::PluginApi<R, ()>,
) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R, ()>::new("lolly-fold")
        .invoke_handler(tauri::generate_handler![current])
        .setup(|app, api| {
            app.manage(LastFold::default());
            // A fold signal that cannot start must not stop the app: the page
            // falls back to window size and shape.
            if let Err(error) = listen(app, api) {
                eprintln!("lolly-fold: fold signal unavailable: {error}");
            }
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload(x: f64) -> FoldPayload {
        FoldPayload {
            state: FoldState::HalfOpened,
            orientation: FoldOrientation::Vertical,
            bounds: FoldBounds {
                x,
                y: 0.0,
                width: 0.0,
                height: 800.0,
            },
            is_separating: true,
            occlusion: FoldOcclusion::None,
        }
    }

    #[test]
    fn first_report_is_emitted_even_when_null() {
        let last = LastFold::default();
        assert!(last.record(None));
        assert!(!last.record(None));
        assert_eq!(last.current(), None);
    }

    #[test]
    fn only_changes_are_emitted() {
        let last = LastFold::default();
        assert!(last.record(Some(payload(400.0))));
        assert!(!last.record(Some(payload(400.0))));
        assert!(last.record(Some(payload(401.0))));
        assert_eq!(last.current(), Some(payload(401.0)));
        assert!(last.record(None));
        assert_eq!(last.current(), None);
    }
}
