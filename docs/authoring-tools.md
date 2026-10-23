# Build a tool

A Lolly tool is a small folder of data. `tool.json` lists what people can change. `template.html` draws the result. A `hooks.js` file is added only when the picture needs a calculation the template cannot do.

From that folder Lolly builds the sidebar, draws the canvas and offers the export formats you allow. The same folder runs unchanged in the web app, the desktop apps and the command line, because each of them reads the folder through one engine.

![tool.json, template.html and the optional hooks.js feed one engine, which builds the sidebar controls, draws the live canvas and writes the exported files.](/info/diagrams/concepts/tool-lifecycle.svg)

You do not need code to make a tool. If you already have a finished design, [Share with rules](/info/create-a-tool.html) turns a Design document into a tool when you choose the parts people may edit. Those tools are ordinary tool folders too, compiled for you and run by the strict sideload runtime; [Design tool contract](/info/design-tool-contract.html) covers how.

This guide is for writing the folder yourself. Start with the two-file tool below, then use the reference pages for each part.

## Your first tool

A working tool needs two files. This one makes a social card with a heading and a background colour.

::: cols
## tool.json

```json
{
  "id": "hello-card",
  "name": "Hello card",
  "version": "1.0.0",
  "engineVersion": "^1.0.0",
  "status": "community",
  "render": {
    "width": 1200, "height": 630,
    "formats": ["svg", "png", "pdf"]
  },
  "inputs": [
    { "id": "heading", "type": "text",
      "label": "Heading", "default": "Hello" },
    { "id": "background", "type": "color",
      "label": "Background", "default": "#2a1a5e" }
  ]
}
```

## template.html

```html
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 1200 630"
     width="1200" height="630">
  <rect width="1200" height="630"
        fill="{{background}}"/>
  <text x="600" y="350"
        text-anchor="middle"
        font-size="96" font-weight="700"
        font-family="sans-serif"
        fill="#ffffff">{{heading}}</text>
</svg>
```
:::

Each declared input becomes a control in the sidebar, a URL parameter and a CLI flag, all with the same `id`. The template prints the current values into `{{heading}}` and `{{background}}`, escaped for you. The seven top-level fields in `tool.json` are the ones the schema requires; [Tool manifests](/info/tool-manifest.html) covers the rest.

::: figure authoring-tools-first-tool
The hello card rendered with `--heading="Hello, Lolly"`: one rectangle in the background colour and one line of text.
:::

Try the folder in one of two ways:

::: timeline
- <!--i:download--> **On any Lolly, with no clone.** Zip the folder and drop the zip on [lolly.tools](https://lolly.tools) or another Lolly. Choose **Install this tool** and accept the trust prompt; the tool opens on that device. Drop an edited zip again to replace your copy. [Try it without the monorepo](/info/tool-publishing.html#try-it-without-the-monorepo) has the details.
- <!--i:code--> **In a clone, from the terminal.** Put the folder at `community/hello-card/` and run `pnpm run cli hello-card --heading="Hello, Lolly" --output=hello.svg`. Run `pnpm run cli hello-card` alone to list its inputs.
:::

The template's root is an `<svg>`, so the command line renders it with no browser. A template built from HTML renders the same way in the web and desktop apps, and needs the CLI's browser tier on the command line ([Render with the CLI](/info/cli-rendering.html)).

## What each file does

Only `tool.json` and `template.html` are required. Add the others when the tool needs them.

| File | What it does | Guide |
| --- | --- | --- |
| `tool.json` | Identity, inputs, export formats and gallery details. The gallery's About card reads it back to people. | [Tool manifests](/info/tool-manifest.html), [Tool inputs](/info/tool-inputs.html) |
| `template.html` | Handlebars markup for the canvas and every export. | [Templates and rendering](/info/tool-rendering.html) |
| `styles.css` | Styles scoped to the tool canvas (`#tool-canvas`). | [Templates and rendering](/info/tool-rendering.html#styles-styles-css) |
| `hooks.js` | Computed values, live camera or audio, file transforms and allowed network access. | [Tool hooks and host capabilities](/info/tool-hooks.html) |
| `template.<ext>` | Sibling templates for text and data formats such as `.ics`, `.csv` and `.vtt`. | [Data formats](/info/tool-rendering.html#data-formats-json-csv-ics-vcf) |
| `presentation.js` | The playback runtime for a portable HTML export (`render.portable`). | [Animated HTML](/info/tool-rendering.html#animated-html) |
| `icon.svg` | The gallery icon, drawn in `currentColor` so the app can colour the icon to match its theme. Recommended. | |
| `card.svg`, `card.html`, `card.png` or `card.webm` | A gallery card of your own. Without one, the gallery shows a preview of the tool's output, rendered by `pnpm run previews`. | |
| `templates/` | Curated starting points and presets. | [Tool templates and presets](/info/tool-starters.html) |
| `i18n/<lang>.json` | Translated labels, help and options. | [Publish and localize a tool](/info/tool-publishing.html#localizing-a-tool) |
| `SKILL.md`, `skill.json`, `skill/` | Guidance for agents that use the tool. | [Tool skills](/info/tool-skills.html) |
| `lib/` | Vendored scripts and data the tool loads. | |
| `assets/` | Tool-local images and fonts. | [Assets and file utilities](/info/tool-files.html) |

## Find the part you need

Each guide below has a public reference tool in `community/` that you can open in Lolly and read in the repository.

| When you want to | Guide | Reference tools |
| --- | --- | --- |
| Declare identity, export formats, examples and a walkthrough | [Tool manifests](/info/tool-manifest.html) | `chart`, `qr-code` |
| Choose input types, show inputs conditionally, prefill from the profile | [Tool inputs](/info/tool-inputs.html) | `qr-code`, `color-palette` |
| Repeat rows, edit on the canvas or frame an image | [Structured inputs and canvas controls](/info/tool-structured-inputs.html) | `meeting-planner`, `deck-studio`, `diagram-builder`, `org-chart`, `frame` |
| Accept a library asset or the person's own file | [Assets and file utilities](/info/tool-files.html) | `strip-data`, `filter` |
| Write the template, the styles and data formats | [Templates and rendering](/info/tool-rendering.html) | `wordmark`, `meeting-planner`, `snippet` |
| Ship starting points and presets | [Tool templates and presets](/info/tool-starters.html) | `design`, `qr-code` |
| Add logic, live media, recording or network access | [Tool hooks and host capabilities](/info/tool-hooks.html) | `qr-code`, `filter`, `voice-recorder`, `record` |
| Embed one tool in another, or adjust a community tool for a brand | [Composition and brand overlays](/info/tool-composition.html) | `certificate`, `link-card` |
| Test, share, publish and translate | [Publish and localize a tool](/info/tool-publishing.html) | `qr-code` |
| Help agents use the tool | [Tool skills](/info/tool-skills.html) | |

## Build with an agent

An AI agent can write the folder for you. Give it the intended output, a few representative input values, the design system and any source artwork. Ask it to build ordinary tool data against the manifest and host contracts, then to validate and render the result with the CLI. The guides above are what you review its work against. [AI agents](/info/ai-agents.html) covers connecting an agent to Lolly, and [Tool skills](/info/tool-skills.html) covers the guidance a tool gives the agents that use the tool.
