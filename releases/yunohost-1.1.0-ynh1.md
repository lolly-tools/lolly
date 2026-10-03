# YunoHost 1.1.0~ynh1

This package brings Lolly 1.1.0 to YunoHost. It replaces the 1.0.9~ynh3 review build; the changes since 1.0.9 are described in the [1.1.0 notes](https://github.com/lolly-tools/lolly/blob/1967f1b6402c0e297f16c6b8f565f8cd1f2ac924/releases/1.1.0-draft.md).

The web app was built from [1967f1b64](https://github.com/lolly-tools/lolly/commit/1967f1b6402c0e297f16c6b8f565f8cd1f2ac924).

## Upgrade

```sh
sudo yunohost app upgrade lolly -u https://github.com/lolly-tools/lolly_ynh
```

The package keeps the existing additional storage-origin setting and replaces the static web files. Reload Lolly in the browser after upgrading.

## Build

- Package version: `1.1.0~ynh1`.
- Public starter brand, signed catalogue, models fetched from `lolli.li`, English documentation bundled.
- [Web archive](https://lolli.li/lolly-web-1.1.0-ynh1.tar.gz).
- SHA-256: `70213a1d372ae956509c1f01eacdf9542c6f892881b553bfd5511c7e7df382f8`.
- Earlier archives on `lolli.li` remain unchanged.

The archive was downloaded back from `lolli.li` and its checksum matches the manifest. It contains no symbolic links. Its catalogue and all 2,141 signed files covering 67 tools were verified against the catalogue key that lolly.tools uses. Package tests pass. Installation on a YunoHost server and YunoHost's `package_check` have not been run for this version.
