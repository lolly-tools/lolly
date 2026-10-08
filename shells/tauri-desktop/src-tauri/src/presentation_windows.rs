// SPDX-License-Identifier: MPL-2.0
//! Native window ownership for the shared shell's private presentation controls.
use tauri::{ipc::Invoke, webview::NewWindowResponse, App, Manager, Runtime, WebviewWindowBuilder};

const CONTROLS: &str = "presentation-controls";
const CLOSE: &str = "lolly-presentation://close";
const FOCUS: &str = "lolly-presentation://focus";

fn blank(url: &url::Url) -> bool {
    url.as_str() == "about:blank"
}

/// Delay GUI window construction until the popup handler can be installed.
pub fn prepare(context: &mut tauri::Context) -> Vec<tauri::utils::config::WindowConfig> {
    #[cfg(feature = "presentation-probe")]
    assert_eq!(
        context.config().identifier,
        "tools.lolly.PresentationProbe",
        "Use the separate presentation probe bundle identifier"
    );
    let windows = context.config().app.windows.clone();
    for window in &mut context.config_mut().app.windows {
        window.create = false;
    }
    windows
}

pub fn build(app: &App, windows: &[tauri::utils::config::WindowConfig]) -> tauri::Result<()> {
    for config in windows.iter().filter(|window| window.create) {
        let handle = app.handle().clone();
        let builder = WebviewWindowBuilder::from_config(app, config)?;
        #[cfg(feature = "presentation-probe")]
        let builder = builder.initialization_script(include_str!("../tests/presentation-probe.js"));
        let window = builder
            .on_new_window(move |url, features| {
                #[cfg(feature = "presentation-probe")]
                eprintln!("[presentation-probe] new window: {url}");
                if !blank(&url) || handle.get_webview_window(CONTROLS).is_some() {
                    return NewWindowResponse::Deny;
                }
                #[cfg(target_os = "macos")]
                {
                    let Some(thread) = objc2::MainThreadMarker::new() else {
                        return NewWindowResponse::Deny;
                    };
                    // SAFETY: WKUIDelegate invokes this on the main thread. The supplied
                    // configuration retains its process pool/data store, but must not reuse
                    // the parent's IPC handler or initialization scripts in the child.
                    unsafe {
                        let scripts = objc2_web_kit::WKUserContentController::new(thread);
                        let configuration = &features.opener().target_configuration;
                        configuration.setUserContentController(&scripts);
                    }
                }
                let closer = handle.clone();
                let popup =
                    WebviewWindowBuilder::new(&handle, CONTROLS, tauri::WebviewUrl::External(url))
                        .window_features(features)
                        .title("Presentation")
                        .min_inner_size(360.0, 480.0)
                        .on_navigation(move |url| {
                            if url.as_str() == CLOSE {
                                if let Some(window) = closer.get_webview_window(CONTROLS) {
                                    let _ = window.close();
                                }
                            } else if url.as_str() == FOCUS {
                                if let Some(window) = closer.get_webview_window(CONTROLS) {
                                    let _ = window.unminimize();
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            blank(url)
                        })
                        .on_new_window(|_, _| NewWindowResponse::Deny)
                        .on_document_title_changed(|window, title| {
                            let _ = window.set_title(&title);
                        })
                        // WKWebView's close/focus do not control its Tauri container.
                        // Intercept these private URLs; the child needs no IPC permissions.
                        .initialization_script(format!(
                            "window.close = () => {{ location.href = '{CLOSE}'; }}; \
                             window.focus = () => {{ location.href = '{FOCUS}'; }};"
                        ))
                        .initialization_script(include_str!("presentation_window.js"));
                #[cfg(feature = "presentation-probe")]
                let popup = popup.initialization_script(
                    "Object.defineProperty(navigator, 'mediaDevices', { value: Object.freeze({ \
                     getUserMedia: async () => { throw new Error('The probe camera belongs to the main window'); } \
                     }) });",
                );
                let popup = popup.build();
                match popup {
                    Ok(window) => NewWindowResponse::Create { window },
                    Err(error) => {
                        eprintln!("[presentation] private window could not open: {error}");
                        NewWindowResponse::Deny
                    }
                }
            })
            .build()?;
        let handle = app.handle().clone();
        window.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(controls) = handle.get_webview_window(CONTROLS) {
                    let _ = controls.destroy();
                }
            }
        });
    }
    Ok(())
}

/// Application commands are owned by the main shell. Plugin commands have their own ACL.
pub fn main_commands<R: Runtime>(
    handler: impl Fn(Invoke<R>) -> bool + Send + Sync + 'static,
) -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static {
    move |invoke| {
        if invoke.message.webview_ref().label() != "main" {
            invoke
                .resolver
                .reject("Application commands belong to the main window");
            return true;
        }
        #[cfg(feature = "presentation-probe")]
        if invoke.message.command() == "presentation_probe_report" {
            return crate::presentation_probe::report(invoke);
        }
        #[cfg(feature = "webgpu-probe")]
        if invoke.message.command().starts_with("webgpu_qualification_") {
            return crate::webgpu_qualification::route(invoke);
        }
        handler(invoke)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn popup_navigation_only_accepts_the_empty_private_document() {
        assert!(blank(&url::Url::parse("about:blank").unwrap()));
        for value in [
            "about:blank#other",
            "https://example.com",
            "tauri://localhost/",
            "file:///tmp/page",
            "data:text/html,hello",
            "javascript:alert(1)",
            CLOSE,
            FOCUS,
        ] {
            assert!(!blank(&url::Url::parse(value).unwrap()), "{value}");
        }
    }

    #[test]
    fn private_window_does_not_inherit_main_permissions() {
        let main: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        assert_eq!(main["windows"], serde_json::json!(["main"]));
    }
}
