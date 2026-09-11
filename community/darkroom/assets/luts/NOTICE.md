# Bitmap Studio - preset LUTs

These `.cube` files are **open LUTs** you can apply in Bitmap Studio and download
for use in any editor. Most are public-domain (CC0) and need no attribution; one
is contributed under **CC BY 4.0** and does ask for credit - see *Attributed
contributions* below.

## Attributed contributions (CC BY 4.0)

| Shipped file | Name | Creator | Licence |
|---|---|---|---|
| `suse7-slog3-heavy.cube` | SUSE7 S-Log3 (Heavy) | **Peter Chamalian**, Director of Photography & Editor, **SUSE** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

A cinema colour grade authored in DaVinci Resolve (September 2025) for **Sony
S-Log3** footage (65³ Adobe/IRIDAS `.cube`). © 2025 SUSE; created by Peter
Chamalian and released for reuse under CC BY 4.0. **Attribution is required** - credit *"SUSE · Peter
Chamalian"*. When this look is applied to a video in Lolly, the credit is written
into the output's C2PA `color_adjustments` action (creator, organisation and
licence), so it travels with the file. Applying it to non-log (Rec.709) footage
will look wrong: it expects S-Log3 input.

## Public-domain film emulation (CC0)

The remaining presets are open, public-domain LUTs. No attribution is required.

### Provenance

Derived from **[sguyader/FilmSim](https://github.com/sguyader/FilmSim)** (commit
`1453b2b55c48d99a889b1e455f91f6898ba2db41`), authored by Sébastien Guyader and
dedicated to the public domain under **[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)**.
The upstream sources are HaldCLUT `.tif` images (144³, level 12); each was
resampled to a 33³ Adobe/IRIDAS `.cube` by `_build-cube.mjs` (trilinear). CC0
imposes no attribution obligation - the credit here is a courtesy, and a record
so anyone can re-derive and verify these files.

| Shipped file | Descriptive name | Upstream source | Source SHA-256 |
|---|---|---|---|
| `mono-fine.cube` | Fine mono | `Acros.tif` | `d4c9f720c1588531b7f748e13505e11f392af663415e625bda0ff3455b41c7a5` |
| `chrome-muted.cube` | Muted chrome | `Classic_Chrome.tif` | `cc303723b76205aedf970dc814dbecd6d9795955411aa2d6b265873864de7a66` |
| `slide-standard.cube` | Standard slide | `Provia_Std.tif` | `acf26aee152dbce9fff685aa727a5550855d425aa90610dd63b3ff2f15be0fe7` |
| `slide-vivid.cube` | Vivid slide | `Velvia_Vivid_v2.tif` | `1b347b4c5afec78ad7f79103bf04b319e182b7133ffe2a8864c732a7003b7eea` |

## Trademarks

The upstream files are named after film stocks (Fuji Acros, Classic Chrome,
Provia, Velvia). Those names are **trademarks of Fujifilm**, unrelated to the CC0
copyright dedication. Bitmap Studio therefore ships them under **descriptive**
names and never brands the UI with the stock names; the upstream names appear
only here and in each file's provenance comment, as a factual record of origin.

## Regenerating

```
node _build-cube.mjs /path/to/FilmSim   # needs ImageMagick `magick`
```

The source `.tif` (≈36 MB total) are intentionally **not** committed; verify a
checkout against the SHA-256 column above before regenerating.
