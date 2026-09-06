# Plan: a skill for agents to drive Lolly (2026-09-06)

A skill an agent loads once and can then produce assets with, over every surface Lolly exposes: URL mode, the public render route, the MCP server, the CLI, and lolly-work's API. Deck, chart and design are worked in full because they are where an agent's inputs are structured documents rather than a few fields.

File references: umbrella at `3fea3b9`, `lolly-work` at `987ab54`.

## 1. What exists

No `SKILL.md` or `.claude/skills/` in any repo; `.claude/` in the umbrella holds settings and a hook. `CLAUDE.md` (symlinked as `AGENTS.md`) is a contributor guide to the codebase, not a guide to driving the product.

The raw material, all current except one drift:

| Surface | Source |
|---|---|
| URL mode | `docs/url-mode.md` (reserved params `:220-278`, compact encoding `:205-216`, packed links `:279`, embed grammar `:627-637`), `engine/src/url-mode.ts` `RESERVED` |
| Public render route | `services/mcp/src/render-get.ts` (`GET /tool/<id>.<ext>?…`, official and community only, browser-free formats plus a PNG fast path, C2PA off, `Content-Security-Policy: sandbox`) |
| MCP | `services/mcp/src/tools.ts:233-379` (13 tools), `resources.ts:23-33` (`lolly://catalog`, `lolly://assets`, `lolly://tokens`, per-tool templates), prompts at `tools.ts:1186-1281`, scoped `files_*` tools in `file-resources.ts:98-102`; `services/mcp/README.md` (the best agent-facing text, with `layerOperations` examples for design); `docs/mcp.md`; `docs/ai-agents.md` |
| Machine-readable pages | `docs/agents-pages.ts` builds `/agents.md`, `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/.well-known/lolly.json`, pinned by `tests/docs-agents.test.ts` |
| CLI | `shells/cli/bin/lolly.ts:32-175` (`USAGE` is the reference), `src/batch.ts`, `src/smoke.ts` |
| Render action | `action/action.yml`, `run.mjs` (composite, `args-json`, `rows`, `browser`) |
| lolly-work | `docs/api.md` (document verbs `:397-448`, batch, links, sessions, error codes `:364-386`), `docs/renders.md` (renders and render-batches), `cli/` (`lw renders …`) |

The drift: `docs/mcp.md:54` says "The seven tools" and omits `lolly_compile`, `lolly_inspect`, `lolly_measure`, `lolly_validate`, `lolly_diff`, `lolly_package` and the `files_*` set, so an agent reading only that page never learns the validate-before-render step the server's own prompts insist on.

The three critical tools:

- **chart** (`community/chart/tool.json`, 133 inputs, nearly all with `urlKey` aliases: `d` for the CSV, `ct` chart type, `t` and `st` titles, `pl`/`pz`/`pb`/`p2` palette, `sm`/`so`/`cv` stacking, sort and curve, `c1`..`c6` colours, 3D and motion fields); the `chart-v1` spec schema (`schemas/chart-v1.schema.json`, identical copy in `packages/core/schema/`), engine model `engine/src/chart-spec.ts`.
- **design** (`community/design/tool.json`, 13 top-level inputs and the 99-field `boxes` block that is the document; `packages/core/src/design-v1.ts` read model, `inspectDesignV1`, `layerOperations` and `layerPatches` addressed by stable id; ten templates under `community/design/templates/`).
- **deck**: target `community/deck-studio` (public, `spec` markdown or JSON plus a `deck` blocks input; the dialect in `engine/src/deck-md.ts:12-49`, round-trip test `tests/deck-roundtrip.test.ts`). `deck-builder` is in the private SUSE pack and must not be the reference.

## 2. Deliverable

`skills/lolly/` in the umbrella, published into `/info` through the docs build and mirrored to `.claude/skills/lolly/` so Claude Code loads it in any checkout:

- `SKILL.md`: the decision table (which surface for which outcome), the canonical workflow (discover, describe, validate, render or build a link, share the editable link), the three rules an agent must not break (never invent an input id, always validate a document before rendering, prefer the editable link over bytes when the human will iterate), and pointers to the references.
- `reference/url-mode.md`: reserved params, compact encoding, packed links, embed grammar, the multi-artboard and `s=` rules, ten worked URLs.
- `reference/surfaces.md`: the public render route and its limits; MCP transports, auth, every tool with its input shape, resources and prompts; the CLI commands and export flags with `--no-provenance` for byte-stable output; the render action; lolly-work's `/api/v1` with async jobs, idempotency, batch and render-batches, the error codes.
- `reference/tools.md`: every catalogue tool in one generated table (id, name, category, formats, `requires`, capabilities, purpose), utilities grouped separately.
- `reference/chart.md`, `reference/design.md`, `reference/deck.md`: inputs with aliases, document formats with schemas, and worked examples (a bar chart from CSV by URL; a poster, a carousel and a timed video through `layerOperations`; a five-slide deck from markdown through the CLI).

A generator, `scripts/gen-agent-skill.ts`, writes the tool table and the input tables from `catalog/tools/index.json` and the manifests, and `tests/agent-skill.test.ts` fails on drift, names every MCP tool in `tools.ts`, and checks each worked URL parses through `parseUrlState` with no unknown input. Fix `docs/mcp.md` to list thirteen tools in the same PR.

## 3. Acceptance

An agent given only the skill produces: a chart PNG by URL, a design SVG through MCP with one `layerOperations` add, and a five-slide deck PPTX through the CLI, each without reading another document. The generated tables match the catalog; the skill appears at `/info/skills/lolly` and loads in Claude Code from a checkout.

## 4. Size and order

M. Umbrella and `lolly-docs`. Independent of every other plan; can run first. Order inside: the generator and tool table, then the three tool references, then `SKILL.md`, then the docs fix and the publish wiring.
