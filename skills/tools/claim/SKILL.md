---
name: lolly-claim
description: "Operate the Lolly Claim tool (claim) using its declared inputs and supported output formats."
---

# Claim

Tool ID: `claim`. Tool version: `2.0.1`. Engine range: `^1.104.0`.

Claim your name on any media you've already made - image, PDF, video or audio. Stamp your author, copyright and licence as Content Credentials (a durable raster Imprint too), preserving any credential already inside the file - all on your device, before you upload it anywhere.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, avif, tiff, gif, svg, penpot, pdf, mp4, webm, m4a, mp3, wav, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: c2pa. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| files | file |  |
| creator | text |  |
| copyright | text |  |
| license | select |  |
| contact | text |  |
| title | text |  |
| durableMark | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
