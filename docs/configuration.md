# Profiles, brands and tool configuration

This page is for whoever decides what a Lolly instance is: which brand it wears, which tools it offers, what each tool may do and how people's own switches behave. All of that lives in files you can read and review, not in settings buried in an app. Each section below gives the file and the command that acts on that file.

## Profiles: brand + tool set

A **profile** binds a set of tool packs to a brand catalog. `profiles.json` at the repository root declares them:

```json
{
  "default": "suse",
  "profiles": {
    "suse":        { "label": "SUSE",  "tools": ["community", "brands/suse/tools"], "exclude": ["rebrand-deck", "street-map"], "assets": ["community/emoji-packs"], "catalog": "brands/suse/catalog" },
    "lolly-start": { "label": "Lolly Start (blank brand)", "tools": ["community", "brands/lolly-start/tools"], "assets": ["community/emoji-packs"], "catalog": "brands/lolly-start/catalog" },
    "lolly-demo":  { "label": "Lolly Demo", "tools": ["community", "brands/lolly-demo/tools"], "assets": ["community/emoji-packs"], "catalog": "brands/lolly-demo/catalog" }
  }
}
```

`lolly-demo` is [Lolly Demo](/info/lolly-demo.html), the brand lolly.tools and the published images ship. `lolly-start` is the blank starter, and the one a public clone and CI use. `suse` needs the private pack, which a public clone does not have.

A profile is chosen per command, not switched globally. Content lives in the packs and nowhere else, so there is no `tools/` or `catalog/` directory at the repository root to switch:

```bash
pnpm run profile                              # which profile this checkout resolves to, and why
pnpm run profile lolly-demo                   # what that profile would resolve to
LOLLY_PROFILE=lolly-start pnpm run dev:web    # run one command under another brand
pnpm run build:catalog --profile=lolly-demo   # or name it on a catalog script
```

::: figure configuration-profile-resolution
How a command finds its profile, and what the profile hands back. The first rule that applies wins.
:::

`packages/node-shell/src/content-roots.ts` is the resolver every script, shell and service asks. It takes the first of these that applies:

1. an explicit `--profile=<name>`;
2. `LOLLY_PROFILE`;
3. a `.lolly-profile` file at the repository root (written by `setup.sh --profile=<name>`), if that profile's packs are on disk;
4. the `default` in `profiles.json`, if its packs are on disk;
5. the first profile whose packs are all on disk, which is how a public clone with no `brands/suse` resolves to `lolly-start` by itself.

The resolver then answers "where does tool `<id>` live" (`toolFile`, `listToolFiles`, `readToolManifest`) and "where is the catalog" (`catalogFile`) from the profile's roots. **Later roots win on id collisions**, so a brand pack can override a community tool with the same id. The optional `exclude` list drops tool ids from this profile after that merge: a community tool one brand would rather not ship stays available to every other profile, and an id that is not there gives a warning, not an error.

::: details Shared asset roots, and the one copy a build writes
A profile's optional `assets` list mounts **shared asset roots**, which is how one file belongs to every brand at once. A shared root is a directory holding its own `index.json` plus its files. Its entries are appended to the brand's asset index, and their addresses are the profile-independent `/catalog/packs/<rootName>/<file>`.

`community/emoji-packs/` is the one this repository ships. It holds seven emoji sets (Twemoji Color, OpenMoji Color and Black, Fluent Flat and High Contrast, Noto Color and Blobmoji Color), each as one on-demand bundle. All three profiles list it, so every brand serves the same files with no copy in any catalog.

`readAssetIndex()` is the merged index every Node reader asks for, and the dev server assembles the same merge per request. Shared roots are additive: an asset id claimed by two roots is refused rather than settled by order, and a root that is not on disk is skipped rather than treated as a missing pack, so a build without a shared root still resolves everything else.

One copy is written, because a browser still fetches `/tools/<id>/…` and `/catalog/…` over HTTP. `materializeInto(dest)` writes a real `tools/` and `catalog/` tree, each shared root to `catalog/packs/<name>/` and the merged index to `catalog/assets/index.json`. That tree is what a `dist/` build, an RPM payload or a container image carries. Nothing is written into your working tree, so a tool edit is an edit in its pack, committed there.
:::

## Brand packs

A brand pack is a directory (`brands/<name>/`) with a `catalog/` and, optionally, its own `tools/`. A pack can live in this repository, as `brands/lolly-start/` and `brands/lolly-demo/` do, or be mounted from its own repository as a git submodule. That is how the one private pack, `brands/suse`, stays out of public clones; an instance without it falls back to `lolly-start`. [Get the source](/info/contributing-setup.html#the-private-suse-pack) covers checking one out, and [Brand architectures](/info/brand-architectures.html) covers how parent brands, sub-brands and companions relate.

Stand a new pack up from a design-tokens export:

```text
pnpm run ingest:brand <source> --name <brand> [--label "Label"] [--register|--activate]
```

`<source>` is any container Penpot or Tokens Studio exports the same DTCG document in: a single `tokens.json`, a one-file-per-set directory or a `project.penpot` archive.

- The extracted document is written to `catalog/assets/<ns>/tokens/brand.json` as the pack's core-tier `tokens` asset. `<ns>` is `<brand>` with hyphens removed, because an asset id cannot carry `-` in its first segment, so `--name acme-co` gives `assets/acmeco/…`.
- Ingest also derives the pack's photo-treatment and icon-theme palette documents under `catalog/assets/<ns>/palette/`, so uploaded photos get on-brand washes and themable icons get colour pairings from the start. Icon themes are skipped when the palette has no accent.
- `--register` adds the pack to `profiles.json`. `--activate` also builds and validates its catalog and prints the `LOLLY_PROFILE=<brand>` line that selects it; nothing is switched globally. `--out` picks another destination and `--force` overwrites an existing pack.

[Design Tokens](/info/design-tokens.html) covers the token model. People set up their own design system in the app with [Design System Setup](/info/brand-studio.html).

### Brand lock

A brand's tokens asset can be marked read-only with `brandLock` on its index entry. The SUSE pack ships locked; `lolly-start` and Lolly Demo stay open, so people can hide, edit and reset their own copy.

The lock protects that design system's material. People can still create, select and edit their own local systems or make an editable copy of a locked one. `isLocked()` follows the selected system, and `installUserTokens` refuses edits to locked material while allowing creation and sync writes to a separate record. Tools and exports use the selected design system.

## Supplied and local design systems

**Settings → Design systems** labels the deployment's default system **Managed by this instance** when its tokens asset sets `brandLock` (a desktop app with no instance says **Managed by this app**). People can use a managed system but cannot change its colours, type or logos. Without the lock, the system reads **Came with this app**, or **From this instance** in an app connected to the deployment.

Expand **Catalogue source** to see the supplied tokens asset, its namespace, the last-known origin and the known version or checksum. Cached or unavailable material is labelled. **Lolly instance → Design-system source** opens the same explanation.

A catalogue can offer design systems beside its own. List them as `companionDesignSystems` in its `assets/index.json`, each with a `tokens` asset id and a `label`:

```json
"companionDesignSystems": [{ "tokens": "lolly/tokens/brand", "label": "Lolly Starter" }]
```

Each entry must be a tokens asset in the same index, or `lolly/tokens/brand`, the blank starter every web build carries. `validate:catalog` checks the list. A browser gets each companion once, as a local system the person can edit, reset to the original or remove, and the active system does not change. lolly.tools offers Lolly Starter beside Lolly Demo this way. A locked catalogue (`brandLock`) offers no companions.

On Lolly Work, an authenticated administrator can follow **Manage instance design systems** to inspect server sources and preview a change of default or a retirement. Stopping a connect download leaves the mounted catalogue available. A newer server advertises revisions: safe views refresh on focus or reconnect, while an open tool or an editable local copy gets a notice and keeps its work. Older servers keep their existing refresh behaviour.

### Removing a catalogue design system

A system imported into the browser is a separate local copy. Removing that copy changes this browser or device only, and cannot delete files on a host. If the copy was active, the supplied system becomes active again; the removal dialog says which one before you confirm. Catalogue assets, personal sessions and uploads remain, and the supplied system's colours, type and logos can stay visible after the local copy has gone.

To change or remove a design system the server supplies:

::: timeline
- <!--i:folder--> **Change the source.** Update the content profile in `profiles.json` and its brand pack. For a neutral instance, select `lolly-start`. For a custom catalogue, remove the unwanted asset entries and files from the pack and replace any token or tool references that still need them. Keep permanent asset ids assigned to their original assets.
- <!--i:checklist--> **Rebuild and validate every profile** with `pnpm run build:catalog:all` and `pnpm run validate:catalog:all`.
- <!--i:upload--> **Rebuild and redeploy** with the intended `LOLLY_PROFILE`, and deploy the complete output, catalogue included. Replace the old deployment files so removed assets are no longer served.
- <!--i:globe--> **Purge and reload.** Purge any host or CDN cache for the changed catalogue files, then reload Lolly while online so it fetches the new catalogue. Check the supplied system's name and **Catalogue source** again, and refresh any downloaded offline copy before testing offline.
:::

Assets that saved sessions reference can stay cached for those sessions. An instance's administrator controls the deployment's files; the browser's **Remove** action only manages local copies.

## Capability gating (per tool)

Each `tool.json` declares the host capabilities it needs (`schemas/tool.schema.json`). The valid flags are:

```
network · filesystem · clipboard · camera · microphone · screen · ffmpeg · wasm · capture · compose
```

A shell that cannot provide a capability **disables** the tool rather than letting it fail. An `ffmpeg` tool is unavailable in the web app; a `microphone` or `camera` recording tool is unavailable in the headless CLI; a `capture` tool offers a browser add-on on Chromium and is marked desktop-only elsewhere. That is how one catalog serves web, desktop and CLI without per-shell tool lists.

`screen` is display capture the person grants in the browser's own picker (a screen, window or tab, through `host.recorder`). It differs from `capture`, which rasterises a web address the tool itself gives. `network` access is also **allowlisted**: a tool declares which hosts it may reach, and `host.net` refuses every other host.

URL Screenshot declares `capture`, which a plain browser cannot provide alone, so its tile offers the add-on instead of vanishing:

![The URL Screenshot tile in the Utilities gallery, carrying an Add-on badge because its capture capability is unmet in a plain browser](/t/url-shot?url=%2F%23%2Fu&width=1440&height=2400&dpi=192&waitMs=2000&format=svg&walker=1&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&cropSelector=.gtile%5Bdata-tool-id%3D%22url-shot%22%5D&tolerance=0.03&dark=1&filename=fq-capability-addon-badge)

## Curating what people see

Two mechanisms narrow the catalog without forking the catalog itself.

**A tool set per instance.** Point each instance at a different profile, or at a brand pack with a curated `tools/` root, so marketing, sales and IT each see a different library from one codebase.

**Switches per person.** **Settings → Feature flags** holds them, stored on each person's profile so they sync. None of them ever gates an output format or any API.

| Switch | Default | An organisation can govern it |
|---|---|---|
| Gallery categories: Tools for Everyone, Designer Tools, Event Kit, Offline Utilities | On | No |
| Connectors: one per send destination, such as Google Drive, Dropbox or S3 | On | No |
| Private collab (`private-collab`), the peer-to-peer working-together feature, in beta | On | Yes |
| Neurospicy Mode, the focus-music player (its switch is in **Settings → Accessibility**) | On | Yes |
| Jelly effects | Off | Yes |
| Wobbly windows, and its mesh curve | Off | Yes |
| Strip metadata from uploads | Off | Yes |
| Print preflight (`export-preflight`) | Off | Yes |
| Performance UI and Performance HUD | Off | No |
| Training and courses | Off | No |

Turning a connector off withdraws that destination everywhere it is offered. Nearby discovery, which lets Lolly devices on the same network find each other when starting a collab, has no switch in this list; it is on by default, and an organisation can govern it too.

**Strip metadata from uploads** scrubs EXIF, location (GPS) and other embedded metadata from images uploaded to Assets. Content Credentials are always kept either way, so a signed or AI-generated image keeps its credential whether the switch is on or off.

**Print preflight** puts the *Before you export* prepress card (bleed, resolution, ink coverage, plate counts) above the Download button. It stays off by default so someone exporting a PNG for a chat message never meets prepress findings, and the card never blocks an export. It also honours the older `export.preflight` instance capability, which reads as governance defaulting the switch on, so members of an instance that granted it keep the card until they choose.

An optional organisation control plane, [Lolly Work](/info/work-governance.html), can govern the switches marked Yes. It sets the default used when a person has not chosen, and it can hide the switch entirely; a hidden switch's governed default wins over a stored personal value.

![Every feature flag as its own switch, with the gallery categories on and Strip metadata off](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Maturity & watermarking

A tool's `status` controls how much trust it signals, enforced by the engine rather than by convention:

- `experimental`: exports are watermarked by default, so work in progress cannot be mistaken for finished output. The engine sets that default, and the tool's own code cannot remove the watermark. The code that calls the export can turn it off for one export (`watermark: false`), and on-device utilities (`privacy: "on-device"`) never carry one.
- `community`: no watermark, but flagged as community-maintained rather than brand-approved.
- `official`: brand-approved, no watermark. The most-used value in `community/`.

Promote a tool by changing one field in its manifest. Every surface shows the status, so a reader knows what they are picking up before opening the tool.

![A gallery tile carrying the Experimental status badge that its manifest sets, the same field that turns the export watermark on by default](/t/url-shot?url=%2F%23%2Fu&width=1440&height=2400&dpi=192&waitMs=2400&format=svg&walker=1&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&cropSelector=.gtile%5Bdata-tool-id%3D%22voice-recorder%22%5D&tolerance=0.03&dark=1&filename=fq-experimental-badge)

The manifest is the source of truth, and each brand's `catalog/tools/index.json` is generated from the manifests. `validate:catalog` checks the schemas, asset checksums, file existence, `bindToProfile` fields, palette references and `replacedBy` chains, and fails CI when the generated index drifts from the manifests. After any `tool.json` or asset edit, rebuild and validate with the commands in [Publish and localize a tool](/info/tool-publishing.html). Tool and asset ids are permanent contracts: version in the manifest, never rename the path.

## Organisation policy with Lolly Work

Content profiles and brand packs configure what a build ships. Optional **Lolly Work** adds policy for the running organisation: OIDC identity and SCIM provisioning, group permissions, managed profile fields, tool-input restrictions, selected feature flags and export settings. It also configures shared catalogs, projects, approvals, delivery and usage reporting. Personal preferences do not override controls labelled **Managed by your organisation**.

Keep that service's configuration in its own deployment. See its [configuration](/info/work-configuration.html) and [governance](/info/work-governance.html) guides, and [Choose a deployment](/info/deployment.html#organisation-services-with-lolly-work) for how it sits beside this app. Static builds keep using the settings on this page without an organisation service.

## The services' own config

- **CA service** reads `services/ca/.env` for provider credentials and certificate policy (`CA_CERT_DAYS` default 30, `CA_CERT_MAX_DAYS` default 365 and the allowed day set). Policy stays on the server; see [Content Credentials identity](/info/content-credentials-identity.html).
- **MCP server** needs an access token (OAuth or bearer) unless the operator opens it with `LOLLY_MCP_ALLOW_ANONYMOUS=1`. A hosted server keeps a daily CPU and data-transfer budget (`LOLLY_BUDGET_CPU_SECONDS_PER_DAY`, `LOLLY_BUDGET_EGRESS_MB_PER_DAY`), a PNG area cap (`LOLLY_MCP_MAX_RASTER_PIXELS`) and request, answer and image size limits (`LOLLY_MCP_REQUEST_MAX_BYTES`, `LOLLY_MCP_RESPONSE_MAX_BYTES`, `LOLLY_MCP_MAX_IMAGE_BYTES`). [MCP server](/info/mcp.html) covers self-hosting, the limits and the tool surface.

The engine version and the time limits on tool hooks are fixed by the engine rather than set per deployment; [Host API](/info/host-api.html) and [Tool hooks](/info/tool-hooks.html) cover them.
