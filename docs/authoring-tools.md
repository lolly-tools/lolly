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
├── thumb.png           # optional - gallery thumbnail (recommended)
├── templates/          # optional - curated starting points (see Tool templates and presets)
├── i18n/               # optional - <lang>.json string overlays (see Publish and localize a tool)
└── assets/             # optional - tool-local images, fonts, etc.
```

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
