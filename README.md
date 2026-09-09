# Lolly documentation

This directory is its own repository ([`lolly-tools/lolly-docs`](https://github.com/lolly-tools)),
consumed by the [`lolly`](https://github.com/lolly-tools/lolly) monorepo as a git submodule at
`docs/`. It holds the prose documentation **and** the generator for the `/info` site
(`docs/build.ts`), which is why it only builds from within the monorepo: it reads sibling paths
such as `engine/`, `../README.md` and `shells/web/public/info/` that exist only in that layout.
Run `pnpm run build:info` from the repo root, never from here.

New contributors should start with [`CONTRIBUTING.md`](../CONTRIBUTING.md) at the repo root, which
owns the setup steps, the profile workflow and the submodule ownership table.

## How this index is grouped

The sections below mirror the **pathways** declared in `docs/build.ts`, so the index cannot drift
from the site. `build.ts` is the source of the grouping, in two structures:

- The `pages` array in `docs/build.ts` maps each markdown source to a slug, a title and a `pathway`
  (`quickstart`, `creators`, `builders`, `operators` or `trust`). A doc with no entry here gets no
  `/info` page at all.
- `SIDEBARS` in the same file is the per-pathway sidebar. A page may appear in more than one
  pathway's sidebar; its own `pathway` only decides which sidebar renders while you are reading it.
  (Cited by symbol rather than line number on purpose - the line numbers went stale within weeks.)

If you add a markdown file to this directory, register it in both structures or add it to the
"Not in the site nav" table below with the reason.

**Audience** is one of: *end user* (someone making assets), *tool author* (someone writing tools or
driving Lolly programmatically), *operator* (someone deploying, configuring or governing an
instance), *contributor* (someone changing the platform itself), *security* (someone reviewing the
security posture).

## Entry points

| Doc | Audience | What it covers |
|---|---|---|
| [site.md](site.md) | end user | Copy for the `/info` landing page. Registered as the `index` page with `isLanding: true`, so it renders as the front door rather than an article. |
| [quickstart.md](quickstart.md) | end user | The one page to read first: make Lolly wear your brand, bring in the design files and tokens you already have, then pick a pathway. Its own pathway hub. |
| [make-something.md](make-something.md) | end user | Make something in 60 seconds: three short walkthroughs (a QR code, a wordmark, a filtered photo) that need no account, no setup and no design skill. The first click for a brand-new visitor. |
| [install.md](install.md) | end user | Every packaged build in one list: the macOS disk image, the openSUSE Tumbleweed and Leap 16 RPMs, the Flatpak, the Android APK, plus Windows, iOS, the CLI and the TUI. The destination of the landing hero's download rail. |

## For Creators

| Doc | Audience | What it covers |
|---|---|---|
| [creators.md](creators.md) | end user | Pathway hub. A router: one lane per activity - make, animate, record, collaborate, post - each listing the pages that carry it. |
| [using.md](using.md) | end user | Driving the app: opening a tool, working the canvas, exporting, saving, sharing, moving to another device. |
| [brand-studio.md](brand-studio.md) | end user | The Brand Studio at `#/start`: logos, colours, type, tokens and files, plus how a brand pack moves between devices. |
| [profile.md](profile.md) | end user | Profiles as the on-device working identity a tool pre-fills from, and how they differ from the platform brand and from capabilities. |
| [search.md](search.md) | end user | The one field at the bottom of every screen: which routes carry it, what each provider reaches (tools, saved sessions, the catalogue, settings, docs), the spotlight chord, and what it deliberately does not index. |
| [ask.md](ask.md) | end user | Ask Lolly (`#/ask`): typed questions answered verbatim from this documentation with a citation and an Open-in-docs link - retrieved, never generated - plus navigate-only matches from the app. |
| [dashboard.md](dashboard.md) | end user | The Dashboard (`#/d`) and its four tabs - This device, Design system (read-only here), Capabilities and Activity & stats - with the `?tab=` deep links. |
| [utilities.md](utilities.md) | end user | The five routed workbenches - Spreadsheet, Convert, Colour Lab, Unpack, Script audio - what each does on-device, and where each one stops. |
| [favourites.md](favourites.md) | end user | Starring a tool and the strip it earns above the grid, the Gallery/Cover Flow view choice, and why the list travels with a profile export while the view mode stays on the device. |
| [design-import.md](design-import.md) | end user | Bringing a Figma, Penpot, Illustrator or InDesign file into Design as an editable session, parsed entirely on device. |
| [sequence-editor.md](sequence-editor.md) | end user | Editing in time: which clip a canvas click edits, onion-skin ghosts, split scope and Join, reversible detach audio, and trimming (pointer and keyboard). |
| [extension.md](extension.md) | end user | The Lolly URL Screenshot browser extension, which gives the web app page capture that a browser tab cannot do alone. |
| [animating.md](animating.md) | end user | Keyframes and depth: +Keyframe's two homes, the playhead-as-arm latch, the Keyframes popup and its curves, the Depth slider and Depth shadow, the scene camera and its five moves, Lift layers, Choreograph (six one-click showcases over a stack), and what a posed frame exports as. |
| [collaborate.md](collaborate.md) | end user | Two devices editing one tool session live: the invite ceremony (link, QR, code door), the matching plates that confirm the peer, presence and focus rings, beaming files across, and why it still works with no internet. |
| [formats.md](formats.md) | end user | The whole format register as one three-zone table - read-only at the left, written-only at the right, both-ways in the middle - with a plain-language card behind every chip. |
| [exporting.md](exporting.md) | end user | Choosing a format, setting output size, and the three paths that produce a file (canvas render, generated text/data, on-device transform). |
| [positioning.md](positioning.md) | end user | How Lolly compares with Canva, brand portals, Illustrator and Figma/Penpot, and where it deliberately does not play. |
| [compare.md](compare.md) | end user | The index of the tool-by-tool compare pages: what each competing tool does better, and what Lolly does instead. Dated, concession first, no superlatives. |
| [compare-canva.md](compare-canva.md) · [compare-adobe.md](compare-adobe.md) · [compare-figma.md](compare-figma.md) · [compare-render-apis.md](compare-render-apis.md) · [compare-converters.md](compare-converters.md) · [compare-penpot.md](compare-penpot.md) · [compare-brand-portals.md](compare-brand-portals.md) | end user | The per-competitor compare pages, reached from the compare index and the format-page footers rather than the top-level nav. |

## For Builders

| Doc | Audience | What it covers |
|---|---|---|
| [builders.md](builders.md) | tool author | Pathway hub. A router: three lanes - designers, developers, infrastructure - each listing the pages that carry it. |
| [overview.md](overview.md) | contributor | **The architecture document.** The three-layer separation (engine, shells, tool/brand packs), the capability-bridge boundary, the repository layout, the ten architectural commitments, and where the engine ends and the host begins. Opens with the product rationale, so use its navigation note to jump straight to the architecture. |
| [design-tokens.md](design-tokens.md) | tool author | The DTCG token model as the single source of truth for brand primitives, and what round-trips with Penpot and Tokens Studio. |
| [constraints.md](constraints.md) | end user | The constraints concept page: why output comes out right by construction, with the mechanism, the enforcing tests and the limits. |
| [determinism.md](determinism.md) | end user | The determinism concept page: same inputs, same file, one render path behind every shell, and what is byte-reproducible against what is not. |
| [reproducibility.md](reproducibility.md) | end user | The reproducibility concept page: the URL as the artifact, what travels in a link and what a bare link cannot carry. |
| [authoring-tools.md](authoring-tools.md) | tool author | The tool anatomy (`tool.json`, template, hooks), the input types, and publishing via the generated catalog index. |
| [authoring-assets.md](authoring-assets.md) | tool author | Catalog assets: the `type` enum from `schemas/asset.schema.json`, asset anatomy, versioning and the permanent-id rule. |
| [host-api.md](host-api.md) | tool author | The `HostV1` capability bridge every tool calls into, and which shell implements what. |
| [url-mode.md](url-mode.md) | tool author | Expressing any tool state as URL parameters, the reserved params, and the compact-encoding opt-ins. |
| [cli.md](cli.md) | tool author | `lolly` as URL mode under a different transport, for pipelines, CI and batch generation. |
| [tui.md](tui.md) | tool author | The interactive terminal shell: browse, fill inputs, save projects and export without a browser. |
| [mcp.md](mcp.md) | tool author | The native MCP server, its two hosted tiers, and the callable tools it exposes. |
| [ai-agents.md](ai-agents.md) | tool author | Driving Lolly from an agent by building a URL or CLI command instead of generating pixels. |
| [contributing-setup.md](contributing-setup.md) | contributor | Getting a development checkout sized to what you're here to do: slim clone personas for tool authors and engine developers, and how to upgrade to the full thing later. |
| [ios-build.md](ios-build.md) | contributor | The full iOS walkthrough for `shells/tauri-mobile`: prerequisites, one-time init, the simulator dev loop, code signing, camera permissions. Sits next to the Build Guide under Builders, which links to it. |
| [data-transfer.md](data-transfer.md) | contributor | The `lolly-backup` bundle format spec: what a bundle carries, what it deliberately does not, and the round-trip contract. Its own pathway is Builders; the Trust sidebar carries it too. |

The Builders sidebar also carries an **About** entry, which renders the repo-root
[`../README.md`](../README.md) rather than a file in this directory.

## For Operators

| Doc | Audience | What it covers |
|---|---|---|
| [operators.md](operators.md) | operator | Pathway hub. A router: one lane per function that answers for what goes out - sales, press, marketing, security, legal and AI. |
| [sales.md](sales.md) | operator | Playbook. Walk into the meeting with the file you need: fixing the deck you already have, rebuilding it natively, making the asset on the way there. |
| [press.md](press.md) | operator | Playbook. The info-editorial style built once, then live data into publication-quality charts, maps and tables for print and screen. |
| [marketing.md](marketing.md) | operator | Playbook. Every size and every language from one source: a spreadsheet in, one finished file per row, no agency bottleneck for routine files. |
| [legal.md](legal.md) | operator | Playbook. Redact, anonymise, strip metadata, compress and verify with nothing sent anywhere, plus the licence, AI-marking and data positions stated plainly. |
| [adoption-governance.md](adoption-governance.md) | operator | The honest pilot account: current status, who it is for, how adoption is measured, who governs the output. |
| [cli-signing.md](cli-signing.md) | operator | Setting up a real signing identity for the CLI, so files made from the terminal carry a verifiable name rather than an anonymous on-device key. Its own pathway is Operators; the Builders sidebar carries it too. |
| [deployment.md](deployment.md) | operator | Where each piece runs, and the delivery postures (distribute to devices, host the PWA, run the services). |
| [configuration.md](configuration.md) | operator | Profiles, brand packs, tool sets and per-tool capabilities as files rather than in-app settings. |
| [build-guide.md](build-guide.md) | operator | Per-target build steps: CLI binary, desktop app, mobile apps, and the web shell as a container image. |
| [sovereign-production.md](sovereign-production.md) | operator | Sovereign creative production: no server in the render path, consent-gated networking, air-gapped deployment, on-device signing, and the limits stated as facts. |

## For Trust

The fifth pathway, and the one the other four link into whenever a claim needs its mechanism.

| Doc | Audience | What it covers |
|---|---|---|
| [trust.md](trust.md) | end user | Pathway hub. Where your content comes from, how to check it yourself, and what happens to your data - each claim paired with the mechanism that enforces it. |
| [status-quo.md](status-quo.md) | end user | The frictions we all learned to accept - uploading a logo to a stranger to resize it, artwork locked behind a lapsed plan - and what replaces them. |
| [input-not-impersonation.md](input-not-impersonation.md) | end user | An AI agent may fill in the inputs and may not claim to be you: what the exact line is, how it is enforced, and what a rogue agent still cannot do. |
| [content-credentials-identity.md](content-credentials-identity.md) | end user | What a Content Credential is, what enrolling an identity adds, and how anyone checks a file. |
| [content-credentials-engineering.md](content-credentials-engineering.md) | security | The engineering companion: device/CA architecture, engine contracts, the CA service, web-shell wiring, one-time operator setup. |
| [ai-stance.md](ai-stance.md) | end user | AI welcomed as labour and refused as impersonation: Lolly's position on generated content, and what backs each commitment. |
| [ai-features.md](ai-features.md) | end user | Text-to-speech, upscaling and background removal - generated once under guard-rails, then rendered identically everywhere, and why inventing pixels is marked AI while removing them is not. |
| [eu-ai-act.md](eu-ai-act.md) | end user | Article 50 and AI-content marking since 2 August 2026, and what Lolly honestly does: preserving arriving marks, declaring its own AI operations, verifying any file on-device. |
| [beatrice-warde.md](beatrice-warde.md) | end user | The typographer whose 1932 lines this project adapted, what we changed, and who she was. |
| [shoulders-of-giants.md](shoulders-of-giants.md) | end user | The open source projects Lolly is built from, named and thanked - the free-desktop lineage first, then sound, type, maps, models and the toolchain. |
| [verify-yourself.md](verify-yourself.md) | security | Falsifiable procedures with exact commands and expected output for the privacy and security claims. |
| [security-verification.md](security-verification.md) | security | A reviewer's summary of the cryptography behind Content Credentials, verification and encryption, and the tests behind each claim. |
| [threat-model.md](threat-model.md) | security | Trust boundaries, the residual-risk register, what is explicitly *not* a boundary, and the commands to verify each claim. An index into module headers, with file and line for every row. |
| [parser-inventory.md](parser-inventory.md) | security | Every engine module that turns attacker-controlled bytes into structure, with its declared bounds, its test, and its fuzz status. |
| [server-surface.md](server-surface.md) | operator | The complete inventory of server-side components, so the "runs on your device" claim can be stated precisely. |
| [privacy.md](privacy.md) | end user | The privacy policy: on-device data, no accounts for ordinary use, no analytics. |
| [inclusive-design.md](inclusive-design.md) | end user | Accessibility, language coverage and the ethical commitments Lolly holds itself to, with the tests that fail the build when one is broken. |

## Not in the site nav

| Doc | Audience | What it covers |
|---|---|---|
| [faq.md](faq.md) | end user | Questions and answers, rendered as its own page (/info/start/faq.html) since plans/177: `loadFaqs` in `build.ts` parses each `##` heading as a question and `renderFaqPage` compiles the accordion, with per-question `#faq-…` anchors other surfaces deep-link to. |
| README.md | contributor | This index. |

Every page above now has both a `pages` entry and a `SIDEBARS` item, so nothing in the index is
reachable by cross-link alone. `index` is the single declared exception, because the brand wordmark
links to it from every page and it renders the hub cards rather than sitting inside a sidebar.

Both kinds of gap are mechanically enforced rather than described here. `pnpm run check:docs-nav`
(`scripts/check-docs-nav.ts`, a CI step in the typecheck job) fails when a `docs/*.md` has no `pages`
entry, when a `pages` entry has no `SIDEBARS` item, when a `src` no longer exists - and when a
registered page is named nowhere in this index, so the promise at the top of this file is checked
rather than merely made. The two **declared exceptions** live in that script: `NOT_PAGES` (the "Not
in the site nav" table above) and `NOT_IN_SIDEBAR` (`index` alone), each carrying the reason it is
exempt. Add a doc without registering it and CI says so; exempt one and you have to write down why.
That guard is what closed the `ios-build.md` orphan (2026-07-30), which sat unreachable from `/info`
for as long as it existed.

## Everything else in this directory

| Path | What it is |
|---|---|
| `build.ts` | The `/info` site generator. Owns `pages`, `NAV`, `SIDEBARS`, the FAQ loader, and the inline CSS. |
| `og-image.ts` | Per-page Open Graph image generation. A page only gets its own `og/<slug>.png` reference when that image exists. |
| `site/` | The landing page's content, as data: `hero-chrome.json` (the cycling claims + CTAs), `covers.json`, `whatwhy.json`, `persona.json`, `behind.json` for the five beats, plus `downloads.json`, `import.json`, `formats.json` and `formats-catalog.json` for the bands other pages host. Read by the landing build, never published as pages - see `site/README.md` for which file localises how. |
| `i18n/<lang>/` | Translations of the localised subset (currently 26 locales). A translated file is used when present, and the English source is the fallback, never a 404. |
| `shots/` | Screenshot assets used by the docs. |
