---
name: lolly-multi-page-pdf
description: "Operate the Lolly Booklet tool (multi-page-pdf) using its declared inputs and supported output formats."
---

# Booklet

Tool ID: `multi-page-pdf`. Tool version: `1.1.3`. Engine range: `^1.0.0`.

Build a multi-page PDF - a cover, flowing content blocks, and a back page.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pptx, svg, penpot, md, svgz. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| brandLogo | boolean |  |
| pageSize | select |  |
| theme | select |  |
| accent | color |  |
| bodyWeight | number |  |
| headingWeight | number |  |
| coverTitle | text |  |
| coverSubtitle | text |  |
| coverText | longtext |  |
| coverLogo | asset |  |
| coverLogoSize | select |  |
| coverImage | asset |  |
| coverImageFraming | vector |  |
| coverBg | color |  |
| content | blocks |  |
| backBg | color |  |
| backHeading | text |  |
| backText | longtext |  |
| backCompany | text |  |
| backEmail | text |  |
| backPhone | text |  |
| backWebsite | text |  |
| aboutHeading | text |  |
| aboutText | longtext |  |
| backImage | asset |  |
| backImageFraming | vector |  |
| backLogoSize | select |  |
| width | number |  |
| height | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
