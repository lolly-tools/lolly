---
name: lolly-captions
description: "Operate the Lolly Captions tool (captions) using its declared inputs and supported output formats."
---

# Captions

Tool ID: `captions`. Tool version: `1.0.3`. Engine range: `>=1.150.0`.

Subtitles for a clip - turn its speech into text on device or drop in an SRT/VTT file, style the cues, and export burned-in frames plus clean .srt and .vtt sidecars.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, penpot, srt, vtt, json, jpg, webp, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| media | asset |  |
| transcript | longtext |  |
| style | select |  |
| position | select |  |
| fontSize | number |  |
| color | color |  |
| background | color |  |
| maxLines | number |  |
| showTimecodes | boolean |  |
| burnIn | boolean |  |
| time | number | t |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
