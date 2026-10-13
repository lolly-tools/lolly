Lolly 1.1.0 for the web includes the Design hierarchy and interactive presentation improvements, responsive editor fixes, signed asset delivery and provider references, clearer export errors, and updated shared UI styling.

This release is built from `0359d8106bccbd1da56b5552605199f0bf705472` on `main`, with engine **1.259.0** and tool-author core **1.2.0**. Those packages retain their independent version numbers.

The neutral web archive pairs with the published [Lolly Work 1.1.0 release](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.0). It contains the signed tool catalog and uses `https://lolli.li` for model downloads. Private deployments should follow the Work installation guide and configure their own identity, storage and trusted catalog settings.

Validation: source CI, signed web build, services/docs checks, complete archive verification and the published archive checksum. Deployment acceptance is tracked separately for each instance.

This is a **web-only release**. Windows, Linux, Android and physical iOS qualification remains open; no native application packages are published by this tag. The existing native release draft remains held. The YunoHost `1.1.0~ynh3` package passed fresh-install, reinstall, multi-instance, backup/restore, same-version upgrade, URL-change and lint checks on amd64 Debian Bookworm with YunoHost 12.1.41.2. It remains beta: upgrades from 0.2 and ARM64 runtime are not yet qualified. See the [YunoHost installation guide](https://github.com/lolly-tools/lolly-work/tree/main/deploy/yunohost) for the tested revision.

Download the [signed neutral web archive](https://lolli.li/lolly-web-1.1.0-ynh3.tar.gz). Its SHA-256 is `8bc8121a68e6fee6dda3902ed48d5e2669353bcfd101ca3822990235a2099376`; checksum and exact source metadata are attached. The `ynh3` filename identifies the packaging revision; the qualification scope is described above.
