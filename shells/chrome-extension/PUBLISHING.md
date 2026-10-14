# Publishing Lolly URL Screenshot

Run `pnpm run pack:chrome-extension` and submit `dist/chrome-extension.zip`. The packaging gate requires the exact production relay origin and optional site permissions. The development package has a separate directory and archive and must never be submitted.

## Store listing

**Name:** Lolly URL Screenshot

**Summary:** Read one page after approving each request in the extension.

**Category:** Developer Tools

The Lolly web app can ask for a screenshot or the markup, stylesheets and icons of a page you choose. Each request opens an extension approval window with the target URL and the requesting site. The page is read after you click Approve once. Results return to that requesting site. Reading a signed-in page uses your browser session and may include private information. A request that moves to another site is canceled.

## Permissions

- **debugger:** takes a screenshot at the selected viewport and pixel ratio in the temporary reading tab.
- **scripting:** runs the bounded page collector in that temporary tab after approval.
- **tabs:** opens and closes the temporary tab and verifies that the requesting page and target site have remained within the approved request.
- **storage:** records temporary tab IDs in session storage for cleanup after worker shutdown. It stores no page contents.
- **Optional HTTP host access:** requested from the approval button for the target site's host. Every reading still requires its own approval, including sites already granted in Chrome.

## Data use

The extension returns the approved screenshot or page contents to the requesting Lolly site. It adds no analytics or other recipient and stores no page contents. Describe the resulting data flow accurately in the dashboard.

Privacy policy: [Lolly privacy policy](https://lolly.tools/info/privacy.html).

The package includes the 128 pixel icon. Add a screenshot of the approval window and a completed reading to the store listing.
