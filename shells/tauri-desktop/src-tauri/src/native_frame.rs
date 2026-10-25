// SPDX-License-Identifier: MPL-2.0
//! The native frame around the web UI (plans/321 M1): the macOS unified title
//! bar, the window title, recent documents and the Dock menu.
//!
//! Nothing here renders or decides anything about content. The page stays the
//! one UI; this module gives it the window behaviour a Mac app is expected to
//! have, and routes every native action back through the same doors the web
//! side already owns (`window.__lollyMenu`, the DesktopEvents open queue).

use std::path::{Path, PathBuf};
#[cfg(target_os = "macos")]
use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Manager, Runtime, WebviewWindow, WebviewWindowBuilder};

/// Stamps `data-native-titlebar="mac"` on <html> before the page's own scripts
/// run, so the first paint already leaves room for the window buttons
/// (shells/web/src/styles/parts/native-titlebar.css). An initialization script
/// is not subject to the page CSP, and at document start <html> may not exist
/// yet, hence the observer.
#[cfg(target_os = "macos")]
const TITLEBAR_FLAG: &str = "(function(){var s=function(){document.documentElement.setAttribute('data-native-titlebar','mac')};\
if(document.documentElement){s();return}\
new MutationObserver(function(_,o){if(document.documentElement){s();o.disconnect()}}).observe(document,{childList:true})})();";

/// Dress the main window: the title follows `document.title` (it is hidden in
/// the unified bar, but the Window menu, Mission Control, the Dock's window
/// list and VoiceOver all read the title), and on macOS the page learns that
/// the window buttons sit over its top row.
pub fn main_window<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    let builder = builder.on_document_title_changed(|window, title| {
        let _ = window.set_title(&title);
    });
    #[cfg(target_os = "macos")]
    let builder = builder.initialization_script(TITLEBAR_FLAG);
    builder
}

// ── title-bar presses (lib/native-titlebar.ts) ───────────────────────────────

/// What a double-click on the title bar does, from the user's own setting.
#[derive(Debug, PartialEq, Eq)]
pub enum DoubleClick {
    Zoom,
    Minimise,
    Nothing,
}

/// Map `AppleActionOnDoubleClick` (System Settings > Desktop & Dock, "Double-click
/// a window's title bar to") to an action. Absent means the system default, Zoom;
/// "Fill" is the newer name for the same thing.
pub fn double_click_action(setting: Option<&str>) -> DoubleClick {
    match setting {
        Some("Minimize") => DoubleClick::Minimise,
        Some("None") => DoubleClick::Nothing,
        _ => DoubleClick::Zoom,
    }
}

/// The page's only window verb. `drag` starts a native move from the current
/// press; `double-click` applies the user's title-bar setting.
#[tauri::command]
pub fn desktop_titlebar(window: WebviewWindow, action: String) -> Result<(), String> {
    match action.as_str() {
        "drag" => window.start_dragging().map_err(|e| e.to_string()),
        "double-click" => {
            let target = window.clone();
            window
                .run_on_main_thread(move || double_click(&target))
                .map_err(|e| e.to_string())
        }
        _ => Err("unknown title-bar action".into()),
    }
}

#[cfg(target_os = "macos")]
fn double_click<R: Runtime>(window: &WebviewWindow<R>) {
    use objc2_app_kit::NSWindow;
    use objc2_foundation::{NSString, NSUserDefaults};
    let setting = NSUserDefaults::standardUserDefaults()
        .stringForKey(&NSString::from_str("AppleActionOnDoubleClick"))
        .map(|s| s.to_string());
    let Ok(ptr) = window.ns_window() else { return };
    // SAFETY: Tauri hands back the live NSWindow of this webview window, and
    // run_on_main_thread put us on the thread AppKit requires.
    let ns_window: &NSWindow = unsafe { &*(ptr as *const NSWindow) };
    match double_click_action(setting.as_deref()) {
        DoubleClick::Zoom => ns_window.zoom(None),
        DoubleClick::Minimise => ns_window.miniaturize(None),
        DoubleClick::Nothing => {}
    }
}

#[cfg(not(target_os = "macos"))]
fn double_click<R: Runtime>(window: &WebviewWindow<R>) {
    // Only the macOS window draws over its title bar today; elsewhere this is
    // the conventional maximise toggle, kept so the command means one thing.
    let _ = match window.is_maximized() {
        Ok(true) => window.unmaximize(),
        _ => window.maximize(),
    };
}

// ── recent documents ─────────────────────────────────────────────────────────

/// Record a file Lolly opened in AppKit's recent-documents list, which feeds
/// File > Open Recent, the Dock icon's menu and Finder's Recents. A no-op on
/// other platforms.
pub fn note_recent(app: &AppHandle, path: &Path) {
    #[cfg(target_os = "macos")]
    {
        let path = path.to_path_buf();
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            let Some(mtm) = objc2::MainThreadMarker::new() else { return };
            let url = objc2_foundation::NSURL::fileURLWithPath(&objc2_foundation::NSString::from_str(
                &path.to_string_lossy(),
            ));
            objc2_app_kit::NSDocumentController::sharedDocumentController(mtm).noteNewRecentDocumentURL(&url);
            crate::menu::rebuild(&handle);
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, path);
}

/// The recent documents that still exist, newest first. Main thread only.
pub fn recent_documents() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let Some(mtm) = objc2::MainThreadMarker::new() else { return Vec::new() };
        let urls = objc2_app_kit::NSDocumentController::sharedDocumentController(mtm).recentDocumentURLs();
        (0..urls.count())
            .filter_map(|i| urls.objectAtIndex(i).path())
            .map(|p| PathBuf::from(p.to_string()))
            .filter(|p| p.is_file())
            .collect()
    }
    #[cfg(not(target_os = "macos"))]
    Vec::new()
}

/// File > Open Recent > Clear Menu. Main thread only.
pub fn clear_recent_documents() {
    #[cfg(target_os = "macos")]
    if let Some(mtm) = objc2::MainThreadMarker::new() {
        // SAFETY: the sender is optional and AppKit ignores it here.
        unsafe { objc2_app_kit::NSDocumentController::sharedDocumentController(mtm).clearRecentDocuments(None) };
    }
}

// ── opening files ────────────────────────────────────────────────────────────

/// File > Open... and the Dock menu's Open...: the system open panel, then the
/// same delivery a Finder double-click takes.
pub fn open_panel(app: &AppHandle) {
    use tauri_plugin_dialog::DialogExt;
    let handle = app.clone();
    app.dialog().file().pick_file(move |picked| {
        let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return };
        crate::desktop_integration::deliver_open_file(&handle, path);
        crate::desktop_integration::focus_main(&handle);
    });
}

// ── the Dock menu (macOS) ────────────────────────────────────────────────────

/// One row of the Dock icon's menu.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DockAction {
    /// Navigate the main window to an in-app hash route.
    Route(String),
    /// Show the open panel.
    Open,
}

#[cfg(target_os = "macos")]
static APP: OnceLock<AppHandle> = OnceLock::new();
#[cfg(target_os = "macos")]
static DOCK_ITEMS: Mutex<Vec<(String, DockAction)>> = Mutex::new(Vec::new());

/// Replace the Dock menu's rows. Read fresh every time the Dock asks, so a
/// change takes effect on the next right-click.
pub fn set_dock_items(items: Vec<(String, DockAction)>) {
    #[cfg(target_os = "macos")]
    if let Ok(mut current) = DOCK_ITEMS.lock() {
        *current = items;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = items;
}

/// Teach the app delegate `applicationDockMenu:`. tao owns the delegate class
/// and declares no Dock menu, so the method is added to that class at runtime;
/// the rows target the same delegate through a second added selector. Call
/// once, on the main thread, after the event loop exists (Tauri's setup).
#[cfg(target_os = "macos")]
pub fn install_dock_menu(app: &AppHandle) {
    use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
    use objc2::{msg_send, sel, MainThreadOnly};

    let _ = APP.set(app.clone());
    let Some(mtm) = objc2::MainThreadMarker::new() else { return };
    let ns_app = objc2_app_kit::NSApplication::sharedApplication(mtm);
    let Some(delegate) = ns_app.delegate() else { return };
    let delegate: &AnyObject = delegate.as_ref();
    let class: *const AnyClass = delegate.class();

    extern "C-unwind" fn dock_menu(this: &AnyObject, _cmd: Sel, _app: *mut AnyObject) -> *mut AnyObject {
        let Some(mtm) = objc2::MainThreadMarker::new() else { return std::ptr::null_mut() };
        let items = DOCK_ITEMS.lock().map(|i| i.clone()).unwrap_or_default();
        if items.is_empty() {
            return std::ptr::null_mut();
        }
        let menu = objc2_app_kit::NSMenu::new(mtm);
        for (index, (title, _)) in items.iter().enumerate() {
            // SAFETY: a fresh item with a selector this class answers (added below).
            let item = unsafe {
                objc2_app_kit::NSMenuItem::initWithTitle_action_keyEquivalent(
                    objc2_app_kit::NSMenuItem::alloc(mtm),
                    &objc2_foundation::NSString::from_str(title),
                    Some(sel!(lollyDockItem:)),
                    &objc2_foundation::NSString::from_str(""),
                )
            };
            item.setTag(index as isize);
            // SAFETY: the delegate outlives the menu, which AppKit drops after use.
            unsafe { item.setTarget(Some(this)) };
            menu.addItem(&item);
        }
        objc2::rc::Retained::autorelease_return(menu) as *mut AnyObject
    }

    extern "C-unwind" fn dock_item(_this: &AnyObject, _cmd: Sel, sender: *mut AnyObject) {
        if sender.is_null() {
            return;
        }
        // SAFETY: AppKit passes the NSMenuItem that was chosen.
        let tag: isize = unsafe { msg_send![&*sender, tag] };
        let action = DOCK_ITEMS
            .lock()
            .ok()
            .and_then(|items| items.get(tag as usize).map(|(_, a)| a.clone()));
        let (Some(action), Some(app)) = (action, APP.get()) else { return };
        match action {
            DockAction::Route(hash) => {
                crate::desktop_integration::focus_main(app);
                crate::menu::open_route(app, &hash);
            }
            DockAction::Open => open_panel(app),
        }
    }

    // SAFETY: both functions match the ObjC signatures in their type strings
    // ("@@:@" returns an object, "v@:@" returns nothing; each takes self, _cmd
    // and one object). class_addMethod refuses, harmlessly, if tao ever starts
    // declaring a Dock menu of its own.
    unsafe {
        objc2::ffi::class_addMethod(
            class as *mut AnyClass,
            sel!(applicationDockMenu:),
            std::mem::transmute::<
                extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) -> *mut AnyObject,
                Imp,
            >(dock_menu),
            c"@@:@".as_ptr(),
        );
        objc2::ffi::class_addMethod(
            class as *mut AnyClass,
            sel!(lollyDockItem:),
            std::mem::transmute::<extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject), Imp>(dock_item),
            c"v@:@".as_ptr(),
        );
    }
}

#[cfg(not(target_os = "macos"))]
pub fn install_dock_menu(_app: &AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn double_click_follows_the_system_setting() {
        assert_eq!(double_click_action(None), DoubleClick::Zoom);
        assert_eq!(double_click_action(Some("Maximize")), DoubleClick::Zoom);
        assert_eq!(double_click_action(Some("Fill")), DoubleClick::Zoom);
        assert_eq!(double_click_action(Some("Minimize")), DoubleClick::Minimise);
        assert_eq!(double_click_action(Some("None")), DoubleClick::Nothing);
    }
}
