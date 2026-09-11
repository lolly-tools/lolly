# lolly-tui

An interactive terminal shell built on Ink and React. Four top-level sections switched with `1`/`2`/`3`/`4` (Tools, Projects, Profile, Catalog), plus a tool view opened from the gallery, from a saved project or from a pasted lolly.tools URL.

The one-line summary is in the header of `src/bridge.ts`: **the TUI is the CLI bridge under an interactive transport.** Same Node plus jsdom render path, same filesystem assets, same engine.

Lives at `shells/tui/` in the [`lolly`](https://github.com/lolly-tools/lolly) repository. See the [note](#builds-inside-the-repository-it-lives-in) at the bottom. Before 2026-09-11 this was its own repository, `lolly-tui`, mounted as a git submodule; its history came across intact and is archived at the old URL with a redirect notice.

## Entry point

**`src/main.tsx`**, launched by `pnpm run tui` (`tsx src/main.tsx`). `bin/lolly-tui.tsx` is a thin launcher for the `lolly-tui` bin that re-execs through the `tsx` loader with a `#!/usr/bin/env -S node --import tsx` shebang, then imports `src/main.tsx`.

`main.tsx` builds the bridge and loads the catalogue in parallel, refuses to start without a real TTY, switches the terminal to its alternate screen buffer so the app owns the whole screen and the scrollback stays clean, renders `<App>` with Ink and restores the main buffer on any exit path including a crash or a signal. On the way out it also tears down the lazily created Chromium and web-shell singletons, which no-op when the session never rendered a raster.

`src/App.tsx` is the router: a small `Route` union and a `useState`, no library. Each view under `src/views/` owns its own key handling.

## The bridge: a thin wrapper over the CLI's

`src/bridge.ts` is under 100 lines because it **reuses `createCliBridge` verbatim**:

```ts
import { createCliBridge } from '../../cli/src/bridge.ts';
```

It creates the jsdom document itself, exposes `window`, `document` and `Element` as globals for the engine's hydrate and export path (Ink's reconciler is terminal-only and never reads them), then overrides exactly three fields on the returned host:

- **`log`**: the CLI writes to stdout and stderr, which would corrupt Ink's managed screen. The TUI redirects it into a capped in-memory ring of 200 lines that the UI can surface instead. Nothing in this shell may write to stdout directly; that surface belongs to Ink.
- **`profile`**: the CLI captures a profile once at boot. The TUI reads the persisted profile live on every `get()`, so `bindToProfile` inputs pre-fill correctly and an edit in the Profile view takes effect on the next tool mount.
- **`clipboard`**: the CLI stubs it out, because a headless render has nowhere to paste. An interactive terminal does, so `writeText` is backed by the OS clipboard tool (`pbcopy`, `wl-copy` or `xclip`). `writeImage` still throws.

Everything else is inherited, `host.capture` included: it is real in the shared CLI bridge now, backed by the same scoped Chromium, so the TUI gets it without an override. The CLI bridge's [dependency on `shells/web`](../cli/README.md#cross-directory-dependency-on-shellsweb-closed) is closed - it no longer imports any file from it - so this shell needs nothing beyond `shells/cli` and `packages/node-shell`. It still shares the web shell's *build output* for Tier B rasterisation, the same way the CLI does.

`src/engine-render.ts` is the engine glue: `mountTool` creates the runtime, `renderSvg` turns current state into an SVG string for the terminal preview, and `exportToFile` writes a real file through the Node bridge. It shares the format split, the resvg fast path and the export Content Credentials payload with the CLI through `@lolly-tools/node-shell`, so the two cannot drift.

## Run it

From the repo root:

```bash
pnpm run tui
```

That is `pnpm --filter ./shells/tui run start`, which is `tsx src/main.tsx`. It needs an interactive terminal and exits with a clear message when stdout is not a TTY, so it will not work inside a pipe or a CI log.

## Build it

Nothing to build, but note that unlike every other TypeScript project here this one is run through **`tsx`** rather than Node's native type-stripping, because the sources are `.tsx` and Node does not strip JSX. Typechecking is `tsc -p shells/tui`, part of the repo's `pnpm run typecheck`.

## Surprising things

- **The inline image preview emits no ANSI escapes.** `src/terminal-image.ts` rasterises the tool's SVG with resvg, then returns a grid of half-block cells, each a glyph plus foreground and background hex colours that **Ink** applies through its own `<Text>` props. Injecting raw SGR sequences into a screen Ink owns produces visible garbage. The preview is opt-in, on `p`, because the form matters more.
- **This shell persists state, unlike the CLI.** `src/store.ts` keeps saved sessions as plain JSON in the directory all three local shells share - `$LOLLY_STATE_DIR`, else the desktop app's data directory when the app is installed here, else `~/.lolly` - in the desktop app's own `saved-state/<slot>.json` record, so a project saved in the app is in Projects here. The profile and project folders stay terminal-only files beside them. No database, no network.
- **It renders raster, PDF and video by driving the built web shell**, exactly as the CLI does, through `@lolly-tools/node-shell/webshell-render`. So those formats need `pnpm run build:web` to have run, and the Chromium download from `lolly install-browser`.
- The alternate-screen dance means a crash that escapes the handlers can leave your terminal in the alternate buffer. `reset` fixes it.

## Builds inside the repository it lives in

This shell runs **inside the `lolly` repository** and nowhere else. It resolves `@lolly/engine` and `@lolly-tools/node-shell` through npm workspaces declared in the root `package.json`, it reads tool and catalogue content through `packages/node-shell/src/content-roots.ts`, and it imports the CLI bridge from `shells/cli`, which in turn shares the web shell's build output for raster rendering.

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
pnpm install
```

Commit changes to files in this directory directly, as part of the normal repo. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) section 3.
