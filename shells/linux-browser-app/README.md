# Lolly on Linux, in the installed browser (draft)

**Status: a first step. Nothing in this directory is built into a package, and nobody
has run the launcher on a Linux desktop yet.** The release gate, the supported
environments table and the RPM, deb and Flatpak builds are unchanged.

## Why

The web shell needs WebGPU to start. The Linux desktop app is Tauri on WebKitGTK, and
WebKitGTK has no WebGPU. Chrome, Chromium, Edge and Brave on the same desktop do. So
the Linux package becomes a small launcher: the launcher serves the built web app on
`127.0.0.1` and opens that address as an app window in the browser the person already
has (decided 2026-11-19).

## What exists

The launcher is a command of the terminal app, which already ships as one native
binary (`scripts/build-cli-sidecar.ts`):

```bash
lolly app [--dir=<built web app>] [--port=47474]
```

| Piece | Where |
|---|---|
| The command: order of events, messages, exit codes | `shells/cli/src/app.ts` |
| The local server: one fixed address, local only, GET and HEAD | `packages/node-shell/src/web-app-server.ts` |
| Routes and security headers, read from `vercel.json` | `packages/node-shell/src/web-app-routes.ts` |
| Browser discovery and the launch arguments | `packages/node-shell/src/installed-browser.ts` |
| A draft launcher entry | `tools.lolly.Desktop.desktop`, in this directory |

`lolly app --help` and the CLI reference (`docs/cli-reference.md`) describe the
behaviour: the fixed address, what happens when the port is taken, the browser order,
and what happens when no supported browser is installed.

## How a package would wire the launcher

None of this is built. The list is the plan a packaging change would follow.

1. Install the `lolly` binary and its payload (`dist/cli-sidecar/`).
2. Install the built web app as `web/` beside the binary. With no `--dir`, `lolly app`
   looks there first. The build is the web build, not the Tauri one: the web bridge
   stores projects in the browser (IndexedDB), so nothing native is needed.
3. Install `tools.lolly.Desktop.desktop` with `Exec=` set to the installed path, and
   the hicolor icons under the same name. The launcher starts the browser with
   `--class=tools.lolly.Desktop`, and `StartupWMClass` in the entry pairs the window
   with the icon.
4. Declare a Chromium-family browser as a weak dependency (`Recommends`), since any
   one of several works and the launcher says so when none is found.

The browser profile is separate from the person's everyday profile:
`$XDG_DATA_HOME/lolly/browser`, or `~/.local/share/lolly/browser`. Projects live in
that profile, under the origin `http://127.0.0.1:47474`. A different port is a
different origin with no projects, which is why the port never changes silently.

## Not yet

- A run on Linux hardware: discovery on a real `PATH`, the window class on X11 and on
  Wayland, the Flatpak browsers (a sandboxed browser may not be able to write the
  profile directory outside its sandbox), and the app with a real GPU.
- Any package: RPM, deb, Flatpak or AppImage.
- File associations, `lolly://` links and the desktop actions the Tauri entry has.
- The parts of the Tauri bridge that have no web equivalent.
- The WebGPU release gate and the supported environments table.
- Updating: what a running launcher and its open window do when a new package
  replaces `web/` underneath them.
