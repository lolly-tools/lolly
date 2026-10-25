// SPDX-License-Identifier: MPL-2.0
//! Native app menu (the macOS menu bar; harmless window menus elsewhere).
//!
//! Same design as the iPad menu bar (tauri-mobile gen/apple MenuBar.mm): all
//! content/behaviour lives in the web shell's tiny `window.__lollyMenu`
//! surface (shells/web/src/lib/app-menu.ts). The frontend pushes dynamic data
//! (lead tools, utilities, project folders, current theme) to the
//! `set_menu_data` command, which rebuilds the whole menu; every menu action
//! drives the webview back through `__lollyMenu` via eval. This module stays
//! a dumb projection of the web app, so the iPad and Mac menus cannot drift.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager};

use crate::native_frame::{self, DockAction};

#[derive(Deserialize, Clone, Default)]
pub struct MenuEntry {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize, Clone, Default)]
pub struct MenuData {
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub tools: Vec<MenuEntry>,
    #[serde(default)]
    pub utilities: Vec<MenuEntry>,
    #[serde(default)]
    pub folders: Vec<MenuEntry>,
}

/// Menu ids carry their payload: `lolly:#/u` navigates, `lolly-theme:dark`
/// switches theme, `lolly-zoom:1` steps the webview zoom, `open_exports`
/// (pre-existing) reveals the exports folder.
const ROUTE_PREFIX: &str = "lolly:";
const THEME_PREFIX: &str = "lolly-theme:";
const ZOOM_PREFIX: &str = "lolly-zoom:";
/// File > Open... (plans/321 M1).
const OPEN_ID: &str = "lolly-file:open";
/// File > Open Recent rows carry an index into RECENT; `clear` is Clear Menu.
const RECENT_PREFIX: &str = "lolly-recent:";
const RECENT_CLEAR: &str = "lolly-recent:clear";

/// The last data the frontend pushed, so the menu can be rebuilt natively when
/// something only Rust knows changes (a new recent document, Clear Menu).
static LAST: Mutex<Option<MenuData>> = Mutex::new(None);
/// The recent documents the current Open Recent rows were built from. The row
/// id is an index into this, so a click opens exactly the row that was shown.
static RECENT: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());

/// How many recent documents File > Open Recent lists.
const RECENT_MAX: usize = 10;

/// Open Recent labels: the file name, with the folder added when two recent
/// files share a name, so the rows can be told apart.
pub fn recent_labels(paths: &[PathBuf]) -> Vec<String> {
    let name = |p: &PathBuf| {
        p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| p.display().to_string())
    };
    paths
        .iter()
        .map(|p| {
            let base = name(p);
            let shared = paths.iter().filter(|q| name(q) == base).count() > 1;
            match p.parent().and_then(|d| d.file_name()) {
                Some(dir) if shared => format!("{base} ({})", dir.to_string_lossy()),
                _ => base,
            }
        })
        .collect()
}

fn route_item(
    handle: &AppHandle,
    text: &str,
    hash: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<tauri::Wry>> {
    MenuItem::with_id(handle, format!("{ROUTE_PREFIX}{hash}"), text, true, accelerator)
}

/// Build the full app menu. Called at startup (default/empty data) and again
/// on every `set_menu_data` push from the frontend.
pub fn build_menu(handle: &AppHandle, data: &MenuData) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::default(handle)?;

    // Go - the navigation hub, mirroring the iPad menu bar.
    let go = Submenu::new(handle, "Go", true)?;
    go.append(&route_item(handle, "Home", "#/", Some("CmdOrCtrl+Shift+H"))?)?;

    let projects = Submenu::new(handle, "Projects", true)?;
    projects.append(&route_item(handle, "All Projects", "#/p", Some("CmdOrCtrl+Shift+P"))?)?;
    if !data.folders.is_empty() {
        projects.append(&PredefinedMenuItem::separator(handle)?)?;
        for f in &data.folders {
            projects.append(&route_item(handle, &f.name, &format!("#/p/{}", f.id), None)?)?;
        }
    }
    go.append(&projects)?;

    let utilities = Submenu::new(handle, "Utilities", true)?;
    utilities.append(&route_item(handle, "All Utilities", "#/u", Some("CmdOrCtrl+Shift+U"))?)?;
    if !data.utilities.is_empty() {
        utilities.append(&PredefinedMenuItem::separator(handle)?)?;
        for u in &data.utilities {
            utilities.append(&route_item(handle, &u.name, &format!("#/tool/{}", u.id), None)?)?;
        }
    }
    go.append(&utilities)?;

    go.append(&PredefinedMenuItem::separator(handle)?)?;
    go.append(&route_item(handle, "Assets", "#/a", None)?)?;
    go.append(&route_item(handle, "Dashboard", "#/d", None)?)?;
    go.append(&route_item(handle, "Batch", "#/batch", None)?)?;
    go.append(&route_item(handle, "Colour Lab", "#/lab", None)?)?;
    go.append(&route_item(handle, "Verify a File", "#/valid", None)?)?;
    go.append(&route_item(handle, "Unpack a PDF", "#/unpack", None)?)?;
    go.append(&PredefinedMenuItem::separator(handle)?)?;
    go.append(&route_item(handle, "Design System Setup", "#/start", Some("CmdOrCtrl+Shift+B"))?)?;
    go.append(&route_item(handle, "Profile & Settings", "#/profile", Some("CmdOrCtrl+,"))?)?;

    // Tools - the same six leads the gallery greets a new user with.
    let tools = Submenu::new(handle, "Tools", true)?;
    for (i, t) in data.tools.iter().enumerate() {
        let accel = if i == 0 { Some("CmdOrCtrl+N") } else { None };
        tools.append(&route_item(handle, &t.name, &format!("#/tool/{}", t.id), accel)?)?;
    }

    // Zoom - the whole-UI zoom a browser gives every page for free and a wry
    // webview gives none (plans/202 WP4.1). The ACCELERATORS live here rather
    // than on a keydown listener in the page: a menu accelerator is consumed
    // before the webview sees the key, so there is exactly one handler and no
    // chance of the menu and a page listener both firing. The step itself is
    // done in JS (bridge-overrides/zoom.ts) because that is where the clamp and
    // the saved factor live. shells/web/src/views/tool-stage-nav.ts answers the
    // BARE keys for canvas zoom and deliberately ignores the modified ones, so
    // these three take nothing away from it.
    let zoom = Submenu::new(handle, "Zoom", true)?;
    for (label, arg, accel) in [
        ("Zoom In", "1", "CmdOrCtrl+="),
        ("Zoom Out", "-1", "CmdOrCtrl+-"),
        ("Actual Size", "0", "CmdOrCtrl+0"),
    ] {
        zoom.append(&MenuItem::with_id(
            handle,
            format!("{ZOOM_PREFIX}{arg}"),
            label,
            true,
            Some(accel),
        )?)?;
    }

    // Appearance - radio over the three themes, checked from the pushed state.
    let appearance = Submenu::new(handle, "Appearance", true)?;
    for (label, value) in [("Light", "light"), ("Dark", "dark"), ("Brand", "brand")] {
        appearance.append(&CheckMenuItem::with_id(
            handle,
            format!("{THEME_PREFIX}{value}"),
            label,
            true,
            data.theme == value,
            None::<&str>,
        )?)?;
    }

    // Help - the first-timer path. A submenu titled "Help" becomes THE macOS
    // Help menu, searchable and last, exactly where people look first.
    let help = Submenu::new(handle, "Help", true)?;
    help.append(&route_item(handle, "Quickstart", "#/docs/quickstart", None)?)?;
    help.append(&route_item(handle, "Documentation", "#/docs/index", None)?)?;
    help.append(&route_item(handle, "Ask Lolly", "#/ask", None)?)?;
    help.append(&PredefinedMenuItem::separator(handle)?)?;
    // Updates are a route, not a command (plans/202 WP4.1). The row lives in
    // Profile under "Lolly instance" - the card that already answers "what is
    // this install" - so this opens that card and asks it to check straight away.
    // `check=updates` is read by mountProfile; a build with no updater global
    // shows no row and the deep link just opens the card.
    help.append(&route_item(
        handle,
        "Check for Updates",
        "#/profile?focus=instance-section&check=updates",
        None,
    )?)?;
    // "About Lolly" opens the docs site rather than a version dialog. Tauri's
    // `Menu::default()` puts a PredefinedMenuItem::about - a GTK/Windows dialog
    // listing version and copyright - in ITS OWN "Help" submenu on non-macOS, which
    // both duplicated the Help menu and sent the most-clicked first-run item to a
    // dead end. The default Help submenu is dropped below; this replaces its one
    // item with `#/docs/index` - the /info docs home, rehosted in-app.
    #[cfg(not(target_os = "macos"))]
    {
        help.append(&PredefinedMenuItem::separator(handle)?)?;
        help.append(&route_item(handle, "About Lolly", "#/docs/index", None)?)?;
    }

    // File - Open... everywhere (the dialog plugin is cross-platform); Open
    // Recent on macOS, where AppKit keeps the list Finder and the Dock share.
    let open_item = MenuItem::with_id(handle, OPEN_ID, "Open\u{2026}", true, Some("CmdOrCtrl+O"))?;
    let recent_menu = recent_submenu(handle)?;

    // Placement: Go after View (classic macOS order), Tools after Go, the
    // Appearance submenu inside View when it exists, Open Exports Folder in
    // Window (pre-existing behaviour), Help at the end.
    let open_exports =
        MenuItem::with_id(handle, "open_exports", "Open Exports Folder", true, None::<&str>)?;
    let mut go_pos = None;
    let mut exports_placed = false;
    let mut file_placed = false;
    // Deferred so the removal cannot shift the indices `go_pos` is measured in.
    let mut default_help = None;
    if let Ok(items) = menu.items() {
        for (i, item) in items.iter().enumerate() {
            let Some(sub) = item.as_submenu() else { continue };
            match sub.text().ok().as_deref() {
                Some("File") => {
                    let _ = sub.insert(&open_item, 0);
                    let mut next = 1;
                    if let Some(recent) = &recent_menu {
                        let _ = sub.insert(recent, next);
                        next += 1;
                    }
                    let _ = sub.insert(&PredefinedMenuItem::separator(handle)?, next);
                    file_placed = true;
                }
                Some("View") => {
                    go_pos = Some(i + 1);
                    let _ = sub.append(&PredefinedMenuItem::separator(handle)?);
                    let _ = sub.append(&zoom);
                    let _ = sub.append(&appearance);
                }
                Some("Window") => {
                    let _ = sub.append(&open_exports);
                    exports_placed = true;
                }
                // Mark the default Help submenu for removal so ours is the only
                // one. On non-macOS it holds a single PredefinedMenuItem::about
                // dialog, which `help` above replaces with a route to the docs; on
                // macOS it is empty and the About stays in the app submenu.
                Some("Help") => default_help = Some(item.clone()),
                _ => {}
            }
        }
    }
    match go_pos {
        Some(pos) => {
            menu.insert(&go, pos)?;
            menu.insert(&tools, pos + 1)?;
        }
        None => {
            // No View submenu on this platform: everything top-level, still works.
            menu.append(&go)?;
            menu.append(&tools)?;
            menu.append(&Submenu::with_items(handle, "View", true, &[&zoom, &appearance])?)?;
        }
    }
    if !file_placed {
        let file = Submenu::with_items(handle, "File", true, &[&open_item])?;
        if let Some(recent) = &recent_menu {
            file.append(recent)?;
        }
        menu.insert(&file, 1)?;
    }
    if !exports_placed {
        menu.append(&Submenu::with_items(handle, "Exports", true, &[&open_exports])?)?;
    }
    // After the inserts above, so removing it cannot move `go_pos`.
    if let Some(item) = default_help {
        let _ = menu.remove(&item);
    }
    menu.append(&help)?;

    Ok(menu)
}

/// File > Open Recent, built from AppKit's list on every rebuild. None where
/// there is no such list (every platform but macOS).
fn recent_submenu(handle: &AppHandle) -> tauri::Result<Option<Submenu<tauri::Wry>>> {
    if !cfg!(target_os = "macos") {
        return Ok(None);
    }
    let paths: Vec<PathBuf> = native_frame::recent_documents().into_iter().take(RECENT_MAX).collect();
    let recent = Submenu::new(handle, "Open Recent", true)?;
    for (i, label) in recent_labels(&paths).iter().enumerate() {
        recent.append(&MenuItem::with_id(handle, format!("{RECENT_PREFIX}{i}"), label, true, None::<&str>)?)?;
    }
    if !paths.is_empty() {
        recent.append(&PredefinedMenuItem::separator(handle)?)?;
    }
    recent.append(&MenuItem::with_id(handle, RECENT_CLEAR, "Clear Menu", !paths.is_empty(), None::<&str>)?)?;
    if let Ok(mut snapshot) = RECENT.lock() {
        *snapshot = paths;
    }
    Ok(Some(recent))
}

/// Rebuild the menu from the last pushed data (a recent document arrived, or
/// Open Recent was cleared). Main thread.
pub fn rebuild(app: &AppHandle) {
    let data = LAST.lock().ok().and_then(|d| d.clone()).unwrap_or_default();
    if let Ok(menu) = build_menu(app, &data) {
        let _ = app.set_menu(menu);
    }
}

/// Navigate the main window to an in-app hash route through `__lollyMenu`.
pub fn open_route(app: &AppHandle, hash: &str) {
    let js = format!(
        "window.__lollyMenu&&window.__lollyMenu.open({})",
        serde_json::to_string(hash).unwrap_or_default()
    );
    if let Some(window) = app.webview_windows().values().next() {
        let _ = window.eval(&js);
    }
}

/// Route a menu click back into the webview's `__lollyMenu` surface.
pub fn handle_event(app: &AppHandle, event: &MenuEvent) {
    let id = event.id().0.as_str();
    if id == "open_exports" {
        open_exports_folder(app);
        return;
    }
    if id == OPEN_ID {
        native_frame::open_panel(app);
        return;
    }
    if id == RECENT_CLEAR {
        native_frame::clear_recent_documents();
        rebuild(app);
        return;
    }
    if let Some(index) = id.strip_prefix(RECENT_PREFIX) {
        let path = index
            .parse::<usize>()
            .ok()
            .and_then(|i| RECENT.lock().ok().and_then(|r| r.get(i).cloned()));
        if let Some(path) = path.filter(|p| p.is_file()) {
            crate::desktop_integration::deliver_open_file(app, path);
            crate::desktop_integration::focus_main(app);
        }
        return;
    }
    let js = if let Some(hash) = id.strip_prefix(ROUTE_PREFIX) {
        format!(
            "window.__lollyMenu&&window.__lollyMenu.open({})",
            serde_json::to_string(hash).unwrap_or_default()
        )
    } else if let Some(theme) = id.strip_prefix(THEME_PREFIX) {
        format!(
            "window.__lollyMenu&&window.__lollyMenu.setTheme({})",
            serde_json::to_string(theme).unwrap_or_default()
        )
    } else if let Some(step) = id.strip_prefix(ZOOM_PREFIX) {
        // The id is our own literal ("1" / "-1" / "0"), parsed here so a
        // malformed one is dropped rather than eval'd.
        match step.parse::<i32>() {
            Ok(n) => format!("window.__lollyZoom&&window.__lollyZoom.step({n})"),
            Err(_) => return,
        }
    } else {
        return;
    };
    if let Some(window) = app.webview_windows().values().next() {
        let _ = window.eval(&js);
    }
}

/// Frontend push (lib/app-menu.ts): rebuild the menu with fresh dynamic data.
#[tauri::command]
pub fn set_menu_data(app: AppHandle, data: MenuData) -> Result<(), String> {
    // The Dock icon's menu mirrors the Tools menu, plus Open... (plans/321 M1).
    let mut dock: Vec<(String, DockAction)> = data
        .tools
        .iter()
        .map(|t| (t.name.clone(), DockAction::Route(format!("#/tool/{}", t.id))))
        .collect();
    dock.push(("Open\u{2026}".into(), DockAction::Open));
    native_frame::set_dock_items(dock);
    if let Ok(mut last) = LAST.lock() {
        *last = Some(data.clone());
    }
    let menu = build_menu(&app, &data).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

/// Reveal the exports folder in the OS file manager. Exports save to
/// `~/Downloads/Lolly` (bridge-overrides/export.ts `saveToDownloads`); create it
/// if the user has not exported anything yet, then open it. Best-effort - a
/// menu click never errors.
fn open_exports_folder(app: &AppHandle) {
    let Ok(downloads) = app.path().download_dir() else {
        return;
    };
    let dir = downloads.join("Lolly");
    let _ = std::fs::create_dir_all(&dir);
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&dir).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(&dir).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(&dir).spawn();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recent_labels_add_the_folder_only_when_two_names_collide() {
        let paths = [
            PathBuf::from("/Users/a/Work/Poster.lolly"),
            PathBuf::from("/Users/a/Home/Poster.lolly"),
            PathBuf::from("/Users/a/Work/Card.lolly"),
        ];
        assert_eq!(
            recent_labels(&paths),
            ["Poster.lolly (Work)", "Poster.lolly (Home)", "Card.lolly"]
        );
    }
}
