# Browser Extension

The **Lolly URL Screenshot** extension lets the web app screenshot any web page from inside your browser. Without it, capturing a URL needs the desktop app - a browser page can't read pixels from another site on its own. The extension can, using the same capture the desktop app uses.

It does one other job the same way: reading a single page you name so Brand Studio can pull a brand out of a live website. Both are covered below.

It runs on Chromium-based browsers: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 or newer.

Until it is installed, **URL Screenshot** still opens so you can compose a shot, and a note at the top of the tool's controls says what is missing.

![The URL Screenshot tool's note offering the extension, shown when capture to file has no host to run on](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Every control is live while you wait: the target URL, the scroll depth, the settle delay, the crop insets and the recolour. Only the capture itself needs a host.

![The URL Screenshot controls with a target URL, scroll depth, settle delay and crop insets, all usable before the extension exists](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Install

### From the Chrome Web Store

*Coming soon.* Once it's published you'll install it in one click, then reload Lolly.

### Load it yourself (developers)

The extension lives in the repo at `shells/chrome-extension/`.

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and choose the `shells/chrome-extension/` folder.
4. Reload Lolly - **URL Screenshot** now works in the browser.

## How it works

- A small script tells Lolly the extension is present, so the **URL Screenshot** tool switches on automatically - no setup.
- When you render, the extension opens the target page in a background tab, captures it via the DevTools Protocol (the same `Page.captureScreenshot` the desktop app uses), then closes the tab and hands the image back.
- It runs entirely in your browser, on your network - so capturing `localhost` or an internal site works. The capture itself is never uploaded anywhere; the only network traffic is your own browser loading the page you asked to shoot.

While a capture runs you may briefly see a *"…started debugging this browser"* banner on the temporary tab. That's the DevTools Protocol at work; it clears itself when the shot is done.

## Reading a site for Brand Studio

The **Website** source in Brand Studio starts a brand from a site you already have. On Chromium the extension is what reads it; on the desktop app a native fetch does the same job and on a plain browser with no extension the tile isn't offered at all.

What happens when you press it:

- One address, one page. The extension opens it in the same kind of background tab, reads the rendered markup, the stylesheet text and a handful of icon and logo images, then closes the tab. It does not follow links and it does not crawl.
- Stylesheets and fonts hosted elsewhere (a CDN, a font service) are fetched too, because the page's colours and type live in them. Cross-origin requests go without your cookies; same-origin ones use them, exactly as the page itself would.
- Everything is capped - a bounded number of sheets, images and bytes - so a hostile or half-broken page returns partial material rather than hanging.
- The bytes go straight back to the Lolly tab that asked. The parsing into colours, type and logos happens on your device; nothing is uploaded.

Nothing is read until you press. Pasting an address only fills the field in.

## After installing

Reload the Lolly tab. The "Get the extension" prompt disappears and **URL Screenshot** becomes available in the gallery and in Batch mode.

## Permissions

Its `manifest.json` declares four permissions plus host access:

- `debugger` - drive the background tab through the DevTools Protocol. This is what takes the screenshot.
- `tabs` - open the temporary background tab and close it again afterwards.
- `scripting` - run the one-page reader inside the site you named, for the Brand Studio Website source.
- `storage` - note the id of a tab it opened, in session storage only, so the tab still gets closed if the browser suspends the extension mid-read. Cleared on the next start; nothing about you is stored.
- `host_permissions: ["<all_urls>"]` - host access to *all* sites, because you can point it at any URL you choose. Chrome surfaces this at install time as a broad "read and change all your data on all websites" warning.

Despite that warning, it only reads the single page you ask it to capture or import, and it does not read or transmit your browsing data - nothing is uploaded anywhere.

The manifest also sets `minimum_chrome_version: 111`. The current version is 0.2.1.

## Troubleshooting

- **Still seeing "Get the extension"?** Reload the Lolly tab - detection happens on page load.
- **Nothing happens on this site?** The extension only activates on Lolly's own origins. Running a custom build on another domain? Add it to `content_scripts.matches` in the extension's `manifest.json`.
- **A capture fails?** Check the URL is reachable and starts with `http://` or `https://`. Some pages actively block automated capture.
