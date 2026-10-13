---
name: lolly-chart
description: "Operate the Lolly Chart tool (chart) using its declared inputs and supported output formats."
---

# Chart

Tool ID: `chart`. Tool version: `1.26.1`. Engine range: `^1.181.0`.

Charts from first paste to advanced visualisation - explained data recommendations, explicit field mapping, 35 classic vector families including Pareto, bullet targets and range bars, sixteen statistical and editorial articulations, real-z 3-D scenes, cinematic flights, deterministic motion, accessible descriptions and styles compiled from the active design system.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, md, svg, penpot, emf, pdf, pdf-cmyk, cmyk-tiff, tiff, pptx, webp, jpg, apng, webp-anim, gif, webm, mp4, avif, csv, json, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| data | longtext | d |
| heading | text | t |
| subheading | text | st |
| chartIntent | select | goal |
| renderMode | select | rm |
| chartType | select | ct |
| paretoCumulative | boolean |  |
| paretoThreshold | number |  |
| bulletTarget | number |  |
| bulletBands | boolean |  |
| rangeMidpoint | boolean |  |
| plotType | select | pf |
| sceneType | select | sct |
| cinematicType | select | cft |
| plotBins | number | pbn |
| plotBinWidth | number | pbw |
| plotBandwidth | number | pbnd |
| plotShowRaw | boolean | praw |
| plotConfidenceBand | boolean | pci |
| plotFacetDirection | select | pfd |
| plotMotionPreset | select | psm |
| chartStyle | select | sty |
| palette | select | pl |
| paletteSeed | color | pz |
| paletteBlend | select | pb |
| paletteBlendTo | color | p2 |
| hueRoute | select | hr |
| colorBy | select | cb |
| barStyle | select | b3 |
| pieStyle | select | p3 |
| depth3d | number | dp |
| cameraProjection | select | cpr |
| cameraAzimuth | number | caz |
| cameraElevation | number | cel |
| flightSeries | text | cfs |
| flightHeight | number | cfh |
| flightLookAhead | number | cfla |
| flightBank | number | cfb |
| flightFov | number | cff |
| sceneMaterial | select | mat |
| sceneRoughness | number | rou |
| sceneMetalness | number | met |
| sceneShadows | boolean | s3s |
| shadow | select | sh |
| differentiate | select | df |
| colorOverrides | text | co |
| transparentBg | boolean |  |
| background | color | bg |
| textColor | color | tc |
| strokeWidth | number | ow |
| strokeColor | color | oc |
| hasHeader | boolean | hh |
| delimiter | select | dl |
| transpose | boolean | tp |
| labelColumn | text | lc |
| seriesColumns | text | sc |
| pivotColumn | text | pv |
| zColumn | text | zc |
| sizeColumn | text | szc |
| frameColumn | text | fc |
| motionPreset | select | mp |
| animSpeed | number | as |
| frameLabelShow | boolean | fl |
| frameLabelSize | number | fls |
| frameLabelWeight | select | flw |
| frameLabelColor | color | flc |
| frameLabelPos | select | flp |
| animEase | select | ae |
| animDirection | select | ad |
| stackMode | select | sm |
| curve | select | cv |
| showPoints | boolean | pt |
| pointSize | number | ps |
| sizeBy | select | sz |
| lineWidth | number | lw |
| fillOpacity | number | fo |
| donutRadius | number | dr |
| sliceGap | number | sg |
| cornerRadius | number | cr |
| barPadding | number | bp |
| barGap | number | bpg |
| binCount | number | bc |
| sort | select | so |
| labelLayout | select | ll |
| labelReserve | number | lr |
| labelLines | number | ln |
| barThickness | number | bt |
| yScaleType | select | ys |
| yZero | boolean | yz |
| yMax | number | ym |
| showGrid | boolean | gd |
| showAxes | boolean | ax |
| tickCount | number | tk |
| numberFormat | select | nf |
| xTitle | text | xt |
| yTitle | text | yt |
| timeAxis | select | tax |
| reference | longtext | rf |
| trend | select | tr |
| errorColumn | text | ec |
| palette1 | color | c1 |
| palette2 | color | c2 |
| palette3 | color | c3 |
| palette4 | color | c4 |
| palette5 | color | c5 |
| palette6 | color | c6 |
| annotations | longtext | an |
| titleSize | number | tz |
| titleWeight | number | tw |
| titlePosition | select | tpo |
| titleAlign | select | tal |
| showValues | boolean | sv |
| valueSize | number | vsz |
| valueOffset | number | voff |
| valueWeight | select | vw |
| valueColor | color | vc |
| labelSize | number | lz |
| labelWeight | number | lb |
| axisTitleSize | number | ats |
| axisTitleWeight | select | atw |
| axisTitleColor | color | atc |
| showLegend | boolean | lg |
| legendPosition | select | lp |
| legendTextSize | number | lts |
| legendSwatchSize | number | lss |
| legendGap | number | lgp |
| legendRadius | number | lrd |
| legendMono | boolean | lmo |
| legendBold | boolean | lbo |
| legendItalic | boolean | lit |
| legendColor | color | lgc |
| width | number |  |
| height | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
