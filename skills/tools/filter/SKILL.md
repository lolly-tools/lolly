---
name: lolly-filter
description: "Operate the Lolly Filter tool (filter) using its declared inputs and supported output formats."
---

# Filter

Tool ID: `filter`. Tool version: `1.5.0`. Engine range: `^1.242.0`.

One tool for photo effects: pick halftone, scanline, posterize, voronoi, dither or ASCII art (vector) or duotone, pixel-stretch, misprint or glitch (raster). Design system overlays, live camera and exports to as many formats as each effect supports.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, pdf, pdf-cmyk, emf, png, jpg, webp, avif, tiff, cmyk-tiff, gif, apng, webp-anim, webm, mp4, txt, md, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| effect | select |  |
| image | asset |  |
| ht_gridSize | number |  |
| ht_dotScale | number |  |
| ht_shape | select |  |
| ht_smoothing | number |  |
| ht_dither | select |  |
| ht_colorSource | select |  |
| ht_colorLevels | select |  |
| ht_fgColor | color |  |
| ht_transparentBg | boolean |  |
| ht_bgColor | color |  |
| ht_invert | boolean |  |
| ht_brightness | number |  |
| ht_gamma | number |  |
| ht_fit | select |  |
| sc_lineSize | number |  |
| sc_gapSize | number |  |
| sc_separatePixels | boolean |  |
| sc_everyLine | boolean |  |
| sc_highlight | color |  |
| sc_light | color |  |
| sc_mid | color |  |
| sc_shade | color |  |
| sc_shadow | color |  |
| sc_background | color |  |
| sc_brightness | number |  |
| sc_fit | select |  |
| pz_steps | number |  |
| pz_threshold | boolean |  |
| pz_thresholdLevel | number |  |
| pz_quality | number |  |
| pz_smoothing | number |  |
| pz_resample | boolean |  |
| pz_brightness | number |  |
| pz_invert | boolean |  |
| pz_colors | blocks |  |
| pz_transparentBg | boolean |  |
| pz_bgColor | color |  |
| vo_cells | number |  |
| vo_jitter | number |  |
| vo_relax | number |  |
| vo_seed | number |  |
| vo_edgeWidth | number |  |
| vo_edgeColor | color |  |
| vo_transparentBg | boolean |  |
| vo_bgColor | color |  |
| du_treatment | select |  |
| du_treatmentAmount | number |  |
| du_treatShadow | color |  |
| du_treatMid | color |  |
| du_treatHighlight | color |  |
| du_imageFraming | vector |  |
| px_direction | select |  |
| px_threshold | number |  |
| px_spread | number |  |
| px_feather | number |  |
| px_imageFraming | vector |  |
| im_preset | select |  |
| im_strength | number |  |
| im_seed | number |  |
| im_ink1 | color |  |
| im_ink2 | color |  |
| im_fit | select |  |
| im_plates | select |  |
| im_misregAmount | number |  |
| im_bleedAmount | number |  |
| im_degradeAmount | number |  |
| im_paperTint | color |  |
| im_paperTintStrength | number |  |
| im_grainAmount | number |  |
| di_algorithm | select | dalg |
| di_diffusion | number | ddf |
| di_serpentine | boolean | dsp |
| di_strength | number | dst |
| di_scale | number | dsc |
| di_pixelShape | select | dps |
| di_palette | select | dpal |
| di_colorCount | number | dcc |
| di_fit | select | dfit |
| as_ramp | select | arp |
| as_cellSize | number | acs |
| as_fontWeight | select | afw |
| as_threshold | number | ath |
| as_colorMode | select | acm |
| as_fgColor | color | afg |
| as_bgColor | color | abg |
| as_invert | boolean | ainv |
| as_fit | select | afit |
| gl_sortThreshold | number | gst |
| gl_sortDirection | select | gsd |
| gl_sortBandLength | number | gsb |
| gl_offsetR | vector | gor |
| gl_offsetG | vector | gog |
| gl_offsetB | vector | gob |
| gl_blockAmount | number | gba |
| gl_blockSize | number | gbs |
| gl_seed | number | gse |
| gl_fit | select | gfit |
| contrast | number |  |
| hue | number |  |
| saturation | number |  |
| lightness | number |  |
| treatmentColor | color |  |
| blendMode | select |  |
| treatmentIntensity | number |  |
| noFilter | boolean |  |
| showLogo | boolean |  |
| logoPosition | select |  |
| logoStyle | select |  |
| logoScale | number |  |
| lowerThird | boolean |  |
| ltTheme | select |  |
| ltPosition | select |  |
| firstname | text |  |
| lastname | text |  |
| title | text |  |
| nameWeight | number |  |
| subtitleWeight | number |  |
| ltHeadshot | asset |  |
| liveRes | number |  |
| width | number |  |
| height | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
