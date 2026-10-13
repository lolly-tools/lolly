# Tool guidance and agent invitations

Lolly supplies an overall skill and a skill for the open tool. Guidance describes
operations; an invitation separately grants access to a document. Open Share to
name an agent and copy instructions. Tools without a supported live connection
offer a guidance handoff with an editable link and the compatible skill pair.

The overall skill is published at `/info/skills/lolly/SKILL.md`. Public tool
skills are at `/info/skills/tools/<id>/SKILL.md`, with `metadata.json` and a
shared `/info/skills/tools/index.json`. Metadata records the tool version,
compatible version range, skill revision, reference files, byte sizes and SHA-256
hashes. MCP resources are `lolly://skill` and `lolly://tool/{id}/skill`; the latter
resolves the server's actual mounted tool and includes reference contents.

Every loaded tool has a baseline generated from its manifest, even for private
or installed tools. Optional authored guidance lives beside `tool.json`:

```text
SKILL.md
skill.json
skill/workflow.md
```

`SKILL.md` uses standard skill frontmatter with `name` and `description`.
`skill.json` declares compatibility and portable references:

```json
{
  "version": 1,
  "toolId": "example",
  "toolVersionRange": "^1.0.0",
  "skillRevision": "1.0.0",
  "references": ["skill/workflow.md"]
}
```

References must be Markdown or JSON paths within `skill/`, with no traversal.
The skill is limited to 64 KiB, metadata to 4 KiB, and at most 16 authored
references within 512 KiB total. The generated `reference/inputs.json` contains
the actual input definitions. An incompatible or malformed authored skill falls
back to the manifest with a reason; unverified bytes cannot become trusted
guidance. The loader keeps the same source reader and signature checks used for
the tool revision, rather than loading another catalog's skill by ID alone.

Tool bundles and offline pins carry authored guidance and references. A generated
baseline needs only the installed manifest. Copy instructions embed the actual
compatible guidance and identify the source version; public links are discovery
aids, rather than authority over a private or installed revision.

Run `node scripts/gen-agent-skill.ts` after changing authored guidance or manifests.
`--check` verifies all public outputs and the overall `.claude` mirror. Public
generation uses community and lolly-start packs explicitly, so a private pack's
presence cannot add private guidance to the public index. Pack materialization
and catalog signing carry tool-local files through the existing content paths.

For live editing, use the adapter and capabilities reported by the open editor.
A Design layer adapter supports layer operations; an input adapter supports
declared JSON input values. File bytes and device actions require separate
supported routes. Read grants refuse mutations at the operation boundary.
Read current revision, verify document identity and inspect after a permitted
change. The live context supplies the open editor's effective design system.
