# Templates and rendering

The template is the picture. `template.html` is Handlebars markup filled with the current input values, and every export starts from it: the live canvas, the vector and raster files and the print PDF. This page covers writing the template and its styles so each of those exports comes out right, plus the sibling templates that produce data formats such as calendar files.

## The template (`template.html`)

Templates are Handlebars and **logic-less by design**, so people who are not programmers can read and change them. Logic goes in `hooks.js`.

```html
<div class="my-tool">
  {{#if heading}}
    <h1>{{heading}}</h1>
  {{else}}
    <p>(enter a heading)</p>
  {{/if}}

  {{#if logo}}
    <img src="{{asset logo}}" alt="" width="{{asset logo "width"}}">
  {{/if}}
</div>
```

- `{{value}}` - HTML-escapes by default. Always use this for user input.
- `{{{value}}}` - raw, no escape. Only for trusted, system-generated HTML.
- Block helpers: `{{#if}}`, `{{#each}}`, `{{#unless}}`. No arbitrary JS.

`wordmark` is about as small as a template gets: one string, one face, one weight. Everything below came from the link's parameters flowing into `{{ }}` slots.

![The Wordmark canvas rendering the word Handlebars at weight 800, the whole output of a template whose only moving part is one text value](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHandlebars%26weight%3D800%26size%3D150%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=at2-template-wordmark)

**Helpers.** The engine registers these in `engine/src/template.ts`, which is the authority on the list:

| Helper | What it does |
|---|---|
| `{{default x "fallback"}}` | `x` unless it's null/undefined, then the fallback. |
| `{{upper s}}` / `{{lower s}}` | Upper/lower-case a string. |
| `{{eq a b}}` | Strict equality - use inside a condition, e.g. `{{#if (eq kind "note")}}`. |
| `{{markdown body}}` | Render a **small Markdown subset** to safe HTML: `#`…`######` headings, `**bold**`, `*italic*`, `~~strike~~`, bullet and numbered lists, `[label](url)` links and `![alt](url)` images. Author text is HTML-escaped **before** any tag is introduced, and link/image URLs are scheme-allowlisted (links: http/https/mailto/tel; images add data:/blob:) - anything else renders as plain text. Images carry `class="md-image"` so a tool can size them. A list whose lines start with `>`, `<`, `^` or `v` gets a per-direction class (`md-arrow`, `md-arrow-left`, `md-arrow-up`, `md-arrow-down`) for matching arrow markers. The output is already safe HTML, so `{{markdown body}}` and `{{{markdown body}}}` both work. Used for `blocks` bodies, `table` cells and pasted Markdown. |
| `{{arrow text}}` | A leading `>` `<` `^` `v` becomes `→ ← ↑ ↓` (for directional labels). |
| `{{asset ref}}` | The resolved URL of an asset input. Use in `src`/`href`. |
| `{{asset ref "width"}}` | A specific field of the asset (`width`, `height`, …). |
| `{{media ref}}` | Emits the right element for **any** asset kind - `<img>`, `<video>` or a Lottie marker - from one call. Options hash: `class`, `style`, `loop`, `autoplay`, `muted`, `controls`, `fit` (`contain`/`cover`), `key` and `framing` (an input id, placed as `{{framing}}` does). |
| `{{framing "imageFraming"}}` | Emits the placement style and overlay marker for a framed image. Takes the framing input's **id**; see [Framing an image](/info/tool-structured-inputs.html#framing-an-image-one-pattern-every-tool). |
| `{{icsStamp d}}` / `{{rfcText s}}` / `{{csvCell s}}` | Data-format escaping for the sibling text templates; see [Data formats](#data-formats-json-csv-ics-vcf) below. |

**Emoji need nothing from you.** Whatever emoji reach the rendered text, typed into a field, arriving in a `blocks` body or written into the template as a default, the runtime draws them from the emoji set the person chose, as pinned vector artwork, after every paint and again at export. The same link therefore looks the same on a phone, in the CLI and in a PDF. Where no set is chosen, or the set lacks a glyph, a neutral placeholder is drawn, never a system glyph; on a device with no set at all, the characters are left as the template wrote them. One limit applies: a template whose **root** is an `<svg>` is skipped whole, because SVG cannot put a picture inside a line of text. The export records one source ingredient for each distinct glyph it placed in the file's Content Credentials, so the set's licence travels with the file.

The web sidebar adds an **Insert emoji** button to plain text, long text and plain block text fields, and a table column declared with `columnEditors: ["emoji"]` opens the same picker for its cells. URL, number, read-only and managed fields keep their usual controls. The picker asks for an emoji set on first use, can remember the set for new work and respects a set a document or link already pins.

### Canvas tools: readiness, the frame clock and GPU rendering

A template may paint into a `<canvas>` instead of markup, as `3d`, `synth`, `gradient` and `spatial-photo` do. The export reads that canvas back as pixels, so three small contracts keep exports correct:

| Contract | What to do | Without it |
| --- | --- | --- |
| **Readiness** | When the first frame arrives late (a model or library is loading), set `window.__toolHasReadySignal = true` at the top of the template script, then dispatch `tool:ready` on `document` once the first frame is painted. The shell waits for it before capturing. | A slow first frame exports blank. |
| **The frame clock** | For animated output (GIF, APNG, animated WebP and frame-by-frame video), store `canvas.__lollyFrameRender = function (t) { … }` on the canvas element. It renders the exact frame at loop time `t` in `[0, 1)`; stills call it with `0`. While the shell drives frames it sets `canvas.__lollyFrameDriven = true`, so stop your own `requestAnimationFrame` loop from advancing while the flag is set. | The export cannot ask for an exact frame. A function stored on `window` instead of the canvas leaks across tool navigation. |
| **Real-time video** | Mark the canvas `data-capture-stream`, and WebM or MP4 export records it live through `captureStream()` instead of frame by frame. | A self-looping animation is recorded frame by frame instead of as one continuous loop with no cut at the join. |

The frame clock also receives two optional arguments: the clip length in seconds and the export's pixel size as `{ width, height }`. A function that declares only `t` ignores them. During a clip every call carries both, including the extra calls an export makes to find which parts of the frame stay still and the repaint that follows, so a tool that reads them sees the same length and size on every frame.

**GPU rendering (WebGL, WebGPU).** Never let the export path read a GPU canvas directly. A WebGPU canvas is cleared as soon as its frame is presented and has no `preserveDrawingBuffer`, so anything read later is blank, and a WebGL canvas only survives the read with `preserveDrawingBuffer: true`, which costs memory and a copy per frame. Render into a detached scratch canvas instead and, inside the same frame callback, draw it onto the visible 2D canvas:

```js
var view = document.getElementById('my-canvas');   // the template's canvas, plain 2D
var ctx = view.getContext('2d');
var gpu = document.createElement('canvas');         // never enters the DOM
gpu.width = view.width; gpu.height = view.height;
// … create the WebGPU or WebGL context on `gpu` and render into it …
function present() { ctx.clearRect(0, 0, view.width, view.height); ctx.drawImage(gpu, 0, 0); }
```

Call `present()` at the end of every render, including inside `__lollyFrameRender`. The visible canvas then always holds the last frame, every export reader sees pixels and the tool is free to pick WebGPU or WebGL 2. The web shell needs WebGPU to start, so WebGL 2 is the fallback for a tool that cannot get a working WebGPU device. `3d` does this with three.js's `WebGPURenderer({ forceWebGL })`, falls back when there is no adapter or the device fails to start, and reports its choice as `data-backend` on the canvas. Feature-detect with `navigator.gpu.requestAdapter()`: an adapter that resolves to `null` means no WebGPU, whatever `navigator.gpu` says.

## Styles (`styles.css`)

Styles are scoped automatically. Write top-level selectors for your own classes. Rules for `body` or `html` are rescoped to `#tool-canvas` and will probably not do what you want.

### Design system colours in templates and styles

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

Always give a fallback, as in `var(--brand-secondary, #444)`. A role the design system does not define is left unset, so the fallback is what draws. The brand residue test (`tests/brand-residue.test.ts`) fails a tool template that reads any of these variables with no fallback.

The lead variables exist only when the design system has two or more colourways, and a canvas carries at most 16 of them; with one colourway there are none, and the canvas carries exactly the variables it always did. A second stripe that follows the second lead, and the partner colour when there is no family:

```css
.stripe + .stripe { background: var(--brand-lead-2, var(--brand-secondary, #444)); }
```

The web shell and the CLI paint the same variables, and the lead variables come from one engine function in both, so a template renders the same in each. For a colour input that offers only the colourway leads, see [Colourway leads as swatches](/info/tool-inputs.html#colourway-leads-as-swatches). A tool whose colours are its content can opt out of colourway switching with `tokenAxes` ([Colours that are the content](/info/tool-manifest.html#colours-that-are-the-content)).

### What the vector export keeps

SVG and PDF exports are not screenshots. The exporter reads each element's computed style and re-emits it as vector, so the CSS you choose decides whether a feature survives as geometry, is rasterised into the file or is dropped. A row marked *raster* still exports correctly, but that one element becomes a bitmap inside an otherwise vector file.

| You write | In the SVG / PDF |
|---|---|
| `border` (one width and colour all round), `border-radius`, `dashed`, `dotted` | Kept as a stroke, dash pattern included. |
| A border that differs per side | Kept as flat edges. A corner radius or dash on a mixed border is lost. |
| `outline` | Not exported. Use `border`, or `box-shadow` spread, for a visible ring. |
| `box-shadow` (outer and `inset`), `text-shadow`, `filter: drop-shadow()` | Kept: native SVG filters, or the shape redrawn; PDF bakes only a blurred shadow. |
| `filter: blur()` | Kept in SVG. PDF rasterises the element. |
| `opacity`, `mix-blend-mode` | Kept in SVG. Blend modes rasterise in PDF. |
| `overflow: hidden`; `clip-path` with `circle()`, `ellipse()`, `inset()` or `polygon()` | Kept as a clip. `clip-path: url()` or `path()` rasterises. |
| `mask-image`, `mask` | Raster. |
| `backdrop-filter` | A plain `blur()` is kept in snapshot exports; anything richer rasterises. |
| Text | Outlined to paths with the real font, including `-webkit-text-stroke` and `paint-order`. A glyph the font lacks (a CJK character in a Latin-only face, say) keeps that whole line as live `<text>`, which then needs the font on the viewer's machine. |
| `background-image` | Gradients become real gradients and a single image an `<image>`; `conic-gradient` rasterises. |
| `transform` | 2-D transforms are kept. 3-D (`rotateY`, `perspective`) is not. |

The `penpot` format keeps this same vector set, as editable Penpot shapes instead of SVG elements. What costs you those shapes is not the *raster* column: the lowering reads the exported SVG, and one `<clipPath>`, `<filter>`, `<pattern>`, `<mask>`, `<use>` or inline `<style>` anywhere in it puts the **whole** render on the board as a single picture instead. On an HTML layout those come from a rounded `overflow: hidden` box whose content reaches a corner, an `object-fit: cover` or circular image crop, a `background-image`, a `clip-path` and a blurred `text-shadow`. `box-shadow` is not one of them: the Penpot render draws shadows as geometry rather than as an SVG filter.

### Letting the document bring its own CSS

A tool can also give the person using it a stylesheet - Design does, as its `customCss`
input. Three rules make that safe, and a tool that offers user CSS is expected to follow
all three (`community/design/hooks.js` is the reference; `tests/design-custom-css.test.ts`
is the test to copy):

1. **Sanitise in the hook, never in the shell.** The hook neutralises `</style` and strips
   `@import`, then hands back a string the template emits inside `<style>`. Doing it in the
   hook is what makes the CLI's output identical to the browser's - a shell-side filter
   would leave the headless render unfiltered.
2. **Emit, then let the shell scope.** The shell re-scopes template `<style>` to the tool
   canvas (`scopeTemplateStyles`), and its scoper handles top-level `@keyframes` correctly,
   so real animations belong at the document level rather than nested per element.
3. **Give the CSS something to aim at.** Free-text rules need stable handles: Design stamps
   `data-frame-id` on each artboard, sanitised `data-frame-state` tokens from a per-frame
   `state` field, and a per-box `cls` field whose tokens join the element's class list
   (`.callout { … }`). Those pass through the same parse-and-re-serialise treatment as any
   other free text - lowercased, cleaned to `[a-z0-9_-]` and refused where they'd collide
   with the app's own namespaces (`lolly-`, `pr-`, `seq-`, `fc-`).

**Custom JS is not offered, and should not be.** Hooks are closure-injected, not sandboxed,
so a per-document script input would be stored XSS in every shared URL. The escape hatch
that exists is composition: a `sandbox` tool link placed as a box.

## Data formats (`json` / `csv` / `ics` / `vcf`)

Some tools export data beside the rendered image: a calendar invite, a contact card, the numbers behind a chart. Data formats come from the **input model**, not the pixels, so they work in every shell, the CLI included, and need no browser.

![One input model feeds template.html for the picture, sibling templates such as template.ics and template.csv for text formats, and the JSON export, which needs no template.](/info/diagrams/concepts/data-formats.svg)

- **`json`** - no template needed. Add `"json"` to `render.formats` and the export is `{ tool, version, inputs: { … } }` (the resolved input values), serialized automatically.
- **`csv` / `ics` / `vcf`** - add the format to `render.formats` **and** ship a sibling text template `template.<ext>` (e.g. `template.ics`). It's a Handlebars template hydrated against the same context as `template.html` (input values + hook `extras`), but **without HTML escaping** - so `{{title}}` emits the value verbatim. Escape per the target format with the built-in helpers:
  - `{{icsStamp meetingTime}}` - a `date`/`datetime-local` value → iCalendar basic form (`20260915T143000`).
  - `{{rfcText x}}` - escape an iCalendar (RFC 5545) **or** vCard (RFC 6350) text field (`\` `;` `,` newline).
  - `{{csvCell x}}` - quote a CSV field per RFC 4180 only when needed.
- **`srt` / `vtt`** (v1.150) - the same sibling-template mechanism, for subtitle sidecars: ship `template.srt` or `template.vtt`. The cue text itself is a hook extra (a captions tool already holds one in its target input), so the template is usually a single `{{captions}}`. SRT downloads as `text/plain` (SubRip has no registered MIME), WebVTT as `text/vtt`.
- **`css` / `scss` / `gpl`** - the same sibling-template mechanism, for palette output: ship `template.css`, `template.scss` or `template.gpl`. `color-palette` is the reference (its `ase` sibling is binary, so that one comes from an `exportStill` hook instead of a template).

Example `template.ics` (see `community/meeting-planner/`):

```handlebars
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:{{icsStamp meetingTime}}
SUMMARY:{{rfcText title}}
LOCATION:{{rfcText city}}
END:VEVENT
END:VCALENDAR
```

Reference wirings: `meeting-planner` and `calendar-ics` for ICS, `timezone` and `pricing-table` for CSV and `captions` for SRT and VTT. No public tool ships a `template.vcf` yet.

Data formats need no browser anywhere. On the node CLI, a template whose root is an `<svg>` also renders to SVG and the other vector formats with no browser, and resvg draws PNG from that SVG. Vector and raster files from a template built from HTML need a browser engine, and so do JPG, WebP, most PDFs and video: the web shell, the desktop app or the node CLI's browser tier. [Render with the CLI](/info/cli-rendering.html) has the full list. The CMYK formats pair with the **Convert paths** toggle ([The `render` block](/info/tool-manifest.html#the-render-block)) for print files that need no installed fonts; `qr-code` offers both `pdf-cmyk` and `cmyk-tiff`, while `org-chart` and `logo-wall` offer only `pdf-cmyk`.

## Animated HTML

A trusted tool can export a self-contained HTML file with play, replay, seek and fullscreen controls by declaring `render.portable: true`, listing `html` in `render.formats` and shipping `presentation.js`. That runtime marks its stage with `data-lolly-player` and assigns `element.__lollyPlayback`:

```js
stage.__lollyPlayback = {
  duration: 12,          // seconds
  poster: 6,            // initial paused frame
  seek(seconds) { renderFrame(seconds); },
  portableMarkup() { return authoredMarkup; }
};
```

`seek` must draw a frame directly, forwards or backwards, without starting another clock. `portableMarkup` supplies the authored markup with any prepared emoji artwork; leave out transient selection, caret and animation writes. Omit the method when the freshly filled template is enough. `animated: false` produces a still with no transport controls. Snippet's presentation runtime is a working example.

The shell bundles the shared Sequence evaluator into the player when it builds, and the export embeds that code in the HTML, so playback needs no app server. Tools keep their own scene evaluation; they do not implement another transport or copy Design's keyframe maths. The CLI uses its browser render tier for trusted tools that declare portable presentations, as it does for Design's HTML export.

::: details What people get from an HTML export
Design and Snippet offer HTML in the export format menu. The file embeds its fonts, images and playback code, and opens paused with play, replay, seek and fullscreen controls; a Design soundtrack adds mute and volume. Space or K toggles playback, the arrow keys seek, M toggles sound and F toggles fullscreen. Playback works offline.

Design supports native layers, mixed audio and several timed artboards as scenes. Each scene has its own camera and child animation window, the player offers a scene menu and Page Up and Page Down jump between scenes. Artboards of different sizes fit inside the output size with the same proportions the movie exporter uses. Cuts, fades and bounded custom fades follow the movie transition policy; slide, morph and flight transitions become dissolves for now.

Timeline's **Place in order** arranges artboards as timed scenes. Dragging a scene in the sequence moves its members' start times and leaves their local keys unchanged. Audio assigned to an artboard stops at that scene's bounds, and an audio layer outside any frame can span the whole film. An untimed deck gets five seconds per page during export without changing the saved document. A still Design exports without transport controls. Embedded video, Lottie and 3D produce an explicit HTML export error, because their playback adapters are separate work.
:::
