# Flathub submission

The manifest here builds Lolly **entirely from source, offline**, which is what Flathub
requires. The manifest one directory up unpacks a prebuilt `.deb` instead - fine for the
bundles we hand out ourselves, but Flathub forbids prebuilt binaries, so the two cannot
be the same file.

Keep the two in agreement on **app id, runtime version, `command`, `finish-args`** and
the freedesktop metadata they install. Only the build strategy should differ.

## Files

| File | Role |
|---|---|
| `tools.lolly.Desktop.yml` | The manifest. Filename must equal the app id. |
| `cargo-sources.json` | **Generated.** ~600 crates. |
| `node-sources.json` | **Generated.** Both pnpm lockfiles, one offline store. |

## Regenerating the sources

Needed whenever `Cargo.lock` or either `pnpm-lock.yaml` changes.

```bash
pip install tomlkit aiohttp 'PyYAML>=6.0.2'
git clone https://github.com/flatpak/flatpak-builder-tools

# cargo
python3 flatpak-builder-tools/cargo/flatpak-cargo-generator.py \
  shells/tauri-desktop/src-tauri/Cargo.lock -o cargo-sources.json

# pnpm - generate BOTH locks together so they share one v11 store manifest.
# Run from the umbrella root. The temporary directory excludes unrelated locks.
pip install ./flatpak-builder-tools/node
lolly_flatpak_locks=$(mktemp -d)
mkdir -p "$lolly_flatpak_locks/desktop"
cp pnpm-lock.yaml "$lolly_flatpak_locks/pnpm-lock.yaml"
cp shells/tauri-desktop/pnpm-lock.yaml "$lolly_flatpak_locks/desktop/pnpm-lock.yaml"
flatpak-node-generator pnpm "$lolly_flatpak_locks/pnpm-lock.yaml" --recursive \
  --pnpm-store-version v11 --no-xdg-layout --node-sdk-extension node24 \
  -o shells/tauri-desktop/flatpak/flathub/node-sources.json
```

Use flatpak-builder-tools commit `1fc32195e3e60fe5c97f0af646dec7a99df5962b` or newer for pnpm 11 store support. The manifest stages the pinned pnpm archive as a verified source, and both installs read the generated store. When upgrading pnpm, update its archive digest and confirm the generator supports the new store version.

## Building and linting locally

```bash
flatpak install -y flathub org.flatpak.Builder
flatpak run org.flatpak.Builder --force-clean --install --user \
  build-dir tools.lolly.Desktop.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest tools.lolly.Desktop.yml
```

The build is heavy - ~700 npm packages, a Vite build, and ~600 crates including a
statically linked ONNX Runtime. Budget accordingly.

## The commit pin lags by one

`sources[0].commit` points at a commit of this repo. Because the manifest lives *in*
the repo it pins, the pin necessarily refers to the **previous** commit. That is fine:
the build never reads the manifest from the checkout, only the source. On Flathub the
manifest lives in the `flathub/tools.lolly.Desktop` repo instead, so the cycle
disappears entirely - but **the pin must be bumped to a pushed commit** before any
build, or you are testing stale source.

`brands/suse` is `update = none` in `.gitmodules`, so git skips that private pack and a
Flathub builder resolves to the public `lolly-start` profile. Do not "fix" this.

## Submitting

1. Fork [flathub/flathub](https://github.com/flathub/flathub), **unchecking** "Copy the
   master branch only".
2. `git clone --branch=new-pr git@github.com:<you>/flathub.git`
3. `git checkout -b lolly new-pr`
4. Copy `tools.lolly.Desktop.yml`, `cargo-sources.json` and `node-sources.json` in.
5. PR against **`new-pr`** (never `master`), titled `Add tools.lolly.Desktop`.
6. A reviewer will run `bot, build`. Push fixes to the same PR.
7. On merge you get a repo under the Flathub org and a write invite - **accept within a
   week, with 2FA enabled**. Publishes 1-2 hours after merge.

## Still outstanding

- **Screenshots.** The metainfo has none. Flathub expects at least one, and the store
  listing looks broken without them.
- **GNOME 50.** The linter suggests it (warning, not an error). Bump both manifests and
  the CI container tag together.
