# Digital sovereignty

This document states, plainly, how much control a user keeps over their data and
their tooling when they run Lolly — and, just as plainly, where that control has
boundaries. It exists so the answer to "how sovereign is this?" comes from the
project itself, with file-level evidence, rather than from a reader's guess or a
marketing line. Each claim points at the code that backs it; verify them.

## Properties we hold

- **Compute is local.** Tools render on the user's device. The engine has no
  server it reports to and no cloud render path — see the three-layer separation
  in [CLAUDE.md](CLAUDE.md) and [`engine/package.json`](engine/package.json)
  (runtime deps are `handlebars` + `ajv`, nothing networked).

- **No telemetry, no cookies, no analytics.** Usage counters are local-only by
  construction ([`shells/web/src/metrics.js`](shells/web/src/metrics.js)); the
  privacy posture is spelled out in [`docs/privacy.md`](docs/privacy.md).

- **Network is deny-by-default.** A tool receives a `net` bridge *only* if its
  manifest declares the `network` capability; the bridge is optional in the
  contract ([`engine/src/bridge/host-v1.ts`](engine/src/bridge/host-v1.ts), the
  `net?: NetAPI` member) and allowlist-enforced by the shell
  ([`shells/web/src/bridge/net.js`](shells/web/src/bridge/net.js)). Tools that
  don't declare it cannot reach the network at all.

- **Storage is first-party and on-device.** Tool state and profile go through
  `host.state` — IndexedDB on web, filesystem on Tauri, memory on CLI — never a
  remote and never `localStorage` for tool data
  ([`shells/web/src/bridge/state.js`](shells/web/src/bridge/state.js)).

- **No third-party runtime fetches.** Typefaces are bundled and served from the
  same origin, not Google Fonts or a CDN; text-to-path uses a bundled HarfBuzz
  WASM, not a hosted service.

- **Open Source, copyleft-licensed.** `engine/`, `shells/`, `schemas/`, and
  `docs/` are open-sourceable by design under [MPL-2.0](LICENSE); the
  no-cross-imports rule keeps the split clean so the platform can be run
  independently of any SUSE-specific content.

## Boundaries we don't yet hold

Honesty about the edges is part of the claim. These are real and intentional.

- **Personal provenance is opt-in, not impossible.** If the user opts in on `/profile`,
  profile fields are embedded into exported assets/bundles as provenance, and
  share links can carry identifying data when online (see the FAQ in
  [`docs/faq.md`](docs/faq.md)). Sovereignty here is a user choice at export
  time, not an absolute property of the system. Users have privacy & control.

- **The catalog origin is a trust anchor, and tool code is not yet verified at
  runtime.** Tools are *data, not code*, but that data includes `hooks.js`,
  which the engine executes via `new Function`. The loader fetches and runs
  whatever the origin returns with no integrity check
  ([`engine/src/loader.js`](engine/src/loader.js)), and asset checksums are
  computed at **build time only** — there is deliberately no runtime
  verification on the fetch path
  ([`scripts/checksum-assets.js`](scripts/checksum-assets.js)). So a user who
  trusts a catalog origin trusts it to ship honest tool code. **Closing this
  gap** — per-file integrity digests in the tool index plus a signature over the
  catalog, verified client-side before `hooks.js` runs — is designed but not yet
  implemented. Until then, host the catalog yourself or trust whoever does.
- **The shipped content layer is private and unsigned.** The actual SUSE
  `tools/` and `catalog/assets/` intended to live outside the open repo and are not 
  signed, so this document attests that the architecture is *sovereignty-capable*, 
  not that any particular deployment's content is.


## Supply chain: the SBOM

`sbom.cdx.json` is a [CycloneDX 1.5](https://cyclonedx.org/) Software Bill of
Materials inventorying the third-party components Lolly distributes: the full npm
dependency graph of the engine + web + CLI workspace, the Tauri shells' npm
dependencies, the Tauri Rust crates, the two vendored browser libraries (`d3`,
`topojson-client`), and the bundled **SUSE** / **SUSE Mono** fonts — each with its
resolved version, license, and a verifiable hash where one exists. It answers the
supply-chain-transparency question — *what code does this build actually run?* —
without asking anyone to take our word for it. (See the scope notes below for the
remaining caveats.)

```bash
npm run build:sbom        # regenerate sbom.cdx.json (npm locks + Cargo.lock + vendored files + fonts)
```

- **Source of truth** is the root `package-lock.json` (lockfileVersion 3). The
  generator ([`scripts/build-sbom.js`](scripts/build-sbom.js)) reads the lock's
  own `integrity` and `license` fields verbatim, so the SBOM cannot disagree with
  what npm installed. It is self-contained — no external SBOM tool, no network —
  because adding an opaque generator dependency would undercut the very thing the
  SBOM is meant to demonstrate. The same generator additionally folds in the Tauri
  shells' own `package-lock.json` files, the Rust crates from
  `shells/tauri-desktop/src-tauri/Cargo.lock`, the vendored `*.min.js` libraries
  (hashed on disk), and the OFL fonts — each existence-guarded so the script still
  runs on a partial checkout.
- **Complete, not filtered.** Dev-only packages are included and tagged
  `cdx:npm:package:development=true` (CycloneDX convention) rather than dropped,
  so a reviewer can filter to "what runs on a user's device" themselves. The
  three workspace packages appear as subcomponents of the BOM subject.
- **Deterministic.** Components are sorted by purl, the serial number is derived
  from a content hash, and the timestamp is held stable while the dependency set
  is unchanged. A clean `git diff` after `npm run build:sbom` means the SBOM is
  current; a non-empty one means dependencies moved and the SBOM was stale —
  CI can assert "no diff" as a drift guard, the same way `validate:catalog`
  guards the generated catalog index.

**Scope notes.** Two honest caveats remain *within* that inventory:

- the Rust crates from
  [`shells/tauri-desktop/src-tauri/Cargo.lock`](shells/tauri-desktop/src-tauri/Cargo.lock)
  are listed with version + checksum but license `unknown` — `Cargo.lock` carries
  no license metadata; enrich with `cargo metadata` when a Tauri build actually
  ships. [`shells/tauri-mobile`](shells/tauri-mobile) has no `Cargo.lock` yet, so
  its crate graph isn't enumerated.
- the SUSE-proprietary fonts/assets currently share this single SBOM; a
  private/overlay SBOM may be cleaner once `tools/` + `catalog/assets/` split out.

Verify any component's hash against what's installed, e.g.:

```bash
# compare the SBOM's SHA-512 for handlebars to the tarball npm resolved
node -e "console.log(require('./sbom.cdx.json').components.find(c=>c.name==='handlebars').hashes)"
```

## What this does and does not protect against

The SBOM gives you **auditability and supply-chain transparency**: a hash-pinned
inventory of the components the build distributes — npm, Tauri npm, Rust crates,
vendored libraries, and fonts (see the scope notes above) — regenerable offline
and diffable in review. It does **not** by itself authenticate the *catalog* a client syncs
from — substituting tool code at a malicious or compromised catalog origin is a
separate threat that requires catalog signing + runtime integrity verification
(the deferred work noted under Boundaries). Treat this document as the current,
honest state — strong local-first design, transparent dependencies, and the
remaining caveats named above with a known path to closing them.
