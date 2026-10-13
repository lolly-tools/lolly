---
name: lolly-synth
description: "Operate the Lolly Synth tool (synth) using its declared inputs and supported output formats."
---

# Synth

Tool ID: `synth`. Tool version: `0.2.4`. Engine range: `^1.214.0`.

A visual instrument you play. Four scenes run live on the GPU: fluid ink, a particle swarm that flies at your headline or your logo, a feedback field, and your own camera. Every colour comes out of the design system palette, and the picture moves to your pointer, to a music track, and to a MIDI controller. Export a still or a join-free loop.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, webm, mp4, gif, apng, avif, tiff, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| scene | select |  |
| symmetry | number |  |
| audio | asset |  |
| text | text |  |
| logo | asset |  |
| particles | number |  |
| live | boolean |  |
| color1 | color |  |
| color2 | color |  |
| color3 | color |  |
| rampRotate | number |  |
| intensity | number |  |
| speed | number |  |
| seed | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
