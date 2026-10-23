# Automate

Build a tool once and the request stops coming back to you: the job becomes a template other people fill in themselves, correctly, without you in the loop. Your work is plain HTML, CSS and JavaScript, version-controlled and reviewable, on an open engine, so it stays yours.

New here? **[Start](/info/quickstart.html)** puts a design system and your first file in place, and [How Lolly works](/info/how-lolly-works.html) shows how a script or an agent uses the same tools as a person. The [Glossary](/info/glossary.html) defines engine, shell, bridge and tool.

## Designers

Set the rules once and keep the tools you already use. What you decide here is what every tool obeys, so a colour or a typeface is fixed in one place rather than argued about per file.

- **[Import a design](/info/design-import.html)** - a `.fig`, `.penpot`, `.ai`, `.idml` or SVG file in as an editable layout rather than a flat picture.
- **[Design System Setup](/info/brand-studio.html)** - the on-device editor for logos, colours, type and the rest of the design system (`#/start`).
- **[Design Tokens](/info/design-tokens.html)** and **[Token workflows](/info/token-workflows.html)** - the DTCG token model a design system is made of, and how it moves between tools.
- **[Authoring Assets](/info/authoring-assets.html)** - catalog assets, tiers, locales, palettes, themable icons and fonts.

## Developers

The app, the CLI and an agent all make the same file from the same inputs, because every input is a URL parameter and every surface runs one render path.

![URL parameters and command-line arguments become the same input model, run through one shared runtime and export bridge](/info/diagrams/concepts/one-render-path.svg)

**Make files from tools:**

- **[CLI](/info/cli.html)** - headless rendering over the same path as the app, driven by `--foo=bar` pairs. [TUI](/info/tui.html) is the interactive terminal shell.
- **[URL Mode](/info/url-mode.html)** - every input as a URL parameter: reserved names, compact encoding and packed links.
- **[MCP Server](/info/mcp.html)** and **[AI Agents](/info/ai-agents.html)** - the endpoint an AI agent uses to discover and run tools, and how to drive Lolly from a model.
- **[Signing from the terminal](/info/cli-signing.html)** - give CLI output a real signing identity instead of an anonymous on-device key.

**Build tools:**

- **[Authoring Tools](/info/authoring-tools.html)** - the guide: manifest, template, styles, hooks, composition and publishing.
- **[Host API](/info/host-api.html)** - the `HostV1` capability bridge every tool is written against.
- **[Browser Extension](/info/extension.html)** - capture a live web page as an asset for a tool to compose.

**How it holds together:**

- **[Lolly architecture](/info/overview.html)** - the engine, the shells, the bridge and the commitments that constrain every change.
- **[Constraints](/info/constraints.html)**, **[Determinism](/info/determinism.html)** and **[Reproducibility](/info/reproducibility.html)** - why output comes out right, what is byte-for-byte repeatable and how far a bare link carries.
- **[Data Transfer](/info/data-transfer.html)** - the `lolly-backup` bundle: envelope, integrity and the cross-shell guarantees.

## Lolly Work automation

When your organisation runs Lolly Work, automation can run on its server, under its sign-in and policy.

- **[Organisation jobs](/info/cli-automation.html#organisation-jobs-with-lolly-work)** - queued renders, batches and approved delivery through Lolly Work's API.
- **[Lolly Work API](/info/work-api.html)** and **[the `lw` CLI](/info/work-cli.html)** - manage an instance with its own authenticated permissions.
- **[Invite an agent to a document](/info/work-document-agents.html)** - give an agent scoped access to one shared document. An invitation does not grant infrastructure access.

## Build and contribute

- **[Contributing Setup](/info/contributing-setup.html)** - a development checkout sized to what you are here to do.
- **[Build Guide](/info/build-guide.html)** - build every target: CLI, TUI, desktop, mobile and the web app. [Building for iOS](/info/ios-build.html) adds Apple's extra steps.
- **[Profiles, brands and tool configuration](/info/configuration.html)** - profiles, brand packs, capability gating, feature flags and catalog validation.
- **[Threat Model & Trust Boundaries](/info/threat-model.html)** - what Lolly defends against, what it does not and where each boundary falls.

Hosting Lolly for other people lives in **[Deploy](/info/operate.html)**.
