---
name: lolly-icon
description: "Operate the Lolly Icon tool (icon) using its declared inputs and supported output formats."
---

# Icon

Tool ID: `icon`. Tool version: `1.1.3`. Engine range: `^1.0.0`.

Favicon and app-icon maker - a multi-size .ico, PNG and SVG, or the whole app kit as one zip.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: ico, png, svg, penpot, zip, webp, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: compose.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| text | text |  |
| image | asset |  |
| imageZoom | number |  |
| imageX | number |  |
| imageY | number |  |
| background | color |  |
| color | color |  |
| shape | select |  |
| weight | select |  |
| tracking | number |  |
| labelScale | number |  |
| variant | select |  |
| appName | text |  |
| appShortName | text |  |
| maskable | boolean |  |
| monochrome | boolean |  |
| showGrid | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
