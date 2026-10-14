# Cutting a Linux release

Everything here builds in **containers**. That is not a preference: a host
without the webkit2gtk/GTK `-dev` packages fails the link with
`rust-lld: unable to find library -lgtk-3` and fifteen more like it, which reads
like a code fault and is not one. Containers also keep the build off whatever
state the host has drifted into between releases.

Read [`../RELEASING.md`](../RELEASING.md) first - it explains *why* each check
below exists. Every one of them corresponds to something that has actually
shipped broken.

## The order

These commands run from the repository root. Publication is a separate step after verification. The Arch recipe downloads a versioned `.deb`; before publication, stage the exact built file in the makepkg source cache and set its checksum in the release recipe.

```bash
pnpm install
export LOLLY_PROFILE=lolly-start            # public brand - never ship `suse`
export LOLLY_EMBED_CATALOG=profile
# Supply LOLLY_CATALOG_SIGNING_KEY and VITE_CATALOG_PUBLIC_KEY_JWK privately.
pnpm -C shells/tauri-desktop install

shells/tauri-desktop/release/build-deb.sh                        # amd64 .deb
shells/tauri-desktop/release/build-flatpak.sh                    # bundle from that .deb
shells/tauri-desktop/release/verify-flatpak.sh                   # INSTALL IT AND LOOK AT IT

cd shells/tauri-desktop && rpm/make-sources.sh --skip-frontend && cd -
shells/tauri-desktop/release/build-rpm.sh tumbleweed
shells/tauri-desktop/release/build-rpm.sh leap16

export LOLLI_S3_ACCESS_KEY=... LOLLI_S3_SECRET_KEY=...
shells/tauri-desktop/release/lolli.py put out/lolly-desktop-<ver>_amd64.deb
# ...the rest of the artifacts, then:
shells/tauri-desktop/release/lolli.py alias lolly-latest.deb lolly-desktop-<ver>_amd64.deb

# only now, with the .deb live:
#   bump linux/arch/PKGBUILD pkgver + sha256sums
shells/tauri-desktop/release/build-arch.sh
shells/tauri-desktop/release/lolli.py put out/arch/x86_64/<pkg> arch/x86_64/<pkg>
shells/tauri-desktop/release/lolli.py sums --write
```

Artifacts land in `$LOLLY_RELEASE_OUT` (default `~/.cache/lolly-release/artifacts`).

## Builder image pins

The release Dockerfiles and Flatpak jobs select immutable manifest digests.
The current pins were checked against Docker Hub and GHCR on 2026-10-13:

| Builder | Image family | Available Linux platforms checked |
| --- | --- | --- |
| DEB | `ubuntu:24.04` | amd64, arm64 |
| Portable DEB | `node:22-bookworm` | amd64, arm64 |
| Tumbleweed RPM | `opensuse/tumbleweed:latest` | amd64, arm64 |
| Leap RPM | `opensuse/leap:16.0` | amd64, arm64 |
| Flatpak | `ghcr.io/flathub-infra/flatpak-github-actions:gnome-50` | amd64, arm64 |

The exact digests live in `containers/Dockerfile.*` and the Flatpak workflow
`container.image` fields. These are multi-platform manifest digests, so Docker
still selects the requested architecture. The Flatpak container must stay aligned
with runtime version 50 in the desktop manifest. Consult the
[Flathub image definitions](https://github.com/flathub-infra/actions-images)
when reviewing an update.

`build-rpm.sh` reads its Tumbleweed and Leap defaults from `Dockerfile.rpm`.
To use another reviewed base, set `LOLLY_RPM_BASE` to a repository reference
ending in `@sha256:` and a full 64-character lowercase digest.
`LOLLY_DEB_IMAGE` accepts an existing local `sha256:` image ID or an immutable
repository reference with `@sha256:`. A missing repository reference is pulled
by digest; a missing local image ID fails. For a custom portable builder, obtain
its local ID with `docker image inspect --format '{{.Id}}' <local-builder>`.
Mutable custom image names fail before Docker is invoked.

Default builder cache names include the recipe digest, and RPM cache names also
include the selected base. The scripts resolve the resulting local image ID
before running the build. Updating a pin requires checking the registry manifest
bytes, their SHA-256 digest and supported architectures, then running
`node --test tests/release-container-pins.test.ts` and qualifying the affected
package on its target platform. Package-manager repositories and downloaded
toolchains retain their existing update behavior; these pins cover the starting
container images.

## aarch64

There is no local path. Cross-compiling needs a full arm64 sysroot for
webkit2gtk and emulation takes hours, so the `.deb` comes from
`.github/workflows/linux-arm64.yml`, which fires on a `v*` tag and builds on
native runners. Collect it with `gh run download`, then publish it like the
others. **It is untested until someone launches it on real hardware** - "it
built" was equally true of the two Flatpaks that shipped dead.

## What each script refuses to do

They fail rather than produce a plausible-looking artifact:

- `build-deb.sh` — refuses on the `suse` profile (private brand pack); refuses
  if `dist/precache.json` or `dist/info/*.html` are missing; refuses a binary
  under 80 MB (a build that lost `--features tauri/custom-protocol` still
  compiles, links, installs and starts, and merely cannot load its own UI -
  size is the only signal); refuses a `.deb` whose `Depends` omits
  `libayatana-appindicator3-1`.
- `build-flatpak.sh` — refuses if `shared-modules` is unpopulated, and checks
  the ayatana stack is in the built tree before bundling.
- `verify-flatpak.sh` — launches it and fails under 150 MB resident. Every
  automated check passes on a bundle whose window never paints.
- `build-rpm.sh` — refuses an RPM that does not require
  `libayatana-appindicator3`, or that picked up a *shared* libonnxruntime.
- `build-arch.sh` — refuses if PKGBUILD's `pkgver` does not match the tree, and
  keeps the generated `.SRCINFO` (AUR rejects a stale one).

## Two traps worth naming

**`tauri build` re-runs `beforeBuildCommand` itself.** Setting
`LOLLY_EMBED_CATALOG=profile` on only an explicit `build:frontend` call is
silently undone - Tauri rebuilds `dist/` in the default `neutral` mode and drops
the tool previews. `build-deb.sh` builds the frontend on the host and then
empties `beforeBuildCommand`.

**Never `pkill -f lolly-desktop`.** It also matches
`rpmbuild ... lolly-desktop.spec` and will kill a running RPM build. Match the
app id `tools.lolly.Desktop` instead.

## Credentials

`lolli.py` reads `LOLLI_S3_ACCESS_KEY` / `LOLLI_S3_SECRET_KEY` from the
environment and nothing else. The UpCloud token that mints them is a `ucat_`
**API token** sent as `Authorization: Bearer` - HTTP Basic returns 401. The
`lolly-rel-key` IAM user is capped at **2 access keys** and a secret is returned
only at creation, so an existing key's secret cannot be recovered - free a slot
before minting. See the header of `lolli.py`.

`SHA256SUMS.txt` is regenerated by streaming every object back out of the
bucket, so it cannot drift from the bytes being served.
