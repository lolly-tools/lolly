# Lolly Render — GitHub Action

Render on-brand assets (SVG/PNG/PDF/…) from [Lolly](https://lolly.tools) tools inside any
workflow — a single render or a CSV batch. The action wraps the Lolly CLI's URL-mode
render path: the `--key=value` flags you pass are the same params a lolly.tools share
link carries, so anything you can render in the browser you can regenerate in CI.

> **Where this lives:** built in-tree at `lolly-tools/lolly/action`, ready to split into
> `lolly-tools/render-action`. Until that repo exists and tags a `v1` release, reference
> the in-tree copy pinned to a commit:
>
> ```yaml
> - uses: lolly-tools/lolly/action@main        # or @<commit-sha> to pin
> ```
>
> After the split it becomes:
>
> ```yaml
> - uses: lolly-tools/render-action@v1
> ```

## Quick start

```yaml
- uses: lolly-tools/lolly/action@main
  id: render
  with:
    tool: qr-code
    args: --url=https://example.com
    format: svg
- run: ls "${{ steps.render.outputs.out-dir }}"
```

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `tool` | — | Tool id for a single render (e.g. `qr-code`). Ignored when `rows` is set. |
| `args` | `''` | One shell-quoted string of `--key=value` flags. Keys are the tool's input ids (same names as its URL params); reserved params (`width`, `height`, `unit`, `dpi`, `bleed`, `marks`, `c2pa`, …) work too. Quote values with spaces: `--text="Hello world"`. |
| `rows` | — | Workspace-relative path of a batch CSV/TSV: header names a `toolId` column + one column per input (starter grid: `lolly batch --template=<tool>`). When set, `tool`/`args`/`format` are ignored. |
| `format` | `svg` | Export format for the single render. Batch rows carry their own `format` column. |
| `out-dir` | `./lolly-out` | Workspace-relative output directory (created if missing). |
| `browser` | `false` | `'true'` installs the scoped Chromium (`lolly install-browser --with-deps`) **and** builds the web shell — required for raster/pdf/video of HTML-layout tools. See [The browser tier](#the-browser-tier). |
| `lolly-ref` | `v1` | Git ref of `lolly-tools/lolly` to render with. `v1` is a placeholder until `render-action` tags releases — pass a commit SHA (or `main`) meanwhile, and pin a SHA for reproducible renders. |
| `profile-root` | — | Workspace-relative path of a brand-pack profile root (`tools/` + `catalog/` with a built `catalog/tools/index.json`). Exported as `LOLLY_ROOT`. See [Brand packs](#brand-packs-profile-root). |
| `token` | `github.token` | Token for the lolly checkout. `lolly-tools/lolly` is **public**, so the default always works — pass a PAT only to render from a private fork/mirror. |

## Outputs

| Output | Meaning |
|---|---|
| `out-dir` | Absolute path of the directory holding the rendered files. |
| `files` | Newline-separated list of rendered files, relative to `out-dir`. |

---

## Example 1 — OG image on release

Renders a 1200×630 social card when a release publishes and attaches it to the release.
`layout-studio` is SVG-native, so PNG renders browser-free (Tier A).

```yaml
name: Release OG image
on:
  release:
    types: [published]

permissions:
  contents: write   # gh release upload

jobs:
  og:
    runs-on: ubuntu-latest
    steps:
      - uses: lolly-tools/lolly/action@main
        id: render
        with:
          tool: layout-studio
          args: --width=1200 --height=630
          format: png
          out-dir: ./og

      - name: Attach to the release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "$GITHUB_REF_NAME" --repo "$GITHUB_REPOSITORY" --clobber "${{ steps.render.outputs.out-dir }}/layout-studio.png"
```

Any input the tool declares is overridable through `args` — copy the query string out of
a lolly.tools share link and paste it in as `--key=value` flags to reproduce that exact
design.

## Example 2 — nightly countdown regeneration (cron)

Time-varying renders go stale by design; `schedule:` cron re-bakes them. (The
`countdown-timer` tool itself is a *live* HTML embed with `export: false` — a countdown
you commit as an image must be baked nightly, which is exactly what this does: compute
the number in shell, render it as a wordmark banner, commit when it changed.)

```yaml
name: Nightly countdown banner
on:
  schedule:
    - cron: '17 0 * * *'   # 00:17 UTC nightly
  workflow_dispatch:

permissions:
  contents: write

jobs:
  countdown:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4   # your repo — the banner is committed back into it

      - name: Days until launch
        id: days
        run: echo "left=$(( ( $(date -ud '2026-12-31' +%s) - $(date -u +%s) ) / 86400 ))" >> "$GITHUB_OUTPUT"

      - uses: lolly-tools/lolly/action@main
        id: render
        with:
          tool: wordmark
          args: --text="${{ steps.days.outputs.left }} days to launch" --size=120
          format: svg
          out-dir: ./assets

      - name: Commit the refreshed banner
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add assets/wordmark.svg
          git diff --cached --quiet || { git commit -m "chore: nightly countdown banner"; git push; }
```

## Example 3 — CSV batch to artifacts

One render per CSV row, uploaded as a workflow artifact. Commit `renders/rows.csv` to
your repo:

```csv
toolId,format,url,filename
qr-code,svg,https://example.com,homepage
qr-code,png,https://example.com/docs,docs
```

(The header is `toolId` + reserved output columns — `format`, `width`, `height`, `unit`,
`dpi`, `filename` — plus one column per tool input. `lolly batch --template=qr-code`
prints a starter grid.)

```yaml
name: Render batch
on: workflow_dispatch

jobs:
  batch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4   # your repo — rows.csv lives here

      - uses: lolly-tools/lolly/action@main
        id: render
        with:
          rows: ./renders/rows.csv
          out-dir: ./lolly-out

      - uses: actions/upload-artifact@v4
        with:
          name: lolly-renders
          path: ${{ steps.render.outputs.out-dir }}
```

---

## The browser tier

The CLI renders in two tiers:

- **Tier A (default, browser-free):** SVG/EMF/EPS/DXF, the data formats (ics/vcf/csv),
  and raster/PDF of SVG-native tools (qr-code, wordmark, layout-studio, mesh-gradient, …)
  render headlessly via jsdom + resvg. No browser, fast.
- **Tier B (`browser: 'true'`):** raster/pdf/video exports of HTML-*layout* tools need a
  real browser. Setting `browser: 'true'` runs `lolly install-browser --with-deps`
  (scoped Chromium — never a full Playwright install) **and** `npm run build:web` (Tier B
  drives the built web shell), adding several minutes to the job.

Leave `browser` off until a render fails telling you it needs it.

## Brand packs (`profile-root`)

Without `profile-root`, renders use the checkout's fallback profile: the public
community tools + the neutral `lolly-start` brand. The private SUSE pack
(`brands/suse`, `update = none` in `.gitmodules`) is never fetched — that is by design,
and it is why the default `github.token` suffices for the checkout.

To render with your own brand pack, check the pack out yourself (that step, not this
action, is where a private-repo token belongs) and point `profile-root` at a directory
carrying `tools/` and `catalog/` with a built `catalog/tools/index.json` — the marker
`LOLLY_ROOT` validates against:

```yaml
      - uses: actions/checkout@v4
        with:
          repository: your-org/your-brand-pack   # private is fine
          token: ${{ secrets.BRAND_PACK_PAT }}   # PAT with read access to that repo
          path: brand-pack

      - uses: lolly-tools/lolly/action@main
        with:
          tool: qr-code
          args: --url=https://example.com
          profile-root: ./brand-pack
```

## Pinning and private-repo notes

- **Public parent (the current reality):** `lolly-tools/lolly` is public, so the
  action's internal checkout needs no token setup at all — the default `github.token`
  is used and works from any repo, including private ones consuming this action.
- **Private fork/mirror:** if you point `lolly-ref` at a ref that only exists in a
  private fork, the stock action cannot see it — set the `token` input to a PAT that
  can read the fork, and (until the split) also change the `repository:` in your own
  copy of the action, since the checkout targets `lolly-tools/lolly` by name.
- **Reproducibility:** `lolly-ref` defaults to the placeholder tag `v1`; until that tag
  exists, pass a commit SHA. A pinned SHA gives byte-stable tool definitions; `main`
  gives you the newest tools at the cost of renders that may change under you.
