# Assets and file utilities

An `asset` input lets people pick logos, photos and other brand imagery from the design system's library or their own uploads. A `file` input takes a person's own file into memory so a utility, such as a converter or a metadata stripper, can transform the bytes and hand them back.

<!--i:eti-images-->
## `asset` - library or device upload

An `asset` input opens the host's asset picker and stores the chosen `AssetRef`, in the same form whether the asset came from the catalog or the person's device:

```jsonc
{
  "id": "logo",
  "type": "asset",
  "label": "Logo",
  "assetType": "image",    // vector | raster | image | video | audio | lottie | model | any - constrains the picker
  "allowUpload": true       // also let the user add an image from their device
}
```

`assetType` decides what the picker offers:

| `assetType` | The picker offers |
| --- | --- |
| `image` | Any still image, raster or vector. The right choice for a picture slot, because people can also pick or upload SVGs. |
| `raster` | Bitmaps only. |
| `vector` | SVG only, for logos you recolour inline. |
| `video`, `audio`, `lottie` | That kind of media; `audiogram` takes `audio`. |
| `model` | 3D models, as in `3d-studio`. |
| `any` | Everything, including assets that are not images. |

`filter` narrows the picker further: `{ "tags": [...], "namespace": "..." }` is passed to `host.assets.query()`.

**Pictures the tool ships.** An `asset` value, such as one an example look sets, can also name a picture in the tool's own `assets/` folder by its served path: `/tools/<tool-id>/assets/<file>`. The file must sit directly in that folder and end in `.svg`, `.png`, `.jpg` or `.webp`. The web shell reads the file through its verified catalog fetch, and the CLI, the TUI and the MCP server read the file from the tool's folder. [Example looks](/info/tool-manifest.html#example-looks-examples) shows the value to write.

![The Image row in the Filter tool - a thumbnail slot and a Choose asset button that opens the host's picker, with nothing about pickers in the manifest](/t/url-shot?url=%2F%23%2Ftool%2Ffilter&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28.asset-picker-trigger%5Bdata-input-id%3D%22image%22%5D%29&dark=1&filename=at2-input-asset-picker)

### Uploads from the person's device

With `allowUpload: true`, the picker offers the person's **image library** beside the catalog. The host stores uploaded bytes exactly as they arrived, because a silent re-encode would break a Content Credential's hard binding. The host offers to downscale only a very large file. Stripping metadata is a separate opt-in preference (**Strip metadata from uploads**, off by default).

The library has no limit on the number of images. The only limit is the device's storage, checked before each write. Every tool shares the library, and people manage the library in **Settings → Storage → My images**. SVG uploads are cleaned of scripts and event handlers on upload and stay vector.

These images stay on the device. Their `AssetRef.source` is `"user"`, and their `user/…` id means something only on the device that holds the bytes, so they are left out of share links ([URL Mode](/info/url-mode.html)). Tools treat `user` and `library` assets the same, and no tool code takes part in the upload.

### A pasted tool link becomes an image

Every `asset` input also accepts a **Lolly tool link** pasted into the picker's search box: a share link copied from another tool (`…/#/tool/qr-code?url=…`) or an embed URL (`…/tool/qr-code.svg?…`). The person picks the render format and size, and the host renders that tool through `host.compose` and places the result in the slot. This is the person's counterpart to an authored [`composes`](/info/tool-composition.html). It needs no manifest declaration and works in every tool's image inputs.

The picker offers SVG and bitmap render formats for any image slot. SVG is the default: it stays crisp, goes into SVG and PDF exports as vector and rasterises cleanly for PNG. A `vector` slot offers SVG only. The asset's identity is the canonical embed URL, so the asset is kept in saved sessions and share links and renders again on load, like a library id. The picker accepts tool links wherever the shell can compose. The `compose` capability gates only authored `composes`.

<!--i:eti-file-->
## `file` - the user's own file (on-device utilities)

A `file` input reads a file the person picks into memory and hands its raw bytes to the tool. Use it for content-transform utilities: strip metadata, crop, compress, convert.

::: note Nothing is stored or uploaded
A `file` value lives only in memory on the device. It is never written into a link, never saved with a session and never uploaded. The rules below keep that privacy promise of an on-device utility.
:::

With `layout: "canvas"` ([layouts](/info/tool-manifest.html#layout-and-sidebar)), a single `file` input becomes the working area, as in the drop zone `strip-data` opens with.

![Lolly Strip Hidden Data's canvas - a drag-and-drop file zone with a Choose a file button and the note that nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=1800&walker=1&format=svg&cropSelector=%23tool-content&dark=1&filename=auth-file-input)

```json
{
  "id": "photo",
  "type": "file",
  "label": "Photo",
  "accept": ["image/jpeg", "image/png", ".jpg", ".png"],
  "maxSize": 52428800
}
```

- `accept` - allowlist of MIME types and/or extensions for the picker (a UX hint; still validate bytes in the hook). Omit to accept anything.
- `maxSize` - max bytes; the host rejects larger files at pick time.
- `multiple` - `true` accepts many files at once. The value becomes an array of `FileRef`s, the CLI collects repeated `--<id>=path` arguments and an `exportFile` hook may return one result per file, which the host delivers as a single zip (`pages`, `claim`).

The value is a **`FileRef`**: `{ __file: true, name, mime, size, bytes, url }`. `bytes` is a `Uint8Array` the hook reads directly, with no `host.*` call, because the portable `host.*` surface has no file-read API. On the CLI a file parameter is a path the runner loads: `--photo=./pic.jpg`.

<!--i:eti-shield-check-->
## Producing output: the `exportFile` hook + `privacy: "on-device"`

A content-transform utility does not draw the canvas into an image. It produces a transformed file:

::: timeline
- <!--i:upload--> **The person drops or picks a file.** The bytes arrive in the `file` input's value, in memory.
- <!--i:cpu--> **Your `exportFile` hook transforms the bytes.** It returns the new bytes, a MIME type and a file name.
- <!--i:download--> **The shell delivers the result.** It wraps the bytes and hands them to `host.export.file`: a download on the web, the `--output` path on the CLI.
:::

Declare the `exportFile` hook and mark the tool as an on-device utility:

```json
{
  "status": "official",
  "privacy": "on-device",
  "render": { "width": 760, "height": 620, "formats": ["jpg"], "export": false, "actions": [] },
  "hooks": { "onInput": true, "exportFile": true }
}
```

- `privacy: "on-device"` shows the **Runs on your device - nothing is uploaded** badge. The validator refuses an on-device tool marked `experimental`, and at run time its exports carry **no provenance metadata and no watermark**: nothing may be stamped into a person's own file.
- `render.export: false` hides the standard format, size and download bar. `"actions": []` removes the default Save and Share buttons, because saving would keep the person's bytes.
- The `exportFile` hook reads the picked file and returns the transformed bytes as a plain record:

```js
function exportFile({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.photo;                       // the FileRef
  const cleaned = stripMetadata(f.bytes);       // your transform (pure bytes → bytes)
  return { bytes: cleaned, mime: f.mime, filename: f.name.replace(/(\.\w+)?$/, '-clean$1') };
}
```

In the template, a `<button data-export-file>Download…</button>` runs the hook. Use `onInit` and `onInput` to return extras the template shows, such as the metadata that was found. `strip-data` is the reference.

Keep instructions off the working surface. The canvas can carry the shell's own help tip: an element with the class `help-tip-host` that holds a `<button class="help-tip-btn">` and a `<span class="help-tip-pop" hidden>` as its direct child. The shell shows the tip on hover, on focus and on a press, and Escape closes the tip and returns focus to the button. `redact` is the reference.

