/**
 * Lolly URL Screenshot — MAIN-world flag.
 *
 * Runs in the page's own JS world at document_start, so the web app can detect the
 * extension SYNCHRONOUSLY at boot (`window.__lollyCapture`) — no async ping, no
 * startup delay. Actual capture messaging goes through window.postMessage, handled
 * by the isolated content script (content.js).
 */
window.__lollyCapture = { version: '0.1.0' };
