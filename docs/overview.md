# Lolly architecture

![Lolly Icon - Large green and white lollipop candy](/info/icon.svg)

This page is for people changing Lolly's code: how the engine, the shells and the tool packs fit together, where each lives in the repository, and the commitments that constrain every change. If you want to know what Lolly does and who uses it, read [How Lolly works](/info/how-lolly-works.html) first.

Two companions go deeper. [`engine/README.md`](../engine/README.md) is the module-by-module map of the engine, generated from the code. [Threat Model & Trust Boundaries](/info/threat-model.html) reads the same architecture as trust boundaries, and it is the page for any question about what the engine treats as untrusted.

## The big picture

Tools are data at the top. The engine in the middle knows nothing of any platform. The shells at the bottom implement one contract, and the catalogs supply the content.

![Tools supply a manifest, template and hooks to the shared engine. Web, Tauri and terminal shells implement the HostV1 capability bridge and read tools and assets from catalogs.](/info/diagrams/concepts/platform-layers.svg)

If you can describe it in pure data and Handlebars, it belongs in the **engine**. If it touches the DOM, the filesystem, the network or any browser or operating-system API, it belongs in the **host**, the shell's side of the bridge. The engine is open source, and nothing that knows about a particular brand or platform goes into the engine.

## Repository layout

Lolly is one repository. Every directory below is a plain directory in it, except `brands/suse`, a **private** git submodule holding the SUSE tool pack and catalog, which a public clone does not fetch. Which packs a build reads is a content profile (`profiles.json`), resolved per process rather than switched globally. [Build Guide](/info/build-guide.html) has the clone command and how a change inside the private pack is committed.

| Directory | What it holds |
|---|---|
| `engine/` | The platform-agnostic core: loader, runtime, inputs, templates, URL mode, units and the format modules |
| `shells/` | The web app, the Tauri desktop and mobile apps, the CLI, the TUI and the browser extension |
| `packages/` | The tool-author SDK (`@lolly-tools/core`), the shared Node shell pieces and the docs renderer, among others |
| `community/` | The brand-agnostic tools, plus the shared emoji packs |
| `brands/` | Brand packs: `lolly-demo` (Lolly Demo, the design system lolly.tools runs), `lolly-start` (the blank starter) and the private `suse` |
| `services/` | The optional MCP, certificate and Penpot services, and the server code they share |
| `schemas/` | JSON Schema for tool manifests, asset entries and asset references |
| `scripts/`, `tests/`, `docs/`, `api/` | Build and catalog scripts, the engine test suite, these docs and the generated serverless bundles |

::: details The engine and shell files you meet first
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

There is no repository-root `tools/` or `catalog/` directory. `packages/node-shell/src/content-roots.ts` answers "where does tool `<id>` live" and "where is the catalog" from `profiles.json` when asked. A real `tools/` and `catalog/` pair is written only into a build output, such as `dist/`, an RPM payload or a container image, because a browser fetches those two paths over HTTP.

## Where Lolly runs

Every surface uses the same engine and the same tool files.

- **The web app.** A progressive web app that works offline once its service worker has cached the tools and assets. It needs no account; state lives in IndexedDB on each device. One responsive layout serves desktop and phone: on a phone the controls become a sheet and the export controls open from a floating pill.
- **The desktop and mobile apps.** Tauri packages of the same web app, with native file dialogs, filesystem state and full offline use.
- **The CLI.** `lolly <tool-id> --input=value --output=file.png` loads the same engine in a headless DOM and writes the file. It is URL mode over a different transport, not a separate implementation. See [CLI](/info/cli.html).
- **The TUI.** A full-screen, keyboard-first terminal app that reuses the CLI's bridge, keeps saved sessions on disk (in the desktop app's own folder when the app is installed, otherwise under `~/.lolly`) and starts a scoped headless browser only when a format needs one. See [TUI](/info/tui.html).

![The desktop split view: controls generated from the manifest on the left, the live canvas on the right](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

The same tool at phone width needs no second layout: the controls become a sheet at the top and the preview holds the screen.

![An audiogram on a 430px-wide screen: the controls sheet above, the finished square artwork below and the floating export pill](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

The web app also ships **Batch** (`#/batch`, `shells/web/src/pro/`), a spreadsheet-style grid that renders many rows at once across one or many tools; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) covers Batch. **Settings → Capabilities** maps everything the platform declares it can do.

![Batch on a fresh install: one empty row waiting for a tool, with the spreadsheet surface and its Render button in place before any data arrives](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Architectural commitments

These decisions are settled. Changing any of them is a major undertaking, because they shape every other decision in the codebase.

### 1. Declarative tools, with an imperative escape hatch

A tool is a manifest (`tool.json`), a template (`template.html`) and optional `hooks.js`. **The manifest declares the inputs**, never the template: inputs are not inferred from Handlebars tokens. Most tools are manifest and template alone, which is what lets non-developers author them.

![Street Map's control stack: a city dropdown, a theme select, weight sliders and colour triggers, every one drawn from a manifest line](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Tools that compute values, such as QR encoding or chart shaping, add hooks: named lifecycle functions the runtime calls with the capability bridge injected. Hooks are a portability contract, not a security sandbox, and they run within a time budget. Tools whose hooks are proven free of page globals carry `isolate: true` and run in a Worker. [Tool hooks](/info/tool-hooks.html) has the lifecycle and budgets, and the [Threat Model](/info/threat-model.html) says what the in-page executor does and does not contain.

### 2. Tools and assets are data, not bundled code

The web and Tauri apps fetch the tool and asset catalogs at boot, cache them and work with whatever is there, so a new tool or asset needs no app release. Asset bytes are SHA-256 checksummed, and an asset's `id` and `version` drive cache invalidation.

### 3. The capability bridge is the only API tools see

Tools never touch the DOM outside their template, never call `fetch` directly and never read the filesystem. They call versioned `host.*` methods. The contract's canonical definition is `packages/core/src/host-v1.ts`, the tool-author SDK `@lolly-tools/core`, so a third party can build against it without depending on the engine; `engine/src/bridge/host-v1.ts` re-exports its types.

| Required API | What it does |
|---|---|
| `host.profile` | The user's details; pre-fills inputs through `bindToProfile` |
| `host.assets` | Catalog queries, asset resolution and the host's picker |
| `host.state` | Save and load input slots: IndexedDB on the web, the filesystem in Tauri, memory in the CLI |
| `host.clipboard` | Write text or an image to the clipboard, with platform fallbacks |
| `host.export` | Rasterise or serialise the render target, and the on-device file transform path |
| `host.log` | Leveled logging to the host |

Every other API is optional and additive: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` and many more. A tool's manifest lists under `requires` the optional APIs its hooks call without checking first, and a host that lacks one refuses to mount the tool; hooks feature-detect the rest. A few, such as `recorder`, also need a device capability the tool declares. `packages/core/src/host-v1/apis.ts` lists them all and [Host API](/info/host-api.html) documents each one. Adding a method is a minor version; removing or changing one is a major version, and v1 keeps working when v2 ships.

### 4. Asset ids are forever

`lolly/logo/primary` is a contract. Once published, an id never changes and is never reused. A byte change bumps `version` in the asset entry, and a replacement sets `deprecated: true` and, optionally, `replacedBy`, so existing references always resolve. That is what keeps saved sessions and shared links working for years.

### 5. URL mode is first-class

Every input is expressible as a URL parameter, so a link is a finished file:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![That link on its own, with nothing else in it, is the finished file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Change a parameter and you have a different file. This whole palette is one seed colour, a harmony and a step count:

![Nine steps across four hues, all grown from the single seed colour carried in the link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

The CLI builds the same URL state from its arguments and runs the same pipeline, so the CLI cannot drift from the app. `engine/src/url-mode.ts` parses and serialises; a set of reserved names (`format`, `width`, `dpi`, `c2pa`, `z` and others) is never passed to a tool, and [Reserved URL parameters](/info/url-parameters.html) lists them all. Asset inputs travel by `id` and resolve through `host.assets.get()` before the template fills.

### 6. Storage goes through the bridge

The web app uses IndexedDB, Tauri the filesystem and the CLI memory. Tools see only `host.state.save(slot, data)` and `host.state.load(slot)`, never `localStorage`. People can keep several named sessions per tool with no account. Because the bridge is the only seam, that state is also portable: `shells/web/src/data-transfer.ts` reads it back out into one `lolly-backup` file that imports on any other install ([Data transfer](/info/data-transfer.html)), and [Sync](/info/sync.html) sends the same bundle to storage the person chooses.

### 7. Maturity tags say what a tool is

Every tool declares `status: official | community | experimental`. The gallery sorts by status, and experimental tools watermark their exports by default: the runtime turns the watermark on unless the caller passes `watermark: false`, and on-device tools are exempt. Whatever process a team puts around the catalog sits on top of this.

### 8. Inputs are typed in the manifest

An input declares a `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` or `file`. The host renders a control per type, so tools write no control code, and any input can carry `bindToProfile`. Three carry the most weight:

- **`asset`**, with `filter` and `allowUpload`, is the bridge to the asset system. `allowUpload: false` limits a slot to library assets, and user uploads share the library's `AssetRef` shape.
- **`blocks`** is a repeating field group edited in a side panel, used by Meeting Planner, Wayfinding, Diagrams and others. Clicking a rendered block focuses its row.
- **`file`** holds the user's own file in memory for on-device utilities such as Strip Hidden Data and Compress, and **`vector`** groups a fixed set of numbers into one control.

### 9. Templates are logic-less

Templates are Handlebars, chosen so non-developers can write them: `{{x}}` escapes, and `{{{x}}}` is an explicit opt-in. Logic lives in `hooks.js`, where it is explicit and reviewable. Many templates use `{{{` for markup a hook computed, so each hook must escape what it hands over. The helpers are `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` and `media`, plus `icsStamp`, `rfcText`, `csvCell` and `arrow` for sibling `.ics`, `.vcf` and `.csv` templates. [Templates and rendering](/info/tool-rendering.html) covers them.

### 10. Tools compose tools

A tool can embed another tool's render with no tool-to-tool imports; the engine resolves the composition. A manifest can declare `composes: [{ id, tool, inputs }]` and place the child with `{{asset <id>}}`, and a portable embed URL (`https://lolly.tools/tool/<id>.svg?…`) renders the child locally, which is how Design places a live QR code or chart. An SVG child stays vector in an SVG or PDF parent. Children are intermediates, never watermarked or stamped, and a shell that cannot render one leaves the slot empty while the parent still renders. [Composition and brand overlays](/info/tool-composition.html) has the details.

## What we chose not to do

- **No arbitrary JavaScript in templates.** Logic lives in `hooks.js`.
- **No mandatory asset server.** People add their own files to Assets in the app and hand work on as a session: a share link for inputs and settings, a `.lolly` file when uploads travel too. A shared session can become a template in a tool's chooser. An organisation that wants a governed catalog can use Lolly Work's catalogue, approvals and policies, or manage the brand pack in git and review changes there.
- **No forced access control.** The open app is public by default, and maturity tags and watermarks carry the brand risk. Organisation sign-in, roles and policy come from Lolly Work when a team wants them.
- **No central database.** User state lives on each device, and optional Sync copies it to storage the person chooses, never to a Lolly database.
- **No shared code path between tools and the engine.** The engine and the community tools are open source, and a brand pack such as the private `brands/suse/` carries its own tools and catalog under its own terms. No tool imports from `engine/`, so the split stays clean.

## The lifecycle of one render

Someone opens `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Boot.** The web app opens IndexedDB, builds the capability bridge and syncs the tool and asset catalogs, or loads them from cache when offline.
2. **Route.** The path selects the tool view for `qr-code`, with the query as its initial values.
3. **Load.** `loadTool` fetches `tool.json`, validates it against the schema and fetches the template, styles and hooks.
4. **Parse the link.** `parseUrlState` turns the parameters into input values. An asset reference such as `?logo=lolly/logo/primary` becomes an unresolved `{ id }`.
5. **Start the runtime.** `createRuntime(tool, host, initialValues)` builds the input model from profile data, defaults and the link, resolves asset references, loads the hooks and calls `onInit`.
6. **Render.** The shell subscribes to the runtime, draws the controls from the model and writes the filled template into `#tool-canvas`.
7. **Interact.** Typing calls `runtime.setInput`, which applies constraints, calls `onInput`, fills the template again and redraws.
8. **Export.** **Download** calls `runtime.export(node, format)`, and the shell's `host.export` produces the file: a raster, a vector from the DOM walker, a PDF, a document or one of the other formats in `schemas/tool.schema.json`. Physical units are converted per format, and metadata and Content Credentials are embedded where the format can hold them. Experimental tools get their watermark from the host, not the tool. [Templates and rendering](/info/tool-rendering.html) and [Export a file](/info/exporting.html) cover the export step.

![The export panel that ?options opens: the filename and format pair, the output size and the controls that write the file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

The same lifecycle runs in Tauri, and in the CLI with a headless DOM, where the output goes to a file or stdout.

## Licences

Code, including `engine/`, `shells/`, `services/`, `schemas/` and the documentation generator, is MPL-2.0, in one public repository, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Documentation prose is CC BY-SA 4.0. Brand packs carry their own terms in each pack's `NOTICE.md`: the community tools are MPL-2.0, and the private SUSE pack is proprietary to SUSE. [About](/info/about.html) has the full licensing note.
