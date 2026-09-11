# Lolly for Builders

Build a tool once and the request stops coming back to you: the job becomes a template other people fill in themselves, correctly, without you in the loop. Your work is plain HTML, CSS and JavaScript - version-controlled, diffable, reviewable and running on an open engine, so it stays yours with nothing to unwind later.

Lolly is a platform-agnostic engine that runs the same render path across several shells - the web PWA, the desktop and mobile apps, the CLI and the TUI - and tools are data rather than bundled code: a manifest, a template and optional hooks, so a new tool ships without an app update. Pick the lane below that matches what you are here to build.

You are the multiplier in the relay: a creative authors the rules and you scale them into a pipeline, a CLI batch or an MCP endpoint, so [The lifecycle of a campaign](/info/overview.html#the-lifecycle-of-a-campaign) follows one asset through all three pairs of hands.

New here? The **[Quickstart](/info/quickstart.html)** gets a brand and your first render in place before you go deep. [About](/info/about.html) names the licence boundary and the repositories each piece lives in, and [Lolly for Operators](/info/operators.html) is the door for whoever will ask you about rollout and security.

## Designers

Bring finished work in, set the rules once and keep the tools you already use. What you decide here is what every tool in the gallery obeys, so a colour or a typeface is fixed in one place rather than argued about per asset.

- **[Import a design](/info/design-import.html)** - bring a `.fig`, `.penpot`, `.ai`, `.idml` or SVG file in as an editable, re-renderable tool rather than a flat picture.
- **[The Brand Studio](/info/brand-studio.html)** - the on-device editor for logos, colours, type and the rest of the design system (`#/start`).
- **[Design Tokens](/info/design-tokens.html)** - the DTCG token model a brand is expressed in and how a tool reads it at render time.
- **[Authoring Assets](/info/authoring-assets.html)** - catalog assets, tiers, locales, palettes, themable icons and fonts.
- **[The Dashboard](/info/dashboard.html)** - your design system shown read-only, plus the capability map for the device in front of you.

## Developers

One render path behind every surface: the GUI, the CLI and an agent all produce the same file from the same inputs. A tool is a manifest, a template and optional hooks, and every input is expressible as a URL parameter, which is why a link and a command line are the same thing here.

- **[Architecture](/info/overview.html)** - why Lolly exists, the engine/shell/tool separation and the commitments that hold it together.
- **[Authoring Tools](/info/authoring-tools.html)** - the full guide: manifest, template, styles, hooks, composition and publishing.
- **[Host API](/info/host-api.html)** - the `HostV1` capability bridge every tool is written against, plus the note that hooks are not a sandbox.
- **[URL Mode](/info/url-mode.html)** - every input as a URL parameter: reserved params, compact encoding and packed links.
- **[Constraints](/info/constraints.html)** - why output comes out right by construction, with the tests that enforce each rule.
- **[Determinism](/info/determinism.html)** - same inputs, same file: what is byte-reproducible and what is not.
- **[Reproducibility](/info/reproducibility.html)** - the URL as the artifact, and how far a bare link can carry.
- **[CLI](/info/cli.html)** - headless rendering over the same path as the GUI, driven by `--foo=bar` argv pairs.
- **[Signing from the terminal](/info/cli-signing.html)** - give CLI output a real signing identity instead of an anonymous on-device key.
- **[TUI](/info/tui.html)** - the interactive terminal shell, for when a pipeline needs a human in it.
- **[MCP Server](/info/mcp.html)** - the native endpoint an AI agent uses to discover and run tools.
- **[AI Agents](/info/ai-agents.html)** - driving Lolly from a model, where a URL is the API.
- **[Browser Extension](/info/extension.html)** - capture a live URL as a reusable asset for a tool to compose.
- **[Content Credentials Identity](/info/content-credentials-identity.html)** - CA-issued signing for on-device C2PA, with the engine contracts behind what an export carries.

## Infrastructure

A static host is the easy path and an air-gapped install is the same install. Nothing in the render path needs a server, so what you are deploying is files, not a service to keep alive.

- **[Deployment](/info/deployment.html)** - the web app, the packaged apps and the two optional services: where each piece runs.
- **[Configuration](/info/configuration.html)** - profiles, brand packs, capability gating, feature flags and catalog validation.
- **[Build Guide](/info/build-guide.html)** - build every target: CLI, TUI, desktop, mobile and the web PWA.
- **[Building for iOS](/info/ios-build.html)** - the extra gates Apple adds, and what a device build needs on top of the desktop one.
- **[Contributing Setup](/info/contributing-setup.html)** - a development checkout sized to what you are here to do, from a slim clone upward.
- **[Data Transfer](/info/data-transfer.html)** - the `lolly-backup` bundle: envelope, integrity and the cross-shell guarantees.
- **[Threat Model & Trust Boundaries](/info/threat-model.html)** - what Lolly defends against, what it does not and where each boundary falls, before a review asks.
