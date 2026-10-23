# Tool skills

An AI agent does better work with a tool when it knows what the tool is for and how its inputs behave. Every tool therefore has a **skill**: guidance an agent can read before it fills in the inputs. This page is for tool authors who want to write that guidance and ship it with a tool.

Guidance describes operations; it grants nothing. Access to a person's document comes separately, from an invitation they choose to make.

## Where skills come from

Lolly supplies two skills to an agent: an overall skill for Lolly and a skill for the tool that is open.

Every loaded tool has a **baseline skill generated from its manifest**, including private and installed tools. You can add authored guidance beside `tool.json`:

```text
SKILL.md
skill.json
skill/workflow.md
```

`SKILL.md` uses standard skill frontmatter with `name` and `description`, and the `name` starts with `lolly-`. `skill.json` declares compatibility and the reference files:

```json
{
  "version": 1,
  "toolId": "example",
  "toolVersionRange": "^1.0.0",
  "skillRevision": "1.0.0",
  "references": ["skill/workflow.md"]
}
```

References must be Markdown or JSON paths inside `skill/`, with no path traversal. The generated `reference/inputs.json` holds the tool's actual input definitions.

| Limit | Value |
| --- | --- |
| `SKILL.md` | 64 KiB |
| `skill.json` | 4 KiB |
| Authored references | At most 16 files; with `SKILL.md`, 512 KiB in total |

An incompatible or malformed authored skill falls back to the manifest baseline, with the reason recorded, so unverified bytes never become trusted guidance. The loader reads the skill through the same source reader and signature checks it uses for the tool revision, rather than loading another catalog's skill by id alone.

## Where agents find skills

- **On the docs site.** The overall skill is at `/info/skills/lolly/SKILL.md`. Public tool skills are at `/info/skills/tools/<id>/SKILL.md`, each with a `metadata.json`, and `/info/skills/tools/index.json` lists them. The metadata records the tool version, the compatible version range, the skill revision and each reference file with its byte size and SHA-256 hash.
- **Over MCP.** The resources are `lolly://skill` and `lolly://tool/{id}/skill`. The second resolves the tool the server has actually mounted and includes the reference contents.
- **In tool bundles and offline pins**, which carry authored guidance and references. A generated baseline needs only the installed manifest.

Copied agent instructions embed the actual compatible guidance and say which version it came from. Public links help agents discover skills; they are not the authority over a private or installed revision.

## What people see

In the app, **Share** lets a person name an agent and copy instructions for that agent. A tool without a supported live connection offers a guidance handoff instead: an editable link plus the compatible pair of skills. Inviting an agent into a shared document is a Lolly Work feature, covered on [Document agent invitations](/info/work-document-agents.html), and [AI agents](/info/ai-agents.html) covers connecting an agent to Lolly.

For live editing, the agent uses the adapter and capabilities the open editor reports. A Design layer adapter supports layer operations, and an input adapter supports the declared JSON input values. File bytes and device actions need their own supported routes. A read-only grant refuses changes at the operation boundary. The agent reads the current revision, checks the document's identity and inspects the result after each permitted change. The live context supplies the open editor's effective design system.

## Regenerate after a change

Run `node scripts/gen-agent-skill.ts` after changing authored guidance or manifests; `--check` verifies every public output and the overall `.claude` copy. Public generation reads the community and lolly-start packs explicitly, so a private pack on your machine cannot add private guidance to the public index. Pack materialisation and catalog signing carry tool-local files through the existing content paths.
