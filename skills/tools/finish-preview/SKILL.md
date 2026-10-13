---
name: lolly-finish-preview
description: "Operate the Lolly Finishes tool (finish-preview) using its declared inputs and supported output formats."
---

# Finishes

Tool ID: `finish-preview`. Tool version: `1.1.1`. Engine range: `^1.0.0`.

Preview foil, spot UV, emboss and soft-touch finishes on your artwork - then export the printer-ready spot plate. The on-screen sheen is presentation only; the plate is the real deliverable your print house needs.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, pdf, pdf-cmyk, png, jpg, webp, avif, tiff, cmyk-tiff, gif, apng, webp-anim, webm, mp4, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| image | asset |  |
| finish | select |  |
| strength | number |  |
| sheen | boolean |  |
| angle | number |  |
| maskSource | select |  |
| maskColor | color |  |
| threshold | number |  |
| softness | number |  |
| fit | select |  |
| width | number |  |
| height | number |  |
| bgColor | color |  |
| plateView | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
