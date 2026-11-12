# Formats Lolly can open and make

**Choose the format last.** Make it once, in your brand. Send it as a deck, a document, a web graphic, a video or a press-ready PDF. Bring decks, PDFs and design files back in and keep editing.

<!-- the format-last figure renders here -->

Before you start, check that Lolly can open your file and make the one you need. The table groups formats by what each one is: formats Lolly only reads sit at the left, formats it only writes sit at the right, and formats it does both ways sit once in the middle. Tap a format for what it is and what Lolly keeps, such as transparency, colour profiles, layers and credentials.

The table also covers captions, 3D models and editing timelines. Captions, Audiogram and Lolly Record export SRT and VTT captions, and Captions also exports TTML and SCC. Lolly 3D Studio opens STL and 3MF models, and Lolly Design exports Premiere XML with its media.

<!-- the three-zone formats table renders here -->

<!--i:eti-repeat-->
## Why "both ways" matters

A format in the middle column is one you can bring a file in as, work on and send back out in the same shape. That is what stops a file becoming a dead end: a deck arrives as a deck and leaves as a deck, a design file arrives as editable layers, a CSV goes back out as a CSV. Nothing in Lolly needs a proprietary container to keep working.

<!--i:eti-upload-->
## Bringing files in

Every file is read on your device, and nothing is uploaded.

| Kind | What happens when it comes in |
|---|---|
| **PNG, JPG and WebP** | Kept byte for byte in **My images**, so a Content Credential on the file still verifies. Only a very large image asks whether to keep the original or resize the copy. To remove EXIF and GPS data on the way in, turn on **Strip metadata from uploads** under Settings → Preferences → Feature flags. |
| **GIF, APNG and animated WebP** | Kept byte for byte with every frame, so they stay animated when placed. |
| **AVIF** | Read wherever the browser can decode AVIF. |
| **HEIC and HEIF** | iPhone photos decode even where the browser cannot, through a bundled decoder. |
| **DNG and camera raw** | Photos from DNG, CR2, NEF, ARW, ORF, RW2 and uncompressed RAF files are developed on your device and stored as a normal picture. A DNG uses the matrices in the file, so its colour is exact. The other formats carry none, so Lolly fits the colour to the camera's embedded JPEG and says "approximate colour" in the import note. Canon CR3 and variants Lolly cannot decode open the camera's JPEG preview instead. See [Lolly Darkroom](/info/darkroom.html#open-a-camera-raw-photo). |
| **SVG** | Cleaned (scripts, event handlers and `javascript:` links removed) and given a clean viewBox. |
| **PowerPoint** | Add it through any upload area, or drop it on the gallery and choose **Add slides to your library**: each slide you pick becomes an SVG asset, with charts and SmartArt as labelled placeholders. **Edit in Design** opens the deck with editable slides, and [Rebrand a deck](/info/rebrand.html) moves it onto your design system. |
| **PDF and Illustrator** | Dropped on an upload area, it asks which pages to keep; each page becomes an SVG asset. [Import a design](/info/design-import.html) opens it as editable layers instead. |
| **Design files** | Figma, Penpot, InDesign, Affinity, DXF and Photoshop files open in Lolly Design as layers you can edit. See [Import a design](/info/design-import.html#what-comes-in-from-each-app). |
| **Editing timelines** | Premiere XML, CMX 3600 EDL, OpenTimelineIO and Final Cut Pro XML open in Sequence with their clips, gaps and timecode. Point Lolly at the media files, or carry on with labelled placeholders. See [The sequence editor](/info/sequence-editor.html#premiere-xml-exchange). |
| **CSV and JSON** | Pasted or dropped, a table fills a tool's repeating blocks, up to 1,000 rows. CSV follows RFC 4180; JSON can be an array of row objects, plain arrays, or a `data` or `rows` wrapper. |
| **Lottie and dotLottie** | Checked and placed as live vector animations (see [Lottie animations](/info/sequence-editor.html#lottie-animations)). |
| **MP4, MOV and WebM** | Kept byte for byte, never re-encoded; dimensions are read on your device. |
| **MXF, ProRes and DNx** | Identified, decoded by the device where available. Lolly reads the file header, says which codec it holds and keeps the original. See [Professional video](#professional-video). |
| **MP3, WAV, OGG and Opus, M4A and AAC, FLAC** | Kept byte for byte and decoded on your device, ready as a music bed under a video. |
| **MIDI and tracker modules** | A `.mid` file becomes a small on-device synth track, with each note's velocity kept as its loudness; Lolly Rondocode also writes a song as a `.mid`. MOD, XM, IT, S3M, STM and MTM modules play through a bundled player. A [Lolly Rondocode song](/info/rondocode.html) plays at any length. |

Lolly also reads and checks the Content Credentials in PDF, PNG and APNG, JPG, GIF, SVG, TIFF, WebP, AVIF, MP4, WebM and MKV, MP3, WAV, M4A and OGG/Opus files; see [Lolly Verify](/#/verify). The **Strip Hidden Data** utility reads embedded metadata in order to remove the data.

<!--i:eti-film-->
## Professional video

Cameras and editing apps often write ProRes or DNxHD and DNxHR, in a MOV or an MXF file. When you bring one in, Lolly reads the container header on your device and tells you what the file holds: the picture codec and profile (ProRes 422, 422 HQ, 4444 and the others, DNxHD or DNxHR, H.264, HEVC, AV1), the frame size and rate, the start timecode, and each sound track with its codec, channels and sample rate. Details shows it as the clip's codec and start timecode.

Lolly does not bundle a ProRes, DNx, H.264, HEVC, AAC or AC-3 decoder. It asks your device whether its own decoder can open the file, and uses it if so:

- **Your device can open the file.** Preview, trim and transcode run through that decoder, as they do for any other clip. Safari, and the Lolly desktop app on a Mac, open ProRes with Apple's own decoder.
- **Your device cannot open the file.** Lolly says which codec the file uses and how to get a copy that opens: export an H.264, HEVC or AV1 copy from your editing app, or open the file in the desktop app on a Mac if it is ProRes. No browser plays MXF, so an MXF always asks for a copy. The original file stays in your library untouched either way.

Only the header is read, never the pictures, so a large file is identified at once. A damaged or cut-off header is refused with a plain message instead of being guessed at.

<!--i:eti-map-pin-->
## Where to go next

- [Export a file](/info/exporting.html): which format to pick for a screen, a printer or another app, with sizes, colour and what travels with each file.
- [Import a design](/info/design-import.html): what happens to layers, type and colour when a Figma, Penpot, Illustrator, InDesign, Affinity or DXF file comes in.
- [Parser inventory](/info/parser-inventory.html): for reviewers, every parser Lolly runs, because a parser is where an untrusted file meets a machine.
