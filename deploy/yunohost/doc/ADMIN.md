## What the package does

It unpacks a prebuilt web build (`shells/web/dist` from the Lolly repository, with the neutral "lolly-start" brand and the English documentation) into the install directory and serves it with nginx. There is no service, no database and no configuration file on the server.

## Who can reach it

Access is the standard YunoHost permission on the app (`lolly.main`). The default is public (`visitors`), which matches how Lolly is normally offered: everyone who opens it works on their own device. Restrict it to a group if the domain should stay private to your users. Lolly itself has no accounts and no SSO login, so there is nothing to map users to.

## Your own brand

Open the app, then **Brand** in the sidebar: import design tokens (DTCG, Tokens Studio or Penpot exports) or build the palette, type and logos in place. The brand lives in the browser that made it. To hand the same brand to other people, export it as a `.lolly` file from the brand room and share that file; recipients add it from the same screen.

A governed, server-side brand for a whole team is what the separate **Lolly Work** package does, on top of this app.

## Headers and content policy

The nginx configuration ships a strict `Content-Security-Policy` identical to the hosted lolly.tools deployment. It is in `/etc/nginx/conf.d/<domain>.d/lolly.headers.inc`. If your YunoHost portal lives on a different domain than the app, the portal overlay button may not load on Lolly pages, because the policy only allows same-origin connections; the app is unaffected.

## Upgrades

`yunohost app upgrade lolly` replaces the build whole. Browsers pick up the new build on the next load (the app shell is never cached), and the offline service worker refreshes itself.
