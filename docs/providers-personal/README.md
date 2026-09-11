# Personal send targets - deploy setup guides

Plans/129: the individual "send to my…" providers. Every send is
client → provider directly; a deploy's only job is to register the OAuth
apps whose client ids make each provider's UI appear (the dormant rule:
no id, no button). Credential providers (S3, Nextcloud/WebDAV) need no
registration at all - users bring their own endpoints.

One page per provider, the lolly-work plans/28 skeleton: what to register on
the platform side, the exact values, and how to verify.

| kind | guide | registration needed |
|---|---|---|
| `gdrive` | [google-drive.md](google-drive.md) | Google Cloud OAuth client (web) + a Desktop-type client for the Tauri apps |
| `dropbox` | [dropbox.md](dropbox.md) | Dropbox App Console app (app-folder) - one app covers web and desktop |
| `o365` | [onedrive.md](onedrive.md) | Microsoft Entra app: SPA platform (web) + a Mobile-and-desktop platform for the Tauri apps |
| `linkedin` | [linkedin.md](linkedin.md) | LinkedIn app (two self-serve products) - **desktop apps only**, and it needs a client secret |
| `s3` | [s3.md](s3.md) | none - user credentials |
| `webdav` | [nextcloud.md](nextcloud.md) | none - user app password |
| `mastodon` | [mastodon.md](mastodon.md) | none - per-server dynamic registration |
| `bluesky` | [bluesky.md](bluesky.md) | none - user app password |
| `discord` | [discord.md](discord.md) | none - channel webhook |

Client ids are public by design (public OAuth clients hold no secret) and are
set at build time in `shells/web/.env.local` (dev) or the deploy's env:
`VITE_GOOGLE_CLIENT_ID`, `VITE_DROPBOX_CLIENT_ID`, `VITE_MS_CLIENT_ID`. The
desktop frontend build adds `VITE_GOOGLE_DESKTOP_CLIENT_ID` +
`VITE_GOOGLE_DESKTOP_CLIENT_SECRET` (Google documents Desktop-app secrets as
non-confidential for installed apps), `VITE_MS_DESKTOP_CLIENT_ID` (the
Mobile-and-desktop platform registration; still a public client, no secret) and
- if the build wants LinkedIn at all - `VITE_LINKEDIN_CLIENT_ID` +
`VITE_LINKEDIN_CLIENT_SECRET`, the one genuinely confidential secret in this
set, which is why that provider is desktop-only and should be an org-owned
registration. Dropbox needs nothing extra for the desktop: it exempts localhost
redirect URIs, so the same app key serves both.
