# Lolly 1.0.9: the DTP one

_Release notes: **1.0.9** (2026-09-22). First public release was 1.0.1 (2026-08-30). Free
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

### New in 1.0.9

**The DTP one** brings publishing tools, Agenda, inspector, sharing and export changes. Read the [1.0.9 release notes](releases/1.0.9.md) for the highlights, downloads and support limits.

- **3D Studio motion presets.** The subject can do more than turn. Beside
  **Still image** and **Turntable**, Motion now offers **Hover**, **Pulse**,
  **Wobble**, **Pop**, **Coin flip**, **Jump**, **Spin and land** and **Burst**.
  Hover, Pulse and Wobble run without stopping; the other five play once and then
  hold still before they go again. **Motion amount** scales how far any of them
  travel and **Rest between loops** sets that held pause. Every loop starts and
  ends at the place you put the subject, so a still of an animated document, a
  poster and a contact sheet are all the subject as you placed it, and whatever a
  loop does to the subject's size or tilt, its lowest point stays on the floor
  until the loop itself lifts it. Three templates open on a finished loop:
  **Logo drop**, **Bouncing icon** and **Shatter reveal**.
- **3D Studio camera moves.** Beside holding the view and travelling through your
  own keys, **Camera** offers five moves built from the view you have composed:
  **Orbit sweep**, **Push in**, **Dolly zoom**, **Reveal turn** and **Crane**.
  **Camera amount** scales how far a move travels, and **Convert to keys** on the
  preview turns the move into ordinary camera keys you can edit, as one step that
  undo takes back. A dolly zoom narrows the lens while the camera pulls back so
  the subject keeps its size and the background slides; an orthographic camera has
  no lens to change, so the move does nothing there.
- **Burst.** The subject breaks into its own triangles, which spin, fly outward,
  fall a little and shrink away before the object comes back together. Nothing is
  random, so the same moment of the loop draws the same picture on every device
  and in every export, and the cast shadow shatters with the object rather than
  staying whole underneath it. Nothing fades either: a piece shrinks instead of
  going see-through, so a burst works in every output, the transparent ones
  included. Burst shatters up to 250,000 triangles per object; a heavier model
  keeps its whole shape and the Source notes line gives the count that refused it.
- The new 3D Studio motion and camera copy, and the three template names and
  descriptions, read in English in every locale for this release. The tool
  locale pipeline covers a tool's gallery card rather than its per-input
  labels, so these strings are pending a translation wave.
- **3D scenes in Design.** A Design document can hold 3D scenes. Add one from
  the Add menu, drag out a frame and 3D Studio opens on the new box; afterwards
  the inspector's **3D scene** section opens it again with **Edit in 3D Studio**,
  and what you apply is written back as one undo step. Every scene box shows a
  still poster drawn through the studio's shared renderer, and the selected box
  is the document's one live scene, so a document with twenty scenes never opens
  twenty drawing contexts. A scene box on the timeline follows the playhead like a
  video clip, at the length you set in the studio. Every export draws each scene
  again at the size that file needs instead of photographing the screen, so the
  result does not depend on which box was selected, and a scene that cannot be
  drawn fails the export with the studio's own message. A scene travels in share
  links, saved sessions, templates and `.lolly` files, and the uploads it uses
  travel with it.
- **Older readers and a document with a 3D scene.** Such a document reads as
  invalid to a Lolly client from before this release, because `3d` is a layer
  kind those clients do not know. Nothing in the document is lost. Every earlier
  link decodes exactly as it did: `design:boxes` gained one appended field,
  `scene`, at position 101, and nothing already there moved.
- **3D Studio: a GLB or STL model now reports the size it measures in its own
  file.** Source notes read `Model spans 120 by 48 by 9 units in its file; shown
  at 3.25 studio units.`, beside the standing note that STL carries no units.
  Artwork, words and the built-in shapes report no size, because they are drawn
  to fit.
- **3D Studio: camera keys can be named.** Type a name in the key's row and the
  list shows it; **Go to key** on the preview steps through the saved views and
  says which one it reached. A key with no name reads and renders exactly as it
  did before.
- **3D Studio turns in APNG and animated WebP.** The two animated still formats
  join WebM, MP4 and GIF under the studio's export menu, and both keep the
  transparency of **Object only** and **Object with transparent shadow**, so a
  turntable with a clear background can sit over a page without a box.
- **Studios you can reuse.** Save the look of a 3D Studio document as a studio,
  then apply it to another document, a collection or an arrangement. The subject,
  the framing and the output settings stay with each document, and so does any
  studio control you change yourself. Editing a saved studio leaves the documents
  that use it alone until you choose Update from studio; Detach keeps the look and
  stops following. Saved studios live on your profile and never travel in a share
  link, which carries the values themselves.
- **Twelve icons, one studio.** Collection items now carry a size correction and a
  nudge of their own, so a set of unlike icons comes out level under one studio:
  twelve public test icons that varied by 65 percent in how much of the frame they
  filled now sit within 1.4 percent of each other, and the corrections survive a
  change of studio, colour pair and finishes. Items also carry a stable id, so
  reordering a collection keeps every override with the item it was made for, and
  an item can now be Words.
- **A contact sheet you can send.** Review collection renders its previews at up to
  512 pixels instead of 320, says what the sheet and the delivered files will be,
  and saves the whole sheet as one PNG.
- **Curve detail can follow the output size.** 3D Studio can read the number of
  straight pieces a curve is drawn with from the image you asked for, instead of
  a fixed count, keeping the flattening error inside a quarter of a pixel and the
  mesh inside one million triangles. A 4096 pixel image of a curved ring takes 47
  pieces per curve where a 64 pixel thumbnail takes 8. The fixed count stays the
  default and renders exactly as before.
- **3D Studio rebuilds only what you changed.** Moving the camera no longer
  rebuilds the objects, and moving a light rebuilds the lights alone. A colour or
  finish edit writes the materials onto the objects already in place, and only an
  extrusion edit reads the artwork again. Batch rows, contact sheets and preview
  tiles share two graphics contexts rather than opening one each, and a renderer
  handed back keeps its environment and backdrop, so a twelve-item collection is
  much cheaper to preview and export.
- **Unlit STL models show their colour.** An STL that carries no facet normals,
  or whose normals are all zero, rendered as a black solid with neither its colour
  nor its finish. The studio computes the normals from the triangles instead and
  records it in Source notes. STL is a facet format, so those normals are flat,
  one per facet.
- **GIF exports keep their transparency.** Every tool that writes an animated GIF
  now names a clear palette entry: a pixel less than half opaque becomes a hole
  instead of turning black, so a transparent shadow no longer arrives on a black
  card. GIF has one bit of alpha, so a soft edge steps rather than fades; APNG and
  animated WebP keep the full alpha channel. A GIF with no transparent pixels is
  unchanged, byte for byte.
- **TIFF, BMP and CMYK TIFF are drawn at the size you ask for.** These three still
  exports run the same export frame clock as PNG and JPEG, so a tool that draws
  its own frames uses the requested pixel size rather than the canvas size.
- **A tool link inside another document renders at export quality.** A Lolly tool
  link placed in a Design image box, or embedded as a tool image, was rendered at
  preview quality and a preview size when the document was exported. It is now
  rendered at export quality, at full samples and at its real size. Cards in the
  asset picker stay cheap previews.
- **The 3D and Flythrough tools open in one session.** Each vendors its own
  three.js build, and the second one opened in a page took the first one's library
  and reported that the 3D library failed to load. Each bundle now publishes
  itself under its own name and each tool takes only the build it can use. Both
  bundles are rebuilt at three 0.186.0.
- **A failed 3D tool can no longer be exported as a picture.** The 3D and
  Flythrough tools reported themselves ready even when they had put an error panel
  on the canvas, so a batch or export path photographed the panel and delivered it
  as the result. They now report the failure, which fails that export instead.
- **An abandoned 3D export no longer freezes the studio.** If an export stops
  before it finishes, the studio takes itself back after thirty seconds, records
  why in the browser console and checks its next frame. An export whose frame is
  truly empty still fails rather than saving a blank picture, and that check now
  reads the pixels of a cut-out surface instead of counting it as nothing.
- **Painted environments light the way they look.** The six painted 3D Studio
  environments were mirrored in the lighting map, so a shiny object reflected the
  painted sun or windows far from the lamp that lit it. Reflections and the crisp
  background now agree with the lamps; scenes saved with a painted environment
  look slightly different when reopened.
- **Fuller 3D bevels.** The 3D Studio bevel check follows the inset the renderer
  draws, so rings, letter counters and other shapes with curved holes keep their
  full bevel. A bevel is reduced, with a source note, only where a narrow or
  sharp detail would really fold. Some saved scenes show a fuller bevel when
  reopened.
- **3D Studio corrections.** A colour A edit on words or an STL model applies at
  once instead of after a reload. The first frame of a video or GIF uses the
  requested size and clip samples like the rest of the clip; Gradient, Backdrop,
  Synth and Audiogram with captions also receive the clip length for their first
  frame now. Camera, light and colour edits no longer leave unused graphics memory
  behind.
- **Steadier 3D exports.** Dragging, resizing or editing while a 3D Studio export
  runs no longer changes the exported frame. A frame that fails to render fails
  the export instead of saving the wrong picture.
- **More about 3D Studio 0.3 scenes.** Besides the differences listed under 1.0.8,
  a scene saved with 3D Studio 0.3 also changed in 1.0.8 in these ways: placed
  inside another tool or shown as a thumbnail, it renders at preview quality; an
  export at a size other than the canvas is rendered again at that size; and an
  object placed far from the centre or scaled up gets a wider shadow map, so its
  shadow is softer.

### New in 1.0.8

- **3D Studio for icons and products.** Extrude and bevel SVG
  artwork or import GLB/STL models. Preserve source colours, give faces, bevels
  and sides different finishes, and choose dramatic brand-coloured lighting.
  Depth of field softens real foreground and background forms. Export a complete
  scene, an object, or an object with a transparent shadow.
- **One studio for a coordinated set.** Review collections in a contact sheet,
  share lighting and finishes, retain each item's framing and material bindings,
  and export a named PNG set. Portable `.lolly` files carry uploaded models.
  Turntables and orbiting or breathing lights use repeatable animation timing.
- **More dependable 3D shaping and framing.** Unsafe bevels are reduced with a
  source note. Fit the object, reset the camera, orbit with the keyboard or click
  the subject to focus. Camera actions use undo and redo.
- **Whole scenes, not just one object.** Place several SVG files, 3D models and
  words in one scene, then select, move, nudge and turn each object, or add a
  group from the library at once. Light a scene with a generated studio, one of
  six painted environments, or your own `.hdr` or `.exr` radiance map, shown
  crisp or blurred behind the subject. Save camera paths from the live view,
  move key, fill and rim lights in the preview, and choose finishes such as
  chrome, clay, velvet, glass, pearl and neon. Larger exports are re-rendered at
  the requested size rather than enlarged from the preview.
- **Share a whole project folder.** "Download project (.lolly)" in a Projects
  folder writes the folder, its sub-folders, every saved session and its
  pictures into one file. Opening it rebuilds the folder with fresh copies, so
  nothing you already have is replaced.
- **Sync your own devices, safely.** Sync through Dropbox, Google Drive,
  OneDrive, WebDAV (including Nextcloud) or S3, or move a file yourself; syncing
  through a folder or straight to another device is planned. A sync checks the copy
  before writing and asks when both sides changed, instead of overwriting
  either. Deletions sync, a copy is kept before every change, and seven daily
  copies can be restored. Encryption is available and off by default. In the
  mobile apps, Drive and OneDrive sign-in stay hidden until their app
  registrations are set up, and the new mobile sign-in component has not yet
  been tested on a device.
- **Add pictures from a web address.** The image picker and the catalogue accept
  an image URL; the web app fetches it through its own server so the image can
  be used like an upload.
- **Charts keep long titles readable.** Chart 1.26 wraps long titles and
  subtitles, keeps wrapped category labels inside their rows, and narrows the
  plot so value labels stay on the canvas.
- **Emoji buttons on every text field.** A text field in a tool that opens with
  a template choice now keeps its emoji button after the choice is made.
- **Share your design with your rules.** Turn a Design document, saved session or
  template into a portable tool. Choose the editable text, images and options;
  keep the rest fixed. Set character limits, text fitting, font-size ranges,
  image framing and allowed exports. Arrange the inputs for the recipient and
  choose a sidebar or controls on the canvas.
- **One choice can change a whole design.** Link several inputs to a theme or
  switch between artboards. Common fields such as first and last name can supply
  several assets. Preview with sample values, check the compiled result, and try
  the downloaded `.lolly` before sharing. Each download has a version; recipients
  choose when to replace an installed tool.
- **Start with existing artwork.** Import PDF or PDF-compatible Illustrator
  artwork, choose pages, inspect the conversion, resolve missing fonts and select
  editable objects. Outlined or flattened content can be replaced with a text or
  image input while the surrounding artwork stays fixed. Compare against the
  source before sharing; conversion is not a guarantee of exact source fidelity.
- **Navigate a complete document in Layers.** Artboards are collapsible parent
  groups with their own layers. Jump to an artboard, select and reorder its
  objects, or switch to Pages for thumbnails and page ordering.
- **A clearer Design inspector.** Text and image controls lead when those objects
  are selected. Options use compact chips and shared design-system tokens.
  Advanced styling stays in a disclosure. On phones, the same controls open in
  an inspector sheet with keyboard focus and Escape/Back dismissal.
- **The web app opens at the right size on phones.** Signed web builds retain
  their mobile viewport settings, fixing the zoomed-out layout in Safari and
  other mobile browsers. Browser pinch zoom remains available.
- **Scroll long sequences in both directions.** Track scrolling stays inside the
  timeline, works with wheel, touch background and keyboard, and retains both
  scroll positions when tracks rebuild.
- **Richer course authoring.** Add formatted lesson text and practice quizzes,
  organize several content blocks together, and assemble a course from project
  folders. Website and SCORM packages carry the selected design system. Learner
  preview and preflight check the result before a versioned download; acceptance
  testing in customer LMS tenants remains pending.
- **Clearer collaboration and history.** Shared cursors show where collaborators
  are working. History gains timeline navigation and filtering. Configured Lolly
  Work deployments retain collaboration acknowledgements and journals for recovery.
- **Shorter, task-focused creator guides.** Tool authoring, rendering, inputs,
  composition, publishing, CLI, URL mode and build guidance have their own pages.
  Read [Create a tool](https://lolly.tools/info/create/create-a-tool.html) and
  [Training creators](https://lolly.tools/info/create/training-creators.html) for
  the workflows used by design, training and enablement teams.

The first restricted-tool release produces still PNG, SVG and PDF outputs.
Motion output, simultaneous export of several artboards, and recipient rebranding
are not included. Source tools that require live media, remote state, nested tools
or custom file exports are refused during preparation.

### New in 1.0.7

- **Emoji are drawn from a set you choose, not from the device.** Pick an emoji set once
  and every tool draws the same artwork, so a heading looks the same on a Mac, a phone and
  a server render, and an export carries the picture rather than a system glyph. Three sets
  ship: Twemoji Color, OpenMoji Color and OpenMoji Black, all complete. A brand treatment
  can pull the artwork toward your palette (subtle, strong, full, mono or duotone) with skin
  tones and flags kept as they are, and the same input always produces the same bytes. A
  black set follows the surrounding text colour, the way the same artwork behaves as a font.
  The set and the treatment travel in the link, the CLI and the agent tools.

- **Source credits, and the licence that asks for them.** When a render places someone
  else's work, the export panel says what that work asks of the delivery before you
  download, and reads the delivered file back afterwards rather than assuming. Credits ride
  in the file's Content Credentials, one per source, bound to the original bytes. A licence
  that needs a decision, such as a recoloured ShareAlike set you are about to share, asks
  once and never blocks the download. Verify gained a Sources panel with a copyable credit
  and a plain statement of what it could not check, the catalog shows a work's creator and
  licence, an editable `.lolly` file carries only what a reviewed licence permits and lists
  the rest in a credits file, and removing metadata tells you which credits go with it. The
  rules are seven reviewed licences, each cited to its own legal text; NonCommercial and
  NoDerivatives are recorded and deliberately not interpreted. Lolly never says copyright is
  verified, because no program can check that.

- **Create and preview training courses.** Turn a project folder into ordered lessons with
  text, images, slides, video, audio and downloadable resources. Select content blocks,
  drag one or several into place with a mouse or touch, or reorder with the keyboard.
  Duplicate, remove and undo grouped changes; edits save automatically as you work.
  Preview as learner now opens unfinished drafts, with clear placeholders for missing
  content, while publishing still checks size, accessibility and completeness.

- **Courses carry your brand.** The course editor uses the app's shared controls and brand
  tokens. The learner view has a clear lesson outline, progress and comfortable reading
  layouts across desktop, tablet and phone. Website and LMS packages preserve the course's
  colours, fonts and font licences with that version, so a later brand change cannot alter
  an existing delivery. Website progress stays in the learner's browser; an LMS records
  completion for an LMS package. No account is needed to build a course.

- **Clearer controls on smaller screens.** Utilities favourites keep their icons centred,
  larger and fully visible, with cards sized to fit tablets and phones. Buttons choose
  readable text against the active brand colour, and learning controls retain visible
  keyboard focus and comfortable touch targets.

- **Projects, templates and recovering a download.** The Projects root gained a templates
  tile and a toolbar, saving your own template is a first-class action, and a download that
  fails is offered again rather than lost. The Prepare view was rebuilt around the same
  panels as the rest of the app.

- **On-device PDF and document utilities.** New brand-agnostic tools join the on-device
  set: split, merge, reorder and rotate pages; trim a file to a range; sign a PDF; clean a
  document; and redact text and regions. Like the other utilities they run locally - bytes
  in, bytes out, nothing uploaded. The engine gained shared file-operation and PDF
  organise/stamp host APIs so every shell drives them the same way.

- **One honest `.lolly` intake.** The manifest now decides whether a file opens as a shared
  design, adds a separate design system or installs a brand workspace, however it arrived -
  Open, drag and drop, Profile, Brand Studio or the operating system. The app reads the
  small manifest before expanding the bundle, reports its size and contents, warns for large
  files and low storage, then performs one integrity-checked read after you confirm.
  Cancelling a picker creates nothing, an import never overwrites the active system, and a
  failed import removes the destination it just created. The share receipt names embedded
  files and external references.

- **Signed tool catalogs now load in the desktop and mobile apps.** A content-security-policy
  change had made signed tools fail their integrity check inside the packaged apps, so no
  tool would open; the web app was unaffected. The apps now serve the same
  signature-verified catalog as the web, and every tool opens.

- **The desktop CLI travels with the app.** Linux packages include its complete runtime
  and resources. macOS signing preserves the runtime permission it needs, and Flatpak
  packaging preserves the embedded executable so command-line tools start correctly.

- **Automatic local history.** A tool can keep an on-device revision history of your work and
  reopen an earlier version, all stored locally. Asset versions can be pinned, so a shared
  link reopens the exact version and format it was made with rather than silently taking a
  newer one; the pin travels in the URL.

- **Design round-trip to Penpot.** An exported `.penpot` file now carries live token
  bindings, native components and the active theme. Editing a bound token in Penpot repaints
  the shape, and a mistyped binding degrades to the painted value instead of refusing the
  import.

- **A components library and a colour studio.** A browsable component reference for
  developers (`#/components`) shows each block with its import, classes, markup, tokens and
  copy, alongside live specimens. The colour studio treats the palette as a workspace - add,
  name, group and bulk-edit swatches with reversible actions - and a colour field opens a
  perceptual OKLCH Colour Lab (`#/lab`), with everyday HSL still the default.

- **A packaged agent skill.** Lolly ships a first-class agent skill (catalog, render path and
  worked examples) so an AI agent can be taught the platform directly, alongside the existing
  MCP server.

- **Self-hosting via YunoHost.** Lolly packages as a YunoHost app, so you can install a
  ready-to-go instance on your own server.

- **Repeating inputs as a table.** Flat block inputs can present as a compact table editor;
  the same data still edits as blocks on shells without it, and URL encoding is unchanged.

- **Under the hood.** The largest web views were restructured into feature modules and the
  shared engine trimmed, with layering and type-safety checks added. The project is now one
  repository instead of eleven, so a checkout builds and tests everything in one step. No
  tool behaviour or export changed - every tool that ran on 1.0.6 runs unchanged.

- **Engine 1.172 to 1.197.** Shared file operations, PDF organise/stamp, `.penpot` token
  bindings and components, pinned asset versions, table-column inputs, direct asset-byte reads
  for hooks, declared tool `requires`, portable text operations, visual comparison, chosen
  emoji sets with their deterministic treatments, and the creative-rights rules an export
  answers to. All additive.

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
  - **iOS**: availability depends on App Store review; signed build artifacts are prepared separately.
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
- New interface text in 1.0.8 is in English only until the next translation update.
- 3D Studio scenes saved with the first public version (0.3, on lolly.tools for one day
  before this release) can look slightly different when reopened: depth forms default to
  copies of the subject, clearcoat and imported-model materials follow the new finish
  rules, and video frames use 16 samples each instead of 64.
