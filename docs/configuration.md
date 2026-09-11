# Configuration guide

Everything that shapes *what a Lolly instance is* - which brand it wears, which tools it exposes, what each tool is allowed to do - is configuration held in files, not settings buried in an app. This guide is the map of those files and the commands that act on them.

## Profiles: brand + tool set

A **profile** binds a set of tool packs to a brand catalog. `profiles.json` at the repo root declares them:

```json
{
  "default": "suse",
  "profiles": {
    "suse":        { "label": "SUSE",  "tools": ["community", "brands/suse/tools"], "exclude": ["rebrand-deck", "street-map"], "catalog": "brands/suse/catalog" },
    "lolly-start": { "label": "Lolly Start (blank brand)", "tools": ["community", "brands/lolly-start/tools"], "catalog": "brands/lolly-start/catalog" }
  }
}
```

Content lives in the packs and nowhere else: there is no `tools/` or `catalog/` directory at the repo root, and nothing to switch. A profile is **resolved per process**:

```bash
pnpm run profile                        # which brand does this checkout resolve to, and from where
pnpm run profile suse                   # what would that profile resolve to
LOLLY_PROFILE=lolly-start pnpm run dev:web    # run one command under another brand
pnpm run build:catalog --profile=suse   # or name it on a catalog script
```

`packages/node-shell/src/content-roots.ts` is the resolver every script, shell and service asks. Precedence: an explicit `--profile=<name>`, then `LOLLY_PROFILE`, then `profiles.json`'s `default`, then the first profile whose packs are all on disk - which is what makes a public clone with no `brands/suse` land on `lolly-start` by itself. It answers "where does tool `<id>` live" (`toolFile`, `listToolFiles`, `readToolManifest`) and "where is the catalog" (`catalogFile`) against the profile's roots, **later roots winning on id collisions**, so a brand pack can override a community tool of the same id. The optional `exclude` list drops tool ids from *this* profile after that merge - a community tool one brand would rather not ship stays available to every other profile, and an id that isn't there is warned about, not fatal.

One copy survives, because a browser still fetches `/tools/<id>/…` and `/catalog/…` over HTTP: `materializeInto(dest)` writes a real `tools/` + `catalog/` tree, and that is what a `dist/` build, an RPM payload or a Docker image carries. Nothing materialises anything into your working tree, so an edit to a tool is an edit in its pack, committed there.

## Brand packs

A brand pack is a directory (`brands/<name>/`) with a `catalog/` and optionally its own `tools/`. A pack can live in the parent repo (as `brands/lolly-start/` does) or be mounted from its own repository as a git submodule - which is how a private pack such as `brands/suse` stays out of public clones, so an instance without access to it simply falls back to `lolly-start`. See [Build Guide » Getting the source](/info/build-guide.html) for checking one out.

Stand a new pack up from a design-tokens export:

```bash
pnpm run ingest:brand <source> --name <brand> [--label "Label"] [--register|--activate]
```

`<source>` is any container Penpot / Tokens Studio export the same DTCG document in - a monolithic `tokens.json`, a one-file-per-set directory, or a `project.penpot` archive. The extracted document is written to `catalog/assets/<ns>/tokens/brand.json` as the pack's core-tier `tokens` asset, where `<ns>` is `<brand>` with hyphens stripped (an asset id can't carry `-` in its first segment, so `--name acme-co` yields `assets/acmeco/…`). Ingest also *derives* the pack's photo-treatment and icon-theme palette documents under `catalog/assets/<ns>/palette/`, so uploaded photos get on-brand washes and themable icons get colour pairings out of the box (icon themes are skipped when the palette has no accent). `--register` upserts the pack into `profiles.json`; `--activate` also builds and validates the catalog for it and prints the `LOLLY_PROFILE=<brand>` line that selects it (nothing is switched globally); `--out` picks a different destination and `--force` overwrites an existing pack. See [Design Tokens](/info/design-tokens.html) for the token model and [Quickstart](/info/quickstart.html) for the end-user brand flow.

### Brand lock

A brand's tokens asset can be marked authoritative (`brandLock` on its index entry). When locked, user-supplied tokens can't override the brand - `installUserTokens` is the single chokepoint and `isLocked()` the gate. The SUSE pack ships locked (its brand is non-overridable); `lolly-start` stays open so the blank-brand onboarding can write to it. Lock a pack when the brand must not drift; leave it open when you *want* end users to bring their own.

## Capability gating (per tool)

Each `tool.json` declares the host capabilities it needs (`schemas/tool.schema.json`). The valid flags are:

```
network · filesystem · clipboard · camera · microphone · screen · ffmpeg · wasm · capture · compose
```

A shell that can't provide a capability **disables** the tool rather than letting it fail - an `ffmpeg` tool is unavailable in the web PWA; a `microphone`/`camera` recording tool is unavailable in the headless CLI; a `capture` tool offers a browser add-on on Chromium and is marked desktop-only elsewhere. `screen` is *display* capture the user grants in browser-native UI (picking a screen, window or tab, via `host.recorder`) - distinct from `capture`, which rasterises a URL the tool itself names. This is how one catalog serves web, desktop and CLI without per-shell tool lists. `network` access is additionally **allowlisted** - a tool declares which hosts it may reach, and `host.net` enforces it.

Notice the badge: URL Screenshot declares `capture`, the browser cannot provide it alone, so the tile offers the add-on instead of vanishing.

![The URL Screenshot tile in the Utilities gallery, carrying an Add-on badge because its capture capability is unmet in a plain browser](/t/url-shot?url=%2F%23%2Fu&width=1440&height=2400&dpi=192&waitMs=2000&format=svg&walker=1&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&cropSelector=.gtile%5Bdata-tool-id%3D%22url-shot%22%5D&tolerance=0.03&dark=1&filename=fq-capability-addon-badge)

## Curating what users see

Two mechanisms narrow the catalog without forking it:

- **Per-instance tool set** - point each instance at a different profile (or a brand pack with a curated `tools/` root) so marketing, sales and IT can each see a different library from one codebase.
- **Per-user feature flags** - surfaced in each person's Profile view, stored on their profile (so they sync). The gallery-category and Batch flags default to **on** (they show/hide whole gallery categories and the Batch entry), as do **Neurospicy Mode** (the focus-music player), the **Jelly effects** UI switch and **Private collab** (`private-collab`, the peer-to-peer working-together feature, wearing a beta pill). Two are opt-in and default to **off**: **Strip metadata from uploads**, the privacy flag described below, and **Print preflight** (`export-preflight`), which puts the *Before you export* prepress card - bleed, resolution, ink coverage, plate counts - above the Download button. Preflight stays off by default on purpose: someone exporting a PNG for a chat message should never be ambushed by prepress findings, and the card never blocks an export either way. The category and Batch flags are purely personal preferences. Five of them - Neurospicy, Jelly effects, Private collab, Strip metadata from uploads and Print preflight - can additionally be **governed** by an optional deployment control plane ([lolly.work](https://lolly.work)), which sets the default applied when the user hasn't chosen and can hide the switch entirely; a hidden flag's governed default wins over a stored user value. Print preflight also honours the older `export.preflight` instance capability, which reads as governance defaulting the flag on, so an instance that granted it keeps the card for members who haven't chosen. None of them ever gate output formats or any API surface. See [Lolly for Operators](/info/operators.html) for the governance model around this.

  ![Every feature flag as its own switch, with the gallery categories on and Strip metadata off](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

  **Strip metadata from uploads** is the privacy one of those two opt-ins: turn it on and images uploaded to your catalogue are scrubbed of EXIF, location (GPS) and other embedded metadata on import. Content Credentials (C2PA provenance) are *always* preserved either way - a signed or AI-generated image keeps its credential whether the flag is on or off.

## Maturity & watermarking

A tool's `status` controls trust signalling, enforced by the engine, not by convention:

- `experimental` - every export is automatically watermarked by the host (the tool can't remove it), so work-in-progress can't be mistaken for finished output.
- `community` - no watermark, but flagged as community-maintained rather than brand-approved. The most-used value in the shipped packs.
- `official` - brand-approved, no watermark.

Promote a tool by changing one field in its manifest. The status is not an internal note: every surface shows it, so a reader knows what they are picking up before they open it.

![A gallery tile carrying the Experimental status badge that its manifest sets, the same field that forces a watermark on every export](/t/url-shot?url=%2F%23%2F&width=1440&height=2400&dpi=192&waitMs=2400&format=svg&walker=1&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&cropSelector=.gtile%5Bdata-tool-id%3D%22voice-recorder%22%5D&tolerance=0.03&dark=1&filename=fq-experimental-badge)

## Catalog build & validation

The manifest is the source of truth; `catalog/tools/index.json` is **generated** and must not drift.

```bash
pnpm run build:catalog     # index.json + asset checksums + preview bundle
pnpm run validate:catalog  # schema + invariants: checksums, file existence,
                          #   bindToProfile fields, palette refs, replacedBy chains
```

`validate:catalog` fails CI if the generated index drifts from the manifests, so run `build:catalog` after any `tool.json` or asset edit. Tool and asset **IDs are permanent contracts** - version in the manifest, never rename the path.

## Engine & runtime knobs

Most runtime behaviour is fixed contract rather than deploy-time config, but two things stand out:

- **Engine version** - `ENGINE_VERSION` in `engine/src/version.ts` (read the live value there; `engine/CHANGELOG.md` tracks every minor). The capability bridge is additive-only within a major, so shells and tools built against an older minor keep working. See [Host API](/info/host-api.html).
- **Hook budgets** - `HOOK_BUDGET_MS` in `engine/src/runtime.ts` time-boxes async tool hooks (`onInit` 5s, `onInput` 2s, export hooks 5–10s). It's exported for tests; async overruns are abandoned, sync overruns only logged (hooks are not a sandbox - see [Operators](/info/operators.html#good-to-know)).

## The services' own config

- **CA service** reads `services/ca/.env` for provider credentials and certificate policy (`CA_CERT_DAYS` default 30, `CA_CERT_MAX_DAYS` default 365, allowed day set). Policy stays server-side; see the [Content Credentials Identity](/info/content-credentials-identity.html) operator runbook.
- **MCP server** exposes hosted endpoints with OAuth; self-hosting and the tool surface are covered in [MCP Server](/info/mcp.html).
