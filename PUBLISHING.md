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

  Lets the Lolly web app (lolly.tools) read one web page you name, on your command,
  without leaving your browser: a screenshot at the size and scroll position you
  choose (with optional custom CSS), or the page's own markup, stylesheets and icons
  so Lolly can pick up its colours, typefaces and logo. Everything runs locally in
  your browser; nothing is uploaded.

## Single purpose

Take one reading of a web page the user names, on behalf of the Lolly app: a
screenshot of it, or its markup, stylesheets and icon files.

## Permission justifications

- **debugger** — captures the rendered page via `Page.captureScreenshot` (DevTools Protocol). It's the only way to get an accurate full-page screenshot at a chosen viewport and device-pixel-ratio.
- **scripting** — runs one collector function in the temporary background tab to read that page's markup, its stylesheet text and its icon/logo files, which is what Lolly turns into a design system. Nothing is injected into pages the user is browsing: the script runs only in the tab this extension opened, for the URL the user typed, and the tab is closed straight after.
- **tabs** — opens a temporary background tab to load the target URL, then closes it.
- **storage** — remembers the id of that one temporary tab, in session storage only, so it is still closed if Chrome shuts the extension's service worker down mid-reading. Nothing else is stored, and nothing survives the browser session.
- **host_permissions (`<all_urls>`)** — the user supplies the URL to read, which may be on any site.

## Data use

Does **not** collect or transmit user data. No analytics, no remote servers. (See the privacy policy.)

## Privacy policy URL

`https://lolly.tools/info/privacy.html`

## Dashboard assets

- 128×128 icon — already in the package (`icons/icon-128.png`).
- One 1280×800 screenshot of the tool in action.
