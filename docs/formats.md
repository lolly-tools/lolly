# Formats Lolly can open and make

Before you start, check that Lolly can open your file and make the one you need. The table groups formats by what each one is: formats Lolly only reads sit at the left, formats it only writes sit at the right, and formats it does both ways sit once in the middle. Tap a format for what it is and what Lolly keeps, such as transparency, colour profiles, layers and credentials.

A few are not in the table yet: SRT and VTT captions, which Captions, Audiogram and Record export; STL and 3MF models, which 3D Studio opens; and Premiere XML + media, which Design exports.

<!-- the three-zone formats table renders here -->

## Why "both ways" matters

A format in the middle column is one you can bring a file in as, work on and send back out in the same shape. That is what stops a file becoming a dead end: a deck arrives as a deck and leaves as a deck, a design file arrives as editable layers, a CSV goes back out as a CSV. Nothing in Lolly needs a proprietary container to keep working.

## Bringing files in

Every file is read on your device, and nothing is uploaded.

| Kind | What happens when it comes in |
|---|---|
| **PNG, JPG and WebP** | Kept byte for byte in **My images**, so a Content Credential on the file still verifies. Only a very large image asks whether to keep the original or resize the copy. To remove EXIF and GPS data on the way in, turn on **Strip metadata from uploads** under Settings → Preferences → Feature flags. |
| **GIF, APNG and animated WebP** | Kept byte for byte with every frame, so they stay animated when placed. |
| **AVIF** | Read wherever the browser can decode AVIF. |
| **HEIC and HEIF** | iPhone photos decode even where the browser cannot, through a bundled decoder. |
| **SVG** | Cleaned (scripts, event handlers and `javascript:` links removed) and given a clean viewBox. |
| **PowerPoint** | Add it through any upload area, or drop it on the gallery and choose **Add slides to your library**: each slide you pick becomes an SVG asset, with charts and SmartArt as labelled placeholders. **Edit in Design** opens the deck with editable slides, and [Rebrand a deck](/info/rebrand.html) moves it onto your design system. |
| **PDF and Illustrator** | Dropped on an upload area, it asks which pages to keep; each page becomes an SVG asset. [Import a design](/info/design-import.html) opens it as editable layers instead. |
| **CSV and JSON** | Pasted or dropped, a table fills a tool's repeating blocks, up to 1,000 rows. CSV follows RFC 4180; JSON can be an array of row objects, plain arrays, or a `data` or `rows` wrapper. |
| **Lottie and dotLottie** | Checked and placed as live vector animations (see [Lottie animations](/info/sequence-editor.html#lottie-animations)). |
| **MP4, MOV and WebM** | Kept byte for byte, never re-encoded; dimensions are read on your device. |
| **MP3, WAV, OGG and Opus, M4A and AAC, FLAC** | Kept byte for byte and decoded on your device, ready as a music bed under a video. |
| **MIDI and tracker modules** | A `.mid` file becomes a small on-device synth track; MOD, XM, IT, S3M, STM and MTM modules play through a bundled player. A [Rondocode song](/info/rondocode.html) plays at any length. |

Lolly also reads and checks the Content Credentials in PDF, PNG and APNG, JPG, GIF, SVG, TIFF, WebP, AVIF, MP4, WebM and MKV, MP3, WAV, M4A and OGG/Opus files; see [Verify](/verify). The **Strip Hidden Data** utility reads embedded metadata in order to remove the data.

## Where to go next

- [Export a file](/info/exporting.html): which format to pick for a screen, a printer or another app, with sizes, colour and what travels with each file.
- [Import a design](/info/design-import.html): what happens to layers, type and colour when a Figma, Penpot, Illustrator or InDesign file comes in.
- [Parser inventory](/info/parser-inventory.html): for reviewers, every parser Lolly runs, because a parser is where an untrusted file meets a machine.
