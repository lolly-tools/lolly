# Authoring Tools

A tool is a manifest, a template and optional hooks or assets. The same inputs and render path work across Lolly’s shells. This overview helps you choose the part of authoring you need.


## Choose a guide

| Task | Guide |
| --- | --- |
| Declare identity, rendering, examples and a short walkthrough. | [Tool manifests](/info/tool-manifest.html) |
| Choose input types, visibility, profile prefills and common meanings. | [Tool inputs](/info/tool-inputs.html) |
| Build repeating groups, editor canvases and bounded image framing. | [Structured inputs and canvas controls](/info/tool-structured-inputs.html) |
| Accept library assets or local files and return transformed output. | [Assets and file utilities](/info/tool-files.html) |
| Write templates and styles that work across vector, canvas and data exports. | [Templates and rendering](/info/tool-rendering.html) |
| Provide curated starting points, saved templates and Design motion. | [Tool templates and presets](/info/tool-starters.html) |
| Add portable behavior, live media, recording, speech and allowed network access. | [Tool hooks and host capabilities](/info/tool-hooks.html) |
| Compose tools and resolve brand-specific logos and overlays. | [Composition and brand overlays](/info/tool-composition.html) |
| Validate, distribute, test and translate a reusable tool. | [Publish and localize a tool](/info/tool-publishing.html) |

## Start from a design you already have

Use [Share with rules](/info/create-a-tool.html) to turn a Design document into a constrained tool without writing a manifest. Choose editable inputs, approved options and layouts, then share one portable `.lolly`. Start from the active design system’s tokens and components, or import existing artwork and review its appearance.

A saved Design template is a starting point under Design. A tool made with Share with rules exposes only its declared inputs. Keep the master separately for revisions.

## Authoring with AI Agents

Give an agent the intended output, representative input values, the design system and source artwork. Ask it to build ordinary tool data against the manifest and host contracts, then validate and render the result. The guides below explain those contracts so you can review what it produced.

## Anatomy

```
community/your-tool-id/
├── tool.json           # required - declares inputs, outputs, identity
├── template.html       # required - Handlebars-flavoured markup
├── styles.css          # optional - auto-scoped to #tool-canvas
├── hooks.js            # optional - imperative escape hatch
├── icon.svg            # optional - gallery icon, drawn in currentColor (recommended)
├── card.svg            # optional - gallery card override (or card.html, card.png, card.webm)
├── template.ics        # optional - sibling templates for text and data formats (.ics, .csv, .vtt, …)
├── presentation.js     # optional - portable HTML runtime for render.portable
├── templates/          # optional - curated starting points (see Tool templates and presets)
├── i18n/               # optional - <lang>.json string overlays (see Publish and localize a tool)
├── SKILL.md            # optional - authored agent guidance, with skill.json and skill/ (see Tool Skills)
├── lib/                # optional - vendored scripts and data the tool loads
└── assets/             # optional - tool-local images, fonts, etc.
```

Without a card file, the gallery shows a preview of the tool's own output, rendered by `pnpm run previews`.

## Design system colours in templates and styles

The canvas carries the design system's colour roles as CSS custom properties, so a template or `styles.css` can use them with no hook. They hold the colours of the artefact's own choices: its look (light or dark) and its colourway.

| Variable | Holds |
| --- | --- |
| `--brand-primary` | The lead colour of the artefact's colourway |
| `--brand-on-primary` | Text and icons on the lead colour |
| `--brand-secondary` | The partner colour |
| `--brand-surface` | The background |
| `--brand-text` | Body text |
| `--brand-muted` | Quieter text |
| `--brand-edge` | Rules and borders |
| `--brand-lead-1` to `--brand-lead-<n>` | Every colourway's lead in the artefact's look, canonical first |
| `--brand-lead-count` | How many lead variables the canvas carries |

Always give a fallback, as in `var(--brand-secondary, #444)`. A role the design system does not define is left unset, so the fallback is what draws. The lead variables are set only when the design system has two or more colourways, and a canvas carries at most 16 of them; with one colourway there are none, and the canvas carries exactly the variables it always did. A second stripe that follows the second lead, and the partner colour when there is no family:

```css
.stripe + .stripe { background: var(--brand-lead-2, var(--brand-secondary, #444)); }
```

The web shell and the CLI paint the same variables, and the lead variables come from one engine function in both, so a template renders the same in each. The brand residue test (`tests/brand-residue.test.ts`) fails a tool template that reads any of these variables with no fallback. For a colour input that offers only the colourway leads, see `palette` in [Tool inputs](/info/tool-inputs.html).

## Generate a tool from Design

Designers can author portable tools through [Share with rules](/info/create-a-tool.html) without editing a manifest. Generated tools use the normal engine and strict sideload runtime. See [Design tool contract](/info/design-tool-contract.html) for compilation, dependencies and revision semantics.

## Opening catalog assets

An optional `openWith` array lets Assets offer a tool as an editing destination. Each entry has a permanent `id`, accepted asset `types`, optional lowercase `formats`, and a `binding`. The entire selection must match. Omit `multiple` for one source; set it to `true` only when the destination can receive the selection in one session. Animated rasters require `animated: true`, which promises to keep their animation.

For an ordinary tool input, bind its declared id explicitly:

```json
{
  "openWith": [
    {
      "id": "source-photo",
      "types": ["raster"],
      "formats": ["png", "jpg", "jpeg", "webp"],
      "binding": { "kind": "input", "input": "image" }
    }
  ]
}
```

The binding must name an asset, file, text or longtext input. File limits and acceptance filters still apply. A multiple input binding must name a file input that declares `multiple: true`. Opening creates a fresh tool session; source asset references retain their names, versions and attribution. File input bytes remain transient, following the normal file-input contract.

Editor bindings use supported shell adapters: `canvas` places image references on a blank canvas, `timeline` places timed media and opens Sequence, and `text` uses the Text editor's existing source-aware handoff. These declarations contain no route strings or executable methods. Tools without opening declarations remain valid and do not appear through guessed input bindings. The web shell checks the actual loaded manifest again before opening.

Assets also offers Convert, which lists transformations supported by the source and device before showing their settings. Conversion support comes from concrete file operations, separately from `openWith` and `render.formats`. Declaring an export format does not claim that the tool can convert arbitrary files into that format. Existing on-device utility conversion keeps its watermark and provenance policy. PDF page splitting produces a ZIP of static single-page PDFs; PDF page rendering produces a ZIP of PNG images. Their fidelity notes and refusal conditions appear before conversion.

### Personal values in links

Declare `sharePrivacy: "personal"` on an input whose content needs review before
sharing. The web shell omits that input from generated links and automatic
address updates, then offers a separate choice in the Share dialog. Inputs bound
to profile fields follow the same policy automatically. Explicit URL and CLI
values still load, and local saved sessions retain the values.

A tool relying on this declaration must require engine 1.261.0 or later. The
property does not encrypt an input, alter an export or sanitize its content.

## Colours that are the content

A design system can offer several colourways, and a person picks one per piece in the tool sidebar's **Design system** section. Every colour a tool links to the design system follows that choice, which is what most tools want. A tool whose colours are its content, such as a tonal ramp or a palette pinned to a dataset, can opt out in its manifest:

```json
{ "tokenAxes": { "colourway": "ignore" } }
```

A switch redraws the mounted tool in place, with no reload. Linked colours and `var(--brand-*)` variables follow by themselves; a hook that keeps colours it read from `host.tokens` reads them again when `onInput` runs with `id: '__tokens'`, as [When the theme or colourway changes](/info/tool-hooks.html#when-the-theme-or-colourway-changes) describes.

The sidebar offers a group only when switching it changes what the tool draws, so a tool that never reads a colour a group changes needs no field: the group simply does not appear. Lolly works this out from the tool's own files and its current values. The colours a tool reads are the canvas variables its template, styles, hooks and portable presentation name (`var(--brand-primary)` and the rest), the token references its inputs link, and the references its hooks pass to `host.tokens.resolve`. A reference a hook finishes at run time, such as `'{asset.logo.' + variant + '}'`, counts every token under its fixed start. A hook that reads the colour list or the token set, a reference built from no fixed start, module hooks and a tool that composes another tool all count as reading every token, so every group that changes a token stays. A treated picture counts as changing with every choice, because a photo look can keep a variant per theme. Declare `tokenAxes` when the tool does read the colours a group changes and must still keep its own.

The keys are the kinds of theme group described in [What a theme group means](/info/token-workflows.html#what-a-theme-group-means): `mode`, `colourway`, `expression`, `medium`, `contrast`, `density`, `campaign` and `brand`. The only value is `"ignore"`. For each kind it ignores, the tool renders in that group's canonical option whatever a link, a saved session or the design system's stored choice asks for, and the sidebar does not offer that group in this tool. The pin covers every colour the render reads, so a print export uses the CMYK or spot build the design system authored for the canonical option. `"mode": "ignore"` keeps a print piece in the canonical look; in a design system that declares no `mode` group, the light and dark themes with no group count as the mode. When a link or the CLI asks for an option the tool ignores, `lolly run` prints a `THEME_CHOICE_IGNORED` warning and an MCP render adds the same sentence to its warnings, so the request is never dropped without a word. Engines older than the field refuse a manifest that declares `tokenAxes`, so a tool that uses the field raises its `engineVersion` floor to the release that added the field, as listed in `engine/CHANGELOG.md`.
