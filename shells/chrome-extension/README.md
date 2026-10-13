# Lolly URL Screenshot

This Chrome extension supplies screenshots and website readings to the Lolly web shell. Each request opens an extension approval window showing the requesting site and the target URL. The extension reads the page only after the person clicks **Approve once** and grants access to the target site.

Readings use the browser session, so signed-in pages can contain private information. The result goes back to the requesting Lolly page. Approval applies to one request, even when Chrome already remembers access to that site. Closing the approval window, changing the requesting page, or moving the target to another origin cancels the request. Approval expires after 30 seconds; a reading is bounded to 55 seconds. Only one request can wait or run at a time.

The production relay accepts the exact `https://lolly.tools` origin. Other origins need a separate build. The approval page is extension-owned and is never a web-accessible resource.

## Load and package

The source directory is the production extension. Load `shells/chrome-extension` through Chrome's **Load unpacked** option to use it on `https://lolly.tools`.

For local development, run `pnpm run pack:chrome-extension:dev`, then load `dist/chrome-extension-dev`. This package adds the exact `http://localhost:5173` origin and has **Development** in its name.

For a store package, run `pnpm run pack:chrome-extension`. The script verifies the production origin and permission policy before producing `dist/chrome-extension.zip`. Development matches are generated into their own output directory; no manual manifest editing is needed.

## Files

| File | Role |
|---|---|
| `manifest.json` | Chrome MV3 configuration and optional HTTP host access |
| `policy.js` | Exact requesting origins |
| `background.js` | Bounded screenshot and page-reading operations |
| `consent-flow.js` | Request authentication, approval and cleanup |
| `consent.html`, `consent.js`, `consent.css` | Protected approval window |
| `content.js` | Isolated relay between Lolly and the extension |
| `inpage.js` | Synchronous capability announcement |

Temporary reading tabs are closed after completion. Their IDs are kept in session storage so the next worker start can close a tab left behind by worker shutdown. No page contents are stored by the extension.
