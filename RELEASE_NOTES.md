# Lolly 1.0.6

_Current release: **1.0.6** (2026-09-03). First public release was 1.0.1 (2026-08-30). Free
software under the **Mozilla Public License 2.0**; the content below is brand-agnostic and
reflects the current platform._

## Lolly - public launch

Lolly is a constraint-first, template-driven platform that produces creative assets at studio quality and at scale - image, motion, audio, document and more - from simple inputs. 
One platform-agnostic engine runs the same render path across a web PWA, desktop and mobile apps, 
and CLI + TUI. Tools are **data, not bundled code** - a manifest, a template and optional hooks - 
so new tools can ship without an app update. Lolly runs fully standalone on your own device.
Lolly is completely free and open source. It is licensed under the **Mozilla Public License 2.0**.

### What makes this release

- **On-device by design.** Rendering happens on your device. The on-device utilities (strip
  hidden metadata, compress a PDF, format/redact text) never upload your file - bytes in,
  bytes out, locally. Nothing phones home.
- **Content Credentials (C2PA) built in.** Exports can carry tamper-evident provenance, and
  federated source assets keep their credentials through a render. Verify any file's
  credentials in-app or from an agent.
- **One render path, everywhere.** The web app, the CLI and the desktop/mobile apps share the
  engine, so a render is identical across them. Every input is expressible in the URL, and the
  CLI is that same URL under a different transport - GUI and automation never drift.
- **Physical units and print output.** `width`/`height` accept `mm`/`cm`/`in`/`pt` with a
  `dpi` control; PDF exports fully color managed with separation plates if needed.
- **Batch mode & Multi-edit.** A spreadsheet-style grid generates many assets at once. 
  A live preview of multiple assets editable at once, perform global or isolated edits visually. 
- **Tool composition.** A tool can live-render another tool as an asset, and tools are 
  addressable as portable embed URLs.
- **Accessibility.** Tune it quiet or loud - reduce-motion, high-contrast, large-text and calm-previews, or richer audio and visuals - opt in without changing export quality. 
- **Governed automation via MCP.** An optional Model Context Protocol server exposes the
  catalog and render path to AI agents (list, describe, build a link, render, transform,
  redact, verify) under the same rules as the app.

### New in 1.0.6

A formal release across every platform: web, macOS, Linux (deb, rpm, Flatpak, Arch), Android and iOS.

- **The design-system studio starts with one colour.** `/start` now shows one thing per room until
  the system has something of its own: pick a colour, choose a face, add a logo. Roles, shades, the
  colour chart, gradients and bulk editing appear as the palette grows. The blank starter ships only
  ink and paper, so nothing you did not choose looks like yours; what shipped is tagged Starter, what
  you chose is tinted, and a role that follows another says so. The first colour is a picker, not a
  text field. A Google Font previews on the first press with one consent, and no button in the
  studio is ever greyed out waiting for a previous step. Drag across the palette to select swatches
  in bulk and move, assign, download or delete them in one undoable action. Whether the interface
  takes the palette's primary is now an Appearance setting on the profile.
- **Design tool ease of use.** One motion model, a top bar, a navigator and an inspector; artboards
  fill again; controls say what they do. Text animation with split, stagger and order, hold
  effects and native PowerPoint animation on export. A box can tilt, and six one-click Choreograph
  showcases stack a camera move with keyframes. Sub-slide stacks and Morph matching for
  presentations. Transcript-driven editing: strike a line through and playback and export skip
  it; marquee-move many timeline clips at once.
- **Sequence audio.** Stereo pan, junction crossfades, ducking that follows the signal, a master
  true-peak limiter at every mix, pitch-preserving time-stretch and a pitch pair, a three-band EQ
  in a compact audio strip, level faders, BS.1770 loudness normalisation per clip, an effect rack
  with on-device voice cleanup, and waveforms that warn where a clip clips.
- **Narrated slides.** Speaker notes become a voice track, captions travel inside the file, a PPTX
  carries its narration as real slide audio, and a deck exports as a SCORM 1.2 or 2004 package with
  a launch page and captions. Expressive speech marks in the script: `[pause N]`, `[slow]`,
  `[fast]`, a pronunciation override per word and voice blends. Parentheses no longer break word
  timings.
- **Documents, deep links and automation.** `.lolly` files belong to Lolly on macOS, Windows,
  Linux, iOS and Android, open in the app from the system file manager, and carry dedicated
  document artwork on macOS and Linux. The Share dialog can now write a `lolly://` app link with
  every input and behaviour flag intact for a shortcut or QR code. Editor-state links (`_sel`,
  `_t`, `_panel`) pose the editor from a URL, and `window.lolly.ui` plus a postMessage channel
  drive it at runtime.
- **Reliability.** The service worker heals runtime cache entries stored before the isolation
  headers, which had left the on-device models stuck at 100% for returning users. Raster exports on
  WebKit keep offset box shadows. The iOS radio visualiser no longer summons the keyboard. PPTX
  timing writes one effect group per effect so a timed exit plays.
- **Docs.** A new landing with mascots beside the lanes, a Get-the-app band, Legal, AI and Security
  lanes; the sequence editor's Sound section; the animating pages with Choreograph, tilt and
  camera screenshots; the design-system studio page rewritten for the new flow.
- **Engine 1.159 to 1.171.** Shaped-glyph letter tier for split text, per-box tilt, activity spans,
  the true-peak limiter, BS.1770 integrated loudness, the fx kernels and grammar, expressive speech
  and narrated slides. All additive; every tool that ran on 1.0.5 runs unchanged.

### The tool set

The public catalog is brand-agnostic; a deployment mounts its own brand pack (or starts from a
neutral one) and every tool conforms to that brand's tokens automatically. Tools span:

- **Everyday:** QR codes (link, contact, Wi-Fi, event, location, text), quote cards, code-to-
  image, a recomposing dynamic layout, a global meeting planner.
- **Design:** an open canvas, charts (bar/line/area and D3-powered), a photo darkroom
  (halftone, scanline, posterize, duotone, dither, ASCII), mesh gradients, street maps.
- **Utilities (on-device):** strip hidden metadata from images and PDFs, compress a PDF,
  format/decode/hash/de-identify text, grow a colour palette with perceptual ramps and
  WCAG/APCA readability, capture a web page as a high quality vector image.

Tools are marked **Official** (brand-approved, watermark-free) or **Experimental** (exports
carry a PREVIEW watermark for testing until graduated).

### Privacy and provenance

- Creations and files stay on your device by default; saved sessions and the asset cache live
  in local storage, and you can clear them per category.
- Exports embed authorship/provenance metadata per format, with no personal data unless you
  opt in.
- The on-device transform path never watermarks and never embeds provenance - a file you
  brought is yours.
- Powerful provenance detection including a genAI content assessment for text and c2pa marked files.

### Security and licensing

- Licensed under **MPL-2.0**. Third-party notices are reproduced in
  [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md), with a machine-readable CycloneDX SBOM
  (CI-checked for drift).
- Security posture and disclosure process are in [`SECURITY.md`](SECURITY.md). Tool hooks run
  with the host bridge injected but are **not** a security sandbox - run only tools you have
  reviewed until Worker isolation ships.

### Get Lolly

- **Run it in the browser** - directly via the web or PWA.
- **Download the app** - for this release, from [lolli.li](https://lolli.li) (verify any file
  against [`SHA256SUMS.txt`](https://lolli.li/SHA256SUMS.txt)):
  - **macOS** (Apple silicon): signed + notarized [`.dmg`](https://lolli.li/lolly-latest.dmg).
  - **Linux**: [`.rpm`](https://lolli.li/lolly-latest.rpm) (openSUSE / Fedora family),
    [`.flatpak`](https://lolli.li/lolly-latest.flatpak) (any distro),
    [`.deb`](https://lolli.li/lolly-latest.deb) (Debian / Ubuntu amd64; arm64 at
    [`lolly-latest-arm64.deb`](https://lolli.li/lolly-latest-arm64.deb)), and an **Arch** pacman
    channel - add `[lolly]` with `Server = https://lolli.li/arch/$arch`
    (`SigLevel = Optional TrustAll`) to `/etc/pacman.conf`, then `pacman -Syu lolly-desktop-bin`.
  - **Android**: [`.apk`](https://lolli.li/lolly-latest.apk) (sideload; no store).
  - **iOS**: 1.0.6 goes to App Store review with this release (1.0.5 was not approved); a sideloadable build exists on request.
- **Build from source / self-host** - clone, `npm install`, `npm run dev:web` (Node >=22.18 or
  >=24); a first render takes about 60 seconds ([`docs/make-something.md`](docs/make-something.md)).
  Self-host the built web shell for a team; full operator documentation lives under `docs/`.
- **Write a tool without the platform** - the tool-author SDK is on npm as
  [`@lolly-tools/core`](https://www.npmjs.com/package/@lolly-tools/core) (`npm i -D @lolly-tools/core`,
  1.0.0, MPL-2.0): the `HostV1` contract types, `validateTool` (the same manifest check the catalog
  CI runs) and `createMockHost` to unit-test `hooks.js` with no browser. It keeps its own semver and
  moves when the tool-author surface moves, not with app releases.
- **Governed at org scale (optional):** pair a deployment with the open-source **lolly.work**
  control plane for SSO, feature-flag / export / watermark policy, catalog federation,
  approvals and a hash-chained audit log - served to the shell without a code change. Lolly
  still renders on-device: OSS = individual freedom, OSS + control plane = organizational
  freedom.

### Known limitations

- Saved state is per-device; clearing browser storage loses saved sessions.
- Web-page capture is native on the desktop apps and via the companion Chrome extension on the
  web; the bare web shell and the CLI stub it until they are deployed with access to chromium.
- Hosted rendering of hook-heavy / HTML-heavy tools needs the optional Chromium worker tier;
  the fast path refuses them by default.
