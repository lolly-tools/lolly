# Shoulders of giants

"If I have seen further it is by standing on the shoulders of giants." Isaac Newton wrote that to Robert Hooke in 1675, and he was borrowing: the image was already five centuries old, coined by Bernard of Chartres and written down by a student in 1159. Even this page's title is second-hand, and both times somebody said from whom.

That is the custom this page keeps. Lolly [signs what it makes](/info/content-credentials-identity.html); here we credit what it is made from. The legal record ships inside every copy of the app - [the bundled components with their full licence texts](/THIRD-PARTY-LICENSES.txt), plus a software bill of materials in the repository that runs past seven hundred entries. But a licence file is an obligation, not gratitude. This page is the thank-you: the projects that do the most for Lolly, grouped by lineage and roughly oldest first, because the oldest debts run deepest and a remarkable number of them trace back to the same place.

## The free desktop came first

The assumptions Lolly is built on - render on your own device, keep your files yours, treat Linux as a first-class home - were the working assumptions of the free software desktop long before this project existed. The deepest code in the app grew up there.

- **HarfBuzz** shapes every run of text that Lolly turns into vector outlines, so an exported SVG or PDF reads the same on a machine that has never seen the font. Its oldest code began inside **FreeType** in the late 1990s, grew up in GNOME's text stack (Pango) and in Qt, and was unified by Behdad Esfahbod under freedesktop.org. The same shaper sits inside Chrome, Firefox, Android and LibreOffice. Lolly compiles it to WebAssembly and runs it unchanged in the browser and the CLI. The name is Persian for "open type".
- **eSpeak NG** is the voice under the voice. Jonathan Duddington wrote its ancestor, Speak, for Acorn machines in 1995; eSpeak reached Linux in 2006 and became the sound of the free desktop's screen readers. When Lolly's neural voice reads text aloud, eSpeak NG - compiled to WebAssembly by the phonemizer project - first spells out how every word is pronounced. A 1995 formant synthesiser teaching a 2025 neural network to say "Worcestershire" is open source working exactly as intended.
- **GIMP** earns a different kind of credit: Lolly writes its native XCF format from scratch, so a layered export opens straight into the image editor two Berkeley students released in 1996. No GIMP code runs inside Lolly - the debt is the format, and the toolkit story besides it: GTK began life as GIMP's toolkit, and GNOME was built on GTK.
- **KHTML**, begun in the KDE project in the late 1990s, became WebKit, which became Chromium's Blink. On Linux the desktop app renders through WebKitGTK, and the CLI's high-fidelity raster tier and this site's own screenshots run headless Chromium - two browser engines, one KDE ancestor.
- **D-Bus and the XDG desktop portals**, freedesktop.org's shared plumbing, are how the Linux build behaves like a native citizen: the screenshot and wallpaper portals, and search providers so GNOME Shell and KRunner can find your tools by name.

The traffic runs both ways: Lolly ships as openSUSE RPMs and a Flatpak, and registers itself with the desktop's own search. The platform that taught this project its values is a build target, not a footnote.

## The oldest code is in the audio path

- Inside the voice denoiser sits **pffft**, Julien Pommier's fast Fourier transform, itself descended from **FFTPACK** - numerical Fortran written at the US National Center for Atmospheric Research in the 1980s. Clean up a voice memo in Lolly and the maths doing the spectral work is older than the web.
- **libopenmpt** plays tracker modules - .mod, .xm, .s3m, .it - a format family that began with Ultimate Soundtracker on the Amiga in 1987 and passed through Olivier Lapicque's ModPlug Tracker in 1997. Lolly uses it for module playback and for baking that music into video exports.
- **LAME** started in 1998, when MP3 was patent-encumbered and a free encoder was an act of defiance. Its lamejs port does Lolly's MP3 export.
- **MilkDrop**, Ryan Geiss's 2001 Winamp visualiser, lives on as **Butterchurn**, a WebGL reimplementation that drives the audiogram visualiser - and presets by more than a hundred MilkDrop artists ride along with it.
- **FLAC**, Josh Coalson's lossless codec from 2001, now a Xiph.Org project, is the signed lossless audio export.
- The young ones hold their own: **mediabunny** reads and writes Lolly's video files over WebCodecs, **Signalsmith Stretch** (Geraint Luff) time-stretches and pitch-shifts audio, and **GTCRN** (Rong Xiaobin, 2024) - a speech enhancer of barely 48,000 parameters - is the denoiser wrapped around that 1980s FFT.

## Type and templates

- **Handlebars** (Yehuda Katz, 2010), heir to Mustache's logic-less templating, hydrates every tool template. The engine has exactly two runtime dependencies; this is one. **Ajv**, Evgeny Poberezkin's JSON Schema validator, is the other - no tool manifest loads without passing it.
- **ProseMirror** (Marijn Haverbeke) is the rich-text editing under the canvas, wrapped by **Tiptap**.
- The typefaces are all under the Open Font License: **SUSE** and **SUSE Mono** by the SUSE Project Authors, the **Outfit** variable face, **Noto Color Emoji** so emoji render in exports, and **Cinzel**, Natanael Gama's take on first-century Roman capitals - the face this site sets [Beatrice Warde's broadside](/info/beatrice-warde.html) in.
- The tool icons are **Lucide**, the community continuation of Cole Bemis's Feather icons.

## Pictures, pages and print

- **libvips** began around 1990, imaging paintings for the National Gallery in London; through **sharp** it does the image heavy work in Lolly's build toolchain and Node shells.
- **jsPDF** (James Hall) has been writing PDFs inside browsers for a decade and a half; with **pdf-lib** beside it, Lolly writes, reads, merges and strips PDFs on-device.
- **DOMPurify**, from the security firm Cure53, has been the standard answer to HTML sanitisation since 2014; every SVG and HTML upload passes through it before touching the page.
- **resvg** (Yevhenii Reizner) rasterises SVG in the CLI's fast tier. **libheif** (Dirk Farin) opens iPhone HEIC photos. **three.js**, started by Ricardo Cabello in 2010, renders the 3D and Flythrough tools. **lottie-web** plays Lottie animations, **gifenc** (Matt DesLauriers) encodes animated GIFs, and **html2canvas** and **dom-to-image-more** are the raster capture fallbacks.
- The Gradient tool's flow mode runs **webgl-noise**, Ian McEwan and Stefan Gustavson's simplex noise shaders from 2011; the Backdrop tool runs **Paper Shaders** by Paper Design; the Darkroom's film looks come from **FilmSim**, Sébastien Guyader's public-domain emulations of classic film stocks.

## Maps, codes and data

- **OpenStreetMap** contributors have been mapping the world by hand since 2004. The Street Map poster tool draws its roads and waterways from their work, pre-clipped for more than fifty cities (map data © OpenStreetMap contributors, ODbL).
- **Natural Earth**, the public-domain world atlas that cartographers Tom Patterson and Nathaniel Vaughn Kelso started in 2009, is the globe inside the meeting planner, packaged by Mike Bostock's world-atlas.
- **D3** (Mike Bostock, 2011) draws the Chart tool, projects the street maps and spins that globe.
- **BWIPP**, Terry Burton's Barcode Writer in Pure PostScript, encodes Data Matrix, PDF417, Aztec and a dozen other symbologies - a reference implementation written in Adobe's 1984 page description language, executed in the browser by bwip-js. **qrcode-svg** draws QR codes; the QR code itself is Masahiro Hara's 1994 design, which Denso Wave chose never to enforce a patent on. **ZXing**, begun at Google in 2008 for the first Android phones, is the scanner going the other way.
- Every compressed design link and every .lolly file is DEFLATE, the format Phil Katz published in 1993, implemented today by **fflate**. **Zstandard** (Yann Collet) and **kiwi** - Evan Wallace's binary schema format, written at Figma - together let Lolly unpack a .fig file; Penpot's open .penpot format asks for no such effort and imports directly.
- And the small exact parts: **yaml** (Eemeli Aro) in the Text Helper, **idb** (Jake Archibald) over IndexedDB, **flatpickr** for dates, Julien Marcou's emoji picker, **woff2-encoder** for font subsetting.

## The new giants

The newest giants are neural networks, and Lolly [runs them the way it runs everything else](/info/ai-features.html): on your device, downloaded only when a feature needs them, pinned by checksum in the build, each model family carrying its own credits file.

- **ONNX Runtime** (Microsoft) and **transformers.js** (Joshua Lochner's project, now at Hugging Face) are the two runtimes every model below rides on; the desktop app also runs ONNX natively in Rust.
- **Kokoro** (hexgrad, 2025) - the 82-million-parameter text-to-speech voice, with eSpeak NG spelling out its pronunciation.
- **Whisper** (OpenAI, 2022) - speech-to-text with word-level timing, which is what lets you edit a video by editing its words.
- **all-MiniLM-L6-v2** (the sentence-transformers project) - the embeddings under Ask's search.
- **SmolLM2** (Hugging Face) - on-device rewording.
- **U2-Net** (Xuebin Qin and colleagues) and **MODNet** (Zhanghan Ke) - background removal, general and portrait.
- **PP-OCRv5** (PaddlePaddle) - reading text out of images.
- **Real-ESRGAN** (Xintao Wang) with **GFPGAN** (Tencent ARC) and **BlazeFace** (Google) - upscaling and face restoration.
- **TrustMark** (Adobe) - the deep scan for invisible watermarks in Verify.
- An AI-text detector fine-tuned on e5-small by May Zhou.

## The shells and the workshop

- **Tauri** builds the desktop and mobile shells in Rust; on Linux its webview is WebKitGTK. Beside it: **serde** for every IPC payload, **snow** - an implementation of Trevor Perrin's Noise Protocol Framework, the same handshake family WireGuard uses - securing nearby collaboration, **mdns-sd** finding those devices with the zero-configuration discovery Apple ships as Bonjour, and hundreds more Rust crates beneath them.
- **jsdom** is the DOM in pure JavaScript; the CLI, the TUI and the MCP server render through it, so the terminal takes the same render path as the browser.
- **Ink** (Vadim Demedes) with **React** draws the terminal UI. React appears twice: the Sandbox tool ships it with **Babel**, so you can write React inside Lolly.
- **Node.js** (2009) runs everything outside the browser.
- The workshop tools never ship but shaped all of it: **TypeScript** - from Anders Hejlsberg, whose first compiler was Turbo Pascal in 1983 - plus **Vite** (Evan You), **esbuild** (Evan Wallace again), **Biome** and **SVGO**.

## Every licence, in full

Curation is not the record. The record is:

- [THIRD-PARTY-LICENSES.txt](/THIRD-PARTY-LICENSES.txt), inside every copy of the app - the bundled components with their complete licence texts.
- A CycloneDX software bill of materials in the repository, covering the npm and Rust dependency graphs.
- Credits files beside every downloaded model family, and notice files beside vendored assets.

Lolly itself is open source under the Mozilla Public License 2.0 - a licence that is also inherited, drafted by Mozilla for the browser code it freed in 1998. [Beatrice Warde](/info/beatrice-warde.html) got her own page; this one is for everyone else. If your work is inside Lolly and named wrongly here, or not named at all, tell us and we will fix it. Attribution is the one payment every open project asks, and the one this project was built to keep.
