# lolly-web

The Vite PWA, and the reference implementation of the v1 capability bridge. Every other shell is measured against this one: the Tauri desktop and mobile shells literally *are* this code with a few modules substituted at build time, and the CLI reuses four of its bridge files directly.

Lives at `shells/web/` in the [`lolly`](https://github.com/lolly-tools/lolly) repository. It only builds from inside that checkout - see the [note](#builds-inside-the-repository-it-lives-in) at the bottom before you try anything standalone. Before 2026-09-11 this was its own repository, `lolly-web`, mounted as a git submodule; its history came across intact with `git subtree add` and is archived at the old URL with a redirect notice.

## Entry point

`index.html` → `<script type="module" src="/src/main.js">` → **`src/main.ts`**.

The `.js` specifier for a `.ts` file is deliberate, and it is the reason the Tauri shells carry a `jsToTsFallback` Vite plugin. This shell pins `vite@^8`, which resolves the sibling `.ts` implicitly; the Tauri shells pin `vite@^5`, which does not.

`index.html` is not a stub. It carries three things worth knowing about before you edit it:

- An inline pre-paint script that reads `theme`, `brand-fonts`, `brand-radius` and `lang` from `localStorage` and stamps `data-theme`, the brand font custom properties, `<html lang>` and `dir` before the first frame. This is the **only** sanctioned use of `localStorage` in the shell. Tool and session state always goes through `host.state`, which is IndexedDB here. The language alias and `htmlLang` maps in that script are hand-inlined mirrors of `engine/src/lang.ts`, because an inline script cannot import anything.
- A full `<noscript>` welcome page, styled by a block that only means anything when scripting is off.
- The JSON-LD and Open Graph metadata for the landing page. Per-tool and per-view OG cards are generated instead, by `scripts/build-tool-og.ts` and `scripts/build-view-og.ts`.

`src/main.ts` is 992 lines and does four things in order: construct the bridge, sync the tool and asset catalogues, route, then hand a mounted node to the engine runtime.

## The capability bridge

`src/bridge/index.ts` composes `HostV1` from per-capability factory modules that each live in their own file. Eight are wired eagerly, because something on the boot path reads them synchronously or they are cheap:

`state.ts` (IndexedDB), `profile.ts`, `previews.ts`, `assets.ts`, `tokens.ts`, `clipboard.ts`, `media.ts` (live camera frames) and `recorder.ts`.

Eleven more are wired as **lazy facades**: the field on `host` is a small object whose every method does `(await load()).method(...)`, where `load` is a one-shot memoised `import()`. Those eleven are `identity`, `export`, `compose`, `net`, `text`, `pdf`, `pptx`, `capture`, `viz`, `images` and `audio`. `host.assets.pick` follows the same shape and lazily pulls `views/picker.ts`.

This is not a style preference, it is a tested budget. `scripts/check-bundle-budget.ts` re-derives the boot payload from the built `dist/index.html` (the entry script plus every `modulepreload`), asserts that no chunk matching `/(engine-render|engine-c2pa|handlebars|ajv|html2canvas)-/` appears on it, and caps the total gzipped boot JS at `MAX_PRELOAD_JS_GZ = 135 * 1024`. Run it with `pnpm run check:bundle` after a production build exists. A single careless top-level `import { createRuntime }` in a boot-path module drags Handlebars and Ajv back in, and nothing else would fail. The same reasoning is why `bridge/index.ts` imports deep engine paths rather than the `@lolly/engine` barrel: that barrel is one shared facade whose retained export set is the union over every importer.

Two contractually **synchronous** APIs cannot be lazy facades, so they get their own mechanism. `host.color` (v1.40) and `host.geom` (v1.64) are pure engine maths, and nothing in this shell reads either one, only tool hooks do. `installToolApis(host)` attaches them, and the single enforced chokepoint that awaits it is `createToolRuntime` in `src/lib/mount-runtime.ts`. Failure there is non-fatal by design, because both APIs are optional in the contract and tools feature-detect them.

`capabilities` comes from `src/bridge/capabilities-provided.ts`, plus `'capture'` when the Chrome extension's `window.__lollyCapture` flag is present. `identity` and `previews` are web-only host-UI helpers hung off the same object and are **not** part of the tool-facing v1 contract.

## Routing

There is no router library. `src/main.ts` parses the hash, then a single `switch (route.name)` dispatches to a view module via `await import('./views/<x>.ts')`:

| Route | Module |
|---|---|
| `tool` | `views/tool.ts` |
| `profile` | `views/profile.ts` |
| `dashboard` | `views/dashboard.ts` |
| `verify` (aliases `/valid`, `/v`) | `views/valid.ts` |
| `multi` | `views/multi-edit.ts` |
| `pro` | `pro/index.ts` |
| `projects` | `views/projects.ts` |
| `catalog` | `views/catalog.ts` |
| `start` | `views/start.ts` |
| `lab` | `views/color-lab.ts` |
| `pdf` | `views/pdf-extract.ts` |
| `components` | `views/components.ts` |
| `utilities`, `gallery`, default | `views/gallery.ts`, the only statically imported view |

The switch is wrapped in a `try`, and a mount failure in production that looks like a stale-chunk error triggers `recoverFromStaleShell()` rather than leaving a blank view. [`src/README.md`](src/README.md) explains how to get from a route name to the code that implements a feature.

## Run it

From the repo root:

```bash
pnpm run dev:web     # this is the one you want
```

`scripts/dev-web.ts` runs three things: `docs/build.ts --watch` so the `/info` site rebuilds on docs changes, the Vite dev server and a background previews pass against the live server that fills in any missing tool preview cards. It reads Vite's chosen port from its output rather than assuming 5173.

`pnpm run dev` *inside this directory* is plain `vite`. It works, but it does not build `/info` and it does not generate previews, so the gallery cards and the docs links will look wrong.

## Build it

```bash
pnpm run build:web   # from the repo root
```

That is `build:ort`, then `build:info`, then the per-tool and per-view OG card generators, then `vite build` in this workspace. Running `vite build` here on its own skips the first four.

Typechecking is `tsc -p shells/web` plus `tsc -p shells/web/tsconfig.tests.json`, both part of the repo's `pnpm run typecheck`. The main project excludes `src/**/*.test.ts`, which is why the tests need their own config.

## Surprising things

- **Styles are plain CSS with cascade layers, and the layer order is declared exactly once.** `src/styles/app.css` opens with `@layer vendor, base, primitives, chrome, views, overrides, a11y;`. A sheet's weight comes from its layer, not from when it loaded, so a lazily injected view chunk cannot outrank `overrides` or `a11y`. `fonts.css` and `tokens.css` stay unlayered on purpose, because unlayered declarations outrank every layer and that is exactly what design tokens want. Vendor CSS must be imported into `layer(vendor)`.
- **The service worker is hand-written**, `public/sw.js`, with four strategies chosen per request: network-first for navigations with a cached-shell fallback, cache-first for content-hashed build assets and bundled fonts, network-first with a timeout race for `/tools/` files plus a separate bucket holding tools the user pinned for offline use, then stale-while-revalidate for `/catalog/previews/`. There is no Workbox.
- **`/tools/` and `/catalog/` are served from outside this directory.** A dev-server middleware in `vite.config.js` maps those URL prefixes through `packages/node-shell/src/content-roots.ts` (`toolFile()`, `catalogFile()`) to the active profile's pack files, and the production build's `closeBundle` step calls `materializeInto()` to write a real `tools/` + `catalog/` tree into `dist/`.
- **`src/org/` is dormant on a plain deployment.** It probes an optional control plane once, tolerantly and time-boxed, and a build without the module behaves identically. Do not assume there is a server.
- **`src/catalog/integrity.ts` is inert unless the build pins `VITE_CATALOG_PUBLIC_KEY_JWK`**, and when a key is pinned it fails closed.
- `html2canvas-stub.js` at the root of this directory exists to keep a transitive dependency out of the bundle. It is not a rendering path.
- **Routing, redirects and `Cache-Control` are not configured here.** They live in this repo's root `vercel.json`; the Vercel project deploys from the repo root, so a `vercel.json` in this directory is read by nothing (one used to sit here and had silently diverged).

## Builds inside the repository it lives in

This shell builds **inside the `lolly` repository** and nowhere else. It resolves `@lolly/engine` through npm workspaces declared in the root `package.json`, it imports `../../../../engine/src/…` by relative path, and at build time it resolves tool and catalogue content through `packages/node-shell/src/content-roots.ts`. A copy of just this directory has none of that.

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
pnpm install
```

Commit changes to files in this directory directly, as part of the normal repo. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) section 3.
