# Release Notes

> Draft launch notes for the first public open-source release. Set the version and date
> before publishing; the content below is brand-agnostic and reflects the current platform.

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
- **Download the desktop app** - signed **macOS** and **Linux** builds are available to
  download for this release. (Mobile apps are pending app-marketplace approval and may follow.)
- **Build from source / self-host** - clone, `npm install`, `npm run dev:web` (Node >=22.18 or
  >=24); a first render takes about 60 seconds ([`docs/make-something.md`](docs/make-something.md)).
  Self-host the built web shell for a team; full operator documentation lives under `docs/`.
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
