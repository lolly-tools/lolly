# Publishing — Lolly URL Screenshot

Paste-ready copy for the Chrome Web Store dashboard.

**Before zipping:** remove `http://localhost:5173/*` from both `content_scripts[].matches`
in `manifest.json`, keeping only the `lolly.tools` origins. (Localhost is there for
load-unpacked development.)

## Store listing

- **Name:** Lolly URL Screenshot
- **Summary:** Screenshot any web page from the Lolly app, right in your browser.
- **Category:** Developer Tools
- **Description:**

  Lets the Lolly web app (lolly.tools) capture a screenshot of any URL — at the size
  and scroll position you choose, with optional custom CSS — without leaving your
  browser. Captures run locally via the DevTools Protocol; nothing is uploaded.

## Single purpose

Capture a screenshot of a user-specified web page on behalf of the Lolly app.

## Permission justifications

- **debugger** — captures the rendered page via `Page.captureScreenshot` (DevTools Protocol). It's the only way to get an accurate full-page screenshot at a chosen viewport and device-pixel-ratio.
- **tabs** — opens a temporary background tab to load the target URL, then closes it.
- **host_permissions (`<all_urls>`)** — the user supplies the URL to capture, which may be on any site.

## Data use

Does **not** collect or transmit user data. No analytics, no remote servers. (See the privacy policy.)

## Privacy policy URL

`https://lolly.tools/info/privacy.html`

## Dashboard assets

- 128×128 icon — already in the package (`icons/icon-128.png`).
- One 1280×800 screenshot of the tool in action.
