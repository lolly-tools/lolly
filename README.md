# lolly-chrome-extension

**Lolly URL Screenshot**, a Manifest V3 Chrome extension whose entire purpose is to give the *web* shell the capabilities a browser page cannot have on its own: reading a cross-origin URL. Two readings, one mechanism — a **screenshot** of a page (the `capture` capability), and a **site read** of a page's markup, stylesheets and icons (the `siteIngest` capability behind the Design System studio's website source, plan 97 section 9).

It is the odd one out in `shells/`. It is not a host for the engine, it runs no tools, it renders nothing and it never sees a tool manifest. It is a **capability provider for the web shell**, filling in the same `capture` capability that the Tauri desktop shell fulfils with native headless Chrome. Calling it a shell is a filing convenience.

Own repo `lolly-chrome-extension`, mounted in the umbrella [`lolly`](https://github.com/lolly-tools/lolly) as a git submodule at `shells/chrome-extension/`.

## Contents

Four files, no build step, no `package.json`, no dependencies and no bundler:

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. `minimum_chrome_version` 111. Permissions: `debugger`, `tabs`, `scripting`, `storage` (session-only, for the orphan-tab sweep below). |
| `background.js` | Service worker. Does the actual capture. |
| `content.js` | Isolated-world content script. A message relay. |
| `inpage.js` | MAIN-world content script. Sets one synchronous detection flag. |

Plus `icons/`, `LICENSE` and `PUBLISHING.md`, the paste-ready Chrome Web Store copy.

## Entry points, and how the three scripts fit together

There is no single entry. MV3 gives each script its own, and the interesting part is the path a capture request takes across three JavaScript worlds.

1. **`inpage.js`** runs at `document_start` in the page's **own** JS world and does exactly one thing: `window.__lollyCapture = { version: '0.2.1', siteProtocol: 1 }`. That is the detection flag. It matters that this is synchronous and pre-paint, because the web shell's `bridge/index.ts` reads it with `hasCaptureExtension()` while it is composing `host.capabilities`, and adds `'capture'` to the list when present. An async ping would have forced the bridge to be async about a decision the gallery needs immediately in order to know whether to grey out the URL Screenshot tool. `siteProtocol` is announced separately and read by `hasSiteCapture()`, because an older installed copy of this extension answers screenshots but not site reads, and the studio must decide whether to render the Website source *before* it renders anything — a source a user cannot use is never shown.
2. **`content.js`** runs at `document_start` in the **isolated** world, where the `chrome.*` APIs exist. It is a pure relay: it listens for `window.postMessage` from the page (`source: 'lolly-capture/page'`), forwards a `capture` or `lolly-capture/site` request as `chrome.runtime.sendMessage`, and posts the result back. It also answers a `ping` with a `pong`. Two worlds are needed because the page cannot call `chrome.runtime` and the isolated world cannot set a property the page can read. The site reply is posted back to the requesting origin, not `'*'`: it carries a whole page's markup.
3. **`background.js`** is the service worker that does both readings. Each opens the target URL in an inactive background tab, waits for `status === 'complete'` (or the timeout), and always closes the tab in a `finally`.
   - **The tab close is guarded three ways**, because a `finally` is in-worker state and MV3 evicts an idle service worker. The reading holds a **keep-alive** (a cheap `chrome.runtime` call on a 20 s tick, which resets Chrome's idle clock), the budgets are kept short on purpose (30 s to load, 20 s to read: worst case ~50 s, not 75), and the tab id is written to **session storage** while it exists and swept on the next worker start — a worker start means the worker was not running, so a recorded id at that moment is by definition an orphan. Without that last one, an evicted worker would leave an inactive tab loaded on a third-party origin, in the user's own profile, with nothing on screen to say it was opened.
   - **Screenshot** (`capture`), over the **DevTools Protocol**: `chrome.debugger.attach`, `Page.enable`, `Emulation.setDeviceMetricsOverride` for the requested width, height and device pixel ratio, optionally inject the caller's CSS as an appended `<style>`, optionally scroll (a `0..1` fraction of scrollable height, or a pixel offset above 1), wait out the settle delay, then `Page.captureScreenshot` with `captureBeyondViewport: true`. It returns a base64 PNG data URL and always detaches the debugger.
   - **Site read** (`readSite`), over `chrome.scripting.executeScript`: one serialised collector function (`collectSite`) runs in the tab's isolated world and returns `documentElement.outerHTML`, the text of every stylesheet the markup does not already carry, and the bytes of up to ten icon/logo candidates, all capped by `SITE_CAPS`. Every subresource body is read **as it streams** (`readCapped`: the declared length first, then each chunk, cancelling the socket once it passes the cap), which is what makes those caps a bound on what a hostile page can make this download rather than a measurement taken after it already has. Cross-origin stylesheets throw on `cssRules`, so their `href` is fetched from the page instead. An `options.screenshot` flag adds the PNG as a bonus (the page **as painted** feeds the colour census too), reusing the same DevTools path, so it costs no extra permission and its failure never fails the read.

Both content scripts are matched against three origins only: `http://localhost:5173/*`, `https://lolly.tools/*` and `https://*.lolly.tools/*`.

## How the web shell consumes it

The web shell never learns the extension ID and there is no `externally_connectable` entry. `shells/web/src/bridge/capture-extension.ts` reads the MAIN-world flag synchronously, and when it is set `bridge/index.ts` lazily builds `createExtensionCaptureAPI()` instead of the throwing `capture.ts` stub, and adds `'capture'` to the declared capabilities. Which of the two implementations it will be stays a synchronous decision; only the module import is lazy.

The same module exposes `hasSiteCapture()` and `createExtensionSiteTransport()` for the site read. The deployed web app **cannot** fetch a third-party origin at all — its CSP `connect-src` allowlists six hosts — and Lolly runs no fetching server, by decision. So the Website source in the Design System studio exists only where a transport does: this extension, or the Tauri shells' native fetch. Without one the source tile is not rendered at all. Nothing is read until the user presses the button, one URL at a time, with no crawling.

## Run it

There is nothing to build and nothing to install:

1. `chrome://extensions`, enable Developer mode, **Load unpacked**, choose this directory.
2. Start the web shell with `npm run dev:web` from the umbrella root.
3. The URL Screenshot tool un-greys in the gallery.

`localhost:5173` is in the manifest's match list precisely so that this works. `PUBLISHING.md` reminds you to strip it before zipping for the Web Store.

## Surprising things

- **The submodule boilerplate that used to be in this file was wrong.** It claimed a dependency on `@lolly/engine` and on monorepo-relative paths. This extension has neither. It is four plain `.js` files with no imports at all, it is not an npm workspace, and it is the one directory under `shells/` that would load standalone. It still lives here because it is versioned and released alongside the web shell whose capability it fills.
- **Capturing localhost and private URLs is a feature, not a hole.** The extension runs in the user's own browser, on their own network, at their own request, so `background.js` rejects only non-http(s) schemes. The SSRF concern belongs to a server-side render service, where an attacker could choose the URL, and there is no such service.
- **It needs the `debugger` permission**, which is why it exists as an extension rather than as a content script trick. `Page.captureScreenshot` is the only way to get an accurate full-page shot at a chosen viewport and device pixel ratio. `PUBLISHING.md` carries the justification copy for each permission.
- **The site read asks for `scripting` even though `debugger` is already granted.** `Runtime.evaluate` could have collected the same markup and returned it over CDP, at the cost of zero new permissions. It was not worth it: the collector is an async function that fetches a dozen subresources and returns megabytes of structured data, which `chrome.scripting.executeScript` hands back as a real object, and it runs *only* in the tab this extension opened, for the URL the user typed. `scripting` is also the milder of the two permissions to review and to explain.
- Nothing is uploaded and nothing is collected. Both readings happen locally and the bytes go straight back to the page — a data URL for the screenshot, base64 blobs for the site read's assets.
- The `content.js` relay deliberately tolerates a missing background worker: `chrome.runtime.lastError` is folded into the result posted back to the page, so the web shell surfaces a real error rather than hanging.

## Submodule caveat

Unlike every other directory under `shells/`, this one has no workspace dependency and no build. It is still consumed as a git submodule, so a non-recursive clone of the umbrella leaves it empty:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
# or, in an existing clone:
git submodule update --init --recursive
```

Commit changes to files in this directory in the `lolly-chrome-extension` repo, then commit the moved pointer in the umbrella. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) section 4.
