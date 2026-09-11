# AUR packaging: lolly-desktop-bin

Arch recipe for the official Lolly desktop binary. `PKGBUILD` repacks the
canonical `.deb` from lolli.li (a from-source Tauri build pulls ~500 crates -
not worth imposing on users when the official artifact exists); the deb's
`data.tar.gz` already contains every plans/174 integration file (mime XML,
thumbnailer, search-provider ini, D-Bus services, KDE service menu, icons),
so `package()` is a straight `bsdtar` extraction into `$pkgdir`.

## Publishing to AUR (first time)

**Blocked as of 2026-08-30: AUR has new-account activation turned off**, so a
fresh account cannot register an SSH key. Until it reopens (or an existing AUR
account is used), the hosted pacman repository below is the live Arch channel;
AUR remains the discoverability follow-up.

AUR uses per-package git repos over SSH; pushing to a non-existent repo
creates it and claims the name.

```bash
# once: register your SSH key at https://aur.archlinux.org (account settings)
git clone ssh://aur@aur.archlinux.org/lolly-desktop-bin.git
cp PKGBUILD .SRCINFO lolly-desktop-bin/
cd lolly-desktop-bin
git add PKGBUILD .SRCINFO
git commit -m "lolly-desktop-bin 1.0.1-1"
git push origin master        # AUR's default branch is master
```

AUR rejects a push whose .SRCINFO is missing or stale, so both files always
travel together.

## Hosted pacman repository (the live channel)

lolli.li is an S3-compatible bucket, and a pacman repo is nothing but static
files - so we host one directly. Built by `repo-add` from the same
makepkg-verified package, uploaded under `arch/x86_64/`:

```
https://lolli.li/arch/x86_64/lolly.db            <- repo index (overwritten per release)
https://lolli.li/arch/x86_64/lolly.files
https://lolli.li/arch/x86_64/lolly-desktop-bin-<ver>-<rel>-x86_64.pkg.tar.zst   <- never overwritten
```

Users add to `/etc/pacman.conf`:

```ini
[lolly]
SigLevel = Optional TrustAll
Server = https://lolli.li/arch/$arch
```

then `sudo pacman -Syu lolly-desktop-bin`. The `SigLevel` line is required
while the repo is unsigned (pacman's default demands package signatures);
signing it - a GPG key, `repo-add --sign`, a published public key for
`pacman-key` - is the follow-up that removes it.

Per release: build the package in a clean Arch container from this PKGBUILD,
`repo-add lolly.db.tar.gz <pkg>`, upload the new `.pkg.tar.zst` plus the
refreshed `lolly.db`/`lolly.files` pairs (ship real copies under both the
symlink names and the `.tar.gz` names - buckets don't do symlinks).

## Installing (users)

```bash
paru -S lolly-desktop-bin     # or: yay -S lolly-desktop-bin
# or by hand:
git clone https://aur.archlinux.org/lolly-desktop-bin.git && cd lolly-desktop-bin && makepkg -si
```

## Update ritual (each release)

1. Bump `pkgver` in `PKGBUILD` (the source URL interpolates it); reset
   `pkgrel=1` (bump `pkgrel` only for packaging-only changes within a release).
2. Update `sha256sums` for the new deb: `sha256sum lolly-desktop-<ver>_amd64.deb`
   (or `updpkgsums` on Arch).
3. Regenerate `.SRCINFO`. On Arch: `makepkg --printsrcinfo > .SRCINFO`.
   Editing it by hand (as this first version was) works too, but every expanded
   value must match the PKGBUILD exactly - the contract test checks that.
4. Copy both files into the AUR clone, commit (`lolly-desktop-bin <ver>-1`),
   push.
5. Mirror any change back into this directory - this repo stays the source of
   truth, the AUR clone is a publish target.

Verified 2026-08-30: makepkg built 1.0.1-1 in a clean Arch container against the live lolli.li deb (sha256 pass, 27 integration files in the package, namcap warnings benign). The recipe is AUR-publishable.
