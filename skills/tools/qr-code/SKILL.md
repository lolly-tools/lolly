---
name: lolly-qr-code
description: "Operate the Lolly QR Code tool (qr-code) using its declared inputs and supported output formats."
---

# QR Code

Tool ID: `qr-code`. Tool version: `2.6.3`. Engine range: `^1.0.0`.

Scannable codes of every kind: QR, Micro QR, Data Matrix, Aztec and PDF417 for links, contacts, Wi-Fi, events, locations and text - plus retail and logistics barcodes from EAN-13 and Code 128 to ITF-14, GS1-128, GS1 DataBar and MaxiCode.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, png, jpeg, webp, avif, tiff, pdf, pdf-cmyk, cmyk-tiff, eps, eps-cmyk, dxf, emf, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| url | url |  |
| text | longtext |  |
| firstname | text |  |
| lastname | text |  |
| company | text |  |
| jobTitle | text |  |
| phone | text |  |
| email | text |  |
| ssid | text |  |
| wifiKey | text |  |
| wifiSecurity | select |  |
| wifiHidden | boolean |  |
| eventName | text |  |
| eventStart | datetime-local |  |
| eventEnd | datetime-local |  |
| eventLocation | text |  |
| eventDetails | longtext |  |
| lat | number |  |
| lng | number |  |
| value | text |  |
| gs1Carrier | select |  |
| showText | boolean |  |
| payload | select | p |
| symbology | select | sym |
| moduleWidth | number |  |
| barHeight | number |  |
| quiet | number |  |
| color | color |  |
| background | color |  |
| ecl | select |  |
| padding | number |  |
| moduleShape | select |  |
| join | boolean |  |
| eyeShape | select |  |
| eyeColor | color |  |
| fill | select |  |
| color2 | color |  |
| gradientType | select |  |
| angle | number |  |
| logo | asset |  |
| logoScale | number |  |
| logoPad | number |  |
| logoShape | select |  |
| frame | select |  |
| frameText | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
