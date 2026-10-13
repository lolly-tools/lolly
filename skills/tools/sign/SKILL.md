---
name: lolly-sign
description: "Operate the Lolly Sign tool (sign) using its declared inputs and supported output formats."
---

# Sign

Tool ID: `sign`. Tool version: `1.0.1`. Engine range: `^1.0.0`.

Place your signature on a PDF, optionally add a Content Credential and lock the result.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| source | file |  |
| signature | asset |  |
| signatureInk | longtext |  |
| page | number |  |
| position | vector |  |
| initials | asset |  |
| date | boolean |  |
| seal | boolean |  |
| lock | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
