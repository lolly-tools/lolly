# `schemas/`

The machine-readable contracts a tool, an asset, a design-tokens document and a deck renovation have to satisfy. The table below covers those four, all owned by the umbrella (`lolly`) repo, all declaring the JSON Schema draft 2020-12 dialect except `canonical-inputs.json`, which is a registry rather than a schema. The directory holds more than the table lists: the other files there are documented beside the code that reads them, not here, so the table stays a reading order rather than an inventory that goes stale on the next addition.

| File | `$id` | Validates |
|---|---|---|
| `tool.schema.json` | `https://lolly.tools/schemas/tool.schema.json` | A tool manifest, `tools/<id>/tool.json` |
| `asset.schema.json` | `https://lolly.tools/schemas/asset.schema.json` | One entry in the catalog's `assets/index.json` |
| `asset-ref.schema.json` | `https://lolly.tools/schemas/asset-ref.schema.json` | The runtime object a resolved asset becomes |
| `tokens.schema.json` | `https://lolly.tools/schemas/tokens.schema.json` | A W3C Design Tokens (DTCG) document |
| `canonical-inputs.json` | none (not a schema) | Nothing. It is the registry of shared input `id`s that the validator warns against. |
| `slide-master-v1.schema.json` | `https://lolly.tools/schemas/slide-master-v1.schema.json` | A design system's slide master: archetype frames with placeholder roles and furniture, seeded into Design (plan 274 section 3.4) |
| `rebrand-source-v1.schema.json` | `https://lolly.tools/schemas/rebrand-source-v1.schema.json` | A source deck read as faithfully as the reader managed, with a fidelity fact per object (plan 274 stage 1) |
| `rebrand-census-v1.schema.json` | `https://lolly.tools/schemas/rebrand-census-v1.schema.json` | Origin, class hypothesis and evidence per object, plus the colour, font and layout censuses (stage 2) |
| `rebrand-plan-v1.schema.json` | `https://lolly.tools/schemas/rebrand-plan-v1.schema.json` | A renovation plan: proposals and decisions kept apart, with review state, author and scope (stages 3 and 4) |
| `rebrand-compiled-v1.schema.json` | `https://lolly.tools/schemas/rebrand-compiled-v1.schema.json` | The accepted plan lowered to Design authored values, with lineage both ways and the report (stage 5) |
| `rebrand-report-v1.schema.json` | `https://lolly.tools/schemas/rebrand-report-v1.schema.json` | Every source object accounted for, with stable machine codes beside localisable messages |
| `rebrand-project-v1.schema.json` | `https://lolly.tools/schemas/rebrand-project-v1.schema.json` | The durable local unit of work: source, checkpoint, design-system snapshot, stored-record ids |

## `tool.schema.json` is the authority

Its own description: *"Declares everything the engine needs to know about a tool: its identity, its inputs, its render target, and its capabilities. The template consumes inputs by name; this manifest declares them."*

This file, not the prose, is the authority for what a manifest may contain. It sets `additionalProperties: false` at the top level, so an unrecognised key is an error rather than a silently ignored hint. Its seven required properties are `id`, `name`, `version`, `engineVersion`, `status`, `render` and `inputs`; the full property set also covers `extends`, `description`, `a11yLabel`, `category`, `new`, `listed`, `privacy`, `tags`, `featured`, `examples`, `capabilities`, `network`, `composes` and `hooks`. Two `$defs` carry the repeated shapes, `input` and `exampleVariant`.

The prose counterpart is [`../docs/authoring-tools.md`](../docs/authoring-tools.md), which is the guide you read to learn how to write a manifest, and [`../docs/url-mode.md`](../docs/url-mode.md) for how every input is expressed as a URL parameter. When the guide and the schema disagree, the schema wins, and the docs are wrong and should be fixed. The docs already state this in the places it matters most: `docs/host-api.md` and `docs/overview.md` both point at the export-format enum in this schema as the authority rather than at the `ExportFormat` type in the bridge, which is known to be stale.

`extends` deserves a note, because it is stripped before most consumers ever see it. A brand-pack tool may declare `"extends": "community"` and ship only the files that differ from the community base; `packages/node-shell/src/content-roots.ts` then reads that tool as the per-file union of base and overlay and removes the `extends` marker from the manifest it hands out. So the engine, the shells and the catalog scripts all validate a plain manifest with no `extends` key.

## `asset.schema.json` and `asset-ref.schema.json` are two halves of one story

`asset.schema.json` describes the **authored, stored** form: *"One asset in the global catalog. Tools resolve assets by id via `host.assets.get()`. The id is a forever-stable contract; the version moves."* Required: `id`, `type`, `version`, `tier`, `formats`. It also carries the lifecycle and policy fields the validator enforces invariants over: `deprecated`, `replacedBy`, `license`, `aiGenerated`, `prefetch` and `brandLock`.

`asset-ref.schema.json` describes the **resolved, runtime** form: *"The runtime object representing a resolved asset. Returned by `host.assets.get()`, `host.assets.pick()`, and stored in saved tool state. Uniform across library assets and user uploads - tools handle them identically."* Required: `source`, `id`, `type`, `format`, `url`, with optional `width`, `height`, `version`, `checksum` and `meta`.

That uniformity is the point of having a separate schema. A catalog asset and a file the user dropped in five seconds ago arrive at a tool as the same shape, so a tool never branches on where an asset came from. `source` is the only field that records the difference, and tools are not meant to read it.

Note that `asset-ref.schema.json` is registered with Ajv (in both `engine/src/validate.ts` and `packages/core/src/validate.ts`) but nothing compiles a validator against it today. It is a published contract for tool authors and shell implementers rather than an enforced gate, so treat it as documentation with a schema's precision.

## `tokens.schema.json` is deliberately lenient

Its description: *"A W3C Design Tokens (DTCG) document, as imported/exported by Penpot and Tokens Studio. Validates the structural shape: groups nest tokens, a token carries `$value` (+ optional `$type`/`$description`/`$extensions`). Lenient on `$value` by design - type-specific value checking lives in `engine/src/tokens.js`, not here."*

It has a single recursive `$defs.node` plus the three document-level keys `$description`, `$themes` and `$metadata`. The split is intentional: structure here, semantics in the engine, because the value grammar of a colour token and a shadow token have nothing in common and encoding both in JSON Schema would produce error messages nobody can act on.

One small staleness: that description names `engine/src/tokens.js`, and the module has since been migrated to `engine/src/tokens.ts`. The pointer is otherwise correct.

## `canonical-inputs.json` is a registry, not a schema

It has no `$id` and no `$schema`, and it validates nothing. Its top-level keys are `_README`, `inputs` and `conventions`. It registers 11 shared input ids (`heading`, `subheading`, `body`, `cta`, `color`, `background`, `image`, `headshot`, `bgImage`, `bgOpacity`, `imageFraming`) plus two convention notes covering per-element typography naming and the rules for bulk-writable columns.

The reason it exists is the `/pro` batch grid. Two tools that share an input id collapse into one column there, and if they also agree on type and constraints (number `min`/`max`/`step`, select options, colour palette) that column becomes bulk-writable, so one value fills every row. `scripts/validate-catalog.ts` emits a **warning, never an error**, when a tool uses one of these ids with a divergent type or constraints, which keeps the drift visible without blocking anyone's PR. Labels in the registry are advisory; a tool may show its own.

Adding a new shared input means adding it here first, then adopting it in tools.

## The six `rebrand-*` schemas mirror one TypeScript module

They are the JSON half of `packages/core/src/rebrand-v1.ts` (plan 274), the contracts the web view at `#/rebrand`, the CLI `lolly rebrand plan|compile|inspect` stages and the MCP `lolly_rebrand` tool all speak. One schema per document the journey produces, in the order it produces them: source, census, plan, compiled, report, project.

Five things to check before you edit one.

**A vocabulary the module exports as a const array is pinned; a union written inline in the module is not.** `SOURCE_KINDS`, `SOURCE_OBJECT_KINDS`, `SOURCE_ORIGINS`, `FIDELITY_STATES`, `FIDELITY_REASONS`, `PLACEHOLDER_TYPES`, `OCR_STATES`, `SOURCE_WARNING_CODES`, `OBJECT_CLASSES`, `EVIDENCE_SIGNALS`, `PLAN_ACTIONS`, `REVIEW_STATES`, `DECISION_AUTHORS`, `ARCHETYPE_ROLES`, `ARCHETYPE_IDS`, `COLOR_UNRESOLVED_REASONS`, `DISPOSITIONS`, `REPORT_CODES`, `FILE_OUTCOMES`, `REBRAND_ERROR_CODES`, `PROJECT_STAGES`, `PROJECT_PART_KINDS`, `PROJECT_WRITE_REFUSALS` and plan 275's `KNOWN_ARCHETYPE_IDS`, `LAYOUT_UNIT_KINDS`, `LAYOUT_MATCH_BANDS`, `SLIDE_GROUNDS` and `DECK_THEME_IDS` each appear as a bare `enum` in one named `$defs` entry, with the members in the same order as the array. `tests/rebrand-contract.test.ts` holds those copies together element by element, refuses an exported array with no schema home, and walks every schema to refuse the same list written out a second time anywhere else, so an inline `propertyNames` copy cannot reappear where no test can see it. `FILE_OUTCOMES`, `REBRAND_ERROR_CODES`, `PROJECT_PART_KINDS` and `PROJECT_WRITE_REFUSALS` are the vocabularies no document property uses; they live in the report and project schemas' `$defs` as published contracts for the CLI, MCP and project-store surfaces.

The module also carries about seventeen unions written inline in an interface rather than as an exported array: `fallbackSource`, `fontProvenance`, a paragraph's `bullet` and `align`, an object group's `kind`, a colour `role`, the font-use `roles` key set, `layoutSource`, a font mapping's `source`, `carriedBy`, `mode`, the logo `policy`, `surplus`, a brand-logo `variant`, the backward lineage's `derived`, and the capability `surface` and `bytes`. Those are copied into the schemas **by hand and guarded by nothing**. They match today, checked by reading. Promote one to an exported array and add it to the test's table if you want it held together.

**Archetype ids are open from plan 275 on.** `layout`, `layoutAlternative` and a compiled frame's `archetype` point at `$defs/archetypeRef`, a pattern (`STRUCTURE_ID_PATTERN` in the module, lower case letters, digits and dashes) rather than the enum of twelve, so a master generated from the layout library can name `columns-3`. `$defs/archetypeId` keeps the twelve as the published list (`ARCHETYPE_IDS`, also `KNOWN_ARCHETYPE_IDS`). The slide master schema does the same: `knownArchetypeId` is the list, `archetypeId` the pattern, and `archetypes` holds up to 128. The policy for an older build is to refuse, never to misread: a plan read by `planProblems` (`packages/node-shell/src/rebrand/pipeline.ts`, used by the CLI and the MCP tool) against the older plan schema fails on the enum with its own message, a preset read by the older `presetProblems` or web `presetOf` is refused for its unknown layout key or id, and an older `validate:catalog` refuses a master holding a library id. `REBRAND_CONTRACT_VERSION` stays 1, because nothing an older file says changes meaning; every plan 275 field is optional.

**Shared sub-shapes are copied, not cross-referenced.** A `box`, an `assetRef`, a `sourceWarning`, an `evidence` entry and a `designSystemSnapshot` are written into each schema that needs them, so each document schema validates on its own with nothing else registered. The one exception is `report` inside `rebrand-compiled-v1`, which refers to `rebrand-report-v1` by `$id`, because a compiled deck carries a whole report; register the report schema with Ajv before compiling the compiled-deck validator. The copies are kept honest by the same test file: a `$defs` name that appears in more than one schema must be the same definition in every one of them.

**An asset ref has to survive a reload, a device and a shell.** `$defs/assetRef` is a namespaced catalog id or a host-generated user asset id, and its pattern refuses a `data:` or `blob:` URL, an absolute path and a `..` segment, because the portable documents are the only place that rule can be enforced. Every ref field points at it: a picture's `media`, a slide background's `media`, a slide `preview`, `fidelity.fallbackAssetRef`, the plan's `supplied-picture` and the project's `bytesAssetRef`.

**The caps are one number, not four.** A deck carries at most 200000 objects through the whole journey. The census entries, both lineage directions and the report entries all say so in their descriptions and the test compares them, so a source deck that validates cannot produce a census, a lineage or a report that does not. A reader at the ceiling emits a `nodes-truncated` or `slides-truncated` warning rather than writing a deck stage 2 refuses.

None of the six is duplicated into `packages/core/schema/`, so the drift hazard described below does not apply to them. The authored sample documents under `tests/fixtures/rebrand/samples/` are the worked examples, and they read as one journey over one deck: a native chart nothing could be shown for beside a second chart whose file did carry an image, a decision that overrides its proposal, an unresolved colour use, a continuation frame holding the content it was added for, and lineage both ways. Three walks in the test keep them honest: the census classifies every source object and invents none, the report accounts for every source object once with its entries tallying against its counts, and every Design box row in the compiled deck uses field ids and `kind` values `schemas/blocks-wire-order.json` and `community/design/tool.json` actually declare. That last one matters because `design:boxes` is a frozen positional URL contract (plan 171): a row with an invented key never decodes.

## How validation is actually invoked

There are two independent code paths, and every tool passes through both.

**`scripts/validate-catalog.ts`** is the build-time gate, run as `pnpm run validate:catalog` (and per-profile as `pnpm run validate:catalog:all`, which is what CI's `validate-catalog` job runs). It reads `schemas/tool.schema.json`, `schemas/asset.schema.json` and `schemas/tokens.schema.json` off disk, compiles them with Ajv's 2020 build, and then goes well beyond schema conformance to check the invariants a schema cannot express: asset checksums against the actual bytes, file existence, `bindToProfile` field names, palette references, `replacedBy` chains, canonical-input divergence, and the shared-hook-region sync. A tokens document is only structurally validated when its asset declares `type: "tokens"` and a `json` format.

**`engine/src/validate.ts`** is the runtime path. It imports the same three tool/asset/asset-ref schemas as JSON modules, registers all three with Ajv, compiles a validator against the tool schema, and exports `validateManifest()`. `engine/src/loader.ts` uses that before a tool is mounted, which is why a malformed manifest fails at load rather than halfway through a render.

Both use `{ allErrors: true, strict: false }`, and both instantiate Ajv from `ajv/dist/2020.js` rather than the default export, because the schemas declare draft 2020-12 and the default build only knows draft-07 and throws on the unknown meta-schema. If you add a schema here, import it the same way.

## Duplication: three schemas exist in two byte-identical copies

**This is a known drift hazard. Edit both copies or the test suite fails.**

`tool.schema.json`, `asset.schema.json` and `asset-ref.schema.json` each exist twice:

- `schemas/<name>` - the canonical source everything in this repo validates against.
- `packages/core/schema/<name>` - bundled into the published tool-author SDK `@lolly-tools/core`, so a third party can validate a manifest without cloning this repo.

There is no generator and no copy script. The `packages/core` copies are maintained by hand. `tests/lolly-tools-core.test.ts` guards them with one test per file, named `@lolly-tools/core bundles an identical <name> (no drift)`, doing a `deepEqual` between the two; the same file also asserts that `core.validateTool()` and `engine.validateManifest()` agree on the SDK's example manifest. Editing the root schema alone makes those tests fail, which is the intended outcome.

`tokens.schema.json` and `canonical-inputs.json` are **not** duplicated into `packages/core`. They exist once.

Copies you will see in `find` output but should ignore: `dist/engine-pack/schemas/` (produced by `scripts/pack-engine.ts`) and `shells/web/dist/schemas/` (a web build output). Both are generated artefacts, not sources.

## If you change a schema

1. Apply the identical edit to `packages/core/schema/` as well, if the file is one of the three duplicated ones.
2. Update the prose in [`../docs/authoring-tools.md`](../docs/authoring-tools.md) if you changed anything a tool author would notice.
3. Run `pnpm run build:catalog:all` then `pnpm run validate:catalog:all`, not the singular forms. The catalog index is generated per brand, so a change that only rebuilds the active profile leaves every other brand stale and the singular validator cannot see it.
4. Run `pnpm test`, which includes the drift guards, and `pnpm run typecheck`.

Removing or narrowing a field is a breaking change for every tool already using it, including tools in the private `brands/suse` pack you may not have mounted. Widening is safe. `id` fields, both tool and asset, are permanent contracts and are never renamed or reused.
