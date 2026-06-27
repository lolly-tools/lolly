# NOTICE — catalog/

`catalog/` mixes three distinct licensing regimes. The repository-root MPL-2.0
license (`/LICENSE`) does **not** apply uniformly here.

## 1. `catalog/assets/` — proprietary

SUSE brand assets and trademarks (logos, headshots, brand palettes/tokens).
**Proprietary to SUSE — all rights reserved.** NOT licensed under MPL-2.0.
Slated to move to a private repository per the open-sourcing plan (see the root
`README.md` "Open-sourcing plan" and `SOVEREIGNTY.md`).

## 2. `catalog/fonts/` — SIL OFL 1.1

The SUSE and SUSE Mono typefaces are licensed under the **SIL Open Font License,
Version 1.1**. The full license text is in `catalog/fonts/OFL.txt`. Note that
"SUSE" is a trademark of SUSE; the OFL covers the font software, not the mark.

## 3. `catalog/tools/index.json` — generated registry (MPL-2.0)

A generated registry derived from the `tools/` manifests by
`scripts/build-catalog-index.js`. As generated build output of the open-source
toolchain, it is covered by the repository-root **MPL-2.0**. (The underlying
`tools/` content it indexes remains proprietary — see `tools/NOTICE.md`.)
