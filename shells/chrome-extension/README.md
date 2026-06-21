# Lolly URL Screenshot — Chrome extension

Lets the **Lolly web app** screenshot any URL from inside a Chromium browser
(Chrome, Edge, Brave, Arc, Opera). The page itself can't read pixels from a
cross-origin URL; this extension can, by driving the **DevTools Protocol**
(`chrome.debugger` → `Page.captureScreenshot`) — the exact capture the desktop
app does natively (`shells/tauri-desktop/src-tauri/src/capture.rs`).

## How it fits

- `inpage.js` (MAIN world, `document_start`) sets `window.__lollyCapture` so the
  web bridge detects the extension synchronously and adds the `capture` capability
  (which un-greys URL Screenshot).
- `content.js` (isolated world) relays capture requests page ⇄ background via
  `window.postMessage` / `chrome.runtime`.
- `background.js` opens the target URL in a background tab, attaches the debugger,
  sets viewport + DPR, injects custom CSS, scrolls, captures, then cleans up.

The web bridge talks to it in `shells/web/src/bridge/capture-extension.js`.

## Load it (development)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder (`shells/chrome-extension`).
3. Open the Lolly web app (`http://localhost:5173`) → URL Screenshot now works in
   the browser. (Reload the app after installing.)

## Before publishing

- For the store build, drop `http://localhost:5173/*` from `content_scripts[].matches`
  and keep only your real origins (`lolly.tools`). It's kept here for load-unpacked
  dev; reviewers may question a localhost match in a published item.
- Icons (`icons/icon-{16,48,128}.png`) are generated from `/icon-normal.webp`
  (repo root) — regenerate with: `magick icon-normal.webp -resize 128x128 icons/icon-128.png` (etc).
- The `debugger` permission shows a "Lolly URL Screenshot started debugging this
  browser" banner on the temporary capture tab while a shot is taken — expected,
  and a point reviewers scrutinise. Justify it as: captures a user-specified page
  via the DevTools Protocol; no data collected.
- A privacy policy + single-purpose statement are required in the dashboard.
- Publish to the Chrome Web Store, then point `CAPTURE_EXTENSION_URL`
  (`shells/web/src/capabilities.js`) at the listing — or keep it on
  `/info/extension.html` and add an "Add to Chrome" button there (`docs/extension.md`).
