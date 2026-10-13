---
name: lolly-audiogram
description: "Operate the Lolly Audiogram tool (audiogram) using its declared inputs and supported output formats."
---

# Audiogram

Tool ID: `audiogram`. Tool version: `2.7.5`. Engine range: `>=1.261.0 <2.0.0`.

Turn a voice clip or song into a video in your design system's colours that actually moves with the sound - bars, spectrum, ring, ridgeline or scope, ready for social.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, webm, mp4, gif, webp-anim, html, wav, mp3, m4a, opus, srt, vtt, apng, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| audio | asset |  |
| title | text |  |
| subtitle | text |  |
| style | select |  |
| vizLook | select |  |
| vizBrand | select |  |
| credit | boolean |  |
| layout | select |  |
| size | select |  |
| start | number |  |
| beat | boolean |  |
| captions | boolean |  |
| transcript | longtext |  |
| autoCaption | boolean |  |
| accent | color |  |
| ink | color |  |
| bg | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
