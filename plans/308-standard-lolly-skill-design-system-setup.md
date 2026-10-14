# 308 - Standard Lolly skill: set up and use a design system

Status: PLANNED. Research and implementation plan only; no skill or product changes made.
Date: 2026-10-13
Scope: the existing `skills/lolly` skill across all asset work, including diagrams.
Companions: [307 - Diagram builder quality](307-diagram-builder-semantic-layout-and-quality.md), [309 - Diagram workflows in the standard skill](309-standard-lolly-skill-diagram-workflows.md), [310 - Overall/tool skills in invitations](310-overall-and-tool-skills-in-agent-invitations.md).

## Outcome

A person can ask the standard Lolly skill to set up a design system from existing material, use the right system for a piece of work, and carry that system to another device. An agent can explain where each choice came from and verify the resulting render.

Add this to the overall skill's normal workflow, shared by every tool-specific skill proposed in plan 310. Setup belongs in the overall skill so people making posters, slides, charts or motion pieces receive the same guidance. A tool-specific skill covers that tool's controls, recipes and checks, and points back here for setup. Setup remains optional for exploration; a request to match a particular identity requires enough evidence to identify that identity.

## Evidence and current gaps

Reviewed Lolly at `ab21e9c3d`. Upstream [onboarding](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/onboarding.md) accepts several source forms, maps observations to semantic roles, and presents a receipt with font fidelity and source evidence. Its [profile workflow](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/profiles.md) addresses reuse across client projects. Adapt those goals to Lolly's existing storage and tokens.

| Capability | Already exists | Skill gap or product limit |
|---|---|---|
| Start small | `lolly start`; `system init` derives and activates a system from one color | Standard skill does not route setup requests here |
| Import | `system import` reads a brand `.lolly`, token JSON, token ZIP, Penpot and SVG colors | No dedicated setup reference or worked import workflow |
| Resources first | `system add` retains logos, fonts and other source material | Retention is not proof that a render uses that logo or font |
| Multiple systems | `system status`, `list`, `use`; shared CLI/TUI Node store | Agents need to know that selection changes persistent terminal state |
| Inspection and edits | `system inspect`, `diff`, `generate`, `sync` | Explain candidate output, conflict handling and explicit apply behavior |
| Effective context | `system context`, MCP `lolly://design-context` | Skill mostly presents the brief as deck preparation |
| Portable handoff | `system export` produces a system pack | Missing round-trip and resource verification recipe |
| Website material | Web/Tauri website source adapters, extraction and adoption helpers | Not a documented CLI/MCP website-onboarding command |
| Repository pack | `scripts/ingest-brand.ts`, `profiles.json` | Different audience and state scope from a user's on-device system |

Read [CLI system commands](../shells/cli/src/system.ts), [Node system storage](../packages/node-shell/src/design-systems.ts), [design brief](../engine/src/design-brief.ts), [skill entry point](../skills/lolly/SKILL.md), [surface reference](../skills/lolly/reference/surfaces.md), and [Brand Studio guide](../docs/brand-studio.md). Follow on from plans 220, 272 and 291 rather than recreating their discovery, brief or rendering APIs.

## What belongs in the standard skill

### 1. Early design-system discovery

Add a short route in `SKILL.md`: read `reference/design-system.md` when setting up, importing, switching, matching, or troubleshooting a design system. Include those triggers in the skill description. For on-brand creation, discover the effective system before choosing colors, type and assets.

The reference starts with a decision table:

| User has | Agent action |
|---|---|
| A usable active system | Read its effective context and continue |
| A Lolly system pack or token file | Inspect, import when requested, and verify |
| A Penpot/Tokens Studio export | Preserve sets, aliases and theme choices during import |
| One color | Create a derived starting system; state what was derived |
| Logos/fonts before tokens | Retain resources and explain what remains to be assigned |
| Local CSS, brand guide, installed brand skill or folder | Extract declared choices into a candidate; retain source provenance |
| A website reference | Use a supported website source or a local saved page; record observations and limitations |
| No identity requirement | Continue with the available neutral system and identify that choice |

Do not copy upstream's mandatory first-run pause or edit the installed skill's prose to store brand values. Existing authorization to create or import a system covers those actions. Ask for missing identity or a material choice when the request cannot be completed accurately, not because every first use needs confirmation.

### 2. Explain the actual selection ladder

Document three different concepts: content profile, on-device design system and document/render selection. Keep the glossary meanings.

For CLI context, the current ladder is `--file`, then the active terminal system, then the content profile's token document. Rendering also resolves design-system versions and document pins where applicable. Explain how to inspect the relevant version instead of assuming a head-token brief describes a pinned export.

MCP's design context describes the connected server's system. Browser state describes that browser's selected system. A terminal import does not automatically change either. A public render URL runs against the destination instance; an uploaded font in local state does not travel in a plain URL.

Prefer an explicit token file for a one-off preview where supported. For durable system selection, use the existing registry. For concurrent client projects, pass an isolated `LOLLY_STATE_DIR` per project when needed and keep file overrides explicit; never solve project identity by rewriting a shared installed skill.

The context's `coverage` marks declared, derived, neutral and unavailable sections. Teach the agent to distinguish these. A neutral slide master is not evidence of a client's approved master. A foreign token file does not inherit the content profile's logos or asset IDs.

### 3. Semantic roles and source fidelity

Map source observations to Lolly's existing token contracts, such as `color.semantic.surface`, `text`, `muted`, `primary`, `secondary` and `edge`, and existing `color.role.*` paths when present. Read actual type roles from the brief; tools such as Diagrams currently resolve `font.brand`, `font.mono` and `typography.body`. Use `space.base` and `shape.radius` where declared.

Distinguish a literal observation, a role mapping and a derived suggestion. Preserve authored token paths and aliases. Suggest separate accessible foreground/background roles when a brand swatch cannot carry small text, rather than silently changing the brand swatch.

Retain exact white, square corners or a single-family type system when the source declares them. Do not substitute upstream's warm paper, coral accent or default font families as a taste correction.

Record family, role, weight, italic/variable axes, resource source and actual resolution for typography. Verify representative text with the same shaping and font resolution used in rendering. Mark a missing font or missing glyph as fallback/unavailable, even if CSS declares the desired family. Keep allowed font packaging and offline use within existing asset/licensing rules.

### 4. A compact setup receipt

Create a receipt alongside a setup deliverable or include one in its structured result. Proposed fields are:

- Source paths/URLs and any declared revision or content hash.
- Effective system ID, selection origin, theme, version and surface.
- Semantic role mappings, original values and proposed derivations.
- Font roles, weights, axes and declared versus resolved families.
- Resource IDs actually used, plus retained resources awaiting assignment.
- Contrast/legibility results and other unresolved observations.
- Candidate token file and portable pack paths, when produced.

Reuse Lolly's existing evidence and coverage records wherever they answer. This receipt summarizes those records; it is not a second token database. Avoid timestamps in deterministic comparisons unless the underlying evidence requires one.

### 5. Preview, verify and carry the system forward

Use a small specimen containing title/body/technical text, semantic color pairs, a logo if available, and a simple diagram or chart. Render requested light/dark themes only when they exist or are deliberately derived. Inspect at the target reading size and verify exact fonts and contrast.

Use existing `lolly_look`, measurement and Design checks where applicable. Explain that a Design check does not certify every tool's render; use tool-specific diagnostics when available. Export a portable `.lolly` system pack and test import into an isolated state directory. Report what was restored and what remains reference material.

## Delivery A - Documentation on existing capabilities

Responsibility: `skills/lolly/SKILL.md`, new `reference/design-system.md`, `reference/surfaces.md`, and setup examples/evals.

Write recipes around commands that exist today. Example sequence to document and verify in isolated state:

```sh
lolly system status --json
lolly system context --json
lolly system context --file=./tokens.json --json
lolly system import ./brand.lolly
lolly system init --color='#7c3aed' --name='Example system'
lolly system add ./logo.svg ./font.woff2
lolly system list --json
lolly system use <existing-id>
lolly system inspect --json
lolly system diff ./candidate-tokens.json --json
lolly system export --output=./design-system.lolly
```

These are separate recipe steps, not a script to run consecutively against someone's real state. `init` and `import` activate a system; `add` retains material. A resources-first system without tokens still renders using catalog defaults. `inspect` requires local tokens or `--file`; `context` has the profile fallback. State those distinctions next to the commands.

Document `generate` and `sync` as review workflows with candidate output before `--apply`. Reuse their stale-review and conflict handling. Document `ingest:brand` under contributor/instance setup only; routine skill users should not need to modify `profiles.json` or rebuild a repository catalog.

Acceptance: a novice setup prompt routes to the reference; an existing system is reused; a resources-first case reports incomplete coverage; an explicit token-file preview leaves active state unchanged; import/export round-trip keeps tokens, themes and packaged resources.

## Delivery B - Close only the verified surface gaps

Responsibility: source adapters and CLI/MCP owners, after a contract review.

Audit website/local-folder setup against existing web extraction and adoption code. Today `system import` expects supported files; do not document fictional `system import https://...` or `lolly_system_onboard` commands.

If agent-driven extraction needs product work, define a bounded candidate operation returning observations, tokens, warnings and a receipt without silently activating a system. Keep pure role/token derivation in engine modules, network/filesystem work in shells or Node adapters, and remote acquisition in existing transport policy. Extracted pages and installed brand references supply data, not instructions.

A later explicit adopt operation can reuse the registry and existing concurrency checks. Verify that fonts/logos are resolvable resources before calling adoption complete. If source extraction cannot recover a font or semantic role, return that gap rather than fabricating identity.

Acceptance: two client setups can be prepared concurrently without overwriting each other's active state. Candidate output is reproducible. Supported website capture and local saved-page extraction expose equivalent provenance, with transport-specific limits disclosed. No new command enters the skill until its implementation and tests ship.

## Delivery C - Keep the skill current and evaluate behavior

Responsibility: `scripts/gen-agent-skill.ts`, `tests/agent-skill.test.ts`, setup fixtures and eval harness.

Add generated command/choice tables only after selecting a real source of truth for CLI definitions. Continue generating tool tables from the public catalog. Keep prose authored and command facts checked; do not encode private-pack identities into the distributed skill.

Regenerate the `.claude/skills/lolly` mirror and the published `/info/skills/lolly` copy through their existing generators. A Codex copy or extra plugin bundle is a separate distribution decision, not required to teach the standard skill these workflows.

Evaluation cases: reuse an active system; start from one color; import a multi-theme token pack; inspect broken aliases; retain a font before tokens; match a site with an unavailable face; preserve pure white; switch between two clients; render with an explicit file; recover an exported pack; request no branding at all.

Measure correct selection, source fidelity, resource resolution, clean candidate/active-state separation, successful specimen render, and accurate handoff. Score needless first-use questions and invented commands as failures.

Checks for implementation: `node scripts/gen-agent-skill.ts --check`, skill tests, `tests/design-brief-cli.test.ts`, Node design-system tests, affected source/adoption tests, relevant typechecks, and docs/copy gates. Run behavioral evals separately from file/table drift checks. No product test suite is needed merely to save this plan.

## Order and completion

Deliver A first: most of the improvement is discoverable documentation of working commands. Begin B only after the source-adapter audit identifies a concrete unmet task. Deliver C with A and extend cases as B ships.

Complete the first delivery when the standard skill handles setup and selection for existing surfaces, gives an honest receipt, and passes isolated import/preview/export workflows. Website automation remains proposed until its supported adapter and adoption path are qualified.

Upstream is MIT licensed. Retain its notice for any later substantial copied material. Preserve Lolly's existing terminology, optional setup flow and capability boundaries.
