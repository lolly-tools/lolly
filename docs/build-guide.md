# Build Guide

This page is for a developer who wants to build one of Lolly's apps from source. Pick the app below; each guide lists the toolchain it needs, the commands and what the build produces. To host what you build, read [Choose a deployment](/info/deployment.html).

## Choose a guide

| You want to build | Guide |
| --- | --- |
| A working checkout to build from | [Get the source](/info/contributing-setup.html) |
| The command-line and terminal apps, or a packaged CLI | [Build the CLI and TUI](/info/build-terminal.html) |
| The desktop app for macOS, Windows or Linux | [Build the desktop app](/info/build-desktop.html) |
| The Android app | [Build the mobile apps](/info/build-mobile.html) |
| The iPhone and iPad app | [Building for iOS](/info/ios-build.html) |
| RPM, deb, Flatpak or Arch packages | [Linux packages](/info/build-obs.html) |
| The web container image and the Helm chart | [Run on Kubernetes](/info/build-kubernetes.html) |

## What every build needs

Every build starts from a checkout with its dependencies installed: <!--l:node-->Node.js 22.18 or later (or 24 or later), pnpm and git. [Get the source](/info/contributing-setup.html) covers the clone, the setup script and the content profile. Each app guide then adds its own toolchain, such as Rust for the desktop and mobile apps.

The web app needs a browser with WebGPU from startup. Check [Supported environments](/info/supported-environments.html) before you ship a build to people. A development build is for testing and does not qualify a release.

## Build the web app

```bash
pnpm run build:web    # output: shells/web/dist/
```

`build:web` is a chain, so a plain `vite build` inside `shells/web` is not enough on its own. In order, it:

1. copies the ONNX runtime's WebAssembly and loader files into `shells/web/public/ort/` (`build:ort`; the files are gitignored and regenerated each build);
2. builds the `/info` docs site (`build:info`);
3. renders the share images for every tool and every view;
4. bundles the web app with Vite.

Set `LOLLY_PROFILE` on the build to choose the brand it carries. [Choose a deployment](/info/deployment.html#host-the-web-app) covers what to serve and how.

## One source, three apps

The desktop and mobile apps are the web app's own code in a native window. Both Tauri shells build `shells/web/src/` with a Vite plugin (`overrideBridgeModules` in the shell's `vite.config.js`) that swaps a few bridge modules for Tauri versions at build time. The engine, the tools, the templates and the render path stay the same in all three.

::: figure build-guide-one-source
One source tree, three apps. Only the bridge modules that touch the device change.
:::

What the swap replaces:

- **Both Tauri shells:** storage (`state.ts`, files on disk instead of IndexedDB), file delivery (`export.ts`, which saves through the filesystem and keeps the web renderer) and the capability list (`capabilities-provided.ts`).
- **Desktop also:** page capture (`capture.ts`), plus native notifications, updates and zoom from the same `bridge-overrides/` folder.
- **Mobile also:** durable user assets (`assets.ts`).

A Tauri build writes its frontend to `shells/tauri-{desktop,mobile}/dist/`, which `tauri.conf.json` reads as `frontendDist`. The web app's own `dist/` is unaffected.

## If something fails

Run `pnpm run doctor`. It reads the checkout without changing it and prints the exact repair command for each problem it finds. [Get the source](/info/contributing-setup.html#if-something-fails) lists the common setup failures, such as a Node version too old for type stripping.
