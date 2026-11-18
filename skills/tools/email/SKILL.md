---
name: lolly-email
description: "Operate the Lolly Email tool (email) using its declared inputs and supported output formats."
---

# Email

Tool ID: `email`. Tool version: `1.1.0`. Engine range: `^1.343.0`.

An email as it shows in a mail app: sender, recipients, subject, a Markdown body and attachments, as received, a draft or sent. For mock-ups, slides and walkthroughs.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, pdf, jpeg, webp, mp4, webm, gif, html, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| from | text |  |
| to | text |  |
| heading | text |  |
| body | longtext |  |
| sentAt | text |  |
| attachments | text |  |
| status | select |  |
| orientation | select |  |
| accent | color |  |
| background | color |  |
| ink | color |  |
| ground | select |  |
| density | select |  |
| layout | select |  |
| motion | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
