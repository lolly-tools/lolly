# lolly-cli

The headless shell. It renders any tool in the catalogue to a file without a browser, and it exists for two reasons beyond convenience: it is the proof that the engine and the tools are genuinely host-agnostic, and it is the CI smoke gate.

The design claim it defends is stated in the header of `bin/lolly.ts`: **the CLI is URL mode under a different transport.** `--foo=bar` argv pairs become the same input values the web shell parses from `?foo=bar`. The engine cannot tell which transport delivered them, so the GUI and the CLI cannot drift.

Own repo `lolly-cli`, mounted in the umbrella [`lolly`](https://github.com/lolly-tools/lolly) as a git submodule at `shells/cli/`. See the [submodule caveat](#submodule-caveat), which for this shell is sharper than usual.

## Entry point

**`bin/lolly.ts`** is the entry, declared as the `lolly` bin in `package.json` and run by Node's native TypeScript type-stripping, with no build step. It parses argv, peels off the reserved subcommands, and delegates:

| Invocation | Goes to |
|---|---|
| `lolly` | `listToolsCli()` in `src/run.ts` |
| `lolly <tool-id>` | `showToolInputsCli()` in `src/run.ts` |
| `lolly <tool-id> --foo=bar …` | `runToolCli()` in `src/run.ts` |
| `lolly validate <file>` | `src/validate.ts`, the same engine verifier the web `/verify` view uses |
| `lolly install-browser` | `src/install-browser.ts`, a one-time scoped Chromium download |
| `lolly assets [query]` | `listAssetsCli()` in `src/run.ts`, the catalogue asset listing |
| `lolly batch …` | `src/batch.ts`, a CSV/JSON multi-row run |
| `lolly smoke` | `src/smoke.ts`, renders every catalogue tool at defaults |

`src/run.ts` is the render path: build a jsdom document, load the tool, create the runtime, hydrate the template into that DOM, then export. `src/batch.ts` handles multi-row runs and `src/raster.ts` picks the raster tier.

## The machine surface

Three small modules carry the whole contract a script or an agent sees, and every command goes through them rather than hand-rolling its own answer:

| Module | What it owns |
|---|---|
| `src/exit-codes.ts` | the frozen eight-code taxonomy, `CliError` (message + `exit` + a stable `kind`), and `exitCodeFor()`, which classifies a thrown value on typed sentinels only - never on prose |
| `src/envelope.ts` | the one `--json` document: `{ schemaVersion, command, ok, engine, cli, result, warnings, error }`. `emitResult()` for an answer, `emitError()` for a run that produced none. The top-level catch in `bin/lolly.ts` emits it too, so a `--json` run **always** leaves one parseable document on stdout, including on a crash |
| `src/environment.ts` | `describeEnvironment()` - what this installation can actually do (capabilities, native formats, and per-tier availability with a reason for each unavailable one). It rides inside `list --json` rather than becoming a command of its own, so discovery is one call |

`src/output.ts` enforces the stream split: `note()`/`warn()` are the only ways the shell says anything, both stderr; `writeOut()` awaits the stdout write so a piped export cannot be truncated; and `keepConsoleOffStdout()` moves `console.log`/`info`/`debug`/`warn` to stderr for the whole process, because a tool's `hooks.js` runs in this realm and a stray log line would otherwise land inside an exported PNG.

## The bridge

**`src/bridge.ts` is one monolithic file, and that is deliberate.** The web shell splits its bridge into dozens of files with lazy facades because it has a boot budget to defend. A CLI process has no first paint, so there is nothing to defend, and a single file makes this shell readable as what it is: a complete, alternative, from-scratch implementation of the same `HostV1` contract. That the same engine and the same unmodified tools run against it is the point. Do not "improve" it by mirroring the web shell's file layout.

`createCliBridge({ dom, profile, networkAllowlist })` is async and resolves to a `HostV1` with `shell: 'cli'`. Assets come from the filesystem, reading `catalog/assets/index.json` once at startup into a `Map`. State is an in-memory `Map` unless `$LOLLY_STATE_DIR` names a directory, in which case slots are also written there as JSON so a state-saving tool can be scripted. `log` writes every level to **stderr** - stdout carries the payload and nothing else. `capabilities` declares `network`, `wasm`, `compose` and `capture`; a tool whose manifest needs anything else is refused with exit 3 rather than rendered as a placeholder.

`applyBrandVars` is also exported from here, and `shells/tui` imports `createCliBridge` directly.

### Cross-submodule dependency on `shells/web`: closed

`src/bridge.ts` used to import four modules from the web shell by relative path, so **this shell could not be typechecked or run without `shells/web` checked out**, even though they are separate git repositories. That is done with, as of plans/202 WP1.1. No file under `shells/cli`, `shells/tui` or `packages/node-shell` imports from `shells/web` any more.

`net.ts` and `pptx.ts` went first. `pdf.ts` and `svg-ir.ts` followed the same way: the implementation moved to `packages/node-shell/src/`, which is where shared shell plumbing belongs, and the web file stayed as a re-export shim so every web import site is unchanged. `pdf.ts` needed nothing else - analyze and strip are pure pdf-lib, and the compress pass already feature-detected a canvas and skipped the image re-encode when there was none. `pdf-structure.ts` went with it, because `pdf.ts` reaches it by a lazy sibling import. `text-svg.ts` went too: `svg-ir.ts` reads three of its parsers, and every one is a pure string parse.

`svg-ir.ts` was the only one that had to change shape. It reached `font-registry.ts` directly, and the registry reads IndexedDB and `document.fonts`. The font resolver is now injected as `ctx.resolveFont`: the web shim hands over `resolveVectorFont`, and this shell passes nothing, because it outlines its `<text>` upstream in `src/svg-outline.ts` through `host.text`'s own headless registry. No resolver means no outlining, which is what `canVectoriseText` already reported and what the web registry already did under jsdom.

A partial submodule checkout that omits `shells/web` now leaves this shell intact. The pieces it needs are in `packages/node-shell`, which lives in the parent repo.

There is a second, looser dependency on the web shell, this time on its *build output*. The raster tier in `src/raster.ts` has two levels. Tier A rasterises an SVG-native tool's PNG with resvg, a few-megabyte Rust module, and needs nothing else. Tier B covers everything else, meaning HTML-layout raster, JPEG, WebP, PDF and video, by driving the **built** web shell in a scoped Chromium so the bytes match a web or desktop download exactly. `packages/node-shell/src/webshell-render.ts` serves `shells/web/dist` from an ephemeral localhost server and errors clearly when there is no `index.html` there, so Tier B needs `pnpm run build:web` to have run. `--durable=1` additionally needs the TrustMark encoder model inside that dist.

Everything else in the bridge comes from `@lolly/engine` and `@lolly-tools/node-shell`, the latter holding the pieces this shell shares with the TUI: `repo-root`, `raster`, `webshell-render`, `browsers`, `text` (HarfBuzz in Node), `audio`, `url-capture`, `c2pa-opts`, `render-integrity`, plus `net`, `pptx`, `pdf`, `pdf-structure`, `text-svg` and `svg-ir`, which the web shell shares too. Note that `bridge.ts` imports node-shell modules by **relative path** rather than by the `@lolly-tools/node-shell/*` specifier: this file is inlined into the Vercel MCP function by `scripts/build-mcp-fn.ts`, whose esbuild config treats bare package specifiers as external, so a package-specifier import would dangle in that bundle. The TUI, which is never bundled, uses the specifier form.

## Run it

From the umbrella root, no build step:

```bash
pnpm run cli                                              # list available tools
pnpm run cli qr-code                                   # show a tool's inputs
pnpm run cli qr-code --url=https://suse.com --output=./qr.svg
pnpm run cli qr-code --url=https://suse.com --export=png > qr.png
pnpm run smoke                                            # render every catalogue tool at defaults
```

`pnpm run cli` is `node shells/cli/bin/lolly.ts`. The `--` matters, otherwise npm eats the flags.

It reads the **active content profile's** views at the repo root, so `pnpm run profile` tells you which tools it can see. `lolly --help` prints the full flag set and the exit-code taxonomy (0 OK, 1 FAILED, 2 USAGE, 3 UNAVAILABLE_HERE, 4 REFUSED, 5 NOT_FOUND, 6 AUTH, 70 INTERNAL).

## Build it

There is nothing to build. Node runs the TypeScript directly. Typechecking is `tsc -p shells/cli`, part of the umbrella's `pnpm run typecheck`, and it compiles the two web-shell files listed above alongside this shell's own.

## Surprising things

- **`--profile` is the CMYK press condition, matching URL mode's reserved `profile` param.** The user-profile JSON file is `--user-profile`. The two used to share the word `--profile`, which is exactly the collision the GA contract (plans/73-cli-ga-contract.md B1) removed: a flag name that does not equal its URL param name makes "the CLI is URL mode under a different transport" untrue.
- **State persists only when a state directory is named.** By default every invocation starts with an empty in-memory store and nothing is written to disk (a render must not leave files in `$HOME` nobody asked for). Set `$LOLLY_STATE_DIR` (or the deprecated `$LOLLY_TUI_DIR`) to a directory and `host.state` also writes through to `<dir>/state/<slot>.json`, so a saved session survives the next invocation - see `packages/node-shell/src/state-dir.ts` for the precedence rule and `bridge.ts` around line 636 for the read/write path.
- **A format that cannot be produced here is an error, not a different file.** Asking for a format this shell cannot make fails with a non-zero exit and writes nothing at the requested path. It used to write HTML under a renamed output and exit 0, which meant a pipeline asking for PDF could receive HTML and never know. `--html-fallback` opts back into the HTML artifact, under a `.html` name and with a warning saying so.
- **The output is sniffed against the requested format before it is written.** Headless Chromium has no AV1 encoder, so `--export=avif` used to receive PNG bytes and write them under the `.avif` name. Bytes that are demonstrably a different container are now refused.
- **`--bleed` and `--marks` only apply to `pdf`, `pdf-cmyk` and `cmyk-tiff`.** Those are the three renderers wired to the engine's print geometry. Any other format refuses the flags rather than accepting them and producing a file identical to one exported without them.
- **A `zx=` link needs `--link-password`.** A missing or wrong password is an error. It never falls back to rendering the tool at its defaults, which would be a different document under the right filename.
- **Signing can be an identity, not just an anonymous key.** `--sign-key=<key.pem> --sign-cert=<chain.pem>` (or the `$LOLLY_SIGN_*` environment) makes the Content Credential carry a real x5chain, so a verifier pinning that root reports a verified identity instead of an unidentified signer. Both flags take PATHS, and no flag anywhere takes key material or a passphrase - argv is visible in `ps` to every user on the machine. The loading + validation lives in `packages/node-shell/src/signing-identity.ts`, and every misconfiguration (key/certificate mismatch, expired certificate, chain out of order, wrong curve) is a refusal BEFORE the render, because the alternative is a well-formed file nobody can verify. See `docs/cli-signing.md`.
- **`lolly validate` is a real verifier, not a stub.** It runs the same engine Content Credentials modules as the web `/verify` view, accepts `--trust-anchor`, and with `--deep` also does a neural pixel-watermark scan, which is Tier B and so needs the browser and the built web shell.
- **A tool ID can never be `validate`, `install-browser`, `assets`, `batch` or `smoke`.** Those five are reserved subcommands, matched before the argv is treated as a tool ID.
- Tier B's Chromium is downloaded on request by `lolly install-browser` into a scope this shell owns. It is not your system Chrome and it is not fetched implicitly on first render.

## Submodule caveat

This shell runs **inside the umbrella repo** and nowhere else. It resolves `@lolly/engine` and `@lolly-tools/node-shell` through npm workspaces declared in the umbrella's `package.json`, it reads the repo-root `catalog/` and `tools/` profile views, and as described above it imports four files out of `shells/web`.

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
# or, in an existing clone, BEFORE pnpm install:
git submodule update --init --recursive
```

Commit changes to files in this directory in the `lolly-cli` repo, then commit the moved pointer in the umbrella. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) section 4.
