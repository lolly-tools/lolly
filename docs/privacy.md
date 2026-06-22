# Privacy Policy

*Last updated: June 2026*

## The Lolly app

Lolly runs entirely in your browser. **We collect nothing, transmit nothing, and have no servers that see your data.** There is no analytics, no tracking, and no third party of any kind.

**No cookies — anywhere.** Lolly never sets a cookie. To make the app work, it keeps a small amount of data **on your own device**, all of it strictly necessary for a feature you're using:

- **Your light/dark theme** and a few interface preferences (sidebar width, zoom).
- **An offline cache of the tool catalog**, so the gallery still loads without a connection.
- **Local-only usage counters** for the little stats on your profile card — these are never sent anywhere.
- **Your own documents and saved sessions**, stored locally in the browser (IndexedDB) so your work persists between visits.

None of this is shared, uploaded, or used to identify or track you, so there is nothing to consent to — only this notice, so you know what's kept. You can wipe all of it at any time with **Profile → Clear all my data**, or by clearing the site's storage in your browser.

This documentation site (`/info`) is even lighter: it sets **no cookies** and stores only your light/dark preference on your device.

## The browser extension

The **Lolly URL Screenshot** browser extension does not collect, store, or transmit any personal data. No analytics, no tracking, no remote server.

## What it does

When you ask the Lolly web app ([lolly.tools](https://lolly.tools)) to screenshot a URL, the extension opens that page in a temporary background tab, captures it in your browser using the DevTools Protocol, hands the image back to the app, and closes the tab. Everything happens locally, on your own device and network.

## Data

- **We collect nothing.** The extension has no servers and makes no network requests of its own.
- **Captured images** go straight to the Lolly app in the same browser — never uploaded by the extension.
- **The URLs you capture** are used only to load that one page for that one screenshot. They are not logged or shared.

## Permissions

- **`debugger`** — to capture the rendered page via the DevTools Protocol (the same mechanism the Lolly desktop app uses).
- **Tab access** — to open and close the temporary tab the page loads in.
- **Host access** — because the page you choose to capture can be on any site.

None of these are used to read, monitor, or transmit your browsing.

## Contact

Questions? See [lolly.tools](https://lolly.tools).
