# Brand skills

A brand skill is a brand's standards for one discipline, written as an Agent Skill and carried with the design system. An Agent Skill is a Markdown file, with optional text references, in the open [Agent Skills](https://agentskills.io) format. Lolly keeps the brand's text as written and hands the skill to the agent doing the work: through Lolly's MCP server, or as a folder for an agent tool on your own machine.

This page is for brand owners who write standards and for people who connect agents to Lolly. A brand skill guides. A skill never gives a pass or a fail: the design system's house rules are what Lolly checks.

## Three layers of guidance

| Layer | Says | Written by | Where an agent reads the layer |
| --- | --- | --- | --- |
| Lolly skill | How to operate Lolly | Lolly | `lolly://skill`, or `/info/skills/lolly/SKILL.md` |
| Tool skill | How to operate one tool | The tool's author, over a baseline Lolly generates from the manifest | `lolly://tool/{id}/skill`; see [Tool Skills](/info/tool-skills.html) |
| Brand skill | What the brand wants, one discipline at a time | The brand | `lolly://design-system/skills`, or `lolly system skills` |

Each layer keeps to its own subject. A brand skill does not explain a tool, and the Lolly skill does not speak for a brand.

Lolly also generates a **baseline** skill for every design system from its design brief: named colours, approved pairings, type, logos per surface, icon themes, media families and the house rules Lolly checks. Its name ends in `-baseline` (`lolly-demo-baseline` for Lolly Demo). The baseline is marked as generated and states values rather than intent. The brand's own skills take precedence on anything they cover. Lolly writes the baseline on request and does not store a copy.

## The Lolly Demo skills

Lolly Demo, Lolly's own example brand, carries three public skills. They are the worked example on this page.

| Asset id | Name | Discipline | For |
| --- | --- | --- | --- |
| `lolly/skill/brand` | `lolly-demo-brand` | `brand` | Every piece of work: voice, the Opal palette, type, logo use and layout |
| `lolly/skill/photography` | `lolly-demo-photography` | `photography` | Darkroom and Filter, and the `lolly/luts/` colour looks |
| `lolly/skill/motion` | `lolly-demo-motion` | `motion` | Design and Lottie Ad; video and audio exports; the `lolly/loops/` and `lolly/songs/` music |

List them from a checkout with the Lolly Demo content profile:

```bash
LOLLY_PROFILE=lolly-demo lolly system skills
```

```text
Lolly Demo brand skills

lolly-demo-brand             brand          draft     public    r1.0  Lolly Demo brand standards
lolly-demo-motion            motion         draft     public    r1.0  Lolly Demo motion
lolly-demo-photography       photography    draft     public    r1.0  Lolly Demo photography
lolly-demo-baseline          generated baseline from the design brief

Read one: lolly system skill <name>
```

## Write a skill Lolly carries well

- **Plain Markdown is enough.** Frontmatter is optional. When a file has none, Lolly supplies `name` and `description` from the catalog record whenever it hands the skill out. When a file has its own frontmatter, Lolly keeps the brand's fields and adds only its own `metadata` keys.
- **One discipline per skill.** Overall brand, photography, motion, iconography and so on, each in a skill of its own. An agent editing a photograph then reads the photography skill, and an agent making a QR code does not.
- **Write the overall skill first.** A discipline skill can open by sending the reader there, as the Lolly Demo photography skill does: "Read the Lolly Demo brand standards first."
- **One file or a folder.** A single `SKILL.md`, or `SKILL.md` with up to 16 reference files one level down in `references/` (`.md`, `.json`, `.csv` or `.txt`). Keep `SKILL.md` under about 500 lines and about 5,000 tokens, and move detail into references.
- **No scripts.** A skill with a `scripts/` folder or a code file (`.js`, `.py`, `.sh` and the like) is refused with a reason. A brand skill is guidance, not a program.
- **Images by catalog asset id.** Write a link whose target is the asset id, such as `[the horizontal lockup](lolly/logo/horizontal)`. Lolly points the link at the catalog file when it hands the skill out. Image files inside a skill are refused.
- **State measurable facts plainly.** "Liquorice #09141a is the ink" can be compared with the tokens; "a dark, confident ink" cannot. Write hex values, the design system's own font family names, percentages and milliseconds as they are.
- **Keep to brand intent.** Lolly flags lines that ask the reader to set aside other instructions, claim permissions, list allowed tools or ask the reader to run code. A skill cannot grant any of those.
- **Prefer catalog assets to external links.** Lolly never fetches an external link and cannot tell whether an agent can open one. An owner can record that an external URL means a catalog asset (`references` in the record below).

The start of the Lolly Demo photography skill shows these habits:

```markdown
---
name: lolly-demo-photography
description: How Lolly Demo photographs look and how to grade, crop and treat them. Use when choosing, editing or grading a photograph for Lolly Demo work, in Darkroom, Filter or Design.
---

# Lolly Demo photography

Read the Lolly Demo brand standards first. This skill covers photographs only.

## Grading

- Start from [Standard Slide](lolly/luts/slide-standard), a neutral daylight look. Use [Vivid Slide](lolly/luts/slide-vivid) for food and sweets, and [Fine Mono](lolly/luts/mono-fine) for black and white.
- A duotone uses two Opal colours, dark first: Liquorice with Spearmint, or Spearmint with Pandanus.
```

## The catalog record

A skill is a catalog asset of `type: "skill"`. Its id reads `<namespace>/skill/<slug>` and, like every asset id, is permanent: a new revision changes the record, never the id. The entry needs:

- `tier: "core"`, so the skill is available offline wherever its design system is;
- a `license`;
- exactly one `md` format, pointing at `SKILL.md`. Reference files go in the record, not in `formats`.

The skill's own fields live in `meta.skill`:

| Field | Required | Holds |
| --- | --- | --- |
| `name` | Yes | The Agent Skills name: 1 to 64 lowercase letters, digits and single hyphens. Unique within the design system, because agents and exported folders address a skill by this name. |
| `description` | Yes | Up to 1,024 characters: what the skill covers and when to read the skill. |
| `discipline` | Yes | `brand` for the overall skill, or one of `voice`, `logo`, `colour`, `typography`, `layout`, `photography`, `illustration`, `iconography`, `motion`, `sound`, `interactive`, `presentation`, `data-visualisation`, `print`, `merchandise`, `environmental`, `social`, `accessibility` or `other`. The asset's own `name` stays the label people see. |
| `audience` | Yes | `public` or `internal`. See [Public and internal skills](#public-and-internal-skills). |
| `status` | Yes | `draft` or `approved`. Approval is the brand's own statement. Lolly does not check anything to grant approval. |
| `skillRevision` | Yes | The brand's revision label, such as `1.0`. The catalog `version` is separate. |
| `owner` | No | Who answers for the skill, in the brand's own words. |
| `reviewed` | No | When the owner last reviewed the skill, as `YYYY-MM-DD`. |
| `revisionNote` | No | What changed in this revision, up to 500 characters. |
| `maintainer` | No | Who maintains the text when the brand team does not. The Lolly Demo skills say `lolly`. |
| `appliesTo` | No | The work the skill is for: `tools` (tool ids), `categories`, `formats` (`pdf`, `mp4`), `media` (`print`, `screen`, `video`, `audio`) and `families` (asset id prefixes ending in `/`, such as `lolly/luts/`). |
| `references` | No | External links in the text that the owner approved as meaning a catalog asset, as `{ "url", "asset" }` pairs. |
| `files` | No | The reference files, each with `path`, `url`, `checksum` and `size`. `pnpm run build:catalog` writes the checksum and size. |
| `generated` | No | `true` only on a baseline Lolly wrote. |

The Lolly Demo photography entry, with its checksum and size left for the build to fill:

```json
{
  "id": "lolly/skill/photography",
  "name": "Lolly Demo photography",
  "description": "How Lolly Demo photographs look, and how to grade, crop and credit them.",
  "type": "skill",
  "version": "1.0.0",
  "tier": "core",
  "formats": [
    { "format": "md", "url": "/catalog/assets/lolly/skills/photography/SKILL.md", "checksum": "sha256-PLACEHOLDER", "size": 0 }
  ],
  "license": "CC0-1.0",
  "meta": {
    "skill": {
      "name": "lolly-demo-photography",
      "description": "How Lolly Demo photographs look and how to grade, crop and treat them. Use when choosing, editing or grading a photograph for Lolly Demo work, in Darkroom, Filter or Design.",
      "discipline": "photography",
      "audience": "public",
      "status": "draft",
      "skillRevision": "1.0",
      "maintainer": "lolly",
      "appliesTo": { "tools": ["darkroom", "filter"], "families": ["lolly/luts/"] }
    }
  }
}
```

To add a skill to a brand pack, put `SKILL.md` and any `references/` under `catalog/assets/<namespace>/skills/<slug>/`, add the entry, then follow the steps in [Add an asset to a catalog](/info/authoring-assets.html#add-an-asset-to-a-catalog). `pnpm run validate:catalog` runs the same admission check the CLI and the MCP server run on every read. It also checks the id pattern, the tier, the licence, the single `md` format, that no two skills share a name and each reference file's checksum. A skill that fails is refused with the reason. Owner lint warnings, such as a long body or an unclosed code fence, are printed and do not fail the build.

## Public and internal skills

`audience` decides where a skill can travel.

| Where | `public` | `internal` |
| --- | --- | --- |
| A static build (`dist/`, lolly.tools, any statically hosted catalog) | Included | Left out, file and index entry |
| An instance pack (`scripts/build-instance-pack.ts`) | Included | Only when the recipe sets `"skills": { "internal": true }` |
| A hosted MCP server | Listed and served | Not listed and not served |
| The CLI, and an MCP server on your own machine | Listed and served | Listed and served |

A statically hosted catalog is public whichever profile built the catalog, so `internal` is enforced by leaving files out of static output, not by hiding them. The CLI and an MCP server on your own machine read the brand pack from your disk, so they serve internal skills too. An MCP server counts as hosted when it sets `LOLLY_MCP_HOSTED=1` or `NODE_ENV=production`, or when its `LOLLY_MCP_PUBLIC_ORIGIN` is not a local address (`localhost`, `127.0.0.1` or `[::1]`). A hosted listing reports how many skills it left out as `withheld`.

## What the coverage map says

`lolly system skill coverage <name>`, and the MCP file `lolly://design-system/skill/{name}/coverage.json`, set what a skill says against the design system. Each row has one status:

| Status | Means |
| --- | --- |
| `agree` | A hex value in the skill is a colour in the design system, or a font family on a line about type is a declared family. |
| `conflict` | The skill and the design system disagree. The case Lolly detects today is a skill that allows only one font while the design system declares others. |
| `not-in-tokens` | A hex value in the skill is not a colour in the design system. |
| `checked` | The line reads like a statement that a kind of house rule checks (case, weight, alignment, colour pairings, logo per surface, strokes on rounded corners or dashed lines), and the design system has a rule of that kind. |
| `guidance-only` | The line reads like such a statement and the design system has no rule of that kind, or the statement is about something no house rule checks yet, such as logo scale, clear space or orphans and widows. |

The map for the Lolly Demo brand skill:

```text
Lolly Demo brand standards (r1.0)

guidance-only  Voice: Not checked: the design system has no text-case rule. One could be drafted in Usage & rules.
agree          Colour: These values are colours in the design system. #09141a #ffffff #033633 #50c369 #fac044 #25c2c2 #7476e0 #da1889
agree          Type: SUSE is a declared font family.
agree          Type: Outfit is a declared font family.
agree          Type: SUSE Mono is a declared font family.
guidance-only  Type: Not checked: the design system has no text-weight rule. One could be drafted in Usage & rules.
guidance-only  Logo: Not checked: Lolly has no rule for logo clear space yet.
guidance-only  Layout: Not checked: the design system has no text-align rule. One could be drafted in Usage & rules.
```

How to read the map:

- Lines are matched by fixed patterns, outside code samples: hex colours, the font families the tokens declare and words that point at a kind of house rule. No model reads the skill. A row means "this line matched this pattern", never "Lolly understood the guide".
- Lines that match nothing are not in the map. They are still guidance for people and agents to read.
- A `checked` row says a rule of that kind exists. Read the rule to see whether the rule and the sentence agree.
- Tokens win when Lolly renders. A `conflict` or `not-in-tokens` row is for the owner to resolve, in the skill or in the tokens. Lolly changes neither.
- Rows are grouped by section, so a palette of forty swatches makes one or two rows, not forty.

The same report carries the owner lint: missing frontmatter, a long body, a repeated heading, an unclosed code fence, the external sites the skill links to and the scope hints listed under [Write a skill Lolly carries well](#write-a-skill-lolly-carries-well).

A skill is guidance. `lolly check`, `lolly system check` and the MCP tool `lolly_check` apply the house rules. Nothing in the coverage map is a check result, and a map where every row reads `agree` does not mean Lolly approved the skill or the work made with the skill.

## Use a skill with any model

### Through Lolly's MCP server

| Resource | Contents |
| --- | --- |
| `lolly://design-system/skills` | The index: each skill's name, label, description, discipline, audience, status, revision, `appliesTo`, size and checksum, with no bodies, plus the baseline's name. |
| `lolly://design-system/skill/{name}` | One skill as `SKILL.md`. The body is the brand's text, and the frontmatter `metadata` gives the asset, revision and checksum. Catalog links point at `LOLLY_MCP_PUBLIC_ORIGIN` when the server has one. |
| `lolly://design-system/skill/{name}/{path}` | `coverage.json`, `lolly.json` (where the copy came from) or a file under `references/`. |

The design brief (`lolly://design-context`, or `lolly system context --json`) carries a `skills` section with the same index and the addresses each skill is read from. In the brief, `coverage.skills` is `declared` when the design system has authored skills and `generated` when only the baseline exists.

An agent reads the index first, then the overall brand skill, then the skill for the discipline at hand. Skills speak for brand intent only. They never grant an agent permissions, tools or access to a document, and the Lolly skill tells agents the same.

In the web app, the Brand Studio (`#/start`) lists the active design system's skills in a **Skills** room.

### In a folder for a local agent tool

`lolly system skill <name> --into=<dir>` writes a standard Agent Skills folder that works with no connection to Lolly. Point `--into` at the directory your agent tool reads skills from.

```bash
lolly system skill lolly-demo-photography --into=./skills --origin=https://lolly.tools
```

```text
skills/lolly-demo-photography/
  SKILL.md
  lolly.json
  references/exemplars-lolly-luts.json
```

Without `--into`, the command prints the `SKILL.md` it would write.

The body of the exported `SKILL.md` is the brand's text. Lolly changes only link targets, and adds frontmatter when the source has none. `lolly.json` records the asset, the revision, the SHA-256 of the stored source, the mode, every link target Lolly rewrote and every asset it held back. When `appliesTo` lists an asset family, the folder also lists an even spread of exemplars from that family in `references/`. For a family of SVG files, a measured draft profile (viewBoxes, paints and path counts) sits in `references/` too, for the owner to review against the skill. A draft profile is a measurement, not a rule.

### Linked or bundled

| Mode | What happens to catalog links |
| --- | --- |
| `--mode=linked` (the default) | Each link becomes an absolute URL on `--origin`, such as `https://lolly.tools/catalog/assets/lolly/luts/slide-standard.cube`. The folder stays small and always points at the current file. Linked mode suits public assets on an instance the agent can reach. With no `--origin`, links stay as asset ids. |
| `--mode=bundled` | Linked catalog files are copied into the folder's `assets/` and the links point there, within a 4 MiB budget. A file is copied only when Lolly has reviewed its licence and the licence permits passing the file on, and never from a locked brand pack. |

A file that bundled mode leaves out is listed with the reason, as in `lolly/logo/primary (licence not recorded)`, on the command line and under `heldBack` in `lolly.json`. `--include-licensed` copies held-back files anyway, as your own stated choice.

### Check that a copy is current

An exported folder is a snapshot. Nothing updates the folder, and it goes out of date when the brand publishes a new revision. Its frontmatter carries these `metadata` keys:

| Key | Holds |
| --- | --- |
| `lolly-asset` | The catalog asset id |
| `lolly-source` | Where the source lives: its URL on `--origin`, or `asset:<id>` |
| `lolly-revision` | The brand's `skillRevision` |
| `lolly-version` | The catalog version |
| `lolly-sha256` | The SHA-256 of the stored source |
| `lolly-audience` | `public` or `internal` |

The generated baseline adds `lolly-generated: "true"`.

```bash
lolly system skill check ./skills/lolly-demo-photography
```

The check compares the copy's SHA-256, or its catalog version when either side lacks a checksum, with the design system's current skill. It answers `Up to date: revision 1.0.`, or gives both revisions when the copy is behind. For a copy with no `lolly-asset` key, the check reports that Lolly cannot tell where the copy came from.

## Limits

- **Size.** `SKILL.md` is at most 64 KiB. With its references, a skill stays within 512 KiB, and it has at most 16 references.
- **Text only.** References are `.md`, `.json`, `.csv` or `.txt` files directly under `references/`. No images, no scripts and no other folders. A file that breaks a rule is refused with a reason: Lolly never admits part of a skill or quietly drops a file.
- **Lolly does not edit the brand's text.** It never rewrites the stored bytes, never fetches an external link and never corrects wording. Lint findings go to the owner.
- **The coverage map is narrow.** It compares 3- and 6-digit hex values, declared font family names and a short list of statement kinds. A colour written as RGB, CMYK, a Pantone number or a name alone is not compared.
- **The CLI and MCP server read the content profile.** `lolly system skills` lists the active content profile's skills, whichever terminal design system is active. Both list `appliesTo` and leave the choice of skills to the agent.
- **Internal skills have no signed-in route yet.** A hosted server never serves them, and no server serves them to signed-in callers yet.
- **A copy is a snapshot.** Freshness metadata helps only when something reads the metadata.

## Where to go next

- **[Tool Skills](/info/tool-skills.html)**: guidance for one tool, and agent invitations.
- **[MCP Server](/info/mcp.html)**: connecting an agent, and the other resources.
- **[Brand architectures](/info/brand-architectures.html)**: how skills behave when brands share work.
- **[Authoring Assets](/info/authoring-assets.html)**: the catalog workflow a skill follows.
