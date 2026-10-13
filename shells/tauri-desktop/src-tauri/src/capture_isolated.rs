// SPDX-License-Identifier: MPL-2.0
use std::ffi::OsString;
use std::io::Write;
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD, Engine};
use headless_chrome::browser::tab::RequestPausedDecision;
use headless_chrome::protocol::cdp::{
    types::Event, Browser as BrowserProtocol, Fetch, Network, Page, Target,
};
use headless_chrome::{Browser, Tab};
use serde_json::json;

use crate::public_network::{capture_read, public_http_url, PublicResponse};

const CAPTURE_TIMEOUT: Duration = Duration::from_secs(45);
const MAX_REQUESTS: usize = 96;
const MAX_TOTAL_BYTES: usize = 32 * 1024 * 1024;
static CAPTURE_BUSY: AtomicBool = AtomicBool::new(false);

pub(crate) const ISOLATED_PAGE_GUARD: &str = r#"(() => {
  const notify = globalThis.__lollyCaptureUnsupported;
  let used = false;
  const deny = function() { used = true; try { notify('unsupported'); } catch {} throw new Error('This API is unavailable in an isolated public capture.'); };
  Object.defineProperty(globalThis, '__lollyCaptureUnsupportedUsed', { get: () => used, configurable: false });
  for (const key of ['Worker', 'SharedWorker', 'WebSocket', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'open']) {
    Object.defineProperty(globalThis, key, { value: deny, writable: false, configurable: false });
  }
  for (const key of ['serviceWorker', 'usb', 'bluetooth', 'hid', 'serial']) {
    Object.defineProperty(navigator, key, { get: deny, configurable: false });
  }
})()"#;

pub(crate) struct BusyGuard;
impl BusyGuard {
    pub(crate) fn enter() -> Result<Self, String> {
        CAPTURE_BUSY
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                "Another isolated page capture is running. Try again after it finishes.".to_string()
            })?;
        Ok(Self)
    }
}
impl Drop for BusyGuard {
    fn drop(&mut self) {
        CAPTURE_BUSY.store(false, Ordering::Release);
    }
}

#[derive(Default)]
struct Budget {
    requests: usize,
    bytes: usize,
    refusal: Option<String>,
}
impl Budget {
    fn check(&self) -> Result<(), String> {
        self.refusal.clone().map_or(Ok(()), Err)
    }
    fn fail(&mut self, error: String) {
        if self.refusal.is_none() {
            self.refusal = Some(error);
        }
    }
    fn request(&mut self) -> Result<(), String> {
        self.check()?;
        self.requests += 1;
        if self.requests > MAX_REQUESTS {
            return Err("The isolated page requested too many resources.".into());
        }
        Ok(())
    }
    fn response(&mut self, bytes: usize) -> Result<(), String> {
        self.bytes = self.bytes.saturating_add(bytes);
        if self.bytes > MAX_TOTAL_BYTES {
            return Err("The isolated page exceeds its resource budget.".into());
        }
        self.check()
    }
}

struct RejectProxy {
    address: String,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    #[cfg(test)]
    refused: Arc<AtomicBool>,
}
impl RejectProxy {
    fn start() -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|_| "The isolated capture network guard could not start.".to_string())?;
        let address = listener
            .local_addr()
            .map_err(|_| "The isolated capture network guard could not start.".to_string())?
            .to_string();
        listener
            .set_nonblocking(true)
            .map_err(|_| "The isolated capture network guard could not start.".to_string())?;
        let stop = Arc::new(AtomicBool::new(false));
        let ended = Arc::clone(&stop);
        let refused = Arc::new(AtomicBool::new(false));
        let did_refuse = Arc::clone(&refused);
        let thread = std::thread::spawn(move || {
            while !ended.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok((mut socket, _)) => {
                        did_refuse.store(true, Ordering::Release);
                        let _ = socket.set_write_timeout(Some(Duration::from_millis(100)));
                        let _ = socket.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                    }
                    Err(_) => std::thread::sleep(Duration::from_millis(5)),
                }
            }
        });
        Ok(Self {
            address,
            stop,
            thread: Some(thread),
            #[cfg(test)]
            refused,
        })
    }
}
impl Drop for RejectProxy {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn stop_process(process: &Arc<Mutex<Child>>) {
    if let Ok(mut process) = process.lock() {
        if matches!(process.try_wait(), Ok(None)) {
            let _ = process.kill();
        }
        let _ = process.wait();
    }
}

struct OwnedChrome {
    process: Arc<Mutex<Child>>,
    cancel: mpsc::Sender<()>,
    deadline: Option<JoinHandle<()>>,
}
impl Drop for OwnedChrome {
    fn drop(&mut self) {
        let _ = self.cancel.send(());
        if let Some(thread) = self.deadline.take() {
            let _ = thread.join();
        }
        stop_process(&self.process);
    }
}

fn launch_browser(
    profile: &std::path::Path,
    proxy: &RejectProxy,
    width: u32,
    height: u32,
    budget: Arc<Mutex<Budget>>,
) -> Result<(OwnedChrome, Browser), String> {
    let executable = headless_chrome::browser::default_executable()
        .map_err(|e| format!("Isolated capture needs Chrome or Chromium: {e}"))?;
    let args: Vec<OsString> = [
        "--headless=new",
        "--remote-debugging-port=0",
        "--remote-debugging-address=127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-sync",
        "--block-new-web-contents",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-quic",
        "--proxy-bypass-list=<-loopback>",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--disable-features=WebTransport,WebUSB,WebBluetooth,WebHID,WebSerial",
    ]
    .iter()
    .map(OsString::from)
    .chain([
        OsString::from(format!("--user-data-dir={}", profile.display())),
        OsString::from(format!("--proxy-server=http://{}", proxy.address)),
        OsString::from(format!("--window-size={width},{height}")),
        OsString::from("about:blank"),
    ])
    .collect();
    let child = Command::new(executable)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "The isolated capture browser could not start.".to_string())?;
    let process = Arc::new(Mutex::new(child));
    let timer_process = Arc::clone(&process);
    let (cancel, receiver) = mpsc::channel();
    let deadline = std::thread::spawn(move || {
        if receiver.recv_timeout(CAPTURE_TIMEOUT).is_err() {
            budget
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .fail("The isolated capture timed out.".into());
            stop_process(&timer_process);
        }
    });
    let owner = OwnedChrome {
        process,
        cancel,
        deadline: Some(deadline),
    };
    let started = Instant::now();
    loop {
        if started.elapsed() > Duration::from_secs(12) {
            return Err("The isolated capture browser did not become ready.".into());
        }
        if owner
            .process
            .lock()
            .map_err(|_| "The isolated capture browser stopped.".to_string())?
            .try_wait()
            .map_err(|_| "The isolated capture browser stopped.".to_string())?
            .is_some()
        {
            return Err("The isolated capture browser stopped.".into());
        }
        if let Ok(port_file) = std::fs::read_to_string(profile.join("DevToolsActivePort")) {
            let mut lines = port_file.lines();
            if let (Some(port), Some(path)) = (
                lines.next().and_then(|p| p.parse::<u16>().ok()),
                lines.next(),
            ) {
                if path.starts_with("/devtools/browser/") {
                    let browser = Browser::connect_with_timeout(
                        format!("ws://127.0.0.1:{port}{path}"),
                        Duration::from_secs(12),
                    )
                    .map_err(|_| "The isolated capture browser connection failed.".to_string())?;
                    return Ok((owner, browser));
                }
            }
        }
        std::thread::sleep(Duration::from_millis(25));
    }
}

type Reader = dyn Fn(&str, &str) -> Result<PublicResponse, String> + Send + Sync;

fn with_reserved_reader<T>(
    raw: &str,
    width: u32,
    height: u32,
    reader: Arc<Reader>,
    _slot: BusyGuard,
    work: impl FnOnce(&Tab) -> Result<T, String>,
) -> Result<T, String> {
    public_http_url(raw)?;
    let profile = tempfile::Builder::new()
        .prefix("lolly-public-capture-")
        .tempdir()
        .map_err(|_| "The isolated capture profile could not be created.".to_string())?;
    let budget = Arc::new(Mutex::new(Budget::default()));
    let proxy = RejectProxy::start()?;
    let (_owner, browser) =
        launch_browser(profile.path(), &proxy, width, height, Arc::clone(&budget))?;
    let tab = browser
        .new_tab()
        .map_err(|_| "The isolated capture tab could not be created.".to_string())?;
    tab.set_default_timeout(Duration::from_secs(12));
    let child_budget = Arc::clone(&budget);
    let child_tab = Arc::downgrade(&tab);
    tab.add_event_listener(Arc::new(move |event: &Event| {
        if let Event::PageFrameAttached(_) = event {
            child_budget.lock().unwrap_or_else(|p| p.into_inner()).fail(
                "This page needs a browsing context unavailable in isolated public capture.".into(),
            );
        }
        if let Event::NetworkLoadingFailed(_) = event {
            child_budget
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .fail("The isolated page could not load a required resource.".into());
        }
        if let Event::AttachedToTarget(event) = event {
            child_budget.lock().unwrap_or_else(|p| p.into_inner()).fail(
                "This page needs a browsing context unavailable in isolated public capture.".into(),
            );
            if let Some(tab) = child_tab.upgrade() {
                let _ = tab.call_method(Target::CloseTarget {
                    target_id: event.params.target_info.target_id.clone(),
                });
            }
        }
    }))
    .map_err(|_| "The isolated browsing-context guard could not be installed.".to_string())?;
    tab.call_method(
        serde_json::from_value::<Network::Enable>(json!({}))
            .map_err(|_| "The isolated resource guard could not be installed.".to_string())?,
    )
    .map_err(|_| "The isolated resource guard could not be installed.".to_string())?;
    tab.call_method(
        serde_json::from_value::<Target::SetAutoAttach>(
            json!({ "autoAttach": true, "waitForDebuggerOnStart": true, "flatten": true }),
        )
        .map_err(|_| "The isolated browsing-context guard could not be installed.".to_string())?,
    )
    .map_err(|_| "The isolated browsing-context guard could not be installed.".to_string())?;
    tab.call_method(
        serde_json::from_value::<BrowserProtocol::SetDownloadBehavior>(
            json!({ "behavior": "deny" }),
        )
        .map_err(|_| "The isolated download guard could not be installed.".to_string())?,
    )
    .map_err(|_| "The isolated download guard could not be installed.".to_string())?;
    let intercept_budget = Arc::clone(&budget);
    tab.enable_request_interception(Arc::new(
        move |_transport, _session, event: Fetch::events::RequestPausedEvent| {
            let request_id = event.params.request_id.clone();
            let result = (|| {
                intercept_budget
                    .lock()
                    .unwrap_or_else(|p| p.into_inner())
                    .request()?;
                public_http_url(&event.params.request.url)?;
                let response = reader(&event.params.request.url, &event.params.request.method)?;
                intercept_budget
                    .lock()
                    .unwrap_or_else(|p| p.into_inner())
                    .response(response.body.len())?;
                let headers: Vec<_> = response
                    .headers
                    .iter()
                    .map(|(name, value)| json!({ "name": name, "value": value }))
                    .collect();
                serde_json::from_value::<Fetch::FulfillRequest>(json!({
                    "requestId": request_id, "responseCode": response.status,
                    "responseHeaders": headers, "body": STANDARD.encode(response.body),
                }))
                .map_err(|_| "The isolated page response could not be delivered.".to_string())
            })();
            match result {
                Ok(response) => RequestPausedDecision::Fulfill(response),
                Err(error) => {
                    intercept_budget
                        .lock()
                        .unwrap_or_else(|p| p.into_inner())
                        .fail(error);
                    RequestPausedDecision::Fail(
                        serde_json::from_value(
                            json!({ "requestId": request_id, "errorReason": "BlockedByClient" }),
                        )
                        .expect("fixed request refusal"),
                    )
                }
            }
        },
    ))
    .map_err(|_| "The isolated page reader could not be installed.".to_string())?;
    tab.enable_fetch(None, Some(false))
        .map_err(|_| "The isolated page reader could not be enabled.".to_string())?;
    let unsupported_budget = Arc::clone(&budget);
    tab.expose_function(
        "__lollyCaptureUnsupported",
        Arc::new(move |_data: serde_json::Value| {
            unsupported_budget
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .fail(
                    "This page uses a network API unavailable in isolated public capture.".into(),
                );
        }),
    )
    .map_err(|_| "The isolated page API guard could not be installed.".to_string())?;
    tab.call_method(
        serde_json::from_value::<Page::AddScriptToEvaluateOnNewDocument>(
            json!({ "source": ISOLATED_PAGE_GUARD }),
        )
        .map_err(|_| "The isolated page API guard could not be installed.".to_string())?,
    )
    .map_err(|_| "The isolated page API guard could not be installed.".to_string())?;
    tab.call_method(serde_json::from_value::<Network::SetBlockedURLs>(json!({ "urls": ["file://*", "ftp://*", "ws://*", "wss://*", "chrome://*", "chrome-extension://*", "devtools://*"] })).map_err(|_| "The isolated page protocol guard could not be installed.".to_string())?)
        .map_err(|_| "The isolated page protocol guard could not be installed.".to_string())?;
    let result = work(&tab);
    budget.lock().unwrap_or_else(|p| p.into_inner()).check()?;
    if tab
        .evaluate("globalThis.__lollyCaptureUnsupportedUsed === true", false)
        .map_err(|_| "The isolated page could not be checked.".to_string())?
        .value
        == Some(serde_json::Value::Bool(true))
    {
        return Err("This page uses a network API unavailable in isolated public capture.".into());
    }
    public_http_url(&tab.get_url())?;
    result
}

pub(crate) fn with_isolated_tab<T>(
    raw: &str,
    width: u32,
    height: u32,
    slot: BusyGuard,
    work: impl FnOnce(&Tab) -> Result<T, String>,
) -> Result<T, String> {
    struct ReaderRuntime(Option<tokio::runtime::Runtime>);
    impl Drop for ReaderRuntime {
        fn drop(&mut self) {
            if let Some(runtime) = self.0.take() {
                runtime.shutdown_background();
            }
        }
    }
    let runtime = ReaderRuntime(Some(
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .max_blocking_threads(2)
            .enable_all()
            .build()
            .map_err(|_| "The isolated page reader could not start.".to_string())?,
    ));
    let reader = Arc::new(move |url: &str, method: &str| {
        runtime
            .0
            .as_ref()
            .expect("active page reader")
            .block_on(capture_read(url, method))
    });
    with_reserved_reader(raw, width, height, reader, slot, work)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_reader<T>(
        raw: &str,
        width: u32,
        height: u32,
        reader: Arc<Reader>,
        work: impl FnOnce(&Tab) -> Result<T, String>,
    ) -> Result<T, String> {
        with_reserved_reader(raw, width, height, reader, BusyGuard::enter()?, work)
    }

    #[test]
    fn one_capture_slot_is_released_on_drop() {
        let slot = BusyGuard::enter().unwrap();
        assert!(BusyGuard::enter().is_err());
        drop(slot);
        assert!(BusyGuard::enter().is_ok());
    }

    #[test]
    fn request_and_byte_budgets_refuse_excess() {
        let mut budget = Budget::default();
        for _ in 0..MAX_REQUESTS {
            budget.request().unwrap();
        }
        assert!(budget.request().is_err());
        assert!(Budget::default().response(MAX_TOTAL_BYTES + 1).is_err());
    }

    fn fixture(body: &'static str) -> Arc<Reader> {
        Arc::new(move |_url, _method| {
            Ok(PublicResponse {
                status: 200,
                headers: vec![("content-type".into(), "text/html".into())],
                body: body.as_bytes().to_vec(),
            })
        })
    }

    fn navigate(tab: &Tab) -> Result<(), String> {
        tab.navigate_to("https://capture.example.test/page")
            .map_err(|e| e.to_string())?;
        tab.wait_until_navigated().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[test]
    #[ignore = "requires a local Chrome installation; run with CHROME set and one test thread"]
    fn native_capture_has_a_fresh_cookie_jar_for_every_reading() {
        for pass in 0..2 {
            with_reader(
                "https://capture.example.test/page",
                600,
                400,
                fixture("<title>Fixture page</title><main>Fixture page</main>"),
                |tab| {
                    navigate(tab)?;
                    assert_eq!(
                        tab.evaluate("document.cookie", false).unwrap().value,
                        Some(json!(""))
                    );
                    assert_eq!(
                        tab.evaluate("document.title", false).unwrap().value,
                        Some(json!("Fixture page"))
                    );
                    if pass == 0 {
                        tab.evaluate("document.cookie = 'fixture=1; path=/'", false)
                            .unwrap();
                    }
                    let shot = tab
                        .call_method(
                            serde_json::from_value::<Page::CaptureScreenshot>(
                                json!({ "format": "png" }),
                            )
                            .unwrap(),
                        )
                        .unwrap();
                    assert!(shot.data.len() > 100);
                    let pdf = tab.call_method(Page::PrintToPDF::default()).unwrap();
                    assert!(pdf.data.starts_with("JVBER"));
                    Ok(())
                },
            )
            .unwrap();
        }
    }

    #[test]
    #[ignore = "requires a local Chrome installation; run with CHROME set and one test thread"]
    fn native_redirect_and_subresource_refusals_never_open_the_local_fixture() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let target = format!("http://{}/fixture", listener.local_addr().unwrap());
        for redirect in [true, false] {
            let address = target.clone();
            let reader: Arc<Reader> = Arc::new(move |_url, _method| {
                if redirect {
                    Ok(PublicResponse {
                        status: 302,
                        headers: vec![("location".into(), address.clone())],
                        body: Vec::new(),
                    })
                } else {
                    Ok(PublicResponse {
                        status: 200,
                        headers: vec![("content-type".into(), "text/html".into())],
                        body: format!("<title>Fixture</title><img src='{address}'>").into_bytes(),
                    })
                }
            });
            assert!(with_reader(
                "https://capture.example.test/page",
                600,
                400,
                reader,
                |tab| {
                    navigate(tab)?;
                    Ok(())
                }
            )
            .is_err());
            assert!(
                matches!(listener.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
            );
        }
    }

    #[test]
    #[ignore = "requires a local Chrome installation; run with CHROME set and one test thread"]
    fn native_unsupported_sockets_workers_and_popups_fail_clearly() {
        for expression in [
            "new Worker('fixture.js')",
            "new SharedWorker('fixture.js')",
            "new WebSocket('wss://capture.example.test/socket')",
            "new WebTransport('https://capture.example.test/transport')",
            "new RTCPeerConnection()",
            "navigator.serviceWorker",
            "window.open('https://capture.example.test/another')",
            "(()=>{const frame=document.createElement('iframe');document.body.append(frame);new frame.contentWindow.Worker('fixture.js');})()",
            "(()=>{const frame=document.createElement('iframe');document.body.append(frame);new frame.contentWindow.RTCPeerConnection();})()",
        ] {
            let outcome = with_reader(
                "https://capture.example.test/page",
                600,
                400,
                fixture("<title>Fixture</title><main>Fixture</main>"),
                |tab| {
                    navigate(tab)?;
                    let js = format!("try {{ {expression}; }} catch {{}};");
                    tab.evaluate(&js, false).map_err(|e| e.to_string())?;
                    Ok(())
                },
            );
            assert!(outcome.is_err(), "{expression}");
        }
    }

    #[test]
    #[ignore = "requires a local Chrome installation; run with CHROME set and one test thread"]
    fn native_cross_process_frame_is_paused_and_refused() {
        let reader: Arc<Reader> = Arc::new(|url, _| {
            let html = if url.starts_with("https://capture.example.test/") {
                "<title>Fixture</title><iframe src='https://frame.other.test/fixture'></iframe>"
            } else {
                "<title>Frame fixture</title>"
            };
            Ok(PublicResponse {
                status: 200,
                headers: vec![("content-type".into(), "text/html".into())],
                body: html.as_bytes().to_vec(),
            })
        });
        let outcome = with_reader(
            "https://capture.example.test/page",
            600,
            400,
            reader,
            |tab| {
                navigate(tab)?;
                std::thread::sleep(Duration::from_millis(200));
                Ok(())
            },
        );
        assert!(outcome.unwrap_err().contains("browsing context"));
    }

    #[test]
    #[ignore = "requires a local Chrome installation; run with CHROME set and one test thread"]
    fn native_browser_transport_refuses_unhandled_loopback_reads() {
        let _busy = BusyGuard::enter().unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let profile = tempfile::tempdir().unwrap();
        let budget = Arc::new(Mutex::new(Budget::default()));
        let proxy = RejectProxy::start().unwrap();
        let (_owner, browser) =
            launch_browser(profile.path(), &proxy, 600, 400, Arc::clone(&budget)).unwrap();
        let tab = browser.new_tab().unwrap();
        let navigation = tab
            .navigate_to(&format!(
                "http://{}/fixture",
                listener.local_addr().unwrap()
            ))
            .map(|_| ());
        let loaded = tab.wait_until_navigated().map(|_| ());
        std::thread::sleep(Duration::from_millis(200));
        assert!(
            navigation.is_err(),
            "loaded={loaded:?}; current={}",
            tab.get_url()
        );
        assert!(proxy.refused.load(Ordering::Acquire));
        assert!(
            matches!(listener.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
        );
    }

    #[test]
    #[ignore = "requires a local Chrome installation; run with CHROME set and one test thread"]
    fn native_child_realm_transport_attempts_do_not_send_udp_to_the_owned_fixture() {
        let udp = std::net::UdpSocket::bind("127.0.0.1:0").unwrap();
        udp.set_nonblocking(true).unwrap();
        let port = udp.local_addr().unwrap().port();
        let outcome = with_reader(
            "https://capture.example.test/page",
            600,
            400,
            fixture("<title>Fixture</title><main>Fixture</main>"),
            |tab| {
                navigate(tab)?;
                let js = format!("(()=>{{const frame=document.createElement('iframe');document.body.append(frame);const realm=frame.contentWindow;try{{new realm.WebTransport('https://127.0.0.1:{port}/fixture');}}catch{{}}try{{const peer=new realm.RTCPeerConnection({{iceServers:[{{urls:'stun:127.0.0.1:{port}'}}]}});peer.createDataChannel('fixture');peer.createOffer().then(offer=>peer.setLocalDescription(offer)).catch(()=>{{}});}}catch{{}}}})()");
                tab.evaluate(&js, false).map_err(|e| e.to_string())?;
                std::thread::sleep(Duration::from_millis(500));
                Ok(())
            },
        );
        assert!(outcome.unwrap_err().contains("browsing context"));
        assert!(
            matches!(udp.recv_from(&mut [0; 4096]), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
        );
    }
}
