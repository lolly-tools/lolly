# YunoHost 1.0.9~ynh3: early 1.1.0 review build

This package makes the current web app available for YunoHost review ahead of the planned Lolly 1.1.0 release on Friday, 2 October 2026. The main 1.1.0 release is not published by this package update.

The web app was built from [0ec791ff3](https://github.com/lolly-tools/lolly/commit/0ec791ff368ebed2b79f6f6e01e8e0ce6892ff0b). It includes the design-system removal explanation and catalogue provenance from #113, the earlier active-logo fix from #112, the typography focus correction and the new Why tenet. It also includes the other changes described in the [1.1.0 draft notes](https://github.com/lolly-tools/lolly/blob/0ec791ff368ebed2b79f6f6e01e8e0ce6892ff0b/releases/1.1.0-draft.md). Rebrand and some newer controls still use English where translations are pending.

## Upgrade

```sh
sudo yunohost app upgrade lolly -u https://github.com/lolly-tools/lolly_ynh
```

The package keeps the existing additional storage-origin setting and replaces the static web files. Its nginx routes now match the Assets page and the app's `/_app/` build directory. Reload Lolly in the browser after upgrading.

## Build

- Package version: `1.0.9~ynh3`.
- Public starter brand, signed catalogue, models fetched from `lolli.li`, English documentation bundled.
- [Web archive](https://lolli.li/lolly-web-1.0.9-ynh3.tar.gz).
- SHA-256: `03725757110b0108236b07fcecb25f142764bf6f155d7d55be734ea71b15585c`.
- The previous `lolly-web-1.0.9.tar.gz` remains unchanged. This review build has a separate archive URL.

The extracted archive's catalogue and all 2,140 signed files covering 67 tools were verified. Package and storage-configuration tests pass. The packaged app was checked in Chrome, including catalogue provenance and the text-editor regression journeys. Installation on the reviewer's YunoHost server remains the next environment check.
