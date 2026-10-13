---
name: lolly-snippet
description: "Operate the Lolly Snippet tool (snippet) using its declared inputs and supported output formats."
---

# Snippet

Tool ID: `snippet`. Tool version: `1.6.2`. Engine range: `^1.228.0`.

Present text in a desktop window, as a still image or a directed interaction with typing, selections, autocomplete and motion.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, penpot, jpg, webp, pdf, mp4, webm, gif, webp-anim, html, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: textTools. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| code | longtext |  |
| language | select |  |
| scale | number |  |
| lineHeight | number |  |
| lineNumbers | boolean |  |
| blinkCursor | boolean |  |
| textOverflow | select |  |
| wrapText | boolean |  |
| fileName | text | name |
| titleScale | number |  |
| titleIcon | asset |  |
| iconScale | number |  |
| windowStyle | select |  |
| showWindow | boolean |  |
| theme | select |  |
| shadow | boolean |  |
| calloutMode | select |  |
| calloutPrefix | text |  |
| calloutFont | select |  |
| scene | select |  |
| typingSeconds | number |  |
| readSeconds | number |  |
| typingStyle | select |  |
| ending | select |  |
| completeAfter | number |  |
| selectText | text |  |
| replacementText | longtext |  |
| showPointer | boolean |  |
| cursorSize | number |  |
| clickRing | boolean |  |
| entryMotion | select |  |
| exitMotion | select |  |
| posterAt | number |  |
| startFilled | boolean |  |
| steps | blocks |  |
| windowRotate | number |  |
| windowTiltX | number |  |
| windowTiltY | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
