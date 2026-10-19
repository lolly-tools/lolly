# Console screenshot captures

Documentation screenshots are vector SVGs of the running console, captured with the
same DOM-to-SVG walker used by Lolly's documentation. Each file embeds the SUSE fonts
and a signed C2PA credential identifying its source as a screen capture. The paired
`<slug>.svg` and `<slug>.dark.svg` files let the console use the reader's theme.

The capture harness starts the real Work app with in-memory demo data, an evaluation
owner and the bundled pack. It uses fixed fixture secrets and never connects to an
operator's database. Provider examples do not contact Google or a customer DAV server;
the checked sample uses the real local renderer. Screenshots illustrate the app and
do not record live customer acceptance. Password and client-secret fields stay empty.

## Reproduce setup screenshots

Capture needs Playwright and Chromium installed in the sibling Lolly checkout, or a
`PLAYWRIGHT_DIR` override pointing at their installation. Runtime docs need only the
committed SVG files. The walker bundle is already committed here.

From the Work checkout:

```sh
node scripts/capture-console.ts \
  customer-setup-deployment customer-setup-identity customer-setup-sample \
  provider-webdav-setup provider-gdrive-setup provider-gdrive-consent catalog-providers
```

The recipes drive the current app before rendering its DOM. Crops retain the surrounding
console background so standalone dark SVGs stay readable. Both themes are captured
for every selected recipe. Supply `PORT` if the default capture port, 8799, is in use.
Running without slugs captures the full recipe list.

The default signer creates a demo root and leaf; verification reports a valid signature
with an untrusted self-signed identity unless its root is explicitly pinned. Each newly
captured recipe writes `<slug>.root.pem` alongside its pair. A partial capture preserves
the existing `signing-root.pem` and roots belonging to untouched images. A full capture
also updates the shared root. An explicit deployment signing key/certificate can be
supplied using the harness's existing `LW_C2PA_*` configuration.

## Verify before committing

```sh
node --test tests/docs-shots.test.ts tests/docs.test.ts tests/docs-vernacular.test.ts
pnpm run check:docs-vernacular
git diff --check
```

Inspect the generated SVGs in a browser and read the illustrated docs in both themes.
Check text, form values, crop boundaries and credential lines. Browser previews used
for visual review are temporary; the documentation assets remain SVGs. The tests check
vector files, references from nested guides, theme pairs and valid screen-capture
credentials.
