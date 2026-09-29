# Sync your devices

Keep your projects, your brand and your settings the same on your computer,
your phone and your tablet. Lolly copies your work to one place that you
choose, and to nowhere else. You need no Lolly account for this.

## Your storage is the only server involved

When you turn on sync, you nominate one place to hold your work: your Dropbox,
your Google Drive, your OneDrive, your own Nextcloud or WebDAV server, or your
own S3 bucket. That place is the only remote host in the path.

- **No Lolly server.** Your work is never sent to lolly.tools, to a Lolly relay
  or to any other server that Lolly runs. The app on your device talks to your
  storage directly.
- **The apps do not need a Lolly website.** The desktop and mobile apps sync
  without lolly.tools or any other Lolly-hosted page, including during sign-in.
- **Personal Sync and lolly.work are separate.** [lolly.work](/info/organisation.html)
  adds organisation-held team projects, shared assets and work collabs. This
  personal backup sync talks directly to your chosen storage and works independently
  of that service; it does not back up the organisation's server.
- **Sign-in stays between you and your provider.** Dropbox, Google and
  Microsoft show their own sign-in page, and the answer comes back to the app
  on your device.

Where the sign-in answer comes back to:

- in a browser, the Lolly site you are using;
- in the desktop app, the app itself on your computer;
- in the mobile app, the app itself, through its own address
  `tools.lolly.mobile:/oauth2redirect`;
- for Google Drive on Android, Google Play services on the phone, which gives
  the answer straight to the app.

The full list of every network request the app makes is on the
[Privacy](/info/privacy.html) page.

## What syncs, and what stays on each device

**Syncs:**

- saved sessions and projects, including work a tool filed in **Projects** as you worked;
- your design systems, with their uploaded fonts and logos;
- your uploaded images and the copies of your downloads that Lolly keeps;
- Convert's file results;
- your profile and your preferences (theme, layout).

**Stays on each device:**

- sign-ins, keys and app passwords for your storage;
- your sync settings and your passphrase;
- the Lolly instance the app is connected to, and tools installed by a brand pack
  (a design system you added from a `.lolly` file does sync);
- downloaded catalogue files and on-device AI models;
- the revision history of each session.

Each device signs in to your storage by itself.

## Choose where to sync

What you can use depends on where you run Lolly. In the app, open
**Settings → Connected services → Sync across devices**. The list "Where this
device can sync" shows what works on the device you are using, and why the
other choices do not.

| Storage | Browser, on lolly.tools | Browser, on a Lolly you host | Desktop app | Mobile app |
|---|---|---|---|---|
| Dropbox | Yes | Yes, with the site's Dropbox app or your own | Yes | Yes, with the app's Dropbox app or your own |
| Google Drive | Yes, with the site's Google app or your own; you sign in once per visit | Yes, with the site's Google app or your own | Yes, when the app includes a Google app | Yes, when the app includes a Google app; on Android, also needs Google Play services on the phone |
| OneDrive | Yes, when the site includes a Microsoft app | Yes, when the site includes a Microsoft app | Yes, when the app includes a Microsoft app | Yes, when the app includes a Microsoft app for phones |
| Nextcloud or WebDAV | No | When the site's admin allows your server | Yes | Yes |
| S3-compatible bucket | No | When the site's admin allows your bucket | Yes | Yes |
| A file you move yourself | Yes | Yes | Yes | Yes |

**Why the browser on lolly.tools cannot reach your own server:** the site
only lets the page talk to a fixed list of hosts. This list is the guard that
stops injected code from sending your work somewhere else, and it cannot
name every person's own server. The apps allow any secure (`https://`)
address, so they can reach your server directly.

**Planned:**

- a folder that another app keeps in step, such as Syncthing or a cloud
  drive's own app;
- iCloud Drive in the Apple apps;
- sync straight to your other device on the same network, with no storage in
  between.

## Turn on sync

1. Open **Settings → Connected services** and connect your storage.
2. Under **Sync across devices**, choose it in **Where to sync**.
3. Turn on **Sync across my devices**.
4. On each of your other devices, connect the same storage and do the same.

If your storage already holds Lolly data, Lolly asks before it syncs.
**Bring it to this device** adds that data here and removes nothing: this
device keeps its folders, favourites, templates and settings and gains the ones
it did not have, and where a project is on both, the copy saved more recently
is kept.
**Replace it with this device** makes this device the synced copy.

## How sync keeps your work safe

- **Changes go up by themselves.** Lolly uploads a few seconds after you change
  something, and again when you leave the app. If you are offline, the change
  waits and goes up when you are back online. The sync section says when
  changes are waiting.
- **Nothing is overwritten by surprise.** Before each upload, Lolly checks the
  copy in your storage. If another device changed it and this device has
  changes of its own, automatic sync stops and asks you to choose. **Use the
  synced copy** updates this device, and saves its own changes to your
  storage first. **Keep this device** makes this device the synced copy, and
  keeps the copy it replaces.
- **Applying a newer copy can be undone.** When another device synced newer
  changes, Lolly offers to apply them. Before it does, it saves this device as
  **Before your last apply**. Items deleted on the other device are removed
  here too. Things you made on this device since it last synced are kept.
- **Earlier copies.** Your storage keeps one copy a day for the last seven
  days, plus the copy from before your last apply. Use **Restore an earlier
  copy** to go back to one. Your provider's own version history can keep
  more. You can also download any of these copies from your storage and open
  it in Lolly, or pick it in **Import data…**: it is added to the device like
  a backup, and an encrypted copy asks for your passphrase.

## Encryption is optional

Encryption is off unless you turn it on. Use it when you do not trust the
place you sync to.

- Enter a passphrase under **Sync across devices**. Your work is then
  encrypted on your device before it is uploaded, and your storage only holds
  data it cannot read.
- Every device needs the same passphrase.
- The passphrase stays on the device. It is never uploaded and never in a
  backup.
- **If you lose the passphrase, nobody can open the synced copies, and Lolly
  cannot recover them.** That is why it is not on by default.

## Set up each kind of storage

### Dropbox

Lolly can see only its own app folder in your Dropbox.

If the site or app has no Dropbox app of its own, use yours:

1. In the Dropbox App Console, create an app with **Scoped access** and
   **App folder** access.
2. Add the redirect URI for where you use Lolly (see the list below).
3. In Lolly, paste the app's **App key** into the Dropbox row and connect.

The redirect URI to add:

- in a browser: `<the Lolly site>/oauth-return.html`;
- in the desktop app: nothing;
- in the mobile app: `tools.lolly.mobile:/oauth2redirect`.

### Google Drive

Lolly can see only the files it created in your Drive.

- **In a browser,** the sign-in lasts for one visit. Sync works as soon as you
  sign in, and automatic sync pauses until you sign in again on your next
  visit.
- **On iPhone and iPad,** Google Drive works when the app includes a Google
  app for iOS.
- **On Android,** Google no longer accepts a browser sign-in from apps, so the
  app asks Google Play services on your phone instead. You agree once; after
  that, the app gets access without asking again. A phone without Google Play
  services (for example a de-Googled phone) cannot use Google Drive: choose
  another storage there.

On a Lolly site with no Google app, use your own:

1. In Google Cloud, create a project and turn on the Google Drive API.
2. Set the OAuth consent screen to External and add yourself as a test user.
3. Create an OAuth client of type **Web application**. Add the site as an
   authorised JavaScript origin, and `<the Lolly site>/oauth-return.html` as
   an authorised redirect URI.
4. Paste its **Client ID** into the Google Drive row and connect.

### OneDrive

Lolly can see only its own app folder in your OneDrive. Personal accounts and
work or school accounts both work.

### Nextcloud or WebDAV

1. In Nextcloud, open **Settings → Security** and create an app password for
   Lolly. Do not use your account password.
2. In Lolly, enter the server address, your user name, the app password and a
   folder name, then press **Save & test**.

- **In the apps,** the server must have an `https://` address on the public
  internet. A server that only your home network can reach does not work yet.
- **In a browser,** it works only on a Lolly you host yourself, when its admin
  allows your server and your server allows the site.

### S3-compatible bucket

1. Create an access key that can read and write only the bucket and prefix
   you want Lolly to use.
2. In Lolly, enter the endpoint, region, bucket, key and an optional prefix,
   then press **Save & test**.

- **In the apps,** no more set-up is needed. The endpoint must have an
  `https://` address on the public internet.
- **In a browser,** it works only on a Lolly you host yourself. Its admin must
  allow the bucket, and the bucket needs a CORS rule that allows the site with
  the methods `GET`, `PUT` and `HEAD`, the headers `authorization`,
  `content-type`, `x-amz-content-sha256`, `x-amz-date`, `if-match` and
  `if-none-match`, and that exposes `ETag` and `Last-Modified`.

### A file you move yourself

Open **Settings → Preferences → Storage → Move to another device**, press
**Export my data**, move the file to your other device, and press
**Import data…** there. This works everywhere and needs
no network. See [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device)
for the steps and what the file holds.

## For people who host Lolly or build the apps

The providers need a registration before their sign-in can work. None of
these registrations is a server: each one only tells the provider which
return addresses to trust.

- **Dropbox:** one app. Add `<site>/oauth-return.html` for the web and
  `tools.lolly.mobile:/oauth2redirect` for the mobile apps (the desktop apps
  need nothing). Build values: `VITE_DROPBOX_CLIENT_ID`, and
  `VITE_DROPBOX_MOBILE=1` once the mobile redirect is added.
- **Google:** a **Web application** client for the site
  (`VITE_GOOGLE_CLIENT_ID`), a **Desktop app** client for the desktop apps
  (`VITE_GOOGLE_DESKTOP_CLIENT_ID` and its secret, which Google treats as not
  confidential for installed apps), and an **iOS** client for bundle id
  `tools.lolly.mobile` (`VITE_GOOGLE_IOS_CLIENT_ID`). For Android, an
  **Android** client for package `tools.lolly.mobile` with the SHA-1
  fingerprint of each signing certificate (debug, release and, if you use it,
  the Play App Signing key); no client id goes into the build, only
  `VITE_GOOGLE_ANDROID_SIGN_IN=1`. The Android sign-in uses Google's Play
  services library, which is not open source; a build for de-Googled phones
  or F-Droid sets the Gradle property `lollyGooglePlayServices=false`, and
  Google Drive is then unavailable in that build.
- **Microsoft (Entra):** one app registration, with the scopes
  `Files.ReadWrite.AppFolder`, `User.Read` and `offline_access`, open to
  personal and work or school accounts. Under **Single-page application**, add
  `<site>/oauth-return.html` (`VITE_MS_CLIENT_ID`). Under **Mobile and desktop
  applications**, add `http://localhost/oauth-return` for the desktop apps
  (`VITE_MS_DESKTOP_CLIENT_ID`) and `tools.lolly.mobile:/oauth2redirect` for
  the mobile apps (`VITE_MS_MOBILE_CLIENT_ID`).
- **A self-hosted site** keeps the same content policy as lolly.tools. It
  already allows Dropbox, Google and Microsoft, including the Microsoft
  download hosts that OneDrive personal accounts use
  (`*.files.1drv.com`, `my.microsoftpersonalcontent.com`).

## Limits

- **Size.** A synced copy larger than 2 GB, or larger than 256 MB when sent
  from an app, is refused with a message, and so is a single item larger than
  512 MB. Every upload sends the whole copy, so a large library uploads
  slowly.
- **One person.** Sync keeps one person's devices in step. For two people
  working on the same thing, see [Working together](/info/collaborate.html).
- **Android sign-in.** If Android closes the app while a sign-in page is
  open, start the sign-in again. Google Drive on Android needs Google Play
  services.
