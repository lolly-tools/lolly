# Finishing 1.0.5 on the Mac

Linux is **done and published** - `.deb` (amd64 + arm64), `.rpm` (Tumbleweed +
Leap 16), `.flatpak` and the Arch pacman channel are all live on lolli.li and
listed in `SHA256SUMS.txt`. What is left is Apple.

| Track | State | Where it must be built |
|---|---|---|
| macOS `.dmg` | `Lolly_1.0.5_aarch64.dmg` is up; `lolly-latest.dmg` points at it. Rebuild replaces both. | **This Mac** |
| iOS `.ipa` | Not published - `lolly-latest.ipa` is still 1.0.1 | **CI only** - see below |

## The one rule: do not build the iOS binary locally

Apple rejects App Store binaries built on a **beta macOS** with ITMS-90111
("Unsupported SDK or Xcode version"), stamped via `BuildMachineOSBuild`,
regardless of the Xcode version. This Mac runs a beta macOS, so a local
`tauri ios build` can never be submitted no matter how it is signed.

Use the workflow, which runs on a released (GM) runner:

```bash
gh workflow run ios-release.yml -R lolly-tools/lolly -f upload=true
gh run watch -R lolly-tools/lolly
```

All five secrets it needs (`IOS_DIST_CERT_P12`, `IOS_DIST_CERT_PASSWORD`,
`ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID`) are already set on the repo.

`shells/tauri-mobile/src-tauri/tauri.conf.json` is already `1.0.5`, which is
what drives `CFBundleVersion`. Note `shells/tauri-mobile/package.json` still
reads `1.0.1` - it does not affect the build, but it is worth correcting.
Each App Store upload needs a **higher** `CFBundleVersion` than the last, so if
1.0.5 was already accepted, bump before re-running.

The `.dmg` is unaffected by all of this: it is direct distribution, not App
Store, so beta macOS is fine.

## Building the .dmg

```bash
git pull && git submodule update --init --recursive   # BEFORE npm install
npm install
npm run profile:start          # public brand. NEVER ship the `suse` profile.
npm --prefix shells/tauri-desktop install

cd shells/tauri-desktop
LOLLY_EMBED_CATALOG=profile npm run build            # build + bundle
```

`LOLLY_EMBED_CATALOG` must be set for the **whole** command. `tauri build`
re-runs `beforeBuildCommand` itself, so setting it on only an explicit
`build:frontend` call is silently undone - Tauri rebuilds `dist/` in the default
`neutral` mode and the tool previews vanish from the gallery.

Signing + notarisation credentials are in `~/Build/lolly-private/`
(`lolly-mac-app-password` for `notarytool`, `asc-credentials.txt`,
`AuthKey_6WNY433QKD.p8`). Tauri picks up `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` from the environment.

Then staple and confirm, so a first-run Gatekeeper prompt is not the way you
find out:

```bash
xcrun stapler staple "src-tauri/target/release/bundle/dmg/Lolly_1.0.5_aarch64.dmg"
spctl -a -vvv -t install "src-tauri/target/release/bundle/macos/Lolly.app"
```

## Before you call the .dmg good

The Linux equivalents of these checks each caught a real shipped defect:

1. **Binary size.** `src-tauri/target/release/lolly-desktop` must be ~200 MB,
   not ~43 MB. A build that lost `--features tauri/custom-protocol` compiles,
   links, installs and launches - it just cannot load its own UI, and shows
   "Could not connect to localhost". Size is the only reliable signal.
2. **Open it and look at it.** Not "the process is alive". Two Flatpaks shipped
   that passed every automated check and died the moment they launched.
3. `dist/info/*.html` non-empty (in-app `#/docs` routes 404 without it) and
   `dist/precache.json` present (otherwise the offline model list reads
   "Not offered by this server").

## Publishing

Use the tooling now committed at `shells/tauri-desktop/release/`:

```bash
export LOLLI_S3_ACCESS_KEY=... LOLLI_S3_SECRET_KEY=...
R=shells/tauri-desktop/release

$R/lolli.py put Lolly_1.0.5_aarch64.dmg
$R/lolli.py alias lolly-latest.dmg Lolly_1.0.5_aarch64.dmg

# once the ipa is downloaded from the workflow run:
$R/lolli.py put Lolly-1.0.5.ipa
$R/lolli.py alias lolly-latest.ipa Lolly-1.0.5.ipa

$R/lolli.py sums --write        # ALWAYS last
```

`sums` re-hashes **every** object by streaming it back out of the bucket, so it
cannot claim a checksum the bucket does not actually serve. Run it after the
final upload, not before - the Linux checksums currently published were correct
at the time and will go stale the moment a new `.dmg` overwrites the old one.

Verify the way a user would:

```bash
curl -sO https://lolli.li/SHA256SUMS.txt
curl -sO https://lolli.li/lolly-latest.dmg
grep 'lolly-latest.dmg$' SHA256SUMS.txt | shasum -a 256 -c -
```

## Then

Update `RELEASE_NOTES.md` - it still describes 1.0.1 and says iOS "is pending
App Store review".
