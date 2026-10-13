# 310 - Overall and tool-specific skills in agent invitations

Status: COMPLETE. Implemented, merged into remote and local main, and verified on the existing development server.
Date: 2026-10-13
Scope: Lolly's standard skill, a skill for each tool, and their delivery through Share > Invite an agent > Copy agent instructions.
Companions: [308 - Design-system setup](308-standard-lolly-skill-design-system-setup.md), [309 - Diagram workflows](309-standard-lolly-skill-diagram-workflows.md), [307 - Diagram builder quality](307-diagram-builder-semantic-layout-and-quality.md).

## Outcome

An invitation from an open tool supplies two levels of guidance: Lolly's overall skill and the skill for that specific tool. The first explains the shared workflow, design-system setup and surfaces. The second explains the open tool's actual inputs, editing model, examples and checks. The invitation separately supplies the document connection, chosen agent name and permission.

Every tool receives a useful baseline skill generated from its manifest. Richer tools add authored guidance. An agent loads only the current tool's guidance and the shared references needed for its task, rather than every tool skill at once.

The Share panel uses icon-bearing native disclosures based on `details.input-section` in `#tool-sidebar`. Invite an agent includes an Agent name field. Those UI changes are included in [PR 247](https://github.com/lolly-tools/lolly/pull/247). [PR 248](https://github.com/lolly-tools/lolly/pull/248) includes that history and implements skill delivery and live input support.

## Current evidence

Reviewed Lolly at `ab21e9c3d` and the current share/invitation code. The screenshot supplied with the request shows an expanded invitation block with setup, access, copy and revoke controls.

| Existing source | Behavior | Gap |
|---|---|---|
| [Standard skill](../skills/lolly/SKILL.md) | Shared workflows plus selected structured-tool references | No independent skill artifact for every catalog tool |
| [Skill generator](../scripts/gen-agent-skill.ts) | Generates public tool facts and mirrors the standard skill | Needs per-tool generation, coverage and version checks |
| [Docs build](../docs/build.ts) | Publishes `skills/lolly` under `/info/skills/lolly` | Needs declared tool-skill outputs and distribution rules |
| [General agent instructions](../docs/agents-pages.ts) | Points at the overall skill and MCP/CLI routes | Does not select an open tool's skill |
| [Agent share section](../shells/web/src/views/agent-share.ts) | Copies a document invitation and live Design editing instructions | Needs a current-tool skill pair and tool-aware instructions |
| [Share registry](../shells/web/src/lib/share-sections.ts) | Supplies tool ID and an optional live document reader to registered sections | Can carry skill discovery without making Share know each tool |
| [Live editor adapter](../shells/web/src/views/tool-agent-editor.ts) | Uses Design's layer/editing model | A tool skill cannot make another tool live-editable by itself |
| [Live context](../shells/web/src/views/design-live-context.ts) | Reads the same system/theme/version snapshot as the open editor | Reuse this source of truth rather than a separately selected terminal system |

## Skill responsibilities

| Layer | Contains | Source of truth |
|---|---|---|
| Overall Lolly skill | Discovery, setup, design-system selection, surface choice, validation/render/inspection loop, cross-tool selection | `skills/lolly/SKILL.md` and its shared references |
| Tool-specific skill | Stable tool ID/version, input fields and aliases, supported sources, editing semantics, formats, recipes, limitations and task checks | Tool manifest plus authored tool guidance |
| Invitation instructions | Connection route, capability, permission, requested agent name, document/tool identity, skill references and joining steps | The active Share document and invitation host |
| Live context | Current state, revision, effective system/theme/version, and supported editor operations | The actual open runtime and its bridge |

Skills explain how to operate; document grants decide what is allowed. Neither a skill nor copied prose can increase permission, install a plugin, or create unsupported live operations.

## Delivery A - A baseline skill for every tool

Responsibility: tool packs, skill generator and contract tests.

Use a predictable tool-local `SKILL.md` alongside `tool.json` as the proposed canonical authored file: `community/<id>/SKILL.md` or `brands/<brand>/tools/<id>/SKILL.md`. This location is proposed, not supported by today's loader. Extend pack materialization and publication deliberately so the file travels as tool data. Avoid a mandatory manifest migration if a conventional optional path suffices.

Generate a baseline artifact for every mounted tool, even when no authored file exists. Derive stable IDs, version, schema fields, URL aliases, source choices, capabilities/requires and export formats from the manifest. State the chosen transport's actual format support as a separate surface fact.

Authored sections add suitable tasks, safe defaults, detailed examples, semantic limitations and review steps. Mark generated regions and check drift using the existing generator pattern. Do not duplicate entire schemas, the standard setup guide or repeated shared workflows in every skill.

Use a stable skill name such as `lolly-diagram-builder`; track tool version and skill-content revision separately. Identify the supported tool-version range and content hash in a generated index. An authored skill that excludes the installed tool version is unavailable until updated; do not present it as current guidance.

For Diagrams, apply plan 309's selection/workflow guidance and plan 307's actual support as it ships. Design's skill covers stable layer IDs and document operations; utility skills describe file-in/bytes-out behavior. Generate equivalent useful coverage for simple tools without demanding hand-written boilerplate.

Acceptance: every public catalog tool has a generated skill; fields and choices match its manifest; no invented inputs or unsupported formats appear; a public clone generates identical public outputs with or without a private pack installed.

## Delivery B - Discover and serve the correct skill pair

Responsibility: docs/publication, content resolver, tool sync and MCP resources.

Publish the overall skill through its existing path. Choose a stable per-tool publication path and resource identifier during API design, then document and test them; this plan does not assert that a proposed URL already works.

Resolve the tool-specific skill using the open runtime's actual tool ID and version. A saved session, custom tool or private-pack tool may require a bundled or authorized skill instead of a public URL. Public skill generation must not expose private tool guidance, resources or design-system material. Reuse the catalog's existing visibility rules for profile-specific delivery.

Provide a small manifest/index with identity, version compatibility, hash, bounded size and references. Preserve relative references when publishing or packaging the skill. Support offline access for installed tool data and a compact fallback when remote guidance is unavailable. Fetching a skill should not create a new invitation or change the document.

Add a discoverable MCP resource or context field only after selecting and implementing its contract. Prefer progressive references over inserting all guidance into every response. Do not require installing dozens of independently activated skills to operate one document.

Acceptance: opening two different tools resolves two different tool skills; a version mismatch is reported; an offline installed tool retains its guidance; a public artifact has no private-pack content; relative references resolve after packaging.

## Delivery C - Copy agent instructions for the open tool

Responsibility: invitation host, instruction builder and skill/context adapters.

Capture the current document/tool identity, requested name and access level when the person presses Copy agent instructions. Produce a compact readable bundle containing:

1. The invitation connection and explicit read/edit scope.
2. The requested agent name as a safely quoted `client` value, with the current default when no name was entered.
3. A pointer or bounded embedded excerpt for the overall Lolly skill.
4. A pointer or bounded embedded excerpt for this tool's compatible skill.
5. Instructions to connect and verify the actual tool/document identity before editing.
6. The tool's supported inspection/editing/check loop, including revision and retry rules where available.

Keep connection credentials confined to the private invitation text. Skills and public skill indexes contain no invitation secret. Reopening Share, editing a name or opening a disclosure does not mint an invitation; Copy is the explicit invitation action. A failed clipboard operation must not claim that instructions were copied.

Determine skill references from the current instance and tool source. A self-hosted instance should not receive hardcoded skill URLs for a different installation. The existing hosted connector may remain the configured connection route; distinguish that connection route from where tool guidance is served.

Use live context for the design system and current revision. The overall setup skill can explain how to create/import a system, but a document invitation does not authorize silently replacing the open document's system or changing terminal/global state.

Acceptance: switching tools changes the copied tool identity and skill; switching documents cannot leave stale identity or credentials in the copy; read-only text contains no edit procedure; a chosen name appears in the join instruction and People; missing guidance has an honest fallback without preventing supported collaboration.

## Delivery D - Broaden live editing only where supported

Responsibility: tool editor adapters and their contract tests.

Current live invitations use a Design-oriented editor. A generated QR, chart or diagram skill does not make the existing live layer API valid for those tools. Keep the live invite offer behind an actual editor capability.

For tools without live support, a separate agent-guidance action can share the overall/tool skill pair plus a reproducible editable link or permitted input snapshot. Label this as a guidance handoff; do not claim the agent has joined the document.

Evaluate a generic input-model live adapter as its own delivery: stable input IDs, current values, runtime validation, revision checks, undo/history and appropriate preview. Then add specialized document adapters only when necessary. Tool skills enumerate the operations the connected adapter supports. Uploaded file bytes remain subject to existing file/access rules.

Acceptance: a simple tool can be inspected/updated through its real input model when the adapter exists; unsupported tools never receive Design layer instructions; read-only grants refuse mutation at the actual operation boundary.

## Share-panel implementation and presentation

Use the existing summary/title/icon/body class structure and shell icon set. Keep the primary Copy link action easy to reach. Put link behavior/options, editable files and applicable feature blocks in concise collapsible sections. Registered sections keep their existing order and listeners.

Invite an agent contains Agent name, Agent access, the copy action and a subordinate setup link. Keep revoke/end controls recognizable. Preserve the drafted name and access choice for the same invitation host across panel rebuilds without writing them into tool inputs or global persisted state. Enforce the host's current read/edit capability after a downgrade. Retain existing invitation expiry, revocation and connection limits.

Preserve disclosure choices during docked-panel refreshes, keyboard focus and readable status/error text. Validate narrow panels, large text, keyboard operation and modal/docked parity against the native input-section reference. Icons accompany text and are decorative to assistive technology.

PR 247 supplies presentation, naming and access-choice persistence. PR 248 supplies the skills and input adapter, including the preceding UI history. Final verification is recorded in [the existing-server evidence](artifacts/310-share-panel/final-post310-verification.md).

## Validation, order and completion

Start with A's generated coverage and authored pilots for Design and Diagrams. Deliver B before C publishes any new references. Broaden live adapters in D independently, using real capability detection. Plans 308/309 remain the shared setup and diagram guidance for these artifacts.

Check generated skills, input/URL examples, version/hash agreement, public/private separation, copy payloads, stale async results, permissions, name escaping, offline references and all supported editor adapters. Run behavioral cases where two tools and two documents are open simultaneously.

Complete the skill addition when each mounted tool has compatible discoverable guidance, Copy agent instructions supplies the correct overall/tool pair, and agents operate the actual open tool without invented commands or widened access. The UI work can ship before those skill-delivery contracts are complete.

## Execution record - 2026-10-13

Implemented A-D in branch `feat/tool-skills-agent-sharing-20261013`, currently at `7fa30ea87`. Local main contains the implementation and the current remote main identity updates. The existing development server on port 5173 remains running with its original PID. Its pre-existing private catalog file bytes and modes are unchanged.

- A: all 68 public tools have generated skills, exact input definitions, declared examples where available, version compatibility, revisions and SHA-256 metadata. Design and Diagrams have authored `SKILL.md`, `skill.json` and portable workflow references. Other mounted, private or installed tools receive their actual manifest baseline.
- B: public paths are `/info/skills/lolly/SKILL.md` and `/info/skills/tools/<id>/SKILL.md`, with metadata and an index. MCP provides `lolly://skill`, `lolly://skill/{path}` and `lolly://tool/{id}/skill`. Lazy tool-source resolution checks compatibility and signed bytes. Bundles and offline pins carry authored guidance; public generation explicitly excludes private packs.
- C: every mounted tool supplies named guidance. Live invitations include tool/document identity, chosen permission, quoted client name, current-instance references and bounded installed guidance. Read copies contain facts and inspection instructions. Guidance-only copies explicitly contain no document grant. Startup Share waits for editor readiness.
- D: an additive JSON input adapter uses actual runtime validation and history. Revisions, stale async checks, transaction replay and undo are enforced. File/upload bytes are omitted; unsupported SVG previews are not advertised. Design retains its layer adapter.

Validation: 45 browser checks passed on the actual existing `localhost:5173` server, with zero console/page errors. These include Darkroom, QR, Design and Diagrams, exact versions and reference hashes, names in People, read refusal, actual input edits, retries and undo, startup readiness and narrow layouts. The isolated candidate passed 40 checks. Invitation transport and clipboard were mocked within fresh browser contexts; no real external invitation was created. The original Design sharing browser journey also passed.

Other checks: 72 sharing/skill/loader/MCP contracts, 18 new/extended input/MCP cases, 29 existing live/layer cases, complete TypeScript checks, skill-validator coverage for all 68 public artifacts, both mounted-profile catalogs, production build and entry bundle budget, lint and wording ratchets, generated inventories, staged secrets scan, and report-only branch hygiene. Public generation remains identical when `LOLLY_PROFILE=suse` is selected.

Limits: hosted services have not been deployed. A file-only tool remains inspection-only through the input adapter, and file bytes require separately supported routes. Exact private binary fingerprints stream bytes without exposing them, but cost O(file size) on revision reads. Plans 307-309 retain their proposed engine/type expansion and additional evaluation work.

CI follow-up: the first current-main run found a missing required `imprint` method in the newly typed test host fixture. Commit `e867fda97` completes that fixture. Full TypeScript checks and the 18 affected tests pass; production behavior is unchanged. The fresh CI run is `38408018190`.

Publication qualification: commit `7fa30ea87` registers the portable SDK import, adds the tool-guidance page to the docs navigation/footer/index, and keeps the Vercel content glob within its 256-character limit. All later typecheck-job gates pass locally, as do the docs build and 13 navigation/packaging/wording tests. CI run `38411165888` checks the current head.

Final merge: [PR 248](https://github.com/lolly-tools/lolly/pull/248) merged at 2026-10-13 14:54 UTC as `a0d96abaa102b043bd21ce85d04c0a647b94603b`, with all 22 CI checks passing. Its complete history also merged [PR 247](https://github.com/lolly-tools/lolly/pull/247). Local main matches origin/main.

The existing server remains PID 79294 on port 5173. The two pre-existing private catalog files and the three later uncommitted sharing-style/rules edits retain their exact bytes and modes. A further 320px visual check of the current working-tree styling passed all four checks without browser errors. Worktrees with verification evidence remain locked; report-only hygiene performs no cleanup.
