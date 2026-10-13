---
name: lolly-screencap
description: "Operate the Lolly Screen Capture tool (screencap) using its declared inputs and supported output formats."
---

# Screen Capture

Tool ID: `screencap`. Tool version: `1.1.2`. Engine range: `>=1.54.0 <2.0.0`.

Screenshot or record your whole screen, a window, or a browser tab. Drag on the canvas to crop - the export stays the exact pixels you captured.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, avif, tiff, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: screen, microphone.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| shot | asset |  |
| crop | vector |  |
| title | text |  |
| systemAudio | boolean |  |
| micNarration | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
