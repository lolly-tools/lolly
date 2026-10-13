---
name: lolly-agenda
description: "Operate the Lolly Agenda tool (agenda) using its declared inputs and supported output formats."
---

# Agenda

Tool ID: `agenda`. Tool version: `1.3.0`. Engine range: `^1.216.0`.

Turn one programme into branded screens, interactive web pages, animated overviews, PowerPoint slides and calendars.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pdf-cmyk, svg, penpot, png, jpg, webp, ics, html, mp4, webm, pptx, zip, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| title | text |  |
| subtitle | text |  |
| sessions | table | ss |
| layout | select | ly |
| style | select |  |
| now | datetime-local |  |
| tz | text |  |
| showSpeakers | boolean |  |
| showRooms | boolean |  |
| compact | boolean |  |
| plenaryLabel | text |  |
| nowLabel | text |  |
| nextLabel | text |  |
| roomFilter | text |  |
| trackFilter | text |  |
| eventDay | date |  |
| message | text |  |
| backdrop | select |  |
| motion | select |  |
| distance | select |  |
| clockMode | select |  |
| pptxMode | select |  |
| dwell | number |  |
| panSpeed | number |  |
| logo | asset |  |
| backgroundImage | asset |  |
| backgroundIntensity | number |  |
| variation | number |  |
| strictPalette | boolean |  |
| kitVideo | boolean |  |
| eventId | text |  |
| sceneOrder | longtext |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
