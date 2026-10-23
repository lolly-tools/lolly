# Glossary

Lolly uses a small set of words with exact meanings, and a few of them (profile, template, utility, room) also have everyday meanings that get in the way. The first half of this page is the words you meet in the app. The second half is for people who build tools or work on Lolly itself; the [architecture page](/info/overview.html) puts those words together.

## Words you will see in the app

**Design system.** Your colours, fonts, logos and a few rules, which every tool draws with. You set it up once in Design System Setup and switch between design systems in **Settings → Preferences → Design systems**. In the code the same thing is called a brand (see *Design system and brand* below).

**Design System Setup.** The part of the app where you make or change a design system, at `#/start`. Its areas are called rooms: Overview, Colours, Type, Logos, Tokens, Files and Usage & rules. "Make it yours" is its heading.

**Lolly Demo.** Lolly's own sample design system, the one lolly.tools opens with; its lead colour is green. [Meet Lolly Demo](/info/lolly-demo.html) shows the whole design system.

**Lolly Starter.** A blank, neutral design system to make your own, offered beside Lolly Demo.

**Managed design system.** A design system your build or your organisation supplies. It shows a lock and stays read-only; you can make an editable copy.

**Colourway.** One of several lead colours a design system offers, with the colour that sits on it and a partner colour, chosen per piece of work. Organisations that rotate their primary colour across pieces use colourways. A colourway combines with light and dark rather than replacing them. One colourway is canonical: work that chooses none is drawn in it, and the app's own colours (its accent, favicon and logo tint) always follow it, never the colourway of the piece on screen. See [Colourways](/info/colourways.html).

**Brand architecture.** How an organisation relates its brands to one another, from one masterbrand with coloured divisions to brands with no visible relationship. Lolly maps each arrangement onto design systems, colourways and logo identities; see [Brand architectures](/info/brand-architectures.html).

**Tool.** One kind of thing Lolly makes, such as QR Code, Chart or Certificate, with the fields you fill in. The tool holds the layout and rules; you supply the words, pictures or data. Design is the tool with an open canvas.

**Utility.** A tool in the `utility` category, listed in the app's **Utilities** tab (`#/u`) for one quick job, such as Strip Hidden Data, Scan or Countdown. Many utilities are *on-device*: they take your own file in and give a file back without uploading anything (strip data, compress a PDF, convert an image). The engine never watermarks an on-device tool's output or adds Content Credentials to it; Sign and Rondocode write a credential through their own export code.

**Utility view.** A workbench built into the app with no manifest, such as Compare or Verify & Inspect, with a card in the same Utilities tab (see [Utilities](/info/utilities.html)). Neither word is a loose name for any tool.

**Saved session.** One tool with its inputs, saved with **Save** or **Save as** and listed in **Projects**. It stays in the browser or app you saved it in, unless you turn on Sync.

**Project.** The Projects view groups saved sessions, renders and imported files for one piece of work.

**Template.** A saved session promoted to a starting point, offered in that tool's "New from template" chooser and deep-linkable as `?template=<id>`. This is not the Handlebars template a tool is written with (see *Template, in a tool* below).

**Share link.** A link that carries a tool's inputs and settings, so it reopens the same work on any device. Files you uploaded do not fit in a link; they travel in a `.lolly` file.

**`.lolly` file.** One file holding a design, the images it uses and, if you choose, the tool itself. Lolly also uses a `.lolly` file to pass on a tool made with **Share with rules**, and an organisation can send one that connects the app to its instance.

**Batch.** Making one tool many times from a table of values, one file per row, at `#/batch`. **Multi-edit** (`#/multi`) is different: one person editing several saved sessions at once.

**Collab.** Live editing by several people. A *private collab* is direct, device to device, with no server; a *work collab* runs through an organisation's Lolly Work instance. Two Ls, not "colab", and a collab is never called a room (rooms are the areas of Design System Setup).

**Settings.** Everything about the app on this device, at `#/settings`: **Preferences**, **This device**, **Design system**, **Capabilities** and **Activity & stats**.

**Available offline.** The download manager in **Settings → Preferences** that fetches fonts, shaping code and on-device models ahead of time, so a tool needs no network afterwards.

**Export.** Turning what a tool shows into a file in a format you choose, such as PNG, PDF or SVG. Physical sizes (`mm`, `in`, `pt`) and `dpi` are worked out per format at export time.

**Content Credentials.** The signed record (C2PA) a file can carry, stating who made it and with what. Authoring tools turn credentials on by default unless their manifest opts out, and you can turn them off for an export. Inputs are recorded as fingerprints, not their values, and your name goes in only if you opt in. See [Content Credentials](/info/content-credentials-identity.html).

**Imprint.** An invisible mark Lolly seals into an image's pixels, on by default for raster exports. It can survive a re-save or a metadata strip that removes the credential, so it is a hint that a file came from Lolly, not a cryptographic guarantee.

**Watermark.** The visible mark an experimental tool puts on its exports. The app always adds the mark; code that calls the export directly can turn the mark off. Not the same thing as Content Credentials or the Imprint.

**Lolly Work.** The organisation server of the Lolly project: sign-in, shared projects and assets, approvals, server rendering and audit records, on a server the organisation runs. **lolly.work** is the domain of its hosted demo, not the software.

**Instance.** A Lolly that serves its own tools and design systems from its own address, such as your organisation's. **Settings → Lolly instance** connects the app to one.

## Words for builders

These words matter when you build tools, run Lolly or read the code. The diagram shows how the first four fit together.

![Tools supply a manifest, template and hooks to the shared engine. Web, Tauri and terminal shells implement the HostV1 capability bridge and read tools and assets from catalogs.](/info/diagrams/concepts/platform-layers.svg)

### The platform

**Engine.** The platform-agnostic core in `engine/`. It loads a tool, builds the input model, resolves assets, runs hooks, fills the template and drives export. It knows nothing about the DOM, storage, networking or any brand. Its version (`ENGINE_VERSION`) is the contract version tools declare a range against.

**Shell.** A host that runs the engine on one platform: the web PWA, the Tauri desktop and mobile apps, the CLI and the TUI. A shell supplies the capability bridge and renders the input model as controls. Every shell runs the same render path.

**Capability bridge, or host.** The versioned API a shell hands to the engine and to tools, typed as `HostV1`. A tool calls `host.export`, `host.state`, `host.text` and so on, never the platform directly. Required parts are always present; optional parts are added in minor versions and never removed. It is the supported way in, not an enforced wall: see [Host API](/info/host-api.html).

**Tool, as files.** A directory in a content pack (`community/<id>/`, or `brands/<name>/tools/<id>/`) holding a manifest, a template and optional hooks, styles and local assets. Tools are data, not bundled code: they sync to clients, so a new tool ships without an app update. A tool's `id` is permanent.

**Manifest.** The tool's `tool.json`, validated against `schemas/tool.schema.json`. It declares the inputs, the engine version range, status, capabilities and export options. Inputs are declared here, never inferred from the template.

**Template, in a tool.** The tool's `template.html`, written in Handlebars and kept logic-less so non-developers can author templates. Different from a user's saved template above.

**Hooks.** The tool's optional `hooks.js`, the imperative escape hatch. Hooks return a plain object: keys that match a declared input update that input, and every other key goes into `extras`, values the template can read without a user-facing control. They run with the host bridge injected and are time-boxed per hook; [Tool hooks](/info/tool-hooks.html) has the rules.

**Input model.** The single source of truth for what an input means, built by the engine from the manifest. Shells render it generically and never interpret manifest fields themselves, which is how web, desktop and CLI stay consistent.

**URL mode.** Every input is expressible as a URL parameter, so a link is a finished asset and a repeatable render. The CLI is URL mode over a different transport: `--foo=bar` on the command line is `?foo=bar` in the browser. A short list of parameter names is reserved for the engine (`format`, `width`, `dpi`, `c2pa` and others) and cannot be input ids; [Reserved URL parameters](/info/url-parameters.html) lists them.

**Capabilities and requires.** Two different manifest lists. `capabilities` lists the device abilities the tool needs (camera, microphone, screen). `requires` lists the optional host APIs the hooks call without checking first; a host that lacks one refuses to mount the tool and the gallery greys it out.

**Status.** A tool is `official`, `community` or `experimental`. Status drives gallery sorting and approval messaging. Experimental tools watermark their exports by default; on-device tools are exempt.

**Isolate.** A manifest flag (`isolate: true`) meaning the tool's hooks may run in a Worker rather than in the page. A script sets it from evidence, not by hand: the hooks use no page-bound globals and the render is byte-identical in both executors.

**Compose.** One tool rendering another tool inside itself, either authored in the manifest (`composes`) or at run time when a user pastes a Lolly tool link into an asset picker and it becomes an image.

**Design-generated tool.** An ordinary tool compiled from a Design document through **Share with rules**. Its public inputs describe the changes recipients may make, and the rest of its artwork is fixed through the supported tool interface. The `.lolly` tool file carries its dependencies and no saved session. See [Share a design with rules](/info/create-a-tool.html).

### Content and catalogs

**Community tools.** The brand-agnostic tools in `community/`, a directory of this public repository. They draw with whatever design system is active.

**Brand pack.** A directory under `brands/` carrying one brand's catalog and, optionally, its own tools. `brands/lolly-demo/` is Lolly Demo, the design system lolly.tools runs; `brands/lolly-start/` is the blank, neutral pack a public clone opens with by default; `brands/suse/` is private. In user-facing copy the preferred word is *design system*.

**Content profile, or profile.** An entry in `profiles.json` naming which tool roots and which catalog to mount, for example `lolly-demo`, `lolly-start` or `suse`. A profile is resolved per process, by `LOLLY_PROFILE=<name>` or `--profile=<name>` on a catalog script, and nothing switches it globally. Not the user profile (name, theme, accessibility preferences), which is the `Profile` record a shell stores on the device.

**Catalog.** The registry of assets and tools a profile mounts: `catalog/assets/` with checksums, tokens and fonts, and the generated `catalog/tools/index.json`. The gallery reads the generated index, and the validator fails the build if it drifts from the manifests.

**Asset.** A catalogued file (logo, palette, font, photo, music) with a permanent id such as `lolly/logo/primary`. Ids are never renamed or reused; versions live in metadata. A user's own uploads join the on-device catalog the same way.

**Design tokens.** The DTCG-format values a design system is made of: colours, type, spacing, gradients. Tools read them through `host.tokens`, and community tools take their look from them. Importable from DTCG, Tokens Studio and Penpot files.

**Theme group.** One choice a design system offers, such as light or dark, or roomy or compact. Each option turns on token sets, and a piece of work picks one option per group. A group can say what kind of choice it is: `mode` for light and dark, `colourway` for the lead colour and a few more. A group that says nothing behaves as a plain choice.

**Design system and brand.** The same thing seen from two sides. User-facing copy says *design system* because people who do not think of themselves as a brand use Lolly too. Code contracts keep the word brand (`brands/`, `brand-*.ts`, `--brand-*`).

**Materialized root.** A real `tools/` and `catalog/` pair written out of the packs by `materializeInto`, for the places that serve those two paths over HTTP: a `dist/` build, an RPM payload, a container image, the desktop app's exported content root. A checkout has neither directory; every script and shell asks `packages/node-shell/src/content-roots.ts` where a tool and the catalog are instead. Not a UI view, which is a route in the web shell such as the gallery or a tool page.

**Ship gate.** The maintainer's pre-deploy run: typecheck, tests, catalog validation, docs screenshots and bundle budgets. Also known as `loldev gtg` (good to go).
