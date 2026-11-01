# Bundled press profile

`craft-coated-fogra39.icc` is the CMYK output profile a print export separates
through when it targets **Coated FOGRA39** (the default press condition) and the
user has not chosen a profile of their own. It turns RGB artwork into ink with
`iccSeparation` (`engine/src/cmyk-separation.ts`) for Print PDF, Print TIFF and
EPS (CMYK).

| | |
|---|---|
| File | `craft-coated-fogra39.icc` (712,888 bytes) |
| SHA-256 | `be2d6bdad6e0508f3a486659893748eebc7063933e53dbb917da8cfa8028f20e` |
| Description tag | `Coated FOGRA39 (fitted, craft-cms)` |
| Source | [storytold/craft-libs `crates/cms/profiles/craft-coated-fogra39.icc`](https://github.com/storytold/craft-libs/blob/f8f8829cc7be65d466d687dae381d1ca60e31242/crates/cms/profiles/craft-coated-fogra39.icc) at commit `f8f8829cc7be65d466d687dae381d1ca60e31242`, unmodified |
| Licence | CC0-1.0 (`LICENSE-CC0.md`), as declared in that repository's `NOTICE` and `ATTRIBUTION.md` |
| Version | ICC v4.3 output (`prtr`) profile, CMYK to Lab PCS; AToB 11-per-axis lut16, BToA 33-per-axis lut16; 330 % total ink |

## How the profile was made

craft-libs generates this profile in its own test suite (`crates/cms/tests/fogra39.rs`).
A Yule-Nielsen modified Neugebauer model is fitted to Fogra's FOGRA39 characterisation
data (1,617 IT8.7/4 patches), a kernel regression corrects the remaining error, and the
BToA tables invert the resulting AToB table. The authors report a mean ΔE00 of 0.07
against all 1,617 patches and 0.11 against the tenth held out of the fit. Lolly has
not re-measured those figures; its own tests check the separation against the
profile's own AToB table.

"FOGRA39" identifies the reference data the profile is fitted to. Such use does not
imply certification, approval or endorsement by Fogra. The characterisation data
itself is Fogra's (Fogra Forschungsinstitut für Medientechnologien e.V.,
www.fogra.org) and is not included here.

## Why it is bundled

The other freely downloadable FOGRA39 profiles carry redistribution conditions, so
Lolly used to declare the press condition by name and convert colours with a
device formula that ignores the press. A CC0 profile removes that obstacle. Other
press conditions (FOGRA51, SWOP, GRACoL) still use the device formula unless the
user loads and selects a profile of their own.
