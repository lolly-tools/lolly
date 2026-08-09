/**
 * Lolly URL Screenshot — MAIN-world flag.
 *
 * Runs in the page's own JS world at document_start, so the web app can detect the
 * extension SYNCHRONOUSLY at boot (`window.__lollyCapture`) — no async ping, no
 * startup delay. Actual capture messaging goes through window.postMessage, handled
 * by the isolated content script (content.js).
 *
 * `siteProtocol` is a separate, versioned announcement for the `lolly-capture/site`
 * read: an older installed extension answers screenshots but not site reads, so the
 * app must be able to tell the two apart without a probe. Bump it when the site
 * request or reply shape changes; absent means "this extension cannot read sites".
 */
window.__lollyCapture = { version: '0.2.1', siteProtocol: 1 };
