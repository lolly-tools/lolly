# Lolly for YunoHost

[YunoHost](https://yunohost.org) package for the Lolly web app: on-brand images, PDFs, video, audio and documents, made on your own device from your own brand. See [`doc/DESCRIPTION.md`](doc/DESCRIPTION.md) for what it is and [`doc/ADMIN.md`](doc/ADMIN.md) for what the package does.

```bash
sudo yunohost app install https://github.com/lolly-tools/lolly_ynh
```

This directory is developed inside the [Lolly repository](https://github.com/lolly-tools/lolly) at `deploy/yunohost/`, beside the Docker and Helm recipes, and mirrored to `lolly-tools/lolly_ynh` at release time. Fix things here, not in the mirror.

## Shape

- **Static.** The package unpacks a prebuilt web build and serves it with nginx. No application service or database; YunoHost stores the package settings, and users' work stays on their devices.
- **Whole domain.** The build resolves assets, the offline service worker and clean routes from the domain root (`full_domain = true`).
- **Same default headers as lolly.tools.** `conf/security-headers.inc` renders the hosted deployment's policy by default. The configuration panel can add specific storage origins to `connect-src`; the saved setting survives upgrades. See [the admin guide](doc/ADMIN.md#allow-your-own-nextcloud-webdav-or-s3-server). The YunoHost tests in `tests/` check the default policy and configured additions.
- **Models from lolli.li.** The on-device ML models are fetched on first use from the project's release host, as the desktop app does, instead of adding 1.2 GB to the download.

The governed, multi-user product is a separate package, **Lolly Work**, which serves this same web build behind its control plane and YunoHost SSO.

## Cutting a release

The three release-pinned manifest fields (`version`, `sources.main.url`, `sources.main.sha256`) are written by a script, never by hand:

```bash
export LOLLY_PROFILE=lolly-start               # the tarball is public: never the suse pack
pnpm run release:yunohost --build           # release web build, pack, pin the manifest
# → ~/.cache/lolly-release/artifacts/lolly-web-<ver>.tar.gz
shells/tauri-desktop/release/lolli.py put ~/.cache/lolly-release/artifacts/lolly-web-<ver>.tar.gz
```

`--publish` runs that last upload for you when the `LOLLI_S3_*` keys are in the environment. The web build needs the catalog signing material every release build needs (`LOLLY_CATALOG_SIGNING_KEY`, `VITE_CATALOG_PUBLIC_KEY_JWK`); pass `--version x.y.z` to override the version read from the desktop shell, and `--ynh-rev N` for a repackaging of the same upstream version.

Then mirror this directory to the app repository and tag it:

```bash
git clone git@github.com:lolly-tools/lolly_ynh.git /tmp/lolly_ynh
rsync -a --delete --exclude .git deploy/yunohost/ /tmp/lolly_ynh/
cd /tmp/lolly_ynh && git add -A && git commit -m "Lolly <ver>~ynh1" && git tag v<ver>-ynh1 && git push --follow-tags
```

YunoHost's catalog CI (`package_check`) runs against that repository. It needs the tarball live on lolli.li first, since the manifest's checksum is verified at install.

## Layout

```
manifest.toml          package metadata, install questions, resources (packaging format 2)
config_panel.toml      persistent settings exposed in YunoHost's configuration panel
scripts/               install, upgrade, remove, backup, restore, change_url, config, _common.sh
conf/nginx.conf        the domain location file (root, cache tiers, SPA fallback)
conf/security-headers.inc  the header set every location includes
doc/                   DESCRIPTION, PRE_INSTALL and ADMIN pages shown in the YunoHost admin
tests.toml             package_check configuration
```
