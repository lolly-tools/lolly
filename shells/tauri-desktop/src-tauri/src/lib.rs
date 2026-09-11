mod capture;
mod cli;
mod desktop_integration;
mod menu;
mod native_transport;
mod nearby;
mod oauth;
mod render_server;
mod reword;
mod remote_fetch;
mod root_export;
mod site_fetch;

/// Native entry (called from `main.rs`, and the mobile entry point). Reads argv
/// and dispatches to either the GUI or a headless CLI render.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dispatch(std::env::args().skip(1).collect());
}

/// The single `generate_context!()` site (embedding the frontend assets happens
/// once here). Help/version are answered without ever building the app; GUI and
/// CLI both take the one embedded context.
fn dispatch(args: Vec<String>) {
    let mode = cli::classify(&args);

    // Answer help / version / usage errors without ever building the app.
    match &mode {
        cli::Mode::Help => return cli::print_help(),
        cli::Mode::Version => return cli::print_version(),
        cli::Mode::UsageError(m) => {
            eprintln!("lolly: {m}\n");
            cli::print_help();
            std::process::exit(64); // EX_USAGE
        }
        _ => {}
    }

    // One embed of the frontend assets, taken by whichever of GUI / CLI runs.
    let context = tauri::generate_context!();
    match mode {
        cli::Mode::Cli(job) => cli::run_cli(context, job),
        cli::Mode::Sidecar(args) => cli::run_sidecar(context, args),
        cli::Mode::ExportRoot(dir) => root_export::run_export(&context, dir),
        // The loopback render endpoint (plans/202 WP2.1). Its own builder, because it
        // registers the cli_write/cli_done pair rather than the GUI's command set and
        // never declares a window.
        cli::Mode::RenderServer => render_server::run(context),
        cli::Mode::SearchProvider => run_gui(context, cfg!(target_os = "linux")),
        _ => run_gui(context, false), // Gui (the others already returned above)
    }
}

/// The desktop app proper: host the WebView and fulfil the `capture` capability.
fn run_gui(mut context: tauri::Context, search_provider: bool) {
    // GNOME and KRunner start the provider over D-Bus while the app is closed.
    // They must be able to query the embedded catalogue without flashing a full
    // application window. Keep the ordinary main webview (activation promotes it)
    // but override its initial visibility before Tauri builds it.
    if search_provider {
        for window in &mut context.config_mut().app.windows {
            window.visible = false;
        }
    }
    tauri::Builder::default()
        // Remember only spatial state. VISIBLE is deliberately excluded: a saved
        // visible window must never make a D-Bus --search-provider launch flash.
        // The plugin also rejects a position that intersects no current monitor.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // One running app per user (plans/174): a second launch (file-manager
        // "Open with", a lolly:// click) forwards its argv here and exits; the
        // classifier turns it into openFile/deepLink events the webview polls.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            desktop_integration::classify_argv(app, &argv[1..]);
        }))
        // Makes tauri.conf.json's plugins.deep-link block live: the bundler registers
        // lolly:// from it on macOS/Windows/Linux. Delivery stays on our own queue
        // (classify_argv for argv, classify_opened for macOS Apple Events below).
        .plugin(tauri_plugin_deep_link::init())
        // Self-update (plans/202 WP4.1). The endpoint and the signing public key
        // come from tauri.conf.json's plugins.updater block; the JS side
        // (bridge-overrides/updater.ts) drives check → download → install, and
        // asks before each of the last two. tauri_plugin_process is here only so
        // "Install and restart" can restart.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Finished-job notifications (shells/web/src/lib/job-toast.ts through
        // bridge-overrides/notify.ts). GUI only - a headless `Lolly run` never
        // raises one, so cli.rs does not register this.
        .plugin(tauri_plugin_notification::init())
        .manage(desktop_integration::DesktopEvents::default())
        .manage(desktop_integration::HotFolder::default())
        .manage(desktop_integration::RecentExports::default())
        // The shared authenticated-capture session (persistent Chrome profile + the
        // optional live sign-in browser captures ride). Managed here so both the
        // capture commands and the sign-in/clear commands see the same instance.
        .manage(capture::CaptureSession::default())
        // Loopback OAuth listeners (plans/129 WP4) - the system-browser sign-in
        // return leg for personal send targets. GUI only, like site_fetch.
        .manage(oauth::OauthListeners::default())
        // The full native app menu (menu.rs): Go/Tools/Appearance/Help mirroring
        // the iPad menu bar, plus the pre-existing "Open Exports Folder" in the
        // Window menu. Starts with static content; the frontend's set_menu_data
        // push fills in the dynamic parts (folders, utilities, theme state).
        .menu(|handle| menu::build_menu(handle, &menu::MenuData::default()))
        .on_menu_event(|app, event| menu::handle_event(app, &event))
        .invoke_handler(tauri::generate_handler![
            desktop_integration::desktop_poll_events,
            desktop_integration::desktop_read_file,
            desktop_integration::desktop_pick_color,
            desktop_integration::desktop_set_wallpaper,
            desktop_integration::desktop_set_wallpaper_bytes,
            desktop_integration::desktop_read_accent,
            // desktop_clipboard_read is deliberately absent: the tray calls it
            // directly in Rust and no JS ever did (plans/202 WP4.1).
            desktop_integration::desktop_hotfolder_set,
            desktop_integration::desktop_note_export,
            desktop_integration::desktop_reveal_export,
            menu::set_menu_data,
            capture::capture_page,
            capture::capture_page_pdf,
            // Authenticated capture: open a visible sign-in window on the shared
            // profile, report whether a session is live, and clear it. GUI only -
            // interactive, like site_fetch/nearby; a headless render never signs in.
            capture::capture_signin_open,
            capture::capture_session_active,
            capture::capture_clear_session,
            // Native reword (plans/127): the SmolLM2 sampling loop on native ORT -
            // probe/stage/generate; the JS side owns consent + the engine gate.
            // GUI only, like site_fetch: it is reachable only from the catalog's
            // humanize panel, never from a headless render.
            reword::reword_probe,
            reword::reword_put_file,
            reword::reword_generate,
            // CORS-free remote-instance/provider transport. Unlike the former
            // raw HTTP plugin, this command pins public DNS answers, enforces
            // HTTPS, bounds bytes/headers and rechecks every redirect.
            remote_fetch::remote_fetch,
            // Website source for the Design System studio (plans/97 section 9). GUI
            // only, deliberately: unlike capture, which cli.rs also registers
            // because the url-shot TOOL calls host.capture mid-render, this
            // command is reachable only from a button in the studio. A headless
            // `Lolly run <tool>` render can never invoke it, so registering it
            // there would be dead surface.
            site_fetch::site_fetch,
            // Loopback OAuth (plans/129 WP4): bind an ephemeral 127.0.0.1 port,
            // then hand back the one redirect the system browser delivers. GUI
            // only - sign-in is interactive by definition.
            oauth::oauth_listen,
            oauth::oauth_wait,
            oauth::oauth_open,
            // Nearby discovery (plans/110 section 3). GUI only for the same reason as
            // site_fetch: it is reachable from the collab ceremony / share sheets,
            // never from a headless render, so it stays out of cli.rs's handler.
            nearby::nearby_set_visible,
            nearby::nearby_hide,
            nearby::nearby_browse,
            nearby::nearby_poll,
            nearby::nearby_exchange_invite,
            nearby::nearby_send_reply,
            nearby::nearby_decline,
            // Native LAN socket transport (plans/110 section 4) - GUI only, same reason.
            native_transport::native_connect,
            native_transport::native_send,
            native_transport::native_recv,
            native_transport::native_plate,
            native_transport::native_close,
            native_transport::native_poll_inbound,
            native_transport::native_adopt
        ])
        // Desktop integration boot (plans/174): first-launch argv (a .lolly
        // double-clicked before the app ran, a lolly:// link that launched us),
        // the clipboard-lens tray, and - on Linux - the D-Bus search/automation
        // surfaces. All additive; failures degrade to a plain window, logged.
        .setup(move |app| {
            let handle = app.handle().clone();
            if !search_provider {
                desktop_integration::classify_argv(
                    &handle,
                    &std::env::args().skip(1).collect::<Vec<_>>(),
                );
            }
            #[cfg(target_os = "linux")]
            desktop_integration::dbus::serve(handle);
            // A dev build is not installed, so nothing has told the OS who handles
            // lolly://. Windows and Linux can register at runtime (a user-level
            // registry key / xdg entry); macOS reads only the bundle's plist, which
            // the bundler writes from tauri.conf.json - so `tauri dev` on a Mac
            // cannot receive the scheme, and the installed .app can.
            #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(e) = app.deep_link().register_all() {
                    eprintln!("[desktop] lolly:// not registered for this dev build: {e}");
                }
            }
            Ok(())
        })
        .build(context)
        .expect("error while building Lolly desktop")
        .run(|app, event| {
            // macOS hands URL and file opens to the running process as Apple Events,
            // never as argv, and Tauri surfaces them here as RunEvent::Opened - a
            // lolly:// click, or a .lolly double-clicked in Finder, cold start
            // included. Same queue as argv, so the web side cannot tell the
            // platforms apart.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                desktop_integration::classify_opened(app, urls);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, &event);
        });
}

// ── Updater configuration (plans/202 WP4.1) ──────────────────────────────────
//
// The updater's whole safety story is in tauri.conf.json: where it looks, and
// which public key an artifact must verify against. Neither is exercised by any
// other test, and a wrong endpoint or a bundle that emits no signed artifact
// both fail only at release time, on a user's machine. So pin them here, against
// the real file.
#[cfg(test)]
mod updater_config {
    const CONF: &str = include_str!("../tauri.conf.json");

    /// The value the tree ships with. `release/build-latest-json.ts` refuses to
    /// publish a manifest while this is in place; that is the loud failure, at
    /// the one moment it matters. This test only pins the spelling, so the two
    /// files cannot drift apart silently.
    const PUBKEY_PLACEHOLDER: &str = "PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE";

    fn conf() -> serde_json::Value {
        serde_json::from_str(CONF).expect("tauri.conf.json is valid JSON")
    }

    #[test]
    fn endpoint_is_one_https_url_keyed_by_target_and_arch() {
        let c = conf();
        let endpoints = c["plugins"]["updater"]["endpoints"]
            .as_array()
            .expect("plugins.updater.endpoints");
        assert_eq!(endpoints.len(), 1, "one endpoint, so there is one place to publish");
        let url = endpoints[0].as_str().unwrap();
        assert!(url.starts_with("https://"), "an update endpoint over plain http is not one: {url}");
        // Both placeholders have to be there. Without them every platform reads
        // one manifest and the first non-matching build gets offered the wrong
        // artifact.
        assert!(url.contains("{{target}}"), "endpoint must vary by target: {url}");
        assert!(url.contains("{{arch}}"), "endpoint must vary by arch: {url}");
    }

    #[test]
    fn pubkey_is_present_and_its_placeholder_spelling_is_pinned() {
        let c = conf();
        let key = c["plugins"]["updater"]["pubkey"]
            .as_str()
            .expect("plugins.updater.pubkey");
        assert!(!key.is_empty(), "an empty pubkey disables signature checking");
        if key != PUBKEY_PLACEHOLDER {
            // A real minisign public key is base64 and comfortably longer than
            // the placeholder. This catches a truncated or half-pasted key.
            assert!(
                key.len() >= 40,
                "pubkey is neither the placeholder nor long enough to be a real key"
            );
        }
    }

    #[test]
    fn bundle_emits_updater_artifacts() {
        let c = conf();
        assert_eq!(
            c["bundle"]["createUpdaterArtifacts"].as_bool(),
            Some(true),
            "without this `tauri build` writes no .tar.gz and no .sig, so nothing can be published",
        );
    }
}
