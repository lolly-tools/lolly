# chart

`chart` turns a table into a chart. Two ways in:

1. **A link.** Paste a CSV into `data` (alias `d`), pick a type with `chartType`
   (alias `ct`), and set titles and palette. This is the fast path and the one an
   agent should reach for first. Nearly every input has a short `urlKey` alias, so
   a whole chart fits in a short query.
2. **A structured spec** through `lolly_compile` / the document API, validated
   against `chart-v1` (`schemas/chart-v1.schema.json`, engine model
   `engine/src/chart-spec.ts`). Reach for it when you want explicit control over
   datasets, series, marks, scales, axes, theme and accessibility.

`data` is CSV or TSV: the first row is headers, the first text column becomes the
labels, and every numeric column becomes a series. Chart declares many formats,
including `svg`, `png`, `pdf`, `pptx`, `csv`, `json` and the motion formats.

## A bar chart from a CSV, by URL

```text
https://lolly.tools/#/tool/chart?ct=bar&d=Quarter%2CCoffee%2CTea%2CJuice%0AQ1%2C42%2C28%2C12%0AQ2%2C49%2C35%2C18%0AQ3%2C55%2C40%2C22&t=Beverage+sales&st=FY26&pl=cool&sv=1&lg=1&lp=tr&w=1200&h=800&format=png&export
```

Decoded, `d` is:

```
Quarter,Coffee,Tea,Juice
Q1,42,28,12
Q2,49,35,18
Q3,55,40,22
```

`ct=bar` is the type, `t`/`st` the title and source, `pl=cool` the palette, `sv=1`
prints the value on each bar, `lg=1`/`lp=tr` place the legend top-right, and
`format=png&export` downloads the PNG. Swap `format=svg` for a true vector, or drop
the export controls for an editable link. To pin a brand colour, set `c1`..`c6`
(blank means the brand palette).

Chart is an HTML-layout tool, so its raster and SVG go through the browser tier:
use an app link like the one above, or the CLI (`lolly run chart … --export=png`,
which escalates to the browser tier for you). The browser-free render route
(`/tool/<id>.<ext>`) serves the vector-native tools (`qr-code`, `gradient`, …) and
refuses chart with a 400 that points you to `lolly_render` or the app.

The most useful aliases:

| Alias | Input | Notes |
|---|---|---|
| `d` | `data` | The CSV/TSV. Headers on row 1; first text column is the labels. |
| `ct` | `chartType` | `bar`, `bar-horizontal`, `line`, `area`, `scatter`, `pie`, `donut`, `radar`, `treemap`, `heatmap`, `histogram`, `waterfall`, `funnel`, `gauge`, and more. |
| `t` / `st` | `heading` / `subheading` | Title and subtitle/source. |
| `pl` | `palette` | `ordered`, `warm`, `cool`, `diverging`, `mono`, `seed`, plus the brand palettes. |
| `c1`..`c6` | `palette1`..`palette6` | Explicit series colours; blank uses the brand. |
| `sv` | `showValues` | Print the number on each mark. |
| `lg` / `lp` | `showLegend` / `legendPosition` | `lp` is `tl,tc,tr,bl,bc,br,…`. |
| `rm` | `renderMode` | `vector`, `statistical`, `3d`, `cinema`. Switches renderer, keeps the data. |

## A structured spec

`chart-v1` is the document format for full control. Its shape (required keys):

```json
{
  "version": 1,
  "datasets": [{ "id": "sales", "fields": [
      { "id": "quarter", "label": "Quarter", "type": "string", "role": "dimension" },
      { "id": "coffee", "label": "Coffee", "type": "number", "role": "measure" }
    ], "rows": [{ "quarter": "Q1", "coffee": 42 }, { "quarter": "Q2", "coffee": 49 }] }],
  "series": [{ "id": "s1", "name": "Coffee", "dataset": "sales", "mark": "bar",
      "channels": { "x": { "field": "quarter" }, "y": { "field": "coffee" } } }],
  "theme": { "id": "brand", "source": "brand-profile", "font": {}, "colours": {}, "marks": {}, "scene": {}, "motion": {} },
  "presentation": { "style": "clean", "dimension": 2, "rendererFamily": "svg", "exportFidelity": "vector", "width": 1200, "height": 800, "transparent": false },
  "accessibility": { "title": "Beverage sales", "description": "Coffee by quarter.", "readingOrder": [], "table": { "columns": [], "rows": [] }, "colourOnly": false, "patterns": true }
}
```

`theme.source` is one of `brand-profile`, `brand-derived`, `lolly-fallback`;
`mark` is any of the schema's enum (`bar`, `line`, `area`, `point`, `arc`, the 3D
marks, and so on); `accessibility.title` and `.description` are required, because a
chart that cannot be read is not finished. Validate with `lolly_validate` before
you render.

## Every input

Generated from `community/chart/tool.json`. Aliases are the `urlKey` column.

<!-- GEN:chart-inputs -->
| ID | Alias | Type | Default | Section | What it does |
|---|---|---|---|---|---|
| `chartIntent` | `goal` | select | `manual` | - | What should the chart show? |
| `renderMode` | `rm` | select | `vector` | - | Mode |
| `chartType` | `ct` | select | `bar` | - | 2-D chart type |
| `paretoCumulative` | - | boolean | true | Pareto | Show cumulative percentage |
| `paretoThreshold` | - | number | 80 | Pareto | Cumulative reference (%) |
| `bulletTarget` | - | number | 100 | Bullet targets | Fallback target |
| `bulletBands` | - | boolean | true | Bullet targets | Show target bands |
| `rangeMidpoint` | - | boolean | true | Range bars | Show range midpoint |
| `plotType` | `pf` | select | `dot-strip` | - | Statistical form |
| `sceneType` | `sct` | select | `bar3d` | - | 3-D chart type |
| `cinematicType` | `cft` | select | `flythrough3d` | - | Cinematic form |
| `plotBins` | `pbn` | number | 20 | Statistical | Bins / contour levels |
| `plotBinWidth` | `pbw` | number | 24 | Statistical | Hexagon size |
| `plotBandwidth` | `pbnd` | number | 20 | Statistical | Density smoothing |
| `plotShowRaw` | `praw` | boolean | true | Statistical | Show observations |
| `plotConfidenceBand` | `pci` | boolean | true | Statistical | 95% confidence band |
| `plotFacetDirection` | `pfd` | select | `rows` | Statistical | Facet direction |
| `plotMotionPreset` | `psm` | select | `none` | Animation | Statistical motion |
| `data` | `d` | longtext | `Quarter,Coffee,Tea,Juice\nQ1,42…` | - | Paste your table |
| `chartStyle` | `sty` | select | `brand-default` | - | Style |
| `palette` | `pl` | select | `ordered` | Colour & style | Palette |
| `paletteSeed` | `pz` | color | `{color.semantic.primary}` | Colour & style | Base colour |
| `paletteBlend` | `pb` | select | `smooth` | Colour & style | Colour blend |
| `paletteBlendTo` | `p2` | color | `{color.semantic.secondary}` | Colour & style | Second colour |
| `hueRoute` | `hr` | select | `short` | Colour & style | Hue route |
| `colorBy` | `cb` | select | `series` | Colour & style | Colour by |
| `barStyle` | `b3` | select | `flat` | Colour & style | Bar look |
| `pieStyle` | `p3` | select | `flat` | Colour & style | Pie look |
| `depth3d` | `dp` | number | 0 | Colour & style | 3-D depth (px, 0 = auto) |
| `cameraProjection` | `cpr` | select | `perspective` | 3-D scene | Camera |
| `cameraAzimuth` | `caz` | number | 38 | 3-D scene | Camera angle |
| `cameraElevation` | `cel` | number | 24 | 3-D scene | Camera elevation |
| `flightSeries` | `cfs` | text | `""` | Cinematic flight | Camera follows |
| `flightHeight` | `cfh` | number | 0.85 | Cinematic flight | Camera clearance |
| `flightLookAhead` | `cfla` | number | 1.5 | Cinematic flight | Look ahead |
| `flightBank` | `cfb` | number | 10 | Cinematic flight | Bank with change |
| `flightFov` | `cff` | number | 54 | Cinematic flight | Field of view |
| `sceneMaterial` | `mat` | select | `matte` | 3-D scene | Material |
| `sceneRoughness` | `rou` | number | 0.58 | 3-D scene | Roughness |
| `sceneMetalness` | `met` | number | 0.04 | 3-D scene | Metalness |
| `sceneShadows` | `s3s` | boolean | true | 3-D scene | Scene shadows |
| `shadow` | `sh` | select | `none` | Colour & style | Shadow / depth |
| `differentiate` | `df` | select | `auto` | Colour & style | Differentiate series by |
| `colorOverrides` | `co` | text | `""` | Colour & style | Highlighted values |
| `transparentBg` | - | boolean | true | Colour & style | Transparent background |
| `background` | `bg` | color | `{color.semantic.surface}` | Colour & style | Background |
| `textColor` | `tc` | color | `""` | Colour & style | Text & axis colour |
| `strokeWidth` | `ow` | number | 0 | Colour & style | Mark outline width |
| `strokeColor` | `oc` | color | `{color.semantic.surface}` | Colour & style | Mark outline colour |
| `hasHeader` | `hh` | boolean | true | Data | First row is a header |
| `delimiter` | `dl` | select | `auto` | Data | Column separator |
| `transpose` | `tp` | boolean | false | Data | Swap rows & columns |
| `labelColumn` | `lc` | text | `""` | Field mapping | X / category |
| `seriesColumns` | `sc` | text | `""` | Field mapping | Y / measure(s) |
| `pivotColumn` | `pv` | text | `""` | Field mapping | Colour / series / facet |
| `zColumn` | `zc` | text | `""` | Field mapping | Z / depth |
| `sizeColumn` | `szc` | text | `""` | Field mapping | Size |
| `frameColumn` | `fc` | text | `""` | Animation | Frame / time |
| `motionPreset` | `mp` | select | `none` | Animation | Motion |
| `animSpeed` | `as` | number | 1.5 | Animation | Seconds per frame |
| `frameLabelShow` | `fl` | boolean | true | Animation | Show frame label |
| `frameLabelSize` | `fls` | number | 36 | Animation | Frame label size |
| `frameLabelWeight` | `flw` | select | `700` | Animation | Frame label weight |
| `frameLabelColor` | `flc` | color | `""` | Animation | Frame label colour |
| `frameLabelPos` | `flp` | select | `tr` | Animation | Frame label position |
| `animEase` | `ae` | select | `smooth` | Animation | Motion |
| `animDirection` | `ad` | select | `loop` | Animation | Loop style |
| `stackMode` | `sm` | select | `grouped` | Chart | Series layout |
| `curve` | `cv` | select | `monotone` | Chart | Line shape |
| `showPoints` | `pt` | boolean | false | Chart | Show point markers |
| `pointSize` | `ps` | number | 10 | Chart | Point size |
| `sizeBy` | `sz` | select | `uniform` | Chart | Bubble size |
| `lineWidth` | `lw` | number | 3 | Chart | Line width |
| `fillOpacity` | `fo` | number | 85 | Chart | Fill opacity % |
| `donutRadius` | `dr` | number | 0.55 | Chart | Inner radius (hole) |
| `sliceGap` | `sg` | number | 1 | Chart | Gap between slices |
| `cornerRadius` | `cr` | number | 6 | Chart | Corner radius |
| `barPadding` | `bp` | number | 0.2 | Chart | Bar spacing |
| `barGap` | `bpg` | number | 0.08 | Chart | Series gap |
| `binCount` | `bc` | number | 0 | Chart | Bins (0 = auto) |
| `sort` | `so` | select | `none` | Chart | Sort |
| `labelLayout` | `ll` | select | `auto` | Labels & bar size | Category label layout |
| `labelReserve` | `lr` | number | 0 | Labels & bar size | Label area (%, 0 = auto) |
| `labelLines` | `ln` | number | 2 | Labels & bar size | Max label lines |
| `barThickness` | `bt` | number | 0 | Labels & bar size | Bar thickness (px, 0 = auto) |
| `yScaleType` | `ys` | select | `linear` | Axes & scale | Value scale |
| `yZero` | `yz` | boolean | true | Axes & scale | Start value axis at zero |
| `yMax` | `ym` | number | 0 | Axes & scale | Value axis max (0 = auto) |
| `showGrid` | `gd` | boolean | true | Axes & scale | Gridlines |
| `showAxes` | `ax` | boolean | true | Axes & scale | Axis lines & ticks |
| `tickCount` | `tk` | number | 5 | Axes & scale | Approx. tick count |
| `numberFormat` | `nf` | select | `auto` | Axes & scale | Number format |
| `xTitle` | `xt` | text | `""` | Axes & scale | X-axis title |
| `yTitle` | `yt` | text | `""` | Axes & scale | Y-axis title |
| `timeAxis` | `tax` | select | `auto` | Axes & scale | Time axis |
| `reference` | `rf` | longtext | `""` | Axes & scale | Reference lines & bands |
| `trend` | `tr` | select | `none` | Axes & scale | Trend / fit line |
| `errorColumn` | `ec` | text | `""` | Axes & scale | Uncertainty / error |
| `palette1` | `c1` | color | `""` | Custom palette | Colour 1 |
| `palette2` | `c2` | color | `""` | Custom palette | Colour 2 |
| `palette3` | `c3` | color | `""` | Custom palette | Colour 3 |
| `palette4` | `c4` | color | `""` | Custom palette | Colour 4 |
| `palette5` | `c5` | color | `""` | Custom palette | Colour 5 |
| `palette6` | `c6` | color | `""` | Custom palette | Colour 6 |
| `annotations` | `an` | longtext | `""` | Annotations | Annotations |
| `heading` | `t` | text | `""` | Titles & labels | Title |
| `subheading` | `st` | text | `""` | Titles & labels | Subtitle / source |
| `titleSize` | `tz` | number | 34 | Titles & labels | Title text size |
| `titleWeight` | `tw` | number | 500 | Titles & labels | Title weight |
| `titlePosition` | `tpo` | select | `top` | Titles & labels | Title position |
| `titleAlign` | `tal` | select | `left` | Titles & labels | Title alignment |
| `showValues` | `sv` | boolean | true | Titles & labels | Show data labels |
| `valueSize` | `vsz` | number | 0 | Titles & labels | Data label size |
| `valueOffset` | `voff` | number | 0 | Titles & labels | Data label distance |
| `valueWeight` | `vw` | select | `600` | Titles & labels | Data label weight |
| `valueColor` | `vc` | color | `""` | Titles & labels | Data label colour |
| `labelSize` | `lz` | number | 22 | Titles & labels | Label text size |
| `labelWeight` | `lb` | number | 500 | Titles & labels | Label weight |
| `axisTitleSize` | `ats` | number | 0 | Titles & labels | Axis title size |
| `axisTitleWeight` | `atw` | select | `600` | Titles & labels | Axis title weight |
| `axisTitleColor` | `atc` | color | `""` | Titles & labels | Axis title colour |
| `showLegend` | `lg` | boolean | true | Legend | Show legend |
| `legendPosition` | `lp` | select | `bc` | Legend | Legend position |
| `legendTextSize` | `lts` | number | 0 | Legend | Legend text size (0 = auto) |
| `legendSwatchSize` | `lss` | number | 0 | Legend | Indicator size (0 = auto) |
| `legendGap` | `lgp` | number | 24 | Legend | Legend item gap |
| `legendRadius` | `lrd` | number | 3 | Legend | Indicator radius |
| `legendMono` | `lmo` | boolean | false | Legend | Monospace |
| `legendBold` | `lbo` | boolean | false | Legend | Bold |
| `legendItalic` | `lit` | boolean | false | Legend | Italic |
| `legendColor` | `lgc` | color | `""` | Legend | Legend text colour |
| `width` | - | number | 1280 | - | Width |
| `height` | - | number | 800 | - | Height |
<!-- /GEN:chart-inputs -->
