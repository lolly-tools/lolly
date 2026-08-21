# `schemas/`

The machine-readable contracts a tool, an asset and a design-tokens document have to satisfy. Five files, all owned by the umbrella (`lolly`) repo, all declaring the JSON Schema draft 2020-12 dialect except `canonical-inputs.json`, which is a registry rather than a schema.

| File | `$id` | Validates |
|---|---|---|
| `tool.schema.json` | `https://lolly.tools/schemas/tool.schema.json` | A tool manifest, `tools/<id>/tool.json` |
| `asset.schema.json` | `https://lolly.tools/schemas/asset.schema.json` | One entry in the catalog's `assets/index.json` |
| `asset-ref.schema.json` | `https://lolly.tools/schemas/asset-ref.schema.json` | The runtime object a resolved asset becomes |
| `tokens.schema.json` | `https://lolly.tools/schemas/tokens.schema.json` | A W3C Design Tokens (DTCG) document |
| `canonical-inputs.json` | none (not a schema) | Nothing. It is the registry of shared input `id`s that the validator warns against. |

## `tool.schema.json` is the authority

Its own description: *"Declares everything the engine needs to know about a tool: its identity, its inputs, its render target, and its capabilities. The template consumes inputs by name; this manifest declares them."*

This file, not the prose, is the authority for what a manifest may contain. It sets `additionalProperties: false` at the top level, so an unrecognised key is an error rather than a silently ignored hint. Its seven required properties are `id`, `name`, `version`, `engineVersion`, `status`, `render` and `inputs`; the full property set also covers `extends`, `description`, `a11yLabel`, `category`, `new`, `listed`, `privacy`, `tags`, `featured`, `examples`, `capabilities`, `network`, `composes` and `hooks`. Two `$defs` carry the repeated shapes, `input` and `exampleVariant`.

The prose counterpart is [`../docs/authoring-tools.md`](../docs/authoring-tools.md), which is the guide you read to learn how to write a manifest, and [`../docs/url-mode.md`](../docs/url-mode.md) for how every input is expressed as a URL parameter. When the guide and the schema disagree, the schema wins, and the docs are wrong and should be fixed. The docs already state this in the places it matters most: `docs/host-api.md` and `docs/overview.md` both point at the export-format enum in this schema as the authority rather than at the `ExportFormat` type in the bridge, which is known to be stale.

`extends` deserves a note, because it is stripped before most consumers ever see it. A brand-pack tool may declare `"extends": "community"` and ship only the files that differ from the community base; `scripts/use-profile.ts` then composes the view directory as the per-file union of base and overlay and removes the `extends` marker from the composed `tool.json`. So the engine, the shells and the catalog scripts all validate a plain manifest with no `extends` key.

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

## How validation is actually invoked

There are two independent code paths, and every tool passes through both.

**`scripts/validate-catalog.ts`** is the build-time gate, run as `npm run validate:catalog` (and per-profile as `npm run validate:catalog:all`, which is what CI's `validate-catalog` job runs). It reads `schemas/tool.schema.json`, `schemas/asset.schema.json` and `schemas/tokens.schema.json` off disk, compiles them with Ajv's 2020 build, and then goes well beyond schema conformance to check the invariants a schema cannot express: asset checksums against the actual bytes, file existence, `bindToProfile` field names, palette references, `replacedBy` chains, canonical-input divergence, and the shared-hook-region sync. A tokens document is only structurally validated when its asset declares `type: "tokens"` and a `json` format.

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
3. Run `npm run build:catalog:all` then `npm run validate:catalog:all`, not the singular forms. The catalog index is generated per brand, so a change that only rebuilds the active profile leaves every other brand stale and the singular validator cannot see it.
4. Run `npm test`, which includes the drift guards, and `npm run typecheck`.

Removing or narrowing a field is a breaking change for every tool already using it, including tools in the private `brands/suse` pack you may not have mounted. Widening is safe. `id` fields, both tool and asset, are permanent contracts and are never renamed or reused.
