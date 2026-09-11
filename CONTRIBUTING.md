# Contributing to Lolly

This file is a **router**. It tells you where things live and which command to run before you open a pull request. The concepts themselves are explained elsewhere and linked from here rather than repeated.

Start with [`README.md`](README.md) for what Lolly is, and [`docs/`](docs/) for the architecture and authoring guides.

**Contributing one tool? You can skip the clone.** A tool is a folder: `tool.json`, `template.html`, and whatever else it needs. Write one, zip the folder, drop the zip on [lolly.tools](https://lolly.tools) or any Lolly instance, and choose **Install this tool** to run it on that device. When it works, open a pull request against [`lolly`](https://github.com/lolly-tools/lolly) with your tool under `community/<id>/`. The steps and the consent prompt are in [Try it without cloning](docs/authoring-tools.md#try-it-without-the-monorepo). Everything below is for changing the platform itself.

**History before 2026-09-11.** Until that date the shells, docs, services and the community tool pack each lived in their own repository under `github.com/lolly-tools`, mounted here as git submodules. They were folded into this one repository with `git subtree add`, which carries over every commit, author and message but not path continuity: a plain `git log -- shells/web/src/main.ts` stops at the fold. Use `git log --follow` to cross it, and `git blame --follow` for line history that predates the fold. The ten former repositories are archived on GitHub, each with a redirect note naming the commit it was folded at, and pre-fold bundles are kept for anyone who needs a clone of just one shell's history.

## 1. Clone, then install

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly

# Install the pinned package manager once (or use Corepack).
npm install --global pnpm@11.1.2
pnpm install
```

Use the pinned pnpm version in `packageManager`. Commit `pnpm-lock.yaml` when dependencies change; CI and deployments use `pnpm install --frozen-lockfile`. Workspace dependencies use `workspace:*` so published packages cannot silently replace local code. Pass script arguments directly, for example `pnpm run profile lolly-start`.

Tauri desktop and mobile are separate pnpm projects with their own lockfiles, deliberately kept out of the root workspace; run `pnpm -C shells/tauri-desktop install` or `pnpm -C shells/tauri-mobile install` before building them.

After dependency changes, run `pnpm run update:npm-licenses`, `pnpm run build:sbom` and `pnpm run build:licenses`, and commit the generated license cache and notices. The cache records registry license metadata for exact versions, including optional packages for other operating systems.

## 2. The one private pack, and why it does not block you

`brands/suse` is a private submodule holding SUSE's tool and asset pack, including licensed fonts and PremiumBeat music. It is declared `update = none` in [`.gitmodules`](.gitmodules), so a plain clone or `git submodule update --init --recursive` never fetches it and no credential prompt appears.

Tool and asset content is otherwise mounted as packs, resolved at build and run time from [`profiles.json`](profiles.json) by `packages/node-shell/src/content-roots.ts` - there is no repo-root `tools/`/`catalog/` view written to disk:

| Profile | Tool roots | Catalog |
|---|---|---|
| `suse` (the declared default) | `community` + `brands/suse/tools` | `brands/suse/catalog` |
| `lolly-start` | `community` + `brands/lolly-start/tools` | `brands/lolly-start/catalog` |

Without `brands/suse` mounted, the default `suse` profile is incomplete on your machine, which the resolver handles deliberately: it checks `LOLLY_PROFILE`, then the sticky choice from your last explicit pick, then the default, and if the default's packs are not all present on disk it falls back to the first profile whose packs are complete. In a public clone that is `lolly-start`, the blank starter brand. Everything builds, renders and tests from there.

Switch explicitly at any time:

```bash
pnpm run profile              # print the resolved profile and its roots
LOLLY_PROFILE=lolly-start pnpm run dev:web    # blank starter brand, community tools only
LOLLY_PROFILE=suse pnpm run dev:web           # needs: git submodule update --init --checkout brands/suse
```

## 3. Where your changes go

Almost everywhere, a change is one commit in this repository: `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, root files, `community/`, `brands/lolly-start/`, `profiles.json`, `docs/`, `services/mcp`, `services/ca`, and every `shells/*`.

The one exception is `brands/suse`: it is a separate, private repository (`suse-lolly`), mounted as a submodule. A change there is a commit inside `brands/suse`, then a second commit here recording the new pointer. Committing from the repo root does **not** capture edits made *inside* the submodule - git only sees the pointer.

One case still deserves care even though it is no longer a cross-repo edit. `catalog/tools/index.json` is generated **per brand**, and every brand's index lists the community tools - so editing a community `tool.json` leaves the SUSE profile's index stale even though both live in the same repository now, and the single-profile `pnpm run build:catalog` can't see the drift because it only looks at the active profile. After any community tool change:

```bash
pnpm run build:catalog:all      # rebuild every mounted profile, then restore the active one
pnpm run validate:catalog:all   # validate every mounted profile; exits 1 on drift (the CI guard)
```

A profile whose packs are not mounted is skipped rather than failed, so `brands/suse` being absent is fine.

## 4. Commands to run before you open a PR

```bash
pnpm test          # the full suite: tests/ plus the co-located suites
pnpm run typecheck # tsc -p across every project
```

`pnpm test` uses quoted globs on purpose. If you want to run a subset by hand, quote them yourself:

```bash
node --test "tests/**/*.test.ts"
```

An unquoted directory (`node --test tests/`) makes current Node try to load `tests` as a module instead of discovering test files. Layout, gated tests and the conventions the suite holds itself to are in [`tests/README.md`](tests/README.md).

**If you touched any `tool.json` or a catalog asset:** see section 3 above, `pnpm run build:catalog:all` and `pnpm run validate:catalog:all`, not the singular forms.

**Linting is advisory.** `pnpm run lint` is Biome, and the baseline carries thousands of pre-existing findings. It is not a CI gate, a clean run is not a precondition for merging, and you should not spend your PR fixing the backlog. Keep the files you touched tidy and move on.

## 5. Where does this code live

| Path | What it is |
|---|---|
| `engine/` | The platform-agnostic core. No DOM, no storage, no networking, no brand knowledge. |
| `schemas/` | JSON Schemas for `tool.json`, assets, asset refs, tokens and canonical inputs. |
| `shells/web/` | The Vite PWA and its capability-bridge implementations. See [`shells/web/README.md`](shells/web/README.md). Other hosts sit alongside it: [`cli`](shells/cli/README.md), [`tui`](shells/tui/README.md), [`tauri-desktop`](shells/tauri-desktop/README.md), [`tauri-mobile`](shells/tauri-mobile/README.md), [`chrome-extension`](shells/chrome-extension/README.md). |
| `community/` | Brand-agnostic tool definitions: manifest, template, optional hooks. Data, not code. See [`community/README.md`](community/README.md). |
| `brands/` | Brand packs. [`brands/lolly-start/`](brands/lolly-start/README.md) is the blank starter, owned here; [`brands/suse/`](brands/suse/README.md) is the private SUSE pack, a submodule. |
| `packages/core` | `@lolly-tools/core`, the tool-author SDK and the canonical `HostV1` contract. See [`packages/core/README.md`](packages/core/README.md). `packages/node-shell` holds the [shared Node host pieces](packages/node-shell/README.md), including the content-pack resolver (`src/content-roots.ts`). |
| `services/` | The optional hosted components: the [MCP server](services/mcp/README.md) and the [device-credential CA](services/ca/README.md). |
| `scripts/` | Catalog build and validation, brand ingest, and deploy. See [`scripts/README.md`](scripts/README.md). |
| `tests/` | Engine and contract tests, plus the fuzz harness under `tests/fuzz/`. See [`tests/README.md`](tests/README.md). |
| `docs/` | Architecture, authoring guides, positioning, and the generator for the `/info` site. See [`docs/README.md`](docs/README.md). |

Two rules hold this shape together. Tools never import from the engine and never touch the DOM, filesystem or network directly, they call `host.*`. The engine never learns about a brand, a shell or a platform. A pull request that crosses either line will be asked to move the code.

## 6. Security

Report vulnerabilities privately. The policy, scope and safe-harbour statement are in [`SECURITY.md`](SECURITY.md). The standing posture, the cryptographic primitives, and the design boundaries the project is explicit about, including the fact that tool hooks are not a security sandbox, are documented in [`docs/security-verification.md`](docs/security-verification.md).

Before you change code on either side of a trust boundary, read [`docs/threat-model.md`](docs/threat-model.md). It maps every boundary to the code that enforces it and to the test that covers it, records the residual risks the project accepts, and is explicit about what is *not* a boundary. If the thing you are touching reads bytes somebody else produced, find it in [`docs/parser-inventory.md`](docs/parser-inventory.md) first: that lists each untrusted-input parser with its bound constants, its tests and whether it is fuzzed, so you can see what the existing limits are before you add another.

If your change touches a parser that eats untrusted bytes, or a crypto module, **add or extend a fuzz target**. The harness lives in `tests/fuzz/` (`prng.ts`, `mutate.ts`, `targets.ts`, with saved inputs in `tests/fuzz/regressions/`). Each target pairs a small seed corpus of valid inputs with an `invoke()` that feeds one mutated buffer through the parser, and `invoke()` must not swallow errors, because the runner classifies them: a thrown validation error is the desired behaviour, a hang or an allocation blow-up is a finding. `tests/fuzz-regression.test.ts` replays every saved regression plus a short seeded sweep as part of the normal suite, and the long discovery soak is standalone:

```bash
FUZZ_ITERS=50000 node tests/fuzz/run.ts
```

Targets already covered include `c2pa-verify`, `cbor`, `media-sniff`, `pdf-map`, `x509`, `file-metadata`, `strip-metadata`, `video-meta`, `data-import`, `pptx-read`, `pptx-patch`, `icc`, and the web shell's `pptx` bridge. Use the closest one as your template.
