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

use serde::Deserialize;
use tauri::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager};

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
    go.append(&route_item(handle, "Catalog", "#/c", None)?)?;
    go.append(&route_item(handle, "Dashboard", "#/d", None)?)?;
    go.append(&route_item(handle, "Batch", "#/batch", None)?)?;
    go.append(&route_item(handle, "Colour Lab", "#/lab", None)?)?;
    go.append(&route_item(handle, "Verify a File", "#/valid", None)?)?;
    go.append(&route_item(handle, "Unpack a PDF", "#/unpack", None)?)?;
    go.append(&PredefinedMenuItem::separator(handle)?)?;
    go.append(&route_item(handle, "Set Up Your Brand", "#/start", Some("CmdOrCtrl+Shift+B"))?)?;
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

    // Placement: Go after View (classic macOS order), Tools after Go, the
    // Appearance submenu inside View when it exists, Open Exports Folder in
    // Window (pre-existing behaviour), Help at the end.
    let open_exports =
        MenuItem::with_id(handle, "open_exports", "Open Exports Folder", true, None::<&str>)?;
    let mut go_pos = None;
    let mut exports_placed = false;
    // Deferred so the removal cannot shift the indices `go_pos` is measured in.
    let mut default_help = None;
    if let Ok(items) = menu.items() {
        for (i, item) in items.iter().enumerate() {
            let Some(sub) = item.as_submenu() else { continue };
            match sub.text().ok().as_deref() {
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

/// Route a menu click back into the webview's `__lollyMenu` surface.
pub fn handle_event(app: &AppHandle, event: &MenuEvent) {
    let id = event.id().0.as_str();
    if id == "open_exports" {
        open_exports_folder(app);
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
