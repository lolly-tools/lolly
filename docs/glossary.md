# Glossary

Lolly uses a small set of words with exact meanings, and a few of them (profile, template, view, pack) also have everyday meanings that get in the way. This page is the list to read before the [architecture page](/info/build/overview.html) or the repository's `CLAUDE.md`. Each entry says what the word means here, where it lives in the code, and what it is not.

## The platform

**Engine.** The platform-agnostic core in `engine/`. It loads a tool, builds the input model, resolves assets, runs hooks, fills the template and drives export. It knows nothing about the DOM, storage, networking or any brand. Its version (`ENGINE_VERSION`) is the contract version tools declare a range against.

**Shell.** A host that runs the engine on one platform: the web PWA, the Tauri desktop and mobile apps, the CLI and the TUI. A shell's job is to supply the capability bridge and to render the input model as controls. Every shell runs the same render path, so a file made in the terminal matches the one made in the browser.

**Capability bridge, or host.** The versioned API a shell hands to the engine and to tools, typed as `HostV1`. A tool calls `host.export`, `host.state`, `host.text` and so on, never the platform directly. Required parts are always present; optional parts are added in minor versions and never removed. Not a sandbox: it is the supported way in, not an enforced wall.

**Tool.** A directory under `tools/<id>/` holding a manifest, a template and optional hooks, styles, a thumbnail and local assets. Tools are data, not bundled code: they sync to clients, so a new tool ships without an app update. A tool's `id` is permanent.

**Manifest.** The tool's `tool.json`, validated against `schemas/tool.schema.json`. It declares the inputs, the engine version range, status, capabilities and export options. Inputs are declared here, never inferred from the template.

**Template.** The tool's `template.html`, written in Handlebars and kept logic-less so non-developers can author it. Note the second meaning below under *user template*.

**Hooks.** The tool's optional `hooks.js`, the imperative escape hatch. Hooks return a plain object: keys that match a declared input update that input, and every other key goes into `extras`, values the template can read without a user-facing control. They run with the host bridge injected and are time-boxed per hook.

**Input model.** The single source of truth for what an input means, built by the engine from the manifest. Shells render it generically and never interpret manifest fields themselves. That is how web, desktop and CLI stay consistent.

**URL mode.** Every input is expressible as a URL parameter, so a link is a finished asset and a reproducible render. The CLI is URL mode over a different transport: `--foo=bar` on the command line is `?foo=bar` in the browser. A short list of parameter names is reserved for the engine (`format`, `width`, `dpi`, `c2pa` and others) and cannot be input ids.

**Capabilities and requires.** Two different manifest lists. `capabilities` names device abilities the tool needs (camera, microphone, screen). `requires` names the optional host APIs the hooks call without checking first; a host that lacks one refuses to mount the tool and the gallery greys it out.

**Status.** A tool is `official`, `community` or `experimental`. Status drives gallery sorting and approval messaging. Experimental tools watermark their exports by default; on-device tools are exempt.

**Isolate.** A manifest flag (`isolate: true`) meaning the tool's hooks may run in a Worker rather than in the page. Set from evidence by a script, not by hand: the hooks use no page-bound globals and the render is byte-identical in both executors.

**Compose.** One tool rendering another tool inside itself, either authored in the manifest (`composes`) or at run time when a user pastes a Lolly tool link into an asset picker and it becomes an image.

## Content

**Community tools.** The brand-agnostic tools in `community/`, a public repository. They inherit whatever design system is active.

**Brand pack.** A directory under `brands/` carrying one brand's own tools and its catalog. `brands/suse/` is private; `brands/lolly-start/` is the blank, neutral pack a public clone uses. In user-facing copy the preferred word is *design system*; "brand" is used only where a brand is the subject.

**Content profile, or profile.** An entry in `profiles.json` naming which tool roots and which catalog to mount, for example `suse` or `lolly-start`. Switching profiles rebuilds the views below. Not the user profile (name, theme, accessibility preferences), which is the `Profile` record a shell stores on the device.

**View.** The two gitignored directories at the repository root, `tools/` and `catalog/`, assembled from the community tools plus the active brand pack. Every script and shell reads these two paths and never a pack directly. Never commit them. Not a UI view, which is a route in the web shell such as the gallery or a tool page.

**Catalog.** The registry of assets and tools a profile mounts: `catalog/assets/` with checksums, tokens and fonts, and the generated `catalog/tools/index.json`. The gallery reads the generated index, and the validator fails the build if it drifts from the manifests.

**Asset.** A catalogued file (logo, palette, font, photo, music) with a permanent id such as `suse/logo/primary`. Ids are never renamed or reused; versions live in metadata. A user's own uploads join the on-device catalog the same way.

**Design tokens.** The DTCG-format values a design system is made of: colours, type, spacing, gradients. Tools read them through `host.tokens`, and community tools take their look from them. Importable from DTCG, Tokens Studio and Penpot files.

**Design system vs brand.** The same thing seen from two sides. User-facing copy says *design system* because people who do not think of themselves as a brand use Lolly too. Code contracts keep the word brand (`brands/`, `brand-*.ts`, `--brand-*`).

## Sessions and editing

**Saved tool session.** The persisted state of one tool with its inputs, kept in the shell's storage and listed under Projects. A share link carries the whole session.

**User template.** A saved tool session promoted to a starting point, offered in that tool's "New from template" chooser and deep-linkable as `?template=<id>`. Different from the Handlebars template above.

**Utility.** A specific kind of tool: an on-device transform that takes the user's own file in and gives bytes out (strip data, compress a PDF, convert an image). Utilities never watermark and never embed provenance. Not a loose word for any tool.

**Batch.** Rendering one tool many times from a table of values, at `#/batch`. **Multi-edit** (`#/multi`) is different: one person editing several saved sessions at once.

**Collab.** Live multi-user editing. A *work collab* runs through an organisation's instance; a *private collab* is direct, device to device, with no server. Two Ls; not "colab", and never "rooms".

**Project.** The Projects view groups saved tool sessions, renders and imported files for one piece of work.

## Output and trust

**Export.** Turning a render into a file in a chosen format, through `host.export`. Physical units (`mm`, `in`, `pt`) and `dpi` are resolved at export time, per format, by the engine.

**Content Credentials.** The C2PA provenance record a file can carry, stating who made it and with what. Opt-in per export through the `c2pa` parameter; nothing is embedded by default, and a utility never embeds one.

**Watermark.** The visible mark experimental tools put on exports unless the caller turns it off. Not the same thing as Content Credentials.

**Available offline.** The download manager in the user profile that pre-fetches fonts, shaping code and on-device models, so a render needs no network at all afterwards.

**Ship gate.** The maintainer's pre-deploy run: typecheck, tests, catalog validation, docs screenshots and bundle budgets. Also known as `loldev gtg` (good to go).
